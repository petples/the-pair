use crate::types::{
    ActivityPhase, AgentActivity, AgentRole, Message, MessageSender, MessageType, PairResources,
    PairState, PairStatus, ResourceInfo, CreatePairInput, GitTracking, AgentState
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct MessageBroker {
    pair_states: Arc<Mutex<HashMap<String, PairState>>>,
    app_handle: Option<AppHandle>,
}

impl MessageBroker {
    pub fn new() -> Self {
        Self {
            pair_states: Arc::new(Mutex::new(HashMap::new())),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    fn create_idle_activity(label: &str) -> AgentActivity {
        let now = Self::now();
        AgentActivity {
            phase: ActivityPhase::Idle,
            label: label.to_string(),
            detail: None,
            started_at: now,
            updated_at: now,
        }
    }

    pub fn initialize_pair(&self, pair_id: &str, input: CreatePairInput) -> Result<(), String> {
        println!("[MessageBroker::initialize_pair] Initializing pair: {}", pair_id);
        
        let empty_resources = PairResources {
            mentor: ResourceInfo { cpu: 0.0, mem_mb: 0.0 },
            executor: ResourceInfo { cpu: 0.0, mem_mb: 0.0 },
            pair_total: ResourceInfo { cpu: 0.0, mem_mb: 0.0 },
        };

        let state = PairState {
            pair_id: pair_id.to_string(),
            directory: input.directory.clone(),
            status: PairStatus::Idle,
            iteration: 0,
            max_iterations: 9999,
            turn: AgentRole::Mentor,
            mentor: AgentState {
                status: PairStatus::Idle,
                turn: AgentRole::Mentor,
                last_message: None,
                activity: Self::create_idle_activity("Mentor idle"),
            },
            executor: AgentState {
                status: PairStatus::Idle,
                turn: AgentRole::Executor,
                last_message: None,
                activity: Self::create_idle_activity("Executor idle"),
            },
            messages: Vec::new(),
            mentor_activity: Self::create_idle_activity("Mentor idle"),
            executor_activity: Self::create_idle_activity("Executor idle"),
            resources: empty_resources,
            modified_files: Vec::new(),
            git_tracking: GitTracking {
                available: false,
                root_path: None,
                baseline: None,
                git_review_available: Some(false),
            },
            automation_mode: "full-auto".to_string(),
            git_review_available: false,
        };

        let mut pair_states = self.pair_states.lock().unwrap();
        pair_states.insert(pair_id.to_string(), state);
        println!("[MessageBroker::initialize_pair] Pair state inserted successfully");
        Ok(())
    }

    #[allow(dead_code)]
    pub fn add_message(&self, pair_id: &str, message: Message) {
        let mut pair_states = self.pair_states.lock().unwrap();
        if let Some(state) = pair_states.get_mut(pair_id) {
            state.messages.push(message.clone());
            
            if message.msg_type == MessageType::Handoff {
                state.turn = if matches!(state.turn, AgentRole::Mentor) {
                    AgentRole::Executor
                } else {
                    AgentRole::Mentor
                };
                state.iteration += 1;
            }

            self.notify_state_update(pair_id, state);
            
            if let Some(handle) = &self.app_handle {
                let _ = handle.emit("pair:message", message);
            }
        }
    }

    pub fn add_log_line(&self, pair_id: &str, role: &str, line: &str) {
        let mut pair_states = self.pair_states.lock().unwrap();
        if let Some(state) = pair_states.get_mut(pair_id) {
            let msg = Message {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Self::now(),
                from: if role == "mentor" { MessageSender::Mentor } else { MessageSender::Executor },
                to: "human".to_string(),
                msg_type: MessageType::Progress,
                content: line.to_string(),
                iteration: state.iteration,
            };
            
            state.messages.push(msg.clone());
            
            if let Some(handle) = &self.app_handle {
                let _ = handle.emit("pair:message", msg);
                let _ = handle.emit("pair:state", state.clone());
            }
        }
    }

    pub fn start_watching(&self, pair_id: &str, active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>) {
        let mut pair_states = self.pair_states.lock().unwrap();
        if let Some(state) = pair_states.get_mut(pair_id) {
            state.status = PairStatus::Mentoring;
            state.turn = AgentRole::Mentor;
            state.iteration = 1;
            
            state.mentor.status = PairStatus::Executing;
            state.mentor_activity.phase = ActivityPhase::Thinking;
            state.mentor_activity.label = "Analyzing task".to_string();
            state.mentor_activity.detail = Some("Preparing first instruction".to_string());
            state.mentor_activity.updated_at = Self::now();
            
            state.executor_activity.phase = ActivityPhase::Waiting;
            state.executor_activity.label = "Executor standing by".to_string();
            state.executor_activity.updated_at = Self::now();

            self.notify_state_update(pair_id, state);
            
            println!("[MessageBroker] Started watching pair {}", pair_id);
        }
        drop(pair_states);

        let pair_states_clone = self.pair_states.clone();
        let app_handle_clone = self.app_handle.clone();
        let pair_id_string = pair_id.to_string();
        let active_processes_clone = active_processes.clone();

        tauri::async_runtime::spawn(async move {
            let mut sys = sysinfo::System::new_all();
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                let mut guard = pair_states_clone.lock().unwrap();
                if let Some(state) = guard.get_mut(&pair_id_string) {
                    if matches!(state.status, PairStatus::Finished | PairStatus::Error | PairStatus::Idle) {
                        break;
                    }
                    
                    crate::git_tracker::GitTracker::update_state(state);
                    crate::resource_monitor::ResourceMonitor::update_state(state, &mut sys, active_processes_clone.clone());
                    
                    if let Some(handle) = &app_handle_clone {
                        let _ = handle.emit("pair:state", state.clone());
                    }
                } else {
                    break;
                }
            }
        });
    }

    pub fn get_state(&self, pair_id: &str) -> Option<PairState> {
        let pair_states = self.pair_states.lock().unwrap();
        pair_states.get(pair_id).cloned()
    }

    pub fn update_agent_activity(&self, pair_id: &str, role: &str, phase: crate::types::ActivityPhase, label: String, detail: Option<String>) {
        let mut pair_states = self.pair_states.lock().unwrap();
        if let Some(state) = pair_states.get_mut(pair_id) {
             let activity = if role == "mentor" {
                 &mut state.mentor_activity
             } else {
                 &mut state.executor_activity
             };
             
             activity.phase = phase;
             activity.label = label;
             activity.detail = detail;
             activity.updated_at = Self::now();
             
             self.notify_state_update(pair_id, state);
        }
    }

    fn notify_state_update(&self, _pair_id: &str, state: &PairState) {
        if let Some(handle) = &self.app_handle {
            let _ = handle.emit("pair:state", state);
        }
    }
}
