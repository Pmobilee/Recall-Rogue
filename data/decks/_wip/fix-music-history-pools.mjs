#!/usr/bin/env node
/**
 * fix-music-history-pools.mjs
 *
 * Fixes pool assignments in the music_history deck:
 *
 *   Step 1 — Convert pure-number correctAnswers to {N} bracket notation
 *             and assign to 'bracket_numbers' pool (runtime numeric distractors).
 *
 *   Step 2 — Create semantic pools for answers that don't belong in their
 *             current pool:
 *               place_names      — cities, countries, regions
 *               nickname_terms   — stage names, epithets, personal titles
 *               company_names    — record labels, tech services
 *               description_terms — mechanism/technique descriptions
 *             Reassign mismatched facts; add synthetic distractor members to
 *             small pools so runtime selection has enough choices.
 *
 *   Step 3 — Rebuild every pool's factIds[] by scanning the updated facts,
 *             rebuild difficultyTiers, write back to music_history.json.
 *
 * Usage: node data/decks/_wip/fix-music-history-pools.mjs
 */

import fs from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const deckPath = resolve(repoRoot, 'data/decks/music_history.json');

// ---------------------------------------------------------------------------
// Load deck
// ---------------------------------------------------------------------------
const raw = fs.readFileSync(deckPath, 'utf8');
const deck = JSON.parse(raw);

const factsBefore = deck.facts.length;
console.log(`Loaded music_history.json — ${factsBefore} facts, ${deck.answerTypePools.length} pools`);

// ---------------------------------------------------------------------------
// STEP 1: Convert pure-digit correctAnswers to bracket notation
// ---------------------------------------------------------------------------
// Facts whose correctAnswer is a plain integer (year, count, etc.) should use
// bracket notation so the runtime numericalDistractorService generates smart
// numeric distractors. We do NOT touch answers like "4/4", "over 200", "R&B".
const PURE_DIGIT_RE = /^\d+$/;

let bracketConverted = 0;

for (const fact of deck.facts) {
  if (PURE_DIGIT_RE.test(fact.correctAnswer)) {
    const original = fact.correctAnswer;
    const wasPool = fact.answerTypePoolId;
    fact.correctAnswer = `{${original}}`;
    fact.answerTypePoolId = 'bracket_numbers';
    fact.distractors = [];
    bracketConverted++;
    console.log(`  [bracket] ${fact.id}: "${original}" → "{${original}}" (was: ${wasPool})`);
  }
}
console.log(`\nStep 1: Converted ${bracketConverted} facts to bracket notation`);

// ---------------------------------------------------------------------------
// STEP 2: Reassign facts to new semantic pools
// ---------------------------------------------------------------------------

// --- 2a. place_names ---
// Facts whose correctAnswer is a city, country, region, or geographic name.
const PLACE_NAMES_IDS = new Set([
  'mh_2_blues_origins',         // "Mississippi Delta"
  'mh_2_jazz_new_orleans',      // "New Orleans"
  'mh_0_handel_nationality',    // "England"
  'mh_0_mozart_birth_city',     // "Salzburg"
  'mh_0_beethoven_birth_city',  // "Bonn"
  'mh_0_wagner_bayreuth',       // "Bayreuth"
  'mh_2_ellington_cotton_club', // "Cotton Club" — a place/venue, not a person
]);

const PLACE_NAMES_SYNTHETIC = [
  'Memphis',
  'Chicago',
  'Detroit',
  'Nashville',
  'Liverpool',
  'Vienna',
  'Berlin',
  'Paris',
  'London',
  'St. Louis',
];

// --- 2b. nickname_terms ---
// Facts whose correctAnswer is a personal nickname/epithet (NOT a band name,
// NOT a work title). These are individual sobriquet strings.
// Explicitly enumerated to avoid false positives from pattern matching.
const NICKNAME_TERMS_IDS = new Set([
  'mh_0_vivaldi_red_priest',      // "The Red Priest"    — personal nickname
  'mh_0_haydn_papa_nickname',     // "Papa Haydn"        — personal nickname
  'mh_2_armstrong_nickname',      // "Satchmo"           — personal nickname
  'mh_2_billie_holiday_nickname', // "Lady Day"          — personal nickname
  'mh_4_mj_king_of_pop',          // "King of Pop"       — personal title/epithet
]);

const NICKNAME_TERMS_SYNTHETIC = [
  "The Waltz King",
  "The March King",
  "Bird",
  "Pops",
  "The Boss",
  "The Killer",
  "Ol' Blue Eyes",
  "The Man in Black",
  "The Fab Four",
  "The King of Swing",
];

