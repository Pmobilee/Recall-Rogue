<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    deck: DeckRegistryEntry;
    progress: DeckProgress;
    onclick: () => void;
  }

  const { deck, progress, onclick }: Props = $props();

  const ICON_MAP: Record<string, string> = {
    book: '&#128214;',
    globe: '&#127758;',
    star: '&#11088;',
    flag: '&#127988;',
    science: '&#128300;',
    atom: '&#9883;',
    history: '&#127979;',
    music: '&#127925;',
    math: '&#128290;',
    art: '&#127912;',
    space: '&#128640;',
    animal: '&#129409;',
    food: '&#127829;',
    body: '&#129728;',
    myth: '&#128009;',
  };

  const iconDisplay = $derived(
    deck.artPlaceholder.icon in ICON_MAP
      ? ICON_MAP[deck.artPlaceholder.icon]
      : deck.artPlaceholder.icon
  );

  const isAvailable = $derived(deck.status === 'available');
  const isNew = $derived(progress.progressPercent === 0 && progress.factsEncountered === 0);
  const isInProgress = $derived(progress.progressPercent > 0 && progress.progressPercent < 100);
  const isComplete = $derived(progress.progressPercent >= 100);
  const progressColor = $derived(isComplete ? '#eab308' : '#4ade80');
  const descriptionText = $derived(deck.description || `${deck.factCount} facts`);

  function handleClick() {
    if (!isAvailable) return;
    playCardAudio('tab-switch');
    onclick();
  }
</script>

<button
  class="deck-tile"
  class:coming-soon={!isAvailable}
  onclick={handleClick}
  disabled={!isAvailable}
  style="--gradient-from: {deck.artPlaceholder.gradientFrom}; --gradient-to: {deck.artPlaceholder.gradientTo}; --progress-color: {progressColor};"
  type="button"
>
  <!-- Art Area -->
  <div class="art-area" class:grayscale={!isAvailable}>
    <span class="deck-icon">{@html iconDisplay}</span>

    <!-- Status Badge -->
    {#if !isAvailable}
      <span class="badge badge-coming-soon">COMING SOON</span>
    {:else if isComplete}
      <span class="badge badge-complete">&#9733; COMPLETE</span>
    {:else if isInProgress}
      <span class="badge badge-continue">CONTINUE</span>
    {:else if isNew}
      <span class="badge badge-new">NEW</span>
    {/if}
  </div>

  <!-- Info Area -->
  <div class="info-area">
    <div class="deck-name">{deck.name}</div>
    <div class="deck-description">{descriptionText}</div>

    <!-- Progress Row -->
    <div class="progress-row">
      <div class="progress-track">
        <div class="progress-fill" style="width: {Math.min(progress.progressPercent, 100)}%;"></div>
      </div>
      <span class="progress-pct">{Math.round(progress.progressPercent)}%</span>
    </div>

    <div class="mastered-count">{progress.factsMastered} / {progress.totalFacts} mastered</div>
  </div>
</button>

<style>
  .deck-tile {
    width: 100%;
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #111827;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    padding: 0;
    text-align: left;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .deck-tile:hover:not(.coming-soon) {
    transform: translateY(calc(-4px * var(--layout-scale, 1)));
    box-shadow: 0 calc(8px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5);
    border-color: color-mix(in srgb, var(--gradient-from) 40%, transparent);
  }

  .deck-tile.coming-soon {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .art-area {
    aspect-ratio: 16 / 9;
    background: linear-gradient(160deg, var(--gradient-from), var(--gradient-to));
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .art-area.grayscale {
    filter: grayscale(1);
  }

  .deck-icon {
    font-size: calc(56px * var(--text-scale, 1));
    filter: drop-shadow(0 calc(2px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5));
    line-height: 1;
    user-select: none;
  }

  .badge {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    letter-spacing: 0.05em;
  }

  .badge-new {
    background: rgba(99, 102, 241, 0.85);
    color: white;
  }

  .badge-continue {
    background: rgba(245, 158, 11, 0.85);
    color: white;
  }

  .badge-complete {
    background: rgba(234, 179, 8, 0.9);
    color: #1a1a2e;
  }

  .badge-coming-soon {
    background: rgba(0, 0, 0, 0.6);
    color: #94a3b8;
  }

  .info-area {
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .deck-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deck-description {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .progress-track {
    flex: 1;
    height: calc(5px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(3px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--progress-color);
    border-radius: calc(3px * var(--layout-scale, 1));
    transition: width 0.3s ease;
  }

  .progress-pct {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    color: var(--progress-color);
    min-width: calc(32px * var(--layout-scale, 1));
    text-align: right;
  }

  .mastered-count {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
  }
</style>
