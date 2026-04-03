/**
 * Pet Waypoint System
 *
 * Defines named patrol destinations for the pet on the hub screen.
 * Positions are expressed as percentages of the hub-center container so they
 * scale correctly at any resolution alongside the `--layout-scale` system.
 *
 * Waypoint attraction weights drive the weighted-random next-destination
 * selection, biasing the pet toward points of interest (campfire, character).
 *
 * All waypoints are ground-level and clear of all interactive hub elements.
 * Exclusion zones define rectangular no-go areas matching the actual hitboxes
 * of hub screen elements (campfire, character, journal, quest board, etc.) with
 * 3% padding, ensuring the cat stays visually clear of all interactables.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A named destination the pet can walk toward on the hub screen. */
export interface PetWaypoint {
  id: string
  /** Horizontal position as a percentage of the hub-center container width (0–100). */
  x: number
  /** Vertical position as a percentage of the hub-center container height (0–100). */
  y: number
  /** True if this waypoint is adjacent to the campfire — enables sleep/sit weight bonus. */
  nearCampfire: boolean
  /**
   * Base multiplier used during weighted-random selection.
   * 1.0 is neutral; below_campfire uses 2.0 to bias the pet toward the warmth.
   */
  attractionWeight: number
}

/** Rectangular exclusion zone the pet must not enter (% of hub-center). */
export interface ExclusionZone {
  id: string
  /** Left edge X% */
  x1: number
  /** Top edge Y% */
  y1: number
  /** Right edge X% */
  x2: number
  /** Bottom edge Y% */
  y2: number
}

// ---------------------------------------------------------------------------
// Exclusion zones
// ---------------------------------------------------------------------------

/**
 * Rectangular no-go areas derived from hub screen element hitboxes with 3% padding.
 * Original hitboxes come from HubScreen.svelte CSS percentage positioning.
 *
 * | Element    | Original X      | Original Y      |
 * |------------|-----------------|-----------------|
 * | Campfire   | 38% → 56%       | 55% → 79%       |
 * | Character  | 54% → 75%       | 58% → 69%       |
 * | Journal    | 5% → 28%        | 76% → 85%       |
 * | Quest Board| 72% → 98%       | 75% → 95%       |
 * | Shop       | 2% → 18%        | 52% → 65%       |
 * | Doorway    | 11% → 55%       | 28% → 55%       |
 * | Library    | 2% → 34%        | 31% → 54%       |
 * | Tent       | 90% → 100%      | 40% → 60%       |
 * | Settings   | 76% → 92%       | 29% → 47%       |
 */
export const EXCLUSION_ZONES: ExclusionZone[] = [
  { id: 'campfire',    x1: 35, y1: 52, x2: 59, y2: 82 },
  { id: 'character',   x1: 51, y1: 55, x2: 78, y2: 72 },
  { id: 'journal',     x1: 2,  y1: 73, x2: 31, y2: 88 },
  { id: 'quest_board', x1: 69, y1: 72, x2: 100, y2: 98 },
  { id: 'shop',        x1: 0,  y1: 49, x2: 21, y2: 68 },
  { id: 'doorway',     x1: 8,  y1: 25, x2: 58, y2: 58 },
  { id: 'library',     x1: 0,  y1: 28, x2: 37, y2: 57 },
  { id: 'tent',        x1: 87, y1: 37, x2: 100, y2: 63 },
  { id: 'settings',    x1: 73, y1: 26, x2: 95, y2: 50 },
]

/**
 * Check if a point (x, y) expressed as hub-center percentages is inside any exclusion zone.
 *
 * @param x - Horizontal position 0–100
 * @param y - Vertical position 0–100
 * @returns True if the point falls inside at least one exclusion zone
 */
export function isInsideExclusion(x: number, y: number): boolean {
  return EXCLUSION_ZONES.some(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2)
}

/**
 * Push a point outside the nearest edge of whichever exclusion zone it occupies.
 * If the point is not inside any zone, returns it unchanged.
 *
 * Uses shortest-distance-to-edge heuristic — always moves the minimum distance
 * to escape the zone. Only fixes the first matching zone; caller re-checks as needed.
 *
 * @param x - Horizontal position 0–100
 * @param y - Vertical position 0–100
 * @returns Adjusted { x, y } guaranteed to be outside the zone it was in
 */
