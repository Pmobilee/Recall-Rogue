#!/usr/bin/env node
/**
 * assemble-c1-deck.mjs
 *
 * Builds data/decks/spanish_c1.json — CEFR C1 Spanish vocabulary deck.
 *
 * Strategy:
 *  1. Parse ELELex.tsv — collect words where level_freq@c1 > FREQ_THRESHOLD
 *     AND none of a1/a2/b1/b2 exceed FREQ_THRESHOLD (pure C1 words).
 *     Also collect words where c1 is the dominant level (highest freq) for
 *     broader coverage if strict pool is < 1200.
 *  2. Load all existing A1/A2/B1/B2 Spanish vocab decks — build dedup set.
 *  3. Filter out any word already in A1-B2.
 *  4. Load Kaikki en-es-wikt.jsonl.gz — build word → English translation map.
 *  5. For each C1 word, look up English translation.
 *  6. Build fact objects following spanish_b2.json schema exactly.
 *  7. Write data/decks/spanish_c1.json.
 *
 * Output IDs: es-cefr-3980, es-cefr-3981, ... (B2 ends at es-cefr-3979)
 *
 * NOTE: Uses no external npm dependencies — only Node.js built-ins.
 */

import { createReadStream, readFileSync, writeFileSync, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FREQ_THRESHOLD = 8.5;
const ID_START = 3980; // B2 ends at 3979
const MAX_FACTS = 1500;
const MIN_FACTS = 1200;

const ELELEX_PATH = join(REPO_ROOT, 'data/references/cefrlex/ELELex.tsv');
const KAIKKI_PATH = join(REPO_ROOT, 'data/references/kaikki/en-es-wikt.jsonl.gz');
const RESEARCH_DIR = join(REPO_ROOT, 'data/deck-architectures/_research/spanish');
const SOURCE_CACHE = join(RESEARCH_DIR, 'c1_vocab_source.tsv');
const OUTPUT_DECK = join(REPO_ROOT, 'data/decks/spanish_c1.json');

const EXISTING_DECK_PATHS = [
  join(REPO_ROOT, 'data/decks/spanish_a1.json'),
  join(REPO_ROOT, 'data/decks/spanish_a2.json'),
  join(REPO_ROOT, 'data/decks/spanish_b1.json'),
  join(REPO_ROOT, 'data/decks/spanish_b2.json'),
];

// POS tag → partOfSpeech mapping (ELELex uses Spanish grammatical tags)
const POS_MAP = {
  'NCM': 'noun', 'NCF': 'noun', 'NCMS': 'noun', 'NCFS': 'noun',
  'NCMP': 'noun', 'NCFP': 'noun', 'NCS': 'noun', 'NCP': 'noun', 'NC': 'noun',
  'NP': 'noun',
  'VM': 'verb', 'VMN': 'verb', 'VMP': 'verb', 'VS': 'verb',
  'AQ': 'adjective', 'AQ0': 'adjective', 'AO': 'adjective', 'AQS': 'adjective',
  'RG': 'adverb', 'RN': 'adverb',
  'SP': 'preposition',
  'CC': 'conjunction', 'CS': 'conjunction',
  'DT': 'determiner',
  'PD': 'pronoun', 'PP': 'pronoun', 'PI': 'pronoun', 'PR': 'pronoun', 'PT': 'pronoun',
};

function mapPos(tag) {
  if (!tag) return 'other';
  if (POS_MAP[tag]) return POS_MAP[tag];
  for (const [prefix, pos] of Object.entries(POS_MAP)) {
    if (tag.startsWith(prefix)) return pos;
  }
  return 'other';
}

// Answer cleaning
function cleanAnswer(raw) {
  let s = raw.trim();
  s = s.replace(/^\((?:formal|informal|archaic|dialectal?|literary|dated|figurative|colloquial|regional|old|rare|obsolete|transitive|intransitive|also|chiefly)\)\s*/i, '');
  s = s.replace(/\s*\([^)]*also pr\.[^)]*\)/g, '');
  s = s.replace(/\s*[;,]?\s*also pr\..+$/, '');
  s = s.replace(/\s*[;,]?\s*also written.+$/, '');
  s = s.trim();

  if (s.length > 25) {
    const seps = [];
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if ((s[i] === ',' || s[i] === ';') && depth === 0) seps.push(i);
    }
    const early = seps.filter(p => p <= 24);
    if (early.length > 0) {
      s = s.slice(0, early[early.length - 1]);
    } else if (seps.length > 0) {
      s = s.slice(0, seps[0]);
    } else if (s.length > 60) {
      s = s.slice(0, 60).replace(/\s+\S+$/, '');
    }
  }

  s = s.replace(/\s*[;,]?\s*etc\.?$/, '');
  s = s.replace(/[\s;,]+$/, '').trim();
  return s;
}

