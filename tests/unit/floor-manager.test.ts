import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createFloorState,
  getSegment,
  getEncountersForFloor,
  getEventsForFloor,
  isBossFloor,
  getBossForFloor,
  getTimerForFloor,
  generateRoomOptions,
  pickCombatEnemy,
  generateMysteryEvent,
  advanceEncounter,
  advanceFloor,
} from '../../src/services/floorManager'

describe('FloorManager', () => {
  describe('getSegment', () => {
    it('returns 1 for floors 1-3', () => {
      expect(getSegment(1)).toBe(1)
      expect(getSegment(2)).toBe(1)
      expect(getSegment(3)).toBe(1)
    })

    it('returns 2 for floors 4-6', () => {
      expect(getSegment(4)).toBe(2)
      expect(getSegment(5)).toBe(2)
      expect(getSegment(6)).toBe(2)
    })

    it('returns 3 for floors 7-9', () => {
      expect(getSegment(7)).toBe(3)
      expect(getSegment(8)).toBe(3)
      expect(getSegment(9)).toBe(3)
    })

    it('returns 4 for floors 10+', () => {
      expect(getSegment(10)).toBe(4)
      expect(getSegment(15)).toBe(4)
      expect(getSegment(100)).toBe(4)
    })
  })

  describe('isBossFloor', () => {
    it('returns true for floor 3, 6, 9', () => {
      expect(isBossFloor(3)).toBe(true)
      expect(isBossFloor(6)).toBe(true)
      expect(isBossFloor(9)).toBe(true)
    })

    it('returns false for other floors', () => {
      expect(isBossFloor(1)).toBe(false)
      expect(isBossFloor(2)).toBe(false)
      expect(isBossFloor(4)).toBe(false)
      expect(isBossFloor(5)).toBe(false)
      expect(isBossFloor(7)).toBe(false)
      expect(isBossFloor(8)).toBe(false)
      expect(isBossFloor(10)).toBe(false)
    })
  })

  describe('getBossForFloor', () => {
    it('returns the_excavator for floor 3', () => {
      expect(getBossForFloor(3)).toBe('the_excavator')
    })

    it('returns magma_core for floor 6', () => {
      expect(getBossForFloor(6)).toBe('magma_core')
    })

    it('returns the_archivist for floor 9', () => {
      expect(getBossForFloor(9)).toBe('the_archivist')
    })

    it('returns null for non-boss floors', () => {
      expect(getBossForFloor(1)).toBeNull()
      expect(getBossForFloor(2)).toBeNull()
      expect(getBossForFloor(4)).toBeNull()
      expect(getBossForFloor(10)).toBeNull()
    })
  })

  describe('generateRoomOptions', () => {
    it('always returns exactly 3 options', () => {
      for (let floor = 1; floor <= 12; floor++) {
        const options = generateRoomOptions(floor)
        expect(options).toHaveLength(3)
      }
    })

    it('always includes at least 1 combat option', () => {
      // Run 50 times to account for randomness
      for (let i = 0; i < 50; i++) {
        const options = generateRoomOptions(1)
        const hasCombat = options.some(o => o.type === 'combat')
        expect(hasCombat).toBe(true)
      }
    })

    it('combat rooms have hidden=false', () => {
      for (let i = 0; i < 20; i++) {
        const options = generateRoomOptions(1)
        for (const opt of options) {
          if (opt.type === 'combat') {
            expect(opt.hidden).toBe(false)
          }
        }
      }
    })

    it('mystery rooms have hidden=true', () => {
      // Generate many rooms to get at least one mystery
      let foundMystery = false
      for (let i = 0; i < 100; i++) {
        const options = generateRoomOptions(1)
        for (const opt of options) {
          if (opt.type === 'mystery') {
            expect(opt.hidden).toBe(true)
            expect(opt.detail).toBe('???')
            foundMystery = true
          }
        }
      }
      expect(foundMystery).toBe(true)
    })

    it('generates valid room types for segment 1', () => {
      const validTypes = new Set(['combat', 'mystery', 'rest', 'treasure', 'shop'])
      for (let i = 0; i < 50; i++) {
        const options = generateRoomOptions(1)
        for (const opt of options) {
          expect(validTypes.has(opt.type)).toBe(true)
        }
      }
    })
  })

  describe('getTimerForFloor', () => {
    it('returns 12 for floors 1-3', () => {
      expect(getTimerForFloor(1)).toBe(12)
      expect(getTimerForFloor(2)).toBe(12)
      expect(getTimerForFloor(3)).toBe(12)
    })

    it('returns 9 for floors 4-6', () => {
      expect(getTimerForFloor(4)).toBe(9)
      expect(getTimerForFloor(5)).toBe(9)
      expect(getTimerForFloor(6)).toBe(9)
    })

    it('returns 7 for floors 7-9', () => {
      expect(getTimerForFloor(7)).toBe(7)
      expect(getTimerForFloor(8)).toBe(7)
      expect(getTimerForFloor(9)).toBe(7)
    })

    it('returns 5 for floors 10-12', () => {
      expect(getTimerForFloor(10)).toBe(5)
      expect(getTimerForFloor(11)).toBe(5)
      expect(getTimerForFloor(12)).toBe(5)
    })

    it('returns 4 for floor 13+', () => {
      expect(getTimerForFloor(13)).toBe(4)
      expect(getTimerForFloor(20)).toBe(4)
      expect(getTimerForFloor(100)).toBe(4)
    })
  })

  describe('advanceEncounter', () => {
    it('increments encounter counter', () => {
      const state = createFloorState()
      expect(state.currentEncounter).toBe(1)
      advanceEncounter(state)
      expect(state.currentEncounter).toBe(2)
    })

    it('returns true when floor is complete', () => {
      const state = createFloorState()
      // encountersPerFloor is 3, so 3rd advance completes the floor
      advanceEncounter(state) // encounter 2
      advanceEncounter(state) // encounter 3
      const result = advanceEncounter(state) // encounter 4 > 3
      expect(result).toBe(true)
    })

    it('returns false when encounters remain', () => {
      const state = createFloorState()
      const result = advanceEncounter(state) // encounter 2, still <=3
      expect(result).toBe(false)
    })
  })

  describe('advanceFloor', () => {
    it('increments floor and resets encounter', () => {
      const state = createFloorState()
      state.currentEncounter = 3
      advanceFloor(state)
      expect(state.currentFloor).toBe(2)
      expect(state.currentEncounter).toBe(1)
    })

    it('updates segment on floor change', () => {
      const state = createFloorState()
      expect(state.segment).toBe(1)

      // Advance to floor 4 (segment 2)
      state.currentFloor = 3
      advanceFloor(state)
      expect(state.currentFloor).toBe(4)
      expect(state.segment).toBe(2)
    })

    it('updates isBossFloor on floor change', () => {
      const state = createFloorState()
      expect(state.isBossFloor).toBe(false)

      // Advance to floor 3 (boss floor)
      state.currentFloor = 2
      advanceFloor(state)
      expect(state.currentFloor).toBe(3)
      expect(state.isBossFloor).toBe(true)
    })
  })

  describe('generateMysteryEvent', () => {
    it('returns a valid mystery event', () => {
      const event = generateMysteryEvent()
      expect(event).toBeDefined()
      expect(event.id).toBeTruthy()
      expect(event.name).toBeTruthy()
      expect(event.description).toBeTruthy()
      expect(event.effect).toBeDefined()
    })

    it('all 5 event types can be generated', () => {
      const seenIds = new Set<string>()
      // Generate many events to cover all types
      for (let i = 0; i < 200; i++) {
        const event = generateMysteryEvent()
        seenIds.add(event.id)
      }
      expect(seenIds.has('healing_spring')).toBe(true)
      expect(seenIds.has('unstable_ground')).toBe(true)
      expect(seenIds.has('forgotten_cache')).toBe(true)
      expect(seenIds.has('empty_chamber')).toBe(true)
      expect(seenIds.has('traders_gambit')).toBe(true)
    })
  })

  describe('createFloorState', () => {
    it('initializes with correct defaults', () => {
      const state = createFloorState()
      expect(state.currentFloor).toBe(1)
      expect(state.currentEncounter).toBe(1)
      expect(state.encountersPerFloor).toBe(3)
      expect(state.segment).toBe(1)
      expect(state.isBossFloor).toBe(false)
      expect(state.bossDefeated).toBe(false)
    })
  })

  describe('getEncountersForFloor', () => {
    it('always returns 3', () => {
      for (let floor = 1; floor <= 15; floor++) {
        expect(getEncountersForFloor(floor)).toBe(3)
      }
    })
  })

  describe('pickCombatEnemy', () => {
    it('returns a valid enemy id', () => {
      const enemyId = pickCombatEnemy(1)
      expect(typeof enemyId).toBe('string')
      expect(enemyId.length).toBeGreaterThan(0)
    })
  })
})
