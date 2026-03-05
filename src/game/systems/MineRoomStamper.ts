/**
 * Room and structure stamping functions for mine generation.
 * Contains stampLandmark, stampFeature, and placeMicroStructures.
 * Called internally by generateMine in MineGenerator.ts.
 */
/** SIZE BUDGET: Room stamping — stay below 1500 lines. */

import { BALANCE } from '../../data/balance'
import { BlockType, type MineCell } from '../../data/types'
import { LANDMARK_TEMPLATES, type LandmarkTemplate } from '../../data/landmarks'
import { BIOME_STRUCTURAL_FEATURES, STRUCTURAL_FEATURE_CONFIGS, type StructuralFeatureId } from '../../data/biomeStructures'
import { getHardness, randomIntInclusive, pickRarity } from './MineGeneratorUtils'
import { CAVERN_TEXTS } from '../../data/cavernTexts'

/**
 * Stamps a landmark template into the center of the mine grid.
 * Returns the resolved spawn (S) position.
 * All ASCII characters map to BlockType values; 'S' becomes Empty and records spawn coords.
 * (DD-V2-055)
 */
export function stampLandmark(
  template: LandmarkTemplate,
  grid: MineCell[][],
  width: number,
  height: number
): { spawnX: number; spawnY: number } {
  const tRows = template.grid
  const tH = tRows.length
  const tW = Math.max(...tRows.map(r => r.length))
  const offsetX = Math.floor((width - tW) / 2)
  const offsetY = Math.floor((height - tH) / 2)

  let spawnX = offsetX + 1
  let spawnY = offsetY + 1

  const ASCII_MAP: Record<string, BlockType> = {
    ' ': BlockType.Empty,
    '#': BlockType.HardRock,
    'L': BlockType.LavaBlock,
    'G': BlockType.GasPocket,
    'C': BlockType.Chest,
    'T': BlockType.Tablet,
    'M': BlockType.MineralNode,
    'E': BlockType.Empty,
    'S': BlockType.Empty,
    'D': BlockType.DescentShaft,
  }

  for (let row = 0; row < tH; row++) {
    for (let col = 0; col < tRows[row].length; col++) {
      const ch = tRows[row][col]
      const gx = offsetX + col
      const gy = offsetY + row
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue
      if (ch === 'S') { spawnX = gx; spawnY = gy }
      const blockType = ASCII_MAP[ch] ?? BlockType.Empty
      const hardness = getHardness(blockType)
      grid[gy][gx] = {
        type: blockType,
        hardness,
        maxHardness: hardness,
        revealed: false,
      }
    }
  }

  return { spawnX, spawnY }
}

/**
 * Stamps a single structural feature into the grid using shape-aware logic.
 * Each feature type has its own geometry instead of a uniform rectangle fill.
 * (DD-V2-236, Phase 49.1)
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
export function stampFeature(
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

/**
 * Places biome-specific structural features on the grid after base generation.
 * Features use shape-aware stamp logic (stampFeature) instead of plain rectangle fills.
 * Phase 9.4 / Phase 49.1
 */
export function placeStructuralFeatures(
  grid: MineCell[][],
  biomeId: string,
  rng: () => number,
  height: number,
  width: number,
): void {
  const featureIds = BIOME_STRUCTURAL_FEATURES[biomeId]
  if (!featureIds || featureIds.length === 0) return

  // Track placed feature bounding boxes to prevent overlap
  const placed: Array<{ x: number; y: number; w: number; h: number }> = []

  for (const featureId of featureIds) {
    const config = STRUCTURAL_FEATURE_CONFIGS[featureId]
    if (!config) continue

    // Attempt to place the feature a few times
    const maxAttempts = 8
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Skip this placement with probability (1 - frequency)
      if (rng() > config.frequency) continue

      // Randomize size within bounds
      const fw = config.minSize.width + Math.floor(rng() * (config.maxSize.width - config.minSize.width + 1))
      const fh = config.minSize.height + Math.floor(rng() * (config.maxSize.height - config.minSize.height + 1))

      // Random position (leave 2-cell border)
      const margin = 2
      if (width <= fw + margin * 2 || height <= fh + margin * 2) continue
      const fx = margin + Math.floor(rng() * (width - fw - margin * 2))
      const fy = margin + Math.floor(rng() * (height - fh - margin * 2))

      // Check overlap with previously placed features
      const overlaps = placed.some(p =>
        fx < p.x + p.w && fx + fw > p.x &&
        fy < p.y + p.h && fy + fh > p.y
      )
      if (overlaps) continue

      // Phase 49.1: Use shape-aware stampFeature() instead of the plain rectangle fill.
      stampFeature(grid, featureId, fx, fy, fw, fh, config.fillBlock, rng, width, height)

      placed.push({ x: fx, y: fy, w: fw, h: fh })
      break // Successfully placed this feature
    }
  }
}

