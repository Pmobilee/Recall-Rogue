#!/usr/bin/env node
/**
 * build-hangul-facts.mjs
 *
 * Programmatically generates Korean Hangul quiz facts.
 * No LLM needed — Hangul is a finite, well-defined character set.
 *
 * Generates 2 facts per character:
 *   1. Hangul → Romanization ("What sound does ㄱ represent?" → "g/k")
 *   2. Romanization → Hangul ("Which Hangul character represents 'g/k'?" → "ㄱ")
 *
 * Pre-generates 8 distractors per fact using smart selection:
 *   - Same category (consonants with consonants, vowels with vowels)
 *   - Visually similar pairs
 *   - Fill from broader pool
 *
 * Categories:
 *   basic_consonant   — 14 characters, difficulty 1
 *   double_consonant  — 5 characters, difficulty 2
 *   basic_vowel       — 10 characters, difficulty 1
 *   compound_vowel    — 11 characters, difficulty 2
 *   syllable          — 14 common beginner syllables, difficulty 2
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// ============================================================
// HANGUL DATA
// ============================================================

// Each entry: [character, romanization, category, difficulty]
// category is used for distractor grouping

const BASIC_CONSONANTS = [
  ['ㄱ', 'g/k',  'basic_consonant', 1],
  ['ㄴ', 'n',    'basic_consonant', 1],
  ['ㄷ', 'd/t',  'basic_consonant', 1],
  ['ㄹ', 'r/l',  'basic_consonant', 1],
  ['ㅁ', 'm',    'basic_consonant', 1],
  ['ㅂ', 'b/p',  'basic_consonant', 1],
  ['ㅅ', 's',    'basic_consonant', 1],
  ['ㅇ', 'ng',   'basic_consonant', 1],
  ['ㅈ', 'j',    'basic_consonant', 1],
  ['ㅊ', 'ch',   'basic_consonant', 1],
  ['ㅋ', 'k',    'basic_consonant', 1],
  ['ㅌ', 't',    'basic_consonant', 1],
  ['ㅍ', 'p',    'basic_consonant', 1],
  ['ㅎ', 'h',    'basic_consonant', 1],
];

const DOUBLE_CONSONANTS = [
  ['ㄲ', 'kk', 'double_consonant', 2],
  ['ㄸ', 'tt', 'double_consonant', 2],
  ['ㅃ', 'pp', 'double_consonant', 2],
  ['ㅆ', 'ss', 'double_consonant', 2],
  ['ㅉ', 'jj', 'double_consonant', 2],
];

const BASIC_VOWELS = [
  ['ㅏ', 'a',   'basic_vowel', 1],
  ['ㅑ', 'ya',  'basic_vowel', 1],
  ['ㅓ', 'eo',  'basic_vowel', 1],
  ['ㅕ', 'yeo', 'basic_vowel', 1],
  ['ㅗ', 'o',   'basic_vowel', 1],
  ['ㅛ', 'yo',  'basic_vowel', 1],
  ['ㅜ', 'u',   'basic_vowel', 1],
  ['ㅠ', 'yu',  'basic_vowel', 1],
  ['ㅡ', 'eu',  'basic_vowel', 1],
  ['ㅣ', 'i',   'basic_vowel', 1],
];

const COMPOUND_VOWELS = [
  ['ㅐ', 'ae',  'compound_vowel', 2],
  ['ㅒ', 'yae', 'compound_vowel', 2],
  ['ㅔ', 'e',   'compound_vowel', 2],
  ['ㅖ', 'ye',  'compound_vowel', 2],
  ['ㅘ', 'wa',  'compound_vowel', 2],
  ['ㅙ', 'wae', 'compound_vowel', 2],
  ['ㅚ', 'oe',  'compound_vowel', 2],
  ['ㅝ', 'wo',  'compound_vowel', 2],
  ['ㅞ', 'we',  'compound_vowel', 2],
  ['ㅟ', 'wi',  'compound_vowel', 2],
  ['ㅢ', 'ui',  'compound_vowel', 2],
];

const SYLLABLE_BLOCKS = [
  ['가', 'ga',  'syllable', 2],
  ['나', 'na',  'syllable', 2],
  ['다', 'da',  'syllable', 2],
  ['라', 'ra',  'syllable', 2],
  ['마', 'ma',  'syllable', 2],
  ['바', 'ba',  'syllable', 2],
  ['사', 'sa',  'syllable', 2],
  ['아', 'a',   'syllable', 2],
  ['자', 'ja',  'syllable', 2],
  ['차', 'cha', 'syllable', 2],
  ['카', 'ka',  'syllable', 2],
  ['타', 'ta',  'syllable', 2],
  ['파', 'pa',  'syllable', 2],
  ['하', 'ha',  'syllable', 2],
];

const ALL_HANGUL = [
  ...BASIC_CONSONANTS,
  ...DOUBLE_CONSONANTS,
  ...BASIC_VOWELS,
  ...COMPOUND_VOWELS,
  ...SYLLABLE_BLOCKS,
];

// Visually similar pairs — used for distractor priority
// Maps character → array of visually similar characters
const SIMILAR_HANGUL = {
  // Consonant pairs
  'ㄱ': ['ㅋ', 'ㄲ'],
  'ㅋ': ['ㄱ', 'ㄲ'],
  'ㄲ': ['ㄱ', 'ㅋ'],
  'ㄴ': ['ㄹ', 'ㄷ'],
  'ㄹ': ['ㄴ', 'ㄷ'],
  'ㄷ': ['ㅌ', 'ㄸ', 'ㄴ'],
  'ㅌ': ['ㄷ', 'ㄸ'],
  'ㄸ': ['ㄷ', 'ㅌ'],
  'ㅂ': ['ㅍ', 'ㅃ'],
  'ㅍ': ['ㅂ', 'ㅃ'],
  'ㅃ': ['ㅂ', 'ㅍ'],
  'ㅅ': ['ㅈ', 'ㅆ'],
  'ㅈ': ['ㅅ', 'ㅊ', 'ㅉ'],
  'ㅊ': ['ㅈ', 'ㅉ'],
  'ㅆ': ['ㅅ', 'ㅈ'],
  'ㅉ': ['ㅈ', 'ㅊ'],
  'ㅇ': ['ㅎ'],
  'ㅎ': ['ㅇ'],
  // Vowel pairs
  'ㅏ': ['ㅓ', 'ㅣ'],
  'ㅓ': ['ㅏ', 'ㅣ'],
  'ㅑ': ['ㅕ', 'ㅏ'],
  'ㅕ': ['ㅑ', 'ㅓ'],
  'ㅗ': ['ㅜ', 'ㅛ'],
  'ㅜ': ['ㅗ', 'ㅠ'],
  'ㅛ': ['ㅠ', 'ㅗ'],
  'ㅠ': ['ㅛ', 'ㅜ'],
  'ㅐ': ['ㅔ', 'ㅒ'],
  'ㅔ': ['ㅐ', 'ㅖ'],
  'ㅒ': ['ㅖ', 'ㅐ'],
  'ㅖ': ['ㅒ', 'ㅔ'],
  // Syllable pairs (share consonant or vowel)
  '가': ['카', '나', '다'],
  '나': ['가', '마', '라'],
  '다': ['타', '가', '사'],
  '라': ['나', '마', '바'],
  '마': ['나', '바', '라'],
  '바': ['파', '마', '사'],
  '사': ['자', '다', '바'],
  '아': ['가', '야', '하'],
  '자': ['차', '사', '가'],
  '차': ['자', '카', '타'],
  '카': ['가', '차', '타'],
  '타': ['다', '카', '차'],
  '파': ['바', '카', '타'],
  '하': ['아', '가', '나'],
};

// ============================================================
// SEEDED PRNG (reproducible distractors)
// ============================================================

let seed = 42;

function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

function shuffleSeeded(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// DISTRACTOR GENERATION
// ============================================================

/**
 * Pick up to `count` distractor entries for a given target character.
 * Priority:
 *   1. Visually similar characters (from SIMILAR_HANGUL)
 *   2. Same category (consonant/vowel/syllable group)
 *   3. Remaining pool (shuffled for variety)
 */
