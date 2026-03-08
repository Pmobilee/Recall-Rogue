# Phase 49: Advanced Mine Generation

## Overview

### Goal

Elevate the procedural mine generator from its current rectangular-bounding-box feature placement system to a full composable architecture: shaped micro-structures with template logic, true biome blending across multi-biome layers, natural structural formations (stalactites, rivers, crystal clusters), a probability-weighted anomaly injection system, strict seed determinism with replay verification, a thumbnail preview system for the dive-selection screen, and dynamic difficulty integration so generation parameters adapt to the player's measured skill level.

### Dependencies

- **Phase 8 (complete)**: Tick system, 20-layer grid sizes (20×20 to 40×40), active hazards, O2 depth decay.
- **Phase 9 (complete)**: 25 biomes defined with `structuralFeatures`, `biomeStructures.ts` with all `StructuralFeatureId` entries and configs, `palette.ts` (`BiomePalette`), `flagTransitionZones` stub in `MineGenerator.ts`.
- **Phase 7 (complete)**: Autotile bitmask system (`AutotileSystem.ts`, `tileVariant` on `MineCell`).
- **Phase 12 (complete)**: `EngagementData` / `ArchetypeData` on `PlayerSave` — used by 49.7 dynamic difficulty.
- **Phase 28 (recommended before this)**: Performance profiling — the heavier generation passes in 49.1-49.3 should be benchmarked against the 16ms budget during generation.

### Estimated Complexity

High. Seven sub-phases touching the generator, two new data files, two new UI components, and the save-state for seed history.

### Design Decision References

- **DD-V2-235**: Transition zone flagging — cells within 2-3 tiles of a biome boundary get `isTransitionZone = true` on the `MineCell`. Already has a no-op stub.
- **DD-V2-236**: Micro-structures — template-based placement, non-overlapping, depth-gated, biome-aware. Currently implemented for Library Room, Crystal Cavern, Rest Alcove, Collapsed Tunnel, Ruins. Phase 49 extends with shaped (non-rectangular) caves, multi-feature veins, and larger chambers.
- **DD-V2-237**: Anomaly zones — rare special sub-regions within a layer that override local block types, hazard density, and loot tables. Not currently implemented.

### Current State of `MineGenerator.ts`

The generator already has:
- `seededRandom(seed)` — mulberry32, deterministic.
- `getBlockWeightsForLayer(layer)` — depth-based block distribution.
- `stampLandmark()` — ASCII-template stamper for landmark layers.
- `placeStructuralFeatures()` — rectangular bounding-box placement from `biomeStructures.ts` configs.
- `placeMicroStructures()` — five room types (Library Room, Crystal Cavern, Rest Alcove, Collapsed Tunnel, Ruins).
- `flagTransitionZones()` — **no-op stub**.
- `generateMine(seed, facts, layer, biome)` — main entry point.
- `selectBiome()` / `generateBiomeSequence()` — in `biomes.ts`.

Phase 49 does NOT replace any of the above; it extends them.

---

## Sub-phases

### 49.1 — Procedural Micro-Structures: Shaped Rooms and Multi-Cell Templates

**File affected**: `src/game/systems/MineGenerator.ts`

**Goal**: Replace the rectangular fill of `placeStructuralFeatures()` with shape-aware placement that uses per-feature stamp logic rather than a solid rectangle. Add three new micro-structure types callable from `placeMicroStructures()`.

#### 49.1.1 — Shape-Aware Feature Stamp Function

Replace the rectangular fill loop in `placeStructuralFeatures()` with a `stampFeature()` dispatcher that routes each `StructuralFeatureId` to its own stamp logic.

Add the following internal function immediately before `placeStructuralFeatures()`:

```typescript
/**
 * Stamps a single structural feature into the grid using shape-aware logic.
 * Each feature type has its own geometry instead of a uniform rectangle fill.
 * (DD-V2-236)
 *
 * @param grid - Mine cell grid to write into.
 * @param featureId - Which structural feature to stamp.
 * @param fx - Top-left X of the bounding box.
 * @param fy - Top-left Y of the bounding box.
 * @param fw - Width of the bounding box (from config).
 * @param fh - Height of the bounding box (from config).
 * @param fillBlock - Primary block type for this feature.
 * @param rng - Seeded RNG.
 * @param gridWidth - Full grid width (for bounds checking).
 * @param gridHeight - Full grid height (for bounds checking).
 */
function stampFeature(
  grid: MineCell[][],
  featureId: StructuralFeatureId,
  fx: number, fy: number, fw: number, fh: number,
  fillBlock: BlockType,
  rng: () => number,
  gridWidth: number,
  gridHeight: number,
): void {
  // Helper: safely write a cell only if not a protected block type.
  function writeCell(x: number, y: number, cell: MineCell): void {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return
    const existing = grid[y][x]
    if (
      existing.type === BlockType.ExitLadder ||
      existing.type === BlockType.DescentShaft ||
      existing.type === BlockType.QuizGate
    ) return
    grid[y][x] = cell
  }

  function solidCell(type: BlockType): MineCell {
    const h = getHardness(type)
    return { type, hardness: h, maxHardness: h, revealed: false }
  }

  function emptyCell(): MineCell {
    return { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
  }

  switch (featureId) {

    case 'pocket_caves': {
      // Elliptical hollow: fill interior with Empty, leave surrounding rock intact.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      const rx = fw / 2
      const ry = fh / 2
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const nx = (dx - rx + 0.5) / rx
          const ny = (dy - ry + 0.5) / ry
          if (nx * nx + ny * ny <= 1.0) {
            writeCell(cx - Math.floor(fw / 2) + dx, cy - Math.floor(fh / 2) + dy, emptyCell())
          }
        }
      }
      break
    }

    case 'crystal_veins':
    case 'living_veins':
    case 'copper_traces': {
      // Diagonal vein: draw a 1-2 wide diagonal stripe of fillBlock through the bounding box.
      const veins = 1 + Math.floor(rng() * 2)  // 1 or 2 veins per feature
      for (let v = 0; v < veins; v++) {
        const startX = fx + Math.floor(rng() * fw)
        let curX = startX
        for (let dy = 0; dy < fh; dy++) {
          writeCell(curX, fy + dy, solidCell(fillBlock))
          if (rng() < 0.4) curX = Math.max(fx, Math.min(fx + fw - 1, curX + (rng() < 0.5 ? 1 : -1)))
        }
      }
      break
    }

    case 'root_corridors': {
      // Winding horizontal corridor: 1 cell tall, width = fw, meanders ±1 in Y.
      let curY = fy + Math.floor(fh / 2)
      for (let dx = 0; dx < fw; dx++) {
        writeCell(fx + dx, curY, emptyCell())
        // Occasional vertical branch
        if (rng() < 0.2) {
          const branch = rng() < 0.5 ? -1 : 1
          writeCell(fx + dx, curY + branch, emptyCell())
        }
        if (rng() < 0.3) curY = Math.max(fy, Math.min(fy + fh - 1, curY + (rng() < 0.5 ? 1 : -1)))
      }
      break
    }

    case 'lava_streams':
    case 'magma_rivers': {
      // Vertical stream with slight horizontal drift, 1-2 wide.
      let curX = fx + Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        writeCell(curX, fy + dy, solidCell(fillBlock))
        if (fw > 1) writeCell(curX + 1, fy + dy, solidCell(fillBlock))
        if (rng() < 0.25) curX = Math.max(fx, Math.min(fx + fw - 1, curX + (rng() < 0.5 ? 1 : -1)))
      }
      break
    }

    case 'ice_columns':
    case 'obsidian_spires':
    case 'void_columns':
    case 'temporal_fractures': {
      // Tapered vertical column: wide at base, narrows toward top.
      const midX = fx + Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        const taper = Math.floor((dy / fh) * (fw / 2))
        const left = midX - (fw / 2 - taper)
        const right = midX + (fw / 2 - taper)
        for (let x = Math.ceil(left); x <= Math.floor(right); x++) {
          writeCell(x, fy + dy, solidCell(fillBlock))
        }
      }
      break
    }

    case 'mushroom_clusters': {
      // 2-3 mushroom silhouettes: thin stem (SoftRock) topped by 3-wide cap (fillBlock).
      const count = 2 + Math.floor(rng() * 2)
      for (let m = 0; m < count; m++) {
        const stemX = fx + 1 + Math.floor(rng() * Math.max(1, fw - 2))
        const stemTopY = fy + 1
        const stemH = 2 + Math.floor(rng() * 2)
        // Cap
        for (let cx = stemX - 1; cx <= stemX + 1; cx++) {
          writeCell(cx, stemTopY, solidCell(fillBlock))
        }
        // Stem
        for (let dy = 1; dy <= stemH; dy++) {
          writeCell(stemX, stemTopY + dy, solidCell(BlockType.SoftRock))
        }
      }
      break
    }

    case 'fossil_beds': {
      // Horizontal band of FossilNodes mixed with SoftRock, 2 rows tall.
      for (let dy = 0; dy < Math.min(fh, 2); dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const isFossil = rng() < 0.35
          writeCell(fx + dx, fy + dy, solidCell(isFossil ? BlockType.FossilNode : fillBlock))
        }
      }
      break
    }

    case 'sand_pockets': {
      // Diamond-shaped pocket of Dirt (sand proxy) with empty centre.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      const r = Math.floor(Math.min(fw, fh) / 2)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r) {
            const isEmpty = Math.abs(dx) + Math.abs(dy) < r - 1
            writeCell(cx + dx, cy + dy, isEmpty ? emptyCell() : solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'amber_inclusions': {
      // Small cluster of ArtifactNodes surrounded by HardRock.
      const cx = fx + Math.floor(fw / 2)
      const cy = fy + Math.floor(fh / 2)
      writeCell(cx, cy, solidCell(fillBlock))  // fillBlock = ArtifactNode
      // Surround with HardRock
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          writeCell(cx + dx, cy + dy, solidCell(BlockType.HardRock))
        }
      }
      break
    }

    case 'ruin_walls': {
      // Partial rectangular ruin: 3 sides present (top, left, right), bottom open.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const isTop = dy === 0
          const isLeft = dx === 0
          const isRight = dx === fw - 1
          if ((isTop || isLeft || isRight) && rng() > 0.3) {
            writeCell(fx + dx, fy + dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    case 'plasma_nodes':
    case 'glitch_tiles': {
      // Scattered cluster: random fill within bounding box at ~50% density.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          if (rng() < 0.5) writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
      break
    }

    case 'floating_islands': {
      // Solid rectangular platform with 2 empty cells below (gap) — gravity-defying feel.
      const islandH = Math.max(1, Math.floor(fh / 2))
      for (let dy = 0; dy < islandH; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
      // Clear below the island
      for (let dy = islandH; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, emptyCell())
        }
      }
      break
    }

    case 'mirror_symmetry': {
      // Left half filled, right half is a mirror. Creates an echo-chamber visual motif.
      const halfW = Math.floor(fw / 2)
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < halfW; dx++) {
          if (rng() < 0.5) {
            writeCell(fx + dx, fy + dy, solidCell(fillBlock))
            writeCell(fx + fw - 1 - dx, fy + dy, solidCell(fillBlock))
          }
        }
      }
      break
    }

    default: {
      // Fallback: original rectangle fill.
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          writeCell(fx + dx, fy + dy, solidCell(fillBlock))
        }
      }
    }
  }
}
```

