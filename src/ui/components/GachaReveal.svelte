<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import type { Rarity } from '../../data/types'

  interface Props {
    rarity: Rarity
    factStatement: string
    onComplete: () => void
  }

  let { rarity, factStatement, onComplete }: Props = $props()

  const tier = $derived((BALANCE.GACHA_TIERS as Record<string, { durationMs: number; particleCount: number; screenFlash: boolean; screenShake: boolean; soundKey: string; bgColor: string; glowColor: string; labelText: string }>)[rarity] ?? BALANCE.GACHA_TIERS.common)

  // Animation state: 'anticipation' -> 'suspense' -> 'reveal' -> 'payoff' -> 'done'
  type AnimPhase = 'anticipation' | 'suspense' | 'reveal' | 'payoff' | 'done'
  let phase = $state<AnimPhase>('anticipation')

  // Particle positions (generated on reveal)
  let particles = $state<Array<{ x: number; y: number; angle: number; speed: number }>>([])

  $effect(() => {
    const t1 = setTimeout(() => {
      phase = 'suspense'
    }, 600)

    const t2 = setTimeout(() => {
      particles = Array.from({ length: tier.particleCount }, () => ({
        x: 50,
        y: 50,
        angle: Math.random() * 360,
        speed: 2 + Math.random() * 4,
      }))
      phase = 'reveal'
    }, 600 + 800)

    const t3 = setTimeout(() => {
      phase = 'payoff'
    }, 600 + 800 + tier.durationMs)

    const t4 = setTimeout(() => {
      phase = 'done'
      onComplete()
    }, 600 + 800 + tier.durationMs + 1500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  })
</script>

<div
  class="gacha-overlay"
  class:phase-anticipation={phase === 'anticipation'}
  class:phase-suspense={phase === 'suspense'}
  class:phase-reveal={phase === 'reveal'}
  class:phase-payoff={phase === 'payoff'}
  style:--glow={tier.glowColor}
  style:--bg={tier.bgColor}
  aria-live="assertive"
  aria-label="Artifact reveal: {rarity}"
>
  {#if phase === 'anticipation' || phase === 'suspense'}
    <div class="mystery-box" class:pulse={phase === 'suspense'}>
      <span class="question-mark">?</span>
    </div>
  {/if}

  {#if phase === 'reveal' || phase === 'payoff'}
    <div class="rarity-label" style:color={tier.glowColor}>
      {tier.labelText}
    </div>
    {#each particles as p}
      <div
        class="particle"
        style:left="{p.x}%"
        style:top="{p.y}%"
        style:--angle="{p.angle}deg"
        style:--speed="{p.speed}"
        style:background={tier.glowColor}
      ></div>
    {/each}
  {/if}

  {#if phase === 'payoff'}
    <div class="fact-reveal-text">{factStatement}</div>
    <button class="collect-btn" onclick={onComplete}>Collect</button>
  {/if}
</div>

<style>
  .gacha-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg, #1a1a2e);
    transition: background 0.4s ease;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  .phase-reveal {
    animation: screenFlash 0.15s ease-out;
  }

  @keyframes screenFlash {
    0%   { filter: brightness(1); }
    50%  { filter: brightness(3); }
    100% { filter: brightness(1); }
  }

  .mystery-box {
    width: 120px;
    height: 120px;
    border: 3px solid var(--glow, #888);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px var(--glow, #888);
  }

  .mystery-box.pulse {
    animation: pulseMystery 0.8s ease-in-out infinite;
  }

  @keyframes pulseMystery {
    0%, 100% { box-shadow: 0 0 20px var(--glow, #888); }
    50%       { box-shadow: 0 0 60px var(--glow, #888); }
  }

  .question-mark {
    font-size: 4rem;
    color: var(--glow, #888);
    font-weight: 900;
  }

  .rarity-label {
    font-size: clamp(1.4rem, 6vw, 2.5rem);
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-shadow: 0 0 20px currentColor;
    margin-bottom: 24px;
    animation: labelDrop 0.3s ease-out;
  }

  @keyframes labelDrop {
    from { transform: translateY(-30px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }

  .particle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: particleFly 0.8s ease-out forwards;
    transform-origin: center;
  }

  @keyframes particleFly {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -50%) translateX(200px) scale(0);
      opacity: 0;
    }
  }

  .fact-reveal-text {
    color: #fff;
    font-size: clamp(1rem, 4vw, 1.4rem);
    text-align: center;
    max-width: 80vw;
    line-height: 1.5;
    margin-bottom: 32px;
    animation: fadeUp 0.4s ease-out;
  }

  @keyframes fadeUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .collect-btn {
    min-width: 160px;
    min-height: 48px;
    border: 0;
    border-radius: 12px;
    background: var(--glow, #888);
    color: #000;
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    animation: fadeUp 0.4s 0.2s ease-out both;
  }

  .collect-btn:active {
    transform: scale(0.96);
  }
</style>
