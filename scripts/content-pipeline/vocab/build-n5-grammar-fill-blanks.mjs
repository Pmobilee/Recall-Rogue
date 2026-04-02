#!/usr/bin/env node
/**
 * build-n5-grammar-fill-blanks.mjs
 *
 * THREE-PHASE PIPELINE for Japanese N5 grammar fill-in-the-blank cards:
 *
 *   Phase 1 — Fill-blank extraction
 *     Reads grammar-n5-sentences.json, locates each grammar point within
 *     its example sentences, and replaces it with {___}.
 *
 *     Single-char particles (は, が, を, に, で, へ, も, の, か, と, や):
 *       Use first occurrence of the particle character in the sentence.
 *       The N5 sentences are authored to be unambiguous.
 *
 *     Multi-char patterns (てください, ている, です, etc.):
 *       Direct indexOf match; te-form surface matching for compound forms.
 *
 *   Phase 2 — Confusion-group distractor generation
 *     Uses grammar-n5-confusion-groups.json for same-group and same-slot
 *     distractors (same 3-tier strategy as N3 script).
 *
 *   Phase 3 — CuratedDeck assembly
 *     Builds and writes data/decks/japanese_n5_grammar.json.
 *
 * Usage:
 *   node scripts/content-pipeline/vocab/build-n5-grammar-fill-blanks.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..', '..', '..');

// ─── Input paths ───────────────────────────────────────────────────────────
const SENTENCES_FILE = path.join(ROOT, 'data/raw/japanese/grammar-n5-sentences.json');
const CG_FILE        = path.join(ROOT, 'data/raw/japanese/grammar-n5-confusion-groups.json');

// ─── Output path ───────────────────────────────────────────────────────────
const OUT_FILE = path.join(ROOT, 'data/decks/japanese_n5_grammar.json');

// ─── Load sources ──────────────────────────────────────────────────────────
console.log('Loading source files…');
const sentenceData = JSON.parse(readFileSync(SENTENCES_FILE, 'utf8'));
const cgData       = JSON.parse(readFileSync(CG_FILE,        'utf8'));

console.log(`Loaded ${sentenceData.length} N5 grammar points from sentences file`);

// ─── Build confusion-group lookup tables ────────────────────────────────────

/** grammarPoints indexed by sourceId */
const cgBySourceId = {};
for (const gp of cgData.grammarPoints) {
  cgBySourceId[gp.sourceId] = gp;
}

/**
 * For each confusionGroupId, the list of sourceIds that belong to it.
 * @type {Record<string, string[]>}
 */
const groupMembers = {};
for (const cg of cgData.confusionGroups) {
  groupMembers[cg.id] = cg.members; // array of sourceIds
}

/**
 * For each syntactic slot, the list of sourceIds that belong to it.
 * @type {Record<string, string[]>}
 */
const slotMembers = {};
for (const gp of cgData.grammarPoints) {
  for (const slot of (gp.slots || [])) {
    if (!slotMembers[slot]) slotMembers[slot] = [];
    slotMembers[slot].push(gp.sourceId);
  }
}

/** All sourceIds in the confusion-group data (used as broad distractor pool) */
const allCgSourceIds = Object.keys(cgBySourceId);

// ─── Phase 1: Fill-blank extraction ─────────────────────────────────────────

/**
 * Single-char particles that can be blanked by finding the first occurrence
 * in the sentence. These are all single Japanese characters.
 * N5 sentences are authored such that the target particle is unambiguous.
 */
const SINGLE_CHAR_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'へ', 'も', 'の', 'か', 'と', 'や']);

/**
 * Multi-character grammar patterns that appear as substrings in sentences.
 * Listed longest-first for greedy matching priority.
 */
