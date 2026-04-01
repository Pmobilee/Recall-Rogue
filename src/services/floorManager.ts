/**
 * Floor/encounter progression and room generation for the card roguelite.
 * Pure logic layer — no Phaser, Svelte, or DOM imports.
 */

import type { FactDomain } from '../data/card-types'
import { getRunRng, isRunRngActive } from './seededRng'
import { FLOOR_TIMER, SEGMENT_BOSS_FLOORS, ENDLESS_BOSS_INTERVAL, MAX_FLOORS } from '../data/balance'
import { ENEMY_TEMPLATES, type EnemyRegion, getEnemiesForNode, type EnemyTemplate } from '../data/enemies'

// ============================================================
// Types
// ============================================================

export interface FloorState {
  currentFloor: number
  currentEncounter: number
  encountersPerFloor: number
  eventsPerFloor: number
  isBossFloor: boolean
  bossDefeated: boolean
  segment: 1 | 2 | 3 | 4
  lastSlotWasEvent: boolean  // Track if last room was non-combat event
  bonusRelicOfferedThisFloor?: boolean  // True once a bonus relic has been offered on post-combat rewards this floor
  actMap?: import('./mapGenerator').ActMap  // Slay the Spire-style map for this act
}

export interface RoomOption {
  type: 'combat' | 'mystery' | 'rest' | 'treasure' | 'shop'
  icon: string
  label: string
  detail: string
  enemyId?: string
  hidden: boolean
}

export interface MysteryEvent {
  id: string
  name: string
  description: string
  effect: MysteryEffect
}

export type MysteryEffect =
  | { type: 'heal'; amount: number }
  | { type: 'damage'; amount: number }
  | { type: 'freeCard' }
  | { type: 'nothing'; message: string }
  | { type: 'choice'; options: Array<{ label: string; effect: MysteryEffect }> }
  | { type: 'currency'; amount: number }
  | { type: 'maxHpChange'; amount: number }
  | { type: 'upgradeRandomCard' }
  | { type: 'removeRandomCard' }
  | { type: 'combat' }
  | { type: 'cardReward' }
  | { type: 'healPercent'; percent: number }
  | { type: 'transformCard' }
  | { type: 'compound'; effects: MysteryEffect[] }
  | { type: 'random'; outcomes: MysteryEffect[][] }
  | { type: 'quiz'; questionCount: number; difficulty: 'easy' | 'normal' | 'hard'; perCorrectRewards: MysteryEffect[]; perWrongPenalty?: MysteryEffect }
  | { type: 'rivalDuel'; questionCount: number; rivalAccuracy: number; winEffect: MysteryEffect; tieEffect: MysteryEffect; loseEffect: MysteryEffect }
  | { type: 'study'; factIds: string[] }
  | { type: 'reviewMuseum' }
  | { type: 'meditation' }
  | { type: 'doubleOrNothing' }
  | { type: 'speedRound'; timeSeconds: number }
  | { type: 'cardRoulette'; pickLimit: number; pickCost: number }
  | { type: 'factOrFiction'; statementCount: number }
  | { type: 'knowledgeShop'; steps: Array<{ cost: number; reward: MysteryEffect; label: string }>; leaveCost: number }
  | { type: 'curseRandomCards'; count: number }
  | { type: 'upgradeAllCards' }

// ============================================================
// Room type weights by segment
// ============================================================

type RoomType = RoomOption['type']

interface RoomWeight {
  type: RoomType
  weight: number
}

const ROOM_WEIGHTS_BY_SEGMENT: Record<1 | 2 | 3 | 4, RoomWeight[]> = {
  1: [
    { type: 'combat', weight: 50 },
    { type: 'mystery', weight: 20 },
    { type: 'rest', weight: 15 },
    { type: 'treasure', weight: 10 },
    { type: 'shop', weight: 5 },
  ],
  2: [
    { type: 'combat', weight: 40 },
    { type: 'mystery', weight: 25 },
    { type: 'rest', weight: 15 },
    { type: 'treasure', weight: 10 },
    { type: 'shop', weight: 10 },
  ],
  3: [
    { type: 'combat', weight: 35 },
    { type: 'mystery', weight: 25 },
    { type: 'rest', weight: 20 },
    { type: 'treasure', weight: 10 },
    { type: 'shop', weight: 10 },
  ],
  // Seg 4 (floors 10+) uses seg 3 weights
  4: [
    { type: 'combat', weight: 35 },
    { type: 'mystery', weight: 25 },
    { type: 'rest', weight: 20 },
    { type: 'treasure', weight: 10 },
    { type: 'shop', weight: 10 },
  ],
}

