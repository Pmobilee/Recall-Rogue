#!/usr/bin/env node
/**
 * build-n4-grammar-fill-blanks.mjs
 *
 * THREE-PHASE PIPELINE for Japanese N4 grammar fill-in-the-blank cards:
 *
 *   Phase 1 — Fill-blank extraction
 *     Reads grammar-n4-sentences.json, locates each grammar point within
 *     its example sentences, and replaces it with {___}.
 *
 *     Single-char particles (と, が, は, etc.):
 *       Use first occurrence in the sentence (authored to be unambiguous).
 *
 *     Multi-char patterns (てしまう, ようになる, させられる, etc.):
 *       Direct indexOf; te-form surface tables for compound conjugated forms.
 *
 *     ば conditional: matched via verb conjugation suffix pattern
 *       (起きれば → blank the ば suffix portion).
 *
 *   Phase 2 — Confusion-group distractor generation
 *     Uses grammar-n4-confusion-groups.json for same-group and same-slot
 *     distractors (same 3-tier strategy as N5 script).
 *
 *   Phase 3 — CuratedDeck assembly
 *     Builds and writes data/decks/japanese_n4_grammar.json.
 *
 * Usage:
 *   node scripts/content-pipeline/vocab/build-n4-grammar-fill-blanks.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..', '..', '..');

// ─── Input paths ───────────────────────────────────────────────────────────
const SENTENCES_FILE = path.join(ROOT, 'data/raw/japanese/grammar-n4-sentences.json');
const CG_FILE        = path.join(ROOT, 'data/raw/japanese/grammar-n4-confusion-groups.json');

// ─── Output path ───────────────────────────────────────────────────────────
const OUT_FILE = path.join(ROOT, 'data/decks/japanese_n4_grammar.json');

// ─── Load sources ──────────────────────────────────────────────────────────
console.log('Loading source files…');
const sentenceData = JSON.parse(readFileSync(SENTENCES_FILE, 'utf8'));
const cgData       = JSON.parse(readFileSync(CG_FILE,        'utf8'));

console.log(`Loaded ${sentenceData.length} N4 grammar points from sentences file`);

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
 * For each syntactic slot (from syntacticSlots keys), the list of sourceIds.
 * N4 slots are defined in cgData.syntacticSlots, membership on each grammarPoint.
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
 * Single-char particles that appear at N4 level.
 * Direct first-occurrence match (N4 sentences authored unambiguously).
 */
const SINGLE_CHAR_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'へ', 'も', 'の', 'か', 'と', 'や', 'ば', 'ね', 'よ']);

/**
 * Te-form surface forms — all fully-conjugated variants for each canonical
 * te-form auxiliary, sorted longest-first for greedy matching.
 * Ported from build-grammar-fill-blanks.mjs (N3 script).
 */
const TE_FORM_SURFACES = {
  'ている':      ['ていました', 'ていません', 'ていなかった', 'ていない', 'ています', 'ていた', 'ていて', 'ている'],
  'てしまう':    ['てしまいました', 'てしまいます', 'てしまった', 'てしまわない', 'てしまう'],
  'でしまう':    ['でしまいました', 'でしまいます', 'でしまった', 'でしまわない', 'でしまう'],
  'ておく':      ['ておきます', 'ておかない', 'ておいた', 'ておいて', 'ておく', 'ておき'],
  'でおく':      ['でおきます', 'でおかない', 'でおいた', 'でおく'],
  'てみる':      ['てみます', 'てみない', 'てみた', 'てみて', 'てみる'],
  'でみる':      ['でみます', 'でみた', 'でみて', 'でみる'],
  'てくる':      ['てきます', 'てこない', 'てきた', 'てきて', 'てくる'],
  'でくる':      ['できます', 'でこない', 'できた', 'できて', 'でくる'],
  'てくれる':    ['てくれます', 'てくれない', 'てくれた', 'てくれて', 'てくれる'],
  'でくれる':    ['でくれます', 'でくれた', 'でくれる'],
  'てあげる':    ['てあげます', 'てあげない', 'てあげた', 'てあげる'],
  'であげる':    ['であげます', 'であげた', 'であげる'],
  'てもらう':    ['てもらいます', 'てもらわない', 'てもらった', 'てもらう'],
  'でもらう':    ['でもらいます', 'でもらった', 'でもらう'],
  'ていく':      ['ていきます', 'ていかない', 'ていった', 'ていく'],
  'でいく':      ['でいきます', 'でいかない', 'でいった', 'でいく'],
  'てほしい':    ['てほしいです', 'てほしかった', 'てほしい'],
  'てよかった':  ['てよかったです', 'てよかった'],
  'てすみません':['てすみません', 'てすみませんでした'],
  'ていただけませんか': ['ていただけませんか', 'ていただけないでしょうか'],
};

