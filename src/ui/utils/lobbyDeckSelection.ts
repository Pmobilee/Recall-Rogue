/**
 * lobbyDeckSelection.ts
 *
 * Pure helper functions for the multi-deck lobby picker redesign (Issue 2, 2026-04-11).
 * Extracted so they can be unit-tested without mounting a Svelte component.
 *
 * Terminology:
 *   selectedDecks: Map<deckId, Set<subDeckId> | 'all'>
 *     - 'all'          → whole deck selected (all subdecks included)
 *     - Set<subDeckId> → partial selection (individual subdecks chosen)
 *     - Missing key    → deck not selected
 *
 * Svelte 5 reactivity note: Map and Set mutations do NOT trigger $state reactivity.
 * All mutating helpers return a NEW Map so callers can reassign: selectedDecks = helper(...)
 */

import type { LobbyContentSelection } from '../../data/multiplayerTypes'
import type { DeckRegistryEntry } from '../../data/deckRegistry'

/**
 * Selection map type alias — key is deckId, value is either 'all' (whole deck)
 * or a Set of individual subdeck IDs.
 */
export type DeckSelectionMap = Map<string, Set<string> | 'all'>

// ── Toggle helpers ──────────────────────────────────────────────────────────

/**
 * Toggle selection of a whole deck.
 *
 * - If the deck is currently selected as 'all', deselect it entirely.
 * - Otherwise (partial or absent), select the whole deck as 'all'.
 *
 * Returns a new Map — caller must reassign to trigger Svelte reactivity.
 */
export function toggleWholeDeck(map: DeckSelectionMap, deckId: string): DeckSelectionMap {
  const next = new Map(map)
  if (next.get(deckId) === 'all') {
    next.delete(deckId)
  } else {
    next.set(deckId, 'all')
  }
  return next
}

/**
 * Toggle selection of a single subdeck within a deck.
 *
 * - If the deck is currently 'all', convert to a Set containing all subdecks
 *   EXCEPT the toggled one (deselect that one), or remove the deck entry if
 *   the resulting Set would be empty.
 * - If the deck has a Set, add or remove the subDeckId from it. If the Set
 *   becomes empty, remove the deck entry.
 * - If the deck is not selected, create a Set with just this subDeckId.
 *
 * @param allSubDeckIds  All subdeck IDs for this deck (needed for 'all' → partial conversion).
 */
export function toggleSubDeck(
  map: DeckSelectionMap,
  deckId: string,
  subDeckId: string,
  allSubDeckIds: string[],
): DeckSelectionMap {
  const next = new Map(map)
  const current = next.get(deckId)

  if (current === 'all') {
    // Convert 'all' to explicit set, removing the toggled subdeck
    const remaining = allSubDeckIds.filter(id => id !== subDeckId)
    if (remaining.length === 0) {
      next.delete(deckId)
    } else {
      next.set(deckId, new Set(remaining))
    }
  } else if (current instanceof Set) {
    const updated = new Set(current)
    if (updated.has(subDeckId)) {
      updated.delete(subDeckId)
    } else {
      updated.add(subDeckId)
    }
    if (updated.size === 0) {
      next.delete(deckId)
    } else {
      next.set(deckId, updated)
    }
  } else {
    // Deck not selected — start a partial set with just this subdeck
    next.set(deckId, new Set([subDeckId]))
  }

  return next
}

// ── Query helpers ───────────────────────────────────────────────────────────

/**
 * Returns the check state for a whole-deck checkbox:
 * - 'all'       → all subdecks selected (checked)
 * - 'partial'   → some subdecks selected (indeterminate)
 * - 'none'      → deck not selected (unchecked)
 */
export function deckCheckState(map: DeckSelectionMap, deckId: string): 'all' | 'partial' | 'none' {
  const val = map.get(deckId)
  if (val === undefined) return 'none'
  if (val === 'all') return 'all'
  return val.size > 0 ? 'partial' : 'none'
}

/**
 * Returns true if a specific subdeck is selected.
 * Whole-deck selection ('all') implies all subdecks are selected.
 */
export function isSubDeckSelected(map: DeckSelectionMap, deckId: string, subDeckId: string): boolean {
  const val = map.get(deckId)
  if (val === undefined) return false
  if (val === 'all') return true
  return val.has(subDeckId)
}

// ── Serialization ───────────────────────────────────────────────────────────

/**
 * Convert the selection map + domain set into a LobbyContentSelection of type 'study-multi'.
 *
 * @param selectedDecks   The deck selection map.
 * @param selectedDomains Set of trivia domain IDs.
 * @param allDecks        Full deck registry (to look up names).
 */
export function buildStudyMultiSelection(
  selectedDecks: DeckSelectionMap,
  selectedDomains: Set<string>,
  allDecks: DeckRegistryEntry[],
): Extract<LobbyContentSelection, { type: 'study-multi' }> {
  const decks = Array.from(selectedDecks.entries()).map(([deckId, value]) => {
    const deck = allDecks.find(d => d.id === deckId)
    return {
      deckId,
      deckName: deck?.name ?? deckId,
      subDeckIds: value === 'all' ? 'all' as const : Array.from(value),
    }
  })
  return {
    type: 'study-multi',
    decks,
    triviaDomains: Array.from(selectedDomains),
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

/**
 * Build a human-readable summary line for a LobbyContentSelection.
 * Handles all variants including legacy 'study', 'trivia', and 'custom_deck'.
 */
export function describeSelection(cs: LobbyContentSelection): string {
  if (cs.type === 'study-multi') {
    const deckCount = cs.decks.length
    const domainCount = cs.triviaDomains.length
    const parts: string[] = []
    if (deckCount > 0) {
      parts.push(`${deckCount} deck${deckCount === 1 ? '' : 's'}`)
    }
    if (domainCount > 0) {
      parts.push(`${domainCount} trivia domain${domainCount === 1 ? '' : 's'}`)
    }
    return parts.join(' + ') || 'No content'
  }
  if (cs.type === 'study') {
    return cs.subDeckId ? `${cs.deckName} — subdeck` : cs.deckName
  }
  if (cs.type === 'trivia') {
    const n = cs.domains.length
    return n > 0 ? `${n} trivia domain${n === 1 ? '' : 's'}` : 'Trivia Mix'
  }
  if (cs.type === 'custom_deck') {
    return cs.deckName
  }
  return 'No content'
}

/**
 * Compute a short summary of the current picker state for display in the footer.
 *
 * @param selectedDecks   Deck selection map.
 * @param selectedDomains Set of selected trivia domain IDs.
 * @param selectedCustomDeckIds Set of selected custom deck IDs.
 */
export function pickerSummary(
  selectedDecks: DeckSelectionMap,
  selectedDomains: Set<string>,
  selectedCustomDeckIds: Set<string>,
): string {
  const parts: string[] = []
  if (selectedDecks.size > 0) {
    const n = selectedDecks.size
    parts.push(`${n} deck${n === 1 ? '' : 's'}`)
  }
  if (selectedDomains.size > 0) {
    const n = selectedDomains.size
    parts.push(`${n} trivia domain${n === 1 ? '' : 's'}`)
  }
  if (selectedCustomDeckIds.size > 0) {
    const n = selectedCustomDeckIds.size
    parts.push(`${n} custom deck${n === 1 ? '' : 's'}`)
  }
  return parts.join(', ') || 'Nothing selected'
}
