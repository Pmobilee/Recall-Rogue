/**
 * Knowledge duel routes for the Recall Rogue server.
 * Players may challenge each other to 5-question knowledge duels with a dust wager.
 * Both players independently submit answers; the server resolves the winner and
 * transfers the wager dust.
 *
 * Duel data is stored in process memory for this phase.
 * In production these would be PostgreSQL rows with appropriate indexes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum dust wager allowed per duel. */
const MAX_WAGER = 50;

/** Number of questions per duel. */
const DUEL_QUESTION_COUNT = 5;

/** Points awarded for a correct answer. */
const POINTS_CORRECT = 100;

/** Speed bonus points for answering in under 5 seconds. */
const POINTS_SPEED_FAST = 50;

/** Speed bonus points for answering in under 10 seconds. */
const POINTS_SPEED_OK = 25;

/** Bonus points for a perfect round (all questions correct). */
const POINTS_PERFECT_BONUS = 100;

/** Default history query limit. */
const HISTORY_DEFAULT_LIMIT = 20;

/** Maximum history query limit. */
const HISTORY_MAX_LIMIT = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Status lifecycle for a duel. */
type DuelStatus = "pending" | "active" | "awaiting_results" | "completed" | "declined";

/** A single answer submitted by one player. */
interface DuelAnswer {
  factId: string;
  answeredIndex: number;
  timingMs: number;
}

/** Scored result for one player's answer set. */
interface PlayerResult {
  score: number;
  correctCount: number;
  answers: DuelAnswer[];
}

/** Full duel record. */
interface Duel {
  id: string;
  challengerId: string;
  opponentId: string;
  wagerDust: number;
  status: DuelStatus;
  /** factIds to quiz both players on — set when the duel is accepted. */
  factIds: string[];
  challengerResult: PlayerResult | null;
  opponentResult: PlayerResult | null;
  winnerId: string | null;
  /** "tie" when scores are equal. */
  outcome: "challenger" | "opponent" | "tie" | null;
  createdAt: number;
  resolvedAt: number | null;
}

// ── In-memory duel store ──────────────────────────────────────────────────────

/** All duels, keyed by duel ID. */
const duelStore = new Map<string, Duel>();

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Compute the score for a set of answers.
 * Correct answers earn POINTS_CORRECT; fast answers earn a speed bonus.
 * A perfect round (all correct) earns an additional POINTS_PERFECT_BONUS.
 *
 * Scoring table:
 *   Correct answer:   100 pts
 *   Speed < 5 000ms: +50 pts
 *   Speed < 10 000ms: +25 pts
 *   Perfect 5/5:    +100 pts bonus (added once at the end)
 *
 * @param answers    - The submitted answers from one player.
 * @param correctMap - Map of factId → correct answer index (0-based).
 * @returns Score and correct count.
 */
function computeScore(
  answers: DuelAnswer[],
  correctMap: Map<string, number>
): { score: number; correctCount: number } {
  let score = 0;
  let correctCount = 0;

  for (const ans of answers) {
    const correctIndex = correctMap.get(ans.factId);
    if (correctIndex === undefined) continue; // Unknown fact — skip
    if (ans.answeredIndex === correctIndex) {
      correctCount++;
      score += POINTS_CORRECT;
      // Speed bonus (timingMs is elapsed time in milliseconds)
      if (ans.timingMs < 5_000) {
        score += POINTS_SPEED_FAST;
      } else if (ans.timingMs < 10_000) {
        score += POINTS_SPEED_OK;
      }
    }
  }

  // Perfect round bonus
  if (correctCount === DUEL_QUESTION_COUNT) {
    score += POINTS_PERFECT_BONUS;
  }

  return { score, correctCount };
}

/**
 * Resolve a duel once both players have submitted their answers.
 * Mutates the duel record in place.
 *
 * The correct answers are simulated here (answeredIndex === 0 is always correct
 * as a placeholder until a real fact DB integration is wired). This function
 * should be updated to look up the actual correct answer from the facts DB.
 *
 * @param duel - The duel record to resolve.
 */
