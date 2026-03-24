use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Opencode,
    Codex,
    Claude,
    Gemini,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum InputTransport {
    Stdio,
    JsonEvents,
    SessionJson,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum OutputTransport {
    Stdio,
    JsonEvents,
    SessionJson,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum SessionStrategy {
    NewFirst,
    ResumeExisting,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum PermissionStrategy {
    Auto,
    ManualConfirm,
    PreApproved,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum CwdStrategy {
    Worktree,
    OriginalRepo,
    Custom,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PairRuntimeSpec {
    pub executable: String,
    pub input_transport: InputTransport,
    pub output_transport: OutputTransport,
    pub session_strategy: SessionStrategy,
    pub permission_strategy: PermissionStrategy,
    pub cwd_strategy: CwdStrategy,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedModelOption {
    pub model_id: String,
    pub display_name: String,
    pub source_provider: Option<String>,
    pub subscription_label: String,
    pub supports_pair_execution: bool,
    pub runnable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedProviderProfile {
    pub kind: ProviderKind,
    pub installed: bool,
    pub authenticated: bool,
    pub runnable: bool,
    pub subscription_label: String,
    pub current_models: Vec<DetectedModelOption>,
    pub detected_at: u64,
}

fn homedir() -> PathBuf {
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home)
}

fn which_binary(name: &str) -> bool {
    #[cfg(target_os = "windows")]
    let cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let cmd = "which";

    Command::new(cmd)
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn safe_read_json(path: PathBuf) -> Option<serde_json::Value> {
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

pub struct ProviderRegistry;

impl ProviderRegistry {
    pub fn detect_all() -> Vec<DetectedProviderProfile> {
        let mut profiles = Vec::new();
        profiles.push(Self::detect_opencode());
        profiles.push(Self::detect_codex());
        profiles.push(Self::detect_claude());
        profiles.push(Self::detect_gemini());
        profiles
    }

    fn detect_opencode() -> DetectedProviderProfile {
        let installed = which_binary("opencode");
        let config_path = homedir().join(".config/opencode/opencode.json");
        let authenticated = config_path.exists();
        
        let mut models = Vec::new();
        if authenticated {
            if let Some(config) = safe_read_json(config_path) {
                if let Some(providers) = config.get("provider").and_then(|p| p.as_object()) {
                    for (provider_id, provider_data) in providers {
                        if let Some(model_list) = provider_data.get("models").and_then(|m| m.as_object()) {
                            for (model_id, model_config) in model_list {
                                let display_name = model_config.get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or(model_id)
                                    .to_string();
                                models.push(DetectedModelOption {
                                    model_id: format!("{}/{}", provider_id, model_id),
                                    display_name,
                                    source_provider: Some(provider_id.clone()),
                                    subscription_label: "provider-backed".into(),
                                    supports_pair_execution: true,
                                    runnable: true,
                                });
                            }
                        }
                    }
                }
            }
        }

        if models.is_empty() && installed {
            for m in &["claude-3-5-sonnet", "gpt-4o"] {
                models.push(DetectedModelOption {
                    model_id: format!("opencode/{}", m),
                    display_name: m.to_string(),
                    source_provider: Some("openai".into()),
                    subscription_label: "provider-backed".into(),
                    supports_pair_execution: true,
                    runnable: true,
                });
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Opencode,
            installed,
            authenticated,
            runnable: installed,
            subscription_label: "provider-backed".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    fn detect_codex() -> DetectedProviderProfile {
        let installed = which_binary("codex");
        let auth_path = homedir().join(".codex/auth.json");
        let authenticated = auth_path.exists();
        
        let mut models = Vec::new();
        if authenticated {
             for m in &["gpt-4o", "gpt-4o-mini"] {
                models.push(DetectedModelOption {
                    model_id: m.to_string(),
                    display_name: m.to_string(),
                    source_provider: Some("openai".into()),
                    subscription_label: "subscription-backed".into(),
                    supports_pair_execution: true,
                    runnable: true,
                });
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Codex,
            installed,
            authenticated,
            runnable: installed,
            subscription_label: "subscription-backed".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    fn detect_claude() -> DetectedProviderProfile {
        let installed = which_binary("claude");
        let mut authenticated = false;
        if installed {
            authenticated = Command::new("claude")
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
        }

        let mut models = Vec::new();
        if authenticated {
            for m in &["claude-3-5-sonnet", "claude-3-5-haiku"] {
                models.push(DetectedModelOption {
                    model_id: m.to_string(),
                    display_name: m.to_string(),
                    source_provider: Some("anthropic".into()),
                    subscription_label: "subscription-backed".into(),
                    supports_pair_execution: true,
                    runnable: true,
                });
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Claude,
            installed,
            authenticated,
            runnable: installed,
            subscription_label: "subscription-backed".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    fn detect_gemini() -> DetectedProviderProfile {
        let installed = which_binary("gemini");
        let settings_path = homedir().join(".gemini/settings.json");
        let authenticated = settings_path.exists();

        let mut models = Vec::new();
        for m in &["gemini-1.5-pro", "gemini-1.5-flash"] {
            models.push(DetectedModelOption {
                model_id: m.to_string(),
                display_name: m.to_string(),
                source_provider: Some("google".into()),
                subscription_label: "authenticated".into(),
                supports_pair_execution: authenticated,
                runnable: false,
            });
        }

        DetectedProviderProfile {
            kind: ProviderKind::Gemini,
            installed,
            authenticated,
            runnable: false,
            subscription_label: "authenticated".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    pub fn get_runtime_spec(kind: ProviderKind) -> PairRuntimeSpec {
        match kind {
            ProviderKind::Opencode => PairRuntimeSpec {
                executable: "opencode".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::JsonEvents,
                session_strategy: SessionStrategy::NewFirst,
                permission_strategy: PermissionStrategy::Auto,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Codex => PairRuntimeSpec {
                executable: "codex".into(),
                input_transport: InputTransport::SessionJson,
                output_transport: OutputTransport::SessionJson,
                session_strategy: SessionStrategy::ResumeExisting,
                permission_strategy: PermissionStrategy::Auto,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Claude => PairRuntimeSpec {
                executable: "claude".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::JsonEvents,
                session_strategy: SessionStrategy::ResumeExisting,
                permission_strategy: PermissionStrategy::PreApproved,
                cwd_strategy: CwdStrategy::Worktree,
            },
            ProviderKind::Gemini => PairRuntimeSpec {
                executable: "gemini".into(),
                input_transport: InputTransport::Stdio,
                output_transport: OutputTransport::Stdio,
                session_strategy: SessionStrategy::NewFirst,
                permission_strategy: PermissionStrategy::ManualConfirm,
                cwd_strategy: CwdStrategy::Worktree,
            },
        }
    }

    pub fn get_arg_builder(kind: ProviderKind, model: &str, session_id: Option<&str>) -> Vec<String> {
        match kind {
            ProviderKind::Opencode => {
                let mut args = vec!["run".into(), "--model".into(), model.into()];
                if let Some(sid) = session_id {
                    args.push("--session".into());
                    args.push(sid.into());
                }
                args.push("--format".into());
                args.push("json".into());
                args
            }
            ProviderKind::Codex => {
                let mut args = vec!["exec".into(), "--model".into(), model.into(), "--json".into()];
                if let Some(sid) = session_id {
                    args.push("resume".into());
                    args.push(sid.into());
                }
                args
            }
            ProviderKind::Claude => {
                let mut args = vec!["-p".into(), "--model".into(), model.into(), "--output-format".into(), "stream-json".into()];
                if let Some(sid) = session_id {
                    args.push("--session-id".into());
                    args.push(sid.into());
                }
                args
            }
            ProviderKind::Gemini => {
                vec!["--model".into(), model.into()]
            }
        }
    }
}
