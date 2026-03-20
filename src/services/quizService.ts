import { BALANCE } from '../data/balance'
import type { Fact, ReviewState } from '../data/types'
import { getVocabDistractors } from './vocabDistractorService'
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from './numericalDistractorService'

/**
 * Selects the next quiz fact from review-due cards only.
 *
 * Only cards in the 'review' state (not 'new', 'learning', or 'relearning')
 * are considered. New/learning cards stay in StudySession. Returns null when
 * no review cards are due.
 *
 * @param facts - Candidate facts available for quizzing.
 * @param reviewStates - Review states associated with learned facts.
 * @returns The selected fact, or null when no review cards are due.
 */
export function selectQuestion(facts: Fact[], reviewStates: ReviewState[]): Fact | null {
  if (facts.length === 0) {
    return null
  }

  const now = Date.now()
  const factById = new Map(facts.map((fact) => [fact.id, fact]))

  let earliestDueState: ReviewState | null = null

  for (const state of reviewStates) {
    // Only select cards in 'review' state — new/learning cards stay in StudySession
    if (state.cardState !== 'review') {
      continue
    }
    if (state.nextReviewAt > now) {
      continue
    }
    if (!factById.has(state.factId)) {
      continue
    }
    if (earliestDueState === null || state.nextReviewAt < earliestDueState.nextReviewAt) {
      earliestDueState = state
    }
  }

  if (earliestDueState !== null) {
    return factById.get(earliestDueState.factId) ?? null
  }

  // No review cards due — return null instead of random fallback
  return null
}

/**
 * Selects a not-yet-due review card for review-ahead quizzing.
 * Prefers cards closest to being due (smallest time until due).
 * Returns the fact and the proportion of elapsed time vs scheduled interval.
 *
 * @returns Object with fact and proportion, or null if no review-ahead candidates
 */
export function selectReviewAheadQuestion(
  facts: Fact[],
  reviewStates: ReviewState[],
): { fact: Fact; proportion: number } | null {
  if (facts.length === 0) return null

  const now = Date.now()
  const factById = new Map(facts.map((fact) => [fact.id, fact]))

  let bestState: ReviewState | null = null
  let bestTimeToDue = Infinity

  for (const state of reviewStates) {
    // Only review-ahead for cards in 'review' state that are NOT yet due
    if (state.cardState !== 'review') continue
    if (state.nextReviewAt <= now) continue  // already due -- use selectQuestion instead
    if (!factById.has(state.factId)) continue

    const timeToDue = state.nextReviewAt - now
    if (timeToDue < bestTimeToDue) {
      bestTimeToDue = timeToDue
      bestState = state
    }
  }

  if (!bestState) return null

  // Calculate proportion: elapsed since last review / scheduled interval
  const elapsed = now - bestState.lastReviewAt
  const scheduledMs = bestState.interval * 24 * 60 * 60 * 1000
  const proportion = scheduledMs > 0 ? elapsed / scheduledMs : 0

  const fact = factById.get(bestState.factId)
  if (!fact) return null

  return { fact, proportion }
}

/**
 * Selects a review-due card weighted by ease factor relative to mine depth.
 * Shallow levels prefer high-ease (easy) cards, deep levels prefer low-ease (hard) cards.
 *
 * @param facts - Candidate facts
 * @param reviewStates - Current review states
 * @param depthRatio - Current depth as 0.0 (surface) to 1.0 (deepest)
 * @returns Selected fact or null
 */
export function selectDifficultyWeightedQuestion(
  facts: Fact[],
  reviewStates: ReviewState[],
  depthRatio: number,
): Fact | null {
  if (facts.length === 0) return null

  const now = Date.now()
  const factById = new Map(facts.map((fact) => [fact.id, fact]))

  // Collect review-due cards with their ease factors
  const candidates: { fact: Fact; ease: number }[] = []

  for (const state of reviewStates) {
    if (state.cardState !== 'review') continue
    if (state.nextReviewAt > now) continue
    const fact = factById.get(state.factId)
    if (!fact) continue
    candidates.push({ fact, ease: state.easeFactor })
  }

  if (candidates.length === 0) return null
  if (candidates.length < 3) {
    // Too few candidates for meaningful weighting -- pick earliest due (fallback)
    return selectQuestion(facts, reviewStates)
  }

  // Exponential depth weighting: shallow = easy bias, deep = hard bias.
  // depthExponent ranges from 0.3 (shallow, strong easy bias) to 3.0 (deep, strong hard bias)
  const depthExponent = 0.3 + depthRatio * 2.7
  const weights = candidates.map(c => {
    const normalizedDifficulty = Math.max(0.1, (3.0 - c.ease) / 2.0) // 0..1, higher = harder
    return Math.pow(normalizedDifficulty, depthExponent)
  })

  // Weighted random selection
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * totalWeight
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i].fact
  }

  return candidates[candidates.length - 1].fact
}

/**
 * Builds shuffled multiple-choice answers for a quiz fact.
 *
 * The resulting array contains the correct answer and a random subset of
 * distractors defined by game balance.
 *
 * @param fact - Fact used to generate quiz choices.
 * @returns A shuffled array containing one correct answer and distractors.
 */
export function getQuizChoices(fact: Fact): string[] {
  let distractorSource = fact.distractors

  // Runtime vocab distractor generation (spec 1.8 Option E)
  if (distractorSource.length === 0 && fact.type === 'vocabulary') {
    distractorSource = getVocabDistractors(fact)
  }

  // Runtime numerical distractor generation for brace-marked answers
  if (distractorSource.length === 0 && isNumericalAnswer(fact.correctAnswer)) {
    distractorSource = getNumericalDistractors(fact)
  }

  const distractors = shuffleArray([...distractorSource]).slice(0, BALANCE.QUIZ_DISTRACTORS_SHOWN)
  const correctDisplay = displayAnswer(fact.correctAnswer)
  const choices = [...distractors, correctDisplay]

  return shuffleArray(choices)
}

/**
 * Grades a submitted answer against the fact's correct answer.
 *
 * @param fact - Fact containing the correct answer.
 * @param answer - Player's submitted answer.
 * @returns True when the answer exactly matches the correct answer.
 */
export function gradeAnswer(fact: Fact, answer: string): boolean {
  return answer === displayAnswer(fact.correctAnswer)
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 *
 * @param array - Array to shuffle.
 * @returns The same array reference, shuffled in place.
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}
