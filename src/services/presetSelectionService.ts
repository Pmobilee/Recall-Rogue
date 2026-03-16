import type { Fact } from '../data/types'
import type { FactDomain } from '../data/card-types'
import { normalizeFactDomain } from '../data/card-types'
import { resolveDomain } from './domainResolver'

export const JAPANESE_KANA_SELECTION_KEY = 'kana'
export const JAPANESE_JLPT_LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const JAPANESE_SUBDECK_ORDER = ['vocabulary', 'kanji', 'grammar'] as const

export interface JapaneseDeckGroup {
  level: (typeof JAPANESE_JLPT_LEVEL_ORDER)[number]
  label: string
  keys: string[]
}

const JAPANESE_LEVEL_KEYS = JAPANESE_JLPT_LEVEL_ORDER.map((level) => level.toLowerCase())
const JAPANESE_LEGACY_SUBDECKS = new Set(['vocabulary', 'kanji', 'grammar', 'kana'])
const LANGUAGE_SUBDECK_BY_CATEGORY: Record<string, string> = {
  language_vocab: 'vocabulary',
  language_kanji: 'kanji',
  language_grammar: 'grammar',
  language_kana: 'kana',
}

export const JAPANESE_DECK_GROUPS: JapaneseDeckGroup[] = JAPANESE_JLPT_LEVEL_ORDER.map((level) => {
  const lower = level.toLowerCase()
  return {
    level,
    label: `JLPT ${level}`,
    keys: JAPANESE_SUBDECK_ORDER.map((subdeck) => `${lower}:${subdeck}`),
  }
})

export function getJapaneseSelectionKeys(): string[] {
  return [
    JAPANESE_KANA_SELECTION_KEY,
    ...JAPANESE_DECK_GROUPS.flatMap((group) => group.keys),
  ]
}

function normalizeToken(value: string): string {
  return String(value || '').trim().toLowerCase()
}

function getFactSubcategory(fact: Fact): string {
  const second = fact.category[1]?.trim()
  if (second) return second
  const l2 = fact.categoryL2?.trim()
  if (l2) return l2
  return 'General'
}

function inferLanguageSubdeck(fact: Fact): string | null {
  const category0 = normalizeToken(fact.category[0] ?? '')
  if (category0 && LANGUAGE_SUBDECK_BY_CATEGORY[category0]) {
    return LANGUAGE_SUBDECK_BY_CATEGORY[category0]!
  }

  const id = normalizeToken(fact.id)
  if (id.includes('-kana-')) return 'kana'
  if (id.includes('-kanji-')) return 'kanji'
  if (id.includes('-grammar-')) return 'grammar'
  if (id.includes('-vocab-')) return 'vocabulary'
  return null
}

function inferJapaneseJlptLevelToken(fact: Fact): string | null {
  const match = fact.id.match(/-(n[1-5])(?:-|$)/i)
  if (match?.[1]) return normalizeToken(match[1])

  // Historical "additional" grammar rows in this repo were emitted as N3.
  if (fact.id.startsWith('ja-grammar-additional-')) return 'n3'
  return null
}

function getJapaneseFactSelectionToken(fact: Fact): string | null {
  const subdeck = inferLanguageSubdeck(fact)
  if (!subdeck) return null
  if (subdeck === 'kana') return JAPANESE_KANA_SELECTION_KEY

  const level = inferJapaneseJlptLevelToken(fact) ?? 'n3'
  if (!JAPANESE_LEVEL_KEYS.includes(level)) return null
  if (!JAPANESE_SUBDECK_ORDER.includes(subdeck as (typeof JAPANESE_SUBDECK_ORDER)[number])) return null
  return `${level}:${subdeck}`
}

function expandJapaneseSelectionTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>()

  for (const rawToken of tokens) {
    const token = normalizeToken(rawToken)
    if (!token) continue

    if (token === JAPANESE_KANA_SELECTION_KEY) {
      expanded.add(JAPANESE_KANA_SELECTION_KEY)
      continue
    }

    if (JAPANESE_LEGACY_SUBDECKS.has(token)) {
      if (token === 'kana') {
        expanded.add(JAPANESE_KANA_SELECTION_KEY)
      } else {
        for (const level of JAPANESE_LEVEL_KEYS) {
          expanded.add(`${level}:${token}`)
        }
      }
      continue
    }

    const levelOnly = token.match(/^(?:jlpt[\s_-]*)?(n[1-5])$/)
    if (levelOnly?.[1]) {
      const level = normalizeToken(levelOnly[1])
      for (const subdeck of JAPANESE_SUBDECK_ORDER) {
        expanded.add(`${level}:${subdeck}`)
      }
      continue
    }

    const full = token.match(/^(?:jlpt[\s_-]*)?(n[1-5])\s*[:_-]\s*(vocabulary|kanji|grammar)$/)
    if (full?.[1] && full?.[2]) {
      expanded.add(`${normalizeToken(full[1])}:${normalizeToken(full[2])}`)
      continue
    }

    expanded.add(token)
  }

  return expanded
}

