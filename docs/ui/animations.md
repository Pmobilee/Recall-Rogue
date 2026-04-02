# Animation Systems

> **Purpose:** Documents all three animation layers (CSS transitions, Web Animations API, Phaser tweens), their conventions, and when to use each. Reference when adding any animated element.
> **Last verified:** 2026-04-02
> **Source files:** `src/ui/utils/mechanicAnimations.ts`, `src/ui/utils/roomPopIn.ts`, `src/ui/utils/cardFrameV2.ts`, `src/ui/components/CardHand.svelte`, `src/ui/components/ParallaxTransition.svelte`, `src/ui/components/DamageNumber.svelte`, `src/game/systems/ScreenShakeSystem.ts`, `src/data/petAnimations.ts`, `src/data/petWaypoints.ts`, `src/ui/effects/petBehavior.ts`

---

## Three Animation Layers

| Layer | Technology | Location | Use for |
|---|---|---|---|
| CSS transitions | `transition:` / `@keyframes` | `.svelte` `<style>` blocks | Hover states, idle loops, simple state flips |
| Web Animations API (WAAPI) | `element.animate([...], opts)` | `CardHand.svelte`, `roomPopIn.ts` | Card draw/discard/fizzle, room element pop-in |
| Phaser tweens | `this.tweens.add(...)` | game scenes | Camera shake, combat sprite effects |

**When to use which:**
- CSS transitions for anything that maps to a CSS state change (`:hover`, class toggle).
- WAAPI when you need to read element positions at runtime before animating (draw-pile-to-fan, discard-pile fly-to). WAAPI with `composite: 'add'` stacks on top of inline transforms without conflict.
- Phaser tweens for anything that lives in the canvas layer (enemy sprites, camera).

---

## Animation Timing Constants (`src/ui/utils/mechanicAnimations.ts`)

All durations pass through `turboDelay()` — in turbo mode they collapse to near-zero.

| Constant | Duration | Phase |
|---|---|---|
| `REVEAL_DURATION` | `turboDelay(250)` ms | Card flips to cardback |
| `SWOOSH_DURATION` | `turboDelay(250)` ms | Type-specific swoosh effect |
| `IMPACT_DURATION` | `turboDelay(300)` ms | 3D directional hit movement |
| `DISCARD_DURATION` | `turboDelay(200)` ms | Minimize to discard pile |
| `TIER_UP_DURATION` | `turboDelay(600)` ms | Tier-up celebration |
| `FIZZLE_DURATION` | `400` ms | Wrong answer / cancelled (not turbo-shortened) |

---

## Card Play Animation Phases

`CardAnimPhase = 'reveal' | 'swoosh' | 'impact' | 'discard' | 'tier-up' | 'fizzle' | null`

`CardAnimArchetype = 'attack' | 'shield' | 'buff' | 'debuff' | 'utility' | 'wild'`

`getAnimClass(cardType, phase)` returns CSS class strings:
- `reveal` → `'card-reveal'`
- `swoosh` → `'card-swoosh card-swoosh-{archetype}'`
- `impact` → `'card-impact card-impact-{archetype}'`
- `discard` → `'card-discard'`
- `tier-up` → `'card-tier-up'`
- `fizzle` → `'card-fizzle'`

---

## Card Draw Animation (WAAPI, `CardHand.svelte`)

`initCardAnimOffsets(el)` — Svelte action called on each card element at mount:

1. Reads `--draw-pile-x/y` and `--discard-pile-x/y` CSS variables (set by `CardCombatOverlay`).
2. Stores `--discard-offset-x/y` as inline CSS vars on the card element.
3. Fires a WAAPI animation from the draw pile position to the card's fan position:
   - Start: `translate3d(drawOffX, drawOffY, 0) scale(0.05)`, `opacity: 0`
   - 25%: `translate3d(drawOffX*0.6, drawOffY*0.6, 0) scale(0.4)`, `opacity: 1`
   - End: fan position transform
   - Duration: `450ms`, easing: `cubic-bezier(0.22, 1.2, 0.36, 1)`
   - Stagger: `i * 60ms` (portrait) / `i * 80ms` (landscape) per card
