<script lang="ts">
  import { socialService } from '../../services/socialService'
  import { ApiError } from '../../services/apiClient'
  import { playerSave } from '../stores/playerData'

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    /** Recipient player's ID. */
    playerId: string
    /** Display name of the hub owner (for UI copy). */
    ownerName: string
    /** Called when the modal should close. */
    onClose: () => void
  }

  let { playerId, ownerName, onClose }: Props = $props()

  // ============================================================
  // CONSTANTS
  // ============================================================

  const GIFT_GREY_MATTER_AMOUNT = 100
  const DAILY_GIFT_LIMIT = 3

  // ============================================================
  // TYPES
  // ============================================================

  type GiftType = 'minerals' | 'fact_link'
  type Step = 'pick_type' | 'pick_fact' | 'confirm' | 'sending' | 'success' | 'error'

  interface FactOption {
    factId: string
    label: string
  }

  // ============================================================
  // STATE
  // ============================================================

  let step = $state<Step>('pick_type')
  let selectedType = $state<GiftType | null>(null)
  let selectedFact = $state<FactOption | null>(null)
  let errorText = $state<string | null>(null)
  let giftsRemainingToday = $state(DAILY_GIFT_LIMIT)
  let factSearch = $state('')

  // ============================================================
  // DERIVED
  // ============================================================

  /** Safe version of the owner name for display. */
  const safeOwnerName = $derived(
    ownerName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  )

  /**
   * Build a flat list of the player's learned facts for the fact picker.
   * Labels use the fact ID as a fallback since we don't have full Fact objects
   * here — a real implementation would cross-reference the local facts DB.
   */
  const learnedFacts = $derived.by((): FactOption[] => {
    const save = $playerSave
    if (!save) return []
    return save.learnedFacts.slice(0, 100).map((factId: string) => ({
      factId,
      label: factId,
    }))
  })

  const filteredFacts = $derived.by((): FactOption[] => {
    if (!factSearch.trim()) return learnedFacts
    const q = factSearch.toLowerCase()
    return learnedFacts.filter(f => f.label.toLowerCase().includes(q))
  })

  const hasNoFacts = $derived(learnedFacts.length === 0)
  const canSendGift = $derived(giftsRemainingToday > 0)

  // ============================================================
  // HANDLERS
  // ============================================================

  function handleSelectMinerals(): void {
    selectedType = 'minerals'
    selectedFact = null
    step = 'confirm'
  }

  function handleSelectFactLink(): void {
    selectedType = 'fact_link'
    selectedFact = null
    step = 'pick_fact'
  }

  function handleSelectFact(fact: FactOption): void {
    selectedFact = fact
    step = 'confirm'
  }

  function handleBackToType(): void {
    selectedFact = null
    step = 'pick_type'
  }

  function handleBackToFacts(): void {
    selectedFact = null
    step = 'pick_fact'
  }

  async function handleConfirmSend(): Promise<void> {
    if (!selectedType) return
    step = 'sending'
    errorText = null

    try {
      let payload: object
      if (selectedType === 'minerals') {
        payload = { amount: GIFT_GREY_MATTER_AMOUNT }
      } else {
        if (!selectedFact) {
          step = 'pick_fact'
          return
        }
        payload = { factId: selectedFact.factId }
      }

      await socialService.sendGift(playerId, selectedType, payload)
      giftsRemainingToday = Math.max(0, giftsRemainingToday - 1)
      step = 'success'
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        errorText = `You've sent ${DAILY_GIFT_LIMIT} gifts today. Come back tomorrow!`
        giftsRemainingToday = 0
      } else {
        errorText = err instanceof Error ? err.message : 'Failed to send gift.'
      }
      step = 'error'
    }
  }

  function handleRetry(): void {
    step = 'pick_type'
    selectedType = null
    selectedFact = null
    errorText = null
  }

  function handleFactSearchInput(e: Event): void {
    factSearch = (e.target as HTMLInputElement).value
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose()
  }

  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose()
    }
  }

  /** Truncates a fact ID for display (IDs can be long UUIDs or keys). */
  function formatFactLabel(label: string): string {
    if (label.length > 40) return label.slice(0, 37) + '...'
    return label
  }
</script>

<!-- ============================================================
     BACKDROP
     ============================================================ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  onclick={handleBackdropClick}
  aria-hidden="false"
