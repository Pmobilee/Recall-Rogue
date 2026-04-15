/**
 * Transport-agnostic multiplayer messaging layer.
 *
 * Abstracts over WebSocket (for web/mobile), Steam P2P (for desktop), and
 * local in-memory messaging (for same-screen multiplayer).
 * The multiplayer game logic uses this interface exclusively — it never
 * touches wsClient or steamNetworkingService directly.
 *
 * Platform selection at factory time:
 *   mode === 'local'     → LocalMultiplayerTransport (in-memory, no networking)
 *   mode === 'broadcast' → BroadcastChannelTransport (two-tab, same origin)
 *   hasSteam === true    → SteamP2PTransport (Tauri IPC → Steamworks relay)
 *   hasSteam === false   → WebSocketTransport (Fastify server)
 *
 * Singleton lifecycle:
 *   getMultiplayerTransport()   — creates lazily on first call
 *   destroyMultiplayerTransport() — disconnect + null the instance
 */

import { hasSteam } from './platformService';
import { getLanServerUrls, isLanMode } from './lanConfigService';
import {
  acceptP2PSession,
  leaveSteamLobby,
  sendP2PMessage,
  startMessagePollLoop,
} from './steamNetworkingService';

// ── WebSocket URL Configuration ───────────────────────────────────────────────

/**
 * Default WebSocket URL for the Fastify MP lobby registry.
 * Overridden in production via VITE_MP_WS_URL env var.
 */
const DEFAULT_MP_WS_URL = 'ws://localhost:3000/mp/ws';

// ── Message Types ─────────────────────────────────────────────────────────────

export type MultiplayerMessageType =
  // Lobby lifecycle
  | 'mp:lobby:join'
  | 'mp:lobby:leave'
  | 'mp:lobby:ready'
  | 'mp:lobby:start'
  | 'mp:lobby:settings'
  | 'mp:lobby:deck_select'
  | 'mp:lobby:members'
  // Race Mode
  | 'mp:race:progress'
  | 'mp:race:finish'
  | 'mp:race:results'
  // Real-Time Duel
  | 'mp:duel:turn_start'
  | 'mp:duel:cards_played'
  | 'mp:duel:quiz_result'
  | 'mp:duel:turn_resolve'
  | 'mp:duel:enemy_state'
  | 'mp:duel:end'
  // Co-op
  | 'mp:coop:turn_start'
  | 'mp:coop:cards_played'
  | 'mp:coop:quiz_result'
  | 'mp:coop:turn_resolve'
  | 'mp:coop:enemy_state'
  | 'mp:coop:partner_state'
  | 'mp:coop:turn_end'
  | 'mp:coop:turn_end_cancel'
  | 'mp:coop:turn_end_with_delta'
  | 'mp:coop:enemy_hp_update'
  // Map node consensus (all multiplayer modes that share a map)
  | 'mp:map:node_pick'
  // Trivia Night
  | 'mp:trivia:question'
  | 'mp:trivia:answer'
  | 'mp:trivia:scores'
  | 'mp:trivia:end'
  // Workshop
  | 'mp:workshop:vote_submit'
  | 'mp:workshop:vote_result'
  // System
  | 'mp:ping'
  | 'mp:pong'
  | 'mp:error'
  | 'mp:sync';

export interface MultiplayerMessage {
  type: MultiplayerMessageType;
  payload: Record<string, unknown>;
  timestamp: number;
  senderId: string;
}

// ── Transport State ───────────────────────────────────────────────────────────

export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Connect Options ───────────────────────────────────────────────────────────

/**
 * Optional parameters for transport.connect().
 * Used by WebSocketTransport to build the Fastify WS URL with lobby metadata.
 * Other transports accept but ignore these options (interface compatibility).
 */
export interface ConnectOpts {
  /** Lobby ID to include as a query param on the WS upgrade URL (web path only). */
  lobbyId?: string;
  /** Short-lived join token returned by POST /mp/lobbies/:id/join (web path only). */
  joinToken?: string;
}

