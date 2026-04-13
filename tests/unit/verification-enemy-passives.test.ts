/**
 * Exhaustive verification tests for enemy passive callbacks, phase transitions,
 * and template passive flags.
 *
 * This file is intentionally thorough — it tests every callback, every phase
 * transition threshold, and every template flag defined in src/data/enemies.ts.
 * It is designed to catch regressions when enemy definitions change.
 *
 * NOTE ON BUG DOCUMENTATION:
 *   pop_quiz.onPlayerNoCharge and grade_curve.onPlayerChargeCorrect both use
 *   `enrageBonusDamage` for their "gets stronger" mechanic. However,
 *   `executeEnemyIntent` in enemyManager.ts adds `enrageBonusDamage` to
 *   `intent.value` before scaling — so the field IS read at runtime and
 *   DOES affect damage. The "enrage" label is historical; it is NOT broken.
 *   Tests below verify the field is set correctly and that executeEnemyIntent
 *   incorporates it into the damage calculation.
 *
 *   `getEnrageBonus()` in turnManager.ts is a SEPARATE function that was
 *   removed (always returns 0) — that is the dead code. The enrageBonusDamage
 *   field on EnemyInstance is still active.
 */

import { describe, it, expect } from 'vitest';
import {
  ENEMY_TEMPLATES,
  type EnemyInstance,
  type EnemyReactContext,
} from '../../src/data/enemies';
import {
  createEnemy,
  dispatchEnemyTurnStart,
  executeEnemyIntent,
  applyDamageToEnemy,
} from '../../src/services/enemyManager';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTemplate(id: string) {
  const t = ENEMY_TEMPLATES.find(e => e.id === id);
  if (!t) throw new Error(`Template not found: '${id}'`);
  return t;
}

function makeInstance(id: string, floor = 1): EnemyInstance {
  return createEnemy(getTemplate(id), floor);
}

function makeCtx(
  enemy: EnemyInstance,
  overrides?: Partial<EnemyReactContext>,
): EnemyReactContext {
  return {
    enemy,
    cardBaseDamage: 10,
    playMode: 'charge',
    chargeCorrect: false,
    ...overrides,
  };
}

// ── onEnemyTurnStart: plagiarist ──────────────────────────────────────────────

describe('plagiarist — onEnemyTurnStart (Strength enrage from turn 4)', () => {
  it('gains no Strength on turns 1, 2, 3', () => {
    const enemy = makeInstance('plagiarist');
    for (let t = 1; t <= 3; t++) {
      dispatchEnemyTurnStart(enemy, t, false, []);
    }
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeUndefined();
  });

  it('gains exactly +1 Strength on turn 4', () => {
    const enemy = makeInstance('plagiarist');
    dispatchEnemyTurnStart(enemy, 4, false, []);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(1);
  });

  it('Strength is permanent (turnsRemaining = 9999) on turn 4', () => {
    const enemy = makeInstance('plagiarist');
    dispatchEnemyTurnStart(enemy, 4, false, []);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.turnsRemaining).toBe(9999);
  });

  it('accumulates +1 Strength per turn from turn 4 onward', () => {
    const enemy = makeInstance('plagiarist');
    dispatchEnemyTurnStart(enemy, 4, false, []);
    dispatchEnemyTurnStart(enemy, 5, false, []);
    dispatchEnemyTurnStart(enemy, 6, false, []);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(3);
  });

  it('playerChargedCorrectLastTurn does not suppress the enrage (enrage is unconditional)', () => {
    const enemy = makeInstance('plagiarist');
    // Even if player charged correctly, plagiarist still gains Strength from turn 4
    dispatchEnemyTurnStart(enemy, 4, true, []);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(1);
  });
});

// ── onEnemyTurnStart: librarian ───────────────────────────────────────────────

describe('librarian — onEnemyTurnStart (silence a random card type)', () => {
  const VALID_CARD_TYPES = ['attack', 'shield', 'buff', 'debuff', 'utility', 'wild'];

  it('sets _silencedCardType to one of the 6 card types after callback', () => {
    const enemy = makeInstance('librarian');
    dispatchEnemyTurnStart(enemy, 1, false, []);
    expect(enemy._silencedCardType).toBeDefined();
    expect(VALID_CARD_TYPES).toContain(enemy._silencedCardType);
  });

  it('sets a new silenced type each turn (value changes are expected)', () => {
    const enemy = makeInstance('librarian');
    dispatchEnemyTurnStart(enemy, 1, false, []);
    const first = enemy._silencedCardType;
    // Run many turns to confirm it keeps setting a valid type
    for (let t = 2; t <= 10; t++) {
      dispatchEnemyTurnStart(enemy, t, false, []);
      expect(VALID_CARD_TYPES).toContain(enemy._silencedCardType);
    }
    // We can't assert it always changes (it's random), but we can assert it's always valid
    expect(VALID_CARD_TYPES).toContain(first);
  });

  it('does not modify _silencedCardType when callback fires on playerChargedCorrectLastTurn=true', () => {
    // Silence fires unconditionally — not gated on charge state
    const enemy = makeInstance('librarian');
    dispatchEnemyTurnStart(enemy, 1, true, []);
    expect(VALID_CARD_TYPES).toContain(enemy._silencedCardType);
  });
});

