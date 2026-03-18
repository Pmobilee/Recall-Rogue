# AR-91: Landscape Visual Fixes — 6 Critical Bugs

> **Context:** Full visual inspection at 1920×1080 after AR-90 scale fix. Layout mode and scale are correct, but individual components have broken rendering.

## Bug 1: Phaser Canvas Portrait-Sized (CRITICAL)

**Symptom:** Canvas is 499×1080 at x=710 — portrait aspect centered in viewport.
**Expected:** Canvas should fill full viewport (1920×1080 or 1280×720 scaled).
**Root cause:** `CardGameManager.ts` layout subscription may not be calling `game.scale.resize()` correctly, or the Phaser scale mode is constraining to original 390×844 config.

**Fix:** In `src/game/CardGameManager.ts`:
1. Verify the `layoutMode` subscription fires on init (not just on change)
2. On landscape: call `game.scale.resize(1280, 720)` AND update the parent container CSS to `width: 100%; height: 100%`
3. Also set `#phaser-container` to `display: block; width: 100vw; height: 100vh` in landscape mode
4. Check if `display: none` is set on the phaser container during hub — it should become visible during combat

## Bug 2: Cards All Stacked at Same Position (CRITICAL)

**Symptom:** All 5 cards at exact same x=872, y=823 in `.card-hand-landscape`.
**Expected:** Cards spread horizontally across the 1920px-wide hand strip.
**Root cause:** The landscape card positioning CSS is likely using `position: absolute` with transforms that all compute to the same value, OR flex layout isn't distributing children.

**Fix:** In `src/ui/components/CardHand.svelte`:
1. Read the `.card-hand-landscape` CSS and the landscape card rendering code
2. Cards should use `display: flex; justify-content: center; gap: 16px` or similar
3. If cards use `position: absolute` + transforms, the transforms must compute different x positions per card
4. Each card should be at a different horizontal position. With 5 cards of ~176px width + gaps, they should spread ~1000px across the center

## Bug 3: Nav Sidebar Missing (HIGH)

**Symptom:** No nav-related elements in DOM at all on hub screen.
**Root cause:** `HubNavBar` component either:
  a) Not mounted in the landscape hub template (`.hub-landscape` in `HubScreen.svelte`)
  b) The `{#if $isLandscape}` branch in `HubNavBar.svelte` produces empty output
  c) Component not imported/rendered

**Fix:** In `src/ui/components/HubScreen.svelte`:
1. Check if `HubNavBar` is included in the landscape branch
2. If not, add it — position it inside `.hub-landscape` but OUTSIDE `.hub-center` (on the left edge)

In `src/ui/components/HubNavBar.svelte`:
1. Check the `{#if $isLandscape}` branch produces actual DOM
2. The sidebar should be `position: fixed; left: 0; top: 0; height: 100vh; width: 80px; z-index: 100`

## Bug 4: Map Nodes Vertical Layout (HIGH)

**Symptom:** Map fills viewport but nodes only spread 359px horizontally, 1967px vertically — portrait column.
**Root cause:** The map component has no landscape CSS adaptation. Node positions are likely computed in portrait coordinates.

**Fix:** The dungeon map component (find it — likely `src/ui/components/DungeonMap.svelte` or similar):
1. In landscape mode, nodes should spread wider horizontally and compress vertically
2. Scale node x positions by viewport width ratio
3. Or: add `transform: scale(X)` to the node container in landscape to fit within viewport
4. At minimum, the scrollable area should be horizontal rather than vertical

## Bug 5: Settings Panel Overlaps Sidebar (MEDIUM)

**Symptom:** Settings sidebar = 200px, but panel = 1920px wide (overlapping sidebar).
**Fix:** In `src/ui/components/SettingsPanel.svelte`:
1. The landscape layout should be `display: flex` with sidebar and panel side by side
2. Panel should be `flex: 1` (takes remaining width after sidebar), NOT `width: 100%`

## Bug 6: Player HP Bar Layout (MEDIUM)

**Symptom:** Player HP bar is 1152px horizontal bar at bottom.
**Expected:** In Option D, player HP should be more compact, not spanning the full width.
**Fix:** In `src/ui/components/CardCombatOverlay.svelte` landscape CSS:
1. Constrain player HP bar width in landscape mode
2. Or position it as a vertical bar on the left edge of the enemy panel (per the Option D spec)

## Acceptance Criteria

- [ ] Phaser canvas fills viewport in combat (≥1200px wide)
- [ ] 5 cards visible and spread horizontally across bottom strip
- [ ] Nav sidebar visible on hub screen (left edge, 80px wide)
- [ ] Map nodes spread horizontally to use landscape space
- [ ] Settings panel sits beside sidebar (not overlapping)
- [ ] Player HP bar appropriately sized for landscape
- [ ] Portrait mode UNCHANGED at 390×844
