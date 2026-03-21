import type { Card, CardRunState, DeckStats } from '../data/card-types';
import { HAND_SIZE, PLAYER_START_HP, PLAYER_MAX_HP, HINTS_PER_ENCOUNTER, FACT_COOLDOWN_MIN, FACT_COOLDOWN_MAX, CURSED_AUTO_CURE_THRESHOLD } from '../data/balance';
import { factsDB } from './factsDB';
import { resolveDomain } from './domainResolver';
import { shuffled } from './randomUtils';
import { getRunRng, isRunRngActive, seededShuffled } from './seededRng';
import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { activeRunState } from './runStateStore';

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

/**
 * Strips known variant suffixes from a fact ID to get the root fact group.
 * Prevents multiple variants of the same grammar/vocab point from appearing
 * in the same hand (e.g. ja-grammar-n5-ga-meaning and ja-grammar-n5-ga-recall).
 */
function getFactRootId(factId: string): string {
  return factId
    .replace(/-(meaning|recall|fill|forward|reverse|true_false|fill_blank|negative|context)$/i, '')
    .replace(/-\d{4}-(meaning|recall|fill)$/i, (match) => match.replace(/-(meaning|recall|fill)$/i, ''));
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
  const rng = isRunRngActive() ? getRunRng('facts') : null;
  const weighted = factIds.map(id => {
    const fact = factsDB.getById(id);
    const funScore = fact?.funScore ?? 5;
    return { id, weight: funScore >= 7 ? 2 : 1 };
  });

  const result: string[] = [];
  const pool = [...weighted];

  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = (rng ? rng.next() : Math.random()) * totalWeight;

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
/** Shuffle using the run's seeded RNG when active, otherwise crypto-safe. */
function deckShuffled<T>(items: readonly T[]): T[] {
  if (isRunRngActive()) {
    return seededShuffled(getRunRng('deck'), items);
  }
  // Fallback: crypto-safe Fisher-Yates for non-seeded contexts
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createDeck(pool: Card[]): CardRunState {
  return {
    drawPile: deckShuffled(pool),
    discardPile: [],
    hand: [],
    exhaustPile: [],
    currentFloor: 1,
    currentEncounter: 0,
    playerHP: PLAYER_START_HP,
    playerMaxHP: PLAYER_MAX_HP,
    playerShield: 0,
    hintsRemaining: HINTS_PER_ENCOUNTER,
    currency: 0,
    factPool: pool.map(c => c.factId),
    factCooldown: [],
    currentEncounterSeenFacts: new Set(),
    consecutiveCursedDraws: 0,
    pendingAutoCure: false,
  };
}

/**
 * No-op since AR-93: facts are assigned per draw from the FSRS pool, not permanently bound.
 * Cooldown filtering happens during fact assignment in the per-draw shuffling path.
 * Kept as a stub to avoid changing the drawHand() call site.
 */
function deprioritizeCooledDownCards(_deck: CardRunState): void {
  // Facts are no longer bound to cards — cooldown is applied during per-draw fact selection.
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
export function drawHand(
  deck: CardRunState,
  count?: number,
  options?: { firstDrawBias?: boolean; tagMagnetBias?: { chainType: number; chance: number } },
): Card[] {
  const requested = count ?? HAND_SIZE;
  // When count is explicitly provided (mid-turn draws like scout/recycle, or
  // relic-boosted draws like swift_boots), honor the full request — the caller
  // already knows how many cards to draw. Only enforce the HAND_SIZE cap for
  // default start-of-turn draws (no explicit count passed).
  const toDraw = count !== undefined
    ? Math.max(0, requested)
    : Math.max(0, Math.min(requested, HAND_SIZE - deck.hand.length));

  // Deprioritize cards with cooled-down bound facts (AR-70)
  deprioritizeCooledDownCards(deck);

  const drawn: Card[] = [];

  for (let i = 0; i < toDraw; i++) {
    // If draw pile empty, reshuffle discard into draw
    if (deck.drawPile.length === 0) {
      if (deck.discardPile.length === 0) break; // nothing left to draw
      reshuffleDiscard(deck);
    }

    const card = deck.drawPile.pop();
    if (!card) break;

    deck.hand.push(card);
    drawn.push(card);
  }

  // === Tag Magnet Bias (tag_magnet relic) ===
  // For each drawn card that doesn't match the target chainType, roll for swap
  // with a matching card from the draw pile.
  if (options?.tagMagnetBias && drawn.length > 0) {
    const { chainType: targetChainType, chance } = options.tagMagnetBias;
    for (let i = 0; i < drawn.length; i++) {
      const card = drawn[i];
      if (card.chainType !== targetChainType && Math.random() < chance) {
        const matchIdx = deck.drawPile.findIndex(c => c.chainType === targetChainType);
        if (matchIdx >= 0) {
          const [matchCard] = deck.drawPile.splice(matchIdx, 1);
          // Put the non-matching card back into the draw pile
          deck.drawPile.push(card);
          // Replace in hand and drawn array
          const handIdx = deck.hand.indexOf(card);
          if (handIdx >= 0) deck.hand[handIdx] = matchCard;
          drawn[i] = matchCard;
        }
      }
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
      }
    }
  }

  // === Per-Draw Fact Shuffling (AR-93) ===
  // Facts are assigned per draw from the FSRS pool — no permanent binding.
  // The seeded RNG fork 'facts' ensures identical card-fact pairings for identical seeds.
  if (drawn.length > 0 && deck.factPool.length > 0) {
    // AR-202: Read cursedFactIds from run state for priority weighting and isCursed flag.
    const cursedFactIds: Set<string> = get(activeRunState)?.cursedFactIds ?? new Set();

    const cooldownRootIds = new Set(deck.factCooldown.map(c => getFactRootId(c.factId)));
    // AR-202: Cursed facts bypass the cooldown filter so they resurface faster for cure opportunities.
    const availableFacts = deck.factPool.filter(
      fId => cursedFactIds.has(fId)
        || (!deck.factCooldown.some(c => c.factId === fId) && !cooldownRootIds.has(getFactRootId(fId)))
    );

    let factsToUse = availableFacts;
    if (factsToUse.length < drawn.length) {
      const relaxedFacts = deck.factPool.filter(
        fId => !deck.factCooldown.some(c => c.factId === fId && c.encountersRemaining > 1)
      );
      if (relaxedFacts.length >= drawn.length) {
        factsToUse = relaxedFacts;
      } else {
        factsToUse = [...deck.factPool];
      }
    }

    // AR-202: Weighted priority — prepend cursed available facts to front of candidate list.
    // This gives them priority without breaking the existing duplicate-avoidance logic.
    const cursedAvailable = factsToUse.filter(fId => cursedFactIds.has(fId));
    const nonCursedAvailable = factsToUse.filter(fId => !cursedFactIds.has(fId));

    let shuffledFacts: string[];
    if (options?.firstDrawBias) {
      // Weighted shuffle but keep cursed facts at front
      const shuffledNonCursed = weightedFactShuffle(nonCursedAvailable);
      shuffledFacts = [...cursedAvailable, ...shuffledNonCursed];
    } else {
      // Shuffle non-cursed portion, cursed facts stay at front for priority
      const shuffledNonCursed = isRunRngActive() ? seededShuffled(getRunRng('facts'), nonCursedAvailable) : shuffled(nonCursedAvailable);
      shuffledFacts = [...cursedAvailable, ...shuffledNonCursed];
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
    const usedRootIds = new Set(
      deck.hand
        .filter((card) => !drawnCardIds.has(card.id))
        .map((card) => getFactRootId(card.factId))
    );
    const candidateFacts = [...shuffledFacts];

    const pickCandidateFactId = (): string | null => {
      if (candidateFacts.length === 0) return null;
      let candidateIndex = candidateFacts.findIndex((candidateFactId) => (
        !usedFactIds.has(candidateFactId)
          && !usedBaseKeys.has(buildFactBaseKey(candidateFactId, factKeyCache))
          && !usedRootIds.has(getFactRootId(candidateFactId))
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

    if (!deck.currentEncounterSeenFacts || !(deck.currentEncounterSeenFacts instanceof Set)) {
      deck.currentEncounterSeenFacts = new Set(Array.isArray(deck.currentEncounterSeenFacts) ? deck.currentEncounterSeenFacts : []);
    }
    for (const card of drawn) {
      const factId = pickCandidateFactId() ?? shuffledFacts[0];
      if (factId) {
        card.factId = factId;
        // AR-202: Mark card as cursed if its assigned fact is in the cursedFactIds set.
        card.isCursed = cursedFactIds.has(factId);
        const newFact = factsDB.isReady() ? factsDB.getById(factId) : null;
        if (newFact) {
          card.domain = resolveDomain(newFact);
        }
        usedFactIds.add(factId);
        usedBaseKeys.add(buildFactBaseKey(factId, factKeyCache));
        usedRootIds.add(getFactRootId(factId));
        deck.currentEncounterSeenFacts.add(factId);
      }
    }

    // AR-202: Auto-cure safety valve — track consecutive draws with high cursed ratio.
    const cursedCount = deck.hand.filter(c => c.isCursed).length;
    const ratio = deck.hand.length > 0 ? cursedCount / deck.hand.length : 0;
    if (ratio >= CURSED_AUTO_CURE_THRESHOLD) {
      deck.consecutiveCursedDraws = (deck.consecutiveCursedDraws ?? 0) + 1;
    } else {
      deck.consecutiveCursedDraws = 0;
    }
    if ((deck.consecutiveCursedDraws ?? 0) >= 2) {
      deck.pendingAutoCure = true;
    }
    // CURSED_AUTO_CURE_COUNT (= 1) governs how many facts to cure — applied in encounterBridge.ts.
  }

  // === Draw Smoothing (AR-93 Section D) ===
  // Ensures at least one chain type pair in the hand to enable chain combos.
  smoothDrawForChainPairs(deck);

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
 * never reshuffled back into the draw pile.
 *
 * AR-202 invariant: Cursed cards cannot be exhausted via player choice (Recollect doesn't apply).
 * The curse persists on the fact ID regardless of card slot removal — deck thinning does NOT
 * remove curses. Inscriptions bypass this invariant and always exhaust on play regardless of cursed state.
 * If "choose to exhaust" mechanics are implemented, they must filter out cursed cards from the picker UI.
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
  deck.drawPile = deckShuffled(deck.drawPile);
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
      const rng = isRunRngActive() ? getRunRng('facts') : null;
      const range = FACT_COOLDOWN_MAX - FACT_COOLDOWN_MIN + 1;
      deck.factCooldown.push({ factId, encountersRemaining: FACT_COOLDOWN_MIN + Math.floor((rng ? rng.next() : Math.random()) * range) });
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

/**
 * Draw smoothing (AR-70): ensures at least one chain type pair in the hand.
 * If no chainType appears 2+ times, swaps one card from the hand with a
 * card from the draw pile that matches any existing hand chainType.
 * Max 1 swap per draw. Called after drawHand().
 */
export function smoothDrawForChainPairs(deck: CardRunState): void {
  if (deck.hand.length < 2) return;

  // Count chainType occurrences in hand
  const typeCounts = new Map<number, number>();
  for (const card of deck.hand) {
    if (card.chainType !== undefined) {
      typeCounts.set(card.chainType, (typeCounts.get(card.chainType) ?? 0) + 1);
    }
  }

  // If any chainType appears 2+ times, no smoothing needed
  for (const count of typeCounts.values()) {
    if (count >= 2) return;
  }

  // No pairs found — try to swap one hand card with a draw pile card that creates a pair
  const handTypes = new Set(deck.hand.map(c => c.chainType).filter((t): t is number => t !== undefined));

  // Find a draw pile card whose chainType matches any hand card
  const matchIdx = deck.drawPile.findIndex(c =>
    c.chainType !== undefined && handTypes.has(c.chainType)
  );

  if (matchIdx < 0) return; // No valid replacement exists

  const replacement = deck.drawPile[matchIdx];

  // Find a hand card to swap out — prefer one whose chainType is NOT shared by the replacement
  // (to maximize the chance the replacement creates a new pair)
  let swapIdx = deck.hand.findIndex(c => c.chainType !== replacement.chainType);
  if (swapIdx < 0) swapIdx = deck.hand.length - 1; // fallback: swap last card

  const swappedOut = deck.hand[swapIdx];

  // Perform the swap
  deck.hand[swapIdx] = replacement;
  deck.drawPile.splice(matchIdx, 1);
  deck.drawPile.push(swappedOut); // put swapped card at bottom of draw pile
}

// Exported for unit testing only — not part of the public API.
export { weightedFactShuffle as _weightedFactShuffle_forTest };

/**
 * Returns all fact IDs that appeared in any hand during the current encounter.
 * Used by encounterBridge to add ALL seen facts (not just answered ones) to cooldown.
 */
export function getEncounterSeenFacts(deck: CardRunState): string[] {
  return [...(deck.currentEncounterSeenFacts ?? [])];
}

/**
 * Resets the per-encounter seen-facts tracking set.
 * Call at the start of each new encounter (before drawHand).
 */
export function resetEncounterSeenFacts(deck: CardRunState): void {
  deck.currentEncounterSeenFacts = new Set();
}

export function insertCardWithDelay(deck: CardRunState, card: Card, minDelayCards: number): void {
  if (deck.drawPile.length === 0) {
    deck.drawPile.push(card);
    return;
  }

  const maxByDepth = Math.floor(deck.drawPile.length * 0.6);
  const maxByDelay = Math.max(0, deck.drawPile.length - minDelayCards);
  const upperBound = Math.max(0, Math.min(maxByDepth, maxByDelay));
  const rng = isRunRngActive() ? getRunRng('deck') : null;
  const index = Math.floor((rng ? rng.next() : Math.random()) * (upperBound + 1));
  deck.drawPile.splice(index, 0, card);
}
