<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    cards: Array<{ id: string; mechanicName: string; factQuestion: string; isUpgraded: boolean; tier: string }>
    onremove: (cardId: string) => void
    oncancel: () => void
  }

  let { cards, onremove, oncancel }: Props = $props()

  let selectedCardId = $state<string | null>(null)
  let showConfirm = $state(false)

  let selectedCard = $derived(cards.find(c => c.id === selectedCardId) ?? null)

  function selectCard(id: string): void {
    selectedCardId = id
    showConfirm = false
  }

  function handleRemoveClick(): void {
    if (!selectedCardId) return
    showConfirm = true
  }

  function confirmRemove(): void {
    if (!selectedCardId) return
    onremove(selectedCardId)
  }

  function cancelConfirm(): void {
    showConfirm = false
  }

  function getTierLabel(tier: string): string {
    const labels: Record<string, string> = {
      '1': 'T1',
      '2a': 'T2a',
      '2b': 'T2b',
      '3': 'T3',
    }
    return labels[tier] ?? tier
  }

  function getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      '1': '#6E7681',
      '2a': '#3498DB',
      '2b': '#9B59B6',
      '3': '#F1C40F',
    }
    return colors[tier] ?? '#6E7681'
  }
</script>

<div class="meditate-overlay" class:landscape={$isLandscape}>
  <div class="meditate-panel">
    <h2 class="meditate-title">Meditate — Remove a Card</h2>
    <p class="meditate-caption">Select a card to permanently remove from your deck.</p>

    <div class="cards-list">
      {#each cards as card}
        <button
          class="card-row"
          class:selected={card.id === selectedCardId}
          onclick={() => selectCard(card.id)}
        >
          <span class="card-name">
            {card.mechanicName}
            {#if card.isUpgraded}
              <span class="upgraded-badge">+</span>
            {/if}
          </span>
          <span class="tier-badge" style="color: {getTierColor(card.tier)}">
            {getTierLabel(card.tier)}
          </span>
          <p class="card-question">{card.factQuestion}</p>
        </button>
      {/each}
    </div>

    <div class="action-row">
      <button class="cancel-btn" onclick={oncancel}>Cancel</button>
      <button
        class="remove-btn"
        disabled={!selectedCardId}
        onclick={handleRemoveClick}
      >
        Remove Card
      </button>
    </div>
  </div>

  {#if showConfirm && selectedCard}
    <div class="confirm-backdrop">
      <div class="confirm-dialog">
        <p class="confirm-text">
          Remove <strong>{selectedCard.mechanicName}</strong>?
        </p>
        <p class="confirm-subtext">This card will be permanently removed from your deck.</p>
        <div class="confirm-btns">
          <button class="confirm-cancel-btn" onclick={cancelConfirm}>Keep It</button>
          <button class="confirm-remove-btn" onclick={confirmRemove}>Yes, Remove</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .meditate-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .meditate-panel {
    background: #161B22;
    border: 2px solid #14B8A6;
    border-radius: 12px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(420px * var(--layout-scale, 1));
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(14px * var(--layout-scale, 1));
    max-height: 90vh;
    overflow: hidden;
  }

  .meditate-title {
    font-family: var(--font-pixel, monospace);
    font-size: calc(16px * var(--layout-scale, 1));
    color: #14B8A6;
    margin: 0;
    text-align: center;
  }

  .meditate-caption {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8B949E;
    margin: 0;
    text-align: center;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    overflow-y: auto;
    max-height: calc(50vh);
    padding-right: calc(4px * var(--layout-scale, 1));
  }

  .cards-list::-webkit-scrollbar {
    width: 4px;
  }

  .cards-list::-webkit-scrollbar-track {
    background: #0d1117;
  }

  .cards-list::-webkit-scrollbar-thumb {
    background: #14B8A6;
    border-radius: 2px;
  }

  .card-row {
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    text-align: left;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    transition: border-color 0.15s;
  }

  .card-row:hover {
    border-color: #14B8A6;
  }

  .card-row.selected {
    border-color: #14B8A6;
    background: #0f2a27;
  }

  .card-name {
    font-size: calc(13px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-weight: 700;
    grid-column: 1;
    grid-row: 1;
  }

  .upgraded-badge {
    color: #2ECC71;
    font-weight: 700;
  }

  .tier-badge {
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 700;
    grid-column: 2;
    grid-row: 1;
    align-self: center;
  }

  .card-question {
    font-size: calc(10px * var(--layout-scale, 1));
    color: #6E7681;
    margin: 0;
    grid-column: 1 / 3;
    grid-row: 2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .cancel-btn {
    flex: 1;
    background: transparent;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    color: #8B949E;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .cancel-btn:hover {
    border-color: #8B949E;
    color: #E6EDF3;
  }

  .remove-btn {
    flex: 1;
    background: #E74C3C;
    border: 2px solid #E74C3C;
    border-radius: 8px;
    padding: calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-family: var(--font-pixel, monospace);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
  }

  .remove-btn:hover:not(:disabled) {
    background: #C0392B;
    border-color: #C0392B;
  }

  .remove-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Confirm dialog */
  .confirm-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(13, 17, 23, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 12px;
  }

  .confirm-dialog {
    background: #1E2D3D;
    border: 2px solid #E74C3C;
    border-radius: 10px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(320px * var(--layout-scale, 1));
    width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    text-align: center;
  }

  .confirm-text {
    font-size: calc(15px * var(--layout-scale, 1));
    color: #E6EDF3;
    margin: 0;
  }

  .confirm-subtext {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8B949E;
    margin: 0;
  }

  .confirm-btns {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .confirm-cancel-btn {
    flex: 1;
    background: transparent;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    color: #8B949E;
    cursor: pointer;
  }

  .confirm-cancel-btn:hover {
    border-color: #8B949E;
    color: #E6EDF3;
  }

  .confirm-remove-btn {
    flex: 1;
    background: #E74C3C;
    border: 2px solid #E74C3C;
    border-radius: 8px;
    padding: calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-family: var(--font-pixel, monospace);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
  }

  .confirm-remove-btn:hover {
    background: #C0392B;
    border-color: #C0392B;
  }

  /* === Landscape layout === */
  .meditate-overlay.landscape .meditate-panel {
    max-width: min(65vw, 700px);
    max-height: 85vh;
  }

  .meditate-overlay.landscape .cards-list {
    max-height: 55vh;
  }
</style>
