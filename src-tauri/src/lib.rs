mod file_cache;
mod git_tracker;
mod message_broker;
mod model_catalog;
mod pair_manager;
mod path_env;
mod process_spawner;
mod provider_adapter;
mod provider_registry;
mod resource_monitor;
mod session_snapshot;
mod stubs;
mod types;

use message_broker::MessageBroker;
use pair_manager::PairManager;
use process_spawner::ProcessSpawner;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            path_env::refresh_path_from_login_shell();

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
            message_broker::pair_human_feedback,
            stubs::config_get_models,
            stubs::config_get_providers,
            stubs::config_read,
            stubs::config_open_file,
            file_cache::file_list_files,
            file_cache::file_parse_mentions,
            session_snapshot::session_save_snapshot,
            session_snapshot::list_recoverable_sessions,
            session_snapshot::delete_recoverable_session,
            session_snapshot::restore_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