Then update `placeStructuralFeatures()` to call `stampFeature()` instead of the direct cell-write loop. Replace the inner fill block section:

```typescript
// OLD (remove this):
for (let dy = 0; dy < fh; dy++) {
  for (let dx = 0; dx < fw; dx++) {
    // ... cell.type = config.fillBlock ...
  }
}

// NEW (replace with):
stampFeature(grid, featureId, fx, fy, fw, fh, config.fillBlock, rng, width, height)
```

#### 49.1.2 — Three New Micro-Structure Room Types

Add three new stamp functions inside `placeMicroStructures()`, following the existing five, with placement logic called from the main placement loop.

**Underground River Room** (10×4):

```typescript
/**
 * Stamps an Underground River channel at (roomX, roomY).
 *
 * Layout (10 wide × 4 tall):
 *   UUUUUUUUUU   U = Unbreakable ceiling
 *   .LLLLLLLL.   L = LavaBlock river (lava proxy for molten underground river)
 *   SSSSSSSSSS   S = Stone riverbed
 *   UUUUUUUUUU   U = Unbreakable floor
 *
 * Entrance: 2-wide gap on the left wall (dx=0, dy=1 and dy=2 replaced with Empty).
 * Exit: 2-wide gap on the right wall (dx=9, dy=1 and dy=2 replaced with Empty).
 * Only placed at layer depth >= RIVER_MIN_DEPTH_RATIO (0.3) of grid height.
 */
function stampUndergroundRiver(roomX: number, roomY: number): void {
  const W = 10
  const H = 4
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const gx = roomX + dx
      const gy = roomY + dy
      const isEntrance = dx === 0 && (dy === 1 || dy === 2)
      const isExit = dx === W - 1 && (dy === 1 || dy === 2)
      let cell: MineCell
      if (isEntrance || isExit) {
        cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
      } else if (dy === 0 || dy === H - 1) {
        cell = { type: BlockType.Unbreakable, hardness: 999, maxHardness: 999, revealed: false }
      } else if (dy === 1) {
        cell = { type: BlockType.LavaBlock, hardness: 0, maxHardness: 0, revealed: false }
      } else {
        const h = BALANCE.HARDNESS_STONE
        cell = { type: BlockType.Stone, hardness: h, maxHardness: h, revealed: false }
      }
      grid[gy][gx] = cell
    }
  }
}
```

**Stalactite Gallery** (8×7):

```typescript
/**
 * Stamps a Stalactite Gallery at (roomX, roomY).
 *
 * Layout (8 wide × 7 tall):
 *   UUUUUUUU   ceiling (Unbreakable)
 *   UH.H.H.U   H = HardRock stalactite tip, . = open air
 *   U.HHH..U
 *   U......U   open interior
 *   U.M..M.U   M = MineralNode rewards on floor
 *   U......U
 *   UUQQUUUU   Q = QuizGate entrance pair (bottom-centre)
 *
 * Stalactite pattern is generated probabilistically per column for natural variation.
 */
function stampStalactiteGallery(roomX: number, roomY: number, factId: string | undefined): void {
  const W = 8
  const H = 7
  const stalactiteColumns = new Set<number>()
  // Randomly pick 3-4 columns for stalactites (avoid col 0 and W-1 wall cols)
  for (let col = 1; col < W - 1; col++) {
    if (rng() < 0.5) stalactiteColumns.add(col)
  }
  const mineralCols = new Set([2, 5])  // fixed mineral positions on floor

  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const gx = roomX + dx
      const gy = roomY + dy
      const isWall = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
      const isQuizGate = dy === H - 1 && (dx === 3 || dx === 4)
      const isStalactite = !isWall && dy <= 2 && stalactiteColumns.has(dx) && dy >= 1
      const isMineral = dy === H - 2 && mineralCols.has(dx)

      let cell: MineCell
      if (isQuizGate) {
        const hardness = BALANCE.HARDNESS_QUIZ_GATE
        cell = { type: BlockType.QuizGate, hardness, maxHardness: hardness, revealed: false, content: { factId } }
      } else if (isWall) {
        cell = { type: BlockType.Unbreakable, hardness: 999, maxHardness: 999, revealed: false }
      } else if (isStalactite) {
        const h = BALANCE.HARDNESS_HARD_ROCK
        cell = { type: BlockType.HardRock, hardness: h, maxHardness: h, revealed: false }
      } else if (isMineral) {
        const h = BALANCE.HARDNESS_MINERAL_NODE
        const amt = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
        cell = { type: BlockType.MineralNode, hardness: h, maxHardness: h, revealed: false, content: { mineralType: 'crystal', mineralAmount: amt } }
      } else {
        cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
      }
      grid[gy][gx] = cell
    }
  }
}
```

**Geode Chamber** (9×9):

