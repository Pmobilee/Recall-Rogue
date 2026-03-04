/**
 * Fact pack delivery routes for the Terra Gacha server.
 *
 * Provides public (no-auth) endpoints that return pre-packaged JSON bundles of
 * approved facts so game clients can cache them locally for offline play.
 *
 * Routes registered under the prefix `/api/facts/packs`:
 *   GET /all          — all approved facts as a single FactPack
 *   GET /:category    — approved facts filtered by category_l1
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { factsDb } from "../db/facts-db.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single fact entry in a pack (client-friendly camelCase shape). */
interface FactPackEntry {
  id: string;
  question: string;
  answer: string;
  distractors: string[];
  gaiaComment: string;
  explanation: string;
  category: string;
  wowFactor: number;
}

/** Full fact pack payload returned to the client. */
interface FactPack {
  packId: string;
  category: string;
  version: number;
  factCount: number;
  facts: FactPackEntry[];
}

/** Raw row shape returned from the facts table. */
interface FactPackRow {
  id: string;
  quiz_question: string;
  correct_answer: string;
  distractors: string | null;
  gaia_comment: string | null;
  gaia_comments: string | null;
  explanation: string;
  category_l1: string;
  novelty_score: number;
  db_version: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a raw database row to the client-facing FactPackEntry shape.
 *
 * @param row - A row from the facts table.
 * @returns A typed FactPackEntry ready for JSON serialisation.
 */
function rowToEntry(row: FactPackRow): FactPackEntry {
  let distractors: string[] = [];
  try {
    if (row.distractors) {
      const parsed: unknown = JSON.parse(row.distractors);
      if (Array.isArray(parsed)) {
        distractors = parsed.map(String);
      }
    }
  } catch {
    // Malformed JSON — leave distractors empty
  }

  // Prefer multi-comment pool if available; fall back to single gaia_comment
  let gaiaComment = "";
  if (row.gaia_comments) {
    try {
      const pool: unknown = JSON.parse(row.gaia_comments);
      if (Array.isArray(pool) && pool.length > 0) {
        gaiaComment = String(pool[0]);
      }
    } catch {
      // Fall through to single comment
    }
  }
  if (!gaiaComment && row.gaia_comment) {
    gaiaComment = row.gaia_comment;
  }

  return {
    id: row.id,
    question: row.quiz_question,
    answer: row.correct_answer,
    distractors,
    gaiaComment,
    explanation: row.explanation,
    category: row.category_l1 ?? "",
    wowFactor: typeof row.novelty_score === "number" ? row.novelty_score : 5,
  };
}

/**
 * Returns the highest db_version across a set of rows, which is used as the
 * pack version so clients can detect when a newer pack is available.
 */
function maxVersion(rows: FactPackRow[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => r.db_version ?? 0), 1);
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register all fact-pack delivery routes on the Fastify instance.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function factPackRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── GET /all — full pack (public) ─────────────────────────────────────────
  fastify.get(
    "/all",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = factsDb
        .prepare(
          `SELECT
            id, quiz_question, correct_answer, distractors,
            gaia_comment, gaia_comments, explanation, category_l1,
            novelty_score, db_version
           FROM facts
           WHERE status = 'approved'
           ORDER BY category_l1 ASC, id ASC`
        )
        .all() as FactPackRow[];

      const facts = rows.map(rowToEntry);
      const pack: FactPack = {
        packId: "all-v1",
        category: "all",
        version: maxVersion(rows),
        factCount: facts.length,
        facts,
      };

      // Cache-Control: allow clients to cache for 6 hours
      reply.header("Cache-Control", "public, max-age=21600");
      return reply.send(pack);
    }
  );

  // ── GET /:category — category-filtered pack (public) ──────────────────────
  fastify.get(
    "/:category",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { category } = request.params as { category: string };

      // Validate: only allow non-empty alphanumeric/space/hyphen category names
      if (!category || !/^[\w\s\-&]+$/.test(category)) {
        return reply
          .status(400)
          .send({ error: "Invalid category name", statusCode: 400 });
      }

      const rows = factsDb
        .prepare(
          `SELECT
            id, quiz_question, correct_answer, distractors,
            gaia_comment, gaia_comments, explanation, category_l1,
            novelty_score, db_version
           FROM facts
           WHERE status = 'approved' AND category_l1 = ?
           ORDER BY id ASC`
        )
        .all(category) as FactPackRow[];

      const facts = rows.map(rowToEntry);
      const packId = `${category.toLowerCase().replace(/\s+/g, "-")}-v1`;

      const pack: FactPack = {
        packId,
        category,
        version: maxVersion(rows),
        factCount: facts.length,
        facts,
      };

      reply.header("Cache-Control", "public, max-age=21600");
      return reply.send(pack);
    }
  );
}
