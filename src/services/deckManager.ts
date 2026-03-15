import type { Card, CardRunState, DeckStats } from '../data/card-types';
import { HAND_SIZE, PLAYER_START_HP, PLAYER_MAX_HP, HINTS_PER_ENCOUNTER, FACT_COOLDOWN_MIN, FACT_COOLDOWN_MAX } from '../data/balance';
import { factsDB } from './factsDB';
import { shuffled } from './randomUtils';
import { writable } from 'svelte/store';

/** Emitted whenever the discard pile is reshuffled into the draw pile. */
export const reshuffleEvent = writable<{ cardCount: number; timestamp: number } | null>(null);

function normalizeFactKeyPart(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFactBaseKey(factId: string, cache: Map<string, string>): string {
  const cached = cache.get(factId);
  if (cached) return cached;

  const fact = factsDB.getById(factId);
  if (!fact) {
    cache.set(factId, factId);
    return factId;
  }

  const language = normalizeFactKeyPart(fact.language);
  const statement = normalizeFactKeyPart(fact.statement);
  const quizQuestion = normalizeFactKeyPart(fact.quizQuestion);
  const answer = normalizeFactKeyPart(fact.correctAnswer);
  const prompt = statement || quizQuestion || factId;
  const key = `${language}|${prompt}|${answer}`;
  cache.set(factId, key);
  return key;
}

/**
 * Weighted shuffle biasing high-funScore facts toward the front.
 * Facts with funScore >= 7 get 2x weight in selection probability.
 * Used only for the first draw of a run to create a strong first impression.
 */
function weightedFactShuffle(factIds: string[]): string[] {
  const weighted = factIds.map(id => {
    const fact = factsDB.getById(id);
    const funScore = fact?.funScore ?? 5;
    return { id, weight: funScore >= 7 ? 2 : 1 };
  });

  const result: string[] = [];
  const pool = [...weighted];

  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      random -= pool[i].weight;
      if (random <= 0) {
        selectedIdx = i;
        break;
      }
    }

    result.push(pool[selectedIdx].id);
    pool.splice(selectedIdx, 1);
  }

  return result;
}

/**
 * Creates a new CardRunState from an initial card pool.
 *
 * The pool becomes the draw pile (shuffled). All other piles start empty.
 * Player stats are initialized from balance constants.
 *
 * @param pool - The card pool produced by buildRunPool.
 * @returns A fully initialized CardRunState.
 */
/** Crypto-safe Fisher-Yates shuffle (immune to seeded Math.random override). */
function trueShuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createDeck(pool: Card[]): CardRunState {
  return {
    drawPile: trueShuffled(pool),
    discardPile: [],
    hand: [],
    exhaustPile: [],
    comboCount: 0,
    currentFloor: 1,
    currentEncounter: 0,
    playerHP: PLAYER_START_HP,
    playerMaxHP: PLAYER_MAX_HP,
    playerShield: 0,
    hintsRemaining: HINTS_PER_ENCOUNTER,
    currency: 0,
    factPool: pool.map(c => c.factId),
    factCooldown: [],
  };
}

/**
 * Draws cards from the draw pile into the hand.
 *
 * If the draw pile runs out mid-draw, the discard pile is shuffled into the
 * draw pile (Slay the Spire model) and drawing continues. If both piles are
 * exhausted, drawing stops with fewer cards than requested.
 *
 * @param deck - The current deck state (mutated in place).
 * @param count - Number of cards to draw (default HAND_SIZE = 5).
 * @returns The array of cards drawn (same references as in deck.hand).
 */
