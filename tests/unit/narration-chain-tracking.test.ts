/**
 * narration-chain-tracking.test.ts
 *
 * Tests the chain-tracking additions to TurnState as part of the narration-fact
 * integration fix:
 * - TurnState.currentChainAnswerFactIds — per-chain working buffer
 * - TurnState.completedChainSequences  — sequences of 3+ consecutive correct factIds
 *
 * Flushing rules:
 * - On wrong charge (any colour): if buffer length ≥ 3, push copy to completedChainSequences; reset buffer.
 * - On Quick Play: same flush logic.
 * - Chains of 1-2 that break do NOT flush (below threshold).
 *
 * Note on AR-93 (per-draw fact shuffling): drawHand reassigns factIds from factPool.
 * Tests that check specific factIds must either read back the assigned factId from the
 * drawn card, or use a controlled factPool. This test reads factIds back from the hand
 * after setup, ensuring assertions match actual assigned values.
 *
 * Design spec: docs/mechanics/narrative.md §Thread 2 "The Echo Chamber"
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, CardRunState } from '../../src/data/card-types';
import type { EnemyTemplate } from '../../src/data/enemies';
import { createEnemy } from '../../src/services/enemyManager';
import { createDeck } from '../../src/services/deckManager';
import {
  startEncounter,
  playCardAction,
  resetFactLastSeenEncounter,
} from '../../src/services/turnManager';
import { resetAura } from '../../src/services/knowledgeAuraSystem';
import { resetReviewQueue } from '../../src/services/reviewQueueSystem';

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeEnemyTemplate(overrides?: Partial<EnemyTemplate>): EnemyTemplate {
  return {
    id: 'chain_test_enemy',
    name: 'Chain Test Enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 1000, // high HP so it never dies mid-test
    intentPool: [{ type: 'attack', value: 1, weight: 1, telegraph: 'Strike' }],
    description: 'Test enemy for chain tracking tests.',
    ...overrides,
  };
}

function makeCard(overrides?: Partial<Card>): Card {
  return {
    id: 'card_1',
    factId: 'fact_1',
    cardType: 'attack',
    domain: 'history',
    tier: '1',
    baseEffectValue: 2, // low damage so enemy survives many hits
    effectMultiplier: 1.0,
    chainType: 0,        // all same chainType so chain builds
    apCost: 1,
    ...overrides,
  };
}

/**
 * Set up an encounter with a controlled hand.
 *
 * AR-93: drawHand reassigns factIds from deck.factPool on every draw.
 * To test chain tracking with known factIds, we:
 * 1. Create cards with unique IDs
 * 2. Set factPool to contain ONLY the test card factIds in the desired order
 * 3. After startEncounter, replace the hand with exactly our test cards (in hand order)
 * 4. Read the ACTUAL factIds from the hand cards (after AR-93 reassignment)
 *
 * Returns: { ts, handCards } where handCards are the actual cards in hand with
 * their AR-93-assigned factIds.
 */
function setupEncounterWithHand(handCards: Card[]): { ts: ReturnType<typeof startEncounter>, handCards: Card[] } {
  // factPool contains only the factIds we care about — AR-93 will pick from these
  // Padding is needed to fill the drawPile so startEncounter doesn't crash
  const padding: Card[] = Array.from({ length: 20 }, (_, i) =>
    makeCard({ id: `pad_${i}`, factId: `pad_${i}`, baseEffectValue: 1 })
  );
  const deck: CardRunState = createDeck([...handCards, ...padding]);
  // Override factPool to only contain the test card factIds
  // This ensures AR-93 reassigns only our factIds (in pool order)
  deck.factPool = handCards.map(c => c.factId);

  const enemy = createEnemy(makeEnemyTemplate(), 1);
  const ts = startEncounter(deck, enemy);

  // Replace the drawn hand with exactly our hand cards, and read back their assigned factIds
  // (AR-93 reassigned the factIds during drawHand — we accept whatever was assigned)
  ts.deck.drawPile.unshift(...ts.deck.hand.splice(0));
  for (const card of handCards) {
    const di = ts.deck.drawPile.findIndex(c => c.id === card.id);
    if (di !== -1) {
      ts.deck.hand.push(...ts.deck.drawPile.splice(di, 1));
    }
  }

  ts.apCurrent = 50; // unlimited AP
  // Return the actual card objects in hand (which have AR-93-assigned factIds)
  const actualHandCards = handCards.map(hc => ts.deck.hand.find(c => c.id === hc.id)!).filter(Boolean);
  return { ts, handCards: actualHandCards };
}

