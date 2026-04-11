use std::sync::Mutex;
use steamworks::networking_types::{NetworkingIdentity, SendFlags};
use steamworks::{Client, LobbyId, LobbyType, SteamId};
use tauri::State;

/// Holds the initialized Steamworks client, or None if Steam is not running / SDK unavailable.
///
/// The `Mutex` allows sharing across Tauri command threads. Failure to initialize is non-fatal —
/// all commands silently no-op when `client` is `None`.
///
/// DONE (AR-80): App ID updated to 4547570 (Recall Rogue). Registered on Steam Partner.
pub struct SteamState {
    pub client: Mutex<Option<Client>>,
}

impl SteamState {
    /// Try to initialize the Steamworks SDK on app startup.
    /// Failure is non-fatal — all commands silently no-op when Steam is unavailable.
    ///
    /// Note: `Client::run_callbacks()` should be called periodically (e.g. via a background thread)
    /// to process async Steam events. This is required for Leaderboard, Cloud Save, and lobby
    /// creation/join callbacks. The `steam_run_callbacks` Tauri command can be polled from JS
    /// (e.g., every 100ms) to drive callback completion while awaiting async results.
    ///
    /// TODO (AR-80 follow-up): Spawn a background thread that calls `client.run_callbacks()` on a
    ///       ~16ms timer so async Steam events (leaderboard fetch, cloud sync) are processed.
    pub fn new() -> Self {
        // App ID 4547570 = Recall Rogue (production app ID).
        match Client::init_app(4547570) {
            Ok(client) => {
                println!("[Steam] Initialized successfully (App ID 4547570 — Recall Rogue)");
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

// ── Shared serializable types ──────────────────────────────────────────────────

/// A member of a Steam lobby, as returned by `steam_get_lobby_members`.
#[derive(serde::Serialize)]
pub struct SteamLobbyMember {
    /// The 64-bit Steam ID as a decimal string (to avoid JS integer precision loss).
    pub steam_id: String,
    /// The display name (persona name) of the member, as Steam knows it.
    pub display_name: String,
}

/// A P2P message received via the Steam Networking Messages interface.
#[derive(serde::Serialize)]
pub struct SteamP2PMessage {
    /// Steam ID of the sender (64-bit decimal string).
    pub sender_id: String,
    /// The raw message payload decoded as a UTF-8 string (game messages are JSON).
    pub data: String,
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

// ── Matchmaking — Lobbies ──────────────────────────────────────────────────────

/// Create a Steam lobby and return its ID as a decimal string.
///
/// Lobby creation is asynchronous in the Steamworks API — the actual lobby ID is only available
/// after the `LobbyCreated_t` callback fires. This command initiates the creation and immediately
/// returns an empty string; the caller MUST poll `steam_run_callbacks` and then use
/// `steam_get_lobby_data` (or a separate callback mechanism) to detect when creation completes.
///
/// # Parameters
/// - `lobby_type`: One of "public", "private", "friends_only", "invisible"
/// - `max_members`: Maximum number of members (1–250)
///
/// # Returns
/// `""` (creation is async — poll steam_run_callbacks; the LobbyCreated callback will fire)
///
/// TODO (AR-MULTIPLAYER 1.1): Wire a persistent callback via `client.register_callback` in
///   `SteamState::new()` that writes the created LobbyId into a shared Arc<Mutex<Option<LobbyId>>>
///   so that a follow-up `steam_get_pending_lobby_id` command can return it to JS.
#[tauri::command]
pub fn steam_create_lobby(
    state: State<SteamState>,
    lobby_type: String,
    max_members: u32,
) -> Result<String, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let ty = parse_lobby_type(&lobby_type)?;
        // create_lobby is callback-based; we kick it off and return immediately.
        // The JS side must call steam_run_callbacks() repeatedly until LobbyCreated fires.
        client.matchmaking().create_lobby(ty, max_members, |result| {
            match result {
                Ok(lobby_id) => println!("[Steam] Lobby created: {}", lobby_id.raw()),
                Err(e) => eprintln!("[Steam] Lobby creation failed: {:?}", e),
            }
        });
        println!("[Steam] Lobby creation initiated (type={}, max={})", lobby_type, max_members);
        // Return empty — caller polls steam_run_callbacks and then inspects state via other commands.
        Ok(String::new())
    } else {
        Ok(String::new())
    }
}

/// Join an existing Steam lobby by its ID (decimal string).
///
/// Like `steam_create_lobby`, this is asynchronous — the join result arrives via the
/// `LobbyEnter_t` callback after `steam_run_callbacks` is polled.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
#[tauri::command]
pub fn steam_join_lobby(state: State<SteamState>, lobby_id: String) -> Result<(), String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let lobby_id_clone = lobby_id.clone();
        client.matchmaking().join_lobby(id, move |result| match result {
            Ok(joined_id) => println!("[Steam] Joined lobby: {}", joined_id.raw()),
            Err(_) => eprintln!("[Steam] Failed to join lobby {}", lobby_id_clone),
        });
        println!("[Steam] Join lobby initiated: {}", lobby_id);
    }
    Ok(())
}

/// Leave a Steam lobby.
///
/// This is synchronous — the leave takes effect immediately.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
#[tauri::command]
pub fn steam_leave_lobby(state: State<SteamState>, lobby_id: String) -> Result<(), String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        client.matchmaking().leave_lobby(id);
        println!("[Steam] Left lobby: {}", lobby_id);
    }
    Ok(())
}

