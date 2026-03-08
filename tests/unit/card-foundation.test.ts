import { describe, it, expect, beforeEach } from 'vitest';
import { resolveDomain, resolveCardType } from '../../src/services/domainResolver';
import { createCard, computeTier, computeEffectMultiplier, resetCardIdCounter } from '../../src/services/cardFactory';
import { createDeck, drawHand, playCard, discardCard, exhaustCard, reshuffleDiscard, getDeckStats } from '../../src/services/deckManager';
import { DOMAIN_CARD_TYPE } from '../../src/data/card-types';
import { BASE_EFFECT, TIER_MULTIPLIER, EASE_POWER, HAND_SIZE } from '../../src/data/balance';
import type { Fact, ReviewState } from '../../src/data/types';
import type { Card, FactDomain } from '../../src/data/card-types';

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
    domain: 'science' as FactDomain,
    tier: 1 as const,
    baseEffectValue: 8,
    effectMultiplier: 1.0,
  }));
}

// ── Tests ──

describe('domainResolver', () => {
  describe('resolveDomain', () => {
    it('maps "Natural Sciences" to science', () => {
      expect(resolveDomain(makeFact({ category: ['Natural Sciences', 'Chemistry'] }))).toBe('science');
    });

    it('maps "History" to history', () => {
      expect(resolveDomain(makeFact({ category: ['History', 'Ancient Rome'] }))).toBe('history');
    });

    it('maps "Language" to language', () => {
      expect(resolveDomain(makeFact({ category: ['Language', 'Japanese', 'N3'] }))).toBe('language');
    });

    it('maps "Life Sciences" to medicine', () => {
      expect(resolveDomain(makeFact({ category: ['Life Sciences', 'Biology'] }))).toBe('medicine');
    });

    it('maps "Culture" to arts', () => {
      expect(resolveDomain(makeFact({ category: ['Culture', 'Music'] }))).toBe('arts');
    });

    it('maps "Technology" to technology', () => {
      expect(resolveDomain(makeFact({ category: ['Technology', 'AI'] }))).toBe('technology');
    });

    it('maps "Geography" to geography', () => {
      expect(resolveDomain(makeFact({ category: ['Geography', 'Europe'] }))).toBe('geography');
    });

    it('falls back to science for unknown categories', () => {
      expect(resolveDomain(makeFact({ category: ['Unknown'] }))).toBe('science');
    });
  });

  describe('resolveCardType', () => {
    it('returns attack for science', () => {
      expect(resolveCardType('science')).toBe('attack');
    });

    it('returns shield for history', () => {
      expect(resolveCardType('history')).toBe('shield');
    });

    it('matches DOMAIN_CARD_TYPE for all domains', () => {
      for (const [domain, cardType] of Object.entries(DOMAIN_CARD_TYPE)) {
        expect(resolveCardType(domain as FactDomain)).toBe(cardType);
      }
    });
  });
});

describe('cardFactory', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  describe('computeTier', () => {
    it('returns tier 1 when no review state', () => {
      expect(computeTier(undefined)).toBe(1);
    });

    it('returns tier 1 for new/learning cards', () => {
      expect(computeTier(makeReviewState({ interval: 1, repetitions: 1 }))).toBe(1);
    });

    it('returns tier 2 for familiar cards (interval >= 3, reps >= 3)', () => {
      expect(computeTier(makeReviewState({ interval: 3, repetitions: 3 }))).toBe(2);
    });

    it('returns tier 3 for mastered cards (interval >= 21, reps >= 5)', () => {
      expect(computeTier(makeReviewState({ interval: 21, repetitions: 5 }))).toBe(3);
    });

    it('returns tier 2 when interval is high but reps are low', () => {
      expect(computeTier(makeReviewState({ interval: 30, repetitions: 4 }))).toBe(2);
    });

    it('returns tier 1 when reps are high but interval is low', () => {
      expect(computeTier(makeReviewState({ interval: 2, repetitions: 10 }))).toBe(1);
    });
  });

  describe('computeEffectMultiplier', () => {
    it('returns 1.0 when no review state', () => {
      expect(computeEffectMultiplier(undefined)).toBe(1.0);
    });

    it('returns 1.6 for very hard cards (ease < 1.5)', () => {
      expect(computeEffectMultiplier(makeReviewState({ easeFactor: 1.3 }))).toBe(1.6);
    });

    it('returns 1.3 for hard cards (ease 1.5-1.99)', () => {
      expect(computeEffectMultiplier(makeReviewState({ easeFactor: 1.7 }))).toBe(1.3);
    });

    it('returns 1.0 for medium cards (ease 2.0-2.49)', () => {
      expect(computeEffectMultiplier(makeReviewState({ easeFactor: 2.3 }))).toBe(1.0);
    });

    it('returns 0.8 for easy cards (ease >= 2.5)', () => {
      expect(computeEffectMultiplier(makeReviewState({ easeFactor: 2.8 }))).toBe(0.8);
    });
  });

  describe('createCard', () => {
    it('creates a science/attack card from Natural Sciences fact', () => {
      const card = createCard(makeFact({ category: ['Natural Sciences'] }), undefined);
      expect(card.domain).toBe('science');
      expect(card.cardType).toBe('attack');
      expect(card.tier).toBe(1);
      expect(card.effectMultiplier).toBe(1.0);
    });

    it('assigns unique IDs to each card', () => {
      const card1 = createCard(makeFact(), undefined);
      const card2 = createCard(makeFact(), undefined);
      expect(card1.id).not.toBe(card2.id);
    });

    it('computes baseEffectValue from cardType and tier', () => {
      // Tier 1 attack: 8 * 1.0 = 8
      const t1 = createCard(makeFact({ category: ['Natural Sciences'] }), undefined);
      expect(t1.baseEffectValue).toBe(8);

      // Tier 2 attack: 8 * 1.5 = 12
      resetCardIdCounter();
      const t2 = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ interval: 5, repetitions: 3 }),
      );
      expect(t2.baseEffectValue).toBe(12);

      // Tier 3 attack: 8 * 0 = 0 (passive)
      resetCardIdCounter();
      const t3 = createCard(
        makeFact({ category: ['Natural Sciences'] }),
        makeReviewState({ interval: 25, repetitions: 6 }),
      );
      expect(t3.baseEffectValue).toBe(0);
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
      expect(deck.playerHP).toBe(80);
      expect(deck.playerMaxHP).toBe(80);
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
      // Draw all cards into hand, then discard them all
      for (let i = 0; i < POOL_SIZE; i++) {
        drawHand(deck, 1);
      }
      // Move all to discard
      while (deck.hand.length > 0) {
        playCard(deck, deck.hand[0].id);
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
      // Exhaust everything
      for (let i = 0; i < POOL_SIZE; i++) {
        drawHand(deck, 1);
      }
      while (deck.hand.length > 0) {
        exhaustCard(deck, deck.hand[0].id);
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
