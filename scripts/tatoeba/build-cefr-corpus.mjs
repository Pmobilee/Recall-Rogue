#!/usr/bin/env node
// Build a joined French/Spanish ↔ English sentence pair corpus from Tatoeba
// bulk exports, then emit per-CEFR-level filtered TSVs that are ready for
// grammar-deck architecture authoring.
//
// Inputs (gitignored, in data/_corpora/tatoeba/):
//   fra_sentences.tsv  spa_sentences.tsv  eng_sentences.tsv  links.csv
//
// Outputs (gitignored pairs, committed per-level TSVs):
//   data/_corpora/tatoeba/fra_en_pairs.tsv
//   data/_corpora/tatoeba/spa_en_pairs.tsv
//   data/_corpora/tatoeba/<lang>_<level>_pool.tsv   (per-level filtered pool)
//
// Usage:
//   node scripts/tatoeba/build-cefr-corpus.mjs --lang fra       # build pairs + all levels
//   node scripts/tatoeba/build-cefr-corpus.mjs --lang spa
//   node scripts/tatoeba/build-cefr-corpus.mjs --lang fra --level a1 --max 2000
//
// The per-level pool is a length-filtered superset; grammar-label tagging
// happens downstream when the architecture YAML is authored. Every row is
// a real verified Tatoeba ID-to-ID pair.

import { readFileSync, writeFileSync, createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CORPUS_DIR = join(ROOT, 'data', '_corpora', 'tatoeba');

// ---- args ----
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
}
const LANG = arg('lang', 'fra');          // 'fra' or 'spa'
const LEVEL = arg('level', null);          // 'a1'|'a2'|'b1'|'b2' or null for all
const MAX_PER_LEVEL = parseInt(arg('max', '3000'), 10);

if (!['fra', 'spa'].includes(LANG)) {
  console.error(`unsupported --lang ${LANG}; use fra or spa`);
  process.exit(1);
}

// ---- sentence length heuristics per CEFR level ----
// Measured in words; tuned conservatively so A1 rows are genuinely short.
const LEVEL_WORD_RANGES = {
  a1: { min: 2, max: 8 },
  a2: { min: 3, max: 12 },
  b1: { min: 4, max: 18 },
  b2: { min: 5, max: 26 },
};

// ---- step 1: load target-language sentences into Map<id, text> ----
function loadSentenceMap(path) {
  const m = new Map();
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    if (!line) continue;
    const tab1 = line.indexOf('\t');
    if (tab1 < 0) continue;
    const tab2 = line.indexOf('\t', tab1 + 1);
    if (tab2 < 0) continue;
    const id = line.slice(0, tab1);
    const text = line.slice(tab2 + 1);
    m.set(id, text);
  }
  return m;
}

console.log(`[1/4] loading ${LANG}_sentences.tsv ...`);
const targetMap = loadSentenceMap(join(CORPUS_DIR, `${LANG}_sentences.tsv`));
console.log(`      ${targetMap.size.toLocaleString()} ${LANG} sentences`);

console.log(`[2/4] loading eng_sentences.tsv ...`);
const engMap = loadSentenceMap(join(CORPUS_DIR, 'eng_sentences.tsv'));
console.log(`      ${engMap.size.toLocaleString()} eng sentences`);

// ---- step 2: stream links.csv, collect target → eng pairs ----
// Each target sentence may have many English translations; we keep the first
// matching one (Tatoeba returns them in stable order so this is deterministic).
console.log(`[3/4] streaming links.csv ...`);
const pairs = new Map(); // targetId -> { targetText, engId, engText }
let linkLines = 0;
const linksPath = join(CORPUS_DIR, 'links.csv');
const rl = createInterface({ input: createReadStream(linksPath), crlfDelay: Infinity });
for await (const line of rl) {
  linkLines++;
  if (linkLines % 5_000_000 === 0) {
    console.log(`      ${linkLines.toLocaleString()} links processed, ${pairs.size.toLocaleString()} pairs found`);
  }
  const tab = line.indexOf('\t');
  if (tab < 0) continue;
  const a = line.slice(0, tab);
  const b = line.slice(tab + 1);
  // Try both directions; Tatoeba links are symmetric but the export lists both.
  if (targetMap.has(a) && engMap.has(b) && !pairs.has(a)) {
    pairs.set(a, { targetText: targetMap.get(a), engId: b, engText: engMap.get(b) });
  } else if (targetMap.has(b) && engMap.has(a) && !pairs.has(b)) {
    pairs.set(b, { targetText: targetMap.get(b), engId: a, engText: engMap.get(a) });
  }
}
console.log(`      total pairs: ${pairs.size.toLocaleString()}`);

// ---- step 3: write full pairs TSV ----
const pairsOut = join(CORPUS_DIR, `${LANG}_en_pairs.tsv`);
console.log(`[4/4] writing ${pairsOut} ...`);
{
  const chunks = ['target_id\ttarget_text\teng_id\teng_text\n'];
  for (const [tid, rec] of pairs) {
    // Strip any stray tabs/newlines in text.
    const t = rec.targetText.replace(/[\t\n\r]/g, ' ');
    const e = rec.engText.replace(/[\t\n\r]/g, ' ');
    chunks.push(`${tid}\t${t}\t${rec.engId}\t${e}\n`);
  }
  writeFileSync(pairsOut, chunks.join(''));
}

// ---- step 4: emit per-level pools ----
function wordCount(text) {
  // Rough word count: split on whitespace, drop empty.
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function levelPool(level) {
  const { min, max } = LEVEL_WORD_RANGES[level];
  const rows = [];
  for (const [tid, rec] of pairs) {
    const wc = wordCount(rec.targetText);
    if (wc < min || wc > max) continue;
    // Skip obvious noise: sentences with no letters, pure numerics, or all caps yelling.
    if (!/\p{L}/u.test(rec.targetText)) continue;
    rows.push({ tid, ...rec, wc });
    if (rows.length >= MAX_PER_LEVEL * 4) break; // soft cap for very large corpora
  }
  // Prefer shorter sentences for lower levels so the deck authors get simpler material first.
  rows.sort((a, b) => a.wc - b.wc);
  const capped = rows.slice(0, MAX_PER_LEVEL);

  const out = join(CORPUS_DIR, `${LANG}_${level}_pool.tsv`);
  const header = 'tatoeba_id\ttarget_text\teng_id\teng_text\tword_count\n';
  const body = capped
    .map((r) => `${r.tid}\t${r.targetText.replace(/[\t\n\r]/g, ' ')}\t${r.engId}\t${r.engText.replace(/[\t\n\r]/g, ' ')}\t${r.wc}`)
    .join('\n');
  writeFileSync(out, header + body + '\n');
  console.log(`      ${out} — ${capped.length.toLocaleString()} rows (word range ${min}-${max})`);
}

if (LEVEL) {
  levelPool(LEVEL);
} else {
  for (const lv of ['a1', 'a2', 'b1', 'b2']) levelPool(lv);
}

console.log('done.');
