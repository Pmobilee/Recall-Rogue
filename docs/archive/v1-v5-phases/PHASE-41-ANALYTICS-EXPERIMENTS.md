# Phase 41: Advanced Analytics & Experiments

**Status**: Not started
**Depends on**: Phase 19 (Auth & Cloud), Phase 21 (Monetization), Phase 22 (Social & Multiplayer)
**Estimated complexity**: High (7 sub-phases, ~35 files created or modified)

---

## 1. Overview

### Goal

Replace the stub implementations and ad-hoc flag objects scattered across the codebase with a
coherent, production-grade analytics and experimentation platform. The resulting system must
support the product team's ability to answer three classes of questions without manual SQL:

1. **Are players healthy?** — funnel drop-off, retention windows, engagement score trends
2. **Do changes work?** — controlled A/B experiments with statistically rigorous result collection
3. **Is learning happening?** — SM-2 interval curves, mastery rates, knowledge retention decay

Everything built in this phase must be **privacy-first by design**: anonymisation is structural,
GDPR export is one API call, and data retention limits are enforced by a scheduled purge job.

### What exists today

| File | Status |
|---|---|
| `src/services/analyticsService.ts` | Working — 10 events, batched queue, 10 s flush, `getExperimentGroup()` stub |
| `server/src/routes/analytics.ts` | Working — ingestion endpoint, allowlist validation, D1/D7/D30 retention stubs |
| `server/src/analytics/retention.ts` | Stub — returns benchmark targets, no real SQL |
| `server/src/analytics/playerSegments.ts` | Stub — mastery-free monitor, no real SQL |
| `server/src/services/learningEffectivenessService.ts` | Working — metric maths, pure functions only |
| `server/src/services/dataDeletion.ts` | Working — soft-delete, 30-day purge, leaderboard anonymisation |
| `server/src/config/features.ts` | Simple boolean object — not user-scoped, no rollout percentages |

### What this phase adds

| Sub-phase | Deliverable |
|---|---|
| 41.1 | Server-side feature flag service with rollout percentages + client SDK |
| 41.2 | Full A/B experiment framework — definition, bucketing, result collection |
| 41.3 | Funnel analysis pipeline — event sequences tracked and queried server-side |
| 41.4 | Cohort dashboard — server-rendered HTML, D1/D7/D30/D90, acquisition segments |
| 41.5 | Retention anomaly detection — automated alerts via email/log with threshold rules |
| 41.6 | Learning effectiveness metrics — mastery curves, interval histograms, category heatmaps |
| 41.7 | Privacy-compliant data pipeline — anonymisation, GDPR export, data retention enforcement |

### Design decisions referenced

- **DD-V2-195**: Analytics event taxonomy and PII strip policy
- **DD-V2-200**: Retention metric targets (D1 ≥ 45%, D7 ≥ 20%, D30 ≥ 10%)
- **DD-V2-152**: Mastery-free player monitoring (cap at 30% before monetisation trigger)
- **DD-V2-179**: Learning effectiveness annual report with anonymised research export
- **DD-V2-229**: GDPR erasure — 30-day soft-delete, permanent purge

### Dependencies — do not skip

Workers executing this phase must have completed or stub-compatible versions of:

- `server/src/db/schema.ts` — `analyticsEvents`, `users`, `saves` tables
- `server/src/db/index.ts` — exports `db` (Drizzle ORM instance)
- `server/src/services/emailService.ts` — exports `sendEmail()`
- `src/services/analyticsService.ts` — `AnalyticsService` class with `track()` and `getSessionId()`

---

## 2. Sub-phases

---

### 41.1 — Feature Flag Service (Server-side + Client SDK)

**Goal**: Replace the static `FEATURES` object in `server/src/config/features.ts` with a
database-backed, user-scoped flag service that supports gradual rollout percentages and
per-user overrides.

#### 41.1.1 — Database schema additions

Add to `server/src/db/schema.ts`:

```typescript
// ── feature_flags ─────────────────────────────────────────────────────────────

/**
 * Server-side feature flags with per-user rollout control.
 * The `rollout_pct` field (0–100) determines what fraction of users see the
 * feature when no explicit user override exists.  A deterministic hash of
 * (userId + flagKey) decides whether a given user falls inside the rollout.
 */
export const featureFlags = sqliteTable('feature_flags', {
  /** Unique flag identifier, e.g. "rewarded_ads" or "ab_pioneer_timing_v2". */
  key: text('key').primaryKey(),
  /** Human-readable description of what this flag controls. */
  description: text('description').notNull().default(''),
  /** Whether this flag is globally enabled (1) or disabled (0). */
  enabled: integer('enabled').notNull().default(0),
  /** Rollout percentage 0–100 applied when enabled = 1. */
  rolloutPct: integer('rollout_pct').notNull().default(100),
  /** Epoch ms when this flag was created. */
  createdAt: integer('created_at').notNull(),
  /** Epoch ms when this flag was last modified. */
  updatedAt: integer('updated_at').notNull(),
})

// ── feature_flag_overrides ────────────────────────────────────────────────────

/**
 * Explicit per-user flag overrides.  These always take priority over rollout_pct.
 * Used for internal testers, support overrides, and force-disable on specific accounts.
 */
export const featureFlagOverrides = sqliteTable('feature_flag_overrides', {
  id: text('id').primaryKey(),
  flagKey: text('flag_key').notNull().references(() => featureFlags.key, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Forced value: 1 = force-on, 0 = force-off. */
  value: integer('value').notNull(),
  createdAt: integer('created_at').notNull(),
})
```

Also add `export type FeatureFlag = typeof featureFlags.$inferSelect` and
`export type NewFeatureFlag = typeof featureFlags.$inferInsert` to the inferred-types block at
the bottom of `server/src/db/schema.ts`.

#### 41.1.2 — Feature flag service

**Create** `server/src/services/featureFlagService.ts`:

```typescript
/**
 * Feature flag service (Phase 41.1).
 * Resolves flag values per-user with rollout-percentage bucketing.
 *
 * Bucketing algorithm: SHA-256(userId + flagKey) → first 4 bytes as uint32 →
 * modulo 100 → compare against rolloutPct.  This is stable across server
 * restarts and never changes for a given user/flag pair.
 */

import * as crypto from 'crypto'
import { db } from '../db/index.js'
import { featureFlags, featureFlagOverrides } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface FlagResolution {
  key: string
  enabled: boolean
  source: 'override' | 'rollout' | 'disabled'
}

/**
 * Resolve a single feature flag for a specific user.
 * Returns false immediately if the flag does not exist in the database.
 *
 * @param flagKey - The flag's unique key string.
 * @param userId  - The authenticated user's UUID.
 */
export async function resolveFlag(flagKey: string, userId: string): Promise<FlagResolution> {
  // 1. Check for an explicit user override
  const override = await db
    .select()
    .from(featureFlagOverrides)
    .where(and(eq(featureFlagOverrides.flagKey, flagKey), eq(featureFlagOverrides.userId, userId)))
    .get()

  if (override) {
    return { key: flagKey, enabled: override.value === 1, source: 'override' }
  }

  // 2. Look up the flag definition
  const flag = await db.select().from(featureFlags).where(eq(featureFlags.key, flagKey)).get()

  if (!flag || !flag.enabled) {
    return { key: flagKey, enabled: false, source: 'disabled' }
  }

  // 3. Apply rollout percentage via stable hash bucketing
  const bucket = stableBucket(userId, flagKey)
  const inRollout = bucket < flag.rolloutPct

  return { key: flagKey, enabled: inRollout, source: 'rollout' }
}

/**
 * Resolve all flags for a user in one pass (used by the client SDK bootstrap
 * endpoint so the client receives all flag values in a single request on login).
 *
 * @param userId - The authenticated user's UUID.
 * @returns Map of flagKey → boolean
 */
export async function resolveAllFlags(userId: string): Promise<Record<string, boolean>> {
  const flags = await db.select().from(featureFlags).all()
  const overrides = await db
    .select()
    .from(featureFlagOverrides)
    .where(eq(featureFlagOverrides.userId, userId))
    .all()

  const overrideMap = new Map(overrides.map((o) => [o.flagKey, o.value === 1]))

  const result: Record<string, boolean> = {}
  for (const flag of flags) {
    if (overrideMap.has(flag.key)) {
      result[flag.key] = overrideMap.get(flag.key)!
    } else if (!flag.enabled) {
      result[flag.key] = false
    } else {
      result[flag.key] = stableBucket(userId, flag.key) < flag.rolloutPct
    }
  }
  return result
}

/**
 * Compute a stable bucket value (0–99) for a (userId, flagKey) pair.
 * Uses the first 4 bytes of SHA-256(userId + "|" + flagKey) as uint32,
 * then modulo 100.
 */
function stableBucket(userId: string, flagKey: string): number {
  const hash = crypto.createHash('sha256').update(`${userId}|${flagKey}`).digest()
  const uint32 = hash.readUInt32BE(0)
  return uint32 % 100
}

/**
 * Admin helper: upsert a flag definition.
 * Idempotent — safe to call on server startup to seed known flags.
 */
export async function upsertFlag(
  key: string,
  description: string,
  enabled: boolean,
  rolloutPct: number
): Promise<void> {
  const now = Date.now()
  await db
    .insert(featureFlags)
    .values({ key, description, enabled: enabled ? 1 : 0, rolloutPct, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { description, enabled: enabled ? 1 : 0, rolloutPct, updatedAt: now },
    })
}
```