/** Chance of getting an event slot after a combat encounter, by segment. */
const EVENT_CHANCE_BY_SEGMENT: Record<1 | 2 | 3 | 4, number> = {
  1: 0.80,
  2: 0.75,
  3: 0.65,
  4: 0.60,
}

// ============================================================
// Mystery event templates
// ============================================================

const TIER_1_EVENTS: MysteryEvent[] = [
  {
    id: 'reading_nook',
    name: 'The Reading Nook',
    description: 'A quiet corner with a well-worn book. Reading it sharpens one of your cards.',
    effect: { type: 'upgradeRandomCard' },
  },
  {
    id: 'flashcard_merchant',
    name: 'The Flashcard Merchant',
    description: "A merchant sells knowledge bundles. 'Study now, profit later.'",
    effect: { type: 'study', factIds: [] },
  },
  {
    id: 'tutors_office',
    name: "The Tutor's Office",
    description: "An old scholar offers to review your knowledge. 'Answer well and I'll make it worth your while.'",
    effect: {
      type: 'quiz',
      questionCount: 3,
      difficulty: 'easy',
      perCorrectRewards: [
        { type: 'healPercent', percent: 5 },
        { type: 'currency', amount: 10 },
        { type: 'upgradeRandomCard' },
      ],
      // No penalty — tutor corrects gently; wrong answers just yield no reward for that question
    },
  },
  {
    id: 'whispering_shelf',
    name: 'The Whispering Shelf',
    description: 'A book slides off the shelf and into your bag. It seems to want to come with you.',
    effect: { type: 'freeCard' },
  },
  {
    id: 'dust_and_silence',
    name: 'The Inscription',
    description: 'A stone tablet covered in glowing runes. Decipher them to claim their power — but misread them at your peril.',
    effect: {
      type: 'quiz',
      questionCount: 1,
      difficulty: 'easy',
      perCorrectRewards: [{ type: 'compound', effects: [{ type: 'healPercent', percent: 15 }, { type: 'currency', amount: 10 }] }],
      perWrongPenalty: { type: 'damage', amount: 10 },
    },
  },
  {
    id: 'lost_notebook',
    name: 'The Lost Notebook',
    description: 'A leather notebook lies open. The handwriting is frantic but brilliant.',
    effect: {
      type: 'choice',
      options: [
        { label: 'Read it carefully (upgrade a card)', effect: { type: 'upgradeRandomCard' } },
        { label: 'Stuff it in your bag (gain a card)', effect: { type: 'freeCard' } },
      ],
    },
  },
  {
    id: 'lost_and_found',
    name: 'Lost and Found',
    description: 'A basket of lost things — some coins, a bandage, half a sandwich. Better than nothing.',
    effect: { type: 'currency', amount: 15 },
  },
]

