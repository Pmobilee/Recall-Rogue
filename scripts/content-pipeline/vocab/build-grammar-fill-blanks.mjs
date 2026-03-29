#!/usr/bin/env node
/**
 * build-grammar-fill-blanks.mjs
 *
 * THREE-PHASE PIPELINE for Japanese N3 grammar fill-in-the-blank cards:
 *
 *   Phase 1 — Fill-blank extraction
 *     Reads grammar_n3.json + grammar_additional.json, locates each grammar
 *     point within its example sentences, and replaces it with {___}.
 *
 *   Phase 2 — Confusion-group distractor generation
 *     Uses grammar-n3-confusion-groups.json to find same-group and same-slot
 *     alternatives. For conjugated te-form answers the matching conjugation
 *     tense is used for each distractor.
 *
 *   Phase 3 — CuratedDeck assembly
 *     Builds and writes data/decks/japanese_n3_grammar.json.
 *
 * Usage:
 *   node scripts/content-pipeline/vocab/build-grammar-fill-blanks.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..', '..', '..');

// ─── Input paths ───────────────────────────────────────────────────────────
const N3_FILE      = path.join(ROOT, 'data/references/full-japanese-study-deck/results/grammar/json/grammar_n3.json');
const ADD_FILE     = path.join(ROOT, 'data/references/full-japanese-study-deck/results/grammar/json/grammar_additional.json');
const CG_FILE      = path.join(ROOT, 'data/raw/japanese/grammar-n3-confusion-groups.json');

// ─── Output path ───────────────────────────────────────────────────────────
const OUT_FILE     = path.join(ROOT, 'data/decks/japanese_n3_grammar.json');

// ─── Load sources ──────────────────────────────────────────────────────────
console.log('Loading source files…');
const grammarN3  = JSON.parse(readFileSync(N3_FILE,  'utf8'));
const grammarAdd = JSON.parse(readFileSync(ADD_FILE, 'utf8'));
const cgData     = JSON.parse(readFileSync(CG_FILE,  'utf8'));

/** All grammar points from both source files (additional mapped to N3) */
const allGrammarPoints = [
  ...grammarN3.map(g => ({ ...g, jlpt: g.jlpt || 'N3' })),
  ...grammarAdd.map(g => ({ ...g, jlpt: 'N3' })),
];

console.log(`Loaded ${grammarN3.length} N3 + ${grammarAdd.length} additional = ${allGrammarPoints.length} total grammar points`);

// ─── Build confusion-group lookup tables ────────────────────────────────────