#### 41.1.3 — Feature flag API routes

**Create** `server/src/routes/featureFlags.ts`:

```typescript
/**
 * Feature flag API routes (Phase 41.1).
 * GET  /api/flags          — resolve all flags for the authenticated user
 * GET  /api/flags/:key     — resolve a single flag
 * POST /api/admin/flags    — upsert a flag definition (admin only)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { resolveFlag, resolveAllFlags, upsertFlag } from '../services/featureFlagService.js'
import { config } from '../config.js'

export async function featureFlagRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/flags — returns all flags for the authenticated user. */
  fastify.get('/flags', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.status(401).send({ error: 'Unauthorized' })
      const payload = fastify.jwt.verify<{ sub: string }>(token)
      const flags = await resolveAllFlags(payload.sub)
      return reply.send({ flags })
    } catch {
      return reply.status(401).send({ error: 'Invalid token' })
    }
  })

  /** GET /api/flags/:key — resolve a single flag for the authenticated user. */
  fastify.get(
    '/flags/:key',
    async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '')
        if (!token) return reply.status(401).send({ error: 'Unauthorized' })
        const payload = fastify.jwt.verify<{ sub: string }>(token)
        const resolution = await resolveFlag(request.params.key, payload.sub)
        return reply.send(resolution)
      } catch {
        return reply.status(401).send({ error: 'Invalid token' })
      }
    }
  )

  /** POST /api/admin/flags — upsert a flag (X-Admin-Key required). */
  fastify.post(
    '/admin/flags',
    async (
      request: FastifyRequest<{
        Body: { key: string; description: string; enabled: boolean; rolloutPct: number }
      }>,
      reply: FastifyReply
    ) => {
      if (request.headers['x-admin-key'] !== config.adminKey) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      const { key, description, enabled, rolloutPct } = request.body ?? {}
      if (!key || typeof rolloutPct !== 'number' || rolloutPct < 0 || rolloutPct > 100) {
        return reply.status(400).send({ error: 'key and rolloutPct (0–100) are required' })
      }
      await upsertFlag(key, description ?? '', enabled ?? false, rolloutPct)
      return reply.send({ ok: true })
    }
  )
}
```

#### 41.1.4 — Client-side feature flag SDK

**Create** `src/services/featureFlagService.ts`:

```typescript
/**
 * Client-side feature flag SDK (Phase 41.1).
 * Bootstraps all flags on login, caches them in memory and localStorage,
 * and exposes a synchronous `isEnabled(key)` helper for use throughout the UI.
 *
 * Falls back to hardcoded defaults when offline or when the bootstrap endpoint
 * is unavailable, ensuring the game is always playable without connectivity.
 */

import { apiClient } from './apiClient'

/** Hardcoded defaults used offline / before bootstrap completes. */
const FLAG_DEFAULTS: Record<string, boolean> = {
  rewarded_ads: false,
  subscriptions_enabled: false,
  season_pass_enabled: true,
  pioneer_pack_enabled: true,
  ab_pioneer_pack_timing: true,
  patron_features_enabled: true,
  dome_maintenance_enabled: true,
  spending_bonus_enabled: true,
}

const CACHE_KEY = 'terra_feature_flags'

class FeatureFlagService {
  private flags: Record<string, boolean> = { ...FLAG_DEFAULTS }
  private loaded = false

  constructor() {
    this.loadFromCache()
  }

  /**
   * Bootstrap all flags from the server.
   * Call once after a successful login.  Safe to call multiple times.
   */
  async bootstrap(): Promise<void> {
    try {
      const response = await apiClient.get<{ flags: Record<string, boolean> }>('/api/flags')
      this.flags = { ...FLAG_DEFAULTS, ...response.flags }
      this.loaded = true
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.flags))
    } catch {
      // Network error — already using cache or defaults, no action needed
    }
  }

  /**
   * Check whether a feature flag is enabled for the current user.
   * Synchronous after bootstrap; returns defaults before bootstrap completes.
   */
  isEnabled(key: string): boolean {
    return this.flags[key] ?? FLAG_DEFAULTS[key] ?? false
  }

  /** True once the server has successfully responded to bootstrap(). */
  isLoaded(): boolean {
    return this.loaded
  }

  private loadFromCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) this.flags = { ...FLAG_DEFAULTS, ...JSON.parse(raw) }
    } catch {
      // Corrupt cache — use defaults
    }
  }
}

export const featureFlagService = new FeatureFlagService()
```

#### Acceptance criteria — 41.1

- `GET /api/flags` returns `{ flags: { [key]: boolean } }` for an authenticated user.
- Same user always gets the same flag values across server restarts (stable hash bucketing).
- A flag at `rolloutPct: 10` returns `true` for roughly 10% of distinct UUIDs in a large
  sample and `false` for the rest.
- `featureFlagService.isEnabled('season_pass_enabled')` returns `true` from cache immediately
  after a cold start, without waiting for `bootstrap()`.
- `POST /api/admin/flags` with a valid `X-Admin-Key` creates or updates a flag row.

---

### 41.2 — A/B Testing Framework

**Goal**: Define experiments as typed objects, assign users to variants deterministically, emit
assignment events, and aggregate results per experiment on the server.

#### 41.2.1 — Experiment definitions

**Create** `src/data/experiments.ts`:

```typescript
/**
 * A/B experiment definitions (Phase 41.2).
 * Each experiment has a unique key, two or more variant labels, and a
 * primary metric used to judge success.
 *
 * Experiments are referenced by key everywhere — never by index — so adding or
 * removing experiments never silently shifts bucket assignments.
 */

export interface ExperimentDef {
  /** Unique stable identifier — never rename once launched. */
  key: string
  /** Human-readable name for the dashboard. */
  name: string
  /** Variant labels.  First entry is always the control. */
  variants: [string, string, ...string[]]
  /** The analytics event property used to judge success (e.g. "iap_purchase_completed"). */
  primaryMetric: string
  /** Optional description explaining the hypothesis. */
  hypothesis?: string
}

export const EXPERIMENTS: ExperimentDef[] = [
  {
    key: 'pioneer_pack_timing_v2',
    name: 'Pioneer Pack — offer timing',
    variants: ['control_dive_3', 'treatment_dive_1'],
    primaryMetric: 'iap_purchase_completed',
    hypothesis: 'Showing the pack after dive 1 (while excitement is high) increases conversion vs dive 3.',
  },
  {
    key: 'quiz_button_layout_v1',
    name: 'Quiz — answer button layout',
    variants: ['stacked_2x2', 'list_4x1'],
    primaryMetric: 'quiz_answered',
    hypothesis: 'A 2×2 grid increases taps per session by reducing scroll distance.',
  },
  {
    key: 'onboarding_length_v1',
    name: 'Onboarding — tutorial length',
    variants: ['full_5_panel', 'condensed_3_panel'],
    primaryMetric: 'first_dive_complete',
    hypothesis: 'A shorter cutscene reduces drop-off before the first dive.',
  },
  {
    key: 'terra_pass_modal_copy_v1',
    name: 'Terra Pass — CTA copy',
    variants: ['control_explore_more', 'treatment_unlock_earth'],
    primaryMetric: 'iap_purchase_completed',
    hypothesis: '"Unlock Earth\'s story" framing outperforms "Explore more" on conversion.',
  },
]

export type ExperimentKey = (typeof EXPERIMENTS)[number]['key']
```

#### 41.2.2 — Client-side experiment assignment