const TIER_2_EVENTS: MysteryEvent[] = [
  {
    id: 'strict_librarian',
    name: 'The Strict Librarian',
    description: "A ghostly librarian blocks your path. 'Return what you\u2019ve borrowed,' she hisses, 'or pay the fine.'",
    effect: {
      type: 'choice',
      options: [
        { label: 'Return a card (remove + heal 15)', effect: { type: 'compound', effects: [{ type: 'removeRandomCard' }, { type: 'healPercent', percent: 15 }] } },
        { label: 'Refuse (take 12 damage)', effect: { type: 'damage', amount: 12 } },
      ],
    },
  },
  {
    id: 'wrong_answer_museum',
    name: 'The Wrong Answer Museum',
    description: "Your mistakes line the walls. Study them to grow stronger.",
    effect: { type: 'reviewMuseum' },
  },
  {
    id: 'copyists_workshop',
    name: "The Copyist's Workshop",
    description: "Rows of desks, each with a scribe frantically copying. One of your cards catches their eye and they 'improve' it.",
    effect: { type: 'transformCard' },
  },
  {
    id: 'strange_mushrooms',
    name: 'Strange Mushrooms',
    description: 'Bioluminescent mushrooms pulse with an inviting glow. They smell like answers.',
    effect: {
      type: 'choice',
      options: [
        {
          label: 'Eat one (unknown outcome)',
          // Hidden 50/50: heal 25% OR take 15 damage — player commits without knowing
          effect: {
            type: 'random',
            outcomes: [
              [{ type: 'healPercent', percent: 25 }],
              [{ type: 'damage', amount: 15 }],
            ],
          },
        },
        { label: 'Ignore them', effect: { type: 'currency', amount: 5 } },
      ],
    },
  },
  {
    id: 'ambush',
    name: 'Ambush!',
    description: 'The room seemed empty until the books started moving. Something is very much alive in here.',
    effect: { type: 'combat' },
  },
  {
    id: 'donation_box',
    name: 'The Donation Box',
    description: "A box labeled 'For the Preservation of Knowledge.' It jingles when shaken.",
    effect: {
      type: 'choice',
      options: [
        {
          label: 'Donate 25 gold (+5 max HP)',
          effect: { type: 'compound', effects: [{ type: 'currency', amount: -25 }, { type: 'maxHpChange', amount: 5 }] },
        },
        {
          label: 'Shake it (50/50: +15g or 10 damage)',
          // Hidden 50/50: gain gold OR take damage
          effect: {
            type: 'random',
            outcomes: [
              [{ type: 'currency', amount: 15 }],
              [{ type: 'damage', amount: 10 }],
            ],
          },
        },
        { label: 'Leave it', effect: { type: 'currency', amount: 3 } },
      ],
    },
  },
  {
    id: 'rival_student',
    name: 'The Rival Student',
    description: "A fellow scholar challenges you. 'Think you know more than me?'",
    effect: {
      type: 'rivalDuel',
      questionCount: 5,
      rivalAccuracy: 0.65,
      winEffect: { type: 'compound', effects: [{ type: 'freeCard' }, { type: 'healPercent', percent: 10 }] },
      tieEffect: { type: 'currency', amount: 15 },
      // Losing now has real stakes — not a free "nothing" outcome
      loseEffect: { type: 'damage', amount: 15 },
    },
  },
  {
    id: 'double_or_nothing',
    name: 'The Altar of Greed',
    description: "A golden altar with a single coin resting on top. 'Double your fortune,' it whispers. 'Or lose it all.'",
    effect: { type: 'doubleOrNothing' },
  },
  {
    id: 'speed_round',
    name: 'The Speed Scholar',
    description: "An hourglass slams onto the desk. 'Answer as many as you can before the sand runs out!'",
    effect: { type: 'speedRound', timeSeconds: 15 },
  },
  {
    id: 'knowing_skull',
    name: 'The Knowing Skull',
    description: "A glowing skull sits on a stone pedestal. 'Ask me anything,' it whispers. 'But knowledge always has a price.'",
    effect: {
      type: 'knowledgeShop',
      steps: [
        { cost: 8, reward: { type: 'currency', amount: 20 }, label: 'Ask for gold (20g)' },
        { cost: 12, reward: { type: 'upgradeRandomCard' }, label: 'Ask for wisdom (upgrade a card)' },
        { cost: 16, reward: { type: 'freeCard' }, label: 'Ask for power (gain a card)' },
      ],
      leaveCost: 5,
    },
  },
]

