// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  QUIZ_BASE_RATE,
  QUIZ_COOLDOWN_BLOCKS,
  QUIZ_FIRST_TRIGGER_AFTER_BLOCKS,
  QUIZ_FATIGUE_THRESHOLD,
  QUIZ_FATIGUE_PENALTY_PER_QUIZ,
  QUIZ_MIN_RATE,
} from '../../src/data/balance'

// Stub Svelte store imports so QuizManager can be imported in Node environment
vi.mock('svelte/store', () => ({
  get: vi.fn(() => null),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
}))

vi.mock('../../src/ui/stores/gameState', () => ({
  currentScreen: { subscribe: vi.fn(), set: vi.fn() },
  activeQuiz: { subscribe: vi.fn(), set: vi.fn() },
  gaiaMessage: { subscribe: vi.fn(), set: vi.fn() },
  currentLayer: { subscribe: vi.fn() },
}))

vi.mock('../../src/ui/stores/playerData', () => ({
  playerSave: { subscribe: vi.fn() },
  updateReviewState: vi.fn(),
}))

vi.mock('../../src/services/analyticsService', () => ({
  analyticsService: { track: vi.fn() },
}))

import { QuizManager } from '../../src/game/managers/QuizManager'

describe('Quiz rate balance constants', () => {
  it('QUIZ_BASE_RATE is 0.08 (8%)', () => {
    expect(QUIZ_BASE_RATE).toBe(0.08)
  })

  it('QUIZ_COOLDOWN_BLOCKS is positive', () => {
    expect(QUIZ_COOLDOWN_BLOCKS).toBeGreaterThan(0)
  })

  it('QUIZ_FIRST_TRIGGER_AFTER_BLOCKS is 10', () => {
    expect(QUIZ_FIRST_TRIGGER_AFTER_BLOCKS).toBe(10)
  })

  it('QUIZ_MIN_RATE > 0 (always a non-zero chance)', () => {
    expect(QUIZ_MIN_RATE).toBeGreaterThan(0)
  })
})

describe('QuizManager.shouldTriggerQuiz', () => {
  let qm: QuizManager

  beforeEach(() => {
    qm = new QuizManager(() => null, vi.fn())
    qm.resetForDive()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not trigger before QUIZ_FIRST_TRIGGER_AFTER_BLOCKS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // would trigger if allowed
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS - 1; i++) {
      expect(qm.shouldTriggerQuiz()).toBe(false)
    }
  })

  it('can trigger at or after QUIZ_FIRST_TRIGGER_AFTER_BLOCKS when random is low', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // always below any rate threshold

    // Advance to exactly first-trigger threshold, then advance one more to satisfy cooldown too
    // The first trigger requires: totalBlocks >= FIRST_TRIGGER && blocksSinceLastQuiz >= COOLDOWN_BLOCKS
    // Since we start fresh, blocksSinceLastQuiz == totalBlocksThisDive
    const blocksNeeded = Math.max(QUIZ_FIRST_TRIGGER_AFTER_BLOCKS, QUIZ_COOLDOWN_BLOCKS)
    let triggered = false
    for (let i = 0; i < blocksNeeded + 5; i++) {
      if (qm.shouldTriggerQuiz()) {
        triggered = true
        break
      }
    }
    expect(triggered).toBe(true)
  })

  it('respects cooldown — does not trigger again within QUIZ_COOLDOWN_BLOCKS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // always trigger if rate check passes

    // Advance to just before first-trigger threshold (no trigger yet)
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS - 1; i++) {
      qm.shouldTriggerQuiz()
    }
    // This block (index = QUIZ_FIRST_TRIGGER_AFTER_BLOCKS - 1) reaches the threshold
    // but blocksSinceLastQuiz == QUIZ_COOLDOWN_BLOCKS is not yet met, so no trigger
    // Keep advancing until cooldown is clear and trigger fires
    let triggered = false
    for (let i = 0; i < QUIZ_COOLDOWN_BLOCKS + 5; i++) {
      if (qm.shouldTriggerQuiz()) {
        triggered = true
        break
      }
    }
    expect(triggered).toBe(true)

    // Immediately after trigger, next blocks should be in cooldown
    let anyAfter = false
    for (let i = 0; i < QUIZ_COOLDOWN_BLOCKS - 1; i++) {
      if (qm.shouldTriggerQuiz()) anyAfter = true
    }
    expect(anyAfter).toBe(false)
  })

  it('does not trigger when Math.random() returns 1 (always above rate)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    // Advance way past all thresholds
    let anyTriggered = false
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS + QUIZ_COOLDOWN_BLOCKS + 50; i++) {
      if (qm.shouldTriggerQuiz()) anyTriggered = true
    }
    expect(anyTriggered).toBe(false)
  })

  it('devForceQuizEveryBlock triggers every block after first-trigger threshold', () => {
    qm.devForceQuizEveryBlock = true
    // Advance past first-trigger threshold
    for (let i = 0; i < QUIZ_FIRST_TRIGGER_AFTER_BLOCKS; i++) {
      qm.shouldTriggerQuiz()
    }
    expect(qm.shouldTriggerQuiz()).toBe(true)
    expect(qm.shouldTriggerQuiz()).toBe(true)
    expect(qm.shouldTriggerQuiz()).toBe(true)
  })

  it('resetForDive does not throw', () => {
    expect(() => qm.resetForDive()).not.toThrow()
  })

  it('NARRATIVE_FRAMES are defined strings', () => {
    expect(typeof QuizManager.NARRATIVE_FRAMES.popQuiz).toBe('string')
    expect(typeof QuizManager.NARRATIVE_FRAMES.gate).toBe('string')
    expect(typeof QuizManager.NARRATIVE_FRAMES.artifact).toBe('string')
  })
})
