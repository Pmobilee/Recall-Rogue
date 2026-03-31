/**
 * Resolves light source configurations for backgrounds.
 * Priority: manifest entry > theme defaults from roomAtmosphere.ts.
 */

import { LIGHT_SOURCE_MANIFEST, DEFAULT_FLICKER, type BackgroundLightConfig, type BackgroundLightSource, type LightSourceType } from './lightSourceManifest'
import { getAtmosphereConfig, type AtmosphereConfig } from './roomAtmosphere'

type Orientation = 'portrait' | 'landscape'

/**
 * Resolve light config for a combat enemy background.
 * Returns the manifest entry if available. For non-manifest enemies, returns
 * empty lights — the DepthLightingSystem will add a synthetic overhead instead.
 * (Theme-based fallback positions don't match actual backgrounds and look wrong.)
 */
export function resolveCombatLights(
  enemyId: string,
  _floor: number,
  orientation: Orientation,
): BackgroundLightConfig {
  const entry = LIGHT_SOURCE_MANIFEST.enemies[enemyId]
  if (entry) return entry[orientation]
  return { lights: [] }
}

/**
 * Resolve light config for a room background.
 */
export function resolveRoomLights(
  roomType: string,
  floor: number,
  orientation: Orientation,
): BackgroundLightConfig {
  const entry = LIGHT_SOURCE_MANIFEST.rooms[roomType]
  if (entry) return entry[orientation]
  return themeToBackgroundConfig(getAtmosphereConfig(floor))
}

/**
 * Resolve light config for a mystery event background.
 */
export function resolveMysteryLights(
  eventId: string,
  floor: number,
  orientation: Orientation,
): BackgroundLightConfig {
  const entry = LIGHT_SOURCE_MANIFEST.mystery[eventId]
  if (entry) return entry[orientation]
  // Fall back to generic mystery room, then theme
  const roomEntry = LIGHT_SOURCE_MANIFEST.rooms['mystery']
  if (roomEntry) return roomEntry[orientation]
  return themeToBackgroundConfig(getAtmosphereConfig(floor))
}

/**
 * Get the default flicker params for a light source type,
 * or the light's flickerOverride if set.
 */
export function getFlickerForLight(light: BackgroundLightSource): { strength: number; speed: number } {
  return light.flickerOverride ?? DEFAULT_FLICKER[light.type]
}

/**
 * Convert a theme's generic lighting block to BackgroundLightConfig.
 * Used as fallback when no manifest entry exists.
 */
function themeToBackgroundConfig(atm: AtmosphereConfig): BackgroundLightConfig {
  return {
    lights: atm.lighting.lights.map(l => ({
      x: l.xPct,
      y: l.yPct,
      z: 0.5,
      radius: l.radius / 1000,
      color: l.color,
      intensity: l.intensity,
      type: 'torch' as LightSourceType,
      ...(l.flicker ? { flickerOverride: { strength: l.flicker, speed: 3.0 } } : {}),
    })),
  }
}
