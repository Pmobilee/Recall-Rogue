<script lang="ts">
  import type { InventorySlot, MineralTier, Rarity } from '../../data/types'
  import { BALANCE, getSendUpSlots } from '../../data/balance'

  interface Props {
    slots: InventorySlot[]
    currentLayer: number
    onConfirm: (selectedItems: InventorySlot[]) => void
    onSkip: () => void
  }

  let { slots, currentLayer, onConfirm, onSkip }: Props = $props()

  /** Indices of slots the player has selected to send up. */
  let selectedIndices = $state<Set<number>>(new Set())

  const maxItems = $derived(getSendUpSlots(currentLayer))

  const RARITY_COLORS: Record<Rarity, string> = {
    common: '#9e9e9e',
    uncommon: '#4ecca3',
    rare: '#5dade2',
    epic: '#a855f7',
    legendary: '#ffd369',
    mythic: '#ff6b9d',
  }

  function formatMineralTier(tier: MineralTier | undefined): string {
    switch (tier) {
      case 'dust': return 'Dust'
      case 'shard': return 'Shard'
      case 'crystal': return 'Crystal'
      case 'geode': return 'Geode'
      case 'essence': return 'Essence'
      default: return 'Mineral'
    }
  }

  function formatRarity(rarity: string | undefined): string {
    if (!rarity) return 'Unknown'
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  function handleSlotTap(index: number): void {
    const slot = slots[index]
    if (!slot || slot.type === 'empty') return

    const next = new Set(selectedIndices)
    if (next.has(index)) {
      next.delete(index)
    } else if (next.size < maxItems) {
      next.add(index)
    }
    selectedIndices = next
  }

  function handleConfirm(): void {
    const items = [...selectedIndices].map(i => ({ ...slots[i] }))
    onConfirm(items)
  }

  const selectedCount = $derived(selectedIndices.size)
  const filledSlots = $derived(slots.filter(s => s.type !== 'empty'))
</script>

<section class="sendUp-overlay" aria-label="Send-up station">
  <header class="title-bar">
    <h2>Send-Up Station</h2>
    <p class="subtitle">Secure up to {maxItems} items from Layer {currentLayer}</p>
  </header>

  <div class="slot-grid">
    {#each slots as slot, index}
      {#if slot.type !== 'empty'}
        <button
          class="slot"
          class:mineral={slot.type === 'mineral'}
          class:artifact={slot.type === 'artifact'}
          class:rarity-common={slot.type === 'artifact' && (slot.artifactRarity ?? 'common') === 'common'}
          class:rarity-uncommon={slot.type === 'artifact' && slot.artifactRarity === 'uncommon'}
          class:rarity-rare={slot.type === 'artifact' && slot.artifactRarity === 'rare'}
          class:rarity-epic={slot.type === 'artifact' && slot.artifactRarity === 'epic'}
          class:rarity-legendary={slot.type === 'artifact' && slot.artifactRarity === 'legendary'}
          class:rarity-mythic={slot.type === 'artifact' && slot.artifactRarity === 'mythic'}
          class:selected={selectedIndices.has(index)}
          class:disabled={!selectedIndices.has(index) && selectedCount >= maxItems}
          type="button"
          onclick={() => handleSlotTap(index)}
          aria-label={`Select slot ${index + 1} for send-up`}
          aria-pressed={selectedIndices.has(index)}
        >
          {#if slot.type === 'mineral'}
            <span class="label">{formatMineralTier(slot.mineralTier)}</span>
            <span class="value">x{slot.mineralAmount ?? 0}</span>
          {:else if slot.type === 'artifact'}
            <span class="label" style={`color: ${RARITY_COLORS[slot.artifactRarity ?? 'common']}`}>
              {formatRarity(slot.artifactRarity)}
            </span>
            <span class="value">Artifact</span>
          {:else if slot.type === 'fossil'}
            <span class="label">Fossil</span>
          {/if}
          {#if selectedIndices.has(index)}
            <span class="check-mark" aria-hidden="true">&#10003;</span>
          {/if}
        </button>
      {/if}
    {/each}

    {#if filledSlots.length === 0}
      <p class="empty-msg">Your backpack is empty — nothing to send up.</p>
    {/if}
  </div>

  <div class="counter">
    {selectedCount} / {maxItems} selected
  </div>

  <footer class="actions">
    <button
      class="btn-confirm"
      type="button"
      onclick={handleConfirm}
      disabled={selectedCount === 0}
    >
      Send Up ({selectedCount})
    </button>
    <button
      class="btn-skip"
      type="button"
      onclick={onSkip}
    >
      Skip
    </button>
  </footer>
</section>

<style>
  .sendUp-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.88);
    z-index: 50;
    font-family: 'Courier New', monospace;
    animation: fade-in 180ms ease-out;
  }

  .title-bar {
    padding: 18px 16px 10px;
    border-bottom: 1px solid rgba(68, 170, 221, 0.3);
    text-align: center;
  }

  .title-bar h2 {
    font-size: 1.15rem;
    color: #88ddff;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0 0 4px;
  }

  .subtitle {
    font-size: 0.78rem;
    color: var(--color-text-dim, #8b8b8b);
    margin: 0;
  }

  .slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .empty-msg {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--color-text-dim, #8b8b8b);
    font-size: 0.88rem;
    padding: 2rem 0;
  }

  .slot {
    position: relative;
    min-height: 80px;
    aspect-ratio: 1 / 1;
    border: 2px solid rgba(68, 170, 221, 0.3);
    border-radius: 10px;
    background: rgba(68, 170, 221, 0.08);
    color: var(--color-text, #e0e0e0);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
    padding: 8px;
    cursor: pointer;
    transition: border-color 100ms ease, background 100ms ease;
  }

  .slot.mineral {
    background: rgba(78, 204, 163, 0.15);
    border-color: rgba(78, 204, 163, 0.35);
  }

  .slot.artifact {
    background: rgba(233, 69, 96, 0.1);
    border-color: rgba(233, 69, 96, 0.3);
  }

  .slot.artifact.rarity-uncommon { border-color: #4ecca3; }
  .slot.artifact.rarity-rare     { border-color: #5dade2; }
  .slot.artifact.rarity-epic     { border-color: #a855f7; }
  .slot.artifact.rarity-legendary { border-color: #ffd369; box-shadow: 0 0 10px rgba(255, 211, 105, 0.3); }
  .slot.artifact.rarity-mythic   { border-color: #ff6b9d; box-shadow: 0 0 10px rgba(255, 107, 157, 0.3); }

  .slot.selected {
    border-color: #88ddff;
    background: rgba(68, 170, 221, 0.25);
    box-shadow: 0 0 12px rgba(68, 170, 221, 0.4);
  }

  .slot.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .check-mark {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 1rem;
    color: #88ddff;
    line-height: 1;
  }

  .label {
    font-size: 0.78rem;
    line-height: 1.1;
  }

  .value {
    font-size: 0.85rem;
    font-weight: bold;
    line-height: 1.1;
  }

  .counter {
    text-align: center;
    font-size: 0.82rem;
    color: #88ddff;
    padding: 6px 0 2px;
  }

  .actions {
    display: flex;
    gap: 12px;
    padding: 12px 16px 20px;
  }

  .btn-confirm,
  .btn-skip {
    flex: 1;
    min-height: 52px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    transition: opacity 120ms ease, transform 100ms ease;
  }

  .btn-confirm {
    border: 2px solid #44aadd;
    background: rgba(68, 170, 221, 0.2);
    color: #88ddff;
  }

  .btn-confirm:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-confirm:not(:disabled):active {
    transform: scale(0.97);
    background: rgba(68, 170, 221, 0.35);
  }

  .btn-skip {
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-dim, #8b8b8b);
  }

  .btn-skip:active {
    transform: scale(0.97);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
