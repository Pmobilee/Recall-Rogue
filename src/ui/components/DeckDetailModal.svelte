<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress } from '../../services/deckProgressService';
  import { getSubDeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getDeckTags, getTagFactIds } from '../../data/deckFactIndex';
  import DeckOptionsPanel from '../DeckOptionsPanel.svelte';
  import { getLanguageCodeForDeck } from '../../services/deckOptionsService';
  import { getLanguageConfig } from '../../types/vocabulary'
  import { getChessElo, getEloLabel } from '../../services/chessEloService';
  import { playerSave } from '../stores/playerData';
  import { formatExamTag } from '../utils/examTagDisplay';

  interface Props {
    deck: DeckRegistryEntry;
    progress: DeckProgress;
    onStartRun: (deckId: string, subDeckId?: string, examTags?: string[]) => void;
    onClose: () => void;
    onAddToCustom?: (deckId: string, subDeckId?: string) => void;
    onExportAnki?: (deckId: string, deckName: string) => void;
  }

  const { deck, progress, onStartRun, onClose, onAddToCustom, onExportAnki }: Props = $props();

  const isAvailable = $derived(deck.status === 'available');
  const hasSubDecks = $derived(!!deck.subDecks && deck.subDecks.length > 0);

  /** Sub-decks sorted alphabetically by name for consistent display order. */
  const sortedSubDecks = $derived(deck.subDecks ? [...deck.subDecks].sort((a, b) => a.name.localeCompare(b.name)) : []);

  let selectedSubDeck = $state<string | null>(null);
  let selectedTags = $state<Set<string>>(new Set());

  /** All exam tags present in this deck. */
  const deckTags = $derived(getDeckTags(deck.id));
  const hasExamTags = $derived(deckTags.length > 0);

  /** Language code for this deck, if it's a language deck. */
  const deckLanguageCode = $derived(getLanguageCodeForDeck(deck.id));
  const hasLanguageOptions = $derived(
    deckLanguageCode ? (getLanguageConfig(deckLanguageCode)?.options?.length ?? 0) > 0 : false
  );

  /** Current chess Elo rating — shown only for chess_tactics deck. */
  const chessElo = $derived(deck.id === 'chess_tactics' ? getChessElo() : null);

  /**
   * Last 30 Elo history entries for sparkline display.
   * Only populated when there are at least 2 data points.
   */
  const sparklineData = $derived.by(() => {
    if (deck.id !== 'chess_tactics') return null;
    const history = $playerSave?.chessEloHistory;
    if (!history?.length || history.length < 2) return null;
    return history.slice(-30);
  });

  /**
   * Build a polyline points string and trend color for the Elo sparkline.
   */
  function buildSparklinePath(data: Array<{ rating: number }>): { points: string; color: string } {
    if (!data.length) return { points: '', color: '#94a3b8' };
    const ratings = data.map(d => d.rating);
    const min = Math.min(...ratings) - 20;
    const max = Math.max(...ratings) + 20;
    const range = max - min || 1;
    const w = 120;
    const h = 36;
    const points = ratings.map((r, i) => {
      const x = (i / (ratings.length - 1)) * w;
      const y = h - ((r - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    const trending = ratings[ratings.length - 1] > ratings[0];
    return { points, color: trending ? '#22c55e' : '#ef4444' };
  }

  /**
   * Count of facts matching the selected tags (union).
   * When no tags selected, equals total facts (or subdeck total).
   */
  const tagFilteredCount = $derived.by(() => {
    if (selectedTags.size === 0) return deck.factCount;
    return getTagFactIds(deck.id, Array.from(selectedTags)).length;
  });

  /**
   * Number of facts that failed Zod schema validation during deck load.
   * Nonzero only when the deck has a content pipeline bug. Sourced from
   * DeckRegistryEntry.skippedFactCount (set by curatedDeckStore.ts).
   */
  const skippedFactCount = $derived(deck.skippedFactCount ?? 0);

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    selectedTags = next;
  }

  function getTagCount(tag: string): number {
    return getTagFactIds(deck.id, [tag]).length;
  }

  function handleStartRun() {
    playCardAudio('run-start');
    const tags = selectedTags.size > 0 ? Array.from(selectedTags) : undefined;
    onStartRun(deck.id, selectedSubDeck ?? undefined, tags);
  }

  function handleAddToCustom() {
    onAddToCustom?.(deck.id, selectedSubDeck ?? undefined);
  }

  function handleBackdropClick() {
    onClose();
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Deck details"
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  tabindex="-1"
>
  <!-- Modal container — stopPropagation prevents backdrop close when clicking inside -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="document"
  >
    <!-- Close button -->
    <button class="close-btn" onclick={onClose} type="button" aria-label="Close">
      ✕
    </button>

    <!-- Two-column layout -->
    <div class="columns">

      <!-- LEFT COLUMN: scrollable content -->
      <div class="col-left">
        <!-- Deck name + description -->
        <div class="deck-name">{deck.name}</div>
        <div class="deck-description">{deck.description}</div>

        <!-- Skipped-facts warning badge — shown only when skippedFactCount > 0.
             Runtime-only: indicates a content pipeline bug where some fact rows
             failed Zod schema validation. The deck still works but is smaller
             than expected. -->
        {#if skippedFactCount > 0}
          <div
            class="skipped-warning"
            role="alert"
            aria-label="{skippedFactCount} fact{skippedFactCount !== 1 ? 's' : ''} skipped due to validation errors"
            data-testid="deck-skipped-warning"
          >
            <span class="skipped-icon" aria-hidden="true">&#9888;</span>
            <span class="skipped-text">
              {skippedFactCount} fact{skippedFactCount !== 1 ? 's' : ''} skipped (malformed)
            </span>
            <div class="skipped-tooltip" role="tooltip">
              This deck had {skippedFactCount} {skippedFactCount !== 1 ? 'entries' : 'entry'} that
              failed schema validation and {skippedFactCount !== 1 ? 'are' : 'is'} not playable.
              The rest of the deck works normally.
              Check the browser console for details.
            </div>
          </div>
        {/if}

        <!-- Overall Progress Section -->
        <div class="progress-section">
          <div class="section-label">Overall Progress</div>
          <div class="progress-row">
            <div class="progress-track">
              <div
                class="progress-fill"
                style="width: {Math.min(progress.progressPercent, 100)}%;"
              ></div>
            </div>
            <span class="progress-pct">{Math.round(progress.progressPercent)}%</span>
          </div>
          {#if deck.id !== 'chess_tactics'}
          <div class="mastered-count">
            {deck.procedural ? progress.totalFacts : progress.factsMastered} / {progress.totalFacts} {deck.procedural ? "skills" : "facts mastered"}
          </div>
          {/if}

          {#if chessElo !== null}
            <div class="chess-elo-display">
              <span class="chess-elo-icon">♟</span>
              <span class="chess-elo-rating">{chessElo}</span>
              <span class="chess-elo-label">{getEloLabel(chessElo)}</span>
              {#if sparklineData}
                {@const sparkline = buildSparklinePath(sparklineData)}
                <svg class="elo-sparkline" viewBox="0 0 120 36" preserveAspectRatio="none">
                  <polyline
                    points={sparkline.points}
                    fill="none"
                    stroke={sparkline.color}
                    stroke-width="1.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </svg>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Sub-Decks Section -->
        {#if hasSubDecks && deck.subDecks}
          <div class="subdeck-section">
            <div class="section-label">Study Focus</div>
            <div class="subdeck-list">
              <!-- All sub-decks option -->
              <label class="subdeck-row">
                <input
                  type="radio"
                  name="subdeck"
                  value={null}
                  checked={selectedSubDeck === null}
                  onchange={() => (selectedSubDeck = null)}
                />
                <span class="subdeck-name">All sub-decks</span>
                <div class="mini-progress-track">
                  <div
                    class="mini-progress-fill"
                    style="width: {Math.min(progress.progressPercent, 100)}%;"
                  ></div>
                </div>
                <span class="mini-pct">{Math.round(progress.progressPercent)}%</span>
              </label>

              <!-- Individual sub-decks — sorted alphabetically by name -->
              {#each sortedSubDecks as subDeck (subDeck.id)}
                {@const subProgress = getSubDeckProgress(deck.id, subDeck.id)}
                <label class="subdeck-row">
                  <input
                    type="radio"
                    name="subdeck"
                    value={subDeck.id}
                    checked={selectedSubDeck === subDeck.id}
                    onchange={() => (selectedSubDeck = subDeck.id)}
                  />
                  <span class="subdeck-name">{subDeck.name}</span>
                  <div class="mini-progress-track">
                    <div
                      class="mini-progress-fill"
                      style="width: {Math.min(subProgress.progressPercent, 100)}%;"
                    ></div>
                  </div>
                  <span class="mini-pct">{Math.round(subProgress.progressPercent)}%</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Exam Tag Filter Section -->
        {#if hasExamTags}
          <div class="tag-section">
            <div class="section-label">Filter by Exam</div>
            <div class="tag-chips">
              {#each deckTags as tag (tag)}
                <button
                  class="tag-chip"
                  class:active={selectedTags.has(tag)}
                  onclick={() => toggleTag(tag)}
                  type="button"
                  aria-pressed={selectedTags.has(tag)}
                >
                  {formatExamTag(tag)}
                  <span class="tag-count">({getTagCount(tag)})</span>
                </button>
              {/each}
            </div>
            {#if selectedTags.size > 0}
              <div class="tag-filter-info">
                {tagFilteredCount} fact{tagFilteredCount !== 1 ? 's' : ''} match selected filter{selectedTags.size !== 1 ? 's' : ''}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- RIGHT COLUMN: stats + action buttons -->
      <div class="col-right">
        <!-- Key stats (hidden for chess_tactics — facts don't apply to procedural puzzles) -->
        {#if deck.id !== 'chess_tactics'}
        <div class="stat-block">
          <div class="stat-row">
            <span class="stat-label">Total facts</span>
            <span class="stat-value">{progress.totalFacts}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Mastered</span>
            <span class="stat-value stat-mastered">{progress.factsMastered}</span>
          </div>
        </div>
        {/if}

        <!-- Action buttons -->
        <div class="action-block">
          <button
            class="btn-start"
            onclick={handleStartRun}
            disabled={!isAvailable}
            type="button"
          >
            {isAvailable ? (deck.procedural ? '>> START PRACTICE' : '>> LAUNCH EXPEDITION') : 'COMING SOON'}
          </button>

          {#if onAddToCustom}
            <button class="btn-playlist" onclick={handleAddToCustom} type="button">
              + Add to Custom Deck
            </button>
          {/if}

          {#if onExportAnki}
            <button class="export-anki-btn" onclick={() => onExportAnki?.(deck.id, deck.name)} type="button">
              Export to Anki
            </button>
          {/if}
        </div>

        <!-- Language display options (Japanese, Chinese, Korean only) -->
        {#if hasLanguageOptions && deckLanguageCode}
          <div class="deck-options-wrapper">
            <DeckOptionsPanel languageCode={deckLanguageCode} />
          </div>
        {/if}
      </div>

    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    position: relative;
    width: calc(900px * var(--layout-scale, 1));
    max-height: 80vh;
    background: #0f1624;
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(16px * var(--layout-scale, 1));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  /* Close button — yellow, no background circle */
  .close-btn {
    position: absolute;
    top: calc(14px * var(--layout-scale, 1));
    right: calc(16px * var(--layout-scale, 1));
    z-index: 2;
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    color: #eab308;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.15s ease, transform 0.15s ease;
  }

  .close-btn:hover {
    color: #fde047;
    transform: scale(1.15);
  }

  /* Two-column layout */
  .columns {
    display: flex;
    flex-direction: row;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  /* LEFT COLUMN — scrollable */
  .col-left {
    flex: 3;
    min-width: 0;
    overflow-y: auto;
    padding: calc(24px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: 0;
    /* Subtle right separator */
    border-right: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* RIGHT COLUMN — scrollable when language options are present.
     Top padding is 44px (close button 32px height + 12px buffer) to prevent
     the stat block from sitting behind the absolute-positioned close button. */
  .col-right {
    flex: 1;
    min-width: calc(200px * var(--layout-scale, 1));
    max-width: calc(220px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: calc(20px * var(--layout-scale, 1));
    padding: calc(44px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  /* Deck header */
  .deck-name {
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    padding-right: calc(36px * var(--layout-scale, 1)); /* avoid close-btn overlap */
    line-height: 1.2;
  }

  .deck-description {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    line-height: 1.4;
    margin-top: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(10px * var(--layout-scale, 1));
  }

  /* Skipped-facts warning badge — only rendered when skippedFactCount > 0 */
  .skipped-warning {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(12px * var(--layout-scale, 1));
    cursor: default;
    /* Tooltip shows on hover — container must be non-overflow-hidden */
    overflow: visible;
  }

  .skipped-warning:hover .skipped-tooltip {
    opacity: 1;
    pointer-events: auto;
  }

  .skipped-icon {
    font-size: calc(13px * var(--text-scale, 1));
    color: #f59e0b;
    line-height: 1;
    flex-shrink: 0;
  }

  .skipped-text {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    color: #fbbf24;
    white-space: nowrap;
  }

  /* Tooltip — hidden by default, revealed on hover */
  .skipped-tooltip {
    position: absolute;
    top: calc(100% + 6px * var(--layout-scale, 1));
    left: 0;
    z-index: 10;
    width: calc(280px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: #1e293b;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
    line-height: 1.5;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  /* Progress section */
  .progress-section {
    padding: calc(14px * var(--layout-scale, 1)) 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
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
    transition: width 0.3s ease;
  }

  .progress-pct {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #4ade80;
    min-width: calc(36px * var(--layout-scale, 1));
    text-align: right;
  }

  .mastered-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #4b5563;
    margin-top: calc(6px * var(--layout-scale, 1));
  }

  /* Sub-decks section */
  .subdeck-section {
    padding: calc(14px * var(--layout-scale, 1)) 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .subdeck-list {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .subdeck-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .subdeck-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .subdeck-row input[type='radio'] {
    accent-color: #818cf8;
    flex-shrink: 0;
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
  }

  .subdeck-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-progress-track {
    width: calc(80px * var(--layout-scale, 1));
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
    flex-shrink: 0;
  }

  .mini-progress-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(2px * var(--layout-scale, 1));
    transition: width 0.3s ease;
  }

  .mini-pct {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    min-width: calc(32px * var(--layout-scale, 1));
    text-align: right;
    flex-shrink: 0;
  }

  /* Exam tag filter section */
  .tag-section {
    padding: calc(14px * var(--layout-scale, 1)) 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(6px * var(--layout-scale, 1));
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(20px * var(--layout-scale, 1));
    border: 1px solid rgba(99, 102, 241, 0.35);
    background: transparent;
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    white-space: nowrap;
    line-height: 1.4;
  }

  .tag-chip:hover {
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.6);
    color: #c7d2fe;
  }

  .tag-chip.active {
    background: rgba(99, 102, 241, 0.25);
    border-color: #818cf8;
    color: #c7d2fe;
  }

  .tag-chip.active:hover {
    background: rgba(99, 102, 241, 0.35);
  }

  .tag-count {
    opacity: 0.65;
    font-size: calc(10px * var(--text-scale, 1));
  }

  .tag-filter-info {
    font-size: calc(11px * var(--text-scale, 1));
    color: #818cf8;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  /* Right column — stat block */
  .stat-block {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(10px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 600;
  }

  .stat-value {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    text-align: right;
    white-space: nowrap;
  }

  .stat-mastered {
    color: #4ade80;
  }

  /* Right column — action buttons */
  .action-block {
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .btn-start {
    width: 100%;
    min-height: calc(44px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #16a34a, #15803d);
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    color: white;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease;
    letter-spacing: 0.5px;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .btn-start:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .btn-start:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-playlist {
    width: 100%;
    height: calc(36px * var(--layout-scale, 1));
    background: transparent;
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #818cf8;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    white-space: nowrap;
  }

  .btn-playlist:hover {
    background: rgba(99, 102, 241, 0.12);
  }

  .export-anki-btn {
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #a78bfa;
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
    height: calc(36px * var(--layout-scale, 1));
    font-weight: 600;
  }

  .export-anki-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
  }

  /* Chess Elo rating display (chess_tactics deck only) */
  .chess-elo-display {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .chess-elo-icon {
    font-size: calc(20px * var(--text-scale, 1));
  }

  .chess-elo-rating {
    font-size: calc(24px * var(--text-scale, 1));
    font-weight: 700;
    color: #ffd700;
    font-variant-numeric: tabular-nums;
  }

  .chess-elo-label {
    font-size: calc(14px * var(--text-scale, 1));
    color: var(--text-muted, #94a3b8);
  }

  .elo-sparkline {
    width: calc(100px * var(--layout-scale, 1));
    height: calc(30px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  /* Deck language options — retheme DeckOptionsPanel for modal context */
  .deck-options-wrapper {
    --color-surface: rgba(255, 255, 255, 0.03);
    --color-surface-dim: rgba(255, 255, 255, 0.06);
    --color-surface-dim-hover: rgba(255, 255, 255, 0.1);
    --color-border: rgba(255, 255, 255, 0.08);
    --color-text-primary: #e2e8f0;
    --color-text-muted: #64748b;
    --color-accent: #818cf8;
    --color-accent-hover: #a5b4fc;
  }
</style>
