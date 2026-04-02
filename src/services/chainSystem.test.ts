/**
 * Unit tests for the Chain System.
 * Covers: chain state machine, multiplier scaling, decay, rotating chain color
 * (AR-310), legacy fallback mode, and initChainSystem.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetChain,
  decayChain,
  extendOrResetChain,
  getChainState,
  getChainMultiplier,
  getCurrentChainLength,
  initChainSystem,
  rotateActiveChainColor,
  getActiveChainColor,
} from './chainSystem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset all chain state between tests. */
function cleanState(): void {
  // Re-init with empty types to clear rotation state, then reset chain.
  initChainSystem([], 0);
  resetChain();
}

// ---------------------------------------------------------------------------
// 1. Chain multiplier table
// ---------------------------------------------------------------------------

describe('getChainMultiplier', () => {
  it('returns 1.0 for length 0', () => {
    expect(getChainMultiplier(0)).toBe(1.0);
  });

  it('returns scaled multipliers for lengths 1-5 (matches balance.ts CHAIN_MULTIPLIERS)', () => {
    expect(getChainMultiplier(1)).toBe(1.2);
    expect(getChainMultiplier(2)).toBe(1.5);
    expect(getChainMultiplier(3)).toBe(2.0);
    expect(getChainMultiplier(4)).toBe(2.5);
    expect(getChainMultiplier(5)).toBe(3.5);
  });

  it('clamps to MAX_CHAIN_LENGTH (5)', () => {
    expect(getChainMultiplier(99)).toBe(3.5);
  });

  it('clamps negative lengths to 0', () => {
    expect(getChainMultiplier(-1)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 2. Legacy mode (no runChainTypes configured) — consecutive same-type
// ---------------------------------------------------------------------------

describe('chainSystem – legacy mode (no runChainTypes)', () => {
  beforeEach(cleanState);

  it('starts with empty chain state', () => {
    const s = getChainState();
    expect(s.chainType).toBeNull();
    expect(s.length).toBe(0);
  });

  it('null/undefined chainType resets chain', () => {
    extendOrResetChain(1);
    extendOrResetChain(null);
    expect(getChainState().length).toBe(0);
    expect(getChainState().chainType).toBeNull();
  });

  it('same chainType extends chain', () => {
    extendOrResetChain(2);
    extendOrResetChain(2);
    const s = getChainState();
    expect(s.length).toBe(2);
    expect(s.chainType).toBe(2);
  });

  it('different chainType starts a new chain at length 1', () => {
    extendOrResetChain(2);
    extendOrResetChain(2);
    extendOrResetChain(3); // different type
    const s = getChainState();
    expect(s.length).toBe(1);
    expect(s.chainType).toBe(3);
  });

  it('chain caps at MAX_CHAIN_LENGTH (5)', () => {
    for (let i = 0; i < 10; i++) extendOrResetChain(0);
    expect(getCurrentChainLength()).toBe(5);
  });

  it('returns correct multiplier from extendOrResetChain', () => {
    expect(extendOrResetChain(1)).toBe(1.2); // length 1
    expect(extendOrResetChain(1)).toBe(1.5); // length 2
    expect(extendOrResetChain(1)).toBe(2.0); // length 3
  });

  it('chainMultiplierOverride clamps returned multiplier', () => {
    extendOrResetChain(1);
    extendOrResetChain(1); // length 2, mult = 1.3
    const mult = extendOrResetChain(1, 1.0); // override to 1.0
    expect(mult).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 3. Chain decay
// ---------------------------------------------------------------------------

describe('decayChain', () => {
  beforeEach(cleanState);

  it('reduces length by 1 each decay', () => {
    extendOrResetChain(0);
    extendOrResetChain(0);
    extendOrResetChain(0); // length 3
    decayChain();
    expect(getCurrentChainLength()).toBe(2);
  });

  it('clears chain type when length reaches 0', () => {
    extendOrResetChain(1); // length 1
    decayChain();
    const s = getChainState();
    expect(s.length).toBe(0);
    expect(s.chainType).toBeNull();
  });

  it('does not go below 0', () => {
    decayChain();
    expect(getCurrentChainLength()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Rotating chain color — AR-310
// ---------------------------------------------------------------------------

describe('rotateActiveChainColor – AR-310', () => {
  const RUN_CHAINS = [0, 2, 4];
  const SEED = 12345;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
  });

  it('returns a color from the run chain types', () => {
    const color = rotateActiveChainColor(1);
    expect(RUN_CHAINS).toContain(color);
  });

  it('getActiveChainColor returns last rotated color', () => {
    const color = rotateActiveChainColor(3);
    expect(getActiveChainColor()).toBe(color);
  });

  it('different turn numbers can produce different colors', () => {
    const results = new Set<number>();
    // Try enough turns to see variety across the 3 chain types
    for (let t = 1; t <= 30; t++) {
      const c = rotateActiveChainColor(t);
      if (c !== null) results.add(c);
    }
    // With 3 run chain types and 30 turns, expect to see all 3 colors
    expect(results.size).toBe(3);
  });

  it('same turn number + seed produces same color (deterministic)', () => {
    const c1 = rotateActiveChainColor(7);
    initChainSystem(RUN_CHAINS, SEED);
    const c2 = rotateActiveChainColor(7);
    expect(c1).toBe(c2);
  });

  it('returns null when no run chain types are configured', () => {
    initChainSystem([], 0);
    const color = rotateActiveChainColor(1);
    expect(color).toBeNull();
    expect(getActiveChainColor()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Chain extension using active chain color — AR-310 rotation mode
// ---------------------------------------------------------------------------

describe('extendOrResetChain – rotating color mode (AR-310)', () => {
  const RUN_CHAINS = [1, 3, 5];
  const SEED = 999;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
  });

  it('extends chain when card matches active chain color', () => {
    const activeColor = rotateActiveChainColor(1)!;
    extendOrResetChain(activeColor); // length 1
    extendOrResetChain(activeColor); // length 2
    expect(getCurrentChainLength()).toBe(2);
  });

  it('does NOT extend chain when card does not match active color', () => {
    const activeColor = rotateActiveChainColor(1)!;
    // Find a chain type that isn't the active color
    const otherColor = RUN_CHAINS.find(c => c !== activeColor)!;
    extendOrResetChain(activeColor); // length 1
    extendOrResetChain(otherColor);  // no extension, preserved at 1
    expect(getCurrentChainLength()).toBe(1);
  });

  it('preserves chain length when non-active color played (multiplier not lost)', () => {
    const activeColor = rotateActiveChainColor(1)!;
    const otherColor = RUN_CHAINS.find(c => c !== activeColor)!;
    // Build chain to length 3
    extendOrResetChain(activeColor);
    extendOrResetChain(activeColor);
    extendOrResetChain(activeColor); // length 3, mult 1.7
    // Play non-active color — chain should still be at 3
    extendOrResetChain(otherColor);
    expect(getCurrentChainLength()).toBe(3);
  });

  it('returns correct multiplier for the preserved chain length on non-matching play', () => {
    const activeColor = rotateActiveChainColor(1)!;
    const otherColor = RUN_CHAINS.find(c => c !== activeColor)!;
    extendOrResetChain(activeColor); // len 1, mult 1.0
    extendOrResetChain(activeColor); // len 2, mult 1.3
    // Non-active color: chain length stays 2, so multiplier = 1.5
    const mult = extendOrResetChain(otherColor);
    expect(mult).toBe(1.5);
  });

  it('caps chain at MAX_CHAIN_LENGTH regardless of active color', () => {
    const activeColor = rotateActiveChainColor(1)!;
    for (let i = 0; i < 10; i++) extendOrResetChain(activeColor);
    expect(getCurrentChainLength()).toBe(5);
  });

  it('null chainType still resets chain in rotation mode', () => {
    const activeColor = rotateActiveChainColor(1)!;
    extendOrResetChain(activeColor);
    extendOrResetChain(null);
    expect(getCurrentChainLength()).toBe(0);
    expect(getChainState().chainType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Chain multiplier persists across active-color rotations
// ---------------------------------------------------------------------------

describe('chain multiplier persistence across turn rotations', () => {
  const RUN_CHAINS = [0, 1, 2];
  const SEED = 42;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
  });

  it('chain length carries across different active colors each turn', () => {
    // Turn 1: build chain to length 3 with active color
    const color1 = rotateActiveChainColor(1)!;
    extendOrResetChain(color1);
    extendOrResetChain(color1);
    extendOrResetChain(color1);
    expect(getCurrentChainLength()).toBe(3);

    // Simulate turn transition (decay then rotate)
    decayChain(); // length → 2
    expect(getCurrentChainLength()).toBe(2);

    // Turn 2: rotate to new color, then extend
    const color2 = rotateActiveChainColor(2)!;
    extendOrResetChain(color2); // extends from 2 → 3
    expect(getCurrentChainLength()).toBe(3);
  });
});