/**
 * Multi-character grammar patterns that appear as substrings in N4 sentences.
 * Listed longest-first so we match greedily.
 */
const MULTI_CHAR_PATTERNS = [
  // Causative-passive (longest first)
  'させられる', 'させられました', 'させられた',
  'させてください', 'させてくれ', 'させて',
  'させる', 'させます', 'させた', 'させました',
  'られる', 'られます', 'られた', 'られました',
  // Conditionals (multi-char)
  'たらどうですか', 'たらどうでしょうか', 'たらどう',
  'たらいいですか', 'たらいいか',
  'たら',
  '場合は', '場合に', '場合',
  // Must / obligation
  'なければいけない', 'なければいけません', 'なければなりません', 'なければならない',
  'なくてはいけない', 'なくてはいけません', 'なくてはならない',
  // Expectation
  'はずがない', 'はずがありません', 'はずだ', 'はずです',
  // Hearsay / appearance
  'らしいです', 'らしい',
  'ようだった', 'ようです', 'ようだ',
  'ような', 'ように',
  'みたいだった', 'みたいです', 'みたいだ',
  'みたいな', 'みたいに',
  'そうだった', 'そうです', 'そうだ',
  'そうに', 'そうな',
  'に見えます', 'に見えた', 'に見える',
  // Te-form aspect
  'てしまいました', 'てしまいます', 'てしまった', 'てしまわない', 'てしまう',
  'でしまいました', 'でしまいます', 'でしまった', 'でしまう',
  'ておきます', 'ておいた', 'ておいて', 'ておく', 'ておき',
  'でおきます', 'でおいた', 'でおく',
  'てみます', 'てみた', 'てみて', 'てみる',
  'でみます', 'でみた', 'でみる',
  'ていきます', 'ていった', 'ていく',
  'でいきます', 'でいった', 'でいく',
  'てきます', 'てきた', 'てきて', 'てくる',
  'できます', 'できた', 'できて', 'でくる',
  'てよかったです', 'てよかった',
  'てすみません', 'てすみませんでした',
  'ていただけませんか', 'ていただけないでしょうか',
  // Te-form giving/receiving
  'てあげます', 'てあげた', 'てあげる',
  'であげます', 'であげた', 'であげる',
  'てもらいます', 'てもらった', 'てもらう',
  'でもらいます', 'でもらった', 'でもらう',
  'てくれます', 'てくれた', 'てくれて', 'てくれる',
  'でくれます', 'でくれた', 'でくれる',
  'てやります', 'てやった', 'てやる',
  'てほしいです', 'てほしかった', 'てほしい',
  // Te-form continued
  'ています', 'ていた', 'ていない', 'ている',
  // Honorific / humble
  'でございます', 'でございました',
  'ございます', 'ございました',
  'いらっしゃいます', 'いらっしゃる',
  'なさいます', 'なさった', 'なさる',
  'いたします', 'いたしました', 'いたす',
  'をください',
  'おになります', 'おになる', 'お〜になる',
  // Purpose / intent / change
  'ようになりました', 'ようになります', 'ようになった', 'ようになる',
  'ようにします', 'ようにした', 'ようにする',
  'ようと思います', 'ようと思う',
  'ことにしました', 'ことにします', 'ことにした', 'ことにする',
  'ことになりました', 'ことになります', 'ことになった', 'ことになる',
  'ことができます', 'ことができた', 'ことができる',
  'ことがあります', 'ことがあった', 'ことがある',
  'つもりです', 'つもりだ', 'つもり',
  'よていです', '予定です', '予定だ',
  // Quotation
  'というのは', 'ということ', 'という',
  'と言っても', 'と言ってもいい',
  'と言われている', 'と言われています',
  // Comparison ease/difficulty
  'やすいです', 'やすかった', 'やすい',
  'にくいです', 'にくかった', 'にくい',
  'づらいです', 'づらかった', 'づらい',
  'すぎます', 'すぎた', 'すぎる',
  // Temporal
  '間に', '間',
  'ながら',
  'ところです', 'たところです', 'ているところです',
  'たところ', 'ているところ', 'ところ',
  'たままで', 'たまま', 'まま',
  'までに',
  'の前に', '前に',
  'たばかりです', 'たばかり',
  // Negation degree adverbs
  'なかなか', '全然', 'あまり',
  'ないように', 'ないようにする',
  'ないで', 'なくて',
  // Other
  'なのに',
  'のに',
  'なので', 'ので',
  'けれども', 'けれど', 'けど',
  'しかし',
  'でも',
  'かどうか',
  'ではないか', 'じゃないか',
  'かな', 'かしら',
  'かどうか',
  'が必要です', 'が必要だ', 'が必要',
  'に必要', '必要がある', '必要があります',
  'がほしい', 'がほしいです', 'がほしかった',
  'たがっている', 'たがる',
  'にする', 'にします', 'にした',
  'って',
  'さっき',
];

