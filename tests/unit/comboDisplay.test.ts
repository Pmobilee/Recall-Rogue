import { describe, expect, it } from 'vitest'
import { formatComboMultiplier, getComboDisplayText } from '../../src/ui/utils/comboDisplay'

describe('combo display helpers', () => {
  it('formats multipliers with two decimals', () => {
    expect(formatComboMultiplier(1.15)).toBe('1.15x')
    expect(formatComboMultiplier(1.3)).toBe('1.30x')
    expect(formatComboMultiplier(2)).toBe('2.00x')
  })

  it('shows combo multiplier text from first successful combo step', () => {
    expect(getComboDisplayText(0, 1, false)).toBe('')
    expect(getComboDisplayText(1, 1.15, false)).toBe('1.15x')
    expect(getComboDisplayText(4, 1.75, false)).toBe('1.75x')
  })

  it('prioritizes perfect-turn label', () => {
    expect(getComboDisplayText(4, 1.75, true)).toBe('PERFECT!')
  })
})