const TIER_3_EVENTS: MysteryEvent[] = [
  {
    id: 'burning_library',
    name: 'The Burning Library',
    description: 'Books are falling from the shelves! Save what you can!',
    effect: {
      type: 'quiz',
      questionCount: 4,
      difficulty: 'easy',
      perCorrectRewards: [
        { type: 'currency', amount: 15 },
        { type: 'upgradeRandomCard' },
        { type: 'healPercent', percent: 10 },
        { type: 'upgradeRandomCard' },
      ],
      perWrongPenalty: { type: 'damage', amount: 8 },
    },
  },
  {
    id: 'mirror_scholar',
    name: 'The Mirror Scholar',
    description: "A full-length mirror in an otherwise empty room. Your reflection smiles. You didn't.",
    effect: { type: 'combat' },
  },
  {
    id: 'merchant_of_memories',
    name: 'The Merchant of Memories',
    description: "An ancient merchant sits cross-legged. 'I don\u2019t deal in gold,' they say. 'Only vitality.'",
    effect: {
      type: 'choice',
      options: [
        {
          label: 'Trade 8 max HP (upgrade a card)',
          effect: { type: 'compound', effects: [{ type: 'maxHpChange', amount: -8 }, { type: 'upgradeRandomCard' }] },
        },
        {
          label: 'Trade 15 max HP (upgrade a card + gain a card)',
          effect: { type: 'compound', effects: [{ type: 'maxHpChange', amount: -15 }, { type: 'upgradeRandomCard' }, { type: 'freeCard' }] },
        },
        // Decline is never truly free — consolation 3g
        { label: 'Decline', effect: { type: 'currency', amount: 3 } },
      ],
    },
  },
  {
    id: 'cache_of_contraband',
    name: 'Cache of Contraband',
    description: "Books with red 'BANNED' stamps. They vibrate with forbidden knowledge.",
    effect: {
      type: 'choice',
      options: [
        { label: 'Read them (gain card, take 10 dmg)', effect: { type: 'compound', effects: [{ type: 'damage', amount: 10 }, { type: 'freeCard' }] } },
        { label: 'Take one safely', effect: { type: 'freeCard' } },
        { label: 'Report them (gain 30 gold)', effect: { type: 'currency', amount: 30 } },
      ],
    },
  },
  {
    id: 'wishing_well',
    name: 'The Wishing Well',
    description: "A deep shaft in the floor, coins glittering at the bottom. 'Toss a coin to your scholar.'",
    effect: {
      type: 'choice',
      options: [
        {
          label: 'Toss 10 gold (random reward)',
          // 4 equally-weighted outcomes; the bad outcome now also deals damage
          effect: {
            type: 'random',
            outcomes: [
              [{ type: 'currency', amount: -10 }, { type: 'currency', amount: 30 }],
              [{ type: 'currency', amount: -10 }, { type: 'healPercent', percent: 20 }],
              [{ type: 'currency', amount: -10 }, { type: 'upgradeRandomCard' }],
              [{ type: 'currency', amount: -10 }, { type: 'damage', amount: 8 }],
            ],
          },
        },
        { label: 'Save your gold', effect: { type: 'currency', amount: 3 } },
      ],
    },
  },
  {
    id: 'study_group',
    name: 'The Study Group',
    description: "Four ghostly students huddle around a desk. 'Sit down,' one says. 'Let's review.' Answer well and your cards grow stronger.",
    effect: {
      type: 'quiz',
      questionCount: 2,
      difficulty: 'easy',
      perCorrectRewards: [{ type: 'upgradeRandomCard' }, { type: 'upgradeRandomCard' }],
    },
  },
  {
    id: 'card_roulette',
    name: 'Card Roulette',
    description: 'Five cards lie face-down on a velvet table. Each flip costs a drop of blood — but the rewards could be extraordinary.',
    effect: { type: 'cardRoulette', pickLimit: 3, pickCost: 5 },
  },
  {
    id: 'fact_or_fiction',
    name: 'Fact or Fiction',
    description: "A spectral judge reads statements aloud. 'True or false?' they demand. 'Choose wisely — lies have consequences.'",
    effect: { type: 'factOrFiction', statementCount: 5 },
  },
  {
    id: 'forbidden_section',
    name: 'The Forbidden Section',
    description: "Banned books behind shattered glass. The knowledge within is powerful — but reading carelessly could corrupt your mind.",
    effect: {
      type: 'quiz',
      questionCount: 3,
      difficulty: 'hard',
      perCorrectRewards: [
        { type: 'upgradeRandomCard' },
        { type: 'upgradeRandomCard' },
        { type: 'upgradeRandomCard' },
      ],
      perWrongPenalty: { type: 'curseRandomCards', count: 1 },
    },
  },
]

const TIER_4_EVENTS: MysteryEvent[] = [
  {
    id: 'knowledge_gamble',
    name: 'The Knowledge Gamble',
    description: 'Three questions. Everything on the line. The altar glows brighter with each answer.',
    effect: {
      type: 'quiz',
      questionCount: 3,
      difficulty: 'hard',
      perCorrectRewards: [
        { type: 'healPercent', percent: 15 },
        { type: 'upgradeRandomCard' },
        { type: 'healPercent', percent: 15 },
      ],
      perWrongPenalty: { type: 'damage', amount: 10 },
    },
  },
  {
    id: 'the_purge',
    name: 'The Purge',
    description: 'A stone altar with a sacrificial flame. The fire burns away your weakest knowledge — and something stronger fills the gap.',
    effect: { type: 'removeRandomCard' },
  },
  {
    id: 'meditation_chamber',
    name: 'The Meditation Chamber',
    description: "Silence. Your mind reflects on what you know — and what you don't.",
    effect: { type: 'meditation' },
  },
  {
    id: 'eraser_storm',
    name: 'The Purification',
    description: 'A white mist rolls in, dissolving impurities. Two of your weakest cards dissolve — but the mist is strangely restorative.',
    effect: { type: 'compound', effects: [{ type: 'removeRandomCard' }, { type: 'removeRandomCard' }, { type: 'healPercent', percent: 15 }] },
  },
  {
    id: 'elite_ambush',
    name: 'Ambush!',
    description: 'You should have known this room was too quiet.',
    effect: { type: 'combat' },
  },
  {
    id: 'desperate_bargain',
    name: 'The Desperate Bargain',
    description: 'An altar hums with energy. It promises clarity — at a permanent cost.',
    effect: {
      type: 'choice',
      options: [
        { label: 'Sacrifice 10 max HP (remove 2 cards, heal 20%)', effect: { type: 'compound', effects: [{ type: 'maxHpChange', amount: -10 }, { type: 'removeRandomCard' }, { type: 'removeRandomCard' }, { type: 'healPercent', percent: 20 }] } },
        { label: 'Keep your strength', effect: { type: 'currency', amount: 3 } },
      ],
    },
  },
  {
    id: 'the_breakthrough',
    name: 'The Breakthrough',
    description: 'Everything clicks. A connection forms between ideas you never linked before. Your understanding deepens and your wounds ease.',
    effect: { type: 'compound', effects: [{ type: 'upgradeRandomCard' }, { type: 'healPercent', percent: 10 }] },
  },
  {
    id: 'the_epiphany',
    name: 'The Epiphany',
    description: 'A vast cosmic archway opens before you. Three paths shimmer with impossible promise — but each demands a terrible sacrifice.',
    effect: {
      type: 'choice',
      options: [
        {
          label: 'I Remember Everything (upgrade ALL cards, gain 3 curses)',
          effect: { type: 'compound', effects: [{ type: 'upgradeAllCards' }, { type: 'curseRandomCards', count: 3 }] },
        },
        {
          label: 'I Know My Weakness (remove up to 3 cards, lose 20% max HP)',
          effect: { type: 'compound', effects: [{ type: 'removeRandomCard' }, { type: 'removeRandomCard' }, { type: 'removeRandomCard' }, { type: 'maxHpChange', amount: -20 }] },
        },
        {
          label: 'I Seek Knowledge (quiz 5 hard questions for massive rewards)',
          effect: {
            type: 'quiz',
            questionCount: 5,
            difficulty: 'hard',
            perCorrectRewards: [
              { type: 'compound', effects: [{ type: 'currency', amount: 15 }, { type: 'healPercent', percent: 5 }] },
              { type: 'compound', effects: [{ type: 'currency', amount: 15 }, { type: 'healPercent', percent: 5 }] },
              { type: 'compound', effects: [{ type: 'currency', amount: 15 }, { type: 'healPercent', percent: 5 }] },
              { type: 'compound', effects: [{ type: 'currency', amount: 15 }, { type: 'healPercent', percent: 5 }] },
              { type: 'compound', effects: [{ type: 'currency', amount: 15 }, { type: 'healPercent', percent: 5 }] },
            ],
            perWrongPenalty: { type: 'damage', amount: 10 },
          },
        },
        {
          label: 'Turn away',
          effect: { type: 'currency', amount: 5 },
        },
      ],
    },
  },
]

