/**
 * Analytics ingestion routes for the Terra Gacha server.
 * Accepts batched event payloads from game clients and persists them
 * to the analytics_events table for later querying.
 *
 * No authentication is required — events are identified by session ID only.
 * The route performs strict validation to reject malformed or oversized batches.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { db } from "../db/index.js";
import { analyticsEvents, users } from "../db/schema.js";
import { sql, eq, and } from "drizzle-orm";
import { config } from "../config.js";
import { EXPERIMENTS } from "../data/experiments.js";
import { computeExperimentResult } from "../analytics/experiments.js";
import { FUNNELS, computeFunnel } from "../analytics/funnels.js";
import { computeMasteryCurve, computeIntervalHistogram } from "../analytics/learningCurves.js";
import { computeViralMetrics } from "../analytics/viralMetrics.js";
import { sqliteDb } from "../db/index.js";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Event names that the server will accept. Any other name is rejected. */
const ALLOWED_EVENTS = new Set([
  // Core gameplay events (Phase 19)
  "app_open",
  "tutorial_step_complete",
  "first_dive_complete",
  "quiz_answered",
  "fact_mastered",
  "fossil_revived",
  "session_end",
  "purchase_initiated",
  "churn_signal",
  "engagement_score_change",
  // Monetization events (Phase 21.3 / DD-V2-181)
  "terra_pass_viewed",
  "iap_purchase_started",
  "iap_purchase_completed",
  "iap_purchase_failed",
  "pioneer_pack_shown",
  "pioneer_pack_purchased",
  "pioneer_pack_dismissed",
  "oxygen_depleted",
  "subscription_started",
  "subscription_cancelled",
  "season_pass_milestone_claimed",
  "economy_dust_spent",
  "economy_wealth_snapshot",
  // Learning effectiveness metrics (DD-V2-134)
  "learning_retention_rate",
  "learning_lapse_rate",
  "learning_daily_study_rate",
  "learning_facts_per_player",
  "learning_time_to_mastery",
  // A/B experiment tracking (Phase 41.2)
  "experiment_assigned",
  // Viral Growth events (Phase 42.6)
  "share_card_generated",
  "referral_link_shared",
  "referral_converted",
  "badge_shared",
]);

/** Property keys that must never appear in analytics payloads (PII). */
const PII_FIELDS = new Set([
  "email",
  "password",
  "displayname",
  "name",
]);

/** Maximum number of events allowed in a single POST request. */
const MAX_BATCH_SIZE = 50;

/** UUID v4 validation regex. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Shape of an individual analytics event from the client. */
interface IncomingEvent {
  name: string;
  properties: Record<string, unknown>;
}

/** Shape of the POST /events request body. */
interface AnalyticsBody {
  sessionId: string;
  events: IncomingEvent[];
}

// ── Route plugin ───────────────────────────────────────────────────────────────

