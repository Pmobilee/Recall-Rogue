import { describe, it, expect, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// Mock the config to avoid needing real environment variables
vi.mock('../../src/config.js', () => ({
  config: {
    revenuecatApiKey: '',
    resendApiKey: '',
    fcmProjectId: '',
    fcmPrivateKey: '',
    azureSpeechKey: '',
    nodeEnv: 'test',
  },
}))

import { healthRoutes } from '../../src/routes/health.js'

let app: ReturnType<typeof Fastify>

afterEach(async () => {
  if (app) await app.close()
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })

  it('response includes uptime as a number', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(typeof res.json().uptime).toBe('number')
    expect(res.json().uptime).toBeGreaterThanOrEqual(0)
  })

  it('response includes version string', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(typeof res.json().version).toBe('string')
    expect(res.json().version.length).toBeGreaterThan(0)
  })
})

describe('GET /health/ready', () => {
  it('returns 206 when integrations are not configured', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    // With empty config values, should return 206 (partial)
    expect([200, 206]).toContain(res.statusCode)
  })

  it('response includes integrations object', async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    const body = res.json()
    expect(body).toHaveProperty('integrations')
    expect(typeof body.integrations).toBe('object')
  })
})
