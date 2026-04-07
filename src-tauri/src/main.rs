// Hides the console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod filesave;
mod steam;

use steam::SteamState;

fn main() {
    // Initialize Steamworks SDK (non-fatal — fails gracefully if Steam isn't running).
    let steam_state = SteamState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(steam_state)
        .invoke_handler(tauri::generate_handler![
            // Achievements
            steam::steam_unlock_achievement,
            // Rich Presence
            steam::steam_set_rich_presence,
            steam::steam_clear_rich_presence,
            // Matchmaking — Lobbies (AR-MULTIPLAYER 1.1)
            steam::steam_create_lobby,
            steam::steam_join_lobby,
            steam::steam_leave_lobby,
            steam::steam_get_lobby_members,
            steam::steam_set_lobby_data,
            steam::steam_get_lobby_data,
            // P2P Networking — ISteamNetworkingMessages (AR-MULTIPLAYER 1.1)
            steam::steam_send_p2p_message,
            steam::steam_read_p2p_messages,
            steam::steam_accept_p2p_session,
            // Callback pump (required for async lobby ops)
            steam::steam_run_callbacks,
            // File system save (filesave.rs)
            filesave::fs_get_save_dir,
            filesave::fs_write_save,
            filesave::fs_read_save,
            filesave::fs_delete_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Recall Rogue");
}
