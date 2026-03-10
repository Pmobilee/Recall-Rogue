# Phase 7: Visual Engine Overhaul

**Status**: Not Started
**Dependencies**: Phases 0–6 complete (core game loop, biome system, all block types, Svelte UI)
**Estimated Complexity**: Very High — 8 sub-phases, multiple new systems, significant refactoring

---

## Overview

Phase 7 transforms Recall Rogue's mining experience from functional-but-flat placeholder sprites into a Terraria-quality visual engine. The mine must feel alive, responsive, and rewarding. Every action — movement, mining, loot collection — must produce satisfying visual feedback.

**Why this matters**: The mining loop will be executed millions of times per player lifetime. Every sub-second of visual feedback compounds across thousands of sessions. A single percent improvement in mining satisfaction translates directly to hours of additional play per cohort. This is not polish — it is core game feel infrastructure.

**Design decisions addressed**:
- DD-V2-008: Terraria-style autotiling (mandatory)
- DD-V2-009: Tile texture continuity (mandatory)
- DD-V2-010: Sprite-based crack overlays
- DD-V2-011: Full character animation system
- DD-V2-012: Block idle animations
- DD-V2-012B: Mining satisfaction / "The Pickaxe Feel" (dedicated sub-phase)
- DD-V2-013: Loot pop physics
- DD-V2-014: Biome tile sets (foundation layer)
- DD-V2-015: Particle effects (critical for addictiveness)
- DD-V2-021: Layer transition animations
- DD-V2-025: Camera zoom and mini-map

---

## Prerequisites

Before starting Phase 7, verify ALL of the following are true:

1. `npm run typecheck` passes with zero errors
2. `npm run build` produces a successful bundle
3. All 21 `BlockType` enum values have corresponding sprite keys in `drawBlockPattern()` in `MineScene.ts`
4. The biome system is functional: `src/data/biomes.ts` exports `Biome[]` array and `DEFAULT_BIOME`
5. `src/game/spriteManifest.ts` successfully loads sprites from both `src/assets/sprites/` (32px) and `src/assets/sprites-hires/` (256px)
6. `BootScene.ts` loads all sprites via `getSpriteUrls()` before emitting `boot-complete`
7. The player can move and mine in all four cardinal directions
8. Oxygen system, fog of war, and quiz overlay are fully functional

---

## Sub-Phase 7.1: Autotiling System (Terraria-style Bitmasking)

### What
Replace the current single-sprite-per-block rendering with a bitmasked autotiling system. Each terrain block (Dirt, SoftRock, Stone, HardRock, Unbreakable) examines its 4 cardinal neighbors and selects one of 16 tile variants based on which neighbors share the same block group. Same-group neighbors produce connected tile variants; different-group neighbors produce edge/transition tile variants. This makes the mine look like continuous geological strata rather than a grid of identical squares.

**Tile groups** (blocks that connect to each other visually):
- Group A — Soil: `Dirt`, `SoftRock`
- Group B — Rock: `Stone`, `HardRock`, `Unbreakable`
- Special blocks (MineralNode, ArtifactNode, etc.) do NOT participate in autotiling — they render as isolated sprites

### Where
- **Create**: `src/game/systems/AutotileSystem.ts`
- **Create**: `src/assets/sprites/tiles/autotile/` — directory for autotile sprite sheets
- **Create**: `src/assets/sprites-hires/tiles/autotile/` — hi-res counterpart directory
- **Modify**: `src/game/scenes/MineScene.ts` — replace `drawBlockPattern()` for terrain blocks
- **Modify**: `src/game/spriteManifest.ts` — extend glob to include autotile subdirectory (already covered by `**/*.png`)

### How

#### Step 1 — Create `AutotileSystem.ts`

```typescript
// src/game/systems/AutotileSystem.ts

import { BlockType, type MineCell } from '../../data/types'

/**
 * Block groups for autotiling connectivity.
 * Blocks within the same group visually connect to each other.
 */
export const AUTOTILE_GROUPS: Record<number, 'soil' | 'rock' | 'special' | 'empty'> = {
  [BlockType.Empty]: 'empty',
  [BlockType.Dirt]: 'soil',
  [BlockType.SoftRock]: 'soil',
  [BlockType.Stone]: 'rock',
  [BlockType.HardRock]: 'rock',
  [BlockType.Unbreakable]: 'rock',
  // All other block types: 'special' (no autotiling)
}

/**
 * Returns the autotile group for a given BlockType.
 * Unknown types default to 'special'.
 */
export function getAutotileGroup(type: BlockType): 'soil' | 'rock' | 'special' | 'empty' {
  return AUTOTILE_GROUPS[type] ?? 'special'
}

/**
 * Calculates a 4-bit bitmask for a terrain block at (x, y).
 *
 * Bit layout (matches Terraria convention):
 *   bit 0 = UP    neighbor is same group
 *   bit 1 = RIGHT neighbor is same group
 *   bit 2 = DOWN  neighbor is same group
 *   bit 3 = LEFT  neighbor is same group
 *
 * Returns a value 0–15. Used to select which of 16 tile variants to render.
 *
 * @param grid   - The mine grid (grid[y][x])
 * @param x      - Target block column
 * @param y      - Target block row
 * @returns      - Bitmask integer 0–15
 */
export function computeBitmask(grid: MineCell[][], x: number, y: number): number {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  const myGroup = getAutotileGroup(grid[y][x].type)

  // Helper: is the neighbor at (nx, ny) in the same group?
  const matches = (nx: number, ny: number): boolean => {
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
      // Out-of-bounds treated as same group (border tiles connect inward)
      return true
    }
    return getAutotileGroup(grid[ny][nx].type) === myGroup
  }

  let mask = 0
  if (matches(x,     y - 1)) mask |= 1  // UP
  if (matches(x + 1, y    )) mask |= 2  // RIGHT
  if (matches(x,     y + 1)) mask |= 4  // DOWN
  if (matches(x - 1, y    )) mask |= 8  // LEFT

  return mask
}

/**
 * Returns the sprite key suffix for a given 4-bit bitmask.
 * Suffix is appended to the block group base key, e.g. "soil_tile_07".
 *
 * The 16 variants correspond to all combinations of 4 cardinal neighbors:
 *   0  = isolated (no connections)
 *   1  = up only
 *   2  = right only
 *   3  = up+right
 *   ... through ...
 *   15 = all four sides connected
 */
export function bitmaskToSpriteKey(group: 'soil' | 'rock', mask: number): string {
  // Zero-pad to 2 digits: 0→"00", 7→"07", 15→"15"
  const padded = String(mask).padStart(2, '0')
  return `autotile_${group}_${padded}`
}

/**
 * Whether a block type participates in autotiling.
 */
export function isAutotiledBlock(type: BlockType): boolean {
  const group = getAutotileGroup(type)
  return group === 'soil' || group === 'rock'
}
```

#### Step 2 — Generate Autotile Sprites

For each of the two groups (`soil`, `rock`), generate 16 sprite variants. Name them:
```
autotile_soil_00.png  through  autotile_soil_15.png
autotile_rock_00.png  through  autotile_rock_15.png
```

Each variant must visually indicate which sides are connected. Use the following conventions:
- `00` (isolated): rounded block, no connecting edges, slight drop shadow
- `01` (up): flat bottom edge, rounded sides/bottom, slight shadow on bottom
- `03` (up+right): interior corner at bottom-left
- `15` (all four): fully interior tile, seamless texture fill
- Edge tiles show a transition "lip" where the block meets empty space

**Generation workflow** (ComfyUI, one batch per group):
1. Prompt for `soil` group: `"seamless tileable underground dirt texture, top-down view, brown earthy sediment, pixel art, 32x32, transparent background for edge"` — generate at 1024×1024, downscale to 32px lo-res and 256px hi-res
2. Prompt for `rock` group: `"seamless tileable granite rock texture, underground, gray stone, pixel art, 32x32, transparent background for edge"`
3. Composite 16 variants programmatically: a Node.js script masks each 1024px base texture using an SVG path for each bitmask shape, then downscales
4. Place outputs in `src/assets/sprites/tiles/autotile/` (32px) and `src/assets/sprites-hires/tiles/autotile/` (256px)

**Minimum viable approach** (if ComfyUI is unavailable): hand-paint 16 variants at 32×32 in Aseprite using the existing `tile_dirt.png` and `tile_stone.png` as base textures.

#### Step 3 — Integrate into `MineScene.ts`

In `drawBlockPattern()`, replace the terrain block cases:

```typescript
// Before (in MineScene.ts drawBlockPattern):
case BlockType.Dirt:
  this.getPooledSprite('tile_dirt', cx, cy)
  break

// After:
case BlockType.Dirt:
case BlockType.SoftRock: {
  if (isAutotiledBlock(cell.type)) {
    const mask = computeBitmask(this.grid, tileX, tileY)
    const group: 'soil' | 'rock' = 'soil'
    const key = bitmaskToSpriteKey(group, mask)
    // Fallback to non-autotile sprite if autotile key doesn't exist yet
    const spriteKey = this.textures.exists(key) ? key : (cell.type === BlockType.Dirt ? 'tile_dirt' : 'tile_soft_rock')
    this.getPooledSprite(spriteKey, cx, cy)
  }
  break
}
case BlockType.Stone:
case BlockType.HardRock:
case BlockType.Unbreakable: {
  if (isAutotiledBlock(cell.type)) {
    const mask = computeBitmask(this.grid, tileX, tileY)
    const group: 'soil' | 'rock' = 'rock'
    const key = bitmaskToSpriteKey(group, mask)
    const fallback = cell.type === BlockType.Stone ? 'tile_stone'
      : cell.type === BlockType.HardRock ? 'tile_hard_rock'
      : 'tile_unbreakable'
    const spriteKey = this.textures.exists(key) ? key : fallback
    this.getPooledSprite(spriteKey, cx, cy)
  }
  break
}
```

**Important**: `computeBitmask()` must be called with the correct `(tileX, tileY)` grid coordinates, NOT the pixel coordinates `(px, py)`. The `drawBlockPattern` signature currently receives `tileX` and `tileY` — confirm these are already passed correctly (they are: `this.drawBlockPattern(cell, x, y, px, py)` where `x,y` are grid coords).

#### Step 4 — Dirty-tile Invalidation

The current `redrawAll()` redraws every visible tile every frame. Autotile masks are stable once computed (they only change when a neighboring block is mined). Add a bitmask cache:

```typescript
// In MineScene class, add:
private autotileMaskCache: Map<string, number> = new Map()

// In handleMoveOrMine(), after a block is destroyed:
// Invalidate the 3×3 neighborhood of the mined block
private invalidateAutotileCache(cx: number, cy: number): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      this.autotileMaskCache.delete(`${cx + dx},${cy + dy}`)
    }
  }
}

// In computeBitmask wrapper used by drawBlockPattern:
private getCachedBitmask(x: number, y: number): number {
  const key = `${x},${y}`
  if (!this.autotileMaskCache.has(key)) {
    this.autotileMaskCache.set(key, computeBitmask(this.grid, x, y))
  }
  return this.autotileMaskCache.get(key)!
}
```

### Acceptance Criteria
- [ ] Mining a dirt block causes all visible neighbors to immediately re-render with updated connection edges (no stale tiles)
- [ ] Two adjacent Dirt blocks display a seamless connected texture with no hard seam between them
- [ ] A Dirt block adjacent to a Stone block shows an edge/transition tile on the Dirt side
- [ ] All 16 bitmask variants exist as PNG files for both soil and rock groups
- [ ] `npm run typecheck` passes after all changes
- [ ] `npm run build` succeeds

### Playwright Test

```js
// Save as /tmp/test-autotile.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-autotile-before.png' })
  // Mine a few blocks by clicking adjacent to player
  // The screenshot should show seamless tile edges between same-type blocks
  await page.screenshot({ path: '/tmp/ss-autotile-after.png' })
  await browser.close()
  console.log('Screenshots saved: /tmp/ss-autotile-before.png and /tmp/ss-autotile-after.png')
})()
```

---

## Sub-Phase 7.2: Character Animation System

### What
Replace the static `miner_idle.png` Image with a Phaser sprite sheet supporting full animation states. The player character must visually respond to every action: idle, walking in four directions, mining in three directions (left, right, down — up-mining is disallowed by game design). In the mine, character faces the direction of last action. A state machine manages transitions between animation states.

**Animation states**:
| State | Frames | Trigger |
|---|---|---|
| `idle` | 4 | Player has not moved for 1+ ticks |
| `walk_left` | 6 | Player moved left |
| `walk_right` | 6 | Player moved right |
| `walk_up` | 6 | Player moved up |
| `walk_down` | 6 | Player moved down |
| `mine_left` | 8 | Mining a block to the left (wind-up→swing→impact→recovery) |
| `mine_right` | 8 | Mining a block to the right |
| `mine_down` | 8 | Mining a block below |

**Frame timing**:
- `idle`: 200ms/frame (slow, subtle)
- `walk_*`: 100ms/frame (brisk, purposeful)
- `mine_*`: 60ms/frame for swing frames, 120ms/frame for wind-up and recovery

### Where
- **Create**: `src/game/systems/AnimationSystem.ts` — state machine and transition logic
- **Create**: `src/assets/sprites/characters/miner_sheet.png` — sprite sheet (lo-res, each frame 32×32, laid out left-to-right in one row per animation state)
- **Create**: `src/assets/sprites-hires/characters/miner_sheet.png` — hi-res version (256×256 per frame)
- **Modify**: `src/game/entities/Player.ts` — add `facing` direction and animation state properties
- **Modify**: `src/game/scenes/MineScene.ts` — replace `playerSprite` (Image) with `playerSprite` (Sprite), load sheet, trigger animation transitions

### How

#### Step 1 — Create `AnimationSystem.ts`

```typescript
// src/game/systems/AnimationSystem.ts

export type MinerAnimState =
  | 'idle'
  | 'walk_left' | 'walk_right' | 'walk_up' | 'walk_down'
  | 'mine_left' | 'mine_right' | 'mine_down'

export type FacingDir = 'left' | 'right' | 'up' | 'down'

export interface AnimFrameConfig {
  key: MinerAnimState
  startFrame: number   // Index into the sprite sheet row
  frameCount: number
  frameRate: number    // fps
  repeat: number       // -1 = loop, 0 = play once
}

/**
 * Sprite sheet layout — each row is one animation state.
 * Total sheet width = max(frameCount) * FRAME_SIZE.
 * Row order must match this array order exactly.
 *
 * Sheet dimensions (lo-res): 8 frames × 8 rows = 256×256px (frame size 32×32)
 */
export const ANIM_CONFIGS: AnimFrameConfig[] = [
  { key: 'idle',       startFrame: 0,  frameCount: 4, frameRate: 5,  repeat: -1 },
  { key: 'walk_left',  startFrame: 4,  frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_right', startFrame: 10, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_up',    startFrame: 16, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_down',  startFrame: 22, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'mine_left',  startFrame: 28, frameCount: 8, frameRate: 14, repeat: 0  },
  { key: 'mine_right', startFrame: 36, frameCount: 8, frameRate: 14, repeat: 0  },
  { key: 'mine_down',  startFrame: 44, frameCount: 8, frameRate: 14, repeat: 0  },
]

/**
 * Determines the walk animation state from a movement delta.
 */
export function getWalkState(dx: number, dy: number): MinerAnimState {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'walk_left' : 'walk_right'
  }
  return dy < 0 ? 'walk_up' : 'walk_down'
}

/**
 * Determines the mine animation state from a target position relative to player.
 */
export function getMineState(dx: number, dy: number): MinerAnimState {
  if (dx < 0) return 'mine_left'
  if (dx > 0) return 'mine_right'
  // dy > 0 = mining down; dy < 0 = mining up (should be rare, treat as down)
  return 'mine_down'
}

/**
 * State machine controller — tracks current state and triggers Phaser animation playback.
 */
export class MinerAnimController {
  private currentState: MinerAnimState = 'idle'
  private isMining = false

  constructor(private sprite: Phaser.GameObjects.Sprite) {}

  /**
   * Registers all animation configs on the Phaser scene's animation manager.
   * Call once during MineScene.create() after the sprite is created.
   */
  registerAnims(scene: Phaser.Scene): void {
    for (const cfg of ANIM_CONFIGS) {
      if (!scene.anims.exists(cfg.key)) {
        // Generate frame objects from the sprite sheet key
        const frames = scene.anims.generateFrameNumbers('miner_sheet', {
          start: cfg.startFrame,
          end: cfg.startFrame + cfg.frameCount - 1,
        })
        scene.anims.create({
          key: cfg.key,
          frames,
          frameRate: cfg.frameRate,
          repeat: cfg.repeat,
        })
      }
    }
  }

  /** Transition to idle. Safe to call every frame when nothing is happening. */
  setIdle(): void {
    if (this.currentState !== 'idle') {
      this.currentState = 'idle'
      this.isMining = false
      this.sprite.play('idle', true)
    }
  }

  /** Trigger a walk animation for a movement delta. */
  setWalk(dx: number, dy: number): void {
    const state = getWalkState(dx, dy)
    if (this.currentState !== state) {
      this.currentState = state
      this.isMining = false
      this.sprite.play(state, true)
    }
  }

  /**
   * Trigger a mine animation for a mining action.
   * @param dx - Delta X from player to target block
   * @param dy - Delta Y from player to target block
   * @param onComplete - Callback invoked when the mine animation finishes playing
   */
  setMine(dx: number, dy: number, onComplete?: () => void): void {
    const state = getMineState(dx, dy)
    this.currentState = state
    this.isMining = true
    this.sprite.play(state, true)
    if (onComplete) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        onComplete()
        this.isMining = false
      })
    }
  }

  get isPlayingMineAnim(): boolean {
    return this.isMining
  }
}
```

#### Step 2 — Sprite Sheet Generation

Generate the miner sprite sheet via ComfyUI. The sheet must be a single PNG with all animation frames laid out in a horizontal strip.

**Prompt template** (adjust per state):
```
pixel art, 32x32, single miner character in futuristic mining suit, [STATE DESCRIPTION],
white background, centered, no background, single object, clean pixel art style,
game asset, sci-fi aesthetic
```

State descriptions:
- idle: "standing idle, slight breathing motion, holding pickaxe at side"
- walk: "walking [direction], pickaxe held at rest"
- mine: "swinging pickaxe [direction], wind-up then impact arc"

Generate each state at 1024×1024, downscale to 32×32 per frame, then composite horizontally into a single sheet PNG. Sheet must be named `miner_sheet.png`.

**Phaser sheet loading** — update `BootScene.preload()`:
```typescript
// Add to BootScene.preload() alongside existing this.load.image() calls:
this.load.spritesheet('miner_sheet', minerSheetUrl, {
  frameWidth: 32,
  frameHeight: 32,
})
```

The `miner_sheet` key is special and must NOT go through the generic `getSpriteUrls()` loop. Load it explicitly after the loop. The URL is retrieved from the manifest using the filename key `'miner_sheet'`.

#### Step 3 — Update `Player.ts`

```typescript
// Add to Player class:
public facing: 'left' | 'right' | 'up' | 'down' = 'down'
public lastMoveDx: number = 0
public lastMoveDy: number = 0

// In moveToEmpty(), record last movement direction:
public moveToEmpty(x: number, y: number, grid: MineCell[][]): boolean {
  // ... existing validation ...
  const dx = x - this.gridX
  const dy = y - this.gridY
  this.lastMoveDx = dx
  this.lastMoveDy = dy
  if (Math.abs(dx) > Math.abs(dy)) {
    this.facing = dx < 0 ? 'left' : 'right'
  } else {
    this.facing = dy < 0 ? 'up' : 'down'
  }
  this.gridX = x
  this.gridY = y
  return true
}
```

#### Step 4 — Update `MineScene.ts`

Replace the `playerSprite` Image with a Sprite and integrate the `MinerAnimController`:

```typescript
// In MineScene class, change:
private playerSprite!: Phaser.GameObjects.Image  // REMOVE
// To:
private playerSprite!: Phaser.GameObjects.Sprite
private animController!: MinerAnimController

// In create(), replace:
this.playerSprite = this.add.image(...)   // REMOVE
// With:
this.playerSprite = this.add.sprite(
  startX * TILE_SIZE + TILE_SIZE * 0.5,
  startY * TILE_SIZE + TILE_SIZE * 0.5,
  'miner_sheet'
)
this.playerSprite.setDisplaySize(TILE_SIZE, TILE_SIZE)
this.playerSprite.setDepth(10)
this.animController = new MinerAnimController(this.playerSprite)
this.animController.registerAnims(this)
this.animController.setIdle()
```

In `handleMoveOrMine()`, add animation triggers immediately after the action is resolved:

```typescript
// After player.moveToEmpty() succeeds (movement):
this.animController.setWalk(targetX - playerX, targetY - playerY)
// Schedule idle after 200ms of no further input:
this.time.delayedCall(200, () => {
  if (!this.animController.isPlayingMineAnim) {
    this.animController.setIdle()
  }
})

// After mineBlock() is called (mining hit):
const dx = targetX - playerX
const dy = targetY - playerY
this.animController.setMine(dx, dy, () => {
  this.animController.setIdle()
})
```

#### Step 5 — Lerp-Based Movement Interpolation

The current `drawPlayer()` snaps instantly to grid positions. Add smooth lerp interpolation for the visual position only (the logical grid position updates instantly to maintain movement-based time model integrity):

```typescript
// In MineScene class, add:
private playerVisualX: number = 0
private playerVisualY: number = 0
private MOVE_LERP = 0.25  // Fraction to close per frame at 60fps

// In create(), initialize:
this.playerVisualX = startX * TILE_SIZE + TILE_SIZE * 0.5
this.playerVisualY = startY * TILE_SIZE + TILE_SIZE * 0.5

// Replace drawPlayer():
private drawPlayer(): void {
  const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
  const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5
  // Lerp visual position toward logical position
  this.playerVisualX += (targetX - this.playerVisualX) * this.MOVE_LERP
  this.playerVisualY += (targetY - this.playerVisualY) * this.MOVE_LERP
  // Snap if within 1px to avoid floating-point drift
  if (Math.abs(this.playerVisualX - targetX) < 1) this.playerVisualX = targetX
  if (Math.abs(this.playerVisualY - targetY) < 1) this.playerVisualY = targetY
  this.playerSprite.setPosition(this.playerVisualX, this.playerVisualY)
}
```

### Acceptance Criteria
- [ ] Player character plays distinct animation when moving left vs right vs up vs down
- [ ] A pickaxe swing animation plays visibly when mining a block (not instant)
- [ ] Player returns to idle animation after ~200ms of no input
- [ ] Character smoothly slides between grid positions (no teleporting)
- [ ] `npm run typecheck` passes
- [ ] No TypeScript errors from `Phaser.GameObjects.Sprite` vs `Phaser.GameObjects.Image` confusion

### Playwright Test

```js
// Save as /tmp/test-anim.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Capture idle state
  await page.screenshot({ path: '/tmp/ss-anim-idle.png' })
  // Trigger mining via keyboard
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  await page.screenshot({ path: '/tmp/ss-anim-mine.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-anim-recover.png' })
  await browser.close()
  console.log('Animation screenshots saved to /tmp/ss-anim-*.png')
})()
```

---

## Sub-Phase 7.3: Camera and Zoom System

