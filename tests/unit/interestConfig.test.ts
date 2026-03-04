// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  createDefaultInterestConfig,
  computeFactWeights,
  countActiveInterests,
  getCategoryMultiplier,
  getSubcategoryMultiplier,
  weightedRandomSelect,
  MAX_INTEREST_CATEGORIES,
  MAX_INFERRED_BOOST,
} from '../../src/data/interestConfig'
import { CATEGORIES } from '../../src/data/types'

describe('createDefaultInterestConfig', () => {
  it('creates one entry per category', () => {
    const config = createDefaultInterestConfig()
    expect(config.categories).toHaveLength(CATEGORIES.length)
  })

  it('all category weights start at 0', () => {
    const config = createDefaultInterestConfig()
    config.categories.forEach(c => expect(c.weight).toBe(0))
  })

  it('all subcategoryWeights start empty', () => {
    const config = createDefaultInterestConfig()
    config.categories.forEach(c =>
      expect(Object.keys(c.subcategoryWeights)).toHaveLength(0),
    )
  })

  it('behavioral learning is disabled by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.behavioralLearningEnabled).toBe(false)
  })

  it('category lock is null by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.categoryLock).toBeNull()
  })

  it('category lock is not active by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.categoryLockActive).toBe(false)
  })

  it('inferredBoosts is empty object by default', () => {
    const config = createDefaultInterestConfig()
    expect(config.inferredBoosts).toEqual({})
  })
})

describe('countActiveInterests', () => {
  it('returns 0 when all weights are 0', () => {
    const config = createDefaultInterestConfig()
    expect(countActiveInterests(config)).toBe(0)
  })

  it('counts only categories with weight > 0', () => {
    const config = createDefaultInterestConfig()
    config.categories[0].weight = 50
    config.categories[2].weight = 75
    expect(countActiveInterests(config)).toBe(2)
  })

  it('MAX_INTEREST_CATEGORIES is 3', () => {
    expect(MAX_INTEREST_CATEGORIES).toBe(3)
  })
})

describe('getCategoryMultiplier', () => {
  it('returns 1.0 for a category with weight 0 and no inferred boost', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    expect(getCategoryMultiplier(config, cat)).toBe(1.0)
  })

  it('returns 2.0 for a category with weight 100', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    config.categories[0].weight = 100
    expect(getCategoryMultiplier(config, cat)).toBeCloseTo(2.0, 5)
  })

  it('adds inferred boost on top of explicit weight', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    config.categories[0].weight = 50
    config.inferredBoosts[cat] = 0.2
    // 1.0 + (50/100) + 0.2 = 1.7
    expect(getCategoryMultiplier(config, cat)).toBeCloseTo(1.7, 5)
  })

  it('caps inferred boost at MAX_INFERRED_BOOST', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    config.inferredBoosts[cat] = 0.9 // exceeds MAX_INFERRED_BOOST (0.3)
    // 1.0 + 0 + 0.3 (capped) = 1.3
    expect(getCategoryMultiplier(config, cat)).toBeCloseTo(1.3, 5)
  })

  it('MAX_INFERRED_BOOST is 0.3', () => {
    expect(MAX_INFERRED_BOOST).toBe(0.3)
  })

  it('returns 1.0 for an unknown category', () => {
    const config = createDefaultInterestConfig()
    expect(getCategoryMultiplier(config, 'nonexistent_category')).toBe(1.0)
  })
})

describe('getSubcategoryMultiplier', () => {
  it('falls back to parent category multiplier when subcategory not set', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    config.categories[0].weight = 50
    expect(getSubcategoryMultiplier(config, cat, 'SomeSub')).toBeCloseTo(
      getCategoryMultiplier(config, cat),
      5,
    )
  })

  it('uses subcategory weight when set', () => {
    const config = createDefaultInterestConfig()
    const cat = config.categories[0].category
    config.categories[0].subcategoryWeights['SubCat'] = 80
    // 1.0 + (80/100) + 0 = 1.8
    expect(getSubcategoryMultiplier(config, cat, 'SubCat')).toBeCloseTo(1.8, 5)
  })
})

describe('computeFactWeights', () => {
  it('returns all 1.0 weights when no interests are set', () => {
    const config = createDefaultInterestConfig()
    const facts = [
      { id: 'f1', category: ['History'] },
      { id: 'f2', category: ['Language'] },
    ]
    const weights = computeFactWeights(facts, config)
    expect(weights).toEqual([1.0, 1.0])
  })

  it('returns higher weight for facts in interested category', () => {
    const config = createDefaultInterestConfig()
    const historyEntry = config.categories.find(c => c.category === 'History')
    if (historyEntry) historyEntry.weight = 100

    const facts = [
      { id: 'f1', category: ['History'] },
      { id: 'f2', category: ['Language'] },
    ]
    const weights = computeFactWeights(facts, config)
    expect(weights[0]).toBeGreaterThan(weights[1])
  })

  it('category lock active filters to only matching facts', () => {
    const config = createDefaultInterestConfig()
    config.categoryLock = ['History']
    config.categoryLockActive = true

    const facts = [
      { id: 'f1', category: ['History'] },
      { id: 'f2', category: ['Language'] },
    ]
    const weights = computeFactWeights(facts, config)
    expect(weights[0]).toBe(1.0)
    expect(weights[1]).toBe(0.0)
  })

  it('returns weights array of same length as facts', () => {
    const config = createDefaultInterestConfig()
    const facts = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, category: ['History'] }))
    const weights = computeFactWeights(facts, config)
    expect(weights).toHaveLength(10)
  })
})

describe('weightedRandomSelect', () => {
  it('returns null for empty items', () => {
    const result = weightedRandomSelect([], [], () => 0.5)
    expect(result).toBeNull()
  })

  it('returns null when all weights are 0', () => {
    const result = weightedRandomSelect(['a', 'b'], [0, 0], () => 0.5)
    expect(result).toBeNull()
  })

  it('always returns the only item when one weight is positive', () => {
    const result = weightedRandomSelect(['a', 'b'], [1.0, 0], () => 0.1)
    expect(result).toBe('a')
  })

  it('distributes selection proportionally to weights over many trials', () => {
    let aCount = 0
    const totalTrials = 10000
    for (let i = 0; i < totalTrials; i++) {
      const r = Math.random()
      const result = weightedRandomSelect(['a', 'b'], [1.0, 3.0], () => r)
      if (result === 'a') aCount++
    }
    // 'a' has weight 1/4 = 25%, allow ±5% tolerance
    const aRatio = aCount / totalTrials
    expect(aRatio).toBeGreaterThan(0.20)
    expect(aRatio).toBeLessThan(0.30)
  })
})
