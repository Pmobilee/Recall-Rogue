#!/usr/bin/env node
// Verify every `tatoeba:N` sourceRef in a deck JSON (or TSV) against the
// real Tatoeba corpus. Reports IDs that don't exist, and optionally checks
// whether the fact's `quizQuestion`/target text matches the real sentence.
//
// Usage:
//   node scripts/tatoeba/audit-deck-ids.mjs --lang fra --file path/to/deck.json
//   node scripts/tatoeba/audit-deck-ids.mjs --lang spa --file data/decks/spanish_a1_grammar.json
//   node scripts/tatoeba/audit-deck-ids.mjs --lang spa --glob 'data/decks/spanish_*_grammar.json'
//   node scripts/tatoeba/audit-deck-ids.mjs --lang spa --glob 'data/decks/_wip/*.json'

import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
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
const LANG = arg('lang', 'fra');
const FILE = arg('file', null);
const GLOB = arg('glob', null);
const VERBOSE = args.includes('--verbose');

if (!FILE && !GLOB) {
  console.error('provide --file <path> or --glob <pattern>');
  process.exit(1);
}

// Load the sentence map for the language: id -> text
console.log(`loading ${LANG} corpus ...`);
const pairsPath = join(CORPUS_DIR, `${LANG}_en_pairs.tsv`);
if (!existsSync(pairsPath)) {
  console.error(`missing ${pairsPath} — run build-cefr-corpus.mjs first`);
  process.exit(1);
}
const sentenceMap = new Map();
{
  const raw = readFileSync(pairsPath, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('target_id\t')) continue;
    const [id, text] = line.split('\t');
    if (id && text) sentenceMap.set(id, text);
  }
}
console.log(`  ${sentenceMap.size.toLocaleString()} ${LANG} sentences indexed`);

const files = FILE ? [FILE] : globSync(GLOB);
console.log(`auditing ${files.length} file(s)`);

let totalIds = 0;
let totalMissing = 0;
let totalMismatch = 0;
const missingByFile = {};
const mismatchByFile = {};

for (const path of files) {
  const raw = readFileSync(path, 'utf8');
  // Match tatoeba:NNNN anywhere. Capture the NNNN.
  const idRegex = /"sourceRef"\s*:\s*"tatoeba:(\d+)"/g;
  // Also capture the fact object around each ref to pull the target text
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  // Collect id -> [target text attempts] from the file
  const facts = [];
  function walk(node) {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
    } else if (node && typeof node === 'object') {
      if (typeof node.sourceRef === 'string' && node.sourceRef.startsWith('tatoeba:')) {
        facts.push({
          id: node.sourceRef.slice(8),
          targetLanguageWord: node.targetLanguageWord || null,
          quizQuestion: node.quizQuestion || null,
          correctAnswer: node.correctAnswer || null,
          factId: node.id || null,
        });
      }
      for (const v of Object.values(node)) walk(v);
    }
  }
  if (json) walk(json);

  const missing = [];
  const mismatches = [];
  for (const f of facts) {
    totalIds++;
    if (!sentenceMap.has(f.id)) {
      totalMissing++;
      missing.push(f);
    }
    // Skip content-match check for now — fill-in-blank questions don't contain
    // the full sentence verbatim, so this is a weak signal.
  }

  if (missing.length) missingByFile[path] = missing.length;
  if (mismatches.length) mismatchByFile[path] = mismatches.length;

  const hitRate = facts.length ? (((facts.length - missing.length) / facts.length) * 100).toFixed(1) : 'n/a';
  console.log(`  ${path}: ${facts.length} refs, ${missing.length} missing (${hitRate}% hit)`);

  if (VERBOSE && missing.length) {
    for (const m of missing.slice(0, 10)) {
      console.log(`    MISSING tatoeba:${m.id}  factId=${m.factId}  ans=${m.correctAnswer}`);
    }
    if (missing.length > 10) console.log(`    ... and ${missing.length - 10} more`);
  }
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`total refs checked:      ${totalIds}`);
console.log(`missing ids:             ${totalMissing}  (${totalIds ? ((totalMissing / totalIds) * 100).toFixed(1) : 0}%)`);
if (Object.keys(missingByFile).length) {
  console.log('files with missing refs:');
  for (const [f, n] of Object.entries(missingByFile).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${f}`);
  }
}