```typescript
/**
 * Stamps a large Geode Chamber at (roomX, roomY).
 *
 * A circular hollow (radius 3.5) of Empty interior, surrounded by HardRock walls,
 * with 6 MineralNodes (geode tier if deep enough) embedded in the inner wall ring,
 * and a single ArtifactNode at the centre. Entrance: 2-wide gap at bottom.
 * Only placed at depth >= 0.5 of the grid height.
 */
function stampGeodeChamber(roomX: number, roomY: number, factId: string | undefined): void {
  const W = 9
  const H = 9
  const cx = roomX + 4
  const cy = roomY + 4
  const outerR = 4.2
  const innerR = 3.0
  const mineralR = 3.5

  // Pre-compute mineral positions on inner-wall ring (8-directional)
  const mineralAngles = [0, 45, 90, 135, 180, 225].map(a => a * Math.PI / 180)
  const mineralPositions = new Set(mineralAngles.map(a =>
    `${cx + Math.round(Math.cos(a) * mineralR)},${cy + Math.round(Math.sin(a) * mineralR)}`
  ))

  const depthRatio = (roomY - roomY % 1) / gridHeight  // approx depth
  type MineralTierLocal = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
  let gemTier: MineralTierLocal = 'crystal'
  if (depthRatio >= 0.8) gemTier = 'geode'
  if (depthRatio >= 0.95) gemTier = 'essence'

  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const gx = roomX + dx
      const gy = roomY + dy
      const dist = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
      const key = `${gx},${gy}`
      const isEntrance = dy === H - 1 && (dx === 3 || dx === 4 || dx === 5)
      let cell: MineCell

      if (isEntrance) {
        cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
      } else if (gx === cx && gy === cy) {
        // Central artifact
        const h = BALANCE.HARDNESS_ARTIFACT_NODE
        cell = { type: BlockType.ArtifactNode, hardness: h, maxHardness: h, revealed: false, content: { artifactRarity: 'epic', factId } }
      } else if (mineralPositions.has(key) && dist <= outerR) {
        const h = BALANCE.HARDNESS_MINERAL_NODE
        const amt = randomIntInclusive(rng, 1, 3)
        cell = { type: BlockType.MineralNode, hardness: h, maxHardness: h, revealed: false, content: { mineralType: gemTier, mineralAmount: amt } }
      } else if (dist <= innerR) {
        cell = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
      } else if (dist <= outerR) {
        const h = BALANCE.HARDNESS_HARD_ROCK
        cell = { type: BlockType.HardRock, hardness: h, maxHardness: h, revealed: false }
      } else {
        return  // outside bounding box logic — no write
      }
      if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) grid[gy][gx] = cell
    }
  }
}
```

Add placement calls in the `placeMicroStructures()` placement loop (after the five existing room type attempts):

```typescript
// Underground River — placed once per layer, only in the lower 70% of the grid
if (rng() < 0.20 && gridHeight >= 10) {
  const W = 10; const H = 4
  const rx = 2 + Math.floor(rng() * (gridWidth - W - 4))
  const ry = Math.floor(gridHeight * 0.3) + Math.floor(rng() * Math.floor(gridHeight * 0.5))
  if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
    stampUndergroundRiver(rx, ry)
    placedBoxes.push({ x: rx, y: ry, w: W, h: H })
  }
}

// Stalactite Gallery — once per layer, mid-depth
if (rng() < 0.25 && gridHeight >= 8) {
  const W = 8; const H = 7
  const rx = 2 + Math.floor(rng() * (gridWidth - W - 4))
  const ry = Math.floor(gridHeight * 0.2) + Math.floor(rng() * Math.floor(gridHeight * 0.5))
  if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
    const factId = facts[factCursor % Math.max(1, facts.length)]
    factCursor++
    stampStalactiteGallery(rx, ry, factId)
    placedBoxes.push({ x: rx, y: ry, w: W, h: H })
  }
}

// Geode Chamber — once per layer, lower half only
if (rng() < 0.15 && gridHeight >= 10) {
  const W = 9; const H = 9
  const rx = 2 + Math.floor(rng() * (gridWidth - W - 4))
  const ry = Math.floor(gridHeight * 0.5) + Math.floor(rng() * Math.floor(gridHeight * 0.4))
  if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
    const factId = facts[factCursor % Math.max(1, facts.length)]
    factCursor++
    stampGeodeChamber(rx, ry, factId)
    placedBoxes.push({ x: rx, y: ry, w: W, h: H })
  }
}
```

**Acceptance Criteria — 49.1**:
- [ ] `stampFeature()` exists before `placeStructuralFeatures()` with all 20 `StructuralFeatureId` cases handled.
- [ ] `placeStructuralFeatures()` calls `stampFeature()` instead of the direct rectangle loop.
- [ ] `placeMicroStructures()` includes placement attempts for Underground River, Stalactite Gallery, and Geode Chamber.
- [ ] `npm run typecheck` passes with no new errors.
- [ ] Generation of layer 8 with biome `crystal_geode` produces at least one non-rectangular feature (verified via unit test in 49.5).

---

### 49.2 — Biome Transition Zones

**File affected**: `src/game/systems/MineGenerator.ts`, `src/data/types.ts`

**Goal**: Implement true biome transition zones within a single layer. When a layer is assigned two adjacent biomes (primary + secondary), blend block weights and hazard densities in a gradient band, and mark boundary cells with `isTransitionZone = true`.

#### 49.2.1 — Multi-Biome Layer Support in `generateMine`

Extend `generateMine` to accept an optional `secondaryBiome` parameter and a `transitionBandWidth` (default 5 columns):

```typescript
export function generateMine(
  seed: number,
  facts: string[],
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
  secondaryBiome?: Biome,
  transitionBandWidth = 5,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome, secondaryBiome?: Biome }
```

When `secondaryBiome` is defined, the grid is split left/right at `width/2`. Columns within `transitionBandWidth/2` tiles of the split are "transition columns". The `getDepthWeights()` call for each cell receives a blended biome computed by linearly interpolating the two biomes' `blockWeights` based on distance from the split.

Add a helper:

```typescript
/**
 * Returns a blend of two biome blockWeights based on a 0.0–1.0 alpha.
 * alpha=0.0 → fully biomeA, alpha=1.0 → fully biomeB.
 */
function blendBiomeWeights(
  biomeA: Biome,
  biomeB: Biome,
  alpha: number,
): Biome['blockWeights'] {
  const a = Math.max(0, Math.min(1, alpha))
  return {
    dirt:     biomeA.blockWeights.dirt     * (1 - a) + biomeB.blockWeights.dirt     * a,
    softRock: biomeA.blockWeights.softRock * (1 - a) + biomeB.blockWeights.softRock * a,
    stone:    biomeA.blockWeights.stone    * (1 - a) + biomeB.blockWeights.stone    * a,
    hardRock: biomeA.blockWeights.hardRock * (1 - a) + biomeB.blockWeights.hardRock * a,
  }
}
```

In the cell-generation loop, compute alpha for each column:

```typescript
const splitX = Math.floor(width / 2)
const halfBand = transitionBandWidth / 2

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let effectiveBiome = biome
    if (secondaryBiome) {
      const distFromSplit = x - splitX  // negative = left, positive = right
      const alpha = Math.max(0, Math.min(1, (distFromSplit + halfBand) / transitionBandWidth))
      if (Math.abs(distFromSplit) <= halfBand) {
        // Transition zone: blend weights into a synthetic biome-like object
        const blended = blendBiomeWeights(biome, secondaryBiome, alpha)
        effectiveBiome = { ...biome, blockWeights: blended }
      } else if (distFromSplit > 0) {
        effectiveBiome = secondaryBiome
      }
    }
    const depthWeights = getDepthWeights(y, height, effectiveBiome, layerWeights)
    // ... rest of cell generation
  }
}
```

#### 49.2.2 — Activate `flagTransitionZones()`

Replace the current no-op with a real implementation:

```typescript
/**
 * Marks cells within TRANSITION_ZONE_RADIUS tiles of the vertical biome split line
 * with isTransitionZone = true. The split line is at x = width/2 when a secondary
 * biome is present. Without a secondary biome, this is still a no-op.
 * (DD-V2-235)
 */
function flagTransitionZones(
  grid: MineCell[][],
  hasDualBiome: boolean,
  transitionBandWidth: number,
): void {
  if (!hasDualBiome) return
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0
  const splitX = Math.floor(width / 2)
  const halfBand = Math.ceil(transitionBandWidth / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(x - splitX) <= halfBand) {
        grid[y][x].isTransitionZone = true
      }
    }
  }
}
```

Update the call site at the end of `generateMine`:

```typescript
flagTransitionZones(grid, !!secondaryBiome, transitionBandWidth)
```

#### 49.2.3 — Secondary Biome Selection in `GameManager.ts`

In `GameManager.ts`, when constructing each layer's biome, add a 15% chance of assigning a compatible secondary biome (same tier or adjacent tier):

```typescript
// In the layer generation loop (where pickBiome is called per layer):
const primaryBiome = pickBiome(biomeRng, layer)
let secondaryBiome: Biome | undefined = undefined
if (biomeRng() < BALANCE.DUAL_BIOME_CHANCE) {
  const candidates = ALL_BIOMES.filter(b =>
    b.id !== primaryBiome.id &&
    (b.tier === primaryBiome.tier ||
      (primaryBiome.tier === 'shallow' && b.tier === 'mid') ||
      (primaryBiome.tier === 'mid' && (b.tier === 'shallow' || b.tier === 'deep'))
    )
  )
  if (candidates.length > 0) {
    secondaryBiome = candidates[Math.floor(biomeRng() * candidates.length)]
  }
}
```