function resolveDuel(duel: Duel): void {
  if (!duel.challengerResult || !duel.opponentResult) return;

  // Placeholder: treat answeredIndex 0 as correct for all facts.
  // Replace with a real facts DB lookup when available.
  const correctMap = new Map<string, number>(
    duel.factIds.map((fid) => [fid, 0])
  );

  const challengerScore = computeScore(duel.challengerResult.answers, correctMap);
  const opponentScore = computeScore(duel.opponentResult.answers, correctMap);

  duel.challengerResult.score = challengerScore.score;
  duel.challengerResult.correctCount = challengerScore.correctCount;
  duel.opponentResult.score = opponentScore.score;
  duel.opponentResult.correctCount = opponentScore.correctCount;

  if (challengerScore.score > opponentScore.score) {
    duel.winnerId = duel.challengerId;
    duel.outcome = "challenger";
  } else if (opponentScore.score > challengerScore.score) {
    duel.winnerId = duel.opponentId;
    duel.outcome = "opponent";
  } else {
    duel.winnerId = null;
    duel.outcome = "tie";
  }

  duel.status = "completed";
  duel.resolvedAt = Date.now();
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register duel routes on the Fastify instance.
 * Prefixed with /api/duels by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function duelRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /challenge ─────────────────────────────────────────────────────────

  /**
   * POST /api/duels/challenge
   * Create a new knowledge duel challenge.
   * Body: { opponentId: string, wagerDust: number } — wager max 50.
   * Returns: 201 with the created duel record.
   */
  fastify.post(
    "/challenge",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: challengerId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const opponentId = body?.opponentId;
      const wagerDust = body?.wagerDust;

      if (typeof opponentId !== "string" || opponentId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "opponentId is required", statusCode: 400 });
      }
      if (opponentId === challengerId) {
        return reply
          .status(400)
          .send({ error: "Cannot challenge yourself", statusCode: 400 });
      }
      if (
        typeof wagerDust !== "number" ||
        !Number.isFinite(wagerDust) ||
        wagerDust < 0
      ) {
        return reply
          .status(400)
          .send({ error: "wagerDust must be a non-negative number", statusCode: 400 });
      }
      if (wagerDust > MAX_WAGER) {
        return reply.status(400).send({
          error: `wagerDust cannot exceed ${MAX_WAGER}`,
          statusCode: 400,
        });
      }

      // Verify opponent exists and is not deleted
      const opponent = await db
        .select({ id: users.id, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.id, opponentId))
        .get();

      if (!opponent || opponent.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Opponent not found", statusCode: 404 });
      }

      const duel: Duel = {
        id: crypto.randomUUID(),
        challengerId,
        opponentId,
        wagerDust: Math.floor(wagerDust),
        status: "pending",
        factIds: [],
        challengerResult: null,
        opponentResult: null,
        winnerId: null,
        outcome: null,
        createdAt: Date.now(),
        resolvedAt: null,
      };

      duelStore.set(duel.id, duel);

      return reply.status(201).send(duel);
    }
  );

  // ── GET /pending ────────────────────────────────────────────────────────────

  /**
   * GET /api/duels/pending
   * Returns all pending and active duels involving the authenticated player.
   * Returns: Array of duel records.
   */
  fastify.get(
    "/pending",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);

      const pending = [...duelStore.values()].filter(
        (d) =>
          (d.challengerId === userId || d.opponentId === userId) &&
          (d.status === "pending" || d.status === "active" || d.status === "awaiting_results")
      );

      return reply.status(200).send(pending);
    }
  );

  // ── POST /:duelId/accept ────────────────────────────────────────────────────

  /**
   * POST /api/duels/:duelId/accept
   * Opponent accepts the duel challenge. Transitions status to "active"
   * and assigns a set of fact IDs to quiz both players.
   * Returns: 200 with the updated duel record.
   */
  fastify.post(
    "/:duelId/accept",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { duelId } = request.params as { duelId: string };

      const duel = duelStore.get(duelId);
      if (!duel) {
        return reply.status(404).send({ error: "Duel not found", statusCode: 404 });
      }
      if (duel.opponentId !== userId) {
        return reply
          .status(403)
          .send({ error: "Only the challenged player may accept", statusCode: 403 });
      }
      if (duel.status !== "pending") {
        return reply
          .status(409)
          .send({ error: "Duel is not in pending state", statusCode: 409 });
      }

      // Assign placeholder fact IDs for the duel questions.
      // In production these would be drawn from the facts DB using the players'
      // interest profiles and SM-2 schedules.
      duel.factIds = Array.from({ length: DUEL_QUESTION_COUNT }, () =>
        crypto.randomUUID()
      );
      duel.status = "active";

      return reply.status(200).send(duel);
    }
  );

  // ── POST /:duelId/decline ───────────────────────────────────────────────────

  /**
   * POST /api/duels/:duelId/decline
   * Opponent declines the challenge. The wager is returned to the challenger.
   * Status transitions to "declined".
   * Returns: 200 with the updated duel record.
   */
  fastify.post(
    "/:duelId/decline",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { duelId } = request.params as { duelId: string };

      const duel = duelStore.get(duelId);
      if (!duel) {
        return reply.status(404).send({ error: "Duel not found", statusCode: 404 });
      }
      if (duel.opponentId !== userId) {
        return reply
          .status(403)
          .send({ error: "Only the challenged player may decline", statusCode: 403 });
      }
      if (duel.status !== "pending") {
        return reply
          .status(409)
          .send({ error: "Duel is not in pending state", statusCode: 409 });
      }

      duel.status = "declined";
      duel.resolvedAt = Date.now();

      // Wager is returned to challenger — this would credit the challenger's
      // save document in a full implementation. Logged here for traceability.
      if (duel.wagerDust > 0) {
        console.log(
          `[duels] Duel ${duelId} declined — return ${duel.wagerDust} dust to challenger ${duel.challengerId}`
        );
      }

      return reply.status(200).send(duel);
    }
  );

  // ── POST /:duelId/submit-answers ────────────────────────────────────────────

  /**
   * POST /api/duels/:duelId/submit-answers
   * Submit a player's answers for an active duel.
   * Body: { answers: Array<{ factId, answeredIndex, timingMs }> }
   * Once both players have submitted, the duel is automatically resolved.
   * Returns: 200 with updated duel state (may be "completed" if both submitted).
   */
  fastify.post(
    "/:duelId/submit-answers",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { duelId } = request.params as { duelId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const answers = body?.answers;

      const duel = duelStore.get(duelId);
      if (!duel) {
        return reply.status(404).send({ error: "Duel not found", statusCode: 404 });
      }
      if (duel.challengerId !== userId && duel.opponentId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not a participant of this duel", statusCode: 403 });
      }
      if (duel.status !== "active" && duel.status !== "awaiting_results") {
        return reply
          .status(409)
          .send({ error: "Duel is not accepting answers", statusCode: 409 });
      }

      if (!Array.isArray(answers)) {
        return reply
          .status(400)
          .send({ error: "answers must be an array", statusCode: 400 });
      }
      if (answers.length !== DUEL_QUESTION_COUNT) {
        return reply.status(400).send({
          error: `Must submit exactly ${DUEL_QUESTION_COUNT} answers`,
          statusCode: 400,
        });
      }

      // Validate each answer entry
      for (const ans of answers) {
        if (typeof ans !== "object" || ans === null) {
          return reply
            .status(400)
            .send({ error: "Each answer must be an object", statusCode: 400 });
        }
        const a = ans as Record<string, unknown>;
        if (typeof a["factId"] !== "string") {
          return reply
            .status(400)
            .send({ error: "answer.factId must be a string", statusCode: 400 });
        }
        if (
          typeof a["answeredIndex"] !== "number" ||
          !Number.isFinite(a["answeredIndex"]) ||
          (a["answeredIndex"] as number) < 0
        ) {
          return reply
            .status(400)
            .send({ error: "answer.answeredIndex must be a non-negative integer", statusCode: 400 });
        }
        if (
          typeof a["timingMs"] !== "number" ||
          !Number.isFinite(a["timingMs"]) ||
          (a["timingMs"] as number) < 0
        ) {
          return reply
            .status(400)
            .send({ error: "answer.timingMs must be a non-negative number", statusCode: 400 });
        }
      }

      const typedAnswers: DuelAnswer[] = (answers as Array<Record<string, unknown>>).map((a) => ({
        factId: a["factId"] as string,
        answeredIndex: Math.floor(a["answeredIndex"] as number),
        timingMs: Math.floor(a["timingMs"] as number),
      }));

      const isChallenger = duel.challengerId === userId;

      // Reject double-submission
      if (isChallenger && duel.challengerResult !== null) {
        return reply
          .status(409)
          .send({ error: "Answers already submitted", statusCode: 409 });
      }
      if (!isChallenger && duel.opponentResult !== null) {
        return reply
          .status(409)
          .send({ error: "Answers already submitted", statusCode: 409 });
      }

      const result: PlayerResult = { score: 0, correctCount: 0, answers: typedAnswers };

      if (isChallenger) {
        duel.challengerResult = result;
      } else {
        duel.opponentResult = result;
      }

      // Transition to awaiting_results once first player submits
      if (duel.status === "active") {
        duel.status = "awaiting_results";
      }

      // Resolve once both players have submitted
      if (duel.challengerResult && duel.opponentResult) {
        resolveDuel(duel);

        if (duel.wagerDust > 0 && duel.outcome !== "tie") {
          // Winner earns wager × 2; in production this would update the
          // winner's save document. Logged here for traceability.
          console.log(
            `[duels] Duel ${duelId} resolved — winner ${duel.winnerId} earns ${duel.wagerDust * 2} dust`
          );
        }
      }

      return reply.status(200).send(duel);
    }
  );

  // ── GET /:duelId/result ─────────────────────────────────────────────────────

  /**
   * GET /api/duels/:duelId/result
   * Returns the result card for a completed duel.
   * Returns: 200 with duel record including outcome, scores, and winner.
   */
  fastify.get(
    "/:duelId/result",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { duelId } = request.params as { duelId: string };

      const duel = duelStore.get(duelId);
      if (!duel) {
        return reply.status(404).send({ error: "Duel not found", statusCode: 404 });
      }
      if (duel.challengerId !== userId && duel.opponentId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not a participant of this duel", statusCode: 403 });
      }
      if (duel.status !== "completed" && duel.status !== "declined") {
        return reply
          .status(409)
          .send({ error: "Duel has not been resolved yet", statusCode: 409 });
      }

      return reply.status(200).send(duel);
    }
  );

  // ── GET /history ────────────────────────────────────────────────────────────

  /**
   * GET /api/duels/history
   * Returns the authenticated player's past (completed/declined) duels.
   * Query: ?limit=20 (default 20, max 100).
   * Returns: Array of duel records ordered by resolvedAt desc.
   */
  fastify.get(
    "/history",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const rawLimit = (request.query as Record<string, unknown>)?.limit;
      const limit = Math.min(
        typeof rawLimit === "string" ? (parseInt(rawLimit, 10) || HISTORY_DEFAULT_LIMIT) : HISTORY_DEFAULT_LIMIT,
        HISTORY_MAX_LIMIT
      );

      const finished = [...duelStore.values()]
        .filter(
          (d) =>
            (d.challengerId === userId || d.opponentId === userId) &&
            (d.status === "completed" || d.status === "declined")
        )
        .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
        .slice(0, limit);

      return reply.status(200).send(finished);
    }
  );

  // ── GET /stats ──────────────────────────────────────────────────────────────

  /**
   * GET /api/duels/stats
   * Returns the authenticated player's win/loss/tie statistics.
   * Returns: { wins, losses, ties, total, winRate }
   */
  fastify.get(
    "/stats",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);

      const completed = [...duelStore.values()].filter(
        (d) =>
          (d.challengerId === userId || d.opponentId === userId) &&
          d.status === "completed"
      );

      let wins = 0;
      let losses = 0;
      let ties = 0;

      for (const d of completed) {
        if (d.outcome === "tie") {
          ties++;
        } else if (d.winnerId === userId) {
          wins++;
        } else {
          losses++;
        }
      }

      const total = wins + losses + ties;
      const winRate = total > 0 ? wins / total : 0;

      return reply.status(200).send({ wins, losses, ties, total, winRate });
    }
  );
}