// --- 2c. company_names ---
// Record labels, tech services, streaming platforms.
// Only 3 facts exist for this pool — minimumSize is set to 3 accordingly.
// Runtime distractor selection draws from syntheticDistractors (8 items),
// giving 11 total choices, which is ample.
const COMPANY_NAMES_IDS = new Set([
  'mh_3_elvis_sun_records',    // "Sun Records"
  'mh_4_napster_1999',         // "Napster"
  'mh_4_streaming_revolution', // "Spotify"
]);

const COMPANY_NAMES_SYNTHETIC = [
  'Motown Records',
  'Atlantic Records',
  'Columbia Records',
  'Apple Records',
  'Capitol Records',
  'Decca Records',
  'Chess Records',
  'Stax Records',
];

// --- 2d. description_terms ---
// Multi-word mechanism/technique descriptions. Keeping these in music_terms
// (single-word terminology pool) would produce nonsense distractors like
// "Allegro" for a "how does this instrument produce sound?" question.
const DESCRIPTION_TERMS_IDS = new Set([
  'mh_1_harpsichord_vs_piano', // "Plucks the strings"
  'mh_1_clarinet_reed',        // "Single reed"
  'mh_1_oboe_double_reed',     // "Double reed"
  'mh_1_trombone_slide',       // "Slide"
  'mh_1_staccato_meaning',     // "Short and detached"
]);

const DESCRIPTION_TERMS_SYNTHETIC = [
  "Hammers the strings",
  "Vibrates air column",
  "Plucks with plectrum",
  "Bows the strings",
  "Buzzes lips into mouthpiece",
  "Strikes a membrane",
  "Blows across an edge",
];

// --- Apply reassignments ---
let reassigned = 0;

for (const fact of deck.facts) {
  let newPool = null;
  if (PLACE_NAMES_IDS.has(fact.id)) newPool = 'place_names';
  else if (NICKNAME_TERMS_IDS.has(fact.id)) newPool = 'nickname_terms';
  else if (COMPANY_NAMES_IDS.has(fact.id)) newPool = 'company_names';
  else if (DESCRIPTION_TERMS_IDS.has(fact.id)) newPool = 'description_terms';

  if (newPool && fact.answerTypePoolId !== newPool) {
    console.log(`  [reassign] ${fact.id}: "${fact.correctAnswer}" ${fact.answerTypePoolId} → ${newPool}`);
    fact.answerTypePoolId = newPool;
    reassigned++;
  }
}

console.log(`\nStep 2: Reassigned ${reassigned} facts to new semantic pools`);

// ---------------------------------------------------------------------------
// STEP 3: Rebuild pools from scratch
// ---------------------------------------------------------------------------

// Build factIds map by scanning updated facts
const poolFactIds = new Map();
for (const fact of deck.facts) {
  const pid = fact.answerTypePoolId;
  if (!poolFactIds.has(pid)) poolFactIds.set(pid, []);
  poolFactIds.get(pid).push(fact.id);
}

// Define all pools with their metadata.
// minimumSize: validator checks factIds.length >= minimumSize.
//   - company_names has 3 facts + 8 synthetics = 11 runtime choices → minimumSize: 3.
//   - All other new pools have ≥5 facts meeting the standard threshold.
const POOL_DEFINITIONS = [
  // Existing pools (retain current labels/formats)
  { id: 'era_names',        label: 'Music Eras & Periods',              answerFormat: 'term',           minimumSize: 5 },
  { id: 'work_names',       label: 'Musical Works & Compositions',      answerFormat: 'title',          minimumSize: 5 },
  { id: 'artist_names',     label: 'Artists & Composers',               answerFormat: 'name',           minimumSize: 5 },
  { id: 'instrument_names', label: 'Musical Instruments',               answerFormat: 'name',           minimumSize: 5 },
  { id: 'music_terms',      label: 'Music Terms & Concepts',            answerFormat: 'term',           minimumSize: 5 },
  { id: 'album_names',      label: 'Albums & Recordings',               answerFormat: 'title',          minimumSize: 5 },
  { id: 'genre_names',      label: 'Music Genres & Styles',             answerFormat: 'term',           minimumSize: 5 },
  // bracket_numbers: runtime numeric generation, no syntheticDistractors needed
  { id: 'bracket_numbers',  label: 'Numbers & Counts',                  answerFormat: 'bracket_number', minimumSize: 3 },
  // New semantic pools
  {
    id: 'place_names',
    label: 'Cities, Countries & Places',
    answerFormat: 'place',
    minimumSize: 5,
    syntheticDistractors: PLACE_NAMES_SYNTHETIC,
  },
  {
    id: 'nickname_terms',
    label: 'Nicknames & Personal Epithets',
    answerFormat: 'term',
    minimumSize: 5,
    syntheticDistractors: NICKNAME_TERMS_SYNTHETIC,
  },
  {
    // Only 3 facts — minimumSize lowered to 3 because syntheticDistractors
    // (8 items) bring total runtime pool to 11, more than enough for selection.
    id: 'company_names',
    label: 'Record Labels & Music Companies',
    answerFormat: 'name',
    minimumSize: 3,
    syntheticDistractors: COMPANY_NAMES_SYNTHETIC,
  },
  {
    id: 'description_terms',
    label: 'Mechanism & Technique Descriptions',
    answerFormat: 'term',
    minimumSize: 5,
    syntheticDistractors: DESCRIPTION_TERMS_SYNTHETIC,
  },
];

