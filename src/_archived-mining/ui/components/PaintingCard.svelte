<script lang="ts">
  import type { Painting } from '../../data/paintings'
  import { TIER_VISUALS } from '../../data/achievementTiers'

  let { painting, onclick }: {
    painting: Painting & { unlocked: boolean }
    onclick: () => void
  } = $props()

  const visuals = $derived(TIER_VISUALS[painting.tier])
</script>

<button
  class="painting-card"
  class:locked={!painting.unlocked}
  style="border-color: {painting.unlocked ? visuals.borderColor : '#333'}"
  onclick={onclick}
  aria-label="{painting.unlocked ? painting.title : 'Locked painting'}"
>
  <img
    class="card-img"
    src="/assets/sprites/dome/{painting.unlocked ? painting.spriteKey : painting.silhouetteKey}.png"
    alt={painting.unlocked ? painting.title : 'locked'}
    draggable="false"
  />
  {#if painting.unlocked}
    <span class="card-label" style="color: {visuals.badgeColor}">{painting.title}</span>
  {:else}
    <span class="card-label locked-label">???</span>
  {/if}
</button>

<style>
  .painting-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: #14142a;
    border: 2px solid;
    border-radius: 4px;
    padding: 8px;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
    font-family: 'Press Start 2P', monospace;
  }

  .painting-card:active { transform: scale(0.96); }

  .painting-card:not(.locked):hover {
    box-shadow: 0 0 12px rgba(255, 232, 160, 0.25);
  }

  .card-img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .locked .card-img { filter: grayscale(1) brightness(0.5); }

  .card-label {
    font-size: 7px;
    text-align: center;
    line-height: 1.4;
    word-break: break-word;
    max-width: 80px;
  }

  .locked-label { color: #444; }
</style>
