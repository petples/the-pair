use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Opencode,
    Codex,
    Claude,
    Gemini,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenCodeConfig {
    pub provider: Option<HashMap<String, ProviderConfig>>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub options: Option<ProviderOptions>,
    pub models: Option<HashMap<String, ModelConfig>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderOptions {
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "baseURL")]
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelConfig {
    pub name: Option<String>,
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
        let mut models = Vec::new();
        let mut authenticated = false;

        // 1. Detect from ~/.config/opencode/opencode.json (user custom models)
        let config_path = homedir().join(".config/opencode/opencode.json");
        if config_path.exists() {
            authenticated = true;
            if let Some(config) = safe_read_json(config_path) {
                if let Some(providers) = config.get("provider").and_then(|p| p.as_object()) {
                    for (provider_id, provider_data) in providers {
                        if let Some(model_list) =
                            provider_data.get("models").and_then(|m| m.as_object())
                        {
                            for (model_id, model_config) in model_list {
                                let display_name = model_config
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or(model_id)
                                    .to_string();
                                models.push(DetectedModelOption {
                                    model_id: format!("{}/{}", provider_id, model_id),
                                    display_name,
                                    source_provider: Some(provider_id.clone()),
                                    subscription_label: "custom-provider".into(),
                                    supports_pair_execution: true,
                                    runnable: true,
                                });
                            }
                        }
                    }
                }
            }
        }

        // 2. Detect from ~/.local/share/opencode/auth.json (internal providers via /connect)
        let auth_path = homedir().join(".local/share/opencode/auth.json");
        let mut internal_providers = Vec::new();
        if auth_path.exists() {
            authenticated = true;
            if let Some(auth_data) = safe_read_json(auth_path) {
                if let Some(obj) = auth_data.as_object() {
                    for provider_id in obj.keys() {
                        internal_providers.push(provider_id.clone());
                    }
                }
            }
        }

        // 3. Detect from 'opencode models' command output
        if installed {
            let output = Command::new("opencode").arg("models").output();

            if let Ok(o) = output {
                if o.status.success() {
                    let content = String::from_utf8_lossy(&o.stdout);
                    for line in content.lines() {
                        let line = line.trim();
                        if line.is_empty() {
                            continue;
                        }

                        // Check if we already added this model from config
                        if models.iter().any(|m| m.model_id == line) {
                            continue;
                        }

                        let parts: Vec<&str> = line.split('/').collect();
                        if parts.len() >= 2 {
                            let provider_id = parts[0];
                            let model_name = parts[1..].join("/");

                            // Check if this model belongs to an authenticated provider (either internal or custom)
                            let is_authenticated = internal_providers
                                .contains(&provider_id.to_string())
                                || models
                                    .iter()
                                    .any(|m| m.source_provider.as_deref() == Some(provider_id));

                            if is_authenticated {
                                models.push(DetectedModelOption {
                                    model_id: line.to_string(),
                                    display_name: model_name,
                                    source_provider: Some(provider_id.to_string()),
                                    subscription_label: if provider_id == "opencode" {
                                        "zen-backed".into()
                                    } else {
                                        "internal-provider".into()
                                    },
                                    supports_pair_execution: true,
                                    runnable: true,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Fallback defaults if still empty
        if models.is_empty() && installed {
            for m in &["claude-3-5-sonnet", "gpt-4o"] {
                models.push(DetectedModelOption {
                    model_id: format!("opencode/{}", m),
                    display_name: m.to_string(),
                    source_provider: Some("openai".into()),
                    subscription_label: "zen-backed".into(),
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
            subscription_label: "multi-provider".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    fn detect_codex() -> DetectedProviderProfile {
        let installed = which_binary("codex");
        let homedir = homedir();
        let auth_path = homedir.join(".codex/auth.json");
        let config_path = homedir.join(".codex/config.toml");

        let authenticated = auth_path.exists();
        let mut models = Vec::new();
        let subscription_label = "subscription-backed".to_string();

        if authenticated || config_path.exists() {
            // Default common models
            let mut model_ids = vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "o1".to_string(),
                "o3".to_string(),
            ];

            // Try to extract current model from config.toml
            if config_path.exists() {
                if let Ok(content) = fs::read_to_string(&config_path) {
                    // Primitive regex-like matching for "model = \"...\""
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("model =") {
                            if let Some(m) = line.split('"').nth(1) {
                                if !model_ids.contains(&m.to_string()) {
                                    model_ids.push(m.to_string());
                                }
                            }
                        }
                    }
                }
            }

            for m in model_ids {
                models.push(DetectedModelOption {
                    model_id: m.clone(),
                    display_name: m,
                    source_provider: Some("openai".into()),
                    subscription_label: subscription_label.clone(),
                    supports_pair_execution: true,
                    runnable: true,
                });
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Codex,
            installed,
            authenticated,
            runnable: installed && (authenticated || config_path.exists()),
            subscription_label,
            current_models: models,
            detected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    fn detect_claude() -> DetectedProviderProfile {
        let installed = which_binary("claude");
        let mut authenticated = false;
        let mut subscription_label = "api-backed".to_string();
        let mut models = Vec::new();

        if installed {
            let output = Command::new("claude").arg("auth").arg("status").output();

            if let Ok(o) = output {
                let status_str = String::from_utf8_lossy(&o.stdout);
                if let Ok(status) = serde_json::from_str::<serde_json::Value>(&status_str) {
                    if status
                        .get("loggedIn")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                    {
                        authenticated = true;
                        subscription_label = "subscription-backed".to_string();
                    }
                }
            }

            // Also check for ANTHROPIC_API_KEY env var as fallback auth
            if !authenticated && std::env::var("ANTHROPIC_API_KEY").is_ok() {
                authenticated = true;
            }

            if authenticated {
                for m in &[
                    "claude-3-5-sonnet",
                    "claude-3-5-haiku",
                    "claude-3-opus",
                    "claude-3-7-sonnet",
                ] {
                    models.push(DetectedModelOption {
                        model_id: m.to_string(),
                        display_name: m.to_string(),
                        source_provider: Some("anthropic".into()),
                        subscription_label: subscription_label.clone(),
                        supports_pair_execution: true,
                        runnable: true,
                    });
                }
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Claude,
            installed,
            authenticated,
            runnable: installed && authenticated,
            subscription_label,
            current_models: models,
            detected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    fn detect_gemini() -> DetectedProviderProfile {
        let installed = which_binary("gemini");
        let homedir = homedir();
        let settings_path = homedir.join(".gemini/settings.json");
        let mut authenticated = false;
        let mut models = Vec::new();
        let mut current_model = "gemini-1.5-pro".to_string();

        if settings_path.exists() {
            authenticated = true;
            if let Some(settings) = safe_read_json(settings_path) {
                if let Some(name) = settings
                    .get("model")
                    .and_then(|m| m.get("name"))
                    .and_then(|n| n.as_str())
                {
                    current_model = name.to_string();
                }
            }
        }

        if installed {
            let model_ids = vec![
                "gemini-1.5-pro".to_string(),
                "gemini-1.5-flash".to_string(),
                "gemini-2.0-flash".to_string(),
                "gemini-2.0-pro-exp".to_string(),
                "gemini-2.5-pro".to_string(),
                "gemini-2.5-flash".to_string(),
            ];

            for m in model_ids {
                // Check if this is the currently selected model in settings
                let _is_current = m == current_model;
                models.push(DetectedModelOption {
                    model_id: m.clone(),
                    display_name: m,
                    source_provider: Some("google".into()),
                    subscription_label: "subscription-backed".into(),
                    supports_pair_execution: true,
                    runnable: true,
                });
            }
        }

        DetectedProviderProfile {
            kind: ProviderKind::Gemini,
            installed,
            authenticated,
            runnable: installed && authenticated,
            subscription_label: "subscription-backed".into(),
            current_models: models,
            detected_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}
