import { BALANCE, getLayerGridSize } from '../../data/balance'
import { BlockType, type MineCell, type Rarity } from '../../data/types'
import { type Biome, DEFAULT_BIOME } from '../../data/biomes'
import { LANDMARK_LAYERS, LANDMARK_TEMPLATES, getLandmarkIdForLayer, type LandmarkTemplate } from '../../data/landmarks'

/**
 * Creates a deterministic pseudo-random number generator from a numeric seed.
 * Uses the mulberry32 algorithm and returns values in the range [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0

  return (): number => {
    t += 0x6d2b79f5
    let n = Math.imul(t ^ (t >>> 15), t | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Linear interpolation clamped to [0, 1].
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Returns depth-based block weight overrides for each layer (0-indexed, 0-19).
 * Used to add HardRock, MineralNode, ArtifactNode, and FossilNode into the distribution
 * as the player descends — replacing the fixed density-only approach for base blocks.
 * (DD-V2-054)
 */
function getBlockWeightsForLayer(layer: number): {
  dirt: number; softRock: number; stone: number; hardRock: number;
  mineralNode: number; artifactNode: number; fossilNode: number;
} {
  const depth = layer / 19  // 0.0 at layer 0, 1.0 at layer 19
  return {
    dirt:        lerp(0.35, 0.02, depth),
    softRock:    lerp(0.20, 0.08, depth),
    stone:       lerp(0.25, 0.20, depth),
    hardRock:    lerp(0.00, 0.35, depth),
    mineralNode: layer <= 12 ? lerp(0.05, 0.08, depth) : lerp(0.08, 0.04, (layer - 12) / 7),
    artifactNode: lerp(0.01, 0.06, depth),
    fossilNode:  lerp(0.01, 0.03, depth),
  };
}

/**
 * Stamps a landmark template into the center of the mine grid.
 * Returns the resolved spawn (S) position.
 * All ASCII characters map to BlockType values; 'S' becomes Empty and records spawn coords.
 * (DD-V2-055)
 */
