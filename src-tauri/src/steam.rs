use std::sync::{Arc, Mutex};
use steamworks::networking_types::{NetConnectionInfo, NetworkingConnectionState, NetworkingIdentity, SendFlags};
use steamworks::{CallbackHandle, ChatMemberStateChange, Client, DistanceFilter, LobbyChatUpdate, LobbyEnter, LobbyId, LobbyType, SteamId};
use tauri::State;

// D1: Wrap CallbackHandle so it can be stored in SteamState across threads.
// CallbackHandle holds a Weak<Inner> (Mutex-backed) and only de-registers on drop.
// Steam callbacks are always dispatched from the thread that calls run_callbacks,
// so there are no real data-race concerns here — the wrapper is Send-safe in practice.
struct SendableCallbackHandle(CallbackHandle);
// SAFETY: CallbackHandle is a thin wrapper around Weak<Inner> (Mutex-backed Arc). The only
// operations on it are read (Weak::upgrade) and drop (callback de-registration via the Mutex).
// Both are thread-safe. steamworks-rs simply doesn't add the Send impl itself.
unsafe impl Send for SendableCallbackHandle {}

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
    ///
    /// A5: The raw `LobbyEnter` callback (registered in `new()`) is the source of truth for the
    /// `ChatRoomEnterResponse` code. The `join_lobby` closure only yields `Result<LobbyId, ()>`,
    /// discarding the actual response code. The raw callback fires first and writes the human-readable
    /// error string here; the closure's `Err(())` arm is a lower-priority fallback that only writes
    /// if the slot is still empty.
    pub pending_join_error: Arc<Mutex<Option<String>>>,
    /// D1: Keeps the GameOverlayActivated callback handle alive for the process lifetime.
    /// When this handle is dropped the callback de-registers. We hold it here so it is never
    /// dropped while the app is running. None when Steam failed to initialize.
    _overlay_callback: Option<SendableCallbackHandle>,
    /// A5: Keeps the raw LobbyEnter callback handle alive for the process lifetime.
    /// This callback fires on every lobby join attempt (ours and the host's own join on create)
    /// and provides the real `m_EChatRoomEnterResponse` code that `join_lobby`'s closure discards.
    /// Stored here so it is never dropped while the app is running.
    _lobby_enter_callback: Option<SendableCallbackHandle>,
    /// Auto-accept: keeps the LobbyChatUpdate callback handle alive. Fires whenever a member
    /// enters or leaves any lobby we're in. On "entered", we preemptively call
    /// `AcceptSessionWithUser` (via a zero-byte send) for the new member, so guest-to-host
    /// messages don't drop during the host's peer-poll interval. Without this, the
    /// SteamNetworkingMessages rule — "receiver must accept session before messages deliver" —
    /// means the host loses everything the guest sent in the first ~300 ms of the join.
    _lobby_chat_update_callback: Option<SendableCallbackHandle>,
    /// AR-80 follow-up: Shutdown signal for the background callback pump thread.
    ///
    /// The pump thread calls `client.run_callbacks()` every ~16 ms so that async Steam
    /// events (LobbyEnter_t, LobbyCreated_t, leaderboard fetch, cloud sync) are processed
    /// without waiting for the JS-side `steam_run_callbacks` polling cadence (~100 ms).
    ///
    /// Background pump active — `_pump_shutdown` field owns the thread lifecycle:
    /// when `SteamState` is dropped on app exit the sender is dropped, causing
    /// `rx.try_recv()` in the thread to return `Err(Disconnected)`, which exits the loop.
    ///
    /// `None` when Steam failed to initialize (no thread is spawned in that case).
    _pump_shutdown: Option<std::sync::mpsc::Sender<()>>,
    /// Keeps the SteamNetworkingMessages session_request_callback handle alive.
    /// When the guest opens a new SteamNetworkingMessages session toward us, Steam fires
    /// SteamNetworkingMessagesSessionRequest_t. Without this callback registered, the
    /// default behavior is to reject the session — all subsequent sends from the guest
    /// come back ConnectFailed. This callback auto-accepts every inbound session request
    /// from any peer (we are in a dedicated lobby so any requester is our guest).
    _session_request_callback: Option<()>, // handled via networking_messages().session_request_callback()
    /// Keeps the SteamNetworkingMessages session_failed_callback handle alive.
    /// Fires when a session fails for any reason, giving us the NetConnectionInfo
    /// diagnostic (end_reason, state, identity_remote) that explains ConnectFailed.
    _session_failed_callback: Option<()>, // handled via networking_messages().session_failed_callback()
}

