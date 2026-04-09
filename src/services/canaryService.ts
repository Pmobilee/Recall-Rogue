import {
  CANARY_DEEP_ASSIST_ENEMY_DMG_MULT,
  CANARY_DEEP_ASSIST_WRONG_THRESHOLD,
  CANARY_ASSIST_ENEMY_DMG_MULT,
  CANARY_ASSIST_WRONG_THRESHOLD,
  CANARY_CHALLENGE_ENEMY_DMG_MULT,
  CANARY_CHALLENGE_STREAK_THRESHOLD,
  CANARY_ASSIST_ENEMY_HP_MULT,
  CANARY_DEEP_ASSIST_ENEMY_HP_MULT,
  CANARY_CHALLENGE_ENEMY_HP_MULT_3,
  CANARY_CHALLENGE_ENEMY_HP_MULT_5,
  CANARY_RUN_WINDOW,
  CANARY_RUN_STRONG_ASSIST_THRESHOLD,
  CANARY_RUN_MILD_ASSIST_THRESHOLD,
  CANARY_RUN_MILD_CHALLENGE_THRESHOLD,
  CANARY_RUN_STRONG_CHALLENGE_THRESHOLD,
  CANARY_RUN_STRONG_ASSIST_DMG_MULT,
  CANARY_RUN_STRONG_ASSIST_HP_MULT,
  CANARY_RUN_MILD_ASSIST_DMG_MULT,
  CANARY_RUN_MILD_ASSIST_HP_MULT,
  CANARY_RUN_MILD_CHALLENGE_DMG_MULT,
  CANARY_RUN_MILD_CHALLENGE_HP_MULT,
  CANARY_RUN_STRONG_CHALLENGE_DMG_MULT,
  CANARY_RUN_STRONG_CHALLENGE_HP_MULT,
} from '../data/balance'

/**
 * Canary adaptive difficulty system: invisible difficulty scaling based on performance.
 * Graduated assist tiers help struggling players, while challenge mode rewards mastery.
 *
 * Two layers stack multiplicatively:
 *  - Encounter-level: reacts to wrong/correct streaks within the current floor
 *  - Run-level: reacts to rolling accuracy over the last CANARY_RUN_WINDOW answers
 *
 * The final `enemyDamageMultiplier` and `enemyHpMultiplier` fields are the product of
 * both layers. Callers read only these combined values — they do not need to know about
 * the layering.
 */

export type CanaryMode = 'neutral' | 'assist' | 'deep_assist' | 'challenge'

export interface CanaryState {
  wrongAnswersThisFloor: number
  correctStreak: number
  mode: CanaryMode
  /** Combined (encounter × run) enemy damage multiplier. Read by all callers. */
  enemyDamageMultiplier: number
  /** Combined (encounter × run) enemy HP multiplier. Read by all callers. */
  enemyHpMultiplier: number
  questionBias: -1 | 0 | 1
  /** Rolling window of recent answers for run-level accuracy tracking. */
  runAnswers: boolean[]
  /** Run-level accuracy (0–1), computed from runAnswers. 0 if window < 10. */
  runAccuracy: number
  /** Run-level damage multiplier (before stacking with encounter-level). */
  runDamageMultiplier: number
  /** Run-level HP multiplier (before stacking with encounter-level). */
  runHpMultiplier: number
}

/**
 * Linearly interpolates between two values based on t (0→a, 1→b).
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/**
 * Computes run-level multipliers using continuous linear interpolation.
 * Instead of stepped bands, multipliers scale smoothly between anchor points:
 *   - Below strong assist threshold: maximum assist
 *   - Between strong and mild assist: interpolated assist
 *   - Between mild assist and mild challenge: interpolated toward neutral (1.0)
 *   - Between mild and strong challenge: interpolated challenge
 *   - Above strong challenge: maximum challenge
 * Returns 1.0 for both until at least 10 answers have been recorded.
 */
function computeRunLevelMultipliers(runAnswers: boolean[]): { dmgMult: number; hpMult: number } {
  if (runAnswers.length < 10) return { dmgMult: 1.0, hpMult: 1.0 }
  const accuracy = runAnswers.filter(a => a).length / runAnswers.length

  // Below strong assist threshold — max assist
  if (accuracy <= CANARY_RUN_STRONG_ASSIST_THRESHOLD) {
    return { dmgMult: CANARY_RUN_STRONG_ASSIST_DMG_MULT, hpMult: CANARY_RUN_STRONG_ASSIST_HP_MULT }
  }
  // Strong assist → mild assist (interpolate between strong assist and mild assist values)
  if (accuracy <= CANARY_RUN_MILD_ASSIST_THRESHOLD) {
    const t = (accuracy - CANARY_RUN_STRONG_ASSIST_THRESHOLD) / (CANARY_RUN_MILD_ASSIST_THRESHOLD - CANARY_RUN_STRONG_ASSIST_THRESHOLD)
    return {
      dmgMult: lerp(CANARY_RUN_STRONG_ASSIST_DMG_MULT, CANARY_RUN_MILD_ASSIST_DMG_MULT, t),
      hpMult: lerp(CANARY_RUN_STRONG_ASSIST_HP_MULT, CANARY_RUN_MILD_ASSIST_HP_MULT, t),
    }
  }
  // Mild assist → mild challenge (interpolate through neutral 1.0)
  if (accuracy <= CANARY_RUN_MILD_CHALLENGE_THRESHOLD) {
    const t = (accuracy - CANARY_RUN_MILD_ASSIST_THRESHOLD) / (CANARY_RUN_MILD_CHALLENGE_THRESHOLD - CANARY_RUN_MILD_ASSIST_THRESHOLD)
    return {
      dmgMult: lerp(CANARY_RUN_MILD_ASSIST_DMG_MULT, CANARY_RUN_MILD_CHALLENGE_DMG_MULT, t),
      hpMult: lerp(CANARY_RUN_MILD_ASSIST_HP_MULT, CANARY_RUN_MILD_CHALLENGE_HP_MULT, t),
    }
  }
  // Mild challenge → strong challenge
  if (accuracy <= CANARY_RUN_STRONG_CHALLENGE_THRESHOLD) {
    const t = (accuracy - CANARY_RUN_MILD_CHALLENGE_THRESHOLD) / (CANARY_RUN_STRONG_CHALLENGE_THRESHOLD - CANARY_RUN_MILD_CHALLENGE_THRESHOLD)
    return {
      dmgMult: lerp(CANARY_RUN_MILD_CHALLENGE_DMG_MULT, CANARY_RUN_STRONG_CHALLENGE_DMG_MULT, t),
      hpMult: lerp(CANARY_RUN_MILD_CHALLENGE_HP_MULT, CANARY_RUN_STRONG_CHALLENGE_HP_MULT, t),
    }
  }
  // Above strong challenge — max challenge
  return { dmgMult: CANARY_RUN_STRONG_CHALLENGE_DMG_MULT, hpMult: CANARY_RUN_STRONG_CHALLENGE_HP_MULT }
}

