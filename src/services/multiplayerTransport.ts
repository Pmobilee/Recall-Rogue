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
 *   isTauriRuntime()     → SteamP2PTransport (Tauri IPC → Steamworks relay)
 *   otherwise            → WebSocketTransport (Fastify server)
 *
 * Singleton lifecycle:
 *   getMultiplayerTransport()   — creates lazily on first call
 *   destroyMultiplayerTransport() — disconnect + null the instance
 */

import { getLanServerUrls, isLanMode } from './lanConfigService';
import { rrLog } from './rrLog';
import {
  acceptP2PSession,
  getP2PConnectionState,
  getSessionError,
  getLobbyMembers,
  leaveSteamLobby,
  sendP2PMessage,
  startMessagePollLoop,
} from './steamNetworkingService';
import { setMpDebugState } from './mpDebugState';

// ── Platform helper ───────────────────────────────────────────────────────────

/**
 * Returns true if we are running inside a Tauri runtime.
 *
 * Uses a live check against window globals rather than the module-load-time
 * hasSteam snapshot from platformService so the result is always accurate at
 * call time. Mirrors the identical helper in steamNetworkingService.ts — kept
 * local intentionally while the live-check pattern is being validated in the
 * diagnostic build. Will consolidate into platformService once confirmed.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

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
  | 'mp:coop:player_died'
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
  // Peer connection lifecycle (H10)
  | 'mp:lobby:peer_left'
  | 'mp:lobby:peer_rejoined'
  // Lobby start ACK (H5)
  | 'mp:lobby:start_ack'
  // Workshop deck check (H16)
  | 'mp:workshop:deck_check'
  | 'mp:workshop:deck_check_ack'
  // Host moderation (L4)
  | 'mp:lobby:kick'
  | 'mp:lobby:vote_kick_start'
  | 'mp:lobby:vote_kick_vote'
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

// ── L4: Host-moderation payload types ────────────────────────────────────────

/**
 * Payload for `mp:lobby:kick`.
 *
 * Broadcast by the host to remove a specific player from the lobby.
 * The targeted player calls `leaveLobby()` on receipt if `targetPlayerId`
 * matches their own local player ID. Non-targeted peers update their local
 * lobby state to remove the player.
 *
 * Security: receivers MUST verify `issuedBy === host_player_id` before
 * acting — spoofed kicks from non-host peers are silently rejected.
 *
 * UI is post-MVP. See docs/mechanics/multiplayer.md "Host Moderation".
 */
export interface KickPayload {
  /** Steam ID / player UUID of the player being removed. */
  targetPlayerId: string;
  /** Human-readable reason shown to the kicked player (optional). */
  reason?: string;
  /** Player ID of the host who issued the kick — used for spoof-rejection. */
  issuedBy: string;
}

/**
 * Payload for `mp:lobby:vote_kick_start`.
 *
 * Stub — reserved for future vote-to-kick feature. No logic is wired.
 * A host or eligible player broadcasts this to open a vote against a target.
 */
export interface VoteKickStartPayload {
  targetPlayerId: string;
  initiatedBy: string;
}

/**
 * Payload for `mp:lobby:vote_kick_vote`.
 *
 * Stub — reserved for future vote-to-kick feature. No logic is wired.
 * Each eligible player casts their vote after a `vote_kick_start`.
 */
export interface VoteKickVotePayload {
  targetPlayerId: string;
  vote: 'yes' | 'no';
  voterId: string;
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
 * Maximum reconnect backoff delay in milliseconds.
 * Caps the exponential backoff so we keep trying for ~5 minutes at the plateau.
 */
const MAX_RECONNECT_DELAY_MS = 30_000;

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
 * Reconnect uses exponential backoff capped at MAX_RECONNECT_DELAY_MS (30s), with
 * up to 12 attempts — keeping the client trying for ~5 minutes before giving up.
 *
 * C2 fix: onerror now schedules a reconnect if attempts remain (was only onclose).
 * Double-scheduling is guarded by a pending timeout handle. A public reconnect()
 * method allows the UI to surface a manual "Retry" button after exhaustion.
 */
export class WebSocketTransport implements MultiplayerTransport {
  private ws: WebSocket | null = null;
  private state: TransportState = 'disconnected';
  private listeners: ListenerMap = new Map();
  private localId = '';
  private reconnectAttempts = 0;
  // H8: raised from 5 → 12 (keeps trying for ~5 minutes with 30s max delay)
  private readonly maxReconnectAttempts = 12;
  private readonly baseReconnectDelayMs = 1000;
  // C2: track the pending reconnect timeout handle to prevent double-scheduling
  private reconnectTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  // C2: stash the last-used url/localId so reconnect() can reuse them
  private lastUrl = '';
  private lastLocalId = '';

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
    // C2: cancel any pending reconnect timeout on explicit disconnect
    if (this.reconnectTimeoutHandle !== null) {
      clearTimeout(this.reconnectTimeoutHandle);
      this.reconnectTimeoutHandle = null;
    }
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

