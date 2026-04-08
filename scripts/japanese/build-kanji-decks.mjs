/**
 * build-kanji-decks.mjs
 *
 * Deterministic ES module — no LLM calls, no network.
 * Builds JLPT kanji facts (N5–N1) from:
 *   - data/references/kanji-data-davidluzgouveia.json (KANJIDIC2-derived)
 *   - data/references/full-japanese-study-deck/results/kanji-info.json (mnemonics + compound words)
 *
 * MERGE MODE (default): kanji facts are merged INTO the parent vocabulary decks.
 * Each japanese_n{L}.json receives:
 *   - New facts appended after vocab facts (kanji IDs start with ja-kanji-n{L}-)
 *   - 4 new answer pools (kanji_meanings, kanji_onyomi, kanji_kunyomi, kanji_characters)
 *   - A top-level subDecks array: [{ id: "vocabulary", factIds: [...] }, { id: "kanji", factIds: [...] }]
 *   - Updated targetFacts
 *
 * IDEMPOTENT: re-running strips prior kanji content before inserting fresh content.
 * Prior kanji content is detected by:
 *   - facts whose id starts with `ja-kanji-n{L}-`
 *   - pools whose id starts with `kanji_`
 *   - subDeck with id `kanji`
 *   - subDeck with id `vocabulary` (regenerated fresh from current vocab facts)
 *
 * Run from repo root: node scripts/japanese/build-kanji-decks.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import wanakana from 'wanakana';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------

const KANJIDIC = JSON.parse(readFileSync(join(ROOT, 'data/references/kanji-data-davidluzgouveia.json'), 'utf-8'));
const INFO_RAW = JSON.parse(readFileSync(join(ROOT, 'data/references/full-japanese-study-deck/results/kanji-info.json'), 'utf-8'));
/** Index kanji-info by kanji character for O(1) lookup */
const KANJI_INFO = Object.fromEntries(INFO_RAW.map(e => [e.kanji, e]));

// ---------------------------------------------------------------------------
// Helper: deduplicate an array preserving order
// ---------------------------------------------------------------------------

