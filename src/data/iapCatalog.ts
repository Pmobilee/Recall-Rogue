/**
 * In-App Purchase product catalog (DD-V2-145).
 * No premium currency. All prices are direct USD amounts.
 * Knowledge is always free — these are cosmetic/convenience only.
 */

export type IAPTier = 'animated' | 'static' | 'pet' | 'gaia' | 'bundle' | 'consumable' | 'subscription' | 'one_time'

export interface IAPProduct {
  /** Platform product ID */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Price in USD */
  priceUSD: number
  /** Product tier */
  tier: IAPTier
  /** Whether this is a subscription (auto-renewing) */
  isSubscription: boolean
  /** Whether this is consumable (can be purchased multiple times) */
  isConsumable: boolean
}

/** All subscription products */
export const SUBSCRIPTION_PRODUCTS: IAPProduct[] = [
  {
    id: 'com.terragacha.terrapass.monthly',
    name: 'Terra Pass',
    description: 'Unlimited oxygen + monthly exclusive cosmetic',
    priceUSD: 4.99,
    tier: 'subscription',
    isSubscription: true,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.patron.season',
    name: 'Expedition Patron',
    description: 'Terra Pass + Season Pass + patron exclusives',
    priceUSD: 24.99,
    tier: 'subscription',
    isSubscription: true,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.patron.annual',
    name: 'Grand Patron',
    description: 'All seasons + physical sticker pack',
    priceUSD: 49.99,
    tier: 'subscription',
    isSubscription: true,
    isConsumable: false,
  },
]

/** One-time purchase products */
export const ONE_TIME_PRODUCTS: IAPProduct[] = [
  {
    id: 'com.terragacha.pioneerpack',
    name: 'Pioneer Pack',
    description: '500 dust, Rare+ artifact, Pioneer Pickaxe, 3 bonus tanks, Pioneer badge',
    priceUSD: 4.99,
    tier: 'one_time',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.seasonpass.current',
    name: 'Knowledge Expedition Season Pass',
    description: 'Premium track for current season',
    priceUSD: 4.99,
    tier: 'one_time',
    isSubscription: false,
    isConsumable: false,
  },
]

/** Cosmetic IAP products */
export const COSMETIC_PRODUCTS: IAPProduct[] = [
  {
    id: 'com.terragacha.cosmetic.animated.pickaxe_aurora',
    name: 'Aurora Pickaxe',
    description: 'Animated aurora trail pickaxe skin',
    priceUSD: 3.99,
    tier: 'animated',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.animated.dome_volcanic',
    name: 'Volcanic Dome Theme',
    description: 'Animated volcanic dome wallpaper',
    priceUSD: 4.99,
    tier: 'animated',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.static.helmet_explorer',
    name: 'Explorer Helmet',
    description: 'Classic explorer helmet skin',
    priceUSD: 0.99,
    tier: 'static',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.static.suit_cobalt',
    name: 'Cobalt Suit',
    description: 'Cobalt blue miner suit',
    priceUSD: 1.99,
    tier: 'static',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.pet.trilobite_gold',
    name: 'Golden Trilobite',
    description: 'Gold variant trilobite pet skin',
    priceUSD: 2.99,
    tier: 'pet',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.gaia.crystalline',
    name: 'Crystalline GAIA',
    description: 'Crystal-themed GAIA avatar skin',
    priceUSD: 1.99,
    tier: 'gaia',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.cosmetic.bundle.volcanic_trio',
    name: 'Volcanic Trio Bundle',
    description: '3 volcanic-themed cosmetics (20% off)',
    priceUSD: 7.99,
    tier: 'bundle',
    isSubscription: false,
    isConsumable: false,
  },
  {
    id: 'com.terragacha.radar.disc_boost_3',
    name: 'Data Disc Radar',
    description: '3× Data Disc drop rate for 3 dives',
    priceUSD: 0.99,
    tier: 'consumable',
    isSubscription: false,
    isConsumable: true,
  },
]

/** Full catalog */
export const ALL_PRODUCTS: IAPProduct[] = [
  ...SUBSCRIPTION_PRODUCTS,
  ...ONE_TIME_PRODUCTS,
  ...COSMETIC_PRODUCTS,
]

/**
 * Look up a product by ID.
 *
 * @param productId - The platform product ID to search for.
 * @returns The matching IAPProduct, or undefined if not found.
 */
export function getProduct(productId: string): IAPProduct | undefined {
  return ALL_PRODUCTS.find(p => p.id === productId)
}

/**
 * Apply a purchased cosmetic to the save's purchased products list.
 * Returns the existing array unchanged if the product is already present.
 *
 * @param productId - The product ID to add.
 * @param purchasedProducts - The current array of purchased product IDs.
 * @returns Updated array with the product ID included.
 */
export function applyPurchasedCosmetic(productId: string, purchasedProducts: string[]): string[] {
  if (purchasedProducts.includes(productId)) return purchasedProducts
  return [...purchasedProducts, productId]
}