4. Fallback when pile positions unavailable: simple `opacity: 0 → 1` fade, `300ms ease-out`.

Uses double-`requestAnimationFrame` to ensure `CardCombatOverlay`'s `$effect` has set the pile coordinates before measuring.

---

## Card Discard / Fizzle Animation (WAAPI, `CardHand.svelte`)

`ghostCardAnim(el)` — Svelte action on animating ghost cards. A `MutationObserver` watches for `card-discard` or `card-fizzle` class being added, then fires WAAPI:

- **Discard:** `opacity: 0.7 → 0`, scale `1 → 0.15 → 0.05`, flies to discard pile coordinates. Duration: `250ms ease-in`.
- **Fizzle:** Same trajectory but `opacity: 0.4 → 0.2 → 0`, `filter: grayscale(0.5 → 0.8 → 1)`. Duration: `400ms ease-in`.

Both use `fill: 'forwards'` so the card stays invisible after landing.

---

## Fan Position Hover (`CardHand.svelte`)

Cards in hand use CSS transitions for hover spread:
```css
transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease, z-index 0s;
```
Landscape cards use `150ms ease-out`. The upgrade icon uses a float bob:
```css
animation: upgradeFloat 1.5s ease-in-out infinite;
```

---

## Room Pop-In (`src/ui/utils/roomPopIn.ts`)

`staggerPopIn(options: PopInOptions)` — staggers WAAPI pop-in across room UI elements after a transition settles.

```ts
interface PopInOptions {
  elements: (HTMLElement | string)[]  // elements or CSS selectors
  container: HTMLElement
  totalDuration?: number              // default 2500ms, max 3000ms
  onComplete?: () => void
}
```

Per-element animation (WAAPI): `scale(0) → scale(1.08) → scale(1)`, `opacity: 0 → 1`. Duration: `200ms`, easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot).

Delay distribution: sine-based (`eased = (sin((t-0.5)*π) + 1) / 2`) for slow→fast→slow stagger. Last element gets a `+250ms` dramatic pause when `N > 2`.

After each animation, inline `opacity`/`transform` styles are cleared so CSS takes over.

Plays `'ui_pop_in'` audio per element via `audioManager`.

Respects `prefers-reduced-motion`, `localStorage['card:reduceMotionMode'] === 'true'`, and `isTurboMode()` — skips all animation if any condition is true. Turbo skip ensures bots and automated testers see fully visible, interactive elements immediately instead of waiting up to 2.5s.

`popInHidden(el)` — Svelte action to pre-hide elements before `staggerPopIn` runs.

---

## Parallax Room Transitions (`src/ui/components/ParallaxTransition.svelte`)

WebGL canvas-based transition using a depth map for parallax displacement. Three types:

| Type | Effect | Duration default |
|---|---|---|
| `'enter'` | Zoom in `1.1→1.0`, dolly `0.25→0`, vignette fades, brightness `0→1`, opacity fades out last 15% | `3000ms` |
| `'exit-forward'` | Zoom `1.0→2.0`, dolly `0→0.5`, vignette builds, brightness `→0` at 70% | `3000ms` |
| `'exit-backward'` | Zoom `1.0→1.8`, dolly `0→0.4`, same fade pattern | `3000ms` |

A vertical `bobOffset` (sine wave, `Math.sin(t * π * 2 * 8)`) is applied as `translateY` on the canvas for a walking motion effect. Amplitude: 8px (enter), 12px (exit-forward), 10px (exit-backward).

Fragment shader uniforms: `uDolly`, `uZoom`, `uVignette`, `uBrightness`, `uOpacity`. Depth map is loaded as a separate texture; depth value displaces UV coordinates in screen-space.

