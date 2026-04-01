import { describe, it, expect, beforeEach } from 'vitest';
import { resolveDomain, resolveCardType } from '../../src/services/domainResolver';
import { createCard, computeTier, resetCardIdCounter } from '../../src/services/cardFactory';
import { createDeck, drawHand, playCard, discardCard, exhaustCard, reshuffleDiscard, getDeckStats } from '../../src/services/deckManager';
import { HAND_SIZE } from '../../src/data/balance';
import type { Fact, ReviewState } from '../../src/data/types';
import type { Card, CardType, FactDomain } from '../../src/data/card-types';

// ── Helpers ──

/** Creates a minimal Fact stub for testing. */
function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: overrides.id ?? 'test-fact-1',
    type: 'fact',
    statement: 'Test statement',
    explanation: 'Test explanation',
    quizQuestion: 'What is test?',
    correctAnswer: 'Test',
    distractors: ['A', 'B', 'C'],
    category: overrides.category ?? ['Natural Sciences', 'Chemistry'],
    rarity: 'common',
    difficulty: overrides.difficulty ?? 3,
    funScore: 5,
    ageRating: 'adult',
    ...overrides,
  } as Fact;
}

/** Creates a ReviewState stub. */
function makeReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    factId: overrides.factId ?? 'test-fact-1',
    cardState: 'review',
    easeFactor: overrides.easeFactor ?? 2.5,
    interval: overrides.interval ?? 1,
    repetitions: overrides.repetitions ?? 1,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 3,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    ...overrides,
  };
}

