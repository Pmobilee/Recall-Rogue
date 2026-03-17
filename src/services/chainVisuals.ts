// === Chain Visuals Service (AR-70) ===
// Provides color mapping from chainType (0-5) to the 6-color chain palette,
// and helper functions for building chain visual state.
// Used by CardHand.svelte to tint card edges and derive pulse groups.

import type { Card } from '../data/card-types';
import { getChainTypeColor, getChainTypeGlowColor } from '../data/chainTypes';

/**
 * Returns the hex color for a card's chain type.
 * If chainType is undefined, returns gray fallback.
 */
export function getChainColor(chainType: number | undefined): string {
  if (chainType === undefined) return '#888888';
  return getChainTypeColor(chainType);
}

/**
 * Returns the glow color for a card's chain type.
 */
export function getChainGlowColor(chainType: number | undefined): string {
  if (chainType === undefined) return 'rgba(136,136,136,0.30)';
  return getChainTypeGlowColor(chainType);
}

/**
 * Groups card IDs by their shared chainType.
 * Only includes groups with 2+ cards (potential chain partners).
 *
 * @returns Map<chainType, cardId[]>
 */
export function getChainColorGroups(cards: Card[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const card of cards) {
    if (card.chainType === undefined) continue;
    const existing = groups.get(card.chainType);
    if (existing) {
      existing.push(card.id);
    } else {
      groups.set(card.chainType, [card.id]);
    }
  }
  // Remove singleton groups — only chain partners matter
  for (const [key, ids] of groups) {
    if (ids.length < 2) groups.delete(key);
  }
  return groups;
}