### What
The current camera shows the entire mine on desktop, removing all exploration tension. Implement a properly zoomed camera that keeps the player in view while showing only ~12×10 tiles at a time. Add a mini-map overlay in the corner showing the full layer with explored/unexplored areas and player position. Add pinch-to-zoom on mobile.

**Target**: At default zoom, the player sees approximately 12 tiles horizontally and 10 tiles vertically on a 390×844 mobile screen.

**Camera zoom level formula**:
```
tileSize = 32px
viewportWidth = camera.width (e.g., 390 for mobile)
targetTilesVisible = 12
zoomLevel = viewportWidth / (targetTilesVisible * tileSize)
// = 390 / (12 * 32) = 390 / 384 ≈ 1.015
// For desktop (800px wide): 800 / (12 * 32) ≈ 2.08
```

Use `this.cameras.main.setZoom(zoomLevel)` in `create()`.

### Where
- **Create**: `src/game/systems/CameraSystem.ts` — zoom calculation and pinch-to-zoom
- **Create**: `src/ui/components/MiniMap.svelte` — mini-map overlay component
- **Modify**: `src/game/scenes/MineScene.ts` — integrate camera zoom, expose grid state for mini-map
- **Modify**: `src/ui/GameOverlay.svelte` (or equivalent Svelte overlay) — mount `<MiniMap>` component

### How

#### Step 1 — Create `CameraSystem.ts`

```typescript
// src/game/systems/CameraSystem.ts

export interface CameraConfig {
  targetTilesX: number   // tiles visible horizontally (default: 12)
  targetTilesY: number   // tiles visible vertically (default: 10)
  lerpFactor: number     // camera follow lerp (default: 0.12)
  minZoom: number        // minimum zoom level (default: 0.5)
  maxZoom: number        // maximum zoom level (default: 3.0)
}

const DEFAULT_CONFIG: CameraConfig = {
  targetTilesX: 12,
  targetTilesY: 10,
  lerpFactor: 0.12,
  minZoom: 0.5,
  maxZoom: 3.0,
}

/**
 * Calculates the initial camera zoom level so that targetTilesX tiles
 * fit horizontally in the current viewport.
 */
export function calcInitialZoom(
  viewportWidth: number,
  tileSize: number,
  targetTilesX: number
): number {
  return viewportWidth / (targetTilesX * tileSize)
}

/**
 * Sets up camera bounds, zoom, and lerp-follow for a mine scene.
 * Call once in MineScene.create().
 */
export function setupCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldWidth: number,
  worldHeight: number,
  tileSize: number,
  config: Partial<CameraConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  camera.setBounds(0, 0, worldWidth, worldHeight)
  const zoom = calcInitialZoom(camera.width, tileSize, cfg.targetTilesX)
  camera.setZoom(Phaser.Math.Clamp(zoom, cfg.minZoom, cfg.maxZoom))
}
```

#### Step 2 — Replace Manual Camera Follow in `MineScene.ts`

Current `updateCameraTarget()` manually computes scroll. Replace with Phaser's built-in `startFollow()`:

```typescript
// In MineScene.create(), after creating playerSprite:
import { setupCamera } from '../systems/CameraSystem'

const worldWidth = this.gridWidth * TILE_SIZE
const worldHeight = this.gridHeight * TILE_SIZE
setupCamera(this.cameras.main, worldWidth, worldHeight, TILE_SIZE)
// Use Phaser's built-in lerp-follow on the sprite directly
this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12)

// Remove updateCameraTarget() and cameraTarget Zone — no longer needed
```

Update `updateCameraTarget()` to be empty or deleted, and remove `this.cameraTarget` from `redrawAll()`.

#### Step 3 — Pinch-to-Zoom (Mobile)

```typescript
// Add to MineScene.create() after setupCamera():
let initialPinchDistance = 0
let initialZoom = 1

this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
  // Phaser multi-touch: pointer.id >= 1 for second finger
})

// Use Phaser's built-in gesture plugin or handle manually:
this.input.addPointer(1) // Enable second touch point

// Track pinch via two-pointer distance comparison each update:
// (Store in update() body)
```

Add in `update()`:
```typescript
update(): void {
  // Pinch-to-zoom
  const pointers = this.input.manager.pointers
  const p1 = pointers[0]
  const p2 = pointers[1]
  if (p1.isDown && p2.isDown) {
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
    if (initialPinchDistance === 0) {
      initialPinchDistance = dist
      initialZoom = this.cameras.main.zoom
    } else {
      const newZoom = Phaser.Math.Clamp(
        initialZoom * (dist / initialPinchDistance),
        0.5, 3.0
      )
      this.cameras.main.setZoom(newZoom)
    }
  } else {
    initialPinchDistance = 0
  }
  this.redrawAll()
}
```

#### Step 4 — Mini-Map (`MiniMap.svelte`)

The mini-map renders a scaled-down version of the explored mine grid into a `<canvas>` element. It reads grid state from a Svelte store that MineScene updates each tick.

**Data flow**:
1. Add `miniMapData` Svelte store: `src/ui/stores/miniMap.ts`
2. MineScene emits `'minemap-update'` event with `{ grid: MineCell[][], playerX, playerY }` after each player action
3. `MiniMap.svelte` listens via `game.events.on('minemap-update', ...)` and redraws its canvas

```typescript
// src/ui/stores/miniMap.ts
import { writable } from 'svelte/store'
import type { MineCell } from '../../data/types'

export interface MiniMapData {
  grid: MineCell[][]
  playerX: number
  playerY: number
}

export const miniMapData = writable<MiniMapData | null>(null)
```

```svelte
<!-- src/ui/components/MiniMap.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { miniMapData } from '../stores/miniMap'
  import { BlockType } from '../../data/types'

  let canvas: HTMLCanvasElement
  const MINI_SCALE = 3  // px per grid cell in the mini-map

  // Color lookup for mini-map dots
  const MINI_COLORS: Partial<Record<BlockType, string>> = {
    [BlockType.Empty]:       '#3a3550',
    [BlockType.Dirt]:        '#5c4033',
    [BlockType.SoftRock]:    '#7a6652',
    [BlockType.Stone]:       '#6b6b6b',
    [BlockType.HardRock]:    '#4a4a4a',
    [BlockType.MineralNode]: '#4ecca3',
    [BlockType.ArtifactNode]:'#e94560',
    [BlockType.DescentShaft]:'#6633cc',
    [BlockType.ExitLadder]:  '#00ff88',
    [BlockType.OxygenCache]: '#5dade2',
    [BlockType.LavaBlock]:   '#cc3300',
    [BlockType.GasPocket]:   '#446633',
  }

  const unsub = miniMapData.subscribe((data) => {
    if (!data || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { grid, playerX, playerY } = data
    const rows = grid.length
    const cols = rows > 0 ? grid[0].length : 0
    canvas.width = cols * MINI_SCALE
    canvas.height = rows * MINI_SCALE
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x]
        if (!cell.revealed && (cell.visibilityLevel ?? 0) === 0) continue
        const color = MINI_COLORS[cell.type] ?? '#555555'
        ctx.fillStyle = color
        ctx.fillRect(x * MINI_SCALE, y * MINI_SCALE, MINI_SCALE, MINI_SCALE)
      }
    }
    // Player dot (bright white, 2×2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(playerX * MINI_SCALE, playerY * MINI_SCALE, MINI_SCALE + 1, MINI_SCALE + 1)
  })

  onDestroy(unsub)
</script>

<div class="minimap-wrapper">
  <canvas bind:this={canvas} class="minimap-canvas" />
</div>

<style>
  .minimap-wrapper {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    padding: 2px;
    pointer-events: none;
    z-index: 50;
  }
  .minimap-canvas {
    display: block;
    image-rendering: pixelated;
    max-width: 120px;
    max-height: 96px;
  }
</style>
```

Mount `<MiniMap>` in the Svelte overlay that wraps the Phaser canvas during mine runs.

In `MineScene.ts`, emit the update after each player action:
```typescript
// After revealAround() calls in handleMoveOrMine():
this.game.events.emit('minemap-update', {
  grid: this.grid,
  playerX: this.player.gridX,
  playerY: this.player.gridY,
})
```

### Acceptance Criteria
- [ ] At game start, the camera is zoomed in — the full mine grid is NOT visible
- [ ] Camera smoothly follows the player with visible lerp (not instant jump)
- [ ] Mini-map displays in top-right corner showing explored (colored) vs unexplored (dark) cells
- [ ] Player position is visible as a white dot on the mini-map
- [ ] Pinch-to-zoom works on mobile: two fingers spread apart zooms in, pinch together zooms out
- [ ] Zoom is clamped: cannot zoom out to see entire mine, cannot zoom in so far blocks fill screen
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-camera.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  // Test at mobile viewport
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-camera-mobile.png', fullPage: false })
  // Verify mini-map is visible in top-right
  const minimap = await page.$('.minimap-wrapper')
  console.log('MiniMap found:', !!minimap)
  await browser.close()
})()
```

---

## Sub-Phase 7.4: Particle Effects Engine

### What
Implement a layered particle system for all visual feedback moments. Particles are the most impactful tool for making the game feel alive and responsive. This sub-phase covers: block-break particles (per block type), ambient biome particles (continuous), and event-triggered particles (oxygen warning, hazard contact).

**Particle emitter inventory**:
| Name | Trigger | Biome | Color | Count | Lifetime |
|---|---|---|---|---|---|
| `break_dirt` | Dirt break | All | Brown `#5c4033` | 8 | 400ms |
| `break_rock` | Stone/SoftRock break | All | Gray `#6b6b6b` | 10 | 500ms |
| `break_hardrock` | HardRock break | All | Dark gray `#4a4a4a` | 12 | 600ms |
| `break_crystal` | MineralNode break | All | Cyan `#4ecca3` | 15 | 800ms |
| `break_artifact` | ArtifactNode break | All | Red `#e94560` | 20 | 1200ms |
| `ambient_ember` | Continuous | Volcanic | Orange `#ff6600` | 1/sec | 2000ms |
| `ambient_sparkle` | Continuous | Crystalline | Cyan `#88ffff` | 1/sec | 1500ms |
| `ambient_drip` | Continuous | Fossilized/Cave | Blue `#5dade2` | 0.5/sec | 1000ms |
| `ambient_spore` | Continuous | Fungal | Green `#88dd44` | 0.5/sec | 2500ms |
| `o2_warning` | O2 < 30% | All | Blue `#00aaff` | 2/sec | 800ms |

### Where
- **Create**: `src/game/systems/ParticleSystem.ts` — emitter management and per-biome setup
- **Modify**: `src/game/scenes/MineScene.ts` — replace simple `breakEmitter` with `ParticleSystem`, trigger ambient emitters in `create()`, trigger break emitters in `spawnBreakParticles()`

### How

#### Step 1 — Create `ParticleSystem.ts`

```typescript
// src/game/systems/ParticleSystem.ts

import { BlockType } from '../../data/types'
import type { Biome } from '../../data/biomes'

/** Per-block-type particle configuration */
interface BreakParticleConfig {
  tint: number
  count: number
  lifespan: number
  speed: { min: number; max: number }
  scale: { start: number; end: number }
  gravity?: number
}

const BREAK_CONFIGS: Partial<Record<BlockType, BreakParticleConfig>> = {
  [BlockType.Dirt]: {
    tint: 0x5c4033, count: 8, lifespan: 400,
    speed: { min: 20, max: 60 }, scale: { start: 0.8, end: 0 },
  },
  [BlockType.SoftRock]: {
    tint: 0x7a6652, count: 10, lifespan: 450,
    speed: { min: 25, max: 70 }, scale: { start: 0.9, end: 0 },
  },
  [BlockType.Stone]: {
    tint: 0x6b6b6b, count: 10, lifespan: 500,
    speed: { min: 30, max: 80 }, scale: { start: 1.0, end: 0 },
  },
  [BlockType.HardRock]: {
    tint: 0x4a4a4a, count: 14, lifespan: 600,
    speed: { min: 40, max: 100 }, scale: { start: 1.2, end: 0 },
    gravity: 150,
  },
  [BlockType.MineralNode]: {
    tint: 0x4ecca3, count: 16, lifespan: 800,
    speed: { min: 50, max: 120 }, scale: { start: 1.0, end: 0 },
  },
  [BlockType.ArtifactNode]: {
    tint: 0xe94560, count: 20, lifespan: 1200,
    speed: { min: 60, max: 150 }, scale: { start: 1.5, end: 0 },
  },
  [BlockType.LavaBlock]: {
    tint: 0xff4400, count: 18, lifespan: 1000,
    speed: { min: 40, max: 100 }, scale: { start: 1.2, end: 0 },
    gravity: 80,
  },
  [BlockType.GasPocket]: {
    tint: 0x33cc33, count: 12, lifespan: 1500,
    speed: { min: 15, max: 40 }, scale: { start: 1.5, end: 0 },
  },
}

/** Default break config for unspecified block types */
const DEFAULT_BREAK_CONFIG: BreakParticleConfig = {
  tint: 0x888888, count: 6, lifespan: 400,
  speed: { min: 20, max: 60 }, scale: { start: 0.8, end: 0 },
}

export class ParticleSystem {
  private breakEmitters: Map<BlockType, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()
  private ambientEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private o2EmitterLeft!: Phaser.GameObjects.Particles.ParticleEmitter
  private o2EmitterRight!: Phaser.GameObjects.Particles.ParticleEmitter
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Create a small square texture for particles if it doesn't already exist.
   * Phaser's particle system requires a texture key.
   */
  private ensureTexture(key: string, size: number = 4): void {
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, size, size)
      g.generateTexture(key, size, size)
      g.destroy()
    }
  }

  /**
   * Initialize all emitters. Call once in MineScene.create().
   */
  init(): void {
    this.ensureTexture('particle_square', 4)
    this.ensureTexture('particle_circle', 6)

    // Create break emitters (one per configured block type)
    for (const [blockTypeStr, cfg] of Object.entries(BREAK_CONFIGS)) {
      const blockType = Number(blockTypeStr) as BlockType
      const emitter = this.scene.add.particles(0, 0, 'particle_square', {
        speed: cfg.speed,
        angle: { min: 0, max: 360 },
        scale: cfg.scale,
        lifespan: cfg.lifespan,
        quantity: cfg.count,
        emitting: false,
        tint: cfg.tint,
        gravityY: cfg.gravity ?? 100,
      })
      emitter.setDepth(15)
      this.breakEmitters.set(blockType, emitter)
    }

    // O2 warning emitters (left and right edges of screen)
    this.o2EmitterLeft = this.scene.add.particles(0, 0, 'particle_circle', {
      speed: { min: 10, max: 30 },
      angle: { min: -30, max: 30 },
      scale: { start: 0.8, end: 0 },
      lifespan: 800,
      frequency: 500,  // ms between emissions
      quantity: 1,
      tint: 0x00aaff,
      emitting: false,
    })
    this.o2EmitterLeft.setDepth(100)

    this.o2EmitterRight = this.scene.add.particles(0, 0, 'particle_circle', {
      speed: { min: 10, max: 30 },
      angle: { min: 150, max: 210 },
      scale: { start: 0.8, end: 0 },
      lifespan: 800,
      frequency: 500,
      quantity: 1,
      tint: 0x00aaff,
      emitting: false,
    })
    this.o2EmitterRight.setDepth(100)
  }

  /**
   * Start biome-specific ambient particle emitters.
   * Call after the biome is determined in MineScene.create().
   */
  startAmbientEmitters(biome: Biome, worldWidth: number, worldHeight: number): void {
    // Stop any existing ambient emitters
    this.stopAmbientEmitters()

    if (biome.id === 'volcanic') {
      // Embers rising from bottom of world — randomly distributed X
      for (let i = 0; i < 5; i++) {
        const ex = (worldWidth / 5) * i + Math.random() * (worldWidth / 5)
        const emitter = this.scene.add.particles(ex, worldHeight - 32, 'particle_square', {
          speed: { min: 20, max: 60 },
          angle: { min: -100, max: -80 },  // upward
          scale: { start: 0.6, end: 0 },
          lifespan: 2000,
          frequency: 200,
          quantity: 1,
          tint: 0xff6600,
          alpha: { start: 0.9, end: 0 },
        })
        emitter.setDepth(12)
        this.ambientEmitters.push(emitter)
      }
    }

    if (biome.id === 'crystalline') {
      // Sparkles scattered in the world
      for (let i = 0; i < 8; i++) {
        const ex = Math.random() * worldWidth
        const ey = Math.random() * worldHeight
        const emitter = this.scene.add.particles(ex, ey, 'particle_square', {
          speed: { min: 5, max: 20 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.4, end: 0 },
          lifespan: 1500,
          frequency: 800,
          quantity: 1,
          tint: 0x88ffff,
          alpha: { start: 1.0, end: 0 },
        })
        emitter.setDepth(12)
        this.ambientEmitters.push(emitter)
      }
    }
  }

  /**
   * Stop and destroy all ambient emitters.
   */
  stopAmbientEmitters(): void {
    for (const emitter of this.ambientEmitters) {
      emitter.stop()
      emitter.destroy()
    }
    this.ambientEmitters = []
  }

  /**
   * Trigger a block-break particle burst at world pixel position (px, py).
   */
  emitBreak(blockType: BlockType, px: number, py: number): void {
    const emitter = this.breakEmitters.get(blockType)
    if (emitter) {
      emitter.setPosition(px, py)
      emitter.explode()
    } else {
      // Use default config for unmapped block types
      const fallback = this.breakEmitters.get(BlockType.Dirt)
      if (fallback) {
        fallback.setPosition(px, py)
        fallback.explode(DEFAULT_BREAK_CONFIG.count)
      }
    }
  }

  /**
   * Toggle O2 warning particle emission.
   * @param active - true when O2 < 30% threshold
   * @param cameraScrollX - Current camera scroll X to position edge emitters correctly
   * @param cameraScrollY - Current camera scroll Y
   * @param viewWidth - Viewport width
   * @param viewHeight - Viewport height
   */
  setO2Warning(
    active: boolean,
    cameraScrollX: number,
    cameraScrollY: number,
    viewWidth: number,
    viewHeight: number
  ): void {
    if (active) {
      const midY = cameraScrollY + viewHeight / 2
      this.o2EmitterLeft.setPosition(cameraScrollX + 10, midY)
      this.o2EmitterRight.setPosition(cameraScrollX + viewWidth - 10, midY)
      if (!this.o2EmitterLeft.emitting) this.o2EmitterLeft.start()
      if (!this.o2EmitterRight.emitting) this.o2EmitterRight.start()
    } else {
      this.o2EmitterLeft.stop()
      this.o2EmitterRight.stop()
    }
  }

  /**
   * Clean up all emitters. Call in MineScene shutdown().
   */
  destroy(): void {
    this.stopAmbientEmitters()
    for (const emitter of this.breakEmitters.values()) {
      emitter.destroy()
    }
    this.breakEmitters.clear()
    this.o2EmitterLeft?.destroy()
    this.o2EmitterRight?.destroy()
  }
}
```

#### Step 2 — Integrate into `MineScene.ts`

```typescript
// In MineScene class, replace:
private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
// With:
private particles!: ParticleSystem

// In create(), replace breakEmitter setup with:
this.particles = new ParticleSystem(this)
this.particles.init()
this.particles.startAmbientEmitters(this.currentBiome, worldWidth, worldHeight)

// In spawnBreakParticles():
private spawnBreakParticles(px: number, py: number, blockType: BlockType): void {
  this.particles.emitBreak(blockType, px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5)
}

// In update(), add O2 warning check:
const oxygenPct = this.oxygenState.current / this.oxygenState.max
const cam = this.cameras.main
this.particles.setO2Warning(
  oxygenPct < 0.3,
  cam.scrollX, cam.scrollY,
  cam.width, cam.height
)
```

### Acceptance Criteria
- [ ] Mining a Dirt block produces brown crumbling particles visually distinct from Stone (gray sparks)
- [ ] Mining a MineralNode produces bright cyan particle burst with more particles than terrain breaks
- [ ] Volcanic biome has continuous upward-rising ember particles in the background
- [ ] Crystalline biome has continuous sparkle particles
- [ ] When O2 drops below 30%, blue particles pulse from the left and right edges of the viewport
- [ ] No `console.error` or `console.warn` about particle emitter configuration
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-particles.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Mine a block and capture mid-burst
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(80)
  await page.screenshot({ path: '/tmp/ss-particles-break.png' })
  // Wait for particles to settle
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/ss-particles-settled.png' })
  await browser.close()
  console.log('Particle screenshots: /tmp/ss-particles-*.png')
})()
```

---

## Sub-Phase 7.5: Loot Physics and Juice

### What
When a block breaks, any yielded minerals or items must visibly pop out with a physics arc, hang in the air briefly, then get "sucked" toward the player with a satisfying motion. The collect animation must feel rewarding — the heavier the mineral tier, the more dramatic the pop and collect sequence.

**Sequence for a single loot piece**:
1. Block breaks → loot sprite appears at block center with random upward velocity
2. Physics arc: gravity pulls loot down, it bounces up and settles at a "resting" position ~1 tile above break point (250ms)
3. Suck animation: loot accelerates toward player position over 400ms
4. On arrival: backpack icon in HUD flashes gold for 200ms
5. If artifact: distinct full-screen flash + GAIA toast trigger

**Escalating rarity reveal animations** (artifact only, per DD-V2-013 and DD-V2-380 from roadmap 7.5):
- `common`: Subtle shimmer on the loot sprite (2 frames: normal → slight glow)
- `uncommon`: Gentle sparkle particle ring
- `rare`: Upward sparkle burst, brief light column
- `epic`: Full-tile radial burst, multi-color sparks, brief screen tint
- `legendary`: Full-screen particle lightshow, screen flash, GAIA voice line trigger
- `mythic`: Prismatic animated overlay (rainbow cycle), screen pause + unique sound cue

### Where
- **Create**: `src/game/systems/LootPopSystem.ts`
- **Modify**: `src/game/scenes/MineScene.ts` — call `LootPopSystem.popLoot()` after `mineBlock()` returns `destroyed: true` with content

### How

#### Step 1 — Create `LootPopSystem.ts`

```typescript
// src/game/systems/LootPopSystem.ts

import type { Rarity } from '../../data/types'

interface LootPopConfig {
  spriteKey: string
  worldX: number
  worldY: number
  targetX: number
  targetY: number
  rarity?: Rarity
  onComplete?: () => void
}