impl SteamState {
    /// Try to initialize the Steamworks SDK on app startup.
    /// Failure is non-fatal — all commands silently no-op when Steam is unavailable.
    ///
    /// D1: On successful init, registers a `GameOverlayActivated` callback that logs
    /// to stdout when the Steam overlay opens or closes. This gives us a positive signal
    /// that the overlay is actually hooked — without this log line appearing, the overlay
    /// is not reaching our process (see docs/mechanics/multiplayer.md "Steam Overlay
    /// Requirements" for the full troubleshooting guide).
    ///
    /// AR-80 follow-up: Also spawns a background thread that calls `client.run_callbacks()`
    /// every ~16 ms. This ensures async Steam callbacks (LobbyEnter_t, LobbyCreated_t,
    /// leaderboard, cloud sync) fire promptly without depending on the JS polling cadence.
    /// The `steam_run_callbacks` Tauri command is kept as a harmless safety net.
    ///
    /// A5: Registers a raw `LobbyEnter` callback to capture the full `ChatRoomEnterResponse`
    /// code that `join_lobby`'s closure discards. This is the source of truth for join errors,
    /// especially the `Limited` response (code 7) that indicates a Steam account without a
    /// qualifying purchase.
    pub fn new() -> Self {
        // App ID 4547570 = Recall Rogue (production app ID).
        match Client::init_app(4547570) {
            Ok(client) => {
                println!("[Steam] Initialized successfully (App ID 4547570 — Recall Rogue)");

                // D1: Register the GameOverlayActivated callback.
                // This fires when the user presses Shift+Tab (or the overlay is triggered
                // programmatically). If this println never appears during a session, the
                // overlay is not hooked — see docs/mechanics/multiplayer.md §Steam Overlay.
                let overlay_handle = client.register_callback(
                    |val: steamworks::GameOverlayActivated| {
                        println!(
                            "[Steam] GameOverlayActivated: active={}",
                            val.active
                        );
                    },
                );

                // A5: Register a raw LobbyEnter callback to capture the real ChatRoomEnterResponse.
                //
                // The `join_lobby` closure only exposes `Result<LobbyId, ()>` — it discards
                // `m_EChatRoomEnterResponse`. This callback fires on *every* LobbyEnter_t event
                // (both join and create), so we only act on non-success responses.
                //
                // Priority design: this callback writes `pending_join_error` first. When the
                // `join_lobby` closure's `Err(())` arm also fires, it checks whether the slot is
                // already populated and skips writing if so. The raw callback is the source of
                // truth; the closure fallback is a safety net for future Steam API changes.
                //
                // Thread safety: `pending_join_error` is `Arc<Mutex<Option<String>>>`. This
                // callback and the join_lobby closure are both called from the thread running
                // `run_callbacks()` (the background pump), so no real concurrency concern.
                // The raw callback fires before the call-result closure for the same tick.
                let pending_error_for_enter = Arc::new(Mutex::new(None::<String>));
                let pending_error_ref = pending_error_for_enter.clone();
                let lobby_enter_handle = client.register_callback(move |val: LobbyEnter| {
                    use steamworks::ChatRoomEnterResponse;
                    match val.chat_room_enter_response {
                        ChatRoomEnterResponse::Success => {
                            // Success path — clear any stale error from a prior failed attempt.
                            // The join_lobby Ok closure handles populating pending_join_lobby_id.
                            if let Ok(mut slot) = pending_error_ref.lock() {
                                *slot = None;
                            }
                        }
                        response => {
                            let msg = match response {
                                ChatRoomEnterResponse::DoesntExist => {
                                    "Lobby no longer exists".to_string()
                                }
                                ChatRoomEnterResponse::NotAllowed => {
                                    "Lobby join not allowed".to_string()
                                }
                                ChatRoomEnterResponse::Full => {
                                    "Lobby is full".to_string()
                                }
                                ChatRoomEnterResponse::Error => {
                                    "Generic Steam error joining lobby".to_string()
                                }
                                ChatRoomEnterResponse::Banned => {
                                    "You are banned from this lobby".to_string()
                                }
                                ChatRoomEnterResponse::Limited => {
                                    "Your Steam account is Limited — spend $5 or more on the Steam Store to join multiplayer lobbies".to_string()
                                }
                                ChatRoomEnterResponse::ClanDisabled => {
                                    "Clan chat is disabled for this lobby".to_string()
                                }
                                ChatRoomEnterResponse::CommunityBan => {
                                    "A community ban prevents joining".to_string()
                                }
                                ChatRoomEnterResponse::MemberBlockedYou => {
                                    "A lobby member has blocked you".to_string()
                                }
                                ChatRoomEnterResponse::YouBlockedMember => {
                                    "You have blocked a lobby member".to_string()
                                }
                                ChatRoomEnterResponse::RatelimitExceeded => {
                                    "Steam rate limit hit — try again in a moment".to_string()
                                }
                                // Success is handled in the outer match arm above.
                                ChatRoomEnterResponse::Success => unreachable!(),
                            };
                            eprintln!("[Steam] LobbyEnter error: {}", msg);
                            // Only write if the slot is still empty — raw callback wins over
                            // the join_lobby closure fallback.
                            if let Ok(mut slot) = pending_error_ref.lock() {
                                if slot.is_none() {
                                    *slot = Some(msg);
                                }
                            }
                        }
                    }
                });

                // Auto-accept P2P sessions the moment a peer joins our lobby.
                //
                // SteamNetworkingMessages requires the RECEIVER to accept a session before
                // messages from that peer are delivered. On the host side our peer-poll
                // only fires every 300 ms, so any message the guest sent in that window was
                // being dropped. By registering a LobbyChatUpdate callback here, we send a
                // zero-byte outbound message to every member who enters any of our lobbies —
                // which implicitly accepts the reverse direction under Steam's session rules
                // and lets incoming messages start delivering within milliseconds of join.
                let client_for_chat = client.clone();
                let lobby_chat_handle = client.register_callback(move |val: LobbyChatUpdate| {
                    // member_state_change is a flagset; Entered is the bit we care about.
                    if val.member_state_change == ChatMemberStateChange::Entered {
                        let peer = val.user_changed;
                        let me = client_for_chat.user().steam_id();
                        if peer == me {
                            // Ourselves — don't ping self. This fires when we create/join a lobby.
                            println!("[Steam] LobbyChatUpdate: self entered lobby {}", val.lobby.raw());
                            return;
                        }
                        println!(
                            "[Steam] LobbyChatUpdate: peer {} entered lobby {} — auto-accepting P2P",
                            peer.raw(),
                            val.lobby.raw(),
                        );
                        let identity = NetworkingIdentity::new_steam_id(peer);
                        let ok = client_for_chat
                            .networking_messages()
                            .send_message_to_user(identity, SendFlags::RELIABLE, &[], 0)
                            .is_ok();
                        println!("[Steam] Auto-accept P2P for {}: {}", peer.raw(), ok);
                    }
                });

                // Fix: Register session_request_callback so inbound SteamNetworkingMessages
                // sessions are auto-accepted. Without this, any peer who calls
                // send_message_to_user toward us for the first time triggers a
                // SteamNetworkingMessagesSessionRequest_t callback — and if the callback
                // is not registered (or lets the SessionRequest drop), Steam rejects the
                // session. All subsequent sends from that peer return ConnectFailed.
                //
                // The receiver MUST call AcceptSessionWithUser (or equivalently send a
                // message back, which implicitly accepts). Registering this callback here
                // in SteamState::new() ensures sessions are accepted the moment Steam fires
                // the event, regardless of which thread runs the pump. This is the "other
                // half" of the LobbyChatUpdate auto-accept above: LobbyChatUpdate fires
                // for existing lobby members; session_request_callback fires for any peer
                // who opens a fresh SteamNetworkingMessages session (including retries).
                client.networking_messages().session_request_callback(move |request| {
                    let peer_id = request.remote().steam_id();
                    eprintln!("[Steam] SessionRequest: accepting from peer {:?}", peer_id);
                    let accepted = request.accept();
                    eprintln!("[Steam] SessionRequest: accept() returned {}", accepted);
                });
                eprintln!("[Steam] session_request_callback registered (auto-accept)");

                // Register session_failed_callback for diagnostics.
                // Fires when a SteamNetworkingMessages session fails (ConnectFailed, etc.).
                // Logs the full NetConnectionInfo diagnostic — state, end_reason, identity_remote.
                // Previously these failures were silent: sends returned ConnectFailed with no
                // further information visible to the Rust layer.
                client.networking_messages().session_failed_callback(move |info: NetConnectionInfo| {
                    eprintln!("[Steam] SessionFailed: state={:?} end_reason={:?} identity_remote={:?}",
                        info.state(), info.end_reason(), info.identity_remote());
                });
                eprintln!("[Steam] session_failed_callback registered (diagnostics)");

                // AR-80 follow-up: Spawn a background thread that pumps Steam callbacks
                // at ~16 ms intervals.
                //
                // Safety notes:
                // - steamworks-rs `Client` wraps `Arc<Inner>` internally and implements
                //   `Clone` (confirmed in steamworks-rs 0.12.2 lib.rs:92). Cloning is cheap
                //   (just an Arc ref-count increment) and safe across threads.
                // - `run_callbacks()` is idempotent. Concurrent calls from this thread and
                //   the JS-driven `steam_run_callbacks` command don't conflict — worst case
                //   is a redundant pump that processes zero events.
                // - Drop order: when `SteamState` drops, `_pump_shutdown` (the tx end) is
                //   dropped, causing `rx.try_recv()` below to return `Err(Disconnected)`,
                //   which exits the loop on the next tick. No explicit join needed.
                let client_for_pump = client.clone();
                let (tx, rx) = std::sync::mpsc::channel::<()>();
                std::thread::spawn(move || {
                    use std::sync::mpsc::TryRecvError;
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(16));
                        client_for_pump.run_callbacks();
                        match rx.try_recv() {
                            Err(TryRecvError::Empty) => continue,
                            // Disconnected = SteamState dropped; Normal = explicit shutdown
                            _ => break,
                        }
                    }
                    println!("[Steam] Callback pump thread exiting");
                });
                println!("[Steam] Callback pump thread started (~16ms tick)");

                SteamState {
                    client: Mutex::new(Some(client)),
                    pending_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_lobby_id: Arc::new(Mutex::new(None)),
                    pending_lobby_list: Arc::new(Mutex::new(None)),
                    active_lobby_id: Arc::new(Mutex::new(None)),
                    pending_join_error: pending_error_for_enter,
                    _overlay_callback: Some(SendableCallbackHandle(overlay_handle)),
                    _lobby_enter_callback: Some(SendableCallbackHandle(lobby_enter_handle)),
                    _lobby_chat_update_callback: Some(SendableCallbackHandle(lobby_chat_handle)),
                    _pump_shutdown: Some(tx),
                    // session_request_callback and session_failed_callback are registered
                    // directly on networking_messages() above; they are persistent for the
                    // Arc<Inner> lifetime and do not return a handle we need to store.
                    _session_request_callback: Some(()),
                    _session_failed_callback: Some(()),
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
                    _overlay_callback: None,
                    _lobby_enter_callback: None,
                    _lobby_chat_update_callback: None,
                    _pump_shutdown: None,
                    _session_request_callback: None,
                    _session_failed_callback: None,
                }
            }
        }
    }
}

