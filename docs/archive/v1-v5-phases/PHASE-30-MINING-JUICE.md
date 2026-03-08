# Phase 30: Mining Juice & Game Feel

**Status**: Not Started
**Dependencies**: Phase 7 (Visual Engine), Phase 8 (Mine Gameplay), Phase 9 (Biome Expansion)
**Estimated Complexity**: High — 7 sub-phases, primarily Phaser scene work with new systems

---

## Overview

Phase 30 elevates the core mining loop from "functional" to "feels amazing." The current systems are architecturally sound but lack the sensory feedback layers that make mobile mining games satisfying on a per-tap level. This phase implements the full stack of game feel: crack overlays that communicate block health at a glance, a choreographed block-break sequence with freeze-frame and shatter, physically plausible loot arcs with magnetic pull to the HUD, a Perlin-noise-based three-tier screen shake system, per-block-type impact profiles with bespoke particles and sounds, richer idle block animations, and progressive damage scaling that rewards sustained aggression.

### Design Decision References

- **DD-V2-013**: Loot pop physics — parabolic arc, bounce, magnetic vacuum to HUD (600–900 ms total)
- **DD-V2-251**: Block break sequence — 50 ms freeze-frame, radial burst, 4-quadrant shatter, loot physics
- **DD-V2-252**: Per-block impact profiles — each block type has unique particles, sound, shake, crack style
- **DD-V2-253**: Progressive satisfaction — particles, shake, crack intensity scale linearly with damage dealt
- **DD-V2-254**: Screen shake — 3 Perlin-noise tiers: micro (2 px), medium (4 px), heavy (8 px); accessibility slider
- **DD-V2-012**: Block idle animations — crystals glint, artifacts glow, gas swirls, lava pulses (2–4 frames)
- **DD-V2-009**: 4 crack stages at 25 %, 50 %, 75 %, 90 % health thresholds

### Current State of Relevant Systems

| File | Lines | Status |
|---|---|---|
| `src/game/systems/ImpactSystem.ts` | 189 | Basic — shake, flash, haptic. No freeze-frame or shatter. |
| `src/game/systems/LootPopSystem.ts` | 189 | Basic — parabolic arc without bounce. Rarity effects exist but no HUD counter flash. |
| `src/game/systems/ParticleSystem.ts` | 515 | Solid foundation. Per-block break configs, ambient emitters, O2 edge warning. |
| `src/game/systems/BlockAnimSystem.ts` | 104 | Exists — time-based frame cycling. No per-tile phase offsets for idle anims. |
| `src/game/systems/AnimatedTileSystem.ts` | 95 | Per-tile phase offsets work. Only used for lava/gas/mineral shimmer. |
| `src/game/scenes/MineScene.ts` | 3 043 | `drawCrackOverlay()` partially implemented — sprite-based crack stages 1–4 exist but material-specific tinting is minimal. `drawLegacyCracks()` fallback exists. |
| `src/assets/sprites[-hires]/tiles/` | — | `crack_stage1–4.png` AND `crack_small.png` / `crack_large.png` all present in both resolutions. |

### What This Phase Does NOT Change

- Fact/quiz systems
- Save/load logic
- Biome generation
- Camera system architecture
- Audio file assets (uses Web Audio API synthesis from Phase 17)
- Any Svelte UI components outside of HUD counter flash

---

## Sub-Phases

---

### 30.1 — Crack Overlay System Overhaul

**Goal**: Replace the current minimal tint-based crack overlay with a full per-material crack system that communicates block health stage at a glance.

#### Current Behaviour

`MineScene.drawCrackOverlay()` (line 684) selects `crack_stage1`–`crack_stage4` sprites based on damage threshold and applies a simple tint:
- Dirt/SoftRock → `0x6b3a2a`
- LavaBlock → `0xcc2200`
- GasPocket → `0x224422`
- Everything else → `0x2a2a2a`

The crack sprites (`crack_stage1.png`–`crack_stage4.png`) exist in both `src/assets/sprites/tiles/` and `src/assets/sprites-hires/tiles/` but are 32 × 32 / 256 × 256 generic alpha masks — they do not vary by material.

#### Desired Behaviour

Four crack stages at precisely defined health thresholds, each with distinct visual weight:

| Stage | Trigger (health remaining) | Visual Character |
|---|---|---|
| 1 (Hairline) | 75 % | Single thin line from one edge, barely visible |
| 2 (Fracture) | 50 % | 2–3 branching lines, 1 px wide |
| 3 (Severe) | 25 % | 4–6 lines + small corner chip fragments |
| 4 (Crumbling) | 10 % | Dense web pattern + multiple chip fragments + subtle alpha flash |

Five material categories each receive a distinct crack color palette applied as a sprite tint:

| Material Category | BlockTypes | Tint Color | Crack Style Note |
|---|---|---|---|
| Soil | Dirt, SoftRock | `0x8c6342` (warm brown) | Crumble chunks — irregular break edges |
| Rock | Stone, HardRock, Unbreakable | `0x2e2e2e` (charcoal) | Sharp straight lines, minimal branching |
| Crystal | MineralNode (crystal/geode/essence tier) | `0x88ccff` (ice blue) | Web pattern — dense radiating lines from center |
| Lava | LavaBlock | `0xdd3300` (molten red) | Glowing orange crack fill via additive blend |
| Gas | GasPocket | `0x33ff44` (acid green) | Irregular, swirling crack paths |
| Soft Special | OxygenCache, QuizGate, UpgradeCrate | `0xffd700` (gold) | Diagonal hash marks |
| Default | Everything else | `0x303030` (dark grey) | 2 straight cracks, no branching |

#### Implementation Details

**File to modify**: `src/game/scenes/MineScene.ts` — `drawCrackOverlay()` method (line 684).

**Step 1**: Define a `CrackMaterialCategory` type and lookup function near the top of `MineScene.ts` (before the class declaration):

```typescript
/** Maps a BlockType to its crack material visual category. */
type CrackMaterialCategory = 'soil' | 'rock' | 'crystal' | 'lava' | 'gas' | 'softSpecial' | 'default'

const CRACK_MATERIAL_TINTS: Record<CrackMaterialCategory, number> = {
  soil:        0x8c6342,
  rock:        0x2e2e2e,
  crystal:     0x88ccff,
  lava:        0xdd3300,
  gas:         0x33ff44,
  softSpecial: 0xffd700,
  default:     0x303030,
}

function getCrackCategory(cell: MineCell): CrackMaterialCategory {
  switch (cell.type) {
    case BlockType.Dirt:
    case BlockType.SoftRock:
      return 'soil'
    case BlockType.Stone:
    case BlockType.HardRock:
    case BlockType.Unbreakable:
      return 'rock'
    case BlockType.MineralNode: {
      const tier = cell.content?.mineralType
      return (tier === 'crystal' || tier === 'geode' || tier === 'essence') ? 'crystal' : 'default'
    }
    case BlockType.LavaBlock:
      return 'lava'
    case BlockType.GasPocket:
      return 'gas'
    case BlockType.OxygenCache:
    case BlockType.QuizGate:
    case BlockType.UpgradeCrate:
      return 'softSpecial'
    default:
      return 'default'
  }
}
```

**Step 2**: Rewrite `drawCrackOverlay()`:

```typescript
private drawCrackOverlay(cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
  if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) return

  const healthPct = cell.hardness / cell.maxHardness   // 1.0 = pristine, 0.0 = destroyed
  if (healthPct > 0.75) return                          // Below stage 1 threshold

  const cx = px + TILE_SIZE * 0.5
  const cy = py + TILE_SIZE * 0.5

  // Determine crack stage
  let stageKey: string
  if (healthPct > 0.50) {
    stageKey = 'crack_stage1'
  } else if (healthPct > 0.25) {
    stageKey = 'crack_stage2'
  } else if (healthPct > 0.10) {
    stageKey = 'crack_stage3'
  } else {
    stageKey = 'crack_stage4'
  }

  // Graceful fallback to procedural legacy cracks
  if (!this.textures.exists(stageKey)) {
    const damagePercent = 1 - healthPct
    this.drawLegacyCracks(px, py, tileX, tileY, damagePercent)
    return
  }

  const category = getCrackCategory(cell)
  const tintColor = CRACK_MATERIAL_TINTS[category]

  // Alpha scales with damage: 0.55 at stage 1 → 0.92 at stage 4
  const damageDepth = 1 - healthPct                     // 0 = pristine, 1 = destroyed
  const crackAlpha = 0.40 + damageDepth * 0.52

  const crackSprite = this.getPooledSprite(stageKey, cx, cy)
  crackSprite.setDepth(6)
  crackSprite.setAlpha(crackAlpha)
  crackSprite.setTint(tintColor)

  // Lava cracks: additive blending to simulate inner glow
  if (category === 'lava') {
    // Blending mode override; Phaser uses BLEND_MODE_ADD = 1
    crackSprite.setBlendMode(Phaser.BlendModes.ADD)
    crackSprite.setAlpha(crackAlpha * 0.7)   // ADD mode is brighter, reduce alpha
  } else {
    crackSprite.setBlendMode(Phaser.BlendModes.NORMAL)
  }

  // Crystal cracks: stage 4 gets an extra web sparkle overlay
  if (category === 'crystal' && healthPct <= 0.10) {
    // Pulse the crystal crack alpha for extra urgency
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now / 120)
    crackSprite.setAlpha(crackAlpha * pulse)
  }

  // Stage 4: add a small chip fragment overlay on overlayGraphics
  if (healthPct <= 0.10) {
    const chipSeed = tileX * 7 + tileY * 13
    // Two chip fragments in opposite corners
    const chipSize = TILE_SIZE * 0.12
    this.overlayGraphics.fillStyle(tintColor, 0.60)
    const c1x = px + ((chipSeed * 3) % (TILE_SIZE / 2 - chipSize))
    const c1y = py + ((chipSeed * 7) % (TILE_SIZE / 2 - chipSize))
    this.overlayGraphics.fillRect(c1x, c1y, chipSize, chipSize)
    const c2x = px + TILE_SIZE - chipSize - ((chipSeed * 5) % (TILE_SIZE / 2 - chipSize))
    const c2y = py + TILE_SIZE - chipSize - ((chipSeed * 11) % (TILE_SIZE / 2 - chipSize))
    this.overlayGraphics.fillRect(c2x, c2y, chipSize, chipSize)
  }
}
```

**Step 3**: Add a `CrackSystem` class in a new file `src/game/systems/CrackSystem.ts` for future extensibility (future material-specific sprite atlas support). For now it wraps the helper functions:

