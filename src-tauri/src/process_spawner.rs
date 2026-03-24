use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::{Command, Child};
use tokio::io::{BufReader, AsyncBufReadExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use crate::provider_registry::{ProviderKind, ProviderRegistry, OutputTransport};

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

    pub async fn trigger_turn(&self, pair_id: String, role: String, message: String) -> Result<(), String> {
        let ctx_guard = self.pair_contexts.lock().unwrap();
        let ctx = ctx_guard.get(&pair_id).ok_or("Pair context not found")?.clone();
        drop(ctx_guard);

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
        let args = ProviderRegistry::get_arg_builder(provider_kind, model, session_id);

        let mut child = Command::new(&spec.executable)
            .args(&args)
            .current_dir(&ctx.directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", spec.executable, e))?;

        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            stdin.write_all(message.as_bytes()).await.map_err(|e| e.to_string())?;
        }

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let mut reader = BufReader::new(stdout).lines();

        let pair_id_clone = pair_id.clone();
        let role_clone = role.clone();
        let contexts = self.pair_contexts.clone();

        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[ProcessSpawner] [{}] {}: {}", pair_id_clone, role_clone, line);
                
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
        });

        let mut guard = self.active_processes.lock().unwrap();
        guard.insert(format!("{}-{}", pair_id, role), child);

        Ok(())
    }
}
