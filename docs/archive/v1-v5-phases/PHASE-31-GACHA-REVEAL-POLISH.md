# Phase 31: Gacha & Reveal Polish

**Status**: Not Started
**Dependencies**: Phase 7 (Visual Engine), Phase 8 (Mine Gameplay), Phase 17 (Addictiveness Pass — GachaReveal.svelte, NearMissBanner.svelte, CelebrationManager, BALANCE.GACHA_TIERS baseline), Phase 30 (Mining Juice — ImpactSystem, ParticleSystem, CameraSystem)
**Estimated Complexity**: High — 6 sub-phases, Phaser 3 in-game effects + Svelte overlay work + BALANCE additions

---

## Overview

Phase 31 transforms the game's reveal and celebration pipeline from "functional prototype" into a polished, emotionally resonant sequence. Phase 17 established the foundational architecture — `GachaReveal.svelte`, `NearMissBanner.svelte`, `BALANCE.GACHA_TIERS`, and `CelebrationManager`. This phase builds on that foundation with:

- **Rarity-tiered reveal timing**: Per-rarity hold durations, suspense-building anticipation escalation, and audio/visual cue matching.
- **Artifact reveal sequences**: Camera zoom into the artifact node, GAIA commentary tied to artifact rarity, and a collection pull-in animation that deposits the artifact into the HUD inventory.
- **Block rarity previews**: High-rarity artifact nodes (rare+) emit a subtle ambient shimmer before mining begins, giving players environmental clues that reward exploration.
- **Celebration particle effects**: Per-rarity Phaser 3 particle systems (confetti, sparkle rings, glow halos) that play over the GachaReveal overlay and in-world at the mine tile.
- **Layer descent animation**: A choreographed camera pan + depth counter + biome transition sequence when the player steps into a DescentShaft, replacing the current instant-cut.
- **Near-miss and streak feedback**: Visual upgrades to the existing `NearMissBanner` (animated ring, near-miss hit counter) plus streak-multiplier visual feedback on-screen during mining.

### Design Decision References

- **DD-V2-015**: Gacha-style reveals — each artifact discovery triggers a timed reveal sequence; player must feel something before seeing the item.
- **DD-V2-016**: Rarity tiers — common through mythic; each tier has meaningfully distinct timing and visual intensity.
- **DD-V2-131**: No premium randomization — the reveal system must never appear to be monetized gacha; all reveals come from earned gameplay (no pay-to-pull); all drop rates are transparently displayed (see `src/game/systems/artifactDrop.ts`).
- **DD-V2-012**: Block idle animations — crystals glint, artifacts glow, gas swirls, lava pulses (2–4 frames). High-rarity preview extends this with a directional shimmer.
- **DD-V2-251**: Block break sequence — 50 ms freeze-frame, radial burst, 4-quadrant shatter, loot physics (from Phase 30). Phase 31 stacks its artifact-specific effects on top of those baseline effects.

### Current State of Relevant Systems

| File | Lines | Status |
|---|---|---|
| `src/ui/components/GachaReveal.svelte` | 214 | Working. 4-phase animation (anticipation/suspense/reveal/payoff). Particles are CSS-only, directionally incorrect. No audio integration. No rarity-specific background patterns. |
| `src/ui/components/NearMissBanner.svelte` | 67 | Working. Simple pill banner; fades out after 2.5 s. No animation beyond fade. Needs ring pulse and streak-count variant. |
| `src/ui/components/MasteryToast.svelte` | 264 | Working. Tier-based celebration component. No changes needed in Phase 31. |
| `src/game/managers/CelebrationManager.ts` | 113 | Working. Queue-based dispatch. No changes needed in Phase 31 (artifact reveals use a separate flow). |
| `src/game/systems/BlockAnimSystem.ts` | 104 | Working. ArtifactNode uses 4-frame cycle. Phase 31 adds a shimmer overlay layer at depth 201. |
| `src/game/systems/ParticleSystem.ts` | 515 | Solid. Phase 31 adds `emitArtifactReveal()` and `emitRarityBurst()` methods plus a new `RarityGlowSystem` class. |
| `src/game/systems/CameraSystem.ts` | 107 | Working. `setupCamera()`, `PinchZoomController`. Phase 31 adds a `CameraSequencer` utility for scripted camera moves (zoom-to-point, pan, return). |
| `src/game/scenes/MineScene.ts` | 3 043 | Phase 31 hooks into `handleInteractArtifact()` and the descent shaft trigger to fire artifact reveal and layer descent sequences. |
| `src/data/balance.ts` | 459 | `BALANCE.GACHA_TIERS` exists with 6 tiers. Phase 31 adds `REVEAL_TIMING`, `BLOCK_SHIMMER_TIERS`, `DESCENT_ANIM`, and `STREAK_VISUAL` constants. |

### What This Phase Does NOT Change

