<script lang="ts">
  import type { ArtifactCard, TradeOffer } from '../../data/types'
  import { tradingService } from '../../services/tradingService'
  import DuplicateMixingModal from './DuplicateMixingModal.svelte'

  interface MarketListing {
    instanceId: string
    factId: string
    rarity: string
    factPreview: string
    category: string
    price: number
    sellerName: string
  }

  interface IncomingOffer extends TradeOffer {
    offererName: string
    offeredCardPreview: string
    requestedCardPreview: string
  }

  interface OutgoingOffer extends TradeOffer {
    receiverNameDisplay: string
    offeredCardPreview: string
    requestedCardPreview: string
  }

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  type Tab = 'browse' | 'listings' | 'offers'
  let activeTab = $state<Tab>('browse')

  // Browse filters
  let filterRarity = $state('all')
  let filterCategory = $state('all')
  let filterPriceMax = $state(9999)

  // Loading states
  let loadingMarket = $state(false)
  let loadingListings = $state(false)
  let loadingOffers = $state(false)

  // Data
  let marketListings = $state<MarketListing[]>([])
  let myListings = $state<ArtifactCard[]>([])
  let incomingOffers = $state<IncomingOffer[]>([])
  let outgoingOffers = $state<OutgoingOffer[]>([])

  let errorMessage = $state('')
  let showMixingModal = $state(false)

  const RARITY_OPTIONS = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
  const CATEGORY_OPTIONS = ['all', 'Language', 'Natural Sciences', 'Life Sciences', 'History', 'Geography', 'Technology', 'Culture']

  const RARITY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    epic: '#c084fc',
    legendary: '#fbbf24',
    mythic: '#f43f5e',
  }

  async function fetchMarket(): Promise<void> {
    loadingMarket = true
    errorMessage = ''
    try {
      marketListings = await tradingService.getMarketplace()
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error'
      marketListings = []
    } finally {
      loadingMarket = false
    }
  }

  async function fetchMyListings(): Promise<void> {
    loadingListings = true
    errorMessage = ''
    try {
      myListings = await tradingService.getMyListings()
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error'
      myListings = []
    } finally {
      loadingListings = false
    }
  }

  async function fetchOffers(): Promise<void> {
    loadingOffers = true
    errorMessage = ''
    try {
      const data = await tradingService.getPendingOffers()
      incomingOffers = data.incoming ?? []
      outgoingOffers = data.outgoing ?? []
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error'
      incomingOffers = []
      outgoingOffers = []
    } finally {
      loadingOffers = false
    }
  }

  async function handleBuy(listing: MarketListing): Promise<void> {
    try {
      await tradingService.buy(listing.instanceId)
      marketListings = marketListings.filter(l => l.instanceId !== listing.instanceId)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Purchase failed'
    }
  }

  async function handleDelist(card: ArtifactCard): Promise<void> {
    try {
      await tradingService.delist(card.instanceId)
      myListings = myListings.filter(c => c.instanceId !== card.instanceId)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Delist failed'
    }
  }

  async function handleAcceptOffer(offer: IncomingOffer): Promise<void> {
    try {
      await tradingService.acceptOffer(offer.id)
      incomingOffers = incomingOffers.filter(o => o.id !== offer.id)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Accept failed'
    }
  }

  async function handleDeclineOffer(offer: IncomingOffer): Promise<void> {
    try {
      await tradingService.declineOffer(offer.id)
      incomingOffers = incomingOffers.filter(o => o.id !== offer.id)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Decline failed'
    }
  }

  function switchTab(tab: Tab): void {
    activeTab = tab
    errorMessage = ''
    if (tab === 'browse' && marketListings.length === 0) fetchMarket()
    if (tab === 'listings' && myListings.length === 0) fetchMyListings()
    if (tab === 'offers' && incomingOffers.length === 0 && outgoingOffers.length === 0) fetchOffers()
  }

  const filteredListings = $derived(
    marketListings.filter(l => {
      if (filterRarity !== 'all' && l.rarity !== filterRarity) return false
      if (filterCategory !== 'all' && l.category !== filterCategory) return false
      if (l.price > filterPriceMax) return false
      return true
    })
  )

  function rarityColor(rarity: string): string {
    return RARITY_COLORS[rarity] ?? '#9ca3af'
  }

  function formatRarity(rarity: string): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  function formatStatus(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pending',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
    }
    return map[status] ?? status
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  // Load browse tab on mount
  $effect(() => {
    fetchMarket()
  })
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Trade Marketplace"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Trade Marketplace</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close marketplace">✕</button>
    </div>

    <!-- Tabs -->
    <div class="tabs" role="tablist" aria-label="Marketplace sections">
      <button
        class="tab"
        class:tab-active={activeTab === 'browse'}
        type="button"
        role="tab"
        aria-selected={activeTab === 'browse'}
        onclick={() => switchTab('browse')}
      >Browse Market</button>
      <button
        class="tab"
        class:tab-active={activeTab === 'listings'}
        type="button"
        role="tab"
        aria-selected={activeTab === 'listings'}
        onclick={() => switchTab('listings')}
      >My Listings</button>
      <button
        class="tab"
        class:tab-active={activeTab === 'offers'}
        type="button"
        role="tab"
        aria-selected={activeTab === 'offers'}
        onclick={() => switchTab('offers')}
      >Trade Offers</button>
    </div>

    <!-- Error message -->
    {#if errorMessage}
      <div class="error-banner" role="alert">{errorMessage}</div>
    {/if}

    <!-- Tab panels -->
    <div class="tab-content">

      <!-- ===== BROWSE MARKET ===== -->
      {#if activeTab === 'browse'}
        <div class="filter-bar" aria-label="Filter listings">
          <select
            class="filter-select"
            bind:value={filterRarity}
            aria-label="Filter by rarity"
          >
            {#each RARITY_OPTIONS as opt}
              <option value={opt}>{opt === 'all' ? 'All Rarities' : formatRarity(opt)}</option>
            {/each}
          </select>

          <select
            class="filter-select"
            bind:value={filterCategory}
            aria-label="Filter by category"
          >
            {#each CATEGORY_OPTIONS as opt}
              <option value={opt}>{opt === 'all' ? 'All Categories' : opt}</option>
            {/each}
          </select>

          <div class="price-filter">
            <label class="price-label" for="price-range">Max: {filterPriceMax} grey matter</label>
            <input
              id="price-range"
              class="price-slider"
              type="range"
              min="0"
              max="9999"
              step="100"
              bind:value={filterPriceMax}
              aria-label="Maximum price in grey matter"
            />
          </div>
        </div>

        {#if loadingMarket}
          <div class="state-msg" role="status" aria-live="polite">Loading market...</div>
        {:else if filteredListings.length === 0}
          <div class="state-msg">No listings match your filters.</div>
        {:else}
          <div class="card-grid" aria-label="Artifact listings">
            {#each filteredListings as listing}
              <div
                class="artifact-card"
                style="border-color: {rarityColor(listing.rarity)}"
                aria-label="{formatRarity(listing.rarity)} artifact: {listing.factPreview}"
              >
                <div class="rarity-badge" style="background: {rarityColor(listing.rarity)}">
                  {formatRarity(listing.rarity)}
                </div>
                <p class="fact-preview">{listing.factPreview}</p>
                <div class="card-meta">
                  <span class="category-tag">{listing.category}</span>
                  <span class="seller-name">@{listing.sellerName}</span>
                </div>
                <div class="card-footer">
                  <span class="price">{listing.price} grey matter</span>
                  <button
                    class="btn-buy"
                    type="button"
                    onclick={() => handleBuy(listing)}
                  >Buy</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- ===== MY LISTINGS ===== -->
      {#if activeTab === 'listings'}
        <div class="listings-actions">
          <button class="btn-list-new" type="button">
            + List New Card
          </button>
        </div>

        {#if loadingListings}
          <div class="state-msg" role="status" aria-live="polite">Loading your listings...</div>
        {:else if myListings.length === 0}
          <div class="state-msg">You have no active listings.</div>
        {:else}
          <div class="card-grid" aria-label="My active listings">
            {#each myListings as card}
              <div
                class="artifact-card"
                style="border-color: {rarityColor(card.rarity)}"
                aria-label="{formatRarity(card.rarity)} artifact listing"
              >
                <div class="rarity-badge" style="background: {rarityColor(card.rarity)}">
                  {formatRarity(card.rarity)}
                </div>
                <p class="fact-preview mono">{card.factId}</p>
                <div class="card-footer">
                  {#if card.listPrice !== undefined}
                    <span class="price">{card.listPrice} grey matter</span>
                  {/if}
                  <button
                    class="btn-delist"
                    type="button"
                    onclick={() => handleDelist(card)}
                  >Delist</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- ===== TRADE OFFERS ===== -->
      {#if activeTab === 'offers'}
        {#if loadingOffers}
          <div class="state-msg" role="status" aria-live="polite">Loading offers...</div>
        {:else}
          <!-- Incoming -->
          <h3 class="offers-section-title">Incoming Offers</h3>
          {#if incomingOffers.length === 0}
            <div class="state-msg">No incoming offers.</div>
          {:else}
            <div class="offers-list" aria-label="Incoming trade offers">
              {#each incomingOffers as offer}
                <div class="offer-card" aria-label="Trade offer from {offer.offererName}">
                  <div class="offer-info">
                    <span class="offer-from">From: <strong>{offer.offererName}</strong></span>
                    <span class="offer-detail">Offering: {offer.offeredCardPreview}</span>
                    <span class="offer-detail">For: {offer.requestedCardPreview}</span>
                    {#if offer.additionalGreyMatter > 0}
                      <span class="offer-dust">+{offer.additionalGreyMatter} grey matter sweetener</span>
                    {/if}
                  </div>
                  <div class="offer-actions">
                    <button
                      class="btn-accept"
                      type="button"
                      onclick={() => handleAcceptOffer(offer)}
                    >Accept</button>
                    <button
                      class="btn-decline"
                      type="button"
                      onclick={() => handleDeclineOffer(offer)}
                    >Decline</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Outgoing -->
          <h3 class="offers-section-title">Outgoing Offers</h3>
          {#if outgoingOffers.length === 0}
            <div class="state-msg">No outgoing offers.</div>
          {:else}
            <div class="offers-list" aria-label="Outgoing trade offers">
              {#each outgoingOffers as offer}
                <div class="offer-card" aria-label="Trade offer to {offer.receiverNameDisplay}">
                  <div class="offer-info">
                    <span class="offer-from">To: <strong>{offer.receiverNameDisplay}</strong></span>
                    <span class="offer-detail">Offering: {offer.offeredCardPreview}</span>
                    <span class="offer-detail">For: {offer.requestedCardPreview}</span>
                  </div>
                  <div class="offer-status">
                    <span
                      class="status-badge"
                      class:status-pending={offer.status === 'pending'}
                      class:status-accepted={offer.status === 'accepted'}
                      class:status-declined={offer.status === 'declined'}
                      class:status-expired={offer.status === 'expired'}
                    >{formatStatus(offer.status)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    <!-- Mix Duplicates button -->
    <div class="modal-footer">
      <button
        class="btn-mix"
        type="button"
        onclick={() => { showMixingModal = true }}
      >Mix Duplicates</button>
    </div>
  </div>
</div>

{#if showMixingModal}
  <DuplicateMixingModal onClose={() => { showMixingModal = false }} />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f59e0b44;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover { color: #e2e8f0; }
  .close-btn:active { transform: translateY(1px); }

  .tabs {
    display: flex;
    border-bottom: 1px solid #f59e0b44;
    flex-shrink: 0;
    background: #1a1a2e;
  }

  .tab {
    flex: 1;
    padding: 10px 6px;
    background: transparent;
    border: 0;
    border-bottom: 3px solid transparent;
    color: #64748b;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: color 0.12s, border-color 0.12s;
  }

  .tab:hover { color: #94a3b8; }

  .tab-active {
    color: #f59e0b;
    border-bottom-color: #f59e0b;
  }

  .error-banner {
    background: #7f1d1d;
    border-bottom: 1px solid #ef4444;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 16px;
    flex-shrink: 0;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .filter-select {
    background: #1a1a2e;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.78rem;
    padding: 6px 10px;
    cursor: pointer;
  }

  .price-filter {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 120px;
  }

  .price-label {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .price-slider {
    width: 100%;
    accent-color: #f59e0b;
    cursor: pointer;
  }

  /* Card grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }

  .artifact-card {
    background: #0f172a;
    border: 2px solid #334155;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.1s;
  }

  .artifact-card:hover { transform: translateY(-2px); }

  .rarity-badge {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #0f172a;
    align-self: flex-start;
  }

  .fact-preview {
    font-size: 0.75rem;
    color: #cbd5e1;
    line-height: 1.4;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .category-tag {
    font-size: 0.6rem;
    color: #64748b;
    text-transform: uppercase;
  }

  .seller-name {
    font-size: 0.6rem;
    color: #94a3b8;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    gap: 6px;
  }

  .price {
    font-size: 0.75rem;
    font-weight: 700;
    color: #f59e0b;
  }

  .btn-buy {
    background: #f59e0b;
    border: 0;
    border-radius: 6px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-buy:hover { background: #fbbf24; }
  .btn-buy:active { transform: translateY(1px); }

  /* My Listings */
  .listings-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-list-new {
    background: transparent;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    color: #f59e0b;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-list-new:hover { background: #f59e0b1a; }
  .btn-list-new:active { transform: translateY(1px); }

  .btn-delist {
    background: transparent;
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #ef4444;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-delist:hover { background: #ef44441a; }
  .btn-delist:active { transform: translateY(1px); }

  /* Offers */
  .offers-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 4px 0 0;
  }

  .offers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .offer-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .offer-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .offer-from {
    font-size: 0.78rem;
    color: #e2e8f0;
  }

  .offer-from strong { color: #f59e0b; }

  .offer-detail {
    font-size: 0.72rem;
    color: #94a3b8;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .offer-dust {
    font-size: 0.7rem;
    color: #f59e0b;
  }

  .offer-actions {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex-shrink: 0;
  }

  .btn-accept {
    background: #16a34a;
    border: 0;
    border-radius: 6px;
    color: #fff;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-accept:hover { background: #22c55e; }
  .btn-accept:active { transform: translateY(1px); }

  .btn-decline {
    background: transparent;
    border: 1px solid #94a3b8;
    border-radius: 6px;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-decline:hover { background: #94a3b81a; }
  .btn-decline:active { transform: translateY(1px); }

  .offer-status {
    flex-shrink: 0;
  }

  .status-badge {
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .status-pending { background: #f59e0b22; color: #f59e0b; border: 1px solid #f59e0b66; }
  .status-accepted { background: #16a34a22; color: #4ade80; border: 1px solid #4ade8066; }
  .status-declined { background: #ef444422; color: #f87171; border: 1px solid #f8717166; }
  .status-expired { background: #64748b22; color: #94a3b8; border: 1px solid #94a3b866; }

  /* State messages */
  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 24px 0;
  }

  /* Footer */
  .modal-footer {
    padding: 10px 16px;
    border-top: 1px solid #f59e0b44;
    background: #1a1a2e;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
  }

  .btn-mix {
    background: #7c3aed;
    border: 0;
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 9px 24px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: background 0.12s;
  }

  .btn-mix:hover { background: #8b5cf6; }
  .btn-mix:active { transform: translateY(1px); }

  .mono { font-family: monospace; font-size: 0.68rem; }

  @media (max-width: 480px) {
    .card-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
    .modal-title { font-size: 0.85rem; }
  }
</style>
