/**
 * CLI: create and publish a weekly fact bundle.
 *
 * Usage:
 *   npx tsx server/src/scripts/release-bundle.ts
 *   npx tsx server/src/scripts/release-bundle.ts --week 2026-W12
 *
 * The script:
 *   1. Determines current ISO year-week (or uses --week flag).
 *   2. Queries all approved, un-bundled facts (bundle_tag IS NULL).
 *   3. Tags them with the week label.
 *   4. Writes a JSON bundle manifest to public/fact-bundles/<week>.json.
 *   5. Updates the bundle index file (public/fact-bundles/index.json).
 */
import { parseArgs } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { initFactsSchema } from "../db/facts-migrate.js";
import { factsDb } from "../db/facts-db.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// Resolve to <project_root>/public/fact-bundles
const BUNDLES_DIR = path.resolve(__dirname, "../../../../public/fact-bundles");

/** Get the ISO year-week string for a given date. */
function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const { values } = parseArgs({
  options: { week: { type: "string" } },
  allowPositionals: false,
});

initFactsSchema();
fs.mkdirSync(BUNDLES_DIR, { recursive: true });

const week = (values.week as string | undefined) ?? isoWeek();

// Tag un-bundled approved facts
factsDb
  .prepare(
    `UPDATE facts SET bundle_tag = ?, updated_at = ?
     WHERE status = 'approved' AND bundle_tag IS NULL`
  )
  .run(week, Date.now());

// Fetch the bundle
interface BundleRow {
  id: string;
  quiz_question: string;
  correct_answer: string;
  gaia_comments: string | null;
  explanation: string;
  category_l1: string;
  difficulty: number;
  difficulty_tier: string;
  novelty_score: number;
  db_version: number;
}

const facts = factsDb
  .prepare(
    `SELECT id, quiz_question, correct_answer, gaia_comments, explanation,
            category_l1, difficulty, difficulty_tier, novelty_score, db_version
     FROM facts WHERE bundle_tag = ? AND status = 'approved'`
  )
  .all(week) as BundleRow[];

interface FactBundle {
  bundleTag: string;
  releasedAt: string;
  factCount: number;
  facts: BundleRow[];
}

const bundle: FactBundle = {
  bundleTag: week,
  releasedAt: new Date().toISOString(),
  factCount: facts.length,
  facts,
};

const bundlePath = path.join(BUNDLES_DIR, `${week}.json`);
fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
console.log(`[release-bundle] Wrote ${facts.length} facts to ${bundlePath}`);

// Update index
interface BundleIndexEntry {
  bundleTag: string;
  factCount: number;
  releasedAt: string;
}

const indexPath = path.join(BUNDLES_DIR, "index.json");
let index: BundleIndexEntry[] = [];
try {
  index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as BundleIndexEntry[];
} catch {
  /* new index */
}

const existing = index.findIndex((e) => e.bundleTag === week);
const entry: BundleIndexEntry = {
  bundleTag: week,
  factCount: facts.length,
  releasedAt: bundle.releasedAt,
};
if (existing >= 0) {
  index[existing] = entry;
} else {
  index.push(entry);
}
index.sort((a, b) => b.bundleTag.localeCompare(a.bundleTag));
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
console.log(
  `[release-bundle] Bundle index updated (${index.length} total bundles).`
);
