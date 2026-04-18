/**
 * Tests for drawHand() Hand Composition Guard and Tag Magnet Bias scoping.
 *
 * Regression for: Transmute CC pick draws the wrong card.
 *
 * Root cause: Hand Composition Guard (and Tag Magnet Bias) ran unconditionally
 * after every drawHand() call. When Transmute's CC path pushed the player's
 * chosen card (e.g. a Shield) to the top of the draw pile and called
 * drawHand(deck, 1), the Guard immediately swapped it out with an attack card
 * from deeper in the draw pile, discarding the player's pick.
 *
 * Fix (2026-04-18): Both guards are gated by `count === undefined` so they
 * only run for start-of-turn draws, never for explicit mid-turn draws.
 */

import { describe, it, expect, vi } from 'vitest';
import { drawHand, createDeck } from './deckManager';
import type { Card } from '../data/card-types';

// ---------------------------------------------------------------------------
// Minimal mocks — drawHand reads factsDB and activeRunState
// ---------------------------------------------------------------------------

vi.mock('./factsDB', () => ({
  factsDB: {
    isReady: () => false,
    getById: () => null,
  },
}));

vi.mock('./runStateStore', () => ({
  activeRunState: { subscribe: vi.fn(), set: vi.fn() },
}));

vi.mock('svelte/store', () => ({
  get: () => null,
  writable: () => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() }),
}));

vi.mock('./seededRng', () => ({
  isRunRngActive: () => false,
  getRunRng: () => null,
  seededShuffled: (_rng: unknown, arr: unknown[]) => [...arr],
}));

