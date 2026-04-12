#!/usr/bin/env node
/**
 * check-set-map-rehydration.mjs
 *
 * Preventative lint script for CRITICAL-2 (2026-04-10) and CRITICAL-3 (2026-04-12).
 *
 * Root cause (CRITICAL-2): `serializeRunState` used `...run` which spread Set/Map fields
 * as `{}` into JSON (JSON.stringify silently drops Set/Map contents).
 *
 * Root cause (CRITICAL-3): `saveActiveRun` spread `encounterSnapshot.activeDeck` directly,
 * causing `CardRunState.currentEncounterSeenFacts` (Set<string>) to become `{}` in JSON.
 * On resume, `deckManager.ts:327` threw "add is not a function" (combat softlock).
 * The blind spot: the original script only scanned the RunState Omit union at the
 * top-level and never descended into CardRunState embedded inside encounterSnapshot.
 *
 * This script now also verifies the CardRunState serialization / rehydration path
 * so that CRITICAL-3 cannot silently regress.
 *
 * This script scans runSaveService.ts (and any future companion files) to
 * verify that:
 *   1. The Omit<> union in SerializedRunState explicitly lists every field
 *      whose runtime type is Set, Map, or a class instance with Map/Set fields.
 *   2. `serializeRunState` does NOT use a bare `...run` spread (which would
 *      silently re-introduce the bug for any new Set/Map fields added to RunState).
 *   3. `deserializeRunState` explicitly re-wraps every Set field back to `new Set(...)`.
 *   4. `serializeActiveDeckSets` exists and explicitly handles
 *      `currentEncounterSeenFacts` (CRITICAL-3 coverage).
 *   5. `rehydrateActiveDeckSets` exists and re-wraps `currentEncounterSeenFacts`
 *      as `new Set(...)` (CRITICAL-3 coverage).
 *   6. `saveActiveRun` calls `serializeActiveDeckSets` (CRITICAL-3 coverage).
 *   7. `loadActiveRun` calls `rehydrateActiveDeckSets` (CRITICAL-3 coverage).
 *
 * Exit 0 = all checks pass.
 * Exit 1 = violation found (prints details).
 *
 * Usage:
 *   node scripts/lint/check-set-map-rehydration.mjs
 *   npm run lint:rehydration
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// ---------------------------------------------------------------------------
// Files to check
// ---------------------------------------------------------------------------

const SAVE_SERVICE = resolve(ROOT, 'src/services/runSaveService.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`[check-set-map-rehydration] FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[check-set-map-rehydration] ok: ${msg}`);
}

/**
 * Extract the source text of a function/block by scanning for the function
 * signature and accumulating until balanced braces return to zero.
 * More robust than a regex `^}` multiline match for deeply-nested bodies.
 */
function extractFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;
  let depth = 0;
  let inBody = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') { depth++; inBody = true; }
    else if (ch === '}') {
      depth--;
      if (inBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Check 1: SerializedRunState Omit union includes in-memory Set/Map fields
// ---------------------------------------------------------------------------

const SET_MAP_FIELDS_REQUIRED_IN_OMIT = [
  'reviewStateSnapshot',
  'firstTimeFactIds',
  'tierAdvancedFactIds',
  'masteredThisRunFactIds',
];

const SET_FIELDS_REQUIRING_NEW_SET_IN_DESERIALIZE = [
  'consumedRewardFactIds',
  'factsAnsweredCorrectly',
  'factsAnsweredIncorrectly',
  'firstChargeFreeFactIds',
  'offeredRelicIds',
  'cursedFactIds',
  'attemptedFactIds',
  'firstTimeFactIds',
  'tierAdvancedFactIds',
  'masteredThisRunFactIds',
];

let src;
try {
  src = readFileSync(SAVE_SERVICE, 'utf8');
} catch (err) {
  fail(`Could not read ${SAVE_SERVICE}: ${err.message}`);
  process.exit(1);
}

// Check 1: Omit union contains all in-memory Set/Map fields
for (const field of SET_MAP_FIELDS_REQUIRED_IN_OMIT) {
  if (!src.includes(`'${field}'`)) {
    fail(
      `SerializedRunState Omit<> is missing '${field}'. ` +
      `This field is a Set/Map and will serialize as {} via JSON.stringify, ` +
      `breaking .has()/.get() on resume. Add it to the Omit<> union.`
    );
  } else {
    pass(`Omit<> contains '${field}'`);
  }
}

// Check 2: serializeRunState does NOT use bare `...run` without destructuring exclusions
// The pattern we want: destructure out all excluded fields, then spread `...rest`
// The pattern we forbid: `return { ...run, ... }` without excluding Set/Map fields first
const serializeFnBody = extractFunctionBody(src, 'function serializeRunState');
if (!serializeFnBody) {
  fail('Could not find serializeRunState function body.');
} else {
  // Presence of `...rest` (from destructuring) is the safe pattern
  const hasSafeSpread = serializeFnBody.includes('...rest');
  // Presence of `return { ...run` would be the dangerous pattern
  const hasDangerousSpread = /return\s*\{\s*\.\.\.run/.test(serializeFnBody);

  if (hasDangerousSpread) {
    fail(
      'serializeRunState uses `return { ...run, ... }` — this spreads Set/Map fields as {}. ' +
      'Use destructuring to exclude Set/Map fields first, then spread ...rest.'
    );
  } else if (!hasSafeSpread) {
    fail(
      'serializeRunState does not contain `...rest` spread. ' +
      'Verify the function uses destructure-then-rest pattern for safe Set/Map exclusion.'
    );
  } else {
    pass('serializeRunState uses safe destructure-then-rest pattern (no bare `...run` spread)');
  }
}

// Check 3: deserializeRunState explicitly re-wraps Set fields
for (const field of SET_FIELDS_REQUIRING_NEW_SET_IN_DESERIALIZE) {
  // Look for `field: new Set(...)` or `field: new Set<` pattern
  const rehydratePattern = new RegExp(`${field}\\s*:\\s*new Set`);
  // Also accept `reviewStateSnapshot: undefined` (special case — not persisted)
  const undefinedPattern = new RegExp(`${field}\\s*:\\s*undefined`);

  if (!rehydratePattern.test(src) && !undefinedPattern.test(src)) {
    fail(
      `deserializeRunState does not re-wrap '${field}' as new Set(...). ` +
      `After JSON round-trip, this field will be a plain array, not a Set. ` +
      `Add: ${field}: new Set(saved.${field} ?? [])`
    );
  } else {
    pass(`deserializeRunState re-wraps '${field}' correctly`);
  }
}

// ---------------------------------------------------------------------------
// Check 4: CardRunState.currentEncounterSeenFacts serialization (CRITICAL-3)
//
// The original lint only scanned RunState's top-level Omit union. It missed
// Set fields on CardRunState embedded inside encounterSnapshot.activeDeck.
// These checks ensure the dedicated serialize/rehydrate helpers exist so the
// CRITICAL-3 softlock (BATCH-2026-04-12-001-C-003) cannot silently regress.
//
// We use extractFunctionBody() rather than a multiline `^}` regex because
// saveActiveRun and loadActiveRun have deeply-nested bodies that the regex
// approach failed to match correctly.
// ---------------------------------------------------------------------------

// Check 4a: serializeActiveDeckSets function exists and handles currentEncounterSeenFacts
const serializeDeckBody = extractFunctionBody(src, 'function serializeActiveDeckSets');
if (!serializeDeckBody) {
  fail(
    'serializeActiveDeckSets() is missing from runSaveService.ts. ' +
    'This function must explicitly convert CardRunState.currentEncounterSeenFacts ' +
    '(Set<string>) to an array before JSON.stringify. Without it, the Set becomes {} ' +
    'in the saved JSON, causing a "add is not a function" softlock on Continue Run ' +
    '(CRITICAL-3, 2026-04-12).'
  );
} else if (!serializeDeckBody.includes('currentEncounterSeenFacts')) {
  fail(
    'serializeActiveDeckSets() does not mention currentEncounterSeenFacts. ' +
    'It must explicitly convert that Set to an array (e.g. Array.from(...)).'
  );
} else {
  pass('serializeActiveDeckSets() handles currentEncounterSeenFacts');
}

// Check 4b: rehydrateActiveDeckSets function exists and re-wraps currentEncounterSeenFacts
const rehydrateDeckBody = extractFunctionBody(src, 'function rehydrateActiveDeckSets');
if (!rehydrateDeckBody) {
  fail(
    'rehydrateActiveDeckSets() is missing from runSaveService.ts. ' +
    'This function must re-wrap CardRunState.currentEncounterSeenFacts as new Set(...) ' +
    'after JSON deserialization. Without it, the field remains a plain array or {} on ' +
    'resume (CRITICAL-3, 2026-04-12).'
  );
} else if (!rehydrateDeckBody.includes('currentEncounterSeenFacts') || !rehydrateDeckBody.includes('new Set')) {
  fail(
    'rehydrateActiveDeckSets() must re-wrap currentEncounterSeenFacts as new Set(...). ' +
    'Ensure both the array path (new saves) and the {} path (legacy saves) are handled.'
  );
} else {
  pass('rehydrateActiveDeckSets() re-wraps currentEncounterSeenFacts as new Set(...)');
}

// Check 4c: saveActiveRun calls serializeActiveDeckSets on activeDeck
// Use index-slice: extract the text from saveActiveRun's start to loadActiveRun's start.
// This is more robust than a regex on a deeply-nested function body.
{
  const saveIdx = src.indexOf('export function saveActiveRun');
  const loadIdx = src.indexOf('export function loadActiveRun');
  if (saveIdx === -1 || loadIdx === -1) {
    fail('Could not locate saveActiveRun or loadActiveRun in runSaveService.ts.');
  } else {
    const saveSection = src.slice(saveIdx, loadIdx);
    if (!saveSection.includes('serializeActiveDeckSets')) {
      fail(
        'saveActiveRun() does not call serializeActiveDeckSets(). ' +
        'Without this call, CardRunState Set fields in encounterSnapshot.activeDeck ' +
        'are spread directly into the serialized JSON, causing them to become {} ' +
        'via JSON.stringify (CRITICAL-3 regression path).'
      );
    } else {
      pass('saveActiveRun() calls serializeActiveDeckSets() on activeDeck');
    }
  }
}

// Check 4d: loadActiveRun calls rehydrateActiveDeckSets on eDeck
// Use index-slice: extract the text from loadActiveRun's start to clearActiveRun's start.
{
  const loadIdx = src.indexOf('export function loadActiveRun');
  const clearIdx = src.indexOf('export function clearActiveRun');
  if (loadIdx === -1 || clearIdx === -1) {
    fail('Could not locate loadActiveRun or clearActiveRun in runSaveService.ts.');
  } else {
    const loadSection = src.slice(loadIdx, clearIdx);
    if (!loadSection.includes('rehydrateActiveDeckSets')) {
      fail(
        'loadActiveRun() does not call rehydrateActiveDeckSets(). ' +
        'Without this call, CardRunState Set fields remain as plain arrays or {} ' +
        'after JSON.parse, causing "add is not a function" on the next card draw ' +
        '(CRITICAL-3 regression path).'
      );
    } else {
      pass('loadActiveRun() calls rehydrateActiveDeckSets() on eDeck');
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

if (process.exitCode === 1) {
  console.error('\n[check-set-map-rehydration] FAILED — fix the violations above before committing.');
} else {
  console.log('\n[check-set-map-rehydration] All checks passed.');
}