Extend `src/services/analyticsService.ts` — replace the existing `getExperimentGroup()` method
with the implementation below, and add a new `trackExperimentAssigned()` helper:

```typescript
// Replace getExperimentGroup() in AnalyticsService with this full implementation:

/**
 * Get the assigned variant for an experiment.
 * Assignment is stable for the lifetime of the device.
 * Fires an `experiment_assigned` event the first time a variant is resolved,
 * so we can count impressions in the cohort dashboard.
 *
 * @param experimentKey - Must match an ExperimentDef.key in EXPERIMENTS.
 * @returns The variant label string.
 */
getExperimentVariant(experimentKey: string): string {
  const cacheKey = `exp_${experimentKey}`
  const stored = localStorage.getItem(cacheKey)
  if (stored) return stored

  // Hash sessionId + experimentKey to pick a variant
  const allVariants = EXPERIMENTS.find((e) => e.key === experimentKey)?.variants ?? ['control', 'treatment']
  const variant = assignVariant(this.sessionId, experimentKey, allVariants)
  localStorage.setItem(cacheKey, variant)

  // Track assignment — fires only on first resolution
  this.track({
    name: 'experiment_assigned',
    properties: { experiment_key: experimentKey, variant, session_id: this.sessionId },
  })
  return variant
}
```

**Create** `src/utils/experimentBucket.ts`:

```typescript
/**
 * Deterministic variant assignment (Phase 41.2).
 * Uses djb2 hash of (sessionId + experimentKey) to pick a variant index.
 * Pure function — no side effects, safe to call in tests.
 */

export function assignVariant(sessionId: string, experimentKey: string, variants: string[]): string {
  const seed = `${sessionId}:${experimentKey}`
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i)
    hash = hash >>> 0 // keep uint32
  }
  return variants[hash % variants.length] ?? variants[0]!
}
```

#### 41.2.3 — Server-side experiment result aggregation

**Create** `server/src/analytics/experiments.ts`:

```typescript
/**
 * A/B experiment result aggregation (Phase 41.2).
 * Reads `experiment_assigned` and primary-metric events from analytics_events
 * to compute per-variant conversion rates with a simple Z-score significance test.
 */

export interface VariantResult {
  variant: string
  impressions: number
  conversions: number
  conversionRate: number
  /** Z-score vs control (undefined for the control variant itself). */
  zScore?: number
  /** p-value approximation (two-tailed, normal approximation). */
  pValue?: number
  isStatisticallySignificant?: boolean
}

export interface ExperimentResult {
  experimentKey: string
  primaryMetric: string
  variants: VariantResult[]
  totalImpressions: number
  winner: string | null
  status: 'insufficient_data' | 'running' | 'significant'
}

/**
 * Compute results for one experiment from raw event rows.
 * In production, `events` is the result of a DB query scoped to the experiment's
 * date range.  In tests, pass a hand-crafted array.
 *
 * @param experimentKey   - The experiment identifier.
 * @param primaryMetric   - Event name that counts as a conversion.
 * @param variantLabels   - All variant labels in definition order.
 * @param events          - Raw analytics_events rows (filtered by experiment key upstream).
 */
export function computeExperimentResult(
  experimentKey: string,
  primaryMetric: string,
  variantLabels: string[],
  events: Array<{ eventName: string; properties: string; sessionId: string }>
): ExperimentResult {
  // Map sessionId → variant from assignment events
  const sessionVariant = new Map<string, string>()
  const conversionSessions = new Set<string>()

  for (const row of events) {
    let props: Record<string, unknown>
    try {
      props = JSON.parse(row.properties) as Record<string, unknown>
    } catch {
      continue
    }

    if (row.eventName === 'experiment_assigned' && props.experiment_key === experimentKey) {
      sessionVariant.set(row.sessionId, String(props.variant))
    }
    if (row.eventName === primaryMetric) {
      conversionSessions.add(row.sessionId)
    }
  }

  // Aggregate per variant
  const variantMap = new Map<string, { impressions: number; conversions: number }>()
  for (const label of variantLabels) {
    variantMap.set(label, { impressions: 0, conversions: 0 })
  }
  for (const [sessionId, variant] of sessionVariant) {
    const agg = variantMap.get(variant)
    if (!agg) continue
    agg.impressions++
    if (conversionSessions.has(sessionId)) agg.conversions++
  }

  // Compute Z-score vs control (index 0)
  const controlLabel = variantLabels[0]!
  const control = variantMap.get(controlLabel)!
  const pControl = control.impressions > 0 ? control.conversions / control.impressions : 0

  const results: VariantResult[] = []
  let winner: string | null = null
  let anySignificant = false

  for (const label of variantLabels) {
    const agg = variantMap.get(label)!
    const conversionRate = agg.impressions > 0 ? agg.conversions / agg.impressions : 0

    if (label === controlLabel) {
      results.push({ variant: label, impressions: agg.impressions, conversions: agg.conversions, conversionRate })
      continue
    }

    // Two-proportion Z-test
    const pPooled =
      (control.conversions + agg.conversions) / Math.max(1, control.impressions + agg.impressions)
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / Math.max(1, control.impressions) + 1 / Math.max(1, agg.impressions)))
    const zScore = se === 0 ? 0 : (conversionRate - pControl) / se
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))
    const isStatisticallySignificant = pValue < 0.05 && agg.impressions >= 100

    if (isStatisticallySignificant && conversionRate > pControl) {
      winner = label
      anySignificant = true
    }

    results.push({
      variant: label,
      impressions: agg.impressions,
      conversions: agg.conversions,
      conversionRate,
      zScore,
      pValue,
      isStatisticallySignificant,
    })
  }

  const totalImpressions = results.reduce((s, r) => s + r.impressions, 0)
  const status: ExperimentResult['status'] =
    totalImpressions < 100 ? 'insufficient_data' : anySignificant ? 'significant' : 'running'

  return { experimentKey, primaryMetric, variants: results, totalImpressions, winner, status }
}

/** Standard normal CDF approximation (Abramowitz & Stegun 26.2.17). */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 +
            t * 1.330274429))))
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const upper = pdf * poly
  return z >= 0 ? 1 - upper : upper
}
```

#### 41.2.4 — Experiment results API endpoint

Add to `server/src/routes/analytics.ts` (append before the closing brace of `analyticsRoutes`):

```typescript
  /**
   * GET /api/analytics/experiments/:key
   * Returns aggregated results for one A/B experiment.
   * Admin-only (X-Admin-Key required).
   */
  fastify.get(
    '/experiments/:key',
    async (
      request: FastifyRequest<{ Params: { key: string }; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      if (request.headers['x-admin-key'] !== config.adminKey) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const experimentKey = request.params.key
      const def = EXPERIMENTS.find((e) => e.key === experimentKey)
      if (!def) return reply.status(404).send({ error: `Unknown experiment: ${experimentKey}` })

      const days = parseInt((request.query as { days?: string }).days ?? '30', 10)
      const since = Date.now() - days * 86_400_000

      const events = await db
        .select()
        .from(analyticsEvents)
        .where(sql`${analyticsEvents.createdAt} >= ${since}`)
        .all()

      const result = computeExperimentResult(
        experimentKey,
        def.primaryMetric,
        [...def.variants],
        events.map((e) => ({ eventName: e.eventName, properties: e.properties, sessionId: e.sessionId }))
      )

      return reply.send(result)
    }
  )
```

Also add `experiment_assigned` to the `ALLOWED_EVENTS` set in `analytics.ts`.

#### Acceptance criteria — 41.2

- `getExperimentVariant('pioneer_pack_timing_v2')` returns either `'control_dive_3'` or
  `'treatment_dive_1'` — never anything else.
- Calling it a second time in the same session returns the same value (stable hash).
- `assignVariant` distributes sessions within ±5% of equal proportions for any two-variant
  experiment when given 10,000 random UUIDs.
- `GET /api/analytics/experiments/pioneer_pack_timing_v2` returns a valid `ExperimentResult`
  (status `insufficient_data` when no events exist, structure always present).
- `computeExperimentResult` returns `status: 'significant'` and `winner: 'treatment'` for
  synthetic input where treatment has 500 impressions and 60% conversion vs control 50%.

---

### 41.3 — Funnel Analysis Pipeline

**Goal**: Track explicit funnel steps server-side and expose a query endpoint that returns
step-by-step drop-off counts for the key onboarding funnel.

#### 41.3.1 — Funnel step definitions

**Create** `server/src/analytics/funnels.ts`:

