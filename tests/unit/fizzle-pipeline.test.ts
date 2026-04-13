/**
 * Regression tests for charge-wrong (fizzle) damage through the full playCardAction pipeline.
 *
 * FIXED 2026-04-12 (previously documented as CRITICAL BUG):
 * The two fizzle implementations now agree. Before the fix, there were two divergent paths:
 *
 * 1. cardEffectResolver.resolveCardEffect() — uses mechanic.chargeWrongValue (canonical)
 * 2. turnManager.playCardAction() wrong-answer inline path — used card.baseEffectValue × FIZZLE_EFFECT_RATIO
 *
 * The inline path now checks mechanic.chargeWrongValue first and only falls back to
 * card.baseEffectValue × FIZZLE_EFFECT_RATIO when chargeWrongValue is undefined/null (no mechanic
 * lookup possible).
 *
 * For strike at L0:
 *   mechanic.chargeWrongValue = 3  (canonical, now used by BOTH paths)
 *   card.baseEffectValue (production, from BASE_EFFECT.attack) = 4
 *   FIZZLE_EFFECT_RATIO = 0.50
 *   Old inline fizzle result: Math.round(4 × 0.50) = 2  (was wrong)
 *   New inline fizzle result: mechanic.chargeWrongValue = 3  (matches resolver)
 */

import { describe, it, expect } from 'vitest';
import { startEncounter, playCardAction } from '../../src/services/turnManager';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import { createDeck } from '../../src/services/deckManager';
import { getMechanicDefinition } from '../../src/data/mechanics';
import { BASE_EFFECT } from '../../src/data/balance';
import type { Card, CardType } from '../../src/data/card-types';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import type { PlayerCombatState } from '../../src/services/playerCombatState';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a card using production card factory conventions (BASE_EFFECT[cardType]).
 * This mirrors what cardFactory.ts does — NOT what scenarioSimulator does.
 * scenarioSimulator uses mechanic.baseValue (=8 for strike), production uses BASE_EFFECT.attack (=4).
 */
function makeProductionCard(mechanicId: string): Card {
  const mechanic = getMechanicDefinition(mechanicId);
  const cardType = (mechanic?.type ?? 'attack') as CardType;
  return {
    id: `test-${mechanicId}`,
    factId: 'test-fact',
    cardType,
    domain: 'test' as any,
    tier: '1' as const,
    // Production path: BASE_EFFECT[cardType], NOT mechanic.baseValue
    baseEffectValue: BASE_EFFECT[cardType] ?? 0,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId,
    mechanicName: mechanic?.name,
    secondaryValue: mechanic?.secondaryValue,
    chainType: 0,
  };
}

function makePlayerState(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  return {
    hp: 80,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
    comboCount: 0,
    hintsRemaining: 1,
    cardsPlayedThisTurn: 0,
    ...overrides,
  };
}

function makeEnemy(hpOverride = 100, blockOverride = 0): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'test-enemy',
    name: 'Test Enemy',
    category: 'common',
    baseHP: hpOverride,
    intentPool: [{ type: 'attack', value: 5, weight: 1, telegraph: 'Strike' }],
    description: 'Test enemy for fizzle tests',
  };
  return {
    template,
    currentHP: hpOverride,
    maxHP: hpOverride,
    nextIntent: template.intentPool[0],
    block: blockOverride,
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fizzle (charge-wrong) — full turnManager pipeline (production card factory path)', () => {
  /**
   * Strike at L0 via production card factory.
   * After fix: inline path uses mechanic.chargeWrongValue = 3.
   * This matches the resolver path.
   */
  it('strike CW: playCardAction inline fizzle deals 3 damage (mechanic.chargeWrongValue)', () => {
    const card = makeProductionCard('strike');
    const deck = createDeck([card]);
    const enemy = makeEnemy(100);
    const turnState = startEncounter(deck, enemy);

    const cardInHand = turnState.deck.hand.find(c => c.mechanicId === 'strike');
    if (!cardInHand) return; // Skip if draw didn't pull the card (single-card deck always draws it)

    const hpBefore = enemy.currentHP;
    // answeredCorrectly=false, playMode='charge' → triggers inline fizzle path
    playCardAction(turnState, cardInHand.id, false, false, 'charge');

    const damage = hpBefore - enemy.currentHP;
    // mechanic.chargeWrongValue for strike = 3
    expect(damage).toBe(3);
  });

  it('strike CW: inline fizzle always > 0 (non-negative guarantee)', () => {
    const card = makeProductionCard('strike');
    const deck = createDeck([card]);
    const enemy = makeEnemy(100);
    const turnState = startEncounter(deck, enemy);

    const cardInHand = turnState.deck.hand.find(c => c.mechanicId === 'strike');
    if (!cardInHand) return;

    playCardAction(turnState, cardInHand.id, false, false, 'charge');
    expect(enemy.currentHP).toBeLessThan(100);
  });

  /**
   * Block card fizzle via production path.
   * After fix: inline path uses mechanic.chargeWrongValue for block = 3.
   * (Previously Math.round(BASE_EFFECT.shield=3 × 0.50) = 2 — now 3 to match resolver.)
   */
  it('block CW: inline fizzle applies partial shield equal to mechanic.chargeWrongValue', () => {
    const card = makeProductionCard('block');
    const mechanic = getMechanicDefinition('block');
    const expectedShield = mechanic?.chargeWrongValue ?? 0;
    const deck = createDeck([card]);
    const enemy = makeEnemy(100);
    const turnState = startEncounter(deck, enemy);

    const cardInHand = turnState.deck.hand.find(c => c.mechanicId === 'block');
    if (!cardInHand) return;

    const shieldBefore = turnState.playerState.shield;
    playCardAction(turnState, cardInHand.id, false, false, 'charge');

    const shieldGained = turnState.playerState.shield - shieldBefore;
    expect(shieldGained).toBe(expectedShield);
  });

  /**
   * Convergence test: after the fix, both fizzle paths must agree for strike.
   *
   * cardEffectResolver path: uses mechanic.chargeWrongValue = 3
   * turnManager inline path: now also uses mechanic.chargeWrongValue = 3
   *
   * This test replaces the old "DISCREPANCY DOCUMENTED" test and verifies the bug is fixed.
   */
  it('CONVERGENCE: resolver path and inline path now agree for strike CW at L0', () => {
    const card = makeProductionCard('strike');
    const player = makePlayerState();
    const enemy1 = makeEnemy(100);

    // Path 1: cardEffectResolver with charge_wrong playMode
    const resolverResult = resolveCardEffect(
      card, player, enemy1, 1.0, 0, undefined, undefined,
      { playMode: 'charge_wrong' }
    );
    expect(resolverResult.damageDealt).toBe(3); // mechanic.chargeWrongValue = 3

    // Path 2: turnManager.playCardAction inline fizzle (actual live game path)
    const card2 = makeProductionCard('strike');
    const deck2 = createDeck([card2]);
    const enemy2 = makeEnemy(100);
    const ts = startEncounter(deck2, enemy2);
    const cardInHand = ts.deck.hand.find(c => c.mechanicId === 'strike');
    if (!cardInHand) return;
    const hpBefore = enemy2.currentHP;
    playCardAction(ts, cardInHand.id, false, false, 'charge');
    const inlineDamage = hpBefore - enemy2.currentHP;
    expect(inlineDamage).toBe(3); // mechanic.chargeWrongValue = 3 (fixed from old inline value of 2)

    // Both paths must now agree
    expect(resolverResult.damageDealt).toBe(inlineDamage);
  });
});