/**
 * Normalize a grammar point's "point" field to search candidates.
 * - Strip leading 〜/~
 * - Strip trailing parentheticals
 * - For A / B variants, return both
 * @param {string} point
 * @returns {string[]}
 */
function normalizePoint(point) {
  let s = point.replace(/^[〜~]/, '').trim();
  s = s.replace(/\s*\([^)]+\)\s*$/, '').trim();
  s = s.replace(/\s*（[^）]+）\s*$/, '').trim();

  if (s.includes(' / ')) {
    return s.split(' / ').map(v => v.trim()).filter(Boolean);
  }

  if (s.includes('〜')) {
    return [s];
  }

  return [s];
}

/**
 * Try to locate a te-form auxiliary in the phrase using surface tables.
 * Checks each canonical te-form key and its conjugated forms.
 * @param {string} phrase
 * @returns {{ blankedSentence: string, blankAnswer: string } | null}
 */
function tryTeFormSurface(phrase) {
  for (const [, surfaces] of Object.entries(TE_FORM_SURFACES)) {
    for (const surface of surfaces) {
      const idx = phrase.indexOf(surface);
      if (idx >= 0) {
        const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + surface.length);
        return { blankedSentence, blankAnswer: surface };
      }
    }
  }
  return null;
}

/**
 * pointId-driven lookup table for N4 grammar forms.
 * Maps each N4 pointId to the ordered list of surface forms to try.
 * @type {Record<string, string[]>}
 */