/// Get all current members of a Steam lobby.
///
/// Returns each member's Steam ID (decimal string) and display name. The display name is resolved
/// via `ISteamFriends::GetFriendPersonaName` — this works for players in the same lobby because
/// Steam automatically loads their data. If the name is unavailable (rare), it falls back to the
/// Steam ID string.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
#[tauri::command]
pub fn steam_get_lobby_members(
    state: State<SteamState>,
    lobby_id: String,
) -> Result<Vec<SteamLobbyMember>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let members = client.matchmaking().lobby_members(id);
        let friends = client.friends();
        let result = members
            .into_iter()
            .map(|steam_id| {
                let id_str = steam_id.raw().to_string();
                // get_friend returns a Friend accessor with a name() method
                let display_name = friends.get_friend(steam_id).name();
                SteamLobbyMember {
                    steam_id: id_str,
                    display_name,
                }
            })
            .collect();
        Ok(result)
    } else {
        Ok(vec![])
    }
}

/// Set a key/value metadata string on the lobby.
///
/// Only the lobby owner can set lobby data. Steam limits keys to 255 characters and values to
/// 8192 characters. Returns `true` on success.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
/// - `key`: Metadata key (e.g., "game_mode", "deck_id", "house_rules")
/// - `value`: Metadata value (arbitrary string, JSON-encode complex data)
#[tauri::command]
pub fn steam_set_lobby_data(
    state: State<SteamState>,
    lobby_id: String,
    key: String,
    value: String,
) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let ok = client.matchmaking().set_lobby_data(id, &key, &value);
        if ok {
            println!("[Steam] Lobby {} data set: {} = {}", lobby_id, key, value);
        } else {
            eprintln!("[Steam] Failed to set lobby {} data: {}", lobby_id, key);
        }
        Ok(ok)
    } else {
        Ok(false)
    }
}

/// Get a metadata string from the lobby by key.
///
/// Returns `None` if the key is not set, the lobby is unknown, or Steam is unavailable.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
/// - `key`: Metadata key to look up
#[tauri::command]
pub fn steam_get_lobby_data(
    state: State<SteamState>,
    lobby_id: String,
    key: String,
) -> Result<Option<String>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        Ok(client.matchmaking().lobby_data(id, &key))
    } else {
        Ok(None)
    }
}

