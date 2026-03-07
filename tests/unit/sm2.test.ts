// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createReviewState,
  reviewCard,
  reviewCardEarly,
  reviewFact,
  isDue,
  isMastered,
  getMasteryLevel,
  getButtonIntervals,
} from '../../src/services/sm2'
import type { AnkiButton } from '../../src/services/sm2'
import {
  BALANCE,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
  SM2_LEARNING_STEPS,
  SM2_RELEARNING_STEPS,
  SM2_GRADUATING_INTERVAL,
  SM2_EASY_INTERVAL,
  SM2_LAPSE_NEW_INTERVAL_PCT,
  SM2_LEECH_THRESHOLD,
} from '../../src/data/balance'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MIN = 60 * 1000
const NOW = 1_700_000_000_000

/** Advance a new card through learning steps to reach review state via 'okay'. */
function advanceToReview(factId = 'f'): import('../../src/data/types').ReviewState {
  let s = createReviewState(factId)
  s = reviewCard(s, 'okay') // step 0 -> step 1
  s = reviewCard(s, 'okay') // step 1 (final) -> graduate to review
  return s
}

// ---------------------------------------------------------------------------
// createReviewState
// ---------------------------------------------------------------------------
describe('createReviewState', () => {
  it('creates state with cardState "new"', () => {
    const s = createReviewState('fact-001')
    expect(s.cardState).toBe('new')
  })

  it('creates state with learningStep 0', () => {
    const s = createReviewState('fact-001')
    expect(s.learningStep).toBe(0)
  })

  it('creates state with lapseCount 0 and isLeech false', () => {
    const s = createReviewState('fact-001')
    expect(s.lapseCount).toBe(0)
    expect(s.isLeech).toBe(false)
  })

  it('creates state with interval 0 and nextReviewAt 0 (immediately due)', () => {
    const s = createReviewState('fact-001')
    expect(s.factId).toBe('fact-001')
    expect(s.interval).toBe(0)
    expect(s.nextReviewAt).toBe(0)
    expect(s.easeFactor).toBe(BALANCE.SM2_INITIAL_EASE)
  })

  it('creates state with repetitions 0 and quality 0', () => {
    const s = createReviewState('fact-001')
    expect(s.repetitions).toBe(0)
    expect(s.quality).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Learning state transitions (new / learning)
// ---------------------------------------------------------------------------
describe('reviewCard — learning state transitions (new/learning)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('Again resets to step 0 with delay = LEARNING_STEPS[0] minutes', () => {
    const s = createReviewState('f')
    const next = reviewCard(s, 'again')
    expect(next.cardState).toBe('learning')
    expect(next.learningStep).toBe(0)
    expect(next.nextReviewAt).toBe(NOW + SM2_LEARNING_STEPS[0] * MS_PER_MIN)
  })

  it('Okay on step 0 advances to step 1 with delay = LEARNING_STEPS[1]', () => {
    const s = createReviewState('f')
    const next = reviewCard(s, 'okay')
    expect(next.cardState).toBe('learning')
    expect(next.learningStep).toBe(1)
    expect(next.nextReviewAt).toBe(NOW + SM2_LEARNING_STEPS[1] * MS_PER_MIN)
  })

  it('Okay on final step graduates to review with interval = GRADUATING_INTERVAL', () => {
    let s = createReviewState('f')
    s = reviewCard(s, 'okay') // step 0 -> step 1
    const graduated = reviewCard(s, 'okay') // step 1 (final) -> graduate
    expect(graduated.cardState).toBe('review')
    expect(graduated.interval).toBe(SM2_GRADUATING_INTERVAL)
    expect(graduated.nextReviewAt).toBe(NOW + SM2_GRADUATING_INTERVAL * MS_PER_DAY)
    expect(graduated.learningStep).toBe(0) // reset on graduation
  })

  it('Good from any step graduates to review with interval = EASY_INTERVAL', () => {
    const s = createReviewState('f')
    const graduated = reviewCard(s, 'good')
    expect(graduated.cardState).toBe('review')
    expect(graduated.interval).toBe(SM2_EASY_INTERVAL)
    expect(graduated.nextReviewAt).toBe(NOW + SM2_EASY_INTERVAL * MS_PER_DAY)
    expect(graduated.easeFactor).toBeGreaterThanOrEqual(BALANCE.SM2_INITIAL_EASE + 0.15)
  })

  it('Good from step 1 also graduates immediately', () => {
    let s = createReviewState('f')
    s = reviewCard(s, 'okay') // advance to step 1
    const graduated = reviewCard(s, 'good')
    expect(graduated.cardState).toBe('review')
    expect(graduated.interval).toBe(SM2_EASY_INTERVAL)
  })
})

// ---------------------------------------------------------------------------
// Review state transitions
// ---------------------------------------------------------------------------
describe('reviewCard — review state transitions', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('Again enters relearning, ease -0.20, lapseCount++, learningStep=0', () => {
    const s = advanceToReview()
    const prevEase = s.easeFactor
    const next = reviewCard(s, 'again')
    expect(next.cardState).toBe('relearning')
    expect(next.easeFactor).toBeCloseTo(Math.max(prevEase - 0.20, BALANCE.SM2_MIN_EASE), 5)
    expect(next.lapseCount).toBe(s.lapseCount + 1)
    expect(next.learningStep).toBe(0)
    // Delay is first relearning step in minutes
    expect(next.nextReviewAt).toBe(NOW + SM2_RELEARNING_STEPS[0] * MS_PER_MIN)
  })

  it('Okay stays review, interval * ease', () => {
    const s = advanceToReview()
    const next = reviewCard(s, 'okay')
    expect(next.cardState).toBe('review')
    const expectedInterval = Math.max(s.interval + 1, Math.round(s.interval * s.easeFactor))
    expect(next.interval).toBe(expectedInterval)
    // Ease unchanged
    expect(next.easeFactor).toBe(s.easeFactor)
  })

  it('Good stays review, interval * ease * 1.3, ease +0.15', () => {
    const s = advanceToReview()
    const next = reviewCard(s, 'good')
    expect(next.cardState).toBe('review')
    const expectedInterval = Math.max(s.interval + 1, Math.round(s.interval * s.easeFactor * 1.3))
    expect(next.interval).toBe(expectedInterval)
    expect(next.easeFactor).toBeCloseTo(s.easeFactor + 0.15, 5)
  })

  it('All review intervals are at least 1 day longer than previous', () => {
    const s = advanceToReview()
    for (const btn of ['okay', 'good'] as AnkiButton[]) {
      const next = reviewCard(s, btn)
      expect(next.interval).toBeGreaterThanOrEqual(s.interval + 1)
    }
  })
})

