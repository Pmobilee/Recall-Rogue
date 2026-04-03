---
status: implemented
delete-after-implementation: true
priority: mid-term
effort: M
impact: medium-high
owner-agent: game-logic
depends-on: none
---

# Knowledge-Reactive Dungeon Feedback

## What It Is

Correct answers trigger a brief environmental "approval" reaction — a warm radial light pulse
from the card play area plus a short upward acceleration burst in the ambient particles. Wrong
answers trigger the opposite — a cold vignette darkening, a scatter impulse on ambient
particles, and a brief point-light flicker. After three consecutive correct or wrong answers
within an encounter, a persistent ambient shift holds for the remainder of that encounter.

## Why It Matters

Currently the dungeon atmosphere is a static backdrop set once per encounter. Quiz answers
already drive GAIA expression changes, damage numbers, screen flashes, and enemy hit reactions
— but the environment itself is silent. Making the dungeon react to player knowledge binds the
two core systems (knowledge and combat) together spatially: the room literally brightens when
the player knows their facts and dims when they don't.

## Current State

Quiz answer feedback is choreographed in `juiceManager.ts` (`fireCorrect` / `fireWrong`).
Correct gets haptic, white screen flash (0.3 intensity), damage number at T+50ms, enemy hit
and particle burst at T+150ms. Wrong gets the wrong-fizzle path (details in `juiceManager.ts`
`fireWrong`). GAIA expression changes on both outcomes. `CombatAtmosphereSystem.ts` is
configured once per encounter from floor theme via `setTheme(theme)` — no runtime modulation
methods exist. `DepthLightingSystem.ts` manages point lights and directional light but has no
one-shot pulse API. No consecutive-answer streak is tracked anywhere. No warm/cold ambient
shift exists.

## Implementation Spec

### Files to Modify

- `src/services/juiceManager.ts` — add `onAtmosphereWarm` and `onAtmosphereCold` callbacks;
  call them from `fireCorrect` and `fireWrong` respectively; add consecutive-answer streak
  counter and streak threshold logic
- `src/game/systems/CombatAtmosphereSystem.ts` — add `pulseWarm(duration: number): void` and
  `pulseCold(duration: number): void` public methods; add `setStreakWarm(active: boolean)` and
  `setStreakCold(active: boolean)` for persistent ambient modulation
- `src/game/systems/DepthLightingSystem.ts` — add `pulseLight(color: number, intensity: number, duration: number, x: number, y: number): void` for one-shot point-light burst
- `src/game/scenes/CombatScene.ts` — wire the `juiceManager` callbacks to the atmosphere and
  lighting systems; provide card-play-area screen coordinates to the light pulse

### Files to Create (if any)

None.

### Technical Details

**Correct answer pulse (total duration 500ms):**

Radial light pulse via `DepthLightingSystem.pulseLight()`. Position: the card play area
center (approximately screen center-bottom, same coords used for weapon animations). Color:
`0xFFEECC` (warm white-gold). Intensity: 0 → 0.6 → 0 over 400ms using a quadratic ease-out
on the rise and ease-in on the fall. Implementation: create a temporary Phaser point light at
the given screen position via `scene.lights.addPointLight()`, tween its intensity, then
`scene.lights.removePointLight()` on completion.

Particle upward boost via `CombatAtmosphereSystem.pulseWarm(300)`. Inside that method:
temporarily lower the `gravityY` on both emitters (back and front) by 30 units for 300ms,
then restore. Use `scene.time.delayedCall(300, restore)` for the reset. This makes existing
dust/ember/ice particles visibly accelerate upward as if warmed.

Vignette ease via the existing flash overlay or a direct alpha tween on the vignette
graphics object: alpha −0.05 for 500ms then restore. Access the vignette through the
existing `CombatScene` reference.

**Wrong answer flicker (total duration 400ms):**

Vignette darken via `CombatAtmosphereSystem.pulseCold(300)`: alpha +0.05 for 300ms then
restore.

Particle scatter via the same `pulseCold` method: add a random velocity impulse (+50
speed in a random radial direction) to both emitters for 200ms. Implemented by briefly
modifying `speedX`/`speedY` ranges on the emitters, then restoring.

Point light flicker: pick one existing scene point light (if any are registered in
`DepthLightingSystem`) and tween its intensity to 0 over 100ms, hold 100ms, return over
100ms. If no point lights exist (low-end device), skip this step.

Micro shake: call `ScreenShakeSystem` tier-1 (micro, 100ms) — the existing `fireWrong`
path may already include this; do not double-fire.

**Consecutive streak tracking:**