const MULTI_CHAR_PATTERNS = [
  // Verb forms (longest first)
  'なくてはいけません', 'なくてはならない', 'ないといけない', 'なくてもいい',
  'たことがあります', 'たことがありません', 'たことがありますか',
  'ていません', 'ています', 'ていた', 'ていない', 'ている',
  'てください', 'てはいけません', 'てはいけない', 'てもいいですか', 'てもいいです', 'てもいい',
  'ないでください',
  'ちゃいけない',
  'てある', 'てあります',
  'てから',
  'たり', // handled specially (double tari)
  'すぎる', 'すぎます', 'すぎた', 'すぎました',
  'なくちゃ',
  'なる', 'なります', 'なった', 'なりました',
  'に行く', 'に行きます', 'に行きました', 'に行きませんか',
  'にする', 'にします', 'にしましょう', 'にしますか',
  'ましょうか', 'ましょう',
  'ませんか',
  'たい', 'たいです', 'たいですか',
  'つもり', 'つもりです', 'つもりですか',
  'ほうがいい', 'ほうがいいですよ', 'ほうがいいと',
  'がほしい', 'がほしいです', 'がほしかった',
  'のが上手', 'のが下手', 'のが好き',
  // Copula / sentence enders
  'じゃない', 'ではない', 'じゃありません', 'ではありません',
  'だろう',
  'でしょう',
  'んです', 'のです', 'んですか', 'のですか',
  'と思います', 'と思いますか',
  // Existence
  'がある', 'があります', 'がありません', 'がありますか',
  'がいる', 'がいます', 'がいません', 'がいますか',
  // Comparison patterns
  'より', 'の中で', 'が一番',
  'はどうですか', 'どうですか',
  // Reason / temporal
  'から', 'ので', 'てから', 'の前に', '前に',
  'まで',
  // Conjunctions
  'けれども', 'けど', 'しかし', 'そして', 'それから', 'でも',
  // Honorific
  'をください',
  // Limit
  'だけ',
  // Manner
  'いっしょに', '一緒に',
  'いつも',
  'いちばん', '一番',
  'まだ', 'もう',
  // Question words
  'どうして', 'どうやって', 'どんな', 'いくら', '何',
  // Demonstratives (multi-char)
  'これ', 'それ', 'あれ',
  'この', 'その', 'あの',
  'ここ', 'そこ', 'あそこ',
  // Misc
  '方',
  'と思う',
  'ね', 'よ',
];

/**
 * Normalize a grammar point's "point" field to the search term:
 * - strip leading 〜/~
 * - strip trailing parentheticals like (topic marker), (what), etc.
 * - strip embedded slashes — use the first option
 * @param {string} point
 * @returns {string[]} — one or more search candidates, try in order
 */
function normalizePoint(point) {
  // Strip leading 〜 or ~
  let s = point.replace(/^[〜~]/, '').trim();

  // Strip trailing ASCII parentheticals: (topic marker), (subject marker), etc.
  s = s.replace(/\s*\([^)]+\)\s*$/, '').trim();
  // Strip trailing Japanese parentheticals
  s = s.replace(/\s*（[^）]+）\s*$/, '').trim();

  // If it contains ' / ', produce both variants
  if (s.includes(' / ')) {
    return s.split(' / ').map(v => v.trim()).filter(Boolean);
  }

  // For compound patterns like は〜がある, return the full pattern and also try subparts
  if (s.includes('〜')) {
    // Return the string as-is (will fail indexOf), caller will use secondary strategies
    return [s];
  }

  return [s];
}

/**
 * Given a grammar point's pointId and its point text, locate the grammar
 * point in the sentence and create the blanked version.
 *
 * Strategy:
 *   1. For single-char particles: find first occurrence of the char
 *   2. For multi-char patterns: direct indexOf on the normalized form
 *   3. Progressive partial suffix match (longest first, min length 2)
 *   4. Progressive partial prefix match
 *
 * @param {string} pointId  - e.g. "n5-particle-wa"
 * @param {string} point    - e.g. "は (topic marker)"
 * @param {string} phrase   - the example sentence
 * @returns {{ blankedSentence: string, blankAnswer: string } | null}
 */
