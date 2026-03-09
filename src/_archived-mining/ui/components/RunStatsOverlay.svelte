<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import { activeRelics, activeSynergies, activeUpgrades, pickaxeTier, scannerTier, currentDepth, oxygenCurrent, oxygenMax, inventory, tempBackpackSlots } from '../stores/gameState'

  interface Props {
    blocksMined: number
    onClose: () => void
  }

  let { blocksMined, onClose }: Props = $props()

  interface UpgradeInfo {
    key: string
    name: string
    count: number
    effect: string
  }

  const upgradeDescriptions: Record<string, { name: string; effectFn: (count: number) => string }> = {
    pickaxe_boost: {
      name: 'Pickaxe',
      effectFn: (_n) => {
        const tier = BALANCE.PICKAXE_TIERS[$pickaxeTier]
        return tier ? `${tier.name} (Damage: ${tier.damage})` : 'Stone Pick (Damage: 1)'
      },
    },
    scanner_boost: {
      name: 'Scanner',
      effectFn: (_n) => {
        const tier = BALANCE.SCANNER_TIERS[$scannerTier]
        return tier ? `${tier.name} (Range: ${tier.revealRadius})` : 'Basic Scanner (Range: 1)'
      },
    },
    backpack_expand: {
      name: 'Backpack Expand',
      effectFn: (n) => `+${n * BALANCE.UPGRADE_BACKPACK_SLOTS} inventory slots`,
    },
    oxygen_efficiency: {
      name: 'O2 Efficiency',
      effectFn: (n) => {
        const pct = Math.round((1 - Math.pow(BALANCE.UPGRADE_OXYGEN_EFFICIENCY, n)) * 100)
        return `${pct}% oxygen savings`
      },
    },
  }

  const upgrades = $derived.by<UpgradeInfo[]>(() => {
    const rec = $activeUpgrades
    const result: UpgradeInfo[] = []
    for (const [key, count] of Object.entries(rec)) {
      if (count > 0) {
        const desc = upgradeDescriptions[key]
        result.push({
          key,
          name: desc?.name ?? key,
          count,
          effect: desc?.effectFn(count) ?? `x${count}`,
        })
      }
    }
    return result
  })

  const hasUpgrades = $derived(upgrades.length > 0)
</script>

<section class="runstats-overlay" aria-label="Run stats and upgrades">
  <header class="title-bar">
    <h2>Run Stats</h2>
    <button class="close-button" type="button" aria-label="Close run stats" onclick={onClose}>X</button>
  </header>

  <div class="content">
    <div class="stats-section">
      <h3 class="section-title">Current Run</h3>
      <div class="stat-row">
        <span class="stat-label">Depth</span>
        <span class="stat-value">{$currentDepth}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Blocks Mined</span>
        <span class="stat-value">{blocksMined}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Oxygen</span>
        <span class="stat-value">{Math.floor($oxygenCurrent)}/{Math.floor($oxygenMax)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Backpack</span>
        <span class="stat-value">
          {$inventory.length} slots{$tempBackpackSlots > 0 ? ` (+${$tempBackpackSlots} temp)` : ''}
        </span>
      </div>
    </div>

    <div class="upgrades-section">
      <h3 class="section-title">Upgrades</h3>
      {#if hasUpgrades}
        <div class="upgrade-list">
          {#each upgrades as upgrade}
            <div class="upgrade-card">
              <div class="upgrade-header">
                <span class="upgrade-name">{upgrade.name}</span>
                {#if upgrade.count > 1}
                  <span class="upgrade-count">x{upgrade.count}</span>
                {/if}
              </div>
              <span class="upgrade-effect">{upgrade.effect}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-upgrades">No upgrades yet. Break upgrade crates to find them!</p>
      {/if}
    </div>

    <div class="relics-section">
      <h3 class="section-title">Relics</h3>
      {#if $activeRelics.length > 0}
        <div class="relic-list">
          {#each $activeRelics as relic}
            <div class="relic-card">
              <span class="relic-icon">{relic.icon}</span>
              <div class="relic-info">
                <span class="relic-name">{relic.name}</span>
                <span class="relic-desc">{relic.description}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-relics">No relics yet. Find glowing shrines deep in the mine!</p>
      {/if}
    </div>

    <div class="synergies-section">
      <h3 class="section-title">Synergies</h3>
      {#if $activeSynergies.length > 0}
        <div class="synergy-list">
          {#each $activeSynergies as syn}
            <div class="synergy-card">
              <span class="synergy-icon" style="filter: drop-shadow(0 0 3px gold)">{syn.icon}</span>
              <div class="synergy-info">
                <span class="synergy-name">{syn.name}</span>
                <span class="synergy-desc">{syn.description}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-synergies">Collect matching relic pairs to activate synergies!</p>
      {/if}
    </div>
  </div>
</section>

<style>
  .runstats-overlay {
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

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-title {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 10px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stat-label {
    color: var(--color-text-dim);
    font-size: 0.9rem;
  }

  .stat-value {
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .upgrade-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .upgrade-card {
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-surface) 60%);
    border-radius: 10px;
    background: rgba(255, 211, 105, 0.08);
  }

  .upgrade-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .upgrade-name {
    color: var(--color-warning);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .upgrade-count {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-warning) 50%, var(--color-surface) 50%);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .upgrade-effect {
    color: var(--color-text-dim);
    font-size: 0.82rem;
  }

  .no-upgrades {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px 0;
  }

  .relic-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .relic-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, #d4af37 40%, var(--color-surface) 60%);
    border-radius: 10px;
    background: rgba(212, 175, 55, 0.08);
  }

  .relic-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    width: 36px;
    text-align: center;
  }

  .relic-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .relic-name {
    color: #d4af37;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .relic-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
  }

  .no-relics {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px 0;
  }

  .synergy-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .synergy-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, gold 50%, var(--color-surface) 50%);
    border-radius: 10px;
    background: rgba(255, 215, 0, 0.07);
  }

  .synergy-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    width: 36px;
    text-align: center;
  }

  .synergy-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .synergy-name {
    color: gold;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .synergy-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
  }

  .no-synergies {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px 0;
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
