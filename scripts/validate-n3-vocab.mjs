/**
 * validate-n3-vocab.mjs
 *
 * Validates all Japanese grammar deck sentences for vocabulary above N3 level.
 * Reads JLPT N5/N4/N3 word lists, tokenizes each example sentence with kuromoji,
 * and flags any content words not in the N3-and-below vocabulary set.
 *
 * Usage: node scripts/validate-n3-vocab.mjs
 * Output: data/raw/japanese/n3-vocab-validation.json
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Step 1: Build the N3-and-below vocabulary set
// ---------------------------------------------------------------------------

function parseJlptCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.trim().split('\n');
  const words = new Set();
  for (let i = 1; i < lines.length; i++) { // skip header
    const line = lines[i].trim();
    if (!line) continue;
    // CSV: expression,reading,meaning,tags,guid
    // expression and reading may be quoted if they contain commas
    const cols = parseCsvLine(line);
    if (cols.length >= 2) {
      if (cols[0]) words.add(cols[0].trim());
      if (cols[1]) words.add(cols[1].trim());
    }
  }
  return words;
}

function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

console.log('Loading JLPT vocabulary lists...');

const jlptDir = path.join(ROOT, 'data/references/jlpt');
const n5Words = parseJlptCsv(path.join(jlptDir, 'n5.csv'));
const n4Words = parseJlptCsv(path.join(jlptDir, 'n4.csv'));
const n3Words = parseJlptCsv(path.join(jlptDir, 'n3.csv'));

console.log(`  N5: ${n5Words.size} forms, N4: ${n4Words.size} forms, N3: ${n3Words.size} forms`);

// Combine into allowed set (N3 and below)
const allowedVocab = new Set([...n5Words, ...n4Words, ...n3Words]);

// Add common particles, pronouns, and basic words not always in JLPT lists
const alwaysAllowed = new Set([
  // Particles
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'から', 'まで', 'より',
  'ね', 'よ', 'わ', 'か', 'な', 'さ', 'ぞ', 'ぜ', 'って', 'て', 'で', 'に',
  'けど', 'けれど', 'けれども', 'が', 'し', 'ので', 'のに', 'ながら',
  'ば', 'たら', 'なら', 'ても', 'でも',
  // Pronouns
  '私', 'わたし', '僕', 'ぼく', 'あなた', '彼', 'かれ', '彼女', 'かのじょ',
  'それ', 'これ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ',
  '私たち', '僕たち', 'あなたたち', '彼ら', '彼女たち',
  'あなた', 'きみ', '君', 'おれ', '俺',
  // Common verbs
  'ある', 'いる', 'する', 'なる', 'できる', '思う', 'おもう', '言う', 'いう',
  '見る', 'みる', '聞く', 'きく', '行く', 'いく', '来る', 'くる',
  '食べる', 'たべる', '飲む', 'のむ', '買う', 'かう', '書く', 'かく',
  '読む', 'よむ', '話す', 'はなす', '出る', 'でる', '入る', 'はいる',
  '使う', 'つかう', '知る', 'しる', '思う', 'おもう', '考える', 'かんがえる',
  '会う', 'あう', '持つ', 'もつ', '作る', 'つくる', '見せる', 'みせる',
  '帰る', 'かえる', '起きる', 'おきる', '寝る', 'ねる', '受ける', 'うける',
  '開く', 'あく', '閉める', 'しめる', '終わる', 'おわる', '始まる', 'はじまる',
  'もらう', 'あげる', 'くれる', 'やる',
  // Auxiliary verbs / grammatical forms
  'です', 'ます', 'だ', 'た', 'ない', 'ない', 'ず', 'ぬ',
  'てしまう', 'ていく', 'てくる', 'ておく', 'てみる', 'てある', 'ている',
  'られる', 'せる', 'させる', 'れる',
  'ほしい', 'たい', 'そう', 'らしい', 'ようだ', 'みたいだ', 'はずだ',
  // Numbers (kanji + hiragana)
  '一', 'いち', '二', 'に', '三', 'さん', '四', 'し', 'よん',
  '五', 'ご', '六', 'ろく', '七', 'しち', 'なな', '八', 'はち',
  '九', 'く', 'きゅう', '十', 'じゅう', '百', 'ひゃく', '千', 'せん', '万', 'まん',
  '一つ', '二つ', '三つ', '四つ', '五つ', '六つ', '七つ', '八つ', '九つ', '十',
  // Time words
  '今', 'いま', '昨日', 'きのう', '明日', 'あした', 'あす', '今日', 'きょう',
  '今年', 'ことし', '去年', 'きょねん', '来年', 'らいねん',
  '今月', 'こんげつ', '先月', 'せんげつ', '来月', 'らいげつ',
  '今週', 'こんしゅう', '先週', 'せんしゅう', '来週', 'らいしゅう',
  '朝', 'あさ', '昼', 'ひる', '夜', 'よる', '夕方', 'ゆうがた',
  // Counters
  'つ', '人', 'にん', 'ひとり', 'ふたり', '本', 'ほん', '個', 'こ',
  '枚', 'まい', '台', 'だい', '匹', 'ひき', '冊', 'さつ', '杯', 'はい',
  '階', 'かい', '回', 'かい', '番', 'ばん', '号', 'ごう',
  // Common adjectives & adverbs
  'いい', 'よい', '悪い', 'わるい', '大きい', 'おおきい', '小さい', 'ちいさい',
  '多い', 'おおい', '少ない', 'すくない', '高い', 'たかい', '安い', 'やすい',
  '長い', 'ながい', '短い', 'みじかい', '新しい', 'あたらしい', '古い', 'ふるい',
  'とても', 'すごく', 'もっと', 'もう', 'まだ', 'もう', 'また', 'よく',
  'たくさん', 'すこし', 'ちょっと', 'ぜんぜん', 'あまり', 'だいたい',
  'もちろん', 'やはり', 'やっぱり', 'たぶん', 'きっと',
  // Conjunctions
  'そして', 'でも', 'しかし', 'だから', 'だが', 'それで', 'また',
  'ところで', 'つまり', 'それに', 'さらに',
  // Common nouns
  '人', 'ひと', '時', 'とき', '事', 'こと', '物', 'もの', 'もの',
  '所', 'ところ', '方', 'かた', 'ほう', '気', 'き',
  '日', 'にち', 'ひ', '月', 'つき', 'がつ', '年', 'ねん', 'とし',
  // Contracted/colloquial verb forms commonly seen in example sentences
  'しまう', 'てしまう', 'でしまう',
  'ちゃう', 'てちゃう', 'ちゃった',
  'じゃう', 'じゃった',
  'てる', 'でる', 'ている', 'でいる',
  'とく', 'どく', 'ておく', 'でおく',
  'てく', 'でく', 'ていく', 'でいく',
  // Potential forms of common verbs
  '話せる', 'はなせる', '書ける', 'かける', '読める', 'よめる',
  '聞ける', 'きける', '見られる', 'みられる', '食べられる', 'たべられる',
  '来られる', 'こられる', '行ける', 'いける', '使える', 'つかえる',
  '眠れる', 'ねむれる', '泳げる', 'およげる', '飲める', 'のめる',
  '勝てる', 'かてる', '起きられる', 'おきられる',
  // Suffix たち (pluralizer)
  'たち', '-たち',
  // Common adverbs not always in JLPT lists
  'すぐ', 'すぐに', 'さっさと', 'さっそく', '早速',
  'もし', 'もしも', 'ぜひ', 'なんと', 'なんか', 'なんて',
  'なるほど', 'やはり', 'やっぱり', 'さすが',
  'あいにく', 'あくまでも', 'あくまで',
  'どうせ', 'せっかく', 'わざと', 'わざわざ',
  'あまりに', 'あまりにも',
  // Common words that should always be allowed
  '日本語', 'にほんご', '英語', 'えいご', '中国語', 'ちゅうごくご',
  '本当', 'ほんとう', '本当に', 'ほんとうに',
  '大丈夫', 'だいじょうぶ', '問題', 'もんだい',
  '多く', 'おおく', '少し', 'すこし',
  '人々', 'ひとびと',
  '出来る', 'できる', '出来ない', 'できない',
  //気 compounds
  '気がつく', 'きがつく', '気がする', 'きがする',
  '気に入る', 'きにいる', '気になる', 'きになる',
  // Special grammar-point related tokens
  'て', 'で', 'に', 'を', 'が', 'は', 'も', 'か', 'ね', 'よ',
]);

// Merge into allowed set
for (const w of alwaysAllowed) {
  allowedVocab.add(w);
}

console.log(`  Total allowed forms (N5+N4+N3+common): ${allowedVocab.size}`);

// ---------------------------------------------------------------------------
// Step 2: Load all grammar facts
// ---------------------------------------------------------------------------

const grammarFiles = [
  'grammar-n5.json',
  'grammar-n4.json',
  'grammar-n3.json',
  'grammar-additional.json',
  'grammar-n2.json',
  'grammar-n1.json',
];

let allFacts = [];
for (const file of grammarFiles) {
  const filePath = path.join(ROOT, 'data/raw/japanese', file);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const facts = Array.isArray(data) ? data : data.facts || [];
  allFacts.push(...facts);
}

// Only keep facts that have a Japanese example sentence
const factsWithSentences = allFacts.filter(f =>
  f.exampleSentence && /[\u3040-\u9FFF]/.test(f.exampleSentence)
);

console.log(`\nLoaded ${allFacts.length} total grammar facts`);
console.log(`  ${factsWithSentences.length} have Japanese example sentences`);

// ---------------------------------------------------------------------------
// Step 3: Build kuromoji tokenizer and run validation
// ---------------------------------------------------------------------------

console.log('\nBuilding kuromoji tokenizer...');

const kuromoji = require('kuromoji');

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict/' }).build((err, t) => {
    if (err) reject(err);
    else resolve(t);
  });
});

console.log('Tokenizer ready. Validating sentences...\n');

/**
 * Extract the Japanese portion of an exampleSentence.
 * Sentences look like: "食べ過ぎて、イチゴさえ食べられない。 (I am so full...)"
 * We want just the Japanese part before the English translation in parentheses.
 */
