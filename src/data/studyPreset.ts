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

/** A single deck item in a playlist run. */
export interface PlaylistDeckItem {
  deckId: string;
  subDeckId?: string;
  examTags?: string[];
}

/** The active study mode for the current/next run. */
export type DeckMode =
  | { type: 'general' }
  | { type: 'preset'; presetId: string }
  | { type: 'language'; languageCode: string }
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
  | { type: 'study'; deckId: string; subDeckId?: string; examTags?: string[] }
  | { type: 'procedural'; deckId: string; subDeckId?: string }
  | { type: 'playlist'; items: PlaylistDeckItem[] };

/** A single item in a custom playlist — either a trivia domain or a curated study deck. */
export type CustomPlaylistItem =
  | { type: 'trivia'; domain: string; subdomain?: string; label: string }
  | { type: 'study'; deckId: string; subDeckId?: string; label: string };

/** A named custom playlist combining items from trivia domains and/or curated decks. */
export interface CustomPlaylist {
  /** Unique ID (timestamp-based, e.g. Date.now().toString(36)). */
  id: string;
  /** User-chosen name, e.g. "Japanese + Space". */
  name: string;
  /** When this playlist was created (Unix ms). */
  createdAt: number;
  /** Items in this playlist. */
  items: CustomPlaylistItem[];
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
  /** Named custom playlists. */
  customPlaylists?: CustomPlaylist[];
  /** ID of the currently active playlist. */
  activePlaylistId?: string;
}
