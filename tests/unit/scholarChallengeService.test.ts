import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/services/apiClient'
import {
  completeScholarChallengeAttempt,
  getScholarChallengeGlobalLeaderboard,
  getScholarChallengeStatus,
  reserveScholarChallengeAttempt,
} from '../../src/services/scholarChallengeService'

const STORAGE_KEY = 'recall-rogue-scholar-challenge-v1'

describe('scholarChallengeService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    vi.restoreAllMocks()
  })

  it('allows one weekly reservation and blocks duplicate attempts', () => {
    const first = reserveScholarChallengeAttempt('p1', 'Scholar')
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.attempt.primaryDomain).not.toBe(first.attempt.secondaryDomain)
    }

    const second = reserveScholarChallengeAttempt('p1', 'Scholar')
    expect(second).toEqual({ ok: false, reason: 'already_attempted_this_week' })
  })

  it('completes attempt with clamped metrics and exposes player rank', () => {
    const reserved = reserveScholarChallengeAttempt('p2', 'Weekly')
    expect(reserved.ok).toBe(true)

    const completed = completeScholarChallengeAttempt({
      score: 999999,
      floorReached: 27,
      accuracy: 120,
      bestCombo: 11,
      runDurationMs: 123456,
    })

    expect(completed).not.toBeNull()
    expect(completed?.status).toBe('completed')
    expect(completed?.accuracy).toBe(100)

    const status = getScholarChallengeStatus()
    expect(status.canAttempt).toBe(false)
    expect(status.playerRank).not.toBeNull()
  })

  it('maps global rows and returns null on API failure', async () => {
    const weekKey = getScholarChallengeStatus().weekKey
    vi.spyOn(apiClient, 'getLeaderboard').mockResolvedValueOnce([
      {
        rank: 2,
        userId: 'u2',
        displayName: '',
        score: 4321,
      },
    ] as never)

    const mapped = await getScholarChallengeGlobalLeaderboard(weekKey, 5)
    expect(mapped).toEqual([
      {
        rank: 2,
        playerId: 'u2',
        playerName: 'Rogue',
        score: 4321,
        source: 'player',
      },
    ])

    vi.spyOn(apiClient, 'getLeaderboard').mockRejectedValueOnce(new Error('net'))
    const failed = await getScholarChallengeGlobalLeaderboard(weekKey, 5)
    expect(failed).toBeNull()
  })
})
