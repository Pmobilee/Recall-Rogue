/**
 * Subscription management service (DD-V2-145).
 * Wraps iapService for subscription-specific logic.
 * Terra Pass ($4.99/mo), Expedition Patron ($24.99/season), Grand Patron ($49.99/yr).
 */

import type { PlayerSave } from '../data/types'
import { purchaseProduct } from './iapService'

export interface SubscriptionRecord {
  type: string
  expiresAt: string
  source: 'apple' | 'google' | 'web'
}

/** Check if current save has an active subscription */
export function isSubscriber(save: PlayerSave): boolean {
  if (!save.subscription) return false
  return new Date(save.subscription.expiresAt) > new Date()
}

/** Get current subscription tier or null */
export function getSubscriptionTier(save: PlayerSave): string | null {
  if (!isSubscriber(save)) return null
  return save.subscription!.type
}

/** Check if user is a patron (expedition or grand) */
export function isPatron(save: PlayerSave): boolean {
  const tier = getSubscriptionTier(save)
  return tier === 'expedition_patron' || tier === 'grand_patron'
}

/** Attempt to subscribe to Terra Pass */
export async function subscribeTerraPass(): Promise<{ success: boolean; error?: string }> {
  return purchaseProduct('com.terragacha.terrapass.monthly')
}

/** Attempt to subscribe as Expedition Patron */
export async function subscribeExpeditionPatron(): Promise<{ success: boolean; error?: string }> {
  return purchaseProduct('com.terragacha.patron.season')
}

/** Attempt to subscribe as Grand Patron */
export async function subscribeGrandPatron(): Promise<{ success: boolean; error?: string }> {
  return purchaseProduct('com.terragacha.patron.annual')
}

/** Open platform subscription management (App Store / Play Store) */
export function openSubscriptionManagement(): void {
  // On native, this would open the platform's subscription management
  // In browser, open a help page
  if (typeof window !== 'undefined') {
    console.log('[Subscription] Opening subscription management')
  }
}

/** Check content volume gate — subscriptions require 3,000 approved facts */
export async function checkContentGate(): Promise<{ available: boolean; factsReady: number; required: number }> {
  try {
    const response = await fetch('/api/subscriptions/status')
    if (response.ok) {
      const data = await response.json()
      return data
    }
  } catch {
    // Offline or server unavailable
  }
  // Default: not available (content gate not met)
  return { available: false, factsReady: 522, required: 3000 }
}