/**
 * Stamps pre-designed micro-structure rooms into the mine grid.
 *
 * Three room types are available:
 *   - Ancient Library Room (7×5): Unbreakable-walled chamber with an ArtifactNode
 *     at the centre and a QuizGate at the bottom entrance.
 *   - Rest Alcove (5×5): Stone-walled pocket with an OxygenCache at the centre
 *     and an open gap at the bottom entrance.
 *   - Crystal Cavern (6×6): HardRock-walled treasure cave with 4 MineralNodes and
 *     an OxygenCache at the centre. Only appears below CRYSTAL_CAVERN_MIN_DEPTH.
 *     Entrance is a 2-wide gap on a randomly chosen side.
 *
 * Rooms are placed at random positions that respect minimum depth constraints,
 * avoid the spawn area, and do not overlap each other or the grid edges.
 *
 * @param grid - The mine cell grid to stamp into
 * @param rng - Seeded random number generator
 * @param spawnX - Player spawn column (centre of 3×3 clear zone)
 * @param spawnY - Player spawn row (centre of 3×3 clear zone)
 * @param gridWidth - Total grid columns
 * @param gridHeight - Total grid rows
 * @param facts - Array of fact IDs to assign to library ArtifactNodes
 */
export function placeMicroStructures(
  grid: MineCell[][],
  rng: () => number,
  spawnX: number,
  spawnY: number,
  gridWidth: number,
  gridHeight: number,
  facts: string[]
): void {
  /** Occupied bounding boxes so rooms do not overlap each other. */
  const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = []

  /**
   * Returns true when the candidate box overlaps any already-placed bounding box.
   * A 1-cell gap is enforced between rooms.
   */
  function overlapsPlaced(x: number, y: number, w: number, h: number): boolean {
    for (const box of placedBoxes) {
      if (
        x < box.x + box.w + 1 &&
        x + w + 1 > box.x &&
        y < box.y + box.h + 1 &&
        y + h + 1 > box.y
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Returns true when the candidate box overlaps the 3×3 spawn clearance area.
   */
  function overlapsSpawn(x: number, y: number, w: number, h: number): boolean {
    const spawnMinX = spawnX - 1
    const spawnMaxX = spawnX + 1
    const spawnMinY = spawnY - 1
    const spawnMaxY = spawnY + 1
    return (
      x <= spawnMaxX &&
      x + w - 1 >= spawnMinX &&
      y <= spawnMaxY &&
      y + h - 1 >= spawnMinY
    )
  }

  /**
   * Stamps an Ancient Library Room at (roomX, roomY).
   *
   * Layout (7 wide × 5 tall):
   *   UUUUUUU
   *   U.....U    U = Unbreakable wall
   *   U..A..U    . = Empty
   *   U.....U    A = ArtifactNode (guaranteed rare)
   *   UUUQUUU    Q = QuizGate entrance (bottom-centre wall opening)
   */
  function stampLibraryRoom(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 7
    const H = 5

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        // Centre of the room interior (row 2, col 3 in 0-indexed 7×5)
        const isArtifact = dy === 2 && dx === 3
        // Bottom-centre wall opening replaced by QuizGate
        const isQuizGate = dy === H - 1 && dx === 3
        const isWall = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1

        let cell: MineCell

        if (isArtifact) {
          const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
          cell = {
            type: BlockType.ArtifactNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              artifactRarity: 'rare',
              factId,
            },
          }
        } else if (isQuizGate) {
          const hardness = BALANCE.HARDNESS_QUIZ_GATE
          cell = {
            type: BlockType.QuizGate,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: { factId },
          }
        } else if (isWall) {
          cell = {
            type: BlockType.Unbreakable,
            hardness: 999,
            maxHardness: 999,
            revealed: false,
          }
        } else {
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Crystal Cavern at (roomX, roomY).
   *
   * Layout (6 wide × 6 tall):
   *   HHHHHH
   *   H....H    H = HardRock wall (crystalline)
   *   H.MM.H    . = Empty interior
   *   HMO.MH    M = MineralNode (4 total, scattered)
   *   H....H    O = OxygenCache (centre reward)
   *   HH.HHH    Gap at bottom-centre = 2-wide open entrance
   *
   * The entrance is 2 cells wide on a randomly chosen side.
   */
  function stampCrystalCavern(roomX: number, roomY: number, roomDepthY: number): void {
    const W = 6
    const H = 6

    // Mineral node positions (interior only, not on walls): relative (dx, dy)
    // Using a fixed scatter pattern within the 4×4 interior (dx 1..4, dy 1..4)
    const mineralPositions: Array<{ dx: number; dy: number }> = [
      { dx: 2, dy: 1 },
      { dx: 4, dy: 1 },
      { dx: 1, dy: 3 },
      { dx: 4, dy: 3 },
    ]
    const mineralSet = new Set(mineralPositions.map(p => `${p.dx},${p.dy}`))

    // OxygenCache at centre of interior (dx=2 or 3, dy=2 or 3 — pick col 2, row 2 interior offset)
    const oxygenDx = 2
    const oxygenDy = 3

    // Choose a random side for the 2-wide entrance: 0=left, 1=right, 2=top, 3=bottom
    const entranceSide = Math.floor(rng() * 4)

    // Determine which cells are entrance gaps (2-wide, centred on the chosen wall)
    function isEntranceGap(dx: number, dy: number): boolean {
      switch (entranceSide) {
        case 0: // Left wall — open dx=0, dy=2 and dy=3
          return dx === 0 && (dy === 2 || dy === 3)
        case 1: // Right wall — open dx=W-1, dy=2 and dy=3
          return dx === W - 1 && (dy === 2 || dy === 3)
        case 2: // Top wall — open dy=0, dx=2 and dx=3
          return dy === 0 && (dx === 2 || dx === 3)
        default: // Bottom wall — open dy=H-1, dx=2 and dx=3
          return dy === H - 1 && (dx === 2 || dx === 3)
      }
    }

    // Determine the mineralType based on depth (mirrors the post-pass logic in generateMine).
    // Priority order (highest wins): essence → geode → crystal → shard → dust
    const depthRatio = roomDepthY / gridHeight
    type CavernTier = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
    let cavernMineralType: CavernTier = 'dust'
    if (depthRatio >= BALANCE.MINERAL_ESSENCE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_ESSENCE_CHANCE) {
      cavernMineralType = 'essence'
    } else if (depthRatio >= BALANCE.MINERAL_GEODE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_GEODE_CHANCE) {
      cavernMineralType = 'geode'
    } else if (depthRatio >= BALANCE.MINERAL_CRYSTAL_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_CRYSTAL_CHANCE) {
      cavernMineralType = 'crystal'
    } else if (depthRatio >= BALANCE.MINERAL_SHARD_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_SHARD_CHANCE) {
      cavernMineralType = 'shard'
    }

    const mineralDropMin = cavernMineralType === 'essence'
      ? BALANCE.MINERAL_ESSENCE_DROP_MIN
      : cavernMineralType === 'geode'
        ? BALANCE.MINERAL_GEODE_DROP_MIN
        : cavernMineralType === 'crystal'
          ? BALANCE.MINERAL_CRYSTAL_DROP_MIN
          : cavernMineralType === 'shard'
            ? BALANCE.MINERAL_SHARD_DROP_MIN
            : BALANCE.MINERAL_DROP_MIN
    const mineralDropMax = cavernMineralType === 'essence'
      ? BALANCE.MINERAL_ESSENCE_DROP_MAX
      : cavernMineralType === 'geode'
        ? BALANCE.MINERAL_GEODE_DROP_MAX
        : cavernMineralType === 'crystal'
          ? BALANCE.MINERAL_CRYSTAL_DROP_MAX
          : cavernMineralType === 'shard'
            ? BALANCE.MINERAL_SHARD_DROP_MAX
            : BALANCE.MINERAL_DROP_MAX

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const isMineral = mineralSet.has(`${dx},${dy}`)
        const isOxygen = dx === oxygenDx && dy === oxygenDy
        const isEntrance = isEntranceGap(dx, dy)
        const isWall = !isMineral && !isOxygen && !isEntrance &&
          (dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1)

        let cell: MineCell

        if (isMineral) {
          const hardness = BALANCE.HARDNESS_MINERAL_NODE
          const mineralAmount = randomIntInclusive(rng, mineralDropMin, mineralDropMax)
          cell = {
            type: BlockType.MineralNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              mineralType: cavernMineralType,
              mineralAmount,
            },
          }
        } else if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isWall) {
          const hardness = BALANCE.HARDNESS_HARD_ROCK
          cell = {
            type: BlockType.HardRock,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else {
          // Interior empty cells and entrance gap
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Rest Alcove at (roomX, roomY).
   *
   * Layout (5 wide × 5 tall):
   *   SSSSS
   *   S...S    S = Stone wall (minable — can tunnel around)
   *   S.O.S    . = Empty interior
   *   S...S    O = OxygenCache
   *   SS.SS    Gap at bottom-centre = open entrance
   */
  function stampRestAlcove(roomX: number, roomY: number): void {
    const W = 5
    const H = 5

    // 25% chance to place a WallText block on the back wall (dy=0, dx 1-3)
    const placeWallText = rng() < BALANCE.WALL_TEXT_ALCOVE_CHANCE
    const wallTextDx = placeWallText ? 1 + Math.floor(rng() * 3) : -1

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const isOxygen = dy === 2 && dx === 2
        // Bottom-centre cell is the open entrance gap (Empty, not Stone)
        const isEntrance = dy === H - 1 && dx === 2
        const isWall =
          !isOxygen &&
          !isEntrance &&
          (dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1)

        let cell: MineCell

        // WallText on back wall position
        if (placeWallText && dy === 0 && dx === wallTextDx) {
          const eligible = CAVERN_TEXTS.filter(ct => ct.biome === 'any')
          const picked = eligible[Math.floor(rng() * eligible.length)]
          cell = {
            type: BlockType.WallText,
            hardness: 999,
            maxHardness: 999,
            revealed: false,
            content: picked ? { factId: picked.id } : undefined,
          }
        } else if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isWall) {
          const hardness = BALANCE.HARDNESS_STONE
          cell = {
            type: BlockType.Stone,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else {
          // Interior empty cells and the entrance gap
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Collapsed Tunnel at (roomX, roomY).
   *
   * Layout (COLLAPSED_TUNNEL_LENGTH wide × 3 tall), left-to-right example:
   *   UUUUUUU    U = Unbreakable wall/ceiling
   *   .DSDSDА    . = Open entrance, D = Dirt rubble, S = SoftRock rubble, A = ArtifactNode reward
   *   UUUUUUU
   *
   * `goRight` determines which end has the open entrance (left) vs. the ArtifactNode (right).
   * When false the layout is mirrored: entrance on the right, reward on the left.
   */
  function stampCollapsedTunnel(
    roomX: number,
    roomY: number,
    goRight: boolean,
    factId: string | undefined,
  ): void {
    const W = BALANCE.COLLAPSED_TUNNEL_LENGTH
    const H = 3

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        let cell: MineCell

        if (dy === 0 || dy === H - 1) {
          // Top and bottom rows are Unbreakable (tunnel ceiling/floor walls)
          cell = {
            type: BlockType.Unbreakable,
            hardness: 999,
            maxHardness: 999,
            revealed: false,
          }
        } else {
          // Middle row (dy === 1): entrance, rubble, and reward
          const entranceCol = goRight ? 0 : W - 1
          const artifactCol = goRight ? W - 1 : 0

          if (dx === entranceCol) {
            // Open entrance cell — connects tunnel to surrounding mine space
            cell = {
              type: BlockType.Empty,
              hardness: 0,
              maxHardness: 0,
              revealed: false,
            }
          } else if (dx === artifactCol) {
            // Reward ArtifactNode at the far end of the tunnel
            const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
            cell = {
              type: BlockType.ArtifactNode,
              hardness,
              maxHardness: hardness,
              revealed: false,
              content: {
                artifactRarity: pickRarity(rng),
                factId,
              },
            }
          } else {
            // Rubble: ~60% Dirt, ~40% SoftRock
            const isDirt = rng() < 0.6
            const rubbleType = isDirt ? BlockType.Dirt : BlockType.SoftRock
            const rubbleHardness = isDirt ? BALANCE.HARDNESS_DIRT : BALANCE.HARDNESS_SOFT_ROCK
            cell = {
              type: rubbleType,
              hardness: rubbleHardness,
              maxHardness: rubbleHardness,
              revealed: false,
            }
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  /**
   * Stamps a Ruins with Lore site at (roomX, roomY).
   *
   * Layout (9 wide × 7 tall) — an ancient ruined chamber:
   *   Walls: mix of Unbreakable (U) and Stone (S); ~30% of non-anchor wall blocks crumble to Empty.
   *   Interior contains: 3 QuoteStones in a row (inscription wall), 1 ArtifactNode in a corner,
   *                      2 MineralNodes scattered, 1 OxygenCache hidden inside, Dirt rubble debris.
   *   Entrance: 2-wide gap on the bottom wall (collapsed entrance).
   *
   *   Schematic (U=Unbreakable, S=Stone, .=Empty, Q=QuoteStone, A=ArtifactNode,
   *              M=MineralNode, O=OxygenCache, D=Dirt rubble):
   *   U S U U U U U S U   row 0
   *   U . . . . . . . U   row 1
   *   S . D . Q Q Q . U   row 2
   *   U . . . . . . . S   row 3
   *   U . M . . . M . U   row 4
   *   U . . . O . . . U   row 5
   *   U U A U . . U U U   row 6  ← 2-wide entrance at dx=4,5
   */
  function stampRuins(roomX: number, roomY: number, factId: string | undefined): void {
    const W = 9
    const H = 7

    // QuoteStone inscription wall: 3 stones in interior row dy=2 at dx=4,5,6
    const quotePositions = new Set(['4,2', '5,2', '6,2'])

    // ArtifactNode at bottom-left interior position (bottom wall row, dx=2)
    const artifactDx = 2
    const artifactDy = H - 1

    // MineralNode positions (interior)
    const mineralPositions = new Set(['2,4', '6,4'])

    // OxygenCache — tucked into the interior near bottom-centre
    const oxygenDx = 4
    const oxygenDy = 5

    // Dirt rubble scattered inside (avoids all special block positions)
    const dirtRubblePositions = new Set(['2,2', '6,3', '4,4'])

    // Entrance: 2-wide gap on the bottom wall at dx=4 and dx=5
    function isEntranceGap(dx: number, dy: number): boolean {
      return dy === H - 1 && (dx === 4 || dx === 5)
    }

    // Pre-roll crumble decisions for border (wall) cells — 30% chance each, excluding anchors
    const crumbleMap = new Set<string>()
    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const onBorder = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
        if (!onBorder) continue
        if (isEntranceGap(dx, dy)) continue
        // Corner cells are structural anchors — always solid
        const isCorner = (dx === 0 || dx === W - 1) && (dy === 0 || dy === H - 1)
        if (isCorner) continue
        // Artifact wall cell must remain solid
        if (dx === artifactDx && dy === artifactDy) continue
        if (rng() < 0.3) {
          crumbleMap.add(`${dx},${dy}`)
        }
      }
    }

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy

        const key = `${dx},${dy}`
        const onBorder = dy === 0 || dy === H - 1 || dx === 0 || dx === W - 1
        const isEntrance = isEntranceGap(dx, dy)
        const isQuote = quotePositions.has(key)
        const isArtifact = dx === artifactDx && dy === artifactDy
        const isMineral = mineralPositions.has(key)
        const isOxygen = dx === oxygenDx && dy === oxygenDy
        const isDirt = dirtRubblePositions.has(key)
        const isCrumbled = crumbleMap.has(key)

        let cell: MineCell

        if (isEntrance) {
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        } else if (isArtifact) {
          const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
          cell = {
            type: BlockType.ArtifactNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              artifactRarity: 'rare',
              factId,
            },
          }
        } else if (isQuote) {
          cell = {
            type: BlockType.QuoteStone,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
          }
        } else if (isMineral) {
          const hardness = BALANCE.HARDNESS_MINERAL_NODE
          const mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
          cell = {
            type: BlockType.MineralNode,
            hardness,
            maxHardness: hardness,
            revealed: false,
            content: {
              mineralType: 'dust',
              mineralAmount,
            },
          }
        } else if (isOxygen) {
          cell = {
            type: BlockType.OxygenCache,
            hardness: 2,
            maxHardness: 2,
            revealed: false,
            content: { oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE },
          }
        } else if (isDirt && !onBorder) {
          const hardness = BALANCE.HARDNESS_DIRT
          cell = {
            type: BlockType.Dirt,
            hardness,
            maxHardness: hardness,
            revealed: false,
          }
        } else if (onBorder && isCrumbled) {
          // Crumbled wall section — open gap suggesting ruin
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        } else if (onBorder) {
          // Wall: corners always Unbreakable; other cells alternate Stone/Unbreakable by position
          const isCorner = (dx === 0 || dx === W - 1) && (dy === 0 || dy === H - 1)
          const useUnbreakable = isCorner || (dx + dy) % 3 !== 1
          if (useUnbreakable) {
            cell = {
              type: BlockType.Unbreakable,
              hardness: 999,
              maxHardness: 999,
              revealed: false,
            }
          } else {
            const hardness = BALANCE.HARDNESS_STONE
            cell = {
              type: BlockType.Stone,
              hardness,
              maxHardness: hardness,
              revealed: false,
            }
          }
        } else {
          // Interior empty space
          cell = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
          }
        }

        grid[gy][gx] = cell
      }
    }
  }

  // Dimensions of each room type
  const LIBRARY_W = 7
  const LIBRARY_H = 5
  const ALCOVE_W = 5
  const ALCOVE_H = 5
  const CAVERN_W = 6
  const CAVERN_H = 6
  const TUNNEL_W = BALANCE.COLLAPSED_TUNNEL_LENGTH
  const TUNNEL_H = 3
  const RUINS_W = 9
  const RUINS_H = 7
  const EDGE_MARGIN = 1

  // Independent fact cursor for micro-structure ArtifactNodes
  let factCursor = 0
  const nextMicroFactId = (): string | undefined => {
    if (facts.length === 0) return undefined
    const id = facts[factCursor % facts.length]
    factCursor++
    return id
  }

  // Guarantee one Ruins per mine (if depth allows) as a bonus slot beyond MICRO_STRUCTURE_COUNT.
  // Ruins is the rarest structure — placed first, before the standard pool roll.
  const ruinsGuaranteeMinY = BALANCE.RUINS_MIN_DEPTH
  const ruinsGuaranteeMaxY = gridHeight - RUINS_H - EDGE_MARGIN
  if (ruinsGuaranteeMinY <= ruinsGuaranteeMaxY) {
    let ruinsPlaced = false
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = randomIntInclusive(rng, EDGE_MARGIN, gridWidth - RUINS_W - EDGE_MARGIN)
      const ry = randomIntInclusive(rng, ruinsGuaranteeMinY, ruinsGuaranteeMaxY)

      if (overlapsSpawn(rx, ry, RUINS_W, RUINS_H)) continue
      if (overlapsPlaced(rx, ry, RUINS_W, RUINS_H)) continue

      stampRuins(rx, ry, nextMicroFactId())
      placedBoxes.push({ x: rx, y: ry, w: RUINS_W, h: RUINS_H })
      ruinsPlaced = true
      break
    }

    if (!ruinsPlaced) {
      // Burn an rng call to keep the sequence predictable
      rng()
    }
  }

  for (let i = 0; i < BALANCE.MICRO_STRUCTURE_COUNT; i++) {
    // Roll a room type using weighted probability:
    //   0.00–0.15  → Ruins (15% — rare, depth-gated, second possible occurrence)
    //   0.15–1.00  → existing four types split ~evenly (~21.25% each)
    // Crystal Cavern and Ruins fall back to Rest Alcove when the grid is too shallow.
    const roomRoll = rng()

    // Determine room dimensions, minimum depth, and type
    let roomW: number
    let roomH: number
    let minDepth: number
    let roomType: 'library' | 'alcove' | 'cavern' | 'tunnel' | 'ruins'

    if (roomRoll < 0.15) {
      // Ruins — rare pool occurrence
      const ruinsPoolMaxY = gridHeight - RUINS_H - EDGE_MARGIN
      if (BALANCE.RUINS_MIN_DEPTH > ruinsPoolMaxY) {
        // Fall back to Rest Alcove if too shallow
        roomW = ALCOVE_W
        roomH = ALCOVE_H
        minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
        roomType = 'alcove'
      } else {
        roomW = RUINS_W
        roomH = RUINS_H
        minDepth = BALANCE.RUINS_MIN_DEPTH
        roomType = 'ruins'
      }
    } else {
      // Distribute remaining 85% evenly across 4 existing types (~21.25% each)
      const subRoll = Math.floor((roomRoll - 0.15) / 0.2125)

      if (subRoll === 0) {
        roomW = LIBRARY_W
        roomH = LIBRARY_H
        minDepth = BALANCE.LIBRARY_ROOM_MIN_DEPTH
        roomType = 'library'
      } else if (subRoll === 1) {
        roomW = ALCOVE_W
        roomH = ALCOVE_H
        minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
        roomType = 'alcove'
      } else if (subRoll === 2) {
        // Crystal Cavern — fall back to Rest Alcove if the grid is too shallow
        const cavernMinY = BALANCE.CRYSTAL_CAVERN_MIN_DEPTH
        const cavernMaxY = gridHeight - CAVERN_H - EDGE_MARGIN
        if (cavernMinY > cavernMaxY) {
          roomW = ALCOVE_W
          roomH = ALCOVE_H
          minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
          roomType = 'alcove'
        } else {
          roomW = CAVERN_W
          roomH = CAVERN_H
          minDepth = cavernMinY
          roomType = 'cavern'
        }
      } else {
        // Collapsed Tunnel — fall back to Rest Alcove if the grid is too shallow
        const tunnelMinY = BALANCE.COLLAPSED_TUNNEL_MIN_DEPTH
        const tunnelMaxY = gridHeight - TUNNEL_H - EDGE_MARGIN
        if (tunnelMinY > tunnelMaxY) {
          roomW = ALCOVE_W
          roomH = ALCOVE_H
          minDepth = BALANCE.REST_ALCOVE_MIN_DEPTH
          roomType = 'alcove'
        } else {
          roomW = TUNNEL_W
          roomH = TUNNEL_H
          minDepth = tunnelMinY
          roomType = 'tunnel'
        }
      }
    }

    const minX = EDGE_MARGIN
    const maxX = gridWidth - roomW - EDGE_MARGIN
    const minY = minDepth
    const maxY = gridHeight - roomH - EDGE_MARGIN

    if (maxX < minX || maxY < minY) {
      continue // Grid too small to fit this room type — skip silently
    }

    let placed = false
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = randomIntInclusive(rng, minX, maxX)
      const ry = randomIntInclusive(rng, minY, maxY)

      if (overlapsSpawn(rx, ry, roomW, roomH)) continue
      if (overlapsPlaced(rx, ry, roomW, roomH)) continue

      if (roomType === 'library') {
        stampLibraryRoom(rx, ry, nextMicroFactId())
      } else if (roomType === 'cavern') {
        stampCrystalCavern(rx, ry, ry)
      } else if (roomType === 'tunnel') {
        const goRight = rng() < 0.5
        stampCollapsedTunnel(rx, ry, goRight, nextMicroFactId())
      } else if (roomType === 'ruins') {
        stampRuins(rx, ry, nextMicroFactId())
      } else {
        stampRestAlcove(rx, ry)
      }

      placedBoxes.push({ x: rx, y: ry, w: roomW, h: roomH })
      placed = true
      break
    }

    if (!placed) {
      // Burn a single rng call so the sequence stays predictable regardless of placement success
      rng()
    }
  }

  // ── Phase 49.1.2: Three new micro-structure room types ───────────────────

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
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
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
    // Randomly pick columns for stalactites (avoid col 0 and W-1 wall cols)
    for (let col = 1; col < W - 1; col++) {
      if (rng() < 0.5) stalactiteColumns.add(col)
    }
    const mineralCols = new Set([2, 5])  // fixed mineral positions on floor

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
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

  /**
   * Stamps a large Geode Chamber at (roomX, roomY).
   *
   * A circular hollow (radius ~3) of Empty interior, surrounded by HardRock walls,
   * with MineralNodes embedded in the inner wall ring,
   * and a single ArtifactNode at the centre. Entrance: 3-wide gap at bottom.
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

    // Pre-compute mineral positions on inner-wall ring (6-directional)
    const mineralAngles = [0, 45, 90, 135, 180, 225].map(a => a * Math.PI / 180)
    const mineralPositions = new Set(mineralAngles.map(a =>
      `${cx + Math.round(Math.cos(a) * mineralR)},${cy + Math.round(Math.sin(a) * mineralR)}`
    ))

    const depthRatio = roomY / gridHeight
    type MineralTierLocal = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'
    let gemTier: MineralTierLocal = 'crystal'
    if (depthRatio >= 0.8) gemTier = 'geode'
    if (depthRatio >= 0.95) gemTier = 'essence'

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const gx = roomX + dx
        const gy = roomY + dy
        if (gx < 0 || gx >= gridWidth || gy < 0 || gy >= gridHeight) continue
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
          continue  // outside the circle — skip (leave existing block)
        }
        grid[gy][gx] = cell
      }
    }
  }

  // Underground River — placed once per layer, only in the lower 70% of the grid
  if (rng() < 0.20 && gridHeight >= 10) {
    const W = 10; const H = 4
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.3) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.5)))
    if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
      stampUndergroundRiver(rx, ry)
      placedBoxes.push({ x: rx, y: ry, w: W, h: H })
    }
  }

  // Stalactite Gallery — once per layer, mid-depth
  if (rng() < 0.25 && gridHeight >= 8) {
    const W = 8; const H = 7
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.2) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.5)))
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
    const rx = 2 + Math.floor(rng() * Math.max(1, gridWidth - W - 4))
    const ry = Math.floor(gridHeight * 0.5) + Math.floor(rng() * Math.max(1, Math.floor(gridHeight * 0.4)))
    if (!overlapsPlaced(rx, ry, W, H) && !overlapsSpawn(rx, ry, W, H)) {
      const factId = facts[factCursor % Math.max(1, facts.length)]
      factCursor++
      stampGeodeChamber(rx, ry, factId)
      placedBoxes.push({ x: rx, y: ry, w: W, h: H })
    }
  }
}
