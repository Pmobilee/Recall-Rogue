/**
 * Admin routes for the Terra Gacha server.
 * Provides internal monitoring and moderation endpoints.
 *
 * All endpoints are protected by the X-Admin-Key header via the requireAdmin
 * preHandler middleware.  They are NOT exposed to end-users.
 *
 * Route groups:
 *   GET  /api/admin/social-health               — social-feature health counters
 *   POST /api/admin/leaderboard/refresh         — manual leaderboard recompute
 *   GET  /api/admin/leaderboard/review-queue    — list pending flagged scores
 *   POST /api/admin/leaderboard/review/:scoreId/approve — approve flagged score
 *   POST /api/admin/leaderboard/review/:scoreId/reject  — reject flagged score
 *
 * Legacy routes (from original admin.ts, kept for backwards compatibility):
 *   GET  /api/admin/segments/monthly            — player segmentation report
 *   GET  /api/admin/retention                   — D1/D7/D30 retention report
 */

import * as crypto from "crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  duels,
  tradeOffers,
  guilds,
  referrals,
  leaderboards,
  leaderboardReviewQueue,
  users,
} from "../db/schema.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { computeAllLeaderboardScores } from "../analytics/leaderboards.js";
import { computePlayerSegments } from "../analytics/playerSegments.js";
import { computeRetention } from "../analytics/retention.js";
import type { ComputationSummary } from "../analytics/leaderboards.js";

// ── Response types ─────────────────────────────────────────────────────────────

/**
 * Counts for the social-health monitoring endpoint.
 * Each field represents the live count of active/pending items in a system.
 */
export interface SocialHealthReport {
  /** Duels in "pending" or "challenger_done" or "opponent_done" state. */
  activeDuels: number;
  /** Trade offers in "pending" state. */
  pendingTrades: number;
  /** Guilds with at least one member. */
  activeGuilds: number;
  /** Referrals that have been open longer than 30 days without converting. */
  flaggedReferrals: number;
  /** Leaderboard review items in "pending" state. */
  leaderboardReviewQueueSize: number;
}

/**
 * A single review queue item returned to the admin UI.
 */
export interface ReviewQueueItem {
  id: string;
  userId: string;
  displayName: string | null;
  category: string;
  score: number;
  metadata: unknown | null;
  reason: string;
  status: string;
  createdAt: number;
  reviewedAt: number | null;
  reviewNote: string | null;
}

/**
 * Response body for an approve/reject action.
 */
export interface ReviewActionResult {
  scoreId: string;
  action: "approved" | "rejected";
  publishedLeaderboardId: string | null;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON string, returning null on failure.
 *
 * @param str - A string that may contain JSON.
 * @returns The parsed value, or null if parsing fails.
 */
function tryParseJson(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ── Route registration ─────────────────────────────────────────────────────────

/**
 * Register admin routes on the Fastify instance.
 * All routes are prefixed with /api/admin by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply the admin key guard to every route in this plugin scope.
  fastify.addHook("preHandler", requireAdmin);

  // ── GET /social-health ───────────────────────────────────────────────────────

  /**
   * GET /api/admin/social-health
   * Returns live counts for social system health monitoring.
   * Useful for detecting runaway activity or stalled queues.
   */
  fastify.get(
    "/social-health",
    async (_request: FastifyRequest): Promise<SocialHealthReport> => {
      // Active duels: any non-terminal state
      const activeDuelsRow = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(duels)
        .where(
          sql`${duels.status} IN ('pending', 'challenger_done', 'opponent_done')`
        )
        .get();

      // Pending trades
      const pendingTradesRow = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tradeOffers)
        .where(eq(tradeOffers.status, "pending"))
        .get();

      // Active guilds (memberCount > 0)
      const activeGuildsRow = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(guilds)
        .where(sql`${guilds.memberCount} > 0`)
        .get();

      // Flagged referrals: pending referrals older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1_000;
      const flaggedReferralsRow = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(referrals)
        .where(
          sql`${referrals.status} = 'pending' AND ${referrals.createdAt} < ${thirtyDaysAgo}`
        )
        .get();

      // Leaderboard review queue size
      const reviewQueueRow = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(leaderboardReviewQueue)
        .where(eq(leaderboardReviewQueue.status, "pending"))
        .get();

      return {
        activeDuels: activeDuelsRow?.count ?? 0,
        pendingTrades: pendingTradesRow?.count ?? 0,
        activeGuilds: activeGuildsRow?.count ?? 0,
        flaggedReferrals: flaggedReferralsRow?.count ?? 0,
        leaderboardReviewQueueSize: reviewQueueRow?.count ?? 0,
      };
    }
  );

  // ── POST /leaderboard/refresh ────────────────────────────────────────────────

  /**
   * POST /api/admin/leaderboard/refresh
   * Manually trigger full leaderboard score recomputation.
   * Returns the ComputationSummary produced by the nightly job.
   * This is the same idempotent function used by the nightly cron — safe to
   * call at any time.
   */
  fastify.post(
    "/leaderboard/refresh",
    async (_request: FastifyRequest): Promise<ComputationSummary> => {
      const summary = await computeAllLeaderboardScores();
      return summary;
    }
  );

  // ── GET /leaderboard/review-queue ────────────────────────────────────────────

