/** Maps deck IDs to their fact IDs, including sub-deck breakdowns and tag index. */
export interface DeckFactMapping {
  /** All fact IDs in this deck. */
  allFacts: string[];
  /** Sub-deck ID -> fact IDs. Only present if deck has sub-decks. */
  subDecks?: Record<string, string[]>;
  /** Tag -> fact IDs that carry that tag. */
  tagIndex?: Record<string, string[]>;
  /** All unique exam tags present in this deck, sorted alphabetically. */
  allTags?: string[];
}

/** Central index mapping deck IDs to fact IDs. Populated at startup. */
const DECK_FACT_INDEX: Map<string, DeckFactMapping> = new Map();

/** Get fact IDs for a deck. */
export function getDeckFactIds(deckId: string): string[] {
  return DECK_FACT_INDEX.get(deckId)?.allFacts ?? [];
}

/** Get fact IDs for a specific sub-deck. */
export function getSubDeckFactIds(deckId: string, subDeckId: string): string[] {
  return DECK_FACT_INDEX.get(deckId)?.subDecks?.[subDeckId] ?? [];
}

/**
 * Get fact IDs for facts carrying at least one of the given exam tags.
 * Returns the union of all matching fact IDs (de-duplicated).
 */
export function getTagFactIds(deckId: string, tags: string[]): string[] {
  const tagIndex = DECK_FACT_INDEX.get(deckId)?.tagIndex;
  if (!tagIndex || tags.length === 0) return [];
  const seen = new Set<string>();
  for (const tag of tags) {
    for (const id of (tagIndex[tag] ?? [])) {
      seen.add(id);
    }
  }
  return Array.from(seen);
}

/** Get all unique exam tags present in a deck. */
export function getDeckTags(deckId: string): string[] {
  return DECK_FACT_INDEX.get(deckId)?.allTags ?? [];
}

/** Get the full mapping for a deck. */
export function getDeckFactMapping(deckId: string): DeckFactMapping | undefined {
  return DECK_FACT_INDEX.get(deckId);
}

/** Register fact mappings for a deck. Called at startup. */
export function registerDeckFacts(deckId: string, mapping: DeckFactMapping): void {
  DECK_FACT_INDEX.set(deckId, mapping);
}
