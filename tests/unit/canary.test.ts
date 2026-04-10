/**
 * Unit tests for the Canary v2 adaptive difficulty system.
 *
 * Canary adjusts enemy HP and damage based on quiz performance:
 *   - Neutral (default): 1.0x HP, 1.0x damage
 *   - Assist mode (2+ wrong this floor): 0.85x HP, 0.70x damage, easier questions
 *   - Deep Assist (4+ wrong this floor): 0.70x HP, 0.55x damage, easier questions
 *   - Challenge (5+ correct streak): 1.25x HP, 1.15x damage, harder questions
 *
 * NOTE: There is a known bug in deriveMode() where CANARY_CHALLENGE_ENEMY_HP_MULT_3 (1.1)
 * is never used — the inner ternary always evaluates to CANARY_CHALLENGE_ENEMY_HP_MULT_5 (1.25)
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

describe('Assist mode activation (2+ wrong answers on floor)', () => {
  function getStateWithWrongs(count: number): CanaryState {
    let state = createCanaryState();
    for (let i = 0; i < count; i++) {
      state = recordCanaryAnswer(state, false);
    }
    return state;
  }

  it('remains neutral with 1 wrong answer (below threshold)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD - 1);
    expect(state.mode).toBe('neutral');
    expect(state.enemyHpMultiplier).toBe(1.0);
  });

  it('enters assist mode at 2 wrong answers (CANARY_ASSIST_WRONG_THRESHOLD)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.mode).toBe('assist');
  });

  it('assist mode HP multiplier is CANARY_ASSIST_ENEMY_HP_MULT (0.85)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_ASSIST_ENEMY_HP_MULT);
    expect(state.enemyHpMultiplier).toBe(0.85);
  });

  it('assist mode damage multiplier is CANARY_ASSIST_ENEMY_DMG_MULT (0.70)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_ASSIST_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(0.70);
  });

  it('assist mode question bias is -1 (easier questions)', () => {
    const state = getStateWithWrongs(CANARY_ASSIST_WRONG_THRESHOLD);
    expect(state.questionBias).toBe(-1);
  });

  it('enters deep_assist mode at 4 wrong answers (CANARY_DEEP_ASSIST_WRONG_THRESHOLD)', () => {
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.mode).toBe('deep_assist');
  });

  it('deep_assist HP multiplier is CANARY_DEEP_ASSIST_ENEMY_HP_MULT (0.70)', () => {
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_DEEP_ASSIST_ENEMY_HP_MULT);
    expect(state.enemyHpMultiplier).toBe(0.70);
  });

  it('deep_assist damage multiplier is CANARY_DEEP_ASSIST_ENEMY_DMG_MULT (0.45)', () => {
    // Updated 2026-04-10: deep_assist enemy damage mult reduced 0.55→0.45 (balance pass 6)
    const state = getStateWithWrongs(CANARY_DEEP_ASSIST_WRONG_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_DEEP_ASSIST_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(0.45);
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

  it('challenge mode HP multiplier is CANARY_CHALLENGE_ENEMY_HP_MULT_5 (1.20)', () => {
    // Updated 2026-04-10: reverted from 1.50 to 1.20 in balance pass (comment in balance.ts)
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.enemyHpMultiplier).toBe(CANARY_CHALLENGE_ENEMY_HP_MULT_5);
    expect(state.enemyHpMultiplier).toBe(1.20);
  });

  it('challenge mode damage multiplier is CANARY_CHALLENGE_ENEMY_DMG_MULT (1.15)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.enemyDamageMultiplier).toBe(CANARY_CHALLENGE_ENEMY_DMG_MULT);
    expect(state.enemyDamageMultiplier).toBe(1.15);
  });

  it('challenge mode question bias is +1 (harder questions)', () => {
    const state = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(state.questionBias).toBe(1);
  });

  it('enemies have MORE HP in challenge mode than neutral (1.25 > 1.0)', () => {
    const neutral = createCanaryState();
    const challenge = getStateWithCorrects(CANARY_CHALLENGE_STREAK_THRESHOLD);
    expect(challenge.enemyHpMultiplier).toBeGreaterThan(neutral.enemyHpMultiplier);
  });

  it('enemies deal MORE damage in challenge mode than neutral (1.15 > 1.0)', () => {
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

// ── Run-Level Accuracy Tracking ───────────────────────────────────────────────

import {
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
} from '../../src/data/balance';

/** Helper: build a state with N correct and M wrong answers fed in sequence. */
function buildRunState(correct: number, wrong: number): CanaryState {
  let state = createCanaryState();
  // Interleave to keep encounter-level in neutral (avoid triggering assist/challenge mode)
  const total = correct + wrong;
  let c = correct;
  let w = wrong;
  for (let i = 0; i < total; i++) {
    // Distribute: feed one correct then one wrong to keep streaks low
    if (c > 0 && (w === 0 || i % 2 === 0)) {
      state = recordCanaryAnswer(state, true);
      c--;
    } else if (w > 0) {
      state = recordCanaryAnswer(state, false);
      w--;
    }
  }
  return state;
}

