/**
 * Admin routes for the Recall Rogue server.
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
import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { config } from "../config.js";
import { assembleDashboard } from "../services/dashboardService.js";
import { renderDashboard } from "../dashboard/renderDashboard.js";
import {
  duels,
  tradeOffers,
  guilds,
  referrals,
  leaderboards,
  leaderboardReviewQueue,
  users,
  educatorVerificationRequests,
  classrooms,
  classroomStudents,
  homeworkAssignments,
} from "../db/schema.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { computeAllLeaderboardScores } from "../analytics/leaderboards.js";
import { computePlayerSegments } from "../analytics/playerSegments.js";
import { computeRetention } from "../analytics/retention.js";
import type { ComputationSummary } from "../analytics/leaderboards.js";
import { factsDb } from "../db/facts-db.js";
import {
  issuePartnerKey,
  revokePartnerKey,
  listPartnerKeys,
} from "../services/partnerKeyService.js";

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

  // ── Phase 32.7: Fact coverage statistics ──────────────────────────────────────

  /**
   * GET /api/admin/coverage
   * Fact coverage statistics for the content scaling dashboard.
   * Returns category distribution, difficulty tiers, quality scores,
   * weekly velocity, and distractor depth.
   */
  fastify.get(
    "/coverage",
    { preHandler: requireAdmin },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      // Category distribution
      interface CategoryRow {
        category_l1: string;
        status: string;
        count: number;
      }
      const byCategory = factsDb
        .prepare(
          `SELECT category_l1, status, COUNT(*) as count
           FROM facts
           GROUP BY category_l1, status
           ORDER BY category_l1, status`
        )
        .all() as CategoryRow[];

      // Difficulty tier distribution (approved only)
      interface TierRow {
        difficulty_tier: string;
        count: number;
      }
      const byTier = factsDb
        .prepare(
          `SELECT difficulty_tier, COUNT(*) as count
           FROM facts WHERE status = 'approved'
           GROUP BY difficulty_tier`
        )
        .all() as TierRow[];

      // Quality score histogram (10 buckets: 0-9, 10-19, ..., 90-100)
      interface QualityBucket {
        bucket: number;
        count: number;
      }
      const qualityBuckets = factsDb
        .prepare(
          `SELECT CAST(quality_score / 10 AS INTEGER) * 10 as bucket, COUNT(*) as count
           FROM facts
           WHERE quality_score IS NOT NULL
           GROUP BY bucket
           ORDER BY bucket`
        )
        .all() as QualityBucket[];

      // Weekly approval velocity (last 12 weeks)
      interface VelocityRow {
        week: string;
        count: number;
      }
      const velocity = factsDb
        .prepare(
          `SELECT strftime('%Y-W%W', datetime(updated_at / 1000, 'unixepoch')) as week,
                  COUNT(*) as count
           FROM facts
           WHERE status = 'approved'
             AND updated_at > (unixepoch() - 84 * 86400) * 1000
           GROUP BY week
           ORDER BY week`
        )
        .all() as VelocityRow[];

      // Distractor depth per category
      interface DistractorDepthRow {
        category_l1: string;
        avg_distractors: number;
        min_distractors: number;
        facts_below_threshold: number;
      }
      const distractorDepth = factsDb
        .prepare(
          `SELECT f.category_l1,
                  AVG(f.distractor_count) as avg_distractors,
                  MIN(f.distractor_count) as min_distractors,
                  SUM(CASE WHEN f.distractor_count < 8 THEN 1 ELSE 0 END) as facts_below_threshold
           FROM facts f
           WHERE f.status = 'approved'
           GROUP BY f.category_l1
           ORDER BY facts_below_threshold DESC`
        )
        .all() as DistractorDepthRow[];

      // Totals
      interface TotalRow {
        status: string;
        count: number;
      }
      const totals = factsDb
        .prepare(`SELECT status, COUNT(*) as count FROM facts GROUP BY status`)
        .all() as TotalRow[];

      return reply.send({
        byCategory,
        byTier,
        qualityBuckets,
        velocity,
        distractorDepth,
        totals,
        categoryThreshold: 200,
        totalTarget: 3000,
      });
    }
  );

  // ── Phase 41.4: Analytics cohort dashboard ────────────────────────────────────

  // ── Phase 44: Educator approval queue ─────────────────────────────────────────

  /**
   * GET /api/admin/educator-queue
   * List pending educator verification requests.
   */
  fastify.get(
    '/educator-queue',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const queue = await db
        .select({
          requestId: educatorVerificationRequests.id,
          userId: educatorVerificationRequests.userId,
          schoolName: educatorVerificationRequests.schoolName,
          emailDomain: educatorVerificationRequests.emailDomain,
          schoolUrl: educatorVerificationRequests.schoolUrl,
          verificationNote: educatorVerificationRequests.verificationNote,
          status: educatorVerificationRequests.status,
          submittedAt: educatorVerificationRequests.submittedAt,
        })
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.status, 'pending'))
        .all()

      return reply.send({ queue, total: queue.length })
    }
  )

  /**
   * POST /api/admin/educator-queue/:requestId/decide
   * Approve or reject an educator verification request.
   * Body: { decision: 'approve' | 'reject'; reviewNote?: string; classLimit?: number }
   */
  fastify.post(
    '/educator-queue/:requestId/decide',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { requestId } = request.params as { requestId: string }
      const { decision, reviewNote, classLimit } = request.body as {
        decision: string
        reviewNote?: string
        classLimit?: number
      }

      if (decision !== 'approve' && decision !== 'reject') {
        return reply.status(400).send({ error: 'decision must be "approve" or "reject"' })
      }

      const verReq = await db
        .select()
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.id, requestId))
        .get()

      if (!verReq) return reply.status(404).send({ error: 'Request not found' })
      if (verReq.status !== 'pending') {
        return reply.status(409).send({ error: 'Request already reviewed' })
      }

      await db
        .update(educatorVerificationRequests)
        .set({
          status: decision === 'approve' ? 'approved' : 'rejected',
          reviewNote: reviewNote?.slice(0, 500) ?? null,
          reviewedAt: Date.now(),
        })
        .where(eq(educatorVerificationRequests.id, requestId))

      if (decision === 'approve') {
        await db
          .update(users)
          .set({
            role: 'educator',
            educatorVerification: 'approved',
            classLimit: classLimit ?? 5,
          })
          .where(eq(users.id, verReq.userId))
      } else {
        await db
          .update(users)
          .set({ educatorVerification: 'rejected' })
          .where(eq(users.id, verReq.userId))
      }

      return reply.send({ requestId, decision, userId: verReq.userId })
    }
  )

  // ── Phase 44: Classroom health ─────────────────────────────────────────────────

  /**
   * GET /api/admin/classroom-health
   * Aggregate health statistics for the classroom system.
   */
  fastify.get(
    '/classroom-health',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const educatorCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, 'educator'))
        .get()

      const classCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(classrooms)
        .where(eq(classrooms.isArchived, 0))
        .get()

      const membershipCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(classroomStudents)
        .where(eq(classroomStudents.isActive, 1))
        .get()

      const now = Date.now()
      const activeAssignmentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(homeworkAssignments)
        .where(
          sql`${homeworkAssignments.isActive} = 1 AND ${homeworkAssignments.startDate} <= ${now} AND ${homeworkAssignments.dueDate} >= ${now}`,
        )
        .get()

      return reply.send({
        educators: educatorCount?.count ?? 0,
        classes: classCount?.count ?? 0,
        memberships: membershipCount?.count ?? 0,
        activeAssignments: activeAssignmentCount?.count ?? 0,
      })
    }
  )

  /**
   * GET /api/admin/educator-queue-ui
   * Server-rendered HTML review page for the educator queue.
   * Shows pending requests in a minimal table with approve/reject form.
   */
  fastify.get(
    '/educator-queue-ui',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const queue = await db
        .select()
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.status, 'pending'))
        .orderBy(desc(educatorVerificationRequests.submittedAt))
        .all()

      /** HTML-escape a string to prevent XSS in server-rendered output. */
      function sanitizeHtml(s: string): string {
        return s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
      }

      const rows = queue
        .map(
          (r) => `
          <tr>
            <td>${sanitizeHtml(r.id.slice(0, 8))}</td>
            <td>${sanitizeHtml(r.schoolName)}</td>
            <td>${sanitizeHtml(r.emailDomain)}</td>
            <td>${sanitizeHtml(new Date(r.submittedAt).toLocaleDateString())}</td>
            <td>${sanitizeHtml(r.verificationNote ?? '')}</td>
            <td>
              <form method="post" action="/api/admin/educator-queue/${sanitizeHtml(r.id)}/decide">
                <select name="decision"><option value="approve">Approve</option><option value="reject">Reject</option></select>
                <input type="text" name="reviewNote" placeholder="Note (required for reject)" />
                <button type="submit">Submit</button>
              </form>
            </td>
          </tr>`,
        )
        .join('')

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Educator Queue — Recall Rogue Admin</title>
<style>body{font-family:system-ui;padding:2rem}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:8px;text-align:left}tr:nth-child(even){background:#f9f9f9}</style>
</head>
<body>
<h1>Educator Verification Queue</h1>
<p>${sanitizeHtml(String(queue.length))} pending requests</p>
<table><thead><tr><th>ID</th><th>School</th><th>Domain</th><th>Submitted</th><th>Note</th><th>Action</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No pending requests</td></tr>'}</tbody></table>
</body></html>`

      return reply.type('text/html').send(html)
    }
  )

  /** In-memory cache for the dashboard HTML (5-minute TTL). */
  let dashboardCache: { html: string; expiresAt: number } | null = null

  /**
   * GET /api/admin/dashboard
   * Returns a server-rendered HTML cohort dashboard.
   * Cached in memory for 5 minutes to avoid table-scan storms.
   */
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers['x-admin-key'] !== config.adminApiKey) {
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

  // ── Phase 46: Research partner key management ──────────────────────────────

  /**
   * POST /api/admin/research-keys
   * Issue a new partner API key. Requires internal admin authorization.
   *
   * Body: { institutionName: string, contactEmail: string }
   * Returns: { rawKey, id, expiresAt }
   */
  fastify.post(
    '/research-keys',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { institutionName, contactEmail } = request.body as {
        institutionName?: string
        contactEmail?: string
      }
      if (!institutionName || !contactEmail) {
        return reply.status(400).send({ error: 'institutionName and contactEmail are required' })
      }
      const { rawKey, record } = issuePartnerKey(institutionName, contactEmail)
      return reply.status(201).send({
        rawKey,               // Transmit once to the partner; not recoverable
        id:        record.id,
        expiresAt: new Date(record.expiresAt).toISOString(),
      })
    }
  )

  /**
   * DELETE /api/admin/research-keys/:id
   * Revoke a research API key by ID.
   */
  fastify.delete(
    '/research-keys/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const revoked = revokePartnerKey(id)
      if (!revoked) return reply.status(404).send({ error: 'Key not found' })
      return reply.send({ revoked: true })
    }
  )

  /**
   * GET /api/admin/research-keys
   * List all issued research API keys (without raw key or key hash).
   */
  fastify.get(
    '/research-keys',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ keys: listPartnerKeys() })
    }
  )
}
