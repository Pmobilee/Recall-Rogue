/**
 * Block placement pass functions for mine generation.
 * Contains all placement functions called by generateMine in MineGenerator.ts.
 * These are not exported from MineGenerator.ts — they are internal helpers.
 */
/** SIZE BUDGET: Placement passes — stay below 1000 lines. */

import { BALANCE } from '../../data/balance'
import { BlockType, type MineCell } from '../../data/types'
import { type Biome } from '../../data/biomes'
import { HAZARD_DENSITY_BY_LAYER } from '../../data/balance'
import { randomIntInclusive } from './MineGeneratorUtils'
import { QUOTE_STONES } from '../../data/quoteStones'

export function buildSpecialPositionPool(width: number, height: number): Array<{ x: number; y: number }> {
  const pool: Array<{ x: number; y: number }> = []

  for (let y = 2; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      pool.push({ x, y })
    }
  }

  return pool
}

export function placeSpecialBlocks(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  count: number,
  rng: () => number,
  createCell: () => MineCell
): void {
  const placements = Math.min(count, positions.length)

  for (let i = 0; i < placements; i++) {
    const randomIndex = Math.floor(rng() * positions.length)
    const [position] = positions.splice(randomIndex, 1)
    grid[position.y][position.x] = { ...createCell(), baseTerrainCategory: 'rock' }
  }
}

export function placeEmptyPockets(grid: MineCell[][], rng: () => number, count: number): void {
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0

  if (width === 0 || height === 0) {
    return
  }

  const minCenterX = 1
  const maxCenterX = width - 2
  const minCenterY = 3
  const maxCenterY = height - 2

  if (maxCenterX < minCenterX || maxCenterY < minCenterY) {
    return
  }

  for (let i = 0; i < count; i++) {
    const centerX = randomIntInclusive(rng, minCenterX, maxCenterX)
    const centerY = randomIntInclusive(rng, minCenterY, maxCenterY)

    for (let y = centerY - 1; y <= centerY + 1; y++) {
      for (let x = centerX - 1; x <= centerX + 1; x++) {
        grid[y][x] = {
          type: BlockType.Empty,
          hardness: 0,
          maxHardness: 0,
          revealed: false,
          baseTerrainCategory: 'rock',
        }
      }
    }
  }
}

/**
 * Places a single exit room in the mine at a random position.
 * The room is a rectangle of Unbreakable walls with an Empty interior,
 * an ExitLadder at the center, and a 1-wide corridor entrance on a
 * random side blocked by a QuizGate.
 */