Add to `balance.ts`:

```typescript
DUAL_BIOME_CHANCE: 0.15,     // 15% of layers get a secondary biome blend (DD-V2-235)
TRANSITION_BAND_WIDTH: 5,    // Cells wide for the transition gradient band
```

**Acceptance Criteria — 49.2**:
- [ ] `generateMine` signature accepts `secondaryBiome` and `transitionBandWidth` without breaking existing callers (both optional).
- [ ] `flagTransitionZones()` sets `isTransitionZone = true` on cells within the band.
- [ ] `blendBiomeWeights()` correctly interpolates weight values (verified in unit test).
- [ ] `DUAL_BIOME_CHANCE` and `TRANSITION_BAND_WIDTH` exist in `balance.ts`.
- [ ] `npm run typecheck` passes.

---

### 49.3 — Structural Features: Stalactites, Crystal Formations, Underground Rivers

**File affected**: `src/data/biomeStructures.ts`, `src/game/systems/MineGenerator.ts`

**Goal**: Add three new `StructuralFeatureId` values (`stalactite_field`, `crystal_formation`, `hydrothermal_vent`) with full configs and biome assignments, then implement their stamp logic in `stampFeature()`.

#### 49.3.1 — New Feature IDs and Configs

In `biomeStructures.ts`, extend `StructuralFeatureId`:

```typescript
export type StructuralFeatureId =
  | /* ... existing 20 ... */
  | 'stalactite_field'
  | 'crystal_formation'
  | 'hydrothermal_vent'
```

Add configs to `STRUCTURAL_FEATURE_CONFIGS`:

```typescript
stalactite_field:    { minSize: { width: 6, height: 5 }, maxSize: { width: 10, height: 8 },  frequency: 0.18, fillBlock: BlockType.HardRock },
crystal_formation:   { minSize: { width: 3, height: 5 }, maxSize: { width: 5,  height: 9 },  frequency: 0.14, fillBlock: BlockType.MineralNode },
hydrothermal_vent:   { minSize: { width: 2, height: 4 }, maxSize: { width: 3,  height: 7 },  frequency: 0.12, fillBlock: BlockType.GasPocket },
```

Add to biome assignments in `BIOME_STRUCTURAL_FEATURES`:

```typescript
quartz_halls:         ['crystal_veins', 'ice_columns', 'stalactite_field', 'crystal_formation'],
crystal_geode:        ['crystal_veins', 'pocket_caves', 'crystal_formation'],
limestone_caves:      ['pocket_caves', 'fossil_beds', 'stalactite_field'],
sulfur_springs:       ['lava_streams', 'pocket_caves', 'hydrothermal_vent'],
primordial_mantle:    ['magma_rivers', 'lava_streams', 'obsidian_spires', 'hydrothermal_vent'],
deep_biolume:         ['living_veins', 'mushroom_clusters', 'crystal_formation'],
```

#### 49.3.2 — Stamp Logic for New Features

Add three new `case` branches to `stampFeature()`:

```typescript
case 'stalactite_field': {
  // Rows of downward-pointing stalactites from the top edge of the bounding box.
  // Each column has a probabilistic stalactite of random length (1 to fh/2).
  for (let dx = 0; dx < fw; dx++) {
    if (rng() < 0.65) {
      const len = 1 + Math.floor(rng() * Math.max(1, Math.floor(fh / 2)))
      for (let dy = 0; dy < len; dy++) {
        writeCell(fx + dx, fy + dy, solidCell(fillBlock))
      }
    }
  }
  break
}

case 'crystal_formation': {
  // Upward-growing crystal spires from the bottom edge, tapering toward the top.
  // 2-4 spires arranged with slight X-separation.
  const spireCount = 2 + Math.floor(rng() * 3)
  const step = Math.max(1, Math.floor(fw / spireCount))
  for (let s = 0; s < spireCount; s++) {
    const spireX = fx + s * step + Math.floor(rng() * Math.max(1, step - 1))
    const spireH = Math.ceil(fh * (0.4 + rng() * 0.6))
    const spireW = 1 + (rng() < 0.4 ? 1 : 0)
    for (let dy = 0; dy < spireH; dy++) {
      const taper = dy < 2 ? 0 : (dy === spireH - 1 ? 0 : 1)
      for (let sw = 0; sw < spireW - (dy > spireH / 2 ? taper : 0); sw++) {
        writeCell(spireX + sw, fy + fh - 1 - dy, solidCell(fillBlock))
      }
    }
  }
  break
}

case 'hydrothermal_vent': {
  // Vertical plume: GasPocket column rising from the bottom, flanked by LavaBlock.
  const ventX = fx + Math.floor(fw / 2)
  for (let dy = 0; dy < fh; dy++) {
    // Central gas column
    writeCell(ventX, fy + fh - 1 - dy, solidCell(BlockType.GasPocket))
    // Lava flanks on lower half only
    if (dy < Math.floor(fh / 2)) {
      writeCell(ventX - 1, fy + fh - 1 - dy, solidCell(BlockType.LavaBlock))
      if (fw >= 3) writeCell(ventX + 1, fy + fh - 1 - dy, solidCell(BlockType.LavaBlock))
    }
  }
  break
}
```

**Acceptance Criteria — 49.3**:
- [ ] `StructuralFeatureId` type includes the three new values.
- [ ] `STRUCTURAL_FEATURE_CONFIGS` has entries for all three new IDs.
- [ ] `BIOME_STRUCTURAL_FEATURES` assigns new features to appropriate biomes.
- [ ] `stampFeature()` handles all three new cases.
- [ ] No TypeScript errors.

---

### 49.4 — Anomaly Probability System

**New file**: `src/game/systems/AnomalyZoneSystem.ts`
**File affected**: `src/game/systems/MineGenerator.ts`, `src/data/balance.ts`

**Goal**: Implement DD-V2-237. After base generation, inject 0-2 "anomaly zones" into any layer. Each zone is a rectangular sub-region (8×8 to 14×14) that overrides the blocks inside it with anomaly-tier rules: higher rarity loot, unique visual block types, and optional hazard clusters. Anomaly zones have independent probability per biome tier.

#### 49.4.1 — `AnomalyZoneSystem.ts`

