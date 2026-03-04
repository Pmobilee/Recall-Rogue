import type { ReviewState } from '../../src/data/types'

/**
 * Creates a minimal ReviewState fixture for SM-2 and quiz tests.
 */
export function makeReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    factId: 'fact-001',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
    ...overrides,
  }
}