const BAD_PREFIXES = [
  'plural of', 'form of', 'variant of', 'alternative form',
  'see ', 'abbr', 'clipping of', 'eye dialect', 'obsolete',
  'inflection of', 'second-person', 'first-person', 'third-person',
  'past tense', 'present tense',
];

function isBadAnswer(answer) {
  const low = answer.toLowerCase();
  return BAD_PREFIXES.some(p => low.startsWith(p));
}

// ---------------------------------------------------------------------------
// TSV parser — handles quoted fields with embedded quotes
// ---------------------------------------------------------------------------

function parseTsvRow(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === '\t' && !inQuote) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// ---------------------------------------------------------------------------
// Step 1: Parse ELELex — collect C1 candidates
// ---------------------------------------------------------------------------

console.log('Step 1: Parsing ELELex.tsv for C1 words...');

const elelexLines = readFileSync(ELELEX_PATH, 'utf-8').split('\n');
const headerLine = elelexLines[0];
const headers = parseTsvRow(headerLine);
const colIdx = {};
for (let i = 0; i < headers.length; i++) {
  colIdx[headers[i]] = i;
}

const getCol = (fields, name) => {
  const idx = colIdx[name];
  if (idx === undefined) return '';
  return (fields[idx] || '').trim();
};

const parseFreq = (fields, name) => {
  const raw = getCol(fields, name);
  const v = parseFloat(raw);
  return isNaN(v) ? 0 : v;
};

// Collect ALL words where c1 > FREQ_THRESHOLD (any CEFR level presence).
// Dedup against A1-B2 decks happens in Step 2.
// Sort by c1_freq descending — most C1-characteristic words first.
const c1Candidates = new Map(); // word -> { tag, c1_freq }
const seenWords = new Set();

for (let lineNum = 1; lineNum < elelexLines.length; lineNum++) {
  const line = elelexLines[lineNum].trim();
  if (!line) continue;

  const fields = parseTsvRow(line);
  const word = getCol(fields, 'word');
  if (!word || word.length < 2) continue;
  if (seenWords.has(word)) continue;
  seenWords.add(word);

  const tag = getCol(fields, 'tag');
  const c1 = parseFreq(fields, 'level_freq@c1');

  if (c1 > FREQ_THRESHOLD) {
    c1Candidates.set(word, { tag, c1_freq: c1 });
  }
}

console.log(`  All words with c1 > threshold: ${c1Candidates.size}`);

// Sort by c1_freq descending
const sortedC1 = Array.from(c1Candidates.entries())
  .sort((a, b) => b[1].c1_freq - a[1].c1_freq);

console.log(`  Top 5 C1 candidates: ${sortedC1.slice(0, 5).map(([w]) => w).join(', ')}`);

// ---------------------------------------------------------------------------
// Step 2: Load existing A1-B2 decks — build dedup set
// ---------------------------------------------------------------------------

console.log('\nStep 2: Loading existing A1-B2 decks for deduplication...');

const existingWords = new Set();
for (const deckPath of EXISTING_DECK_PATHS) {
  if (!existsSync(deckPath)) {
    console.warn(`  WARN: Not found: ${deckPath}`);
    continue;
  }
  const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
  let count = 0;
  for (const fact of (deck.facts || [])) {
    const w = fact.targetLanguageWord || '';
    if (w) { existingWords.add(w); count++; }
  }
  console.log(`  ${deckPath.split('/').pop()}: ${count} words`);
}
console.log(`  Total A1-B2 words in dedup set: ${existingWords.size}`);

