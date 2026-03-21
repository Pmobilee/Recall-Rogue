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
      expect(state.playerHp).toBe(80)
      expect(state.playerMaxHp).toBe(80)
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