>
  <!-- ============================================================
       MODAL PANEL
       ============================================================ -->
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Send a gift to {safeOwnerName}"
    tabindex="-1"
    onkeydown={handleKeydown}
  >
    <!-- Header -->
    <div class="modal-header">
      <button
        class="back-btn"
        type="button"
        onclick={
          step === 'pick_fact' ? handleBackToType
          : step === 'confirm' && selectedType === 'fact_link' ? handleBackToFacts
          : step === 'confirm' ? handleBackToType
          : onClose
        }
        aria-label={step === 'pick_type' ? 'Close' : 'Back'}
        style="visibility: {step === 'success' || step === 'error' || step === 'sending' ? 'hidden' : 'visible'}"
      >
        {step === 'pick_type' ? '&#x2715;' : '&#x2190;'}
      </button>

      <h2 class="modal-title">
        {step === 'pick_type' && 'Send a Gift'}
        {step === 'pick_fact' && 'Choose a Fact'}
        {step === 'confirm' && 'Confirm Gift'}
        {step === 'sending' && 'Sending...'}
        {step === 'success' && 'Gift Sent!'}
        {step === 'error' && 'Oops'}
      </h2>

      <button
        class="close-btn"
        type="button"
        onclick={onClose}
        aria-label="Close"
        style="visibility: {step === 'sending' ? 'hidden' : 'visible'}"
      >
        &#x2715;
      </button>
    </div>

    <!-- Gift limit indicator -->
    {#if step === 'pick_type' || step === 'pick_fact' || step === 'confirm'}
      <div class="gift-limit-row" aria-label="Daily gift limit">
        {#each Array(DAILY_GIFT_LIMIT) as _, i}
          <span
            class="limit-dot"
            class:limit-dot-used={i >= giftsRemainingToday}
            aria-hidden="true"
          ></span>
        {/each}
        <span class="limit-label">{giftsRemainingToday} gift{giftsRemainingToday !== 1 ? 's' : ''} remaining today</span>
      </div>
    {/if}

    <!-- ============================================================
         STEP: PICK TYPE
         ============================================================ -->
    {#if step === 'pick_type'}
      <p class="step-desc">
        What would you like to send to <strong>{safeOwnerName}</strong>?
      </p>

      {#if !canSendGift}
        <div class="limit-reached-box" role="status">
          <span aria-hidden="true">&#x231B;</span>
          You've sent all {DAILY_GIFT_LIMIT} gifts for today. Come back tomorrow!
        </div>
      {:else}
        <div class="gift-options">
          <!-- Option 1: Send Grey Matter -->
          <button
            class="gift-option-btn"
            type="button"
            onclick={handleSelectMinerals}
          >
            <span class="gift-option-icon" aria-hidden="true">&#x1F4B0;</span>
            <div class="gift-option-info">
              <span class="gift-option-title">Send {GIFT_GREY_MATTER_AMOUNT} Grey Matter</span>
              <span class="gift-option-desc">A small mineral gift from your stockpile</span>
            </div>
            <span class="gift-option-arrow" aria-hidden="true">&#8594;</span>
          </button>

          <!-- Option 2: Share a Fact -->
          <button
            class="gift-option-btn"
            type="button"
            onclick={handleSelectFactLink}
            disabled={hasNoFacts}
          >
            <span class="gift-option-icon" aria-hidden="true">&#x1F4D6;</span>
            <div class="gift-option-info">
              <span class="gift-option-title">Share a Fact</span>
              <span class="gift-option-desc">
                {#if hasNoFacts}
                  Learn some facts first to share them
                {:else}
                  Send a fact from your knowledge collection
                {/if}
              </span>
            </div>
            <span class="gift-option-arrow" aria-hidden="true">&#8594;</span>
          </button>
        </div>
      {/if}

    <!-- ============================================================
         STEP: PICK FACT
         ============================================================ -->
    {:else if step === 'pick_fact'}
      <div class="fact-search-row">
        <input
          class="fact-search-input"
          type="search"
          placeholder="Search facts..."
          value={factSearch}
          oninput={handleFactSearchInput}
          aria-label="Search learned facts"
        />
      </div>

      <div class="fact-list" role="listbox" aria-label="Learned facts">
        {#if filteredFacts.length === 0}
          <p class="empty-note">No facts match your search.</p>
        {:else}
          {#each filteredFacts as fact (fact.factId)}
            <button
              class="fact-row-btn"
              type="button"
              role="option"
              aria-selected={selectedFact?.factId === fact.factId}
              onclick={() => handleSelectFact(fact)}
            >
              <span class="fact-row-icon" aria-hidden="true">&#x1F4D6;</span>
              <span class="fact-row-label">{formatFactLabel(fact.label)}</span>
              <span class="fact-row-arrow" aria-hidden="true">&#8594;</span>
            </button>
          {/each}
        {/if}
      </div>

    <!-- ============================================================
         STEP: CONFIRM
         ============================================================ -->
    {:else if step === 'confirm'}
      <div class="confirm-card">
        <div class="confirm-icon-row">
          {#if selectedType === 'minerals'}
            <span class="confirm-big-icon" aria-hidden="true">&#x1F4B0;</span>
          {:else}
            <span class="confirm-big-icon" aria-hidden="true">&#x1F4D6;</span>
          {/if}
        </div>

        <div class="confirm-details">
          <p class="confirm-sending-to">Sending to <strong>{safeOwnerName}</strong></p>
          {#if selectedType === 'minerals'}
            <p class="confirm-what">
              <strong>{GIFT_GREY_MATTER_AMOUNT} Grey Matter</strong>
            </p>
            <p class="confirm-note">
              This will be deducted from your stockpile upon confirmation.
            </p>
          {:else if selectedFact}
            <p class="confirm-what">Fact link:</p>
            <p class="confirm-fact-id">{formatFactLabel(selectedFact.label)}</p>
            <p class="confirm-note">
              They'll receive a copy — you keep yours too.
            </p>
          {/if}
        </div>
      </div>

      <div class="modal-actions">
        <button
          class="cancel-btn"
          type="button"
          onclick={selectedType === 'fact_link' ? handleBackToFacts : handleBackToType}
        >
          Back
        </button>
        <button
          class="submit-btn"
          type="button"
          onclick={handleConfirmSend}
        >
          Send Gift
        </button>
      </div>

    <!-- ============================================================
         STEP: SENDING
         ============================================================ -->
    {:else if step === 'sending'}
      <div class="center-state">
        <div class="spinner" aria-label="Sending gift..."></div>
        <p class="state-label">Sending gift...</p>
      </div>

    <!-- ============================================================
         STEP: SUCCESS
         ============================================================ -->
    {:else if step === 'success'}
      <div class="center-state" role="status" aria-live="polite">
        <span class="success-icon" aria-hidden="true">&#x2713;</span>
        <p class="state-label">
          Your gift has been sent to <strong>{safeOwnerName}</strong>!
        </p>
        <p class="sub-label">
          {giftsRemainingToday} gift{giftsRemainingToday !== 1 ? 's' : ''} remaining today
        </p>
        <button class="submit-btn" type="button" onclick={onClose}>
          Done
        </button>
      </div>

    <!-- ============================================================
         STEP: ERROR
         ============================================================ -->
    {:else if step === 'error'}
      <div class="center-state" role="alert" aria-live="assertive">
        <span class="error-icon" aria-hidden="true">&#x26A0;</span>
        <p class="state-label">{errorText ?? 'Something went wrong.'}</p>
        {#if giftsRemainingToday > 0}
          <button class="cancel-btn" type="button" onclick={handleRetry}>
            Try Again
          </button>
        {:else}
          <button class="submit-btn" type="button" onclick={onClose}>
            Close
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ============================================================
     BACKDROP
     ============================================================ */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: auto;
  }

  @media (min-height: 520px) {
    .modal-backdrop {
      align-items: center;
    }
  }

  /* ============================================================
     PANEL
     ============================================================ */
  .modal-panel {
    background: #1a1d27;
    border: 1px solid rgba(255, 180, 0, 0.2);
    border-radius: 16px 16px 0 0;
    padding: 20px 20px max(20px, env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    max-height: 80dvh;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
  }

  @media (min-height: 520px) {
    .modal-panel {
      border-radius: 16px;
      padding: 20px;
    }
  }

  /* ============================================================
     HEADER
     ============================================================ */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
  }

  .modal-title {
    color: #ffb400;
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .back-btn,
  .close-btn {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    color: #aaa;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .back-btn:hover,
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  /* ============================================================
     GIFT LIMIT
     ============================================================ */
  .gift-limit-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .limit-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #64dc82;
    flex-shrink: 0;
  }

  .limit-dot-used {
    background: rgba(255, 255, 255, 0.12);
  }

  .limit-label {
    color: #888;
    font-size: 0.75rem;
  }

  /* ============================================================
     STEP: PICK TYPE
     ============================================================ */
  .step-desc {
    color: #aaa;
    font-size: 0.85rem;
    margin: 0;
    flex-shrink: 0;
  }

  .step-desc strong {
    color: #ddd;
  }

  .gift-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .gift-option-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: inherit;
    font-family: inherit;
    padding: 14px 16px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    width: 100%;
  }

  .gift-option-btn:hover:not(:disabled) {
    background: rgba(255, 180, 0, 0.08);
    border-color: rgba(255, 180, 0, 0.25);
  }

  .gift-option-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .gift-option-icon {
    font-size: 1.8rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .gift-option-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .gift-option-title {
    color: #e8e8e8;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .gift-option-desc {
    color: #777;
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .gift-option-arrow {
    color: #666;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .limit-reached-box {
    background: rgba(255, 180, 0, 0.07);
    border: 1px solid rgba(255, 180, 0, 0.2);
    border-radius: 10px;
    color: #aaa;
    font-size: 0.85rem;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* ============================================================
     STEP: PICK FACT
     ============================================================ */
  .fact-search-row {
    flex-shrink: 0;
  }

  .fact-search-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #e8e8e8;
    font-family: inherit;
    font-size: 0.88rem;
    padding: 8px 12px;
  }

  .fact-search-input:focus {
    outline: none;
    border-color: rgba(255, 180, 0, 0.35);
  }

  .fact-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 80px;
  }

  .fact-row-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    color: inherit;
    font-family: inherit;
    padding: 10px 12px;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;
    width: 100%;
    flex-shrink: 0;
  }

  .fact-row-btn:hover {
    background: rgba(255, 180, 0, 0.07);
    border-color: rgba(255, 180, 0, 0.2);
  }

  .fact-row-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .fact-row-label {
    color: #ccc;
    font-size: 0.82rem;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fact-row-arrow {
    color: #555;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .empty-note {
    color: #666;
    font-size: 0.85rem;
    text-align: center;
    padding: 20px 0;
    margin: 0;
  }

  /* ============================================================
     STEP: CONFIRM
     ============================================================ */
  .confirm-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .confirm-icon-row {
    text-align: center;
  }

  .confirm-big-icon {
    font-size: 2.5rem;
    line-height: 1;
  }

  .confirm-details {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .confirm-sending-to {
    color: #aaa;
    font-size: 0.85rem;
    margin: 0;
  }

  .confirm-sending-to strong {
    color: #ddd;
  }

  .confirm-what {
    color: #ffb400;
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .confirm-fact-id {
    color: #ccc;
    font-size: 0.82rem;
    font-style: italic;
    margin: 0;
    word-break: break-word;
  }

  .confirm-note {
    color: #666;
    font-size: 0.78rem;
    margin: 0;
  }

  /* ============================================================
     CENTER STATE (loading / success / error)
     ============================================================ */
  .center-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 20px 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 180, 0, 0.2);
    border-top-color: #ffb400;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .success-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(100, 220, 130, 0.12);
    border: 2px solid rgba(100, 220, 130, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    color: #64dc82;
  }

  .error-icon {
    font-size: 2.5rem;
    line-height: 1;
  }

  .state-label {
    color: #ccc;
    font-size: 0.9rem;
    text-align: center;
    margin: 0;
  }

  .state-label strong {
    color: #ffb400;
  }

  .sub-label {
    color: #666;
    font-size: 0.78rem;
    margin: 0;
    text-align: center;
  }

  /* ============================================================
     ACTION BUTTONS
     ============================================================ */
  .modal-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .cancel-btn {
    flex: 1;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    color: #aaa;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .submit-btn {
    flex: 2;
    min-height: 44px;
    background: rgba(255, 180, 0, 0.2);
    border: 1px solid rgba(255, 180, 0, 0.45);
    border-radius: 10px;
    color: #ffb400;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    background: rgba(255, 180, 0, 0.32);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
