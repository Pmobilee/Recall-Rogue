<script lang="ts">
  import { getChainTypeColor } from '../../data/chainTypes'

  interface Props {
    count: number
    multiplier: number
    isPerfectTurn?: boolean
    chainLength?: number
    chainType?: number | null
    chainMultiplier?: number
  }

  let { count, multiplier, isPerfectTurn = false, chainLength = 0, chainType = null, chainMultiplier = 1.0 }: Props = $props()

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
    left: 12px;
    bottom: calc(42px + var(--safe-bottom, 0px));
    z-index: 18;
    pointer-events: none;
    display: flex;
    align-items: baseline;
    gap: 4px;
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

  @keyframes chainSlam {
    0% { transform: scale(1.3); opacity: 0; }
    60% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1); }
  }
</style>
