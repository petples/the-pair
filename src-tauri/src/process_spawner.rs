use crate::provider_adapter::{ProviderAdapter, ProviderTurnRequest};
use crate::provider_registry::ProviderKind;
use crate::session_snapshot::persist_current_pair_snapshot;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

#[derive(Clone)]
pub struct ProcessSpawner {
    pub active_processes: Arc<Mutex<HashMap<String, Child>>>,
    pub pair_contexts: Arc<Mutex<HashMap<String, ProcessContext>>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcessContext {
    pub directory: String,
    pub mentor_provider: ProviderKind,
    pub executor_provider: ProviderKind,
    pub mentor_model: String,
    pub executor_model: String,
    pub mentor_session_id: Option<String>,
    pub executor_session_id: Option<String>,
}

const MENTOR_FINISH_SIGNAL: &str = "TASK_COMPLETE";
const EMPTY_OUTPUT_PLACEHOLDER: &str = "(No textual output produced)";

fn parse_json_event(line: &str) -> Option<serde_json::Value> {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
        return Some(v);
    }

    if let Some(stripped) = line.strip_prefix("data:") {
        return serde_json::from_str::<serde_json::Value>(stripped.trim()).ok();
    }

    None
}

fn extract_session_id(event: &serde_json::Value) -> Option<String> {
    event
        .get("sessionID")
        .and_then(|s| s.as_str())
        .or_else(|| event.get("session_id").and_then(|s| s.as_str()))
        .or_else(|| {
            event
                .get("part")
                .and_then(|p| p.get("sessionID"))
                .and_then(|s| s.as_str())
        })
        .or_else(|| {
            event
                .get("part")
                .and_then(|p| p.get("session_id"))
                .and_then(|s| s.as_str())
        })
        .map(|s| s.to_string())
}

fn push_trimmed(out: &mut Vec<String>, s: &str) {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return;
    }

    if out.last().map(|last| last == trimmed).unwrap_or(false) {
        return;
    }

    out.push(trimmed.to_string());
}

fn collect_text_candidates(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => push_trimmed(out, s),
        serde_json::Value::Array(items) => {
            for item in items {
                collect_text_candidates(item, out);
            }
        }
        serde_json::Value::Object(map) => {
            for key in [
                "text",
                "content",
                "message",
                "delta",
                "part",
                "parts",
                "output_text",
                "response",
                "output",
            ] {
                if let Some(v) = map.get(key) {
                    collect_text_candidates(v, out);
                }
            }
        }
        _ => {}
    }
}

fn extract_event_texts(event: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();
    collect_text_candidates(event, &mut out);
    out
}

fn collapse_candidates(candidates: &[String]) -> Option<String> {
    if candidates.is_empty() {
        return None;
    }

    if candidates.windows(2).all(|window| window[0] == window[1]) {
        return Some(candidates[0].clone());
    }

    let joined = candidates.join("\n");
    let longest = candidates
        .iter()
        .max_by_key(|item| item.len())
        .map(|item| item.to_string())
        .unwrap_or_default();

    // Heuristic: stream snapshots tend to repeat full content each event.
    if longest.len().saturating_mul(2) >= joined.len() {
        return Some(longest);
    }

    Some(joined)
}

fn is_noise_event_type_for_final(event_type: &str) -> bool {
    if event_type.is_empty() {
        return false;
    }

    let lower = event_type.to_ascii_lowercase();
    lower.contains("thread.started")
        || lower.contains("turn.started")
        || lower.contains("step_start")
        || lower.contains("step_finish")
        || lower.contains("step_end")
        || lower.contains("tool")
        || lower.contains("progress")
        || lower.contains("error")
        || lower.contains("warning")
        || lower.contains("log")
}

fn is_noise_text_candidate(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }

    let lower = trimmed.to_ascii_lowercase();
    lower.starts_with("reconnecting...")
        || lower.contains("stream disconnected before completion")
        || lower.contains("failed to lookup address information")
        || lower.contains("falling back from websockets")
}

fn has_signal_token_on_own_line(content: &str, token: &str) -> bool {
    let upper_token = token.to_ascii_uppercase();

    content.lines().any(|line| {
        let normalized = line
            .trim()
            .trim_matches(|c: char| {
                c.is_whitespace()
                    || c == '`'
                    || c == '"'
                    || c == '\''
                    || c == '*'
                    || c == '_'
                    || c == '#'
                    || c == '-'
                    || c == ':'
                    || c == '.'
                    || c == ','
                    || c == '!'
                    || c == '?'
                    || c == '['
                    || c == ']'
                    || c == '('
                    || c == ')'
                    || c == '{'
                    || c == '}'
            })
            .to_ascii_uppercase();
        normalized == upper_token
    })
}

