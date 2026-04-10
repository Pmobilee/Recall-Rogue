import { describe, expect, it } from 'vitest'
import {
  applyAscensionEnemyTemplateAdjustments,
  getAscensionModifiers,
  getAscensionRule,
} from '../../src/services/ascension'
import { ENEMY_TEMPLATES } from '../../src/data/enemies'

describe('ascension modifiers', () => {
  it('uses stepped enemyHpMultiplier and enemyDamageMultiplier', () => {
    // A0-A1: no multiplier
    expect(getAscensionModifiers(0).enemyHpMultiplier).toBe(1.00)
    expect(getAscensionModifiers(0).enemyDamageMultiplier).toBe(1.00)
    // A2: +15% damage step
    expect(getAscensionModifiers(2).enemyDamageMultiplier).toBe(1.15)
    expect(getAscensionModifiers(4).enemyDamageMultiplier).toBe(1.15)
    // A8: +20% damage step
    expect(getAscensionModifiers(8).enemyDamageMultiplier).toBe(1.20)
    // A9: +10% HP step
    expect(getAscensionModifiers(9).enemyHpMultiplier).toBe(1.10)
    // A15: +15% HP step, A17: +30% damage step
    expect(getAscensionModifiers(15).enemyHpMultiplier).toBe(1.15)
    expect(getAscensionModifiers(17).enemyDamageMultiplier).toBe(1.30)
    // shieldCardMultiplier is always 1.0 (removed — wasn't fun)
    expect(getAscensionModifiers(4).shieldCardMultiplier).toBe(1.0)
    expect(getAscensionModifiers(4).timerBasePenaltySeconds).toBe(1)
  })

  it('uses minimalist override at level 18+', () => {
    const level18 = getAscensionModifiers(18)
    expect(level18.starterDeckSizeOverride).toBe(10)
  })

  it('enables curator second phase only at level 20', () => {
    const curator = ENEMY_TEMPLATES.find((entry) => entry.id === 'final_lesson')
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

  it('perfectTurnBonusAp is always 0 (removed buff)', () => {
    expect(getAscensionModifiers(13).perfectTurnBonusAp).toBe(0)
    expect(getAscensionModifiers(14).perfectTurnBonusAp).toBe(0)
    expect(getAscensionModifiers(20).perfectTurnBonusAp).toBe(0)
  })

  it('firstTurnBonusAp is always 0 (removed buff)', () => {
    expect(getAscensionModifiers(2).firstTurnBonusAp).toBe(0)
    expect(getAscensionModifiers(20).firstTurnBonusAp).toBe(0)
  })

  it('bossDefeatFullHeal is always false (removed buff)', () => {
    expect(getAscensionModifiers(15).bossDefeatFullHeal).toBe(false)
    expect(getAscensionModifiers(20).bossDefeatFullHeal).toBe(false)
  })

  it('combo heal fields activate at level 6', () => {
    // Updated 2026-04-10: pass 7 changed combo heal from threshold=3/amount=5 to threshold=4/amount=3
    // "High-accuracy players hit 3-combos constantly; 4+ is rarer and 3 HP is less snowbally"
    expect(getAscensionModifiers(5).comboHealThreshold).toBe(0)
    expect(getAscensionModifiers(5).comboHealAmount).toBe(0)
    expect(getAscensionModifiers(6).comboHealThreshold).toBe(4)
    expect(getAscensionModifiers(6).comboHealAmount).toBe(3)
  })

  it('comboResetsOnTurnEnd activates at level 14', () => {
    expect(getAscensionModifiers(13).comboResetsOnTurnEnd).toBe(false)
    expect(getAscensionModifiers(14).comboResetsOnTurnEnd).toBe(true)
  })

  it('strengthened challenge values at key thresholds', () => {
    expect(getAscensionModifiers(9).enemyRegenPerTurn).toBe(3)
    expect(getAscensionModifiers(8).enemyRegenPerTurn).toBe(0)
    expect(getAscensionModifiers(13).playerMaxHpOverride).toBe(75)
    expect(getAscensionModifiers(15).bossHpMultiplier).toBe(1.50)
    expect(getAscensionModifiers(17).wrongAnswerSelfDamage).toBe(5)
  })

  it('reduced buff values (delayed to high ascension levels)', () => {
    // Updated 2026-04-10: chargeCorrectDamageBonus delayed from A7 to A12 (StS philosophy: buffs are high-level rewards)
    expect(getAscensionModifiers(12).chargeCorrectDamageBonus).toBe(0.10)
    expect(getAscensionModifiers(11).chargeCorrectDamageBonus).toBe(0)
    expect(getAscensionModifiers(11).relicTriggerBonus).toBe(0.15)
    expect(getAscensionModifiers(10).relicTriggerBonus).toBe(0)
  })
})
