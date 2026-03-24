use std::fs;
use std::path::PathBuf;
use crate::provider_registry::{ProviderRegistry, DetectedProviderProfile, OpenCodeConfig};
use crate::model_catalog::{ModelCatalog, AvailableModel};

fn get_config_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE").ok()?;
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var("HOME").ok()?;
    
    Some(PathBuf::from(home).join(".config/opencode/opencode.json"))
}

#[tauri::command]
pub fn config_read() -> Result<Option<OpenCodeConfig>, String> {
    let path = get_config_path().ok_or("Could not determine home directory")?;
    println!("[Tauri] Reading config from: {:?}", path);
    if !path.exists() {
        println!("[Tauri] Config file does not exist at {:?}", path);
        return Ok(None);
    }
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: OpenCodeConfig = serde_json::from_str(&content).map_err(|e| {
        println!("[Tauri] Config parse error: {}", e);
        e.to_string()
    })?;
    println!("[Tauri] Config loaded successfully");
    Ok(Some(config))
}

#[tauri::command]
pub fn config_get_models() -> Result<Vec<AvailableModel>, String> {
    let profiles = ProviderRegistry::detect_all();
    let catalog = ModelCatalog::build_catalog(profiles);
    println!("[Tauri] config_get_models found {} models", catalog.len());
    Ok(catalog)
}

#[tauri::command]
pub fn config_get_providers() -> Result<Vec<DetectedProviderProfile>, String> { 
    Ok(ProviderRegistry::detect_all())
}

#[tauri::command]
pub fn pair_update_models() -> Result<(), String> { Ok(()) }

#[tauri::command]
pub fn pair_retry_turn() -> Result<(), String> { Ok(()) }

#[tauri::command]
pub fn pair_get_messages() -> Result<Vec<()>, String> { Ok(vec![]) }

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
pub fn pair_human_feedback() -> Result<(), String> { Ok(()) }

#[tauri::command]
pub fn config_open_file() -> Result<(), String> {
    let path = get_config_path().ok_or("Could not determine home directory")?;
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

#[tauri::command]
pub fn file_list_files() -> Result<Vec<()>, String> { Ok(vec![]) }

#[tauri::command]
pub fn file_parse_mentions() -> Result<String, String> { Ok("".into()) }
