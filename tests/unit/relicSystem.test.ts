import { describe, expect, it, beforeEach } from 'vitest'
import { getMaxRelicSlots, isRelicSlotsFull, resolveWrongAnswerEffects } from '../../src/services/relicEffectResolver'
import type { RunRelic } from '../../src/data/relics/types'
import { MAX_RELIC_SLOTS, RELIC_SELL_REFUND_PCT, RELIC_REROLL_COST, RELIC_REROLL_MAX } from '../../src/data/balance'
import { FULL_RELIC_CATALOGUE, RELIC_BY_ID } from '../../src/data/relics/index'

/** Helper to build a minimal RunRelic array. */
function makeRunRelics(definitionIds: string[]): RunRelic[] {
  return definitionIds.map((id, i) => ({
    definitionId: id,
    acquiredAtFloor: 1,
    acquiredAtEncounter: i + 1,
    triggerCount: 0,
  }))
}

describe('Five-Slot Relic System — slot helpers', () => {
  it('getMaxRelicSlots returns 5 without Scholar\'s Gambit', () => {
    const relics = makeRunRelics(['whetstone', 'iron_buckler'])
    expect(getMaxRelicSlots(relics)).toBe(5)
  })

  it('getMaxRelicSlots returns 6 with Scholar\'s Gambit equipped', () => {
    const relics = makeRunRelics(['whetstone', 'scholars_gambit'])
    expect(getMaxRelicSlots(relics)).toBe(7)
  })

  it('isRelicSlotsFull returns false when under cap', () => {
    const relics = makeRunRelics(['whetstone', 'iron_buckler'])
    expect(isRelicSlotsFull(relics)).toBe(false)
  })

  it('isRelicSlotsFull returns false with exactly 4 relics', () => {
    const relics = makeRunRelics(['whetstone', 'iron_buckler', 'herbal_pouch', 'lucky_coin'])
    expect(isRelicSlotsFull(relics)).toBe(false)
  })

  it('isRelicSlotsFull returns true at exactly 5 relics (no Scholar\'s Gambit)', () => {
    const relics = makeRunRelics(['whetstone', 'iron_buckler', 'herbal_pouch', 'lucky_coin', 'vitality_ring'])
    expect(isRelicSlotsFull(relics)).toBe(true)
  })

  it('isRelicSlotsFull returns false at 5 relics when Scholar\'s Gambit is one of them', () => {
    const relics = makeRunRelics(['whetstone', 'iron_buckler', 'herbal_pouch', 'lucky_coin', 'scholars_gambit'])
    expect(isRelicSlotsFull(relics)).toBe(false)
  })

  it('isRelicSlotsFull returns true at 6 relics with Scholar\'s Gambit', () => {
    const relics = makeRunRelics([
      'whetstone',
      'iron_buckler',
      'herbal_pouch',
      'lucky_coin',
      'vitality_ring',
      'scholars_gambit',
    ])
    expect(isRelicSlotsFull(relics)).toBe(false)
  })

  it("isRelicSlotsFull returns true at 7 relics (all slots used) with Scholar's Gambit", () => {
    const relics = makeRunRelics([
      'whetstone',
      'iron_buckler',
      'herbal_pouch',
      'lucky_coin',
      'vitality_ring',
      'scholars_gambit',
      'chain_reactor',
    ])
    expect(isRelicSlotsFull(relics)).toBe(true)
  })

  it('MAX_RELIC_SLOTS constant is 5', () => {
    expect(MAX_RELIC_SLOTS).toBe(5)
  })
})

describe('Five-Slot Relic System — sell refund math', () => {
  it('RELIC_SELL_REFUND_PCT is 0.40', () => {
    expect(RELIC_SELL_REFUND_PCT).toBe(0.40)
  })

  it('Common relic (60g) refunds 24g', () => {
    const basePrice = 60 // Common shop price
    expect(Math.floor(basePrice * RELIC_SELL_REFUND_PCT)).toBe(24)
  })

  it('Uncommon relic (100g) refunds 40g', () => {
    const basePrice = 100
    expect(Math.floor(basePrice * RELIC_SELL_REFUND_PCT)).toBe(40)
  })

  it('Rare relic (160g) refunds 64g', () => {
    const basePrice = 160
    expect(Math.floor(basePrice * RELIC_SELL_REFUND_PCT)).toBe(64)
  })

  it('Legendary relic (250g) refunds 100g', () => {
    const basePrice = 250
    expect(Math.floor(basePrice * RELIC_SELL_REFUND_PCT)).toBe(100)
  })
})

