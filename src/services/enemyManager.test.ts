import { describe, it, expect, beforeEach } from 'vitest';
import { createEnemy, rollNextIntent, executeEnemyIntent } from './enemyManager';
import { initRunRng, destroyRunRng } from './seededRng';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { getStrengthModifier } from '../data/statusEffects';
import type { EnemyTemplate, EnemyInstance, EnemyIntent } from '../data/enemies';

const MARGIN_GREMLIN_TEMPLATE = ENEMY_TEMPLATES.find(t => t.id === 'margin_gremlin')!;

describe('enemy intent RNG determinism', () => {
  beforeEach(() => {
    destroyRunRng();
  });

  it('two enemies with the same seed roll identical intent sequences', () => {
    initRunRng(12345);
    const enemy1 = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seq1 = [{ type: enemy1.nextIntent.type, value: enemy1.nextIntent.value }];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemy1);
      seq1.push({ type: enemy1.nextIntent.type, value: enemy1.nextIntent.value });
    }

    initRunRng(12345);
    const enemy2 = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seq2 = [{ type: enemy2.nextIntent.type, value: enemy2.nextIntent.value }];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemy2);
      seq2.push({ type: enemy2.nextIntent.type, value: enemy2.nextIntent.value });
    }

    expect(seq1.map(i => i.type)).toEqual(seq2.map(i => i.type));
    expect(seq1.map(i => i.value)).toEqual(seq2.map(i => i.value));
  });

  it('different seeds produce different intent sequences', () => {
    initRunRng(12345);
    const enemyA = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seqA: string[] = [];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemyA);
      seqA.push(enemyA.nextIntent.type);
    }

    initRunRng(99999);
    const enemyB = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seqB: string[] = [];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemyB);
      seqB.push(enemyB.nextIntent.type);
    }

    // Sequences from different seeds should differ at least once in 10 rolls
    // (statistical near-certainty; if they're identical, the RNG is constant)
    const allSame = seqA.every((v, i) => v === seqB[i]);
    expect(allSame).toBe(false);
  });

  it('without an active run RNG, falls back to Math.random without throwing', () => {
    // No initRunRng() call — should not throw
    expect(() => {
      const enemy = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
      rollNextIntent(enemy);
    }).not.toThrow();
  });
});

// ── Anti-stall intent filtering ───────────────────────────────────────────────
// Verifies the rule: defend cannot follow defend, buff, or debuff.

/** Minimal EnemyTemplate factory for test-only use. */
function makeTestTemplate(pool: EnemyIntent[]): EnemyTemplate {
  return {
    id: 'test_enemy',
    name: 'Test Enemy',
    description: 'Unit-test only enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 5,
    intentPool: pool,
    animArchetype: 'crawler',
  } as EnemyTemplate;
}

/** Minimal EnemyInstance factory for test-only use — sets a specific prevIntent. */
function makeTestEnemy(pool: EnemyIntent[], prevIntentType: EnemyIntent['type']): EnemyInstance {
  const template = makeTestTemplate(pool);
  const enemy = createEnemy(template, 1);
  // Override nextIntent to simulate the intent that was just executed
  enemy.nextIntent = { type: prevIntentType, value: 5, weight: 1, telegraph: 'test' };
  return enemy;
}

describe('rollNextIntent — anti-stall defend filtering', () => {
  beforeEach(() => {
    destroyRunRng();
  });

  const mixedPool: EnemyIntent[] = [
    { type: 'attack', value: 5, weight: 1, telegraph: 'Attacking!' },
    { type: 'defend', value: 5, weight: 1, telegraph: 'Defending!' },
  ];

  it('defend is never selected after a defend intent (100-roll statistical test)', () => {
    const enemy = makeTestEnemy(mixedPool, 'defend');

    for (let i = 0; i < 100; i++) {
      rollNextIntent(enemy);
      expect(enemy.nextIntent.type).not.toBe('defend');
      // Reset to defend to keep the previous-intent condition active each roll
      enemy.nextIntent = { type: 'defend', value: 5, weight: 1, telegraph: 'test' };
    }
  });

  it('defend is never selected after a buff intent (100-roll statistical test)', () => {
    const enemy = makeTestEnemy(mixedPool, 'buff');

    for (let i = 0; i < 100; i++) {
      rollNextIntent(enemy);
      expect(enemy.nextIntent.type).not.toBe('defend');
      // Reset to buff to keep the previous-intent condition active each roll
      enemy.nextIntent = { type: 'buff', value: 0, weight: 1, telegraph: 'test' };
    }
  });

  it('defend is never selected after a debuff intent (100-roll statistical test)', () => {
    const enemy = makeTestEnemy(mixedPool, 'debuff');

    for (let i = 0; i < 100; i++) {
      rollNextIntent(enemy);
      expect(enemy.nextIntent.type).not.toBe('defend');
      // Reset to debuff to keep the previous-intent condition active each roll
      enemy.nextIntent = { type: 'debuff', value: 0, weight: 1, telegraph: 'test' };
    }
  });

  it('defend IS selectable after an attack intent', () => {
    const enemy = makeTestEnemy(mixedPool, 'attack');

    let sawDefend = false;
    for (let i = 0; i < 200; i++) {
      rollNextIntent(enemy);
      if (enemy.nextIntent.type === 'defend') {
        sawDefend = true;
        break;
      }
      // Keep previous-intent as attack so the filter never activates
      enemy.nextIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'test' };
    }

    // With 50% weight each and 200 rolls, the probability of never seeing defend
    // is (0.5)^200 — effectively impossible.
    expect(sawDefend).toBe(true);
  });

  it('edge case: pool with ONLY defend intents falls back to full pool (no deadlock)', () => {
    const defendOnlyPool: EnemyIntent[] = [
      { type: 'defend', value: 5, weight: 1, telegraph: 'Defending!' },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Defending more!' },
    ];
    const enemy = makeTestEnemy(defendOnlyPool, 'defend');

    // Should not throw and should return a defend intent (fallback to full pool)
    expect(() => rollNextIntent(enemy)).not.toThrow();
    expect(enemy.nextIntent.type).toBe('defend');
  });
});

