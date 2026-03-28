use crate::provider_registry::ProviderKind;
use std::path::PathBuf;

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InputTransport {
    Stdio,
    JsonEvents,
    SessionJson,
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutputTransport {
    Stdio,
    JsonEvents,
    SessionJson,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionStrategy {
    NewFirst,
    ResumeExisting,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PermissionStrategy {
    Auto,
    ManualConfirm,
    PreApproved,
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CwdStrategy {
    Worktree,
    OriginalRepo,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderRuntimeSpec {
    pub executable: String,
    pub input_transport: InputTransport,
    pub output_transport: OutputTransport,
    pub session_strategy: SessionStrategy,
    pub permission_strategy: PermissionStrategy,
    pub cwd_strategy: CwdStrategy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderTurnRequest<'a> {
    pub provider_kind: ProviderKind,
    pub model: &'a str,
    pub session_id: Option<&'a str>,
    pub role: &'a str,
    pub pair_id: &'a str,
    pub message: &'a str,
    pub reasoning_effort: Option<&'a str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderTurnCommand {
    pub executable: String,
    pub args: Vec<String>,
    pub last_message_path: Option<PathBuf>,
}

pub struct ProviderAdapter;

impl ProviderAdapter {
    pub fn runtime_spec(kind: ProviderKind) -> ProviderRuntimeSpec {
        match kind {
            ProviderKind::Opencode => ProviderRuntimeSpec {
                executable: "opencode".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::JsonEvents,
                session_strategy: SessionStrategy::NewFirst,
                permission_strategy: PermissionStrategy::Auto,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Codex => ProviderRuntimeSpec {
                executable: "codex".into(),
                input_transport: InputTransport::SessionJson,
                output_transport: OutputTransport::SessionJson,
                session_strategy: SessionStrategy::ResumeExisting,
                permission_strategy: PermissionStrategy::Auto,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Claude => ProviderRuntimeSpec {
                executable: "claude".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::JsonEvents,
                session_strategy: SessionStrategy::ResumeExisting,
                permission_strategy: PermissionStrategy::PreApproved,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Gemini => ProviderRuntimeSpec {
                executable: "gemini".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::JsonEvents,
                session_strategy: SessionStrategy::NewFirst,
                permission_strategy: PermissionStrategy::ManualConfirm,
                cwd_strategy: CwdStrategy::Worktree,
            },
        }
    }

    pub fn build_turn_command(request: ProviderTurnRequest<'_>) -> ProviderTurnCommand {
        match request.provider_kind {
            ProviderKind::Opencode => {
                let mut args = vec!["run".into(), "--model".into(), request.model.into()];
                if let Some(sid) = request.session_id {
                    args.push("--session".into());
                    args.push(sid.into());
                }
                args.push("--format".into());
                args.push("json".into());
                args.push(request.message.into());

                ProviderTurnCommand {
                    executable: "opencode".into(),
                    args,
                    last_message_path: None,
                }
            }
            ProviderKind::Codex => {
                let mut args = vec!["exec".into()];
                if let Some(sid) = request.session_id {
                    args.push("resume".into());
                    args.push(sid.into());
                }
                args.push("--model".into());
                args.push(request.model.into());
                if request.role == "mentor" {
                    args.push("--sandbox".into());
                    args.push("read-only".into());
                }
                if let Some(effort) = request.reasoning_effort {
                    args.push("--reasoning-effort".into());
                    args.push(effort.into());
                }

                let last_message_path = std::env::temp_dir().join(format!(
                    "the-pair-{}-{}-{}.txt",
                    request.pair_id,
                    request.role,
                    uuid::Uuid::new_v4()
                ));
                args.push("--json".into());
                args.push("--output-last-message".into());
                args.push(last_message_path.to_string_lossy().into_owned());
                args.push(request.message.into());

                ProviderTurnCommand {
                    executable: "codex".into(),
                    args,
                    last_message_path: Some(last_message_path),
                }
            }
            ProviderKind::Claude => {
                let mut args = vec![
                    "-p".into(),
                    "--verbose".into(),
                    "--model".into(),
                    request.model.into(),
                    "--output-format".into(),
                    "stream-json".into(),
                ];
                if request.role == "mentor" {
                    args.push("--permission-mode".into());
                    args.push("plan".into());
                } else {
                    args.push("--permission-mode".into());
                    args.push("auto".into());
                }
                if let Some(sid) = request.session_id {
                    args.push("--resume".into());
                    args.push(sid.into());
                }
                if let Some(effort) = request.reasoning_effort {
                    args.push("--reasoning-effort".into());
                    args.push(effort.into());
                }
                args.push(request.message.into());

                ProviderTurnCommand {
                    executable: "claude".into(),
                    args,
                    last_message_path: None,
                }
            }
            ProviderKind::Gemini => {
                let mut args = vec![
                    "--model".into(),
                    request.model.into(),
                    "--output-format".into(),
                    "stream-json".into(),
                ];
                if let Some(effort) = request.reasoning_effort {
                    let budget = match effort {
                        "none" => "0",
                        "low" => "1024",
                        "medium" => "8192",
                        "high" => "32768",
                        _ => "8192",
                    };
                    args.push("--thinking-budget".into());
                    args.push(budget.into());
                }
                args.push(request.message.into());

                ProviderTurnCommand {
                    executable: "gemini".into(),
                    args,
                    last_message_path: None,
                }
            }
        }
    }

    pub fn infer_provider_kind(model: &str) -> ProviderKind {
        if model.starts_with("opencode") || model.contains("/") {
            let parts: Vec<&str> = model.split('/').collect();
            if parts.len() >= 2 {
                return match parts[0] {
                    "codex" => ProviderKind::Codex,
                    "claude" => ProviderKind::Claude,
                    "gemini" => ProviderKind::Gemini,
                    _ => ProviderKind::Opencode,
                };
            }

            ProviderKind::Opencode
        } else if model.contains("claude") {
            ProviderKind::Claude
        } else if model.contains("gemini") {
            ProviderKind::Gemini
        } else if model.contains("gpt") || model.starts_with("o1") || model.starts_with("o3") {
            ProviderKind::Codex
        } else {
            ProviderKind::Opencode
        }
    }

    pub fn read_last_message_file(path: &PathBuf) -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;
        let trimmed = content.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_resume_command_captures_last_message_file() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Codex,
            model: "gpt-4o-mini",
            session_id: Some("session-123"),
            role: "executor",
            pair_id: "pair-1",
            message: "hello world",
            reasoning_effort: None,
        });

        assert_eq!(command.executable, "codex");
        assert_eq!(
            command.args,
            vec![
                "exec".to_string(),
                "resume".to_string(),
                "session-123".to_string(),
                "--model".to_string(),
                "gpt-4o-mini".to_string(),
                "--json".to_string(),
                "--output-last-message".to_string(),
                command
                    .last_message_path
                    .as_ref()
                    .expect("codex should capture last message")
                    .to_string_lossy()
                    .into_owned(),
                "hello world".to_string()
            ]
        );
    }

    #[test]
    fn claude_command_uses_stream_json_and_resume_flags() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Claude,
            model: "sonnet",
            session_id: Some("claude-session"),
            role: "mentor",
            pair_id: "pair-1",
            message: "plan the work",
            reasoning_effort: None,
        });

        assert_eq!(command.executable, "claude");
        assert_eq!(
            command.args,
            vec![
                "-p".to_string(),
                "--verbose".to_string(),
                "--model".to_string(),
                "sonnet".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--permission-mode".to_string(),
                "plan".to_string(),
                "--resume".to_string(),
                "claude-session".to_string(),
                "plan the work".to_string()
            ]
        );
        assert!(command.last_message_path.is_none());
    }

    #[test]
    fn gemini_command_uses_stream_json_headless_flags() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Gemini,
            model: "gemini-2.5-pro",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "explain the current diff",
            reasoning_effort: None,
        });

        assert_eq!(command.executable, "gemini");
        assert_eq!(
            command.args,
            vec![
                "--model".to_string(),
                "gemini-2.5-pro".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "explain the current diff".to_string()
            ]
        );
        assert!(command.last_message_path.is_none());
    }

    #[test]
    fn inference_keeps_legacy_string_heuristics_for_snapshot_fallbacks() {
        assert_eq!(
            ProviderAdapter::infer_provider_kind("codex/gpt-4o-mini"),
            ProviderKind::Codex
        );
        assert_eq!(
            ProviderAdapter::infer_provider_kind("claude-3-5-sonnet"),
            ProviderKind::Claude
        );
        assert_eq!(
            ProviderAdapter::infer_provider_kind("gemini-2.5-pro"),
            ProviderKind::Gemini
        );
    }

    #[test]
    fn claude_command_injects_reasoning_effort_flag() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Claude,
            model: "sonnet",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "do the work",
            reasoning_effort: Some("high"),
        });

        assert!(command.args.contains(&"--reasoning-effort".to_string()));
        assert!(command.args.contains(&"high".to_string()));
    }

    #[test]
    fn gemini_command_maps_reasoning_effort_to_thinking_budget() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Gemini,
            model: "gemini-2.5-pro",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "do the work",
            reasoning_effort: Some("high"),
        });

        assert!(command.args.contains(&"--thinking-budget".to_string()));
        assert!(command.args.contains(&"32768".to_string()));
    }

    #[test]
    fn gemini_command_maps_reasoning_effort_none_to_zero_budget() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Gemini,
            model: "gemini-2.5-pro",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "do the work",
            reasoning_effort: Some("none"),
        });

        assert!(command.args.contains(&"--thinking-budget".to_string()));
        assert!(command.args.contains(&"0".to_string()));
    }

    #[test]
    fn codex_command_injects_reasoning_effort_flag() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Codex,
            model: "o3",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "do the work",
            reasoning_effort: Some("medium"),
        });

        assert!(command.args.contains(&"--reasoning-effort".to_string()));
        assert!(command.args.contains(&"medium".to_string()));
    }

    #[test]
    fn opencode_command_does_not_add_reasoning_effort() {
        let command = ProviderAdapter::build_turn_command(ProviderTurnRequest {
            provider_kind: ProviderKind::Opencode,
            model: "openai/gpt-4o-mini",
            session_id: None,
            role: "executor",
            pair_id: "pair-1",
            message: "do the work",
            reasoning_effort: Some("high"),
        });

        assert!(!command.args.contains(&"--reasoning-effort".to_string()));
        assert!(!command.args.contains(&"high".to_string()));
    }
}
