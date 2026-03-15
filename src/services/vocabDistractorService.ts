import type { Fact } from '../data/types'
import { factsDB } from './factsDB'
import { shuffled } from './randomUtils'
import { BALANCE } from '../data/balance'

/**
 * Per-language index of vocabulary facts, built lazily on first use.
 * Keyed by language code (e.g. 'ja', 'es', 'zh').
 */
let languageIndex: Map<string, Fact[]> | null = null

/**
 * Builds the per-language index from factsDB.
 * Only includes facts of type 'vocabulary' that have a language code set.
 */
function buildLanguageIndex(): Map<string, Fact[]> {
  const index = new Map<string, Fact[]>()
  const all = factsDB.getAll()
  for (const fact of all) {
    if (fact.type !== 'vocabulary') continue
    const lang = fact.language
    if (!lang) continue
    const bucket = index.get(lang)
    if (bucket) {
      bucket.push(fact)
    } else {
      index.set(lang, [fact])
    }
  }
  return index
}

/**
 * Returns (and lazily initialises) the per-language vocabulary index.
 * Safe to call before factsDB.init() — returns an empty map when the DB is
 * not yet ready so callers can fall back gracefully.
 */
function getLanguageIndex(): Map<string, Fact[]> {
  if (!factsDB.isReady()) return new Map()
  if (!languageIndex) {
    languageIndex = buildLanguageIndex()
  }
  return languageIndex
}

/**
 * Invalidates the cached language index.
 * Call this if the underlying factsDB is reloaded at runtime.
 */
export function invalidateVocabDistractorCache(): void {
  languageIndex = null
}

/**
 * Filters a candidate pool to facts whose correctAnswer length falls within
 * [lenMin, lenMax]. This prevents players from trivially guessing the correct
 * answer by choosing the longest or shortest option — a common pattern when
 * distractor answers are much shorter or longer than the target.
 *
 * Bounds: lenMin = max(2, floor(targetLen * 0.4)), lenMax = ceil(targetLen * 2.5)
 *
 * @param candidates - Candidate facts to filter
 * @param targetLen  - Length of the correct answer for the target fact
 * @returns Subset of candidates whose answer length is within the bounds
 */
function filterByLength(candidates: Fact[], targetLen: number): Fact[] {
  const lenMin = Math.max(2, Math.floor(targetLen * 0.4))
  const lenMax = Math.ceil(targetLen * 2.5)
  return candidates.filter(c => {
    const len = c.correctAnswer.length
    return len >= lenMin && len <= lenMax
  })
}

/**
 * Returns runtime-generated distractors for a vocabulary fact.
 * Picks correctAnswer values from other vocab facts in the same language,
 * preferring facts at similar difficulty levels (±1 first, then ±2+).
 *
 * Length-matching is applied to avoid giving away the answer via answer length.
 * Candidates whose correctAnswer length falls outside
 * [max(2, floor(targetLen * 0.4)), ceil(targetLen * 2.5)] are deprioritised.
 * The selection order is:
 *   1. Length-matched candidates from the close (difficulty ±1) pool
 *   2. Length-matched candidates from the far (difficulty ±2+) pool
 *   3. Unfiltered close pool (length relaxed, fallback)
 *   4. Unfiltered far pool (length relaxed, fallback)
 *
 * Designed so that POS-tag or semantic-bin filtering can be layered on top
 * in a future pass without changing this function's signature.
 *
 * @param fact  - The vocabulary fact needing distractors
 * @param count - Number of distractors to return (default: BALANCE.QUIZ_DISTRACTORS_SHOWN)
 * @returns Array of distractor strings (may be shorter than count if the
 *          language pool is too small)
 */
export function getVocabDistractors(fact: Fact, count: number = BALANCE.QUIZ_DISTRACTORS_SHOWN): string[] {
  const lang = fact.language
  if (!lang) return []

  const index = getLanguageIndex()
  const pool = index.get(lang)
  if (!pool || pool.length === 0) return []

  const targetDifficulty = fact.difficulty ?? 1
  const targetAnswer = fact.correctAnswer
  const targetLen = targetAnswer.length

  const close: Fact[] = []
  const far: Fact[] = []

  for (const candidate of pool) {
    if (candidate.correctAnswer === targetAnswer) continue
    const diff = Math.abs((candidate.difficulty ?? 1) - targetDifficulty)
    if (diff <= 1) {
      close.push(candidate)
    } else {
      far.push(candidate)
    }
  }

  const shuffledClose = shuffled(close)
  const shuffledFar = shuffled(far)

  // Build length-filtered variants for preferred selection
  const lengthClose = filterByLength(shuffledClose, targetLen)
  const lengthFar = filterByLength(shuffledFar, targetLen)

  const results: string[] = []
  const seen = new Set<string>()

  // Helper to drain candidates into results up to count
  function drain(candidates: Fact[]): void {
    for (const candidate of candidates) {
      if (results.length >= count) break
      const answer = candidate.correctAnswer
      if (!seen.has(answer)) {
        seen.add(answer)
        results.push(answer)
      }
    }
  }

  // Pass 1: length-matched close pool
  drain(lengthClose)

  // Pass 2: length-matched far pool
  if (results.length < count) drain(lengthFar)

  // Pass 3: fallback — unfiltered close pool (relaxes length constraint)
  if (results.length < count) drain(shuffledClose)

  // Pass 4: fallback — unfiltered far pool (relaxes length constraint)
  if (results.length < count) drain(shuffledFar)

  return results
}
