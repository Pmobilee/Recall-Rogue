import type { Card } from '../data/card-types';

/**
 * Generate card reward options from the run pool.
 * Excludes cards already in the active deck, Tier 3 facts, and Echo cards.
 */
export function generateCardRewardOptions(
  runPool: Card[],
  activeDeckFactIds: Set<string>,
  consumedRewardFactIds: Set<string>,
  count: number = 3,
): Card[] {
  const eligible = runPool.filter((card) =>
    !activeDeckFactIds.has(card.factId) &&
    !consumedRewardFactIds.has(card.factId) &&
    card.tier !== '3' &&
    !card.isEcho
  );

  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

