/**
 * MP Lobby WebSocket Route — card-game multiplayer live session.
 *
 * Mounted at GET /mp/ws (registered at root level, not under a prefix).
 * Query params: lobbyId, playerId, token
 *
 * Protocol:
 *   On connect: validate joinToken → attachWebSocket → send mp:lobby:settings snapshot
 *   On message: route by type (ready, leave, settings, start, mode-specific relay)
 *   On close:   leaveLobby → broadcast mp:lobby:leave to remaining players
 *
 * This module is COMPLETELY SEPARATE from coopWs.ts (Phase-43 Miner/Scholar system).
 * Do not import from or mix with coopRoomService.ts.
 *
 * Ready-gate (MP-SWEEP-2026-04-23-C-002):
 *   mp:lobby:start is now gated by allPlayersReady(). If any non-host connection
 *   has lastKnownReady === false, the host receives error code NOT_ALL_READY and
 *   the game does not start. Ready bits reset to false when a new player joins.
 *
 * Lobby-start allowlist (MP-SWEEP-2026-04-23-H-003):
 *   The mp:lobby:start broadcast uses an explicit allowlist, NOT a spread of
 *   msg.payload. mode, houseRules, contentSelection are pulled from authoritative
 *   server-side lobby state. seed and deckId come from the host's payload but are
 *   type-checked (seed→number|null, deckId→string|undefined) so arbitrary keys are
 *   silently dropped. This closes the injection vector introduced by FIX-020
 *   (commit 14495f06b), which widened the spread to help guests receive all fields.
 */

import type { FastifyInstance } from 'fastify'
import {
  validateJoinToken,
  attachWebSocket,
  getLobby,
  leaveLobby,
  broadcast,
  updateLobbySettings,
  allPlayersReady,
  type WsHandle,
  type MultiplayerMode,
  type LobbyVisibility,
  type MpLobby,
} from '../services/mpLobbyRegistry.js'

// ── Message type constants ────────────────────────────────────────────────────

/** Prefixes for per-mode relay messages that are forwarded verbatim to other players. */
const RELAY_PREFIXES = ['mp:race:', 'mp:coop:', 'mp:duel:', 'mp:trivia:']

/** Returns true when a message type should be relayed without further processing. */
function isRelayType(type: string): boolean {
  return RELAY_PREFIXES.some(prefix => type.startsWith(prefix))
}

// ── Lobby snapshot helper ─────────────────────────────────────────────────────

/**
 * Build a sanitized lobby snapshot for the mp:lobby:settings broadcast.
 * Omits server-only fields (passwordHash, joinTokens, ws handles).
 *
 * The `players` array uses the client-side LobbyPlayer shape:
 *   { id, displayName, isHost, isReady, multiplayerRating }
 * — `id` matches LobbyPlayer.id (not `playerId`).
 *
 * `isReady` is now sourced from `conn.lastKnownReady` (issue MP-STEAM-20260422-069).
 * Previously hardcoded false, which made the third player joining after player 2
 * had readied see player 2 as not-ready until player 2 toggled again. The server
 * now remembers the last-known ready state per connection and replays it to late
 * joiners. The client's local readyMap still wins on Object.assign for its own
 * row, but other rows are now correct on first paint.
 *
 * `multiplayerRating` defaults to 1500 (issue MP-STEAM-20260422-068). Previously
 * absent from the payload entirely, which left players[i].multiplayerRating
 * undefined and broke any ELO display reading it before the next broadcast.
 */
function buildLobbySnapshot(lobbyId: string): object {
  const lobby = getLobby(lobbyId)
  if (!lobby) return {}
  return {
    lobbyId: lobby.lobbyId,
    lobbyCode: lobby.lobbyCode,
    hostId: lobby.hostId,
    hostName: lobby.hostName,
    mode: lobby.mode,
    visibility: lobby.visibility,
    maxPlayers: lobby.maxPlayers,
    currentPlayers: lobby.currentPlayers,
    houseRules: lobby.houseRules ?? null,
    contentSelection: lobby.contentSelection ?? null,
    fairnessRating: lobby.fairnessRating ?? null,
    status: lobby.status,
    players: [...lobby.connections.values()].map(c => ({
      id: c.playerId,           // matches client LobbyPlayer.id (not playerId)
      displayName: c.displayName,
      isHost: c.playerId === lobby.hostId,
      isReady: c.lastKnownReady,
      multiplayerRating: c.multiplayerRating,
    })),
  }
}

