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
  | 'archetypeSelection'
  | 'library'
  | 'profile'
  | 'journal'
  | 'leaderboards'
  | 'multiplayerLobby' // Multiplayer lobby — mode/deck/house-rules config and player readying
  | 'multiplayerMenu'  // Multiplayer mode selection menu — entry point before lobby creation
  | 'lobbyBrowser'     // Multiplayer lobby browser — lists public lobbies for browsing and joining
  | 'mysteryEvent'
  | 'restRoom'
  | 'runEnd'
  | 'cardReward'
  | 'rewardRoom'
  | 'retreatOrDelve'
  | 'shopRoom'
  | 'specialEvent'
  | 'campfire'
  | 'masteryChallenge'
  | 'relicSanctum'
  | 'relicReward' // deprecated: now handled by rewardRoom Phaser scene
  | 'onboarding'
  | 'settings'
  | 'upgradeSelection'
  | 'postMiniBossRest'
  | 'dungeonMap'
  | 'relicSwapOverlay'
  | 'restStudy'
  | 'restMeditate'
  | 'deckSelectionHub'
  | 'triviaDungeon'
  | 'studyTemple'
  | 'runPreview'
  | 'proceduralStudy' // Procedural math practice session — bypasses combat run
  | 'triviaRound' // Solo Trivia Night screen — wired from multiplayer mode; see BATCH-ULTRA T7 issue-1775873221654-07-004
  | 'raceResults' // Post-race comparison screen — wired from onRaceComplete callback
  // 'starterRelicSelection' removed in AR-59.12 — runs start directly at dungeonMap

const SCREEN_STORAGE_KEY = 'card:currentScreen'