```typescript
/**
 * Anomaly zone injection system. (DD-V2-237)
 * Anomaly zones are rare rectangular sub-regions within any layer that override
 * block composition with anomaly-tier rules: elevated loot, exotic blocks, hazard clusters.
 *
 * @file src/game/systems/AnomalyZoneSystem.ts
 */

import { BlockType, type MineCell } from '../../data/types'
import { BALANCE } from '../../data/balance'
import { type Biome } from '../../data/biomes'
import { getHardness, pickRarity, randomIntInclusive } from './MineGenerator'

export interface AnomalyZone {
  x: number
  y: number
  width: number
  height: number
  type: AnomalyZoneType
}

export type AnomalyZoneType =
  | 'loot_cache'       // Elevated artifact and mineral density
  | 'hazard_cluster'   // Dense lava/gas pocket concentration
  | 'crystal_cluster'  // Wall-to-wall crystal formations
  | 'void_zone'        // Mostly empty with floating mineral islands
  | 'relic_sanctuary'  // RelicShrine + protected space

/**
 * Returns the per-layer anomaly injection probability based on biome tier.
 * Anomaly-tier biomes have a higher base chance.
 */
export function getAnomalyChance(biome: Biome): number {
  const base = BALANCE.ANOMALY_ZONE_BASE_CHANCE
  if (biome.isAnomaly) return Math.min(0.8, base * 3.0)
  switch (biome.tier) {
    case 'shallow':  return base * 0.5
    case 'mid':      return base
    case 'deep':     return base * 1.5
    case 'extreme':  return base * 2.0
    default:         return base
  }
}

/**
 * Selects a random anomaly zone type, weighted by biome tier.
 */
export function pickAnomalyType(biome: Biome, rng: () => number): AnomalyZoneType {
  const types: AnomalyZoneType[] = biome.isAnomaly
    ? ['loot_cache', 'void_zone', 'relic_sanctuary', 'crystal_cluster', 'hazard_cluster']
    : ['loot_cache', 'hazard_cluster', 'crystal_cluster', 'void_zone', 'relic_sanctuary']
  return types[Math.floor(rng() * types.length)]
}

/**
 * Injects up to ANOMALY_MAX_PER_LAYER anomaly zones into the mine grid.
 * Zones do not overlap each other or the spawn area.
 * Called after `placeStructuralFeatures` and before `placeHazards`.
 *
 * @param grid - Mine cell grid.
 * @param biome - Primary biome for the layer.
 * @param rng - Seeded RNG.
 * @param width - Grid width.
 * @param height - Grid height.
 * @param spawnX - Spawn column (exclusion zone centre).
 * @param spawnY - Spawn row (exclusion zone centre).
 * @param facts - Fact ID array (for anomaly artifact content).
 * @param factCursorRef - Object with mutable `cursor` field, incremented on use.
 * @returns Array of placed anomaly zone descriptors.
 */
export function injectAnomalyZones(
  grid: MineCell[][],
  biome: Biome,
  rng: () => number,
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
  facts: string[],
  factCursorRef: { cursor: number },
): AnomalyZone[] {
  const chance = getAnomalyChance(biome)
  const maxZones = BALANCE.ANOMALY_MAX_PER_LAYER
  const placed: AnomalyZone[] = []

  for (let attempt = 0; attempt < maxZones * 4; attempt++) {
    if (placed.length >= maxZones) break
    if (rng() > chance) continue

    const zoneW = 8 + Math.floor(rng() * 7)   // 8–14
    const zoneH = 8 + Math.floor(rng() * 7)   // 8–14
    const margin = 2
    if (width < zoneW + margin * 2 || height < zoneH + margin * 2) continue

    const zx = margin + Math.floor(rng() * (width - zoneW - margin * 2))
    const zy = margin + Math.floor(rng() * (height - zoneH - margin * 2))

    // Skip if overlaps spawn area
    if (Math.abs(zx + zoneW / 2 - spawnX) < zoneW / 2 + 3 &&
        Math.abs(zy + zoneH / 2 - spawnY) < zoneH / 2 + 3) continue

    // Skip if overlaps already-placed zone
    const overlaps = placed.some(p =>
      zx < p.x + p.width + 2 && zx + zoneW > p.x - 2 &&
      zy < p.y + p.height + 2 && zy + zoneH > p.y - 2
    )
    if (overlaps) continue

    const zoneType = pickAnomalyType(biome, rng)
    stampAnomalyZone(grid, zx, zy, zoneW, zoneH, zoneType, rng, width, height, facts, factCursorRef)
    placed.push({ x: zx, y: zy, width: zoneW, height: zoneH, type: zoneType })
  }

  return placed
}

/** Stamps a single anomaly zone into the grid using its type-specific logic. */
function stampAnomalyZone(
  grid: MineCell[][],
  zx: number, zy: number, zw: number, zh: number,
  type: AnomalyZoneType,
  rng: () => number,
  gridWidth: number, gridHeight: number,
  facts: string[],
  factCursorRef: { cursor: number },
): void {
  function cell(blockType: BlockType, extra?: Partial<MineCell>): MineCell {
    const h = getHardness(blockType)
    return { type: blockType, hardness: h, maxHardness: h, revealed: false, ...extra }
  }
  function write(x: number, y: number, c: MineCell): void {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return
    const existing = grid[y][x]
    if (existing.type === BlockType.ExitLadder || existing.type === BlockType.DescentShaft) return
    grid[y][x] = c
  }
  function nextFact(): string | undefined {
    if (facts.length === 0) return undefined
    const id = facts[factCursorRef.cursor % facts.length]
    factCursorRef.cursor++
    return id
  }

  switch (type) {
    case 'loot_cache': {
      // Interior: elevated artifact and mineral density (~40% nodes, rest empty)
      for (let dy = 0; dy < zh; dy++) {
        for (let dx = 0; dx < zw; dx++) {
          const roll = rng()
          if (roll < 0.15) {
            const h = BALANCE.HARDNESS_ARTIFACT_NODE
            write(zx + dx, zy + dy, { type: BlockType.ArtifactNode, hardness: h, maxHardness: h, revealed: false, content: { artifactRarity: pickRarity(rng), factId: nextFact() } })
          } else if (roll < 0.40) {
            const h = BALANCE.HARDNESS_MINERAL_NODE
            const amt = randomIntInclusive(rng, 2, 5)
            write(zx + dx, zy + dy, { type: BlockType.MineralNode, hardness: h, maxHardness: h, revealed: false, content: { mineralType: 'crystal', mineralAmount: amt } })
          } else {
            write(zx + dx, zy + dy, cell(BlockType.Empty))
          }
        }
      }
      break
    }
    case 'hazard_cluster': {
      // Interior: mix of LavaBlock and GasPocket at high density, leave thin paths
      for (let dy = 0; dy < zh; dy++) {
        for (let dx = 0; dx < zw; dx++) {
          const roll = rng()
          if (roll < 0.30) write(zx + dx, zy + dy, cell(BlockType.LavaBlock))
          else if (roll < 0.50) write(zx + dx, zy + dy, cell(BlockType.GasPocket))
          else write(zx + dx, zy + dy, cell(BlockType.Empty))
        }
      }
      break
    }
    case 'crystal_cluster': {
      // Diagonal crystal spires throughout the zone
      for (let dx = 0; dx < zw; dx += 2) {
        const spireH = 2 + Math.floor(rng() * Math.min(zh - 2, 5))
        for (let dy = zh - 1; dy >= zh - spireH; dy--) {
          write(zx + dx, zy + dy, cell(BlockType.MineralNode, { content: { mineralType: 'crystal', mineralAmount: 1 } }))
        }
      }
      break
    }
    case 'void_zone': {
      // Mostly empty with sparse mineral "islands"
      for (let dy = 0; dy < zh; dy++) {
        for (let dx = 0; dx < zw; dx++) {
          if (rng() < 0.08) {
            write(zx + dx, zy + dy, cell(BlockType.MineralNode, { content: { mineralType: 'geode', mineralAmount: 1 } }))
          } else {
            write(zx + dx, zy + dy, cell(BlockType.Empty))
          }
        }
      }
      break
    }
    case 'relic_sanctuary': {
      // Walled chamber (HardRock) with RelicShrine inside and ArtifactNode
      for (let dy = 0; dy < zh; dy++) {
        for (let dx = 0; dx < zw; dx++) {
          const isWall = dy === 0 || dy === zh - 1 || dx === 0 || dx === zw - 1
          const isShrine = dx === Math.floor(zw / 2) && dy === Math.floor(zh / 2)
          const isArtifact = dx === Math.floor(zw / 2) + 2 && dy === Math.floor(zh / 2)
          if (isShrine) {
            write(zx + dx, zy + dy, cell(BlockType.RelicShrine))
          } else if (isArtifact) {
            const h = BALANCE.HARDNESS_ARTIFACT_NODE
            write(zx + dx, zy + dy, { type: BlockType.ArtifactNode, hardness: h, maxHardness: h, revealed: false, content: { artifactRarity: 'legendary', factId: nextFact() } })
          } else if (isWall) {
            write(zx + dx, zy + dy, cell(BlockType.HardRock))
          } else {
            write(zx + dx, zy + dy, cell(BlockType.Empty))
          }
        }
      }
      break
    }
  }
}
```

Add to `balance.ts`:

```typescript
ANOMALY_ZONE_BASE_CHANCE: 0.18,  // Base probability per injection attempt per layer (DD-V2-237)
ANOMALY_MAX_PER_LAYER: 2,        // Maximum anomaly zones per layer
```

#### 49.4.2 — Integration in `MineGenerator.ts`

Import and call `injectAnomalyZones` in `generateMine()`, after `placeStructuralFeatures` and before `placeHazards`:

```typescript
import { injectAnomalyZones } from './AnomalyZoneSystem'

// In generateMine(), after placeStructuralFeatures():
const factCursorRef = { cursor: factCursor }
injectAnomalyZones(grid, biome, rng, width, height, spawnX, spawnY, facts, factCursorRef)
factCursor = factCursorRef.cursor
```

**Acceptance Criteria — 49.4**:
- [ ] `src/game/systems/AnomalyZoneSystem.ts` exists with all exports.
- [ ] `ANOMALY_ZONE_BASE_CHANCE` and `ANOMALY_MAX_PER_LAYER` in `balance.ts`.
- [ ] `injectAnomalyZones` is called in `generateMine()` with correct cursor threading.
- [ ] All five `AnomalyZoneType` cases are implemented.
- [ ] `npm run typecheck` passes.

---

### 49.5 — Seed Determinism and Replay Verification

**New file**: `src/game/systems/SeedVerifier.ts`
**File affected**: `src/game/systems/MineGenerator.ts`, `src/data/saveState.ts`

