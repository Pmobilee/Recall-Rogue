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

/** Descriptor for a placed anomaly zone. */
export interface AnomalyZone {
  x: number
  y: number
  width: number
  height: number
  type: AnomalyZoneType
}

/** The five anomaly zone types. */
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
  function makeCell(blockType: BlockType, extra?: Partial<MineCell>): MineCell {
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
            write(zx + dx, zy + dy, makeCell(BlockType.Empty))
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
          if (roll < 0.30) write(zx + dx, zy + dy, makeCell(BlockType.LavaBlock))
          else if (roll < 0.50) write(zx + dx, zy + dy, makeCell(BlockType.GasPocket))
          else write(zx + dx, zy + dy, makeCell(BlockType.Empty))
        }
      }
      break
    }
    case 'crystal_cluster': {
      // Diagonal crystal spires throughout the zone
      for (let dx = 0; dx < zw; dx += 2) {
        const spireH = 2 + Math.floor(rng() * Math.min(zh - 2, 5))
        for (let dy = zh - 1; dy >= zh - spireH; dy--) {
          write(zx + dx, zy + dy, makeCell(BlockType.MineralNode, { content: { mineralType: 'crystal', mineralAmount: 1 } }))
        }
      }
      break
    }
    case 'void_zone': {
      // Mostly empty with sparse mineral "islands"
      for (let dy = 0; dy < zh; dy++) {
        for (let dx = 0; dx < zw; dx++) {
          if (rng() < 0.08) {
            write(zx + dx, zy + dy, makeCell(BlockType.MineralNode, { content: { mineralType: 'geode', mineralAmount: 1 } }))
          } else {
            write(zx + dx, zy + dy, makeCell(BlockType.Empty))
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
            write(zx + dx, zy + dy, makeCell(BlockType.RelicShrine))
          } else if (isArtifact) {
            const h = BALANCE.HARDNESS_ARTIFACT_NODE
            write(zx + dx, zy + dy, { type: BlockType.ArtifactNode, hardness: h, maxHardness: h, revealed: false, content: { artifactRarity: 'legendary', factId: nextFact() } })
          } else if (isWall) {
            write(zx + dx, zy + dy, makeCell(BlockType.HardRock))
          } else {
            write(zx + dx, zy + dy, makeCell(BlockType.Empty))
          }
        }
      }
      break
    }
  }
}
