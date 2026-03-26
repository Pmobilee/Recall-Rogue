# AR-243: Landscape Top Bar — Persistent In-Run HUD

> **Priority:** P0 — Fundamental landscape UX improvement
> **Complexity:** Medium-Large (structural CSS change + new component + Phaser resize)
> **Dependencies:** None (foundational — other combat HUD ARs can build on this)

---

## HARD RULE: Zero Hardcoded Sizes

**EVERY dimension in this AR must be fully dynamic.** No hardcoded pixel values, no magic numbers, no fixed heights. Everything scales based on viewport size.

- Top bar height: percentage of viewport height (e.g., `--topbar-height: 4.5vh`) — NOT a fixed `48px`
- All internal sizing: `var(--layout-scale)`, `var(--text-scale)`, `vh`, `vw`, `%`, `clamp()`, or `calc()` with scale vars
- Font sizes: `clamp()` with min/max or `calc(Npx * var(--text-scale, 1))`
- Icon sizes: relative to bar height (`calc(var(--topbar-height) * 0.55)`) — NOT fixed px
- Padding/gaps: relative to bar height or `var(--layout-scale)`
- HP bar width: percentage of its section, never a fixed width
- The bar must look correct at 1280x720, 1920x1080, 2560x1440, and ultrawide — no breakpoints, pure fluid scaling

**If a worker submits code with a single hardcoded px value for layout/sizing/spacing/fonts, it is rejected.**

---

## Overview

In landscape mode, the game currently has run-state info (HP, gold, relics, floor, pause button, etc.) scattered as floating elements across the top of the viewport with no visual cohesion. This looks amateur and wastes screen space.

**Solution:** Add a persistent top bar (~48px) that appears during ALL in-run screens (combat, dungeon map, shop, rest, mystery, reward, retreat/delve, campfire). The entire game viewport — including the Phaser canvas — gets pushed down by the bar height. This is a **single structural change** rather than painstakingly repositioning dozens of individual elements.

The top bar consolidates ALL run-state info into one clean, always-visible strip, inspired by Slay the Spire's top bar.

---

## What Goes In The Top Bar

### Left Section (Player Identity & Vitals)
| Element | Source | Notes |
|---------|--------|-------|
| Player HP bar | `runState.playerHp` / `playerMaxHp` | Compact horizontal bar with text overlay, color-coded (green/orange/red by %) |
| Block indicator | `turnState.player.block` | Only visible when block > 0, shield icon + number overlaid on HP bar left edge |
| AP orb (combat only) | `turnState.ap` | Small orb, only shown during combat screen |

### Center Section (Run Progress)
| Element | Source | Notes |
|---------|--------|-------|
| Act/Segment name | `runState.floor.segment` | "The Depths", "The Forge", etc. |
| Floor number | `runState.floor.currentFloor` | "Floor 3" or similar |
| Encounter progress | `runState.floor.currentEncounter` / `encountersPerFloor` | "2/4" — how far through this floor |

### Right Section (Resources & Controls)
| Element | Source | Notes |
|---------|--------|-------|
| Gold counter | `runState.currency` | Coin icon + number |
| Relic tray | `runState.runRelics` | Row of small relic icons (currently in `RelicTray.svelte`) — tap/hover for tooltip |
| Pause/Settings button | Existing pause handler | Gear or pause icon |

### Conditional Elements
| Element | When Visible | Notes |
|---------|-------------|-------|
| Ascension badge | `runState.ascensionLevel > 0` | Small "A10" style badge |
| Expert mode badge | When expert/practiced/mastered mode active | Existing `expert-badge` element |
| Practice run banner | `runState.practiceRunDetected` | Subtle warning text |
| Chain counter | During combat, when chain active | Could go near center or as floating element below bar |

---

## Architecture: The Containerization Approach

### Key Insight
Instead of moving individual elements, we:
1. Add a **fixed top bar** (`height: var(--topbar-height)`) in landscape mode only
2. Set a **CSS custom property** `--topbar-height: 48px` (scaled) on `.card-app[data-layout="landscape"]`
3. Push the **Phaser container** down: `top: var(--topbar-height)` and reduce height to `calc(100dvh - var(--topbar-height))`
4. Push **all Svelte overlay screens** down by the same amount via a shared CSS rule
5. The Phaser `ScaleManager` gets told the new dimensions so it re-fits correctly

### What Changes

**`src/CardApp.svelte`:**
- Add CSS var: `--topbar-height: calc(48px * var(--layout-scale, 1))`
- Landscape `.phaser-container`: `top: var(--topbar-height); height: calc(100dvh - var(--topbar-height))`
- Landscape `.phaser-container.visible :global(canvas)`: same height adjustment
- All in-run screen wrappers get `top: var(--topbar-height)` in landscape
- The `<InRunTopBar>` component renders when `isLandscape && isInRunScreen`
- Remove the floating `.pause-btn` in landscape (now in top bar)
- Remove per-screen HP/gold displays that are now redundant in landscape