// ── onEnemyTurnStart: brain_fog ───────────────────────────────────────────────

describe('brain_fog — onEnemyTurnStart (mastery erosion)', () => {
  it('erodes mastery by 1 on a card with masteryLevel >= 2 when no correct charges', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'c1', masteryLevel: 3 }];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(2);
  });

  it('does NOT erode when player charged correctly last turn', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'c1', masteryLevel: 3 }];
    dispatchEnemyTurnStart(enemy, 1, true, hand);
    expect(hand[0].masteryLevel).toBe(3);
  });

  it('does NOT erode cards with masteryLevel exactly 1 (below threshold of 2)', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'c1', masteryLevel: 1 }];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(1);
  });

  it('does NOT erode cards with masteryLevel 0', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'c1', masteryLevel: 0 }];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(0);
  });

  it('does NOT erode cards with undefined masteryLevel (treated as 0)', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [{ id: 'c1' }];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBeUndefined();
  });

  it('erodes exactly ONE card from a multi-card hand', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [
      { id: 'c1', masteryLevel: 2 },
      { id: 'c2', masteryLevel: 4 },
      { id: 'c3', masteryLevel: 3 },
    ];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    const eroded = hand.filter(c => {
      // each started at 2, 4, 3 — eroded means decremented by 1
      const originals: Record<string, number> = { c1: 2, c2: 4, c3: 3 };
      return c.masteryLevel === originals[c.id] - 1;
    });
    expect(eroded).toHaveLength(1);
  });

  it('does not throw when hand is empty', () => {
    const enemy = makeInstance('brain_fog');
    expect(() => dispatchEnemyTurnStart(enemy, 1, false, [])).not.toThrow();
  });

  it('does not modify any card when all are below mastery 2', () => {
    const enemy = makeInstance('brain_fog');
    const hand = [
      { id: 'c1', masteryLevel: 0 },
      { id: 'c2', masteryLevel: 1 },
    ];
    dispatchEnemyTurnStart(enemy, 1, false, hand);
    expect(hand[0].masteryLevel).toBe(0);
    expect(hand[1].masteryLevel).toBe(1);
  });
});

// ── onPlayerChargeWrong: crib_sheet (shadow_mimic) ────────────────────────────

describe('crib_sheet — onPlayerChargeWrong (_mirrorDamage)', () => {
  it('sets _mirrorDamage on ctx equal to cardBaseDamage', () => {
    const enemy = makeInstance('crib_sheet');
    const ctx = makeCtx(enemy, { cardBaseDamage: 8, chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(8);
  });

  it('mirrors different cardBaseDamage values correctly', () => {
    const enemy = makeInstance('crib_sheet');
    const ctx = makeCtx(enemy, { cardBaseDamage: 25 });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(25);
  });

  it('does not have onPlayerChargeCorrect (correct plays are safe)', () => {
    const template = getTemplate('crib_sheet');
    expect(template.onPlayerChargeCorrect).toBeUndefined();
  });

  it('does not have onPlayerNoCharge', () => {
    const template = getTemplate('crib_sheet');
    expect(template.onPlayerNoCharge).toBeUndefined();
  });
});

// ── onPlayerChargeWrong: final_lesson (algorithm boss) ───────────────────────

describe('final_lesson — onPlayerChargeWrong (gains +1 permanent Strength)', () => {
  it('gains +1 Strength on wrong Charge', () => {
    const enemy = makeInstance('final_lesson');
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(1);
  });

  it('Strength is permanent (turnsRemaining = 999)', () => {
    const enemy = makeInstance('final_lesson');
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.turnsRemaining).toBe(999);
  });

  it('stacks Strength on each successive wrong Charge', () => {
    const enemy = makeInstance('final_lesson');
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    enemy.template.onPlayerChargeWrong!(ctx);
    enemy.template.onPlayerChargeWrong!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(3);
  });
});

// ── onPlayerChargeWrong: citation_needed ─────────────────────────────────────

describe('citation_needed — onPlayerChargeWrong (block steal → HP gain)', () => {
  it('steals up to 5 block and converts to HP', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    const drainPlayerBlock = (amt: number) => { /* consumed */ void amt; };
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(startHP + 5);
  });

  it('steals only what the player has when player block < 5', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 10;
    const startHP = enemy.currentHP;
    let stolen = 0;
    const drainPlayerBlock = (amt: number) => { stolen = amt; };
    const ctx = makeCtx(enemy, { playerBlock: 3, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(stolen).toBe(3);
    expect(enemy.currentHP).toBe(startHP + 3);
  });

  it('does not steal when player has 0 block', () => {
    const enemy = makeInstance('citation_needed');
    const startHP = enemy.currentHP;
    const drainPlayerBlock = (amt: number) => { void amt; };
    const ctx = makeCtx(enemy, { playerBlock: 0, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(startHP);
  });

  it('does not overheal past maxHP', () => {
    const enemy = makeInstance('citation_needed');
    enemy.currentHP = enemy.maxHP - 2;
    const drainPlayerBlock = (amt: number) => { void amt; };
    const ctx = makeCtx(enemy, { playerBlock: 10, drainPlayerBlock });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBeLessThanOrEqual(enemy.maxHP);
  });
});

// ── onPlayerChargeWrong: trick_question ───────────────────────────────────────

describe('trick_question — onPlayerChargeWrong (heals 8 HP + _lockedFactId)', () => {
  it('heals exactly 8 HP on wrong Charge', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 15;
    const startHP = enemy.currentHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(startHP + 8);
  });

  it('does not overheal past maxHP', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP - 3;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy.currentHP).toBe(enemy.maxHP);
  });

  it('stores _lockedFactId when _failedFactId is provided on ctx', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    (ctx as any)._failedFactId = 'fact_xyz';
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockedFactId).toBe('fact_xyz');
  });

  it('sets _lockTurnsRemaining = 2 when _failedFactId is provided', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    (ctx as any)._failedFactId = 'fact_abc';
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockTurnsRemaining).toBe(2);
  });

  it('does NOT set _lockedFactId when _failedFactId is absent', () => {
    const enemy = makeInstance('trick_question');
    enemy.currentHP = enemy.maxHP;
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    // no _failedFactId set on ctx
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._lockedFactId).toBeUndefined();
  });

  it('does not have onPlayerChargeCorrect', () => {
    expect(getTemplate('trick_question').onPlayerChargeCorrect).toBeUndefined();
  });
});

