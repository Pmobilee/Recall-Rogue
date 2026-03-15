# AR-35: Combat UI Card Size & Background Pass ✅

## Overview

**Goal**: Increase card size in the combat hand to nearly double, adjust AP orb positioning upward, and make the combat overlay background stretch the full screen height.

**Dependencies**: None (combat UI is stable)
**Estimated Complexity**: Small
**Status**: Completed (2026-03-15)

**Context**: User feedback that cards in hand are too small on mobile. The card arch fan layout should be preserved but cards should be significantly larger. The AP sphere should move up to accommodate. The gradient background of the combat overlay should cover the entire viewport height, not just the bottom 45%.

## Current State (Before)

- Card width: `calc(var(--gw, 390px) * 0.22)` — ~86px on 390px viewport
- Card height: 1.42× card width — ~122px
- Max hand width: `viewportWidth * 0.82`
- Card overlap spacing: `cardW * 0.55`
- Card hand container bottom: `calc(68px + 10vh)`
- AP orb: `top: calc(10px + var(--safe-top)); left: 40px;` — positioned inside the overlay
- Combat overlay: `height: 45vh` with gradient background
- Arch layout: 30° total spread, 20px arc peak

## Sub-steps

### Step 1: Increase card size in hand
- [x] In `src/ui/components/CardHand.svelte`, change CSS variable `--card-w` from `0.22` to `0.38`
- [x] In `src/ui/components/CardHand.svelte`, update JavaScript `cardW` calculation from `0.22` to `0.38`
- [x] Increase max hand width from `0.82` to `0.92`
- [x] Increase card overlap from `0.55` to `0.65`
- [x] Reduce card hand container `bottom` from `calc(68px + 10vh)` to `calc(40px + 4vh)`
- [x] Increase container height from `200px` to `280px`

### Step 2: Move AP orb upward
- [x] In `src/ui/components/CardCombatOverlay.svelte`, change `.ap-orb` `top` from `calc(10px + var(--safe-top))` to `calc(-60px + var(--safe-top))`

### Step 3: Stretch combat overlay background to full screen height
- [x] Change `.card-combat-overlay` `height` from `45vh` to `100vh`
- [x] Adjusted gradient stops from `30%/100%` to `15%/50%` so it fades out by midscreen

### Step 4: Adjust arc offset for larger cards
- [x] Increased arc peak from `20px` to `30px` in `getArcOffset` function

### Step 5: Verify & adjust related elements
- [x] Typecheck passes (0 errors)
- [x] Build succeeds
- [x] Playwright screenshot confirms larger card, full-height background, AP orb repositioned
- [x] No overlapping UI elements

## Files Affected

- `src/ui/components/CardHand.svelte` — card sizing, spacing, container positioning, arc offset
- `src/ui/components/CardCombatOverlay.svelte` — AP orb position, overlay height/background

## Verification Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] Playwright screenshot shows larger cards in fan layout
- [x] AP orb is above the card hand area
- [x] Background gradient covers full viewport height
- [x] No overlapping UI elements
