import type { Fact, QuestionVariant, ReviewState } from '../data/types'
import { factsDB } from './factsDB'
import { getCardTier } from './tierDerivation'
import { getRunRng, isRunRngActive } from './seededRng'
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from './numericalDistractorService'

export interface MasteryChallengeQuestion {
  factId: string
  factStatement: string
  question: string
  correctAnswer: string
  answers: string[]
  timerSeconds: number
}

const ROOM_CHALLENGE_CHANCE = 0.18
const TIMER_SECONDS = 3
const DISTRACTOR_COUNT = 5

const HARD_VARIANT_PRIORITY: Record<QuestionVariant['type'], number> = {
  negative: 6,
  reverse: 5,
  fill_blank: 4,
  context: 3,
  true_false: 2,
  forward: 1,
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  const rng = isRunRngActive() ? getRunRng('mastery') : null
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor((rng ? rng.next() : Math.random()) * (index + 1))
    const temp = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = temp
  }
  return next
}

function pickHardestVariant(fact: Fact): QuestionVariant | null {
  const variants = fact.variants ?? []
  if (variants.length === 0) return null
  return [...variants].sort((left, right) => {
    const scoreDiff = (HARD_VARIANT_PRIORITY[right.type] ?? 0) - (HARD_VARIANT_PRIORITY[left.type] ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return (right.distractors?.length ?? 0) - (left.distractors?.length ?? 0)
  })[0]
}

function buildDistractorPool(fact: Fact, variant: QuestionVariant | null, correctAnswer: string): string[] {
  const seen = new Set<string>([normalizeText(correctAnswer)])
  const pool: string[] = []
  const push = (value: string): void => {
    const normalized = normalizeText(value)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    pool.push(value)
  }

  for (const distractor of variant?.distractors ?? []) push(distractor)
  for (const distractor of fact.distractors ?? []) push(distractor)

  // Runtime numerical distractor generation for brace-marked variant answers
  // that have no pre-generated distractors.
  const variantAnswer = variant?.correctAnswer ?? fact.correctAnswer
  if (pool.length === 0 && isNumericalAnswer(variantAnswer)) {
    const numerical = getNumericalDistractors(fact, DISTRACTOR_COUNT)
    for (const d of numerical) push(d)
  }

  return pool
}

function buildQuestionFromFact(fact: Fact): MasteryChallengeQuestion | null {
  const variant = pickHardestVariant(fact)
  const question = variant?.question ?? fact.quizQuestion
  const rawCorrectAnswer = variant?.correctAnswer ?? fact.correctAnswer
  const correctAnswer = displayAnswer(rawCorrectAnswer)
  const pool = buildDistractorPool(fact, variant, correctAnswer)
  if (pool.length < 2) return null

  const distractors = shuffle(pool).slice(0, Math.min(DISTRACTOR_COUNT, pool.length))
  const answers = shuffle([...distractors, correctAnswer])

  return {
    factId: fact.id,
    factStatement: fact.statement,
    question,
    correctAnswer,
    answers,
    timerSeconds: TIMER_SECONDS,
  }
}

function hasTier3Relic(state: ReviewState): boolean {
  return getCardTier({
    stability: state.stability ?? state.interval ?? 0,
    consecutiveCorrect: state.consecutiveCorrect ?? state.repetitions ?? 0,
    passedMasteryTrial: state.passedMasteryTrial ?? false,
  }) === '3'
}

function pickChallengeCandidate(states: ReviewState[]): ReviewState | null {
  const eligible = states
    .filter(hasTier3Relic)
    .sort((left, right) => (left.masteredAt ?? 0) - (right.masteredAt ?? 0))

  if (eligible.length === 0) return null
  const rng = isRunRngActive() ? getRunRng('mastery') : null
  return eligible[Math.floor((rng ? rng.next() : Math.random()) * eligible.length)] ?? null
}

export function rollMasteryChallenge(states: ReviewState[]): MasteryChallengeQuestion | null {
  if (!factsDB.isReady()) return null
  const rng = isRunRngActive() ? getRunRng('mastery') : null
  if ((rng ? rng.next() : Math.random()) > ROOM_CHALLENGE_CHANCE) return null

  const candidate = pickChallengeCandidate(states)
  if (!candidate) return null

  const fact = factsDB.getById(candidate.factId)
  if (!fact) return null

  return buildQuestionFromFact(fact)
}