function extractBlank(pointId, point, phrase) {
  if (!phrase || !phrase.trim()) return null;

  const candidates = normalizePoint(point);

  for (const candidate of candidates) {
    // ── Strategy 1: Single-char particle ──────────────────────────────────
    if (candidate.length === 1 && SINGLE_CHAR_PARTICLES.has(candidate)) {
      const idx = phrase.indexOf(candidate);
      if (idx >= 0) {
        const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + 1);
        return { blankedSentence, blankAnswer: candidate };
      }
    }

    // ── Strategy 2: Direct indexOf ──────────────────────────────────────
    const directIdx = phrase.indexOf(candidate);
    if (directIdx >= 0) {
      const blankedSentence = phrase.slice(0, directIdx) + '{___}' + phrase.slice(directIdx + candidate.length);
      return { blankedSentence, blankAnswer: candidate };
    }
  }

  // ── Strategy 3: Use pointId to drive a targeted search ────────────────
  // For compound patterns (〜がある, 〜がいる, 〜てから, etc.) the full canonical
  // form may appear verbatim in the sentence.

  // Try common conjugated forms for te-form patterns derived from pointId
  const teFormMap = {
    'n5-verb-te-iru':         ['ています', 'ていた', 'ていない', 'ていました', 'ていません', 'ている'],
    'n5-verb-te-kudasai':     ['てください'],
    'n5-verb-nai-de-kudasai': ['ないでください'],
    'n5-verb-te-mo-ii':       ['てもいいですか', 'てもいいです', 'てもいいですよ', 'てもいい'],
    'n5-verb-te-wa-ikenai':   ['てはいけません', 'てはいけない'],
    'n5-verb-cha-ikenai':     ['ちゃいけない'],
    'n5-verb-te-aru':         ['てあります', 'てある'],
    'n5-verb-te-kara':        ['てから'],
    'n5-verb-tari-tari':      ['たり'],
    'n5-verb-sugiru':         ['すぎました', 'すぎます', 'すぎた', 'すぎる', 'すぎない'],
    'n5-verb-naru':           ['になりました', 'になります', 'になった', 'になる', 'になりたい', 'なって'],
    'n5-verb-ni-iku':         ['に行きます', 'に行きました', 'に行きませんか', 'に行きたい', 'に行く'],
    'n5-verb-ni-suru':        ['にします', 'にしましょう', 'にしますか', 'にする'],
    'n5-verb-tai':            ['たいです', 'たいですか', 'たい'],
    'n5-verb-te-kara':        ['てから'],
    'n5-must-nakereba-naranai': ['なくてはいけません', 'なくてはいけない'],
    'n5-must-nakute-naranai':   ['なくてはならない'],
    'n5-must-naito-ikenai':     ['ないといけない'],
    'n5-must-nakucha':          ['なくちゃ'],
    'n5-must-nakute-mo-ii':     ['なくてもいい', 'なくてもいいですよ', 'なくてもいいです'],
    'n5-should-hou-ga-ii':      ['ほうがいいですよ', 'ほうがいいと', 'ほうがいいよ', 'ほうがいい'],
    'n5-want-ga-hoshii':        ['がほしいです', 'がほしかった', 'がほしいですか', 'がほしい'],
    'n5-exist-ga-aru':          ['があります', 'がありません', 'がありますか', 'がある'],
    'n5-exist-ga-iru':          ['がいます', 'がいません', 'がいますか', 'がいる'],
    'n5-intent-tsumori':        ['つもりです', 'つもりですか', 'つもり'],
    'n5-exp-n-desu':            ['んです', 'んですか', 'のです', 'のですか'],
    'n5-quote-to-omou':         ['と思います', 'と思いますか', 'と思う'],
    'n5-way-kata':              ['読み方', '書き方', '使い方', '炊き方', '方'],
    'n5-comp-wa-yori':          ['より'],
    'n5-comp-yori-hou-ga':      ['より'],
    'n5-comp-no-naka-de-ichiban': ['の中で'],
    'n5-inv-mashou':            ['ましょう'],
    'n5-inv-masen-ka':          ['ませんか'],
    'n5-inv-mashou-ka':         ['ましょうか'],
    'n5-inv-dou-desu-ka':       ['はどうですか', 'どうですか'],
    'n5-skill-no-ga-jozu':      ['のが上手'],
    'n5-skill-no-ga-heta':      ['のが下手'],
    'n5-skill-no-ga-suki':      ['のが好き'],
    'n5-req-wo-kudasai':        ['をください'],
    'n5-honor-o-go':            ['お', 'ご'],
    'n5-copula-da':             ['です', 'だ'],
    'n5-copula-janai':          ['じゃない', 'ではない', 'じゃありません', 'ではありません'],
    'n5-copula-darou':          ['だろう'],
    'n5-copula-deshou':         ['でしょう'],
    'n5-sfp-ne':                ['ね'],
    'n5-sfp-yo':                ['よ'],
    'n5-reason-kara':           ['から'],
    'n5-reason-node':           ['ので'],
    'n5-time-mae-ni':           ['前に'],
    'n5-time-mada-te-imasen':   ['まだ'],
    'n5-adv-mada':              ['まだ'],
    'n5-adv-mou':               ['もう'],
    'n5-adv-issho-ni':          ['いっしょに', '一緒に'],
    'n5-adv-itsumo':            ['いつも'],
    'n5-adv-ichiban':           ['いちばん', '一番'],
    'n5-limit-dake':            ['だけ'],
    'n5-qw-nani':               ['何'],
    'n5-qw-ikura':              ['いくら', '幾ら', '幾等'],
    'n5-qw-doshite':            ['どうして'],
    'n5-qw-douyatte':           ['どうやって'],
    'n5-qw-donna':              ['どんな'],
    'n5-dem-kore-sore-are':     ['これ', 'それ', 'あれ'],
    'n5-dem-kono-sono-ano':     ['この', 'その', 'あの'],
    'n5-dem-koko-soko-asoko':   ['ここ', 'そこ', 'あそこ'],
    'n5-conj-shikashi':         ['しかし'],
    'n5-conj-sorekara':         ['それから'],
    'n5-conj-soshite':          ['そして'],
    'n5-conj-kedo':             ['けど'],
    'n5-conj-keredomo':         ['けれども'],
    'n5-particle-de-mo':        ['でも'],
    'n5-particle-no-possessive':['がある', 'があります'],
    'n5-particle-made':         ['まで'],
    'n5-particle-kara-from':    ['から'],
    'n5-particle-to':           ['と'],
    'n5-particle-ya':           ['や'],
    'n5-particle-ka-or':        ['か'],
    'n5-particle-ka':           ['か'],
    'n5-particle-no':           ['の'],
    'n5-particle-mo':           ['も'],
    'n5-particle-he':           ['へ'],
    'n5-particle-ni-he':        ['に'],
    'n5-particle-ga-subject':   ['が'],
    'n5-particle-ga-contrast':  ['が'],
    'n5-particle-wo':           ['を'],
    'n5-particle-ni-location':  ['に'],
    'n5-particle-ni-indirect':  ['に'],
    'n5-particle-de':           ['で'],
    'n5-particle-wa':           ['は'],
    'n5-adj-i':                 ['い'],
    'n5-adj-na':                ['な'],
    'n5-verb-ta-koto-ga-aru':   ['たことがあります', 'たことがありません', 'たことがありますか', 'たことがある'],
  };

  const forms = teFormMap[pointId];
  if (forms) {
    for (const form of forms) {
      const idx = phrase.indexOf(form);
      if (idx >= 0) {
        const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + form.length);
        return { blankedSentence, blankAnswer: form };
      }
    }
  }

  // ── Strategy 4: Partial suffix match on all candidates ─────────────────
  for (const candidate of candidates) {
    if (candidate.length > 2) {
      for (let len = candidate.length - 1; len >= 2; len--) {
        const sub = candidate.slice(-len);
        const idx = phrase.indexOf(sub);
        if (idx >= 0) {
          const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + sub.length);
          return { blankedSentence, blankAnswer: sub };
        }
      }
      for (let len = candidate.length - 1; len >= 2; len--) {
        const sub = candidate.slice(0, len);
        const idx = phrase.indexOf(sub);
        if (idx >= 0) {
          const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + sub.length);
          return { blankedSentence, blankAnswer: sub };
        }
      }
    }
  }

  return null;
}

