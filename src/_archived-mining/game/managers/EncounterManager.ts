import { get } from 'svelte/store'
import { combatState } from '../../ui/stores/combatState'
import { combatEncounterActive, currentLayer, currentScreen, equippedRelicsV2 } from '../../ui/stores/gameState'
import { combatManager } from './CombatManager'
import { playerSave, addMinerals, playerCompanionStates } from '../../ui/stores/playerData'
import type { Creature } from '../entities/Creature'
import type { Boss } from '../entities/Boss'
import { BALANCE } from '../../data/balance'
import { BOSS_LAYER_MAP } from '../entities/Boss'
import { CompanionManager } from './CompanionManager'
import type { AnalyticsEvent } from '../../services/analyticsService'
import { analyticsService } from '../../services/analyticsService'

/**
 * EncounterManager coordinates the lifecycle of all combat encounters.
 * It is the single point of contact between MineScene and the combat system.
 * GameManager holds an instance and routes MineScene events here.
 *
 * References to QuizManager and MineScene are injected by GameManager after init
 * to avoid circular imports (same pattern as QuizManager). (DD-V2-025)
 */
export class EncounterManager {
  /** Reference to QuizManager — set by GameManager after both are constructed. */
  quizManagerRef: import('./QuizManager').QuizManager | null = null

  private getMineScene: (() => import('../scenes/MineScene').MineScene | null) | null = null

  /** In-process CompanionManager for computing combat stat bonuses. */
  private companionMgr = new CompanionManager()

  /**
   * Set the MineScene accessor (called by GameManager during init).
   *
   * @param fn - Closure that returns the active MineScene, or null.
   */
  setMineSceneAccessor(fn: () => import('../scenes/MineScene').MineScene | null): void {
    this.getMineScene = fn
  }

  /**
   * Sync the CompanionManager state from the current player save.
   * Called just before a combat encounter starts.
   */
  private _syncCompanion(): void {
    const save = get(playerSave)
    if (!save) return
    const companionId = save.activeCompanion ?? null
    const states = get(playerCompanionStates) ?? []
    this.companionMgr.setCompanion(companionId, states)
  }

  /** True if a combat encounter is currently active (blocks mining). */
  isInCombat(): boolean {
    return get(combatEncounterActive)
  }

