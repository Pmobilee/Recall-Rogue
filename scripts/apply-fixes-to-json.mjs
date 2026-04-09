#!/usr/bin/env node
/**
 * apply-fixes-to-json.mjs
 *
 * Applies trivia self-answering fixes to the source JSON files
 * (seed files and curated deck files) so the changes persist
 * when the database is rebuilt.
 *
 * Usage:
 *   node scripts/apply-fixes-to-json.mjs --dry-run
 *   node scripts/apply-fixes-to-json.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = !process.argv.includes('--apply');
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);

const FIXES_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');
const SEED_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'seed');
const DECKS_DIR = path.join(PROJECT_ROOT, 'data', 'decks');

const fixes = JSON.parse(fs.readFileSync(FIXES_PATH, 'utf-8'));
const fixMap = new Map(fixes.map(f => [f.id, f]));
console.log(`Loaded ${fixes.length} fixes`);

let totalApplied = 0;
let totalFiles = 0;

/**
 * Process a JSON file containing facts and apply fixes.
 */
function processFile(filePath, getFacts, setFacts) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const facts = getFacts(data);

  let fileApplied = 0;
  for (const fact of facts) {
    const fix = fixMap.get(fact.id);
    if (!fix) continue;

    // Only apply quiz_question fixes
    if (fix.field !== 'quiz_question') continue;

    // Verify current value matches expected old value
    const currentQ = fact.quizQuestion || fact.quiz_question;
    if (currentQ !== fix.old) {
      console.warn(`  SKIP ${fact.id}: current Q doesn't match expected old Q`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${fact.id}: would update quiz question`);
    } else {
      // Apply to whichever field exists
      if (fact.quizQuestion !== undefined) {
        fact.quizQuestion = fix.new;
      } else if (fact.quiz_question !== undefined) {
        fact.quiz_question = fix.new;
      }
    }
    fileApplied++;
    totalApplied++;
  }

  if (fileApplied > 0 && !DRY_RUN) {
    setFacts(data, facts);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  Applied ${fileApplied} fixes to ${path.basename(filePath)}`);
    totalFiles++;
  } else if (fileApplied > 0) {
    console.log(`  Would apply ${fileApplied} fixes to ${path.basename(filePath)}`);
    totalFiles++;
  }

  return fileApplied;
}

// ─── Process seed files (array of facts at root) ──────────────────────────────
console.log('\n=== Seed files ===');
const seedFiles = fs.readdirSync(SEED_DIR)
  .filter(f => f.endsWith('.json') && f.startsWith('knowledge-'));

for (const file of seedFiles) {
  const filePath = path.join(SEED_DIR, file);
  const count = processFile(
    filePath,
    data => data,      // data IS the array
    (data, facts) => { /* no-op: facts IS data */ }
  );
  if (count === 0) process.stdout.write('.');
}
console.log('');

// ─── Process curated deck files (object with facts array) ─────────────────────
console.log('\n=== Curated deck files ===');
const deckFiles = fs.readdirSync(DECKS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json');

for (const file of deckFiles) {
  const filePath = path.join(DECKS_DIR, file);
  try {
    const count = processFile(
      filePath,
      data => data.facts || [],
      (data, facts) => { data.facts = facts; }
    );
    if (count === 0) process.stdout.write('.');
  } catch (e) {
    console.error(`\n  ERROR ${file}: ${e.message}`);
  }
}
console.log('');

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== Summary ===`);
console.log(`Fixes applied: ${totalApplied}`);
console.log(`Files modified: ${totalFiles}`);

if (DRY_RUN) {
  console.log('\nRun with --apply to make changes.');
}
