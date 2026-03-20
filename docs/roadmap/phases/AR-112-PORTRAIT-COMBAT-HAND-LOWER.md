# AR-112: Portrait Combat — Lower Card Hand & Relocate Piles

## Overview
In portrait/mobile combat, lower the card fan closer to the bottom of the screen and move the draw/discard pile indicators to sit **above** the card hand (same horizontal positions). All related animations (draw deal, discard fizzle, hand discard, reshuffle fly) must track the new pile positions.

**Scope**: Portrait mode only. Landscape layout is untouched.
**Complexity**: Medium — CSS positioning changes + animation target verification.
**Dependencies**: None.

## Current Layout (Portrait)

| Element | Position |
|---------|----------|
| Card hand container | `bottom: calc(56px * scale + 10vh)` — ~178px from viewport bottom |
| Draw pile | `right: 12px * scale`, `bottom: 68px * scale` — right side, below hand |
| Discard pile | `left: 12px * scale`, `bottom: 68px * scale` — left side, below hand |
| Reshuffle fly zone | `bottom: 68px * scale` — between piles |
| AP orb | `left: 16px * scale`, `bottom: 45vh` — left side, mid-screen |

## Target Layout (Portrait)

| Element | New Position |
|---------|-------------|
| Card hand container | `bottom: calc(56px * scale + 2vh)` — much closer to bottom (was 10vh, now 2vh) |
| Draw pile | `right: 12px * scale`, positioned **above** the card hand top edge |
| Discard pile | `left: 12px * scale`, positioned **above** the card hand top edge |
| Reshuffle fly zone | Same vertical level as piles (above card hand) |

## Sub-steps

### 1. Lower the card hand container
**File**: `src/ui/components/CardHand.svelte`
**Class**: `.card-hand-container` (line ~1364)
**Change**: `bottom: calc(calc(56px * var(--layout-scale, 1)) + 10vh)` → `bottom: calc(calc(56px * var(--layout-scale, 1)) + 2vh)`
**Acceptance**: Card fan sits ~80px closer to the bottom of the screen.

### 2. Move draw pile indicator above the card hand
**File**: `src/ui/components/CardCombatOverlay.svelte`
**Class**: `.draw-pile-indicator` (line ~2366)
**Change**: Remove `bottom: calc(68px * var(--layout-scale, 1))`. Instead use `bottom: calc(calc(56px * var(--layout-scale, 1)) + 2vh + calc(280px * var(--layout-scale, 1)) + calc(8px * var(--layout-scale, 1)))` — this stacks it just above the card hand container (hand bottom + hand height + small gap). Keep `right: calc(12px * var(--layout-scale, 1))` unchanged.

Simplification: introduce a CSS custom property `--hand-bottom` to avoid duplicating the hand bottom calc. Or just hardcode the combined value. The key formula is:
- Hand bottom edge = `calc(56px * scale + 2vh)`
- Hand height = `calc(280px * scale)`
- Pile sits at = hand bottom + hand height + 8px gap = `calc(336px * scale + 2vh + 8px * scale)` = `calc(344px * scale + 2vh)`

So: `bottom: calc(calc(344px * var(--layout-scale, 1)) + 2vh)`

### 3. Move discard pile indicator above the card hand
**File**: `src/ui/components/CardCombatOverlay.svelte`
**Class**: `.discard-pile-indicator` (line ~2371)
**Change**: Same `bottom` value as draw pile: `bottom: calc(calc(344px * var(--layout-scale, 1)) + 2vh)`. Keep `left: calc(12px * var(--layout-scale, 1))` unchanged.

### 4. Move reshuffle fly zone to match new pile positions
**File**: `src/ui/components/CardCombatOverlay.svelte`
**Class**: `.reshuffle-fly-zone` (line ~2412)
**Change**: `bottom: calc(68px * var(--layout-scale, 1))` → `bottom: calc(calc(344px * var(--layout-scale, 1)) + 2vh)` — same as piles.

### 5. Verify draw/discard/fizzle animations track automatically
The draw-deal animation in `CardHand.svelte` reads `--draw-pile-x`/`--draw-pile-y` and `--discard-pile-x`/`--discard-pile-y` CSS custom properties. These are set dynamically from `getBoundingClientRect()` of the pile elements in `CardCombatOverlay.svelte` lines 98-107. Since we're moving the pile DOM elements, the CSS vars will automatically update — **no animation code changes needed**.

The `cardFizzle` keyframe and `cardHandDiscard` keyframe both reference `--discard-pile-x`/`--discard-pile-y` or `--discard-offset-x`/`--discard-offset-y` which are computed from the pile element rects. These will also auto-update.

**Acceptance**: Trigger a card draw, card discard, and reshuffle — all animations should fly to/from the new pile positions.

### 6. Verify no overlap with other UI elements
- AP orb is at `bottom: 45vh` (mid-screen) — no conflict
- Enemy intent bubble, HP strips are all upper screen — no conflict
- The piles above the hand should not overlap with the quiz overlay area
- Check that cards when selected (-80px lift) don't clip behind pile indicators

## Files Affected
- `src/ui/components/CardHand.svelte` — card hand container bottom position
- `src/ui/components/CardCombatOverlay.svelte` — pile indicators + reshuffle fly zone positions

## Verification Gate
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Playwright screenshot of combat in portrait mode shows:
  - Card fan lower on screen (~2vh above AP bar area)
  - Draw pile (green) on the right, ABOVE the card fan
  - Discard pile (orange) on the left, ABOVE the card fan
- [ ] Card draw animation flies from draw pile (above hand) into the fan
- [ ] Card discard/fizzle animation flies from fan to discard pile (above hand)
- [ ] Reshuffle animation flies from discard to draw pile (both above hand)
- [ ] No UI overlap issues with AP orb, intent bubble, or quiz overlay
