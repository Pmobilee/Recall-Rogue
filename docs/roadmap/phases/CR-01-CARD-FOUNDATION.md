# CR-01: Card Foundation

## Overview

**Goal:** Build the pure-data layer for the card roguelite system. This phase creates all types, interfaces, domain resolution logic, card factory, run pool builder, deck manager, and balance constants. No UI, no Phaser, no rendering — only TypeScript types, services, and unit tests.

**Dependencies:** None. This phase builds on existing infrastructure:
- `src/data/types.ts` — `Fact`, `ReviewState`, `ContentType`, `Rarity`
- `src/services/sm2.ts` — `createReviewState()`, SM-2 state machine
- `src/services/factsDB.ts` — `factsDB.getAll()`, `getByCategory()`, `getById()`
- `src/data/balance.ts` — existing balance constants (will be extended)

**Estimated Complexity:** Medium. ~6 new files + 1 modified file + 1 test file. Pure logic, no async, no DOM.

**Name Conflict Note:** `RunState` already exists in `src/data/types.ts` (mine/dive state). The card system's run state MUST be named `CardRunState` to avoid collision.

---

## Sub-steps

### Sub-step 1: Card Types and Interfaces

**File:** `src/data/card-types.ts` (NEW)

Create all card system type definitions:

```typescript
// === Card Type ===
// Maps to combat roles derived from knowledge domains

export type CardType = 'attack' | 'shield' | 'heal' | 'utility' | 'buff' | 'debuff' | 'regen' | 'wild';

// === Fact Domain ===
// Normalized domain categories derived from the existing fact.category[] hierarchy

export type FactDomain = 'science' | 'history' | 'geography' | 'language' | 'math' | 'arts' | 'medicine' | 'technology';

// === Domain → CardType Mapping ===
// Each knowledge domain produces a specific card combat role

export const DOMAIN_CARD_TYPE: Record<FactDomain, CardType> = {
  science:    'attack',
  history:    'shield',
  geography:  'utility',
  language:   'buff',
  math:       'debuff',
  arts:       'heal',
  medicine:   'regen',
  technology: 'wild',
};

// === Card Tier ===
// Derived from SM-2 review state progression

export type CardTier = 1 | 2 | 3;

// === Card Entity ===
// A single playable card in a run, linked to a Fact

export interface Card {
  /** Unique per-run card instance ID (e.g., `card_<nanoid>`) */
  id: string;
  /** Links to the source Fact in the facts DB */
  factId: string;
  /** Combat role, derived from domain */
  cardType: CardType;
  /** Knowledge domain, derived from fact.category */
  domain: FactDomain;
  /** Power tier: 1=new/learning, 2=familiar, 3=mastered (passive) */
  tier: CardTier;
  /** Base numeric effect (damage/block/heal amount before multipliers) */
  baseEffectValue: number;
  /** Multiplier from difficulty-proportional power (easy cards hit softer) */
  effectMultiplier: number;
  /** True if this is an Echo (ghost card injected from wrong answer) */
  isEcho?: boolean;
}

// === Card Run State ===
// Full state of the card deck during an active run.
// Named CardRunState to avoid collision with the existing RunState (mine/dive).

export interface CardRunState {
  /** Cards remaining to be drawn */
  drawPile: Card[];
  /** Cards played this turn cycle, waiting to be reshuffled */
  discardPile: Card[];
  /** Cards currently in the player's hand */
  hand: Card[];
  /** Cards permanently removed from this run */
  exhaustPile: Card[];
  /** Current consecutive correct-answer combo count (resets on wrong) */
  comboCount: number;
  /** Current floor number (1-indexed) */
  currentFloor: number;
  /** Current encounter index within the floor (0-indexed) */
  currentEncounter: number;
  /** Player's current hit points */
  playerHP: number;
  /** Player's maximum hit points */
  playerMaxHP: number;
  /** Player's current shield/block points */
  playerShield: number;
  /** Remaining hint uses for this run */
  hintsRemaining: number;
  /** Currency (dust) earned during this run */
  currency: number;
}

// === Deck Stats ===
// Snapshot of deck pile sizes for HUD display

export interface DeckStats {
  drawRemaining: number;
  discardSize: number;
  exhaustedCount: number;
  handSize: number;
}
```

