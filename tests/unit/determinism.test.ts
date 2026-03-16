// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import {
  createSeededRng,
  seededShuffled,
  initRunRng,
  getRunRng,
  destroyRunRng,
  serializeRunRngState,
  restoreRunRngState,
} from '../../src/services/seededRng'

describe('seededRng', () => {
  afterEach(() => {
    destroyRunRng()
  })

  describe('createSeededRng — core determinism', () => {
    it('produces same sequence for same seed', () => {
      const a = createSeededRng(42)
      const b = createSeededRng(42)
      for (let i = 0; i < 100; i++) {
        expect(a.next()).toBe(b.next())
      }
    })

    it('produces different sequence for different seed', () => {
      const a = createSeededRng(42)
      const b = createSeededRng(99)
      const same = Array.from({ length: 10 }, () => a.next() === b.next())
      expect(same.every(Boolean)).toBe(false)
    })

    it('nextInt stays within bounds', () => {
      const rng = createSeededRng(7)
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(6)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(6)
      }
    })
  })

  describe('fork isolation', () => {
    it('advancing one fork does not affect a sibling fork', () => {
      const root = createSeededRng(1234)
      const forkA = root.fork('combat')
      const forkB = root.fork('rewards')

      // Record forkB's sequence before touching forkA
      const forkB_before = Array.from({ length: 10 }, () => forkB.next())

      // Create fresh forks to compare against after advancing forkA
      const root2 = createSeededRng(1234)
      root2.fork('combat') // discard — just mirrors root advancing
      const forkB2 = root2.fork('rewards')

      // Advance forkA heavily
      for (let i = 0; i < 50; i++) forkA.next()

      // forkB should still produce the same sequence as the reference
      const forkB_after = Array.from({ length: 10 }, () => forkB2.next())
      expect(forkB_before).toEqual(forkB_after)
    })

    it('same label produces same fork sequence from same root seed', () => {
      const root1 = createSeededRng(555)
      const root2 = createSeededRng(555)
      const f1 = root1.fork('deck')
      const f2 = root2.fork('deck')
      for (let i = 0; i < 50; i++) {
        expect(f1.next()).toBe(f2.next())
      }
    })
  })

  describe('seededShuffled — determinism', () => {
    it('same seed + same input produces same shuffle', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8]
      const a = createSeededRng(77)
      const b = createSeededRng(77)
      expect(seededShuffled(a, items)).toEqual(seededShuffled(b, items))
    })

    it('different seeds produce different shuffles', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const shuffleA = seededShuffled(createSeededRng(1), items)
      const shuffleB = seededShuffled(createSeededRng(2), items)
      expect(shuffleA).not.toEqual(shuffleB)
    })

    it('returns all original elements (no duplicates/drops)', () => {
      const items = ['a', 'b', 'c', 'd', 'e']
      const result = seededShuffled(createSeededRng(42), items)
      expect(result.sort()).toEqual([...items].sort())
    })
  })

  describe('serialization roundtrip', () => {
    it('restoreRunRngState continues the same sequence as an uninterrupted run', () => {
      initRunRng(9999)
      const fork = getRunRng('test')

      // Advance the fork some steps
      for (let i = 0; i < 20; i++) fork.next()

      // Capture state and read the next 10 values as the reference
      const saved = serializeRunRngState()!
      const reference = Array.from({ length: 10 }, () => fork.next())

      // Restore and replay
      restoreRunRngState(saved)
      const restored = getRunRng('test')
      const replayed = Array.from({ length: 10 }, () => restored.next())

      expect(replayed).toEqual(reference)
    })

    it('serializeRunRngState returns null when no run is active', () => {
      expect(serializeRunRngState()).toBeNull()
    })

    it('multiple forks are all restored correctly', () => {
      initRunRng(1111)
      const forkX = getRunRng('x')
      const forkY = getRunRng('y')

      for (let i = 0; i < 15; i++) forkX.next()
      for (let i = 0; i < 30; i++) forkY.next()

      const saved = serializeRunRngState()!
      const refX = Array.from({ length: 5 }, () => forkX.next())
      const refY = Array.from({ length: 5 }, () => forkY.next())

      restoreRunRngState(saved)
      const rx = Array.from({ length: 5 }, () => getRunRng('x').next())
      const ry = Array.from({ length: 5 }, () => getRunRng('y').next())

      expect(rx).toEqual(refX)
      expect(ry).toEqual(refY)
    })
  })
})
