import { describe, it, expect } from 'vitest';
import type { Card } from '../../src/data/card-types';
import { isSurgeTurn, getSurgeChargeSurcharge } from '../../src/services/surgeSystem';
import { startEncounter, endPlayerTurn, playCardAction } from '../../src/services/turnManager';
import { createDeck, drawHand } from '../../src/services/deckManager';
import type { EnemyTemplate, EnemyInstance } from '../../src/data/enemies';

// ── Test helpers ──

function mockCard(overrides?: Partial<Card>): Card {
  return {
    id: `card_test_${Math.random().toString(36).slice(2)}`,
    factId: 'fact_1',
    cardType: 'attack',
    domain: 'science',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    apCost: 1,
    ...overrides,
  };
}

function makeCards(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => mockCard({ id: `card_${i}`, factId: `fact_${i}` }));
}

function makeDeckWithHand(handSize = 5, totalCards = 20) {
  const cards = makeCards(totalCards);
  const deck = createDeck(cards);
  drawHand(deck, handSize);
  return deck;
}

function mockEnemyTemplate(): EnemyTemplate {
  return {
    id: 'test_enemy',
    name: 'Test Enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 40,
    intentPool: [{ type: 'attack', value: 3, weight: 1, telegraph: 'Strike' }],
    description: 'A test enemy',
  };
}

function mockEnemyInstance(): EnemyInstance {
  const template = mockEnemyTemplate();
  return {
    template,
    currentHP: template.baseHP,
    maxHP: template.baseHP,
    nextIntent: template.intentPool[0],
    block: 0,
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
  };
}

// ── Tests ──

describe('Knowledge Surge System (AR-59.4)', () => {
  describe('isSurgeTurn formula', () => {
    it('turn 1 is NOT a Surge turn', () => {
      expect(isSurgeTurn(1)).toBe(false);
    });

    it('turn 2 IS a Surge turn (first Surge)', () => {
      expect(isSurgeTurn(2)).toBe(true);
    });

    it('turns 3 and 4 are NOT Surge turns', () => {
      expect(isSurgeTurn(3)).toBe(false);
      expect(isSurgeTurn(4)).toBe(false);
    });

    it('turn 5 IS a Surge turn (second Surge)', () => {
      expect(isSurgeTurn(5)).toBe(true);
    });

    it('turns 6 and 7 are NOT Surge turns', () => {
      expect(isSurgeTurn(6)).toBe(false);
      expect(isSurgeTurn(7)).toBe(false);
    });

    it('turns 8, 11, 14 ARE Surge turns', () => {
      expect(isSurgeTurn(8)).toBe(true);
      expect(isSurgeTurn(11)).toBe(true);
      expect(isSurgeTurn(14)).toBe(true);
    });

    it('turn 0 is NOT a Surge turn (edge case)', () => {
      expect(isSurgeTurn(0)).toBe(false);
    });

    it('turn 17 IS a Surge turn', () => {
      expect(isSurgeTurn(17)).toBe(true);
    });
  });

  describe('getSurgeChargeSurcharge', () => {
    it('returns 0 during Surge turns (free Charging)', () => {
      expect(getSurgeChargeSurcharge(2)).toBe(0);
      expect(getSurgeChargeSurcharge(5)).toBe(0);
      expect(getSurgeChargeSurcharge(8)).toBe(0);
      expect(getSurgeChargeSurcharge(11)).toBe(0);
    });

    it('returns 1 during normal turns (standard surcharge)', () => {
      expect(getSurgeChargeSurcharge(1)).toBe(1);
      expect(getSurgeChargeSurcharge(3)).toBe(1);
      expect(getSurgeChargeSurcharge(4)).toBe(1);
      expect(getSurgeChargeSurcharge(6)).toBe(1);
      expect(getSurgeChargeSurcharge(7)).toBe(1);
    });
  });

  describe('TurnState.isSurge', () => {
    it('starts false at encounter start (turn 1)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(1);
    });

    it('is true after first endPlayerTurn (advancing to turn 2)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      const result = endPlayerTurn(ts);
      expect(result.turnState.isSurge).toBe(true);
      expect(result.turnState.turnNumber).toBe(2);
    });

    it('is false on turn 3', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      endPlayerTurn(ts); // turn 1 → 2 (Surge)
      endPlayerTurn(ts); // turn 2 → 3 (normal)
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(3);
    });

    it('is false on turn 4', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      endPlayerTurn(ts); // → 2
      endPlayerTurn(ts); // → 3
      endPlayerTurn(ts); // → 4
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(4);
    });

    it('is true at turn 5 (second Surge)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      for (let i = 0; i < 4; i++) endPlayerTurn(ts); // advance to turn 5
      expect(ts.isSurge).toBe(true);
      expect(ts.turnNumber).toBe(5);
    });

    it('is true at turn 8 (third Surge)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      for (let i = 0; i < 7; i++) endPlayerTurn(ts); // advance to turn 8
      expect(ts.isSurge).toBe(true);
      expect(ts.turnNumber).toBe(8);
    });

    it('resets on new encounter (new startEncounter → isSurge=false, turn 1)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      expect(ts.isSurge).toBe(false); // turn 1 = no Surge
      expect(ts.turnNumber).toBe(1);
    });
  });

  describe('Charge AP cost during Surge', () => {
    it('Charge costs only base AP (no +1 surcharge) during Surge turn', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);

      // Advance to turn 2 (Surge turn)
      endPlayerTurn(ts);
      expect(ts.isSurge).toBe(true);

      const card = ts.deck.hand.find(c => c.tier !== '3' && (c.apCost ?? 1) === 1);
      if (!card) return; // skip if no 1-AP non-T3 card

      const apBefore = ts.apCurrent;
      playCardAction(ts, card.id, 'charge', true);
      // Base cost = 1, no surcharge during Surge → spend 1 AP
      expect(ts.apCurrent).toBe(apBefore - 1);
    });

    it('Charge costs +1 AP surcharge during normal turns', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy); // turn 1 = normal

      const card = ts.deck.hand.find(c => c.tier !== '3' && (c.apCost ?? 1) === 1);
      if (!card) return;

      const apBefore = ts.apCurrent;
      playCardAction(ts, card.id, 'charge', true);
      // Base cost = 1 + surcharge 1 = 2 AP spent
      expect(ts.apCurrent).toBe(apBefore - 2);
    });

    it('Quick Play AP cost is unaffected by Surge (no surcharge either way)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);

      // Advance to turn 2 (Surge turn)
      endPlayerTurn(ts);
      expect(ts.isSurge).toBe(true);

      const card = ts.deck.hand.find(c => c.tier !== '3' && (c.apCost ?? 1) === 1);
      if (!card) return;

      const apBefore = ts.apCurrent;
      playCardAction(ts, card.id, 'quick', true);
      // Quick Play: base cost only, never has surcharge
      expect(ts.apCurrent).toBe(apBefore - 1);
    });
  });
});
