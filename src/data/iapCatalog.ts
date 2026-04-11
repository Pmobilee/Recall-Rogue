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
export const SUBSCRIPTION_PRODUCTS: IAPProduct[] = []

/** One-time purchase products */
export const ONE_TIME_PRODUCTS: IAPProduct[] = []

/** Cosmetic IAP products */
export const COSMETIC_PRODUCTS: IAPProduct[] = []

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