// ── Transport Interface ───────────────────────────────────────────────────────

export interface MultiplayerTransport {
  /**
   * Connect to a peer or server.
   *
   * For WebSocketTransport, `target` is the lobby ID (used as the `lobbyId`
   * query param) and `localId` is the player's ID. `opts.joinToken` is appended
   * as the `token` query param for the Fastify WS upgrade authentication.
   * The base URL is read from `import.meta.env.VITE_MP_WS_URL` (falls back to
   * `ws://localhost:3000/mp/ws`).
   *
   * For SteamP2PTransport, `target` is the remote player's 64-bit Steam ID
   * (as string) and `localId` is the local player's Steam ID. `opts` is ignored.
   *
   * For LocalMultiplayerTransport, `target` is ignored (no network target
   * exists) and `localId` identifies this player's side (e.g. 'player1').
   * `opts` is ignored.
   *
   * For BroadcastChannelTransport, `target` is the lobby ID or lobby code
   * (used as the BroadcastChannel name) and `localId` is this tab's unique
   * player ID. `opts` is ignored.
   */
  connect(target: string, localId: string, opts?: ConnectOpts): void;

  /** Send a typed multiplayer message. No-op if not connected. */
  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void;

  /**
   * Subscribe to a specific message type.
   * Returns an unsubscribe function — call it to remove the listener.
   */
  on(type: string, callback: (msg: MultiplayerMessage) => void): () => void;

  /** Disconnect and release all resources. */
  disconnect(): void;

  /** Get current connection state. */
  getState(): TransportState;

  /** Returns true when state is 'connected'. */
  isConnected(): boolean;
}

// ── Listener map helper ───────────────────────────────────────────────────────

type ListenerMap = Map<string, ((msg: MultiplayerMessage) => void)[]>;

function addListener(
  map: ListenerMap,
  type: string,
  callback: (msg: MultiplayerMessage) => void,
): () => void {
  if (!map.has(type)) map.set(type, []);
  map.get(type)!.push(callback);
  return () => {
    const list = map.get(type);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    }
  };
}

function emitToListeners(map: ListenerMap, type: string, msg: MultiplayerMessage): void {
  const list = map.get(type);
  if (list) list.forEach(cb => cb(msg));
}

// ── WebSocket Transport ───────────────────────────────────────────────────────

/**
 * WebSocket-based transport for web/mobile multiplayer.
 * Messages are routed through the Fastify MP lobby registry server.
 *
 * connect(lobbyId, localId, opts?):
 *   Reads the base URL from `import.meta.env.VITE_MP_WS_URL` (fallback:
 *   `ws://localhost:3000/mp/ws`). Builds the final URL as:
 *     `${base}?lobbyId=${lobbyId}&playerId=${localId}&token=${joinToken}`
 *   The `token` param is the short-lived join token from POST /mp/lobbies/:id/join.
 *
 * Reconnect uses exponential backoff capped at 5 attempts.
 */
export class WebSocketTransport implements MultiplayerTransport {
  private ws: WebSocket | null = null;
  private state: TransportState = 'disconnected';
  private listeners: ListenerMap = new Map();
  private localId = '';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelayMs = 1000;

