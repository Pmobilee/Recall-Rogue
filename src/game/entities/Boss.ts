import type { Creature, CreatureAbility } from './Creature'
import type { Rarity } from '../../data/types'

/** Boss phase — bosses have multiple combat phases */
export interface BossPhase {
  hpThreshold: number     // Phase triggers below this HP percentage
  ability: CreatureAbility
  dialogue: string        // GAIA or boss dialogue when phase begins
  spriteVariant?: string  // Optional sprite change for the phase
}

/** Boss creature extends the base Creature */
export interface Boss extends Creature {
  isBoss: true
  title: string           // Display title ("Guardian of the Deep")
  phases: BossPhase[]
  currentPhase: number
  /** Quiz requirement: must answer correctly to deal damage */
  quizRequired: boolean
  /** Fact category for quiz questions during boss fight */
  quizCategory: string
  /** Guaranteed relic drop on defeat */
  relicDrop?: string
}

/** Boss templates for each biome tier */
export const BOSS_TEMPLATES: Omit<Boss, 'hp' | 'state' | 'currentPhase'>[] = [
  {
    id: 'boss_crystal_golem',
    name: 'Crystal Golem',
    title: 'Guardian of the Shallow Depths',
    species: 'golem',
    rarity: 'rare',
    isBoss: true,
    behavior: 'guardian',
    maxHp: 200,
    attack: 15,
    defense: 20,
    speed: 3,
    biomeAffinity: ['crystalline-cavern', 'quartz-vein'],
    depthRange: [4, 6],
    quizRequired: true,
    quizCategory: 'Geology',
    loot: [{ mineralTier: 'crystal', amount: 10 }, { mineralTier: 'geode', amount: 3 }],
    phases: [
      { hpThreshold: 0.6, ability: { name: 'Crystal Shield', description: 'Reduces damage by 50% for 2 turns', cooldown: 4, effect: 'shield', magnitude: 0.5 }, dialogue: 'The golem raises crystalline barriers around itself.' },
      { hpThreshold: 0.3, ability: { name: 'Shatter', description: 'Deals 2x damage', cooldown: 3, effect: 'weaken', magnitude: 2 }, dialogue: 'Cracks spread across the golem. It lashes out wildly!' }
    ],
    relicDrop: 'relic_crystal_heart',
    spriteKey: 'creature_golem'
  },
  {
    id: 'boss_lava_wyrm',
    name: 'Lava Wyrm',
    title: 'Serpent of the Molten Core',
    species: 'wyrm',
    rarity: 'epic',
    isBoss: true,
    behavior: 'aggressive',
    maxHp: 400,
    attack: 25,
    defense: 15,
    speed: 7,
    biomeAffinity: ['magma-chamber', 'volcanic-vent'],
    depthRange: [10, 14],
    quizRequired: true,
    quizCategory: 'Geology',
    loot: [{ mineralTier: 'geode', amount: 8 }, { mineralTier: 'essence', amount: 2 }],
    phases: [
      { hpThreshold: 0.7, ability: { name: 'Molten Breath', description: 'Area attack hitting all allies', cooldown: 3, effect: 'weaken', magnitude: 1.5 }, dialogue: 'The wyrm exhales a river of molten rock!' },
      { hpThreshold: 0.4, ability: { name: 'Summon Magmites', description: 'Summons 2 small magma creatures', cooldown: 5, effect: 'summon', magnitude: 2 }, dialogue: 'The wyrm calls forth its brood from the magma!' },
      { hpThreshold: 0.15, ability: { name: 'Desperation', description: 'Attack and speed doubled', cooldown: 0, effect: 'weaken', magnitude: 2 }, dialogue: 'The wyrm thrashes in fury, the cavern shaking!' }
    ],
    relicDrop: 'relic_wyrm_scale',
    spriteKey: 'creature_wyrm'
  },
  {
    id: 'boss_deep_leviathan',
    name: 'Deep Leviathan',
    title: 'Sovereign of the Abyssal Dark',
    species: 'leviathan',
    rarity: 'legendary',
    isBoss: true,
    behavior: 'aggressive',
    maxHp: 600,
    attack: 30,
    defense: 22,
    speed: 6,
    biomeAffinity: ['deep_biolume', 'obsidian_rift', 'primordial_mantle'],
    depthRange: [13, 16] as [number, number],
    quizRequired: true,
    quizCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'geode', amount: 6 }, { mineralTier: 'essence', amount: 3 }],
    phases: [
      {
        hpThreshold: 0.7,
        ability: {
          name: 'Bioluminescent Pulse',
          description: 'Blinds player — next wrong answer deals 2x creature damage',
          cooldown: 4, effect: 'weaken', magnitude: 2
        },
        dialogue: 'A blinding wave of bioluminescent light erupts from the Leviathan!'
      },
      {
        hpThreshold: 0.45,
        ability: {
          name: 'Crushing Depth',
          description: 'Drains 20 O2 immediately',
          cooldown: 0, effect: 'weaken', magnitude: 20
        },
        dialogue: 'The pressure intensifies. Your suit groans under the weight of the deep.'
      },
      {
        hpThreshold: 0.2,
        ability: {
          name: 'Final Surge',
          description: 'Attacks twice per turn for 3 turns',
          cooldown: 0, effect: 'weaken', magnitude: 1.8
        },
        dialogue: 'The Leviathan lets out a deafening cry and lunges!'
      }
    ],
    relicDrop: 'relic_leviathan_fin',
    spriteKey: 'creature_leviathan'
  },
  {
    id: 'boss_void_sentinel',
    name: 'Void Sentinel',
    title: 'Watcher at the World\'s End',
    species: 'sentinel',
    rarity: 'legendary',
    isBoss: true,
    behavior: 'guardian',
    maxHp: 800,
    attack: 35,
    defense: 30,
    speed: 5,
    biomeAffinity: ['void-biome', 'anomaly-rift'],
    depthRange: [17, 20],
    quizRequired: true,
    quizCategory: 'General Knowledge',
    loot: [{ mineralTier: 'essence', amount: 10 }],
    phases: [
      { hpThreshold: 0.75, ability: { name: 'Knowledge Drain', description: 'Player must answer 2 questions to continue', cooldown: 4, effect: 'weaken', magnitude: 2 }, dialogue: 'The Sentinel probes your mind. Prove your knowledge.' },
      { hpThreshold: 0.5, ability: { name: 'Void Shield', description: 'Immune to damage for 1 turn', cooldown: 3, effect: 'shield', magnitude: 1 }, dialogue: 'Reality warps around the Sentinel.' },
      { hpThreshold: 0.25, ability: { name: 'Time Fracture', description: 'Resets player cooldowns', cooldown: 5, effect: 'weaken', magnitude: 0 }, dialogue: 'Time stutters. Your preparations unravel.' },
      { hpThreshold: 0.1, ability: { name: 'Final Question', description: 'Answer correctly or take massive damage', cooldown: 0, effect: 'weaken', magnitude: 5 }, dialogue: 'GAIA whispers: "This is the final test."' }
    ],
    relicDrop: 'relic_void_eye',
    spriteKey: 'creature_sentinel'
  }
]

