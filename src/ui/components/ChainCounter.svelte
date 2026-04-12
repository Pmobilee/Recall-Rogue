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

  // Key for full-bar re-mount animation (fires on activeChainColor change once per turn)
  let activeColorKey = $state(0)
  let _prevActiveChainColor: number | null = null
  $effect(() => {
    const acc = activeChainColor
    if (acc !== _prevActiveChainColor) {
      activeColorKey = activeColorKey + 1
    }
    _prevActiveChainColor = acc
  })

  /**
   * Bug 4 fix: key that increments whenever the chain multiplier increases.
   * This remounts the .chain-mult span, triggering the chainBuildPop CSS animation
   * so the player gets visual feedback every time they extend the chain.
   * We only animate on increase (build), not decrease (chain break resets to 0 which
   * is handled by the bar sliding back to "Play to chain!" state).
   */
  let multKey = $state(0)
  let _prevMultiplier = 1.0
  $effect(() => {
    const m = chainMultiplier
    if (m > _prevMultiplier) {
      multKey = multKey + 1
    }
    _prevMultiplier = m
  })

  /**
   * Chain-break animation: fires when chainMultiplier drops from >1 back to 1.0
   * (off-colour card breaks the chain). Remounts the bar via {#key breakKey} to
   * trigger the chainBreakShake keyframe. Mirrors the {#key multKey} pattern above.
   */
  let breakKey = $state(0)
  let _prevBreakMultiplier = 1.0
  $effect(() => {
    const m = chainMultiplier
    if (m <= 1.0 && _prevBreakMultiplier > 1.0) {
      breakKey = breakKey + 1
    }
    _prevBreakMultiplier = m
  })
</script>

{#if showActiveColor}
  {#key activeColorKey}
    <!-- chain-break wrapper: remounts the bar on chain-break to trigger chainBreakShake animation -->
    {#key breakKey}
      <div
        class="active-chain-bar"
        class:has-chain={chainLength >= 1}
        class:chain-tier-3={chainLength >= 3}
        class:chain-tier-4={chainLength >= 4}
        class:chain-tier-5={chainLength >= 5}
        class:perfect-turn={isPerfectTurn}
        class:chain-breaking={breakKey > 0}
        data-testid="active-chain-bar"
        style="--chain-color: {activeColor};"
      >
        <span class="chain-dot" style="background: {activeColor}; box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {activeColor}80;"></span>
        <span class="chain-name" style="color: {activeColor}; text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {activeColor}60;">{activeName}</span>
        {#if chainLength >= 1 && chainType !== null}
          <span class="chain-sep" style="opacity: 0.5;">·</span>
          <!-- Bug 4 fix: {#key multKey} remounts the multiplier element on each chain build,
               triggering the chainBuildPop animation so players see why their damage is changing. -->
          {#key multKey}
            <span class="chain-mult chain-mult-pop" style="color: {chainColor};">{chainMultiplier.toFixed(1)}x</span>
          {/key}
        {:else}
          <span class="chain-hint">Play to chain!</span>
        {/if}
      </div>
    {/key}
  {/key}
{/if}



<style>
  /* AR-310: Always-visible active chain color bar */
  .active-chain-bar {
    position: absolute;
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(148px * var(--layout-scale, 1));
    /* z-index 20: below .quiz-backdrop (25) so chain bar dims during quiz and reappears after */
    z-index: 20;
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

  /**
   * Bug 4 fix: pop animation on chain build.
   * Fires each time the span is remounted via {#key multKey}.
   * A quick scale-up-then-settle tells the player their chain just got stronger.
   * Duration 300ms keeps it snappy without blocking card-play rhythm.
   */
  .chain-mult-pop {
    animation: chainBuildPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    display: inline-block;
  }

  @keyframes chainBuildPop {
    0%   { transform: scale(1.0); }
    40%  { transform: scale(1.45); }
    100% { transform: scale(1.0); }
  }

  .chain-hint {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 500;
    opacity: 1;
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

  /**
   * Chain-break animation: horizontal shake with red tint.
   * Fires when breakKey increments (multiplier drops from >1 to 1.0).
   * 250ms keeps it snappy — short enough not to interrupt the next card play.
   */
  .active-chain-bar.chain-breaking {
    animation: chainBreakShake 250ms ease-out;
  }

  @keyframes chainBreakShake {
    0%   { transform: translateX(0); filter: brightness(1); }
    18%  { transform: translateX(calc(-5px * var(--layout-scale, 1))); filter: brightness(1.8) hue-rotate(-20deg); }
    36%  { transform: translateX(calc(4px * var(--layout-scale, 1))); filter: brightness(1.6) hue-rotate(-20deg); }
    54%  { transform: translateX(calc(-3px * var(--layout-scale, 1))); filter: brightness(1.3) hue-rotate(-10deg); }
    72%  { transform: translateX(calc(2px * var(--layout-scale, 1))); filter: brightness(1.1); }
    100% { transform: translateX(0); filter: brightness(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .chain-mult-pop {
      animation: none;
    }
    .active-chain-bar.chain-tier-4 .chain-mult,
    .active-chain-bar.chain-tier-5 .chain-mult,
    .active-chain-bar.perfect-turn .chain-mult {
      animation: none;
    }
    .active-chain-bar.chain-breaking {
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