function matchesJapaneseSelection(fact: Fact, selectedSubcategories: string[]): boolean {
  if (selectedSubcategories.length === 0) return true
  const selected = expandJapaneseSelectionTokens(selectedSubcategories)
  const factToken = getJapaneseFactSelectionToken(fact)
  if (factToken) return selected.has(factToken)

  // Fallback for vocab facts (ja-jlpt-*) that don't have -vocab-/-kanji-/-grammar- in ID:
  // Match by categoryL2 (e.g., "japanese_n5") against the JLPT level in selected tokens
  const catL2 = normalizeToken(fact.categoryL2 ?? '')
  if (!catL2) return false

  // Selected tokens look like "n5:vocabulary", "n5:kanji", etc.
  // Extract the level portion and check if any selected token starts with the fact's JLPT level
  const jlptMatch = catL2.match(/^japanese_(n[1-5])$/)
  if (jlptMatch?.[1]) {
    const factLevel = jlptMatch[1]
    // Match if ANY selected token starts with this level (e.g., "n5:vocabulary", "n5:kanji", "n5:grammar")
    for (const token of selected) {
      if (token.startsWith(`${factLevel}:`)) return true
    }
  }

  return false
}

function matchesGenericLanguageSelection(fact: Fact, selectedSubcategories: string[]): boolean {
  if (selectedSubcategories.length === 0) return true
  const selected = new Set(selectedSubcategories.map(normalizeToken))

  // Primary: match by categoryL2 (e.g., "spanish_a1", "french_b2", "korean_beginner")
  const catL2 = normalizeToken(fact.categoryL2 ?? '')
  if (catL2 && selected.has(catL2)) return true

  // Fallback: match by inferred subdeck (backward compat for vocabulary/kanji/grammar)
  const subdeck = inferLanguageSubdeck(fact)
  if (subdeck && selected.has(subdeck)) return true

  // Fallback: match by category[1]
  const factSubcategory = normalizeToken(getFactSubcategory(fact))
  if (selected.has(factSubcategory)) return true

  return false
}

function normalizeDomainKey(domainKey: string): string {
  return normalizeFactDomain(domainKey as FactDomain)
}

export function factMatchesDomainSelection(
  fact: Fact,
  domainKey: string,
  selectedSubcategories: string[] = [],
): boolean {
  const trimmedDomain = String(domainKey || '').trim()
  if (!trimmedDomain) return false

  if (trimmedDomain.startsWith('language:')) {
    const languageCode = normalizeToken(trimmedDomain.slice('language:'.length))
    if (!languageCode) return false
    if (normalizeToken(fact.language ?? '') !== languageCode) return false
    if (languageCode === 'ja') {
      return matchesJapaneseSelection(fact, selectedSubcategories)
    }
    return matchesGenericLanguageSelection(fact, selectedSubcategories)
  }

  const factDomain = normalizeFactDomain(resolveDomain(fact))
  const targetDomain = normalizeDomainKey(trimmedDomain)
  if (factDomain !== targetDomain) return false
  if (selectedSubcategories.length === 0) return true

  const allowed = new Set(selectedSubcategories.map(normalizeToken))
  const factSubcategory = normalizeToken(getFactSubcategory(fact))
  return allowed.has(factSubcategory)
}

export function factMatchesPresetSelection(
  fact: Fact,
  domainSelections: Record<string, string[]>,
): boolean {
  const domainEntries = Object.entries(domainSelections)
  if (domainEntries.length === 0) return false

  for (const [domainKey, selectedSubcategories] of domainEntries) {
    if (factMatchesDomainSelection(fact, domainKey, selectedSubcategories ?? [])) {
      return true
    }
  }
  return false
}

export function collectMatchingFactIds(
  facts: Fact[],
  domainSelections: Record<string, string[]>,
): Set<string> {
  const ids = new Set<string>()
  for (const fact of facts) {
    if (factMatchesPresetSelection(fact, domainSelections)) {
      ids.add(fact.id)
    }
  }
  return ids
}

