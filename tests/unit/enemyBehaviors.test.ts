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
import { createEnemy, dispatchEnemyTurnStart, executeEnemyIntent, applyDamageToEnemy } from '../../src/services/enemyManager';

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

describe('crib_sheet — onPlayerChargeWrong', () => {
  it('sets _mirrorDamage equal to cardBaseDamage on wrong Charge', () => {
    const enemy = makeInstance('crib_sheet');
    const ctx = makeCtx(enemy, { cardBaseDamage: 15, chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(15);
  });

  it('does not trigger on correct Charge (no onPlayerChargeCorrect defined)', () => {
    const enemy = makeInstance('crib_sheet');
    // crib_sheet has no onPlayerChargeCorrect — correct plays are safe
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });

  it('crib_sheet has no onPlayerChargeCorrect (correct plays are safe)', () => {
    const enemy = makeInstance('crib_sheet');
    // crib_sheet has no onPlayerChargeCorrect — correct plays trigger no mirror
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Bone Collector: onPlayerChargeWrong steals block ──

describe('citation_needed — onPlayerChargeWrong', () => {
  it('steals up to 5 block from player on wrong Charge', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(5);
    expect(enemy.currentHP).toBe(startHP + 5);
  });

  it('does not exceed maxHP when stealing block', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 2;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(5);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });

  it('steals less when player has less than 5 block', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const drainPlayerBlock = vi.fn();
    const ctx = makeCtx(enemy, { playerBlock: 3, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(drainPlayerBlock).toHaveBeenCalledWith(3);
    expect(enemy.currentHP).toBe(startHP + 3);
  });

  it('citation_needed does not have onPlayerChargeCorrect (stealing is wrong-answer only)', () => {
    const enemy = makeInstance('citation_needed');
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Fossil Guardian (was the_examiner): onPlayerNoCharge stacks +3 Strength ──

describe('peer_reviewer — onPlayerNoCharge', () => {
  it('adds +3 Strength on the first no-Charge turn', () => {
    const enemy = makeInstance('peer_reviewer');
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
    const enemy = makeInstance('peer_reviewer');
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
    const enemy = makeInstance('peer_reviewer');
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

describe('blank_spot — onPlayerChargeWrong', () => {
  it('gains 8 block when player answers wrong on Charge', () => {
    const enemy = makeInstance('blank_spot');
    enemy.block = 0;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.block).toBe(8);
  });

  it('stacks block on multiple wrong answers', () => {
    const enemy = makeInstance('blank_spot');
    enemy.block = 5;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.block).toBe(13);
  });

  it('does NOT have onPlayerChargeCorrect (no punishment for correct answers)', () => {
    const enemy = makeInstance('blank_spot');
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Mantle Dragon (was the_nullifier): chainMultiplierOverride = 1.0 ──

describe('dunning_kruger — chainMultiplierOverride', () => {
  it('has chainMultiplierOverride set to 1.0', () => {
    const template = getTemplate('dunning_kruger');
    expect(template.chainMultiplierOverride).toBe(1.0);
  });

  it('has no onPlayerChargeWrong/Correct callbacks (override is passive)', () => {
    const template = getTemplate('dunning_kruger');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── Core Harbinger (was the_librarian): quickPlayDamageMultiplier = 0.3 ──

describe('singularity — quickPlayDamageMultiplier', () => {
  it('has quickPlayDamageMultiplier set to 0.3', () => {
    const template = getTemplate('singularity');
    expect(template.quickPlayDamageMultiplier).toBe(0.3);
  });

  it('has no chain or callback fields (resistance is passive)', () => {
    const template = getTemplate('singularity');
    expect(template.onPlayerChargeWrong).toBeUndefined();
    expect(template.chainMultiplierOverride).toBeUndefined();
  });
});

// ── Venomfang (was timer_wyrm): enrage via onEnemyTurnStart ──

// 6.5: Plagiarist now uses Strength status effect (visible indicator) instead of enrageBonusDamage
describe('plagiarist — onEnemyTurnStart enrage', () => {
  it('does NOT gain Strength on turns 1-3', () => {
    const enemy = makeInstance('plagiarist');
    for (let t = 1; t <= 3; t++) {
      dispatchEnemyTurnStart(enemy, t, false, []);
    }
    const strength = enemy.statusEffects.find((e: { type: string }) => e.type === 'strength');
    expect(strength).toBeUndefined();
  });

  it('adds +1 Strength (9999 turns) on turn 4', () => {
    const enemy = makeInstance('plagiarist');
    dispatchEnemyTurnStart(enemy, 4, false, []);
    const strength = enemy.statusEffects.find((e: { type: string }) => e.type === 'strength');
    expect(strength).toBeDefined();
    expect(strength!.value).toBe(1);
    expect(strength!.turnsRemaining).toBe(9999);
  });

  it('stacks +1 Strength per turn from turn 4 onwards', () => {
    const enemy = makeInstance('plagiarist');
    dispatchEnemyTurnStart(enemy, 4, false, []);
    dispatchEnemyTurnStart(enemy, 5, false, []);
    dispatchEnemyTurnStart(enemy, 6, false, []);
    const strength = enemy.statusEffects.find((e: { type: string }) => e.type === 'strength');
    expect(strength).toBeDefined();
    expect(strength!.value).toBe(3); // stacks additively
  });

  it('createEnemy initializes enrageBonusDamage to 0 (still used by other enemies)', () => {
    const enemy = makeInstance('plagiarist');
    expect(enemy.enrageBonusDamage).toBe(0);
  });
});

// ── Act pool selection via getEnemiesForNode ──

describe('getEnemiesForNode — act pool selection', () => {
  it('Act 1 combat returns only Act 1 commons', () => {
    const enemies = getEnemiesForNode(1, 'combat');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('page_flutter');
    expect(ids).toContain('thesis_construct');
    expect(ids).toContain('mold_puff');
    // Must NOT contain Act 2 enemies
    expect(ids).not.toContain('crib_sheet');
    expect(ids).not.toContain('blank_spot');
  });

  it('Act 1 has elites (librarian)', () => {
    const enemies = getEnemiesForNode(1, 'elite');
    const ids = enemies.map(e => e.id);
    // bookwyrm was deprecated from ACT_ENEMY_POOLS (kept in ENEMY_TEMPLATES for save compatibility)
    expect(ids).not.toContain('bookwyrm');
    expect(ids).toContain('librarian');
  });

  it('Act 1 mini_boss returns plagiarist', () => {
    const enemies = getEnemiesForNode(1, 'mini_boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('plagiarist');
  });

  it('Act 2 elite returns current elites (deadline_serpent, standardized_test)', () => {
    const enemies = getEnemiesForNode(2, 'elite');
    const ids = enemies.map(e => e.id);
    // peer_reviewer was deprecated from ACT_ENEMY_POOLS (kept in ENEMY_TEMPLATES for save compatibility)
    expect(ids).not.toContain('peer_reviewer');
    expect(ids).toContain('deadline_serpent');
    expect(ids).toContain('standardized_test');
  });

  it('Act 2 boss returns algorithm', () => {
    const enemies = getEnemiesForNode(2, 'boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('algorithm');
  });

  it('Act 3 boss returns final_lesson', () => {
    const enemies = getEnemiesForNode(3, 'boss');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('final_lesson');
  });

  it('Act 3 elites include dunning_kruger and singularity', () => {
    const enemies = getEnemiesForNode(3, 'elite');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('dunning_kruger');
    expect(ids).toContain('singularity');
  });

  it('Act 2 combat includes blank_spot', () => {
    const enemies = getEnemiesForNode(2, 'combat');
    const ids = enemies.map(e => e.id);
    expect(ids).toContain('blank_spot');
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
    const enemy = makeInstance('page_flutter');
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
  it('algorithm has quizPhases at 50% HP', () => {
    const template = getTemplate('algorithm');
    expect(template.quizPhases).toBeDefined();
    expect(template.quizPhases!.length).toBeGreaterThan(0);
    const phase = template.quizPhases![0];
    expect(phase.hpThreshold).toBe(0.5);
    expect(phase.questionCount).toBeGreaterThan(0);
  });

  it('final_lesson has two quiz phases', () => {
    const template = getTemplate('final_lesson');
    expect(template.quizPhases).toBeDefined();
    expect(template.quizPhases!.length).toBe(2);
    // Phase 1 at 66%
    expect(template.quizPhases![0].hpThreshold).toBe(0.66);
    // Phase 2 at 33%, rapid fire
    expect(template.quizPhases![1].hpThreshold).toBe(0.33);
    expect(template.quizPhases![1].rapidFire).toBe(true);
  });
});

// ── AR-263: Pop Quiz — stun on correct Charge, enrage on no-Charge ──

describe('pop_quiz — AR-263 quiz-reactive hooks', () => {
  it('sets _stunNextTurn = true on correct Charge', () => {
    const enemy = makeInstance('pop_quiz');
    expect(enemy.template.onPlayerChargeCorrect).toBeDefined();
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._stunNextTurn).toBe(true);
  });

  it('adds +1 enrageBonusDamage on no-Charge turn', () => {
    const enemy = makeInstance('pop_quiz');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    const ctx = makeCtx(enemy, { playMode: 'quick', chargeCorrect: false });
    enemy.template.onPlayerNoCharge!(ctx);
    expect(enemy.enrageBonusDamage).toBe(1);
  });

  it('stacks enrageBonusDamage across multiple no-Charge turns', () => {
    const enemy = makeInstance('pop_quiz');
    const ctx = makeCtx(enemy, { playMode: 'quick', chargeCorrect: false });
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    expect(enemy.enrageBonusDamage).toBe(3);
  });

  it('executeEnemyIntent returns stunned=true and skips action when _stunNextTurn is set', () => {
    const enemy = makeInstance('pop_quiz');
    enemy._stunNextTurn = true;
    const result = executeEnemyIntent(enemy);
    expect(result.stunned).toBe(true);
    expect(result.damage).toBe(0);
    expect(result.playerEffects).toHaveLength(0);
  });

  it('clears _stunNextTurn after stun fires', () => {
    const enemy = makeInstance('pop_quiz');
    enemy._stunNextTurn = true;
    executeEnemyIntent(enemy);
    expect(enemy._stunNextTurn).toBe(false);
  });

  it('executeEnemyIntent returns stunned=false when _stunNextTurn is not set', () => {
    const enemy = makeInstance('pop_quiz');
    enemy._stunNextTurn = false;
    const result = executeEnemyIntent(enemy);
    expect(result.stunned).toBe(false);
  });
});

// ── AR-263: Trick Question — heals 8 HP on wrong Charge ──

describe('trick_question — AR-263 quiz-reactive hook', () => {
  it('heals 8 HP on wrong Charge', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = 10;
    const maxHP = enemy.maxHP;
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(Math.min(maxHP, 18));
  });

  it('does not exceed maxHP when healing', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 2;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });

  it('heals to full when near-full HP', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 1;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(enemy.maxHP);
  });
});

// ── AR-263: The Curriculum — phase 2 at 50% HP with QP block + strength bonus ──

describe('curriculum — AR-263 phase 2 transition', () => {
  it('has phaseTransitionAt = 0.5', () => {
    const template = getTemplate('curriculum');
    expect(template.phaseTransitionAt).toBe(0.5);
  });

  it('has phase2IntentPool defined', () => {
    const template = getTemplate('curriculum');
    expect(template.phase2IntentPool).toBeDefined();
    expect(template.phase2IntentPool!.length).toBeGreaterThan(0);
  });

  it('onPhaseTransition sets _quickPlayDamageMultiplierOverride = 0 and +2 enrageBonusDamage', () => {
    const enemy = makeInstance('curriculum');
    expect(enemy.template.onPhaseTransition).toBeDefined();
    enemy.template.onPhaseTransition!(enemy);
    expect(enemy._quickPlayDamageMultiplierOverride).toBe(0.0);
    expect(enemy.enrageBonusDamage).toBe(2);
  });

  it('applyDamageToEnemy triggers phase transition and calls onPhaseTransition at 50% HP', () => {
    const enemy = makeInstance('curriculum', 1);
    // Deal damage to drop below 50%
    const damageToTransition = Math.ceil(enemy.maxHP * 0.51);
    applyDamageToEnemy(enemy, damageToTransition);
    expect(enemy.phase).toBe(2);
    expect(enemy._quickPlayDamageMultiplierOverride).toBe(0.0);
    expect(enemy.enrageBonusDamage).toBe(2);
  });

  it('phase 1 does not set _quickPlayDamageMultiplierOverride', () => {
    const enemy = makeInstance('curriculum', 1);
    // Deal less than 50% damage — stays in phase 1
    const damageBelow50 = Math.floor(enemy.maxHP * 0.3);
    applyDamageToEnemy(enemy, damageBelow50);
    expect(enemy.phase).toBe(1);
    expect(enemy._quickPlayDamageMultiplierOverride).toBeUndefined();
  });
});

// ── AR-263: The Textbook — hardcover armor mechanic ──

describe('textbook — AR-263 hardcover armor', () => {
  it('initializes _hardcover = 16 at creation', () => {
    const enemy = makeInstance('textbook');
    expect(enemy._hardcover).toBe(16);
  });

  it('reduces _hardcover by 4 on correct Charge', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 16;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    expect(enemy.template.onPlayerChargeCorrect).toBeDefined();
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._hardcover).toBe(12);
  });

  it('increases _hardcover by 2 on wrong Charge (max 16)', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 10;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._hardcover).toBe(12);
  });

  it('caps _hardcover at 16 on wrong Charge', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 15;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._hardcover).toBe(16);
  });

  it('does not go below 0 on correct Charge', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 2;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._hardcover).toBe(0);
    expect(enemy._hardcoverBroken).toBe(true);
  });

  it('applies Vulnerable 2 turns when hardcover hits 0', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 4; // one correct Charge will break it
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._hardcoverBroken).toBe(true);
    const vulnEffect = enemy.statusEffects.find(e => e.type === 'vulnerable');
    expect(vulnEffect).toBeDefined();
    expect(vulnEffect!.turnsRemaining).toBe(2);
  });

  it('does not modify _hardcover after it is broken (correct Charge)', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 0;
    enemy._hardcoverBroken = true;
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._hardcover).toBe(0);
  });

  it('does not restore _hardcover after it is broken (wrong Charge)', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 0;
    enemy._hardcoverBroken = true;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._hardcover).toBe(0);
  });

  it('4 correct Charges reduce hardcover from 16 to 0 and break it', () => {
    const enemy = makeInstance('textbook');
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    for (let i = 0; i < 4; i++) {
      enemy.template.onPlayerChargeCorrect!(ctx);
    }
    expect(enemy._hardcover).toBe(0);
    expect(enemy._hardcoverBroken).toBe(true);
  });
});

// ── Brain Fog: onEnemyTurnStart mastery erosion ──

describe('brain_fog — onEnemyTurnStart mastery erosion', () => {
  it('erodes a card from mastery 3 to 2 when player charged nothing last turn', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'card_a', masteryLevel: 3 }];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(2);
  });

  it('does not erode when player made at least 1 correct Charge last turn', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'card_a', masteryLevel: 3 }];
    dispatchEnemyTurnStart(enemy, 1, true, hand);
    expect(hand[0].masteryLevel).toBe(3);
  });

  it('does not erode when no cards have masteryLevel >= 2', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [
      { id: 'card_a', masteryLevel: 0 },
      { id: 'card_b', masteryLevel: 1 },
      { id: 'card_c' }, // undefined = 0
    ];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(0);
    expect(hand[1].masteryLevel).toBe(1);
    expect(hand[2].masteryLevel).toBeUndefined();
  });

  it('does not throw when player hand is empty and no charges were made', () => {
    const enemy = makeInstance('brain_fog');
    expect(() => dispatchEnemyTurnStart(enemy, 1, false, [])).not.toThrow();
  });

  it('picks from multiple eligible cards without error', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [
      { id: 'card_a', masteryLevel: 2 },
      { id: 'card_b', masteryLevel: 4 },
    ];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    // Exactly one card should have been decremented
    const decremented = hand.filter(c => c.masteryLevel === 1 || c.masteryLevel === 3);
    expect(decremented).toHaveLength(1);
  });

  it('has onEnemyTurnStart defined', () => {
    const template = ENEMY_TEMPLATES.find(e => e.id === 'brain_fog');
    expect(template?.onEnemyTurnStart).toBeDefined();
  });
});

// ── AR-268: Trick Question — wrong Charge heals + stores lockedFactId ──

describe('trick_question — onPlayerChargeWrong', () => {
  it('heals enemy 8 HP on wrong Charge', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(startHP + 8);
  });

  it('does not overheal past maxHP', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 3;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy, { chargeCorrect: false }));
    expect(enemy.currentHP).toBe(enemy.maxHP);
  });

  it('stores _lockedFactId on enemy when _failedFactId is provided', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    (ctx as any)._failedFactId = 'fact_abc';
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockedFactId).toBe('fact_abc');
  });

  it('sets _lockTurnsRemaining to 2 when lock is applied', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    (ctx as any)._failedFactId = 'fact_xyz';
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockTurnsRemaining).toBe(2);
  });

  it('does not set _lockedFactId when _failedFactId is missing', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    // no _failedFactId set
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockedFactId).toBeUndefined();
  });

  it('has no onPlayerChargeCorrect (correct plays are safe)', () => {
    const enemy = makeInstance('trick_question');
    expect(enemy.template.onPlayerChargeCorrect).toBeUndefined();
  });
});
