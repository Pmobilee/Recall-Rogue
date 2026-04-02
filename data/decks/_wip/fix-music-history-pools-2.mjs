/**
 * fix-music-history-pools-2.mjs
 * Reassigns answerTypePoolId for 12 misassigned facts in music_history.json,
 * creates person_names and nationality_names pools, adds "St. Thomas Church"
 * to place_names syntheticDistractors, and rebuilds all pool factIds arrays.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_PATH = resolve(__dirname, '../music_history.json');

const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

// ── 1. Reassign pool IDs on specific facts ────────────────────────────────────

const reassignments = {
  // era_names → description_terms
  mh_0_bach_cantatas_count:   'description_terms',
  mh_0_beethoven_deafness:    'description_terms',
  // era_names → place_names
  mh_0_bach_employer_leipzig: 'place_names',
  // era_names → instrument_names
  mh_0_chopin_instrument:     'instrument_names',
  // era_names → nationality_names (new)
  mh_0_chopin_nationality:    'nationality_names',
  // era_names → music_terms
  mh_0_wagner_leitmotif:      'music_terms',
  mh_0_schubert_lieder:       'music_terms',
  // genre_names → music_terms
  mh_2_improvisation:         'music_terms',
  // music_terms → description_terms
  mh_1_saxophone_orchestra:   'description_terms',
  // instrument_names → person_names (new)
  mh_1_piano_inventor:        'person_names',
  mh_1_violin_stradivari:     'person_names',
  mh_1_saxophone_inventor:    'person_names',
};

let reassigned = 0;
for (const fact of deck.facts) {
  if (reassignments[fact.id]) {
    const prev = fact.answerTypePoolId;
    fact.answerTypePoolId = reassignments[fact.id];
    console.log(`  ${fact.id}: ${prev} → ${fact.answerTypePoolId}  (answer: "${fact.correctAnswer}")`);
    reassigned++;
  }
}
console.log(`\nReassigned ${reassigned} facts.`);

// ── 2. Add "St. Thomas Church" to place_names syntheticDistractors ────────────

const placePool = deck.answerTypePools.find(p => p.id === 'place_names');
if (placePool) {
  if (!placePool.syntheticDistractors) placePool.syntheticDistractors = [];
  if (!placePool.syntheticDistractors.includes('St. Thomas Church')) {
    placePool.syntheticDistractors.push('St. Thomas Church');
    console.log('\nAdded "St. Thomas Church" to place_names syntheticDistractors.');
  }
}

// ── 3. Ensure person_names pool exists ───────────────────────────────────────

const personPoolExists = deck.answerTypePools.some(p => p.id === 'person_names');
if (!personPoolExists) {
  deck.answerTypePools.push({
    id: 'person_names',
    label: 'Person Names',
    factIds: [],
    syntheticDistractors: [
      'Robert Moog',
      'Leo Fender',
      'Theobald Boehm',
      'Laurens Hammond',
      'Les Paul',
      'Heinrich Steinweg',
      'Johann Christoph Denner',
      'Yamaha Torakusu',
    ],
  });
  console.log('Created person_names pool.');
}

// ── 4. Ensure nationality_names pool exists ───────────────────────────────────

const nationalityPoolExists = deck.answerTypePools.some(p => p.id === 'nationality_names');
if (!nationalityPoolExists) {
  deck.answerTypePools.push({
    id: 'nationality_names',
    label: 'Nationality Names',
    factIds: [],
    syntheticDistractors: [
      'German',
      'French',
      'Austrian',
      'Italian',
      'Russian',
      'Czech',
      'Hungarian',
      'Norwegian',
      'Finnish',
      'Spanish',
    ],
  });
  console.log('Created nationality_names pool.');
}

// ── 5. Rebuild all pools' factIds from facts ─────────────────────────────────

// Clear existing factIds
for (const pool of deck.answerTypePools) {
  pool.factIds = [];
}

// Rebuild
for (const fact of deck.facts) {
  const pool = deck.answerTypePools.find(p => p.id === fact.answerTypePoolId);
  if (pool) {
    pool.factIds.push(fact.id);
  } else {
    console.warn(`  WARNING: fact "${fact.id}" has unknown pool "${fact.answerTypePoolId}"`);
  }
}

// ── 6. Report final pool sizes ────────────────────────────────────────────────

console.log('\nFinal pool sizes:');
for (const pool of deck.answerTypePools) {
  console.log(`  ${pool.id}: ${pool.factIds.length} facts, ${pool.syntheticDistractors?.length ?? 0} synths`);
}

// ── 7. Write back ─────────────────────────────────────────────────────────────

writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2));
console.log(`\nWritten to ${DECK_PATH}`);
