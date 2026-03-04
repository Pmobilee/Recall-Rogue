import type { Creature } from '../game/entities/Creature'

/** All creature templates (excluding bosses, which are in Boss.ts) */
export const CREATURE_TEMPLATES: Omit<Creature, 'hp' | 'state'>[] = [
  // Shallow tier (layers 1-5)
  { id: 'cave_bat', name: 'Cave Bat', species: 'bat', rarity: 'common', behavior: 'passive', maxHp: 20, attack: 5, defense: 2, speed: 8, biomeAffinity: ['limestone-cave', 'sandstone-corridor'], depthRange: [1, 5], loot: [{ mineralTier: 'dust', amount: 3 }], spriteKey: 'creature_bat' },
  { id: 'rock_spider', name: 'Rock Spider', species: 'spider', rarity: 'common', behavior: 'territorial', maxHp: 30, attack: 7, defense: 5, speed: 6, biomeAffinity: ['granite-shelf', 'clay-deposit'], depthRange: [2, 6], loot: [{ mineralTier: 'dust', amount: 5 }], spriteKey: 'creature_spider' },
  { id: 'crystal_mole', name: 'Crystal Mole', species: 'mole', rarity: 'uncommon', behavior: 'passive', maxHp: 40, attack: 8, defense: 8, speed: 4, biomeAffinity: ['crystalline-cavern', 'quartz-vein'], depthRange: [3, 7], factCategory: 'Geology', loot: [{ mineralTier: 'shard', amount: 3 }], spriteKey: 'creature_mole' },

  // Mid tier (layers 6-10)
  { id: 'lava_salamander', name: 'Lava Salamander', species: 'salamander', rarity: 'uncommon', behavior: 'territorial', maxHp: 60, attack: 12, defense: 6, speed: 5, biomeAffinity: ['magma-chamber', 'volcanic-vent'], depthRange: [6, 10], factCategory: 'Biology', loot: [{ mineralTier: 'shard', amount: 5 }], spriteKey: 'creature_salamander' },
  { id: 'gas_jellyfish', name: 'Gas Jellyfish', species: 'jellyfish', rarity: 'rare', behavior: 'passive', maxHp: 35, attack: 15, defense: 3, speed: 2, biomeAffinity: ['gas-pocket', 'sulfur-vent'], depthRange: [7, 12], loot: [{ mineralTier: 'crystal', amount: 2 }], spriteKey: 'creature_jellyfish', ability: { name: 'Toxic Cloud', description: 'Poisons the player, reducing HP each turn', cooldown: 3, effect: 'weaken', magnitude: 0.1 } },
  { id: 'iron_beetle', name: 'Iron Beetle', species: 'beetle', rarity: 'uncommon', behavior: 'aggressive', maxHp: 80, attack: 10, defense: 15, speed: 3, biomeAffinity: ['iron-vein', 'ferric-deposit'], depthRange: [8, 12], loot: [{ mineralTier: 'shard', amount: 8 }], spriteKey: 'creature_beetle' },

  // Deep tier (layers 11-15)
  { id: 'fossil_wraith', name: 'Fossil Wraith', species: 'wraith', rarity: 'rare', behavior: 'territorial', maxHp: 100, attack: 18, defense: 10, speed: 7, biomeAffinity: ['fossil-bed', 'bone-gallery'], depthRange: [11, 15], factCategory: 'Paleontology', loot: [{ mineralTier: 'crystal', amount: 5 }], spriteKey: 'creature_wraith' },
  { id: 'gem_serpent', name: 'Gem Serpent', species: 'serpent', rarity: 'epic', behavior: 'aggressive', maxHp: 150, attack: 22, defense: 12, speed: 6, biomeAffinity: ['gem-grotto', 'emerald-vein'], depthRange: [12, 16], loot: [{ mineralTier: 'geode', amount: 3 }], spriteKey: 'creature_serpent', ability: { name: 'Constrict', description: 'Reduces player speed', cooldown: 2, effect: 'weaken', magnitude: 0.5 } },

  // Extreme tier (layers 16-20)
  { id: 'void_crawler', name: 'Void Crawler', species: 'crawler', rarity: 'epic', behavior: 'aggressive', maxHp: 200, attack: 28, defense: 18, speed: 8, biomeAffinity: ['void-biome', 'anomaly-rift'], depthRange: [16, 20], loot: [{ mineralTier: 'geode', amount: 5 }, { mineralTier: 'essence', amount: 1 }], spriteKey: 'creature_crawler' },
  { id: 'time_echo', name: 'Time Echo', species: 'echo', rarity: 'legendary', behavior: 'passive', maxHp: 120, attack: 30, defense: 5, speed: 10, biomeAffinity: ['temporal-rift', 'anomaly-rift'], depthRange: [18, 20], factCategory: 'Physics', loot: [{ mineralTier: 'essence', amount: 3 }], spriteKey: 'creature_echo', ability: { name: 'Temporal Shift', description: 'Dodges the next attack', cooldown: 2, effect: 'flee', magnitude: 1 } }
]

/** Get creatures valid for a given depth and biome */
export function getCreaturesForDepth(depth: number, biomeId?: string): Omit<Creature, 'hp' | 'state'>[] {
  return CREATURE_TEMPLATES.filter(c => {
    if (depth < c.depthRange[0] || depth > c.depthRange[1]) return false
    if (biomeId && c.biomeAffinity.length > 0 && !c.biomeAffinity.includes(biomeId)) return false
    return true
  })
}

/** Roll for a creature encounter at a given depth */
export function rollCreatureEncounter(depth: number, biomeId?: string): Omit<Creature, 'hp' | 'state'> | null {
  const encounterChance = 0.05 + depth * 0.01  // 6% at layer 1, 25% at layer 20
  if (Math.random() > encounterChance) return null

  const candidates = getCreaturesForDepth(depth, biomeId)
  if (candidates.length === 0) return null

  return candidates[Math.floor(Math.random() * candidates.length)]
}
