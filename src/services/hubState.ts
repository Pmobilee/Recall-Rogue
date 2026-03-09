import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { RunEndData, RunState } from './runManager'

export interface RunSummary {
  result: RunEndData['result']
  floorReached: number
  enemiesDefeated: number
  encountersTotal: number
  factsLearned: number
  goldEarned: number
  cardsCollected: number
  runDate: string
  primaryDomain: string
  secondaryDomain: string
  timedOutCombats: number
  accuracy: number
  bestCombo: number
  runDurationMs: number
  completedBounties: string[]
}

const LAST_RUN_SUMMARY_KEY = 'card:lastRunSummary'

function readSummary(): RunSummary | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_RUN_SUMMARY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RunSummary
  } catch {
    return null
  }
}

function persistedWritable<T>(key: string, initial: T): Writable<T> {
  const store = writable<T>(initial)
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Ignore storage failures.
      }
    })
  }
  return store
}

export const lastRunSummary = persistedWritable<RunSummary | null>(LAST_RUN_SUMMARY_KEY, readSummary())

export function captureRunSummary(run: RunState, endData: RunEndData): RunSummary {
  return {
    result: endData.result,
    floorReached: endData.floorReached,
    enemiesDefeated: endData.encountersWon,
    encountersTotal: endData.encountersTotal,
    factsLearned: endData.correctAnswers,
    goldEarned: endData.currencyEarned,
    cardsCollected: endData.cardsEarned,
    runDate: new Date().toISOString(),
    primaryDomain: run.primaryDomain,
    secondaryDomain: run.secondaryDomain,
    timedOutCombats: 0,
    accuracy: endData.accuracy,
    bestCombo: endData.bestCombo,
    runDurationMs: endData.runDurationMs,
    completedBounties: [...endData.completedBounties],
  }
}
