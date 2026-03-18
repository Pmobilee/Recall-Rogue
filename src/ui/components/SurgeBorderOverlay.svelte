<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    /** Whether Surge is currently active — shows/hides the overlay. */
    active?: boolean
  }

  let { active = false }: Props = $props()

  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined)
  let rafId: number | undefined
  let ctx: CanvasRenderingContext2D | null = null

  // Particle colors: alternate Gilded and Amber per spec §6
  const COLORS = ['#FFCA28', '#FFA726'] as const

  interface Particle {
    /** Position around perimeter (0–1, clockwise). */
    t: number
    speed: number
    opacity: number
    size: number
    colorIndex: number
    /** Slight opacity oscillation offset */
    opacityPhase: number
  }

  const PARTICLE_COUNT = 24

  function makeParticle(i: number): Particle {
    return {
      t: i / PARTICLE_COUNT,
      speed: 0.055 + Math.random() * 0.030, // full perimeter in ~8-12 s at 60fps
      opacity: 0.5 + Math.random() * 0.4,
      size: 2 + Math.random() * 2,
      colorIndex: i % 2,
      opacityPhase: Math.random() * Math.PI * 2,
    }
  }

  let particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => makeParticle(i))

  /**
   * Map perimeter fraction t ∈ [0,1) to canvas {x, y} coordinates.
   * Clockwise: top(0..0.25) → right(0.25..0.5) → bottom(0.5..0.75) → left(0.75..1.0)
   */
  function perimeterToXY(t: number, w: number, h: number): { x: number; y: number } {
    if (t < 0.25) {
      // top edge: left → right
      return { x: (t / 0.25) * w, y: 0 }
    } else if (t < 0.5) {
      // right edge: top → bottom
      return { x: w, y: ((t - 0.25) / 0.25) * h }
    } else if (t < 0.75) {
      // bottom edge: right → left
      return { x: w - ((t - 0.5) / 0.25) * w, y: h }
    } else {
      // left edge: bottom → top
      return { x: 0, y: h - ((t - 0.75) / 0.25) * h }
    }
  }

  let frameCount = 0

  function loop(): void {
    if (!ctx || !canvasEl) return
    const w = canvasEl.width
    const h = canvasEl.height

    ctx.clearRect(0, 0, w, h)

    // Draw golden border glow (2-3px)
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 202, 40, 0.35)'
    ctx.lineWidth = 3
    ctx.shadowColor = '#FFCA28'
    ctx.shadowBlur = 6
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3)
    ctx.restore()

    frameCount++
    const dt = 1 / 60

    for (const p of particles) {
      // Advance position
      p.t = (p.t + p.speed * dt) % 1

      const { x, y } = perimeterToXY(p.t, w, h)

      // Pulse opacity gently
      const pulseOpacity = p.opacity + Math.sin(frameCount * 0.04 + p.opacityPhase) * 0.12
      const clampedOpacity = Math.max(0.3, Math.min(0.92, pulseOpacity))

      ctx.save()
      ctx.globalAlpha = clampedOpacity
      ctx.fillStyle = COLORS[p.colorIndex]
      ctx.shadowColor = COLORS[p.colorIndex]
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(x, y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    rafId = requestAnimationFrame(loop)
  }

  function resizeCanvas(): void {
    if (!canvasEl) return
    canvasEl.width = window.innerWidth
    canvasEl.height = window.innerHeight
  }

  $effect(() => {
    if (active && canvasEl) {
      ctx = canvasEl.getContext('2d')
      resizeCanvas()
      loop()
    } else {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
        rafId = undefined
      }
    }
    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
        rafId = undefined
      }
    }
  })

  onMount(() => {
    window.addEventListener('resize', resizeCanvas)
  })

  onDestroy(() => {
    window.removeEventListener('resize', resizeCanvas)
    if (rafId !== undefined) cancelAnimationFrame(rafId)
  })
</script>

{#if active}
  <div class="surge-border-overlay" transition:fade={{ duration: 300 }}>
    <canvas class="surge-canvas" bind:this={canvasEl}></canvas>
  </div>
{/if}

<style>
  .surge-border-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    will-change: opacity;
  }

  .surge-canvas {
    display: block;
    width: 100%;
    height: 100%;
    will-change: transform;
  }
</style>