```typescript
// src/game/systems/CrackSystem.ts

import { BlockType } from '../../data/types'
import type { MineCell } from '../../data/types'

/** Material-based visual category for crack rendering */
export type CrackMaterialCategory = 'soil' | 'rock' | 'crystal' | 'lava' | 'gas' | 'softSpecial' | 'default'

/** Crack stage descriptor */
export interface CrackStage {
  /** Sprite key to use for this stage */
  spriteKey: string
  /** Health percentage threshold — show this stage when health is AT OR BELOW this value */
  healthThreshold: number
  /** Base alpha multiplier for this stage */
  baseAlpha: number
}

/** Ordered from most severe to least severe (for threshold lookup) */
export const CRACK_STAGES: CrackStage[] = [
  { spriteKey: 'crack_stage4', healthThreshold: 0.10, baseAlpha: 0.92 },
  { spriteKey: 'crack_stage3', healthThreshold: 0.25, baseAlpha: 0.78 },
  { spriteKey: 'crack_stage2', healthThreshold: 0.50, baseAlpha: 0.65 },
  { spriteKey: 'crack_stage1', healthThreshold: 0.75, baseAlpha: 0.55 },
]

export const CRACK_MATERIAL_TINTS: Record<CrackMaterialCategory, number> = {
  soil:        0x8c6342,
  rock:        0x2e2e2e,
  crystal:     0x88ccff,
  lava:        0xdd3300,
  gas:         0x33ff44,
  softSpecial: 0xffd700,
  default:     0x303030,
}

/**
 * Returns the crack stage and material category for a given cell's current health.
 * Returns null if no crack should be shown (health > 75 %).
 */
export function getCrackInfo(cell: MineCell): {
  stage: CrackStage
  category: CrackMaterialCategory
  tintColor: number
} | null {
  if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) {
    return null
  }
  const healthPct = cell.hardness / cell.maxHardness
  const stage = CRACK_STAGES.find(s => healthPct <= s.healthThreshold)
  if (!stage) return null   // No stage matches (health > 75 %)

  const category = getCrackCategory(cell)
  return { stage, category, tintColor: CRACK_MATERIAL_TINTS[category] }
}

/**
 * Classifies a MineCell into a CrackMaterialCategory.
 */
export function getCrackCategory(cell: MineCell): CrackMaterialCategory {
  switch (cell.type) {
    case BlockType.Dirt:
    case BlockType.SoftRock:
      return 'soil'
    case BlockType.Stone:
    case BlockType.HardRock:
    case BlockType.Unbreakable:
      return 'rock'
    case BlockType.MineralNode: {
      const tier = cell.content?.mineralType
      return (tier === 'crystal' || tier === 'geode' || tier === 'essence') ? 'crystal' : 'default'
    }
    case BlockType.LavaBlock:
      return 'lava'
    case BlockType.GasPocket:
      return 'gas'
    case BlockType.OxygenCache:
    case BlockType.QuizGate:
    case BlockType.UpgradeCrate:
      return 'softSpecial'
    default:
      return 'default'
  }
}
```

#### Acceptance Criteria for 30.1

- [ ] Crack sprites appear at exactly 75 %, 50 %, 25 %, 10 % health (no sooner, no later)
- [ ] Dirt blocks show warm brown tint (`0x8c6342`)
- [ ] Stone/HardRock blocks show charcoal tint (`0x2e2e2e`)
- [ ] Crystal-tier MineralNode blocks show ice blue tint (`0x88ccff`)
- [ ] LavaBlock cracks render with Phaser `ADD` blend mode (inner glow appearance)
- [ ] GasPocket cracks show acid green tint
- [ ] Stage 4 (≤10 % health) displays 2 chip fragment rectangles in corners
- [ ] Crystal stage 4 pulses in alpha (visible with naked eye)
- [ ] `CrackSystem.ts` created and exported; `getCrackInfo()` and `getCrackCategory()` are exported pure functions
- [ ] Fallback to `drawLegacyCracks()` when sprite textures are absent
- [ ] TypeScript: zero new `any` casts, all types explicit

---

### 30.2 — Block Break Sequence (Freeze-Frame + Shatter)

**Goal**: The moment a block is destroyed, a 5-frame choreographed sequence plays that makes the destruction feel impactful and rewarding.

#### Sequence Timeline (DD-V2-251)

```
t=0 ms    FREEZE-FRAME begins
           - Phaser time scale → 0 (freezes tween timeline)
           - Player sprite frozen in mid-swing pose
           - All animations pause

t=50 ms   FREEZE-FRAME ends, time scale → 1
           - Radial burst particle explosion from block center (8–12 material-colored particles)
           - Block sprite hidden (cell type is now Empty)

t=50 ms   SHATTER begins simultaneously with radial burst
           - 4 shatter-piece sprites spawn at block center
           - Each piece is a 16×16 region of the original block sprite (quadrants: TL, TR, BL, BR)
           - Phaser tweens drive each piece outward at 45° angles + slight vertical bias
           - Pieces: scale 1.0 → 0, alpha 1.0 → 0, fly out 48–64 px

t=250 ms  SHATTER pieces complete (200 ms duration)
           - Pieces destroyed (returned to pool)

t=100 ms  LOOT ARC begins (staggered if multiple items)
           - Loot sprites spawn and begin physics arc (see 30.3)

t=~900 ms  Full sequence complete (loot reaches HUD)
```

#### Implementation Details

**New file**: `src/game/systems/BlockBreakSequence.ts`

This class orchestrates the entire break sequence. MineScene calls it instead of directly calling `spawnBreakParticles` and `lootPop.popLoot`.

```typescript
// src/game/systems/BlockBreakSequence.ts

import Phaser from 'phaser'
import { BlockType } from '../../data/types'
import type { MineCell } from '../../data/types'
import type { ParticleSystem } from './ParticleSystem'

/**
 * Configuration for a single block break sequence.
 * Passed by MineScene after a block is destroyed.
 */
export interface BlockBreakConfig {
  /** Grid coordinates of destroyed block */
  tileX: number
  tileY: number
  /** World pixel center of the block */
  worldX: number
  worldY: number
  /** Block type that was destroyed */
  blockType: BlockType
  /** Original MineCell data (before destruction) — used for sprite key lookup */
  blockSpriteKey: string
  /** Tile size in pixels */
  tileSize: number
  /** Called after freeze-frame + radial burst; loot pop should start here */
  onBurstComplete: () => void
  /** Called after all shatter pieces have despawned */
  onShatterComplete?: () => void
}

/** Sprite pool entry for shatter pieces */
interface ShatterPiece {
  sprite: Phaser.GameObjects.Image
  inUse: boolean
}

/**
 * Coordinates the 5-frame block break sequence:
 * freeze-frame → radial burst → 4-quadrant shatter → fade.
 *
 * Performance budget: max 4 simultaneous sequences.
 * Shatter pieces are pooled (max 16 in pool at once: 4 sequences × 4 pieces each).
 */
export class BlockBreakSequence {
  private scene: Phaser.Scene
  private particleSystem: ParticleSystem
  private shatterPool: ShatterPiece[] = []
  private activeSequences = 0
  private readonly MAX_CONCURRENT = 4
  private readonly POOL_SIZE = 16   // 4 concurrent * 4 pieces

  constructor(scene: Phaser.Scene, particleSystem: ParticleSystem) {
    this.scene = scene
    this.particleSystem = particleSystem
    this.initPool()
  }

  /**
   * Pre-allocate shatter piece pool using a white 16×16 placeholder texture.
   */
  private initPool(): void {
    // Ensure a 16×16 white texture exists for pool sprites
    if (!this.scene.textures.exists('__shatter_piece__')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false)
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 16, 16)
      g.generateTexture('__shatter_piece__', 16, 16)
      g.destroy()
    }

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const sprite = this.scene.add.image(0, 0, '__shatter_piece__')
      sprite.setVisible(false)
      sprite.setDepth(15)
      this.shatterPool.push({ sprite, inUse: false })
    }
  }

  /**
   * Acquire a shatter piece from the pool. Returns null if pool is exhausted.
   */
  private acquirePiece(): ShatterPiece | null {
    const piece = this.shatterPool.find(p => !p.inUse)
    if (piece) piece.inUse = true
    return piece ?? null
  }

  /**
   * Return a shatter piece to the pool.
   */
  private releasePiece(piece: ShatterPiece): void {
    piece.sprite.setVisible(false)
    piece.sprite.setScale(1)
    piece.sprite.setAlpha(1)
    piece.inUse = false
  }

  /**
   * Play the full break sequence for a destroyed block.
   * Silently degrades if concurrency limit is reached.
   */
  play(config: BlockBreakConfig): void {
    if (this.activeSequences >= this.MAX_CONCURRENT) {
      // Skip visual sequence; still fire the callback so loot spawns
      config.onBurstComplete()
      return
    }

    this.activeSequences++

    // PHASE 1: Freeze-frame — set Phaser time scale to 0 for 50 ms
    this.scene.time.timeScale = 0
    this.scene.time.delayedCall(50, () => {
      // Phaser's delayedCall is NOT affected by timeScale when using real-time;
      // using scene.game.time for real-time delays:
    }, [], this)

    // NOTE: Phaser's this.scene.time.delayedCall respects timeScale.
    // To guarantee a real-time 50 ms freeze, use game.time instead:
    this.scene.game.time.addEvent({
      delay: 50,   // real-time milliseconds
      callback: () => {
        // Unfreeze
        this.scene.time.timeScale = 1

        // PHASE 2: Radial burst particles
        this.particleSystem.emitBreak(config.blockType, config.worldX, config.worldY)

        // PHASE 3: Shatter pieces
        this.spawnShatterPieces(config)

        // Notify caller that burst is done — loot arc should start now
        config.onBurstComplete()

        this.activeSequences--
      },
      callbackScope: this,
    })
  }

  /**
   * Spawn 4 quadrant shatter pieces that fly outward and fade.
   * Each piece uses a crop of the original block texture (if available)
   * or falls back to a colored square.
   */
  private spawnShatterPieces(config: BlockBreakConfig): void {
    const { worldX, worldY, blockSpriteKey, tileSize, blockType } = config

    // 4 outward vectors: TL, TR, BL, BR (at 45° angles)
    const vectors = [
      { dx: -1, dy: -1 },   // Top-left
      { dx:  1, dy: -1 },   // Top-right
      { dx: -1, dy:  1 },   // Bottom-left
      { dx:  1, dy:  1 },   // Bottom-right
    ]

    // Per-material tint for shatter pieces
    const pieceTint = this.getShatterTint(blockType)
    const flyDistance = 48 + Math.random() * 16   // 48–64 px

    vectors.forEach(({ dx, dy }) => {
      const piece = this.acquirePiece()
      if (!piece) return

      // Use block sprite if it exists, otherwise white placeholder
      const texKey = this.scene.textures.exists(blockSpriteKey)
        ? blockSpriteKey
        : '__shatter_piece__'

      piece.sprite.setTexture(texKey)
      piece.sprite.setPosition(worldX, worldY)
      piece.sprite.setDisplaySize(tileSize * 0.5, tileSize * 0.5)   // 16×16 for 32px tiles
      piece.sprite.setTint(pieceTint)
      piece.sprite.setAlpha(1)
      piece.sprite.setScale(1)
      piece.sprite.setDepth(15)
      piece.sprite.setVisible(true)

      const targetX = worldX + dx * flyDistance
      const targetY = worldY + dy * flyDistance + 8   // Slight downward gravity bias

      this.scene.tweens.add({
        targets: piece.sprite,
        x: targetX,
        y: targetY,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 200,
        ease: 'Quad.Out',
        onComplete: () => {
          this.releasePiece(piece)
          config.onShatterComplete?.()
        },
      })
    })
  }

  /**
   * Returns the tint color for shatter pieces based on block type.
   */
  private getShatterTint(blockType: BlockType): number {
    switch (blockType) {
      case BlockType.Dirt:
      case BlockType.SoftRock:  return 0x5c4033
      case BlockType.Stone:     return 0x7a7a7a
      case BlockType.HardRock:  return 0x4a4a4a
      case BlockType.MineralNode: return 0x4ecca3
      case BlockType.ArtifactNode: return 0xe94560
      case BlockType.LavaBlock: return 0xff6600
      case BlockType.GasPocket: return 0x88ff44
      case BlockType.Crystal:   return 0x88ccff
      default:                  return 0xaaaaaa
    }
  }

  /**
   * Destroy all pooled sprites. Call on scene shutdown.
   */
  destroy(): void {
    for (const piece of this.shatterPool) {
      piece.sprite.destroy()
    }
    this.shatterPool = []
  }
}
```

