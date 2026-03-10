import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../src/services/apiClient'
import { ScoreSubmissionQueue } from '../../src/services/scoreSubmissionQueue'

const STORAGE_KEY = 'recall-rogue-score-submission-queue-v1'

function setOnlineStatus(online: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: online,
  })
}

describe('scoreSubmissionQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.removeItem(STORAGE_KEY)
    setOnlineStatus(true)
  })

  it('submits queued scores successfully and clears queue', async () => {
    vi.spyOn(apiClient, 'isLoggedIn').mockReturnValue(true)
    const submitSpy = vi.spyOn(apiClient, 'submitScore').mockResolvedValue(undefined)
    const queue = new ScoreSubmissionQueue()
    setOnlineStatus(false)

    queue.enqueue('daily_expedition', 4321, { dateKey: '2026-03-10' })
    setOnlineStatus(true)
    await queue.flush()

    expect(submitSpy).toHaveBeenCalledWith('daily_expedition', 4321, { dateKey: '2026-03-10' })
    expect(queue.getPendingCount()).toBe(0)
  })

  it('keeps scores queued while offline and flushes once online', async () => {
    vi.spyOn(apiClient, 'isLoggedIn').mockReturnValue(true)
    const submitSpy = vi.spyOn(apiClient, 'submitScore').mockResolvedValue(undefined)
    const queue = new ScoreSubmissionQueue()
    setOnlineStatus(false)

    queue.enqueue('endless_depths', 9999, { floorReached: 22 })
    await queue.flush()
    expect(submitSpy).not.toHaveBeenCalled()
    expect(queue.getPendingCount()).toBe(1)

    setOnlineStatus(true)
    await queue.flush()
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(queue.getPendingCount()).toBe(0)
  })

  it('restores queued scores from localStorage after a new queue instance is created', async () => {
    vi.spyOn(apiClient, 'isLoggedIn').mockReturnValue(true)
    const submitSpy = vi.spyOn(apiClient, 'submitScore').mockResolvedValue(undefined)
    setOnlineStatus(false)

    const firstInstance = new ScoreSubmissionQueue()
    firstInstance.enqueue('daily_expedition', 1200, { dateKey: '2026-03-10' })
    expect(firstInstance.getPendingCount()).toBe(1)

    const secondInstance = new ScoreSubmissionQueue()
    expect(secondInstance.getPendingCount()).toBe(1)

    setOnlineStatus(true)
    await secondInstance.flush()
    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(secondInstance.getPendingCount()).toBe(0)
  })

  it('flushes queued scores when browser online event fires after init', async () => {
    vi.spyOn(apiClient, 'isLoggedIn').mockReturnValue(true)
    const submitSpy = vi.spyOn(apiClient, 'submitScore').mockResolvedValue(undefined)
    const queue = new ScoreSubmissionQueue()
    setOnlineStatus(false)
    queue.init()

    queue.enqueue('endless_depths', 4321, { floorReached: 15 })
    expect(queue.getPendingCount()).toBe(1)

    setOnlineStatus(true)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1)
    })
    expect(queue.getPendingCount()).toBe(0)
  })

  it('drops entries after five failed retry attempts', async () => {
    vi.spyOn(apiClient, 'isLoggedIn').mockReturnValue(true)
    vi.spyOn(apiClient, 'submitScore').mockRejectedValue(new Error('network'))
    const queue = new ScoreSubmissionQueue()
    setOnlineStatus(false)

    queue.enqueue('scholar_challenge', 777, { weekKey: '2026-03-09' })
    setOnlineStatus(true)
    for (let i = 0; i < 5; i += 1) {
      await queue.flush()
    }

    expect(queue.getPendingCount()).toBe(0)
  })
})