Add two `$state`-style mutable counters to `juiceManager.ts`: `consecutiveCorrect` and
`consecutiveWrong`. On each `fireCorrect` call: increment `consecutiveCorrect`, reset
`consecutiveWrong`. On each `fireWrong` call: increment `consecutiveWrong`, reset
`consecutiveCorrect`.

Streak thresholds: when `consecutiveCorrect` reaches 3, call
`CombatAtmosphereSystem.setStreakWarm(true)`. When `consecutiveWrong` reaches 3, call
`CombatAtmosphereSystem.setStreakCold(true)`. When the opposite streak resets (consecutive
crosses 0 on the other counter), call the other `setStreak*(false)`.

`setStreakWarm(true)` effect in `CombatAtmosphereSystem`: persistently shift PostFX
saturation +5% (clamp total modifier at +10%), shift directional light color toward
`0xFFEEDD` (warm). Implementation: store a `saturationModifier` float (−10 to +10) and
apply it as a uniform offset in the existing PostFX pipeline. Reset to 0 at
`setStreakWarm(false)` or `setStreakCold(true)`.

`setStreakCold(true)` effect: shift saturation −5% (clamp at −10%), shift directional
light color toward `0xCCDDFF` (cool desaturated). Reset at `setStreakCold(false)` or
`setStreakWarm(true)`.

Both streak states reset at encounter end — call `resetStreak()` from the
`CombatAtmosphereSystem.destroy()` or from wherever `juiceManager` is reset between
encounters.

Maximum modifier bounds: ±10% saturation. This prevents extreme shifts after long
streaks. The PostFX saturation uniform must be clamped in the GLSL or in the setter.

**Timing relative to existing juiceManager choreography:**

`fireCorrect` sequence: T+0ms haptic + screen flash (unchanged), T+0ms atmosphere warm
pulse fires in parallel (does NOT delay existing feedback), T+50ms damage number
(unchanged), T+150ms enemy hit + particles (unchanged).

`fireWrong` sequence: T+0ms atmosphere cold flicker fires in parallel with existing wrong
feedback.

The atmosphere reactions fire at T+0 in parallel — they must not delay or replace any
existing juice choreography.

### Integration Points

`juiceManager.ts` callbacks (`onAtmosphereWarm`, `onAtmosphereCold`) are registered by
`CombatScene.ts` at scene startup, the same pattern used for `onScreenFlash`,
`onDamageNumber`, etc. `CombatScene` passes the card-play-area coordinates (x, y) into the
warm callback so `DepthLightingSystem.pulseLight` receives a concrete screen position.

`DepthLightingSystem.pulseLight` is a one-shot fire-and-forget call — it creates a
temporary light, tweens it, and removes it. It does not affect the persistent light catalog
in `lightSourceManifest.ts`.

`CombatAtmosphereSystem` streak state resets must be called from the same location that
currently calls `setTheme()` for the next encounter, ensuring clean state across room
transitions.

### Reduce-Motion Handling

When `isReduceMotionEnabled()` is true: skip ALL particle velocity modifications (upward
boost and scatter impulse) and skip the point-light pulse and flicker entirely. Keep ONLY
the subtle persistent color temperature drift from streak tracking — this is a uniform color
shift, not motion. The vignette alpha nudge (+/−0.05) is also acceptable under reduce-motion
as it is a brightness change, not positional motion.

### Device Tier Handling

Low-end: skip particle velocity modifications (no emitter manipulation). Skip point-light
pulse (no dynamic lights on low-end per existing DepthLightingSystem tier rules). Keep
vignette alpha nudge and streak color temperature shift. Mid and flagship: full behavior.

## Verification

1. Play a quiz answer. On correct: confirm a warm light briefly appears near the card play
   area and ambient particles visibly nudge upward for ~300ms.
2. On wrong: confirm vignette briefly darkens and particles scatter outward.
3. Answer 3+ consecutive correct answers. Confirm the dungeon atmosphere holds a warmer
   ambient tone — compare PostFX saturation visually against a screenshot taken before the
   streak.
4. Answer 3+ consecutive wrong answers. Confirm ambient cools and desaturates slightly.
5. Start a new encounter after a streak. Confirm the ambient resets to baseline (no
   persistent carry-over from previous encounter).
6. Enable reduce-motion. Confirm no particle changes or light pulses fire; streak color
   shift still applies.
7. Run `npx vitest run` to confirm no regressions in juiceManager unit tests.

## Effort Estimate

M — 2-3 days. The hardest part is adding `pulseWarm`/`pulseCold` to `CombatAtmosphereSystem`
without disrupting its emitter lifecycle. The `DepthLightingSystem.pulseLight` helper is
straightforward (create/tween/remove). The streak counter in `juiceManager` is a few lines.
The PostFX saturation modifier requires confirming the existing uniform name in
`DepthLightingFX.ts` and wiring a setter.
