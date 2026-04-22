//! LAN relay server for Recall Rogue multiplayer.
//!
//! Runs an embedded Axum HTTP + WebSocket server inside the Tauri process so
//! players on the same local network can host and join games without Steam or
//! an external server.
//!
//! The server mirrors the `/mp/*` REST and WebSocket contract of the existing
//! Fastify backend exactly, so the TypeScript client (`multiplayerLobbyService`,
//! `multiplayerTransport`, `lanConfigService`) works without modification.
//!
//! # Architecture
//! - In-memory lobby registry behind `Arc<RwLock<_>>` — no persistence.
//! - REST endpoints: POST /mp/lobbies, GET /mp/lobbies, GET /mp/lobbies/code/:code,
//!   POST /mp/lobbies/:id/join, POST /mp/lobbies/:id/leave.
//! - WebSocket relay: GET /mp/ws?lobbyId=&playerId=&token= — dumb forwarding,
//!   no message parsing.
//! - Discovery: GET /mp/discover.
//! - Stale lobby pruner runs every 60 s, evicts lobbies idle >10 min.
//! - Tauri commands: lan_start_server, lan_stop_server, lan_server_status, lan_get_local_ips.

use axum::{
    Router,
    extract::{
        ws::{Message, WebSocket},
        Path, Query, State, WebSocketUpgrade,
    },
    http::{Method, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
};
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{mpsc::UnboundedSender, oneshot, RwLock};
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Default port for the LAN relay server.
pub const DEFAULT_PORT: u16 = 19738;

/// Lobby code alphabet: uppercase letters + digits, no I, O, 0, 1.
const CODE_CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/// Lobby code length (characters).
const CODE_LEN: usize = 6;

/// Seconds of inactivity before a lobby is pruned.
const LOBBY_IDLE_TIMEOUT_SECS: u64 = 600; // 10 minutes

/// Pruner interval in seconds.
const PRUNE_INTERVAL_SECS: u64 = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

/// One player connection slot inside a lobby.
struct LanConnection {
    player_id: String,
    display_name: String,
    join_token: String,
    /// Channel sender for outbound WebSocket messages. None until WS connects.
    tx: Option<UnboundedSender<String>>,
}

/// An active lobby in the registry.
struct LanLobby {
    lobby_id: String,
    lobby_code: String,
    host_id: String,
    host_name: String,
    mode: String,
    visibility: String,
    /// SHA-256 hex of the password, provided by the client.
    password_hash: Option<String>,
    max_players: u8,
    connections: HashMap<String, LanConnection>,
    created_at: u64,
    last_activity: u64,
}

impl LanLobby {
    fn current_players(&self) -> usize {
        self.connections.len()
    }
}

/// Shared registry type alias.
type Registry = Arc<RwLock<HashMap<String, LanLobby>>>;

/// Application state threaded through every Axum handler.
#[derive(Clone)]
struct AppState {
    registry: Registry,
    host_name: String,
    port: u16,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns seconds since the Unix epoch (truncated to u64).
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Generate a random 6-char lobby code using the unambiguous alphabet.
fn generate_lobby_code() -> String {
    let mut rng = rand::thread_rng();
    (0..CODE_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CODE_CHARS.len());
            CODE_CHARS[idx] as char
        })
        .collect()
}

