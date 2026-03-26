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

describe('knowledgeAuraSystem', () => {
  beforeEach(() => {
    resetAura();
  });

  // --- resetAura tests ---

  describe('resetAura', () => {
    it('sets level to AURA_START (5)', () => {
      adjustAura(4); // move away from start
      resetAura();
      expect(getAuraLevel()).toBe(AURA_START);
      expect(getAuraLevel()).toBe(5);
    });
  });

  // --- adjustAura tests ---

  describe('adjustAura', () => {
    it('increments level by +1', () => {
      adjustAura(1);
      expect(getAuraLevel()).toBe(6);
    });

    it('decrements level by -2', () => {
      adjustAura(-2);
      expect(getAuraLevel()).toBe(3);
    });

    it('clamps at max (10): adjust to 10 then +1 stays at 10', () => {
      adjustAura(AURA_MAX - AURA_START); // bring to exactly 10
      expect(getAuraLevel()).toBe(10);
      adjustAura(1); // should stay at 10
      expect(getAuraLevel()).toBe(AURA_MAX);
      expect(getAuraLevel()).toBe(10);
    });

    it('clamps at min (0): adjust to 0 then -1 stays at 0', () => {
      adjustAura(-(AURA_START - AURA_MIN)); // bring to exactly 0
      expect(getAuraLevel()).toBe(0);
      adjustAura(-1); // should stay at 0
      expect(getAuraLevel()).toBe(AURA_MIN);
      expect(getAuraLevel()).toBe(0);
    });
  });

  // --- getAuraState threshold tests ---

  describe('getAuraState', () => {
    it('level 0 → brain_fog', () => {
      adjustAura(-AURA_START); // set to 0
      expect(getAuraState()).toBe('brain_fog');
    });

    it('level 3 → brain_fog (at BRAIN_FOG_THRESHOLD)', () => {
      adjustAura(BRAIN_FOG_THRESHOLD - AURA_START); // set to 3
      expect(getAuraLevel()).toBe(3);
      expect(getAuraState()).toBe('brain_fog');
    });

    it('level 4 → neutral (just above BRAIN_FOG_THRESHOLD)', () => {
      adjustAura(4 - AURA_START); // set to 4
      expect(getAuraLevel()).toBe(4);
      expect(getAuraState()).toBe('neutral');
    });

    it('level 6 → neutral (just below FLOW_STATE_THRESHOLD)', () => {
      adjustAura(6 - AURA_START); // set to 6
      expect(getAuraLevel()).toBe(6);
      expect(getAuraState()).toBe('neutral');
    });

    it('level 7 → flow_state (at FLOW_STATE_THRESHOLD)', () => {
      adjustAura(FLOW_STATE_THRESHOLD - AURA_START); // set to 7
      expect(getAuraLevel()).toBe(7);
      expect(getAuraState()).toBe('flow_state');
    });

    it('level 10 → flow_state (max)', () => {
      adjustAura(AURA_MAX - AURA_START); // set to 10
      expect(getAuraLevel()).toBe(10);
      expect(getAuraState()).toBe('flow_state');
    });
  });

  // --- Edge case tests ---

  describe('edge cases', () => {
    it('aura at 1, wrong charge (-2) → clamped to 0, state = brain_fog', () => {
      adjustAura(1 - AURA_START); // set to 1
      expect(getAuraLevel()).toBe(1);
      adjustAura(-2); // would be -1, clamped to 0
      expect(getAuraLevel()).toBe(0);
      expect(getAuraState()).toBe('brain_fog');
    });
  });

  // --- getAuraSnapshot tests ---

  describe('getAuraSnapshot', () => {
    it('returns correct { level, state } snapshot', () => {
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(AURA_START);
      expect(snapshot.state).toBe('neutral');
    });

    it('snapshot reflects current level and state after adjustment', () => {
      adjustAura(AURA_MAX - AURA_START); // set to 10
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(10);
      expect(snapshot.state).toBe('flow_state');
    });

    it('snapshot reflects brain_fog state', () => {
      adjustAura(-AURA_START); // set to 0
      const snapshot = getAuraSnapshot();
      expect(snapshot.level).toBe(0);
      expect(snapshot.state).toBe('brain_fog');
    });
  });

  // --- Multiple sequential adjustments ---

  describe('sequential adjustments', () => {
    it('multiple adjustments in sequence produce correct cumulative result', () => {
      adjustAura(2);  // 5 + 2 = 7
      adjustAura(-1); // 7 - 1 = 6
      adjustAura(3);  // 6 + 3 = 9
      adjustAura(-4); // 9 - 4 = 5
      expect(getAuraLevel()).toBe(5);
      expect(getAuraState()).toBe('neutral');
    });
  });
});
