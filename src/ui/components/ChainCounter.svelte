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

  let chainColor = $derived(chainType !== null && chainType !== undefined ? getChainTypeColor(chainType) : '#888888')
  let showChain = $derived(chainLength >= 2 && chainType !== null && chainType !== undefined)
  let chainAnimKey = $state(0)
  let _prevChainLength = 0
  $effect(() => {
    const cl = chainLength
    if (cl >= 2 && cl !== _prevChainLength) {
      chainAnimKey = chainAnimKey + 1
    }
    _prevChainLength = cl
  })

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

{#if showChain}
  {#key chainAnimKey}
    <div
      class="chain-display"
      class:chain-tier-3={chainLength >= 3}
      class:chain-tier-4={chainLength >= 4}
      class:chain-tier-5={chainLength >= 5}
      class:perfect-turn={isPerfectTurn}
      style="color: {chainColor}; text-shadow: 0 0 8px {chainColor}80, 0 1px 3px rgba(0,0,0,0.8);"
      data-testid="chain-display"
    >
      <span class="chain-label">Chain</span>
      <span class="chain-value">{chainMultiplier.toFixed(1)}x</span>
    </div>
  {/key}
{/if}

<style>
  /* AR-310: Always-visible active chain color bar */
  .active-chain-bar {
    position: absolute;
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(148px * var(--layout-scale, 1));
    z-index: 18;
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

  @keyframes activeColorIn {
    0% { opacity: 0; transform: translateX(calc(-6px * var(--layout-scale, 1))); }
    100% { opacity: 1; transform: translateX(0); }
  }

  /* Existing chain streak display */
  .chain-display {
    position: absolute;
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(42px + var(--safe-bottom, 0px));
    z-index: 18;
    pointer-events: none;
    display: flex;
    align-items: baseline;
    gap: calc(4px * var(--layout-scale, 1));
    animation: chainSlam 220ms ease-out;
  }

  .chain-label {
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 600;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .chain-value {
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 900;
    font-family: 'Cinzel', 'Georgia', serif;
  }

  /* Chain tier 3: brighter glow + slight scale-up */
  .chain-display.chain-tier-3 {
    filter: brightness(1.2);
    transform: scale(1.1);
  }

  /* Chain tier 4: pulsing glow animation */
  .chain-display.chain-tier-4 {
    filter: brightness(1.3);
    transform: scale(1.15);
    animation: chainSlam 220ms ease-out, chainPulse 1.5s ease-in-out infinite 220ms;
  }

  /* Chain tier 5+: intense pulse + larger scale */
  .chain-display.chain-tier-5 {
    filter: brightness(1.5);
    transform: scale(1.25);
    animation: chainSlam 220ms ease-out, chainIntensePulse 1s ease-in-out infinite 220ms;
  }

  /* Perfect turn: gold override + celebration pulse */
  .chain-display.perfect-turn {
    color: #FFD700 !important;
    filter: brightness(1.6) drop-shadow(0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.6));
    transform: scale(1.3);
    animation: chainSlam 220ms ease-out, perfectPulse 0.8s ease-in-out infinite 220ms;
  }

  .chain-tier-4 .chain-value {
    font-size: calc(20px * var(--layout-scale, 1));
  }

  .chain-tier-5 .chain-value {
    font-size: calc(24px * var(--layout-scale, 1));
  }

  .perfect-turn .chain-value {
    font-size: calc(26px * var(--layout-scale, 1));
  }

  @keyframes chainSlam {
    0% { transform: scale(1.3); opacity: 0; }
    60% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1); }
  }

  @keyframes chainPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }

  @keyframes chainIntensePulse {
    0%, 100% { opacity: 1; filter: brightness(1.5); }
    50% { opacity: 0.8; filter: brightness(2.0); }
  }

  @keyframes perfectPulse {
    0%, 100% { transform: scale(1.3); }
    50% { transform: scale(1.4); }
  }

  @media (prefers-reduced-motion: reduce) {
    .chain-display.chain-tier-4,
    .chain-display.chain-tier-5,
    .chain-display.perfect-turn {
      animation: chainSlam 220ms ease-out;
    }
    .active-chain-bar {
      animation: none;
    }
  }
</style>