/**
 * Assign difficulty based on the grammar point type and number of sentences.
 * N5 content:
 *   - Basic single-char particles → 1 (easiest)
 *   - Common verb forms / copula / connectors → 2
 *   - More complex patterns (obligation, te-form compound) → 3
 *   - Advanced compound patterns → 4
 *
 * @param {string} pointId
 * @param {number} sentenceCount
 * @returns {number}
 */
function assignDifficulty(pointId, sentenceCount) {
  // Basic single-char particles
  if (['n5-particle-wa', 'n5-particle-ga-subject', 'n5-particle-wo',
       'n5-particle-ni-location', 'n5-particle-de', 'n5-particle-mo',
       'n5-particle-no', 'n5-particle-he'].includes(pointId)) return 1;

  // Common question words and demonstratives
  if (['n5-qw-nani', 'n5-dem-kore-sore-are', 'n5-dem-kono-sono-ano',
       'n5-dem-koko-soko-asoko', 'n5-particle-ka'].includes(pointId)) return 1;

  // Basic copula, simple verb endings
  if (['n5-copula-da', 'n5-sfp-ne', 'n5-sfp-yo',
       'n5-verb-te-kudasai', 'n5-verb-tai', 'n5-exist-ga-aru',
       'n5-exist-ga-iru', 'n5-limit-dake', 'n5-particle-to',
       'n5-particle-ya', 'n5-particle-made', 'n5-particle-kara-from'].includes(pointId)) return 2;

  // Moderate patterns
  if (['n5-verb-te-iru', 'n5-verb-nai-de-kudasai', 'n5-verb-te-mo-ii',
       'n5-reason-kara', 'n5-reason-node', 'n5-conj-kedo',
       'n5-adv-mada', 'n5-adv-mou', 'n5-adv-issho-ni', 'n5-adv-itsumo',
       'n5-adv-ichiban', 'n5-inv-mashou', 'n5-verb-naru',
       'n5-verb-ni-iku', 'n5-verb-ni-suru', 'n5-want-ga-hoshii',
       'n5-req-wo-kudasai'].includes(pointId)) return 2;

  // More complex patterns
  if (['n5-verb-te-aru', 'n5-verb-te-kara', 'n5-verb-sugiru',
       'n5-verb-ta-koto-ga-aru', 'n5-verb-tari-tari',
       'n5-copula-janai', 'n5-copula-darou', 'n5-copula-deshou',
       'n5-particle-ga-contrast', 'n5-conj-shikashi', 'n5-conj-sorekara',
       'n5-conj-soshite', 'n5-conj-keredomo', 'n5-particle-de-mo',
       'n5-time-mae-ni', 'n5-inv-masen-ka', 'n5-inv-mashou-ka',
       'n5-inv-dou-desu-ka', 'n5-skill-no-ga-jozu', 'n5-skill-no-ga-heta',
       'n5-skill-no-ga-suki', 'n5-honor-o-go', 'n5-exp-n-desu',
       'n5-should-hou-ga-ii', 'n5-intent-tsumori'].includes(pointId)) return 3;

  // Advanced N5 patterns
  if (['n5-must-nakereba-naranai', 'n5-must-nakute-naranai',
       'n5-must-naito-ikenai', 'n5-must-nakucha', 'n5-must-nakute-mo-ii',
       'n5-verb-te-wa-ikenai', 'n5-verb-cha-ikenai',
       'n5-comp-wa-yori', 'n5-comp-yori-hou-ga', 'n5-comp-no-naka-de-ichiban',
       'n5-time-mada-te-imasen', 'n5-quote-to-omou', 'n5-way-kata',
       'n5-particle-ni-he', 'n5-particle-no-possessive',
       'n5-particle-ka-or', 'n5-qw-ikura', 'n5-qw-doshite',
       'n5-qw-douyatte', 'n5-qw-donna'].includes(pointId)) return 3;

  // Catch-all based on sentence count
  if (sentenceCount >= 5) return 2;
  if (sentenceCount >= 3) return 3;
  return 4;
}