/** Remove duplicate strings from an array, preserving first occurrence. */
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(v => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Helper: normalize KANJIDIC meanings array
// ---------------------------------------------------------------------------

/**
 * Fully lowercase, drop empty strings, drop "radical (no.N)" entries,
 * and deduplicate.
 *
 * @param {string[]} arr - Raw meanings from KANJIDIC entry
 * @returns {string[]} Cleaned, lowercased, deduped meanings
 */
function normalizeMeanings(arr, kanjiData) {
  if (!arr || arr.length === 0) return [];
  const radical = /radical \(no\.\d+\)/i;

  // Filter out KANJIDIC SI-unit/currency corruption that leaks from readings_kun
  // into meanings as their English equivalents. Detect by romanizing any katakana
  // pollutants in readings_kun and matching against meaning strings.
  // e.g. 志 has "シリング" in readings_kun → drop "shilling" from meanings.
  //      粉 has "デシメートル" → drop "decimeter" if it were in meanings.
  const pollutants = new Set();
  if (kanjiData?.readings_kun) {
    for (const r of kanjiData.readings_kun) {
      if (/[\u30A0-\u30FF]/.test(r)) {
        try {
          const romaji = wanakana.toRomaji(r).toLowerCase().trim();
          if (romaji) pollutants.add(romaji);
          // Also add common English equivalents for known SI unit / currency loans
          const loanMap = {
            shiringu: 'shilling',
            deshimetoru: 'decimeter',
            dorā: 'dollar',
            senchimetoru: 'centimeter',
            kiromeetoru: 'kilometer',
            miriguramu: 'milligram',
            riittoru: 'liter',
            metoru: 'meter',
          };
          if (loanMap[romaji]) pollutants.add(loanMap[romaji]);
        } catch {
          // ignore romaji errors
        }
      }
    }
  }

  return dedupe(
    arr
      .map(m => m.toLowerCase())
      .filter(m => m.length > 0 && !radical.test(m) && !pollutants.has(m))
  );
}

// ---------------------------------------------------------------------------
// Helper: strip okurigana markers from kun'yomi readings
// ---------------------------------------------------------------------------

/**
 * Strip okurigana markers from a KANJIDIC kun'yomi reading.
 *
 * KANJIDIC kun'yomi uses:
 *   - leading/trailing `-` for affix forms (e.g. "-び" → drop, "ひと-" → "ひと")
 *   - `.` to mark okurigana start (e.g. "まな.ぶ" → "まな", "ひと.つ" → "ひと")
 *
 * @param {string} r - Raw kun'yomi reading
 * @returns {string} Root reading without okurigana or empty string to drop
 */
function stripOkurigana(r) {
  if (!r) return '';
  // Trim leading/trailing hyphens (affix markers)
  let s = r.replace(/^-+|-+$/g, '');
  // Take only the part before the okurigana dot
  const dotIdx = s.indexOf('.');
  if (dotIdx !== -1) s = s.substring(0, dotIdx);
  s = s.trim();
  // Filter out KANJIDIC corruption: some entries contain katakana loan words
  // (SI units like デシメートル, currencies like シリング) polluting readings_kun.
  // Kun'yomi must be hiragana — reject anything containing katakana.
  if (!s) return '';
  if (wanakana.isKatakana(s) || /[\u30A0-\u30FF]/.test(s)) return '';
  return s;
}

// ---------------------------------------------------------------------------
// Helper: pick primary reading type (on vs kun)
// ---------------------------------------------------------------------------

/**
 * Determine whether to quiz this kanji on its on'yomi or kun'yomi.
 *
 * Logic:
 * 1. If only one type has readings, return that type.
 * 2. If both exist, peek at the first example word's reading from kanji-info.
 *    If it matches any kun'yomi root, return 'kun'.
 * 3. Default: 'on'.
 *
 * @param {{readings_on: string[], readings_kun: string[]}} data - KANJIDIC entry
 * @param {{words?: Array<{readings: Array<{reading: string}>}>}|undefined} info - kanji-info entry
 * @returns {'on' | 'kun'}
 */
function pickReadingType(data, info) {
  const hasOn = (data.readings_on ?? []).length > 0;
  const hasKun = (data.readings_kun ?? []).length > 0;

  if (hasOn && !hasKun) return 'on';
  if (hasKun && !hasOn) return 'kun';
  if (!hasOn && !hasKun) return 'on'; // fallback (shouldn't happen per plan)

  // Both exist — check first example word reading against kun'yomi roots
  const kunRoots = dedupe(
    (data.readings_kun ?? []).map(stripOkurigana).filter(Boolean)
  );
  const firstWordReading = info?.words?.[0]?.readings?.[0]?.reading ?? '';

  if (firstWordReading && kunRoots.some(root => firstWordReading.startsWith(root))) {
    return 'kun';
  }

  return 'on';
}

// ---------------------------------------------------------------------------
// Helper: build explanation string
// ---------------------------------------------------------------------------

/**
 * Build a rich explanation string from all available data.
 * Format: "{K} ({primaryRead}) — {primaryMeaning}. On'yomi: X · Kun'yomi: Y · N strokes · Example · Mnemonic"
 * Caps at ~280 chars by dropping mnemonic first, then example.
 *
 * @param {Object} params
 * @param {string} params.k - The kanji character
 * @param {Object} params.data - KANJIDIC entry
 * @param {Object|undefined} params.info - kanji-info entry
 * @param {string[]} params.meanings - Normalized meanings
 * @param {string[]} params.onKata - On'yomi in katakana
 * @param {string[]} params.kunHira - Kun'yomi roots in hiragana (deduped)
 * @returns {string}
 */
function buildExplanation({ k, data, info, meanings, onKata, kunHira }) {
  const primaryMeaning = meanings[0] ?? '';
  const primaryRead = onKata[0] ?? kunHira[0] ?? '';

  // Piece 1: always present
  const piece1 = `${k} (${primaryRead}) — ${primaryMeaning}.`;

  // Piece 2: on'yomi block
  const piece2 = onKata.length > 0 ? `On'yomi: ${onKata.join(', ')}` : '';

  // Piece 3: kun'yomi block
  const piece3 = kunHira.length > 0 ? `Kun'yomi: ${kunHira.join(', ')}` : '';

  // Piece 4: stroke count
  const piece4 = `${data.strokes} strokes`;

  // Piece 5: example compound word from kanji-info
  let piece5 = '';
  const words = info?.words ?? [];
  for (const entry of words) {
    const form = entry.kanjiForms?.[0]?.kanjiForm ?? '';
    // Must contain the kanji, but not be the kanji alone repeated
    if (form && form.includes(k) && form !== k) {
      const reading = entry.readings?.[0]?.reading ?? '';
      const rawTranslation = entry.translations?.[0]?.translation ?? '';
      const translation = rawTranslation.split(',')[0].trim();
      if (reading && translation) {
        piece5 = `Example: ${form} (${reading}) "${translation}"`;
        break;
      }
    }
  }

  // Piece 6: mnemonic (first sentence only)
  let piece6 = '';
  if (info?.mnemonic) {
    const raw = info.mnemonic;
    // Split on newline or ". " — take first non-empty sentence
    const sentences = raw.split(/\n|\.\s+/);
    const first = sentences[0]?.trim() ?? '';
    if (first.length > 0) {
      piece6 = first.endsWith('.') ? first : first + '.';
    }
  }

  // Build with cap at ~280 chars: drop mnemonic first if over, then example
  function join(pieces) {
    return pieces.filter(Boolean).join(' · ');
  }

  let result = join([piece1, piece2, piece3, piece4, piece5, piece6]);
  if (result.length > 280) {
    result = join([piece1, piece2, piece3, piece4, piece5]);
  }
  if (result.length > 280) {
    result = join([piece1, piece2, piece3, piece4]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fact factory functions
// ---------------------------------------------------------------------------

/**
 * Build a meaning-quiz fact for a kanji.
 */
function makeMeaningFact({ k, idx, L, meanings, primaryRead, explanation }) {
  return {
    id: `ja-kanji-n${L}-${k}-meaning`,
    correctAnswer: meanings[0],
    acceptableAlternatives: meanings.slice(1),
    chainThemeId: (idx * 3 + 0) % 6,
    answerTypePoolId: 'kanji_meanings',
    difficulty: 6 - L,
    funScore: 6,
    quizQuestion: `What does ${k} mean?`,
    explanation,
    visualDescription: '',
    sourceName: 'KANJIDIC2 + WaniKani + FJSD',
    sourceUrl: 'https://github.com/davidluzgouveia/kanji-data',
    volatile: false,
    distractors: [],
    targetLanguageWord: k,
    reading: primaryRead,
    language: 'ja',
    pronunciation: primaryRead,
    partOfSpeech: 'kanji',
    examTags: [`JLPT_N${L}`],
  };
}

/**
 * Build a reading-quiz fact for a kanji.
 */
function makeReadingFact({ k, idx, L, readingType, onKata, kunHira, primaryRead, explanation }) {
  const isOn = readingType === 'on';
  const correctAnswer = isOn ? (onKata[0] ?? '') : (kunHira[0] ?? '');
  // All readings of the chosen type are acceptable
  const allOfType = isOn ? onKata : kunHira;
  const alternatives = allOfType.slice(1);
  const questionLabel = isOn ? "on'yomi" : "kun'yomi";

  return {
    id: `ja-kanji-n${L}-${k}-reading`,
    correctAnswer,
    acceptableAlternatives: alternatives,
    chainThemeId: (idx * 3 + 1) % 6,
    answerTypePoolId: isOn ? 'kanji_onyomi' : 'kanji_kunyomi',
    difficulty: 6 - L,
    funScore: 6,
    quizQuestion: `What is the ${questionLabel} of ${k}?`,
    explanation,
    visualDescription: '',
    sourceName: 'KANJIDIC2 + WaniKani + FJSD',
    sourceUrl: 'https://github.com/davidluzgouveia/kanji-data',
    volatile: false,
    distractors: [],
    targetLanguageWord: k,
    reading: primaryRead,
    language: 'ja',
    pronunciation: primaryRead,
    partOfSpeech: 'kanji',
    examTags: [`JLPT_N${L}`],
  };
}

/**
 * Build a recognition-quiz fact for a kanji (answer IS the kanji character).
 */
function makeRecognitionFact({ k, idx, L, meanings, primaryRead, explanation }) {
  return {
    id: `ja-kanji-n${L}-${k}-recognition`,
    correctAnswer: k,
    acceptableAlternatives: [],
    chainThemeId: (idx * 3 + 2) % 6,
    answerTypePoolId: 'kanji_characters',
    difficulty: 6 - L,
    funScore: 7,
    quizQuestion: `Which kanji means "${meanings[0]}"?`,
    explanation,
    visualDescription: '',
    sourceName: 'KANJIDIC2 + WaniKani + FJSD',
    sourceUrl: 'https://github.com/davidluzgouveia/kanji-data',
    volatile: false,
    distractors: [],
    targetLanguageWord: k,
    reading: primaryRead,
    language: 'ja',
    pronunciation: primaryRead,
    partOfSpeech: 'kanji',
    examTags: [`JLPT_N${L}`],
  };
}

// ---------------------------------------------------------------------------
// Collision resolution for recognition questions
// ---------------------------------------------------------------------------

/**
 * Detect and resolve duplicate recognition quizQuestion strings.
 * When multiple kanji share a primary meaning, append a disambiguator
 * using the next meaning or stroke count as fallback.
 *
 * Mutates the facts array in place.
 *
 * @param {Array<Object>} facts - All facts for the current deck
 * @param {Map<string, Object>} kanjiDataMap - Map from kanji char to KANJIDIC entry
 * @param {Map<string, string[]>} kanjiMeaningsMap - Map from kanji char to normalized meanings
 * @returns {number} Number of collisions resolved
 */
function resolveRecognitionCollisions(facts, kanjiDataMap, kanjiMeaningsMap) {
  const recFacts = facts.filter(f => f.id.endsWith('-recognition'));
  // Group by quizQuestion
  const byQ = new Map();
  for (const f of recFacts) {
    const q = f.quizQuestion;
    if (!byQ.has(q)) byQ.set(q, []);
    byQ.get(q).push(f);
  }

  let collisions = 0;
  for (const [, group] of byQ) {
    if (group.length <= 1) continue;
    collisions++;

    // Assign disambiguators greedily per fact, ensuring uniqueness within the group.
    // Try: each secondary meaning in turn → stroke count → reading → kanji char itself
    // → numeric suffix as ultimate fallback.
    const usedQs = new Set();
    for (const f of group) {
      const k = f.targetLanguageWord;
      const meanings = kanjiMeaningsMap.get(k) ?? [];
      const data = kanjiDataMap.get(k);
      const primary = meanings[0];

      // Build candidate disambiguator list in preference order.
      const candidates = [];
      for (let i = 1; i < meanings.length; i++) candidates.push(meanings[i]);
      if (data) candidates.push(`${data.strokes}-stroke`);
      if (f.reading) candidates.push(`reads ${f.reading}`);
      candidates.push(`the kanji ${k}`);

      let chosen = null;
      for (const cand of candidates) {
        const q = `Which kanji means "${primary}" (${cand})?`;
        if (!usedQs.has(q)) {
          chosen = q;
          break;
        }
      }
      // Ultimate fallback: numeric suffix (guaranteed unique within group)
      if (!chosen) {
        let n = 1;
        while (usedQs.has(`Which kanji means "${primary}" (variant ${n})?`)) n++;
        chosen = `Which kanji means "${primary}" (variant ${n})?`;
      }
      f.quizQuestion = chosen;
      usedQs.add(chosen);
    }
  }
  return collisions;
}

// ---------------------------------------------------------------------------
// Pool builder
// ---------------------------------------------------------------------------

/**
 * Build the 4 answer type pools from the generated facts.
 * Collects factIds by answerTypePoolId, then adds synthetic distractor padding
 * to onyomi/kunyomi pools with <15 members.
 *
 * @param {Array<Object>} facts - All facts for the deck
 * @param {number} L - JLPT level (1-5)
 * @param {Map<string, Object>} kanjiDataMap - All kanji data at this level
 * @returns {Array<Object>} 4 pool objects
 */
function buildPools(facts, L, kanjiDataMap) {
  // Collect factIds per pool
  const poolFactIds = {
    kanji_meanings: [],
    kanji_onyomi: [],
    kanji_kunyomi: [],
    kanji_characters: [],
  };

  for (const f of facts) {
    const pid = f.answerTypePoolId;
    if (pid in poolFactIds) {
      poolFactIds[pid].push(f.id);
    }
  }

  // Synthetic distractor padding for reading pools
  // For onyomi: collect non-primary on'yomi readings from kanji quizzed via kun'yomi
  // For kunyomi: collect non-primary kun'yomi readings from kanji quizzed via on'yomi
  const onyomiSynthetics = new Set();
  const kunyomiSynthetics = new Set();

  // Existing correctAnswers to avoid duplication
  const existingOnyomi = new Set(
    facts.filter(f => f.answerTypePoolId === 'kanji_onyomi').map(f => f.correctAnswer)
  );
  const existingKunyomi = new Set(
    facts.filter(f => f.answerTypePoolId === 'kanji_kunyomi').map(f => f.correctAnswer)
  );

  for (const [k, data] of kanjiDataMap) {
    const onKata = (data.readings_on ?? []).map(wanakana.toKatakana);
    const kunHira = dedupe((data.readings_kun ?? []).map(stripOkurigana).filter(Boolean));

    // Facts quizzed via kun'yomi → non-primary on'yomi are candidates for onyomi synthetics
    const readingFact = facts.find(f => f.id === `ja-kanji-n${L}-${k}-reading`);
    if (readingFact) {
      if (readingFact.answerTypePoolId === 'kanji_kunyomi') {
        // This kanji is quizzed on kun, so its on'yomi aren't in the pool
        for (const on of onKata) {
          if (!existingOnyomi.has(on) && !onyomiSynthetics.has(on)) {
            onyomiSynthetics.add(on);
          }
        }
      } else {
        // Quizzed on on'yomi — its non-primary on'yomi may already be in alternatives
        // Kun'yomi roots are candidates for kunyomi synthetics
        for (const kun of kunHira) {
          if (!existingKunyomi.has(kun) && !kunyomiSynthetics.has(kun)) {
            kunyomiSynthetics.add(kun);
          }
        }
      }
    }
  }

  // Cap synthetics at 30 per pool
  const onyomiSynArr = [...onyomiSynthetics].slice(0, 30);
  const kunyomiSynArr = [...kunyomiSynthetics].slice(0, 30);

  const pools = [
    {
      id: 'kanji_meanings',
      label: 'English meanings of kanji',
      answerFormat: 'term',
      factIds: poolFactIds.kanji_meanings,
      minimumSize: 5,
    },
    {
      id: 'kanji_onyomi',
      label: "On'yomi readings (katakana)",
      answerFormat: 'word',
      factIds: poolFactIds.kanji_onyomi,
      minimumSize: 5,
      ...(onyomiSynArr.length > 0 && poolFactIds.kanji_onyomi.length < 15
        ? { syntheticDistractors: onyomiSynArr }
        : {}),
    },
    {
      id: 'kanji_kunyomi',
      label: "Kun'yomi readings (hiragana)",
      answerFormat: 'word',
      factIds: poolFactIds.kanji_kunyomi,
      minimumSize: 5,
      ...(kunyomiSynArr.length > 0 && poolFactIds.kanji_kunyomi.length < 15
        ? { syntheticDistractors: kunyomiSynArr }
        : {}),
    },
    {
      id: 'kanji_characters',
      label: 'Kanji characters',
      answerFormat: 'term',
      factIds: poolFactIds.kanji_characters,
      minimumSize: 5,
      homogeneityExempt: true,
      homogeneityExemptNote:
        'All members are single CJK kanji characters; visual complexity variance is intrinsic to the level.',
    },
  ];

  return pools;
}

// ---------------------------------------------------------------------------
// Main build loop — MERGE MODE
// ---------------------------------------------------------------------------
// Kanji facts are merged into the parent japanese_n{L}.json vocabulary decks.
// Prior kanji content is stripped before re-inserting (idempotent).

for (const L of [5, 4, 3, 2, 1]) {
  console.log(`\n=== Building N${L} Kanji (merging into japanese_n${L}.json) ===`);

  // Load the parent vocabulary deck
  const parentPath = join(ROOT, `data/decks/japanese_n${L}.json`);
  const parent = JSON.parse(readFileSync(parentPath, 'utf-8'));

  // Strip any prior kanji content (idempotency: safe to re-run)
  const vocabFacts = parent.facts.filter(f => !f.id.startsWith(`ja-kanji-n${L}-`));
  const vocabPools = parent.answerTypePools.filter(p => !p.id.startsWith('kanji_'));
  // Strip prior subDecks entirely — will be regenerated
  delete parent.subDecks;

  console.log(`  Vocab facts retained: ${vocabFacts.length} (stripped ${parent.facts.length - vocabFacts.length} prior kanji facts)`);

  // Filter and sort by frequency (most frequent first; undefined freq → 99999)
  const kanjiList = Object.entries(KANJIDIC)
    .filter(([, v]) => v.jlpt_new === L)
    .sort(([, a], [, b]) => (a.freq ?? 99999) - (b.freq ?? 99999));

  console.log(`  Kanji count: ${kanjiList.length}`);

  // Build lookup maps for later use in pool builder and collision resolver
  const kanjiDataMap = new Map(kanjiList);
  const kanjiMeaningsMap = new Map();

  const kanjiFacts = [];
  let skipped = 0;

  for (let idx = 0; idx < kanjiList.length; idx++) {
    const [k, data] = kanjiList[idx];

    const meanings = normalizeMeanings(data.meanings, data);
    if (meanings.length === 0) {
      console.log(`  SKIP ${k}: no meanings after normalization`);
      skipped++;
      continue;
    }

    kanjiMeaningsMap.set(k, meanings);

    const onKata = (data.readings_on ?? []).map(wanakana.toKatakana);
    const kunHira = dedupe((data.readings_kun ?? []).map(stripOkurigana).filter(Boolean));
    const info = KANJI_INFO[k];
    const readingType = pickReadingType(data, info);
    const primaryRead = readingType === 'on' ? (onKata[0] ?? '') : (kunHira[0] ?? '');
    const explanation = buildExplanation({ k, data, info, meanings, onKata, kunHira });

    kanjiFacts.push(makeMeaningFact({ k, idx, L, meanings, primaryRead, explanation }));
    kanjiFacts.push(makeReadingFact({ k, idx, L, readingType, onKata, kunHira, primaryRead, explanation }));
    kanjiFacts.push(makeRecognitionFact({ k, idx, L, meanings, primaryRead, explanation }));
  }

  // Resolve recognition question collisions
  const collisions = resolveRecognitionCollisions(kanjiFacts, kanjiDataMap, kanjiMeaningsMap);
  if (collisions > 0) {
    console.log(`  Resolved ${collisions} recognition question collision(s)`);
  }

  // Build 4 kanji-specific pools
  const kanjiPools = buildPools(kanjiFacts, L, kanjiDataMap);

  // Log pool sizes
  for (const p of kanjiPools) {
    const synCount = p.syntheticDistractors?.length ?? 0;
    console.log(`  Pool ${p.id}: ${p.factIds.length} facts${synCount > 0 ? ` + ${synCount} synthetics` : ''}`);
  }

  if (skipped > 0) {
    console.log(`  Skipped: ${skipped} kanji (empty meanings after normalization)`);
  }
  console.log(`  Kanji facts generated: ${kanjiFacts.length}`);

  // Build subDecks array
  const vocabFactIds = vocabFacts.map(f => f.id);
  const kanjiFactIds = kanjiFacts.map(f => f.id);
  const subDecks = [
    { id: 'vocabulary', name: 'Vocabulary', factIds: vocabFactIds },
    { id: 'kanji', name: 'Kanji', factIds: kanjiFactIds },
  ];

  // Assemble merged deck (preserve all top-level parent fields)
  const merged = {
    ...parent,
    targetFacts: vocabFacts.length + kanjiFacts.length,
    facts: [...vocabFacts, ...kanjiFacts],
    answerTypePools: [...vocabPools, ...kanjiPools],
    subDecks,
  };

  writeFileSync(parentPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`  Written: ${parentPath} (${merged.facts.length} total facts, ${merged.answerTypePools.length} pools, 2 subDecks)`);
}

console.log('\nDone. All 5 parent vocabulary decks updated with kanji sub-deck.');
