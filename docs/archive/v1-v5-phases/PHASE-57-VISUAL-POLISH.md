# Phase 57: Visual & Feel Polish Pass

**Status**: Not Started
**Depends On**: Phase 29 (Character Animation System — miner sprite sheet, GearOverlaySystem), Phase 7 (Visual Engine Overhaul — autotiling, particles), Phase 34 (Pixel Art Per Fact — fact images, greyscale mastery progression), Phase 15 (GAIA Personality 2.0 — GAIA avatar, dialogue)
**Estimated Complexity**: Medium — all changes are visual/animation; no new game mechanics; some changes are purely CSS, others require Phaser tween/graphics work
**Design Decisions**: DD-029 (atmosphere), Q-D4 (barely made it mechanic), DD-V2-105 (GAIA micro-expressions)

---

## 1. Overview

Phase 57 is a pure polish pass. Each of the five sub-phases targets a specific visual or feel dimension identified during playtesting as lacking the charm and life the game design promised. None of these changes affect game mechanics — they are entirely presentational, but they dramatically affect player perception of quality and investment.

### What Exists Already

| File | Status |
|---|---|
| `src/game/scenes/MineScene.ts` | Miner sprite rendering, block mining, hazard handling |
| `src/game/systems/GearOverlaySystem.ts` | Pickaxe tier icon overlay, relic glow, companion badge — exists |
| `src/game/systems/AnimationSystem.ts` | Miner animation state machine — exists |
| `src/ui/components/StudySession.svelte` | Study session UI — exists |
| `src/data/types.ts` | `PlayerSave`, `ReviewState` |
| `src/ui/utils/masteryColor.ts` | Mastery-to-color mapping — exists |
| `src/ui/components/FactArtwork.svelte` | Fact image display (if exists) — audit |
| `src/game/managers/GaiaManager.ts` | GAIA dialogue, mood, idle timers |
| `src/data/gaiaAvatar.ts` | GAIA avatar sprite key definitions — exists |
| `src/data/balance.ts` | Gameplay constants |

---

## 2. Sub-phases

---

### 57.1 — Miner Progressive Visual State

**Goal**: The miner sprite gets progressively dirtier as blocks are mined. Implement as an overlay tint system in `GearOverlaySystem.ts`. Additional states: backpack bulge at 80%+ fill, in-run pickaxe upgrade indicator.

#### 57.1.1 — Dirt tint in `GearOverlaySystem.ts`

Add a dirt overlay tint tracker to `GearOverlaySystem`:

```typescript
// Dirt tint thresholds (blocks mined in this layer)
const DIRT_STAGES = [
  { blocksMin: 0,   blocksMax: 19,  alpha: 0 },       // Clean
  { blocksMin: 20,  blocksMax: 49,  alpha: 0.08 },     // Light dirt — barely visible
  { blocksMin: 50,  blocksMax: 99,  alpha: 0.18 },     // Noticeable dirt
  { blocksMin: 100, blocksMax: Infinity, alpha: 0.28 }, // Noticeably scuffed
]
const DIRT_TINT_COLOR = 0x5a3e1b // Brown-earth color

function updateDirtTint(scene: MineScene, blocksMined: number): void {
  const stage = DIRT_STAGES.find(s => blocksMined >= s.blocksMin && blocksMined <= s.blocksMax)
  if (!stage) return
  // Apply as a colored rectangle overlay on the miner sprite at the given alpha
  dirtOverlay.setAlpha(stage.alpha)
  dirtOverlay.setFillStyle(DIRT_TINT_COLOR)
}
```

The dirt overlay is a Phaser `Graphics` rectangle drawn on top of the miner sprite bounds, using the miner's display position and size. It resets to 0 alpha when the player surfaces.

Constant in `balance.ts`:

```typescript
DIRT_TINT_THRESHOLD_1: 20,   // blocks mined before Stage 1 dirt
DIRT_TINT_THRESHOLD_2: 50,   // Stage 2
DIRT_TINT_THRESHOLD_3: 100,  // Stage 3
```

#### 57.1.2 — Backpack bulge indicator in `GearOverlaySystem.ts`

Track `backpackFillPercent` (filled slots / total slots). When `backpackFillPercent >= 0.80`:

- Render a small backpack icon in the bottom-right quadrant of the miner sprite area (above the miner, but small, non-intrusive).
- Fill the icon proportionally: 80% → icon 80% filled with a color gradient (green at low fill → orange at 80% → red at 100%).
- At 100%: add a very subtle idle bob animation to the backpack icon to draw attention.

This is a small overlay icon, not a modification to the miner sprite itself.

#### 57.1.3 — In-run pickaxe upgrade indicator in `GearOverlaySystem.ts`

The existing `GearOverlaySystem` already renders a pickaxe tier icon (`t0`–`t4`). Verify it updates when the player picks up an `UpgradeCrate` during a dive. If not:

- Listen for `pickaxe-upgraded` game event in `GearOverlaySystem`.
- On the event: update the pickaxe tier icon to the new tier, and play a brief visual effect (scale-up tween: 1.0 → 1.4 → 1.0 over 400ms, then a sparkle particle burst using `ParticleSystem` if available).

**Acceptance Criteria**:
- Mining 0–19 blocks: miner looks clean.
- Mining 20–49 blocks: very subtle brown tint (visible but not distracting).
- Mining 50–99 blocks: clearly dirty.
- Mining 100+ blocks: noticeably scuffed.
- Surfacing: dirt tint resets to zero immediately.
- At 80%+ backpack fill: small backpack icon appears near the miner with color feedback.
- Picking up an UpgradeCrate: pickaxe tier icon updates with a celebratory pop animation.

---

### 57.2 — Study Session Atmospheric Scene

**Goal**: The study session (`StudySession.svelte`) should visually transport the player to a calm dome interior. The miner character sits in a comfortable chair. The Knowledge Tree is partially visible in the background. Facts answered correctly cause a leaf shimmer.

#### 57.2.1 — Background scene in `StudySession.svelte`

Replace any plain background with a CSS-composed scene:

```svelte
<div class="study-scene">
  <!-- Background: dome interior (gradient sky + curved dome outline) -->
  <div class="dome-bg"></div>
  <!-- Knowledge Tree silhouette (partial, right side) -->
  <div class="tree-silhouette" class:shimmer={lastAnswerCorrect}></div>
  <!-- Miner character in chair (seated sprite or CSS illustration) -->
  <div class="miner-seated">
    <img src="/assets/sprites/miner-seated.png" alt="Miner resting" />
  </div>
  <!-- Quiz card floats in the center -->
  <div class="quiz-card">
    <slot />
  </div>
</div>
```

CSS for the dome background:

```css
.dome-bg {
  background: radial-gradient(ellipse at 50% 110%, #1a2a4a 0%, #0a1525 70%);
  position: absolute; inset: 0;
}
.tree-silhouette {
  position: absolute; right: 0; bottom: 0;
  width: 35%; height: 80%;
  background: url('/assets/sprites/tree-silhouette.png') no-repeat bottom right;
  background-size: contain;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}
.tree-silhouette.shimmer {
  animation: leaf-shimmer 0.8s ease-out;
}
@keyframes leaf-shimmer {
  0%   { opacity: 0.3; filter: brightness(1); }
  30%  { opacity: 0.7; filter: brightness(1.8) hue-rotate(30deg); }
  100% { opacity: 0.3; filter: brightness(1); }
}
```

#### 57.2.2 — Miner seated sprite placeholder

Create a simple placeholder sprite at `src/assets/sprites/miner-seated.png`:
- 32×48px seated miner figure (same proportions as standing, but in a chair pose).
- Pure placeholder: can be a plain colored silhouette. Mark with a `// TODO: Replace with ComfyUI-generated sprite` comment in the asset manifest.
- Add to `src/data/spriteKeys.ts` as `MINER_SEATED: 'miner-seated'`.

#### 57.2.3 — Tree shimmer on correct answer

In `StudySession.svelte`, track the last quiz answer result. When `lastAnswerCorrect` flips to `true`:

```typescript
function onCorrectAnswer(): void {
  lastAnswerCorrect = true
  setTimeout(() => { lastAnswerCorrect = false }, 800)
}
```

The `shimmer` CSS class on `.tree-silhouette` triggers the 0.8s animation.

**Acceptance Criteria**:
- Study session shows a dark dome interior background (not a plain white/grey background).
- A tree silhouette is visible on the right side at low opacity.
- A miner seated sprite appears in the lower-left area.
- Answering a quiz question correctly triggers a brief golden shimmer on the tree silhouette.
- The study session feels visually calm and distinct from the action-oriented mine.

