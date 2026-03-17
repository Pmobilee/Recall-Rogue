/** Base width the game UI was designed for (px) — portrait mobile. */
export const BASE_WIDTH = 390

/** Target aspect ratio for the game container (width / height) — portrait. */
export const GAME_ASPECT_RATIO = 9 / 16

// --- Landscape (desktop) constants — AR-71 ---

/** Base width for the landscape desktop layout (px). */
export const LANDSCAPE_BASE_WIDTH = 1280

/** Base height for the landscape desktop layout (px). */
export const LANDSCAPE_BASE_HEIGHT = 720

/** Target aspect ratio for the landscape layout (width / height). */
export const LANDSCAPE_ASPECT_RATIO = 16 / 9

// --- Layout mode helpers ---

import type { LayoutMode } from '../stores/layoutStore'

/**
 * Returns the design base width for the given layout mode.
 * Portrait: 390px. Landscape: 1280px.
 */
export function getBaseWidth(mode: LayoutMode): number {
  return mode === 'landscape' ? LANDSCAPE_BASE_WIDTH : BASE_WIDTH
}

/**
 * Returns the target aspect ratio (width/height) for the given layout mode.
 * Portrait: 9/16. Landscape: 16/9.
 */
export function getAspectRatio(mode: LayoutMode): number {
  return mode === 'landscape' ? LANDSCAPE_ASPECT_RATIO : GAME_ASPECT_RATIO
}