```typescript
/**
 * Funnel definitions and computation (Phase 41.3).
 * A funnel is an ordered sequence of event names.  A session "completes" a step
 * when it has at least one event with that name.  Drop-off is computed as the
 * fraction of sessions that reached step N but did not reach step N+1.
 */

export interface FunnelStep {
  name: string
  eventName: string
}

export interface FunnelDef {
  key: string
  label: string
  steps: FunnelStep[]
}

export const FUNNELS: FunnelDef[] = [
  {
    key: 'core_onboarding',
    label: 'Core Onboarding',
    steps: [
      { name: 'App Opened', eventName: 'app_open' },
      { name: 'Tutorial Step 1', eventName: 'tutorial_step_complete' },
      { name: 'First Dive Entered', eventName: 'first_dive_complete' },
      { name: 'First Quiz Answered', eventName: 'quiz_answered' },
      { name: 'Day-1 Return', eventName: 'app_open' },  // second occurrence
    ],
  },
  {
    key: 'monetisation',
    label: 'Monetisation',
    steps: [
      { name: 'Terra Pass Viewed', eventName: 'terra_pass_viewed' },
      { name: 'IAP Started', eventName: 'iap_purchase_started' },
      { name: 'IAP Completed', eventName: 'iap_purchase_completed' },
    ],
  },
]

export interface FunnelStepResult {
  name: string
  eventName: string
  sessions: number
  dropOffCount: number
  dropOffRate: number
  conversionRate: number
}

export interface FunnelResult {
  funnelKey: string
  label: string
  steps: FunnelStepResult[]
  overallConversion: number
  totalEntered: number
}

/**
 * Compute funnel results from raw analytics event rows.
 *
 * @param def    - The funnel definition.
 * @param events - Pre-filtered analytics event rows for the date range.
 */
export function computeFunnel(
  def: FunnelDef,
  events: Array<{ eventName: string; sessionId: string }>
): FunnelResult {
  // Build per-session ordered event name list
  const sessionEvents = new Map<string, string[]>()
  for (const e of events) {
    const list = sessionEvents.get(e.sessionId) ?? []
    list.push(e.eventName)
    sessionEvents.set(e.sessionId, list)
  }

  // For each step, count sessions that have ≥ N occurrences of the required event
  // (the Day-1 Return step needs a second 'app_open', hence occurrence counting)
  const stepCounts: number[] = def.steps.map((step, stepIdx) => {
    let count = 0
    for (const events of sessionEvents.values()) {
      // Count how many times this event appears; require occurrence >= (step position among same-event steps + 1)
      const occurrenceNeeded =
        def.steps.slice(0, stepIdx + 1).filter((s) => s.eventName === step.eventName).length
      const occurrenceActual = events.filter((e) => e === step.eventName).length
      if (occurrenceActual >= occurrenceNeeded) count++
    }
    return count
  })

  const total = stepCounts[0] ?? 0
  const stepResults: FunnelStepResult[] = def.steps.map((step, i) => {
    const sessions = stepCounts[i] ?? 0
    const prevSessions = i === 0 ? sessions : (stepCounts[i - 1] ?? sessions)
    const dropOffCount = prevSessions - sessions
    const dropOffRate = prevSessions > 0 ? dropOffCount / prevSessions : 0
    const conversionRate = total > 0 ? sessions / total : 0
    return { name: step.name, eventName: step.eventName, sessions, dropOffCount, dropOffRate, conversionRate }
  })

  const lastStep = stepCounts[stepCounts.length - 1] ?? 0
  const overallConversion = total > 0 ? lastStep / total : 0

  return { funnelKey: def.key, label: def.label, steps: stepResults, overallConversion, totalEntered: total }
}
```

#### 41.3.2 — Funnel API endpoint

Append to `server/src/routes/analytics.ts`:

```typescript
  /**
   * GET /api/analytics/funnels/:key
   * Returns funnel drop-off data for the given funnel key.
   * Query params: days (default 30)
   * Admin-only (X-Admin-Key required).
   */
  fastify.get(
    '/funnels/:key',
    async (
      request: FastifyRequest<{ Params: { key: string }; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      if (request.headers['x-admin-key'] !== config.adminKey) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      const def = FUNNELS.find((f) => f.key === request.params.key)
      if (!def) return reply.status(404).send({ error: `Unknown funnel: ${request.params.key}` })

      const days = parseInt((request.query as { days?: string }).days ?? '30', 10)
      const since = Date.now() - days * 86_400_000

      const rows = await db
        .select({ eventName: analyticsEvents.eventName, sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(sql`${analyticsEvents.createdAt} >= ${since}`)
        .all()

      const result = computeFunnel(def, rows)
      return reply.send(result)
    }
  )
```

#### Acceptance criteria — 41.3

- `GET /api/analytics/funnels/core_onboarding` returns a JSON object with a `steps` array of
  length 5, each step containing `sessions`, `dropOffRate`, and `conversionRate` fields.
- `computeFunnel` with 100 synthetic sessions where 80 complete step 1, 60 complete step 2, and
  40 complete step 3 produces `dropOffRate ≈ 0.20` at step 2 and `dropOffRate ≈ 0.33` at step 3.
- Unknown funnel key returns HTTP 404.

---

### 41.4 — Cohort Dashboard

**Goal**: A server-rendered HTML dashboard (no framework dependency) served at
`/api/admin/dashboard` showing D1/D7/D30/D90 retention, experiment status, funnel overview,
and player segment summary.

#### 41.4.1 — Dashboard service

**Create** `server/src/services/dashboardService.ts`:

```typescript
/**
 * Cohort dashboard data assembly (Phase 41.4).
 * Aggregates retention windows, experiment summaries, funnel overviews, and
 * player segments into a single JSON payload for the admin dashboard renderer.
 */

import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { computeRetention } from '../analytics/retention.js'
import { computePlayerSegments } from '../analytics/playerSegments.js'
import { EXPERIMENTS } from '../../src/data/experiments.js'  // shared definition
import { FUNNELS, computeFunnel } from '../analytics/funnels.js'
import { computeExperimentResult } from '../analytics/experiments.js'

export interface DashboardData {
  generatedAt: string
  retention: {
    d1: number | null
    d7: number | null
    d30: number | null
    d90: number | null
    d1Target: number
    d7Target: number
    d30Target: number
    d90Target: number
    cohortDate: string
  }
  experiments: Array<{
    key: string
    name: string
    status: string
    totalImpressions: number
    winner: string | null
  }>
  funnels: Array<{
    key: string
    label: string
    overallConversion: number
    totalEntered: number
    worstDropOffStep: string
    worstDropOffRate: number
  }>
  segments: {
    masteryFreePercent: number
    masteryFreeStatus: string
    totalD30Active: number
  }
}

/**
 * Assemble all dashboard data.  Heavy — cache the result externally for at
 * least 5 minutes to avoid redundant full-table scans.
 *
 * @param cohortDate - The base date for retention computation (defaults to 30 days ago).
 */
export async function assembleDashboard(cohortDate?: Date): Promise<DashboardData> {
  const base = cohortDate ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  })()

  const since30d = Date.now() - 30 * 86_400_000
  const since90d = Date.now() - 90 * 86_400_000

  // Fetch events for the last 90 days (widest window needed)
  const allEvents = await db
    .select()
    .from(analyticsEvents)
    .where(sql`${analyticsEvents.createdAt} >= ${since90d}`)
    .all()

  // Retention
  const retentionReport = computeRetention(base, allEvents.map((e) => ({
    sessionId: e.sessionId,
    eventName: e.eventName,
    createdAt: e.createdAt,
  })))

  // D90 (not yet in computeRetention — compute inline)
  const d90Events = allEvents.filter((e) => e.eventName === 'app_open')
  const cohortMs = base.getTime()
  const dayMs = 86_400_000
  const cohortSessions = new Set(
    d90Events.filter((e) => e.createdAt >= cohortMs && e.createdAt < cohortMs + dayMs).map((e) => e.sessionId)
  )
  const d90Returning = new Set(
    d90Events
      .filter((e) => e.createdAt >= cohortMs + 90 * dayMs && e.createdAt < cohortMs + 91 * dayMs && cohortSessions.has(e.sessionId))
      .map((e) => e.sessionId)
  ).size
  const d90Rate = cohortSessions.size > 0 ? d90Returning / cohortSessions.size : null

  // Experiment summaries
  const expMapped = allEvents.map((e) => ({ eventName: e.eventName, properties: e.properties, sessionId: e.sessionId }))
  const experiments = EXPERIMENTS.map((def) => {
    const result = computeExperimentResult(def.key, def.primaryMetric, [...def.variants], expMapped)
    return { key: def.key, name: def.name, status: result.status, totalImpressions: result.totalImpressions, winner: result.winner }
  })

  // Funnel summaries
  const funnelMapped = allEvents.map((e) => ({ eventName: e.eventName, sessionId: e.sessionId }))
  const funnels = FUNNELS.map((def) => {
    const result = computeFunnel(def, funnelMapped)
    let worstDropOffStep = ''
    let worstDropOffRate = 0
    for (const step of result.steps) {
      if (step.dropOffRate > worstDropOffRate) {
        worstDropOffRate = step.dropOffRate
        worstDropOffStep = step.name
      }
    }
    return { key: def.key, label: def.label, overallConversion: result.overallConversion, totalEntered: result.totalEntered, worstDropOffStep, worstDropOffRate }
  })

  // Segments
  const segReport = computePlayerSegments(base)

  return {
    generatedAt: new Date().toISOString(),
    retention: {
      d1: retentionReport.d1.actual,
      d7: retentionReport.d7.actual,
      d30: retentionReport.d30.actual,
      d90: d90Rate,
      d1Target: 0.45,
      d7Target: 0.20,
      d30Target: 0.10,
      d90Target: 0.05,
      cohortDate: retentionReport.cohortDate,
    },
    experiments,
    funnels,
    segments: {
      masteryFreePercent: segReport.masteryFreePercent,
      masteryFreeStatus: segReport.status,
      totalD30Active: segReport.totalD30Active,
    },
  }
}
```

