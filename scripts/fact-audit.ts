/**
 * Fact Audit Report Script — Recall Rogue
 *
 * Reads all seed JSON files from src/data/seed/ and generates
 * a comprehensive audit report on fact quality and coverage.
 *
 * Usage:
 *   npx tsx scripts/fact-audit.ts
 *
 * Output:
 *   scripts/fact-audit-report.json
 *   scripts/fact-audit-report.md
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT, "src", "data", "seed");
const OUTPUT_JSON = path.join(ROOT, "scripts", "fact-audit-report.json");
const OUTPUT_MD = path.join(ROOT, "scripts", "fact-audit-report.md");

interface SeedFact {
  id: string;
  type?: string;
  statement: string;
  explanation?: string;
  distractors?: string[];
  category?: string[];
  categoryL1?: string;
  sourceName?: string;
  sourceUrl?: string;
  ageRating?: string;
  rarity?: string;
  difficulty?: number;
  funScore?: number;
  noveltyScore?: number;
  gaiaComment?: string;
  gaiaComments?: unknown[];
  gaiaWrongComments?: unknown;
  mnemonic?: string;
  wowFactor?: string;
  language?: string;
}

interface CategoryStats {
  total: number;
  withSource: number;
  withGaiaComment: number;
  withMnemonic: number;
  withWowFactor: number;
  avgDistractors: number;
  minDistractors: number;
  maxDistractors: number;
  byAgeRating: Record<string, number>;
  byRarity: Record<string, number>;
  avgDifficulty: number;
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

  const allFacts: SeedFact[] = [];

  for (const filePath of seedFiles) {
    const raw = fs.readFileSync(filePath, "utf-8");
    let facts: SeedFact[];
    try {
      facts = JSON.parse(raw) as SeedFact[];
    } catch {
      console.warn(`[WARN] Could not parse ${path.relative(ROOT, filePath)}, skipping`);
      continue;
    }

    if (!Array.isArray(facts)) continue;
    allFacts.push(...facts);
  }

  const total = allFacts.length;

  // Global statistics
  const withSource = allFacts.filter((f) => f.sourceName || f.sourceUrl).length;
  const withGaiaComment = allFacts.filter(
    (f) =>
      f.gaiaComment ||
      (Array.isArray(f.gaiaComments) && f.gaiaComments.length > 0)
  ).length;
  const withGaiaWrong = allFacts.filter((f) => f.gaiaWrongComments != null).length;
  const withMnemonic = allFacts.filter((f) => f.mnemonic).length;
  const withWowFactor = allFacts.filter((f) => f.wowFactor).length;
  const withExplanation = allFacts.filter((f) => f.explanation && f.explanation.length > 0).length;

  // Distractor statistics
  const distractorCounts = allFacts.map((f) =>
    Array.isArray(f.distractors) ? f.distractors.length : 0
  );
  const avgDistractors = total > 0
    ? distractorCounts.reduce((a, b) => a + b, 0) / total
    : 0;
  const minDistractors = total > 0 ? Math.min(...distractorCounts) : 0;
  const maxDistractors = total > 0 ? Math.max(...distractorCounts) : 0;

  // Per-category breakdown
  const categoryMap = new Map<string, SeedFact[]>();
  for (const fact of allFacts) {
    const cat =
      Array.isArray(fact.category) && fact.category.length > 0
        ? fact.category[0]
        : fact.categoryL1 ?? "Unknown";
    const list = categoryMap.get(cat) ?? [];
    list.push(fact);
    categoryMap.set(cat, list);
  }

  const categoryStats: Record<string, CategoryStats> = {};
  for (const [cat, facts] of categoryMap.entries()) {
    const counts = facts.map((f) =>
      Array.isArray(f.distractors) ? f.distractors.length : 0
    );
    const difficulties = facts
      .map((f) => f.difficulty)
      .filter((d): d is number => d != null);

    const byAgeRating: Record<string, number> = {};
    const byRarity: Record<string, number> = {};

    for (const f of facts) {
      const age = f.ageRating ?? "unknown";
      byAgeRating[age] = (byAgeRating[age] ?? 0) + 1;
      const rarity = f.rarity ?? "unknown";
      byRarity[rarity] = (byRarity[rarity] ?? 0) + 1;
    }

    categoryStats[cat] = {
      total: facts.length,
      withSource: facts.filter((f) => f.sourceName || f.sourceUrl).length,
      withGaiaComment: facts.filter(
        (f) =>
          f.gaiaComment ||
          (Array.isArray(f.gaiaComments) && f.gaiaComments.length > 0)
      ).length,
      withMnemonic: facts.filter((f) => f.mnemonic).length,
      withWowFactor: facts.filter((f) => f.wowFactor).length,
      avgDistractors: counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
      minDistractors: counts.length > 0 ? Math.min(...counts) : 0,
      maxDistractors: counts.length > 0 ? Math.max(...counts) : 0,
      byAgeRating,
      byRarity,
      avgDifficulty:
        difficulties.length > 0
          ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
          : 0,
    };
  }

  // Type breakdown
  const byType: Record<string, number> = {};
  for (const f of allFacts) {
    const t = f.type ?? "fact";
    byType[t] = (byType[t] ?? 0) + 1;
  }

  // Language breakdown (for vocab facts)
  const byLanguage: Record<string, number> = {};
  for (const f of allFacts) {
    if (f.language) {
      byLanguage[f.language] = (byLanguage[f.language] ?? 0) + 1;
    }
  }

  // Build JSON report
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFacts: total,
      seedFiles: seedFiles.length,
      sourceCoverage: {
        withSource,
        percentage: total > 0 ? ((withSource / total) * 100).toFixed(1) + "%" : "0%",
      },
      gaiaCommentCoverage: {
        withGaiaComment,
        withGaiaWrongComment: withGaiaWrong,
        percentage: total > 0 ? ((withGaiaComment / total) * 100).toFixed(1) + "%" : "0%",
      },
      explanationCoverage: {
        withExplanation,
        percentage: total > 0 ? ((withExplanation / total) * 100).toFixed(1) + "%" : "0%",
      },
      mnemonicCoverage: {
        withMnemonic,
        percentage: total > 0 ? ((withMnemonic / total) * 100).toFixed(1) + "%" : "0%",
      },
      wowFactorCoverage: {
        withWowFactor,
        percentage: total > 0 ? ((withWowFactor / total) * 100).toFixed(1) + "%" : "0%",
      },
      distractors: {
        average: Number(avgDistractors.toFixed(1)),
        min: minDistractors,
        max: maxDistractors,
        below10: distractorCounts.filter((c) => c < 10).length,
        range10to24: distractorCounts.filter((c) => c >= 10 && c < 25).length,
        above25: distractorCounts.filter((c) => c >= 25).length,
      },
    },
    byCategory: categoryStats,
    byType,
    byLanguage,
  };

  // Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${path.relative(ROOT, OUTPUT_JSON)}`);

  // Build Markdown report
  const pct = (n: number, d: number): string =>
    d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "0%";

  let md = `# Fact Audit Report\n\n`;
  md += `Generated: ${report.generatedAt}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Facts | ${total} |\n`;
  md += `| Seed Files | ${seedFiles.length} |\n`;
  md += `| Source Coverage | ${withSource}/${total} (${pct(withSource, total)}) |\n`;
  md += `| GAIA Comment Coverage | ${withGaiaComment}/${total} (${pct(withGaiaComment, total)}) |\n`;
  md += `| GAIA Wrong Comments | ${withGaiaWrong}/${total} (${pct(withGaiaWrong, total)}) |\n`;
  md += `| Explanation Coverage | ${withExplanation}/${total} (${pct(withExplanation, total)}) |\n`;
  md += `| Mnemonic Coverage | ${withMnemonic}/${total} (${pct(withMnemonic, total)}) |\n`;
  md += `| Wow Factor Coverage | ${withWowFactor}/${total} (${pct(withWowFactor, total)}) |\n`;
  md += `\n`;

  md += `## Distractor Statistics\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Average | ${avgDistractors.toFixed(1)} |\n`;
  md += `| Min | ${minDistractors} |\n`;
  md += `| Max | ${maxDistractors} |\n`;
  md += `| Below 10 | ${report.summary.distractors.below10} |\n`;
  md += `| 10-24 | ${report.summary.distractors.range10to24} |\n`;
  md += `| 25+ | ${report.summary.distractors.above25} |\n`;
  md += `\n`;

  md += `## By Category\n\n`;
  md += `| Category | Facts | Source % | GAIA % | Avg Distractors |\n`;
  md += `|----------|-------|----------|--------|------------------|\n`;
  for (const [cat, stats] of Object.entries(categoryStats).sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `| ${cat} | ${stats.total} | ${pct(stats.withSource, stats.total)} | ${pct(stats.withGaiaComment, stats.total)} | ${stats.avgDistractors.toFixed(1)} |\n`;
  }
  md += `\n`;

  md += `## By Type\n\n`;
  md += `| Type | Count |\n`;
  md += `|------|-------|\n`;
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    md += `| ${type} | ${count} |\n`;
  }
  md += `\n`;

  if (Object.keys(byLanguage).length > 0) {
    md += `## By Language\n\n`;
    md += `| Language | Count |\n`;
    md += `|----------|-------|\n`;
    for (const [lang, count] of Object.entries(byLanguage).sort((a, b) => b[1] - a[1])) {
      md += `| ${lang} | ${count} |\n`;
    }
    md += `\n`;
  }

  // Write Markdown
  fs.writeFileSync(OUTPUT_MD, md);
  console.log(`Markdown report: ${path.relative(ROOT, OUTPUT_MD)}`);

  // Print summary to stdout
  console.log(`\n=== Fact Audit Summary ===`);
  console.log(`Total facts:          ${total}`);
  console.log(`Categories:           ${categoryMap.size}`);
  console.log(`Source coverage:       ${pct(withSource, total)}`);
  console.log(`GAIA comment coverage: ${pct(withGaiaComment, total)}`);
  console.log(`Avg distractors:      ${avgDistractors.toFixed(1)}`);
  console.log(`Facts below 10 distractors: ${report.summary.distractors.below10}`);
}

main();
