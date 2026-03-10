/**
 * Leaderboard routes for the Recall Rogue server.
 * Supports fetching top-50 per category and submitting scores.
 * Score submission and "my rankings" require JWT authentication.
 *
 * Anti-cheat (Phase 22.7):
 *   - Submitted scores are checked against per-category plausibility bounds.
 *   - Out-of-range scores are routed to the leaderboard_review_queue instead
 *     of being published directly.
 *   - Scores from flagged accounts are silently voided (not queued, not published).
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  RouteShorthandOptions,
} from "fastify";
import * as crypto from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { leaderboards, users, leaderboardReviewQueue, flaggedAccounts } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type {
  LeaderboardEntry,
  LeaderboardCategory,
} from "../types/index.js";

/** Maximum entries returned for a category leaderboard. */
const TOP_N = 50;

/** Maximum entries stored in the in-memory LRU cache per category. */
const CACHE_TOP_N = 100;

/** LRU cache TTL in milliseconds (60 seconds). */
const CACHE_TTL_MS = 60_000;

/** Known valid leaderboard categories. */
const VALID_CATEGORIES: Set<string> = new Set([
  "deepest_dive",
  "facts_mastered",
  "longest_streak",
  "knowledge_tree",
  "quiz_accuracy",
  "total_dives",
  "total_dust",
  "daily_expedition",
  "endless_depths",
  "scholar_challenge",
]);

// ── Plausibility bounds (Phase 22.7) ──────────────────────────────────────────

/**
 * Per-category inclusive score bounds used for plausibility checking.
 * Scores outside [min, max] are flagged for admin review instead of
 * being published directly to the live leaderboard.
 *
 * Bounds are intentionally generous to minimise false positives:
 * only physically impossible values are flagged.
 */
interface PlausibilityBounds {
  min: number;
  max: number;
}

const PLAUSIBILITY_BOUNDS: Readonly<Record<string, PlausibilityBounds>> = {
  /** Layers 1–20 (game design: 20-layer grid per dive). */
  deepest_dive: { min: 1, max: 20 },
  /** Non-negative; capped at 10 000 (the entire fact database). */
  facts_mastered: { min: 0, max: 10_000 },
  /** Non-negative; capped at 3 650 days (10 years of daily play). */
  longest_streak: { min: 0, max: 3_650 },
  /** Non-negative; no tight upper bound (stage 0–N). */
  knowledge_tree: { min: 0, max: Number.MAX_SAFE_INTEGER },
  /**
   * Quiz accuracy submitted directly by clients is a percentage (0–100).
   * The nightly analytics/leaderboards.ts job uses basis points (0–10 000)
   * and writes directly to the DB, bypassing this route — so the route-level
   * bound is capped at 100 as specified in the Phase 22.7 task.
   */
  quiz_accuracy: { min: 0, max: 100 },
  /** Non-negative; capped at 100 000 dives (unreachable in practice). */
  total_dives: { min: 0, max: 100_000 },
  /** total_dust has no meaningful upper bound for now. */
  total_dust: { min: 0, max: Number.MAX_SAFE_INTEGER },
  /** Daily expedition score (accuracy/speed/depth/combo composite). */
  daily_expedition: { min: 0, max: 1_000_000 },
  /** Endless score scales with floor and accuracy; keep bound generous. */
  endless_depths: { min: 0, max: 10_000_000 },
  /** Weekly curated scholar challenge composite score. */
  scholar_challenge: { min: 0, max: 1_500_000 },
};

/**
 * Check whether a score value is within the plausible range for its category.
 * Returns the plausibility verdict and a human-readable reason on failure.
 *
 * @param category - The leaderboard category string.
 * @param score    - The floored integer score being submitted.
 * @returns An object: `{ plausible: true }` or `{ plausible: false, reason }`.
 */
