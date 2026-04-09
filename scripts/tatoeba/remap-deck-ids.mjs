#!/usr/bin/env node
// Remap fabricated `tatoeba:N` sourceRefs in grammar-deck JSON files against
// the real Tatoeba corpus.
//
// Strategy:
//   1. For each fact, reconstruct the target-language sentence by replacing
//      the {___} blank in `quizQuestion` with `correctAnswer`.
//   2. Normalize the reconstructed sentence (lowercase, strip punctuation
//      and whitespace) and look it up in a normalized corpus index.
//   3. On HIT: update `sourceRef` to the real Tatoeba ID.
//   4. On MISS: set `sourceRef` to "llm_authored" to preserve the fact
//      content while stopping the false Tatoeba citation.
//
// Usage:
//   node scripts/tatoeba/remap-deck-ids.mjs --lang spa --file data/decks/spanish_a2_grammar.json --dry-run
//   node scripts/tatoeba/remap-deck-ids.mjs --lang spa --glob 'data/decks/spanish_*_grammar.json'
//   node scripts/tatoeba/remap-deck-ids.mjs --lang spa --glob 'data/decks/_wip/b2_batch*.json' --write

import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CORPUS_DIR = join(ROOT, 'data', '_corpora', 'tatoeba');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}
const LANG = arg('lang', 'spa');
const FILE = arg('file', null);
const GLOB = arg('glob', null);
const WRITE = args.includes('--write');
const VERBOSE = args.includes('--verbose');

if (!FILE && !GLOB) {
  console.error('provide --file <path> or --glob <pattern>');
  process.exit(1);
}

// ---- normalize for lookup ----
// Goal: forgive punctuation, whitespace, case, and diacritic style mismatches
// while still matching substantive sentence content.
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // strip combining diacritics
    .replace(/[¿¡"'""''`´]/g, '')        // strip quote-ish punctuation
    .replace(/[.,;:!?—–\-()]/g, ' ')     // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- load corpus and build normalized index ----
console.log(`loading ${LANG} corpus ...`);
const pairsPath = join(CORPUS_DIR, `${LANG}_en_pairs.tsv`);
if (!existsSync(pairsPath)) {
  console.error(`missing ${pairsPath} — run build-cefr-corpus.mjs first`);
  process.exit(1);
}
const normIndex = new Map(); // normalized text -> id
{
  const raw = readFileSync(pairsPath, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('target_id\t')) continue;
    const [id, text] = line.split('\t');
    if (!id || !text) continue;
    const n = normalize(text);
    if (n && !normIndex.has(n)) normIndex.set(n, id);
  }
}
console.log(`  ${normIndex.size.toLocaleString()} unique normalized sentences indexed`);

// ---- reconstruct target sentence from a fact ----
function reconstructSentence(fact) {
  if (!fact.quizQuestion || !fact.correctAnswer) return null;
  // quizQuestion is typically "Spanish sentence with {___} blank.\n(English translation)"
  // Take only the part before the first newline.
  const line1 = fact.quizQuestion.split('\n')[0];
  // Replace {___} (and common variants like {N} or _____) with correctAnswer.
  return line1
    .replace(/\{_+\}/g, fact.correctAnswer)
    .replace(/\{[0-9]+\}/g, fact.correctAnswer)
    .replace(/_{3,}/g, fact.correctAnswer);
}

// ---- run ----
const files = FILE ? [FILE] : globSync(GLOB);
console.log(`processing ${files.length} file(s) — mode: ${WRITE ? 'WRITE' : 'dry-run'}`);

const totals = { facts: 0, refs: 0, hits: 0, remaps: 0, strips: 0, alreadyReal: 0 };

for (const path of files) {
  const raw = readFileSync(path, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.log(`  SKIP ${path} — JSON parse error: ${err.message}`);
    continue;
  }

  let fileFacts = 0;
  let fileRefs = 0;
  let fileHits = 0;
  let fileRemaps = 0;
  let fileStrips = 0;
  let fileAlreadyReal = 0;

  function walk(node) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== 'object') return;

    if (typeof node.sourceRef === 'string' && node.sourceRef.startsWith('tatoeba:')) {
      fileFacts++;
      fileRefs++;
      const oldId = node.sourceRef.slice(8);
      // If the existing id is real, no-op.
      // (We don't have the forward index here; instead, try reconstruction
      // and only remap if the reconstructed sentence matches something.)
      const sentence = reconstructSentence(node);
      if (!sentence) {
        // Can't reconstruct — strip to be safe.
        node.sourceRef = 'llm_authored';
        fileStrips++;
        return;
      }
      const norm = normalize(sentence);
      const realId = normIndex.get(norm);
      if (realId) {
        fileHits++;
        if (realId !== oldId) {
          if (VERBOSE) console.log(`    REMAP ${oldId} -> ${realId}  ${sentence}`);
          node.sourceRef = `tatoeba:${realId}`;
          fileRemaps++;
        } else {
          fileAlreadyReal++;
        }
      } else {
        // No corpus match — existing ID may or may not be real, but we
        // can't prove it. Strip if the ID isn't in the corpus.
        // (Cheap check: is oldId present as a key anywhere in the corpus?
        // We don't have id->text lookup here. The audit script already
        // told us A2/B1/B2 are 98%+ fabricated, so strip is the safe default.)
        node.sourceRef = 'llm_authored';
        fileStrips++;
      }
    }

    for (const v of Object.values(node)) walk(v);
  }
  walk(json);

  totals.facts += fileFacts;
  totals.refs += fileRefs;
  totals.hits += fileHits;
  totals.remaps += fileRemaps;
  totals.strips += fileStrips;
  totals.alreadyReal += fileAlreadyReal;

  const hitPct = fileRefs ? ((fileHits / fileRefs) * 100).toFixed(1) : 'n/a';
  console.log(
    `  ${path}: ${fileRefs} refs, ${fileHits} hits (${hitPct}%), ${fileRemaps} remapped, ${fileStrips} stripped`
  );

  if (WRITE && (fileRemaps > 0 || fileStrips > 0)) {
    writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  }
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`refs processed:     ${totals.refs}`);
console.log(`corpus hits:        ${totals.hits}  (${totals.refs ? ((totals.hits / totals.refs) * 100).toFixed(1) : 0}%)`);
console.log(`remapped to real:   ${totals.remaps}`);
console.log(`already-real no-op: ${totals.alreadyReal}`);
console.log(`stripped → llm_authored: ${totals.strips}`);
if (!WRITE) console.log('(dry-run — pass --write to persist changes)');
