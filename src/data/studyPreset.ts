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

/** The active study mode for the current/next run. */
export type DeckMode =
  | { type: 'general' }
  | { type: 'preset'; presetId: string }
  | { type: 'language'; languageCode: string };
