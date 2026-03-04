/**
 * CLI script: generate a batch of new facts from a seed topic.
 *
 * Usage:
 *   npx tsx server/src/scripts/generate-batch.ts \
 *     --topic "deep ocean geology" \
 *     --category "Natural Sciences" \
 *     --count 50 \
 *     --source "Wikipedia: Deep sea"
 *
 * The script:
 *   1. Calls Claude to generate `count` distinct statements on `topic`.
 *   2. De-duplicates against existing approved facts.
 *   3. Enqueues survivors into facts_processing_queue.
 *   4. Runs processBatch() to generate full content for each enqueued fact.
 */
import { parseArgs } from "node:util";
import { initFactsSchema } from "../db/facts-migrate.js";
import { generateStatements, enqueueStatements } from "../services/batchGenerator.js";
import { processBatch } from "../workers/pipelineWorker.js";

async function main() {
  const { values } = parseArgs({
    options: {
      topic:    { type: "string" },
      category: { type: "string", default: "Natural Sciences" },
      count:    { type: "string", default: "50" },
      source:   { type: "string", default: "LLM generated" },
    },
    allowPositionals: false,
  });

  if (!values.topic) {
    console.error("Error: --topic is required");
    process.exit(1);
  }

  initFactsSchema();

  const count = Math.min(parseInt(values.count as string, 10), 100);
  console.log(`[batch] Generating ${count} statements for topic: "${values.topic}"`);

  const statements = await generateStatements(
    values.topic as string,
    values.category as string,
    count
  );
  console.log(`[batch] ${statements.length} unique statements after de-duplication`);

  const enqueued = enqueueStatements(
    statements,
    values.source as string,
    values.topic as string
  );
  console.log(`[batch] ${enqueued} facts enqueued for content generation`);

  const processed = await processBatch();
  console.log(`[batch] ${processed} facts fully generated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
