import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/services/apiClient'
import {
  completeDailyExpeditionAttempt,
  getDailyExpeditionGlobalLeaderboard,
  getDailyExpeditionStatus,
  reserveDailyExpeditionAttempt,
} from '../../src/services/dailyExpeditionService'

const STORAGE_KEY = 'recall-rogue-daily-expedition-v1'

describe('dailyExpeditionService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    vi.restoreAllMocks()
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

  it('maps global rows and returns null on API failures without cache', async () => {
    vi.spyOn(apiClient, 'getLeaderboard').mockResolvedValueOnce([
      {
        rank: 4,
        userId: 'daily-u',
        displayName: '',
        score: 3210,
      },
    ] as never)

    const mapped = await getDailyExpeditionGlobalLeaderboard('2026-03-10', 5)
    expect(mapped).toEqual([
      {
        rank: 4,
        playerId: 'daily-u',
        playerName: 'Rogue',
        score: 3210,
        source: 'player',
      },
    ])

    vi.spyOn(apiClient, 'getLeaderboard').mockRejectedValueOnce(new Error('boom'))
    const failed = await getDailyExpeditionGlobalLeaderboard('2026-03-11', 5)
    expect(failed).toBeNull()
  })

  it('falls back to cached global leaderboard when API call times out', async () => {
    vi.useFakeTimers()
    try {
      const spy = vi.spyOn(apiClient, 'getLeaderboard')
      spy.mockResolvedValueOnce([
        {
          rank: 1,
          userId: 'cached-u',
          displayName: 'Cached',
          score: 9999,
        },
      ] as never)

      const first = await getDailyExpeditionGlobalLeaderboard('2026-03-10', 7)
      expect(first?.[0]?.playerName).toBe('Cached')

      spy.mockImplementationOnce(((_category, _limit, opts) => new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as never)

      const pending = getDailyExpeditionGlobalLeaderboard('2026-03-10', 7)
      await vi.advanceTimersByTimeAsync(4000)
      const cached = await pending

      expect(cached).toEqual(first)
    } finally {
      vi.useRealTimers()
    }
  })
})
