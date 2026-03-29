import type { PlayerSave } from '../data/types'
import { purchaseProduct } from './iapService'
import { playerSave, persistPlayer } from '../ui/stores/playerData'

export interface MonetizationPurchaseResult {
  success: boolean
  productId: string
  simulated: boolean
  error?: string
}

const SUBSCRIPTION_PRODUCTS: Record<string, { tier: string; durationDays: number }> = {
  'com.terragacha.terrapass.monthly': { tier: 'rogue_pass', durationDays: 30 },
  'com.terragacha.patron.season': { tier: 'expedition_patron', durationDays: 120 },
  'com.terragacha.patron.annual': { tier: 'grand_patron', durationDays: 365 },
}

const AD_FREE_PRODUCT_ID = 'com.terragacha.adfree'
const SEASON_PASS_PRODUCT_ID = 'com.terragacha.seasonpass.current'
const DATA_DISC_RADAR_PRODUCT_ID = 'com.terragacha.radar.disc_boost_3'

function withPurchasedProduct(save: PlayerSave, productId: string): PlayerSave {
  const purchased = save.purchasedProducts ?? []
  if (purchased.includes(productId)) return save
  return { ...save, purchasedProducts: [...purchased, productId] }
}

function grantSubscription(save: PlayerSave, productId: string): PlayerSave {
  const product = SUBSCRIPTION_PRODUCTS[productId]
  if (!product) return save
  const now = Date.now()
  const existingExpiry = save.subscription ? new Date(save.subscription.expiresAt).getTime() : now
  const base = Number.isFinite(existingExpiry) && existingExpiry > now ? existingExpiry : now
  const nextExpiry = new Date(base + product.durationDays * 86_400_000).toISOString()
  return {
    ...save,
    subscription: { type: product.tier, expiresAt: nextExpiry, source: 'web' },
  }
}

function grantSeasonPassPremium(save: PlayerSave): PlayerSave {
  const progress = save.seasonPassProgress ?? {
    seasonId: 'season_1_deep_time',
    points: 0,
    claimedFree: [],
    claimedPremium: [],
    hasPremium: false,
  }
  if (progress.hasPremium) return save
  return { ...save, seasonPassProgress: { ...progress, hasPremium: true } }
}

function grantCosmetic(save: PlayerSave, productId: string): PlayerSave {
  if (!productId.includes('.cosmetic.')) return save
  if (save.ownedCosmetics.includes(productId)) return save
  return { ...save, ownedCosmetics: [...save.ownedCosmetics, productId] }
}

function grantConsumable(save: PlayerSave, productId: string): PlayerSave {
  if (productId !== DATA_DISC_RADAR_PRODUCT_ID) return save
  const charges = save.dataDiscRadarCharges ?? 0
  return { ...save, dataDiscRadarCharges: charges + 3 }
}

export function applyPurchasedProductToSave(save: PlayerSave, productId: string): PlayerSave {
  let updated = withPurchasedProduct(save, productId)
  updated = grantSubscription(updated, productId)
  if (productId === AD_FREE_PRODUCT_ID) {
    updated = { ...updated, adsRemoved: true }
  }
  if (productId === SEASON_PASS_PRODUCT_ID) {
    updated = grantSeasonPassPremium(updated)
  }
  updated = grantCosmetic(updated, productId)
  updated = grantConsumable(updated, productId)
  return updated
}

export function applyPurchasedProduct(productId: string): void {
  playerSave.update((save) => {
    if (!save) return save
    return applyPurchasedProductToSave(save, productId)
  })
  persistPlayer()
}

/**
 * Attempts a native purchase. In web/dev fallback mode (`iap_not_available`)
 * we still grant the product locally so AR-21 flows are testable.
 */
export async function purchaseWithLocalFallback(productId: string): Promise<MonetizationPurchaseResult> {
  const result = await purchaseProduct(productId)
  if (result.success) {
    applyPurchasedProduct(productId)
    return { success: true, productId, simulated: false }
  }
  if (result.error === 'iap_not_available') {
    applyPurchasedProduct(productId)
    return { success: true, productId, simulated: true }
  }
  return {
    success: false,
    productId,
    simulated: false,
    error: result.error ?? 'purchase_failed',
  }
}

