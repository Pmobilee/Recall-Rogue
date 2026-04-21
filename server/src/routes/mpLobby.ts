/**
 * MP Lobby REST Routes — card-game multiplayer lobby management.
 *
 * Mounted under the `/mp` prefix in server/src/index.ts.
 *
 * This module is COMPLETELY SEPARATE from coop.ts (Phase-43 Miner/Scholar system).
 * Do not import from or mix with coopRoomService.ts.
 *
 * Routes:
 *   POST /mp/lobbies              — create a lobby (host)
 *   GET  /mp/lobbies              — list public lobbies (browser)
 *   GET  /mp/lobbies/code/:code   — resolve code → lobby info
 *   POST /mp/lobbies/:lobbyId/join  — join a lobby, receive joinToken for WS upgrade
 *   POST /mp/lobbies/:lobbyId/leave — leave a lobby
 */

import type { FastifyInstance } from 'fastify'
import {
  createLobby,
  joinLobby,
  findLobbyByCode,
  leaveLobby,
  listLobbies,
  getLobby,
  type LobbyBrowserEntry,
  type MultiplayerMode,
  type LobbyVisibility,
  type MpLobby,
} from '../services/mpLobbyRegistry.js'

// ── Title sanitisation ───────────────────────────────────────────────────────

/** Max length for lobby title (mirrors TITLE_MAX_LENGTH in profanityService.ts). */
const TITLE_MAX_LENGTH = 40

/**
 * Sanitize a lobby title server-side.
 * Mirrors profanityService.sanitizeLobbyTitle on the client — both enforce
 * the same invariants so the server guarantees clean storage even against
 * modded clients that skip client-side sanitization.
 */
function sanitizeLobbyTitle(title: string): string {
  if (!title) return ''
  // eslint-disable-next-line no-control-regex
  return title
    .replace(/[\x00-\x1F\x7F]/g, '')  // strip control characters
    .trim()
    .replace(/\s+/g, ' ')              // collapse internal whitespace
    .slice(0, TITLE_MAX_LENGTH)
}

// ── Serialisation helpers ─────────────────────────────────────────────────────

/**
 * Convert an MpLobby to the public-facing LobbyBrowserEntry shape.
 * Strips server-only fields (passwordHash, connections, joinTokens).
 */