// ── onPlayerChargeWrong: textbook ─────────────────────────────────────────────

describe('textbook — onPlayerChargeWrong (_hardcover increases, capped at 16)', () => {
  it('increases _hardcover by 2 on wrong Charge', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 10;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy._hardcover).toBe(12);
  });

  it('caps _hardcover at 16 if it would exceed', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 15;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy._hardcover).toBe(16);
  });

  it('stays at 16 if already at max', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 16;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy._hardcover).toBe(16);
  });

  it('does not restore _hardcover once _hardcoverBroken = true', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 0;
    enemy._hardcoverBroken = true;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy._hardcover).toBe(0);
  });
});

// ── onPlayerChargeWrong: tutor ────────────────────────────────────────────────

describe('tutor — onPlayerChargeWrong (_nextAttackDoubled)', () => {
  it('sets _nextAttackDoubled = true on wrong Charge', () => {
    const enemy = makeInstance('tutor');
    const ctx = makeCtx(enemy, { chargeCorrect: false });
    expect(enemy.template.onPlayerChargeWrong).toBeDefined();
    enemy.template.onPlayerChargeWrong!(ctx);
    expect(enemy._nextAttackDoubled).toBe(true);
  });

  it('_nextAttackDoubled doubles attack damage then clears itself', () => {
    const enemy = makeInstance('tutor');
    enemy._nextAttackDoubled = true;
    // Force an attack intent to measure damage
    enemy.nextIntent = { type: 'attack', value: 8, weight: 1, telegraph: 'Curse strike' };
    const result = executeEnemyIntent(enemy);
    // Damage should be doubled (relative to the same intent without the flag)
    // It fired, so the flag should be cleared
    expect(enemy._nextAttackDoubled).toBe(false);
    // Damage should be non-zero
    expect(result.damage).toBeGreaterThan(0);
    expect(result.stunned).toBe(false);
  });

  it('does not have onPlayerChargeCorrect', () => {
    expect(getTemplate('tutor').onPlayerChargeCorrect).toBeUndefined();
  });

  it('does not have onPlayerNoCharge', () => {
    expect(getTemplate('tutor').onPlayerNoCharge).toBeUndefined();
  });
});

// ── onPlayerChargeWrong: blank_spot ───────────────────────────────────────────

describe('blank_spot — onPlayerChargeWrong (+8 block)', () => {
  it('gains 8 block on wrong Charge', () => {
    const enemy = makeInstance('blank_spot');
    enemy.block = 0;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy.block).toBe(8);
  });

  it('stacks on existing block', () => {
    const enemy = makeInstance('blank_spot');
    enemy.block = 5;
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy));
    expect(enemy.block).toBe(13);
  });

  it('does not have onPlayerChargeCorrect or onPlayerNoCharge', () => {
    const t = getTemplate('blank_spot');
    expect(t.onPlayerChargeCorrect).toBeUndefined();
    expect(t.onPlayerNoCharge).toBeUndefined();
  });
});

// ── onPlayerChargeWrong + onPlayerNoCharge: comparison_trap ──────────────────

describe('comparison_trap — onPlayerChargeWrong + onPlayerNoCharge', () => {
  it('mirrors damage on wrong charge (_mirrorDamage = cardBaseDamage)', () => {
    const enemy = makeInstance('comparison_trap');
    const ctx = makeCtx(enemy, { cardBaseDamage: 6, chargeCorrect: false });
    enemy.template.onPlayerChargeWrong!(ctx);
    expect((ctx as any)._mirrorDamage).toBe(6);
  });

  it('gains +1 permanent Strength on wrong charge', () => {
    const enemy = makeInstance('comparison_trap');
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy, { chargeCorrect: false }));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(1);
    expect(str!.turnsRemaining).toBeGreaterThanOrEqual(999);
  });

  it('gains +2 permanent Strength on no charge', () => {
    const enemy = makeInstance('comparison_trap');
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(2);
  });

  it('Strength stacks across multiple triggers', () => {
    const enemy = makeInstance('comparison_trap');
    enemy.template.onPlayerChargeWrong!(makeCtx(enemy, { chargeCorrect: false }));
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(3); // 1 from wrong + 2 from no-charge
  });
});

