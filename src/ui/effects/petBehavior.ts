/**
 * Pet Behavior State Machine
 *
 * Pure-function state machine for the animated hub pet. All functions are
 * side-effect-free and accept/return plain state objects — fully testable
 * without a DOM, canvas, or Phaser context.
 *
 * The driving loop (AnimatedPet.svelte) calls `tickPet()` each animation frame
 * and applies the returned state to its reactive variables.
 *
 * Walk speed is ~1.8 percentage-units per second (in hub-container % coords).
 *
 * Collision avoidance: during walk interpolation, the new position is checked
 * against EXCLUSION_ZONES (hub element hitboxes + 3% padding). If the pet
 * enters a zone it is immediately pushed to the nearest edge. This keeps the
 * cat visually clear of all interactive hub screen elements.
 */

import type { PetBehavior, PetAnimationConfig } from '../../data/petAnimations'
import { HUB_WAYPOINTS, pickNextWaypoint, isInsideExclusion, pushOutOfExclusion } from '../../data/petWaypoints'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Full runtime state of the pet. Immutable — every mutation returns a new object. */
export interface PetState {
  /** Current animation/behavior. */
  behavior: PetBehavior
  /** Position as percentage of hub-center container (0–100 each axis). */
  position: { x: number; y: number }
  /** ID of the waypoint the pet is walking toward, or null if not walking. */
  targetWaypoint: string | null
  /** ID of the last waypoint the pet reached (or start waypoint). */
  currentWaypoint: string
  /** True when the pet sprite should be flipped horizontally. */
  facingLeft: boolean
  /** Current frame index within the active animation strip (0-based). */
  frame: number
  /** Accumulated milliseconds toward the next frame step. */
  frameTimer: number
  /** Milliseconds remaining before the current behavior ends and transitions. */
  stateTimer: number
  /** Saved behavior before a 'react' interrupt — restored after react completes. */
  previousBehavior: PetBehavior
  /** IDs of the last 3 visited waypoints, oldest first, for variety. */
  recentWaypoints: string[]
  /** Consecutive ticks where walk was blocked by an exclusion zone. */
  stuckCounter: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Min/max duration ranges per behavior in milliseconds. [min, max] */
const BEHAVIOR_DURATIONS: Record<PetBehavior, [number, number]> = {
  idle:  [5000, 15000],   // longer idle rests
  walk:  [0, 0],          // Duration determined by travel distance, not this table
  sit:   [8000, 20000],   // sit for a while
  lick:  [4000, 8000],    // groom longer
  sleep: [15000, 30000],  // long naps
  react: [1000, 1000],    // Fixed duration
}

/**
 * Weighted transition table: TRANSITIONS[from][to] = relative weight.
 * 'react' is never a spontaneous destination; it's triggered by external events.
 * Walk transitions imply: pick a new waypoint and start walking.
 */
const TRANSITIONS: Record<PetBehavior, Record<PetBehavior, number>> = {
  idle:  { idle: 0.10, walk: 0.30, sit: 0.25, lick: 0.20, sleep: 0.15, react: 0 },
  walk:  { idle: 0.50, walk: 0.00, sit: 0.30, lick: 0.00, sleep: 0.20, react: 0 },
  sit:   { idle: 0.40, walk: 0.20, sit: 0.00, lick: 0.30, sleep: 0.10, react: 0 },
  lick:  { idle: 0.50, walk: 0.20, sit: 0.30, lick: 0.00, sleep: 0.00, react: 0 },
  sleep: { idle: 0.60, walk: 0.00, sit: 0.40, lick: 0.00, sleep: 0.00, react: 0 },
  react: { idle: 0,    walk: 0,    sit: 0,    lick: 0,    sleep: 0,    react: 0 },
}

/** Walk speed in percentage-units per millisecond (1.8%/sec = 0.0018 %/ms — relaxed stroll). */
const WALK_SPEED_PER_MS = 0.0018

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sample a random duration (ms) within the range for a given behavior.
 * Returns 0 for 'walk' (walk duration is distance-driven).
 */
function randomDuration(behavior: PetBehavior): number {
  const [min, max] = BEHAVIOR_DURATIONS[behavior]
  if (min === max) return min
  return min + Math.random() * (max - min)
}

/**
 * Perform weighted random selection over the behaviors in a row of TRANSITIONS.
 * Optionally boosts sleep and sit weights when near the campfire.
 *
 * @param weights - Map of behavior → weight
 * @param nearCampfire - When true, sleep and sit weights are multiplied by 1.5
 * @returns The selected PetBehavior
 */
function weightedPickBehavior(
  weights: Record<PetBehavior, number>,
  nearCampfire: boolean,
): PetBehavior {
  const adjusted: Record<string, number> = {}
  let total = 0

  for (const [beh, w] of Object.entries(weights) as Array<[PetBehavior, number]>) {
    let effective = w
    if (nearCampfire && (beh === 'sleep' || beh === 'sit')) {
      effective *= 1.5
    }
    adjusted[beh] = effective
    total += effective
  }

  if (total === 0) return 'idle'

  let roll = Math.random() * total
  for (const [beh, w] of Object.entries(adjusted) as Array<[PetBehavior, number]>) {
    roll -= w
    if (roll <= 0) return beh as PetBehavior
  }

  // Floating point safety
  return 'idle'
}

/**
 * Execute a behavior transition from the given behavior.
 * If the transition selects 'walk', a new waypoint is picked and the walk state returned.
 * Otherwise, a timed state is returned with a fresh stateTimer.
 *
 * @param fromBehavior - The behavior that just ended (used as 'previousBehavior' in the new state)
 * @param currentWaypoint - The waypoint the pet is currently at
 * @param position - Current position (percentage coords)
 * @param frame - Current animation frame
 * @param frameTimer - Current frame timer
 * @param facingLeft - Current facing direction
 * @param recentWaypoints - Recently visited waypoints for variety selection
 * @param previousBehavior - The behavior before fromBehavior (for react recovery chain)
 * @param baseState - The full current state (used for spread)
 */
function executeTransition(
  fromBehavior: PetBehavior,
  currentWaypoint: string,
  position: { x: number; y: number },
  frame: number,
  frameTimer: number,
  facingLeft: boolean,
  recentWaypoints: string[],
  previousBehavior: PetBehavior,
  baseState: PetState,
): PetState {
  const nearCampfire = HUB_WAYPOINTS[currentWaypoint]?.nearCampfire ?? false
  const nextBehavior = selectNextBehavior(fromBehavior, nearCampfire, previousBehavior)

  if (nextBehavior === 'walk') {
    const nextWaypointId = pickNextWaypoint(currentWaypoint, recentWaypoints)
    const nextWaypoint = HUB_WAYPOINTS[nextWaypointId]
    if (nextWaypoint) {
      const newFacingLeft = nextWaypoint.x < position.x
      return {
        ...baseState,
        behavior: 'walk',
        frame: 0,
        frameTimer: 0,
        stateTimer: 0,
        targetWaypoint: nextWaypointId,
        currentWaypoint,
        facingLeft: newFacingLeft,
        position,
        recentWaypoints,
        previousBehavior: fromBehavior,
      }
    }
    // Fallback: if waypoint lookup fails, default to idle
  }

  return {
    ...baseState,
    behavior: nextBehavior === 'walk' ? 'idle' : nextBehavior,
    frame: 0,
    frameTimer: 0,
    stateTimer: randomDuration(nextBehavior === 'walk' ? 'idle' : nextBehavior),
    targetWaypoint: null,
    currentWaypoint,
    facingLeft,
    position,
    recentWaypoints,
    previousBehavior: fromBehavior,
  }
}

// ---------------------------------------------------------------------------
// Public API — pure functions
// ---------------------------------------------------------------------------

/**
 * Create the initial PetState. The pet starts below the campfire in idle behavior.
 *
 * @param startWaypoint - Waypoint id to start at (defaults to 'below_campfire')
 * @returns A fresh PetState ready to pass into tickPet
 */
export function createInitialPetState(startWaypoint = 'below_campfire'): PetState {
  const waypoint = HUB_WAYPOINTS[startWaypoint] ?? HUB_WAYPOINTS['below_campfire']
  return {
    behavior: 'idle',
    position: { x: waypoint.x, y: waypoint.y },
    targetWaypoint: null,
    currentWaypoint: waypoint.id,
    facingLeft: false,
    frame: 0,
    frameTimer: 0,
    stateTimer: randomDuration('idle'),
    previousBehavior: 'idle',
    recentWaypoints: [],
    stuckCounter: 0,
  }
}

/**
 * Advance the pet simulation by one frame delta.
 *
 * Each call:
 * 1. Steps the animation frame counter based on frameDuration.
 * 2. Moves the pet toward its target waypoint if behavior is 'walk'.
 *    - After each position update, checks collision with exclusion zones and
 *      pushes the pet out of any zone it has entered.
 *    - On arrival, immediately transitions to the next behavior.
 * 3. Decrements stateTimer; triggers a behavior transition when it expires.
 *
 * This function is pure — it never mutates the input state.
 *
 * @param state - Current pet state
 * @param deltaMs - Time elapsed since last tick in milliseconds
 * @param animConfig - Animation config for the pet's current behavior
 * @returns New PetState after the tick
 */
export function tickPet(
  state: PetState,
  deltaMs: number,
  animConfig: PetAnimationConfig,
): PetState {
  let { frame, frameTimer, stateTimer, position, behavior,
        targetWaypoint, currentWaypoint, facingLeft, recentWaypoints,
        previousBehavior } = state

  // --- 1. Advance animation frame ---
  frameTimer += deltaMs
  while (frameTimer >= animConfig.frameDuration) {
    frameTimer -= animConfig.frameDuration
    if (animConfig.loop) {
      frame = (frame + 1) % animConfig.frameCount
    } else {
      frame = Math.min(frame + 1, animConfig.frameCount - 1)
    }
  }

  // --- 2. Walk interpolation ---
  if (behavior === 'walk' && targetWaypoint !== null) {
    const target = HUB_WAYPOINTS[targetWaypoint]
    if (target) {
      const dx = target.x - position.x
      const dy = target.y - position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const step = WALK_SPEED_PER_MS * deltaMs

      if (dist <= step) {
        // Arrived at waypoint — update position/waypoint tracking then immediately transition
        const arrivedPosition = { x: target.x, y: target.y }
        const arrivedRecentWaypoints = [...recentWaypoints.slice(-2), targetWaypoint]
        const arrivedWaypoint = targetWaypoint

        return executeTransition(
          'walk',
          arrivedWaypoint,
          arrivedPosition,
          0,
          0,
          facingLeft,
          arrivedRecentWaypoints,
          previousBehavior,
          {
            ...state,
            position: arrivedPosition,
            currentWaypoint: arrivedWaypoint,
            recentWaypoints: arrivedRecentWaypoints,
            targetWaypoint: null,
          },
        )
      } else {
        // Interpolate toward target
        const norm = step / dist
        let newX = position.x + dx * norm
        let newY = position.y + dy * norm

        // Collision avoidance: push out of any hub element exclusion zone
        let wasBlocked = false
        if (isInsideExclusion(newX, newY)) {
          const pushed = pushOutOfExclusion(newX, newY)
          newX = pushed.x
          newY = pushed.y
          wasBlocked = true
        }

        // Track consecutive blocked ticks — if stuck for 30+ ticks, abandon walk
        const newStuckCounter = wasBlocked ? (state.stuckCounter + 1) : 0
        if (newStuckCounter > 30) {
          // Stuck — give up on this walk, transition to idle at current safe position
          return executeTransition(
            'walk',
            currentWaypoint,
            { x: newX, y: newY },
            0, 0, facingLeft, recentWaypoints, previousBehavior,
            { ...state, position: { x: newX, y: newY }, targetWaypoint: null, stuckCounter: 0 },
          )
        }

        position = { x: newX, y: newY }

        // Return early — no timer logic needed mid-walk
        return {
          ...state,
          frame,
          frameTimer,
          position,
          facingLeft,
          stateTimer,
          targetWaypoint,
          currentWaypoint,
          recentWaypoints,
          previousBehavior,
          stuckCounter: newStuckCounter,
        }
      }
    }
  }

  // --- 3. Decrement state timer ---
  stateTimer -= deltaMs

  // --- 4. Transition when timer expires ---
  if (stateTimer <= 0) {
    return executeTransition(
      behavior,
      currentWaypoint,
      position,
      frame,
      frameTimer,
      facingLeft,
      recentWaypoints,
      previousBehavior,
      { ...state, frame, frameTimer, position, stateTimer, currentWaypoint, recentWaypoints },
    )
  }

  return {
    ...state,
    frame,
    frameTimer,
    stateTimer,
    position,
    facingLeft,
    targetWaypoint,
    currentWaypoint,
    recentWaypoints,
    previousBehavior,
  }
}

/**
 * Select the next behavior via weighted random transition.
 *
 * Special cases:
 * - 'react' always returns previousBehavior (the interrupted behavior).
 * - nearCampfire boosts sleep and sit weights by 1.5×.
 * - 'react' is never returned as a spontaneous next behavior (weight 0 in table).
 *
 * @param currentBehavior - The behavior that just ended
 * @param nearCampfire - Whether the pet is near the campfire
 * @param previousBehavior - The behavior before the current one (used for react return)
 * @returns The next PetBehavior to enter
 */
export function selectNextBehavior(
  currentBehavior: PetBehavior,
  nearCampfire: boolean,
  previousBehavior: PetBehavior = 'idle',
): PetBehavior {
  if (currentBehavior === 'react') {
    return previousBehavior
  }
  return weightedPickBehavior(TRANSITIONS[currentBehavior], nearCampfire)
}

/**
 * Trigger a one-shot 'react' animation (e.g. on player click/tap).
 *
 * Saves the current behavior so it can be restored after the react animation
 * completes. The react state duration is fixed at 1000ms.
 *
 * @param state - Current pet state
 * @returns New PetState with behavior = 'react'
 */
export function triggerReact(state: PetState): PetState {
  return {
    ...state,
    previousBehavior: state.behavior,
    behavior: 'react',
    frame: 0,
    frameTimer: 0,
    stateTimer: BEHAVIOR_DURATIONS['react'][0],
  }
}

/**
 * Begin walking toward a specific waypoint.
 *
 * Sets up the walk state and updates facingLeft based on the direction of travel.
 * The caller is responsible for supplying a valid targetWaypointId from HUB_WAYPOINTS.
 *
 * @param state - Current pet state
 * @param targetWaypointId - ID of the waypoint to walk toward
 * @param targetPos - Position of the target (percentage coords)
 * @returns New PetState with behavior = 'walk'
 */
export function startWalk(
  state: PetState,
  targetWaypointId: string,
  targetPos: { x: number; y: number },
): PetState {
  const facingLeft = targetPos.x < state.position.x
  return {
    ...state,
    behavior: 'walk',
    targetWaypoint: targetWaypointId,
    facingLeft,
    frame: 0,
    frameTimer: 0,
    stateTimer: 0,
    previousBehavior: state.behavior,
  }
}