export class LootPopSystem {
  private scene: Phaser.Scene
  private activePops: Phaser.GameObjects.Image[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Spawn a loot item with physics pop + suck-to-player animation.
   */
  popLoot(config: LootPopConfig): void {
    const { spriteKey, worldX, worldY, targetX, targetY, rarity, onComplete } = config

    const sprite = this.scene.add.image(worldX, worldY, spriteKey)
    sprite.setDisplaySize(16, 16)
    sprite.setDepth(20)
    this.activePops.push(sprite)

    // Phase 1: physics arc upward (200ms)
    const arcX = worldX + (Math.random() - 0.5) * 24
    const arcY = worldY - 24 - Math.random() * 16
    this.scene.tweens.add({
      targets: sprite,
      x: arcX,
      y: arcY,
      ease: 'Quad.Out',
      duration: 200,
      onComplete: () => {
        // Phase 2: gravity settle (150ms)
        this.scene.tweens.add({
          targets: sprite,
          y: arcY + 8,
          ease: 'Quad.In',
          duration: 150,
          onComplete: () => {
            // Phase 3: suck toward player (350ms, accelerating)
            this.scene.tweens.add({
              targets: sprite,
              x: targetX,
              y: targetY,
              scale: 0,
              ease: 'Quad.In',
              duration: 350,
              onComplete: () => {
                sprite.destroy()
                const idx = this.activePops.indexOf(sprite)
                if (idx >= 0) this.activePops.splice(idx, 1)
                onComplete?.()
              }
            })
          }
        })
      }
    })

    // Rarity-based overlay effects (played immediately on pop, not waiting for suck)
    this.playRarityEffect(rarity, worldX, worldY)
  }

  /**
   * Play a rarity reveal effect at the given world position.
   */
  private playRarityEffect(rarity: Rarity | undefined, x: number, y: number): void {
    if (!rarity || rarity === 'common') return

    if (rarity === 'uncommon') {
      this.emitSparkleRing(x, y, 0xaaffaa, 8)
    } else if (rarity === 'rare') {
      this.emitSparkleRing(x, y, 0x4488ff, 14)
      this.spawnLightColumn(x, y, 0x4488ff)
    } else if (rarity === 'epic') {
      this.emitSparkleRing(x, y, 0xdd44ff, 20)
      this.emitSparkleRing(x, y, 0xff88ff, 12)
      this.flashScreen(0x330044, 0.3, 300)
    } else if (rarity === 'legendary') {
      this.emitSparkleRing(x, y, 0xffd700, 30)
      this.emitSparkleRing(x, y, 0xff8800, 20)
      this.flashScreen(0x221100, 0.6, 500)
    } else if (rarity === 'mythic') {
      this.emitSparkleRing(x, y, 0xff00ff, 40)
      this.emitSparkleRing(x, y, 0x00ffff, 30)
      this.emitSparkleRing(x, y, 0xffd700, 20)
      this.flashScreen(0x110022, 0.8, 800)
    }
  }

  private emitSparkleRing(x: number, y: number, tint: number, count: number): void {
    if (!this.scene.textures.exists('particle_square')) return
    const emitter = this.scene.add.particles(x, y, 'particle_square', {
      speed: { min: 40, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: count,
      tint,
      emitting: false,
    })
    emitter.setDepth(25)
    emitter.explode(count)
    this.scene.time.delayedCall(700, () => emitter.destroy())
  }

  private spawnLightColumn(x: number, y: number, tint: number): void {
    const rect = this.scene.add.rectangle(x, y - 40, 8, 80, tint, 0.4)
    rect.setDepth(22)
    this.scene.tweens.add({
      targets: rect,
      alpha: 0,
      scaleY: 2,
      duration: 400,
      ease: 'Quad.Out',
      onComplete: () => rect.destroy(),
    })
  }

  private flashScreen(color: number, alpha: number, duration: number): void {
    const cam = this.scene.cameras.main
    cam.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false)
  }

  /**
   * Destroy all active pop sprites. Call on scene shutdown.
   */
  destroy(): void {
    for (const s of this.activePops) s.destroy()
    this.activePops = []
  }
}
```

#### Step 2 — Wire into `MineScene.ts`

```typescript
// In MineScene class, add:
private lootPop!: LootPopSystem

// In create():
this.lootPop = new LootPopSystem(this)

// In handleMoveOrMine(), after mineBlock() returns destroyed content:
// (Find where mineResult.content is used and loot is added to inventory)
// Add before/after the inventory push:
if (mineResult.destroyed && mineResult.content) {
  const blockPx = targetX * TILE_SIZE + TILE_SIZE * 0.5
  const blockPy = targetY * TILE_SIZE + TILE_SIZE * 0.5
  const playerPx = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
  const playerPy = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5

  const spriteKey = mineResult.content.mineralType
    ? `block_mineral_${mineResult.content.mineralType}`
    : mineResult.content.artifactRarity ? 'block_artifact'
    : 'block_mineral_dust'

  this.lootPop.popLoot({
    spriteKey,
    worldX: blockPx,
    worldY: blockPy,
    targetX: playerPx,
    targetY: playerPy,
    rarity: mineResult.content.artifactRarity,
    onComplete: () => {
      // Emit HUD flash event
      this.game.events.emit('loot-collected', { content: mineResult.content })
    }
  })
}
```

**Descent shaft animation** — layer transition (per DD-V2-021):
Add in MineScene when `BlockType.DescentShaft` is activated:

```typescript
// Before transitioning scenes, play a falling animation:
private playDescentAnimation(onComplete: () => void): void {
  // Camera zooms in and pans down to give sense of falling
  this.tweens.add({
    targets: this.cameras.main,
    zoom: this.cameras.main.zoom * 1.5,
    duration: 600,
    ease: 'Quad.In',
    onComplete: () => {
      // Flash to black
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', onComplete)
    }
  })
}
```

### Acceptance Criteria
- [ ] Breaking any block with mineral content shows a visible loot-pop arc before the item disappears
- [ ] Common minerals have a subtle pop; artifact breaks produce a visibly larger particle effect
- [ ] Legendary artifact break produces a full-screen flash visible in a screenshot
- [ ] Loot moves toward player position (not a fixed screen corner)
- [ ] No loot sprites leak between scenes (all destroyed on scene shutdown)
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-lootpop.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Use DevPanel to give the player a mineral node adjacent, then mine it
  // For now, mine several blocks and capture the mid-flight loot
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(40)
  await page.screenshot({ path: '/tmp/ss-loot-pop.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-loot-settled.png' })
  await browser.close()
  console.log('Loot pop screenshots: /tmp/ss-loot-*.png')
})()
```

---

## Sub-Phase 7.6: Sprite-Based Crack Overlays

### What
Replace the current procedural vector crack drawing (`drawCracks()` in `MineScene.ts`) with sprite-based crack overlays. Two crack sprites already exist: `crack_small.png` and `crack_large.png` in `src/assets/sprites/tiles/`. Extend to 4 stages using these as the basis.

**4 damage stages** (mapped to `damagePercent` 0→1):
- Stage 0 (`0–0.25`): No overlay — block looks pristine
- Stage 1 (`0.26–0.50`): `crack_stage1` — hairline crack, one thin diagonal line across center
- Stage 2 (`0.51–0.75`): `crack_stage2` — `crack_small.png` — medium crack with 2-3 branching lines
- Stage 3 (`0.76–0.99`): `crack_stage3` — `crack_large.png` — major fractures with crumbling edge detail

**Per-block-type crack tinting**:
- Dirt: lighter brown cracks (`0x6b3a2a`)
- Rock types: dark gray cracks (`0x2a2a2a`)
- Hazards (Lava, Gas): colored cracks matching block theme

### Where
- **Create**: `src/assets/sprites/tiles/crack_stage1.png` — new hairline crack sprite (32×32 transparent PNG)
- **Modify**: `src/game/scenes/MineScene.ts` — replace `drawCracks()` with sprite-based approach in `drawBlockPattern()` / as overlay

### How

#### Step 1 — Generate `crack_stage1.png`

This is a minimal hairline crack sprite: transparent background, single diagonal dark gray line from top-left to bottom-right with two small branches. Draw this at 32×32 in Aseprite or generate with ComfyUI:

Prompt: `"pixel art 32x32 hairline crack texture overlay, single thin diagonal crack, transparent background, dark gray crack line, no color, just the crack lines"`

Also generate `crack_stage4.png` (crumbling edges, more severe than `crack_large.png`) as a 4th stage beyond the existing assets.

#### Step 2 — Load crack sprites in `BootScene.ts`

The existing `getSpriteUrls()` glob covers `src/assets/sprites/**/*.png`, so `crack_stage1.png`, `crack_stage2.png` (alias for `crack_small.png`), etc. will be loaded automatically as long as they are in the `tiles/` directory. Verify the keys after build.

**Sprite key mapping** (from filename):
- `crack_stage1` → `src/assets/sprites/tiles/crack_stage1.png`
- `crack_small` → `src/assets/sprites/tiles/crack_small.png` (use as stage 2)
- `crack_large` → `src/assets/sprites/tiles/crack_large.png` (use as stage 3)
- `crack_stage4` → `src/assets/sprites/tiles/crack_stage4.png`

#### Step 3 — Replace `drawCracks()` in `MineScene.ts`

```typescript
// Replace the entire drawCracks() method:
private drawCrackOverlay(
  cell: MineCell,
  tileX: number, tileY: number,
  px: number, py: number
): void {
  if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) return

  const damagePercent = 1 - cell.hardness / cell.maxHardness
  if (damagePercent < 0.25) return  // Stage 0: pristine

  const cx = px + TILE_SIZE * 0.5
  const cy = py + TILE_SIZE * 0.5

  // Select crack sprite key based on damage stage
  let crackKey: string
  if (damagePercent < 0.50) {
    crackKey = 'crack_stage1'  // hairline
  } else if (damagePercent < 0.75) {
    crackKey = 'crack_small'   // medium fractures
  } else {
    crackKey = 'crack_large'   // severe breaks
  }

  // Check texture exists before rendering (graceful fallback)
  if (!this.textures.exists(crackKey)) {
    // Fall back to legacy procedural cracks
    this.drawLegacyCracks(px, py, tileX, tileY, damagePercent)
    return
  }

  const crackSprite = this.getPooledSprite(crackKey, cx, cy)
  crackSprite.setDepth(8)  // Between tile (5) and overlay graphics (7) — actually just above overlay
  crackSprite.setAlpha(0.7 + damagePercent * 0.3)  // More opaque as damage increases

  // Tint cracks per block type
  if (cell.type === BlockType.Dirt || cell.type === BlockType.SoftRock) {
    crackSprite.setTint(0x6b3a2a)
  } else if (cell.type === BlockType.LavaBlock) {
    crackSprite.setTint(0xcc2200)
  } else if (cell.type === BlockType.GasPocket) {
    crackSprite.setTint(0x224422)
  } else {
    crackSprite.setTint(0x2a2a2a)  // default dark gray for rock types
  }
}

// Keep drawLegacyCracks() as the old drawCracks() renamed — only called as fallback
private drawLegacyCracks(...) { /* existing drawCracks() body */ }
```

Update the call site in `drawTiles()`:
```typescript
// Replace:
this.drawCracks(px, py, x, y, damagePercent)
// With:
this.drawCrackOverlay(cell, x, y, px, py)
```

**Depth conflict**: crack sprites need to appear on top of block sprites (depth 5) but below the fog overlay (depth 7). Set crack sprite depth to `6` or use the `overlayGraphics` at depth 7. The cleanest approach is depth 6 for cracks via the pooled sprite system.

### Acceptance Criteria
- [ ] A block with 1 hit remaining shows the `crack_large` sprite visually on top of the block sprite
- [ ] A block with 50% health shows the `crack_small` sprite
- [ ] Dirt cracks appear brown-tinted; Stone cracks appear dark gray
- [ ] No cracks visible on a block at full health
- [ ] Crack sprites update instantly when a block is hit (no 1-frame delay)
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-cracks.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Hit a stone block once
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  await page.screenshot({ path: '/tmp/ss-crack-stage1.png' })
  // Hit again
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  await page.screenshot({ path: '/tmp/ss-crack-stage2.png' })
  await browser.close()
  console.log('Crack screenshots: /tmp/ss-crack-*.png')
})()
```

---

## Sub-Phase 7.7: Block Idle Animations

### What
Give special blocks subtle looping animations that make the mine feel alive. These are visual-only effects that do not affect gameplay logic. Animations are frame-based (using sprite sheets with 2–6 frames) or achieved via Phaser tweens on overlays.

**Animation specification per block type**:
| Block | Animation | Frames | Period |
|---|---|---|---|
| MineralNode (crystal/geode/essence) | Glint/shimmer | 3 | 1.5s loop |
| ArtifactNode | Glow pulse | 4 | 2.0s loop |
| FossilNode | Bone shimmer | 3 | 3.0s loop |
| QuizGate | Pulsing energy | 4 | 1.0s loop |
| OxygenCache | Floating bubble | 4 | 1.8s loop |
| LavaBlock | Bubbling | 6 | 0.8s loop |
| GasPocket | Swirling mist | 4 | 1.2s loop |
| DescentShaft | Vortex rotation | 6 | 2.0s loop |
| UpgradeCrate | Golden gleam | 3 | 3.0s loop |
| RelicShrine | Aura wisps | 4 | 2.5s loop |

### Where
- **Create**: `src/game/systems/BlockAnimSystem.ts` — manages per-block-type animation state using time-based frame selection
- **Modify**: `src/game/scenes/MineScene.ts` — call `BlockAnimSystem.getFrameKey()` in `drawBlockPattern()` for animated block types
- **Create**: Additional sprite frames in `src/assets/sprites/tiles/` (e.g., `block_lava_01.png` through `block_lava_05.png`)

### How

#### Step 1 — Create `BlockAnimSystem.ts`

This system uses time-based frame cycling rather than Phaser's animation manager (since blocks are drawn with pooled sprites via Graphics, not managed Sprite objects):

```typescript
// src/game/systems/BlockAnimSystem.ts

import { BlockType } from '../../data/types'

interface BlockAnimConfig {
  /** Array of sprite keys to cycle through, in order */
  frames: string[]
  /** Total animation loop duration in milliseconds */
  periodMs: number
}

/**
 * Animation configurations per animated block type.
 * Keys are Phaser sprite keys. Add frames by generating
 * additional PNG files named block_X_01.png, block_X_02.png, etc.
 */
const BLOCK_ANIM_CONFIGS: Partial<Record<BlockType, BlockAnimConfig>> = {
  [BlockType.LavaBlock]: {
    frames: ['block_lava', 'block_lava_01', 'block_lava_02', 'block_lava_03', 'block_lava_04', 'block_lava_05'],
    periodMs: 800,
  },
  [BlockType.GasPocket]: {
    frames: ['block_gas', 'block_gas_01', 'block_gas_02', 'block_gas_03'],
    periodMs: 1200,
  },
  [BlockType.DescentShaft]: {
    frames: ['block_descent_shaft', 'block_descent_shaft_01', 'block_descent_shaft_02',
             'block_descent_shaft_03', 'block_descent_shaft_04', 'block_descent_shaft_05'],
    periodMs: 2000,
  },
  [BlockType.QuizGate]: {
    frames: ['block_quiz_gate', 'block_quiz_gate_01', 'block_quiz_gate_02', 'block_quiz_gate_03'],
    periodMs: 1000,
  },
  [BlockType.MineralNode]: {
    // Shared shimmer frames — blend with mineral-specific sprite via tint in parent
    frames: ['block_mineral_shimmer_00', 'block_mineral_shimmer_01', 'block_mineral_shimmer_02'],
    periodMs: 1500,
  },
  [BlockType.ArtifactNode]: {
    frames: ['block_artifact', 'block_artifact_01', 'block_artifact_02', 'block_artifact_03'],
    periodMs: 2000,
  },
  [BlockType.RelicShrine]: {
    frames: ['block_relic_shrine', 'block_relic_shrine_01', 'block_relic_shrine_02', 'block_relic_shrine_03'],
    periodMs: 2500,
  },
  [BlockType.OxygenCache]: {
    frames: ['block_oxygen_cache', 'block_oxygen_cache_01', 'block_oxygen_cache_02', 'block_oxygen_cache_03'],
    periodMs: 1800,
  },
  [BlockType.UpgradeCrate]: {
    frames: ['block_upgrade_crate', 'block_upgrade_crate_01', 'block_upgrade_crate_02'],
    periodMs: 3000,
  },
  [BlockType.FossilNode]: {
    frames: ['block_fossil', 'block_fossil_01', 'block_fossil_02'],
    periodMs: 3000,
  },
}

export class BlockAnimSystem {
  /**
   * Returns the current sprite key for an animated block type,
   * based on the elapsed game time.
   *
   * @param blockType - The type of block to animate
   * @param nowMs     - Current time in milliseconds (from Phaser's this.time.now)
   * @param textures  - Phaser TextureManager to verify key existence
   * @returns Sprite key string, or null if this block type has no animation config
   */
  static getFrameKey(
    blockType: BlockType,
    nowMs: number,
    textures: Phaser.Textures.TextureManager
  ): string | null {
    const cfg = BLOCK_ANIM_CONFIGS[blockType]
    if (!cfg) return null

    const frameIdx = Math.floor((nowMs % cfg.periodMs) / cfg.periodMs * cfg.frames.length)
    const key = cfg.frames[frameIdx]

    // Graceful fallback: if frame sprite doesn't exist, use first frame
    if (!textures.exists(key)) {
      return textures.exists(cfg.frames[0]) ? cfg.frames[0] : null
    }
    return key
  }

  /**
   * Returns whether a given block type has an idle animation.
   */
  static isAnimated(blockType: BlockType): boolean {
    return BLOCK_ANIM_CONFIGS[blockType] !== undefined
  }
}
```

#### Step 2 — Integrate in `drawBlockPattern()`

For each animated block type, check `BlockAnimSystem.isAnimated()` and use `getFrameKey()` instead of the static sprite key:

```typescript
// Example for LavaBlock (repeat pattern for all animated types):
case BlockType.LavaBlock: {
  const animKey = BlockAnimSystem.getFrameKey(BlockType.LavaBlock, this.time.now, this.textures)
  this.getPooledSprite(animKey ?? 'block_lava', cx, cy)
  // Keep the existing lava glow overlay dot...
  break
}
```

Apply the same pattern for: `GasPocket`, `DescentShaft`, `QuizGate`, `MineralNode`, `ArtifactNode`, `RelicShrine`, `OxygenCache`, `UpgradeCrate`, `FossilNode`.

#### Step 3 — Generate Animation Frames

For each animated block, generate additional frames via ComfyUI. Use existing frames as reference and animate:

**Lava frames** (5 additional): Generate each with slightly different bubble positions, surface ripple offset. Prompt: `"pixel art 32x32 lava block frame [N], molten rock surface, bubbling texture, orange red glow, single tile, transparent background"`

**Gas frames** (3 additional): Swirling green mist at different rotation phases.

**DescentShaft frames** (5 additional): Vortex portal with each frame rotating the swirl pattern by 60°.

Naming convention: `block_TYPE_01.png`, `block_TYPE_02.png`, etc. Place in `src/assets/sprites/tiles/` and `src/assets/sprites-hires/tiles/`.

### Acceptance Criteria
- [ ] Lava blocks animate visibly (frame changes are perceptible at normal zoom)
- [ ] Gas pocket blocks show a subtle swirling motion when revealed
- [ ] Descent shaft shows a vortex/portal animation
- [ ] MineralNode blocks have a gentle shimmer/glint
- [ ] Animation frames load gracefully — missing frames fall back to the base frame without errors
- [ ] No performance regression: 60fps maintained with 20+ animated blocks on screen simultaneously
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-idle-anim.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-idle-frame0.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-idle-frame1.png' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-idle-frame2.png' })
  // Visually compare: lava/gas/descent blocks should look different across frames
  await browser.close()
  console.log('Idle animation screenshots: /tmp/ss-idle-frame*.png')
})()
```

---

## Sub-Phase 7.8: Mining Satisfaction — "The Pickaxe Feel"

**This is the most important sub-phase in Phase 7. Design decisions DD-V2-012B explicitly calls this a dedicated design sprint with required playtesting and iteration. It is NOT one-and-done.**

### What
Design an ultra-satisfying mining feedback loop that rivals Stardew Valley (pickaxe swing) and Motherload (drill animation) — the two genre benchmarks. Every block hit must feel impactful. Progressive hits on the same block must escalate in intensity. The final breaking hit must feel climactic and distinctly different from preceding hits.

**System components**:
1. Pickaxe swing animation integration (from 7.2 — now applied with impact timing)
2. Screen micro-shake system (intensity scaled by block hardness and hit number)
3. Per-block hit flash (white flash on impacted block, decays in 80ms)
4. Per-block-type impact profiles
5. Progressive hit escalation (each hit on same multi-hit block feels more impactful)
6. Climactic break animation (final hit only)
7. Haptic feedback (Capacitor API — mobile only)
8. Pickaxe tier visual differences
9. Rhythm/flow-state optimization
10. Dedicated playtesting iteration log

### Where
- **Create**: `src/game/systems/ImpactSystem.ts` — screen shake, flash, haptic coordination
- **Modify**: `src/game/scenes/MineScene.ts` — integrate ImpactSystem calls in `handleMoveOrMine()`
- **Modify**: `src/game/entities/Player.ts` — track per-block hit count for escalation
- **Modify**: `src/data/balance.ts` — add impact profile constants

### How

#### Step 1 — Per-Block Hit Count Tracking

Add to `Player.ts`:
```typescript
// Track how many times each block has been hit this attempt (for escalation)
private blockHitCounts: Map<string, number> = new Map()

public recordHit(x: number, y: number): number {
  const key = `${x},${y}`
  const count = (this.blockHitCounts.get(key) ?? 0) + 1
  this.blockHitCounts.set(key, count)
  return count
}

public clearHitCount(x: number, y: number): void {
  this.blockHitCounts.delete(`${x},${y}`)
}

public clearAllHitCounts(): void {
  this.blockHitCounts.clear()
}
```

#### Step 2 — Create `ImpactSystem.ts`

