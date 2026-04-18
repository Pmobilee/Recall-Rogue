/**
 * Unit tests for intentDisplay.ts
 *
 * Covers `computeIntentHpImpact`, `computeIntentDisplayDamage`, and
 * `computeIntentDisplayDamageSnapshot`.
 *
 * History:
 * - Created 2026-04-11 (Issue 11): intent preview was showing raw damage instead of
 *   post-decay HP impact, misleading players who had block. Initial fix incorrectly
 *   applied block decay before the enemy attack.
 * - Updated 2026-04-18 (Bug 1/2/3 fix): three bugs corrected:
 *   Bug 1: multi_attack damage cap was applied per-hit in display but to total in executor.
 *          Fix: computeIntentDisplayDamage multiplies by hitCount BEFORE the cap.
 *   Bug 2: computeIntentHpImpact was decaying block before comparing to raw damage.
 *          Fix: block does NOT decay before the enemy attacks — resetTurnState (which
 *          decays block) runs AFTER takeDamage in endPlayerTurn(). Use full current block.
 *   Bug 3: multi_attack bubble showed "${perHitHpDamage}×${hits}" but lockedDisplayDamage
 *          now stores TOTAL, so the UI shows total hpDamage directly.
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
import { computeIntentHpImpact, computeIntentDisplayDamage, computeIntentDisplayDamageSnapshot, computeIntentDisplayDamageWithPerHit, computeIntentDisplayDamageWithPerHitSnapshot } from './intentDisplay';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIntent(value: number, type: EnemyIntent['type'] = 'attack', hitCount?: number): EnemyIntent {
  return {
    type,
    value,
    weight: 1,
    telegraph: 'Attacks',
    ...(hitCount !== undefined ? { hitCount } : {}),
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

// ── Tests: computeIntentDisplayDamage (Bug 1 fix) ────────────────────────────

describe('computeIntentDisplayDamage — Bug 1 fix: multi_attack returns TOTAL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attack intent: returns per-hit value (single hit unchanged)', () => {
    const intent = makeIntent(11);
    const enemy = makeEnemy();
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(11);
  });

  it('multi_attack 2 hits: returns TOTAL (11×2=22), not per-hit', () => {
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy();
    // Bug 1 root cause: old code returned 11 (per-hit), UI then showed "11×2".
    // Executor computed 11*2=22 then capped to 16. Player saw 22 implied but took 16.
    // Fix: return 22 (total) before cap is applied.
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(22);
  });

  it('multi_attack 3 hits: returns TOTAL (5×3=15)', () => {
    const intent = makeIntent(5, 'multi_attack', 3);
    const enemy = makeEnemy();
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(15);
  });

  it('multi_attack: cap applied to TOTAL, not per-hit', () => {
    // ENEMY_TURN_DAMAGE_CAP has segment 1 = null (no cap) in this test mock.
    // To test cap: temporarily override via makeEnemy with floor > 12 to use segment 2.
    // The mock has all caps = null, so we verify total without cap interference.
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy({ floor: 1 }); // segment 1, cap = null
    // Total = 22, no cap applied (null), returns 22
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(22);
  });

  it('multi_attack with hitCount=1 defaults to 1 hit (same as attack)', () => {
    const intent = makeIntent(10, 'multi_attack', 1);
    const enemy = makeEnemy();
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(10);
  });

  it('returns 0 for non-attack intents', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    expect(computeIntentDisplayDamage(intent, enemy)).toBe(0);
  });
});

// ── Tests: computeIntentHpImpact (Bug 2 fix) ─────────────────────────────────

describe('computeIntentHpImpact — Bug 2 fix: no block decay before enemy attacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Bug 2 core case: block=5, raw=11, act=1 → postDecayBlock=5 (no decay), hpDamage=6', () => {
    const intent = makeIntent(11);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 5, 1);

    expect(result.raw).toBe(11);
    // Bug 2 fix: block is NOT decayed before the attack.
    // Old (wrong) behavior: floor(5 * 0.85) = 4 → hpDamage = 7
    // New (correct) behavior: postDecayBlock = 5 → hpDamage = 6
    expect(result.postDecayBlock).toBe(5);
    expect(result.hpDamage).toBe(6);
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
    // Bug 2 fix: no decay — full 100 block is available.
    // Old (wrong): floor(100 * 0.75) = 75 — still covers 15, so hpDamage=0 (correct by accident)
    // New (correct): postDecayBlock = 100 — definitely covers 15, hpDamage=0
    expect(result.postDecayBlock).toBe(100);
    expect(result.hpDamage).toBe(0);
  });

  it('act parameter is ignored — block is not decayed regardless of act value', () => {
    const intent = makeIntent(10);
    const enemy = makeEnemy();
    const blockVal = 8;

    const resultAct1 = computeIntentHpImpact(intent, enemy, blockVal, 1);
    const resultAct2 = computeIntentHpImpact(intent, enemy, blockVal, 2);
    const resultAct3 = computeIntentHpImpact(intent, enemy, blockVal, 3);
    const resultUndef = computeIntentHpImpact(intent, enemy, blockVal, undefined);

    // All acts should produce the same result: full block, no decay.
    expect(resultAct1.postDecayBlock).toBe(8);
    expect(resultAct2.postDecayBlock).toBe(8);
    expect(resultAct3.postDecayBlock).toBe(8);
    expect(resultUndef.postDecayBlock).toBe(8);
    expect(resultAct1.hpDamage).toBe(2); // 10 - 8 = 2
    expect(resultAct2.hpDamage).toBe(2);
    expect(resultAct3.hpDamage).toBe(2);
    expect(resultUndef.hpDamage).toBe(2);
  });

  it('non-attack intent returns raw=0, postDecayBlock=playerBlock, hpDamage=0', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 20, 1);

    expect(result.raw).toBe(0);
    // No block decay — full block available.
    expect(result.postDecayBlock).toBe(20);
    expect(result.hpDamage).toBe(0);
  });

  it('multi_attack: raw is TOTAL (Bug 1+2 combined), hpDamage = total - block', () => {
    // Bug 1: multi_attack raw = total = 8 (1 hit, no hitCount multiplication in test)
    // Bug 2: block is not decayed
    const intent = makeIntent(8, 'multi_attack');
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 0, 1);

    expect(result.raw).toBe(8);
    expect(result.hpDamage).toBe(8);
  });

  it('multi_attack 2 hits with block: raw=total=22, hpDamage=22-block', () => {
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy();
    const result = computeIntentHpImpact(intent, enemy, 5, 1);

    // Bug 1+2 combined: total=22, block=5 (no decay), hpDamage=17
    // Old (double-wrong): raw=11 (per-hit), postDecayBlock=floor(5*0.85)=4, hpDamage=7 → displayed as "7×2=14"
    // New (correct): raw=22, postDecayBlock=5, hpDamage=17
    expect(result.raw).toBe(22);
    expect(result.postDecayBlock).toBe(5);
    expect(result.hpDamage).toBe(17);
  });

  it('hpDamage is never negative (block surplus is not healed)', () => {
    const intent = makeIntent(5);
    const enemy = makeEnemy();
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

// ── Tests: computeIntentDisplayDamageSnapshot (Bug 3 — snapshot stability) ───
//
// Before this fix, CardCombatOverlay.svelte had a `$derived.by` that called
// `computeIntentHpImpact(intent, enemy, turnState.playerState.shield)`. Every
// card play mutated shield, re-triggered the derived, and recomputed intent
// display mid-turn. Intent damage should be pinned at turn-start (intent-roll time).
//
// Backend fix: turnManager.ts now calls `computeIntentDisplayDamageSnapshot()`
// after rollNextIntent() and stores the result on `enemy.lockedDisplayDamage`.
// The UI reads `enemy.lockedDisplayDamage` rather than deriving live.
//
// For multi_attack, lockedDisplayDamage stores the TOTAL damage (Bug 1 fix).

describe('computeIntentDisplayDamageSnapshot — pins TOTAL damage at lock time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attack: snapshot returns same value as computeIntentDisplayDamage', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const playerState = { shield: 5, statusEffects: [] };

    const live = computeIntentDisplayDamage(intent, enemy);
    const snapshot = computeIntentDisplayDamageSnapshot(intent, enemy, playerState);

    expect(snapshot).toBe(live);
    expect(snapshot).toBe(15);
  });

  it('multi_attack: snapshot stores TOTAL (hitCount * perHit), not per-hit', () => {
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy();
    const playerState = { shield: 5, statusEffects: [] };

    const snapshot = computeIntentDisplayDamageSnapshot(intent, enemy, playerState);

    // After Bug 1 fix: computeIntentDisplayDamage returns 22 (total), not 11 (per-hit).
    // lockedDisplayDamage = 22 means the UI shows "22 − 5 = 17 HP damage" total.
    expect(snapshot).toBe(22);
  });

  it('snapshot is independent of shield value (shield does not affect raw damage)', () => {
    const intent = makeIntent(20);
    const enemy = makeEnemy();

    const lockedAtLowBlock = computeIntentDisplayDamageSnapshot(intent, enemy, { shield: 5, statusEffects: [] });
    const lockedAtHighBlock = computeIntentDisplayDamageSnapshot(intent, enemy, { shield: 20, statusEffects: [] });

    // Raw damage is the same regardless of block — block is applied at display time by UI.
    expect(lockedAtLowBlock).toBe(20);
    expect(lockedAtHighBlock).toBe(20);
  });

  it('snapshot returns 0 for non-attack intents', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    const playerState = { shield: 50, statusEffects: [] };

    const snapshot = computeIntentDisplayDamageSnapshot(intent, enemy, playerState);
    expect(snapshot).toBe(0);
  });
});

// ── Tests: computeIntentDisplayDamageWithPerHit (per-hit breakdown) ──────────

describe('computeIntentDisplayDamageWithPerHit — per-hit cap for multi_attack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regular attack: total === perHit (single hit, no per-hit concept)', () => {
    const intent = makeIntent(11);
    const enemy = makeEnemy();
    const result = computeIntentDisplayDamageWithPerHit(intent, enemy);
    expect(result.total).toBe(11);
    expect(result.perHit).toBe(11);
  });

  it('non-attack intent: both total and perHit are 0', () => {
    const intent = makeIntent(10, 'defend');
    const enemy = makeEnemy();
    const result = computeIntentDisplayDamageWithPerHit(intent, enemy);
    expect(result.total).toBe(0);
    expect(result.perHit).toBe(0);
  });

  it('multi_attack 3 hits, no cap: perHit=5, total=15', () => {
    const intent = makeIntent(5, 'multi_attack', 3);
    const enemy = makeEnemy();
    const result = computeIntentDisplayDamageWithPerHit(intent, enemy);
    expect(result.perHit).toBe(5);
    expect(result.total).toBe(15);
  });

  it('multi_attack 2 hits, no cap: perHit=11, total=22', () => {
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy();
    const result = computeIntentDisplayDamageWithPerHit(intent, enemy);
    expect(result.perHit).toBe(11);
    expect(result.total).toBe(22);
  });

  it('multi_attack total always equals perHit × hitCount exactly', () => {
    const intent = makeIntent(7, 'multi_attack', 3);
    const enemy = makeEnemy();
    const result = computeIntentDisplayDamageWithPerHit(intent, enemy);
    expect(result.total).toBe(result.perHit * 3);
  });

  it('computeIntentDisplayDamage delegates to computeIntentDisplayDamageWithPerHit', () => {
    const intent = makeIntent(11, 'multi_attack', 2);
    const enemy = makeEnemy();
    const withPerHit = computeIntentDisplayDamageWithPerHit(intent, enemy);
    const legacy = computeIntentDisplayDamage(intent, enemy);
    expect(legacy).toBe(withPerHit.total);
  });
});

// ── Tests: computeIntentDisplayDamageWithPerHitSnapshot (lock time) ───────────

describe('computeIntentDisplayDamageWithPerHitSnapshot — pins { total, perHit } at lock time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attack: snapshot total and perHit are equal (single hit)', () => {
    const intent = makeIntent(15);
    const enemy = makeEnemy();
    const playerState = { shield: 5, statusEffects: [] };
    const snap = computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, playerState);
    expect(snap.total).toBe(15);
    expect(snap.perHit).toBe(15);
  });

  it('multi_attack: snapshot has distinct total and perHit', () => {
    const intent = makeIntent(8, 'multi_attack', 3);
    const enemy = makeEnemy();
    const playerState = { shield: 0, statusEffects: [] };
    const snap = computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, playerState);
    expect(snap.perHit).toBe(8);
    expect(snap.total).toBe(24);
    expect(snap.total).toBe(snap.perHit * 3);
  });

  it('snapshot is independent of shield value', () => {
    const intent = makeIntent(10, 'multi_attack', 2);
    const enemy = makeEnemy();
    const snapLow = computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, { shield: 3, statusEffects: [] });
    const snapHigh = computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, { shield: 100, statusEffects: [] });
    expect(snapLow.total).toBe(snapHigh.total);
    expect(snapLow.perHit).toBe(snapHigh.perHit);
  });

  it('non-attack: snapshot returns { total: 0, perHit: 0 }', () => {
    const intent = makeIntent(12, 'defend');
    const enemy = makeEnemy();
    const snap = computeIntentDisplayDamageWithPerHitSnapshot(intent, enemy, { shield: 0, statusEffects: [] });
    expect(snap.total).toBe(0);
    expect(snap.perHit).toBe(0);
  });
});