/// Constant-time comparison of two byte slices (prevents timing attacks on password hashes).
/// The hashes here are SHA-256 hex strings, so length leaks nothing meaningful,
/// but we still compare every byte to avoid shortcircuit timing.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ── REST request/response shapes ──────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateLobbyBody {
    host_id: String,
    host_name: String,
    mode: String,
    visibility: String,
    password_hash: Option<String>,
    max_players: Option<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateLobbyResponse {
    lobby_id: String,
    lobby_code: String,
    join_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListLobbiesQuery {
    mode: Option<String>,
    fullness: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LobbyBrowserEntry {
    lobby_id: String,
    host_name: String,
    mode: String,
    current_players: usize,
    max_players: u8,
    visibility: String,
    created_at: u64,
    source: &'static str,
}

#[derive(Serialize)]
struct ListLobbiesResponse {
    lobbies: Vec<LobbyBrowserEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinLobbyBody {
    player_id: String,
    display_name: String,
    password: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct JoinLobbyResponse {
    lobby_id: String,
    lobby_code: String,
    join_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeaveLobbyBody {
    player_id: String,
}

#[derive(Serialize)]
struct OkResponse {
    ok: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverResponse {
    game: &'static str,
    version: &'static str,
    host_name: String,
    port: u16,
}

#[derive(Deserialize)]
struct WsQuery {
    #[serde(rename = "lobbyId")]
    lobby_id: String,
    #[serde(rename = "playerId")]
    player_id: String,
    token: String,
}

// ── REST handlers ─────────────────────────────────────────────────────────────

/// POST /mp/lobbies — create a new lobby.
async fn create_lobby(
    State(state): State<AppState>,
    Json(body): Json<CreateLobbyBody>,
) -> impl IntoResponse {
    let lobby_id = Uuid::new_v4().to_string();
    let lobby_code = generate_lobby_code();
    let join_token = Uuid::new_v4().to_string();
    let max_players = body.max_players.unwrap_or(4).clamp(2, 8);
    let now = now_secs();

    let mut connection_map: HashMap<String, LanConnection> = HashMap::new();
    connection_map.insert(
        body.host_id.clone(),
        LanConnection {
            player_id: body.host_id.clone(),
            display_name: body.host_name.clone(),
            join_token: join_token.clone(),
            tx: None,
        },
    );

    let lobby = LanLobby {
        lobby_id: lobby_id.clone(),
        lobby_code: lobby_code.clone(),
        host_id: body.host_id,
        host_name: body.host_name,
        mode: body.mode,
        visibility: body.visibility,
        password_hash: body.password_hash,
        max_players,
        connections: connection_map,
        created_at: now,
        last_activity: now,
    };

    state.registry.write().await.insert(lobby_id.clone(), lobby);

    (
        StatusCode::CREATED,
        Json(CreateLobbyResponse {
            lobby_id,
            lobby_code,
            join_token,
        }),
    )
}

/// GET /mp/lobbies — list public lobbies with optional filters.
async fn list_lobbies(
    State(state): State<AppState>,
    Query(query): Query<ListLobbiesQuery>,
) -> impl IntoResponse {
    let registry: tokio::sync::RwLockReadGuard<HashMap<String, LanLobby>> =
        state.registry.read().await;
    let mut lobbies: Vec<LobbyBrowserEntry> = registry
        .values()
        .filter(|l| l.visibility != "friends_only")
        .filter(|l| {
            if let Some(ref mode) = query.mode {
                if !mode.is_empty() && l.mode != *mode {
                    return false;
                }
            }
            true
        })
        .filter(|l| {
            if query.fullness.as_deref() == Some("open") {
                l.current_players() < l.max_players as usize
            } else {
                true
            }
        })
        .map(|l| LobbyBrowserEntry {
            lobby_id: l.lobby_id.clone(),
            host_name: l.host_name.clone(),
            mode: l.mode.clone(),
            current_players: l.current_players(),
            max_players: l.max_players,
            visibility: l.visibility.clone(),
            created_at: l.created_at,
            source: "lan",
        })
        .collect();

    // Newest first.
    lobbies.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Json(ListLobbiesResponse { lobbies })
}

/// GET /mp/lobbies/code/:code — resolve a lobby code to its full details.
async fn resolve_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let code_upper = code.to_uppercase();
    let registry: tokio::sync::RwLockReadGuard<HashMap<String, LanLobby>> =
        state.registry.read().await;
    match registry.values().find(|l| l.lobby_code == code_upper) {
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Lobby not found" })),
        ),
        Some(l) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "lobbyId": l.lobby_id,
                "lobbyCode": l.lobby_code,
                "hostName": l.host_name,
                "mode": l.mode,
                "currentPlayers": l.current_players(),
                "maxPlayers": l.max_players,
                "visibility": l.visibility,
            })),
        ),
    }
}

