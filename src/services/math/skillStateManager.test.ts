/**
 * Unit tests for skillStateManager.ts
 *
 * Covers: createSkillState defaults, reviewSkill (correct/incorrect),
 * getSkillTier thresholds, and stats accumulation.
 *
 * reviewSkill delegates to fsrsScheduler.reviewFact which is a pure function —
 * no saveService calls are made during reviewSkill, so no mocking is required.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSkillState, reviewSkill, getSkillTier } from './skillStateManager';
import type { PlayerSkillState } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Mock saveService so that getSkillState/saveSkillState module-level imports
// don't fail in non-browser environments. reviewSkill itself never calls them.
// ---------------------------------------------------------------------------

vi.mock('../saveService', () => ({
  load: vi.fn(() => null),
  save: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<PlayerSkillState> = {}): PlayerSkillState {
  return { ...createSkillState('test_skill', 'test_deck'), ...overrides };
}

// ---------------------------------------------------------------------------
// 1. createSkillState defaults
// ---------------------------------------------------------------------------

describe('createSkillState', () => {
  it('returns a state with cardState "new"', () => {
    const state = createSkillState('add_2digit', 'arithmetic');
    expect(state.cardState).toBe('new');
  });

  it('sets skillId and deckId correctly', () => {
    const state = createSkillState('add_2digit', 'arithmetic');
    expect(state.skillId).toBe('add_2digit');
    expect(state.deckId).toBe('arithmetic');
  });

  it('easeFactor defaults to 2.5', () => {
    const state = createSkillState('s', 'd');
    expect(state.easeFactor).toBe(2.5);
  });

  it('stability defaults to 0', () => {
    const state = createSkillState('s', 'd');
    expect(state.stability).toBe(0);
  });

  it('difficulty defaults to 5', () => {
    const state = createSkillState('s', 'd');
    expect(state.difficulty).toBe(5);
  });

  it('consecutiveCorrect defaults to 0', () => {
    const state = createSkillState('s', 'd');
    expect(state.consecutiveCorrect).toBe(0);
  });

  it('passedMasteryTrial defaults to false', () => {
    const state = createSkillState('s', 'd');
    expect(state.passedMasteryTrial).toBe(false);
  });

  it('totalAttempts defaults to 0', () => {
    const state = createSkillState('s', 'd');
    expect(state.totalAttempts).toBe(0);
  });

  it('totalCorrect defaults to 0', () => {
    const state = createSkillState('s', 'd');
    expect(state.totalCorrect).toBe(0);
  });

  it('interval defaults to 0', () => {
    const state = createSkillState('s', 'd');
    expect(state.interval).toBe(0);
  });

  it('isLeech defaults to false', () => {
    const state = createSkillState('s', 'd');
    expect(state.isLeech).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. reviewSkill — correct answer
// ---------------------------------------------------------------------------

describe('reviewSkill — correct=true', () => {
  it('totalAttempts increments by 1', () => {
    const state = makeState({ totalAttempts: 0 });
    const updated = reviewSkill(state, true, 1000);
    expect(updated.totalAttempts).toBe(1);
  });

  it('totalCorrect increments by 1', () => {
    const state = makeState({ totalCorrect: 0 });
    const updated = reviewSkill(state, true, 1000);
    expect(updated.totalCorrect).toBe(1);
  });

  it('consecutiveCorrect increases', () => {
    const state = makeState({ consecutiveCorrect: 0 });
    const updated = reviewSkill(state, true, 1000);
    expect(updated.consecutiveCorrect ?? 0).toBeGreaterThan(0);
  });

  it('stability increases after correct answer', () => {
    const state = makeState({ stability: 0 });
    const updated = reviewSkill(state, true, 1000);
    expect(updated.stability ?? 0).toBeGreaterThan(0);
  });

  it('cardState transitions out of "new" after correct answer', () => {
    const state = makeState({ cardState: 'new' });
    const updated = reviewSkill(state, true, 1000);
    // After one correct from "new", FSRS moves to "learning"
    expect(updated.cardState).not.toBe('new');
  });
});

// ---------------------------------------------------------------------------
// 3. reviewSkill — incorrect answer
// ---------------------------------------------------------------------------

describe('reviewSkill — correct=false', () => {
  it('totalAttempts increments by 1', () => {
    const state = makeState({ totalAttempts: 3 });
    const updated = reviewSkill(state, false, 1500);
    expect(updated.totalAttempts).toBe(4);
  });

  it('totalCorrect does NOT increment', () => {
    const state = makeState({ totalCorrect: 5 });
    const updated = reviewSkill(state, false, 1500);
    expect(updated.totalCorrect).toBe(5);
  });

  it('consecutiveCorrect resets to 0', () => {
    const state = makeState({ consecutiveCorrect: 3 });
    const updated = reviewSkill(state, false, 1500);
    expect(updated.consecutiveCorrect ?? 0).toBe(0);
  });

  it('review skill that was correct then incorrect resets consecutiveCorrect', () => {
    const state = makeState({ cardState: 'new' });
    const afterCorrect = reviewSkill(state, true, 1000);
    const afterWrong = reviewSkill(afterCorrect, false, 2000);
    expect(afterWrong.consecutiveCorrect ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. getSkillTier thresholds
// ---------------------------------------------------------------------------

describe('getSkillTier', () => {
  it('stability=0, cc=0 → tier "1"', () => {
    const state = makeState({ stability: 0, consecutiveCorrect: 0, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('1');
  });

  it('stability=3, cc=2 → tier "2a"', () => {
    const state = makeState({ stability: 3, consecutiveCorrect: 2, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('2a');
  });

  it('stability=6, cc=3 → tier "2b"', () => {
    const state = makeState({ stability: 6, consecutiveCorrect: 3, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('2b');
  });

  it('stability=12, cc=4, passedMasteryTrial=true → tier "3"', () => {
    const state = makeState({ stability: 12, consecutiveCorrect: 4, passedMasteryTrial: true });
    expect(getSkillTier(state)).toBe('3');
  });

  it('stability=12, cc=4, passedMasteryTrial=false → NOT tier "3"', () => {
    const state = makeState({ stability: 12, consecutiveCorrect: 4, passedMasteryTrial: false });
    // Without passedMasteryTrial, falls back to 2b (stability>=5, cc>=3 holds)
    expect(getSkillTier(state)).toBe('2b');
  });

  it('stability=2, cc=2 → exactly tier "2a" boundary', () => {
    const state = makeState({ stability: 2, consecutiveCorrect: 2, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('2a');
  });

  it('stability=1, cc=2 → tier "1" (stability below 2a threshold)', () => {
    const state = makeState({ stability: 1, consecutiveCorrect: 2, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('1');
  });

  it('stability=5, cc=3 → exactly tier "2b" boundary', () => {
    const state = makeState({ stability: 5, consecutiveCorrect: 3, passedMasteryTrial: false });
    expect(getSkillTier(state)).toBe('2b');
  });

  it('stability=10, cc=4, passedMasteryTrial=true → exactly tier "3" boundary', () => {
    const state = makeState({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true });
    expect(getSkillTier(state)).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// 5. Stats accumulation across multiple reviews
// ---------------------------------------------------------------------------

describe('reviewSkill — stats accumulation', () => {
  it('totalAttempts accumulates correctly across multiple reviews', () => {
    let state = makeState();
    state = reviewSkill(state, true, 1000);
    state = reviewSkill(state, false, 1000);
    state = reviewSkill(state, true, 1000);
    expect(state.totalAttempts).toBe(3);
  });

  it('totalCorrect accumulates only on correct answers', () => {
    let state = makeState();
    state = reviewSkill(state, true, 1000);  // correct
    state = reviewSkill(state, false, 1000); // wrong
    state = reviewSkill(state, true, 1000);  // correct
    expect(state.totalCorrect).toBe(2);
  });
});
