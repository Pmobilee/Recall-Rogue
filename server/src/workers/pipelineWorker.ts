/**
 * Recall Rogue Content Pipeline Worker.
 * CLI-invokable queue worker that processes pending entries in the
 * facts_processing_queue table using Claude Sonnet for content generation.
 *
 * Run: npm run pipeline
 * Rate-limited to 100ms between API calls to stay within rate limits.
 */

import { factsDb } from "../db/facts-db.js";
import { initFactsSchema } from "../db/facts-migrate.js";
import { generateFactContent, persistGeneratedContent } from "../services/contentGen.js";
import { runQualityGate } from "../services/qualityGate.js";
import { config } from "../config.js";

const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 100;
const MAX_ATTEMPTS = 3;

/** A processing queue entry. */
interface QueueEntry {
  id: number;
  fact_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
}

/** A fact row needed for generation. */
interface FactRow {
  id: string;
  statement: string;
  category_l1: string;
  category_l2: string;
}

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a batch of pending queue entries.
 * Marks entries as 'processing' before starting, then 'done' or 'failed'
 * after each attempt. Stores raw LLM responses for debugging.
 * Phase 32.3: runs the 3-stage quality gate after content generation.
 *
 * @returns Number of entries successfully processed.
 */
export async function processBatch(): Promise<number> {
  // Claim up to BATCH_SIZE pending entries
  const entries = factsDb
    .prepare(
      `SELECT id, fact_id, status, attempts, last_error
       FROM facts_processing_queue
       WHERE status = 'pending' AND attempts < ?
       ORDER BY enqueued_at ASC
       LIMIT ?`
    )
    .all(MAX_ATTEMPTS, BATCH_SIZE) as QueueEntry[];

  if (entries.length === 0) {
    return 0;
  }

  console.log(`[pipeline] Processing ${entries.length} queue entries...`);
  let successCount = 0;

  for (const entry of entries) {
    // Mark as processing and increment attempts
    factsDb
      .prepare(
        `UPDATE facts_processing_queue
         SET status = 'processing', attempts = attempts + 1
         WHERE id = ?`
      )
      .run(entry.id);

    // Fetch the fact
    const fact = factsDb
      .prepare(
        `SELECT id, statement, category_l1, category_l2
         FROM facts WHERE id = ?`
      )
      .get(entry.fact_id) as FactRow | undefined;

    if (!fact) {
      factsDb
        .prepare(
          `UPDATE facts_processing_queue
           SET status = 'failed', last_error = ?, processed_at = unixepoch()
           WHERE id = ?`
        )
        .run("Fact not found in database", entry.id);
      continue;
    }

    try {
      console.log(
        `[pipeline]   Generating content for fact ${fact.id}: "${fact.statement.slice(0, 60)}..."`
      );

      const content = await generateFactContent(
        fact.statement,
        fact.category_l1,
        fact.category_l2
      );

      // Persist the generated content
      persistGeneratedContent(fact.id, content);

      // Pass 3: quality gate (auto-approves on full pass)
      try {
        await runQualityGate(fact.id);
      } catch (err) {
        console.warn(`[pipeline] Quality gate skipped for ${fact.id}:`, err);
      }

      // Mark queue entry done, store a summary as the raw_llm_response
      const summary = JSON.stringify({
        distractorCount: content.distractors.length,
        difficulty: content.difficulty,
        funScore: content.funScore,
        noveltyScore: content.noveltyScore,
        processedAt: new Date().toISOString(),
      });

      factsDb
        .prepare(
          `UPDATE facts_processing_queue
           SET status = 'done',
               processed_at = unixepoch(),
               raw_llm_response = ?
           WHERE id = ?`
        )
        .run(summary, entry.id);

      successCount++;
      console.log(`[pipeline]   Done: ${fact.id}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.error(`[pipeline]   Failed: ${fact.id} — ${errorMsg}`);

      const newAttempts = entry.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

      factsDb
        .prepare(
          `UPDATE facts_processing_queue
           SET status = ?,
               last_error = ?,
               processed_at = unixepoch()
           WHERE id = ?`
        )
        .run(newStatus, errorMsg, entry.id);
    }

    // Rate limit between requests
    await sleep(RATE_LIMIT_MS);
  }

  return successCount;
}

/**
 * Print a summary of the current queue state.
 */
function printQueueSummary(): void {
  const rows = factsDb
    .prepare(
      `SELECT status, COUNT(*) as count
       FROM facts_processing_queue
       GROUP BY status`
    )
    .all() as Array<{ status: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }

  console.log("[pipeline] Queue summary:");
  console.log(`  Pending:    ${counts["pending"] ?? 0}`);
  console.log(`  Processing: ${counts["processing"] ?? 0}`);
  console.log(`  Done:       ${counts["done"] ?? 0}`);
  console.log(`  Failed:     ${counts["failed"] ?? 0}`);
}

/**
 * Main entry point for the pipeline worker.
 */
async function main(): Promise<void> {
  console.log("[pipeline] Recall Rogue Content Pipeline Worker starting...");

  initFactsSchema();

  if (!config.anthropicApiKey) {
    console.error(
      "[pipeline] ANTHROPIC_API_KEY is not configured. Set it in .env to use the pipeline."
    );
    process.exit(1);
  }

  printQueueSummary();

  const processed = await processBatch();

  console.log(`[pipeline] Processed ${processed} facts successfully.`);
  printQueueSummary();
}

main().catch((err) => {
  console.error("[pipeline] Fatal error:", err);
  process.exit(1);
});
