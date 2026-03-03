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

/**
 * Computes tileVariant for all cells in the grid.
 * Call after mine generation and after any block is destroyed.
 */
export function computeAllVariants(grid: MineCell[][]): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (isAutotiledBlock(grid[y][x].type)) {
        grid[y][x].tileVariant = computeBitmask(grid, x, y)
      }
    }
  }
}

/**
 * Recomputes tileVariant for a block and its immediate neighbors.
 * Call after a single block is mined/changed.
 */
export function invalidateNeighborVariants(grid: MineCell[][], cx: number, cy: number): void {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx
      const ny = cy + dy
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
        const cell = grid[ny][nx]
        if (isAutotiledBlock(cell.type)) {
          cell.tileVariant = computeBitmask(grid, nx, ny)
        }
      }
    }
  }
}