function extractJapanesePart(sentence) {
  // Remove everything after the first full-width '(' or '(' + space pattern
  const parenIdx = sentence.search(/\s*[\(（]/);
  if (parenIdx > 0) return sentence.slice(0, parenIdx).trim();
  return sentence.trim();
}

/**
 * Determine if a token should be skipped (punctuation, particles, numbers, etc.)
 */
function shouldSkipToken(token) {
  const pos = token.pos;
  const posDetail1 = token.pos_detail_1;
  const posDetail2 = token.pos_detail_2;
  const surface = token.surface_form;

  // Skip punctuation
  if (pos === '記号') return true;

  // Skip pure numbers
  if (pos === '名詞' && posDetail1 === '数') return true;

  // Skip particles
  if (pos === '助詞') return true;

  // Skip auxiliary verbs (these are grammatical, not vocabulary)
  if (pos === '助動詞') return true;

  // Skip prefixes/suffixes that are purely grammatical
  if (pos === '接頭詞') return true;

  // Skip proper nouns (person names, place names, organization names)
  // These appear in example sentences but aren't vocabulary being tested
  if (pos === '名詞' && posDetail1 === '固有名詞') return true;

  // Skip verbal suffixes and bound forms
  if (pos === '動詞' && posDetail1 === '非自立') return true;
  if (pos === '名詞' && posDetail1 === '非自立') return true;

  // Skip interjections
  if (pos === '感動詞') return true;

  // Skip filler/filler-like
  if (pos === 'フィラー') return true;

  // Skip single hiragana/katakana characters (likely particles or counters)
  if (surface.length === 1 && /^[\u3040-\u309F\u30A0-\u30FF]$/.test(surface)) return true;

  // Skip whitespace
  if (!surface.trim()) return true;

  return false;
}

/**
 * Check if a word is in the allowed vocabulary set.
 * Tries multiple forms: surface, basic_form, reading (in hiragana).
 */
function isAllowed(token) {
  const surface = token.surface_form;
  const basic = token.basic_form;
  const reading = token.reading ? token.reading.toLowerCase() : null;

  // Convert katakana reading to hiragana for lookup
  function katakanaToHiragana(str) {
    return str ? str.replace(/[\u30A1-\u30F6]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    ) : null;
  }

  const hiraganaReading = katakanaToHiragana(token.reading || '');

  return (
    allowedVocab.has(surface) ||
    allowedVocab.has(basic) ||
    (hiraganaReading && allowedVocab.has(hiraganaReading)) ||
    alwaysAllowed.has(surface) ||
    alwaysAllowed.has(basic) ||
    (hiraganaReading && alwaysAllowed.has(hiraganaReading))
  );
}

// ---------------------------------------------------------------------------
// Step 4: Run validation on all facts
// ---------------------------------------------------------------------------

const flaggedFactDetails = [];
const flaggedWordCounts = {}; // word -> { count, basicForm, sentences: [id...] }
let cleanCount = 0;

for (const fact of factsWithSentences) {
  const japanesePart = extractJapanesePart(fact.exampleSentence);
  if (!japanesePart) continue;

  const tokens = tokenizer.tokenize(japanesePart);

  // Get the grammar point itself (the correct answer / reading) to be lenient about it
  const grammarPoint = fact.reading || fact.correctAnswer || '';

  const flaggedWords = [];

  for (const token of tokens) {
    if (shouldSkipToken(token)) continue;

    // Be lenient about the grammar point itself
    const surface = token.surface_form;
    const basic = token.basic_form;
    if (grammarPoint && (surface.includes(grammarPoint) || basic.includes(grammarPoint))) continue;
    if (grammarPoint && (grammarPoint.includes(surface) || grammarPoint.includes(basic))) continue;

    if (!isAllowed(token)) {
      const wordKey = basic !== '*' ? basic : surface;
      if (wordKey && wordKey !== '*' && !/^[a-zA-Z0-9\s\p{P}]+$/u.test(wordKey)) {
        flaggedWords.push(wordKey);
      }
    }
  }

  if (flaggedWords.length === 0) {
    cleanCount++;
  } else {
    // Deduplicate flagged words for this sentence
    const uniqueFlaggedWords = [...new Set(flaggedWords)];

    flaggedFactDetails.push({
      id: fact.id,
      jlptLevel: fact.jlptLevel || 'unknown',
      grammarPoint: grammarPoint,
      sentence: fact.exampleSentence,
      english: fact.explanation || '',
      flaggedWords: uniqueFlaggedWords,
    });

    // Accumulate word frequency counts
    for (const word of uniqueFlaggedWords) {
      if (!flaggedWordCounts[word]) {
        flaggedWordCounts[word] = { count: 0, basicForm: word, sentences: [] };
      }
      flaggedWordCounts[word].count++;
      flaggedWordCounts[word].sentences.push(fact.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Step 5: Build output and save
// ---------------------------------------------------------------------------

// Sort flagged words by frequency
const sortedFlaggedWords = Object.fromEntries(
  Object.entries(flaggedWordCounts).sort((a, b) => b[1].count - a[1].count)
);

const output = {
  totalFacts: factsWithSentences.length,
  cleanFacts: cleanCount,
  flaggedFacts: flaggedFactDetails.length,
  flaggedWords: sortedFlaggedWords,
  flaggedFactDetails,
};

const outputPath = path.join(ROOT, 'data/raw/japanese/n3-vocab-validation.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

// ---------------------------------------------------------------------------
// Step 6: Console summary
// ---------------------------------------------------------------------------

console.log('═══════════════════════════════════════════════════════');
console.log('  N3 Vocabulary Validation Results');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Total facts with Japanese sentences: ${factsWithSentences.length}`);
console.log(`  Clean facts (all vocab N3 or below):  ${cleanCount}`);
console.log(`  Flagged facts (above-N3 words found): ${flaggedFactDetails.length}`);
const pct = ((flaggedFactDetails.length / factsWithSentences.length) * 100).toFixed(1);
console.log(`  Flag rate: ${pct}%`);
console.log('');

// Top 20 most common above-N3 words
console.log('  Top 20 most common above-N3 words:');
console.log('  ─────────────────────────────────────────');
const top20 = Object.entries(sortedFlaggedWords).slice(0, 20);
for (const [word, info] of top20) {
  console.log(`    ${word.padEnd(12)} × ${String(info.count).padStart(3)} sentences`);
}

console.log('');
console.log('  5 Sample flagged sentences:');
console.log('  ─────────────────────────────────────────');
for (const fact of flaggedFactDetails.slice(0, 5)) {
  console.log(`  [${fact.jlptLevel}] ${fact.grammarPoint}`);
  console.log(`    Sentence:  ${fact.sentence}`);
  console.log(`    Flagged:   ${fact.flaggedWords.join(', ')}`);
  console.log('');
}

console.log(`\n  Output saved to: data/raw/japanese/n3-vocab-validation.json`);
console.log('═══════════════════════════════════════════════════════');
