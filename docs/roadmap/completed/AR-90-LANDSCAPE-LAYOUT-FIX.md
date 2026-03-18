# AR-90: Landscape Layout Fix — Critical

## Context

Visual inspection at 1920×1080 reveals the landscape mode is completely broken. The `layoutMode` store correctly detects landscape, but the actual rendering is wrong everywhere.

**Root cause:** `--layout-scale` is `0.47` at 1920×1080. It should be `~1.5` (`Math.min(1920/1280, 1080/720)`). This wrong scale makes everything tiny. Additionally, ALL non-hub screens are confined to the portrait center column (~500px wide) instead of using the full viewport width.

## Issues Found (Screenshots taken)

1. **`--layout-scale` = 0.47** — Scale computation in `CardApp.svelte` `updateLayoutScale()` is wrong for landscape mode. Probably still running through the portrait formula or a clamping issue.

2. **Non-hub screens confined to portrait column** — Library, Settings, Map, Combat, Domain Select are all rendered inside the hub's `.hub-center` column (9:16 aspect ratio) instead of using `position: fixed; inset: 0` to fill the viewport. The landscape `{#if}` branches in these components may not be taking effect, OR the components are being rendered inside a container that constrains them.

3. **Nav sidebar not rendering** — `HubNavBar.svelte`'s `.nav-sidebar` is not in the DOM despite landscape mode being active.

4. **Combat Phaser canvas portrait-sized** — The Phaser game is still rendering at 390×844 despite `CardGameManager.ts` having a layout mode subscriber. Either the subscriber isn't firing, or the resize call isn't working.

5. **Combat overlay portrait layout** — `CardCombatOverlay.svelte` and `CardHand.svelte` are rendering portrait layout. The `{#if $isLandscape}` branches may not be reached, or the components are inside a constraining parent.

6. **Map screen has no landscape branch** — Pure portrait rendering with black bars.

## Directive

### Step 1: Fix `--layout-scale` computation

**File:** `src/CardApp.svelte`

Read `updateLayoutScale()`. The landscape branch should compute:
```typescript
if (mode === 'landscape') {
  scale = Math.min(viewportWidth / 1280, viewportHeight / 720);
}
```
Find why it's returning 0.47 instead of 1.5. Common bugs:
- Scale being clamped by an old `Math.min(scale, 2.5)` or `Math.max` that doesn't account for landscape
- Using `BASE_WIDTH` (390) instead of `LANDSCAPE_BASE_WIDTH` (1280)
- The landscape branch not being entered (check `get(layoutMode)` vs `$layoutMode`)
- The user UI scale multiplier (from `recall-rogue-ui-scale` localStorage) overriding

### Step 2: Fix screen container hierarchy

The root issue is likely that `CardApp.svelte`'s template wraps ALL screens inside a container that has portrait constraints. In landscape mode, screens (Library, Settings, Combat, etc.) must fill the FULL viewport, not be confined to a center column.

Check `CardApp.svelte`'s template structure. If there's a wrapper div constraining width/height, the landscape branch needs to remove those constraints. Each screen component should have `position: fixed; inset: 0` in landscape mode (they already do in portrait, so this might be a CSS specificity issue).

### Step 3: Fix HubNavBar sidebar

**File:** `src/ui/components/HubNavBar.svelte`

The nav sidebar isn't rendering. Check:
- Is the `{#if $isLandscape}` branch syntactically correct?
- Is `HubNavBar` actually mounted in the landscape hub template?
- Is it hidden behind another element (z-index)?

### Step 4: Fix Phaser canvas resize

**File:** `src/game/CardGameManager.ts`

The Phaser canvas should be 1280×720 in landscape. Check:
- Is the `layoutMode` subscription actually firing?
- Add a `console.log` to verify: `console.log('[Phaser] Resizing to', canvas.width, canvas.height, 'for mode', mode)`
- Check if `game.scale.resize()` is being called with correct args
- Check if `handleLayoutChange()` is being called on active scenes

### Step 5: Fix combat layout

**Files:** `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/CardHand.svelte`

These have `{#if $isLandscape}` branches. If they're rendering inside a portrait-constrained parent, the landscape CSS won't help. They need `position: fixed; inset: 0` to escape any parent constraints.

### Step 6: Fix map screen

**File:** `src/ui/components/MapScreen.svelte` (or whatever the map component is called — find it)

The map has no landscape branch. It needs one — or at minimum, needs to fill the viewport instead of being confined to portrait column.

## Acceptance Criteria

- [ ] `--layout-scale` ≈ 1.5 at 1920×1080
- [ ] Hub fills viewport with side panels
- [ ] Nav sidebar visible in landscape
- [ ] Library uses full viewport width (4+ column grid fills screen)
- [ ] Settings uses full viewport width (sidebar + panel)
- [ ] Map uses full viewport
- [ ] Combat: Phaser canvas fills viewport at 1280×720
- [ ] Combat: Option D layout (enemy right, cards bottom, center stage left)
- [ ] All text readable at correct scale
- [ ] Portrait mode UNCHANGED (verify at 390×844)

## Verification

Run dev server, open at 1920×1080, visually inspect EVERY screen.
Take screenshots before/after for comparison.
