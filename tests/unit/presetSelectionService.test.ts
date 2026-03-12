import { describe, expect, it } from 'vitest'
import {
  collectMatchingFactIds,
  factMatchesDomainSelection,
  factMatchesPresetSelection,
} from '../../src/services/presetSelectionService'

function makeFact(partial: Partial<Record<string, unknown>>): any {
  return {
    id: 'fact-1',
    category: ['General Knowledge'],
    categoryL2: 'General',
    language: null,
    ...partial,
  }
}

describe('presetSelectionService', () => {
  it('matches Japanese selector tokens (kana + JLPT) with legacy compatibility', () => {
    const kanaFact = makeFact({
      id: 'ja-kana-a',
      category: ['language_kana'],
      language: 'ja',
    })
    const n5VocabFact = makeFact({
      id: 'ja-vocab-n5-001',
      category: ['language_vocab'],
      language: 'ja',
    })
    const n1KanjiFact = makeFact({
      id: 'ja-kanji-n1-001',
      category: ['language_kanji'],
      language: 'ja',
    })
    const legacyGrammarFact = makeFact({
      id: 'ja-grammar-additional-001',
      category: ['language_grammar'],
      language: 'ja',
    })

    expect(factMatchesDomainSelection(kanaFact, 'language:ja', ['kana'])).toBe(true)
    expect(factMatchesDomainSelection(n5VocabFact, 'language:ja', ['n5:vocabulary'])).toBe(true)
    expect(factMatchesDomainSelection(n5VocabFact, 'language:ja', ['Vocabulary'])).toBe(true)
    expect(factMatchesDomainSelection(n1KanjiFact, 'language:ja', ['n5:kanji'])).toBe(false)
    expect(factMatchesDomainSelection(legacyGrammarFact, 'language:ja', ['n3:grammar'])).toBe(true)
  })

  it('enforces strict language scope for language:<code> domain keys', () => {
    const jaFact = makeFact({ id: 'ja-vocab-n5-001', category: ['language_vocab'], language: 'ja' })
    const esFact = makeFact({ id: 'es-vocab-a1-001', category: ['language_vocab'], language: 'es' })

    expect(factMatchesDomainSelection(jaFact, 'language:ja', ['vocabulary'])).toBe(true)
    expect(factMatchesDomainSelection(esFact, 'language:ja', ['vocabulary'])).toBe(false)
  })

  it('matches preset selections across mixed domains and collects matching IDs', () => {
    const historyFact = makeFact({
      id: 'hist-1',
      category: ['History', 'Ancient'],
      categoryL2: 'Ancient',
    })
    const jaFact = makeFact({
      id: 'ja-vocab-n5-001',
      category: ['language_vocab'],
      language: 'ja',
    })
    const geoFact = makeFact({
      id: 'geo-1',
      category: ['Geography', 'Europe'],
      categoryL2: 'Europe',
    })

    const selections = {
      history: [],
      'language:ja': ['n5:vocabulary'],
    }

    expect(factMatchesPresetSelection(historyFact, selections)).toBe(true)
    expect(factMatchesPresetSelection(jaFact, selections)).toBe(true)
    expect(factMatchesPresetSelection(geoFact, selections)).toBe(false)

    const ids = collectMatchingFactIds([historyFact, jaFact, geoFact], selections)
    expect(ids.has('hist-1')).toBe(true)
    expect(ids.has('ja-vocab-n5-001')).toBe(true)
    expect(ids.has('geo-1')).toBe(false)
  })
})
