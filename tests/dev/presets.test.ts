import { describe, it, expect } from 'vitest'
import { SCENARIO_PRESETS } from '../../src/dev/presets'

describe('SCENARIO_PRESETS', () => {
  it('exports exactly 9 presets', () => {
    expect(SCENARIO_PRESETS).toHaveLength(9)
  })

  it('each preset has required fields', () => {
    for (const preset of SCENARIO_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(preset.label).toBeTruthy()
      expect(preset.description).toBeTruthy()
      expect(typeof preset.buildSave).toBe('function')
    }
  })

  it('buildSave returns valid PlayerSave objects', () => {
    const now = Date.now()
    for (const preset of SCENARIO_PRESETS) {
      const save = preset.buildSave(now)
      expect(save.version).toBeGreaterThan(0)
      expect(save.playerId).toBeTruthy()
      expect(save.minerals).toBeDefined()
      expect(save.stats).toBeDefined()
      expect(save.learnedFacts).toBeInstanceOf(Array)
      expect(save.unlockedRooms).toBeInstanceOf(Array)
      expect(save.unlockedRooms.length).toBeGreaterThan(0)
    }
  })

  it('new_player preset has minimal state', () => {
    const save = SCENARIO_PRESETS.find(p => p.id === 'new_player')!.buildSave(Date.now())
    expect(save.learnedFacts).toHaveLength(0)
    expect(save.unlockedRooms).toEqual(['command'])
  })

  it('endgame preset unlocks all rooms', () => {
    const save = SCENARIO_PRESETS.find(p => p.id === 'endgame_all_rooms')!.buildSave(Date.now())
    expect(save.unlockedRooms.length).toBeGreaterThanOrEqual(6)
  })

  it('empty_inventory preset has zero resources', () => {
    const save = SCENARIO_PRESETS.find(p => p.id === 'empty_inventory')!.buildSave(Date.now())
    expect(save.oxygen).toBe(0)
    expect(save.minerals.dust).toBe(0)
  })
})
