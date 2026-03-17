// Hides the console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod steam;

use steam::SteamState;

fn main() {
    // Initialize Steamworks SDK (non-fatal — fails gracefully if Steam isn't running).
    let steam_state = SteamState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(steam_state)
        .invoke_handler(tauri::generate_handler![
            steam::steam_unlock_achievement,
            steam::steam_set_rich_presence,
            steam::steam_clear_rich_presence,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Recall Rogue");
}