function checkScorePlausibility(
  category: string,
  score: number
): { plausible: true } | { plausible: false; reason: string } {
  const bounds = PLAUSIBILITY_BOUNDS[category];
  if (!bounds) {
    // No bounds configured — allow the score through
    return { plausible: true };
  }
  if (score < bounds.min || score > bounds.max) {
    return {
      plausible: false,
      reason:
        `score ${score} is outside plausible range [${bounds.min}, ${bounds.max}] ` +
        `for category "${category}"`,
    };
  }
  return { plausible: true };
}

/**
 * Check whether a user is currently flagged for suspicious activity.
 * Flagged accounts have their scores silently voided (not queued, not published).
 *
 * @param userId - The user's UUID to check.
 * @returns True if the account has an active flag.
 */
async function isAccountFlagged(userId: string): Promise<boolean> {
  const flag = await db
    .select({ id: flaggedAccounts.id })
    .from(flaggedAccounts)
    .where(
      sql`${flaggedAccounts.userId} = ${userId} AND ${flaggedAccounts.isActive} = 1`
    )
    .get();
  return flag !== undefined;
}

// ── In-memory LRU cache ───────────────────────────────────────────────────────

/**
 * A single cache entry holding the cached result and its expiry timestamp.
 */
interface CacheEntry {
  data: LeaderboardEntry[];
  expiresAt: number;
}

/**
 * Minimal LRU cache for top-100 leaderboard results per category.
 * Evicts the least-recently-used entry when the capacity is exceeded.
 * Each entry expires after CACHE_TTL_MS milliseconds.
 *
 * Using a Map preserves insertion order; moving an accessed key to the end
 * (delete + re-insert) implements the LRU eviction policy in O(1).
 */