**Acceptance Criteria:**
- File exports all types: `CardType`, `FactDomain`, `CardTier`, `Card`, `CardRunState`, `DeckStats`
- File exports `DOMAIN_CARD_TYPE` constant
- `CardRunState` is used (NOT `RunState`) to avoid collision with `src/data/types.ts`
- `npm run typecheck` passes with zero errors

---

### Sub-step 2: Domain Resolution

**File:** `src/services/domainResolver.ts` (NEW)

Maps existing `fact.category[]` values to the new `FactDomain` enum.

The existing `CATEGORIES` in `src/data/types.ts` are:
```
'Language', 'Natural Sciences', 'Life Sciences', 'History', 'Geography', 'Technology', 'Culture'
```

Facts also have `categoryL1` which may contain additional values. The resolver must handle all known top-level category strings and provide a sensible fallback.

```typescript
import type { Fact } from '../data/types';
import type { FactDomain, CardType } from '../data/card-types';
import { DOMAIN_CARD_TYPE } from '../data/card-types';

/** Top-level category string → FactDomain mapping */
const CATEGORY_TO_DOMAIN: Record<string, FactDomain> = {
  'Language':          'language',
  'Natural Sciences':  'science',
  'Life Sciences':     'medicine',
  'History':           'history',
  'Geography':         'geography',
  'Technology':        'technology',
  'Culture':           'arts',
  // Extended mappings for categoryL1 / sub-categories that may appear
  'Mathematics':       'math',
  'Math':              'math',
  'Science':           'science',
  'Arts':              'arts',
  'Medicine':          'medicine',
  'Health':            'medicine',
};

const DEFAULT_DOMAIN: FactDomain = 'science';

/**
 * Resolves a Fact's knowledge domain from its category hierarchy.
 *
 * Checks `fact.category[0]` (primary top-level category), then `fact.categoryL1`,
 * then falls back to 'science'.
 *
 * @param fact - The fact to resolve a domain for.
 * @returns The resolved FactDomain.
 */
export function resolveDomain(fact: Fact): FactDomain {
  // Try primary category first
  const primary = fact.category[0];
  if (primary && CATEGORY_TO_DOMAIN[primary]) {
    return CATEGORY_TO_DOMAIN[primary];
  }

  // Try categoryL1 if present
  if (fact.categoryL1 && CATEGORY_TO_DOMAIN[fact.categoryL1]) {
    return CATEGORY_TO_DOMAIN[fact.categoryL1];
  }

  // Try all categories in the hierarchy
  for (const cat of fact.category) {
    if (CATEGORY_TO_DOMAIN[cat]) {
      return CATEGORY_TO_DOMAIN[cat];
    }
  }

  return DEFAULT_DOMAIN;
}

/**
 * Returns the CardType associated with a given FactDomain.
 *
 * @param domain - The knowledge domain.
 * @returns The combat card type for this domain.
 */
export function resolveCardType(domain: FactDomain): CardType {
  return DOMAIN_CARD_TYPE[domain];
}
```

**Acceptance Criteria:**
- `resolveDomain({ category: ['History', 'Ancient Rome'] } as Fact)` returns `'history'`
- `resolveDomain({ category: ['Natural Sciences', 'Chemistry'] } as Fact)` returns `'science'`
- `resolveDomain({ category: ['Language', 'Japanese', 'N3'] } as Fact)` returns `'language'`
- `resolveDomain({ category: ['Life Sciences', 'Biology'] } as Fact)` returns `'medicine'`
- `resolveDomain({ category: ['Culture', 'Music'] } as Fact)` returns `'arts'`
- `resolveDomain({ category: ['Technology', 'AI'] } as Fact)` returns `'technology'`
- `resolveDomain({ category: ['Unknown Category'] } as Fact)` returns `'science'` (fallback)
- `resolveCardType('science')` returns `'attack'`
- `resolveCardType('history')` returns `'shield'`
- `npm run typecheck` passes

---

### Sub-step 3: Card Factory

**File:** `src/services/cardFactory.ts` (NEW)

Creates `Card` instances from a `Fact` and its optional `ReviewState`.

