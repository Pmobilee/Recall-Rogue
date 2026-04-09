/**
 * Unit tests for floorManager.ts
 *
 * Covers:
 * 1. pickCombatEnemy — optional rngFn: when provided, the result is purely driven
 *    by that function regardless of global getRunRng('enemies') fork state.
 * 2. getMiniBossForFloor — same guarantee as above.
 *
 * Bug 6 root cause: assignEnemyIds previously ignored its local rng parameter and
 * consumed the global fork instead. When two co-op peers had consumed the global
 * fork asymmetrically (e.g. due to UI hovers or preview rolls), the baked enemyId
 * values diverged even with an identical run seed. The fix threads a local rng
 * through so both peers produce identical maps purely from their shared seed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pickCombatEnemy, getMiniBossForFloor } from './floorManager'
import { initRunRng, destroyRunRng, getRunRng } from './seededRng'

// Simple mulberry32 implementation for creating deterministic test RNGs
function makeMulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let n = Math.imul(t ^ (t >>> 15), 1 | t)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 0x100000000
  }
}

describe('pickCombatEnemy — rngFn isolation', () => {
  afterEach(() => {
    destroyRunRng()
  })

  it('produces the same enemy regardless of global fork consumption when rngFn is provided', () => {
    // Initialize a run RNG so the global fork is active
    initRunRng(999)

    // Create two seeded RNGs with the same seed
    const rngA = makeMulberry32(12345)
    const rngB = makeMulberry32(12345)

    // Call with rngA before consuming the global fork
    const enemyBefore = pickCombatEnemy(5, rngA)

    // Consume the global 'enemies' fork 10 times to simulate asymmetric state
    const globalFork = getRunRng('enemies')
    for (let i = 0; i < 10; i++) {
      globalFork.next()
    }

    // Call with rngB after consuming the global fork — must produce the same result
    const enemyAfter = pickCombatEnemy(5, rngB)

    expect(enemyAfter).toBe(enemyBefore)
  })

  it('produces the same sequence across multiple calls with the same seeded rngFn', () => {
    const rngA = makeMulberry32(54321)
    const rngB = makeMulberry32(54321)

    const sequenceA = Array.from({ length: 5 }, () => pickCombatEnemy(3, rngA))
    const sequenceB = Array.from({ length: 5 }, () => pickCombatEnemy(3, rngB))

    expect(sequenceA).toEqual(sequenceB)
  })

  it('returns a valid enemy id (non-empty string)', () => {
    const rng = makeMulberry32(7777)
    const enemyId = pickCombatEnemy(1, rng)
    expect(typeof enemyId).toBe('string')
    expect(enemyId.length).toBeGreaterThan(0)
  })

  it('falls back to global fork when rngFn is not provided and run is active', () => {
    initRunRng(111)
    // Should not throw — uses global fork
    const enemyId = pickCombatEnemy(1)
    expect(typeof enemyId).toBe('string')
    expect(enemyId.length).toBeGreaterThan(0)
  })

  it('falls back to Math.random when rngFn not provided and no run active', () => {
    // No initRunRng — isRunRngActive() === false
    const enemyId = pickCombatEnemy(1)
    expect(typeof enemyId).toBe('string')
    expect(enemyId.length).toBeGreaterThan(0)
  })
})

describe('getMiniBossForFloor — rngFn isolation', () => {
  afterEach(() => {
    destroyRunRng()
  })

  it('produces the same mini-boss regardless of global fork consumption when rngFn is provided', () => {
    initRunRng(888)

    const rngA = makeMulberry32(99999)
    const rngB = makeMulberry32(99999)

    const bossBefore = getMiniBossForFloor(5, rngA)

    // Consume the global enemies fork asymmetrically
    const globalFork = getRunRng('enemies')
    for (let i = 0; i < 15; i++) {
      globalFork.next()
    }

    const bossAfter = getMiniBossForFloor(5, rngB)

    expect(bossAfter).toBe(bossBefore)
  })

  it('produces the same sequence across multiple calls with the same seeded rngFn', () => {
    const rngA = makeMulberry32(11111)
    const rngB = makeMulberry32(11111)

    const sequenceA = [1, 4, 7, 10, 12].map(floor => getMiniBossForFloor(floor, rngA))
    const sequenceB = [1, 4, 7, 10, 12].map(floor => getMiniBossForFloor(floor, rngB))

    expect(sequenceA).toEqual(sequenceB)
  })

  it('returns a valid enemy id (non-empty string)', () => {
    const rng = makeMulberry32(6666)
    const bossId = getMiniBossForFloor(3, rng)
    expect(typeof bossId).toBe('string')
    expect(bossId.length).toBeGreaterThan(0)
  })
})
