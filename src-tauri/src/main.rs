// Hides the console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod filesave;
mod lan;
mod steam;

use steam::SteamState;
use tauri::Manager;

/// Redirect stdout + stderr to a file so the Rust `println!` / `eprintln!`
/// diagnostics from Steam callbacks and the LAN server land somewhere the
/// player can read. Steam-launched apps on macOS drop stdout into /dev/null,
/// and Windows subsystem="windows" does the same on Windows release builds.
///
/// Target:
///   macOS   → ~/Library/Logs/Recall Rogue/debug.log
///   Windows → %LocalAppData%/Recall Rogue/debug.log (via dirs::cache_dir fallback)
///   Linux   → ~/.cache/recall-rogue/debug.log
///
/// Silent-no-op if the file can't be opened — we never want the logger to
/// prevent the app from starting. The old stdout/stderr still works for
/// direct-terminal launches during development because we only dup2 the file
/// fd if the redirect succeeds.
fn redirect_stdio_to_log_file() {
    use std::fs::OpenOptions;
    #[cfg(target_os = "macos")]
    let log_dir = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .map(|h| h.join("Library/Logs/Recall Rogue"));
    #[cfg(target_os = "windows")]
    let log_dir = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .map(|h| h.join("Recall Rogue"));
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let log_dir = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .map(|h| h.join(".cache/recall-rogue"));
    let Some(dir) = log_dir else { return };
    if std::fs::create_dir_all(&dir).is_err() { return; }
    let log_path = dir.join("debug.log");
    let Ok(file) = OpenOptions::new().create(true).append(true).open(&log_path) else {
        return;
    };
    // On Unix, dup2 replaces fd 1 and 2 with our file. On Windows, use the
    // `windows` std fd equivalents via AsRawHandle. Kept separate to avoid
    // pulling in windows-sys; Rust's std has the needed trait.
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        let fd = file.as_raw_fd();
        // Leak the File so the OS keeps it open for the process lifetime.
        // Dropping would close the fd and break the redirect.
        std::mem::forget(file);
        unsafe {
            libc::dup2(fd, 1);
            libc::dup2(fd, 2);
        }
    }
    #[cfg(windows)]
    {
        // Windows: SetStdHandle via winapi crate would be cleaner, but for
        // simplicity we just rely on Tauri's builder to not need stdio.
        // The release build already hides the console, and stdio-less output
        // is the default. If needed, we can add a windows-sys crate later.
        let _ = file;
    }
    println!("[stdio] redirected to {}", log_path.display());
}

fn main() {
    redirect_stdio_to_log_file();
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
            steam::steam_get_pending_lobby_id,
            steam::steam_join_lobby,
            steam::steam_get_pending_join_lobby_id,
            // A3: error slot for join failures — surfaced to TS via pollJoinResult
            steam::steam_get_pending_join_error,
            steam::steam_leave_lobby,
            steam::steam_get_lobby_members,
            steam::steam_set_lobby_data,
            steam::steam_get_lobby_data,
            // Matchmaking — Lobby Browser (AR-MULTIPLAYER Phase 1)
            steam::steam_request_lobby_list,
            steam::steam_get_lobby_list_result,
            steam::steam_get_lobby_member_count,
            // Lobby metadata warm-up — call before GetLobbyData on cold lobbies
            steam::steam_request_lobby_data,
            // P2P Networking — ISteamNetworkingMessages (AR-MULTIPLAYER 1.1)
            steam::steam_send_p2p_message,
            steam::steam_read_p2p_messages,
            steam::steam_accept_p2p_session,
            // Callback pump (required for async lobby ops)
            steam::steam_run_callbacks,
            // C2: Local user persona name (real Steam display name for lobby)
            steam::steam_get_persona_name,
            // Steam lobby exit cleanup (C5 — best-effort leave on JS-side graceful shutdown)
            steam::steam_force_leave_active_lobby,
            // D1: Overlay diagnostic — returns overlay_enabled / launched_via_steam / steam_initialized
            steam::steam_overlay_status,
            // Local Steam ID — used by MP to filter self from lobby members when finding peer for P2P
            steam::steam_get_local_steam_id,
            // File system save (filesave.rs)
            filesave::fs_get_save_dir,
            filesave::fs_write_save,
            filesave::fs_read_save,
            filesave::fs_delete_save,
            // LAN Server (AR-MULTIPLAYER LAN)
            lan::lan_start_server,
            lan::lan_stop_server,
            lan::lan_get_local_ips,
            lan::lan_server_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Recall Rogue")
        // C5: Exit hook — leave the active Steam lobby on app close.
        //
        // RunEvent::Exit fires once before the process terminates. The leave_lobby
        // call is synchronous (microseconds) so the 500ms budget is easily met.
        // Safe when Steam is unavailable — the client Mutex holds None and we skip.
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<SteamState>();

                // Read and clear the active lobby ID atomically.
                let active_id: Option<u64> = match state.active_lobby_id.lock() {
                    Ok(mut slot) => slot.take(),
                    Err(_) => None, // Poisoned lock — skip cleanup safely.
                };

                if let Some(raw_id) = active_id {
                    match state.client.lock() {
                        Ok(guard) => {
                            if let Some(client) = guard.as_ref() {
                                let lobby_id = steamworks::LobbyId::from_raw(raw_id);
                                client.matchmaking().leave_lobby(lobby_id);
                                eprintln!("[Steam] Exit hook: left lobby {}", raw_id);
                            }
                        }
                        Err(_) => {
                            eprintln!("[Steam] Exit hook: client lock poisoned — skipping lobby leave");
                        }
                    }
                }
            }
        });
}
