/**
 * Unit tests for the Canary v2 adaptive difficulty system.
 *
 * Canary adjusts enemy HP and damage based on quiz performance:
 *   - Neutral (default): 1.0x HP, 1.0x damage
 *   - Assist mode (3+ wrong this floor): 0.9x HP, 0.8x damage, easier questions
 *   - Deep Assist (5+ wrong this floor): 0.8x HP, 0.65x damage, easier questions
 *   - Challenge (5+ correct streak): 1.2x HP, 1.1x damage, harder questions
 *
 * NOTE: There is a known bug in deriveMode() where CANARY_CHALLENGE_ENEMY_HP_MULT_3 (1.1)
 * is never used — the inner ternary always evaluates to CANARY_CHALLENGE_ENEMY_HP_MULT_5 (1.2)
 * because the condition duplicates the outer guard. See gotchas.md.
 *
 * Tests cover: createCanaryState, recordCanaryAnswer, resetCanaryFloor,
 * and the HP/damage multiplier scaling thresholds.
 */

import { describe, it, expect } from 'vitest';
import {
  createCanaryState,
  recordCanaryAnswer,
  resetCanaryFloor,
  type CanaryState,
} from '../../src/services/canaryService';
import {
  CANARY_ASSIST_ENEMY_HP_MULT,
  CANARY_DEEP_ASSIST_ENEMY_HP_MULT,
  CANARY_CHALLENGE_ENEMY_HP_MULT_5,
  CANARY_ASSIST_ENEMY_DMG_MULT,
  CANARY_DEEP_ASSIST_ENEMY_DMG_MULT,
  CANARY_CHALLENGE_ENEMY_DMG_MULT,
  CANARY_ASSIST_WRONG_THRESHOLD,
  CANARY_DEEP_ASSIST_WRONG_THRESHOLD,
  CANARY_CHALLENGE_STREAK_THRESHOLD,
} from '../../src/data/balance';

// ── Initial State ─────────────────────────────────────────────────────────────

describe('createCanaryState', () => {
  it('starts in neutral mode', () => {
    const state = createCanaryState();
    expect(state.mode).toBe('neutral');
  });

  it('starts with 1.0x HP multiplier', () => {
    const state = createCanaryState();
    expect(state.enemyHpMultiplier).toBe(1.0);
  });

  it('starts with 1.0x damage multiplier', () => {
    const state = createCanaryState();
    expect(state.enemyDamageMultiplier).toBe(1.0);
  });

  it('starts with 0 wrong answers', () => {
    const state = createCanaryState();
    expect(state.wrongAnswersThisFloor).toBe(0);
  });

  it('starts with 0 correct streak', () => {
    const state = createCanaryState();
    expect(state.correctStreak).toBe(0);
  });

  it('starts with neutral question bias (0)', () => {
    const state = createCanaryState();
    expect(state.questionBias).toBe(0);
  });
});

// ── Wrong Answer Accumulation → Assist Mode ───────────────────────────────────

describe('Assist mode activation (3+ wrong answers on floor)', () => {
  function getStateWithWrongs(count: number): CanaryState {
    let state = createCanaryState();
    for (let i = 0; i < count; i++) {
      state = recordCanaryAnswer(state, false);
    }
    return state;
  }

  it('remains neutral with 2 wrong answers (below threshold)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD - 1);
    expect(state.mode).toBe('neutral');
    expect(state.enemyHpMultiplier).toBe(1.0);
  });

  it('enters assist mode at 3 wrong answers (CANARY_ASSIST_WRONG_THRESHOLD)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.mode).toBe('assist');
  });

  it('assist mode HP multiplier is CANARY_ASSIST_ENEMY_HP_MULT (0.9)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_ASSIST_ENEMY_HP_MULT);
    expect(state.enemyHpMultiplier).toBe(0.9);
  });

  it('assist mode damage multiplier is CANARY_ASSIST_ENEMY_DMG_MULT (0.8)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_ASSIST_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(0.8);
  });

  it('assist mode question bias is -1 (easier questions)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.questionBias).toBe(-1);
  });

  it('enters deep_assist mode at 5 wrong answers (CANARY_DEEP_ASSIST_WRONG_THRESHOLD)', () => {
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.mode).toBe('deep_assist');
  });

  it('deep_assist HP multiplier is CANARY_DEEP_ASSIST_ENEMY_HP_MULT (0.8)', () => {
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_DEEP_ASSIST_ENEMY_HP_MULT);
    expect(state.enemyHpMultiplier).toBe(0.8);
  });

  it('deep_assist damage multiplier is CANARY_DEEP_ASSIST_ENEMY_DMG_MULT (0.65)', () => {
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_DEEP_ASSIST_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(0.65);
  });
});

// ── Correct Answer Streak → Challenge Mode ────────────────────────────────────