/** Creates N cards with unique IDs for deck testing. */
function makeCards(n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card_${i + 1}`,
    factId: `fact_${i + 1}`,
    cardType: 'attack' as const,
    domain: 'natural_sciences' as FactDomain,
    tier: '1' as const,
    baseEffectValue: 8,
    effectMultiplier: 1.0,
  }));
}

// ── Tests ──

describe('domainResolver', () => {
  describe('resolveDomain', () => {
    it('maps "Natural Sciences" to natural_sciences', () => {
      expect(resolveDomain(makeFact({ id: 'dr-1', category: ['Natural Sciences', 'Chemistry'] }))).toBe('natural_sciences');
    });

    it('maps "History" to history', () => {
      expect(resolveDomain(makeFact({ id: 'dr-2', category: ['History', 'Ancient Rome'] }))).toBe('history');
    });

    it('maps "Language" to language', () => {
      expect(resolveDomain(makeFact({ id: 'dr-3', category: ['Language', 'Japanese', 'N3'] }))).toBe('language');
    });

    it('maps "Life Sciences" to human_body_health', () => {
      expect(resolveDomain(makeFact({ id: 'dr-4', category: ['Life Sciences', 'Biology'] }))).toBe('human_body_health');
    });

    it('maps "Culture" to art_architecture', () => {
      expect(resolveDomain(makeFact({ id: 'dr-5', category: ['Culture', 'Music'] }))).toBe('art_architecture');
    });

    it('maps "Technology" to general_knowledge', () => {
      expect(resolveDomain(makeFact({ id: 'dr-6', category: ['Technology', 'AI'] }))).toBe('general_knowledge');
    });

    it('maps "Geography" to geography', () => {
      expect(resolveDomain(makeFact({ id: 'dr-7', category: ['Geography', 'Europe'] }))).toBe('geography');
    });

    it('falls back to general_knowledge for unknown categories', () => {
      expect(resolveDomain(makeFact({ id: 'dr-8', category: ['Unknown'] }))).toBe('general_knowledge');
    });
  });

  describe('resolveCardType', () => {
    it('returns a deterministic type for the same domain input', () => {
      expect(resolveCardType('natural_sciences')).toBe(resolveCardType('natural_sciences'));
    });

    it('returns a valid card type', () => {
      const allTypes: CardType[] = ['attack', 'shield', 'utility', 'buff', 'debuff', 'wild'];
      expect(allTypes).toContain(resolveCardType('history'));
    });
  });
});

describe('cardFactory', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  describe('computeTier', () => {
    it('returns tier 1 when no review state', () => {
      expect(computeTier(undefined)).toBe('1');
    });

    it('returns tier 1 for new/learning cards', () => {
      expect(computeTier(makeReviewState({ stability: 1, consecutiveCorrect: 1 }))).toBe('1');
    });

    it('returns tier 2a at first mastery threshold', () => {
      expect(computeTier(makeReviewState({ stability: 3, consecutiveCorrect: 2 }))).toBe('2a');
    });

    it('returns tier 2b before mastery trial pass', () => {
      expect(computeTier(makeReviewState({ stability: 15, consecutiveCorrect: 5 }))).toBe('2b');
    });

    it('returns tier 3 only after mastery trial flag is set', () => {
      const state = makeReviewState({
        stability: 30,
        consecutiveCorrect: 7,
        passedMasteryTrial: true,
      });
      expect(computeTier(state)).toBe('3');
    });

    // --- New boundary tests for relaxed thresholds ---
    it('returns tier 2a at exact new boundary (stability=2, consecutive=2)', () => {
      expect(computeTier(makeReviewState({ stability: 2, consecutiveCorrect: 2 }))).toBe('2a');
    });

    it('returns tier 1 just below tier 2a boundary', () => {
      expect(computeTier(makeReviewState({ stability: 1, consecutiveCorrect: 2 }))).toBe('1');
      expect(computeTier(makeReviewState({ stability: 2, consecutiveCorrect: 1 }))).toBe('1');
    });

    it('returns tier 2b at exact new boundary (stability=5, consecutive=3)', () => {
      expect(computeTier(makeReviewState({ stability: 5, consecutiveCorrect: 3 }))).toBe('2b');
    });

    it('returns tier 2a just below tier 2b boundary', () => {
      expect(computeTier(makeReviewState({ stability: 4, consecutiveCorrect: 3 }))).toBe('2a');
      expect(computeTier(makeReviewState({ stability: 5, consecutiveCorrect: 2 }))).toBe('2a');
    });

    it('returns tier 3 at exact new boundary (stability=10, consecutive=4, masteryTrial=true)', () => {
      expect(computeTier(makeReviewState({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true }))).toBe('3');
    });

    it('returns tier 2b just below tier 3 boundary', () => {
      expect(computeTier(makeReviewState({ stability: 9, consecutiveCorrect: 4, passedMasteryTrial: true }))).toBe('2b');
      expect(computeTier(makeReviewState({ stability: 10, consecutiveCorrect: 3, passedMasteryTrial: true }))).toBe('2b');
    });
  });

  describe('effectMultiplier (tier-based)', () => {
    it('tier 1 card has effectMultiplier 1.0', () => {
      const card = createCard(makeFact({ category: ['Natural Sciences'] }), undefined, 'attack');
      expect(card.effectMultiplier).toBe(1.0);
    });

    it('tier 2a card has effectMultiplier 1.3', () => {
      const card = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ stability: 2, consecutiveCorrect: 2 }),
        'attack',
      );
      expect(card.effectMultiplier).toBe(1.3);
    });

    it('tier 2b card has effectMultiplier 1.6', () => {
      const card = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ stability: 5, consecutiveCorrect: 3 }),
        'attack',
      );
      expect(card.effectMultiplier).toBe(1.6);
    });

    it('tier 3 card has effectMultiplier 1.6', () => {
      const card = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true }),
        'attack',
      );
      expect(card.effectMultiplier).toBe(1.6);
    });
  });

  describe('createCard', () => {
    it('creates a card with domain derived from fact and explicit combat type', () => {
      const card = createCard(makeFact({ category: ['Natural Sciences'] }), undefined, 'attack');
      expect(card.domain).toBe('natural_sciences');
      expect(card.cardType).toBe('attack');
      expect(card.tier).toBe('1');
      expect(card.effectMultiplier).toBe(1.0);
    });

    it('assigns unique IDs to each card', () => {
      const card1 = createCard(makeFact(), undefined);
      const card2 = createCard(makeFact(), undefined);
      expect(card1.id).not.toBe(card2.id);
    });

    it('keeps baseEffectValue independent of tier and marks mastery trials', () => {
      const t1 = createCard(makeFact({ category: ['Natural Sciences'] }), undefined, 'attack');
      expect(t1.baseEffectValue).toBe(4);
      expect(t1.tier).toBe('1');

      resetCardIdCounter();
      const t2bTrial = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ stability: 30, consecutiveCorrect: 7, passedMasteryTrial: false }),
        'attack',
      );
      expect(t2bTrial.baseEffectValue).toBe(4);
      expect(t2bTrial.tier).toBe('2b');
      expect(t2bTrial.isMasteryTrial).toBe(true);

      resetCardIdCounter();
      const t3 = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ stability: 30, consecutiveCorrect: 7, passedMasteryTrial: true }),
        'attack',
      );
      expect(t3.baseEffectValue).toBe(4);
      expect(t3.tier).toBe('3');
      expect(t3.isMasteryTrial).toBe(false);
    });

    it('links factId correctly', () => {
      const card = createCard(makeFact({ id: 'my-fact-42' }), undefined);
      expect(card.factId).toBe('my-fact-42');
    });
  });
});

describe('deckManager', () => {
  let deck: ReturnType<typeof createDeck>;
  const POOL_SIZE = 20;

  beforeEach(() => {
    deck = createDeck(makeCards(POOL_SIZE));
  });

  describe('createDeck', () => {
    it('initializes draw pile with all pool cards', () => {
      expect(deck.drawPile.length).toBe(POOL_SIZE);
    });

    it('starts with empty hand, discard, and exhaust', () => {
      expect(deck.hand.length).toBe(0);
      expect(deck.discardPile.length).toBe(0);
      expect(deck.exhaustPile.length).toBe(0);
    });

    it('initializes player stats from balance', () => {
      expect(deck.playerHP).toBe(100);
      expect(deck.playerMaxHP).toBe(100);
      expect(deck.playerShield).toBe(0);
      expect(deck.currentFloor).toBe(1);
    });
  });

  describe('drawHand', () => {
    it('draws HAND_SIZE (5) cards by default', () => {
      const drawn = drawHand(deck);
      expect(drawn.length).toBe(HAND_SIZE);
      expect(deck.hand.length).toBe(HAND_SIZE);
      expect(deck.drawPile.length).toBe(POOL_SIZE - HAND_SIZE);
    });

    it('draws a custom number of cards', () => {
      const drawn = drawHand(deck, 3);
      expect(drawn.length).toBe(3);
      expect(deck.hand.length).toBe(3);
    });

    it('reshuffles discard when draw pile empties', () => {
      while (deck.drawPile.length > 0 || deck.hand.length > 0) {
        if (deck.hand.length === 0) {
          drawHand(deck, HAND_SIZE);
        }
        while (deck.hand.length > 0) {
          playCard(deck, deck.hand[0].id);
        }
      }
      expect(deck.drawPile.length).toBe(0);
      expect(deck.discardPile.length).toBe(POOL_SIZE);

      // Now draw again — should reshuffle
      const drawn = drawHand(deck, 5);
      expect(drawn.length).toBe(5);
      expect(deck.discardPile.length).toBe(0);
      expect(deck.drawPile.length).toBe(POOL_SIZE - 5);
    });

    it('returns fewer cards if both piles are exhausted', () => {
      while (deck.drawPile.length > 0 || deck.hand.length > 0) {
        if (deck.hand.length === 0) {
          drawHand(deck, HAND_SIZE);
        }
        while (deck.hand.length > 0) {
          exhaustCard(deck, deck.hand[0].id);
        }
      }
      expect(deck.drawPile.length).toBe(0);
      expect(deck.discardPile.length).toBe(0);
      expect(deck.exhaustPile.length).toBe(POOL_SIZE);

      const drawn = drawHand(deck, 5);
      expect(drawn.length).toBe(0);
    });
  });

  describe('playCard', () => {
    it('moves card from hand to discard', () => {
      drawHand(deck, 1);
      const cardId = deck.hand[0].id;
      const played = playCard(deck, cardId);
      expect(played.id).toBe(cardId);
      expect(deck.hand.length).toBe(0);
      expect(deck.discardPile.length).toBe(1);
      expect(deck.discardPile[0].id).toBe(cardId);
    });

    it('throws if card not in hand', () => {
      expect(() => playCard(deck, 'nonexistent')).toThrow('not found in hand');
    });
  });

  describe('discardCard', () => {
    it('moves card from hand to discard', () => {
      drawHand(deck, 1);
      const cardId = deck.hand[0].id;
      discardCard(deck, cardId);
      expect(deck.hand.length).toBe(0);
      expect(deck.discardPile.length).toBe(1);
    });
  });

  describe('exhaustCard', () => {
    it('moves card from hand to exhaust pile', () => {
      drawHand(deck, 1);
      const cardId = deck.hand[0].id;
      exhaustCard(deck, cardId);
      expect(deck.hand.length).toBe(0);
      expect(deck.exhaustPile.length).toBe(1);
      expect(deck.exhaustPile[0].id).toBe(cardId);
    });

    it('throws if card not in hand', () => {
      expect(() => exhaustCard(deck, 'nonexistent')).toThrow('not found in hand');
    });
  });

  describe('getDeckStats', () => {
    it('returns correct counts after various operations', () => {
      drawHand(deck, 3);
      playCard(deck, deck.hand[0].id);
      exhaustCard(deck, deck.hand[0].id);

      const stats = getDeckStats(deck);
      expect(stats.drawRemaining).toBe(POOL_SIZE - 3);
      expect(stats.handSize).toBe(1);
      expect(stats.discardSize).toBe(1);
      expect(stats.exhaustedCount).toBe(1);
    });
  });

  describe('reshuffleDiscard', () => {
    it('moves all discard cards into draw pile', () => {
      drawHand(deck, 5);
      while (deck.hand.length > 0) {
        playCard(deck, deck.hand[0].id);
      }
      const discardCount = deck.discardPile.length;
      const drawCount = deck.drawPile.length;

      reshuffleDiscard(deck);
      expect(deck.discardPile.length).toBe(0);
      expect(deck.drawPile.length).toBe(drawCount + discardCount);
    });
  });
});