vi.mock('./domainResolver', () => ({
  resolveDomain: () => 'test',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttack(id: string): Card {
  return {
    id,
    factId: `fact-${id}`,
    cardType: 'attack',
    domain: 'history',
    tier: '1' as const,
    baseEffectValue: 5,
    effectMultiplier: 1.0,
    chainType: 1,
    apCost: 1,
    masteryLevel: 0,
    mechanicId: 'strike',
  };
}

function makeShield(id: string): Card {
  return {
    id,
    factId: `fact-${id}`,
    cardType: 'shield',
    domain: 'history',
    tier: '1' as const,
    baseEffectValue: 3,
    effectMultiplier: 1.0,
    chainType: 1,
    apCost: 1,
    masteryLevel: 0,
    mechanicId: 'block',
  };
}

function makeUtility(id: string): Card {
  return {
    id,
    factId: `fact-${id}`,
    cardType: 'utility',
    domain: 'history',
    tier: '1' as const,
    baseEffectValue: 0,
    effectMultiplier: 1.0,
    chainType: 2,
    apCost: 1,
    masteryLevel: 0,
    mechanicId: 'scout',
  };
}

// ---------------------------------------------------------------------------
// Tests: Hand Composition Guard
// ---------------------------------------------------------------------------

describe('drawHand — Hand Composition Guard', () => {
  it('activates on start-of-turn draw (count=undefined): swaps in attack if none drawn', () => {
    // Draw pile: [shield, shield, shield, attack] (attack is at index 0 = bottom, shields at top)
    // drawPile is a stack — pop() takes from the END. So we place attacks at the start.
    const shieldA = makeShield('s1');
    const shieldB = makeShield('s2');
    const shieldC = makeShield('s3');
    const attackDeep = makeAttack('a1');

    const deck = createDeck([attackDeep, shieldA, shieldB, shieldC]);
    // Force a known draw pile order: shields on top (end of array), attack on bottom (start)
    deck.drawPile = [attackDeep, shieldA, shieldB, shieldC]; // shieldC drawn first, attackDeep is buried

    const drawn = drawHand(deck, undefined); // start-of-turn: no explicit count

    // Guard should have fired and ensured at least one attack is in hand
    const hasAttack = drawn.some(c => c.cardType === 'attack');
    expect(hasAttack).toBe(true);
  });

  it('does NOT activate on mid-turn explicit draw (count=1): non-attack card stays as drawn', () => {
    // Simulate Transmute pick: shield placed on top of draw pile, draw 1
    const shieldPicked = makeShield('transmute-shield');
    const attackInPile = makeAttack('a-in-pile');

    const deck = createDeck([attackInPile, shieldPicked]);
    // Place the chosen shield on top (end of array = top of stack for pop())
    deck.drawPile = [attackInPile, shieldPicked];

    const drawn = drawHand(deck, 1); // explicit count — mid-turn draw

    // Guard must NOT fire — the shield should be the card drawn
    expect(drawn.length).toBe(1);
    expect(drawn[0].id).toBe('transmute-shield');
    expect(drawn[0].cardType).toBe('shield');
  });

  it('does NOT activate on mid-turn explicit draw (count=1): utility card stays as drawn', () => {
    const utilityPicked = makeUtility('transmute-utility');
    const attackInPile = makeAttack('a-in-pile');

    const deck = createDeck([attackInPile, utilityPicked]);
    deck.drawPile = [attackInPile, utilityPicked];

    const drawn = drawHand(deck, 1);

    expect(drawn.length).toBe(1);
    expect(drawn[0].id).toBe('transmute-utility');
    expect(drawn[0].cardType).toBe('utility');
  });

  it('simulates full Transmute pick flow: shield chosen → pushed to draw pile top → drawn into hand intact', () => {
    // Full Transmute CC flow:
    // 1. Player has several cards in draw pile
    // 2. resolveTransmutePick pushes chosen shield to draw pile top
    // 3. UI calls drawHand(deck, 1)
    // 4. Shield must appear in hand without being swapped

    const existingAttack = makeAttack('existing-attack');
    const existingShield = makeShield('existing-shield');
    const chosenTransmutedShield = makeShield('transmuted-shield-chosen');
    // Mark as transmuted (as resolveTransmutePick would do)
    (chosenTransmutedShield as Card & { isTransmuted?: boolean }).isTransmuted = true;

    const deck = createDeck([existingAttack, existingShield]);
    deck.drawPile = [existingAttack, existingShield];

    // Step: resolveTransmutePick pushes chosen card to top of draw pile
    deck.drawPile.push(chosenTransmutedShield); // push = top

    // Step: UI draws 1 card (explicit count)
    const drawn = drawHand(deck, 1);

    expect(drawn.length).toBe(1);
    expect(drawn[0].id).toBe('transmuted-shield-chosen');
    expect(drawn[0].cardType).toBe('shield');
    // The chosen card must be in hand
    expect(deck.hand.some(c => c.id === 'transmuted-shield-chosen')).toBe(true);
    // The attack must still be in the draw pile (not swapped in)
    expect(deck.drawPile.some(c => c.id === 'existing-attack')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Tag Magnet Bias guard
// ---------------------------------------------------------------------------

describe('drawHand — Tag Magnet Bias guard', () => {
  it('does NOT apply tag magnet bias on mid-turn explicit draw', () => {
    // Draw pile top is a chainType=2 card; tag magnet targets chainType=1
    // With 100% chance, the magnet would normally swap it out
    const chainType2Card = { ...makeUtility('u1'), chainType: 2 };
    const chainType1Card = { ...makeAttack('a1'), chainType: 1 };

    const deck = createDeck([chainType1Card, chainType2Card]);
    deck.drawPile = [chainType1Card, chainType2Card]; // chainType2Card on top

    const drawn = drawHand(deck, 1, {
      tagMagnetBias: { chainType: 1, chance: 1.0 }, // 100% swap chance
    });

    // Tag magnet should NOT have fired (explicit count = mid-turn)
    expect(drawn.length).toBe(1);
    expect(drawn[0].chainType).toBe(2); // original top card, not swapped
    expect(drawn[0].id).toBe('u1');
  });

  it('DOES apply tag magnet bias on start-of-turn draw (count=undefined)', () => {
    // Setup: hand already has 4 cards so start-of-turn only draws 1 (HAND_SIZE=5 cap).
    // Draw pile top is chainType=2 card; tag magnet targets chainType=1 with 100% chance.
    // A chainType=1 card sits deeper in the draw pile — the magnet should swap them.
    const chainType2Card = { ...makeUtility('u1'), chainType: 2 };
    const chainType1InPile = { ...makeAttack('a-deep'), chainType: 1 };

    const deck = createDeck([chainType1InPile, chainType2Card]);
    // Pre-fill hand with 4 cards so only 1 will be drawn on start-of-turn
    deck.hand = [makeAttack('h1'), makeAttack('h2'), makeAttack('h3'), makeAttack('h4')];
    // Draw pile: chainType1InPile at index 0 (bottom), chainType2Card at end (top)
    deck.drawPile = [chainType1InPile, chainType2Card];

    const drawn = drawHand(deck, undefined, {
      tagMagnetBias: { chainType: 1, chance: 1.0 },
    });

    // drawHand draws 1 card (HAND_SIZE=5, hand has 4 → draws 1).
    // chainType2Card was on top and drawn. Tag magnet fires with 100% chance,
    // finds chainType1InPile in the draw pile, and swaps them.
    expect(drawn.length).toBe(1);
    expect(drawn[0].chainType).toBe(1);
    expect(drawn[0].id).toBe('a-deep');
    // The chainType2 card should have been put back in the draw pile
    expect(deck.drawPile.some(c => c.id === 'u1')).toBe(true);
  });
});
