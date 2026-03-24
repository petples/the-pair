use crate::provider_registry::{DetectedProviderProfile, ProviderKind};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableModel {
    pub provider: ProviderKind,
    pub model_id: String,
    pub display_name: String,
    pub available: bool,
    pub provider_label: String,
    pub source_provider: Option<String>,
    pub source_provider_label: String,
    pub billing_kind: String,
    pub billing_label: String,
    pub access_label: String,
    pub plan_label: Option<String>,
    pub availability_status: String,
    pub availability_reason: Option<String>,
    pub supports_pair_execution: bool,
    pub recommended_roles: Vec<String>,
}

pub struct ModelCatalog;

impl ModelCatalog {
    pub fn build_catalog(profiles: Vec<DetectedProviderProfile>) -> Vec<AvailableModel> {
        let mut catalog = Vec::new();

        for profile in profiles {
            let provider_label = match profile.kind {
                ProviderKind::Opencode => "OpenCode",
                ProviderKind::Codex => "Codex",
                ProviderKind::Claude => "Claude Code",
                ProviderKind::Gemini => "Gemini CLI",
            };

            for model in profile.current_models {
                let source_provider_label = match model.source_provider.as_deref() {
                    Some("openai") => "OpenAI",
                    Some("anthropic") => "Anthropic",
                    Some("google") => "Google",
                    _ => "Configured Provider",
                };

                let (status, reason, available) = if !profile.installed {
                    ("cli-missing".to_string(), Some(format!("{} CLI is not installed", provider_label)), false)
                } else if !profile.authenticated {
                    ("auth-missing".to_string(), Some(format!("{} is not signed in", provider_label)), false)
                } else if !profile.runnable || !model.runnable || !model.supports_pair_execution {
                    ("runtime-unsupported".to_string(), Some(format!("{} is detected, but pair execution is not yet supported", provider_label)), false)
                } else {
                    ("ready".to_string(), None, true)
                };

                let billing_kind = match profile.kind {
                    ProviderKind::Opencode => "byok",
                    _ => "plan",
                };

                let billing_label = match profile.kind {
                    ProviderKind::Opencode => "Pay as you go",
                    _ => "Included with plan",
                };

                let access_label = match profile.kind {
                    ProviderKind::Opencode => format!("{} API key", source_provider_label),
                    ProviderKind::Codex => "ChatGPT plan".into(),
                    ProviderKind::Claude => "Claude Code login".into(),
                    ProviderKind::Gemini => "Google account".into(),
                };

                catalog.push(AvailableModel {
                    provider: profile.kind,
                    model_id: model.model_id.clone(),
                    display_name: model.display_name,
                    available,
                    provider_label: provider_label.to_string(),
                    source_provider: model.source_provider,
                    source_provider_label: source_provider_label.to_string(),
                    billing_kind: billing_kind.to_string(),
                    billing_label: billing_label.to_string(),
                    access_label,
                    plan_label: Some(profile.subscription_label.clone()),
                    availability_status: status,
                    availability_reason: reason,
                    supports_pair_execution: model.supports_pair_execution,
                    recommended_roles: vec!["mentor".into(), "executor".into()], // Simplified
                });
            }
        }

        catalog.sort_by(|a, b| {
            if a.available != b.available {
                return b.available.cmp(&a.available);
            }
            a.provider_label.cmp(&b.provider_label)
        });

        catalog
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider_registry::{DetectedModelOption, DetectedProviderProfile, ProviderKind};

    fn model(
        model_id: &str,
        display_name: &str,
        source_provider: Option<&str>,
        subscription_label: &str,
        supports_pair_execution: bool,
        runnable: bool,
    ) -> DetectedModelOption {
        DetectedModelOption {
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            source_provider: source_provider.map(|value| value.to_string()),
            subscription_label: subscription_label.to_string(),
            supports_pair_execution,
            runnable,
        }
    }

    fn profile(
        kind: ProviderKind,
        installed: bool,
        authenticated: bool,
        runnable: bool,
        subscription_label: &str,
        current_models: Vec<DetectedModelOption>,
    ) -> DetectedProviderProfile {
        DetectedProviderProfile {
            kind,
            installed,
            authenticated,
            runnable,
            subscription_label: subscription_label.to_string(),
            current_models,
            detected_at: 0,
        }
    }

    #[test]
    fn build_catalog_marks_supported_opencode_models_ready() {
        let catalog = ModelCatalog::build_catalog(vec![profile(
            ProviderKind::Opencode,
            true,
            true,
            true,
            "provider-backed",
            vec![model(
                "openai/gpt-4o-mini",
                "GPT-4o Mini",
                Some("openai"),
                "provider-backed",
                true,
                true,
            )],
        )]);

        assert_eq!(catalog.len(), 1);
        let model = &catalog[0];
        assert!(model.available);
        assert_eq!(model.provider_label, "OpenCode");
        assert_eq!(model.billing_kind, "byok");
        assert_eq!(model.billing_label, "Pay as you go");
        assert_eq!(model.access_label, "OpenAI API key");
        assert_eq!(model.availability_status, "ready");
        assert_eq!(model.recommended_roles, vec!["mentor", "executor"]);
    }

    #[test]
    fn build_catalog_keeps_unavailable_models_visible_and_sorted_after_ready_models() {
        let catalog = ModelCatalog::build_catalog(vec![
            profile(
                ProviderKind::Opencode,
                false,
                true,
                true,
                "provider-backed",
                vec![model(
                    "openai/gpt-4o-mini",
                    "GPT-4o Mini",
                    Some("openai"),
                    "provider-backed",
                    true,
                    true,
                )],
            ),
            profile(
                ProviderKind::Claude,
                true,
                true,
                true,
                "pro",
                vec![model(
                    "claude-3-5-sonnet",
                    "Claude 3.5 Sonnet",
                    Some("anthropic"),
                    "pro",
                    true,
                    true,
                )],
            ),
        ]);

        assert_eq!(catalog.len(), 2);
        assert!(catalog[0].available, "ready models should sort first");
        assert_eq!(catalog[0].provider_label, "Claude Code");
        assert!(!catalog[1].available);
        assert_eq!(catalog[1].availability_status, "cli-missing");
        assert!(catalog[1]
            .availability_reason
            .as_deref()
            .unwrap_or_default()
            .contains("OpenCode CLI is not installed"));
    }
}