// ── Buff combo follow-up ──────────────────────────────────────────────────────
// Verifies that rollNextIntent sets buffFollowUpIntent when rolling a buff,
// and that executeEnemyIntent correctly applies the buff then returns 0 damage
// (so the caller can separately execute the follow-up).

describe('rollNextIntent — buff follow-up intent', () => {
  beforeEach(() => {
    destroyRunRng();
  });

  it('sets buffFollowUpIntent (attack) when rolling a buff intent from a pool with attacks', () => {
    const buffOnlyPool: EnemyIntent[] = [
      { type: 'attack', value: 5, weight: 0, telegraph: 'Attacking!' },
      { type: 'buff', value: 0, weight: 1, telegraph: 'Buffing!', statusEffect: { type: 'strength', value: 1, turns: 0 } },
    ];
    const template = makeTestTemplate(buffOnlyPool);
    const enemy = createEnemy(template, 1);
    // Simulate prev intent as attack so buff is eligible
    enemy.nextIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'prev' };

    rollNextIntent(enemy);

    expect(enemy.nextIntent.type).toBe('buff');
    expect(enemy.buffFollowUpIntent).toBeDefined();
    expect(enemy.buffFollowUpIntent!.type).toMatch(/^(attack|multi_attack)$/);
  });

  it('clears buffFollowUpIntent when rolling a non-buff intent', () => {
    const attackOnlyPool: EnemyIntent[] = [
      { type: 'attack', value: 5, weight: 1, telegraph: 'Attacking!' },
    ];
    const template = makeTestTemplate(attackOnlyPool);
    const enemy = createEnemy(template, 1);
    // Pre-set a stale follow-up to confirm it gets cleared
    enemy.buffFollowUpIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'stale' };
    enemy.nextIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'prev' };

    rollNextIntent(enemy);

    expect(enemy.nextIntent.type).toBe('attack');
    expect(enemy.buffFollowUpIntent).toBeUndefined();
  });

  it('buffFollowUpIntent is undefined when pool has no attacks or multi_attacks', () => {
    const buffDebuffPool: EnemyIntent[] = [
      { type: 'buff', value: 0, weight: 1, telegraph: 'Buffing!', statusEffect: { type: 'strength', value: 1, turns: 0 } },
      { type: 'defend', value: 5, weight: 0, telegraph: 'Defending!' },
    ];
    const template = makeTestTemplate(buffDebuffPool);
    const enemy = createEnemy(template, 1);
    // prev=attack so buff isn't excluded by anti-stall
    enemy.nextIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'prev' };

    rollNextIntent(enemy);

    expect(enemy.nextIntent.type).toBe('buff');
    expect(enemy.buffFollowUpIntent).toBeUndefined();
  });

  it('buff intent applies strength to enemy status effects before follow-up fires', () => {
    const buffOnlyPool: EnemyIntent[] = [
      { type: 'attack', value: 5, weight: 0, telegraph: 'Attacking!' },
      { type: 'buff', value: 0, weight: 1, telegraph: 'Buffing!', statusEffect: { type: 'strength', value: 2, turns: 0 } },
    ];
    const template = makeTestTemplate(buffOnlyPool);
    const enemy = createEnemy(template, 1);
    enemy.nextIntent = { type: 'attack', value: 5, weight: 1, telegraph: 'prev' };

    rollNextIntent(enemy);

    expect(enemy.nextIntent.type).toBe('buff');
    expect(enemy.buffFollowUpIntent).toBeDefined();

    // Execute the buff — applies +2 strength
    const buffResult = executeEnemyIntent(enemy);
    // Buff itself deals 0 damage
    expect(buffResult.damage).toBe(0);

    // After executing buff, strength is live on enemy
    const strengthMod = getStrengthModifier(enemy.statusEffects);
    // +2 strength → modifier is 1 + 0.2 = 1.2 (or similar depending on implementation)
    expect(strengthMod).toBeGreaterThan(1.0);
  });
});

// ── Tests: executeEnemyIntent multi_attack per-hit cap ───────────────────────

describe('executeEnemyIntent — multi_attack per-hit cap', () => {
  it('multi_attack with no cap: total = perHit * hits (uncapped)', () => {
    const template: EnemyTemplate = {
      id: 'test_multi',
      name: 'Test Multi',
      category: 'common',
      region: 'shallow_depths',
      baseHP: 20,
      description: 'test',
      intentPool: [
        { type: 'multi_attack', value: 5, weight: 1, telegraph: 'Multi', hitCount: 3 },
      ],
    };
    const enemy = createEnemy(template, 1);
    enemy.nextIntent = template.intentPool[0];
    // floor 1 = FLOOR_DAMAGE_SCALE_MID (1.0), GLOBAL_ENEMY_DAMAGE_MULTIPLIER = real value
    // We just verify total = perHit * 3 (internal structure)
    const result = executeEnemyIntent(enemy);
    // With cap = null for segment 1 (floor 1): total = round(5 * 1.0 * 1.0 * multiplier) * 3
    expect(result.damage % 3).toBe(0); // total must be divisible by hits (per-hit × hits)
  });
});
