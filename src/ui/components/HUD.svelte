<script lang="ts">
  import { activeRelics, activeSynergies, activeUpgrades, pickaxeTier, scannerTier, currentBiome, currentDepth, currentLayer, inventory, oxygenCurrent, oxygenMax, pastPointOfNoReturn, activeCompanion, companionBadgeFlash } from '../stores/gameState'
  import { BALANCE } from '../../data/balance'
  import GaiaToast from './GaiaToast.svelte'

  interface Props {
    onSurface?: () => void
    onOpenBackpack?: () => void
    onOpenRunStats?: () => void
    onUseBomb?: () => void
  }

  let { onSurface, onOpenBackpack, onOpenRunStats, onUseBomb }: Props = $props()

  let showSurfaceConfirm = $state(false)

  let upgradeToast = $state<string | null>(null)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null

  const upgradeNames: Record<string, string> = {
    'pickaxe_boost': 'Pickaxe+',
    'scanner_boost': 'Scanner+',
    'backpack_expand': 'Backpack+',
    'oxygen_efficiency': 'O2 Saver',
    'bomb': 'Bomb!',
  }

  const bombCount = $derived(($activeUpgrades['bomb'] ?? 0))

  // Scanner tier colors: basic=gray, enhanced=green, advanced=blue, deep=purple
  const SCANNER_TIER_COLORS = ['#888888', '#44cc66', '#4488ff', '#aa44ff'] as const
  const scannerTierColor = $derived(SCANNER_TIER_COLORS[$scannerTier] ?? '#888888')
  const scannerTierName = $derived(BALANCE.SCANNER_TIERS[$scannerTier]?.name ?? 'Scanner')

  function handleUseBomb(): void {
    onUseBomb?.()
  }

  const upgradeTotal = $derived(Object.values($activeUpgrades).reduce((sum, n) => sum + n, 0))
  let lastUpgradeTotal = $state(0)

  $effect(() => {
    const total = upgradeTotal
    if (total > lastUpgradeTotal && total > 0) {
      const entries = Object.entries($activeUpgrades)
      const latest = entries[entries.length - 1]
      if (latest) {
        upgradeToast = upgradeNames[latest[0]] ?? latest[0]
        if (toastTimeout) clearTimeout(toastTimeout)
        toastTimeout = setTimeout(() => {
          upgradeToast = null
        }, 2000)
      }
    }
    lastUpgradeTotal = total
  })

  const oxygenRatio = $derived(($oxygenMax > 0 ? $oxygenCurrent / $oxygenMax : 0))
  const oxygenPercent = $derived(Math.max(0, Math.min(100, Math.round(oxygenRatio * 100))))
  const oxygenTone = $derived(oxygenRatio > 0.6 ? 'safe' : oxygenRatio >= 0.3 ? 'warn' : 'danger')
  const oxygenText = $derived(`O2: ${Math.max(0, Math.floor($oxygenCurrent))}/${Math.max(0, Math.floor($oxygenMax))}`)
  const filledSlots = $derived($inventory.filter((slot) => slot.type !== 'empty').length)
  const totalSlots = $derived($inventory.length)

  function handleSurface(): void {
    if ($pastPointOfNoReturn) return
    showSurfaceConfirm = !showSurfaceConfirm
  }

  function confirmSurface(): void {
    showSurfaceConfirm = false
    onSurface?.()
  }

  function cancelSurface(): void {
    showSurfaceConfirm = false
  }

  function handleOpenBackpack(): void {
    onOpenBackpack?.()
  }

  function handleOpenRunStats(): void {
    onOpenRunStats?.()
  }
</script>

