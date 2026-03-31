/**
 * Catch-Up Mastery Service — computes starting mastery for newly acquired cards.
 *
 * Late-game card picks get catch-up mastery proportional to the deck's average
 * mastery level so they are not dead on arrival. Early-game picks (avg < 1) stay
 * at L0 so the ramp feels natural.
 *
 * Hook: called from encounterBridge.addRewardCardToActiveDeck().
 * The caller passes in current deck cards to avoid a circular import.
 */

import type { Card } from '../data/card-types';
import { MASTERY_UPGRADE_DEFS } from './cardUpgradeService';
import { MASTERY_MAX_LEVEL } from '../data/balance';

/**
 * Compute starting mastery level for a newly acquired card based on
 * the average mastery of the player's current deck.
 *
 * @param card - The newly acquired card
 * @param deckCards - Current deck cards (all piles) — passed by caller to avoid circular import
 *
 * Behavior by game phase:
 * - Avg 0.0 (run start) → L0
 * - Avg 1.0 (early) → L0-1 possible
 * - Avg 2.5 (mid) → L1-3 range
 * - Avg 4.0 (late) → L2-5 range, never useless
 *
 * The random roll (0.5–1.5× avg) means the median new card lands ~0.8× the
 * current average — slightly behind the pack but immediately competitive.
 */
export function computeCatchUpMastery(card: Card, deckCards: Card[]): number {
  if (deckCards.length === 0) return 0;

  const avgMastery = deckCards.reduce((sum, c) => sum + (c.masteryLevel ?? 0), 0) / deckCards.length;
  if (avgMastery < 1) return 0; // Too early in the run for catch-up

  // Uniform roll 0.5×–1.5× the average; median ≈ 0.8× so new cards are slightly
  // behind the average but never completely outclassed
  const roll = 0.5 + Math.random(); // 0.5 to 1.5
  const rawLevel = Math.floor(roll * avgMastery);

  const def = MASTERY_UPGRADE_DEFS[card.mechanicId ?? ''];
  const maxLevel = def?.maxLevel ?? MASTERY_MAX_LEVEL;

  return Math.min(Math.max(rawLevel, 0), maxLevel);
}