**Goal**: Guarantee that `generateMine(seed, facts, layer, biome)` with the same inputs always produces a byte-identical grid. Add a checksum function, record checksums in the dive save, and expose a verification utility.

#### 49.5.1 — Grid Checksum

```typescript
/**
 * Computes a fast integer checksum over a mine grid for determinism verification.
 * Hashes block type, hardness, and content fields of every cell.
 * Uses a djb2-style rolling hash for speed.
 *
 * @file src/game/systems/SeedVerifier.ts
 */

import type { MineCell } from '../../data/types'

/**
 * Computes a 32-bit unsigned integer checksum of a mine grid.
 * Same grid → same checksum (deterministic).
 */
export function gridChecksum(grid: MineCell[][]): number {
  let hash = 5381
  for (const row of grid) {
    for (const cell of row) {
      hash = ((hash << 5) + hash + cell.type) >>> 0
      hash = ((hash << 5) + hash + cell.hardness) >>> 0
      if (cell.content) {
        hash = ((hash << 5) + hash + (cell.content.mineralAmount ?? 0)) >>> 0
        hash = ((hash << 5) + hash + (cell.content.oxygenAmount ?? 0)) >>> 0
      }
    }
  }
  return hash >>> 0
}

/**
 * Verifies that re-generating a mine from its seed produces the same checksum
 * as was recorded during the original generation. Returns true if checksums match.
 *
 * @param seed - Original seed.
 * @param facts - Original facts array.
 * @param layer - Layer index.
 * @param biome - Biome used.
 * @param expectedChecksum - Previously recorded checksum.
 */
export function verifyMineChecksum(
  seed: number,
  facts: string[],
  layer: number,
  biome: import('../../data/biomes').Biome,
  expectedChecksum: number,
): boolean {
  const { generateMine } = require('./MineGenerator') as typeof import('./MineGenerator')
  const { grid } = generateMine(seed, facts, layer, biome)
  const actual = gridChecksum(grid)
  return actual === expectedChecksum
}
```

#### 49.5.2 — Record Checksums in Save State

In `src/data/saveState.ts`, extend `DiveSaveState`:

```typescript
/** Per-layer checksum for seed determinism verification (Phase 49.5). */
layerChecksums?: number[]
```

In `SaveManager.ts`, after generating each layer, compute and store the checksum:

```typescript
import { gridChecksum } from '../systems/SeedVerifier'

// After generateMine():
const checksum = gridChecksum(result.grid)
if (!saveState.layerChecksums) saveState.layerChecksums = []
saveState.layerChecksums[layer] = checksum
```

**Acceptance Criteria — 49.5**:
- [ ] `SeedVerifier.ts` exports `gridChecksum` and `verifyMineChecksum`.
- [ ] `DiveSaveState.layerChecksums` field exists (optional `number[]`).
- [ ] `SaveManager` stores checksums after generation.
- [ ] Calling `generateMine` twice with identical inputs produces the same checksum (verified in the Playwright script below).
- [ ] `npm run typecheck` passes.

---

### 49.6 — Mine Preview System

**New file**: `src/game/systems/MinePreview.ts`
**New Svelte component**: `src/ui/components/MinePreviewThumbnail.svelte`
**File affected**: `src/ui/components/HubView.svelte` (dive button area)

**Goal**: Generate a 80×60 pixel thumbnail of the mine layout (top-down block color map) before the dive starts, and display it on the dive selection / confirmation screen so the player can see what biome and structural complexity awaits.

#### 49.6.1 — `MinePreview.ts`

```typescript
/**
 * Mine preview thumbnail generator.
 * Renders a downsampled block-type color map of the mine grid to an offscreen canvas.
 *
 * @file src/game/systems/MinePreview.ts
 */

import { BlockType, type MineCell } from '../../data/types'
import type { Biome } from '../../data/biomes'

/** Pixel dimensions of the thumbnail canvas. */
export const PREVIEW_WIDTH = 80
export const PREVIEW_HEIGHT = 60

/** Per-block-type color map for the preview (RGB hex). */
const BLOCK_PREVIEW_COLORS: Record<number, string> = {
  [BlockType.Empty]:         '#1a1a2e',
  [BlockType.Dirt]:          '#8b5e3c',
  [BlockType.SoftRock]:      '#6d6d6d',
  [BlockType.Stone]:         '#555577',
  [BlockType.HardRock]:      '#333355',
  [BlockType.Unbreakable]:   '#111111',
  [BlockType.MineralNode]:   '#44ff88',
  [BlockType.ArtifactNode]:  '#ffaa00',
  [BlockType.OxygenCache]:   '#00ccff',
  [BlockType.UpgradeCrate]:  '#ff6600',
  [BlockType.QuizGate]:      '#ff00ff',
  [BlockType.ExitLadder]:    '#ffffff',
  [BlockType.DescentShaft]:  '#aaaaff',
  [BlockType.RelicShrine]:   '#ffdd00',
  [BlockType.LavaBlock]:     '#ff2200',
  [BlockType.GasPocket]:     '#aaff00',
  [BlockType.UnstableGround]:'#886600',
  [BlockType.FossilNode]:    '#cc9966',
  [BlockType.DataDisc]:      '#00ffff',
}

/**
 * Renders a mine grid to an offscreen HTMLCanvasElement at PREVIEW_WIDTH × PREVIEW_HEIGHT.
 * Returns the canvas (callers can call .toDataURL() or draw it elsewhere).
 *
 * @param grid - The mine grid to render.
 * @param biome - The primary biome (used for background tint).
 */
export function renderMinePreview(grid: MineCell[][], biome: Biome): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_WIDTH
  canvas.height = PREVIEW_HEIGHT
  const ctx = canvas.getContext('2d')!

  // Fill background with biome ambient color
  ctx.fillStyle = '#' + biome.ambientColor.toString(16).padStart(6, '0')
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

  if (grid.length === 0) return canvas

  const gridH = grid.length
  const gridW = grid[0].length
  const cellW = PREVIEW_WIDTH / gridW
  const cellH = PREVIEW_HEIGHT / gridH

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cell = grid[y][x]
      const color = BLOCK_PREVIEW_COLORS[cell.type] ?? '#444444'
      ctx.fillStyle = color
      ctx.fillRect(
        Math.round(x * cellW),
        Math.round(y * cellH),
        Math.max(1, Math.round(cellW)),
        Math.max(1, Math.round(cellH)),
      )
    }
  }

  return canvas
}

/**
 * Returns a data URL string (PNG) of the mine preview for embedding in an <img> element.
 */
export function minePreviewDataUrl(grid: MineCell[][], biome: Biome): string {
  return renderMinePreview(grid, biome).toDataURL('image/png')
}
```

#### 49.6.2 — `MinePreviewThumbnail.svelte`

```svelte
<!--
  MinePreviewThumbnail.svelte
  Displays a pre-generated mine preview thumbnail on the dive confirmation screen.
  Props:
    - dataUrl: string — result of minePreviewDataUrl()
    - biomeLabel: string — display name of the biome
    - layer: number — 1-based layer number
-->
<script lang="ts">
  export let dataUrl: string = ''
  export let biomeLabel: string = 'Unknown Biome'
  export let layer: number = 1
</script>

<div class="mine-preview">
  {#if dataUrl}
    <img
      src={dataUrl}
      alt="Mine preview layer {layer}"
      class="preview-img"
      style="image-rendering: pixelated;"
    />
  {:else}
    <div class="preview-placeholder">Generating…</div>
  {/if}
  <div class="preview-label">
    <span class="layer-badge">L{layer}</span>
    <span class="biome-name">{biomeLabel}</span>
  </div>
</div>

<style>
  .mine-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .preview-img {
    width: 160px;
    height: 120px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
  }
  .preview-placeholder {
    width: 160px;
    height: 120px;
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 12px;
  }
  .preview-label {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;
  }
  .layer-badge {
    background: rgba(255,255,255,0.15);
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: bold;
  }
  .biome-name {
    color: #aaa;
  }
</style>
```

#### 49.6.3 — Integration in `HubView.svelte`

In `HubView.svelte`, in the dive preparation section, generate a preview for layer 1 of the upcoming dive and display `MinePreviewThumbnail`. The preview is generated lazily when the dive panel opens:

