---
status: pending
delete-after-implementation: true
priority: mid-term
effort: M
impact: medium
owner-agent: game-logic + ui-agent
depends-on: none
---

# Floor Descent Ceremony

## What It Is

When moving between floors, replace the generic room transition with a dedicated 2-3s descent
sequence featuring a vertical camera bias, cross-floor color temperature shift, a centered floor
title card, a short debris particle cascade, and a landing rumble.

## Why It Matters

Floor transitions currently feel identical to entering a shop or rest site. The player descends
deeper into a dungeon — that should feel different from walking sideways into a room. A distinct
ceremony communicates progression, reinforces the floor-theme shift, and gives the player a
moment of anticipation before the next encounter.

## Current State

Floor transitions use the exact same `ParallaxTransition.svelte` WebGL dolly-zoom as any other
room transition (enter/exit-forward/exit-backward, 3000ms each). `roomAtmosphere.ts` defines
`getFloorTheme(floor)` returning theme names (dust/embers/ice/arcane/void) across floor ranges
and full `AtmosphereConfig` presets per theme with distinct color grading — but this palette
shift is applied statically at encounter start, not during the floor transition itself.
`gameFlowController.ts` calls `advanceFloor()` from `floorManager`. No floor title card exists,
no debris particles, no differentiation from lateral room transitions.

## Implementation Spec

### Files to Modify

- `src/ui/components/ParallaxTransition.svelte` — add `isFloorDescent: boolean` and
  `floorNumber: number` props; activate descent-specific behavior when true
- `src/game/scenes/CombatScene.ts` (or whichever caller triggers floor transition) — pass the
  descent flag and current floor number when advancing floors
- `src/data/roomAtmosphere.ts` — export a `FLOOR_THEME_COLORS` map keyed by theme name
  with representative hex colors for use in the title card glow

### Files to Create (if any)

- No new files required; floor title card is implemented as a conditional block inside
  `ParallaxTransition.svelte`

### Technical Details

**isFloorDescent=true behavioral changes inside ParallaxTransition.svelte:**

Vertical emphasis — increase the walking-bob amplitude by 2× for the duration of the
transition and bias the sine wave phase so positive Y (downward drift) dominates. Increase
dolly-zoom displacement by 25% to suggest depth rather than lateral travel.

Color grading shift — interpolate the uBrightness uniform and the background tint from the
outgoing floor theme palette to the incoming floor theme palette across the full transition
duration. Use `FLOOR_THEME_COLORS` to drive the tint endpoint. Warm amber (floors 1-3) →
hot orange (floors 4-6) → ice blue (floors 7-9) → purple-arcane (floors 10-12) → deep void
(floors 13+). Do not snap — linearly interpolate across the 3000ms window.

Floor title card — a Svelte overlay block (not Phaser) rendered inside the component.
Position: centered horizontally and vertically. Content: "Floor N" as primary text, optional
thematic subtitle pulled from a `FLOOR_SUBTITLES` constant keyed by theme. Style: same
`font-family` as `NarrativeOverlay.svelte`, white text, `text-shadow` glow color matching the
incoming floor theme color from `FLOOR_THEME_COLORS`. Timing: fade in at T+1200ms (transition
midpoint), hold for 800ms, fade out over 400ms. Implemented with CSS `opacity` transition
driven by a reactive `$state` variable and `setTimeout`.

Debris cascade — one-shot burst of 20-30 falling particles spawned via
`CombatParticleSystem` at the moment the transition begins (T+0ms). Properties: small
gray/brown 2-4px squares, gravity 80, downward angle spread 250-290°, initial speed 40-100,
lifespan 800ms. Position: scattered across the upper 60% of the screen width at y=0. Call
`CombatParticleSystem.burstDirectional()` or a new `burstDebris(count, screenWidth)` helper.

Landing rumble — heavy screen shake (tier-3, 200ms) via `ScreenShakeSystem` fired at
T+2800ms (the "floor reached" moment just before `onSettle` callback). This is the existing
heavy preset (8px / 18Hz) used for kills.

Boss floor variant (floors 3, 6, 9, 12) — extend transition duration to 4000ms (pass as
prop override), slow the color-shift interpolation, hold the vignette at maximum alpha for
600ms at the midpoint before resuming the fade-out. Boss floors are identifiable in
`floorManager` via the existing `isBossFloor(floor)` helper.

### Integration Points

`gameFlowController.ts` → `advanceFloor()` — this is where to pass `isFloorDescent=true` and
`floorNumber` to the transition component. The existing `onSettle` callback chain does not
need to change.

`CombatAtmosphereSystem.ts` — the theme switch already happens at encounter start via
`setTheme(theme)`. The descent transition only needs the color endpoint values for
interpolation; it does not need to call into `CombatAtmosphereSystem` directly.

`roomAtmosphere.ts` — export `FLOOR_THEME_COLORS: Record<string, number>` mapping theme
name to a representative Phaser hex color (e.g. `dust: 0xCC9944`, `embers: 0xFF6622`,
`ice: 0x88CCFF`, `arcane: 0xAA44FF`, `void: 0x220033`). Import this in
`ParallaxTransition.svelte` via the existing Vite alias so Svelte can read it.

### Reduce-Motion Handling

When `isReduceMotionEnabled()` returns true: skip debris particles and landing rumble
entirely. Keep the color temperature shift (CSS `background-color` transition, not motion)
and the floor title card (static fade, not motion). The transition duration stays at 3000ms
but the parallax bob amplitude is NOT increased.

### Device Tier Handling

Low-end (from `deviceTierService.ts`): reduce debris particle count from 20-30 to 10.
Mid and flagship: full count. No other tier differences — the color shift and title card are
CSS/uniform operations with negligible GPU cost.

## Verification

1. Trigger a floor advancement from floor 1 to floor 2 and from floor 3 to floor 4. The
   floor descent transition must look visually distinct from entering a shop or rest site.
2. Confirm the title card ("Floor 2", "Floor 4", etc.) appears centered, readable, and fades
   in at approximately the midpoint of the transition.
3. Confirm the color grading visibly shifts toward the next floor theme — check amber→orange
   at the floor 3/4 boundary.
4. Confirm debris particles fall downward during the transition.
5. Confirm the landing rumble fires at the end (not the start) of the transition.
6. Trigger a boss floor transition (floor 3 or 6). Confirm it holds longer and feels
   heavier.
7. Enable reduce-motion, re-test: title card and color shift present; no particles or shake.

## Effort Estimate

M — 2-3 days. `ParallaxTransition.svelte` changes are the bulk of the work (vertical
bias, color interpolation, title card, debris trigger). The `CombatParticleSystem` call is
straightforward. The `FLOOR_THEME_COLORS` export from `roomAtmosphere.ts` is one-line.
Boss variant requires one conditional branch. Reduce-motion and device-tier guards follow
existing patterns.