**`src/ui/components/InRunTopBar.svelte` (NEW):**
- Fixed position: `top: 0; left: 0; right: 0; height: var(--topbar-height)`
- Z-index above Phaser canvas but below modals/popups
- Receives run state as props (or reads from `activeRunState` store)
- Contains: HP bar, gold, floor/act info, relic tray, pause button
- Only renders in landscape mode during a run

**`src/game/CardGameManager.ts`:**
- When resizing for landscape, subtract topbar height from available height
- `getCanvasForMode` or the resize handler accounts for the bar

**`src/stores/layoutStore.ts`:**
- Export `TOPBAR_HEIGHT` constant (or derive from layout-scale)
- Phaser scenes can import this for coordinate adjustments

**`src/game/scenes/CombatScene.ts`:**
- No direct changes needed IF Phaser's ScaleManager handles the smaller canvas correctly
- The scene already uses `this.scale.width/height` for positioning — if the Game's parent div shrinks, Phaser auto-adjusts
- **Risk:** Enemy sprites, HP bars, backgrounds might need the scene `resize()` handler to fire. Verify.

**`src/ui/components/CardCombatOverlay.svelte`:**
- In landscape: remove redundant player HP strip (now in top bar)
- Remove the relic tray from the combat overlay (now in top bar)
- AP orb: either keep in combat overlay OR move to top bar (test both — top bar might be cleaner)

**`src/ui/components/DungeonMap.svelte`:**
- Remove the segment name heading at top (now in top bar)
- The pause button is in the top bar now, remove from map

---

## Sub-Steps

### 1. Create CSS variable and top bar slot in CardApp
- [ ] Add `--topbar-height: 4.5vh` (or `clamp(36px, 4.5vh, 56px)`) to `.card-app[data-layout="landscape"]` — viewport-relative, NOT fixed px
- [ ] Define the set of "in-run screens" that show the top bar
- [ ] Add `<InRunTopBar>` render slot conditionally
- **Files:** `src/CardApp.svelte`
- **Acceptance:** CSS var exists, top bar renders in correct screens

### 2. Push Phaser container down in landscape
- [ ] `.phaser-container` in landscape: `top: var(--topbar-height); height: calc(100dvh - var(--topbar-height))`
- [ ] Canvas CSS override: `height: calc(100dvh - var(--topbar-height)) !important`
- [ ] Verify Phaser ScaleManager re-fits after container resize
- [ ] If needed, dispatch a manual `game.scale.resize()` when top bar appears/disappears
- **Files:** `src/CardApp.svelte`, `src/game/CardGameManager.ts`
- **Acceptance:** Phaser canvas renders in the reduced viewport, no stretching/cropping artifacts

### 3. Push all Svelte in-run overlays down
- [ ] All in-run screens (`combat`, `cardReward`, `shopRoom`, `restRoom`, `mysteryEvent`, `dungeonMap`, `retreatOrDelve`, `campfire`, `masteryChallenge`, `specialEvent`, `upgradeSelection`, `postMiniBossRest`, `restStudy`, `restMeditate`, `rewardRoom`) — their wrapper divs get `top: var(--topbar-height)` and `height: calc(100dvh - var(--topbar-height))` in landscape
- [ ] This can be done with a single CSS class `.in-run-viewport` applied to all in-run wrappers
- **Files:** `src/CardApp.svelte`
- **Acceptance:** All in-run screens start below the top bar, no overlap

### 4. Build InRunTopBar component
- [ ] Create `src/ui/components/InRunTopBar.svelte`
- [ ] **Left zone:** Player HP bar (compact, color-coded) with block overlay
- [ ] **Center zone:** Act name + Floor number + encounter progress
- [ ] **Right zone:** Gold counter (coin icon + number), relic tray (compact), pause button
- [ ] Styling: dark semi-transparent background, subtle bottom border, matches game aesthetic
- [ ] Must use `--layout-scale` and `--text-scale` for all sizing (zero hardcoded px)
- [ ] Relic icons: small (24px scaled), hoverable for tooltip, highlight on trigger
- **Files:** `src/ui/components/InRunTopBar.svelte`
- **Acceptance:** All run-state info visible at a glance in a clean, polished bar

### 5. Wire run state data into top bar
- [ ] Subscribe to `activeRunState` store for HP, gold, floor, segment, relics, ascension
- [ ] Subscribe to `activeTurnState` for combat-specific data (AP, block, chain)
- [ ] Wire pause button to existing `handlePause` from CardApp
- [ ] Relic tray: reuse existing `RelicTray.svelte` or extract a compact variant
- **Files:** `src/ui/components/InRunTopBar.svelte`, `src/CardApp.svelte`
- **Acceptance:** Data updates in real-time during gameplay

