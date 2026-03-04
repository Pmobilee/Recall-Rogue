/**
 * Season Pass system (DD-V2-149).
 * "Knowledge Expedition" seasons with free and premium tracks.
 * No FOMO: earned rewards never expire. Progress tied to learning.
 */

export interface SeasonReward {
  milestone: number
  points: number
  name: string
  description: string
  type: 'dust' | 'consumable' | 'artifact' | 'fossil' | 'cosmetic' | 'knowledge' | 'title'
}

export interface SeasonDefinition {
  id: string
  name: string
  theme: string
  startDate: string
  endDate: string | null // null = no expiry
  freeTrack: SeasonReward[]
  premiumTrack: SeasonReward[]
}

export interface SeasonPassProgress {
  seasonId: string
  points: number
  claimedFree: number[]
  claimedPremium: number[]
  hasPremium: boolean
}

/** Points earned per activity */
export const SEASON_POINTS = {
  FACT_LEARNED: 1,
  FOSSIL_FOUND: 5,
  DIVE_COMPLETED: 2,
} as const

/** Season 1: Deep Time */
export const SEASON_1: SeasonDefinition = {
  id: 'season_1_deep_time',
  name: 'Knowledge Expedition: Deep Time',
  theme: 'deep_time',
  startDate: '2026-04-01',
  endDate: null, // Never expires

  freeTrack: [
    { milestone: 1, points: 50, name: '200 Dust + 1 Bomb', description: 'Starting supplies for your expedition', type: 'dust' },
    { milestone: 2, points: 150, name: 'Uncommon Artifact + 1 Shard', description: 'A relic from the deep past', type: 'artifact' },
    { milestone: 3, points: 300, name: 'Trilobite Fossil Fragment', description: 'Guaranteed trilobite fossil', type: 'fossil' },
    { milestone: 4, points: 500, name: '5 Consumables + Streak Freeze', description: 'Tools for the journey ahead', type: 'consumable' },
    { milestone: 5, points: 750, name: 'Random Data Disc', description: 'Knowledge from the archives', type: 'knowledge' },
    { milestone: 6, points: 1000, name: '1 Crystal + KP Voucher (200)', description: 'Premium resources', type: 'knowledge' },
    { milestone: 7, points: 1500, name: 'Rare+ Artifact Guarantee', description: 'A significant discovery', type: 'artifact' },
    { milestone: 8, points: 2000, name: 'Fossil Egg (Cosmetic Companion)', description: 'Hatch a companion from the deep past', type: 'fossil' },
  ],

  premiumTrack: [
    { milestone: 1, points: 50, name: 'Trilobite Rider Pickaxe Trail', description: 'Animated pickaxe trail effect', type: 'cosmetic' },
    { milestone: 2, points: 150, name: 'Dome Wallpaper: Cambrian Seabed', description: 'Aquatic dome theme', type: 'cosmetic' },
    { milestone: 3, points: 300, name: 'Fossil Hunter Helmet', description: 'Paleontologist headgear', type: 'cosmetic' },
    { milestone: 4, points: 500, name: 'GAIA Outfit: Paleontologist Coat', description: 'GAIA wears a lab coat', type: 'cosmetic' },
    { milestone: 5, points: 750, name: 'Ammonite Shell Cat Variant', description: 'Pet skin: spiral shell pattern', type: 'cosmetic' },
    { milestone: 6, points: 1000, name: 'Giant Ammonite Decoration', description: 'Dome decoration', type: 'cosmetic' },
    { milestone: 7, points: 1500, name: 'Trilobite Armor Set', description: 'Full suit themed after ancient arthropods', type: 'cosmetic' },
    { milestone: 8, points: 2000, name: 'Deep Time Pioneer Title + Badge', description: 'Exclusive animated title badge', type: 'title' },
  ],
}

/** Get current active season */
export function getCurrentSeason(): SeasonDefinition {
  return SEASON_1
}

/** Compute season progress from player stats */
export function computeSeasonPoints(factsLearned: number, fossilsFound: number, divesCompleted: number): number {
  return (
    factsLearned * SEASON_POINTS.FACT_LEARNED +
    fossilsFound * SEASON_POINTS.FOSSIL_FOUND +
    divesCompleted * SEASON_POINTS.DIVE_COMPLETED
  )
}

/** Get claimable milestone index (0-based) for a given points total on a track */
export function getClaimableMilestones(points: number, track: SeasonReward[], claimed: number[]): number[] {
  return track
    .filter((r, i) => points >= r.points && !claimed.includes(i))
    .map((_, i) => i)
}
