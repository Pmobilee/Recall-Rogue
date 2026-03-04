/** Drop rate tiers with displayed probabilities (DD-V2-174) */
export interface DropRateTier {
  rarity: string
  displayRate: string    // Shown to player
  actualRate: number     // Internal probability (0-1)
  pityThreshold: number  // Guaranteed after N pulls without this rarity
}

/** Artifact drop rate table — rates MUST be displayed to players (DD-V2-174) */
export const DROP_RATES: DropRateTier[] = [
  { rarity: 'common', displayRate: '45%', actualRate: 0.45, pityThreshold: 0 },
  { rarity: 'uncommon', displayRate: '30%', actualRate: 0.30, pityThreshold: 0 },
  { rarity: 'rare', displayRate: '15%', actualRate: 0.15, pityThreshold: 20 },
  { rarity: 'epic', displayRate: '7%', actualRate: 0.07, pityThreshold: 35 },
  { rarity: 'legendary', displayRate: '2.5%', actualRate: 0.025, pityThreshold: 50 },
  { rarity: 'mythic', displayRate: '0.5%', actualRate: 0.005, pityThreshold: 100 }
]

/**
 * Roll for an artifact drop with pity system.
 * DD-V2-174: Drop rates displayed, pity at configured thresholds.
 * No real-money-to-random: premium currency cannot buy gacha pulls.
 */
export function rollArtifactDrop(pullsSinceLastByRarity: Record<string, number>): string {
  // Check pity thresholds first (guaranteed drops)
  for (const tier of DROP_RATES) {
    if (tier.pityThreshold > 0) {
      const pullsSince = pullsSinceLastByRarity[tier.rarity] ?? 0
      if (pullsSince >= tier.pityThreshold) {
        return tier.rarity
      }
    }
  }

  // Standard weighted random roll
  const roll = Math.random()
  let cumulative = 0
  for (const tier of DROP_RATES) {
    cumulative += tier.actualRate
    if (roll < cumulative) {
      return tier.rarity
    }
  }

  return 'common'  // Fallback
}

/**
 * Get drop rates for display in UI.
 * DD-V2-174: Drop rates MUST be visible to players.
 */
export function getDisplayDropRates(): { rarity: string; rate: string }[] {
  return DROP_RATES.map(t => ({ rarity: t.rarity, rate: t.displayRate }))
}

/**
 * Validate that actual rates sum to ~1.0.
 * Called during build/test to ensure rate integrity.
 */
export function validateDropRates(): { valid: boolean; sum: number } {
  const sum = DROP_RATES.reduce((acc, t) => acc + t.actualRate, 0)
  return { valid: Math.abs(sum - 1.0) < 0.001, sum }
}

/**
 * Check if a purchase would create a real-money-to-random pathway.
 * DD-V2-174: This is explicitly prohibited.
 */
export function isProhibitedPurchase(itemType: string): boolean {
  const prohibited = ['gacha_pull', 'random_box', 'mystery_pack', 'loot_crate']
  return prohibited.includes(itemType)
}