```typescript
// src/game/systems/ImpactSystem.ts

import { BlockType } from '../../data/types'

/**
 * Impact profile per block type.
 * Controls the intensity and character of per-hit feedback.
 */
interface ImpactProfile {
  /** Base screen shake magnitude (pixels) for the first hit */
  baseShake: number
  /** Shake magnitude added per successive hit (escalation) */
  escalationShake: number
  /** Color of the block hit flash (hex) */
  flashColor: number
  /** Duration of the block hit flash in ms */
  flashDuration: number
  /** Whether this block type triggers a "thud" (low freq) or "crack" (high freq) feel */
  impactType: 'crumble' | 'spark' | 'ring' | 'thud' | 'hiss'
  /** Shake duration in ms */
  shakeDuration: number
}

const IMPACT_PROFILES: Partial<Record<BlockType, ImpactProfile>> = {
  [BlockType.Dirt]: {
    baseShake: 1, escalationShake: 0.5,
    flashColor: 0xddcc99, flashDuration: 60,
    impactType: 'crumble', shakeDuration: 80,
  },
  [BlockType.SoftRock]: {
    baseShake: 1.5, escalationShake: 0.5,
    flashColor: 0xccbbaa, flashDuration: 70,
    impactType: 'crumble', shakeDuration: 90,
  },
  [BlockType.Stone]: {
    baseShake: 2, escalationShake: 1,
    flashColor: 0xdddddd, flashDuration: 80,
    impactType: 'spark', shakeDuration: 100,
  },
  [BlockType.HardRock]: {
    baseShake: 3, escalationShake: 1.5,
    flashColor: 0xaaaaaa, flashDuration: 100,
    impactType: 'thud', shakeDuration: 120,
  },
  [BlockType.MineralNode]: {
    baseShake: 2, escalationShake: 1,
    flashColor: 0x4ecca3, flashDuration: 100,
    impactType: 'ring', shakeDuration: 100,
  },
  [BlockType.ArtifactNode]: {
    baseShake: 2.5, escalationShake: 1,
    flashColor: 0xff99aa, flashDuration: 120,
    impactType: 'ring', shakeDuration: 110,
  },
  [BlockType.LavaBlock]: {
    baseShake: 3, escalationShake: 0.5,
    flashColor: 0xff4400, flashDuration: 150,
    impactType: 'hiss', shakeDuration: 140,
  },
}

const DEFAULT_PROFILE: ImpactProfile = {
  baseShake: 1.5, escalationShake: 0.5,
  flashColor: 0xffffff, flashDuration: 80,
  impactType: 'spark', shakeDuration: 100,
}

export class ImpactSystem {
  private scene: Phaser.Scene
  private isShaking = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Trigger all impact feedback for a single block hit.
   *
   * @param blockType     - The block being hit
   * @param hitNumber     - Which hit this is (1 = first, 2 = second, etc.)
   * @param isFinalHit    - True if this hit will destroy the block
   * @param blockPx       - Block world X (pixel center)
   * @param blockPy       - Block world Y (pixel center)
   * @param tileX         - Block grid X (for flash tile tracking)
   * @param tileY         - Block grid Y (for flash tile tracking)
   * @param pickaxeTier   - Current pickaxe tier index (0–3); higher = flashier
   * @param flashTiles    - Reference to MineScene.flashTiles Map to register flash
   */
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

    // 2. Screen shake — escalates with each hit, pickaxe tier adds bonus
    const shakeAmt = (profile.baseShake + profile.escalationShake * (hitNumber - 1))
      * (1 + pickaxeTier * 0.25)
      * (isFinalHit ? 2.0 : 1.0)  // Final hit is 2× more intense
    this.triggerShake(shakeAmt, profile.shakeDuration * (isFinalHit ? 1.5 : 1.0))

    // 3. Climactic break effects (final hit only)
    if (isFinalHit) {
      this.playBreakClimax(blockType, blockPx, blockPy, pickaxeTier)
    }

    // 4. Haptic (Capacitor — mobile only, no-op on web)
    this.triggerHaptic(isFinalHit, blockType, pickaxeTier)
  }

  /**
   * Camera shake using Phaser's built-in shake effect.
   * @param magnitude - Shake intensity in pixels
   * @param duration  - Shake duration in ms
   */
  private triggerShake(magnitude: number, duration: number): void {
    // Clamp shake to avoid nauseating values
    const clampedMag = Math.min(magnitude, 8)
    this.scene.cameras.main.shake(duration, clampedMag / 1000)
  }

  /**
   * Extra visual flourishes for the block-breaking final hit.
   */
  private playBreakClimax(
    blockType: BlockType,
    px: number,
    py: number,
    pickaxeTier: number
  ): void {
    // Brief camera flash (white for rock, color-matched for special blocks)
    const profile = IMPACT_PROFILES[blockType] ?? DEFAULT_PROFILE
    const flashAlpha = 0.15 + pickaxeTier * 0.05
    this.scene.cameras.main.flash(120, 255, 255, 255, false)

    // Higher tier pickaxes add a brief radial zoom-pulse
    if (pickaxeTier >= 2) {
      const originalZoom = this.scene.cameras.main.zoom
      this.scene.tweens.add({
        targets: this.scene.cameras.main,
        zoom: originalZoom * 1.02,
        duration: 60,
        ease: 'Quad.Out',
        yoyo: true,
        onComplete: () => {
          this.scene.cameras.main.setZoom(originalZoom)
        }
      })
    }
  }

  /**
   * Trigger Capacitor haptic feedback.
   * Silently no-ops when Capacitor is not available (web builds).
   */
  private triggerHaptic(isFinalHit: boolean, blockType: BlockType, pickaxeTier: number): void {
    try {
      // Dynamic import to avoid bundling issues on web
      // On web: import('@capacitor/haptics') will resolve to a stub
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
        if (isFinalHit) {
          Haptics.impact({ style: ImpactStyle.Medium })
        } else {
          Haptics.impact({ style: ImpactStyle.Light })
        }
      }).catch(() => { /* Capacitor not available on web */ })
    } catch {
      // Intentionally silent — haptics are enhancement only
    }
  }
}
```

#### Step 3 — Integrate in `MineScene.ts`

```typescript
// In MineScene class, add:
private impactSystem!: ImpactSystem

// In create():
this.impactSystem = new ImpactSystem(this)

// In handleMoveOrMine(), after canMine() check, before mineBlock():
const hitCount = this.player.recordHit(targetX, targetY)
const targetCellBefore = this.grid[targetY][targetX]
const isFinalHit = targetCellBefore.hardness === 1  // Will become 0 after mineBlock()

const mineResult = mineBlock(this.grid, targetX, targetY)

if (mineResult.success) {
  const blockWorldX = targetX * TILE_SIZE + TILE_SIZE * 0.5
  const blockWorldY = targetY * TILE_SIZE + TILE_SIZE * 0.5

  this.impactSystem.triggerHit(
    targetCellBefore.type,
    hitCount,
    isFinalHit,
    blockWorldX,
    blockWorldY,
    targetX,
    targetY,
    this.pickaxeTierIndex,
    this.flashTiles
  )

  if (mineResult.destroyed) {
    this.player.clearHitCount(targetX, targetY)
  }
}
```

#### Step 4 — Pickaxe Tier Visual Differences

Add constants to `src/data/balance.ts`:
```typescript
// Pickaxe tier impact profiles — each tier adds unique visual signature
export const PICKAXE_TIER_VISUALS = [
  { name: 'Stone Pick',    shakeMultiplier: 1.0, flashIntensity: 0.2, particleBonus: 0  },
  { name: 'Iron Pick',     shakeMultiplier: 1.2, flashIntensity: 0.3, particleBonus: 3  },
  { name: 'Diamond Pick',  shakeMultiplier: 1.5, flashIntensity: 0.5, particleBonus: 6  },
  { name: 'Quantum Pick',  shakeMultiplier: 2.0, flashIntensity: 0.8, particleBonus: 10 },
]
```

Use `this.pickaxeTierIndex` (already tracked in `MineScene`) to index into this array and scale shake/flash.

#### Step 5 — Rhythm/Flow-State Optimization

The movement-based time model is already correct for rhythm. Add these polish touches:

1. **Input buffering**: If the player taps/presses while a mine animation is playing, buffer the input and execute it immediately when animation completes. This prevents the jarring "input dropped" feeling.

```typescript
// In MineScene class, add:
private bufferedInput: { x: number; y: number } | null = null

// In handlePointerDown/handleKeyDown, if animController.isPlayingMineAnim:
if (this.animController.isPlayingMineAnim) {
  this.bufferedInput = { x: finalX, y: finalY }
  return
}

// In the mine animation onComplete callback:
this.animController.setMine(dx, dy, () => {
  this.animController.setIdle()
  if (this.bufferedInput) {
    const buf = this.bufferedInput
    this.bufferedInput = null
    this.handleMoveOrMine(buf.x, buf.y)
  }
})
```

2. **Rapid-mining rhythm**: If the same direction is hit 3+ times in succession, slightly increase particle burst size (visual reward for rhythm, not gameplay reward).

#### Step 6 — Playtesting Iteration Log

Create `docs/roadmap/phases/PHASE-07-PICKAXE-FEEL-LOG.md` after initial implementation to record:
- Date of each playtest session
- What felt right, what felt wrong
- Specific parameter changes made (shake magnitude, duration, flash intensity)
- Comparison to Stardew Valley / Motherload benchmarks

This document is REQUIRED before marking sub-phase 7.8 complete.

### Acceptance Criteria
- [ ] Mining a Stone block produces visible screen shake
- [ ] The final hit on a multi-hit block is visually, audibly, and haptically more intense than preceding hits
- [ ] Mining Dirt vs Stone feels distinctly different (different shake magnitude, flash color)
- [ ] Rapid successive mining of multiple blocks feels rhythmic, not jarring
- [ ] Diamond/Quantum pickaxe hits are visually flashier than Stone pickaxe hits
- [ ] Input buffering works: tapping quickly during animation still registers all inputs
- [ ] Screen shake never exceeds 8px magnitude (no motion sickness)
- [ ] Haptic feedback triggers on mobile builds (Capacitor)
- [ ] Playtesting iteration log has at least 2 recorded sessions before marking complete
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-pickaxe-feel.js
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
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Take rapid-fire screenshots during mining to capture shake/flash frames
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(20)
  await page.screenshot({ path: '/tmp/ss-feel-hit1.png' })
  await page.waitForTimeout(20)
  await page.screenshot({ path: '/tmp/ss-feel-mid-swing.png' })
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(20)
  await page.screenshot({ path: '/tmp/ss-feel-hit2.png' })
  await page.waitForTimeout(20)
  await page.screenshot({ path: '/tmp/ss-feel-flash.png' })
  await browser.close()
  console.log('Pickaxe feel screenshots: /tmp/ss-feel-*.png')
  console.log('Visually verify: flash visible in hit frames, screen shifted during shake frames')
})()
```

---

## Verification Gate

Before Phase 7 is marked complete, ALL of the following must pass:

### Technical Checks
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` produces a successful bundle with no warnings about missing imports
- [ ] No `console.error` or uncaught exceptions in the browser console during a full mine run

### Visual Checks (Playwright screenshots required for each)
- [ ] Autotiling: Two adjacent dirt blocks show a seamless connected texture — screenshot at `/tmp/phase7-autotile.png`
- [ ] Character animation: Walk animation plays when moving, mine animation plays when hitting a block — screenshot at `/tmp/phase7-animation.png`
- [ ] Camera zoom: At game start the mine is NOT fully visible — screenshot at `/tmp/phase7-camera.png`
- [ ] Mini-map: Visible in top-right corner showing explored/unexplored areas — screenshot at `/tmp/phase7-minimap.png`
- [ ] Particles: Block-break particles visible after mining — screenshot at `/tmp/phase7-particles.png`
- [ ] Loot pop: Mineral pop arc visible mid-flight — screenshot at `/tmp/phase7-lootpop.png`
- [ ] Crack overlays: Sprite-based crack visible on partially mined block — screenshot at `/tmp/phase7-cracks.png`
- [ ] Block idle animations: Lava block looks different across 3 screenshots taken 500ms apart — screenshots at `/tmp/phase7-idle-*.png`
- [ ] Pickaxe feel: Screen shows visible offset/flash during mining hit frame — screenshot at `/tmp/phase7-pickaxe.png`

### Performance Check
- [ ] 60fps maintained on mobile viewport (390×844) with 20+ animated blocks visible
  - Measure: open Chrome DevTools Performance tab, record 5 seconds of mining, confirm average frame time < 16.7ms
- [ ] No frame drops below 30fps during particle bursts (block break + ambient emitters active simultaneously)

### Regression Check
- [ ] Fog of war still works correctly (hidden blocks show biome fog color, not block sprite)
- [ ] Scanner shimmer/hazard hints still render on ring-1 visibility tiles
- [ ] Quiz overlay still appears when mining quiz gate or hitting random quiz trigger
- [ ] Oxygen system still depletes and O2 warning still appears below 30%
- [ ] All block types can still be mined (no regressions from drawBlockPattern changes)

### Playtesting Check
- [ ] Sub-phase 7.8 pickaxe feel iteration log (`docs/roadmap/phases/PHASE-07-PICKAXE-FEEL-LOG.md`) contains at least 2 recorded playtesting sessions with tuning notes

---

## Files Affected

### Created
| File | Purpose |
|---|---|
| `src/game/systems/AutotileSystem.ts` | Bitmask computation, group definitions, sprite key mapping |
| `src/game/systems/AnimationSystem.ts` | `MinerAnimController` class, anim state machine, frame configs |
| `src/game/systems/CameraSystem.ts` | Zoom calculation, pinch-to-zoom, camera setup helper |
| `src/game/systems/ParticleSystem.ts` | All particle emitters — break, ambient, O2 warning |
| `src/game/systems/LootPopSystem.ts` | Loot pop physics, rarity reveal effects, suck-to-player tween |
| `src/game/systems/BlockAnimSystem.ts` | Time-based frame cycling for animated block types |
| `src/game/systems/ImpactSystem.ts` | Screen shake, flash coordination, haptic, pickaxe feel |
| `src/ui/components/MiniMap.svelte` | Mini-map canvas overlay component |
| `src/ui/stores/miniMap.ts` | Svelte writable store for mini-map data |
| `src/assets/sprites/tiles/autotile/autotile_soil_00.png` through `autotile_soil_15.png` | 16 soil autotile variants (lo-res) |
| `src/assets/sprites/tiles/autotile/autotile_rock_00.png` through `autotile_rock_15.png` | 16 rock autotile variants (lo-res) |
| `src/assets/sprites-hires/tiles/autotile/` | Hi-res counterparts of all autotile sprites |
| `src/assets/sprites/characters/miner_sheet.png` | Full miner animation sprite sheet (lo-res) |
| `src/assets/sprites-hires/characters/miner_sheet.png` | Hi-res miner sheet |
| `src/assets/sprites/tiles/crack_stage1.png` | Hairline crack sprite |
| `src/assets/sprites/tiles/crack_stage4.png` | Severe crumbling crack sprite |
| `src/assets/sprites/tiles/block_lava_01.png` through `block_lava_05.png` | Lava animation frames |
| `src/assets/sprites/tiles/block_gas_01.png` through `block_gas_03.png` | Gas animation frames |
| `src/assets/sprites/tiles/block_descent_shaft_01.png` through `_05.png` | Descent shaft animation frames |
| `src/assets/sprites/tiles/block_quiz_gate_01.png` through `_03.png` | Quiz gate animation frames |
| `src/assets/sprites/tiles/block_mineral_shimmer_00.png` through `_02.png` | Mineral shimmer overlay frames |
| `src/assets/sprites/tiles/block_artifact_01.png` through `_03.png` | Artifact glow frames |
| `src/assets/sprites/tiles/block_relic_shrine_01.png` through `_03.png` | Relic shrine aura frames |
| `src/assets/sprites/tiles/block_oxygen_cache_01.png` through `_03.png` | Oxygen cache bubble frames |
| `src/assets/sprites/tiles/block_upgrade_crate_01.png` through `_02.png` | Crate gleam frames |
| `src/assets/sprites/tiles/block_fossil_01.png` through `_02.png` | Fossil shimmer frames |
| `docs/roadmap/phases/PHASE-07-PICKAXE-FEEL-LOG.md` | Playtesting iteration log (created during 7.8) |

### Modified
| File | Change |
|---|---|
| `src/game/scenes/MineScene.ts` | Integrate all 7 new systems, replace playerSprite Image→Sprite, replace breakEmitter with ParticleSystem, replace drawCracks with drawCrackOverlay, add autotile cache, add minemap-update events, add camera zoom via CameraSystem |
| `src/game/entities/Player.ts` | Add `facing`, `lastMoveDx/Dy`, `blockHitCounts` tracking, `recordHit/clearHitCount` methods |
| `src/game/scenes/BootScene.ts` | Add `spritesheet` load for `miner_sheet`; verify autotile sprites load correctly |
| `src/data/balance.ts` | Add `PICKAXE_TIER_VISUALS` constants for per-tier impact profiles |
| `src/ui/GameOverlay.svelte` (or equivalent) | Mount `<MiniMap>` component during mine runs |

### Not Modified
- `src/game/systems/MiningSystem.ts` — gameplay logic unchanged
- `src/game/systems/MineGenerator.ts` — generation unchanged
- `src/game/systems/OxygenSystem.ts` — oxygen logic unchanged
- `src/data/types.ts` — no new types needed
- `src/game/spriteManifest.ts` — existing glob covers all new sprite directories automatically
- All Svelte UI components outside of GameOverlay/MiniMap

---

## Implementation Order

The sub-phases have the following dependency graph. Implement in this order:

```
7.1 Autotile → can be done in parallel with 7.2
7.2 Animation → required before 7.8
7.3 Camera    → independent, implement anytime
7.4 Particles → independent, implement anytime
7.5 Loot Pop  → requires 7.4 (particle ring effects) to be fully built
7.6 Cracks    → independent, easiest sub-phase
7.7 Block Anim→ independent
7.8 Pickaxe Feel → requires 7.2 (animation) and 7.4 (particles) to be complete
```

Recommended parallel batches:
- **Batch A**: 7.1 + 7.2 + 7.6 (rendering system core)
- **Batch B**: 7.3 + 7.4 + 7.7 (independent visual systems)
- **Batch C**: 7.5 then 7.8 (depend on batch A/B outputs)

---

## Sub-Phase 7.10: Tilemap Migration (DD-V2-182)

### What
Migrate `MineScene` from the current Graphics-based `drawBlockPattern()` / `drawTiles()` approach to `Phaser.Tilemaps.TilemapLayer`. Instead of clearing and redrawing every visible sprite each frame, the scene maintains a live tilemap whose cells are updated only when something actually changes. This is the single highest-impact rendering optimization available — it replaces thousands of per-frame draw calls with a single GPU-accelerated tilemap batch.

**Why tilemaps**: Phaser's `TilemapLayer` submits the entire layer as one draw call regardless of grid size. The current `redrawAll()` approach scales linearly with visible tile count, which is catastrophic for the 40×40 grids introduced in deep layers (Phase 8).

**Pre-computed bitmask storage**: Each `MineCell` gains an optional `autotileMask?: number` field. The mask is pre-computed on mine generation, on block mine, and on earthquake collapse — never per-frame. The tilemap layer reads `cell.autotileMask` to choose the correct tile index.

**Dependency**: This sub-phase is a prerequisite for autotiling at any meaningful frame rate. Complete before or in parallel with 7.1, but tilemap infrastructure must be committed before 7.1 sprite work is integrated.

### Where
- **Modify**: `src/data/types.ts` — add `autotileMask?: number` to `MineCell`
- **Modify**: `src/game/systems/MineGenerator.ts` — pre-compute `autotileMask` for all cells on generation
- **Create**: `src/game/systems/TilemapSystem.ts` — wraps `Phaser.Tilemaps.Tilemap` and exposes `updateCell()` / `rebuildLayer()` API
- **Modify**: `src/game/scenes/MineScene.ts` — replace `tileGraphics.clear()` + `redrawAll()` with `TilemapSystem.updateCell()` calls; remove per-frame redraw loop

### How

#### Step 1 — Extend `MineCell` with `autotileMask`

```typescript
// src/data/types.ts — add to MineCell interface
export interface MineCell {
  type: BlockType
  hp: number
  maxHp: number
  visibilityLevel?: number
  autotileMask?: number     // 4-bit bitmask (0–15), populated at generation and on change
  // ...existing fields
}
```

#### Step 2 — Create `TilemapSystem.ts`

```typescript
// src/game/systems/TilemapSystem.ts

import Phaser from 'phaser'
import type { MineCell } from '../../data/types'

/**
 * Wraps a Phaser Tilemap for the mine grid.
 * Provides targeted cell updates instead of full redraws.
 *
 * Usage:
 *   const tm = new TilemapSystem(scene, grid, tileSize)
 *   tm.init()            // call once in MineScene.create()
 *   tm.updateCell(x, y) // call when a block changes
 */
export class TilemapSystem {
  private map!: Phaser.Tilemaps.Tilemap
  private layer!: Phaser.Tilemaps.TilemapLayer
  private scene: Phaser.Scene
  private grid: MineCell[][]
  private tileSize: number

  constructor(scene: Phaser.Scene, grid: MineCell[][], tileSize: number) {
    this.scene = scene
    this.grid = grid
    this.tileSize = tileSize
  }

  /**
   * Creates the tilemap, tileset, and layer from the current grid.
   * Must be called after the tileset texture is loaded in BootScene.
   */
  public init(): void {
    const rows = this.grid.length
    const cols = this.grid[0]?.length ?? 0

    this.map = this.scene.make.tilemap({
      width: cols,
      height: rows,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize,
    })

    // 'mine_tileset' must be loaded in BootScene as a spritesheet / atlas
    const tileset = this.map.addTilesetImage('mine_tileset')!
    this.layer = this.map.createBlankLayer('terrain', tileset)!
    this.layer.setDepth(5)

    // Populate all cells on creation
    this.rebuildAll()
  }

  /**
   * Updates a single tile in the tilemap layer.
   * Call this after mining a block, revealing via fog, or earthquake collapse.
   *
   * @param x - Grid column
   * @param y - Grid row
   */
  public updateCell(x: number, y: number): void {
    const cell = this.grid[y]?.[x]
    if (!cell) return
    const tileIndex = this.cellToTileIndex(cell)
    this.layer.putTileAt(tileIndex, x, y)
  }

  /**
   * Rebuilds the entire tilemap layer from scratch.
   * Only call this on initial mine load or after a full grid reset.
   * For incremental updates, use updateCell() instead.
   */
  public rebuildAll(): void {
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < (this.grid[y]?.length ?? 0); x++) {
        this.updateCell(x, y)
      }
    }
  }

  /**
   * Maps a MineCell to the correct tile index in the atlas.
   * Terrain tiles use autotileMask (0–15 per group).
   * Special blocks use a fixed index.
   */
  private cellToTileIndex(cell: MineCell): number {
    // Index layout in the atlas (example — adjust to match actual atlas packing):
    // 0–15:   soil autotile variants (Dirt/SoftRock)
    // 16–31:  rock autotile variants (Stone/HardRock/Unbreakable)
    // 32+:    special blocks (fixed index per BlockType)
    // See TilemapSystem.TILE_INDICES for the full map
    return TilemapSystem.TILE_INDICES[cell.type]?.(cell.autotileMask ?? 0) ?? 0
  }

  /** Tile index resolvers per BlockType. Override in atlas config if layout changes. */
  static TILE_INDICES: Partial<Record<number, (mask: number) => number>> = {
    // Soil group: indices 0–15
    [2 /* Dirt */]:     (mask) => mask,
    [3 /* SoftRock */]: (mask) => mask,
    // Rock group: indices 16–31
    [4 /* Stone */]:      (mask) => 16 + mask,
    [5 /* HardRock */]:   (mask) => 16 + mask,
    [6 /* Unbreakable */]:(mask) => 16 + mask,
    // Special blocks: fixed indices starting at 32
    // Add entries for all remaining BlockType values here
  }
}
```

#### Step 3 — Pre-Compute Masks in `MineGenerator.ts`

After the generation pass completes, run a second pass to set `autotileMask` on every terrain cell:

```typescript
// In MineGenerator.ts, at the end of generateMine():
import { computeBitmask, isAutotiledBlock } from './AutotileSystem'

// After grid is fully populated:
for (let y = 0; y < grid.length; y++) {
  for (let x = 0; x < grid[y].length; x++) {
    const cell = grid[y][x]
    if (isAutotiledBlock(cell.type)) {
      cell.autotileMask = computeBitmask(grid, x, y)
    }
  }
}
```

#### Step 4 — Replace Per-Frame Redraw in `MineScene.ts`

```typescript
// Remove from update():
// this.tileGraphics.clear()
// this.redrawAll()

// Add to create(), after MineGenerator returns:
this.tilemapSystem = new TilemapSystem(this, this.grid, TILE_SIZE)
this.tilemapSystem.init()

// In handleMoveOrMine(), after a block is mined:
// Invalidate autotile masks for the 3×3 neighborhood
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    const nx = minedX + dx, ny = minedY + dy
    const neighbor = this.grid[ny]?.[nx]
    if (neighbor && isAutotiledBlock(neighbor.type)) {
      neighbor.autotileMask = computeBitmask(this.grid, nx, ny)
    }
    this.tilemapSystem.updateCell(nx, ny)
  }
}

// In revealAround(), after updating visibilityLevel:
this.tilemapSystem.updateCell(cell.x, cell.y)
```