---

### 57.3 — "Barely Made It" Mechanic (Resolve Q-D4)

**Goal**: If the player's oxygen reaches zero within 5 blocks of the Layer 0 exit shaft (vertical distance to the exit ladder), trigger a "barely made it" cinematic instead of the Sacrifice system. Player surfaces with full loot; no sacrifice required.

#### 57.3.1 — Balance constant in `src/data/balance.ts`

```typescript
BARELY_MADE_IT_THRESHOLD: 5, // Blocks vertical distance to exit ladder that triggers "barely made it"
```

#### 57.3.2 — Detection logic in `GameManager.ts` / `MineScene.ts`

In `handleOxygenDepleted()` (in `GameManager.ts`, modified in Phase 51), before triggering the Sacrifice system, check:

```typescript
function isBarelMadeIt(scene: MineScene): boolean {
  const exitLadderY = findExitLadderWorldY(scene) // Find the ExitLadder block Y coordinate
  const minerY = scene.minerWorldY
  const blockSize = BLOCK_SIZE_PX // e.g., 16 or 32
  const distanceBlocks = Math.abs(minerY - exitLadderY) / blockSize
  return distanceBlocks <= BARELY_MADE_IT_THRESHOLD
}
```

If `isBarelyMadeIt()` returns `true`:
1. Do NOT trigger `SacrificeOverlay`.
2. Play the "barely made it" sequence (see 57.3.3).
3. Surface the player with full loot.

#### 57.3.3 — "Barely made it" sequence

Implement in `MineScene.ts`:

```typescript
function playBarelyMadeItSequence(scene: MineScene): void {
  // 1. Screen edge red border flash
  const redBorder = scene.add.graphics()
  redBorder.lineStyle(8, 0xff0000, 0.9)
  redBorder.strokeRect(0, 0, scene.cameras.main.width, scene.cameras.main.height)
  redBorder.setScrollFactor(0)
  redBorder.setDepth(500)

  scene.tweens.add({
    targets: redBorder,
    alpha: 0,
    duration: 1200,
    ease: 'Cubic.Out',
    onComplete: () => redBorder.destroy(),
  })

  // 2. Screen shake — brief, urgent
  scene.cameras.main.shake(300, 0.008)

  // 3. GAIA "phew" line via GaiaManager
  EventBus.emit('gaia:toast', { key: 'barely_made_it' })

  // 4. Trigger normal surface ascent (with full loot)
  setTimeout(() => EventBus.emit('surface-ascent', { fullLoot: true }), 800)
}
```

#### 57.3.4 — GAIA "Phew!" dialogue line

Add to `src/data/gaiaDialogue.ts` (or wherever toast strings are defined):

```typescript
barely_made_it: [
  'Phew! I thought I was about to lose my favorite miner.',
  'That was close. Too close. I need a moment.',
  'You cut that extremely fine. Please don\'t do that to me again.',
  'Barely! You are going to give GAIA an anxiety malfunction.',
]
```

Pick randomly from the array each time.

**Acceptance Criteria**:
- Player whose oxygen hits zero while within 5 blocks of the exit ladder: red border flash + screen shake + GAIA "phew" line.
- No `SacrificeOverlay` appears.
- Player surfaces with full backpack contents.
- Player whose oxygen hits zero at 6+ blocks from exit: normal `SacrificeOverlay` path (Phase 51).
- `BARELY_MADE_IT_THRESHOLD` is tunable in `balance.ts`.

---

### 57.4 — Greyscale-to-Color Fact Image Rendering (Verify and Wire)

**Goal**: Ensure the greyscale-to-color mastery progression is fully wired into the fact card display. `masteryColor.ts` has the logic — verify it is applied correctly in `FactArtwork.svelte` (or equivalent) and that the three mastery states produce visually distinct rendering.

#### 57.4.1 — Audit `FactArtwork.svelte` / `FactReveal.svelte`

Read `src/ui/components/FactArtwork.svelte` and `src/ui/components/FactReveal.svelte`. Check:
- Is there a CSS filter or canvas operation that applies greyscale based on mastery level?
- Are the three states (New/Learning → greyscale, Familiar → partial color, Known/Mastered → full color) producing visually distinct results?
- Is there a smooth CSS transition when mastery level upgrades?