  /**
   * GET /api/admin/leaderboard/review-queue
   * Returns all pending review items, newest first, with displayName joined.
   * Scores that have already been approved or rejected are excluded.
   */
  fastify.get(
    "/leaderboard/review-queue",
    async (_request: FastifyRequest): Promise<ReviewQueueItem[]> => {
      const rows = await db
        .select({
          id: leaderboardReviewQueue.id,
          userId: leaderboardReviewQueue.userId,
          displayName: users.displayName,
          category: leaderboardReviewQueue.category,
          score: leaderboardReviewQueue.score,
          metadata: leaderboardReviewQueue.metadata,
          reason: leaderboardReviewQueue.reason,
          status: leaderboardReviewQueue.status,
          createdAt: leaderboardReviewQueue.createdAt,
          reviewedAt: leaderboardReviewQueue.reviewedAt,
          reviewNote: leaderboardReviewQueue.reviewNote,
        })
        .from(leaderboardReviewQueue)
        .leftJoin(users, eq(leaderboardReviewQueue.userId, users.id))
        .where(eq(leaderboardReviewQueue.status, "pending"))
        .orderBy(sql`${leaderboardReviewQueue.createdAt} DESC`)
        .all();

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.displayName ?? null,
        category: row.category,
        score: row.score,
        metadata: tryParseJson(row.metadata),
        reason: row.reason,
        status: row.status,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt ?? null,
        reviewNote: row.reviewNote ?? null,
      }));
    }
  );

  // ── POST /leaderboard/review/:scoreId/approve ────────────────────────────────

  /**
   * POST /api/admin/leaderboard/review/:scoreId/approve
   * Approve a flagged score: publish it to the live leaderboard using the same
   * upsert-best-score logic as the regular submission route.
   * Returns the resulting leaderboard entry ID.
   *
   * Body: { note?: string }
   */
  fastify.post(
    "/leaderboard/review/:scoreId/approve",
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<ReviewActionResult> => {
      const params = request.params as { scoreId: string };
      const { scoreId } = params;
      const body = request.body as Record<string, unknown> | null | undefined;
      const note = typeof body?.note === "string" ? body.note : null;

      // Load the queued item
      const item = await db
        .select()
        .from(leaderboardReviewQueue)
        .where(eq(leaderboardReviewQueue.id, scoreId))
        .get();

      if (!item) {
        return reply
          .status(404)
          .send({ error: "Review item not found", statusCode: 404 });
      }
      if (item.status !== "pending") {
        return reply.status(409).send({
          error: `Score already ${item.status}`,
          statusCode: 409,
        });
      }

      const now = Date.now();

      // Upsert into the live leaderboards table (keep best score per user+category)
      const existing = await db
        .select({ id: leaderboards.id, score: leaderboards.score })
        .from(leaderboards)
        .where(
          sql`${leaderboards.userId} = ${item.userId} AND ${leaderboards.category} = ${item.category}`
        )
        .get();

      let publishedId: string;

      if (existing) {
        publishedId = existing.id;
        if (item.score > existing.score) {
          await db
            .update(leaderboards)
            .set({ score: item.score, metadata: item.metadata })
            .where(eq(leaderboards.id, existing.id));
        }
      } else {
        publishedId = crypto.randomUUID();
        await db.insert(leaderboards).values({
          id: publishedId,
          userId: item.userId,
          category: item.category,
          score: item.score,
          metadata: item.metadata,
          createdAt: now,
        });
      }

      // Mark the review item as approved
      await db
        .update(leaderboardReviewQueue)
        .set({ status: "approved", reviewedAt: now, reviewNote: note })
        .where(eq(leaderboardReviewQueue.id, scoreId));

      return {
        scoreId,
        action: "approved",
        publishedLeaderboardId: publishedId,
      };
    }
  );

  // ── POST /leaderboard/review/:scoreId/reject ──────────────────────────────────

  /**
   * POST /api/admin/leaderboard/review/:scoreId/reject
   * Reject a flagged score: the score is not published and the review item is
   * marked as rejected.  The user's existing best score (if any) is unaffected.
   *
   * Body: { note?: string }
   */
  fastify.post(
    "/leaderboard/review/:scoreId/reject",
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<ReviewActionResult> => {
      const params = request.params as { scoreId: string };
      const { scoreId } = params;
      const body = request.body as Record<string, unknown> | null | undefined;
      const note = typeof body?.note === "string" ? body.note : null;

      // Load the queued item
      const item = await db
        .select({ id: leaderboardReviewQueue.id, status: leaderboardReviewQueue.status })
        .from(leaderboardReviewQueue)
        .where(eq(leaderboardReviewQueue.id, scoreId))
        .get();

      if (!item) {
        return reply
          .status(404)
          .send({ error: "Review item not found", statusCode: 404 });
      }
      if (item.status !== "pending") {
        return reply.status(409).send({
          error: `Score already ${item.status}`,
          statusCode: 409,
        });
      }

      const now = Date.now();

      // Mark as rejected — the score is never published
      await db
        .update(leaderboardReviewQueue)
        .set({ status: "rejected", reviewedAt: now, reviewNote: note })
        .where(eq(leaderboardReviewQueue.id, scoreId));

      return {
        scoreId,
        action: "rejected",
        publishedLeaderboardId: null,
      };
    }
  );

  // ── Legacy routes (kept for backwards compatibility) ─────────────────────────

  /**
   * GET /api/admin/segments/monthly
   * Player segmentation report — mastery-free monitoring (DD-V2-152).
   */
  fastify.get(
    "/segments/monthly",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const cohortDate = new Date();
      const report = computePlayerSegments(cohortDate);
      return report;
    }
  );

  /**
   * GET /api/admin/retention
   * D1/D7/D30 retention report (DD-V2-155).
   */
  fastify.get(
    "/retention",
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const cohortDate = new Date();
      const report = computeRetention(cohortDate);
      return report;
    }
  );
}
