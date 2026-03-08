# Phase 40: Internationalization & Localization

**Status**: Not started
**Estimated complexity**: High
**Depends on**: Phase 19 (Auth & Cloud), Phase 20 (Mobile Launch), Phase 22 (Social & Multiplayer)
**Blocks**: Phase 44 (Teacher Dashboard — needs locale-aware date formatting)

---

## 1. Overview

Terra Gacha currently hard-codes all UI text in English. Phase 40 adds a full internationalization (i18n) layer so the game can be played in multiple languages without rewriting components. This is a pure UI translation phase — it does not touch the in-game language learning content managed by Phase 24 (Language Learning tracks in `languageService.ts`).

### Goals

1. Install a lightweight i18n framework and wire it into every Svelte component via a reactive `t()` helper.
2. Extract every hard-coded English string into a canonical `en.json` locale file.
3. Build a translator-friendly JSON pipeline with pluralization, interpolation, and a fallback chain (locale → `en`).
4. Mirror the entire layout for right-to-left languages (Arabic, Hebrew).
5. Format all dates, numbers, and currency through the `Intl` browser API so locale-specific conventions are applied automatically.
6. Create a workflow for translating the facts database so localized fact sets can be stored alongside English facts without breaking the SQL schema.
7. Deliver a polished language selector in Settings, integrated with auto-detection from the browser/device locale.

### Supported Launch Locales

| Code | Language  | RTL |
|------|-----------|-----|
| `en` | English   | No  |
| `es` | Spanish   | No  |
| `fr` | French    | No  |
| `de` | German    | No  |
| `ja` | Japanese  | No  |
| `ar` | Arabic    | Yes |
| `he` | Hebrew    | Yes |

Additional locales can be added by dropping a new JSON file into `src/i18n/locales/` — no code changes required.

### Architecture Decision: Custom Micro-Framework vs. svelte-i18n

This phase uses a **custom micro-framework** rather than `svelte-i18n` or `i18next`. Rationale:

- Avoids a new npm dependency (CLAUDE.md security rule: "MUST ASK before adding new npm dependencies"). If the user approves adding `svelte-i18n`, the `t()` wrapper in step 40.1 can be swapped in ~15 minutes.
- The custom approach uses Svelte stores natively and integrates with the existing `singletonWritable` pattern already used in `settings.ts`.
- Total implementation is under 200 lines of TypeScript.
- Supports all required features: interpolation, pluralization, nested keys, fallback chain.

---

## 2. Sub-phases

---

### 40.1 — i18n Framework Setup

**Goal**: Create the core i18n engine. Wire locale detection, store, `t()` function, and fallback chain. No UI changes yet.

#### 2.1.1 Create `src/i18n/index.ts` — i18n Engine

```typescript
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

/** Nested translation value: string, or plural map, or another dict */
export type TranslationValue =
  | string
  | { one: string; other: string; zero?: string; few?: string; many?: string }
  | Record<string, TranslationValue>

export type TranslationDict = Record<string, TranslationValue>

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
    document.documentElement.dir = LOCALE_META[code].rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = code
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
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return null
    const map = node as Record<string, TranslationValue>
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
```

#### 2.1.2 Wire `initI18n()` into `src/main.ts`

In `src/main.ts`, call `initI18n()` before mounting Svelte. The call is async but does not block the Phaser boot. Add immediately after the WebGL check and before `mount(App, ...)`:

```typescript
// src/main.ts — add near top, after imports
import { initI18n } from './i18n/index'

// Existing code: mount(App, ...) etc.
// Replace synchronous boot with an async wrapper that initializes i18n first.
// initI18n() resolves quickly from cache after first load.
// The Phaser boot is not blocked — only the Svelte overlay waits.

// In bootGame(), add as the FIRST await before anything else:
await initI18n()
```

#### Acceptance Criteria 40.1

- `src/i18n/index.ts` exists and compiles with `npm run typecheck`.
- `detectLocale()` returns `'en'` on a browser with `navigator.language = 'en-US'`.
- `detectLocale()` returns `'es'` on a browser with `navigator.language = 'es-MX'`.
- `detectLocale()` returns `'en'` (fallback) on a browser with `navigator.language = 'zh'` (unsupported locale).
- Setting `locale.set('ar')` applies `dir="rtl"` to `document.documentElement`.
- `$t('missing.key')` returns `'missing.key'` verbatim rather than crashing.
- `$t('settings.audio.music_volume')` returns `'Music Volume'` after `en.json` is loaded.
- Pluralization: `$t('facts.count', { count: 1 }, 1)` → `'1 fact'`; `$t('facts.count', { count: 5 }, 5)` → `'5 facts'`.

---

### 40.2 — String Extraction and Key Catalog

**Goal**: Extract all hard-coded English strings from Svelte components into `src/i18n/locales/en.json`. This is a mechanical but exhaustive task.

#### 2.2.1 Canonical Key Structure

The `en.json` file uses a nested structure where the top-level key matches the Svelte component or domain:

```
common.*         — Shared across multiple components (OK, Cancel, Close, Save, Back, etc.)
hub.*            — HubView, DomeView, BaseView
settings.*       — Settings.svelte
quiz.*           — QuizOverlay.svelte
hud.*            — HUD.svelte
onboarding.*     — OnboardingCutscene, GaiaIntro, AgeSelection
auth.*           — LoginView, RegisterView, ForgotPasswordView, ProfileView
legal.*          — AgeGate, PrivacyPolicy, TermsOfService
profiles.*       — ProfileSelectView, ProfileCreateView, ProfileManageView
dive.*           — DivePrepScreen, DiveResults, ResumeDiveModal
inventory.*      — BackpackOverlay, SendUpOverlay
study.*          — StudySession, FactReveal
gaia.*           — GaiaReport, GaiaToast, GaiaThoughtBubble
social.*         — LeaderboardView, DuelView, TradeMarketView, GuildView, ReferralModal
season.*         — SeasonPassView, SeasonBanner
monetization.*   — TerraPassModal, PioneerPackModal
notifications.*  — NotificationPermissionPrompt
settings_lang.*  — LanguageModePanel, LanguageProgressPanel (language-learning settings, not UI locale)
errors.*         — ErrorBoundary, OfflineToast
format.*         — Number/date format helpers used in formatters.ts
```

#### 2.2.2 Create `src/i18n/locales/en.json`

