<script lang="ts">
  /**
   * PaintRevealOverlay.svelte
   *
   * Full-screen painting reveal animation (Phase 47, DD-V2-046).
   *
   * Animation phases:
   *  1. Fade in from black showing the greyscale silhouette (300ms)
   *  2. Hold for 800ms — GAIA comment appears letter-by-letter
   *  3. Color wash sweeps left-to-right (tier-dependent duration from TIER_VISUALS)
   *  4. Glow ring pulses three times
   *  5. Tier badge drops from top with bounce
   *  6. Auto-dismiss after 2s, or immediate on tap
   */
  import { onMount, onDestroy } from 'svelte'
  import { pendingReveal, markRevealComplete } from '../stores/achievements'
  import { TIER_VISUALS } from '../../data/achievementTiers'

  const reveal = $pendingReveal
  let phase: 'fadein' | 'hold' | 'wash' | 'glow' | 'badge' | 'done' = $state('fadein')
  let gaiaText = $state('')
  let gaiaIndex = $state(0)
  let washPercent = $state(0)
  let glowOpacity = $state(0)
  let badgeY = $state(-80)
  let overlayOpacity = $state(0)
  let dismissed = $state(false)

  const tierVisuals = $derived(reveal ? TIER_VISUALS[reveal.painting.tier] : null)
  const currentGaiaText = $derived(gaiaText.slice(0, gaiaIndex))

  let rafId: number
  let typewriterInterval: ReturnType<typeof setInterval>
  let phaseTimeout: ReturnType<typeof setTimeout>

  function dismiss() {
    if (dismissed) return
    dismissed = true
    clearAllTimers()
    overlayOpacity = 0
    setTimeout(() => markRevealComplete(), 350)
  }

  function clearAllTimers() {
    if (rafId) cancelAnimationFrame(rafId)
    if (typewriterInterval) clearInterval(typewriterInterval)
    if (phaseTimeout) clearTimeout(phaseTimeout)
  }

  function startReveal() {
    if (!reveal) return
    gaiaText = reveal.painting.gaiaComment
    gaiaIndex = 0

    // Phase 1: fade in
    const fadeStep = () => {
      overlayOpacity = Math.min(1, overlayOpacity + 0.05)
      if (overlayOpacity < 1) {
        rafId = requestAnimationFrame(fadeStep)
      } else {
        phase = 'hold'
        startTypewriter()
      }
    }
    rafId = requestAnimationFrame(fadeStep)
  }

  function startTypewriter() {
    typewriterInterval = setInterval(() => {
      if (gaiaIndex < gaiaText.length) {
        gaiaIndex++
      } else {
        clearInterval(typewriterInterval)
        phaseTimeout = setTimeout(startWash, 600)
      }
    }, 28) // ~35 chars/second
  }

  function startWash() {
    if (!tierVisuals) return
    phase = 'wash'
    const duration = tierVisuals.revealDurationMs
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      washPercent = progress * 100
      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        phase = 'glow'
        startGlow()
      }
    }
    rafId = requestAnimationFrame(step)
  }

  function startGlow() {
    let pulses = 0
    const pulseStep = () => {
      pulses++
      glowOpacity = pulses % 2 === 1 ? 0.9 : 0.3
      if (pulses < 6) {
        phaseTimeout = setTimeout(pulseStep, 200)
      } else {
        phase = 'badge'
        startBadgeDrop()
      }
    }
    pulseStep()
  }

  function startBadgeDrop() {
    const startTime = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / 500)
      // Overshoot bounce easing
      const overshoot = 1 + Math.sin(t * Math.PI) * 0.12
      badgeY = (t - 1) * 80 * (1 - t * 0.5) * overshoot
      if (t < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        badgeY = 0
        phase = 'done'
        phaseTimeout = setTimeout(dismiss, 2000)
      }
    }
    rafId = requestAnimationFrame(step)
  }

  onMount(() => {
    if (reveal) startReveal()
  })

  onDestroy(() => clearAllTimers())
</script>

{#if reveal && tierVisuals}
  <div
    class="reveal-overlay"
    role="dialog"
    aria-label="Achievement unlocked: {reveal.painting.title}"
    tabindex="-1"
    style="opacity: {overlayOpacity}"
    onclick={dismiss}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss() }}
  >
    <!-- Painting display area -->
    <div class="painting-frame" style="border-color: {tierVisuals.borderColor}; box-shadow: 0 0 40px {glowOpacity > 0.5 ? tierVisuals.glowColor : 'transparent'}">
      <!-- Greyscale base image (always shown) -->
      <img
        class="painting-base"
        src="/assets/sprites-hires/dome/{reveal.painting.silhouetteKey}.png"
        alt="{reveal.painting.title} — locked silhouette"
        draggable="false"
      />
      <!-- Color overlay, clipped to reveal wash progress -->
      <img
        class="painting-color"
        src="/assets/sprites-hires/dome/{reveal.painting.spriteKey}.png"
        alt="{reveal.painting.title}"
        draggable="false"
        style="clip-path: inset(0 {100 - washPercent}% 0 0)"
      />
    </div>

    <!-- Title and rarity -->
    <h2 class="painting-title" style="color: {tierVisuals.badgeColor}">
      {reveal.painting.title}
    </h2>

    <!-- Tier badge — drops in during badge phase -->
    {#if phase === 'badge' || phase === 'done'}
      <div
        class="tier-badge"
        style="background: {tierVisuals.badgeColor}; transform: translateY({badgeY}px)"
      >
        {tierVisuals.label} Achievement
      </div>
    {/if}

    <!-- GAIA comment — typewriter effect -->
    {#if gaiaIndex > 0}
      <p class="gaia-comment">
        <span class="gaia-label">G.A.I.A.:</span>
        {currentGaiaText}<span class="cursor" aria-hidden="true">▮</span>
      </p>
    {/if}

    <!-- Dismiss hint -->
    {#if phase === 'done'}
      <p class="dismiss-hint">Tap to continue</p>
    {/if}
  </div>
{/if}

<style>
  .reveal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(0, 0, 0, 0.92);
    transition: opacity 0.35s ease;
    cursor: pointer;
    padding: 24px;
    box-sizing: border-box;
  }

  .painting-frame {
    position: relative;
    width: min(320px, 80vw);
    height: min(320px, 80vw);
    border: 4px solid;
    border-radius: 4px;
    overflow: hidden;
    image-rendering: pixelated;
    transition: box-shadow 0.2s ease;
  }

  .painting-base,
  .painting-color {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .painting-color {
    transition: clip-path 0.05s linear;
  }

  .painting-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    text-align: center;
    margin: 0;
    text-shadow: 0 0 12px currentColor;
  }

  .tier-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #0a0a0a;
    padding: 6px 16px;
    border-radius: 3px;
    letter-spacing: 1px;
    transition: transform 0.05s;
  }

  .gaia-comment {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #c8f0e8;
    text-align: center;
    max-width: 480px;
    line-height: 1.8;
    margin: 0;
  }

  .gaia-label {
    color: #4ecca3;
  }

  .cursor {
    animation: blink 0.7s step-end infinite;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  .dismiss-hint {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #6a8a80;
    margin: 0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 1.0; }
  }
</style>
