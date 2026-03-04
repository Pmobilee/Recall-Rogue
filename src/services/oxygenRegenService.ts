/**
 * Oxygen tank regeneration system (DD-V2-138).
 * Free players regen 1 tank per 90 minutes, max 3 banked.
 * Subscribers have unlimited tanks.
 */

import { BALANCE } from '../data/balance'
import type { PlayerSave } from '../data/types'

/** Compute current available tanks based on elapsed time since last regen */
export function computeTanks(save: PlayerSave, isSubscriber: boolean): number {
  const now = Date.now()
  const elapsed = now - (save.lastRegenAt ?? now)
  const regenned = Math.floor(elapsed / BALANCE.OXYGEN_REGEN_MS)
  const maxBank = isSubscriber ? Infinity : BALANCE.OXYGEN_MAX_BANK_FREE
  return Math.min((save.tankBank ?? 0) + regenned, maxBank)
}

/** Deduct tanks for a dive. Throws if insufficient. */
export function drainTanks(save: PlayerSave, cost: number, isSubscriber: boolean): PlayerSave {
  const available = computeTanks(save, isSubscriber)
  if (available < cost) {
    throw new Error(`Insufficient oxygen tanks: need ${cost}, have ${available}`)
  }
  return {
    ...save,
    tankBank: available - cost,
    lastRegenAt: Date.now(),
  }
}

/** Credit fractional mastery bonus tanks from quiz gates passed during a dive */
export function creditMasteryTank(save: PlayerSave, gatesPassed: number, depth: number): PlayerSave {
  // DD-V2-026: +0.25 tank per gate (gates at 5, 10, 15, 20 correct)
  // Shallow gate bonus capped at 0.1 for layers 1-3
  const bonusPerGate = depth <= 3 ? 0.1 : 0.25
  const credit = (save.tankCredit ?? 0) + (gatesPassed * bonusPerGate)
  const wholeTanks = Math.floor(credit)
  return {
    ...save,
    tankBank: (save.tankBank ?? 0) + wholeTanks,
    tankCredit: credit - wholeTanks,
  }
}

/** Get dive cost in tanks based on depth range */
export function getDiveCost(maxLayer: number): number {
  if (maxLayer <= 5) return 1
  if (maxLayer <= 10) return 2
  return 3 // layers 11-20
}

/** Format time remaining until next tank regen */
export function formatRegenTime(save: PlayerSave, isSubscriber: boolean): string {
  if (isSubscriber) return 'Unlimited'
  const current = computeTanks(save, isSubscriber)
  if (current >= BALANCE.OXYGEN_MAX_BANK_FREE) return 'Ready'
  const now = Date.now()
  const elapsed = now - (save.lastRegenAt ?? now)
  const msIntoCurrentCycle = elapsed % BALANCE.OXYGEN_REGEN_MS
  const msRemaining = BALANCE.OXYGEN_REGEN_MS - msIntoCurrentCycle
  const hours = Math.floor(msRemaining / 3_600_000)
  const minutes = Math.ceil((msRemaining % 3_600_000) / 60_000)
  if (hours > 0) return `Next tank in ${hours}h ${minutes}m`
  return `Next tank in ${minutes}m`
}
