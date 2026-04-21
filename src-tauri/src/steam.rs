use std::sync::{Arc, Mutex};
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
    /// Stores the lobby ID from the most recent `create_lobby` callback.
    /// Uses `Arc` so the value can be cloned into the callback closure without holding
    /// the `client` lock across the async boundary.
    /// Consuming: `steam_get_pending_lobby_id` calls `take()` — one-shot read.
    pub pending_lobby_id: Arc<Mutex<Option<u64>>>,
    /// Stores the lobby ID from the most recent `join_lobby` callback.
    /// Same one-shot semantics as `pending_lobby_id`.
    pub pending_join_lobby_id: Arc<Mutex<Option<u64>>>,
    /// Stores the lobby IDs from the most recent `request_lobby_list` callback.
    /// One-shot: filled when the Matchmaking callback fires, drained by steam_get_lobby_list_result.
    pub pending_lobby_list: Arc<Mutex<Option<Vec<u64>>>>,
    /// Currently active lobby ID — set when create_lobby or join_lobby callback fires,
    /// cleared when steam_leave_lobby is called or steam_force_leave_active_lobby runs.
    /// Used by the on_exit handler in main.rs to clean up the lobby on app close.
    pub active_lobby_id: Arc<Mutex<Option<u64>>>,
    /// A3: Stores the error string from the most recent `join_lobby` callback failure.
    /// Cleared at the start of each `steam_join_lobby` call. One-shot: `steam_get_pending_join_error`
    /// calls `take()` so the error is consumed after being read.
    /// Used by the TS-side `pollJoinResult` to surface the real Steam rejection reason (lobby full,
    /// no access, banned, etc.) instead of a generic timeout.
    pub pending_join_error: Arc<Mutex<Option<String>>>,
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
                    pending_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_lobby_id: Arc::new(Mutex::new(None)),
                    pending_lobby_list: Arc::new(Mutex::new(None)),
                    active_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_error: Arc::new(Mutex::new(None)),
                }
            }
            Err(e) => {
                eprintln!("[Steam] Failed to initialize (Steam client may not be running): {:?}", e);
                SteamState {
                    client: Mutex::new(None),
                    pending_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_lobby_id: Arc::new(Mutex::new(None)),
                    pending_lobby_list: Arc::new(Mutex::new(None)),
                    active_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_error: Arc::new(Mutex::new(None)),
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

/// Create a Steam lobby. Lobby creation is asynchronous — the actual lobby ID is only available
/// after the `LobbyCreated_t` callback fires via `steam_run_callbacks`.
///
/// This command initiates creation, wires the callback to store the resulting lobby ID in
/// `SteamState::pending_lobby_id` AND `SteamState::active_lobby_id`, and returns immediately.
/// The JS caller must:
/// 1. Poll `steam_run_callbacks` (e.g., every 100ms) until the callback fires.
/// 2. Call `steam_get_pending_lobby_id` to retrieve the created lobby ID.
///
/// # Parameters
/// - `lobby_type`: One of "public", "private", "friends_only", "invisible"
/// - `max_members`: Maximum number of members (1–250)
///
/// # Returns
/// `""` always — result is async. Poll `steam_run_callbacks`, then call `steam_get_pending_lobby_id`.
#[tauri::command]
pub fn steam_create_lobby(
    state: State<SteamState>,
    lobby_type: String,
    max_members: u32,
) -> Result<String, String> {
    // Clone the Arcs before locking the client so the callback closure can own them
    // without the client lock being held across the async boundary.
    let pending = state.pending_lobby_id.clone();
    let active = state.active_lobby_id.clone();

    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let ty = parse_lobby_type(&lobby_type)?;
        client.matchmaking().create_lobby(ty, max_members, move |result| {
            match result {
                Ok(lobby_id) => {
                    println!("[Steam] Lobby created: {}", lobby_id.raw());
                    if let Ok(mut slot) = pending.lock() {
                        *slot = Some(lobby_id.raw());
                    }
                    // Track as the active lobby so the exit handler can clean it up.
                    if let Ok(mut slot) = active.lock() {
                        *slot = Some(lobby_id.raw());
                    }
                }
                Err(e) => eprintln!("[Steam] Lobby creation failed: {:?}", e),
            }
        });
        println!("[Steam] Lobby creation initiated (type={}, max={})", lobby_type, max_members);
        Ok(String::new())
    } else {
        Ok(String::new())
    }
}

/// Retrieve the lobby ID stored by the most recent `steam_create_lobby` callback.
///
/// Returns `None` if no lobby has been created yet or `steam_run_callbacks` has not been
/// pumped enough for the callback to fire.
///
/// Consuming: clears the stored ID on read so this is a one-shot poll — calling it twice
/// returns `None` on the second call unless another lobby is created.
#[tauri::command]
pub fn steam_get_pending_lobby_id(
    state: State<SteamState>,
) -> Result<Option<String>, String> {
    let mut slot = state.pending_lobby_id.lock().map_err(|e| e.to_string())?;
    // take() atomically reads and clears — one-shot semantics.
    Ok(slot.take().map(|raw| raw.to_string()))
}

/// Join an existing Steam lobby by its ID (decimal string).
///
/// Like `steam_create_lobby`, this is asynchronous — the join result arrives via the
/// `LobbyEnter_t` callback after `steam_run_callbacks` is polled. The resulting lobby ID
/// is stored in `SteamState::pending_join_lobby_id` AND `SteamState::active_lobby_id` and
/// can be retrieved via `steam_get_pending_join_lobby_id`.
///
/// A3: On callback failure, the error string is stored in `pending_join_error` and can be
/// retrieved via `steam_get_pending_join_error`. The error slot is cleared at the start of
/// each call so it only reflects the current attempt.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
#[tauri::command]
pub fn steam_join_lobby(state: State<SteamState>, lobby_id: String) -> Result<(), String> {
    // Clone the Arcs before locking the client — same pattern as steam_create_lobby.
    let pending_join = state.pending_join_lobby_id.clone();
    let active = state.active_lobby_id.clone();
    let pending_error = state.pending_join_error.clone();

    // A3: Clear the error slot before each new join attempt so stale errors don't bleed through.
    if let Ok(mut slot) = pending_error.lock() {
        *slot = None;
    }

    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let lobby_id_clone = lobby_id.clone();
        client.matchmaking().join_lobby(id, move |result| match result {
            Ok(joined_id) => {
                println!("[Steam] Joined lobby: {}", joined_id.raw());
                if let Ok(mut slot) = pending_join.lock() {
                    *slot = Some(joined_id.raw());
                }
                // Track as the active lobby so the exit handler can clean it up.
                if let Ok(mut slot) = active.lock() {
                    *slot = Some(joined_id.raw());
                }
            }
            Err(e) => {
                let msg = format!("{:?}", e);
                eprintln!("[Steam] Failed to join lobby {}: {}", lobby_id_clone, msg);
                // A3: Store the error so pollJoinResult on the TS side can surface it.
                if let Ok(mut slot) = pending_error.lock() {
                    *slot = Some(msg);
                }
            }
        });
        println!("[Steam] Join lobby initiated: {}", lobby_id);
    }
    Ok(())
}

