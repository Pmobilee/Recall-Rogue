#!/usr/bin/env node
/**
 * check-set-map-rehydration.mjs
 *
 * Preventative lint script for CRITICAL-2 (2026-04-10).
 *
 * Root cause: `serializeRunState` used `...run` which spread Set/Map fields
 * as `{}` into JSON (JSON.stringify silently drops Set/Map contents).
 *
 * This script scans runSaveService.ts (and any future companion files) to
 * verify that:
 *   1. The Omit<> union in SerializedRunState explicitly lists every field
 *      whose runtime type is Set, Map, or a class instance with Map/Set fields.
 *   2. `serializeRunState` does NOT use a bare `...run` spread (which would
 *      silently re-introduce the bug for any new Set/Map fields added to RunState).
 *   3. `deserializeRunState` explicitly re-wraps every Set field back to `new Set(...)`.
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
const serializeFnMatch = src.match(/function serializeRunState[\s\S]*?^}/m);
if (!serializeFnMatch) {
  fail('Could not find serializeRunState function body.');
} else {
  const body = serializeFnMatch[0];
  // Presence of `...rest` (from destructuring) is the safe pattern
  const hasSafeSpread = body.includes('...rest');
  // Presence of `return { ...run` would be the dangerous pattern
  const hasDangerousSpread = /return\s*\{\s*\.\.\.run/.test(body);

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
// Summary
// ---------------------------------------------------------------------------

if (process.exitCode === 1) {
  console.error('\n[check-set-map-rehydration] FAILED — fix the violations above before committing.');
} else {
  console.log('\n[check-set-map-rehydration] All checks passed.');
}
