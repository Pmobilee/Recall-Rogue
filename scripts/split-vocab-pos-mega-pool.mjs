#!/usr/bin/env node
/**
 * split-vocab-pos-mega-pool.mjs
 *
 * Splits the single english_meanings mega-pool in vocabulary decks into five
 * POS-specific sub-pools: verbs, nouns, adjectives, adverbs, other.
 *
 * This eliminates Anti-Pattern 10 (Mixed-POS vocabulary pools), which lets
 * players identify the correct answer by grammatical shape alone (e.g., "to swim"
 * is obviously a verb). After splitting, all four quiz options within a pool have
 * the same grammatical form, so players must actually know the vocabulary.
 *
 * Applied to 21 decks: Chinese HSK 1-6, Czech A1-B2, Dutch A1-B2,
 * Japanese N1-N5, Korean topik1/topik2.
 *
 * CRITICAL: Check adverb BEFORE verb to avoid substring match bugs.
 * Use exact equality — never .includes() on POS values.
 *
 * Usage:
 *   node scripts/split-vocab-pos-mega-pool.mjs --dry-run --verbose
 *   node scripts/split-vocab-pos-mega-pool.mjs --dry-run --deck japanese_n5
 *   node scripts/split-vocab-pos-mega-pool.mjs --deck japanese_n5
 *   node scripts/split-vocab-pos-mega-pool.mjs             # all 21 decks
 */