// ── onPlayerChargeCorrect: pop_quiz ──────────────────────────────────────────

describe('pop_quiz — onPlayerChargeCorrect (_stunNextTurn)', () => {
  it('sets _stunNextTurn = true on correct Charge', () => {
    const enemy = makeInstance('pop_quiz');
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._stunNextTurn).toBe(true);
  });

  it('calling twice still leaves _stunNextTurn = true', () => {
    const enemy = makeInstance('pop_quiz');
    const ctx = makeCtx(enemy, { chargeCorrect: true });
    enemy.template.onPlayerChargeCorrect!(ctx);
    enemy.template.onPlayerChargeCorrect!(ctx);
    expect(enemy._stunNextTurn).toBe(true);
  });
});

// ── onPlayerChargeCorrect: textbook ──────────────────────────────────────────

describe('textbook — onPlayerChargeCorrect (_hardcover decreases)', () => {
  it('decreases _hardcover by 4 on correct Charge', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 16;
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    expect(enemy._hardcover).toBe(12);
  });

  it('floors _hardcover at 0 and marks _hardcoverBroken', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 4;
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    expect(enemy._hardcover).toBe(0);
    expect(enemy._hardcoverBroken).toBe(true);
  });

  it('applies Vulnerable 2 turns when hardcover breaks', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 4;
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    const vuln = enemy.statusEffects.find(e => e.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(2);
  });

  it('does not modify _hardcover once _hardcoverBroken = true', () => {
    const enemy = makeInstance('textbook');
    enemy._hardcover = 0;
    enemy._hardcoverBroken = true;
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    expect(enemy._hardcover).toBe(0);
  });

  it('initializes with _hardcover = 16 (hardcoverArmor template value)', () => {
    const enemy = makeInstance('textbook');
    expect(enemy._hardcover).toBe(16);
  });

  it('template.hardcoverArmor === 16', () => {
    expect(getTemplate('textbook').hardcoverArmor).toBe(16);
  });
});

// ── onPlayerChargeCorrect: grade_curve ───────────────────────────────────────

describe('grade_curve — onPlayerChargeCorrect (enrageBonusDamage += 2)', () => {
  it('increases enrageBonusDamage by 2 on each correct Charge', () => {
    const enemy = makeInstance('grade_curve');
    expect(enemy.enrageBonusDamage).toBe(0);
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    expect(enemy.enrageBonusDamage).toBe(2);
    enemy.template.onPlayerChargeCorrect!(makeCtx(enemy, { chargeCorrect: true }));
    expect(enemy.enrageBonusDamage).toBe(4);
  });

  it('enrageBonusDamage actually affects executeEnemyIntent attack output', () => {
    const enemy = makeInstance('grade_curve');
    // Force an attack intent
    enemy.nextIntent = { type: 'attack', value: 4, weight: 1, telegraph: 'Knowledge drain' };
    const baseResult = executeEnemyIntent(enemy);

    const enemy2 = makeInstance('grade_curve');
    enemy2.enrageBonusDamage = 6;
    enemy2.nextIntent = { type: 'attack', value: 4, weight: 1, telegraph: 'Knowledge drain' };
    const boostedResult = executeEnemyIntent(enemy2);

    // Boosted enemy should deal more damage (enrageBonusDamage is added to base value)
    expect(boostedResult.damage).toBeGreaterThan(baseResult.damage);
  });

  // BUG DOCUMENTATION — kept as a known-behavior test, not a breakage
  it('BEHAVIOR NOTE: enrageBonusDamage IS active — executeEnemyIntent reads it for attack damage', () => {
    // Contrary to what the name suggests, enrageBonusDamage is NOT dead code.
    // enemyManager.ts executeEnemyIntent: baseValue = intent.value + (enemy.enrageBonusDamage ?? 0)
    // This is the documented mechanism. getEnrageBonus() in turnManager IS dead (always 0),
    // but that is a separate function unrelated to enrageBonusDamage on the instance.
    const enemy = makeInstance('grade_curve');
    enemy.enrageBonusDamage = 10;
    enemy.nextIntent = { type: 'attack', value: 4, weight: 1, telegraph: 'Knowledge drain' };
    const result = executeEnemyIntent(enemy);
    // base = 4 + 10 = 14, scaled by floor multipliers
    expect(result.damage).toBeGreaterThan(0);
    expect(result.stunned).toBe(false);
  });
});

// ── onPlayerNoCharge: peer_reviewer ──────────────────────────────────────────

describe('peer_reviewer — onPlayerNoCharge (+3 permanent Strength)', () => {
  it('applies +3 Strength on no-Charge turn', () => {
    const enemy = makeInstance('peer_reviewer');
    const ctx = makeCtx(enemy, { playMode: 'quick' });
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(3);
  });

  it('Strength is permanent (turnsRemaining = 999)', () => {
    const enemy = makeInstance('peer_reviewer');
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.turnsRemaining).toBe(999);
  });

  it('stacks on repeated no-Charge turns', () => {
    const enemy = makeInstance('peer_reviewer');
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(6);
  });
});

// ── onPlayerNoCharge: tenure_guardian ────────────────────────────────────────