function stampLandmark(
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
 * Generates a mine grid using deterministic procedural rules.
 * @param seed - Deterministic seed for this layer.
 * @param facts - Fact IDs to assign to quiz/artifact blocks.
 * @param layer - Zero-based layer index (0-19). Grid size is derived from this.
 *                On non-final layers (layer < MAX_LAYERS - 1), places a DescentShaft.
 * @param biome - Optional biome definition that overrides block weights, hazard densities, and visuals.
 *                Defaults to the sedimentary biome if not provided.
 */
export function generateMine(
  seed: number,
  facts: string[],
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome } {
  const oneIndexedLayer = layer + 1  // layer is 0-based internally, convert to 1-based for getLayerGridSize
  const [width, height] = getLayerGridSize(oneIndexedLayer)
  const rng = seededRandom(seed)
  const grid: MineCell[][] = []

  // Per-layer hardness multiplier: each layer is LAYER_HARDNESS_SCALE^layer harder.
  const hardnessScale = Math.pow(BALANCE.LAYER_HARDNESS_SCALE, layer)

  // Depth-based block weights for this layer (used to inject HardRock into base block distribution).
  const layerWeights = getBlockWeightsForLayer(layer)

  for (let y = 0; y < height; y++) {
    const row: MineCell[] = []
    const depthWeights = getDepthWeights(y, height, biome, layerWeights)
    const depthWeightTotal = depthWeights.reduce((sum, entry) => sum + entry.weight, 0)

    for (let x = 0; x < width; x++) {
      const type = y < 2 ? BlockType.Empty : pickBaseBlock(rng, depthWeights, depthWeightTotal)
      const baseHardness = getHardness(type)
      // Scale hardness by layer depth (round up, minimum 1 for breakable blocks, preserve 0 and 999).
      const hardness = baseHardness > 0 && baseHardness < 999
        ? Math.max(1, Math.round(baseHardness * hardnessScale))
        : baseHardness

      row.push({
        type,
        hardness,
        maxHardness: hardness,
        revealed: false,
      })
    }

    grid.push(row)
  }

  // Landmark layer check — stamps a pre-designed template instead of procedural generation (DD-V2-055)
  const landmarkId = getLandmarkIdForLayer(oneIndexedLayer)
  if (landmarkId) {
    const template = LANDMARK_TEMPLATES[landmarkId]
    const { spawnX: lSpawnX, spawnY: lSpawnY } = stampLandmark(template, grid, width, height)
    // Reveal spawn area
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = lSpawnX + dx
        const cy = lSpawnY + dy
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          grid[cy][cx].revealed = true
        }
      }
    }
    return { grid, spawnX: lSpawnX, spawnY: lSpawnY, biome }
  }

  // Layer 1 spawn (layer === 0): top-center, 3x3 clear area.
  // Layer 2+ (layer >= 1): random position inside the grid (spawn area cleared below).
  let spawnX: number
  let spawnY: number
  if (layer === 0) {
    spawnX = Math.floor(width / 2)
    spawnY = 1
    // Clear 3x3 around spawn
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = spawnX + dx
        const cy = spawnY + dy
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          grid[cy][cx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: false }
        }
      }
    }
  } else {
    // For layers 2+: pick a random empty cell far from the descent shaft position.
    // Since shaft is placed later, pick a random position inside the grid avoiding edges.
    spawnX = 2 + Math.floor(rng() * (width - 4))
    spawnY = 2 + Math.floor(rng() * (height - 8))
  }

  const positions = buildSpecialPositionPool(width, height)
  let factCursor = 0

  const nextFactId = (): string | undefined => {
    if (facts.length === 0) {
      return undefined
    }

    const factId = facts[factCursor % facts.length]
    factCursor += 1
    return factId
  }

  // Apply biome mineral multiplier: scale the node count and round to nearest int.
  const mineralNodeCount = Math.max(1, Math.round(BALANCE.DENSITY_MINERAL_NODES * biome.mineralMultiplier))

  placeSpecialBlocks(grid, positions, mineralNodeCount, rng, () => {
    const hardness = BALANCE.HARDNESS_MINERAL_NODE
    const mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_DROP_MIN, BALANCE.MINERAL_DROP_MAX)
    return {
      type: BlockType.MineralNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        mineralType: 'dust',
        mineralAmount,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_ARTIFACT_NODES, rng, () => {
    const hardness = BALANCE.HARDNESS_ARTIFACT_NODE
    return {
      type: BlockType.ArtifactNode,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        artifactRarity: pickRarity(rng),
        factId: nextFactId(),
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_OXYGEN_CACHES, rng, () => {
    const hardness = 2
    return {
      type: BlockType.OxygenCache,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        oxygenAmount: BALANCE.OXYGEN_CACHE_RESTORE,
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_QUIZ_GATES, rng, () => {
    const hardness = BALANCE.HARDNESS_QUIZ_GATE
    return {
      type: BlockType.QuizGate,
      hardness,
      maxHardness: hardness,
      revealed: false,
      content: {
        factId: nextFactId(),
      },
    }
  })

  placeSpecialBlocks(grid, positions, BALANCE.DENSITY_UPGRADE_CRATES, rng, () => {
    const hardness = 2
    return {
      type: BlockType.UpgradeCrate,
      hardness,
      maxHardness: hardness,
      revealed: false,
    }
  })

  placeRelicShrines(grid, positions, rng, height)

  placeQuoteStones(grid, positions, rng)

  // Depth-adjust mineral amounts: deeper nodes yield more
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type === BlockType.MineralNode && cell.content?.mineralAmount) {
        const depthMultiplier = 1 + (y / height) * 0.8  // 1.0x at top, 1.8x at bottom
        cell.content.mineralAmount = Math.round(cell.content.mineralAmount * depthMultiplier)
      }
    }
  }

  // Depth-based mineral tier assignment: deeper nodes may yield rarer minerals.
  // Priority order (highest wins): essence → geode → crystal → shard → dust
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type === BlockType.MineralNode && cell.content) {
        const depthRatio = y / height
        if (depthRatio >= BALANCE.MINERAL_ESSENCE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_ESSENCE_CHANCE) {
          cell.content.mineralType = 'essence'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_ESSENCE_DROP_MIN, BALANCE.MINERAL_ESSENCE_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_GEODE_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_GEODE_CHANCE) {
          cell.content.mineralType = 'geode'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_GEODE_DROP_MIN, BALANCE.MINERAL_GEODE_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_CRYSTAL_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_CRYSTAL_CHANCE) {
          cell.content.mineralType = 'crystal'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_CRYSTAL_DROP_MIN, BALANCE.MINERAL_CRYSTAL_DROP_MAX)
        } else if (depthRatio >= BALANCE.MINERAL_SHARD_DEPTH_THRESHOLD && rng() < BALANCE.MINERAL_SHARD_CHANCE) {
          cell.content.mineralType = 'shard'
          cell.content.mineralAmount = randomIntInclusive(rng, BALANCE.MINERAL_SHARD_DROP_MIN, BALANCE.MINERAL_SHARD_DROP_MAX)
        }
      }
    }
  }

  placeMicroStructures(grid, rng, spawnX, spawnY, width, height, facts)

  placeEmptyPockets(grid, rng, BALANCE.DENSITY_EMPTY_POCKETS)

  placeEmptyCaverns(grid, rng, spawnX, spawnY, width, height)

  placeExitRoom(grid, width, height, rng, nextFactId, spawnX, spawnY)

  placeHazards(grid, rng, height, biome)

  placeOxygenTanks(grid, positions, rng, height)

  placeDataDiscs(grid, positions, rng, height)

  placeFossilNodes(grid, positions, rng, height)

  // Place DescentShaft only on non-final layers (in bottom half of the mine).
  if (layer < BALANCE.MAX_LAYERS - 1) {
    placeDescentShaft(grid, rng, width, height, spawnX, spawnY)
  }

  // Place SendUpStation only on non-final layers (in the middle third of the mine).
  if (layer < BALANCE.MAX_LAYERS - 1) {
    placeSendUpStation(grid, rng, width, height, spawnX, spawnY)
  }

  return { grid, spawnX, spawnY, biome }
}

