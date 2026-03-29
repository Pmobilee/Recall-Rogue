import { writable, get } from 'svelte/store'
import type { VocabularyTrack, LanguageConfig, LanguageLevel } from '../types/vocabulary'
import { SUPPORTED_LANGUAGES, getLanguageConfig, getActiveTracksForVocabularyFact } from '../types/vocabulary'

/** Language mode state */
export interface LanguageModeState {
  enabled: boolean
  language: string | null     // ISO 639-1 code
  level: string | null        // 'N5', 'A1', etc.
  showGeneralFacts: boolean   // Mix general facts with language facts
}

const LANG_MODE_KEY = 'rr_language_mode'

const defaultState: LanguageModeState = {
  enabled: false,
  language: null,
  level: null,
  showGeneralFacts: false
}

/** Reactive language mode store */
export const languageMode = writable<LanguageModeState>(loadState())

function loadState(): LanguageModeState {
  try {
    const stored = localStorage.getItem(LANG_MODE_KEY)
    if (stored) {
      const parsed = { ...defaultState, ...JSON.parse(stored) } as LanguageModeState
      const config = parsed.language ? getLanguageConfig(parsed.language) : null

      if (!config) {
        return { ...defaultState, showGeneralFacts: parsed.showGeneralFacts }
      }

      const validLevel = parsed.level ? config.levels.find((level) => level.id === parsed.level) : null
      return {
        ...parsed,
        level: validLevel?.id ?? config.levels[0]?.id ?? null,
      }
    }
  } catch { /* ignore */ }
  return defaultState
}

function saveState(state: LanguageModeState): void {
  localStorage.setItem(LANG_MODE_KEY, JSON.stringify(state))
  languageMode.set(state)
}

class LanguageService {
  /** Enable Language Mode with a specific language and level */
  setLanguageMode(languageCode: string, level: string): void {
    const config = getLanguageConfig(languageCode)
    if (!config) return

    const validLevel = config.levels.find(l => l.id === level)
    if (!validLevel) return

    saveState({
      enabled: true,
      language: languageCode,
      level,
      showGeneralFacts: get(languageMode).showGeneralFacts
    })
  }

  /** Disable Language Mode — instant and lossless */
  disableLanguageMode(): void {
    saveState({ ...get(languageMode), enabled: false })
  }

  /** Toggle Language Mode on/off */
  toggleLanguageMode(): void {
    const current = get(languageMode)
    if (current.enabled) {
      this.disableLanguageMode()
    } else if (current.language && current.level) {
      this.setLanguageMode(current.language, current.level)
    }
  }

  /** Toggle whether to show general facts alongside language facts */
  toggleGeneralFacts(): void {
    const current = get(languageMode)
    saveState({ ...current, showGeneralFacts: !current.showGeneralFacts })
  }

  /** Get the Category Lock array for the current language mode */
  getCategoryLock(): string[] | null {
    const state = get(languageMode)
    if (!state.enabled || !state.language || !state.level) return null

    const config = getLanguageConfig(state.language)
    if (!config) return null

    return ['Language', config.name, `${state.level} Vocabulary`]
  }

  /** Get currently selected language config */
  getSelectedLanguage(): LanguageConfig | null {
    const state = get(languageMode)
    if (!state.language) return null
    return getLanguageConfig(state.language) ?? null
  }

  /** Get all supported languages */
  getSupportedLanguages(): LanguageConfig[] {
    return SUPPORTED_LANGUAGES
  }

  /** Get available levels for a language */
  getLevelsForLanguage(languageCode: string): LanguageLevel[] {
    return getLanguageConfig(languageCode)?.levels ?? []
  }

  /** Get active SM-2 tracks for a vocabulary fact based on recognition interval */
  getActiveTracks(recognitionInterval: number): VocabularyTrack[] {
    return getActiveTracksForVocabularyFact(recognitionInterval)
  }

  /** Check if a level should be unlocked based on mastery of the previous level */
  checkLevelProgression(languageCode: string, currentLevel: string, masteryPercentage: number): {
    shouldUnlock: boolean
    nextLevel: LanguageLevel | null
    message: string
  } {
    const config = getLanguageConfig(languageCode)
    if (!config) return { shouldUnlock: false, nextLevel: null, message: '' }

    const currentIdx = config.levels.findIndex(l => l.id === currentLevel)
    if (currentIdx < 0 || currentIdx >= config.levels.length - 1) {
      return { shouldUnlock: false, nextLevel: null, message: '' }
    }

    const nextLevel = config.levels[currentIdx + 1]
    const shouldUnlock = masteryPercentage >= 0.8  // 80% mastery threshold

    const message = shouldUnlock
      ? `Your ${currentLevel} foundation is solid. ${nextLevel.name} vocabulary is now appearing in dives — about ${nextLevel.wordCount} words, ready when you are.`
      : ''

    return { shouldUnlock, nextLevel, message }
  }

  /** Check if Language Mode is currently active */
  isActive(): boolean {
    return get(languageMode).enabled
  }

  /** Get current state (non-reactive) */
  getState(): LanguageModeState {
    return get(languageMode)
  }
}

export const languageService = new LanguageService()
