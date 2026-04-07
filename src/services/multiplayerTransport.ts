/**
 * Transport-agnostic multiplayer messaging layer.
 *
 * Abstracts over WebSocket (for web/mobile) and Steam P2P (for desktop).
 * The multiplayer game logic uses this interface exclusively — it never
 * touches wsClient or steamNetworkingService directly.
 *
 * Platform selection at factory time:
 *   hasSteam === true  → SteamP2PTransport (Tauri IPC → Steamworks relay)
 *   hasSteam === false → WebSocketTransport (Fastify server)
 *
 * Singleton lifecycle:
 *   getMultiplayerTransport()   — creates lazily on first call
 *   destroyMultiplayerTransport() — disconnect + null the instance
 */

import { hasSteam } from './platformService';
import {
  acceptP2PSession,
  leaveSteamLobby,
  sendP2PMessage,
  startMessagePollLoop,
} from './steamNetworkingService';

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
  // Trivia Night
  | 'mp:trivia:question'
  | 'mp:trivia:answer'
  | 'mp:trivia:scores'
  | 'mp:trivia:end'
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

// ── Transport Interface ───────────────────────────────────────────────────────

export interface MultiplayerTransport {
  /**
   * Connect to a peer or server.
   *
   * For WebSocketTransport, `target` is the WebSocket URL and `localId` is the
   * player's ID that will be appended as a query parameter.
   *
   * For SteamP2PTransport, `target` is the remote player's 64-bit Steam ID
   * (as string) and `localId` is the local player's Steam ID.
   */
  connect(target: string, localId: string): void;

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
 * Messages are routed through the Fastify game server.
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

  /** @param url WebSocket server URL (e.g. wss://game.example.com/mp) */
  connect(url: string, localId: string): void {
    // Avoid double-connecting
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.localId = localId;
    this.state = 'connecting';
    this.openSocket(url, localId);
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
      this.ws = new WebSocket(`${url}?playerId=${encodeURIComponent(localId)}`);

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
 * connect(peerId, localId):
 *   1. Stores the remote peer's Steam ID
 *   2. Calls acceptP2PSession(peerId) to allow incoming messages from them
 *   3. Starts the poll loop (16 ms / ~60 Hz) to pump Steam callbacks and drain
 *      the P2P message queue
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
   */
  connect(peerId: string, localId: string): void {
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

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create the appropriate transport for the current platform.
 *
 * Steam desktop → SteamP2PTransport (direct peer relay, no game server)
 * Web / mobile  → WebSocketTransport (Fastify WebSocket server)
 */
export function createTransport(): MultiplayerTransport {
  if (hasSteam) {
    return new SteamP2PTransport();
  }
  return new WebSocketTransport();
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Lazily-created transport instance. Null until first call to getMultiplayerTransport(). */
let _transport: MultiplayerTransport | null = null;

/**
 * Get the active multiplayer transport, creating it if this is the first call.
 * The transport type (WebSocket vs Steam P2P) is determined by the current platform.
 */
export function getMultiplayerTransport(): MultiplayerTransport {
  if (!_transport) _transport = createTransport();
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
