<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'

  interface Props {
    options: RelicDefinition[]
    onselect: (relic: RelicDefinition) => void
  }

  let { options, onselect }: Props = $props()

  let selectedId = $state<string | null>(null)

  const rarityColors: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    legendary: '#f59e0b',
  }

  function handleSelect(relic: RelicDefinition): void {
    if (selectedId === relic.id) {
      // Second tap confirms
      onselect(relic)
    } else {
      selectedId = relic.id
    }
  }
</script>

<div class="relic-reward-overlay" role="dialog" aria-modal="true" aria-label="Choose a relic">
  <div class="relic-reward-content">
    <h2 class="relic-reward-title">Choose a Relic</h2>

    <div class="relic-options">
      {#each options as relic (relic.id)}
        {@const color = rarityColors[relic.rarity] ?? '#9ca3af'}
        {@const isSelected = selectedId === relic.id}
        <button
          class="relic-option-card"
          class:selected={isSelected}
          style="border-color: {color}"
          onclick={() => handleSelect(relic)}
          aria-pressed={isSelected}
        >
          <div class="relic-icon">{relic.icon}</div>
          <div class="relic-info">
            <div class="relic-name">{relic.name}</div>
            <div class="relic-badges">
              <span class="rarity-pill" style="background: {color}">{relic.rarity}</span>
              <span class="category-pill">{relic.category}</span>
            </div>
            <p class="relic-desc">{relic.description}</p>
            {#if relic.flavorText}
              <p class="relic-flavor">"{relic.flavorText}"</p>
            {/if}
            {#if relic.curseDescription}
              <p class="relic-curse">{relic.curseDescription}</p>
            {/if}
          </div>
          {#if isSelected}
            <div class="confirm-hint">Tap again to confirm</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .relic-reward-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(180deg, #0b1120 0%, #111827 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    animation: overlayFadeIn 0.4s ease-out;
  }

  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .relic-reward-content {
    width: 90%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
    max-height: 100vh;
    overflow-y: auto;
  }

  .relic-reward-title {
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(14px * var(--text-scale, 1));
    color: #ffd700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
    margin: 0;
    text-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
  }

  .relic-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .relic-option-card {
    position: relative;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    background: rgba(22, 33, 62, 0.95);
    border: 2px solid;
    border-radius: 14px;
    padding: 16px;
    min-height: 120px;
    color: var(--color-text, #eee);
    text-align: left;
    cursor: pointer;
    font-family: 'Courier New', monospace;
    width: 100%;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    animation: cardSlideUp 0.4s ease-out both;

    /* Reset button defaults */
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .relic-option-card:nth-child(1) { animation-delay: 0.05s; }
  .relic-option-card:nth-child(2) { animation-delay: 0.15s; }
  .relic-option-card:nth-child(3) { animation-delay: 0.25s; }

  @keyframes cardSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .relic-option-card:active {
    transform: scale(0.97);
  }

  .relic-option-card.selected {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.25);
    background: rgba(30, 45, 80, 0.95);
  }

  .relic-icon {
    font-size: calc(32px * var(--text-scale, 1));
    flex: 0 0 auto;
    line-height: 1;
    padding-top: 2px;
  }

  .relic-info {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .relic-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
  }

  .relic-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .rarity-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000;
    line-height: 1.4;
  }

  .category-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: calc(10px * var(--text-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(255, 255, 255, 0.1);
    color: #9ca3af;
    line-height: 1.4;
  }

  .relic-desc {
    font-size: calc(12px * var(--text-scale, 1));
    color: #d1d5db;
    line-height: 1.4;
    margin: 0;
  }

  .relic-flavor {
    font-size: calc(11px * var(--text-scale, 1));
    color: #6b7280;
    font-style: italic;
    line-height: 1.3;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .relic-curse {
    font-size: calc(11px * var(--text-scale, 1));
    color: #ef4444;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
  }

  .confirm-hint {
    position: absolute;
    bottom: 6px;
    right: 12px;
    font-size: calc(10px * var(--text-scale, 1));
    color: #ffd700;
    animation: hintPulse 1.2s ease-in-out infinite;
  }

  @keyframes hintPulse {
    0%, 100% { opacity: 0.7; }
    50%      { opacity: 1; }
  }
</style>