This is the canonical source for all UI text. The file must be complete before any other locale can be bootstrapped. A representative excerpt (workers must complete the full extraction):

```json
{
  "common": {
    "ok": "OK",
    "cancel": "Cancel",
    "close": "Close",
    "save": "Save",
    "back": "Back",
    "confirm": "Confirm",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Something went wrong.",
    "retry": "Retry",
    "or": "or",
    "of": "of",
    "days": { "one": "{count} day", "other": "{count} days" },
    "hours": { "one": "{count} hour", "other": "{count} hours" },
    "minutes": { "one": "{count} minute", "other": "{count} minutes" }
  },

  "hub": {
    "dive_button": "Dive",
    "enter_mine": "Enter Mine",
    "title": "Terra Gacha",
    "rooms": {
      "command": "Command",
      "workshop": "Workshop",
      "lab": "Lab",
      "archive": "Archive",
      "market": "Market",
      "museum": "Museum"
    },
    "floor_locked": "Floor Locked",
    "unlock_for": "Unlock for {cost} dust",
    "daily_briefing": "Daily Briefing",
    "gaia_report": "GAIA Report"
  },

  "settings": {
    "title": "Settings",
    "display": "Display",
    "sprite_quality": "Sprite Quality",
    "sprite_quality_low": "Low (32px)",
    "sprite_quality_high": "High (256px)",
    "audio": {
      "title": "Audio",
      "music": "Music",
      "sfx": "Sound Effects",
      "music_volume": "Music Volume",
      "sfx_volume": "SFX Volume"
    },
    "gaia": {
      "title": "GAIA Personality",
      "mood": "Mood",
      "mood_snarky": "Snarky",
      "mood_enthusiastic": "Enthusiastic",
      "mood_calm": "Calm",
      "chattiness": "Chattiness",
      "explanations": "Show explanations after wrong answers"
    },
    "accessibility": {
      "title": "Accessibility",
      "high_contrast_quiz": "High Contrast Quiz",
      "reduced_motion": "Reduced Motion"
    },
    "learning": {
      "title": "Learning",
      "interest_settings": "Interest Settings",
      "language_mode": "Language Mode"
    },
    "language": {
      "title": "Language",
      "ui_language": "Interface Language",
      "auto_detected": "Auto-detected"
    },
    "account": {
      "title": "Account",
      "profile": "Profile",
      "login": "Log In",
      "logout": "Log Out"
    },
    "danger": {
      "title": "Danger Zone",
      "delete_save": "Delete Save Data",
      "delete_confirm": "This will permanently delete all progress. Are you sure?",
      "delete_yes": "Yes, delete everything"
    }
  },

  "quiz": {
    "correct": "Correct!",
    "wrong": "Wrong",
    "question_of": "Question {current} of {total}",
    "skip": "Skip",
    "explanation": "Explanation",
    "streak": { "one": "{count} streak", "other": "{count} streak" }
  },

  "hud": {
    "oxygen": "O₂",
    "depth": "Layer {layer}",
    "inventory": "Inventory",
    "send_up": "Send Up",
    "return": "Return to Dome"
  },

  "dive": {
    "prep_title": "Pre-Dive Prep",
    "pickaxe": "Pickaxe",
    "consumables": "Consumables",
    "companion": "Companion",
    "relics": "Relics",
    "start_dive": "Start Dive",
    "resume_title": "Resume Dive?",
    "resume_desc": "You have an unfinished dive at layer {layer}. Continue or start fresh?",
    "resume_continue": "Continue Dive",
    "resume_fresh": "Start Fresh",
    "results_title": "Dive Results",
    "results_depth": "Deepest Layer",
    "results_blocks": "Blocks Mined",
    "results_facts": "Facts Learned",
    "results_minerals": "Minerals Collected",
    "return_dome": "Return to Dome"
  },

  "auth": {
    "login_title": "Log In",
    "register_title": "Create Account",
    "forgot_title": "Reset Password",
    "email": "Email",
    "password": "Password",
    "username": "Username",
    "login_button": "Log In",
    "register_button": "Create Account",
    "forgot_button": "Send Reset Link",
    "no_account": "No account?",
    "have_account": "Already have an account?",
    "play_as_guest": "Play as Guest",
    "forgot_password": "Forgot password?",
    "reset_sent": "Reset link sent to {email}",
    "logout": "Log Out",
    "account_deleted": "Account deleted."
  },

  "legal": {
    "age_gate_title": "How old are you?",
    "age_gate_under_13": "Under 13",
    "age_gate_13_17": "13–17",
    "age_gate_18_plus": "18+",
    "age_gate_continue": "Continue",
    "privacy_title": "Privacy Policy",
    "terms_title": "Terms of Service",
    "accept": "I Accept"
  },

  "profiles": {
    "select_title": "Who's playing?",
    "create_title": "New Profile",
    "name_placeholder": "Enter name",
    "create_button": "Create Profile",
    "manage_title": "Manage Profiles",
    "delete_profile": "Delete Profile"
  },

  "onboarding": {
    "next": "Next",
    "skip": "Skip",
    "start": "Begin",
    "gaia_intro_1": "GAIA online. Welcome, pilot.",
    "age_selection_title": "First, tell us your age so we can tailor content for you."
  },

  "social": {
    "leaderboard_title": "Leaderboard",
    "duel_title": "Knowledge Duel",
    "trade_title": "Artifact Market",
    "guild_title": "Guild",
    "referral_title": "Invite a Friend",
    "duel_challenge": "Challenge",
    "duel_accept": "Accept",
    "duel_decline": "Decline",
    "guild_create": "Create Guild",
    "guild_join": "Join Guild"
  },

  "season": {
    "title": "Season Pass",
    "free_track": "Free Track",
    "premium_track": "Terra Pass",
    "milestone": "Milestone {n}",
    "claim": "Claim",
    "locked": "Locked"
  },

  "monetization": {
    "terra_pass_title": "Terra Pass",
    "terra_pass_price": "$4.99 / month",
    "pioneer_pack_title": "Pioneer Pack",
    "unlock_button": "Unlock",
    "restore_purchases": "Restore Purchases",
    "content_gate_desc": "Unlock unlimited facts and go ad-free.",
    "facts_progress": "{current} of {target} facts available"
  },

  "errors": {
    "offline": "You are offline. Some features are unavailable.",
    "sync_failed": "Sync failed. Changes will sync when you reconnect.",
    "webgl_unsupported": "Your device does not support WebGL. Please use a modern browser.",
    "generic": "An error occurred. Please try again."
  },

  "format": {
    "date_short": "{month}/{day}/{year}",
    "number_separator": ","
  }
}
```