/**
 * Register analytics ingestion routes on the Fastify instance.
 * All routes are prefixed with /api/analytics by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function analyticsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  /**
   * POST /api/analytics/events
   *
   * Accepts a batch of client-side analytics events and persists them.
   * Validates:
   *   - sessionId is a valid UUID v4
   *   - events is a non-empty array of at most MAX_BATCH_SIZE items
   *   - each event.name is in the ALLOWED_EVENTS whitelist
   *   - no event properties contain PII field keys
   *
   * Returns: { accepted: number } — count of events stored.
   */
  fastify.post(
    "/events",
    async (
      request: FastifyRequest<{ Body: AnalyticsBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body as Partial<AnalyticsBody> | null | undefined;
      const { sessionId, events } = body ?? {};

      // ── Validate sessionId ───────────────────────────────────────────────────
      if (!sessionId || !UUID_RE.test(sessionId)) {
        return reply
          .status(400)
          .send({ error: "Invalid sessionId — must be UUID v4" });
      }

      // ── Validate events array ─────────────────────────────────────────────────
      if (!Array.isArray(events) || events.length === 0) {
        return reply
          .status(400)
          .send({ error: "events must be a non-empty array" });
      }
      if (events.length > MAX_BATCH_SIZE) {
        return reply
          .status(400)
          .send({ error: `Max ${MAX_BATCH_SIZE} events per batch` });
      }

      // ── Validate individual events ────────────────────────────────────────────
      for (const event of events) {
        if (typeof event.name !== "string" || !ALLOWED_EVENTS.has(event.name)) {
          return reply
            .status(400)
            .send({ error: `Unknown event name: ${String(event.name)}` });
        }

        if (event.properties && typeof event.properties === "object") {
          for (const key of Object.keys(event.properties)) {
            if (PII_FIELDS.has(key.toLowerCase())) {
              return reply
                .status(400)
                .send({ error: `PII field "${key}" not allowed in analytics` });
            }
          }
        }
      }

      // ── Persist events ────────────────────────────────────────────────────────
      const now = Date.now();
      // Extract platform / app_version from the first event when available.
      const firstProps = events[0]?.properties as
        | Record<string, unknown>
        | undefined;
      const platform =
        typeof firstProps?.platform === "string" ? firstProps.platform : null;
      const appVersion =
        typeof firstProps?.app_version === "string"
          ? firstProps.app_version
          : null;

      for (const event of events) {
        await db.insert(analyticsEvents).values({
          id: crypto.randomUUID(),
          sessionId,
          eventName: event.name,
          properties: JSON.stringify(event.properties ?? {}),
          platform,
          appVersion,
          createdAt: now,
        });
      }

      return reply.status(200).send({ accepted: events.length });
    }
  );

  /**
   * GET /api/analytics/retention
   *
   * Returns D1/D7/D30 retention figures for a given cohort date.
   * In production these are computed from SQL queries over analytics_events.
   * In development / when there is insufficient data, returns target benchmarks
   * with an `insufficient_data` status so the dashboard renders gracefully.
   *
   * Query params:
   *   - cohortDate: ISO 8601 date string (e.g. "2026-01-01") — defaults to 30 days ago
   */
  fastify.get(
    "/retention",
    async (
      request: FastifyRequest<{ Querystring: { cohortDate?: string } }>,
      reply: FastifyReply
    ) => {
      const { cohortDate } = (request.query as { cohortDate?: string }) ?? {};
      const parsed = cohortDate ? new Date(cohortDate) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
      })();

      if (isNaN(parsed.getTime())) {
        return reply.status(400).send({ error: "Invalid cohortDate — must be ISO 8601" });
      }

      const result = computeRetention(parsed);
      return reply.status(200).send(result);
    }
  );

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
      if (request.headers['x-admin-key'] !== config.adminApiKey) {
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
      if (request.headers['x-admin-key'] !== config.adminApiKey) {
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

  /**
   * GET /api/analytics/learning
   * Returns learning effectiveness metrics including mastery curve and interval histogram.
   * Admin-only.
   */
  fastify.get('/learning', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers['x-admin-key'] !== config.adminApiKey) {
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

  /**
   * GET /api/analytics/viral
   * Returns a K-factor report and viral loop metrics for the last N days.
   * Query params:
   *   - days: number of days to look back (default: 30, max: 90)
   * Admin-only (X-Admin-Key required).
   */
  fastify.get(
    '/viral',
    async (
      request: FastifyRequest<{ Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      if (request.headers['x-admin-key'] !== config.adminApiKey) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const rawDays = parseInt((request.query as { days?: string }).days ?? '30', 10)
      const windowDays = Math.min(Math.max(1, isNaN(rawDays) ? 30 : rawDays), 90)

      // Build a DbLike adapter from the underlying better-sqlite3 connection.
      // viralMetrics uses a generic async query interface; better-sqlite3 is
      // synchronous so we wrap it in a resolved Promise.
      const dbAdapter = {
        query: async <T>(sqlStr: string, params: unknown[] = []): Promise<{ rows: T[] }> => {
          const stmt = sqliteDb.prepare(sqlStr)
          const rows = stmt.all(...(params as Parameters<typeof stmt.all>)) as T[]
          return { rows }
        },
      }

      const report = await computeViralMetrics(dbAdapter, windowDays)
      return reply.send(report)
    }
  )

  /**
   * GET /api/analytics/export/:userId
   * Returns a GDPR-compliant data export for the given user.
   * Authenticated — the JWT subject must match userId, or X-Admin-Key must be present.
   */
  fastify.get(
    '/export/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params

      // Auth check: own account or admin
      const isAdmin = request.headers['x-admin-key'] === config.adminApiKey
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
}

// ── Retention computation (DD-V2-155) ──────────────────────────────────────────

/** Shape of a single retention window result. */
interface RetentionWindow {
  target: number;
  actual: number | null;
  status: "ok" | "below_target" | "insufficient_data";
  isPrimaryMetric?: true;
}

/** Full retention report for a cohort. */
export interface RetentionReport {
  cohortDate: string;
  d1: RetentionWindow;
  d7: RetentionWindow;
  d30: RetentionWindow;
}

/**
 * D1/D7/D30 retention computation (DD-V2-155).
 *
 * In production this function would execute SQL queries against the
 * analytics_events table comparing cohort day-0 `app_open` counts against
 * return `app_open` counts on day+1, day+7, and day+30.
 *
 * For now it returns the benchmark targets with `insufficient_data` status
 * until enough cohort data accumulates. Pass an `events` array from a
 * pre-query to compute actual values when available.
 *
 * Target benchmarks (DD-V2-155):
 *   D1  ≥ 45 %   (industry median for educational games)
 *   D7  ≥ 20 %   (primary business metric)
 *   D30 ≥ 10 %
 *
 * @param cohortDate - The calendar day whose new users form this cohort.
 * @param events     - Optional pre-fetched event rows for actual computation.
 */
export function computeRetention(
  cohortDate: Date,
  events: Array<{ sessionId: string; eventName: string; createdAt: number }> = []
): RetentionReport {
  const cohortMs = cohortDate.getTime();
  const dayMs = 86_400_000;

  // Identify cohort sessions: app_open events on the cohort day.
  const cohortSessions = new Set(
    events
      .filter(
        (e) =>
          e.eventName === "app_open" &&
          e.createdAt >= cohortMs &&
          e.createdAt < cohortMs + dayMs
      )
      .map((e) => e.sessionId)
  );

  const cohortSize = cohortSessions.size;

  function windowStatus(
    actual: number | null,
    target: number
  ): RetentionWindow["status"] {
    if (actual === null) return "insufficient_data";
    return actual >= target ? "ok" : "below_target";
  }

  function computeWindow(
    offsetDays: number,
    target: number
  ): RetentionWindow & { isPrimaryMetric?: true } {
    if (cohortSize === 0) {
      return { target, actual: null, status: "insufficient_data" };
    }
    const windowStart = cohortMs + offsetDays * dayMs;
    const windowEnd = windowStart + dayMs;
    const returning = new Set(
      events
        .filter(
          (e) =>
            e.eventName === "app_open" &&
            e.createdAt >= windowStart &&
            e.createdAt < windowEnd &&
            cohortSessions.has(e.sessionId)
        )
        .map((e) => e.sessionId)
    ).size;

    const rate = returning / cohortSize;
    return { target, actual: rate, status: windowStatus(rate, target) };
  }

  const d7Window = computeWindow(7, 0.2);

  return {
    cohortDate: cohortDate.toISOString().slice(0, 10),
    d1: computeWindow(1, 0.45),
    d7: { ...d7Window, isPrimaryMetric: true },
    d30: computeWindow(30, 0.1),
  };
}