  /**
   * Connect to the Fastify MP WebSocket endpoint.
   *
   * @param lobbyId - The lobby to join (used as the `lobbyId` query param).
   *                  For legacy callers passing a full URL, that URL is used
   *                  as-is for backwards compatibility.
   * @param localId - This player's ID (used as the `playerId` query param).
   * @param opts    - Optional join token and lobby ID override.
   */
  connect(lobbyId: string, localId: string, opts?: ConnectOpts): void {
    // Avoid double-connecting
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.localId = localId;
    this.state = 'connecting';

    // Build the full WS URL from the env-configured base URL + query params.
    // VITE_MP_WS_URL is set by the build environment; in dev it falls back to
    // DEFAULT_MP_WS_URL so developers can run the Fastify server locally without
    // any env setup.
    const lanUrls = getLanServerUrls();
    const base = lanUrls?.wsUrl ??
      ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_MP_WS_URL) ||
      DEFAULT_MP_WS_URL);

    // Use opts.lobbyId if provided (joinLobbyById path), otherwise use the
    // target argument (createLobby / joinLobby paths pass the lobbyId directly).
    const resolvedLobbyId = opts?.lobbyId ?? lobbyId;
    const params = new URLSearchParams({ lobbyId: resolvedLobbyId, playerId: localId });
    if (opts?.joinToken) params.set('token', opts.joinToken);

    const fullUrl = `${base}?${params.toString()}`;
    this.openSocket(fullUrl, localId);
  }

  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: MultiplayerMessage = {
      type,
      payload,
      timestamp: Date.now(),
      senderId: this.localId,
    };
    this.ws.send(JSON.stringify(msg));
  }

  on(type: string, callback: (msg: MultiplayerMessage) => void): () => void {
    return addListener(this.listeners, type, callback);
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = 'disconnected';
    this.listeners.clear();
  }

  getState(): TransportState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  private openSocket(url: string, localId: string): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as MultiplayerMessage;
          emitToListeners(this.listeners, msg.type, msg);
        } catch {
          // Ignore malformed messages from server
        }
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.scheduleReconnect(url, localId);
      };

      this.ws.onerror = () => {
        this.state = 'error';
      };
    } catch {
      this.state = 'error';
    }
  }

  private scheduleReconnect(url: string, localId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => this.openSocket(url, localId), delay);
  }
}

// ── Steam P2P Transport ───────────────────────────────────────────────────────

/**
 * Steam P2P transport for desktop multiplayer.
 * Messages travel directly peer-to-peer via Valve's relay network (no game server
 * required for data; lobby server still used for matchmaking/metadata).
 *
 * connect(peerId, localId, opts?):
 *   1. Stores the remote peer's Steam ID
 *   2. Calls acceptP2PSession(peerId) to allow incoming messages from them
 *   3. Starts the poll loop (16 ms / ~60 Hz) to pump Steam callbacks and drain
 *      the P2P message queue
 *   opts is accepted for interface compatibility but ignored — Steam P2P has no
 *   join tokens or Fastify WS URLs.
 *
 * The poll loop's onMessage callback parses each raw SteamP2PMessage as a
 * MultiplayerMessage (JSON) and routes it to registered listeners by type.
 *
 * No reconnect logic — Steam's relay layer handles transient connectivity.
 */
export class SteamP2PTransport implements MultiplayerTransport {
  private peerId = '';
  private localId = '';
  private currentLobbyId: string | null = null;
  private state: TransportState = 'disconnected';
  private listeners: ListenerMap = new Map();
  private stopPollLoop: (() => void) | null = null;

  /**
   * @param peerId  Remote player's 64-bit Steam ID as a string
   * @param localId Local player's 64-bit Steam ID as a string
   * @param opts    Accepted for interface compatibility — ignored by Steam P2P
   */
  connect(peerId: string, localId: string, _opts?: ConnectOpts): void {
    if (this.state === 'connected') return;
    this.peerId = peerId;
    this.localId = localId;
    this.state = 'connecting';

    // Accept incoming P2P session from remote peer, then start poll loop.
    // acceptP2PSession is async but we don't block connect() on it —
    // the poll loop will start receiving once the session handshake completes.
    acceptP2PSession(peerId)
      .then(() => {
        if (this.state !== 'connecting') return; // disconnected before handshake
        this.state = 'connected';
        this.stopPollLoop = startMessagePollLoop((rawMsg) => {
          try {
            const msg = JSON.parse(rawMsg.data) as MultiplayerMessage;
            emitToListeners(this.listeners, msg.type, msg);
          } catch {
            // Ignore malformed P2P messages
          }
        });
      })
      .catch(() => {
        this.state = 'error';
      });
  }

  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void {
    if (this.state !== 'connected' || !this.peerId) return;
    const msg: MultiplayerMessage = {
      type,
      payload,
      timestamp: Date.now(),
      senderId: this.localId,
    };
    // sendP2PMessage is fire-and-forget at the transport level.
    // Callers that need delivery guarantees must implement their own ACK logic.
    sendP2PMessage(this.peerId, JSON.stringify(msg)).catch((e) => {
      console.warn('[SteamP2PTransport] sendP2PMessage failed:', e);
    });
  }