/**
 * Flood-fills from (x, y) through all connected empty/open cells, marking them fully revealed.
 * Immediately adjacent solid blocks at the border are marked as silhouettes (visibilityLevel=1).
 * Cells at distance 2 from revealed space are marked faint (visibilityLevel=2) for scanner upgrades.
 * The radius parameter is ignored (kept for API compatibility).
 */
export function revealAround(grid: MineCell[][], x: number, y: number, _radius: number): void {
  if (grid.length === 0 || grid[0].length === 0) return

  const height = grid.length
  const width = grid[0].length

  // Flood-fill through empty/revealed space from the player's position
  const queue: Array<{ x: number; y: number }> = [{ x, y }]
  const visited = new Set<number>()
  visited.add(y * width + x)

  while (queue.length > 0) {
    const cur = queue.shift()!
    const cell = grid[cur.y][cur.x]
    cell.revealed = true
    cell.visibilityLevel = undefined

    // Spread to orthogonal neighbors that are empty (or already revealed open space)
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ]
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const key = n.y * width + n.x
      if (visited.has(key)) continue
      visited.add(key)
      const nCell = grid[n.y][n.x]
      // Continue flood-fill through empty cells and already-revealed cells
      if (nCell.type === BlockType.Empty || nCell.revealed) {
        queue.push(n)
      }
    }
  }

  // After flood-fill: mark direct border (adjacent solid blocks) as silhouette (visibilityLevel=1)
  for (const key of visited) {
    const cy = Math.floor(key / width)
    const cx = key % width
    const neighbors = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 },
    ]
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const nCell = grid[n.y][n.x]
      if (!nCell.revealed) {
        nCell.visibilityLevel = 1
      }
    }
  }

  // Mark second ring (distance-2 from revealed) as faint (visibilityLevel=2) for scanner upgrades
  for (const key of visited) {
    const cy = Math.floor(key / width)
    const cx = key % width
    const neighbors2 = [
      { x: cx + 2, y: cy },
      { x: cx - 2, y: cy },
      { x: cx, y: cy + 2 },
      { x: cx, y: cy - 2 },
      { x: cx + 1, y: cy + 1 },
      { x: cx + 1, y: cy - 1 },
      { x: cx - 1, y: cy + 1 },
      { x: cx - 1, y: cy - 1 },
    ]
    for (const n of neighbors2) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue
      const nCell = grid[n.y][n.x]
      if (!nCell.revealed && nCell.visibilityLevel === undefined) {
        nCell.visibilityLevel = 2
      }
    }
  }
}

