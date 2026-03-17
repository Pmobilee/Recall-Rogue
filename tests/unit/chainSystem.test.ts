import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetChain,
  extendOrResetChain,
  getChainMultiplier,
  getCurrentChainLength,
  getChainState,
} from '../../src/services/chainSystem';

describe('chainSystem', () => {
  beforeEach(() => {
    resetChain();
  });

  // --- getChainMultiplier tests ---

  describe('getChainMultiplier', () => {
    it('returns 1.0 for length 0', () => {
      expect(getChainMultiplier(0)).toBe(1.0);
    });

    it('returns 1.0 for length 1 (first card, no bonus)', () => {
      expect(getChainMultiplier(1)).toBe(1.0);
    });

    it('returns 1.3 for length 2', () => {
      expect(getChainMultiplier(2)).toBe(1.3);
    });

    it('returns 1.7 for length 3', () => {
      expect(getChainMultiplier(3)).toBe(1.7);
    });

    it('returns 2.2 for length 4', () => {
      expect(getChainMultiplier(4)).toBe(2.2);
    });

    it('returns 3.0 for length 5', () => {
      expect(getChainMultiplier(5)).toBe(3.0);
    });

    it('clamps at MAX_CHAIN_LENGTH = 5', () => {
      expect(getChainMultiplier(6)).toBe(3.0);
      expect(getChainMultiplier(100)).toBe(3.0);
    });
  });

  // --- extendOrResetChain tests ---

  describe('extendOrResetChain', () => {
    it('returns 1.0 for first card of any chainType group', () => {
      const mult = extendOrResetChain(0);
      expect(mult).toBe(1.0);
    });

    it('returns 1.3 for second consecutive same-chainType card', () => {
      extendOrResetChain(0);
      const mult = extendOrResetChain(0);
      expect(mult).toBe(1.3);
    });

    it('returns 1.7 for third consecutive same-chainType card', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      const mult = extendOrResetChain(0);
      expect(mult).toBe(1.7);
    });

    it('returns 2.2 for fourth consecutive same-chainType card', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      extendOrResetChain(0);
      const mult = extendOrResetChain(0);
      expect(mult).toBe(2.2);
    });

    it('returns 3.0 for fifth consecutive same-chainType card', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      extendOrResetChain(0);
      extendOrResetChain(0);
      const mult = extendOrResetChain(0);
      expect(mult).toBe(3.0);
    });

    it('caps at 3.0 beyond chain length 5', () => {
      for (let i = 0; i < 5; i++) extendOrResetChain(0);
      // 6th in same group — still 3.0 (capped)
      const mult = extendOrResetChain(0);
      expect(mult).toBe(3.0);
    });

    it('resets chain when different chainType is played, returns 1.0 for the new group', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      // Switch to chainType 1 — resets to length 1, mult = 1.0
      const mult = extendOrResetChain(1);
      expect(mult).toBe(1.0);
    });

    it('starts new chain with the new chainType after reset', () => {
      extendOrResetChain(0);
      extendOrResetChain(1); // resets to chainType 1 chain, length 1
      const mult = extendOrResetChain(1); // 2nd chainType 1 = length 2 = 1.3
      expect(mult).toBe(1.3);
    });

    it('returns 1.0 and resets chain for card with undefined chainType', () => {
      extendOrResetChain(0);
      extendOrResetChain(0); // chain length 2
      const mult = extendOrResetChain(undefined);
      expect(mult).toBe(1.0);
      expect(getCurrentChainLength()).toBe(0);
    });

    it('returns 1.0 for card with null chainType treated as no-chain', () => {
      extendOrResetChain(0);
      const mult = extendOrResetChain(null);
      // null — treated as no chain type
      expect(mult).toBe(1.0);
      expect(getCurrentChainLength()).toBe(0);
    });
  });

  // --- resetChain tests ---

  describe('resetChain', () => {
    it('zeroes chain length and sets chainType to null', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      expect(getCurrentChainLength()).toBe(2);

      resetChain();

      const state = getChainState();
      expect(state.length).toBe(0);
      expect(state.chainType).toBeNull();
    });

    it('after reset, first card starts fresh chain at length 1', () => {
      extendOrResetChain(0);
      extendOrResetChain(0);
      resetChain();

      const mult = extendOrResetChain(2);
      expect(mult).toBe(1.0);
      expect(getCurrentChainLength()).toBe(1);
    });
  });

  // --- getCurrentChainLength / getChainState tests ---

  describe('getCurrentChainLength', () => {
    it('returns 0 on fresh start', () => {
      expect(getCurrentChainLength()).toBe(0);
    });

    it('increments correctly through a chain', () => {
      extendOrResetChain(3);
      expect(getCurrentChainLength()).toBe(1);
      extendOrResetChain(3);
      expect(getCurrentChainLength()).toBe(2);
      extendOrResetChain(3);
      expect(getCurrentChainLength()).toBe(3);
    });

    it('resets to 1 after chainType change', () => {
      extendOrResetChain(3);
      extendOrResetChain(3);
      extendOrResetChain(4);
      expect(getCurrentChainLength()).toBe(1);
    });
  });

  describe('getChainState', () => {
    it('returns immutable snapshot with correct chainType', () => {
      extendOrResetChain(5);
      extendOrResetChain(5);
      const state = getChainState();
      expect(state.chainType).toBe(5);
      expect(state.length).toBe(2);
    });

    it('snapshot does not mutate when chain changes', () => {
      extendOrResetChain(5);
      const snap1 = getChainState();
      extendOrResetChain(5);
      const snap2 = getChainState();
      // snap1 should still have length 1
      expect(snap1.length).toBe(1);
      expect(snap2.length).toBe(2);
    });
  });
});