impl ProcessSpawner {
    pub fn new() -> Self {
        Self {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            pair_contexts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn trigger_turn(
        &self,
        app: tauri::AppHandle,
        pair_id: String,
        role: String,
        message: String,
    ) -> Result<(), String> {
        let contexts = self.pair_contexts.clone();
        let ctx = {
            let guard = contexts.lock().unwrap();
            let c = guard
                .get(&pair_id)
                .ok_or_else(|| format!("Context not found for pair {}", pair_id))?;
            (
                c.directory.clone(),
                c.mentor_provider,
                c.executor_provider,
                c.mentor_model.clone(),
                c.executor_model.clone(),
                c.mentor_session_id.clone(),
                c.executor_session_id.clone(),
            )
        };

        let (
            directory,
            mentor_provider,
            executor_provider,
            mentor_model,
            executor_model,
            mentor_sid,
            executor_sid,
        ) = ctx;
        let (model, session_id, provider_kind) = if role == "mentor" {
            (
                mentor_model.as_str(),
                mentor_sid.as_deref(),
                mentor_provider,
            )
        } else {
            (
                executor_model.as_str(),
                executor_sid.as_deref(),
                executor_provider,
            )
        };

        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind,
            model,
            session_id,
            role: &role,
            pair_id: &pair_id,
            message: &message,
        });
        let spec = ProviderAdapter::runtime_spec(provider_kind);
        let executable = command.executable.clone();
        let args = command.args;
        let codex_last_message_path = command.last_message_path;

        println!(
            "[ProcessSpawner] Spawning: {} {:?} (protocol: {:?})",
            executable, args, spec
        );

        let mut child = Command::new(&executable)
            .args(&args)
            .current_dir(&directory)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        let mut reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr).lines();

        let pair_id_clone = pair_id.clone();
        let role_clone = role.clone();
        let codex_last_message_path_clone = codex_last_message_path.clone();
        let app_clone = app.clone();
        let active_processes_for_cleanup = self.active_processes.clone();

        // Stderr watcher
        let pair_id_clone_err = pair_id.clone();
        let role_clone_err = role.clone();
        let app_clone_err = app.clone();
        tokio::spawn(async move {
            use crate::message_broker::MessageBroker;
            use tauri::Manager;

            while let Ok(Some(line)) = stderr_reader.next_line().await {
                println!(
                    "[ProcessSpawner] [STDERR] [{}] {}: {}",
                    pair_id_clone_err, role_clone_err, line
                );

                if let Some(broker) = app_clone_err.try_state::<Mutex<MessageBroker>>() {
                    let broker = broker.lock().unwrap();
                    broker.add_log_line(
                        &pair_id_clone_err,
                        &role_clone_err,
                        &format!("[STDERR] {}", line),
                    );
                }
            }
        });

