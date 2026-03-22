import type { Fact } from '../data/types'
import { factsDB } from './factsDB'
import { shuffled } from './randomUtils'
import { BALANCE } from '../data/balance'

/**
 * Per-language + subdeck index of vocabulary facts, built lazily on first use.
 * Keyed by `"<language>:<subdeckType>"` (e.g. 'ja:vocab', 'ja:kanji', 'ja:grammar',
 * 'ja:kana', 'ko:vocab').
 *
 * Subdeck segmentation prevents cross-subdeck contamination for Japanese:
 * all Japanese facts share `type: "vocabulary"` and `language: "ja"`, so
 * without this extra dimension a vocab question like "What does 食べる mean?"
 * could receive grammar patterns ("subject marker") or kanji meanings
 * ("one, horse") as runtime distractors instead of other vocab translations.
 */
let languageIndex: Map<string, Fact[]> | null = null

/**
 * Determines the subdeck type for a fact based on its ID prefix.
 * Used as the second dimension of the language index key.
 *
 * @param fact - The fact to classify
 * @returns 'kanji' | 'grammar' | 'kana' | 'vocab'
 */
function getSubdeckType(fact: Fact): string {
  const id = fact.id
  if (id.startsWith('ja-kanji-')) return 'kanji'
  if (id.startsWith('ja-grammar-')) return 'grammar'
  if (id.startsWith('ja-hiragana-') || id.startsWith('ja-katakana-')) return 'kana'
  // Default covers ja-jlpt-* and all non-Japanese language facts
  return 'vocab'
}

/**
 * Builds the per-language + subdeck index from factsDB.
 * Only includes facts of type 'vocabulary' that have a language code set.
 * Keys have the form `"<lang>:<subdeckType>"` so each subdeck draws
 * distractors only from semantically compatible facts.
 */
