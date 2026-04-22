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
    // `windows-sys` crate's SetStdHandle to redirect stdout/stderr to the file
    // handle. Kept separate to avoid pulling in windows-sys on non-Windows targets.
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
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::Console::{SetStdHandle, STD_ERROR_HANDLE, STD_OUTPUT_HANDLE};
        let raw = file.as_raw_handle() as windows_sys::Win32::Foundation::HANDLE;
        unsafe {
            SetStdHandle(STD_OUTPUT_HANDLE, raw);
            SetStdHandle(STD_ERROR_HANDLE, raw);
        }
        // Leak the handle so it stays open for the app's lifetime.
        // Dropping `file` would close the underlying HANDLE while Windows is
        // still writing through it, corrupting the log.
        std::mem::forget(file);
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
            // Lobby owner SteamID — used by guest side to resolve the host's P2P endpoint
            steam::steam_get_lobby_owner,
            // JS → file-logger bridge (pipes js-side diagnostics into debug.log)
            steam::rr_log,
            // File system save (filesave.rs)
            filesave::fs_get_save_dir,
            filesave::fs_write_save,
            filesave::fs_read_save,
            filesave::fs_delete_save,
            // P2P session priming + diagnostics (2026-04-22 ConnectFailed fix)
            steam::steam_prime_p2p_sessions,
            steam::steam_get_p2p_connection_state,
            // BUG5: Session failure error slot — readable by _sendWithRetry for diagnostics
            steam::steam_get_session_error,
            // BUG17: Peer ungraceful-leave slot — TS polls to synthesise local mp:lobby:leave
            steam::steam_get_pending_peer_left,
            // H9 reconnect path — explicit lobby-membership check by SteamID (cheaper than getLobbyMembers).
            steam::steam_check_lobby_membership,
            // PASS1-BUG-21: Surface debug.log path so the dev panel can show it in-game.
            steam::steam_get_debug_log_path,
            // M-020: Surface session_request_callback.accept failures via a polled error slot.
            steam::steam_get_pending_session_request_error,
            // ULTRATHINK 056 (H10-transport): P2PSessionConnectFail bridge — JS polls for fail events.
            steam::steam_get_pending_p2p_fail,
            // LAN Server (AR-MULTIPLAYER LAN)
            lan::lan_start_server,
            lan::lan_stop_server,
            lan::lan_get_local_ips,
            lan::lan_server_status,
            lan::lan_tcp_probe,
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
