import {
  CANARY_DEEP_ASSIST_ENEMY_DMG_MULT,
  CANARY_DEEP_ASSIST_WRONG_THRESHOLD,
  CANARY_ASSIST_ENEMY_DMG_MULT,
  CANARY_ASSIST_WRONG_THRESHOLD,
  CANARY_CHALLENGE_ENEMY_DMG_MULT,
  CANARY_CHALLENGE_STREAK_THRESHOLD,
} from '../data/balance'

/**
 * Canary adaptive difficulty system: invisible difficulty scaling based on performance.
 * Graduated assist tiers help struggling players, while challenge mode rewards mastery.
 */

export type CanaryMode = 'neutral' | 'assist' | 'deep_assist' | 'challenge'

export interface CanaryState {
  wrongAnswersThisFloor: number
  correctStreak: number
  mode: CanaryMode
  enemyDamageMultiplier: number
  questionBias: -1 | 0 | 1
}

function deriveMode(wrongAnswersThisFloor: number, correctStreak: number): CanaryState {
  // Check challenge mode first (high performance)
  if (correctStreak >= CANARY_CHALLENGE_STREAK_THRESHOLD) {
    return {
      wrongAnswersThisFloor,
      correctStreak,
      mode: 'challenge',
      enemyDamageMultiplier: CANARY_CHALLENGE_ENEMY_DMG_MULT,
      questionBias: 1,
    }
  }

  // Check deep assist mode first (high difficulty) before assist, since 5 >= 3
  if (wrongAnswersThisFloor >= CANARY_DEEP_ASSIST_WRONG_THRESHOLD) {
    return {
      wrongAnswersThisFloor,
      correctStreak,
      mode: 'deep_assist',
      enemyDamageMultiplier: CANARY_DEEP_ASSIST_ENEMY_DMG_MULT,
      questionBias: -1,
    }
  }

  // Check assist mode (moderate difficulty)
  if (wrongAnswersThisFloor >= CANARY_ASSIST_WRONG_THRESHOLD) {
    return {
      wrongAnswersThisFloor,
      correctStreak,
      mode: 'assist',
      enemyDamageMultiplier: CANARY_ASSIST_ENEMY_DMG_MULT,
      questionBias: -1,
    }
  }

  // Neutral mode (default)
  return {
    wrongAnswersThisFloor,
    correctStreak,
    mode: 'neutral',
    enemyDamageMultiplier: 1.0,
    questionBias: 0,
  }
}

export function createCanaryState(): CanaryState {
  return deriveMode(0, 0)
}

export function recordCanaryAnswer(state: CanaryState, correct: boolean): CanaryState {
  const nextWrong = correct ? state.wrongAnswersThisFloor : state.wrongAnswersThisFloor + 1
  const nextStreak = correct ? state.correctStreak + 1 : 0
  return deriveMode(nextWrong, nextStreak)
}

export function resetCanaryFloor(state: CanaryState): CanaryState {
  return deriveMode(0, state.correctStreak)
}
