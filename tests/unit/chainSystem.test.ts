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
    it('returns 1.0 for first card of any categoryL2 group', () => {
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(1.0);
    });

    it('returns 1.3 for second consecutive same-categoryL2 card', () => {
      extendOrResetChain('mammals');
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(1.3);
    });

    it('returns 1.7 for third consecutive same-categoryL2 card', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(1.7);
    });

    it('returns 2.2 for fourth consecutive same-categoryL2 card', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(2.2);
    });

    it('returns 3.0 for fifth consecutive same-categoryL2 card', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(3.0);
    });

    it('caps at 3.0 beyond chain length 5', () => {
      for (let i = 0; i < 5; i++) extendOrResetChain('mammals');
      // 6th in same group — still 3.0 (capped)
      const mult = extendOrResetChain('mammals');
      expect(mult).toBe(3.0);
    });

    it('resets chain when different categoryL2 is played, returns 1.0 for the new group', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      // Switch to 'birds' — resets to length 1, mult = 1.0
      const mult = extendOrResetChain('birds');
      expect(mult).toBe(1.0);
    });

    it('starts new chain with the new categoryL2 after reset', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('birds'); // resets to birds chain, length 1
      const mult = extendOrResetChain('birds'); // 2nd birds = length 2 = 1.3
      expect(mult).toBe(1.3);
    });

    it('returns 1.0 and resets chain for card with undefined categoryL2', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals'); // chain length 2
      const mult = extendOrResetChain(undefined);
      expect(mult).toBe(1.0);
      expect(getCurrentChainLength()).toBe(0);
    });

    it('returns 1.0 for card with empty string categoryL2 treated as no-category', () => {
      extendOrResetChain('mammals');
      const mult = extendOrResetChain('');
      // Empty string is falsy — treated as undefined
      expect(mult).toBe(1.0);
      expect(getCurrentChainLength()).toBe(0);
    });
  });

  // --- resetChain tests ---

  describe('resetChain', () => {
    it('zeroes chain length and sets categoryL2 to null', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      expect(getCurrentChainLength()).toBe(2);

      resetChain();

      const state = getChainState();
      expect(state.length).toBe(0);
      expect(state.categoryL2).toBeNull();
    });

    it('after reset, first card starts fresh chain at length 1', () => {
      extendOrResetChain('mammals');
      extendOrResetChain('mammals');
      resetChain();

      const mult = extendOrResetChain('reptiles');
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
      extendOrResetChain('plants');
      expect(getCurrentChainLength()).toBe(1);
      extendOrResetChain('plants');
      expect(getCurrentChainLength()).toBe(2);
      extendOrResetChain('plants');
      expect(getCurrentChainLength()).toBe(3);
    });

    it('resets to 1 after categoryL2 change', () => {
      extendOrResetChain('plants');
      extendOrResetChain('plants');
      extendOrResetChain('fungi');
      expect(getCurrentChainLength()).toBe(1);
    });
  });

  describe('getChainState', () => {
    it('returns immutable snapshot with correct categoryL2', () => {
      extendOrResetChain('oceans');
      extendOrResetChain('oceans');
      const state = getChainState();
      expect(state.categoryL2).toBe('oceans');
      expect(state.length).toBe(2);
    });

    it('snapshot does not mutate when chain changes', () => {
      extendOrResetChain('oceans');
      const snap1 = getChainState();
      extendOrResetChain('oceans');
      const snap2 = getChainState();
      // snap1 should still have length 1
      expect(snap1.length).toBe(1);
      expect(snap2.length).toBe(2);
    });
  });
});