// ── Lobby-start payload allowlist (H-003) ─────────────────────────────────────

/**
 * Build the allowlisted mp:lobby:start broadcast payload (H-003 fix).
 *
 * Fields sourced from SERVER-SIDE lobby state (cannot be spoofed by the host):
 *   - lobbyId          — handler scope (validated at connect time)
 *   - mode             — lobby.mode
 *   - houseRules       — lobby.houseRules
 *   - contentSelection — lobby.contentSelection
 *
 * Fields sourced from the host's payload (but type-checked):
 *   - seed   — number|null  (host is the seed generator; no server-side storage)
 *   - deckId — string|undefined (not stored in MpLobby; host-supplied and trusted
 *              for the same reason: the host is already authenticated as lobby owner
 *              and the server has no independent deck registry to validate against)
 *
 * All other keys in msg.payload are silently dropped.
 *
 * Exported for unit testing (pure function, no Fastify/WS dependency).
 */
export function buildLobbyStartPayload(
  lobbyId: string,
  lobby: MpLobby | undefined,
  rawPayload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  // seed: host-supplied, coerced to number|null. The host generates the seed
  // client-side and it is not stored server-side. A null seed is a valid signal
  // (client falls back to a local seed) so we preserve it.
  const rawSeed = rawPayload?.['seed']
  const seed: number | null = typeof rawSeed === 'number' ? rawSeed : null

  // deckId: host-supplied, coerced to string|undefined. The server has no deck
  // registry, so we cannot validate the value — but we do enforce the type so
  // arbitrary objects cannot be injected via this slot.
  const rawDeckId = rawPayload?.['deckId']
  const deckId: string | undefined = typeof rawDeckId === 'string' ? rawDeckId : undefined

  const payload: Record<string, unknown> = {
    lobbyId,
    seed,
    // Pull authoritative fields from server-side lobby state, not from the client.
    mode: lobby?.mode ?? null,
    houseRules: lobby?.houseRules ?? null,
    contentSelection: lobby?.contentSelection ?? null,
  }

  // Only include deckId when the host actually supplied one (avoids adding an
  // explicit undefined key that the client would see as a missing field).
  if (deckId !== undefined) {
    payload['deckId'] = deckId
  }

  return payload
}

// ── Route registration ────────────────────────────────────────────────────────

