<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { HubGlowEffect } from '../effects/HubGlowEffect'

  interface Props {
    /** Returns the campfire's absolute center position in viewport pixels. */
    campfireCenterFn: () => { x: number; y: number }
    /** z-index for the glow canvas. Default 1. Vignette canvas gets zIndex + 1. */
    zIndex?: number
    /** Mouse X in viewport pixels (clientX). When defined, adds a secondary warm light at cursor. */
    mouseX?: number
    /** Mouse Y in viewport pixels (clientY). When defined, adds a secondary warm light at cursor. */
    mouseY?: number
  }

  let { campfireCenterFn, zIndex = 1, mouseX, mouseY }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined
  let vignetteCanvasEl: HTMLCanvasElement | undefined
  let glowEffect: HubGlowEffect | null = null
  let resizeObserver: ResizeObserver | null = null

  /**
   * Backing-store scale factor.
   *
   * Both canvases are sized at 0.5× the viewport dimensions while the CSS
   * keeps them stretched to full viewport via `position: fixed; inset: 0`.
   * Radial gradients upscale imperceptibly — this halves the texture-upload
   * cost per frame (~8 MB → ~2 MB per canvas on a 1920×1080 viewport) and
   * eliminates the Chromium/Windows compositor bottleneck caused by
   * full-viewport mix-blend-mode: screen at full resolution.
   */
  const BACKING_SCALE = 0.5

  /** Sync canvas pixel dimensions to the backing-store resolution (0.5× viewport). */
  function syncSize(): void {
    if (!canvasEl || !vignetteCanvasEl) return
    canvasEl.width = Math.round(window.innerWidth * BACKING_SCALE)
    canvasEl.height = Math.round(window.innerHeight * BACKING_SCALE)
    vignetteCanvasEl.width = Math.round(window.innerWidth * BACKING_SCALE)
    vignetteCanvasEl.height = Math.round(window.innerHeight * BACKING_SCALE)
  }

  // Forward mouse position to the glow effect for secondary light pass
  $effect(() => {
    if (mouseX !== undefined && mouseY !== undefined) {
      glowEffect?.setMousePosition(mouseX, mouseY)
    } else {
      glowEffect?.clearMousePosition()
    }
  })

  onMount(() => {
    if (!canvasEl || !vignetteCanvasEl) return

    syncSize()

    glowEffect = new HubGlowEffect(canvasEl, vignetteCanvasEl, campfireCenterFn)
    glowEffect.start()

    resizeObserver = new ResizeObserver(() => {
      syncSize()
    })
    resizeObserver.observe(canvasEl)
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    glowEffect?.destroy()
    glowEffect = null
  })
</script>

<!-- Layer 1: Warm glow canvas (mix-blend-mode: screen) — additive orange radial glow.
     Canvas pixel size is 0.5× viewport; CSS inset: 0 stretches it to full viewport.
     Smooth radial gradients are imperceptible at 2× upscale — halves texture-upload cost. -->
<canvas
  bind:this={canvasEl}
  class="hub-glow-canvas"
  style="z-index: {zIndex};"
  aria-hidden="true"
></canvas>

<!-- Layer 2: Vignette canvas (mix-blend-mode: normal) — darkens edges toward cave black.
     Screen blend on the canvas above cannot darken anything (dark = transparent in screen
     mode). This separate canvas uses normal compositing so it genuinely darkens the edges.
     The radial-gradient is drawn by HubGlowEffect onto this canvas each frame, pulsing with
     fire intensity: bright fire expands the lit area, dim fire tightens the darkness. -->
<canvas
  bind:this={vignetteCanvasEl}
  class="hub-vignette-canvas"
  style="z-index: {zIndex + 1};"
  aria-hidden="true"
></canvas>

<style>
  .hub-glow-canvas {
    position: fixed;
    inset: 0;
    pointer-events: none;
    /* mix-blend-mode: screen makes the warm glow additive — adds light without
       washing out bright areas. Dark colors become transparent in screen mode,
       which is WHY we use a separate canvas for the vignette darkening. */
    mix-blend-mode: screen;
  }

  .hub-vignette-canvas {
    position: fixed;
    inset: 0;
    pointer-events: none;
    /* Normal blend mode — can actually darken edges unlike the screen canvas above */
    mix-blend-mode: normal;
  }
</style>
