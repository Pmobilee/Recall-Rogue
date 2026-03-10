/**
 * Distractor Audit Script — Recall Rogue
 *
 * Reads all seed JSON files from src/data/seed/ and analyzes
 * distractor counts per fact. Outputs statistics and a queue
 * of facts needing distractor expansion.
 *
 * Usage:
 *   npx tsx scripts/distractor-audit.ts
 *
 * Output:
 *   scripts/distractor-expansion-queue.json
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT, "src", "data", "seed");
const OUTPUT_PATH = path.join(ROOT, "scripts", "distractor-expansion-queue.json");

interface SeedFact {
  id: string;
  statement: string;
  distractors?: string[];
  category?: string[];
  categoryL1?: string;
}

interface AuditResult {
  id: string;
  statement: string;
  category: string;
  distractorCount: number;
}

/** Recursively discover all .json files under a directory. */
function findJsonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(fullPath));
    } else if (entry.name.endsWith(".json")) {
      results.push(fullPath);
    }
  }
  return results;
}

function main(): void {
  const seedFiles = findJsonFiles(SEED_DIR);

  if (seedFiles.length === 0) {
    console.error(`[ERROR] No JSON seed files found in ${SEED_DIR}`);
    process.exit(1);
  }

  const allFacts: AuditResult[] = [];

  for (const filePath of seedFiles) {
    const raw = fs.readFileSync(filePath, "utf-8");
    let facts: SeedFact[];
    try {
      facts = JSON.parse(raw) as SeedFact[];
    } catch {
      console.warn(`[WARN] Could not parse ${path.relative(ROOT, filePath)}, skipping`);
      continue;
    }

    if (!Array.isArray(facts)) {
      console.warn(`[WARN] ${path.relative(ROOT, filePath)} is not an array, skipping`);
      continue;
    }

    for (const fact of facts) {
      const count = Array.isArray(fact.distractors) ? fact.distractors.length : 0;
      const category = Array.isArray(fact.category) && fact.category.length > 0
        ? fact.category[0]
        : fact.categoryL1 ?? "Unknown";

      allFacts.push({
        id: fact.id,
        statement: fact.statement,
        category,
        distractorCount: count,
      });
    }
  }

  // Compute statistics
  const below10 = allFacts.filter((f) => f.distractorCount < 10);
  const range10to24 = allFacts.filter((f) => f.distractorCount >= 10 && f.distractorCount < 25);
  const above25 = allFacts.filter((f) => f.distractorCount >= 25);

  const total = allFacts.length;
  const avgDistractors = total > 0
    ? (allFacts.reduce((sum, f) => sum + f.distractorCount, 0) / total).toFixed(1)
    : "0";

  // Category breakdown
  const byCategory = new Map<string, { total: number; sumDistractors: number; belowThreshold: number }>();
  for (const fact of allFacts) {
    const entry = byCategory.get(fact.category) ?? { total: 0, sumDistractors: 0, belowThreshold: 0 };
    entry.total++;
    entry.sumDistractors += fact.distractorCount;
    if (fact.distractorCount < 10) entry.belowThreshold++;
    byCategory.set(fact.category, entry);
  }

  // Print report
  console.log("=== Distractor Audit Report ===\n");
  console.log(`Total facts:       ${total}`);
  console.log(`Average distractors: ${avgDistractors}`);
  console.log(`Below 10:          ${below10.length} (${((below10.length / total) * 100).toFixed(1)}%)`);
  console.log(`10-24:             ${range10to24.length} (${((range10to24.length / total) * 100).toFixed(1)}%)`);
  console.log(`25+:               ${above25.length} (${((above25.length / total) * 100).toFixed(1)}%)`);
  console.log("");

  console.log("=== By Category ===\n");
  for (const [cat, stats] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const avg = (stats.sumDistractors / stats.total).toFixed(1);
    console.log(`  ${cat}: ${stats.total} facts, avg ${avg} distractors, ${stats.belowThreshold} below threshold`);
  }
  console.log("");

  // Write expansion queue (facts needing more distractors)
  const expansionQueue = below10
    .sort((a, b) => a.distractorCount - b.distractorCount)
    .map((f) => ({
      id: f.id,
      category: f.category,
      currentCount: f.distractorCount,
      statement: f.statement.slice(0, 100),
    }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(expansionQueue, null, 2));
  console.log(`Expansion queue written: ${path.relative(ROOT, OUTPUT_PATH)} (${expansionQueue.length} facts)`);
}

main();
