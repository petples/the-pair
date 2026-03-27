use crate::message_broker::MessageBroker;
use crate::process_spawner::ProcessSpawner;
use crate::session_snapshot::delete_pair_snapshot;
use crate::session_snapshot::persist_current_pair_snapshot;
use crate::types::{AssignTaskInput, CreatePairInput, Pair, PairStatus};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

fn build_mentor_planning_prompt(task_spec: &str) -> String {
    format!(
        "ROLE: MENTOR. Analyze the following task and provide a detailed PLAN for the EXECUTOR. \
DO NOT execute it yourself. \
DO NOT run commands or edit files. \
Return ONLY a concrete PLAN with numbered executable steps (no intent-only preface).\n\nTASK: {}",
        task_spec
    )
}

pub struct PairManager {
    pairs: HashMap<String, Pair>,
}

impl PairManager {
    pub fn new() -> Self {
        Self {
            pairs: HashMap::new(),
        }
    }

    pub fn create_pair(
        &mut self,
        input: CreatePairInput,
        broker: &MessageBroker,
    ) -> Result<Pair, String> {
        println!("[PairManager::create_pair] Starting pair creation...");

        let pair_id = uuid::Uuid::new_v4().to_string();
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        println!("[PairManager::create_pair] Generated pair_id: {}", pair_id);

        let pair = Pair {
            pair_id: pair_id.clone(),
            name: input.name.clone(),
            directory: input.directory.clone(),
            status: PairStatus::Idle,
            mentor_provider: input.mentor.provider,
            mentor_model: input.mentor.model.clone(),
            executor_provider: input.executor.provider,
            executor_model: input.executor.model.clone(),
            pending_mentor_model: None,
            pending_executor_model: None,
            created_at,
        };

        self.pairs.insert(pair_id.clone(), pair.clone());
        println!("[PairManager::create_pair] Pair inserted into HashMap");

        // Initialize state machine
        println!("[PairManager::create_pair] Initializing broker state...");
        broker.initialize_pair(&pair_id, input)?;
        println!("[PairManager::create_pair] Broker state initialized successfully");

        Ok(pair)
    }

    pub fn get_pair(&self, pair_id: &str) -> Option<Pair> {
        self.pairs.get(pair_id).cloned()
    }

    pub fn upsert_pair(&mut self, pair: Pair) {
        self.pairs.insert(pair.pair_id.clone(), pair);
    }

    pub fn list_pairs(&self) -> Vec<Pair> {
        self.pairs.values().cloned().collect()
    }

    pub fn delete_pair(&mut self, pair_id: &str) -> Result<(), String> {
        self.pairs
            .remove(pair_id)
            .ok_or_else(|| format!("Pair {} not found", pair_id))?;
        Ok(())
    }
}

fn stop_pair_processes(spawner: &ProcessSpawner, pair_id: &str, remove_contexts: bool) {
    {
        let mut active_processes = spawner.active_processes.lock().unwrap();

        let mentor_key = format!("{}-mentor", pair_id);
        if let Some(mut child) = active_processes.remove(&mentor_key) {
            println!("[pair_stop] Killing mentor process for {}", pair_id);
            let _ = child.start_kill();
        }

        let executor_key = format!("{}-executor", pair_id);
        if let Some(mut child) = active_processes.remove(&executor_key) {
            println!("[pair_stop] Killing executor process for {}", pair_id);
            let _ = child.start_kill();
        }
    }

    if remove_contexts {
        let mut pair_contexts = spawner.pair_contexts.lock().unwrap();
        pair_contexts.remove(pair_id);
    }
}

