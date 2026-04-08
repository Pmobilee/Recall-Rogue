import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { RunEndData, RunState } from './runManager'
import type { RunSummary } from '../data/types'

export type { RunSummary }

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
    elitesDefeated: endData.elitesDefeated,
    miniBossesDefeated: endData.miniBossesDefeated,
    bossesDefeated: endData.bossesDefeated,
    enemiesDefeatedList: endData.enemiesDefeatedList ?? [],
    factsLearned: endData.correctAnswers,
    newFactsSeen: endData.newFactsSeen ?? 0,
    factsReviewed: endData.factsReviewed ?? 0,
    factsMasteredThisRun: endData.factsMasteredThisRun ?? 0,
    factsTierAdvanced: endData.factsTierAdvanced ?? 0,
    factStateSummary: endData.factStateSummary ?? { seen: 0, reviewing: 0, mastered: 0 },
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
    domainAccuracy: endData.domainAccuracy ?? {},
    deckId: endData.deckId,
    deckLabel: endData.deckLabel,
  }
}