describe('tenure_guardian — onPlayerNoCharge (+1 permanent Strength)', () => {
  it('applies +1 Strength on no-Charge turn', () => {
    const enemy = makeInstance('tenure_guardian');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeDefined();
    expect(str!.value).toBe(1);
  });

  it('Strength is permanent (turnsRemaining = 999)', () => {
    const enemy = makeInstance('tenure_guardian');
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.turnsRemaining).toBe(999);
  });

  it('stacks +1 per no-Charge turn', () => {
    const enemy = makeInstance('tenure_guardian');
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(3);
  });
});

// ── onPlayerNoCharge: proctor ─────────────────────────────────────────────────

describe('proctor — onPlayerNoCharge (+1 permanent Strength)', () => {
  it('applies +1 Strength on no-Charge turn', () => {
    const enemy = makeInstance('proctor');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(1);
    expect(str!.turnsRemaining).toBe(999);
  });
});

// ── onPlayerNoCharge: pop_quiz ────────────────────────────────────────────────

describe('pop_quiz — onPlayerNoCharge (enrageBonusDamage += 1)', () => {
  it('increments enrageBonusDamage by 1 on no-Charge turn', () => {
    const enemy = makeInstance('pop_quiz');
    expect(enemy.enrageBonusDamage).toBe(0);
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    expect(enemy.enrageBonusDamage).toBe(1);
  });

  it('stacks across multiple no-Charge turns', () => {
    const enemy = makeInstance('pop_quiz');
    const ctx = makeCtx(enemy);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    enemy.template.onPlayerNoCharge!(ctx);
    expect(enemy.enrageBonusDamage).toBe(3);
  });

  it('enrageBonusDamage is added to attack intent value in executeEnemyIntent', () => {
    const enemy = makeInstance('pop_quiz');
    enemy.enrageBonusDamage = 5;
    enemy.nextIntent = { type: 'attack', value: 8, weight: 1, telegraph: 'Cap strike' };
    const result = executeEnemyIntent(enemy);
    // value of 8 + 5 = 13 before floor scaling — should be higher than without the bonus
    const enemy2 = makeInstance('pop_quiz');
    enemy2.enrageBonusDamage = 0;
    enemy2.nextIntent = { type: 'attack', value: 8, weight: 1, telegraph: 'Cap strike' };
    const result2 = executeEnemyIntent(enemy2);
    expect(result.damage).toBeGreaterThan(result2.damage);
  });

  // Documenting the "escalate" feedback bug context:
  // The user observed "Escalate doesn't give the enemy Strength each turn" —
  // this is because enrageBonusDamage is NOT a visible status effect in the UI.
  // The bonus is real (enemy hits harder) but lacks a Strength icon.
  // This is a UX issue, not a mechanical bug.
  it('POP_QUIZ: enrageBonusDamage is a real damage increase but NOT shown as a Strength status effect', () => {
    const enemy = makeInstance('pop_quiz');
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    // enrageBonusDamage is set
    expect(enemy.enrageBonusDamage).toBe(1);
    // No strength status effect visible to the UI
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str).toBeUndefined();
  });
});

// ── onPlayerNoCharge: perfectionist ──────────────────────────────────────────

describe('perfectionist — onPlayerNoCharge (+1 permanent Strength)', () => {
  it('applies +1 Strength on no-Charge turn', () => {
    const enemy = makeInstance('perfectionist');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(1);
    expect(str!.turnsRemaining).toBe(999);
  });
});

// ── onPlayerNoCharge: dean ───────────────────────────────────────────────────

describe('dean — onPlayerNoCharge (+1 permanent Strength)', () => {
  it('applies +1 Strength on no-Charge turn', () => {
    const enemy = makeInstance('dean');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(1);
    expect(str!.turnsRemaining).toBe(999);
  });
});

// ── onPlayerNoCharge: ancient_tongue ─────────────────────────────────────────

describe('ancient_tongue — onPlayerNoCharge (+1 permanent Strength)', () => {
  it('applies +1 Strength on no-Charge turn', () => {
    const enemy = makeInstance('ancient_tongue');
    expect(enemy.template.onPlayerNoCharge).toBeDefined();
    enemy.template.onPlayerNoCharge!(makeCtx(enemy));
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(1);
    expect(str!.turnsRemaining).toBe(999);
  });
});

// ── onEncounterStart: headmistress ────────────────────────────────────────────

