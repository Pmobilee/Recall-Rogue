/**
 * Registry for all procedural math decks.
 *
 * Provides lookup by ID and a one-call registration function that inserts
 * every procedural deck into the shared DeckRegistry used by the Study Temple
 * deck-selection UI. Call `registerProceduralDecks()` once at app startup —
 * idempotent (registerDeck replaces on duplicate ID).
 *
 * Source files: src/services/math/proceduralDeckRegistry.ts
 * Related docs: docs/content/deck-system.md
 */

import { registerDeck } from '../../data/deckRegistry';
import { ARITHMETIC_DECK } from '../../data/mathDecks/arithmetic';
import { MENTAL_MATH_DECK } from '../../data/mathDecks/mentalMath';
import { GEOMETRY_DECK } from '../../data/mathDecks/geometry';
import { ALGEBRA_DECK } from '../../data/mathDecks/algebra';
import { STATISTICS_DECK } from '../../data/mathDecks/statistics';
import { TRIGONOMETRY_DECK } from '../../data/mathDecks/trigonometry';
import type { ProceduralDeck } from '../../data/proceduralDeckTypes';

/** Per-deck art placeholder overrides for Study Temple deck tiles. */
const deckArtPlaceholders: Record<string, { gradientFrom: string; gradientTo: string; icon: string }> = {
  arithmetic:   { gradientFrom: '#3B82F6', gradientTo: '#1D4ED8', icon: '🔢' },
  mental_math:  { gradientFrom: '#3B82F6', gradientTo: '#1D4ED8', icon: '🧠' },
  algebra:      { gradientFrom: '#8B5CF6', gradientTo: '#6D28D9', icon: '𝑥' },
  geometry:     { gradientFrom: '#10B981', gradientTo: '#047857', icon: '📐' },
  trigonometry: { gradientFrom: '#F59E0B', gradientTo: '#D97706', icon: '📊' },
  statistics:   { gradientFrom: '#06B6D4', gradientTo: '#0E7490', icon: '📈' },
};

/** All procedural math decks in definition order. */
export const PROCEDURAL_DECKS: ProceduralDeck[] = [
  ARITHMETIC_DECK,
  MENTAL_MATH_DECK,
  ALGEBRA_DECK,
  GEOMETRY_DECK,
  STATISTICS_DECK,
  TRIGONOMETRY_DECK,
];

/**
 * Look up a procedural deck by ID.
 *
 * @param deckId - The unique deck ID (e.g. 'arithmetic', 'mental_math', 'algebra', 'statistics', 'trigonometry').
 * @returns The ProceduralDeck, or undefined if not found.
 */
export function getProceduralDeck(deckId: string): ProceduralDeck | undefined {
  return PROCEDURAL_DECKS.find(d => d.id === deckId);
}

/**
 * Register all procedural math decks into the shared deck registry.
 *
 * Must be called once at app startup — before any UI component reads the
 * registry. Safe to call multiple times (registerDeck replaces on duplicate ID).
 */
export function registerProceduralDecks(): void {
  for (const deck of PROCEDURAL_DECKS) {
    registerDeck({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      domain: 'mathematics',
      factCount: deck.skills.length,
      subDecks: deck.subDecks.map(sd => ({
        id: sd.id,
        name: sd.name,
        factCount: sd.skillIds.length,
      })),
      tier: 1,
      status: 'available',
      procedural: true,
      artPlaceholder: deckArtPlaceholders[deck.id] ?? {
        gradientFrom: '#3B82F6',
        gradientTo: '#1D4ED8',
        icon: '🔢',
      },
    });
  }
}