export function drawHand(deck: CardRunState, count?: number, options?: { firstDrawBias?: boolean }): Card[] {
  const requested = count ?? HAND_SIZE;
  const availableSpace = Math.max(0, HAND_SIZE - deck.hand.length);
  const toDraw = Math.max(0, Math.min(requested, availableSpace));
  const drawn: Card[] = [];
  const mechanicsInHand = new Set(deck.hand.map((card) => card.mechanicId).filter(Boolean) as string[]);

  for (let i = 0; i < toDraw; i++) {
    // If draw pile empty, reshuffle discard into draw
    if (deck.drawPile.length === 0) {
      if (deck.discardPile.length === 0) break; // nothing left to draw
      reshuffleDiscard(deck);
    }

    let card = deck.drawPile.pop();
    if (!card) break;

    // No duplicate mechanics in a drawn hand when avoidable.
    if (card.mechanicId && mechanicsInHand.has(card.mechanicId)) {
      const rerollIndex = [...deck.drawPile]
        .reverse()
        .findIndex((candidate) => !candidate.mechanicId || !mechanicsInHand.has(candidate.mechanicId));

      if (rerollIndex >= 0) {
        const actualIndex = deck.drawPile.length - 1 - rerollIndex;
        const [rerolled] = deck.drawPile.splice(actualIndex, 1);
        deck.drawPile.push(card);
        card = rerolled;
      }
    }

    if (card) {
      deck.hand.push(card);
      drawn.push(card);
      if (card.mechanicId) mechanicsInHand.add(card.mechanicId);
    }
  }

  // === Hand Composition Guard ===
  // Guarantee at least 1 attack-type card to prevent 0-DPS dead turns
  const hasAttack = drawn.some(c => c.cardType === 'attack');
  if (!hasAttack && drawn.length > 0) {
    // Find an attack card in the draw pile
    const attackIdx = deck.drawPile.findIndex(c => c.cardType === 'attack');
    if (attackIdx >= 0) {
      // Swap the last drawn non-attack card with the attack card from draw pile
      const swapTarget = drawn[drawn.length - 1];
      const [attackCard] = deck.drawPile.splice(attackIdx, 1);
      // Put the swapped card back in draw pile
      deck.drawPile.push(swapTarget);
      // Replace in hand
      const handIdx = deck.hand.indexOf(swapTarget);
      if (handIdx >= 0) {
        deck.hand[handIdx] = attackCard;
        drawn[drawn.length - 1] = attackCard;
        if (attackCard.mechanicId) mechanicsInHand.add(attackCard.mechanicId);
      }
    }
  }

  // === Fact-Card Shuffling ===
  // Reassign facts to drawn card slots from the available fact pool
  if (deck.factPool.length > 0 && drawn.length > 0) {
    const availableFacts = deck.factPool.filter(
      fId => !deck.factCooldown.some(c => c.factId === fId)
    );

    // Edge case: if cooldown removes too many facts, reduce cooldown
    let factsToUse = availableFacts;
    if (factsToUse.length < drawn.length) {
      // If available facts < hand size, reduce cooldown to 1
      const relaxedFacts = deck.factPool.filter(
        fId => !deck.factCooldown.some(c => c.factId === fId && c.encountersRemaining > 1)
      );
      if (relaxedFacts.length >= drawn.length) {
        factsToUse = relaxedFacts;
      } else {
        // If still not enough, disable cooldown entirely
        factsToUse = [...deck.factPool];
        if (factsToUse.length < 3) {
          console.warn('[deckManager] fact pool exhaustion — cooldown disabled');
        }
      }
    }

    // Shuffle available facts (with optional first-draw funScore bias)
    let shuffledFacts: string[];
    if (options?.firstDrawBias) {
      // Weighted shuffle: facts with funScore >= 7 are 2x more likely to appear first
      shuffledFacts = weightedFactShuffle(factsToUse);
    } else {
      shuffledFacts = shuffled(factsToUse);
    }

    const factKeyCache = new Map<string, string>();
    const drawnCardIds = new Set(drawn.map((card) => card.id));
    const usedFactIds = new Set(
      deck.hand
        .filter((card) => !drawnCardIds.has(card.id))
        .map((card) => card.factId)
    );
    const usedBaseKeys = new Set(
      deck.hand
        .filter((card) => !drawnCardIds.has(card.id))
        .map((card) => buildFactBaseKey(card.factId, factKeyCache))
    );
    const candidateFacts = [...shuffledFacts];

    const pickCandidateFactId = (): string | null => {
      if (candidateFacts.length === 0) return null;

      let candidateIndex = candidateFacts.findIndex((candidateFactId) => (
        !usedFactIds.has(candidateFactId)
          && !usedBaseKeys.has(buildFactBaseKey(candidateFactId, factKeyCache))
      ));

      if (candidateIndex < 0) {
        candidateIndex = candidateFacts.findIndex((candidateFactId) => !usedFactIds.has(candidateFactId));
      }

      if (candidateIndex < 0) {
        candidateIndex = candidateFacts.findIndex((candidateFactId) => (
          !usedBaseKeys.has(buildFactBaseKey(candidateFactId, factKeyCache))
        ));
      }

      if (candidateIndex < 0) candidateIndex = 0;
      const [factId] = candidateFacts.splice(candidateIndex, 1);
      return factId ?? null;
    };

    // Pair each drawn card slot with a random fact, avoiding duplicate base facts when possible.
    for (let i = 0; i < drawn.length; i++) {
      const factId = pickCandidateFactId() ?? shuffledFacts[i % shuffledFacts.length];
      drawn[i].factId = factId;
      usedFactIds.add(factId);
      usedBaseKeys.add(buildFactBaseKey(factId, factKeyCache));
    }
  }

  return drawn;
}

/**
 * Plays a card from the hand, moving it to the discard pile.
 *
 * @param deck - The current deck state (mutated in place).
 * @param cardId - The id of the card to play.
 * @returns The played Card.
 * @throws Error if the card is not found in the hand.
 */