const N4_FORM_MAP = {
  // Conditionals
  'n4-cond-ba':               ['れば', 'けば', 'げば', 'ねば', 'べば', 'めば', 'せば', 'てば', 'でば', 'ば'],
  'n4-cond-baai-wa':          ['場合は', '場合に', '場合'],
  'n4-cond-tara':             ['たら', 'だら'],
  'n4-cond-tara-dou':         ['たらどうですか', 'たらどうでしょうか', 'たらどう'],
  'n4-cond-tara-ii-desu-ka':  ['たらいいですか', 'たらいいか'],
  'n4-cond-nara':             ['なら', 'ならば'],
  'n4-cond-to':               ['と'],
  // Te-form aspect
  'n4-te-shimau':             ['てしまいました', 'てしまいます', 'てしまった', 'てしまう', 'でしまいました', 'でしまいます', 'でしまった', 'でしまう', 'ちゃった', 'ちゃう'],
  'n4-te-oku':                ['ておきます', 'ておいた', 'ておいて', 'ておく', 'でおきます', 'でおいた', 'でおく'],
  'n4-te-miru':               ['てみます', 'てみた', 'てみて', 'てみる', 'でみます', 'でみた', 'でみる'],
  'n4-te-iku':                ['ていきます', 'ていった', 'ていく', 'でいきます', 'でいった', 'でいく'],
  'n4-te-kuru':               ['てきます', 'てきた', 'てきて', 'てくる', 'できます', 'できた', 'できて', 'でくる'],
  'n4-te-yokatta':            ['てよかったです', 'てよかった', 'でよかった'],
  'n4-te-sumimasen':          ['てすみませんでした', 'てすみません', 'でしまってすみません'],
  'n4-te-de-conjunctive':     ['て', 'で'],
  // Te-form giving/receiving
  'n4-te-ageru':              ['てあげます', 'てあげた', 'てあげる', 'であげます', 'であげた', 'であげる'],
  'n4-te-morau':              ['てもらいます', 'てもらった', 'てもらう', 'でもらいます', 'でもらった', 'でもらう'],
  'n4-te-kureru':             ['てくれます', 'てくれた', 'てくれて', 'てくれる', 'でくれます', 'でくれた', 'でくれる'],
  'n4-te-yaru':               ['てやります', 'てやった', 'てやる'],
  'n4-te-hoshii':             ['てほしいです', 'てほしかった', 'てほしい'],
  'n4-te-itadakemasen-ka':    ['ていただけませんか', 'ていただけないでしょうか'],
  // Appearance / hearsay
  'n4-app-sou-da-visual':     ['そうです', 'そうだ'],
  'n4-app-sou-da-hearsay':    ['そうです', 'そうだ'],
  'n4-app-sou-ni-na':         ['そうに', 'そうな'],
  'n4-app-rashii':            ['らしいです', 'らしい'],
  'n4-app-you-da':            ['ようだった', 'ようです', 'ようだ'],
  'n4-app-you-ni-na':         ['ような', 'ように'],
  'n4-app-mitai-da':          ['みたいだった', 'みたいです', 'みたいだ'],
  'n4-app-mitai-na':          ['みたいな'],
  'n4-app-mitai-ni':          ['みたいに'],
  'n4-app-ni-mieru':          ['に見えます', 'に見えた', 'に見える'],
  // Causative / passive
  'n4-caus-saseru':           ['させられました', 'させられた', 'させられる', 'させてください', 'させます', 'させた', 'させました', 'させる'],
  'n4-caus-rareru':           ['られました', 'られます', 'られた', 'られる'],
  'n4-caus-saserareru':       ['させられました', 'させられた', 'させられる'],
  'n4-caus-sasete-kudasai':   ['させてください', 'させていただきます', 'させていただけませんか'],
  // Honorific / humble
  'n4-hon-de-gozaimasu':      ['でございます', 'でございました'],
  'n4-hon-gozaimasu':         ['ございます', 'ございました'],
  'n4-hon-irassharu':         ['いらっしゃいます', 'いらっしゃいました', 'いらっしゃる'],
  'n4-hon-nasaru':            ['なさいます', 'なさいました', 'なさった', 'なさる'],
  'n4-hon-itashimasu':        ['いたします', 'いたしました', 'いたす'],
  'n4-hon-o-kudasai':         ['をください'],
  'n4-hon-o-ni-naru':         ['になります', 'になった', 'になる'],
  // Obligation
  'n4-obl-nakereba-ikenai':   ['なければいけない', 'なければいけません'],
  'n4-obl-nakereba-naranai':  ['なければなりません', 'なければならない'],
  'n4-obl-hazu-da':           ['はずです', 'はずだ'],
  'n4-obl-hazu-ga-nai':       ['はずがない', 'はずがありません'],
  // Temporal
  'n4-temp-aida':             ['間'],
  'n4-temp-aida-ni':          ['間に'],
  'n4-temp-nagara':           ['ながら'],
  'n4-temp-tokoro':           ['ところです', 'ところだ', 'ところ'],
  'n4-temp-ta-tokoro':        ['たところです', 'たところだ', 'たところ'],
  'n4-temp-teiru-tokoro':     ['ているところです', 'ているところだ', 'ているところ'],
  'n4-temp-mama':             ['たままで', 'たまま', 'まま'],
  'n4-temp-made-ni':          ['までに'],
  'n4-temp-mae-ni':           ['の前に', '前に'],
  'n4-vm-ta-bakari':          ['たばかりです', 'たばかり'],
  'n4-adv-sakki':             ['さっき'],
  // Difficulty / ease
  'n4-comp-yasui':            ['やすいです', 'やすかった', 'やすい'],
  'n4-comp-nikui':            ['にくいです', 'にくかった', 'にくい'],
  'n4-comp-zurai':            ['づらいです', 'づらかった', 'づらい'],
  'n4-comp-sugiru':           ['すぎます', 'すぎた', 'すぎる'],
  // Purpose / intent / change
  'n4-purp-you-ni-naru':      ['ようになりました', 'ようになります', 'ようになった', 'ようになる'],
  'n4-purp-you-ni-suru':      ['ようにします', 'ようにした', 'ようにする'],
  'n4-purp-you-to-omou':      ['ようと思います', 'ようと思う'],
  'n4-purp-yotei-da':         ['予定です', '予定だ', 'よていです'],
  'n4-purp-koto-ni-suru':     ['ことにしました', 'ことにします', 'ことにした', 'ことにする'],
  'n4-purp-koto-ni-naru':     ['ことになりました', 'ことになります', 'ことになった', 'ことになる'],
  'n4-purp-koto-ga-aru':      ['ことがあります', 'ことがあった', 'ことがある'],
  'n4-purp-koto-ga-dekiru':   ['ことができます', 'ことができた', 'ことができる'],
  'n4-purp-tsumori':          ['つもりです', 'つもりだ', 'つもり'],
  'n4-other-ni-suru':         ['にします', 'にした', 'にする'],
  // Quotation
  'n4-quot-to-iu':            ['ということ', 'という'],
  'n4-quot-to-iu-koto':       ['ということ', 'というのは'],
  'n4-quot-to-ittemo-ii':     ['と言っても', 'と言ってもいい'],
  'n4-quot-to-iwarete-iru':   ['と言われています', 'と言われている'],
  // Negation degree
  'n4-neg-nakanaka-nai':      ['なかなか'],
  'n4-neg-zenzen-nai':        ['全然', 'ぜんぜん'],
  'n4-neg-amari-nai':         ['あまり'],
  'n4-neg-naide':             ['ないで', 'なくて'],
  'n4-neg-nai-you-ni':        ['ないように'],
  // Conjunction / other
  'n4-other-nanode':          ['なので'],
  'n4-other-node':            ['ので'],
  'n4-other-keredomo':        ['けれども', 'けれど', 'けど'],
  'n4-other-shikashi':        ['しかし'],
  'n4-other-demo-but':        ['でも'],
  'n4-part-noni-although':    ['のに', 'なのに'],
  // Particles / misc
  'n4-part-kana':             ['かな'],
  'n4-part-kashira':          ['かしら'],
  'n4-q-ka-dou-ka':           ['かどうか'],
  'n4-q-dewa-nai-ka':         ['ではないか', 'じゃないか'],
  // Desire
  'n4-vm-tagaru':             ['たがっている', 'たがっています', 'たがる'],
  'n4-other-hoshii':          ['がほしいです', 'がほしかった', 'がほしい'],
  'n4-other-ga-hitsuyou':     ['が必要です', 'が必要だ', 'が必要'],
  'n4-other-hitsuyou-ga-aru': ['必要があります', '必要がある'],
  'n4-other-itadakimasu':     ['いただきます', 'いただきました'],
  // Quote/informal
  'n4-quot-tte':              ['って'],
};

