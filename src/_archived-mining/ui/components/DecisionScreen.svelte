<script lang="ts">
  import { decisionScreenState } from '../stores/gameState'
  import type { BackpackItemState } from '../../data/types'

  /** Rarity-to-color mapping for visual glow and labels */
  const RARITY_COLORS: Record<string, string> = {
    common: '#9e9e9e',
    uncommon: '#4ecca3',
    rare: '#5dade2',
    epic: '#a855f7',
    legendary: '#ffd369',
    mythic: '#ff6b9d',
  }

  /** Index into existingItems that the player wants to swap out */
  let selectedEvict = $state<number | null>(null)

  /** Whether the store is active */
  let storeState = $derived($decisionScreenState)

  /** The newly found item */
  let newItem = $derived(storeState.newItem)

  /** Current backpack contents (non-empty only) */
  let existingItems = $derived(storeState.existingItems)

  /** Whether the Take It button should be enabled */
  let canTake = $derived(selectedEvict !== null)

  /** Color for the new item glow */
  let glowColor = $derived(
    newItem.rarity ? (RARITY_COLORS[newItem.rarity] ?? '#9e9e9e') : itemTypeColor(newItem)
  )

  /**
   * Get a display color based on item type.
   */
  function itemTypeColor(item: BackpackItemState): string {
    if (item.type === 'mineral') return '#4ecca3'
    if (item.type === 'artifact') return RARITY_COLORS[item.rarity ?? 'common'] ?? '#9e9e9e'
    if (item.type === 'fossil') return '#c4a882'
    return '#9e9e9e'
  }

  /**
   * Format item subtitle (stack count for minerals, rarity for artifacts).
   */
  function itemSubtitle(item: BackpackItemState): string {
    if (item.type === 'mineral' && item.stackCurrent != null) {
      return `x${item.stackCurrent}`
    }
    if (item.type === 'artifact' && item.rarity) {
      return item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)
    }
    if (item.type === 'fossil') {
      return 'Fossil'
    }
    return ''
  }

  /**
   * Select an existing item as the evict candidate.
   */
  function selectEvict(index: number): void {
    selectedEvict = selectedEvict === index ? null : index
  }

  /**
   * Confirm the swap: take the new item, leave the evicted one behind.
   */
  function handleTakeIt(): void {
    if (selectedEvict === null) return
    decisionScreenState.update(s => ({ ...s, selectedEvictIndex: selectedEvict, active: false }))
    window.dispatchEvent(new CustomEvent('decision-confirmed', { detail: { action: 'take', evictIndex: selectedEvict } }))
    selectedEvict = null
  }

  /**
   * Decline the new item: leave it behind and close the overlay.
   */
  function handleLeaveIt(): void {
    decisionScreenState.update(s => ({ ...s, selectedEvictIndex: null, active: false }))
    window.dispatchEvent(new CustomEvent('decision-confirmed', { detail: { action: 'leave' } }))
    selectedEvict = null
  }
</script>

