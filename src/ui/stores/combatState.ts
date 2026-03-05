import { writable } from 'svelte/store'
import type { Creature } from '../../game/entities/Creature'
import type { Boss } from '../../game/entities/Boss'

/** Reactive UI state for all combat encounters (creature and boss). */
export interface CombatUIState {
  active: boolean
  /** 'creature' for random encounters, 'boss' for landmark bosses */
  encounterType: 'creature' | 'boss'
  creature: Creature | Boss | null
  playerHp: number
  playerMaxHp: number
  creatureHp: number
  creatureMaxHp: number
  turn: number
  /** Current boss phase index (0-based) */
  bossPhase: number
  /** Log of combat messages shown in the UI */
  log: string[]
  /** True while waiting for a quiz answer to resolve the current attack */
  awaitingQuiz: boolean
  /** Result of the last completed combat (null while ongoing) */
  result: 'victory' | 'defeat' | 'fled' | null
  /** Loot to display on victory */
  pendingLoot: { mineralTier: string; amount: number }[]
  /** Companion XP earned this combat */
  companionXpEarned: number
}

/**
 * Singleton writable store for combat UI state.
 * Uses globalThis to survive module re-evaluation across code-split chunks.
 */
function makeCombatState(): ReturnType<typeof writable<CombatUIState>> {
  const sym = Symbol.for('terra:combatState')
  if (!(globalThis as any)[sym]) {
    ;(globalThis as any)[sym] = writable<CombatUIState>({
      active: false,
      encounterType: 'creature',
      creature: null,
      playerHp: 0,
      playerMaxHp: 0,
      creatureHp: 0,
      creatureMaxHp: 0,
      turn: 0,
      bossPhase: 0,
      log: [],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
  }
  return (globalThis as any)[sym]
}

export const combatState = makeCombatState()
