#!/usr/bin/env node
/**
 * assemble-music-history.mjs
 *
 * Assembles the music_history curated deck from 5 WIP fact files into
 * the final CuratedDeck envelope at data/decks/music_history.json.
 *
 * Steps:
 *   1. Read all 5 WIP JSON files
 *   2. Merge into a single facts array
 *   3. Check for duplicate IDs
 *   4. Validate required fields on every fact
 *   5. Normalize schema drift (missing acceptableAlternatives, volatile)
 *   6. Build answerTypePools programmatically by scanning facts
 *   7. Build difficultyTiers (easy/medium/hard) programmatically
 *   8. Build subDecks array from chainThemeId mapping
 *   9. Wrap in CuratedDeck envelope
 *  10. Write data/decks/music_history.json
 *  11. Add to data/decks/manifest.json
 *  12. Run structural validation: node scripts/verify-curated-deck.mjs music_history
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WIP_FILES = [
  { path: resolve(__dirname, 'music_history_classical.json'), expectedThemeId: 0 },
  { path: resolve(__dirname, 'music_history_theory.json'),   expectedThemeId: 1 },
  { path: resolve(__dirname, 'music_history_jazz.json'),     expectedThemeId: 2 },
  { path: resolve(__dirname, 'music_history_rock.json'),     expectedThemeId: 3 },
  { path: resolve(__dirname, 'music_history_world.json'),    expectedThemeId: 4 },
];

// Pool label + answerFormat metadata for known pool IDs
const POOL_METADATA = {
  artist_names:    { label: 'Artist & Performer Names', answerFormat: 'name' },
  composer_names:  { label: 'Composer Names',            answerFormat: 'name' },
  instrument_names:{ label: 'Instrument Names',          answerFormat: 'name' },
  work_names:      { label: 'Musical Work Titles',       answerFormat: 'title' },
  album_names:     { label: 'Album Names',               answerFormat: 'title' },
  genre_names:     { label: 'Genre & Style Names',       answerFormat: 'term' },
  era_names:       { label: 'Music Eras & Periods',      answerFormat: 'term' },
  music_terms:     { label: 'Music Theory Terms',        answerFormat: 'term' },
};

// Sub-deck definitions (chainThemeId → deck metadata)
const SUB_DECK_DEFS = [
  { id: 'classical_masters',    name: 'Classical Masters',             chainThemeId: 0 },
  { id: 'instruments_theory',   name: 'Instruments & Theory',          chainThemeId: 1 },
  { id: 'jazz_blues',           name: 'Jazz & Blues',                  chainThemeId: 2 },
  { id: 'rock_pop',             name: 'Rock & Pop Revolution',         chainThemeId: 3 },
  { id: 'world_modern',         name: 'World Music & Modern Era',      chainThemeId: 4 },
];

// Required fields on every DeckFact
const REQUIRED_FIELDS = [
  'id',
  'correctAnswer',
  'chainThemeId',
  'answerTypePoolId',
  'difficulty',
  'funScore',
  'quizQuestion',
  'explanation',
  'distractors',
  'categoryL1',
  'categoryL2',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function red(s)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s)   { return `\x1b[1m${s}\x1b[0m`; }

function die(msg) {
  console.error(red(`\nFATAL: ${msg}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1 — Read WIP files
// ---------------------------------------------------------------------------
console.log(bold('\n=== music_history assembly script ===\n'));

const allFacts = [];

for (const { path, expectedThemeId } of WIP_FILES) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    die(`Could not read ${path}: ${e.message}`);
  }

  let facts;
  try {
    facts = JSON.parse(raw);
  } catch (e) {
    die(`JSON parse error in ${path}: ${e.message}`);
  }

  if (!Array.isArray(facts)) {
    die(`Expected an array of facts in ${path}, got ${typeof facts}`);
  }

  console.log(`  Loaded ${path.split('/').pop()}: ${facts.length} facts`);

  // Warn if any fact has a different chainThemeId than expected
  const badTheme = facts.filter(f => f.chainThemeId !== expectedThemeId);
  if (badTheme.length > 0) {
    console.warn(yellow(`  WARN: ${badTheme.length} facts in ${path.split('/').pop()} have chainThemeId != ${expectedThemeId}`));
    badTheme.forEach(f => console.warn(yellow(`    ${f.id}: chainThemeId=${f.chainThemeId}`)));
  }

  allFacts.push(...facts);
}

console.log(`\n  Total facts loaded: ${allFacts.length}`);

// ---------------------------------------------------------------------------
// Step 2 — Merge & duplicate ID check
// ---------------------------------------------------------------------------
const seenIds = new Map(); // id -> index
const duplicates = [];

for (let i = 0; i < allFacts.length; i++) {
  const fact = allFacts[i];
  if (!fact.id) {
    die(`Fact at index ${i} has no id field`);
  }
  if (seenIds.has(fact.id)) {
    duplicates.push({ id: fact.id, first: seenIds.get(fact.id), second: i });
  } else {
    seenIds.set(fact.id, i);
  }
}

if (duplicates.length > 0) {
  console.error(red('\nDUPLICATE IDs found:'));
  for (const d of duplicates) {
    console.error(red(`  "${d.id}" at indices ${d.first} and ${d.second}`));
  }
  die('Fix duplicate IDs before assembling');
}

console.log(green(`  Duplicate ID check: OK (${allFacts.length} unique IDs)`));

// ---------------------------------------------------------------------------
// Step 3 — Required field validation
// ---------------------------------------------------------------------------
const missingFields = [];

for (let i = 0; i < allFacts.length; i++) {
  const fact = allFacts[i];
  for (const field of REQUIRED_FIELDS) {
    const val = fact[field];
    const isEmpty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '') ||
      (field === 'distractors' && Array.isArray(val) && val.length === 0);
    if (isEmpty) {
      missingFields.push({ id: fact.id || `[index ${i}]`, field });
    }
  }
}

if (missingFields.length > 0) {
  console.warn(yellow(`\n  WARN: ${missingFields.length} missing/empty required fields:`));
  for (const { id, field } of missingFields) {
    console.warn(yellow(`    ${id}: missing ${field}`));
  }
  // Non-fatal for assembly — continue but report
} else {
  console.log(green('  Required field check: OK'));
}

// ---------------------------------------------------------------------------
// Step 4 — Normalize schema drift
// ---------------------------------------------------------------------------
let normalizedCount = 0;

for (const fact of allFacts) {
  // acceptableAlternatives defaults to []
  if (!Array.isArray(fact.acceptableAlternatives)) {
    fact.acceptableAlternatives = [];
    normalizedCount++;
  }

  // volatile defaults to false
  if (typeof fact.volatile !== 'boolean') {
    fact.volatile = false;
    normalizedCount++;
  }

  // ageGroup defaults to 'all'
  if (!fact.ageGroup) {
    fact.ageGroup = 'all';
    normalizedCount++;
  }
}

console.log(`  Schema normalization: ${normalizedCount} fields normalized`);

// ---------------------------------------------------------------------------
// Step 5 — Build answerTypePools
// ---------------------------------------------------------------------------

// Group fact IDs by answerTypePoolId
const poolMap = new Map(); // poolId -> Set<factId>

for (const fact of allFacts) {
  const poolId = fact.answerTypePoolId;
  if (!poolId) continue;
  if (!poolMap.has(poolId)) poolMap.set(poolId, []);
  poolMap.get(poolId).push(fact.id);
}

const answerTypePools = [];
const smallPools = [];

for (const [poolId, factIds] of poolMap.entries()) {
  const meta = POOL_METADATA[poolId] || {
    label: poolId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    answerFormat: 'term',
  };

  const pool = {
    id: poolId,
    label: meta.label,
    answerFormat: meta.answerFormat,
    factIds: factIds,
    minimumSize: 5,
  };

  answerTypePools.push(pool);

  if (factIds.length < 5) {
    smallPools.push({ poolId, count: factIds.length });
  }
}

if (smallPools.length > 0) {
  console.warn(yellow('\n  WARN: Pools with fewer than 5 facts (minimum for distractor variety):'));
  for (const { poolId, count } of smallPools) {
    console.warn(yellow(`    ${poolId}: ${count} facts`));
  }
} else {
  console.log(green(`  Answer type pools built: ${answerTypePools.length} pools`));
  for (const pool of answerTypePools) {
    console.log(`    ${pool.id}: ${pool.factIds.length} facts`);
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Build difficultyTiers
// ---------------------------------------------------------------------------

const easyIds   = allFacts.filter(f => f.difficulty >= 1 && f.difficulty <= 2).map(f => f.id);
const mediumIds = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hardIds   = allFacts.filter(f => f.difficulty >= 4 && f.difficulty <= 5).map(f => f.id);

const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds   },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard',   factIds: hardIds   },
];

console.log(`\n  Difficulty tiers:`);
console.log(`    easy:   ${easyIds.length} facts (difficulty 1-2)`);
console.log(`    medium: ${mediumIds.length} facts (difficulty 3)`);
console.log(`    hard:   ${hardIds.length} facts (difficulty 4-5)`);

// ---------------------------------------------------------------------------
// Step 7 — Build subDecks
// ---------------------------------------------------------------------------

const subDecks = SUB_DECK_DEFS.map(def => {
  const factIds = allFacts
    .filter(f => f.chainThemeId === def.chainThemeId)
    .map(f => f.id);

  console.log(`  Sub-deck "${def.name}" (chainThemeId ${def.chainThemeId}): ${factIds.length} facts`);

  return {
    id: def.id,
    name: def.name,
    chainThemeId: def.chainThemeId,
    factIds,
  };
});

// Warn on empty sub-decks
const emptySubDecks = subDecks.filter(sd => sd.factIds.length === 0);
if (emptySubDecks.length > 0) {
  console.warn(yellow(`\n  WARN: Empty sub-decks: ${emptySubDecks.map(sd => sd.id).join(', ')}`));
}

// ---------------------------------------------------------------------------
// Step 8 — Wrap in CuratedDeck envelope
// ---------------------------------------------------------------------------

const deck = {
  id: 'music_history',
  name: 'Music History',
  domain: 'art_architecture',
  subDomain: 'music_history',
  description:
    'From Bach to hip-hop — explore 400 years of music through composers, genres, instruments, and the artists who changed the world. Five sub-decks cover classical masters, musical instruments and theory, jazz and blues, rock and pop, and the modern music revolution.',
  minimumFacts: 180,
  targetFacts: 230,
  facts: allFacts,
  answerTypePools,
  synonymGroups: [],
  questionTemplates: [],
  difficultyTiers,
  subDecks,
};

// ---------------------------------------------------------------------------
// Step 9 — Write deck file
// ---------------------------------------------------------------------------

const deckOutPath = resolve(repoRoot, 'data/decks/music_history.json');
writeFileSync(deckOutPath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
console.log(green(`\n  Wrote deck to: ${deckOutPath}`));
console.log(`    Total facts: ${deck.facts.length}`);

// ---------------------------------------------------------------------------
// Step 10 — Update manifest
// ---------------------------------------------------------------------------

const manifestPath = resolve(repoRoot, 'data/decks/manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  die(`Could not read manifest.json: ${e.message}`);
}

if (!Array.isArray(manifest.decks)) {
  die('manifest.json missing "decks" array');
}

if (!manifest.decks.includes('music_history.json')) {
  manifest.decks.push('music_history.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(green('  Updated manifest.json: added music_history.json'));
} else {
  console.log('  manifest.json: music_history.json already present');
}

// ---------------------------------------------------------------------------
// Step 11 — Run structural validation
// ---------------------------------------------------------------------------

console.log(bold('\n=== Running structural validation ===\n'));

try {
  const verifyScript = resolve(repoRoot, 'scripts/verify-curated-deck.mjs');
  const output = execSync(`node ${verifyScript} music_history`, {
    cwd: repoRoot,
    encoding: 'utf8',
    // Allow up to 2 minutes for large decks
    timeout: 120000,
    // Merge stderr into stdout so we capture everything
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(output);
  console.log(green('\nAssembly complete. Validation passed.'));
} catch (err) {
  // execSync throws if exit code != 0
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  console.error(red('\nValidation reported failures (see output above).'));
  // Exit non-zero so CI/caller knows there are issues
  process.exit(1);
}
