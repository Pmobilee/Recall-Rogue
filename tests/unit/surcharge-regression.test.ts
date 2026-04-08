import { describe, it, expect, beforeEach } from 'vitest';
import { isSurgeTurn, getSurgeChargeSurcharge } from '../../src/services/surgeSystem';
import { CHARGE_AP_SURCHARGE } from '../../src/data/balance';
import { initChainSystem, rotateActiveChainColor, getActiveChainColor, resetChain } from '../../src/services/chainSystem';
import { startEncounter, playCardAction } from '../../src/services/turnManager';
import { createDeck, drawHand } from '../../src/services/deckManager';
import type { Card } from '../../src/data/card-types';
import type { EnemyTemplate, EnemyInstance } from '../../src/data/enemies';

/**
 * Surcharge Regression Suite
 *
 * Focused regression tests for the AP surcharge waiver on Surge turns,
 * and the chain-color-match waiver (2026-04-08) which waives the +1 AP surcharge
 * when charging a card that matches the active chain color.
 *
 * Companion to surge-system.test.ts (which covers TurnState integration).
 * This file isolates the pure functions isSurgeTurn() and getSurgeChargeSurcharge()
 * so regressions can be caught without any combat-engine dependencies.
 *
 * Surge schedule: first Surge is turn 2, then every 4 turns (6, 10, 14, ...).
 *
 * NOTE on playCardAction signature:
 *   playCardAction(turnState, cardId, answeredCorrectly, speedBonusEarned, playMode='charge')
 * To play QP:   playCardAction(ts, id, true, false, 'quick')
 * To play CC:   playCardAction(ts, id, true, false, 'charge')
 * To play CW:   playCardAction(ts, id, false, false, 'charge')
 */