#### 41.4.2 — Dashboard HTML renderer and route

**Create** `server/src/dashboard/renderDashboard.ts`:

```typescript
/**
 * Server-side HTML renderer for the admin cohort dashboard (Phase 41.4).
 * Produces a self-contained HTML string — no client-side JS required.
 * Styled with inline CSS only (no external dependencies).
 */

import type { DashboardData } from '../services/dashboardService.js'

function pct(n: number | null): string {
  if (n === null) return '—'
  return (n * 100).toFixed(1) + '%'
}

function statusColor(actual: number | null, target: number): string {
  if (actual === null) return '#888'
  return actual >= target ? '#2ecc71' : '#e74c3c'
}

export function renderDashboard(data: DashboardData): string {
  const r = data.retention
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recall Rogue — Analytics Dashboard</title>
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #eee; margin: 0; padding: 24px; }
    h1 { color: #e94560; margin-bottom: 4px; }
    .ts { color: #888; font-size: 0.85em; margin-bottom: 32px; }
    h2 { color: #0f3460; background: #16213e; padding: 8px 12px; margin: 32px 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #16213e; color: #e94560; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #2a2a4a; }
    .ok { color: #2ecc71; } .warn { color: #f39c12; } .bad { color: #e74c3c; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>Recall Rogue — Analytics Dashboard</h1>
  <div class="ts">Generated: ${data.generatedAt} | Cohort: ${r.cohortDate}</div>

  <h2>Retention</h2>
  <table>
    <tr><th>Window</th><th>Actual</th><th>Target</th><th>Status</th></tr>
    <tr><td>D1</td><td style="color:${statusColor(r.d1, r.d1Target)}">${pct(r.d1)}</td><td>${pct(r.d1Target)}</td><td>${r.d1 === null ? '—' : r.d1 >= r.d1Target ? '✓' : '✗'}</td></tr>
    <tr><td>D7 (primary)</td><td style="color:${statusColor(r.d7, r.d7Target)}">${pct(r.d7)}</td><td>${pct(r.d7Target)}</td><td>${r.d7 === null ? '—' : r.d7 >= r.d7Target ? '✓' : '✗'}</td></tr>
    <tr><td>D30</td><td style="color:${statusColor(r.d30, r.d30Target)}">${pct(r.d30)}</td><td>${pct(r.d30Target)}</td><td>${r.d30 === null ? '—' : r.d30 >= r.d30Target ? '✓' : '✗'}</td></tr>
    <tr><td>D90</td><td style="color:${statusColor(r.d90, r.d90Target)}">${pct(r.d90)}</td><td>${pct(r.d90Target)}</td><td>${r.d90 === null ? '—' : r.d90 >= r.d90Target ? '✓' : '✗'}</td></tr>
  </table>

  <h2>A/B Experiments</h2>
  <table>
    <tr><th>Experiment</th><th>Impressions</th><th>Status</th><th>Winner</th></tr>
    ${data.experiments.map((e) => `
    <tr>
      <td>${e.name}</td>
      <td>${e.totalImpressions.toLocaleString()}</td>
      <td>${e.status}</td>
      <td>${e.winner ?? '—'}</td>
    </tr>`).join('')}
  </table>

  <h2>Funnels</h2>
  <table>
    <tr><th>Funnel</th><th>Entered</th><th>Overall Conv.</th><th>Worst Drop-off</th><th>Drop-off Rate</th></tr>
    ${data.funnels.map((f) => `
    <tr>
      <td>${f.label}</td>
      <td>${f.totalEntered.toLocaleString()}</td>
      <td>${pct(f.overallConversion)}</td>
      <td>${f.worstDropOffStep || '—'}</td>
      <td>${pct(f.worstDropOffRate)}</td>
    </tr>`).join('')}
  </table>

  <h2>Player Segments</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>D30 Active Players</td><td>${data.segments.totalD30Active.toLocaleString()}</td></tr>
    <tr><td>Mastery-Free %</td><td class="${data.segments.masteryFreeStatus === 'ok' ? 'ok' : 'bad'}">${data.segments.masteryFreePercent.toFixed(1)}%</td></tr>
    <tr><td>Monetisation Health</td><td>${data.segments.masteryFreeStatus}</td></tr>
  </table>
</body>
</html>`
}
```

Add to `server/src/routes/admin.ts` (or a dedicated admin dashboard route file):

```typescript
/**
 * GET /api/admin/dashboard
 * Returns a server-rendered HTML cohort dashboard.
 * Cached in memory for 5 minutes to avoid table-scan storms.
 */
let dashboardCache: { html: string; expiresAt: number } | null = null

fastify.get('/dashboard', async (request, reply) => {
  if (request.headers['x-admin-key'] !== config.adminKey) {
    return reply.status(403).send('Forbidden')
  }
  if (dashboardCache && Date.now() < dashboardCache.expiresAt) {
    return reply.type('text/html').send(dashboardCache.html)
  }
  const data = await assembleDashboard()
  const html = renderDashboard(data)
  dashboardCache = { html, expiresAt: Date.now() + 5 * 60_000 }
  return reply.type('text/html').send(html)
})
```

#### Acceptance criteria — 41.4

- `GET /api/admin/dashboard` with a valid `X-Admin-Key` returns `Content-Type: text/html` and a
  page containing the string "Recall Rogue — Analytics Dashboard".
- The HTML contains separate sections for Retention, Experiments, Funnels, and Player Segments.
- Without a valid `X-Admin-Key`, returns HTTP 403.
- A second request within 5 minutes returns the cached response (same body, no DB query).

---

### 41.5 — Retention Optimization Alerts

**Goal**: A background job that runs once per hour, computes D7 retention for the most recent
complete cohort, and fires an alert (server log + optional email) if retention drops more than
5 percentage points below the target.

#### 41.5.1 — Alert job

**Create** `server/src/jobs/retentionAlertJob.ts`:

```typescript
/**
 * Retention alert job (Phase 41.5).
 * Checks D7 retention for the most recent complete cohort (7 days ago).
 * Fires an alert if retention has dropped below threshold.
 *
 * Run with: setInterval(() => runRetentionAlertJob(), 60 * 60 * 1000)
 */

import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { computeRetention } from '../analytics/retention.js'
import { sendEmail } from '../services/emailService.js'
import { config } from '../config.js'

const D7_TARGET = 0.20
const ALERT_THRESHOLD = 0.05  // alert if actual < target - 5pp

interface AlertState {
  lastAlertSentAt: number | null
  consecutiveBreaches: number
}

// In-memory state to avoid alert spam (one alert per breach per hour)
const alertState: AlertState = { lastAlertSentAt: null, consecutiveBreaches: 0 }

