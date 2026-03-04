// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { seededRandom } from '../../src/game/systems/MineGenerator'

describe('seededRandom (mulberry32)', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = seededRandom(42)
    const rng2 = seededRandom(42)
    const seq1 = Array.from({ length: 50 }, () => rng1())
    const seq2 = Array.from({ length: 50 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = seededRandom(1)
    const rng2 = seededRandom(2)
    const val1 = rng1()
    const val2 = rng2()
    expect(val1).not.toBe(val2)
  })

  it('all outputs are in [0, 1)', () => {
    const rng = seededRandom(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('known seed 42 produces a stable first value (regression guard)', () => {
    const rng = seededRandom(42)
    const first = rng()
    // Pin exact value — if mulberry32 implementation changes, this will catch it
    expect(first).toMatchSnapshot()
  })

  it('seed 0 does not produce all zeros', () => {
    const rng = seededRandom(0)
    const values = Array.from({ length: 10 }, () => rng())
    const allZero = values.every(v => v === 0)
    expect(allZero).toBe(false)
  })

  it('produces uniform-ish distribution (basic chi-square check)', () => {
    const rng = seededRandom(12345)
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const N = 10_000
    for (let i = 0; i < N; i++) {
      const v = rng()
      const bucket = Math.floor(v * 10)
      buckets[bucket]++
    }
    // Each bucket should have roughly N/10 = 1000, allow 30% deviation
    buckets.forEach(count => {
      expect(count).toBeGreaterThan(700)
      expect(count).toBeLessThan(1300)
    })
  })

  it('independent RNGs from same seed produce fully independent state', () => {
    const rng1 = seededRandom(7)
    const rng2 = seededRandom(7)
    // Advance rng1 by 5 steps
    for (let i = 0; i < 5; i++) rng1()
    // rng2 starting fresh should still match rng1 at step 5+1
    const nextRng1 = rng1()
    for (let i = 0; i < 5; i++) rng2()
    const nextRng2 = rng2()
    expect(nextRng1).toBe(nextRng2)
  })
})