/** Register the MP lobby WebSocket upgrade route at GET /mp/ws. */
export async function mpLobbyWsRoutes(app: FastifyInstance): Promise<void> {
  // The `ws` parameter is typed as `any` by @fastify/websocket when accessed
  // without its generic helper — same as in coopWs.ts. We proxy it through
  // our WsHandle interface for type safety inside the handler body.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.get('/mp/ws', { websocket: true }, (ws: any, req) => {
    const query = req.query as {
      lobbyId?: string
      playerId?: string
      token?: string
    }

    const lobbyId = query.lobbyId ?? ''
    const playerId = query.playerId ?? ''
    const token = query.token ?? ''

    // Build a WsHandle proxy so the rest of this handler is type-safe.
    const handle: WsHandle = {
      get readyState(): number { return (ws as { readyState: number }).readyState },
      send(data: string): void { (ws as { send(d: string): void }).send(data) },
      close(code?: number, reason?: string): void {
        (ws as { close(c?: number, r?: string): void }).close(code, reason)
      },
    }

    // ── Token validation ──────────────────────────────────────────────────────

    if (!lobbyId || !playerId || !token) {
      handle.send(JSON.stringify({
        type: 'error',
        payload: { code: 'MISSING_PARAMS', message: 'lobbyId, playerId, token are required' },
      }))
      handle.close(1008, 'Missing connection parameters')
      return
    }

    if (!validateJoinToken(lobbyId, playerId, token)) {
      handle.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_TOKEN', message: 'Join token is invalid or expired' },
      }))
      handle.close(1008, 'Invalid join token')
      return
    }

    // ── Attach socket ─────────────────────────────────────────────────────────

    const attached = attachWebSocket(lobbyId, playerId, handle)
    if (!attached) {
      handle.send(JSON.stringify({
        type: 'error',
        payload: { code: 'LOBBY_GONE', message: 'Lobby no longer exists' },
      }))
      handle.close(1011, 'Lobby not found')
      return
    }

    app.log.info(`[mpLobbyWs] player ${playerId} connected to lobby ${lobbyId}`)

    // ── Send initial state to the joining player ───────────────────────────────

    try {
      handle.send(JSON.stringify({
        type: 'mp:lobby:settings',
        payload: buildLobbySnapshot(lobbyId),
      }))
    } catch (err) {
      app.log.error({ err }, `[mpLobbyWs] failed to send initial snapshot to ${playerId}`)
    }

    // Notify all other players in the lobby that someone joined.
    const joinedLobby = getLobby(lobbyId)
    // Include multiplayerRating + isReady defaults so the client's
    // mp:lobby:player_joined handler inserts a complete player record.
    // Previously omitted multiplayerRating, leaving ELO display undefined
    // until the next broadcastSettings (issue MP-STEAM-20260422-068).
    const joinedConn = joinedLobby?.connections.get(playerId)
    broadcast(lobbyId, {
      type: 'mp:lobby:player_joined',
      payload: {
        playerId,
        displayName: joinedConn?.displayName ?? '',
        currentPlayers: joinedLobby?.currentPlayers ?? 0,
        isReady: joinedConn?.lastKnownReady ?? false,
        multiplayerRating: joinedConn?.multiplayerRating ?? 1500,
      },
    }, playerId)

    // ── Message handler ───────────────────────────────────────────────────────

    ws.on('message', (raw: Buffer) => {
      let msg: { type: string; payload?: Record<string, unknown>; senderId?: string; timestamp?: number }
      try {
        msg = JSON.parse(raw.toString())
      } catch (err) {
        app.log.warn({ err }, `[mpLobbyWs] non-JSON message from ${playerId}`)
        return
      }

      // Update connection activity timestamp.
      const lobby = getLobby(lobbyId)
      const conn = lobby?.connections.get(playerId)
      if (conn) conn.lastActivity = Date.now()
      if (lobby) lobby.lastActivity = Date.now()

      try {
        switch (msg.type) {

          // Player signals ready/unready.
          // FIX 069: persist last-known ready state on the connection so late
          // joiners get the correct value in the mp:lobby:settings snapshot.
          case 'mp:lobby:ready': {
            const ready = Boolean(msg.payload?.['ready'] ?? true)
            const readyLobby = getLobby(lobbyId)
            const readyConn = readyLobby?.connections.get(playerId)
            if (readyConn) readyConn.lastKnownReady = ready
            broadcast(lobbyId, {
              type: 'mp:lobby:ready',
              payload: { playerId, ready },
            })
            break
          }

          // Player explicitly leaves via WS message.
          case 'mp:lobby:leave': {
            leaveLobby(lobbyId, playerId)
            // leaveLobby handles broadcasting mp:lobby:leave + closing the handle.
            ws.close(1000, 'Player left')
            break
          }

          // Host updates lobby settings — broadcast updated snapshot to all.
          case 'mp:lobby:settings': {
            const currentLobby = getLobby(lobbyId)
            if (!currentLobby) break
            if (currentLobby.hostId !== playerId) {
              handle.send(JSON.stringify({
                type: 'error',
                payload: { code: 'NOT_HOST', message: 'Only the host can change settings' },
              }))
              break
            }

            const patch = msg.payload as {
              mode?: MultiplayerMode
              visibility?: LobbyVisibility
              passwordHash?: string
              maxPlayers?: number
              houseRules?: Record<string, unknown>
              contentSelection?: Record<string, unknown>
            }

            updateLobbySettings(lobbyId, playerId, patch)
            broadcast(lobbyId, {
              type: 'mp:lobby:settings',
              payload: buildLobbySnapshot(lobbyId),
            })
            break
          }

          // Host starts the game — enforce ready-gate before transitioning.
          // FIX MP-SWEEP-2026-04-23-C-002: reject start if any non-host guest
          // has not signaled ready via mp:lobby:ready. Previously the server
          // accepted any host-initiated start unconditionally, making the
          // client-side ready UI purely cosmetic.
          //
          // FIX MP-SWEEP-2026-04-23-H-003: broadcast payload uses an explicit
          // allowlist (buildLobbyStartPayload) instead of spreading msg.payload.
          // This closes the injection vector where a malicious host could inject
          // arbitrary mode/houseRules/contentSelection/deckId by including extra
          // keys in the mp:lobby:start message. The FIX-020 goal (guests receive
          // mode+deckId+houseRules+contentSelection) is preserved — those values
          // now come from authoritative server state (lobby.*) rather than the
          // untrusted client payload.
          case 'mp:lobby:start': {
            const currentLobby = getLobby(lobbyId)
            if (!currentLobby) break
            if (currentLobby.hostId !== playerId) {
              handle.send(JSON.stringify({
                type: 'error',
                payload: { code: 'NOT_HOST', message: 'Only the host can start the game' },
              }))
              break
            }
            if (!allPlayersReady(currentLobby)) {
              handle.send(JSON.stringify({
                type: 'error',
                payload: { code: 'NOT_ALL_READY', message: 'All players must be ready before starting' },
              }))
              break
            }
            updateLobbySettings(lobbyId, playerId, { status: 'in_game' })
            // Reset ready bits after the transition so a rematch requires
            // all players to re-ready. This also prevents stale ready state
            // from carrying over if the lobby is reused.
            for (const c of currentLobby.connections.values()) {
              c.lastKnownReady = false
            }
            broadcast(lobbyId, {
              type: 'mp:lobby:start',
              // H-003: allowlist — no spread of msg.payload. Unknown keys are dropped.
              payload: buildLobbyStartPayload(lobbyId, currentLobby, msg.payload),
            })
            break
          }

          // Per-mode relay: forward verbatim to all other players.
          default: {
            if (isRelayType(msg.type)) {
              broadcast(lobbyId, {
                type: msg.type,
                payload: msg.payload ?? {},
                senderId: playerId,
                timestamp: msg.timestamp ?? Date.now(),
              }, playerId)
            } else {
              app.log.debug(`[mpLobbyWs] unknown message type "${msg.type}" from ${playerId}`)
            }
            break
          }
        }
      } catch (err) {
        app.log.error({ err }, `[mpLobbyWs] error handling message type "${msg.type}" from ${playerId}`)
      }
    })

    // ── Close handler ─────────────────────────────────────────────────────────

    ws.on('close', () => {
      app.log.info(`[mpLobbyWs] player ${playerId} disconnected from lobby ${lobbyId}`)
      // FIX L-029: emit mp:lobby:peer_left BEFORE leaveLobby cleans up the
      // connection record. The Steam transport's P2PSessionConnectFail_t
      // callback fires the same payload from the Rust side; the Fastify
      // path now matches so client-side disconnect detection is sub-second
      // instead of relying on the ~30s JS ping/pong fallback.
      // leaveLobby still broadcasts mp:lobby:leave (a separate, explicit
      // "player chose to leave" signal) and tears down the record.
      const closingLobby = getLobby(lobbyId)
      if (closingLobby?.connections.has(playerId)) {
        try {
          broadcast(lobbyId, {
            type: 'mp:lobby:peer_left',
            payload: {
              playerId,
              reason: 'transport_close',
              timestamp: Date.now(),
            },
          }, playerId)
        } catch (err) {
          app.log.warn({ err }, `[mpLobbyWs] failed to broadcast peer_left for ${playerId}`)
        }
      }
      leaveLobby(lobbyId, playerId)
    })

    // ── Error handler ─────────────────────────────────────────────────────────

    ws.on('error', (err: Error) => {
      app.log.error({ err }, `[mpLobbyWs] socket error for player ${playerId} in lobby ${lobbyId}`)
      // The close event fires after an error — leaveLobby is called there.
    })
  })
}
