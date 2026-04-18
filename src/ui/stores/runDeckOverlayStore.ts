/**
 * runDeckOverlayStore.ts
 *
 * Shared store that controls visibility of the RunDeckOverlay.
 * Components across all run-active screens import from here — no prop drilling needed.
 * Rendered centrally in CardApp.svelte whenever the current screen is in IN_RUN_SCREENS.
 */
import { writable } from 'svelte/store'

/** True when the run deck overlay is open. Set via the helpers below. */
export const runDeckOverlayOpen = writable(false)

/**
 * When set before opening, the overlay pre-filters to this pile.
 * Cleared on close. Valid values match PileId: 'hand' | 'draw' | 'discard' | 'exhaust'.
 */
export const runDeckOverlayInitialFilter = writable<string | null>(null)

/** Open the overlay — call from InRunTopBar deck button or forget pile indicator. */
export function openRunDeckOverlay(initialFilter?: string): void {
  if (initialFilter) {
    runDeckOverlayInitialFilter.set(initialFilter)
  }
  runDeckOverlayOpen.set(true)
}

/** Close the overlay — call from the overlay's dismiss button or Escape handler. */
export function closeRunDeckOverlay(): void {
  runDeckOverlayOpen.set(false)
  runDeckOverlayInitialFilter.set(null)
}