  on(type: string, callback: (msg: MultiplayerMessage) => void): () => void {
    return addListener(this.listeners, type, callback);
  }

  /**
   * Stop the poll loop, leave the Steam lobby (if one was joined via
   * `setActiveLobby()`), and reset state.
   */
  disconnect(): void {
    this.stopPollLoop?.();
    this.stopPollLoop = null;

    if (this.currentLobbyId) {
      leaveSteamLobby(this.currentLobbyId).catch(() => {});
      this.currentLobbyId = null;
    }

    this.peerId = '';
    this.localId = '';
    this.state = 'disconnected';
    this.listeners.clear();
  }

  getState(): TransportState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Register the active lobby ID so `disconnect()` can call `leaveSteamLobby`
   * automatically. Call this after `createSteamLobby` / `joinSteamLobby`
   * returns a lobby ID.
   */
  setActiveLobby(lobbyId: string): void {
    this.currentLobbyId = lobbyId;
  }
}

// ── Local Multiplayer Transport ───────────────────────────────────────────────

/**
 * Local multiplayer transport for same-screen play.
 *
 * Both "players" are on the same device. Messages are delivered synchronously
 * through an in-memory event bus. No networking involved.
 *
 * Two instances are created (one per player) and linked via a shared message bus.
 * When Player 1's transport sends a message, Player 2's transport receives it
 * immediately (via queueMicrotask), and vice versa.
 *
 * Use case: Race Mode or Trivia Night on the same screen (split-screen or
 * hot-seat), where two people share a keyboard/controller.
 *
 * Setup:
 *   const [t1, t2] = createLocalTransportPair();
 *   t1.connect('', 'player1');
 *   t2.connect('', 'player2');
 */
export class LocalMultiplayerTransport implements MultiplayerTransport {
  private state: TransportState = 'disconnected';
  private listeners: ListenerMap = new Map();
  private localId: string = '';
  private peer: LocalMultiplayerTransport | null = null;

  /**
   * Link two local transports together so messages sent on one are delivered
   * to the other. Call this once during setup — before connect().
   *
   * Note: linkPeer is symmetric. You only need to call it on one instance;
   * the other side is wired automatically.
   */
  linkPeer(peer: LocalMultiplayerTransport): void {
    this.peer = peer;
    peer.peer = this;
  }

  /**
   * Mark this transport as connected. The `target` argument is unused for
   * local transport (there is no network target), but is kept for interface
   * compatibility. `opts` is also ignored.
   */
  connect(target: string, localId: string, _opts?: ConnectOpts): void {
    this.localId = localId;
    this.state = 'connected'; // Instantly connected — no networking
  }

  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void {
    if (!this.peer || this.state !== 'connected') return;
    const msg: MultiplayerMessage = {
      type,
      payload,
      timestamp: Date.now(),
      senderId: this.localId,
    };
    // Deliver to peer asynchronously via microtask to avoid synchronous call
    // stack depth issues when both sides exchange messages in tight loops.
    const target = this.peer;
    queueMicrotask(() => {
      target.deliverMessage(msg);
    });
  }

  /**
   * Internal: receive a message delivered by the linked peer's send().
   * Not part of the public MultiplayerTransport interface.
   */
  private deliverMessage(msg: MultiplayerMessage): void {
    emitToListeners(this.listeners, msg.type, msg);
  }

