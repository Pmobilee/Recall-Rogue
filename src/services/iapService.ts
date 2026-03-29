/**
 * In-App Purchase service (DD-V2-145).
 * Wraps Capacitor Purchases / RevenueCat SDK.
 * Gracefully degrades in browser/dev mode.
 */

import { ALL_PRODUCTS, type IAPProduct } from '../data/iapCatalog'

export interface PurchaseResult {
  success: boolean
  productId?: string
  error?: string
}

export interface Offering {
  id: string
  products: IAPProduct[]
}

let initialized = false

/**
 * Initialize the IAP service. In browser/dev mode, this is a no-op.
 */
export async function initialize(): Promise<void> {
  try {
    // RevenueCat / Capacitor Purchases would be configured here
    // In browser/dev mode, we just mark as initialized
    initialized = true
  } catch {
    console.warn('[IAP] Not available in this environment')
    initialized = true
  }
}

/**
 * Attempt to purchase a product. Returns graceful error in browser mode.
 *
 * @param productId - The platform product ID to purchase.
 * @returns A PurchaseResult indicating success or the reason for failure.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  if (!initialized) await initialize()

  // In browser/dev mode, IAP is not available
  if (typeof window !== 'undefined' && !('Capacitor' in window)) {
    return { success: false, error: 'iap_not_available' }
  }

  try {
    // Native Capacitor purchase flow would go here
    // RevenueCat SDK handles the native purchase sheet
    return { success: false, error: 'iap_not_available' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

/**
 * Restore previously purchased products (required by Apple).
 *
 * @returns An array of restored product IDs, or an empty array on failure.
 */
export async function restorePurchases(): Promise<string[]> {
  if (!initialized) await initialize()

  // In browser/dev mode, return empty
  if (typeof window !== 'undefined' && !('Capacitor' in window)) {
    return []
  }

  try {
    // RevenueCat restore flow would go here
    return []
  } catch {
    return []
  }
}

/**
 * Kid mode IAP guard (DD-V2-131 / Phase 45.3.4).
 * If the player is NOT in kid mode, calls onParentApproves immediately.
 * If the player IS in kid mode, shows a PIN gate via a custom DOM event.
 * Callers (RoguePassModal, PioneerPackModal) listen for the 'iap:approved' event.
 *
 * @param onParentApproves - Callback to invoke when the purchase is authorised.
 */
export function kidModeIapGuard(onParentApproves: () => void): void {
  // Import lazily to avoid circular deps
  import('../ui/stores/playerData').then(({ playerSave: ps }) => {
    import('svelte/store').then(({ get }) => {
      const save = get(ps)
      if (save?.ageRating !== 'kid') {
        onParentApproves()
      } else {
        // Dispatch a DOM event that App.svelte / the modal can listen to.
        // The modal must show ParentalPinGate; on success, call onParentApproves.
        document.dispatchEvent(new CustomEvent('iap:pin-required', {
          detail: { onApprove: onParentApproves },
        }))
      }
    })
  })
}

/**
 * Get current offerings from RevenueCat.
 * In browser/dev mode, returns the full catalog as a single default offering.
 *
 * @returns An array of Offering objects.
 */
export async function getOfferings(): Promise<Offering[]> {
  if (!initialized) await initialize()

  // In browser/dev mode, return catalog as a single offering
  return [{
    id: 'default',
    products: ALL_PRODUCTS,
  }]
}
