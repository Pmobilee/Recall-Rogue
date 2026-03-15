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
 * Returns runtime-generated distractors for a vocabulary fact.
 * Picks correctAnswer values from other vocab facts in the same language,
 * preferring facts at similar difficulty levels (±1 first, then ±2+).
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

  const results: string[] = []
  const seen = new Set<string>()

  for (const candidate of shuffledClose) {
    if (results.length >= count) break
    const answer = candidate.correctAnswer
    if (!seen.has(answer)) {
      seen.add(answer)
      results.push(answer)
    }
  }

  for (const candidate of shuffledFar) {
    if (results.length >= count) break
    const answer = candidate.correctAnswer
    if (!seen.has(answer)) {
      seen.add(answer)
      results.push(answer)
    }
  }

  return results
}
