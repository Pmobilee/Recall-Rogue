/**
 * Tests for playerData.recordRunComplete — Journal/Profile stats, run history, and bestiary.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { playerSave } from '../../src/ui/stores/playerData'
import { recordRunComplete } from '../../src/ui/stores/playerData'
import { createNewPlayer } from '../../src/services/saveService'
import type { RunEndData } from '../../src/services/runManager'
import type { RunSummary } from '../../src/data/types'

function makeEndData(overrides: Partial<RunEndData> = {}): RunEndData {
  return {
    result: 'victory',
    floorReached: 10,
    factsAnswered: 20,
    correctAnswers: 15,
    accuracy: 75,
    bestCombo: 5,
    cardsEarned: 8,
    newFactsLearned: 0,
    factsMastered: 0,
    encountersWon: 5,
    encountersTotal: 6,
    elitesDefeated: 1,
    miniBossesDefeated: 1,
    bossesDefeated: 0,
    defeatedEnemyIds: ['goblin', 'orc', 'goblin'],
    factStateSummary: { seen: 3, reviewing: 8, mastered: 4 },
    completedBounties: [],
    duration: 300000,
    runDurationMs: 300000,
    rewardMultiplier: 1,
    currencyEarned: 50,
    isPracticeRun: false,
    // New fields
    newFactsSeen: 3,
    factsReviewed: 12,
    factsMasteredThisRun: 4,
    factsTierAdvanced: 6,
    enemiesDefeatedList: ['goblin', 'orc', 'goblin'],
    domainAccuracy: { science: { answered: 10, correct: 8 } },
    ...overrides,
  }
}

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    result: 'victory',
    floorReached: 10,
    enemiesDefeated: 5,
    encountersTotal: 6,
    elitesDefeated: 1,
    miniBossesDefeated: 1,
    bossesDefeated: 0,
    enemiesDefeatedList: ['goblin', 'orc', 'goblin'],
    factsLearned: 15,
    newFactsSeen: 3,
    factsReviewed: 12,
    factsMasteredThisRun: 4,
    factsTierAdvanced: 6,
    factStateSummary: { seen: 3, reviewing: 8, mastered: 4 },
    goldEarned: 50,
    cardsCollected: 8,
    runDate: new Date().toISOString(),
    primaryDomain: 'science',
    secondaryDomain: 'history',
    timedOutCombats: 0,
    accuracy: 75,
    bestCombo: 5,
    runDurationMs: 300000,
    completedBounties: [],
    domainAccuracy: { science: { answered: 10, correct: 8 } },
    ...overrides,
  }
}

describe('recordRunComplete — Journal/Profile tracking', () => {
  beforeEach(() => {
    // Initialize playerSave with a fresh player
    const freshSave = createNewPlayer('teen')
    playerSave.set(freshSave)
  })

  it('increments totalVictories on victory', () => {
    recordRunComplete(10, makeEndData({ result: 'victory' }))
    const save = get(playerSave)
    expect(save?.stats.totalVictories).toBe(1)
    expect(save?.stats.totalDefeats).toBe(0)
    expect(save?.stats.totalRetreats).toBe(0)
  })

  it('increments totalDefeats on defeat', () => {
    recordRunComplete(5, makeEndData({ result: 'defeat' }))
    const save = get(playerSave)
    expect(save?.stats.totalVictories).toBe(0)
    expect(save?.stats.totalDefeats).toBe(1)
    expect(save?.stats.totalRetreats).toBe(0)
  })

  it('increments totalRetreats on retreat', () => {
    recordRunComplete(7, makeEndData({ result: 'retreat' }))
    const save = get(playerSave)
    expect(save?.stats.totalRetreats).toBe(1)
    expect(save?.stats.totalVictories).toBe(0)
  })

  it('accumulates cumulativePlaytimeMs', () => {
    recordRunComplete(10, makeEndData({ runDurationMs: 120000 }))
    recordRunComplete(12, makeEndData({ runDurationMs: 80000 }))
    const save = get(playerSave)
    expect(save?.stats.cumulativePlaytimeMs).toBe(200000)
  })

  it('accumulates totalEnemiesDefeated from encountersWon', () => {
    recordRunComplete(10, makeEndData({ encountersWon: 5 }))
    recordRunComplete(8, makeEndData({ encountersWon: 3 }))
    const save = get(playerSave)
    expect(save?.stats.totalEnemiesDefeated).toBe(8)
  })

  it('accumulates totalElitesDefeated', () => {
    recordRunComplete(10, makeEndData({ elitesDefeated: 2 }))
    recordRunComplete(10, makeEndData({ elitesDefeated: 1 }))
    const save = get(playerSave)
    expect(save?.stats.totalElitesDefeated).toBe(3)
  })

  it('accumulates lifetimeFactsMastered from factsMasteredThisRun', () => {
    recordRunComplete(10, makeEndData({ factsMasteredThisRun: 4 }))
    recordRunComplete(10, makeEndData({ factsMasteredThisRun: 2 }))
    const save = get(playerSave)
    expect(save?.stats.lifetimeFactsMastered).toBe(6)
  })

  it('pushes run summary to runHistory when provided', () => {
    const summary = makeSummary()
    recordRunComplete(10, makeEndData(), summary)
    const save = get(playerSave)
    expect(save?.runHistory).toHaveLength(1)
    expect(save?.runHistory?.[0].result).toBe('victory')
    expect(save?.runHistory?.[0].primaryDomain).toBe('science')
  })

  it('prepends newest run to front of runHistory', () => {
    recordRunComplete(5, makeEndData({ result: 'defeat' }), makeSummary({ result: 'defeat', floorReached: 5 }))
    recordRunComplete(10, makeEndData({ result: 'victory' }), makeSummary({ result: 'victory', floorReached: 10 }))
    const save = get(playerSave)
    expect(save?.runHistory?.[0].result).toBe('victory') // newest first
    expect(save?.runHistory?.[1].result).toBe('defeat')
  })

  it('caps runHistory at 50 entries', () => {
    // Fill to 51
    for (let i = 0; i < 51; i++) {
      recordRunComplete(i, makeEndData(), makeSummary({ floorReached: i }))
    }
    const save = get(playerSave)
    expect(save?.runHistory?.length).toBe(50)
  })

  it('merges enemiesDefeatedList into lifetimeEnemyKillCounts', () => {
    recordRunComplete(10, makeEndData(), makeSummary({ enemiesDefeatedList: ['goblin', 'orc', 'goblin'] }))
    const save = get(playerSave)
    expect(save?.lifetimeEnemyKillCounts?.['goblin']).toBe(2)
    expect(save?.lifetimeEnemyKillCounts?.['orc']).toBe(1)
  })

  it('accumulates bestiary across multiple runs', () => {
    recordRunComplete(10, makeEndData(), makeSummary({ enemiesDefeatedList: ['goblin', 'dragon'] }))
    recordRunComplete(8, makeEndData(), makeSummary({ enemiesDefeatedList: ['goblin', 'goblin'] }))
    const save = get(playerSave)
    expect(save?.lifetimeEnemyKillCounts?.['goblin']).toBe(3)
    expect(save?.lifetimeEnemyKillCounts?.['dragon']).toBe(1)
  })

  it('works with endData only (no pre-built summary) — fallback path', () => {
    recordRunComplete(10, makeEndData({ result: 'retreat' }))
    const save = get(playerSave)
    expect(save?.runHistory).toHaveLength(1)
    expect(save?.runHistory?.[0].result).toBe('retreat')
  })

  it('works with no endData at all (legacy call)', () => {
    expect(() => recordRunComplete(10)).not.toThrow()
    const save = get(playerSave)
    expect(save?.runHistory).toHaveLength(0)
  })
})
