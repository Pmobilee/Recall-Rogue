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

  it('migrates legacy mineral keys to greyMatter', () => {
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
    // shard × 25 + coreFragment × 500 + primordialEssence × 2000 (dust is not a converted key)
    // = 3 * 25 + 7 * 500 + 2 * 2000 = 75 + 3500 + 4000 = 7575
    expect(migrated?.minerals.greyMatter).toBe(7575)
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

  describe('V1 → V2 relic migration wiring', () => {
    it('runs relic migration when save has version 1', () => {
      const base = createNewPlayer('teen') as unknown as Record<string, unknown>
      // Force v1 save with a renamed relic and one that should be refunded
      base.version = 1
      base.unlockedRelicIds = ['iron_buckler', 'glass_cannon', 'whetstone']
      base.masteryCoins = 10
      base.masteryCoinsAvailable = 10

      writeRawSave(base)
      const migrated = load()

      expect(migrated).not.toBeNull()
      // iron_buckler → iron_shield (rename)
      expect(migrated?.unlockedRelicIds).toContain('iron_shield')
      expect(migrated?.unlockedRelicIds).not.toContain('iron_buckler')
      // whetstone → preserved
      expect(migrated?.unlockedRelicIds).toContain('whetstone')
      // glass_cannon → refunded (25 coins), removed from list
      expect(migrated?.unlockedRelicIds).not.toContain('glass_cannon')
      expect(migrated?.masteryCoins).toBe(35) // 10 + 25 refund
      // version bumped to 2
      expect(migrated?.version).toBe(3) // v3 now — migration pipeline runs V1→V2→V3
    })

    it('does not re-run migration on a v2 save', () => {
      const base = createNewPlayer('teen') as unknown as Record<string, unknown>
      base.version = 2
      base.unlockedRelicIds = ['iron_buckler'] // v1 ID still present — should NOT be migrated on v2 load

      writeRawSave(base)
      const migrated = load()

      expect(migrated).not.toBeNull()
      // Migration must NOT run for v2 saves — iron_buckler stays as-is
      expect(migrated?.unlockedRelicIds).toContain('iron_buckler')
    })

    it('persists the migrated save so migration only runs once', () => {
      const base = createNewPlayer('teen') as unknown as Record<string, unknown>
      base.version = 1
      base.unlockedRelicIds = ['iron_buckler']

      writeRawSave(base)
      // First load — migration runs
      load()

      // Second load — must not re-run migration (version is now 2 in storage)
      const secondLoad = JSON.parse(localStorage.getItem(activeSaveKey()) ?? '{}') as Record<string, unknown>
      expect(secondLoad['version']).toBe(3) // v3 now — V2→V3 migration also runs
      // Confirms iron_buckler was replaced in persisted data
      expect((secondLoad['unlockedRelicIds'] as string[])).toContain('iron_shield')
      expect((secondLoad['unlockedRelicIds'] as string[])).not.toContain('iron_buckler')
    })

    it('runs migration when version field is absent (implicit v1)', () => {
      const base = createNewPlayer('teen') as unknown as Record<string, unknown>
      delete base.version
      base.unlockedRelicIds = ['whetstone', 'flame_brand'] // flame_brand → drop

      writeRawSave(base)
      const migrated = load()

      expect(migrated).not.toBeNull()
      expect(migrated?.unlockedRelicIds).toContain('whetstone')
      expect(migrated?.unlockedRelicIds).not.toContain('flame_brand')
      expect(migrated?.version).toBe(3) // v3 now — migration pipeline runs V1→V2→V3
    })
  })
})

describe('saveMigration V2 → V3', () => {
  it('migrates a v2 save to v3 with new PlayerStats fields defaulting to 0', () => {
    const base = createNewPlayer('teen') as unknown as Record<string, unknown>
    base.version = 2
    // Remove the new fields to simulate an old v2 save
    const stats = base.stats as Record<string, unknown>
    delete stats.totalVictories
    delete stats.totalDefeats
    delete stats.totalRetreats
    delete stats.cumulativePlaytimeMs
    delete stats.totalEnemiesDefeated
    delete stats.totalElitesDefeated
    delete stats.totalBossesDefeated
    delete stats.lifetimeFactsMastered
    delete base.runHistory
    delete base.lifetimeEnemyKillCounts

    writeRawSave(base)
    const migrated = load()

    expect(migrated).not.toBeNull()
    expect(migrated?.version).toBe(3)
    expect(migrated?.stats.totalVictories).toBe(0)
    expect(migrated?.stats.totalDefeats).toBe(0)
    expect(migrated?.stats.totalRetreats).toBe(0)
    expect(migrated?.stats.cumulativePlaytimeMs).toBe(0)
    expect(migrated?.stats.totalEnemiesDefeated).toBe(0)
    expect(migrated?.stats.lifetimeFactsMastered).toBe(0)
    expect(migrated?.runHistory).toEqual([])
    expect(migrated?.lifetimeEnemyKillCounts).toEqual({})
  })

  it('does not overwrite existing v3 counters when already present', () => {
    const base = createNewPlayer('teen') as unknown as Record<string, unknown>
    base.version = 3
    const stats = base.stats as Record<string, unknown>
    stats.totalVictories = 5
    stats.totalDefeats = 3
    // Run history already populated
    base.runHistory = [{ result: 'victory', floorReached: 10, runDate: '2026-01-01T00:00:00.000Z' }]

    writeRawSave(base)
    const migrated = load()

    expect(migrated).not.toBeNull()
    // V2→V3 migration should NOT run (version is already 3)
    expect(migrated?.stats.totalVictories).toBe(5)
    expect(migrated?.stats.totalDefeats).toBe(3)
    expect(migrated?.runHistory).toHaveLength(1)
  })
})