/// Request a list of public Steam lobbies matching the current app.
///
/// This is asynchronous via Steam callback — the actual lobby IDs arrive later via
/// `LobbyMatchList_t`. The pattern mirrors `steam_create_lobby`: we kick off the request,
/// print results inside the closure, and return immediately. The JS layer polls
/// `steam_run_callbacks` to drive completion and then calls `steam_get_lobby_list_result`
/// to retrieve the IDs.
///
/// In V1, filtering is client-side — all public lobbies come back and the TS wrapper
/// filters by mode / fullness. A dedicated `steam_add_lobby_list_filter` command can
/// be added later if crate API supports it.
///
/// # Returns
/// `""` always — result is async. Caller polls steam_run_callbacks + steam_get_lobby_list_result.
#[tauri::command]
pub fn steam_request_lobby_list(state: State<SteamState>) -> Result<String, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        client.matchmaking().request_lobby_list(|result| match result {
            Ok(lobbies) => println!("[Steam] Lobby list returned: {} lobbies", lobbies.len()),
            Err(e) => eprintln!("[Steam] Lobby list request failed: {:?}", e),
        });
        println!("[Steam] Lobby list request initiated");
    }
    Ok(String::new())
}

/// Get the number of current members in a Steam lobby by ID.
///
/// Synchronous read — used by the lobby browser to show "2/4" without joining. Returns 0
/// if Steam is unavailable or the lobby is unknown.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
#[tauri::command]
pub fn steam_get_lobby_member_count(
    state: State<SteamState>,
    lobby_id: String,
) -> Result<u32, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let count = client.matchmaking().lobby_member_count(id) as u32;
        Ok(count)
    } else {
        Ok(0)
    }
}

// ── P2P Networking — ISteamNetworkingMessages ─────────────────────────────────

/// Send a P2P message to a peer using Steam Networking Messages (ISteamNetworkingMessages).
///
/// Messages are sent reliably and in-order (RELIABLE flag). The underlying connection is
/// established implicitly on first message; `steam_accept_p2p_session` is needed on the
/// receiver's side before messages are delivered.
///
/// The `data` string is expected to be a JSON-encoded game message. It is sent as raw bytes.
///
/// # Parameters
/// - `steam_id`: Target peer's 64-bit Steam ID as a decimal string
/// - `data`: JSON string payload (game event / state update)
/// - `channel`: Routing channel (0 for single-channel games; use small integers for multiple channels)
///
/// # Returns
/// `true` on successful send, `false` if Steam unavailable or send fails.
#[tauri::command]
pub fn steam_send_p2p_message(
    state: State<SteamState>,
    steam_id: String,
    data: String,
    channel: u32,
) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let peer_id = parse_steam_id(&steam_id)?;
        let identity = NetworkingIdentity::new_steam_id(peer_id);
        let bytes = data.as_bytes();
        match client
            .networking_messages()
            .send_message_to_user(identity, SendFlags::RELIABLE, bytes, channel)
        {
            Ok(()) => {
                println!("[Steam] P2P message sent to {} on channel {}", steam_id, channel);
                Ok(true)
            }
            Err(e) => {
                eprintln!("[Steam] P2P send failed to {} ch {}: {:?}", steam_id, channel, e);
                Ok(false)
            }
        }
    } else {
        Ok(false)
    }
}

/// Read all pending P2P messages on the given channel.
///
/// Drains up to 64 messages per call. Call this in a polling loop (e.g., every 100ms alongside
/// `steam_run_callbacks`) to receive incoming game events from all peers.
///
/// Message data is interpreted as UTF-8 (game messages are JSON). Invalid UTF-8 bytes are
/// replaced with the Unicode replacement character so the command never fails on bad data.
///
/// # Parameters
/// - `channel`: The channel number to read from (must match the sender's channel)
///
/// # Returns
/// All available messages as `[{ sender_id: string, data: string }]`.
#[tauri::command]
pub fn steam_read_p2p_messages(
    state: State<SteamState>,
    channel: u32,
) -> Result<Vec<SteamP2PMessage>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let messages = client
            .networking_messages()
            .receive_messages_on_channel(channel, 64);
        let result = messages
            .iter()
            .map(|msg| {
                // identity_peer() returns the sender when receiving via NetworkingMessages
                let sender_id = msg
                    .identity_peer()
                    .steam_id()
                    .map(|id| id.raw().to_string())
                    .unwrap_or_else(|| "0".to_string());
                let data = String::from_utf8_lossy(msg.data()).into_owned();
                SteamP2PMessage { sender_id, data }
            })
            .collect();
        Ok(result)
    } else {
        Ok(vec![])
    }
}