/**
 * Selects an artifact rarity using weighted probabilities from balance config.
 */
export function pickRarity(rng: () => number): Rarity {
  const entries = Object.entries(BALANCE.ARTIFACT_RARITY_WEIGHTS) as Array<[Rarity, number]>
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  const roll = rng() * totalWeight

  let cumulative = 0
  for (const [rarity, weight] of entries) {
    cumulative += weight
    if (roll < cumulative) {
      return rarity
    }
  }

  return entries[entries.length - 1][0]
}

/**
 * Returns depth-scaled block weights for a given row, modified by the active biome and layer weights.
 * Shallow rows favour dirt; deep rows shift weight toward stone and hard rock.
 * Layer weights (from getBlockWeightsForLayer) scale the base per-row weights to reflect
 * depth progression across the full 20-layer mine, not just within a single layer.
 *
 * @param y - Current row index (0 = top of mine)
 * @param height - Total mine height in rows
 * @param biome - Active biome whose blockWeights multiply the base weights
 * @param layerWeights - Optional layer-level depth weights from getBlockWeightsForLayer
 */
function getDepthWeights(
  y: number,
  height: number,
  biome: Biome,
  layerWeights?: ReturnType<typeof getBlockWeightsForLayer>
): Array<{ type: BlockType; weight: number }> {
  const depthRatio = y / height  // 0.0 at top, ~1.0 at bottom

  // Dirt decreases with depth, hard rock increases (within-layer variation)
  const dirtWeight = Math.max(10, 55 - depthRatio * 50)
  const softRockWeight = 20
  const stoneWeight = 10 + depthRatio * 20
  const hardRockWeight = 5 + depthRatio * 25

  // Apply layer-level multipliers when provided (blend within-layer weights with cross-layer weights)
  const dirtFinal = layerWeights ? dirtWeight * (layerWeights.dirt / 0.35) : dirtWeight
  const softRockFinal = layerWeights ? softRockWeight * (layerWeights.softRock / 0.20) : softRockWeight
  const stoneFinal = layerWeights ? stoneWeight * (layerWeights.stone / 0.25) : stoneWeight
  const hardRockFinal = layerWeights ? hardRockWeight * Math.max(0.01, layerWeights.hardRock / 0.35) : hardRockWeight

  return [
    { type: BlockType.Dirt, weight: dirtFinal * biome.blockWeights.dirt },
    { type: BlockType.SoftRock, weight: softRockFinal * biome.blockWeights.softRock },
    { type: BlockType.Stone, weight: stoneFinal * biome.blockWeights.stone },
    { type: BlockType.HardRock, weight: hardRockFinal * biome.blockWeights.hardRock },
  ]
}

function pickBaseBlock(
  rng: () => number,
  weightedBaseBlocks: Array<{ type: BlockType; weight: number }>,
  baseWeightTotal: number
): BlockType {
  if (rng() < BALANCE.DENSITY_UNBREAKABLE_RATIO) {
    return BlockType.Unbreakable
  }

  const roll = rng() * baseWeightTotal
  let cumulative = 0

  for (const entry of weightedBaseBlocks) {
    cumulative += entry.weight
    if (roll < cumulative) {
      return entry.type
    }
  }

  return BlockType.HardRock
}

