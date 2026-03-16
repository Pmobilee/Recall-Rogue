# AR-50: Map Cinematic Scroll & Boss/Elite Animations

**Status:** Complete
**Created:** 2026-03-16
**Completed:** 2026-03-16
**Depends on:** None

## Overview

When the dungeon map opens, instead of jumping to the current position, play a cinematic scroll: start at the top (boss end), accelerate scrolling down through the entire floor, then decelerate smoothly to land on the player's current available nodes. Also add enhanced pulse animations for boss and elite nodes to make them visually distinct and intimidating.

## Tasks

### Section A: Cinematic Scroll Animation

- [x] **A.1** In `DungeonMap.svelte`, replace the current `scrollIntoView()` with a custom `cinematicScroll()` function that:
  - Starts the scroll container at `scrollTop = 0` (top of map = boss end)
  - Animates scroll using an ease-in-out curve over ~1.5-2 seconds
  - Uses `requestAnimationFrame` for smooth 60fps animation
  - Targets the same position as before (lowest available row, centered)
  - Only plays on first map open per floor (not when returning from combat)
  - **Implementation:** Cinematic scroll implemented in DungeonMap.svelte — starts at scrollTop=0 (boss), 400ms delay, then easeInOutCubic animation over 1800ms to player's available nodes. Only plays on first map open (hasPlayedCinematic flag). Subsequent opens use smooth scrollIntoView.
  - Acceptance: Smooth scroll from boss → player position on first map view

### Section B: Boss & Elite Node Animations

- [x] **B.1** In `MapNode.svelte`, add enhanced animations for boss and elite nodes:
  - Boss nodes: slower, dramatic pulse with larger glow radius + slight scale breathe
  - Elite nodes: menacing pulse with purple glow, slightly faster than boss
  - Both should animate regardless of state (even when locked) — player should see them "waiting"
  - **Implementation:** Boss nodes get bossPulse (3s, scale 1→1.15, triple-layer red glow). Elite nodes get elitePulse (2s, scale 1→1.08, double-layer purple glow). Both animate regardless of state except visited. Reduced-motion support included.
  - Acceptance: Boss and elite nodes are visually distinct and attention-grabbing

## Verification Gate

- [x] `npm run typecheck` — clean
- [x] Visual test: start a run, map scrolls from top to bottom smoothly
- [x] Boss/elite nodes have distinct, more dramatic animations than normal nodes

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/DungeonMap.svelte` | EDIT | A.1 |
| `src/ui/components/MapNode.svelte` | EDIT | B.1 |
