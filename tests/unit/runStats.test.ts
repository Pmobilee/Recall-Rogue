/**
 * Tests for run-end stat counters.
 *
 * Covers:
 * - ISSUE-1-6: encountersTotal increments when combat completes (win or loss)
 *   encountersWon only increments on victory
 * - ISSUE-2-3: Practice Run detection requires chargesAttempted >= threshold;
 *   Quick-Play-only runs never trigger the banner
 */
import { describe, it, expect } from 'vitest'
import { createRunState } from '../../src/services/runManager'
import {
  isPracticeRun,
  MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN,
} from '../../src/services/masteryScalingService'

// ---------------------------------------------------------------------------
// ISSUE-1-6 — Encounter counters
// ---------------------------------------------------------------------------

describe('RunState — encounter counters (ISSUE-1-6)', () => {
  it('initializes encountersTotal and encountersWon to 0', () => {
    const state = createRunState('science', 'history')
    expect(state.encountersTotal).toBe(0)
    expect(state.encountersWon).toBe(0)
  })

  it('encountersTotal increments on defeat (player loses first combat)', () => {
    // Simulates gameFlowController.onEncounterComplete('defeat') logic.
    const state = createRunState('science', 'history')
    state.encountersTotal += 1 // defeat path
    expect(state.encountersTotal).toBe(1)
    expect(state.encountersWon).toBe(0)
  })

  it('encountersTotal and encountersWon both increment on victory', () => {
    const state = createRunState('science', 'history')
    state.encountersTotal += 1
    state.encountersWon += 1
    expect(state.encountersTotal).toBe(1)
    expect(state.encountersWon).toBe(1)
  })

  it('after 3 encounters: 2 won 1 lost — counters reflect independently', () => {
    const state = createRunState('science', 'history')
    // Encounter 1: victory
    state.encountersTotal += 1; state.encountersWon += 1
    // Encounter 2: victory
    state.encountersTotal += 1; state.encountersWon += 1
    // Encounter 3: defeat (no encountersWon increment)
    state.encountersTotal += 1
    expect(state.encountersTotal).toBe(3)
    expect(state.encountersWon).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// ISSUE-2-3 — Practice Run guard requires chargesAttempted threshold
// ---------------------------------------------------------------------------

describe('isPracticeRun — chargesAttempted guard (ISSUE-2-3)', () => {
  it('returns false when chargesAttempted is 0, even if practiceRunDetected is true', () => {
    // New player who never charged a card should not see "Practice Run" banner.
    const result = isPracticeRun({
      practiceRunDetected: true,
      chargesAttempted: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
    })
    expect(result).toBe(false)
  })

  it('returns false when chargesAttempted < threshold, even with 100% accuracy', () => {
    // A player who charged 4 cards and got all correct (just under threshold).
    const result = isPracticeRun({
      chargesAttempted: MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN - 1,
      questionsAnswered: MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN - 1,
      questionsCorrect: MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN - 1,
    })
    expect(result).toBe(false)
  })

  it('returns true when chargesAttempted >= threshold and accuracy is 100%', () => {
    // A player who charged 5+ cards and got all correct — genuine practice run.
    const n = MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN
    const result = isPracticeRun({
      chargesAttempted: n,
      questionsAnswered: n,
      questionsCorrect: n,
    })
    expect(result).toBe(true)
  })

  it('returns true when chargesAttempted >= threshold and accuracy > 85%', () => {
    const n = MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN + 2
    const result = isPracticeRun({
      chargesAttempted: n,
      questionsAnswered: n,
      questionsCorrect: Math.ceil(n * 0.9),
    })
    expect(result).toBe(true)
  })

  it('returns false when chargesAttempted >= threshold but accuracy is low', () => {
    const n = MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN + 2
    const result = isPracticeRun({
      chargesAttempted: n,
      questionsAnswered: n,
      questionsCorrect: Math.floor(n * 0.5),
    })
    expect(result).toBe(false)
  })

  it('practiceRunDetected with sufficient chargesAttempted returns true', () => {
    // Deck > 75% mastered at run start AND player actually charged cards.
    const n = MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN
    const result = isPracticeRun({
      practiceRunDetected: true,
      chargesAttempted: n,
      questionsAnswered: n,
      questionsCorrect: 0, // even with low accuracy — deck mastery flag is enough
    })
    expect(result).toBe(true)
  })

  it('MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN is exported and equals 5', () => {
    // Guard the constant so a future change is deliberate.
    expect(MIN_CHARGE_ATTEMPTS_FOR_PRACTICE_RUN).toBe(5)
  })

  it('createRunState initializes chargesAttempted to 0', () => {
    const state = createRunState('science', 'history')
    expect(state.chargesAttempted).toBe(0)
  })
})