/**
 * Assign a funScore for this grammar point.
 * @param {string} pointId
 * @returns {number}
 */
function assignFunScore(pointId) {
  // Surprising or tricky patterns get higher scores
  const high = ['n5-exist-ga-aru', 'n5-exist-ga-iru', 'n5-particle-subject_topic',
    'n5-verb-tari-tari', 'n5-exp-n-desu', 'n5-comp-wa-yori', 'n5-comp-yori-hou-ga',
    'n5-comp-no-naka-de-ichiban', 'n5-way-kata', 'n5-verb-ta-koto-ga-aru',
    'n5-copula-darou', 'n5-copula-deshou'];
  const mid = ['n5-verb-te-iru', 'n5-verb-te-kara', 'n5-verb-sugiru',
    'n5-should-hou-ga-ii', 'n5-intent-tsumori', 'n5-quote-to-omou',
    'n5-time-mae-ni', 'n5-time-mada-te-imasen', 'n5-reason-kara', 'n5-reason-node'];
  if (high.includes(pointId)) return 8;
  if (mid.includes(pointId)) return 7;
  return 6;
}

// ─── Extract fill-blank facts ───────────────────────────────────────────────

console.log('\nPhase 1: Extracting fill-blank sentences…');

/**
 * @typedef {object} FillBlankFact
 * @property {string}   pointId
 * @property {string}   point
 * @property {string}   meaning
 * @property {string}   reading
 * @property {string}   blankedSentence
 * @property {string}   blankAnswer
 * @property {string}   translation
 * @property {string}   fullSentence
 * @property {number}   sentenceIdx
 * @property {number}   difficulty
 * @property {number}   funScore
 * @property {string}   sourceUrl
 * @property {string[]} syntacticSlots
 * @property {string[]} confusionGroupIds
 */

/** @type {FillBlankFact[]} */
const extractedFacts = [];

/** Points with zero extractable sentences */
const zeroExtract = [];

/** Counts for stats */
const slotCounts  = {};
const groupCounts = {};
let   skippedPhrases = 0;

