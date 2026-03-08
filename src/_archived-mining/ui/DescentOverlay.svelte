<script lang="ts">
  import { DESCENT_ANIM } from '../../data/balance'

  interface Props {
    visible: boolean
    fromLayer: number        // 1-based layer number player is leaving
    toLayer: number          // 1-based layer number player is entering
    biomeName: string | null // null = same biome, show biome name if changed
    onAnimComplete: () => void
  }

  let { visible, fromLayer, toLayer, biomeName, onAnimComplete }: Props = $props()

  let displayLayer = $state(0)
  let showBiomeName = $state(false)
  let fading = $state(false)

  $effect(() => {
    if (!visible) return
    displayLayer = fromLayer
    showBiomeName = false
    fading = false

    // Count up the layer number
    const step = (toLayer - fromLayer) / 5
    let current = fromLayer
    const countInterval = setInterval(() => {
      current += step
      displayLayer = Math.round(Math.min(current, toLayer))
      if (displayLayer >= toLayer) clearInterval(countInterval)
    }, 80)

    // Show biome name card after 300 ms (if biome changed)
    const t1 = biomeName
      ? setTimeout(() => { showBiomeName = true }, 300)
      : null

    // Begin fade-out
    const holdMs = DESCENT_ANIM.depthCounterHoldMs + (biomeName ? DESCENT_ANIM.biomeCardHoldMs : 0)
    const t2 = setTimeout(() => {
      fading = true
      setTimeout(onAnimComplete, 350)
    }, holdMs)

    return () => {
      clearInterval(countInterval)
      if (t1) clearTimeout(t1)
      clearTimeout(t2)
    }
  })
</script>

{#if visible}
  <div class="descent-overlay" class:fading>
    <div class="depth-counter">
      <span class="arrow">↓</span>
      <span class="layer-num">Layer {displayLayer}</span>
    </div>
    {#if showBiomeName && biomeName}
      <div class="biome-card">Entering: {biomeName}</div>
    {/if}
  </div>
{/if}

<style>
  .descent-overlay {
    position: fixed;
    inset: 0;
    z-index: 250;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, rgba(20, 10, 40, 0.92) 0%, rgba(0, 0, 0, 0.85) 100%);
    font-family: 'Courier New', monospace;
    pointer-events: none;
    transition: opacity 350ms ease-out;
    opacity: 1;
  }

  .descent-overlay.fading {
    opacity: 0;
  }

  .depth-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    animation: counterPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .arrow {
    font-size: 2.5rem;
    color: #8866ff;
    text-shadow: 0 0 20px #8866ff;
    animation: arrowPulse 0.8s ease-in-out infinite;
  }

  .layer-num {
    font-size: clamp(2rem, 10vw, 3.5rem);
    font-weight: 900;
    letter-spacing: 4px;
    color: #ffffff;
    text-shadow: 0 0 30px rgba(136, 102, 255, 0.8);
  }

  .biome-card {
    margin-top: 24px;
    font-size: clamp(1rem, 4vw, 1.4rem);
    color: #aaaacc;
    letter-spacing: 2px;
    text-transform: uppercase;
    animation: biomeSlideIn 0.4s ease-out both;
    text-shadow: 0 0 12px rgba(170, 170, 204, 0.6);
  }

  @keyframes counterPop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes arrowPulse {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(6px); }
  }

  @keyframes biomeSlideIn {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
</style>
