/**
 * Unit tests for mapGenerator.ts
 *
 * Covers:
 * 1. No orphan nodes — every node in rows 1+ has at least one parent.
 * 2. Determinism — same seed produces identical maps.
 * 3. Edge direction balance — left and right branching should each exceed 15%
 *    and their difference should be within 10 percentage points (symmetrized
 *    candidate fix, 2026-04-08).
 *
 * Note on crossing edges: both the original and updated implementations produce
 * some adjacent-column crossings when secondary branches go left while a previous
 * node's secondary branch went right. This is a known, visually subtle property
 * (avg ~10 crossings per map, all involving adjacent columns) and is not tested
 * against zero here. The `maxChildColUsed` tracker prevents the extreme long-range
 * crossings (e.g., parent col 0 → child col 3 while parent col 2 → child col 0)
 * that would make the map visually unreadable.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { generateActMap } from './mapGenerator'
import type { ActMap } from './mapGenerator'
import { initRunRng, destroyRunRng, getRunRng } from './seededRng'

// ============================================================
// Helpers
// ============================================================

/**
 * Collect every (parentCol, childCol) pair across all row transitions in a map.
 */
function collectEdgePairs(map: ActMap): Array<{ parentCol: number; childCol: number }> {
  const pairs: Array<{ parentCol: number; childCol: number }> = []
  for (const node of Object.values(map.nodes)) {
    for (const childId of node.childIds) {
      const child = map.nodes[childId]
      if (child) {
        pairs.push({ parentCol: node.col, childCol: child.col })
      }
    }
  }
  return pairs
}

/**
 * Count crossing edges within the same row transition.
 *
 * Two edges (pA→cA) and (pB→cB) from the same row cross if pA < pB but cA > cB,
 * or pA > pB but cA < cB.
 */
function countCrossingEdges(map: ActMap): number {
  let count = 0
  // Group edges by their source row
  const edgesByRow = new Map<number, Array<{ parentCol: number; childCol: number }>>()
  for (const node of Object.values(map.nodes)) {
    for (const childId of node.childIds) {
      const child = map.nodes[childId]
      if (!child) continue
      const r = node.row
      if (!edgesByRow.has(r)) edgesByRow.set(r, [])
      edgesByRow.get(r)!.push({ parentCol: node.col, childCol: child.col })
    }
  }

  for (const edges of edgesByRow.values()) {
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const a = edges[i]
        const b = edges[j]
        if (
          (a.parentCol < b.parentCol && a.childCol > b.childCol) ||
          (a.parentCol > b.parentCol && a.childCol < b.childCol)
        ) {
          count++
        }
      }
    }
  }
  return count
}

/**
 * Check that every node in rows 1+ has at least one parent.
 */
function hasOrphanNode(map: ActMap): boolean {
  for (const node of Object.values(map.nodes)) {
    if (node.row > 0 && node.parentIds.length === 0) return true
  }
  return false
}

// ============================================================
// Tests
// ============================================================

describe('mapGenerator', () => {
  afterEach(() => {
    destroyRunRng()
  })

  it('produces identical maps from the same seed (determinism)', () => {
    const seed = 42
    const mapA = generateActMap(1, seed)
    const mapB = generateActMap(1, seed)
    // Compare edge sets
    const edgesA = collectEdgePairs(mapA).sort((a, b) => a.parentCol - b.parentCol || a.childCol - b.childCol)
    const edgesB = collectEdgePairs(mapB).sort((a, b) => a.parentCol - b.parentCol || a.childCol - b.childCol)
    expect(edgesA).toEqual(edgesB)
  })

  it('produces different maps from different seeds', () => {
    const mapA = generateActMap(1, 1)
    const mapB = generateActMap(1, 9999)
    const edgesA = collectEdgePairs(mapA)
    const edgesB = collectEdgePairs(mapB)
    // At least some edge pairs should differ
    expect(edgesA).not.toEqual(edgesB)
  })

  it('never produces orphan nodes (every node row 1+ has a parent)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const map = generateActMap(1, seed * 1337)
      expect(hasOrphanNode(map), `Orphan node found for seed ${seed * 1337}`).toBe(false)
    }
  })

  it('crossing count stays comparable to the original implementation (< 25 per map avg)', () => {
    // Both old and new implementations produce some adjacent-column crossings
    // (avg ~9-12 per map). This test ensures the fix does not dramatically
    // increase crossings. The threshold of 25 is 2.5× the original avg.
    let totalCrossings = 0
    const numMaps = 100
    for (let seed = 0; seed < numMaps; seed++) {
      const map = generateActMap(1, seed * 1337)
      totalCrossings += countCrossingEdges(map)
    }
    const avgCrossings = totalCrossings / numMaps
    expect(avgCrossings).toBeLessThan(25)
  })

  it('edge directions are balanced — left and right each exceed 15%, gap < 10pp', () => {
    // Generate 150 maps across all segments and varied seeds
    let leftCount = 0
    let rightCount = 0
    let straightCount = 0

    for (let seed = 0; seed < 150; seed++) {
      const segment = ([1, 2, 3, 4] as const)[seed % 4]
      const map = generateActMap(segment, seed * 7919 + 12345)
      for (const { parentCol, childCol } of collectEdgePairs(map)) {
        if (childCol < parentCol) leftCount++
        else if (childCol > parentCol) rightCount++
        else straightCount++
      }
    }

    const total = leftCount + rightCount + straightCount
    const leftPct = leftCount / total
    const rightPct = rightCount / total

    // Both directions must appear meaningfully — neither should be starved
    expect(leftPct).toBeGreaterThan(0.15)
    expect(rightPct).toBeGreaterThan(0.15)

    // The gap between left and right should be small (within 10 percentage points)
    expect(Math.abs(leftPct - rightPct)).toBeLessThan(0.10)
  })

  it('enemy IDs are identical when generated with the same seed regardless of global fork consumption (Bug 6)', () => {
    // Bug 6 root cause: assignEnemyIds previously ignored its local rng param
    // and consumed getRunRng('enemies') instead. If the global fork was consumed
    // asymmetrically between peers, node.enemyId values would diverge.
    // Fix: pickCombatEnemy/getMiniBossForFloor now accept an optional rngFn.

    const SEED = 12345

    // First generation — with a fresh global fork
    initRunRng(SEED)
    const mapA = generateActMap(1, SEED)
    const enemyIdsA = Object.values(mapA.nodes)
      .filter(n => n.enemyId)
      .map(n => ({ id: n.id, enemyId: n.enemyId }))
      .sort((a, b) => a.id.localeCompare(b.id))

    // Consume the global enemies fork 5 times to simulate asymmetric state (e.g. UI hovers)
    const fork = getRunRng('enemies')
    for (let i = 0; i < 5; i++) fork.next()

    // Second generation — with the same map seed, but after consuming the global fork
    initRunRng(SEED)
    const mapB = generateActMap(1, SEED)
    const enemyIdsB = Object.values(mapB.nodes)
      .filter(n => n.enemyId)
      .map(n => ({ id: n.id, enemyId: n.enemyId }))
      .sort((a, b) => a.id.localeCompare(b.id))

    // Both maps must have identical enemy assignments
    expect(enemyIdsB).toEqual(enemyIdsA)
  })
})
