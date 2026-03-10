/**
 * Public Fact API — versioned REST endpoints for third-party access.
 * All routes require a valid X-Api-Key header.
 * Rate limited at the IP level by the caller in index.ts.
 * DD-V2-200: Open ecosystem — all approved facts available under CC BY 4.0.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { factsDb } from '../db/facts-db.js'
import {
  validateApiKey,
  recordUsage,
  getDailyUsage,
  type ApiKey,
} from '../services/apiKeyService.js'

// Fastify type augmentation for request.apiKey
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey
  }
}

/**
 * Middleware: validate X-Api-Key header, attach to request.apiKey.
 * Returns 401 if missing or invalid, 429 if daily quota exceeded.
 */
async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawKey = request.headers['x-api-key'] as string | undefined
  if (!rawKey) {
    return reply.status(401).send({
      error: 'Missing X-Api-Key header',
      docs: 'https://terragacha.com/developers/auth'
    })
  }
  const key = validateApiKey(rawKey)
  if (!key) {
    return reply.status(401).send({ error: 'Invalid or revoked API key' })
  }
  // Daily quota check
  const dailyUsage = getDailyUsage(key.id)
  if (dailyUsage >= key.quotaPerDay) {
    return reply.status(429).send({
      error: 'Daily quota exceeded',
      quota: key.quotaPerDay,
      used: dailyUsage,
      resetsAt: new Date(Math.ceil(Date.now() / 86_400_000) * 86_400_000).toISOString()
    })
  }
  request.apiKey = key
}

/** Shared CC attribution block appended to every response. */
function ccAttribution() {
  return {
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Recall Rogue Fact Database — terragacha.com',
    requiresAttribution: true
  }
}

/** Count total approved facts in the facts database. */
function getApprovedCount(): number {
  return (factsDb.prepare(
    `SELECT COUNT(*) as c FROM facts WHERE status = 'approved'`
  ).get() as { c: number }).c
}

/**
 * Register all public API routes under /api/v1.
 *
 * @param app - The scoped Fastify instance (mounted at /api/v1).
 */
