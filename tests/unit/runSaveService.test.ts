import { describe, expect, it } from 'vitest'
import type { RoomOption } from '../../src/services/floorManager'
import { createRunState } from '../../src/services/runManager'
import { loadActiveRun, saveActiveRun } from '../../src/services/runSaveService'

const SAVE_KEY = 'recall-rogue-active-run'

function toSerializedRunState(run: ReturnType<typeof createRunState>): Record<string, unknown> {
  return {
    ...run,
    echoFactIds: [...run.echoFactIds],
    consumedRewardFactIds: [...run.consumedRewardFactIds],
    factsAnsweredCorrectly: [...run.factsAnsweredCorrectly],
    factsAnsweredIncorrectly: [...run.factsAnsweredIncorrectly],
  }
}

describe('runSaveService', () => {
  it('round-trips ascension fields and run mode metadata', () => {
    const run = createRunState('history', 'geography', { ascensionLevel: 10 })
    run.echoFactIds.add('echo-1')
    run.factsAnsweredCorrectly.add('fact-1')
    run.factsAnsweredIncorrectly.add('fact-2')

    const roomOptions: RoomOption[] = [
      { type: 'rest', icon: '🔥', label: 'Rest', detail: 'Recover HP', hidden: false },
    ]

    saveActiveRun({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: run,
      currentScreen: 'roomSelection',
      runMode: 'endless_depths',
      dailySeed: null,
      roomOptions,
    })

    const loaded = loadActiveRun()
    expect(loaded).not.toBeNull()
    if (!loaded) return

    expect(loaded.runMode).toBe('endless_depths')
    expect(loaded.dailySeed).toBeNull()
    expect(loaded.currentScreen).toBe('roomSelection')
    expect(loaded.roomOptions).toEqual(roomOptions)
    expect(loaded.runState.ascensionLevel).toBe(10)
    expect(loaded.runState.ascensionModifiers.level).toBe(10)
    expect(loaded.runState.ascensionModifiers.minRetreatFloorForRewards).toBe(12)
    expect(loaded.runState.echoFactIds.has('echo-1')).toBe(true)
    expect(loaded.runState.factsAnsweredCorrectly.has('fact-1')).toBe(true)
    expect(loaded.runState.factsAnsweredIncorrectly.has('fact-2')).toBe(true)
  })

  it('migrates legacy saves missing ascension fields', () => {
    const run = createRunState('history', 'geography')
    const legacyRun = toSerializedRunState(run)
    delete legacyRun.ascensionLevel
    delete legacyRun.ascensionModifiers
    delete legacyRun.retreatRewardLocked

    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: legacyRun,
      currentScreen: 'roomSelection',
    }))

    const loaded = loadActiveRun()
    expect(loaded).not.toBeNull()
    if (!loaded) return

    expect(loaded.runState.ascensionLevel).toBe(0)
    expect(loaded.runState.ascensionModifiers.level).toBe(0)
    expect(loaded.runState.ascensionModifiers.preventFlee).toBe(false)
    expect(loaded.runState.retreatRewardLocked).toBe(false)
  })

  it('preserves deterministic seed metadata for seeded run modes', () => {
    const run = createRunState('history', 'geography', { ascensionLevel: 2 })

    saveActiveRun({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: run,
      currentScreen: 'combat',
      runMode: 'daily_expedition',
      dailySeed: 4242,
    })
    const dailyLoaded = loadActiveRun()
    expect(dailyLoaded?.runMode).toBe('daily_expedition')
    expect(dailyLoaded?.dailySeed).toBe(4242)

    saveActiveRun({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: run,
      currentScreen: 'combat',
      runMode: 'scholar_challenge',
      dailySeed: 9191,
    })
    const scholarLoaded = loadActiveRun()
    expect(scholarLoaded?.runMode).toBe('scholar_challenge')
    expect(scholarLoaded?.dailySeed).toBe(9191)
  })
})
