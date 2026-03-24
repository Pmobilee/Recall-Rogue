/**
 * delete-bad-facts.mjs
 *
 * Deletes known-bad facts from facts.db:
 *   - All critical FACTUAL_ACCURACY issues from sonnet-full-review.json (29 facts)
 *   - 4 additional known-bad IDs found by batch agents
 *
 * Wrong facts are worse than missing facts.
 * Run from repo root: node scripts/delete-bad-facts.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const Database = require('better-sqlite3');

const REVIEW_JSON = resolve(__dirname, '../data/sonnet-full-review.json');
const DB_PATH = resolve(__dirname, '../public/facts.db');

// Step 1: Load review JSON and extract critical FACTUAL_ACCURACY IDs
const review = JSON.parse(readFileSync(REVIEW_JSON, 'utf8'));
const reviewIds = review.issues
  .filter(i => i.severity === 'critical' && i.dimension === 'FACTUAL_ACCURACY')
  .map(i => i.id);

console.log(`Found ${reviewIds.length} critical FACTUAL_ACCURACY issues in review JSON.`);

// Step 2: Additional known-bad IDs from batch agents
const extraIds = [
  'animals-european-robin-mass',              // duplicate of robin-tiny-mass, same wrong weight
  'animals-nightingale-song-weight',          // duplicate of nightingale-tiny-weight, same wrong weight
  'general_knowledge-android-latest-version', // future-dated, will be stale
  'food_cuisine-emulsion-photographic',       // photographic film in food_cuisine domain
];

// Merge, deduplicate
const allIds = [...new Set([...reviewIds, ...extraIds])];
console.log(`Total unique IDs to delete (after dedup): ${allIds.length}`);
console.log('');

// Step 3: Open DB and delete
const db = new Database(DB_PATH);

// Fetch each fact's quiz_question before deleting (for audit log)
const selectStmt = db.prepare('SELECT id, quiz_question FROM facts WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM facts WHERE id = ?');

let deleted = 0;
let notFound = 0;

console.log('--- Deletion Audit Log ---');

for (const id of allIds) {
  const row = selectStmt.get(id);
  if (row) {
    deleteStmt.run(id);
    console.log(`DELETED   [${id}]`);
    console.log(`          Q: ${row.quiz_question}`);
    deleted++;
  } else {
    console.log(`NOT FOUND [${id}]`);
    notFound++;
  }
  console.log('');
}

db.close();

console.log('--- Summary ---');
console.log(`Deleted:   ${deleted}`);
console.log(`Not found: ${notFound}`);
console.log(`Total processed: ${allIds.length}`);
