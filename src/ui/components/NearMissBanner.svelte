<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import type { Rarity } from '../../data/types'

  interface Props {
    rarity: Rarity
    nearMissCount?: number | undefined
  }

  let { rarity, nearMissCount = undefined }: Props = $props()

  const nearMissKey = $derived.by((): string | null => {
    if (rarity === 'epic') return 'epic_nearLegendary'
    if (rarity === 'legendary') return 'legendary_nearMythic'
    return null
  })

  const message = $derived.by(() => {
    if (!nearMissKey) return null
    const msgs = (BALANCE.NEAR_MISS_MESSAGES as Record<string, readonly string[]>)[nearMissKey]
    if (!msgs) return null
    return msgs[Math.floor(Math.random() * msgs.length)]
  })

  let visible = $state(true)

  $effect(() => {
    if (!message) return
    const t = setTimeout(() => { visible = false }, 2500)
    return () => clearTimeout(t)
  })
</script>

{#if message && visible}
  <div class="near-miss-banner" role="status" aria-live="polite">
    <div class="near-miss-ring" aria-hidden="true"></div>
    {message}
    {#if nearMissCount !== undefined && nearMissCount >= 3}
      <div class="near-miss-subline">{nearMissCount} near-misses this dive — your luck is shifting</div>
    {/if}
  </div>
{/if}

<style>
  .near-miss-banner {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    border: 1px solid rgba(255, 215, 0, 0.5);
    color: #ffd700;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 999px;
    white-space: nowrap;
    z-index: 300;
    animation: bannerPop 0.25s ease-out, bannerFade 0.4s 2.1s ease-in forwards;
    pointer-events: none;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .near-miss-ring {
    position: absolute;
    inset: -4px;
    border: 2px solid rgba(255, 215, 0, 0.6);
    border-radius: 999px;
    animation: ringExpand 600ms ease-out 2 forwards;
    pointer-events: none;
  }

  @keyframes ringExpand {
    from { transform: scale(1);    opacity: 0.8; }
    to   { transform: scale(1.6);  opacity: 0; }
  }

  .near-miss-subline {
    font-size: 0.75rem;
    font-weight: 400;
    color: rgba(255, 215, 0, 0.75);
    white-space: nowrap;
  }

  @keyframes bannerPop {
    from { transform: translateX(-50%) scale(0.8); opacity: 0; }
    to   { transform: translateX(-50%) scale(1);   opacity: 1; }
  }

  @keyframes bannerFade {
    to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }
</style>