// ── Shared serializable types ──────────────────────────────────────────────────

/// A member of a Steam lobby, as returned by `steam_get_lobby_members`.
///
/// **Serialization note**: `rename_all = "camelCase"` so the JS side sees
/// `{ steamId, displayName }` — matches the `SteamLobbyMember` TS interface in
/// `src/services/steamNetworkingService.ts`. Without this, TS `m.steamId`
/// reads `undefined` against every member and any filter that compares
/// SteamIDs silently degrades (noticed 2026-04-22 when the member-filter
/// fallback in `resolveSteamPeerId` returned null for every lobby because
/// the host's lobby_members list looked empty to the TS side even though
/// Rust was returning two valid members).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
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

// ── D1: Steam overlay diagnostic ─────────────────────────────────────────────

/// Diagnostic status for the Steam overlay.
///
/// Returned by `steam_overlay_status`. Use this in the dev diagnostic panel
/// (visible under `?dev=true`) to verify that the overlay is configured and
/// the process was launched through Steam.
///
/// Note: the `overlay_enabled` field reflects `ISteamUtils::BIsOverlayEnabled()`,
/// which returns true only when Steam client has "Enable the Steam Overlay while
/// in-game" checked AND steamworks successfully initialized. It does NOT guarantee
/// that the overlay will actually render — on Tauri/WebView2 builds the overlay
/// renderer may fail to hook even when this returns true (known upstream limitation).
/// Watch for the `[Steam] GameOverlayActivated: active=true` log line as the
/// definitive positive signal that the overlay is hooked.
#[derive(serde::Serialize)]
pub struct SteamOverlayStatus {
    /// True if Steam reports the overlay is enabled. Requires:
    ///   (a) Steam client "Enable Steam Overlay while in-game" is checked, AND
    ///   (b) steamworks initialized for this app.
    /// None should never occur in practice (steamworks-rs 0.12 exposes the API),
    /// but is kept as Option for future-compatibility and graceful degradation.
    pub overlay_enabled: Option<bool>,
    /// True if the process env contains `SteamAppId=4547570` or `SteamGameId=4547570`,
    /// which the Steam launcher injects automatically when the game is launched via
    /// the Steam library. Launching the Tauri exe directly will NOT set these vars —
    /// and the overlay injector will not hook our process without them.
    pub launched_via_steam: bool,
    /// True if the Steamworks client initialized successfully on startup.
    /// False means Steam client was not running at launch, or the SDK failed for
    /// another reason (wrong app ID, DRM mismatch, etc.).
    pub steam_initialized: bool,
}

