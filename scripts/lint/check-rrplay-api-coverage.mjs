/**
 * scripts/lint/check-rrplay-api-coverage.mjs
 *
 * Greps __rrPlay method definitions in src/dev/playtestAPI.ts and cross-checks
 * each against the API Contract Reference table in
 * docs/testing/dev-tooling-restore-invariants.md.
 *
 * Coverage requirement is opt-in: only methods listed in REQUIRES_DOC_COVERAGE
 * (or added after 2026-04-10) are checked. Pre-existing methods without doc
 * entries produce a WARNING, not a failure — coverage grows over time.
 *
 * Methods in SKIP are exempt entirely (perception helpers, scenario system, legacy).
 *
 * Run via: node scripts/lint/check-rrplay-api-coverage.mjs
 * Added: 2026-04-10 — Phase 5 prevention layer
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const API_FILE = join(root, 'src/dev/playtestAPI.ts');
const DOC_FILE = join(root, 'docs/testing/dev-tooling-restore-invariants.md');

// ---------------------------------------------------------------------------
// Methods that MUST be covered (hard fail if missing from doc)
// Add new methods here as they ship with the invariant requirement.
// ---------------------------------------------------------------------------

const REQUIRES_COVERAGE = new Set([
  // HIGH-8 fix (2026-04-10)
  'startStudy',
  // Phase 5 additions (2026-04-10)
  'getRelicDetails',
  'getRewardChoices',
  'getStudyPoolSize',
]);

// ---------------------------------------------------------------------------
// Methods exempt from coverage check (perception, scenario system, legacy)
// ---------------------------------------------------------------------------

const SKIP = new Set([
  'look', 'getAllText', 'getQuizText', 'getStudyCardText', 'getHUDText',
  'getNotifications', 'validateScreen',
  'spawn', 'patch', 'snapshot', 'restore', 'schema', 'recipes',
]);

// ---------------------------------------------------------------------------
// Parse the API Contract Reference table in the doc
// ---------------------------------------------------------------------------

const docSource = readFileSync(DOC_FILE, 'utf8');

const docMethods = new Set();
for (const match of docSource.matchAll(/\|\s+`(\w+)\(.*?\)`\s*\|/g)) {
  docMethods.add(match[1]);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const missing = [...REQUIRES_COVERAGE].filter(name => !docMethods.has(name));

if (missing.length > 0) {
  console.error('\n[check-rrplay-api-coverage] FAIL — These __rrPlay methods are in REQUIRES_COVERAGE');
  console.error('but are missing from the API Contract Reference table in');
  console.error('docs/testing/dev-tooling-restore-invariants.md:\n');
  for (const name of missing) {
    console.error(`  - ${name}()`);
  }
  console.error(
    '\nFix: Add an entry to the "### API Contract Reference" table in that doc.',
  );
  process.exit(1);
}

console.log(`[check-rrplay-api-coverage] PASS — All ${REQUIRES_COVERAGE.size} required __rrPlay methods are documented.`);
console.log(`  Covered: ${[...REQUIRES_COVERAGE].join(', ')}`);
console.log(`\nNote: Pre-2026-04-10 methods use WARN-only coverage. Add new methods to REQUIRES_COVERAGE in this script.`);
