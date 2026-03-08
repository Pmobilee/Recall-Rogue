# Phase 1.1: Visual Polish

**Status**: ✅ Completed
**Depends on**: Phase 0 (complete)
**Estimated effort**: 1-2 weeks

## Overview
Make the mining experience feel satisfying with visual feedback, animations, and color coding.

Implemented in code: `src/game/scenes/MineScene.ts` and `src/ui/components/BackpackOverlay.svelte`.

---

## Task 1.1.1: Mining Crack Overlay for Multi-Hit Blocks
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`
**Method**: `drawTiles()`

Currently, cracked blocks show an X-shaped crack (lines 196-201). Replace with progressive crack stages:

### Steps:
1. Read `src/game/scenes/MineScene.ts`, find the crack drawing section in `drawTiles()` (around line 196)
2. Replace the simple X-crack with a 3-stage system based on `(1 - cell.hardness / cell.maxHardness)`:
   - Stage 1 (0-33% damaged): Single diagonal crack line, alpha 0.3
   - Stage 2 (34-66% damaged): Two crossing cracks, alpha 0.5
   - Stage 3 (67-99% damaged): Web of cracks (3-4 lines), alpha 0.7, slightly red tint
3. Use `this.tileGraphics.lineStyle()` with increasing thickness per stage
4. Run `npm run typecheck` and `npm run build`

---

## Task 1.1.2: Block Destruction Particles
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`
**New method**: `spawnBreakParticles(x, y, blockType)`

When a block is destroyed, spawn colored particles that fly outward.

### Steps:
1. Read `src/game/scenes/MineScene.ts`
2. Add a new `Phaser.GameObjects.Particles.ParticleEmitter` in `create()`:
   ```ts
   // Add after graphics setup
   this.breakEmitter = this.add.particles(0, 0, undefined, {
     speed: { min: 30, max: 80 },
     angle: { min: 0, max: 360 },
     scale: { start: 0.8, end: 0 },
     lifespan: 400,
     quantity: 6,
     emitting: false,
   })
   ```
3. Add a `private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter` field
4. Create method `spawnBreakParticles(px: number, py: number, blockType: BlockType)`:
   - Set emitter tint based on BLOCK_COLORS[blockType]
   - Set emitter position to pixel center of the block
   - Call `this.breakEmitter.explode(6)`
5. Call `spawnBreakParticles` in `handlePointerDown` when `mineResult.destroyed` is true
6. Run `npm run typecheck` and `npm run build`

**Note**: Phaser 3.90 particle API may differ from older versions. Check Phaser docs if needed. The key class is `Phaser.GameObjects.Particles.ParticleEmitter`. If the parameterless texture constructor doesn't work, create a 4x4 white rectangle texture in `create()`:
```ts
const particleGraphics = this.make.graphics({ x: 0, y: 0 })
particleGraphics.fillStyle(0xffffff)
particleGraphics.fillRect(0, 0, 4, 4)
particleGraphics.generateTexture('particle', 4, 4)
particleGraphics.destroy()
```

---

## Task 1.1.3: Artifact Rarity Colors in Backpack
**Status**: ✅ Completed
**File**: `src/ui/components/BackpackOverlay.svelte`

Currently backpack slots show basic text. Add rarity-based border colors.

### Steps:
1. Read `src/ui/components/BackpackOverlay.svelte`
2. Add a rarity-to-color mapping:
   ```ts
   const RARITY_COLORS: Record<string, string> = {
     common: '#9e9e9e',
     uncommon: '#4ecca3',
     rare: '#5dade2',
     epic: '#a855f7',
     legendary: '#ffd369',
     mythic: '#ff6b9d',
   }
   ```
3. For each slot that has `type === 'artifact'`, apply a border color based on `slot.artifactRarity`
4. Add a CSS class per rarity (`.rarity-common`, `.rarity-rare`, etc.) with `border-color` and a subtle `box-shadow` glow
5. Run `npm run typecheck` and `npm run build`

---

