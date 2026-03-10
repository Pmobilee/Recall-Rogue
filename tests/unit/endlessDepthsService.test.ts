import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/services/apiClient'
import {
  getEndlessDepthsGlobalLeaderboard,
  getEndlessDepthsLeaderboard,
  recordEndlessDepthsRun,
} from '../../src/services/endlessDepthsService'

const STORAGE_KEY = 'recall-rogue-endless-depths-v1'

describe('endlessDepthsService', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    vi.restoreAllMocks()
  })

  it('records runs, trims names, and surfaces player scores in leaderboard', () => {
    recordEndlessDepthsRun('player-1', '   ', 50000, 33)
    const board = getEndlessDepthsLeaderboard(5)

    expect(board[0].source).toBe('player')
    expect(board[0].playerName).toBe('Rogue')
    expect(board[0].score).toBe(50000)
    expect(board[0].floorReached).toBe(33)
  })

  it('keeps at most 40 local records', () => {
    for (let i = 0; i < 45; i += 1) {
      recordEndlessDepthsRun(`p-${i}`, `P${i}`, i * 1000, i)
    }
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as { records: unknown[] } : { records: [] }
    expect(parsed.records.length).toBe(40)
  })

  it('maps global leaderboard rows and falls back to null on fetch errors', async () => {
    vi.spyOn(apiClient, 'getLeaderboard').mockResolvedValueOnce([
      {
        rank: 1,
        userId: 'u1',
        displayName: 'Runner',
        score: 7777,
        metadata: { floorReached: 21 },
      },
    ] as never)

    const mapped = await getEndlessDepthsGlobalLeaderboard(3)
    expect(mapped).toEqual([
      {
        rank: 1,
        playerId: 'u1',
        playerName: 'Runner',
        score: 7777,
        floorReached: 21,
        source: 'player',
      },
    ])

    vi.spyOn(apiClient, 'getLeaderboard').mockRejectedValueOnce(new Error('boom'))
    const failed = await getEndlessDepthsGlobalLeaderboard(3)
    expect(failed).toBeNull()
  })
})
