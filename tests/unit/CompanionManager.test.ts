// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { CompanionManager } from '../../src/game/managers/CompanionManager'
import { COMPANION_CATALOGUE } from '../../src/data/companions'
import type { CompanionState } from '../../src/data/companions'

function makeCompanionState(
  companionId: string,
  stage: number = 0,
): CompanionState {
  return { companionId, currentStage: stage, unlocked: true }
}

describe('CompanionManager — no companion set', () => {
  let mgr: CompanionManager

  beforeEach(() => {
    mgr = new CompanionManager()
  })

  it('getPrimaryEffect returns null when no companion set', () => {
    expect(mgr.getPrimaryEffect()).toBeNull()
  })

  it('getSecondaryEffect returns null when no companion set', () => {
    expect(mgr.getSecondaryEffect()).toBeNull()
  })

  it('getEffectiveStage returns 0 when no companion set', () => {
    expect(mgr.getEffectiveStage()).toBe(0)
  })

  it('getCompanionDef returns null when no companion set', () => {
    expect(mgr.getCompanionDef()).toBeNull()
  })

  it('getState returns null when no companion set', () => {
    expect(mgr.getState()).toBeNull()
  })
})

describe('CompanionManager — with companion', () => {
  let mgr: CompanionManager
  const firstCompanion = COMPANION_CATALOGUE[0]

  beforeEach(() => {
    mgr = new CompanionManager()
  })

  it('setCompanion(null) clears the companion', () => {
    const states = [makeCompanionState(firstCompanion.id)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.setCompanion(null, states)
    expect(mgr.getPrimaryEffect()).toBeNull()
  })

  it('setCompanion with valid id populates primary effect', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    const effect = mgr.getPrimaryEffect()
    expect(effect).not.toBeNull()
    expect(effect!.effectId).toBe(firstCompanion.effectId)
  })

  it('getEffectiveStage returns currentStage when tempBonus is 0', () => {
    const states = [makeCompanionState(firstCompanion.id, 1)]
    mgr.setCompanion(firstCompanion.id, states)
    expect(mgr.getEffectiveStage()).toBe(1)
  })

  it('applyTemporaryUpgrade increments effective stage (max cap 2)', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(1)
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(2)
    // Cannot exceed 2
    mgr.applyTemporaryUpgrade()
    expect(mgr.getEffectiveStage()).toBe(2)
  })

  it('tempStageBonus resets when setCompanion is called again', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    mgr.applyTemporaryUpgrade()
    mgr.applyTemporaryUpgrade()
    mgr.setCompanion(firstCompanion.id, states)
    expect(mgr.getEffectiveStage()).toBe(0)
  })

  it('getCompanionDef returns the companion definition', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    const def = mgr.getCompanionDef()
    expect(def).not.toBeNull()
    expect(def!.id).toBe(firstCompanion.id)
  })

  it('primaryEffect magnitude matches evolutionPath stage 0', () => {
    const states = [makeCompanionState(firstCompanion.id, 0)]
    mgr.setCompanion(firstCompanion.id, states)
    const effect = mgr.getPrimaryEffect()
    expect(effect!.magnitude).toBe(firstCompanion.evolutionPath[0].affinityMagnitude)
  })

  it('primaryEffect magnitude changes at stage 1', () => {
    const states = [makeCompanionState(firstCompanion.id, 1)]
    mgr.setCompanion(firstCompanion.id, states)
    const effect = mgr.getPrimaryEffect()
    expect(effect!.magnitude).toBe(firstCompanion.evolutionPath[1].affinityMagnitude)
  })
})

describe('CompanionManager.canEvolve (static)', () => {
  const secondCompanion = COMPANION_CATALOGUE[1]

  it('returns false when stage is already 2', () => {
    const state = makeCompanionState(secondCompanion.id, 2)
    expect(CompanionManager.canEvolve(state, 999, 999)).toBe(false)
  })

  it('returns false when not enough shards', () => {
    const state = makeCompanionState(secondCompanion.id, 0)
    const nextStage = secondCompanion.evolutionPath[1]
    expect(
      CompanionManager.canEvolve(state, nextStage.masteredFactsRequired + 100, 0),
    ).toBe(false)
  })

  it('returns false when not enough mastered facts', () => {
    const state = makeCompanionState(secondCompanion.id, 0)
    const nextStage = secondCompanion.evolutionPath[1]
    expect(
      CompanionManager.canEvolve(state, 0, nextStage.shardsRequired + 100),
    ).toBe(false)
  })

  it('returns true when requirements met', () => {
    const state = makeCompanionState(secondCompanion.id, 0)
    const nextStage = secondCompanion.evolutionPath[1]
    expect(
      CompanionManager.canEvolve(
        state,
        nextStage.masteredFactsRequired,
        nextStage.shardsRequired,
      ),
    ).toBe(true)
  })
})

describe('CompanionManager.evolve (static)', () => {
  const thirdCompanion = COMPANION_CATALOGUE[2]

  it('increments stage', () => {
    const state = makeCompanionState(thirdCompanion.id, 0)
    const result = CompanionManager.evolve(state)
    expect(result.newStage).toBe(1)
    expect(state.currentStage).toBe(1)
  })

  it('throws when already at stage 2', () => {
    const state = makeCompanionState(thirdCompanion.id, 2)
    expect(() => CompanionManager.evolve(state)).toThrow()
  })
})
