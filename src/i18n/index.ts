// src/i18n/index.ts

import { writable, derived, get } from 'svelte/store'
import type { Writable, Readable } from 'svelte/store'

// ================================================================
// TYPES
// ================================================================

export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ar' | 'he'

export interface LocaleMeta {
  code: LocaleCode
  name: string           // English name: "Spanish"
  nativeName: string     // Native name: "Español"
  rtl: boolean
  flag: string           // Emoji flag
  pluralRules: (n: number) => 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
}

/** Plural form map for a translation key */
export type PluralMap = { one: string; other: string; zero?: string; few?: string; many?: string }

/** Nested translation value: string, plural map, or a nested dict */
export type TranslationValue = string | PluralMap | TranslationDict

/** A dictionary of translation keys to values */
export interface TranslationDict {
  [key: string]: TranslationValue
}

/** Variables interpolated into translation strings via {varName} syntax */
export type InterpolationVars = Record<string, string | number>

// ================================================================
// LOCALE METADATA
// ================================================================

export const LOCALE_META: Record<LocaleCode, LocaleMeta> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    flag: '🇬🇧',
    pluralRules: (n) => (n === 1 ? 'one' : 'other'),
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    rtl: false,
    flag: '🇪🇸',
    pluralRules: (n) => (n === 1 ? 'one' : 'other'),
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    rtl: false,
    flag: '🇫🇷',
    pluralRules: (n) => (n <= 1 ? 'one' : 'other'),
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    rtl: false,
    flag: '🇩🇪',
    pluralRules: (n) => (n === 1 ? 'one' : 'other'),
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    rtl: false,
    flag: '🇯🇵',
    pluralRules: (_n) => 'other', // Japanese has no grammatical plural
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
    flag: '🇸🇦',
    pluralRules: (n) => {
      if (n === 0) return 'zero'
      if (n === 1) return 'one'
      if (n === 2) return 'two'
      if (n % 100 >= 3 && n % 100 <= 10) return 'few'
      if (n % 100 >= 11 && n % 100 <= 99) return 'many'
      return 'other'
    },
  },
  he: {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    rtl: true,
    flag: '🇮🇱',
    pluralRules: (n) => (n === 1 ? 'one' : 'other'),
  },
}

export const SUPPORTED_LOCALES = Object.keys(LOCALE_META) as LocaleCode[]

// ================================================================
// LOCALE DETECTION
// ================================================================

const LOCALE_STORAGE_KEY = 'terra_ui_locale'

/**
 * Detects the preferred locale from:
 * 1. localStorage (user-explicit choice, highest priority)
 * 2. navigator.language (browser/OS preference)
 * 3. 'en' fallback
 */
export function detectLocale(): LocaleCode {
  // 1. Explicit user preference
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && SUPPORTED_LOCALES.includes(stored as LocaleCode)) {
    return stored as LocaleCode
  }

  // 2. Browser/OS preference — navigator.language is e.g. "es-MX", "ja", "ar-SA"
  const browserLang = (navigator.language ?? '').split('-')[0].toLowerCase()
  if (SUPPORTED_LOCALES.includes(browserLang as LocaleCode)) {
    return browserLang as LocaleCode
  }

  // 3. Also check navigator.languages array for additional candidates
  for (const lang of navigator.languages ?? []) {
    const code = lang.split('-')[0].toLowerCase()
    if (SUPPORTED_LOCALES.includes(code as LocaleCode)) {
      return code as LocaleCode
    }
  }

  return 'en'
}

// ================================================================
// TRANSLATION STORE
// ================================================================

/**
 * The active locale code. Persisted to localStorage on change.
 * Update this store to switch the UI language globally.
 */
export const locale: Writable<LocaleCode> = writable(
  typeof window !== 'undefined' ? detectLocale() : 'en'
)

// Persist locale changes
locale.subscribe((code) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
    // Apply dir="rtl" to the document root
    const isRtl = LOCALE_META[code].rtl
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    document.documentElement.lang = code
    // Dynamically load RTL stylesheet when switching to an RTL locale (CSS code-splitting)
    if (isRtl) {
      import('../ui/styles/rtl.css')
    }
  }
})

/** In-memory cache of loaded translation dicts. Key = locale code. */
const translationCache: Partial<Record<LocaleCode, TranslationDict>> = {}

