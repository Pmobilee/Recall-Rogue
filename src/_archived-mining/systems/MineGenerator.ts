/**
 * Core mine generation orchestrator. Calls sub-modules for utilities, room stamping,
 * and placement passes. Also serves as the barrel re-export point so all existing
 * import paths continue to work unchanged.
 */
/** SIZE BUDGET: Core orchestrator — stay below 500 lines. Extract new behavior to sub-files. */

import { BALANCE, getLayerGridSize } from '../../data/balance'
import { BlockType, type MineCell, type MineCellContent } from '../../data/types'
import { type Biome, DEFAULT_BIOME } from '../../data/biomes'
import { LANDMARK_TEMPLATES, getLandmarkIdForLayer } from '../../data/landmarks'
import { getFragmentsForLayer } from '../../data/recipeFragments'
import { injectAnomalyZones } from './AnomalyZoneSystem'
import type { EngagementData } from '../../services/engagementScorer'
import type { ArchetypeData } from '../../services/archetypeDetector'

import {
  seededRandom,
  getBlockWeightsForLayer,
  blendBiomeWeights,
  getDepthWeights,
  pickBaseBlock,
  getHardness,
  randomIntInclusive,
  pickRarity,
} from './MineGeneratorUtils'

import { stampLandmark, placeStructuralFeatures, placeMicroStructures } from './MineRoomStamper'

import {
  buildSpecialPositionPool,
  placeSpecialBlocks,
  placeEmptyPockets,
  placeExitRoom,
  placeEmptyCaverns,
  placeQuoteStones,
  placeRelicShrines,
  placeOxygenTanks,
  placeDataDiscs,
  placeFossilNodes,
  placeHazards,
  placeDescentShaft,
  placeSendUpStation,
} from './MinePlacementPasses'

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
  const score = Math.max(0, Math.min(100, engagementData.currentScore ?? 50))
  const normalized = (score - 50) / 50  // -1.0 to +1.0

  // Base difficulty scaling: ±20% from neutral
  const hardnessMult = 1.0 + normalized * BALANCE.DD_HARDNESS_SCALE
  const hazardMult   = 1.0 + normalized * BALANCE.DD_HAZARD_SCALE
  const oxygenMult   = 1.0 - normalized * BALANCE.DD_OXYGEN_SCALE  // less O2 when harder
  let anomalyMult  = 1.0 + normalized * 0.5

  // Archetype modifiers
  let hardRockMult = 1.0
  let mineralMult = 1.0
  const effectiveArchetype = archetypeData.manualOverride ?? archetypeData.detected
  if (effectiveArchetype === 'collector') {
    hardRockMult *= 1.1   // Collectors (miners) get extra HardRock as a reward
    mineralMult *= 1.2
  } else if (effectiveArchetype === 'explorer') {
    anomalyMult *= 1.15  // Explorers see more anomalies
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

/**
 * Marks cells within the transition band as `isTransitionZone = true`.
 * When a dual-biome layer is present, the band is centered on the vertical split (x = width/2).
 * Without a secondary biome, the existing layer-boundary marking logic is applied instead.
 * (DD-V2-235, Phase 49.2.2)
 *
 * @param grid - The mine grid to annotate.
 * @param hasDualBiome - True when a secondary biome was provided to generateMine.
 * @param transitionBandWidth - Width in columns of the dual-biome transition band.
 */
function flagTransitionZones(
  grid: MineCell[][],
  hasDualBiome: boolean,
  transitionBandWidth: number,
): void {
  const height = grid.length
  if (height === 0) return
  const width = grid[0].length

  if (hasDualBiome) {
    // Dual-biome mode: flag cells within halfBand columns of the vertical split.
    const splitX = Math.floor(width / 2)
    const halfBand = Math.ceil(transitionBandWidth / 2)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.abs(x - splitX) <= halfBand) {
          grid[y][x].isTransitionZone = true
        }
      }
    }
  } else {
    // Single-biome mode: flag top/bottom border rows as layer-boundary transition zones.
    const TRANSITION_DEPTH = 3
    for (let x = 0; x < width; x++) {
      for (let borderY = 0; borderY < TRANSITION_DEPTH; borderY++) {
        grid[borderY][x].isTransitionZone = true
        grid[height - 1 - borderY][x].isTransitionZone = true
      }
    }
  }
}

