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

describe('Knowledge Surge System (AR-59.4, updated AR-122 — interval 4, run-persistent)', () => {
  describe('isSurgeTurn formula', () => {
    it('turn 1 is NOT a Surge turn', () => {
      expect(isSurgeTurn(1)).toBe(false);
    });

    it('turn 2 IS a Surge turn (first Surge)', () => {
      expect(isSurgeTurn(2)).toBe(true);
    });

    it('turns 3, 4, 5 are NOT Surge turns', () => {
      expect(isSurgeTurn(3)).toBe(false);
      expect(isSurgeTurn(4)).toBe(false);
      expect(isSurgeTurn(5)).toBe(false);
    });

    it('turn 6 IS a Surge turn (second Surge, interval=4)', () => {
      expect(isSurgeTurn(6)).toBe(true);
    });

    it('turns 7, 8, 9 are NOT Surge turns', () => {
      expect(isSurgeTurn(7)).toBe(false);
      expect(isSurgeTurn(8)).toBe(false);
      expect(isSurgeTurn(9)).toBe(false);
    });

    it('turns 10, 14 ARE Surge turns (every 4th after first)', () => {
      expect(isSurgeTurn(10)).toBe(true);
      expect(isSurgeTurn(14)).toBe(true);
    });

    it('turn 0 is NOT a Surge turn (edge case)', () => {
      expect(isSurgeTurn(0)).toBe(false);
    });

    it('turn 18 IS a Surge turn (2 + 4*4)', () => {
      expect(isSurgeTurn(18)).toBe(true);
    });
  });

  describe('getSurgeChargeSurcharge', () => {
    it('returns 0 during Surge turns (free Charging)', () => {
      expect(getSurgeChargeSurcharge(2)).toBe(0);
      expect(getSurgeChargeSurcharge(6)).toBe(0);
      expect(getSurgeChargeSurcharge(10)).toBe(0);
      expect(getSurgeChargeSurcharge(14)).toBe(0);
    });

    it('returns 0 during normal turns (CHARGE_AP_SURCHARGE = 0 globally, surcharge removed)', () => {
      expect(getSurgeChargeSurcharge(1)).toBe(0);
      expect(getSurgeChargeSurcharge(3)).toBe(0);
      expect(getSurgeChargeSurcharge(4)).toBe(0);
      expect(getSurgeChargeSurcharge(5)).toBe(0);
      expect(getSurgeChargeSurcharge(7)).toBe(0);
    });
  });

  describe('TurnState.isSurge', () => {
    it('starts false at encounter start (turn 1, no globalTurnCounter passed)', () => {
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

    it('is false on turns 3, 4, 5', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      endPlayerTurn(ts); // turn 1 → 2 (Surge)
      endPlayerTurn(ts); // turn 2 → 3 (normal)
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(3);
      endPlayerTurn(ts); // → 4
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(4);
      endPlayerTurn(ts); // → 5
      expect(ts.isSurge).toBe(false);
      expect(ts.turnNumber).toBe(5);
    });

    it('is true at turn 6 (second Surge, interval=4)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      for (let i = 0; i < 5; i++) endPlayerTurn(ts); // advance to turn 6
      expect(ts.isSurge).toBe(true);
      expect(ts.turnNumber).toBe(6);
    });

    it('is true at turn 10 (third Surge)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy);
      for (let i = 0; i < 9; i++) endPlayerTurn(ts); // advance to turn 10
      expect(ts.isSurge).toBe(true);
      expect(ts.turnNumber).toBe(10);
    });

    it('starts on correct global turn when globalTurnCounter is passed (persistence)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      // Simulate: previous encounter ended on global turn 5, so this encounter starts on turn 5
      const ts = startEncounter(deck, enemy, undefined, 5);
      expect(ts.turnNumber).toBe(5);
      expect(ts.encounterTurnNumber).toBe(1);
      expect(ts.isSurge).toBe(false); // turn 5 is not a Surge turn
      // Advance one turn → global turn 6 → Surge!
      endPlayerTurn(ts);
      expect(ts.turnNumber).toBe(6);
      expect(ts.encounterTurnNumber).toBe(2);
      expect(ts.isSurge).toBe(true);
    });

    it('new encounter resets encounterTurnNumber to 1 regardless of globalTurnCounter', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy, undefined, 10);
      expect(ts.encounterTurnNumber).toBe(1);
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

    it('Charge costs base AP only during normal turns (CHARGE_AP_SURCHARGE = 0)', () => {
      const deck = makeDeckWithHand();
      const enemy = mockEnemyInstance();
      const ts = startEncounter(deck, enemy); // turn 1 = normal

      const card = ts.deck.hand.find(c => c.tier !== '3' && (c.apCost ?? 1) === 1);
      if (!card) return;

      const apBefore = ts.apCurrent;
      playCardAction(ts, card.id, 'charge', true);
      // Base cost = 1, no surcharge (CHARGE_AP_SURCHARGE = 0) → spend 1 AP
      expect(ts.apCurrent).toBe(apBefore - 1);
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
