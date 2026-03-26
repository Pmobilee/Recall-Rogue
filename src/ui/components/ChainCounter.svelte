<script lang="ts">
  import { getChainTypeColor } from '../../data/chainTypes'

  interface Props {
    isPerfectTurn?: boolean
    chainLength?: number
    chainType?: number | null
    chainMultiplier?: number
  }

  let { isPerfectTurn = false, chainLength = 0, chainType = null, chainMultiplier = 1.0 }: Props = $props()

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
</script>

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
  }
</style>
