<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress } from '../../services/deckProgressService';
  import { getSubDeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getDeckTags, getTagFactIds } from '../../data/deckFactIndex';

  /** Human-readable display labels for known exam tags. */
  const TAG_DISPLAY: Record<string, string> = {
    USMLE_Step1: 'USMLE Step 1',
    USMLE_Step2: 'USMLE Step 2',
    NBME_Shelf: 'NBME Shelf',
    COMLEX: 'COMLEX',
    PLAB: 'PLAB (UK)',
    AMC: 'AMC (AU)',
    MCAT: 'MCAT',
    high_yield: 'High Yield',
    clinical_correlation: 'Clinical',
    image_identification: 'Visual ID',
  };

  interface Props {
    deck: DeckRegistryEntry;
    progress: DeckProgress;
    onStartRun: (deckId: string, subDeckId?: string, examTags?: string[]) => void;
    onClose: () => void;
    onAddToCustom?: (deckId: string, subDeckId?: string) => void;
  }

  const { deck, progress, onStartRun, onClose, onAddToCustom }: Props = $props();

  const isAvailable = $derived(deck.status === 'available');
  const hasSubDecks = $derived(!!deck.subDecks && deck.subDecks.length > 0);

  let selectedSubDeck = $state<string | null>(null);
  let selectedTags = $state<Set<string>>(new Set());

  /** All exam tags present in this deck. */
  const deckTags = $derived(getDeckTags(deck.id));
  const hasExamTags = $derived(deckTags.length > 0);

  /**
   * Count of facts matching the selected tags (union).
   * When no tags selected, equals total facts (or subdeck total).
   */
  const tagFilteredCount = $derived.by(() => {
    if (selectedTags.size === 0) return deck.factCount;
    return getTagFactIds(deck.id, Array.from(selectedTags)).length;
  });

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
          <div class="mastered-count">
            {deck.procedural ? progress.totalFacts : progress.factsMastered} / {progress.totalFacts} {deck.procedural ? "skills" : "facts mastered"}
          </div>
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

              <!-- Individual sub-decks -->
              {#each deck.subDecks as subDeck (subDeck.id)}
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
                  {TAG_DISPLAY[tag] ?? tag}
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
        <!-- Key stats -->
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
        </div>
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

  /* RIGHT COLUMN — fixed, vertically centered */
  .col-right {
    flex: 1;
    min-width: calc(200px * var(--layout-scale, 1));
    max-width: calc(220px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: calc(20px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1));
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
    margin-bottom: calc(16px * var(--layout-scale, 1));
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
</style>
