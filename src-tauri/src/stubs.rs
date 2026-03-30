use crate::config_paths::opencode_config_path;
use crate::model_catalog::{AvailableModel, ModelCatalog};
use crate::provider_registry::{DetectedProviderProfile, ProviderRegistry};
use std::fs;

#[tauri::command]
pub fn config_read() -> Result<Option<serde_json::Value>, String> {
    let path = opencode_config_path().ok_or("Could not determine home directory")?;
    println!("[Tauri] Reading config from: {:?}", path);
    if !path.exists() {
        println!("[Tauri] Config file does not exist at {:?}", path);
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
        println!("[Tauri] Config parse error: {}", e);
        e.to_string()
    })?;
    println!("[Tauri] Config loaded successfully");
    Ok(Some(config))
}

#[tauri::command]
pub fn config_get_models() -> Result<Vec<AvailableModel>, String> {
    let profiles = if std::env::var("THE_PAIR_E2E_MOCK")
        .map(|v| v == "true")
        .unwrap_or(false)
    {
        ProviderRegistry::detect_all_mock()
    } else {
        ProviderRegistry::detect_all()
    };
    let catalog = ModelCatalog::build_catalog(profiles);
    println!("[Tauri] config_get_models found {} models", catalog.len());
    Ok(catalog)
}

#[tauri::command]
pub fn config_get_providers() -> Result<Vec<DetectedProviderProfile>, String> {
    if std::env::var("THE_PAIR_E2E_MOCK")
        .map(|v| v == "true")
        .unwrap_or(false)
    {
        return Ok(ProviderRegistry::detect_all_mock());
    }
    Ok(ProviderRegistry::detect_all())
}

#[tauri::command]
pub fn pair_retry_turn() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn pair_get_messages() -> Result<Vec<()>, String> {
    Ok(vec![])
}

use crate::message_broker::MessageBroker;
use crate::types::PairState;

#[tauri::command]
pub fn pair_get_state(
    broker: tauri::State<std::sync::Mutex<MessageBroker>>,
    pair_id: String,
) -> Result<Option<PairState>, String> {
    let broker = broker.lock().unwrap();
    Ok(broker.get_state(&pair_id))
}

#[tauri::command]
pub fn config_open_file() -> Result<(), String> {
    let path = opencode_config_path().ok_or("Could not determine home directory")?;
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