/**
 * Maps 0-based layer index to the boss template ID that guards descent.
 * Used by MineScene to gate the DescentShaft interaction. (DD-V2-025)
 */
export const BOSS_LAYER_MAP: Record<number, string> = {
  4:  'boss_crystal_golem',     // Layer 5  (0-based: 4)
  9:  'boss_lava_wyrm',         // Layer 10 (0-based: 9)
  14: 'boss_deep_leviathan',    // Layer 15 (0-based: 14)
  19: 'boss_void_sentinel',     // Layer 20 (0-based: 19)
}

/**
 * Create a boss instance
 */
export function createBoss(templateId: string, depth: number): Boss | null {
  const template = BOSS_TEMPLATES.find(b => b.id === templateId)
  if (!template) return null

  const depthScale = 1 + (depth - 1) * 0.08
  return {
    ...template,
    hp: Math.round(template.maxHp * depthScale),
    maxHp: Math.round(template.maxHp * depthScale),
    attack: Math.round(template.attack * depthScale),
    defense: Math.round(template.defense * depthScale),
    state: 'idle',
    currentPhase: 0
  }
}

/**
 * Check if boss should advance to next phase
 */
export function checkPhaseTransition(boss: Boss): BossPhase | null {
  const hpPercent = boss.hp / boss.maxHp
  for (let i = boss.currentPhase; i < boss.phases.length; i++) {
    if (hpPercent <= boss.phases[i].hpThreshold && boss.currentPhase <= i) {
      return boss.phases[i]
    }
  }
  return null
}
