import { describe, expect, it } from 'vitest'
import {
  applyAscensionEnemyTemplateAdjustments,
  getAscensionModifiers,
  getAscensionRule,
} from '../../src/services/ascension'
import { ENEMY_TEMPLATES } from '../../src/data/enemies'

describe('ascension modifiers', () => {
  it('stacks early stat modifiers by level', () => {
    const level4 = getAscensionModifiers(4)
    // enemyHpMultiplier is always 1.0 (global HP mult removed — elites handle difficulty)
    expect(level4.enemyHpMultiplier).toBe(1.0)
    expect(level4.enemyDamageMultiplier).toBe(1.1)
    // shieldCardMultiplier is always 1.0 (removed — wasn't fun)
    expect(level4.shieldCardMultiplier).toBe(1.0)
    expect(level4.timerBasePenaltySeconds).toBe(1)
  })

  it('uses minimalist override at level 18+', () => {
    const level18 = getAscensionModifiers(18)
    expect(level18.starterDeckSizeOverride).toBe(10)
  })

  it('enables curator second phase only at level 20', () => {
    const curator = ENEMY_TEMPLATES.find((entry) => entry.id === 'the_curator')
    expect(curator).toBeTruthy()
    if (!curator) return

    const noAsc = applyAscensionEnemyTemplateAdjustments(curator, 24, getAscensionModifiers(0))
    const asc20 = applyAscensionEnemyTemplateAdjustments(curator, 24, getAscensionModifiers(20))

    expect(noAsc.phase2IntentPool).toBeUndefined()
    expect(noAsc.phaseTransitionAt).toBeUndefined()
    expect(Array.isArray(asc20.phase2IntentPool)).toBe(true)
    expect(asc20.phaseTransitionAt).toBeGreaterThan(0)
  })

  it('boosts mini-boss attacks from level 8 onward', () => {
    const miniBoss = ENEMY_TEMPLATES.find((entry) => entry.category === 'mini_boss')
    expect(miniBoss).toBeTruthy()
    if (!miniBoss) return

    const baseAttack = miniBoss.intentPool.find((intent) => intent.type === 'attack' || intent.type === 'multi_attack')
    expect(baseAttack).toBeTruthy()
    if (!baseAttack) return

    const adjusted = applyAscensionEnemyTemplateAdjustments(miniBoss, 7, getAscensionModifiers(8))
    const adjustedAttack = adjusted.intentPool.find((intent) => intent.type === 'attack' || intent.type === 'multi_attack')
    expect(adjustedAttack).toBeTruthy()
    if (!adjustedAttack) return

    expect(adjustedAttack.value).toBeGreaterThanOrEqual(baseAttack.value)
  })

  it('returns level metadata', () => {
    const rule = getAscensionRule(9)
    expect(rule?.name).toContain('Undying Foes')
  })

  it('maps reordered ascension levels 9-14 correctly', () => {
    expect(getAscensionRule(9)?.name).toBe('Undying Foes')
    expect(getAscensionRule(10)?.name).toBe('Cursed Start')
    expect(getAscensionRule(11)?.name).toBe('Slim Pickings')
    expect(getAscensionRule(12)?.name).toBe('Deep Knowledge')
    expect(getAscensionRule(13)?.name).toBe('Fragile')
    expect(getAscensionRule(14)?.name).toBe('Combo Breaker')
  })

  it('perfectTurnBonusAp activates at level 14', () => {
    expect(getAscensionModifiers(13).perfectTurnBonusAp).toBe(0)
    expect(getAscensionModifiers(14).perfectTurnBonusAp).toBe(1)
  })
})
