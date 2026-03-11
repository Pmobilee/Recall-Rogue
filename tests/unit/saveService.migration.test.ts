import { beforeEach, describe, expect, it } from 'vitest'
import { createNewPlayer, load } from '../../src/services/saveService'
import { profileService } from '../../src/services/profileService'

function activeSaveKey(): string {
  return profileService.getSaveKey()
}

function writeRawSave(raw: unknown): void {
  localStorage.setItem(activeSaveKey(), JSON.stringify(raw))
}

describe('saveService migration safety', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for malformed JSON', () => {
    localStorage.setItem(activeSaveKey(), '{not-json')
    expect(load()).toBeNull()
  })

  it('migrates legacy mineral keys to geode/essence', () => {
    const base = createNewPlayer('teen') as unknown as Record<string, unknown>
    base.minerals = {
      dust: 11,
      shard: 3,
      coreFragment: 7,
      primordialEssence: 2,
    }

    writeRawSave(base)
    const migrated = load()

    expect(migrated).not.toBeNull()
    expect(migrated?.minerals.geode).toBe(7)
    expect(migrated?.minerals.essence).toBe(2)
  })

  it('backfills relic economy fields when absent', () => {
    const base = createNewPlayer('teen') as unknown as Record<string, unknown>
    delete base.masteryCoins
    delete base.masteryCoinsAvailable
    delete base.unlockedRelicIds
    delete base.excludedRelicIds

    writeRawSave(base)
    const migrated = load()

    expect(migrated).not.toBeNull()
    expect(typeof migrated?.masteryCoins).toBe('number')
    expect(typeof migrated?.masteryCoinsAvailable).toBe('number')
    expect(Array.isArray(migrated?.unlockedRelicIds)).toBe(true)
    expect(Array.isArray(migrated?.excludedRelicIds)).toBe(true)
  })

  it('normalizes incomplete review state entries without crashing', () => {
    const base = createNewPlayer('teen') as unknown as Record<string, unknown>
    base.reviewStates = [
      { factId: 'fact-1' },
      { factId: 'fact-2', stability: 12, reps: 4, cardState: 'review' },
      { factId: 'fact-3', due: Date.now() + 86_400_000, state: 'review' },
    ]

    writeRawSave(base)
    const migrated = load()

    expect(migrated).not.toBeNull()
    expect(migrated?.reviewStates.length).toBe(3)
    for (const state of migrated?.reviewStates ?? []) {
      expect(typeof state.difficulty).toBe('number')
      expect(typeof state.due).toBe('number')
      expect(typeof state.lastReview).toBe('number')
      expect(typeof state.reps).toBe('number')
      expect(typeof state.lapses).toBe('number')
      expect(typeof state.lastVariantIndex).toBe('number')
      expect(Array.isArray(state.tierHistory)).toBe(true)
    }
  })

  it('survives repeated partial-save loads (migration fuzz)', () => {
    for (let i = 0; i < 25; i += 1) {
      const base = createNewPlayer('teen') as unknown as Record<string, unknown>
      base.reviewStates = [
        { factId: `f-${i}`, stability: i, cardState: i % 2 === 0 ? 'review' : 'learning' },
      ]
      if (i % 2 === 0) delete base.unlockedRooms
      if (i % 3 === 0) delete base.hubState
      if (i % 4 === 0) delete base.farm
      if (i % 6 === 0) delete base.minerals

      writeRawSave(base)
      const migrated = load()
      expect(migrated).not.toBeNull()
      expect(migrated?.hubState).toBeTruthy()
      expect(Array.isArray(migrated?.reviewStates)).toBe(true)
    }
  })
})
