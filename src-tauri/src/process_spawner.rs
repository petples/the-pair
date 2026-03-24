use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::{Command, Child};
use tokio::io::{BufReader, AsyncBufReadExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use crate::provider_registry::{ProviderKind, ProviderRegistry};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessContext {
    pub pair_id: String,
    pub directory: String,
    pub mentor_model: String,
    pub executor_model: String,
    pub mentor_session_id: Option<String>,
    pub executor_session_id: Option<String>,
}

pub struct ProcessSpawner {
    pub active_processes: Arc<Mutex<HashMap<String, Child>>>,
    pub pair_contexts: Arc<Mutex<HashMap<String, ProcessContext>>>,
}

impl ProcessSpawner {
    pub fn new() -> Self {
        Self {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            pair_contexts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn trigger_turn(&self, app: tauri::AppHandle, pair_id: String, role: String, message: String) -> Result<(), String> {
        let ctx = {
            let ctx_guard = self.pair_contexts.lock().unwrap();
            ctx_guard.get(&pair_id).ok_or("Pair context not found")?.clone()
        };

        let model = if role == "mentor" { &ctx.mentor_model } else { &ctx.executor_model };
        let session_id = if role == "mentor" { ctx.mentor_session_id.as_deref() } else { ctx.executor_session_id.as_deref() };
        
        // Determine provider kind from model name or some other way
        // For now let's assume it's encoded or we can guess
        let provider_kind = if model.starts_with("opencode") {
            ProviderKind::Opencode
        } else if ctx.mentor_model.contains("claude") {
            ProviderKind::Claude
        } else {
            ProviderKind::Opencode // Default
        };

        let spec = ProviderRegistry::get_runtime_spec(provider_kind);
        let mut args = ProviderRegistry::get_arg_builder(provider_kind, model, session_id);
        
        // Add the message as a positional argument for opencode
        args.push(message.clone());
        
        println!("[ProcessSpawner] Spawning: {} {:?}", spec.executable, args);

        let mut child = Command::new(&spec.executable)
            .args(&args)
            .current_dir(&ctx.directory)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", spec.executable, e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        
        let mut reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let pair_id_clone = pair_id.clone();
        let role_clone = role.clone();
        let contexts = self.pair_contexts.clone();
        let app_clone = app.clone();

        // Spawn stderr reader
        let pair_id_clone_err = pair_id.clone();
        let role_clone_err = role.clone();
        let app_clone_err = app.clone();
        
        tokio::spawn(async move {
            use tauri::Manager;
            use crate::message_broker::MessageBroker;

            while let Ok(Some(line)) = stderr_reader.next_line().await {
                println!("[ProcessSpawner] [STDERR] [{}] {}: {}", pair_id_clone_err, role_clone_err, line);
                
                if let Some(broker) = app_clone_err.try_state::<Mutex<MessageBroker>>() {
                    let broker = broker.lock().unwrap();
                    broker.add_log_line(&pair_id_clone_err, &role_clone_err, &format!("[STDERR] {}", line));
                }
            }
        });

        tokio::spawn(async move {
            use tauri::Manager;
            use crate::message_broker::MessageBroker;
            use crate::types::ActivityPhase;

            let mut first_output = true;

            while let Ok(Some(line)) = reader.next_line().await {
                println!("[ProcessSpawner] [{}] {}: {}", pair_id_clone, role_clone, line);
                
                // Report log line to MessageBroker
                if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                    let broker = broker.lock().unwrap();
                    broker.add_log_line(&pair_id_clone, &role_clone, &line);

                    if first_output {
                        broker.update_agent_activity(
                            &pair_id_clone,
                            &role_clone,
                            ActivityPhase::Responding,
                            "Processing response".to_string(),
                            None
                        );
                        first_output = false;
                    }
                }

                // Parse JSON events if needed
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(sid) = event.get("sessionID").and_then(|s| s.as_str()) {
                        let mut guard = contexts.lock().unwrap();
                        if let Some(c) = guard.get_mut(&pair_id_clone) {
                            if role_clone == "mentor" {
                                c.mentor_session_id = Some(sid.to_string());
                            } else {
                                c.executor_session_id = Some(sid.to_string());
                            }
                        }
                    }
                }
            }

            // Process exited (stream closed)
            if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                 let broker = broker.lock().unwrap();
                 broker.update_agent_activity(
                     &pair_id_clone,
                     &role_clone,
                     ActivityPhase::Idle,
                     "Turn finished".to_string(),
                     None
                 );
            }
        });

        let mut guard = self.active_processes.lock().unwrap();
        guard.insert(format!("{}-{}", pair_id, role), child);

        Ok(())
    }
}