#### 2.2.3 Update Each Component to Use `$t()`

For every Svelte component, replace hard-coded English strings with `$t('key')`. Pattern:

```svelte
<!-- Before -->
<button>Dive</button>

<!-- After -->
<script lang="ts">
  import { t } from '../../i18n'
</script>
<button>{$t('hub.dive_button')}</button>
```

For dynamic strings with variables:

```svelte
<!-- Before -->
<span>Layer {currentLayer} of 20</span>

<!-- After -->
<span>{$t('hud.depth', { layer: currentLayer })}</span>
```

For pluralization:

```svelte
<!-- Before -->
<span>{factCount} fact{factCount === 1 ? '' : 's'}</span>

<!-- After -->
<span>{$t('quiz.facts_count', { count: factCount }, factCount)}</span>
```

**Priority order for component updates** (workers tackle in this sequence):

1. `Settings.svelte` — high visibility, validates the framework end-to-end
2. `HubView.svelte` and `DomeView.svelte` — main screens
3. `QuizOverlay.svelte` — core gameplay loop
4. `HUD.svelte`
5. `DivePrepScreen.svelte` and `DiveResults.svelte`
6. `BaseView.svelte`
7. Auth components (`LoginView`, `RegisterView`, `ForgotPasswordView`, `ProfileView`)
8. Legal components (`AgeGate`, `PrivacyPolicy`, `TermsOfService`)
9. Profile components (`ProfileSelectView`, `ProfileCreateView`, `ProfileManageView`)
10. Social components (`LeaderboardView`, `DuelView`, `TradeMarketView`, `GuildView`, `ReferralModal`)
11. All remaining components in alphabetical order

#### Acceptance Criteria 40.2

- `src/i18n/locales/en.json` exists and is valid JSON.
- Every hard-coded English string in Priority 1–5 components is replaced with `$t()`.
- `npm run typecheck` passes with zero new errors.
- No component renders a raw i18n key (e.g., `hub.dive_button`) in the `en` locale.
- The full string count in `en.json` is verified by running `node -e "console.log(Object.keys(require('./src/i18n/locales/en.json')).length)"` — any missing top-level keys are a bug.

---

### 40.3 — Translation Pipeline

**Goal**: Produce the complete `es.json`, `fr.json`, `de.json`, `ja.json` locale files. Establish conventions for pluralization, interpolation format, and placeholder protection so translators cannot accidentally break variables.

#### 2.3.1 Locale File Structure

Every locale file mirrors `en.json`'s key structure exactly. Missing keys fall through to English automatically via the fallback chain in the `t()` function.

```json
// src/i18n/locales/es.json — example excerpt
{
  "common": {
    "ok": "OK",
    "cancel": "Cancelar",
    "close": "Cerrar",
    "save": "Guardar",
    "back": "Volver",
    "days": { "one": "{count} día", "other": "{count} días" }
  },
  "hub": {
    "dive_button": "Bucear",
    "enter_mine": "Entrar a la Mina",
    "title": "Terra Gacha"
  },
  "quiz": {
    "correct": "¡Correcto!",
    "wrong": "Incorrecto"
  }
}
```

**Translator Notes** (embed these in a `_meta` key that the `t()` function ignores):

```json
{
  "_meta": {
    "language": "Spanish",
    "locale": "es",
    "last_updated": "2026-03-04",
    "translator": "placeholder — replace with human translator name",
    "instructions": "Do NOT translate text in {curly_braces}. These are variable placeholders. Keep all JSON key names in English. Preserve punctuation style of the original."
  }
}
```

#### 2.3.2 Pluralization Rules Reference

Each locale must define plural forms matching the locale's grammar. The `pluralRules` function in `LOCALE_META` determines which form key is selected:

| Locale | Forms Used   | Example Rule                              |
|--------|-------------|-------------------------------------------|
| en     | one, other  | n===1 → "one"; else → "other"             |
| es     | one, other  | n===1 → "one"; else → "other"             |
| fr     | one, other  | n<=1 → "one"; else → "other"              |
| de     | one, other  | n===1 → "one"; else → "other"             |
| ja     | other only  | Always → "other" (no grammatical plural)  |
| ar     | zero, one, two, few, many, other | Complex CLDR rule (implemented in LOCALE_META) |
| he     | one, other  | n===1 → "one"; else → "other"             |

#### 2.3.3 Create `src/i18n/scripts/validate-locale.mjs`

A build-time validation script that checks locale files for:
- All keys present in `en.json` exist in the target locale (warnings, not errors, since partial translations are acceptable)
- All `{variable}` placeholders from `en.json` are present in the corresponding translation
- No extra keys exist that are not in `en.json` (typo guard)

```javascript
// src/i18n/scripts/validate-locale.mjs
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const localesDir = new URL('../locales/', import.meta.url).pathname
const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'))

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') keys.push(full)
    else if (typeof v === 'object') keys.push(...flattenKeys(v, full))
  }
  return keys
}

function extractVars(str) {
  return [...str.matchAll(/\{(\w+)\}/g)].map(m => m[1])
}

const enKeys = flattenKeys(en)
const files = readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json')

for (const file of files) {
  const code = file.replace('.json', '')
  const locale = JSON.parse(readFileSync(join(localesDir, file), 'utf8'))
  const localeKeys = flattenKeys(locale)
  const missing = enKeys.filter(k => !localeKeys.includes(k))
  if (missing.length > 0) {
    console.warn(`[${code}] ${missing.length} missing keys (will fall back to English):`)
    missing.slice(0, 10).forEach(k => console.warn(`  - ${k}`))
    if (missing.length > 10) console.warn(`  ... and ${missing.length - 10} more`)
  } else {
    console.log(`[${code}] OK — all ${enKeys.length} keys present`)
  }
}
```

Add to `package.json`:

```json
{
  "scripts": {
    "i18n:validate": "node src/i18n/scripts/validate-locale.mjs"
  }
}
```

#### Acceptance Criteria 40.3

