<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    seasonName?: string
    tagline?: string
    bannerColor?: string
    accentColor?: string
    daysRemaining?: number
    onTap?: () => void
    onLeaderboard?: () => void
  }

  let {
    seasonName = '',
    tagline = '',
    bannerColor = '#8B4513',
    accentColor = '#D4AF37',
    daysRemaining = 0,
    onTap,
    onLeaderboard,
  }: Props = $props()

  let visible = $state(false)

  onMount(() => {
    if (seasonName) {
      setTimeout(() => { visible = true }, 300)
    }
  })
</script>

{#if seasonName}
  <div
    class="season-banner"
    class:visible
    style="--banner-color: {bannerColor}; --accent-color: {accentColor}"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="banner-content" onclick={onTap}>
      <span class="season-icon">&#9733;</span>
      <div class="banner-text">
        <span class="season-name">{seasonName}</span>
        <span class="season-tagline">{tagline}</span>
      </div>
      <div class="banner-right">
        <span class="days-remaining">{daysRemaining}d</span>
        {#if onLeaderboard}
          <button
            class="leaderboard-btn"
            type="button"
            onclick={(e: MouseEvent) => { e.stopPropagation(); onLeaderboard?.() }}
            aria-label="View leaderboard"
          >&#9776;</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .season-banner {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%) translateY(-60px);
    z-index: 100;
    background: var(--banner-color);
    border: 2px solid var(--accent-color);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: transform 0.5s ease-out, opacity 0.5s ease-out;
    opacity: 0;
    pointer-events: auto;
    width: auto;
    max-width: 90vw;
  }
  .season-banner.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  .banner-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .season-icon {
    font-size: 18px;
    color: var(--accent-color);
  }
  .banner-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .season-name {
    font-family: var(--font-rpg);
    font-size: 10px;
    color: #fff;
    font-weight: bold;
  }
  .season-tagline {
    font-size: 9px;
    color: var(--accent-color);
    font-style: italic;
  }
  .banner-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .days-remaining {
    font-family: var(--font-rpg);
    font-size: 11px;
    color: var(--accent-color);
    font-weight: bold;
    white-space: nowrap;
  }
  .leaderboard-btn {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    color: var(--accent-color);
    font-size: 12px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .leaderboard-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
