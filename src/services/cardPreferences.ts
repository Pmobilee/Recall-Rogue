import { writable } from 'svelte/store'
import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import { MAX_ASCENSION_LEVEL } from './ascension'
import { getBackend } from './storageBackend'

export type DifficultyMode = 'relaxed' | 'normal'
export type TextSize = 'small' | 'medium' | 'large'
export type FontChoice = 'rpg' | 'dyslexic' | 'system'
export type ColorBlindMode = 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia'

export interface OnboardingState {
  hasCompletedOnboarding: boolean
  hasSeenCardTapTooltip: boolean
  hasSeenCastTooltip: boolean
  hasSeenAnswerTooltip: boolean
  hasSeenEndTurnTooltip: boolean
  hasSeenAPTooltip: boolean
  runsCompleted: number
  /** Whether the player has seen the combat tutorial overlay (gates auto-trigger for run/trivia combat). */
  hasSeenCombatTutorial: boolean
  /** Whether the player has seen the study tutorial overlay (gates auto-trigger for study temple). */
  hasSeenStudyTutorial: boolean
  /** Whether the player explicitly dismissed the tutorial early via "Skip Tutorial". */
  tutorialDismissedEarly: boolean
}

export interface AscensionProfile {
  highestUnlockedLevel: number
  selectedLevel: number
}

const defaultOnboardingState: OnboardingState = {
  hasCompletedOnboarding: false,
  hasSeenCardTapTooltip: false,
  hasSeenCastTooltip: false,
  hasSeenAnswerTooltip: false,
  hasSeenEndTurnTooltip: false,
  hasSeenAPTooltip: false,
  runsCompleted: 0,
  hasSeenCombatTutorial: false,
  hasSeenStudyTutorial: false,
  tutorialDismissedEarly: false,
}

const defaultAscensionProfile: AscensionProfile = {
  highestUnlockedLevel: 0,
  selectedLevel: 0,
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = getBackend().readSync(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function persistedWritable<T>(key: string, initial: T): Writable<T> {
  const store = writable<T>(read(key, initial))
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        getBackend().write(key, JSON.stringify(value))
      } catch {
        // ignore storage failures
      }
    })
  }
  return store
}

export const difficultyMode = persistedWritable<DifficultyMode>('card:difficultyMode', 'normal')
export const isSlowReader = persistedWritable<boolean>('card:isSlowReader', false)
export const textSize = persistedWritable<TextSize>('card:textSize', 'medium')
export const fontChoice = persistedWritable<FontChoice>('recall-rogue-font-choice', 'rpg')
export const highContrastMode = persistedWritable<boolean>('card:highContrastMode', false)
export const reduceMotionMode = persistedWritable<boolean>('card:reduceMotionMode', false)
export const colorBlindMode = persistedWritable<ColorBlindMode>('card:colorBlindMode', 'off')
export const onboardingState = persistedWritable<OnboardingState>('card:onboardingState', defaultOnboardingState)
export const ascensionProfile = persistedWritable<AscensionProfile>('card:ascensionProfile', defaultAscensionProfile)

function clampAscensionLevel(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.min(MAX_ASCENSION_LEVEL, Math.floor(level)))
}

function sanitizeAscensionProfile(profile: AscensionProfile): AscensionProfile {
  const highestUnlockedLevel = clampAscensionLevel(profile?.highestUnlockedLevel ?? 0)
  const selectedLevel = Math.min(highestUnlockedLevel, clampAscensionLevel(profile?.selectedLevel ?? 0))
  return {
    highestUnlockedLevel,
    selectedLevel,
  }
}

ascensionProfile.update((profile) => sanitizeAscensionProfile(profile))

/** Display names for difficulty modes. */
export const DIFFICULTY_DISPLAY_NAMES: Record<DifficultyMode, string> = {
  relaxed: 'Relaxed',
  normal: 'Normal',
};

/** Returns the user-facing display name for a difficulty mode. */
export function getDifficultyDisplayName(mode: DifficultyMode): string {
  return DIFFICULTY_DISPLAY_NAMES[mode];
}

export function markOnboardingComplete(): void {
  onboardingState.update((state) => ({
    ...state,
    hasCompletedOnboarding: true,
    runsCompleted: Math.max(1, state.runsCompleted),
  }))
}

export function incrementRunsCompleted(): void {
  onboardingState.update((state) => ({
    ...state,
    runsCompleted: state.runsCompleted + 1,
  }))
}

export function markOnboardingTooltipSeen(
  key: keyof Pick<
    OnboardingState,
    | 'hasSeenCardTapTooltip'
    | 'hasSeenCastTooltip'
    | 'hasSeenAnswerTooltip'
    | 'hasSeenEndTurnTooltip'
    | 'hasSeenAPTooltip'
    | 'hasSeenCombatTutorial'
    | 'hasSeenStudyTutorial'
    | 'tutorialDismissedEarly'
  >,
): void {
  onboardingState.update((state) => ({ ...state, [key]: true }))
}

/** Mark that the player has completed or skipped the combat tutorial. */
export function markCombatTutorialSeen(): void {
  onboardingState.update((state) => ({ ...state, hasSeenCombatTutorial: true }))
}

/** Mark that the player has completed or skipped the study tutorial. */
export function markStudyTutorialSeen(): void {
  onboardingState.update((state) => ({ ...state, hasSeenStudyTutorial: true }))
}

/** Mark that the player explicitly dismissed the tutorial before it finished. */
export function markTutorialDismissedEarly(): void {
  onboardingState.update((state) => ({ ...state, tutorialDismissedEarly: true }))
}

/**
 * Reset all tutorial flags — used in dev/testing to re-trigger tutorials.
 * Does NOT reset other onboarding state (tooltips, runs, etc.).
 */
export function resetTutorialFlags(): void {
  onboardingState.update((state) => ({
    ...state,
    hasSeenCombatTutorial: false,
    hasSeenStudyTutorial: false,
    tutorialDismissedEarly: false,
  }))
}

export function getAscensionLevel(): number {
  return sanitizeAscensionProfile(get(ascensionProfile)).selectedLevel
}

export function setAscensionLevel(level: number): void {
  ascensionProfile.update((profile) => {
    const safe = sanitizeAscensionProfile(profile)
    const selectedLevel = Math.min(safe.highestUnlockedLevel, clampAscensionLevel(level))
    return {
      ...safe,
      selectedLevel,
    }
  })
}

export function unlockAscensionLevel(level: number): void {
  ascensionProfile.update((profile) => {
    const safe = sanitizeAscensionProfile(profile)
    const highestUnlockedLevel = Math.max(safe.highestUnlockedLevel, clampAscensionLevel(level))
    const selectedLevel = Math.min(
      highestUnlockedLevel,
      safe.selectedLevel > 0 ? safe.selectedLevel : highestUnlockedLevel > 0 ? 1 : 0,
    )
    return {
      highestUnlockedLevel,
      selectedLevel,
    }
  })
}

export function unlockNextAscensionLevel(currentLevel: number): void {
  unlockAscensionLevel(currentLevel + 1)
}