const filteredC1 = sortedC1.filter(([word]) => !existingWords.has(word));
const dedupDropped = sortedC1.length - filteredC1.length;
console.log(`  Dropped (already in A1-B2): ${dedupDropped}`);
console.log(`  Remaining C1 candidates after dedup: ${filteredC1.length}`);

// ---------------------------------------------------------------------------
// Step 3: Load Kaikki en-es translations
// ---------------------------------------------------------------------------

console.log('\nStep 3: Loading Kaikki en-es-wikt translations...');

const transMap = new Map(); // word -> { gloss, pos }

await new Promise((resolve, reject) => {
  const gunzip = createGunzip();
  const stream = createReadStream(KAIKKI_PATH);
  const rl = createInterface({ input: stream.pipe(gunzip) });

  rl.on('line', (line) => {
    try {
      const obj = JSON.parse(line);
      const word = obj.word || '';
      const pos = obj.pos || '';
      const senses = obj.senses || [];

      for (const sense of senses) {
        const glosses = sense.glosses || [];
        if (!glosses.length) continue;
        const gloss = glosses[0].trim();
        if (isBadAnswer(gloss)) continue;
        if (gloss.length < 2) continue;

        if (!transMap.has(word)) {
          transMap.set(word, { gloss, pos });
        } else if (gloss.length < transMap.get(word).gloss.length) {
          transMap.set(word, { gloss, pos });
        }
        break;
      }
    } catch (_) {}
  });

  rl.on('close', resolve);
  rl.on('error', reject);
});

console.log(`  Kaikki translations loaded: ${transMap.size} unique words`);

// ---------------------------------------------------------------------------
// Step 4: Build facts
// ---------------------------------------------------------------------------

console.log('\nStep 4: Building facts...');

const facts = [];
let factIdx = ID_START;
let noTranslation = 0;
let badTranslation = 0;
const posBreakdown = {};

const candidates = filteredC1.slice(0, MAX_FACTS + 500);

for (const [word, { tag, c1_freq }] of candidates) {
  if (facts.length >= MAX_FACTS) break;

  const trans = transMap.get(word);
  if (!trans) { noTranslation++; continue; }

  const answer = cleanAnswer(trans.gloss);
  if (!answer || isBadAnswer(answer)) { badTranslation++; continue; }

  const pos = mapPos(tag) !== 'other' ? mapPos(tag) : (trans.pos || 'other');
  posBreakdown[pos] = (posBreakdown[pos] || 0) + 1;

  const difficulty = 4;
  const funScore = answer.length < 12 ? 7 : answer.length < 25 ? 6 : 5;
  const chainThemeId = facts.length % 6;
  const factId = `es-cefr-${factIdx++}`;

  facts.push({
    id: factId,
    correctAnswer: answer,
    acceptableAlternatives: [],
    chainThemeId,
    answerTypePoolId: 'english_meanings',
    difficulty,
    funScore,
    quizQuestion: `What does "${word}" mean?`,
    explanation: `${word} — ${answer}.`,
    visualDescription: '',
    sourceName: 'CEFRLex ELELex + Kaikki.org',
    sourceUrl: 'https://cental.uclouvain.be/cefrlex/',
    volatile: false,
    distractors: [],
    targetLanguageWord: word,
    language: 'es',
    partOfSpeech: pos,
  });
}

console.log(`  Facts built: ${facts.length}`);
console.log(`  Skipped (no translation): ${noTranslation}`);
console.log(`  Skipped (bad translation): ${badTranslation}`);
console.log('  POS breakdown:', posBreakdown);

