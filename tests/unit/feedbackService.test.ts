import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackService } from '../../src/services/feedbackService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('feedbackService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('posts feedback payload to /feedback', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await feedbackService.submit({
      userId: 'u1',
      feedback: 'Great update',
      timestamp: 123,
      accountId: null,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/feedback$/)
    const [, init] = fetchMock.mock.calls[0]
    const parsed = JSON.parse(String(init?.body))
    expect(parsed.feedback).toBe('Great update')
  })
})
