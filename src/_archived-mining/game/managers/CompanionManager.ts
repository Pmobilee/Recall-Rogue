import type { CompanionDefinition, CompanionState } from '../../data/companions'
import { COMPANION_CATALOGUE } from '../../data/companions'
import type { RelicStatEffect } from '../../data/relics'
import type { TraitId } from '../../data/petTraits'

/**
 * Bonus set derived from Dust Cat personality traits. (DD-V2-042)
 */
export interface DustCatBonuses {
  quizScoreBonus: number         // from 'playful'
  extraRevealTile: boolean       // from 'curious'
  returnHappinessGain: number    // from 'loyal'
  decayRateMultiplier: number    // from 'stubborn' or 'nocturnal'
  hazardEarlyWarn: boolean       // from 'timid'
  blockDamageBonus: number       // from 'brave'
  happinessFloor: number         // from 'lazy'
  extraFeedItem: boolean         // from 'energetic'
  scholarKpBonus: boolean        // from 'scholar'
}

/**
 * CompanionManager handles active companion effects, in-run temporary upgrades,
 * and the evolution upgrade system. (DD-V2-067)
 */
export class CompanionManager {
  private companion: CompanionDefinition | null = null
  private state: CompanionState | null = null
  /** Temporary in-run stage bonus (from mine event finds). Resets on run end. */
  private tempStageBonus = 0

  /** Initialize with the companion selected in PreDiveScreen. */
  setCompanion(companionId: string | null, states: CompanionState[]): void {
    if (!companionId) { this.companion = null; this.state = null; return }
    const def = COMPANION_CATALOGUE.find(c => c.id === companionId) ?? null
    const state = states.find(s => s.companionId === companionId) ?? null
    this.companion = def
    this.state = state
    this.tempStageBonus = 0
  }

  /** Apply a temporary in-run stage upgrade (from a mine event). Max stage cap at 3. */
  applyTemporaryUpgrade(): void {
    if (!this.state) return
    const effectiveStage = Math.min(3, this.state.currentStage + this.tempStageBonus)
    if (effectiveStage < 3) this.tempStageBonus++
  }

  /** Get the effective evolution stage this run (capped at 3). */
  getEffectiveStage(): number {
    if (!this.state) return 0
    return Math.min(3, this.state.currentStage + this.tempStageBonus)
  }

  /** Get the primary affinity effect for this companion at its effective stage. */
  getPrimaryEffect(): RelicStatEffect | null {
    if (!this.companion || !this.state) return null
    const stage = this.companion.evolutionPath[this.getEffectiveStage()]
    return {
      effectId: this.companion.effectId,
      description: `${this.companion.name} (${this.companion.affinity})`,
      magnitude: stage.affinityMagnitude,
    }
  }

  /** Get optional secondary effect for this companion at effective stage, if any. */
  getSecondaryEffect(): RelicStatEffect | null {
    if (!this.companion || !this.state) return null
    const stage = this.companion.evolutionPath[this.getEffectiveStage()]
    if (!stage.secondaryEffect) return null
    return {
      effectId: stage.secondaryEffect.effectId,
      description: stage.secondaryEffect.description,
      magnitude: stage.secondaryEffect.magnitude,
    }
  }

  /** Get the companion definition. */
  getCompanionDef(): CompanionDefinition | null { return this.companion }

  /** Get the companion state. */
  getState(): CompanionState | null { return this.state }

  /**
   * Check if a companion can be evolved to the next stage.
   * Returns true if shard cost, mastered facts threshold, and dust cat happiness are all met.
   *
   * @param state - The companion's current state.
   * @param masteredFactsCount - Number of mastered facts the player has.
   * @param availableShards - Available shard minerals for the evolution cost.
   * @param dustCatHappiness - Current Dust Cat happiness (0-100), for stage 3 gate.
   */
  static canEvolve(
    state: CompanionState,
    masteredFactsCount: number,
    availableShards: number,
    dustCatHappiness: number = 0,
  ): boolean {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId)
    if (!def) return false
    const nextStage = state.currentStage + 1
    if (nextStage > 3) return false
    const evolution = def.evolutionPath[nextStage]
    if (!evolution) return false
    const happinessOk = evolution.dustCatHappinessRequired === undefined
      || dustCatHappiness >= evolution.dustCatHappinessRequired
    return (
      availableShards >= evolution.shardsRequired &&
      masteredFactsCount >= evolution.masteredFactsRequired &&
      happinessOk
    )
  }

  /**
   * Perform evolution upgrade. Mutates state. Returns shard cost.
   * Caller must deduct shards from inventory.
   */
  static evolve(state: CompanionState): { newStage: number; shardsSpent: number } {
    const def = COMPANION_CATALOGUE.find(c => c.id === state.companionId)
    if (!def || state.currentStage >= 3) throw new Error('Cannot evolve companion')
    const nextStage = state.currentStage + 1
    const evolution = def.evolutionPath[nextStage]
    if (!evolution) throw new Error('Cannot evolve companion: no next stage defined')
    const cost = evolution.shardsRequired
    state.currentStage = nextStage
    return { newStage: nextStage, shardsSpent: cost }
  }

  /**
   * Compute all Dust Cat passive bonuses from the given trait pair. (DD-V2-042)
   *
   * @param traits - The two trait IDs assigned to the Dust Cat.
   * @returns Object of active bonus flags and values.
   */
  static getDustCatBonuses(traits: [TraitId, TraitId] | undefined): DustCatBonuses {
    const defaults: DustCatBonuses = {
      quizScoreBonus: 0, extraRevealTile: false, returnHappinessGain: 0,
      decayRateMultiplier: 1, hazardEarlyWarn: false, blockDamageBonus: 0,
      happinessFloor: 0, extraFeedItem: false, scholarKpBonus: false,
    }
    if (!traits) return defaults
    for (const id of traits) {
      if (id === 'playful') defaults.quizScoreBonus += 0.03
      if (id === 'curious') defaults.extraRevealTile = true
      if (id === 'loyal') defaults.returnHappinessGain += 5
      if (id === 'stubborn') defaults.decayRateMultiplier *= 0.75
      if (id === 'timid') defaults.hazardEarlyWarn = true
      if (id === 'brave') defaults.blockDamageBonus += 0.02
      if (id === 'lazy') defaults.happinessFloor = Math.max(defaults.happinessFloor, 20)
      if (id === 'energetic') defaults.extraFeedItem = true
      if (id === 'scholar') defaults.scholarKpBonus = true
      if (id === 'nocturnal') {
        const h = new Date().getHours()
        if (h >= 22 || h < 6) defaults.decayRateMultiplier *= 0.5
      }
    }
    return defaults
  }
}
