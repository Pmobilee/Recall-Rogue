/**
 * fix-kanji-correct-answer.mjs
 *
 * Verifies and fixes kanji facts in JLPT decks so that correctAnswer always
 * holds the kana reading (from fact.reading) rather than the kanji character
 * (which belongs in fact.targetLanguageWord only).
 *
 * Pool scope: kanji_onyomi and kanji_kunyomi facts only.
 * Facts in kanji_characters (answer IS the kanji) are intentionally skipped.
 * Facts in kanji_meanings (answer IS the English gloss) are intentionally skipped.
 *
 * Usage:
 *   node scripts/fix-kanji-correct-answer.mjs --deck japanese_n5
 *   node scripts/fix-kanji-correct-answer.mjs --deck japanese_n5 --dry-run
 *   node scripts/fix-kanji-correct-answer.mjs --deck japanese_n1
 *
 * Options:
 *   --deck <id>   Required. Deck ID (e.g. japanese_n5)
 *   --dry-run     Print planned changes without writing the file
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let deckId = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--deck' && args[i + 1]) {
    deckId = args[++i];
  } else if (args[i] === '--dry-run') {
    dryRun = true;
  }
}

if (!deckId) {
  console.error('Usage: node scripts/fix-kanji-correct-answer.mjs --deck <id> [--dry-run]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Unicode helpers
// ---------------------------------------------------------------------------

/** Returns true if string contains at least one CJK Unified Ideograph. */
function isKanji(s) {
  return /[\u4e00-\u9fff]/.test(s);
}

/** Returns true if string contains kana (hiragana or katakana) but no kanji. */
function isKana(s) {
  return /[\u3040-\u30ff]/.test(s) && !isKanji(s);
}

// ---------------------------------------------------------------------------
// Load deck
// ---------------------------------------------------------------------------

const deckPath = resolve(process.cwd(), 'data/decks', `${deckId}.json`);

let deck;
try {
  deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
} catch (err) {
  console.error(`Failed to read ${deckPath}: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Audit and fix
// ---------------------------------------------------------------------------

const TARGET_POOLS = new Set(['kanji_onyomi', 'kanji_kunyomi']);

let totalFacts = 0;
let kanjiFactsFound = 0;
let factsUpdated = 0;
let factsSkippedNoReading = 0;
let factsSkippedAlreadyCorrect = 0;
let factsSkippedNonKanjiTarget = 0;

const plannedChanges = [];
const warnings = [];

for (const fact of deck.facts) {
  totalFacts++;
  const pool = fact.answerTypePoolId;
  if (!TARGET_POOLS.has(pool)) continue;

  kanjiFactsFound++;
  const { id, targetLanguageWord, correctAnswer, reading } = fact;

  // Guard: reading must exist and be non-empty
  if (!reading || reading.trim() === '') {
    warnings.push(`WARN: ${id} — no reading field, skipping`);
    factsSkippedNoReading++;
    continue;
  }

  // Guard: targetLanguageWord should be a kanji character
  // If it's already kana, this fact may have been misrouted to a kanji pool
  if (!isKanji(targetLanguageWord || '')) {
    warnings.push(`WARN: ${id} — targetLanguageWord "${targetLanguageWord}" is not kanji (pool=${pool}), skipping`);
    factsSkippedNonKanjiTarget++;
    continue;
  }

  // Guard: if correctAnswer already equals reading, nothing to do
  if (correctAnswer === reading) {
    factsSkippedAlreadyCorrect++;
    continue;
  }

  plannedChanges.push({
    id,
    pool,
    oldCorrectAnswer: correctAnswer,
    newCorrectAnswer: reading,
    reading,
  });
  factsUpdated++;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\nDeck: ${deck.name ?? deckId} (${deckId})`);
console.log(`  Total facts:          ${totalFacts}`);
console.log(`  Kanji facts found:    ${kanjiFactsFound}  (kanji_onyomi + kanji_kunyomi)`);
console.log(`  Already correct:      ${factsSkippedAlreadyCorrect}  (correctAnswer === reading)`);
console.log(`  To update:            ${factsUpdated}`);
console.log(`  Skipped (no reading): ${factsSkippedNoReading}`);
console.log(`  Skipped (non-kanji target): ${factsSkippedNonKanjiTarget}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log(`  ${w}`);
}

if (plannedChanges.length === 0) {
  console.log('\nNo changes needed. Data is already correct.');
  process.exit(0);
}

// Show planned changes
console.log('\nPlanned changes:');
const previewCount = Math.min(plannedChanges.length, 10);
for (let i = 0; i < previewCount; i++) {
  const c = plannedChanges[i];
  console.log(`  [${c.pool}] ${c.id}`);
  console.log(`    old correctAnswer: ${c.oldCorrectAnswer}`);
  console.log(`    new correctAnswer: ${c.newCorrectAnswer}  (= reading)`);
}
if (plannedChanges.length > previewCount) {
  console.log(`  ... and ${plannedChanges.length - previewCount} more`);
}

if (dryRun) {
  console.log('\nDry-run mode: no changes written.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Apply changes
// ---------------------------------------------------------------------------

const updatedIds = new Set(plannedChanges.map(c => c.id));

for (const fact of deck.facts) {
  if (!updatedIds.has(fact.id)) continue;
  const change = plannedChanges.find(c => c.id === fact.id);
  if (change) {
    fact.correctAnswer = change.newCorrectAnswer;
  }
}

writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n', 'utf-8');
console.log(`\nApplied ${factsUpdated} corrections to ${deckPath}`);
