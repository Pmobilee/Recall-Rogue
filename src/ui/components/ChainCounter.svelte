<script lang="ts">
  import { getChainTypeColor, getChainTypeName } from '../../data/chainTypes'

  interface Props {
    isPerfectTurn?: boolean
    chainLength?: number
    chainType?: number | null
    chainMultiplier?: number
    /** AR-310: Active chain color for this turn — always shown even at chain length 0. */
    activeChainColor?: number | null
  }

  let { isPerfectTurn = false, chainLength = 0, chainType = null, chainMultiplier = 1.0, activeChainColor = null }: Props = $props()

  // Task 7.1: Multiplier color uses activeChainColor (turn's chain) not the last card's chainType
  let chainColor = $derived(activeChainColor !== null && activeChainColor !== undefined ? getChainTypeColor(activeChainColor) : (chainType !== null && chainType !== undefined ? getChainTypeColor(chainType) : '#888888'))


  // AR-310: Active chain color indicator — always visible during combat
  let showActiveColor = $derived(activeChainColor !== null && activeChainColor !== undefined)
  let activeColor = $derived(activeChainColor !== null && activeChainColor !== undefined ? getChainTypeColor(activeChainColor) : '#888888')
  let activeName = $derived(activeChainColor !== null && activeChainColor !== undefined ? getChainTypeName(activeChainColor) : '')
  let activeColorKey = $state(0)
  let _prevActiveChainColor: number | null = null
  $effect(() => {
    const acc = activeChainColor
    if (acc !== _prevActiveChainColor) {
      activeColorKey = activeColorKey + 1
    }
    _prevActiveChainColor = acc
  })
</script>

{#if showActiveColor}
  {#key activeColorKey}
    <div
      class="active-chain-bar"
      class:has-chain={chainLength >= 1}
      class:chain-tier-3={chainLength >= 3}
      class:chain-tier-4={chainLength >= 4}
      class:chain-tier-5={chainLength >= 5}
      class:perfect-turn={isPerfectTurn}
      data-testid="active-chain-bar"
      style="--chain-color: {activeColor};"
    >
      <span class="chain-dot" style="background: {activeColor}; box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {activeColor}80;"></span>
      <span class="chain-name" style="color: {activeColor}; text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {activeColor}60;">{activeName}</span>
      {#if chainLength >= 1 && chainType !== null}
        <span class="chain-sep" style="opacity: 0.5;">·</span>
        <span class="chain-mult" style="color: {chainColor};">{chainMultiplier.toFixed(1)}x</span>
      {:else}
        <span class="chain-hint">Play to chain!</span>
      {/if}
    </div>
  {/key}
{/if}



<style>
  /* AR-310: Always-visible active chain color bar */
  .active-chain-bar {
    position: absolute;
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(148px * var(--layout-scale, 1));
    /* z-index 50: renders above the card hand strip (which sits below z-index ~25) */
    z-index: 50;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left: calc(3px * var(--layout-scale, 1)) solid var(--chain-color, #888);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    animation: activeColorIn 180ms ease-out;
  }

  .chain-dot {
    display: inline-block;
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chain-name {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    font-family: 'Cinzel', 'Georgia', serif;
    letter-spacing: 0.04em;
  }

  .chain-sep {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.4);
  }

  .chain-mult {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 900;
    font-family: 'Cinzel', 'Georgia', serif;
  }

  .chain-hint {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 500;
    opacity: 0.45;
    font-style: italic;
    letter-spacing: 0.02em;
  }

  .active-chain-bar.has-chain {
    opacity: 1;
  }

  /* Chain tier escalation on active-chain-bar */
  .active-chain-bar.chain-tier-3 .chain-mult {
    filter: brightness(1.2);
    font-size: calc(15px * var(--text-scale, 1));
  }
  .active-chain-bar.chain-tier-4 .chain-mult {
    filter: brightness(1.3);
    font-size: calc(17px * var(--text-scale, 1));
    animation: chainMultPulse 1.5s ease-in-out infinite;
  }
  .active-chain-bar.chain-tier-5 .chain-mult {
    filter: brightness(1.5);
    font-size: calc(19px * var(--text-scale, 1));
    animation: chainMultPulse 1s ease-in-out infinite;
  }
  .active-chain-bar.perfect-turn .chain-mult {
    color: #FFD700 !important;
    filter: brightness(1.6);
    font-size: calc(19px * var(--text-scale, 1));
    animation: chainMultPulse 0.8s ease-in-out infinite;
  }

  @keyframes chainMultPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }

  @media (prefers-reduced-motion: reduce) {
    .active-chain-bar.chain-tier-4 .chain-mult,
    .active-chain-bar.chain-tier-5 .chain-mult,
    .active-chain-bar.perfect-turn .chain-mult {
      animation: none;
    }
  }

  @keyframes activeColorIn {
    0% { opacity: 0; transform: translateX(calc(-6px * var(--layout-scale, 1))); }
    100% { opacity: 1; transform: translateX(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .active-chain-bar {
      animation: none;
    }
  }
</style>
