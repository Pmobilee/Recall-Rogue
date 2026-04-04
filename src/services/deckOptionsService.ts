import { writable } from 'svelte/store'
import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'

/**
 * Type for deck options per language.
 * Structure: { languageCode: { optionId: boolean, ... }, ... }
 */
export type LanguageDeckOptionsMap = Record<string, Record<string, boolean>>

/**
 * Read a value from localStorage with JSON parsing and type safety.
 * Returns the fallback value if localStorage is unavailable or parse fails.
 */
function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Create a Svelte store that persists to localStorage.
 * Automatically syncs all store updates to localStorage.
 */
function persistedWritable<T>(key: string, initial: T): Writable<T> {
  const store = writable<T>(read(key, initial))
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // ignore storage failures
      }
    })
  }
  return store
}

const defaultDeckOptions: LanguageDeckOptionsMap = {}

/**
 * Persisted store for deck options, keyed by language code and option ID.
 */
export const deckOptions = persistedWritable<LanguageDeckOptionsMap>(
  'card:deckOptions',
  defaultDeckOptions,
)

/**
 * Get a deck option value for a specific language and option ID.
 * Returns the provided defaultValue if the option is not set.
 *
 * @param languageCode - The language code (e.g., 'ja', 'en')
 * @param optionId - The option identifier (e.g., 'furigana', 'romaji')
 * @param defaultValue - The default value to return if the option is not set
 * @returns The stored value or the default value
 */
export function getDeckOption(languageCode: string, optionId: string, defaultValue: boolean): boolean {
  const current = get(deckOptions)
  return current[languageCode]?.[optionId] ?? defaultValue
}

/**
 * Set a deck option value for a specific language and option ID.
 * Automatically persists to localStorage.
 *
 * @param languageCode - The language code (e.g., 'ja', 'en')
 * @param optionId - The option identifier (e.g., 'furigana', 'romaji')
 * @param value - The boolean value to set
 */
export function setDeckOption(languageCode: string, optionId: string, value: boolean): void {
  deckOptions.update((options) => {
    const updated = { ...options }
    if (!updated[languageCode]) {
      updated[languageCode] = {}
    }
    updated[languageCode][optionId] = value
    return updated
  })
}

/**
 * Check if furigana is enabled for Japanese cards.
 * Defaults to true if not explicitly set.
 *
 * @returns true if furigana is enabled, false otherwise
 */
export function isFuriganaEnabled(): boolean {
  return getDeckOption('ja', 'furigana', true)
}

/**
 * Check if romaji is enabled for Japanese cards.
 * Defaults to false if not explicitly set.
 *
 * @returns true if romaji is enabled, false otherwise
 */
export function isRomajiEnabled(): boolean {
  return getDeckOption('ja', 'romaji', false)
}

/**
 * Set furigana enabled status for Japanese cards.
 *
 * @param enabled - Whether furigana should be enabled
 */
export function setFuriganaEnabled(enabled: boolean): void {
  setDeckOption('ja', 'furigana', enabled)
}

/**
 * Set romaji enabled status for Japanese cards.
 *
 * @param enabled - Whether romaji should be enabled
 */
export function setRomajiEnabled(enabled: boolean): void {
  setDeckOption('ja', 'romaji', enabled)
}

/**
 * Check if kana-only mode is enabled for Japanese cards.
 * When enabled, all kanji should be replaced with hiragana readings.
 * Defaults to false.
 */
export function isKanaOnlyEnabled(): boolean {
  return getDeckOption('ja', 'kanaOnly', false)
}

export function setKanaOnlyEnabled(enabled: boolean): void {
  setDeckOption('ja', 'kanaOnly', enabled)
}

// ---- Chinese pinyin ----

/** Check if pinyin is enabled for Chinese cards. Defaults to true. */
export function isPinyinEnabled(): boolean {
  return getDeckOption('zh', 'pinyin', true)
}

export function setPinyinEnabled(enabled: boolean): void {
  setDeckOption('zh', 'pinyin', enabled)
}

/** Check if pinyin-only mode is enabled for Chinese cards. Defaults to false. */
export function isPinyinOnlyEnabled(): boolean {
  return getDeckOption('zh', 'pinyinOnly', false)
}

export function setPinyinOnlyEnabled(enabled: boolean): void {
  setDeckOption('zh', 'pinyinOnly', enabled)
}

// ---- Korean romanization ----

/** Check if romanization is enabled for Korean cards. Defaults to false. */
export function isKoreanRomanizationEnabled(): boolean {
  return getDeckOption('ko', 'romanization', false)
}

export function setKoreanRomanizationEnabled(enabled: boolean): void {
  setDeckOption('ko', 'romanization', enabled)
}

// ---- Always-write mode (grammar typing) ----

/**
 * Check if always-write mode is enabled for a given language.
 * When enabled, grammar questions use typing input instead of multiple choice.
 * Defaults to false.
 *
 * @param languageCode - The language code (e.g., 'ja')
 * @returns true if always-write mode is enabled, false otherwise
 */
export function isAlwaysWriteEnabled(languageCode: string): boolean {
  return getDeckOption(languageCode, 'alwaysWrite', false)
}

/**
 * Set always-write mode for a given language.
 *
 * @param languageCode - The language code (e.g., 'ja')
 * @param enabled - Whether always-write mode should be enabled
 */
export function setAlwaysWriteEnabled(languageCode: string, enabled: boolean): void {
  setDeckOption(languageCode, 'alwaysWrite', enabled)
}