```typescript
import type { Fact, ReviewState } from '../data/types';
import type { Card, CardTier } from '../data/card-types';
import { resolveDomain, resolveCardType } from './domainResolver';
import { BASE_EFFECT, TIER_MULTIPLIER, EASE_POWER } from '../data/balance';

let _cardIdCounter = 0;

/** Generates a unique per-run card ID. Resets are not needed since IDs are run-scoped. */
function generateCardId(): string {
  _cardIdCounter += 1;
  return `card_${_cardIdCounter}`;
}

/**
 * Resets the card ID counter. Call at the start of each new run.
 */
export function resetCardIdCounter(): void {
  _cardIdCounter = 0;
}

/**
 * Computes the card tier from SM-2 review state.
 *
 * - Tier 3: interval >= 21 AND repetitions >= 5 (mastered — passive effect)
 * - Tier 2: interval >= 3 AND repetitions >= 3 (familiar)
 * - Tier 1: everything else (new/learning)
 *
 * If no reviewState is provided, defaults to Tier 1.
 */
export function computeTier(reviewState: ReviewState | undefined): CardTier {
  if (!reviewState) return 1;
  if (reviewState.interval >= 21 && reviewState.repetitions >= 5) return 3;
  if (reviewState.interval >= 3 && reviewState.repetitions >= 3) return 2;
  return 1;
}

/**
 * Computes the effect multiplier from the SM-2 ease factor.
 *
 * Lower ease = harder card = higher multiplier (difficulty-proportional power).
 * Cards the player struggles with hit harder — rewarding perseverance.
 *
 * Uses the EASE_POWER lookup table from balance.ts:
 *   ease < 1.5  → 1.6x (Very Hard)
 *   ease < 2.0  → 1.3x (Hard)
 *   ease < 2.5  → 1.0x (Medium)
 *   ease >= 2.5 → 0.8x (Easy)
 *
 * If no reviewState, defaults to 1.0x (medium).
 */
export function computeEffectMultiplier(reviewState: ReviewState | undefined): number {
  if (!reviewState) return 1.0;
  const ease = reviewState.easeFactor;
  for (const bracket of EASE_POWER) {
    if (ease < bracket.maxEase) {
      return bracket.multiplier;
    }
  }
  // Fallback (should not reach here given Infinity sentinel)
  return 1.0;
}

/**
 * Creates a Card entity from a Fact and its optional SM-2 ReviewState.
 *
 * @param fact - The source fact from the facts DB.
 * @param reviewState - The player's SM-2 state for this fact, or undefined if new.
 * @returns A fully initialized Card ready for deck insertion.
 */
export function createCard(fact: Fact, reviewState: ReviewState | undefined): Card {
  const domain = resolveDomain(fact);
  const cardType = resolveCardType(domain);
  const tier = computeTier(reviewState);
  const baseEffectValue = (BASE_EFFECT[cardType] ?? 0) * (TIER_MULTIPLIER[tier] ?? 1.0);
  const effectMultiplier = computeEffectMultiplier(reviewState);

  return {
    id: generateCardId(),
    factId: fact.id,
    cardType,
    domain,
    tier,
    baseEffectValue,
    effectMultiplier,
  };
}
```

**Acceptance Criteria:**
- `createCard(scienceFact, undefined)` returns tier 1, cardType 'attack', effectMultiplier 1.0
- `createCard(historyFact, stateWith3days3reps)` returns tier 2
- `createCard(fact, stateWith21days5reps)` returns tier 3
- `createCard(fact, stateWithEase1.3)` returns effectMultiplier 1.6 (very hard)
- `createCard(fact, stateWithEase2.8)` returns effectMultiplier 0.8 (easy)
- Tier 3 cards have `baseEffectValue` of 0 (passive, per `TIER_MULTIPLIER[3] = 0`)
- Each call to `createCard` produces a unique `card.id`
- `npm run typecheck` passes

---

### Sub-step 4: Run Pool Builder

**File:** `src/services/runPoolBuilder.ts` (NEW)

Builds the initial card pool for a run by combining primary domain, secondary domain, and SM-2 review queue cards.