If these are absent or broken, implement them.

#### 57.4.2 — Mastery-based CSS filter in `FactArtwork.svelte`

The fact image rendering should use `masteryColor.ts` to compute a CSS filter:

```typescript
import { getMasteryLevel } from '../utils/masteryColor'

function getImageFilter(reviewState: ReviewState | undefined): string {
  if (!reviewState) return 'grayscale(1)' // New fact: fully greyscale
  const mastery = getMasteryLevel(reviewState)
  switch (mastery) {
    case 'new':      return 'grayscale(1)'
    case 'familiar': return 'grayscale(0.6) saturate(0.5)'  // Partially colorized
    case 'known':    return 'grayscale(0.1) saturate(1.2)'  // Nearly full color
    case 'mastered': return 'grayscale(0) saturate(1.5)'    // Full color, slightly vivid
  }
}
```

Apply to the `<img>` element:

```svelte
<img
  src={fact.pixelArtPath ?? '/assets/sprites/facts/placeholder.png'}
  alt={fact.statement}
  style="filter: {getImageFilter(reviewState)}; transition: filter 0.5s ease;"
/>
```

#### 57.4.3 — Mastery transition animation on level-up

When a fact transitions from one mastery level to the next (detected via `ReviewState.repetitions` change), trigger a visual "unlock" effect on the fact card:

- The image briefly glows (white overlay at 40% alpha, fading over 1 second).
- Text label: "FAMILIAR!" / "KNOWN!" / "MASTERED!" appears as a floating toast above the card for 2 seconds.
- This should happen in `StudySession.svelte` or wherever quiz results are shown after a review.

**Acceptance Criteria**:
- New facts display as fully greyscale in all fact card contexts.
- Facts at Familiar mastery display with partial color (60% grey, 50% saturation).
- Facts at Known mastery display with near-full color.
- Facts at Mastered mastery display with full vivid color.
- The CSS filter transition (0.5s ease) is visible when reviewing a fact that crosses a mastery boundary.
- Mastery level-up toast ("FAMILIAR!", "KNOWN!", "MASTERED!") appears after the quiz result.

---

### 57.5 — GAIA Avatar Micro-Expressions

**Goal**: GAIA's pixel art avatar should have subtle idle animations and micro-expressions that react to key moments. Use the existing `gaiaAvatar.ts` definitions and `GaiaManager.ts` to drive expression changes.

#### 57.5.1 — Audit `gaiaAvatar.ts` animation definitions

Read `src/data/gaiaAvatar.ts`. Identify which animation states exist and which are missing. Target states:

| State | Trigger | Animation |
|---|---|---|
| `idle` | Default | Subtle 2-frame breathing loop |
| `excited` | Artifact ingestion | 3-frame bounce + eye-widen |
| `proud` | Fact mastered | Upright posture + sparkle |
| `concerned` | Player wrong answer (wrong 3+) | Slight droop + brow furrow |
| `celebrate` | Branch completion | 4-frame cheer |

Add any missing state definitions to `gaiaAvatar.ts`.

#### 57.5.2 — `GaiaAvatar.svelte` animation component

Audit whether `src/ui/components/GaiaAvatar.svelte` exists (check the file list above — it may not). If absent, create it:

```svelte
<script lang="ts">
  import { gaiaCurrentExpression } from '../../data/gaiaAvatar'

  let { expression = 'idle' }: { expression: string } = $props()

  // Map expression to sprite animation frame
  const FRAME_MAP: Record<string, number[]> = {
    idle:      [0, 1],
    excited:   [2, 3, 4],
    proud:     [5, 6, 7, 6],
    concerned: [8, 9],
    celebrate: [10, 11, 12, 13],
  }

  let currentFrame = $state(0)
  let frameIndex = $state(0)

  $effect(() => {
    const frames = FRAME_MAP[expression] ?? FRAME_MAP.idle
    const interval = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length
      currentFrame = frames[frameIndex]
    }, expression === 'idle' ? 1200 : 150)
    return () => clearInterval(interval)
  })

  const spriteSheet = '/assets/sprites-hires/gaia/gaia-expressions.png'
  const FRAME_W = 64; const FRAME_H = 64
</script>

<div
  class="gaia-avatar"
  style="
    background: url('{spriteSheet}') no-repeat;
    background-position: -{currentFrame * FRAME_W}px 0;
    width: {FRAME_W}px; height: {FRAME_H}px;
  "
  aria-label="GAIA avatar"
></div>
```

