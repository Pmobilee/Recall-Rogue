/**
 * CLI: expand distractors for approved facts with thin coverage.
 * Usage: npx tsx server/src/scripts/expand-distractors.ts --limit 50
 */
import { parseArgs } from "node:util";
import { initFactsSchema } from "../db/facts-migrate.js";
import { expandDistractorsBatch } from "../services/distractorExpander.js";

const { values } = parseArgs({
  options: { limit: { type: "string", default: "100" } },
  allowPositionals: false,
});

initFactsSchema();
const total = await expandDistractorsBatch(parseInt(values.limit as string, 10));
console.log(`[expand-distractors] Added ${total} new distractors.`);
