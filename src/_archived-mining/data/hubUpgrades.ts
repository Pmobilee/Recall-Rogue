import type { FloorUpgradeTier } from './hubLayout'
import type { PlayerSave } from './types'

/** Definition for a single upgrade tier of a hub floor. */
export interface FloorTierDefinition {
  tier: FloorUpgradeTier
  label: string
  description: string
  dustCost: number
  premiumCosts: Array<{ materialId: string; count: number }>
  minFactsMastered: number
  unlocksObjectIds: string[]
  bgFilter: string
}

/** Map of floor ID to its ordered tier definitions (tiers 1, 2, 3). */
export type FloorUpgradeMap = Record<string, FloorTierDefinition[]>

/**
 * All hub floor upgrade tier definitions keyed by floor ID.
 * Each array entry corresponds to tier (index + 1).
 */
export const FLOOR_UPGRADES: FloorUpgradeMap = {
  starter: [
    { tier: 1, label: 'Improved', description: 'Better lighting and reinforced walls.', dustCost: 1000, premiumCosts: [], minFactsMastered: 5, unlocksObjectIds: [], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Advanced', description: 'Holographic displays and crystal lighting.', dustCost: 3000, premiumCosts: [{ materialId: 'crystal_shard', count: 5 }], minFactsMastered: 20, unlocksObjectIds: [], bgFilter: 'brightness(1.2) saturate(1.2)' },
    { tier: 3, label: 'Premium', description: 'Luxury biome-glass panels and ambient GAIA lighting.', dustCost: 8000, premiumCosts: [{ materialId: 'essence_core', count: 3 }], minFactsMastered: 50, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.4) hue-rotate(5deg)' },
  ],
  farm: [
    { tier: 1, label: 'Expanded', description: 'Second hydroponic bay comes online.', dustCost: 1500, premiumCosts: [], minFactsMastered: 10, unlocksObjectIds: ['farm_plot_2'], bgFilter: 'brightness(1.1) saturate(1.1)' },
    { tier: 2, label: 'Automated', description: 'Auto-harvest system installed.', dustCost: 4000, premiumCosts: [{ materialId: 'crystal_shard', count: 8 }], minFactsMastered: 30, unlocksObjectIds: [], bgFilter: 'brightness(1.2) saturate(1.3)' },
    { tier: 3, label: 'Lush', description: 'Bioluminescent plant varieties and nutrient maximizers.', dustCost: 10000, premiumCosts: [{ materialId: 'essence_core', count: 5 }], minFactsMastered: 75, unlocksObjectIds: [], bgFilter: 'brightness(1.25) saturate(1.5)' },
  ],
  workshop: [
    { tier: 1, label: 'Functional', description: 'Extra crafting station installed.', dustCost: 1200, premiumCosts: [], minFactsMastered: 8, unlocksObjectIds: ['upgrade_anvil'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Industrial', description: 'Advanced smelting forge and blueprint library.', dustCost: 3500, premiumCosts: [{ materialId: 'crystal_shard', count: 6 }], minFactsMastered: 25, unlocksObjectIds: ['blueprint_board'], bgFilter: 'brightness(1.15) saturate(1.2)' },
    { tier: 3, label: 'Master', description: 'Legendary forge with automated material sorting.', dustCost: 9000, premiumCosts: [{ materialId: 'essence_core', count: 4 }], minFactsMastered: 60, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.3)' },
  ],
  zoo: [
    { tier: 1, label: 'Expanded', description: 'Additional habitat space for new companions.', dustCost: 1500, premiumCosts: [], minFactsMastered: 10, unlocksObjectIds: ['fossil_display'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Enriched', description: 'Feeding stations and enrichment systems.', dustCost: 4000, premiumCosts: [{ materialId: 'crystal_shard', count: 7 }], minFactsMastered: 30, unlocksObjectIds: ['feeding_station'], bgFilter: 'brightness(1.2) saturate(1.2)' },
    { tier: 3, label: 'Paradise', description: 'Biome-simulated habitats with ambient ecosystems.', dustCost: 10000, premiumCosts: [{ materialId: 'essence_core', count: 5 }], minFactsMastered: 70, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.5)' },
  ],
  museum: [
    { tier: 1, label: 'Curated', description: 'First display wing opened.', dustCost: 1200, premiumCosts: [], minFactsMastered: 12, unlocksObjectIds: ['display_case_b'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Renowned', description: 'Achievement wall and interactive exhibits.', dustCost: 3500, premiumCosts: [{ materialId: 'crystal_shard', count: 6 }], minFactsMastered: 35, unlocksObjectIds: ['achievement_wall'], bgFilter: 'brightness(1.2) saturate(1.2)' },
    { tier: 3, label: 'Grand', description: 'Full gallery with rotating collections.', dustCost: 9000, premiumCosts: [{ materialId: 'essence_core', count: 4 }], minFactsMastered: 60, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.4)' },
  ],
  market: [
    { tier: 1, label: 'Open', description: 'Cosmetics vendor sets up shop.', dustCost: 1000, premiumCosts: [], minFactsMastered: 8, unlocksObjectIds: ['cosmetics_vendor'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Bustling', description: 'Wallpaper kiosk and expanded inventory.', dustCost: 3000, premiumCosts: [{ materialId: 'crystal_shard', count: 5 }], minFactsMastered: 25, unlocksObjectIds: ['wallpaper_shop'], bgFilter: 'brightness(1.2) saturate(1.2)' },
    { tier: 3, label: 'Emporium', description: 'Premium showroom and exclusive items.', dustCost: 8000, premiumCosts: [{ materialId: 'essence_core', count: 3 }], minFactsMastered: 50, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.4)' },
  ],
  research: [
    { tier: 1, label: 'Active', description: 'Data disc reader comes online.', dustCost: 1500, premiumCosts: [], minFactsMastered: 15, unlocksObjectIds: ['data_disc_reader'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Advanced', description: 'Experiment bench for advanced analysis.', dustCost: 4500, premiumCosts: [{ materialId: 'crystal_shard', count: 8 }], minFactsMastered: 40, unlocksObjectIds: ['experiment_bench'], bgFilter: 'brightness(1.2) saturate(1.3)' },
    { tier: 3, label: 'Elite', description: 'Neural-link research interface.', dustCost: 12000, premiumCosts: [{ materialId: 'essence_core', count: 6 }], minFactsMastered: 80, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.5)' },
  ],
  archive: [
    { tier: 1, label: 'Indexed', description: 'Study alcove opens for focused learning.', dustCost: 1500, premiumCosts: [], minFactsMastered: 15, unlocksObjectIds: ['study_alcove'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Comprehensive', description: 'Full GAIA report terminal installed.', dustCost: 4500, premiumCosts: [{ materialId: 'crystal_shard', count: 8 }], minFactsMastered: 40, unlocksObjectIds: [], bgFilter: 'brightness(1.2) saturate(1.2)' },
    { tier: 3, label: 'Master', description: 'Ancient archive with holographic records.', dustCost: 12000, premiumCosts: [{ materialId: 'essence_core', count: 6 }], minFactsMastered: 80, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.4)' },
  ],
  observatory: [
    { tier: 1, label: 'Operational', description: 'Streak shrine activated.', dustCost: 2000, premiumCosts: [], minFactsMastered: 20, unlocksObjectIds: ['streak_shrine'], bgFilter: 'brightness(1.1)' },
    { tier: 2, label: 'Enhanced', description: 'Star map for tracking progress across biomes.', dustCost: 5000, premiumCosts: [{ materialId: 'crystal_shard', count: 10 }], minFactsMastered: 50, unlocksObjectIds: ['star_map'], bgFilter: 'brightness(1.2) saturate(1.3)' },
    { tier: 3, label: 'Cosmic', description: 'Full observatory dome with panoramic starfield.', dustCost: 15000, premiumCosts: [{ materialId: 'essence_core', count: 8 }], minFactsMastered: 100, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.5) hue-rotate(10deg)' },
  ],
}

/**
 * Returns the tier definition for a given floor and target tier.
 * Returns null if tier is 0 or the definition does not exist.
 *
 * @param floorId - The hub floor identifier.
 * @param targetTier - The desired upgrade tier (1–3).
 */
export function getUpgradeDef(floorId: string, targetTier: FloorUpgradeTier): FloorTierDefinition | null {
  if (targetTier === 0) return null
  return FLOOR_UPGRADES[floorId]?.[targetTier - 1] ?? null
}

/**
 * Checks whether a floor can be upgraded to the target tier given the current player save.
 *
 * @param floorId - The hub floor identifier.
 * @param targetTier - The desired upgrade tier.
 * @param save - Current player save state.
 * @returns Object with `allowed` boolean and optional `reason` string if blocked.
 */
export function canUpgrade(
  floorId: string,
  targetTier: FloorUpgradeTier,
  save: PlayerSave,
): { allowed: boolean; reason?: string } {
  const def = getUpgradeDef(floorId, targetTier)
  if (!def) return { allowed: false, reason: 'No upgrade defined' }

  const currentTier = save.hubState.floorTiers[floorId] ?? 0
  if (currentTier >= targetTier) return { allowed: false, reason: 'Already at this tier' }
  if (currentTier !== targetTier - 1) return { allowed: false, reason: 'Must upgrade in order' }

  const masteredCount = save.reviewStates.filter(rs => rs.repetitions >= 6).length
  if (masteredCount < def.minFactsMastered) {
    return { allowed: false, reason: `Need ${def.minFactsMastered} mastered facts (have ${masteredCount})` }
  }

  if (save.minerals.dust < def.dustCost) {
    return { allowed: false, reason: `Need ${def.dustCost} dust` }
  }

  for (const { materialId, count } of def.premiumCosts) {
    if ((save.premiumMaterials[materialId] ?? 0) < count) {
      return { allowed: false, reason: `Need ${count}x ${materialId}` }
    }
  }

  return { allowed: true }
}