// ---------------------------------------------------------------------------
// Relearning state
// ---------------------------------------------------------------------------
describe('reviewCard — relearning state', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('Again stays relearning at step 0', () => {
    const reviewed = advanceToReview()
    const lapsed = reviewCard(reviewed, 'again') // -> relearning
    const next = reviewCard(lapsed, 'again')
    expect(next.cardState).toBe('relearning')
    expect(next.learningStep).toBe(0)
  })

  it('Okay on final relearning step graduates back to review with interval = max(1, old * 0.7)', () => {
    const reviewed = advanceToReview()
    // Give it a meaningful interval first
    const withInterval = { ...reviewed, interval: 10 }
    const lapsed = reviewCard(withInterval, 'again') // -> relearning, interval still 10
    // SM2_RELEARNING_STEPS has only 1 step [10], so step 0 is already final
    const graduated = reviewCard(lapsed, 'okay')
    expect(graduated.cardState).toBe('review')
    const expectedInterval = Math.max(1, Math.round(lapsed.interval * SM2_LAPSE_NEW_INTERVAL_PCT))
    expect(graduated.interval).toBe(expectedInterval)
  })

  it('Good from relearning graduates with max(EASY_INTERVAL, old * 0.7)', () => {
    const reviewed = advanceToReview()
    const withInterval = { ...reviewed, interval: 10 }
    const lapsed = reviewCard(withInterval, 'again') // -> relearning
    const graduated = reviewCard(lapsed, 'good')
    expect(graduated.cardState).toBe('review')
    const expectedInterval = Math.max(SM2_EASY_INTERVAL, Math.round(lapsed.interval * SM2_LAPSE_NEW_INTERVAL_PCT))
    expect(graduated.interval).toBe(expectedInterval)
  })
})