for (const sentenceEntry of sentenceData) {
  const { pointId, point, sentences = [] } = sentenceEntry;

  const cgInfo = cgBySourceId[pointId];
  if (!cgInfo) {
    // Grammar point not in confusion groups — still extract with fallback slot
    // We'll give it grammar_misc
  }

  const syntacticSlots    = cgInfo?.slots  || ['grammar_misc'];
  const confusionGroupIds = cgInfo?.confusionGroups || [];
  const reading           = cgInfo?.reading || point.replace(/^〜/, '').replace(/\s*\(.*\)/, '').trim();
  const meaning           = cgInfo?.meaning || '';

  const difficulty = assignDifficulty(pointId, sentences.length);
  const funScore   = assignFunScore(pointId);
  let   factsThisPoint = 0;

  for (let si = 0; si < sentences.length; si++) {
    const sentObj = sentences[si];
    const raw     = sentObj.originalPhrase || sentObj.phrase || '';

    if (!raw.trim()) { skippedPhrases++; continue; }

    const translation = sentObj.translation || '';
    const result      = extractBlank(pointId, point, raw);

    if (!result) {
      skippedPhrases++;
      continue;
    }

    extractedFacts.push({
      pointId,
      point:          point.replace(/^〜/, '').trim(),
      meaning,
      reading,
      blankedSentence: result.blankedSentence,
      blankAnswer:     result.blankAnswer,
      translation,
      fullSentence:    raw,
      sentenceIdx:     si,
      difficulty,
      funScore,
      sourceUrl:       sentenceEntry.fjsd_id
        ? `https://jlptsensei.com/jlpt-n5-grammar-list/`
        : 'https://jlptsensei.com/jlpt-n5-grammar-list/',
      syntacticSlots,
      confusionGroupIds,
    });

    factsThisPoint++;
  }

  if (factsThisPoint === 0) {
    zeroExtract.push(point);
  }

  // Slot/group stats
  for (const slot of syntacticSlots) {
    slotCounts[slot] = (slotCounts[slot] || 0) + factsThisPoint;
  }
  for (const grp of confusionGroupIds) {
    groupCounts[grp] = (groupCounts[grp] || 0) + factsThisPoint;
  }
}

console.log(`  Extracted ${extractedFacts.length} fill-blank facts`);
console.log(`  ${skippedPhrases} sentences skipped (no match)`);
console.log(`  ${zeroExtract.length} grammar points with 0 extractable sentences`);
if (zeroExtract.length > 0) {
  console.log('  → ' + zeroExtract.join(', '));
}

// ─── Phase 2: Distractor generation ─────────────────────────────────────────

console.log('\nPhase 2: Generating distractors…');

/**
 * Deterministic shuffle (seeded by factIndex to keep output stable).
 * Uses a simple LCG.
 * @param {T[]} arr
 * @param {number} seed
 * @returns {T[]}
 * @template T
 */
function deterministicShuffle(arr, seed) {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Get the canonical display text for a grammar point sourceId.
 * Returns the clean answer text (stripped of leading 〜, parentheticals).
 * For multi-variant points (A / B), returns the first variant.
 * @param {string} sid
 * @returns {string|null}
 */
function pointTextForId(sid) {
  const entry = cgBySourceId[sid];
  if (!entry) return null;

  let raw = entry.point || '';
  // Strip leading 〜/~
  raw = raw.replace(/^[〜~]/, '').trim();
  // Strip trailing parentheticals
  raw = raw.replace(/\s*\([^)]+\)\s*$/, '').trim();
  raw = raw.replace(/\s*（[^）]+）\s*$/, '').trim();
  // For A / B variants, take first
  if (raw.includes(' / ')) {
    raw = raw.split(' / ')[0].trim();
  }
  return raw || null;
}

/**
 * Build the distractor list for a single fill-blank fact.
 * Returns an array of 5–10 distractor strings (never the correct answer).
 *
 * @param {FillBlankFact} fact
 * @param {number}        factIndex
 * @returns {string[]}
 */