  /**
   * Manually trigger a reconnect attempt, resetting the backoff counter.
   *
   * Intended for UI "Retry" buttons shown after max reconnect attempts are
   * exhausted. Cancels any in-flight reconnect timeout before starting fresh.
   *
   * C2 fix: exposes reconnect as a public method so callers can surface a
   * manual retry path when the transport enters a permanent error state.
   */
  reconnect(): void {
    if (this.reconnectTimeoutHandle !== null) {
      clearTimeout(this.reconnectTimeoutHandle);
      this.reconnectTimeoutHandle = null;
    }
    this.reconnectAttempts = 0;
    if (this.lastUrl) {
      this.openSocket(this.lastUrl, this.lastLocalId);
    }
  }

  private openSocket(url: string, localId: string): void {
    // Stash for use by reconnect() and scheduleReconnect()
    this.lastUrl = url;
    this.lastLocalId = localId;
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        // Clear any pending reconnect timeout now that we're connected
        if (this.reconnectTimeoutHandle !== null) {
          clearTimeout(this.reconnectTimeoutHandle);
          this.reconnectTimeoutHandle = null;
        }
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

      // C2 fix: onerror previously only set state='error' without scheduling
      // a reconnect. If new WebSocket() itself throws inside openSocket (the
      // catch branch below), onerror never fires at all — state would stay
      // 'error' forever.  Now we schedule a reconnect from onerror too, so
      // a transient connection refusal still retries automatically.
      //
      // Guard: if onclose also fires after onerror (browsers deliver both),
      // scheduleReconnect is idempotent via the reconnectTimeoutHandle guard.
      this.ws.onerror = () => {
        this.state = 'error';
        this.scheduleReconnect(url, localId);
      };
    } catch {
      // new WebSocket() threw synchronously (rare; happens when the URL is
      // totally malformed or the platform blocks the constructor).
      this.state = 'error';
      this.scheduleReconnect(url, localId);
    }
  }

  /**
   * Schedule an exponential-backoff reconnect attempt.
   *
   * H8: delay is clamped to MAX_RECONNECT_DELAY_MS (30s) so we don't back off
   * to absurdly long intervals.  maxReconnectAttempts raised to 12 so the
   * client keeps trying for ~5 minutes before giving up.
   *
   * C2: the reconnectTimeoutHandle guard prevents double-scheduling when both
   * onerror and onclose fire for the same socket failure (common in browsers).
   */
  private scheduleReconnect(url: string, localId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    // C2: if a reconnect is already scheduled, don't pile on a second one
    if (this.reconnectTimeoutHandle !== null) return;
    this.reconnectAttempts++;
    // H8: clamp delay to MAX_RECONNECT_DELAY_MS
    const base = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    const delay = Math.min(base, MAX_RECONNECT_DELAY_MS);
    this.reconnectTimeoutHandle = setTimeout(() => {
      this.reconnectTimeoutHandle = null;
      this.openSocket(url, localId);
    }, delay);
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
 *   3. After the accept Promise resolves, starts the poll loop (16 ms / ~60 Hz)
 *      to pump Steam callbacks and drain the P2P message queue.
 *   opts is accepted for interface compatibility but ignored — Steam P2P has no
 *   join tokens or Fastify WS URLs.
 *
 * C1 fix: messages that arrive in the window between acceptP2PSession being
 * called and the poll loop starting are buffered in _preAcceptBuffer and
 * replayed once the poll loop is active.  This prevents packets sent by the
 * remote peer immediately after we call accept from being silently dropped.
 *
 * C4 fix: outbound messages sent while state is 'connecting' (before
 * acceptP2PSession resolves) are buffered in _preSendBuffer and flushed in the
 * same .then() handler that flushes the inbound buffer.  Before this fix, any
 * send() call during the connecting window was silently dropped — symmetric
 * with the inbound problem C1 solved.  The buffer is capped at 64 messages to
 * match Steam's internal per-channel queue size.
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
  // C1: buffer messages that arrive before acceptP2PSession resolves
  private _preAcceptBuffer: MultiplayerMessage[] = [];
  private _acceptSettled = false;
  // C4: buffer outbound messages sent while state is 'connecting' (before acceptP2PSession resolves)
  private _preSendBuffer: MultiplayerMessage[] = [];
  // F-bufferUntilConnect: buffer sends attempted BEFORE connect() is ever called.
  // Host side defers transport.connect until a peer is detected — any outbound
  // messages emitted during that window (e.g., host selects a deck seconds
  // before the guest arrives) were silently dropped before this buffer existed.
  private _preConnectBuffer: MultiplayerMessage[] = [];
  private static readonly _PRESEND_BUFFER_CAP = 64;
  // BUG6: Periodic 2000ms poll of getP2PConnectionState for the debug overlay while connected.
  private _sessionStatePollHandle: ReturnType<typeof setInterval> | null = null;

  private _setState(next: TransportState, reason: string): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    rrLog('mp:tx', 'state', { prev, next, reason, peerId: this.peerId });
    // BUG6: Publish every state transition to the debug overlay.
    setMpDebugState({
      transport: {
        state: next,
        peerId: this.peerId,
        preConnectBufferSize: this._preConnectBuffer.length,
        lastSendResult: null,
        lastError: reason !== 'connect() called' && next === 'error' ? reason : null,
      },
    });
  }