- The quiz or SM-2 learning systems
- Drop rates in `artifactDrop.ts` (those are balance decisions)
- `CelebrationManager` or `MasteryToast` (mastery celebration flow is separate from artifact reveal)
- The Phaser `DomeScene`
- Server-side code
- Any save/load or cloud sync logic
- Audio asset files (all sounds use Web Audio API synthesis from Phase 17's `audioService.ts`)

---

## Sub-Phases

---

### 31.1 — Rarity-Tiered Reveal Timing System

**Goal**: Extend `BALANCE.GACHA_TIERS` with precise per-phase timing data and upgrade `GachaReveal.svelte` to use those timings. Each rarity tier must feel distinctly paced — common reveals snap in, legendary reveals breathe and build.

#### 31.1.1 — Extend BALANCE.GACHA_TIERS

**File**: `src/data/balance.ts`

Add the following `REVEAL_TIMING` constant directly after the closing brace of `GACHA_TIERS`:

```typescript
// === REVEAL TIMING (Phase 31.1) ===
// All values in milliseconds.
// anticipationMs : time the '?' box is shown before suspense begins
// suspenseMs     : pulse duration before reveal flash
// flashMs        : hold on the bright reveal frame (screenFlash tiers only)
// payoffMs       : artifact + fact text shown before Collect button appears
// collectMs      : time Collect button is visible before auto-advance
export const REVEAL_TIMING: Record<string, {
  anticipationMs: number
  suspenseMs: number
  flashMs: number
  payoffMs: number
  collectMs: number
  suspensePulseHz: number   // Pulse frequency during suspense (higher = faster pulse)
  particleWaveCount: number // How many burst waves fire in sequence
}> = {
  common:    { anticipationMs: 300,  suspenseMs: 400,  flashMs: 0,    payoffMs: 400,   collectMs: 1500, suspensePulseHz: 1.0, particleWaveCount: 1 },
  uncommon:  { anticipationMs: 400,  suspenseMs: 600,  flashMs: 0,    payoffMs: 600,   collectMs: 2000, suspensePulseHz: 1.2, particleWaveCount: 1 },
  rare:      { anticipationMs: 600,  suspenseMs: 900,  flashMs: 80,   payoffMs: 900,   collectMs: 2500, suspensePulseHz: 1.5, particleWaveCount: 2 },
  epic:      { anticipationMs: 900,  suspenseMs: 1400, flashMs: 120,  payoffMs: 1400,  collectMs: 3000, suspensePulseHz: 2.0, particleWaveCount: 3 },
  legendary: { anticipationMs: 1400, suspenseMs: 2200, flashMs: 180,  payoffMs: 2200,  collectMs: 4000, suspensePulseHz: 2.5, particleWaveCount: 4 },
  mythic:    { anticipationMs: 2000, suspenseMs: 3500, flashMs: 250,  payoffMs: 3500,  collectMs: 5000, suspensePulseHz: 3.0, particleWaveCount: 6 },
} as const
```

#### 31.1.2 — Upgrade GachaReveal.svelte

**File**: `src/ui/components/GachaReveal.svelte`

Replace the hard-coded `600`/`800` timer constants with values pulled from `REVEAL_TIMING`. Add a `flashMs` hold phase between `suspense` and `reveal`. Add `particleWaveCount` to stagger particle emission in multiple named waves.

The animation state machine becomes:

```
anticipation  →  suspense  →  flash (if flashMs > 0)  →  reveal  →  payoff  →  done
```

The `<script>` block should:

1. Import `REVEAL_TIMING` from `../../data/balance`.
2. Derive `const timing = REVEAL_TIMING[rarity] ?? REVEAL_TIMING.common`.
3. Build the timeout chain using `timing.anticipationMs`, `timing.suspenseMs`, `timing.flashMs`, `timing.payoffMs`, `timing.collectMs`.
4. Generate `particleWaveCount` particle bursts staggered by `200 ms` each.
5. Drive the mystery-box pulse speed via `--pulse-hz: {timing.suspensePulseHz}` as a CSS custom property.

The `<style>` block change: Replace the `pulseMystery` animation fixed `0.8s` with `calc(1s / var(--pulse-hz, 1))`:

```css
.mystery-box.pulse {
  animation: pulseMystery calc(1s / var(--pulse-hz, 1)) ease-in-out infinite;
}
```

Add a `phase-flash` class for the screen-brightness flash hold when `flashMs > 0`:

```css
.phase-flash {
  filter: brightness(2.5);
  transition: filter 80ms ease-out;
}
```

Add rarity-specific background pattern textures via CSS radial-gradient overlays on `.gacha-overlay`. These must NOT use `innerHTML` or dynamic HTML injection — they are CSS `background-image` values bound through the `style:` attribute:

| Rarity | Background extra |
|---|---|
| common | None (solid bgColor) |
| uncommon | `radial-gradient(ellipse at 50% 120%, rgba(78,201,160,0.12) 0%, transparent 60%)` |
| rare | `radial-gradient(ellipse at 50% 100%, rgba(74,158,255,0.18) 0%, transparent 65%)` |
| epic | `radial-gradient(ellipse at 50% 80%, rgba(204,68,255,0.20) 0%, transparent 70%)` |
| legendary | `radial-gradient(ellipse at 50% 60%, rgba(255,215,0,0.25) 0%, transparent 75%)` |
| mythic | `radial-gradient(ellipse at 50% 50%, rgba(255,68,170,0.30) 0%, transparent 80%)` |

These are driven through a `$derived` variable and applied to the overlay via `style:background-image`.

#### Acceptance Criteria — 31.1

- [ ] Common reveal: '?' box appears 300 ms, suspense 400 ms, instant cut to reveal, payoff 400 ms.
- [ ] Legendary reveal: '?' box appears 1400 ms, suspense pulse visibly speeds up (2.5 Hz), 180 ms flash hold, payoff 2200 ms, 4 particle waves.
- [ ] Mythic reveal: Total pre-reveal time is at least 5.5 s; 6 particle waves; pulse is visibly faster than legendary.
- [ ] `GachaReveal.svelte` passes `npm run typecheck` with no errors.
- [ ] `pulseMystery` animation speed is driven by `--pulse-hz` CSS variable, not hard-coded.
- [ ] Background radial gradient appears on rare+ reveals and matches rarity glow color.

---

### 31.2 — Artifact Reveal Sequences

**Goal**: When a player breaks an `ArtifactNode`, trigger a choreographed three-act sequence in the Phaser `MineScene` before handing off to `GachaReveal.svelte`: (1) camera zooms in on the mined tile, (2) GAIA delivers a rarity-appropriate line, (3) the artifact sprite arcs from the tile to the HUD and the gacha overlay opens. This sequence replaces the current instant inventory-add + overlay-open flow.

#### 31.2.1 — CameraSequencer Utility

**File**: `src/game/systems/CameraSequencer.ts` (new file)

```typescript
import Phaser from 'phaser'

export interface ZoomToPointOptions {
  /** World X to zoom into */
  worldX: number
  /** World Y to zoom into */
  worldY: number
  /** Target zoom level (1.0 = default zoom, >1 = magnified) */
  targetZoomMultiplier: number
  /** Duration of zoom-in tween in ms */
  zoomInMs: number
  /** How long to hold the zoomed view in ms */
  holdMs: number
  /** Duration of zoom-out tween in ms */
  zoomOutMs: number
  /** Callback fired when hold phase begins (use to trigger GAIA line or overlay) */
  onHoldStart?: () => void
  /** Callback fired when zoom-out completes */
  onComplete?: () => void
}

/**
 * Scripted camera sequences for dramatic moments in MineScene.
 *
 * Usage:
 *   const seq = new CameraSequencer(scene)
 *   seq.zoomToPoint({ worldX, worldY, targetZoomMultiplier: 2.5, ... })
 */
export class CameraSequencer {
  private scene: Phaser.Scene
  private baseZoom = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.baseZoom = scene.cameras.main.zoom
  }

  /**
   * Zooms the camera into a world point, holds, then returns to base zoom.
   * Lerps camera scroll position toward the target during zoom-in.
   */
  zoomToPoint(opts: ZoomToPointOptions): void {
    const cam = this.scene.cameras.main
    const originalScrollX = cam.scrollX
    const originalScrollY = cam.scrollY
    const targetZoom = this.baseZoom * opts.targetZoomMultiplier

    // Center the camera on the target world point during zoom
    const targetScrollX = opts.worldX - cam.width / (2 * targetZoom)
    const targetScrollY = opts.worldY - cam.height / (2 * targetZoom)

    this.scene.tweens.add({
      targets: cam,
      zoom: targetZoom,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      duration: opts.zoomInMs,
      ease: 'Cubic.Out',
      onComplete: () => {
        opts.onHoldStart?.()
        this.scene.time.delayedCall(opts.holdMs, () => {
          this.scene.tweens.add({
            targets: cam,
            zoom: this.baseZoom,
            scrollX: originalScrollX,
            scrollY: originalScrollY,
            duration: opts.zoomOutMs,
            ease: 'Cubic.InOut',
            onComplete: () => opts.onComplete?.(),
          })
        })
      },
    })
  }

  /**
   * Returns the current base zoom (zoom level before any scripted sequences).
   * Use this to restore zoom after a sequence ends.
   */
  getBaseZoom(): number {
    return this.baseZoom
  }

  /**
   * Refreshes the stored base zoom (call after any permanent zoom change).
   */
  updateBaseZoom(): void {
    this.baseZoom = this.scene.cameras.main.zoom
  }
}
```

#### 31.2.2 — GAIA Artifact Commentary Lines

**File**: `src/game/managers/GaiaManager.ts`

Add a new method `getArtifactRevealLine(rarity: Rarity): string` that returns one of five lines per rarity tier, chosen pseudo-randomly from a pool. These lines must NOT be the same lines used in `gaiaDialogue.ts` post-dive reactions. They should be brief (under 12 words) and delivered *before* the overlay fully opens — they are whispered teaser lines.

Example pool structure (add to `GaiaManager.ts` as a private constant `ARTIFACT_REVEAL_LINES`):

```typescript
private static readonly ARTIFACT_REVEAL_LINES: Record<string, readonly string[]> = {
  common: [
    'Something is there.',
    'A faint signal.',
    'Worth cataloguing.',
    'I am detecting a residual signature.',
    'Small, but real.',
  ],
  uncommon: [
    'Interesting. This has age.',
    'Not nothing. Look closer.',
    'Preserved. Unusual for this depth.',
    'My sensors are responding.',
    'This layer hid something.',
  ],
  rare: [
    'This is significant.',
    'Rare emission detected. Take care.',
    'Pre-collapse origin. Remarkable.',
    'I do not see these often.',
    'Document everything.',
  ],
  epic: [
    'GAIA is processing. Stand by.',
    'An artifact of considerable age.',
    'This predates the Collapse.',
    'I am cross-referencing now.',
    'Extraordinary. Simply extraordinary.',
  ],
  legendary: [
    'I was not sure one of these still existed.',
    'Legendary classification confirmed.',
    'The archive will remember this moment.',
    'You found it. Against all probability.',
    'I need a moment.',
  ],
  mythic: [
    'Mythic. I have no further words.',
    'In ten thousand dives I have seen two of these.',
    'This changes what I thought I knew.',
    'Do not move. Do not speak. Just look at it.',
    'Record this. The archive must know.',
  ],
}
```

The method picks a line using `Math.floor(Math.random() * pool.length)`.

#### 31.2.3 — MineScene Artifact Reveal Hook

**File**: `src/game/scenes/MineScene.ts`

1. Add `private cameraSequencer: CameraSequencer | null = null` as a class field.
2. In `create()`, initialize: `this.cameraSequencer = new CameraSequencer(this)`.
3. Locate the method that handles artifact node breaking (search for `pendingArtifactSlot` assignment, approximately line 680–720). Wrap the existing `GameManager.getInstance().showGachaReveal(...)` call with the new sequence:

```typescript
private triggerArtifactRevealSequence(
  artifactSlot: InventorySlot,
  tileWorldX: number,
  tileWorldY: number,
  rarity: Rarity
): void {
  if (!this.cameraSequencer) {
    // Fallback: direct reveal without camera sequence
    GameManager.getInstance().showGachaReveal(artifactSlot, rarity)
    return
  }

  // Pause player input during sequence
  this.isPaused = true

  // Step 1: zoom to artifact tile
  const timing = REVEAL_TIMING[rarity] ?? REVEAL_TIMING.common
  this.cameraSequencer.zoomToPoint({
    worldX: tileWorldX,
    worldY: tileWorldY,
    targetZoomMultiplier: 2.0,
    zoomInMs: 350,
    holdMs: timing.anticipationMs,
    zoomOutMs: 250,
    onHoldStart: () => {
      // Step 2: GAIA line during hold
      const line = GameManager.getInstance().gaiaManager.getArtifactRevealLine(rarity)
      GameManager.getInstance().emitGaiaLine(line)
    },
    onComplete: () => {
      // Step 3: resume input; open GachaReveal overlay
      this.isPaused = false
      this.cameraSequencer?.updateBaseZoom()
      GameManager.getInstance().showGachaReveal(artifactSlot, rarity)
    },
  })
}
```

Replace all direct calls to `GameManager.getInstance().showGachaReveal(...)` inside artifact-node break handling with `this.triggerArtifactRevealSequence(...)`.

#### 31.2.4 — Collection Pull-In Animation

**File**: `src/ui/components/GachaReveal.svelte`

On the `payoff` phase, when the player taps the **Collect** button, add a CSS keyframe animation that makes the artifact icon (if the `artifactIconUrl` prop is provided) fly from the center of the screen toward the top-right corner (HUD inventory position) before `onComplete()` is called.

Add an optional `artifactIconUrl: string | undefined` prop to `GachaReveal.svelte`.

In the `payoff` phase markup, add:

```svelte
{#if phase === 'payoff' && artifactIconUrl}
  <img
    class="artifact-collect-icon"
    class:collecting={isCollecting}
    src={artifactIconUrl}
    alt="artifact"
  />
{/if}
```

CSS:

```css
.artifact-collect-icon {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: none;
}

.artifact-collect-icon.collecting {
  animation: collectPull 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes collectPull {
  0%   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
  60%  { transform: translate(200%, -400%) scale(0.6); opacity: 1; }
  100% { transform: translate(280%, -500%) scale(0);   opacity: 0; }
}
```

The `isCollecting` reactive state flips to `true` when the Collect button is tapped. `onComplete()` is called after the 400 ms animation completes (not immediately on tap).

#### Acceptance Criteria — 31.2

- [ ] Breaking an ArtifactNode triggers camera zoom into the tile before any overlay appears.
- [ ] A GAIA line is emitted during the zoom-hold phase; the line matches the rarity tier pool.
- [ ] The `CameraSequencer` zoom-return animation completes before `GachaReveal` opens.
- [ ] The Collect button triggers the pull-in arc animation; `onComplete()` fires after the arc.
- [ ] Player input is paused during the camera sequence and re-enabled after.
- [ ] `CameraSequencer.ts` passes `npm run typecheck` with no errors.
- [ ] No `innerHTML` usage in the collect animation — icon is set via `src` prop only.

---

### 31.3 — Block Rarity Preview

**Goal**: `ArtifactNode` blocks at `rare` rarity or higher emit a persistent ambient shimmer (a secondary overlay layer on the tile) that is visible without the scanner. This gives observant players environmental clues and makes high-value areas feel alive. Common and uncommon artifact nodes use the existing 4-frame `block_artifact` animation only; no extra shimmer.

#### 31.3.1 — Rarity Shimmer Balance Constants

**File**: `src/data/balance.ts`

Add after `REVEAL_TIMING`:

```typescript
// === BLOCK SHIMMER TIERS (Phase 31.3) ===
// Controls the ambient shimmer overlay on ArtifactNode tiles by rarity.
// shimmerAlpha     : peak opacity of the shimmer overlay (0-1)
// shimmerColor     : hex tint of the shimmer overlay
// shimmerPeriodMs  : full cycle duration in ms
// shimmerRadiusTiles : how many adjacent tiles the shimmer glow bleeds into (0 = tile only)
export const BLOCK_SHIMMER_TIERS: Record<string, {
  shimmerAlpha: number
  shimmerColor: number
  shimmerPeriodMs: number
  shimmerRadiusTiles: number
}> = {
  common:    { shimmerAlpha: 0.00, shimmerColor: 0x888888, shimmerPeriodMs: 0,    shimmerRadiusTiles: 0 },
  uncommon:  { shimmerAlpha: 0.00, shimmerColor: 0x4ec9a0, shimmerPeriodMs: 0,    shimmerRadiusTiles: 0 },
  rare:      { shimmerAlpha: 0.20, shimmerColor: 0x4a9eff, shimmerPeriodMs: 1800, shimmerRadiusTiles: 0 },
  epic:      { shimmerAlpha: 0.30, shimmerColor: 0xcc44ff, shimmerPeriodMs: 1400, shimmerRadiusTiles: 1 },
  legendary: { shimmerAlpha: 0.45, shimmerColor: 0xffd700, shimmerPeriodMs: 1000, shimmerRadiusTiles: 1 },
  mythic:    { shimmerAlpha: 0.60, shimmerColor: 0xff44aa, shimmerPeriodMs: 700,  shimmerRadiusTiles: 2 },
} as const
```

#### 31.3.2 — BlockShimmerSystem

**File**: `src/game/systems/BlockShimmerSystem.ts` (new file)

```typescript
import Phaser from 'phaser'
import { BLOCK_SHIMMER_TIERS } from '../../data/balance'
import type { Rarity } from '../../data/types'

/**
 * Manages ambient shimmer overlays on high-rarity ArtifactNode tiles.
 *
 * Rendered as additive-blended Graphics rectangles drawn each frame
 * over the tile position. Alpha is driven by a sinusoidal pulse using
 * `Phaser.time.now`.
 *
 * Usage:
 *   const shimmer = new BlockShimmerSystem(scene, TILE_SIZE)
 *   // each frame in MineScene.update():
 *   shimmer.update(this.time.now)
 *   // when a new layer is generated:
 *   shimmer.registerNode(tileX, tileY, worldX, worldY, rarity)
 *   // when a tile is destroyed:
 *   shimmer.unregisterNode(tileX, tileY)
 */
export class BlockShimmerSystem {
  private scene: Phaser.Scene
  private tileSize: number
  private shimmerGfx!: Phaser.GameObjects.Graphics

  private nodes: Map<string, {
    worldX: number
    worldY: number
    rarity: Rarity
    phaseOffset: number   // Random phase offset (0-2π) so nodes don't pulse in sync
  }> = new Map()

  constructor(scene: Phaser.Scene, tileSize: number) {
    this.scene = scene
    this.tileSize = tileSize
  }

  /** Must be called during MineScene.create() after the main layer is rendered. */
  init(): void {
    this.shimmerGfx = this.scene.add.graphics()
    this.shimmerGfx.setDepth(201)  // One layer above BlockAnimSystem (depth 200)
    this.shimmerGfx.setBlendMode(Phaser.BlendModes.ADD)
  }

  /**
   * Register an ArtifactNode tile for shimmer rendering.
   * No-op if rarity has shimmerAlpha === 0.
   */
  registerNode(tileX: number, tileY: number, worldX: number, worldY: number, rarity: Rarity): void {
    const cfg = BLOCK_SHIMMER_TIERS[rarity]
    if (!cfg || cfg.shimmerAlpha === 0) return
    const key = `${tileX},${tileY}`
    this.nodes.set(key, { worldX, worldY, rarity, phaseOffset: Math.random() * Math.PI * 2 })
  }

  /** Remove a node (called when the tile is broken or the layer resets). */
  unregisterNode(tileX: number, tileY: number): void {
    this.nodes.delete(`${tileX},${tileY}`)
  }

  /** Clear all registered nodes (call on layer transition). */
  clear(): void {
    this.nodes.clear()
  }

  /**
   * Draw shimmer overlays for all registered nodes.
   * Call once per frame from MineScene.update().
   *
   * @param nowMs - Phaser time.now in milliseconds
   */
  update(nowMs: number): void {
    this.shimmerGfx.clear()
    for (const node of this.nodes.values()) {
      const cfg = BLOCK_SHIMMER_TIERS[node.rarity]
      if (!cfg || cfg.shimmerAlpha === 0 || cfg.shimmerPeriodMs === 0) continue

      const cycle = (nowMs % cfg.shimmerPeriodMs) / cfg.shimmerPeriodMs
      const alpha = cfg.shimmerAlpha * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2 + node.phaseOffset))

      const r = (cfg.shimmerColor >> 16) & 0xff
      const g = (cfg.shimmerColor >> 8) & 0xff
      const b = cfg.shimmerColor & 0xff

      // Core tile shimmer
      this.shimmerGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha)
      this.shimmerGfx.fillRect(node.worldX, node.worldY, this.tileSize, this.tileSize)

      // Bleed into adjacent tiles for epic+ rarities
      if (cfg.shimmerRadiusTiles > 0) {
        const bleedAlpha = alpha * 0.35
        this.shimmerGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), bleedAlpha)
        for (let dx = -cfg.shimmerRadiusTiles; dx <= cfg.shimmerRadiusTiles; dx++) {
          for (let dy = -cfg.shimmerRadiusTiles; dy <= cfg.shimmerRadiusTiles; dy++) {
            if (dx === 0 && dy === 0) continue
            this.shimmerGfx.fillRect(
              node.worldX + dx * this.tileSize,
              node.worldY + dy * this.tileSize,
              this.tileSize,
              this.tileSize
            )
          }
        }
      }
    }
  }

  /** Destroy graphics object when scene shuts down. */
  destroy(): void {
    this.shimmerGfx?.destroy()
    this.nodes.clear()
  }
}
```

#### 31.3.3 — MineScene Integration

**File**: `src/game/scenes/MineScene.ts`

1. Add `private blockShimmer: BlockShimmerSystem | null = null` as a class field.
2. In `create()`, after `this.particles.init()`: `this.blockShimmer = new BlockShimmerSystem(this, TILE_SIZE); this.blockShimmer.init()`.
3. After mine generation completes, iterate all cells and call `registerNode` for each `ArtifactNode` with a known rarity.
4. In `update()`, call `this.blockShimmer?.update(this.time.now)`.
5. On block break (inside the artifact node break handler), call `this.blockShimmer?.unregisterNode(tileX, tileY)`.
6. On scene shutdown / layer transition, call `this.blockShimmer?.clear()`.

The `rarity` value for the shimmer comes from `cell.content?.rarity` (already set during mine generation via `artifactDrop.ts`). If `rarity` is absent, default to `'common'` (no shimmer).

#### Acceptance Criteria — 31.3

- [ ] Common and uncommon ArtifactNode tiles show no shimmer overlay — only the existing 4-frame animation.
- [ ] Rare ArtifactNode tiles have a visible blue pulse at the correct `shimmerPeriodMs` (1800 ms cycle).
- [ ] Legendary tiles emit gold shimmer that bleeds 1 tile in all directions.
- [ ] Mythic tiles (if present) emit a pink shimmer with 2-tile bleed and fast 700 ms pulse.
- [ ] Breaking an ArtifactNode removes its shimmer immediately.
- [ ] Layer transitions clear all shimmers (no ghost shimmers on a new layer).
- [ ] `BlockShimmerSystem.ts` passes `npm run typecheck` with no errors.
- [ ] Performance: shimmer `update()` renders in under 1 ms on a single layer (check with `performance.now()` guard in dev builds).

---

### 31.4 — Celebration Particle Effects

**Goal**: Add rarity-specific Phaser 3 particle emitter configurations for the in-world tile position (fired when the artifact is revealed) and a CSS-layer confetti/sparkle system for the `GachaReveal.svelte` overlay. These stack on top of Phase 17's basic CSS particles.

#### 31.4.1 — ParticleSystem.emitArtifactReveal()

**File**: `src/game/systems/ParticleSystem.ts`

Add a new public method `emitArtifactReveal(rarity: Rarity, worldX: number, worldY: number): void`.

This method fires a multi-stage burst at the given world coordinates. The configuration per rarity tier:

| Rarity | Stage 1 (immediate) | Stage 2 (80 ms delay) | Stage 3 (160 ms delay) |
|---|---|---|---|
| common | 6 grey sparks, 300 ms lifespan | — | — |
| uncommon | 12 teal sparks, 400 ms | — | — |
| rare | 20 blue stars, 600 ms | 10 white flash particles, 200 ms | — |
| epic | 40 purple sparks, 800 ms | 20 larger white flares, 300 ms | 8 slow-drift orbital motes, 1200 ms |
| legendary | 60 gold confetti, 1000 ms | 30 white halos, 400 ms | 15 large gold flares, 600 ms + slow-drift gold motes |
| mythic | 100 pink+white confetti, 1200 ms | 50 white halos, 500 ms | 25 pink orbital motes, 1500 ms + a ring-expand effect |

Implement using `this.scene.time.delayedCall()` for delayed waves. Each wave calls `emitter.explode(count)` at the appropriate world position.

For the "ring-expand effect" on mythic: create a temporary `Phaser.GameObjects.Arc` (circle) at the tile center, tween its radius from 0 to `TILE_SIZE * 4` over 400 ms while tweening `fillAlpha` from 0.4 to 0, then destroy it.

```typescript
emitArtifactReveal(rarity: Rarity, worldX: number, worldY: number): void {
  const RARITY_CONFIGS: Record<string, Array<{
    delay: number
    count: number
    tint: number
    lifespan: number
    speed: { min: number; max: number }
    scale: { start: number; end: number }
  }>> = {
    common:    [{ delay: 0,   count: 6,   tint: 0x888888, lifespan: 300,  speed: { min: 20, max: 60  }, scale: { start: 0.6, end: 0 } }],
    uncommon:  [{ delay: 0,   count: 12,  tint: 0x4ec9a0, lifespan: 400,  speed: { min: 30, max: 80  }, scale: { start: 0.8, end: 0 } }],
    rare:      [{ delay: 0,   count: 20,  tint: 0x4a9eff, lifespan: 600,  speed: { min: 40, max: 100 }, scale: { start: 1.0, end: 0 } },
                { delay: 80,  count: 10,  tint: 0xffffff, lifespan: 200,  speed: { min: 80, max: 150 }, scale: { start: 1.2, end: 0 } }],
    epic:      [{ delay: 0,   count: 40,  tint: 0xcc44ff, lifespan: 800,  speed: { min: 50, max: 120 }, scale: { start: 1.0, end: 0 } },
                { delay: 80,  count: 20,  tint: 0xffffff, lifespan: 300,  speed: { min: 100, max: 180 }, scale: { start: 1.5, end: 0 } },
                { delay: 160, count: 8,   tint: 0xaa44cc, lifespan: 1200, speed: { min: 5,  max: 20  }, scale: { start: 0.8, end: 0 } }],
    legendary: [{ delay: 0,   count: 60,  tint: 0xffd700, lifespan: 1000, speed: { min: 60, max: 140 }, scale: { start: 1.2, end: 0 } },
                { delay: 80,  count: 30,  tint: 0xffffff, lifespan: 400,  speed: { min: 120, max: 220 }, scale: { start: 1.8, end: 0 } },
                { delay: 160, count: 15,  tint: 0xffaa00, lifespan: 600,  speed: { min: 10, max: 30  }, scale: { start: 1.0, end: 0 } }],
    mythic:    [{ delay: 0,   count: 100, tint: 0xff44aa, lifespan: 1200, speed: { min: 80, max: 180 }, scale: { start: 1.4, end: 0 } },
                { delay: 80,  count: 50,  tint: 0xffffff, lifespan: 500,  speed: { min: 150, max: 280 }, scale: { start: 2.0, end: 0 } },
                { delay: 160, count: 25,  tint: 0xff88cc, lifespan: 1500, speed: { min: 5,  max: 25  }, scale: { start: 1.2, end: 0 } }],
  }
  // ... implementation using delayedCall and ad-hoc emitters per wave
}
```

#### 31.4.2 — GachaReveal CSS Confetti Enhancement

**File**: `src/ui/components/GachaReveal.svelte`

Upgrade the existing CSS particle system for `rare+` tiers to use non-circular shapes (rectangles for confetti effect) and directionally correct vector motion. The current `particleFly` keyframe moves all particles in the same direction — replace it with angle-based motion using `rotate(var(--angle)) translateX(calc(var(--speed) * 60px))`.

Add three additional particle variants for `epic+`:

1. **Slow drift**: `opacity: 1 → 0` over 1200 ms, very small horizontal drift only.
2. **Sparkle burst**: scales up to 1.5× then collapses, 300 ms total, fires as a second wave.
3. **Confetti rectangle**: `width: 6px; height: 3px; border-radius: 1px; transform: rotate(random deg)`.

Generate the second and third particle types in the `$effect` when `phase === 'reveal'` and `tier.particleCount >= 40` (epic+).

Each particle receives a randomized `--rotation` CSS property used by the confetti shape.

#### Acceptance Criteria — 31.4

- [ ] `emitArtifactReveal('rare', ...)` fires 2 waves in MineScene at the tile world position.
- [ ] `emitArtifactReveal('legendary', ...)` fires 3 waves; gold particles are visible for 1 second.
- [ ] `emitArtifactReveal('mythic', ...)` fires the ring-expand arc effect in addition to 3 particle waves.
- [ ] GachaReveal CSS particles for epic+ have visibly distinct motion (angle-based, not all same direction).
- [ ] No more than 50 simultaneous CSS particle elements in the DOM (total across all waves).
- [ ] All particle emitters are destroyed after their lifespan completes (no memory leak).
- [ ] `ParticleSystem.ts` passes `npm run typecheck` with no errors.

---

### 31.5 — Layer Descent Animation

**Goal**: Replace the current instant-cut between layers when the player steps on a `DescentShaft` with a three-beat choreographed animation: (1) camera pans down and zooms slightly, (2) a depth counter overlays the screen ("Layer 4 → 5"), (3) a brief biome name card appears if the biome changes, then the new layer fades in. This runs entirely in MineScene/Phaser with a thin Svelte overlay for the depth counter text (to allow pixel-perfect font rendering).

#### 31.5.1 — Descent Animation Balance Constants

**File**: `src/data/balance.ts`

Add after `BLOCK_SHIMMER_TIERS`:

```typescript
// === DESCENT ANIMATION (Phase 31.5) ===
export const DESCENT_ANIM = {
  /** Duration of camera pan down before fade, in ms */
  panDurationMs: 400,
  /** Camera zoom multiplier during descent (>1 = zoom in slightly) */
  zoomDuringDescent: 1.15,
  /** Duration of screen fade-to-black, in ms */
  fadeDurationMs: 350,
  /** Duration of new-layer fade-in, in ms */
  fadeInDurationMs: 400,
  /** How long the depth counter card is held visible, in ms */
  depthCounterHoldMs: 900,
  /** How long a biome-change name card is shown, in ms (0 if biome unchanged) */
  biomeCardHoldMs: 1200,
  /** Oxygen restore flash duration (already in BALANCE, but gated here for the visual) */
  oxygenFlashMs: 600,
} as const
```

#### 31.5.2 — DescentOverlay Svelte Component

**File**: `src/ui/components/DescentOverlay.svelte` (new file)

This component receives props from `GameManager` via the Svelte store `gameState`. It overlays the Phaser canvas during the descent sequence.

Props:
```typescript
interface Props {
  visible: boolean
  fromLayer: number        // 1-based layer number player is leaving
  toLayer: number          // 1-based layer number player is entering
  biomeName: string | null // null = same biome, show biome name if changed
  onAnimComplete: () => void
}
```

The component animates in three stages using `$effect` and `setTimeout`:

1. **Depth counter** (visible immediately): Large centered text "↓ Layer {toLayer}" with the layer number counting up from `fromLayer` to `toLayer` over 400 ms.
2. **Biome name card** (visible if `biomeName` is not null, appears 300 ms after depth counter): Smaller text below: "Entering: {biomeName}".
3. **Fade-out**: After `depthCounterHoldMs` + optional `biomeCardHoldMs`, the overlay fades to transparent and calls `onAnimComplete`.

The overlay background is `rgba(0,0,0,0.85)` with a radial vignette. Text uses the existing `'Courier New', monospace` font.

The depth counter number uses a CSS `@keyframes countUp` that cycles through intermediate numbers using `counter-increment` or a JS `setInterval` that updates the displayed number every 80 ms.

Example structure:

```svelte
<script lang="ts">
  import { DESCENT_ANIM } from '../../data/balance'
  interface Props {
    visible: boolean
    fromLayer: number
    toLayer: number
    biomeName: string | null
    onAnimComplete: () => void
  }
  let { visible, fromLayer, toLayer, biomeName, onAnimComplete }: Props = $props()

  let displayLayer = $state(fromLayer)
  let showBiomeName = $state(false)
  let fading = $state(false)

  $effect(() => {
    if (!visible) return
    displayLayer = fromLayer
    showBiomeName = false
    fading = false

    // Count up the layer number
    const step = (toLayer - fromLayer) / 5
    let current = fromLayer
    const countInterval = setInterval(() => {
      current += step
      displayLayer = Math.round(Math.min(current, toLayer))
      if (displayLayer >= toLayer) clearInterval(countInterval)
    }, 80)

    // Show biome name card after 300 ms (if biome changed)
    const t1 = biomeName
      ? setTimeout(() => { showBiomeName = true }, 300)
      : null

    // Begin fade-out
    const holdMs = DESCENT_ANIM.depthCounterHoldMs + (biomeName ? DESCENT_ANIM.biomeCardHoldMs : 0)
    const t2 = setTimeout(() => {
      fading = true
      setTimeout(onAnimComplete, 350)
    }, holdMs)

    return () => {
      clearInterval(countInterval)
      if (t1) clearTimeout(t1)
      clearTimeout(t2)
    }
  })
</script>

{#if visible}
  <div class="descent-overlay" class:fading>
    <div class="depth-counter">
      <span class="arrow">↓</span>
      <span class="layer-num">Layer {displayLayer}</span>
    </div>
    {#if showBiomeName && biomeName}
      <div class="biome-card">Entering: {biomeName}</div>
    {/if}
  </div>
{/if}
```

#### 31.5.3 — MineScene Descent Hook

**File**: `src/game/scenes/MineScene.ts`

1. When the player steps on a `DescentShaft`, before calling the existing layer-transition logic:
   - Fire `GameManager.getInstance().showDescentOverlay(currentLayer + 1, currentLayer + 2, newBiomeName)`.
   - Trigger a camera pan-down tween over `DESCENT_ANIM.panDurationMs` ms (pan by `TILE_SIZE * 3` pixels downward).
   - Simultaneously tween `cameras.main.zoom` to `cameras.main.zoom * DESCENT_ANIM.zoomDuringDescent`.
   - After the pan, call `cameras.main.fadeOut(DESCENT_ANIM.fadeDurationMs, 0, 0, 0)`.
   - Listen for the `fadeComplete` camera event to trigger actual scene restart / layer transition.
2. After the new layer is generated and the scene is ready, call `cameras.main.fadeIn(DESCENT_ANIM.fadeInDurationMs, 0, 0, 0)`.
3. The oxygen restore flash (`OXYGEN_LAYER_BONUS`) should coincide with the fade-in completing, not the fade-out.

#### Acceptance Criteria — 31.5

- [ ] Stepping onto a DescentShaft no longer produces an instant cut; camera pans down visibly.
- [ ] The "Layer X → X+1" depth counter is legible on screen for at least 900 ms.
- [ ] If the biome changes, the biome name card appears for 1200 ms.
- [ ] Screen fades to black before the new layer is visible.
- [ ] New layer fades in smoothly (400 ms).
- [ ] Oxygen restore flash coincides with fade-in completion.
- [ ] `DescentOverlay.svelte` passes `npm run typecheck` with no errors.
- [ ] No visible jank or double-transition if the player taps a shaft rapidly (input must be blocked during the full sequence).

---

### 31.6 — Near-Miss and Streak Visual Feedback

**Goal**: Upgrade the near-miss banner and add a streak-multiplier on-screen visual that reinforces sustained correct answers during a dive. Both systems must read from existing `BALANCE` constants and fire only in response to real gameplay events.

#### 31.6.1 — Near-Miss Ring Animation

**File**: `src/ui/components/NearMissBanner.svelte`

The current pill banner fades in and out with no additional animation beyond the simple `bannerPop` keyframe. Add a "pulsing ring" element that expands and fades around the text, communicating "you almost got something bigger."

Add inside the `{#if message && visible}` block:

```svelte
<div class="near-miss-ring" aria-hidden="true"></div>
```

The ring starts at 100% width of the banner and expands to 150% while fading to 0 alpha over 600 ms, using a keyframe animation that fires twice:

```css
.near-miss-ring {
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 999px;
  animation: ringExpand 600ms ease-out 2 forwards;
  pointer-events: none;
}

@keyframes ringExpand {
  from { transform: scale(1);    opacity: 0.8; }
  to   { transform: scale(1.6);  opacity: 0; }
}
```

Also add a near-miss counter display: if the player has hit 3+ consecutive near-misses in the same dive (epic-but-not-legendary, or legendary-but-not-mythic), show a sub-line below the banner message:

```
"3 near-misses this dive — your luck is shifting"
```

This requires the `NearMissBanner` to accept an optional `nearMissCount: number | undefined` prop. The sub-line appears only when `nearMissCount >= 3`.

#### 31.6.2 — Streak Visual Overlay

**File**: `src/ui/components/StreakFeedback.svelte` (new file)

A lightweight inline-toast component that fires when the player answers 3, 5, or 7 consecutive correct quiz answers in a single dive. Displayed in the HUD area below the O2 bar.

Props:
```typescript
interface Props {
  streakCount: number   // Current consecutive correct count (0 = hidden)
  multiplier: number    // Current XP/dust multiplier (from BALANCE or QuizManager)
}
```

For `streakCount >= 3`, show a compact strip:
```
🔥 ×3 streak — +20% dust
```

For `streakCount >= 5`:
```
🔥🔥 ×5 STREAK — +35% dust
```

For `streakCount >= 7`:
```
🔥🔥🔥 ×7 STREAK — +50% dust  [animate with pulse]
```

The multiplier text (`+X% dust`) comes from the `multiplier` prop. The component does NOT manage streak logic — it only renders a provided state. The `QuizManager` is responsible for tracking and emitting streak count changes to the Svelte store.

Add a new exported Svelte store `quizStreak` to `src/ui/stores/gameState.ts`:

```typescript
export const quizStreak = writable<{ count: number; multiplier: number }>({ count: 0, multiplier: 1.0 })
```

Bind `StreakFeedback.svelte` into the HUD (in `DomeView.svelte` or wherever the HUD is mounted during a dive — follow the existing pattern for other HUD components).

#### 31.6.3 — Streak Multiplier Balance Constants

**File**: `src/data/balance.ts`

Add after `DESCENT_ANIM`:

```typescript
// === STREAK VISUAL THRESHOLDS (Phase 31.6) ===
export const STREAK_VISUAL = {
  TIER_1_COUNT: 3,   multiplier_1: 1.20,  // 3 correct in a row → +20% dust
  TIER_2_COUNT: 5,   multiplier_2: 1.35,  // 5 correct in a row → +35% dust
  TIER_3_COUNT: 7,   multiplier_3: 1.50,  // 7 correct in a row → +50% dust
  RESET_ON_WRONG: true,
} as const
```

#### 31.6.4 — QuizManager Integration

**File**: `src/game/managers/QuizManager.ts`

Import `quizStreak` store and `STREAK_VISUAL` constants. Track a `private consecutiveCorrect = 0` counter. After each `submitAnswer()` call:

- Correct: `consecutiveCorrect++`; if count crosses a tier threshold, update `quizStreak` store.
- Wrong: `consecutiveCorrect = 0`; reset `quizStreak` to `{ count: 0, multiplier: 1.0 }`.
- Apply the multiplier to the dust reward computed in `submitAnswer()` when awarding `RANDOM_QUIZ_REWARD_DUST`.

#### Acceptance Criteria — 31.6

- [ ] Near-miss ring animation fires on epic and legendary reveals (not on common/uncommon).
- [ ] Ring expands visibly twice, then the banner fades out as before.
- [ ] Near-miss count sub-line appears when `nearMissCount >= 3`.
- [ ] `quizStreak` store is exported from `gameState.ts`.
- [ ] `StreakFeedback.svelte` shows tier 1 text at 3 correct answers, tier 2 at 5, tier 3 at 7.
- [ ] Streak resets to 0 on any wrong answer.
- [ ] Dust reward in `QuizManager.submitAnswer()` is multiplied by the active streak multiplier.
- [ ] `StreakFeedback.svelte` passes `npm run typecheck` with no errors.
- [ ] Streak display is not visible between dives (hidden when `streakCount === 0`).

---

## Playwright Tests

Run with `node /tmp/ss31.js` after starting the dev server with `npm run dev`.

### Test Script Template

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // === TEST 31.1: GachaReveal timing escalation ===
  // Navigate to mine, trigger gacha via DevPanel artifact shortcut
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(2000)
  // Open DevPanel (if available) and trigger a legendary artifact reveal
  // Verify: overlay appears, suspense phase lasts >1400ms, particle waves fire
  await page.screenshot({ path: '/tmp/ss31-gacha-anticipation.png' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss31-gacha-reveal.png' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss31-gacha-payoff.png' })

  // === TEST 31.3: Block shimmer on high-rarity nodes ===
  // Verify shimmer overlay is visible on rare artifact node tiles
  await page.screenshot({ path: '/tmp/ss31-shimmer.png' })

  // === TEST 31.5: Layer descent animation ===
  // Navigate to descent shaft and trigger descent
  // Verify: depth counter overlay, biome name card (if biome changes), fade transition
  await page.screenshot({ path: '/tmp/ss31-descent-counter.png' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/ss31-descent-fadein.png' })

  // === TEST 31.6: Streak feedback ===
  // Answer 3+ consecutive quiz questions correctly
  // Verify: streak strip appears in HUD
  await page.screenshot({ path: '/tmp/ss31-streak.png' })

  await browser.close()
  console.log('Phase 31 screenshots saved.')
})()
```

### Visual Acceptance Criteria for Screenshots

| Screenshot | What to Verify |
|---|---|
| `ss31-gacha-anticipation.png` | '?' mystery box is centered; no rarity label visible yet |
| `ss31-gacha-reveal.png` | Rarity label visible; particles in motion; background has rarity gradient |
| `ss31-gacha-payoff.png` | Fact text + Collect button visible; particles fading |
| `ss31-shimmer.png` | Shimmer overlay visible on an ArtifactNode tile (blue/gold glow over tile) |
| `ss31-descent-counter.png` | Depth counter text overlaid on dark background; layer number correct |
| `ss31-descent-fadein.png` | New layer tiles fully visible; HUD restored |
| `ss31-streak.png` | Streak strip visible in HUD area with correct multiplier text |

---

## Verification Gate

All items in this gate **must** pass before Phase 31 is marked complete.

### TypeScript

```bash
npm run typecheck
```

- [ ] Zero errors across all modified and new files
- [ ] Explicit check: `src/game/systems/CameraSequencer.ts` — zero errors
- [ ] Explicit check: `src/game/systems/BlockShimmerSystem.ts` — zero errors
- [ ] Explicit check: `src/ui/components/DescentOverlay.svelte` — zero errors
- [ ] Explicit check: `src/ui/components/StreakFeedback.svelte` — zero errors

### Build

```bash
npm run build
```

- [ ] Production build completes without warnings above 500 KB chunk threshold
- [ ] No new `eval()`, `Function()`, or `innerHTML` patterns introduced (grep check)

### Security

```bash
grep -rn 'innerHTML\|eval(\|Function(' src/ui/components/GachaReveal.svelte src/ui/components/DescentOverlay.svelte src/ui/components/StreakFeedback.svelte src/ui/components/NearMissBanner.svelte
```

- [ ] Zero matches — no unsafe DOM manipulation

### Functional Checks

- [ ] `REVEAL_TIMING` is imported and used in `GachaReveal.svelte` (not hard-coded ms values)
- [ ] `BLOCK_SHIMMER_TIERS` is imported and used in `BlockShimmerSystem.ts`
- [ ] `DESCENT_ANIM` is imported and used in `DescentOverlay.svelte` and `MineScene.ts`
- [ ] `STREAK_VISUAL` is imported and used in `QuizManager.ts`
- [ ] `quizStreak` store exported from `src/ui/stores/gameState.ts`
- [ ] `CameraSequencer` imported in `MineScene.ts` and instantiated in `create()`
- [ ] `BlockShimmerSystem` imported in `MineScene.ts` and instantiated in `create()`
- [ ] `emitArtifactReveal()` method exists on `ParticleSystem` class

### Visual Regression

- [ ] Playwright screenshots taken: anticipation, reveal, payoff, shimmer, descent-counter, descent-fadein, streak
- [ ] GachaReveal overlay is fully centered and fills viewport on 390×844 (mobile portrait)
- [ ] Depth counter text is legible (min 2rem font size, no clipping)
- [ ] Streak strip does not overlap the O2 bar or quiz overlay

### Performance

- [ ] `BlockShimmerSystem.update()` completes in under 2 ms when 10 shimmer nodes are registered (log a `console.time` check in dev builds)
- [ ] Particle emitter count in `ParticleSystem` does not grow unboundedly across multiple artifact reveals in the same dive (verify emitters are destroyed after lifespan)

---

## Files Affected

### New Files

| File | Purpose |
|---|---|
| `src/game/systems/CameraSequencer.ts` | Scripted camera zoom/pan sequences for artifact reveals and descent |
| `src/game/systems/BlockShimmerSystem.ts` | Ambient shimmer overlay for high-rarity ArtifactNode tiles |
| `src/ui/components/DescentOverlay.svelte` | Layer descent animation overlay (depth counter + biome name card) |
| `src/ui/components/StreakFeedback.svelte` | In-HUD streak multiplier feedback strip |

### Modified Files

| File | Changes |
|---|---|
| `src/data/balance.ts` | Add `REVEAL_TIMING`, `BLOCK_SHIMMER_TIERS`, `DESCENT_ANIM`, `STREAK_VISUAL` constants |
| `src/ui/components/GachaReveal.svelte` | Import `REVEAL_TIMING`; use per-phase timing; add `flash` phase; rarity background gradients; multi-wave CSS particles; collect pull-in animation |
| `src/ui/components/NearMissBanner.svelte` | Add ring-expand keyframe; accept `nearMissCount` prop; show sub-line at 3+ near-misses |
| `src/game/systems/ParticleSystem.ts` | Add `emitArtifactReveal(rarity, worldX, worldY)` method |
| `src/game/scenes/MineScene.ts` | Instantiate `CameraSequencer` and `BlockShimmerSystem`; hook `triggerArtifactRevealSequence()`; hook descent shaft animation; call `blockShimmer.update()` in `update()` |
| `src/game/managers/GaiaManager.ts` | Add `getArtifactRevealLine(rarity)` method and `ARTIFACT_REVEAL_LINES` pool |
| `src/game/managers/QuizManager.ts` | Track `consecutiveCorrect`; update `quizStreak` store; apply streak dust multiplier |
| `src/ui/stores/gameState.ts` | Export `quizStreak` writable store |

### Files Not Changed

- `src/game/managers/CelebrationManager.ts` — mastery flow is separate
- `src/game/systems/artifactDrop.ts` — drop rates are not changed
- `src/data/types.ts` — no new types needed beyond existing `Rarity`
- `server/` — no server changes
- Any audio asset files — Web Audio API synthesis used throughout
