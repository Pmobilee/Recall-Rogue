# UI Layout & Scaling System

> **Purpose:** Documents the CSS custom property scaling system, viewport detection, layout mode switching, and Phaser canvas sizing. Reference before touching any layout or sizing code.
> **Last verified:** 2026-03-31
> **Source files:** `src/CardApp.svelte`, `src/data/layout.ts`, `src/stores/layoutStore.ts`, `src/ui/styles/desktop.css`, `src/ui/styles/overlay.css`, `src/ui/utils/stretchText.ts`

---

## The Scaling Rule

**Zero hardcoded px values for layout, sizing, spacing, or fonts.**

| What you're setting | Correct pattern |
|---|---|
| Layout (padding, margin, gap, width, height, border) | `calc(Npx * var(--layout-scale, 1))` |
| Font size | `calc(Npx * var(--text-scale, 1))` |
| Both axes independently | `--layout-scale-x` / `--layout-scale-y` |

**OK to hardcode:** `border-radius: 50%`, `opacity`, `z-index`, `flex` values, `0`, `1px` borders, `inset: 0`, Phaser/canvas pixel coordinates.

---

## CSS Custom Properties

All set by `updateLayoutScale()` in `CardApp.svelte` on `documentElement`:

| Property | Type | Meaning |
|---|---|---|
| `--layout-scale` | number | Uniform scale factor for all layout dimensions |
| `--layout-scale-x` | number | Horizontal-only scale |
| `--layout-scale-y` | number | Vertical-only scale |
| `--text-scale` | number | Font scale — grows at half the rate of `--layout-scale` in landscape |
| `--layout-mode` | `'portrait'` / `'landscape'` | Current layout mode string |

A `data-layout` attribute (`portrait` / `landscape`) is also set on `.card-app` for CSS selector targeting: `[data-layout="landscape"]`.

---

## How Scales Are Calculated (`CardApp.svelte` `updateLayoutScale()`)

### Portrait mode
```
scale = clamp(containerWidth / BASE_WIDTH, 0.8, 1.4)
```
`BASE_WIDTH = 390`. Uses `.card-app` `clientWidth`, falling back to `window.innerWidth`.

### Landscape mode
```
scaleX = window.innerWidth  / 1280
scaleY = window.innerHeight / 720
scale  = Math.min(scaleX, scaleY)
```
Uses raw `window.innerWidth/Height` — NOT `.card-app` width (which has a portrait-aspect constraint that gives ~0.47 instead of ~1.5).

### Text scale
```
viewportTextFactor = landscape ? (1 + (scale - 1) * 0.5) : 1
--text-scale = viewportTextFactor * textPref * userScale
```
Text grows at half the rate of layout in landscape. Portrait text stays at 1× (user pref only).

### User UI Scale preference (AR-82)
`userScalePct` from `localStorage['recall-rogue-ui-scale']`, clamped to `[80, 150]`, default 100. Both `--layout-scale` and `--text-scale` are multiplied by `userScale / 100`.

### Text size preference
`TEXT_SCALE_MAP = { small: 0.85, medium: 1.0, large: 1.2 }` from the `textSize` store.

---

## Layout Constants (`src/data/layout.ts`)

| Constant | Value | Description |
|---|---|---|
| `BASE_WIDTH` | `390` | Portrait design base width (px) |
| `GAME_ASPECT_RATIO` | `9/16` | Portrait target aspect ratio |
| `LANDSCAPE_BASE_WIDTH` | `1280` | Landscape design base width (px) |
| `LANDSCAPE_BASE_HEIGHT` | `720` | Landscape design base height (px) |
| `LANDSCAPE_ASPECT_RATIO` | `16/9` | Landscape target aspect ratio |

Helpers: `getBaseWidth(mode: LayoutMode): number`, `getAspectRatio(mode: LayoutMode): number`.

---

## Viewport / Layout Mode Detection (`src/stores/layoutStore.ts`)

