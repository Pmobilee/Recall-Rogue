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
 *
 * @param grid - The mine grid to checksum.
 * @returns A 32-bit unsigned integer.
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

// TODO: card-roguelite — removed mining dependency (verifyMineChecksum used generateMine from archived MineGenerator)
/**
 * Stubbed — mine generation is archived. Always returns false.
 */
export function verifyMineChecksum(
  _seed: number,
  _facts: string[],
  _layer: number,
  _biome: import('../../data/biomes').Biome,
  _expectedChecksum: number,
): boolean {
  return false
}
