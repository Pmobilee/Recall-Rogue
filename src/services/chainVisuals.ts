// === Chain Visuals Service ===
// Provides color mapping from categoryL2 strings to a 12-color palette,
// and helper functions for building chain visual state.
// Used by CardHand.svelte to tint card edges and derive pulse groups.

import type { Card } from '../data/card-types';

/**
 * 12 distinct colors for the Knowledge Chain visual system.
 * Each categoryL2 string deterministically maps to one of these via FNV-1a hash.
 */
const CHAIN_COLOR_PALETTE: readonly string[] = [
  '#e74c3c', // Red
  '#e67e22', // Orange
  '#f1c40f', // Yellow
  '#2ecc71', // Green
  '#1abc9c', // Teal
  '#00bcd4', // Cyan
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e91e8c', // Pink
  '#ffd700', // Gold
  '#ecf0f1', // White
  '#95a5a6', // Gray (fallback / undefined)
] as const;

const FALLBACK_COLOR = '#95a5a6'; // Gray

/**
 * FNV-1a 32-bit hash of a string.
 * Identical algorithm to CardHand.svelte's hashString function.
 */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Returns a deterministic hex color for the given categoryL2 value.
 * If categoryL2 is undefined or empty, returns the Gray fallback (#95a5a6).
 *
 * @example
 * getChainColor('ancient_classical') // always returns the same hex color
 */
export function getChainColor(categoryL2: string | undefined): string {
  if (!categoryL2) return FALLBACK_COLOR;
  const index = hashString(categoryL2) % CHAIN_COLOR_PALETTE.length;
  return CHAIN_COLOR_PALETTE[index];
}

/**
 * Groups card IDs by their shared categoryL2.
 * Only includes groups with 2+ cards (potential chain partners).
 *
 * @returns Map<categoryL2, cardId[]>
 */
export function getChainColorGroups(cards: Card[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const card of cards) {
    if (!card.categoryL2) continue;
    const existing = groups.get(card.categoryL2);
    if (existing) {
      existing.push(card.id);
    } else {
      groups.set(card.categoryL2, [card.id]);
    }
  }
  // Remove singleton groups — only chain partners matter
  for (const [key, ids] of groups) {
    if (ids.length < 2) groups.delete(key);
  }
  return groups;
}
