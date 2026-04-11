import { describe, it, expect } from 'vitest'
import { formatExamTag } from './examTagDisplay'

describe('formatExamTag', () => {
  describe('static label lookup', () => {
    it('returns custom label for USMLE_Step1', () => {
      expect(formatExamTag('USMLE_Step1')).toBe('USMLE Step 1')
    })

    it('returns custom label for USMLE_Step2', () => {
      expect(formatExamTag('USMLE_Step2')).toBe('USMLE Step 2')
    })

    it('returns custom label for NBME_Shelf', () => {
      expect(formatExamTag('NBME_Shelf')).toBe('NBME Shelf')
    })

    it('returns custom label for MCAT', () => {
      expect(formatExamTag('MCAT')).toBe('MCAT')
    })

    it('returns custom label for high_yield', () => {
      expect(formatExamTag('high_yield')).toBe('High Yield')
    })

    it('returns custom label for clinical_correlation', () => {
      expect(formatExamTag('clinical_correlation')).toBe('Clinical')
    })

    it('returns custom label for image_identification', () => {
      expect(formatExamTag('image_identification')).toBe('Visual ID')
    })
  })

  describe('generic underscore-to-space fallback', () => {
    it('formats AP sub-topic codes', () => {
      expect(formatExamTag('Topic_4.2')).toBe('Topic 4.2')
    })

    it('formats unit tags', () => {
      expect(formatExamTag('Unit_1')).toBe('Unit 1')
    })

    it('formats period tags', () => {
      expect(formatExamTag('Period_7')).toBe('Period 7')
    })

    it('formats AP course family tags', () => {
      expect(formatExamTag('AP_US_History')).toBe('AP US History')
    })

    it('formats multi-segment underscore tags', () => {
      expect(formatExamTag('AP_Macro_Economics')).toBe('AP Macro Economics')
    })
  })

  describe('edge cases', () => {
    it('passes through tags with no underscores unchanged', () => {
      expect(formatExamTag('plain')).toBe('plain')
    })

    it('returns empty string for empty input', () => {
      expect(formatExamTag('')).toBe('')
    })
  })
})