const VALID_SCREENS: Screen[] = [
  'hub',
  'mainMenu',
  'base',
  'combat',
  'archetypeSelection',
  'library',
  'profile',
  'journal',
  'leaderboards',
  'multiplayerLobby',
  'multiplayerMenu',
  'lobbyBrowser',
  'mysteryEvent',
  'restRoom',
  'runEnd',
  'cardReward',
  'rewardRoom',
  'retreatOrDelve',
  'shopRoom',
  'specialEvent',
  'campfire',
  'masteryChallenge',
  'relicSanctum',
  'relicReward',
  'onboarding',
  'settings',
  'upgradeSelection',
  'postMiniBossRest',
  'dungeonMap',
  'relicSwapOverlay',
  'restStudy',
  'restMeditate',
  'deckSelectionHub',
  'triviaDungeon',
  'studyTemple',
  'runPreview',
  'proceduralStudy',
  'triviaRound',
  'raceResults',
  // 'starterRelicSelection' removed AR-59.12
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
  'relicSanctum',
  'deckSelectionHub',
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

/** Direction metadata for screen transitions. */
export type TransitionDirection = 'down' | 'up' | 'left' | 'right' | 'fade' | 'zoom'

/** Current transition direction — consumed by the transition overlay. */
export const screenTransitionDirection = singletonWritable<TransitionDirection>('screenTransitionDirection', 'fade')

/** Controls the dark transition overlay shown during screen changes. */
export const screenTransitionActive = singletonWritable<boolean>('screenTransitionActive', false)

/** Controls the opaque loading cover during asset preloading. */
export const screenTransitionLoading = singletonWritable<boolean>('screenTransitionLoading', true)

/** Set to true when combat ends victoriously, triggering the exit-forward parallax transition. */
export const combatExitRequested = singletonWritable<boolean>('combatExitRequested', false)

/** Stores the defeated enemy's template ID for the exit transition, captured before activeTurnState is cleared. */
export const combatExitEnemyId = singletonWritable<string | null>('combatExitEnemyId', null)

let _transitionTimer: ReturnType<typeof setTimeout> | null = null
let _transitionHeld = false
let _holdSafetyTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Prevents the screen transition overlay from auto-clearing.
 * Call before a screen change when the target screen needs to preload assets.
 * Must be paired with releaseScreenTransition().
 */
export function holdScreenTransition(): void {
  _transitionHeld = true
  screenTransitionLoading.set(true)
  screenTransitionActive.set(false)
  if (_holdSafetyTimer) clearTimeout(_holdSafetyTimer)
  _holdSafetyTimer = setTimeout(() => {
    console.warn('[gameState] Screen transition hold timed out (8s)')
    releaseScreenTransition()
  }, 8000)
}

/**
 * Clears the screen transition overlay after assets are loaded.
 * Safe to call even if holdScreenTransition() was not called.
 */
export function releaseScreenTransition(): void {
  _transitionHeld = false
  if (_holdSafetyTimer) {
    clearTimeout(_holdSafetyTimer)
    _holdSafetyTimer = null
  }
  if (_transitionTimer) {
    clearTimeout(_transitionTimer)
    _transitionTimer = null
  }
  // Switch from opaque loading cover to reveal animation
  screenTransitionLoading.set(false)
  screenTransitionActive.set(true)
  // Auto-clear active after reveal animation completes
  setTimeout(() => {
    screenTransitionActive.set(false)
  }, 500)
}

function inferTransitionDirection(from: Screen, to: Screen): TransitionDirection {
  // Room entries get 3D zoom effect
  if (to === 'combat' || to === 'shopRoom' || to === 'restRoom' || to === 'mysteryEvent' || to === 'cardReward') return 'zoom'
  // Return to hub/map gets zoom too (zoom out feel)
  if (to === 'dungeonMap' && (from === 'combat' || from === 'shopRoom' || from === 'restRoom' || from === 'mysteryEvent' || from === 'cardReward' || from === 'retreatOrDelve')) return 'zoom'
  if (to === 'hub' || to === 'runEnd') return 'zoom'
  if (to === 'retreatOrDelve') return 'zoom'
  return 'fade'
}

if (typeof window !== 'undefined') {
  let _prevScreen: Screen | null = null
  currentScreen.subscribe((screen) => {
    if (_prevScreen !== null && screen !== _prevScreen) {
      const dir = inferTransitionDirection(_prevScreen, screen)
      screenTransitionDirection.set(dir)
      // Show opaque loading cover (not the reveal animation)
      screenTransitionLoading.set(true)
      screenTransitionActive.set(false)
      if (_transitionTimer) clearTimeout(_transitionTimer)
      _transitionTimer = setTimeout(() => {
        if (!_transitionHeld) {
          releaseScreenTransition()
        }
      }, 350)
    }
    _prevScreen = screen
  })

  // Safety: clear initial loading overlay if no screen ever releases it
  setTimeout(() => {
    releaseScreenTransition()
  }, 5000)
}

// =========================================================
// Synergy flash (subtle UI feedback for hidden combos)
// =========================================================

/** Brief flash when a relic synergy activates. Cleared automatically after display. */
export const synergyFlash = singletonWritable<string | null>('synergyFlash', null)

// =========================================================
// Discovery event (AR-59.23: Fact Discovery System)
// =========================================================

// =========================================================
// Post-combat reward reveal
// =========================================================

/** Data bundle for step-by-step reward reveal sequence. */
export interface RewardBundle {
  goldEarned: number
  healAmount: number
  /** AR-262: Accuracy grade from the encounter's charge performance. */
  accuracyGrade?: import('../../services/accuracyGradeSystem').AccuracyGrade
  /** AR-262: Accuracy percentage (0-100) for display. */
  accuracyPct?: number
}

export type RewardRevealStep = 'gold' | 'heal' | 'card'

/** Store holding current reward reveal state (gold → heal → card selection). */
export const activeRewardBundle = singletonWritable<RewardBundle | null>('activeRewardBundle', null)
export const activeRewardRevealStep = singletonWritable<RewardRevealStep>('activeRewardRevealStep', 'gold')