// ============================================================
// Boss mapping
// ============================================================

const BOSS_MAP: Record<number, string> = {
  3: 'final_exam',
  6: 'burning_deadline',
  9: 'algorithm',
  12: 'curriculum',
  15: 'group_project',
  18: 'rabbit_hole',
  21: 'omnibus',
  24: 'final_lesson',
}

/**
 * Boss pool per region — 2 bosses each, randomly selected per run.
 * @deprecated Use ACT_ENEMY_POOLS + getEnemiesForNode() instead (AR-59.13). Remove in AR-59.19.
 */
const BOSS_POOL_BY_REGION: Record<EnemyRegion, string[]> = {
  shallow_depths: ['final_exam', 'burning_deadline'],
  deep_caverns: ['algorithm', 'curriculum'],
  the_abyss: ['group_project', 'rabbit_hole'],
  the_archive: ['omnibus', 'final_lesson'],
}

/**
 * Returns the act number (1, 2, or 3) for a given floor in the v2 3-act run structure.
 * Act 1: floors 1-4, Act 2: floors 5-8, Act 3: floors 9-12.
 * Floors outside 1-12 clamp to the nearest act.
 *
 * @param floor - The current floor number (1-indexed).
 */
export function getActForFloor(floor: number): 1 | 2 | 3 {
  if (floor <= 4) return 1
  if (floor <= 8) return 2
  return 3
}

/**
 * Returns the appropriate EnemyTemplate array for the given floor and node type.
 * Uses the v2 ACT_ENEMY_POOLS structure from AR-59.13.
 *
 * @param floor - The current floor number.
 * @param nodeType - The node type: 'combat', 'elite', 'mini_boss', or 'boss'.
 */
export function getEnemiesForFloorNode(
  floor: number,
  nodeType: 'combat' | 'elite' | 'mini_boss' | 'boss',
): EnemyTemplate[] {
  const act = getActForFloor(floor)
  return getEnemiesForNode(act, nodeType)
}

/**
 * Maps a floor number to its dungeon region for enemy selection.
 * Updated in AR-98 to match V2 act boundaries (4 floors per act).
 * Act 1 (floors 1-4) = shallow_depths, Act 2 (5-8) = deep_caverns,
 * Act 3 (9-12) = the_archive, endless (13+) = the_abyss.
 */
export function getRegionForFloor(floor: number): EnemyRegion {
  if (floor <= 4) return 'shallow_depths'
  if (floor <= 8) return 'deep_caverns'
  if (floor <= 12) return 'the_archive'
  return 'the_abyss' // endless mode
}

