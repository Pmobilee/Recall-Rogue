/**
 * Unit tests for the Fact Discovery System — "Free First Charge" (AR-59.23).
 */

import { describe, it, expect } from 'vitest';
import { isFirstChargeFree, markFirstChargeUsed, getFirstChargeWrongMultiplier } from './discoverySystem';

describe('isFirstChargeFree', () => {
  it('returns true for a fact not yet in freeChargeIds', () => {
    const ids = new Set<string>();
    expect(isFirstChargeFree('fact_001', ids)).toBe(true);
  });

  it('returns false for a fact already in freeChargeIds', () => {
    const ids = new Set<string>(['fact_001']);
    expect(isFirstChargeFree('fact_001', ids)).toBe(false);
  });

  it('returns true for a different factId even if another factId is in the set', () => {
    const ids = new Set<string>(['fact_001']);
    expect(isFirstChargeFree('fact_002', ids)).toBe(true);
  });

  it('returns false after markFirstChargeUsed is called', () => {
    const ids = new Set<string>();
    markFirstChargeUsed('fact_001', ids);
    expect(isFirstChargeFree('fact_001', ids)).toBe(false);
  });
});

describe('markFirstChargeUsed', () => {
  it('adds the factId to freeChargeIds', () => {
    const ids = new Set<string>();
    markFirstChargeUsed('fact_001', ids);
    expect(ids.has('fact_001')).toBe(true);
  });

  it('calling twice with same factId is idempotent (set.size stays at 1)', () => {
    const ids = new Set<string>();
    markFirstChargeUsed('fact_001', ids);
    markFirstChargeUsed('fact_001', ids);
    expect(ids.size).toBe(1);
  });

  it('marks different facts independently', () => {
    const ids = new Set<string>();
    markFirstChargeUsed('fact_001', ids);
    markFirstChargeUsed('fact_002', ids);
    expect(ids.size).toBe(2);
    expect(ids.has('fact_001')).toBe(true);
    expect(ids.has('fact_002')).toBe(true);
  });
});

describe('getFirstChargeWrongMultiplier', () => {
  it('returns 1.0', () => {
    expect(getFirstChargeWrongMultiplier()).toBe(1.0);
  });
});

describe('Free First Charge — run arc behavior', () => {
  it('new run starts with all facts free to Charge', () => {
    const ids = new Set<string>();
    expect(isFirstChargeFree('fact_001', ids)).toBe(true);
    expect(isFirstChargeFree('fact_002', ids)).toBe(true);
    expect(isFirstChargeFree('fact_999', ids)).toBe(true);
  });

  it('after using free Charge, that fact costs normal AP on next Charge', () => {
    const ids = new Set<string>();
    // First Charge: free
    expect(isFirstChargeFree('fact_001', ids)).toBe(true);
    markFirstChargeUsed('fact_001', ids);
    // Second Charge: normal (not free)
    expect(isFirstChargeFree('fact_001', ids)).toBe(false);
  });

  it('using free Charge on one fact does not affect other facts', () => {
    const ids = new Set<string>();
    markFirstChargeUsed('fact_001', ids);
    expect(isFirstChargeFree('fact_002', ids)).toBe(true);
    expect(isFirstChargeFree('fact_003', ids)).toBe(true);
  });
});

describe('save/resume preservation', () => {
  it('firstChargeFreeFactIds serializes to array and deserializes to Set', () => {
    const ids = new Set<string>(['fact_001', 'fact_002', 'fact_003']);
    // Serialize (simulate runSaveService)
    const arr = [...ids];
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toContain('fact_001');
    expect(arr).toContain('fact_002');
    // Deserialize
    const restored = new Set(arr);
    expect(restored.has('fact_001')).toBe(true);
    expect(restored.has('fact_002')).toBe(true);
    expect(restored.has('fact_003')).toBe(true);
    expect(isFirstChargeFree('fact_001', restored)).toBe(false);
    expect(isFirstChargeFree('fact_new', restored)).toBe(true);
  });

  it('empty firstChargeFreeFactIds serializes and restores correctly', () => {
    const ids = new Set<string>();
    const arr = [...ids];
    const restored = new Set(arr ?? []);
    expect(restored.size).toBe(0);
    expect(isFirstChargeFree('fact_001', restored)).toBe(true);
  });
});