/**
 * Derives the full CanaryState from floor counters and the run-level answer window.
 * Encounter-level and run-level multipliers are computed separately, then multiplied.
 */
function deriveMode(wrongAnswersThisFloor: number, correctStreak: number, runAnswers: boolean[]): CanaryState {
  // ── Encounter-level multipliers ──────────────────────────────────────────────

  let encounterDmgMult: number
  let encounterHpMult: number
  let mode: CanaryMode
  let questionBias: -1 | 0 | 1

  // Check challenge mode: streak >= 3 enters challenge, with two tiers
  if (correctStreak >= 3) {
    // Tier 2 (5+ streak): stronger HP multiplier. Tier 1 (3-4 streak): weaker HP multiplier.
    encounterHpMult = correctStreak >= CANARY_CHALLENGE_STREAK_THRESHOLD
      ? CANARY_CHALLENGE_ENEMY_HP_MULT_5
      : CANARY_CHALLENGE_ENEMY_HP_MULT_3
    encounterDmgMult = CANARY_CHALLENGE_ENEMY_DMG_MULT
    mode = 'challenge'
    questionBias = 1
  } else if (wrongAnswersThisFloor >= CANARY_DEEP_ASSIST_WRONG_THRESHOLD) {
    // Check deep assist mode first (high difficulty) before assist, since 5 >= 3
    encounterDmgMult = CANARY_DEEP_ASSIST_ENEMY_DMG_MULT
    encounterHpMult = CANARY_DEEP_ASSIST_ENEMY_HP_MULT
    mode = 'deep_assist'
    questionBias = -1
  } else if (wrongAnswersThisFloor >= CANARY_ASSIST_WRONG_THRESHOLD) {
    // Check assist mode (moderate difficulty)
    encounterDmgMult = CANARY_ASSIST_ENEMY_DMG_MULT
    encounterHpMult = CANARY_ASSIST_ENEMY_HP_MULT
    mode = 'assist'
    questionBias = -1
  } else {
    // Neutral mode (default)
    encounterDmgMult = 1.0
    encounterHpMult = 1.0
    mode = 'neutral'
    questionBias = 0
  }

  // ── Run-level multipliers ────────────────────────────────────────────────────
  const { dmgMult: runDmgMult, hpMult: runHpMult } = computeRunLevelMultipliers(runAnswers)
  const runAccuracy = runAnswers.length >= 10
    ? runAnswers.filter(a => a).length / runAnswers.length
    : 0

  return {
    wrongAnswersThisFloor,
    correctStreak,
    mode,
    // Combined multipliers — product of both layers
    enemyDamageMultiplier: encounterDmgMult * runDmgMult,
    enemyHpMultiplier: encounterHpMult * runHpMult,
    questionBias,
    runAnswers,
    runAccuracy,
    runDamageMultiplier: runDmgMult,
    runHpMultiplier: runHpMult,
  }
}

/** Creates a fresh CanaryState at the start of a run. */
export function createCanaryState(): CanaryState {
  return deriveMode(0, 0, [])
}

/**
 * Records a quiz answer and returns updated CanaryState.
 * Pushes the answer onto the run-level window (trimmed to CANARY_RUN_WINDOW).
 */
export function recordCanaryAnswer(state: CanaryState, correct: boolean): CanaryState {
  const nextWrong = correct ? state.wrongAnswersThisFloor : state.wrongAnswersThisFloor + 1
  const nextStreak = correct ? state.correctStreak + 1 : 0
  const nextRunAnswers = [...state.runAnswers, correct]
  if (nextRunAnswers.length > CANARY_RUN_WINDOW) nextRunAnswers.shift()
  return deriveMode(nextWrong, nextStreak, nextRunAnswers)
}

/**
 * Resets encounter-level counters at floor transition.
 * Preserves correctStreak and runAnswers — run-level tracking persists across encounters.
 */
export function resetCanaryFloor(state: CanaryState): CanaryState {
  return deriveMode(0, state.correctStreak, state.runAnswers)
}
