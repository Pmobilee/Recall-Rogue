// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createReviewState,
  reviewFact,
  isDue,
  isMastered,
  getMasteryLevel,
} from '../../src/services/sm2'
import {
  BALANCE,
  SM2_SECOND_INTERVAL_DAYS,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
} from '../../src/data/balance'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000 // fixed reference timestamp

describe('createReviewState', () => {
  it('creates state with interval 0 and nextReviewAt 0 (immediately due)', () => {
    const state = createReviewState('fact-001')
    expect(state.factId).toBe('fact-001')
    expect(state.interval).toBe(0)
    expect(state.nextReviewAt).toBe(0)
    expect(state.easeFactor).toBe(BALANCE.SM2_INITIAL_EASE)
  })

  it('creates state with repetitions 0', () => {
    const state = createReviewState('fact-001')
    expect(state.repetitions).toBe(0)
  })

  it('creates state with quality 0', () => {
    const state = createReviewState('fact-001')
    expect(state.quality).toBe(0)
  })
})

describe('reviewFact — boolean API (legacy)', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('treats true as quality 5 (perfect recall)', () => {
    const state = createReviewState('fact-001')
    const next = reviewFact(state, true)
    expect(next.quality).toBe(5)
    expect(next.repetitions).toBe(1)
    expect(next.interval).toBe(1) // first rep = 1 day
  })

  it('treats false as quality 1 (reset)', () => {
    // Give the fact some history first
    const state = createReviewState('fact-001')
    const afterPass = reviewFact(reviewFact(state, true), true)
    // Now fail it
    const afterFail = reviewFact(afterPass, false)
    expect(afterFail.repetitions).toBe(0)
    expect(afterFail.interval).toBe(1)
    expect(afterFail.easeFactor).toBeCloseTo(
      Math.max(afterPass.easeFactor - 0.2, BALANCE.SM2_MIN_EASE),
      5,
    )
  })
})

describe('reviewFact — numeric quality API', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW }) })
  afterEach(() => { vi.useRealTimers() })

  it('quality 5 (easy) increases ease factor', () => {
    const state = createReviewState('fact-001')
    const next = reviewFact(state, 5)
    expect(next.easeFactor).toBeGreaterThan(BALANCE.SM2_INITIAL_EASE)
  })

  it('quality 3 (good) maintains ease factor close to initial', () => {
    const state = createReviewState('fact-001')
    const next = reviewFact(state, 3)
    // quality=3: delta = 0.1 - (5-3)*(0.08+(5-3)*0.02) = 0.1 - 2*(0.12) = 0.1 - 0.24 = -0.14
    // So ease goes down slightly. Just verify it's within range.
    expect(next.easeFactor).toBeGreaterThanOrEqual(BALANCE.SM2_MIN_EASE)
    expect(next.easeFactor).toBeLessThanOrEqual(BALANCE.SM2_INITIAL_EASE + 0.2)
  })

  it('quality 2 (hard/fail) resets repetitions and reduces ease', () => {
    // Advance to rep 3
    let state = createReviewState('fact-001')
    state = reviewFact(state, 5)
    state = reviewFact(state, 5)
    state = reviewFact(state, 5)
    const prevEase = state.easeFactor

    const next = reviewFact(state, 2)
    expect(next.repetitions).toBe(0)
    expect(next.interval).toBe(1)
    expect(next.easeFactor).toBeCloseTo(Math.max(prevEase - 0.2, BALANCE.SM2_MIN_EASE), 5)
  })

  it('second interval is SM2_SECOND_INTERVAL_DAYS (tuned from default 6)', () => {
    const s0 = createReviewState('f')
    const s1 = reviewFact(s0, 5)
    const s2 = reviewFact(s1, 5)
    expect(s1.interval).toBe(1)
    expect(s2.interval).toBe(SM2_SECOND_INTERVAL_DAYS) // 3 days per DD-V2-096
  })

  it('third interval uses ease factor multiplication', () => {
    let s = createReviewState('f')
    s = reviewFact(s, 5) // interval=1
    s = reviewFact(s, 5) // interval=SM2_SECOND_INTERVAL_DAYS
    const s3 = reviewFact(s, 5) // interval=round(SM2_SECOND * easeFactor)
    expect(s3.interval).toBe(Math.round(s.interval * s.easeFactor))
  })

  it('ease factor never drops below SM2_MIN_EASE', () => {
    let state = createReviewState('f')
    // Repeatedly fail
    for (let i = 0; i < 20; i++) {
      state = reviewFact(state, 0)
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(BALANCE.SM2_MIN_EASE)
  })

  it('nextReviewAt is in the future by interval days', () => {
    const state = createReviewState('f')
    const next = reviewFact(state, 5)
    expect(next.nextReviewAt).toBeCloseTo(NOW + next.interval * MS_PER_DAY, -2)
  })

  it('lastReviewAt is set to now', () => {
    const state = createReviewState('f')
    const next = reviewFact(state, 5)
    expect(next.lastReviewAt).toBe(NOW)
  })
})

