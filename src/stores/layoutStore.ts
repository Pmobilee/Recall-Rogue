/**
 * layoutStore.ts — Reactive layout mode detection for portrait/landscape switching.
 *
 * AR-71: Responsive Layout System
 *
 * USAGE IN SVELTE COMPONENTS:
 *
 * {#if $layoutMode === 'landscape'}
 *   <div class="component-landscape">...</div>
 * {:else}
 *   <div class="component-portrait">
 *     <!-- EXISTING implementation, UNCHANGED -->
 *   </div>
 * {/if}
 *
 * CRITICAL: Portrait path MUST remain identical to pre-port code.
 * Landscape is the new work. Never "improve" portrait during this port.
 */
import { writable, derived } from 'svelte/store'

/** Union of supported layout modes. */
export type LayoutMode = 'portrait' | 'landscape'

/** Detect layout mode from current viewport dimensions. */
function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'portrait'
  return window.innerWidth / window.innerHeight >= 1.0 ? 'landscape' : 'portrait'
}

/** Reactive writable store for current layout mode. */
export const layoutMode = writable<LayoutMode>(detectLayoutMode())

/** Derived: true when layout is landscape. */
export const isLandscape = derived(layoutMode, $m => $m === 'landscape')

/** Derived: true when layout is portrait. */
export const isPortrait = derived(layoutMode, $m => $m === 'portrait')

/** Design canvas dimensions for each layout mode. */
const PORTRAIT_CANVAS = { width: 390, height: 844 } as const
const LANDSCAPE_CANVAS = { width: 1280, height: 720 } as const

/**
 * Returns the design-canvas dimensions for a given layout mode.
 * Portrait: 390×844 (existing mobile design base).
 * Landscape: 1280×720 (desktop 16:9 design base).
 */
export function getCanvasForMode(mode: LayoutMode): { width: number; height: number } {
  return mode === 'portrait' ? PORTRAIT_CANVAS : LANDSCAPE_CANVAS
}

// --- Event listeners ---

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    layoutMode.set(detectLayoutMode())
  })

  window.addEventListener('orientationchange', () => {
    // Brief delay: some browsers update innerWidth/Height after the event fires.
    setTimeout(() => layoutMode.set(detectLayoutMode()), 100)
  })
}

// --- Dev toggle: Ctrl+Shift+L ---

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      layoutMode.update(m => (m === 'portrait' ? 'landscape' : 'portrait'))
    }
  })
}