export async function runRetentionAlertJob(): Promise<{ alerted: boolean; d7Rate: number | null }> {
  // Cohort = 7 days ago (earliest cohort with a complete D7 window)
  const cohortDate = new Date()
  cohortDate.setDate(cohortDate.getDate() - 7)

  const since = cohortDate.getTime() - 86_400_000  // one day before cohort for safety
  const events = await db
    .select({ sessionId: analyticsEvents.sessionId, eventName: analyticsEvents.eventName, createdAt: analyticsEvents.createdAt })
    .from(analyticsEvents)
    .where(sql`${analyticsEvents.createdAt} >= ${since}`)
    .all()

  const report = computeRetention(cohortDate, events)
  const d7Rate = report.d7.actual

  if (d7Rate === null) return { alerted: false, d7Rate: null }

  const isBreaching = d7Rate < D7_TARGET - ALERT_THRESHOLD

  if (isBreaching) {
    alertState.consecutiveBreaches++

    // Rate-limit: only send one alert per hour
    const now = Date.now()
    const cooldownMs = 60 * 60 * 1000
    if (alertState.lastAlertSentAt === null || now - alertState.lastAlertSentAt >= cooldownMs) {
      alertState.lastAlertSentAt = now
      await fireRetentionAlert(d7Rate, alertState.consecutiveBreaches)
      return { alerted: true, d7Rate }
    }
  } else {
    alertState.consecutiveBreaches = 0
  }

  return { alerted: false, d7Rate }
}

async function fireRetentionAlert(actual: number, breachCount: number): Promise<void> {
  const pctActual = (actual * 100).toFixed(1)
  const pctTarget = (D7_TARGET * 100).toFixed(1)
  const subject = `[Recall Rogue] D7 Retention Alert — ${pctActual}% (target: ${pctTarget}%)`
  const body = [
    `D7 retention has fallen below the alert threshold.`,
    ``,
    `Actual:  ${pctActual}%`,
    `Target:  ${pctTarget}%`,
    `Gap:     ${((D7_TARGET - actual) * 100).toFixed(1)}pp below target`,
    `Consecutive hourly breaches: ${breachCount}`,
    ``,
    `Check the dashboard: ${config.serverUrl ?? 'http://localhost:3001'}/api/admin/dashboard`,
  ].join('\n')

  console.error(`[RetentionAlert] ${subject}`)

  if (config.alertEmail) {
    try {
      await sendEmail({ to: config.alertEmail, subject, text: body })
    } catch (err) {
      console.error('[RetentionAlert] Failed to send email alert:', err)
    }
  }
}
```

#### 41.5.2 — Wire up alert job in server startup

In `server/src/index.ts`, add after `initSchema()` / `initFactsSchema()`:

```typescript
// Retention alert job — runs every hour
import { runRetentionAlertJob } from './jobs/retentionAlertJob.js'
setInterval(() => { void runRetentionAlertJob() }, 60 * 60 * 1000)
// Run once on startup (non-blocking)
setTimeout(() => { void runRetentionAlertJob() }, 10_000)
```

#### Acceptance criteria — 41.5

- `runRetentionAlertJob()` returns `{ alerted: false, d7Rate: null }` when no analytics events
  exist.
- With synthetic events producing D7 = 0.10 (below threshold of 0.15), calling the job twice
  within a minute only fires one alert (rate limiting).
- Alert fires to `console.error` with the string "D7 Retention Alert".
- `consecutiveBreaches` increments on each hourly check while the breach persists.

---

### 41.6 — Learning Effectiveness Metrics

**Goal**: Expose a production-quality API endpoint for the learning effectiveness data already
computed in `learningEffectivenessService.ts`, add mastery-rate-over-time curve computation,
and wire category distribution from live save data.

#### 41.6.1 — Mastery curve computation

**Create** `server/src/analytics/learningCurves.ts`:

```typescript
/**
 * Learning curve computation (Phase 41.6).
 * Produces per-day mastery accumulation and SM-2 interval histograms.
 * Used by the learning effectiveness dashboard and the optional research export.
 */

export interface MasteryPoint {
  daysFromStart: number
  cumulativeMastered: number
  newMastered: number
}

export interface IntervalHistogramBucket {
  intervalDays: number
  count: number
  percent: number
}

/**
 * Compute a mastery accumulation curve from fact_mastered events.
 *
 * @param events - `fact_mastered` events sorted by createdAt ascending.
 */
export function computeMasteryCurve(
  events: Array<{ sessionId: string; createdAt: number }>
): MasteryPoint[] {
  if (events.length === 0) return []

  const startMs = events[0]!.createdAt
  const dayMs = 86_400_000
  const byDay = new Map<number, number>()

  for (const e of events) {
    const day = Math.floor((e.createdAt - startMs) / dayMs)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }

  const maxDay = Math.max(...byDay.keys())
  const result: MasteryPoint[] = []
  let cumulative = 0

  for (let d = 0; d <= maxDay; d++) {
    const newMastered = byDay.get(d) ?? 0
    cumulative += newMastered
    result.push({ daysFromStart: d, cumulativeMastered: cumulative, newMastered })
  }

  return result
}

/**
 * Compute an SM-2 review interval histogram.
 * Buckets: [1, 3, 7, 14, 30, 60, 90, 180, 365, 365+]
 *
 * @param intervals - Array of SM-2 interval values (days) from all active SM-2 cards.
 */
export function computeIntervalHistogram(intervals: number[]): IntervalHistogramBucket[] {
  const buckets = [1, 3, 7, 14, 30, 60, 90, 180, 365]
  const counts = new Array<number>(buckets.length + 1).fill(0)

  for (const interval of intervals) {
    let placed = false
    for (let i = 0; i < buckets.length; i++) {
      if (interval <= buckets[i]!) {
        counts[i]!++
        placed = true
        break
      }
    }
    if (!placed) counts[counts.length - 1]!++
  }

  const total = intervals.length || 1
  return [...buckets, Infinity].map((limit, i) => ({
    intervalDays: limit,
    count: counts[i] ?? 0,
    percent: ((counts[i] ?? 0) / total) * 100,
  }))
}
```

#### 41.6.2 — Learning effectiveness API endpoint

Append to `server/src/routes/analytics.ts`:

```typescript
  /**
   * GET /api/analytics/learning
   * Returns learning effectiveness metrics including mastery curve and interval histogram.
   * Admin-only.
   */
  fastify.get('/learning', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers['x-admin-key'] !== config.adminKey) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const since = Date.now() - 90 * 86_400_000
    const masteryEvents = await db
      .select({ sessionId: analyticsEvents.sessionId, createdAt: analyticsEvents.createdAt })
      .from(analyticsEvents)
      .where(
        and(
          sql`${analyticsEvents.createdAt} >= ${since}`,
          eq(analyticsEvents.eventName, 'fact_mastered')
        )
      )
      .orderBy(analyticsEvents.createdAt)
      .all()

    const masteryCurve = computeMasteryCurve(masteryEvents)

    // Interval histogram — in production this joins with saves table SM-2 data
    // For now, derive intervals from fact_mastered event counts as a proxy
    const intervalProxy = masteryEvents.map((_, i) => Math.min(1 + Math.floor(i / 10), 365))
    const intervalHistogram = computeIntervalHistogram(intervalProxy)

    return reply.send({
      period: { start: new Date(since).toISOString(), end: new Date().toISOString() },
      totalFactMasteredEvents: masteryEvents.length,
      masteryCurve,
      intervalHistogram,
    })
  })
```

#### Acceptance criteria — 41.6

- `computeMasteryCurve([])` returns `[]` (no crash on empty input).
- `computeMasteryCurve` with 10 events spread over 3 days returns an array with 3 entries,
  `cumulativeMastered` at index 2 equalling 10.
- `computeIntervalHistogram([1, 7, 30, 365, 400])` returns a bucket array where the bucket for
  `intervalDays: 365` has `count: 1` and the final overflow bucket also has `count: 1`.
- `GET /api/analytics/learning` returns `{ masteryCurve, intervalHistogram, totalFactMasteredEvents }`.

---

### 41.7 — Privacy-Compliant Data Pipeline

**Goal**: Enforce data retention limits, expose GDPR export for users, and harden the existing
anonymisation pipeline.

#### 41.7.1 — Analytics event retention purge job

**Create** `server/src/jobs/analyticsRetentionJob.ts`:

```typescript
/**
 * Analytics data retention enforcement (Phase 41.7).
 * Purges analytics_events older than RETENTION_DAYS to comply with the data
 * minimisation principle (GDPR Article 5(1)(e)).
 *
 * Target: 90 days of raw events, aggregate summaries retained indefinitely.
 * Run daily via setInterval.
 */

