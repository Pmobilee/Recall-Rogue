// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  BALANCE,
  QUIZ_BASE_RATE,
  QUIZ_COOLDOWN_BLOCKS,
  QUIZ_FIRST_TRIGGER_AFTER_BLOCKS,
  SM2_SECOND_INTERVAL_DAYS,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
  getO2DepthMultiplier,
  getLayerGridSize,
} from '../../src/data/balance'

describe('BALANCE constants — regression guard', () => {
  it('oxygen costs have not changed', () => {
    expect(BALANCE.OXYGEN_COST_MINE_DIRT).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_SOFT_ROCK).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_STONE).toMatchSnapshot()
    expect(BALANCE.OXYGEN_COST_MINE_HARD_ROCK).toMatchSnapshot()
  })

  it('SM-2 ease constants have not changed', () => {
    expect(BALANCE.SM2_INITIAL_EASE).toMatchSnapshot()
    expect(BALANCE.SM2_MIN_EASE).toMatchSnapshot()
  })

  it('quiz rate constants have not changed', () => {
    expect(QUIZ_BASE_RATE).toMatchSnapshot()
    expect(QUIZ_COOLDOWN_BLOCKS).toMatchSnapshot()
  })

  it('MAX_LAYERS is 20', () => {
    expect(BALANCE.MAX_LAYERS).toBe(20)
  })

  it('artifact rarity weights sum to 100', () => {
    const weights = BALANCE.ARTIFACT_RARITY_WEIGHTS
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0)
    expect(total).toBeCloseTo(100, 1)
  })

  it('SM2_SECOND_INTERVAL_DAYS is 3 (tuned from SM-2 default of 6)', () => {
    expect(SM2_SECOND_INTERVAL_DAYS).toBe(3)
  })

  it('SM2_MASTERY_INTERVAL_GENERAL is 60 days', () => {
    expect(SM2_MASTERY_INTERVAL_GENERAL).toBe(60)
  })

  it('SM2_MASTERY_INTERVAL_VOCAB is 30 days', () => {
    expect(SM2_MASTERY_INTERVAL_VOCAB).toBe(30)
  })

  it('QUIZ_FIRST_TRIGGER_AFTER_BLOCKS is positive', () => {
    expect(QUIZ_FIRST_TRIGGER_AFTER_BLOCKS).toBeGreaterThan(0)
  })

  it('TILE_SIZE is 32', () => {
    expect(BALANCE.TILE_SIZE).toBe(32)
  })

  it('MINE_WIDTH is 20', () => {
    expect(BALANCE.MINE_WIDTH).toBe(20)
  })
})

describe('getO2DepthMultiplier', () => {
  it('layer 0 returns 1.0x (surface)', () => {
    expect(getO2DepthMultiplier(0)).toBeCloseTo(1.0, 5)
  })

  it('layer 19 returns approximately 2.5x (deepest)', () => {
    // Formula: 1.0 + (1.5 * 19/19) = 2.5
    expect(getO2DepthMultiplier(19)).toBeCloseTo(2.5, 5)
  })

  it('multiplier is monotonically increasing', () => {
    let prev = getO2DepthMultiplier(0)
    for (let layer = 1; layer < 20; layer++) {
      const current = getO2DepthMultiplier(layer)
      expect(current).toBeGreaterThan(prev)
      prev = current
    }
  })

  it('clamps layer values below 0', () => {
    expect(getO2DepthMultiplier(-5)).toBe(getO2DepthMultiplier(0))
  })

  it('clamps layer values above 19', () => {
    expect(getO2DepthMultiplier(25)).toBe(getO2DepthMultiplier(19))
  })
})

describe('getLayerGridSize', () => {
  it('layers 1-5 return 20x20', () => {
    for (let l = 1; l <= 5; l++) {
      expect(getLayerGridSize(l)).toEqual([20, 20])
    }
  })

  it('layers 6-10 return 25x25', () => {
    for (let l = 6; l <= 10; l++) {
      expect(getLayerGridSize(l)).toEqual([25, 25])
    }
  })

  it('layers 11-15 return 30x30', () => {
    for (let l = 11; l <= 15; l++) {
      expect(getLayerGridSize(l)).toEqual([30, 30])
    }
  })

  it('layers 16+ return 40x40', () => {
    for (let l = 16; l <= 20; l++) {
      expect(getLayerGridSize(l)).toEqual([40, 40])
    }
  })
})