`persist` mode: after `enter` animation completes, canvas stays as the room background (used by shop/rest/mystery). `onSettle()` fires when settled — use it to trigger `staggerPopIn`. Combat uses Phaser's own background instead.

Click anywhere on the canvas to `skip()` the transition.

---

## Damage Number Animations (`src/ui/components/DamageNumber.svelte`)

CSS `@keyframes damageArc` — 1000ms, `ease-out forwards`:
- `0%`: scale `1.2`, centered
- `30%`: translate `(±30px, -20px)`, scale `1.0`
- `100%`: translate `(±60px, 40px)`, scale `0.8`, `opacity: 0`

Arc direction (`--arc-dir`) is randomized ±1 per instance. X jitter of ±10px prevents stacking.

Font size scales with damage value: `24–36px` for normal, `32–44px` for critical. Status/buff labels use fixed `18px`. All sizes use `calc(Npx * var(--layout-scale, 1))`.

Critical hits add a `critRipple` `@keyframes` on `::after`: radial gradient expanding `scale(0 → 3)`, `400ms ease-out`.

Type color map: damage `#FF4444`, block `#4499FF`, heal `#44FF88`, poison `#AA44FF`, burn `#FF8833`, gold `#FFD700`, critical `#E74C3C`.

Auto-removes after 1000ms via `setTimeout(() => onComplete?.(), 1000)`.

`prefers-reduced-motion`: animation disabled, number displayed at `-20px` offset, no ripple.

---

## Screen Shake (`src/game/systems/ScreenShakeSystem.ts`)

Phaser-layer shake via camera `scrollX/Y` offset (not `camera.shake()`). Three tiers:

| Tier | Amplitude | Duration | Frequency |
|---|---|---|---|
| `'micro'` | 2px | 100ms | 40Hz |
| `'medium'` | 4px | 200ms | 28Hz |
| `'heavy'` | 8px | 400ms | 18Hz |

`trigger(tier)` — higher-priority tier replaces lower; equal/higher ignored. Randomizes noise seed per shake.

Uses `smoothNoise1D(x)` (smoothstep-interpolated pseudo-random lattice) for organic oscillation. Linear fade-out envelope in the last 30% of duration.

Camera pinned to `(0,0)` every frame before applying shake offset — prevents drift accumulation when shake and zoom tweens overlap.

`setIntensity(0.0–1.0)` — user-facing shake intensity preference. Respects `prefers-reduced-motion`.

Call `update(deltaMs)` each frame from the scene's `update()`. Call `stop()` to cancel immediately.

---

## Pet Animation System

**Source files:**
- `src/data/petAnimations.ts` — Spritesheet configs per species and behavior
- `src/data/petWaypoints.ts` — Hub waypoint definitions and weighted selection
- `src/ui/effects/petBehavior.ts` — Pure-function state machine
- `src/ui/components/AnimatedPet.svelte` — Canvas renderer and hub integration
- Tests: `src/ui/effects/petBehavior.test.ts` (27 tests)

### Architecture

The pet system separates concerns into three layers:

1. **Animation data** (`petAnimations.ts`) — Spritesheet frame counts, frame durations, and loop flags per species/behavior. No runtime logic.
2. **Spatial data** (`petWaypoints.ts`) — Named positions on the hub screen expressed as percentage of the hub-center container (scales automatically with `--layout-scale`). Includes attraction weights for biased destination selection.
3. **State machine** (`petBehavior.ts`) — Tick-driven pure functions. Consumed by `AnimatedPet.svelte`.

### Types

```ts
type PetSpecies = 'cat' | 'owl' | 'fox' | 'dragon_whelp'
type PetBehavior = 'idle' | 'walk' | 'sit' | 'lick' | 'sleep' | 'react'
```

Only `'cat'` has art configs currently. `getPetConfig(species)` falls back to cat for undefined species.

### Cat Display Size