<div class="hud">
  <div class="top-row">
    <div class="oxygen-panel">
      <div class="oxygen-label">{oxygenText}</div>
      <div class="oxygen-track" aria-hidden="true">
        <div class="oxygen-fill {oxygenTone}" style={`width: ${oxygenPercent}%`}></div>
      </div>
      {#if Object.keys($activeUpgrades).filter(u => u !== 'bomb').length > 0}
        <button class="upgrades-row" type="button" onclick={() => onOpenRunStats?.()} aria-label="Open run stats">
          {#each Object.entries($activeUpgrades).filter(([u]) => u !== 'bomb') as [upgrade, count]}
            {#if upgrade === 'pickaxe_boost'}
            <span
              class="upgrade-icon"
              title={BALANCE.PICKAXE_TIERS[$pickaxeTier]?.name ?? 'Pickaxe'}
              style="background-color: color-mix(in srgb, {BALANCE.PICKAXE_TIERS[$pickaxeTier]?.color ?? '#888888'} 50%, var(--color-surface) 50%); border: 1px solid {BALANCE.PICKAXE_TIERS[$pickaxeTier]?.color ?? '#888888'};"
            >{BALANCE.PICKAXE_TIERS[$pickaxeTier]?.name.charAt(0) ?? 'P'}</span>
          {:else}
            {#if upgrade === 'scanner_boost'}
            <span
              class="upgrade-icon"
              title={scannerTierName}
              style="background-color: color-mix(in srgb, {scannerTierColor} 40%, var(--color-surface) 60%); border: 1px solid {scannerTierColor};"
            >S</span>
            {:else}
            <span class="upgrade-icon" title={upgrade}>
              {#if upgrade === 'backpack_expand'}B
              {:else if upgrade === 'oxygen_efficiency'}O
              {/if}
              {#if count > 1}<span class="upgrade-stack">{count}</span>{/if}
            </span>
            {/if}
          {/if}
          {/each}
        </button>
      {/if}
      {#if $activeRelics.length > 0}
        <button class="relics-row" type="button" onclick={() => onOpenRunStats?.()} aria-label="Open run stats (relics)">
          {#each $activeRelics.slice(0, 6) as relic}
            <span class="relic-badge" title="{relic.name}: {relic.description}">{relic.icon}</span>
          {/each}
        </button>
      {/if}
      {#if $activeSynergies.length > 0}
        <button class="synergies-row" type="button" onclick={() => onOpenRunStats?.()} aria-label="Open run stats (synergies)">
          {#each $activeSynergies as syn}
            <span class="synergy-badge" title="{syn.name}: {syn.description}" style="filter: drop-shadow(0 0 3px gold)">{syn.icon}</span>
          {/each}
        </button>
      {/if}
      {#if $activeCompanion}
        <div
          class="companion-row"
          class:companion-row--flash={$companionBadgeFlash}
          title="{$activeCompanion.name}: {$activeCompanion.effect.type.replace(/_/g, ' ')}"
          aria-label="Active companion: {$activeCompanion.name}"
        >
          <span class="companion-icon">{$activeCompanion.icon}</span>
          <span class="companion-name">{$activeCompanion.name}</span>
        </div>
      {/if}
    </div>
    <div class="depth-indicator">
      {#if BALANCE.MAX_LAYERS > 1}Layer {$currentLayer + 1} | {/if}Depth: {$currentDepth}
      {#if $currentBiome}
        <div class="biome-name">{$currentBiome}</div>
      {/if}
    </div>
  </div>

  {#if showSurfaceConfirm}
    <div class="surface-confirm">
      <span class="confirm-text">Surface now?</span>
      <button class="confirm-yes" type="button" onclick={confirmSurface}>Yes</button>
      <button class="confirm-no" type="button" onclick={cancelSurface}>No</button>
    </div>
  {:else}
    <button
      class="surface-btn"
      class:surface-btn--disabled={$pastPointOfNoReturn}
      type="button"
      onclick={handleSurface}
      disabled={$pastPointOfNoReturn}
      aria-disabled={$pastPointOfNoReturn}
    >
      {$pastPointOfNoReturn ? '🚫 Too Deep' : '↑ Surface'}
    </button>
  {/if}

  <button
    class="backpack-btn"
    type="button"
    onclick={handleOpenBackpack}
    aria-label="Open backpack"
  >
    {filledSlots}/{totalSlots}
  </button>

  <button
    class="stats-btn"
    type="button"
    onclick={handleOpenRunStats}
    aria-label="Open run stats"
  >
    ≡
  </button>

  {#if bombCount > 0}
    <button
      class="bomb-btn"
      type="button"
      onclick={handleUseBomb}
      aria-label="Use bomb ({bombCount} remaining)"
    >
      <span class="bomb-icon">B</span>
      <span class="bomb-count">{bombCount}</span>
    </button>
  {/if}

  {#if upgradeToast}
    <div class="upgrade-toast">
      {upgradeToast}
    </div>
  {/if}

  <GaiaToast />
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    font-family: 'Courier New', monospace;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .top-row {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .oxygen-panel {
    flex: 1;
    min-width: 10rem;
    max-width: min(26rem, 70vw);
    padding: 0.5rem 0.625rem;
    background: color-mix(in srgb, var(--color-bg) 75%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-surface) 70%, var(--color-text) 30%);
    border-radius: 0.5rem;
  }

  .oxygen-label,
  .depth-indicator {
    color: var(--color-text);
    font-size: 0.85rem;
    line-height: 1.2;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  }

  .oxygen-track {
    margin-top: 0.4rem;
    width: 100%;
    height: 0.7rem;
    background: color-mix(in srgb, var(--color-surface) 85%, var(--color-bg) 15%);
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-bg) 60%, var(--color-text) 40%);
  }

  .oxygen-fill {
    height: 100%;
    width: 0%;
    transition: width 160ms linear, background-color 160ms linear;
  }

  .oxygen-fill.safe {
    background: var(--color-success);
  }

  .oxygen-fill.warn {
    background: var(--color-warning);
  }

  .oxygen-fill.danger {
    background: var(--color-accent);
  }

  .upgrades-row {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    pointer-events: auto;
    font-family: inherit;
  }

  .upgrade-icon {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-warning) 40%, var(--color-surface) 60%);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 700;
    display: grid;
    place-items: center;
  }

  .upgrade-stack {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 14px;
    height: 14px;
    border-radius: 7px;
    background: var(--color-warning);
    color: #1a1a2e;
    font-size: 0.6rem;
    font-weight: 800;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .relics-row {
    display: flex;
    gap: 4px;
    margin-top: 5px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    pointer-events: auto;
    font-family: inherit;
  }

  .relic-badge {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: color-mix(in srgb, #d4af37 30%, var(--color-surface) 70%);
    border: 1px solid color-mix(in srgb, #d4af37 60%, var(--color-surface) 40%);
    font-size: 0.85rem;
    display: grid;
    place-items: center;
  }

  .synergies-row {
    display: flex;
    gap: 4px;
    margin-top: 5px;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    pointer-events: auto;
    font-family: inherit;
  }

  .synergy-badge {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: color-mix(in srgb, gold 20%, var(--color-surface) 80%);
    border: 1px solid color-mix(in srgb, gold 70%, var(--color-surface) 30%);
    font-size: 0.85rem;
    display: grid;
    place-items: center;
  }

  .depth-indicator {
    padding: 0.6rem 0.7rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-bg) 75%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-surface) 70%, var(--color-text) 30%);
    white-space: nowrap;
  }

  .biome-name {
    font-size: 0.68rem;
    font-style: italic;
    color: color-mix(in srgb, var(--color-text) 65%, transparent);
    margin-top: 0.15rem;
    white-space: nowrap;
  }

  .surface-btn,
  .backpack-btn {
    position: absolute;
    pointer-events: auto;
    border: 1px solid color-mix(in srgb, var(--color-text) 25%, var(--color-surface) 75%);
    background: var(--color-surface);
    color: var(--color-text);
    min-height: 44px;
    min-width: 44px;
    font-family: inherit;
    font-size: 0.95rem;
    line-height: 1;
    touch-action: manipulation;
    cursor: pointer;
  }

  .surface-btn {
    left: 0.75rem;
    bottom: 0.75rem;
    border-radius: 999px;
    padding: 0.8rem 1rem;
    background: color-mix(in srgb, var(--color-success) 35%, var(--color-surface) 65%);
  }

  .surface-btn--disabled,
  .surface-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    background: color-mix(in srgb, var(--color-surface) 80%, var(--color-accent) 20%);
  }

  .surface-btn--disabled:active,
  .surface-btn:disabled:active {
    transform: none;
  }

  .backpack-btn {
    right: 0.75rem;
    bottom: 0.75rem;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface) 70%);
    font-weight: 700;
  }

  .stats-btn {
    position: absolute;
    pointer-events: auto;
    right: 0.75rem;
    bottom: 4.5rem;
    border: 1px solid color-mix(in srgb, var(--color-text) 25%, var(--color-surface) 75%);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface) 80%);
    color: var(--color-text);
    font-size: 1.2rem;
    font-family: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }

  .surface-btn:active,
  .backpack-btn:active,
  .stats-btn:active {
    transform: translateY(1px);
  }

  .bomb-btn {
    position: absolute;
    pointer-events: auto;
    right: 0.75rem;
    bottom: 8rem;
    border: 2px solid color-mix(in srgb, #cc3300 60%, var(--color-surface) 40%);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, #cc3300 40%, var(--color-surface) 60%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
  }

  .bomb-btn:active {
    transform: translateY(1px);
    background: color-mix(in srgb, #ff4400 50%, var(--color-surface) 50%);
  }

  .bomb-icon {
    line-height: 1;
  }

  .bomb-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: #ff4400;
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 800;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .surface-confirm {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    pointer-events: auto;
  }

  .confirm-text {
    color: var(--color-warning);
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .confirm-yes,
  .confirm-no {
    min-height: 44px;
    min-width: 44px;
    border: 1px solid color-mix(in srgb, var(--color-text) 25%, var(--color-surface) 75%);
    border-radius: 999px;
    padding: 0.5rem 0.75rem;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .confirm-yes {
    background: color-mix(in srgb, var(--color-success) 35%, var(--color-surface) 65%);
    color: var(--color-text);
  }

  .confirm-no {
    background: var(--color-surface);
    color: var(--color-text-dim);
  }

  .confirm-yes:active,
  .confirm-no:active {
    transform: translateY(1px);
  }

  @media (max-width: 480px) {
    .top-row {
      top: 0.55rem;
      left: 0.55rem;
      right: 0.55rem;
    }

    .oxygen-panel {
      max-width: 65vw;
      padding: 0.45rem 0.5rem;
    }

    .oxygen-label,
    .depth-indicator {
      font-size: 0.78rem;
    }

    .surface-btn {
      left: 0.55rem;
      bottom: 0.55rem;
      padding: 0.72rem 0.9rem;
    }

    .backpack-btn {
      right: 0.55rem;
      bottom: 0.55rem;
      width: 56px;
      height: 56px;
      font-size: 0.88rem;
    }

    .stats-btn {
      right: 0.55rem;
      bottom: 4.2rem;
    }

    .bomb-btn {
      right: 0.55rem;
      bottom: 7.5rem;
      width: 44px;
      height: 44px;
    }

    .surface-confirm {
      left: 0.55rem;
      bottom: 0.55rem;
    }
  }

  .upgrade-toast {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 0.6rem 1.2rem;
    background: color-mix(in srgb, var(--color-warning) 85%, var(--color-bg) 15%);
    color: #1a1a2e;
    font-size: 1.1rem;
    font-weight: 800;
    border-radius: 12px;
    pointer-events: none;
    animation: toast-pop 2s ease-out forwards;
    z-index: 25;
  }

  @keyframes toast-pop {
    0% { opacity: 0; transform: translate(-50%, -40%) scale(0.8); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    70% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -60%) scale(0.9); }
  }

  .companion-row {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    padding: 2px 5px;
    border-radius: 6px;
    background: color-mix(in srgb, #4ecca3 15%, var(--color-surface) 85%);
    border: 1px solid color-mix(in srgb, #4ecca3 50%, var(--color-surface) 50%);
    width: fit-content;
    transition: box-shadow 200ms ease;
  }

  .companion-row--flash {
    animation: companion-flash 600ms ease-out;
  }

  @keyframes companion-flash {
    0% { box-shadow: 0 0 0px rgba(78, 204, 163, 0); }
    30% { box-shadow: 0 0 10px rgba(78, 204, 163, 0.9); }
    100% { box-shadow: 0 0 0px rgba(78, 204, 163, 0); }
  }

  .companion-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  .companion-name {
    font-size: 0.68rem;
    color: color-mix(in srgb, #4ecca3 90%, var(--color-text) 10%);
    font-weight: 600;
    white-space: nowrap;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
