import { describe, expect, it } from 'vitest'
import {
  getCombinedPoolRewardMultiplier,
  getNoveltyRewardMultiplier,
  getPoolSizeRewardMultiplier,
  shouldSuppressRewardsForTinyPool,
} from '../../src/services/masteryScalingService'

describe('masteryScalingService pool reward scaling', () => {
  it('applies pool-size tiers as configured', () => {
    expect(getPoolSizeRewardMultiplier(150)).toBe(1)
    expect(getPoolSizeRewardMultiplier(100)).toBe(0.9)
    expect(getPoolSizeRewardMultiplier(50)).toBe(0.75)
    expect(getPoolSizeRewardMultiplier(30)).toBe(0.55)
    expect(getPoolSizeRewardMultiplier(10)).toBe(0.35)
  })

  it('applies novelty guard only when novelty is very low', () => {
    expect(getNoveltyRewardMultiplier(0.5)).toBe(1)
    expect(getNoveltyRewardMultiplier(0.2)).toBe(1)
    expect(getNoveltyRewardMultiplier(0.19)).toBe(0.9)
  })

  it('combines pool-size and novelty multipliers', () => {
    expect(getCombinedPoolRewardMultiplier(80, 0.1)).toBe(0.81)
    expect(getCombinedPoolRewardMultiplier(120, 0.5)).toBe(1)
  })

  it('suppresses rewards only for extremely tiny pools', () => {
    expect(shouldSuppressRewardsForTinyPool(7)).toBe(true)
    expect(shouldSuppressRewardsForTinyPool(8)).toBe(false)
  })
})
