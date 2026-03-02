<script lang="ts">
  import type { InventorySlot, MineralTier, Rarity } from '../../data/types'
  import { BALANCE } from '../../data/balance'
  import { tempBackpackSlots } from '../stores/gameState'

  interface Props {
    slots: InventorySlot[]
    onClose: () => void
    onDropItem: (index: number) => void
  }

  let { slots, onClose, onDropItem }: Props = $props()

  let selectedIndex = $state<number | null>(null)

  const RARITY_COLORS: Record<Rarity, string> = {
    common: '#9e9e9e',
    uncommon: '#4ecca3',
    rare: '#5dade2',
    epic: '#a855f7',
    legendary: '#ffd369',
    mythic: '#ff6b9d',
  }

  const filledCount = $derived(slots.filter((slot) => slot.type !== 'empty').length)
  const totalCount = $derived(slots.length)

  function formatMineralTier(tier: MineralTier | undefined): string {
    switch (tier) {
      case 'dust':
        return 'Dust'
      case 'shard':
        return 'Shard'
      case 'crystal':
        return 'Crystal'
      case 'geode':
        return 'Geode'
      case 'essence':
        return 'Essence'
      default:
        return 'Mineral'
    }
  }

  function getMaxStackSize(tier: MineralTier | undefined): number {
    switch (tier) {
      case 'dust': return BALANCE.DUST_STACK_SIZE
      case 'shard': return BALANCE.SHARD_STACK_SIZE
      case 'crystal': return BALANCE.CRYSTAL_STACK_SIZE
      case 'geode': return BALANCE.GEODE_STACK_SIZE
      case 'essence': return BALANCE.ESSENCE_STACK_SIZE
      default: return 1
    }
  }

  function getMineralColor(tier: MineralTier | undefined): string {
    switch (tier) {
      case 'geode': return '#9b59b6'
      case 'essence': return '#ffd700'
      default: return ''
    }
  }

  function formatRarity(rarity: string | undefined): string {
    if (!rarity) return 'Unknown'
    return rarity.charAt(0).toUpperCase() + rarity.slice(1)
  }

  function handleSlotTap(index: number): void {
    if (selectedIndex === index) {
      const slot = slots[index]

      if (slot && slot.type !== 'empty' && window.confirm('Drop?')) {
        onDropItem(index)
      }

      selectedIndex = null
      return
    }

    selectedIndex = index
  }

  $effect(() => {
    if (selectedIndex !== null && selectedIndex >= slots.length) {
      selectedIndex = null
    }
  })
</script>

<section class="backpack-overlay" aria-label="Backpack inventory">
  <header class="title-bar">
    <div class="title-group">
      <h2>Backpack ({filledCount}/{totalCount})</h2>
      {#if $tempBackpackSlots > 0}
        <span class="temp-indicator">Temp: +{$tempBackpackSlots}</span>
      {/if}
    </div>
    <button class="close-button" type="button" aria-label="Close backpack" onclick={onClose}>X</button>
  </header>

  <div class="slot-grid">
    {#each slots as slot, index}
      <button
        class="slot"
        class:empty={slot.type === 'empty'}
        class:mineral={slot.type === 'mineral'}
        class:artifact={slot.type === 'artifact'}
        class:rarity-common={slot.type === 'artifact' && (slot.artifactRarity ?? 'common') === 'common'}
        class:rarity-uncommon={slot.type === 'artifact' && slot.artifactRarity === 'uncommon'}
        class:rarity-rare={slot.type === 'artifact' && slot.artifactRarity === 'rare'}
        class:rarity-epic={slot.type === 'artifact' && slot.artifactRarity === 'epic'}
        class:rarity-legendary={slot.type === 'artifact' && slot.artifactRarity === 'legendary'}
        class:rarity-mythic={slot.type === 'artifact' && slot.artifactRarity === 'mythic'}
        class:fossil={slot.type === 'fossil'}
        class:selected={selectedIndex === index}
        type="button"
        onclick={() => handleSlotTap(index)}
        aria-label={`Inventory slot ${index + 1}`}
        aria-pressed={selectedIndex === index}
      >
        {#if slot.type === 'mineral'}
          <span class="label" style={getMineralColor(slot.mineralTier) ? `color: ${getMineralColor(slot.mineralTier)}` : ''}>{formatMineralTier(slot.mineralTier)}</span>
          <span class="value">x{slot.mineralAmount ?? 0}/{getMaxStackSize(slot.mineralTier)}</span>
        {:else if slot.type === 'artifact'}
          <span class="label" style={`color: ${RARITY_COLORS[slot.artifactRarity ?? 'common']}`}>
            {formatRarity(slot.artifactRarity)}
          </span>
          <span class="value">Artifact</span>
        {:else if slot.type === 'fossil'}
          <span class="label">Fossil</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<style>
  .backpack-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: auto;
    z-index: 40;
    height: 60dvh;
    background: var(--color-surface);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    animation: slide-up 220ms ease-out;
    display: flex;
    flex-direction: column;
  }

  .title-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .title-bar h2 {
    font-size: 1rem;
    color: var(--color-text);
  }

  .title-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .temp-indicator {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 15%, transparent 85%);
    border: 1px solid color-mix(in srgb, var(--color-warning) 50%, transparent 50%);
    border-radius: 4px;
    padding: 1px 6px;
    letter-spacing: 0.5px;
  }

  .close-button {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    min-width: 44px;
    min-height: 44px;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 16px;
    padding-bottom: env(safe-area-inset-bottom, 8px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .slot {
    min-height: 80px;
    aspect-ratio: 1 / 1;
    border: 2px solid transparent;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-align: center;
    padding: 8px;
    cursor: pointer;
  }

  .slot.empty {
    background: transparent;
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .slot.mineral {
    background: rgba(78, 204, 163, 0.2);
    color: var(--color-success);
  }

  .slot.artifact {
    background: rgba(233, 69, 96, 0.12);
    color: var(--color-accent);
  }

  .slot.artifact.rarity-common {
    border-color: #9e9e9e;
    box-shadow: 0 0 10px rgba(158, 158, 158, 0.25);
  }

  .slot.artifact.rarity-uncommon {
    border-color: #4ecca3;
    box-shadow: 0 0 10px rgba(78, 204, 163, 0.25);
  }

  .slot.artifact.rarity-rare {
    border-color: #5dade2;
    box-shadow: 0 0 10px rgba(93, 173, 226, 0.25);
  }

  .slot.artifact.rarity-epic {
    border-color: #a855f7;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .slot.artifact.rarity-legendary {
    border-color: #ffd369;
    box-shadow: 0 0 12px rgba(255, 211, 105, 0.35);
  }

  .slot.artifact.rarity-mythic {
    border-color: #ff6b9d;
    box-shadow: 0 0 12px rgba(255, 107, 157, 0.35);
  }

  .slot.fossil {
    background: rgba(255, 255, 255, 0.14);
    color: var(--color-text);
  }

  .slot.selected {
    border-color: var(--color-warning);
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

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }

    to {
      transform: translateY(0);
    }
  }
</style>
