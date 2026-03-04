import { FastifyInstance } from 'fastify'

/** Co-op lobby state */
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

/** Active lobbies (in-memory for V1) */
const lobbies = new Map<string, CoopLobby>()

export async function coopRoutes(app: FastifyInstance): Promise<void> {
  // Create a lobby
  app.post('/lobby/create', async (req, reply) => {
    const { hostId, hostName, maxPlayers } = req.body as { hostId: string; hostName: string; maxPlayers?: number }
    if (!hostId || !hostName) return reply.status(400).send({ error: 'hostId and hostName required' })

    const lobby: CoopLobby = {
      id: `lobby-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hostId,
      players: [{ id: hostId, name: hostName, ready: true }],
      maxPlayers: Math.min(maxPlayers ?? 4, 4),
      status: 'waiting',
      createdAt: new Date().toISOString()
    }
    lobbies.set(lobby.id, lobby)
    return reply.status(201).send({ lobby })
  })

  // Join a lobby
  app.post('/lobby/:lobbyId/join', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const { playerId, playerName } = req.body as { playerId: string; playerName: string }
    const lobby = lobbies.get(lobbyId)
    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' })
    if (lobby.status !== 'waiting') return reply.status(400).send({ error: 'Lobby not accepting players' })
    if (lobby.players.length >= lobby.maxPlayers) return reply.status(400).send({ error: 'Lobby full' })
    if (lobby.players.some(p => p.id === playerId)) return reply.status(400).send({ error: 'Already in lobby' })

    lobby.players.push({ id: playerId, name: playerName, ready: false })
    return reply.send({ lobby })
  })

  // Leave a lobby
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

  // Set ready
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

  // List open lobbies
  app.get('/lobbies', async (_req, reply) => {
    const openLobbies = [...lobbies.values()].filter(l => l.status === 'waiting' && l.players.length < l.maxPlayers)
    return reply.send({ lobbies: openLobbies })
  })

  // Get lobby
  app.get('/lobby/:lobbyId', async (req, reply) => {
    const { lobbyId } = req.params as { lobbyId: string }
    const lobby = lobbies.get(lobbyId)
    if (!lobby) return reply.status(404).send({ error: 'Lobby not found' })
    return reply.send({ lobby })
  })
}
