#!/usr/bin/env node
/**
 * Strip tactic type hints from chess_tactics.json quizQuestion fields.
 *
 * Before: "Black to move. Find the fork. [#4172G]"
 * After:  "Black to move. [#4172G]"
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckPath = join(__dirname, '../data/decks/chess_tactics.json');

const deck = JSON.parse(readFileSync(deckPath, 'utf8'));

let changed = 0;
let unchanged = 0;

for (const fact of deck.facts) {
  const original = fact.quizQuestion;

  // Extract color (first word: "Black" or "White")
  const colorMatch = original.match(/^(Black|White) to move\./);
  if (!colorMatch) {
    console.warn(`UNEXPECTED format for ${fact.id}: ${original}`);
    unchanged++;
    continue;
  }
  const color = colorMatch[1];

  // Extract puzzle ID tag
  const idMatch = original.match(/\[#([^\]]+)\]/);
  if (!idMatch) {
    console.warn(`No puzzle ID found for ${fact.id}: ${original}`);
    unchanged++;
    continue;
  }
  const puzzleId = idMatch[1];

  const newQuestion = `${color} to move. [#${puzzleId}]`;

  if (newQuestion !== original) {
    fact.quizQuestion = newQuestion;
    changed++;
  } else {
    unchanged++;
  }
}

writeFileSync(deckPath, JSON.stringify(deck, null, 2), 'utf8');

console.log(`Done. Changed: ${changed}, Unchanged: ${unchanged}, Total: ${deck.facts.length}`);