/// Return overlay + launch-source diagnostic status.
///
/// Designed for the dev diagnostic panel (`?dev=true`) and for gathering info
/// when players report that Shift+Tab doesn't open the Steam overlay.
///
/// The most actionable fields:
/// - `launched_via_steam: false` → player launched the exe directly; overlay cannot hook.
/// - `overlay_enabled: Some(false)` → overlay is disabled in Steam client settings.
/// - `steam_initialized: false` → Steam client wasn't running at game launch.
///
/// Even when all three look correct the overlay may still not render on
/// WebView2/WKWebView — this is a known upstream limitation. If the
/// `[Steam] GameOverlayActivated: active=true` log line never appears in
/// stdout, the overlay is not hooked by our process regardless of these flags.
#[tauri::command]
pub fn steam_overlay_status(state: State<SteamState>) -> Result<SteamOverlayStatus, String> {
    // Check env vars the Steam client injects on launch.
    let steam_app_id = std::env::var("SteamAppId").ok();
    let steam_game_id = std::env::var("SteamGameId").ok();
    let launched_via_steam = matches!(steam_app_id.as_deref(), Some("4547570"))
        || matches!(steam_game_id.as_deref(), Some("4547570"));

    let lock = state.client.lock().map_err(|e| e.to_string())?;
    let steam_initialized = lock.is_some();

    let overlay_enabled = if let Some(client) = lock.as_ref() {
        // ISteamUtils::BIsOverlayEnabled — available in steamworks-rs 0.12 via utils().
        Some(client.utils().is_overlay_enabled())
    } else {
        // Steam not initialized — overlay cannot be enabled.
        None
    };

    Ok(SteamOverlayStatus {
        overlay_enabled,
        launched_via_steam,
        steam_initialized,
    })
}