// ---------------------------------------------------------------------------
// Leech detection
// ---------------------------------------------------------------------------
describe('reviewCard — leech detection', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it(`auto-suspends after ${SM2_LEECH_THRESHOLD} lapses`, () => {
    let s = advanceToReview()
    for (let i = 0; i < SM2_LEECH_THRESHOLD - 1; i++) {
      s = reviewCard(s, 'again')
      s = reviewCard(s, 'okay')  // graduate back
    }
    // One more lapse should trigger auto-suspend
    s = reviewCard(s, 'again')
    expect(s.cardState).toBe('suspended')
    expect(s.lapseCount).toBe(SM2_LEECH_THRESHOLD)
    expect(s.isLeech).toBe(true)
  })

  it('isLeech is false just below threshold', () => {
    let s = advanceToReview()
    for (let i = 0; i < SM2_LEECH_THRESHOLD - 1; i++) {
      s = reviewCard(s, 'again')
      s = reviewCard(s, 'okay')
    }
    expect(s.lapseCount).toBe(SM2_LEECH_THRESHOLD - 1)
    expect(s.isLeech).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Ease floor
// ---------------------------------------------------------------------------
describe('reviewCard — ease floor', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('repeated Again never drops ease below 1.3', () => {
    let s = advanceToReview()
    for (let i = 0; i < SM2_LEECH_THRESHOLD - 1; i++) {
      s = reviewCard(s, 'again') // lapse -> relearning (ease -0.20)
      s = reviewCard(s, 'okay')  // graduate back to review
    }
    expect(s.easeFactor).toBeGreaterThanOrEqual(BALANCE.SM2_MIN_EASE)
  })
})

// ---------------------------------------------------------------------------
// getButtonIntervals
// ---------------------------------------------------------------------------
describe('getButtonIntervals', () => {
  it('learning state returns minute-based string for again', () => {
    const s = createReviewState('f')
    const intervals = getButtonIntervals(s)
    // again = LEARNING_STEPS[0] = 1 minute
    expect(intervals.again).toBe('1m')
    // 3 buttons only
    expect(Object.keys(intervals)).toHaveLength(3)
  })

  it('learning state on last step shows day for okay (graduation)', () => {
    let s = createReviewState('f')
    s = reviewCard(s, 'okay') // now on step 1 (final step)
    const intervals = getButtonIntervals(s)
    // okay on last step = GRADUATING_INTERVAL days
    expect(intervals.okay).toBe(`${SM2_GRADUATING_INTERVAL}d`)
    // good = EASY_INTERVAL days
    expect(intervals.good).toBe(`${SM2_EASY_INTERVAL}d`)
  })

  it('review state returns minute for again (relearning) and days for okay/good', () => {
    const s = advanceToReview()
    const intervals = getButtonIntervals(s)
    // again = first relearning step in minutes
    expect(intervals.again).toBe(`${SM2_RELEARNING_STEPS[0]}m`)
    // okay/good are day-based
    expect(intervals.okay).toMatch(/^\d+d$/)
    expect(intervals.good).toMatch(/^\d+d$/)
    // 3 buttons only
    expect(Object.keys(intervals)).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// reviewFact backward compatibility
// ---------------------------------------------------------------------------
describe('reviewFact — backward compatibility', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('true maps to "okay" button behavior', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, true)
    const viaCard = reviewCard(s, 'okay')
    expect(viaFact.cardState).toBe(viaCard.cardState)
    expect(viaFact.learningStep).toBe(viaCard.learningStep)
    expect(viaFact.interval).toBe(viaCard.interval)
  })

  it('false maps to "again" button behavior', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, false)
    const viaCard = reviewCard(s, 'again')
    expect(viaFact.cardState).toBe(viaCard.cardState)
    expect(viaFact.learningStep).toBe(viaCard.learningStep)
  })

  it('5 maps to "good"', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, 5)
    const viaCard = reviewCard(s, 'good')
    expect(viaFact.cardState).toBe(viaCard.cardState)
    expect(viaFact.interval).toBe(viaCard.interval)
  })

  it('3 maps to "okay"', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, 3)
    const viaCard = reviewCard(s, 'okay')
    expect(viaFact.learningStep).toBe(viaCard.learningStep)
  })

  it('2 maps to "again"', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, 2)
    const viaCard = reviewCard(s, 'again')
    expect(viaFact.cardState).toBe(viaCard.cardState)
    expect(viaFact.learningStep).toBe(viaCard.learningStep)
  })

  it('1 maps to "again"', () => {
    const s = createReviewState('f')
    const viaFact = reviewFact(s, 1)
    const viaCard = reviewCard(s, 'again')
    expect(viaFact.cardState).toBe(viaCard.cardState)
    expect(viaFact.learningStep).toBe(viaCard.learningStep)
  })
})