/// POST /mp/lobbies/:lobbyId/join — add a player to an existing lobby.
async fn join_lobby(
    State(state): State<AppState>,
    Path(lobby_id): Path<String>,
    Json(body): Json<JoinLobbyBody>,
) -> impl IntoResponse {
    let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
        state.registry.write().await;

    let Some(lobby) = registry.get_mut(&lobby_id) else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Lobby not found" })),
        );
    };

    // Password check.
    if let Some(ref hash) = lobby.password_hash {
        let provided = body.password.as_deref().unwrap_or("");
        if !constant_time_eq(hash.as_bytes(), provided.as_bytes()) {
            return (
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({ "error": "Wrong password" })),
            );
        }
    }

    // Capacity check.
    if lobby.current_players() >= lobby.max_players as usize {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": "Lobby is full" })),
        );
    }

    let join_token = Uuid::new_v4().to_string();
    lobby.connections.insert(
        body.player_id.clone(),
        LanConnection {
            player_id: body.player_id,
            display_name: body.display_name,
            join_token: join_token.clone(),
            tx: None,
        },
    );
    lobby.last_activity = now_secs();

    let response = JoinLobbyResponse {
        lobby_id: lobby.lobby_id.clone(),
        lobby_code: lobby.lobby_code.clone(),
        join_token,
    };

    (StatusCode::OK, Json(serde_json::json!(response)))
}

/// POST /mp/lobbies/:lobbyId/leave — remove a player from a lobby.
async fn leave_lobby(
    State(state): State<AppState>,
    Path(lobby_id): Path<String>,
    Json(body): Json<LeaveLobbyBody>,
) -> impl IntoResponse {
    let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
        state.registry.write().await;

    if let Some(lobby) = registry.get_mut(&lobby_id) {
        lobby.connections.remove(&body.player_id);
        lobby.last_activity = now_secs();

        // If the lobby is now empty, remove it.
        if lobby.connections.is_empty() {
            registry.remove(&lobby_id);
        }
    }

    (StatusCode::OK, Json(OkResponse { ok: true }))
}

/// GET /mp/discover — service discovery endpoint.
async fn discover(State(state): State<AppState>) -> impl IntoResponse {
    Json(DiscoverResponse {
        game: "recall-rogue",
        version: "0.1.0",
        host_name: state.host_name.clone(),
        port: state.port,
    })
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

/// GET /mp/ws?lobbyId=&playerId=&token= — WebSocket relay.
///
/// The relay is deliberately dumb: it validates the join token, sends the
/// connecting player a snapshot of the lobby's current player list, then
/// forwards every subsequent message to all OTHER connections in the lobby.
/// No message parsing or game logic happens here.
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> impl IntoResponse {
    // Validate token before upgrading.
    {
        let registry: tokio::sync::RwLockReadGuard<HashMap<String, LanLobby>> =
            state.registry.read().await;
        let Some(lobby) = registry.get(&query.lobby_id) else {
            return StatusCode::NOT_FOUND.into_response();
        };
        let Some(conn) = lobby.connections.get(&query.player_id) else {
            return StatusCode::UNAUTHORIZED.into_response();
        };
        if !constant_time_eq(conn.join_token.as_bytes(), query.token.as_bytes()) {
            return StatusCode::UNAUTHORIZED.into_response();
        }
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state, query))
}

