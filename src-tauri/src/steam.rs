use std::sync::Mutex;
use steamworks::Client;
use tauri::State;

/// Holds the initialized Steamworks client, or None if Steam is not running / SDK unavailable.
///
/// The `Mutex` allows sharing across Tauri command threads. Failure to initialize is non-fatal —
/// all commands silently no-op when `client` is `None`.
///
/// TODO (AR-80): Replace App ID 480 (Valve Spacewar test) with the real Recall Rogue App ID
///               once the game is registered on Steam Partner.
pub struct SteamState {
    pub client: Mutex<Option<Client>>,
}

impl SteamState {
    /// Try to initialize the Steamworks SDK on app startup.
    /// Failure is non-fatal — all commands silently no-op when Steam is unavailable.
    ///
    /// Note: `Client::run_callbacks()` should be called periodically (e.g. via a background thread)
    /// to process async Steam events. This is required for Leaderboard and Cloud Save callbacks.
    /// TODO (AR-80 follow-up): Spawn a background thread that calls `client.run_callbacks()` on a
    ///       ~16ms timer so async Steam events (leaderboard fetch, cloud sync) are processed.
    pub fn new() -> Self {
        // App ID 480 = Valve's Spacewar (public test app). Replace with real ID before ship.
        match Client::init_app(480) {
            Ok(client) => {
                println!("[Steam] Initialized successfully (App ID 480 — Spacewar test)");
                SteamState {
                    client: Mutex::new(Some(client)),
                }
            }
            Err(e) => {
                eprintln!("[Steam] Failed to initialize (Steam client may not be running): {:?}", e);
                SteamState {
                    client: Mutex::new(None),
                }
            }
        }
    }
}

// ── Achievements ──────────────────────────────────────────────────────────────

/// Unlock a Steam achievement by its Steamworks API name (e.g., "ACH_FIRST_WIN").
/// Returns `true` if the achievement was set and stats stored, `false` if Steam is unavailable.
/// Safe to call redundantly — Steam silently ignores re-unlocking an already-unlocked achievement.
#[tauri::command]
pub fn steam_unlock_achievement(state: State<SteamState>, id: String) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let user_stats = client.user_stats();
        user_stats
            .achievement(&id)
            .set()
            .map_err(|e| format!("Failed to set achievement '{}': {:?}", id, e))?;
        user_stats
            .store_stats()
            .map_err(|e| format!("Failed to store stats after achievement '{}': {:?}", id, e))?;
        println!("[Steam] Achievement unlocked: {}", id);
        Ok(true)
    } else {
        // Steam unavailable — silent no-op so callers don't need to guard
        Ok(false)
    }
}

// ── Rich Presence ─────────────────────────────────────────────────────────────

/// Set a Steam Rich Presence key/value pair.
/// Steam shows these in the friends list (e.g., key="status", value="Floor 3 — Fighting Golem").
/// No-op when Steam is unavailable.
#[tauri::command]
pub fn steam_set_rich_presence(
    state: State<SteamState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        client.friends().set_rich_presence(&key, Some(&value));
        println!("[Steam] Rich Presence: {} = {}", key, value);
    }
    Ok(())
}

/// Clear all Steam Rich Presence keys.
/// Call this on app exit or when the player is on the main menu.
#[tauri::command]
pub fn steam_clear_rich_presence(state: State<SteamState>) -> Result<(), String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        client.friends().clear_rich_presence();
        println!("[Steam] Rich Presence cleared");
    }
    Ok(())
}

// ── Cloud Save ────────────────────────────────────────────────────────────────
// TODO (AR-80 follow-up): Implement Steam Cloud Save via steamworks::RemoteStorage.
//   - steam_cloud_save(data: String) -> Result<(), String>
//     Write serialized save JSON to a well-known filename (e.g., "save.json") in
//     the user's Steam Cloud storage for this app.
//   - steam_cloud_load() -> Result<Option<String>, String>
//     Read the cloud save back. Return None if no cloud save exists yet.
//   Requires: background thread calling client.run_callbacks() for async completion events.

// ── Leaderboards ──────────────────────────────────────────────────────────────
// TODO (AR-80 follow-up): Implement Steam Leaderboards via steamworks Leaderboard API.
//   - steam_submit_score(board: String, score: i32) -> Result<(), String>
//     Find or create the named leaderboard, then upload the score (keep-best).
//   - steam_get_leaderboard_entries(board: String) -> Result<Vec<LeaderboardEntry>, String>
//     Fetch the top-N global entries for display in the in-game leaderboard screen.
//   Both require the callbacks pump (client.run_callbacks) running on a background timer thread.