- `src/i18n/locales/es.json`, `fr.json`, `de.json`, `ja.json` exist with at minimum the `common`, `hub`, `quiz`, `hud`, `settings`, and `auth` sections fully translated.
- `npm run i18n:validate` exits 0 with warnings only (no errors).
- Switching to `es` in the language selector renders the Settings screen in Spanish.
- All `{variable}` placeholders are preserved in translated strings (validated by `validate-locale.mjs`).

---

### 40.4 — RTL Support

**Goal**: The full game UI mirrors correctly for Arabic and Hebrew. No text overflows, no icon mis-alignment, no broken flex layouts.

#### 2.4.1 Document Root Direction

The `locale.subscribe` handler in `src/i18n/index.ts` (40.1) already sets `document.documentElement.dir`. This is sufficient for browsers to flip `text-align: start`, `margin-inline-start`, and `padding-inline-start` — but only if CSS is written with logical properties.

#### 2.4.2 Create `src/ui/styles/rtl.css`

This file patches any components that use physical CSS properties (`margin-left`, `padding-right`, `left`, `right`, `text-align: left`) and need manual RTL overrides. It is loaded unconditionally; rules only fire when `[dir=rtl]` is on the root.

```css
/* src/ui/styles/rtl.css
 * RTL layout overrides for Arabic and Hebrew support.
 * All rules are scoped to [dir=rtl] so they are inert for LTR locales.
 * Prefer CSS logical properties (margin-inline-start, etc.) in new code
 * to avoid adding overrides here.
 */

/* Flip flex row directions */
[dir=rtl] .flex-row-ltr {
  flex-direction: row-reverse;
}

/* Reverse icon-label pairs (e.g., flag + language name buttons) */
[dir=rtl] .lang-option,
[dir=rtl] .level-option {
  flex-direction: row-reverse;
}

/* HUD element positions */
[dir=rtl] .hud-left {
  left: auto;
  right: 16px;
}
[dir=rtl] .hud-right {
  right: auto;
  left: 16px;
}

/* Text alignment on labels */
[dir=rtl] .field-label,
[dir=rtl] .track-label {
  text-align: right;
}

/* Progress bar fill — stays left-to-right regardless of dir,
   because progress direction is universally LTR by convention */
[dir=rtl] .track-fill,
[dir=rtl] .milestone-fill {
  margin-left: 0;
  /* Override any forced right-origin from browser RTL mirroring */
}

/* Settings sections — icon + label rows */
[dir=rtl] .settings-row {
  flex-direction: row-reverse;
  text-align: right;
}

/* Close button position (top-right in LTR = top-left in RTL) */
[dir=rtl] .close-x {
  margin-left: 0;
  margin-right: auto;
}

/* Modal panels — padding side */
[dir=rtl] .lang-panel,
[dir=rtl] .settings-panel {
  text-align: right;
}

/* Input fields — text aligns right in RTL */
[dir=rtl] input[type=text],
[dir=rtl] input[type=email],
[dir=rtl] input[type=password] {
  text-align: right;
}
```

Import `rtl.css` in `src/app.css`:

```css
/* src/app.css — add at end */
@import './ui/styles/rtl.css';
```

#### 2.4.3 RTL-Aware Svelte Components

For the most complex RTL layouts (the HUD and the quiz overlay), add a reactive `$derived` that reads from the locale store:

```svelte
<!-- Example in HUD.svelte -->
<script lang="ts">
  import { locale, LOCALE_META } from '../../i18n'
  const isRtl = $derived(LOCALE_META[$locale].rtl)
</script>

<div class="hud" class:rtl={isRtl}>
  ...
</div>
```

#### 2.4.4 Phaser Canvas — RTL Does Not Apply

The Phaser canvas renders everything internally; CSS `dir` does not flip it. Phaser text objects in the mining scenes use `setRTL(true)` only when the locale is RTL:

```typescript
// src/game/scenes/MineScene.ts — wherever text objects are created
import { get } from 'svelte/store'
import { locale, LOCALE_META } from '../../i18n'

function isRtlLocale(): boolean {
  return LOCALE_META[get(locale)].rtl
}

// When creating Phaser text:
this.add.text(x, y, text, { rtl: isRtlLocale(), ... })
```

#### Acceptance Criteria 40.4

- Setting locale to `ar` applies `dir="rtl"` to `<html>`.
- The Settings screen mirrors correctly (labels on the right, controls on the left).
- No text overflows any container when locale is `ar` or `he`.
- The HUD layout mirrors (O2 indicator and inventory icons swap sides).
- Progress bars remain left-to-right (progress direction is locale-independent by convention).
- Switching back to `en` restores `dir="ltr"` immediately without a page reload.

---

### 40.5 — Locale-Specific Formatting

**Goal**: All dates, times, numbers, and currency in the UI are formatted via the browser's `Intl` API so they follow locale conventions automatically. No more hard-coded `"/"` date separators or `","` thousand separators.

#### 2.5.1 Create `src/i18n/formatters.ts`

```typescript
// src/i18n/formatters.ts
import { get } from 'svelte/store'
import { locale } from './index'

/**
 * Returns the BCP 47 locale tag for the current UI locale.
 * Maps our internal code to a full tag for the Intl API.
 */
function bcp47(): string {
  const code = get(locale)
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-419', // Latin American Spanish (broadest coverage)
    fr: 'fr-FR',
    de: 'de-DE',
    ja: 'ja-JP',
    ar: 'ar-SA',
    he: 'he-IL',
  }
  return map[code] ?? 'en-US'
}

/**
 * Formats an integer or float with locale-appropriate thousand separators.
 * @example formatNumber(1234567) → "1,234,567" (en) | "1.234.567" (de)
 */
export function formatNumber(n: number, decimals?: number): string {
  return new Intl.NumberFormat(bcp47(), {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(n)
}

/**
 * Formats a currency amount in the player's locale.
 * Uses USD as the base currency for all IAP prices (server-side currency
 * conversion is out of scope for this phase).
 * @example formatCurrency(4.99) → "$4.99" (en) | "4,99 $" (fr)
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(bcp47(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formats a Date object as a short date (month/day/year or locale equivalent).
 * @example formatDate(new Date()) → "3/4/2026" (en) | "4/3/2026" (de, day first)
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(bcp47(), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

/**
 * Formats a Date object as a relative time string ("3 days ago", "in 2 hours").
 * Falls back to absolute date if RelativeTimeFormat is unavailable.
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  try {
    const rtf = new Intl.RelativeTimeFormat(bcp47(), { numeric: 'auto' })
    if (Math.abs(diffDay) >= 1) return rtf.format(diffDay, 'day')
    if (Math.abs(diffHour) >= 1) return rtf.format(diffHour, 'hour')
    if (Math.abs(diffMin) >= 1) return rtf.format(diffMin, 'minute')
    return rtf.format(diffSec, 'second')
  } catch {
    return formatDate(date)
  }
}

/**
 * Formats a streak count as a locale-aware ordinal string where applicable.
 * Falls back to a plain number if PluralRules is unavailable.
 * @example formatStreak(7) → "7-day streak" (en)
 */
export function formatStreak(days: number): string {
  // Delegate to the i18n key which handles pluralization
  // This is a helper to make the call site cleaner
  return String(days)
}

/**
 * Formats an O2 value with at most 1 decimal place.
 */
export function formatOxygen(value: number): string {
  return formatNumber(value, 1)
}
```