/**
 * Locate a grammar point in the sentence and return the blanked version.
 *
 * Strategy order:
 *   1. pointId-driven N4_FORM_MAP lookup (covers most N4 patterns)
 *   2. Direct indexOf on normalized candidates
 *   3. Te-form surface table scan
 *   4. Partial suffix match (longest-first, min 2 chars)
 *   5. Partial prefix match
 *
 * @param {string} pointId  - e.g. "n4-cond-ba"
 * @param {string} point    - e.g. "ば"
 * @param {string} phrase   - example sentence
 * @returns {{ blankedSentence: string, blankAnswer: string } | null}
 */
function extractBlank(pointId, point, phrase) {
  if (!phrase || !phrase.trim()) return null;

  // ── Strategy 1: pointId-driven form map ─────────────────────────────────
  const forms = N4_FORM_MAP[pointId];
  if (forms) {
    for (const form of forms) {
      const idx = phrase.indexOf(form);
      if (idx >= 0) {
        const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + form.length);
        return { blankedSentence, blankAnswer: form };
      }
    }
  }

  const candidates = normalizePoint(point);

  // ── Strategy 2: Direct indexOf on normalized candidates ──────────────────
  for (const candidate of candidates) {
    if (candidate.includes('〜')) continue; // skip compound placeholders

    const directIdx = phrase.indexOf(candidate);
    if (directIdx >= 0) {
      const blankedSentence = phrase.slice(0, directIdx) + '{___}' + phrase.slice(directIdx + candidate.length);
      return { blankedSentence, blankAnswer: candidate };
    }
  }

  // ── Strategy 3: Te-form surface scan ────────────────────────────────────
  const teResult = tryTeFormSurface(phrase);
  if (teResult) return teResult;

  // ── Strategy 4: Partial suffix match on all candidates ──────────────────
  for (const candidate of candidates) {
    if (candidate.includes('〜')) continue;
    if (candidate.length > 2) {
      for (let len = candidate.length - 1; len >= 2; len--) {
        const sub = candidate.slice(-len);
        const idx = phrase.indexOf(sub);
        if (idx >= 0) {
          const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + sub.length);
          return { blankedSentence, blankAnswer: sub };
        }
      }
      // ── Strategy 5: Partial prefix match ──────────────────────────────
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
 * Assign difficulty for N4 grammar points.
 * N4 spans a wider range than N5 — conditionals and basic te-form are
 * intermediate (2–3), causative-passive and honorific/keigo are harder (3–4).
 * @param {string} pointId
 * @param {number} sentenceCount
 * @returns {number}
 */
function assignDifficulty(pointId, sentenceCount) {
  // Basic conditionals that learners encounter early in N4 study
  const easy = [
    'n4-cond-tara', 'n4-cond-nara', 'n4-cond-to',
    'n4-te-shimau', 'n4-te-oku', 'n4-te-miru', 'n4-te-iku', 'n4-te-kuru',
    'n4-te-ageru', 'n4-te-morau', 'n4-te-kureru',
    'n4-app-sou-da-visual', 'n4-app-sou-da-hearsay', 'n4-app-rashii',
    'n4-temp-nagara', 'n4-temp-mae-ni', 'n4-temp-aida', 'n4-temp-aida-ni',
    'n4-purp-tsumori', 'n4-purp-koto-ga-dekiru', 'n4-purp-koto-ga-aru',
    'n4-neg-zenzen-nai', 'n4-neg-amari-nai',
    'n4-other-nanode', 'n4-other-node',
    'n4-other-keredomo', 'n4-other-shikashi', 'n4-other-demo-but',
    'n4-comp-yasui', 'n4-comp-nikui',
  ];

  // Moderate N4 — requires solid understanding of verb morphology
  const medium = [
    'n4-cond-ba', 'n4-cond-baai-wa', 'n4-cond-tara-dou', 'n4-cond-tara-ii-desu-ka',
    'n4-te-yaru', 'n4-te-hoshii', 'n4-te-yokatta', 'n4-te-sumimasen',
    'n4-te-de-conjunctive',
    'n4-app-you-da', 'n4-app-you-ni-na', 'n4-app-mitai-da', 'n4-app-mitai-na',
    'n4-app-mitai-ni', 'n4-app-sou-ni-na', 'n4-app-ni-mieru',
    'n4-obl-nakereba-ikenai', 'n4-obl-nakereba-naranai', 'n4-obl-hazu-da',
    'n4-temp-tokoro', 'n4-temp-ta-tokoro', 'n4-temp-teiru-tokoro',
    'n4-temp-mama', 'n4-temp-made-ni', 'n4-vm-ta-bakari', 'n4-adv-sakki',
    'n4-purp-you-ni-naru', 'n4-purp-you-ni-suru', 'n4-purp-koto-ni-suru',
    'n4-purp-koto-ni-naru', 'n4-purp-you-to-omou', 'n4-purp-yotei-da',
    'n4-quot-to-iu', 'n4-quot-to-iu-koto', 'n4-quot-to-ittemo-ii',
    'n4-neg-nakanaka-nai', 'n4-neg-naide', 'n4-neg-nai-you-ni',
    'n4-part-noni-although', 'n4-part-kana', 'n4-part-kashira',
    'n4-comp-zurai', 'n4-comp-sugiru',
    'n4-vm-tagaru', 'n4-other-hoshii',
    'n4-other-ga-hitsuyou', 'n4-other-hitsuyou-ga-aru',
    'n4-other-ni-suru', 'n4-other-itadakimasu',
    'n4-obl-hazu-ga-nai',
  ];

  // Hard N4 — causative/passive morphology, keigo, advanced patterns
  const hard = [
    'n4-caus-saseru', 'n4-caus-rareru', 'n4-caus-saserareru',
    'n4-caus-sasete-kudasai',
    'n4-hon-de-gozaimasu', 'n4-hon-gozaimasu', 'n4-hon-irassharu',
    'n4-hon-nasaru', 'n4-hon-itashimasu', 'n4-hon-o-kudasai', 'n4-hon-o-ni-naru',
    'n4-te-itadakemasen-ka',
    'n4-quot-to-iwarete-iru',
    'n4-q-ka-dou-ka', 'n4-q-dewa-nai-ka',
    'n4-quot-tte',
  ];

  if (easy.includes(pointId))   return 2;
  if (medium.includes(pointId)) return 3;
  if (hard.includes(pointId))   return 4;

  // Fallback by sentence count
  if (sentenceCount >= 5) return 2;
  if (sentenceCount >= 3) return 3;
  return 4;
}

/**
 * Assign funScore for N4 grammar points.
 * Tricky, pragmatically-rich, or direction-sensitive patterns score higher.
 * @param {string} pointId
 * @returns {number}
 */
function assignFunScore(pointId) {
  const high = [
    'n4-cond-ba', 'n4-cond-tara', 'n4-cond-nara', 'n4-cond-to',
    'n4-te-shimau', 'n4-te-ageru', 'n4-te-morau', 'n4-te-kureru',
    'n4-caus-saserareru', 'n4-caus-saseru', 'n4-caus-rareru',
    'n4-app-sou-da-visual', 'n4-app-sou-da-hearsay',
    'n4-purp-you-ni-naru', 'n4-purp-koto-ni-suru', 'n4-purp-koto-ni-naru',
    'n4-obl-hazu-da', 'n4-obl-hazu-ga-nai',
    'n4-part-noni-although', 'n4-q-dewa-nai-ka',
  ];
  const mid = [
    'n4-te-oku', 'n4-te-miru', 'n4-te-iku', 'n4-te-kuru',
    'n4-app-rashii', 'n4-app-you-da', 'n4-app-mitai-da',
    'n4-temp-tokoro', 'n4-temp-ta-tokoro', 'n4-vm-ta-bakari',
    'n4-comp-yasui', 'n4-comp-nikui', 'n4-comp-zurai', 'n4-comp-sugiru',
    'n4-hon-irassharu', 'n4-hon-nasaru', 'n4-hon-itashimasu',
    'n4-neg-nakanaka-nai',
  ];
  if (high.includes(pointId)) return 8;
  if (mid.includes(pointId))  return 7;
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
 * @property {string[]} distractors
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
      point:           point.replace(/^〜/, '').trim(),
      meaning,
      reading,
      blankedSentence: result.blankedSentence,
      blankAnswer:     result.blankAnswer,
      translation,
      fullSentence:    raw,
      sentenceIdx:     si,
      difficulty,
      funScore,
      sourceUrl:       'https://jlptsensei.com/jlpt-n4-grammar-list/',
      syntacticSlots,
      confusionGroupIds,
      distractors:     [], // filled in Phase 2
    });

    factsThisPoint++;
  }

  if (factsThisPoint === 0) {
    zeroExtract.push(point);
  }

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
 * Deterministic shuffle seeded by factIndex (LCG).
 * @template T
 * @param {T[]} arr
 * @param {number} seed
 * @returns {T[]}
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
 * For A / B variants, returns the first variant.
 * @param {string} sid
 * @returns {string|null}
 */
