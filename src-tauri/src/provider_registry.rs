use crate::config_paths::{opencode_auth_path, opencode_config_path};
use crate::path_env::fallback_path_dirs;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
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
    pub family: Option<String>,
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

    if Command::new(cmd)
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return true;
    }

    // Fallback: check known install locations directly in case PATH was not
    // captured from the login shell (common when app is launched from Finder/Dock
    // on Apple Silicon where Homebrew installs to /opt/homebrew/bin).
    binary_exists_at_known_locations(name, &homedir())
}

fn safe_read_json<T: DeserializeOwned>(path: impl AsRef<std::path::Path>) -> Option<T> {
    let path = path.as_ref();
    if !path.exists() {
        return None;
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

fn binary_exists_at_known_locations(name: &str, home: &std::path::Path) -> bool {
    let fallback_dirs = fallback_path_dirs(Some(home.to_path_buf()), None, None, false);
    for dir in &fallback_dirs {
        if binary_exists_in_dir(dir, name) {
            return true;
        }
    }

    let windows_fallback_dirs = fallback_path_dirs(Some(home.to_path_buf()), None, None, true);
    for dir in &windows_fallback_dirs {
        if binary_exists_in_dir(dir, name) {
            return true;
        }
    }

    false
}

fn binary_exists_in_dir(dir: &std::path::Path, name: &str) -> bool {
    let candidate = dir.join(name);
    if candidate.exists() {
        return true;
    }

    for suffix in [".cmd", ".exe", ".bat"] {
        if dir.join(format!("{name}{suffix}")).exists() {
            return true;
        }
    }

    false
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct ClaudeVersionHints {
    sonnet: Option<String>,
    opus: Option<String>,
    haiku: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ClaudeModelLabels {
    sonnet: String,
    sonnet_1m: String,
    opus: String,
    haiku: String,
}

fn scan_version_token(text: &str) -> Option<String> {
    let mut token = String::new();
    let mut started = false;

    for ch in text.chars() {
        if !started {
            if ch.is_ascii_digit() {
                started = true;
                token.push(ch);
            }
            continue;
        }

        if ch.is_ascii_digit() || ch == '.' || ch == '-' {
            token.push(ch);
        } else {
            break;
        }
    }

    if token.is_empty() {
        None
    } else {
        Some(token.replace('-', "."))
    }
}

fn latest_version_in_line(line: &str, family: &str) -> Option<String> {
    let lower_line = line.to_lowercase();
    let lower_family = family.to_lowercase();
    let mut search_start = 0;
    let mut last_match = None;

    while let Some(relative_index) = lower_line[search_start..].find(&lower_family) {
        let after_family_index = search_start + relative_index + lower_family.len();
        if let Some(version) = scan_version_token(&line[after_family_index..]) {
            last_match = Some(version);
        }
        search_start = after_family_index;
    }

    last_match
}

fn latest_version_in_text(text: &str, family: &str) -> Option<String> {
    for line in text.lines() {
        if let Some(version) = latest_version_in_line(line, family) {
            return Some(version);
        }
    }
    None
}

fn resolve_claude_version_hints_from_sources(
    help_text: Option<&str>,
    changelog_text: Option<&str>,
) -> ClaudeVersionHints {
    let mut hints = ClaudeVersionHints::default();

    for source in [help_text, changelog_text].into_iter().flatten() {
        if hints.sonnet.is_none() {
            hints.sonnet = latest_version_in_text(source, "sonnet");
        }
        if hints.opus.is_none() {
            hints.opus = latest_version_in_text(source, "opus");
        }
        if hints.haiku.is_none() {
            hints.haiku = latest_version_in_text(source, "haiku");
        }
    }

    hints
}

fn claude_model_labels_from_sources(
    help_text: Option<&str>,
    changelog_text: Option<&str>,
) -> ClaudeModelLabels {
    let hints = resolve_claude_version_hints_from_sources(help_text, changelog_text);

    let sonnet_version = hints.sonnet.as_deref();
    let opus_version = hints.opus.as_deref();
    let haiku_version = hints.haiku.as_deref();

    ClaudeModelLabels {
        sonnet: match sonnet_version {
            Some(version) => format!("Claude Sonnet {}", version),
            None => "Claude Sonnet".to_string(),
        },
        sonnet_1m: match sonnet_version {
            Some(version) => format!("Claude Sonnet {} 1M", version),
            None => "Claude Sonnet 1M".to_string(),
        },
        opus: match opus_version {
            Some(version) => format!("Claude Opus {}", version),
            None => "Claude Opus".to_string(),
        },
        haiku: match haiku_version {
            Some(version) => format!("Claude Haiku {}", version),
            None => "Claude Haiku".to_string(),
        },
    }
}

fn capture_claude_help_text() -> Option<String> {
    let output = Command::new("claude").arg("--help").output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout).ok()
}

fn read_claude_changelog(home: &std::path::Path) -> Option<String> {
    let path = home.join(".claude/cache/changelog.md");
    fs::read_to_string(path).ok()
}

fn resolve_claude_model_labels(home: &std::path::Path) -> ClaudeModelLabels {
    claude_model_labels_from_sources(
        capture_claude_help_text().as_deref(),
        read_claude_changelog(home).as_deref(),
    )
}

fn claude_model_catalog(
    subscription_label: &str,
    labels: &ClaudeModelLabels,
) -> Vec<DetectedModelOption> {
    vec![
        DetectedModelOption {
            model_id: "default".to_string(),
            display_name: "Claude Default".to_string(),
            source_provider: Some("anthropic".into()),
            family: None,
            subscription_label: subscription_label.to_string(),
            supports_pair_execution: true,
            runnable: true,
        },
        DetectedModelOption {
            model_id: "sonnet".to_string(),
            display_name: labels.sonnet.clone(),
            source_provider: Some("anthropic".into()),
            family: None,
            subscription_label: subscription_label.to_string(),
            supports_pair_execution: true,
            runnable: true,
        },
        DetectedModelOption {
            model_id: "opus".to_string(),
            display_name: labels.opus.clone(),
            source_provider: Some("anthropic".into()),
            family: None,
            subscription_label: subscription_label.to_string(),
            supports_pair_execution: true,
            runnable: true,
        },
        DetectedModelOption {
            model_id: "haiku".to_string(),
            display_name: labels.haiku.clone(),
            source_provider: Some("anthropic".into()),
            family: None,
            subscription_label: subscription_label.to_string(),
            supports_pair_execution: true,
            runnable: true,
        },
        DetectedModelOption {
            model_id: "sonnet[1m]".to_string(),
            display_name: labels.sonnet_1m.clone(),
            source_provider: Some("anthropic".into()),
            family: None,
            subscription_label: subscription_label.to_string(),
            supports_pair_execution: true,
            runnable: true,
        },
    ]
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

    pub fn detect_all_mock() -> Vec<DetectedProviderProfile> {
        vec![
            DetectedProviderProfile {
                kind: ProviderKind::Opencode,
                installed: true,
                authenticated: true,
                runnable: true,
                subscription_label: "mock".to_string(),
                current_models: vec![DetectedModelOption {
                    model_id: "opencode/glm-5-turbo".to_string(),
                    display_name: "GLM-5 Turbo (Mock)".to_string(),
                    source_provider: Some("opencode".to_string()),
                    family: None,
                    subscription_label: "mock".to_string(),
                    supports_pair_execution: true,
                    runnable: true,
                }],
                detected_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as u64,
            },
            DetectedProviderProfile {
                kind: ProviderKind::Claude,
                installed: true,
                authenticated: true,
                runnable: true,
                subscription_label: "mock".to_string(),
                current_models: vec![DetectedModelOption {
                    model_id: "claude-sonnet-4-20250514".to_string(),
                    display_name: "Claude Sonnet 4 (Mock)".to_string(),
                    source_provider: Some("claude".to_string()),
                    family: None,
                    subscription_label: "mock".to_string(),
                    supports_pair_execution: true,
                    runnable: true,
                }],
                detected_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as u64,
            },
        ]
    }

    pub fn detect_opencode() -> DetectedProviderProfile {
        let installed = which_binary("opencode");
        let mut models = Vec::new();
        let mut authenticated = false;

        // 1. Detect from ~/.config/opencode/opencode.json (user custom models)
        let config_path = opencode_config_path()
            .unwrap_or_else(|| homedir().join(".config/opencode/opencode.json"));
        if config_path.exists() {
            authenticated = true;
            if let Some(config) = safe_read_json::<OpenCodeConfig>(config_path) {
                if let Some(providers) = config.provider {
                    for (provider_id, provider_data) in providers {
                        if let Some(model_list) = provider_data.models {
                            for (model_id, model_config) in model_list {
                                let display_name =
                                    model_config.name.unwrap_or_else(|| model_id.clone());
                                models.push(DetectedModelOption {
                                    model_id: format!("{}/{}", provider_id, model_id),
                                    display_name,
                                    source_provider: Some(provider_id.clone()),
                                    family: None,
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
        let auth_path =
            opencode_auth_path().unwrap_or_else(|| homedir().join(".local/share/opencode/auth.json"));
        let mut internal_providers = Vec::new();
        if auth_path.exists() {
            authenticated = true;
            if let Some(auth_data) = safe_read_json::<serde_json::Value>(auth_path) {
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

                            // Check if this model belongs to an authenticated provider (either internal or custom).
                            // The "opencode" provider_id represents zen-backed models that are available
                            // whenever opencode is installed — they don't appear in auth.json.
                            let is_authenticated = provider_id == "opencode"
                                || internal_providers.contains(&provider_id.to_string())
                                || models
                                    .iter()
                                    .any(|m| m.source_provider.as_deref() == Some(provider_id));

                            if is_authenticated {
                                // Derive family from model name for OpenCode models
                                // e.g., "minimax-m2.5" -> "minimax", "claude-3-5-sonnet" -> "claude"
                                let family = if provider_id == "opencode" {
                                    model_name.split('-').next().map(|s| s.to_string())
                                } else {
                                    None
                                };

                                models.push(DetectedModelOption {
                                    model_id: line.to_string(),
                                    display_name: model_name,
                                    source_provider: Some(provider_id.to_string()),
                                    family,
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
                    family: None,
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

    pub fn detect_codex() -> DetectedProviderProfile {
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
                    family: None,
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

    pub fn detect_claude() -> DetectedProviderProfile {
        let installed = which_binary("claude");
        let homedir = homedir();
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

            let labels = resolve_claude_model_labels(&homedir);
            models = claude_model_catalog(&subscription_label, &labels);
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

    pub fn detect_gemini() -> DetectedProviderProfile {
        let installed = which_binary("gemini");
        let homedir = homedir();
        let settings_path = homedir.join(".gemini/settings.json");
        let mut authenticated = false;
        let mut models = Vec::new();
        let mut current_model = "gemini-1.5-pro".to_string();

        if settings_path.exists() {
            authenticated = true;
            if let Some(settings) = safe_read_json::<serde_json::Value>(settings_path) {
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
                    family: None,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::sync::Mutex;
    use uuid::Uuid;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[cfg(unix)]
    fn write_executable_script(dir: &Path, name: &str, contents: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let path = dir.join(name);
        fs::write(&path, contents).expect("failed to write test script");
        let mut perms = fs::metadata(&path)
            .expect("failed to read script metadata")
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&path, perms).expect("failed to mark test script executable");
        path
    }

    fn test_claude_model_labels() -> ClaudeModelLabels {
        ClaudeModelLabels {
            sonnet: "Claude Sonnet Aurora".to_string(),
            sonnet_1m: "Claude Sonnet Aurora 1M".to_string(),
            opus: "Claude Opus Aurora".to_string(),
            haiku: "Claude Haiku Aurora".to_string(),
        }
    }

    #[test]
    fn claude_model_catalog_uses_injected_labels() {
        let labels = test_claude_model_labels();
        let models = claude_model_catalog("subscription-backed", &labels);

        assert_eq!(models.len(), 5);
        assert_eq!(models[0].model_id, "default");
        assert_eq!(models[0].display_name, "Claude Default");
        assert_eq!(models[1].model_id, "sonnet");
        assert_eq!(models[1].display_name, labels.sonnet);
        assert_eq!(models[2].model_id, "opus");
        assert_eq!(models[2].display_name, labels.opus);
        assert_eq!(models[3].model_id, "haiku");
        assert_eq!(models[3].display_name, labels.haiku);
        assert_eq!(models[4].model_id, "sonnet[1m]");
        assert_eq!(models[4].display_name, labels.sonnet_1m);
    }

    #[cfg(unix)]
    #[test]
    fn detect_claude_lists_models_even_when_auth_status_is_logged_out() {
        let _guard = ENV_LOCK.lock().expect("env lock should be available");
        let temp_root = std::env::temp_dir().join(format!("the-pair-test-{}", Uuid::new_v4()));
        let bin_dir = temp_root.join("bin");
        fs::create_dir_all(&bin_dir).expect("failed to create temp bin dir");

        write_executable_script(
            &bin_dir,
            "claude",
            r#"#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  printf '%s\n' '{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}'
else
  printf '%s\n' '{"loggedIn":false}'
fi
"#,
        );

        let original_path = std::env::var_os("PATH");
        let original_api_key = std::env::var_os("ANTHROPIC_API_KEY");
        let new_path = if let Some(existing) = &original_path {
            format!("{}:{}", bin_dir.display(), existing.to_string_lossy())
        } else {
            bin_dir.display().to_string()
        };

        std::env::set_var("PATH", new_path);
        std::env::remove_var("ANTHROPIC_API_KEY");

        let profile = ProviderRegistry::detect_claude();

        if let Some(path) = original_path {
            std::env::set_var("PATH", path);
        } else {
            std::env::remove_var("PATH");
        }

        if let Some(value) = original_api_key {
            std::env::set_var("ANTHROPIC_API_KEY", value);
        }

        assert!(profile.installed);
        assert!(!profile.authenticated);
        assert!(
            profile
                .current_models
                .iter()
                .any(|model| model.model_id == "sonnet"),
            "logged-out Claude Code should still expose the native model catalog"
        );
    }

    #[cfg(unix)]
    #[test]
    fn binary_exists_at_known_locations_finds_gemini_in_nvm_layout() {
        let temp_root = std::env::temp_dir().join(format!("the-pair-test-{}", Uuid::new_v4()));
        let gemini_dir = temp_root.join(".nvm/versions/node/v24.14.0/bin");
        fs::create_dir_all(&gemini_dir).expect("failed to create temp gemini dir");

        write_executable_script(
            &gemini_dir,
            "gemini",
            r#"#!/bin/sh
exit 0
"#,
        );

        assert!(
            binary_exists_at_known_locations("gemini", &temp_root),
            "gemini should be discoverable in a common NVM layout even when PATH is empty"
        );
    }

    #[test]
    fn binary_exists_at_known_locations_finds_windows_global_npm_bins() {
        let temp_root = std::env::temp_dir().join(format!("the-pair-test-{}", Uuid::new_v4()));
        let roaming_npm_dir = temp_root.join("AppData/Roaming/npm");
        fs::create_dir_all(&roaming_npm_dir).expect("failed to create roaming npm dir");
        fs::write(roaming_npm_dir.join("claude.cmd"), "@echo off\r\n").expect("failed to seed cmd");

        assert!(
            binary_exists_at_known_locations("claude", &temp_root),
            "claude should be discoverable in the standard Windows global npm directory"
        );
    }

    #[cfg(unix)]
    #[test]
    fn detect_gemini_finds_models_from_nvm_style_installation() {
        let _guard = ENV_LOCK.lock().expect("env lock should be available");
        let temp_home = std::env::temp_dir().join(format!("the-pair-test-{}", Uuid::new_v4()));
        let gemini_dir = temp_home.join(".nvm/versions/node/v24.14.0/bin");
        let settings_dir = temp_home.join(".gemini");
        fs::create_dir_all(&gemini_dir).expect("failed to create temp gemini dir");
        fs::create_dir_all(&settings_dir).expect("failed to create temp settings dir");

        write_executable_script(
            &gemini_dir,
            "gemini",
            r#"#!/bin/sh
exit 0
"#,
        );

        fs::write(
            settings_dir.join("settings.json"),
            r#"{"model":{"name":"gemini-2.5-pro"}}"#,
        )
        .expect("failed to write settings file");

        let original_home = std::env::var_os("HOME");
        let original_path = std::env::var_os("PATH");

        std::env::set_var("HOME", &temp_home);
        std::env::set_var("PATH", "/usr/bin:/bin");

        let profile = ProviderRegistry::detect_gemini();

        if let Some(value) = original_home {
            std::env::set_var("HOME", value);
        }

        if let Some(value) = original_path {
            std::env::set_var("PATH", value);
        }

        assert!(profile.installed);
        assert!(profile.authenticated);
        assert!(
            !profile.current_models.is_empty(),
            "Gemini CLI should surface native models when installed in an NVM layout"
        );
    }
}