// ---------------------------------------------------------------------------
// isDue
// ---------------------------------------------------------------------------
describe('isDue', () => {
  it('returns true when nextReviewAt is 0 (new card)', () => {
    const s = createReviewState('f')
    expect(isDue(s)).toBe(true)
  })

  it('returns false when nextReviewAt is in the future', () => {
    vi.useFakeTimers({ now: NOW })
    const s = createReviewState('f')
    const next = reviewCard(s, 'okay')
    expect(isDue(next)).toBe(false)
    vi.useRealTimers()
  })

  it('returns true when nextReviewAt has passed', () => {
    vi.useFakeTimers({ now: NOW })
    const s = createReviewState('f')
    const next = reviewCard(s, 'okay') // nextReviewAt = NOW + 10 minutes
    vi.setSystemTime(NOW + 2 * MS_PER_DAY) // well past due
    expect(isDue(next)).toBe(true)
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// isMastered
// ---------------------------------------------------------------------------
describe('isMastered', () => {
  it('fact mastery threshold is SM2_MASTERY_INTERVAL_GENERAL (60 days)', () => {
    expect(SM2_MASTERY_INTERVAL_GENERAL).toBe(60)
  })

  it('vocab mastery threshold is SM2_MASTERY_INTERVAL_VOCAB (30 days)', () => {
    expect(SM2_MASTERY_INTERVAL_VOCAB).toBe(30)
  })

  it('requires cardState="review" — learning card with high interval is NOT mastered', () => {
    const s = { ...createReviewState('f'), interval: 100, cardState: 'learning' as const }
    expect(isMastered(s, 'fact')).toBe(false)
  })

  it('fact not mastered at interval 59 days (review state)', () => {
    const s = { ...createReviewState('f'), interval: 59, cardState: 'review' as const }
    expect(isMastered(s, 'fact')).toBe(false)
  })

  it('fact mastered at interval 60 days (review state)', () => {
    const s = { ...createReviewState('f'), interval: 60, cardState: 'review' as const }
    expect(isMastered(s, 'fact')).toBe(true)
  })

  it('vocab mastered at interval 30 days (lower threshold)', () => {
    const s = { ...createReviewState('f'), interval: 30, cardState: 'review' as const }
    expect(isMastered(s, 'vocabulary')).toBe(true)
    expect(isMastered(s, 'fact')).toBe(false)
  })

  it('phrase uses vocab threshold (30 days)', () => {
    const s = { ...createReviewState('f'), interval: 30, cardState: 'review' as const }
    expect(isMastered(s, 'phrase')).toBe(true)
  })

  it('grammar uses vocab threshold (30 days)', () => {
    const s = { ...createReviewState('f'), interval: 30, cardState: 'review' as const }
    expect(isMastered(s, 'grammar')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getMasteryLevel
// ---------------------------------------------------------------------------
describe('getMasteryLevel', () => {
  it('cardState="new" returns "new"', () => {
    const s = createReviewState('f')
    expect(getMasteryLevel(s)).toBe('new')
  })

  it('cardState="learning" returns "learning" regardless of interval', () => {
    const s = { ...createReviewState('f'), cardState: 'learning' as const, interval: 60 }
    expect(getMasteryLevel(s)).toBe('learning')
  })

  it('cardState="relearning" returns "learning"', () => {
    const s = { ...createReviewState('f'), cardState: 'relearning' as const, interval: 10 }
    expect(getMasteryLevel(s)).toBe('learning')
  })

  it('review interval 1 returns "learning" for fact', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 1 }
    expect(getMasteryLevel(s, 'fact')).toBe('learning')
  })

  it('review interval 7 returns "familiar" for fact', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 7 }
    expect(getMasteryLevel(s, 'fact')).toBe('familiar')
  })

  it('review interval 20 returns "known" for fact', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 20 }
    expect(getMasteryLevel(s, 'fact')).toBe('known')
  })

  it('review interval 61 returns "mastered" for fact', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 61 }
    expect(getMasteryLevel(s, 'fact')).toBe('mastered')
  })

  it('vocab interval 2 returns "learning"', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 2 }
    expect(getMasteryLevel(s, 'vocabulary')).toBe('learning')
  })

  it('vocab interval 5 returns "familiar"', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 5 }
    expect(getMasteryLevel(s, 'vocabulary')).toBe('familiar')
  })

  it('phrase interval 10 returns "known"', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 10 }
    expect(getMasteryLevel(s, 'phrase')).toBe('known')
  })

  it('phrase interval 35 returns "mastered"', () => {
    const s = { ...createReviewState('f'), cardState: 'review' as const, interval: 35 }
    expect(getMasteryLevel(s, 'phrase')).toBe('mastered')
  })
})

