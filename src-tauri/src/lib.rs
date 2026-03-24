mod types;
mod pair_manager;
mod process_spawner;
mod message_broker;
mod git_tracker;
mod resource_monitor;

use pair_manager::PairManager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .manage(Mutex::new(PairManager::new()))
    .invoke_handler(tauri::generate_handler![
      pair_manager::pair_create,
      pair_manager::pair_list,
      pair_manager::pair_delete,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