/// Drive an accepted WebSocket connection.
async fn handle_socket(socket: WebSocket, state: AppState, query: WsQuery) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Register the sender half in the lobby.
    {
        let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
            state.registry.write().await;
        if let Some(lobby) = registry.get_mut(&query.lobby_id) {
            if let Some(conn) = lobby.connections.get_mut(&query.player_id) {
                conn.tx = Some(tx.clone());
            }

            // Send lobby snapshot to the newly connected player.
            let snapshot = build_lobby_snapshot(lobby);
            let _ = tx.send(snapshot);
            lobby.last_activity = now_secs();
        }
    }

    // Task: forward queued outbound messages to the WebSocket.
    let send_task = tokio::task::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let txt: axum::extract::ws::Message =
                axum::extract::ws::Message::Text(msg.into());
            if ws_tx.send(txt).await.is_err() {
                break;
            }
        }
    });

    // Drive inbound messages: relay each to all OTHER lobby members.
    while let Some(Ok(msg)) = ws_rx.next().await {
        let raw = match msg {
            Message::Text(t) => t.to_string(),
            Message::Binary(b) => {
                // Relay binary as-is (convert to string best-effort).
                String::from_utf8_lossy(&b).into_owned()
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) => continue,
        };

        // Parse the message type so we can intercept lobby-lifecycle messages
        // that need server-side transformation (matching Fastify behavior).
        let maybe_parsed: Option<serde_json::Value> = serde_json::from_str(&raw).ok();
        let msg_type = maybe_parsed
            .as_ref()
            .and_then(|v| v.get("type"))
            .and_then(|t| t.as_str())
            .unwrap_or("");

        let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
            state.registry.write().await;
        if let Some(lobby) = registry.get_mut(&query.lobby_id) {
            lobby.last_activity = now_secs();

            // Intercept lobby lifecycle messages that need server-side action
            // (matching Fastify behavior — not just dumb relay).

            // mp:lobby:leave — remove the connection before relaying.
            if msg_type == "mp:lobby:leave" {
                lobby.connections.remove(&query.player_id);
                if lobby.connections.is_empty() {
                    registry.remove(&query.lobby_id);
                    break; // lobby gone, close this socket
                }
            }

            // mp:lobby:join → rebroadcast as mp:lobby:player_joined
            // (the client listens for player_joined, not join — see gotchas.md 2026-04-13).
            let relay_msg = if msg_type == "mp:lobby:join" {
                let payload = maybe_parsed
                    .as_ref()
                    .and_then(|v| v.get("payload"))
                    .cloned()
                    .unwrap_or(serde_json::json!({}));
                serde_json::json!({
                    "type": "mp:lobby:player_joined",
                    "payload": payload,
                    "senderId": "server",
                    "timestamp": now_secs() * 1000,
                })
                .to_string()
            } else {
                raw.clone()
            };

            for (pid, conn) in &lobby.connections {
                if *pid != query.player_id {
                    if let Some(ref other_tx) = conn.tx {
                        let _ = other_tx.send(relay_msg.clone());
                    }
                }
            }
        }
    }

    // Connection closed — clean up (mirrors Fastify's leaveLobby behavior).
    {
        let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
            state.registry.write().await;
        if let Some(lobby) = registry.get_mut(&query.lobby_id) {
            // Remove the connection entirely (like Fastify's leaveLobby).
            lobby.connections.remove(&query.player_id);

            // Notify remaining players using the same format as Fastify's leaveLobby().
            let leave_msg = serde_json::json!({
                "type": "mp:lobby:leave",
                "payload": {
                    "playerId": query.player_id,
                },
                "senderId": "server",
                "timestamp": now_secs() * 1000,
            })
            .to_string();
            for conn in lobby.connections.values() {
                if let Some(ref other_tx) = conn.tx {
                    let _ = other_tx.send(leave_msg.clone());
                }
            }

            lobby.last_activity = now_secs();

            // If the lobby is now empty, remove it.
            if lobby.connections.is_empty() {
                registry.remove(&query.lobby_id);
            }
        }
    }

    send_task.abort();
}

/// Build a JSON snapshot matching the Fastify `mp:lobby:settings` format.
///
/// The client listens for `mp:lobby:settings` messages (not a custom type)
/// and expects the payload to contain `players` with `{ id, displayName,
/// isHost, isReady }` — matching `LobbyPlayer` in the TypeScript types.
fn build_lobby_snapshot(lobby: &LanLobby) -> String {
    let players: Vec<serde_json::Value> = lobby
        .connections
        .values()
        .map(|c| {
            serde_json::json!({
                "id": c.player_id,
                "displayName": c.display_name,
                "isHost": c.player_id == lobby.host_id,
                "isReady": false,
            })
        })
        .collect();

    serde_json::json!({
        "type": "mp:lobby:settings",
        "payload": {
            "lobbyId": lobby.lobby_id,
            "lobbyCode": lobby.lobby_code,
            "hostId": lobby.host_id,
            "hostName": lobby.host_name,
            "mode": lobby.mode,
            "visibility": lobby.visibility,
            "maxPlayers": lobby.max_players,
            "currentPlayers": lobby.current_players(),
            "status": "waiting",
            "houseRules": null,
            "contentSelection": null,
            "players": players,
        }
    })
    .to_string()
}

