/**
 * Background asset manifest for Recall Rogue.
 * Provides functions to get random background image paths for different game screens.
 * All paths reference WebP assets in `public/assets/backgrounds/`.
 */

// ============================================================
// Combat background fallback
// ============================================================

/** Fallback combat background — used only if a per-enemy background is missing. */
const FALLBACK_COMBAT_BG = '/assets/backgrounds/combat/enemies/page_flutter/portrait.webp'

// ============================================================
// Exported functions
// ============================================================

/**
 * Return the current viewport orientation.
 * Portrait = width/height < 1 (taller than wide).
 * Landscape = width/height >= 1 (wider than tall).
 */
function getOrientation(): 'portrait' | 'landscape' {
  return window.innerWidth / window.innerHeight < 1 ? 'portrait' : 'landscape'
}

/**
 * Get the combat background path for a specific enemy.
 * Selects portrait or landscape variant based on the current viewport orientation.
 * Returns a path under `/assets/backgrounds/combat/enemies/{enemyId}/{orientation}.webp`.
 *
 * @param enemyId The template ID of the enemy (e.g. 'slime', 'cave-troll')
 * @returns A WebP background path sized for the current orientation
 */
export function getCombatBgForEnemy(enemyId: string): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/combat/enemies/${enemyId}/${orientation}.webp`
}

/**
 * Get the depth map URL for a combat background.
 *
 * @param enemyId The template ID of the enemy
 * @returns A WebP depth map path sized for the current orientation
 */
export function getCombatDepthMap(enemyId: string): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/combat/enemies/${enemyId}/${orientation}_depth.webp`
}

/**
 * @deprecated Legacy fallback. Use getCombatBgForEnemy() instead.
 */
export function getRandomCombatBg(_floor: number, _isBoss: boolean): string {
  return FALLBACK_COMBAT_BG
}

/**
 * Get an orientation-aware room background path by room type.
 * Returns `/assets/backgrounds/rooms/{roomType}/{orientation}.webp`.
 *
 * @param roomType The type of room
 * @returns A WebP background path sized for the current orientation
 */
export function getRandomRoomBg(
  roomType: 'rest' | 'shop' | 'mystery' | 'treasure' | 'descent' | 'hallway' | 'crossroads'
): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/rooms/${roomType}/${orientation}.webp`
}

/**
 * Get an orientation-aware screen background path by screen type.
 * Returns `/assets/backgrounds/screens/{screenType}/{orientation}.webp`.
 *
 * @param screenType The type of screen ('defeat' or 'victory')
 * @returns A WebP background path sized for the current orientation
 */
export function getRandomScreenBg(screenType: 'defeat' | 'victory'): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/screens/${screenType}/${orientation}.webp`
}

/**
 * Get an orientation-aware menu background path.
 * Returns `/assets/backgrounds/menu/{orientation}.webp`.
 *
 * @returns A WebP background path sized for the current orientation
 */
export function getMenuBg(): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/menu/${orientation}.webp`
}

/**
 * Get the depth map URL corresponding to a room background.
 * The depth map is a grayscale WebP (bright=near, dark=far) used by ParallaxTransition.
 *
 * @param roomType The type of room
 * @returns A WebP depth map path sized for the current orientation
 */
export function getRoomDepthMap(
  roomType: 'rest' | 'shop' | 'mystery' | 'treasure' | 'descent' | 'hallway' | 'crossroads'
): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/rooms/${roomType}/${orientation}_depth.webp`
}

/**
 * Get the depth map URL for the menu background.
 */
export function getMenuDepthMap(): string {
  const orientation = getOrientation()
  return `/assets/backgrounds/menu/${orientation}_depth.webp`
}