  on(type: string, callback: (msg: MultiplayerMessage) => void): () => void {
    return addListener(this.listeners, type, callback);
  }

  disconnect(): void {
    this.state = 'disconnected';
    this.listeners.clear();
    // Unlink the peer so the other side stops routing to this instance.
    // The peer's listeners and state are left intact — only the reference
    // back to us is cleared so it doesn't try to deliver messages here.
    if (this.peer) {
      this.peer.peer = null;
      this.peer = null;
    }
  }

  getState(): TransportState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }
}

/**
 * Create a pair of linked local transports for same-screen multiplayer.
 * Returns [player1Transport, player2Transport].
 *
 * Both transports are already linked — call connect() on each to make them
 * active, then register listeners before any messages are sent.
 *
 * Example:
 *   const [t1, t2] = createLocalTransportPair();
 *   t1.connect('', 'player1');
 *   t2.connect('', 'player2');
 *   t2.on('mp:race:progress', (msg) => { ... });
 *   t1.send('mp:race:progress', { floor: 2, score: 100 });
 */
export function createLocalTransportPair(): [LocalMultiplayerTransport, LocalMultiplayerTransport] {
  const t1 = new LocalMultiplayerTransport();
  const t2 = new LocalMultiplayerTransport();
  t1.linkPeer(t2);
  return [t1, t2];
}

// ── BroadcastChannel Transport ────────────────────────────────────────────────

/** Dev-mode simulated network latency range (ms). Mimics typical Steam relay RTT. */
const BC_MIN_LATENCY_MS = 30;
const BC_MAX_LATENCY_MS = 150;
/** Simulated packet loss rate (0–1). 0.02 = 2% chance any outbound message is dropped. */
const BC_PACKET_LOSS_RATE = 0.02;

/**
 * BroadcastChannel-based transport for two-tab local multiplayer.
 * Both tabs open on the same origin share a BroadcastChannel keyed on
 * the lobby code. Zero server required — works in any modern browser.
 *
 * Usage:
 *   Tab 1: createLobby → connect(lobbyId, localId)
 *   Tab 2: joinLobby(code) → connect(lobbyCode, localId)
 *   Messages broadcast to all other tabs on that channel.
 *
 * The channel name is prefixed with 'rr-mp:' to avoid collisions with other
 * BroadcastChannel users on the same origin.
 *
 * Self-echo prevention: messages include the sender's localId. When a message
 * arrives from the channel it is dropped if senderId === this.localId.
 *
 * Activate via URL param: ?mp — see multiplayerLobbyService.ts isBroadcastMode()
 *
 * Network simulation (dev-only): outbound messages are delayed 30–150 ms and
 * dropped with 2% probability to mimic Steam relay conditions. Inbound messages
 * receive an additional 5–20 ms of receive-side jitter. This makes two-tab
 * testing representative of real peer-to-peer network behaviour.
 *
 * opts is accepted for interface compatibility but ignored — BroadcastChannel
 * has no join tokens or Fastify WS URLs.
 */
export class BroadcastChannelTransport implements MultiplayerTransport {
  private state: TransportState = 'disconnected';
  private listeners: ListenerMap = new Map();
  private localId: string = '';
  private channel: BroadcastChannel | null = null;

  /**
   * Open a BroadcastChannel named `rr-mp:<target>`.
   * @param target Lobby ID (host) or lobby code (joiner) — both sides must use the same value
   * @param localId Unique ID for this tab's player — used to filter self-echo
   * @param opts   Accepted for interface compatibility — ignored
   */
  connect(target: string, localId: string, _opts?: ConnectOpts): void {
    this.localId = localId;
    const channelName = `rr-mp:${target}`;
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (ev: MessageEvent) => {
      const raw = ev.data as { type: string; payload: Record<string, unknown>; senderId: string; timestamp: number };
      // Ignore messages we sent ourselves — BroadcastChannel delivers to all
      // tabs INCLUDING the sender on some browser versions.
      if (raw.senderId === this.localId) return;
      const msg: MultiplayerMessage = {
        type: raw.type as MultiplayerMessageType,
        payload: raw.payload,
        timestamp: raw.timestamp,
        senderId: raw.senderId,
      };
      // Simulate receive-side jitter (5–20 ms) to mimic real network variance.
      const jitter = 5 + Math.random() * 15;
      setTimeout(() => {
        emitToListeners(this.listeners, msg.type, msg);
      }, jitter);
    };
    this.state = 'connected';
  }

