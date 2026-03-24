/** Maps deck IDs to their fact IDs, including sub-deck breakdowns. */
export interface DeckFactMapping {
  /** All fact IDs in this deck. */
  allFacts: string[];
  /** Sub-deck ID -> fact IDs. Only present if deck has sub-decks. */
  subDecks?: Record<string, string[]>;
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

/** Get the full mapping for a deck. */
export function getDeckFactMapping(deckId: string): DeckFactMapping | undefined {
  return DECK_FACT_INDEX.get(deckId);
}

/** Register fact mappings for a deck. Called at startup. */
export function registerDeckFacts(deckId: string, mapping: DeckFactMapping): void {
  DECK_FACT_INDEX.set(deckId, mapping);
}