function pickDistractors(targetChar, targetRomaji, targetCategory, count = 8) {
  const candidates = [];
  const usedRomaji = new Set([targetRomaji]);
  const usedChar = new Set([targetChar]);

  function tryAdd(entry) {
    const [char, romaji] = entry;
    if (usedChar.has(char) || usedRomaji.has(romaji)) return false;
    candidates.push(entry);
    usedChar.add(char);
    usedRomaji.add(romaji);
    return true;
  }

  // Priority 1: Visually similar
  const similar = SIMILAR_HANGUL[targetChar] || [];
  for (const simChar of similar) {
    const entry = ALL_HANGUL.find(e => e[0] === simChar);
    if (entry) tryAdd(entry);
  }

  // Priority 2: Same category
  const sameCategory = ALL_HANGUL.filter(e => e[2] === targetCategory);
  const shuffledSame = shuffleSeeded(sameCategory);
  for (const entry of shuffledSame) {
    if (candidates.length >= count) break;
    tryAdd(entry);
  }

  // Priority 3: Broader pool (all other characters, shuffled)
  const broader = shuffleSeeded(ALL_HANGUL);
  for (const entry of broader) {
    if (candidates.length >= count) break;
    tryAdd(entry);
  }

  return candidates.slice(0, count);
}

// ============================================================
// HUMAN-READABLE CATEGORY LABELS
// ============================================================

