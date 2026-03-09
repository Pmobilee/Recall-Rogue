import type { FarmSlot } from './types'

/** Resource production output definition for a farm slot */
export interface FarmProduction {
  mineralTier: 'dust' | 'shard' | 'crystal'
  amountPerHour: number
}

/**
 * Production rates keyed by fossil species ID.
 * Common species produce dust, uncommon produce shards, rare/legendary produce crystals.
 */
export const FARM_PRODUCTION: Record<string, FarmProduction> = {
  // Common: dust producers
  trilobite:    { mineralTier: 'dust',    amountPerHour: 8 },
  ammonite:     { mineralTier: 'dust',    amountPerHour: 10 },
  dodo:         { mineralTier: 'dust',    amountPerHour: 12 },
  // Uncommon: shard producers
  raptor:       { mineralTier: 'shard',   amountPerHour: 2 },
  mammoth:      { mineralTier: 'shard',   amountPerHour: 3 },
  sabertooth:   { mineralTier: 'shard',   amountPerHour: 2 },
  // Rare: crystal producers (slow)
  megalodon:    { mineralTier: 'crystal', amountPerHour: 0.5 },
  pteranodon:   { mineralTier: 'crystal', amountPerHour: 0.4 },
  archaeopteryx:{ mineralTier: 'crystal', amountPerHour: 0.3 },
  // Legendary: crystal at decent rate
  trex:         { mineralTier: 'crystal', amountPerHour: 1 },
  // ─── Crop Fossils (Phase 16.1) ────────────────────────────────
  // Common: high dust (crops have no companion-dive bonus to compensate)
  ancient_wheat:   { mineralTier: 'dust',    amountPerHour: 15 },
  lotus_fossil:    { mineralTier: 'dust',    amountPerHour: 12 },
  cave_mushroom:   { mineralTier: 'dust',    amountPerHour: 18 },
  // Uncommon: shards
  ancient_rice:    { mineralTier: 'shard',   amountPerHour: 2.5 },
  giant_fern:      { mineralTier: 'shard',   amountPerHour: 2 },
  amber_orchid:    { mineralTier: 'shard',   amountPerHour: 3 },
  // Rare: crystals
  ancient_corn:    { mineralTier: 'crystal', amountPerHour: 0.6 },
  petrified_vine:  { mineralTier: 'crystal', amountPerHour: 0.5 },
  star_moss:       { mineralTier: 'crystal', amountPerHour: 0.4 },
  // Legendary
  world_tree_seed: { mineralTier: 'crystal', amountPerHour: 1.2 },
}

/**
 * Costs for each farm expansion step. Index 0 = 3→4 slots, etc.
 * Keys are mineral tier names, values are the amount required.
 */
export const FARM_EXPANSION_COSTS: Partial<Record<'dust' | 'shard' | 'crystal', number>>[] = [
  { dust: 500, shard: 10 },               // 3 → 4 slots
  { dust: 1000, shard: 30, crystal: 5 },  // 4 → 5 slots
  { dust: 2000, shard: 50, crystal: 15 }, // 5 → 6 slots
]

/** Hard maximum number of farm slots. */
export const FARM_MAX_SLOTS = 6

/** Production caps out after this many hours (prevents infinite accumulation while away). */
export const FARM_MAX_ACCUMULATION_HOURS = 24

/**
 * Calculates the uncollected resources for a single farm slot.
 *
 * @param slot - The occupied farm slot to evaluate.
 * @returns An object with the mineral tier and integer amount ready to collect,
 *          or `null` if the species has no production config or nothing has accumulated.
 */
export function calculateProduction(slot: FarmSlot): { tier: 'dust' | 'shard' | 'crystal'; amount: number } | null {
  const prod = FARM_PRODUCTION[slot.speciesId]
  if (!prod) return null

  const now = Date.now()
  const hoursSinceCollect = Math.min(
    (now - slot.lastCollectedAt) / (1000 * 60 * 60),
    FARM_MAX_ACCUMULATION_HOURS,
  )
  const amount = Math.floor(prod.amountPerHour * hoursSinceCollect)
  if (amount <= 0) return null

  return { tier: prod.mineralTier, amount }
}

/**
 * Calculates the total pending production across all occupied slots.
 *
 * @param slots - Array of farm slots (null entries are skipped).
 * @returns A summary of how many resources of each tier are ready to collect.
 */
export function calculateTotalPending(
  slots: (FarmSlot | null)[],
): { dust: number; shard: number; crystal: number } {
  const totals = { dust: 0, shard: 0, crystal: 0 }
  for (const slot of slots) {
    if (!slot) continue
    const result = calculateProduction(slot)
    if (result) {
      totals[result.tier] += result.amount
    }
  }
  return totals
}

/**
 * Calculates the per-hour production rates across all occupied slots.
 *
 * @param slots - Array of farm slots (null entries are skipped).
 * @returns A summary of how many resources of each tier are produced per hour.
 */
export function calculateHourlyRates(
  slots: (FarmSlot | null)[],
): { dust: number; shard: number; crystal: number } {
  const rates = { dust: 0, shard: 0, crystal: 0 }
  for (const slot of slots) {
    if (!slot) continue
    const prod = FARM_PRODUCTION[slot.speciesId]
    if (prod) {
      rates[prod.mineralTier] += prod.amountPerHour
    }
  }
  return rates
}

/** Full growth cycle duration in hours, keyed by crop species ID. */
export const CROP_CYCLE_HOURS: Record<string, number> = {
  ancient_wheat:   4,
  lotus_fossil:    4,
  cave_mushroom:   4,
  ancient_rice:    8,
  giant_fern:      8,
  amber_orchid:    8,
  ancient_corn:    24,
  petrified_vine:  24,
  star_moss:       24,
  world_tree_seed: 48,
}

export type CropGrowthStage = 'seed' | 'sprout' | 'mature' | 'harvestable'

/**
 * Returns the current growth stage for a crop farm slot.
 * Growth is calculated from lastCollectedAt (resets on harvest).
 * Returns null for non-crop species.
 */
export function getCropGrowthStage(slot: FarmSlot, speciesId: string): CropGrowthStage | null {
  const cycleDuration = CROP_CYCLE_HOURS[speciesId]
  if (cycleDuration === undefined) return null

  const now = Date.now()
  const hoursSinceHarvest = (now - slot.lastCollectedAt) / (1000 * 60 * 60)
  const cycleProgress = Math.min(hoursSinceHarvest / cycleDuration, 1)

  if (cycleProgress < 0.25) return 'seed'
  if (cycleProgress < 0.50) return 'sprout'
  if (cycleProgress < 0.75) return 'mature'
  return 'harvestable'
}

/**
 * Returns the growth percentage (0-100) within the current cycle.
 */
export function getCropGrowthPercent(slot: FarmSlot, speciesId: string): number {
  const cycleDuration = CROP_CYCLE_HOURS[speciesId]
  if (cycleDuration === undefined) return 0
  const now = Date.now()
  const hoursSinceHarvest = (now - slot.lastCollectedAt) / (1000 * 60 * 60)
  return Math.min((hoursSinceHarvest / cycleDuration) * 100, 100)
}
