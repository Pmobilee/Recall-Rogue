/**
 * narrativeStore.ts — Svelte store for the NarrativeOverlay display state.
 *
 * The narrative engine (src/services/narrativeEngine.ts — PLANNED) calls
 * showNarrative() to trigger the overlay, and the overlay calls dismissNarrative()
 * (or passes onDismiss which calls it) when the player advances through all lines.
 *
 * Design spec: docs/mechanics/narrative.md §Display System
 */

import { writable } from 'svelte/store';
import type { NarrativeLine } from '../../services/narrativeTypes';

export interface NarrativeDisplayState {
  lines: NarrativeLine[];
  mode: 'auto-fade' | 'click-through';
  active: boolean;
}

/** Current narrative overlay display state. Set by showNarrative(), cleared by dismissNarrative(). */
export const narrativeDisplay = writable<NarrativeDisplayState>({
  lines: [],
  mode: 'auto-fade',
  active: false,
});

// Register with globalThis Symbol so playtestAPI.ts can read it via readStore().
(globalThis as Record<symbol, unknown>)[Symbol.for('rr:narrativeDisplay')] = narrativeDisplay;

/**
 * Activate the narrative overlay with the given lines and display mode.
 * - 'auto-fade': all lines shown at once, auto-dismiss after 3-4s
 * - 'click-through': one line at a time, player advances with click/tap
 */
export function showNarrative(lines: NarrativeLine[], mode: 'auto-fade' | 'click-through'): void {
  narrativeDisplay.set({ lines, mode, active: true });
}

/**
 * Deactivate the narrative overlay and clear its content.
 * Called by the overlay's onDismiss callback after all lines are consumed.
 */
export function dismissNarrative(): void {
  narrativeDisplay.set({ lines: [], mode: 'auto-fade', active: false });
}
