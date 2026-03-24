mod types;
mod pair_manager;
mod process_spawner;
mod message_broker;
mod git_tracker;
mod resource_monitor;
mod stubs;
mod provider_registry;
mod model_catalog;

use pair_manager::PairManager;
use message_broker::MessageBroker;
use process_spawner::ProcessSpawner;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      let broker = app.state::<Mutex<MessageBroker>>();
      let mut broker = broker.lock().unwrap();
      broker.set_app_handle(app.handle().clone());
      Ok(())
    })
    .manage(Mutex::new(PairManager::new()))
    .manage(Mutex::new(MessageBroker::new()))
    .manage(ProcessSpawner::new())
    .invoke_handler(tauri::generate_handler![
      pair_manager::pair_create,
      pair_manager::pair_list,
      pair_manager::pair_delete,
      pair_manager::pair_assign_task,
      stubs::pair_update_models,
      stubs::pair_retry_turn,
      stubs::pair_get_messages,
      stubs::pair_get_state,
      stubs::pair_human_feedback,
      stubs::config_get_models,
      stubs::config_get_providers,
      stubs::config_read,
      stubs::config_open_file,
      stubs::file_list_files,
      stubs::file_parse_mentions
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
