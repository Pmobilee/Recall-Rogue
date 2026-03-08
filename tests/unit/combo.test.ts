import { describe, it, expect } from 'vitest'
import { getComboMultiplier } from '../../src/services/turnManager'
import { COMBO_MULTIPLIERS } from '../../src/data/balance'

describe('Knowledge Combo', () => {
  describe('getComboMultiplier', () => {
    it('returns 1.0 for combo 0 (no prior correct answers)', () => {
      expect(getComboMultiplier(0)).toBe(1.0)
    })
    it('returns 1.15 for combo 1 (1 prior correct)', () => {
      expect(getComboMultiplier(1)).toBe(1.15)
    })
    it('returns 1.3 for combo 2', () => {
      expect(getComboMultiplier(2)).toBe(1.3)
    })
    it('returns 1.5 for combo 3', () => {
      expect(getComboMultiplier(3)).toBe(1.5)
    })
    it('returns 2.0 for combo 4 (perfect turn)', () => {
      expect(getComboMultiplier(4)).toBe(2.0)
    })
    it('caps at 2.0 for combo > 4', () => {
      expect(getComboMultiplier(5)).toBe(2.0)
      expect(getComboMultiplier(10)).toBe(2.0)
      expect(getComboMultiplier(100)).toBe(2.0)
    })
  })

  describe('combo multiplier math', () => {
    it('correctly applies combo to damage: base 10, combo 2.0 = 20', () => {
      // Formula: base * tierMult * effectMult * comboMult * speedMult * buffMult
      const base = 10
      const combo = 2.0  // 4th consecutive correct (index 4)
      const result = Math.round(base * 1.0 * 1.0 * combo * 1.0 * 1.0)
      expect(result).toBe(20)
    })

    it('combo stacks with speed bonus: base 10, combo 1.5, speed 1.5 = 22.5 -> 23', () => {
      const result = Math.round(10 * 1.0 * 1.0 * 1.5 * 1.5 * 1.0)
      expect(result).toBe(23)
    })

    it('COMBO_MULTIPLIERS array has 5 entries', () => {
      expect(COMBO_MULTIPLIERS.length).toBe(5)
    })

    it('COMBO_MULTIPLIERS are monotonically increasing', () => {
      for (let i = 1; i < COMBO_MULTIPLIERS.length; i++) {
        expect(COMBO_MULTIPLIERS[i]).toBeGreaterThanOrEqual(COMBO_MULTIPLIERS[i - 1])
      }
    })

    it('COMBO_MULTIPLIERS first entry is 1.0 (no bonus)', () => {
      expect(COMBO_MULTIPLIERS[0]).toBe(1.0)
    })

    it('COMBO_MULTIPLIERS last entry is 2.0 (max bonus)', () => {
      expect(COMBO_MULTIPLIERS[COMBO_MULTIPLIERS.length - 1]).toBe(2.0)
    })
  })
})