// ── Stale lobby pruner ────────────────────────────────────────────────────────

/// Spawns a background task that evicts idle lobbies every `PRUNE_INTERVAL_SECS`.
fn spawn_pruner(registry: Registry) {
    tokio::task::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(PRUNE_INTERVAL_SECS));
        loop {
            interval.tick().await;
            let cutoff = now_secs().saturating_sub(LOBBY_IDLE_TIMEOUT_SECS);
            let mut reg: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
                registry.write().await;
            let before = reg.len();
            reg.retain(|_, lobby| lobby.last_activity >= cutoff);
            let removed = before - reg.len();
            if removed > 0 {
                eprintln!("[LAN] Pruned {} stale lobby/lobbies", removed);
            }
        }
    });
}

// ── Router builder ────────────────────────────────────────────────────────────

fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        // Discovery
        .route("/mp/discover", get(discover))
        // Lobby REST
        .route("/mp/lobbies", post(create_lobby))
        .route("/mp/lobbies", get(list_lobbies))
        .route("/mp/lobbies/code/{code}", get(resolve_code))
        .route("/mp/lobbies/{lobbyId}/join", post(join_lobby))
        .route("/mp/lobbies/{lobbyId}/leave", post(leave_lobby))
        // WebSocket relay
        .route("/mp/ws", get(ws_handler))
        .layer(cors)
        .with_state(state)
}

// ── Tauri command types ───────────────────────────────────────────────────────

/// M1: Result returned by `lan_start_server`.
///
/// `localIps` contains only addresses traffic will actually route to:
/// - On a normal LAN bind: all non-loopback IPv4 addresses on this machine.
/// - On a localhost-only fallback: `["127.0.0.1"]` — and `warning` is set to
///   `"local-only"` so the UI can warn the player that remote peers cannot reach them.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanStartResult {
    pub port: u16,
    pub local_ips: Vec<String>,
    /// The actual URL other players should use to connect, e.g. `"http://192.168.1.42:19738"`.
    /// Reflects the first routable IP (not 0.0.0.0). Falls back to `"http://127.0.0.1:<port>"`.
    pub lan_server_url: String,
    /// Set to `"local-only"` when the server is only reachable from this machine
    /// (all NICs unavailable and we fell back to 127.0.0.1). `None` for normal LAN binds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanServerStatus {
    pub running: bool,
    pub port: Option<u16>,
}

// ── Global server handle ──────────────────────────────────────────────────────

struct LanServerHandle {
    shutdown_tx: oneshot::Sender<()>,
    port: u16,
}

