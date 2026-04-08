import { describe, it, expect } from 'vitest'
import {
  createRunState,
  recordCardPlay,
  damagePlayer,
  healPlayer,
  isDefeated,
  endRun,
} from '../../src/services/runManager'
import { PLAYER_START_HP, PLAYER_MAX_HP } from '../../src/data/balance'

describe('RunManager', () => {
  describe('createRunState', () => {
    it('initializes with correct defaults', () => {
      const state = createRunState('science', 'history')
      expect(state.isActive).toBe(true)
      expect(state.playerHp).toBe(PLAYER_MAX_HP)
      expect(state.playerMaxHp).toBe(PLAYER_MAX_HP)
      expect(state.currency).toBe(0)
      expect(state.cardsEarned).toBe(0)
      expect(state.factsAnswered).toBe(0)
      expect(state.factsCorrect).toBe(0)
      expect(state.bestCombo).toBe(0)
      expect(state.startedAt).toBeGreaterThan(0)
    })

    it('sets primary and secondary domains', () => {
      const state = createRunState('language', 'geography')
      expect(state.primaryDomain).toBe('language')
      expect(state.secondaryDomain).toBe('geography')
    })

    it('starts with PLAYER_MAX_HP', () => {
      const state = createRunState('science', 'history')
      expect(state.playerHp).toBe(PLAYER_MAX_HP)
    })

    it('applies ascension level 13+ max HP override', () => {
      const state = createRunState('science', 'history', { ascensionLevel: 14 })
      expect(state.playerHp).toBe(75)
      expect(state.playerMaxHp).toBe(75)
    })
  })

  describe('recordCardPlay', () => {
    it('increments factsAnswered', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 1)
      expect(state.factsAnswered).toBe(1)
      recordCardPlay(state, false, 0)
      expect(state.factsAnswered).toBe(2)
    })

    it('increments factsCorrect on correct answer', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 1)
      expect(state.factsCorrect).toBe(1)
      recordCardPlay(state, false, 0)
      expect(state.factsCorrect).toBe(1)
      recordCardPlay(state, true, 2)
      expect(state.factsCorrect).toBe(2)
    })

    it('tracks bestCombo', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 3)
      expect(state.bestCombo).toBe(3)
      recordCardPlay(state, true, 1) // lower combo, should not update
      expect(state.bestCombo).toBe(3)
      recordCardPlay(state, true, 5) // higher combo, should update
      expect(state.bestCombo).toBe(5)
    })

    it('increments cardsEarned on correct answer', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 1)
      expect(state.cardsEarned).toBe(1)
      recordCardPlay(state, false, 0)
      expect(state.cardsEarned).toBe(1)
    })
  })

  describe('damagePlayer', () => {
    it('reduces HP correctly', () => {
      const state = createRunState('science', 'history')
      const remaining = damagePlayer(state, 20)
      expect(remaining).toBe(PLAYER_MAX_HP - 20)
      expect(state.playerHp).toBe(PLAYER_MAX_HP - 20)
    })

    it('does not go below 0', () => {
      const state = createRunState('science', 'history')
      const remaining = damagePlayer(state, 999)
      expect(remaining).toBe(0)
      expect(state.playerHp).toBe(0)
    })
  })

  describe('healPlayer', () => {
    it('heals correctly', () => {
      const state = createRunState('science', 'history')
      damagePlayer(state, 30)
      const newHp = healPlayer(state, 15)
      expect(newHp).toBe(PLAYER_MAX_HP - 30 + 15)
      expect(state.playerHp).toBe(PLAYER_MAX_HP - 30 + 15)
    })

    it('caps at maxHp', () => {
      const state = createRunState('science', 'history')
      damagePlayer(state, 10)
      const newHp = healPlayer(state, 999)
      expect(newHp).toBe(PLAYER_MAX_HP)
      expect(state.playerHp).toBe(PLAYER_MAX_HP)
    })
  })

  describe('isDefeated', () => {
    it('returns false when HP > 0', () => {
      const state = createRunState('science', 'history')
      expect(isDefeated(state)).toBe(false)
    })

    it('returns true when HP = 0', () => {
      const state = createRunState('science', 'history')
      damagePlayer(state, state.playerHp)
      expect(isDefeated(state)).toBe(true)
    })
  })

  describe('endRun', () => {
    it('calculates accuracy correctly', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 1)
      recordCardPlay(state, true, 2)
      recordCardPlay(state, false, 0)
      recordCardPlay(state, true, 1)
      const endData = endRun(state, 'victory')
      expect(endData.accuracy).toBe(75) // 3/4 = 75%
    })

    it('returns correct floor reached', () => {
      const state = createRunState('science', 'history')
      state.floor.currentFloor = 5
      const endData = endRun(state, 'defeat')
      expect(endData.floorReached).toBe(5)
    })

    it('applies segment death penalty on defeat', () => {
      const state = createRunState('science', 'history')
      state.floor.currentFloor = 5 // segment 2 -> 80%
      state.currency = 200
      const endData = endRun(state, 'defeat')
      expect(endData.rewardMultiplier).toBe(0.8)
      expect(endData.currencyEarned).toBe(160)
    })

    it('sets result correctly', () => {
      const state1 = createRunState('science', 'history')
      expect(endRun(state1, 'victory').result).toBe('victory')

      const state2 = createRunState('science', 'history')
      expect(endRun(state2, 'defeat').result).toBe('defeat')

      const state3 = createRunState('science', 'history')
      expect(endRun(state3, 'retreat').result).toBe('retreat')
    })

    it('marks run as inactive', () => {
      const state = createRunState('science', 'history')
      endRun(state, 'defeat')
      expect(state.isActive).toBe(false)
    })

    it('handles zero facts answered', () => {
      const state = createRunState('science', 'history')
      const endData = endRun(state, 'defeat')
      expect(endData.accuracy).toBe(0)
      expect(endData.factsAnswered).toBe(0)
    })

    it('suppresses retreat rewards when retreat lock is active', () => {
      const state = createRunState('science', 'history', { ascensionLevel: 10 })
      state.currency = 999
      state.retreatRewardLocked = true
      const endData = endRun(state, 'retreat')
      expect(endData.currencyEarned).toBe(0)
    })

    it('returns duration > 0', () => {
      const state = createRunState('science', 'history')
      // small delay to ensure duration > 0
      state.startedAt = Date.now() - 1000
      const endData = endRun(state, 'victory')
      expect(endData.duration).toBeGreaterThan(0)
      expect(endData.rewardMultiplier).toBe(1)
      expect(endData.currencyEarned).toBe(state.currency)
    })
  })
})

