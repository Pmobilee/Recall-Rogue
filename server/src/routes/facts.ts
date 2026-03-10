/**
 * Fact content engine routes for the Recall Rogue server.
 * Provides admin endpoints for fact management and public endpoints
 * for game clients (delta sync, player reports).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { factsDb } from "../db/facts-db.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { checkDuplicate } from "../services/deduplication.js";
import { categorizeFact } from "../services/categorization.js";
import {
  generateFactContent,
  extractFactsFromPassage,
  persistGeneratedContent,
} from "../services/contentGen.js";
import { runQualityGate } from "../services/qualityGate.js";

// ── Allowed field whitelist for PATCH ────────────────────────────────────────

const PATCHABLE_FIELDS = new Set([
  "statement",
  "wow_factor",
  "explanation",
  "quiz_question",
  "correct_answer",
  "category_l1",
  "category_l2",
  "category_l3",
  "rarity",
  "difficulty",
  "fun_score",
  "novelty_score",
  "age_rating",
  "sensitivity_level",
  "sensitivity_note",
  "content_volatility",
  "source_name",
  "source_url",
  "mnemonic",
  "image_prompt",
  "visual_description",
  "status",
  "type",
  // Phase 32.1: new patchable fields
  "difficulty_tier",
  "source_quality",
  "source_doi",
  "quality_gate_status",
  "bundle_tag",
  "seed_topic",
]);

// ── Row types ────────────────────────────────────────────────────────────────

interface FactRow {
  id: string;
  status: string;
  statement: string;
  category_l1: string;
  category_l2: string;
  db_version: number;
  updated_at: number;
  [key: string]: unknown;
}

interface CountRow {
  count: number;
}

interface DistractorRow {
  id: number;
  text: string;
  difficulty_tier: string;
  distractor_confidence: number;
  is_approved: number;
}

interface ReportRow {
  id: number;
  player_id: string | null;
  report_text: string;
  created_at: number;
}

interface GapRow {
  category_l1: string;
  fact_count: number;
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register all fact content engine routes on the Fastify instance.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function factsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /ingest — batch ingest facts (admin) ────────────────────────────────
  fastify.post(
    "/ingest",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null
        | undefined;

      let facts: Record<string, unknown>[];
      if (Array.isArray(body)) {
        facts = body;
      } else if (body && Array.isArray(body.facts)) {
        facts = body.facts as Record<string, unknown>[];
      } else if (body && typeof body.statement === "string") {
        facts = [body as Record<string, unknown>];
      } else {
        return reply.status(400).send({
          error:
            "Expected a fact object, array of facts, or {facts: [...]}",
          statusCode: 400,
        });
      }

      const skipDuplicateCheck = Boolean(
        !Array.isArray(body) && (body as Record<string, unknown>)?.skipDuplicateCheck
          ? (body as Record<string, unknown>).skipDuplicateCheck
          : false
      );

      const results: Array<{
        index: number;
        id?: string;
        status: "inserted" | "duplicate" | "error";
        similarFactId?: string;
        error?: string;
      }> = [];

      const now = Date.now();

      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i] as Record<string, unknown>;

        try {
          const statement = fact.statement as string | undefined;

          if (!statement) {
            results.push({
              index: i,
              status: "error",
              error: "Missing required field: statement",
            });
            continue;
          }

          const category_l1 =
            (fact.category_l1 as string | undefined) ??
            (fact.categoryL1 as string | undefined) ??
            "";
          const explanation = (fact.explanation as string | undefined) ?? "";
          const quiz_question =
            (fact.quiz_question as string | undefined) ?? "";
          const correct_answer =
            (fact.correct_answer as string | undefined) ?? "";

          // Duplicate check
          if (!skipDuplicateCheck) {
            const dupResult = await checkDuplicate(statement, category_l1);
            if (dupResult.isDuplicate && dupResult.similarFactId) {
              results.push({
                index: i,
                status: "duplicate",
                similarFactId: dupResult.similarFactId,
              });
              continue;
            }
          }

          const id = crypto.randomUUID();

          factsDb
            .prepare(
              `INSERT INTO facts (
                id, type, status, statement, explanation, quiz_question,
                correct_answer, category_l1, source_name, source_url,
                created_at, updated_at
              ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              id,
              (fact.type as string | undefined) ?? "fact",
              statement,
              explanation,
              quiz_question,
              correct_answer,
              category_l1,
              (fact.source_name as string | undefined) ?? null,
              (fact.source_url as string | undefined) ?? null,
              now,
              now
            );

          results.push({ index: i, id, status: "inserted" });
        } catch (err) {
          results.push({
            index: i,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const inserted = results.filter((r) => r.status === "inserted").length;
      const duplicates = results.filter(
        (r) => r.status === "duplicate"
      ).length;
      const errors = results.filter((r) => r.status === "error").length;

      return reply.status(207).send({ inserted, duplicates, errors, results: results });
    }
  );

  // ── GET / — browse facts (admin) ─────────────────────────────────────────────
  fastify.get(
    "/",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const qs = request.query as Record<string, string>;
      const category_l1 = qs["category_l1"];
      const type = qs["type"];
      const limit = Math.min(parseInt(qs["limit"] ?? "50", 10), 200);
      const offset = parseInt(qs["offset"] ?? "0", 10);

      // Whitelist status values to prevent SQL injection
      const rawStatus = qs["status"] ?? "";
      const statusFilter: string | undefined =
        rawStatus === "draft" ||
        rawStatus === "approved" ||
        rawStatus === "archived"
          ? rawStatus
          : undefined;

      let query = "SELECT * FROM facts WHERE 1=1";
      const params: (string | number)[] = [];

      if (statusFilter) {
        query += " AND status = ?";
        params.push(statusFilter);
      }
      if (category_l1) {
        query += " AND category_l1 = ?";
        params.push(category_l1);
      }
      if (type) {
        query += " AND type = ?";
        params.push(type);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const facts = factsDb.prepare(query).all(...params) as FactRow[];

      const countQuery =
        "SELECT COUNT(*) as count FROM facts WHERE 1=1" +
        (statusFilter ? " AND status = ?" : "") +
        (category_l1 ? " AND category_l1 = ?" : "") +
        (type ? " AND type = ?" : "");

      const countParams = params.slice(0, params.length - 2);
      const { count } = factsDb
        .prepare(countQuery)
        .get(...countParams) as CountRow;

      return reply.send({ facts, total: count, limit, offset });
    }
  );

  // ── GET /:id — single fact detail (admin) ────────────────────────────────────
  fastify.get(
    "/:id",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const fact = factsDb
        .prepare("SELECT * FROM facts WHERE id = ?")
        .get(id) as FactRow | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      const distractors = factsDb
        .prepare(
          "SELECT * FROM distractors WHERE fact_id = ? ORDER BY difficulty_tier, distractor_confidence DESC"
        )
        .all(id) as DistractorRow[];

      const reports = factsDb
        .prepare(
          "SELECT * FROM fact_reports WHERE fact_id = ? ORDER BY created_at DESC LIMIT 20"
        )
        .all(id) as ReportRow[];

      return reply.send({ fact, distractors, reports });
    }
  );

  // ── PATCH /:id — partial update (admin) ──────────────────────────────────────
  fastify.patch(
    "/:id",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as Record<string, unknown>) ?? {};

      // Whitelist fields
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (PATCHABLE_FIELDS.has(key)) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply
          .status(400)
          .send({ error: "No valid fields to update", statusCode: 400 });
      }

      const fact = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(id) as { id: string } | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      updates["updated_at"] = Date.now();

      const setClause = Object.keys(updates)
        .map((k) => `${k} = ?`)
        .join(", ");
      const values = [...Object.values(updates), id];

      factsDb
        .prepare(`UPDATE facts SET ${setClause} WHERE id = ?`)
        .run(...values);

      const updated = factsDb
        .prepare("SELECT * FROM facts WHERE id = ?")
        .get(id) as FactRow;

      return reply.send({ fact: updated });
    }
  );

  // ── DELETE /:id — archive (soft delete) (admin) ──────────────────────────────
  fastify.delete(
    "/:id",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const fact = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(id) as { id: string } | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      factsDb
        .prepare(
          "UPDATE facts SET status = 'archived', updated_at = ? WHERE id = ?"
        )
        .run(Date.now(), id);

      return reply.status(204).send();
    }
  );

  // ── POST /:id/report — player fact report (public) ───────────────────────────
  fastify.post(
    "/:id/report",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const playerId = body?.playerId as string | undefined;
      const reportText = body?.reportText as string | undefined;

      if (
        !reportText ||
        typeof reportText !== "string" ||
        reportText.trim().length === 0
      ) {
        return reply
          .status(400)
          .send({ error: "reportText is required", statusCode: 400 });
      }

      const fact = factsDb
        .prepare(
          "SELECT id, in_game_reports FROM facts WHERE id = ? AND status = 'approved'"
        )
        .get(id) as { id: string; in_game_reports: number } | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      // Sanitize inputs
      const safeReportText = reportText.trim().slice(0, 2000);
      const safePlayerId =
        playerId ? (playerId as string).trim().slice(0, 128) : null;

      factsDb
        .prepare(
          `INSERT INTO fact_reports (fact_id, player_id, report_text, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(id, safePlayerId, safeReportText, Date.now());

      // Increment report count on fact
      const newCount = fact.in_game_reports + 1;
      factsDb
        .prepare(
          "UPDATE facts SET in_game_reports = ?, updated_at = ? WHERE id = ?"
        )
        .run(newCount, Date.now(), id);

      // Auto-flag if 3+ reports
      if (newCount >= 3) {
        const currentFact = factsDb
          .prepare("SELECT status FROM facts WHERE id = ?")
          .get(id) as { status: string };
        if (currentFact.status === "approved") {
          factsDb
            .prepare(
              "UPDATE facts SET status = 'draft', updated_at = ? WHERE id = ?"
            )
            .run(Date.now(), id);
          console.log(
            `[facts] Auto-flagged fact ${id} after ${newCount} player reports`
          );
        }
      }

      return reply.status(201).send({ success: true, reportCount: newCount });
    }
  );

  // ── POST /:id/categorize — LLM categorization (admin) ───────────────────────
  fastify.post(
    "/:id/categorize",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const fact = factsDb
        .prepare("SELECT id, statement, explanation FROM facts WHERE id = ?")
        .get(id) as
        | { id: string; statement: string; explanation: string }
        | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      const result = await categorizeFact(id, fact.statement, fact.explanation);

      factsDb
        .prepare(
          `UPDATE facts SET
            category_l1 = ?,
            category_l2 = ?,
            category_l3 = ?,
            tags = ?,
            related_facts = ?,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          result.categoryL1,
          result.categoryL2,
          result.categoryL3,
          JSON.stringify(result.tags),
          JSON.stringify(result.relatedFactIds),
          Date.now(),
          id
        );

      return reply.send({ categorization: result });
    }
  );

  // ── POST /:id/generate — full LLM content generation (admin) ────────────────
  fastify.post(
    "/:id/generate",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const fact = factsDb
        .prepare(
          "SELECT id, statement, category_l1, category_l2 FROM facts WHERE id = ?"
        )
        .get(id) as FactRow | undefined;

      if (!fact) {
        return reply
          .status(404)
          .send({ error: "Fact not found", statusCode: 404 });
      }

      // Add to processing queue
      factsDb
        .prepare(
          `INSERT INTO facts_processing_queue (fact_id, status, enqueued_at)
           VALUES (?, 'processing', unixepoch())`
        )
        .run(id);

      try {
        const content = await generateFactContent(
          fact.statement as string,
          fact.category_l1 as string,
          fact.category_l2 as string
        );

        persistGeneratedContent(id, content);

        // Mark queue entry done
        factsDb
          .prepare(
            `UPDATE facts_processing_queue
             SET status = 'done', processed_at = unixepoch()
             WHERE fact_id = ? AND status = 'processing'`
          )
          .run(id);

        const updated = factsDb
          .prepare("SELECT * FROM facts WHERE id = ?")
          .get(id) as FactRow;

        return reply.send({ fact: updated, generated: content });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        factsDb
          .prepare(
            `UPDATE facts_processing_queue
             SET status = 'failed', last_error = ?, processed_at = unixepoch()
             WHERE fact_id = ? AND status = 'processing'`
          )
          .run(errorMsg, id);

        return reply.status(500).send({ error: errorMsg, statusCode: 500 });
      }
    }
  );

  // ── POST /extract — extract facts from passage (admin) ───────────────────────
  fastify.post(
    "/extract",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const passage = body?.passage as string | undefined;
      const sourceName = body?.sourceName as string | undefined;
      const sourceUrl = body?.sourceUrl as string | undefined;

      if (
        !passage ||
        typeof passage !== "string" ||
        passage.trim().length === 0
      ) {
        return reply
          .status(400)
          .send({ error: "passage is required", statusCode: 400 });
      }
      if (!sourceName || typeof sourceName !== "string") {
        return reply
          .status(400)
          .send({ error: "sourceName is required", statusCode: 400 });
      }

      const facts = await extractFactsFromPassage(passage, sourceName, sourceUrl);

      return reply.send({ facts, count: facts.length });
    }
  );

  // ── GET /gap-analysis — categories under 20 approved facts (admin) ───────────
  fastify.get(
    "/gap-analysis",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const gaps = factsDb
        .prepare(
          `SELECT category_l1, COUNT(*) as fact_count
           FROM facts
           WHERE status = 'approved'
           GROUP BY category_l1
           HAVING fact_count < 20
           ORDER BY fact_count ASC`
        )
        .all() as GapRow[];

      // Also find categories with zero facts
      const allCategories = [
        "Natural Sciences",
        "Life Sciences",
        "History",
        "Geography",
        "Technology",
        "Culture",
        "Language",
      ];

      const foundCategories = new Set(gaps.map((g) => g.category_l1));

      const missingCategories = allCategories
        .filter((c) => !foundCategories.has(c))
        .map((c) => ({ category_l1: c, fact_count: 0 }));

      // Merge and sort by count ascending
      const allGaps = [...missingCategories, ...gaps].sort(
        (a, b) => a.fact_count - b.fact_count
      );

      return reply.send({ gaps: allGaps });
    }
  );

  // ── GET /delta — delta sync for game clients (public, Phase 32.5 hardened) ───
  fastify.get(
    "/delta",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const qs = request.query as Record<string, string>;
      const since = parseInt(qs["since"] ?? "0", 10);
      const limit = Math.min(parseInt(qs["limit"] ?? "500", 10), 1000);
      const category = qs["category"]; // optional filter

      let query = `SELECT
          id, statement, quiz_question, correct_answer, acceptable_answers,
          gaia_comments, gaia_wrong_comments, category_l1, category_l2,
          rarity, difficulty, difficulty_tier, fun_score, novelty_score,
          age_rating, sensitivity_level, has_pixel_art, image_url,
          pixel_art_path, language, db_version, status, updated_at
        FROM facts
        WHERE db_version > ? AND status IN ('approved', 'archived')`;
      const params: (string | number)[] = [since];

      if (category) {
        query += " AND category_l1 = ?";
        params.push(category);
      }

      query += " ORDER BY db_version ASC LIMIT ?";
      params.push(limit);

      const facts = factsDb.prepare(query).all(...params) as FactRow[];

      // IDs of archived facts (soft-deleted)
      const deletedIds = facts
        .filter((f) => f.status === "archived")
        .map((f) => f.id);

      // Active facts only (exclude archived from the facts payload)
      const activeFacts = facts
        .filter((f) => f.status === "approved")
        .map((row) => ({
          ...row,
          // Phase 34: derive pixelArtPath from has_pixel_art flag
          pixelArtPath: row.has_pixel_art === 1
            ? `/assets/sprites/facts/${row.id}.png`
            : null,
        }));

      // Latest db_version in this batch
      const maxVersion =
        facts.length > 0
          ? Math.max(...facts.map((f) => f.db_version as number))
          : since;

      // ETag for conditional requests
      const etag = `"delta-${maxVersion}"`;
      if (request.headers["if-none-match"] === etag) {
        return reply.status(304).send();
      }

      reply.header("ETag", etag);
      reply.header("Cache-Control", "private, max-age=300");

      return reply.send({
        facts: activeFacts,
        deletedIds,
        latestVersion: maxVersion,
        hasMore: facts.length === limit,
        nextCursor: facts.length === limit ? maxVersion : null,
      });
    }
  );

  // ── POST /:id/quality-gate — run 3rd-stage quality gate (admin, Phase 32.3) ──
  fastify.post(
    "/:id/quality-gate",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const fact = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(id) as { id: string } | undefined;
      if (!fact) {
        return reply.status(404).send({ error: "Fact not found", statusCode: 404 });
      }

      const result = await runQualityGate(id);
      return reply.send({ result });
    }
  );

  // ── POST /:id/expand-distractors — expand thin distractor sets (admin, Phase 32.4) ──
  fastify.post(
    "/:id/expand-distractors",
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const fact = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(id) as { id: string } | undefined;
      if (!fact) {
        return reply.status(404).send({ error: "Fact not found", statusCode: 404 });
      }

      const { expandDistractors } = await import("../services/distractorExpander.js");
      const added = await expandDistractors(id);
      return reply.send({ added });
    }
  );
}
