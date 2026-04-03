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
import type { ProceduralDeck } from '../../data/proceduralDeckTypes';

/** All procedural math decks in definition order. */
export const PROCEDURAL_DECKS: ProceduralDeck[] = [ARITHMETIC_DECK, MENTAL_MATH_DECK];

/**
 * Look up a procedural deck by ID.
 *
 * @param deckId - The unique deck ID (e.g. 'arithmetic', 'mental_math').
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
      artPlaceholder: {
        gradientFrom: '#3B82F6',
        gradientTo: '#1D4ED8',
        icon: '🔢',
      },
    });
  }
}
