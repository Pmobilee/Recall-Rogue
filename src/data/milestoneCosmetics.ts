/**
 * Free milestone-unlocked cosmetics (DD-V2-148).
 * These are earned through gameplay, never purchased.
 */

export interface MilestoneCosmetic {
  id: string
  name: string
  description: string
  type: 'helmet' | 'pickaxe' | 'badge' | 'gaia_dialogue'
  /** Condition to check against PlayerSave/PlayerStats */
  condition: { stat: string; threshold: number }
}

export const MILESTONE_COSMETICS: MilestoneCosmetic[] = [
  {
    id: 'cosmetic_dust_collector',
    name: 'Dust Collector Helmet',
    description: 'A rugged helmet for seasoned miners',
    type: 'helmet',
    condition: { stat: 'totalDustEarned', threshold: 1000 },
  },
  {
    id: 'cosmetic_stone_breaker',
    name: 'Stone Breaker Pickaxe',
    description: 'Forged from the mountain itself',
    type: 'pickaxe',
    condition: { stat: 'totalBlocksMined', threshold: 100 },
  },
  {
    id: 'cosmetic_first_contact',
    name: 'First Contact Badge',
    description: 'Found your first artifact',
    type: 'badge',
    condition: { stat: 'totalArtifactsFound', threshold: 1 },
  },
  {
    id: 'cosmetic_scholar',
    name: 'Scholar GAIA Dialogue',
    description: 'GAIA speaks with scholarly wisdom',
    type: 'gaia_dialogue',
    condition: { stat: 'totalFactsLearned', threshold: 50 },
  },
]