  /**
   * @param peerId  Remote player's 64-bit Steam ID as a string
   * @param localId Local player's 64-bit Steam ID as a string
   * @param opts    Accepted for interface compatibility — ignored by Steam P2P
   */
  connect(peerId: string, localId: string, _opts?: ConnectOpts): void {
    rrLog('mp:tx', 'connect called', { peerId, localId, currentState: this.state, queuedPreConnect: this._preConnectBuffer.length });
    if (this.state === 'connected') {
      rrLog('mp:tx', 'connect skipped — already connected');
      return;
    }
    this.peerId = peerId;
    this.localId = localId;
    this._setState('connecting', 'connect() called');
    this._preAcceptBuffer = [];
    this._preSendBuffer = [];
    this._acceptSettled = false;

    // C1 fix: accept the P2P session and start the poll loop only AFTER the
    // accept Promise resolves.  Messages that arrive during the handshake gap
    // are buffered and replayed once the poll loop is running.
    //
    // The poll loop callback routes to _handleRawMessage, which buffers during
    // 'connecting' state and flushes when we transition to 'connected'.
    acceptP2PSession(peerId)
      .then((ok) => {
        if (this.state !== 'connecting') {
          rrLog('mp:tx', 'accept resolved but state no longer connecting', { state: this.state });
          return;
        }
        // BUG3: acceptP2PSession now returns bool (Rust Result<bool,String>). false means the
        // zero-byte accept-send failed. Log it but still proceed to connected state — the
        // session_request_callback auto-accept + AUTO_RESTART_BROKEN_SESSION handles transients.
        if (!ok) {
          rrLog('mp:tx', 'acceptP2PSession returned false', { peerId });
        }
        this._setState('connected', 'acceptP2PSession resolved');
        this._acceptSettled = true;
        this.stopPollLoop = startMessagePollLoop((rawMsg) => {
          this._handleRawMessage(rawMsg.data);
        });
        // BUG6: Every 2000ms, poll getP2PConnectionState and publish to debug overlay.
        // Clear on disconnect(). This gives visibility into session health while connected.
        if (this._sessionStatePollHandle !== null) {
          clearInterval(this._sessionStatePollHandle);
        }
        const capturedPeerId = this.peerId;
        this._sessionStatePollHandle = setInterval(async () => {
          if (this.state !== 'connected') return;
          const sessionState = await getP2PConnectionState(capturedPeerId).catch(() => 'state=unknown');
          setMpDebugState({
            steam: {
              localSteamId: null,
              localPlayerId: this.localId,
              p2pConnectionState: sessionState,
              sessionState,
            },
          });
        }, 2000);
        // Replay any messages that arrived during the accept gap
        const buffered = this._preAcceptBuffer.splice(0);
        if (buffered.length) rrLog('mp:tx', 'flushing preAcceptBuffer', { count: buffered.length });
        for (const msg of buffered) {
          emitToListeners(this.listeners, msg.type, msg);
        }
        // C4: flush outbound messages that were queued while we were connecting
        const pendingSends = this._preSendBuffer.splice(0);
        if (pendingSends.length) rrLog('mp:tx', 'flushing preSendBuffer', { count: pendingSends.length });
        for (const pendingMsg of pendingSends) {
          sendP2PMessage(this.peerId!, JSON.stringify(pendingMsg)).catch((e) => {
            rrLog('mp:tx', 'pre-connect send failed', { type: pendingMsg.type, e: String(e) });
          });
        }
        // F-bufferUntilConnect: flush sends that were queued BEFORE connect() was
        // ever called (host side, while waiting for peer to join).
        const preConnect = this._preConnectBuffer.splice(0);
        if (preConnect.length) rrLog('mp:tx', 'flushing preConnectBuffer', { count: preConnect.length });
        for (const pendingMsg of preConnect) {
          // Update senderId now that we know localId.
          pendingMsg.senderId = this.localId;
          sendP2PMessage(this.peerId!, JSON.stringify(pendingMsg)).catch((e) => {
            rrLog('mp:tx', 'pre-connect-queue send failed', { type: pendingMsg.type, e: String(e) });
          });
        }
      })
      .catch((e) => {
        this._setState('error', `acceptP2PSession rejected: ${String(e)}`);
        this._acceptSettled = true;
        this._preAcceptBuffer = [];
        if (this._preSendBuffer.length > 0) {
          rrLog('mp:tx', 'connect failed — dropping preSendBuffer', { count: this._preSendBuffer.length });
          this._preSendBuffer = [];
        }
        if (this._preConnectBuffer.length > 0) {
          rrLog('mp:tx', 'connect failed — dropping preConnectBuffer', { count: this._preConnectBuffer.length });
          this._preConnectBuffer = [];
        }
      });
  }