**Modify `MineScene.ts`**:

1. Add import: `import { BlockBreakSequence } from '../systems/BlockBreakSequence'`
2. Add private field: `private blockBreakSequence!: BlockBreakSequence`
3. In `create()`, after `this.particles = new ParticleSystem(this)` and `this.particles.init()`:
   ```typescript
   this.blockBreakSequence = new BlockBreakSequence(this, this.particles)
   ```
4. In `handleShutdown()` or scene shutdown event handler, add:
   ```typescript
   this.blockBreakSequence?.destroy()
   ```
5. Replace the block-break section in `handleMoveOrMine()` (around line 1502) where `spawnBreakParticles` and `lootPop.popLoot` are called:

```typescript
// OLD (lines 1502–1503):
// if (mineResult.destroyed) {
//   this.spawnBreakParticles(targetX * TILE_SIZE, targetY * TILE_SIZE, blockType)
//   audioManager.playSound('mine_break')

// NEW:
if (mineResult.destroyed) {
  const blockWorldX = targetX * TILE_SIZE + TILE_SIZE * 0.5
  const blockWorldY = targetY * TILE_SIZE + TILE_SIZE * 0.5
  const blockSpriteKey = this.resolveBlockSpriteKey(blockType, targetCell)

  this.blockBreakSequence.play({
    tileX: targetX,
    tileY: targetY,
    worldX: blockWorldX,
    worldY: blockWorldY,
    blockType,
    blockSpriteKey,
    tileSize: TILE_SIZE,
    onBurstComplete: () => {
      audioManager.playSound('mine_break')
      // All loot pop calls move inside onBurstComplete
      // (moved from their current positions further down in the switch/case)
    },
  })
```

6. Add helper method `resolveBlockSpriteKey(blockType, cell)` to MineScene that returns the current sprite key for a block type (reuses the same logic as `drawBlockPattern` but returns the key rather than drawing):

```typescript
/**
 * Returns the primary sprite key for a block type at the moment of destruction.
 * Used by BlockBreakSequence to sample shatter piece textures.
 */
private resolveBlockSpriteKey(blockType: BlockType, cell: MineCell): string {
  switch (blockType) {
    case BlockType.Dirt:     return 'tile_dirt'
    case BlockType.SoftRock: return 'tile_soft_rock'
    case BlockType.Stone:    return 'tile_stone'
    case BlockType.HardRock: return 'tile_hard_rock'
    case BlockType.MineralNode: {
      const tier = cell.content?.mineralType ?? 'dust'
      return `block_mineral_${tier}`
    }
    case BlockType.ArtifactNode: return 'block_artifact'
    case BlockType.LavaBlock:    return 'block_lava'
    case BlockType.GasPocket:    return 'block_gas'
    case BlockType.OxygenCache:  return 'block_oxygen_cache'
    case BlockType.DescentShaft: return 'block_descent_shaft'
    default: return 'tile_stone'   // safe fallback
  }
}
```

#### Performance Notes

- `scene.game.time.addEvent({ delay: 50 })` uses real-time milliseconds and is not affected by `scene.time.timeScale = 0`
- Max 4 concurrent break sequences; 5th and beyond skip the visual and fire `onBurstComplete` immediately
- Shatter piece pool is pre-allocated: 16 sprites created once at scene init, never `add.image()` during gameplay
- Time scale freeze is at scene level (`this.scene.time.timeScale`), not game level — other scenes (DOM UI) are unaffected

#### Acceptance Criteria for 30.2

- [ ] Block destruction triggers a 50 ms time-scale=0 freeze that visibly pauses animations
- [ ] Immediately after freeze: radial particle burst fires from block center (8–12 particles)
- [ ] 4 shatter pieces fly outward at 45° angles and fade over 200 ms
- [ ] Shatter pieces use block's actual sprite as texture (tinted)
- [ ] Loot arcs begin after freeze-frame resolves (via `onBurstComplete`)
- [ ] Maximum 4 simultaneous break sequences enforced
- [ ] No sprites are created with `add.image()` during runtime — all from pool
- [ ] `BlockBreakSequence` file created with full JSDoc, no TypeScript errors
- [ ] `destroy()` called correctly on scene shutdown

---

### 30.3 — Loot Pop Physics (Full DD-V2-013 Implementation)

**Goal**: Overhaul the existing `LootPopSystem.popLoot()` to implement the full DD-V2-013 spec: realistic parabolic arc, one bounce with energy retention, magnetic vacuum phase, HUD counter flash on receipt.

#### Sequence Timeline (DD-V2-013)

```
t=0 ms     LAUNCH
            - Item sprite spawns at block center (worldX, worldY)
            - Randomized launch: angle 60–120° (mostly upward), arc determined by tween

t=0–250ms  ARC PHASE (Phaser tween: ease Quad.Out)
            - X: moves ±24 px (randomized left/right)
            - Y: rises 2–3 tiles (64–96 px upward) from spawn point
            - Scale: 1.0 throughout

t=250ms    BOUNCE PEAK
            - Gravity phase begins
            - Y velocity reverses: sprite falls back down

t=250–400ms DESCENT (Phaser tween: ease Quad.In)
            - Falls to resting position (worldY + 4 px)
            - Scale: 1.0 → 1.05 (slight squash on approach to ground)

t=400ms    BOUNCE IMPACT
            - Y: bounces upward by 12–16 px (40% energy from full arc height)
            - Scale: 1.05 → 0.9 (squash on impact)
            - Scale returns to 1.0 over 60 ms

t=400–460ms BOUNCE (Phaser tween: ease Sine.Out)
            - Small upward bounce

t=460–520ms SETTLE (Phaser tween: ease Quad.In)
            - Falls back to resting Y

t=520ms    MAGNETIC VACUUM begins
            - Target changes from resting position to HUD counter position
            - Acceleration increases exponentially (ease: Quad.In)
            - Scale: 1.0 → 0 over 350 ms

t=870ms    HUD FLASH fires
            - `onComplete` callback fires
            - HUD counter receives +N pulse animation (gold expand/contract)
```

**Total duration**: 520 + 350 = 870 ms ≈ within the 600–900 ms spec.

#### Multi-Item Stagger

When multiple items drop from a single block, each subsequent item is delayed by 50 ms:
- Item 1: starts at t=0
- Item 2: starts at t=50 ms
- Item 3: starts at t=100 ms

#### Modified `LootPopSystem.ts`

Replace the existing `popLoot()` method completely. The new signature is backward-compatible:

```typescript
export interface LootPopConfig {
  spriteKey: string
  worldX: number
  worldY: number
  /** Target world position (player center or HUD element in screen-space via camera unproject) */
  targetX: number
  targetY: number
  rarity?: Rarity
  /** Stagger delay in ms before this item begins its arc (for multi-drop) */
  staggerMs?: number
  /** Called when item reaches HUD counter (loot is "collected") */
  onComplete?: () => void
  /** Called just before magnetic vacuum begins (good time to play a sound) */
  onBounceSettled?: () => void
}

/**
 * Spawn a loot item with the full DD-V2-013 physics sequence:
 * parabolic arc → bounce → magnetic vacuum → HUD flash.
 */
popLoot(config: LootPopConfig): void {
  const delay = config.staggerMs ?? 0

  this.scene.time.delayedCall(delay, () => {
    this._executePopLoot(config)
  })
}

private _executePopLoot(config: LootPopConfig): void {
  const { spriteKey, worldX, worldY, targetX, targetY, rarity, onComplete, onBounceSettled } = config

  // Texture validation
  const texKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'block_mineral_dust'
  if (!this.scene.textures.exists(texKey)) {
    onComplete?.()
    return
  }

  const sprite = this.scene.add.image(worldX, worldY, texKey)
  sprite.setDisplaySize(16, 16)
  sprite.setDepth(20)
  this.activePops.push(sprite)

  // Randomize arc: left or right, height 2–3 tiles (64–96 px)
  const arcOffsetX = (Math.random() - 0.5) * 48   // -24 to +24 px
  const arcHeight = 64 + Math.random() * 32         // 64–96 px

  const peakX = worldX + arcOffsetX
  const peakY = worldY - arcHeight

  // PHASE 1: Rise to peak (Quad.Out, 250 ms)
  this.scene.tweens.add({
    targets: sprite,
    x: peakX,
    y: peakY,
    ease: 'Quad.Out',
    duration: 250,
    onComplete: () => {

      // PHASE 2: Fall to ground (Quad.In, 150 ms)
      const restY = worldY + 4
      this.scene.tweens.add({
        targets: sprite,
        x: peakX,
        y: restY,
        ease: 'Quad.In',
        duration: 150,
        onComplete: () => {

          // BOUNCE IMPACT: squash scale
          this.scene.tweens.add({
            targets: sprite,
            scaleX: 1.4,
            scaleY: 0.7,
            duration: 40,
            ease: 'Quad.Out',
            yoyo: false,
            onComplete: () => {

              // PHASE 3: Bounce upward (Sine.Out, 60 ms)
              const bounceHeight = arcHeight * 0.4   // 40% energy retention
              this.scene.tweens.add({
                targets: sprite,
                y: restY - bounceHeight,
                scaleX: 1.0,
                scaleY: 1.0,
                ease: 'Sine.Out',
                duration: 60,
                onComplete: () => {

                  // PHASE 4: Settle (Quad.In, 60 ms)
                  this.scene.tweens.add({
                    targets: sprite,
                    y: restY,
                    ease: 'Quad.In',
                    duration: 60,
                    onComplete: () => {

                      // Notify caller: bounce settled, loot visually at rest
                      onBounceSettled?.()

                      // PHASE 5: Magnetic vacuum toward HUD (Quad.In, 350 ms)
                      this.scene.tweens.add({
                        targets: sprite,
                        x: targetX,
                        y: targetY,
                        scaleX: 0,
                        scaleY: 0,
                        ease: 'Quad.In',
                        duration: 350,
                        onComplete: () => {
                          sprite.destroy()
                          const idx = this.activePops.indexOf(sprite)
                          if (idx >= 0) this.activePops.splice(idx, 1)
                          onComplete?.()
                        },
                      })
                    },
                  })
                },
              })
            },
          })
        },
      })
    },
  })

  // Rarity effects fire immediately on spawn (not waiting for arc)
  this.playRarityEffect(rarity, worldX, worldY)
}
```

