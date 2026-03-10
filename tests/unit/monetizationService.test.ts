import { describe, expect, it } from 'vitest'
import type { PlayerSave } from '../../src/data/types'
import { applyPurchasedProductToSave } from '../../src/services/monetizationService'

function makeSave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return {
    purchasedProducts: [],
    ownedCosmetics: [],
    adsRemoved: false,
    ...overrides,
  } as unknown as PlayerSave
}

describe('monetizationService', () => {
  it('grants ad removal and keeps purchased product IDs unique', () => {
    let save = makeSave()
    save = applyPurchasedProductToSave(save, 'com.terragacha.adfree')
    save = applyPurchasedProductToSave(save, 'com.terragacha.adfree')

    expect(save.adsRemoved).toBe(true)
    expect(save.purchasedProducts).toEqual(['com.terragacha.adfree'])
  })

  it('grants season pass premium track', () => {
    const save = applyPurchasedProductToSave(makeSave(), 'com.terragacha.seasonpass.current')

    expect(save.seasonPassProgress?.hasPremium).toBe(true)
    expect(save.seasonPassProgress?.seasonId).toBe('season_1_deep_time')
  })

  it('extends subscription from existing future expiry', () => {
    const now = Date.now()
    const inFiveDays = new Date(now + 5 * 86_400_000).toISOString()
    const save = makeSave({
      subscription: {
        type: 'terra_pass',
        source: 'web',
        expiresAt: inFiveDays,
      },
    })

    const updated = applyPurchasedProductToSave(save, 'com.terragacha.terrapass.monthly')
    const newExpiry = new Date(updated.subscription?.expiresAt ?? '').getTime()
    const deltaMs = newExpiry - new Date(inFiveDays).getTime()

    expect(updated.subscription?.type).toBe('terra_pass')
    expect(deltaMs).toBeGreaterThanOrEqual(29 * 86_400_000)
    expect(deltaMs).toBeLessThanOrEqual(31 * 86_400_000)
  })

  it('grants cosmetics once but allows repeat consumable charges', () => {
    let save = makeSave()
    save = applyPurchasedProductToSave(save, 'com.terragacha.cosmetic.cardback.crystal')
    save = applyPurchasedProductToSave(save, 'com.terragacha.cosmetic.cardback.crystal')
    expect(save.ownedCosmetics).toEqual(['com.terragacha.cosmetic.cardback.crystal'])

    save = applyPurchasedProductToSave(save, 'com.terragacha.radar.disc_boost_3')
    save = applyPurchasedProductToSave(save, 'com.terragacha.radar.disc_boost_3')
    expect(save.dataDiscRadarCharges).toBe(6)
  })
})