## Task 1.1.4: Block Type Visual Distinction
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`
**Method**: `drawTiles()`

Currently blocks are flat colored rectangles. Add visual patterns per block type.

### Steps:
1. Read `src/game/scenes/MineScene.ts`, find `drawTiles()` 
2. After drawing the base color rect, add patterns:
   - **Dirt**: 3-4 small dots (tiny fillRect 2x2) in slightly darker color, random positions seeded by x,y
   - **SoftRock**: Horizontal line across middle, lighter shade
   - **Stone**: Small diagonal hatching (2 thin lines)
   - **HardRock**: Dense cross-hatching pattern
   - **MineralNode**: Pulsing glow effect (use `Math.sin(this.time.now * 0.003)` for alpha oscillation)
   - **ArtifactNode**: Shimmer effect (rotating highlight position)
   - **OxygenCache**: Bubble pattern (3-4 small circles)
   - **QuizGate**: Question mark shape drawn with lines
   - **Unbreakable**: Dense diagonal lines (prison bars look)
3. Keep patterns simple — just a few extra graphics calls per block
4. Use a seeded pseudo-random for dot/line positions so they don't change every frame (use `(x * 31 + y * 17) % N` for deterministic placement)
5. Run `npm run typecheck` and `npm run build`

---

## Task 1.1.5: Improved Player Visual
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`
**Method**: `drawPlayer()`

Currently the player is a simple green rectangle. Make it look like a miner.

### Steps:
1. Read `src/game/scenes/MineScene.ts`, find `drawPlayer()`
2. Replace the simple green rect with a miner shape:
   - Body: filled rect (center 60% of tile)
   - Head: smaller rect on top (helmet shape)
   - Helmet light: small yellow/white dot on helmet
   - Pickaxe: angled line from side
3. Keep it all using `this.playerGraphics` (Graphics object) — no sprites needed yet
4. Use colors: body = `0x00ff88`, helmet = `0x228B22`, light = `0xffff00`
5. Run `npm run typecheck` and `npm run build`

---

## Task 1.1.6: Smooth Camera Lerp
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`
**Method**: `updateCameraTarget()`

Currently camera snaps instantly. Add smooth lerping.

### Steps:
1. Read `src/game/scenes/MineScene.ts`, find `updateCameraTarget()`
2. Replace instant scroll with lerp:
   ```ts
   private updateCameraTarget(): void {
     const targetX = this.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
     const targetY = this.player.gridY * TILE_SIZE + TILE_SIZE * 0.5
     
     this.cameraTarget.setPosition(targetX, targetY)
     
     const cam = this.cameras.main
     const desiredX = targetX - cam.width / 2
     const desiredY = targetY - cam.height / 2
     const lerp = 0.15
     cam.scrollX += (desiredX - cam.scrollX) * lerp
     cam.scrollY += (desiredY - cam.scrollY) * lerp
   }
   ```
3. Run `npm run typecheck` and `npm run build`

---

## Task 1.1.7: Mining Flash Feedback
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`

When a block is hit (but not destroyed), briefly flash it white.

### Steps:
1. Add a `private flashTiles: Map<string, number>` field (maps "x,y" to flash start time)
2. When `mineResult.success && !mineResult.destroyed`, add the tile to flashTiles: `this.flashTiles.set(`${finalX},${finalY}`, this.time.now)`
3. In `drawTiles()`, after drawing a revealed block, check if it's in flashTiles:
   - If `this.time.now - flashStart < 150`, draw a white overlay with decreasing alpha
   - If expired, delete from flashTiles
4. Run `npm run typecheck` and `npm run build`

---

## Verification
After all tasks complete:
1. `npm run typecheck` — 0 errors
2. `npm run build` — success
3. Visual test: start a dive, mine blocks, verify:
   - Cracks appear on multi-hit blocks
   - Particles fly on block destruction
   - Backpack shows rarity colors
   - Blocks have visual patterns
   - Player looks like a miner
   - Camera moves smoothly
   - Flash feedback on mining hits
