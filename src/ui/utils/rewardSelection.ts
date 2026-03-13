import type { Card, CardType } from '../../data/card-types'

/**
 * Keep reward selection explicit: never auto-select on load.
 * Returns null unless the user-selected type is still present.
 */
export function normalizeRewardSelection(
  selectedType: CardType | null,
  options: Card[],
): CardType | null {
  if (!selectedType) return null
  return options.some((option) => option.cardType === selectedType) ? selectedType : null
}

