/**
 * fix-dupe-distractors.mjs
 *
 * Finds and fixes facts where the distractors JSON array contains:
 *   1. Duplicate entries (keeps first occurrence, removes later ones)
 *   2. Entries that exactly match the correct_answer (removes them)
 *
 * Covers ALL fact types (knowledge, vocabulary, etc.) in public/facts.db.
 * Uses better-sqlite3 for fast synchronous access.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../public/facts.db');

const db = new Database(DB_PATH);

const rows = db.prepare(
  'SELECT id, type, correct_answer, distractors FROM facts WHERE distractors IS NOT NULL'
).all();

console.log(`Scanning ${rows.length} facts with distractors...`);

const updateStmt = db.prepare('UPDATE facts SET distractors = ? WHERE id = ?');

let fixedCount = 0;
let totalIssues = 0;

db.transaction(() => {
  for (const row of rows) {
    let parsed;
    try {
      parsed = JSON.parse(row.distractors);
    } catch {
      console.warn(`[SKIP] ${row.id} — invalid JSON in distractors column`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      console.warn(`[SKIP] ${row.id} — distractors is not an array`);
      continue;
    }

    const original = [...parsed];
    const seen = new Set();
    const duplicatesFound = [];
    const answerMatches = [];
    const cleaned = [];

    for (const d of original) {
      const key = typeof d === 'string' ? d.trim().toLowerCase() : String(d);

      // Check if matches correct_answer (case-insensitive exact match)
      if (
        row.correct_answer != null &&
        typeof d === 'string' &&
        d.trim().toLowerCase() === String(row.correct_answer).trim().toLowerCase()
      ) {
        answerMatches.push(d);
        totalIssues++;
        continue;
      }

      // Check for duplicate
      if (seen.has(key)) {
        duplicatesFound.push(d);
        totalIssues++;
        continue;
      }

      seen.add(key);
      cleaned.push(d);
    }

    const hasChanges = duplicatesFound.length > 0 || answerMatches.length > 0;
    if (!hasChanges) continue;

    // Report
    fixedCount++;
    const beforeCount = original.length;
    const afterCount = cleaned.length;

    console.log(`\n[FIX] ${row.id} (type: ${row.type})`);
    if (duplicatesFound.length > 0) {
      console.log(`  Duplicates removed (${duplicatesFound.length}): ${duplicatesFound.map(d => JSON.stringify(d)).join(', ')}`);
    }
    if (answerMatches.length > 0) {
      console.log(`  Matches correct_answer removed (${answerMatches.length}): ${answerMatches.map(d => JSON.stringify(d)).join(', ')}`);
      console.log(`  correct_answer was: ${JSON.stringify(row.correct_answer)}`);
    }
    console.log(`  Distractors: ${beforeCount} → ${afterCount}`);

    updateStmt.run(JSON.stringify(cleaned), row.id);
  }
})();

console.log('\n=== Summary ===');
console.log(`Facts scanned:   ${rows.length}`);
console.log(`Facts fixed:     ${fixedCount}`);
console.log(`Total issues:    ${totalIssues} (dupes + answer-matches removed)`);

db.close();
