import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

export type DifficultyMode = 'explorer' | 'standard' | 'scholar'
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

const defaultOnboardingState: OnboardingState = {
  hasCompletedOnboarding: false,
  hasSeenCardTapTooltip: false,
  hasSeenCastTooltip: false,
  hasSeenAnswerTooltip: false,
  hasSeenEndTurnTooltip: false,
  hasSeenAPTooltip: false,
  runsCompleted: 0,
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

export const difficultyMode = persistedWritable<DifficultyMode>('card:difficultyMode', 'standard')
export const isSlowReader = persistedWritable<boolean>('card:isSlowReader', false)
export const textSize = persistedWritable<TextSize>('card:textSize', 'medium')
export const highContrastMode = persistedWritable<boolean>('card:highContrastMode', false)
export const reduceMotionMode = persistedWritable<boolean>('card:reduceMotionMode', false)
export const onboardingState = persistedWritable<OnboardingState>('card:onboardingState', defaultOnboardingState)

/** Display names for difficulty modes (internal IDs unchanged for save compat). */
export const DIFFICULTY_DISPLAY_NAMES: Record<DifficultyMode, string> = {
  explorer: 'Story Mode',
  standard: 'Timed Mode',
  scholar: 'Expert Mode',
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