/**
 * Mini-boss pools per region.
 * @deprecated Use ACT_ENEMY_POOLS + getEnemiesForNode() instead (AR-59.13). Remove in AR-59.19.
 */
const MINI_BOSS_POOL_BY_REGION: Record<EnemyRegion, string[]> = {
  shallow_depths: ['plagiarist', 'citation_needed', 'card_catalogue', 'headmistress', 'tutor', 'study_group'],
  deep_caverns: ['tenure_guardian', 'proctor', 'harsh_grader', 'textbook', 'imposter_syndrome', 'pressure_cooker'],
  the_abyss: ['grade_dragon', 'comparison_trap', 'perfectionist', 'hydra_problem', 'ivory_tower', 'helicopter_parent'],
  the_archive: ['first_question', 'dean', 'dissertation', 'eureka', 'paradigm_shift', 'ancient_tongue', 'lost_thesis'],
}

/** Mini-boss pool IDs, used for encounter 3 on non-boss floors. Flat fallback for tests. */
const MINI_BOSS_POOL = Object.values(MINI_BOSS_POOL_BY_REGION).flat()

// ============================================================
// Exported functions
// ============================================================

/** Create initial floor state for a new run. */
export function createFloorState(): FloorState {
  return {
    currentFloor: 1,
    currentEncounter: 1,
    encountersPerFloor: getEncountersForFloor(1),
    eventsPerFloor: getEventsForFloor(1),
    isBossFloor: isBossFloor(1),
    bossDefeated: false,
    segment: getSegment(1),
    lastSlotWasEvent: false,
  }
}

/** Get the segment (difficulty tier) for a given floor. */
export function getSegment(floor: number): 1 | 2 | 3 | 4 {
  if (floor <= 6) return 1   // Shallow Depths: floors 1-6
  if (floor <= 12) return 2  // Deep Caverns: floors 7-12
  if (floor <= 18) return 3  // The Abyss: floors 13-18
  return 4                   // The Archive: floors 19-24 (and endless 25+)
}

/** Get the number of combat encounters per floor. Always 3. */
export function getEncountersForFloor(_floor: number): number {
  return 3
}

/** Get the number of non-combat events for a floor. */
export function getEventsForFloor(floor: number): number {
  const seg = getSegment(floor)
  if (seg === 1) return 1
  const rng = isRunRngActive() ? getRunRng('map') : null
  if (seg === 2) return (rng ? rng.next() : Math.random()) < 0.5 ? 1 : 2
  return 2
}

/** Check if a floor has a boss encounter. */
export function isBossFloor(floor: number): boolean {
  if (SEGMENT_BOSS_FLOORS.includes(floor as (typeof SEGMENT_BOSS_FLOORS)[number])) return true
  if (floor <= MAX_FLOORS) return false
  // Endless mode: boss every ENDLESS_BOSS_INTERVAL floors
  return floor % ENDLESS_BOSS_INTERVAL === 0
}

/** Get the boss enemy template ID for a boss floor, or null. */
export function getBossForFloor(floor: number): string | null {
  if (BOSS_MAP[floor]) return BOSS_MAP[floor]
  if (isBossFloor(floor)) {
    // Endless mode: cycle through bosses
    const bossIds = Object.values(BOSS_MAP)
    return bossIds[(floor - 1) % bossIds.length]
  }
  return null
}

/** Pick a random boss from the region's pool using a seeded random value (0–1). */
export function pickBossForFloor(floor: number, rngValue: number): string {
  const region = getRegionForFloor(floor)
  const pool = BOSS_POOL_BY_REGION[region]
  return pool[Math.floor(rngValue * pool.length)]
}

/**
 * Check if a given encounter on a floor is a mini-boss encounter.
 * Returns true if encounter === 3 AND the floor is NOT a boss floor.
 * On boss floors, encounter 3 is a full boss instead.
 */
export function isMiniBossEncounter(floor: number, encounter: number): boolean {
  return encounter === 3 && !isBossFloor(floor)
}

/**
 * Get the mini-boss enemy template ID for a given floor.
 * Picks from the region-appropriate mini-boss pool for variety.
 */
export function getMiniBossForFloor(floor: number): string {
  const region = getRegionForFloor(floor)
  const pool = MINI_BOSS_POOL_BY_REGION[region]
  const rng = isRunRngActive() ? getRunRng('enemies') : null
  const idx = Math.floor((rng ? rng.next() : Math.random()) * pool.length)
  return pool[idx]
}

/** Get the timer duration in seconds for a given floor. */
export function getTimerForFloor(floor: number): number {
  return FLOOR_TIMER.find(t => floor <= t.maxFloor)?.seconds ?? 4
}

/**
 * Generate 3 room options for the current floor.
 * At least 1 MUST be combat.
 */