function buildLanguageIndex(): Map<string, Fact[]> {
  const index = new Map<string, Fact[]>()
  const all = factsDB.getAll()
  for (const fact of all) {
    if (fact.type !== 'vocabulary') continue
    const lang = fact.language
    if (!lang) continue
    const key = `${lang}:${getSubdeckType(fact)}`
    const bucket = index.get(key)
    if (bucket) {
      bucket.push(fact)
    } else {
      index.set(key, [fact])
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
 * Extracts the L2 (target language) word from a vocab fact's quizQuestion.
 * Used when building distractors for reverse-mode questions where the answer
 * pool should be L2 words rather than English translations.
 *
 * @param quizQuestion - The quiz question string to extract from
 * @returns The L2 word if found, or null
 */
function extractL2WordFromQuestion(quizQuestion: string): string | null {
  const quoted = quizQuestion.match(/["「]([^"」]+)["」]/)
  return quoted ? quoted[1] : null
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
 *   1. Length-matched candidates from the seen pool (FSRS priority — player has reviewed these)
 *   2. Length-matched candidates from the unseen pool
 *   3. Unfiltered seen pool (length relaxed, fallback)
 *   4. Unfiltered unseen pool (length relaxed, fallback)
 *
 * Within each priority tier the pool is further split into close (difficulty ±1)
 * and far (difficulty ±2+) sub-pools, with close preferred first.
 *
 * When `options.answerPool === 'l2'`, the L2 word is extracted from each
 * candidate's quizQuestion instead of using correctAnswer (reverse-mode distractors).
 *
 * Designed so that POS-tag or semantic-bin filtering can be layered on top
 * in a future pass without changing this function's signature.
 *
 * @param fact    - The vocabulary fact needing distractors
 * @param count   - Number of distractors to return (default: BALANCE.QUIZ_DISTRACTORS_SHOWN)
 * @param options - Optional FSRS and answer-pool configuration
 * @returns Array of distractor strings (may be shorter than count if the
 *          language pool is too small)
 */
export function getVocabDistractors(
  fact: Fact,
  count: number = BALANCE.QUIZ_DISTRACTORS_SHOWN,
  options?: {
    seenFactIds?: Set<string>
    answerPool?: 'english' | 'l2'
  },
): string[] {
  const lang = fact.language
  if (!lang) return []

  const index = getLanguageIndex()
  const subdeckType = getSubdeckType(fact)
  const key = `${lang}:${subdeckType}`
  const pool = index.get(key)
  if (!pool || pool.length === 0) return []

  const targetDifficulty = fact.difficulty ?? 1
  const targetAnswer = fact.correctAnswer
  const isL2Mode = options?.answerPool === 'l2'

  // In L2 mode, the correct answer is the L2 word extracted from the question.
  // We need to know it upfront to avoid including it as a distractor.
  const targetL2Word = isL2Mode ? extractL2WordFromQuestion(fact.quizQuestion) : null

  // In L2 mode, length is measured against the L2 word (correctAnswer in reverse mode).
  const targetLen = isL2Mode && targetL2Word ? targetL2Word.length : targetAnswer.length

  const seenFactIds = options?.seenFactIds

  // Partition candidates into seen (priority) and unseen buckets,
  // then each bucket into close/far by difficulty.
  const seenClose: Fact[] = []
  const seenFar: Fact[] = []
  const unseenClose: Fact[] = []
  const unseenFar: Fact[] = []

  for (const candidate of pool) {
    // Skip the target fact itself (both by English answer and, in L2 mode, by L2 word)
    if (candidate.correctAnswer === targetAnswer) continue
    if (isL2Mode) {
      // In L2 mode skip candidates with no extractable L2 word
      const l2 = extractL2WordFromQuestion(candidate.quizQuestion)
      if (l2 === null) continue
      // Avoid synonyms: skip if the candidate's English answer matches the target's English answer
      if (candidate.correctAnswer === targetAnswer) continue
    }

    const diff = Math.abs((candidate.difficulty ?? 1) - targetDifficulty)
    const isClose = diff <= 1

    if (seenFactIds && seenFactIds.has(candidate.id)) {
      if (isClose) seenClose.push(candidate)
      else seenFar.push(candidate)
    } else {
      if (isClose) unseenClose.push(candidate)
      else unseenFar.push(candidate)
    }
  }

  const shuffledSeenClose = shuffled(seenClose)
  const shuffledSeenFar = shuffled(seenFar)
  const shuffledUnseenClose = shuffled(unseenClose)
  const shuffledUnseenFar = shuffled(unseenFar)

  // Build length-filtered variants for preferred selection
  const lengthSeenClose = filterByLength(shuffledSeenClose, targetLen)
  const lengthSeenFar = filterByLength(shuffledSeenFar, targetLen)
  const lengthUnseenClose = filterByLength(shuffledUnseenClose, targetLen)
  const lengthUnseenFar = filterByLength(shuffledUnseenFar, targetLen)

  const results: string[] = []
  const seen = new Set<string>()

  /**
   * Extract the display string from a candidate for the current answer pool mode.
   * In L2 mode returns the L2 word from the question; in English mode returns correctAnswer.
   */
  function getDisplayAnswer(candidate: Fact): string | null {
    if (isL2Mode) {
      return extractL2WordFromQuestion(candidate.quizQuestion)
    }
    return candidate.correctAnswer
  }

  /** Drain candidates into results up to count, skipping duplicates and nulls. */
  function drain(candidates: Fact[]): void {
    for (const candidate of candidates) {
      if (results.length >= count) break
      const answer = getDisplayAnswer(candidate)
      if (answer === null) continue
      if (!seen.has(answer)) {
        seen.add(answer)
        results.push(answer)
      }
    }
  }

  // Priority 1: seen facts (FSRS-aware — player has reviewed these, harder distractors)
  if (seenFactIds) {
    drain(lengthSeenClose)
    if (results.length < count) drain(lengthSeenFar)
    if (results.length < count) drain(shuffledSeenClose)
    if (results.length < count) drain(shuffledSeenFar)
  }

  // Priority 2: unseen facts (fallback)
  if (results.length < count) drain(lengthUnseenClose)
  if (results.length < count) drain(lengthUnseenFar)
  if (results.length < count) drain(shuffledUnseenClose)
  if (results.length < count) drain(shuffledUnseenFar)

  return results
}