#[tauri::command]
pub async fn pair_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Mutex<PairManager>>,
    broker: tauri::State<'_, std::sync::Mutex<MessageBroker>>,
    spawner: tauri::State<'_, ProcessSpawner>,
    input: CreatePairInput,
) -> Result<Pair, String> {
    println!(
        "[pair_create] Called with input: name={}, directory={}",
        input.name, input.directory
    );
    println!(
        "[pair_create] Mentor model: {}, Executor model: {}",
        input.mentor.model, input.executor.model
    );
    println!("[pair_create] Initial task spec: {}", input.spec);

    let task_spec = input.spec.clone();
    let mentor_bootstrap_prompt = build_mentor_planning_prompt(&task_spec);

    let pair = {
        let mut manager = state.lock().unwrap();
        let broker_guard = broker.lock().unwrap();

        let pair = manager.create_pair(input, &broker_guard)?;
        let pair_id = pair.pair_id.clone();

        println!(
            "[pair_create] Successfully created pair: id={}, name={}",
            pair.pair_id, pair.name
        );

        // Set up process context
        {
            let mut ctx_guard = spawner.pair_contexts.lock().unwrap();
            ctx_guard.insert(
                pair_id.clone(),
                crate::process_spawner::ProcessContext {
                    directory: pair.directory.clone(),
                    mentor_provider: pair.mentor_provider,
                    executor_provider: pair.executor_provider,
                    mentor_model: pair.mentor_model.clone(),
                    executor_model: pair.executor_model.clone(),
                    mentor_session_id: None,
                    executor_session_id: None,
                },
            );
        }

        // Start watching
        broker_guard.prepare_run(&pair_id, "mentor", spawner.active_processes.clone());

        pair
    };

    let pair_id = pair.pair_id.clone();

    // Trigger the initial task
    if !task_spec.trim().is_empty() {
        println!("[pair_create] Starting initial task...");
        spawner
            .trigger_turn(app, pair_id, "mentor".to_string(), mentor_bootstrap_prompt)
            .await?;
        println!("[pair_create] Initial task triggered successfully");
    }

    Ok(pair)
}

#[tauri::command]
pub async fn pair_assign_task(
    app: tauri::AppHandle,
    pair_manager: tauri::State<'_, std::sync::Mutex<PairManager>>,
    broker: tauri::State<'_, std::sync::Mutex<MessageBroker>>,
    spawner: tauri::State<'_, ProcessSpawner>,
    pair_id: String,
    input: AssignTaskInput,
) -> Result<(), String> {
    println!("[pair_assign_task] Called for pair_id: {}", pair_id);
    println!("[pair_assign_task] Task spec: {}", input.spec);

    let pair = {
        let manager = pair_manager.lock().unwrap();
        manager.pairs.get(&pair_id).ok_or("Pair not found")?.clone()
    };

    println!(
        "[pair_assign_task] Found pair: {} at {}",
        pair.name, pair.directory
    );
    println!(
        "[pair_assign_task] Mentor model: {}, Executor model: {}",
        pair.mentor_model, pair.executor_model
    );

    {
        let mut ctx_guard = spawner.pair_contexts.lock().unwrap();
        let existing = ctx_guard.get(&pair_id).map(|ctx| {
            (
                ctx.mentor_session_id.clone(),
                ctx.executor_session_id.clone(),
            )
        });
        let is_new_run = input.role.is_none();

        // Use pending models if available, otherwise fall back to default models
        let effective_mentor_model = pair
            .pending_mentor_model
            .as_ref()
            .unwrap_or(&pair.mentor_model)
            .clone();
        let effective_executor_model = pair
            .pending_executor_model
            .as_ref()
            .unwrap_or(&pair.executor_model)
            .clone();

        ctx_guard.insert(
            pair_id.clone(),
            crate::process_spawner::ProcessContext {
                directory: pair.directory.clone(),
                mentor_provider: pair.mentor_provider,
                executor_provider: pair.executor_provider,
                mentor_model: effective_mentor_model,
                executor_model: effective_executor_model,
                mentor_session_id: if is_new_run {
                    None
                } else {
                    existing
                        .as_ref()
                        .and_then(|(mentor_sid, _)| mentor_sid.clone())
                },
                executor_session_id: if is_new_run {
                    None
                } else {
                    existing
                        .as_ref()
                        .and_then(|(_, executor_sid)| executor_sid.clone())
                },
            },
        );
    }

    let role = input.role.clone().unwrap_or("mentor".to_string());
    let turn_prompt = if input.role.is_none() {
        build_mentor_planning_prompt(&input.spec)
    } else {
        input.spec
    };

    {
        let broker_guard = broker.lock().unwrap();
        broker_guard.prepare_run(&pair_id, &role, spawner.active_processes.clone());
    }

    println!("[pair_assign_task] About to trigger {} turn...", role);
    spawner
        .trigger_turn(app, pair_id, role.clone(), turn_prompt)
        .await?;
    println!("[pair_assign_task] {} turn triggered successfully", role);

    Ok(())
}