const CATEGORY_LABELS = {
  basic_consonant:  'basic consonant',
  double_consonant: 'doubled consonant',
  basic_vowel:      'basic vowel',
  compound_vowel:   'compound vowel',
  syllable:         'syllable block',
};

const CATEGORY_LABELS_CAP = {
  basic_consonant:  'Basic consonant',
  double_consonant: 'Doubled consonant',
  basic_vowel:      'Basic vowel',
  compound_vowel:   'Compound vowel',
  syllable:         'Syllable block',
};

// ============================================================
// FACT GENERATION
// ============================================================

function generateFacts() {
  const facts = [];
  const usedRomajiIds = new Set();

  for (const entry of ALL_HANGUL) {
    const [char, romaji, category, difficulty] = entry;

    // Collision-safe ID suffix
    const romajiKey = romaji.replace(/[^a-z]/g, '');
    const idSuffix = usedRomajiIds.has(romajiKey) ? `${romajiKey}2` : romajiKey;
    usedRomajiIds.add(romajiKey);

    const charTypeLabel = CATEGORY_LABELS[category] ?? category;
    const charTypeLabelCap = CATEGORY_LABELS_CAP[category] ?? category;

    const rarity = difficulty === 1 ? 'common' : 'uncommon';

    // Get distractor entries
    const distractorEntries = pickDistractors(char, romaji, category, 8);
    const romajiDistractors = distractorEntries.map(d => d[1]);
    const charDistractors   = distractorEntries.map(d => d[0]);

    // ---- Fact 1: Hangul → Romanization (forward) ----
    facts.push({
      id: `ko-hangul-${idSuffix}-forward`,
      type: 'vocabulary',
      statement: `${char} is the Hangul ${charTypeLabel} for the sound '${romaji}'.`,
      explanation: `${char} (${romaji}) — a ${charTypeLabel} in the Korean Hangul writing system.`,
      quizQuestion: `What sound does the Hangul ${char} represent?`,
      correctAnswer: romaji,
      distractors: romajiDistractors,
      acceptableAnswers: [romaji],
      category: ['language', 'korean_hangul'],
      categoryL1: 'language',
      categoryL2: 'korean_hangul',
      categoryL3: category,
      rarity,
      difficulty,
      funScore: 5,
      noveltyScore: 2,
      ageRating: 'kid',
      sourceName: 'Standard Korean Hangul Chart',
      sourceUrl: '',
      language: 'ko',
      pronunciation: romaji,
      status: 'approved',
      contentVolatility: 'timeless',
      sensitivityLevel: 0,
      sensitivityNote: null,
      tags: ['hangul', 'ko', 'alphabet', category],
      variants: [
        {
          type: 'forward',
          question: `What sound does ${char} represent?`,
          answer: romaji,
          distractors: romajiDistractors.slice(0, 3),
        },
        {
          type: 'reverse',
          question: `Which Hangul ${charTypeLabel} represents '${romaji}'?`,
          answer: char,
          distractors: charDistractors.slice(0, 3),
        },
        {
          type: 'true_false',
          question: `The Hangul ${char} represents the sound '${romaji}'.`,
          answer: 'True',
          distractors: ['False'],
        },
        {
          type: 'fill_blank',
          question: `The Hangul ${char} is read as ___.`,
          answer: romaji,
          distractors: romajiDistractors.slice(0, 3),
        },
      ],
    });

    // ---- Fact 2: Romanization → Hangul (reverse) ----
    facts.push({
      id: `ko-hangul-${idSuffix}-reverse`,
      type: 'vocabulary',
      statement: `The sound '${romaji}' is written as ${char} in Hangul.`,
      explanation: `In Korean Hangul, the sound '${romaji}' is represented by the ${charTypeLabel} ${char}.`,
      quizQuestion: `Which Hangul ${charTypeLabel} represents '${romaji}'?`,
      correctAnswer: char,
      distractors: charDistractors,
      acceptableAnswers: [char],
      category: ['language', 'korean_hangul'],
      categoryL1: 'language',
      categoryL2: 'korean_hangul',
      categoryL3: category,
      rarity,
      difficulty,
      funScore: 5,
      noveltyScore: 2,
      ageRating: 'kid',
      sourceName: 'Standard Korean Hangul Chart',
      sourceUrl: '',
      language: 'ko',
      pronunciation: romaji,
      status: 'approved',
      contentVolatility: 'timeless',
      sensitivityLevel: 0,
      sensitivityNote: null,
      tags: ['hangul', 'ko', 'alphabet', category],
      variants: [
        {
          type: 'forward',
          question: `Which Hangul character is '${romaji}'?`,
          answer: char,
          distractors: charDistractors.slice(0, 3),
        },
        {
          type: 'reverse',
          question: `What sound does ${char} make?`,
          answer: romaji,
          distractors: romajiDistractors.slice(0, 3),
        },
        {
          type: 'true_false',
          question: `The sound '${romaji}' is written as ${char} in Hangul.`,
          answer: 'True',
          distractors: ['False'],
        },
        {
          type: 'fill_blank',
          question: `In Hangul, '${romaji}' is written as ___.`,
          answer: char,
          distractors: charDistractors.slice(0, 3),
        },
      ],
    });
  }

  return facts;
}

