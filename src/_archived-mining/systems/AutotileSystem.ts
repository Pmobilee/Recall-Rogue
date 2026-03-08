// src/game/systems/AutotileSystem.ts

import { BlockType, type MineCell } from '../../data/types'
import type { BiomeId } from '../../data/biomes'
import { HERO_BIOME_IDS } from '../../data/biomeTileSpec'

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
 * Returns a value 0–15.
 */
export function computeBitmask(grid: MineCell[][], x: number, y: number): number {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  const myGroup = getAutotileGroup(grid[y][x].type)

  const matches = (nx: number, ny: number): boolean => {
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
      return true  // Out-of-bounds treated as same group
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
 * Returns the sprite key for a given autotile group and bitmask.
 */
export function bitmaskToSpriteKey(group: 'soil' | 'rock', mask: number): string {
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

// ─── 8-bit Blob Autotile (Phase 33.3) ─────────────────────────────────────────

/**
 * Standard blob tile: maps an 8-bit neighbor mask to one of 47 tile indices.
 * Bits: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
 * Corner bits (NE/SE/SW/NW) are set only when both adjacent cardinals are set.
 */
const BLOB_MASK_TO_INDEX: Record<number, number> = {
  0: 0, 2: 1, 8: 2, 10: 3, 11: 4, 16: 5, 18: 6, 22: 7, 24: 8, 26: 9,
  27: 10, 30: 11, 31: 12, 64: 13, 66: 14, 72: 15, 74: 16, 75: 17, 80: 18,
  82: 19, 86: 20, 88: 21, 90: 22, 91: 23, 94: 24, 95: 25, 104: 26, 106: 27,
  107: 28, 120: 29, 122: 30, 123: 31, 208: 32, 210: 33, 214: 34, 216: 35,
  218: 36, 219: 37, 222: 38, 223: 39, 248: 40, 250: 41, 251: 42, 254: 43,
  255: 44, 127: 45, 191: 46,
}

/**
 * Computes an 8-bit blob bitmask for a terrain cell.
 * Returns a value suitable for lookup in BLOB_MASK_TO_INDEX.
 *
 * Bits: bit0=N, bit1=NE, bit2=E, bit3=SE, bit4=S, bit5=SW, bit6=W, bit7=NW
 * Corner bits are set only when BOTH adjacent cardinal neighbors also match.
 */
export function computeBlobBitmask(grid: MineCell[][], x: number, y: number): number {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const myGroup = getAutotileGroup(grid[y][x].type)

  const matches = (nx: number, ny: number): boolean => {
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) return true
    return getAutotileGroup(grid[ny][nx].type) === myGroup
  }

  const N  = matches(x,     y - 1)
  const E  = matches(x + 1, y    )
  const S  = matches(x,     y + 1)
  const W  = matches(x - 1, y    )
  const NE = N && E && matches(x + 1, y - 1)
  const SE = S && E && matches(x + 1, y + 1)
  const SW = S && W && matches(x - 1, y + 1)
  const NW = N && W && matches(x - 1, y - 1)

  return (N ? 1 : 0) | (NE ? 2 : 0) | (E ? 4 : 0) | (SE ? 8 : 0)
       | (S ? 16 : 0) | (SW ? 32 : 0) | (W ? 64 : 0) | (NW ? 128 : 0)
}

/**
 * Converts an 8-bit blob bitmask to a blob tile index (0-46).
 * Falls back to index 0 for unmapped values.
 */
export function blobMaskToIndex(mask: number): number {
  return BLOB_MASK_TO_INDEX[mask] ?? 0
}

/**
 * Returns the sprite key for a blob tile.
 * Format: `{biomeId}_{group}_{index:02}` (up to index 46)
 */
export function blobTileSpriteKey(
  biomeId: BiomeId,
  group: 'soil' | 'rock',
  blobIndex: number,
): string {
  return `${biomeId}_${group}_${String(blobIndex).padStart(2, '0')}`
}

/**
 * Returns whether a biome uses blob47 autotiling.
 */
export function isBlobBiome(biomeId: BiomeId): boolean {
  return (HERO_BIOME_IDS as string[]).includes(biomeId)
}

/**
 * Computes and stores the tile variant for a cell.
 * Uses blob bitmask for hero biomes, standard 4-bit for others.
 * Stores the result in cell.tileVariant (repurposed as blobIndex for blob biomes).
 */
export function computeVariantForCell(
  grid: MineCell[][],
  x: number,
  y: number,
  biomeId: BiomeId,
): void {
  const cell = grid[y][x]
  if (!isAutotiledBlock(cell.type)) return
  if (isBlobBiome(biomeId)) {
    cell.tileVariant = blobMaskToIndex(computeBlobBitmask(grid, x, y))
  } else {
    cell.tileVariant = computeBitmask(grid, x, y)
  }
}

/**
 * Computes tileVariant for all cells in the grid.
 * Accepts optional biomeId for blob47 hero biome support.
 * Call after mine generation and after any block is destroyed.
 */
export function computeAllVariants(grid: MineCell[][], biomeId?: BiomeId): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (isAutotiledBlock(grid[y][x].type)) {
        if (biomeId) {
          computeVariantForCell(grid, x, y, biomeId)
        } else {
          grid[y][x].tileVariant = computeBitmask(grid, x, y)
        }
      }
    }
  }
}

/**
 * Recomputes tileVariant for a block and its immediate neighbors.
 * Accepts optional biomeId for blob47 hero biome support.
 * Call after a single block is mined/changed.
 */
export function invalidateNeighborVariants(
  grid: MineCell[][],
  cx: number,
  cy: number,
  biomeId?: BiomeId,
): void {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx
      const ny = cy + dy
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
        const cell = grid[ny][nx]
        if (isAutotiledBlock(cell.type)) {
          if (biomeId) {
            computeVariantForCell(grid, nx, ny, biomeId)
          } else {
            cell.tileVariant = computeBitmask(grid, nx, ny)
          }
        }
      }
    }
  }
}
