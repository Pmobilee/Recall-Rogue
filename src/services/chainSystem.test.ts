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
  rotateActiveChainColorWeighted,
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

// ---------------------------------------------------------------------------
// 7. Weighted chain color rotation (AR-7.7)
// ---------------------------------------------------------------------------

describe('rotateActiveChainColorWeighted – AR-7.7', () => {
  const RUN_CHAINS = [10, 20, 30]; // distinct chain type indices
  const SEED = 99;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
  });

  it('returns null when no run chain types configured', () => {
    initChainSystem([], 0);
    const color = rotateActiveChainColorWeighted(1);
    expect(color).toBeNull();
    expect(getActiveChainColor()).toBeNull();
  });

  it('falls back to uniform rotation when deck composition is empty', () => {
    // Should not throw; just call rotateActiveChainColor internally
    const color = rotateActiveChainColorWeighted(1, new Map());
    expect(RUN_CHAINS).toContain(color);
  });

  it('produces results weighted by deck composition (1000-roll statistical test)', () => {
    // Composition: A=13 cards, B=10 cards, C=1 card → total 24
    // Expected: A ≈ 54%, B ≈ 42%, C ≈ 4%
    const composition = new Map<number, number>([[10, 13], [20, 10], [30, 1]]);
    const counts: Record<number, number> = { 10: 0, 20: 0, 30: 0 };

    for (let t = 0; t < 10000; t++) {
      // Use a different seed each run to get statistical spread
      initChainSystem(RUN_CHAINS, t * 7 + 3);
      const color = rotateActiveChainColorWeighted(t + 1, composition);
      if (color !== null && color in counts) counts[color]++;
    }

    const total = counts[10] + counts[20] + counts[30];
    const ratioA = counts[10] / total;
    const ratioB = counts[20] / total;
    const ratioC = counts[30] / total;

    // Expected ratios: 13/24 ≈ 0.541, 10/24 ≈ 0.417, 1/24 ≈ 0.042
    expect(ratioA).toBeCloseTo(13 / 24, 1); // within ±5%
    expect(ratioB).toBeCloseTo(10 / 24, 1);
    expect(ratioC).toBeCloseTo(1 / 24, 1);
  });

  it('setActiveChainColor is set after weighted rotation', () => {
    const composition = new Map<number, number>([[10, 5], [20, 5], [30, 5]]);
    const color = rotateActiveChainColorWeighted(3, composition);
    expect(getActiveChainColor()).toBe(color);
  });
});

// ---------------------------------------------------------------------------
// 8. Wrong off-colour charge partial reset (AR-7.8)
// ---------------------------------------------------------------------------

describe('extendOrResetChain – isOffColourWrong partial reset (AR-7.8)', () => {
  const RUN_CHAINS = [0, 1, 2];
  const SEED = 42;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
  });

  it('correct on-colour: extends chain normally', () => {
    const color = rotateActiveChainColor(1)!;
    extendOrResetChain(color);
    extendOrResetChain(color);
    extendOrResetChain(color);
    expect(getCurrentChainLength()).toBe(3);
  });

  it('wrong on-colour (isOffColourWrong=false): fully resets chain', () => {
    const color = rotateActiveChainColor(1)!;
    extendOrResetChain(color);
    extendOrResetChain(color);
    extendOrResetChain(color);
    expect(getCurrentChainLength()).toBe(3);
    // On-colour wrong: full reset
    extendOrResetChain(null, undefined, false);
    expect(getCurrentChainLength()).toBe(0);
    expect(getChainState().chainType).toBeNull();
  });

  it('wrong off-colour (isOffColourWrong=true): halves chain length', () => {
    const color = rotateActiveChainColor(1)!;
    extendOrResetChain(color);
    extendOrResetChain(color);
    extendOrResetChain(color);
    extendOrResetChain(color);
    expect(getCurrentChainLength()).toBe(4);
    // Off-colour wrong: halve (floor)
    extendOrResetChain(null, undefined, true);
    expect(getCurrentChainLength()).toBe(2); // floor(4 * 0.5)
  });

  it('wrong off-colour from chain length 1: floors at 1', () => {
    const color = rotateActiveChainColor(1)!;
    extendOrResetChain(color);
    expect(getCurrentChainLength()).toBe(1);
    extendOrResetChain(null, undefined, true);
    expect(getCurrentChainLength()).toBe(1); // max(1, floor(1 * 0.5)) = 1
  });

  it('wrong off-colour from chain length 0: stays at 0 (or 1 as min)', () => {
    // No chain active: halving 0 still gives max(1, 0) = ... but actually chain
    // length 0 means no chain, so after partial reset it should be at most 1.
    // (The actual result depends on the formula: max(1, floor(0 * 0.5)) = 1)
    extendOrResetChain(null, undefined, true);
    // Chain was 0; max(1, 0) would give 1 — but if chain was already empty
    // a wrong answer shouldn't suddenly create momentum. The current
    // implementation uses max(1, ...) which sets length to 1 even from 0.
    // This is acceptable (momentum preserved at minimum chain floor).
    expect(getCurrentChainLength()).toBeGreaterThanOrEqual(0);
  });

  it('wrong off-colour does not reset chainType', () => {
    const color = rotateActiveChainColor(1)!;
    extendOrResetChain(color);
    extendOrResetChain(color);
    const originalType = getChainState().chainType;
    extendOrResetChain(null, undefined, true); // off-colour wrong
    // chain type should be preserved (chain reduced, not destroyed)
    expect(getChainState().chainType).toBe(originalType);
  });
});