/// Retrieve the lobby ID stored by the most recent `steam_join_lobby` callback.
///
/// Returns `None` if the join callback has not fired yet (keep polling `steam_run_callbacks`).
/// Consuming: one-shot read — clears the stored ID after returning it.
#[tauri::command]
pub fn steam_get_pending_join_lobby_id(
    state: State<SteamState>,
) -> Result<Option<String>, String> {
    let mut slot = state.pending_join_lobby_id.lock().map_err(|e| e.to_string())?;
    Ok(slot.take().map(|raw| raw.to_string()))
}

/// A3: Retrieve the error string stored by the most recent failed `steam_join_lobby` callback.
///
/// Returns `None` if the last join succeeded (or no join has been attempted yet).
/// Consuming: `take()` — one-shot read. A second call returns `None` unless another join fails.
///
/// The TS-side `pollJoinResult` calls this in parallel with `steam_get_pending_join_lobby_id`.
/// Whichever returns a non-null value first wins:
///   - error returned → `joinSteamLobby` throws with the Steam reason.
///   - id returned    → join succeeded; resolve with the id.
#[tauri::command]
pub fn steam_get_pending_join_error(
    state: State<SteamState>,
) -> Result<Option<String>, String> {
    let mut slot = state.pending_join_error.lock().map_err(|e| e.to_string())?;
    Ok(slot.take())
}

/// Leave a Steam lobby.
///
/// This is synchronous — the leave takes effect immediately.
/// Also clears the active_lobby_id tracker so the exit handler doesn't redundantly leave.
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
    drop(lock);

    // Clear the active lobby tracker — we've explicitly left.
    if let Ok(mut slot) = state.active_lobby_id.lock() {
        if slot.as_ref().map(|raw| raw.to_string()) == Some(lobby_id.clone()) {
            *slot = None;
        }
    }

    Ok(())
}

