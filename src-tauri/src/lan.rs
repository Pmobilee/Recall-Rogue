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
        .filter(|l| l.visibility == "public")
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

        // Update activity timestamp and relay to others.
        let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
            state.registry.write().await;
        if let Some(lobby) = registry.get_mut(&query.lobby_id) {
            lobby.last_activity = now_secs();
            for (pid, conn) in &lobby.connections {
                if *pid != query.player_id {
                    if let Some(ref other_tx) = conn.tx {
                        let _ = other_tx.send(raw.clone());
                    }
                }
            }
        }
    }

    // Connection closed — clean up.
    {
        let mut registry: tokio::sync::RwLockWriteGuard<HashMap<String, LanLobby>> =
            state.registry.write().await;
        if let Some(lobby) = registry.get_mut(&query.lobby_id) {
            if let Some(conn) = lobby.connections.get_mut(&query.player_id) {
                conn.tx = None;
            }

            // Notify remaining players that this player disconnected.
            let leave_msg = serde_json::json!({
                "type": "player_left",
                "playerId": query.player_id,
            })
            .to_string();
            for (pid, conn) in &lobby.connections {
                if *pid != query.player_id {
                    if let Some(ref other_tx) = conn.tx {
                        let _ = other_tx.send(leave_msg.clone());
                    }
                }
            }

            lobby.last_activity = now_secs();
        }
    }

    send_task.abort();
}

/// Build a JSON snapshot of the lobby's current player list, sent on WS connect.
fn build_lobby_snapshot(lobby: &LanLobby) -> String {
    let players: Vec<serde_json::Value> = lobby
        .connections
        .values()
        .map(|c| {
            serde_json::json!({
                "playerId": c.player_id,
                "displayName": c.display_name,
                "connected": c.tx.is_some(),
            })
        })
        .collect();

    serde_json::json!({
        "type": "lobby_snapshot",
        "lobbyId": lobby.lobby_id,
        "lobbyCode": lobby.lobby_code,
        "hostId": lobby.host_id,
        "mode": lobby.mode,
        "maxPlayers": lobby.max_players,
        "players": players,
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
        .route("/mp/lobbies/code/:code", get(resolve_code))
        .route("/mp/lobbies/:lobbyId/join", post(join_lobby))
        .route("/mp/lobbies/:lobbyId/leave", post(leave_lobby))
        // WebSocket relay
        .route("/mp/ws", get(ws_handler))
        .layer(cors)
        .with_state(state)
}

// ── Tauri command types ───────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanStartResult {
    pub port: u16,
    pub local_ips: Vec<String>,
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
/// Returns the bound port and a list of local IPv4 addresses players can use.
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

    let local_ips = collect_local_ips();
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
    let addr: SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    let listener: tokio::net::TcpListener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

    let actual_port = listener
        .local_addr()
        .map(|a: SocketAddr| a.port())
        .unwrap_or(port);

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

    eprintln!("[LAN] Server listening on 0.0.0.0:{}", actual_port);

    Ok(LanStartResult {
        port: actual_port,
        local_ips,
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

// ── Network interface helpers ─────────────────────────────────────────────────

/// Enumerate non-loopback IPv4 addresses.
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