        tokio::spawn(async move {
            use crate::message_broker::MessageBroker;
            use crate::types::{ActivityPhase, Message, MessageSender, MessageType};
            use tauri::Manager;

            let mut first_output = true;
            let mut accumulated_plain_output = String::new();
            let mut json_candidates: Vec<String> = Vec::new();

            // Get current iteration from state
            let current_iteration =
                if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                    let broker = broker.lock().unwrap();
                    broker
                        .get_state(&pair_id_clone)
                        .map(|s| s.iteration)
                        .unwrap_or(0)
                } else {
                    0
                };

            while let Ok(Some(line)) = reader.next_line().await {
                let mut is_internal_json = false;

                if let Some(event) = parse_json_event(&line) {
                    is_internal_json = true;
                    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    if !event_type.is_empty() {
                        println!(
                            "[ProcessSpawner] [{}] {}: [JSON] [TYPE: {}]",
                            pair_id_clone, role_clone, event_type
                        );
                    } else {
                        println!(
                            "[ProcessSpawner] [{}] {}: [JSON]",
                            pair_id_clone, role_clone
                        );
                    }

                    if !is_noise_event_type_for_final(event_type) {
                        let event_texts = extract_event_texts(&event);
                        for text in event_texts {
                            if !is_noise_text_candidate(&text) {
                                json_candidates.push(text);
                            }
                        }
                    }

                    if let Some(sid) = extract_session_id(&event) {
                        let mut should_persist_snapshot = false;
                        let mut guard = contexts.lock().unwrap();
                        if let Some(c) = guard.get_mut(&pair_id_clone) {
                            if role_clone == "mentor" {
                                if c.mentor_session_id.as_deref() != Some(sid.as_str()) {
                                    println!(
                                        "[ProcessSpawner] [{}] Registered mentor session: {}",
                                        pair_id_clone, sid
                                    );
                                    c.mentor_session_id = Some(sid);
                                    should_persist_snapshot = true;
                                }
                            } else {
                                if c.executor_session_id.as_deref() != Some(sid.as_str()) {
                                    println!(
                                        "[ProcessSpawner] [{}] Registered executor session: {}",
                                        pair_id_clone, sid
                                    );
                                    c.executor_session_id = Some(sid);
                                    should_persist_snapshot = true;
                                }
                            }
                        }
                        drop(guard);
                        if should_persist_snapshot {
                            let _ = persist_current_pair_snapshot(&app_clone, &pair_id_clone);
                        }
                    }
                } else {
                    println!(
                        "[ProcessSpawner] [{}] {}: {}",
                        pair_id_clone, role_clone, line
                    );
                }

                if first_output {
                    if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                        let broker = broker.lock().unwrap();
                        broker.update_agent_activity(
                            &pair_id_clone,
                            &role_clone,
                            ActivityPhase::Responding,
                            "Processing response".to_string(),
                            None,
                        );
                    }
                    first_output = false;
                }

                // Keep detailed logs, but avoid polluting plain output fallback with JSON internals.
                if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                    let broker = broker.lock().unwrap();
                    broker.add_log_line(&pair_id_clone, &role_clone, &line);
                }

