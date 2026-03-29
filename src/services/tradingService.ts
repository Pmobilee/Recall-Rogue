import type { ArtifactCard, TradeOffer } from '../data/types'
import { authedGet, authedPost } from './authedFetch'

export interface MarketplaceListing {
  instanceId: string
  factId: string
  rarity: string
  factPreview: string
  category: string
  price: number
  sellerName: string
}

export interface ReceiverTradeableCard {
  instanceId: string
  factId: string
  rarity: string
  factPreview: string
}

export interface IncomingOffer extends TradeOffer {
  offererName: string
  offeredCardPreview: string
  requestedCardPreview: string
}

export interface OutgoingOffer extends TradeOffer {
  receiverNameDisplay: string
  offeredCardPreview: string
  requestedCardPreview: string
}

interface PendingOffersPayload {
  incoming: IncomingOffer[]
  outgoing: OutgoingOffer[]
}

function normalizeListings(
  payload: unknown,
): MarketplaceListing[] {
  const rows = Array.isArray(payload)
    ? payload as Array<Record<string, unknown>>
    : ((((payload as { listings?: Array<Record<string, unknown>> })?.listings) ?? []) as Array<Record<string, unknown>>)
  return rows.map((row) => ({
    instanceId: String(row.instanceId ?? ''),
    factId: String(row.factId ?? row.instanceId ?? ''),
    rarity: String(row.rarity ?? 'common'),
    factPreview: String(row.factPreview ?? row.artifactName ?? row.factId ?? 'Unknown artifact'),
    category: String(row.category ?? 'general'),
    price: Number(row.price ?? row.priceDust ?? 0),
    sellerName: String(row.sellerName ?? row.sellerDisplayName ?? 'Explorer'),
  }))
}

function normalizeArtifactCards(payload: unknown): ArtifactCard[] {
  const rows = Array.isArray(payload)
    ? payload as Array<Record<string, unknown>>
    : ((((payload as { cards?: Array<Record<string, unknown>>; listings?: Array<Record<string, unknown>> })?.cards
      ?? (payload as { listings?: Array<Record<string, unknown>> })?.listings) ?? []) as Array<Record<string, unknown>>)
  return rows.map((row) => ({
    instanceId: String(row.instanceId ?? ''),
    factId: String(row.factId ?? ''),
    rarity: String(row.rarity ?? 'common'),
    discoveredAt: Number(row.discoveredAt ?? 0),
    isSoulbound: Boolean(row.isSoulbound ?? false),
    isListed: Boolean(row.isListed ?? false),
    listPrice: row.listPrice !== undefined ? Number(row.listPrice) : undefined,
  }))
}

function normalizePendingOffers(payload: unknown): PendingOffersPayload {
  if (Array.isArray(payload)) {
    return {
      incoming: payload as IncomingOffer[],
      outgoing: [],
    }
  }
  const maybe = payload as { incoming?: IncomingOffer[]; outgoing?: OutgoingOffer[] }
  return {
    incoming: Array.isArray(maybe.incoming) ? maybe.incoming : [],
    outgoing: Array.isArray(maybe.outgoing) ? maybe.outgoing : [],
  }
}

export const tradingService = {
  async getMarketplace(): Promise<MarketplaceListing[]> {
    const response = await authedGet('/trading/marketplace')
    const payload = await response.json()
    return normalizeListings(payload)
  },

  async getMyListings(): Promise<ArtifactCard[]> {
    const response = await authedGet('/trading/my-listings')
    const payload = await response.json()
    return normalizeArtifactCards(payload)
  },

  async getMyTradeableCards(): Promise<ArtifactCard[]> {
    const response = await authedGet('/trading/my-tradeable')
    const payload = await response.json()
    return normalizeArtifactCards(payload)
  },

  async getPlayerTradeableCards(playerId: string): Promise<ReceiverTradeableCard[]> {
    const response = await authedGet(`/trading/tradeable/${encodeURIComponent(playerId)}`)
    const payload = (await response.json()) as { cards?: ReceiverTradeableCard[] }
    return payload.cards ?? []
  },

  async getPendingOffers(): Promise<PendingOffersPayload> {
    const response = await authedGet('/trading/offers/pending')
    const payload = await response.json()
    return normalizePendingOffers(payload)
  },

  async buy(instanceId: string): Promise<void> {
    await authedPost('/trading/buy', { instanceId })
  },

  async delist(instanceId: string): Promise<void> {
    await authedPost('/trading/delist', { instanceId })
  },

  async createOffer(input: {
    receiverId: string
    offeredCardInstanceId: string
    requestedCardInstanceId: string
    additionalGreyMatter: number
  }): Promise<void> {
    await authedPost('/trading/offers/create', input)
  },

  async acceptOffer(offerId: string): Promise<void> {
    await authedPost('/trading/offers/accept', { offerId })
  },

  async declineOffer(offerId: string): Promise<void> {
    await authedPost('/trading/offers/decline', { offerId })
  },
}