#### HUD Counter Flash

In MineScene, when `onComplete` fires for a mineral pop, emit a game event:

```typescript
// In the MineralNode break case, inside onBurstComplete:
this.lootPop.popLoot({
  spriteKey: `block_mineral_${mineResult.content?.mineralType ?? 'dust'}`,
  worldX: blockWorldX,
  worldY: blockWorldY,
  targetX: this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
  targetY: this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
  staggerMs: 0,
  onComplete: () => {
    // Fire HUD flash event with amount
    this.game.events.emit('loot-collected-hud-flash', {
      type: mineResult.content?.mineralType ?? 'dust',
      amount: mineralAmount,
    })
  },
})
```

In the Svelte HUD component (`HubView.svelte` or the mineral counter component), listen for `loot-collected-hud-flash` and play a CSS animation:

```typescript
// In HUD component onMount:
const game = GameManager.getInstance().getGame()
game?.events.on('loot-collected-hud-flash', (data: { type: string; amount: number }) => {
  // Trigger a CSS class that runs a 300ms gold pulse keyframe
  hudFlashType = data.type
  hudFlashAmount = data.amount
  hudFlashActive = true
  setTimeout(() => { hudFlashActive = false }, 400)
})
```

```svelte
<!-- HUD mineral counter -->
<span class="mineral-count" class:hud-flash={hudFlashActive}>
  {mineralCount}
</span>
```

```css
/* app.css */
@keyframes loot-hud-flash {
  0%   { transform: scale(1);    color: #ffffff; }
  30%  { transform: scale(1.35); color: #ffd700; }
  60%  { transform: scale(1.15); color: #ffaa00; }
  100% { transform: scale(1);    color: inherit; }
}

.hud-flash {
  animation: loot-hud-flash 400ms ease-out forwards;
}
```

#### Haptic on Receipt

In the `onComplete` callback:

```typescript
onComplete: () => {
  this.game.events.emit('loot-collected-hud-flash', { ... })
  // Capacitor haptic on item receipt
  try {
    const cap = (globalThis as Record<string, unknown>).Capacitor as any
    cap?.Plugins?.Haptics?.impact({ style: 'Light' })
  } catch { /* silent */ }
}
```

#### Acceptance Criteria for 30.3

- [ ] Loot arc rises 64–96 px before falling (visually 2–3 tiles upward)
- [ ] One visible bounce with squash scale on impact
- [ ] Magnetic vacuum phase accelerates toward player position and reaches scale=0
- [ ] Total sequence duration 600–900 ms (timed with stopwatch in browser)
- [ ] Multiple items from same block stagger by 50 ms each
- [ ] HUD counter flashes gold on each item receipt (CSS animation visible)
- [ ] Capacitor haptic fires on receipt (verified on device; silently skipped on web)
- [ ] `staggerMs` parameter works correctly for multi-item drops
- [ ] Rarity effects (sparkle rings, light columns) still fire correctly
- [ ] No memory leaks: destroyed sprites removed from `activePops` array

---

### 30.4 — Screen Shake System (Perlin Noise, Three Tiers)

**Goal**: Replace the current `camera.shake()` call in `ImpactSystem.ts` with a manual Perlin-noise-based shake that has three distinct tiers, supports the accessibility slider, and respects `prefers-reduced-motion`.

#### Why Replace `camera.shake()`

Phaser's built-in `camera.shake()` uses random jitter at each frame. This produces an unpleasant stuttery feel. Perlin noise (or its 1D equivalent, Simplex noise) produces smooth continuous motion that feels like physical vibration rather than screen static.

#### Shake Tiers (DD-V2-254)

| Tier | Name | Amplitude | Duration | Triggers |
|---|---|---|---|---|
| Micro | mining impact | 2 px | 100 ms | Every pickaxe hit on any block |
| Medium | hazard/special | 4 px | 200 ms | Hazard damage, special block break (ArtifactNode, RelicShrine, OxygenCache) |
| Heavy | seismic | 8 px | 400 ms | Earthquake, boss encounter, legendary/mythic find |

**Rule: latest shake replaces current if stronger tier.** A medium shake in progress is interrupted and replaced by a heavy shake. A micro shake during a medium shake is ignored (lower priority).

#### Perlin Noise Implementation

Full Phaser dependency on `pnoise` libraries is undesirable. A single-dimension smooth noise function sufficient for screen shake can be implemented without dependencies:

```typescript
/**
 * Simple 1D value noise for screen shake.
 * Returns a value in the range [-1, 1] that changes smoothly over time.
 * @param t - Time value (seconds or fractional)
 * @param seed - Per-axis seed to decorrelate X and Y
 */
function smoothNoise1D(t: number, seed: number): number {
  // Interpolate between seeded random values at integer lattice points
  const ti = Math.floor(t)
  const tf = t - ti   // fractional part
  const smoothT = tf * tf * (3 - 2 * tf)   // smoothstep

  // Hash lattice points to pseudo-random values
  const hash = (n: number) => {
    let x = Math.sin((n + seed) * 127.1) * 43758.5453
    return x - Math.floor(x)   // [0, 1]
  }
  const v0 = hash(ti) * 2 - 1       // [-1, 1]
  const v1 = hash(ti + 1) * 2 - 1   // [-1, 1]
  return v0 + (v1 - v0) * smoothT    // interpolate
}
```

#### New `ScreenShakeSystem` Class

**New file**: `src/game/systems/ScreenShakeSystem.ts`

```typescript
// src/game/systems/ScreenShakeSystem.ts

import Phaser from 'phaser'

export type ShakeTier = 'micro' | 'medium' | 'heavy'

interface ShakeState {
  tier: ShakeTier
  amplitude: number     // pixels
  duration: number      // ms
  elapsed: number       // ms since shake started
  offsetX: number       // current camera X offset
  offsetY: number       // current camera Y offset
  seedX: number         // noise seed for X axis
  seedY: number         // noise seed for Y axis
}

const SHAKE_CONFIGS: Record<ShakeTier, { amplitude: number; duration: number; frequency: number }> = {
  micro:  { amplitude: 2, duration: 100, frequency: 40 },   // 40 Hz oscillation
  medium: { amplitude: 4, duration: 200, frequency: 28 },
  heavy:  { amplitude: 8, duration: 400, frequency: 18 },
}

const TIER_PRIORITY: Record<ShakeTier, number> = { micro: 1, medium: 2, heavy: 3 }

/**
 * Perlin-noise-based screen shake with 3 tiers and accessibility support.
 *
 * Usage:
 *   const shake = new ScreenShakeSystem(scene)
 *   shake.trigger('micro')
 *   // In scene update():
 *   shake.update(delta)
 */
export class ScreenShakeSystem {
  private scene: Phaser.Scene
  private current: ShakeState | null = null
  private baseScrollX = 0
  private baseScrollY = 0
  /** User preference: 0–100 (100 = full, 0 = disabled). Read from settings store. */
  private intensityScale = 1.0
  /** True when OS prefers reduced motion. */
  private reducedMotion = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.detectReducedMotion()
  }

  /**
   * Check OS-level prefers-reduced-motion preference.
   */
  private detectReducedMotion(): void {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.reducedMotion = mq.matches
      mq.addEventListener('change', (e) => { this.reducedMotion = e.matches })
    }
  }

  /**
   * Update intensity scale from settings (0.0–1.0).
   * Call whenever the user changes the accessibility slider.
   */
  setIntensityScale(scale: number): void {
    this.intensityScale = Math.max(0, Math.min(1, scale))
  }

  /**
   * Trigger a shake of the given tier.
   * If a shake of equal or higher priority is active, the new shake replaces it only if stronger.
   */
  trigger(tier: ShakeTier): void {
    if (this.reducedMotion || this.intensityScale <= 0) return

    const cfg = SHAKE_CONFIGS[tier]
    const newPriority = TIER_PRIORITY[tier]
    const currentPriority = this.current ? TIER_PRIORITY[this.current.tier] : 0

    // Only replace if new shake is higher priority (or no current shake)
    if (newPriority < currentPriority) return

    // Remove previous camera offset before starting new shake
    if (this.current) {
      const cam = this.scene.cameras.main
      cam.scrollX -= this.current.offsetX
      cam.scrollY -= this.current.offsetY
    }

    this.current = {
      tier,
      amplitude: cfg.amplitude * this.intensityScale,
      duration: cfg.duration,
      elapsed: 0,
      offsetX: 0,
      offsetY: 0,
      seedX: Math.random() * 1000,
      seedY: Math.random() * 1000 + 500,   // Different seed for Y
    }
  }

  /**
   * Update the shake state each frame. Call in scene update().
   * @param deltaMs - Milliseconds since last frame
   */
  update(deltaMs: number): void {
    if (!this.current) return

    this.current.elapsed += deltaMs

    if (this.current.elapsed >= this.current.duration) {
      // Shake complete — remove camera offset and clear state
      const cam = this.scene.cameras.main
      cam.scrollX -= this.current.offsetX
      cam.scrollY -= this.current.offsetY
      this.current = null
      return
    }

    const cfg = SHAKE_CONFIGS[this.current.tier]
    const t = this.current.elapsed / 1000   // convert to seconds for noise function

    // Envelope: fade out linearly in the last 30% of duration
    const lifeRatio = this.current.elapsed / this.current.duration
    const envelope = lifeRatio > 0.70 ? 1.0 - (lifeRatio - 0.70) / 0.30 : 1.0

    const noiseX = smoothNoise1D(t * cfg.frequency, this.current.seedX)
    const noiseY = smoothNoise1D(t * cfg.frequency, this.current.seedY)

    const newOffsetX = noiseX * this.current.amplitude * envelope
    const newOffsetY = noiseY * this.current.amplitude * envelope

    // Apply delta to camera scroll
    const cam = this.scene.cameras.main
    cam.scrollX += newOffsetX - this.current.offsetX
    cam.scrollY += newOffsetY - this.current.offsetY

    this.current.offsetX = newOffsetX
    this.current.offsetY = newOffsetY
  }

  /** True if a shake is currently active. */
  get isActive(): boolean { return this.current !== null }
}

// --- Private: Smooth noise helper ---

function smoothNoise1D(t: number, seed: number): number {
  const ti = Math.floor(t)
  const tf = t - ti
  const smooth = tf * tf * (3 - 2 * tf)   // smoothstep
  const hash = (n: number): number => {
    const x = Math.sin((n + seed) * 127.1) * 43758.5453
    return x - Math.floor(x)
  }
  const v0 = hash(ti) * 2 - 1
  const v1 = hash(ti + 1) * 2 - 1
  return v0 + (v1 - v0) * smooth
}
```