```typescript
import type { Fact, ReviewState } from '../data/types';
import type { Card, FactDomain } from '../data/card-types';
import { factsDB } from './factsDB';
import { createCard, resetCardIdCounter } from './cardFactory';
import { resolveDomain } from './domainResolver';
import { DEFAULT_POOL_SIZE, POOL_PRIMARY_PCT, POOL_SECONDARY_PCT, POOL_REVIEW_PCT } from '../data/balance';
import { isDue } from './sm2';

/** Maps a FactDomain back to the top-level category string used in factsDB. */
const DOMAIN_TO_CATEGORY: Record<FactDomain, string[]> = {
  science:    ['Natural Sciences'],
  history:    ['History'],
  geography:  ['Geography'],
  language:   ['Language'],
  math:       ['Natural Sciences'],   // Math facts are filed under Natural Sciences currently
  arts:       ['Culture'],
  medicine:   ['Life Sciences'],
  technology: ['Technology'],
};

/**
 * Shuffles an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds the initial card pool for a run.
 *
 * Composition:
 *   - 40% from the primary domain
 *   - 30% from the secondary domain
 *   - 30% from the SM-2 review queue (due or near-due cards across all domains)
 *
 * If a domain doesn't have enough facts to fill its allocation, the shortfall
 * is redistributed to the review pool, then to the other domain, then filled
 * with random facts as a last resort.
 *
 * @param primaryDomain - The player's chosen primary knowledge domain.
 * @param secondaryDomain - The player's chosen secondary knowledge domain.
 * @param allReviewStates - All of the player's SM-2 review states.
 * @param options.poolSize - Target pool size (default 120).
 * @returns A shuffled array of Card objects ready for deck construction.
 */
export function buildRunPool(
  primaryDomain: FactDomain,
  secondaryDomain: FactDomain,
  allReviewStates: ReviewState[],
  options?: { poolSize?: number },
): Card[] {
  const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
  resetCardIdCounter();

  const primaryTarget = Math.round(poolSize * POOL_PRIMARY_PCT);
  const secondaryTarget = Math.round(poolSize * POOL_SECONDARY_PCT);
  const reviewTarget = poolSize - primaryTarget - secondaryTarget;

  // Build a review state lookup by factId
  const stateByFactId = new Map<string, ReviewState>();
  for (const rs of allReviewStates) {
    stateByFactId.set(rs.factId, rs);
  }

  // Helper: get facts for a domain
  function getFactsForDomain(domain: FactDomain, limit: number): Fact[] {
    const categories = DOMAIN_TO_CATEGORY[domain] ?? [];
    return factsDB.getByCategory(categories, limit);
  }

  // Helper: convert facts to cards
  function factsToCards(facts: Fact[]): Card[] {
    return facts.map(f => createCard(f, stateByFactId.get(f.id)));
  }

  // 1. Primary domain cards
  const primaryFacts = getFactsForDomain(primaryDomain, primaryTarget);
  const primaryCards = factsToCards(primaryFacts);
  const usedFactIds = new Set(primaryFacts.map(f => f.id));

  // 2. Secondary domain cards (exclude already-used facts)
  const secondaryFacts = getFactsForDomain(secondaryDomain, secondaryTarget + 20)
    .filter(f => !usedFactIds.has(f.id))
    .slice(0, secondaryTarget);
  const secondaryCards = factsToCards(secondaryFacts);
  for (const f of secondaryFacts) usedFactIds.add(f.id);

  // 3. Review queue cards (due or near-due, any domain, excluding already-used)
  const reviewCandidates = allReviewStates
    .filter(rs => !usedFactIds.has(rs.factId))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt) // most overdue first
    .slice(0, reviewTarget + 20);

  const reviewCards: Card[] = [];
  for (const rs of reviewCandidates) {
    if (reviewCards.length >= reviewTarget) break;
    const fact = factsDB.getById(rs.factId);
    if (fact && !usedFactIds.has(fact.id)) {
      reviewCards.push(createCard(fact, rs));
      usedFactIds.add(fact.id);
    }
  }

  // 4. Combine and check for shortfall
  let pool = [...primaryCards, ...secondaryCards, ...reviewCards];

  // If under target, fill with random facts not already in pool
  if (pool.length < poolSize) {
    const shortage = poolSize - pool.length;
    const fillerFacts = factsDB.getRandom(shortage + 20)
      .filter(f => !usedFactIds.has(f.id))
      .slice(0, shortage);
    pool.push(...factsToCards(fillerFacts));
  }

  // Trim to exact pool size (in case of rounding overshoot)
  pool = pool.slice(0, poolSize);

  return shuffle(pool);
}
```

**Acceptance Criteria:**
- `buildRunPool('science', 'history', reviewStates)` returns an array of Card objects
- Pool size defaults to 120 (or within 80-120 range given available facts)
- Primary domain cards make up ~40% of the pool (within ±5%)
- Secondary domain cards make up ~30% (within ±5%)
- Review queue cards make up ~30% (within ±5%)
- No duplicate `factId` values in the returned pool
- All returned objects satisfy the `Card` interface
- Pool is shuffled (not in domain-sorted order)
- `npm run typecheck` passes

