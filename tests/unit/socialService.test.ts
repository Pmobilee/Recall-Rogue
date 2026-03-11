import { beforeEach, describe, expect, it, vi } from 'vitest'
import { socialService } from '../../src/services/socialService'
import { authedGet, authedPost } from '../../src/services/authedFetch'

vi.mock('../../src/services/authedFetch', () => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
}))

function mockResponse(payload: unknown): Response {
  return {
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

describe('socialService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches players with trimmed query and unwraps players payload', async () => {
    vi.mocked(authedGet).mockResolvedValueOnce(
      mockResponse({ players: [{ id: 'p1', displayName: 'Alice' }] }),
    )

    const results = await socialService.searchPlayers('  Alice  ')

    expect(authedGet).toHaveBeenCalledWith('/players/search?q=Alice')
    expect(results).toEqual([{ id: 'p1', displayName: 'Alice' }])
  })

  it('normalizes hub snapshot payload and applies defaults', async () => {
    vi.mocked(authedGet).mockResolvedValueOnce(
      mockResponse({
        snapshot: {
          playerId: 'player-1',
          displayName: '',
          visitCount: 4,
          guestbook: [
            {
              id: 'g1',
              authorId: 'author-1',
              authorDisplayName: 'Explorer A',
              message: 'Nice dome',
              createdAt: 1234,
            },
          ],
        },
      }),
    )

    const snapshot = await socialService.getHubSnapshot('player-1')

    expect(authedGet).toHaveBeenCalledWith('/players/player-1/hub-snapshot')
    expect(snapshot.playerId).toBe('player-1')
    expect(snapshot.displayName).toBe('Explorer')
    expect(snapshot.visitCount).toBe(4)
    expect(snapshot.guestbook).toHaveLength(1)
    expect(snapshot.guestbook[0]).toMatchObject({
      id: 'g1',
      authorId: 'author-1',
      authorDisplayName: 'Explorer A',
      message: 'Nice dome',
      createdAt: 1234,
    })
    expect(snapshot.joinDate).toBe(new Date(0).toISOString())
    expect(snapshot.knowledgeTree.totalFacts).toBe(0)
  })

  it('maps mineral gift payload amount -> dust', async () => {
    vi.mocked(authedPost).mockResolvedValueOnce(mockResponse({ ok: true }))

    await socialService.sendGift('player-2', 'minerals', { amount: 125 })

    expect(authedPost).toHaveBeenCalledWith('/players/player-2/gift', {
      type: 'minerals',
      payload: { dust: 125 },
    })
  })

  it('maps received gifts payload and claimed status', async () => {
    vi.mocked(authedGet).mockResolvedValueOnce(
      mockResponse([
        {
          id: 'g-min',
          senderId: 's1',
          senderDisplayName: 'Sender One',
          type: 'minerals',
          payload: { dust: 80 },
          createdAt: 1111,
          claimedAt: null,
        },
        {
          id: 'g-fact',
          senderId: 's2',
          senderDisplayName: 'Sender Two',
          type: 'fact_link',
          payload: { factId: 'fact-1', factPreview: 'Preview text' },
          createdAt: 2222,
          claimedAt: 3333,
        },
      ]),
    )

    const gifts = await socialService.getReceivedGifts()

    expect(authedGet).toHaveBeenCalledWith('/players/me/received-gifts')
    expect(gifts).toEqual([
      {
        id: 'g-min',
        senderId: 's1',
        senderName: 'Sender One',
        giftType: 'minerals',
        payload: { amount: 80, factId: undefined, factPreview: undefined },
        sentAt: 1111,
        claimed: false,
      },
      {
        id: 'g-fact',
        senderId: 's2',
        senderName: 'Sender Two',
        giftType: 'fact_link',
        payload: { amount: undefined, factId: 'fact-1', factPreview: 'Preview text' },
        sentAt: 2222,
        claimed: true,
      },
    ])
  })

  it('encodes IDs when claiming gifts', async () => {
    vi.mocked(authedPost).mockResolvedValueOnce(mockResponse({ ok: true }))

    await socialService.claimGift('gift/id')

    expect(authedPost).toHaveBeenCalledWith('/players/me/received-gifts/gift%2Fid/claim', {})
  })
})