#### Accessibility Slider

Add `screenShakeIntensity` to `src/ui/stores/settings.ts`:

```typescript
// After the reducedMotion store...

function readShakeIntensity(): number {
  if (typeof window === 'undefined') return 1.0
  const raw = window.localStorage.getItem('setting_shakeIntensity')
  const parsed = raw !== null ? parseFloat(raw) : NaN
  return isNaN(parsed) ? 1.0 : Math.max(0, Math.min(1, parsed))
}

/** Reactive store for screen shake intensity (0.0–1.0, default 1.0). */
export const screenShakeIntensity = singletonWritable<number>('screenShakeIntensity', readShakeIntensity())
screenShakeIntensity.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_shakeIntensity', String(v))
  }
})
```

#### MineScene Integration

1. Import `ScreenShakeSystem`, `screenShakeIntensity` from settings
2. Add private field `private shakeSystem!: ScreenShakeSystem`
3. In `create()`:
   ```typescript
   this.shakeSystem = new ScreenShakeSystem(this)
   // Subscribe to settings store (Svelte store read outside component)
   import { get } from 'svelte/store'
   import { screenShakeIntensity } from '../../ui/stores/settings'
   this.shakeSystem.setIntensityScale(get(screenShakeIntensity))
   screenShakeIntensity.subscribe(v => this.shakeSystem?.setIntensityScale(v))
   ```
4. In `update(_time, delta)`:
   ```typescript
   this.shakeSystem?.update(delta)
   ```
5. In `ImpactSystem.ts`, replace `triggerShake()` method signature and have it accept a tier enum rather than magnitude. `ImpactSystem` should hold a reference to `ScreenShakeSystem` passed in its constructor.

#### Modify `ImpactSystem.ts`

Change constructor signature and remove old `triggerShake` implementation:

```typescript
import { ScreenShakeSystem, type ShakeTier } from './ScreenShakeSystem'

export class ImpactSystem {
  private scene: Phaser.Scene
  private shakeSystem: ScreenShakeSystem

  constructor(scene: Phaser.Scene, shakeSystem: ScreenShakeSystem) {
    this.scene = scene
    this.shakeSystem = shakeSystem
  }

  triggerHit(
    blockType: BlockType,
    hitNumber: number,
    isFinalHit: boolean,
    blockPx: number,
    blockPy: number,
    tileX: number,
    tileY: number,
    pickaxeTier: number,
    flashTiles: Map<string, number>
  ): void {
    const profile = IMPACT_PROFILES[blockType] ?? DEFAULT_PROFILE

    // 1. Block flash
    flashTiles.set(`${tileX},${tileY}`, this.scene.time.now)

    // 2. Screen shake via tier enum (replaces old magnitude-based shake)
    const shakeTier = this.resolveShakeTier(blockType, isFinalHit, pickaxeTier)
    this.shakeSystem.trigger(shakeTier)

    // 3. Climactic break effects (final hit only)
    if (isFinalHit) {
      this.playBreakClimax(blockType, blockPx, blockPy, pickaxeTier)
    }

    // 4. Haptic
    this.triggerHaptic(isFinalHit)
  }

  /** Determine shake tier from context */
  private resolveShakeTier(
    blockType: BlockType,
    isFinalHit: boolean,
    pickaxeTier: number
  ): ShakeTier {
    // Heavy shake: always for HardRock final hit with high-tier pickaxe
    if (isFinalHit && blockType === BlockType.HardRock && pickaxeTier >= 2) return 'heavy'
    // Medium shake: final hit on lava/artifact/special blocks, or hazard blocks
    if (isFinalHit && (
      blockType === BlockType.ArtifactNode ||
      blockType === BlockType.LavaBlock ||
      blockType === BlockType.RelicShrine
    )) return 'medium'
    // Medium shake: hard rock non-final hits
    if (blockType === BlockType.HardRock) return 'medium'
    // Micro: everything else
    return 'micro'
  }
  // ... rest of class unchanged
}
```

In MineScene `create()`, update construction of ImpactSystem:
```typescript
this.impactSystem = new ImpactSystem(this, this.shakeSystem)
```

For earthquake events in MineScene, add:
```typescript
private triggerEarthquake(): void {
  // ... existing earthquake code ...
  this.shakeSystem?.trigger('heavy')
}
```

#### Acceptance Criteria for 30.4

- [ ] Mining any block triggers a micro shake (2 px, 100 ms, smooth motion)
- [ ] Mining LavaBlock/ArtifactNode final hit triggers medium shake (4 px, 200 ms)
- [ ] Earthquake triggers heavy shake (8 px, 400 ms)
- [ ] Shake visually smooth (no jitter/stutter) — Perlin noise, not random
- [ ] Setting `screenShakeIntensity` to 0 disables shake entirely
- [ ] Setting `screenShakeIntensity` to 50 % halves amplitude
- [ ] `prefers-reduced-motion: reduce` OS setting disables shake
- [ ] Heavy shake interrupts ongoing medium/micro shake
- [ ] Micro shake is ignored if medium/heavy is active
- [ ] No visual artifacts when shake ends (camera correctly returns to un-offset position)
- [ ] `ScreenShakeSystem.ts` created with JSDoc, zero TypeScript errors

---

### 30.5 — Per-Block Impact Profiles (DD-V2-252)

**Goal**: Each block type produces a unique combination of particle effect, sound, shake tier, and crack style on each hit — not just on the final break.

#### Impact Profile Type

Extend `ImpactProfile` in `ImpactSystem.ts`:

```typescript
export interface ImpactProfile {
  /** Shake tier for non-final hits */
  hitShakeTier: ShakeTier
  /** Shake tier for the final (destroying) hit */
  finalShakeTier: ShakeTier
  /** Color of the block hit flash (hex) */
  flashColor: number
  /** Duration of the block hit flash in ms */
  flashDuration: number
  /** Impact feel type — maps to particle burst config */
  impactType: ImpactType
  /** Particle count override for non-final hits (default: from ParticleSystem BREAK_CONFIGS) */
  hitParticleCount?: number
  /** Sound to play on non-final hit */
  hitSound: string
  /** Sound to play on final (destroying) hit */
  breakSound: string
  /** Additional secondary particle type for special materials */
  secondaryParticle?: SecondaryParticleConfig
}

export type ImpactType = 'crumble' | 'spark' | 'chip' | 'thud' | 'hiss' | 'chime' | 'whomp' | 'sizzle'

export interface SecondaryParticleConfig {
  /** Particle color */
  tint: number
  /** Particle count */
  count: number
  /** Gravity (negative = rising) */
  gravity: number
  /** Particle size key ('particle_sq_2', 'particle_sq_3', 'particle_sq_4') */
  texKey: string
  /** Lifespan ms */
  lifespan: number
  /** Speed range */
  speed: { min: number; max: number }
}
```

#### Full Profile Definitions

Replace the existing `IMPACT_PROFILES` in `ImpactSystem.ts`:

```typescript
const IMPACT_PROFILES: Partial<Record<BlockType, ImpactProfile>> = {
  [BlockType.Dirt]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0xddcc99,
    flashDuration: 60,
    impactType: 'crumble',
    hitParticleCount: 4,
    hitSound: 'mine_dirt',
    breakSound: 'mine_break',
    // Secondary: soft dust cloud rises (low gravity = floats)
    secondaryParticle: {
      tint: 0xccaa88, count: 6, gravity: -20,
      texKey: 'particle_sq_3', lifespan: 600,
      speed: { min: 8, max: 25 },
    },
  },

  [BlockType.SoftRock]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0xccbbaa,
    flashDuration: 70,
    impactType: 'crumble',
    hitParticleCount: 5,
    hitSound: 'mine_dirt',
    breakSound: 'mine_break',
    secondaryParticle: {
      tint: 0xaaaaaa, count: 4, gravity: 40,
      texKey: 'particle_sq_3', lifespan: 450,
      speed: { min: 15, max: 40 },
    },
  },

  [BlockType.Stone]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0xdddddd,
    flashDuration: 80,
    impactType: 'spark',
    hitParticleCount: 6,
    hitSound: 'mine_rock',
    breakSound: 'mine_break',
    // Secondary: sharp stone chip fragments (fall with gravity)
    secondaryParticle: {
      tint: 0x888888, count: 5, gravity: 120,
      texKey: 'particle_sq_4', lifespan: 400,
      speed: { min: 25, max: 65 },
    },
  },

  [BlockType.HardRock]: {
    hitShakeTier: 'medium',
    finalShakeTier: 'heavy',
    flashColor: 0xaaaaaa,
    flashDuration: 100,
    impactType: 'whomp',
    hitParticleCount: 8,
    hitSound: 'mine_rock',
    breakSound: 'mine_break',
    secondaryParticle: {
      tint: 0x555555, count: 8, gravity: 180,
      texKey: 'particle_sq_4', lifespan: 600,
      speed: { min: 40, max: 100 },
    },
  },

  [BlockType.MineralNode]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'medium',
    flashColor: 0x4ecca3,
    flashDuration: 100,
    impactType: 'chime',
    hitParticleCount: 8,
    hitSound: 'mine_crystal',
    breakSound: 'collect',
    // Secondary: sparkle burst
    secondaryParticle: {
      tint: 0xffffff, count: 6, gravity: -40,
      texKey: 'particle_sq_2', lifespan: 700,
      speed: { min: 30, max: 80 },
    },
  },

  [BlockType.ArtifactNode]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'medium',
    flashColor: 0xff99aa,
    flashDuration: 120,
    impactType: 'chime',
    hitParticleCount: 10,
    hitSound: 'mine_crystal',
    breakSound: 'collect',
    // Secondary: golden magic particles
    secondaryParticle: {
      tint: 0xffd700, count: 10, gravity: -60,
      texKey: 'particle_sq_2', lifespan: 900,
      speed: { min: 40, max: 100 },
    },
  },

  [BlockType.LavaBlock]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'medium',
    flashColor: 0xff4400,
    flashDuration: 150,
    impactType: 'sizzle',
    hitParticleCount: 8,
    hitSound: 'mine_rock',      // sizzle synthesized via audioService
    breakSound: 'mine_break',
    // Secondary: white steam rising (negative gravity)
    secondaryParticle: {
      tint: 0xeeffee, count: 4, gravity: -80,
      texKey: 'particle_sq_3', lifespan: 800,
      speed: { min: 10, max: 30 },
    },
  },

  [BlockType.GasPocket]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0x88cc66,
    flashDuration: 100,
    impactType: 'hiss',
    hitParticleCount: 10,
    hitSound: 'mine_dirt',
    breakSound: 'mine_break',
    // Secondary: gas bubbles rising fast
    secondaryParticle: {
      tint: 0x44ff88, count: 8, gravity: -120,
      texKey: 'particle_sq_2', lifespan: 500,
      speed: { min: 20, max: 50 },
    },
  },

  [BlockType.OxygenCache]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0x5dade2,
    flashDuration: 80,
    impactType: 'chime',
    hitParticleCount: 8,
    hitSound: 'mine_crystal',
    breakSound: 'collect',
    secondaryParticle: {
      tint: 0x88ddff, count: 8, gravity: -50,
      texKey: 'particle_sq_2', lifespan: 600,
      speed: { min: 25, max: 60 },
    },
  },

  [BlockType.FossilNode]: {
    hitShakeTier: 'micro',
    finalShakeTier: 'micro',
    flashColor: 0xd4a574,
    flashDuration: 90,
    impactType: 'crumble',
    hitParticleCount: 6,
    hitSound: 'mine_dirt',
    breakSound: 'mine_break',
    secondaryParticle: {
      tint: 0xc4855e, count: 6, gravity: 80,
      texKey: 'particle_sq_3', lifespan: 500,
      speed: { min: 20, max: 50 },
    },
  },
}
```