                if !is_internal_json && !line.trim().is_empty() {
                    if !accumulated_plain_output.is_empty() {
                        accumulated_plain_output.push('\n');
                    }
                    accumulated_plain_output.push_str(&line);
                }
            }

            // Process exited (stream closed)
            println!(
                "[ProcessSpawner] [{}] {} process completed",
                pair_id_clone, role_clone
            );

            // Emit exactly one final user-facing message for the turn.
            let final_output_from_file = codex_last_message_path_clone
                .as_ref()
                .and_then(ProviderAdapter::read_last_message_file);

            if let Some(path) = &codex_last_message_path_clone {
                let _ = std::fs::remove_file(path);
            }

            let mut final_output = final_output_from_file
                .or_else(|| collapse_candidates(&json_candidates).filter(|s| !s.trim().is_empty()))
                .unwrap_or_else(|| accumulated_plain_output.trim().to_string());

            if final_output.trim().is_empty() {
                final_output = EMPTY_OUTPUT_PLACEHOLDER.to_string();
            }

            let outgoing_type = if role_clone == "mentor" {
                MessageType::Plan
            } else {
                MessageType::Result
            };

            let no_text_output = final_output.trim() == EMPTY_OUTPUT_PLACEHOLDER;
            if no_text_output {
                final_output = format!(
                    "No textual output captured from {}. Paused for manual review.",
                    role_clone
                );
            }

            if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                let broker = broker.lock().unwrap();
                broker.add_message(
                    &pair_id_clone,
                    Message {
                        id: uuid::Uuid::new_v4().to_string(),
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as u64,
                        from: if role_clone == "mentor" {
                            MessageSender::Mentor
                        } else {
                            MessageSender::Executor
                        },
                        to: "human".to_string(),
                        msg_type: outgoing_type,
                        content: final_output.clone(),
                        iteration: current_iteration,
                    },
                );
            }

            // Clean up from active processes
            {
                let mut guard = active_processes_for_cleanup.lock().unwrap();
                guard.remove(&format!("{}-{}", pair_id_clone, role_clone));
            }

            if let Some(broker) = app_clone.try_state::<Mutex<MessageBroker>>() {
                let broker = broker.lock().unwrap();
                broker.update_agent_activity(
                    &pair_id_clone,
                    &role_clone,
                    ActivityPhase::Idle,
                    "Turn finished".to_string(),
                    None,
                );
            }

            let mut should_handoff = true;
            let mentor_finish_signaled = role_clone == "mentor"
                && has_signal_token_on_own_line(&final_output, MENTOR_FINISH_SIGNAL);

            if let Some(broker_state) = app_clone.try_state::<Mutex<MessageBroker>>() {
                let broker = broker_state.lock().unwrap();

                if role_clone == "mentor" && mentor_finish_signaled {
                    println!(
                        "[ProcessSpawner] [{}] Mentor emitted finish signal {}, marking session as finished",
                        pair_id_clone, MENTOR_FINISH_SIGNAL
                    );
                    broker.set_pair_status(
                        &pair_id_clone,
                        crate::types::PairStatus::Finished,
                        Some(format!("Mentor signaled {}", MENTOR_FINISH_SIGNAL)),
                    );
                    should_handoff = false;
                } else if no_text_output {
                    println!(
                        "[ProcessSpawner] [{}] {} returned no textual output, pausing for human review",
                        pair_id_clone, role_clone
                    );
                    broker.set_pair_status(
                        &pair_id_clone,
                        crate::types::PairStatus::AwaitingHumanReview,
                        Some(format!("{} returned no textual output", role_clone)),
                    );
                    should_handoff = false;
                } else if role_clone == "executor" {
                    if let Some(state) = broker.get_state(&pair_id_clone) {
                        if state.iteration >= state.max_iterations {
                            println!(
                                "[ProcessSpawner] [{}] Max iterations reached ({}), pausing for human review",
                                pair_id_clone, state.max_iterations
                            );
                            broker.set_pair_status(
                                &pair_id_clone,
                                crate::types::PairStatus::AwaitingHumanReview,
                                Some(
                                    "Max iterations reached. Awaiting human intervention."
                                        .to_string(),
                                ),
                            );
                            should_handoff = false;
                        }
                    }
                }
            }

            if should_handoff {
                let next_role = if role_clone == "mentor" {
                    "executor"
                } else {
                    "mentor"
                };
                println!(
                    "[ProcessSpawner] [{}] Triggering handoff to {}",
                    pair_id_clone, next_role
                );
                let _ = app_clone.emit(
                    "pair:handoff",
                    serde_json::json!({
                        "pairId": pair_id_clone,
                        "nextRole": next_role
                    }),
                );
            } else {
                println!("[ProcessSpawner] [{}] Handoff skipped", pair_id_clone);
            }
        });

        let mut guard = self.active_processes.lock().unwrap();
        guard.insert(format!("{}-{}", pair_id, role), child);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_json_event_handles_raw_and_data_prefixed_payloads() {
        assert_eq!(
            parse_json_event(r#"{"type":"step_start"}"#).and_then(|event| event
                .get("type")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())),
            Some("step_start".to_string())
        );

        assert_eq!(
            parse_json_event(r#"data: {"type":"step_start"}"#).and_then(|event| event
                .get("type")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())),
            Some("step_start".to_string())
        );

        assert!(parse_json_event("plain text").is_none());
    }

    #[test]
    fn extract_session_id_prefers_top_level_fields_before_nested_payloads() {
        let event = json!({
            "sessionID": "ses_top_level",
            "part": {
                "sessionID": "ses_nested"
            }
        });

        assert_eq!(extract_session_id(&event).as_deref(), Some("ses_top_level"));
    }

    #[test]
    fn extract_event_texts_collects_nested_text_like_fields() {
        let event = json!({
            "text": "hello",
            "part": {
                "content": "world"
            },
            "parts": [
                { "message": "again" }
            ]
        });

        assert_eq!(
            extract_event_texts(&event),
            vec![
                "hello".to_string(),
                "world".to_string(),
                "again".to_string()
            ]
        );
    }

    #[test]
    fn collapse_candidates_prefers_deduplicated_snapshots_or_joins_distinct_fragments() {
        assert_eq!(
            collapse_candidates(&[
                "full snapshot".to_string(),
                "full snapshot".to_string(),
                "full snapshot".to_string()
            ]),
            Some("full snapshot".to_string())
        );

        assert_eq!(
            collapse_candidates(&["step one".to_string(), "step two".to_string()]),
            Some("step one\nstep two".to_string())
        );
    }

    #[test]
    fn has_signal_token_on_own_line_and_noise_checks_match_the_output_filters() {
        assert!(has_signal_token_on_own_line(
            "`TASK_COMPLETE`",
            "TASK_COMPLETE"
        ));
        assert!(!has_signal_token_on_own_line(
            "TASK_COMPLETE please",
            "TASK_COMPLETE"
        ));

        assert!(is_noise_event_type_for_final("thread.started"));
        assert!(is_noise_text_candidate("reconnecting..."));
        assert!(!is_noise_text_candidate("Work finished successfully"));
    }
}