  /**
   * Begin a creature encounter.
   * Called by GameManager when MineScene emits 'creature-encounter'.
   *
   * @param creature - The creature instance to fight.
   */
  startCreatureEncounter(creature: Creature): void {
    this._syncCompanion()
    const playerHp = this._computePlayerHp(BALANCE.COMBAT_PLAYER_BASE_HP)
    const playerAttack = this._computePlayerAttack()
    const playerDefense = this._computePlayerDefense()

    combatManager.startCombat(creature, { hp: playerHp, attack: playerAttack, defense: playerDefense })
    combatState.set({
      active: true,
      encounterType: 'creature',
      creature,
      playerHp,
      playerMaxHp: playerHp,
      creatureHp: creature.hp,
      creatureMaxHp: creature.maxHp,
      turn: 0,
      bossPhase: 0,
      log: [`A ${creature.name} emerges from the darkness!`],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
    combatEncounterActive.set(true)
    currentScreen.set('combat')

    analyticsService.track({
      name: 'combat_started',
      properties: { encounter_type: 'creature', creature_id: creature.id, layer: get(currentLayer) },
    } as unknown as AnalyticsEvent)
  }

  /**
   * Begin a boss encounter.
   * Called by GameManager when MineScene emits 'boss-encounter'.
   *
   * @param boss - The boss instance to fight.
   */
  startBossEncounter(boss: Boss): void {
    this._syncCompanion()
    const layerDepth = boss.depthRange[0]
    const baseHp = Math.round(
      BALANCE.COMBAT_PLAYER_BASE_HP + (layerDepth - 1) * BALANCE.COMBAT_PLAYER_HP_PER_LAYER
    )
    const playerHp = this._computePlayerHp(baseHp)
    const playerAttack = this._computePlayerAttack()
    const playerDefense = this._computePlayerDefense()

    combatManager.startCombat(boss, { hp: playerHp, attack: playerAttack, defense: playerDefense })
    combatState.set({
      active: true,
      encounterType: 'boss',
      creature: boss,
      playerHp,
      playerMaxHp: playerHp,
      creatureHp: boss.hp,
      creatureMaxHp: boss.maxHp,
      turn: 0,
      bossPhase: 0,
      log: [boss.title, `HP: ${boss.hp}`],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
    combatEncounterActive.set(true)
    currentScreen.set('combat')

    analyticsService.track({
      name: 'combat_started',
      properties: { encounter_type: 'boss', creature_id: boss.id, layer: get(currentLayer) },
    } as unknown as AnalyticsEvent)
  }

  /**
   * Start a quiz attack. Gauntlet chain length depends on boss phase.
   * For creature encounters: always 1 question.
   * For boss encounters: 1/2/2/3 questions per phase (phase 0/1/2/3).
   */
  startQuizAttack(): void {
    const state = get(combatState)
    if (!state.active || !this.quizManagerRef) return

    const isBoss = state.encounterType === 'boss'
    const bossPhase = state.bossPhase
    const gauntletSize = isBoss
      ? (bossPhase >= 3 ? 3 : bossPhase >= 1 ? 2 : 1)
      : 1

    const factCategory =
      (state.creature as Boss | null)?.quizCategory ??
      (state.creature as Creature | null)?.factCategory ??
      'General Knowledge'

    // Apply quiz_master relic bonus to pending attack multiplier
    const relics = get(equippedRelicsV2) ?? []
    let quizMultiplier = 1.0
    for (const relic of relics) {
      for (const effect of relic.effects) {
        if (effect.effectId === 'quiz_master') {
          quizMultiplier += effect.magnitude
        }
      }
    }
    combatManager.setPendingQuizMultiplier(quizMultiplier)

    combatState.update(s => ({ ...s, awaitingQuiz: true }))
    void this.quizManagerRef.triggerCombatQuiz(factCategory, gauntletSize, gauntletSize)
  }

  /**
   * Called by QuizManager when a combat quiz answer is resolved.
   * Applies damage if correct, applies creature counter-attack, checks phase transition.
   *
   * @param correct - Whether the player answered correctly.
   */
  resolveCombatQuizAnswer(correct: boolean): void {
    if (!correct) {
      const scene = this.getMineScene?.()
      if (scene) scene.drainOxygen(BALANCE.COMBAT_WRONG_O2_COST)
    }

    const action = correct ? ('quiz_attack' as const) : ('defend' as const)
    const result = combatManager.executeTurn(action)

    combatState.update(s => ({
      ...s,
      playerHp: result.playerHp,
      creatureHp: result.creatureHp,
      turn: s.turn + 1,
      bossPhase: result.phaseTransition ? result.phaseTransition.phase : s.bossPhase,
      log: [...s.log.slice(-8), result.message],
      awaitingQuiz: false,
      result: result.combatOver ? (result.victory ? 'victory' : 'defeat') : null,
      pendingLoot: result.loot ?? s.pendingLoot,
    }))

    if (result.combatOver) {
      combatEncounterActive.set(false)
      if (result.victory) {
        this._processVictoryRewards()
      } else {
        // Player defeated — surface immediately
        const scene = this.getMineScene?.()
        scene?.game.events.emit('combat-defeat')
      }
    }
  }

  /**
   * Player chose to defend (no quiz — take reduced damage, no O2 cost).
   */
  defend(): void {
    const result = combatManager.executeTurn('defend')
    combatState.update(s => ({
      ...s,
      playerHp: result.playerHp,
      creatureHp: result.creatureHp,
      turn: s.turn + 1,
      log: [...s.log.slice(-8), result.message],
      awaitingQuiz: false,
      result: result.combatOver ? (result.victory ? 'victory' : 'defeat') : null,
    }))
    if (result.combatOver) {
      combatEncounterActive.set(false)
      if (result.victory) this._processVictoryRewards()
    }
  }

  /**
   * Player chose to flee. Costs O2 regardless of success.
   * Returns true if flee succeeded.
   */
  attemptFlee(): boolean {
    const scene = this.getMineScene?.()
    if (scene) scene.drainOxygen(BALANCE.COMBAT_FLEE_O2_COST)

    const result = combatManager.executeTurn('flee')
    combatState.update(s => ({
      ...s,
      log: [...s.log.slice(-8), result.message],
      result: result.combatOver ? 'fled' : null,
      awaitingQuiz: false,
    }))
    if (result.combatOver) combatEncounterActive.set(false)
    return result.combatOver
  }

  /**
   * Check if The Deep is unlocked for the current dive.
   * Requires all 4 bosses to have been defeated in this run. (DD-V2-025)
   */
  isTheDeepUnlocked(): boolean {
    const save = get(playerSave)
    if (!save) return false
    const defeated = new Set(save.defeatedBossesThisRun ?? [])
    const required = Object.values(BOSS_LAYER_MAP)
    return required.every(id => defeated.has(id))
  }

  /** End combat without any result (emergency cleanup). */
  forceEndCombat(): void {
    combatManager.endCombat()
    combatEncounterActive.set(false)
    combatState.update(s => ({ ...s, active: false, result: null }))
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Compute player attack stat, applying companion combat bonus if active.
   */
  private _computePlayerAttack(): number {
    let attack = BALANCE.COMBAT_BASE_PLAYER_ATTACK
    const effect = this.companionMgr.getPrimaryEffect()
    if (effect?.effectId === 'combat_attack_bonus') {
      attack += Math.round(attack * effect.magnitude)
    }
    return attack
  }

  /**
   * Compute player defense stat, applying companion combat bonus if active.
   */
  private _computePlayerDefense(): number {
    let defense = BALANCE.COMBAT_BASE_PLAYER_DEFENSE
    const effect = this.companionMgr.getPrimaryEffect()
    if (effect?.effectId === 'combat_defense_bonus') {
      defense += Math.round(defense * effect.magnitude)
    }
    return defense
  }

  /**
   * Compute final player HP, applying companion HP bonus if active.
   *
   * @param baseHp - Base HP before companion bonuses.
   */
  private _computePlayerHp(baseHp: number): number {
    const hpEffect = this.companionMgr.getSecondaryEffect()
    if (hpEffect?.effectId === 'combat_hp_bonus') {
      return baseHp + Math.round(BALANCE.COMBAT_PLAYER_BASE_HP * hpEffect.magnitude)
    }
    return baseHp
  }

  /**
   * Process rewards for a combat victory: grant loot minerals,
   * update defeat records, fire analytics events.
   */
  private _processVictoryRewards(): void {
    const state = get(combatState)
    const creature = state.creature
    if (!creature) return

    // Grant loot minerals
    for (const entry of creature.loot) {
      addMinerals(entry.mineralTier as import('../../data/types').MineralTier, entry.amount)
    }

    const isBoss = 'isBoss' in creature && (creature as Boss).isBoss
    const turns = state.turn

    if (isBoss) {
      const boss = creature as Boss
      playerSave.update(save => {
        if (!save) return save
        const defeated = new Set(save.defeatedBossesThisRun ?? [])
        defeated.add(boss.id)
        const allDefeated = new Set(save.defeatedBosses ?? [])
        allDefeated.add(boss.id)
        return {
          ...save,
          defeatedBossesThisRun: [...defeated],
          defeatedBosses: [...allDefeated],
        }
      })

      analyticsService.track({
        name: 'boss_defeated',
        properties: { boss_id: boss.id, layer: get(currentLayer), turns },
      } as unknown as AnalyticsEvent)
    } else {
      playerSave.update(save =>
        save ? { ...save, creatureKills: (save.creatureKills ?? 0) + 1 } : save
      )

      analyticsService.track({
        name: 'combat_victory',
        properties: { creature_id: creature.id, turns, companion_xp: 0 },
      } as unknown as AnalyticsEvent)
    }
  }
}

/** Singleton encounter manager. */
export const encounterManager = new EncounterManager()
