#!/usr/bin/env node
// Repair a research TSV (data/deck-architectures/_research/<lang>/tatoeba_*.tsv)
// by:
//   1. Verifying each tatoeba_id against the real corpus.
//   2. For invalid IDs, looking up the row's sentence in the corpus by
//      normalized text and substituting the real ID if found.
//   3. Dropping rows whose sentence is not in the corpus (honest miss).
//   4. Deduplicating: each normalized sentence appears at most once across
//      all grammar labels (keep first occurrence).
//
// Usage:
//   node scripts/tatoeba/fix-research-tsv.mjs --lang fra --file data/deck-architectures/_research/french/tatoeba_a1_sentences.tsv

import { readFileSync, writeFileSync } from 'node:fs';
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
if (!FILE) {
  console.error('provide --file <path>');
  process.exit(1);
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿¡"'""''`´]/g, '')
    .replace(/[.,;:!?—–\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build two indices from the pairs corpus: id -> text, normalized text -> id
console.log(`loading ${LANG}_en_pairs.tsv ...`);
const idToText = new Map();
const normToId = new Map();
{
  const raw = readFileSync(join(CORPUS_DIR, `${LANG}_en_pairs.tsv`), 'utf8');
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('target_id\t')) continue;
    const cols = line.split('\t');
    if (cols.length < 2) continue;
    const id = cols[0];
    const text = cols[1];
    idToText.set(id, text);
    const n = normalize(text);
    if (n && !normToId.has(n)) normToId.set(n, { id, text });
  }
}
console.log(`  ${idToText.size.toLocaleString()} ids, ${normToId.size.toLocaleString()} unique sentences`);

// Process the research TSV
const raw = readFileSync(FILE, 'utf8');
const lines = raw.split('\n').filter((l) => l.length > 0);
const header = lines[0];
const body = lines.slice(1);

const kept = [];
const seenNorms = new Set();
let fixed = 0;
let dropped = 0;
let deduped = 0;
let ok = 0;
for (const line of body) {
  const cols = line.split('\t');
  if (cols.length < 5) continue;
  let [id, label, text, engText, lic] = cols;
  const norm = normalize(text);
  const realId = idToText.has(id) ? id : normToId.get(norm)?.id;
  if (!realId) {
    console.log(`  DROP (no corpus match) ${id}\t${text}`);
    dropped++;
    continue;
  }
  if (realId !== id) {
    console.log(`  FIX  ${id} -> ${realId}\t${text}`);
    fixed++;
  } else {
    ok++;
  }
  if (seenNorms.has(norm)) {
    console.log(`  DEDUPE ${realId}\t${text}  (already appears under another label)`);
    deduped++;
    continue;
  }
  seenNorms.add(norm);
  // Refresh French text + English text from the corpus to normalize punctuation
  // differences, while preserving the grammar_label the author picked.
  const corpusText = idToText.get(realId);
  kept.push(`${realId}\t${label}\t${corpusText}\t${engText}\t${lic}`);
}

const out = [header, ...kept].join('\n') + '\n';
writeFileSync(FILE, out);

console.log('');
console.log('=== SUMMARY ===');
console.log(`input rows:      ${body.length}`);
console.log(`kept:            ${kept.length}`);
console.log(`ids ok:          ${ok}`);
console.log(`ids fixed:       ${fixed}`);
console.log(`deduped:         ${deduped}`);
console.log(`dropped:         ${dropped}`);