import { readFileSync, writeFileSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DECKS_DIR = resolve(REPO_ROOT, 'data', 'decks');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const deckArgIdx = args.indexOf('--deck');
const SINGLE_DECK = deckArgIdx !== -1 ? args[deckArgIdx + 1] : null;

// ---------------------------------------------------------------------------
// ANSI colours
// ---------------------------------------------------------------------------
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ---------------------------------------------------------------------------
// Target decks — the 21 vocab decks still carrying the mega-pool
// ---------------------------------------------------------------------------
const TARGET_DECKS = [
  'chinese_hsk1', 'chinese_hsk2', 'chinese_hsk3', 'chinese_hsk4', 'chinese_hsk5', 'chinese_hsk6',
  'czech_a1', 'czech_a2', 'czech_b1', 'czech_b2',
  'dutch_a1', 'dutch_a2', 'dutch_b1', 'dutch_b2',
  'japanese_n1', 'japanese_n2', 'japanese_n3', 'japanese_n4', 'japanese_n5',
  'korean_topik1', 'korean_topik2',
];

// ---------------------------------------------------------------------------
// POS-appropriate synthetic distractors (hard-coded bank per POS)
// These match the same style used in the Spanish/French/German splits.
// ---------------------------------------------------------------------------
const SYNTHETIC_DISTRACTORS = {
  verbs: [
    'to swim', 'to refuse', 'to arrange', 'to decide', 'to avoid',
    'to discover', 'to prevent', 'to compare', 'to wonder', 'to insist',
    'to measure', 'to recognize', 'to gather', 'to combine', 'to respond',
  ],
  nouns: [
    'table', 'decision', 'ceiling', 'matter', 'measurement',
    'reason', 'distance', 'vehicle', 'hallway', 'principle',
    'atmosphere', 'evidence', 'sentence', 'structure', 'discipline',
  ],
  adjectives: [
    'empty', 'rapid', 'fragile', 'hollow', 'lively',
    'brittle', 'mellow', 'rigid', 'restless', 'vivid',
    'scarce', 'modest', 'bland', 'steady', 'tangled',
  ],
  adverbs: [
    'quickly', 'rarely', 'gently', 'often', 'truly',
    'silently', 'eagerly', 'barely', 'soundly', 'boldly',
    'wholly', 'sternly', 'vaguely', 'briskly', 'firmly',
  ],
  other: [
    'simple phrase', 'common expression', 'usual saying', 'ordinary remark', 'plain statement',
    'generic label', 'basic term', 'typical word', 'standard form', 'direct reply',
    'casual note', 'minor detail', 'brief signal', 'quick mention', 'plain fact',
  ],
};

// Target minimum synthetics per pool
const MIN_SYNTHETICS = 15;

// ---------------------------------------------------------------------------
// POS routing — CRITICAL: check adverb BEFORE verb (no substring hacks)
// ---------------------------------------------------------------------------
/**
 * Maps a partOfSpeech value to one of five bucket keys.
 * Uses EXACT equality only — never .includes() which would match "adverb" on "verb".
 * @param {string|null|undefined} pos
 * @returns {'verbs'|'nouns'|'adjectives'|'adverbs'|'other'}
 */
function routePOS(pos) {
  if (!pos) return 'other';
  const p = pos.toLowerCase().trim();

  // CRITICAL: Check adverb BEFORE verb — exact match
  if (p === 'adverb' || p === 'adv') return 'adverbs';
  if (p === 'verb') return 'verbs';
  if (p === 'noun') return 'nouns';
  if (p === 'adjective' || p === 'adj') return 'adjectives';

  // Everything else → other
  // Covers: phrase, interjection, conjunction, expression, pronoun,
  //         suffix, number, kanji, particle, preposition, determiner,
  //         prefix, null/missing
  return 'other';
}

// ---------------------------------------------------------------------------
// Build sub-pool label from bucket key
// ---------------------------------------------------------------------------
const BUCKET_LABELS = {
  verbs:      'English meanings (verbs)',
  nouns:      'English meanings (nouns)',
  adjectives: 'English meanings (adjectives)',
  adverbs:    'English meanings (adverbs)',
  other:      'English meanings (other)',
};

// ---------------------------------------------------------------------------
// Split a single deck
// ---------------------------------------------------------------------------
/**
 * @param {string} deckId
 * @returns {{ modified: boolean, buckets: Record<string,number>, mergedInto?: string } | null}
 */
function splitDeck(deckId) {
  const deckPath = resolve(DECKS_DIR, `${deckId}.json`);
  let deck;
  try {
    deck = JSON.parse(readFileSync(deckPath, 'utf8'));
  } catch (err) {
    console.error(`${RED}ERROR reading ${deckId}: ${err.message}${RESET}`);
    return null;
  }

  // Find the english_meanings mega-pool
  const emPoolIdx = deck.answerTypePools.findIndex(p => p.id === 'english_meanings');
  if (emPoolIdx === -1) {
    if (VERBOSE) console.log(`${DIM}  SKIP ${deckId} — no english_meanings pool${RESET}`);
    return { modified: false, buckets: {} };
  }

  // Check if already split (idempotent guard)
  const alreadySplit = deck.answerTypePools.some(p =>
    /^english_meanings_(verbs|nouns|adjectives|adverbs|other)$/.test(p.id)
  );
  if (alreadySplit) {
    if (VERBOSE) console.log(`${DIM}  SKIP ${deckId} — already split${RESET}`);
    return { modified: false, buckets: {} };
  }

  const emPool = deck.answerTypePools[emPoolIdx];
  const emFactIdSet = new Set(emPool.factIds);

  // Build fact lookup map
  const factById = new Map(deck.facts.map(f => [f.id, f]));

  // Route facts into buckets
  /** @type {Record<'verbs'|'nouns'|'adjectives'|'adverbs'|'other', string[]>} */
  const buckets = { verbs: [], nouns: [], adjectives: [], adverbs: [], other: [] };

  for (const factId of emPool.factIds) {
    const fact = factById.get(factId);
    if (!fact) {
      if (VERBOSE) console.warn(`  WARN: factId ${factId} in pool but not in facts array`);
      buckets.other.push(factId);
      continue;
    }
    const bucket = routePOS(fact.partOfSpeech);
    buckets[bucket].push(factId);
  }

  if (VERBOSE) {
    console.log(`  POS buckets for ${deckId}:`);
    for (const [k, v] of Object.entries(buckets)) {
      console.log(`    ${k}: ${v.length}`);
    }
  }

  // Merge sub-pools with fewer than 5 real facts into 'nouns' (or largest bucket)
  const MIN_REAL_FACTS = 5;
  const bucketKeys = ['verbs', 'nouns', 'adjectives', 'adverbs', 'other'];

  // Find largest bucket for fallback merge target
  let largestBucket = 'nouns';
  let largestCount = 0;
  for (const k of bucketKeys) {
    if (buckets[k].length > largestCount) {
      largestCount = buckets[k].length;
      largestBucket = k;
    }
  }

  for (const k of bucketKeys) {
    if (k === largestBucket) continue;
    if (buckets[k].length > 0 && buckets[k].length < MIN_REAL_FACTS) {
      const mergeTarget = buckets['nouns'].length >= MIN_REAL_FACTS ? 'nouns' : largestBucket;
      if (VERBOSE) {
        console.log(`  MERGE ${k} (${buckets[k].length} facts) → ${mergeTarget}`);
      }
      buckets[mergeTarget].push(...buckets[k]);
      buckets[k] = [];
    }
  }

  // Build replacement pools — clone original metadata, override id/label/factIds
  /** @type {Array<{id:string, label:string, answerFormat:string, factIds:string[], minimumSize:number, syntheticDistractors?:string[]}>} */
  const newPools = [];
  for (const k of bucketKeys) {
    if (buckets[k].length === 0) continue;

    // Build synthetic distractors: use hard-coded bank padded to MIN_SYNTHETICS
    const bank = SYNTHETIC_DISTRACTORS[k] || SYNTHETIC_DISTRACTORS.other;
    // Deduplicate against actual correct answers in this pool
    const poolAnswers = new Set(
      buckets[k].map(fid => {
        const f = factById.get(fid);
        return f ? (f.correctAnswer || '').toLowerCase().trim() : '';
      }).filter(Boolean)
    );
    const synthetics = bank.filter(s => !poolAnswers.has(s.toLowerCase().trim()));
    // Pad with extras from 'other' bank if needed (e.g. verbs bank might collide)
    const toAdd = Math.max(0, MIN_SYNTHETICS - synthetics.length);
    if (toAdd > 0) {
      const extras = (SYNTHETIC_DISTRACTORS.other || [])
        .filter(s => !poolAnswers.has(s.toLowerCase().trim()) && !synthetics.includes(s))
        .slice(0, toAdd);
      synthetics.push(...extras);
    }
    // Trim to exactly MIN_SYNTHETICS
    const finalSynthetics = synthetics.slice(0, MIN_SYNTHETICS);

    newPools.push({
      id: `english_meanings_${k}`,
      label: BUCKET_LABELS[k],
      answerFormat: emPool.answerFormat || 'word',
      factIds: [...buckets[k]],
      minimumSize: emPool.minimumSize || 5,
      syntheticDistractors: finalSynthetics,
    });
  }

  if (newPools.length === 0) {
    console.warn(`${YELLOW}  WARN: ${deckId} — no new pools generated (deck may be empty)${RESET}`);
    return { modified: false, buckets: {} };
  }

  // Update every affected fact's answerTypePoolId
  let factsReassigned = 0;
  for (const fact of deck.facts) {
    if (!emFactIdSet.has(fact.id)) continue;
    const bucket = routePOS(fact.partOfSpeech);
    // Find which new pool this fact ended up in (accounting for merges)
    const targetPool = newPools.find(p => p.factIds.includes(fact.id));
    if (targetPool) {
      fact.answerTypePoolId = targetPool.id;
      factsReassigned++;
    } else {
      // Should not happen — fact was in emPool but not in any new pool (merge gap)
      if (VERBOSE) console.warn(`  WARN: fact ${fact.id} has no target pool after merge`);
    }
  }

  if (VERBOSE) {
    console.log(`  Facts reassigned: ${factsReassigned}/${emPool.factIds.length}`);
    console.log(`  New pools: ${newPools.map(p => p.id + '(' + p.factIds.length + ')').join(', ')}`);
  }

  // Replace the english_meanings pool in-place with the new pools
  // Insert at the same index to preserve pool ordering
  deck.answerTypePools.splice(emPoolIdx, 1, ...newPools);

  // Final bucket counts (for summary)
  const bucketCounts = {};
  for (const p of newPools) {
    const key = p.id.replace('english_meanings_', '');
    bucketCounts[key] = p.factIds.length;
  }

  if (!DRY_RUN) {
    // Atomic write: write to .tmp then rename
    const tmpPath = deckPath + '.tmp';
    writeFileSync(tmpPath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
    renameSync(tmpPath, deckPath);
  }

  return { modified: true, buckets: bucketCounts, factsReassigned };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const decksToProcess = SINGLE_DECK ? [SINGLE_DECK] : TARGET_DECKS;

if (DRY_RUN) {
  console.log(`${YELLOW}${BOLD}DRY RUN — no files will be written${RESET}`);
}

console.log(`\n${CYAN}${BOLD}POS split: english_meanings → per-POS sub-pools${RESET}`);
console.log(`Decks to process: ${decksToProcess.length}\n`);

let totalDecksModified = 0;
let totalFactsReassigned = 0;
const summaryRows = [];

for (const deckId of decksToProcess) {
  process.stdout.write(`  ${deckId}... `);
  const result = splitDeck(deckId);
  if (!result) {
    console.log(`${RED}ERROR${RESET}`);
    continue;
  }
  if (!result.modified) {
    console.log(`${DIM}skipped${RESET}`);
    continue;
  }

  totalDecksModified++;
  totalFactsReassigned += result.factsReassigned || 0;

  const bucketSummary = Object.entries(result.buckets)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  console.log(`${GREEN}OK${RESET}  [${bucketSummary}]`);
  summaryRows.push({ deckId, buckets: result.buckets, factsReassigned: result.factsReassigned });
}

console.log(`\n${BOLD}Summary:${RESET}`);
console.log(`  Decks modified:    ${totalDecksModified}`);
console.log(`  Facts reassigned:  ${totalFactsReassigned}`);

if (VERBOSE && summaryRows.length > 0) {
  console.log(`\n${BOLD}Per-deck POS histogram:${RESET}`);
  for (const { deckId, buckets } of summaryRows) {
    console.log(`  ${deckId}:`);
    for (const [k, v] of Object.entries(buckets)) {
      console.log(`    ${k.padEnd(12)}: ${v}`);
    }
  }
}

if (DRY_RUN) {
  console.log(`\n${YELLOW}Dry run complete. Run without --dry-run to apply.${RESET}`);
}