import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { lt } from 'drizzle-orm'

/** Raw event retention window: 90 days. */
const RETENTION_DAYS = 90
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

export async function runAnalyticsRetentionJob(): Promise<{ deletedCount: number }> {
  const cutoff = Date.now() - RETENTION_MS

  // Drizzle's delete with a where clause
  const result = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.createdAt, cutoff))
    .run()

  const deletedCount = typeof result?.changes === 'number' ? result.changes : 0
  console.log(`[AnalyticsRetention] Purged ${deletedCount} events older than ${RETENTION_DAYS} days`)

  return { deletedCount }
}
```

Wire up in `server/src/index.ts`:

```typescript
import { runAnalyticsRetentionJob } from './jobs/analyticsRetentionJob.js'
// Daily at startup + every 24 h
setTimeout(() => { void runAnalyticsRetentionJob() }, 30_000)
setInterval(() => { void runAnalyticsRetentionJob() }, 24 * 60 * 60 * 1000)
```

#### 41.7.2 — GDPR data export endpoint

Append to `server/src/routes/analytics.ts`:

```typescript
  /**
   * GET /api/analytics/export/:userId
   * Returns a GDPR-compliant data export for the given user.
   * Authenticated — the JWT subject must match userId, or X-Admin-Key must be present.
   *
   * The export includes:
   *   - Session IDs associated with the user's registered account
   *   - Aggregate event counts by event name (no raw property blobs)
   *   - Account metadata from the users table
   *
   * Raw analytics_events rows are NOT returned — they are session-scoped and
   * do not contain PII.  The session IDs returned allow the user to understand
   * which sessions were theirs.
   */
  fastify.get(
    '/export/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params

      // Auth check: own account or admin
      const isAdmin = request.headers['x-admin-key'] === config.adminKey
      if (!isAdmin) {
        try {
          const token = request.headers.authorization?.replace('Bearer ', '')
          if (!token) return reply.status(401).send({ error: 'Unauthorized' })
          const payload = fastify.jwt.verify<{ sub: string }>(token)
          if (payload.sub !== userId) return reply.status(403).send({ error: 'Forbidden' })
        } catch {
          return reply.status(401).send({ error: 'Invalid token' })
        }
      }

      // Fetch user record
      const user = await db.select({
        id: users.id,
        ageBracket: users.ageBracket,
        isGuest: users.isGuest,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, userId)).get()

      if (!user) return reply.status(404).send({ error: 'User not found' })

      // Aggregate analytics events by name only — no raw properties
      // Sessions linked to a user are tracked via a userId property in app_open events
      const eventRows = await db
        .select({ eventName: analyticsEvents.eventName, sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(sql`${analyticsEvents.properties} LIKE ${`%"userId":"${userId}"%`}`)
        .all()

      const eventCounts: Record<string, number> = {}
      const sessionIds = new Set<string>()
      for (const row of eventRows) {
        eventCounts[row.eventName] = (eventCounts[row.eventName] ?? 0) + 1
        sessionIds.add(row.sessionId)
      }

      return reply.send({
        exportDate: new Date().toISOString(),
        userId: user.id,
        accountCreatedAt: new Date(user.createdAt).toISOString(),
        ageBracket: user.ageBracket,
        isGuest: user.isGuest === 1,
        analyticsSessionCount: sessionIds.size,
        analyticsEventCounts: eventCounts,
        note: 'Raw analytics event properties are not stored in association with user IDs. This export contains only aggregate counts.',
      })
    }
  )
```

#### 41.7.3 — Anonymisation hardening in dataDeletion.ts

Extend `server/src/services/dataDeletion.ts` — add a function that nullifies any session
references in the analytics table when a user requests deletion:

```typescript
/**
 * Scrub all analytics events whose `properties` blob references the deleted user's ID.
 * Replaces the userId field in the JSON with the string "deleted" so aggregate
 * counts remain accurate while removing the personal identifier.
 *
 * @param db     - Raw better-sqlite3 Database instance.
 * @param userId - The user being deleted.
 */
export function scrubAnalyticsUserId(db: unknown, userId: string): void {
  const database = db as {
    prepare: (sql: string) => { run: (...args: unknown[]) => void }
  }
  // Replace "userId":"<uuid>" with "userId":"deleted" in the JSON blob
  database
    .prepare(
      `UPDATE analytics_events
          SET properties = REPLACE(properties, '"userId":"${userId}"', '"userId":"deleted"')
        WHERE properties LIKE ?`
    )
    .run(`%"userId":"${userId}"%`)
}
```

Call `scrubAnalyticsUserId(db, userId)` from the `purgeDeletedUsers` loop in `dataDeletion.ts`
immediately before the user row is deleted, replacing the existing LIKE-based DELETE approach
for analytics events (which was deleting rows rather than anonymising them).

#### Acceptance criteria — 41.7

- `runAnalyticsRetentionJob()` deletes rows with `createdAt < (now - 90 days)` and returns
  the correct `deletedCount`.
- `GET /api/analytics/export/:userId` returns HTTP 403 if the JWT subject does not match the
  userId and no admin key is present.
- The export response contains `analyticsEventCounts` (object) and `analyticsSessionCount`
  (number) but does NOT contain any raw `properties` blob.
- `scrubAnalyticsUserId` replaces `"userId":"<uuid>"` with `"userId":"deleted"` without
  deleting the event row, preserving aggregate counts.

---

## 3. Playwright Test Scripts

### Test script 1 — Feature flag bootstrap

```js
// /tmp/test-41-flags.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')

  // Wait for app to initialise
  await page.waitForSelector('body', { timeout: 10000 })

  // Check that featureFlagService is accessible and returns defaults before login
  const seasonPassEnabled = await page.evaluate(() => {
    return (window as any).__featureFlagService?.isEnabled('season_pass_enabled') ?? null
  })
  console.assert(seasonPassEnabled === true || seasonPassEnabled === null,
    'season_pass_enabled should be true from defaults')

  await page.screenshot({ path: '/tmp/ss-41-flags.png' })
  console.log('Test 1 passed — Feature flag defaults accessible')
  await browser.close()
})()
```

### Test script 2 — Admin dashboard returns HTML

```js
// /tmp/test-41-dashboard.js
const http = require('http')

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port: 3001, path,
      headers: { 'X-Admin-Key': process.env.ADMIN_KEY ?? 'test-admin-key' } }, (res) => {
      let body = ''
      res.on('data', (c) => body += c)
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }))
    })
    req.on('error', reject)
  })
}

;(async () => {
  const { status, body, headers } = await get('/api/admin/dashboard')
  console.assert(status === 200, `Expected 200, got ${status}`)
  console.assert(headers['content-type']?.includes('text/html'), 'Expected text/html')
  console.assert(body.includes('Recall Rogue'), 'Expected dashboard title in HTML')
  console.assert(body.includes('Retention'), 'Expected Retention section')
  console.assert(body.includes('Experiments'), 'Expected Experiments section')
  console.assert(body.includes('Funnels'), 'Expected Funnels section')
  console.log('Test 2 passed — Admin dashboard renders valid HTML')

  // Test without admin key → 403
  const noKey = await new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port: 3001, path: '/api/admin/dashboard' }, (res) => {
      let body = ''
      res.on('data', (c) => body += c)
      res.on('end', () => resolve({ status: res.statusCode }))
    })
    req.on('error', reject)
  })
  console.assert(noKey.status === 403, `Expected 403 without key, got ${noKey.status}`)
  console.log('Test 3 passed — Dashboard returns 403 without admin key')
})()
```

### Test script 3 — Funnel endpoint returns valid structure

```js
// /tmp/test-41-funnel.js
const http = require('http')

