/**
 * fix-empty-subdecks.mjs
 *
 * Populates empty sub-deck factIds by scanning each deck's facts for matching chainThemeId.
 * Only touches decks where sub-decks have empty factIds arrays.
 *
 * Usage:
 *   node scripts/fix-empty-subdecks.mjs
 *   node scripts/fix-empty-subdecks.mjs --deck ancient_greece   # single deck
 *   node scripts/fix-empty-subdecks.mjs --dry-run               # preview only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.join(__dirname, '..', 'data', 'decks');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const deckArg = args.includes('--deck') ? args[args.indexOf('--deck') + 1] : null;

// Decks known to have empty sub-deck factIds
const TARGET_DECKS = [
  'ancient_greece',
  'ap_world_history',
  'constellations',
  'egyptian_mythology',
  'famous_inventions',
  'mammals_world',
  'medieval_world',
];

const decksToProcess = deckArg ? [deckArg] : TARGET_DECKS;

let totalFixed = 0;
let totalOrphaned = 0;

for (const deckId of decksToProcess) {
  const filePath = path.join(DECKS_DIR, `${deckId}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`  ERROR: File not found: ${filePath}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const deck = JSON.parse(raw);

  if (!Array.isArray(deck.subDecks) || deck.subDecks.length === 0) {
    console.log(`${deckId}: no sub-decks, skipping`);
    continue;
  }

  if (!Array.isArray(deck.facts) || deck.facts.length === 0) {
    console.log(`${deckId}: no facts, skipping`);
    continue;
  }

  // Build a map: chainThemeId → array of fact IDs
  const chainToFactIds = new Map();
  for (const fact of deck.facts) {
    if (fact.chainThemeId === undefined || fact.chainThemeId === null) continue;
    if (!chainToFactIds.has(fact.chainThemeId)) {
      chainToFactIds.set(fact.chainThemeId, []);
    }
    chainToFactIds.get(fact.chainThemeId).push(fact.id);
  }

  // Check for orphaned facts (chainThemeId not matching any sub-deck)
  const subdeckChainIds = new Set(deck.subDecks.map(sd => sd.chainThemeId));
  const orphanedFacts = deck.facts.filter(
    f => f.chainThemeId !== undefined && f.chainThemeId !== null && !subdeckChainIds.has(f.chainThemeId)
  );
  if (orphanedFacts.length > 0) {
    console.warn(`  WARNING: ${deckId} has ${orphanedFacts.length} facts with chainThemeId not matching any sub-deck`);
    totalOrphaned += orphanedFacts.length;
  }

  let fixedCount = 0;
  let skippedCount = 0;

  for (const subDeck of deck.subDecks) {
    const existing = subDeck.factIds;
    if (Array.isArray(existing) && existing.length > 0) {
      skippedCount++;
      continue;
    }

    const matched = chainToFactIds.get(subDeck.chainThemeId) || [];
    if (matched.length === 0) {
      console.warn(`  WARNING: ${deckId} sub-deck "${subDeck.name}" (chainThemeId=${subDeck.chainThemeId}) has no matching facts`);
      continue;
    }

    subDeck.factIds = matched;
    fixedCount++;
    console.log(`  ${deckId} / "${subDeck.name}" (chainThemeId=${subDeck.chainThemeId}): populated ${matched.length} factIds`);
  }

  if (fixedCount === 0) {
    console.log(`${deckId}: nothing to fix (${skippedCount} sub-decks already had factIds)`);
    continue;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would write ${deckId}.json (${fixedCount} sub-decks fixed)`);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
    console.log(`  Wrote ${deckId}.json (${fixedCount} sub-decks fixed, ${skippedCount} already populated)`);
  }

  totalFixed += fixedCount;
}

console.log('');
console.log(`Done. Fixed ${totalFixed} sub-decks across ${decksToProcess.length} deck(s).`);
if (totalOrphaned > 0) {
  console.warn(`WARNING: ${totalOrphaned} orphaned facts found — review manually.`);
}
if (dryRun) {
  console.log('(Dry run — no files were written)');
}