class LeaderboardLruCache {
  private readonly capacity: number;
  private readonly store = new Map<string, CacheEntry>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** Retrieve a cached result for `category`, or null if missing/expired. */
  get(category: string): LeaderboardEntry[] | null {
    const entry = this.store.get(category);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(category);
      return null;
    }
    // Move to most-recently-used position
    this.store.delete(category);
    this.store.set(category, entry);
    return entry.data;
  }

  /** Store a result for `category`. Evicts the LRU entry if at capacity. */
  set(category: string, data: LeaderboardEntry[]): void {
    if (this.store.has(category)) {
      this.store.delete(category);
    } else if (this.store.size >= this.capacity) {
      // Evict the oldest (first) key
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(category, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  /** Invalidate the cache entry for `category` (call after a score upsert). */
  invalidate(category: string): void {
    this.store.delete(category);
  }

  /** Invalidate all cache keys starting with a given prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

/** Singleton cache — shared across all requests in this process. */
const leaderboardCache = new LeaderboardLruCache(VALID_CATEGORIES.size + 10);

const withAuth: RouteShorthandOptions = { preHandler: requireAuth };

/**
 * Validate a leaderboard category string.
 * Allows known categories and rejects unknown ones to prevent spam.
 *
 * @param category - The category string from the URL parameter.
 * @returns True if the category is valid.
 */
function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.has(category);
}

/**
 * Safely parse a JSON string, returning null on failure.
 *
 * @param str - A string that may contain JSON.
 * @returns The parsed value, or null if parsing fails.
 */
function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Parse and validate a `YYYY-MM-DD` date key used by Daily Expedition.
 */
function parseDailyDateKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * Parse and validate a `YYYY-MM-DD` week key used by Scholar Challenge.
 */
function parseWeekKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function isCycleScopedCategory(category: string): boolean {
  return category === "daily_expedition" || category === "scholar_challenge";
}

/**
 * Build a cache key for category + optional daily date key.
 * Daily Expedition leaderboards are cached per date key.
 */
function buildCacheKey(
  category: string,
  dateKey: string | null,
  weekKey: string | null,
): string {
  if (category === "daily_expedition" && dateKey) {
    return `${category}::date:${dateKey}`;
  }
  if (category === "scholar_challenge" && weekKey) {
    return `${category}::week:${weekKey}`;
  }
  return category;
}

/**
 * Register leaderboard routes on the Fastify instance.
 * All routes are prefixed with /api/leaderboards by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /me — user's own rankings ───────────────────────────────────────────

  /**
   * GET /api/leaderboards/me
   * Returns the authenticated user's best score and rank in every category.
   * Route registered before /:category to avoid the param catching "me".
   */
  fastify.get(
    "/me",
    withAuth,
    async (request: FastifyRequest): Promise<LeaderboardEntry[]> => {
      const { sub: userId } = getAuthUser(request);
      const me = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      const results: LeaderboardEntry[] = [];

      for (const category of VALID_CATEGORIES) {
        // Get this user's best score in the category
        const myBest = await db
          .select({ score: leaderboards.score })
          .from(leaderboards)
          .where(
            sql`${leaderboards.userId} = ${userId} AND ${leaderboards.category} = ${category}`
          )
          .orderBy(desc(leaderboards.score))
          .limit(1)
          .get();

        if (!myBest) {
          results.push({
            id: `me-${category}`,
            userId,
            displayName: me?.displayName ?? null,
            category,
            score: 0,
            metadata: null,
            createdAt: Date.now(),
            rank: 0,
          });
          continue;
        }

        // Count how many distinct users have a higher score
        const higherCount = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${leaderboards.userId})` })
          .from(leaderboards)
          .where(
            sql`${leaderboards.category} = ${category} AND ${leaderboards.score} > ${myBest.score}`
          )
          .get();

        const rank = (higherCount?.count ?? 0) + 1;

        results.push({
          id: `me-${category}`,
          userId,
          displayName: me?.displayName ?? null,
          category,
          score: myBest.score,
          metadata: null,
          createdAt: Date.now(),
          rank,
        });
      }

      return results;
    }
  );

  // ── GET /:category — top 50 (cached) ────────────────────────────────────────

  /**
   * GET /api/leaderboards/:category
   * Returns the top 50 entries for the given category.
   * Results are served from an in-memory LRU cache (60-second TTL, top-100
   * entries per category) to reduce database load under read traffic.
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/:category",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { category: string };
      const { category } = params;
      const query = request.query as Record<string, unknown>;
      const rawLimit = query?.limit;
      const limit = Math.max(
        1,
        Math.min(
          TOP_N,
          typeof rawLimit === "string"
            ? parseInt(rawLimit, 10) || TOP_N
            : TOP_N
        )
      );
      const requestedDateKey = parseDailyDateKey(query?.dateKey);
      const requestedWeekKey = parseWeekKey(query?.weekKey);
      const cacheKey = buildCacheKey(category, requestedDateKey, requestedWeekKey);

      if (!isValidCategory(category)) {
        return reply.status(400).send({
          error: `Unknown category. Valid: ${[...VALID_CATEGORIES].join(", ")}`,
          statusCode: 400,
        });
      }

      // Try the LRU cache first (avoids a DB query for 60 seconds after each write)
      const cached = leaderboardCache.get(cacheKey);
      if (cached !== null) {
        return cached.slice(0, limit);
      }

      // Cache miss — query the database.
      // Fetch CACHE_TOP_N rows so the cache can serve any slice up to that limit.
      const queryLimit = isCycleScopedCategory(category) ? 1000 : CACHE_TOP_N;
      const rows = await db
        .select({
          id: leaderboards.id,
          userId: leaderboards.userId,
          displayName: users.displayName,
          category: leaderboards.category,
          score: leaderboards.score,
          metadata: leaderboards.metadata,
          createdAt: leaderboards.createdAt,
        })
        .from(leaderboards)
        .leftJoin(users, eq(leaderboards.userId, users.id))
        .where(eq(leaderboards.category, category as LeaderboardCategory))
        .orderBy(desc(leaderboards.score))
        .limit(queryLimit)
        .all();

      // Cycle-scoped categories can be requested for a specific cycle key.
      const filteredRows = rows.filter((row) => {
        if (category === "daily_expedition" && requestedDateKey) {
          const parsed = row.metadata ? tryParseJson(row.metadata) : null;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return false;
          }
          return (parsed as Record<string, unknown>).dateKey === requestedDateKey;
        }
        if (category === "scholar_challenge" && requestedWeekKey) {
          const parsed = row.metadata ? tryParseJson(row.metadata) : null;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return false;
          }
          return (parsed as Record<string, unknown>).weekKey === requestedWeekKey;
        }
        return true;
      });

      // Deduplicate: keep only the best score per user (one row per user_id
      // guaranteed by the upsert on write, but guard here for legacy data).
      const seen = new Set<string>();
      const deduped: typeof filteredRows = [];
      for (const row of filteredRows) {
        if (!seen.has(row.userId)) {
          seen.add(row.userId);
          deduped.push(row);
        }
      }

      const result: LeaderboardEntry[] = deduped.map((row, index) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.displayName ?? null,
        category: row.category,
        score: row.score,
        metadata: row.metadata ? tryParseJson(row.metadata) : null,
        createdAt: row.createdAt,
        rank: index + 1,
      }));

      // Populate the cache for subsequent requests
      leaderboardCache.set(cacheKey, result);

      return result.slice(0, limit);
    }
  );

  // ── POST /:category — submit score ──────────────────────────────────────────

  /**
   * POST /api/leaderboards/:category
   * Submit a new score for the authenticated user in the given category.
   * Body: { score: number, metadata?: object }
   */
  fastify.post(
    "/:category",
    withAuth,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { category: string };
      const { category } = params;
      const { sub: userId } = getAuthUser(request);

      const body = request.body as Record<string, unknown> | null | undefined;
      const score = body?.score;
      const metadata = body?.metadata;

      if (!isValidCategory(category)) {
        return reply.status(400).send({
          error: `Unknown category. Valid: ${[...VALID_CATEGORIES].join(", ")}`,
          statusCode: 400,
        });
      }

      if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
        return reply.status(400).send({
          error: "score must be a non-negative finite number",
          statusCode: 400,
        });
      }

      if (
        metadata !== undefined &&
        (typeof metadata !== "object" ||
          Array.isArray(metadata) ||
          metadata === null)
      ) {
        return reply.status(400).send({
          error: "metadata must be a JSON object if provided",
          statusCode: 400,
        });
      }

      const now = Date.now();
      const flooredScore = Math.floor(score);

      let serialisedMeta: string | null = null;
      if (metadata !== undefined) {
        try {
          serialisedMeta = JSON.stringify(metadata);
        } catch {
          return reply.status(400).send({
            error: "metadata is not serialisable",
            statusCode: 400,
          });
        }
      }

      // ── Anti-cheat: flagged account check (Phase 22.7) ────────────────────
      // Scores from flagged accounts are silently voided — the request returns
      // 202 Accepted so clients cannot detect the flag via response inspection.
      const flagged = await isAccountFlagged(userId);
      if (flagged) {
        // Return a plausible-looking 202 with no leaderboard side-effects.
        return reply.status(202).send({
          message: "Score received",
          queued: false,
          flagged: true,
        });
      }

      // ── Anti-cheat: plausibility check (Phase 22.7) ───────────────────────
      // Out-of-range scores are queued for admin review rather than published.
      const plausibilityResult = checkScorePlausibility(category, flooredScore);
      if (!plausibilityResult.plausible) {
        const reviewId = crypto.randomUUID();
        await db.insert(leaderboardReviewQueue).values({
          id: reviewId,
          userId,
          category,
          score: flooredScore,
          metadata: serialisedMeta,
          reason: plausibilityResult.reason,
          status: "pending",
          createdAt: now,
        });
        // Return 202 Accepted — the client knows its score was received but
        // cannot distinguish queued-for-review from published.
        return reply.status(202).send({
          message: "Score received and queued for review",
          queued: true,
          reviewId,
        });
      }

      let entryId: string;
      let entryCreatedAt: number;
      let effectiveScore = flooredScore;
      let rank = 1;

      if (isCycleScopedCategory(category)) {
        const cycleKeyField = category === "daily_expedition" ? "dateKey" : "weekKey";
        const rawCycleKey = metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)[cycleKeyField]
          : null;
        const cycleKey = category === "daily_expedition"
          ? parseDailyDateKey(rawCycleKey)
          : parseWeekKey(rawCycleKey);
        if (!cycleKey) {
          const keyLabel = category === "daily_expedition" ? "metadata.dateKey" : "metadata.weekKey";
          return reply.status(400).send({
            error: `${category} submissions require ${keyLabel} (YYYY-MM-DD)`,
            statusCode: 400,
          });
        }

        // One submission per cycle per user.
        const existingRows = await db
          .select({
            metadata: leaderboards.metadata,
          })
          .from(leaderboards)
          .where(
            sql`${leaderboards.userId} = ${userId} AND ${leaderboards.category} = ${category}`
          )
          .all();
        const alreadySubmittedForCycle = existingRows.some((row) => {
          const parsed = row.metadata ? tryParseJson(row.metadata) : null;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
          return (parsed as Record<string, unknown>)[cycleKeyField] === cycleKey;
        });
        if (alreadySubmittedForCycle) {
          const cycleLabel = category === "daily_expedition" ? "dateKey" : "weekKey";
          return reply.status(409).send({
            error: `${category} score already submitted for this ${cycleLabel}`,
            statusCode: 409,
          });
        }

        entryId = crypto.randomUUID();
        entryCreatedAt = now;
        await db.insert(leaderboards).values({
          id: entryId,
          userId,
          category,
          score: flooredScore,
          metadata: serialisedMeta,
          createdAt: now,
        });
        leaderboardCache.invalidatePrefix(`${category}::`);
        leaderboardCache.invalidate(category);

        // Rank within this specific cycle key.
        const cycleRows = await db
          .select({
            userId: leaderboards.userId,
            score: leaderboards.score,
            metadata: leaderboards.metadata,
          })
          .from(leaderboards)
          .where(eq(leaderboards.category, category as LeaderboardCategory))
          .orderBy(desc(leaderboards.score))
          .limit(2000)
          .all();
        const seenUsers = new Set<string>();
        let higherDistinctUsers = 0;
        for (const row of cycleRows) {
          if (seenUsers.has(row.userId)) continue;
          const parsed = row.metadata ? tryParseJson(row.metadata) : null;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
          if ((parsed as Record<string, unknown>)[cycleKeyField] !== cycleKey) continue;
          seenUsers.add(row.userId);
          if (row.score > flooredScore) {
            higherDistinctUsers += 1;
          }
        }
        rank = higherDistinctUsers + 1;
      } else {
        // ── Upsert: one row per (userId, category) ──────────────────────────
        const existingEntry = await db
          .select({ id: leaderboards.id, score: leaderboards.score })
          .from(leaderboards)
          .where(
            sql`${leaderboards.userId} = ${userId} AND ${leaderboards.category} = ${category}`
          )
          .get();

        if (existingEntry) {
          entryId = existingEntry.id;
          if (flooredScore > existingEntry.score) {
            await db
              .update(leaderboards)
              .set({ score: flooredScore, metadata: serialisedMeta })
              .where(eq(leaderboards.id, existingEntry.id));
            leaderboardCache.invalidate(category);
          }
          entryCreatedAt = now;
          effectiveScore = Math.max(existingEntry.score, flooredScore);
        } else {
          entryId = crypto.randomUUID();
          entryCreatedAt = now;
          await db.insert(leaderboards).values({
            id: entryId,
            userId,
            category,
            score: flooredScore,
            metadata: serialisedMeta,
            createdAt: now,
          });
          leaderboardCache.invalidate(category);
        }

        const higherCount = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${leaderboards.userId})` })
          .from(leaderboards)
          .where(
            sql`${leaderboards.category} = ${category} AND ${leaderboards.score} > ${effectiveScore}`
          )
          .get();
        rank = (higherCount?.count ?? 0) + 1;
      }

      const user = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      const result: LeaderboardEntry = {
        id: entryId,
        userId,
        displayName: user?.displayName ?? null,
        category,
        score: effectiveScore,
        metadata: metadata ?? null,
        createdAt: entryCreatedAt,
        rank,
      };
      return reply.status(201).send(result);
    }
  );
}
