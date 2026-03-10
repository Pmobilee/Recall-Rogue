import { afterEach, describe, expect, it, vi } from 'vitest'
import { referralService } from '../../src/services/referralService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('referralService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('loads referral code from /referrals/my-code', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ code: 'ABC12345' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(referralService.getMyCode()).resolves.toEqual({ code: 'ABC12345' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/referrals\/my-code$/)
  })

  it('loads referral history from /referrals/my-history', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ history: [{ inviteeId: 'u1' }] }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const data = await referralService.getMyHistory()
    expect(Array.isArray(data.history)).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/referrals\/my-history$/)
  })
})
