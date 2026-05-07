// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/utils/turboMode', () => ({
  turboDelay: (ms: number) => ms,
  isTurboMode: () => false,
}))

vi.mock('../../src/services/factsDB', () => ({
  factsDB: { isReady: () => false, getById: () => null },
}))

vi.mock('../../src/data/relics', () => ({
  RELIC_BY_ID: {
    lucky_coin: {
      name: 'Lucky Coin',
      description: '+1 gold on combat win',
      rarity: 'common',
    },
  },
}))

let mockActiveShopInventory = {
  subscribe: (cb: (v: unknown) => void) => {
    cb(null)
    return () => {}
  },
}

vi.mock('../../src/services/gameFlowController', () => ({
  get activeShopInventory() { return mockActiveShopInventory },
}))

beforeEach(() => {
  document.body.innerHTML = ''
  mockActiveShopInventory = {
    subscribe: (cb: (v: unknown) => void) => {
      cb(null)
      return () => {}
    },
  }
  Object.defineProperty(window, 'location', {
    value: { search: '?playtest=true' },
    writable: true,
  })
  delete (window as unknown as Record<string, unknown>).__rrPlay
})

describe('getShopInventory()', () => {
  it('returns the same buyable count as the visible shop plus service actions', async () => {
    mockActiveShopInventory = {
      subscribe: (cb: (v: unknown) => void) => {
        cb({
          relics: [{ relic: { id: 'lucky_coin' }, price: 73 }],
          cards: [{
            card: {
              id: 'shop-card-1',
              cardType: 'attack',
              mechanicId: 'strike',
              mechanicName: 'Strike',
              domain: 'general_knowledge',
            },
            price: 40,
          }],
          removalCost: 50,
          transformCost: 35,
        })
        return () => {}
      },
    }
    document.body.innerHTML = `
      <button data-testid="shop-buy-relic-lucky_coin">73g</button>
      <button data-testid="shop-buy-card-0">40g</button>
      <button data-testid="shop-buy-removal">Card Removal 50g</button>
      <button data-testid="shop-buy-transform">Card Transform 35g</button>
    `

    const { initPlaytestAPI } = await import('../../src/dev/playtestAPI')
    initPlaytestAPI()
    const api = (window as unknown as { __rrPlay: Record<string, unknown> }).__rrPlay
    const inventory = await (api.getShopInventory as () => Promise<{
      cards: unknown[]
      relics: unknown[]
      services: Array<{ type: string; price: number | null }>
    }>)()

    const visibleBuyables = document.querySelectorAll('[data-testid^="shop-buy-relic-"], [data-testid^="shop-buy-card-"]').length
    expect(inventory.relics).toHaveLength(1)
    expect(inventory.cards).toHaveLength(1)
    expect(inventory.relics.length + inventory.cards.length).toBe(visibleBuyables)
    expect(inventory.services).toEqual([
      { type: 'card_removal', price: 50, available: true },
      { type: 'card_transform', price: 35, available: true },
    ])
  })
})