function pointTextForId(sid) {
  const entry = cgBySourceId[sid];
  if (!entry) return null;

  let raw = entry.point || '';
  raw = raw.replace(/^[〜~]/, '').trim();
  raw = raw.replace(/\s*\([^)]+\)\s*$/, '').trim();
  raw = raw.replace(/\s*（[^）]+）\s*$/, '').trim();
  if (raw.includes(' / ')) {
    raw = raw.split(' / ')[0].trim();
  }
  return raw || null;
}

/**
 * Build distractors for one fill-blank fact.
 * 3-tier strategy:
 *   Tier 1 (hard)  : up to 4 from same confusion group
 *   Tier 2 (medium): up to 4 from same syntactic slot (not in group)
 *   Tier 3 (easy)  : up to 2 from broad pool
 * Total target: 8–10 distractors. Never includes correct answer.
 *
 * @param {FillBlankFact} fact
 * @param {number} factIndex
 * @returns {string[]}
 */
function buildDistractors(fact, factIndex) {
  const { blankAnswer, pointId, confusionGroupIds, syntacticSlots } = fact;

  function resolveDistractor(sid) {
    if (sid === pointId) return null;
    const text = pointTextForId(sid);
    if (!text) return null;
    if (text === blankAnswer) return null;
    return text;
  }

  // Tier 1: same confusion group
  const sameGroupIds = confusionGroupIds.flatMap(gid => groupMembers[gid] || []);
  const sameGroupDistractors = [...new Set(sameGroupIds)]
    .map(resolveDistractor)
    .filter(Boolean);

  // Tier 2: same syntactic slot, not in confusion group
  const sameSlotIds = syntacticSlots.flatMap(slot => slotMembers[slot] || []);
  const notInGroup  = new Set(sameGroupIds);
  const sameSlotDistractors = [...new Set(sameSlotIds)]
    .filter(sid => !notInGroup.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  // Tier 3: broad pool
  const alreadyUsed = new Set([...sameGroupIds, ...sameSlotIds, pointId]);
  const broadDistractors = allCgSourceIds
    .filter(sid => !alreadyUsed.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  const shuffledGroup = deterministicShuffle(sameGroupDistractors, factIndex);
  const shuffledSlot  = deterministicShuffle(sameSlotDistractors,  factIndex + 1000);
  const shuffledBroad = deterministicShuffle(broadDistractors,     factIndex + 2000);

  const picked = new Set();
  for (const d of shuffledGroup) { if (picked.size >= 4) break; picked.add(d); }
  for (const d of shuffledSlot)  { if (picked.size >= 8) break; picked.add(d); }
  for (const d of shuffledBroad) { if (picked.size >= 10) break; picked.add(d); }

  const seen = new Set([blankAnswer]);
  const result = [];
  for (const d of picked) {
    if (!seen.has(d)) { seen.add(d); result.push(d); }
  }
  return result;
}

let distractorCovered = 0;
for (let i = 0; i < extractedFacts.length; i++) {
  extractedFacts[i].distractors = buildDistractors(extractedFacts[i], i);
  if (extractedFacts[i].distractors.length > 0) distractorCovered++;
}
console.log(`  ${distractorCovered}/${extractedFacts.length} facts have at least one distractor`);

// ─── Phase 3: CuratedDeck assembly ──────────────────────────────────────────

console.log('\nPhase 3: Assembling CuratedDeck…');

// ── Fact IDs and pool grouping ────────────────────────────────────────────────

const factIdsBySlot = {};
const factIdList    = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const fact   = extractedFacts[i];
  const factId = `ja-gram-n4-${fact.pointId}-fill-${fact.sentenceIdx}`;
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
  label:        cgData.syntacticSlots[slot]?.name || slot,
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
  label:        'All N4 Grammar Points',
  answerFormat: 'word',
  factIds:      [...factIdList],
  minimumSize:  5,
});

