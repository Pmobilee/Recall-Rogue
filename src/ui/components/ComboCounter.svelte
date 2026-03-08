<script lang="ts">
  interface Props {
    count: number  // 0-5, 0-1 = hidden
    isPerfectTurn?: boolean
  }

  let { count, isPerfectTurn = false }: Props = $props()

  let displayText = $derived(count >= 5 ? 'PERFECT!' : count >= 2 ? `${count}x` : '')
  let visible = $derived(count >= 2)
  let animKey = $state(0)
  let prevCount = $state(0)
  let showBreak = $state(false)

  // Trigger bounce animation on count change; detect combo break
  $effect(() => {
    if (count >= 2) {
      animKey++
    }
    if (prevCount > 1 && count === 0) {
      showBreak = true
      setTimeout(() => { showBreak = false }, 200)
    }
    prevCount = count
  })

  /** Generate particle positions for the enhanced particle ring. */
  function getParticles(combo: number): Array<{ x: number; y: number; size: number }> {
    if (combo < 3) return []
    let particleCount: number
    let radius: number
    let size: number
    if (combo >= 5) {
      particleCount = 16; radius = 50; size = 8
    } else if (combo >= 4) {
      particleCount = 12; radius = 40; size = 6
    } else {
      particleCount = 8; radius = 30; size = 6
    }
    const result: Array<{ x: number; y: number; size: number }> = []
    for (let i = 0; i < particleCount; i++) {
      const angle = (2 * Math.PI * i) / particleCount
      result.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size,
      })
    }
    return result
  }

  let particles = $derived(getParticles(count))
</script>

{#if visible || showBreak}
  {#key animKey}
    <div
      class="combo-counter"
      class:combo-3={count >= 3}
      class:combo-4={count >= 4}
      class:combo-5={count >= 5}
      class:combo-break={showBreak}
      class:perfect-turn={isPerfectTurn}
      data-testid="combo-counter"
    >
      <span class="combo-text">{displayText}</span>
      {#if count >= 3}
        <div class="particle-ring">
          {#each particles as p}
            <div
              class="particle-dot"
              style="transform: translate({p.x}px, {p.y}px); width: {p.size}px; height: {p.size}px;"
            ></div>
          {/each}
        </div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .combo-counter {
    position: absolute;
    top: 8px;
    right: 16px;
    z-index: 50;
    animation: comboBounce 300ms ease-out;
  }
  .combo-text {
    font-size: 20px;
    font-weight: 900;
    color: #FFD700;
    text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  }
  .combo-3 .combo-text { font-size: 24px; }
  .combo-4 .combo-text { font-size: 28px; }
  .combo-5 .combo-text {
    font-size: 36px;
    text-shadow: 0 0 16px rgba(255, 215, 0, 0.8);
  }
  .combo-break {
    animation: comboBreak 200ms ease-out forwards;
  }
  .perfect-turn .combo-text {
    text-shadow: 0 0 20px rgba(255, 215, 0, 1), 0 0 40px rgba(255, 215, 0, 0.6);
  }
  .particle-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    animation: ringPulse 2s linear infinite;
  }
  .particle-dot {
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(255, 215, 0, 0.7);
    border-radius: 50%;
    animation: particlePulse 1.5s ease-in-out infinite alternate;
  }
  .combo-4 .particle-ring {
    filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.4));
  }
  .combo-5 .particle-dot {
    background: rgba(255, 215, 0, 0.9);
  }
  @keyframes comboBounce {
    0% { transform: scale(1.5); }
    50% { transform: scale(0.9); }
    100% { transform: scale(1.0); }
  }
  @keyframes comboBreak {
    0%   { transform: scale(1.0); opacity: 1; }
    100% { transform: scale(0.5); opacity: 0; }
  }
  @keyframes ringPulse {
    0% { transform: rotate(0deg) scale(1); opacity: 0.6; }
    50% { transform: rotate(180deg) scale(1.1); opacity: 0.3; }
    100% { transform: rotate(360deg) scale(1); opacity: 0.6; }
  }
  @keyframes particlePulse {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
  }
</style>
