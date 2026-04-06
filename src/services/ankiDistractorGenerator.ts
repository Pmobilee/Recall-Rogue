/**
 * Distractor generator for imported Anki / personal decks.
 *
 * Generates multiple-choice distractors by cross-pollinating correct answers
 * within the same deck. No external API calls — purely algorithmic.
 *
 * Algorithm:
 *   1. Group all non-cloze facts by answer-type bucket (length × type).
 *   2. For each fact, sample up to 8 distractors from its bucket.
 *   3. If the bucket is too small (< 4 others), borrow from neighbour buckets.
 *   4. If still < 4, leave the fact in typing mode.
 *
 * Cloze facts (factId contains "_c\d+") are always left in typing mode — their
 * answers are highly specific and cross-pollination would produce nonsense.
 */

import type { DeckFact } from '../data/curatedDeckTypes';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Stats returned alongside the distractor-enriched facts. */
export interface DistractorStats {
  factsWithDistractors: number;
  factsTypingOnly: number;
  avgDistractors: number;
}

/**
 * Generate distractors for all facts in an imported personal deck.
 *
 * Returns a NEW array of facts (original objects are not mutated) with
 * populated `distractors` fields and updated `quizResponseMode` values.
 * Facts that cannot get enough distractors keep `quizResponseMode: 'typing'`.
 *
 * @param facts - All DeckFact objects from the imported deck.
 * @returns Updated facts array plus generation statistics.
 */
export function generateDistractorsForDeck(facts: DeckFact[]): {
  facts: DeckFact[];
  stats: DistractorStats;
} {
  // Build bucket map: bucketKey → list of correctAnswer strings from that bucket.
  const bucketAnswers = new Map<string, string[]>();

  for (const fact of facts) {
    // Skip cloze facts — their IDs contain "_c<N>".
    if (isCloze(fact)) continue;

    const key = bucketKey(fact.correctAnswer);
    if (!bucketAnswers.has(key)) bucketAnswers.set(key, []);
    bucketAnswers.get(key)!.push(fact.correctAnswer);
  }

  // For each bucket, pre-build an ordered list of neighbour buckets to try when
  // the primary bucket is too small.
  const allKeys = [...bucketAnswers.keys()];

  let totalDistractors = 0;
  let factsWithDistractors = 0;
  let factsTypingOnly = 0;

  const updatedFacts: DeckFact[] = facts.map(fact => {
    // Cloze facts are always typing-only.
    if (isCloze(fact)) {
      factsTypingOnly++;
      return fact;
    }

    const key = bucketKey(fact.correctAnswer);
    const excluded = buildExcluded(fact);

    // Gather distractor candidates from primary bucket then neighbours.
    const candidates = gatherCandidates(key, allKeys, bucketAnswers, excluded, 8);

    if (candidates.length < 4) {
      // Not enough distractors — leave in typing mode.
      factsTypingOnly++;
      return { ...fact, distractors: [], quizResponseMode: 'typing' as const };
    }

    // Shuffle deterministically-ish (crypto not needed — no security requirement).
    const shuffled = shuffle(candidates);
    const distractors = shuffled.slice(0, 8);

    totalDistractors += distractors.length;
    factsWithDistractors++;

    return {
      ...fact,
      distractors,
      quizResponseMode: 'choice' as const,
    };
  });

  const avgDistractors =
    factsWithDistractors > 0 ? totalDistractors / factsWithDistractors : 0;

  return {
    facts: updatedFacts,
    stats: { factsWithDistractors, factsTypingOnly, avgDistractors },
  };
}

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

/** Length buckets for grouping similar answers. */
type LengthBucket = 'short' | 'medium' | 'long';

/** Answer type for grouping similar answers. */
type AnswerType = 'number' | 'date' | 'proper' | 'general';

/** Compute the bucket key for an answer. */
export function bucketKey(answer: string): string {
  return `${lengthBucket(answer)}_${answerType(answer)}`;
}

/** Classify answer by word count. */
function lengthBucket(answer: string): LengthBucket {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 3) return 'short';
  if (words <= 8) return 'medium';
  return 'long';
}