export function placeExitRoom(
  grid: MineCell[][],
  gridWidth: number,
  gridHeight: number,
  rng: () => number,
  nextFactId: () => string | undefined,
  spawnX: number,
  spawnY: number,
): void {
  const roomW = BALANCE.EXIT_ROOM_WIDTH
  const roomH = BALANCE.EXIT_ROOM_HEIGHT
  const margin = 3

  // Ensure room fits within the grid with margin from edges
  const minX = margin
  const maxX = gridWidth - roomW - margin
  const minY = margin
  const maxY = gridHeight - roomH - margin

  if (maxX < minX || maxY < minY) {
    return // Grid too small for exit room
  }

  // Try up to 10 times to find a room position at least 12 tiles from spawn (Manhattan)
  let roomX = randomIntInclusive(rng, minX, maxX)
  let roomY = randomIntInclusive(rng, minY, maxY)
  const MIN_EXIT_DISTANCE = 12
  for (let attempt = 0; attempt < 10; attempt++) {
    if (Math.abs(roomX - spawnX) + Math.abs(roomY - spawnY) >= MIN_EXIT_DISTANCE) break
    roomX = randomIntInclusive(rng, minX, maxX)
    roomY = randomIntInclusive(rng, minY, maxY)
  }

  // Carve the room: outer ring is Unbreakable, interior is Empty
  for (let dy = 0; dy < roomH; dy++) {
    for (let dx = 0; dx < roomW; dx++) {
      const gx = roomX + dx
      const gy = roomY + dy
      const isWall = dy === 0 || dy === roomH - 1 || dx === 0 || dx === roomW - 1

      grid[gy][gx] = {
        type: isWall ? BlockType.Unbreakable : BlockType.Empty,
        hardness: isWall ? 999 : 0,
        maxHardness: isWall ? 999 : 0,
        revealed: false,
        baseTerrainCategory: 'rock',
      }
    }
  }

  // Place ExitLadder at center of interior
  const ladderX = roomX + Math.floor(roomW / 2)
  const ladderY = roomY + Math.floor(roomH / 2)
  grid[ladderY][ladderX] = {
    type: BlockType.ExitLadder,
    hardness: 0,
    maxHardness: 0,
    revealed: false,
    baseTerrainCategory: 'rock',
  }

  // Choose a random side for the corridor entrance: 0=left, 1=right, 2=top, 3=bottom
  const side = Math.floor(rng() * 4)
  let gateX: number
  let gateY: number
  let corridorDx: number
  let corridorDy: number

  switch (side) {
    case 0: // Left
      gateX = roomX
      gateY = roomY + Math.floor(roomH / 2)
      corridorDx = -1
      corridorDy = 0
      break
    case 1: // Right
      gateX = roomX + roomW - 1
      gateY = roomY + Math.floor(roomH / 2)
      corridorDx = 1
      corridorDy = 0
      break
    case 2: // Top
      gateX = roomX + Math.floor(roomW / 2)
      gateY = roomY
      corridorDx = 0
      corridorDy = -1
      break
    default: // Bottom
      gateX = roomX + Math.floor(roomW / 2)
      gateY = roomY + roomH - 1
      corridorDx = 0
      corridorDy = 1
      break
  }

  // Place QuizGate at the wall opening — exit gate requires multiple correct answers
  const factId = nextFactId()
  grid[gateY][gateX] = {
    type: BlockType.QuizGate,
    hardness: BALANCE.EXIT_GATE_QUESTIONS,
    maxHardness: BALANCE.EXIT_GATE_QUESTIONS,
    revealed: false,
    content: {
      factId,
    },
    baseTerrainCategory: 'rock',
  }

  // Carve a short corridor (1-2 blocks) outward from the gate
  const corridorLength = randomIntInclusive(rng, 1, 2)
  for (let i = 1; i <= corridorLength; i++) {
    const cx = gateX + corridorDx * i
    const cy = gateY + corridorDy * i
    if (cx >= 0 && cx < gridWidth && cy >= 0 && cy < gridHeight) {
      grid[cy][cx] = {
        type: BlockType.Empty,
        hardness: 0,
        maxHardness: 0,
        revealed: false,
        baseTerrainCategory: 'rock',
      }
    }
  }
}

/**
 * Places natural-looking open cavern spaces throughout the mine.
 *
 * Each cavern is a rectangular area of BlockType.Empty cells with randomised
 * dimensions between EMPTY_CAVERN_MIN_SIZE and EMPTY_CAVERN_MAX_SIZE.  To
 * give the caverns an organic feel, each corner cell has a ~40% chance of
 * being skipped (left as its original block type).
 *
 * Placement rules:
 *   - Must stay within the grid with a 1-cell margin on every edge
 *   - Must not overlap the 3×3 spawn clearance zone
 *   - Must maintain a 1-cell gap from every previously placed cavern
 *   - Up to 15 placement attempts are made per cavern before giving up
 *
 * @param grid       - The mine cell grid to carve into
 * @param rng        - Seeded random number generator
 * @param spawnX     - Player spawn column (centre of 3×3 clear zone)
 * @param spawnY     - Player spawn row (centre of 3×3 clear zone)
 * @param gridWidth  - Total grid columns
 * @param gridHeight - Total grid rows
 */
