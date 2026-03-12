<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  interface Props {
    text: string
    className?: string
    startPauseMs?: number
    endPauseMs?: number
    resetPauseMs?: number
    pixelsPerSecond?: number
  }

  let {
    text,
    className = '',
    startPauseMs = 900,
    endPauseMs = 1000,
    resetPauseMs = 1200,
    pixelsPerSecond = 42,
  }: Props = $props()

  let wrapperEl = $state<HTMLDivElement | null>(null)
  let textEl = $state<HTMLSpanElement | null>(null)
  let overflowDistance = $state(0)
  let cycleToken = 0
  let reducedMotion = false
  let observer: ResizeObserver | null = null
  const timeoutHandles = new Set<number>()

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const handle = window.setTimeout(() => {
        timeoutHandles.delete(handle)
        resolve()
      }, ms)
      timeoutHandles.add(handle)
    })
  }

  function clearTimers(): void {
    for (const handle of timeoutHandles) {
      window.clearTimeout(handle)
    }
    timeoutHandles.clear()
  }

  function resetTransform(): void {
    if (!textEl) return
    textEl.style.transition = 'none'
    textEl.style.transform = 'translateX(0px)'
  }

  async function runCycle(token: number): Promise<void> {
    if (!textEl || reducedMotion || overflowDistance <= 0) {
      resetTransform()
      return
    }

    while (token === cycleToken && overflowDistance > 0) {
      await sleep(startPauseMs)
      if (token !== cycleToken || !textEl || overflowDistance <= 0) break

      const durationMs = Math.max(1200, Math.round((overflowDistance / pixelsPerSecond) * 1000))
      textEl.style.transition = `transform ${durationMs}ms linear`
      textEl.style.transform = `translateX(-${overflowDistance}px)`

      await sleep(durationMs + endPauseMs)
      if (token !== cycleToken || !textEl) break

      resetTransform()
      // Force style flush so snap-back is visible before the next cycle.
      void textEl.offsetWidth
      await sleep(resetPauseMs)
    }
  }

  function restartAnimation(): void {
    cycleToken += 1
    clearTimers()
    resetTransform()
    void runCycle(cycleToken)
  }

  function measureOverflow(): void {
    if (!wrapperEl || !textEl) return
    const nextDistance = Math.max(0, Math.ceil(textEl.scrollWidth - wrapperEl.clientWidth))
    if (nextDistance === overflowDistance) return
    overflowDistance = nextDistance
    restartAnimation()
  }

  $effect(() => {
    text
    queueMicrotask(() => {
      measureOverflow()
    })
  })

  onMount(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    observer = new ResizeObserver(() => {
      measureOverflow()
    })
    if (wrapperEl) observer.observe(wrapperEl)
    if (textEl) observer.observe(textEl)
    measureOverflow()
  })

  onDestroy(() => {
    cycleToken += 1
    clearTimers()
    observer?.disconnect()
  })
</script>

<div class={`overflow-label ${className}`.trim()} bind:this={wrapperEl}>
  <span class="overflow-label-text" bind:this={textEl}>{text}</span>
</div>

<style>
  .overflow-label {
    min-width: 0;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }

  .overflow-label-text {
    display: inline-block;
    transform: translateX(0px);
    will-change: transform;
    white-space: nowrap;
  }
</style>

