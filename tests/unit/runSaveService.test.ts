import { describe, expect, it } from 'vitest'
import type { Card } from '../../src/data/card-types'
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

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    factId: 'fact-1',
    cardType: 'attack',
    domain: 'history',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1,
    ...overrides,
  }
}

describe('runSaveService', () => {
  it('round-trips ascension fields, reward metadata, and run mode metadata', () => {
    const run = createRunState('history', 'geography', { ascensionLevel: 10 })
    run.echoFactIds.add('echo-1')
    run.factsAnsweredCorrectly.add('fact-1')
    run.factsAnsweredIncorrectly.add('fact-2')

    const roomOptions: RoomOption[] = [
      { type: 'rest', icon: '🔥', label: 'Rest Site', detail: 'Rest or Upgrade', hidden: false },
    ]
    const rewardCard = makeCard()

    saveActiveRun({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: run,
      currentScreen: 'dungeonMap',
      runMode: 'endless_depths',
      dailySeed: null,
      roomOptions,
      cardRewardOptions: [rewardCard],
      activeRewardBundle: {
        goldEarned: 11,
        comboBonus: 2,
        healAmount: 4,
      },
      rewardRevealStep: 'heal',
      encounterSnapshot: {
        activeDeck: {
          drawPile: [rewardCard],
          discardPile: [],
          hand: [],
          exhaustPile: [],
          comboCount: 0,
          currentFloor: 1,
          currentEncounter: 1,
          playerHP: 90,
          playerMaxHP: 100,
          playerShield: 0,
          hintsRemaining: 1,
          currency: 0,
          factPool: ['fact-1'],
          factCooldown: [],
        },
        activeRunPool: [rewardCard],
      },
    })

    const loaded = loadActiveRun()
    expect(loaded).not.toBeNull()
    if (!loaded) return

    expect(loaded.runMode).toBe('endless_depths')
    expect(loaded.dailySeed).toBeNull()
    expect(loaded.currentScreen).toBe('dungeonMap')
    expect(loaded.roomOptions).toEqual(roomOptions)
    expect(loaded.cardRewardOptions).toHaveLength(1)
    expect(loaded.cardRewardOptions?.[0].factId).toBe('fact-1')
    expect(loaded.activeRewardBundle).toEqual({
      goldEarned: 11,
      comboBonus: 2,
      healAmount: 4,
    })
    expect(loaded.rewardRevealStep).toBe('heal')
    expect(loaded.encounterSnapshot?.activeDeck?.drawPile).toHaveLength(1)
    expect(loaded.encounterSnapshot?.activeRunPool).toHaveLength(1)
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
      currentScreen: 'dungeonMap',
    }))

    const loaded = loadActiveRun()
    expect(loaded).not.toBeNull()
    if (!loaded) return

    expect(loaded.runState.ascensionLevel).toBe(0)
    expect(loaded.runState.ascensionModifiers.level).toBe(0)
    expect(loaded.runState.ascensionModifiers.preventFlee).toBe(false)
    expect(loaded.runState.retreatRewardLocked).toBe(false)
    expect(loaded.cardRewardOptions).toEqual([])
    expect(loaded.activeRewardBundle).toBeNull()
    expect(loaded.rewardRevealStep).toBe('gold')
    expect(loaded.encounterSnapshot).toBeNull()
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