### Acceptance Criteria
- [ ] `MineScene.update()` no longer calls `tileGraphics.clear()` or any equivalent full-redraw function
- [ ] Chrome DevTools Performance panel shows a single tilemap draw call per frame (not N calls for N visible tiles)
- [ ] Mining a block updates only the 3×3 neighborhood tiles — no full-layer rebuild
- [ ] Frame time on a 40×40 grid is measurably lower than before migration (document before/after numbers)
- [ ] All existing block types render correctly (no black or missing tiles)
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-tilemap-perf.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Mine 20 blocks and screenshot mid-session
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(50)
  }
  await page.screenshot({ path: '/tmp/ss-tilemap-perf.png' })
  // Check draw call count via Phaser's internal renderer stats
  const drawCalls = await page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__
    return game?.renderer?.drawCount ?? 'unavailable'
  })
  console.log('Draw calls per frame:', drawCalls)
  await browser.close()
})()
```

---

## Sub-Phase 7.11: Draw Call Optimization (DD-V2-183)

### What
Enforce a hard cap of 50 draw calls per frame on mobile. The current architecture scatters rendering across multiple Graphics objects, sprite pools, and overlay layers. This sub-phase consolidates static elements into the fewest possible GPU batches and moves fog/visibility updates off the per-frame hot path.

**Hard constraints**:
- 50 draw calls per frame maximum (measured in Chrome DevTools on Pixel 6a)
- Static tiles = 1 draw call (TilemapLayer, after 7.10)
- Fog/visibility overlay = updated only on `revealAround()`, rendered as 1 `RenderTexture` draw call
- Dynamic draw calls reserved for: particles (1 per emitter type), player sprite (1), loot pop sprites (N, max 5 simultaneous)

**Why Chrome DevTools understates mobile GPU pressure**: The desktop GPU executes draw calls in ~0.01ms that take ~0.3ms on a Pixel 6a's Adreno 650. Profile on a real device; throttled desktop simulation is insufficient for draw call budgeting.

### Where
- **Modify**: `src/game/scenes/MineScene.ts` — replace `fogGraphics` (per-frame clear/redraw) with `RenderTexture` updated on visibility changes only
- **Create**: `src/game/systems/FogRenderTexture.ts` — manages the fog-of-war `RenderTexture`
- **Modify**: `src/game/systems/ParticleSystem.ts` — consolidate emitters to share one manager per emitter type

### How

#### Step 1 — Create `FogRenderTexture.ts`

```typescript
// src/game/systems/FogRenderTexture.ts

import Phaser from 'phaser'

/**
 * Manages fog-of-war rendering via a RenderTexture.
 * The texture is only redrawn when cell visibility changes —
 * never every frame. This replaces the fogGraphics clear/redraw pattern.
 */
export class FogRenderTexture {
  private rt: Phaser.GameObjects.RenderTexture
  private scene: Phaser.Scene
  private tileSize: number
  private cols: number
  private rows: number

  /** Fog color per visibility level */
  static readonly FOG_COLORS = {
    hidden:  0x000000,  // fully hidden
    ring1:   0x1a1a2e,  // ring-1: ghost/dim
    ring2:   0x0d0d1a,  // ring-2: very faint (scanner only)
  }

  constructor(scene: Phaser.Scene, cols: number, rows: number, tileSize: number) {
    this.scene = scene
    this.cols = cols
    this.rows = rows
    this.tileSize = tileSize

    this.rt = scene.add.renderTexture(0, 0, cols * tileSize, rows * tileSize)
    this.rt.setDepth(7)  // Above tiles (5), below HUD

    // Start fully fogged
    this.rt.fill(0x000000, 1.0)
  }

  /**
   * Clears fog for a single revealed cell.
   * Call from revealAround() instead of full fogGraphics redraw.
   *
   * @param x - Grid column
   * @param y - Grid row
   * @param visibilityLevel - 0=hidden, 1=ring-1, 2=ring-2, undefined=fully revealed
   */
  public updateCell(x: number, y: number, visibilityLevel: number | undefined): void {
    const px = x * this.tileSize
    const py = y * this.tileSize
    const ts = this.tileSize

    if (visibilityLevel === undefined) {
      // Fully revealed: erase fog completely
      this.rt.erase(this.makeFogRect(px, py, ts), px, py)
    } else if (visibilityLevel === 1) {
      // Ring-1: semi-transparent fog
      this.rt.draw(this.makeFogRect(px, py, ts, FogRenderTexture.FOG_COLORS.ring1, 0.8), px, py)
    } else if (visibilityLevel === 2) {
      // Ring-2: heavy fog, scanner-only
      this.rt.draw(this.makeFogRect(px, py, ts, FogRenderTexture.FOG_COLORS.ring2, 0.94), px, py)
    }
  }

  private makeFogRect(
    x: number, y: number, size: number,
    color = 0x000000, alpha = 1.0,
  ): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics()
    g.fillStyle(color, alpha)
    g.fillRect(0, 0, size, size)
    return g
  }

  /** Full rebuild — only call on mine load, never during play */
  public rebuildFromGrid(grid: { visibilityLevel?: number }[][]): void {
    this.rt.fill(0x000000, 1.0)
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
        this.updateCell(x, y, grid[y][x].visibilityLevel)
      }
    }
  }
}
```

#### Step 2 — Replace `fogGraphics` in `MineScene.ts`

```typescript
// Remove:
// private fogGraphics!: Phaser.GameObjects.Graphics
// and all fogGraphics.clear() / fillRect() calls in redrawAll()

// Add:
private fog!: FogRenderTexture

// In create(), after grid is built:
this.fog = new FogRenderTexture(this, cols, rows, TILE_SIZE)
this.fog.rebuildFromGrid(this.grid)

// In revealAround(), after updating cell.visibilityLevel:
this.fog.updateCell(cell.x, cell.y, cell.visibilityLevel)

// Fully revealed cells:
this.fog.updateCell(cell.x, cell.y, undefined)
```

#### Step 3 — Consolidate Particle Emitter Draw Calls

Each `Phaser.GameObjects.Particles.ParticleEmitter` that is currently configured as a separate emitter in a separate `ParticleEmitter` group contributes an additional draw call. Consolidate:

- All terrain-break emitters share ONE particle manager: `this.add.particles('particle_sheet')`
- Ambient emitters share a second particle manager
- O2 warning emitter uses the ambient manager (different texture frame, same batch)

```typescript
// In ParticleSystem.ts, replace per-emitter texture loading:
// Before: separate texture per emitter type
// After: one particle sprite sheet with multiple frames

// particle_sheet.png: 32×32 sheet with frames:
// frame 0: circle/dot (generic)
// frame 1: spark (rock break)
// frame 2: ember (volcanic ambient)
// frame 3: sparkle (crystalline ambient)

// Configure each emitter with `frame: N` instead of a unique texture key
```

### Acceptance Criteria
- [ ] Chrome DevTools Performance panel shows ≤ 50 draw calls per frame during active mining
- [ ] Fog-of-war `RenderTexture` is NOT redrawn every frame — only updated on visibility events
- [ ] All particle emitters that share a texture are batched into one draw call per texture
- [ ] No visual regression: fog still correctly obscures unrevealed tiles, ring-1/ring-2 still visible
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-drawcalls.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-drawcalls.png' })
  const drawCalls = await page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__
    return game?.renderer?.drawCount ?? 'unavailable'
  })
  console.log('Draw calls:', drawCalls, '(target: ≤ 50)')
  await browser.close()
})()
```

---

## Sub-Phase 7.12: Sprite Pool and Frustum Culling (DD-V2-184)

### What
Enforce a hard ceiling of 500 pooled sprite objects. Implement frustum culling so sprites are only allocated for cells within the camera viewport plus a 2-tile safety margin. When the camera scrolls, sprites that have left the viewport are recycled — returned to the pool — rather than abandoned. This prevents unbounded memory growth across a 20-layer expedition where each new layer initializes a fresh sprite allocation.

**Problem with the current pool**: `getPooledSprite()` grows the pool unboundedly. On a 40×40 grid, 1,600 tiles plus crack overlays, particles, and loot sprites can push the pool well past 2,000 objects. Each `Phaser.GameObjects.Sprite` consumes ~2KB of GPU-side texture state even when invisible. Across 20 layer transitions this becomes a memory leak.

**Frustum culling model**:
1. Every frame, the camera viewport defines a tile range `[minTileX, maxTileX] × [minTileY, maxTileY]`
2. Add a 2-tile margin in all directions
3. Only cells within this range receive a pooled sprite; all others are set invisible and returned
4. On camera scroll, `onCameraScroll()` reconciles which cells entered and left the viewport

### Where
- **Modify**: `src/game/scenes/MineScene.ts` — integrate frustum culling into `drawTiles()` / `redrawAll()`
- **Modify**: `src/game/systems/TilemapSystem.ts` (from 7.10) — add `setViewport()` to enable camera-aware tile culling at the tilemap level
- **Create**: `src/game/systems/SpritePool.ts` — extract and refactor the existing pool with a hard ceiling and frustum-aware recycling

### How

#### Step 1 — Create `SpritePool.ts`

```typescript
// src/game/systems/SpritePool.ts

import Phaser from 'phaser'

/**
 * A bounded sprite pool with frustum-aware recycling.
 *
 * Hard ceiling: MAX_SPRITES sprites total, regardless of grid size.
 * Sprites exceeding the ceiling are NOT created; the requesting cell
 * is skipped (tile handled by TilemapLayer instead).
 */
export class SpritePool {
  static readonly MAX_SPRITES = 500

  private scene: Phaser.Scene
  private pool: Phaser.GameObjects.Sprite[] = []
  private activeCount = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Acquires a sprite for a given position and texture key.
   * Returns null if the pool ceiling is reached.
   *
   * @param key  - Texture key (must be loaded in BootScene)
   * @param x    - World X position (pixels)
   * @param y    - World Y position (pixels)
   */
  public acquire(key: string, x: number, y: number): Phaser.GameObjects.Sprite | null {
    if (this.activeCount >= SpritePool.MAX_SPRITES) return null

    // Reuse a pooled (hidden) sprite
    const existing = this.pool.find(s => !s.visible)
    if (existing) {
      existing.setTexture(key).setPosition(x, y).setVisible(true)
      this.activeCount++
      return existing
    }

    // Create new sprite up to ceiling
    if (this.pool.length < SpritePool.MAX_SPRITES) {
      const sprite = this.scene.add.sprite(x, y, key)
      this.pool.push(sprite)
      this.activeCount++
      return sprite
    }

    return null
  }

  /**
   * Releases all sprites — hides them and resets activeCount.
   * Call at the start of each render cycle.
   */
  public releaseAll(): void {
    for (const sprite of this.pool) {
      sprite.setVisible(false)
    }
    this.activeCount = 0
  }

  /** Returns pool size and active count for debugging. */
  public getStats(): { total: number; active: number } {
    return { total: this.pool.length, active: this.activeCount }
  }
}
```

#### Step 2 — Integrate Frustum Culling in `MineScene.ts`

```typescript
// In MineScene, replace direct pool.acquire() loop with viewport-aware version:

private getViewportTileRange(): { x0: number; y0: number; x1: number; y1: number } {
  const cam = this.cameras.main
  const margin = 2  // tiles beyond viewport edge to keep rendered
  return {
    x0: Math.max(0, Math.floor(cam.scrollX / TILE_SIZE) - margin),
    y0: Math.max(0, Math.floor(cam.scrollY / TILE_SIZE) - margin),
    x1: Math.min(this.cols - 1, Math.ceil((cam.scrollX + cam.width) / TILE_SIZE) + margin),
    y1: Math.min(this.rows - 1, Math.ceil((cam.scrollY + cam.height) / TILE_SIZE) + margin),
  }
}

// In redrawAll() / drawTiles():
const { x0, y0, x1, y1 } = this.getViewportTileRange()
this.spritePool.releaseAll()

for (let y = y0; y <= y1; y++) {
  for (let x = x0; x <= x1; x++) {
    // Only render special block sprites for in-viewport cells
    // Terrain tiles are handled by TilemapLayer (7.10) — no sprite needed
    const cell = this.grid[y]?.[x]
    if (!cell || !this.needsSpriteOverlay(cell)) continue
    this.spritePool.acquire(this.getSpriteKey(cell), x * TILE_SIZE, y * TILE_SIZE)
  }
}
```

#### Step 3 — Memory Profiling After Layer Transitions

After implementing: navigate through 5 layer transitions in the dev build and take a heap snapshot in Chrome DevTools. Sprite count in the "Sprite" group of the snapshot must not exceed 500.

### Acceptance Criteria
- [ ] `SpritePool.getStats().total` never exceeds 500 after any number of layer transitions
- [ ] Sprites outside the camera viewport + 2-tile margin are not allocated or are set invisible
- [ ] No visual regression: all visible block types render with correct sprites
- [ ] Memory profiling (Chrome DevTools heap snapshot) after 5 layer transitions confirms sprite count ≤ 500
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-spritepool.js
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
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  const stats = await page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__
    const scene = game?.scene?.scenes?.find((s: any) => s.sys?.key === 'MineScene')
    return scene?.spritePool?.getStats() ?? { total: -1, active: -1 }
  })
  console.log('Sprite pool stats:', stats, '(total must be ≤ 500)')
  await page.screenshot({ path: '/tmp/ss-spritepool.png' })
  await browser.close()
})()
```

---

## Sub-Phase 7.13: Force WebGL (DD-V2-190)

### What
Change `GameConfig.type` from `Phaser.AUTO` to `Phaser.WEBGL`. Drop the Canvas2D fallback entirely. All targeted platforms (Android 8+, iOS 13+, modern desktop) support WebGL. Forcing WebGL unlocks custom shaders for fog of war, GPU-accelerated post-processing for screen shake, and guarantees consistent rendering behavior across devices.

**Why drop Canvas2D**: `Phaser.AUTO` silently falls back to Canvas2D on some obscure devices and browser configurations, leading to inconsistent visual output and masking renderer-specific bugs during development. Explicit WebGL forces all rendering to go through the same GPU path.

**User-facing fallback**: A small number of legacy Android WebView installs lack WebGL. Add a blocking message page: "Recall Rogue requires a WebGL-capable device. Please update your browser or try a different device." This affects < 0.5% of target audience.

### Where
- **Modify**: `src/game/config.ts` (or wherever `GameConfig` is defined) — change `type: Phaser.AUTO` to `type: Phaser.WEBGL`
- **Modify**: `src/main.ts` — add WebGL capability check before Phaser boot; render fallback message if WebGL unavailable
- **Create**: `src/ui/components/WebGLFallback.svelte` — simple error page shown when WebGL is not available
- **Modify**: `src/game/scenes/MineScene.ts` — remove any Canvas2D-specific rendering branches (if any exist)

### How

#### Step 1 — WebGL Capability Check in `main.ts`

```typescript
// src/main.ts — add before Phaser game creation

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

if (!isWebGLSupported()) {
  // Mount the Svelte fallback component instead of the game
  const app = mount(WebGLFallback, { target: document.getElementById('app')! })
  // Do NOT proceed to Phaser initialization
} else {
  // Existing Phaser + Svelte boot
}
```

#### Step 2 — Update `GameConfig`

```typescript
// src/game/config.ts
const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,   // was: Phaser.AUTO
  // ...all other config unchanged
}
```

#### Step 3 — Create `WebGLFallback.svelte`

```svelte
<!-- src/ui/components/WebGLFallback.svelte -->
<script lang="ts">
  // No logic needed — static error message
</script>

<div class="fallback">
  <h1>Device Not Supported</h1>
  <p>
    Recall Rogue requires WebGL, which is not available in your current browser or device.
  </p>
  <p>
    Please update your browser, or try opening the game in Chrome or Firefox.
  </p>
</div>

<style>
  .fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 2rem;
    text-align: center;
    font-family: monospace;
    background: #0d0d1a;
    color: #cccccc;
  }
  h1 { color: #e94560; margin-bottom: 1rem; }
  p { max-width: 400px; line-height: 1.6; margin-bottom: 0.8rem; }
</style>
```

### Acceptance Criteria
- [ ] `GameConfig.type` is `Phaser.WEBGL` — no `Phaser.AUTO` references remain in config
- [ ] No Canvas2D renderer code paths exist in MineScene or any Phaser scene
- [ ] `WebGLFallback.svelte` is mounted when WebGL is not available (test by temporarily returning `false` from `isWebGLSupported()`)
- [ ] Game renders correctly on at least 3 device tiers: low (Pixel 4a), mid (Pixel 6a), high (Pixel 8 Pro)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Playwright Test

```js
// Save as /tmp/test-webgl.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Verify WebGL renderer is active
  const rendererType = await page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__
    return game?.renderer?.type  // 1 = Canvas, 2 = WebGL
  })
  console.log('Renderer type:', rendererType, '(expected: 2 = WebGL)')
  await page.screenshot({ path: '/tmp/ss-webgl.png' })
  await browser.close()
})()
```

---

## Sub-Phase 7.14: GameManager Decomposition v2 (DD-V2-222)

### What
Complete the GameManager decomposition begun in the "GameManager Decomposition" batch (documented in MEMORY.md). Extract two additional managers — `DiveManager` and `DomeManager` — and reduce `GameManager` itself to a thin coordinator under 300 lines. Each sub-manager subscribes to the typed event bus (7.15) rather than calling GameManager directly.

**Current state**: GameManager is ~1,217 lines after the first decomposition (QuizManager, StudyManager, GaiaManager, InventoryManager were extracted). The remaining core still handles dive lifecycle, layer transitions, biome sequencing, dome room navigation, pet AI, and farm timers — concerns that belong in dedicated managers.

**Target state after this sub-phase**:
| File | Max Lines | Responsibility |
|---|---|---|
| `GameManager.ts` | 300 | Phaser Game instance ownership, cross-manager routing, save persistence |
| `DiveManager.ts` | 500 | Dive start/end, layer transitions, biome sequence, oxygen depth decay |
| `DomeManager.ts` | 500 | Dome floor nav, pet AI ticks, farm timer ticks, GAIA idle scheduling |
| `QuizManager.ts` | existing | Quiz answer handling (already extracted) |
| `StudyManager.ts` | existing | Study sessions (already extracted) |
| `GaiaManager.ts` | existing | GAIA dialogue (already extracted) |
| `InventoryManager.ts` | existing | Inventory sync (already extracted) |

### Where
- **Create**: `src/game/managers/DiveManager.ts`
- **Create**: `src/game/managers/DomeManager.ts`
- **Modify**: `src/game/managers/GameManager.ts` — extract dive and dome logic, wire event bus subscriptions

### How

#### Step 1 — Identify Dive-Related Methods in `GameManager.ts`

Extract methods matching these patterns:
- `startDive()`, `endDive()`, `onLayerComplete()`
- `handleDescentShaft()`, `transitionToNextLayer()`
- `getBiomeForLayer()`, `applyOxygenDepthDecay()`
- Any method that touches `currentLayer` store

Move these to `DiveManager.ts`. `DiveManager` receives a reference to `saveService`, `oxygenStore`, and the typed `EventBus`.

#### Step 2 — Identify Dome-Related Methods

Extract methods matching these patterns:
- `navigateDomeRoom()`, `onRoomEnter()`, `onRoomExit()`
- `tickPetAI()`, `tickFarmTimers()`
- `scheduleGaiaIdle()`, `triggerGaiaIdleQuip()`

Move to `DomeManager.ts`.

#### Step 3 — `DiveManager.ts` Skeleton

```typescript
// src/game/managers/DiveManager.ts

import type { EventBus } from '../systems/EventBus'
import type { SaveService } from '../../services/saveService'

/**
 * Manages the full lifecycle of a single dive expedition.
 * Handles: dive start, layer transitions, biome sequence, oxygen depth decay.
 *
 * Does NOT hold a Phaser.Game reference — all scene operations
 * are triggered via EventBus events.
 */
export class DiveManager {
  private eventBus: EventBus
  private saveService: SaveService
  private currentLayer = 1
  private biomeSequence: string[] = []

  constructor(eventBus: EventBus, saveService: SaveService) {
    this.eventBus = eventBus
    this.saveService = saveService
    this.subscribeToEvents()
  }

  private subscribeToEvents(): void {
    this.eventBus.on('dive-start-requested', (data) => this.startDive(data))
    this.eventBus.on('descent-shaft-entered', () => this.handleLayerTransition())
    this.eventBus.on('dive-abort-requested', () => this.endDive({ abandoned: true }))
  }

  /** Begins a new dive expedition. */
  public startDive(options: { loadout: DiveLoadout }): void {
    // ... extracted logic from GameManager.startDive()
  }

  /** Handles transition to the next mine layer. */
  public handleLayerTransition(): void {
    // ... extracted from GameManager.handleDescentShaft()
  }

  /** Ends the current dive, applies rewards/penalties, saves state. */
  public endDive(result: { abandoned: boolean }): void {
    // ... extracted from GameManager.endDive()
  }

  /** Returns the oxygen cost multiplier for the current layer (depth decay). */
  public getOxygenDecayMultiplier(): number {
    // L1=1.0×, L10=1.5×, L20=2.5× — linear interpolation
    return 1.0 + (this.currentLayer - 1) * (1.5 / 19)
  }
}
```

#### Step 4 — Reduce `GameManager.ts` to Coordinator

After extraction, `GameManager.ts` should only:
1. Hold the `Phaser.Game` instance
2. Instantiate all sub-managers and pass dependencies
3. Wire save persistence (call `saveService.save()` on EventBus `'save-requested'` events)
4. Route any cross-manager interactions that cannot be expressed via EventBus alone

### Acceptance Criteria
- [ ] `wc -l src/game/managers/GameManager.ts` is < 300
- [ ] `wc -l src/game/managers/DiveManager.ts` is < 500
- [ ] `wc -l src/game/managers/DomeManager.ts` is < 500
- [ ] All dive lifecycle behavior works correctly end-to-end: start dive → mine layers → ascend → rewards
- [ ] All dome navigation works correctly: room switching, pet tick, farm timers
- [ ] `npm run typecheck` passes

### Playwright Test

```js
// Save as /tmp/test-decomposition.js
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
  // Full dive lifecycle test
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-decomp-mine.png' })
  // Navigate back to dome
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-decomp-dome.png' })
  await browser.close()
  console.log('Decomposition test complete. Verify screenshots show correct mine and dome states.')
})()
```

---

## Sub-Phase 7.15: Typed Event Bus (DD-V2-224)

### What
Create a singleton `EventBus` class with TypeScript generics for fully type-safe cross-boundary event dispatch. Both Phaser scenes and Svelte components subscribe to and emit events through this single bus. This replaces the current asymmetric bridge where Phaser emits to the game object and Svelte calls GameManager methods directly — a pattern that creates tight coupling and makes the codebase brittle as the manager count grows.

**Communication model**:
- Phaser scenes emit game events (`'block-mined'`, `'player-moved'`, `'oxygen-changed'`)
- Svelte components emit user intent events (`'dive-start-requested'`, `'quiz-answer-submitted'`)
- Managers subscribe to both and emit result events (`'score-updated'`, `'quiz-result'`)
- All event types are defined in a central `src/events/types.ts` — no string-only events anywhere

**Synchronous vs async dispatch**:
- Game-critical events (block mined, player moved, oxygen drain): synchronous dispatch — handlers run in the same tick
- UI update events (score display, GAIA toast, overlay open): async dispatch via `queueMicrotask()` — decouples Phaser frame timing from Svelte reactivity

### Where
- **Create**: `src/events/types.ts` — central event type registry
- **Create**: `src/events/EventBus.ts` — singleton class with typed `on()` / `emit()` / `off()`
- **Modify**: `src/main.ts` — instantiate EventBus singleton, pass to Phaser game config and Svelte app context
- **Modify**: All existing `game.events.emit()` call sites in Phaser scenes → replace with `eventBus.emit()`
- **Modify**: All direct `gameManager.methodCall()` from Svelte components → replace with `eventBus.emit()`

### How

#### Step 1 — Create `src/events/types.ts`

```typescript
// src/events/types.ts
// Central registry of ALL cross-boundary event types.
// Import from here — never use raw string event names.

