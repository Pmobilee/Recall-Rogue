<script lang="ts">
  import { BALANCE, REVEAL_TIMING } from '../../data/balance'
  import type { Rarity } from '../../data/types'

  interface Props {
    rarity: Rarity
    factStatement: string
    onComplete: () => void
    artifactIconUrl?: string | undefined
  }

  let { rarity, factStatement, onComplete, artifactIconUrl = undefined }: Props = $props()

  const tier = $derived((BALANCE.GACHA_TIERS as Record<string, { durationMs: number; particleCount: number; screenFlash: boolean; screenShake: boolean; soundKey: string; bgColor: string; glowColor: string; labelText: string }>)[rarity] ?? BALANCE.GACHA_TIERS.common)

  const timing = $derived(REVEAL_TIMING[rarity] ?? REVEAL_TIMING['common'])

  // Animation state: 'anticipation' -> 'suspense' -> 'flash' -> 'reveal' -> 'payoff' -> 'done'
  type AnimPhase = 'anticipation' | 'suspense' | 'flash' | 'reveal' | 'payoff' | 'done'
  let phase = $state<AnimPhase>('anticipation')

  // Particle positions (generated on reveal)
  let particles = $state<Array<{ x: number; y: number; angle: number; speed: number; wave: number; isRect: boolean; rotation: number }>>([])

  // Collect pull-in animation state
  let isCollecting = $state(false)

  // Rarity background gradient
  const rarityGradient = $derived.by((): string | null => {
    if (rarity === 'uncommon') return 'radial-gradient(ellipse at 50% 120%, rgba(78,201,160,0.12) 0%, transparent 60%)'
    if (rarity === 'rare')     return 'radial-gradient(ellipse at 50% 100%, rgba(74,158,255,0.18) 0%, transparent 65%)'
    if (rarity === 'epic')     return 'radial-gradient(ellipse at 50% 80%, rgba(204,68,255,0.20) 0%, transparent 70%)'
    if (rarity === 'legendary') return 'radial-gradient(ellipse at 50% 60%, rgba(255,215,0,0.25) 0%, transparent 75%)'
    if (rarity === 'mythic')   return 'radial-gradient(ellipse at 50% 50%, rgba(255,68,170,0.30) 0%, transparent 80%)'
    return null
  })

  $effect(() => {
    const t = timing

    // anticipation → suspense
    const t1 = setTimeout(() => {
      phase = 'suspense'
    }, t.anticipationMs)

    // suspense → flash (or reveal if no flash)
    const t2 = setTimeout(() => {
      if (t.flashMs > 0) {
        phase = 'flash'
      } else {
        // Generate particles for the first wave
        particles = generateParticleWave(tier.particleCount, 0)
        phase = 'reveal'
      }
    }, t.anticipationMs + t.suspenseMs)

    // flash → reveal
    const flashOffset = t.flashMs > 0 ? t.flashMs : 0
    const t3 = t.flashMs > 0 ? setTimeout(() => {
      particles = generateParticleWave(tier.particleCount, 0)
      phase = 'reveal'
      // Fire additional particle waves staggered by 200ms
      for (let wave = 1; wave < t.particleWaveCount; wave++) {
        setTimeout(() => {
          particles = [...particles, ...generateParticleWave(Math.floor(tier.particleCount / t.particleWaveCount), wave)]
        }, wave * 200)
      }
    }, t.anticipationMs + t.suspenseMs + flashOffset) : null

    // If no flash, still fire additional waves after reveal
    const noFlashWaveTimer = t.flashMs === 0 && t.particleWaveCount > 1 ? setTimeout(() => {
      for (let wave = 1; wave < t.particleWaveCount; wave++) {
        setTimeout(() => {
          particles = [...particles, ...generateParticleWave(Math.floor(tier.particleCount / t.particleWaveCount), wave)]
        }, wave * 200)
      }
    }, t.anticipationMs + t.suspenseMs + 50) : null

    // reveal → payoff
    const t4 = setTimeout(() => {
      phase = 'payoff'
    }, t.anticipationMs + t.suspenseMs + flashOffset + t.payoffMs)

    // payoff → done (auto-advance after collectMs if player hasn't tapped)
    const t5 = setTimeout(() => {
      if (phase !== 'done') {
        phase = 'done'
        onComplete()
      }
    }, t.anticipationMs + t.suspenseMs + flashOffset + t.payoffMs + t.collectMs)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (t3) clearTimeout(t3)
      if (noFlashWaveTimer) clearTimeout(noFlashWaveTimer)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  })

  function generateParticleWave(count: number, wave: number): Array<{ x: number; y: number; angle: number; speed: number; wave: number; isRect: boolean; rotation: number }> {
    return Array.from({ length: count }, () => ({
      x: 50,
      y: 50,
      angle: Math.random() * 360,
      speed: 2 + Math.random() * 4,
      wave,
      isRect: (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') && Math.random() > 0.5,
      rotation: Math.random() * 360,
    }))
  }

  function handleCollect(): void {
    if (phase === 'done') return
    if (artifactIconUrl) {
      isCollecting = true
      setTimeout(() => {
        phase = 'done'
        onComplete()
      }, 400)
    } else {
      phase = 'done'
      onComplete()
    }
  }
</script>

<div
  class="gacha-overlay"
  class:phase-anticipation={phase === 'anticipation'}
  class:phase-suspense={phase === 'suspense'}
  class:phase-flash={phase === 'flash'}
  class:phase-reveal={phase === 'reveal'}
  class:phase-payoff={phase === 'payoff'}
  style:--glow={tier.glowColor}
  style:--bg={tier.bgColor}
  style:--pulse-hz={timing.suspensePulseHz}
  style:background-image={rarityGradient ?? undefined}
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
        class:particle-rect={p.isRect}
        style:left="{p.x}%"
        style:top="{p.y}%"
        style:--angle="{p.angle}deg"
        style:--speed="{p.speed}"
        style:--rotation="{p.rotation}deg"
        style:background={tier.glowColor}
        style:animation-delay="{p.wave * 0}ms"
      ></div>
    {/each}
  {/if}

  {#if phase === 'payoff'}
    <div class="fact-reveal-text">{factStatement}</div>
    {#if artifactIconUrl}
      <img
        class="artifact-collect-icon"
        class:collecting={isCollecting}
        src={artifactIconUrl}
        alt="artifact"
      />
    {/if}
    <button class="collect-btn" onclick={handleCollect}>Collect</button>
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
    background-color: var(--bg, #1a1a2e);
    transition: background 0.4s ease;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  .phase-flash {
    filter: brightness(2.5);
    transition: filter 80ms ease-out;
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
    animation: pulseMystery calc(1s / var(--pulse-hz, 1)) ease-in-out infinite;
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

  .particle-rect {
    width: 6px;
    height: 3px;
    border-radius: 1px;
    transform: rotate(var(--rotation, 0deg));
  }

  @keyframes particleFly {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateX(calc(var(--speed, 3) * 60px)) scale(0);
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

  .artifact-collect-icon {
    width: 64px;
    height: 64px;
    image-rendering: pixelated;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    transition: none;
  }

  .artifact-collect-icon.collecting {
    animation: collectPull 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes collectPull {
    0%   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
    60%  { transform: translate(200%, -400%) scale(0.6); opacity: 1; }
    100% { transform: translate(280%, -500%) scale(0);   opacity: 0; }
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