  /**
   * Send a message with simulated network latency and packet loss.
   *
   * Each call has a BC_PACKET_LOSS_RATE chance of being silently dropped,
   * and is delayed by a random value in [BC_MIN_LATENCY_MS, BC_MAX_LATENCY_MS]
   * before postMessage is called. This keeps the channel's instant delivery
   * from masking timing bugs that would appear on a real Steam relay.
   */
  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void {
    if (!this.channel || this.state !== 'connected') return;
    const msg = {
      type,
      payload,
      senderId: this.localId,
      timestamp: Date.now(),
    };
    // Simulate packet loss
    if (Math.random() < BC_PACKET_LOSS_RATE) return;
    // Simulate network latency with jitter
    const delay = BC_MIN_LATENCY_MS + Math.random() * (BC_MAX_LATENCY_MS - BC_MIN_LATENCY_MS);
    const ch = this.channel;
    setTimeout(() => { ch.postMessage(msg); }, delay);
  }

  on(type: string, callback: (msg: MultiplayerMessage) => void): () => void {
    return addListener(this.listeners, type, callback);
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
    this.state = 'disconnected';
  }

  getState(): TransportState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create the appropriate transport for the current platform and mode.
 *
 * mode === 'local'     → LocalMultiplayerTransport (same-screen, no networking)
 * mode === 'broadcast' → BroadcastChannelTransport (two-tab, same origin, dev)
 * Steam desktop        → SteamP2PTransport (direct peer relay, no game server)
 * Web / mobile         → WebSocketTransport (Fastify WebSocket server)
 *
 * For local mode, the returned instance is NOT yet linked to a peer.
 * Use `createLocalTransportPair()` when you need both sides at once.
 */
export function createTransport(mode?: 'auto' | 'local' | 'broadcast'): MultiplayerTransport {
  if (mode === 'local') return new LocalMultiplayerTransport();
  if (mode === 'broadcast') return new BroadcastChannelTransport();
  if (isLanMode()) return new WebSocketTransport(); // LAN always uses WebSocket, even on Steam builds
  if (hasSteam) return new SteamP2PTransport();
  return new WebSocketTransport();
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Lazily-created transport instance. Null until first call to getMultiplayerTransport(). */
let _transport: MultiplayerTransport | null = null;

/**
 * Get the active multiplayer transport, creating it if this is the first call.
 * The transport type (WebSocket vs Steam P2P vs Local vs BroadcastChannel) is
 * determined by the current platform and the optional mode argument.
 *
 * Pass `mode: 'local'` for same-screen multiplayer — returns a standalone
 * LocalMultiplayerTransport (not linked to a peer). Use
 * `createLocalTransportPair()` to get a pre-linked pair instead.
 *
 * Pass `mode: 'broadcast'` for two-tab testing via BroadcastChannel.
 * Activated automatically by multiplayerLobbyService when `?mp` is in the URL.
 */
export function getMultiplayerTransport(mode?: 'auto' | 'local' | 'broadcast'): MultiplayerTransport {
  if (!_transport) _transport = createTransport(mode);
  return _transport;
}

/**
 * Disconnect the active transport and release the singleton.
 * Call this when the player exits multiplayer entirely (not just between matches).
 */
export function destroyMultiplayerTransport(): void {
  _transport?.disconnect();
  _transport = null;
}