/**
 * Loads a locale's JSON translation dict, using the in-memory cache.
 * Falls back to 'en' if the requested locale file fails to load.
 */
export async function loadLocale(code: LocaleCode): Promise<TranslationDict> {
  if (translationCache[code]) return translationCache[code]!

  try {
    // Dynamic import — Vite will split each locale into its own chunk
    const mod = await import(`./locales/${code}.json`)
    const dict = mod.default as TranslationDict
    translationCache[code] = dict
    return dict
  } catch (err) {
    console.warn(`[i18n] Failed to load locale "${code}":`, err)
    if (code !== 'en') {
      return loadLocale('en')
    }
    return {}
  }
}

/** Reactive store containing the loaded dicts for current locale + 'en' fallback */
export const translations: Writable<{ primary: TranslationDict; fallback: TranslationDict }> =
  writable({ primary: {}, fallback: {} })

/**
 * Initializes i18n by loading the current locale and the 'en' fallback.
 * Call this once at app boot in main.ts before mounting the Svelte app.
 */
export async function initI18n(): Promise<void> {
  const code = get(locale)
  const [primary, fallback] = await Promise.all([
    loadLocale(code),
    code !== 'en' ? loadLocale('en') : Promise.resolve({}),
  ])
  translations.set({ primary, fallback: code === 'en' ? {} : fallback })

  // Re-load when locale changes (user switches mid-session)
  locale.subscribe(async (newCode) => {
    const [newPrimary, newFallback] = await Promise.all([
      loadLocale(newCode),
      newCode !== 'en' ? loadLocale('en') : Promise.resolve({}),
    ])
    translations.set({ primary: newPrimary, fallback: newCode === 'en' ? {} : newFallback })
  })
}

// ================================================================
// TRANSLATION LOOKUP
// ================================================================

/**
 * Resolves a dot-delimited key against a TranslationDict.
 * Returns null if any segment is missing.
 * Example: get(dict, 'settings.audio.music_volume') → 'Music Volume'
 */
function resolve(dict: TranslationDict, key: string): TranslationValue | null {
  const parts = key.split('.')
  let node: TranslationValue = dict
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return null
    // Check if node is a PluralMap (has 'other' key as string) — can't traverse further
    if ('other' in node && typeof (node as PluralMap).other === 'string') return null
    const map = node as TranslationDict
    if (!(part in map)) return null
    node = map[part]
  }
  return node
}

/**
 * Interpolates {varName} placeholders in a translation string.
 * Example: interpolate('Hello {name}', { name: 'GAIA' }) → 'Hello GAIA'
 */
function interpolate(template: string, vars: InterpolationVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`
  )
}

/**
 * The primary translation function.
 *
 * @param key    - Dot-delimited i18n key, e.g. 'hub.dive_button'
 * @param vars   - Optional interpolation variables
 * @param count  - Optional count for pluralization
 * @returns      Translated string, or the key itself if no translation found
 *
 * Usage in Svelte:
 *   <script>
 *     import { t } from '../i18n'
 *   </script>
 *   <button>{$t('hub.dive_button')}</button>
 */
export function createTranslator(
  trans: { primary: TranslationDict; fallback: TranslationDict },
  currentLocale: LocaleCode
) {
  return function t(key: string, vars?: InterpolationVars, count?: number): string {
    // Try primary locale, then fallback (en), then return key verbatim
    const raw = resolve(trans.primary, key) ?? resolve(trans.fallback, key) ?? key

    if (typeof raw === 'string') {
      return vars ? interpolate(raw, vars) : raw
    }

    // Plural form: resolve via locale plural rule
    if (typeof raw === 'object' && count !== undefined) {
      const meta = LOCALE_META[currentLocale]
      const form = meta.pluralRules(count)
      const pluralRaw = (raw as Record<string, string>)[form] ?? (raw as Record<string, string>)['other'] ?? key
      return vars ? interpolate(pluralRaw, { count, ...vars }) : interpolate(pluralRaw, { count })
    }

    // Key returned as-is (better than silent empty string)
    return key
  }
}

/** Reactive derived store for `t()`. Import and use as `$t('key')` in Svelte components. */
export const t: Readable<ReturnType<typeof createTranslator>> = derived(
  [translations, locale],
  ([$translations, $locale]) => createTranslator($translations, $locale)
)