---

### Sub-step 5: Deck Manager

**File:** `src/services/deckManager.ts` (NEW)

Manages draw/discard/exhaust pile operations during a run. Pure functions operating on `CardRunState`.

```typescript
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
```

**Acceptance Criteria:**
- `createDeck(pool)` returns a `CardRunState` with drawPile.length === pool.length, empty hand/discard/exhaust
- `drawHand(deck)` draws 5 cards from drawPile into hand
- `drawHand(deck, 3)` draws exactly 3 cards
- After `drawHand`, drawPile.length decreases by the number drawn
- `playCard(deck, cardId)` moves the card from hand to discardPile
- `playCard` throws if cardId not in hand
- `discardCard` behaves same as playCard (hand → discard)
- `exhaustCard(deck, cardId)` moves card from hand to exhaustPile
- `exhaustCard` throws if cardId not in hand
- When drawPile is empty and drawHand is called, discardPile is shuffled into drawPile
- If both drawPile and discardPile are empty, drawHand returns fewer cards than requested (no crash)
- `getDeckStats` returns correct counts for all piles
- `npm run typecheck` passes

---

### Sub-step 6: Card Balance Constants

**File:** `src/data/balance.ts` (MODIFY — append to existing file)

Add card combat constants after the existing constants. Import `CardType` from `card-types.ts`.

**IMPORTANT:** The new constants must be exported as standalone `export const` declarations (not inside the `BALANCE` object) to match the pattern already used for SM-2 constants at the bottom of the file.

```typescript
// ============================================================
// CARD ROGUELITE BALANCE (CR-01)
// ============================================================

import type { CardType } from './card-types';

// Card Combat
export const HAND_SIZE = 5;
export const DEFAULT_POOL_SIZE = 120;
export const POOL_PRIMARY_PCT = 0.40;
export const POOL_SECONDARY_PCT = 0.30;
export const POOL_REVIEW_PCT = 0.30;

// Base effect values by card type
export const BASE_EFFECT: Record<CardType, number> = {
  attack: 8,
  shield: 6,
  heal: 5,
  utility: 0,
  buff: 0,
  debuff: 0,
  regen: 3,
  wild: 0,
};

// Tier multipliers — Tier 3 is passive (no active effect value)
export const TIER_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.5,
  3: 0,
};

// Difficulty-proportional power: lower ease = harder card = higher multiplier
// Sorted ascending by maxEase. First match wins.
export const EASE_POWER: Array<{ maxEase: number; multiplier: number }> = [
  { maxEase: 1.5,      multiplier: 1.6 },  // Very Hard (ease < 1.5)
  { maxEase: 2.0,      multiplier: 1.3 },  // Hard      (ease < 2.0)
  { maxEase: 2.5,      multiplier: 1.0 },  // Medium    (ease < 2.5)
  { maxEase: Infinity,  multiplier: 0.8 },  // Easy      (ease >= 2.5)
];

// Player defaults
export const PLAYER_START_HP = 80;
export const PLAYER_MAX_HP = 80;
export const HINTS_PER_ENCOUNTER = 1;

// Speed scaling (timer in seconds by floor)
export const FLOOR_TIMER: Array<{ maxFloor: number; seconds: number }> = [
  { maxFloor: 3,        seconds: 12 },
  { maxFloor: 6,        seconds: 9 },
  { maxFloor: 9,        seconds: 7 },
  { maxFloor: 12,       seconds: 5 },
  { maxFloor: Infinity, seconds: 4 },
];

// Knowledge combo multipliers
// Index 0 = 1st correct, index 4 = 5th correct (perfect turn)
export const COMBO_MULTIPLIERS = [1.0, 1.15, 1.3, 1.5, 2.0];

// Speed bonus
export const SPEED_BONUS_THRESHOLD = 0.25;    // answer in first 25% of timer
export const SPEED_BONUS_MULTIPLIER = 1.5;
```

**NOTE on import placement:** Because `balance.ts` currently has no imports from `card-types.ts`, and `balance.ts` uses `as const` throughout, the new `CardType` import must be added at the top of the file alongside the existing imports. If circular import issues arise (card-types importing from balance, balance importing from card-types), extract `CardType` to a separate tiny types file, or use inline `Record<string, number>` for `BASE_EFFECT` instead.

