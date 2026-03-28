import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetAura,
  adjustAura,
  getAuraState,
  getAuraLevel,
  getAuraSnapshot,
  AURA_START,
  AURA_MIN,
  AURA_MAX,
  BRAIN_FOG_THRESHOLD,
  FLOW_STATE_THRESHOLD,
} from '../../src/services/knowledgeAuraSystem';

describe('knowledgeAuraSystem (Brain Fog — inverted)', () => {
  beforeEach(() => {
    resetAura();
  });

  // --- resetAura tests ---

  describe('resetAura', () => {
    it('sets level to AURA_START (0) — fog starts clear', () => {
      adjustAura(4); // move away from start
      resetAura();
      expect(getAuraLevel()).toBe(AURA_START);
      expect(getAuraLevel()).toBe(0);
    });
  });

  // --- adjustAura tests ---

  describe('adjustAura', () => {
    it('increments level by +2 (wrong answer increases fog)', () => {
      adjustAura(2);
      expect(getAuraLevel()).toBe(2);
    });

    it('decrements level by -1 (correct answer decreases fog)', () => {
      adjustAura(5); // set fog to 5 first
      adjustAura(-1);
      expect(getAuraLevel()).toBe(4);
    });

    it('clamps at max (10): adjust to 10 then +1 stays at 10', () => {
      adjustAura(AURA_MAX - AURA_START); // bring to exactly 10 (from 0)
      expect(getAuraLevel()).toBe(10);
      adjustAura(1); // should stay at 10
      expect(getAuraLevel()).toBe(AURA_MAX);
      expect(getAuraLevel()).toBe(10);
    });

    it('clamps at min (0): already at 0, -1 stays at 0', () => {
      // AURA_START is already 0
      expect(getAuraLevel()).toBe(0);
      adjustAura(-1); // should stay at 0
      expect(getAuraLevel()).toBe(AURA_MIN);
      expect(getAuraLevel()).toBe(0);
    });
  });

  // --- getAuraState threshold tests ---

  describe('getAuraState', () => {
    it('level 0 → flow_state (fog is clear)', () => {
      // Start is already 0
      expect(getAuraState()).toBe('flow_state');
    });

    it('level 2 → flow_state (at FLOW_STATE_THRESHOLD)', () => {
      adjustAura(2); // set to 2
      expect(getAuraLevel()).toBe(2);
      expect(getAuraState()).toBe('flow_state');
    });

    it('level 3 → neutral (just above FLOW_STATE_THRESHOLD)', () => {
      adjustAura(3); // set to 3
      expect(getAuraLevel()).toBe(3);
      expect(getAuraState()).toBe('neutral');
    });

    it('level 6 → neutral (just below BRAIN_FOG_THRESHOLD)', () => {
      adjustAura(6); // set to 6
      expect(getAuraLevel()).toBe(6);
      expect(getAuraState()).toBe('neutral');
    });

    it('level 7 → brain_fog (at BRAIN_FOG_THRESHOLD)', () => {
      adjustAura(BRAIN_FOG_THRESHOLD); // set to 7
      expect(getAuraLevel()).toBe(7);
      expect(getAuraState()).toBe('brain_fog');
    });

    it('level 10 → brain_fog (max fog)', () => {
      adjustAura(AURA_MAX); // set to 10
      expect(getAuraLevel()).toBe(10);
      expect(getAuraState()).toBe('brain_fog');
    });
  });

  // --- Edge case tests ---

  describe('edge cases', () => {
    it('fog at 9, wrong charge (+2) → clamped to 10, state = brain_fog', () => {
      adjustAura(9); // set to 9
      expect(getAuraLevel()).toBe(9);
      adjustAura(2); // would be 11, clamped to 10
      expect(getAuraLevel()).toBe(10);
      expect(getAuraState()).toBe('brain_fog');
    });

    it('fog at 1, correct charge (-1) → stays at 0, state = flow_state', () => {
      adjustAura(1); // set to 1
      expect(getAuraLevel()).toBe(1);
      adjustAura(-1); // 0
      expect(getAuraLevel()).toBe(0);
      expect(getAuraState()).toBe('flow_state');
    });
  });

  // --- getAuraSnapshot tests ---

  describe('getAuraSnapshot', () => {
    it('returns correct { level, state } snapshot at start (fog=0, flow_state)', () => {
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(AURA_START);
      expect(snapshot.level).toBe(0);
      expect(snapshot.state).toBe('flow_state');
    });

    it('snapshot reflects brain_fog state at level 10', () => {
      adjustAura(AURA_MAX); // set to 10
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(10);
      expect(snapshot.state).toBe('brain_fog');
    });

    it('snapshot reflects neutral state at level 5', () => {
      adjustAura(5); // set to 5
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(5);
      expect(snapshot.state).toBe('neutral');
    });
  });

  // --- Multiple sequential adjustments ---

  describe('sequential adjustments', () => {
    it('multiple adjustments in sequence produce correct cumulative result', () => {
      adjustAura(2);  // 0 + 2 = 2  (flow_state)
      adjustAura(4);  // 2 + 4 = 6  (neutral)
      adjustAura(2);  // 6 + 2 = 8  (brain_fog)
      adjustAura(-3); // 8 - 3 = 5  (neutral)
      expect(getAuraLevel()).toBe(5);
      expect(getAuraState()).toBe('neutral');
    });

    it('simulates a good run: starts clear, wrong answer, then three correct → back to flow_state', () => {
      // Start at 0 (flow_state)
      expect(getAuraState()).toBe('flow_state');
      adjustAura(2);  // wrong answer → fog = 2 (still flow_state at threshold)
      adjustAura(2);  // another wrong → fog = 4 (neutral)
      adjustAura(-1); // correct → fog = 3 (neutral)
      adjustAura(-1); // correct → fog = 2 (flow_state)
      expect(getAuraLevel()).toBe(2);
      expect(getAuraState()).toBe('flow_state');
    });
  });
});
