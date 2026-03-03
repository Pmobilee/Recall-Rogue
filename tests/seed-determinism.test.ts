import { describe, it, expect } from 'vitest'
import { seededRandom, generateMine } from '../src/game/systems/MineGenerator'
import { BlockType } from '../src/data/types'
import { getLayerGridSize } from '../src/data/balance'

// ============================================================
// seededRandom — unit tests
// ============================================================

describe('seededRandom', () => {
  it('produces values in [0, 1)', () => {
    const rng = seededRandom(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces identical sequences for the same seed', () => {
    const seed = 12345
    const rng1 = seededRandom(seed)
    const rng2 = seededRandom(seed)
    const samples = 50
    const seq1 = Array.from({ length: samples }, () => rng1())
    const seq2 = Array.from({ length: samples }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = seededRandom(1)
    const rng2 = seededRandom(2)
    const seq1 = Array.from({ length: 20 }, () => rng1())
    const seq2 = Array.from({ length: 20 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })
})

// ============================================================
// generateMine — determinism across seeds × layers
// ============================================================

// Use non-landmark layers (0-indexed: 0=L1, 1=L2, 2=L3) to avoid early-return paths.
// Landmark layers are 0-indexed 4, 9, 14, 19 (1-indexed 5, 10, 15, 20).
const TEST_SEEDS = [0, 1337, 99999, 4294967295, 7]
const TEST_LAYERS = [0, 1, 2] // 0-indexed L1, L2, L3 — all non-landmark

describe('generateMine — determinism', () => {
  for (const seed of TEST_SEEDS) {
    for (const layer of TEST_LAYERS) {
      it(`seed=${seed} layer=${layer} produces identical output on two runs`, () => {
        const result1 = generateMine(seed, [], layer)
        const result2 = generateMine(seed, [], layer)

        // Grid dimensions must match between runs
        expect(result1.grid.length).toBe(result2.grid.length)
        expect(result1.grid[0].length).toBe(result2.grid[0].length)

        // Spawn position must match
        expect(result1.spawnX).toBe(result2.spawnX)
        expect(result1.spawnY).toBe(result2.spawnY)

        // Biome identity must match
        expect(result1.biome.id).toBe(result2.biome.id)

        // Every cell must be identical
        const height = result1.grid.length
        const width = result1.grid[0].length
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const c1 = result1.grid[y][x]
            const c2 = result2.grid[y][x]
            expect(c1.type, `cell [${y}][${x}] type`).toBe(c2.type)
            expect(c1.hardness, `cell [${y}][${x}] hardness`).toBe(c2.hardness)
            expect(c1.maxHardness, `cell [${y}][${x}] maxHardness`).toBe(c2.maxHardness)
          }
        }
      })
    }
  }
})

// ============================================================
// generateMine — grid dimension invariants
// ============================================================

describe('generateMine — grid dimensions', () => {
  // Expected sizes from getLayerGridSize (1-indexed):
  // L1-5 → 20×20, L6-10 → 25×25, L11-15 → 30×30, L16-20 → 40×40
  const layerSizeCases: Array<[number, number, number]> = [
    [0, 20, 20],  // 0-indexed L1 → 1-indexed L1 → 20×20
    [1, 20, 20],  // 0-indexed L2 → 1-indexed L2 → 20×20
    [4, 20, 20],  // 0-indexed L5 → 1-indexed L5 → 20×20 (landmark)
    [5, 25, 25],  // 0-indexed L6 → 1-indexed L6 → 25×25
    [9, 25, 25],  // 0-indexed L10 → 1-indexed L10 → 25×25 (landmark)
    [10, 30, 30], // 0-indexed L11 → 1-indexed L11 → 30×30
    [15, 40, 40], // 0-indexed L16 → 1-indexed L16 → 40×40
    [19, 40, 40], // 0-indexed L20 → 1-indexed L20 → 40×40 (landmark, final)
  ]

  for (const [layer, expectedW, expectedH] of layerSizeCases) {
    it(`layer ${layer} (1-indexed ${layer + 1}) produces a ${expectedW}×${expectedH} grid`, () => {
      const { grid } = generateMine(42, [], layer)
      expect(grid.length).toBe(expectedH)
      expect(grid[0].length).toBe(expectedW)

      // Cross-check against getLayerGridSize helper
      const [balanceW, balanceH] = getLayerGridSize(layer + 1)
      expect(grid.length).toBe(balanceH)
      expect(grid[0].length).toBe(balanceW)
    })
  }
})

// ============================================================
// generateMine — spawn position invariants
// ============================================================

describe('generateMine — spawn position', () => {
  it('layer 0 spawn is at top-center (y=1)', () => {
    // Layer 0 (L1): width=20, spawn is at center (x=10, y=1)
    const { spawnX, spawnY, grid } = generateMine(42, [], 0)
    const width = grid[0].length
    expect(spawnX).toBe(Math.floor(width / 2))
    expect(spawnY).toBe(1)
  })

  it('spawn position is within grid bounds', () => {
    const seeds = [1, 2, 3, 4, 5]
    for (const seed of seeds) {
      for (const layer of [0, 1, 2, 5, 6]) {
        const { spawnX, spawnY, grid } = generateMine(seed, [], layer)
        const height = grid.length
        const width = grid[0].length
        expect(spawnX, `seed=${seed} layer=${layer} spawnX`).toBeGreaterThanOrEqual(0)
        expect(spawnX, `seed=${seed} layer=${layer} spawnX`).toBeLessThan(width)
        expect(spawnY, `seed=${seed} layer=${layer} spawnY`).toBeGreaterThanOrEqual(0)
        expect(spawnY, `seed=${seed} layer=${layer} spawnY`).toBeLessThan(height)
      }
    }
  })
})

// ============================================================
// generateMine — descent shaft invariants
// ============================================================

describe('generateMine — descent shaft', () => {
  // Non-landmark, non-final layers should contain exactly one DescentShaft.
  // Landmark layers (0-indexed 4, 9, 14, 19) use stampLandmark which may or may not
  // include a shaft depending on the template; we skip them here.
  // Final layer (0-indexed 19) explicitly omits the shaft.
  const nonLandmarkNonFinalLayers = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13]

  for (const layer of nonLandmarkNonFinalLayers) {
    it(`layer ${layer} (1-indexed ${layer + 1}) contains at least one DescentShaft`, () => {
      const { grid } = generateMine(42, [], layer)
      let shaftCount = 0
      for (const row of grid) {
        for (const cell of row) {
          if (cell.type === BlockType.DescentShaft) shaftCount++
        }
      }
      expect(shaftCount, `layer ${layer} should have DescentShaft`).toBeGreaterThanOrEqual(1)
    })
  }

  it('final layer (0-indexed 19) has no DescentShaft', () => {
    // Layer 19 is the completion landmark; no shaft is placed.
    const { grid } = generateMine(42, [], 19)
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.type, 'final layer should not have DescentShaft').not.toBe(BlockType.DescentShaft)
      }
    }
  })
})

// ============================================================
// generateMine — no fully-isolated solid cells adjacent to spawn
// ============================================================

describe('generateMine — spawn area is clear', () => {
  it('spawn cell is always Empty or at least not a solid wall', () => {
    const solidTypes = new Set([
      BlockType.HardRock,
      BlockType.Stone,
      BlockType.SoftRock,
      BlockType.Dirt,
      BlockType.Unbreakable,
    ])
    for (const seed of TEST_SEEDS) {
      const { grid, spawnX, spawnY } = generateMine(seed, [], 0)
      const spawnCell = grid[spawnY][spawnX]
      expect(
        solidTypes.has(spawnCell.type),
        `seed=${seed}: spawn cell type ${spawnCell.type} should not be a solid wall`
      ).toBe(false)
    }
  })
})