export async function publicApiRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /facts/random — random sample for quiz use ─────────────────────────
  // Must be registered BEFORE /facts/:id to avoid treating "random" as an ID.
  app.get('/facts/random', { preHandler: requireApiKey }, async (request, reply) => {
    const qs = request.query as Record<string, string>
    const count = Math.min(parseInt(qs['count'] ?? '10', 10), 50)
    const category = qs['category']

    let query = `SELECT id, statement, quiz_question, correct_answer, category_l1,
                        difficulty, rarity, age_rating, source_name, source_url
                 FROM facts WHERE status = 'approved'`
    const params: (string | number)[] = []
    if (category) { query += ' AND category_l1 = ?'; params.push(category) }
    query += ' ORDER BY RANDOM() LIMIT ?'
    params.push(count)

    const facts = factsDb.prepare(query).all(...params as [])
    recordUsage(request.apiKey!.id, '/v1/facts/random')

    return reply.send({ data: facts, meta: { count: facts.length, ...ccAttribution() } })
  })

  // ── GET /facts — paginated fact list ────────────────────────────────────────
  app.get('/facts', { preHandler: requireApiKey }, async (request, reply) => {
    const qs = request.query as Record<string, string>
    const category = qs['category']
    const difficulty = qs['difficulty']  // 'easy' | 'medium' | 'hard'
    const limit = Math.min(parseInt(qs['limit'] ?? '50', 10), 100)
    const cursor = qs['cursor']  // last seen id for cursor pagination

    let query = `
      SELECT id, statement, quiz_question, correct_answer, category_l1, category_l2,
             difficulty, rarity, fun_score, age_rating, source_name, source_url,
             language, updated_at
      FROM facts WHERE status = 'approved'`
    const params: (string | number)[] = []

    if (category) { query += ' AND category_l1 = ?'; params.push(category) }
    if (difficulty) { query += ' AND difficulty = ?'; params.push(difficulty) }
    if (cursor) { query += ' AND id > ?'; params.push(cursor) }

    query += ' ORDER BY id ASC LIMIT ?'
    params.push(limit + 1)  // Fetch one extra to detect hasMore

    const rows = factsDb.prepare(query).all(...params as []) as Record<string, unknown>[]
    const hasMore = rows.length > limit
    const facts = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (facts[facts.length - 1] as Record<string, unknown>).id : null

    recordUsage(request.apiKey!.id, '/v1/facts')

    return reply.send({
      data: facts,
      pagination: { limit, hasMore, nextCursor },
      meta: { totalApproved: getApprovedCount(), ...ccAttribution() }
    })
  })

  // ── GET /facts/:id — single fact with distractors ───────────────────────────
  app.get('/facts/:id', { preHandler: requireApiKey }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const fact = factsDb.prepare(
      `SELECT id, statement, explanation, quiz_question, correct_answer, acceptable_answers,
              category_l1, category_l2, difficulty, rarity, fun_score, age_rating,
              source_name, source_url, mnemonic, language, has_pixel_art, image_url, updated_at
       FROM facts WHERE id = ? AND status = 'approved'`
    ).get(id) as Record<string, unknown> | undefined

    if (!fact) return reply.status(404).send({ error: 'Fact not found' })

    const distractors = factsDb.prepare(
      `SELECT text, difficulty_tier FROM distractors
       WHERE fact_id = ? AND is_approved = 1
       ORDER BY distractor_confidence DESC LIMIT 6`
    ).all(id) as { text: string; difficulty_tier: string }[]

    recordUsage(request.apiKey!.id, '/v1/facts/:id')

    return reply.send({
      data: { ...fact, distractors },
      meta: ccAttribution()
    })
  })

  // ── GET /categories — category tree ────────────────────────────────────────
  app.get('/categories', { preHandler: requireApiKey }, async (request, reply) => {
    const rows = factsDb.prepare(`
      SELECT category_l1, category_l2, COUNT(*) as fact_count
      FROM facts WHERE status = 'approved'
      GROUP BY category_l1, category_l2
      ORDER BY category_l1, category_l2
    `).all() as { category_l1: string; category_l2: string; fact_count: number }[]

    // Nest l2 under l1
    const tree: Record<string, { total: number; subcategories: Record<string, number> }> = {}
    for (const row of rows) {
      if (!tree[row.category_l1]) tree[row.category_l1] = { total: 0, subcategories: {} }
      tree[row.category_l1].total += row.fact_count
      tree[row.category_l1].subcategories[row.category_l2] = row.fact_count
    }

    recordUsage(request.apiKey!.id, '/v1/categories')
    return reply.send({ data: tree, meta: ccAttribution() })
  })

  // ── GET /stats — database statistics ───────────────────────────────────────
  app.get('/stats', { preHandler: requireApiKey }, async (request, reply) => {
    const approvedCount = getApprovedCount()
    const categoryCount = (factsDb.prepare(
      `SELECT COUNT(DISTINCT category_l1) as c FROM facts WHERE status = 'approved'`
    ).get() as { c: number }).c

    recordUsage(request.apiKey!.id, '/v1/stats')
    return reply.send({
      data: {
        totalApprovedFacts: approvedCount,
        totalCategories: categoryCount,
        lastUpdated: new Date().toISOString()
      },
      meta: ccAttribution()
    })
  })

  // ── GET /license — returns CC license metadata for this API deployment ─────
  app.get('/license', async (_req, reply) => {
    return reply.send({
      factText: {
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        requiresAttribution: true,
        requiresNonCommercial: false,
        attributionTemplate: '© {year} Recall Rogue (terragacha.com). Licensed under CC BY 4.0.'
      },
      pixelArtImages: {
        license: 'CC BY-NC 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
        requiresAttribution: true,
        requiresNonCommercial: true,
        attributionTemplate: '© {year} Recall Rogue (terragacha.com). Licensed under CC BY-NC 4.0.'
      },
      contactForCommercialLicensing: 'licensing@terragacha.com'
    })
  })
}