// ─── Reset shared state before each test ──────────────────────────────────────
beforeEach(() => {
  resetAura();
  resetReviewQueue();
  resetFactLastSeenEncounter();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Initial encounter state
// ════════════════════════════════════════════════════════════════════════════════

describe('initial encounter state', () => {
  it('both chain tracking arrays are empty at encounter start', () => {
    const card = makeCard({ id: 'c1', factId: 'f1' });
    const { ts } = setupEncounterWithHand([card]);

    expect(ts.currentChainAnswerFactIds).toEqual([]);
    expect(ts.completedChainSequences).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. Chain buffer accumulates factIds on consecutive correct charges
// ════════════════════════════════════════════════════════════════════════════════

describe('currentChainAnswerFactIds accumulates on correct charge', () => {
  it('accumulates one factId after a single correct charge', () => {
    const { ts, handCards } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'fact-alpha', chainType: 0 }),
    ]);
    const [card1] = handCards;
    // Read the actual assigned factId (AR-93 may have changed it)
    const assignedFactId = card1.factId;

    playCardAction(ts, 'c1', true, false, 'charge');
    expect(ts.currentChainAnswerFactIds).toHaveLength(1);
    expect(ts.currentChainAnswerFactIds[0]).toBe(assignedFactId);
  });

  it('accumulates 3 factIds after 3 consecutive correct charges', () => {
    const { ts, handCards } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'fact-alpha', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'fact-beta', chainType: 0 }),
      makeCard({ id: 'c3', factId: 'fact-gamma', chainType: 0 }),
    ]);
    const [c1, c2, c3] = handCards;

    playCardAction(ts, 'c1', true, false, 'charge');
    expect(ts.currentChainAnswerFactIds).toHaveLength(1);
    expect(ts.currentChainAnswerFactIds[0]).toBe(c1.factId);

    playCardAction(ts, 'c2', true, false, 'charge');
    expect(ts.currentChainAnswerFactIds).toHaveLength(2);
    expect(ts.currentChainAnswerFactIds[1]).toBe(c2.factId);

    playCardAction(ts, 'c3', true, false, 'charge');
    expect(ts.currentChainAnswerFactIds).toHaveLength(3);
    expect(ts.currentChainAnswerFactIds[2]).toBe(c3.factId);

    // Verify order is preserved
    expect(ts.currentChainAnswerFactIds).toEqual([c1.factId, c2.factId, c3.factId]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. Chain break on wrong charge: flushes if ≥ 3, resets buffer
// ════════════════════════════════════════════════════════════════════════════════

describe('chain break on wrong charge', () => {
  it('flushes a 3-card chain to completedChainSequences on wrong charge', () => {
    const { ts, handCards } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'f2', chainType: 0 }),
      makeCard({ id: 'c3', factId: 'f3', chainType: 0 }),
      makeCard({ id: 'cBad', factId: 'f-bad', chainType: 0 }),
    ]);
    const [c1, c2, c3] = handCards;

    // Build chain of 3
    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'c2', true, false, 'charge');
    playCardAction(ts, 'c3', true, false, 'charge');

    expect(ts.completedChainSequences).toHaveLength(0);

    // Wrong answer breaks the chain — must flush to completedChainSequences
    playCardAction(ts, 'cBad', false, false, 'charge');

    expect(ts.completedChainSequences).toHaveLength(1);
    expect(ts.completedChainSequences[0]).toEqual([c1.factId, c2.factId, c3.factId]);

    // Buffer reset after flush
    expect(ts.currentChainAnswerFactIds).toEqual([]);
  });

  it('does NOT flush a chain of 2 on wrong charge (below threshold)', () => {
    const { ts } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'f2', chainType: 0 }),
      makeCard({ id: 'cBad', factId: 'f-bad', chainType: 0 }),
    ]);

    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'c2', true, false, 'charge');
    // Chain of 2 — below threshold of 3
    playCardAction(ts, 'cBad', false, false, 'charge');

    expect(ts.completedChainSequences).toHaveLength(0);
    expect(ts.currentChainAnswerFactIds).toEqual([]);
  });

  it('does NOT flush a chain of 1 on wrong charge', () => {
    const { ts } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'cBad', factId: 'f-bad', chainType: 0 }),
    ]);

    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'cBad', false, false, 'charge');

    expect(ts.completedChainSequences).toHaveLength(0);
    expect(ts.currentChainAnswerFactIds).toEqual([]);
  });

  it('captures multiple chain completions in a single encounter', () => {
    const { ts, handCards } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'f2', chainType: 0 }),
      makeCard({ id: 'c3', factId: 'f3', chainType: 0 }),
      makeCard({ id: 'cBad1', factId: 'f-bad1', chainType: 0 }),
      makeCard({ id: 'c4', factId: 'f4', chainType: 0 }),
      makeCard({ id: 'c5', factId: 'f5', chainType: 0 }),
      makeCard({ id: 'c6', factId: 'f6', chainType: 0 }),
      makeCard({ id: 'cBad2', factId: 'f-bad2', chainType: 0 }),
    ]);
    const [c1, c2, c3, _bad1, c4, c5, c6] = handCards;

    // First chain of 3
    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'c2', true, false, 'charge');
    playCardAction(ts, 'c3', true, false, 'charge');
    playCardAction(ts, 'cBad1', false, false, 'charge'); // breaks, flushes

    expect(ts.completedChainSequences).toHaveLength(1);
    expect(ts.completedChainSequences[0]).toEqual([c1.factId, c2.factId, c3.factId]);

    // Second chain of 3
    playCardAction(ts, 'c4', true, false, 'charge');
    playCardAction(ts, 'c5', true, false, 'charge');
    playCardAction(ts, 'c6', true, false, 'charge');
    playCardAction(ts, 'cBad2', false, false, 'charge'); // breaks, flushes

    expect(ts.completedChainSequences).toHaveLength(2);
    expect(ts.completedChainSequences[1]).toEqual([c4.factId, c5.factId, c6.factId]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. Quick Play breaks chain and flushes if ≥ 3
// ════════════════════════════════════════════════════════════════════════════════

describe('Quick Play breaks chain', () => {
  it('flushes a 3-card chain to completedChainSequences on Quick Play', () => {
    const { ts, handCards } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'f2', chainType: 0 }),
      makeCard({ id: 'c3', factId: 'f3', chainType: 0 }),
      makeCard({ id: 'cQP', factId: 'f-qp', chainType: 0 }),
    ]);
    const [c1, c2, c3] = handCards;

    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'c2', true, false, 'charge');
    playCardAction(ts, 'c3', true, false, 'charge');

    expect(ts.completedChainSequences).toHaveLength(0);

    // Quick Play — breaks chain, should flush the 3-card buffer
    playCardAction(ts, 'cQP', true, false, 'quick_play');

    expect(ts.completedChainSequences).toHaveLength(1);
    expect(ts.completedChainSequences[0]).toEqual([c1.factId, c2.factId, c3.factId]);
    expect(ts.currentChainAnswerFactIds).toEqual([]);
  });

  it('does NOT flush a chain of 2 on Quick Play', () => {
    const { ts } = setupEncounterWithHand([
      makeCard({ id: 'c1', factId: 'f1', chainType: 0 }),
      makeCard({ id: 'c2', factId: 'f2', chainType: 0 }),
      makeCard({ id: 'cQP', factId: 'f-qp', chainType: 0 }),
    ]);

    playCardAction(ts, 'c1', true, false, 'charge');
    playCardAction(ts, 'c2', true, false, 'charge');
    playCardAction(ts, 'cQP', true, false, 'quick_play');

    expect(ts.completedChainSequences).toHaveLength(0);
    expect(ts.currentChainAnswerFactIds).toEqual([]);
  });
});