#### Secondary Particle Emission

Add `emitSecondary()` method to `ParticleSystem.ts`:

```typescript
/**
 * Emit a secondary particle burst with a custom configuration.
 * Used for per-block-type additional effects (steam, sparks, etc.)
 *
 * @param config - Secondary particle configuration from ImpactProfile
 * @param px - World X center
 * @param py - World Y center
 */
emitSecondary(config: SecondaryParticleConfig, px: number, py: number): void {
  const texKey = config.texKey
  this.ensureTexture(texKey.replace('particle_sq_', 'particle_sq_') , parseInt(texKey.slice(-1)))

  const emitter = this.scene.add.particles(px, py, texKey, {
    color: [config.tint],
    lifespan: config.lifespan,
    speed: config.speed,
    scale: { start: 0.8, end: 0 },
    gravityY: config.gravity,
    alpha: { start: 0.9, end: 0 },
    quantity: 1,
    frequency: -1,
    emitting: false,
  })
  emitter.setDepth(200)
  emitter.explode(config.count)
  this.scene.time.delayedCall(config.lifespan + 100, () => emitter.destroy())
}
```

Update `ImpactSystem.triggerHit()` to pass `ParticleSystem` and call secondary:

```typescript
// ImpactSystem constructor now takes a ParticleSystem reference
constructor(
  scene: Phaser.Scene,
  shakeSystem: ScreenShakeSystem,
  particles: ParticleSystem
) {
  this.scene = scene
  this.shakeSystem = shakeSystem
  this.particles = particles
}

// In triggerHit(), after the block flash:
if (profile.secondaryParticle && (isFinalHit || hitNumber >= 2)) {
  // Only emit secondary on hit #2+ or final hit (not first tap)
  this.particles.emitSecondary(profile.secondaryParticle, blockPx, blockPy)
}
```

#### Acceptance Criteria for 30.5

- [ ] Dirt blocks: brown dust cloud rises (negative gravity secondary particles) on hit #2+
- [ ] Stone blocks: sharp grey chips fly downward (positive gravity) on hit #2+
- [ ] Crystal MineralNode: white sparkle secondary on every hit
- [ ] LavaBlock: white steam secondary (negative gravity) on every hit
- [ ] GasPocket: acid green bubbles rise on every hit
- [ ] ArtifactNode: gold particles secondary on every hit
- [ ] Secondary particles only emit on hit #2+ or final hit (not first tap)
- [ ] Sound plays on every hit (not just break) per `hitSound` profile field
- [ ] `emitSecondary()` added to `ParticleSystem` with JSDoc
- [ ] `ImpactSystem` updated to accept `ParticleSystem` in constructor
- [ ] MineScene `create()` passes `particles` to `ImpactSystem` constructor
- [ ] No new TypeScript errors

---

### 30.6 — Block Idle Animations (DD-V2-012 Spec)

**Goal**: Implement subtle idle animations for special block types that communicate their nature without being distracting. All animations are viewport-culled and use per-tile phase offsets to avoid synchronization.

#### Target Blocks and Animation Specs

| Block Type | Animation | Frames | Period | Visual Description |
|---|---|---|---|---|
| MineralNode (crystal/geode) | Crystal glint | 3 | 3 000 ms | Frame 0: base. Frame 1: bright highlight spot in top-right corner. Frame 2: dimmer highlight. Returns to frame 0. |
| MineralNode (essence) | Essence pulse | 4 | 2 000 ms | Radial gold rays that expand and contract (overlay animation, not sprite swap) |
| ArtifactNode | Glow pulse | 4 | 2 500 ms | Overlay alpha oscillation 0 % → 60 % → 0 % with color `0xff99aa` |
| LavaBlock | Lava pulse | 4 | 800 ms | Brightness oscillation via overlay tint; existing pulse at line 1008 expanded |
| GasPocket | Gas swirl | 3 | 1 200 ms | Existing frame animation expanded with phase offsets |
| DescentShaft | Beacon glow | 6 | 2 000 ms | Existing descent shaft animation expanded + rotating 4-spoke light effect |
| RelicShrine | Shrine glow | 4 | 2 500 ms | Existing relic shrine animation + gold particle motes around tile |

#### Current State

`BlockAnimSystem.ts` already has configs for all these block types (lines 21–61). The animations work but all tiles of the same type are synchronized (no phase offset). `AnimatedTileSystem.ts` has phase offsets but only for lava, gas, mineral shimmer.

#### Implementation Plan

**Step 1**: Add per-tile phase offset to `BlockAnimSystem.getFrameKey()`:

Modify the signature to accept optional tileX/tileY for phase offset:

```typescript
static getFrameKey(
  blockType: BlockType,
  nowMs: number,
  textures: Phaser.Textures.TextureManager,
  tileX = 0,
  tileY = 0
): string | null {
  const cfg = BLOCK_ANIM_CONFIGS[blockType]
  if (!cfg) return null

  // Per-tile phase offset prevents all same-type blocks from animating in sync
  const phaseOffsetMs = ((tileX * 7 + tileY * 13) % cfg.frames.length) * (cfg.periodMs / cfg.frames.length)
  const offsetNow = nowMs + phaseOffsetMs

  const frameIdx = Math.floor((offsetNow % cfg.periodMs) / cfg.periodMs * cfg.frames.length)
  const key = cfg.frames[Math.max(0, Math.min(cfg.frames.length - 1, frameIdx))]

  if (!textures.exists(key)) {
    return textures.exists(cfg.frames[0]) ? cfg.frames[0] : null
  }
  return key
}
```

**Step 2**: Update all `BlockAnimSystem.getFrameKey()` call sites in `MineScene.drawBlockPattern()` to pass `tileX, tileY`:

```typescript
// Before (all instances, e.g. line 584):
const animKey = BlockAnimSystem.getFrameKey(BlockType.MineralNode, this.time.now, this.textures)

// After:
const animKey = BlockAnimSystem.getFrameKey(BlockType.MineralNode, this.time.now, this.textures, tileX, tileY)
```

This applies to all 10 `BlockAnimSystem.getFrameKey()` calls in `drawBlockPattern()`.

**Step 3**: Add essence pulse overlay animation for MineralNode essence tier.

In `drawBlockPattern()`, the essence tier already has a star ray overlay. Extend it with a pulsing brightness:

```typescript
case BlockType.MineralNode: {
  // ... existing code ...
  if (tier === 'essence') {
    // Existing star overlay, now with pulse
    const essencePulse = 0.7 + 0.3 * Math.sin(this.time.now / 300 + tileX * 0.7 + tileY * 1.1)
    // Use pulse to modulate gold alpha on the star rays:
    this.overlayGraphics.lineStyle(2, 0xffd700, 0.9 * essencePulse)
    // ... rest of existing essence drawing code, but with essencePulse factored in ...
  }
  break
}
```

**Step 4**: DescentShaft rotating beacon effect.

Add a rotating 4-spoke overlay for DescentShaft blocks (drawn in `drawBlockPattern()` after the sprite):

```typescript
case BlockType.DescentShaft: {
  const animKey = BlockAnimSystem.getFrameKey(BlockType.DescentShaft, this.time.now, this.textures, tileX, tileY)
  this.getPooledSprite(animKey ?? 'block_descent_shaft', cx, cy)

  // Rotating beacon: 4 spokes at 90° each, rotating over 2000 ms
  const angle = (this.time.now / 2000) * Math.PI * 2   // full rotation per 2 seconds
  const beaconAlpha = 0.35 + 0.15 * Math.sin(this.time.now / 400)
  const spokeLength = TILE_SIZE * 0.45
  this.overlayGraphics.lineStyle(1, 0x6633cc, beaconAlpha)
  for (let i = 0; i < 4; i++) {
    const spokeAngle = angle + (i * Math.PI / 2)
    const x1 = cx + Math.cos(spokeAngle) * 3
    const y1 = cy + Math.sin(spokeAngle) * 3
    const x2 = cx + Math.cos(spokeAngle) * spokeLength
    const y2 = cy + Math.sin(spokeAngle) * spokeLength
    this.overlayGraphics.lineBetween(x1, y1, x2, y2)
  }
  break
}
```

**Step 5**: Viewport culling for idle animations.

The `drawTiles()` loop already only iterates visible tiles (lines 830–834). Idle animations drawn via `drawBlockPattern()` and `overlayGraphics` are therefore automatically viewport-culled. No additional culling needed.

**Step 6**: RelicShrine mote particles (ambient, not break particles).

Add a per-tile ambient particle emitter system for RelicShrine blocks. Since particles need persistent emitters tied to specific tile positions, use the `BiomeParticleManager` pattern:

Add to `BlockAnimSystem`:

```typescript
/**
 * Returns whether a block type should have persistent ambient mote particles.
 */
static hasMoteParticles(blockType: BlockType): boolean {
  return blockType === BlockType.RelicShrine || blockType === BlockType.ArtifactNode
}

/**
 * Returns mote particle config for blocks that have persistent ambient effects.
 */
static getMoteConfig(blockType: BlockType): { tint: number; count: number; gravity: number } | null {
  switch (blockType) {
    case BlockType.RelicShrine:
      return { tint: 0xd4af37, count: 2, gravity: -30 }
    case BlockType.ArtifactNode:
      return { tint: 0xff99aa, count: 1, gravity: -50 }
    default:
      return null
  }
}
```

Mote particles for RelicShrine/ArtifactNode: add to the `ParticleSystem` a `emitMote()` method that fires 1–2 particles from a given position on a timer. Call from `MineScene.update()` for visible relic shrine tiles at a low rate (once per 1 500 ms per tile using the scene time + tile position hash as a gate):

```typescript
// In MineScene.update():
if (Math.floor(time / 1500) !== Math.floor((time - delta) / 1500)) {
  // Fire once per 1500 ms tick — emit motes from visible relic/artifact blocks
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const cell = this.grid[y]?.[x]
      if (!cell?.revealed) continue
      const moteCfg = BlockAnimSystem.getMoteConfig(cell.type)
      if (moteCfg && ((x * 7 + y * 13 + Math.floor(time / 1500)) % 3 === 0)) {
        this.particles.emitMote(
          moteCfg,
          x * TILE_SIZE + TILE_SIZE * 0.5,
          y * TILE_SIZE + TILE_SIZE * 0.5
        )
      }
    }
  }
}
```

