import { beforeEach, describe, expect, it } from 'vitest'
import {
  completeDailyExpeditionAttempt,
  getDailyExpeditionStatus,
  reserveDailyExpeditionAttempt,
} from '../../src/services/dailyExpeditionService'

const STORAGE_KEY = 'recall-rogue-daily-expedition-v1'

describe('dailyExpeditionService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  })

  it('exposes reward-band preview before any attempt', () => {
    const status = getDailyExpeditionStatus()
    expect(status.canAttempt).toBe(true)
    expect(status.rewardBand).toBeNull()
    expect(status.rewardPreview.length).toBe(4)
  })

  it('assigns top reward band for a high-scoring completed run', () => {
    const reserved = reserveDailyExpeditionAttempt('player-1', 'Tester')
    expect(reserved.ok).toBe(true)

    const completed = completeDailyExpeditionAttempt({
      score: 999_999,
      floorReached: 24,
      accuracy: 99,
      bestCombo: 9,
      runDurationMs: 180_000,
    })

    expect(completed).not.toBeNull()

    const status = getDailyExpeditionStatus()
    expect(status.canAttempt).toBe(false)
    expect(status.playerRank).toBe(1)
    expect(status.rewardBand).toBe('top_10')
    expect(status.rewardLabel).toContain('Top 10%')
  })
})
