---
status: implemented
delete-after-implementation: true
priority: ambitious
effort: M
impact: medium
owner-agent: game-logic
depends-on: none
---

# Foreground Parallax Elements

## What It Is

A sparse layer of semi-transparent foreground sprites (hanging chains, cobwebs, stalactites, crystal edges, void tendrils) positioned at the edges and corners of the combat viewport. These elements shift slightly in response to screen shake and turn transitions, and breathe gently during idle — creating a depth illusion by moving independently of the background.

## Why It Matters

The combat screen currently reads as flat: a single AI-generated background image with lighting effects. Nothing in the foreground moves except particle systems, which are diffuse and don't anchor the sense of space. Foreground overlay sprites that react to in-game events (damage shake, turn beats) give the player the visceral sense of being *inside* the dungeon rather than looking at a painted backdrop. Cost is low (static PNGs, minor tween logic); payoff is perceived production quality.

## Current State

- Backgrounds are single AI-generated images with companion depth maps.
- `DepthLightingFX` shader (`src/game/shaders/DepthLightingFX.ts`) applies Sobel normals, point lights, SSAO, fog, and parallax breathing — but the parallax breathing moves the entire background image uniformly via UV displacement; no separate foreground layer exists.
- `CombatAtmosphereSystem.ts` has dual-depth particle emitters at depth 3 (back) and depth 12 (front). Depth 13 is unoccupied — ideal for foreground sprites.
- `CombatScene.ts` drives screen shake but does not expose its current offset for downstream reactive use.
- No foreground container, no foreground sprite assets, no per-biome configuration exists.

## Implementation Spec

### Files to Modify

- `src/game/scenes/CombatScene.ts`
  - Import and instantiate `ForegroundParallaxSystem` in `create()`.
  - Expose current screen shake offset as `this.currentShakeOffset: { x: number; y: number }` (updated in `update()`), so `ForegroundParallaxSystem` can read it each frame.
  - Call `foregroundParallax.onDamage(shakeOffset)` when damage shake fires.
  - Call `foregroundParallax.onTurnTransition()` on turn-end events.
  - Call `foregroundParallax.update(delta)` in scene `update()`.

### Files to Create

**`src/game/systems/ForegroundParallaxSystem.ts`**

```
export class ForegroundParallaxSystem {
  private container: Phaser.GameObjects.Container;  // depth 13
  private elements: ForegroundElement[];
  private idleTime: number = 0;

  constructor(scene: Phaser.Scene, biomeTheme: BiomeTheme, qualityTier: QualityTier) { ... }

  update(delta: number): void    // idle breathing tick
  onDamage(shakeOffset: { x: number; y: number }): void  // reactive parallax shift
  onTurnTransition(): void       // gentle 1px sine drift over 300ms
  destroy(): void
}

interface ForegroundElement {
  sprite: Phaser.GameObjects.Image;
  basePosition: { x: number; y: number };
  idlePhaseOffset: number;       // radians, randomized per element
  currentOffset: { x: number; y: number };
}
```

- Container sits at Phaser depth 13 (above front particles at 12, below HUD/UI layer).
- On `create`, read `qualityTier` to determine element count: low = 1, mid = 2, flagship = 3.
- Select elements randomly from the biome pool — do NOT show all 4-6 every encounter; pick `elementCount` without replacement each encounter.
- Each element placed at its canonical anchor position (top-left, top-right, bottom-left, bottom-right, top-center). If fewer elements than anchor slots, choose anchors that balance visual weight (top-left + bottom-right preferred pair for 2 elements).

**`src/data/foregroundElements.ts`**

```typescript
export interface ForegroundElementConfig {
  key: string;           // Phaser texture key
  anchorSlot: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
  alpha: number;         // 0.3-0.6
  scale: number;         // relative to native 64-128px size
}

export const FOREGROUND_ELEMENTS: Record<BiomeTheme, ForegroundElementConfig[]> = {
  dust: [
    { key: 'fg_cobweb',        anchorSlot: 'top-left',     alpha: 0.35, scale: 1.0 },
    { key: 'fg_chain_hang',    anchorSlot: 'top-right',    alpha: 0.45, scale: 1.0 },
    { key: 'fg_rock_crack',    anchorSlot: 'bottom-left',  alpha: 0.40, scale: 1.0 },
    { key: 'fg_moss_drip',     anchorSlot: 'bottom-right', alpha: 0.30, scale: 1.0 },
  ],
  embers: [
    { key: 'fg_ash_edge',      anchorSlot: 'top-left',     alpha: 0.40, scale: 1.0 },
    { key: 'fg_cracked_stone', anchorSlot: 'top-right',    alpha: 0.50, scale: 1.0 },
    { key: 'fg_heat_shimmer',  anchorSlot: 'bottom-center',alpha: 0.25, scale: 1.2 },
  ],
  ice: [
    { key: 'fg_icicle_top',    anchorSlot: 'top-center',   alpha: 0.55, scale: 1.0 },
    { key: 'fg_frost_edge',    anchorSlot: 'top-left',     alpha: 0.35, scale: 1.0 },
    { key: 'fg_crystal_shard', anchorSlot: 'bottom-right', alpha: 0.45, scale: 1.0 },
  ],
  arcane: [
    { key: 'fg_rune_edge',     anchorSlot: 'top-right',    alpha: 0.40, scale: 1.0 },
    { key: 'fg_magic_residue', anchorSlot: 'bottom-left',  alpha: 0.35, scale: 1.0 },
    { key: 'fg_arcane_tendril',anchorSlot: 'top-left',     alpha: 0.30, scale: 1.0 },
  ],
  void: [
    { key: 'fg_void_tendril',  anchorSlot: 'top-left',     alpha: 0.50, scale: 1.0 },
    { key: 'fg_reality_crack', anchorSlot: 'bottom-right', alpha: 0.45, scale: 1.0 },
    { key: 'fg_dark_seep',     anchorSlot: 'top-right',    alpha: 0.40, scale: 1.0 },
  ],
};
```