{#if storeState.active}
  <div class="decision-overlay" role="dialog" aria-label="Backpack Full — Choose an Item">
    <!-- Top: The Cloth — new item showcase -->
    <div class="cloth-section">
      <h2 class="cloth-title">Backpack Full</h2>
      <p class="cloth-flavor">You found something, but there's no room...</p>
      <div class="new-item-showcase" style="--glow-color: {glowColor}">
        <div class="new-item-icon" style="border-color: {glowColor}">
          <span class="item-type-badge" style="background: {glowColor}">{newItem.type}</span>
        </div>
        <span class="new-item-name" style="color: {glowColor}">{newItem.displayName}</span>
        <span class="new-item-sub">{itemSubtitle(newItem)}</span>
      </div>
    </div>

    <!-- Middle: Your Pack — existing items grid -->
    <div class="pack-section">
      <h3 class="pack-title">Your Pack</h3>
      <p class="pack-hint">Tap an item to swap it out</p>
      <div class="pack-grid">
        {#each existingItems as item, i}
          {@const isSelected = selectedEvict === i}
          {@const color = itemTypeColor(item)}
          <button
            class="pack-item"
            class:selected={isSelected}
            onclick={() => selectEvict(i)}
            aria-label="{item.displayName}{isSelected ? ' (selected to leave behind)' : ''}"
            aria-pressed={isSelected}
          >
            <span class="pack-item-name" style="color: {isSelected ? '#ffa500' : color}">{item.displayName}</span>
            <span class="pack-item-sub">{itemSubtitle(item)}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Bottom: Action buttons -->
    <div class="action-section">
      <button
        class="btn-take"
        disabled={!canTake}
        onclick={handleTakeIt}
        data-testid="btn-decision-take"
      >
        Take It
        {#if canTake && selectedEvict !== null}
          <span class="btn-sub">(leave {existingItems[selectedEvict]?.displayName} behind)</span>
        {/if}
      </button>
      <button
        class="btn-leave"
        onclick={handleLeaveIt}
        data-testid="btn-decision-leave"
      >
        Leave It
      </button>
    </div>
  </div>
{/if}

<style>
  .decision-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.90);
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    gap: 16px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    animation: fadeIn 0.25s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ---- The Cloth: New Item Showcase ---- */
  .cloth-section {
    width: 100%;
    max-width: 340px;
    background: #2a2a3a;
    border-radius: 12px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .cloth-title {
    margin: 0;
    font-size: 1.2rem;
    color: #e0e0e0;
    letter-spacing: 0.06em;
  }

  .cloth-flavor {
    margin: 0;
    font-size: 0.8rem;
    color: #888;
    font-style: italic;
    text-align: center;
  }

  .new-item-showcase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }

  .new-item-icon {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    border: 2px solid #9e9e9e;
    background: radial-gradient(circle at center, var(--glow-color, #9e9e9e) 0%, transparent 70%);
    opacity: 0.9;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .item-type-badge {
    font-size: 0.6rem;
    text-transform: uppercase;
    color: #000;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .new-item-name {
    font-size: 1rem;
    font-weight: bold;
    text-align: center;
  }

  .new-item-sub {
    font-size: 0.75rem;
    color: #aaa;
  }

  /* ---- Your Pack: Existing Items Grid ---- */
  .pack-section {
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .pack-title {
    margin: 0;
    font-size: 1rem;
    color: #ccc;
    text-align: center;
  }

  .pack-hint {
    margin: 0;
    font-size: 0.7rem;
    color: #666;
    text-align: center;
  }

  .pack-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    overflow-y: auto;
    max-height: 240px;
    padding: 4px;
  }

  .pack-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 4px;
    background: #1e1e2e;
    border: 2px solid #3a3a4a;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    min-height: 64px;
  }

  .pack-item:hover {
    border-color: #5a5a6a;
    background: #252535;
  }

  .pack-item.selected {
    border-color: #ffa500;
    background: rgba(255, 165, 0, 0.08);
  }

  .pack-item-name {
    font-size: 0.7rem;
    font-weight: bold;
    text-align: center;
    line-height: 1.2;
    word-break: break-word;
  }

  .pack-item-sub {
    font-size: 0.6rem;
    color: #777;
  }

  /* ---- Action Buttons ---- */
  .action-section {
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-take {
    padding: 14px 16px;
    background: #2a6a3a;
    border: 2px solid #4ecca3;
    border-radius: 10px;
    color: #e0ffe0;
    font-size: 1rem;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .btn-take:hover:not(:disabled) {
    background: #3a7a4a;
    border-color: #6eecc3;
  }

  .btn-take:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    border-color: #555;
    background: #1a2a1a;
    color: #666;
  }

  .btn-sub {
    font-size: 0.7rem;
    font-weight: normal;
    color: #aaa;
  }

  .btn-leave {
    padding: 12px 16px;
    background: transparent;
    border: 1px solid #555;
    border-radius: 10px;
    color: #888;
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-leave:hover {
    border-color: #888;
    color: #aaa;
  }
</style>
