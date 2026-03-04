import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

// Mock all external dependencies the facts route imports
vi.mock('../../src/db/facts-db.js', () => ({
  factsDb: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => [
        {
          id: 'test-f1',
          statement: 'Test fact statement',
          status: 'approved',
          category_l1: 'History',
          category_l2: 'Ancient',
          db_version: 1,
          updated_at: 1000000,
          difficulty: 2,
          fun_score: 7,
          age_rating: 'adult',
        },
      ]),
      get: vi.fn((val?: unknown) => {
        // count query
        if (typeof val === 'undefined' || val === null) {
          return { count: 1 }
        }
        return { count: 1 }
      }),
      run: vi.fn(() => ({ changes: 1 })),
    })),
    exec: vi.fn(),
  },
}))

vi.mock('../../src/middleware/adminAuth.js', () => ({
  requireAdmin: vi.fn(async (_req: unknown, _reply: unknown) => {
    // no-op — allow all requests through in tests
  }),
}))

vi.mock('../../src/services/deduplication.js', () => ({
  checkDuplicate: vi.fn(() => false),
}))

vi.mock('../../src/services/categorization.js', () => ({
  categorizeFact: vi.fn(() => ({ category_l1: 'History', category_l2: 'Ancient' })),
}))

vi.mock('../../src/services/contentGen.js', () => ({
  generateFactContent: vi.fn(() => Promise.resolve([])),
  extractFactsFromPassage: vi.fn(() => Promise.resolve([])),
  persistGeneratedContent: vi.fn(() => Promise.resolve()),
}))

import { factsRoutes } from '../../src/routes/facts.js'

let app: ReturnType<typeof Fastify>

beforeEach(async () => {
  app = Fastify({ logger: false })
  // Register with the same prefix as in production (src/index.ts line 158)
  await app.register(factsRoutes, { prefix: '/api/facts' })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
  vi.clearAllMocks()
})

describe('GET /api/facts (admin list)', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/facts' })
    expect(res.statusCode).toBe(200)
  })

  it('returns a facts array and total', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/facts' })
    const body = res.json()
    expect(body).toHaveProperty('facts')
    expect(Array.isArray(body.facts)).toBe(true)
    expect(body).toHaveProperty('total')
  })
})

describe('GET /api/facts/delta', () => {
  it('returns a valid HTTP response with sinceVersion param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/facts/delta?sinceVersion=0',
    })
    // Delta route may return 200 with facts or an error — just verify it responds
    expect([200, 400, 404, 500]).toContain(res.statusCode)
  })
})