export function placeEmptyCaverns(
  grid: MineCell[][],
  rng: () => number,
  spawnX: number,
  spawnY: number,
  gridWidth: number,
  gridHeight: number,
): void {
  /** Bounding boxes of already-placed caverns (1-cell gap enforced). */
  const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = []

  /** Returns true when the candidate box overlaps the spawn 3×3 zone. */
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

  /** Returns true when the candidate box overlaps any already-placed cavern (1-cell gap). */
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

  const EDGE_MARGIN = 1
  const CORNER_SKIP_CHANCE = 0.4
  const MAX_ATTEMPTS = 15

  for (let i = 0; i < BALANCE.EMPTY_CAVERN_COUNT; i++) {
    const cavW = randomIntInclusive(rng, BALANCE.EMPTY_CAVERN_MIN_SIZE, BALANCE.EMPTY_CAVERN_MAX_SIZE)
    const cavH = randomIntInclusive(rng, BALANCE.EMPTY_CAVERN_MIN_SIZE, BALANCE.EMPTY_CAVERN_MAX_SIZE)

    const minX = EDGE_MARGIN
    const maxX = gridWidth - cavW - EDGE_MARGIN
    const minY = EDGE_MARGIN + 2  // Stay below the guaranteed top-2 empty rows
    const maxY = gridHeight - cavH - EDGE_MARGIN

    if (maxX < minX || maxY < minY) {
      // Grid too small — burn two RNG calls (for width + height) to keep sequence stable
      rng()
      rng()
      continue
    }

    let placed = false
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = randomIntInclusive(rng, minX, maxX)
      const cy = randomIntInclusive(rng, minY, maxY)

      if (overlapsSpawn(cx, cy, cavW, cavH)) continue
      if (overlapsPlaced(cx, cy, cavW, cavH)) continue

      // Carve the cavern, optionally skipping corners for organic shape
      for (let dy = 0; dy < cavH; dy++) {
        for (let dx = 0; dx < cavW; dx++) {
          const isCorner =
            (dx === 0 || dx === cavW - 1) &&
            (dy === 0 || dy === cavH - 1)

          if (isCorner && rng() < CORNER_SKIP_CHANCE) {
            // Leave the existing block in place — organic edge
            continue
          }

          grid[cy + dy][cx + dx] = {
            type: BlockType.Empty,
            hardness: 0,
            maxHardness: 0,
            revealed: false,
            baseTerrainCategory: 'rock',
          }
        }
      }

      placedBoxes.push({ x: cx, y: cy, w: cavW, h: cavH })
      placed = true
      break
    }

    if (!placed) {
      // Burn one RNG call to keep the sequence stable regardless of placement success
      rng()
    }
  }
}

/**
 * Places QuoteStone blocks scattered through the mine.
 * These are ancient inscribed stones that display lore text when broken.
 * Placement respects the minimum depth constraint and avoids overwriting other special blocks.
 */
export function placeQuoteStones(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
): void {
  const minDepth = BALANCE.QUOTE_STONE_MIN_DEPTH
  // Build a sub-pool of positions at or below the minimum depth
  const eligiblePositions = positions.filter(p => p.y >= minDepth)

  const count = Math.min(BALANCE.QUOTE_STONE_COUNT, eligiblePositions.length)
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * eligiblePositions.length)
    const [position] = eligiblePositions.splice(randomIndex, 1)
    // Also remove from the main positions array to avoid overlap with other special blocks
    const mainIdx = positions.findIndex(p => p.x === position.x && p.y === position.y)
    if (mainIdx !== -1) positions.splice(mainIdx, 1)

    const hardness = 2
    grid[position.y][position.x] = {
      type: BlockType.QuoteStone,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: { factId: QUOTE_STONES[Math.floor(rng() * QUOTE_STONES.length)].id },
      baseTerrainCategory: 'rock',
    }
  }
}

export function placeRelicShrines(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = BALANCE.RELIC_SHRINE_MIN_DEPTH
  // Build a sub-pool of positions deep enough for shrine placement
  const deepPositions = positions.filter(p => p.y >= minDepth)

  const count = Math.min(BALANCE.RELIC_SHRINE_COUNT, deepPositions.length)
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [position] = deepPositions.splice(randomIndex, 1)
    // Also remove from the main positions array to keep it consistent
    const mainIdx = positions.findIndex(p => p.x === position.x && p.y === position.y)
    if (mainIdx !== -1) positions.splice(mainIdx, 1)

    const hardness = 2
    grid[position.y][position.x] = {
      type: BlockType.RelicShrine,
      hardness,
      maxHardness: hardness,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
  }
}