function buildDistractors(fact, factIndex) {
  const { blankAnswer, pointId, confusionGroupIds, syntacticSlots } = fact;

  /** Resolve a sourceId to a display string, filtering same-answer dupes */
  function resolveDistractor(sid) {
    if (sid === pointId) return null;
    const text = pointTextForId(sid);
    if (!text) return null;
    if (text === blankAnswer) return null;
    return text;
  }

  // Priority 1: same confusion group members
  const sameGroupIds = confusionGroupIds.flatMap(gid => groupMembers[gid] || []);
  const sameGroupDistractors = [...new Set(sameGroupIds)]
    .map(resolveDistractor)
    .filter(Boolean);

  // Priority 2: same syntactic slot, not in confusion group
  const sameSlotIds = syntacticSlots.flatMap(slot => slotMembers[slot] || []);
  const notInGroup  = new Set(sameGroupIds);
  const sameSlotDistractors = [...new Set(sameSlotIds)]
    .filter(sid => !notInGroup.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  // Priority 3: broad pool (all other grammar points)
  const alreadyUsed = new Set([...sameGroupIds, ...sameSlotIds, pointId]);
  const broadDistractors = allCgSourceIds
    .filter(sid => !alreadyUsed.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  // Shuffle each tier deterministically
  const shuffledGroup = deterministicShuffle(sameGroupDistractors, factIndex);
  const shuffledSlot  = deterministicShuffle(sameSlotDistractors,  factIndex + 1000);
  const shuffledBroad = deterministicShuffle(broadDistractors,     factIndex + 2000);

  // Pick: up to 4 from group, up to 4 from slot, 1–2 from broad; target 8–10 total
  const picked = new Set();

  for (const d of shuffledGroup) {
    if (picked.size >= 4) break;
    picked.add(d);
  }
  for (const d of shuffledSlot) {
    if (picked.size >= 8) break;
    picked.add(d);
  }
  for (const d of shuffledBroad) {
    if (picked.size >= 10) break;
    picked.add(d);
  }

  // Final dedup against answer and deduplicate display text
  const seen = new Set([blankAnswer]);
  const result = [];
  for (const d of picked) {
    if (!seen.has(d)) {
      seen.add(d);
      result.push(d);
    }
  }

  return result;
}

// Generate distractors for all facts
let distractorCovered = 0;
for (let i = 0; i < extractedFacts.length; i++) {
  const fact = extractedFacts[i];
  fact.distractors = buildDistractors(fact, i);
  if (fact.distractors.length > 0) distractorCovered++;
}

console.log(`  ${distractorCovered}/${extractedFacts.length} facts have at least one distractor`);

// ─── Phase 3: CuratedDeck assembly ──────────────────────────────────────────

console.log('\nPhase 3: Assembling CuratedDeck…');

// ── Fact IDs and pool grouping ────────────────────────────────────────────────

const factIdsBySlot = {};
const factIdList    = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const fact   = extractedFacts[i];
  const factId = `ja-gram-n5-${fact.pointId}-fill-${fact.sentenceIdx}`;
  factIdList.push(factId);

  for (const slot of fact.syntacticSlots) {
    if (!factIdsBySlot[slot]) factIdsBySlot[slot] = [];
    factIdsBySlot[slot].push(factId);
  }
}

// Pools: one per slot with ≥5 facts; merge small slots into grammar_misc
const bigSlots = Object.entries(factIdsBySlot).filter(([, ids]) => ids.length >= 5);
const miscIds  = Object.entries(factIdsBySlot)
  .filter(([, ids]) => ids.length < 5)
  .flatMap(([, ids]) => ids);

/** @type {Array<{ id: string, label: string, answerFormat: string, factIds: string[], minimumSize: number }>} */
const answerTypePools = bigSlots.map(([slot, ids]) => ({
  id:           slot,
  label:        cgData.syntacticSlots[slot]?.label || slot,
  answerFormat: 'word',
  factIds:      ids,
  minimumSize:  5,
}));

if (miscIds.length > 0) {
  answerTypePools.push({
    id:           'grammar_misc',
    label:        'Miscellaneous Grammar',
    answerFormat: 'word',
    factIds:      miscIds,
    minimumSize:  5,
  });
}

// Master pool covering all facts
answerTypePools.unshift({
  id:           'grammar_all',
  label:        'All N5 Grammar Points',
  answerFormat: 'word',
  factIds:      [...factIdList],
  minimumSize:  5,
});

// ── Synonym groups from confusion data ──────────────────────────────────────

const synonymGroups = cgData.synonymGroups.map(sg => ({
  id:      sg.id,
  factIds: (sg.members || sg.memberIds || [])
    .flatMap(sid => extractedFacts
      .filter(f => f.pointId === sid)
      .map(f => `ja-gram-n5-${f.pointId}-fill-${f.sentenceIdx}`))
    .filter((v, i, arr) => arr.indexOf(v) === i),
  reason:  sg.reason,
})).filter(sg => sg.factIds.length >= 2);

// ── Difficulty tiers ─────────────────────────────────────────────────────────

const easyIds   = [];
const mediumIds = [];
const hardIds   = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const { difficulty, pointId, sentenceIdx } = extractedFacts[i];
  const factId = `ja-gram-n5-${pointId}-fill-${sentenceIdx}`;
  if (difficulty <= 2)      easyIds.push(factId);
  else if (difficulty <= 3) mediumIds.push(factId);
  else                      hardIds.push(factId);
}

const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds   },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard',   factIds: hardIds   },
];

