<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    /** Deck metadata from the registry. */
    deck: DeckRegistryEntry;
    /** Computed progress for this deck. */
    progress: DeckProgress;
    /** Called when the tile is clicked (only for available decks). */
    onclick: () => void;
  }

  let { deck, progress, onclick }: Props = $props();

  /** Handle click with audio feedback. */
  function handleClick(): void {
    playCardAudio('tab-switch');
    onclick();
  }

  const isAvailable = $derived(deck.status === 'available');

  /** Gradient style string built from art placeholder config. */
  const gradientStyle = $derived(
    `background: linear-gradient(160deg, ${deck.artPlaceholder.gradientFrom}, ${deck.artPlaceholder.gradientTo})`,
  );

  /** Progress bar width as a CSS string. */
  const barWidth = $derived(`${Math.min(100, Math.max(0, progress.progressPercent))}%`);
</script>

<button
  class="deck-tile"
  class:available={isAvailable}
  class:coming-soon={!isAvailable}
  onclick={isAvailable ? handleClick : undefined}
  disabled={!isAvailable}
  aria-label="{deck.name}{!isAvailable ? ' (Coming Soon)' : ''}"
>
  <!-- Art area -->
  <div class="art-area" style={gradientStyle}>
    <span class="art-icon" aria-hidden="true">{deck.artPlaceholder.icon}</span>
    {#if !isAvailable}
      <div class="coming-soon-badge">Coming Soon</div>
    {/if}
  </div>

  <!-- Info area -->
  <div class="info-area">
    <p class="deck-name" title={deck.name}>{deck.name}</p>
    <p class="fact-count">{deck.factCount.toLocaleString()} facts</p>

    <!-- Progress bar -->
    <div class="progress-row">
      <div class="progress-track">
        <div class="progress-fill" style="width: {barWidth}"></div>
      </div>
      <span class="progress-pct">{progress.progressPercent}%</span>
    </div>
  </div>
</button>

<style>
  .deck-tile {
    display: flex;
    flex-direction: column;
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #16213e;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    text-align: left;
    padding: 0;
    width: 100%;
  }

  .deck-tile.available:hover {
    transform: scale(1.02);
    box-shadow: 0 calc(6px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5);
  }

  .deck-tile.coming-soon {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .art-area {
    position: relative;
    aspect-ratio: 3 / 2;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .art-icon {
    font-size: calc(48px * var(--text-scale, 1));
    line-height: 1;
    filter: drop-shadow(0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5));
  }

  .coming-soon-badge {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.6);
    color: #94a3b8;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: calc(3px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .info-area {
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .deck-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fact-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    margin: 0;
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .progress-track {
    flex: 1;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(2px * var(--layout-scale, 1));
    transition: width 0.3s;
  }

  .progress-pct {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4ade80;
    font-weight: 600;
    flex-shrink: 0;
    min-width: calc(28px * var(--layout-scale, 1));
    text-align: right;
  }
</style>
