import type { Rarity } from '../../data/types'

/** Creature behavior type */
export type CreatureBehavior = 'passive' | 'territorial' | 'aggressive' | 'guardian'

/** Creature state in combat */
export type CreatureState = 'idle' | 'alert' | 'attacking' | 'stunned' | 'defeated'

/** A mine creature entity */
export interface Creature {
  id: string
  name: string
  species: string
  rarity: Rarity
  behavior: CreatureBehavior
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  state: CreatureState

  /** Biome affinity — spawns more in these biomes */
  biomeAffinity: string[]
  /** Depth range this creature appears in */
  depthRange: [number, number]
  /** Quiz category associated — defeating it teaches related facts */
  factCategory?: string
  /** Loot dropped on defeat */
  loot: { mineralTier: string; amount: number }[]
  /** Special ability */
  ability?: CreatureAbility

  /** Visual */
  spriteKey: string
  tintColor?: number
}

export interface CreatureAbility {
  name: string
  description: string
  cooldown: number        // turns
  effect: 'heal' | 'shield' | 'weaken' | 'summon' | 'flee'
  magnitude: number
}

/**
 * Create a creature instance with scaled stats based on depth
 */
export function createCreature(
  template: Omit<Creature, 'hp' | 'state'>,
  depth: number
): Creature {
  const depthScale = 1 + (depth - 1) * 0.1
  return {
    ...template,
    hp: Math.round(template.maxHp * depthScale),
    maxHp: Math.round(template.maxHp * depthScale),
    attack: Math.round(template.attack * depthScale),
    defense: Math.round(template.defense * depthScale),
    state: 'idle'
  }
}

/**
 * Calculate damage dealt to a creature
 */
export function calculateDamage(attackerPower: number, defenderDefense: number): number {
  const baseDamage = Math.max(1, attackerPower - defenderDefense * 0.5)
  const variance = 0.8 + Math.random() * 0.4  // 80%-120% variance
  return Math.round(baseDamage * variance)
}

/**
 * Check if a creature should flee based on remaining HP
 */
export function shouldFlee(creature: Creature): boolean {
  if (creature.behavior === 'aggressive') return false
  return creature.hp / creature.maxHp < 0.2
}
