/**
 * Shared formatter for exam tag display labels.
 *
 * Used by DeckDetailModal, CustomDeckViewModal, and any future tag filter UI
 * so the two modals cannot drift independently.
 */

/**
 * Human-readable display labels for known exam tags.
 * Extend here as new tag families require custom wording.
 */
const STATIC_LABELS: Record<string, string> = {
  USMLE_Step1: 'USMLE Step 1',
  USMLE_Step2: 'USMLE Step 2',
  NBME_Shelf: 'NBME Shelf',
  COMLEX: 'COMLEX',
  PLAB: 'PLAB (UK)',
  AMC: 'AMC (AU)',
  MCAT: 'MCAT',
  high_yield: 'High Yield',
  clinical_correlation: 'Clinical',
  image_identification: 'Visual ID',
}

/**
 * Format a raw examTag key for display.
 *
 * Lookup order:
 * 1. STATIC_LABELS — medical/allied-health exam labels that need custom wording.
 * 2. Underscore-to-space fallback for pattern-based tags like `Topic_4.2`,
 *    `Unit_1`, `Period_7`, `AP_US_History` — these render naturally when
 *    underscores become spaces.
 *
 * The raw tag key stays untouched for filter logic; only the display label
 * changes.
 *
 * @param tag - Raw examTag key from the deck index (e.g. "Topic_4.2")
 * @returns Human-readable label (e.g. "Topic 4.2")
 */
export function formatExamTag(tag: string): string {
  if (tag in STATIC_LABELS) return STATIC_LABELS[tag]
  // Generic fallback: underscores → spaces.
  // Handles Topic_X.Y, Unit_N, Period_N, AP_*_History, and any future
  // Word_Number pattern without needing to enumerate every code in advance.
  return tag.replace(/_/g, ' ')
}
