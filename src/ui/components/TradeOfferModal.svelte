<script lang="ts">
  import type { ArtifactCard } from '../../data/types'
  import { tradingService } from '../../services/tradingService'

  interface ReceiverCard {
    instanceId: string
    factId: string
    rarity: string
    factPreview: string
  }

  interface Props {
    receiverId: string
    receiverName: string
    onClose: () => void
  }

  let { receiverId, receiverName, onClose }: Props = $props()

  const RARITY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    epic: '#c084fc',
    legendary: '#fbbf24',
    mythic: '#f43f5e',
  }

  // My inventory (tradeable cards)
  let myCards = $state<ArtifactCard[]>([])
  let receiverCards = $state<ReceiverCard[]>([])
  let loadingMine = $state(false)
  let loadingReceiver = $state(false)

  // Selections
  let selectedMyCard = $state<ArtifactCard | null>(null)
  let selectedReceiverCard = $state<ReceiverCard | null>(null)
  let gmSweetener = $state(0)

  // UI state
  let showMyPicker = $state(false)
  let showReceiverPicker = $state(false)
  let showConfirm = $state(false)
  let sending = $state(false)
  let sentSuccess = $state(false)
  let errorMessage = $state('')

  // Phase 56: Daily trade limit tracking (client-side display)
  const DAILY_TRADE_LIMIT = 3
  let dailyTradeCount = $state(0)

  function getDailyTradeCount(): number {
    const today = new Date().toISOString().slice(0, 10)
    const key = `terra:trades-${today}`
    const stored = localStorage.getItem(key)
    return stored ? parseInt(stored, 10) : 0
  }

  function incrementDailyTradeCount(): void {
    const today = new Date().toISOString().slice(0, 10)
    const key = `terra:trades-${today}`
    const count = getDailyTradeCount() + 1
    localStorage.setItem(key, String(count))
    dailyTradeCount = count
  }

  $effect(() => {
    dailyTradeCount = getDailyTradeCount()
  })

  const tradesRemaining = $derived(Math.max(0, DAILY_TRADE_LIMIT - dailyTradeCount))
  const atDailyLimit = $derived(dailyTradeCount >= DAILY_TRADE_LIMIT)

  async function loadMyCards(): Promise<void> {
    loadingMine = true
    try {
      const data = await tradingService.getMyTradeableCards()
      // Phase 56: Client-side soulbound filter (defense-in-depth)
      myCards = (data ?? []).filter(c => !c.isSoulbound)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to load cards'
    } finally {
      loadingMine = false
    }
  }

  async function loadReceiverCards(): Promise<void> {
    loadingReceiver = true
    try {
      receiverCards = await tradingService.getPlayerTradeableCards(receiverId)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to load cards'
    } finally {
      loadingReceiver = false
    }
  }

  async function sendOffer(): Promise<void> {
    if (!selectedMyCard || !selectedReceiverCard) return
    sending = true
    errorMessage = ''
    try {
      await tradingService.createOffer({
        receiverId,
        offeredCardInstanceId: selectedMyCard.instanceId,
        requestedCardInstanceId: selectedReceiverCard.instanceId,
        additionalGreyMatter: gmSweetener,
      })
      sentSuccess = true
      showConfirm = false
      incrementDailyTradeCount()
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to send offer'
    } finally {
      sending = false
    }
  }

  function openMyPicker(): void {
    showMyPicker = true
    if (myCards.length === 0) loadMyCards()
  }

  function openReceiverPicker(): void {
    showReceiverPicker = true
    if (receiverCards.length === 0) loadReceiverCards()
  }

  function selectMyCard(card: ArtifactCard): void {
    selectedMyCard = card
    showMyPicker = false
  }

  function selectReceiverCard(card: ReceiverCard): void {
    selectedReceiverCard = card
    showReceiverPicker = false
  }

  function handleDustInput(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    gmSweetener = isNaN(val) ? 0 : Math.max(0, Math.min(500, val))
  }

  function rarityColor(rarity: string): string {
    return RARITY_COLORS[rarity] ?? '#9ca3af'
  }

  function formatRarity(rarity: string): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  const canSend = $derived(selectedMyCard !== null && selectedReceiverCard !== null && !atDailyLimit)

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Trade Offer"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Propose Trade</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
    </div>

    {#if sentSuccess}
      <!-- Success state -->
      <div class="success-panel" role="status" aria-live="polite">
        <span class="success-icon" aria-hidden="true">✅</span>
        <p class="success-msg">Trade offer sent to <strong>{receiverName}</strong>!</p>
        <button class="btn-primary" type="button" onclick={onClose}>Close</button>
      </div>
    {:else}
      <div class="modal-body">
        <p class="trade-target">Trading with: <strong>{receiverName}</strong></p>

        <!-- Phase 56: Daily trade limit display -->
        <div class="trade-limit-row" role="status" aria-label="Daily trade limit">
          <span class="trade-limit-label">Daily trades:</span>
          <span class="trade-limit-count" class:at-limit={atDailyLimit}>
            {dailyTradeCount}/{DAILY_TRADE_LIMIT}
          </span>
          {#if atDailyLimit}
            <span class="trade-limit-warning">Limit reached. Try again tomorrow.</span>
          {:else}
            <span class="trade-limit-remaining">{tradesRemaining} remaining</span>
          {/if}
        </div>

        {#if errorMessage}
          <div class="error-banner" role="alert">{errorMessage}</div>
        {/if}

        <!-- My card selection -->
        <div class="trade-section">
          <h3 class="section-label">Your Card</h3>
          {#if selectedMyCard}
            <div
              class="selected-card"
              style="border-color: {rarityColor(selectedMyCard.rarity)}"
              aria-label="Selected: {formatRarity(selectedMyCard.rarity)} artifact"
            >
              <span class="rarity-badge" style="background: {rarityColor(selectedMyCard.rarity)}">
                {formatRarity(selectedMyCard.rarity)}
              </span>
              <span class="card-id mono">{selectedMyCard.factId}</span>
              <button
                class="btn-change"
                type="button"
                onclick={openMyPicker}
                aria-label="Change your offered card"
              >Change</button>
            </div>
          {:else}
            <button
              class="btn-pick-card"
              type="button"
              onclick={openMyPicker}
              aria-label="Select card to offer"
            >
              + Select Card to Offer
            </button>
          {/if}
        </div>

        <!-- Receiver card selection -->
        <div class="trade-section">
          <h3 class="section-label">{receiverName}'s Card</h3>
          {#if selectedReceiverCard}
            <div
              class="selected-card"
              style="border-color: {rarityColor(selectedReceiverCard.rarity)}"
              aria-label="Requested: {formatRarity(selectedReceiverCard.rarity)} artifact"
            >
              <span class="rarity-badge" style="background: {rarityColor(selectedReceiverCard.rarity)}">
                {formatRarity(selectedReceiverCard.rarity)}
              </span>
              <span class="card-preview">{selectedReceiverCard.factPreview}</span>
              <button
                class="btn-change"
                type="button"
                onclick={openReceiverPicker}
                aria-label="Change requested card"
              >Change</button>
            </div>
          {:else}
            <button
              class="btn-pick-card"
              type="button"
              onclick={openReceiverPicker}
              aria-label="Select card to request"
            >
              + Select Card to Request
            </button>
          {/if}
        </div>

        <!-- Grey matter sweetener -->
        <div class="trade-section">
          <h3 class="section-label">Grey Matter Sweetener: <span class="gm-amount">{gmSweetener}</span></h3>
          <input
            class="gm-slider"
            type="range"
            min="0"
            max="500"
            step="10"
            value={gmSweetener}
            oninput={handleDustInput}
            aria-label="Additional grey matter to add to offer, 0 to 500"
          />
          <p class="gm-hint">Add up to 500 grey matter to sweeten the deal.</p>
        </div>

        <!-- Send button -->
        <button
          class="btn-send"
          class:btn-disabled={!canSend}
          type="button"
          disabled={!canSend}
          onclick={() => { showConfirm = true }}
          aria-disabled={!canSend}
        >
          {atDailyLimit ? 'No trades remaining today' : 'Send Offer'}
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- My card picker -->
{#if showMyPicker}
  <div
    class="picker-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Select card to offer"
    tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) showMyPicker = false }}
    onkeydown={(e) => { if (e.key === 'Escape') showMyPicker = false }}
  >
    <div class="picker-panel">
      <div class="picker-header">
        <h3 class="picker-title">Your Tradeable Cards</h3>
        <button class="close-btn" type="button" onclick={() => { showMyPicker = false }} aria-label="Close picker">✕</button>
      </div>
      {#if loadingMine}
        <div class="state-msg" role="status">Loading...</div>
      {:else if myCards.length === 0}
        <div class="state-msg">No tradeable cards.</div>
      {:else}
        <div class="picker-list">
          {#each myCards as card}
            <button
              class="picker-item"
              class:picker-item-disabled={card.isSoulbound}
              style="border-color: {rarityColor(card.rarity)}"
              type="button"
              disabled={card.isSoulbound}
              onclick={() => selectMyCard(card)}
              aria-label="{formatRarity(card.rarity)} artifact: {card.factId}{card.isSoulbound ? ' (soulbound)' : ''}"
            >
              <span class="rarity-badge" style="background: {rarityColor(card.rarity)}">{formatRarity(card.rarity)}</span>
              <span class="card-id mono">{card.factId}</span>
              {#if card.isSoulbound}
                <span class="soulbound-tag">Soulbound</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Receiver card picker -->
{#if showReceiverPicker}
  <div
    class="picker-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Select card to request"
    tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) showReceiverPicker = false }}
    onkeydown={(e) => { if (e.key === 'Escape') showReceiverPicker = false }}
  >
    <div class="picker-panel">
      <div class="picker-header">
        <h3 class="picker-title">{receiverName}'s Cards</h3>
        <button class="close-btn" type="button" onclick={() => { showReceiverPicker = false }} aria-label="Close picker">✕</button>
      </div>
      {#if loadingReceiver}
        <div class="state-msg" role="status">Loading...</div>
      {:else if receiverCards.length === 0}
        <div class="state-msg">No tradeable cards available.</div>
      {:else}
        <div class="picker-list">
          {#each receiverCards as card}
            <button
              class="picker-item"
              style="border-color: {rarityColor(card.rarity)}"
              type="button"
              onclick={() => selectReceiverCard(card)}
              aria-label="{formatRarity(card.rarity)} artifact: {card.factPreview}"
            >
              <span class="rarity-badge" style="background: {rarityColor(card.rarity)}">{formatRarity(card.rarity)}</span>
              <span class="card-preview">{card.factPreview}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Confirm send modal -->
{#if showConfirm}
  <div
    class="picker-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Confirm trade offer"
    tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) showConfirm = false }}
    onkeydown={(e) => { if (e.key === 'Escape') showConfirm = false }}
  >
    <div class="confirm-panel">
      <h3 class="picker-title">Confirm Trade Offer</h3>
      <p class="confirm-text">
        Send this offer to <strong>{receiverName}</strong>?
      </p>
      {#if selectedMyCard}
        <p class="confirm-detail">Offering: <span style="color: {rarityColor(selectedMyCard.rarity)}">{formatRarity(selectedMyCard.rarity)}</span> card</p>
      {/if}
      {#if selectedReceiverCard}
        <p class="confirm-detail">Requesting: <span style="color: {rarityColor(selectedReceiverCard.rarity)}">{formatRarity(selectedReceiverCard.rarity)}</span> card</p>
      {/if}
      {#if gmSweetener > 0}
        <p class="confirm-detail confirm-gm">+{gmSweetener} grey matter sweetener</p>
      {/if}
      <div class="confirm-actions">
        <button
          class="btn-primary"
          type="button"
          disabled={sending}
          onclick={sendOffer}
        >{sending ? 'Sending...' : 'Confirm & Send'}</button>
        <button
          class="btn-cancel"
          type="button"
          onclick={() => { showConfirm = false }}
        >Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop, .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.80);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
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

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .trade-target {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .trade-target strong { color: #f59e0b; }

  .error-banner {
    background: #7f1d1d;
    border: 1px solid #ef4444;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  .trade-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  .selected-card {
    background: #0f172a;
    border: 2px solid #334155;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rarity-badge {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #0f172a;
    flex-shrink: 0;
  }

  .card-id {
    font-size: 0.68rem;
    color: #94a3b8;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .card-preview {
    font-size: 0.75rem;
    color: #cbd5e1;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .btn-change {
    background: transparent;
    border: 1px solid #475569;
    border-radius: 6px;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.65rem;
    padding: 3px 8px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-change:hover { background: #47556922; }
  .btn-change:active { transform: translateY(1px); }

  .btn-pick-card {
    background: #0f172a;
    border: 2px dashed #334155;
    border-radius: 10px;
    color: #64748b;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 14px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.12s, color 0.12s;
  }

  .btn-pick-card:hover {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .btn-pick-card:active { transform: translateY(1px); }

  .gm-slider {
    width: 100%;
    accent-color: #f59e0b;
    cursor: pointer;
  }

  .gm-amount {
    color: #f59e0b;
    font-weight: 700;
  }

  .gm-hint {
    font-size: 0.7rem;
    color: #64748b;
    margin: 0;
  }

  .btn-send {
    background: #f59e0b;
    border: 0;
    border-radius: 10px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 12px;
    cursor: pointer;
    width: 100%;
    letter-spacing: 1px;
    text-transform: uppercase;
    transition: background 0.12s;
  }

  .btn-send:hover { background: #fbbf24; }
  .btn-send:active { transform: translateY(1px); }

  .btn-disabled {
    background: #334155;
    color: #64748b;
    cursor: not-allowed;
  }

  .btn-disabled:hover { background: #334155; }

  /* Success panel */
  .success-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 20px;
  }

  .success-icon { font-size: 2.5rem; }

  .success-msg {
    font-size: 0.9rem;
    color: #e2e8f0;
    text-align: center;
    margin: 0;
  }

  .success-msg strong { color: #f59e0b; }

  /* Picker panel */
  .picker-panel, .confirm-panel {
    background: #16213e;
    border: 2px solid #334155;
    border-radius: 12px;
    width: 100%;
    max-width: 380px;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #334155;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .picker-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  .picker-list {
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .picker-item {
    background: #0f172a;
    border: 2px solid #334155;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.1s;
  }

  .picker-item:hover:not(:disabled) { border-color: #f59e0b; }
  .picker-item:active:not(:disabled) { transform: translateY(1px); }

  .picker-item-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .soulbound-tag {
    font-size: 0.6rem;
    font-weight: 700;
    color: #94a3b8;
    border: 1px solid #334155;
    border-radius: 4px;
    padding: 1px 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  /* Confirm panel */
  .confirm-panel {
    max-width: 340px;
    padding: 20px;
    gap: 10px;
    align-items: stretch;
  }

  .confirm-text {
    font-size: 0.85rem;
    color: #cbd5e1;
    margin: 0;
  }

  .confirm-text strong { color: #f59e0b; }

  .confirm-detail {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
  }

  .confirm-gm { color: #f59e0b; }

  .confirm-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .btn-primary {
    background: #f59e0b;
    border: 0;
    border-radius: 8px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 10px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .btn-primary:hover { background: #fbbf24; }
  .btn-primary:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
  .btn-primary:active:not(:disabled) { transform: translateY(1px); }

  .btn-cancel {
    background: transparent;
    border: 1px solid #475569;
    border-radius: 8px;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    padding: 10px;
    cursor: pointer;
  }

  .btn-cancel:hover { background: #47556922; }
  .btn-cancel:active { transform: translateY(1px); }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 20px;
  }

  .mono { font-family: monospace; }

  /* Phase 56: Trade limit styles */
  .trade-limit-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    font-size: 0.72rem;
  }

  .trade-limit-label {
    color: #94a3b8;
    font-weight: 600;
  }

  .trade-limit-count {
    color: #f59e0b;
    font-weight: 700;
  }

  .trade-limit-count.at-limit {
    color: #ef4444;
  }

  .trade-limit-remaining {
    color: #4ade80;
    font-size: 0.68rem;
  }

  .trade-limit-warning {
    color: #ef4444;
    font-size: 0.68rem;
    font-weight: 600;
  }
</style>
