import type { Screen } from '../ui/stores/gameState'

export type HubScreenName = Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal' | 'leaderboards' | 'deckSelectionHub' | 'triviaDungeon' | 'studyTemple' | 'multiplayerMenu'>

const RUN_LOCKED_SCREENS = new Set<Screen>([
  'combat',
  'cardReward',
  'shopRoom',
  'mysteryEvent',
  'masteryChallenge',
  'restRoom',
  'retreatOrDelve',
])

const HUB_SCREENS = new Set<Screen>([
  'hub',
  'library',
  'settings',
  'profile',
  'journal',
  'leaderboards',
  'deckSelectionHub',
  'triviaDungeon',
  'studyTemple',
  'relicSanctum',
  'mainMenu',
  'base',
  'multiplayerMenu', // Multiplayer mode selection — accessible from hub without a run
])

export function normalizeHomeScreen(screen: Screen): Screen {
  if (screen === 'mainMenu' || screen === 'base') return 'hub'
  return screen
}

export function isRunLockedScreen(screen: Screen): boolean {
  return RUN_LOCKED_SCREENS.has(screen)
}

export function navigateToScreen(target: Screen, current: Screen): Screen {
  if (isRunLockedScreen(current) && current !== target) {
    return current
  }
  return normalizeHomeScreen(target)
}

export function isHubScreen(screen: Screen): screen is HubScreenName {
  return HUB_SCREENS.has(screen)
}
