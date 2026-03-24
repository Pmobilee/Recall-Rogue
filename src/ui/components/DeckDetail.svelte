<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress, SubDeckProgress } from '../../services/deckProgressService';
  import { getSubDeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    /** The deck being detailed. */
    deck: DeckRegistryEntry;
    /** Overall progress for this deck. */
    progress: DeckProgress;
    /** Currently selected sub-deck ID. null = all sub-decks. */
    selectedSubDeck: string | null;
    /** Called when the user selects a different sub-deck. */
    onSubDeckSelect: (subDeckId: string | null) => void;
    /** Called when the user clicks "Start Study Run". */
    onStartRun: () => void;
    /** Called when the user closes the detail panel. */
    onClose: () => void;
    /** Optional: called when the user adds this deck/sub-deck to the custom playlist. */
    onAddToCustom?: (deckId: string, subDeckId?: string) => void;
  }

  let { deck, progress, selectedSubDeck, onSubDeckSelect, onStartRun, onClose, onAddToCustom }: Props = $props();

  /** Progress bar width for overall deck. */
  const overallBarWidth = $derived(`${Math.min(100, Math.max(0, progress.progressPercent))}%`);

  /** Sub-deck progress entries. */
  const subDeckProgresses = $derived(
    (deck.subDecks ?? []).map((sd) => ({
      subDeck: sd,
      progress: getSubDeckProgress(deck.id, sd.id),
    })),
  );

  /** Handle sub-deck selection. */
  function pickSubDeck(id: string | null): void {
    playCardAudio('toggle-on');
    onSubDeckSelect(id);
  }

  /** Start the run. */
  function handleStart(): void {
    playCardAudio('run-start');
    onStartRun();
  }

  /** Add to custom playlist. */
  function handleAddToCustom(): void {
    playCardAudio('toggle-on');
    onAddToCustom?.(deck.id, selectedSubDeck ?? undefined);
  }
</script>

<div class="deck-detail">
  <!-- Header -->
  <div class="detail-header">
    <button class="close-btn" onclick={onClose} aria-label="Close detail panel">✕</button>
    <div class="art-strip" style="background: linear-gradient(135deg, {deck.artPlaceholder.gradientFrom}, {deck.artPlaceholder.gradientTo})">
      <span class="art-icon">{deck.artPlaceholder.icon}</span>
    </div>
    <div class="header-text">
      <h2 class="deck-title">{deck.name}</h2>
      <p class="deck-desc">{deck.description}</p>
    </div>
  </div>

  <!-- Overall progress -->
  <div class="section">
    <div class="section-label">Overall Progress</div>
    <div class="progress-row">
      <div class="progress-track">
        <div class="progress-fill" style="width: {overallBarWidth}"></div>
      </div>
      <span class="progress-pct">{progress.progressPercent}%</span>
    </div>
    <div class="progress-detail">
      {progress.factsMastered} / {progress.totalFacts} facts mastered
    </div>
  </div>

  <!-- Sub-decks -->
  {#if deck.subDecks && deck.subDecks.length > 0}
    <div class="section sub-section">
      <div class="section-label">Study Focus</div>

      <!-- "All" option -->
      <label class="sub-row">
        <input
          type="radio"
          name="subdeck"
          checked={selectedSubDeck === null}
          onchange={() => pickSubDeck(null)}
        />
        <span class="sub-name">All sub-decks</span>
        <div class="sub-bar-wrap">
          <div class="sub-bar-track">
            <div class="sub-bar-fill" style="width: {overallBarWidth}"></div>
          </div>
          <span class="sub-pct">{progress.progressPercent}%</span>
        </div>
      </label>

      {#each subDeckProgresses as { subDeck, progress: sp } (subDeck.id)}
        {@const spWidth = `${Math.min(100, Math.max(0, sp.progressPercent))}%`}
        <label class="sub-row">
          <input
            type="radio"
            name="subdeck"
            checked={selectedSubDeck === subDeck.id}
            onchange={() => pickSubDeck(subDeck.id)}
          />
          <span class="sub-name">{subDeck.name}</span>
          <div class="sub-bar-wrap">
            <div class="sub-bar-track">
              <div class="sub-bar-fill" style="width: {spWidth}"></div>
            </div>
            <span class="sub-pct">{sp.progressPercent}%</span>
          </div>
        </label>
      {/each}
    </div>
  {/if}

  <!-- Start button -->
  <div class="detail-footer">
    <button class="start-btn" onclick={handleStart} disabled={deck.status !== 'available'}>
      Start Study Run
    </button>
    {#if onAddToCustom}
      <button
        class="add-custom-btn"
        onclick={handleAddToCustom}
        disabled={deck.status !== 'available'}
        aria-label="Add {deck.name} to custom playlist"
      >
        Add to Custom ➕
      </button>
    {/if}
  </div>
</div>

<style>
  .deck-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0f1624;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    overflow-y: auto;
  }

  .detail-header {
    position: relative;
    flex-shrink: 0;
  }

  .close-btn {
    position: absolute;
    top: calc(10px * var(--layout-scale, 1));
    right: calc(10px * var(--layout-scale, 1));
    z-index: 2;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #cbd5e1;
    border-radius: 50%;
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .art-strip {
    height: calc(100px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .art-icon {
    font-size: calc(40px * var(--text-scale, 1));
    filter: drop-shadow(0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5));
  }

  .header-text {
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .deck-title {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 calc(4px * var(--layout-scale, 1));
  }

  .deck-desc {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    margin: 0;
    line-height: 1.4;
  }

  .section {
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .sub-section {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .section-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .progress-track {
    flex: 1;
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(3px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(3px * var(--layout-scale, 1));
    transition: width 0.3s;
  }

  .progress-pct {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #4ade80;
    min-width: calc(34px * var(--layout-scale, 1));
    text-align: right;
    flex-shrink: 0;
  }

  .progress-detail {
    font-size: calc(11px * var(--text-scale, 1));
    color: #4b5563;
  }

  .sub-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    cursor: pointer;
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: background 0.1s;
  }

  .sub-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .sub-row input[type='radio'] {
    accent-color: #6366f1;
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
  }

  .sub-name {
    flex: 1;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-bar-wrap {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    width: calc(90px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .sub-bar-track {
    flex: 1;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .sub-bar-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .sub-pct {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    min-width: calc(26px * var(--layout-scale, 1));
    text-align: right;
    flex-shrink: 0;
  }

  .detail-footer {
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .start-btn {
    width: 100%;
    height: calc(48px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #16a34a, #15803d);
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }

  .start-btn:hover:not(:disabled) {
    transform: scale(1.01);
  }

  .start-btn:disabled {
    background: #1f2937;
    color: #374151;
    cursor: not-allowed;
  }

  .add-custom-btn {
    width: 100%;
    height: calc(36px * var(--layout-scale, 1));
    margin-top: calc(8px * var(--layout-scale, 1));
    background: transparent;
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #818cf8;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .add-custom-btn:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.12);
    border-color: #6366f1;
    color: #c7d2fe;
  }

  .add-custom-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
