/**
 * Background asset manifest for Recall Rogue.
 * Provides functions to get random background image paths for different game screens.
 * All paths reference WebP assets in `public/assets/backgrounds/`.
 */

import { getSegment } from '../services/floorManager'

// ============================================================
// Combat background pools by segment
// ============================================================

const COMBAT_SEGMENT_1 = [
  '/assets/backgrounds/combat/segment1/shallow-depths-01.webp',
  '/assets/backgrounds/combat/segment1/shallow-depths-02.webp',
  '/assets/backgrounds/combat/segment1/shallow-depths-03.webp',
  '/assets/backgrounds/combat/segment1/shallow-depths-04.webp',
  '/assets/backgrounds/combat/segment1/shallow-depths-05.webp',
]

const COMBAT_SEGMENT_2 = [
  '/assets/backgrounds/combat/segment2/deep-caverns-01.webp',
  '/assets/backgrounds/combat/segment2/deep-caverns-02.webp',
  '/assets/backgrounds/combat/segment2/deep-caverns-03.webp',
  '/assets/backgrounds/combat/segment2/deep-caverns-04.webp',
  '/assets/backgrounds/combat/segment2/deep-caverns-05.webp',
]

const COMBAT_SEGMENT_3 = [
  '/assets/backgrounds/combat/segment3/the-abyss-01.webp',
  '/assets/backgrounds/combat/segment3/the-abyss-02.webp',
  '/assets/backgrounds/combat/segment3/the-abyss-03.webp',
  '/assets/backgrounds/combat/segment3/the-abyss-04.webp',
  '/assets/backgrounds/combat/segment3/the-abyss-05.webp',
]

const COMBAT_SEGMENT_4 = [
  '/assets/backgrounds/combat/segment4/the-archive-01.webp',
  '/assets/backgrounds/combat/segment4/the-archive-02.webp',
  '/assets/backgrounds/combat/segment4/the-archive-03.webp',
  '/assets/backgrounds/combat/segment4/the-archive-04.webp',
  '/assets/backgrounds/combat/segment4/the-archive-05.webp',
]

const COMBAT_SEGMENT_5 = [
  '/assets/backgrounds/combat/segment5/endless-void-01.webp',
  '/assets/backgrounds/combat/segment5/endless-void-02.webp',
  '/assets/backgrounds/combat/segment5/endless-void-03.webp',
  '/assets/backgrounds/combat/segment5/endless-void-04.webp',
  '/assets/backgrounds/combat/segment5/endless-void-05.webp',
]

const COMBAT_BOSS = [
  '/assets/backgrounds/combat/boss/boss-arena-01.webp',
  '/assets/backgrounds/combat/boss/boss-arena-02.webp',
  '/assets/backgrounds/combat/boss/boss-arena-03.webp',
  '/assets/backgrounds/combat/boss/boss-arena-04.webp',
  '/assets/backgrounds/combat/boss/boss-arena-05.webp',
]

// ============================================================
// Room background pools
// ============================================================

const ROOM_HALLWAY = [
  '/assets/backgrounds/rooms/hallway/hallway-01.webp',
  '/assets/backgrounds/rooms/hallway/hallway-02.webp',
  '/assets/backgrounds/rooms/hallway/hallway-03.webp',
  '/assets/backgrounds/rooms/hallway/hallway-04.webp',
  '/assets/backgrounds/rooms/hallway/hallway-05.webp',
]

const ROOM_REST = [
  '/assets/backgrounds/rooms/rest/rest-campfire-01.webp',
  '/assets/backgrounds/rooms/rest/rest-campfire-02.webp',
  '/assets/backgrounds/rooms/rest/rest-campfire-03.webp',
  '/assets/backgrounds/rooms/rest/rest-campfire-04.webp',
  '/assets/backgrounds/rooms/rest/rest-campfire-05.webp',
]

const ROOM_SHOP = [
  '/assets/backgrounds/rooms/shop/shop-merchant-01.webp',
  '/assets/backgrounds/rooms/shop/shop-merchant-02.webp',
  '/assets/backgrounds/rooms/shop/shop-merchant-03.webp',
  '/assets/backgrounds/rooms/shop/shop-merchant-04.webp',
  '/assets/backgrounds/rooms/shop/shop-merchant-05.webp',
]

const ROOM_MYSTERY = [
  '/assets/backgrounds/rooms/mystery/mystery-arcane-01.webp',
  '/assets/backgrounds/rooms/mystery/mystery-arcane-02.webp',
  '/assets/backgrounds/rooms/mystery/mystery-arcane-03.webp',
  '/assets/backgrounds/rooms/mystery/mystery-arcane-04.webp',
  '/assets/backgrounds/rooms/mystery/mystery-arcane-05.webp',
]