export function generateRoomOptions(floor: number): RoomOption[] {
  const segment = getSegment(floor)
  const weights = ROOM_WEIGHTS_BY_SEGMENT[segment]
  const options: RoomOption[] = []

  // Generate 3 rooms
  for (let i = 0; i < 3; i++) {
    const roomType = pickWeightedRoomType(weights)
    options.push(buildRoomOption(roomType, floor))
  }

  // Ensure at least 1 combat room
  const hasCombat = options.some(o => o.type === 'combat')
  if (!hasCombat) {
    // Replace the first non-combat room with a combat room
    options[0] = buildRoomOption('combat', floor)
  }

  return options
}

/** Roll whether the next room selection should be an event (non-combat) slot. */
export function shouldOfferEvent(floor: number): boolean {
  const segment = getSegment(floor)
  const rng = isRunRngActive() ? getRunRng('map') : null
  return (rng ? rng.next() : Math.random()) < EVENT_CHANCE_BY_SEGMENT[segment]
}

/**
 * Generate 3 combat-only room options with distinct enemies.
 */
export function generateCombatRoomOptions(floor: number): RoomOption[] {
  const usedIds = new Set<string>()
  const options: RoomOption[] = []
  for (let i = 0; i < 3; i++) {
    let enemyId = pickCombatEnemy(floor)
    let attempts = 0
    while (usedIds.has(enemyId) && attempts < 10) {
      enemyId = pickCombatEnemy(floor)
      attempts++
    }
    usedIds.add(enemyId)
    options.push(buildRoomOption('combat', floor, enemyId))
  }
  return options
}

/**
 * Generate 3 non-combat (event) room options.
 */
export function generateEventRoomOptions(floor: number): RoomOption[] {
  const segment = getSegment(floor)
  const weights = ROOM_WEIGHTS_BY_SEGMENT[segment].filter(w => w.type !== 'combat')
  const options: RoomOption[] = []
  for (let i = 0; i < 3; i++) {
    options.push(buildRoomOption(pickWeightedRoomType(weights), floor))
  }
  return options
}

/**
 * Pick a random combat enemy from the common pool for this floor's region.
 * Uses weighted selection based on spawnWeight (rarity system).
 * NOTE: Only call for encounters 1 and 2 (regular encounters).
 * Encounter 3 is always a mini-boss (via getMiniBossForFloor) or boss (via getBossForFloor).
 */
export function pickCombatEnemy(floor: number): string {
  const region = getRegionForFloor(floor)
  const regionEnemies = ENEMY_TEMPLATES.filter(e => e.category === 'common' && e.region === region)
  if (regionEnemies.length === 0) {
    const allCommon = ENEMY_TEMPLATES.filter(e => e.category === 'common')
    return weightedEnemyPick(allCommon)
  }
  return weightedEnemyPick(regionEnemies)
}

/** Weighted random selection from an enemy pool using spawnWeight (default 10). */
function weightedEnemyPick(pool: typeof ENEMY_TEMPLATES): string {
  const totalWeight = pool.reduce((sum, e) => sum + (e.spawnWeight ?? 10), 0)
  const rng = isRunRngActive() ? getRunRng('enemies') : null
  let roll = (rng ? rng.next() : Math.random()) * totalWeight
  for (const e of pool) {
    roll -= (e.spawnWeight ?? 10)
    if (roll <= 0) return e.id
  }
  return pool[pool.length - 1]?.id ?? 'page_flutter'
}

/**
 * Per-act distribution weights for mystery event sub-types.
 * Escalates combat risk and card reward chances as acts progress.
 * Act 1 (floors 1-4): learn quiz-gate safely; Act 3 (floors 9-12): desperate gambles.
 */
const MYSTERY_DISTRIBUTION_BY_ACT: Record<1 | 2 | 3, { combat: number; cardReward: number; narrative: number }> = {
  1: { combat: 0.15, cardReward: 0.05, narrative: 0.80 },
  2: { combat: 0.25, cardReward: 0.10, narrative: 0.65 },
  3: { combat: 0.30, cardReward: 0.15, narrative: 0.55 },
}

/**
 * Generate a mystery event scaled to the current floor.
 * Distribution is act-aware (Act 1: 80/5/15, Act 2: 65/10/25, Act 3: 55/15/30
 * for narrative/cardReward/combat respectively).
 * - Act 1 (floors 1-4): low combat, quiz-gate introduction
 * - Act 2 (floors 5-8): ramped combat risk, meaningful rewards
 * - Act 3 (floors 9-12): maximum tension, elite ambushes
 */
