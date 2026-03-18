<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    relic: RelicDefinition
    onAccept: () => void
    onDecline: () => void
  }

  let { relic, onAccept, onDecline }: Props = $props()

  const rarityColors: Record<string, string> = {
    common: '#aaaaaa',
    uncommon: '#44cc44',
    rare: '#4488ff',
    legendary: '#ffcc00',
  }
</script>

<div class="relic-overlay" class:landscape={$isLandscape} role="dialog" aria-modal="true">
  <div class="relic-card" style="border-color: {rarityColors[relic.rarity] ?? '#aaa'}">
    <div class="tier-label" style="color: {rarityColors[relic.rarity] ?? '#aaa'}">{relic.rarity.toUpperCase()}</div>
    <div class="relic-icon">{relic.icon}</div>
    <h2 class="relic-name">{relic.name}</h2>
    <p class="relic-desc">{relic.description}</p>
    <div class="relic-effects">
      {#each relic.effects as effect}
        <div class="effect-line">{effect.description}</div>
      {/each}
    </div>
    <p class="relic-lore">"{relic.flavorText}"</p>
    <div class="relic-actions">
      <button onclick={onAccept} class="btn-accept">Equip Relic</button>
      <button onclick={onDecline} class="btn-decline">Leave It</button>
    </div>
  </div>
</div>

<style>
  .relic-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }
  .relic-card {
    background: #1a1a2e;
    border: 2px solid;
    border-radius: 8px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    text-align: center;
    color: #e0e0e0;
  }
  .tier-label { font-size: 0.75rem; letter-spacing: 0.15em; margin-bottom: 8px; text-transform: uppercase; }
  .relic-icon { font-size: 3rem; margin: 8px 0; }
  .relic-name { font-size: 1.1rem; margin: 8px 0 4px; font-family: 'Press Start 2P', monospace; }
  .relic-desc { font-size: 0.85rem; margin: 0 0 8px; }
  .relic-effects { margin: 8px 0; }
  .effect-line { font-size: 0.75rem; color: #88cc88; margin: 2px 0; }
  .relic-lore { font-size: 0.75rem; font-style: italic; color: #888; margin: 8px 0 16px; }
  .relic-actions { display: flex; gap: 12px; justify-content: center; }
  .btn-accept { background: #2a5298; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; min-height: 44px; font-family: inherit; }
  .btn-decline { background: #333; color: #ccc; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; min-height: 44px; font-family: inherit; }
  .btn-accept:hover { background: #3a62a8; }
  .btn-decline:hover { background: #444; }

  /* === Landscape layout === */
  .relic-overlay.landscape .relic-card {
    max-width: min(55vw, 640px);
    padding: 32px 40px;
  }

  .relic-overlay.landscape .relic-icon {
    font-size: 4rem;
  }

  .relic-overlay.landscape .relic-name {
    font-size: 1.3rem;
  }

  .relic-overlay.landscape .relic-desc {
    font-size: 1rem;
  }
</style>