#### 2.5.2 Replace Hard-Coded Format Calls Across the Codebase

Search for patterns using Grep and replace with `formatters.ts` calls:

- `toFixed(` → replace with `formatNumber(n, decimals)`
- Date string construction like `new Date().toLocaleDateString()` → `formatDate(new Date())`
- `$` + price literal in UI strings → `formatCurrency(price)`
- Mineral counts displayed in HUD/BackpackOverlay → `formatNumber(count)`

Key files to update:

- `src/ui/components/HUD.svelte` — mineral and O2 display
- `src/ui/components/BackpackOverlay.svelte` — mineral counts
- `src/ui/components/DiveResults.svelte` — minerals collected, depth
- `src/ui/components/StreakPanel.svelte` — streak day count
- `src/ui/components/LeaderboardView.svelte` — score formatting
- `src/ui/components/TerraPassModal.svelte` — price display
- `src/ui/components/SeasonPassView.svelte` — milestone numbers
- `src/ui/components/GaiaReport.svelte` — stat numbers

#### Acceptance Criteria 40.5

- Numbers in the HUD (mineral counts, oxygen) render with locale-appropriate thousand separators (e.g., `1.234` in German, `1,234` in English).
- IAP price `4.99` renders as `$4.99` in `en`, `4,99 $` in `fr`.
- All date displays (streak dates, last-dive date, season end date) use locale-aware formatting.
- `npm run typecheck` passes.

---

### 40.6 — Content Localization

**Goal**: Establish a workflow so that translated versions of quiz facts can be stored in the facts database and served to players in their UI locale. This phase does not fully translate the 522 facts — it creates the schema and pipeline so translations can be added incrementally.

#### 2.6.1 Database Schema Extension

The facts database (`facts.db`, managed by `src/services/factsDB.ts`) currently has a `facts` table with English-only text columns. Add a `fact_translations` table to hold localized content.

**SQL schema change** (to be applied in `build-facts-db.mjs` during the next DB build):

```sql
CREATE TABLE IF NOT EXISTS fact_translations (
  id          TEXT NOT NULL,          -- matches facts.id
  locale      TEXT NOT NULL,          -- ISO 639-1 code: 'es', 'fr', etc.
  statement   TEXT NOT NULL,
  quiz_question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors TEXT NOT NULL,          -- JSON array of strings
  wow_factor  TEXT,
  explanation TEXT,
  PRIMARY KEY (id, locale)
);

CREATE INDEX IF NOT EXISTS idx_fact_translations_locale ON fact_translations (locale);
```

Note: This schema change MUST be reviewed with the user before implementing (CLAUDE.md rule: "MUST ASK before modifying database schemas"). The schema design is documented here as the specification; the actual `build-facts-db.mjs` migration is gated on explicit user approval.

#### 2.6.2 Update `factsDB.ts` — Localized Fact Query

Add a method that returns a fact in the player's locale if a translation exists, falling back to English:

```typescript
// src/services/factsDB.ts — add method to FactsDB class

/**
 * Returns a fact's content in the player's locale if a translation exists.
 * Falls back to the English content if no translation is available.
 *
 * @param factId - The fact ID to look up.
 * @param locale - The target locale code (e.g., 'es', 'fr').
 * @returns The fact with localized text fields, or null if not found.
 */
async getLocalizedFact(factId: string, locale: string): Promise<Fact | null> {
  if (!this.db) await this.init()

  // Try localized version first
  if (locale !== 'en') {
    const result = this.db!.exec(
      `SELECT f.*, ft.statement, ft.quiz_question, ft.correct_answer, ft.distractors,
              ft.wow_factor, ft.explanation
       FROM facts f
       LEFT JOIN fact_translations ft ON ft.id = f.id AND ft.locale = ?
       WHERE f.id = ?`,
      [locale, factId]
    )
    if (result[0]?.values?.length > 0) {
      return this.rowToFact(result[0], true /* has translation override */)
    }
  }

  // Fall back to English
  return this.getFact(factId)
}
```

#### 2.6.3 Translation Export Script — `src/i18n/scripts/export-facts-for-translation.mjs`

A Node.js script that exports English facts to a CSV or JSON format suitable for sending to human translators. The export includes only the columns that need translation (statement, quiz_question, correct_answer, distractors, explanation) and excludes metadata columns.

```javascript
// src/i18n/scripts/export-facts-for-translation.mjs
import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync } from 'fs'

const SQL = await initSqlJs()
const dbBuffer = readFileSync('public/facts.db')
const db = new SQL.Database(new Uint8Array(dbBuffer))

const results = db.exec(`
  SELECT id, statement, quiz_question, correct_answer, distractors, wow_factor, explanation
  FROM facts
  WHERE status = 'approved'
  ORDER BY category
`)

const rows = results[0].values.map(row => ({
  id: row[0],
  statement: row[1],
  quiz_question: row[2],
  correct_answer: row[3],
  distractors: row[4], // JSON string
  wow_factor: row[5],
  explanation: row[6],
  // Blank fields for translator to fill:
  statement_TRANSLATED: '',
  quiz_question_TRANSLATED: '',
  correct_answer_TRANSLATED: '',
  distractors_TRANSLATED: '',
  wow_factor_TRANSLATED: '',
  explanation_TRANSLATED: '',
}))

writeFileSync(
  'src/i18n/scripts/facts-export.json',
  JSON.stringify(rows, null, 2)
)

console.log(`Exported ${rows.length} facts for translation.`)
db.close()
```

