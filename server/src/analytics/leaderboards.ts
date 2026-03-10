/**
 * Leaderboard score computation service for Recall Rogue.
 * Runs nightly to aggregate player performance across all 6 categories and
 * upsert the results into the leaderboards table.
 *
 * Categories:
 *   deepest_dive       — maximum layer reached in a single dive (from saves)
 *   facts_mastered     — count of SM-2 cards with reps >= 5 (from saves)
 *   longest_streak     — highest consecutive daily login streak (from saves)
 *   knowledge_tree     — knowledge tree upgrade stage reached (from saves)
 *   quiz_accuracy      — correct / total quiz answers (min 50 reviews, from analytics)
 *   total_dives        — cumulative dive count (from saves)
 *
 * Usage:
 *   Import computeAllLeaderboardScores() and call from a cron job:
 *   ```ts
 *   import { computeAllLeaderboardScores } from './analytics/leaderboards.js'
 *   // nightly at midnight UTC:
 *   setInterval(computeAllLeaderboardScores, 24 * 60 * 60 * 1_000)
 *   ```
 */

import * as crypto from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { saves, leaderboards, analyticsEvents } from "../db/schema.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** All category identifiers computed by this service. */
type ComputedCategory =
  | "deepest_dive"
  | "facts_mastered"
  | "longest_streak"
  | "knowledge_tree"
  | "quiz_accuracy"
  | "total_dives";

/**
 * A single computed score for one player in one category.
 */
