/**
 * Regression tests for charge-wrong (fizzle) damage through the full playCardAction pipeline.
 *
 * CRITICAL BUG DOCUMENTED 2026-04-12:
 * Two divergent fizzle implementations produce inconsistent damage values:
 *
 * 1. cardEffectResolver.resolveCardEffect() — uses mechanic.chargeWrongValue (canonical, used in unit tests)
 * 2. turnManager.playCardAction() wrong-answer inline path — uses card.baseEffectValue × FIZZLE_EFFECT_RATIO
 *
 * The inline path (path 2) is what actually executes when a player answers a quiz wrong in combat.
 * The resolver path (path 1) is what attack-mechanics.test.ts exercises via resolveCardEffect().
 *
 * For strike at L0:
 *   mechanic.chargeWrongValue = 3  (resolver path — canonical intent)
 *   card.baseEffectValue (production, from BASE_EFFECT.attack) = 4
 *   FIZZLE_EFFECT_RATIO = 0.50
 *   Inline fizzle result: Math.round(4 × 0.50) = 2
 *
 * This means:
 *   - resolver says strike CW = 3
 *   - live game inline path says strike CW = 2
 *   - These are different and the difference is undocumented
 *
 * This test file exercises the ACTUAL production code path (playCardAction → inline fizzle)
 * to lock in the current behavior and catch any future regressions.
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
   * Strike at L0 via production card factory:
   *   card.baseEffectValue = BASE_EFFECT.attack = 4
   *   FIZZLE_EFFECT_RATIO = 0.50
   *   Inline fizzle = Math.round(4 * 0.50) = Math.round(2.0) = 2
   *
   * This is the ACTUAL live game behavior when a player wrongs a charge.
   * Note: cardEffectResolver gives 3 (mechanic.chargeWrongValue) — different value, different path.
   */
  it('strike CW: playCardAction inline fizzle deals 2 damage (Math.round(BASE_EFFECT.attack=4 × 0.50))', () => {
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
    // Math.round(4 × 0.50) = Math.round(2.0) = 2
    expect(damage).toBe(2);
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
   * Block card fizzle via production path:
   *   card.baseEffectValue = BASE_EFFECT.shield = 3
   *   Inline fizzle for shield = Math.round(3 × 0.50) = Math.round(1.5) = 2
   */
  it('block CW: inline fizzle applies partial shield (Math.round(BASE_EFFECT.shield=3 × 0.50) = 2)', () => {
    const card = makeProductionCard('block');
    const deck = createDeck([card]);
    const enemy = makeEnemy(100);
    const turnState = startEncounter(deck, enemy);

    const cardInHand = turnState.deck.hand.find(c => c.mechanicId === 'block');
    if (!cardInHand) return;

    const shieldBefore = turnState.playerState.shield;
    playCardAction(turnState, cardInHand.id, false, false, 'charge');

    const shieldGained = turnState.playerState.shield - shieldBefore;
    // Math.round(3 × 0.50) = Math.round(1.5) = 2 (JS rounds half up)
    expect(shieldGained).toBe(2);
  });

  /**
   * Discrepancy documentation test: two fizzle paths, two different values for strike.
   *
   * cardEffectResolver path: uses mechanic.chargeWrongValue = 3
   * turnManager inline path: uses BASE_EFFECT.attack=4 × 0.50 = 2
   *
   * This test documents and locks in this known discrepancy (2026-04-12).
   * If this test fails, it means one of the two implementations was changed
   * and the discrepancy may have been resolved.
   */
  it('DISCREPANCY DOCUMENTED: resolver path gives 3, inline path gives 2, for strike CW at L0', () => {
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
    expect(inlineDamage).toBe(2); // Math.round(BASE_EFFECT.attack=4 × 0.50) = 2

    // The two implementations disagree:
    // resolver = 3, inline = 2. This is a known code inconsistency.
    expect(resolverResult.damageDealt).not.toBe(inlineDamage);
  });
});
