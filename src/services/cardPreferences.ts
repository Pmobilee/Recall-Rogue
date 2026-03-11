import { writable } from 'svelte/store'
import { get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import { MAX_ASCENSION_LEVEL } from './ascension'

export type DifficultyMode = 'relaxed' | 'normal'
export type TextSize = 'small' | 'medium' | 'large'

export interface OnboardingState {
  hasCompletedOnboarding: boolean
  hasSeenCardTapTooltip: boolean
  hasSeenCastTooltip: boolean
  hasSeenAnswerTooltip: boolean
  hasSeenEndTurnTooltip: boolean
  hasSeenAPTooltip: boolean
  runsCompleted: number
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
}

const defaultAscensionProfile: AscensionProfile = {
  highestUnlockedLevel: 0,
  selectedLevel: 0,
}

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

export const difficultyMode = persistedWritable<DifficultyMode>('card:difficultyMode', 'normal')
export const isSlowReader = persistedWritable<boolean>('card:isSlowReader', false)
export const textSize = persistedWritable<TextSize>('card:textSize', 'medium')
export const highContrastMode = persistedWritable<boolean>('card:highContrastMode', false)
export const reduceMotionMode = persistedWritable<boolean>('card:reduceMotionMode', false)
export const onboardingState = persistedWritable<OnboardingState>('card:onboardingState', defaultOnboardingState)
export const ascensionProfile = persistedWritable<AscensionProfile>('card:ascensionProfile', defaultAscensionProfile)
export const knowledgeLevelSelected = persistedWritable<boolean>('card:knowledgeLevelSelected', false)

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
    'hasSeenCardTapTooltip' | 'hasSeenCastTooltip' | 'hasSeenAnswerTooltip' | 'hasSeenEndTurnTooltip' | 'hasSeenAPTooltip'
  >,
): void {
  onboardingState.update((state) => ({ ...state, [key]: true }))
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