import type { BlockType, Rarity, MineralTier } from '../data/types'

/** Emitted by MineScene when a block is fully destroyed. */
export interface BlockMinedEvent {
  x: number
  y: number
  blockType: BlockType
  loot: Array<{ type: string; tier: MineralTier; rarity: Rarity }>
}

/** Emitted by MineScene each time the player moves one tile. */
export interface PlayerMovedEvent {
  gridX: number
  gridY: number
  direction: 'up' | 'down' | 'left' | 'right'
}

/** Emitted when oxygen level changes for any reason. */
export interface OxygenChangedEvent {
  current: number
  max: number
  delta: number
  cause: 'movement' | 'hazard' | 'quiz-wrong' | 'replenish'
}

/** Emitted by Svelte QuizOverlay when the player selects an answer. */
export interface QuizAnswerSubmittedEvent {
  factId: string
  selectedDistractorIndex: number | 'correct'
  isCorrect: boolean
}

/** Emitted by DiveManager when a layer transition begins. */
export interface LayerTransitionEvent {
  fromLayer: number
  toLayer: number
  biome: string
}

/** Emitted by GameManager when the score/dust count updates. */
export interface ScoreUpdatedEvent {
  dust: number
  shards: number
  crystals: number
  geodes: number
  essence: number
}

/** Emitted by GaiaManager when a new GAIA toast should appear. */
export interface GaiaToastRequestedEvent {
  message: string
  mood: 'calm' | 'excited' | 'stern' | 'curious'
  duration?: number
}

// Add all additional event types here as new systems are built.
// NEVER define event payloads inline at the call site.

/** Master event map: event name → payload type */
export interface GameEventMap {
  'block-mined': BlockMinedEvent
  'player-moved': PlayerMovedEvent
  'oxygen-changed': OxygenChangedEvent
  'quiz-answer-submitted': QuizAnswerSubmittedEvent
  'layer-transition': LayerTransitionEvent
  'score-updated': ScoreUpdatedEvent
  'gaia-toast-requested': GaiaToastRequestedEvent
  // Lifecycle events (no payload)
  'dive-start-requested': void
  'dive-end-requested': void
  'save-requested': void
}
```

#### Step 2 — Create `src/events/EventBus.ts`

```typescript
// src/events/EventBus.ts

import type { GameEventMap } from './types'

type Handler<T> = T extends void ? () => void : (data: T) => void
type EventName = keyof GameEventMap

/**
 * Typed singleton event bus for cross-boundary communication.
 *
 * Usage:
 *   eventBus.emit('block-mined', { x: 3, y: 5, blockType: BlockType.Stone, loot: [] })
 *   eventBus.on('block-mined', (data) => { console.log(data.blockType) })
 */
export class EventBus {
  private handlers = new Map<EventName, Set<Function>>()

  /**
   * Registers a handler for an event.
   * Returns an unsubscribe function.
   */
  public on<K extends EventName>(
    event: K,
    handler: Handler<GameEventMap[K]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  /**
   * Removes a previously registered handler.
   */
  public off<K extends EventName>(
    event: K,
    handler: Handler<GameEventMap[K]>,
  ): void {
    this.handlers.get(event)?.delete(handler)
  }

  /**
   * Dispatches a synchronous event to all registered handlers.
   * Use for game-critical events (block mined, movement, oxygen).
   */
  public emit<K extends EventName>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      handler(args[0])
    }
  }

  /**
   * Dispatches an async event via queueMicrotask.
   * Use for UI update events (score display, toasts, overlay open/close).
   */
  public emitAsync<K extends EventName>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    queueMicrotask(() => this.emit(event, ...(args as any)))
  }

  /** Removes all handlers — call on game teardown. */
  public clear(): void {
    this.handlers.clear()
  }
}

/** Singleton instance — import and use directly. */
export const eventBus = new EventBus()
```

#### Step 3 — Migration Strategy

Do NOT attempt to migrate all existing `game.events.emit()` calls in one commit. Use this staged approach:

1. Create `EventBus.ts` and `types.ts` — no usage yet, just the infrastructure
2. Migrate one Svelte → GameManager call per sub-agent task (start with `quiz-answer-submitted`)
3. After each migration, run `npm run typecheck` — the type system will catch any event name typos
4. Keep old `game.events.emit()` calls working during migration — do NOT remove them until the bus equivalent is verified
5. Final cleanup: grep for any remaining `game.events.emit()` / `gameManager.` direct calls from Svelte and replace

### Acceptance Criteria
- [ ] `src/events/types.ts` defines all events listed in the spec above, plus any events discovered during implementation
- [ ] `src/events/EventBus.ts` exports the `eventBus` singleton
- [ ] At least 3 previously direct-method-call sites in Svelte components now use `eventBus.emit()` instead
- [ ] TypeScript correctly rejects `eventBus.emit('block-mined', { wrongField: true })` — wrong payload shape is a compile error
- [ ] `npm run typecheck` passes with all migrated call sites
- [ ] `npm run build` succeeds

### Playwright Test

```js
// Save as /tmp/test-eventbus.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Verify eventBus is accessible and functional
  const busExists = await page.evaluate(() => {
    return typeof (window as any).__EVENT_BUS__ !== 'undefined'
  })
  console.log('EventBus accessible:', busExists)
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-eventbus.png' })
  await browser.close()
})()
```

---

## Sub-Phase 7.16: Haptic Feedback Service (DD-V2-213)

### What
Create `src/services/hapticService.ts` wrapping `@capacitor/haptics` to provide a structured haptic vocabulary for the mine. Haptics are a critical component of mining feel — the physical sensation of hitting a rock is as important as the visual flash. The service is a no-op on web (desktop, Playwright tests) and fires only on native Capacitor builds.

**Haptic vocabulary**:
| Event | Pattern | Timing |
|---|---|---|
| Block hit (terrain) | `impact.light` | At animation impact keyframe |
| Block break | `impact.heavy` | At block destruction frame |
| Rare loot drop (uncommon+) | `notification.success` | When loot pops from block |
| Hazard damage (lava/gas) | `notification.warning` | On damage application |
| Legendary/mythic find | Custom 200ms vibrate | At rarity reveal animation start |
| Quiz correct | `notification.success` | On correct answer flash |
| Quiz wrong | `notification.warning` | On wrong answer flash |
| Achievement unlock | Custom: 100ms on, 50ms off, 100ms on | At unlock toast appear |

**Critical timing note**: Haptics MUST fire at the animation impact keyframe, not in the input handler. Firing in the input handler creates a disconnect between the felt tap and the visual hit — the haptic arrives before the player sees the swing land. Instead, fire from the animation callback or from the same game tick as the visual flash.

**Device variation note**: Samsung Galaxy devices use a linear resonant actuator that produces clean, distinct pulses. Pixel devices use a different motor with longer settling time. Test both — what feels crisp on Pixel may feel muddy on Samsung, and vice versa. Prefer shorter, sharper patterns over long rumbles.

### Where
- **Create**: `src/services/hapticService.ts` — singleton with typed haptic methods
- **Modify**: `src/game/systems/ImpactSystem.ts` (from 7.8) — replace direct Capacitor calls (if any) with `hapticService` calls
- **Modify**: `src/ui/components/QuizOverlay.svelte` — call `hapticService.quizCorrect()` / `hapticService.quizWrong()` on answer flash

### How

#### Step 1 — Create `src/services/hapticService.ts`

```typescript
// src/services/hapticService.ts

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Typed haptic feedback service for Recall Rogue.
 *
 * All methods are no-ops on web — safe to call unconditionally.
 * Fire at animation impact keyframes, NOT in input handlers.
 */
class HapticService {
  private isNative: boolean

  constructor() {
    this.isNative = Capacitor.isNativePlatform()
  }

  /**
   * Light impact — terrain block hit (not yet destroyed).
   * Fire at the pickaxe-hits-block animation frame.
   */
  public blockHit(): void {
    if (!this.isNative) return
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  }

  /**
   * Heavy impact — block fully broken.
   * Fire when block destruction is confirmed.
   */
  public blockBreak(): void {
    if (!this.isNative) return
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
  }

  /**
   * Success notification — rare loot drop or quiz correct answer.
   */
  public rareLoot(): void {
    if (!this.isNative) return
    Haptics.notification({ type: NotificationType.Success }).catch(() => {})
  }

  /**
   * Warning notification — hazard damage or quiz wrong answer.
   */
  public hazardDamage(): void {
    if (!this.isNative) return
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
  }

  /**
   * Custom double-pulse — legendary/mythic rarity find.
   * Fires at the rarity reveal animation start.
   */
  public async legendaryFind(): Promise<void> {
    if (!this.isNative) return
    await Haptics.vibrate({ duration: 200 })
  }

  /**
   * Quiz correct answer haptic.
   * Fire on the green flash frame, not on button press.
   */
  public quizCorrect(): void {
    this.rareLoot()  // same pattern, shared implementation
  }

  /**
   * Quiz wrong answer haptic.
   * Fire on the red flash frame, not on button press.
   */
  public quizWrong(): void {
    this.hazardDamage()  // same pattern, shared implementation
  }

  /**
   * Achievement unlock — distinctive double-tap pattern.
   */
  public async achievementUnlock(): Promise<void> {
    if (!this.isNative) return
    await Haptics.vibrate({ duration: 100 })
    await new Promise(r => setTimeout(r, 50))
    await Haptics.vibrate({ duration: 100 })
  }
}

/** Singleton instance — import and use directly in scenes and components. */
export const hapticService = new HapticService()
```

#### Step 2 — Integrate in `ImpactSystem.ts`

```typescript
// In ImpactSystem.ts, replace any direct Haptics calls:
import { hapticService } from '../../services/hapticService'

// In triggerImpact(), at the animation impact keyframe callback:
if (isDestroyingHit) {
  hapticService.blockBreak()
} else {
  hapticService.blockHit()
}
```

#### Step 3 — Integrate in `QuizOverlay.svelte`

```svelte
<script lang="ts">
  import { hapticService } from '../../services/hapticService'

  function handleAnswer(isCorrect: boolean) {
    // Fire haptic on flash frame (200ms after answer, matching flash timing)
    setTimeout(() => {
      if (isCorrect) hapticService.quizCorrect()
      else hapticService.quizWrong()
    }, 200)
  }
</script>
```

**Note on `@capacitor/haptics` installation**: This package requires `npm install @capacitor/haptics`. Confirm with the user before adding — per project rules, new npm dependencies require explicit approval.

### Acceptance Criteria
- [ ] `hapticService.blockHit()` and `hapticService.blockBreak()` are called at the correct animation keyframe (not in the input handler)
- [ ] All haptic methods are no-ops in browser (Playwright tests never error on haptic calls)
- [ ] On physical Android device: block hits produce light haptic, block breaks produce heavy haptic
- [ ] Quiz correct/wrong haptics fire at the flash frame timing (200ms after answer selection)
- [ ] `npm run typecheck` passes
- [ ] Manual test log created at `docs/roadmap/phases/PHASE-07-HAPTIC-TEST-LOG.md` confirming Samsung + Pixel test results

### Playwright Test

```js
// Save as /tmp/test-haptics-web.js
// On web, haptics are no-ops — just verify no errors are thrown
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  // Monitor for any console errors related to haptics
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Mine 10 blocks — haptics should be called silently on web
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(80)
  }
  await page.screenshot({ path: '/tmp/ss-haptics.png' })
  await browser.close()
  const hapticErrors = errors.filter(e => e.toLowerCase().includes('haptic'))
  console.log('Haptic-related errors (should be 0):', hapticErrors.length)
  console.log('All console errors:', errors)
})()
```

---

## Sub-Phase 7.17: 4-Bit Autotile System (DD-V2-232)

### What
Implement 16-variant autotiling using a 4-bit cardinal neighbor bitmask. Each `MineCell` stores a computed `tileVariant` index (0–15) derived from which of its four cardinal neighbors share its block group. The sprite atlas provides 5 base block types × 16 variants = 80 tile sprites per biome. This replaces the single-sprite-per-type rendering introduced in 7.1 with a richer, fully connected geological look.

**Post-launch upgrade path**: After shipping, analyse player-session heatmaps to identify which 5 biomes receive the most exploration time. Upgrade those hero biomes from 4-bit (16-variant) to 8-bit (47-variant) autotiling using the full Wang-tile corner system. This delivers a disproportionate visual uplift where it is actually seen.

### Where
- **Modify**: `src/game/systems/AutotileSystem.ts` — extend `computeTileMask()` to write `cell.tileVariant`
- **Modify**: `src/data/types.ts` — add `tileVariant?: number` to `MineCell`
- **Modify**: `src/game/scenes/MineScene.ts` — read `tileVariant` when selecting tile index in the tilemap layer
- **Modify**: `src/assets/sprites/tiles/autotile/` — add 80 tile sprites per biome (16 variants × 5 types)
- **Modify**: `src/assets/sprites-hires/tiles/autotile/` — hi-res counterparts

### How

**Step 1** — Add `tileVariant` to `MineCell` in `src/data/types.ts`:
```typescript
export interface MineCell {
  // ... existing fields ...
  /** 4-bit autotile bitmask index (0-15). Computed on generation and on neighbor change. */
  tileVariant?: number
}
```

**Step 2** — Extend `AutotileSystem.ts` with a `computeAllVariants(grid)` function that iterates the full grid and writes `cell.tileVariant = computeTileMask(x, y, grid)` for every terrain cell. Call this after mine generation and after each block is mined.

**Step 3** — In `MineScene.ts`, when placing a tile into the `TilemapLayer`, compute the tile index as:
```typescript
const variant = cell.tileVariant ?? 0
const tileIndex = BLOCK_TYPE_TILE_OFFSET[cell.type] + variant
```
where `BLOCK_TYPE_TILE_OFFSET` maps each of the 5 base types to its starting index in the atlas (e.g., `Dirt` → 0, `SoftRock` → 16, `Stone` → 32, `HardRock` → 48, `Unbreakable` → 64).

**Step 4** — Generate placeholder tile sprites (grey rectangles with corner/edge indicators) to unblock development. Replace with final ComfyUI-generated sprites before art review.

### Acceptance Criteria
- All 16 bitmask variants (0–15) render visually distinct for at least one block type
- Mined blocks cause neighbors to recalculate their `tileVariant` immediately
- No regression to the old `drawBlockPattern()` path for terrain blocks
- `npm run typecheck` passes with zero errors

### Playwright Test
```js
// Save as /tmp/test-7-17-autotile.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-17-autotile-before.png' })
  // Mine several blocks to trigger neighbor recalculation
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(150)
  }
  await page.screenshot({ path: '/tmp/ss-7-17-autotile-after.png' })
  await browser.close()
  console.log('Screenshots saved: /tmp/ss-7-17-autotile-before.png and -after.png')
})()
```

**Verification**: Visual comparison of before/after screenshots confirms connected tile borders, all 16 variants present in the visible grid, no visual seams between same-group blocks.

---

## Sub-Phase 7.18: Cross-Material Edge Overlays (DD-V2-233)

### What
Add a two-layer rendering system for block boundaries. Layer 1 is the autotiled base (from 7.17). Layer 2 is a semi-transparent edge mask sprite drawn over any tile that is adjacent to a different material type. This produces smooth, natural-looking transitions between dirt and stone, stone and crystal, and so on — without requiring a sprite for every possible material pairing.

**Sprite budget**: 4–8 edge sprites per material (top edge, bottom edge, left edge, right edge, plus up to 4 corner blends). With 5 base materials, this is 20–40 total edge sprites — a linear cost that scales cleanly as new materials are added. This deliberately avoids the quadratic explosion of per-pair transition sprites.

### Where
- **Create**: `src/game/systems/EdgeOverlaySystem.ts` — determines which edge sprites to draw for each cell
- **Create**: `src/assets/sprites/tiles/edges/` — edge mask sprites (semi-transparent PNG, 32px)
- **Create**: `src/assets/sprites-hires/tiles/edges/` — hi-res counterparts (256px)
- **Modify**: `src/game/scenes/MineScene.ts` — draw edge overlay layer above the tilemap base layer

### How

**Step 1** — Create `EdgeOverlaySystem.ts` with a function `getEdgeMasks(x, y, grid): EdgeMask[]` that returns 0–4 edge sprite keys for a given cell, one per direction where an adjacent cell belongs to a different material group.

**Step 2** — Define `EdgeMask`:
```typescript
export interface EdgeMask {
  textureKey: string   // e.g. 'edge_stone_top'
  alpha: number        // typically 0.6-0.8
  direction: 'top' | 'right' | 'bottom' | 'left'
}
```

**Step 3** — In `MineScene.ts`, after drawing the base tilemap layer, iterate visible cells and call `getEdgeMasks()`. Draw each returned mask as a sprite at the same screen position as the cell, with the specified alpha. Use the existing sprite pool from 7.12 to avoid allocations.

**Step 4** — Generate placeholder edge sprites: a 32px PNG per direction, filled with a 50% alpha gradient fading from white at the edge to transparent inward. Replace with biome-tinted final art in Phase 9.

### Acceptance Criteria
- Dirt-to-stone and stone-to-crystal boundaries render smooth visible transitions
- Edge overlays do not appear between blocks of the same material group
- Performance: no measurable FPS drop vs. base tilemap alone (edge sprites are already pooled)
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-18-edges.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-18-edges.png' })
  await browser.close()
  console.log('Screenshot: /tmp/ss-7-18-edges.png — inspect dirt/stone boundaries for edge blending')
})()
```

**Verification**: Dirt-stone and stone-crystal boundaries render smooth transitions. No double-edge artifacts on same-material boundaries.

---

## Sub-Phase 7.19: Dirty-Rect Rendering System (DD-V2-234)

### What
Replace full-grid-every-frame redraws with a dirty-rect system. Only tiles that changed (due to mining, hazard spread, or fog reveal) plus their 8 immediate neighbors are re-rendered per frame. This drops per-frame render cost from O(visible_grid) to O(changed_tiles), which is critical for 40×40 grids on low-end mobile hardware.

**Why 8 neighbors and not 4**: Autotile variants and edge overlays are affected by diagonal neighbors in certain 8-bit configurations. Marking the Moore neighborhood (8 surrounding cells) as dirty guarantees correctness even when the autotile system is later upgraded.

### Where
- **Create**: `src/game/systems/DirtyRectTracker.ts` — manages the dirty-cell set per frame
- **Modify**: `src/game/systems/MiningSystem.ts` — marks destroyed cell + 8 neighbors dirty on block mine
- **Modify**: `src/game/systems/HazardSystem.ts` — marks affected cells dirty on hazard spread
- **Modify**: `src/game/systems/FogSystem.ts` — marks revealed cells dirty on fog update
- **Modify**: `src/game/scenes/MineScene.ts` — replace `redrawAll()` with `redrawDirty(tracker)` each frame

### How

**Step 1** — Create `DirtyRectTracker.ts`:
```typescript
export class DirtyRectTracker {
  private dirty = new Set<number>()
  private width: number

  constructor(width: number) { this.width = width }

  /** Mark a cell at (x, y) dirty. */
  mark(x: number, y: number): void {
    this.dirty.add(y * this.width + x)
  }

  /** Mark a cell and all 8 Moore-neighborhood neighbors dirty. */
  markWithNeighbors(x: number, y: number, gridW: number, gridH: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) this.mark(nx, ny)
      }
    }
  }

  /** Returns all dirty cell indices this frame, then clears the set. */
  flush(): number[] {
    const out = Array.from(this.dirty)
    this.dirty.clear()
    return out
  }

  get size(): number { return this.dirty.size }
}
```

**Step 2** — In `MineScene.ts`, instantiate one `DirtyRectTracker` per mine layer. In the game update loop, call `redrawDirty(tracker.flush())` instead of `redrawAll()`. The dirty-redraw function iterates only the returned indices and updates those tile positions in the `TilemapLayer`.

**Step 3** — Add a DevPanel stat: "Dirty tiles / frame" using `tracker.size` before `flush()`. Use this to profile actual workload per frame in development.

### Acceptance Criteria
- FPS at 40×40 grid with 5 simultaneous lava-spread ticks is ≥50 FPS on a mid-tier Android device (Pixel 6a target)
- DevPanel shows <20 dirty tiles per idle frame, <60 during active mining
- No visual artifacts (missed tile updates) after extended mining sessions
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-19-dirty-rect.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Mine repeatedly to generate dirty tiles
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(80)
  }
  await page.screenshot({ path: '/tmp/ss-7-19-dirty-rect.png' })
  await browser.close()
  console.log('Dirty-rect test done. Check DevPanel in screenshot for dirty tile count.')
})()
```

**Verification**: FPS profiling before/after at 40×40 confirms measurable improvement. DevPanel dirty-tile counter visible in screenshot.

---

## Sub-Phase 7.20: 4 Crack Damage Stages (DD-V2-251)

### What
Replace the current 2-stage procedural crack rendering with 4-stage sprite overlays at 25%, 50%, 75%, and 90% damage thresholds. Each stage uses a pre-generated semi-transparent PNG overlay that shows progressively more severe cracking. Block-type variation is achieved by tinting the crack interior color to match the underlying material (e.g., orange interior for lava rock, blue for crystal).

**Sprite spec**:
- Resolution: 32px (gameplay) and 256px (hi-res) PNG
- Background: fully transparent
- Crack lines: dark grey (#333333), 2-3px wide at 32px resolution
- Interior tint area: white-fill region behind crack lines (receives `setTint()` in Phaser)
- Four files per block type: `crack_stage1.png`, `crack_stage2.png`, `crack_stage3.png`, `crack_stage4.png`

### Where
- **Modify**: `src/game/systems/ImpactSystem.ts` (from 7.8) — replace 2-stage crack logic with 4-stage selection
- **Modify**: `src/game/scenes/MineScene.ts` — apply tint to crack sprite based on `BlockType`
- **Create**: `src/assets/sprites/cracks/` — 4 crack stage PNGs (32px)
- **Create**: `src/assets/sprites-hires/cracks/` — hi-res counterparts (256px)

### How

**Step 1** — Define the crack stage thresholds in `ImpactSystem.ts`:
```typescript
const CRACK_STAGES = [
  { threshold: 0.25, key: 'crack_stage1' },
  { threshold: 0.50, key: 'crack_stage2' },
  { threshold: 0.75, key: 'crack_stage3' },
  { threshold: 0.90, key: 'crack_stage4' },
]