describe('Five-Slot Relic System — reroll constants', () => {
  it('RELIC_REROLL_COST is 50g', () => {
    expect(RELIC_REROLL_COST).toBe(50)
  })

  it('RELIC_REROLL_MAX is 1 (once per selection)', () => {
    expect(RELIC_REROLL_MAX).toBe(1)
  })
})

describe("Scholar's Gambit relic", () => {
  it('is in FULL_RELIC_CATALOGUE', () => {
    const def = RELIC_BY_ID['scholars_gambit']
    expect(def).toBeDefined()
    expect(def.id).toBe('scholars_gambit')
  })

  it('is rarity rare', () => {
    expect(RELIC_BY_ID['scholars_gambit'].rarity).toBe('rare')
  })

  it('is category cursed', () => {
    expect(RELIC_BY_ID['scholars_gambit'].category).toBe('cursed')
  })

  it('is not startsUnlocked', () => {
    expect(RELIC_BY_ID['scholars_gambit'].startsUnlocked).toBe(false)
  })

  it('has relic_slot_bonus effect', () => {
    const def = RELIC_BY_ID['scholars_gambit']
    const effect = def.effects.find(e => e.effectId === 'relic_slot_bonus')
    expect(effect).toBeDefined()
    expect(effect?.value).toBe(2)
  })

  it('has wrong_charge_self_damage effect with value 1', () => {
    const def = RELIC_BY_ID['scholars_gambit']
    const effect = def.effects.find(e => e.effectId === 'wrong_charge_self_damage')
    expect(effect).toBeDefined()
    expect(effect?.value).toBe(1)
  })
})

describe("Scholar's Gambit — wrong answer self-damage effect resolver", () => {
  it('deals 1 self-damage on wrong Charged answer when scholars_gambit is held', () => {
    const relicIds = new Set(['scholars_gambit'])
    const result = resolveWrongAnswerEffects(relicIds, { wasChargedCard: true })
    expect(result.scholarGambitSelfDamage).toBe(1)
  })

  it('deals 0 self-damage on wrong non-Charged answer even with scholars_gambit held', () => {
    const relicIds = new Set(['scholars_gambit'])
    const result = resolveWrongAnswerEffects(relicIds, { wasChargedCard: false })
    expect(result.scholarGambitSelfDamage).toBe(0)
  })

  it('deals 0 self-damage when scholars_gambit is NOT held', () => {
    const relicIds = new Set(['whetstone'])
    const result = resolveWrongAnswerEffects(relicIds, { wasChargedCard: true })
    expect(result.scholarGambitSelfDamage).toBe(0)
  })

  it('does not break base scholars_hat wrong-answer heal', () => {
    const relicIds = new Set(['scholars_hat'])
    const result = resolveWrongAnswerEffects(relicIds, { wasChargedCard: true })
    expect(result.healHp).toBe(1)
    expect(result.scholarGambitSelfDamage).toBe(0)
  })

  it('no context defaults to no self-damage', () => {
    const relicIds = new Set(['scholars_gambit'])
    const result = resolveWrongAnswerEffects(relicIds)
    expect(result.scholarGambitSelfDamage).toBe(0)
  })
})

describe('startsUnlocked flag on starter relics', () => {
  const STARTER_RELICS_IN_CATALOGUE = FULL_RELIC_CATALOGUE.filter(r => r.isStarter)

  it('all starter relics have startsUnlocked: true', () => {
    // AR-211: 23 original starters + 5 new Common + 12 new Uncommon = 40
    expect(STARTER_RELICS_IN_CATALOGUE.length).toBe(40)
    for (const r of STARTER_RELICS_IN_CATALOGUE) {
      expect(r.startsUnlocked).toBe(true)
    }
  })
})

describe('excludeFromPool flag', () => {
  it('most relics do NOT have excludeFromPool: true', () => {
    const excluded = FULL_RELIC_CATALOGUE.filter(r => r.excludeFromPool === true)
    // excludeFromPool is rare — expect fewer than 5 relics to have it
    expect(excluded.length).toBeLessThan(5)
  })
})