describe('Run-level tracking: initial state', () => {
  it('createCanaryState initializes runAnswers to empty array', () => {
    const state = createCanaryState();
    expect(state.runAnswers).toEqual([]);
  });

  it('createCanaryState initializes runAccuracy to 0', () => {
    const state = createCanaryState();
    expect(state.runAccuracy).toBe(0);
  });

  it('createCanaryState initializes runDamageMultiplier to 1.0', () => {
    const state = createCanaryState();
    expect(state.runDamageMultiplier).toBe(1.0);
  });

  it('createCanaryState initializes runHpMultiplier to 1.0', () => {
    const state = createCanaryState();
    expect(state.runHpMultiplier).toBe(1.0);
  });
});

describe('Run-level tracking: answer recording', () => {
  it('recordCanaryAnswer appends answer to runAnswers', () => {
    let state = createCanaryState();
    state = recordCanaryAnswer(state, true);
    expect(state.runAnswers).toEqual([true]);
    state = recordCanaryAnswer(state, false);
    expect(state.runAnswers).toEqual([true, false]);
  });

  it('run multipliers remain 1.0 until 10 answers are recorded (not enough data)', () => {
    let state = createCanaryState();
    for (let i = 0; i < 9; i++) {
      state = recordCanaryAnswer(state, true);
    }
    expect(state.runDamageMultiplier).toBe(1.0);
    expect(state.runHpMultiplier).toBe(1.0);
    expect(state.runAccuracy).toBe(0); // not computed until 10 answers
  });

  it('run multipliers activate at exactly 10 answers', () => {
    let state = createCanaryState();
    // 10 correct answers = 100% accuracy → strong challenge zone
    for (let i = 0; i < 10; i++) {
      state = recordCanaryAnswer(state, true);
    }
    expect(state.runAccuracy).toBeGreaterThan(0);
  });

  it('runAnswers array is trimmed to CANARY_RUN_WINDOW', () => {
    let state = createCanaryState();
    for (let i = 0; i < CANARY_RUN_WINDOW + 5; i++) {
      state = recordCanaryAnswer(state, i % 2 === 0);
    }
    expect(state.runAnswers.length).toBe(CANARY_RUN_WINDOW);
  });
});

describe('Run-level tracking: accuracy tiers', () => {
  /**
   * Helper: create a state with a specific run accuracy using exactly 20 answers.
   * Uses a fresh canary state; mixes corrects/wrongs to hit target accuracy.
   * NOTE: encounter-level mode may vary — we only check run-level multipliers here.
   */
  function stateWithRunAccuracy(accuracy: number): CanaryState {
    let state = createCanaryState();
    const total = 20;
    const corrects = Math.round(accuracy * total);
    const answers = Array(corrects).fill(true).concat(Array(total - corrects).fill(false));
    for (const a of answers) {
      state = recordCanaryAnswer(state, a);
    }
    return state;
  }

  it('strong assist: accuracy below CANARY_RUN_STRONG_ASSIST_THRESHOLD applies assist multipliers', () => {
    // 55% accuracy = below 0.60 threshold
    const state = stateWithRunAccuracy(0.55);
    expect(state.runDamageMultiplier).toBe(CANARY_RUN_STRONG_ASSIST_DMG_MULT);
    expect(state.runHpMultiplier).toBe(CANARY_RUN_STRONG_ASSIST_HP_MULT);
  });

  it('mild assist: accuracy at 0.70 (upper bound) returns mild assist multipliers', () => {
    // Updated 2026-04-10: pass 5 introduced linear interpolation between strong and mild assist.
    // At 0.65, the service interpolates t=0.5 → dmgMult=0.87, not the flat 0.86 endpoint.
    // Use 0.70 exactly (14/20) to land at t=1.0 and get the pure mild-assist values.
    const state = stateWithRunAccuracy(0.70); // 14/20 = 0.70
    expect(state.runDamageMultiplier).toBe(CANARY_RUN_MILD_ASSIST_DMG_MULT);
    expect(state.runHpMultiplier).toBe(CANARY_RUN_MILD_ASSIST_HP_MULT);
  });

  it('challenge zone: accuracy 0.75 interpolates between mild and strong challenge (no neutral zone)', () => {
    // Updated 2026-04-10: pass 5 eliminated the neutral zone. MILD_CHALLENGE_THRESHOLD = MILD_ASSIST_THRESHOLD = 0.70.
    // 0.75 accuracy → falls in mild→strong challenge interpolation:
    //   t = (0.75 - 0.70) / (0.85 - 0.70) ≈ 0.333
    //   dmgMult = lerp(1.0, 1.20, 0.333) ≈ 1.067 (NOT 1.0)
    // The old neutral zone (0.70-0.80) no longer exists.
    const state = stateWithRunAccuracy(0.75); // 15/20 = 0.75
    const dmg = state.runDamageMultiplier;
    // dmg is between mild challenge start (1.0) and strong challenge end (1.20)
    expect(dmg).toBeGreaterThan(1.0);
    expect(dmg).toBeLessThan(CANARY_RUN_STRONG_CHALLENGE_DMG_MULT);
  });

  it('strong challenge: accuracy 0.85 (upper end of interpolation) applies strong challenge multipliers', () => {
    // Updated 2026-04-10: MILD_CHALLENGE_THRESHOLD is now 0.70 (not 0.80). 0.85 is the STRONG challenge endpoint.
    // 17/20 = 0.85 → exactly at CANARY_RUN_STRONG_CHALLENGE_THRESHOLD:
    //   t = (0.85 - 0.70) / (0.85 - 0.70) = 1.0
    //   dmgMult = lerp(1.0, 1.20, 1.0) = 1.20 = CANARY_RUN_STRONG_CHALLENGE_DMG_MULT
    let state = createCanaryState();
    const answers = Array(17).fill(true).concat(Array(3).fill(false));
    for (const a of answers) state = recordCanaryAnswer(state, a);
    // 17/20 = 0.85: exactly at strong challenge threshold
    expect(state.runDamageMultiplier).toBe(CANARY_RUN_STRONG_CHALLENGE_DMG_MULT);
    expect(state.runHpMultiplier).toBe(CANARY_RUN_STRONG_CHALLENGE_HP_MULT);
  });

  it('strong challenge: accuracy above CANARY_RUN_STRONG_CHALLENGE_THRESHOLD applies strong challenge multipliers', () => {
    // 18/20 = 0.90 > 0.85 threshold
    let state = createCanaryState();
    const answers = Array(18).fill(true).concat(Array(2).fill(false));
    for (const a of answers) state = recordCanaryAnswer(state, a);
    expect(state.runDamageMultiplier).toBe(CANARY_RUN_STRONG_CHALLENGE_DMG_MULT);
    expect(state.runHpMultiplier).toBe(CANARY_RUN_STRONG_CHALLENGE_HP_MULT);
  });
});