function getCrackStageKey(damagePercent: number): string | null {
  for (let i = CRACK_STAGES.length - 1; i >= 0; i--) {
    if (damagePercent >= CRACK_STAGES[i].threshold) return CRACK_STAGES[i].key
  }
  return null
}
```

**Step 2** — Define material tint colors:
```typescript
const CRACK_TINTS: Record<BlockType, number> = {
  [BlockType.Dirt]:        0x8B6914,
  [BlockType.SoftRock]:    0xA08060,
  [BlockType.Stone]:       0x888888,
  [BlockType.HardRock]:    0x555577,
  [BlockType.Unbreakable]: 0x333333,
  [BlockType.Crystal]:     0x44AAFF,
  [BlockType.Lava]:        0xFF6600,
  // ... other block types default to 0xAAAAAA
}
```

**Step 3** — In `ImpactSystem.ts`, when a block receives a hit: compute `damagePercent = currentHits / maxHits`, look up the crack key, retrieve a pooled sprite, set its position to the cell, apply `sprite.setTint(CRACK_TINTS[cell.type] ?? 0xAAAAAA)`, and set alpha to 0.85.

**Step 4** — Generate crack stage sprites via ComfyUI or manually draw using the pixel art spec. Use the `sprite-gen/` workflow for consistency.

### Acceptance Criteria
- Four visually distinct crack stages visible when hitting any terrain block
- Crack tint matches the underlying material color for at least 5 block types
- Old 2-stage crack rendering fully removed
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-20-cracks.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Hit a hard block repeatedly without breaking it to cycle through crack stages
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `/tmp/ss-7-20-crack-stage${i + 1}.png` })
  }
  await browser.close()
  console.log('4 crack stage screenshots saved to /tmp/ss-7-20-crack-stage*.png')
})()
```

**Verification**: All 4 crack stage screenshots show progressively more severe cracking. Tint visible in each. Final break clears the crack overlay.

---

## Sub-Phase 7.21: Per-Block Impact Profiles (DD-V2-245)

### What
Define a distinct impact profile for each material type, giving each block a physically plausible and tactilely satisfying feel when struck. Impact profiles control particle behavior, screen shake magnitude, sound (placeholder), and flash color — together these make hitting dirt feel fundamentally different from hitting crystal.

**Impact profiles by material**:

| Material | Particle Style | Particle Count | Velocity | Gravity | Lifespan | Shake | Flash Color |
|---|---|---|---|---|---|---|---|
| Dirt | Soft crumble | 6–10 | Low, wide arc | High | 400ms | 1px | #C8A060 |
| Soft Rock | Dust puff | 5–8 | Medium, dispersed | Medium | 350ms | 1px | #B0A090 |
| Stone | Spark clink | 4–6 | High, tight | Low | 200ms | 2px | #DDDDDD |
| Hard Rock | Heavy dust | 8–12 | Low, heavy | High | 500ms | 3px | #777788 |
| Crystal | Prismatic float | 6–8 | Medium, float up | Negative (-50) | 600ms | 2px | #88CCFF |
| Lava | Ember spray | 8–14 | High, random | Medium | 800ms | 3px | #FF8844 |

### Where
- **Create**: `src/data/impactProfiles.ts` — typed impact profile definitions per `BlockType`
- **Modify**: `src/game/systems/ImpactSystem.ts` — read profile when spawning hit particles and applying shake
- **Modify**: `src/game/systems/ParticleSystem.ts` — accept profile parameters instead of hardcoded values

### How

**Step 1** — Create `src/data/impactProfiles.ts`:
```typescript
import { BlockType } from './types'

export interface ImpactProfile {
  particleCount: [number, number]     // [min, max]
  velocityX:     [number, number]     // pixels/sec
  velocityY:     [number, number]     // pixels/sec (negative = upward)
  gravity:       number               // pixels/sec² (negative = float)
  lifespan:      number               // milliseconds
  shakeIntensity: number              // pixels
  flashColor:    number               // 0xRRGGBB
  particleTint:  number               // 0xRRGGBB
}

export const IMPACT_PROFILES: Record<number, ImpactProfile> = {
  [BlockType.Dirt]: {
    particleCount: [6, 10], velocityX: [-60, 60], velocityY: [-40, -10],
    gravity: 200, lifespan: 400, shakeIntensity: 1,
    flashColor: 0xC8A060, particleTint: 0x8B6914
  },
  [BlockType.SoftRock]: {
    particleCount: [5, 8], velocityX: [-70, 70], velocityY: [-50, -15],
    gravity: 150, lifespan: 350, shakeIntensity: 1,
    flashColor: 0xB0A090, particleTint: 0xA08060
  },
  [BlockType.Stone]: {
    particleCount: [4, 6], velocityX: [-90, 90], velocityY: [-80, -30],
    gravity: 300, lifespan: 200, shakeIntensity: 2,
    flashColor: 0xDDDDDD, particleTint: 0x999999
  },
  [BlockType.HardRock]: {
    particleCount: [8, 12], velocityX: [-50, 50], velocityY: [-30, -5],
    gravity: 350, lifespan: 500, shakeIntensity: 3,
    flashColor: 0x777788, particleTint: 0x555577
  },
  [BlockType.Crystal]: {
    particleCount: [6, 8], velocityX: [-60, 60], velocityY: [-70, -20],
    gravity: -50, lifespan: 600, shakeIntensity: 2,
    flashColor: 0x88CCFF, particleTint: 0x44AAFF
  },
  [BlockType.Lava]: {
    particleCount: [8, 14], velocityX: [-100, 100], velocityY: [-90, -20],
    gravity: 180, lifespan: 800, shakeIntensity: 3,
    flashColor: 0xFF8844, particleTint: 0xFF4400
  },
}

/** Returns the impact profile for a block type, defaulting to Stone if not defined. */
export function getImpactProfile(type: BlockType): ImpactProfile {
  return IMPACT_PROFILES[type] ?? IMPACT_PROFILES[BlockType.Stone]
}
```

**Step 2** — In `ImpactSystem.ts`, replace hardcoded particle/shake values with `getImpactProfile(cell.type)` lookups. Pass the profile's `shakeIntensity` to `CameraSystem.shake()` and the particle params to `ParticleSystem.spawnBurst()`.

### Acceptance Criteria
- Breaking dirt, stone, crystal, and lava each produce noticeably different particle behavior
- Screen shake magnitudes differ visibly between Dirt (1px) and Hard Rock (3px)
- Flash colors are material-appropriate
- All profile lookup paths covered, no undefined profile falls through silently
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-21-impact-profiles.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Mine several different block types and screenshot during particle burst
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(50)
    await page.screenshot({ path: `/tmp/ss-7-21-impact-${i}.png` })
    await page.waitForTimeout(150)
  }
  await browser.close()
  console.log('Impact profile screenshots: /tmp/ss-7-21-impact-*.png')
})()
```

**Verification**: Screenshots show visually distinct particle bursts. Dirt produces a brown crumble, stone a sharp spark burst, crystal floats upward with a blue tint.

---

## Sub-Phase 7.22: Progressive Hit Satisfaction (DD-V2-246)

### What
Scale all visual feedback linearly with the damage percentage already dealt to a block. The first hit of a fresh block feels light and precise; the penultimate hit feels heavy and anticipatory; the final break is climactic and unmistakable. This progression is critical for player satisfaction in a game where blocks are hit thousands of times per session.

**Scaling curves** (input: `damagePercent` 0.0–1.0):
- Particle count: linear 4 → 10
- Screen shake: linear 1px → 3px
- Crack overlay alpha: linear 0.4 → 0.8
- Sprite scale bulge: 1.0 until 75% damage, then 1.03× for one frame on hit

**Final break bonuses** (at `damagePercent == 1.0`):
- 15 particles emitted in a radial burst
- 5px screen shake, 300ms duration
- 150ms white flash (screen-space overlay at 40% alpha, ease-out)
- 50ms freeze-frame (advance Phaser clock by 0 for 50ms, then resume)

### Where
- **Modify**: `src/game/systems/ImpactSystem.ts` — add `damagePercent` parameter to hit feedback functions
- **Modify**: `src/game/systems/MiningSystem.ts` — pass `damagePercent` when calling `ImpactSystem`
- **Create**: `src/game/systems/ScreenFlashSystem.ts` — manages the screen-space white flash overlay
- **Modify**: `src/game/scenes/MineScene.ts` — integrate `ScreenFlashSystem`

### How

**Step 1** — In `MiningSystem.ts`, after applying damage: compute `damagePercent = cell.hitsTaken / cell.maxHits` and pass it to `ImpactSystem.onBlockHit(cell, damagePercent)`.

**Step 2** — In `ImpactSystem.onBlockHit()`, interpolate all visual parameters:
```typescript
const count = Math.round(lerp(4, 10, damagePercent))
const shake = lerp(1, 3, damagePercent)
const crackAlpha = lerp(0.4, 0.8, damagePercent)
const bulge = damagePercent >= 0.75 ? 1.03 : 1.0
```

**Step 3** — Apply the bulge: set `blockSprite.setScale(bulge)`, then tween it back to 1.0 over 80ms.

**Step 4** — Create `ScreenFlashSystem.ts`:
```typescript
export class ScreenFlashSystem {
  private overlay: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add.rectangle(0, 0,
      scene.scale.width, scene.scale.height, 0xFFFFFF, 0)
      .setDepth(9999).setScrollFactor(0)
  }

  /** Trigger a white flash: 150ms ease-out from 40% alpha. */
  flash(): void {
    this.overlay.setAlpha(0.4)
    // Tween alpha to 0 over 150ms
    this.overlay.scene.tweens.add({
      targets: this.overlay, alpha: 0, duration: 150, ease: 'Power2.Out'
    })
  }
}
```

**Step 5** — For the 50ms freeze-frame: call `scene.physics.pause()` and resume after 50ms via `scene.time.delayedCall(50, () => scene.physics.resume())`. This pauses physics only — tweens continue, so the flash tween plays over the frozen world.

### Acceptance Criteria
- First hit on a fresh block produces 4 particles and 1px shake
- Later hits produce visibly more particles and stronger shake
- Final break triggers: 15 particles, 5px shake, white flash, 50ms freeze
- Bulge scale pop visible on-screen during late-stage hits
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-22-progressive-hit.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Hit a high-HP block (Hard Rock) repeatedly — capture each hit frame
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(40)
    await page.screenshot({ path: `/tmp/ss-7-22-hit-${i}.png` })
    await page.waitForTimeout(100)
  }
  await browser.close()
  console.log('Progressive hit screenshots: /tmp/ss-7-22-hit-*.png')
})()
```

**Verification**: Screenshot sequence shows escalating particle density and crack severity. Final-break screenshot shows white flash and larger particle burst.

---

## Sub-Phase 7.23: Block Shatter + Loot Pop Physics (DD-V2-249, DD-V2-250)

### What
When a block is destroyed, its sprite splits into 4 quadrant fragments that fly outward — then any dropped loot items arc up from the break point and vacuum-suck into the player's inventory slot. The entire sequence from break to collection runs in 600–900ms and must feel snappy and rewarding every single time.

**Block shatter sequence**:
1. On destroy: split the block sprite into 4 half-size quadrant sprites (TL, TR, BL, BR)
2. Apply outward velocity: TL → (-60, -80), TR → (60, -80), BL → (-60, 40), BR → (60, 40) px/sec
3. Gravity: 200 px/sec²
4. Fade alpha to 0 over 300ms while spinning (random rotation velocity ±180°/sec)
5. Recycle sprites back to pool at alpha=0

**Loot pop sequence**:
1. Spawn loot icon at block position
2. Parabolic arc: launch at 60–90° above horizontal, speed 80–100 px/sec, gravity 150 px/sec²
3. On ground touch (y returns to spawn y): bounce with 40% restitution, max 2–3 bounces
4. After last bounce: 200ms hold at rest
5. Vacuum-suck: ease-in-cubic tween to player screen position over 300ms
6. On arrival: flash inventory slot for 200ms, "+1 [icon]" pop text (+30px, fade 400ms)

**Multi-item drops**: stagger loot pops by 100ms per item, launch slightly different angles.

### Where
- **Modify**: `src/game/systems/ImpactSystem.ts` — add `onBlockDestroy(cell, pos)` that triggers shatter + loot pop
- **Create**: `src/game/systems/LootPopSystem.ts` — manages loot arc, bounce, vacuum physics
- **Modify**: `src/game/scenes/MineScene.ts` — wire `onBlockDestroy`, integrate `LootPopSystem`
- **Modify**: `src/ui/HUD.svelte` — expose inventory slot flash callback

### How

**Step 1** — In `ImpactSystem.onBlockDestroy(cell, worldPos)`: retrieve 4 pooled sprites from the sprite pool, crop each to the appropriate quadrant (via `setCrop()`), apply outward velocity via Phaser tweens, and schedule their recycle after 300ms.

**Step 2** — Create `LootPopSystem.ts` with a `popLoot(itemKey, fromPos, playerPos)` method. Use Phaser's `tweens.add()` with a custom `onUpdate` callback to compute the parabolic trajectory each frame. On landing detection (y >= startY), reverse and dampen velocity for bounces. After bounces, trigger the vacuum tween.

**Step 3** — Wire inventory slot flash: emit a typed event `loot-collected` with `{ itemKey, quantity }` from `LootPopSystem`. The `HUD.svelte` listens and briefly scales/brightens the matching inventory slot icon.

**Step 4** — Ensure `LootPopSystem` uses the existing particle pool and sprite pool — no `new Phaser.GameObjects.Image()` calls inside the hot path.

### Acceptance Criteria
- Destroyed blocks produce 4 fragment sprites flying outward with gravity and rotation
- Loot items arc up, bounce naturally, then vacuum into the player
- "+1" text pop appears and fades at collection point
- Multi-item drops stagger correctly with no z-fighting
- Total sequence duration: 600–900ms measured via DevPanel timer
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-23-loot-pop.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Break several blocks and screenshot mid-loot-pop
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(80)
  }
  // Mine a known loot-dropping block
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(60)   // capture during arc
  await page.screenshot({ path: '/tmp/ss-7-23-loot-arc.png' })
  await page.waitForTimeout(500)  // capture after vacuum
  await page.screenshot({ path: '/tmp/ss-7-23-loot-collected.png' })
  await browser.close()
  console.log('Loot pop screenshots: /tmp/ss-7-23-loot-arc.png and -collected.png')
})()
```

**Verification**: Arc screenshot shows loot mid-flight. Collected screenshot shows inventory slot briefly highlighted and "+1" text visible.

---

## Sub-Phase 7.24: Gacha Reveal Animations (DD-V2-255)

### What
Design a rarity-escalating artifact reveal sequence for when the player surfaces with discovered items. The sequence is designed from Legendary down — each lower rarity tier removes elements from the full effect. This ensures Common reveals feel complete (not sad), while Legendary reveals feel genuinely spectacular.

**Rarity tier effects** (Legendary → Common):

| Rarity | Duration | Full-Screen Flash | Particle Count | Shake | Light Rays | Hold Time |
|---|---|---|---|---|---|---|
| Legendary | 4–5s | Gold, full-screen | 50 | 5px, 500ms | Yes, 8 rays | 3s |
| Epic | 3–4s | Purple burst, 60% screen | 35 | 4px, 300ms | Yes, 4 rays | 2s |
| Rare | 2.5–3s | Blue burst, 40% screen | 20 | 3px, 200ms | No | 1.5s |
| Uncommon | 2–2.5s | Green glow, 20% screen | 12 | 2px, 150ms | No | 1s |
| Common | 1.5s | White ping, 10% screen | 6 | 1px, 80ms | No | 0.5s |

**"Skip" button**: always appears after 1 second, tappable at any time. Instantly completes the reveal and awards the item.

**Light rays**: radial lines emitting from item center, rotating slowly (5°/sec), length 150–300px, alpha 0.3–0.6, gold (#FFD700) for Legendary, appropriate tint for other rarities.

### Where
- **Create**: `src/game/systems/GachaRevealSystem.ts` — manages the full reveal sequence
- **Create**: `src/ui/components/GachaRevealOverlay.svelte` — Svelte overlay for the artifact card and skip button
- **Modify**: `src/game/scenes/DomeScene.ts` (or equivalent surface scene) — trigger reveal after dive complete
- **Modify**: `src/ui/GameUI.svelte` — mount `GachaRevealOverlay`

### How

**Step 1** — Create `GachaRevealSystem.ts` with a `reveal(artifact: Artifact): Promise<void>` method. This emits a `gacha-reveal-start` typed event carrying the artifact data. `GachaRevealOverlay.svelte` subscribes and drives the visual sequence.

**Step 2** — In `GachaRevealOverlay.svelte`:
- On mount: play the appropriate tier sequence using CSS animations + Svelte transitions
- Light rays: SVG `<line>` elements rotated via CSS `transform: rotate()`, animated with `animation: spin linear infinite`
- Particle burst: delegate to `ParticleSystem` via a Phaser event bridge for canvas-space particles
- Hold timer: after the last animation completes, wait `holdTime` ms then auto-dismiss (or skip on tap)

**Step 3** — Skip button: render with `opacity: 0` for first 1000ms, then `transition: opacity 200ms` to `opacity: 1`. Tapping resolves the `reveal()` Promise immediately.

**Step 4** — After reveal completes: add artifact to inventory, show a brief `+1 [ArtifactName]` toast in the dome HUD.

### Acceptance Criteria
- All 5 rarity tiers produce visually distinct reveals with correct durations
- Skip button appears at exactly 1 second for all tiers
- Legendary reveal includes light rays and full-screen gold flash
- Common reveal does not feel empty — particle burst and item card still visible
- Reveal is accessible: screen reader announces item name and rarity on reveal start
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-24-gacha-reveal.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Trigger gacha reveal via DevPanel (set forced rarity)
  // Navigate to dome after dive
  await page.screenshot({ path: '/tmp/ss-7-24-gacha-legendary.png' })
  // Test skip button appears
  await page.waitForTimeout(1200)
  const skipButton = page.locator('button:has-text("Skip")')
  const skipVisible = await skipButton.isVisible().catch(() => false)
  console.log('Skip button visible after 1.2s:', skipVisible)
  await page.screenshot({ path: '/tmp/ss-7-24-gacha-skip.png' })
  await browser.close()
})()
```

**Verification**: Screenshot captures reveal overlay with artifact card, particle burst visible. Skip button appears in second screenshot.

---

## Sub-Phase 7.25: Descent Shaft 3-Phase Transition (DD-V2-256)

### What
Replace the instant layer-change teleport with a cinematic 3-phase descent animation that builds anticipation and contextualizes the biome shift. Total duration ~3 seconds — long enough to feel meaningful, short enough to never feel like a loading screen.

**Phase 1 — Fall (1 second)**:
- Camera zooms out to 70% over 300ms (ease-in-cubic)
- Miner sprite slides down and off-screen bottom
- Shaft wall texture tiles scroll upward at 400 px/sec (parallax blur)
- Trailing particles: 8 dust specks per frame streaking upward behind miner

**Phase 2 — Biome Card (1.5 seconds)**:
- Black full-screen overlay fades in (200ms)
- Biome card slides up from bottom: biome name (pixel font, large), layer number, biome icon, one-line GAIA comment (random from `gaiaComments` array)
- Hold 1 second at full opacity

**Phase 3 — Arrive (0.5 seconds)**:
- Black overlay fades out (200ms)
- New layer grid fades in
- Camera zooms back to 100% (ease-out-cubic)
- Dust-settle burst: 20 particles at arrival position, gravity 200, short lifespan (300ms)

### Where
- **Create**: `src/game/systems/DescentTransitionSystem.ts` — orchestrates the 3-phase sequence
- **Create**: `src/ui/components/BiomeCard.svelte` — the full-screen biome card overlay
- **Modify**: `src/game/scenes/MineScene.ts` — call `DescentTransitionSystem.playTransition()` when entering a shaft
- **Modify**: `src/ui/GameUI.svelte` — mount `BiomeCard`

### How

**Step 1** — Create `DescentTransitionSystem.ts` with `async playTransition(fromLayer: number, toLayer: number, biome: BiomeDefinition): Promise<void>`. This is a Promise-based orchestrator that runs Phase 1 → emits `biome-card-show` event → waits for Phase 2 timer → emits `biome-card-hide` → runs Phase 3 → resolves.

**Step 2** — Phase 1 implementation: use `this.cameras.main.zoomTo(0.7, 300, 'Power2.In')` and a tween on the miner sprite's y position. For shaft wall parallax: create a Graphics object rendering repeating tile textures and update its y offset each frame during Phase 1.

**Step 3** — `BiomeCard.svelte`: receives `biome` prop via Svelte store. Uses `transition:fly={{ y: 200, duration: 300 }}` for the slide-up. Displays `biome.name`, `biome.icon`, `Layer {toLayer}`, and a random entry from `biome.gaiaComments`.

**Step 4** — Phase 3: use `this.cameras.main.zoomTo(1.0, 300, 'Power2.Out')` and trigger `ParticleSystem.spawnBurst()` at the player arrival tile.

### Acceptance Criteria
- Full 3-phase sequence plays when entering a descent shaft, no skipping or glitching
- Biome card displays correct biome name, layer number, and a GAIA comment
- Camera zoom transitions are smooth (no stutter)
- Dust-settle burst fires at player arrival position on new layer
- Typecheck passes; no `async` functions left unhandled in scene update loop

### Playwright Test
```js
// Save as /tmp/test-7-25-descent.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-25-before-descent.png' })
  // Trigger descent via DevPanel or by finding shaft
  // Screenshot during each phase
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-7-25-phase1-fall.png' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-7-25-phase2-biome-card.png' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ss-7-25-phase3-arrive.png' })
  await browser.close()
  console.log('Descent transition screenshots saved.')
})()
```

**Verification**: Phase 2 screenshot shows biome card with correct text. Phase 3 screenshot shows new layer with dust particles and correct camera zoom.

---

## Sub-Phase 7.26: Scanner Sonar Pulse (DD-V2-258, DD-V2-281)

### What
When the player is within 5–8 tiles of a descent shaft and has a Scanner at tier 2 or above, a sonar pulse radiates outward from the player every 2 seconds. The pulse is a thin expanding circle that causes the shaft tile to briefly glow as the wave passes over it — providing a directional hint without a minimap icon.

**Visual spec**:
- Ring: 1px stroke, rgba(102, 51, 204, 0.30) — purple, 30% opacity
- Expansion: 0 → 120px radius over 600ms, linear
- Fade: alpha fades from 0.30 → 0 over the last 300ms of expansion
- Cadence: new pulse every 2000ms
- Shaft glow: when pulse radius crosses shaft tile center, `shaft_sprite.setTint(0xCC99FF)` for 300ms, then clear tint
- Only active: Scanner tier ≥ 2 AND within 5–8 tile radius of shaft

**Design note** (DD-V2-281): The pulse provides directional information because it is player-centered — the shaft tile glows when the ring passes it, which happens later for tiles farther away. Players learn to use the glow direction to navigate.

### Where
- **Create**: `src/game/systems/ScannerPulseSystem.ts` — manages pulse emission and shaft glow
- **Modify**: `src/game/scenes/MineScene.ts` — instantiate and update `ScannerPulseSystem`
- **Modify**: `src/data/types.ts` — add `scannerTier: number` to player equipment state

### How

