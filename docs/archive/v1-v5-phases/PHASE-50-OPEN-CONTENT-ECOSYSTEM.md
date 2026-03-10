# Phase 50: Open Content Ecosystem

## Overview

**Goal**: Transform Recall Rogue's fact database into a publicly accessible, community-driven educational
content platform. This phase builds on the existing UGC scaffolding (`server/src/routes/ugc.ts`,
`server/src/services/ugcReviewService.ts`) and fact administration infrastructure
(`server/src/routes/facts.ts`) to expose a versioned public API, implement a full community
moderation pipeline, onboard educational institutions through a partner portal, establish a
Creative Commons content licensing framework with attribution tracking, deliver a third-party
embed SDK, and publish a developer documentation site.

**Why this phase matters**: The 3,000-fact target (Phase 32) makes the content database
genuinely valuable to educators, developers, and other knowledge applications. Opening the
ecosystem creates an external content contribution flywheel — partners submit facts, the review
pipeline ensures quality, and approved facts flow back into the game. Licensing and attribution
tracking also satisfy the legal requirements of institutional partners (schools, universities,
nonprofit ed-tech organizations) who need explicit Creative Commons terms before embedding
Recall Rogue content in curricula.

**Dependencies (must be complete before starting)**:
- Phase 11: Fact Content Engine — `factsDb` singleton, `facts.db` SQLite schema, ingestion API,
  `requireAdmin` middleware, `checkDuplicate` deduplication service
- Phase 19: Auth & Cloud — JWT middleware (`requireAuth`), `users` table in `schema.ts`,
  player profiles
- Phase 22: Social & Multiplayer — rate limiter pattern (`createRateLimiter`) in `server/src/index.ts`
  used as the template for API key rate limiting in this phase
- Phase 23: Live Ops & Seasons — UGC routes scaffolded in `server/src/routes/ugc.ts` and
  `server/src/services/ugcReviewService.ts`; Phase 50 replaces the stub implementations with
  full production logic
- Phase 32: Fact Content Scaling — minimum 3,000 approved facts in `facts.db` before the
  public API is worth advertising; Phase 50 can be implemented earlier but the public API
  endpoint should return a `503 Service Unavailable` with `{ reason: "content_not_ready",
  minimumFactsRequired: 3000, currentApproved: <n> }` until that threshold is met

**Estimated complexity**: High. Seven distinct sub-systems span server routes, database schema
additions, a Svelte moderator dashboard, a partner portal UI, SDK packaging, and a static
documentation site. Each sub-system has well-defined interfaces so they can be implemented in
parallel by independent workers. The hardest part is the moderation pipeline (50.3) because it
must be robust enough to handle coordinated abuse without requiring constant admin attention.

**Design decisions governing this phase**:
- **DD-V2-200**: Open ecosystem — all approved facts are available under CC BY 4.0; in-game
  use is free; commercial embedding requires a paid license tier (Institutional or Enterprise)
- **DD-V2-201**: Content licensing — Creative Commons Attribution 4.0 International for all
  fact text; pixel art images are CC BY-NC 4.0 (non-commercial only); source attribution is
  preserved and surfaced in every API response

**Files affected summary** (full list at bottom of document):
- `server/src/routes/publicApi.ts` — NEW: public fact API with API key auth
- `server/src/routes/apiKeys.ts` — NEW: API key management CRUD
- `server/src/routes/partnerPortal.ts` — NEW: institution registration + licensing
- `server/src/routes/webhooks.ts` — NEW: webhook subscription management
- `server/src/routes/ugc.ts` — EXTEND: replace stubs with full production logic
- `server/src/services/ugcReviewService.ts` — EXTEND: automated NLP flagging, appeal workflow
- `server/src/services/apiKeyService.ts` — NEW: key generation, hashing, quota tracking
- `server/src/services/licenseService.ts` — NEW: attribution generation, CC metadata
- `server/src/services/webhookService.ts` — NEW: delivery queue, retry logic
- `server/src/services/partnerService.ts` — NEW: institution verification, license tiers
- `server/src/db/migrate.ts` — EXTEND: add api_keys, partner_orgs, license_grants,
  webhook_subscriptions, ugc_appeals, usage_logs tables
- `server/src/index.ts` — EXTEND: mount new route namespaces
- `src/ui/components/UGCReviewQueue.svelte` — EXTEND: full moderator dashboard
- `src/ui/components/UGCSubmitOverlay.svelte` — EXTEND: add license consent checkbox
- `src/ui/components/PartnerPortalView.svelte` — NEW: institution portal entry point
- `docs/api/` — NEW: static markdown API documentation site

---

## Sub-Phases

---

### 50.1 — Public Fact API

**Goal**: Expose the approved fact database via a versioned, rate-limited REST API accessible
with an API key. The API must be usable without an account (read-only, key-only auth), return
full CC attribution metadata on every response, and enforce per-key rate limits using the same
in-memory fixed-window pattern as the existing auth limiter.

---

#### 50.1.1 — Database schema: `api_keys` and `usage_logs` tables

File: `server/src/db/migrate.ts`

Add the following table definitions inside the existing `initSchema()` function, after the
existing `CREATE TABLE IF NOT EXISTS` blocks:

```sql
-- API key registry
CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,        -- UUID v4
  owner_id    TEXT,                    -- nullable: registered users link their account
  key_hash    TEXT NOT NULL UNIQUE,    -- SHA-256 hex hash of the raw key
  key_prefix  TEXT NOT NULL,           -- First 8 chars of raw key for display (e.g. "tg_live_")
  name        TEXT NOT NULL,           -- Human label, e.g. "My School App"
  tier        TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'institutional' | 'enterprise'
  quota_per_day  INTEGER NOT NULL DEFAULT 1000,
  quota_per_min  INTEGER NOT NULL DEFAULT 60,
  is_active   INTEGER NOT NULL DEFAULT 1,
  last_used_at   INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Rolling usage ledger (one row per key per UTC hour bucket)
CREATE TABLE IF NOT EXISTS usage_logs (
  id         TEXT PRIMARY KEY,
  key_id     TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  hour_bucket INTEGER NOT NULL,  -- Unix timestamp floored to the nearest hour
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (key_id, endpoint, hour_bucket)
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_key_hour
  ON usage_logs (key_id, hour_bucket DESC);
```

**Acceptance criteria**:
- Running `initSchema()` idempotently creates both tables without errors on a fresh database
  and on a database that already has all other tables from Phases 7-22
- `api_keys` unique constraint on `key_hash` is enforced
- `usage_logs` upsert (INSERT OR REPLACE) works without errors

---

#### 50.1.2 — API key service

File: `server/src/services/apiKeyService.ts` (NEW)

