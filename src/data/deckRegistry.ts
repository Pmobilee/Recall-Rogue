import type { CanonicalFactDomain } from './card-types';

/** A curated deck in the registry (metadata only, no facts). */
export interface DeckRegistryEntry {
  /** Unique deck ID, e.g. "japanese_n3" or "us_presidents". */
  id: string;
  /** Player-facing display name. */
  name: string;
  /** Short description for the deck detail panel. */
  description: string;
  /** Parent domain. 'vocabulary' for language decks. */
  domain: CanonicalFactDomain | 'vocabulary';
  /** Optional sub-domain, e.g. "capitals". */
  subDomain?: string;
  /** Total fact count in this deck. */
  factCount: number;
  /** Sub-decks within this deck (e.g., Vocabulary, Kanji, Grammar). */
  subDecks?: {
    id: string;
    name: string;
    factCount: number;
  }[];
  /** Launch priority tier. */
  tier: 1 | 2 | 3;
  /** Availability status. */
  status: 'available' | 'coming_soon';
  /** Placeholder art config for the deck tile. */
  artPlaceholder: {
    gradientFrom: string;
    gradientTo: string;
    icon: string;
  };
}

/** Central registry of all curated decks. Initially empty — populated as decks are built. */
const DECK_REGISTRY: DeckRegistryEntry[] = [];

/** Get all registered curated decks. */
export function getAllDecks(): DeckRegistryEntry[] {
  return DECK_REGISTRY;
}

/** Get curated decks for a specific domain. */
export function getDecksForDomain(domain: CanonicalFactDomain | 'vocabulary'): DeckRegistryEntry[] {
  return DECK_REGISTRY.filter(d => d.domain === domain);
}

/** Get a single deck by ID. */
export function getDeckById(id: string): DeckRegistryEntry | undefined {
  return DECK_REGISTRY.find(d => d.id === id);
}

/** Get all unique domains that have at least one deck. */
export function getDeckDomains(): (CanonicalFactDomain | 'vocabulary')[] {
  const domains = new Set(DECK_REGISTRY.map(d => d.domain));
  return Array.from(domains);
}

/**
 * Register a deck. Called at startup when loading deck JSON files.
 * Replaces existing entry with same ID if present.
 */
export function registerDeck(entry: DeckRegistryEntry): void {
  const idx = DECK_REGISTRY.findIndex(d => d.id === entry.id);
  if (idx >= 0) {
    DECK_REGISTRY[idx] = entry;
  } else {
    DECK_REGISTRY.push(entry);
  }
}
