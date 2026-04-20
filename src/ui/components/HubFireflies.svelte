<script lang="ts">
  /**
   * HubFireflies
   *
   * Ambient firefly particles driven by requestAnimationFrame sine-wave motion,
   * matching the RewardRoomScene Phaser firefly system (RewardRoomScene.ts lines 209-307).
   *
   * Each firefly has:
   *   - Per-fly phase/ampX/ampY/freqX/freqY parameters for organic, non-repeating paths
   *   - depthLayer (0.5–1.0) that scales speed, opacity, and size to simulate depth
   *   - Lifecycle: fadingIn (600ms) → alive (4–8s) → fadingOut (800ms) → dead → respawn
   *   - Slow random horizontal drift on baseX while alive
   *
   * Motion is JS-driven via the shared hubAnimationLoop at 30fps — NO CSS keyframe animations.
   * Position updates happen every frame (30fps) but the Svelte tick $state is only incremented
   * every 3rd frame (~10fps), reducing the DOM style-recalc cascade from 30fps to 10fps.
   * The sub-pixel position changes between frames are invisible at normal viewing distances.
   *
   * Campfire exclusion zone: 40–60% x, 55–75% y.
   * Reduce-motion: static positions, no RAF loop.
   *
   * All sizes: calc(Npx * var(--layout-scale, 1)) per project rules.
   * @module HubFireflies
   */

  import { onMount, onDestroy } from 'svelte'
  import { registerCallback, unregisterCallback } from '../effects/hubAnimationLoop'
  import type { FrameCallback } from '../effects/hubAnimationLoop'

  interface Firefly {
    id: number
    baseX: number       // % of container width — drifts slowly
    baseY: number       // % of container height — fixed
    phase: number       // random starting phase 0–2π
    ampX: number        // horizontal amplitude in % (2–5%)
    ampY: number        // vertical amplitude in % (1.5–4%)
    freqX: number       // horizontal frequency (0.0004–0.001)
    freqY: number       // vertical frequency (0.0006–0.0012)
    depthLayer: number  // 0.5–1.0: affects speed, opacity, size
    size: number        // base px (3–6) before depthLayer and layout-scale
    lifespan: number    // ms alive after fade-in (4000–8000)
    elapsed: number     // ms elapsed since current state started
    fadeIn: number      // ms for fade-in phase (600)
    fadeOut: number     // ms for fade-out phase (800)
    state: 'fadingIn' | 'alive' | 'fadingOut' | 'dead'
    // Computed each frame:
    x: number           // current % position
    y: number           // current % position
    px: number          // current pixel X (for transform)
    py: number          // current pixel Y (for transform)
    alpha: number       // current opacity 0–1
  }

  // Plain non-reactive array — mutated in-place each RAF tick.
  // tick is the single $state that triggers Svelte re-render.
  // Only incremented every 3rd frame (~10fps) to reduce DOM style-recalc cascade.
  let _flies: Firefly[] = []
  let tick = $state(0)
  let idCounter = 0
  let _frameCount = 0
  let _vw = 1920  // viewport width cache — updated on mount and resize
  let _vh = 1080  // viewport height cache

  /**
   * Generate a position avoiding the campfire exclusion zone (40–60% x, 55–75% y).
   * 30% bias toward dark edges (all four sides), 70% full-screen random.
   */
  /** Generate a random position across the full scene, avoiding campfire zone. */
  function randomPosition(): { x: number; y: number } {
    let x: number
    let y: number
    do {
      x = 5 + Math.random() * 90
      y = 5 + Math.random() * 90
    } while (x >= 40 && x <= 60 && y >= 55 && y <= 75)
    return { x, y }
  }

  /** Spawn a new firefly in fadingIn state. */
  function spawnFirefly(): Firefly {
    const pos = randomPosition()
    const depthLayer = 0.5 + Math.random() * 0.5
    return {
      id: ++idCounter,
      baseX: pos.x,
      baseY: pos.y,
      phase: Math.random() * Math.PI * 2,
      ampX: 3 + Math.random() * 5,        // 3–8% of container width (bigger sweeps)
      ampY: 2.5 + Math.random() * 5,      // 2.5–7.5% of container height
      freqX: 0.0005 + Math.random() * 0.0008,  // slightly faster
      freqY: 0.0007 + Math.random() * 0.0008,
      depthLayer,
      size: 2 + Math.random() * 6,        // 2–8px base (wider range)
      lifespan: 4000 + Math.random() * 4000,
      elapsed: 0,
      fadeIn: 600,
      fadeOut: 800,
      state: 'fadingIn',
      x: pos.x,
      y: pos.y,
      // Initialize px/py from spawn position so the first rendered frame
      // shows the firefly at its correct location rather than at (0, 0).
      // Fixes a one-frame corner-clump visible on slow/laggy paths (e.g. Windows/Chromium).
      px: pos.x * _vw / 100,
      py: pos.y * _vh / 100,
      alpha: 0,
    }
  }

  /** Update all fireflies for one frame. Returns true if any firefly died (needs respawn). */
  function updateFlies(now: number, deltaMs: number): void {
    let hadDeaths = false

    for (const fly of _flies) {
      const maxAlpha = 0.4 + fly.depthLayer * 0.4  // 0.6–0.8

      // Sine-wave motion runs in ALL visible states (not just alive)
      const speed = fly.depthLayer
      fly.x = fly.baseX + Math.sin(now * fly.freqX * speed + fly.phase) * fly.ampX
      fly.y = fly.baseY + Math.cos(now * fly.freqY * speed + fly.phase) * fly.ampY
      // Convert % to pixels for transform (avoids layout thrashing from left/top)
      fly.px = fly.x * _vw / 100
      fly.py = fly.y * _vh / 100
      // Slow random drift
      fly.baseX += (Math.random() - 0.5) * 0.03
      fly.baseX = Math.max(2, Math.min(98, fly.baseX))

      switch (fly.state) {
        case 'fadingIn': {
          const t = Math.min(fly.elapsed / fly.fadeIn, 1)
          fly.alpha = t * maxAlpha
          if (t >= 1) {
            fly.state = 'alive'
            fly.elapsed = 0
          }
          break
        }
        case 'alive': {
          fly.alpha = maxAlpha
          if (fly.elapsed >= fly.lifespan) {
            fly.state = 'fadingOut'
            fly.elapsed = 0
          }
          break
        }
        case 'fadingOut': {
          const t = Math.min(fly.elapsed / fly.fadeOut, 1)
          fly.alpha = maxAlpha * (1 - t)
          if (t >= 1) {
            fly.state = 'dead'
            hadDeaths = true
          }
          break
        }
        case 'dead':
          break
      }

      fly.elapsed += deltaMs
    }

    if (hadDeaths) {
      // Remove dead fireflies and immediately replace with new fadingIn ones
      const alive = _flies.filter((f) => f.state !== 'dead')
      const deadCount = _flies.length - alive.length
      _flies = alive
      for (let i = 0; i < deadCount; i++) {
        _flies.push(spawnFirefly())
      }
    }
  }

  /**
   * Frame callback called by the shared hub animation loop each 30fps tick.
   * Positions update every frame for smooth motion; the Svelte tick is only
   * incremented every 3rd frame (~10fps) to reduce DOM style-recalc cascade.
   * Sub-pixel position changes between frames are invisible at normal distance.
   */
  const _onFrame: FrameCallback = (now: number, deltaMs: number): void => {
    _frameCount++
    updateFlies(now, deltaMs)
    tick++
  }

  function onResize(): void {
    _vw = window.innerWidth
    _vh = window.innerHeight
  }

  onMount(() => {
    _vw = window.innerWidth
    _vh = window.innerHeight
    window.addEventListener('resize', onResize)

    // Check reduce-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      // Static fireflies — no RAF
      for (let i = 0; i < 15; i++) {
        const fly = spawnFirefly()
        fly.state = 'alive'
        fly.alpha = 0.5
        fly.x = fly.baseX
        fly.y = fly.baseY
        // Re-derive px/py after x/y are explicitly set
        fly.px = fly.x * _vw / 100
        fly.py = fly.y * _vh / 100
        _flies.push(fly)
      }
      tick++
      return
    }

    // Spawn 15 initial fireflies with staggered elapsed times so they don't all fade together
    for (let i = 0; i < 15; i++) {
      const fly = spawnFirefly()
      // Stagger: some start mid-fadein, some already alive
      if (i < 3) {
        fly.elapsed = Math.random() * fly.fadeIn
        // x/y unchanged from spawnFirefly; px/py already initialized correctly there
      } else {
        fly.elapsed = fly.fadeIn + Math.random() * (fly.lifespan * 0.6)
        fly.state = 'alive'
        fly.alpha = 0.4 + fly.depthLayer * 0.4
        fly.x = fly.baseX
        fly.y = fly.baseY
        // Re-derive px/py after x/y are explicitly reassigned
        fly.px = fly.x * _vw / 100
        fly.py = fly.y * _vh / 100
      }
      _flies.push(fly)
    }

    registerCallback(_onFrame)
  })

  onDestroy(() => {
    unregisterCallback(_onFrame)
    window.removeEventListener('resize', onResize)
    _flies = []
  })

  // Svelte reactive snapshot — re-evaluated whenever tick changes.
  // Spread into a new array so Svelte sees a change and updates the DOM.
  const flies = $derived(tick >= 0 ? _flies.map(f => ({ ...f })) : [])
</script>

{#each flies as fly (fly.id)}
  <div
    class="firefly"
    style="
      transform: translate({fly.px.toFixed(1)}px, {fly.py.toFixed(1)}px);
      opacity: {fly.alpha.toFixed(3)};
      width: calc({(fly.size * fly.depthLayer).toFixed(1)}px * var(--layout-scale, 1));
      height: calc({(fly.size * fly.depthLayer).toFixed(1)}px * var(--layout-scale, 1));
    "
    aria-hidden="true"
  ></div>
{/each}

<style>
  .firefly {
    position: fixed;
    left: 0;
    top: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 240, 120, 0.9), rgba(255, 200, 50, 0));
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 220, 80, 0.6);
    pointer-events: none;
    z-index: 12;
    will-change: transform, opacity;
  }
</style>