`emitMote()` in `ParticleSystem.ts`:
```typescript
/**
 * Emit 1–2 ambient mote particles from a specific world position.
 * Used for idle ambient effects on RelicShrine, ArtifactNode, etc.
 * These are ephemeral — no persistent emitter created.
 */
emitMote(config: { tint: number; count: number; gravity: number }, px: number, py: number): void {
  const texKey = PARTICLE_TEX_PREFIX + '2'
  this.ensureTexture(texKey, 2)

  const emitter = this.scene.add.particles(px, py, texKey, {
    color: [config.tint],
    lifespan: { min: 800, max: 1400 },
    speed: { min: 5, max: 18 },
    scale: { start: 0.6, end: 0 },
    gravityY: config.gravity,
    alpha: { start: 0.7, end: 0 },
    quantity: 1,
    frequency: -1,
    emitting: false,
  })
  emitter.setDepth(8)
  emitter.explode(config.count)
  this.scene.time.delayedCall(1600, () => emitter.destroy())
}
```

#### Acceptance Criteria for 30.6

- [ ] Crystal/Geode MineralNode: visible 3-frame glint cycle with per-tile phase offset (adjacent tiles NOT in sync)
- [ ] Essence MineralNode: gold star rays pulse in brightness (0.7–1.0 alpha multiplier)
- [ ] ArtifactNode: overlay glow pulses from 0 to 60 % alpha with pink-red tint
- [ ] LavaBlock: existing pulse retained; amplitude and frequency verified against 800 ms spec
- [ ] DescentShaft: 4-spoke rotating beacon overlay visible (rotates once per 2 000 ms)
- [ ] RelicShrine: gold mote particles drift upward every ~1 500 ms
- [ ] ArtifactNode: pink mote particles drift upward every ~1 500 ms (at lower rate than shrine)
- [ ] All `BlockAnimSystem.getFrameKey()` calls pass `tileX, tileY` — no sync artifact between tiles
- [ ] Performance: mote particles capped (max 20 per frame via `% 3` gate)
- [ ] TypeScript: zero new errors

---

### 30.7 — Progressive Damage Feedback (DD-V2-253)

**Goal**: Mining feedback scales visually and aurally with damage dealt per swing, creating a satisfying escalation within a single block's destruction.

#### Damage Scaling Model

Damage dealt per swing is `tierDamage` from `BALANCE.PICKAXE_TIERS[pickaxeTierIndex].damage` applied at lines 1418–1421 of MineScene. The `hitNumber` (tracked in `Player.recordHit()`) indicates which hit this is.

Define four progressive damage states:

| Hit State | Health Remaining | Particle Count Multiplier | Shake Tier Override | Sound Modifier |
|---|---|---|---|---|
| Graze (first hit, low tier) | > 80 % | 0.5× | micro | quiet (0.6 gain) |
| Normal | 50–80 % | 1.0× | per profile | normal (1.0 gain) |
| Heavy | 25–50 % | 1.5× | profile + 1 tier | loud (1.3 gain) |
| Critical | < 25 % | 2.0× | at least medium | max (1.5 gain) |

Sound gain modifiers are passed to `audioManager.playSound()` as a volume multiplier parameter if the function supports it (otherwise document as future work).

#### Implementation

**Step 1**: Calculate `hitState` in `MineScene.handleMoveOrMine()` after the pickaxe tier damage is applied and before `triggerHit()`:

```typescript
// After the pickaxe tier damage application (around line 1422):
const healthAfterHit = isFinalHit ? 0 : targetCell.hardness / targetCell.maxHardness
const hitState: 'graze' | 'normal' | 'heavy' | 'critical' =
  hitNumber === 1 && healthAfterHit > 0.80 ? 'graze'
  : healthAfterHit > 0.50                    ? 'normal'
  : healthAfterHit > 0.25                    ? 'heavy'
  : 'critical'
```

**Step 2**: Pass `hitState` to `ImpactSystem.triggerHit()` — add it to the signature:

```typescript
// ImpactSystem.ts — updated triggerHit signature
triggerHit(
  blockType: BlockType,
  hitNumber: number,
  isFinalHit: boolean,
  blockPx: number,
  blockPy: number,
  tileX: number,
  tileY: number,
  pickaxeTier: number,
  flashTiles: Map<string, number>,
  hitState: 'graze' | 'normal' | 'heavy' | 'critical' = 'normal'
): void {
```

**Step 3**: Apply hit state modifiers in `triggerHit()`:

```typescript
// In triggerHit():
const stateMultipliers = {
  graze:    { flashAlpha: 0.25, particleScale: 0.5 },
  normal:   { flashAlpha: 0.45, particleScale: 1.0 },
  heavy:    { flashAlpha: 0.55, particleScale: 1.5 },
  critical: { flashAlpha: 0.70, particleScale: 2.0 },
}
const mult = stateMultipliers[hitState]

// Graze: smaller flash
flashTiles.set(`${tileX},${tileY}`, this.scene.time.now)
// Flash alpha is read in drawTiles() — store the multiplier in a second map
this.flashAlphaOverrides?.set(`${tileX},${tileY}`, mult.flashAlpha)

// Heavy/Critical: escalate shake tier by 1 level if not already heavy
const baseTier = this.resolveShakeTier(blockType, isFinalHit, pickaxeTier)
let finalTier: ShakeTier = baseTier
if (hitState === 'heavy' && baseTier === 'micro') finalTier = 'medium'
if (hitState === 'critical') finalTier = baseTier === 'micro' ? 'medium' : 'heavy'
this.shakeSystem.trigger(finalTier)

// Secondary particles: scale count by hitState multiplier
if (profile.secondaryParticle && (isFinalHit || hitNumber >= 2)) {
  const scaledConfig = {
    ...profile.secondaryParticle,
    count: Math.round(profile.secondaryParticle.count * mult.particleScale),
  }
  this.particles.emitSecondary(scaledConfig, blockPx, blockPy)
}
```

**Step 4**: Flash alpha override in `MineScene.drawTiles()`.

Add a second Map alongside `flashTiles`:

```typescript
private flashAlphaOverrides = new Map<string, number>()
```

In the flash drawing block (around line 1028):
```typescript
const flashKey = `${x},${y}`
const flashStart = this.flashTiles.get(flashKey)
if (flashStart !== undefined) {
  const elapsed = this.time.now - flashStart
  if (elapsed < 150) {
    const baseAlpha = this.flashAlphaOverrides.get(flashKey) ?? 0.45
    const alpha = baseAlpha * (1 - elapsed / 150)
    this.overlayGraphics.fillStyle(0xffffff, alpha)
    this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  } else {
    this.flashTiles.delete(flashKey)
    this.flashAlphaOverrides.delete(flashKey)
  }
}
```

**Step 5**: Critical hit golden flash for relics.

When a `lucky_strike` relic procs (doubles mineral drops), add a critical visual flourish — emit a brief golden overlay at the block position:

```typescript
// In MineralNode break handling, after lucky_strike check:
if (luckyRelic && luckyRelic.effect.type === 'lucky_strike' && this.rng() < luckyRelic.effect.chance) {
  mineralAmount = mineralAmount * 2
  // Golden flash at block position
  this.flashAlphaOverrides.set(`${targetX},${targetY}`, 0.80)
  this.flashTiles.set(`${targetX},${targetY}`, this.time.now)
  // Gold tint instead of white: override flash color (new approach using separate overlay)
  this.overlayGraphics.fillStyle(0xffd700, 0.70)
  const bpx = targetX * TILE_SIZE
  const bpy = targetY * TILE_SIZE
  this.overlayGraphics.fillRect(bpx, bpy, TILE_SIZE, TILE_SIZE)
  // Heavy shake on crit
  this.shakeSystem?.trigger('medium')
}
```

#### Acceptance Criteria for 30.7

- [ ] First tap on a high-hardness block (graze): visibly smaller particle burst and dimmer flash than subsequent hits
- [ ] Hit #3+ on same block (heavy state): particle count 1.5× baseline, shake escalates one tier
- [ ] Final hit on near-dead block (critical state): particle count 2× baseline, at least medium shake
- [ ] Lucky strike relic proc: gold overlay flash visible (distinct from white block flash)
- [ ] Flash alpha override map correctly cleaned up when flash expires
- [ ] `hitState` calculated correctly across all hit scenarios (verify with console.log in dev)
- [ ] No regression: blocks still break in same number of hits as before

---

## Acceptance Criteria (Phase Level)

All sub-phase acceptance criteria above must pass. Additionally:

- [ ] **TypeScript**: `npm run typecheck` produces zero errors after all changes
- [ ] **Build**: `npm run build` completes without warnings above the existing baseline
- [ ] **No regressions**: Quiz, save/load, biome transitions, all existing game systems continue working
- [ ] **Performance**: Frame rate remains ≥ 50 fps on a mid-range Android device (Snapdragon 665 equivalent) during a block break sequence with max concurrent effects
- [ ] **Accessibility**: Disabling screen shake (setting to 0) disables ALL camera motion (verified via settings toggle)
- [ ] **Graceful degradation**: All systems fall back gracefully when sprite textures are absent
- [ ] **Memory**: No cumulative memory leaks from particle emitters — all emitters destroyed after use

---

## Playwright Test Scripts

All scripts use the template from `CLAUDE.md` (write to `/tmp/ss.js`, run with `node /tmp/ss.js`).

### Test 30-A: Crack Stage Progression

```javascript
// /tmp/test-30-cracks.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to mine
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Screenshot: initial state (no cracks)
  await page.screenshot({ path: '/tmp/test-30-A-initial.png' })
  console.log('Initial mine screenshot saved')

  // Hit a stone block twice (partial damage, should show crack stage 1 or 2)
  // Use evaluate to directly modify game state for testing
  await page.evaluate(() => {
    // Find a stone block and partially damage it
    const gm = (window as any).__gameManager
    // This depends on GameManager having a debug accessor
    console.log('GameManager:', gm)
  })

  // Take screenshot after partial damage
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/test-30-A-cracked.png' })
  console.log('Cracked block screenshot saved')

  await browser.close()
  console.log('Test 30-A complete. Check /tmp/test-30-A-*.png')
})()
```

### Test 30-B: Loot Pop Physics Arc

```javascript
// /tmp/test-30-loot.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173?biome=crystalline')  // Crystal biome for mineral nodes
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Mine a mineral node — the loot arc should be visible
  // Take rapid screenshots during the break sequence
  const rapidShot = async (suffix) => {
    await page.screenshot({ path: `/tmp/test-30-B-${suffix}.png` })
  }

  await page.click('.phaser-canvas', { position: { x: 400, y: 300 } })
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(100)
    await rapidShot(`arc-${i * 100}ms`)
  }
  await page.waitForTimeout(500)
  await rapidShot('arc-600ms')

  await browser.close()
  console.log('Test 30-B: Check /tmp/test-30-B-*.png for loot arc frames')
})()
```

### Test 30-C: Screen Shake Disabled by Settings