**Fallback if circular import:** Use `Record<string, number>` for `BASE_EFFECT` instead of `Record<CardType, number>` and add a code comment explaining why. This avoids any import cycle between `balance.ts` and `card-types.ts`.

**Acceptance Criteria:**
- All constants are exported and accessible: `HAND_SIZE`, `DEFAULT_POOL_SIZE`, `POOL_PRIMARY_PCT`, `POOL_SECONDARY_PCT`, `POOL_REVIEW_PCT`, `BASE_EFFECT`, `TIER_MULTIPLIER`, `EASE_POWER`, `PLAYER_START_HP`, `PLAYER_MAX_HP`, `HINTS_PER_ENCOUNTER`, `FLOOR_TIMER`, `COMBO_MULTIPLIERS`, `SPEED_BONUS_THRESHOLD`, `SPEED_BONUS_MULTIPLIER`
- `BASE_EFFECT.attack === 8`, `BASE_EFFECT.shield === 6`, `BASE_EFFECT.heal === 5`, `BASE_EFFECT.regen === 3`
- `TIER_MULTIPLIER[1] === 1.0`, `TIER_MULTIPLIER[2] === 1.5`, `TIER_MULTIPLIER[3] === 0`
- `EASE_POWER` has 4 entries sorted by ascending `maxEase`
- No circular import errors
- `npm run typecheck` passes
- `npm run build` succeeds

---

### Sub-step 7: Unit Tests

**File:** `tests/unit/card-foundation.test.ts` (NEW)

Comprehensive unit tests for all CR-01 modules.

```typescript
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
```

**NOTE:** The `buildRunPool` tests are excluded from the unit test file because they depend on `factsDB` being initialized with a SQLite WASM database, which is not available in the Vitest unit test environment. Integration testing for `buildRunPool` will be handled in a later phase (CR-02 or an E2E test).

**Acceptance Criteria:**
- All tests pass: `npx vitest run tests/unit/card-foundation.test.ts`
- Coverage includes:
  - `resolveDomain`: 7 category mappings + 1 fallback = 8 tests
  - `resolveCardType`: 2 specific + 1 exhaustive = 3 tests
  - `computeTier`: 6 boundary tests
  - `computeEffectMultiplier`: 5 tests (no state + 4 brackets)
  - `createCard`: 4 tests (domain/type, unique IDs, base effect calc, factId linking)
  - `drawHand`: 4 tests (default 5, custom count, reshuffle, empty piles)
  - `playCard`: 2 tests (success, throw on missing)
  - `discardCard`: 1 test
  - `exhaustCard`: 2 tests (success, throw on missing)
  - `getDeckStats`: 1 test
  - `reshuffleDiscard`: 1 test
  - Total: 31 test cases

---

## Verification Gate

All of the following MUST pass before CR-01 is marked complete:

1. **TypeScript:** `npm run typecheck` — zero errors
2. **Build:** `npm run build` — succeeds with no errors
3. **Unit tests:** `npx vitest run tests/unit/card-foundation.test.ts` — all 31 tests pass
4. **Existing tests:** `npx vitest run` — all 215+ existing tests still pass (no regressions)
5. **No circular imports:** Verify that the import chain `card-types.ts` ← `balance.ts` ← `cardFactory.ts` ← `runPoolBuilder.ts` has no cycles
6. **No runtime side effects:** All new modules are pure — no code executes on import (except const definitions)

---

## Files Affected

### New Files
| File | Purpose |
|------|---------|
| `src/data/card-types.ts` | Card type definitions, interfaces, DOMAIN_CARD_TYPE constant |
| `src/services/domainResolver.ts` | Maps Fact.category → FactDomain → CardType |
| `src/services/cardFactory.ts` | Creates Card instances from Fact + ReviewState |
| `src/services/runPoolBuilder.ts` | Builds the 120-card pool for a run |
| `src/services/deckManager.ts` | Draw/play/discard/exhaust pile management |
| `tests/unit/card-foundation.test.ts` | Unit tests for all CR-01 modules |

### Modified Files
| File | Change |
|------|--------|
| `src/data/balance.ts` | Append card roguelite balance constants (HAND_SIZE, BASE_EFFECT, TIER_MULTIPLIER, EASE_POWER, FLOOR_TIMER, COMBO_MULTIPLIERS, etc.) |
