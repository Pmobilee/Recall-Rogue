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
 */

import type { FastifyInstance } from 'fastify'
import {
  validateJoinToken,
  attachWebSocket,
  getLobby,
  leaveLobby,
  broadcast,
  updateLobbySettings,
  type WsHandle,
  type MultiplayerMode,
  type LobbyVisibility,
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
      playerId: c.playerId,
      displayName: c.displayName,
    })),
  }
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
    broadcast(lobbyId, {
      type: 'mp:lobby:player_joined',
      payload: {
        playerId,
        displayName: joinedLobby?.connections.get(playerId)?.displayName ?? '',
        currentPlayers: joinedLobby?.currentPlayers ?? 0,
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
          case 'mp:lobby:ready': {
            const ready = Boolean(msg.payload?.['ready'] ?? true)
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

          // Host starts the game — set status + broadcast.
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
            updateLobbySettings(lobbyId, playerId, { status: 'in_game' })
            broadcast(lobbyId, {
              type: 'mp:lobby:start',
              payload: { lobbyId, seed: msg.payload?.['seed'] ?? null },
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
      // leaveLobby handles broadcasting mp:lobby:leave to remaining players
      // and cleaning up the connection record. Safe to call even if already removed.
      leaveLobby(lobbyId, playerId)
    })

    // ── Error handler ─────────────────────────────────────────────────────────

    ws.on('error', (err: Error) => {
      app.log.error({ err }, `[mpLobbyWs] socket error for player ${playerId} in lobby ${lobbyId}`)
      // The close event fires after an error — leaveLobby is called there.
    })
  })
}
