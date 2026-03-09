import type { Fact, ReviewState } from '../data/types';
import type { Card, CardTier } from '../data/card-types';
import { resolveDomain, resolveCardType } from './domainResolver';
import { BASE_EFFECT, EASE_POWER } from '../data/balance';
import { getCardTier, qualifiesForMasteryTrial } from './tierDerivation';

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
 * Computes card tier from review progression state.
 */
export function computeTier(reviewState: ReviewState | undefined): CardTier {
  return getCardTier({
    stability: reviewState?.stability ?? reviewState?.interval ?? 0,
    consecutiveCorrect: reviewState?.consecutiveCorrect ?? reviewState?.repetitions ?? 0,
    passedMasteryTrial: reviewState?.passedMasteryTrial ?? false,
  });
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
  const baseEffectValue = BASE_EFFECT[cardType] ?? 0;
  const effectMultiplier = computeEffectMultiplier(reviewState);
  const isMasteryTrial = qualifiesForMasteryTrial({
    stability: reviewState?.stability ?? reviewState?.interval ?? 0,
    consecutiveCorrect: reviewState?.consecutiveCorrect ?? reviewState?.repetitions ?? 0,
    passedMasteryTrial: reviewState?.passedMasteryTrial ?? false,
  });

  return {
    id: generateCardId(),
    factId: fact.id,
    cardType,
    domain,
    tier,
    baseEffectValue,
    effectMultiplier,
    isMasteryTrial,
  };
}