describe('Run-level tracking: multiplicative stacking with encounter-level', () => {
  it('combined enemyDamageMultiplier is product of encounter-level and run-level', () => {
    // Drive 18/20 correct answers to get strong run-level challenge (1.25x dmg)
    // Then trigger encounter-level challenge with 5+ streak
    let state = createCanaryState();
    // First 20 answers: interleaved, then 5 correct streak
    // Actually let's keep it simple: neutral encounter + run challenge
    // Build run state with 18/20 correct (but keep encounter-level neutral by resetting floor)
    const answers = Array(18).fill(true).concat(Array(2).fill(false));
    for (const a of answers) state = recordCanaryAnswer(state, a);
    // At this point encounter level may be challenge due to streak. Reset floor to isolate.
    state = resetCanaryFloor(state);
    // Now encounter-level = neutral (wrongAnswersThisFloor=0, correctStreak preserved but reset)
    // Run-level should still be strong challenge
    // enemyDamageMultiplier = encounterDmgMult * runDmgMult
    expect(state.enemyDamageMultiplier).toBeCloseTo(state.runDamageMultiplier * 1.0, 5);
  });

  it('assist encounter + strong assist run = stacked reduction (lower than either alone)', () => {
    let state = createCanaryState();
    // Seed 12 wrong out of 20 answers to get <60% run accuracy (strong assist)
    // But we need to distribute answers to also accumulate wrong answers this floor
    const answers = Array(8).fill(true).concat(Array(12).fill(false));
    for (const a of answers) state = recordCanaryAnswer(state, a);
    // strong assist run: 0.75 dmg, 0.80 hp
    // encounter-level may be deep_assist: 0.45 dmg, 0.70 hp
    expect(state.enemyDamageMultiplier).toBeLessThan(CANARY_RUN_STRONG_ASSIST_DMG_MULT);
    expect(state.enemyHpMultiplier).toBeLessThan(CANARY_RUN_STRONG_ASSIST_HP_MULT);
  });
});

describe('Run-level tracking: floor reset preserves runAnswers', () => {
  it('resetCanaryFloor does NOT reset runAnswers', () => {
    let state = createCanaryState();
    for (let i = 0; i < 15; i++) {
      state = recordCanaryAnswer(state, i % 3 !== 0); // ~67% correct
    }
    const runAnswersBefore = [...state.runAnswers];
    state = resetCanaryFloor(state);
    expect(state.runAnswers).toEqual(runAnswersBefore);
  });

  it('run-level multipliers persist across floor resets', () => {
    let state = createCanaryState();
    // Build strong challenge run accuracy (18/20 correct)
    const answers = Array(18).fill(true).concat(Array(2).fill(false));
    for (const a of answers) state = recordCanaryAnswer(state, a);
    const runDmgBefore = state.runDamageMultiplier;
    const runHpBefore = state.runHpMultiplier;
    state = resetCanaryFloor(state);
    expect(state.runDamageMultiplier).toBe(runDmgBefore);
    expect(state.runHpMultiplier).toBe(runHpBefore);
  });
});
