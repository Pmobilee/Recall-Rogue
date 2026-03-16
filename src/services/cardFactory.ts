import type { Fact, ReviewState } from '../data/types';
import type { Card, CardTier, CardType } from '../data/card-types';
import { resolveDomain } from './domainResolver';
import { BASE_EFFECT } from '../data/balance';
import { getCardTier, qualifiesForMasteryTrial } from './tierDerivation';
import { deriveCardTypeForFactId } from './cardTypeAllocator';

/** Card power scales with mastery tier — learning makes cards stronger. */
const TIER_MULTIPLIER: Record<CardTier, number> = {
  '1': 1.0,    // Learning — base power
  '2a': 1.3,   // Proven — 30% bonus
  '2b': 1.6,   // Deep recall — 60% bonus
  '3': 1.6,    // Mastered — permanent 60% bonus
};

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
 * Creates a Card entity from a Fact and its optional review state.
 *
 * @param fact - The source fact from the facts DB.
 * @param reviewState - The player's review state for this fact, or undefined if new.
 * @param cardTypeOverride - Optional explicit card type assigned by run pool builder.
 * @returns A fully initialized Card ready for deck insertion.
 */
export function createCard(
  fact: Fact,
  reviewState: ReviewState | undefined,
  cardTypeOverride?: CardType,
): Card {
  const domain = resolveDomain(fact);
  const cardType = cardTypeOverride ?? deriveCardTypeForFactId(fact.id);
  const tier = computeTier(reviewState);
  const baseEffectValue = BASE_EFFECT[cardType] ?? 0;
  const effectMultiplier = TIER_MULTIPLIER[tier] ?? 1.0;
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