if (facts.length < MIN_FACTS) {
  console.error(`  ERROR: Only ${facts.length} facts built, need at least ${MIN_FACTS}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 5: Assign pools — all facts in english_meanings; every 5th also in
//         target_language_words for reverse quiz
// ---------------------------------------------------------------------------

const allFactIds = facts.map(f => f.id);
const reverseFactIds = facts.filter((_, i) => i % 5 === 0).map(f => f.id);

console.log(`\nStep 5: Pools — english_meanings: ${allFactIds.length}, target_language_words: ${reverseFactIds.length}`);

const answerTypePools = [
  { id: 'english_meanings', label: 'English Meanings', answerFormat: 'word', factIds: allFactIds },
  { id: 'target_language_words', label: 'Spanish Words', answerFormat: 'word', factIds: reverseFactIds },
];

// ---------------------------------------------------------------------------
// Step 6: Synonym groups
// ---------------------------------------------------------------------------

console.log('\nStep 6: Building synonym groups...');
const answerToFactIds = new Map();
for (const fact of facts) {
  const key = fact.correctAnswer;
  if (!answerToFactIds.has(key)) answerToFactIds.set(key, []);
  answerToFactIds.get(key).push(fact.id);
}

const synonymGroups = [];
let synIdx = 0;
for (const [answer, ids] of answerToFactIds) {
  if (ids.length > 1) {
    synonymGroups.push({
      id: `syn_${synIdx++}`,
      factIds: ids,
      reason: `acceptableAlternatives overlap (same answer: '${answer}')`,
    });
  }
}
console.log(`  Synonym groups: ${synonymGroups.length}`);

// ---------------------------------------------------------------------------
// Step 7: Difficulty tiers (all C1 = hard)
// ---------------------------------------------------------------------------

const difficultyTiers = [
  { tier: 'easy', factIds: [] },
  { tier: 'medium', factIds: [] },
  { tier: 'hard', factIds: allFactIds },
];

// ---------------------------------------------------------------------------
// Step 8: Write source cache TSV
// ---------------------------------------------------------------------------

console.log('\nStep 8: Writing source cache TSV...');
const tsvLines = ['word\tpartOfSpeech\tEnglish\tsource_url'];
for (const fact of facts) {
  tsvLines.push(`${fact.targetLanguageWord}\t${fact.partOfSpeech}\t${fact.correctAnswer}\thttps://cental.uclouvain.be/cefrlex/ + https://kaikki.org`);
}
writeFileSync(SOURCE_CACHE, tsvLines.join('\n') + '\n', 'utf-8');
console.log(`  Wrote: ${SOURCE_CACHE}`);

// ---------------------------------------------------------------------------
// Step 9: Assemble and write deck
// ---------------------------------------------------------------------------

console.log('\nStep 9: Assembling deck...');

const deck = {
  id: 'spanish_c1',
  name: 'Spanish C1 Vocabulary',
  domain: 'vocabulary',
  subDomain: 'spanish',
  description: 'Advanced Spanish — CEFR C1 level vocabulary for near-fluent learners',
  minimumFacts: 30,
  targetFacts: facts.length,
  facts,
  answerTypePools,
  synonymGroups,
  difficultyTiers,
  questionTemplates: [
    {
      id: 'forward',
      answerPoolId: 'english_meanings',
      questionFormat: "What does '{targetLanguageWord}' mean?",
      availableFromMastery: 0,
      difficulty: 1,
      reverseCapable: false,
    },
    {
      id: 'reverse',
      answerPoolId: 'target_language_words',
      questionFormat: "How do you say '{correctAnswer}' in {language}?",
      availableFromMastery: 2,
      difficulty: 3,
      reverseCapable: false,
    },
    {
      id: 'synonym_pick',
      answerPoolId: 'english_meanings',
      questionFormat: "Which word is closest in meaning to '{targetLanguageWord}'?",
      availableFromMastery: 3,
      difficulty: 4,
      reverseCapable: false,
    },
    {
      id: 'definition_match',
      answerPoolId: 'english_meanings',
      questionFormat: '{explanation}',
      availableFromMastery: 3,
      difficulty: 4,
      reverseCapable: false,
    },
  ],
};

writeFileSync(OUTPUT_DECK, JSON.stringify(deck, null, 2), 'utf-8');
console.log(`\nWrote: ${OUTPUT_DECK}`);
console.log(`Total facts: ${facts.length}`);
console.log(`ID range: es-cefr-${ID_START} to es-cefr-${factIdx - 1}`);
console.log('\nPOS breakdown:');
for (const [pos, count] of Object.entries(posBreakdown).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pos}: ${count}`);
}
console.log('\nDone.');