```typescript
/**
 * API key management service.
 * Keys are stored as SHA-256 hashes; the raw key is only returned once at creation.
 * Quota tracking uses an in-memory minute window + a persistent hourly bucket in usage_logs.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export interface ApiKey {
  id: string
  ownerId: string | null
  keyPrefix: string
  name: string
  tier: 'free' | 'institutional' | 'enterprise'
  quotaPerDay: number
  quotaPerMin: number
  isActive: boolean
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface CreateApiKeyResult {
  apiKey: ApiKey
  rawKey: string  // Only returned at creation time; never stored
}

/** Quota limits per tier */
export const TIER_QUOTAS: Record<ApiKey['tier'], { perDay: number; perMin: number }> = {
  free:          { perDay: 1_000,   perMin: 60  },
  institutional: { perDay: 50_000,  perMin: 500 },
  enterprise:    { perDay: 500_000, perMin: 2_000 },
}

/**
 * Generate a new API key, store its hash, and return the raw key once.
 * Raw key format: tg_live_<32 random hex chars>
 */
export function createApiKey(
  name: string,
  tier: ApiKey['tier'] = 'free',
  ownerId: string | null = null
): CreateApiKeyResult {
  const randomPart = crypto.randomBytes(16).toString('hex')
  const rawKey = `tg_live_${randomPart}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 15)  // "tg_live_" + first 7 hex chars
  const id = crypto.randomUUID()
  const now = Date.now()
  const quota = TIER_QUOTAS[tier]

  factsDb.prepare(`
    INSERT INTO api_keys
      (id, owner_id, key_hash, key_prefix, name, tier, quota_per_day, quota_per_min,
       is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, ownerId, keyHash, keyPrefix, name, tier, quota.perDay, quota.perMin, now, now)

  const apiKey = factsDb.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKey
  return { apiKey, rawKey }
}

/**
 * Validate an incoming raw API key against stored hashes.
 * Returns the ApiKey row if valid and active, null otherwise.
 */
export function validateApiKey(rawKey: string): ApiKey | null {
  if (!rawKey || typeof rawKey !== 'string') return null
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const row = factsDb.prepare(
    'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1'
  ).get(keyHash) as ApiKey | undefined
  if (!row) return null

  // Update last_used_at asynchronously (non-blocking fire-and-forget)
  factsDb.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .run(Date.now(), row.id)

  return row
}

/**
 * Record a request in the hourly usage bucket.
 * Performs an upsert so concurrent requests merge correctly.
 */
export function recordUsage(keyId: string, endpoint: string): void {
  const now = Date.now()
  const hourBucket = Math.floor(now / 3_600_000) * 3_600_000
  const id = `${keyId}:${endpoint}:${hourBucket}`
  factsDb.prepare(`
    INSERT INTO usage_logs (id, key_id, endpoint, hour_bucket, request_count, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT (key_id, endpoint, hour_bucket)
    DO UPDATE SET request_count = request_count + 1
  `).run(id, keyId, endpoint, hourBucket, now)
}

/**
 * Return the total request count for a key in the last 24 hours.
 */
export function getDailyUsage(keyId: string): number {
  const since = Date.now() - 86_400_000
  const sinceBucket = Math.floor(since / 3_600_000) * 3_600_000
  const row = factsDb.prepare(`
    SELECT COALESCE(SUM(request_count), 0) as total
    FROM usage_logs WHERE key_id = ? AND hour_bucket >= ?
  `).get(keyId, sinceBucket) as { total: number }
  return row.total
}
```

**Acceptance criteria**:
- `createApiKey('test', 'free')` returns a `rawKey` starting with `tg_live_`
- `validateApiKey(rawKey)` returns the key row; `validateApiKey('bad')` returns null
- `recordUsage` upserts correctly; calling it 3 times for the same bucket yields `request_count = 3`

---

#### 50.1.3 — Public fact API routes

File: `server/src/routes/publicApi.ts` (NEW)

All routes under this file are mounted at `/api/v1` and require a valid `X-Api-Key` header.
The `requireApiKey` middleware validates the key and attaches the parsed `ApiKey` to
`request.apiKey` via a Fastify decorator.

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { factsDb } from '../db/facts-db.js'
import { validateApiKey, recordUsage, getDailyUsage, type ApiKey } from '../services/apiKeyService.js'

// Fastify type augmentation for request.apiKey
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey
  }
}

/** Middleware: validate X-Api-Key header, attach to request.apiKey */
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

/** Shared CC attribution block appended to every response */
function ccAttribution() {
  return {
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Recall Rogue Fact Database — terragacha.com',
    requiresAttribution: true
  }
}

export async function publicApiRoutes(app: FastifyInstance): Promise<void> {
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

    const rows = factsDb.prepare(query).all(...params) as Record<string, unknown>[]
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

  // ── GET /facts/random — random sample for quiz use ─────────────────────────
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

    const facts = factsDb.prepare(query).all(...params)
    recordUsage(request.apiKey!.id, '/v1/facts/random')

    return reply.send({ data: facts, meta: { count: facts.length, ...ccAttribution() } })
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
}

function getApprovedCount(): number {
  return (factsDb.prepare(
    `SELECT COUNT(*) as c FROM facts WHERE status = 'approved'`
  ).get() as { c: number }).c
}
```

**Acceptance criteria**:
- `GET /api/v1/facts` without `X-Api-Key` returns 401 with `docs` field
- `GET /api/v1/facts` with valid key returns `data[]` and `meta.license = 'CC BY 4.0'`
- Cursor pagination: requesting page 2 with `cursor=<last_id>` returns the next batch without overlap
- `GET /api/v1/facts/random?count=5` returns exactly 5 facts in a random order
- `GET /api/v1/categories` returns a nested object keyed by `category_l1`
- Exceeding `quotaPerDay` returns 429 with `resetsAt` ISO timestamp

---

#### 50.1.4 — Mount public API routes in `server/src/index.ts`

File: `server/src/index.ts` (EXTEND)

Add the following after the existing `ugcRoutes` registration block:

```typescript
import { publicApiRoutes } from './routes/publicApi.js'
import { apiKeyRoutes }   from './routes/apiKeys.js'

// Public fact API — versioned namespace, API key auth
const publicApiRateLimit = createRateLimiter(120, 60_000)  // 120 req/min per IP ceiling
await fastify.register(async (scoped) => {
  scoped.addHook('preHandler', publicApiRateLimit)
  await publicApiRoutes(scoped)
}, { prefix: '/api/v1' })

// API key management (requires JWT auth for key owners)
await fastify.register(apiKeyRoutes, { prefix: '/api/keys' })
```

**Acceptance criteria**:
- `curl http://localhost:3001/api/v1/facts` returns 401 (missing key)
- Routes are visible in Fastify's route list at startup

---

### 50.2 — Community Fact Submission

**Goal**: Replace the stub implementation in `server/src/routes/ugc.ts` with a fully functional
submission pipeline: authenticated submission (JWT), auto-filter via the existing
`autoFilterSubmission`, duplicate check, community voting, and webhook trigger on approval.
The `UGCSubmitOverlay.svelte` component gains a license consent checkbox; submission is
blocked without it.

---

#### 50.2.1 — Extend `UGCSubmission` with missing fields

File: `server/src/routes/ugc.ts` (EXTEND)

Extend the `UGCSubmission` interface at the top of the file:

```typescript
export interface UGCSubmission {
  id: string
  playerId: string
  factText: string
  correctAnswer: string
  distractors: string[]
  category: string[]
  sourceUrl: string
  sourceName: string            // ADDED
  licenseConsented: boolean     // ADDED — must be true before storage
  autoFilterResult?: {          // ADDED — populated immediately on receipt
    passed: boolean
    reason?: string
  }
  upvotes: number               // ADDED
  downvotes: number             // ADDED
  submittedAt: string
  status: 'pending' | 'community_vote' | 'admin_review' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
  appealId?: string             // ADDED — set when an appeal is filed (50.3)
}
```

---

#### 50.2.2 — Full submission endpoint

File: `server/src/routes/ugc.ts` (EXTEND)

Replace the stub `app.post('/submit', ...)` handler with the full implementation:

```typescript
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { autoFilterSubmission } from '../services/ugcReviewService.js'
import { checkDuplicate } from '../services/deduplication.js'
import { factsDb } from '../db/facts-db.js'
import { triggerWebhook } from '../services/webhookService.js'

app.post('/submit', { preHandler: requireAuth }, async (req, reply) => {
  const user = getAuthUser(req)
  const body = req.body as {
    factText: string
    correctAnswer: string
    distractors: string[]
    category: string[]
    sourceUrl: string
    sourceName: string
    licenseConsented: boolean
  }

  // Required field validation
  if (!body.licenseConsented) {
    return reply.status(400).send({ error: 'License consent is required' })
  }
  if (!body.factText || !body.correctAnswer || !body.sourceUrl || !body.sourceName) {
    return reply.status(400).send({ error: 'Missing required fields' })
  }
  if (!Array.isArray(body.distractors) || body.distractors.length < 3) {
    return reply.status(400).send({ error: 'At least 3 distractors required' })
  }

  const factText = body.factText.slice(0, 500)
  const correctAnswer = body.correctAnswer.slice(0, 200)
  const distractors = body.distractors.slice(0, 5).map(d => String(d).slice(0, 200))

  // Auto-filter
  const filterResult = autoFilterSubmission(factText, correctAnswer, distractors)

  // Duplicate check against approved facts
  const dupResult = await checkDuplicate(factText, body.category[0] ?? '')
  if (dupResult.isDuplicate) {
    return reply.status(409).send({
      error: 'Duplicate fact detected',
      similarFactId: dupResult.similarFactId
    })
  }

  const id = `ugc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const initialStatus = filterResult.passed ? 'community_vote' : 'rejected'

  // Persist to facts DB ugc_submissions table
  factsDb.prepare(`
    INSERT INTO ugc_submissions
      (id, player_id, fact_text, correct_answer, distractors, category,
       source_url, source_name, license_consented, auto_filter_passed,
       auto_filter_reason, upvotes, downvotes, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 0, ?, ?)
  `).run(
    id, user.userId, factText, correctAnswer,
    JSON.stringify(distractors), JSON.stringify(body.category),
    body.sourceUrl.slice(0, 500), body.sourceName.slice(0, 200),
    filterResult.passed ? 1 : 0,
    filterResult.reason ?? null,
    initialStatus, now
  )

  // Fire webhook for integrations listening to ugc.submitted
  await triggerWebhook('ugc.submitted', { submissionId: id, status: initialStatus })

  return reply.status(201).send({
    submissionId: id,
    status: initialStatus,
    autoFilter: filterResult
  })
})
```

---

#### 50.2.3 — Community voting endpoint

File: `server/src/routes/ugc.ts` (EXTEND)

Add after the submission route:

```typescript
// POST /vote/:submissionId — authenticated players vote on community_vote submissions
app.post('/vote/:submissionId', { preHandler: requireAuth }, async (req, reply) => {
  const user = getAuthUser(req)
  const { submissionId } = req.params as { submissionId: string }
  const { vote } = req.body as { vote: 'up' | 'down' }

  if (!['up', 'down'].includes(vote)) {
    return reply.status(400).send({ error: 'vote must be "up" or "down"' })
  }

  const sub = factsDb.prepare(
    `SELECT * FROM ugc_submissions WHERE id = ? AND status = 'community_vote'`
  ).get(submissionId) as Record<string, unknown> | undefined

  if (!sub) {
    return reply.status(404).send({ error: 'Submission not in community_vote stage' })
  }

  // Prevent duplicate votes: check ugc_votes table
  const existing = factsDb.prepare(
    `SELECT id FROM ugc_votes WHERE submission_id = ? AND voter_id = ?`
  ).get(submissionId, user.userId)

  if (existing) {
    return reply.status(409).send({ error: 'Already voted on this submission' })
  }

  // Record vote
  factsDb.prepare(
    `INSERT INTO ugc_votes (id, submission_id, voter_id, vote, voted_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    `vote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    submissionId, user.userId, vote, new Date().toISOString()
  )

  // Update counters
  const field = vote === 'up' ? 'upvotes' : 'downvotes'
  factsDb.prepare(
    `UPDATE ugc_submissions SET ${field} = ${field} + 1 WHERE id = ?`
  ).run(submissionId)

  // Re-evaluate community vote threshold
  const updated = factsDb.prepare(
    `SELECT upvotes, downvotes FROM ugc_submissions WHERE id = ?`
  ).get(submissionId) as { upvotes: number; downvotes: number }

  const { evaluateCommunityVotes } = await import('../services/ugcReviewService.js')
  const voteResult = evaluateCommunityVotes(updated.upvotes, updated.downvotes, 5)

  if (voteResult.passed) {
    // Promote to admin_review
    factsDb.prepare(
      `UPDATE ugc_submissions SET status = 'admin_review' WHERE id = ?`
    ).run(submissionId)
    await triggerWebhook('ugc.ready_for_review', { submissionId })
  }

  return reply.send({ success: true, newStatus: voteResult.passed ? 'admin_review' : 'community_vote' })
})
```

---

#### 50.2.4 — License consent in `UGCSubmitOverlay.svelte`

File: `src/ui/components/UGCSubmitOverlay.svelte` (EXTEND)

Add before the Submit button in the form template:

```svelte
<label class="consent-row">
  <input
    type="checkbox"
    bind:checked={licenseConsented}
    aria-required="true"
  />
  <span>
    I license this submission under
    <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">
      CC BY 4.0
    </a>.
    I confirm this fact is factually accurate and the source URL is valid.
  </span>
</label>

<button
  class="submit-btn"
  disabled={!licenseConsented || submitting}
  on:click={handleSubmit}
>
  {submitting ? 'Submitting...' : 'Submit Fact'}
</button>
```

Add `let licenseConsented = false` to the script block and include `licenseConsented` in the
`fetch('/api/ugc/submit', ...)` body payload.

**Acceptance criteria (50.2)**:
- Submitting without `licenseConsented: true` returns 400
- Submitting a fact that passes auto-filter sets `status = 'community_vote'`
- Submitting a fact containing profanity sets `status = 'rejected'` with `autoFilter.passed = false`
- Duplicate submission returns 409
- Voting endpoint rejects duplicate votes with 409
- After 4 upvotes and 1 downvote (80% approval, threshold met), status transitions to `admin_review`
- `ugc.submitted` webhook fires on every non-rejected submission

---

### 50.3 — Content Moderation Tools

**Goal**: Build a full moderator dashboard in `UGCReviewQueue.svelte`, add NLP-based automated
flagging to `ugcReviewService.ts`, implement a formal appeal process with a server-side appeal
table, and add moderator audit logging.

---

#### 50.3.1 — Automated flagging: enhanced `autoFilterSubmission`

File: `server/src/services/ugcReviewService.ts` (EXTEND)

Add the following function after `evaluateCommunityVotes`:

```typescript
/** Categories of automated flags that can be raised on a submission */
export type FlagReason =
  | 'profanity'
  | 'potential_misinformation'
  | 'url_unreachable'
  | 'answer_in_question'
  | 'too_similar_to_existing'
  | 'suspicious_submission_rate'

export interface AutoFlag {
  reason: FlagReason
  severity: 'block' | 'warn'
  detail: string
}

/**
 * Run enhanced automated checks on a submission.
 * Returns an array of flags; an empty array means no issues detected.
 * 'block' severity flags prevent the submission from entering community_vote.
 * 'warn' flags allow it through but add a moderator note.
 */