// ---------------------------------------------------------------------------
// reviewCardEarly
// ---------------------------------------------------------------------------
describe('reviewCardEarly', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('gives full credit when proportion >= 0.9', () => {
    const s = { ...advanceToReview(), interval: 10 }
    const normal = reviewCard(s, 'okay')
    const early = reviewCardEarly(s, 'okay', 0.95)
    expect(early.interval).toBe(normal.interval)
  })

  it('gives minimal credit when proportion < 0.25', () => {
    const s = { ...advanceToReview(), interval: 10 }
    const normal = reviewCard(s, 'okay')
    const early = reviewCardEarly(s, 'okay', 0.1)
    const normalGain = normal.interval - s.interval
    const earlyGain = early.interval - s.interval
    // Should be ~10% of normal gain
    expect(earlyGain).toBeLessThanOrEqual(Math.ceil(normalGain * 0.15))
    expect(earlyGain).toBeGreaterThanOrEqual(0)
  })

  it('gives partial credit at proportion 0.5', () => {
    const s = { ...advanceToReview(), interval: 10 }
    const normal = reviewCard(s, 'okay')
    const early = reviewCardEarly(s, 'okay', 0.5)
    expect(early.interval).toBeGreaterThan(s.interval)
    expect(early.interval).toBeLessThan(normal.interval)
  })

  it('never reduces interval below current', () => {
    const s = { ...advanceToReview(), interval: 10 }
    const early = reviewCardEarly(s, 'okay', 0.01)
    expect(early.interval).toBeGreaterThanOrEqual(s.interval)
  })

  it('falls back to normal reviewCard for non-review states', () => {
    const s = createReviewState('f')
    const normal = reviewCard(s, 'okay')
    const early = reviewCardEarly(s, 'okay', 0.5)
    expect(early.cardState).toBe(normal.cardState)
    expect(early.interval).toBe(normal.interval)
  })
})
