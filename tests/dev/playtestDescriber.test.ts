/**
 * Unit tests for playtestDescriber.ts — LOW-19
 *
 * Verifies that look() renders enemy intent with BOTH the raw value AND the
 * computed display damage, preventing LLM testers from reasoning from the
 * wrong (raw) number.
 *
 * Environment: happy-dom (set in vitest.config.ts)
 */

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/services/factsDB', () => ({
  factsDB: { isReady: () => false, getById: () => null },
}))

vi.mock('../../src/data/relics', () => ({
  RELIC_BY_ID: {},
}))

// ---------------------------------------------------------------------------
// Store helpers (mirrors playtestAPI.test.ts pattern)
// ---------------------------------------------------------------------------

function setStore(key: string, value: unknown) {
  const sym = Symbol.for(key)
  let _val = value
  ;(globalThis as Record<symbol, unknown>)[sym] = {
    subscribe: (cb: (v: unknown) => void) => { cb(_val); return () => {} },
    set: (v: unknown) => { _val = v },
  }
}

function clearStore(key: string) {
  const sym = Symbol.for(key)
  delete (globalThis as Record<symbol, unknown>)[sym]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal enemy object as stored in turnState. */
function buildEnemy(intentOverrides: Record<string, unknown> = {}) {
  return {
    template: { name: 'Slime' },
    currentHP: 30,
    maxHP: 40,
    block: 0,
    statusEffects: [],
    nextIntent: {
      type: 'attack',
      value: 10,
      telegraph: 'attack',
      hitCount: 1,
      statusEffect: null,
      // displayDamage is set by playtestAPI before being stored, or can be inline
      displayDamage: 16,
      ...intentOverrides,
    },
  }
}

function buildTurnState(enemy: unknown) {
  return {
    playerState: { hp: 60, maxHP: 80, shield: 0, statusEffects: [] },
    playerHP: 60,
    apCurrent: 3,
    apMax: 3,
    turn: 2,
    cardsPlayedThisTurn: 0,
    deck: { hand: [] },
    enemy,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('playtestDescriber look() — LOW-19 intent display', () => {
  beforeEach(() => {
    clearStore('rr:activeTurnState')
    clearStore('rr:activeRunState')
    clearStore('rr:currentScreen')
    setStore('rr:currentScreen', 'combat')
  })

  it('renders attack intent with "→ N after modifiers" for attack type', async () => {
    const enemy = buildEnemy({ type: 'attack', value: 10, displayDamage: 16 })
    setStore('rr:activeTurnState', buildTurnState(enemy))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const { look } = await import('../../src/dev/playtestDescriber')
    const output = look()

    // Should show both raw (10) and computed (16)
    expect(output).toContain('10 → 16 after modifiers')
  })

  it('renders multi_attack intent with "→ N after modifiers"', async () => {
    const enemy = buildEnemy({ type: 'multi_attack', value: 6, displayDamage: 10, hitCount: 3 })
    setStore('rr:activeTurnState', buildTurnState(enemy))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const { look } = await import('../../src/dev/playtestDescriber')
    const output = look()

    expect(output).toContain('6 → 10 after modifiers')
  })

  it('does NOT append "after modifiers" for defend-type intent (no damage)', async () => {
    const enemy = buildEnemy({ type: 'defend', value: 8, displayDamage: 0 })
    setStore('rr:activeTurnState', buildTurnState(enemy))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const { look } = await import('../../src/dev/playtestDescriber')
    const output = look()

    expect(output).not.toContain('after modifiers')
    // Still shows the raw value
    expect(output).toMatch(/Intent:.*defend.*8/)
  })

  it('falls back to raw value when displayDamage is absent (backward compat)', async () => {
    // Simulate an old snapshot without displayDamage
    const enemy = buildEnemy({ type: 'attack', value: 12, displayDamage: undefined })
    setStore('rr:activeTurnState', buildTurnState(enemy))
    setStore('rr:activeRunState', { currentFloor: 1 })

    const { look } = await import('../../src/dev/playtestDescriber')
    const output = look()

    // Falls back: 12 → 12 (displayDamage ?? raw = 12)
    expect(output).toContain('12 → 12 after modifiers')
  })
})
