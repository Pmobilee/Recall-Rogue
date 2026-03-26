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
  isMiniBossEncounter,
  getMiniBossForFloor,
  shouldOfferEvent,
  generateCombatRoomOptions,
  generateEventRoomOptions,
} from '../../src/services/floorManager'

describe('FloorManager', () => {
  describe('getSegment', () => {
    it('returns 1 for floors 1-6 (Shallow Depths)', () => {
      expect(getSegment(1)).toBe(1)
      expect(getSegment(3)).toBe(1)
      expect(getSegment(6)).toBe(1)
    })

    it('returns 2 for floors 7-12 (Deep Caverns)', () => {
      expect(getSegment(7)).toBe(2)
      expect(getSegment(9)).toBe(2)
      expect(getSegment(12)).toBe(2)
    })

    it('returns 3 for floors 13-18 (The Abyss)', () => {
      expect(getSegment(13)).toBe(3)
      expect(getSegment(15)).toBe(3)
      expect(getSegment(18)).toBe(3)
    })

    it('returns 4 for floors 19-24 (The Archive) and beyond', () => {
      expect(getSegment(19)).toBe(4)
      expect(getSegment(24)).toBe(4)
      expect(getSegment(25)).toBe(4)
      expect(getSegment(100)).toBe(4)
    })
  })

  describe('isBossFloor', () => {
    it('returns true for all boss floors (every 3rd floor up to 24)', () => {
      expect(isBossFloor(3)).toBe(true)
      expect(isBossFloor(6)).toBe(true)
      expect(isBossFloor(9)).toBe(true)
      expect(isBossFloor(12)).toBe(true)
      expect(isBossFloor(15)).toBe(true)
      expect(isBossFloor(18)).toBe(true)
      expect(isBossFloor(21)).toBe(true)
      expect(isBossFloor(24)).toBe(true)
    })

    it('returns false for non-boss floors within standard run', () => {
      expect(isBossFloor(1)).toBe(false)
      expect(isBossFloor(2)).toBe(false)
      expect(isBossFloor(4)).toBe(false)
      expect(isBossFloor(5)).toBe(false)
      expect(isBossFloor(7)).toBe(false)
      expect(isBossFloor(10)).toBe(false)
      expect(isBossFloor(22)).toBe(false)
      expect(isBossFloor(23)).toBe(false)
    })

    it('returns true for endless boss floors (multiples of 3 past 24)', () => {
      expect(isBossFloor(27)).toBe(true)
      expect(isBossFloor(30)).toBe(true)
    })

    it('returns false for non-boss endless floors', () => {
      expect(isBossFloor(25)).toBe(false)
      expect(isBossFloor(26)).toBe(false)
    })
  })

  describe('getBossForFloor', () => {
    it('returns final_exam for floor 3', () => {
      expect(getBossForFloor(3)).toBe('final_exam')
    })

    it('returns burning_deadline for floor 6', () => {
      expect(getBossForFloor(6)).toBe('burning_deadline')
    })

    it('returns algorithm for floor 9', () => {
      expect(getBossForFloor(9)).toBe('algorithm')
    })

    it('returns curriculum for floor 12', () => {
      expect(getBossForFloor(12)).toBe('curriculum')
    })

    it('returns group_project for floor 15', () => {
      expect(getBossForFloor(15)).toBe('group_project')
    })

    it('returns rabbit_hole for floor 18', () => {
      expect(getBossForFloor(18)).toBe('rabbit_hole')
    })

    it('returns omnibus for floor 21', () => {
      expect(getBossForFloor(21)).toBe('omnibus')
    })

    it('returns final_lesson for floor 24 (final boss)', () => {
      expect(getBossForFloor(24)).toBe('final_lesson')
    })

    it('returns null for non-boss floors', () => {
      expect(getBossForFloor(1)).toBeNull()
      expect(getBossForFloor(2)).toBeNull()
      expect(getBossForFloor(4)).toBeNull()
      expect(getBossForFloor(22)).toBeNull()
    })

    it('cycles through bosses in endless mode', () => {
      const boss = getBossForFloor(27)
      expect(boss).toBeTruthy()
      expect(typeof boss).toBe('string')
    })
  })

  describe('isMiniBossEncounter', () => {
    it('returns true for encounter 3 on non-boss floors', () => {
      expect(isMiniBossEncounter(1, 3)).toBe(true)
      expect(isMiniBossEncounter(2, 3)).toBe(true)
      expect(isMiniBossEncounter(4, 3)).toBe(true)
    })

    it('returns false for encounter 3 on boss floors', () => {
      expect(isMiniBossEncounter(3, 3)).toBe(false)
      expect(isMiniBossEncounter(6, 3)).toBe(false)
      expect(isMiniBossEncounter(24, 3)).toBe(false)
    })

    it('returns false for encounters 1 and 2', () => {
      expect(isMiniBossEncounter(1, 1)).toBe(false)
      expect(isMiniBossEncounter(1, 2)).toBe(false)
    })
  })

  describe('getMiniBossForFloor', () => {
    it('returns a valid mini-boss id', () => {
      const id = getMiniBossForFloor(1)
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('generateRoomOptions', () => {
    it('always returns exactly 3 options', () => {
      for (let floor = 1; floor <= 24; floor++) {
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
    it('returns 12 for floors 1-6 (Segment 1)', () => {
      expect(getTimerForFloor(1)).toBe(12)
      expect(getTimerForFloor(3)).toBe(12)
      expect(getTimerForFloor(6)).toBe(12)
    })

    it('returns 9 for floors 7-12 (Segment 2)', () => {
      expect(getTimerForFloor(7)).toBe(9)
      expect(getTimerForFloor(9)).toBe(9)
      expect(getTimerForFloor(12)).toBe(9)
    })

    it('returns 7 for floors 13-18 (Segment 3)', () => {
      expect(getTimerForFloor(13)).toBe(7)
      expect(getTimerForFloor(15)).toBe(7)
      expect(getTimerForFloor(18)).toBe(7)
    })

    it('returns 5 for floors 19-24 (Segment 4)', () => {
      expect(getTimerForFloor(19)).toBe(5)
      expect(getTimerForFloor(22)).toBe(5)
      expect(getTimerForFloor(24)).toBe(5)
    })

    it('returns 4 for floor 25+ (Endless)', () => {
      expect(getTimerForFloor(25)).toBe(4)
      expect(getTimerForFloor(30)).toBe(4)
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

      // Advance to floor 7 (segment 2)
      state.currentFloor = 6
      advanceFloor(state)
      expect(state.currentFloor).toBe(7)
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

    it('generates events from the known event pool', () => {
      const seenIds = new Set<string>()
      // Generate many events to cover all types
      for (let i = 0; i < 2000; i++) {
        const event = generateMysteryEvent()
        seenIds.add(event.id)
      }
      // Verify Tier 1 narrative events (always available from floor 1)
      expect(seenIds.has('tutors_office')).toBe(true)
      expect(seenIds.has('flashcard_merchant')).toBe(true)
      expect(seenIds.has('reading_nook')).toBe(true)
      // Verify combat/reward events (generated by the 20%/10% branches)
      expect(seenIds.has('mystery_combat')).toBe(true)
      expect(seenIds.has('mystery_reward')).toBe(true)
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
      for (let floor = 1; floor <= 24; floor++) {
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

  describe('Room spam prevention', () => {
    describe('shouldOfferEvent', () => {
      it('respects event chance by segment', () => {
        // Segment 1: 80% event chance
        let events = 0
        for (let i = 0; i < 200; i++) {
          if (shouldOfferEvent(1)) events++
        }
        expect(events).toBeGreaterThan(140) // ~80% of 200
        expect(events).toBeLessThan(170)

        // Segment 4: 60% event chance
        events = 0
        for (let i = 0; i < 200; i++) {
          if (shouldOfferEvent(20)) events++
        }
        expect(events).toBeGreaterThan(100) // ~60% of 200
        expect(events).toBeLessThan(140)
      })
    })

    describe('generateCombatRoomOptions', () => {
      it('always returns exactly 3 options', () => {
        const options = generateCombatRoomOptions(1)
        expect(options).toHaveLength(3)
      })

      it('all options are combat rooms', () => {
        const options = generateCombatRoomOptions(1)
        for (const opt of options) {
          expect(opt.type).toBe('combat')
          expect(opt.enemyId).toBeTruthy()
        }
      })

      it('generates distinct enemies when possible', () => {
        const options = generateCombatRoomOptions(1)
        const enemyIds = options.map(o => o.enemyId)
        const uniqueIds = new Set(enemyIds)
        // At least 2 should be distinct (or all same if only 1 enemy type exists, unlikely)
        expect(uniqueIds.size).toBeGreaterThan(1)
      })
    })

    describe('generateEventRoomOptions', () => {
      it('always returns exactly 3 options', () => {
        const options = generateEventRoomOptions(1)
        expect(options).toHaveLength(3)
      })

      it('no options are combat rooms', () => {
        for (let i = 0; i < 50; i++) {
          const options = generateEventRoomOptions(1)
          for (const opt of options) {
            expect(opt.type).not.toBe('combat')
          }
        }
      })

      it('generates valid event room types (mystery, rest, treasure, shop)', () => {
        const validTypes = new Set(['mystery', 'rest', 'treasure', 'shop'])
        for (let i = 0; i < 100; i++) {
          const options = generateEventRoomOptions(1)
          for (const opt of options) {
            expect(validTypes.has(opt.type)).toBe(true)
          }
        }
      })
    })

    describe('FloorState.lastSlotWasEvent', () => {
      it('initializes to false', () => {
        const state = createFloorState()
        expect(state.lastSlotWasEvent).toBe(false)
      })

      it('resets to false on floor advance', () => {
        const state = createFloorState()
        state.lastSlotWasEvent = true
        advanceFloor(state)
        expect(state.lastSlotWasEvent).toBe(false)
      })
    })
  })
})
