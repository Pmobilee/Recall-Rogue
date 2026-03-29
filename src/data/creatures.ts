import type { Creature } from '../game/entities/Creature'

/**
 * 12 creature templates — 3 per depth tier.
 * Each template omits `hp` and `state` (set by createCreature() at spawn time).
 * Biome affinity IDs match BiomeId values from biomes.ts. (DD-V2-026)
 */
export const CREATURE_TEMPLATES: Omit<Creature, 'hp' | 'state'>[] = [

  // ─── Tier 1: Shallow Biomes (L1–5) ────────────────────────────────────────
  {
    id: 'creature_glow_sprite',
    name: 'Glow Sprite',
    species: 'sprite',
    rarity: 'common',
    behavior: 'passive',
    maxHp: 30, attack: 5, defense: 2, speed: 6,
    biomeAffinity: ['limestone_caves', 'clay_basin', 'root_tangle'],
    depthRange: [1, 5],
    factCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'greyMatter', amount: 8 }],
    spriteKey: 'creature_sprite',
    tintColor: 0x88ffcc,
  },
  {
    id: 'creature_stone_crab',
    name: 'Stone Crab',
    species: 'crab',
    rarity: 'common',
    behavior: 'territorial',
    maxHp: 50, attack: 8, defense: 8, speed: 3,
    biomeAffinity: ['iron_seam', 'basalt_maze', 'salt_flats'],
    depthRange: [1, 5],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'greyMatter', amount: 12 }, { mineralTier: 'greyMatter', amount: 25 }],
    spriteKey: 'creature_crab',
    ability: {
      name: 'Shell Lock',
      description: 'Reduces incoming damage by 60% for 1 turn',
      cooldown: 3, effect: 'shield', magnitude: 0.4
    },
  },
  {
    id: 'creature_dust_mite',
    name: 'Dust Mite',
    species: 'mite',
    rarity: 'uncommon',
    behavior: 'aggressive',
    maxHp: 25, attack: 10, defense: 1, speed: 9,
    biomeAffinity: ['peat_bog', 'coal_veins'],
    depthRange: [2, 5],
    factCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'greyMatter', amount: 20 }],
    spriteKey: 'creature_mite',
  },

  // ─── Tier 2: Mid Biomes (L6–10) ───────────────────────────────────────────
  {
    id: 'creature_lava_salamander',
    name: 'Lava Salamander',
    species: 'salamander',
    rarity: 'uncommon',
    behavior: 'territorial',
    maxHp: 80, attack: 14, defense: 6, speed: 5,
    biomeAffinity: ['sulfur_springs', 'granite_canyon', 'obsidian_rift'],
    depthRange: [6, 10],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'greyMatter', amount: 75 }, { mineralTier: 'greyMatter', amount: 100 }],
    spriteKey: 'creature_salamander',
    tintColor: 0xff4400,
    ability: {
      name: 'Acid Spit',
      description: 'Burns through O2 — costs 8 extra O2 if answer is wrong',
      cooldown: 2, effect: 'weaken', magnitude: 1.3
    },
  },
  {
    id: 'creature_crystal_shard',
    name: 'Crystal Shard',
    species: 'golem',
    rarity: 'rare',
    behavior: 'guardian',
    maxHp: 100, attack: 18, defense: 12, speed: 2,
    biomeAffinity: ['quartz_halls', 'crystal_geode'],
    depthRange: [6, 10],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'greyMatter', amount: 200 }, { mineralTier: 'greyMatter', amount: 125 }],
    spriteKey: 'creature_golem_minor',
    ability: {
      name: 'Crystal Armor',
      description: 'Blocks all damage for 1 turn',
      cooldown: 4, effect: 'shield', magnitude: 1.0
    },
  },
  {
    id: 'creature_shadow_eel',
    name: 'Shadow Eel',
    species: 'eel',
    rarity: 'uncommon',
    behavior: 'aggressive',
    maxHp: 60, attack: 20, defense: 3, speed: 8,
    biomeAffinity: ['coal_veins', 'basalt_maze', 'magma_shelf'],
    depthRange: [6, 10],
    factCategory: 'History',
    loot: [{ mineralTier: 'greyMatter', amount: 100 }],
    spriteKey: 'creature_eel',
    tintColor: 0x220055,
  },

  // ─── Tier 3: Deep Biomes (L11–15) ─────────────────────────────────────────
  {
    id: 'creature_void_crawler',
    name: 'Void Crawler',
    species: 'crawler',
    rarity: 'rare',
    behavior: 'aggressive',
    maxHp: 130, attack: 25, defense: 8, speed: 7,
    biomeAffinity: ['tectonic_scar', 'iron_core_fringe', 'pressure_dome'],
    depthRange: [11, 15],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'greyMatter', amount: 300 }, { mineralTier: 'greyMatter', amount: 500 }],
    spriteKey: 'creature_crawler',
    ability: {
      name: 'Phase Shift',
      description: 'Evades next attack — your quiz does 0 damage this turn',
      cooldown: 3, effect: 'shield', magnitude: 0
    },
  },
  {
    id: 'creature_magma_golem',
    name: 'Magma Golem',
    species: 'golem',
    rarity: 'rare',
    behavior: 'guardian',
    maxHp: 180, attack: 22, defense: 18, speed: 2,
    biomeAffinity: ['magma_shelf', 'obsidian_rift', 'tectonic_scar'],
    depthRange: [11, 15],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'greyMatter', amount: 1000 }, { mineralTier: 'greyMatter', amount: 2000 }],
    spriteKey: 'creature_golem_magma',
    tintColor: 0xff3300,
  },
  {
    id: 'creature_ancient_worm',
    name: 'Ancient Worm',
    species: 'worm',
    rarity: 'epic',
    behavior: 'territorial',
    maxHp: 150, attack: 28, defense: 10, speed: 4,
    biomeAffinity: ['fossil_layer', 'primordial_mantle'],
    depthRange: [11, 15],
    factCategory: 'Life Sciences',
    loot: [{ mineralTier: 'greyMatter', amount: 1500 }],
    spriteKey: 'creature_worm',
    ability: {
      name: 'Tunnel Collapse',
      description: 'Reveals 5 random blocks around player',
      cooldown: 5, effect: 'weaken', magnitude: 1
    },
  },

  // ─── Tier 4: Extreme Biomes (L16–20) ──────────────────────────────────────
  {
    id: 'creature_echo_wraith',
    name: 'Echo Wraith',
    species: 'wraith',
    rarity: 'epic',
    behavior: 'aggressive',
    maxHp: 200, attack: 35, defense: 5, speed: 9,
    biomeAffinity: ['echo_chamber', 'temporal_rift', 'void_pocket'],
    depthRange: [16, 20],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'greyMatter', amount: 4000 }],
    spriteKey: 'creature_wraith',
    tintColor: 0x8855ff,
    ability: {
      name: 'Memory Drain',
      description: 'Forces a 2-question gauntlet to continue',
      cooldown: 3, effect: 'weaken', magnitude: 2
    },
  },
  {
    id: 'creature_void_horror',
    name: 'Void Horror',
    species: 'horror',
    rarity: 'legendary',
    behavior: 'aggressive',
    maxHp: 280, attack: 40, defense: 15, speed: 6,
    biomeAffinity: ['void_pocket', 'alien_intrusion', 'bioluminescent'],
    depthRange: [16, 20],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'greyMatter', amount: 8000 }],
    spriteKey: 'creature_horror',
  },
  {
    id: 'creature_deep_spectre',
    name: 'Deep Spectre',
    species: 'spectre',
    rarity: 'epic',
    behavior: 'territorial',
    maxHp: 240, attack: 32, defense: 12, speed: 5,
    biomeAffinity: ['deep_biolume', 'pressure_dome', 'iron_core_fringe'],
    depthRange: [16, 20],
    factCategory: 'Life Sciences',
    loot: [{ mineralTier: 'greyMatter', amount: 2000 }, { mineralTier: 'greyMatter', amount: 2000 }],
    spriteKey: 'creature_spectre',
    tintColor: 0x00ffbb,
    ability: {
      name: 'Spectral Drain',
      description: 'Halves player HP for 2 turns unless answered correctly',
      cooldown: 4, effect: 'weaken', magnitude: 0.5
    },
  },
]

/** Get creatures valid for a given depth and biome */
export function getCreaturesForDepth(depth: number, biomeId?: string): Omit<Creature, 'hp' | 'state'>[] {
  return CREATURE_TEMPLATES.filter(c => {
    if (depth < c.depthRange[0] || depth > c.depthRange[1]) return false
    if (biomeId && c.biomeAffinity.length > 0 && !c.biomeAffinity.includes(biomeId)) return false
    return true
  })
}