/// Accept an incoming P2P session request from a peer.
///
/// Under `ISteamNetworkingMessages`, incoming connections trigger a `SteamNetworkingMessagesSessionRequest_t`
/// callback. In the current single-threaded Tauri model (no persistent callbacks), the simplest
/// approach is to call `send_message_to_user` to the peer, which implicitly accepts their session.
///
/// This command is provided as an explicit accept signal — it sends a zero-byte RELIABLE message
/// to the peer, which both accepts their session and lets them know we've accepted.
///
/// # Parameters
/// - `steam_id`: The peer's 64-bit Steam ID as a decimal string
///
/// # Returns
/// `true` if the accept was sent, `false` if Steam unavailable.
///
/// TODO (AR-MULTIPLAYER 1.1): Register a persistent `session_request_callback` in SteamState::new()
///   so all incoming sessions are auto-accepted (or queued for JS approval) without needing
///   this explicit command for the common case.
#[tauri::command]
pub fn steam_accept_p2p_session(
    state: State<SteamState>,
    steam_id: String,
) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let peer_id = parse_steam_id(&steam_id)?;
        let identity = NetworkingIdentity::new_steam_id(peer_id);
        // Sending any message implicitly accepts the session under ISteamNetworkingMessages.
        // We send a zero-byte reliable ping as the accept signal.
        let ok = client
            .networking_messages()
            .send_message_to_user(identity, SendFlags::RELIABLE, &[], 0)
            .is_ok();
        println!("[Steam] P2P session accepted for {}: {}", steam_id, ok);
        Ok(ok)
    } else {
        Ok(false)
    }
}

/// Pump Steam callbacks to process async operations.
///
/// Must be called regularly (e.g., every 100ms from a JS `setInterval`) so that async operations
/// like lobby creation, lobby joining, and networking messages session establishment can complete.
///
/// This is the bridge between the async Steamworks callback model and the synchronous Tauri
/// command model. Without calling this, `steam_create_lobby` and `steam_join_lobby` will never
/// complete their respective callbacks.
#[tauri::command]
pub fn steam_run_callbacks(state: State<SteamState>) -> Result<(), String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        client.run_callbacks();
    }
    Ok(())
}

// ── Private helpers ────────────────────────────────────────────────────────────

/// Parse a lobby type string into the `LobbyType` enum.
fn parse_lobby_type(s: &str) -> Result<LobbyType, String> {
    match s {
        "public" => Ok(LobbyType::Public),
        "private" => Ok(LobbyType::Private),
        "friends_only" => Ok(LobbyType::FriendsOnly),
        "invisible" => Ok(LobbyType::Invisible),
        other => Err(format!(
            "Unknown lobby_type '{}'. Expected: public, private, friends_only, invisible",
            other
        )),
    }
}

/// Parse a decimal lobby ID string into a `LobbyId`.
fn parse_lobby_id(s: &str) -> Result<LobbyId, String> {
    s.parse::<u64>()
        .map(LobbyId::from_raw)
        .map_err(|_| format!("Invalid lobby_id '{}': must be a 64-bit decimal integer", s))
}

/// Parse a decimal Steam ID string into a `SteamId`.
fn parse_steam_id(s: &str) -> Result<SteamId, String> {
    s.parse::<u64>()
        .map(SteamId::from_raw)
        .map_err(|_| format!("Invalid steam_id '{}': must be a 64-bit decimal integer", s))
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