### 6. Remove redundant floating elements in landscape
- [ ] Remove `.pause-btn` from combat and dungeon map screens (landscape only — keep for portrait)
- [ ] Remove `<RelicTray>` from `CardCombatOverlay.svelte` in landscape (keep portrait)
- [ ] Remove player HP strip from combat overlay in landscape (keep portrait)
- [ ] Remove segment name heading from `DungeonMap.svelte` in landscape (keep portrait)
- [ ] Remove any gold/dust/floor displays that are now redundant
- **Files:** `src/CardApp.svelte`, `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/DungeonMap.svelte`
- **Acceptance:** No duplicate info on screen, portrait mode unchanged

### 7. Handle edge cases
- [ ] Campfire/pause screen: top bar should still be visible (shows run context)
- [ ] Reward room (Phaser scene): verify canvas resize works for this scene too
- [ ] Retreat/Delve screen: top bar helps contextualize the choice
- [ ] Screen transitions: top bar stays fixed during `fly` transitions between in-run screens
- [ ] Boot animation: top bar must NOT appear during boot
- [ ] Hub screen: top bar must NOT appear
- [ ] Non-run screens accessed during a run (settings): top bar can hide or stay
- **Acceptance:** Top bar appears/disappears cleanly at run boundaries

### 8. Visual polish
- [ ] Background: `rgba(10, 15, 25, 0.92)` with `backdrop-filter: blur(8px)` — matches game aesthetic
- [ ] Subtle bottom border: `1px solid rgba(255, 255, 255, 0.08)`
- [ ] HP bar: compact (height ~30% of bar height), rounded, color transitions (green > yellow > orange > red)
- [ ] Gold: coin emoji or sprite icon, number in white, subtle text-shadow — font scales with `--text-scale`
- [ ] Relics: icons sized relative to bar height (`calc(var(--topbar-height) * 0.55)`), gentle glow on trigger, tooltip on hover
- [ ] Floor text: muted color, smaller than gold/HP text, doesn't compete — all via `clamp()` or scale vars
- [ ] Pause button: sized relative to bar height, matches existing style, right-aligned
- [ ] ALL dimensions must be viewport-relative or scale-var-based — zero hardcoded px
- **Acceptance:** Looks polished and game-ready at 1920x1080

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Visual inspection at 1920x1080 landscape: top bar visible, game pushed down, no overlap
- [ ] Combat screen: HP, gold, relics, floor all visible in top bar
- [ ] Dungeon map: top bar shows, map content below
- [ ] Shop/rest/mystery: top bar persists across all in-run screens
- [ ] Portrait mode: ZERO changes — top bar does not appear, all existing layout preserved
- [ ] Phaser canvas: enemy sprites, backgrounds, HP bars all positioned correctly in reduced viewport
- [ ] Screen transitions: no visual glitch when transitioning between in-run screens
- [ ] Run start → run end: top bar appears when run starts, disappears when run ends

---

## Files Affected

| File | Change |
|------|--------|
| `src/ui/components/InRunTopBar.svelte` | **NEW** — the top bar component |
| `src/CardApp.svelte` | CSS vars, top bar render, viewport push-down, remove redundant pause btn |
| `src/ui/components/CardCombatOverlay.svelte` | Remove redundant HP/relic/pause in landscape |
| `src/ui/components/DungeonMap.svelte` | Remove redundant segment name/pause in landscape |
| `src/game/CardGameManager.ts` | Account for top bar in canvas sizing |
| `src/stores/layoutStore.ts` | Export TOPBAR_HEIGHT constant |
| `docs/GAME_DESIGN.md` | Document top bar as landscape UI feature |
| `docs/ARCHITECTURE.md` | Document InRunTopBar component |

---

## Risk: Phaser Canvas Resizing

The biggest risk is the Phaser canvas not handling the reduced viewport gracefully. The current setup:
- `Phaser.Scale.FIT` mode with `CENTER_BOTH`
- Canvas CSS: `object-fit: cover; width: 100vw; height: 100dvh`

When we shrink the container, we need:
1. The CSS `height` to respect `--topbar-height`
2. Phaser's ScaleManager to know about the new size
3. `CombatScene.resize()` to fire so sprites reposition

**Mitigation:** Test this FIRST (sub-step 2) before building the full component. If Phaser doesn't cooperate, we may need to call `game.scale.resize(newW, newH)` explicitly when the top bar mounts/unmounts.

---

## Design Reference

Inspired by Slay the Spire's top bar which shows:
- Player HP (left)
- Gold count (left-center)
- Floor/act info (center)
- Relics (right row)
- Settings gear (far right)

Our version adds: AP orb (combat), block indicator, chain counter, ascension badge, expert mode badge.
