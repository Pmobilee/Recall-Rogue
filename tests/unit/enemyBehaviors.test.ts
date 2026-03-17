/**
 * Unit tests for AR-59.13: v2 Enemy Roster behaviors.
 * Tests quiz-reactive enemy callbacks, Timer Wyrm enrage, and act pool selection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENEMY_TEMPLATES,
  ACT_ENEMY_POOLS,
  getEnemiesForNode,
  type EnemyInstance,
  type EnemyReactContext,
  type EnemyTurnStartContext,
} from '../../src/data/enemies';
import { createEnemy, dispatchEnemyTurnStart } from '../../src/services/enemyManager';

// ── Helpers ──

function getTemplate(id: string) {
  const t = ENEMY_TEMPLATES.find(e => e.id === id);
  if (!t) throw new Error(`Template not found: ${id}`);
  return t;
}

function makeInstance(id: string, floor = 1): EnemyInstance {
  return createEnemy(getTemplate(id), floor);
}

function makeCtx(enemy: EnemyInstance, overrides?: Partial<EnemyReactContext>): EnemyReactContext {
  return {
    enemy,
    cardBaseDamage: 10,
    playMode: 'charge',
    chargeCorrect: false,
    ...overrides,
  };
}

// ── Shadow Mimic: onPlayerChargeWrong sets _mirrorDamage ──

describe('shadow_mimic — onPlayerChargeWrong', () => {
  it('sets _mirrorDamage equal to cardBaseDamage on wrong Charge', () => {
    const enemy = makeInstance('shadow_mimic');
    const ctx = makeCtx(enemy, { cardBaseDamage: 15, chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(15);
  });

  it('does not trigger on correct Charge (no onPlayerChargeCorrect defined)', () => {
    const enemy = makeInstance('shadow_mimic');
    // shadow_mimic has no onPlayerChargeCorrect — correct plays are safe
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });

  it('dark_shade variant also has onPlayerChargeWrong', () => {
    const enemy = makeInstance('dark_shade');
    const ctx = makeCtx(enemy, { cardBaseDamage: 8 });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(8);
  });
});

// ── Bone Collector: onPlayerChargeWrong heals, no overheal ──

describe('bone_collector — onPlayerChargeWrong', () => {
  it('heals 5 HP on wrong Charge when below max HP', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(startHP + 5);
  });

  it('does not overheal above maxHP', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP - 2;
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });

  it('does not heal when already at full HP', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP; // full HP
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(enemy.maxHP);
  });

  it('grave_warden variant also heals on wrong Charge', () => {
    const enemy = makeInstance('grave_warden');
    enemy.currentHP = enemy.maxHP - 8;
    const start = enemy.currentHP;
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(start + 5);
  });
});

// ── The Examiner: onPlayerNoCharge stacks +3 Strength ──

describe('the_examiner — onPlayerNoCharge', () => {
  it('adds +3 Strength on the first no-Charge turn', () => {
    const enemy = makeInstance('the_examiner');
    const ctx: EnemyReactContext = {
      enemy,
      cardBaseDamage: 0,
      playMode: 'quick',
      chargeCorrect: false,
    };
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(3);
  });

  it('stacks +3 Strength on each subsequent no-Charge turn', () => {
    const enemy = makeInstance('the_examiner');
    const ctx: EnemyReactContext = {
      enemy,
      cardBaseDamage: 0,
      playMode: 'quick',
      chargeCorrect: false,
    };
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(6); // 3 + 3
  });

  it('strength stacks are encounter-permanent (turnsRemaining = 999)', () => {
    const enemy = makeInstance('the_examiner');
    const ctx: EnemyReactContext = {
      enemy,
      cardBaseDamage: 0,
      playMode: 'quick',
      chargeCorrect: false,
    };
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.turnsRemaining).toBe(999);
  });
});

// ── The Scholar: onPlayerChargeCorrect heals ──

describe('the_scholar — onPlayerChargeCorrect', () => {
  it('heals 5 HP on correct Charge', () => {
    const enemy = makeInstance('the_scholar');
    enemy.currentHP = enemy.maxHP - 10;
    const start = enemy.currentHP;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    expect(enemy.template.onPlayerChargeCorrect).toBeDefined();
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy.currentHP).toBe(start + 5);
  });

  it('does not overheal', () => {
    const enemy = makeInstance('the_scholar');
    enemy.currentHP = enemy.maxHP - 2;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });

  it('does NOT have onPlayerChargeWrong (wrong answers do not heal)', () => {
    const enemy = makeInstance('the_scholar');
    expect(enemy.template.onPlayerChargeWrong).toBeUndefined();
  });

  it('lore_keeper variant also heals on correct Charge', () => {
    const enemy = makeInstance('lore_keeper');
    enemy.currentHP = enemy.maxHP - 10;
    const start = enemy.currentHP;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy.currentHP).toBe(start + 5);
  });
});

// ── The Nullifier: chainMultiplierOverride = 1.0 ──

describe('the_nullifier — chainMultiplierOverride', () => {
  it('has chainMultiplierOverride set to 1.0', () => {
    const template = getTemplate('the_nullifier');
    expect(template.chainMultiplierOverride).toBe(1.0);
  });

  it('has no onPlayerChargeWrong/Correct callbacks (override is passive)', () => {
    const template = getTemplate('the_nullifier');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── The Librarian: quickPlayImmune = true ──

describe('the_librarian — quickPlayImmune', () => {
  it('has quickPlayImmune set to true', () => {
    const template = getTemplate('the_librarian');
    expect(template.quickPlayImmune).toBe(true);
  });

  it('has no chain or callback fields (immunity is passive)', () => {
    const template = getTemplate('the_librarian');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.chainMultiplierOverride).toBeUndefined();
  });
});

// ── Timer Wyrm: enrage via onEnemyTurnStart ──

describe('timer_wyrm — onEnemyTurnStart enrage', () => {
  it('does NOT enrage on turns 1-3', () => {
    const enemy = makeInstance('timer_wyrm');
    const startBonus = enemy.enrageBonusDamage;
    for (let t = 1; t <= 3; t++) {
      dispatchEnemyTurnStart(enemy, t);
    }
    expect(enemy.enrageBonusDamage).toBe(startBonus);
  });

  it('adds +5 enrageBonusDamage on turn 4', () => {
    const enemy = makeInstance('timer_wyrm');
    dispatchEnemyTurnStart(enemy, 4);
    expect(enemy.enrageBonusDamage).toBe(5);
  });

  it('stacks +5 per turn from turn 4 onwards', () => {
    const enemy = makeInstance('timer_wyrm');
    dispatchEnemyTurnStart(enemy, 4);
    dispatchEnemyTurnStart(enemy, 5);
    dispatchEnemyTurnStart(enemy, 6);
    expect(enemy.enrageBonusDamage).toBe(15); // 3 × +5
  });

  it('createEnemy initializes enrageBonusDamage to 0', () => {
    const enemy = makeInstance('timer_wyrm');
    expect(enemy.enrageBonusDamage).toBe(0);
  });
});

// ── Act pool selection via getEnemiesForNode ──

describe('getEnemiesForNode — act pool selection', () => {
  it('Act 1 combat returns only Act 1 commons', () => {
    const enemies = getEnemiesForNode(1, 'combat');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('cave_bat');
    expect(ids).toContain('crystal_golem');
    expect(ids).toContain('toxic_spore');
    // Must NOT contain Act 2 enemies
    expect(ids).not.toContain('shadow_mimic');
    expect(ids).not.toContain('the_scholar');
  });

  it('Act 1 has no elites', () => {
    const enemies = getEnemiesForNode(1, 'elite');
    expect(enemies).toHaveLength(0);
  });

  it('Act 1 mini_boss returns timer_wyrm', () => {
    const enemies = getEnemiesForNode(1, 'mini_boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('timer_wyrm');
  });

  it('Act 2 elite returns the_examiner', () => {
    const enemies = getEnemiesForNode(2, 'elite');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('the_examiner');
  });

  it('Act 2 boss returns the_archivist', () => {
    const enemies = getEnemiesForNode(2, 'boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('the_archivist');
  });

  it('Act 3 boss returns the_curator', () => {
    const enemies = getEnemiesForNode(3, 'boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('the_curator');
  });

  it('Act 3 elites include the_nullifier and the_librarian', () => {
    const enemies = getEnemiesForNode(3, 'elite');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('the_nullifier');
    expect(ids).toContain('the_librarian');
  });

  it('Act 3 combat includes the_scholar and lore_keeper', () => {
    const enemies = getEnemiesForNode(3, 'combat');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('the_scholar');
    expect(ids).toContain('lore_keeper');
  });

  it('invalid act returns empty array', () => {
    const enemies = getEnemiesForNode(99 as any, 'combat');
    expect(enemies).toHaveLength(0);
  });
});

// ── ACT_ENEMY_POOLS structure ──

describe('ACT_ENEMY_POOLS structure', () => {
  it('has 3 acts', () => {
    expect(ACT_ENEMY_POOLS).toHaveLength(3);
  });

  it('each act has valid pool arrays', () => {
    for (const pool of ACT_ENEMY_POOLS) {
      expect(Array.isArray(pool.commons)).toBe(true);
      expect(Array.isArray(pool.elites)).toBe(true);
      expect(Array.isArray(pool.miniBosses)).toBe(true);
      expect(Array.isArray(pool.bosses)).toBe(true);
    }
  });

  it('all enemy IDs in pools reference existing templates', () => {
    const allIds = ENEMY_TEMPLATES.map(t => t.id);
    for (const pool of ACT_ENEMY_POOLS) {
      const poolIds = [...pool.commons, ...pool.elites, ...pool.miniBosses, ...pool.bosses];
      for (const id of poolIds) {
        expect(allIds, `Template '${id}' in act ${pool.act} pool not found in ENEMY_TEMPLATES`).toContain(id);
      }
    }
  });
});

// ── playerChargedThisTurn field ──

describe('EnemyInstance.playerChargedThisTurn', () => {
  it('initializes to false via createEnemy', () => {
    const enemy = makeInstance('cave_bat');
    expect(enemy.playerChargedThisTurn).toBe(false);
  });

  it('is present on all enemy instances', () => {
    for (const template of ENEMY_TEMPLATES.slice(0, 5)) {
      const e = createEnemy(template, 1);
      expect(e.playerChargedThisTurn).toBeDefined();
    }
  });
});

// ── The Archivist and The Curator quiz phases ──

describe('boss quiz phases (quizPhases field)', () => {
  it('the_archivist has quizPhases at 50% HP', () => {
    const template = getTemplate('the_archivist');
    expect(template.quizPhases).toBeDefined();
    expect(template.quizPhases!.length).toBeGreaterThan(0);
    const phase = template.quizPhases![0];
    expect(phase.hpThreshold).toBe(0.5);
    expect(phase.questionCount).toBeGreaterThan(0);
  });

  it('the_curator has two quiz phases', () => {
    const template = getTemplate('the_curator');
    expect(template.quizPhases).toBeDefined();
    expect(template.quizPhases!.length).toBe(2);
    // Phase 1 at 66%
    expect(template.quizPhases![0].hpThreshold).toBe(0.66);
    // Phase 2 at 33%, rapid fire
    expect(template.quizPhases![1].hpThreshold).toBe(0.33);
    expect(template.quizPhases![1].rapidFire).toBe(true);
  });
});