```svelte
<script lang="ts">
  // ... existing imports ...
  import MinePreviewThumbnail from './MinePreviewThumbnail.svelte'
  import { minePreviewDataUrl } from '../../game/systems/MinePreview'
  import { generateMine, seededRandom } from '../../game/systems/MineGenerator'
  import { DEFAULT_BIOME, selectBiome } from '../../data/biomes'

  let previewDataUrl = ''
  let previewBiome = DEFAULT_BIOME

  function generateDivePreview(): void {
    const seed = Date.now()
    const rng = seededRandom(seed)
    previewBiome = selectBiome(1, rng)
    const { grid } = generateMine(seed, [], 0, previewBiome)
    previewDataUrl = minePreviewDataUrl(grid, previewBiome)
  }

  // Call generateDivePreview() when the dive panel becomes visible
</script>

<!-- In the dive panel markup: -->
<MinePreviewThumbnail
  dataUrl={previewDataUrl}
  biomeLabel={previewBiome.label}
  layer={1}
/>
```

**Acceptance Criteria — 49.6**:
- [ ] `MinePreview.ts` exports `renderMinePreview` and `minePreviewDataUrl`.
- [ ] `MinePreviewThumbnail.svelte` renders a 160×120 scaled preview.
- [ ] `HubView.svelte` generates and displays a preview when the dive panel opens.
- [ ] Thumbnail is visually distinct per biome (background color changes).
- [ ] `npm run typecheck` passes.

---

### 49.7 — Dynamic Difficulty Integration

**File affected**: `src/game/systems/MineGenerator.ts`, `src/data/balance.ts`

**Goal**: Allow the generator to adapt its parameters based on the player's `EngagementData` and `ArchetypeData` from `PlayerSave`. High-skill players get denser HardRock, more hazards, and higher anomaly rates. Struggling players get more OxygenCaches and gentler block distributions.

#### 49.7.1 — `DifficultyProfile` Type and Extraction

Add to `MineGenerator.ts`:

```typescript
import type { EngagementData } from '../../services/engagementScorer'
import type { ArchetypeData } from '../../services/archetypeDetector'

/**
 * Difficulty modifier profile extracted from player engagement and archetype data.
 * All values are multipliers (1.0 = no change).
 */
export interface DifficultyProfile {
  /** Block hardness multiplier (applied on top of LAYER_HARDNESS_SCALE). */
  hardnessMultiplier: number
  /** HardRock block weight multiplier. */
  hardRockWeightMultiplier: number
  /** Hazard density multiplier. */
  hazardMultiplier: number
  /** OxygenCache density multiplier (inverse of difficulty). */
  oxygenCacheMultiplier: number
  /** Anomaly zone injection probability multiplier. */
  anomalyRateMultiplier: number
  /** Mineral node count multiplier. */
  mineralMultiplier: number
}

/**
 * Builds a DifficultyProfile from the player's engagement score and archetype.
 * Engagement score is clamped to [0, 100]. Score 50 → neutral (all 1.0).
 * Score > 50 → harder; score < 50 → easier.
 *
 * @param engagementData - Player's hidden engagement scoring state.
 * @param archetypeData - Player's detected archetype (explorer/miner/scholar/survivor).
 */
export function buildDifficultyProfile(
  engagementData: EngagementData,
  archetypeData: ArchetypeData,
): DifficultyProfile {
  const score = Math.max(0, Math.min(100, engagementData.score ?? 50))
  const normalized = (score - 50) / 50  // -1.0 to +1.0

  // Base difficulty scaling: ±20% from neutral
  const hardnessMult = 1.0 + normalized * BALANCE.DD_HARDNESS_SCALE
  const hazardMult   = 1.0 + normalized * BALANCE.DD_HAZARD_SCALE
  const oxygenMult   = 1.0 - normalized * BALANCE.DD_OXYGEN_SCALE  // less O2 when harder
  const anomalyMult  = 1.0 + normalized * 0.5

  // Archetype modifiers
  let hardRockMult = 1.0
  let mineralMult = 1.0
  if (archetypeData.detectedArchetype === 'Miner') {
    hardRockMult *= 1.1   // Miners get extra HardRock as a reward
    mineralMult *= 1.2
  } else if (archetypeData.detectedArchetype === 'Explorer') {
    anomalyMult * 1.15  // Explorers see more anomalies
  }

  return {
    hardnessMultiplier:       Math.max(0.5, hardnessMult),
    hardRockWeightMultiplier: Math.max(0.5, hardnessMult * hardRockMult),
    hazardMultiplier:         Math.max(0.3, hazardMult),
    oxygenCacheMultiplier:    Math.max(0.5, oxygenMult),
    anomalyRateMultiplier:    Math.max(0.5, anomalyMult),
    mineralMultiplier:        Math.max(0.7, mineralMult),
  }
}
```

#### 49.7.2 — Apply `DifficultyProfile` in `generateMine`

Extend `generateMine` signature:

```typescript
export function generateMine(
  seed: number,
  facts: string[],
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
  secondaryBiome?: Biome,
  transitionBandWidth = 5,
  difficultyProfile?: DifficultyProfile,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome }
```

Apply the profile at relevant sites:

```typescript
// Hardness scale override:
const hardnessScale = Math.pow(BALANCE.LAYER_HARDNESS_SCALE, layer)
  * (difficultyProfile?.hardnessMultiplier ?? 1.0)

// HardRock weight override in getDepthWeights call:
// Pass hardRockWeightMultiplier as an extra param and multiply hardRockFinal.

// Oxygen cache count:
const oxygenCacheCount = Math.round(
  BALANCE.DENSITY_OXYGEN_CACHES * (difficultyProfile?.oxygenCacheMultiplier ?? 1.0)
)

// Mineral node count:
const mineralNodeCountDynamic = Math.max(1, Math.round(
  BALANCE.DENSITY_MINERAL_NODES
  * biome.mineralMultiplier
  * (difficultyProfile?.mineralMultiplier ?? 1.0)
))

// Anomaly zone rate (passed into injectAnomalyZones as a multiplier override):
// injectAnomalyZones already calls getAnomalyChance(); scale it post-hoc.
```

Add to `balance.ts`:

```typescript
DD_HARDNESS_SCALE: 0.20,   // Max ±20% hardness adjustment from engagement score
DD_HAZARD_SCALE:   0.25,   // Max ±25% hazard density adjustment
DD_OXYGEN_SCALE:   0.15,   // Max ±15% oxygen cache count adjustment
```

#### 49.7.3 — Pass Profile from `GameManager.ts`

In `GameManager.ts`, when calling `generateMine` for each layer, build and pass the profile:

```typescript
import { buildDifficultyProfile } from '../game/systems/MineGenerator'
import { get } from 'svelte/store'
import { playerSave } from '../ui/stores/playerData'

// At dive start:
const save = get(playerSave)
const diffProfile = save.engagementData && save.archetypeData
  ? buildDifficultyProfile(save.engagementData, save.archetypeData)
  : undefined

// Then pass diffProfile into generateMine().
```

**Acceptance Criteria — 49.7**:
- [ ] `DifficultyProfile` type and `buildDifficultyProfile()` exported from `MineGenerator.ts`.
- [ ] `generateMine` accepts optional `difficultyProfile` parameter without breaking existing callers.
- [ ] Hardness, hazard count, and oxygen cache count are adjusted when profile is provided.
- [ ] `GameManager.ts` passes the profile at dive start.
- [ ] `npm run typecheck` passes.

---

## Playwright Test Scripts

Save each script to `/tmp/` and run with `node /tmp/<script>.js`.

### Test 1 — Seed Determinism

```js
// /tmp/test-49-seed.js
// Verifies that generateMine with the same seed and layer produces the same grid checksum twice.
const path = require('path')
process.chdir('/root/terra-miner')
const { execSync } = require('child_process')

// Build a minimal test using the built-in seededRandom + gridChecksum via node directly.
// Use esbuild-register for TypeScript.
try {
  execSync('npx tsx -e "\
    import { generateMine, seededRandom } from \'./src/game/systems/MineGenerator\'; \
    import { gridChecksum } from \'./src/game/systems/SeedVerifier\'; \
    import { DEFAULT_BIOME } from \'./src/data/biomes\'; \
    const seed = 12345678; \
    const { grid: g1 } = generateMine(seed, [\'f1\',\'f2\'], 5, DEFAULT_BIOME); \
    const { grid: g2 } = generateMine(seed, [\'f1\',\'f2\'], 5, DEFAULT_BIOME); \
    const c1 = gridChecksum(g1); const c2 = gridChecksum(g2); \
    if (c1 !== c2) { console.error(\'FAIL: checksums differ\', c1, c2); process.exit(1); } \
    console.log(\'PASS: checksums match\', c1); \
  "', { stdio: 'inherit' })
} catch (e) {
  console.error('Seed determinism test failed:', e.message)
  process.exit(1)
}
```