describe('RunManager — Journal/Profile tracking (Section A+B)', () => {
  describe('createRunState — new tracking fields', () => {
    it('initializes firstTimeFactIds as empty Set', () => {
      const state = createRunState('science', 'history')
      expect(state.firstTimeFactIds).toBeInstanceOf(Set)
      expect(state.firstTimeFactIds!.size).toBe(0)
    })

    it('initializes masteredThisRunFactIds as empty Set', () => {
      const state = createRunState('science', 'history')
      expect(state.masteredThisRunFactIds).toBeInstanceOf(Set)
      expect(state.masteredThisRunFactIds!.size).toBe(0)
    })

    it('initializes reviewStateSnapshot as undefined (populated by caller)', () => {
      const state = createRunState('science', 'history')
      // Snapshot starts undefined — set by gameFlowController after createRunState
      expect(state.reviewStateSnapshot).toBeUndefined()
    })
  })

  describe('recordCardPlay — first-time fact tracking', () => {
    it('adds factId to firstTimeFactIds when snapshot has no entry', () => {
      const state = createRunState('science', 'history')
      // Set up empty snapshot (simulating run start with no prior FSRS data)
      state.reviewStateSnapshot = new Map()

      recordCardPlay(state, true, 1, 'fact_001')
      expect(state.firstTimeFactIds!.has('fact_001')).toBe(true)
    })

    it('does NOT add factId to firstTimeFactIds when snapshot has entry (known fact)', () => {
      const state = createRunState('science', 'history')
      state.reviewStateSnapshot = new Map([
        ['fact_001', { cardState: 'review', stability: 5, tier: '2a' }],
      ])

      recordCardPlay(state, true, 1, 'fact_001')
      expect(state.firstTimeFactIds!.has('fact_001')).toBe(false)
    })

    it('does not add factId again if already in firstTimeFactIds', () => {
      const state = createRunState('science', 'history')
      state.reviewStateSnapshot = new Map()

      recordCardPlay(state, true, 1, 'fact_001')
      recordCardPlay(state, false, 0, 'fact_001') // second answer
      expect(state.firstTimeFactIds!.size).toBe(1) // still 1, not 2
    })

    it('works when snapshot is undefined (no tracking, silent no-op)', () => {
      const state = createRunState('science', 'history')
      // No snapshot set — recordCardPlay should not crash
      expect(() => recordCardPlay(state, true, 1, 'fact_abc')).not.toThrow()
    })
  })

  describe('endRun — delta computation', () => {
    it('counts firstTimeFactIds.size as newFactsSeen', () => {
      const state = createRunState('science', 'history')
      state.reviewStateSnapshot = new Map()
      // Two new facts answered
      recordCardPlay(state, true, 1, 'new_fact_1')
      recordCardPlay(state, true, 2, 'new_fact_2')
      const endData = endRun(state, 'victory')
      expect(endData.newFactsSeen).toBe(2)
    })

    it('returns newFactsSeen=0 when snapshot is undefined', () => {
      const state = createRunState('science', 'history')
      // No snapshot — firstTimeFactIds is empty (not populated)
      recordCardPlay(state, true, 1, 'fact_x')
      const endData = endRun(state, 'victory')
      expect(endData.newFactsSeen).toBe(0)
    })

    it('counts factsReviewed from snapshot entries that were answered', () => {
      const state = createRunState('science', 'history')
      // Simulate run start with 2 known facts in snapshot (tier 2a)
      state.reviewStateSnapshot = new Map([
        ['known_1', { cardState: 'review', stability: 3, tier: '2a' }],
        ['known_2', { cardState: 'review', stability: 3, tier: '2a' }],
        ['known_3', { cardState: 'review', stability: 3, tier: '2a' }], // not answered
      ])
      recordCardPlay(state, true, 1, 'known_1')
      recordCardPlay(state, true, 2, 'known_2')
      const endData = endRun(state, 'victory')
      // known_1 and known_2 were answered and had snapshot entries
      expect(endData.factsReviewed).toBe(2)
    })

    it('returns enemiesDefeatedList from defeatedEnemyIds', () => {
      const state = createRunState('science', 'history')
      state.defeatedEnemyIds = ['goblin', 'orc', 'dragon']
      const endData = endRun(state, 'victory')
      expect(endData.enemiesDefeatedList).toEqual(['goblin', 'orc', 'dragon'])
    })

    it('returns domainAccuracy from state', () => {
      const state = createRunState('science', 'history')
      recordCardPlay(state, true, 1, 'f1', 'science')
      recordCardPlay(state, false, 0, 'f2', 'science')
      const endData = endRun(state, 'retreat')
      expect(endData.domainAccuracy?.['science']).toEqual({ answered: 2, correct: 1 })
    })

    it('computes factStateSummary with non-zero seen when no reviewStates', () => {
      const state = createRunState('science', 'history')
      state.reviewStateSnapshot = new Map()
      recordCardPlay(state, true, 1, 'brand_new_fact')
      const endData = endRun(state, 'victory')
      // With no reviewStates loaded, all touched facts count as seen
      expect(endData.factStateSummary.seen).toBe(1)
      expect(endData.factStateSummary.mastered).toBe(0)
    })
  })
})