/**
 * Places rare OxygenTank permanent-upgrade blocks in the lower portion of the mine.
 * Only spawns OXYGEN_TANK_COUNT (1) per mine, always below OXYGEN_TANK_MIN_DEPTH_PERCENT depth.
 * Hardness 3 — encased in hard rock, requires effort to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
export function placeOxygenTanks(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.OXYGEN_TANK_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.OXYGEN_TANK_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = 3
    grid[pos.y][pos.x] = {
      type: BlockType.OxygenTank,
      hardness,
      maxHardness: hardness,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
  }
}

/**
 * Places Data Disc collectible blocks in the lower portion of the mine.
 * Only spawns DATA_DISC_COUNT (1) per mine, always below DATA_DISC_MIN_DEPTH_PERCENT depth.
 * Hardness 2 — accessible but not trivial to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
export function placeDataDiscs(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.DATA_DISC_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.DATA_DISC_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = 2
    grid[pos.y][pos.x] = {
      type: BlockType.DataDisc,
      hardness,
      maxHardness: hardness,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
  }
}

/**
 * Places FossilNode blocks in the lower portion of the mine.
 * Only spawns FOSSIL_NODE_COUNT (2) per mine, always below FOSSIL_NODE_MIN_DEPTH_PERCENT depth.
 * Hardness FOSSIL_HARDNESS — requires effort to unearth.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
export function placeFossilNodes(
  grid: MineCell[][],
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
  height: number,
): void {
  const minDepth = Math.floor(height * BALANCE.FOSSIL_NODE_MIN_DEPTH_PERCENT)

  // Filter the shared position pool to only deep cells.
  const deepPositions = positions.filter(p => p.y >= minDepth)

  if (deepPositions.length === 0) return

  const count = Math.min(BALANCE.FOSSIL_NODE_COUNT, deepPositions.length)

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * deepPositions.length)
    const [pos] = deepPositions.splice(randomIndex, 1)

    // Also remove from the master positions pool to prevent future overlap.
    const masterIndex = positions.findIndex(p => p.x === pos.x && p.y === pos.y)
    if (masterIndex !== -1) {
      positions.splice(masterIndex, 1)
    }

    const hardness = BALANCE.FOSSIL_HARDNESS
    grid[pos.y][pos.x] = {
      type: BlockType.FossilNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
  }
}

/**
 * Replaces eligible base blocks at sufficient depth with hazard blocks.
 * LavaBlock appears below LAVA_MIN_DEPTH_PERCENT; GasPocket below GAS_POCKET_MIN_DEPTH_PERCENT.
 * UnstableGround appears below UNSTABLE_GROUND_MIN_DEPTH_PERCENT — crumbles easily (hardness 1)
 * and triggers a cave-in when broken, collapsing nearby blocks.
 * Only Dirt, SoftRock, Stone, and HardRock cells are eligible for replacement.
 * Called after all special block and room placement so hazards don't overwrite exits or items.
 * Biome hazardMultipliers scale each hazard's density independently.
 */
export function placeHazards(grid: MineCell[][], rng: () => number, height: number, biome: Biome, layer = 0, hazardScalar = 1.0): void {
  const eligibleBaseTypes = new Set<BlockType>([
    BlockType.Dirt,
    BlockType.SoftRock,
    BlockType.Stone,
    BlockType.HardRock,
  ])

  // Apply biome multipliers, per-layer density scaling, and optional auto-balance scalar.
  const layerHazardMultiplier = HAZARD_DENSITY_BY_LAYER[(layer + 1)] ?? 1.0  // layer is 0-based, map is 1-based
  const lavaDensity = BALANCE.LAVA_DENSITY * biome.hazardMultipliers.lava * layerHazardMultiplier * hazardScalar
  const gasDensity = BALANCE.GAS_POCKET_DENSITY * biome.hazardMultipliers.gas * layerHazardMultiplier * hazardScalar
  const unstableDensity = BALANCE.UNSTABLE_GROUND_DENSITY * biome.hazardMultipliers.unstable * layerHazardMultiplier * hazardScalar

  for (let y = 0; y < height; y++) {
    const depthRatio = y / height
    const lavaEligible = depthRatio >= BALANCE.LAVA_MIN_DEPTH_PERCENT
    const gasEligible = depthRatio >= BALANCE.GAS_POCKET_MIN_DEPTH_PERCENT
    const unstableEligible = depthRatio >= BALANCE.UNSTABLE_GROUND_MIN_DEPTH_PERCENT

    if (!lavaEligible && !gasEligible && !unstableEligible) continue

    const row = grid[y]
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!eligibleBaseTypes.has(cell.type)) continue

      if (lavaEligible && rng() < lavaDensity) {
        row[x] = {
          type: BlockType.LavaBlock,
          hardness: 2,
          maxHardness: 2,
          revealed: false,
          baseTerrainCategory: 'rock',
        }
      } else if (gasEligible && rng() < gasDensity) {
        row[x] = {
          type: BlockType.GasPocket,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
          baseTerrainCategory: 'rock',
        }
      } else if (unstableEligible && rng() < unstableDensity) {
        row[x] = {
          type: BlockType.UnstableGround,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
          baseTerrainCategory: 'rock',
        }
      }
    }
  }
}

