/**
 * Unit tests for petBehavior.ts — pure state machine functions.
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialPetState,
  tickPet,
  selectNextBehavior,
  triggerReact,
  startWalk,
  type PetState,
} from './petBehavior'
import { HUB_WAYPOINTS, isInsideExclusion, pushOutOfExclusion, EXCLUSION_ZONES } from '../../data/petWaypoints'
import type { PetAnimationConfig } from '../../data/petAnimations'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnimConfig(overrides: Partial<PetAnimationConfig> = {}): PetAnimationConfig {
  return {
    frameCount: 6,
    frameDuration: 200,
    loop: true,
    frameWidth: 64,
    frameHeight: 64,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createInitialPetState
// ---------------------------------------------------------------------------

describe('createInitialPetState', () => {
  it('returns a valid state at below_campfire by default', () => {
    const state = createInitialPetState()
    expect(state.behavior).toBe('idle')
    expect(state.currentWaypoint).toBe('below_campfire')
    expect(state.targetWaypoint).toBeNull()
    expect(state.frame).toBe(0)
    expect(state.frameTimer).toBe(0)
    expect(state.stateTimer).toBeGreaterThan(0)
    expect(state.recentWaypoints).toHaveLength(0)
  })

  it('positions pet at the below_campfire waypoint coordinates', () => {
    const state = createInitialPetState()
    const belowCampfire = HUB_WAYPOINTS['below_campfire']
    expect(state.position.x).toBe(belowCampfire.x)
    expect(state.position.y).toBe(belowCampfire.y)
  })

  it('accepts a custom start waypoint', () => {
    const state = createInitialPetState('ground_left')
    const groundLeft = HUB_WAYPOINTS['ground_left']
    expect(state.currentWaypoint).toBe('ground_left')
    expect(state.position.x).toBe(groundLeft.x)
    expect(state.position.y).toBe(groundLeft.y)
  })

  it('falls back to below_campfire for unknown waypoint ids', () => {
    const state = createInitialPetState('nonexistent_waypoint')
    expect(state.currentWaypoint).toBe('below_campfire')
  })
})

// ---------------------------------------------------------------------------
// tickPet — frame advancement
// ---------------------------------------------------------------------------

describe('tickPet — frame advancement', () => {
  it('advances frame counter after enough time accumulates', () => {
    const state = createInitialPetState()
    const config = makeAnimConfig({ frameCount: 6, frameDuration: 200 })

    // Tick exactly one frame duration
    const next = tickPet(state, 200, config)
    expect(next.frame).toBe(1)
    expect(next.frameTimer).toBeCloseTo(0, 5)
  })

  it('accumulates sub-frame time without advancing frame', () => {
    const state = createInitialPetState()
    const config = makeAnimConfig({ frameDuration: 200 })

    const next = tickPet(state, 100, config)
    expect(next.frame).toBe(0)
    expect(next.frameTimer).toBe(100)
  })

  it('loops back to frame 0 after last frame on looping animations', () => {
    const state: PetState = {
      ...createInitialPetState(),
      frame: 5, // last frame of a 6-frame animation
    }
    const config = makeAnimConfig({ frameCount: 6, frameDuration: 200, loop: true })
    const next = tickPet(state, 200, config)
    expect(next.frame).toBe(0)
  })

  it('clamps at last frame for non-looping animations', () => {
    const state: PetState = {
      ...createInitialPetState(),
      behavior: 'react',
      frame: 3, // last frame of a 4-frame animation
    }
    const config = makeAnimConfig({ frameCount: 4, frameDuration: 100, loop: false })
    const next = tickPet(state, 100, config)
    expect(next.frame).toBe(3) // stays at last frame
  })

  it('can advance multiple frames in a single large delta', () => {
    const state = createInitialPetState()
    const config = makeAnimConfig({ frameCount: 6, frameDuration: 100, loop: true })
    const next = tickPet(state, 350, config)
    expect(next.frame).toBe(3)
    expect(next.frameTimer).toBeCloseTo(50, 5)
  })
})

// ---------------------------------------------------------------------------
// tickPet — walk movement
// ---------------------------------------------------------------------------

describe('tickPet — walk movement', () => {
  it('moves position toward target waypoint during walk', () => {
    const belowCampfire = HUB_WAYPOINTS['below_campfire']
    const groundLeft = HUB_WAYPOINTS['ground_left']
    const state: PetState = {
      ...createInitialPetState('below_campfire'),
      behavior: 'walk',
      targetWaypoint: 'ground_left',
      stateTimer: 0,
    }
    const config = makeAnimConfig()

    const next = tickPet(state, 500, config)

    // Should have moved closer to ground_left from below_campfire
    const origDist = Math.sqrt(
      Math.pow(groundLeft.x - belowCampfire.x, 2) + Math.pow(groundLeft.y - belowCampfire.y, 2),
    )
    const newDist = Math.sqrt(
      Math.pow(groundLeft.x - next.position.x, 2) + Math.pow(groundLeft.y - next.position.y, 2),
    )
    expect(newDist).toBeLessThan(origDist)
  })

  it('snaps to waypoint position on arrival and transitions to new behavior', () => {
    // Place pet very close to ground_right so a small delta completes the walk
    const groundRight = HUB_WAYPOINTS['ground_right']
    const nearGroundRight = { x: groundRight.x + 0.01, y: groundRight.y }

    const state: PetState = {
      ...createInitialPetState('below_campfire'),
      behavior: 'walk',
      position: nearGroundRight,
      targetWaypoint: 'ground_right',
      currentWaypoint: 'below_campfire',
      stateTimer: 0,
    }
    const config = makeAnimConfig()

    // 500ms at 0.0018%/ms = 0.9% step — more than 0.01% distance
    const next = tickPet(state, 500, config)

    expect(next.position.x).toBe(groundRight.x)
    expect(next.position.y).toBe(groundRight.y)
    expect(next.currentWaypoint).toBe('ground_right')
    // Should have transitioned away from 'walk' (timer hit 0 after arrival)
    expect(next.behavior).not.toBe('walk')
    // ground_right should now be in recent waypoints
    expect(next.recentWaypoints).toContain('ground_right')
  })

  it('sets facingLeft based on target x relative to current position', () => {
    const groundLeft = HUB_WAYPOINTS['ground_left'] // x=22
    // Place pet to the right of ground_left
    const state: PetState = {
      ...createInitialPetState('below_campfire'),
      position: { x: 70, y: 50 },
    }

    const next = startWalk(state, 'ground_left', groundLeft)
    expect(next.facingLeft).toBe(true) // target is to the left
  })

  it('does not move into exclusion zones during walk interpolation', () => {
    // Walk the pet through a known exclusion zone edge by positioning it just outside
    // and targeting a waypoint on the other side. The collision avoidance should deflect.
    // Use campfire zone (x1:35, y1:52, x2:59, y2:82) — pet at left edge, walking right
    const startPos = { x: 34, y: 67 }  // just left of campfire exclusion
    const state: PetState = {
      ...createInitialPetState('ground_left'),
      behavior: 'walk',
      position: startPos,
      targetWaypoint: 'ground_center_right', // x:62, y:85 — path crosses campfire zone
      currentWaypoint: 'ground_left',
      stateTimer: 0,
    }
    const config = makeAnimConfig()

    // Tick many times and check position never falls inside an exclusion zone
    let current = state
    for (let i = 0; i < 200; i++) {
      current = tickPet(current, 16, config)
      if (current.behavior !== 'walk') break
      expect(isInsideExclusion(current.position.x, current.position.y)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// selectNextBehavior
// ---------------------------------------------------------------------------

describe('selectNextBehavior', () => {
  it('never spontaneously returns react', () => {
    const behaviors = ['idle', 'walk', 'sit', 'lick', 'sleep'] as const
    for (let i = 0; i < 200; i++) {
      for (const beh of behaviors) {
        const next = selectNextBehavior(beh, false)
        expect(next).not.toBe('react')
      }
    }
  })

  it('returns previousBehavior when current behavior is react', () => {
    expect(selectNextBehavior('react', false, 'sit')).toBe('sit')
    expect(selectNextBehavior('react', false, 'lick')).toBe('lick')
    expect(selectNextBehavior('react', true, 'sleep')).toBe('sleep')
  })

  it('returns a valid PetBehavior for all non-react behaviors', () => {
    const valid = new Set(['idle', 'walk', 'sit', 'lick', 'sleep', 'react'])
    const behaviors = ['idle', 'walk', 'sit', 'lick', 'sleep'] as const
    for (let i = 0; i < 50; i++) {
      for (const beh of behaviors) {
        const next = selectNextBehavior(beh, false)
        expect(valid.has(next)).toBe(true)
      }
    }
  })

  it('campfire bias: sleep+sit combined > 50% when nearCampfire (1000 iterations)', () => {
    let sleepOrSitCount = 0
    const iterations = 1000

    for (let i = 0; i < iterations; i++) {
      const next = selectNextBehavior('idle', true)
      if (next === 'sleep' || next === 'sit') {
        sleepOrSitCount++
      }
    }

    const ratio = sleepOrSitCount / iterations
    // Without campfire boost: sleep=0.15 + sit=0.25 = 40% of 1.0 total from idle
    // With 1.5× boost: sleep=0.225 + sit=0.375 = 0.6 / (0.10 + 0.30 + 0.375 + 0.20 + 0.225) = 0.6 / 1.2 = 50%
    // We allow slight margin for randomness
    expect(ratio).toBeGreaterThanOrEqual(0.45)
  })

  it('campfire bias: sleep+sit > non-campfire rate', () => {
    let withCampfire = 0
    let withoutCampfire = 0
    const iterations = 2000

    for (let i = 0; i < iterations; i++) {
      if (selectNextBehavior('idle', true) === 'sleep' || selectNextBehavior('idle', true) === 'sit') {
        withCampfire++
      }
      if (selectNextBehavior('idle', false) === 'sleep' || selectNextBehavior('idle', false) === 'sit') {
        withoutCampfire++
      }
    }

    expect(withCampfire).toBeGreaterThan(withoutCampfire)
  })
})

// ---------------------------------------------------------------------------
// triggerReact
// ---------------------------------------------------------------------------

describe('triggerReact', () => {
  it('saves previousBehavior as the current behavior before react', () => {
    const state: PetState = { ...createInitialPetState(), behavior: 'sit' }
    const reacted = triggerReact(state)
    expect(reacted.behavior).toBe('react')
    expect(reacted.previousBehavior).toBe('sit')
  })

  it('resets frame and frame timer to 0', () => {
    const state: PetState = { ...createInitialPetState(), frame: 3, frameTimer: 150 }
    const reacted = triggerReact(state)
    expect(reacted.frame).toBe(0)
    expect(reacted.frameTimer).toBe(0)
  })

  it('sets stateTimer to react duration (1000ms)', () => {
    const state = createInitialPetState()
    const reacted = triggerReact(state)
    expect(reacted.stateTimer).toBe(1000)
  })

  it('does not modify position or waypoint state', () => {
    const state = createInitialPetState('ground_left')
    const reacted = triggerReact(state)
    expect(reacted.position).toEqual(state.position)
    expect(reacted.currentWaypoint).toBe(state.currentWaypoint)
    expect(reacted.targetWaypoint).toBe(state.targetWaypoint)
  })
})

// ---------------------------------------------------------------------------
// startWalk
// ---------------------------------------------------------------------------

describe('startWalk', () => {
  it('sets behavior to walk', () => {
    const state = createInitialPetState()
    const target = HUB_WAYPOINTS['ground_left']
    const next = startWalk(state, 'ground_left', target)
    expect(next.behavior).toBe('walk')
  })

  it('sets targetWaypoint to the provided waypoint id', () => {
    const state = createInitialPetState()
    const next = startWalk(state, 'ground_center_left', HUB_WAYPOINTS['ground_center_left'])
    expect(next.targetWaypoint).toBe('ground_center_left')
  })

  it('sets facingLeft true when target is to the left', () => {
    const state: PetState = { ...createInitialPetState(), position: { x: 80, y: 50 } }
    const target = HUB_WAYPOINTS['ground_left'] // x=22, which is left of 80
    const next = startWalk(state, 'ground_left', target)
    expect(next.facingLeft).toBe(true)
  })

  it('sets facingLeft false when target is to the right', () => {
    const state: PetState = { ...createInitialPetState(), position: { x: 10, y: 50 } }
    const target = HUB_WAYPOINTS['ground_right'] // x=80, which is right of 10
    const next = startWalk(state, 'ground_right', target)
    expect(next.facingLeft).toBe(false)
  })

  it('resets frame and frameTimer', () => {
    const state: PetState = { ...createInitialPetState(), frame: 4, frameTimer: 180 }
    const next = startWalk(state, 'below_campfire', HUB_WAYPOINTS['below_campfire'])
    expect(next.frame).toBe(0)
    expect(next.frameTimer).toBe(0)
  })

  it('saves current behavior as previousBehavior', () => {
    const state: PetState = { ...createInitialPetState(), behavior: 'lick' }
    const next = startWalk(state, 'below_campfire', HUB_WAYPOINTS['below_campfire'])
    expect(next.previousBehavior).toBe('lick')
  })
})

// ---------------------------------------------------------------------------
// Exclusion zone system
// ---------------------------------------------------------------------------

describe('isInsideExclusion', () => {
  it('returns true for a point inside a known exclusion zone', () => {
    // Inside campfire zone (x1:35, y1:52, x2:59, y2:82)
    expect(isInsideExclusion(47, 67)).toBe(true)
  })

  it('returns false for a point outside all exclusion zones', () => {
    // below_campfire waypoint at (47, 84) — below campfire zone bottom edge (82)
    expect(isInsideExclusion(47, 84)).toBe(false)
  })

  it('returns true for a point at the exact boundary of an exclusion zone (inclusive edges)', () => {
    // Campfire zone x1=35, y1=52 — point exactly on edge IS inside (inclusive bounds)
    expect(isInsideExclusion(35, 52)).toBe(true)
  })

  it('all waypoints are outside all exclusion zones', () => {
    for (const wp of Object.values(HUB_WAYPOINTS)) {
      const inside = isInsideExclusion(wp.x, wp.y)
      // Log which waypoint failed for easier debugging
      if (inside) {
        console.error(`Waypoint "${wp.id}" at (${wp.x}, ${wp.y}) is inside an exclusion zone`)
      }
      expect(inside).toBe(false)
    }
  })
})

describe('pushOutOfExclusion', () => {
  it('returns input unchanged when point is outside all zones', () => {
    const result = pushOutOfExclusion(47, 84)
    expect(result).toEqual({ x: 47, y: 84 })
  })

  it('pushes a point out of the campfire zone via nearest edge', () => {
    // campfire zone: x1:35, y1:52, x2:59, y2:82
    // Point at (47, 81) — inside, closest to bottom (82-81=1), closer than left (47-35=12) or right (59-47=12) or top (81-52=29)
    const result = pushOutOfExclusion(47, 81)
    expect(result.y).toBe(83) // pushed to y2+1 = 83
    expect(result.x).toBe(47) // x unchanged
    expect(isInsideExclusion(result.x, result.y)).toBe(false)
  })

  it('pushes a point out via left edge when closest to left', () => {
    // campfire zone: x1:35, y1:52, x2:59, y2:82
    // Point at (35, 67) — on left edge. dist to left = 0, so pushed to x1-1 = 34
    const result = pushOutOfExclusion(35, 67)
    expect(result.x).toBe(34)
    expect(result.y).toBe(67)
  })

  it('produces a point outside all exclusion zones after push', () => {
    // Test several interior points across different zones
    const testPoints = [
      { x: 47, y: 67 },  // campfire center
      { x: 62, y: 63 },  // character zone
      { x: 15, y: 60 },  // shop zone
      { x: 30, y: 40 },  // library zone
    ]
    for (const pt of testPoints) {
      if (isInsideExclusion(pt.x, pt.y)) {
        const pushed = pushOutOfExclusion(pt.x, pt.y)
        // Log for debugging if push doesn't fully clear
        if (isInsideExclusion(pushed.x, pushed.y)) {
          console.error(`pushOutOfExclusion(${pt.x}, ${pt.y}) = (${pushed.x}, ${pushed.y}) still inside zone`)
        }
        expect(isInsideExclusion(pushed.x, pushed.y)).toBe(false)
      }
    }
  })
})

describe('EXCLUSION_ZONES', () => {
  it('has 9 entries (one per hub element)', () => {
    expect(EXCLUSION_ZONES).toHaveLength(9)
  })

  it('all zones have valid geometry (x1 < x2, y1 < y2)', () => {
    for (const z of EXCLUSION_ZONES) {
      expect(z.x1).toBeLessThan(z.x2)
      expect(z.y1).toBeLessThan(z.y2)
    }
  })

  it('all zone coordinates are within 0–100 range', () => {
    for (const z of EXCLUSION_ZONES) {
      expect(z.x1).toBeGreaterThanOrEqual(0)
      expect(z.y1).toBeGreaterThanOrEqual(0)
      expect(z.x2).toBeLessThanOrEqual(100)
      expect(z.y2).toBeLessThanOrEqual(100)
    }
  })
})
