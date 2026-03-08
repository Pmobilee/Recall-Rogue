/**
 * Orchestrates screen transitions and game flow state machine for the card roguelite.
 * Uses Svelte stores for reactive state.
 */

import { currentScreen } from '../ui/stores/gameState'
import type { RunState, RunEndData } from './runManager'
import { createRunState, endRun } from './runManager'
import type { RoomOption, MysteryEvent } from './floorManager'
import { generateRoomOptions, generateMysteryEvent, advanceEncounter, advanceFloor } from './floorManager'
import type { FactDomain } from '../data/card-types'
import { writable, get } from 'svelte/store'

// ============================================================
// Flow state types
// ============================================================

export type GameFlowState =
  | 'idle'
  | 'domainSelection'
  | 'combat'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'treasureReward'
  | 'bossEncounter'
  | 'runEnd'

// ============================================================
// Stores
// ============================================================

export const gameFlowState = writable<GameFlowState>('idle')
export const activeRunState = writable<RunState | null>(null)
export const activeRoomOptions = writable<RoomOption[]>([])
export const activeMysteryEvent = writable<MysteryEvent | null>(null)
export const activeRunEndData = writable<RunEndData | null>(null)

// ============================================================
// Flow control functions
// ============================================================

/** Start new run flow — go to domain selection. */
export function startNewRun(): void {
  gameFlowState.set('domainSelection')
  currentScreen.set('domainSelection')
}

/** Domains selected — build run state, start first encounter. */
export function onDomainsSelected(primary: FactDomain, secondary: FactDomain): void {
  const state = createRunState(primary, secondary)
  activeRunState.set(state)
  gameFlowState.set('combat')
  currentScreen.set('combat')
}

/** Encounter complete — generate rooms or handle boss/end. */
export function onEncounterComplete(result: 'victory' | 'defeat'): void {
  if (result === 'defeat') {
    const state = get(activeRunState)!
    const endData = endRun(state, 'defeat')
    activeRunEndData.set(endData)
    gameFlowState.set('runEnd')
    currentScreen.set('runEnd')
    return
  }

  // Victory — advance encounter and check floor state
  const state = get(activeRunState)!
  const floorDone = advanceEncounter(state.floor)

  if (floorDone) {
    // Boss floor complete or last encounter
    if (state.floor.currentFloor >= 9) {
      const endData = endRun(state, 'victory')
      activeRunEndData.set(endData)
      gameFlowState.set('runEnd')
      currentScreen.set('runEnd')
    } else {
      advanceFloor(state.floor)
      activeRunState.set(state)
      // Generate rooms for next segment
      const rooms = generateRoomOptions(state.floor.currentFloor)
      activeRoomOptions.set(rooms)
      gameFlowState.set('roomSelection')
      currentScreen.set('roomSelection')
    }
  } else {
    // More encounters on this floor
    const rooms = generateRoomOptions(state.floor.currentFloor)
    activeRoomOptions.set(rooms)
    gameFlowState.set('roomSelection')
    currentScreen.set('roomSelection')
  }
}

/** Room selected — navigate to appropriate screen. */
export function onRoomSelected(room: RoomOption): void {
  switch (room.type) {
    case 'combat':
      gameFlowState.set('combat')
      currentScreen.set('combat')
      break
    case 'mystery': {
      const event = generateMysteryEvent()
      activeMysteryEvent.set(event)
      gameFlowState.set('mysteryEvent')
      currentScreen.set('mysteryEvent')
      break
    }
    case 'rest':
      gameFlowState.set('restRoom')
      currentScreen.set('restRoom')
      break
    case 'treasure':
      gameFlowState.set('treasureReward')
      currentScreen.set('combat') // Treasure gives free card then goes to next
      break
    case 'shop':
      // Placeholder — shop not implemented yet, treat as combat
      gameFlowState.set('combat')
      currentScreen.set('combat')
      break
  }
}

/** Mystery resolved — back to room selection or next encounter. */
export function onMysteryResolved(): void {
  const state = get(activeRunState)!
  const rooms = generateRoomOptions(state.floor.currentFloor)
  activeRoomOptions.set(rooms)
  gameFlowState.set('roomSelection')
  currentScreen.set('roomSelection')
}

/** Rest resolved — back to room selection. */
export function onRestResolved(): void {
  const state = get(activeRunState)!
  const rooms = generateRoomOptions(state.floor.currentFloor)
  activeRoomOptions.set(rooms)
  gameFlowState.set('roomSelection')
  currentScreen.set('roomSelection')
}

/** Return to main menu. */
export function returnToMenu(): void {
  activeRunState.set(null)
  activeRunEndData.set(null)
  gameFlowState.set('idle')
  currentScreen.set('mainMenu')
}

/** Play again — shortcut to domain selection. */
export function playAgain(): void {
  activeRunState.set(null)
  activeRunEndData.set(null)
  gameFlowState.set('domainSelection')
  currentScreen.set('domainSelection')
}