#### 57.5.3 — Expression trigger points in `GaiaManager.ts`

Add expression change calls in `GaiaManager.ts`:

```typescript
// When artifact is ingested:
setGaiaExpression('excited', 2000) // Revert to idle after 2 seconds

// When a fact is mastered:
setGaiaExpression('proud', 3000)

// When player gets same fact wrong 3+ times:
setGaiaExpression('concerned', 2500)

// When a branch completes:
setGaiaExpression('celebrate', 4000)

function setGaiaExpression(expression: string, durationMs: number): void {
  gaiaExpression.set(expression)
  setTimeout(() => gaiaExpression.set('idle'), durationMs)
}
```

`gaiaExpression` is a writable Svelte store in `GaiaManager.ts` or `gameState.ts`.

#### 57.5.4 — Placeholder sprite sheet

Create a placeholder at `src/assets/sprites-hires/gaia/gaia-expressions.png`:
- 14 frames × 64px = 896×64px PNG (or multiple rows — verify the sheet layout works with the CSS approach).
- Pure placeholder colored rectangles representing each expression (different background colors per state for visual debugging).
- Mark with a `TODO: Replace with ComfyUI sprite sheet` comment in `gaiaAvatar.ts`.

**Acceptance Criteria**:
- GAIA avatar shows a slow 2-frame idle breathing animation by default.
- When an artifact is ingested, GAIA plays a 3-frame excited bounce animation then returns to idle.
- When a fact is mastered, GAIA plays a proud posture animation.
- When a player gets the same fact wrong 3+ times, GAIA shows a concerned expression.
- When a branch completes, GAIA plays a 4-frame celebrate animation.
- Expression transitions are smooth (no visual pop/flash).

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] Mine 25 blocks: miner sprite has a visible brown tint overlay.
- [ ] Mine 55 blocks: tint is more visible.
- [ ] Surface: tint resets to zero on the next dive.
- [ ] Fill backpack to 80%+: small backpack icon appears near miner sprite.
- [ ] Open study session: dark dome background + tree silhouette visible.
- [ ] Answer quiz question correctly: tree silhouette shimmers with golden animation.
- [ ] Take oxygen to zero within 5 blocks of exit ladder: red border flash, GAIA "phew" line, full loot preserved.
- [ ] Take oxygen to zero more than 5 blocks from exit: SacrificeOverlay appears (Phase 51 path).
- [ ] Open FactArtwork for a New fact: fully greyscale.
- [ ] Same fact at Familiar mastery: partially colorized.
- [ ] Same fact at Mastered: full vivid color.
- [ ] Ingest an artifact: GAIA avatar plays excited animation.
- [ ] Master a fact: GAIA avatar plays proud animation.
- [ ] Playwright screenshot confirms study session background and miner dirt overlay visibility.

---

## 4. Files Affected

### Modified
- `src/game/scenes/MineScene.ts` — barely-made-it detection; dirt tint reset on surface
- `src/game/systems/GearOverlaySystem.ts` — dirt tint overlay; backpack fill indicator; pickaxe upgrade pop animation
- `src/ui/components/StudySession.svelte` — dome background scene; tree silhouette shimmer; miner seated sprite
- `src/ui/components/FactArtwork.svelte` (or `FactReveal.svelte`) — greyscale CSS filter wiring; mastery transition toast
- `src/game/managers/GaiaManager.ts` — expression trigger points; `setGaiaExpression()` function; `gaiaExpression` store
- `src/data/gaiaAvatar.ts` — add missing expression state definitions
- `src/data/gaiaDialogue.ts` — `barely_made_it` toast lines
- `src/data/balance.ts` — `DIRT_TINT_THRESHOLD_*`, `BARELY_MADE_IT_THRESHOLD`
- `src/data/spriteKeys.ts` — `MINER_SEATED` key

### New
- `src/ui/components/GaiaAvatar.svelte` (if not already present)
- `src/assets/sprites-hires/gaia/gaia-expressions.png` (placeholder)
- `src/assets/sprites/miner-seated.png` (placeholder)
