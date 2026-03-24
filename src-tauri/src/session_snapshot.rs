use crate::message_broker::MessageBroker;
use crate::pair_manager::PairManager;
use crate::process_spawner::{ProcessContext, ProcessSpawner};
use crate::types::{
    AgentActivity, AgentRole, GitTracking, Message, MessageSender, MessageType, ModifiedFile,
    Pair, PairResources, PairState, PairStatus, ResourceInfo,
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
    pub mentor_model: String,
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
    pub mentor_model: String,
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

fn snapshot_index_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(snapshot_dir(app)?.join(INDEX_FILE_NAME))
}

fn snapshot_file_path(app: &AppHandle, pair_id: &str) -> Result<PathBuf, String> {
    Ok(snapshot_dir(app)?.join(format!("{}.json", pair_id)))
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

fn save_index(app: &AppHandle, summaries: &[RecoverableSessionSummary]) -> Result<(), String> {
    let index_path = snapshot_index_path(app)?;
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    write_json_atomic(&index_path, summaries)
}

fn load_index(app: &AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    let index_path = snapshot_index_path(app)?;
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    read_json::<Vec<RecoverableSessionSummary>>(&index_path)
}

fn scan_snapshot_files(app: &AppHandle) -> Result<Vec<RecoverableSessionSummary>, String> {
    let dir = ensure_snapshot_dir(app)?;
    let mut summaries = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read snapshot dir: {}", e))?;
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

fn upsert_snapshot_record(
    app: &AppHandle,
    snapshot: &SessionSnapshotRecord,
) -> Result<(), String> {
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
        mentor_model: snapshot.mentor_model.clone(),
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
        git_review_available: snapshot
            .git_tracking
            .git_review_available
            .unwrap_or(false),
    }
}

fn build_snapshot_from_state(
    pair: &Pair,
    state: &PairState,
    context: Option<&ProcessContext>,
) -> SessionSnapshotRecord {
    let context = context.cloned().unwrap_or(ProcessContext {
        directory: pair.directory.clone(),
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
        mentor_model: pair.mentor_model.clone(),
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
        mentor_model: draft.mentor_model,
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
    snapshot_file_path(app, pair_id)
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
    snapshot.mentor_model = pair.mentor_model.clone();
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
        mentor_session_id: context.as_ref().and_then(|ctx| ctx.mentor_session_id.clone()),
        executor_session_id: context.as_ref().and_then(|ctx| ctx.executor_session_id.clone()),
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
        let contexts = spawner
            .pair_contexts
            .lock()
            .map_err(|e| e.to_string())?;
        contexts.get(&input.pair_id).cloned()
    };

    let snapshot = build_snapshot_from_draft(input, context);
    upsert_snapshot_record(&app, &snapshot)?;

    Ok(snapshot)
}

pub fn delete_pair_snapshot(app: &AppHandle, pair_id: &str) -> Result<(), String> {
    let path = snapshot_path_for_pair(app, pair_id)?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }

    let mut summaries = load_summaries(app).unwrap_or_default();
    let before = summaries.len();
    summaries.retain(|entry| entry.pair_id != pair_id);
    if before != summaries.len() {
        save_index(app, &summaries)?;
    }

    Ok(())
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
        executor_session_id: updated_snapshot.provider_sessions.executor_session_id.clone(),
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
        spawner.trigger_turn(app.clone(), pair.pair_id.clone(), role, prompt).await?;
    }

    Ok(snapshot)
}
