<script lang="ts">
  import type { CustomDeck } from '../../data/studyPreset';
  import { getCuratedDeckFacts } from '../../data/curatedDeckStore';
  import { getAllDecks, getDeckById } from '../../data/deckRegistry';
  import { getDeckProgress, getSubDeckProgress } from '../../services/deckProgressService';
  import { getDeckTags, getTagFactIds } from '../../data/deckFactIndex';
  import { untrack } from 'svelte';

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
    /** The custom deck to display and edit. */
    customDeck: CustomDeck;
    /** Called to close the modal. */
    onClose: () => void;
    /** Called when the user removes an item by index. */
    onRemoveItem: (itemIndex: number) => void;
    /** Called when the user deletes the entire custom deck. */
    onDeleteDeck: () => void;
    /** Called when the user renames the custom deck. */
    onRenameDeck: (newName: string) => void;
  }

  let {
    customDeck,
    onClose,
    onRemoveItem,
    onDeleteDeck,
    onRenameDeck,
  }: Props = $props();

  let isEditing = $state(false);
  let editName = $state(untrack(() => customDeck.name));
  let showDeleteConfirm = $state(false);

  /** Tracks which item indices are expanded. */
  let expandedItems = $state<Set<number>>(new Set());

  /** Return a display name for an item, preferring registry name over stored label. */
  function getDeckDisplayName(deckId: string, subDeckId?: string): string {
    const decks = getAllDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return deckId;
    if (subDeckId) {
      const sub = deck.subDecks?.find((s: { id: string; name: string }) => s.id === subDeckId);
      return sub?.name ?? subDeckId;
    }
    return deck.name;
  }

  /** Return the fact count for an item. */
  function getItemFactCount(deckId: string, subDeckId?: string): number {
    return getCuratedDeckFacts(deckId, subDeckId).length;
  }

  const studyItems = $derived(
    customDeck.items.filter((it): it is Extract<typeof it, { type: 'study' }> => it.type === 'study')
  );

  /** Aggregate mastery progress across all study items. */
  const aggregateProgress = $derived.by(() => {
    let totalFacts = 0, encountered = 0, mastered = 0;
    for (const item of studyItems) {
      const p = getDeckProgress(item.deckId);
      totalFacts += p.totalFacts;
      encountered += p.factsEncountered;
      mastered += p.factsMastered;
    }
    const pct = totalFacts > 0 ? Math.round((mastered / totalFacts) * 100) : 0;
    return { totalFacts, encountered, mastered, pct };
  });

  /** Whether the item at the given original index is expandable (has sub-decks or exam tags). */
  function isItemExpandable(item: Extract<(typeof customDeck.items)[number], { type: 'study' }>): boolean {
    const entry = getDeckById(item.deckId);
    if (!entry) return false;
    return (entry.subDecks && entry.subDecks.length > 0) || getDeckTags(item.deckId).length > 0;
  }

  function toggleExpand(index: number): void {
    const next = new Set(expandedItems);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    expandedItems = next;
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function startEditing(): void {
    editName = customDeck.name;
    isEditing = true;
  }

  function commitRename(): void {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== customDeck.name) {
      onRenameDeck(trimmed);
    }
    isEditing = false;
  }

  function handleNameKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { isEditing = false; editName = customDeck.name; }
  }

  function handleDelete(): void {
    onDeleteDeck();
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div class="modal" role="dialog" aria-label="Custom Deck" aria-modal="true">
    <!-- Header -->
    <div class="modal-header">
      <div class="header-title-row">
        {#if isEditing}
          <input
            class="name-input"
            type="text"
            bind:value={editName}
            onblur={commitRename}
            onkeydown={handleNameKeydown}
            maxlength="40"
            aria-label="Rename custom deck"
            autofocus
          />
        {:else}
          <button class="deck-name-btn" onclick={startEditing} aria-label="Click to rename custom deck">
            <span class="deck-name">{customDeck.name}</span>
            <span class="edit-hint">Edit</span>
          </button>
        {/if}
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close">&#x2715;</button>
    </div>

    <!-- Body -->
    <div class="modal-body">
      <!-- Aggregate overview section -->
      {#if studyItems.length > 0}
        <div class="aggregate-section">
          <div class="section-label">OVERVIEW</div>
          <div class="progress-row">
            <div class="progress-track">
              <div class="progress-fill" style="width: {Math.min(aggregateProgress.pct, 100)}%"></div>
            </div>
            <span class="progress-pct">{aggregateProgress.pct}%</span>
          </div>
          <div class="stats-row">
            <div class="stat-row">
              <span class="stat-label">Total</span>
              <span class="stat-value">{aggregateProgress.totalFacts}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Seen</span>
              <span class="stat-value">{aggregateProgress.encountered}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Mastered</span>
              <span class="stat-value stat-mastered">{aggregateProgress.mastered}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Item list -->
      {#if studyItems.length === 0}
        <p class="empty-note">No decks in this custom deck.</p>
      {:else}
        <ul class="item-list">
          {#each customDeck.items as item, i (i)}
            {#if item.type === 'study'}
              {@const deckName = getDeckDisplayName(item.deckId, item.subDeckId)}
              {@const factCount = getItemFactCount(item.deckId, item.subDeckId)}
              {@const itemProg = getDeckProgress(item.deckId)}
              {@const expandable = isItemExpandable(item)}
              {@const isExpanded = expandedItems.has(i)}
              {@const entry = getDeckById(item.deckId)}
              <li class="item-card">
                <!-- Collapsed header row -->
                <div class="item-header" class:expandable>
                  <!-- Clickable area: name + progress (expands/collapses) -->
                  <button
                    class="item-expand-btn"
                    onclick={() => expandable && toggleExpand(i)}
                    aria-expanded={expandable ? isExpanded : undefined}
                    aria-label="{deckName}{expandable ? (isExpanded ? ', collapse' : ', expand') : ''}"
                    disabled={!expandable}
                  >
                    <div class="item-info">
                      <span class="item-name">{deckName}</span>
                      <span class="item-facts">{factCount} facts</span>
                    </div>
                    <div class="item-progress-area">
                      <div class="mini-progress-track">
                        <div
                          class="mini-progress-fill"
                          style="width: {Math.min(itemProg.progressPercent, 100)}%"
                        ></div>
                      </div>
                      <span class="mini-pct">{Math.round(itemProg.progressPercent)}%</span>
                    </div>
                    {#if expandable}
                      <span class="chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                    {/if}
                  </button>

                  <!-- Remove button — separate from expand area -->
                  <button
                    class="remove-btn"
                    onclick={() => onRemoveItem(i)}
                    aria-label="Remove {deckName} from custom deck"
                  >
                    &#x2715;
                  </button>
                </div>

                <!-- Expanded panel: sub-decks + exam tags -->
                {#if isExpanded && expandable && entry}
                  <div class="expanded-panel">
                    <!-- Sub-decks -->
                    {#if entry.subDecks && entry.subDecks.length > 0}
                      <div class="subdeck-section-inner">
                        <div class="section-label-sm">Sub-decks</div>
                        {#each entry.subDecks as subDeck (subDeck.id)}
                          {@const subProg = getSubDeckProgress(item.deckId, subDeck.id)}
                          <div class="subdeck-row">
                            <span class="subdeck-name">{subDeck.name}</span>
                            <div class="mini-progress-track">
                              <div
                                class="mini-progress-fill"
                                style="width: {Math.min(subProg.progressPercent, 100)}%"
                              ></div>
                            </div>
                            <span class="mini-pct">{Math.round(subProg.progressPercent)}%</span>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <!-- Exam tags -->
                    {#if getDeckTags(item.deckId).length > 0}
                      <div>
                        <div class="section-label-sm">Exam Tags</div>
                        <div class="tag-chips">
                          {#each getDeckTags(item.deckId) as tag (tag)}
                            <span class="tag-chip">
                              {TAG_DISPLAY[tag] ?? tag}
                              <span class="tag-count">({getTagFactIds(item.deckId, [tag]).length})</span>
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Footer -->
    <div class="modal-footer">
      <span class="total-facts">{aggregateProgress.totalFacts} total facts</span>
      <div class="footer-actions">
        {#if showDeleteConfirm}
          <span class="confirm-text">Delete this custom deck?</span>
          <button class="confirm-delete-btn" onclick={handleDelete}>Yes, delete</button>
          <button class="cancel-btn" onclick={() => { showDeleteConfirm = false; }}>Cancel</button>
        {:else}
          <button class="delete-btn" onclick={() => { showDeleteConfirm = true; }}>Delete Custom Deck</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 350;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
  }

  .modal {
    background: #0f172a;
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: calc(12px * var(--layout-scale, 1));
    box-shadow:
      0 calc(8px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(99, 102, 241, 0.12);
    width: calc(560px * var(--layout-scale, 1));
    max-width: 92vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .header-title-row {
    flex: 1;
    min-width: 0;
  }

  .deck-name-btn {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    background: none;
    border: none;
    padding: calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.12s;
  }

  .deck-name-btn:hover {
    background: rgba(99, 102, 241, 0.1);
  }

  .deck-name {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #a5b4fc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(360px * var(--layout-scale, 1));
  }

  .edit-hint {
    font-size: calc(11px * var(--text-scale, 1));
    color: #4b5563;
    font-weight: 400;
    white-space: nowrap;
  }

  .name-input {
    width: 100%;
    height: calc(34px * var(--layout-scale, 1));
    padding: 0 calc(10px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 600;
    outline: none;
  }

  .close-btn {
    background: none;
    border: none;
    color: #475569;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: color 0.12s;
    flex-shrink: 0;
    min-width: calc(28px * var(--layout-scale, 1));
    min-height: calc(28px * var(--layout-scale, 1));
    line-height: 1;
  }

  .close-btn:hover {
    color: #f87171;
  }

  /* ── Body ── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    scrollbar-width: thin;
    scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
  }

  /* ── Aggregate overview ── */
  .aggregate-section {
    padding: calc(10px * var(--layout-scale, 1)) 0 calc(12px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .section-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .section-label-sm {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
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

  .stats-row {
    display: flex;
    gap: calc(16px * var(--layout-scale, 1));
  }

  .stat-row {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .stat-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .stat-value {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #94a3b8;
  }

  .stat-mastered {
    color: #4ade80;
  }

  /* ── Item list ── */
  .empty-note {
    font-size: calc(14px * var(--text-scale, 1));
    color: #4b5563;
    text-align: center;
    padding: calc(24px * var(--layout-scale, 1)) 0;
    margin: 0;
  }

  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  /* Each item is a card with optional expanded panel */
  .item-card {
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.18);
    border-radius: calc(8px * var(--layout-scale, 1));
    overflow: hidden;
    transition: border-color 0.12s;
  }

  .item-card:hover {
    border-color: rgba(99, 102, 241, 0.28);
  }

  /* Collapsed header row: expand-btn + remove-btn */
  .item-header {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  /* The clickable expand area (takes up most of the row) */
  .item-expand-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: default;
    min-width: 0;
  }

  .item-header.expandable .item-expand-btn {
    cursor: pointer;
  }

  .item-expand-btn:disabled {
    cursor: default;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
    min-width: 0;
  }

  .item-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-facts {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .item-progress-area {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  /* ── Mini progress bar (item row) ── */
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

  /* Chevron indicator */
  .chevron {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    flex-shrink: 0;
    transition: transform 0.15s ease;
    width: calc(16px * var(--layout-scale, 1));
    text-align: center;
  }

  .remove-btn {
    flex-shrink: 0;
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #6b7280;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
    line-height: 1;
  }

  .remove-btn:hover {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.6);
    background: rgba(239, 68, 68, 0.08);
  }

  /* ── Expanded panel ── */
  .expanded-panel {
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-top: 1px solid rgba(99, 102, 241, 0.12);
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .subdeck-section-inner {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .subdeck-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1));
  }

  .subdeck-name {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Tag chips (display-only) ── */
  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: calc(4px * var(--layout-scale, 1));
    margin-top: calc(6px * var(--layout-scale, 1));
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(99, 102, 241, 0.3);
    background: rgba(99, 102, 241, 0.08);
    color: #94a3b8;
    font-size: calc(10px * var(--text-scale, 1));
    white-space: nowrap;
  }

  .tag-count {
    opacity: 0.65;
    font-size: calc(9px * var(--text-scale, 1));
  }

  /* ── Footer ── */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .total-facts {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    white-space: nowrap;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .confirm-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #fca5a5;
  }

  .delete-btn {
    height: calc(32px * var(--layout-scale, 1));
    padding: 0 calc(14px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    white-space: nowrap;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.6);
  }

  .confirm-delete-btn {
    height: calc(32px * var(--layout-scale, 1));
    padding: 0 calc(14px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: none;
    background: #dc2626;
    color: #fff;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.12s;
    white-space: nowrap;
  }

  .confirm-delete-btn:hover {
    opacity: 0.88;
  }

  .cancel-btn {
    height: calc(32px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: #9ca3af;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 500;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
    white-space: nowrap;
  }

  .cancel-btn:hover {
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.25);
  }
</style>
