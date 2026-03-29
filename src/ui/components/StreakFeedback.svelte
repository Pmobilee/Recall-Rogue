<script lang="ts">
  interface Props {
    streakCount: number   // Current consecutive correct count (0 = hidden)
    multiplier: number    // Current XP/grey matter multiplier (from BALANCE or QuizManager)
  }

  let { streakCount, multiplier }: Props = $props()

  const bonusPct = $derived(Math.round((multiplier - 1) * 100))

  const tier = $derived.by(() => {
    if (streakCount >= 7) return 3
    if (streakCount >= 5) return 2
    if (streakCount >= 3) return 1
    return 0
  })

  const fireEmoji = $derived.by(() => {
    if (tier === 3) return '🔥🔥🔥'
    if (tier === 2) return '🔥🔥'
    return '🔥'
  })

  const labelText = $derived.by(() => {
    if (tier === 3) return `×${streakCount} STREAK — +${bonusPct}% grey matter`
    if (tier === 2) return `×${streakCount} STREAK — +${bonusPct}% grey matter`
    return `×${streakCount} streak — +${bonusPct}% grey matter`
  })
</script>

{#if streakCount >= 3}
  <div class="streak-strip" class:tier-3={tier === 3} class:tier-2={tier === 2} role="status" aria-live="polite">
    <span class="fire">{fireEmoji}</span>
    <span class="label">{labelText}</span>
  </div>
{/if}

<style>
  .streak-strip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 160, 0, 0.5);
    border-radius: 8px;
    padding: 4px 10px;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffaa00;
    pointer-events: none;
    animation: streakPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .streak-strip.tier-2 {
    border-color: rgba(255, 120, 0, 0.6);
    color: #ff8800;
  }

  .streak-strip.tier-3 {
    border-color: rgba(255, 60, 0, 0.7);
    color: #ff5500;
    animation: streakPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both,
               streakPulse 1s ease-in-out infinite 0.25s;
  }

  .fire {
    font-size: 1rem;
    line-height: 1;
  }

  .label {
    letter-spacing: 0.5px;
    text-shadow: 0 0 8px currentColor;
  }

  @keyframes streakPop {
    from { transform: scale(0.8); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  @keyframes streakPulse {
    0%, 100% { box-shadow: 0 0 0 rgba(255, 85, 0, 0); }
    50%      { box-shadow: 0 0 12px rgba(255, 85, 0, 0.4); }
  }
</style>
