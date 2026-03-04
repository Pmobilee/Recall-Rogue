<script lang="ts">
  import { onMount } from 'svelte'

  export let seasonName: string = ''
  export let tagline: string = ''
  export let bannerColor: string = '#8B4513'
  export let accentColor: string = '#D4AF37'
  export let daysRemaining: number = 0
  export let onTap: (() => void) | undefined = undefined

  let visible = false

  onMount(() => {
    if (seasonName) {
      setTimeout(() => { visible = true }, 300)
    }
  })
</script>

{#if seasonName}
  <button
    class="season-banner"
    class:visible
    style="--banner-color: {bannerColor}; --accent-color: {accentColor}"
    on:click={onTap}
  >
    <div class="banner-content">
      <span class="season-icon">&#9733;</span>
      <div class="banner-text">
        <span class="season-name">{seasonName}</span>
        <span class="season-tagline">{tagline}</span>
      </div>
      <span class="days-remaining">{daysRemaining}d</span>
    </div>
  </button>
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
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #fff;
    font-weight: bold;
  }
  .season-tagline {
    font-size: 9px;
    color: var(--accent-color);
    font-style: italic;
  }
  .days-remaining {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    color: var(--accent-color);
    font-weight: bold;
    white-space: nowrap;
  }
</style>
