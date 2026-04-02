#!/usr/bin/env node
/**
 * fix-template-pool-mismatches.mjs
 *
 * Fixes template-pool mismatch failures in 9 decks:
 *
 * - Removes all questionTemplates from affected decks (all templates reference
 *   placeholder fields that no facts actually have — the game falls back to
 *   fact.quizQuestion directly when no matching template is found, which is
 *   the correct behaviour for these decks).
 *
 * - Also removes empty answerTypePools (0 factIds) from computer_science
 *   (algorithm_names, protocol_names), which trigger separate check #12
 *   failures.
 *
 * Run: node scripts/fix-template-pool-mismatches.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const decksDir = resolve(repoRoot, 'data/decks');

// ---------------------------------------------------------------------------
// Decks to process
// ---------------------------------------------------------------------------

const DECKS_REMOVE_ALL_TEMPLATES = [
  'computer_science',
  'greek_mythology',
  'norse_mythology',
  'us_presidents',
  'periodic_table',
  'solar_system',
  'nasa_missions',
  'us_states',
  'world_capitals',
];

// In computer_science, also remove empty pools by id
const EMPTY_POOLS_TO_REMOVE = {
  computer_science: ['algorithm_names', 'protocol_names'],
};

// ---------------------------------------------------------------------------
// Process each deck
// ---------------------------------------------------------------------------

let totalTemplatesRemoved = 0;
let totalPoolsRemoved = 0;

for (const deckId of DECKS_REMOVE_ALL_TEMPLATES) {
  const filePath = resolve(decksDir, `${deckId}.json`);

  let deck;
  try {
    deck = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`ERROR: Could not load ${filePath}: ${e.message}`);
    process.exit(1);
  }

  const templatesBefore = (deck.questionTemplates || []).length;

  // Remove all questionTemplates
  delete deck.questionTemplates;

  const templatesRemoved = templatesBefore;
  totalTemplatesRemoved += templatesRemoved;

  // Remove empty pools if specified
  let poolsRemoved = 0;
  if (EMPTY_POOLS_TO_REMOVE[deckId]) {
    const badIds = new Set(EMPTY_POOLS_TO_REMOVE[deckId]);
    const before = (deck.answerTypePools || []).length;
    deck.answerTypePools = (deck.answerTypePools || []).filter(p => !badIds.has(p.id));
    poolsRemoved = before - deck.answerTypePools.length;
    totalPoolsRemoved += poolsRemoved;
  }

  writeFileSync(filePath, JSON.stringify(deck, null, 2) + '\n', 'utf8');

  const poolMsg = poolsRemoved > 0 ? `, removed ${poolsRemoved} empty pool(s)` : '';
  console.log(`  ${deckId}: removed ${templatesRemoved} questionTemplate(s)${poolMsg}`);
}

console.log('');
console.log(`Done. ${totalTemplatesRemoved} templates removed, ${totalPoolsRemoved} empty pools removed across ${DECKS_REMOVE_ALL_TEMPLATES.length} decks.`);