// Use a std Mutex here — the handle is only touched by the Tauri commands
// which run briefly and never hold the lock across an await.
static LAN_SERVER: std::sync::Mutex<Option<LanServerHandle>> =
    std::sync::Mutex::new(None);

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Start the LAN relay server.
///
/// If already running, returns an error. Default port is 19738.
///
/// M1: Returns the actually-bound SocketAddr (not 0.0.0.0). If no routable NIC
/// is available and we fall back to 127.0.0.1, `localIps` contains only that
/// address and `warning` is set to `"local-only"`.
#[tauri::command]
pub async fn lan_start_server(port: Option<u16>) -> Result<LanStartResult, String> {
    let port = port.unwrap_or(DEFAULT_PORT);

    // Bail early if already running (check without holding lock across await).
    {
        let guard = LAN_SERVER.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("LAN server is already running".into());
        }
    }

    // M1: Collect routable IPs first, then decide what to bind and what to report.
    let routable_ips = collect_local_ips();
    let (bind_addr_str, reported_ips, warning) = if routable_ips.is_empty() {
        // No routable NIC found — fall back to loopback only.
        eprintln!("[LAN] No routable NIC found, falling back to 127.0.0.1 (local-only)");
        (
            format!("127.0.0.1:{}", port),
            vec!["127.0.0.1".to_string()],
            Some("local-only".to_string()),
        )
    } else {
        (
            format!("0.0.0.0:{}", port),
            routable_ips.clone(),
            None,
        )
    };

    let host_name = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "LAN Host".into());

    let registry: Registry = Arc::new(RwLock::new(HashMap::new()));
    spawn_pruner(Arc::clone(&registry));

    let app_state = AppState {
        registry,
        host_name,
        port,
    };

    let router = build_router(app_state);
    let addr: SocketAddr = bind_addr_str
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;

    // B1: Try the requested port first. On AddrInUse, retry once with port=0 so the
    // OS assigns a free port. Any other error (permission denied, no NIC) is returned
    // as-is — the TS side surfaces the full string in the error toast.
    let listener: tokio::net::TcpListener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => {
            eprintln!("[LAN] Bound on {}", addr);
            l
        }
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            eprintln!("[LAN] Port {} in use — retrying with OS-assigned port", port);
            // Build a fallback addr using the same host but port=0.
            let host = addr.ip();
            let fallback: SocketAddr = (host, 0u16).into();
            tokio::net::TcpListener::bind(fallback).await.map_err(|e2| {
                format!(
                    "Port {} is already in use and auto-assign also failed: {}",
                    port, e2
                )
            })?
        }
        Err(e) => {
            return Err(format!("Failed to bind port {}: {}", port, e));
        }
    };

    // M1: Read the actually-bound address from the OS (handles port=0 wildcard too).
    let actual_addr: SocketAddr = listener
        .local_addr()
        .map_err(|e| format!("Could not read bound address: {}", e))?;
    let actual_port = actual_addr.port();

    // M1: Build the UI-visible URL using the first routable IP (not 0.0.0.0).
    let display_ip = reported_ips.first().map(|s| s.as_str()).unwrap_or("127.0.0.1");
    let lan_server_url = format!("http://{}:{}", display_ip, actual_port);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // Spawn the server in the Tokio runtime that Tauri already provides.
    tokio::task::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap_or_else(|e| eprintln!("[LAN] Server error: {}", e));
        eprintln!("[LAN] Server stopped.");
    });

    {
        let mut guard = LAN_SERVER.lock().map_err(|e| e.to_string())?;
        *guard = Some(LanServerHandle {
            shutdown_tx,
            port: actual_port,
        });
    }

    eprintln!("[LAN] Server listening on {} (url: {}{})",
        actual_addr,
        lan_server_url,
        warning.as_deref().map(|w| format!(" [WARNING: {}]", w)).unwrap_or_default(),
    );
    // Extra — macOS Local Network permission hint.
    // On macOS, the OS may silently refuse the bind permission if the app was launched
    // before the system saw the bind attempt. The permission prompt may also not appear
    // if NSLocalNetworkUsageDescription is absent from Info.plist.
    #[cfg(target_os = "macos")]
    eprintln!("[LAN] NOTE: if guests cannot reach this host, verify macOS System Settings         -> Privacy & Security -> Local Network -> Recall Rogue is enabled (the permission         sheet may not appear if the app was launched before macOS saw the bind).");

    // F-self-probe: After the server binds, spawn a quick TCP connect against
    // our own routable IP:port. If this succeeds we know inbound TCP on that
    // port actually reaches our Axum router — any peer on the same subnet can
    // reach us too. If it fails, most likely the macOS/Windows firewall is
    // blocking inbound on port {actual_port} and the server is effectively
    // localhost-only. We log the result to debug.log so the player can see
    // why other machines can't find their game.
    let probe_ip = reported_ips.first().cloned().unwrap_or_else(|| "127.0.0.1".into());
    let probe_port = actual_port;
    tokio::task::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let target = format!("{}:{}", probe_ip, probe_port);
        match tokio::time::timeout(
            std::time::Duration::from_secs(2),
            tokio::net::TcpStream::connect(&target),
        ).await {
            Ok(Ok(_)) => {
                eprintln!("[LAN] self-probe OK — inbound TCP reachable at {}", target);
            }
            Ok(Err(e)) => {
                eprintln!(
                    "[LAN] self-probe FAILED — TCP connect to {} refused: {}. \
                     Firewall is likely blocking inbound on port {} — peers on the same subnet cannot reach this host.",
                    target, e, probe_port
                );
            }
            Err(_) => {
                eprintln!(
                    "[LAN] self-probe TIMEOUT — {} did not accept a TCP connection within 2 s. \
                     Firewall is likely blocking inbound on port {} — peers on the same subnet cannot reach this host.",
                    target, probe_port
                );
            }
        }
    });

    Ok(LanStartResult {
        port: actual_port,
        local_ips: reported_ips,
        lan_server_url,
        warning,
    })
}

