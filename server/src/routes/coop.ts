/**
 * Co-op REST Routes — lobby management and matchmaking endpoints.
 *
 * Provides REST endpoints for lobby creation, joining, code lookup, and
 * quickmatch queue management. The live WebSocket session is handled by
 * coopWs.ts.
 */

import { FastifyInstance } from 'fastify'
import {
  createRoom,
  joinRoom,
  findRoomByCode,
  getRoom,
} from '../services/coopRoomService.js'

/** Legacy in-memory lobby state (kept for backwards compatibility). */
export interface CoopLobby {
  id: string
  hostId: string
  players: { id: string; name: string; ready: boolean }[]
  maxPlayers: number
  biomeId?: string
  depth?: number
  status: 'waiting' | 'starting' | 'in_progress' | 'completed'
  createdAt: string
}

/** Active legacy lobbies (in-memory for V1) */
const lobbies = new Map<string, CoopLobby>()

/** Quickmatch queue. */
const quickmatchQueue: { playerId: string; playerName: string; enqueuedAt: number }[] = []

export async function coopRoutes(app: FastifyInstance): Promise<void> {
  // ── Phase 43: Room Service Endpoints ───────────────────────────────────────

  // Create a Phase 43 room (Miner/Scholar co-op).
  app.post('/lobby/create', async (req, reply) => {
    const { hostId, hostName } = req.body as { hostId: string; hostName: string; maxPlayers?: number }
    if (!hostId || !hostName) return reply.status(400).send({ error: 'hostId and hostName required' })

    const room = createRoom(hostId, hostName)
    return reply.status(201).send({ lobby: { id: room.id, code: room.code, hostId: room.hostId, status: room.status, createdAt: new Date(room.createdAt).toISOString() } })
  })

  // Join a room by ID.
  app.post('/lobby/:lobbyId/join', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const { playerId, playerName } = req.body as { playerId: string; playerName: string }
    if (!playerId || !playerName) return reply.status(400).send({ error: 'playerId and playerName required' })

    const room = joinRoom(lobbyId, playerId, playerName)
    if (!room) return reply.status(404).send({ error: 'Room not found or no longer accepting players' })
    return reply.send({ roomId: room.id, role: 'scholar', code: room.code })
  })

  // Find a room by 6-character invite code (for sharing).
  app.get('/lobby/code/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const room = findRoomByCode(code)
    if (!room) return reply.status(404).send({ error: 'Code not found or lobby no longer open' })
    return reply.send({ roomId: room.id, code: room.code, hostName: room.slots[0]?.displayName ?? '' })
  })

  // Get room status by ID.
  app.get('/lobby/:lobbyId', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const room = getRoom(lobbyId)
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    return reply.send({
      roomId: room.id,
      code: room.code,
      status: room.status,
      slots: room.slots.map(s => s ? { playerId: s.playerId, displayName: s.displayName, role: s.role, connected: s.connected } : null),
    })
  })

  // ── Phase 43: Quickmatch Queue ─────────────────────────────────────────────

  // Quickmatch queue: add self, return matched roomId or 'queued'.
  app.post('/quickmatch/join', async (req, reply) => {
    const { playerId, playerName } = req.body as { playerId: string; playerName: string }
    if (!playerId || !playerName) return reply.status(400).send({ error: 'playerId and playerName required' })

    // Check if there is already someone waiting.
    const waiting = quickmatchQueue.find(e => e.playerId !== playerId)
    if (waiting) {
      // Match found: create a room, remove waiter from queue.
      quickmatchQueue.splice(quickmatchQueue.indexOf(waiting), 1)
      const room = createRoom(waiting.playerId, waiting.playerName)
      joinRoom(room.id, playerId, playerName)
      return reply.send({ matched: true, roomId: room.id })
    }

    // No match — add to queue (replace existing entry for this player).
    const existingIdx = quickmatchQueue.findIndex(e => e.playerId === playerId)
    if (existingIdx >= 0) quickmatchQueue.splice(existingIdx, 1)
    quickmatchQueue.push({ playerId, playerName, enqueuedAt: Date.now() })

    // Expire queue entries older than 60 s.
    const cutoff = Date.now() - 60_000
    quickmatchQueue.splice(0, quickmatchQueue.length, ...quickmatchQueue.filter(e => e.enqueuedAt > cutoff))

    return reply.send({ matched: false, queueLength: quickmatchQueue.length })
  })

  // Leave the quickmatch queue.
  app.post('/quickmatch/leave', async (req, reply) => {
    const { playerId } = req.body as { playerId: string }
    const idx = quickmatchQueue.findIndex(e => e.playerId === playerId)
    if (idx >= 0) quickmatchQueue.splice(idx, 1)
    return reply.send({ ok: true })
  })

  // ── Legacy Lobby Endpoints (kept for backwards compatibility) ──────────────

  // Leave a lobby.
  app.post('/lobby/:lobbyId/leave', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const { playerId } = req.body as { playerId: string }
    const lobby = lobbies.get(lobbyId)
    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' })

    lobby.players = lobby.players.filter(p => p.id !== playerId)
    if (lobby.players.length === 0) {
      lobbies.delete(lobbyId)
      return reply.send({ disbanded: true })
    }
    if (lobby.hostId === playerId) {
      lobby.hostId = lobby.players[0].id
    }
    return reply.send({ lobby })
  })

  // Set ready.
  app.post('/lobby/:lobbyId/ready', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const { playerId, ready } = req.body as { playerId: string; ready: boolean }
    const lobby = lobbies.get(lobbyId)
    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' })

    const player = lobby.players.find(p => p.id === playerId)
    if (!player) return reply.status(400).send({ error: 'Not in lobby' })
    player.ready = ready
    return reply.send({ lobby })
  })

  // List open lobbies.
  app.get('/lobbies', async (_req, reply) => {
    const openLobbies = [...lobbies.values()].filter(l => l.status === 'waiting' && l.players.length < l.maxPlayers)
    return reply.send({ lobbies: openLobbies })
  })
}