interface ComputedScore {
  userId: string;
  category: ComputedCategory;
  score: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Summary returned by computeAllLeaderboardScores().
 */
export interface ComputationSummary {
  computedAt: number;
  categoriesProcessed: ComputedCategory[];
  totalUpserts: number;
  errors: string[];
}

// ── Save-data parser ──────────────────────────────────────────────────────────

/**
 * Safely parse a PlayerSave JSON blob.
 * Returns null on any parse or type error.
 *
 * @param raw - Raw JSON string from saves.saveData.
 * @returns Parsed object, or null.
 */
function parseSaveData(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely read a nested numeric value from a parsed save blob.
 *
 * @param save  - Parsed save object.
 * @param keys  - Sequence of property keys to traverse.
 * @returns The numeric value, or 0 if not found / not a number.
 */
function getNum(save: Record<string, unknown>, ...keys: string[]): number {
  let cursor: unknown = save;
  for (const key of keys) {
    if (cursor === null || typeof cursor !== "object") return 0;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "number" && Number.isFinite(cursor) ? cursor : 0;
}

/**
 * Count SM-2 cards with reps >= threshold (mastered facts).
 * SM-2 cards are stored in save.learning.sm2Cards as an object keyed by factId.
 *
 * @param save          - Parsed save object.
 * @param minReps       - Minimum rep count to consider a card mastered.
 * @returns Count of mastered fact cards.
 */
function countMasteredFacts(
  save: Record<string, unknown>,
  minReps = 5
): number {
  const learning = save["learning"];
  if (!learning || typeof learning !== "object") return 0;
  const sm2Cards = (learning as Record<string, unknown>)["sm2Cards"];
  if (!sm2Cards || typeof sm2Cards !== "object") return 0;

  let count = 0;
  for (const cardValue of Object.values(sm2Cards as Record<string, unknown>)) {
    if (
      cardValue &&
      typeof cardValue === "object" &&
      typeof (cardValue as Record<string, unknown>)["reps"] === "number" &&
      ((cardValue as Record<string, unknown>)["reps"] as number) >= minReps
    ) {
      count++;
    }
  }
  return count;
}

// ── Per-category computation ──────────────────────────────────────────────────

/**
 * Compute scores for all save-derived categories for a single player.
 * Returns one score entry per relevant category.
 *
 * @param userId   - The player's UUID.
 * @param saveData - Parsed save data for the player's latest active save.
 * @returns Array of computed scores (may be empty if save is malformed).
 */
function computeSaveScores(
  userId: string,
  saveData: Record<string, unknown>
): ComputedScore[] {
  const scores: ComputedScore[] = [];

  // ── deepest_dive ────────────────────────────────────────────────────────────
  // Location in save: progression.maxLayerReached or stats.deepestLayer
  const deepestLayer = Math.max(
    getNum(saveData, "progression", "maxLayerReached"),
    getNum(saveData, "stats", "deepestLayer")
  );
  if (deepestLayer > 0) {
    scores.push({
      userId,
      category: "deepest_dive",
      score: deepestLayer,
      metadata: null,
    });
  }

  // ── facts_mastered ──────────────────────────────────────────────────────────
  // SM-2 cards with reps >= 5 in save.learning.sm2Cards
  const masteredCount = countMasteredFacts(saveData, 5);
  if (masteredCount > 0) {
    scores.push({
      userId,
      category: "facts_mastered",
      score: masteredCount,
      metadata: null,
    });
  }

  // ── longest_streak ──────────────────────────────────────────────────────────
  // Location in save: learning.longestStreak or streaks.longest
  const longestStreak = Math.max(
    getNum(saveData, "learning", "longestStreak"),
    getNum(saveData, "streaks", "longest"),
    getNum(saveData, "longestStreak")
  );
  if (longestStreak > 0) {
    scores.push({
      userId,
      category: "longest_streak",
      score: longestStreak,
      metadata: null,
    });
  }

  // ── knowledge_tree ──────────────────────────────────────────────────────────
  // Location in save: dome.knowledgeTreeStage (0–5)
  const knowledgeStage = Math.max(
    getNum(saveData, "dome", "knowledgeTreeStage"),
    getNum(saveData, "knowledgeTreeStage")
  );
  if (knowledgeStage > 0) {
    scores.push({
      userId,
      category: "knowledge_tree",
      score: knowledgeStage,
      metadata: null,
    });
  }

  // ── total_dives ─────────────────────────────────────────────────────────────
  // Location in save: progression.diveCount or stats.totalDives
  const totalDives = Math.max(
    getNum(saveData, "progression", "diveCount"),
    getNum(saveData, "stats", "totalDives"),
    getNum(saveData, "diveCount")
  );
  if (totalDives > 0) {
    scores.push({
      userId,
      category: "total_dives",
      score: totalDives,
      metadata: null,
    });
  }

  return scores;
}

/**
 * Compute quiz_accuracy scores from the analytics_events table.
 * Only includes players with at least 50 total quiz answers.
 *
 * Event schema used:
 *   event_name = "quiz_answered"
 *   properties (JSON): { correct: boolean, userId?: string }
 *
 * Note: analytics events are not tied to userId by FK for privacy reasons
 * (sessionId-only schema). This function reads any `userId` field in the
 * event properties bag as a best-effort approach.
 *
 * @returns Array of quiz_accuracy ComputedScore entries.
 */
async function computeQuizAccuracyScores(): Promise<ComputedScore[]> {
  const MIN_REVIEWS = 50;

  // Fetch all quiz_answered events
  const events = await db
    .select({ properties: analyticsEvents.properties })
    .from(analyticsEvents)
    .where(sql`${analyticsEvents.eventName} = 'quiz_answered'`)
    .all();

  // Aggregate per-user totals
  const userTotals = new Map<string, { total: number; correct: number }>();

  for (const row of events) {
    let props: Record<string, unknown>;
    try {
      const parsed = JSON.parse(row.properties);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      props = parsed as Record<string, unknown>;
    } catch {
      continue;
    }

    const userId = typeof props["userId"] === "string" ? props["userId"] : null;
    if (!userId) continue;

    const isCorrect = props["correct"] === true;

    const entry = userTotals.get(userId) ?? { total: 0, correct: 0 };
    entry.total++;
    if (isCorrect) entry.correct++;
    userTotals.set(userId, entry);
  }

  // Build scores for players meeting the minimum review threshold
  const scores: ComputedScore[] = [];
  for (const [userId, totals] of userTotals) {
    if (totals.total < MIN_REVIEWS) continue;
    // Score is accuracy in basis points (0–10000) to preserve precision as integer
    const accuracyBps = Math.round((totals.correct / totals.total) * 10_000);
    scores.push({
      userId,
      category: "quiz_accuracy",
      score: accuracyBps,
      metadata: {
        totalReviews: totals.total,
        correctReviews: totals.correct,
        accuracyPercent: Math.round((totals.correct / totals.total) * 100 * 100) / 100,
      },
    });
  }

  return scores;
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

/**
 * Upsert a leaderboard score: insert a new row or update if the new score is
 * strictly higher than the existing one.  Matches the same upsert strategy
 * used by the /api/leaderboards/:category POST route.
 *
 * @param score - The computed score to persist.
 * @returns True if a row was inserted or updated, false if skipped.
 */
async function upsertScore(score: ComputedScore): Promise<boolean> {
  const serialisedMeta = score.metadata
    ? JSON.stringify(score.metadata)
    : null;

  const existing = await db
    .select({ id: leaderboards.id, score: leaderboards.score })
    .from(leaderboards)
    .where(
      sql`${leaderboards.userId} = ${score.userId} AND ${leaderboards.category} = ${score.category}`
    )
    .get();

  const now = Date.now();

  if (existing) {
    if (score.score > existing.score) {
      await db
        .update(leaderboards)
        .set({ score: score.score, metadata: serialisedMeta })
        .where(eq(leaderboards.id, existing.id));
      return true;
    }
    return false; // New score is not better; skip
  }

  await db.insert(leaderboards).values({
    id: crypto.randomUUID(),
    userId: score.userId,
    category: score.category,
    score: score.score,
    metadata: serialisedMeta,
    createdAt: now,
  });
  return true;
}

// ── Main computation entry point ──────────────────────────────────────────────

/**
 * Compute leaderboard scores across all 6 categories for every player and
 * upsert the results into the leaderboards table.
 *
 * This function is designed to be called by a nightly cron job.  It is safe
 * to call multiple times (idempotent upserts); only improvements are written.
 *
 * Algorithm:
 *   1. Fetch the latest active save for every user.
 *   2. Parse each save and derive scores for the 5 save-based categories.
 *   3. Query analytics_events to derive quiz_accuracy scores separately.
 *   4. Upsert all scores into the leaderboards table.
 *
 * @returns A ComputationSummary with counts and any non-fatal errors.
 */
export async function computeAllLeaderboardScores(): Promise<ComputationSummary> {
  const computedAt = Date.now();
  const errors: string[] = [];
  let totalUpserts = 0;

  const categoriesProcessed: ComputedCategory[] = [
    "deepest_dive",
    "facts_mastered",
    "longest_streak",
    "knowledge_tree",
    "quiz_accuracy",
    "total_dives",
  ];

  // ── Phase 1: Save-based categories ─────────────────────────────────────────

  // Fetch the most recent save per user using a subquery approach.
  // SQLite does not support DISTINCT ON; we use a CTE via raw SQL.
  //
  // Strategy: fetch all saves ordered by updatedAt desc, then deduplicate
  // in application code — acceptable for the expected user volume.
  const allSaves = await db
    .select({ userId: saves.userId, saveData: saves.saveData, updatedAt: saves.updatedAt })
    .from(saves)
    .orderBy(desc(saves.updatedAt))
    .all();

  // Keep only the most recent save per user
  const latestSavePerUser = new Map<string, { saveData: string }>();
  for (const row of allSaves) {
    if (!latestSavePerUser.has(row.userId)) {
      latestSavePerUser.set(row.userId, { saveData: row.saveData });
    }
  }

  for (const [userId, { saveData }] of latestSavePerUser) {
    const parsed = parseSaveData(saveData);
    if (!parsed) {
      errors.push(`Failed to parse save for user ${userId}`);
      continue;
    }

    const scores = computeSaveScores(userId, parsed);
    for (const score of scores) {
      try {
        const updated = await upsertScore(score);
        if (updated) totalUpserts++;
      } catch (err) {
        errors.push(
          `Upsert failed for ${userId}/${score.category}: ${String(err)}`
        );
      }
    }
  }

  // ── Phase 2: Analytics-based categories ────────────────────────────────────

  try {
    const quizScores = await computeQuizAccuracyScores();
    for (const score of quizScores) {
      try {
        const updated = await upsertScore(score);
        if (updated) totalUpserts++;
      } catch (err) {
        errors.push(
          `Upsert failed for ${score.userId}/quiz_accuracy: ${String(err)}`
        );
      }
    }
  } catch (err) {
    errors.push(`quiz_accuracy computation failed: ${String(err)}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const summary: ComputationSummary = {
    computedAt,
    categoriesProcessed,
    totalUpserts,
    errors,
  };

  if (errors.length > 0) {
    console.warn(
      `[leaderboards] Nightly computation completed with ${errors.length} error(s):`,
      errors
    );
  } else {
    console.log(
      `[leaderboards] Nightly computation complete — ${totalUpserts} upserts across ` +
        `${categoriesProcessed.length} categories`
    );
  }

  return summary;
}
