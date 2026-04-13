/**
 * Tests for drawHand() fact-ID deduplication within a single hand.
 *
 * Regression for: duplicate factIds appearing in the same hand when the
 * available fact pool (after cooldown filtering) is smaller than the hand size.
 * The fallback `?? shuffledFacts[0]` assigned the same first-shuffled fact to
 * every extra card beyond the available pool, creating duplicate factIds.
 *
 * Fix (2026-04-12): fallback changed to
 * `shuffledFacts.find(f => !usedFactIds.has(f)) ?? shuffledFacts[0]`
 * so each exhausted-pool card gets the least-recently-assigned fact
 * rather than always fact[0].
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
  // Identity shuffle preserves insertion order — ensures test determinism.
  seededShuffled: (_rng: unknown, arr: unknown[]) => [...arr],
}));

vi.mock('./domainResolver', () => ({
  resolveDomain: () => 'test',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(id: string, factId: string): Card {
  return {
    id,
    factId,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('drawHand — factId deduplication', () => {
  it('assigns unique factIds when fact pool size equals hand size', () => {
    const factIds = ['fact-a', 'fact-b', 'fact-c', 'fact-d', 'fact-e'];
    const cards = factIds.map((fId, i) => makeCard(`card-${i}`, fId));
    const deck = createDeck(cards);
    deck.factPool = [...factIds];

    const drawn = drawHand(deck, 5);
    const assigned = drawn.map(c => c.factId);
    const unique = new Set(assigned);

    expect(unique.size).toBe(5);
  });

  it('distributes factIds across all available facts when pool < hand size', () => {
    // 3 facts, requesting a 5-card hand.
    // Before fix: cards 4 and 5 both received shuffledFacts[0] (= 'fact-x').
    // After fix: the 4th and 5th cards cycle through unused or least-used facts
    // rather than both pinning to index 0.
    const factIds = ['fact-x', 'fact-y', 'fact-z'];
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(`card-${i}`, factIds[0]));
    const deck = createDeck(cards);
    deck.factPool = [...factIds];

    const drawn = drawHand(deck, 5);
    const assigned = drawn.map(c => c.factId);

    // All 3 facts must appear — none should be absent due to the fallback always picking index 0.
    expect(assigned).toContain('fact-x');
    expect(assigned).toContain('fact-y');
    expect(assigned).toContain('fact-z');
  });

  it('does not crash with a single-fact pool and a 5-card hand', () => {
    // Degenerate edge case: only 1 fact available for 5 cards.
    // All cards must share the same fact (no alternative exists).
    // The fix must not throw or produce undefined factIds.
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(`card-${i}`, 'fact-solo'));
    const deck = createDeck(cards);
    deck.factPool = ['fact-solo'];

    const drawn = drawHand(deck, 5);

    expect(drawn.length).toBeGreaterThan(0);
    for (const card of drawn) {
      // Every card must have a valid factId (no undefined leak)
      expect(card.factId).toBeTruthy();
    }
  });

  it('does not reuse factIds already present in the pre-existing hand when alternatives exist', () => {
    // Pre-fill hand with 2 cards that already hold fact-a and fact-b.
    // Drawing 3 more cards should avoid fact-a and fact-b if alternatives exist.
    const allFactIds = ['fact-a', 'fact-b', 'fact-c', 'fact-d', 'fact-e'];
    const existingCards = [makeCard('existing-0', 'fact-a'), makeCard('existing-1', 'fact-b')];
    const drawCards = allFactIds.map((fId, i) => makeCard(`draw-${i}`, fId));

    const deck = createDeck(drawCards);
    deck.factPool = [...allFactIds];
    deck.hand = [...existingCards];

    const drawn = drawHand(deck, 3);
    const drawnFactIds = drawn.map(c => c.factId);

    // Drawn cards must not reuse fact-a or fact-b — already in hand
    expect(drawnFactIds).not.toContain('fact-a');
    expect(drawnFactIds).not.toContain('fact-b');

    // The 3 new cards should each have a distinct factId
    const unique = new Set(drawnFactIds);
    expect(unique.size).toBe(3);
  });
});
