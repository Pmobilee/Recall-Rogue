#!/usr/bin/env node
/**
 * fix-pool-homogeneity-round3.mjs
 *
 * Third and final round of fixes for ancient_rome general_politician_names pool.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const ROME_R3_FIXES = {
  // Move 'Virgil' out of general_politician_names -> historical_phrases
  // This raises the pool minimum from 6c to 7c, allowing max up to 21c (7*3)
  // which covers 'Alexander the Great' (19c) and 'Theodoric the Great' (19c)
  rome_aug_aeneid_purpose: {
    newPool: 'historical_phrases',
    newAnswer: 'Virgil',
  },

  // Also fix the bare word number 'three' in date_events
  rome_pun_punic_wars_total: {
    newAnswer: '{3}',
    newAlts: ['3', 'three'],
  },
};

function applyFixes(deck, fixes) {
  for (const [factId, fix] of Object.entries(fixes)) {
    const fact = deck.facts.find(f => f.id === factId);
    if (!fact) {
      console.warn(`  [WARN] Fact not found: ${factId}`);
      continue;
    }
    if (fix.newAnswer !== undefined) fact.correctAnswer = fix.newAnswer;
    if (fix.newAlts !== undefined) fact.acceptableAlternatives = fix.newAlts;
    if (fix.newPool !== undefined) fact.answerTypePoolId = fix.newPool;
  }

  // Rebuild all pool factIds
  for (const pool of deck.answerTypePools) {
    const poolFacts = deck.facts.filter(f => f.answerTypePoolId === pool.id);
    pool.factIds = poolFacts.map(f => f.id);
  }

  return deck;
}

console.log('\n=== Round 3: Fixing ancient_rome ===');
const romePath = resolve(repoRoot, 'data/decks/ancient_rome.json');
let rDeck = JSON.parse(readFileSync(romePath, 'utf8'));
rDeck = applyFixes(rDeck, ROME_R3_FIXES);
writeFileSync(romePath, JSON.stringify(rDeck, null, 2) + '\n');
console.log('  Saved ancient_rome.json');
console.log('\nDone. Run node scripts/pool-homogeneity-analysis.mjs to verify.');
