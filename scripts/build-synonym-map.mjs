/**
 * build-synonym-map.mjs
 *
 * Pre-computes a synonym/related-words map from WordNet for all English
 * vocabulary answers found in the game's vocab seed files.
 *
 * WordNet data lives in node_modules/wordnet-db/dict (installed package).
 *
 * Output: src/data/generated/synonymMap.json
 *
 * Usage: node scripts/build-synonym-map.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const WORDNET_DIR = resolve(PROJECT, 'node_modules/wordnet-db/dict');
const SEED_DIR = resolve(PROJECT, 'src/data/seed');
const OUTPUT = resolve(PROJECT, 'src/data/generated/synonymMap.json');

// ---------------------------------------------------------------------------
// Step 1: Collect all unique single-word English answers from vocab seed files
// ---------------------------------------------------------------------------

/**
 * Reads all vocab-*.json seed files and collects unique English correct answers.
 * Multi-word answers and non-ASCII strings are excluded — WordNet only covers
 * single English words.
 */
function collectAnswers() {
  const answers = new Set();
  const files = readdirSync(SEED_DIR).filter(
    f => f.startsWith('vocab-') && f.endsWith('.json')
  );

  for (const file of files) {
    const data = JSON.parse(readFileSync(resolve(SEED_DIR, file), 'utf-8'));
    for (const fact of data) {
      const raw = fact.correct_answer || fact.correctAnswer;
      if (!raw) continue;

      const answer = raw.toLowerCase().trim();

      // Accept only pure single English words (letters + hyphens only)
      if (!answer || answer.includes(' ') || answer.length <= 1) continue;
      if (!/^[a-z][a-z'-]*[a-z]$/.test(answer) && !/^[a-z]$/.test(answer)) continue;

      answers.add(answer);
    }
  }

  return answers;
}

// ---------------------------------------------------------------------------
// Step 2: Parse WordNet index files
// ---------------------------------------------------------------------------

/**
 * Parses a WordNet index file (index.noun, index.verb, etc.) and returns a Map
 * from lemma → array of synset offsets (numbers).
 *
 * Index line format (after header comments that start with spaces):
 *   lemma pos synset_cnt p_cnt [ptr_symbol...] sense_cnt tagsense_cnt synset_offset...
 */
function parseIndex(posFile) {
  const content = readFileSync(resolve(WORDNET_DIR, posFile), 'utf-8');
  const index = new Map(); // lemma → number[]

  for (const line of content.split('\n')) {
    if (!line.trim() || line[0] === ' ') continue; // skip header lines

    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) continue;

    const lemma = parts[0].replace(/_/g, ' ');
    // parts[1] = pos, parts[2] = synset_cnt, parts[3] = p_cnt
    const synsetCount = parseInt(parts[2], 10);
    const ptrCount = parseInt(parts[3], 10);

    // After lemma, pos, synset_cnt, p_cnt, we skip ptrCount ptr_symbol entries,
    // then sense_cnt and tagsense_cnt, then synset_offsets start.
    const offsetStart = 4 + ptrCount + 2;

    const offsets = [];
    for (
      let i = offsetStart;
      i < parts.length && offsets.length < synsetCount;
      i++
    ) {
      const num = parseInt(parts[i], 10);
      if (!isNaN(num) && num > 0) offsets.push(num);
    }

    if (offsets.length > 0) {
      index.set(lemma, [...(index.get(lemma) || []), ...offsets]);
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Step 3: Parse WordNet data files
// ---------------------------------------------------------------------------

/**
 * Parses a WordNet data file (data.noun, data.verb, etc.) and returns a Map
 * from synset offset → synset object.
 *
 * Data line format (after header):
 *   synset_offset lex_filenum ss_type w_cnt word lex_id [word lex_id...] p_cnt [ptr...] | gloss
 *
 * Pointer format: ptr_symbol synset_offset pos source/target
 *   @ / @i = hypernym (parent/instance parent)
 *   ~ / ~i = hyponym (child/instance child)
 *
 * Note: w_cnt is hex.
 */
function parseDataFile(dataFile) {
  const content = readFileSync(resolve(WORDNET_DIR, dataFile), 'utf-8');
  const synsets = new Map(); // offset → SynsetEntry

  for (const line of content.split('\n')) {
    if (!line.trim() || line[0] === ' ') continue; // skip header lines

    const glossIdx = line.indexOf('|');
    const dataPart =
      glossIdx > 0 ? line.slice(0, glossIdx).trim() : line.trim();

    const parts = dataPart.split(/\s+/);
    if (parts.length < 5) continue;

    const offset = parseInt(parts[0], 10);
    // parts[1] = lex_filenum, parts[2] = ss_type
    const wordCount = parseInt(parts[3], 16); // w_cnt is hex!

    const words = [];
    let idx = 4;
    for (let i = 0; i < wordCount; i++) {
      if (idx >= parts.length) break;
      words.push(parts[idx].replace(/_/g, ' ').toLowerCase());
      idx += 2; // skip lex_id
    }

    if (idx >= parts.length) continue;
    const ptrCount = parseInt(parts[idx], 10);
    idx++;

    const hypernyms = []; // @ and @i pointers
    const hyponyms = []; // ~ and ~i pointers

    for (let i = 0; i < ptrCount; i++) {
      if (idx + 3 >= parts.length) break;
      const ptrSymbol = parts[idx];
      const ptrOffset = parseInt(parts[idx + 1], 10);
      // parts[idx+2] = pos, parts[idx+3] = source/target
      idx += 4;

      if (ptrSymbol === '@' || ptrSymbol === '@i') hypernyms.push(ptrOffset);
      if (ptrSymbol === '~' || ptrSymbol === '~i') hyponyms.push(ptrOffset);
    }

    synsets.set(offset, { words, hypernyms, hyponyms });
  }

  return synsets;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('=== Recall Rogue — WordNet Synonym Map Builder ===\n');

// Collect answers
const answers = collectAnswers();
console.log(`Collected ${answers.size} unique single-word English answers from vocab seed files`);

// Parse all POS index and data files
const allIndex = new Map(); // lemma → number[]
const allData = new Map(); // offset → SynsetEntry

const posPairs = [
  ['index.noun', 'data.noun'],
  ['index.verb', 'data.verb'],
  ['index.adj', 'data.adj'],
  ['index.adv', 'data.adv'],
];

for (const [indexFile, dataFile] of posPairs) {
  process.stdout.write(`  Parsing ${indexFile} + ${dataFile}...`);
  const idx = parseIndex(indexFile);
  const dat = parseDataFile(dataFile);

  for (const [word, offsets] of idx) {
    allIndex.set(word, [...(allIndex.get(word) || []), ...offsets]);
  }
  for (const [offset, synset] of dat) {
    allData.set(offset, synset);
  }

  console.log(` ${idx.size} entries, ${dat.size} synsets`);
}

console.log(
  `\nWordNet totals: ${allIndex.size} lemma entries, ${allData.size} synsets\n`
);

// Build synonym map
const synonymMap = {};
let covered = 0;
let noEntry = 0;
let entryButEmpty = 0;

for (const answer of answers) {
  const offsets = allIndex.get(answer);
  if (!offsets || offsets.length === 0) {
    noEntry++;
    continue;
  }

  const synonyms = new Set();
  const related = new Set();

  for (const offset of offsets) {
    const synset = allData.get(offset);
    if (!synset) continue;

    // Synonyms: other words in the same synset (share the exact sense)
    for (const w of synset.words) {
      if (w !== answer) synonyms.add(w);
    }

    // Related: navigate up to hypernym, then collect sibling hyponyms
    // (words in the same category but distinct meaning)
    for (const hyperOffset of synset.hypernyms) {
      const hyperSynset = allData.get(hyperOffset);
      if (!hyperSynset) continue;

      for (const hypoOffset of hyperSynset.hyponyms) {
        if (hypoOffset === offset) continue; // skip the answer's own synset

        const hypoSynset = allData.get(hypoOffset);
        if (!hypoSynset) continue;

        for (const w of hypoSynset.words) {
          if (w !== answer && !synonyms.has(w)) {
            related.add(w);
          }
        }
      }
    }
  }

  if (synonyms.size === 0 && related.size === 0) {
    entryButEmpty++;
    continue;
  }

  synonymMap[answer] = {
    synonyms: [...synonyms].slice(0, 5),
    related: [...related].slice(0, 10),
  };
  covered++;
}

// Ensure output directory exists
mkdirSync(resolve(PROJECT, 'src/data/generated'), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(synonymMap, null, 2));

// Stats
const totalWords = answers.size;
const outputBytes = Buffer.byteLength(JSON.stringify(synonymMap));

console.log('Synonym map built:');
console.log(
  `  Words with synonym/related data: ${covered} / ${totalWords} (${((covered / totalWords) * 100).toFixed(1)}%)`
);
console.log(`  Words with no WordNet entry:     ${noEntry}`);
console.log(
  `  Words with entry but no data:   ${entryButEmpty}`
);
console.log(`  Output file size:                ${(outputBytes / 1024).toFixed(1)} KB`);
console.log(`  Output path:                     ${OUTPUT}`);

// Print sample entries
console.log('\nSample entries:');
const samples = Object.entries(synonymMap)
  .filter(([, v]) => v.synonyms.length > 0 && v.related.length > 0)
  .slice(0, 8);
for (const [word, data] of samples) {
  console.log(`  "${word}":`);
  console.log(`    synonyms: [${data.synonyms.join(', ')}]`);
  console.log(`    related:  [${data.related.slice(0, 5).join(', ')}${data.related.length > 5 ? ', ...' : ''}]`);
}