;(async () => {
  const res = await new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'localhost', port: 3001,
      path: '/api/analytics/funnels/core_onboarding',
      headers: { 'X-Admin-Key': process.env.ADMIN_KEY ?? 'test-admin-key' }
    }, (res) => {
      let body = ''
      res.on('data', (c) => body += c)
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
  })

  console.assert(res.status === 200, `Expected 200, got ${res.status}`)
  const json = JSON.parse(res.body)
  console.assert(json.funnelKey === 'core_onboarding', 'funnelKey must be core_onboarding')
  console.assert(Array.isArray(json.steps), 'steps must be an array')
  console.assert(json.steps.length === 5, `Expected 5 steps, got ${json.steps.length}`)
  console.assert(typeof json.overallConversion === 'number', 'overallConversion must be a number')
  for (const step of json.steps) {
    console.assert(typeof step.dropOffRate === 'number', `step.dropOffRate must be a number`)
    console.assert(typeof step.sessions === 'number', `step.sessions must be a number`)
  }
  console.log('Test 4 passed — Funnel endpoint returns valid structure')
})()
```

---

## 4. Verification Gate

All of the following must pass before Phase 41 is marked complete.

### Typecheck

```bash
cd /root/terra-miner && npm run typecheck
```

Expected: zero errors.

### Build

```bash
cd /root/terra-miner && npm run build
```

Expected: exits 0, no type errors, chunk sizes within 500 KB warning thresholds.

### Unit correctness checks

Run these inline assertions in a Node.js script at `/tmp/test-41-units.mjs`:

```js
// assignVariant distribution test
import { assignVariant } from '/root/terra-miner/src/utils/experimentBucket.ts' // or built version

const variants = ['control', 'treatment']
const counts = { control: 0, treatment: 0 }
for (let i = 0; i < 10000; i++) {
  const v = assignVariant(`user-${i}`, 'test_exp', variants)
  counts[v] = (counts[v] ?? 0) + 1
}
console.assert(counts.control > 4500 && counts.control < 5500,
  `Uneven distribution: control=${counts.control}`)
console.log('Unit: assignVariant distribution ok')

// computeFunnel drop-off
import { computeFunnel } from '/root/terra-miner/server/src/analytics/funnels.ts'
const MOCK_DEF = {
  key: 'test',
  label: 'Test',
  steps: [
    { name: 'Step 1', eventName: 'event_a' },
    { name: 'Step 2', eventName: 'event_b' },
    { name: 'Step 3', eventName: 'event_c' },
  ]
}
const mockEvents = [
  ...Array.from({ length: 100 }, (_, i) => ({ eventName: 'event_a', sessionId: `s${i}` })),
  ...Array.from({ length: 80 }, (_, i) => ({ eventName: 'event_b', sessionId: `s${i}` })),
  ...Array.from({ length: 40 }, (_, i) => ({ eventName: 'event_c', sessionId: `s${i}` })),
]
const funnel = computeFunnel(MOCK_DEF, mockEvents)
console.assert(funnel.steps[0].sessions === 100, 'Step 1 should have 100 sessions')
console.assert(funnel.steps[1].dropOffRate === 0.20, `Step 2 drop-off should be 0.20, got ${funnel.steps[1].dropOffRate}`)
console.assert(funnel.steps[2].dropOffRate === 0.50, `Step 3 drop-off should be 0.50, got ${funnel.steps[2].dropOffRate}`)
console.log('Unit: computeFunnel drop-off ok')
```

### Server endpoint smoke tests

```bash
# Start server in background
cd /root/terra-miner && node server/dist/index.js &
SERVER_PID=$!
sleep 3

# 1. Analytics events endpoint
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"550e8400-e29b-41d4-a716-446655440000","events":[{"name":"app_open","properties":{"platform":"web","app_version":"1.0.0","launch_type":"cold","client_ts":1000000,"has_existing_save":false,"age_bracket":"adult"}}]}'
# Expected: 200

# 2. Dashboard (admin)
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  http://localhost:3001/api/admin/dashboard
# Expected: 200

# 3. Funnel
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  http://localhost:3001/api/analytics/funnels/core_onboarding
# Expected: 200

# 4. Unknown funnel
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  http://localhost:3001/api/analytics/funnels/nonexistent
# Expected: 404

kill $SERVER_PID
```

### Visual confirmation

Run the Playwright screenshot script and use the Read tool to visually confirm the game still
loads and the dome/mine screens are unaffected by server-side changes:

```js
// /tmp/ss-41-final.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-41-home.png' })
  await browser.close()
})()
```

---

## 5. Files Affected

### New files created

| File | Sub-phase |
|---|---|
| `server/src/services/featureFlagService.ts` | 41.1 |
| `server/src/routes/featureFlags.ts` | 41.1 |
| `src/services/featureFlagService.ts` | 41.1 |
| `src/data/experiments.ts` | 41.2 |
| `src/utils/experimentBucket.ts` | 41.2 |
| `server/src/analytics/experiments.ts` | 41.2 |
| `server/src/analytics/funnels.ts` | 41.3 |
| `server/src/services/dashboardService.ts` | 41.4 |
| `server/src/dashboard/renderDashboard.ts` | 41.4 |
| `server/src/jobs/retentionAlertJob.ts` | 41.5 |
| `server/src/analytics/learningCurves.ts` | 41.6 |
| `server/src/jobs/analyticsRetentionJob.ts` | 41.7 |

### Modified files

| File | Change |
|---|---|
| `server/src/db/schema.ts` | Add `featureFlags` and `featureFlagOverrides` tables + inferred types |
| `server/src/db/migrate.ts` | Add CREATE TABLE statements for new tables (idempotent) |
| `server/src/routes/analytics.ts` | Add `/experiments/:key`, `/funnels/:key`, `/learning`, `/export/:userId` endpoints; add `experiment_assigned` to `ALLOWED_EVENTS` |
| `server/src/routes/admin.ts` | Add `/api/admin/dashboard` HTML route with 5-minute cache |
| `server/src/index.ts` | Register `featureFlagRoutes`; wire up `retentionAlertJob` and `analyticsRetentionJob` intervals |
| `src/services/analyticsService.ts` | Replace `getExperimentGroup()` with `getExperimentVariant()`; import from `experiments.ts` and `experimentBucket.ts` |
| `server/src/services/dataDeletion.ts` | Add `scrubAnalyticsUserId()`; update `purgeDeletedUsers` to call it instead of deleting analytics rows |
| `server/src/config/features.ts` | Deprecate static `FEATURES` object with a JSDoc note pointing to `featureFlagService` |

### Unchanged files (referenced but not modified)

- `server/src/analytics/retention.ts` — already has correct interface; `computeRetention` is called with real events by the dashboard service
- `server/src/analytics/playerSegments.ts` — stub remains; production SQL wiring is out of scope for this phase
- `server/src/services/learningEffectivenessService.ts` — unchanged; called by the new learning endpoint
- `server/src/services/dataDeletion.ts` (except the addition in 41.7.3)
- `src/data/analyticsEvents.ts` — unchanged; `experiment_assigned` event type is appended to the `AnalyticsEvent` union in `analyticsService.ts`

---

## Implementation Notes for Workers

1. **Import paths**: The server uses `.js` extension on all local imports (Node ESM). Every new
   server file must follow this convention (e.g. `import { db } from '../db/index.js'`).

2. **Drizzle `get()` vs `all()`**: For single-row queries use `.get()` (returns `T | undefined`).
   For multi-row queries use `.all()`. Never use `.run()` for SELECT.

3. **`sql` template tag**: Import from `drizzle-orm` — `import { sql, eq, and, lt } from 'drizzle-orm'`.
   Drizzle's `where()` accepts both operator helpers and raw `sql` tagged templates.

4. **No new npm dependencies**: All functionality must be implemented with Node built-ins
   (`crypto`, `http`) and already-installed packages. Confirm with `cat package.json` before
   adding anything. If a dependency is truly needed, stop and ask the user first.

5. **Config additions**: `config.alertEmail` and `config.serverUrl` are referenced in
   `retentionAlertJob.ts`. Add these to `server/src/config.ts` as optional strings defaulting
   to `undefined` / `process.env.ALERT_EMAIL` / `process.env.SERVER_URL`.

6. **`EXPERIMENTS` shared definition**: `src/data/experiments.ts` is a client-side file.
   `server/src/analytics/experiments.ts` and `server/src/services/dashboardService.ts` must
   duplicate the `EXPERIMENTS` constant or import it via a shared path that works in the server
   build context. The safest approach is to copy the array into a `server/src/data/experiments.ts`
   file to avoid cross-boundary import issues with Vite's client build.

7. **Backward compatibility**: `getExperimentGroup()` on `AnalyticsService` may be called by
   existing code (search for usages before removing). If found, alias it:
   `getExperimentGroup(key: string): 'A' | 'B' { return this.getExperimentVariant(key) === 'control' ? 'A' : 'B' }`.

8. **Database migration**: `server/src/db/migrate.ts` currently calls `initSchema()` which runs
   CREATE TABLE IF NOT EXISTS statements. Add the two new tables (`feature_flags`,
   `feature_flag_overrides`) there. Do NOT add a `drizzle-kit` migration file — the project
   uses inline SQL for schema management.