/// Return the local user's 64-bit Steam ID as a decimal string.
///
/// Used by the multiplayer layer to filter the local player out of
/// `steam_get_lobby_members` results so we can find the REMOTE peer's Steam ID —
/// Steam P2P messaging needs the remote user's SteamID as the peer, not the
/// lobby ID.
///
/// Returns `None` when Steam is unavailable.
#[tauri::command]
pub fn steam_get_local_steam_id(
    state: State<SteamState>,
) -> Result<Option<String>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        Ok(Some(client.user().steam_id().raw().to_string()))
    } else {
        Ok(None)
    }
}

/// Write a diagnostic line to the redirected stdout/stderr (debug.log).
///
/// Called from JS via the typed IPC bridge to land multiplayer event logs
/// alongside the Rust-side `[Steam] …` prints. Lets us reconstruct the full
/// timeline of a multiplayer session without needing devtools.
#[tauri::command]
pub fn rr_log(tag: String, line: String) -> Result<(), String> {
    eprintln!("[js:{}] {}", tag, line);
    Ok(())
}

/// Return the 64-bit Steam ID of the lobby owner (host) as a decimal string.
///
/// Unlike `steam_get_lobby_members`, this is a synchronous read against Steam's
/// local cache — no async Steam callback required. It returns the correct host
/// SteamID the moment the local user is in the lobby, which makes it the
/// reliable way to resolve the P2P peer for a guest right after join. Filtering
/// `lobby_members` can miss the host if Steam hasn't synced the full member
/// list to the local client yet.
///
/// Returns `None` when Steam is unavailable or the lobby isn't known locally.
#[tauri::command]
pub fn steam_get_lobby_owner(
    state: State<SteamState>,
    lobby_id: String,
) -> Result<Option<String>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = parse_lobby_id(&lobby_id)?;
        let owner = client.matchmaking().lobby_owner(id);
        let raw = owner.raw();
        if raw == 0 {
            Ok(None)
        } else {
            Ok(Some(raw.to_string()))
        }
    } else {
        Ok(None)
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
/// A5: After storing the lobby ID, calls `set_lobby_joinable(true)` explicitly. Steam
/// documents this as the default but the explicit call is defensive — it avoids any edge
/// case where a lobby created in invisible mode or after a permissions change is unjoinable.
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
        // A5: Clone the client Arc into the closure so we can call set_lobby_joinable after
        // the lobby is created. This is the same pattern used for pending_lobby_id.
        let client_for_cb = client.clone();
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
                    // A5: Explicitly mark the lobby as joinable. Documented as default-on
                    // but defensive — cheap call, prevents silent lockout edge cases.
                    let ok = client_for_cb.matchmaking().set_lobby_joinable(lobby_id, true);
                    println!("[Steam] set_lobby_joinable(true): {}", ok);
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
/// A5: The raw `LobbyEnter` callback registered in `SteamState::new()` is the primary
/// source of error data — it writes a human-readable message for every non-success
/// `ChatRoomEnterResponse` code. This closure's `Err(())` arm is a lower-priority fallback
/// that only writes to `pending_join_error` if the raw callback hasn't already.
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
                // A5: Clear any stale error from a prior failed attempt on this slot.
                if let Ok(mut slot) = pending_error.lock() {
                    *slot = None;
                }
            }
            Err(e) => {
                // A5: The raw LobbyEnter callback (registered in SteamState::new()) fires before
                // this closure for the same LobbyEnter_t event and writes the real error message.
                // Only populate the error slot if the raw callback hasn't already done so —
                // this closure's error is a last-resort fallback.
                let msg = format!("steam: join_lobby closure returned {:?}", e);
                eprintln!("[Steam] Failed to join lobby {}: {}", lobby_id_clone, msg);
                if let Ok(mut slot) = pending_error.lock() {
                    if slot.is_none() {
                        *slot = Some(msg);
                    }
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
    let result = slot.take().map(|raw| raw.to_string());
    // DIAG: log every read so we can see what the pollJoinResult loop sees.
    println!("[Steam] steam_get_pending_join_lobby_id -> {:?}", result);
    Ok(result)
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
///
/// A5: The error message is now sourced from the raw `LobbyEnter` callback (registered in
/// `SteamState::new()`), which maps `ChatRoomEnterResponse` codes to human-readable strings.
/// The most actionable code is `Limited` (7) — Steam accounts without a qualifying purchase
/// cannot join matchmaking lobbies; the user must spend $5+ on the Steam Store.
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
/// A5: Sets `DistanceFilter::Worldwide` before the request. The default filter is
/// `k_ELobbyDistanceFilterDefault` (nearby), which can exclude two accounts on the same
/// LAN but in different Steam-assigned regions. Worldwide ensures both players always see
/// each other's lobbies regardless of region.
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
        // A5: Worldwide distance filter — the Steam default (nearby) silently excludes lobbies
        // from accounts in different Steam-assigned regions, even on the same physical LAN.
        client.matchmaking().set_request_lobby_list_distance_filter(DistanceFilter::Worldwide);
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
        println!("[Steam] Lobby list request initiated (distance=Worldwide)");
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


/// Request that Steam fetch fresh metadata for a lobby we don't own.
///
/// When a client discovers a lobby via `RequestLobbyList` (not by creating/joining it),
/// Steam's local cache may not yet hold the lobby's metadata. `GetLobbyData` would then
/// return "" until `LobbyDataUpdate_t` fires.
///
/// This command kicks off the request. Callers should wait briefly (50–200 ms is usually
/// enough on warm Steam backends) before calling `steam_get_lobby_data`. There is no
/// explicit callback delivered through this Tauri command — the background callback pump
/// processes `LobbyDataUpdate_t` events automatically, and `GetLobbyData` will start
/// returning real values after that.
///
/// # Returns
/// `true` if the request was submitted (Steam considers the data not yet cached locally).
/// `false` means the data is already cached (no request needed) OR Steam is unavailable.
///
/// # Note on steamworks-rs 0.12 API gap
/// steamworks-rs 0.12 does not expose a `request_lobby_data` method on `Matchmaking`,
/// and the `steamworks::sys` re-export is crate-private. Calling the flat C API would
/// require adding `steamworks-sys` as a direct dependency. For now this command is a
/// no-op — the 200ms sleep in the TS warm-up gives the background callback pump time
/// to process any `LobbyDataUpdate_t` events Steam dispatches on its own when the list
/// response arrives. `GetLobbyData` still returns cached data if Steam has it, and the
/// existing `if (!mode || !visibility || !lobbyCode) continue` guard in the TS list
/// handler skips entries whose data is still blank.
#[tauri::command]
pub fn steam_request_lobby_data(
    state: State<SteamState>,
    lobby_id: String,
) -> Result<bool, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if lock.is_some() {
        // Parse validates the ID format even though we can't call Steam's request_lobby_data.
        let _ = parse_lobby_id(&lobby_id)?;
        println!("[Steam] steam_request_lobby_data (no-op — steamworks-rs 0.12 gap): {}", lobby_id);
    }
    Ok(false)
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
        // AUTO_RESTART_BROKEN_SESSION: when the session hits NoConnection after a NAT
        // hole-punch failure or transient relay drop, Steam automatically closes and
        // re-opens the underlying connection and requeues the send. Without this flag,
        // a single NoConnection returns an error and the message is lost permanently.
        // Combined with RELIABLE this gives us the same "exactly-once, in-order"
        // guarantee while tolerating brief connectivity interruptions. (Flag added
        // 2026-04-22 as part of the ConnectFailed diagnostic + session-handshake fix.)
        let send_flags = SendFlags::RELIABLE | SendFlags::AUTO_RESTART_BROKEN_SESSION;
        match client
            .networking_messages()
            .send_message_to_user(identity, send_flags, bytes, channel)
        {
            Ok(()) => {
                println!("[Steam] P2P message sent to {} on channel {} (flags=RELIABLE|AUTO_RESTART_BROKEN_SESSION)", steam_id, channel);
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
/// Note (2026-04-22): A persistent `session_request_callback` is now registered in SteamState::new()
/// so all incoming SteamNetworkingMessages sessions are auto-accepted at callback time.
/// This command remains as an explicit accept signal for the JS-driven handshake path.
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
/// The background pump thread (spawned in `SteamState::new()`) now calls `run_callbacks()`
/// every ~16 ms, so this command is no longer required for callbacks to fire. It is kept as a
/// harmless safety net — calling it is idempotent (duplicate pumps process zero events).
///
/// JS callers may still poll this if they want an explicit synchronization point, but the
/// 100 ms JS polling cadence is no longer on the critical path for lobby join/create latency.
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


// ── P2P Session Priming ───────────────────────────────────────────────────────

/// Prime P2P sessions with all other members of a lobby by sending them a zero-byte message.
///
/// SteamNetworkingMessages requires the receiver to have accepted a session before
/// messages are delivered. When both sides join a lobby simultaneously, there is a race:
/// if neither side has called AcceptSessionWithUser yet when the first real message
/// arrives, that message returns ConnectFailed. This command proactively opens a session
/// toward every other lobby member, which:
///   (a) Triggers their `session_request_callback` (if registered) to auto-accept, AND
///   (b) Implicitly accepts the reverse direction under Steam's session rules.
///
/// Call this immediately after create_lobby or join_lobby success on both host and guest.
/// The zero-byte message is a no-op for the game protocol — it is invisible to the
/// TS-side message handlers.
///
/// # Returns
/// Number of peers primed (i.e., members in the lobby excluding self), or an error string.
#[tauri::command]
pub fn steam_prime_p2p_sessions(
    state: State<SteamState>,
    lobby_id: String,
) -> Result<u32, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let lid = parse_lobby_id(&lobby_id)?;
        let me = client.user().steam_id();
        let members = client.matchmaking().lobby_members(lid);
        let peers: Vec<SteamId> = members.into_iter().filter(|m| m.raw() != me.raw()).collect();
        let mut primed = 0u32;
        let mut peer_ids: Vec<String> = Vec::new();
        for peer in &peers {
            let identity = NetworkingIdentity::new_steam_id(*peer);
            // AUTO_RESTART_BROKEN_SESSION ensures a stale session won't block the primer.
            let ok = client.networking_messages()
                .send_message_to_user(identity, SendFlags::RELIABLE | SendFlags::AUTO_RESTART_BROKEN_SESSION, &[], 0)
                .is_ok();
            if ok { primed += 1; }
            peer_ids.push(peer.raw().to_string());
            eprintln!("[Steam] Primed P2P session with {}: {}", peer.raw(), ok);
        }
        eprintln!("[Steam] Primed P2P sessions: count={} peers={:?}", primed, peer_ids);
        Ok(primed)
    } else {
        Ok(0)
    }
}

/// Get the current SteamNetworkingMessages connection state for a specific peer.
///
/// Returns a single-line diagnostic string of the form:
///   `state=Connected rtt=42 end_reason=None`
///   `state=Connecting rtt=-1 end_reason=None`
///   `state=ProblemDetectedLocally rtt=-1 end_reason=Some(...)`
///
/// Used by the TS-side retry path (`SteamP2PTransport.send`) to include connection
/// state in send-failure log lines, and by the debug overlay in the multiplayer UI.
///
/// Returns `"state=None"` when Steam is unavailable or no session exists yet for this peer.
#[tauri::command]
pub fn steam_get_p2p_connection_state(
    state: State<SteamState>,
    steam_id: String,
) -> Result<String, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let peer_id = parse_steam_id(&steam_id)?;
        let identity = NetworkingIdentity::new_steam_id(peer_id);
        let (conn_state, info, realtime) = client.networking_messages()
            .get_session_connection_info(&identity);
        let rtt = realtime.map(|r| r.ping()).unwrap_or(-1);
        let end_reason = info.as_ref().and_then(|i| i.end_reason()).map(|e| format!("{:?}", e));
        Ok(format!("state={:?} rtt={} end_reason={:?}", conn_state, rtt, end_reason))
    } else {
        Ok("state=None".to_string())
    }
}