/// Stop the LAN relay server gracefully.
#[tauri::command]
pub async fn lan_stop_server() -> Result<(), String> {
    let handle = {
        let mut guard = LAN_SERVER.lock().map_err(|e| e.to_string())?;
        guard.take()
    };

    match handle {
        None => Err("LAN server is not running".into()),
        Some(h) => {
            // Sending on a oneshot never blocks — safe to call from any context.
            let _ = h.shutdown_tx.send(());
            eprintln!("[LAN] Shutdown signal sent.");
            Ok(())
        }
    }
}

/// Return a list of non-loopback IPv4 addresses on this machine.
///
/// Exposed as a Tauri command so the UI can suggest which IP to share with
/// guests on the same LAN.
#[tauri::command]
pub fn lan_get_local_ips() -> Vec<String> {
    collect_local_ips()
}

/// Return current server status (running, bound port).
#[tauri::command]
pub fn lan_server_status() -> LanServerStatus {
    let guard = LAN_SERVER.lock().unwrap_or_else(|e| e.into_inner());
    match guard.as_ref() {
        None => LanServerStatus {
            running: false,
            port: None,
        },
        Some(h) => LanServerStatus {
            running: true,
            port: Some(h.port),
        },
    }
}

/// Probe a remote TCP endpoint to test reachability.
///
/// Guest clients can call this before attempting a full LAN lobby join to independently
/// verify whether the host's IP:port is reachable. Returns `"ok"` on success or a
/// human-readable reason string on failure.
///
/// Failure reasons returned via `Err(_)`:
///  - `"refused"` — TCP connection was actively refused (host port not listening)
///  - `"timeout"` — TCP handshake did not complete within `timeout_ms` milliseconds
///  - `"host_unreachable:<err>"` — OS-level routing failure (no route to host, etc.)
///
/// # Parameters
/// - `host`: IPv4/IPv6 address or hostname to probe
/// - `port`: TCP port number to connect to
/// - `timeout_ms`: Maximum milliseconds to wait for the connection (default 2000)
#[tauri::command]
pub async fn lan_tcp_probe(
    host: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    let timeout_duration = std::time::Duration::from_millis(timeout_ms.unwrap_or(2000));
    let target = format!("{}:{}", host, port);
    match tokio::time::timeout(
        timeout_duration,
        tokio::net::TcpStream::connect(&target),
    ).await {
        Ok(Ok(_)) => {
            eprintln!("[LAN] tcp_probe OK: {}", target);
            Ok("ok".to_string())
        }
        Ok(Err(e)) => {
            let reason = if e.kind() == std::io::ErrorKind::ConnectionRefused {
                "refused".to_string()
            } else {
                format!("host_unreachable:{}", e)
            };
            eprintln!("[LAN] tcp_probe FAILED: {} — {}", target, reason);
            Err(reason)
        }
        Err(_) => {
            eprintln!("[LAN] tcp_probe TIMEOUT: {}", target);
            Err("timeout".to_string())
        }
    }
}

// ── Network interface helpers ─────────────────────────────────────────────────

/// Enumerate non-loopback, non-link-local IPv4 addresses (routable LAN IPs).
fn collect_local_ips() -> Vec<String> {
    let mut ips: Vec<String> = Vec::new();

    // Primary IP from the local-ip-address crate.
    if let Ok(ip) = local_ip_address::local_ip() {
        ips.push(ip.to_string());
    }

    // On non-Windows platforms, also walk all adapters for machines with
    // multiple network interfaces (e.g. WiFi + Ethernet).
    #[cfg(not(target_os = "windows"))]
    {
        use std::net::IpAddr;
        if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
            for (_name, addr) in interfaces {
                if let IpAddr::V4(v4) = addr {
                    if !v4.is_loopback() && !v4.is_link_local() {
                        let s = v4.to_string();
                        if !ips.contains(&s) {
                            ips.push(s);
                        }
                    }
                }
            }
        }
    }

    ips
}