### Technical Details

**Idle breathing drift (update loop):**
```
idleTime += delta;
for each element:
  offsetX = sin(idleTime * 0.000785 + element.idlePhaseOffset) * 0.5  // 8s period, ±0.5px
  offsetY = cos(idleTime * 0.000628 + element.idlePhaseOffset) * 0.3  // 10s period, ±0.3px
  sprite.setPosition(baseX + offsetX, baseY + offsetY)
```
Period: `2π / 0.000785 ≈ 8000ms`. The per-element phase offset (random at spawn, range 0–2π) prevents uniform lockstep oscillation.

**Reactive parallax on damage shake:**
```
onDamage(shakeOffset):
  foregroundShift = shakeOffset * 1.5  // closer objects move more in same direction
  for each element:
    scene.tweens.add({
      targets: element.sprite,
      x: element.baseX + foregroundShift.x,
      y: element.baseY + foregroundShift.y,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut'
    })
```
The `shakeOffset` values from `CombatScene` are already in pixels. At 2-4px shake magnitude, the 1.5× multiplier produces 3-6px foreground shift — perceptible but not distracting.

**Turn transition drift:**
```
onTurnTransition():
  for each element:
    scene.tweens.add({
      targets: element.sprite,
      x: element.sprite.x + 1,
      duration: 150,
      yoyo: true,
      ease: 'Sine.easeInOut'
    })
```

**Sprite asset pipeline:**
- 64×128px or 128×128px pixel art PNGs, transparent backgrounds.
- ComfyUI SDXL prompt template: `"[element name], dungeon foreground decoration, dark fantasy, pixel art, transparent background, no background, silhouette, 8-bit style, gritty texture"`
- Sprites trimmed to minimal bounding box to avoid phantom alpha regions affecting touch targets.
- Named `fg_[name].png`, placed in `src/assets/sprites/foreground/`.
- Registered in `CombatScene.preload()` via `this.load.image('fg_cobweb', 'assets/sprites/foreground/fg_cobweb.png')` etc.

### Integration Points

- `CombatScene.create()`: After atmosphere and particles are set up, instantiate `ForegroundParallaxSystem(this, currentTheme, qualityTier)`.
- `CombatScene.update(time, delta)`: Call `foregroundParallax.update(delta)`.
- Screen shake callback (wherever `cameras.main.shake()` is called in `CombatScene`): also call `foregroundParallax.onDamage(shakeOffsetAtPeak)`. If shake API doesn't expose offset directly, calculate: `shakeOffset = { x: (Math.random() - 0.5) * shakeMagnitude * 2, y: 0 }`.
- Turn end event (wherever `TurnManager` fires turn-end): call `foregroundParallax.onTurnTransition()`.
- `CombatScene` cleanup / `shutdown` event: call `foregroundParallax.destroy()`.

### Reduce-Motion Handling

When `prefersReducedMotion()` returns `true`:
- Sprites are still created and displayed at their base positions with normal alpha.
- `update()` skips all idle breathing calculations — positions stay at `basePosition`.
- `onDamage()` is a no-op (no tween fired).
- `onTurnTransition()` is a no-op.
- Effect: decorative foreground depth is preserved; all motion is eliminated.

### Device Tier Handling

| Tier | Element Count | Idle Breathing | Reactive Shift |
|---|---|---|---|
| Low | 1 | Disabled | Disabled |
| Mid | 2 | Enabled | Enabled |
| Flagship | 3 | Enabled | Enabled |

Tier detection via existing `getDeviceTier()` utility (or equivalent in `CombatAtmosphereSystem` — match whichever pattern is already used). Pass result into `ForegroundParallaxSystem` constructor.

## Verification

1. Visual inspection across all 5 biome themes (dust/embers/ice/arcane/void) — verify element set matches biome, sprites don't clip into center of screen, alpha renders correctly.
2. Verify sprites at depth 13 sit above front particles (depth 12) and below HUD overlay.
3. Trigger damage: confirm foreground elements shift visibly in the shake direction, then return.
4. Observe idle for 15 seconds: confirm gentle drift is perceptible but not distracting, no lockstep oscillation across elements.
5. Confirm element count respects device tier.
6. Reduce-motion mode: confirm sprites are visible and static, no movement at all.
7. Confirm no enemy sprite or card hand UI is obscured — foreground elements stay within 120px of screen edges.

## Effort Estimate

**M (Medium) — 2-3 days**
- Day 1: Implement `ForegroundParallaxSystem.ts`, `foregroundElements.ts`, wire into `CombatScene`.
- Day 2: Generate 12-15 foreground sprite PNGs via ComfyUI pipeline, integrate assets.
- Day 3: Tune alpha/scale/timing per biome via visual inspection; add reduce-motion and tier gating.
