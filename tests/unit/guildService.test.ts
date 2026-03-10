import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/services/apiClient'
import { guildService } from '../../src/services/guildService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('guildService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('loads guild membership via /guilds/me', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'g1', name: 'Lorekeepers', members: [], challenges: [], gkp: 0, open: true }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const guild = await guildService.getMyGuild()

    expect(guild.id).toBe('g1')
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/guilds\/me$/)
  })

  it('searches guilds using encoded query string', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await guildService.search('deep lore')

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/guilds\/search\?q=deep\+lore$/)
  })

  it('throws ApiError for rejected create requests', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue({ error: 'Guild name is already taken' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(guildService.createGuild({
      name: 'Lorekeepers',
      tag: 'LORE',
      emblemId: '1',
      description: '',
    })).rejects.toMatchObject<ApiError>({
      status: 409,
      message: 'Guild name is already taken',
    })
  })
})
