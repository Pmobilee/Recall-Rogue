<script lang="ts">
  import { sacrificeState } from '../stores/gameState'
  import type { BackpackItemState } from '../../data/types'

  const RARITY_COLORS: Record<string, string> = {
    common: '#9e9e9e',
    uncommon: '#4ecca3',
    rare: '#5dade2',
    epic: '#a855f7',
    legendary: '#ffd369',
    mythic: '#ff6b9d',
  }

  /** Local reactive set tracking which item indices are marked for sacrifice. */
  let marked = $state<Set<number>>(new Set())

  /** Snapshot of sacrifice store state. */
  let storeState = $state<{
    active: boolean
    items: BackpackItemState[]
    requiredDropCount: number
  }>({ active: false, items: [], requiredDropCount: 0 })

  /** Keep local state in sync with the store. */
  $effect(() => {
    const unsub = sacrificeState.subscribe(s => {
      storeState = { active: s.active, items: s.items, requiredDropCount: s.requiredDropCount }
      // Reset marked set when overlay activates
      if (s.active) {
        marked = new Set()
      }
    })
    return unsub
  })

  const markedCount = $derived(marked.size)
  const canConfirm = $derived(marked.size >= storeState.requiredDropCount)
  const hasItems = $derived(storeState.items.length > 0)

  /** Toggle an item's marked-for-sacrifice state. */
  function handleItemTap(index: number): void {
    const item = storeState.items[index]
    if (!item || item.type === 'empty') return

    const next = new Set(marked)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    marked = next
  }

  /** Confirm the sacrifice and dispatch event for GameManager. */
  function handleConfirm(): void {
    sacrificeState.update(s => ({ ...s, markedForDrop: new Set(marked), active: false }))
    window.dispatchEvent(new CustomEvent('sacrifice-confirmed', { detail: { markedIndices: [...marked] } }))
  }

  /** Auto-close when there are no items to sacrifice. */
  $effect(() => {
    if (storeState.active && !hasItems) {
      const timer = setTimeout(() => {
        sacrificeState.update(s => ({ ...s, active: false, markedForDrop: new Set() }))
        window.dispatchEvent(new CustomEvent('sacrifice-confirmed', { detail: { markedIndices: [] } }))
      }, 1500)
      return () => clearTimeout(timer)
    }
  })

  function formatRarity(rarity: string | undefined): string {
    if (!rarity) return 'Unknown'
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }
</script>

{#if storeState.active}
  <section class="sacrifice-overlay" aria-label="Emergency ascent — sacrifice items">
    <header class="title-bar">
      <h2>Emergency Ascent</h2>
      {#if hasItems}
        <p class="subtitle">
          O2 depleted — drop at least {storeState.requiredDropCount} item{storeState.requiredDropCount !== 1 ? 's' : ''} to surface
        </p>
      {:else}
        <p class="subtitle">No items — ascending freely</p>
      {/if}
    </header>

    {#if hasItems}
      <div class="slot-grid">
        {#each storeState.items as item, index}
          {#if item.type !== 'empty'}
            <button
              class="slot"
              class:mineral={item.type === 'mineral'}
              class:artifact={item.type === 'artifact'}
              class:fossil={item.type === 'fossil'}
              class:marked={marked.has(index)}
              type="button"
              onclick={() => handleItemTap(index)}
              aria-label={`${marked.has(index) ? 'Unmark' : 'Mark'} ${item.displayName} for sacrifice`}
              aria-pressed={marked.has(index)}
              data-testid={`sacrifice-item-${index}`}
            >
              {#if item.type === 'mineral'}
                <span class="label">{item.displayName}</span>
                <span class="value">x{item.stackCurrent ?? 0}</span>
              {:else if item.type === 'artifact'}
                <span class="label" style={`color: ${RARITY_COLORS[item.rarity ?? 'common']}`}>
                  {item.displayName}
                </span>
                <span class="value">{formatRarity(item.rarity)}</span>
              {:else if item.type === 'fossil'}
                <span class="label">{item.displayName}</span>
                <span class="value">Fossil</span>
              {/if}
              {#if marked.has(index)}
                <span class="drop-mark" aria-hidden="true">X</span>
              {/if}
            </button>
          {/if}
        {/each}
      </div>

      <div class="counter" class:met={canConfirm}>
        Dropping {markedCount} of {storeState.requiredDropCount} required
      </div>

      <footer class="actions">
        <button
          class="btn-confirm"
          type="button"
          onclick={handleConfirm}
          disabled={!canConfirm}
          data-testid="btn-sacrifice-confirm"
        >
          Confirm Ascent ({markedCount})
        </button>
      </footer>
    {:else}
      <div class="empty-container">
        <p class="empty-msg">Backpack empty — returning to surface...</p>
      </div>
    {/if}
  </section>
{/if}

<style>
  .sacrifice-overlay {
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
    border-bottom: 1px solid rgba(255, 68, 68, 0.3);
    text-align: center;
  }

  .title-bar h2 {
    font-size: 1.15rem;
    color: #ff4444;
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

  .slot.fossil {
    background: rgba(180, 140, 80, 0.12);
    border-color: rgba(180, 140, 80, 0.35);
  }

  .slot.marked {
    border-color: #ff4444;
    background: rgba(255, 68, 68, 0.18);
    box-shadow: 0 0 10px rgba(255, 68, 68, 0.3);
  }

  .drop-mark {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 1rem;
    color: #ff4444;
    font-weight: bold;
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
    color: #ff4444;
    padding: 6px 0 2px;
  }

  .counter.met {
    color: #4ecca3;
  }

  .actions {
    display: flex;
    gap: 12px;
    padding: 12px 16px 20px;
  }

  .btn-confirm {
    flex: 1;
    min-height: 52px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    transition: opacity 120ms ease, transform 100ms ease;
    border: 2px solid #ff4444;
    background: rgba(255, 68, 68, 0.2);
    color: #ff6666;
  }

  .btn-confirm:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .btn-confirm:not(:disabled):active {
    transform: scale(0.97);
    background: rgba(255, 68, 68, 0.35);
  }

  .empty-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-msg {
    text-align: center;
    color: var(--color-text-dim, #8b8b8b);
    font-size: 0.88rem;
    padding: 2rem;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