describe('isDue', () => {
  it('returns true when nextReviewAt is 0 (new card)', () => {
    const state = createReviewState('f')
    expect(isDue(state)).toBe(true)
  })

  it('returns false when nextReviewAt is in the future', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('f')
    const next = reviewFact(state, 5)
    expect(isDue(next)).toBe(false)
    vi.useRealTimers()
  })

  it('returns true when nextReviewAt has passed', () => {
    vi.useFakeTimers({ now: NOW })
    const state = createReviewState('f')
    const next = reviewFact(state, 5) // nextReviewAt = NOW + 1 day
    vi.setSystemTime(NOW + 2 * MS_PER_DAY)
    expect(isDue(next)).toBe(true)
    vi.useRealTimers()
  })
})

describe('isMastered', () => {
  it('fact mastery threshold is SM2_MASTERY_INTERVAL_GENERAL (60 days)', () => {
    expect(SM2_MASTERY_INTERVAL_GENERAL).toBe(60)
  })

  it('vocab mastery threshold is SM2_MASTERY_INTERVAL_VOCAB (30 days)', () => {
    expect(SM2_MASTERY_INTERVAL_VOCAB).toBe(30)
  })

  it('fact not mastered at interval 59 days', () => {
    const state = { ...createReviewState('f'), interval: 59 }
    expect(isMastered(state, 'fact')).toBe(false)
  })

  it('fact mastered at interval 60 days', () => {
    const state = { ...createReviewState('f'), interval: 60 }
    expect(isMastered(state, 'fact')).toBe(true)
  })

  it('vocab mastered at interval 30 days (lower threshold)', () => {
    const state = { ...createReviewState('f'), interval: 30 }
    expect(isMastered(state, 'vocabulary')).toBe(true)
    expect(isMastered(state, 'fact')).toBe(false)
  })

  it('phrase uses vocab threshold (30 days)', () => {
    const state = { ...createReviewState('f'), interval: 30 }
    expect(isMastered(state, 'phrase')).toBe(true)
  })

  it('grammar uses vocab threshold (30 days)', () => {
    const state = { ...createReviewState('f'), interval: 30 }
    expect(isMastered(state, 'grammar')).toBe(true)
  })
})

describe('getMasteryLevel', () => {
  it('new card (interval 0) returns "new"', () => {
    const s = createReviewState('f')
    expect(getMasteryLevel(s)).toBe('new')
  })

  it('interval 1 returns "learning" for fact', () => {
    const s = { ...createReviewState('f'), interval: 1 }
    expect(getMasteryLevel(s, 'fact')).toBe('learning')
  })

  it('interval 7 returns "familiar" for fact', () => {
    const s = { ...createReviewState('f'), interval: 7 }
    expect(getMasteryLevel(s, 'fact')).toBe('familiar')
  })

  it('interval 20 returns "known" for fact', () => {
    const s = { ...createReviewState('f'), interval: 20 }
    expect(getMasteryLevel(s, 'fact')).toBe('known')
  })

  it('interval 61 returns "mastered" for fact', () => {
    const s = { ...createReviewState('f'), interval: 61 }
    expect(getMasteryLevel(s, 'fact')).toBe('mastered')
  })

  it('vocab interval 2 returns "learning"', () => {
    const s2 = { ...createReviewState('f'), interval: 2 }
    expect(getMasteryLevel(s2, 'vocabulary')).toBe('learning')
  })

  it('vocab interval 5 returns "familiar"', () => {
    const s8 = { ...createReviewState('f'), interval: 5 }
    expect(getMasteryLevel(s8, 'vocabulary')).toBe('familiar')
  })

  it('phrase interval 10 returns "known"', () => {
    const s = { ...createReviewState('f'), interval: 10 }
    expect(getMasteryLevel(s, 'phrase')).toBe('known')
  })

  it('phrase interval 35 returns "mastered"', () => {
    const s = { ...createReviewState('f'), interval: 35 }
    expect(getMasteryLevel(s, 'phrase')).toBe('mastered')
  })
})