describe('Challenge mode activation (5+ correct streak)', () => {
  function getStateWithCorrects(count: number): CanaryState {
    let state = createCanaryState();
    for (let i = 0; i < count; i++) {
      state = recordCanaryAnswer(state, true);
    }
    return state;
  }

  it('remains neutral with 2 correct answers (below 3-streak challenge threshold)', () => {
    const state = getStateWithCorrects(2);
    expect(state.mode).toBe('neutral');
    expect(state.enemyHpMultiplier).toBe(1.0);
  });

  it('enters challenge mode tier 1 at 3 correct streak (HP 1.1x)', () => {
    const state = getStateWithCorrects(3);
    expect(state.mode).toBe('challenge');
    expect(state.enemyHpMultiplier).toBe(1.1);
  });

  it('enters challenge mode at 5 correct streak (CANARY_CHALLENGE_STREAK_THRESHOLD)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.mode).toBe('challenge');
  });

  it('challenge mode HP multiplier is CANARY_CHALLENGE_ENEMY_HP_MULT_5 (1.2)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_CHALLENGE_ENEMY_HP_MULT_5);
    expect(state.enemyHpMultiplier).toBe(1.2);
  });

  it('challenge mode damage multiplier is CANARY_CHALLENGE_ENEMY_DMG_MULT (1.1)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_CHALLENGE_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(1.1);
  });

  it('challenge mode question bias is +1 (harder questions)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.questionBias).toBe(1);
  });

  it('enemies have MORE HP in challenge mode than neutral (1.2 > 1.0)', () => {
    const neutral = createCanaryState();
    const challenge = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(challenge.enemyHpMultiplier).toBeGreaterThan(neutral.enemyHpMultiplier);
  });

  it('enemies deal MORE damage in challenge mode than neutral (1.1 > 1.0)', () => {
    const neutral = createCanaryState();
    const challenge = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(challenge.enemyDamageMultiplier).toBeGreaterThan(neutral.enemyDamageMultiplier);
  });
});

// ── HP Multiplier Gradient ─────────────────────────────────────────────────────

describe('HP multiplier gradient across modes', () => {
  it('deep_assist has lowest HP multiplier (most help)', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_DEEP_ASSIST_WRONG_THRESHOLD; i++) {
      state = recordCanaryAnswer(state, false);
    }
    expect(state.enemyHpMultiplier).toBe(CANARY_DEEP_ASSIST_ENEMY_HP_MULT);
    expect(state.enemyHpMultiplier).toBeLessThan(CANARY_ASSIST_ENEMY_HP_MULT);
  });

  it('assist has lower HP multiplier than neutral', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_ASSIST_WRONG_THRESHOLD; i++) {
      state = recordCanaryAnswer(state, false);
    }
    expect(state.enemyHpMultiplier).toBeLessThan(1.0);
  });

  it('challenge has higher HP multiplier than neutral (enemies are harder)', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_CHALLENGE_STREAK_THRESHOLD; i++) {
      state = recordCanaryAnswer(state, true);
    }
    expect(state.enemyHpMultiplier).toBeGreaterThan(1.0);
  });
});

// ── State Transitions ─────────────────────────────────────────────────────────

describe('recordCanaryAnswer state transitions', () => {
  it('correct answer increments correctStreak', () => {
    const before = createCanaryState();
    const after = recordCanaryAnswer(before, true);
    expect(after.correctStreak).toBe(1);
  });

  it('wrong answer resets correctStreak to 0', () => {
    let state = createCanaryState();
    state = recordCanaryAnswer(state, true); // streak = 1
    state = recordCanaryAnswer(state, true); // streak = 2
    state = recordCanaryAnswer(state, false); // wrong -> streak reset
    expect(state.correctStreak).toBe(0);
  });

  it('wrong answer increments wrongAnswersThisFloor', () => {
    const before = createCanaryState();
    const after = recordCanaryAnswer(before, false);
    expect(after.wrongAnswersThisFloor).toBe(1);
  });

  it('correct answer does NOT increment wrongAnswersThisFloor', () => {
    const before = createCanaryState();
    const after = recordCanaryAnswer(before, true);
    expect(after.wrongAnswersThisFloor).toBe(0);
  });

  it('wrong answers accumulate (do not reset on wrong)', () => {
    let state = createCanaryState();
    state = recordCanaryAnswer(state, false);
    state = recordCanaryAnswer(state, false);
    state = recordCanaryAnswer(state, false);
    expect(state.wrongAnswersThisFloor).toBe(3);
  });
});

// ── Floor Reset ───────────────────────────────────────────────────────────────

describe('resetCanaryFloor', () => {
  it('resets wrongAnswersThisFloor to 0', () => {
    let state = createCanaryState();
    for (let i = 0; i < 4; i++) state = recordCanaryAnswer(state, false);
    state = resetCanaryFloor(state);
    expect(state.wrongAnswersThisFloor).toBe(0);
  });

  it('preserves correctStreak across floor reset', () => {
    let state = createCanaryState();
    state = recordCanaryAnswer(state, true);
    state = recordCanaryAnswer(state, true);
    const streakBefore = state.correctStreak;
    state = resetCanaryFloor(state);
    expect(state.correctStreak).toBe(streakBefore);
  });

  it('floor reset with preserved high streak stays in challenge mode', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_CHALLENGE_STREAK_THRESHOLD; i++) {
      state = recordCanaryAnswer(state, true);
    }
    state = resetCanaryFloor(state);
    expect(state.mode).toBe('challenge');
  });

  it('floor reset with accumulated wrongs drops back to neutral', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_DEEP_ASSIST_WRONG_THRESHOLD; i++) {
      state = recordCanaryAnswer(state, false);
    }
    expect(state.mode).toBe('deep_assist');
    state = resetCanaryFloor(state);
    // Wrong count reset to 0, streak stays 0 — should be neutral
    expect(state.mode).toBe('neutral');
  });
});