### Test 2 — Visual Screenshot of Dive Preview

```js
// /tmp/test-49-preview.js
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

  // Open dive panel
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1200)

  await page.screenshot({ path: '/tmp/ss-49-preview.png' })
  console.log('Screenshot saved to /tmp/ss-49-preview.png')
  await browser.close()
})()
```

### Test 3 — Transition Zone Flag Verification

```js
// /tmp/test-49-transition.js
const { execSync } = require('child_process')
process.chdir('/root/terra-miner')
try {
  execSync('npx tsx -e "\
    import { generateMine } from \'./src/game/systems/MineGenerator\'; \
    import { DEFAULT_BIOME, ALL_BIOMES } from \'./src/data/biomes\'; \
    const biomeA = ALL_BIOMES[0]; \
    const biomeB = ALL_BIOMES[5]; \
    const { grid } = generateMine(99999, [], 3, biomeA, biomeB, 6); \
    const transitionCells = grid.flat().filter(c => c.isTransitionZone).length; \
    if (transitionCells === 0) { console.error(\'FAIL: no transition cells flagged\'); process.exit(1); } \
    console.log(\'PASS: transition cells flagged:\', transitionCells); \
  "', { stdio: 'inherit' })
} catch (e) {
  console.error('Transition zone test failed:', e.message)
  process.exit(1)
}
```

### Test 4 — Anomaly Zone Injection

```js
// /tmp/test-49-anomaly.js
const { execSync } = require('child_process')
process.chdir('/root/terra-miner')
try {
  execSync('npx tsx -e "\
    import { generateMine } from \'./src/game/systems/MineGenerator\'; \
    import { ALL_BIOMES } from \'./src/data/biomes\'; \
    // Use temporal_rift (anomaly tier) to force high anomaly chance \
    const anomalyBiome = ALL_BIOMES.find(b => b.id === \'temporal_rift\')!; \
    let zoneCount = 0; \
    for (let seed = 1; seed <= 50; seed++) { \
      const { grid } = generateMine(seed * 1000, [], 10, anomalyBiome); \
      // Check for relic sanctuaries or void zones (empty-heavy areas) \
      const relicCells = grid.flat().filter(c => c.type === 17 /* RelicShrine */).length; \
      if (relicCells > 0) zoneCount++; \
    } \
    console.log(\'Anomaly zones found across 50 seeds:\', zoneCount); \
    if (zoneCount < 5) { console.error(\'WARN: low anomaly injection rate\'); } \
    else console.log(\'PASS\'); \
  "', { stdio: 'inherit' })
} catch (e) {
  console.error('Anomaly test failed:', e.message)
  process.exit(1)
}
```

---

## Verification Gate

All of the following must pass before Phase 49 is marked complete:

### TypeScript

```bash
npm run typecheck
# Must exit 0 with no new errors.
```

### Build

```bash
npm run build
# Must complete successfully. Check for no new bundle-size regressions beyond 10KB.
```

### Seed Determinism

- Run `/tmp/test-49-seed.js`.
- Must print `PASS: checksums match`.
- Run it 3 times — checksum must be identical every run.

### Transition Zones

- Run `/tmp/test-49-transition.js`.
- Must print `PASS` with > 0 transition cells when `secondaryBiome` is provided.
- Must produce 0 transition cells when `secondaryBiome` is omitted.

### Anomaly Injection

- Run `/tmp/test-49-anomaly.js`.
- Must find at least 5 anomaly-zone indicators across 50 seeds for an anomaly biome.

### Visual Checks

- Run the dev server: `npm run dev`.
- Open `http://localhost:5173`.
- Take screenshot: run `/tmp/test-49-preview.js`.
- Read `/tmp/ss-49-preview.png` with the Read tool.
- Confirm: Mine preview thumbnail visible in the dive preparation panel.
- Navigate into the mine (Layer 1).
- Take second screenshot and verify mine loads without console errors.

### Unit-Level Checks

- Generate mines for all 5 biome tiers, layers 1, 5, 10, 15, 20.
- Confirm each produces a valid (non-empty) grid.
- Confirm `gridChecksum` for each seed is stable across two calls.
- Confirm `placeStructuralFeatures` produces non-rectangular features for at least: `pocket_caves`, `crystal_veins`, `root_corridors`, `obsidian_spires`.

### Performance

- Measure time to generate layer 20 (40×40 grid) with all new systems active.
- Must complete in under 50ms on the development machine.
- If > 50ms: disable `injectAnomalyZones` on extreme-density layers or reduce `ANOMALY_MAX_PER_LAYER` to 1.

---

## Files Affected

### New Files

| Path | Description |
|------|-------------|
| `src/game/systems/AnomalyZoneSystem.ts` | Anomaly zone injection logic (DD-V2-237) |
| `src/game/systems/SeedVerifier.ts` | Grid checksum and determinism verification |
| `src/game/systems/MinePreview.ts` | Offscreen canvas thumbnail generator |
| `src/ui/components/MinePreviewThumbnail.svelte` | Svelte component for dive preview display |

### Modified Files

| Path | Changes |
|------|---------|
| `src/game/systems/MineGenerator.ts` | `stampFeature()` function; 3 new micro-structure types; multi-biome `generateMine()` signature; `flagTransitionZones()` implementation; `blendBiomeWeights()`; `buildDifficultyProfile()`; `DifficultyProfile` type; calls to `injectAnomalyZones`; `SeedVerifier` checksum call |
| `src/data/biomeStructures.ts` | 3 new `StructuralFeatureId` values; 3 new `STRUCTURAL_FEATURE_CONFIGS` entries; updated `BIOME_STRUCTURAL_FEATURES` assignments |
| `src/data/balance.ts` | `DUAL_BIOME_CHANCE`, `TRANSITION_BAND_WIDTH`, `ANOMALY_ZONE_BASE_CHANCE`, `ANOMALY_MAX_PER_LAYER`, `DD_HARDNESS_SCALE`, `DD_HAZARD_SCALE`, `DD_OXYGEN_SCALE` |
| `src/data/saveState.ts` | `layerChecksums?: number[]` on `DiveSaveState` |
| `src/game/managers/SaveManager.ts` | Record `gridChecksum` per generated layer |
| `src/game/GameManager.ts` | Build and pass `DifficultyProfile` into `generateMine()`; pass `secondaryBiome` when dual-biome chance fires |
| `src/ui/components/HubView.svelte` | Generate and display `MinePreviewThumbnail` in dive panel |

### Explicitly Not Changed

- `src/data/biomes.ts` — `ALL_BIOMES` definitions remain unchanged; new features are assigned via `BIOME_STRUCTURAL_FEATURES`.
- `src/data/types.ts` — `MineCell.isTransitionZone` already exists from Phase 9. No changes needed.
- `src/game/scenes/MineScene.ts` — Rendering is unchanged; `isTransitionZone` cells render with existing tileVariant system.
- `src/game/systems/AutotileSystem.ts` — No changes; transition zones are a data flag only.
- Any server-side files — Generation is purely client-side.

---

## Notes for Workers

1. The `stampFeature()` function in 49.1 must be added as a module-level function (not nested), because it is large and needs to call `getHardness()` which is already module-level.

2. The `placeMicroStructures()` function currently closes over `gridWidth`, `gridHeight`, `rng`, and `grid` as closure variables. The three new micro-structure stamp functions (Underground River, Stalactite Gallery, Geode Chamber) should follow the same pattern: defined as inner functions within `placeMicroStructures()` that close over those same variables.

3. For 49.2, the `getDepthWeights()` signature may need an additional `hardRockWeightMultiplier` parameter to thread the difficulty profile's HardRock scaling. If adding this parameter breaks existing callers, default it to 1.0.

4. `buildDifficultyProfile()` references `EngagementData` and `ArchetypeData` from services that use path `../../services/`. Ensure the import path is correct relative to `MineGenerator.ts` (`src/game/systems/` → `../../services/`). If circular imports arise, move `DifficultyProfile` and `buildDifficultyProfile` to a separate file `src/game/systems/DifficultyProfile.ts`.

5. `MinePreview.ts` calls `document.createElement('canvas')` — this will fail in a Node.js test environment. The `verifyMineChecksum` function in `SeedVerifier.ts` should NOT import from `MinePreview.ts`. Keep them independent.

6. The `minePreviewDataUrl` call in `HubView.svelte` is synchronous but involves full grid generation. For a 20×20 grid (layer 1) this is fast (< 5ms). Do not run it for all 20 layers upfront.

7. All new `balance.ts` constants must be added to the existing `BALANCE` object literal — do not create a separate export.
