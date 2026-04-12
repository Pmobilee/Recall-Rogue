/**
 * Unit tests for intentDisplay.ts
 *
 * Covers `computeIntentHpImpact` — the block-decay-aware HP damage preview.
 * Created 2026-04-11 (Issue 11): intent preview was showing raw damage instead of
 * post-decay HP impact, misleading players who had block.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnemyIntent, EnemyInstance } from '../data/enemies';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Isolate intentDisplay from Phaser-dependent services used internally.

vi.mock('./enemyManager', () => ({
  getFloorDamageScaling: vi.fn(() => 1.0),
}));

vi.mock('./knowledgeAuraSystem', () => ({
  getAuraState: vi.fn(() => 'none'),
}));

vi.mock('./enemyDamageScaling', () => ({
  applyPostIntentDamageScaling: vi.fn((dmg: number) => dmg),
}));

vi.mock('../data/balance', () => ({
  getBalanceValue: vi.fn((_key: string, defaultVal: unknown) => defaultVal),
  GLOBAL_ENEMY_DAMAGE_MULTIPLIER: 1.0,
  ENEMY_TURN_DAMAGE_CAP: { 1: null, 2: null, 3: null, 4: null, endless: null },
  BLOCK_DECAY_PER_ACT: { 1: 0.15, 2: 0.25, 3: 0.35 },
  BLOCK_DECAY_RETAIN_RATE: 0.75,
}));

vi.mock('../data/statusEffects', () => ({
  getStrengthModifier: vi.fn(() => 1.0),
}));

// ── Import AFTER mocks (vi.mock is hoisted but imports resolve after) ─────────
import { computeIntentHpImpact, computeIntentDisplayDamage, computeIntentDisplayDamageSnapshot } from './intentDisplay';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIntent(value: number, type: EnemyIntent['type'] = 'attack'): EnemyIntent {
  return {
    type,
    value,
    weight: 1,
    telegraph: 'Attacks',
  };
}

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    template: {} as EnemyInstance['template'],
    currentHP: 50,
    maxHP: 50,
    block: 0,
    nextIntent: makeIntent(15),
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
    enrageBonusDamage: 0,
    playerChargedThisTurn: false,
    ...overrides,
  } as EnemyInstance;
}

// ── Tests: computeIntentHpImpact ──────────────────────────────────────────────

describe('computeIntentHpImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Issue-11 core case: block=15, raw=15, act=1 → postDecayBlock=12, hpDamage=3', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 15, 1);

    expect(result.raw).toBe(15);
    // Act 1 decay = 15%, retain = 85%: floor(15 * 0.85) = floor(12.75) = 12
    expect(result.postDecayBlock).toBe(12);
    // raw(15) - postDecayBlock(12) = 3
    expect(result.hpDamage).toBe(3);
  });

  it('block=0: takes full raw damage regardless of act', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 0, 1);

    expect(result.raw).toBe(15);
    expect(result.postDecayBlock).toBe(0);
    expect(result.hpDamage).toBe(15);
  });

  it('block=100: hpDamage=0 when block fully covers raw damage', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 100, 2);

    expect(result.raw).toBe(15);
    // Act 2 decay = 25%, retain = 75%: floor(100 * 0.75) = 75 — still covers 15
    expect(result.postDecayBlock).toBe(75);
    expect(result.hpDamage).toBe(0);
  });

  it('act fallback (undefined act): uses BLOCK_DECAY_RETAIN_RATE (75% retain = 25% decay)', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    // Undefined act → fallback to 1 - BLOCK_DECAY_RETAIN_RATE = 0.25 decay, 0.75 retain
    const result = computeIntentHpImpact(intent, enemy, 15, undefined);

    // floor(15 * 0.75) = floor(11.25) = 11
    expect(result.postDecayBlock).toBe(11);
    expect(result.hpDamage).toBe(4); // 15 - 11
  });

  it('act=2: standard decay (25%) applied correctly', () => {
    const intent = makeIntent(20);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 20, 2);

    // Act 2: 25% decay, 75% retain: floor(20 * 0.75) = 15
    expect(result.postDecayBlock).toBe(15);
    expect(result.raw).toBe(20);
    expect(result.hpDamage).toBe(5); // 20 - 15
  });

  it('act=3: harsh late-game decay (35%) applied correctly', () => {
    const intent = makeIntent(20);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 20, 3);

    // Act 3: 35% decay, 65% retain: floor(20 * 0.65) = 13
    expect(result.postDecayBlock).toBe(13);
    expect(result.raw).toBe(20);
    expect(result.hpDamage).toBe(7); // 20 - 13
  });

  it('non-attack intent returns raw=0, postDecayBlock reflects decay, hpDamage=0', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 20, 1);

    expect(result.raw).toBe(0);
    // Act 1: floor(20 * 0.85) = 17
    expect(result.postDecayBlock).toBe(17);
    expect(result.hpDamage).toBe(0);
  });

  it('multi_attack intent: raw reflects the per-hit value from computeIntentDisplayDamage', () => {
    const intent = makeIntent(8, 'multi_attack');
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 0, 1);

    // With block=0, hpDamage should equal raw (8)
    expect(result.raw).toBe(8);
    expect(result.hpDamage).toBe(8);
  });

  it('hpDamage is never negative (block surplus is not healed)', () => {
    const intent = makeIntent(5);
    const enemy = makeEnemy();
    // Block 50, damage 5 — block always wins
    const result = computeIntentHpImpact(intent, enemy, 50, 1);

    expect(result.hpDamage).toBe(0);
    expect(result.hpDamage).toBeGreaterThanOrEqual(0);
  });

  it('returns all three fields (raw, postDecayBlock, hpDamage) as integers', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 15, 1);

    expect(Number.isInteger(result.raw)).toBe(true);
    expect(Number.isInteger(result.postDecayBlock)).toBe(true);
    expect(Number.isInteger(result.hpDamage)).toBe(true);
  });
});

// ── Sanity: computeIntentDisplayDamage still works ───────────────────────────

describe('computeIntentDisplayDamage (backward compat)', () => {
  it('returns raw damage unmodified by block', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const raw = computeIntentDisplayDamage(intent, enemy);

    expect(raw).toBe(15);
  });

  it('returns 0 for non-attack intents', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(0);
  });
});

// ── Tests: computeIntentDisplayDamageSnapshot (Bug 3) ───────────────────────
//
// Before this fix, CardCombatOverlay.svelte had a `$derived.by` that called
// `computeIntentHpImpact(intent, enemy, turnState.playerState.shield)`. Every
// card play mutated shield, re-triggered the derived, and recomputed intent
// display mid-turn. Intent damage should be pinned at turn-start (intent-roll time).
//
// Backend fix: turnManager.ts now calls `computeIntentDisplayDamageSnapshot()`
// after rollNextIntent() and stores the result on `enemy.lockedDisplayDamage`.
// The UI should read `enemy.lockedDisplayDamage` rather than deriving live.
//
// These tests verify:
//   1. The snapshot function is deterministic and matches computeIntentDisplayDamage.
//   2. A snapshot taken with block=5 is NOT affected by subsequent block changes.

describe('Bug 3 — computeIntentDisplayDamageSnapshot pins damage at lock time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('snapshot returns same value as computeIntentDisplayDamage (deterministic)', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const playerStateAtLockTime = { shield: 5, statusEffects: [] };

    const live = computeIntentDisplayDamage(intent, enemy);
    const snapshot = computeIntentDisplayDamageSnapshot(intent, enemy, playerStateAtLockTime);

    // Both should produce the same raw damage value.
    expect(snapshot).toBe(live);
  });

  it('snapshot is independent of subsequent shield changes (core regression case)', () => {
    const intent = makeIntent(20);
    const enemy = makeEnemy();

    // Simulate: intent locked at start-of-turn when player has 5 block.
    const playerStateAtLockTime = { shield: 5, statusEffects: [] };
    const locked = computeIntentDisplayDamageSnapshot(intent, enemy, playerStateAtLockTime);

    // Player then plays shield cards — 15 more block added mid-turn.
    const playerStateMidTurn = { shield: 20, statusEffects: [] };
    const midTurnComputed = computeIntentDisplayDamageSnapshot(intent, enemy, playerStateMidTurn);

    // The locked value from start-of-turn should equal the mid-turn computed value
    // because the snapshot function returns raw damage (not block-adjusted).
    // The point is: when the UI reads enemy.lockedDisplayDamage, it gets the
    // start-of-turn raw value, not a value that drifts as block changes.
    expect(locked).toBe(midTurnComputed);
  });

  it('snapshot returns 0 for non-attack intents', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    const playerState = { shield: 50, statusEffects: [] };

    const snapshot = computeIntentDisplayDamageSnapshot(intent, enemy, playerState);
    expect(snapshot).toBe(0);
  });
});