export function pushOutOfExclusion(x: number, y: number): { x: number; y: number } {
  let pos = { x, y }
  // Loop up to 10 times to escape overlapping zones
  for (let attempt = 0; attempt < 10; attempt++) {
    let escaped = true
    for (const z of EXCLUSION_ZONES) {
      if (pos.x >= z.x1 && pos.x <= z.x2 && pos.y >= z.y1 && pos.y <= z.y2) {
        // Push toward the edge that moves DOWNWARD (y+) — the ground is always below
        // This prevents ping-ponging between adjacent zones by always escaping the same direction
        const distDown = z.y2 - pos.y
        const distLeft = pos.x - z.x1
        const distRight = z.x2 - pos.x

        // Prefer going down (toward safe ground), then whichever side is closer
        if (distDown <= Math.min(distLeft, distRight) + 5) {
          pos = { x: pos.x, y: z.y2 + 1 }
        } else if (distLeft < distRight) {
          pos = { x: z.x1 - 1, y: pos.y }
        } else {
          pos = { x: z.x2 + 1, y: pos.y }
        }
        escaped = false
        break // re-check all zones from the new position
      }
    }
    if (escaped) break
  }
  return pos
}

// ---------------------------------------------------------------------------
// Waypoint definitions
// ---------------------------------------------------------------------------

/**
 * All hub waypoints keyed by their id.
 * Positions tuned for the default 1920×1080 hub layout — expressed as
 * percentage of the hub-center container so they remain correct at any scale.
 *
 * All waypoints are verified clear of all exclusion zones:
 * - Safe ground strip: Y 83–88%, X 32–68% (below campfire/character cluster)
 * - Side patrol points: clear of shop, library, tent, quest board
 */
export const HUB_WAYPOINTS: Record<string, PetWaypoint> = {
  // Below campfire — main resting spot (nearCampfire for sleep/sit bias)
  below_campfire: {
    id: 'below_campfire',
    x: 47,
    y: 84,
    nearCampfire: true,
    attractionWeight: 2.0,
  },
  // Left of campfire, below shop/library dead zone
  ground_left: {
    id: 'ground_left',
    x: 22,
    y: 70,
    nearCampfire: false,
    attractionWeight: 0.8,
  },
  // Between journal and campfire on the bottom strip
  ground_center_left: {
    id: 'ground_center_left',
    x: 33,
    y: 85,
    nearCampfire: false,
    attractionWeight: 0.6,
  },
  // Right of campfire, below character
  ground_center_right: {
    id: 'ground_center_right',
    x: 62,
    y: 85,
    nearCampfire: false,
    attractionWeight: 0.6,
  },
  // Right side, between character and quest board
  ground_right: {
    id: 'ground_right',
    x: 80,
    y: 70,
    nearCampfire: false,
    attractionWeight: 0.8,
  },
  // Far right patrol — just below character zone (y>72), left of quest board (x<69)
  patrol_far_right: {
    id: 'patrol_far_right',
    x: 68,
    y: 73,
    nearCampfire: false,
    attractionWeight: 0.4,
  },
}

// Validate all waypoints are outside exclusion zones (dev assertion)
for (const wp of Object.values(HUB_WAYPOINTS)) {
  if (isInsideExclusion(wp.x, wp.y)) {
    console.error(`[PET] Waypoint "${wp.id}" at (${wp.x}, ${wp.y}) is inside an exclusion zone!`)
  }
}

// ---------------------------------------------------------------------------
// Selection logic
// ---------------------------------------------------------------------------

/**
 * Pick the next waypoint using weighted random selection.
 *
 * Rules:
 * - The current waypoint is always excluded.
 * - Each of the last 3 recently-visited waypoints has its effective weight
 *   reduced to 0.3× its base attraction weight (discourages back-and-forth).
 * - below_campfire retains its 2.0 base weight regardless of recency (only the
 *   recency penalty can reduce it, not a separate cap).
 *
 * @param currentId - ID of the waypoint the pet is currently at
 * @param recentlyVisited - IDs of up to 3 recently visited waypoints (oldest first)
 * @returns ID of the selected next waypoint
 */
export function pickNextWaypoint(currentId: string, recentlyVisited: string[]): string {
  const recentSet = new Set(recentlyVisited.slice(-3))

  // Build candidate list with effective weights
  const candidates: Array<{ id: string; weight: number }> = []

  for (const waypoint of Object.values(HUB_WAYPOINTS)) {
    if (waypoint.id === currentId) continue

    let weight = waypoint.attractionWeight
    if (recentSet.has(waypoint.id)) {
      weight *= 0.3
    }

    candidates.push({ id: waypoint.id, weight })
  }

  if (candidates.length === 0) {
    // Fallback: return below_campfire if somehow no candidates exist
    return 'below_campfire'
  }

  // Weighted random selection
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0)
  let roll = Math.random() * totalWeight

  for (const candidate of candidates) {
    roll -= candidate.weight
    if (roll <= 0) {
      return candidate.id
    }
  }

  // Floating point safety: return last candidate
  return candidates[candidates.length - 1].id
}
