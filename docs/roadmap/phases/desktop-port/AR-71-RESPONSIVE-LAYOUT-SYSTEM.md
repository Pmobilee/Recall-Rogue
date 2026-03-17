# AR-71: Responsive Layout System

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §2
> **Priority:** FOUNDATION — Everything else depends on this.
> **Complexity:** Large
> **Dependencies:** None

## Context

The entire UI is built for portrait mobile (390×844px, 9:16 aspect ratio). All 166+ Svelte components use `calc(Xpx * var(--layout-scale, 1))` computed from a single `BASE_WIDTH = 390` constant. The Phaser canvas is hardcoded to 390×844 with `Phaser.Scale.FIT`. There are zero media queries anywhere. This AR creates the foundation for a unified responsive codebase: one app, two layout modes (portrait + landscape), runtime switching.

## What Exists Now

- `src/data/layout.ts` — exports `BASE_WIDTH = 390`, `GAME_ASPECT_RATIO = 9/16`
- `src/CardApp.svelte` — computes `--layout-scale` on mount and resize, always from 390px base
- `src/game/CardGameManager.ts` — creates Phaser game at 390×844px, `Phaser.Scale.FIT`, `CENTER_BOTH`
- Every Svelte component uses `calc(Xpx * var(--layout-scale, 1))` for sizing
- No layout mode detection, no landscape support, no responsive branching

## Directive

### Step 1: Create Layout Store

**File:** NEW `src/stores/layoutStore.ts`

```typescript
import { writable, derived, get } from 'svelte/store';

export type LayoutMode = 'portrait' | 'landscape';

function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'portrait';
  return (window.innerWidth / window.innerHeight) >= 1.0 ? 'landscape' : 'portrait';
}

export const layoutMode = writable<LayoutMode>(detectLayoutMode());
export const isLandscape = derived(layoutMode, $m => $m === 'landscape');
export const isPortrait = derived(layoutMode, $m => $m === 'portrait');

// Layout design canvases
const PORTRAIT_CANVAS = { width: 390, height: 844 };
const LANDSCAPE_CANVAS = { width: 1280, height: 720 };

export function getCanvasForMode(mode: LayoutMode) {
  return mode === 'portrait' ? PORTRAIT_CANVAS : LANDSCAPE_CANVAS;
}

// Listen for resize/orientation
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => layoutMode.set(detectLayoutMode()));
  window.addEventListener('orientationchange', () => {
    setTimeout(() => layoutMode.set(detectLayoutMode()), 100);
  });
}

// Dev toggle (Ctrl+Shift+L)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      layoutMode.update(m => m === 'portrait' ? 'landscape' : 'portrait');
    }
  });
}
```

**Acceptance:** Store exports `layoutMode`, `isLandscape`, `isPortrait`, `getCanvasForMode`. Resize triggers mode switch. Ctrl+Shift+L toggles in dev.

### Step 2: Refactor Layout Scale Computation

**File:** `src/data/layout.ts`

- Keep `BASE_WIDTH = 390` and `GAME_ASPECT_RATIO = 9/16` for portrait backward compat
- Add `LANDSCAPE_BASE_WIDTH = 1280`, `LANDSCAPE_ASPECT_RATIO = 16/9`
- Export `getBaseWidth(mode)` and `getAspectRatio(mode)` helpers

**File:** `src/CardApp.svelte` — `updateLayoutScale()` function

- Import `layoutMode` from the store
- Subscribe to `layoutMode` changes
- When mode changes, recompute `--layout-scale` from the correct canvas dimensions:
  - Portrait: `scale = viewportWidth / 390`
  - Landscape: `scale = Math.min(viewportWidth / 1280, viewportHeight / 720)`
- Also set `--layout-scale-x`, `--layout-scale-y`, `--layout-mode` CSS vars on `:root`
- Set `data-layout` attribute on root container for CSS selectors

**Acceptance:** `--layout-scale` recomputes correctly for both modes. Portrait at 390px-wide viewport = scale 1.0. Landscape at 1920×1080 = scale 1.5.

### Step 3: Phaser Canvas Resize on Layout Change

**File:** `src/game/CardGameManager.ts`

- Import `layoutMode` from store
- Subscribe to `layoutMode` changes
- On change: call `game.scale.resize(width, height)` with mode-appropriate canvas
- Notify all active scenes via a new `handleLayoutChange(mode: LayoutMode)` method

**File:** Add `handleLayoutChange` to scene interface

- Create interface or mixin that CombatScene, BootAnimScene, RewardRoomScene implement
- `handleLayoutChange(mode: LayoutMode)`: each scene repositions sprites/backgrounds
- For this AR, only implement the **stub** — actual repositioning is in AR-73/AR-79

**Acceptance:** Phaser canvas resizes when layout mode changes. Scenes receive notification. No visual regressions in portrait.

### Step 4: Component Pattern Documentation

**File:** Add a comment block at top of `layoutStore.ts` documenting the pattern:

```
// USAGE IN SVELTE COMPONENTS:
//
// {#if $layoutMode === 'landscape'}
//   <div class="component-landscape">...</div>
// {:else}
//   <div class="component-portrait">
//     <!-- EXISTING implementation, UNCHANGED -->
//   </div>
// {/if}
//
// CRITICAL: Portrait path MUST remain identical to pre-port code.
// Landscape is the new work. Never "improve" portrait during this port.
```

### Step 5: Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Portrait mode at 390px viewport: pixel-identical to current
- [ ] Landscape mode at 1920×1080: no crash, layout scale computes correctly
- [ ] Ctrl+Shift+L in dev mode toggles layout
- [ ] Phaser canvas resizes on layout change
- [ ] Window resize triggers layout mode switch at aspect ratio crossover

## Files Affected

| File | Action |
|------|--------|
| `src/stores/layoutStore.ts` | NEW |
| `src/data/layout.ts` | MODIFY (add landscape constants) |
| `src/CardApp.svelte` | MODIFY (subscribe to layoutMode, refactor updateLayoutScale) |
| `src/game/CardGameManager.ts` | MODIFY (subscribe to layoutMode, resize Phaser) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §17 (Portrait UX) to note that the layout system now supports both portrait and landscape modes, with landscape mode designed for desktop/Steam. Reference this AR.
