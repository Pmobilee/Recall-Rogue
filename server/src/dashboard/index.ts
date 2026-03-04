/**
 * Terra Gacha Fact Dashboard — standalone Fastify server on port 3002.
 * Local admin tool for reviewing, approving, and managing fact content.
 * No authentication required (local-only tool).
 */

import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import * as path from "path";
import * as fs from "fs";
import * as url from "url";
import { factsDb } from "../db/facts-db.js";
import { initFactsSchema } from "../db/facts-migrate.js";
import { generateSpriteVariants } from "../services/comfyui.js";
import sharp from "sharp";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DASHBOARD_PORT = 3002;
const PUBLIC_DIR = path.resolve(__dirname, "public");
const SPRITES_OUTPUT_DIR = path.resolve(
  __dirname,
  "../../../../public/fact-sprites"
);

// ── Row types ────────────────────────────────────────────────────────────────

interface FactRow {
  id: string;
  status: string;
  statement: string;
  category_l1: string;
  category_l2: string;
  fun_score: number;
  difficulty: number;
  distractor_count: number;
  pixel_art_status: string;
  image_prompt: string | null;
  in_game_reports: number;
  db_version: number;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

interface CountRow {
  count: number;
}

interface DistractorRow {
  id: number;
  fact_id: string;
  text: string;
  difficulty_tier: string;
  distractor_confidence: number;
  is_approved: number;
}

interface GapRow {
  category_l1: string;
  fact_count: number;
}

interface MetricsRow {
  category_l1: string;
  avg_fun_score: number;
  avg_difficulty: number;
  fact_count: number;
}

interface QueueStatusRow {
  status: string;
  count: number;
}

interface ReportRow {
  id: number;
  player_id: string | null;
  report_text: string;
  created_at: number;
}

// ── Dashboard application ────────────────────────────────────────────────────

/**
 * Build and start the dashboard Fastify server.
 * Serves static files and provides direct database API routes.
 */
async function startDashboard(): Promise<void> {
  initFactsSchema();

  const fastify = Fastify({
    logger: { level: "info" },
  });

  // Serve static files from the public directory
  await fastify.register(staticPlugin, {
    root: PUBLIC_DIR,
    prefix: "/",
  });

  // ── Dashboard API Routes ─────────────────────────────────────────────────────

  // GET /dashboard/api/facts — paginated fact list with optional status filter
  fastify.get("/dashboard/api/facts", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const rawStatus = query["status"] ?? "";
    const limit = Math.min(parseInt(query["limit"] ?? "50", 10), 200);
    const offset = parseInt(query["offset"] ?? "0", 10);

    // Whitelist status to prevent injection
    const status: string | undefined =
      rawStatus === "draft" ||
      rawStatus === "approved" ||
      rawStatus === "archived"
        ? rawStatus
        : undefined;

    let sql = "SELECT * FROM facts WHERE 1=1";
    const params: (string | number)[] = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const facts = factsDb.prepare(sql).all(...params) as FactRow[];

    const countSql =
      "SELECT COUNT(*) as count FROM facts WHERE 1=1" +
      (status ? " AND status = ?" : "");
    const countParams = status ? [status] : [];
    const { count } = factsDb.prepare(countSql).get(...countParams) as CountRow;

    reply.send({ facts, total: count, limit, offset });
  });

