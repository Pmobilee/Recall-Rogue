<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { CampfireEffect } from '../effects/CampfireEffect'

  interface Props {
    streak: number
  }

  let { streak }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined
  let campfireEffect: CampfireEffect | null = null
  let resizeObserver: ResizeObserver | null = null

  /** Measure canvas clientWidth/clientHeight and sync canvas pixel dimensions + scale. */
  function syncCanvasSize(): void {
    if (!canvasEl) return
    const w = canvasEl.clientWidth
    const h = canvasEl.clientHeight
    if (w === 0 || h === 0) return
    canvasEl.width = w
    canvasEl.height = h
    const scale = w / 200 // ratio vs base size of 200px
    campfireEffect?.setScale(scale)
  }

  onMount(() => {
    if (canvasEl) {
      // Measure computed size before constructing the effect so the canvas
      // has the correct pixel buffer dimensions from the start.
      const w = canvasEl.clientWidth || 200
      const h = canvasEl.clientHeight || 250
      canvasEl.width = w
      canvasEl.height = h
      const scale = w / 200

      campfireEffect = new CampfireEffect(canvasEl, streak, scale)
      campfireEffect.start()

      // Watch for viewport/container size changes (e.g. window resize, layout scale change)
      resizeObserver = new ResizeObserver(() => {
        syncCanvasSize()
      })
      resizeObserver.observe(canvasEl)
    }
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    campfireEffect?.destroy()
  })

  // Update streak reactively
  $effect(() => {
    campfireEffect?.updateStreak(streak)
  })
</script>

<canvas
  bind:this={canvasEl}
  class="campfire-canvas"
  aria-hidden="true"
></canvas>

<style>
  .campfire-canvas {
    position: absolute;
    /* Position over the campfire sprite — z-index 26 ensures embers render ON TOP of
       the campfire sprite (z-25) so particles visually rise from the fire. */
    bottom: 33%;
    left: 50%;
    transform: translateX(-50%);
    width: calc(200px * var(--layout-scale, 1));
    height: calc(250px * var(--layout-scale, 1));
    z-index: 26;
    pointer-events: none;
  }
</style>