/** grammarPoints indexed by sourceId */
const cgBySourceId = {};
for (const gp of Object.values(cgData.grammarPoints)) {
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
for (const gp of Object.values(cgData.grammarPoints)) {
  for (const slot of (gp.syntacticSlots || [])) {
    if (!slotMembers[slot]) slotMembers[slot] = [];
    slotMembers[slot].push(gp.sourceId);
  }
}

/** All sourceIds in the confusion-group data (used as broad distractor pool) */
const allCgSourceIds = Object.keys(cgBySourceId);

// ─── Phase 1: Fill-blank extraction ─────────────────────────────────────────

/**
 * Te-form search patterns: maps canonical form → short prefixes to locate it.
 * The て variant is listed first; で variant (after voiced sounds) second.
 */
const TE_FORM_PREFIXES = {
  'ている':      ['てい', 'でい'],
  'てしまう':    ['てしま', 'でしま'],
  'ておく':      ['ておい', 'ておく', 'ておき', 'でお'],
  'てある':      ['てあ', 'であ'],
  'てみる':      ['てみ', 'でみ'],
  'てくる':      ['てき', 'てく', 'てこ', 'でき', 'でく', 'でこ'],
  'てくれる':    ['てくれ', 'でくれ'],
  'てあげる':    ['てあげ', 'であげ'],
  'てもらう':    ['てもら', 'でもら'],
  'てはいけない':['てはいけ', 'てはなら'],
  'ていく':      ['ていく', 'ていき', 'ていっ', 'でいく', 'でいき'],
};

/**
 * All fully-conjugated surface forms for each canonical te-form auxiliary,
 * sorted longest-first so we match greedily.
 */
const TE_FORM_SURFACES = {
  'ている':      ['ていました', 'ていません', 'ていなかった', 'ていない', 'ています', 'ていた', 'ていて', 'ている'],
  'てしまう':    ['てしまいました', 'てしまいます', 'てしまった', 'てしまわない', 'てしまう'],
  'でしまう':    ['でしまいました', 'でしまいます', 'でしまった', 'でしまわない', 'でしまう'],
  'ておく':      ['ておきます', 'ておかない', 'ておいた', 'ておいて', 'ておく', 'ておき'],
  'でおく':      ['でおきます', 'でおかない', 'でおいた', 'でおく'],
  'てある':      ['てあります', 'てあった', 'てある'],
  'であある':    ['であります', 'であった', 'である'],
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
  'てはいけない':['てはいけません', 'てはいけなかった', 'てはいけない', 'てはなりません'],
  'ていく':      ['ていきます', 'ていかない', 'ていった', 'ていく'],
  'でいく':      ['でいきます', 'でいかない', 'でいった', 'でいく'],
};

/**
 * Identify which canonical te-form auxiliary a grammar point represents.
 * Returns the canonical key (e.g. "ている") or null.
 * @param {string} point
 */
function getTeFormCanonical(point) {
  // Normalize: strip leading 〜, て形+ prefix, trailing parenthetical like (て居る)
  const cleaned = point
    .replace(/^〜/, '')
    .replace(/^て形\+/, 'て')
    .replace(/\s*（.*）$/, '')
    .replace(/\s*\(.*\)$/, '')
    .trim();

  for (const canonical of Object.keys(TE_FORM_PREFIXES)) {
    if (cleaned === canonical || cleaned.includes(canonical)) {
      return canonical;
    }
  }
  return null;
}

/**
 * Extract a fill-blank entry from a single phrase for a te-form grammar point.
 * Returns { blankedSentence, blankAnswer } or null if unmatched.
 *
 * @param {string} canonical  - Canonical key like "ている"
 * @param {string} phrase     - The example sentence (originalPhrase, clean text)
 */
function extractTeFormBlank(canonical, phrase) {
  const prefixes = TE_FORM_PREFIXES[canonical] || [];

  for (const prefix of prefixes) {
    const idx = phrase.indexOf(prefix);
    if (idx < 0) continue;

    // Determine the de-variant key for surface matching
    const deVariant = prefix.startsWith('で') ? `で${canonical.slice(1)}` : canonical;

    // Try to match the longest possible surface form starting at idx
    const surfaces =
      TE_FORM_SURFACES[deVariant] ||
      TE_FORM_SURFACES[canonical] ||
      [];

    const remaining = phrase.substring(idx);
    let matched = null;
    for (const surf of surfaces) {
      // surface key might use て or で; try both variants
      const desurf = surf.startsWith('て') && prefix.startsWith('で')
        ? 'で' + surf.slice(1)
        : surf;
      if (remaining.startsWith(desurf)) { matched = desurf; break; }
      if (remaining.startsWith(surf))   { matched = surf;   break; }
    }

    if (!matched) {
      // Fallback: use prefix itself (keeps something rather than nothing)
      matched = prefix;
    }

    const blankedSentence = phrase.slice(0, idx) + '{___}' + phrase.slice(idx + matched.length);
    return { blankedSentence, blankAnswer: matched };
  }
  return null;
}

/**
 * Strip ruby annotations, keeping only the base kanji/kana characters.
 * "<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>" → "食"
 * @param {string} html
 */
function stripRuby(html) {
  return html
    .replace(/<ruby>([^<]+)<rp>[^<]*<\/rp><rt>[^<]*<\/rt><rp>[^<]*<\/rp><\/ruby>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Try to locate the grammar point string inside a sentence and create a blank.
 *
 * Strategy order:
 *   1. Direct indexOf on the normalised point
 *   2. Te-form auxiliary matching
 *   3. Partial compound match (progressively shorter substrings)
 *
 * @param {string} point      - Grammar point (may have leading 〜)
 * @param {string} phrase     - Clean example sentence
 * @returns {{ blankedSentence: string, blankAnswer: string } | null}
 */
function extractBlank(point, phrase) {
  if (!phrase || !phrase.trim()) return null;

  // Normalize: strip leading tilde
  const stripped = point.replace(/^[〜~]/, '').trim();

  // ── Strategy 1: Direct match ─────────────────────────────────────────────
  const directIdx = phrase.indexOf(stripped);
  if (directIdx >= 0) {
    const blankedSentence = phrase.slice(0, directIdx) + '{___}' + phrase.slice(directIdx + stripped.length);
    return { blankedSentence, blankAnswer: stripped };
  }

  // ── Strategy 2: Te-form auxiliary match ─────────────────────────────────
  const teCanonical = getTeFormCanonical(point);
  if (teCanonical) {
    const result = extractTeFormBlank(teCanonical, phrase);
    if (result) return result;
  }

  // ── Strategy 3: Partial compound match ──────────────────────────────────
  // For compound points like "を中心として" try progressively shorter suffixes
  if (stripped.length > 2) {
    // Try substrings of length >= 2, longest first
    for (let len = stripped.length - 1; len >= 2; len--) {
      const sub = stripped.slice(-len); // suffix-first (grammar suffix is usually distinctive)
      const subIdx = phrase.indexOf(sub);
      if (subIdx >= 0) {
        const blankedSentence = phrase.slice(0, subIdx) + '{___}' + phrase.slice(subIdx + sub.length);
        return { blankedSentence, blankAnswer: sub };
      }
    }

    // Also try prefix substrings
    for (let len = stripped.length - 1; len >= 2; len--) {
      const sub = stripped.slice(0, len);
      const subIdx = phrase.indexOf(sub);
      if (subIdx >= 0) {
        const blankedSentence = phrase.slice(0, subIdx) + '{___}' + phrase.slice(subIdx + sub.length);
        return { blankedSentence, blankAnswer: sub };
      }
    }
  }

  return null;
}

/**
 * Assign a difficulty score (1–5) to a grammar point based on phrase count
 * and point complexity.
 * @param {object} gp - Grammar point object
 */
function assignDifficulty(gp) {
  const phraseCount = (gp.phrases || []).length;
  const pointLen    = (gp.point || '').replace(/^〜/, '').length;

  if (phraseCount >= 5 && pointLen <= 4)  return 1;
  if (phraseCount >= 5)                   return 2;
  if (phraseCount >= 3 && pointLen <= 6)  return 2;
  if (phraseCount >= 3)                   return 3;
  if (phraseCount >= 1 && pointLen <= 4)  return 3;
  if (phraseCount >= 1)                   return 4;
  return 5;
}

// ─── Extract fill-blank facts ───────────────────────────────────────────────

console.log('\nPhase 1: Extracting fill-blank sentences…');

/**
 * @typedef {object} FillBlankFact
 * @property {string}   grammarId
 * @property {string}   point
 * @property {string}   meaning
 * @property {string}   reading
 * @property {string}   blankedSentence
 * @property {string}   blankAnswer
 * @property {string}   translation
 * @property {string}   fullSentence
 * @property {number}   phraseIdx
 * @property {number}   difficulty
 * @property {string|null} sourceUrl
 * @property {string[]} syntacticSlots
 * @property {string[]} confusionGroupIds
 */

/** @type {FillBlankFact[]} */
const extractedFacts = [];

/** Grammar points with zero extractable sentences */
const zeroExtract = [];

/** Counts for stats */
const slotCounts  = {};
const groupCounts = {};
let   skippedPhrases = 0;

for (const gp of allGrammarPoints) {
  const cgInfo = cgBySourceId[gp.id];

  const syntacticSlots   = cgInfo?.syntacticSlots   || ['grammar_misc'];
  const confusionGroupIds = cgInfo?.confusionGroupIds || [];

  // Reading: prefer explicit readings field, fallback to point itself
  const reading = (gp.readings && gp.readings.length > 0)
    ? gp.readings[0].reading
    : gp.point.replace(/^〜/, '');

  const difficulty = assignDifficulty(gp);
  const meaning    = typeof gp.meaning === 'object' ? gp.meaning.meaning : gp.meaning;
  let   factsThisPoint = 0;

  for (let pi = 0; pi < (gp.phrases || []).length; pi++) {
    const phraseObj = gp.phrases[pi];
    const raw       = phraseObj.originalPhrase || stripRuby(phraseObj.phrase || '');

    if (!raw || !raw.trim()) { skippedPhrases++; continue; }

    const translation = phraseObj.translation || '';
    const result      = extractBlank(gp.point, raw);

    if (!result) {
      skippedPhrases++;
      continue;
    }

    extractedFacts.push({
      grammarId:       gp.id,
      point:           gp.point.replace(/^〜/, ''),
      meaning,
      reading,
      blankedSentence: result.blankedSentence,
      blankAnswer:     result.blankAnswer,
      translation,
      fullSentence:    raw,
      phraseIdx:       pi,
      difficulty,
      sourceUrl:       gp.source || null,
      syntacticSlots,
      confusionGroupIds,
    });

    factsThisPoint++;
  }

  if (factsThisPoint === 0) {
    zeroExtract.push(gp.point);
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
console.log(`  ${skippedPhrases} phrases skipped (no match)`);
console.log(`  ${zeroExtract.length} grammar points with 0 extractable sentences`);

// ─── Phase 2: Distractor generation ─────────────────────────────────────────

console.log('\nPhase 2: Generating distractors…');

/**
 * Detect which tense/form a conjugated te-form blankAnswer is in.
 * Returns a key into the conjugation table ('past', 'polite', 'negative', 'past_negative')
 * or null for the dictionary form.
 * @param {string} blankAnswer
 */
function detectTeFormTense(blankAnswer) {
  if (blankAnswer.endsWith('た') || blankAnswer.endsWith('だ') ||
      blankAnswer.endsWith('った') || blankAnswer.endsWith('った'))     return 'past';
  if (blankAnswer.endsWith('ます') || blankAnswer.endsWith('ません'))  return 'polite';
  if (blankAnswer.endsWith('ない') || blankAnswer.endsWith('ません'))  return 'negative';
  if (blankAnswer.endsWith('なかった'))                                return 'past_negative';
  return null; // dictionary / base form
}

/**
 * Look up the matching conjugation of anotherCanonical in the same tense as blankAnswer.
 * @param {string} blankAnswer      - The actual blank text (e.g. "ていた")
 * @param {string} anotherCanonical - Another te-form auxiliary (e.g. "てしまう")
 * @returns {string} - The tense-matched surface form for that auxiliary
 */
function getMatchingConjugation(blankAnswer, anotherCanonical) {
  const tense = detectTeFormTense(blankAnswer);
  if (!tense) return anotherCanonical; // return dict form

  const table = cgData.conjugationTable?.te_form?.[anotherCanonical];
  if (!table) return anotherCanonical;

  // Handle で-variant: if blankAnswer starts with で, de-variant the result
  const useDe = blankAnswer.startsWith('で');
  const result = table[tense] || anotherCanonical;
  if (useDe && result.startsWith('て')) {
    return 'で' + result.slice(1);
  }
  return result;
}

/**
 * Deterministic shuffle (seeded by factIndex to keep output stable).
 * Uses a simple LCG seeded by the index.
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
 * Build the distractor list for a single fill-blank fact.
 * Returns an array of 5–10 distractor strings.
 *
 * @param {FillBlankFact} fact
 * @param {number}        factIndex
 * @returns {string[]}
 */
function buildDistractors(fact, factIndex) {
  const { blankAnswer, grammarId, confusionGroupIds, syntacticSlots, point } = fact;

  /**
   * Look up a clean distractor surface form for a sourceId.
   * For te-form auxiliaries, returns the canonical key (e.g. "ている").
   * For other grammar points, strips leading tildes and te-form prefixes.
   * @param {string} sid
   * @returns {string|null}
   */
  function pointForId(sid) {
    const entry = cgBySourceId[sid];
    if (!entry) return null;
    const src = allGrammarPoints.find(g => g.id === sid);
    const raw = src ? src.point : entry.point;

    // Strip leading 〜/~
    let cleaned = raw.replace(/^[〜~]/, '').trim();

    // For te-form labeled points like "て形+みる" or "て形+ある (て在る・て有る)"
    // normalize to the canonical auxiliary form used in actual sentences
    if (cleaned.startsWith('て形+')) {
      cleaned = cleaned
        .replace(/^て形\+/, 'て')          // て形+みる → てみる
        .replace(/\s*（.*）$/, '')          // strip Japanese parenthetical
        .replace(/\s*\(.*\)$/, '')          // strip ASCII parenthetical
        .trim();
    }

    return cleaned || null;
  }

  // Determine if this is a te-form blank that needs tense-matching
  const teCanonical = getTeFormCanonical('〜' + point) || getTeFormCanonical(point);

  /** Resolve a sourceId to a distractor string (possibly tense-matched) */
  function resolveDistractor(sid) {
    if (sid === grammarId) return null; // skip self

    const raw = pointForId(sid);
    if (!raw) return null;
    if (raw === blankAnswer) return null; // skip exact match

    if (teCanonical) {
      // This fact is a te-form auxiliary — match the conjugation tense
      const otherEntry = cgBySourceId[sid];
      if (otherEntry?.conjugationFamily === 'te_form') {
        // Find canonical for the other te-form point
        const otherSrc = allGrammarPoints.find(g => g.id === sid);
        const otherPoint = otherSrc?.point || '';
        const otherCanonical = getTeFormCanonical(otherPoint) || raw;
        const conjugated = getMatchingConjugation(blankAnswer, otherCanonical);
        return conjugated !== blankAnswer ? conjugated : raw;
      }
    }
    return raw;
  }

  // Priority 1: same confusion group members
  const sameGroupIds = confusionGroupIds.flatMap(gid => groupMembers[gid] || []);
  const sameGroupDistractors = [...new Set(sameGroupIds)]
    .map(resolveDistractor)
    .filter(Boolean);

  // Priority 2: same syntactic slot, different confusion group
  const sameSlotIds = syntacticSlots.flatMap(slot => slotMembers[slot] || []);
  const notInGroup  = new Set(sameGroupIds);
  const sameSlotDistractors = [...new Set(sameSlotIds)]
    .filter(sid => !notInGroup.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  // Priority 3: broad pool (other slots)
  const alreadyUsed = new Set([...sameGroupIds, ...sameSlotIds, grammarId]);
  const broadDistractors = allCgSourceIds
    .filter(sid => !alreadyUsed.has(sid))
    .map(resolveDistractor)
    .filter(Boolean);

  // Shuffle each tier deterministically
  const shuffledGroup = deterministicShuffle(sameGroupDistractors, factIndex);
  const shuffledSlot  = deterministicShuffle(sameSlotDistractors,  factIndex + 1000);
  const shuffledBroad = deterministicShuffle(broadDistractors,     factIndex + 2000);

  // Pick: 3–4 from group, 3–4 from slot, 1–2 from broad; target 8–10 total
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

  // Final dedup against answer
  return [...picked].filter(d => d !== blankAnswer);
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

// ── Answer type pools ────────────────────────────────────────────────────────

/** Collect all fact ids per slot */
const factIdsBySlot = {};
const factIdList    = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const fact = extractedFacts[i];
  const factId = `ja-gram-n3-${fact.grammarId}-fill-${fact.phraseIdx}`;
  factIdList.push(factId);

  for (const slot of fact.syntacticSlots) {
    if (!factIdsBySlot[slot]) factIdsBySlot[slot] = [];
    factIdsBySlot[slot].push(factId);
  }
}

/** Build pools: one per slot with ≥5 facts; merge small slots into grammar_misc */
const bigSlots = Object.entries(factIdsBySlot).filter(([, ids]) => ids.length >= 5);
const miscIds  = Object.entries(factIdsBySlot)
  .filter(([, ids]) => ids.length < 5)
  .flatMap(([, ids]) => ids);

/** @type {Array<{ id: string, label: string, answerFormat: string, factIds: string[] }>} */
const answerTypePools = bigSlots.map(([slot, ids]) => ({
  id:           slot,
  label:        cgData.syntacticSlots[slot]?.label || slot,
  answerFormat: 'word',
  factIds:      ids,
}));

if (miscIds.length > 0) {
  answerTypePools.push({
    id:           'grammar_misc',
    label:        'Miscellaneous Grammar',
    answerFormat: 'word',
    factIds:      miscIds,
  });
}

// "grammar_all" pool that covers every fact (used by the fill-blank template)
answerTypePools.unshift({
  id:           'grammar_all',
  label:        'All Grammar Points',
  answerFormat: 'word',
  factIds:      [...factIdList],
});

// ── Synonym groups from confusion data ──────────────────────────────────────

/** @type {Array<{ id: string, factIds: string[], reason: string }>} */
const synonymGroups = cgData.synonymGroups.map(sg => ({
  id:      sg.id,
  factIds: sg.memberIds
    .flatMap(sid => {
      // Find all facts for this sourceId
      return extractedFacts
        .filter(f => f.grammarId === sid)
        .map((f, fi) => `ja-gram-n3-${f.grammarId}-fill-${f.phraseIdx}`);
    })
    .filter((v, i, arr) => arr.indexOf(v) === i), // dedup
  reason:  sg.reason,
})).filter(sg => sg.factIds.length >= 2);

// ── Difficulty tiers ─────────────────────────────────────────────────────────

const easyIds   = [];
const mediumIds = [];
const hardIds   = [];

for (let i = 0; i < extractedFacts.length; i++) {
  const { difficulty, grammarId, phraseIdx } = extractedFacts[i];
  const factId = `ja-gram-n3-${grammarId}-fill-${phraseIdx}`;
  if (difficulty <= 2)      easyIds.push(factId);
  else if (difficulty <= 3) mediumIds.push(factId);
  else                      hardIds.push(factId);
}

/** @type {Array<{ tier: string, factIds: string[] }>} */
const difficultyTiers = [
  { tier: 'easy',   factIds: easyIds   },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard',   factIds: hardIds   },
];

// ── Build DeckFact objects ───────────────────────────────────────────────────

const facts = extractedFacts.map((fact, i) => {
  const factId = `ja-gram-n3-${fact.grammarId}-fill-${fact.phraseIdx}`;

  // Determine the primary pool for answerTypePoolId (first big slot, or misc)
  const primarySlot = fact.syntacticSlots.find(s =>
    bigSlots.some(([slot]) => slot === s)
  ) || 'grammar_misc';

  return {
    id:                    factId,
    correctAnswer:         fact.blankAnswer,
    acceptableAlternatives: [],
    chainThemeId:          i % 6,
    answerTypePoolId:      primarySlot,
    difficulty:            fact.difficulty,
    funScore:              6,
    quizQuestion:          `${fact.blankedSentence}\n(${fact.translation})`,
    explanation:           `${fact.point} (${fact.meaning}) — ${fact.fullSentence}`,
    grammarNote:           '',
    visualDescription:     'Japanese grammar study card with sentence completion',
    sourceName:            'FJSD + Tatoeba (CC BY-SA 4.0)',
    sourceUrl:             fact.sourceUrl || undefined,
    volatile:              false,
    distractors:           fact.distractors,
    targetLanguageWord:    fact.point,
    reading:               fact.reading,
    language:              'ja',
    pronunciation:         fact.reading,
    partOfSpeech:          'grammar',
    examTags:              ['JLPT_N3'],
  };
});

// ── Assemble the CuratedDeck ─────────────────────────────────────────────────

/** @type {object} */
const curatedDeck = {
  id:          'japanese_n3_grammar',
  name:        'Japanese N3 Grammar',
  domain:      'vocabulary',
  subDomain:   'japanese_grammar',
  description: 'JLPT N3 grammar patterns — fill in the correct grammar point to complete each sentence',
  minimumFacts: 30,
  targetFacts:  facts.length,
  facts,
  answerTypePools,
  synonymGroups,
  questionTemplates: [
    {
      id:                 'fill_blank_grammar',
      answerPoolId:       'grammar_all',
      questionFormat:     '{quizQuestion}',
      availableFromMastery: 0,
      difficulty:         2,
      reverseCapable:     false,
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
console.log(`Total grammar points processed : ${allGrammarPoints.length}`);
console.log(`Total fill-blank facts          : ${facts.length}`);
console.log(`Grammar points with 0 sentences: ${zeroExtract.length}`);
if (zeroExtract.length > 0) {
  console.log('  → ' + zeroExtract.slice(0, 20).join(', ') + (zeroExtract.length > 20 ? ' …' : ''));
}

console.log('\nDistribution by syntactic slot:');
for (const [slot, count] of Object.entries(slotCounts).sort((a, b) => b[1] - a[1])) {
  const label = cgData.syntacticSlots[slot]?.label || slot;
  console.log(`  ${label.padEnd(30)} ${count}`);
}

console.log('\nDistribution by confusion group (top 10):');
for (const [grp, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const cg = cgData.confusionGroups.find(g => g.id === grp);
  const label = cg?.label || grp;
  console.log(`  ${label.padEnd(35)} ${count}`);
}

console.log('\nDifficulty distribution:');
console.log(`  Easy   (1–2): ${easyIds.length}`);
console.log(`  Medium (3):   ${mediumIds.length}`);
console.log(`  Hard   (4–5): ${hardIds.length}`);

console.log('\nDistractor coverage:');
const withDistractors = facts.filter(f => f.distractors.length >= 5).length;
const withSome        = facts.filter(f => f.distractors.length > 0).length;
console.log(`  ≥5 distractors: ${withDistractors}/${facts.length} facts`);
console.log(`  ≥1 distractor:  ${withSome}/${facts.length} facts`);

console.log('\nAnswer pools:');
for (const pool of answerTypePools) {
  console.log(`  ${pool.id.padEnd(35)} ${pool.factIds.length} facts`);
}

console.log('\nDone ✓');
