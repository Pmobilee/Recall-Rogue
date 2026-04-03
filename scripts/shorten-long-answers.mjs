#!/usr/bin/env node
/**
 * shorten-long-answers.mjs
 *
 * Phase 1 (extract): Extracts all knowledge-deck facts with correctAnswer > 60 chars
 *                     into a JSON file for batch rewriting.
 * Phase 2 (apply):   Reads a rewrites JSON file and applies shortened answers back
 *                     to the deck files.
 *
 * Usage:
 *   node scripts/shorten-long-answers.mjs extract          # → /tmp/long-answers.json
 *   node scripts/shorten-long-answers.mjs apply <file>     # apply rewrites from file
 *   node scripts/shorten-long-answers.mjs check            # show current warning count
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const BRACE_NUMBER_RE = /\{(\d[\d,]*\.?\d*)\}/;

function displayAnswer(answer) {
  return answer.replace(BRACE_NUMBER_RE, '$1');
}

function loadManifest() {
  const manifestPath = resolve(repoRoot, 'data/decks/manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function loadDeck(filename) {
  return JSON.parse(readFileSync(resolve(repoRoot, 'data/decks', filename), 'utf8'));
}

// ─── EXTRACT ──────────────────────────────────────────────────────────────────

function extract() {
  const manifest = loadManifest();
  const results = [];

  for (const filename of manifest.decks) {
    const deck = loadDeck(filename);
    if (deck.domain === 'vocabulary') continue;

    const deckId = filename.replace('.json', '');
    for (const fact of deck.facts) {
      const displayed = displayAnswer(fact.correctAnswer);
      if (displayed.length > 60) {
        results.push({
          deckId,
          factId: fact.id,
          question: fact.quizQuestion,
          currentAnswer: fact.correctAnswer,
          displayLength: displayed.length,
        });
      }
    }
  }

  const outPath = '/tmp/long-answers.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Extracted ${results.length} facts with answers > 60 chars to ${outPath}`);

  // Group by deck for summary
  const byDeck = {};
  for (const r of results) {
    byDeck[r.deckId] = (byDeck[r.deckId] || 0) + 1;
  }
  const sorted = Object.entries(byDeck).sort((a, b) => b[1] - a[1]);
  console.log('\nBy deck:');
  for (const [deck, count] of sorted) {
    console.log(`  ${String(count).padStart(4)}  ${deck}`);
  }
}

// ─── APPLY ────────────────────────────────────────────────────────────────────

function apply(rewritesPath) {
  const rewrites = JSON.parse(readFileSync(rewritesPath, 'utf8'));
  const manifest = loadManifest();

  // Group rewrites by deck
  const byDeck = {};
  for (const r of rewrites) {
    if (!byDeck[r.deckId]) byDeck[r.deckId] = [];
    byDeck[r.deckId].push(r);
  }

  let totalApplied = 0;
  let totalSkipped = 0;

  for (const [deckId, deckRewrites] of Object.entries(byDeck)) {
    const filename = deckId + '.json';
    const deckPath = resolve(repoRoot, 'data/decks', filename);
    const deck = JSON.parse(readFileSync(deckPath, 'utf8'));

    const factById = new Map(deck.facts.map(f => [f.id, f]));

    for (const rewrite of deckRewrites) {
      const fact = factById.get(rewrite.factId);
      if (!fact) {
        console.warn(`  SKIP: ${rewrite.factId} not found in ${deckId}`);
        totalSkipped++;
        continue;
      }

      const newDisplay = displayAnswer(rewrite.newAnswer);
      if (newDisplay.length > 60) {
        console.warn(`  SKIP: ${rewrite.factId} new answer still > 60 chars (${newDisplay.length}): "${newDisplay}"`);
        totalSkipped++;
        continue;
      }

      // Move old answer to acceptableAlternatives if not already there
      const oldAnswer = fact.correctAnswer;
      if (!fact.acceptableAlternatives) fact.acceptableAlternatives = [];
      if (!fact.acceptableAlternatives.includes(oldAnswer) && oldAnswer !== rewrite.newAnswer) {
        fact.acceptableAlternatives.push(oldAnswer);
      }

      fact.correctAnswer = rewrite.newAnswer;
      totalApplied++;
    }

    writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n');
  }

  console.log(`\nApplied ${totalApplied} rewrites, skipped ${totalSkipped}`);
}

// ─── CHECK ────────────────────────────────────────────────────────────────────

function check() {
  const manifest = loadManifest();
  let total = 0;
  for (const filename of manifest.decks) {
    const deck = loadDeck(filename);
    if (deck.domain === 'vocabulary') continue;
    for (const fact of deck.facts) {
      const displayed = displayAnswer(fact.correctAnswer);
      if (displayed.length > 60) total++;
    }
  }
  console.log(`${total} facts with answers > 60 chars remaining`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const command = process.argv[2];
if (command === 'extract') {
  extract();
} else if (command === 'apply') {
  const file = process.argv[3];
  if (!file) {
    console.error('Usage: node scripts/shorten-long-answers.mjs apply <rewrites.json>');
    process.exit(1);
  }
  apply(file);
} else if (command === 'check') {
  check();
} else {
  console.log('Usage:');
  console.log('  node scripts/shorten-long-answers.mjs extract');
  console.log('  node scripts/shorten-long-answers.mjs apply <rewrites.json>');
  console.log('  node scripts/shorten-long-answers.mjs check');
}