const ROOM_TREASURE = [
  '/assets/backgrounds/rooms/treasure/treasure-cache-01.webp',
  '/assets/backgrounds/rooms/treasure/treasure-cache-02.webp',
  '/assets/backgrounds/rooms/treasure/treasure-cache-03.webp',
  '/assets/backgrounds/rooms/treasure/treasure-cache-04.webp',
  '/assets/backgrounds/rooms/treasure/treasure-cache-05.webp',
]

const ROOM_CROSSROADS = [
  '/assets/backgrounds/rooms/crossroads/crossroads-01.webp',
  '/assets/backgrounds/rooms/crossroads/crossroads-02.webp',
  '/assets/backgrounds/rooms/crossroads/crossroads-03.webp',
  '/assets/backgrounds/rooms/crossroads/crossroads-04.webp',
]

const ROOM_DESCENT = [
  '/assets/backgrounds/rooms/descent/descent-01.webp',
  '/assets/backgrounds/rooms/descent/descent-02.webp',
  '/assets/backgrounds/rooms/descent/descent-03.webp',
  '/assets/backgrounds/rooms/descent/descent-04.webp',
  '/assets/backgrounds/rooms/descent/descent-05.webp',
]

// ============================================================
// Screen background pools
// ============================================================

const SCREEN_DEFEAT = [
  '/assets/backgrounds/screens/defeat/defeat-01.webp',
  '/assets/backgrounds/screens/defeat/defeat-02.webp',
  '/assets/backgrounds/screens/defeat/defeat-03.webp',
  '/assets/backgrounds/screens/defeat/defeat-04.webp',
  '/assets/backgrounds/screens/defeat/defeat-05.webp',
]

const SCREEN_VICTORY = [
  '/assets/backgrounds/screens/victory/victory-01.webp',
  '/assets/backgrounds/screens/victory/victory-02.webp',
  '/assets/backgrounds/screens/victory/victory-03.webp',
]

// ============================================================
// Exported functions
// ============================================================

/**
 * Pick a random combat background path based on floor and boss status.
 * For boss encounters, always uses the boss arena pool.
 * For regular encounters, uses the segment-appropriate pool:
 * - Floors 1-6: Segment 1 (Shallow Depths)
 * - Floors 7-12: Segment 2 (Deep Caverns)
 * - Floors 13-18: Segment 3 (The Abyss)
 * - Floors 19-24: Segment 4 (The Archive)
 * - Floors 25+: Segment 5 (Endless Void)
 *
 * @param floor The current floor number
 * @param isBoss Whether this is a boss encounter
 * @returns A random WebP background path
 */
export function getRandomCombatBg(floor: number, isBoss: boolean): string {
  if (isBoss) {
    return pickRandom(COMBAT_BOSS)
  }

  if (floor > 24) {
    return pickRandom(COMBAT_SEGMENT_5)
  }

  const segment = getSegment(floor)
  switch (segment) {
    case 1:
      return pickRandom(COMBAT_SEGMENT_1)
    case 2:
      return pickRandom(COMBAT_SEGMENT_2)
    case 3:
      return pickRandom(COMBAT_SEGMENT_3)
    case 4:
      return pickRandom(COMBAT_SEGMENT_4)
  }
}

/**
 * Pick a random room background path by room type.
 * Each room type has a dedicated set of background variations.
 *
 * @param roomType The type of room ('hallway', 'rest', 'shop', 'mystery', 'treasure', 'crossroads', or 'descent')
 * @returns A random WebP background path
 */
export function getRandomRoomBg(
  roomType: 'hallway' | 'rest' | 'shop' | 'mystery' | 'treasure' | 'crossroads' | 'descent'
): string {
  switch (roomType) {
    case 'hallway':
      return pickRandom(ROOM_HALLWAY)
    case 'rest':
      return pickRandom(ROOM_REST)
    case 'shop':
      return pickRandom(ROOM_SHOP)
    case 'mystery':
      return pickRandom(ROOM_MYSTERY)
    case 'treasure':
      return pickRandom(ROOM_TREASURE)
    case 'crossroads':
      return pickRandom(ROOM_CROSSROADS)
    case 'descent':
      return pickRandom(ROOM_DESCENT)
  }
}

/**
 * Pick a random screen background path by screen type.
 * Used for defeat and victory splash screens.
 *
 * @param screenType The type of screen ('defeat' or 'victory')
 * @returns A random WebP background path
 */
export function getRandomScreenBg(screenType: 'defeat' | 'victory'): string {
  switch (screenType) {
    case 'defeat':
      return pickRandom(SCREEN_DEFEAT)
    case 'victory':
      return pickRandom(SCREEN_VICTORY)
  }
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Pick a random element from an array.
 * @param array The array to pick from
 * @returns A random element
 */
function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}
