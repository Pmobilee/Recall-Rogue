/**
 * Tests for applyEnemyDeltaToState — the pure merge function used by the
 * coop host to reconcile per-player damage deltas into an authoritative
 * enemy snapshot at end-of-turn.
 *
 * Covers:
 *   - Basic damage accumulation
 *   - Block absorption before HP damage
 *   - HP clamping at 0
 *   - Phase transition detection
 *   - Delta order independence (deterministic sort by playerId)
 */

import { describe, it, expect } from 'vitest';
import { applyEnemyDeltaToState } from '../../src/services/enemyManager';
import type { SharedEnemySnapshot } from '../../src/data/multiplayerTypes';
import type { EnemyTurnDelta } from '../../src/data/multiplayerTypes';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<SharedEnemySnapshot> = {}): SharedEnemySnapshot {
  return {
    currentHP: 100,
    maxHP: 100,
    block: 0,
    phase: 1,
    nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Attacks!' },
    statusEffects: [],
    ...overrides,
  };
}

function makeDelta(overrides: Partial<EnemyTurnDelta> = {}): EnemyTurnDelta {
  return {
    playerId: 'player1',
    damageDealt: 0,
    blockDealt: 0,
    statusEffectsAdded: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyEnemyDeltaToState', () => {
  it('two players dealing damage: HP reduces by sum', () => {
    const snap = makeSnapshot({ currentHP: 100 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 10 }),
      makeDelta({ playerId: 'p2', damageDealt: 8 }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    expect(result.currentHP).toBe(82);
    expect(result.maxHP).toBe(100);
  });

  it('block stripped first, remainder damages HP', () => {
    // Enemy has 5 block, player 1 dealt 8 damage + 5 blockDealt
    // In client-side optimistic computation:
    //   block absorbed up to 8 → block = 0, but then 8 damage to HP
    // The delta stores damageDealt = 8 (after block was consumed locally)
    // and blockDealt = 5 (how much block was stripped)
    // Host merge: strip block=5 from snap.block=5 → block=0, then apply 8 damage to HP 100 → 92
    const snap = makeSnapshot({ currentHP: 100, block: 5 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 8, blockDealt: 5 }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    // block stripped to 0, full 8 damage applied to HP
    expect(result.block).toBe(0);
    expect(result.currentHP).toBe(92);
  });

  it('overkill damage clamps HP to 0', () => {
    const snap = makeSnapshot({ currentHP: 5 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 20 }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    expect(result.currentHP).toBe(0);
  });

  it('zero damage delta leaves HP unchanged', () => {
    const snap = makeSnapshot({ currentHP: 80 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 0 }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    expect(result.currentHP).toBe(80);
  });

  it('phase transition: HP drops below threshold → phase becomes 2', () => {
    // maxHP=100, threshold=0.5 → triggers when HP ≤ 50
    const snap = makeSnapshot({ currentHP: 60, maxHP: 100, phase: 1 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 15 }),
    ];
    // HP = 60 - 15 = 45, which is 45/100 = 0.45 ≤ 0.5 → phase 2
    const result = applyEnemyDeltaToState(snap, deltas, 0.5);
    expect(result.currentHP).toBe(45);
    expect(result.phase).toBe(2);
  });

  it('phase transition: HP does not drop below threshold → phase stays 1', () => {
    const snap = makeSnapshot({ currentHP: 60, maxHP: 100, phase: 1 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 5 }),
    ];
    // HP = 55, which is 0.55 > 0.5 → no transition
    const result = applyEnemyDeltaToState(snap, deltas, 0.5);
    expect(result.currentHP).toBe(55);
    expect(result.phase).toBe(1);
  });

  it('already phase 2: phase does not regress', () => {
    const snap = makeSnapshot({ currentHP: 40, maxHP: 100, phase: 2 });
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', damageDealt: 10 }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas, 0.5);
    expect(result.phase).toBe(2);
  });

  it('order independence: [d1, d2] produces same HP as [d2, d1]', () => {
    const snap = makeSnapshot({ currentHP: 100 });
    const d1 = makeDelta({ playerId: 'aaa', damageDealt: 10 });
    const d2 = makeDelta({ playerId: 'zzz', damageDealt: 8 });

    const result1 = applyEnemyDeltaToState(snap, [d1, d2]);
    const result2 = applyEnemyDeltaToState(snap, [d2, d1]);

    expect(result1.currentHP).toBe(result2.currentHP);
    expect(result1.block).toBe(result2.block);
  });

  it('status effects from deltas are merged into the snapshot', () => {
    const snap = makeSnapshot();
    const deltas: EnemyTurnDelta[] = [
      makeDelta({
        playerId: 'p1',
        statusEffectsAdded: [{ type: 'poison', value: 3, turnsRemaining: 3 }],
      }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    expect(result.statusEffects).toHaveLength(1);
    expect(result.statusEffects[0].type).toBe('poison');
    expect(result.statusEffects[0].value).toBe(3);
  });

  it('same status type from two players: magnitudes sum', () => {
    const snap = makeSnapshot();
    const deltas: EnemyTurnDelta[] = [
      makeDelta({ playerId: 'p1', statusEffectsAdded: [{ type: 'poison', value: 3, turnsRemaining: 3 }] }),
      makeDelta({ playerId: 'p2', statusEffectsAdded: [{ type: 'poison', value: 2, turnsRemaining: 2 }] }),
    ];
    const result = applyEnemyDeltaToState(snap, deltas);
    const poison = result.statusEffects.find(s => s.type === 'poison');
    expect(poison).toBeDefined();
    expect(poison!.value).toBe(5);
    // turnsRemaining = max(3, 2) = 3
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('empty deltas array: snapshot returned unchanged', () => {
    const snap = makeSnapshot({ currentHP: 75, block: 10 });
    const result = applyEnemyDeltaToState(snap, []);
    expect(result.currentHP).toBe(75);
    expect(result.block).toBe(10);
    expect(result.phase).toBe(1);
  });

  it('snapshot is not mutated — returns new object', () => {
    const snap = makeSnapshot({ currentHP: 100 });
    const deltas = [makeDelta({ playerId: 'p1', damageDealt: 10 })];
    const result = applyEnemyDeltaToState(snap, deltas);
    expect(snap.currentHP).toBe(100); // original untouched
    expect(result.currentHP).toBe(90);
  });

  it('maxHP is preserved in result', () => {
    const snap = makeSnapshot({ currentHP: 80, maxHP: 150 });
    const result = applyEnemyDeltaToState(snap, []);
    expect(result.maxHP).toBe(150);
  });
});