export function generateMysteryEvent(floor?: number): MysteryEvent {
  const f = floor ?? 1
  const act = getActForFloor(f)
  const dist = MYSTERY_DISTRIBUTION_BY_ACT[act]
  const rng = isRunRngActive() ? getRunRng('map') : null

  const roll = (rng ? rng.next() : Math.random())

  // Combat ambush — Act 3 always elite
  if (roll < dist.combat) {
    const isElite = act === 3 || (act === 2 && (rng ? rng.next() : Math.random()) < 0.5)
    return {
      id: isElite ? 'mystery_elite_combat' : 'mystery_combat',
      name: 'Ambush!',
      description: isElite
        ? 'You should have known this room was too quiet.'
        : 'The room seemed empty until the books started moving. Something is very much alive in here.',
      effect: { type: 'combat' },
    }
  }

  // Card reward cache
  if (roll < dist.combat + dist.cardReward) {
    return {
      id: 'mystery_reward',
      name: 'Hidden Cache',
      description: 'A stash of cards, hidden behind loose bricks.',
      effect: { type: 'cardReward' },
    }
  }

  // Narrative event from act-mapped tier pool
  // Act 1 = Tier 1, Act 2 = Tier 1 + Tier 2, Act 3 = all tiers
  const pool: MysteryEvent[] = [...TIER_1_EVENTS]
  if (act >= 2) pool.push(...TIER_2_EVENTS)
  if (act >= 2) pool.push(...TIER_3_EVENTS)
  if (act >= 3) pool.push(...TIER_4_EVENTS)

  const idx = Math.floor((rng ? rng.next() : Math.random()) * pool.length)
  return { ...pool[idx] }
}

/** Find a mystery event by its ID from all tiers. Dev use only. */
export function getMysteryEventById(id: string): MysteryEvent | null {
  const allEvents = [...TIER_1_EVENTS, ...TIER_2_EVENTS, ...TIER_3_EVENTS, ...TIER_4_EVENTS];
  return allEvents.find(e => e.id === id) ?? null;
}

/** Get all mystery event IDs across all tiers. Dev use only. */
export function getAllMysteryEventIds(): string[] {
  return [...TIER_1_EVENTS, ...TIER_2_EVENTS, ...TIER_3_EVENTS, ...TIER_4_EVENTS].map(e => e.id);
}

/**
 * Advance to next encounter.
 * Returns true if floor is complete (all encounters done).
 */
export function advanceEncounter(state: FloorState): boolean {
  state.currentEncounter++
  if (state.currentEncounter > state.encountersPerFloor) {
    return true // floor complete
  }
  return false
}

/** Advance to next floor. Resets encounter counter and updates floor metadata. */
export function advanceFloor(state: FloorState): void {
  state.currentFloor++
  state.currentEncounter = 1
  state.segment = getSegment(state.currentFloor)
  state.encountersPerFloor = getEncountersForFloor(state.currentFloor)
  state.eventsPerFloor = getEventsForFloor(state.currentFloor)
  state.isBossFloor = isBossFloor(state.currentFloor)
  state.bossDefeated = false
  state.lastSlotWasEvent = false
  state.bonusRelicOfferedThisFloor = false
}

// ============================================================
// Internal helpers
// ============================================================

/** Pick a room type based on weighted probabilities. */
function pickWeightedRoomType(weights: RoomWeight[]): RoomType {
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  const rng = isRunRngActive() ? getRunRng('map') : null
  let roll = (rng ? rng.next() : Math.random()) * total
  for (const w of weights) {
    roll -= w.weight
    if (roll <= 0) return w.type
  }
  return weights[weights.length - 1].type
}

/** Build a RoomOption of the given type. */
function buildRoomOption(type: RoomType, floor: number, preselectedEnemyId?: string): RoomOption {
  switch (type) {
    case 'combat': {
      const enemyId = preselectedEnemyId ?? pickCombatEnemy(floor)
      return {
        type: 'combat',
        icon: '\u2694\uFE0F', // ⚔️
        label: 'Combat',
        detail: 'Enemy encounter',
        enemyId,
        hidden: false,
      }
    }
    case 'mystery':
      return {
        type: 'mystery',
        icon: '\u2753', // ❓
        label: 'Mystery',
        detail: '???',
        hidden: true,
      }
    case 'rest':
      return {
        type: 'rest',
        icon: '\u2764\uFE0F', // ❤️
        label: 'Rest Site',
        detail: '',
        hidden: false,
      }
    case 'treasure':
      return {
        type: 'treasure',
        icon: '\uD83C\uDF81', // 🎁
        label: 'Treasure',
        detail: '',
        hidden: false,
      }
    case 'shop':
      return {
        type: 'shop',
        icon: '\uD83D\uDED2', // 🛒
        label: 'Shop',
        detail: '',
        hidden: false,
      }
  }
}
