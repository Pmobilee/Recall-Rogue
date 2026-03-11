/**
 * Floor/encounter progression and room generation for the card roguelite.
 * Pure logic layer — no Phaser, Svelte, or DOM imports.
 */

import type { FactDomain } from '../data/card-types'
import { FLOOR_TIMER, SEGMENT_BOSS_FLOORS, ENDLESS_BOSS_INTERVAL, MAX_FLOORS } from '../data/balance'
import { ENEMY_TEMPLATES } from '../data/enemies'

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

const MYSTERY_EVENTS: MysteryEvent[] = [
  {
    id: 'healing_spring',
    name: 'Healing Spring',
    description: 'You discover a pool of glowing water. Its warmth restores your strength.',
    effect: { type: 'heal', amount: 20 },
  },
  {
    id: 'unstable_ground',
    name: 'Unstable Ground',
    description: 'The floor gives way beneath you! Rocks and debris shower down.',
    effect: { type: 'damage', amount: 10 },
  },
  {
    id: 'forgotten_cache',
    name: 'Forgotten Cache',
    description: 'A hidden compartment reveals a forgotten data crystal.',
    effect: { type: 'freeCard' },
  },
  {
    id: 'empty_chamber',
    name: 'Empty Chamber',
    description: 'An eerily quiet chamber. Nothing here but silence and dust.',
    effect: { type: 'nothing', message: 'The silence is unsettling, but harmless.' },
  },
  {
    id: 'traders_gambit',
    name: "Trader's Gambit",
    description: 'A wandering merchant offers you a deal: knowledge for vitality.',
    effect: {
      type: 'choice',
      options: [
        { label: 'Trade 20% HP for a free card', effect: { type: 'damage', amount: 20 } },
        { label: 'Leave safely', effect: { type: 'nothing', message: 'You decline and move on.' } },
      ],
    },
  },
]

// ============================================================
// Boss mapping
// ============================================================

const BOSS_MAP: Record<number, string> = {
  3: 'the_excavator',
  6: 'magma_core',
  9: 'the_archivist',
  12: 'crystal_warden',
  15: 'shadow_hydra',
  18: 'void_weaver',
  21: 'knowledge_golem',
  24: 'the_curator',
}

/** Mini-boss pool IDs, used for encounter 3 on non-boss floors. */
const MINI_BOSS_POOL = [
  'crystal_guardian',
  'venomfang',
  'stone_sentinel',
  'ember_drake',
  'shade_stalker',
  'bone_collector',
]

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
  if (seg === 2) return Math.random() < 0.5 ? 1 : 2
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
 * Picks from the mini-boss pool based on floor number for variety.
 */
export function getMiniBossForFloor(floor: number): string {
  // Use floor number to deterministically pick, with some randomness
  const idx = Math.floor(Math.random() * MINI_BOSS_POOL.length)
  return MINI_BOSS_POOL[idx]
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
  return Math.random() < EVENT_CHANCE_BY_SEGMENT[segment]
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
 * Pick a random combat enemy from the common pool for this floor's segment.
 * NOTE: Only call for encounters 1 and 2 (regular encounters).
 * Encounter 3 is always a mini-boss (via getMiniBossForFloor) or boss (via getBossForFloor).
 */
export function pickCombatEnemy(floor: number): string {
  const commonEnemies = ENEMY_TEMPLATES.filter(e => e.category === 'common')
  if (commonEnemies.length === 0) return 'cave_bat' // fallback
  const idx = Math.floor(Math.random() * commonEnemies.length)
  return commonEnemies[idx].id
}

/** Generate a random mystery event. */
export function generateMysteryEvent(): MysteryEvent {
  const idx = Math.floor(Math.random() * MYSTERY_EVENTS.length)
  // Return a deep-ish copy to avoid mutation
  return { ...MYSTERY_EVENTS[idx] }
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
}

// ============================================================
// Internal helpers
// ============================================================

/** Pick a room type based on weighted probabilities. */
function pickWeightedRoomType(weights: RoomWeight[]): RoomType {
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  let roll = Math.random() * total
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
      const template = ENEMY_TEMPLATES.find(e => e.id === enemyId)
      return {
        type: 'combat',
        icon: '\u2694\uFE0F', // ⚔️
        label: template?.name ?? 'Unknown Enemy',
        detail: `HP: ${template?.baseHP ?? '?'}`,
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
        detail: 'Heal 30% HP',
        hidden: false,
      }
    case 'treasure':
      return {
        type: 'treasure',
        icon: '\uD83C\uDF81', // 🎁
        label: 'Treasure',
        detail: 'Free card reward',
        hidden: false,
      }
    case 'shop':
      return {
        type: 'shop',
        icon: '\uD83D\uDED2', // 🛒
        label: 'Shop',
        detail: 'Buy/remove cards',
        hidden: false,
      }
  }
}