#[tauri::command]
pub fn pair_update_models(
    state: tauri::State<std::sync::Mutex<PairManager>>,
    pair_id: String,
    input: crate::types::UpdatePairModelsInput,
) -> Result<crate::types::UpdatePairModelsInput, String> {
    let mut manager = state.lock().unwrap();

    let pair = manager
        .pairs
        .get_mut(&pair_id)
        .ok_or_else(|| format!("Pair {} not found", pair_id))?;

    pair.mentor_model = input.mentor_model.clone();
    pair.executor_model = input.executor_model.clone();
    pair.pending_mentor_model = input.pending_mentor_model.clone();
    pair.pending_executor_model = input.pending_executor_model.clone();

    println!(
        "[pair_update_models] Updated pair {}: mentor={}, executor={}, pending_mentor={:?}, pending_executor={:?}",
        pair_id, pair.mentor_model, pair.executor_model, pair.pending_mentor_model, pair.pending_executor_model
    );

    Ok(input)
}

#[tauri::command]
pub fn pair_list(state: tauri::State<std::sync::Mutex<PairManager>>) -> Result<Vec<Pair>, String> {
    let manager = state.lock().unwrap();
    Ok(manager.list_pairs())
}

#[tauri::command]
pub fn pair_delete(
    app: tauri::AppHandle,
    state: tauri::State<std::sync::Mutex<PairManager>>,
    spawner: tauri::State<'_, ProcessSpawner>,
    pair_id: String,
) -> Result<(), String> {
    stop_pair_processes(&spawner, &pair_id, true);

    let mut manager = state.lock().unwrap();
    manager.delete_pair(&pair_id)?;

    let _ = delete_pair_snapshot(&app, &pair_id);

    Ok(())
}

#[tauri::command]
pub fn pair_pause(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Mutex<PairManager>>,
    broker: tauri::State<'_, std::sync::Mutex<MessageBroker>>,
    spawner: tauri::State<'_, ProcessSpawner>,
    pair_id: String,
) -> Result<(), String> {
    {
        let manager = state.lock().unwrap();
        if !manager.pairs.contains_key(&pair_id) {
            return Err(format!("Pair {} not found", pair_id));
        }
    }

    stop_pair_processes(&spawner, &pair_id, false);

    {
        let mut manager = state.lock().unwrap();
        let pair = manager
            .pairs
            .get_mut(&pair_id)
            .ok_or_else(|| format!("Pair {} not found", pair_id))?;
        pair.status = PairStatus::Paused;
    }

    {
        let broker = broker.lock().unwrap();
        broker.set_pair_status(
            &pair_id,
            PairStatus::Paused,
            Some("Paused by user".to_string()),
        );
    }

    let _ = persist_current_pair_snapshot(&app, &pair_id);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider_registry::ProviderKind;
    use crate::types::{AgentConfig, AgentRole, CreatePairInput};

    #[test]
    fn build_mentor_planning_prompt_requires_actionable_steps_and_keeps_task_in_view() {
        let prompt = build_mentor_planning_prompt("Add a dark mode toggle");

        assert!(prompt.contains("ROLE: MENTOR"));
        assert!(prompt.contains("Add a dark mode toggle"));
        assert!(prompt.contains("numbered executable steps"));
        assert!(prompt.contains("DO NOT execute it yourself"));
    }

    fn sample_input() -> CreatePairInput {
        CreatePairInput {
            name: "Demo".to_string(),
            directory: "/tmp/project".to_string(),
            spec: "Build the feature".to_string(),
            mentor: AgentConfig {
                role: AgentRole::Mentor,
                provider: ProviderKind::Opencode,
                model: "openai/gpt-4o-mini".to_string(),
            },
            executor: AgentConfig {
                role: AgentRole::Executor,
                provider: ProviderKind::Codex,
                model: "gpt-4o-mini".to_string(),
            },
        }
    }

    #[test]
    fn create_pair_keeps_explicit_provider_kinds_on_the_returned_pair() {
        let mut manager = PairManager::new();
        let broker = MessageBroker::new();

        let pair = manager
            .create_pair(sample_input(), &broker)
            .expect("pair should be created");

        assert_eq!(pair.mentor_provider, ProviderKind::Opencode);
        assert_eq!(pair.mentor_model, "openai/gpt-4o-mini");
        assert_eq!(pair.executor_provider, ProviderKind::Codex);
        assert_eq!(pair.executor_model, "gpt-4o-mini");
    }
}
