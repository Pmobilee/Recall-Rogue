/**
 * fix-pools.mjs
 *
 * Fixes small-pool validation failures in computer_science.json.
 *
 * Problems:
 *   - cs_5_google_algorithm   → pool "algorithm_names" (only 2 factIds — needs ≥5)
 *   - cs_6_svm_purpose        → pool "algorithm_names" (only 2 factIds — needs ≥5)
 *   - cs_4_wifi_standard      → pool "protocol_names"  (only 1 factId  — needs ≥5)
 *
 * Fix:
 *   Reassign those 3 facts to pool "technology_terms" (already has 39 factIds).
 *   Move their factIds out of algorithm_names / protocol_names into technology_terms.
 *   Keep algorithm_names and protocol_names pools (syntheticDistractors still useful)
 *   but leave their factIds arrays empty.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECK_PATH = path.resolve(__dirname, '../../computer_science.json');

const MIGRATIONS = [
  { factId: 'cs_5_google_algorithm', fromPool: 'algorithm_names', toPool: 'technology_terms' },
  { factId: 'cs_6_svm_purpose',      fromPool: 'algorithm_names', toPool: 'technology_terms' },
  { factId: 'cs_4_wifi_standard',    fromPool: 'protocol_names',  toPool: 'technology_terms' },
];

console.log(`Reading ${DECK_PATH}`);
const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

// ── 1. Update answerTypePoolId on each fact ─────────────────────────────────
for (const { factId, fromPool, toPool } of MIGRATIONS) {
  const fact = deck.facts.find(f => f.id === factId);
  if (!fact) {
    console.error(`ERROR: fact not found: ${factId}`);
    process.exit(1);
  }
  if (fact.answerTypePoolId !== fromPool) {
    console.warn(`WARN: ${factId} expected pool "${fromPool}", found "${fact.answerTypePoolId}" — updating anyway`);
  }
  console.log(`  fact ${factId}: "${fact.answerTypePoolId}" → "${toPool}"`);
  fact.answerTypePoolId = toPool;
}

// ── 2. Update answerTypePools array ────────────────────────────────────────
const poolMap = {};
for (const pool of deck.answerTypePools) {
  poolMap[pool.id] = pool;
}

for (const { factId, fromPool, toPool } of MIGRATIONS) {
  const src = poolMap[fromPool];
  const dst = poolMap[toPool];

  if (!src) { console.error(`ERROR: source pool not found: ${fromPool}`); process.exit(1); }
  if (!dst) { console.error(`ERROR: dest pool not found: ${toPool}`);   process.exit(1); }

  // Remove from source
  const srcIdx = src.factIds.indexOf(factId);
  if (srcIdx === -1) {
    console.warn(`WARN: ${factId} not found in pool "${fromPool}" factIds — skipping removal`);
  } else {
    src.factIds.splice(srcIdx, 1);
    console.log(`  pool "${fromPool}": removed ${factId} (now ${src.factIds.length} factIds)`);
  }

  // Add to dest (guard against duplicates)
  if (!dst.factIds.includes(factId)) {
    dst.factIds.push(factId);
    console.log(`  pool "${toPool}": added ${factId} (now ${dst.factIds.length} factIds)`);
  } else {
    console.log(`  pool "${toPool}": ${factId} already present — skipped`);
  }
}

// ── 3. Summary ──────────────────────────────────────────────────────────────
console.log('\nPool sizes after migration:');
for (const id of ['algorithm_names', 'protocol_names', 'technology_terms']) {
  const pool = poolMap[id];
  if (pool) {
    console.log(`  ${id}: ${pool.factIds.length} factIds${pool.syntheticDistractors ? ` + ${pool.syntheticDistractors.length} syntheticDistractors` : ''}`);
  }
}

// ── 4. Write back ───────────────────────────────────────────────────────────
writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2) + '\n', 'utf8');
console.log(`\nWrote updated deck to ${DECK_PATH}`);