describe('Surcharge Regression — getSurgeChargeSurcharge + isSurgeTurn', () => {
  // ── CHARGE_AP_SURCHARGE constant sanity ───────────────────────────

  describe('CHARGE_AP_SURCHARGE constant', () => {
    it('CHARGE_AP_SURCHARGE is 1 (game-conventions baseline)', () => {
      // If this breaks, balance has changed — update game-conventions.md and this comment.
      expect(CHARGE_AP_SURCHARGE).toBe(1);
    });
  });

  // ── getSurgeChargeSurcharge — normal (non-surge) turns ────────────

  describe('getSurgeChargeSurcharge — normal turns return CHARGE_AP_SURCHARGE', () => {
    it('turn 1 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(1)).toBe(CHARGE_AP_SURCHARGE);
    });

    it('turn 3 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(3)).toBe(CHARGE_AP_SURCHARGE);
    });

    it('turn 4 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(4)).toBe(CHARGE_AP_SURCHARGE);
    });

    it('turn 5 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(5)).toBe(CHARGE_AP_SURCHARGE);
    });

    it('turn 7 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(7)).toBe(CHARGE_AP_SURCHARGE);
    });

    it('turn 11 returns CHARGE_AP_SURCHARGE (1)', () => {
      expect(getSurgeChargeSurcharge(11)).toBe(CHARGE_AP_SURCHARGE);
    });
  });

  // ── getSurgeChargeSurcharge — surge turns return 0 ────────────────

  describe('getSurgeChargeSurcharge — surge turns return 0 (surcharge waived)', () => {
    it('turn 2 returns 0 (first Surge turn)', () => {
      expect(getSurgeChargeSurcharge(2)).toBe(0);
    });

    it('turn 6 returns 0 (second Surge turn)', () => {
      expect(getSurgeChargeSurcharge(6)).toBe(0);
    });

    it('turn 10 returns 0 (third Surge turn)', () => {
      expect(getSurgeChargeSurcharge(10)).toBe(0);
    });

    it('turn 14 returns 0 (fourth Surge turn)', () => {
      expect(getSurgeChargeSurcharge(14)).toBe(0);
    });

    it('turn 18 returns 0 (fifth Surge turn: 2 + 4*4)', () => {
      expect(getSurgeChargeSurcharge(18)).toBe(0);
    });
  });

  // ── isSurgeTurn — full schedule turns 1-20 ───────────────────────

  describe('isSurgeTurn — full turn schedule 1–20', () => {
    // Surge turns in range: 2, 6, 10, 14, 18
    const surgeTurns = new Set([2, 6, 10, 14, 18]);

    for (let turn = 1; turn <= 20; turn++) {
      const expected = surgeTurns.has(turn);
      it(`turn ${turn} → isSurgeTurn = ${expected}`, () => {
        expect(isSurgeTurn(turn)).toBe(expected);
      });
    }
  });

  // ── isSurgeTurn — edge cases ──────────────────────────────────────

  describe('isSurgeTurn — edge cases', () => {
    it('turn 0 is NOT a Surge turn', () => {
      expect(isSurgeTurn(0)).toBe(false);
    });

    it('large surge turn (2 + 4*100 = 402) is correctly identified', () => {
      expect(isSurgeTurn(402)).toBe(true);
    });

    it('turn just before a surge (401) is not a Surge turn', () => {
      expect(isSurgeTurn(401)).toBe(false);
    });

    it('turn just after a surge (403) is not a Surge turn', () => {
      expect(isSurgeTurn(403)).toBe(false);
    });
  });

  // ── Consistency: getSurgeChargeSurcharge mirrors isSurgeTurn ─────

  describe('getSurgeChargeSurcharge is consistent with isSurgeTurn for all turns 1-20', () => {
    for (let turn = 1; turn <= 20; turn++) {
      it(`turn ${turn}: surcharge = ${isSurgeTurn(turn) ? 0 : CHARGE_AP_SURCHARGE}`, () => {
        const expectedSurcharge = isSurgeTurn(turn) ? 0 : CHARGE_AP_SURCHARGE;
        expect(getSurgeChargeSurcharge(turn)).toBe(expectedSurcharge);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chain Color Match Waiver (2026-04-08)
// Charging a card whose chainType === getActiveChainColor() waives +1 surcharge.
// Rewards focused chain-building play by making on-color charges free to initiate.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers shared by chain-color waiver tests ────────────────────

function mockCard(overrides?: Partial<Card>): Card {
  return {
    id: `card_test_${Math.random().toString(36).slice(2)}`,
    factId: 'fact_chain_test_1',
    cardType: 'attack',
    domain: 'science',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    apCost: 1,
    ...overrides,
  };
}

function makeCards(chainType: number | undefined, n = 20): Card[] {
  return Array.from({ length: n }, (_, i) =>
    mockCard({ id: `card_chain_${i}`, factId: `fact_chain_${i}`, chainType }),
  );
}

function mockEnemyInstance(): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'test_enemy_chain',
    name: 'Test Enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 40,
    intentPool: [{ type: 'attack', value: 3, weight: 1, telegraph: 'Strike' }],
    description: 'A test enemy for chain-color tests',
  };
  return {
    template,
    currentHP: 40,
    maxHP: 40,
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

describe('Chain Color Match Waiver — surcharge waived when card matches active chain color', () => {
  // Use chain type 2 as the active chain color for all tests.
  // initChainSystem with [2, 2, 2] forces the LCG to always pick index 0 → color 2,
  // giving a deterministic active color without depending on seed arithmetic.
  const CHAIN_COLOR = 2;
  const OFF_COLOR = 3;   // different chain type — off-color for these tests
  const RUN_CHAINS = [CHAIN_COLOR, CHAIN_COLOR, CHAIN_COLOR];
  const SEED = 42;

  beforeEach(() => {
    initChainSystem(RUN_CHAINS, SEED);
    resetChain();
    // Establish the active color for turn 1 (normal, non-surge turn).
    // startEncounter will call rotateActiveChainColor(1) internally, so this
    // beforeEach call just syncs the module state for assertion tests.
    rotateActiveChainColor(1);
  });

  // ── Pure function: getActiveChainColor ──────────────────────────

  it('getActiveChainColor returns the configured chain color after rotate', () => {
    expect(getActiveChainColor()).toBe(CHAIN_COLOR);
  });

  it('getActiveChainColor returns null when chain system is uninitialised', () => {
    initChainSystem([], 0);
    rotateActiveChainColor(1);
    expect(getActiveChainColor()).toBeNull();
    // Restore for other tests
    initChainSystem(RUN_CHAINS, SEED);
    rotateActiveChainColor(1);
  });

  // ── Integration: AP cost in playCardAction on turn 1 (not a surge turn) ──

  it('charging on-color card does NOT add surcharge — AP deducted = base only', () => {
    const cards = makeCards(CHAIN_COLOR);
    const deck = createDeck(cards);
    const enemy = mockEnemyInstance();
    // startEncounter draws the hand and calls rotateActiveChainColor(1) internally.
    // With RUN_CHAINS = [2,2,2], this sets activeChainColor = 2 = CHAIN_COLOR.
    const ts = startEncounter(deck, enemy);

    const card = ts.deck.hand.find(c => c.chainType === CHAIN_COLOR && (c.apCost ?? 1) === 1);
    if (!card) return; // guard: skip if deck setup unexpectedly produced no matching card

    expect(ts.apCurrent).toBe(3); // sanity: 3 AP at turn start
    const apBefore = ts.apCurrent;
    // Charge Correct on an on-color card: base=1, surcharge waived → deduct 1
    // API: playCardAction(turnState, cardId, answeredCorrectly, speedBonusEarned, playMode)
    playCardAction(ts, card.id, true, false, 'charge');

    expect(ts.apCurrent).toBe(apBefore - 1);
  });

  it('charging off-color card DOES add surcharge — AP deducted = base + CHARGE_AP_SURCHARGE', () => {
    const cards = makeCards(OFF_COLOR);
    const deck = createDeck(cards);
    const enemy = mockEnemyInstance();
    // Active color = CHAIN_COLOR (2). Cards have OFF_COLOR (3) → no waiver.
    const ts = startEncounter(deck, enemy);

    const card = ts.deck.hand.find(c => c.chainType === OFF_COLOR && (c.apCost ?? 1) === 1);
    if (!card) return;

    const apBefore = ts.apCurrent;
    // Charge Correct on off-color card: base=1 + surcharge=1 → deduct 2
    playCardAction(ts, card.id, true, false, 'charge');

    expect(ts.apCurrent).toBe(apBefore - 1 - CHARGE_AP_SURCHARGE);
  });

  it('Quick Play is never affected by chain color — no surcharge regardless of match', () => {
    // Even an off-color card played via Quick Play costs only base AP.
    const cards = makeCards(OFF_COLOR);
    const deck = createDeck(cards);
    const enemy = mockEnemyInstance();
    const ts = startEncounter(deck, enemy);

    const card = ts.deck.hand.find(c => (c.apCost ?? 1) === 1);
    if (!card) return;

    const apBefore = ts.apCurrent;
    // Quick Play: base cost only — surcharge never applies to QP
    playCardAction(ts, card.id, true, false, 'quick');

    expect(ts.apCurrent).toBe(apBefore - 1);
  });

  it('card with undefined chainType does NOT get the waiver — surcharge applies', () => {
    // A card with no chainType cannot match the active chain color.
    const cards = makeCards(undefined); // chainType = undefined
    const deck = createDeck(cards);
    const enemy = mockEnemyInstance();
    const ts = startEncounter(deck, enemy);

    // Find a card that has no chainType (undefined/null) and costs 1 AP
    const card = ts.deck.hand.find(c => !c.chainType && (c.apCost ?? 1) === 1);
    if (!card) return;

    const apBefore = ts.apCurrent;
    // Charge on card with no chainType: null != CHAIN_COLOR → surcharge applies
    playCardAction(ts, card.id, true, false, 'charge');

    expect(ts.apCurrent).toBe(apBefore - 1 - CHARGE_AP_SURCHARGE);
  });

  it('chain color waiver is NOT applied when chain system is uninitialised (null active color)', () => {
    // When initChainSystem is called with empty array, getActiveChainColor() returns null.
    // A card with chainType 2 cannot match null → surcharge applies.
    initChainSystem([], 0);
    rotateActiveChainColor(1); // → null

    expect(getActiveChainColor()).toBeNull();

    const cards = makeCards(CHAIN_COLOR); // chainType = 2, but active color is null
    const deck = createDeck(cards);
    const enemy = mockEnemyInstance();
    const ts = startEncounter(deck, enemy);
    // startEncounter calls rotateActiveChainColor internally → still null (no run chains)

    const card = ts.deck.hand.find(c => c.chainType === CHAIN_COLOR && (c.apCost ?? 1) === 1);
    if (!card) return;

    const apBefore = ts.apCurrent;
    // Active chain is null → no color match possible → surcharge applies
    playCardAction(ts, card.id, true, false, 'charge');

    expect(ts.apCurrent).toBe(apBefore - 1 - CHARGE_AP_SURCHARGE);
  });
});
