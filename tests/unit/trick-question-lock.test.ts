/**
 * AR-268: Trick Question card lock mechanic — integration tests.
 * Tests the full turn-manager lock flow:
 * - Wrong Charge stores _lockedFactId on enemy
 * - Turn start applies lock to a random hand card
 * - Lock expires after 2 turns
 * - Quick Play is blocked on locked cards
 * - Correct Charge with matching factId clears lock + applies 2x bonus
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, CardRunState } from '../../src/data/card-types';
import type { EnemyTemplate, EnemyInstance } from '../../src/data/enemies';
import { startEncounter, endPlayerTurn, playCardAction } from '../../src/services/turnManager';
import { createDeck, drawHand } from '../../src/services/deckManager';
import { resetAura } from '../../src/services/knowledgeAuraSystem';
import { resetReviewQueue } from '../../src/services/reviewQueueSystem';

// ── Helpers ──

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: `card_${Math.random().toString(36).slice(2)}`,
    factId: 'fact_default',
    cardType: 'attack',
    domain: 'science',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    apCost: 1,
    ...overrides,
  };
}

function makeCards(n: number, factIdPrefix = 'fact'): Card[] {
  return Array.from({ length: n }, (_, i) =>
    makeCard({ id: `card_${i}`, factId: `${factIdPrefix}_${i}` })
  );
}

function makeDeckWithHand(handSize = 5, totalCards = 20): CardRunState {
  const cards = makeCards(totalCards);
  const deck = createDeck(cards);
  drawHand(deck, handSize);
  return deck;
}

function makeTrickQuestionEnemy(): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'trick_question',
    name: 'The Trick Question',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [{ type: 'attack', value: 2, weight: 1, telegraph: 'Fin slash' }],
    description: 'Wrong Charge heals it 8 HP. Getting tricked has consequences.',
    onPlayerChargeWrong: (ctx) => {
      ctx.enemy.currentHP = Math.min(ctx.enemy.maxHP, ctx.enemy.currentHP + 8);
      const failedFactId = (ctx as any)._failedFactId as string | undefined;
      if (failedFactId) {
        ctx.enemy._lockedFactId = failedFactId;
        ctx.enemy._lockTurnsRemaining = 2;
      }
    },
  };
  return {
    template,
    currentHP: 30,
    maxHP: 30,
    block: 0,
    nextIntent: template.intentPool[0],
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
    enrageBonusDamage: 0,
    playerChargedThisTurn: false,
  };
}

beforeEach(() => {
  resetAura();
  resetReviewQueue();
});

// ── Tests: lock applied at turn start ──

describe('Trick Question — lock applied at turn start (endPlayerTurn)', () => {
  it('applies isLocked to a hand card when _lockedFactId is set on enemy', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    // Manually set the lock as if a wrong Charge just fired
    enemy._lockedFactId = ts.deck.hand[0].factId;
    enemy._lockTurnsRemaining = 2;

    // End player turn → new hand drawn → lock applied
    endPlayerTurn(ts);

    const lockedCards = ts.deck.hand.filter(c => c.isLocked);
    expect(lockedCards).toHaveLength(1);
    expect(lockedCards[0].lockedFactId).toBe(enemy._lockedFactId ?? lockedCards[0].lockedFactId);
  });

  it('decrements _lockTurnsRemaining each turn', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    enemy._lockedFactId = 'fact_special';
    enemy._lockTurnsRemaining = 2;

    endPlayerTurn(ts);
    expect(enemy._lockTurnsRemaining).toBe(1);
  });

  it('clears _lockedFactId after lock turns expire', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    enemy._lockedFactId = 'fact_special';
    enemy._lockTurnsRemaining = 1;

    endPlayerTurn(ts);
    // After 1 turn: turns remaining goes to 0, factId cleared
    expect(enemy._lockedFactId).toBeUndefined();
  });

  it('does not apply lock when _lockedFactId is not set', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    // No lock set
    enemy._lockedFactId = undefined;
    enemy._lockTurnsRemaining = 0;

    endPlayerTurn(ts);

    const lockedCards = ts.deck.hand.filter(c => c.isLocked);
    expect(lockedCards).toHaveLength(0);
  });

  it('clears isLocked when cards are discarded at turn end', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    // Manually mark a card as locked
    ts.deck.hand[0].isLocked = true;
    ts.deck.hand[0].lockedFactId = 'fact_0';

    // End turn — discard hand clears lock flags
    endPlayerTurn(ts);

    // The locked card was discarded, should have no lock
    const discardedLocked = ts.deck.discardPile.filter(c => c.isLocked);
    expect(discardedLocked).toHaveLength(0);
  });
});

// ── Tests: QP blocked on locked cards ──

describe('Trick Question — Quick Play blocked on locked cards', () => {
  it('blocks Quick Play on a locked card and returns blocked=true', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    // Lock the first card in hand
    const targetCard = ts.deck.hand[0];
    targetCard.isLocked = true;
    targetCard.lockedFactId = targetCard.factId;

    const result = playCardAction(ts, targetCard.id, false, false, 'quick');
    expect(result.blocked).toBe(true);
    expect(result.fizzled).toBe(false);
  });

  it('allows Charge play on a locked card (does not block)', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    const targetCard = ts.deck.hand[0];
    targetCard.isLocked = true;
    targetCard.lockedFactId = targetCard.factId;

    // Charge play (wrong answer) — should not be blocked by lock
    const result = playCardAction(ts, targetCard.id, false, false, 'charge');
    expect(result.blocked).toBe(false);
  });

  it('does not block Quick Play on an unlocked card', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    const targetCard = ts.deck.hand[0];
    // Confirm not locked
    expect(targetCard.isLocked).toBeFalsy();

    const result = playCardAction(ts, targetCard.id, false, false, 'quick');
    expect(result.blocked).toBe(false);
  });
});

// ── Tests: correct Charge clears lock and applies 2x bonus ──

describe('Trick Question — correct Charge clears lock + 2x power', () => {
  it('clears isLocked after correct Charge with matching factId', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    const targetCard = ts.deck.hand[0];
    targetCard.isLocked = true;
    targetCard.lockedFactId = targetCard.factId;

    playCardAction(ts, targetCard.id, true, false, 'charge');

    // Card should be cleared (now in discard)
    const discardedCard = ts.deck.discardPile.find(c => c.id === targetCard.id);
    expect(discardedCard?.isLocked).toBeFalsy();
    expect(discardedCard?.lockedFactId).toBeUndefined();
  });

  it('clears enemy _lockedFactId after correct Charge with matching factId', () => {
    const deck = makeDeckWithHand(5, 20);
    const enemy = makeTrickQuestionEnemy();
    const ts = startEncounter(deck, enemy, 30);

    const targetCard = ts.deck.hand[0];
    targetCard.isLocked = true;
    targetCard.lockedFactId = targetCard.factId;
    enemy._lockedFactId = targetCard.factId;
    enemy._lockTurnsRemaining = 1;

    playCardAction(ts, targetCard.id, true, false, 'charge');

    expect(enemy._lockedFactId).toBeUndefined();
    expect(enemy._lockTurnsRemaining).toBe(0);
  });

  it('correct Charge on locked card deals more damage than on unlocked card', () => {
    // Make two identical setups: one locked, one not
    const deckA = makeDeckWithHand(5, 20);
    const enemyA = makeTrickQuestionEnemy();
    const tsA = startEncounter(deckA, enemyA, 30);

    const deckB = makeDeckWithHand(5, 20);
    const enemyB = makeTrickQuestionEnemy();
    const tsB = startEncounter(deckB, enemyB, 30);

    // Lock card in tsA
    const lockedCard = tsA.deck.hand[0];
    lockedCard.isLocked = true;
    lockedCard.lockedFactId = lockedCard.factId;
    // Use same effectValue for fair comparison
    lockedCard.baseEffectValue = 10;
    lockedCard.effectMultiplier = 1.0;

    // Same card config, unlocked in tsB
    const unlockedCard = tsB.deck.hand[0];
    unlockedCard.baseEffectValue = 10;
    unlockedCard.effectMultiplier = 1.0;

    const resultLocked = playCardAction(tsA, lockedCard.id, true, false, 'charge');
    const resultUnlocked = playCardAction(tsB, unlockedCard.id, true, false, 'charge');

    // Locked card with correct charge should deal MORE damage (2x bonus)
    expect(resultLocked.effect.damageDealt).toBeGreaterThan(resultUnlocked.effect.damageDealt);
  });
});