// ============================================================
// MAIN
// ============================================================

const facts = generateFacts();

const outputPath = join(ROOT, 'src', 'data', 'seed', 'vocab-ko-hangul.json');
writeFileSync(outputPath, JSON.stringify(facts, null, 2) + '\n');

// ---- Summary ----
const byCategory = {
  basic_consonant:  0,
  double_consonant: 0,
  basic_vowel:      0,
  compound_vowel:   0,
  syllable:         0,
};

for (const fact of facts) {
  const cat = fact.categoryL3;
  if (cat in byCategory) byCategory[cat]++;
}

console.log(`\nHangul facts generated → ${outputPath}`);
console.log(`Total: ${facts.length} facts (${facts.length / 2} characters x 2 directions)\n`);
console.log('By category (fact count = characters x 2):');
for (const [cat, count] of Object.entries(byCategory)) {
  const chars = count / 2;
  console.log(`  ${cat.padEnd(18)} ${chars} characters → ${count} facts`);
}

// ---- Distractor quality check ----
let tooFew = 0;
let answerInDistractors = 0;
for (const fact of facts) {
  if (fact.distractors.length < 3) tooFew++;
  if (fact.distractors.includes(fact.correctAnswer)) {
    answerInDistractors++;
    console.error(`ERROR: correct answer appears in distractors for ${fact.id}`);
  }
}

console.log('\nDistractor quality:');
console.log(`  Facts with < 3 distractors:          ${tooFew}`);
console.log(`  Facts with answer in distractors:     ${answerInDistractors}`);
console.log(`  (Both should be 0)`);