  /**
   * Parse a raw JSON message string and either buffer it (if we're still in
   * the connecting/pre-accept window) or dispatch it immediately.
   *
   * C1: this is the single dispatch point for all incoming P2P data so the
   * buffer-vs-dispatch decision is in one place.
   */
  private _handleRawMessage(data: string): void {
    // BUG18: Zero-byte primers from session_request_callback auto-accept and
    // steam_prime_p2p_sessions are expected session-handshake messages, not bugs.
    // JSON.parse('') throws, so guard here before the try/catch to avoid
    // spurious console.warn noise for normal Steam P2P traffic.
    if (data.length === 0) {
      rrLog('mp:tx', 'recv zero-byte primer (ignored)');
      return;
    }
    let msg: MultiplayerMessage;
    try {
      msg = JSON.parse(data) as MultiplayerMessage;
    } catch (e) {
      console.warn('[SteamP2PTransport] malformed P2P message, dropping:', e, data.slice(0, 200));
      return;
    }
    if (!this._acceptSettled) {
      // Accept hasn't resolved yet — buffer to prevent message loss
      this._preAcceptBuffer.push(msg);
      rrLog('mp:tx', 'recv buffered (accept pending)', { type: msg.type });
      return;
    }
    rrLog('mp:tx', 'recv dispatched', { type: msg.type });
    emitToListeners(this.listeners, msg.type, msg);
  }

