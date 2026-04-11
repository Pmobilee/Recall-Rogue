/**
 * Integration tests for MP Lobby REST routes via Fastify inject.
 *
 * Tests cover: happy paths for create / list / code-lookup / join / leave,
 * plus error paths for wrong password, full lobby, and missing fields.
 */

import { describe, it, expect, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mpLobbyRoutes } from '../../src/routes/mpLobby.js'
import { hashPassword } from '../../src/services/mpLobbyRegistry.js'

// ── Test app factory ──────────────────────────────────────────────────────────

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(mpLobbyRoutes, { prefix: '/mp' })
  await app.ready()
  return app
}

let app: FastifyInstance

afterEach(async () => {
  if (app) await app.close()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultCreateBody = {
  hostId: 'test-host',
  hostName: 'Tester',
  mode: 'race',
  visibility: 'public',
  maxPlayers: 4,
}

// ── POST /mp/lobbies ──────────────────────────────────────────────────────────

describe('POST /mp/lobbies', () => {
  it('creates a lobby and returns lobbyId, lobbyCode, joinToken', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies',
      payload: defaultCreateBody,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.lobbyId).toBeTruthy()
    expect(body.lobbyCode).toHaveLength(6)
    expect(body.joinToken).toBeTruthy()
    expect(body.hostConnection.playerId).toBe('test-host')
  })

  it('returns 400 when required fields are missing', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies',
      payload: { hostId: 'test-host' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for an invalid mode', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies',
      payload: { ...defaultCreateBody, mode: 'not_a_mode' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when visibility is "password" but no passwordHash provided', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies',
      payload: { ...defaultCreateBody, visibility: 'password' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a password-protected lobby successfully', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies',
      payload: {
        ...defaultCreateBody,
        visibility: 'password',
        passwordHash: hashPassword('secret'),
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().lobbyId).toBeTruthy()
  })
})

// ── GET /mp/lobbies ───────────────────────────────────────────────────────────

describe('GET /mp/lobbies', () => {
  it('returns an array of lobbies', async () => {
    app = await buildTestApp()
    // Create one lobby so the list is non-empty (no shared state — each app instance is fresh).
    await app.inject({ method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody })

    const res = await app.inject({ method: 'GET', url: '/mp/lobbies' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.lobbies)).toBe(true)
  })

  it('filters by mode query param', async () => {
    app = await buildTestApp()
    await app.inject({
      method: 'POST', url: '/mp/lobbies',
      payload: { ...defaultCreateBody, mode: 'race' },
    })
    await app.inject({
      method: 'POST', url: '/mp/lobbies',
      payload: { ...defaultCreateBody, mode: 'duel', maxPlayers: 2 },
    })

    const res = await app.inject({ method: 'GET', url: '/mp/lobbies?mode=race' })
    expect(res.statusCode).toBe(200)
    const lobbies = res.json().lobbies as { mode: string }[]
    expect(lobbies.every(l => l.mode === 'race')).toBe(true)
  })

  it('returns 400 for an invalid mode filter', async () => {
    app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/mp/lobbies?mode=invalid' })
    expect(res.statusCode).toBe(400)
  })

  it('does not include friends_only lobbies', async () => {
    app = await buildTestApp()
    await app.inject({
      method: 'POST', url: '/mp/lobbies',
      payload: { ...defaultCreateBody, visibility: 'friends_only' },
    })
    const res = await app.inject({ method: 'GET', url: '/mp/lobbies' })
    const lobbies = res.json().lobbies as { visibility: string }[]
    expect(lobbies.every(l => l.visibility !== 'friends_only')).toBe(true)
  })
})

// ── GET /mp/lobbies/code/:code ────────────────────────────────────────────────

describe('GET /mp/lobbies/code/:code', () => {
  it('returns lobby info for a valid code', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody,
    })
    const { lobbyCode } = createRes.json()

    const res = await app.inject({ method: 'GET', url: `/mp/lobbies/code/${lobbyCode}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.lobbyCode).toBe(lobbyCode)
    expect(body.hostName).toBe('Tester')
  })

  it('returns 404 for an unknown code', async () => {
    app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/mp/lobbies/code/ZZZZZZ' })
    expect(res.statusCode).toBe(404)
  })
})

// ── POST /mp/lobbies/:lobbyId/join ────────────────────────────────────────────

describe('POST /mp/lobbies/:lobbyId/join', () => {
  it('joins a public lobby and returns joinToken', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody,
    })
    const { lobbyId } = createRes.json()

    const res = await app.inject({
      method: 'POST',
      url: `/mp/lobbies/${lobbyId}/join`,
      payload: { playerId: 'player-2', displayName: 'Bob' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.joinToken).toBeTruthy()
    expect(body.lobbyId).toBe(lobbyId)
  })

  it('returns 403 on wrong password', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies',
      payload: { ...defaultCreateBody, visibility: 'password', passwordHash: hashPassword('correct') },
    })
    const { lobbyId } = createRes.json()

    const res = await app.inject({
      method: 'POST',
      url: `/mp/lobbies/${lobbyId}/join`,
      payload: { playerId: 'player-2', displayName: 'Bob', password: hashPassword('wrong') },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 409 when lobby is full', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies',
      payload: { ...defaultCreateBody, maxPlayers: 2 },
    })
    const { lobbyId } = createRes.json()

    // Fill the lobby.
    await app.inject({
      method: 'POST', url: `/mp/lobbies/${lobbyId}/join`,
      payload: { playerId: 'player-2', displayName: 'Bob' },
    })

    // Third player should be rejected.
    const res = await app.inject({
      method: 'POST', url: `/mp/lobbies/${lobbyId}/join`,
      payload: { playerId: 'player-3', displayName: 'Carol' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 404 for a non-existent lobby', async () => {
    app = await buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/mp/lobbies/does-not-exist/join',
      payload: { playerId: 'player-2', displayName: 'Bob' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when playerId or displayName is missing', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody,
    })
    const { lobbyId } = createRes.json()

    const res = await app.inject({
      method: 'POST',
      url: `/mp/lobbies/${lobbyId}/join`,
      payload: { displayName: 'NoId' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /mp/lobbies/:lobbyId/leave ──────────────────────────────────────────

describe('POST /mp/lobbies/:lobbyId/leave', () => {
  it('leaves a lobby successfully', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody,
    })
    const { lobbyId } = createRes.json()
    await app.inject({
      method: 'POST', url: `/mp/lobbies/${lobbyId}/join`,
      payload: { playerId: 'player-2', displayName: 'Bob' },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/mp/lobbies/${lobbyId}/leave`,
      payload: { playerId: 'player-2' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('returns 400 when playerId is missing', async () => {
    app = await buildTestApp()
    const createRes = await app.inject({
      method: 'POST', url: '/mp/lobbies', payload: defaultCreateBody,
    })
    const { lobbyId } = createRes.json()

    const res = await app.inject({
      method: 'POST',
      url: `/mp/lobbies/${lobbyId}/leave`,
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