  // GET /dashboard/api/facts/:id — single fact detail with distractors and reports
  fastify.get("/dashboard/api/facts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const fact = factsDb
      .prepare("SELECT * FROM facts WHERE id = ?")
      .get(id) as FactRow | undefined;

    if (!fact) {
      return reply.status(404).send({ error: "Fact not found" });
    }

    const distractors = factsDb
      .prepare(
        "SELECT * FROM distractors WHERE fact_id = ? ORDER BY difficulty_tier, distractor_confidence DESC"
      )
      .all(id) as DistractorRow[];

    const reports = factsDb
      .prepare(
        "SELECT * FROM fact_reports WHERE fact_id = ? ORDER BY created_at DESC"
      )
      .all(id) as ReportRow[];

    reply.send({ fact, distractors, reports });
  });

  // POST /dashboard/api/facts/:id/approve — set status=approved
  fastify.post("/dashboard/api/facts/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };

    const fact = factsDb
      .prepare("SELECT id FROM facts WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!fact) {
      return reply.status(404).send({ error: "Fact not found" });
    }

    factsDb
      .prepare("UPDATE facts SET status = 'approved', updated_at = ? WHERE id = ?")
      .run(Date.now(), id);

    reply.send({ success: true, id, status: "approved" });
  });

  // POST /dashboard/api/facts/:id/archive — set status=archived
  fastify.post("/dashboard/api/facts/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };

    const fact = factsDb
      .prepare("SELECT id FROM facts WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!fact) {
      return reply.status(404).send({ error: "Fact not found" });
    }

    factsDb
      .prepare("UPDATE facts SET status = 'archived', updated_at = ? WHERE id = ?")
      .run(Date.now(), id);

    reply.send({ success: true, id, status: "archived" });
  });

  // GET /dashboard/api/gap-analysis — categories under 20 approved facts
  fastify.get("/dashboard/api/gap-analysis", async (_request, reply) => {
    const gaps = factsDb
      .prepare(
        `SELECT category_l1, COUNT(*) as fact_count
         FROM facts
         WHERE status = 'approved'
         GROUP BY category_l1
         ORDER BY fact_count ASC`
      )
      .all() as GapRow[];

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

    const allGaps = [...missingCategories, ...gaps].sort(
      (a, b) => a.fact_count - b.fact_count
    );

    reply.send({ gaps: allGaps });
  });

  // GET /dashboard/api/distractor-review — low-confidence distractors
  fastify.get("/dashboard/api/distractor-review", async (_request, reply) => {
    const distractors = factsDb
      .prepare(
        `SELECT d.*, f.statement as fact_statement
         FROM distractors d
         JOIN facts f ON f.id = d.fact_id
         WHERE d.distractor_confidence < 0.9
         ORDER BY d.distractor_confidence ASC
         LIMIT 100`
      )
      .all() as Array<DistractorRow & { fact_statement: string }>;

    reply.send({ distractors });
  });

  // GET /dashboard/api/quality-metrics — avg fun_score per category
  fastify.get("/dashboard/api/quality-metrics", async (_request, reply) => {
    const metrics = factsDb
      .prepare(
        `SELECT
          category_l1,
          ROUND(AVG(fun_score), 2) as avg_fun_score,
          ROUND(AVG(difficulty), 2) as avg_difficulty,
          COUNT(*) as fact_count
         FROM facts
         WHERE status = 'approved'
         GROUP BY category_l1
         ORDER BY avg_fun_score DESC`
      )
      .all() as MetricsRow[];

    const totals = factsDb
      .prepare(
        `SELECT
          COUNT(*) as total_facts,
          COUNT(CASE WHEN status='draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status='approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN status='archived' THEN 1 END) as archived_count,
          ROUND(AVG(CASE WHEN status='approved' THEN fun_score END), 2) as overall_avg_fun,
          ROUND(AVG(CASE WHEN status='approved' THEN novelty_score END), 2) as overall_avg_novelty
         FROM facts`
      )
      .get() as Record<string, number>;

    reply.send({ byCategory: metrics, totals });
  });

  // GET /dashboard/api/sprites/pending — approved facts without pixel art
  fastify.get("/dashboard/api/sprites/pending", async (_request, reply) => {
    const facts = factsDb
      .prepare(
        `SELECT id, statement, image_prompt, category_l1
         FROM facts
         WHERE status = 'approved'
           AND pixel_art_status = 'none'
           AND type NOT IN ('vocabulary', 'grammar', 'phrase')
           AND image_prompt IS NOT NULL AND image_prompt != ''
         LIMIT 50`
      )
      .all() as Array<{ id: string; statement: string; image_prompt: string; category_l1: string }>;

    reply.send({ facts });
  });

  // POST /dashboard/api/sprites/:factId/generate — generate 3 variants
  fastify.post("/dashboard/api/sprites/:factId/generate", async (request, reply) => {
    const { factId } = request.params as { factId: string };

    const fact = factsDb
      .prepare("SELECT id, image_prompt FROM facts WHERE id = ?")
      .get(factId) as { id: string; image_prompt: string | null } | undefined;

    if (!fact || !fact.image_prompt) {
      return reply.status(404).send({ error: "Fact not found or missing image_prompt" });
    }

    // Update status to in-progress
    factsDb
      .prepare("UPDATE facts SET pixel_art_status = 'generating', updated_at = ? WHERE id = ?")
      .run(Date.now(), factId);

    // Generate in background (non-blocking for the HTTP response)
    const outputDir = path.join(SPRITES_OUTPUT_DIR, factId);
    fs.mkdirSync(outputDir, { recursive: true });

    generateSpriteVariants(fact.image_prompt, 3)
      .then(async (tempPaths) => {
        for (let i = 0; i < tempPaths.length; i++) {
          const tempPath = tempPaths[i];
          const destPath256 = path.join(outputDir, `variant-${i}-256.png`);
          const destPath32 = path.join(outputDir, `variant-${i}-32.png`);

          // Resize to 256px and 32px
          await sharp(tempPath).resize(256, 256).png().toFile(destPath256);
          await sharp(tempPath).resize(32, 32).png().toFile(destPath32);

          // Clean up temp file
          fs.unlinkSync(tempPath);
        }

        factsDb
          .prepare(
            "UPDATE facts SET pixel_art_status = 'review', updated_at = ? WHERE id = ?"
          )
          .run(Date.now(), factId);

        console.log(`[dashboard] Generated 3 sprite variants for fact ${factId}`);
      })
      .catch((err: unknown) => {
        console.error(`[dashboard] Sprite generation failed for fact ${factId}:`, err);
        factsDb
          .prepare(
            "UPDATE facts SET pixel_art_status = 'failed', updated_at = ? WHERE id = ?"
          )
          .run(Date.now(), factId);
      });

    reply.send({ success: true, message: "Sprite generation started" });
  });

  // POST /dashboard/api/sprites/:factId/approve/:variantIndex — approve a variant
  fastify.post(
    "/dashboard/api/sprites/:factId/approve/:variantIndex",
    async (request, reply) => {
      const { factId, variantIndex } = request.params as {
        factId: string;
        variantIndex: string;
      };

      const idx = parseInt(variantIndex, 10);
      if (isNaN(idx) || idx < 0 || idx > 9) {
        return reply.status(400).send({ error: "Invalid variantIndex" });
      }

      const fact = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(factId) as { id: string } | undefined;

      if (!fact) {
        return reply.status(404).send({ error: "Fact not found" });
      }

      const spriteDir = path.join(SPRITES_OUTPUT_DIR, factId);
      const variant256 = path.join(spriteDir, `variant-${idx}-256.png`);
      const approved256 = path.join(spriteDir, "approved-256.png");
      const approved32 = path.join(spriteDir, "approved-32.png");

      if (!fs.existsSync(variant256)) {
        return reply.status(404).send({ error: "Variant not found" });
      }

      // Copy chosen variant to approved paths
      fs.copyFileSync(variant256, approved256);
      const variant32 = path.join(spriteDir, `variant-${idx}-32.png`);
      if (fs.existsSync(variant32)) {
        fs.copyFileSync(variant32, approved32);
      }

      const imageUrl = `/fact-sprites/${factId}/approved-256.png`;

      factsDb
        .prepare(
          `UPDATE facts
           SET pixel_art_status = 'approved',
               has_pixel_art = 1,
               image_url = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .run(imageUrl, Date.now(), factId);

      reply.send({ success: true, imageUrl });
    }
  );

  // GET /dashboard/api/pipeline/status — queue stats
  fastify.get("/dashboard/api/pipeline/status", async (_request, reply) => {
    const statusCounts = factsDb
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM facts_processing_queue
         GROUP BY status`
      )
      .all() as QueueStatusRow[];

    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
    };

    for (const row of statusCounts) {
      counts[row.status] = row.count;
    }

    const recentErrors = factsDb
      .prepare(
        `SELECT q.fact_id, q.last_error, q.attempts, q.enqueued_at, f.statement
         FROM facts_processing_queue q
         LEFT JOIN facts f ON f.id = q.fact_id
         WHERE q.status = 'failed'
         ORDER BY q.enqueued_at DESC
         LIMIT 10`
      )
      .all();

    reply.send({ counts, recentErrors });
  });

  // ── Phase 32.7: Coverage dashboard page ──────────────────────────────────────
  fastify.get("/coverage", (_request, reply) => {
    const coveragePath = path.join(PUBLIC_DIR, "coverage.html");
    if (!fs.existsSync(coveragePath)) {
      return reply.status(404).send("Coverage dashboard not found");
    }
    return reply.type("text/html").send(fs.readFileSync(coveragePath, "utf8"));
  });

  // ── Start server ─────────────────────────────────────────────────────────────
  try {
    await fastify.listen({ port: DASHBOARD_PORT, host: "127.0.0.1" });
    console.log(
      `[dashboard] Terra Gacha Dashboard running at http://127.0.0.1:${DASHBOARD_PORT}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startDashboard();
