/**
 * Pure utility functions for mine generation — RNG, block selection, rarity, and reveal logic.
 * Imported by MineGenerator.ts (barrel), MineRoomStamper.ts, and MinePlacementPasses.ts.
 */
/** SIZE BUDGET: Utilities — stay below 300 lines. */

import { BALANCE } from '../../data/balance'
import { BlockType, type MineCell, type Rarity } from '../../data/types'
import { type Biome } from '../../data/biomes'

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
export function getBlockWeightsForLayer(layer: number): {
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
 * Returns a blend of two biome blockWeights based on a 0.0–1.0 alpha.
 * alpha=0.0 → fully biomeA, alpha=1.0 → fully biomeB.
 */
export function blendBiomeWeights(
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
 * @param hardRockWeightMultiplier - Optional difficulty multiplier for HardRock density (Phase 49.7)
 */
export function getDepthWeights(
  y: number,
  height: number,
  biome: Biome,
  layerWeights?: ReturnType<typeof getBlockWeightsForLayer>,
  hardRockWeightMultiplier = 1.0,
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
  const hardRockFinal = layerWeights
    ? hardRockWeight * Math.max(0.01, layerWeights.hardRock / 0.35) * hardRockWeightMultiplier
    : hardRockWeight * hardRockWeightMultiplier

  return [
    { type: BlockType.Dirt, weight: dirtFinal * biome.blockWeights.dirt },
    { type: BlockType.SoftRock, weight: softRockFinal * biome.blockWeights.softRock },
    { type: BlockType.Stone, weight: stoneFinal * biome.blockWeights.stone },
    { type: BlockType.HardRock, weight: hardRockFinal * biome.blockWeights.hardRock },
  ]
}

export function pickBaseBlock(
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

/** @internal exported for use by AnomalyZoneSystem and other helpers */
export function getHardness(type: BlockType): number {
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

/** @internal exported for use by AnomalyZoneSystem and other helpers */
export function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}
