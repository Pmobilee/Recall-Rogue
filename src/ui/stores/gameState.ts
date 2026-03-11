import { singletonDerived, singletonWritable } from './singletonStore'

// =========================================================
// Screen routing
// =========================================================

/** All top-level UI screens used by routing state. */
export type Screen =
  | 'hub'
  | 'mainMenu'
  | 'base'
  | 'combat'
  | 'domainSelection'
  | 'archetypeSelection'
  | 'library'
  | 'profile'
  | 'journal'
  | 'leaderboards'
  | 'social'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'runEnd'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'shopRoom'
  | 'specialEvent'
  | 'campfire'
  | 'masteryChallenge'
  | 'relicSanctum'
  | 'relicReward'
  | 'onboarding'
  | 'ageSelection'
  | 'settings'
  | 'topicInterests'
  | 'upgradeSelection'
  | 'postMiniBossRest'

const SCREEN_STORAGE_KEY = 'card:currentScreen'

const VALID_SCREENS: Screen[] = [
  'hub',
  'mainMenu',
  'base',
  'combat',
  'domainSelection',
  'archetypeSelection',
  'library',
  'profile',
  'journal',
  'leaderboards',
  'social',
  'roomSelection',
  'mysteryEvent',
  'restRoom',
  'runEnd',
  'cardReward',
  'retreatOrDelve',
  'shopRoom',
  'specialEvent',
  'campfire',
  'masteryChallenge',
  'relicSanctum',
  'relicReward',
  'onboarding',
  'ageSelection',
  'settings',
  'topicInterests',
  'upgradeSelection',
  'postMiniBossRest',
]

const PERSISTABLE_SCREENS = new Set<Screen>([
  'hub',
  'mainMenu',
  'base',
  'library',
  'settings',
  'profile',
  'journal',
  'leaderboards',
  'social',
  'relicSanctum',
  'topicInterests',
])

function normalizeHomeScreen(screen: Screen): Screen {
  if (screen === 'mainMenu' || screen === 'base') return 'hub'
  return screen
}

function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && VALID_SCREENS.includes(value as Screen)
}

function readInitialScreen(): Screen {
  if (typeof window === 'undefined') return 'hub'
  try {
    const raw = window.localStorage.getItem(SCREEN_STORAGE_KEY)
    if (!raw) return 'hub'
    const parsed = JSON.parse(raw) as unknown
    if (!isScreen(parsed)) return 'hub'
    if (!PERSISTABLE_SCREENS.has(parsed)) return 'hub'
    return normalizeHomeScreen(parsed)
  } catch {
    return 'hub'
  }
}

export const currentScreen = singletonWritable<Screen>('currentScreen', readInitialScreen())

if (typeof window !== 'undefined') {
  currentScreen.subscribe((screen) => {
    if (!PERSISTABLE_SCREENS.has(screen)) return
    try {
      const persisted = normalizeHomeScreen(screen)
      window.localStorage.setItem(SCREEN_STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      // Ignore localStorage failures.
    }
  })
}

// =========================================================
// Screen transition overlay
// =========================================================

/** Controls the dark transition overlay shown during screen changes. */
export const screenTransitionActive = singletonWritable<boolean>('screenTransitionActive', false)

let _transitionTimer: ReturnType<typeof setTimeout> | null = null

if (typeof window !== 'undefined') {
  let _prevScreen: Screen | null = null
  currentScreen.subscribe((screen) => {
    if (_prevScreen !== null && screen !== _prevScreen) {
      screenTransitionActive.set(true)
      if (_transitionTimer) clearTimeout(_transitionTimer)
      _transitionTimer = setTimeout(() => {
        screenTransitionActive.set(false)
      }, 350)
    }
    _prevScreen = screen
  })
}

// =========================================================
// Synergy flash (subtle UI feedback for hidden combos)
// =========================================================

/** Brief flash when a relic synergy activates. Cleared automatically after display. */
export const synergyFlash = singletonWritable<string | null>('synergyFlash', null)

// =========================================================
// Post-combat reward reveal
// =========================================================

/** Data bundle for step-by-step reward reveal sequence. */
export interface RewardBundle {
  goldEarned: number
  comboBonus: number
  healAmount: number
}

/** Store holding current reward reveal state (gold → heal → card selection). */
export const activeRewardBundle = singletonWritable<RewardBundle | null>('activeRewardBundle', null)