export function playCard(deck: CardRunState, cardId: string): Card {
  const index = deck.hand.findIndex(c => c.id === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found in hand`);
  }
  const [card] = deck.hand.splice(index, 1);
  deck.discardPile.push(card);
  return card;
}

/**
 * Discards a card from the hand (skip/fizzle), moving it to the discard pile.
 *
 * Functionally identical to playCard but semantically distinct — the card
 * was not "played" for effect, it was discarded without use.
 *
 * @param deck - The current deck state (mutated in place).
 * @param cardId - The id of the card to discard.
 * @returns The discarded Card.
 * @throws Error if the card is not found in the hand.
 */
export function discardCard(deck: CardRunState, cardId: string): Card {
  const index = deck.hand.findIndex(c => c.id === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found in hand`);
  }
  const [card] = deck.hand.splice(index, 1);
  deck.discardPile.push(card);
  return card;
}

/**
 * Discards all cards currently in hand.
 *
 * End-turn flow uses this to move unplayed cards into discard before drawing
 * a fresh hand (Slay the Spire-style pile cycle).
 *
 * @param deck - The current deck state (mutated in place).
 * @returns The cards moved from hand to discard.
 */
export function discardHand(deck: CardRunState): Card[] {
  if (deck.hand.length === 0) return [];
  const discarded = [...deck.hand];
  deck.discardPile.push(...discarded);
  deck.hand = [];
  return discarded;
}

/**
 * Exhausts a card — permanently removes it from the run.
 *
 * The card is moved from the hand to the exhaust pile. Exhausted cards are
 * never reshuffled back into the draw pile. Used for Echo resolution, etc.
 *
 * @param deck - The current deck state (mutated in place).
 * @param cardId - The id of the card to exhaust.
 * @returns The exhausted Card.
 * @throws Error if the card is not found in the hand.
 */
export function exhaustCard(deck: CardRunState, cardId: string): Card {
  const index = deck.hand.findIndex(c => c.id === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found in hand`);
  }
  const [card] = deck.hand.splice(index, 1);
  deck.exhaustPile.push(card);
  return card;
}

/**
 * Shuffles the discard pile into the draw pile.
 *
 * Called automatically by drawHand when the draw pile is empty.
 * Can also be called manually for card effects that trigger a reshuffle.
 *
 * @param deck - The current deck state (mutated in place).
 */
export function reshuffleDiscard(deck: CardRunState): void {
  const count = deck.discardPile.length;
  deck.drawPile.push(...deck.discardPile);
  deck.discardPile = [];
  deck.drawPile = trueShuffled(deck.drawPile);
  reshuffleEvent.set({ cardCount: count, timestamp: Date.now() });
}

/**
 * Returns a snapshot of the current deck pile sizes.
 *
 * @param deck - The current deck state.
 * @returns DeckStats with counts for each pile.
 */
export function getDeckStats(deck: CardRunState): DeckStats {
  return {
    drawRemaining: deck.drawPile.length,
    discardSize: deck.discardPile.length,
    exhaustedCount: deck.exhaustPile.length,
    handSize: deck.hand.length,
  };
}

/**
 * Adds a card directly into the draw pile.
 *
 * @param deck - The current deck state (mutated in place).
 * @param card - Card to add.
 * @param place - 'top' places for immediate draw, 'bottom' for later.
 */
export function addCardToDeck(deck: CardRunState, card: Card, place: 'top' | 'bottom' = 'top'): void {
  if (place === 'top') {
    deck.drawPile.push(card);
  } else {
    deck.drawPile.unshift(card);
  }
}

/**
 * Inserts a card into draw pile with delay from top draw order.
 *
 * Draw pile is stack-mode (`pop` from the end), so lower indices are deeper.
 */
/**
 * Adds answered fact IDs to the cooldown list (3–5 encounters).
 * Call at the end of each encounter.
 */
export function addFactsToCooldown(deck: CardRunState, answeredFactIds: string[]): void {
  for (const factId of answeredFactIds) {
    // Don't add duplicates
    if (!deck.factCooldown.some(c => c.factId === factId)) {
      deck.factCooldown.push({ factId, encountersRemaining: FACT_COOLDOWN_MIN + Math.floor(Math.random() * (FACT_COOLDOWN_MAX - FACT_COOLDOWN_MIN + 1)) });
    }
  }
}

/**
 * Decrements encounter cooldowns and removes expired entries.
 * Call at the start of each new encounter.
 */
export function tickFactCooldowns(deck: CardRunState): void {
  deck.factCooldown = deck.factCooldown
    .map(c => ({ ...c, encountersRemaining: c.encountersRemaining - 1 }))
    .filter(c => c.encountersRemaining > 0);
}

// Exported for unit testing only — not part of the public API.
export { weightedFactShuffle as _weightedFactShuffle_forTest };

export function insertCardWithDelay(deck: CardRunState, card: Card, minDelayCards: number): void {
  if (deck.drawPile.length === 0) {
    deck.drawPile.push(card);
    return;
  }

  const maxByDepth = Math.floor(deck.drawPile.length * 0.6);
  const maxByDelay = Math.max(0, deck.drawPile.length - minDelayCards);
  const upperBound = Math.max(0, Math.min(maxByDepth, maxByDelay));
  const index = Math.floor(Math.random() * (upperBound + 1));
  deck.drawPile.splice(index, 0, card);
}