  send(type: MultiplayerMessageType, payload: Record<string, unknown>): void {
    const msg: MultiplayerMessage = {
      type,
      payload,
      timestamp: Date.now(),
      senderId: this.localId,
    };
    // F-bufferUntilConnect: when host has created a lobby but the peer-poll
    // hasn't fired yet, connect() has not been called so peerId is empty and
    // state is 'disconnected'. Buffer the message so it can be replayed once
    // the first peer arrives and connect() resolves.
    if (!this.peerId || this.state === 'disconnected') {
      if (this._preConnectBuffer.length >= SteamP2PTransport._PRESEND_BUFFER_CAP) {
        const dropped = this._preConnectBuffer.shift();
        rrLog('mp:tx', 'preConnectBuffer overflow, evicted oldest', { droppedType: dropped?.type });
      }
      this._preConnectBuffer.push(msg);
      rrLog('mp:tx', 'send queued in preConnectBuffer', { type, queue: this._preConnectBuffer.length });
      return;
    }
    if (this.state === 'connecting') {
      if (this._preSendBuffer.length >= SteamP2PTransport._PRESEND_BUFFER_CAP) {
        const dropped = this._preSendBuffer.shift();
        rrLog('mp:tx', 'preSendBuffer overflow, evicted oldest', { droppedType: dropped?.type });
      }
      this._preSendBuffer.push(msg);
      rrLog('mp:tx', 'send queued in preSendBuffer', { type, queue: this._preSendBuffer.length });
      return;
    }
    if (this.state !== 'connected') {
      rrLog('mp:tx', 'send dropped — transport in non-sendable state', { type, state: this.state });
      return;
    }
    rrLog('mp:tx', 'send dispatched', { type, peerId: this.peerId });
    this._sendWithRetry(msg);
  }

