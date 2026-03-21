/**
 * Unit tests for AR-59.13: v2 Enemy Roster behaviors.
 * Tests quiz-reactive enemy callbacks, Timer Wyrm enrage, and act pool selection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('shadow_mimic has no onPlayerChargeCorrect (correct plays are safe)', () => {
    const enemy = makeInstance('shadow_mimic');
    // shadow_mimic has no onPlayerChargeCorrect — correct plays trigger no mirror
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Bone Collector: onPlayerChargeWrong steals block ──

describe('bone_collector — onPlayerChargeWrong', () => {
  it('steals up to 5 block from player on wrong Charge', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(5);
    expect(enemy.currentHP).toBe(startHP + 5);
  });

  it('does not exceed maxHP when stealing block', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP - 2;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(5);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });

  it('steals less when player has less than 5 block', () => {
    const enemy = makeInstance('bone_collector');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 3, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(3);
    expect(enemy.currentHP).toBe(startHP + 3);
  });

  it('bone_collector does not have onPlayerChargeCorrect (stealing is wrong-answer only)', () => {
    const enemy = makeInstance('bone_collector');
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Fossil Guardian (was the_examiner): onPlayerNoCharge stacks +3 Strength ──

describe('fossil_guardian — onPlayerNoCharge', () => {
  it('adds +3 Strength on the first no-Charge turn', () => {
    const enemy = makeInstance('fossil_guardian');
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
    const enemy = makeInstance('fossil_guardian');
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
    const enemy = makeInstance('fossil_guardian');
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

// ── Void Mite: enemy gains block on player wrong Charge ──

describe('void_mite — onPlayerChargeWrong', () => {
  it('gains 8 block when player answers wrong on Charge', () => {
    const enemy = makeInstance('void_mite');
    enemy.block = 0;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.block).toBe(8);
  });

  it('stacks block on multiple wrong answers', () => {
    const enemy = makeInstance('void_mite');
    enemy.block = 5;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.block).toBe(13);
  });

  it('does NOT have onPlayerChargeCorrect (no punishment for correct answers)', () => {
    const enemy = makeInstance('void_mite');
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Mantle Dragon (was the_nullifier): chainMultiplierOverride = 1.0 ──

describe('mantle_dragon — chainMultiplierOverride', () => {
  it('has chainMultiplierOverride set to 1.0', () => {
    const template = getTemplate('mantle_dragon');
    expect(template.chainMultiplierOverride).toBe(1.0);
  });

  it('has no onPlayerChargeWrong/Correct callbacks (override is passive)', () => {
    const template = getTemplate('mantle_dragon');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Core Harbinger (was the_librarian): quickPlayDamageMultiplier = 0.3 ──

describe('core_harbinger — quickPlayDamageMultiplier', () => {
  it('has quickPlayDamageMultiplier set to 0.3', () => {
    const template = getTemplate('core_harbinger');
    expect(template.quickPlayDamageMultiplier).toBe(0.3);
  });

  it('has no chain or callback fields (resistance is passive)', () => {
    const template = getTemplate('core_harbinger');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.chainMultiplierOverride).toBeUndefined();
  });
});

// ── Venomfang (was timer_wyrm): enrage via onEnemyTurnStart ──

describe('venomfang — onEnemyTurnStart enrage', () => {
  it('does NOT enrage on turns 1-3', () => {
    const enemy = makeInstance('venomfang');
    const startBonus = enemy.enrageBonusDamage;
    for (let t = 1; t <= 3; t++) {
      dispatchEnemyTurnStart(enemy, t);
    }
    expect(enemy.enrageBonusDamage).toBe(startBonus);
  });

  it('adds +5 enrageBonusDamage on turn 4', () => {
    const enemy = makeInstance('venomfang');
    dispatchEnemyTurnStart(enemy, 4);
    expect(enemy.enrageBonusDamage).toBe(5);
  });

  it('stacks +5 per turn from turn 4 onwards', () => {
    const enemy = makeInstance('venomfang');
    dispatchEnemyTurnStart(enemy, 4);
    dispatchEnemyTurnStart(enemy, 5);
    dispatchEnemyTurnStart(enemy, 6);
    expect(enemy.enrageBonusDamage).toBe(15); // 3 × +5
  });

  it('createEnemy initializes enrageBonusDamage to 0', () => {
    const enemy = makeInstance('venomfang');
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
    expect(ids).not.toContain('void_mite');
  });

  it('Act 1 has elites (cave_troll)', () => {
    const enemies = getEnemiesForNode(1, 'elite');
    const ids = enemies.map(e => e.id);
    // ore_wyrm was deprecated from ACT_ENEMY_POOLS (kept in ENEMY_TEMPLATES for save compatibility)
    expect(ids).not.toContain('ore_wyrm');
    expect(ids).toContain('cave_troll');
  });

  it('Act 1 mini_boss returns venomfang', () => {
    const enemies = getEnemiesForNode(1, 'mini_boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('venomfang');
  });

  it('Act 2 elite returns current elites (magma_serpent, basalt_titan)', () => {
    const enemies = getEnemiesForNode(2, 'elite');
    const ids = enemies.map(e => e.id);
    // fossil_guardian was deprecated from ACT_ENEMY_POOLS (kept in ENEMY_TEMPLATES for save compatibility)
    expect(ids).not.toContain('fossil_guardian');
    expect(ids).toContain('magma_serpent');
    expect(ids).toContain('basalt_titan');
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

  it('Act 3 elites include mantle_dragon and core_harbinger', () => {
    const enemies = getEnemiesForNode(3, 'elite');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('mantle_dragon');
    expect(ids).toContain('core_harbinger');
  });

  it('Act 2 combat includes void_mite', () => {
    const enemies = getEnemiesForNode(2, 'combat');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('void_mite');
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
