/**
 * backfill-pos-field.mjs
 *
 * Backfills the `partOfSpeech` field onto vocab deck facts that have POS data
 * embedded in their `explanation` field but no dedicated `partOfSpeech` field.
 *
 * Target decks (as of 2026-04-02):
 *   - japanese_n1.json  (308 facts missing)
 *   - japanese_n2.json  (262 facts missing)
 *   - japanese_n3.json  (34 facts missing)
 *   - japanese_n5.json  (58 facts missing)
 *   - korean_topik1.json (already complete — skipped)
 *   - korean_topik2.json (already complete — skipped)
 *
 * NOTE: japanese_n4.json already has `partOfSpeech` on all facts — not listed here.
 *
 * Parsing rule:
 *   regex: /Part of speech: ([^.]+)/
 *   Primary POS = first word/token before comma for multi-POS entries
 *   Normalize to lowercase
 *   Map "word" → "phrase"
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Decks to process — skipping korean (already complete) and n4 (already complete)
const TARGET_DECKS = [
  'data/decks/japanese_n1.json',
  'data/decks/japanese_n2.json',
  'data/decks/japanese_n3.json',
  'data/decks/japanese_n5.json',
  'data/decks/korean_topik1.json',
  'data/decks/korean_topik2.json',
];

const POS_REGEX = /Part of speech: ([^.]+)/;

/**
 * Extract the primary part of speech from an explanation string.
 * Returns null if no POS found.
 */
function extractPOS(explanation) {
  if (!explanation) return null;
  const match = explanation.match(POS_REGEX);
  if (!match) return null;

  const raw = match[1].trim();
  // Take primary (first before comma)
  const primary = raw.split(',')[0].trim().toLowerCase();

  // Map "word" → "phrase"
  if (primary === 'word') return 'phrase';

  return primary;
}

let totalBackfilled = 0;
let totalAlreadySet = 0;
let totalNoMatch = 0;

for (const relPath of TARGET_DECKS) {
  const fullPath = resolve(repoRoot, relPath);
  const deck = JSON.parse(readFileSync(fullPath, 'utf8'));
  const deckId = deck.id ?? relPath;

  const posCounts = {};
  let backfilled = 0;
  let alreadySet = 0;
  let noMatch = 0;

  for (const fact of deck.facts) {
    if (fact.partOfSpeech) {
      alreadySet++;
      posCounts[fact.partOfSpeech] = (posCounts[fact.partOfSpeech] ?? 0) + 1;
      continue;
    }

    const pos = extractPOS(fact.explanation);
    if (pos) {
      fact.partOfSpeech = pos;
      backfilled++;
      posCounts[pos] = (posCounts[pos] ?? 0) + 1;
    } else {
      noMatch++;
      posCounts['__NO_MATCH__'] = (posCounts['__NO_MATCH__'] ?? 0) + 1;
    }
  }

  if (backfilled > 0) {
    writeFileSync(fullPath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
    console.log(`\n[${deckId}] backfilled ${backfilled} facts (${alreadySet} already set, ${noMatch} no-match)`);
  } else {
    console.log(`\n[${deckId}] already complete — ${alreadySet} facts had partOfSpeech, ${noMatch} no-match`);
  }

  // Print POS distribution
  const sorted = Object.entries(posCounts).sort((a, b) => b[1] - a[1]);
  for (const [pos, count] of sorted) {
    console.log(`  ${pos}: ${count}`);
  }

  totalBackfilled += backfilled;
  totalAlreadySet += alreadySet;
  totalNoMatch += noMatch;
}

console.log(`\n=== SUMMARY ===`);
console.log(`Backfilled: ${totalBackfilled} facts across ${TARGET_DECKS.length} decks`);
console.log(`Already had partOfSpeech: ${totalAlreadySet}`);
console.log(`No POS found in explanation: ${totalNoMatch}`);

if (totalNoMatch > 0) {
  console.warn(`\nWARNING: ${totalNoMatch} facts have no partOfSpeech and no POS in explanation.`);
  console.warn(`Review those facts manually or accept that they will have no partOfSpeech field.`);
}