  /**
   * Send a message with up to 3 attempts (immediate, +200ms, +500ms).
   *
   * After each failed attempt, reads `getP2PConnectionState` to include connection
   * state context in the failure log. After 3 failures, fires `onDisconnect`-style
   * logging (no hard disconnect — Steam's relay handles reconnection).
   *
   * This retry loop exists to tolerate the brief ConnectFailed window that can
   * occur when the session is freshly established and NAT hole-punch is still
   * in progress. The combination of session_request_callback auto-accept +
   * AUTO_RESTART_BROKEN_SESSION send flag should eliminate most failures, but
   * the retry provides a final safety net.
   */
  private _sendWithRetry(msg: MultiplayerMessage, attempt: number = 0): void {
    sendP2PMessage(this.peerId, JSON.stringify(msg)).then(async (result) => {
      // BUG1/BUG2: sendP2PMessage now returns Promise<boolean>. Rust returns Ok(true) on success,
      // Ok(false) on steamworks-level failure (ConnectFailed, NoConnection, etc.) — this does NOT
      // throw, so the old .catch-only retry was dead code for these failures.
      if (result === false) {
        const delayMs = attempt === 0 ? 200 : 500;
        const connState = await getP2PConnectionState(this.peerId).catch(() => 'state=unknown');
        const sessionErr = await getSessionError(this.peerId).catch(() => null);
        if (attempt < 2) {
          rrLog('mp:tx', 'send retry (resolved-false)', { type: msg.type, attempt: attempt + 1, delayMs, connState, sessionErr });
          setTimeout(() => {
            if (this.state === 'connected' && this.peerId) {
              this._sendWithRetry(msg, attempt + 1);
            }
          }, delayMs);
        } else {
          rrLog('mp:tx', 'send exhausted retries (resolved-false)', { type: msg.type, peerId: this.peerId, connState, sessionErr });
        }
      }
      // result === true: success, nothing to do.
    }).catch(async (e) => {
      const errStr = String(e);
      const connState = await getP2PConnectionState(this.peerId).catch(() => 'state=unknown');
      const sessionErr = await getSessionError(this.peerId).catch(() => null);
      if (attempt < 2) {
        const delayMs = attempt === 0 ? 200 : 500;
        rrLog('mp:tx', 'send retry (throw)', { type: msg.type, attempt: attempt + 1, delayMs, connState, sessionErr, err: errStr });
        setTimeout(() => {
          if (this.state === 'connected' && this.peerId) {
            this._sendWithRetry(msg, attempt + 1);
          }
        }, delayMs);
      } else {
        rrLog('mp:tx', 'send exhausted retries (throw)', { type: msg.type, peerId: this.peerId, connState, sessionErr, err: errStr });
      }
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
    rrLog('mp:tx', 'disconnect called', { state: this.state, peerId: this.peerId });
    this.stopPollLoop?.();
    this.stopPollLoop = null;
    // BUG6: Clear session poll on disconnect so it doesn't fire after we're gone.
    if (this._sessionStatePollHandle !== null) {
      clearInterval(this._sessionStatePollHandle);
      this._sessionStatePollHandle = null;
    }
    this._preAcceptBuffer = [];
    this._preSendBuffer = []; // C4: drop any pending outbound sends on disconnect
    this._preConnectBuffer = []; // drop pre-connect queued sends
    this._acceptSettled = true; // prevent any in-flight connect from buffering further

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
  if (isTauriRuntime()) return new SteamP2PTransport();
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

// ── Steam P2P Session Reestablishment (H9) ────────────────────────────────────

/**
 * Attempt to reestablish a Steam P2P session after an app restart.
 *
 * On app start, if persistent lobby state was saved (lobbyId + peerSteamId),
 * call this function to check whether the local player is still a member of
 * that lobby and resume the P2P session if so.
 *
 * H9 fix: replaces the "session forever gone after restart" failure mode.
 * Without this, a Steam desktop player who alt-tabs and relaunches during a
 * co-op session would be stuck at the hub with no way back into the session.
 *
 * Checks lobby membership via getLobbyMembers() (existing IPC), then calls
 * acceptP2PSession + startMessagePollLoop on the provided SteamP2PTransport
 * instance.
 *
 * @param transport    - The SteamP2PTransport instance to reconnect
 * @param lobbyId      - The lobby the player was in (decimal string Steam ID)
 * @param peerSteamId  - The remote peer's Steam ID (decimal string)
 * @param localSteamId - The local player's Steam ID (decimal string)
 * @returns true if the session was successfully reestablished, false otherwise.
 *
 * Callers should persist lobbyId + peerSteamId to localStorage/save state on
 * session start and clear them on clean disconnect or run completion.
 *
 * TODO(reconnect): A dedicated Tauri command `steam_check_lobby_membership`
 * (stubbed below in src-tauri/src/steam.rs) would give an explicit membership
 * check without iterating the member list.  Until that command ships, we use
 * getLobbyMembers() which already exists. This is slightly heavier (fetches
 * all member data) but correct for V1 since lobbies are small (2–4 players).
 */
export async function reestablishSteamP2PSession(
  transport: SteamP2PTransport,
  lobbyId: string,
  peerSteamId: string,
  localSteamId: string,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    // Use existing getLobbyMembers IPC to check if we're still in the lobby.
    // If the lobby has expired or we were kicked, members will be empty or
    // won't include our Steam ID.
    const members = await getLobbyMembers(lobbyId);
    const peerStillPresent = members.some((m) => m.steamId === peerSteamId);
    if (!peerStillPresent) {
      console.warn('[SteamP2PTransport] reestablishSteamP2PSession: peer not in lobby anymore');
      return false;
    }
    // Reconnect: connect() handles acceptP2PSession + startMessagePollLoop
    transport.connect(peerSteamId, localSteamId);
    transport.setActiveLobby(lobbyId);
    return true;
  } catch (e) {
    console.warn('[SteamP2PTransport] reestablishSteamP2PSession failed:', e);
    return false;
  }
}


// ── H10: JS-side peer-left ping fallback ─────────────────────────────────────

/**
 * How often to send a ping to all known peers (ms).
 * Pragmatic fallback for detecting peer disconnection without server-side
 * or Rust-callback involvement. See docs/mechanics/multiplayer.md — H10.
 */
const PEER_PING_INTERVAL_MS = 15_000;

/**
 * How long without a pong response before declaring a peer as disconnected.
 * Must be > PEER_PING_INTERVAL_MS to allow at least one missed pong before firing.
 */
const PEER_PONG_TIMEOUT_MS = 30_000;

/** Map from playerId → last-seen timestamp (epoch ms). */
const _peerLastSeen = new Map<string, number>();

/** Interval handle for the ping loop. */
let _peerPingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Stored cleanup function from the most recent initPeerPresenceMonitor() call.
 *
 * #75 double-init guard: when initPeerPresenceMonitor is called a second time
 * (e.g. a second createLobby / joinLobby on the same session), we call the
 * previous cleanup first so old ping/pong listeners are removed before new ones
 * are registered. Without this, each re-init accumulates duplicate listeners
 * and the pong handler fires multiple times per message.
 */
let _peerMonitorCleanup: (() => void) | null = null;

/**
 * Start a JS-side peer-presence monitoring loop.
 *
 * H10 PRAGMATIC FALLBACK: The correct architecture emits mp:lobby:peer_left from
 * the Fastify server (WebSocket onclose) or from a Rust P2PSessionConnectFail_t
 * callback. Both require invasive changes outside the JS layer. This fallback
 * implements the same observable behaviour entirely in JS:
 *
 *   1. Every PEER_PING_INTERVAL_MS (15s), we send mp:ping to all known peers.
 *   2. Each peer responds with mp:pong (wired by initPeerPresenceMonitor's pong handler).
 *   3. If a peer hasn't sent mp:pong within PEER_PONG_TIMEOUT_MS (30s) of our last
 *      ping, we emit mp:lobby:peer_left locally so multiplayerLobbyService can start
 *      the 60s reconnect grace timer.
 *   4. When a peer reconnects and sends any message (pong or otherwise), call
 *      updatePeerLastSeen(peerId) so the grace timer is cancelled by the lobby service.
 *
 * #75 double-init guard: if a previous monitor is running, its cleanup is called
 * first so ping/pong listeners do not accumulate across multiple inits. The new
 * cleanup is stored in _peerMonitorCleanup for subsequent re-inits.
 *
 * TODO(H10-transport): Replace with Fastify server-side broadcast on WS onclose and
 * Rust P2PSessionConnectFail_t callback once those plumbing changes ship.
 *
 * @param localPlayerId  - This player's ID (sender field on outgoing pings).
 * @param getPeerIds     - Callback returning the current list of peer player IDs.
 * @param transport      - The active transport to use for ping/pong messages.
 * @returns Cleanup function — call when leaving the lobby.
 */
export function initPeerPresenceMonitor(
  localPlayerId: string,
  getPeerIds: () => string[],
  transport: MultiplayerTransport,
): () => void {
  // #75 double-init guard: tear down any previous monitor before registering new listeners.
  if (_peerMonitorCleanup !== null) {
    _peerMonitorCleanup();
    _peerMonitorCleanup = null;
  }

  // Initialise last-seen for all current peers
  for (const peerId of getPeerIds()) {
    if (!_peerLastSeen.has(peerId)) {
      _peerLastSeen.set(peerId, Date.now());
    }
  }

  // Auto-respond to incoming pings so the remote peer's monitor can track us as alive.
  const unsubPing = transport.on('mp:ping', (msg) => {
    _peerLastSeen.set(msg.senderId, Date.now());
    transport.send('mp:pong', { to: msg.senderId });
  });

  // Update last-seen on receiving any pong from a peer.
  const unsubPong = transport.on('mp:pong', (msg) => {
    _peerLastSeen.set(msg.senderId, Date.now());
  });

  // Stop any pre-existing ping loop before starting a new one (interval guard).
  if (_peerPingInterval !== null) {
    clearInterval(_peerPingInterval);
    _peerPingInterval = null;
  }

  _peerPingInterval = setInterval(() => {
    const now = Date.now();
    const peers = getPeerIds();

    // Ping all known peers
    transport.send('mp:ping', { from: localPlayerId });

    // Check for stale peers (no pong within PEER_PONG_TIMEOUT_MS)
    for (const peerId of peers) {
      const lastSeen = _peerLastSeen.get(peerId) ?? now;
      if (now - lastSeen > PEER_PONG_TIMEOUT_MS) {
        // Peer hasn't responded — declare them disconnected.
        // Emit locally so the lobby service starts the 60s grace timer.
        console.warn(
          `[peerPresenceMonitor] No pong from ${peerId} in ${PEER_PONG_TIMEOUT_MS}ms — emitting peer_left`,
        );
        transport.send('mp:lobby:peer_left', { playerId: peerId });
        // Remove from last-seen so we don't spam peer_left every 15s.
        _peerLastSeen.delete(peerId);
      }
    }
  }, PEER_PING_INTERVAL_MS);

  const cleanup = () => {
    unsubPing();
    unsubPong();
    if (_peerPingInterval !== null) {
      clearInterval(_peerPingInterval);
      _peerPingInterval = null;
    }
    _peerLastSeen.clear();
    // Clear the stored reference so subsequent calls know there is no active monitor.
    if (_peerMonitorCleanup === cleanup) {
      _peerMonitorCleanup = null;
    }
  };

  // Store so the next initPeerPresenceMonitor call can tear this one down first.
  _peerMonitorCleanup = cleanup;

  return cleanup;
}

/**
 * Update the last-seen timestamp for a peer.
 * Call this whenever the lobby service receives any message from the peer,
 * including mp:lobby:peer_rejoined, to cancel a pending grace expiry.
 *
 * @param peerId - The peer's player ID.
 */
export function updatePeerLastSeen(peerId: string): void {
  _peerLastSeen.set(peerId, Date.now());
}