/** Classify answer by content type. */
function answerType(answer: string): AnswerType {
  const trimmed = answer.trim();

  // Contains a 4-digit year pattern — check before pure-number so "1969" is 'date' not 'number'.
  if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(trimmed)) return 'date';

  // Pure number (possibly with commas or decimal point, no year pattern above).
  if (/^[\d,]+(\.\d+)?$/.test(trimmed)) return 'number';

  // Mostly capitalised words (proper names / places): ≥ 50 % of words start with uppercase.
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const capitalised = words.filter(w => /^[A-Z]/.test(w)).length;
    if (capitalised / words.length >= 0.5) return 'proper';
  }

  return 'general';
}

// ---------------------------------------------------------------------------
// Candidate gathering
// ---------------------------------------------------------------------------

/**
 * Build the set of strings that must NOT appear as distractors for a fact.
 * Includes the correctAnswer and all acceptableAlternatives (case-insensitive).
 */
function buildExcluded(fact: DeckFact): Set<string> {
  const s = new Set<string>();
  s.add(fact.correctAnswer.toLowerCase());
  for (const alt of fact.acceptableAlternatives ?? []) {
    s.add(alt.toLowerCase());
  }
  return s;
}

/**
 * Gather up to `needed` distractor candidates from the primary bucket, then
 * from neighbour buckets if the primary is too small.
 *
 * Neighbour priority:
 *   1. Same type, different length bucket.
 *   2. Same length bucket, different type.
 *   3. Everything else.
 */
function gatherCandidates(
  primaryKey: string,
  allKeys: string[],
  bucketAnswers: Map<string, string[]>,
  excluded: Set<string>,
  needed: number,
): string[] {
  const [primaryLength, primaryType] = primaryKey.split('_') as [LengthBucket, AnswerType];

  // Build ordered list of keys to try: primary first, then neighbours.
  const orderedKeys: string[] = [primaryKey];

  // Neighbours: same type, different length (first priority).
  for (const k of allKeys) {
    if (k === primaryKey) continue;
    const [kLen, kType] = k.split('_') as [LengthBucket, AnswerType];
    if (kType === primaryType && kLen !== primaryLength) orderedKeys.push(k);
  }
  // Neighbours: same length, different type (second priority).
  for (const k of allKeys) {
    if (orderedKeys.includes(k)) continue;
    const [kLen, kType] = k.split('_') as [LengthBucket, AnswerType];
    if (kLen === primaryLength && kType !== primaryType) orderedKeys.push(k);
  }
  // Everything else.
  for (const k of allKeys) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k);
  }

  const candidates: string[] = [];

  for (const key of orderedKeys) {
    if (candidates.length >= needed) break;
    const pool = bucketAnswers.get(key) ?? [];
    for (const answer of pool) {
      if (candidates.length >= needed) break;
      if (isValidDistractor(answer, excluded)) {
        candidates.push(answer);
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Quality filters
// ---------------------------------------------------------------------------

/**
 * Returns true if `candidate` is a valid distractor for a fact whose exclusion
 * set is `excluded`.
 *
 * Rejects:
 *   - case-insensitive match against the correct answer or alternatives
 *   - substring relationship (either direction)
 *   - Levenshtein distance < 2 (too similar, likely a typo variant)
 */
export function isValidDistractor(candidate: string, excluded: Set<string>): boolean {
  const lower = candidate.toLowerCase();

  // Exact / case-insensitive match.
  if (excluded.has(lower)) return false;

  // Substring check: reject if either string contains the other.
  for (const excl of excluded) {
    if (lower.includes(excl) || excl.includes(lower)) return false;
  }

  // Levenshtein distance < 2 against any excluded string.
  for (const excl of excluded) {
    if (levenshtein(lower, excl) < 2) return false;
  }

  return true;
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * Classic DP implementation — O(m×n) time, O(n) space.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Returns true if this fact is a cloze-deletion fact (ID format: ..._cN). */
function isCloze(fact: DeckFact): boolean {
  return /_c\d+$/.test(fact.id);
}

/**
 * Fisher-Yates shuffle — returns a new array.
 * Uses Math.random() — sufficient for distractor ordering (not security-critical).
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