The cat renders at **96×96px** (CSS display size, before `--layout-scale`). The spritesheet frames are 64×64px native; CSS upscaling is applied via `.pet-canvas { width: calc(96px * var(--layout-scale, 1)); height: calc(96px * var(--layout-scale, 1)); }` with `image-rendering: pixelated` to keep pixels crisp.

`displayWidth` / `displayHeight` on `PetSpeciesConfig` record the pre-scale display size. Update both the config and the `.pet-canvas` CSS if changing this.

### Cat Frame Durations

| Behavior | frameDuration | loop | Notes |
|---|---|---|---|
| `idle` | 600ms | true | Slow, relaxed look-around loop |
| `walk` | 180ms | true | Walking patrol |
| `sit` | 800ms | true | Slow tail flick loop |
| `lick` | 400ms | true | Grooming pace loop |
| `sleep` | 1200ms | **false** | Tuck-in plays once, holds last frame for the nap duration |
| `react` | 200ms | false | One-shot startled; returns to previous behavior |

**Sleep loop note:** `loop: false` on sleep prevents the tuck-in sequence from replaying. The behavior state machine holds the `sleep` state for 15–30s, so the final sleeping frame persists naturally.

### Behaviors

| Behavior | Duration | Notes |
|---|---|---|
| `idle` | 5–15 s | Default resting state |
| `walk` | Distance-driven | ~1.8%/sec in hub-container % coords |
| `sit` | 8–20 s | Near campfire: 1.5× weight |
| `lick` | 4–8 s | Self-grooming |
| `sleep` | 15–30 s | Near campfire: 1.5× weight |
| `react` | 1 s fixed | Triggered by click; returns to previous behavior |

Walk speed constant: `WALK_SPEED_PER_MS = 0.0018` (relaxed stroll, was 0.0025).

### Waypoints

6 named ground-level waypoints forming a walkable path along the bottom of the hub campfire scene (Y 74–78%, X 18–80%). All waypoints are clear of camp UI elements (doors, library, shop, tent).

| Waypoint | X% | Y% | Weight | Notes |
|---|---|---|---|---|
| `campfire` | 45 | 75 | 2.0 | `nearCampfire: true` — boosts sleep/sit |
| `near_character` | 58 | 74 | 1.2 | Near the player character |
| `ground_left` | 18 | 78 | 0.8 | Left edge of floor |
| `ground_right` | 80 | 78 | 0.8 | Right edge of floor |
| `ground_center_left` | 32 | 76 | 0.6 | Left-center floor |
| `ground_center_right` | 62 | 76 | 0.6 | Right-center floor |

`pickNextWaypoint(currentId, recentlyVisited)` excludes current, penalizes last 3 visited (0.3× weight), uses weighted random.

### State Machine API

All functions are pure (no side effects):

| Function | Purpose |
|---|---|
| `createInitialPetState(startWaypoint?)` | Fresh state at given waypoint (default: campfire) |
| `tickPet(state, deltaMs, animConfig)` | Main update — advance frames, walk, transition |
| `selectNextBehavior(current, nearCampfire, previous?)` | Weighted next behavior; react returns previous |
| `triggerReact(state)` | Interrupt with react animation, saves previous behavior |
| `startWalk(state, waypointId, targetPos)` | Begin walking to a specific waypoint |

### Integration Pattern

```ts
// In AnimatedPet.svelte
import { createInitialPetState, tickPet, triggerReact } from '../effects/petBehavior'
import { getPetConfig } from '../../data/petAnimations'

let petState = $state(createInitialPetState())
const config = getPetConfig('cat')

// Called from requestAnimationFrame or hubAnimationLoop
function onFrame(deltaMs: number) {
  const animConfig = config.animations[petState.behavior]
  petState = tickPet(petState, deltaMs, animConfig)
}

// On click/tap
function onClick() {
  petState = triggerReact(petState)
}
```

### Campfire Bias

When `nearCampfire` is true (only the `campfire` waypoint), the transition table boosts `sleep` and `sit` weights by 1.5×. Combined sleep+sit selection rate from `idle` rises from ~40% to ~50% near campfire.
