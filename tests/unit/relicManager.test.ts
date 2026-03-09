import { describe, expect, it } from 'vitest'
import { assignRelicOnGraduation, buildActiveRelics, checkRelicDormancy } from '../../src/services/relicManager'
import type { ActiveRelic } from '../../src/data/passiveRelics'
import type { ReviewState } from '../../src/data/types'

function review(overrides: Partial<ReviewState>): ReviewState {
  return {
    factId: overrides.factId ?? 'fact_1',
    cardState: 'review',
    easeFactor: 2.5,
    interval: overrides.interval ?? 30,
    repetitions: overrides.repetitions ?? 7,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 4,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability: overrides.stability ?? 30,
    consecutiveCorrect: overrides.consecutiveCorrect ?? 7,
    passedMasteryTrial: overrides.passedMasteryTrial ?? true,
    retrievability: overrides.retrievability ?? 1,
    masteredAt: overrides.masteredAt ?? 100,
    graduatedRelicId: overrides.graduatedRelicId,
  }
}

describe('relicManager', () => {
  it('assigns relic from matching graduation type', () => {
    const relic = assignRelicOnGraduation('attack', [])
    expect(relic).not.toBeNull()
    expect(relic?.graduationType.includes('attack')).toBe(true)
  })

  it('builds active relics from tier-3 states with cap enforcement', () => {
    const states = Array.from({ length: 15 }, (_, i) => review({
      factId: `fact_${i}`,
      masteredAt: 100 + i,
    }))

    const relics = buildActiveRelics(states, () => 'attack')
    expect(relics.length).toBeLessThanOrEqual(12)
  })

  it('marks relics dormant under retrievability threshold', () => {
    const relics: ActiveRelic[] = buildActiveRelics(
      [review({ factId: 'fact_1', retrievability: 0.9 })],
      () => 'attack',
    )

    checkRelicDormancy(relics, new Map([['fact_1', { retrievability: 0.6 }]]))
    expect(relics[0]?.isDormant).toBe(true)
  })
})
