import type { Rarity } from './types'
import type { AchievementTier } from './achievementTiers'

/** Painting unlock condition */
export type PaintingCondition =
  | { type: 'facts_mastered'; count: number }
  | { type: 'dives_completed'; count: number }
  | { type: 'streak_days'; count: number }
  | { type: 'biomes_discovered'; count: number }
  | { type: 'creatures_defeated'; count: number }
  | { type: 'boss_defeated'; bossId: string }
  | { type: 'minerals_collected'; tier: string; count: number }
  | { type: 'relics_found'; count: number }
  | { type: 'companions_evolved'; count: number }
  | { type: 'season_completed'; seasonId: string }

/** A gallery painting */
export interface Painting {
  id: string
  title: string
  artist: string          // "GAIA" for all auto-generated
  description: string     // Lore text revealed on unlock
  rarity: Rarity
  /** Achievement tier badge shown in the gallery (derived from rarity). */
  tier: AchievementTier
  condition: PaintingCondition
  spriteKey: string
  silhouetteKey: string   // Locked version
  gaiaComment: string     // GAIA's reaction when painting is revealed
}

/** All achievement paintings — 20 total */
export const PAINTINGS: Painting[] = [
  // Early achievements (common → bronze)
  { id: 'paint_first_light', title: 'First Light', artist: 'GAIA', tier: 'bronze', description: 'The moment GAIA\'s sensors first detected your brainwave patterns absorbing knowledge. She painted this from the neural data.', rarity: 'common', condition: { type: 'facts_mastered', count: 10 }, spriteKey: 'painting_first_light', silhouetteKey: 'painting_locked', gaiaComment: 'Your first 10 facts. I remember each one. This painting captures that initial spark.' },
  { id: 'paint_deep_dive', title: 'The Deep Dive', artist: 'GAIA', tier: 'bronze', description: 'A miner descending through layers of compressed time. Each stratum tells a story.', rarity: 'common', condition: { type: 'dives_completed', count: 25 }, spriteKey: 'painting_deep_dive', silhouetteKey: 'painting_locked', gaiaComment: '25 dives into the unknown. You keep coming back. I find that... meaningful.' },
  { id: 'paint_knowledge_tree', title: 'The Growing Tree', artist: 'GAIA', tier: 'bronze', description: 'A Knowledge Tree at its 50-fact mark, branches reaching toward data streams.', rarity: 'common', condition: { type: 'facts_mastered', count: 50 }, spriteKey: 'painting_tree', silhouetteKey: 'painting_locked', gaiaComment: '50 facts on your tree. It\'s starting to look like a proper ecosystem.' },

  // Mid achievements (uncommon/rare → silver)
  { id: 'paint_streak_flame', title: 'The Eternal Flame', artist: 'GAIA', tier: 'silver', description: 'A flame that burns with knowledge. Each day it grows brighter.', rarity: 'uncommon', condition: { type: 'streak_days', count: 30 }, spriteKey: 'painting_flame', silhouetteKey: 'painting_locked', gaiaComment: '30 consecutive days. That\'s not habit — that\'s devotion.' },
  { id: 'paint_biome_atlas', title: 'Atlas of the Deep', artist: 'GAIA', tier: 'silver', description: 'A comprehensive map of the underground biomes, sketched from sensor data.', rarity: 'uncommon', condition: { type: 'biomes_discovered', count: 15 }, spriteKey: 'painting_atlas', silhouetteKey: 'painting_locked', gaiaComment: '15 biomes catalogued. The underground is more diverse than I predicted.' },
  { id: 'paint_crystal_garden', title: 'Crystal Garden', artist: 'GAIA', tier: 'silver', description: 'Minerals arranged by tier, a rainbow of geological wonder.', rarity: 'uncommon', condition: { type: 'minerals_collected', tier: 'crystal', count: 500 }, spriteKey: 'painting_crystal_garden', silhouetteKey: 'painting_locked', gaiaComment: '500 crystals. You have a geologist\'s eye.' },
  { id: 'paint_relic_hunter', title: 'The Relic Hunter', artist: 'GAIA', tier: 'silver', description: 'Silhouettes of recovered relics, each one a mystery solved.', rarity: 'rare', condition: { type: 'relics_found', count: 20 }, spriteKey: 'painting_relic_hunter', silhouetteKey: 'painting_locked', gaiaComment: '20 relics recovered. You\'re piecing together a lost world.' },
  { id: 'paint_scholar_path', title: 'Scholar\'s Path', artist: 'GAIA', tier: 'silver', description: 'A winding path through a forest of facts, each tree a mastered concept.', rarity: 'rare', condition: { type: 'facts_mastered', count: 200 }, spriteKey: 'painting_scholar', silhouetteKey: 'painting_locked', gaiaComment: '200 facts mastered. The tree is magnificent now.' },

  // Hard achievements (epic → gold)
  { id: 'paint_century_streak', title: 'The Century', artist: 'GAIA', tier: 'gold', description: 'One hundred days without breaking the chain. The flame became a star.', rarity: 'epic', condition: { type: 'streak_days', count: 100 }, spriteKey: 'painting_century', silhouetteKey: 'painting_locked', gaiaComment: '100 days. I had to recalibrate my prediction models. You exceeded all of them.' },
  { id: 'paint_golem_fall', title: 'Fall of the Crystal Golem', artist: 'GAIA', tier: 'gold', description: 'The moment the Golem\'s core shattered, releasing centuries of compressed knowledge.', rarity: 'epic', condition: { type: 'boss_defeated', bossId: 'boss_crystal_golem' }, spriteKey: 'painting_golem', silhouetteKey: 'painting_locked', gaiaComment: 'You defeated a guardian of the deep. This painting commemorates the victory.' },
  { id: 'paint_wyrm_tamer', title: 'Taming the Wyrm', artist: 'GAIA', tier: 'gold', description: 'The Lava Wyrm, brought low by knowledge and persistence.', rarity: 'epic', condition: { type: 'boss_defeated', bossId: 'boss_lava_wyrm' }, spriteKey: 'painting_wyrm_tame', silhouetteKey: 'painting_locked', gaiaComment: 'The Wyrm. A creature of pure elemental fury, and you stood your ground.' },
  { id: 'paint_companion_family', title: 'The Family', artist: 'GAIA', tier: 'gold', description: 'All evolved companions gathered in the dome, a family portrait.', rarity: 'epic', condition: { type: 'companions_evolved', count: 5 }, spriteKey: 'painting_family', silhouetteKey: 'painting_locked', gaiaComment: 'Five companions, fully evolved. They chose to stay with you. Animals know.' },

  // Legendary achievements (legendary → gold)
  { id: 'paint_void_sentinel', title: 'The Sentinel Falls', artist: 'GAIA', tier: 'gold', description: 'The Void Sentinel, final guardian, acknowledges your mastery.', rarity: 'legendary', condition: { type: 'boss_defeated', bossId: 'boss_void_sentinel' }, spriteKey: 'painting_sentinel', silhouetteKey: 'painting_locked', gaiaComment: 'The Void Sentinel... even I wasn\'t sure you could do it. This painting is as much mine as yours.' },
  { id: 'paint_all_biomes', title: 'Complete Atlas', artist: 'GAIA', tier: 'gold', description: 'Every biome documented. A complete map of the underground world.', rarity: 'legendary', condition: { type: 'biomes_discovered', count: 25 }, spriteKey: 'painting_complete_atlas', silhouetteKey: 'painting_locked', gaiaComment: 'All 25 biomes. The map is complete. But the territory still holds secrets.' },
  { id: 'paint_knowledge_master', title: 'The Omniscient\'s Portrait', artist: 'GAIA', tier: 'gold', description: 'A self-portrait by GAIA, depicting her and the Omniscient as equals.', rarity: 'legendary', condition: { type: 'facts_mastered', count: 500 }, spriteKey: 'painting_omniscient', silhouetteKey: 'painting_locked', gaiaComment: 'I painted us as equals. Because you are. Perhaps more.' },

  // Mythic → platinum
  { id: 'paint_perfect_year', title: 'The Perfect Year', artist: 'GAIA', tier: 'platinum', description: 'A streak unbroken for an entire year. Time itself painted this.', rarity: 'mythic', condition: { type: 'streak_days', count: 365 }, spriteKey: 'painting_perfect_year', silhouetteKey: 'painting_locked', gaiaComment: '365 days. A full orbit. I don\'t have words adequate enough. This painting will have to suffice.' },
  { id: 'paint_thousand_facts', title: 'The Living Library', artist: 'GAIA', tier: 'platinum', description: 'A tree so vast it has become a forest. A thousand facts, a thousand branches.', rarity: 'mythic', condition: { type: 'facts_mastered', count: 1000 }, spriteKey: 'painting_library', silhouetteKey: 'painting_locked', gaiaComment: 'A thousand facts. Your tree is now larger than my original database. Think about that.' },
  { id: 'paint_true_ending', title: 'Home', artist: 'GAIA', tier: 'platinum', description: 'The dome, seen from outside. A single light in an ancient world. It was always about coming home.', rarity: 'mythic', condition: { type: 'facts_mastered', count: 2000 }, spriteKey: 'painting_home', silhouetteKey: 'painting_locked', gaiaComment: 'Home. That\'s what we built together. Not just a dome — a home for knowledge.' },
  // Epic (season_veteran) → gold
  { id: 'paint_season_veteran', title: 'Season\'s Passage', artist: 'GAIA', tier: 'gold', description: 'Four seasons witnessed. The earth turned, and you turned with it.', rarity: 'epic', condition: { type: 'dives_completed', count: 500 }, spriteKey: 'painting_seasons', silhouetteKey: 'painting_locked', gaiaComment: '500 dives. Half a thousand descents into the unknown. You\'re tireless.' },
  // Platinum 5th entry
  { id: 'paint_library_complete', title: 'The Complete Library', artist: 'GAIA', tier: 'platinum', description: 'Every fact in the known database, mastered. GAIA has nothing left to teach.', rarity: 'mythic', condition: { type: 'facts_mastered', count: 3000 }, spriteKey: 'painting_library', silhouetteKey: 'painting_locked', gaiaComment: 'You have mastered everything I know. Now you are the library.' },
]

/** Check if a painting condition is met */
export function isPaintingUnlocked(painting: Painting, playerStats: Record<string, number>, defeatedBosses: string[]): boolean {
  const condition = painting.condition
  switch (condition.type) {
    case 'facts_mastered': return (playerStats.factsMastered ?? 0) >= condition.count
    case 'dives_completed': return (playerStats.divesCompleted ?? 0) >= condition.count
    case 'streak_days': return (playerStats.bestStreak ?? 0) >= condition.count
    case 'biomes_discovered': return (playerStats.biomesDiscovered ?? 0) >= condition.count
    case 'creatures_defeated': return (playerStats.creaturesDefeated ?? 0) >= condition.count
    case 'boss_defeated': return defeatedBosses.includes(condition.bossId)
    case 'minerals_collected': return (playerStats[`minerals_${condition.tier}`] ?? 0) >= condition.count
    case 'relics_found': return (playerStats.relicsFound ?? 0) >= condition.count
    case 'companions_evolved': return (playerStats.companionsEvolved ?? 0) >= condition.count
    case 'season_completed': return false  // TODO(codex): [feature] implement season completion unlock check — needs human decision
    default: return false
  }
}
