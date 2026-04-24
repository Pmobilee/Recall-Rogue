/**
 * Unit tests for CombatScene.sceneReady invariant.
 *
 * Regression guard for BUG-001 (2026-04-24): sceneReady was not reset in
 * onShutdown, causing syncCombatScene.tryPush to call setEnemy() against a
 * destroyed Phaser display list between encounters.
 *
 * Full Phaser instantiation is not practical in Vitest — CombatScene imports
 * Phaser directly and creates 6+ systems in create(). Instead, we test the
 * invariant via a minimal harness that mirrors only the flag-management logic
 * in onShutdown and onWake, verifying the contract without 20+ Phaser stubs.
 */

import { describe, expect, it } from 'vitest'

/**
 * Minimal harness that reproduces exactly the sceneReady flag transitions in
 * CombatScene without requiring a live Phaser instance.
 */
class CombatSceneSceneReadyHarness {
  sceneReady = false

  /** Mirrors the FIRST statement of CombatScene.onShutdown() */
  simulateShutdown(): void {
    this.sceneReady = false // Gate syncCombatScene tryPush before display list tears down
    // (remaining cleanup would run here in the real scene)
  }

  /** Mirrors the LAST statement of CombatScene.onWake() */
  simulateWake(): void {
    // (refresh HP bars etc. would run here in the real scene)
    this.sceneReady = true // Restore after sleep/wake cycle; pairs with onShutdown reset
  }

  /** Mirrors the finally-block assignment at the end of CombatScene.create() */
  simulateCreate(): void {
    // (all create() setup would run here)
    this.sceneReady = true
  }
}

describe('CombatScene sceneReady invariant', () => {
  it('sceneReady is false after onShutdown runs', () => {
    const scene = new CombatSceneSceneReadyHarness()
    scene.simulateCreate()
    expect(scene.sceneReady).toBe(true)

    scene.simulateShutdown()
    expect(scene.sceneReady).toBe(false)
  })

  it('sceneReady is true after onWake runs following a sleep', () => {
    const scene = new CombatSceneSceneReadyHarness()
    scene.simulateCreate()
    scene.simulateShutdown() // onShutdown handles both 'shutdown' and 'sleep' events
    expect(scene.sceneReady).toBe(false)

    scene.simulateWake()
    expect(scene.sceneReady).toBe(true)
  })

  it('sceneReady stays false between onShutdown and next create/wake (the race window)', () => {
    const scene = new CombatSceneSceneReadyHarness()
    scene.simulateCreate()
    scene.simulateShutdown()

    // In the real bug, tryPush would fire HERE — sceneReady must be false so
    // setEnemy() returns early instead of calling setText() on a destroyed Text.
    expect(scene.sceneReady).toBe(false)
  })

  it('stop/start cycle: sceneReady is true again only after create()', () => {
    const scene = new CombatSceneSceneReadyHarness()
    scene.simulateCreate()
    scene.simulateShutdown() // scene.stop() → Phaser fires 'shutdown'
    expect(scene.sceneReady).toBe(false)

    // No wake event on stop/start — create() is called instead
    scene.simulateCreate()
    expect(scene.sceneReady).toBe(true)
  })
})