/**
 * Generates a mine grid using deterministic procedural rules.
 * @param seed - Deterministic seed for this layer.
 * @param facts - Fact IDs to assign to quiz/artifact blocks.
 * @param layer - Zero-based layer index (0-19). Grid size is derived from this.
 *                On non-final layers (layer < MAX_LAYERS - 1), places a DescentShaft.
 * @param biome - Optional biome definition that overrides block weights, hazard densities, and visuals.
 *                Defaults to the sedimentary biome if not provided.
 * @param secondaryBiome - Optional second biome for left/right blended layers (DD-V2-235).
 * @param transitionBandWidth - Width in columns of the blended transition zone (default 5).
 * @param difficultyProfile - Optional difficulty profile derived from player engagement data (Phase 49.7).
 */
export function generateMine(
  seed: number,
  facts: string[],
  layer = 0,
  biome: Biome = DEFAULT_BIOME,
  secondaryBiome?: Biome,
  transitionBandWidth = 5,
  difficultyProfile?: DifficultyProfile,
): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome, secondaryBiome?: Biome } {
  const oneIndexedLayer = layer + 1  // layer is 0-based internally, convert to 1-based for getLayerGridSize
  const [width, height] = getLayerGridSize(oneIndexedLayer)
  const rng = seededRandom(seed)
  const grid: MineCell[][] = []

  // Per-layer hardness multiplier: each layer is LAYER_HARDNESS_SCALE^layer harder.
  // Apply difficulty profile hardness adjustment on top.
  const hardnessScale = Math.pow(BALANCE.LAYER_HARDNESS_SCALE, layer)
    * (difficultyProfile?.hardnessMultiplier ?? 1.0)

  // Depth-based block weights for this layer (used to inject HardRock into base block distribution).
  const layerWeights = getBlockWeightsForLayer(layer)

  // Dual-biome transition support (49.2): compute split column and transition half-band.
  const splitX = Math.floor(width / 2)
  const halfBand = transitionBandWidth / 2

  for (let y = 0; y < height; y++) {
    const row: MineCell[] = []

    for (let x = 0; x < width; x++) {
      // Determine effective biome for this cell (blend if dual-biome layer)
      let effectiveBiome = biome
      if (secondaryBiome) {
        const distFromSplit = x - splitX  // negative = left side, positive = right side
        const alpha = Math.max(0, Math.min(1, (distFromSplit + halfBand) / transitionBandWidth))
        if (Math.abs(distFromSplit) <= halfBand) {
          // Transition zone: blend weights into a synthetic biome-like object
          const blended = blendBiomeWeights(biome, secondaryBiome, alpha)
          effectiveBiome = { ...biome, blockWeights: blended }
        } else if (distFromSplit > 0) {
          effectiveBiome = secondaryBiome
        }
      }

      const depthWeights = getDepthWeights(y, height, effectiveBiome, layerWeights, difficultyProfile?.hardRockWeightMultiplier)
      const depthWeightTotal = depthWeights.reduce((sum, entry) => sum + entry.weight, 0)

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
    return { grid, spawnX: lSpawnX, spawnY: lSpawnY, biome, secondaryBiome }
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

  // Phase 9.4: Place biome-specific structural features
  placeStructuralFeatures(grid, biome.id, rng, height, width)

  const positions = buildSpecialPositionPool(width, height)
  let factCursor = 0

  const nextFactId = (): string | undefined => {
    if (factCursor >= facts.length) return undefined
    return facts[factCursor++]
  }

  // Apply biome mineral multiplier and optional difficulty profile multiplier.
  const mineralNodeCount = Math.max(1, Math.round(
    BALANCE.DENSITY_MINERAL_NODES * biome.mineralMultiplier * (difficultyProfile?.mineralMultiplier ?? 1.0)
  ))

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

  // Apply optional difficulty profile oxygen cache multiplier.
  const oxygenCacheCount = Math.max(0, Math.round(
    BALANCE.DENSITY_OXYGEN_CACHES * (difficultyProfile?.oxygenCacheMultiplier ?? 1.0)
  ))
  placeSpecialBlocks(grid, positions, oxygenCacheCount, rng, () => {
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

  // ---- Phase 49.4: Anomaly zone injection ----
  // Must happen after structural features and micro-structures, before hazards.
  const anomalyFactCursorRef = { cursor: factCursor }
  injectAnomalyZones(grid, biome, rng, width, height, spawnX, spawnY, facts, anomalyFactCursorRef)
  factCursor = anomalyFactCursorRef.cursor

  placeEmptyPockets(grid, rng, BALANCE.DENSITY_EMPTY_POCKETS)

  placeEmptyCaverns(grid, rng, spawnX, spawnY, width, height)

  placeExitRoom(grid, width, height, rng, nextFactId, spawnX, spawnY)

  placeHazards(grid, rng, height, biome, layer, difficultyProfile?.hazardMultiplier ?? 1.0)

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

  // ---- Phase 35.1: Quiz gate scatter pass ----
  // Replace solid blocks below 15% depth with quiz gates at ~0.5% density.
  const minGateDepth = Math.floor(height * BALANCE.QUIZ_GATE_MIN_DEPTH_PERCENT)
  for (let y = minGateDepth; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (
        cell.type !== BlockType.Stone &&
        cell.type !== BlockType.SoftRock &&
        cell.type !== BlockType.Dirt
      ) continue
      if (rng() < BALANCE.QUIZ_GATE_DENSITY) {
        cell.type = BlockType.QuizGate
        cell.hardness = BALANCE.HARDNESS_QUIZ_GATE
        cell.maxHardness = BALANCE.HARDNESS_QUIZ_GATE
      }
    }
  }

  // ---- Phase 35.3: Offering altar on landmark layers ----
  const isLandmarkLayer = [5, 10, 15, 20].includes(oneIndexedLayer)
  if (isLandmarkLayer) {
    const altarY = Math.floor(height * 0.6) + Math.floor(rng() * Math.floor(height * 0.25))
    const altarX = Math.floor(width * 0.2) + Math.floor(rng() * Math.floor(width * 0.6))
    if (altarY < height && altarX < width) {
      grid[altarY][altarX] = {
        type: BlockType.OfferingAltar,
        hardness: 0,
        maxHardness: 0,
        revealed: false,
        altarUsed: false,
      }
    }
  }

  // ---- Phase 35.5: Recipe fragment nodes ----
  // At most one fragment node per layer; only on layers where eligible recipes exist.
  const eligibleRecipes = getFragmentsForLayer(oneIndexedLayer)
  if (eligibleRecipes.length > 0) {
    const fragMinDepth = Math.floor(height * 0.5)
    let fragPlaced = 0
    for (let y = fragMinDepth; y < height && fragPlaced < 1; y++) {
      for (let x = 0; x < width && fragPlaced < 1; x++) {
        const cell = grid[y][x]
        if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
        if (rng() < BALANCE.FRAGMENT_NODE_DENSITY) {
          const recipe = eligibleRecipes[Math.floor(rng() * eligibleRecipes.length)]
          cell.type = BlockType.RecipeFragmentNode
          cell.hardness = BALANCE.HARDNESS_RECIPE_FRAGMENT
          cell.maxHardness = BALANCE.HARDNESS_RECIPE_FRAGMENT
          cell.fragmentId = recipe.id
          fragPlaced++
        }
      }
    }
  }

  // ---- Phase 35.6: Conditionally breakable locked blocks ----
  // Replace hard rock / stone in the bottom 55% with locked blocks at ~1.2% density.
  const lockedMinDepth = Math.floor(height * BALANCE.LOCKED_BLOCK_MIN_DEPTH_PERCENT)
  const lockedTierWeights = BALANCE.LOCKED_BLOCK_TIER_WEIGHTS as ReadonlyArray<{ tier: number; weight: number }>
  const totalLockedWeight = lockedTierWeights.reduce((s, w) => s + w.weight, 0)
  for (let y = lockedMinDepth; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x]
      if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
      if (rng() < BALANCE.LOCKED_BLOCK_DENSITY) {
        const tierRoll = rng()
        let cumulative = 0
        let requiredTier = 1
        for (const { tier, weight } of lockedTierWeights) {
          cumulative += weight / totalLockedWeight
          if (tierRoll <= cumulative) { requiredTier = tier; break }
        }
        cell.type = BlockType.LockedBlock
        cell.hardness = BALANCE.LOCKED_BLOCK_HARDNESS
        cell.maxHardness = BALANCE.LOCKED_BLOCK_HARDNESS
        cell.requiredTier = requiredTier
      }
    }
  }

  // ---- Phase 48.4: Challenge Gate blocks ----
  // Spawn up to 2 ChallengeGate blocks per layer when oneIndexedLayer >= CHALLENGE_GATE_LAYER_THRESHOLD.
  if (oneIndexedLayer >= BALANCE.CHALLENGE_GATE_LAYER_THRESHOLD) {
    let gatesPlaced = 0
    const gateMinDepth = Math.floor(height * 0.3)
    for (let y = gateMinDepth; y < height && gatesPlaced < 2; y++) {
      for (let x = 0; x < width && gatesPlaced < 2; x++) {
        const cell = grid[y][x]
        if (cell.type !== BlockType.Stone && cell.type !== BlockType.HardRock) continue
        // ~2% density per eligible cell, capped at 2 per layer
        if (rng() < 0.02) {
          cell.type = BlockType.ChallengeGate
          cell.hardness = 3
          cell.maxHardness = 3
          gatesPlaced++
        }
      }
    }
  }

  flagTransitionZones(grid, !!secondaryBiome, transitionBandWidth)

  return { grid, spawnX, spawnY, biome, secondaryBiome }
}

/**
 * Returns a fully hand-authored tutorial mine grid.
 * The layout is deterministic — no seeded RNG is used.
 * All special block positions are exact and documented in PHASE-14-ONBOARDING-TUTORIAL.md.
 */
export function generateTutorialMine(): { grid: MineCell[][], spawnX: number, spawnY: number, biome: Biome } {
  const WIDTH = 20
  const HEIGHT = 20
  // Build a 20×20 grid of Dirt by default
  const grid: MineCell[][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => ({
      type: BlockType.Dirt,
      hardness: BALANCE.HARDNESS_DIRT,
      maxHardness: BALANCE.HARDNESS_DIRT,
      revealed: false,
    }))
  )

  // Helper: set a specific cell
  function set(x: number, y: number, type: BlockType, hardness: number, content?: MineCellContent) {
    grid[y][x] = { type, hardness, maxHardness: hardness, revealed: false, content } as MineCell
  }

  // Border: Unbreakable
  for (let x = 0; x < WIDTH; x++) {
    set(x, 0, BlockType.Unbreakable, 999)
    set(x, HEIGHT - 1, BlockType.Unbreakable, 999)
  }
  for (let y = 0; y < HEIGHT; y++) {
    set(0, y, BlockType.Unbreakable, 999)
    set(WIDTH - 1, y, BlockType.Unbreakable, 999)
  }

  // Spawn area (y=1–2): Empty
  for (let x = 1; x < WIDTH - 1; x++) {
    set(x, 1, BlockType.Empty, 0)
    set(x, 2, BlockType.Empty, 0)
  }

  // Rows y=10–16: SoftRock base
  for (let y = 10; y <= 16; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.SoftRock, BALANCE.HARDNESS_SOFT_ROCK)
    }
  }

  // Rows y=17–18: Stone
  for (let y = 17; y <= 18; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.Stone, BALANCE.HARDNESS_STONE)
    }
  }

  // Special blocks (dirt zone)
  set(3, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(17, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(9, 6, BlockType.ArtifactNode, 2) // Tutorial artifact — low hardness for quick access
  set(6, 8, BlockType.OxygenCache, 2)

  // Special blocks (soft rock zone)
  set(3, 12, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE)
  set(12, 13, BlockType.QuizGate, BALANCE.HARDNESS_QUIZ_GATE)

  // Earthquake tutorial zone: 3×3 UnstableGround at (3–5, 14–16)
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      set(3 + dx, 14 + dy, BlockType.UnstableGround, 1)
    }
  }
  // Pre-cleared cell inside (draws player in)
  set(4, 15, BlockType.Empty, 0)

  // Fossil node (accessible without touching UnstableGround)
  set(7, 15, BlockType.FossilNode, 2)

  // Upgrade crate
  set(16, 15, BlockType.UpgradeCrate, 2)

  return { grid, spawnX: 10, spawnY: 1, biome: DEFAULT_BIOME }
}

// Barrel re-exports — maintain backward compatibility for all callers
export { seededRandom, pickRarity, getHardness, randomIntInclusive, revealAround } from './MineGeneratorUtils'
