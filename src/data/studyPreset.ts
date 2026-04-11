/**
 * Study preset types for the deck builder system.
 * A preset is a saved configuration of domain/subcategory selections.
 */

export interface StudyPreset {
  /** Unique preset ID (nanoid). */
  id: string;
  /** User-chosen name, max 30 chars. */
  name: string;
  /** Creation timestamp (Unix ms). */
  createdAt: number;
  /** Last update timestamp (Unix ms). */
  updatedAt: number;
  /** Domain selections: key = CanonicalFactDomain, value = subcategories (empty array = all subcategories). */
  domainSelections: Record<string, string[]>;
  /** Cached fact count at last edit (for UI display, not authoritative). */
  cachedFactCount: number;
}

/** A single deck item in a custom deck run. */
export interface CustomDeckRunItem {
  deckId: string;
  subDeckId?: string;
  examTags?: string[];
}

/**
 * A single deck entry in a study-multi run.
 * subDeckIds === 'all' means include all sub-decks; an array of strings
 * means include only those specific sub-deck IDs.
 */
export interface StudyMultiDeckEntry {
  deckId: string;
  subDeckIds: string[] | 'all';
}

/** The active study mode for the current/next run. */
export type DeckMode =
  | { type: 'general' }
  | { type: 'preset'; presetId: string }
  | { type: 'language'; languageCode: string }
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
  | { type: 'study'; deckId: string; subDeckId?: string; examTags?: string[] }
  | { type: 'procedural'; deckId: string; subDeckId?: string }
  | { type: 'custom_deck'; items: CustomDeckRunItem[] }
  | {
      /**
       * Multi-source run: curated study decks (optionally narrowed to sub-deck ID lists)
       * merged with trivia-domain facts. Introduced in Issue 2 (2026-04-11).
       *
       * Pool assembly rules (all in encounterBridge.ts):
       * - Each entry in `decks[]` expands to: whole deck when subDeckIds==='all',
       *   or facts matching specified subDeckIds when a list is given.
       * - Each entry in `triviaDomains[]` maps to buildPresetRunPool with that domain key.
       * - All resulting cards are merged and deduplicated by factId (first-seen wins).
       * - Empty decks and empty triviaDomains both produce an empty contribution (no crash).
       */
      type: 'study-multi';
      decks: StudyMultiDeckEntry[];
      triviaDomains: string[];
    };

/** A single item in a custom deck — either a trivia domain or a curated study deck. */
export type CustomDeckItem =
  | { type: 'trivia'; domain: string; subdomain?: string; label: string }
  | { type: 'study'; deckId: string; subDeckId?: string; label: string };

/** A named custom deck combining items from trivia domains and/or curated decks. */
export interface CustomDeck {
  /** Unique ID (timestamp-based, e.g. Date.now().toString(36)). */
  id: string;
  /** User-chosen name, e.g. "Japanese + Space". */
  name: string;
  /** When this custom deck was created (Unix ms). */
  createdAt: number;
  /** Items in this custom deck. */
  items: CustomDeckItem[];
}

/** Persisted last selection on the Dungeon Selection screen. */
export interface LastDungeonSelection {
  /** Which mode tab was last active. */
  mode: 'trivia' | 'study';
  /** Trivia Dungeon configuration. */
  triviaConfig?: {
    domains: string[];
    subdomains: Record<string, string[]>;
  };
  /** Study Temple configuration. */
  studyConfig?: {
    deckId: string;
    subDeckId?: string;
  };
  /** Named custom decks. */
  customDecks?: CustomDeck[];
  /** ID of the currently active custom deck. */
  activeCustomDeckId?: string;
}

// ---------------------------------------------------------------------------
// Deprecated aliases — kept for backward compatibility while ui-agent files
// are updated. Do NOT use in new code.
// ---------------------------------------------------------------------------

/** @deprecated Use CustomDeck */
export type CustomPlaylist = CustomDeck;
/** @deprecated Use CustomDeckItem */
export type CustomPlaylistItem = CustomDeckItem;
/** @deprecated Use CustomDeckRunItem */
export type PlaylistDeckItem = CustomDeckRunItem;