export function runAutoFlags(
  factText: string,
  correctAnswer: string,
  distractors: string[],
  sourceUrl: string,
  playerId: string
): AutoFlag[] {
  const flags: AutoFlag[] = []

  // 1. Answer embedded verbatim in question (gives away the answer)
  if (factText.toLowerCase().includes(correctAnswer.toLowerCase()) &&
      correctAnswer.length > 4) {
    flags.push({
      reason: 'answer_in_question',
      severity: 'warn',
      detail: `Correct answer "${correctAnswer}" appears verbatim in the fact text`
    })
  }

  // 2. URL scheme check (must be http/https)
  try {
    const url = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      flags.push({
        reason: 'url_unreachable',
        severity: 'block',
        detail: `Source URL uses unsupported protocol: ${url.protocol}`
      })
    }
  } catch {
    flags.push({
      reason: 'url_unreachable',
      severity: 'block',
      detail: 'Source URL is not a valid URL'
    })
  }

  // 3. All-distractor similarity check (distractors too close to correct answer)
  const normalizedAnswer = correctAnswer.toLowerCase().trim()
  const suspiciouslyClose = distractors.filter(d => {
    const nd = d.toLowerCase().trim()
    // Levenshtein distance <= 2 for short answers is suspicious
    if (normalizedAnswer.length <= 6) return nd === normalizedAnswer
    return nd.startsWith(normalizedAnswer.slice(0, 4)) && nd !== normalizedAnswer
  })
  if (suspiciouslyClose.length >= 2) {
    flags.push({
      reason: 'too_similar_to_existing',
      severity: 'warn',
      detail: `${suspiciouslyClose.length} distractors are suspiciously similar to the correct answer`
    })
  }

  return flags
}
```

---

#### 50.3.2 — Appeals table migration

File: `server/src/db/migrate.ts` (EXTEND)

Add inside `initSchema()`:

```sql
CREATE TABLE IF NOT EXISTS ugc_appeals (
  id              TEXT PRIMARY KEY,
  submission_id   TEXT NOT NULL,
  appellant_id    TEXT NOT NULL,  -- player who filed the appeal
  reason          TEXT NOT NULL,  -- player's stated reason
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'upheld' | 'denied'
  moderator_note  TEXT,
  filed_at        INTEGER NOT NULL,
  resolved_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ugc_appeals_submission
  ON ugc_appeals (submission_id);
```

---

#### 50.3.3 — Appeals endpoints

File: `server/src/routes/ugc.ts` (EXTEND)

```typescript
// POST /appeal/:submissionId — file an appeal for a rejected submission
app.post('/appeal/:submissionId', { preHandler: requireAuth }, async (req, reply) => {
  const user = getAuthUser(req)
  const { submissionId } = req.params as { submissionId: string }
  const { reason } = req.body as { reason: string }

  if (!reason || reason.trim().length < 20) {
    return reply.status(400).send({ error: 'Appeal reason must be at least 20 characters' })
  }

  const sub = factsDb.prepare(
    `SELECT * FROM ugc_submissions WHERE id = ? AND player_id = ? AND status = 'rejected'`
  ).get(submissionId, user.userId)

  if (!sub) {
    return reply.status(404).send({ error: 'Rejected submission not found for this player' })
  }

  // One appeal per submission
  const existingAppeal = factsDb.prepare(
    `SELECT id FROM ugc_appeals WHERE submission_id = ?`
  ).get(submissionId)
  if (existingAppeal) {
    return reply.status(409).send({ error: 'An appeal has already been filed for this submission' })
  }

  const appealId = `appeal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  factsDb.prepare(`
    INSERT INTO ugc_appeals (id, submission_id, appellant_id, reason, status, filed_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(appealId, submissionId, user.userId, reason.trim().slice(0, 2000), Date.now())

  factsDb.prepare(
    `UPDATE ugc_submissions SET appeal_id = ? WHERE id = ?`
  ).run(appealId, submissionId)

  return reply.status(201).send({ appealId, status: 'pending' })
})

// POST /appeal/:appealId/resolve — admin resolves an appeal
app.post('/appeal/:appealId/resolve', async (req, reply) => {
  const adminKey = req.headers['x-admin-key']
  if (!adminKey || adminKey !== (await import('../config.js')).config.adminApiKey) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  const { appealId } = req.params as { appealId: string }
  const { decision, note } = req.body as { decision: 'upheld' | 'denied'; note?: string }

  if (!['upheld', 'denied'].includes(decision)) {
    return reply.status(400).send({ error: 'decision must be "upheld" or "denied"' })
  }

  factsDb.prepare(`
    UPDATE ugc_appeals
    SET status = ?, moderator_note = ?, resolved_at = ?
    WHERE id = ?
  `).run(decision, note ?? null, Date.now(), appealId)

  if (decision === 'upheld') {
    // Re-queue the submission for admin_review
    const appeal = factsDb.prepare(
      `SELECT submission_id FROM ugc_appeals WHERE id = ?`
    ).get(appealId) as { submission_id: string } | undefined
    if (appeal) {
      factsDb.prepare(
        `UPDATE ugc_submissions SET status = 'admin_review' WHERE id = ?`
      ).run(appeal.submission_id)
    }
  }

  return reply.send({ appealId, decision })
})
```

---

#### 50.3.4 — Moderator dashboard: `UGCReviewQueue.svelte`

File: `src/ui/components/UGCReviewQueue.svelte` (EXTEND)

Replace the existing placeholder with a functional three-panel dashboard:

- **Left panel**: filter tabs — "Pending Admin Review" / "Appeals" / "Approved" / "Rejected"
- **Center panel**: submission detail card showing fact text, correct answer, distractors, source
  URL (clickable), category, submitter (display name), auto-filter flags in colored badges
- **Right panel**: action buttons — "Approve", "Reject" (with required reason text area),
  "Needs More Info" (sends a notification to submitter)

Key logic in the `<script>` block:

```typescript
async function loadQueue(tab: string) {
  const res = await fetch(`/api/ugc/review-queue?status=${tab}`, {
    headers: { 'x-admin-key': adminKey }
  })
  queue = (await res.json()).queue
}

async function reviewSubmission(id: string, action: 'approve' | 'reject', reason?: string) {
  await fetch(`/api/ugc/review/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ action, reason })
  })
  await loadQueue(activeTab)
}
```

**Acceptance criteria (50.3)**:
- `runAutoFlags` returns a `block`-severity `url_unreachable` flag for non-HTTP URLs
- `runAutoFlags` returns a `warn`-severity `answer_in_question` flag when the answer appears
  verbatim in the fact text (for answers longer than 4 characters)
- Filing an appeal on a non-rejected submission returns 404
- Filing two appeals on the same submission returns 409
- Upholding an appeal changes `ugc_submissions.status` back to `admin_review`
- The moderator dashboard renders the queue without errors when `adminKey` is provided

---

### 50.4 — Educational Partnership Portal

**Goal**: Allow schools and institutions to register for a verified Institutional API tier,
manage their license, view bulk usage analytics, and configure content filters (age rating,
category allowlist) for their deployment.

---

#### 50.4.1 — Partner organizations table

File: `server/src/db/migrate.ts` (EXTEND)

```sql
CREATE TABLE IF NOT EXISTS partner_orgs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL UNIQUE,   -- e.g. "school.edu"
  org_type      TEXT NOT NULL,          -- 'k12' | 'university' | 'nonprofit' | 'edtech'
  contact_email TEXT NOT NULL,
  contact_name  TEXT NOT NULL,
  license_tier  TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'institutional' | 'enterprise'
  api_key_id    TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  content_config TEXT NOT NULL DEFAULT '{}',  -- JSON: { ageRating, categories, maxDifficulty }
  verified      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
```

---

#### 50.4.2 — Partner portal server routes

File: `server/src/routes/partnerPortal.ts` (NEW)

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'
import { requireAdmin } from '../middleware/adminAuth.js'
import { createApiKey } from '../services/apiKeyService.js'
import { sendPartnerWelcomeEmail } from '../services/emailService.js'

export async function partnerPortalRoutes(app: FastifyInstance): Promise<void> {
  // POST /register — institution self-registration
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      name: string; domain: string; orgType: string
      contactEmail: string; contactName: string
    }
    if (!body.name || !body.domain || !body.contactEmail || !body.contactName) {
      return reply.status(400).send({ error: 'All fields required' })
    }
    // Basic domain format validation
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(body.domain.toLowerCase())) {
      return reply.status(400).send({ error: 'Invalid domain format' })
    }

    const id = crypto.randomUUID()
    const now = Date.now()
    try {
      factsDb.prepare(`
        INSERT INTO partner_orgs
          (id, name, domain, org_type, contact_email, contact_name,
           license_tier, verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      `).run(id, body.name.slice(0, 200), body.domain.slice(0, 100).toLowerCase(),
             body.orgType, body.contactEmail.slice(0, 200), body.contactName.slice(0, 200),
             now, now)
    } catch {
      return reply.status(409).send({ error: 'Domain already registered' })
    }

    // Notify admin of new application (non-blocking)
    sendPartnerWelcomeEmail(body.contactEmail, body.name).catch(console.error)

    return reply.status(201).send({
      partnerId: id,
      status: 'pending',
      message: 'Application received. You will be contacted within 2 business days.'
    })
  })

  // POST /verify/:partnerId — admin approves and issues institutional API key
  app.post('/verify/:partnerId', { preHandler: requireAdmin }, async (req, reply) => {
    const { partnerId } = req.params as { partnerId: string }
    const { tier } = req.body as { tier?: 'institutional' | 'enterprise' }
    const resolvedTier = tier ?? 'institutional'

    const org = factsDb.prepare(
      `SELECT * FROM partner_orgs WHERE id = ?`
    ).get(partnerId) as Record<string, unknown> | undefined

    if (!org) return reply.status(404).send({ error: 'Partner not found' })

    const { apiKey, rawKey } = createApiKey(
      `${org.name} — ${resolvedTier}`,
      resolvedTier,
      null
    )

    factsDb.prepare(`
      UPDATE partner_orgs
      SET verified = 1, license_tier = ?, api_key_id = ?, updated_at = ?
      WHERE id = ?
    `).run(resolvedTier, apiKey.id, Date.now(), partnerId)

    return reply.send({
      partnerId,
      tier: resolvedTier,
      apiKeyId: apiKey.id,
      rawKey,  // Show once — admin must securely deliver this to the partner
      message: 'Partner verified. Send rawKey to partner via secure channel.'
    })
  })

  // GET /dashboard — partner views their own usage
  app.get('/dashboard', async (req, reply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyRow = factsDb.prepare(
      `SELECT ak.*, po.name as org_name, po.org_type, po.domain
       FROM api_keys ak
       LEFT JOIN partner_orgs po ON po.api_key_id = ak.id
       WHERE ak.key_hash = ? AND ak.is_active = 1`
    ).get(keyHash) as Record<string, unknown> | undefined

    if (!keyRow) return reply.status(401).send({ error: 'Invalid API key' })

    // Last 7 days of hourly usage
    const since = Date.now() - 7 * 86_400_000
    const usage = factsDb.prepare(`
      SELECT endpoint, SUM(request_count) as total_requests
      FROM usage_logs
      WHERE key_id = ? AND hour_bucket >= ?
      GROUP BY endpoint ORDER BY total_requests DESC
    `).all(keyRow.id, Math.floor(since / 3_600_000) * 3_600_000) as
      { endpoint: string; total_requests: number }[]

    return reply.send({
      org: { name: keyRow.org_name, domain: keyRow.domain, tier: keyRow.tier },
      quota: { perDay: keyRow.quota_per_day, perMin: keyRow.quota_per_min },
      usageLast7Days: usage
    })
  })
}
```

---

#### 50.4.3 — Partner portal Svelte view

File: `src/ui/components/PartnerPortalView.svelte` (NEW)

A minimal single-page Svelte component that institutions see when navigating to
`/partner` (added as a route in `App.svelte`). Three states:

1. **Registration form** — name, domain, org type dropdown, contact fields, submit
2. **Pending confirmation** — "Application submitted" with a reference ID
3. **Dashboard** (shown when `X-Api-Key` is present in `localStorage`) — usage table, quota
   remaining, content config editor (age rating select, category multi-select)

**Acceptance criteria (50.4)**:
- `POST /api/partner/register` with missing fields returns 400
- `POST /api/partner/register` with duplicate domain returns 409
- `POST /api/partner/verify/:id` (admin) returns `rawKey` and updates partner's `license_tier`
- `GET /api/partner/dashboard` with the issued API key returns 7-day usage data
- The PartnerPortalView component renders all three states without TypeScript errors

---

### 50.5 — Content Licensing Framework

**Goal**: Create a `licenseService.ts` that generates machine-readable CC attribution metadata
for any fact or collection of facts, track every external usage via a `license_grants` table,
and expose a `/api/v1/license` endpoint that third parties can query to verify their compliance.

---

#### 50.5.1 — License grants table

File: `server/src/db/migrate.ts` (EXTEND)

```sql
CREATE TABLE IF NOT EXISTS license_grants (
  id            TEXT PRIMARY KEY,
  key_id        TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  fact_ids      TEXT NOT NULL,   -- JSON array of fact IDs accessed in this grant
  license_type  TEXT NOT NULL,   -- 'CC_BY_4' | 'CC_BY_NC_4'
  granted_at    INTEGER NOT NULL,
  attribution_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_license_grants_key
  ON license_grants (key_id, granted_at DESC);
```

---

#### 50.5.2 — License service

File: `server/src/services/licenseService.ts` (NEW)

```typescript
/**
 * Content licensing service.
 * Generates Creative Commons attribution metadata and records license grants.
 * DD-V2-201: CC BY 4.0 for text, CC BY-NC 4.0 for pixel art images.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export type LicenseType = 'CC_BY_4' | 'CC_BY_NC_4'

export interface CcAttribution {
  licenseType: LicenseType
  licenseUrl: string
  shortName: string
  attributionText: string
  attributionHtml: string
  requiresShareAlike: false
  requiresNonCommercial: boolean
}

const LICENSE_URLS: Record<LicenseType, string> = {
  CC_BY_4:    'https://creativecommons.org/licenses/by/4.0/',
  CC_BY_NC_4: 'https://creativecommons.org/licenses/by-nc/4.0/',
}

/**
 * Generate a CC attribution block for a set of fact IDs.
 * Uses CC BY-NC-4.0 if any fact has pixel art (has_pixel_art = 1).
 */
export function generateAttribution(factIds: string[]): CcAttribution {
  const hasPixelArt = factIds.length > 0 && !!(factsDb.prepare(
    `SELECT 1 FROM facts WHERE id IN (${factIds.map(() => '?').join(',')})
     AND has_pixel_art = 1 LIMIT 1`
  ).get(...factIds))

  const licenseType: LicenseType = hasPixelArt ? 'CC_BY_NC_4' : 'CC_BY_4'
  const licenseUrl = LICENSE_URLS[licenseType]
  const year = new Date().getFullYear()
  const attributionText =
    `© ${year} Recall Rogue (terragacha.com). Licensed under ${licenseType === 'CC_BY_4' ? 'CC BY 4.0' : 'CC BY-NC 4.0'}.`

  return {
    licenseType,
    licenseUrl,
    shortName: licenseType === 'CC_BY_4' ? 'CC BY 4.0' : 'CC BY-NC 4.0',
    attributionText,
    attributionHtml:
      `<span xmlns:dct="http://purl.org/dc/terms/">` +
      `Recall Rogue Facts</span> by ` +
      `<a href="https://terragacha.com">Recall Rogue</a> is licensed under ` +
      `<a href="${licenseUrl}">${licenseType === 'CC_BY_4' ? 'CC BY 4.0' : 'CC BY-NC 4.0'}</a>.`,
    requiresShareAlike: false,
    requiresNonCommercial: licenseType === 'CC_BY_NC_4',
  }
}

/**
 * Record a license grant event (called whenever external API fetches facts).
 */
export function recordLicenseGrant(keyId: string, factIds: string[]): void {
  if (factIds.length === 0) return
  const attribution = generateAttribution(factIds)
  factsDb.prepare(`
    INSERT INTO license_grants (id, key_id, fact_ids, license_type, granted_at, attribution_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(), keyId, JSON.stringify(factIds),
    attribution.licenseType, Date.now(), attribution.attributionText
  )
}
```

---

#### 50.5.3 — License verification endpoint

File: `server/src/routes/publicApi.ts` (EXTEND)

Add inside `publicApiRoutes`:

```typescript
// GET /license — returns CC license metadata for this API deployment
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
```

**Acceptance criteria (50.5)**:
- `generateAttribution([])` returns `CC_BY_4` (no pixel art assumed)
- `generateAttribution(factIds)` returns `CC_BY_NC_4` when any fact has `has_pixel_art = 1`
- `recordLicenseGrant` inserts a row with `JSON.stringify(factIds)` in `fact_ids`
- `GET /api/v1/license` returns both `factText` and `pixelArtImages` blocks without auth

---

### 50.6 — Third-Party Integration SDK

**Goal**: Produce a self-contained JavaScript/TypeScript SDK (`recall-rogue-sdk`) in
`packages/sdk/` that wraps the public API, an embeddable iframe widget in
`packages/widget/embed.html`, and a webhook delivery service on the server.

---

#### 50.6.1 — Webhook delivery infrastructure

File: `server/src/services/webhookService.ts` (NEW)

```typescript
/**
 * Webhook delivery service.
 * Supports up to 5 registered endpoints per API key.
 * Retries with exponential back-off: 10s, 30s, 2min, 10min, then drops.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export type WebhookEvent =
  | 'ugc.submitted'
  | 'ugc.approved'
  | 'ugc.rejected'
  | 'ugc.ready_for_review'
  | 'fact.updated'
  | 'fact.deleted'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

const RETRY_DELAYS_MS = [10_000, 30_000, 120_000, 600_000]

/**
 * Trigger a webhook event.
 * Fans out to all active subscriptions for the given event.
 * Delivery is non-blocking (fire-and-forget with retry queue).
 */
export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const subs = factsDb.prepare(`
    SELECT ws.*, ak.key_hash
    FROM webhook_subscriptions ws
    JOIN api_keys ak ON ak.id = ws.key_id
    WHERE ws.event = ? AND ws.is_active = 1 AND ak.is_active = 1
  `).all(event) as Array<{ id: string; endpoint_url: string; secret: string }>

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  }
  const body = JSON.stringify(payload)

  for (const sub of subs) {
    void deliverWithRetry(sub.endpoint_url, sub.secret, body, 0)
  }
}

async function deliverWithRetry(
  url: string, secret: string, body: string, attempt: number
): Promise<void> {
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RecallRogue-Signature': `sha256=${signature}`,
        'X-RecallRogue-Attempt': String(attempt + 1)
      },
      body,
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok && attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      return deliverWithRetry(url, secret, body, attempt + 1)
    }
  } catch {
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      return deliverWithRetry(url, secret, body, attempt + 1)
    }
    // Final failure: log and drop
    console.error(`[webhooks] Delivery to ${url} failed after ${attempt + 1} attempts`)
  }
}
```

---

#### 50.6.2 — Webhook subscription routes

File: `server/src/routes/webhooks.ts` (NEW)

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'
import { validateApiKey } from '../services/apiKeyService.js'

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // POST /webhooks — register a new webhook endpoint
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })
    const key = validateApiKey(rawKey)
    if (!key) return reply.status(401).send({ error: 'Invalid API key' })

    const body = req.body as { endpointUrl: string; events: string[] }
    if (!body.endpointUrl || !Array.isArray(body.events) || body.events.length === 0) {
      return reply.status(400).send({ error: 'endpointUrl and events[] required' })
    }

    // Limit to 5 subscriptions per key
    const count = (factsDb.prepare(
      `SELECT COUNT(*) as c FROM webhook_subscriptions WHERE key_id = ?`
    ).get(key.id) as { c: number }).c
    if (count >= 5) {
      return reply.status(400).send({ error: 'Maximum 5 webhook subscriptions per API key' })
    }

    const id = crypto.randomUUID()
    const secret = crypto.randomBytes(32).toString('hex')

    for (const event of body.events) {
      factsDb.prepare(`
        INSERT INTO webhook_subscriptions
          (id, key_id, endpoint_url, event, secret, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(
        `${id}-${event}`, key.id, body.endpointUrl.slice(0, 500),
        event, secret, Date.now()
      )
    }

    return reply.status(201).send({
      subscriptionId: id,
      secret,  // Return once — use this to verify HMAC signatures
      events: body.events,
      endpointUrl: body.endpointUrl
    })
  })

  // DELETE /webhooks/:id — unsubscribe
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawKey = req.headers['x-api-key'] as string | undefined
    if (!rawKey) return reply.status(401).send({ error: 'Missing X-Api-Key' })
    const key = validateApiKey(rawKey)
    if (!key) return reply.status(401).send({ error: 'Invalid API key' })

    const { id } = req.params as { id: string }
    factsDb.prepare(
      `UPDATE webhook_subscriptions SET is_active = 0 WHERE id LIKE ? AND key_id = ?`
    ).run(`${id}%`, key.id)

    return reply.status(204).send()
  })
}
```

---

#### 50.6.3 — Embed widget

File: `packages/widget/embed.html` (NEW)

A standalone self-contained HTML file (no build step required) that partners can drop into
any webpage. It takes a `data-api-key` and `data-category` attribute on the script tag and
renders a quiz card.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recall Rogue Quiz Widget</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: transparent; }
    .tg-widget { max-width: 480px; border: 2px solid #2D5382; border-radius: 12px;
                 padding: 20px; background: #0d1a2d; color: #e8e8e8; }
    .tg-fact { font-size: 1.1rem; margin-bottom: 16px; line-height: 1.5; }
    .tg-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .tg-option { padding: 10px; border: 1px solid #4A7EC7; border-radius: 8px;
                 background: transparent; color: inherit; cursor: pointer; font-size: 0.9rem; }
    .tg-option:hover { background: #2D5382; }
    .tg-option.correct { background: #1a4a1a; border-color: #4caf50; }
    .tg-option.wrong { background: #4a1a1a; border-color: #f44336; }
    .tg-attribution { font-size: 0.7rem; color: #888; margin-top: 12px; text-align: right; }
    .tg-attribution a { color: #4A7EC7; }
  </style>
</head>
<body>
  <div class="tg-widget" id="tg-root">
    <div class="tg-fact" id="tg-question">Loading...</div>
    <div class="tg-options" id="tg-options"></div>
    <div class="tg-attribution">
      Facts by <a href="https://terragacha.com" target="_blank" rel="noopener">Recall Rogue</a>
      — <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>
    </div>
  </div>
  <script>
    ;(async () => {
      const script = document.currentScript
      const apiKey = script?.dataset?.apiKey ?? ''
      const category = script?.dataset?.category ?? ''
      const apiBase = script?.dataset?.apiBase ?? 'https://api.terragacha.com'

      async function loadFact() {
        const url = `${apiBase}/api/v1/facts/random?count=1${category ? '&category=' + encodeURIComponent(category) : ''}`
        const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } })
        if (!res.ok) { document.getElementById('tg-question').textContent = 'Failed to load fact.'; return }
        const json = await res.json()
        const fact = json.data[0]
        if (!fact) return

        const detailRes = await fetch(`${apiBase}/api/v1/facts/${fact.id}`, { headers: { 'X-Api-Key': apiKey } })
        const detail = (await detailRes.json()).data
        renderQuiz(detail)
      }

      function renderQuiz(fact) {
        document.getElementById('tg-question').textContent = fact.quiz_question || fact.statement
        const options = [fact.correct_answer, ...(fact.distractors || []).slice(0, 3).map(d => d.text)]
          .sort(() => Math.random() - 0.5)
        const container = document.getElementById('tg-options')
        container.innerHTML = ''
        for (const opt of options) {
          const btn = document.createElement('button')
          btn.className = 'tg-option'
          btn.textContent = opt
          btn.addEventListener('click', () => {
            container.querySelectorAll('.tg-option').forEach(b => b.disabled = true)
            btn.classList.add(opt === fact.correct_answer ? 'correct' : 'wrong')
            if (opt !== fact.correct_answer) {
              container.querySelectorAll('.tg-option')
                .forEach(b => { if (b.textContent === fact.correct_answer) b.classList.add('correct') })
            }
          })
          container.appendChild(btn)
        }
      }

      await loadFact()
    })()
  </script>
</body>
</html>
```

**Acceptance criteria (50.6)**:
- `triggerWebhook('ugc.submitted', {...})` fans out to all active subscriptions for that event
- The HMAC signature header `X-RecallRogue-Signature` matches `sha256=<hmac>` computed from
  the request body using the subscription secret
- `POST /api/webhooks` with 6 existing subscriptions returns 400 (max 5 limit)
- `DELETE /api/webhooks/:id` sets `is_active = 0` for all sub-rows matching `id%`
- The embed widget renders a question and 4 options; clicking the correct option adds class `correct`

---

### 50.7 — Developer Documentation

**Goal**: Produce a static documentation site in `docs/api/` using plain Markdown files that
can be served by GitHub Pages or any static host. Must cover authentication, all public
endpoints with request/response examples, rate limiting, webhook setup, SDK quickstart,
and licensing requirements.

---

#### 50.7.1 — Documentation file structure

Create the following files under `docs/api/`:

```
docs/api/
  index.md                  — Overview, quickstart, versioning policy
  authentication.md         — API key types, X-Api-Key header, key rotation
  rate-limiting.md          — Tier quotas, 429 handling, backoff strategy
  endpoints/
    facts-list.md           — GET /api/v1/facts
    facts-detail.md         — GET /api/v1/facts/:id
    facts-random.md         — GET /api/v1/facts/random
    categories.md           — GET /api/v1/categories
    stats.md                — GET /api/v1/stats
    license.md              — GET /api/v1/license
  webhooks.md               — Event types, HMAC verification, retry policy
  sdk.md                    — JavaScript SDK quickstart, TypeScript types
  widget.md                 — Embed widget setup, customization attributes
  licensing.md              — CC BY 4.0 requirements, image CC BY-NC, commercial licensing
  partner-portal.md         — Institution registration, bulk licensing, dashboard
  changelog.md              — API version history
```

---

#### 50.7.2 — `docs/api/index.md` — overview and quickstart

File: `docs/api/index.md` (NEW)

The content of this file must include:

1. A one-paragraph description of the Recall Rogue Fact API and its purpose
2. A quickstart section showing the complete minimal fetch call in JavaScript and curl
3. A versioning policy statement: "The API is versioned via URL path (`/api/v1/`). Breaking
   changes increment the version number. Non-breaking additions are added without a version bump."
4. A table of all available endpoints with their HTTP method, path, and one-line description
5. A link to the rate limiting, authentication, and licensing pages

---

#### 50.7.3 — `docs/api/authentication.md` — API key documentation

File: `docs/api/authentication.md` (NEW)

Must cover:
- How to obtain a free API key (link to registration form at `terragacha.com/developers`)
- The `X-Api-Key` header format
- Key tier comparison table (free / institutional / enterprise) with quota numbers matching
  `TIER_QUOTAS` in `apiKeyService.ts`
- Security best practices: never expose keys in client-side code for production, use
  environment variables, rotate keys if compromised
- How to revoke a key (admin endpoint or contact email)

---

#### 50.7.4 — `docs/api/endpoints/facts-list.md` — GET /facts documentation

File: `docs/api/endpoints/facts-list.md` (NEW)

Must include:
- HTTP method and full path: `GET /api/v1/facts`
- Authentication: `X-Api-Key` required
- Query parameters table: `category`, `difficulty`, `limit` (max 100), `cursor`
- A complete example cURL request
- An example JSON response with real field names matching `publicApiRoutes` route handler
- A note on cursor-based pagination with an example of fetching page 2 using `nextCursor`
- The `meta.license` attribution requirement with a warning: "You MUST display attribution
  as specified in `meta.attributionText` whenever you display facts sourced from this API."

---

#### 50.7.5 — `docs/api/webhooks.md` — webhook documentation

File: `docs/api/webhooks.md` (NEW)

Must cover:
- All supported event types from `WebhookEvent` union type in `webhookService.ts`
- The HMAC-SHA256 signature verification algorithm with a complete JavaScript verification
  example:
  ```js
  const crypto = require('crypto')
  function verifySignature(body, secret, signatureHeader) {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  }
  ```
- The retry schedule: attempts at +10s, +30s, +2min, +10min before dropping
- Subscription limits (5 per API key)
- An example payload for each event type

**Acceptance criteria (50.7)**:
- All files listed in 50.7.1 exist under `docs/api/`
- `docs/api/index.md` contains a working `curl` example that can be copy-pasted and run
  against `http://localhost:3001`
- `docs/api/authentication.md` contains the tier quota table with numbers that match
  `TIER_QUOTAS` in `server/src/services/apiKeyService.ts`
- `docs/api/endpoints/facts-list.md` includes the pagination example
- `docs/api/webhooks.md` includes the HMAC verification code example

---

## Playwright Test Scripts

### Test 50.1 — Public API integration test

```js
// /tmp/test-phase-50-api.js
// Prerequisites: dev server + API server running; populate facts.db with >= 1 approved fact
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()

  // 1. Verify API key creation via admin endpoint
  const createRes = await page.evaluate(async () => {
    const r = await fetch('http://localhost:3001/api/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': 'dev-admin-key-change-me'
      },
      body: JSON.stringify({ name: 'Test Key', tier: 'free' })
    })
    return r.json()
  })
  console.assert(createRes.rawKey?.startsWith('tg_live_'), 'API key starts with tg_live_')

  // 2. Use the key to fetch facts
  const rawKey = createRes.rawKey
  const factsRes = await page.evaluate(async (key) => {
    const r = await fetch('http://localhost:3001/api/v1/facts?limit=5', {
      headers: { 'X-Api-Key': key }
    })
    return r.json()
  }, rawKey)
  console.assert(Array.isArray(factsRes.data), 'Facts response has data array')
  console.assert(factsRes.meta?.license === 'CC BY 4.0', 'License header present')

  // 3. Test missing key returns 401
  const noKeyRes = await page.evaluate(async () => {
    const r = await fetch('http://localhost:3001/api/v1/facts')
    return { status: r.status, body: await r.json() }
  })
  console.assert(noKeyRes.status === 401, 'Missing key returns 401')
  console.assert(noKeyRes.body.docs !== undefined, '401 response includes docs URL')

  // 4. Test /categories returns nested tree
  const catRes = await page.evaluate(async (key) => {
    const r = await fetch('http://localhost:3001/api/v1/categories', {
      headers: { 'X-Api-Key': key }
    })
    return r.json()
  }, rawKey)
  console.assert(typeof catRes.data === 'object', 'Categories returns object')

  await browser.close()
  console.log('Phase 50.1 API tests passed')
})()
```

### Test 50.2 — Community submission flow

```js
// /tmp/test-phase-50-ugc.js
;(async () => {
  // Helper: get JWT token for a test user
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'TestPass123!' })
  })
  const { accessToken } = await loginRes.json()

  // 1. Submit without license consent
  const noConsentRes = await fetch('http://localhost:3001/api/ugc/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      factText: 'The Great Wall of China is visible from space.',
      correctAnswer: 'False — it is not visible from low Earth orbit',
      distractors: ['True', 'Only partially', 'Depends on weather'],
      category: ['History'], sourceUrl: 'https://nasa.gov', sourceName: 'NASA',
      licenseConsented: false
    })
  })
  console.assert(noConsentRes.status === 400, 'No consent returns 400')

  // 2. Submit valid fact with consent
  const validRes = await fetch('http://localhost:3001/api/ugc/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      factText: 'The speed of light in a vacuum is approximately 299,792 km/s.',
      correctAnswer: '299,792 km/s',
      distractors: ['150,000 km/s', '186,282 km/s', '340 m/s'],
      category: ['Natural Sciences'], sourceUrl: 'https://physics.nist.gov',
      sourceName: 'NIST', licenseConsented: true
    })
  })
  const validBody = await validRes.json()
  console.assert(validRes.status === 201, 'Valid submission returns 201')
  console.assert(
    ['community_vote', 'rejected'].includes(validBody.status),
    'Status is community_vote or rejected'
  )

  console.log('Phase 50.2 UGC tests passed')
})()
```

### Test 50.3 — Moderation and appeals

```js
// /tmp/test-phase-50-moderation.js
;(async () => {
  const { runAutoFlags } = require('/root/terra-miner/server/src/services/ugcReviewService.js')

  // 1. Test answer_in_question flag
  const flags1 = runAutoFlags(
    'The capital of France is Paris and it is a city.',
    'Paris',
    ['London', 'Berlin', 'Madrid'],
    'https://example.com',
    'test-player'
  )
  console.assert(
    flags1.some(f => f.reason === 'answer_in_question'),
    'Detects answer embedded in question'
  )

  // 2. Test URL validation flag
  const flags2 = runAutoFlags(
    'Some fact about something interesting and worth knowing.',
    'True',
    ['False', 'Sometimes', 'Never'],
    'ftp://invalid.ftp.example',
    'test-player'
  )
  console.assert(
    flags2.some(f => f.reason === 'url_unreachable' && f.severity === 'block'),
    'Non-HTTP URL triggers block flag'
  )

  console.log('Phase 50.3 moderation tests passed')
})()
```

---

## Verification Gate

All of the following must pass before Phase 50 is marked complete:

### TypeScript / Build
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` produces a clean production bundle
- [ ] All new server files compile without errors (`cd server && npx tsc --noEmit`)

### Database
- [ ] `initSchema()` runs idempotently on a fresh database, creating all 6 new tables:
  `api_keys`, `usage_logs`, `partner_orgs`, `license_grants`, `webhook_subscriptions`,
  `ugc_appeals`
- [ ] `initSchema()` runs idempotently on an existing database without errors (no duplicate
  column or table errors)

### Public API (50.1)
- [ ] `GET /api/v1/facts` without key returns `{ error: ..., docs: ... }` 401
- [ ] `GET /api/v1/facts` with valid free-tier key returns facts with `meta.license = 'CC BY 4.0'`
- [ ] Cursor pagination produces non-overlapping pages
- [ ] `GET /api/v1/facts/random?count=5` returns exactly 5 items
- [ ] Exceeding daily quota returns 429 with `resetsAt`

### UGC Submission (50.2)
- [ ] Submitting without `licenseConsented: true` returns 400
- [ ] Submitting a fact with `fuck` in text returns `status: 'rejected'` via autoFilterSubmission
- [ ] Valid submission creates a row in `ugc_submissions` with correct `status`
- [ ] Duplicate submission returns 409
- [ ] `UGCSubmitOverlay.svelte` renders a license consent checkbox

### Moderation (50.3)
- [ ] `runAutoFlags` returns `answer_in_question` warn flag when the correct answer (>4 chars)
  appears verbatim in the fact text
- [ ] `runAutoFlags` returns `url_unreachable` block flag for non-HTTP source URLs
- [ ] Filing an appeal on an approved submission returns 404
- [ ] Upholding an appeal sets `ugc_submissions.status = 'admin_review'`

### Partner Portal (50.4)
- [ ] `POST /api/partner/register` with all fields creates a `partner_orgs` row with
  `verified = 0`
- [ ] `POST /api/partner/register` with duplicate domain returns 409
- [ ] `POST /api/partner/verify/:id` (admin) issues an institutional API key and returns `rawKey`
- [ ] `GET /api/partner/dashboard` with the issued key returns `usageLast7Days` array

### Licensing (50.5)
- [ ] `generateAttribution([])` returns `licenseType: 'CC_BY_4'`
- [ ] `GET /api/v1/license` returns both fact text and pixel art license blocks without auth
- [ ] `recordLicenseGrant` inserts a row with the correct `fact_ids` JSON

### Webhooks & SDK (50.6)
- [ ] `triggerWebhook` fans out to all active subscriptions without throwing
- [ ] HMAC signature on delivery matches `sha256=<hmac>` computed from the body
- [ ] Registering a 6th webhook returns 400
- [ ] The embed widget HTML (`packages/widget/embed.html`) loads in a browser without console
  errors when given a valid API key

### Documentation (50.7)
- [ ] All 14 files listed in 50.7.1 exist under `docs/api/`
- [ ] `docs/api/authentication.md` contains the quota table matching `TIER_QUOTAS`
- [ ] `docs/api/webhooks.md` contains the `verifySignature` HMAC JavaScript example

---

## Files Affected

### New files
| File | Description |
|------|-------------|
| `server/src/routes/publicApi.ts` | Versioned public fact API endpoints |
| `server/src/routes/apiKeys.ts` | API key management CRUD (JWT-authenticated) |
| `server/src/routes/partnerPortal.ts` | Institution registration and license management |
| `server/src/routes/webhooks.ts` | Webhook subscription management |
| `server/src/services/apiKeyService.ts` | Key generation, SHA-256 hashing, quota tracking |
| `server/src/services/licenseService.ts` | CC attribution generation and license grant logging |
| `server/src/services/webhookService.ts` | Webhook delivery with HMAC signing and retry logic |
| `server/src/services/partnerService.ts` | Partner organization verification and license tier logic |
| `src/ui/components/PartnerPortalView.svelte` | Partner portal entry point (registration + dashboard) |
| `packages/widget/embed.html` | Self-contained embeddable quiz widget |
| `packages/sdk/index.ts` | TypeScript SDK wrapping all public API endpoints |
| `docs/api/index.md` | API documentation overview and quickstart |
| `docs/api/authentication.md` | API key types, usage, and security practices |
| `docs/api/rate-limiting.md` | Tier quotas, 429 handling, back-off strategy |
| `docs/api/endpoints/facts-list.md` | GET /facts endpoint reference |
| `docs/api/endpoints/facts-detail.md` | GET /facts/:id endpoint reference |
| `docs/api/endpoints/facts-random.md` | GET /facts/random endpoint reference |
| `docs/api/endpoints/categories.md` | GET /categories endpoint reference |
| `docs/api/endpoints/stats.md` | GET /stats endpoint reference |
| `docs/api/endpoints/license.md` | GET /license endpoint reference |
| `docs/api/webhooks.md` | Webhook event types, HMAC verification, retry policy |
| `docs/api/sdk.md` | JavaScript SDK quickstart and TypeScript types reference |
| `docs/api/widget.md` | Embed widget setup and customization |
| `docs/api/licensing.md` | CC license requirements and commercial licensing |
| `docs/api/partner-portal.md` | Institution registration and bulk licensing guide |
| `docs/api/changelog.md` | API version history |

### Modified files
| File | Change |
|------|--------|
| `server/src/routes/ugc.ts` | Replace stub submit/review handlers; add vote and appeal endpoints; extend `UGCSubmission` interface |
| `server/src/services/ugcReviewService.ts` | Add `runAutoFlags`, `AutoFlag`, `FlagReason` types |
| `server/src/db/migrate.ts` | Add `api_keys`, `usage_logs`, `partner_orgs`, `license_grants`, `webhook_subscriptions`, `ugc_appeals` tables |
| `server/src/index.ts` | Mount `/api/v1`, `/api/keys`, `/api/partner`, `/api/webhooks` route namespaces |
| `src/ui/components/UGCSubmitOverlay.svelte` | Add license consent checkbox; block submission without consent |
| `src/ui/components/UGCReviewQueue.svelte` | Replace placeholder with full moderator dashboard (filter tabs, submission detail, approve/reject actions) |
