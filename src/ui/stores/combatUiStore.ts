import { writable } from 'svelte/store'

/**
 * Shared UI state for the combat overlay, consumed by sibling components
 * (e.g. MultiplayerHUD) that live outside CardCombatOverlay's subtree.
 *
 * Written by CardCombatOverlay via a $effect; read by CardApp and passed as
 * props to any overlay that needs to know quiz visibility.
 */

/** True while a charge-quiz panel is actively showing over the combat view. */
export const quizPanelVisible = writable<boolean>(false)