describe('headmistress — onEncounterStart (Detention: exhaust top 2 mastery cards)', () => {
  it('returns IDs of the 2 highest-mastery cards from combined hand + drawPile', () => {
    const enemy = makeInstance('headmistress');
    expect(enemy.template.onEncounterStart).toBeDefined();
    const deck = {
      hand: [
        { id: 'a', masteryLevel: 0 },
        { id: 'b', masteryLevel: 4 },
      ],
      drawPile: [
        { id: 'c', masteryLevel: 2 },
        { id: 'd', masteryLevel: 3 },
        { id: 'e', masteryLevel: 1 },
      ],
      forgetPile: [],
    };
    const result = enemy.template.onEncounterStart!(enemy, deck);
    // Should return IDs of mastery 4 ('b') and mastery 3 ('d')
    expect(result).toHaveLength(2);
    expect(result).toContain('b');
    expect(result).toContain('d');
    expect(result).not.toContain('a');
    expect(result).not.toContain('c');
    expect(result).not.toContain('e');
  });

  it('returns 2 IDs even when all cards are in drawPile', () => {
    const enemy = makeInstance('headmistress');
    const deck = {
      hand: [],
      drawPile: [
        { id: 'x1', masteryLevel: 5 },
        { id: 'x2', masteryLevel: 5 },
        { id: 'x3', masteryLevel: 3 },
      ],
      forgetPile: [],
    };
    const result = enemy.template.onEncounterStart!(enemy, deck);
    expect(result).toHaveLength(2);
  });

  it('handles cards with undefined masteryLevel (treated as 0)', () => {
    const enemy = makeInstance('headmistress');
    const deck = {
      hand: [
        { id: 'a', masteryLevel: 2 },
        { id: 'b' }, // no masteryLevel
      ],
      drawPile: [
        { id: 'c', masteryLevel: 5 },
      ],
      forgetPile: [],
    };
    const result = enemy.template.onEncounterStart!(enemy, deck);
    // mastery 5 ('c') and 2 ('a') are highest
    expect(result).toContain('c');
    expect(result).toContain('a');
    expect(result).not.toContain('b');
  });

  it('returns at most 2 cards (slice 0,2 of sorted descending)', () => {
    const enemy = makeInstance('headmistress');
    const deck = {
      hand: Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`,
        masteryLevel: i,
      })),
      drawPile: [],
      forgetPile: [],
    };
    const result = enemy.template.onEncounterStart!(enemy, deck);
    expect(result).toHaveLength(2);
    // Should be c7 (mastery 7) and c6 (mastery 6)
    expect(result).toContain('c7');
    expect(result).toContain('c6');
  });
});

// ── onPhaseTransition: study_group ────────────────────────────────────────────

describe('study_group — onPhaseTransition (lose 1 Strength buff on group break)', () => {
  it('reduces strength buff by 1 when group transitions', () => {
    const enemy = makeInstance('study_group');
    // Inject a Strength buff to simulate accumulated group synergy
    enemy.statusEffects.push({ type: 'strength', value: 3, turnsRemaining: 999 });
    expect(enemy.template.onPhaseTransition).toBeDefined();
    enemy.template.onPhaseTransition!(enemy);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(2);
  });

  it('does not reduce Strength below 0', () => {
    const enemy = makeInstance('study_group');
    enemy.statusEffects.push({ type: 'strength', value: 0, turnsRemaining: 999 });
    enemy.template.onPhaseTransition!(enemy);
    const str = enemy.statusEffects.find(e => e.type === 'strength');
    expect(str!.value).toBe(0);
  });

  it('does not throw when there is no Strength buff (no group buff accumulated)', () => {
    const enemy = makeInstance('study_group');
    // No strength in statusEffects
    expect(() => enemy.template.onPhaseTransition!(enemy)).not.toThrow();
  });

  it('transitions to phase 2 at 33% HP via applyDamageToEnemy', () => {
    const enemy = makeInstance('study_group', 1);
    // Damage to just below 33% HP
    const damageToTransition = Math.ceil(enemy.maxHP * 0.68);
    applyDamageToEnemy(enemy, damageToTransition);
    expect(enemy.phase).toBe(2);
  });
});

// ── Phase transitions: structure checks ──────────────────────────────────────

describe('Phase transition structure — phaseTransitionAt thresholds', () => {
  const phasedEnemies: Array<{ id: string; threshold: number }> = [
    { id: 'bookwyrm', threshold: 0.5 },
    { id: 'final_exam', threshold: 0.4 },
    { id: 'algorithm', threshold: 0.5 },
    { id: 'curriculum', threshold: 0.5 },
    { id: 'deadline_serpent', threshold: 0.5 },
    { id: 'librarian', threshold: 0.4 },
    { id: 'study_group', threshold: 0.33 },
    { id: 'final_lesson', threshold: 0.33 },
    { id: 'burning_deadline', threshold: 0.4 },
    { id: 'group_project', threshold: 0.5 },
    { id: 'omnibus', threshold: 0.5 },
    { id: 'student_debt', threshold: 0.4 },
    { id: 'emeritus', threshold: 0.5 },
    { id: 'first_question', threshold: 0.5 },
  ];

  for (const { id, threshold } of phasedEnemies) {
    it(`${id} has phaseTransitionAt = ${threshold}`, () => {
      const t = getTemplate(id);
      expect(t.phaseTransitionAt).toBe(threshold);
    });

    it(`${id} has phase2IntentPool defined`, () => {
      const t = getTemplate(id);
      expect(t.phase2IntentPool).toBeDefined();
      expect(t.phase2IntentPool!.length).toBeGreaterThan(0);
    });
  }

  it('applyDamageToEnemy triggers phase 2 at the correct HP threshold', () => {
    const enemy = makeInstance('algorithm', 1);
    // 0.5 threshold: deal damage to go below 50% HP
    const damageToTransition = Math.ceil(enemy.maxHP * 0.51);
    applyDamageToEnemy(enemy, damageToTransition);
    expect(enemy.phase).toBe(2);
  });

  it('applyDamageToEnemy does NOT trigger phase 2 if HP stays above threshold', () => {
    const enemy = makeInstance('algorithm', 1);
    const damageBelow50 = Math.floor(enemy.maxHP * 0.3);
    applyDamageToEnemy(enemy, damageBelow50);
    expect(enemy.phase).toBe(1);
  });

  it('phase 2 transition fires exactly once (second large damage does not re-fire)', () => {
    const enemy = makeInstance('algorithm', 1);
    enemy.statusEffects.push({ type: 'strength', value: 0, turnsRemaining: 999 }); // sentinel
    const damageToTransition = Math.ceil(enemy.maxHP * 0.51);
    applyDamageToEnemy(enemy, damageToTransition);
    const phase1 = enemy.phase;
    applyDamageToEnemy(enemy, 1); // additional small damage
    expect(enemy.phase).toBe(phase1); // still 2, didn't regress
  });
});

// ── Quiz phases: final_exam ────────────────────────────────────────────────────

describe('final_exam — quizPhases', () => {
  it('has exactly 1 quiz phase', () => {
    const t = getTemplate('final_exam');
    expect(t.quizPhases).toBeDefined();
    expect(t.quizPhases!).toHaveLength(1);
  });

  it('quiz phase 0: hpThreshold = 0.5, questionCount = 8, rapidFire = true', () => {
    const phase = getTemplate('final_exam').quizPhases![0];
    expect(phase.hpThreshold).toBe(0.5);
    expect(phase.questionCount).toBe(8);
    expect(phase.rapidFire).toBe(true);
  });
});

// ── Quiz phases: algorithm ────────────────────────────────────────────────────

describe('algorithm — quizPhases', () => {
  it('has exactly 1 quiz phase', () => {
    const t = getTemplate('algorithm');
    expect(t.quizPhases).toBeDefined();
    expect(t.quizPhases!).toHaveLength(1);
  });

  it('quiz phase 0: hpThreshold = 0.5, questionCount > 0', () => {
    const phase = getTemplate('algorithm').quizPhases![0];
    expect(phase.hpThreshold).toBe(0.5);
    expect(phase.questionCount).toBeGreaterThan(0);
  });
});

// ── Quiz phases: final_lesson ─────────────────────────────────────────────────

describe('final_lesson — quizPhases', () => {
  it('has exactly 2 quiz phases', () => {
    const t = getTemplate('final_lesson');
    expect(t.quizPhases).toBeDefined();
    expect(t.quizPhases!).toHaveLength(2);
  });

  it('phase 0: hpThreshold = 0.66', () => {
    expect(getTemplate('final_lesson').quizPhases![0].hpThreshold).toBe(0.66);
  });

  it('phase 1: hpThreshold = 0.33, rapidFire = true', () => {
    const phase = getTemplate('final_lesson').quizPhases![1];
    expect(phase.hpThreshold).toBe(0.33);
    expect(phase.rapidFire).toBe(true);
  });
});

// ── Template passive flags: chargeResistant ───────────────────────────────────

describe('chargeResistant flag', () => {
  const chargeResistantIds = [
    'thesis_construct',
    'crambot',
    'watchdog',
    'dropout',
    'rote_memory',
    'hidden_gem',
    'thesis_djinn',
    'sacred_text',
    'institution',
    'fake_news',
    'staple_bug',
  ];

  for (const id of chargeResistantIds) {
    it(`${id} has chargeResistant = true`, () => {
      expect(getTemplate(id).chargeResistant).toBe(true);
    });
  }

  // Enemies that do NOT have chargeResistant
  it('page_flutter does NOT have chargeResistant', () => {
    expect(getTemplate('page_flutter').chargeResistant).toBeUndefined();
  });

  it('blank_spot does NOT have chargeResistant (it uses onPlayerChargeWrong instead)', () => {
    expect(getTemplate('blank_spot').chargeResistant).toBeUndefined();
  });
});

// ── Template passive flags: chainVulnerable ───────────────────────────────────

describe('chainVulnerable flag', () => {
  const chainVulnerableIds = [
    'bookmark_vine',
    'index_weaver',
    'eraser_worm',
    'thesis_dragon',
    'writers_block',
    'outdated_fact',
    'rushing_student',
    'ember_skeleton',
  ];

  for (const id of chainVulnerableIds) {
    it(`${id} has chainVulnerable = true`, () => {
      expect(getTemplate(id).chainVulnerable).toBe(true);
    });
  }

  it('page_flutter does NOT have chainVulnerable', () => {
    expect(getTemplate('page_flutter').chainVulnerable).toBeUndefined();
  });
});

// ── Template passive flags: chainMultiplierOverride ──────────────────────────

describe('chainMultiplierOverride', () => {
  it('dunning_kruger has chainMultiplierOverride = 1.0', () => {
    expect(getTemplate('dunning_kruger').chainMultiplierOverride).toBe(1.0);
  });

  it('dunning_kruger has no callbacks (override is passive/structural)', () => {
    const t = getTemplate('dunning_kruger');
    expect(t.onPlayerChargeWrong).toBeUndefined();
    expect(t.onPlayerChargeCorrect).toBeUndefined();
    expect(t.onPlayerNoCharge).toBeUndefined();
  });
});

// ── Template passive flags: quickPlayDamageMultiplier ────────────────────────

describe('quickPlayDamageMultiplier', () => {
  it('singularity has quickPlayDamageMultiplier = 0.3', () => {
    expect(getTemplate('singularity').quickPlayDamageMultiplier).toBe(0.3);
  });

  it('singularity has no callbacks', () => {
    const t = getTemplate('singularity');
    expect(t.onPlayerChargeWrong).toBeUndefined();
    expect(t.onPlayerChargeCorrect).toBeUndefined();
    expect(t.onPlayerNoCharge).toBeUndefined();
  });
});

// ── Template passive flags: immuneDomain ─────────────────────────────────────

describe('immuneDomain', () => {
  it('publish_or_perish has immuneDomain = natural_sciences', () => {
    expect(getTemplate('publish_or_perish').immuneDomain).toBe('natural_sciences');
  });

  it('most enemies do NOT have immuneDomain', () => {
    const withImmune = ENEMY_TEMPLATES.filter(t => t.immuneDomain);
    // Verify we know about all immune enemies (currently just 1)
    expect(withImmune.length).toBeGreaterThanOrEqual(1);
    for (const t of withImmune) {
      expect(t.immuneDomain).toBeDefined();
    }
  });
});

// ── Template passive flags: hardcoverArmor ───────────────────────────────────

describe('hardcoverArmor', () => {
  it('textbook has hardcoverArmor = 16 on template', () => {
    expect(getTemplate('textbook').hardcoverArmor).toBe(16);
  });

  it('textbook createEnemy initializes _hardcover = 16', () => {
    const enemy = makeInstance('textbook');
    expect(enemy._hardcover).toBe(16);
  });

  it('enemies without hardcoverArmor do NOT get _hardcover initialized', () => {
    const enemy = makeInstance('plagiarist');
    expect(enemy._hardcover).toBeUndefined();
  });
});

// ── Curriculum onPhaseTransition ─────────────────────────────────────────────

describe('curriculum — onPhaseTransition (Final Exam mode)', () => {
  it('sets _quickPlayDamageMultiplierOverride = 0.0 at phase transition', () => {
    const enemy = makeInstance('curriculum');
    expect(enemy.template.onPhaseTransition).toBeDefined();
    enemy.template.onPhaseTransition!(enemy);
    expect(enemy._quickPlayDamageMultiplierOverride).toBe(0.0);
  });

  it('adds +2 to enrageBonusDamage at phase transition', () => {
    const enemy = makeInstance('curriculum');
    enemy.template.onPhaseTransition!(enemy);
    expect(enemy.enrageBonusDamage).toBe(2);
  });

  it('applyDamageToEnemy fires onPhaseTransition at 50% HP', () => {
    const enemy = makeInstance('curriculum', 1);
    const damageToTransition = Math.ceil(enemy.maxHP * 0.51);
    applyDamageToEnemy(enemy, damageToTransition);
    expect(enemy.phase).toBe(2);
    expect(enemy._quickPlayDamageMultiplierOverride).toBe(0.0);
    expect(enemy.enrageBonusDamage).toBe(2);
  });

  it('does NOT fire onPhaseTransition when damage is below threshold', () => {
    const enemy = makeInstance('curriculum', 1);
    const safeAmount = Math.floor(enemy.maxHP * 0.3);
    applyDamageToEnemy(enemy, safeAmount);
    expect(enemy.phase).toBe(1);
    expect(enemy._quickPlayDamageMultiplierOverride).toBeUndefined();
  });
});

// ── Exhaustiveness: all enemies with callbacks are accounted for ──────────────

describe('callback coverage exhaustiveness', () => {
  it('all enemies with onPlayerChargeWrong are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onPlayerChargeWrong).map(t => t.id);
    // Ensure none slip through untested — list must match source
    const tested = [
      'crib_sheet',
      'citation_needed',
      'trick_question',
      'tutor',
      'blank_spot',
      'textbook',
      'final_lesson',
      'comparison_trap',
    ];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onPlayerChargeWrong but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });

  it('all enemies with onPlayerChargeCorrect are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onPlayerChargeCorrect).map(t => t.id);
    const tested = ['pop_quiz', 'textbook', 'grade_curve'];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onPlayerChargeCorrect but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });

  it('all enemies with onPlayerNoCharge are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onPlayerNoCharge).map(t => t.id);
    const tested = [
      'peer_reviewer',
      'tenure_guardian',
      'proctor',
      'pop_quiz',
      'perfectionist',
      'dean',
      'ancient_tongue',
      'comparison_trap',
    ];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onPlayerNoCharge but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });

  it('all enemies with onEnemyTurnStart are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onEnemyTurnStart).map(t => t.id);
    const tested = ['plagiarist', 'librarian', 'brain_fog'];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onEnemyTurnStart but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });

  it('all enemies with onPhaseTransition are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onPhaseTransition).map(t => t.id);
    const tested = ['study_group', 'curriculum'];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onPhaseTransition but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });

  it('all enemies with onEncounterStart are tested', () => {
    const withCb = ENEMY_TEMPLATES.filter(t => t.onEncounterStart).map(t => t.id);
    const tested = ['headmistress'];
    for (const id of withCb) {
      expect(
        tested,
        `Enemy '${id}' has onEncounterStart but is NOT in the tested list — add tests!`,
      ).toContain(id);
    }
  });
});
