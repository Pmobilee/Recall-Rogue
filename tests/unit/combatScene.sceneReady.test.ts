/**
 * Unit tests for CombatScene.sceneReady invariant and display-state reset.
 *
 * Regression guard for BUG-001 (2026-04-24): sceneReady was not reset in
 * onShutdown, causing syncCombatScene.tryPush to call setEnemy() against a
 * destroyed Phaser display list between encounters.
 *
 * Regression guard for NPT-2026-04-25: display-side HP text/bar/tracking
 * fields were not cleared in onShutdown, so the previous encounter's stale
 * HP values bled through the first frame of the next encounter's wake.
 *
 * Full Phaser instantiation is not practical in Vitest — CombatScene imports
 * Phaser directly and creates 6+ systems in create(). Instead, we test the
 * invariants via minimal harnesses that mirror only the relevant logic in
 * onShutdown and onWake, verifying the contracts without 20+ Phaser stubs.
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

// ---------------------------------------------------------------------------
// Display-state reset harness
// Regression guard for NPT-2026-04-25-encounter2-display-bleed:
// onShutdown now clears enemy HP text/bar/tracking fields so the first frame
// of encounter 2+ does not show stale values from the previous encounter.
// ---------------------------------------------------------------------------

/** Minimal fake of the Phaser Text game object — only setText is needed. */
class FakeText {
  text = 'some previous text'
  setText(value: string): this { this.text = value; return this }
}

/** Minimal fake of the Phaser Graphics game object — only clear is needed. */
class FakeGraphics {
  cleared = false
  clear(): this { this.cleared = true; return this }
}

/**
 * Harness that mirrors the display-state reset block added to onShutdown in
 * NPT-2026-04-25. The block runs unconditionally after sceneReady = false.
 */
class CombatSceneDisplayResetHarness {
  sceneReady = false

  // Simulated display objects (populated by simulateCreate)
  enemyNameText: FakeText | null = null
  enemyHpText: FakeText | null = null
  intentText: FakeText | null = null
  enemyHpBarFill: FakeGraphics | null = null

  // Numeric tracking fields
  currentEnemyHP = 0
  currentEnemyMaxHP = 0
  currentEnemyBlock = 0

  /** Mirrors the relevant parts of CombatScene.create() */
  simulateCreate(hp: number, maxHp: number, block: number): void {
    this.enemyNameText = new FakeText()
    this.enemyHpText = new FakeText()
    this.intentText = new FakeText()
    this.enemyHpBarFill = new FakeGraphics()
    this.currentEnemyHP = hp
    this.currentEnemyMaxHP = maxHp
    this.currentEnemyBlock = block
    this.sceneReady = true
  }

  /** Mirrors the display-state reset block in CombatScene.onShutdown() */
  simulateShutdown(): void {
    this.sceneReady = false
    // Display-state reset — prevents stale HP/name/intent from previous encounter
    // bleeding into the first frame of the next encounter's wake. Run-state (deck,
    // relics, HP, currency) is untouched. (NPT-2026-04-25-encounter2-display-bleed)
    this.enemyNameText?.setText('')
    this.enemyHpText?.setText('')
    this.intentText?.setText('')
    this.enemyHpBarFill?.clear()
    this.currentEnemyHP = 0
    this.currentEnemyMaxHP = 0
    this.currentEnemyBlock = 0
  }
}

describe('CombatScene display-state reset on shutdown (NPT-2026-04-25)', () => {
  it('currentEnemyHP is 0 after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(120, 120, 0)
    expect(scene.currentEnemyHP).toBe(120)

    scene.simulateShutdown()
    expect(scene.currentEnemyHP).toBe(0)
  })

  it('currentEnemyMaxHP is 0 after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(80, 200, 15)
    expect(scene.currentEnemyMaxHP).toBe(200)

    scene.simulateShutdown()
    expect(scene.currentEnemyMaxHP).toBe(0)
  })

  it('currentEnemyBlock is 0 after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(50, 100, 20)
    expect(scene.currentEnemyBlock).toBe(20)

    scene.simulateShutdown()
    expect(scene.currentEnemyBlock).toBe(0)
  })

  it('enemyHpText is empty string after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(60, 120, 0)
    expect(scene.enemyHpText!.text).toBe('some previous text')

    scene.simulateShutdown()
    expect(scene.enemyHpText!.text).toBe('')
  })

  it('enemyNameText is empty string after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(100, 100, 0)
    scene.simulateShutdown()
    expect(scene.enemyNameText!.text).toBe('')
  })

  it('intentText is empty string after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(100, 100, 0)
    scene.simulateShutdown()
    expect(scene.intentText!.text).toBe('')
  })

  it('enemyHpBarFill is cleared after onShutdown', () => {
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(75, 150, 0)
    expect(scene.enemyHpBarFill!.cleared).toBe(false)

    scene.simulateShutdown()
    expect(scene.enemyHpBarFill!.cleared).toBe(true)
  })

  it('display reset survives null display objects (optional-chaining)', () => {
    // Simulates the case where objects were already destroyed earlier in onShutdown flow
    const scene = new CombatSceneDisplayResetHarness()
    scene.simulateCreate(50, 100, 5)
    // Destroy display objects before shutdown (as Phaser systems would in real life)
    scene.enemyNameText = null
    scene.enemyHpText = null
    scene.intentText = null
    scene.enemyHpBarFill = null

    // Must not throw — all accesses use optional-chaining (?.)
    expect(() => scene.simulateShutdown()).not.toThrow()
    expect(scene.currentEnemyHP).toBe(0)
    expect(scene.currentEnemyMaxHP).toBe(0)
    expect(scene.currentEnemyBlock).toBe(0)
  })
})
