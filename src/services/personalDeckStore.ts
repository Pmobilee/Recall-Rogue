/**
 * Personal deck persistence service.
 *
 * Manages player-created and Anki-imported decks stored in PlayerSave.personalDecks.
 * At startup, personal decks are registered into the in-memory deck registry and the
 * curated deck store so the quiz engine can serve their facts.
 *
 * Persistence uses the playerSave Svelte store + persistPlayer() — the same pattern
 * used throughout playerData.ts.
 */

import { get } from 'svelte/store';
import type { PersonalDeck } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';
import { playerSave, persistPlayer } from '../ui/stores/playerData';
import { registerDeck } from '../data/deckRegistry';
import { registerPersonalDeckInStore } from '../data/curatedDeckStore';
import { registerDeckFacts } from '../data/deckFactIndex';

// ---------------------------------------------------------------------------
// In-memory map for fast lookups (populated by registerPersonalDecks)
// ---------------------------------------------------------------------------

/** In-memory map of personal deck ID → PersonalDeck. Populated at startup. */
const personalDeckMap: Map<string, PersonalDeck> = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all personal decks from the current player save.
 * Returns an empty array if no save is loaded or no personal decks exist.
 */
export function getPersonalDecks(): PersonalDeck[] {
  return get(playerSave)?.personalDecks ?? [];
}

/**
 * Get a personal deck by ID.
 * Checks the in-memory map first (fast path after registerPersonalDecks),
 * then falls back to scanning the player save.
 */
export function getPersonalDeck(deckId: string): PersonalDeck | undefined {
  return personalDeckMap.get(deckId) ?? getPersonalDecks().find(d => d.id === deckId);
}

/**
 * Get the full PersonalDeck data for a given deck ID.
 * Used by the quiz engine to access facts for personal decks.
 */
export function getPersonalDeckData(deckId: string): PersonalDeck | undefined {
  return personalDeckMap.get(deckId);
}

/**
 * Save a personal deck to the player's save data.
 * If a deck with the same ID already exists, it is replaced.
 * Also registers the deck in the in-memory store immediately.
 *
 * @param deck - The PersonalDeck to save.
 */
export function savePersonalDeck(deck: PersonalDeck): void {
  const current = get(playerSave);
  if (!current) {
    console.warn('[personalDeckStore] Cannot save personal deck — no player save loaded');
    return;
  }

  const existing = current.personalDecks ?? [];
  const idx = existing.findIndex(d => d.id === deck.id);

  const updated = idx >= 0
    ? existing.map((d, i) => (i === idx ? deck : d))
    : [...existing, deck];

  playerSave.update(s => s ? { ...s, personalDecks: updated } : s);
  persistPlayer();

  // Register immediately so the quiz engine can access it in the same session.
  _registerSingleDeck(deck);
}

/**
 * Delete a personal deck from the player's save data.
 * Also removes it from the in-memory map.
 *
 * @param deckId - ID of the deck to delete.
 */
export function deletePersonalDeck(deckId: string): void {
  const current = get(playerSave);
  if (!current) return;

  const updated = (current.personalDecks ?? []).filter(d => d.id !== deckId);
  playerSave.update(s => s ? { ...s, personalDecks: updated } : s);
  persistPlayer();

  personalDeckMap.delete(deckId);
}

/**
 * Register all personal decks from the player save into the in-memory deck registry
 * and curated deck store. Call this once at app startup, after initPlayer().
 *
 * Idempotent: safe to call multiple times (re-registration replaces existing entries).
 */
export function registerPersonalDecks(): void {
  const decks = getPersonalDecks();

  personalDeckMap.clear();

  for (const deck of decks) {
    _registerSingleDeck(deck);
  }

  if (decks.length > 0) {
    console.log(`[personalDeckStore] Registered ${decks.length} personal deck(s)`);
  }
}

/**
 * Merge imported ReviewState objects into the player save.
 * Existing review states for the same factId are replaced.
 *
 * @param reviewStates - Review states from an Anki import with scheduling data.
 */
export function mergeReviewStates(reviewStates: ReviewState[]): void {
  if (reviewStates.length === 0) return;

  const current = get(playerSave);
  if (!current) {
    console.warn('[personalDeckStore] Cannot merge review states — no player save loaded');
    return;
  }

  const existingMap = new Map(current.reviewStates.map(rs => [rs.factId, rs]));
  for (const rs of reviewStates) {
    existingMap.set(rs.factId, rs);
  }

  playerSave.update(s =>
    s ? { ...s, reviewStates: Array.from(existingMap.values()) } : s,
  );
  persistPlayer();
}

/**
 * Alias for mergeReviewStates — used by AnkiImportWizard.svelte.
 * @deprecated Prefer mergeReviewStates. This alias is kept for component compatibility.
 */
export const mergeImportedReviewStates = mergeReviewStates;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Register a single personal deck into all in-memory stores.
 * Updates personalDeckMap, deckRegistry, curatedDeckStore, and deckFactIndex.
 */
function _registerSingleDeck(deck: PersonalDeck): void {
  personalDeckMap.set(deck.id, deck);

  // Register in the deck registry (metadata only — displayed in deck selection UI).
  registerDeck({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    // 'personal' is used as the domain; cast needed since CanonicalFactDomain
    // doesn't include it yet — personal decks are a new top-level domain.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    domain: 'personal' as any,
    factCount: deck.facts.length,
    tier: 1,
    status: 'available',
    artPlaceholder: { gradientFrom: '#3730a3', gradientTo: '#1e1b4b', icon: 'cards' },
  });

  // Register the full deck data in the curated deck store so quiz engine resolves facts.
  registerPersonalDeckInStore(deck);

  // Register fact IDs in the fact index.
  registerDeckFacts(deck.id, {
    allFacts: deck.facts.map(f => f.id),
  });
}