function getHardness(type: BlockType): number {
  switch (type) {
    case BlockType.Dirt:
      return BALANCE.HARDNESS_DIRT
    case BlockType.SoftRock:
      return BALANCE.HARDNESS_SOFT_ROCK
    case BlockType.Stone:
      return BALANCE.HARDNESS_STONE
    case BlockType.HardRock:
      return BALANCE.HARDNESS_HARD_ROCK
    case BlockType.MineralNode:
      return BALANCE.HARDNESS_MINERAL_NODE
    case BlockType.ArtifactNode:
      return BALANCE.HARDNESS_ARTIFACT_NODE
    case BlockType.QuizGate:
      return BALANCE.HARDNESS_QUIZ_GATE
    case BlockType.ExitLadder:
      return 0
    case BlockType.DescentShaft:
      return 1
    case BlockType.Chest:
      return 3
    case BlockType.Tablet:
      return 2
    case BlockType.Unbreakable:
      return 999
    default:
      return 0
  }
}

function buildSpecialPositionPool(width: number, height: number): Array<{ x: number; y: number }> {
  const pool: Array<{ x: number; y: number }> = []

  for (let y = 2; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      pool.push({ x, y })
    }
  }

  return pool
}

function placeSpecialBlocks(
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
    grid[position.y][position.x] = createCell()
  }
}

function placeEmptyPockets(grid: MineCell[][], rng: () => number, count: number): void {
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
function placeExitRoom(
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
      }
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
function placeMicroStructures(
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

        if (isOxygen) {
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
function placeEmptyCaverns(
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
 * Places RELIC_SHRINE_COUNT RelicShrine blocks in the mine at minimum depth RELIC_SHRINE_MIN_DEPTH.
 * Uses the shared position pool so shrines don't overlap other special blocks.
 * Falls back gracefully if the pool has no positions at the required depth.
 */
/**
 * Places QuoteStone blocks scattered through the mine.
 * These are ancient inscribed stones that display lore text when broken.
 * Placement respects the minimum depth constraint and avoids overwriting other special blocks.
 */
function placeQuoteStones(
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
    }
  }
}

function placeRelicShrines(
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
    }
  }
}

/**
 * Places rare OxygenTank permanent-upgrade blocks in the lower portion of the mine.
 * Only spawns OXYGEN_TANK_COUNT (1) per mine, always below OXYGEN_TANK_MIN_DEPTH_PERCENT depth.
 * Hardness 3 — encased in hard rock, requires effort to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeOxygenTanks(
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
    }
  }
}

/**
 * Places Data Disc collectible blocks in the lower portion of the mine.
 * Only spawns DATA_DISC_COUNT (1) per mine, always below DATA_DISC_MIN_DEPTH_PERCENT depth.
 * Hardness 2 — accessible but not trivial to reach.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeDataDiscs(
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
    }
  }
}

/**
 * Places FossilNode blocks in the lower portion of the mine.
 * Only spawns FOSSIL_NODE_COUNT (2) per mine, always below FOSSIL_NODE_MIN_DEPTH_PERCENT depth.
 * Hardness FOSSIL_HARDNESS — requires effort to unearth.
 * Uses the shared position pool to prevent overlap with other special blocks.
 */
function placeFossilNodes(
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
function placeHazards(grid: MineCell[][], rng: () => number, height: number, biome: Biome): void {
  const eligibleBaseTypes = new Set<BlockType>([
    BlockType.Dirt,
    BlockType.SoftRock,
    BlockType.Stone,
    BlockType.HardRock,
  ])

  // Apply biome multipliers to the base hazard densities.
  const lavaDensity = BALANCE.LAVA_DENSITY * biome.hazardMultipliers.lava
  const gasDensity = BALANCE.GAS_POCKET_DENSITY * biome.hazardMultipliers.gas
  const unstableDensity = BALANCE.UNSTABLE_GROUND_DENSITY * biome.hazardMultipliers.unstable

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
        }
      } else if (gasEligible && rng() < gasDensity) {
        row[x] = {
          type: BlockType.GasPocket,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
        }
      } else if (unstableEligible && rng() < unstableDensity) {
        row[x] = {
          type: BlockType.UnstableGround,
          hardness: 1,
          maxHardness: 1,
          revealed: false,
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
function placeDescentShaft(
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
function placeSendUpStation(
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
    }
    return
  }
  // If no valid position found after all attempts, silently skip placement.
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}