function toEntry(lobby: MpLobby): LobbyBrowserEntry {
  return {
    lobbyId: lobby.lobbyId,
    hostName: lobby.hostName,
    mode: lobby.mode,
    currentPlayers: lobby.currentPlayers,
    maxPlayers: lobby.maxPlayers,
    visibility: lobby.visibility,
    fairnessRating: lobby.fairnessRating,
    title: lobby.title || undefined,
    createdAt: lobby.createdAt,
    source: 'web',
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

/** Register all MP lobby REST routes. Mounted with prefix '/mp' in index.ts. */
export async function mpLobbyRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /mp/lobbies ────────────────────────────────────────────────────────

  /**
   * Create a new lobby.
   * Body: { hostId, hostName, mode, visibility, passwordHash?, maxPlayers,
   *         houseRules?, contentSelection?, fairnessRating?, title? }
   * Returns: { lobbyId, lobbyCode, joinToken, hostConnection: { playerId, displayName } }
   */
  app.post('/lobbies', async (req, reply) => {
    const body = req.body as {
      hostId?: string
      hostName?: string
      mode?: string
      visibility?: string
      passwordHash?: string
      maxPlayers?: number
      houseRules?: Record<string, unknown>
      contentSelection?: Record<string, unknown>
      fairnessRating?: number
      title?: string
    }

    if (!body.hostId || !body.hostName || !body.mode || !body.visibility || !body.maxPlayers) {
      return reply.status(400).send({
        error: 'Missing required fields: hostId, hostName, mode, visibility, maxPlayers',
      })
    }

    const validModes: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']
    const validVisibilities: LobbyVisibility[] = ['public', 'password', 'friends_only']

    if (!validModes.includes(body.mode as MultiplayerMode)) {
      return reply.status(400).send({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` })
    }
    if (!validVisibilities.includes(body.visibility as LobbyVisibility)) {
      return reply.status(400).send({ error: `Invalid visibility. Must be one of: ${validVisibilities.join(', ')}` })
    }
    if (typeof body.maxPlayers !== 'number' || body.maxPlayers < 2 || body.maxPlayers > 8) {
      return reply.status(400).send({ error: 'maxPlayers must be a number between 2 and 8' })
    }
    if (body.visibility === 'password' && !body.passwordHash) {
      return reply.status(400).send({ error: 'passwordHash required when visibility is "password"' })
    }

    // C1: Sanitize title server-side — length clamp + control-char strip.
    // Protects against modded clients that skip client-side sanitization.
    const sanitizedTitle = body.title ? sanitizeLobbyTitle(body.title) : undefined

    const lobby = createLobby({
      hostId: body.hostId,
      hostName: body.hostName,
      mode: body.mode as MultiplayerMode,
      visibility: body.visibility as LobbyVisibility,
      passwordHash: body.passwordHash,
      maxPlayers: body.maxPlayers,
      houseRules: body.houseRules,
      contentSelection: body.contentSelection,
      fairnessRating: body.fairnessRating,
      title: sanitizedTitle || undefined,
    })

    const hostConn = lobby.connections.get(body.hostId)!
    return reply.status(201).send({
      lobbyId: lobby.lobbyId,
      lobbyCode: lobby.lobbyCode,
      joinToken: hostConn.joinToken,
      hostConnection: { playerId: body.hostId, displayName: body.hostName },
    })
  })

  // ── GET /mp/lobbies ─────────────────────────────────────────────────────────

  /**
   * List public/password-visible lobbies for the browser.
   * Query: ?mode=race&fullness=open
   * Returns: { lobbies: LobbyBrowserEntry[] }
   */
  app.get('/lobbies', async (req, reply) => {
    const query = req.query as { mode?: string; fullness?: string }

    const validModes: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']
    let modeFilter: MultiplayerMode | undefined
    if (query.mode) {
      if (!validModes.includes(query.mode as MultiplayerMode)) {
        return reply.status(400).send({ error: `Invalid mode filter. Must be one of: ${validModes.join(', ')}` })
      }
      modeFilter = query.mode as MultiplayerMode
    }

    const fullness = query.fullness === 'open' ? 'open' : 'any'

    const raw = listLobbies({ mode: modeFilter, fullness })
    return reply.send({ lobbies: raw.map(toEntry) })
  })

  // ── GET /mp/lobbies/code/:code ──────────────────────────────────────────────

  /**
   * Resolve a 6-char lobby code to basic lobby info (no secrets).
   * Returns: { lobbyId, lobbyCode, hostName, mode, currentPlayers, maxPlayers, visibility }
   */
  app.get('/lobbies/code/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const lobby = findLobbyByCode(code)
    if (!lobby) {
      return reply.status(404).send({ error: 'Code not found or lobby no longer open' })
    }
    return reply.send({
      lobbyId: lobby.lobbyId,
      lobbyCode: lobby.lobbyCode,
      hostName: lobby.hostName,
      mode: lobby.mode,
      currentPlayers: lobby.currentPlayers,
      maxPlayers: lobby.maxPlayers,
      visibility: lobby.visibility,
    })
  })

  // ── POST /mp/lobbies/:lobbyId/join ──────────────────────────────────────────

  /**
   * Join a lobby. Password-gated lobbies require the client-side SHA-256 hash.
   * Body: { playerId, displayName, password? }
   * Returns: { lobbyId, lobbyCode, joinToken }
   * Errors: 404 (not found), 403 (wrong password), 409 (full)
   */
  app.post('/lobbies/:lobbyId/join', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const body = req.body as {
      playerId?: string
      displayName?: string
      password?: string
    }

    if (!body.playerId || !body.displayName) {
      return reply.status(400).send({ error: 'playerId and displayName are required' })
    }

    // Verify the lobby exists first to give a meaningful 404 vs 403.
    const existing = getLobby(lobbyId)
    if (!existing) {
      return reply.status(404).send({ error: 'Lobby not found' })
    }

    const result = joinLobby(lobbyId, body.playerId, body.displayName, body.password)

    if ('error' in result) {
      if (result.error === 'Wrong password') {
        return reply.status(403).send({ error: result.error })
      }
      if (result.error === 'Lobby is full') {
        return reply.status(409).send({ error: result.error })
      }
      return reply.status(400).send({ error: result.error })
    }

    return reply.send({
      lobbyId: result.lobby.lobbyId,
      lobbyCode: result.lobby.lobbyCode,
      joinToken: result.joinToken,
    })
  })

  // ── POST /mp/lobbies/:lobbyId/leave ─────────────────────────────────────────

  /**
   * Leave a lobby (REST path — for when the WS is not yet open or was dropped).
   * Body: { playerId }
   * Returns: { ok: true }
   */
  app.post('/lobbies/:lobbyId/leave', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const body = req.body as { playerId?: string }

    if (!body.playerId) {
      return reply.status(400).send({ error: 'playerId is required' })
    }

    leaveLobby(lobbyId, body.playerId)
    return reply.send({ ok: true })
  })
}
