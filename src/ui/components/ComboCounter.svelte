<script lang="ts">
  import { getComboDisplayText } from '../utils/comboDisplay'
  import { getChainTypeName, getChainTypeColor } from '../../data/chainTypes'

  interface Props {
    count: number
    multiplier: number
    isPerfectTurn?: boolean
    chainLength?: number
    chainType?: number | null
    chainMultiplier?: number
  }

  let { count, multiplier, isPerfectTurn = false, chainLength = 0, chainType = null, chainMultiplier = 1.0 }: Props = $props()

  let chainName = $derived(chainType !== null && chainType !== undefined ? getChainTypeName(chainType) : '')
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

  let displayText = $derived(
    getComboDisplayText(count, multiplier, isPerfectTurn)
  )
  let visible = $derived(isPerfectTurn || count >= 1)
  // Track previous count without causing effect loops
  let animKey = $state(0)
  let showBreak = $state(false)

  // Use a closure variable (not $state) for previous count to avoid reactive loops
  let _prevCount = 0

  $effect(() => {
    const c = count  // Read count reactively
    // Use untrack for the writes to avoid re-triggering
    if (c >= 1 && c !== _prevCount) {
      animKey = animKey + 1
    }
    if (_prevCount > 0 && c === 0) {
      showBreak = true
      setTimeout(() => { showBreak = false }, 200)
    }
    _prevCount = c
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
      class:combo-1={count === 1}
      class:combo-2={count === 2}
      class:combo-3={count === 3}
      class:combo-4={count === 4}
      class:combo-5={count === 5}
      class:combo-6={count >= 6}
      class:combo-break={showBreak}
      class:perfect-turn={isPerfectTurn}
      data-testid="combo-counter"
    >
      <span class="combo-text">{displayText}</span>
      {#if count >= 5}
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

{#if showChain}
  {#key chainAnimKey}
    <div
      class="chain-display"
      style="color: {chainColor}; text-shadow: 0 0 8px {chainColor}80;"
      data-testid="chain-display"
    >
      <span class="chain-text">{chainName} Chain ×{chainLength}</span>
      {#if chainMultiplier > 1.0}
        <span class="chain-mult" style="color: {chainColor};">{chainMultiplier.toFixed(1)}×</span>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .combo-counter {
    position: absolute;
    right: 12px;
    bottom: calc(42px + var(--safe-bottom, 0px));
    z-index: 18;
    pointer-events: none;
    animation: comboSlamIn 220ms ease-out;
  }
  .combo-text {
    font-size: 14px;
    font-weight: 700;
    color: #facc15;
    text-shadow: 0 0 6px rgba(250, 204, 21, 0.35);
    opacity: 0.9;
  }
  .combo-1 .combo-text {
    font-size: 13px;
    text-shadow: 0 0 4px rgba(250, 204, 21, 0.25);
  }

  /* Tier 2 (1.15x): subtle pulse */
  .combo-2 .combo-text {
    font-size: 14px;
    text-shadow: 0 0 5px rgba(250, 204, 21, 0.3);
  }
  /* Tier 3 (1.3x): particle ring + bigger text */
  .combo-3 .combo-text { font-size: 15px; }
  /* Tier 4 (1.5x): screen edge gold bleed + enhanced glow */
  .combo-4 .combo-text {
    font-size: 16px;
    text-shadow: 0 0 7px rgba(255, 215, 0, 0.5), 0 0 14px rgba(255, 165, 0, 0.2);
  }
  /* Tier 5 (2.0x): biggest text + bright glow */
  .combo-5 .combo-text {
    font-size: 18px;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.9), 0 0 16px rgba(255, 215, 0, 0.5), 0 0 24px rgba(255, 140, 0, 0.25);
  }
  /* Tier 6+ (combo count >= 6): pulsing rainbow-gold */
  .combo-6 .combo-text {
    font-size: 19px;
    text-shadow: 0 0 12px rgba(255, 215, 0, 1), 0 0 18px rgba(255, 200, 0, 0.6);
    animation: comboSlamIn 400ms ease-out, comboGlow 1s ease-in-out infinite alternate;
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
  @keyframes comboSlamIn {
    0% { transform: scale(1.35); opacity: 0; }
    60% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes comboGlow {
    0% { text-shadow: 0 0 24px rgba(255, 215, 0, 1), 0 0 48px rgba(255, 200, 0, 0.7); }
    100% { text-shadow: 0 0 32px rgba(255, 180, 0, 1), 0 0 60px rgba(255, 140, 0, 0.9); }
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

  /* Chain display — appears above combo counter when chain length >= 2 */
  .chain-display {
    position: absolute;
    right: 12px;
    bottom: calc(62px + var(--safe-bottom, 0px));
    z-index: 18;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    animation: comboSlamIn 220ms ease-out;
  }
  .chain-text {
    font-size: 11px;
    font-weight: 700;
    opacity: 0.95;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .chain-mult {
    font-size: 12px;
    font-weight: 700;
    opacity: 0.9;
    align-self: flex-end;
  }
</style>
