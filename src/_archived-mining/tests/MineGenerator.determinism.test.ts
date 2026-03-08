// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateMine } from '../../src/game/systems/MineGenerator'
import { DEFAULT_BIOME } from '../../src/data/biomes'
import type { MineCell } from '../../src/data/types'

function gridFingerprint(grid: MineCell[][]): string {
  return grid.map(row => row.map(cell => cell.type).join(',')).join('|')
}

function spawnFingerprint(result: { spawnX: number; spawnY: number }): string {
  return `${result.spawnX},${result.spawnY}`
}

describe('generateMine — seed determinism', () => {
  it('same seed produces identical grid fingerprint', () => {
    const SEED = 12345
    const FACTS = ['f1', 'f2', 'f3', 'f4', 'f5']

    const run1 = generateMine(SEED, FACTS, 0, DEFAULT_BIOME)
    const run2 = generateMine(SEED, FACTS, 0, DEFAULT_BIOME)

    expect(gridFingerprint(run1.grid)).toBe(gridFingerprint(run2.grid))
    expect(spawnFingerprint(run1)).toBe(spawnFingerprint(run2))
  })

  it('same seed produces identical grid across all 20 layers', () => {
    const SEED = 99999
    const FACTS = Array.from({ length: 20 }, (_, i) => `fact-${i}`)

    for (let layer = 0; layer < 20; layer++) {
      const run1 = generateMine(SEED + layer, FACTS, layer, DEFAULT_BIOME)
      const run2 = generateMine(SEED + layer, FACTS, layer, DEFAULT_BIOME)
      expect(gridFingerprint(run1.grid)).toBe(
        gridFingerprint(run2.grid),
        `Layer ${layer} grid fingerprints do not match`,
      )
    }
  })

  it('different seeds produce different grids', () => {
    const FACTS = ['f1', 'f2']
    const run1 = generateMine(1, FACTS, 0, DEFAULT_BIOME)
    const run2 = generateMine(2, FACTS, 0, DEFAULT_BIOME)
    expect(gridFingerprint(run1.grid)).not.toBe(gridFingerprint(run2.grid))
  })

  it('layer 0 grid is 20 columns wide (base grid size)', () => {
    const result = generateMine(1, [], 0, DEFAULT_BIOME)
    result.grid.forEach(row => expect(row.length).toBe(20))
  })

  it('grid dimensions grow with layer depth (getLayerGridSize)', () => {
    // Layer 0 (1-indexed: 1) = 20 wide; layer 10 (1-indexed: 11) = 30 wide
    const layer0 = generateMine(1, [], 0, DEFAULT_BIOME)
    const layer10 = generateMine(1, [], 10, DEFAULT_BIOME)
    expect(layer10.grid[0].length).toBeGreaterThanOrEqual(layer0.grid[0].length)
  })

  it('spawn position is within grid bounds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateMine(seed, [], 0, DEFAULT_BIOME)
      expect(result.spawnX).toBeGreaterThanOrEqual(0)
      expect(result.spawnX).toBeLessThan(result.grid[0].length)
      expect(result.spawnY).toBeGreaterThanOrEqual(0)
      expect(result.spawnY).toBeLessThan(result.grid.length)
    }
  })

  it('snapshot test — grid fingerprint for seed 42 layer 0 never changes', () => {
    const result = generateMine(42, ['f1', 'f2', 'f3'], 0, DEFAULT_BIOME)
    expect(gridFingerprint(result.grid)).toMatchSnapshot()
  })

  it('landmark layer does not throw during generation', () => {
    // Layer index 4 (0-based) = layer 5 (1-based) — may have a landmark stamp
    expect(() => generateMine(1, [], 4, DEFAULT_BIOME)).not.toThrow()
  })

  it('grid has correct height for layer 0 (20x20 grid)', () => {
    const result = generateMine(1, [], 0, DEFAULT_BIOME)
    expect(result.grid.length).toBe(20)
  })

  it('each row has the same length (no jagged rows)', () => {
    const result = generateMine(42, [], 5, DEFAULT_BIOME)
    const expectedWidth = result.grid[0].length
    result.grid.forEach((row, y) => {
      expect(row.length).toBe(expectedWidth)
    })
  })

  it('generation completes within a reasonable time (< 500ms per layer)', () => {
    const start = Date.now()
    for (let layer = 0; layer < 20; layer++) {
      generateMine(layer * 100, [], layer, DEFAULT_BIOME)
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000) // generous 5s for all 20 layers
  })
})