/**
 * Places a single DescentShaft block anywhere in the mine grid (not restricted to bottom half).
 * The shaft is placed at a random position that does not overlap special blocks or the spawn area.
 * Falls back gracefully if no valid position can be found after multiple attempts.
 */
export function placeDescentShaft(
  grid: MineCell[][],
  rng: () => number,
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
): void {
  const minY = 3  // Avoid the very top rows (spawn area)
  const maxY = Math.floor(height * 0.95)
  const minX = 1
  const maxX = width - 2

  if (maxY < minY || maxX < minX) return

  const specialTypes = new Set<BlockType>([
    BlockType.ExitLadder,
    BlockType.OxygenCache,
    BlockType.UpgradeCrate,
    BlockType.QuizGate,
    BlockType.ArtifactNode,
    BlockType.MineralNode,
    BlockType.Unbreakable,
    BlockType.LavaBlock,
    BlockType.GasPocket,
  ])

  for (let attempt = 0; attempt < 30; attempt++) {
    const sx = randomIntInclusive(rng, minX, maxX)
    const sy = randomIntInclusive(rng, minY, maxY)

    // Avoid spawn area
    if (Math.abs(sx - spawnX) <= 1 && Math.abs(sy - spawnY) <= 1) continue
    // Avoid special blocks
    if (specialTypes.has(grid[sy][sx].type)) continue

    grid[sy][sx] = {
      type: BlockType.DescentShaft,
      hardness: 1,
      maxHardness: 1,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
    return
  }
  // If no valid position found after all attempts, silently skip placement.
}

/**
 * Places a single SendUpStation block in the middle third of the mine grid (rows 33%-66%).
 * The station is placed at a random position that does not overlap special blocks or the spawn area.
 * Falls back gracefully if no valid position can be found after multiple attempts.
 */
export function placeSendUpStation(
  grid: MineCell[][],
  rng: () => number,
  width: number,
  height: number,
  spawnX: number,
  spawnY: number,
): void {
  const minY = Math.floor(height * 0.33)
  const maxY = Math.floor(height * 0.66)
  const minX = 1
  const maxX = width - 2

  if (maxY < minY || maxX < minX) return

  const specialTypes = new Set<BlockType>([
    BlockType.ExitLadder,
    BlockType.OxygenCache,
    BlockType.UpgradeCrate,
    BlockType.QuizGate,
    BlockType.ArtifactNode,
    BlockType.MineralNode,
    BlockType.Unbreakable,
    BlockType.LavaBlock,
    BlockType.GasPocket,
    BlockType.DescentShaft,
  ])

  for (let attempt = 0; attempt < 30; attempt++) {
    const sx = randomIntInclusive(rng, minX, maxX)
    const sy = randomIntInclusive(rng, minY, maxY)

    // Avoid spawn area
    if (Math.abs(sx - spawnX) <= 1 && Math.abs(sy - spawnY) <= 1) continue
    // Avoid special blocks
    if (specialTypes.has(grid[sy][sx].type)) continue

    grid[sy][sx] = {
      type: BlockType.SendUpStation,
      hardness: 1,
      maxHardness: 1,
      revealed: false,
      baseTerrainCategory: 'rock',
    }
    return
  }
  // If no valid position found after all attempts, silently skip placement.
}
