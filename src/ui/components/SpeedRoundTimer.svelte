<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    /** Total seconds for this speed round. */
    totalSeconds: number
    /** Called when timer reaches zero. */
    onTimeout: () => void
    /** Called each second tick with the remaining seconds. */
    onTick?: (remaining: number) => void
  }

  const { totalSeconds, onTimeout, onTick }: Props = $props()

  let remaining = $state(0)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const fraction = $derived(remaining / totalSeconds)
  const barColor = $derived(
    remaining <= 2 ? '#ff4444'
    : remaining <= 4 ? '#ffbb33'
    : '#4ecca3'
  )

  onMount(() => {
    remaining = totalSeconds
    intervalId = setInterval(() => {
      remaining = Math.max(0, remaining - 1)
      onTick?.(remaining)
      if (remaining <= 0) {
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
        onTimeout()
      }
    }, 1000)

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
    }
  })
</script>

<div class="speed-timer" role="timer" aria-live="polite" aria-label="{remaining} seconds remaining">
  <div class="timer-bar-bg">
    <div
      class="timer-bar-fill"
      style="width: {fraction * 100}%; background: {barColor};"
    ></div>
  </div>
  <span class="timer-label" style="color: {barColor};">{remaining}s</span>
</div>

<style>
  .speed-timer {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 0;
  }

  .timer-bar-bg {
    flex: 1;
    height: 8px;
    background: #1a1a3a;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #333;
  }

  .timer-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 1s linear, background 0.3s;
  }

  .timer-label {
    font-family: var(--font-rpg);
    font-size: 10px;
    min-width: 24px;
    text-align: right;
    transition: color 0.3s;
  }
</style>