Add to `package.json`:
```json
{
  "scripts": {
    "i18n:export-facts": "node src/i18n/scripts/export-facts-for-translation.mjs"
  }
}
```

#### Acceptance Criteria 40.6

- `fact_translations` table schema is documented (actual migration gated on user approval).
- `getLocalizedFact()` stub is written and compiles.
- `npm run i18n:export-facts` generates `facts-export.json` with all approved English facts.
- Switching locale to `es` when no `fact_translations` rows exist still shows English facts (graceful fallback, no crash).

---

### 40.7 — Language Selector UI

**Goal**: Players can select their UI language from Settings. The selector shows flag, native name, and a visual indicator of translation completeness. Auto-detected locale is shown with a badge. Change takes effect immediately without a reload.

#### 2.7.1 Create `src/ui/components/LanguageSelector.svelte`

```svelte
<!-- src/ui/components/LanguageSelector.svelte -->
<script lang="ts">
  import { locale, LOCALE_META, SUPPORTED_LOCALES, detectLocale } from '../../i18n'
  import { t } from '../../i18n'
  import type { LocaleCode } from '../../i18n'

  /** Called when the user closes this panel */
  export let onClose: (() => void) | undefined = undefined

  const autoDetected: LocaleCode = detectLocale()
  let selected: LocaleCode = $locale

  /**
   * Returns a rough completeness percentage for a locale.
   * In production this would be derived from the validate-locale script output.
   * For now it returns 100% for English and estimated values for others.
   */
  function completeness(code: LocaleCode): number {
    const map: Record<LocaleCode, number> = {
      en: 100, es: 85, fr: 85, de: 80, ja: 75, ar: 60, he: 60,
    }
    return map[code] ?? 0
  }

  function handleSelect(code: LocaleCode): void {
    selected = code
    locale.set(code)
  }

  function handleClose(): void {
    if (onClose) onClose()
  }
</script>

<div class="lang-selector-overlay" role="dialog" aria-label={$t('settings.language.ui_language')}>
  <div class="lang-selector-panel">
    <div class="panel-header">
      <h2>{$t('settings.language.ui_language')}</h2>
      <button class="close-x" onclick={handleClose} aria-label={$t('common.close')}>&times;</button>
    </div>

    <div class="locale-list">
      {#each SUPPORTED_LOCALES as code}
        {@const meta = LOCALE_META[code]}
        {@const pct = completeness(code)}
        <button
          class="locale-row"
          class:active={selected === code}
          onclick={() => handleSelect(code)}
          aria-pressed={selected === code}
        >
          <span class="locale-flag">{meta.flag}</span>
          <div class="locale-labels">
            <span class="locale-native">{meta.nativeName}</span>
            <span class="locale-english">{meta.name}</span>
          </div>
          <div class="locale-right">
            {#if code === autoDetected}
              <span class="auto-badge">{$t('settings.language.auto_detected')}</span>
            {/if}
            {#if pct < 100}
              <span class="pct-label">{pct}%</span>
            {/if}
            {#if selected === code}
              <span class="checkmark" aria-hidden="true">✓</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    {#if completeness(selected) < 100}
      <p class="translation-note">
        Some text may appear in English until this language is fully translated.
      </p>
    {/if}
  </div>
</div>

<style>
  .lang-selector-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
    padding: 20px;
  }
  .lang-selector-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    border: 1px solid #0f3460;
    max-height: 80vh;
    overflow-y: auto;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .panel-header h2 {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #e94560;
    margin: 0;
  }
  .close-x {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
  }
  .locale-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .locale-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #0f3460;
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    width: 100%;
    color: #e0e0e0;
    text-align: left;
    transition: border-color 0.15s;
  }
  .locale-row.active {
    border-color: #e94560;
  }
  .locale-row:hover {
    border-color: #555;
  }
  .locale-flag {
    font-size: 22px;
    flex-shrink: 0;
  }
  .locale-labels {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .locale-native {
    font-size: 14px;
    font-weight: bold;
    color: #e0e0e0;
  }
  .locale-english {
    font-size: 11px;
    color: #888;
  }
  .locale-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .auto-badge {
    background: #1a6040;
    color: #4caf50;
    font-size: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
  }
  .pct-label {
    font-size: 10px;
    color: #888;
  }
  .checkmark {
    color: #e94560;
    font-size: 16px;
  }
  .translation-note {
    margin-top: 14px;
    font-size: 11px;
    color: #888;
    line-height: 1.5;
    text-align: center;
    border-top: 1px solid #222;
    padding-top: 12px;
  }
</style>
```

#### 2.7.2 Wire LanguageSelector into `Settings.svelte`

Add a new "Language" section to `Settings.svelte`, after the Accessibility section:

```svelte
<!-- In Settings.svelte — add Language section -->
<script lang="ts">
  // ... existing imports ...
  import LanguageSelector from './LanguageSelector.svelte'
  import { locale, LOCALE_META } from '../../i18n'
  import { t } from '../../i18n'

  let showLanguageSelector = $state(false)
</script>

<!-- In the settings body: -->
<section class="settings-section">
  <h3>{$t('settings.language.title')}</h3>
  <button class="settings-row" onclick={() => { showLanguageSelector = true }}>
    <span class="row-label">{$t('settings.language.ui_language')}</span>
    <span class="row-value">
      {LOCALE_META[$locale].flag} {LOCALE_META[$locale].nativeName}
    </span>
  </button>
</section>

{#if showLanguageSelector}
  <LanguageSelector onClose={() => { showLanguageSelector = false }} />
{/if}
```

#### 2.7.3 Wire into `src/app.css`

The `rtl.css` import was added in 40.4. Confirm it is present; no additional changes needed.

#### Acceptance Criteria 40.7

- A "Language" section appears in Settings with the current locale's flag and native name.
- Tapping the section opens the `LanguageSelector` panel.
- Selecting Spanish immediately re-renders all translated strings on-screen in Spanish without a page reload.
- The auto-detected locale shows the "Auto-detected" badge.
- Locales with <100% translation completeness show the percentage.
- The selector closes when the `×` button is tapped.
- Locale choice persists across page reloads (stored in localStorage).

---

## 3. Playwright Visual Tests

All tests assume the dev server is running at `http://localhost:5173`.

### Test 1 — English Baseline