```javascript
// /tmp/test-30-shake.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  // Pre-set shake intensity to 0
  await page.goto('http://localhost:5173')
  await page.evaluate(() => {
    localStorage.setItem('setting_shakeIntensity', '0')
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Mine several blocks — no camera shake should be visible
  for (let i = 0; i < 5; i++) {
    await page.click('.phaser-canvas', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: '/tmp/test-30-C-no-shake.png' })
  console.log('Test 30-C: Shake disabled. Check screenshot for stability.')

  // Reset shake to 100%
  await page.evaluate(() => {
    localStorage.setItem('setting_shakeIntensity', '1.0')
  })

  await browser.close()
})()
```

### Test 30-D: Block Break Sequence Visual Verification

```javascript
// /tmp/test-30-break.js
// Captures rapid frames during a block destruction to verify freeze-frame + shatter
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Mine a dirt block (1 hardness — destroys in one hit)
  // Capture frame before, immediately after click, and 100ms later
  await page.screenshot({ path: '/tmp/test-30-D-before.png' })

  // Use keyboard input for more precise timing
  await page.keyboard.press('ArrowDown')  // move player
  await page.waitForTimeout(50)
  await page.screenshot({ path: '/tmp/test-30-D-freeze.png' })  // during freeze
  await page.waitForTimeout(100)
  await page.screenshot({ path: '/tmp/test-30-D-shatter.png' }) // during shatter
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/test-30-D-complete.png' }) // after sequence

  await browser.close()
  console.log('Test 30-D: Check /tmp/test-30-D-*.png for break sequence frames')
})()
```

### Test 30-E: Idle Animation Phase Offset Verification

```javascript
// /tmp/test-30-idle.js
// Verify crystal blocks animate with per-tile phase offsets
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173?biome=crystalline')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Take 3 screenshots at different times to verify animation is running
  await page.screenshot({ path: '/tmp/test-30-E-t0.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/test-30-E-t500.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/test-30-E-t1000.png' })

  await browser.close()
  console.log('Test 30-E: Compare /tmp/test-30-E-*.png — crystal tiles should have slight visual differences between them')
})()
```

---

## Verification Gate

All items below MUST pass before Phase 30 is marked complete in PROGRESS.md.

### TypeScript & Build

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — zero new warnings beyond baseline
- [ ] All new files have correct `import` paths (no unresolved modules)

### New Files Created

- [ ] `src/game/systems/CrackSystem.ts` — exported `getCrackInfo()`, `getCrackCategory()`, `CRACK_STAGES`, `CRACK_MATERIAL_TINTS`
- [ ] `src/game/systems/BlockBreakSequence.ts` — exported `BlockBreakSequence` class with `play()`, `destroy()`
- [ ] `src/game/systems/ScreenShakeSystem.ts` — exported `ScreenShakeSystem` class and `ShakeTier` type

### Modified Files

- [ ] `src/game/scenes/MineScene.ts` — `drawCrackOverlay()` updated; `BlockBreakSequence` instantiated; `ScreenShakeSystem` instantiated and updated; `shakeSystem` passed to `ImpactSystem`; `flashAlphaOverrides` map added; `resolveBlockSpriteKey()` helper added; all `BlockAnimSystem.getFrameKey()` calls pass `tileX, tileY`
- [ ] `src/game/systems/ImpactSystem.ts` — constructor takes `ScreenShakeSystem` and `ParticleSystem`; `hitState` parameter added; `resolveShakeTier()` updated; secondary particle emission added
- [ ] `src/game/systems/LootPopSystem.ts` — `popLoot()` fully replaced with bounce physics; `staggerMs` parameter added; `onBounceSettled` callback added
- [ ] `src/game/systems/ParticleSystem.ts` — `emitSecondary()` method added; `emitMote()` method added
- [ ] `src/game/systems/BlockAnimSystem.ts` — `getFrameKey()` accepts optional `tileX, tileY` for phase offset; `hasMoteParticles()` and `getMoteConfig()` static methods added
- [ ] `src/ui/stores/settings.ts` — `screenShakeIntensity` store added with localStorage persistence
- [ ] `src/app.css` — `loot-hud-flash` keyframe and `.hud-flash` class added

### Visual Verification (Screenshots)

Run each test script and read the output images:

- [ ] Test 30-A: Crack sprites visible on partially damaged blocks; warm brown tint on dirt, charcoal on stone
- [ ] Test 30-B: Loot arc screenshots show item rising upward, bounce visible in intermediate frame
- [ ] Test 30-C: Screenshot with shake=0 shows stable camera during block mining
- [ ] Test 30-D: 4 frames show clear sequence progression (before → freeze → shatter → complete)
- [ ] Test 30-E: Crystal tiles visible; comparing t0 vs t500 vs t1000 shows animated frames changing

### Functional Verification

- [ ] Set `screenShakeIntensity` to `0` via browser localStorage → mine 10 blocks → no camera movement
- [ ] Set `screenShakeIntensity` to `1.0` → mine HardRock final hit → heavy shake visually distinct
- [ ] Mine a HardRock block to destruction → verify 4 shatter pieces fly outward on break
- [ ] Mine a dirt block → verify brown dust cloud rises (negative gravity)
- [ ] Mine a LavaBlock → verify white steam secondary particles rise
- [ ] Mine a MineralNode → verify loot arc with bounce before magnetic pull to player
- [ ] Open browser devtools → Performance tab → Record 10 seconds of mining → frame time stays < 20 ms

---

## Files Affected

### New Files

| File | Purpose |
|---|---|
| `src/game/systems/CrackSystem.ts` | Crack material categories, stage configs, helper functions |
| `src/game/systems/BlockBreakSequence.ts` | Freeze-frame + shatter sequencer with piece pool |
| `src/game/systems/ScreenShakeSystem.ts` | Perlin-noise three-tier shake system with accessibility support |

### Modified Files

| File | Change Summary |
|---|---|
| `src/game/scenes/MineScene.ts` | `drawCrackOverlay()` rewrite; instantiate new systems; `resolveBlockSpriteKey()`; `flashAlphaOverrides` map; `BlockAnimSystem.getFrameKey()` calls pass tile coords; mote particle emission in update loop; `handleMoveOrMine()` passes `hitState` to impact system |
| `src/game/systems/ImpactSystem.ts` | Constructor updated; `ShakeTier` enum integration; secondary particle emission; `hitState` parameter |
| `src/game/systems/LootPopSystem.ts` | Full `popLoot()` replacement with bounce physics; new config fields (`staggerMs`, `onBounceSettled`) |
| `src/game/systems/ParticleSystem.ts` | `emitSecondary()` and `emitMote()` methods added |
| `src/game/systems/BlockAnimSystem.ts` | Phase offset params in `getFrameKey()`; `hasMoteParticles()`, `getMoteConfig()` methods |
| `src/ui/stores/settings.ts` | `screenShakeIntensity` store |
| `src/app.css` | HUD flash keyframe + `.hud-flash` class |

### Assets Referenced (Already Exist)

| Asset | Location | Status |
|---|---|---|
| `crack_stage1.png` | `src/assets/sprites/tiles/` and `src/assets/sprites-hires/tiles/` | Exists |
| `crack_stage2.png` | Same | Exists |
| `crack_stage3.png` | Same | Exists |
| `crack_stage4.png` | Same | Exists |
| `crack_small.png` | Same | Exists, unused by new system |
| `crack_large.png` | Same | Exists, unused by new system |

`crack_small.png` and `crack_large.png` are superseded by `crack_stage1–4.png` and can be ignored (do not delete without asking — see Agent Autonomy Rules).

### Future Work (Out of Scope for Phase 30)

- Per-material crack sprite variants (crack_stage1_soil.png, crack_stage1_rock.png, etc.) — would require ComfyUI sprite generation pass
- Audio integration for `hitSound` gain modifiers (requires `audioManager.playSound()` to accept volume parameter — currently signature doesn't support it)
- HUD flash in specific Svelte component (exact component TBD based on HUD layout at time of implementation — the game event is emitted, component subscriptions added when HUD is refactored in Phase 29)

---

## Implementation Notes for Coding Workers

### Phaser Time Scale Warning

`this.scene.time.timeScale = 0` pauses ALL Phaser time events in the scene, including tweens, delayedCalls, and the scene timer. To implement the freeze-frame reliably, the unfreeze callback must use `this.scene.game.time.addEvent({ delay: 50 })` (game-level time, unaffected by scene time scale). This is demonstrated in the `BlockBreakSequence.play()` implementation above.

### Sprite Pool Integrity

The `itemSpritePool` in `MineScene` is reset each frame in `drawTiles()` (`itemSpritePoolIndex = 0`, all sprites set invisible). Sprites obtained via `getPooledSprite()` are at depth 5 by default. Crack overlay sprites use `crackSprite.setDepth(6)` to appear above the tile but below overlay graphics (depth 7). Shatter pieces use depth 15 to appear above everything during the break sequence.

### `ADD` Blend Mode for Lava Cracks

Phaser's `setBlendMode(Phaser.BlendModes.ADD)` makes the sprite additively blended: dark areas of the crack sprite become transparent, bright areas glow. This works well for lava because the crack sprite is mostly dark with bright white lines. The lava tint `0xdd3300` on an ADD-blended white sprite produces glowing red-orange crack lines. Alpha needs to be reduced (0.7×) as ADD mode is effectively brighter.

### Perlin Noise Seed Independence

`smoothNoise1D(t, seed)` is called with different seed values for X and Y axes. Using `seedX` and `seedY = seedX + 500` ensures the two shake axes are decorrelated. If they used the same seed, the camera would shake diagonally in a single direction (circular motion rather than natural 2D vibration).

### MineScene Constructor Update for ImpactSystem

After this phase, `ImpactSystem` requires `ScreenShakeSystem` and `ParticleSystem` in its constructor. Update `MineScene.create()` to initialize `this.shakeSystem` first, then pass it to `ImpactSystem`:

```typescript
// Order matters:
this.particles = new ParticleSystem(this)
this.particles.init()
this.shakeSystem = new ScreenShakeSystem(this)
// Subscribe to settings:
screenShakeIntensity.subscribe(v => this.shakeSystem?.setIntensityScale(v))
// Now build ImpactSystem with dependencies:
this.impactSystem = new ImpactSystem(this, this.shakeSystem, this.particles)
// BlockBreakSequence after particles (uses particles internally):
this.blockBreakSequence = new BlockBreakSequence(this, this.particles)
this.lootPop = new LootPopSystem(this)
```

### Settings Store Subscription in Phaser

Svelte stores can be subscribed to from Phaser using the `subscribe()` function returned from the store. The subscription should be stored and unsubscribed in the scene's shutdown handler to prevent memory leaks:

```typescript
// In MineScene class fields:
private _shakeIntensityUnsub?: () => void

// In create():
this._shakeIntensityUnsub = screenShakeIntensity.subscribe(v => {
  this.shakeSystem?.setIntensityScale(v)
})

// In handleShutdown():
this._shakeIntensityUnsub?.()
```