// ── Build DeckFact objects ───────────────────────────────────────────────────

const facts = extractedFacts.map((fact, i) => {
  const factId = `ja-gram-n5-${fact.pointId}-fill-${fact.sentenceIdx}`;

  // Primary pool: first big slot, or grammar_misc
  const primarySlot = fact.syntacticSlots.find(s =>
    bigSlots.some(([slot]) => slot === s)
  ) || 'grammar_misc';

  // Clean point text for display in answer/explanation
  const cleanPoint = fact.blankAnswer;

  return {
    id:                     factId,
    correctAnswer:          cleanPoint,
    acceptableAlternatives: [],
    chainThemeId:           i % 6,
    answerTypePoolId:       primarySlot,
    difficulty:             fact.difficulty,
    funScore:               fact.funScore,
    quizQuestion:           `${fact.blankedSentence}\n(${fact.translation})`,
    explanation:            `${fact.blankAnswer} (${fact.meaning || fact.point}) — ${fact.fullSentence}`,
    visualDescription:      'Japanese grammar study card with sentence completion',
    sourceName:             'FJSD + standard textbook (CC BY-SA 4.0)',
    sourceUrl:              fact.sourceUrl,
    volatile:               false,
    distractors:            fact.distractors,
    targetLanguageWord:     fact.blankAnswer,
    reading:                fact.reading,
    language:               'ja',
    pronunciation:          fact.reading,
    partOfSpeech:           'grammar',
    examTags:               ['JLPT_N5'],
  };
});

// ── Assemble the CuratedDeck ─────────────────────────────────────────────────

const curatedDeck = {
  id:          'japanese_n5_grammar',
  name:        'Japanese N5 Grammar',
  domain:      'vocabulary',
  subDomain:   'japanese_grammar',
  description: 'Master the 90 foundational Japanese grammar patterns tested at JLPT N5 — from basic particles and verb conjugations to sentence patterns and question words. Fill in the blank to prove you know which grammar point fits each sentence.',
  minimumFacts: 200,
  targetFacts:  facts.length,
  facts,
  answerTypePools,
  synonymGroups,
  questionTemplates: [
    {
      id:                   'fill_blank_grammar',
      answerPoolId:         'grammar_all',
      questionFormat:       '{quizQuestion}',
      availableFromMastery: 0,
      difficulty:           2,
      reverseCapable:       false,
    },
  ],
  difficultyTiers,
};

// ─── Write output ────────────────────────────────────────────────────────────

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(curatedDeck, null, 2), 'utf8');
console.log(`\nWrote ${facts.length} facts to ${OUT_FILE}`);

// ─── Statistics ──────────────────────────────────────────────────────────────

console.log('\n════════════════════════════════════════════════════════════');
console.log('                        PIPELINE STATS                      ');
console.log('════════════════════════════════════════════════════════════');
console.log(`Total grammar points processed : ${sentenceData.length}`);
console.log(`Total fill-blank facts          : ${facts.length}`);
console.log(`Grammar points with 0 sentences: ${zeroExtract.length}`);
if (zeroExtract.length > 0) {
  console.log('  → ' + zeroExtract.slice(0, 20).join(', ') + (zeroExtract.length > 20 ? ' …' : ''));
}

console.log('\nDistribution by syntactic slot:');
for (const [slot, count] of Object.entries(slotCounts).sort((a, b) => b[1] - a[1])) {
  const label = cgData.syntacticSlots[slot]?.label || slot;
  console.log(`  ${label.padEnd(35)} ${count}`);
}

console.log('\nDistribution by confusion group (top 10):');
for (const [grp, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const cg = cgData.confusionGroups.find(g => g.id === grp);
  const label = cg?.label || grp;
  console.log(`  ${label.padEnd(40)} ${count}`);
}

console.log('\nDifficulty distribution:');
console.log(`  Easy   (1–2): ${easyIds.length}`);
console.log(`  Medium (3):   ${mediumIds.length}`);
console.log(`  Hard   (4–5): ${hardIds.length}`);

console.log('\nDistractor coverage:');
const withFive = facts.filter(f => f.distractors.length >= 5).length;
const withAny  = facts.filter(f => f.distractors.length > 0).length;
console.log(`  ≥5 distractors: ${withFive}/${facts.length} facts`);
console.log(`  ≥1 distractor:  ${withAny}/${facts.length} facts`);

console.log('\nAnswer pools:');
for (const pool of answerTypePools) {
  console.log(`  ${pool.id.padEnd(40)} ${pool.factIds.length} facts`);
}

console.log('\nDone ✓');