**Step 1** — Create `ScannerPulseSystem.ts`. On construction, receive a reference to the Phaser scene and the shaft tile position. In `update(playerPos, scannerTier)`:
- If `scannerTier < 2`, do nothing
- Compute Manhattan distance from player to shaft. If > 8 tiles, do nothing
- Emit a new pulse every 2000ms via `scene.time.addEvent()`
- Each pulse is a `Phaser.GameObjects.Arc` with `strokeOnly: true`, starting at radius 0
- Tween radius to 120 over 600ms; tween alpha from 0.30 to 0 starting at 300ms
- In the tween's `onUpdate`: check if current radius > pixel distance from player to shaft center; if just crossed, trigger shaft glow

**Step 2** — Shaft glow: `shaftSprite.setTint(0xCC99FF)`, then `scene.time.delayedCall(300, () => shaftSprite.clearTint())`.

**Step 3** — Recycle Arc objects to the sprite pool after tween completion (or replace with a Graphics object that's redrawn each frame for lower GC pressure).

### Acceptance Criteria
- Pulse ring appears every 2s when player is within 5–8 tiles of shaft with tier-2+ scanner
- Shaft tile glows briefly when ring passes over it
- No pulse appears without scanner or at scanner tier 1
- No pulse appears when player is > 8 tiles from shaft
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-26-scanner-pulse.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Use DevPanel to set scanner tier 2 and teleport near shaft
  await page.waitForTimeout(2200)   // wait for first pulse
  await page.screenshot({ path: '/tmp/ss-7-26-scanner-pulse.png' })
  await browser.close()
  console.log('Scanner pulse screenshot: /tmp/ss-7-26-scanner-pulse.png')
})()
```

**Verification**: Screenshot shows expanding purple ring centered on player. Shaft tile shows tint glow in the direction of the shaft.

---

## Sub-Phase 7.27: Screen Shake System (DD-V2-254)

### What
Implement a structured, three-tier screen shake system using Perlin noise offset to replace any ad-hoc `camera.shake()` calls currently in the codebase. The HUD layer must never shake — only the game camera viewport. An accessibility slider lets players reduce or disable shake entirely.

**Shake tiers**:

| Tier | Amplitude | Duration | Perlin Frequency | Trigger Examples |
|---|---|---|---|---|
| Micro | 1–2px | 50ms | High (fast noise) | Single block hit on soft material |
| Medium | 3–5px | 150ms | Medium | Hard block break, bomb explosion nearby |
| Heavy | 6–10px | 300ms | Low (slow rolling) | Earthquake, lava surge, final break of HardRock |

**Accessibility**: Settings slider with four positions: Off (0%), Reduced (25%), Normal (50%), Full (100%). The slider multiplies all amplitude values. At Off, no shake is applied — all intensity values → 0.

**HUD isolation**: The HUD layer uses `setScrollFactor(0)` and must not be a child of the shaking camera. Verify this is correctly separated in `MineScene.ts`.

### Where
- **Create**: `src/game/systems/ScreenShakeSystem.ts` — Perlin noise shake orchestrator
- **Modify**: `src/game/scenes/MineScene.ts` — replace direct `camera.shake()` calls, integrate `ScreenShakeSystem`
- **Modify**: `src/ui/Settings.svelte` — add shake intensity slider (4 positions)
- **Modify**: `src/services/settingsService.ts` — persist `shakeIntensity: 0 | 0.25 | 0.5 | 1.0` to local storage

### How

**Step 1** — Create `ScreenShakeSystem.ts`. Use a simple seeded Perlin/Simplex noise function (or Phaser's built-in `Phaser.Math.Noise.Perlin2`) to generate x/y offsets each frame. Maintain a `currentShake: { amplitude: number, duration: number, elapsed: number } | null` state. In `update(delta)`: if active, compute `t = elapsed/duration`, apply `amplitude * (1 - t) * intensityScale * noise(t * frequency)` as camera offset via `camera.scrollX += offsetX`.

**Step 2** — Expose three public methods:
```typescript
shakeSystem.micro()   // 1-2px, 50ms
shakeSystem.medium()  // 3-5px, 150ms
shakeSystem.heavy()   // 6-10px, 300ms
```

**Step 3** — Replace all `this.cameras.main.shake(...)` calls in `MineScene.ts` and `ImpactSystem.ts` with appropriate `shakeSystem.medium()` / `shakeSystem.micro()` calls.

**Step 4** — In `Settings.svelte`: add a segmented control with labels "Off / Reduced / Normal / Full". On change, call `settingsService.setShakeIntensity(value)`. `ScreenShakeSystem` reads `settingsService.shakeIntensity` each frame before applying offsets.

### Acceptance Criteria
- All three shake tiers produce visually distinct shake intensities and durations
- HUD (oxygen bar, inventory) does not shake during any tier
- Shake intensity slider at "Off" produces zero camera movement
- No direct `camera.shake()` calls remain in `MineScene.ts` or `ImpactSystem.ts`
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-27-shake.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Trigger heavy shake via DevPanel
  await page.screenshot({ path: '/tmp/ss-7-27-shake-normal.png' })
  // Navigate to settings, set shake to Off
  // Navigate back, trigger heavy shake again
  await page.screenshot({ path: '/tmp/ss-7-27-shake-off.png' })
  await browser.close()
  console.log('Shake screenshots: /tmp/ss-7-27-shake-normal.png and -off.png')
})()
```

**Verification**: Normal shake screenshot shows camera offset (background tiles shifted). Off screenshot shows no camera offset. HUD elements remain stationary in both.

---

## Sub-Phase 7.28: Unified Overlay Style Guide (DD-V2-264)

### What
Apply a consistent visual chrome to all 10+ overlays in the game, replacing the current ad-hoc per-overlay styling. The unified style eliminates the "mismatched UI" impression that makes games feel low-budget, and is achievable as a pure CSS/Svelte refactor with no gameplay changes.

**Unified overlay spec**:
- **Backdrop**: 70% opacity dark (#0A0A0A at 70%), `backdrop-filter: blur(4px)` where supported
- **Panel border**: 2px solid #2A2E38 (dark steel), inner 1px solid #4A5068 (lighter steel) — double-border pixel art effect
- **Panel background**: #12151E (deep navy)
- **Color palette**: Gold (#FFD700) for rewards/highlights, Teal (#20B2AA) for info/GAIA, Red (#CC3333) for danger/wrong, Green (#44AA44) for correct/safe
- **Typography**: Pixel font for titles and labels; system sans-serif (16px+) for body text (see 7.32)
- **Corner radius**: 0px — hard corners only (pixel art aesthetic)

**Overlays to update** (retroactively):
1. Quiz overlay (`QuizOverlay.svelte`)
2. Study overlay (`StudyOverlay.svelte`)
3. Backpack panel (`BackpackPanel.svelte`)
4. Room selection panel (`RoomPanel.svelte`)
5. GAIA chat panel (`GaiaPanel.svelte`)
6. Settings panel (`Settings.svelte`)
7. Biome card (`BiomeCard.svelte` — from 7.25)
8. Gacha reveal overlay (`GachaRevealOverlay.svelte` — from 7.24)
9. Pre-dive prep screen (`PrepScreen.svelte`)
10. Artifact appraisal overlay (`AppraisalOverlay.svelte`)

### Where
- **Create**: `src/ui/styles/overlay.css` — shared CSS custom properties and utility classes
- **Modify**: All 10 overlay Svelte components — apply shared classes, remove inline styles that conflict

### How

**Step 1** — Create `src/ui/styles/overlay.css`:
```css
:root {
  --overlay-backdrop: rgba(10, 10, 10, 0.70);
  --overlay-blur: blur(4px);
  --panel-bg: #12151E;
  --panel-border-outer: #2A2E38;
  --panel-border-inner: #4A5068;
  --color-gold: #FFD700;
  --color-teal: #20B2AA;
  --color-danger: #CC3333;
  --color-success: #44AA44;
}

.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop);
  backdrop-filter: var(--overlay-blur);
  z-index: 100;
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--panel-border-outer);
  outline: 1px solid var(--panel-border-inner);
  border-radius: 0;
}
```

**Step 2** — Import `overlay.css` in the main Svelte entry point (`src/main.ts` or `src/App.svelte`).

**Step 3** — For each overlay component: replace the backdrop `<div>` style with `class="overlay-backdrop"`, replace panel container style with `class="panel"`, replace color values with CSS variables. Remove inline `style=` attributes that duplicate any of the above.

**Step 4** — Visual audit: take Playwright screenshots of all 10 overlays and compare side-by-side to confirm chrome consistency.

### Acceptance Criteria
- All 10 overlays use the shared backdrop, panel border, and color variables
- No overlay has a corner radius > 0px
- Blur effect active on browsers that support `backdrop-filter`
- No per-overlay inline styles conflict with the shared style guide
- `npm run typecheck` passes; no unused CSS warnings

### Playwright Test
```js
// Save as /tmp/test-7-28-overlay-style.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Open settings overlay
  await page.click('[aria-label="Settings"]').catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-7-28-settings.png' })
  // Enter mine and trigger quiz
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(5000)   // wait for quiz to trigger
  await page.screenshot({ path: '/tmp/ss-7-28-quiz.png' })
  await browser.close()
  console.log('Overlay style screenshots: /tmp/ss-7-28-settings.png and -quiz.png')
})()
```

**Verification**: Both screenshots show matching dark panel chrome, double-border, and correct color palette. No mismatched styling between overlays.

---

## Sub-Phase 7.29: Resource Bar Mobile Optimization (DD-V2-265)

### What
Optimize the HUD resource bar for 390px viewport width (iPhone 15 standard width) by abbreviating large numbers and providing a tap-to-expand interaction for infrequently needed resources. The default view shows 3–4 contextual resources; tapping an expand toggle shows all 7.

**Number abbreviation rules**:
- 0–999: display as-is (`847`)
- 1,000–999,999: `1.2K` (one decimal, rounded down)
- 1,000,000+: `3.4M`

**Contextual resource display**:
- In mine: show Oxygen + Backpack fill (`3/12`)
- In dome: show Minerals (most recently collected) + Oxygen reserve
- Expand button: `⋯` icon, tap to slide open all 7 resource slots with animation
- Collapse after 5 seconds of no further taps (auto-hide)

### Where
- **Modify**: `src/ui/components/HUD.svelte` — implement abbreviation, contextual slots, expand interaction
- **Modify**: `src/ui/components/ResourceBar.svelte` (if separate) — or inline into HUD

### How

**Step 1** — Create a `formatResource(n: number): string` utility:
```typescript
export function formatResource(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
```

**Step 2** — In `HUD.svelte`, use a Svelte derived store or reactive `$derived` to compute the 3–4 contextual resources based on the current scene (mine vs dome). Render only those by default.

**Step 3** — Add `let expanded = $state(false)` and an expand button. On click: `expanded = true`, set a `clearTimeout`-managed auto-collapse timer for 5000ms. Use `transition:slide` for the expanded slot panel.

**Step 4** — Test at 390px viewport width: ensure no overflow, no truncation of icon labels, tap targets ≥ 44px height for all slots.

### Acceptance Criteria
- Numbers ≥ 1,000 display abbreviated (e.g., `1.2K`, `3.4M`)
- Default HUD shows 3–4 resources with no overflow at 390px viewport
- Expand button reveals all 7 resources with slide animation
- Auto-collapse after 5 seconds
- All tap targets ≥ 44px height
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-29-resource-bar.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })   // iPhone 15 viewport
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-29-hud-collapsed.png' })
  // Tap the expand button
  await page.click('[aria-label="Expand resources"]').catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/ss-7-29-hud-expanded.png' })
  await browser.close()
  console.log('Resource bar screenshots at 390px: /tmp/ss-7-29-hud-*.png')
})()
```

**Verification**: Collapsed screenshot shows 3–4 resources with no overflow. Expanded screenshot shows all 7. Numbers use abbreviation format.

---

## Sub-Phase 7.30: Fog Visibility + Biome Glow (DD-V2-270, DD-V2-271)

### What
Increase the brightness of Ring-1 (immediately adjacent revealed tiles) fog from the current value to 25–30%, and add an accessibility "fog contrast" slider. Additionally, implement biome-specific radial glow that bleeds from special block types (lava, crystal) into the adjacent unexplored fog zone — providing both visual richness and a gameplay hint about what lies ahead.

**Fog brightness changes**:
- Ring-1 (adjacent revealed): increase from current to 25–30% brightness (was likely ~10–15%)
- Ring-2 (scanner-only): retain at 0% brightness (fully dark)
- Accessibility slider: "Fog Contrast" with range 15–45% for Ring-1 brightness (default 25%)

**Biome glow system** (DD-V2-271):
- Block types that emit glow: Lava (orange, #FF6600, radius 2 tiles), Crystal (blue, #44AAFF, radius 3 tiles), Essence (purple, #9944CC, radius 2 tiles)
- Glow is drawn into the fog overlay layer, not as a tint on the block sprite
- Radial falloff: linear from `glowAlpha` at block edge to 0 at `radius` tiles
- Fog overlay stays neutral dark; glow is additive (`blendMode: 'add'`)
- This means lava glows orange through fog without tinting the revealed tiles around it

### Where
- **Modify**: `src/game/systems/FogSystem.ts` — increase Ring-1 brightness, add contrast slider parameter
- **Create**: `src/game/systems/BiomeGlowSystem.ts` — radial glow into fog overlay
- **Modify**: `src/ui/Settings.svelte` — add "Fog Contrast" slider
- **Modify**: `src/services/settingsService.ts` — persist `fogContrast: number` (0.15–0.45)

### How

**Step 1** — In `FogSystem.ts`, find the Ring-1 alpha/brightness value. Change it to read from `settingsService.fogContrast` (default 0.25). Re-render the fog overlay whenever the setting changes.

**Step 2** — Create `BiomeGlowSystem.ts`. In `update(grid, fogLayer)`: iterate all revealed border cells adjacent to unexplored fog. For each that is a glow-emitting type (Lava, Crystal, Essence): draw a radial gradient circle onto the fog overlay Graphics object at that cell's position, using `additive` blend mode and the appropriate glow color and radius.

**Step 3** — The fog overlay is a `Phaser.GameObjects.Graphics` drawn at depth just above the tile layer. The glow must be drawn BEFORE the fog dark overlay — or the fog overlay must have a hole/mask at glow positions. Recommended: draw glow on a separate Graphics layer with `blendMode: Phaser.BlendModes.ADD`, above the dark fog but below fully-revealed tiles.

**Step 4** — In `Settings.svelte`: add a slider `min=15 max=45 step=5` labeled "Fog Contrast". Bind to `settingsService.fogContrast * 100`. On change, call `settingsService.setFogContrast(value / 100)`.

### Acceptance Criteria
- Ring-1 fog clearly shows 25–30% of underlying tile (visible but still mysterious)
- Fog contrast slider changes Ring-1 brightness in real time
- Lava tiles glow orange through adjacent fog zone without tinting revealed tiles
- Crystal tiles glow blue through fog (radius 3 tiles)
- No glow visible on non-glow block types
- OLED screen test: glow must not wash out to white — cap additive alpha at 0.5
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-30-fog-glow.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-30-fog-default.png' })
  // Navigate to settings and increase fog contrast
  // (set via DevPanel: fogContrast = 0.45)
  await page.screenshot({ path: '/tmp/ss-7-30-fog-high-contrast.png' })
  await browser.close()
  console.log('Fog contrast screenshots: /tmp/ss-7-30-fog-*.png')
})()
```

**Verification**: Default screenshot shows ring-1 fog at 25% brightness (tile outlines faintly visible). High-contrast screenshot shows 45% (tiles more visible). Lava/crystal glow visible bleeding into fog zone.

---

## Sub-Phase 7.31: 1x CSS Resolution for Pixel Art (DD-V2-276)

### What
Ensure the Phaser canvas renders at 1× CSS pixels regardless of the device's hardware pixel ratio. High-DPI devices (2x, 3x DPR) should display the canvas at CSS pixel size with `image-rendering: pixelated` for clean upscaling, rather than rendering at native resolution (which triples GPU work on a 3× display with zero visual benefit for pixel art).

**Why this matters**: On a device with 3× DPR, rendering at native resolution means a 400×600 CSS pixel canvas becomes 1200×1800 physical pixels — 9× the GPU fill rate. For pixel art, this produces zero visual improvement because the art is already quantized to integer pixels. Rendering at 1× and upscaling with `pixelated` (nearest-neighbor) is visually identical and 9× cheaper.

**What to change**:
1. In `src/main.ts` (or Phaser config): set `resolution: 1` explicitly — do NOT use `window.devicePixelRatio`
2. In the CSS that targets the Phaser canvas: add `image-rendering: pixelated; image-rendering: crisp-edges;`
3. Ensure Phaser's `autoRound: true` is set to prevent sub-pixel sprite positioning

### Where
- **Modify**: `src/main.ts` or Phaser game config — set `resolution: 1`
- **Modify**: `src/app.css` or equivalent — add `canvas { image-rendering: pixelated; image-rendering: crisp-edges; }`
- **Verify**: `src/game/config.ts` (if it exists) — confirm `autoRound: true`

### How

**Step 1** — In the Phaser game config, change or add:
```typescript
const config: Phaser.Types.Core.GameConfig = {
  // ...
  resolution: 1,          // Never scale to device pixel ratio
  autoRound: true,        // Prevent sub-pixel sprite positions
  // ...
}
```

**Step 2** — In global CSS:
```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;  /* Firefox fallback */
}
```

**Step 3** — Test on a high-DPI device or by using Chrome DevTools with 2× device emulation. Confirm the canvas looks identical at 1× and 2× rendering, and that performance (FPS) improves on lower-end hardware.

**Step 4** — Document the decision: add a comment in `src/game/config.ts` explaining why `resolution: 1` is intentional.

### Acceptance Criteria
- `resolution: 1` set in Phaser config — no `devicePixelRatio` usage
- Canvas CSS includes `image-rendering: pixelated`
- Pixel art sprites render with crisp nearest-neighbor scaling on high-DPI devices
- No blurry sub-pixel sprite edges
- `npm run typecheck` passes; `npm run build` produces clean bundle

### Playwright Test
```js
// Save as /tmp/test-7-31-pixel-resolution.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-7-31-2x-dpr.png' })
  // Verify canvas style via JS evaluation
  const imageRendering = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    return canvas ? window.getComputedStyle(canvas).imageRendering : 'not found'
  })
  console.log('Canvas image-rendering:', imageRendering)
  await browser.close()
  console.log('Resolution screenshot: /tmp/ss-7-31-2x-dpr.png')
})()
```

**Verification**: `image-rendering: pixelated` confirmed via JS eval. Screenshot at 2× DPR shows crisp pixel art with no blurring. Console confirms `resolution: 1` in effect.

---

## Sub-Phase 7.32: Hybrid Font System (DD-V2-268)

### What
Establish a consistent two-font system across the entire game. Pixel fonts handle all short UI labels where the retro aesthetic enhances the experience. System sans-serif handles all text longer than one line, quiz content, and facts — where readability and accessibility are critical.

**Font assignment rules**:

| Context | Font Type | Reasoning |
|---|---|---|
| HUD labels (O₂, tiles, depth) | Pixel font | Short, visually integrated |
| Biome card name | Pixel font | Large display text, aesthetic |
| GAIA name label | Pixel font | Character identity |
| Buttons (all) | Pixel font | UI consistency |
| Canvas text (item names, popups) | Pixel font | In-world integration |
| Quiz question text | System sans-serif 18px | Readability, longer text |
| Quiz answer options | System sans-serif 16px | Readability |
| Fact cards (explanation, mnemonic) | System sans-serif 16px | Reading comprehension |
| Settings text, labels | System sans-serif 16px | Accessibility |
| GAIA dialogue body | System sans-serif 15px | Multiple sentences |
| Tooltip body text | System sans-serif 14px | Dense information |

**Rule**: Never use a pixel font for body text that exceeds 1 line. Pixel fonts at small sizes fail WCAG 1.4.3 contrast requirements when anti-aliased.

### Where
- **Modify**: `src/app.css` — define `--font-pixel` and `--font-body` CSS variables
- **Modify**: All relevant Svelte components — apply the correct font variable per context
- **Modify**: `src/game/scenes/MineScene.ts` — ensure in-canvas text uses pixel font for labels

### How

**Step 1** — In `src/app.css`:
```css
:root {
  --font-pixel: 'Press Start 2P', 'Courier New', monospace;
  --font-body:  system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
}

/* Pixel font for all buttons by default */
button {
  font-family: var(--font-pixel);
  font-size: 10px;
  line-height: 1.4;
}

/* Body text in overlays */
.overlay-body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
}
```

**Step 2** — Load 'Press Start 2P' from Google Fonts or a self-hosted WOFF2 file in `src/assets/fonts/`. Self-hosting is preferred for offline/Capacitor support.

**Step 3** — Audit each Svelte component and apply `font-family: var(--font-pixel)` or `var(--font-body)` as appropriate per the table above. Remove any hardcoded `font-family` strings.

**Step 4** — In `MineScene.ts`, for Phaser Text objects: use the pixel font for in-canvas labels. Verify font key matches the loaded font name exactly.

**Step 5** — Font audit: take Playwright screenshots of quiz overlay, HUD, settings, and biome card. Confirm each uses the correct font type.

### Acceptance Criteria
- HUD labels, biome card, buttons use pixel font consistently
- Quiz question and answer text, fact cards, settings use system sans-serif at ≥ 16px
- No pixel font used for text longer than one line
- Font is self-hosted (WOFF2 in `src/assets/fonts/`) — no Google Fonts CDN dependency at runtime
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-7-32-fonts.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-7-32-fonts-lobby.png' })
  // Open settings for body font test
  await page.click('[aria-label="Settings"]').catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-7-32-fonts-settings.png' })
  // Enter mine, trigger quiz for quiz font test
  await browser.close()
  console.log('Font system screenshots: /tmp/ss-7-32-fonts-*.png')
})()
```

**Verification**: Lobby/HUD uses pixel font for labels and buttons. Settings uses system sans-serif for body text. Fonts are visually distinct and correctly assigned.

---

## Notes for Sub-Agent Workers

When a sub-agent implements any task in this phase:

1. **Never modify `src/game/systems/MiningSystem.ts`** — the hit/destroy logic is correct and must not be changed.

2. **Always use `this.textures.exists(key)` before calling `this.getPooledSprite(key, ...)`** — new sprite keys may not be loaded yet during development. Graceful fallback prevents crashes.

3. **The movement-based time model is non-negotiable** (DD-V2-051) — no animation or effect should use `setInterval`, `setTimeout`, or real-time seconds for gameplay-affecting logic. Visual-only tweens (Phaser `this.tweens.add()`) are acceptable for cosmetic animations.

4. **All new TypeScript files must export functions/classes with JSDoc comments** on every public member.

5. **Sprite keys must match exactly** between `BootScene.preload()` load calls and usage in `MineScene`. The `getSpriteUrls()` manifest derives keys from filenames — `block_lava_01.png` → key `'block_lava_01'`.

6. **After every change to `MineScene.ts`, run `npm run typecheck`** before proceeding. This file has the most type-sensitive code in the project.

7. **The `getPooledSprite()` method uses an index-based pool** — sprites are hidden/shown each frame, not created/destroyed. Do NOT call `sprite.destroy()` on pooled sprites. The pool grows automatically but is never shrunk mid-run.
