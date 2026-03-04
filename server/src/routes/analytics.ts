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
import { analyticsEvents } from "../db/schema.js";

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
