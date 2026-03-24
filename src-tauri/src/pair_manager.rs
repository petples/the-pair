use crate::types::{CreatePairInput, Pair, PairStatus, AssignTaskInput};
use crate::message_broker::MessageBroker;
use crate::process_spawner::ProcessSpawner;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

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
            mentor_model: input.mentor.model.clone(),
            executor_model: input.executor.model.clone(),
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

#[tauri::command]
pub async fn pair_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Mutex<PairManager>>,
    broker: tauri::State<'_, std::sync::Mutex<MessageBroker>>,
    spawner: tauri::State<'_, ProcessSpawner>,
    input: CreatePairInput,
) -> Result<Pair, String> {
    println!("[pair_create] Called with input: name={}, directory={}", input.name, input.directory);
    println!("[pair_create] Mentor model: {}, Executor model: {}", input.mentor.model, input.executor.model);
    println!("[pair_create] Initial task spec: {}", input.spec);
    
    let task_spec = input.spec.clone();
    
    let pair = {
        let mut manager = state.lock().unwrap();
        let broker_guard = broker.lock().unwrap();
        
        let pair = manager.create_pair(input, &broker_guard)?;
        let pair_id = pair.pair_id.clone();
        
        println!("[pair_create] Successfully created pair: id={}, name={}", pair.pair_id, pair.name);
        
        // Set up process context
        {
            let mut ctx_guard = spawner.pair_contexts.lock().unwrap();
            ctx_guard.insert(pair_id.clone(), crate::process_spawner::ProcessContext {
                pair_id: pair_id.clone(),
                directory: pair.directory.clone(),
                mentor_model: pair.mentor_model.clone(),
                executor_model: pair.executor_model.clone(),
                mentor_session_id: None,
                executor_session_id: None,
            });
        }
        
        // Start watching
        broker_guard.start_watching(&pair_id, spawner.active_processes.clone());
        
        pair
    };

    let pair_id = pair.pair_id.clone();
    
    // Trigger the initial task
    if !task_spec.trim().is_empty() {
        println!("[pair_create] Starting initial task...");
        spawner.trigger_turn(app, pair_id, "mentor".to_string(), task_spec).await?;
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
    
    println!("[pair_assign_task] Found pair: {} at {}", pair.name, pair.directory);
    println!("[pair_assign_task] Mentor model: {}, Executor model: {}", pair.mentor_model, pair.executor_model);
    
    {
        let mut ctx_guard = spawner.pair_contexts.lock().unwrap();
        ctx_guard.insert(pair_id.clone(), crate::process_spawner::ProcessContext {
            pair_id: pair_id.clone(),
            directory: pair.directory.clone(),
            mentor_model: pair.mentor_model.clone(),
            executor_model: pair.executor_model.clone(),
            mentor_session_id: None,
            executor_session_id: None,
        });
    }

    {
        let broker_guard = broker.lock().unwrap();
        broker_guard.start_watching(&pair_id, spawner.active_processes.clone());
    }
    
    println!("[pair_assign_task] About to trigger mentor turn...");
    spawner.trigger_turn(app, pair_id, "mentor".to_string(), input.spec).await?;
    println!("[pair_assign_task] Mentor turn triggered successfully");
    
    Ok(())
}

#[tauri::command]
pub fn pair_list(state: tauri::State<std::sync::Mutex<PairManager>>) -> Result<Vec<Pair>, String> {
    let manager = state.lock().unwrap();
    Ok(manager.list_pairs())
}

#[tauri::command]
pub fn pair_delete(
    state: tauri::State<std::sync::Mutex<PairManager>>,
    pair_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().unwrap();
    manager.delete_pair(&pair_id)
}