/// Best-effort leave of the currently active Steam lobby.
///
/// Called from the JS-side graceful shutdown path (e.g., on `beforeunload` or
/// when the user navigates away from a multiplayer screen) and from the Tauri
/// exit hook in `main.rs`. Non-blocking — the leave is synchronous but the
/// whole call completes in microseconds.
///
/// Safe to call when Steam is unavailable or when no lobby is active — it is
/// a no-op in both cases. Clears `active_lobby_id` on completion so the
/// app-exit handler does not double-leave.
#[tauri::command]
pub fn steam_force_leave_active_lobby(state: State<SteamState>) -> Result<bool, String> {
    let active_id = {
        let slot = state.active_lobby_id.lock().map_err(|e| e.to_string())?;
        *slot
    };

    let Some(raw_id) = active_id else {
        // No active lobby — nothing to do.
        return Ok(false);
    };

    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let lobby_id = LobbyId::from_raw(raw_id);
        client.matchmaking().leave_lobby(lobby_id);
        println!("[Steam] Force-left active lobby: {}", raw_id);
    }
    drop(lock);

    // Clear the tracker regardless of whether Steam was available.
    if let Ok(mut slot) = state.active_lobby_id.lock() {
        *slot = None;
    }

    Ok(true)
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
/// store results inside the closure in `SteamState::pending_lobby_list`, and return immediately.
/// The JS layer polls `steam_run_callbacks` to drive completion and then calls
/// `steam_get_lobby_list_result` to retrieve the IDs.
///
/// In V1, filtering is client-side — all public lobbies come back and the TS wrapper
/// filters by mode / fullness. A dedicated `steam_add_lobby_list_filter` command can
/// be added later if crate API supports it.
///
/// # Returns
/// `""` always — result is async. Caller polls steam_run_callbacks + steam_get_lobby_list_result.
#[tauri::command]
pub fn steam_request_lobby_list(state: State<SteamState>) -> Result<String, String> {
    // Clone the Arc before locking the client so the callback closure can own it
    // without the client lock being held across the async boundary.
    let pending = state.pending_lobby_list.clone();

    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        client.matchmaking().request_lobby_list(move |result| match result {
            Ok(lobbies) => {
                let ids: Vec<u64> = lobbies.iter().map(|lid| lid.raw()).collect();
                println!("[Steam] Lobby list returned: {} lobbies", ids.len());
                if let Ok(mut slot) = pending.lock() {
                    *slot = Some(ids);
                }
            }
            Err(e) => {
                eprintln!("[Steam] Lobby list request failed: {:?}", e);
                if let Ok(mut slot) = pending.lock() {
                    // Empty list signals "callback fired, no results" — distinguishable from
                    // None which means "callback has not fired yet".
                    *slot = Some(Vec::new());
                }
            }
        });
        println!("[Steam] Lobby list request initiated");
    }
    Ok(String::new())
}

/// Retrieve lobby IDs stored by the most recent `request_lobby_list` callback.
///
/// Returns `None` if the callback has not yet fired (still pending).
/// Returns `Some([])` if the callback fired but no lobbies matched.
/// Returns `Some([id, ...])` when lobbies are available.
///
/// Consuming: `take()` drains the slot — a second call returns `None` until the next request.
/// Decimal 64-bit IDs are returned as strings to avoid JS integer precision loss.
#[tauri::command]
pub fn steam_get_lobby_list_result(
    state: State<SteamState>,
) -> Result<Option<Vec<String>>, String> {
    let mut slot = state.pending_lobby_list.lock().map_err(|e| e.to_string())?;
    Ok(slot.take().map(|ids| ids.iter().map(|id| id.to_string()).collect()))
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

// ── Session Reestablishment (H9) ──────────────────────────────────────────────

/// Check whether a given Steam user is currently a member of the specified lobby.
///
/// Used by `reestablishSteamP2PSession` in `multiplayerTransport.ts` on app restart:
/// after loading persisted lobby state, we check whether the peer is still present
/// before attempting to resume the P2P session. Avoids reconnecting into a lobby that
/// has already disbanded.
///
/// # Parameters
/// - `lobby_id`: The lobby's 64-bit Steam ID as a decimal string
/// - `steam_id`: The peer's 64-bit Steam ID as a decimal string to search for
///
/// # Returns
/// `true` if the Steam ID is found in the current member list, `false` otherwise.
///
/// TODO(reconnect): Wire this command into `src-tauri/src/main.rs`
/// `.invoke_handler(tauri::generate_handler![..., steam_check_lobby_membership])`.
/// The JS-side `reestablishSteamP2PSession` currently falls back to iterating
/// `getLobbyMembers()` which is correct but fetches all member data. Once wired,
/// the TS caller can use the dedicated `steam_check_lobby_membership` IPC command
/// for a lighter membership check — particularly relevant when lobbies grow beyond
/// the current 2-player V1 cap.
#[tauri::command]
pub fn steam_check_lobby_membership(
    state: State<SteamState>,
    lobby_id: String,
    steam_id: String,
) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let lid = parse_lobby_id(&lobby_id)?;
        let target = parse_steam_id(&steam_id)?;
        let members = client.matchmaking().lobby_members(lid);
        Ok(members.into_iter().any(|m| m.raw() == target.raw()))
    } else {
        Ok(false)
    }
}