```ts
detectLayoutMode(): 'landscape' if window.innerWidth / innerHeight >= 1.0, else 'portrait'
```

Design canvas sizes:
- Portrait: `390 × 844`
- Landscape: `1280 × 720`

`layoutMode` is a Svelte writable store. Derived stores: `isLandscape`, `isPortrait`.
`getCanvasForMode(mode)` returns the design canvas for a given mode.

Triggers: `resize` event, `orientationchange` (with 100ms delay). Dev toggle: **Ctrl+Shift+L** flips modes in DEV.

`updateLayoutScale()` subscribes to both `layoutMode` and `textSize` stores, so any change reruns scale computation immediately.

---

## Portrait vs Landscape Differences

| Aspect | Portrait | Landscape |
|---|---|---|
| Design base | 390px wide | 1280×720 |
| Scale clamping | `[0.8, 1.4]` | unclamped `min(scaleX, scaleY)` |
| Text scale | `1 × textPref × userScale` | `(1 + (scale-1)*0.5) × textPref × userScale` |
| Font overrides | pixel / RPG fonts | `Cinzel` for headings, `--font-body` for body |
| Background | component-defined | radial-gradient atmospheric overlay |

All landscape-specific CSS lives in `desktop.css` under `[data-layout="landscape"]` selectors (bypasses Svelte component scoping).

**Combat overlay positioning in landscape:** All **positional** CSS properties (`top`, `bottom`, `left`, `right`) in the combat overlay use pure `vh` values (e.g., `6.5vh`, `32vh`) rather than mixed `calc(Nvh + Npx * var(--layout-scale))` expressions. This ensures uniform scaling with the Phaser canvas, which uses viewport-percentage positioning. **Dimensional** properties (width, height, padding, font-size) still use `calc(Npx * var(--layout-scale, 1))`.

`--topbar-height` uses `max(28px, 4.5vh)` for linear scaling (previously `clamp(36px, 4.5vh, 56px)`, which had a floor that caused misalignment at small viewports).

---

## Overlay CSS Variables (`src/ui/styles/overlay.css`)

Shared across all overlay panels:

| Variable | Value |
|---|---|
| `--overlay-backdrop` | `rgba(10, 10, 10, 0.70)` |
| `--overlay-blur` | `blur(4px)` |
| `--panel-bg` | `#12151E` |
| `--panel-border-outer` | `#2A2E38` |
| `--panel-border-inner` | `#4A5068` |
| `--color-gold` | `#FFD700` |
| `--font-pixel` | `var(--font-rpg, 'Lora', 'Georgia', serif)` |
| `--font-body` | `var(--font-rpg, 'Lora', system-ui, sans-serif)` |

`[data-pw-animations="disabled"] *` pauses all CSS animations — set by Playwright before screenshots.

---

## `stretchText` Svelte Action (`src/ui/utils/stretchText.ts`)

Stretches text to fill a fixed-size container edge-to-edge, used for card title labels.

```svelte
<div use:stretchText>{text}</div>
```

Requires `position: absolute` and explicit `width`/`height` on the element. Algorithm: clears transform → measures container → measures natural text size → applies `transform: scale(scaleX, scaleY)` with `transform-origin: center center`. Uses `ResizeObserver` and `MutationObserver` to re-measure on resize or content change. Initial measurement deferred to `requestAnimationFrame`.

---

## Responsive Breakpoints (`src/ui/styles/desktop.css`)

| Breakpoint | Effect |
|---|---|
| `768px` | Canvas container max-width 600px, centered |
| `1200px` | CSS grid: 480px canvas + side panel |
| `1440px` | Grid: 520px canvas column |
| `1280px` (+ `data-layout="landscape"`) | Full landscape UX overrides |
| `pointer: fine` | Mouse hover states enabled |

Safari fixes: `min-height: 100dvh` (avoids 100vh miscalculation), `overscroll-behavior: none`.