```javascript
// Write to /tmp/test-i18n-en.js and run with: node /tmp/test-i18n-en.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Force English locale
  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.setItem('terra_ui_locale', 'en'))
  await page.reload()

  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/i18n-en-hub.png' })

  // Open Settings and confirm English strings
  await page.click('button[aria-label="Settings"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/i18n-en-settings.png' })

  // Verify Language section is visible
  const langSection = await page.textContent('text=Interface Language')
  console.log('Language section:', langSection ? 'PASS' : 'FAIL — not found')

  await browser.close()
  console.log('Screenshots saved: /tmp/i18n-en-hub.png, /tmp/i18n-en-settings.png')
})()
```

### Test 2 — Spanish Locale Switching

```javascript
// Write to /tmp/test-i18n-es.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.setItem('terra_ui_locale', 'es'))
  await page.reload()

  await page.waitForSelector('button', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/i18n-es-hub.png' })

  // Confirm "Bucear" (Spanish for "Dive") is present
  const diveBtn = await page.$('button:has-text("Bucear")')
  console.log('Spanish Dive button:', diveBtn ? 'PASS' : 'FAIL — not found')

  // Open Settings
  await page.click('button[aria-label="Settings"]')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/i18n-es-settings.png' })

  await browser.close()
  console.log('Screenshots: /tmp/i18n-es-hub.png, /tmp/i18n-es-settings.png')
})()
```

### Test 3 — RTL Layout (Arabic)

```javascript
// Write to /tmp/test-i18n-rtl.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.setItem('terra_ui_locale', 'ar'))
  await page.reload()

  await page.waitForSelector('html[dir=rtl]', { timeout: 10000 })

  // Confirm dir=rtl applied
  const dir = await page.evaluate(() => document.documentElement.dir)
  console.log('RTL applied:', dir === 'rtl' ? 'PASS' : 'FAIL — dir=' + dir)

  // Confirm lang attribute
  const lang = await page.evaluate(() => document.documentElement.lang)
  console.log('lang=ar:', lang === 'ar' ? 'PASS' : 'FAIL — lang=' + lang)

  await page.screenshot({ path: '/tmp/i18n-ar-hub.png', fullPage: false })

  await browser.close()
  console.log('Screenshot: /tmp/i18n-ar-hub.png')
})()
```

### Test 4 — Number Formatting

```javascript
// Write to /tmp/test-i18n-format.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Test German number formatting (periods as thousand separators)
  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.setItem('terra_ui_locale', 'de'))
  await page.reload()
  await page.waitForTimeout(2000)

  // Inject formatters and verify
  const formatted = await page.evaluate(() => {
    // @ts-ignore — evaluate in browser context
    const n = 1234567
    return new Intl.NumberFormat('de-DE').format(n)
  })
  console.log('German 1234567:', formatted, formatted === '1.234.567' ? 'PASS' : 'FAIL')

  await browser.close()
})()
```

### Test 5 — Language Selector UI Flow

```javascript
// Write to /tmp/test-i18n-selector.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.setItem('terra_ui_locale', 'en'))
  await page.reload()

  await page.waitForSelector('button', { timeout: 15000 })

  // Navigate to Settings
  await page.click('button[aria-label="Settings"]')
  await page.waitForTimeout(500)

  // Click the Language setting row
  await page.click('text=Interface Language')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/i18n-selector-open.png' })

  // Select French
  await page.click('button:has-text("Français")')
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/i18n-selector-fr-applied.png' })

  // Verify French was applied
  const storedLocale = await page.evaluate(() => localStorage.getItem('terra_ui_locale'))
  console.log('Stored locale:', storedLocale === 'fr' ? 'PASS (fr)' : 'FAIL — ' + storedLocale)

  await browser.close()
  console.log('Screenshots: /tmp/i18n-selector-open.png, /tmp/i18n-selector-fr-applied.png')
})()
```

---

## 4. Verification Gate

All of the following must be true before Phase 40 is marked complete:

### 4.1 TypeScript Compilation

```bash
npm run typecheck
```

Expected: 0 errors. Zero new type errors may be introduced.

### 4.2 Build Check

```bash
npm run build
```

Expected: Successful build. Locale JSON files appear as separate chunks in `dist/assets/`. No chunk exceeds 500 KB.

### 4.3 i18n Validation

```bash
npm run i18n:validate
```

Expected: All supported locales (es, fr, de, ja, ar, he) are present in `src/i18n/locales/`. Warnings for missing keys are acceptable; errors are not.

### 4.4 Behavioral Checklist

| # | Check | Method |
|---|-------|--------|
| 1 | English baseline renders correctly — no raw keys visible | Playwright Test 1 + screenshot review |
| 2 | Switching to Spanish re-renders UI in Spanish | Playwright Test 2 |
| 3 | `dir="rtl"` applied when locale is Arabic | Playwright Test 3 |
| 4 | `lang` attribute updated on `<html>` for each locale | Playwright Test 3 |
| 5 | German number formatting uses periods as thousand separators | Playwright Test 4 |
| 6 | Language Selector opens from Settings and changes locale | Playwright Test 5 |
| 7 | Locale choice persists after page reload | Check localStorage after Test 5 |
| 8 | Browser locale `es-MX` auto-selects `es` | Manual test with `navigator.language` override |
| 9 | Fallback: `zh` (unsupported) auto-selects `en` | Manual test |
| 10 | No console errors in any locale | `browser.console_messages()` check |
| 11 | RTL layout — Settings screen mirrors without overflow | Visual review of /tmp/i18n-ar-hub.png |
| 12 | Progress bars remain LTR in Arabic | Visual review |
| 13 | Pluralization: `1 fact` / `2 facts` correct in English | Unit-level browser eval |
| 14 | Pluralization: Arabic uses zero/one/two/few/many/other forms | Browser eval with Arabic locale |
| 15 | `formatCurrency(4.99)` → `$4.99` in English, `4,99 $` in French | Browser eval |

### 4.5 No Regression Check

After completing Phase 40, verify that the following pre-existing flows still work in English:

- Full onboarding cutscene renders (Phase 14)
- Quiz overlay accepts answers (Phase 8)
- GAIA toast shows (Phase 15)
- Settings screen saves GAIA mood preference (Phase 15)
- Dive results screen displays correct mineral counts (Phase 8)

---

## 5. Files Affected

### New Files

