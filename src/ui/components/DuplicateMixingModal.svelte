<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { mixArtifacts } from '../stores/playerData'
  import { BALANCE } from '../../data/balance'
  import type { ArtifactCard } from '../../data/types'

  interface DuplicateGroup {
    factId: string
    rarity: string
    cards: ArtifactCard[]
    factPreview: string
  }

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  const RARITY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    epic: '#c084fc',
    legendary: '#fbbf24',
    mythic: '#f43f5e',
  }

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

  // Derive duplicate groups from local save
  const duplicateGroups = $derived.by(() => {
    const cards = $playerSave?.inventoryArtifacts ?? []
    const groupMap = new Map<string, ArtifactCard[]>()
    for (const card of cards) {
      const key = `${card.factId}:${card.rarity}`
      const arr = groupMap.get(key) ?? []
      arr.push(card)
      groupMap.set(key, arr)
    }
    const groups: DuplicateGroup[] = []
    for (const [key, groupCards] of groupMap) {
      if (groupCards.length >= BALANCE.MIX_MIN_CARDS) {
        const [factId, rarity] = key.split(':')
        groups.push({
          factId,
          rarity,
          cards: groupCards,
          factPreview: factId.replace(/_/g, ' ').slice(0, 40),
        })
      }
    }
    return groups
  })

  // Selected group for mixing
  let selectedGroup = $state<DuplicateGroup | null>(null)
  let showPicker = $state(false)

  // Mixing state
  let mixing = $state(false)
  let mixResult = $state<{ upgraded: boolean; newRarity: string } | null>(null)
  let animating = $state(false)
  let errorMessage = $state('')

  const dustBalance = $derived($playerSave?.minerals.dust ?? 0)
  const canAffordFee = $derived(dustBalance >= BALANCE.MIX_FEE_DUST)

  function selectDuplicate(group: DuplicateGroup): void {
    selectedGroup = group
    showPicker = false
    mixResult = null
    errorMessage = ''
  }

  function clearSelection(): void {
    selectedGroup = null
    mixResult = null
  }

  function performMix(): void {
    if (!selectedGroup) return
    if (!canAffordFee) {
      errorMessage = `Not enough dust. Need ${BALANCE.MIX_FEE_DUST}.`
      return
    }

    mixing = true
    animating = true
    errorMessage = ''
    mixResult = null

    // Pick the first MIX_MIN_CARDS instanceIds from the group
    const idsToMix = selectedGroup.cards.slice(0, BALANCE.MIX_MIN_CARDS).map(c => c.instanceId)
    const baseRarity = selectedGroup.rarity
    const outputRarity = mixArtifacts(idsToMix)

    if (outputRarity) {
      const upgraded = RARITY_ORDER.indexOf(outputRarity) > RARITY_ORDER.indexOf(baseRarity)
      mixResult = { upgraded, newRarity: outputRarity }
      selectedGroup = null
    } else {
      errorMessage = 'Mix failed. Check your cards and dust balance.'
    }

    mixing = false
    setTimeout(() => { animating = false }, 1400)
  }

  function rarityColor(rarity: string): string {
    return RARITY_COLORS[rarity] ?? '#9ca3af'
  }

  function formatRarity(rarity: string): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  const canMix = $derived(selectedGroup !== null && !mixing && canAffordFee)

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Duplicate Mixing"
  onclick={handleBackdropClick}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Mix Duplicates</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close">X</button>
    </div>

    <div class="modal-body">
      <p class="description">
        Combine <strong>{BALANCE.MIX_MIN_CARDS} duplicate cards</strong> of the same type to potentially upgrade their rarity.
        Fee: <strong>{BALANCE.MIX_FEE_DUST} dust</strong> per mix.
      </p>

      {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
      {/if}

      <!-- Odds info -->
      <div class="odds-banner" aria-label="Mix odds">
        <span class="odds-item odds-success">{Math.round(BALANCE.MIX_RARITY_ONE_UP * 100)}% one tier up</span>
        <span class="odds-divider" aria-hidden="true">|</span>
        <span class="odds-item odds-rare">{Math.round(BALANCE.MIX_RARITY_TWO_UP * 100)}% two tiers up</span>
        <span class="odds-divider" aria-hidden="true">|</span>
        <span class="odds-item odds-fail">{Math.round(BALANCE.MIX_RARITY_SAME * 100)}% same</span>
      </div>

      <!-- Dust balance -->
      <div class="dust-balance" class:dust-low={!canAffordFee}>
        Dust: {dustBalance} (fee: {BALANCE.MIX_FEE_DUST})
      </div>

      <!-- 3 slots -->
      <div class="slots-container" aria-label="Card slots for mixing">
        {#each [0, 1, 2] as slotIndex}
          <div
            class="slot"
            class:slot-filled={selectedGroup !== null}
            class:slot-animating={animating && selectedGroup === null && mixResult !== null}
            style={selectedGroup ? `border-color: ${rarityColor(selectedGroup.rarity)}` : ''}
            aria-label="Slot {slotIndex + 1}: {selectedGroup ? formatRarity(selectedGroup.rarity) + ' card' : 'Empty'}"
          >
            {#if selectedGroup}
              <span
                class="rarity-badge"
                style="background: {rarityColor(selectedGroup.rarity)}"
              >{formatRarity(selectedGroup.rarity)}</span>
              <p class="slot-preview">{selectedGroup.factPreview}</p>
              {#if slotIndex === 2}
                <button
                  class="btn-clear"
                  type="button"
                  onclick={clearSelection}
                  aria-label="Clear card selection"
                >X</button>
              {/if}
            {:else}
              <span class="slot-empty" aria-hidden="true">+</span>
              {#if slotIndex === 0}
                <span class="slot-hint">Click to select</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      <!-- Pick card button (shown when no selection) -->
      {#if !selectedGroup}
        <button
          class="btn-pick"
          type="button"
          onclick={() => { showPicker = true }}
          aria-label="Pick a card group to mix"
        >
          Select Duplicate Cards
        </button>
      {/if}

      <!-- Mix result -->
      {#if mixResult}
        <div
          class="result-panel"
          class:result-success={mixResult.upgraded}
          class:result-fail={!mixResult.upgraded}
          role="status"
          aria-live="polite"
          aria-label={mixResult.upgraded ? 'Upgrade successful' : 'Same rarity result'}
        >
          {#if mixResult.upgraded}
            <div class="result-glow" aria-hidden="true"></div>
            <span class="result-icon" aria-hidden="true">*</span>
            <div class="result-text">
              <strong>Upgraded!</strong>
              <span>New rarity: <span style="color: {rarityColor(mixResult.newRarity)}">{formatRarity(mixResult.newRarity)}</span></span>
            </div>
          {:else}
            <span class="result-icon" aria-hidden="true">~</span>
            <div class="result-text">
              <strong>Same rarity</strong>
              <span>Better luck next time! You got a <span style="color: {rarityColor(mixResult.newRarity)}">{formatRarity(mixResult.newRarity)}</span> card.</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Mix button -->
      <button
        class="btn-mix"
        class:btn-disabled={!canMix}
        type="button"
        disabled={!canMix}
        onclick={performMix}
        aria-disabled={!canMix}
        aria-label={canMix ? 'Mix 3 duplicate cards' : 'Select cards to mix'}
      >
        {#if mixing}
          Mixing...
        {:else}
          Mix!
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- Card Picker -->
{#if showPicker}
  <div
    class="picker-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Select duplicate cards to mix"
    onclick={(e) => { if (e.target === e.currentTarget) showPicker = false }}
  >
    <div class="picker-panel">
      <div class="picker-header">
        <h3 class="picker-title">Pick Duplicate Cards</h3>
        <button class="close-btn" type="button" onclick={() => { showPicker = false }} aria-label="Close picker">X</button>
      </div>
      {#if duplicateGroups.length === 0}
        <div class="state-msg">No duplicates available. You need {BALANCE.MIX_MIN_CARDS}+ copies of the same card and rarity.</div>
      {:else}
        <div class="picker-list">
          {#each duplicateGroups as group}
            <button
              class="picker-item"
              style="border-color: {rarityColor(group.rarity)}"
              type="button"
              onclick={() => selectDuplicate(group)}
              aria-label="Mix {group.cards.length} {formatRarity(group.rarity)} copies: {group.factPreview}"
            >
              <span class="rarity-badge" style="background: {rarityColor(group.rarity)}">{formatRarity(group.rarity)}</span>
              <span class="picker-preview">{group.factPreview}</span>
              <span class="dup-count">x{group.cards.length}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop, .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 80;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #7c3aed;
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
    border-bottom: 1px solid #7c3aed44;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #a78bfa;
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

  .description {
    font-size: 0.82rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  .description strong { color: #e2e8f0; }

  .error-banner {
    background: #7f1d1d;
    border: 1px solid #ef4444;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  .odds-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 8px 12px;
    flex-wrap: wrap;
  }

  .odds-item {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .odds-success { color: #4ade80; }
  .odds-rare { color: #60a5fa; }
  .odds-fail { color: #f87171; }
  .odds-divider { color: #475569; }

  .dust-balance {
    font-size: 0.78rem;
    color: #4ecca3;
    font-weight: 600;
    text-align: center;
  }

  .dust-low {
    color: #f87171;
  }

  /* Card slots */
  .slots-container {
    display: flex;
    gap: 8px;
  }

  .slot {
    flex: 1;
    background: #0f172a;
    border: 2px dashed #334155;
    border-radius: 10px;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    position: relative;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .slot-filled {
    border-style: solid;
  }

  @keyframes slot-pulse {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50% { box-shadow: 0 0 12px 3px rgba(167, 139, 250, 0.4); }
  }

  .slot-animating {
    animation: slot-pulse 0.7s ease-in-out 2;
  }

  .slot-empty {
    font-size: 1.5rem;
    color: #334155;
    line-height: 1;
  }

  .slot-hint {
    font-size: 0.6rem;
    color: #475569;
    text-align: center;
  }

  .slot-preview {
    font-size: 0.65rem;
    color: #94a3b8;
    text-align: center;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .rarity-badge {
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #0f172a;
  }

  .btn-clear {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #334155;
    border: 0;
    border-radius: 50%;
    color: #94a3b8;
    font-size: 0.65rem;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .btn-clear:hover { background: #475569; }

  /* Pick button */
  .btn-pick {
    background: #0f172a;
    border: 2px dashed #7c3aed;
    border-radius: 10px;
    color: #a78bfa;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 12px;
    cursor: pointer;
    text-align: center;
    transition: background 0.12s, border-color 0.12s;
  }

  .btn-pick:hover { background: #1a1a2e; border-color: #8b5cf6; }
  .btn-pick:active { transform: translateY(1px); }

  /* Result panel */
  .result-panel {
    border-radius: 10px;
    padding: 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    position: relative;
    overflow: hidden;
  }

  .result-success {
    background: #14532d;
    border: 2px solid #4ade80;
  }

  .result-fail {
    background: #1e1b4b;
    border: 2px solid #818cf8;
  }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.7; }
  }

  .result-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, #4ade8033 0%, transparent 70%);
    animation: glow-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  .result-icon { font-size: 1.4rem; flex-shrink: 0; }

  .result-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.78rem;
    position: relative;
  }

  .result-text strong { color: #e2e8f0; font-size: 0.85rem; }
  .result-text span { color: #94a3b8; }

  /* Mix button */
  .btn-mix {
    background: #7c3aed;
    border: 0;
    border-radius: 10px;
    color: #fff;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    padding: 13px;
    cursor: pointer;
    letter-spacing: 2px;
    text-transform: uppercase;
    transition: background 0.12s;
    width: 100%;
  }

  .btn-mix:hover { background: #8b5cf6; }
  .btn-mix:active:not(:disabled) { transform: translateY(1px); }

  .btn-disabled {
    background: #334155;
    color: #64748b;
    cursor: not-allowed;
  }

  .btn-disabled:hover { background: #334155; }

  /* Picker panel */
  .picker-panel {
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
    color: #a78bfa;
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
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.1s;
    width: 100%;
  }

  .picker-item:hover { border-color: #7c3aed; }
  .picker-item:active { transform: translateY(1px); }

  .picker-preview {
    flex: 1;
    font-size: 0.72rem;
    color: #94a3b8;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .dup-count {
    font-size: 0.72rem;
    font-weight: 700;
    color: #a78bfa;
    flex-shrink: 0;
  }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 20px;
  }
</style>