// Rebuild answerTypePools array
const newPools = [];
for (const def of POOL_DEFINITIONS) {
  const factIds = poolFactIds.get(def.id) || [];
  if (factIds.length === 0) {
    console.log(`  [pool-skip] ${def.id} has 0 facts — omitting`);
    continue;
  }

  const pool = {
    id: def.id,
    label: def.label,
    answerFormat: def.answerFormat,
    factIds,
    minimumSize: def.minimumSize,
  };

  if (def.syntheticDistractors && def.syntheticDistractors.length > 0) {
    // Filter out any synthetic matching a fact's correctAnswer in this pool
    // to prevent an accidental correct answer surfacing as a distractor.
    const poolAnswers = new Set(
      deck.facts
        .filter(f => factIds.includes(f.id))
        .map(f => f.correctAnswer.replace(/^\{|\}$/g, '')) // strip bracket notation
    );
    pool.syntheticDistractors = def.syntheticDistractors.filter(
      d => !poolAnswers.has(d)
    );
  }

  newPools.push(pool);
  console.log(
    `  [pool] ${def.id}: ${factIds.length} facts` +
    (pool.syntheticDistractors ? `, ${pool.syntheticDistractors.length} synthetics` : '')
  );
}

deck.answerTypePools = newPools;
console.log(`\nStep 3: Rebuilt ${newPools.length} pools`);

// ---------------------------------------------------------------------------
// Rebuild difficultyTiers
// ---------------------------------------------------------------------------
const easy   = deck.facts.filter(f => f.difficulty <= 2).map(f => f.id);
const medium = deck.facts.filter(f => f.difficulty === 3).map(f => f.id);
const hard   = deck.facts.filter(f => f.difficulty >= 4).map(f => f.id);

deck.difficultyTiers = [
  { tier: 'easy',   factIds: easy   },
  { tier: 'medium', factIds: medium },
  { tier: 'hard',   factIds: hard   },
];

console.log(`\nDifficulty tiers: easy=${easy.length}, medium=${medium.length}, hard=${hard.length}`);

// ---------------------------------------------------------------------------
// Validate fact count unchanged
// ---------------------------------------------------------------------------
const factsAfter = deck.facts.length;
if (factsAfter !== factsBefore) {
  console.error(`\nERROR: Fact count changed! Before=${factsBefore}, After=${factsAfter}`);
  process.exit(1);
}
console.log(`\nFact count check: ${factsAfter}/${factsBefore} — OK`);

// ---------------------------------------------------------------------------
// Write back
// ---------------------------------------------------------------------------
fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote updated deck to ${deckPath}`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n=== Summary ===');
console.log(`  Bracket-converted: ${bracketConverted} facts`);
console.log(`  Pool-reassigned:   ${reassigned} facts`);
console.log(`  New pools added:   place_names, nickname_terms, company_names, description_terms`);
console.log(`  Total pools:       ${newPools.length}`);
console.log(`  Total facts:       ${factsAfter}`);
console.log('\n  New pool contents:');
for (const p of newPools.filter(p => ['place_names','nickname_terms','company_names','description_terms'].includes(p.id))) {
  const facts = deck.facts.filter(f => p.factIds.includes(f.id));
  console.log(`    ${p.id} (${p.factIds.length} facts):`);
  for (const f of facts) console.log(`      - ${f.id}: "${f.correctAnswer}"`);
}

// ---------------------------------------------------------------------------
// Run structural validation
// ---------------------------------------------------------------------------
console.log('\n=== Running structural validation ===');
try {
  const result = execSync(
    'node scripts/verify-curated-deck.mjs music_history',
    { cwd: repoRoot, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  // Print only the summary section
  const summaryStart = result.indexOf('=== SUMMARY ===');
  if (summaryStart !== -1) {
    console.log(result.slice(summaryStart));
  } else {
    console.log(result);
  }
} catch (err) {
  // Validation failed — print output for review
  if (err.stdout) {
    const summaryStart = err.stdout.indexOf('=== SUMMARY ===');
    console.log(summaryStart !== -1 ? err.stdout.slice(summaryStart) : err.stdout);
  }
  if (err.stderr) console.error(err.stderr);
}
