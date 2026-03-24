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