// ── Synonym groups from confusion data ──────────────────────────────────────
// N4 synonymGroups is an object (dict) not an array — use Object.values()

const synonymGroups = Object.values(cgData.synonymGroups).map(sg => ({
  id:      sg.id,
  factIds: (sg.members || sg.memberIds || [])
    .flatMap(sid => extractedFacts
      .filter(f => f.pointId === sid)
      .map(f => `ja-gram-n4-${f.pointId}-fill-${f.sentenceIdx}`))
    .filter((v, i, arr) => arr.indexOf(v) === i),
  reason: sg.note || sg.label || '',
})).filter(sg => sg.factIds.length >= 2);

// ── Difficulty tiers ─────────────────────────────────────────────────────────

const easyIds   = [];
const mediumIds = [];
const hardIds   = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const { difficulty, pointId, sentenceIdx } = extractedFacts[i];
  const factId = `ja-gram-n4-${pointId}-fill-${sentenceIdx}`;
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
  const factId = `ja-gram-n4-${fact.pointId}-fill-${fact.sentenceIdx}`;

  // Primary pool: first big slot, or grammar_misc
  const primarySlot = fact.syntacticSlots.find(s =>
    bigSlots.some(([slot]) => slot === s)
  ) || 'grammar_misc';

  return {
    id:                     factId,
    correctAnswer:          fact.blankAnswer,
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
    examTags:               ['JLPT_N4'],
  };
});

// ── Assemble the CuratedDeck ─────────────────────────────────────────────────

const curatedDeck = {
  id:           'japanese_n4_grammar',
  name:         'Japanese N4 Grammar',
  domain:       'vocabulary',
  subDomain:    'japanese_grammar',
  description:  'Master 133 intermediate JLPT N4 grammar patterns — from conditionals and te-form auxiliaries to causative-passive, honorific speech, and appearance/hearsay expressions. Fill in the blank to prove your grammar intuition.',
  minimumFacts: 300,
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
  const label = cgData.syntacticSlots[slot]?.name || slot;
  console.log(`  ${label.padEnd(40)} ${count}`);
}

console.log('\nDistribution by confusion group (top 10):');
for (const [grp, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const cg = cgData.confusionGroups.find(g => g.id === grp);
  const label = cg?.name || grp;
  console.log(`  ${label.padEnd(45)} ${count}`);
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
