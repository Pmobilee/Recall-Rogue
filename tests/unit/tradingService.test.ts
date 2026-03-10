import { afterEach, describe, expect, it, vi } from 'vitest'
import { tradingService } from '../../src/services/tradingService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('tradingService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('normalizes marketplace payload rows', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          instanceId: 'art-1',
          rarity: 'rare',
          artifactName: 'Amber relic',
          category: 'fossil',
          priceDust: 150,
          sellerDisplayName: 'Rogue',
        },
      ]),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const rows = await tradingService.getMarketplace()
    expect(rows).toEqual([
      {
        instanceId: 'art-1',
        factId: 'art-1',
        rarity: 'rare',
        factPreview: 'Amber relic',
        category: 'fossil',
        price: 150,
        sellerName: 'Rogue',
      },
    ])
  })

  it('normalizes legacy array response for pending offers', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 'offer-1' }]),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const payload = await tradingService.getPendingOffers()
    expect(payload.incoming).toEqual([{ id: 'offer-1' }])
    expect(payload.outgoing).toEqual([])
  })
})
