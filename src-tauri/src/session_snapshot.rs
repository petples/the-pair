use crate::message_broker::MessageBroker;
use crate::pair_manager::PairManager;
use crate::process_spawner::{ProcessContext, ProcessSpawner};
use crate::provider_adapter::ProviderAdapter;
use crate::provider_registry::ProviderKind;
use crate::types::{
    AgentActivity, AgentRole, GitTracking, Message, MessageSender, MessageType, ModifiedFile, Pair,
    PairResources, PairState, PairStatus, ResourceInfo,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const SNAPSHOT_VERSION: u32 = 1;
const SNAPSHOT_DIR_NAME: &str = "pair-snapshots";
const INDEX_FILE_NAME: &str = "index.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotTurnCard {
    pub id: String,
    pub role: AgentRole,
    pub state: String,
    pub content: String,
    pub activity: AgentActivity,
    pub started_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotRunSummary {
    pub id: String,
    pub spec: String,
    pub status: PairStatus,
    pub started_at: u64,
    pub finished_at: Option<u64>,
    pub mentor_model: String,
    pub executor_model: String,
    pub iterations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotProcessContext {
    pub mentor_session_id: Option<String>,
    pub executor_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshotRecord {
    pub snapshot_version: u32,
    pub saved_at: u64,
    pub pair_id: String,
    pub name: String,
    pub directory: String,
    pub spec: String,
    pub status: PairStatus,
    pub iterations: u32,
    pub max_iterations: u32,
    pub turn: AgentRole,
    pub mentor_provider: Option<ProviderKind>,
    pub mentor_model: String,
    pub executor_provider: Option<ProviderKind>,
    pub executor_model: String,
    pub pending_mentor_model: Option<String>,
    pub pending_executor_model: Option<String>,
    pub messages: Vec<Message>,
    pub mentor_activity: AgentActivity,
    pub executor_activity: AgentActivity,
    pub mentor_cpu: f64,
    pub mentor_mem_mb: f64,
    pub executor_cpu: f64,
    pub executor_mem_mb: f64,
    pub cpu_usage: f64,
    pub mem_usage: f64,
    pub modified_files: Vec<ModifiedFile>,
    pub git_tracking: GitTracking,
    pub automation_mode: String,
    pub current_turn_card: Option<SnapshotTurnCard>,
    pub run_count: u32,
    pub run_history: Vec<SnapshotRunSummary>,
    pub current_run_started_at: u64,
    pub current_run_finished_at: Option<u64>,
    pub created_at: u64,
    pub provider_sessions: SnapshotProcessContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshotDraft {
    pub pair_id: String,
    pub name: String,
    pub directory: String,
    pub spec: String,
    pub status: PairStatus,
    pub iterations: u32,
    pub max_iterations: u32,
    pub turn: AgentRole,
    pub mentor_provider: Option<ProviderKind>,
    pub mentor_model: String,
    pub executor_provider: Option<ProviderKind>,
    pub executor_model: String,
    pub pending_mentor_model: Option<String>,
    pub pending_executor_model: Option<String>,
    pub messages: Vec<Message>,
    pub mentor_activity: AgentActivity,
    pub executor_activity: AgentActivity,
    pub mentor_cpu: f64,
    pub mentor_mem_mb: f64,
    pub executor_cpu: f64,
    pub executor_mem_mb: f64,
    pub cpu_usage: f64,
    pub mem_usage: f64,
    pub modified_files: Vec<ModifiedFile>,
    pub git_tracking: GitTracking,
    pub automation_mode: String,
    pub current_turn_card: Option<SnapshotTurnCard>,
    pub run_count: u32,
    pub run_history: Vec<SnapshotRunSummary>,
    pub current_run_started_at: u64,
    pub current_run_finished_at: Option<u64>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverableSessionSummary {
    pub pair_id: String,
    pub name: String,
    pub directory: String,
    pub spec: String,
    pub status: PairStatus,
    pub turn: AgentRole,
    pub mentor_model: String,
    pub executor_model: String,
    pub pending_mentor_model: Option<String>,
    pub pending_executor_model: Option<String>,
    pub run_count: u32,
    pub current_run_started_at: u64,
    pub current_run_finished_at: Option<u64>,
    pub saved_at: u64,
    pub created_at: u64,
    pub current_turn_card: Option<SnapshotTurnCard>,
    pub has_mentor_session: bool,
    pub has_executor_session: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreSessionInput {
    pub pair_id: String,
    pub continue_run: bool,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

fn to_role_string(role: &AgentRole) -> &'static str {
    match role {
        AgentRole::Mentor => "mentor",
        AgentRole::Executor => "executor",
    }
}

fn resolve_provider_kind(provider: Option<ProviderKind>, model: &str) -> ProviderKind {
    provider.unwrap_or_else(|| ProviderAdapter::infer_provider_kind(model))
}

fn build_mentor_planning_prompt(task_spec: &str) -> String {
    format!(
        "ROLE: MENTOR. Analyze the following task and provide a detailed PLAN for the EXECUTOR. \
DO NOT execute it yourself. \
DO NOT run commands or edit files. \
Return ONLY a concrete PLAN with numbered executable steps (no intent-only preface).\n\nTASK: {}",
        task_spec
    )
}

fn build_executor_resume_prompt(snapshot: &SessionSnapshotRecord) -> String {
    let last_mentor_message = snapshot
        .messages
        .iter()
        .rev()
        .find(|message| {
            matches!(message.from, MessageSender::Mentor)
                && matches!(message.msg_type, MessageType::Plan | MessageType::Result)
        })
        .map(|message| message.content.trim().to_string())
        .unwrap_or_default();

    let mut prompt = String::from(
        "### ROLE: EXECUTOR\n\
Continue the previously restored session and keep executing the task.\n\
- DO NOT create a new plan.\n\
- DO NOT review your own work.\n\
- Keep going from the restored context.\n\n\
--- COMMAND TO EXECUTE ---\n",
    );

    if last_mentor_message.is_empty() {
        prompt.push_str(&snapshot.spec);
    } else {
        prompt.push_str(&last_mentor_message);
    }

    prompt
}

fn build_mentor_resume_prompt(snapshot: &SessionSnapshotRecord) -> String {
    let last_executor_message = snapshot
        .messages
        .iter()
        .rev()
        .find(|message| {
            matches!(message.from, MessageSender::Executor)
                && matches!(message.msg_type, MessageType::Plan | MessageType::Result)
        })
        .map(|message| message.content.trim().to_string())
        .unwrap_or_default();

    match snapshot.status {
        PairStatus::Reviewing => {
            let mut prompt = String::from(
                "### ROLE: MENTOR\n\
Continue the restored review session.\n\
- DO NOT execute files or commands.\n\
- Review the executor's work and decide whether the task is complete.\n\n\
--- REVIEW REQUEST ---\n",
            );
            if last_executor_message.is_empty() {
                prompt.push_str(&snapshot.spec);
            } else {
                prompt.push_str(&last_executor_message);
            }
            prompt
        }
        _ => build_mentor_planning_prompt(&snapshot.spec),
    }
}

fn build_resume_prompt(snapshot: &SessionSnapshotRecord) -> String {
    match snapshot.turn {
        AgentRole::Mentor => build_mentor_resume_prompt(snapshot),
        AgentRole::Executor => build_executor_resume_prompt(snapshot),
    }
}

fn snapshot_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    dir.push(SNAPSHOT_DIR_NAME);
    Ok(dir)
}

fn snapshot_index_path_in_dir(snapshot_dir: &Path) -> PathBuf {
    snapshot_dir.join(INDEX_FILE_NAME)
}

fn snapshot_file_path_in_dir(snapshot_dir: &Path, pair_id: &str) -> PathBuf {
    snapshot_dir.join(format!("{}.json", pair_id))
}

fn ensure_snapshot_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = snapshot_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create snapshot dir: {}", e))?;
    Ok(dir)
}

fn write_json_atomic<T: Serialize + ?Sized>(path: &Path, value: &T) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    let payload = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp_path, payload).map_err(|e| format!("Failed to write snapshot: {}", e))?;
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to move snapshot into place: {}", e))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn save_index_in_dir(
    snapshot_dir: &Path,
    summaries: &[RecoverableSessionSummary],
) -> Result<(), String> {
    let index_path = snapshot_index_path_in_dir(snapshot_dir);
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    write_json_atomic(&index_path, summaries)
}

fn save_index(app: &AppHandle, summaries: &[RecoverableSessionSummary]) -> Result<(), String> {
    let dir = snapshot_dir(app)?;
    save_index_in_dir(&dir, summaries)
}

fn load_index_from_dir(snapshot_dir: &Path) -> Result<Vec<RecoverableSessionSummary>, String> {
    let index_path = snapshot_index_path_in_dir(snapshot_dir);
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    read_json::<Vec<RecoverableSessionSummary>>(&index_path)
}

fn load_index(app: &AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    let dir = snapshot_dir(app)?;
    load_index_from_dir(&dir)
}

fn scan_snapshot_files_in_dir(
    snapshot_dir: &Path,
) -> Result<Vec<RecoverableSessionSummary>, String> {
    let mut summaries = Vec::new();

    let entries =
        fs::read_dir(snapshot_dir).map_err(|e| format!("Failed to read snapshot dir: {}", e))?;
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();
        if path.file_name().and_then(|name| name.to_str()) == Some(INDEX_FILE_NAME) {
            continue;
        }

        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        match read_json::<SessionSnapshotRecord>(&path) {
            Ok(snapshot) => summaries.push(snapshot.to_summary()),
            Err(err) => {
                println!(
                    "[session_snapshot] Skipping unreadable snapshot {:?}: {}",
                    path, err
                );
            }
        }
    }

    summaries.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(summaries)
}

fn scan_snapshot_files(app: &AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    let dir = ensure_snapshot_dir(app)?;
    scan_snapshot_files_in_dir(&dir)
}

fn load_summaries(app: &AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    match load_index(app) {
        Ok(from_index) if !from_index.is_empty() => return Ok(from_index),
        Ok(_) => {}
        Err(err) => {
            println!(
                "[session_snapshot] Failed to load index, falling back to file scan: {}",
                err
            );
        }
    }

    let scanned = scan_snapshot_files(app)?;
    if !scanned.is_empty() {
        save_index(app, &scanned)?;
    }
    Ok(scanned)
}

fn delete_pair_snapshot_in_dir(snapshot_dir: &Path, pair_id: &str) -> Result<(), String> {
    let path = snapshot_file_path_in_dir(snapshot_dir, pair_id);
    if path.exists() {
        let _ = fs::remove_file(&path);
    }

    let index_path = snapshot_index_path_in_dir(snapshot_dir);
    if !index_path.exists() {
        return Ok(());
    }

    let mut summaries = load_index_from_dir(snapshot_dir).unwrap_or_default();
    let before = summaries.len();
    summaries.retain(|entry| entry.pair_id != pair_id);
    if before != summaries.len() {
        save_index_in_dir(snapshot_dir, &summaries)?;
    }

    Ok(())
}

fn upsert_snapshot_record(app: &AppHandle, snapshot: &SessionSnapshotRecord) -> Result<(), String> {
    let path = snapshot_path_for_pair(app, &snapshot.pair_id)?;
    ensure_snapshot_dir(app)?;
    write_json_atomic(&path, snapshot)?;

    let mut summaries = load_summaries(app).unwrap_or_default();
    let summary = snapshot.to_summary();
    summaries.retain(|entry| entry.pair_id != summary.pair_id);
    summaries.push(summary);
    summaries.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    save_index(app, &summaries)?;

    Ok(())
}

fn current_turn_activity(activity: &AgentActivity) -> AgentActivity {
    activity.clone()
}

fn last_message_for_role(messages: &[Message], role: MessageSender) -> Option<Message> {
    messages
        .iter()
        .rev()
        .find(|message| {
            message.from == role
                && matches!(message.msg_type, MessageType::Plan | MessageType::Result)
        })
        .cloned()
}

fn snapshot_turn_card(card: Option<&SnapshotTurnCard>) -> Option<SnapshotTurnCard> {
    card.cloned()
}

impl SessionSnapshotRecord {
    fn to_summary(&self) -> RecoverableSessionSummary {
        RecoverableSessionSummary {
            pair_id: self.pair_id.clone(),
            name: self.name.clone(),
            directory: self.directory.clone(),
            spec: self.spec.clone(),
            status: self.status.clone(),
            turn: self.turn.clone(),
            mentor_model: self.mentor_model.clone(),
            executor_model: self.executor_model.clone(),
            pending_mentor_model: self.pending_mentor_model.clone(),
            pending_executor_model: self.pending_executor_model.clone(),
            run_count: self.run_count,
            current_run_started_at: self.current_run_started_at,
            current_run_finished_at: self.current_run_finished_at,
            saved_at: self.saved_at,
            created_at: self.created_at,
            current_turn_card: snapshot_turn_card(self.current_turn_card.as_ref()),
            has_mentor_session: self.provider_sessions.mentor_session_id.is_some(),
            has_executor_session: self.provider_sessions.executor_session_id.is_some(),
        }
    }
}

fn build_process_context(snapshot: &SessionSnapshotRecord) -> ProcessContext {
    ProcessContext {
        directory: snapshot.directory.clone(),
        mentor_provider: resolve_provider_kind(snapshot.mentor_provider, &snapshot.mentor_model),
        executor_provider: resolve_provider_kind(
            snapshot.executor_provider,
            &snapshot.executor_model,
        ),
        mentor_model: snapshot.mentor_model.clone(),
        executor_model: snapshot.executor_model.clone(),
        mentor_session_id: snapshot.provider_sessions.mentor_session_id.clone(),
        executor_session_id: snapshot.provider_sessions.executor_session_id.clone(),
    }
}

fn build_pair(snapshot: &SessionSnapshotRecord) -> Pair {
    Pair {
        pair_id: snapshot.pair_id.clone(),
        name: snapshot.name.clone(),
        directory: snapshot.directory.clone(),
        status: snapshot.status.clone(),
        mentor_provider: resolve_provider_kind(snapshot.mentor_provider, &snapshot.mentor_model),
        mentor_model: snapshot.mentor_model.clone(),
        executor_provider: resolve_provider_kind(
            snapshot.executor_provider,
            &snapshot.executor_model,
        ),
        executor_model: snapshot.executor_model.clone(),
        created_at: snapshot.created_at,
    }
}

fn build_pair_resources(snapshot: &SessionSnapshotRecord) -> PairResources {
    PairResources {
        mentor: ResourceInfo {
            cpu: snapshot.mentor_cpu,
            mem_mb: snapshot.mentor_mem_mb,
        },
        executor: ResourceInfo {
            cpu: snapshot.executor_cpu,
            mem_mb: snapshot.executor_mem_mb,
        },
        pair_total: ResourceInfo {
            cpu: snapshot.cpu_usage,
            mem_mb: snapshot.mem_usage,
        },
    }
}

fn build_pair_state(snapshot: &SessionSnapshotRecord) -> PairState {
    PairState {
        pair_id: snapshot.pair_id.clone(),
        directory: snapshot.directory.clone(),
        status: snapshot.status.clone(),
        iteration: snapshot.iterations,
        max_iterations: snapshot.max_iterations,
        turn: snapshot.turn.clone(),
        mentor: crate::types::AgentState {
            status: snapshot.status.clone(),
            turn: AgentRole::Mentor,
            last_message: last_message_for_role(&snapshot.messages, MessageSender::Mentor),
            activity: current_turn_activity(&snapshot.mentor_activity),
        },
        executor: crate::types::AgentState {
            status: snapshot.status.clone(),
            turn: AgentRole::Executor,
            last_message: last_message_for_role(&snapshot.messages, MessageSender::Executor),
            activity: current_turn_activity(&snapshot.executor_activity),
        },
        messages: snapshot.messages.clone(),
        mentor_activity: current_turn_activity(&snapshot.mentor_activity),
        executor_activity: current_turn_activity(&snapshot.executor_activity),
        resources: build_pair_resources(snapshot),
        modified_files: snapshot.modified_files.clone(),
        git_tracking: snapshot.git_tracking.clone(),
        automation_mode: snapshot.automation_mode.clone(),
        git_review_available: snapshot.git_tracking.git_review_available.unwrap_or(false),
    }
}

fn build_snapshot_from_state(
    pair: &Pair,
    state: &PairState,
    context: Option<&ProcessContext>,
) -> SessionSnapshotRecord {
    let context = context.cloned().unwrap_or(ProcessContext {
        directory: pair.directory.clone(),
        mentor_provider: pair.mentor_provider,
        executor_provider: pair.executor_provider,
        mentor_model: pair.mentor_model.clone(),
        executor_model: pair.executor_model.clone(),
        mentor_session_id: None,
        executor_session_id: None,
    });

    let current_turn_card = state
        .messages
        .iter()
        .rev()
        .find(|message| {
            (state.turn == AgentRole::Mentor && matches!(message.from, MessageSender::Mentor))
                || (state.turn == AgentRole::Executor
                    && matches!(message.from, MessageSender::Executor))
        })
        .map(|message| SnapshotTurnCard {
            id: message.id.clone(),
            role: state.turn.clone(),
            state: "live".to_string(),
            content: message.content.clone(),
            activity: if state.turn == AgentRole::Mentor {
                state.mentor_activity.clone()
            } else {
                state.executor_activity.clone()
            },
            started_at: message.timestamp,
            updated_at: message.timestamp,
        });

    SessionSnapshotRecord {
        snapshot_version: SNAPSHOT_VERSION,
        saved_at: now(),
        pair_id: pair.pair_id.clone(),
        name: pair.name.clone(),
        directory: pair.directory.clone(),
        spec: state
            .messages
            .iter()
            .find(|message| matches!(message.from, MessageSender::Human) && message.to == "mentor")
            .map(|message| message.content.clone())
            .unwrap_or_default(),
        status: state.status.clone(),
        iterations: state.iteration,
        max_iterations: state.max_iterations,
        turn: state.turn.clone(),
        mentor_provider: Some(pair.mentor_provider),
        mentor_model: pair.mentor_model.clone(),
        executor_provider: Some(pair.executor_provider),
        executor_model: pair.executor_model.clone(),
        pending_mentor_model: None,
        pending_executor_model: None,
        messages: state.messages.clone(),
        mentor_activity: state.mentor_activity.clone(),
        executor_activity: state.executor_activity.clone(),
        mentor_cpu: state.resources.mentor.cpu,
        mentor_mem_mb: state.resources.mentor.mem_mb,
        executor_cpu: state.resources.executor.cpu,
        executor_mem_mb: state.resources.executor.mem_mb,
        cpu_usage: state.resources.pair_total.cpu,
        mem_usage: state.resources.pair_total.mem_mb,
        modified_files: state.modified_files.clone(),
        git_tracking: state.git_tracking.clone(),
        automation_mode: state.automation_mode.clone(),
        current_turn_card,
        run_count: 1,
        run_history: Vec::new(),
        current_run_started_at: now(),
        current_run_finished_at: None,
        created_at: pair.created_at,
        provider_sessions: SnapshotProcessContext {
            mentor_session_id: context.mentor_session_id.clone(),
            executor_session_id: context.executor_session_id.clone(),
        },
    }
}

fn build_snapshot_from_draft(
    draft: SessionSnapshotDraft,
    context: Option<ProcessContext>,
) -> SessionSnapshotRecord {
    let context = context.unwrap_or(ProcessContext {
        directory: draft.directory.clone(),
        mentor_provider: resolve_provider_kind(draft.mentor_provider, &draft.mentor_model),
        executor_provider: resolve_provider_kind(draft.executor_provider, &draft.executor_model),
        mentor_model: draft.mentor_model.clone(),
        executor_model: draft.executor_model.clone(),
        mentor_session_id: None,
        executor_session_id: None,
    });

    SessionSnapshotRecord {
        snapshot_version: SNAPSHOT_VERSION,
        saved_at: now(),
        pair_id: draft.pair_id,
        name: draft.name,
        directory: draft.directory,
        spec: draft.spec,
        status: draft.status,
        iterations: draft.iterations,
        max_iterations: draft.max_iterations,
        turn: draft.turn,
        mentor_provider: draft.mentor_provider,
        mentor_model: draft.mentor_model,
        executor_provider: draft.executor_provider,
        executor_model: draft.executor_model,
        pending_mentor_model: draft.pending_mentor_model,
        pending_executor_model: draft.pending_executor_model,
        messages: draft.messages,
        mentor_activity: draft.mentor_activity,
        executor_activity: draft.executor_activity,
        mentor_cpu: draft.mentor_cpu,
        mentor_mem_mb: draft.mentor_mem_mb,
        executor_cpu: draft.executor_cpu,
        executor_mem_mb: draft.executor_mem_mb,
        cpu_usage: draft.cpu_usage,
        mem_usage: draft.mem_usage,
        modified_files: draft.modified_files,
        git_tracking: draft.git_tracking,
        automation_mode: draft.automation_mode,
        current_turn_card: draft.current_turn_card,
        run_count: draft.run_count,
        run_history: draft.run_history,
        current_run_started_at: draft.current_run_started_at,
        current_run_finished_at: draft.current_run_finished_at,
        created_at: draft.created_at,
        provider_sessions: SnapshotProcessContext {
            mentor_session_id: context.mentor_session_id,
            executor_session_id: context.executor_session_id,
        },
    }
}

fn snapshot_path_for_pair(app: &AppHandle, pair_id: &str) -> Result<PathBuf, String> {
    Ok(snapshot_dir(app)?.join(format!("{}.json", pair_id)))
}

pub fn persist_pair_snapshot_from_state(
    app: &AppHandle,
    pair_id: &str,
    state: &PairState,
) -> Result<(), String> {
    let pair_manager = app.state::<std::sync::Mutex<PairManager>>();
    let manager = pair_manager.lock().map_err(|e| e.to_string())?;
    let pair = manager
        .get_pair(pair_id)
        .ok_or_else(|| format!("Pair {} not found", pair_id))?;
    drop(manager);

    let spawner = app.state::<ProcessSpawner>();
    let context = {
        let contexts = spawner.pair_contexts.lock().map_err(|e| e.to_string())?;
        contexts.get(pair_id).cloned()
    };

    let mut snapshot = match read_snapshot(app, pair_id) {
        Ok(existing) => existing,
        Err(_) => build_snapshot_from_state(&pair, state, context.as_ref()),
    };

    snapshot.saved_at = now();
    snapshot.status = state.status.clone();
    snapshot.iterations = state.iteration;
    snapshot.max_iterations = state.max_iterations;
    snapshot.turn = state.turn.clone();
    snapshot.mentor_provider = Some(pair.mentor_provider);
    snapshot.mentor_model = pair.mentor_model.clone();
    snapshot.executor_provider = Some(pair.executor_provider);
    snapshot.executor_model = pair.executor_model.clone();
    snapshot.messages = state.messages.clone();
    snapshot.mentor_activity = state.mentor_activity.clone();
    snapshot.executor_activity = state.executor_activity.clone();
    snapshot.mentor_cpu = state.resources.mentor.cpu;
    snapshot.mentor_mem_mb = state.resources.mentor.mem_mb;
    snapshot.executor_cpu = state.resources.executor.cpu;
    snapshot.executor_mem_mb = state.resources.executor.mem_mb;
    snapshot.cpu_usage = state.resources.pair_total.cpu;
    snapshot.mem_usage = state.resources.pair_total.mem_mb;
    snapshot.modified_files = state.modified_files.clone();
    snapshot.git_tracking = state.git_tracking.clone();
    snapshot.automation_mode = state.automation_mode.clone();
    snapshot.provider_sessions = SnapshotProcessContext {
        mentor_session_id: context
            .as_ref()
            .and_then(|ctx| ctx.mentor_session_id.clone()),
        executor_session_id: context
            .as_ref()
            .and_then(|ctx| ctx.executor_session_id.clone()),
    };

    upsert_snapshot_record(app, &snapshot)
}

pub fn persist_current_pair_snapshot(app: &AppHandle, pair_id: &str) -> Result<(), String> {
    let broker = app.state::<std::sync::Mutex<MessageBroker>>();
    let state = {
        let broker_guard = broker.lock().map_err(|e| e.to_string())?;
        broker_guard.get_state(pair_id)
    };

    let state = match state {
        Some(state) => state,
        None => return Ok(()),
    };

    persist_pair_snapshot_from_state(app, pair_id, &state)
}

#[tauri::command]
pub fn session_save_snapshot(
    app: AppHandle,
    input: SessionSnapshotDraft,
) -> Result<SessionSnapshotRecord, String> {
    let context = {
        let spawner = app.state::<ProcessSpawner>();
        let contexts = spawner.pair_contexts.lock().map_err(|e| e.to_string())?;
        contexts.get(&input.pair_id).cloned()
    };

    let snapshot = build_snapshot_from_draft(input, context);
    upsert_snapshot_record(&app, &snapshot)?;

    Ok(snapshot)
}

pub fn delete_pair_snapshot(app: &AppHandle, pair_id: &str) -> Result<(), String> {
    let dir = snapshot_dir(app)?;
    delete_pair_snapshot_in_dir(&dir, pair_id)
}

#[tauri::command]
pub fn delete_recoverable_session(app: AppHandle, pair_id: String) -> Result<(), String> {
    delete_pair_snapshot(&app, &pair_id)
}

#[tauri::command]
pub fn list_recoverable_sessions(app: AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    let mut sessions = load_summaries(&app)?;
    sessions.retain(|session| session.status != PairStatus::Finished);
    sessions.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(sessions)
}

pub fn read_snapshot(app: &AppHandle, pair_id: &str) -> Result<SessionSnapshotRecord, String> {
    let path = snapshot_path_for_pair(app, pair_id)?;
    read_json(&path)
}

#[tauri::command]
pub async fn restore_session(
    app: AppHandle,
    pair_manager: State<'_, std::sync::Mutex<PairManager>>,
    broker: State<'_, std::sync::Mutex<MessageBroker>>,
    spawner: State<'_, ProcessSpawner>,
    input: RestoreSessionInput,
) -> Result<SessionSnapshotRecord, String> {
    let snapshot = read_snapshot(&app, &input.pair_id)?;
    let pair = build_pair(&snapshot);
    let state = build_pair_state(&snapshot);
    let context = build_process_context(&snapshot);

    {
        let mut manager = pair_manager.lock().map_err(|e| e.to_string())?;
        manager.upsert_pair(pair.clone());
    }

    {
        let broker_guard = broker.lock().map_err(|e| e.to_string())?;
        broker_guard.restore_state(state.clone())?;
    }
    {
        let mut contexts = spawner.pair_contexts.lock().map_err(|e| e.to_string())?;
        contexts.insert(pair.pair_id.clone(), context);
    }

    let mut updated_snapshot = snapshot.clone();
    updated_snapshot.provider_sessions = SnapshotProcessContext {
        mentor_session_id: updated_snapshot.provider_sessions.mentor_session_id.clone(),
        executor_session_id: updated_snapshot
            .provider_sessions
            .executor_session_id
            .clone(),
    };
    upsert_snapshot_record(&app, &updated_snapshot)?;

    let should_resume = input.continue_run
        && !matches!(
            snapshot.status,
            PairStatus::AwaitingHumanReview | PairStatus::Error | PairStatus::Finished
        );

    if should_resume {
        let role = to_role_string(&snapshot.turn).to_string();
        let prompt = build_resume_prompt(&snapshot);
        {
            let broker_guard = broker.lock().map_err(|e| e.to_string())?;
            broker_guard.prepare_run(&pair.pair_id, &role, spawner.active_processes.clone());
        }
        spawner
            .trigger_turn(app.clone(), pair.pair_id.clone(), role, prompt)
            .await?;
    }

    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider_registry::ProviderKind;
    use std::fs;

    fn activity(label: &str) -> AgentActivity {
        AgentActivity {
            phase: crate::types::ActivityPhase::Idle,
            label: label.to_string(),
            detail: None,
            started_at: 0,
            updated_at: 0,
        }
    }

    fn message(
        id: &str,
        from: MessageSender,
        msg_type: MessageType,
        content: &str,
        iteration: u32,
    ) -> Message {
        Message {
            id: id.to_string(),
            timestamp: 0,
            from,
            to: "human".to_string(),
            msg_type,
            content: content.to_string(),
            iteration,
        }
    }

    fn snapshot(
        turn: AgentRole,
        status: PairStatus,
        messages: Vec<Message>,
    ) -> SessionSnapshotRecord {
        SessionSnapshotRecord {
            snapshot_version: SNAPSHOT_VERSION,
            saved_at: 10,
            pair_id: "pair-1".to_string(),
            name: "Demo".to_string(),
            directory: "/tmp/project".to_string(),
            spec: "Fallback task spec".to_string(),
            status,
            iterations: 2,
            max_iterations: 3,
            turn: turn.clone(),
            mentor_provider: Some(ProviderKind::Opencode),
            mentor_model: "mentor-model".to_string(),
            executor_provider: Some(ProviderKind::Codex),
            executor_model: "executor-model".to_string(),
            pending_mentor_model: None,
            pending_executor_model: None,
            messages,
            mentor_activity: activity("Mentor reviewing"),
            executor_activity: activity("Executor working"),
            mentor_cpu: 1.0,
            mentor_mem_mb: 2.0,
            executor_cpu: 3.0,
            executor_mem_mb: 4.0,
            cpu_usage: 4.0,
            mem_usage: 6.0,
            modified_files: vec![],
            git_tracking: GitTracking {
                available: true,
                root_path: Some("/tmp/project".to_string()),
                baseline: Some("abc123".to_string()),
                git_review_available: Some(true),
            },
            automation_mode: "full-auto".to_string(),
            current_turn_card: Some(SnapshotTurnCard {
                id: "turn-1".to_string(),
                role: turn.clone(),
                state: "live".to_string(),
                content: "Turn content".to_string(),
                activity: activity("Turn activity"),
                started_at: 0,
                updated_at: 0,
            }),
            run_count: 1,
            run_history: vec![],
            current_run_started_at: 11,
            current_run_finished_at: None,
            created_at: 9,
            provider_sessions: SnapshotProcessContext {
                mentor_session_id: Some("ses_mentor".to_string()),
                executor_session_id: None,
            },
        }
    }

    fn legacy_snapshot(turn: AgentRole, status: PairStatus) -> SessionSnapshotRecord {
        let mut snapshot = snapshot(turn, status, vec![]);
        snapshot.mentor_provider = None;
        snapshot.executor_provider = None;
        snapshot.mentor_model = "claude-3-5-sonnet".to_string();
        snapshot.executor_model = "gpt-4o-mini".to_string();
        snapshot
    }

    fn draft() -> SessionSnapshotDraft {
        SessionSnapshotDraft {
            pair_id: "pair-1".to_string(),
            name: "Demo".to_string(),
            directory: "/tmp/project".to_string(),
            spec: "Fallback task spec".to_string(),
            status: PairStatus::Idle,
            iterations: 0,
            max_iterations: 3,
            turn: AgentRole::Mentor,
            mentor_provider: Some(ProviderKind::Claude),
            mentor_model: "claude-3-5-sonnet".to_string(),
            executor_provider: Some(ProviderKind::Codex),
            executor_model: "gpt-4o-mini".to_string(),
            pending_mentor_model: None,
            pending_executor_model: None,
            messages: vec![],
            mentor_activity: activity("Mentor idle"),
            executor_activity: activity("Executor idle"),
            mentor_cpu: 0.0,
            mentor_mem_mb: 0.0,
            executor_cpu: 0.0,
            executor_mem_mb: 0.0,
            cpu_usage: 0.0,
            mem_usage: 0.0,
            modified_files: vec![],
            git_tracking: GitTracking {
                available: false,
                root_path: None,
                baseline: None,
                git_review_available: Some(false),
            },
            automation_mode: "full-auto".to_string(),
            current_turn_card: None,
            run_count: 1,
            run_history: vec![],
            current_run_started_at: 0,
            current_run_finished_at: None,
            created_at: 0,
        }
    }

    #[test]
    fn build_resume_prompt_uses_last_mentor_plan_for_executor_turns() {
        let snapshot = snapshot(
            AgentRole::Executor,
            PairStatus::Executing,
            vec![
                message(
                    "msg-1",
                    MessageSender::Mentor,
                    MessageType::Plan,
                    "Implement the parser",
                    1,
                ),
                message(
                    "msg-2",
                    MessageSender::Executor,
                    MessageType::Progress,
                    "Working through the steps",
                    1,
                ),
            ],
        );

        let prompt = build_resume_prompt(&snapshot);
        assert!(prompt.contains("Continue the previously restored session"));
        assert!(prompt.contains("Implement the parser"));
        assert!(!prompt.contains("Fallback task spec"));
    }

    #[test]
    fn build_resume_prompt_uses_last_executor_result_for_reviewing_mentor_turns() {
        let snapshot = snapshot(
            AgentRole::Mentor,
            PairStatus::Reviewing,
            vec![
                message(
                    "msg-1",
                    MessageSender::Executor,
                    MessageType::Result,
                    "The feature is ready",
                    1,
                ),
                message(
                    "msg-2",
                    MessageSender::Mentor,
                    MessageType::Progress,
                    "Reviewing now",
                    1,
                ),
            ],
        );

        let prompt = build_resume_prompt(&snapshot);
        assert!(prompt.contains("Continue the restored review session"));
        assert!(prompt.contains("The feature is ready"));
    }

    #[test]
    fn build_snapshot_from_draft_persists_provider_kinds() {
        let record = build_snapshot_from_draft(draft(), None);

        assert_eq!(record.mentor_provider, Some(ProviderKind::Claude));
        assert_eq!(record.executor_provider, Some(ProviderKind::Codex));
        assert_eq!(record.mentor_model, "claude-3-5-sonnet");
        assert_eq!(record.executor_model, "gpt-4o-mini");
    }

    #[test]
    fn build_pair_and_process_context_infer_provider_kinds_for_legacy_snapshots() {
        let snapshot = legacy_snapshot(AgentRole::Executor, PairStatus::Executing);

        let pair = build_pair(&snapshot);
        let context = build_process_context(&snapshot);

        assert_eq!(pair.mentor_provider, ProviderKind::Claude);
        assert_eq!(pair.executor_provider, ProviderKind::Codex);
        assert_eq!(context.mentor_provider, ProviderKind::Claude);
        assert_eq!(context.executor_provider, ProviderKind::Codex);
    }

    #[test]
    fn to_summary_preserves_session_card_and_session_presence_flags() {
        let snapshot = snapshot(AgentRole::Mentor, PairStatus::Idle, vec![]);
        let summary = snapshot.to_summary();

        assert_eq!(summary.pair_id, "pair-1");
        assert_eq!(
            summary
                .current_turn_card
                .as_ref()
                .map(|card| card.id.as_str()),
            Some("turn-1")
        );
        assert!(summary.has_mentor_session);
        assert!(!summary.has_executor_session);
    }

    #[test]
    fn delete_pair_snapshot_in_dir_removes_snapshot_file_and_index_entry() {
        let dir =
            std::env::temp_dir().join(format!("the-pair-snapshot-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        let snapshot = snapshot(AgentRole::Mentor, PairStatus::Idle, vec![]);
        let pair_id = snapshot.pair_id.clone();
        let snapshot_path = dir.join(format!("{}.json", pair_id));
        let index_path = dir.join("index.json");

        fs::write(
            &snapshot_path,
            serde_json::to_vec_pretty(&snapshot).unwrap(),
        )
        .unwrap();

        let summaries = vec![
            snapshot.to_summary(),
            RecoverableSessionSummary {
                pair_id: "pair-2".to_string(),
                name: "Keep".to_string(),
                directory: "/tmp/keep".to_string(),
                spec: "Keep this".to_string(),
                status: PairStatus::Idle,
                turn: AgentRole::Executor,
                mentor_model: "mentor".to_string(),
                executor_model: "executor".to_string(),
                pending_mentor_model: None,
                pending_executor_model: None,
                run_count: 1,
                current_run_started_at: 1,
                current_run_finished_at: None,
                saved_at: 20,
                created_at: 2,
                current_turn_card: None,
                has_mentor_session: false,
                has_executor_session: false,
            },
        ];
        fs::write(&index_path, serde_json::to_vec_pretty(&summaries).unwrap()).unwrap();

        delete_pair_snapshot_in_dir(&dir, &pair_id).unwrap();

        assert!(!snapshot_path.exists());
        let remaining = fs::read_to_string(&index_path).unwrap();
        assert!(remaining.contains("pair-2"));
        assert!(!remaining.contains(&pair_id));

        let _ = fs::remove_dir_all(&dir);
    }
}
