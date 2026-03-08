import type { Card, CardRunState, DeckStats } from '../data/card-types';
import { HAND_SIZE, PLAYER_START_HP, PLAYER_MAX_HP, HINTS_PER_ENCOUNTER } from '../data/balance';

/**
 * Shuffles an array in place (Fisher-Yates). Returns the same reference.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
export function createDeck(pool: Card[]): CardRunState {
  return {
    drawPile: shuffle([...pool]),
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
export function drawHand(deck: CardRunState, count?: number): Card[] {
  const toDraw = count ?? HAND_SIZE;
  const drawn: Card[] = [];

  for (let i = 0; i < toDraw; i++) {
    // If draw pile empty, reshuffle discard into draw
    if (deck.drawPile.length === 0) {
      if (deck.discardPile.length === 0) break; // nothing left to draw
      reshuffleDiscard(deck);
    }

    const card = deck.drawPile.pop();
    if (card) {
      deck.hand.push(card);
      drawn.push(card);
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
  deck.drawPile.push(...deck.discardPile);
  deck.discardPile = [];
  shuffle(deck.drawPile);
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