// ── Cloud Save ────────────────────────────────────────────────────────────────
// TODO (AR-80 follow-up): Implement Steam Cloud Save via steamworks::RemoteStorage.
//   - steam_cloud_save(data: String) -> Result<(), String>
//     Write serialized save JSON to a well-known filename (e.g., "save.json") in
//     the user's Steam Cloud storage for this app.
//   - steam_cloud_load() -> Result<Option<String>, String>
//     Read the cloud save back. Return None if no cloud save exists yet.
//   The background callback pump (see _pump_shutdown field) already handles async
//   completion events for these operations — no additional polling setup required.

// ── Leaderboards ──────────────────────────────────────────────────────────────
// TODO (AR-80 follow-up): Implement Steam Leaderboards via steamworks Leaderboard API.
//   - steam_submit_score(board: String, score: i32) -> Result<(), String>
//     Find or create the named leaderboard, then upload the score (keep-best).
//   - steam_get_leaderboard_entries(board: String) -> Result<Vec<LeaderboardEntry>, String>
//     Fetch the top-N global entries for display in the in-game leaderboard screen.
//   The background callback pump (see _pump_shutdown field) already handles async
//   completion events for these operations — no additional polling setup required.

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

// ── C2: Local player persona name ────────────────────────────────────────────

/// Return the Steam display name (persona name) of the locally signed-in user.
///
/// This is the same name shown in the Steam overlay and friends list — it is what
/// other players see. Returns  when Steam is unavailable (non-Tauri builds,
/// Steam client not running, etc.).
///
/// Uses `ISteamFriends::GetFriendPersonaName` with the local user's own Steam ID.
/// The name is always available for the local user (Steam loads it on init) so this
/// call is synchronous — no callback or polling required.
#[tauri::command]
pub fn steam_get_persona_name(state: State<SteamState>) -> Result<Option<String>, String> {
    let lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = lock.as_ref() {
        let id = client.user().steam_id();
        let name = client.friends().get_friend(id).name();
        println!("[Steam] Persona name: {}", name);
        Ok(Some(name))
    } else {
        Ok(None)
    }
}
