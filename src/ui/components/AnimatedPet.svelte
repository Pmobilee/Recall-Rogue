<script lang="ts">
  /**
   * AnimatedPet
   *
   * Canvas-based animated hub pet driven by the petBehavior state machine and
   * shared hubAnimationLoop. Renders a per-behavior spritesheet strip with
   * horizontal flip support for left-facing travel.
   *
   * Position is driven by `petState.position` (percentage coords inside
   * `.hub-center`). The sprite is anchored at its bottom-center (feet on ground).
   *
   * Spritesheet assets live at `/assets/camp/pets/{species}/{behavior}.png`.
   * Missing files degrade gracefully — idle-only fallback when load fails.
   *
   * Reduce-motion: static frame 0 at below_campfire position, no animation loop.
   *
   * All CSS sizes use `calc(Npx * var(--layout-scale, 1))` per project rules.
   * @module AnimatedPet
   */

  import { onMount, onDestroy } from 'svelte'
  import type { PetSpecies, PetBehavior } from '../../data/petAnimations'
  import { getPetConfig } from '../../data/petAnimations'
  import { HUB_WAYPOINTS } from '../../data/petWaypoints'
  import {
    createInitialPetState,
    tickPet,
    triggerReact,
  } from '../effects/petBehavior'
  import type { PetState } from '../effects/petBehavior'
  import {
    registerCallback,
    unregisterCallback,
  } from '../effects/hubAnimationLoop'
  import type { FrameCallback } from '../effects/hubAnimationLoop'
  import { drawSpritesheetFrame, loadImage } from '../effects/spritesheetPlayer'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  interface Props {
    /** Which pet species to render (defaults to 'cat'). */
    species?: PetSpecies
    /** When true, ambient effects are disabled (reduce motion). */
    disableEffects?: boolean
    /** Called when the player clicks/taps the pet. */
    onclick?: () => void
  }

  let {
    species = 'cat',
    disableEffects = false,
    onclick,
  }: Props = $props()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let petState = $state<PetState>(createInitialPetState('below_campfire'))
  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined)

  /** Spritesheet images keyed by PetBehavior — loaded on mount. */
  const spritesheets = $state<Partial<Record<PetBehavior, HTMLImageElement>>>({})

  /** True while images are still loading — renders nothing until ready. */
  let imagesReady = $state(false)

  // Static position used in reduce-motion mode: below_campfire waypoint
  const belowCampfireWp = HUB_WAYPOINTS['below_campfire']

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  /** Current position as CSS percentage strings. */
  let posX = $derived(petState.position.x)
  let posY = $derived(petState.position.y)

  // ---------------------------------------------------------------------------
  // Reduce-motion detection
  // ---------------------------------------------------------------------------

  let prefersReducedMotion = $state(false)

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  const BEHAVIORS: PetBehavior[] = ['idle', 'walk', 'sit', 'lick', 'sleep', 'react']

  async function loadSpritesheets(): Promise<void> {
    const config = getPetConfig(species)
    const loads = BEHAVIORS.map(async (beh) => {
      const src = `${config.assetPath}${beh}.png`
      try {
        const img = await loadImage(src)
        spritesheets[beh] = img
      } catch {
        // Missing art is expected during development — silently skip
      }
    })
    await Promise.allSettled(loads)
    imagesReady = true
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  function renderFrame(now: number, deltaMs: number): void {
    if (!canvasEl) return

    const config = getPetConfig(species)
    const animConfig = config.animations[petState.behavior]
    const img = spritesheets[petState.behavior] ?? spritesheets['idle']

    // Advance state machine
    petState = tickPet(petState, deltaMs, animConfig)

    // Clear canvas
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, config.animations['idle'].frameWidth, config.animations['idle'].frameHeight)

    if (!img) return

    // Walk bob: subtle vertical sine offset during walk
    let yOffsetPx = 0
    if (petState.behavior === 'walk') {
      yOffsetPx = Math.sin(now * 0.006) * 2
    }

    const fw = animConfig.frameWidth
    const fh = animConfig.frameHeight

    drawSpritesheetFrame(
      ctx,
      img,
      petState.frame,
      fw,
      fh,
      0,
      yOffsetPx,
      fw,
      fh - yOffsetPx,
      petState.facingLeft,
    )
  }

  const _frameCallback: FrameCallback = renderFrame

  // ---------------------------------------------------------------------------
  // Click handler
  // ---------------------------------------------------------------------------

  function handleClick(): void {
    petState = triggerReact(petState)
    onclick?.()
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onMount(() => {
    // Detect prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion = mq.matches

    void loadSpritesheets()

    if (!disableEffects && !prefersReducedMotion) {
      registerCallback(_frameCallback)
    } else {
      // Static mode: render frame 0 once after images load
      imagesReady = true
    }
  })

  onDestroy(() => {
    if (!disableEffects && !prefersReducedMotion) {
      unregisterCallback(_frameCallback)
    }
  })

  // Re-render a single static frame when in reduce-motion mode and images become ready
  $effect(() => {
    if ((disableEffects || prefersReducedMotion) && imagesReady && canvasEl) {
      const config = getPetConfig(species)
      const ctx = canvasEl.getContext('2d')
      if (!ctx) return
      const fw = config.animations['idle'].frameWidth
      const fh = config.animations['idle'].frameHeight
      ctx.clearRect(0, 0, fw, fh)
      const img = spritesheets['idle']
      if (img) {
        drawSpritesheetFrame(ctx, img, 0, fw, fh, 0, 0, fw, fh, false)
      }
    }
  })

  // Derive canvas dimensions from species config
  let canvasWidth = $derived(getPetConfig(species).animations['idle'].frameWidth)
  let canvasHeight = $derived(getPetConfig(species).animations['idle'].frameHeight)

  // Position: in reduce-motion mode, pin to below_campfire; otherwise follow state
  let displayX = $derived(
    disableEffects || prefersReducedMotion ? belowCampfireWp.x : posX
  )
  let displayY = $derived(
    disableEffects || prefersReducedMotion ? belowCampfireWp.y : posY
  )
</script>

{#if imagesReady}
  <div
    class="animated-pet"
    style:left="{displayX}%"
    style:top="{displayY}%"
    aria-hidden="false"
  >
    <canvas
      bind:this={canvasEl}
      width={canvasWidth}
      height={canvasHeight}
      class="pet-canvas"
      aria-hidden="true"
    ></canvas>
    <button
      type="button"
      class="pet-hitbox"
      onclick={handleClick}
      aria-label="Pet"
    ></button>
  </div>
{/if}

<style>
  .animated-pet {
    position: absolute;
    transform: translate(-50%, -100%);
    pointer-events: none;
    z-index: 35;
  }

  .pet-canvas {
    display: block;
    width: calc(96px * var(--layout-scale, 1));
    height: calc(96px * var(--layout-scale, 1));
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    pointer-events: none;
    /* Subtle dark pixel outline around the sprite silhouette */
    filter: drop-shadow(0.5px 0 0 rgba(20, 15, 10, 0.35))
            drop-shadow(-0.5px 0 0 rgba(20, 15, 10, 0.35))
            drop-shadow(0 0.5px 0 rgba(20, 15, 10, 0.35))
            drop-shadow(0 -0.5px 0 rgba(20, 15, 10, 0.35));
  }

  .pet-hitbox {
    position: absolute;
    inset: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    -webkit-tap-highlight-color: transparent;
  }
</style>
