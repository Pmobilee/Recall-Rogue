/**
 * Run lifecycle management for the card roguelite.
 * Pure logic layer — no Phaser, Svelte, or DOM imports.
 */

import type { FactDomain } from '../data/card-types'
import type { FloorState } from './floorManager'
import { createFloorState } from './floorManager'
import { PLAYER_START_HP, PLAYER_MAX_HP } from '../data/balance'

// ============================================================
// Types
// ============================================================

export interface RunState {
  isActive: boolean
  primaryDomain: FactDomain
  secondaryDomain: FactDomain
  floor: FloorState
  playerHp: number
  playerMaxHp: number
  currency: number
  cardsEarned: number
  factsAnswered: number
  factsCorrect: number
  bestCombo: number
  startedAt: number
}

export interface RunEndData {
  result: 'victory' | 'defeat' | 'cashout'
  floorReached: number
  factsAnswered: number
  accuracy: number
  bestCombo: number
  cardsEarned: number
  duration: number
}

// ============================================================
// Exported functions
// ============================================================

/** Create a new run state with the chosen domains. */
export function createRunState(primary: FactDomain, secondary: FactDomain): RunState {
  return {
    isActive: true,
    primaryDomain: primary,
    secondaryDomain: secondary,
    floor: createFloorState(),
    playerHp: PLAYER_START_HP,
    playerMaxHp: PLAYER_MAX_HP,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 0,
    factsCorrect: 0,
    bestCombo: 0,
    startedAt: Date.now(),
  }
}

/** Record a card play (quiz answer) in the run stats. */
export function recordCardPlay(state: RunState, correct: boolean, comboCount: number): void {
  state.factsAnswered++
  if (correct) {
    state.factsCorrect++
    state.cardsEarned++
  }
  if (comboCount > state.bestCombo) {
    state.bestCombo = comboCount
  }
}

/** Damage the player. Returns remaining HP. */
export function damagePlayer(state: RunState, amount: number): number {
  state.playerHp = Math.max(0, state.playerHp - amount)
  return state.playerHp
}

/** Heal the player, capped at maxHp. Returns new HP. */
export function healPlayer(state: RunState, amount: number): number {
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount)
  return state.playerHp
}

/** Check if the player is defeated (HP <= 0). */
export function isDefeated(state: RunState): boolean {
  return state.playerHp <= 0
}

/** End the run and produce summary data. */
export function endRun(state: RunState, reason: 'victory' | 'defeat' | 'cashout'): RunEndData {
  state.isActive = false
  const duration = Date.now() - state.startedAt
  const accuracy = state.factsAnswered > 0
    ? Math.round((state.factsCorrect / state.factsAnswered) * 100)
    : 0

  return {
    result: reason,
    floorReached: state.floor.currentFloor,
    factsAnswered: state.factsAnswered,
    accuracy,
    bestCombo: state.bestCombo,
    cardsEarned: state.cardsEarned,
    duration,
  }
}
