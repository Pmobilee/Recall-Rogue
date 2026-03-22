#!/usr/bin/env node
/**
 * build-kana-facts.mjs
 *
 * Programmatically generates Hiragana and Katakana quiz facts.
 * No LLM needed — kana is a finite, well-defined character set.
 *
 * Generates 2 facts per character:
 *   1. Kana → Romaji ("What sound does あ represent?" → "a")
 *   2. Romaji → Kana ("Which hiragana represents 'ka'?" → "か")
 *
 * Pre-generates 8 distractors per fact using smart selection:
 *   - Same consonant row, same vowel column, visually similar pairs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// ============================================================
// KANA DATA
// ============================================================

// Each entry: [hiragana, katakana, romaji, row, difficulty]
// row = consonant group (for distractor selection)
// difficulty: 1=vowels, 2=common consonants, 3=less common, 4=dakuten, 5=combos

const BASIC_KANA = [
  // Vowels (difficulty 1)
  ['あ', 'ア', 'a', 'vowel', 1],
  ['い', 'イ', 'i', 'vowel', 1],
  ['う', 'ウ', 'u', 'vowel', 1],
  ['え', 'エ', 'e', 'vowel', 1],
  ['お', 'オ', 'o', 'vowel', 1],

  // K-row (difficulty 2)
  ['か', 'カ', 'ka', 'k', 2],
  ['き', 'キ', 'ki', 'k', 2],
  ['く', 'ク', 'ku', 'k', 2],
  ['け', 'ケ', 'ke', 'k', 2],
  ['こ', 'コ', 'ko', 'k', 2],

  // S-row (difficulty 2)
  ['さ', 'サ', 'sa', 's', 2],
  ['し', 'シ', 'shi', 's', 2],
  ['す', 'ス', 'su', 's', 2],
  ['せ', 'セ', 'se', 's', 2],
  ['そ', 'ソ', 'so', 's', 2],

  // T-row (difficulty 2)
  ['た', 'タ', 'ta', 't', 2],
  ['ち', 'チ', 'chi', 't', 2],
  ['つ', 'ツ', 'tsu', 't', 2],
  ['て', 'テ', 'te', 't', 2],
  ['と', 'ト', 'to', 't', 2],

  // N-row (difficulty 2)
  ['な', 'ナ', 'na', 'n', 2],
  ['に', 'ニ', 'ni', 'n', 2],
  ['ぬ', 'ヌ', 'nu', 'n', 2],
  ['ね', 'ネ', 'ne', 'n', 2],
  ['の', 'ノ', 'no', 'n', 2],

  // H-row (difficulty 3)
  ['は', 'ハ', 'ha', 'h', 3],
  ['ひ', 'ヒ', 'hi', 'h', 3],
  ['ふ', 'フ', 'fu', 'h', 3],
  ['へ', 'ヘ', 'he', 'h', 3],
  ['ほ', 'ホ', 'ho', 'h', 3],

  // M-row (difficulty 3)
  ['ま', 'マ', 'ma', 'm', 3],
  ['み', 'ミ', 'mi', 'm', 3],
  ['む', 'ム', 'mu', 'm', 3],
  ['め', 'メ', 'me', 'm', 3],
  ['も', 'モ', 'mo', 'm', 3],

  // Y-row (difficulty 3)
  ['や', 'ヤ', 'ya', 'y', 3],
  ['ゆ', 'ユ', 'yu', 'y', 3],
  ['よ', 'ヨ', 'yo', 'y', 3],

  // R-row (difficulty 3)
  ['ら', 'ラ', 'ra', 'r', 3],
  ['り', 'リ', 'ri', 'r', 3],
  ['る', 'ル', 'ru', 'r', 3],
  ['れ', 'レ', 're', 'r', 3],
  ['ろ', 'ロ', 'ro', 'r', 3],

  // W-row + N (difficulty 3)
  ['わ', 'ワ', 'wa', 'w', 3],
  ['を', 'ヲ', 'wo', 'w', 3],
  ['ん', 'ン', 'n', 'special', 3],
];

const DAKUTEN_KANA = [
  // G-row (difficulty 4)
  ['が', 'ガ', 'ga', 'g', 4],
  ['ぎ', 'ギ', 'gi', 'g', 4],
  ['ぐ', 'グ', 'gu', 'g', 4],
  ['げ', 'ゲ', 'ge', 'g', 4],
  ['ご', 'ゴ', 'go', 'g', 4],

  // Z-row (difficulty 4)
  ['ざ', 'ザ', 'za', 'z', 4],
  ['じ', 'ジ', 'ji', 'z', 4],
  ['ず', 'ズ', 'zu', 'z', 4],
  ['ぜ', 'ゼ', 'ze', 'z', 4],
  ['ぞ', 'ゾ', 'zo', 'z', 4],

  // D-row (difficulty 4)
  ['だ', 'ダ', 'da', 'd', 4],
  ['ぢ', 'ヂ', 'ji', 'd', 4],
  ['づ', 'ヅ', 'zu', 'd', 4],
  ['で', 'デ', 'de', 'd', 4],
  ['ど', 'ド', 'do', 'd', 4],

  // B-row (difficulty 4)
  ['ば', 'バ', 'ba', 'b', 4],
  ['び', 'ビ', 'bi', 'b', 4],
  ['ぶ', 'ブ', 'bu', 'b', 4],
  ['べ', 'ベ', 'be', 'b', 4],
  ['ぼ', 'ボ', 'bo', 'b', 4],

  // P-row (handakuten, difficulty 4)
  ['ぱ', 'パ', 'pa', 'p', 4],
  ['ぴ', 'ピ', 'pi', 'p', 4],
  ['ぷ', 'プ', 'pu', 'p', 4],
  ['ぺ', 'ペ', 'pe', 'p', 4],
  ['ぽ', 'ポ', 'po', 'p', 4],
];

const COMBO_KANA = [
  // K-combos (difficulty 5)
  ['きゃ', 'キャ', 'kya', 'ky', 5],
  ['きゅ', 'キュ', 'kyu', 'ky', 5],
  ['きょ', 'キョ', 'kyo', 'ky', 5],

  // S-combos
  ['しゃ', 'シャ', 'sha', 'sh', 5],
  ['しゅ', 'シュ', 'shu', 'sh', 5],
  ['しょ', 'ショ', 'sho', 'sh', 5],

  // C-combos
  ['ちゃ', 'チャ', 'cha', 'ch', 5],
  ['ちゅ', 'チュ', 'chu', 'ch', 5],
  ['ちょ', 'チョ', 'cho', 'ch', 5],

  // N-combos
  ['にゃ', 'ニャ', 'nya', 'ny', 5],
  ['にゅ', 'ニュ', 'nyu', 'ny', 5],
  ['にょ', 'ニョ', 'nyo', 'ny', 5],

  // H-combos
  ['ひゃ', 'ヒャ', 'hya', 'hy', 5],
  ['ひゅ', 'ヒュ', 'hyu', 'hy', 5],
  ['ひょ', 'ヒョ', 'hyo', 'hy', 5],

  // M-combos
  ['みゃ', 'ミャ', 'mya', 'my', 5],
  ['みゅ', 'ミュ', 'myu', 'my', 5],
  ['みょ', 'ミョ', 'myo', 'my', 5],

  // R-combos
  ['りゃ', 'リャ', 'rya', 'ry', 5],
  ['りゅ', 'リュ', 'ryu', 'ry', 5],
  ['りょ', 'リョ', 'ryo', 'ry', 5],

  // G-combos
  ['ぎゃ', 'ギャ', 'gya', 'gy', 5],
  ['ぎゅ', 'ギュ', 'gyu', 'gy', 5],
  ['ぎょ', 'ギョ', 'gyo', 'gy', 5],

  // J-combos
  ['じゃ', 'ジャ', 'ja', 'j', 5],
  ['じゅ', 'ジュ', 'ju', 'j', 5],
  ['じょ', 'ジョ', 'jo', 'j', 5],

  // B-combos
  ['びゃ', 'ビャ', 'bya', 'by', 5],
  ['びゅ', 'ビュ', 'byu', 'by', 5],
  ['びょ', 'ビョ', 'byo', 'by', 5],

  // P-combos
  ['ぴゃ', 'ピャ', 'pya', 'py', 5],
  ['ぴゅ', 'ピュ', 'pyu', 'py', 5],
  ['ぴょ', 'ピョ', 'pyo', 'py', 5],
];

const ALL_KANA = [...BASIC_KANA, ...DAKUTEN_KANA, ...COMBO_KANA];

// Visually similar pairs for distractor priority (hiragana)
const SIMILAR_HIRAGANA = {
  'あ': ['お', 'め'],
  'お': ['あ', 'む'],
  'き': ['さ', 'ち'],
  'さ': ['き', 'ち'],
  'は': ['ほ', 'ま'],
  'ほ': ['は', 'ま'],
  'ぬ': ['め', 'ね'],
  'め': ['ぬ', 'あ'],
  'ね': ['れ', 'わ'],
  'れ': ['ね', 'わ'],
  'る': ['ろ', 'う'],
  'ろ': ['る', 'そ'],
  'わ': ['ね', 'れ'],
  'う': ['る', 'つ'],
  'つ': ['う', 'て'],
  'こ': ['に', 'て'],
  'に': ['こ', 'た'],
  'た': ['に', 'な'],
  'な': ['た', 'は'],
  'ち': ['さ', 'き'],
  'し': ['く', 'つ'],
  'く': ['し', 'へ'],
  'へ': ['く', 'え'],
};

// Visually similar pairs for katakana
const SIMILAR_KATAKANA = {
  'シ': ['ツ', 'ミ'],
  'ツ': ['シ', 'ソ'],
  'ソ': ['ン', 'ツ'],
  'ン': ['ソ', 'シ'],
  'ウ': ['ワ', 'フ'],
  'ワ': ['ウ', 'フ'],
  'ク': ['ケ', 'タ'],
  'ケ': ['ク', 'テ'],
  'コ': ['ユ', 'ロ'],
  'ユ': ['コ', 'ヨ'],
  'チ': ['テ', 'ナ'],
  'テ': ['チ', 'ケ'],
  'ナ': ['チ', 'メ'],
  'メ': ['ナ', 'ヌ'],
  'ヌ': ['メ', 'フ'],
  'フ': ['ヌ', 'ウ'],
  'ロ': ['コ', 'ヨ'],
  'ヨ': ['ロ', 'ユ'],
  'マ': ['ム', 'ア'],
  'ム': ['マ', 'モ'],
  'ア': ['マ', 'ヤ'],
  'ヤ': ['ア', 'カ'],
  'カ': ['ヤ', 'セ'],
  'セ': ['カ', 'サ'],
  'サ': ['セ', 'キ'],
  'キ': ['サ', 'ヒ'],
};

// ============================================================
// DISTRACTOR GENERATION
// ============================================================

function pickDistractors(targetRomaji, targetKana, allKana, system, similarMap, count = 8) {
  const candidates = [];
  const usedRomaji = new Set([targetRomaji]);
  const usedKana = new Set([targetKana]);

  const kanaIdx = system === 'hiragana' ? 0 : 1;

  // Priority 1: Visually similar kana
  const similar = similarMap[targetKana] || [];
  for (const simKana of similar) {
    const entry = allKana.find(k => k[kanaIdx] === simKana);
    if (entry && !usedRomaji.has(entry[2])) {
      candidates.push(entry);
      usedRomaji.add(entry[2]);
      usedKana.add(entry[kanaIdx]);
    }
  }

  // Priority 2: Same consonant row
  const targetEntry = allKana.find(k => k[kanaIdx] === targetKana);
  if (targetEntry) {
    const targetRow = targetEntry[3];
    const sameRow = allKana.filter(k => k[3] === targetRow && !usedRomaji.has(k[2]));
    for (const entry of sameRow) {
      if (candidates.length >= count) break;
      candidates.push(entry);
      usedRomaji.add(entry[2]);
      usedKana.add(entry[kanaIdx]);
    }
  }

  // Priority 3: Same vowel ending
  const vowel = targetRomaji.slice(-1);
  const sameVowel = allKana.filter(k => k[2].slice(-1) === vowel && !usedRomaji.has(k[2]));
  for (const entry of sameVowel) {
    if (candidates.length >= count) break;
    candidates.push(entry);
    usedRomaji.add(entry[2]);
    usedKana.add(entry[kanaIdx]);
  }

  // Priority 4: Similar difficulty
  if (targetEntry) {
    const diff = targetEntry[4];
    const sameDiff = allKana.filter(k => k[4] === diff && !usedRomaji.has(k[2]));
    // Shuffle for variety
    sameDiff.sort(() => Math.random() - 0.5);
    for (const entry of sameDiff) {
      if (candidates.length >= count) break;
      candidates.push(entry);
      usedRomaji.add(entry[2]);
      usedKana.add(entry[kanaIdx]);
    }
  }

  // Priority 5: Any remaining kana
  const remaining = allKana.filter(k => !usedRomaji.has(k[2]));
  remaining.sort(() => Math.random() - 0.5);
  for (const entry of remaining) {
    if (candidates.length >= count) break;
    candidates.push(entry);
    usedRomaji.add(entry[2]);
  }

  return candidates.slice(0, count);
}

// ============================================================
// FACT GENERATION
// ============================================================

function generateFacts(system) {
  const kanaIdx = system === 'hiragana' ? 0 : 1;
  const systemLabel = system === 'hiragana' ? 'hiragana' : 'katakana';
  const systemLabelCap = system === 'hiragana' ? 'Hiragana' : 'Katakana';
  const subcategory = system === 'hiragana' ? 'japanese_hiragana' : 'japanese_katakana';
  const similarMap = system === 'hiragana' ? SIMILAR_HIRAGANA : SIMILAR_KATAKANA;

  const facts = [];
  let counter = 1;
  const usedRomajiIds = new Set();

  for (const entry of ALL_KANA) {
    const [hiragana, katakana, romaji, row, difficulty] = entry;
    const kana = entry[kanaIdx];

    // Get distractors
    const distractorEntries = pickDistractors(romaji, kana, ALL_KANA, system, similarMap, 8);
    const romajiDistractors = distractorEntries.map(d => d[2]);
    const kanaDistractors = distractorEntries.map(d => d[kanaIdx]);

    const isCombo = difficulty === 5;
    const charType = isCombo ? 'combination' : 'character';

    // Build collision-safe ID suffix: append "2" if this romaji was already used
    const romajiKey = romaji.replace(/[^a-z]/g, '');
    const idSuffix = usedRomajiIds.has(romajiKey) ? `${romajiKey}2` : romajiKey;
    usedRomajiIds.add(romajiKey);

    // Fact 1: Kana → Romaji (forward direction)
    facts.push({
      id: `ja-${systemLabel}-${idSuffix}-forward`,
      type: 'vocabulary',
      statement: `${kana} is the ${systemLabel} ${charType} for the sound '${romaji}'.`,
      explanation: `${kana} (${romaji}) — a ${systemLabel} ${charType} in the Japanese writing system.`,
      quizQuestion: `What sound does the ${systemLabel} ${kana} represent?`,
      correctAnswer: romaji,
      distractors: romajiDistractors,
      acceptableAnswers: [romaji.toLowerCase()],
      category: ['language', subcategory],
      categoryL1: 'language',
      categoryL2: subcategory,
      categoryL3: '',
      rarity: difficulty <= 2 ? 'common' : difficulty <= 3 ? 'uncommon' : 'rare',
      difficulty: difficulty,
      funScore: 3,
      noveltyScore: 2,
      ageRating: 'kid',
      sourceName: 'Standard Japanese Kana Chart',
      sourceUrl: '',
      language: 'ja',
      pronunciation: romaji,
      status: 'approved',
      contentVolatility: 'timeless',
      sensitivityLevel: 0,
      sensitivityNote: null,
      tags: ['kana', systemLabel, 'ja', 'reading'],
      variants: [
        { type: 'forward', question: `What sound does ${kana} represent?`, answer: romaji, distractors: romajiDistractors.slice(0, 3) },
        { type: 'reverse', question: `Which ${systemLabel} represents '${romaji}'?`, answer: kana, distractors: kanaDistractors.slice(0, 3) },
        { type: 'true_false', question: `The ${systemLabel} ${kana} represents the sound '${romaji}'.`, answer: 'True', distractors: ['False'] },
        { type: 'fill_blank', question: `The ${systemLabel} ${kana} is read as ___.`, answer: romaji, distractors: romajiDistractors.slice(0, 3) },
      ],
    });

    // Fact 2: Romaji → Kana (reverse direction)
    facts.push({
      id: `ja-${systemLabel}-${idSuffix}-reverse`,
      type: 'vocabulary',
      statement: `The sound '${romaji}' is written as ${kana} in ${systemLabel}.`,
      explanation: `In ${systemLabel}, the sound '${romaji}' is represented by the ${charType} ${kana}.`,
      quizQuestion: `Which ${systemLabel} ${charType} represents '${romaji}'?`,
      correctAnswer: kana,
      distractors: kanaDistractors,
      acceptableAnswers: [kana],
      category: ['language', subcategory],
      categoryL1: 'language',
      categoryL2: subcategory,
      categoryL3: '',
      rarity: difficulty <= 2 ? 'common' : difficulty <= 3 ? 'uncommon' : 'rare',
      difficulty: difficulty,
      funScore: 3,
      noveltyScore: 2,
      ageRating: 'kid',
      sourceName: 'Standard Japanese Kana Chart',
      sourceUrl: '',
      language: 'ja',
      pronunciation: romaji,
      status: 'approved',
      contentVolatility: 'timeless',
      sensitivityLevel: 0,
      sensitivityNote: null,
      tags: ['kana', systemLabel, 'ja', 'writing'],
      variants: [
        { type: 'forward', question: `Which ${systemLabel} is '${romaji}'?`, answer: kana, distractors: kanaDistractors.slice(0, 3) },
        { type: 'reverse', question: `What sound does ${kana} make?`, answer: romaji, distractors: romajiDistractors.slice(0, 3) },
        { type: 'true_false', question: `The sound '${romaji}' is written as ${kana} in ${systemLabel}.`, answer: 'True', distractors: ['False'] },
        { type: 'fill_blank', question: `In ${systemLabel}, '${romaji}' is written as ___.`, answer: kana, distractors: kanaDistractors.slice(0, 3) },
      ],
    });

    counter++;
  }

  // Collision fix: ぢ/ヂ and づ/ヅ were changed to Hepburn romanization (ji/zu),
  // creating ambiguity with じ/ジ (ji) and ず/ズ (zu).
  // For reverse facts ("Which kana represents 'ji'?"), both answers are valid.
  const COLLISION_PAIRS = {
    // romaji → [primary kana (hiragana), alternate kana (hiragana), primary katakana, alternate katakana]
    'ji':  { hiragana: ['じ', 'ぢ'], katakana: ['ジ', 'ヂ'] },
    'zu':  { hiragana: ['ず', 'づ'], katakana: ['ズ', 'ヅ'] },
  };

  for (const fact of facts) {
    // Only touch reverse facts (romaji → kana direction)
    if (!fact.id.endsWith('-reverse')) continue;

    const romaji = fact.pronunciation;
    if (!COLLISION_PAIRS[romaji]) continue;

    const sys = fact.categoryL2.includes('hiragana') ? 'hiragana' : 'katakana';
    const alts = COLLISION_PAIRS[romaji][sys]; // [primary, alternate]

    // The correct answer is one of the two; the other is also acceptable
    if (alts.includes(fact.correctAnswer)) {
      const other = alts.find(k => k !== fact.correctAnswer);
      if (other && !fact.acceptableAnswers.includes(other)) {
        fact.acceptableAnswers.push(other);
      }
      // Mirror into variants too
      for (const v of fact.variants) {
        if (v.answer === fact.correctAnswer && !Array.isArray(v.acceptableAnswers)) {
          v.acceptableAnswers = [fact.correctAnswer, other];
        }
      }
    }
  }

  return facts;
}

// ============================================================
// MAIN
// ============================================================

// Use fixed seed for reproducible distractors
// (Override Math.random with a seeded PRNG)
let seed = 42;
const origRandom = Math.random;
Math.random = function() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
};

const hiraganaFacts = generateFacts('hiragana');
const katakanaFacts = generateFacts('katakana');

// Restore Math.random
Math.random = origRandom;

const hiraganaPath = join(ROOT, 'src', 'data', 'seed', 'vocab-ja-hiragana.json');
const katakanaPath = join(ROOT, 'src', 'data', 'seed', 'vocab-ja-katakana.json');

writeFileSync(hiraganaPath, JSON.stringify(hiraganaFacts, null, 2) + '\n');
writeFileSync(katakanaPath, JSON.stringify(katakanaFacts, null, 2) + '\n');

console.log(`Hiragana: ${hiraganaFacts.length} facts → ${hiraganaPath}`);
console.log(`Katakana: ${katakanaFacts.length} facts → ${katakanaPath}`);
console.log(`Total: ${hiraganaFacts.length + katakanaFacts.length} kana facts generated`);

// Verify distractor quality
let emptyDistractors = 0;
let shortDistractors = 0;
for (const fact of [...hiraganaFacts, ...katakanaFacts]) {
  if (fact.distractors.length < 3) emptyDistractors++;
  if (fact.distractors.length < 8) shortDistractors++;
  // Check no distractor matches answer
  if (fact.distractors.includes(fact.correctAnswer)) {
    console.error(`ERROR: Answer in distractors for ${fact.id}`);
  }
}
console.log(`\nDistractor quality:`);
console.log(`  Facts with < 3 distractors: ${emptyDistractors}`);
console.log(`  Facts with < 8 distractors: ${shortDistractors}`);
console.log(`  (All should be 0 for basic/dakuten, some combos may have fewer due to small pool)`);