| File | Purpose |
|------|---------|
| `src/i18n/index.ts` | i18n engine: locale store, `t()`, `detectLocale()`, `loadLocale()`, `initI18n()` |
| `src/i18n/formatters.ts` | Locale-aware number, date, currency, relative-time formatters using `Intl` API |
| `src/i18n/locales/en.json` | Canonical English strings — all UI text |
| `src/i18n/locales/es.json` | Spanish translation |
| `src/i18n/locales/fr.json` | French translation |
| `src/i18n/locales/de.json` | German translation |
| `src/i18n/locales/ja.json` | Japanese translation |
| `src/i18n/locales/ar.json` | Arabic translation |
| `src/i18n/locales/he.json` | Hebrew translation |
| `src/i18n/scripts/validate-locale.mjs` | Build-time locale completeness validator |
| `src/i18n/scripts/export-facts-for-translation.mjs` | Exports English facts for human translation |
| `src/ui/components/LanguageSelector.svelte` | Language picker UI component |
| `src/ui/styles/rtl.css` | RTL layout overrides |

### Modified Files

| File | Change |
|------|--------|
| `src/main.ts` | Add `initI18n()` call before Svelte mount |
| `src/app.css` | Import `rtl.css` |
| `src/ui/components/Settings.svelte` | Add Language section, import `LanguageSelector` |
| `src/ui/components/HubView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/DomeView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/BaseView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/QuizOverlay.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/HUD.svelte` | Replace strings; use `formatNumber()` for mineral/O2 values |
| `src/ui/components/DivePrepScreen.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/DiveResults.svelte` | Replace strings; use `formatNumber()` |
| `src/ui/components/ResumeDiveModal.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/BackpackOverlay.svelte` | Replace strings; use `formatNumber()` |
| `src/ui/components/SendUpOverlay.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/StudySession.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/FactReveal.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/StreakPanel.svelte` | Replace strings; use `formatNumber()` |
| `src/ui/components/GaiaReport.svelte` | Replace strings; use `formatNumber()` |
| `src/ui/components/GaiaToast.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/GaiaThoughtBubble.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/LeaderboardView.svelte` | Replace strings; use `formatNumber()` |
| `src/ui/components/DuelView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/TradeMarketView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/GuildView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/ReferralModal.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/TerraPassModal.svelte` | Replace strings; use `formatCurrency()` |
| `src/ui/components/PioneerPackModal.svelte` | Replace strings; use `formatCurrency()` |
| `src/ui/components/SeasonPassView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/auth/LoginView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/auth/RegisterView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/auth/ForgotPasswordView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/auth/ProfileView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/legal/AgeGate.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/legal/PrivacyPolicy.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/legal/TermsOfService.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/profiles/ProfileSelectView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/profiles/ProfileCreateView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/profiles/ProfileManageView.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/OnboardingCutscene.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/GaiaIntro.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/AgeSelection.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/ErrorBoundary.svelte` | Replace hard-coded strings with `$t()` |
| `src/ui/components/OfflineToast.svelte` | Replace hard-coded strings with `$t()` |
| `src/services/factsDB.ts` | Add `getLocalizedFact()` method stub |
| `src/game/scenes/MineScene.ts` | Pass `rtl: isRtlLocale()` to Phaser text objects |
| `package.json` | Add `i18n:validate` and `i18n:export-facts` scripts |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src/services/languageService.ts` | Manages in-game language learning content (Phase 24), not UI locale |
| `src/ui/components/LanguageModePanel.svelte` | Manages language learning mode (Phase 24), not UI locale |
| `src/ui/components/LanguageProgressPanel.svelte` | Same — Phase 24 scope |
| `src/data/gaiaDialogue.ts` | GAIA dialogue is English-only content; translation via Phase 46 pipeline |
| `src/data/types.ts` | `Fact` type is unchanged; translation managed via `fact_translations` table |
| `src/data/balance.ts` | Balance constants are not user-visible text |
| `src/game/GameManager.ts` | No user-visible strings in GameManager |

---

## 6. Implementation Notes for Workers

### Do Not Use innerHTML for Translated Content

Per CLAUDE.md security rules, never use `innerHTML` to inject translated strings, even if the source is a JSON file. All string insertion must go through Svelte's text binding (`{$t('key')}`) or `textContent`. This is enforced by the CSP which blocks inline scripts.

### Svelte 5 Runes Compatibility

The `t` store is a standard Svelte readable store. In Svelte 5 components, use the `$` prefix for auto-subscribed reactive access:

```svelte
<!-- Svelte 5 runes — correct usage -->
<span>{$t('common.ok')}</span>

<!-- For non-reactive one-off reads (rare, e.g., initial aria-label) -->
<script>
  import { get } from 'svelte/store'
  import { t } from '../../i18n'
  const label = get(t)('quiz.skip')
</script>
```

### Dynamic Key Construction is Forbidden

Do not build i18n keys dynamically via string concatenation — keys must be statically analyzable so they can be audited:

```typescript
// WRONG — breaks static analysis and causes silent fallbacks
const key = `rooms.${roomId}`
$t(key)

// CORRECT — explicit key mapping
const ROOM_LABELS: Record<string, string> = {
  command: 'hub.rooms.command',
  workshop: 'hub.rooms.workshop',
}
$t(ROOM_LABELS[roomId] ?? 'common.unknown')
```

### JSON Key Naming Conventions

- All keys are `snake_case`.
- Keys are grouped by component/domain, not by string type.
- Never use human-readable strings as keys (e.g., `"Dive"` is not a key; `"hub.dive_button"` is).
- Nesting depth: maximum 3 levels (`settings.audio.music_volume`). Deeper nesting is a signal that the key should be in a different top-level namespace.

### Locale File Ordering

To reduce merge conflicts when multiple contributors work on translation files simultaneously, JSON keys must be sorted alphabetically at each nesting level. The `validate-locale.mjs` script does not enforce this, but code review should.

### When to Use `formatters.ts` vs. `t()` for Numbers

- User-visible **counts and measurements** (minerals, O2, depth): use `formatNumber()`.
- **Currency**: always `formatCurrency()`.
- **Dates**: always `formatDate()` or `formatRelativeTime()`.
- **Static labels that happen to contain numbers** (e.g., "Tier 3" in a button): hardcode the numeral in `en.json` and translate the whole phrase — do not interpolate.

---

*End of Phase 40 document.*
