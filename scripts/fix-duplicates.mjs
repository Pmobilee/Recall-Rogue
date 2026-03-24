#!/usr/bin/env node
/**
 * fix-duplicates.mjs
 *
 * Reads data/fact-lint-report.json, finds all DUPLICATE_QUESTION entries,
 * groups them by normalized question text, picks a winner in each group,
 * and deletes losers from public/facts.db.
 *
 * Usage:
 *   node scripts/fix-duplicates.mjs           # dry run (no changes)
 *   node scripts/fix-duplicates.mjs --apply   # actually delete from DB
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const APPLY = process.argv.includes('--apply');

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalize a question string the same way the linter does */
function normalizeQuestion(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the normalized key from a DUPLICATE_QUESTION reason string.
 *  reason looks like:  "Duplicate of: some-id (normalized: \"the question\")"
 */
function extractNormalized(reason) {
  const m = reason.match(/\(normalized: "(.+?)"\)\s*$/);
  return m ? m[1] : null;
}

/** Does the ID use an underscore-prefixed domain format? e.g. animals_wildlife- */
function hasUnderscoreDomain(id) {
  return /^[a-z]+_[a-z]+-/.test(id);
}

/** Parse distractors JSON safely and return count */
function distractorCount(distractorsJson) {
  if (!distractorsJson) return 0;
  try {
    const arr = JSON.parse(distractorsJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

// ── load data ─────────────────────────────────────────────────────────────────

const reportPath = path.join(ROOT, 'data', 'fact-lint-report.json');
const dbPath = path.join(ROOT, 'public', 'facts.db');

console.log('Reading lint report:', reportPath);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const dupeIssues = report.issues.filter(i => i.check === 'DUPLICATE_QUESTION');
console.log(`Found ${dupeIssues.length} DUPLICATE_QUESTION entries in lint report.\n`);

// ── open DB and enrich each entry ─────────────────────────────────────────────

const db = new Database(dbPath);

const selectFact = db.prepare(
  'SELECT id, distractors, explanation FROM facts WHERE id = ?'
);

/** Build enriched entry: merge lint row with live DB data */
function enrich(issue) {
  const row = selectFact.get(issue.id);
  if (!row) return null; // already deleted or ID mismatch
  return {
    id: issue.id,
    normalizedKey: extractNormalized(issue.reason) ?? normalizeQuestion(issue.quiz_question),
    distractorCount: distractorCount(row.distractors),
    explanationLen: (row.explanation ?? '').length,
    hasUnderscoreDomain: hasUnderscoreDomain(issue.id),
  };
}

const enriched = dupeIssues
  .map(enrich)
  .filter(Boolean); // drop any IDs not found in DB

// ── group by normalized key ───────────────────────────────────────────────────

const groups = new Map(); // normalizedKey → enriched[]

for (const entry of enriched) {
  const key = entry.normalizedKey;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(entry);
}

console.log(`Grouped into ${groups.size} duplicate sets.\n`);

// ── pick winner for each group ────────────────────────────────────────────────

const toKeep = [];
const toDelete = [];
const unresolved = [];

for (const [key, members] of groups) {
  if (members.length < 2) {
    // Only one entry found in DB for this normalized key — nothing to delete
    toKeep.push(...members);
    continue;
  }

  // Sort: prefer underscore-domain (1), then more distractors (2), then longer explanation (3)
  const sorted = [...members].sort((a, b) => {
    if (b.hasUnderscoreDomain !== a.hasUnderscoreDomain)
      return b.hasUnderscoreDomain - a.hasUnderscoreDomain;
    if (b.distractorCount !== a.distractorCount)
      return b.distractorCount - a.distractorCount;
    return b.explanationLen - a.explanationLen;
  });

  const winner = sorted[0];
  const losers = sorted.slice(1);

  toKeep.push(winner);
  toDelete.push(...losers.map(l => ({ ...l, winnerID: winner.id, normalizedKey: key })));
}

// ── report ────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log(APPLY ? 'MODE: APPLY (changes WILL be written to DB)' : 'MODE: DRY RUN (no changes)');
console.log('='.repeat(72));
console.log();

console.log(`WINNERS (${toKeep.length}) — these will be kept:`);
toKeep.forEach(w =>
  console.log(`  KEEP  ${w.id}  [distractors=${w.distractorCount}, underscoreDomain=${w.hasUnderscoreDomain}]`)
);

console.log();
console.log(`LOSERS (${toDelete.length}) — these will be deleted:`);
toDelete.forEach(l =>
  console.log(`  DEL   ${l.id}  (kept: ${l.winnerID})  [distractors=${l.distractorCount}, underscoreDomain=${l.hasUnderscoreDomain}]`)
);

if (unresolved.length) {
  console.log();
  console.log(`UNRESOLVED (${unresolved.length}) — could not pick a winner:`);
  unresolved.forEach(u => console.log(`  ?     ${u}`));
}

console.log();
console.log('─'.repeat(72));
console.log(`Summary:`);
console.log(`  Duplicate sets found : ${groups.size}`);
console.log(`  Facts to keep        : ${toKeep.length}`);
console.log(`  Facts to delete      : ${toDelete.length}`);
console.log(`  Unresolved groups    : ${unresolved.length}`);
console.log('─'.repeat(72));

// ── apply ─────────────────────────────────────────────────────────────────────

if (APPLY) {
  const deleteStmt = db.prepare('DELETE FROM facts WHERE id = ?');
  const deleteAll = db.transaction(() => {
    for (const loser of toDelete) {
      const info = deleteStmt.run(loser.id);
      if (info.changes === 0) {
        console.warn(`  WARNING: no row found for id=${loser.id} (already deleted?)`);
      }
    }
  });
  deleteAll();
  console.log();
  console.log(`APPLIED: ${toDelete.length} facts deleted from ${dbPath}`);
} else {
  console.log();
  console.log('DRY RUN complete. Pass --apply to delete losers from the database.');
}

db.close();
