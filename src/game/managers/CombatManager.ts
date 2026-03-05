import type { Creature } from '../entities/Creature'
import type { Boss } from '../entities/Boss'
import { calculateDamage, shouldFlee } from '../entities/Creature'
import { checkPhaseTransition } from '../entities/Boss'
import { BALANCE } from '../../data/balance'

/** Combat action types */
export type CombatAction = 'attack' | 'defend' | 'use_item' | 'flee' | 'quiz_attack'

/** Combat turn result */
export interface TurnResult {
  playerDamageDealt: number
  creatureDamageDealt: number
  playerHp: number
  creatureHp: number
  message: string
  combatOver: boolean
  victory: boolean
  phaseTransition?: { phase: number; dialogue: string }
  loot?: { mineralTier: string; amount: number }[]
}

/** Combat state */
export interface CombatState {
  active: boolean
  creature: Creature | Boss | null
  playerHp: number
  playerMaxHp: number
  playerAttack: number
  playerDefense: number
  turn: number
  defending: boolean
  log: string[]
}

class CombatManager {
  private state: CombatState = {
    active: false,
    creature: null,
    playerHp: 100,
    playerMaxHp: 100,
    playerAttack: 10,
    playerDefense: 5,
    turn: 0,
    defending: false,
    log: []
  }

  /** Multiplier applied on the next quiz_attack action (reset to 1.0 after use). */
  private pendingQuizMultiplier = 1.0

  /** Start a combat encounter */
  startCombat(creature: Creature | Boss, playerStats: { hp: number; attack: number; defense: number }): CombatState {
    this.state = {
      active: true,
      creature,
      playerHp: playerStats.hp,
      playerMaxHp: playerStats.hp,
      playerAttack: playerStats.attack,
      playerDefense: playerStats.defense,
      turn: 0,
      defending: false,
      log: [`A wild ${creature.name} appears!`]
    }
    return this.getState()
  }

  /** Execute a player action */
  executeTurn(action: CombatAction): TurnResult {
    if (!this.state.active || !this.state.creature) {
      return { playerDamageDealt: 0, creatureDamageDealt: 0, playerHp: this.state.playerHp, creatureHp: 0, message: 'No active combat', combatOver: true, victory: false }
    }

    this.state.turn++
    let playerDamageDealt = 0
    let creatureDamageDealt = 0
    let message = ''
    const creature = this.state.creature

    // Player action
    switch (action) {
      case 'attack':
      case 'quiz_attack': {
        const quizMult = action === 'quiz_attack'
          ? BALANCE.COMBAT_QUIZ_ATTACK_MULTIPLIER * this.pendingQuizMultiplier
          : 1.0
        this.pendingQuizMultiplier = 1.0  // reset after use
        playerDamageDealt = calculateDamage(this.state.playerAttack * quizMult, creature.defense)
        creature.hp = Math.max(0, creature.hp - playerDamageDealt)
        message = `You deal ${playerDamageDealt} damage!`
        this.state.defending = false
        break
      }
      case 'defend':
        this.state.defending = true
        message = 'You brace for impact.'
        break
      case 'flee': {
        const fleeChance = creature.behavior === 'aggressive' ? 0.3 : 0.6
        if (Math.random() < fleeChance) {
          this.state.active = false
          return { playerDamageDealt: 0, creatureDamageDealt: 0, playerHp: this.state.playerHp, creatureHp: creature.hp, message: 'You escaped!', combatOver: true, victory: false }
        }
        message = 'Failed to flee!'
        break
      }
      case 'use_item':
        message = 'Used an item.'
        break
    }

    // Check boss phase transition
    let phaseTransition: TurnResult['phaseTransition'] | undefined
    if ('isBoss' in creature && creature.isBoss) {
      const boss = creature as Boss
      const phase = checkPhaseTransition(boss)
      if (phase) {
        boss.currentPhase++
        phaseTransition = { phase: boss.currentPhase, dialogue: phase.dialogue }
        message += ` ${phase.dialogue}`
      }
    }

    // Check creature defeat
    if (creature.hp <= 0) {
      this.state.active = false
      creature.state = 'defeated'
      return { playerDamageDealt, creatureDamageDealt: 0, playerHp: this.state.playerHp, creatureHp: 0, message: `${creature.name} defeated! ${message}`, combatOver: true, victory: true, phaseTransition, loot: creature.loot }
    }

    // Check creature flee
    if (shouldFlee(creature)) {
      this.state.active = false
      return { playerDamageDealt, creatureDamageDealt: 0, playerHp: this.state.playerHp, creatureHp: creature.hp, message: `${creature.name} fled!`, combatOver: true, victory: true }
    }

    // Creature attacks
    if (action !== 'flee') {
      const defenseMultiplier = this.state.defending ? 2 : 1
      creatureDamageDealt = calculateDamage(creature.attack, this.state.playerDefense * defenseMultiplier)
      this.state.playerHp = Math.max(0, this.state.playerHp - creatureDamageDealt)
      message += ` ${creature.name} deals ${creatureDamageDealt} damage!`
    }

    // Check player defeat
    if (this.state.playerHp <= 0) {
      this.state.active = false
      return { playerDamageDealt, creatureDamageDealt, playerHp: 0, creatureHp: creature.hp, message: `${message} You were defeated!`, combatOver: true, victory: false, phaseTransition }
    }

    this.state.log.push(message)
    return { playerDamageDealt, creatureDamageDealt, playerHp: this.state.playerHp, creatureHp: creature.hp, message, combatOver: false, victory: false, phaseTransition }
  }

  /**
   * Set a multiplier to apply on the next quiz_attack turn.
   * Called by EncounterManager after a correct quiz answer to boost damage. (DD-V2-025)
   *
   * @param multiplier - Extra multiplier stacked on top of COMBAT_QUIZ_ATTACK_MULTIPLIER.
   */
  setPendingQuizMultiplier(multiplier: number): void {
    this.pendingQuizMultiplier = multiplier
  }

  /** Get current combat state */
  getState(): CombatState {
    return { ...this.state }
  }

  /** Check if combat is active */
  isActive(): boolean {
    return this.state.active
  }

  /** End combat prematurely */
  endCombat(): void {
    this.state.active = false
    this.state.creature = null
  }
}

export const combatManager = new CombatManager()
