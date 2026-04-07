<script lang="ts">
  import type { CustomDeck } from '../../data/studyPreset';

  interface Props {
    /** Existing custom decks to show. */
    customDecks: CustomDeck[];
    /** Called when an item is added to an existing custom deck. */
    onAddToDeck: (deckId: string) => void;
    /** Called when a new custom deck is created and the item added to it. */
    onCreateAndAdd: (name: string) => void;
    /** Called to close the popup. */
    onClose: () => void;
  }

  let { customDecks, onAddToDeck, onCreateAndAdd, onClose }: Props = $props();

  let newDeckName = $state('');

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  function handleAddTo(deckId: string): void {
    onAddToDeck(deckId);
    onClose();
  }

  function handleCreate(): void {
    const trimmed = newDeckName.trim();
    if (!trimmed) return;
    onCreateAndAdd(trimmed);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  }
</script>

<!-- Backdrop -->
<div
  class="popup-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div class="popup" role="dialog" aria-label="Add to Custom Deck" aria-modal="true">
    <div class="popup-header">
      <span class="popup-title">Add to Custom Deck</span>
      <button class="popup-close" onclick={onClose} aria-label="Close">✕</button>
    </div>

    <div class="popup-body">
      {#if customDecks.length > 0}
        <div class="decks-list">
          {#each customDecks as deck (deck.id)}
            <div class="deck-row">
              <div class="deck-info">
                <span class="deck-name">{deck.name}</span>
                <span class="deck-count">
                  {deck.items.length} item{deck.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                class="add-btn"
                onclick={() => handleAddTo(deck.id)}
                aria-label="Add to {deck.name}"
              >
                Add
              </button>
            </div>
          {/each}
        </div>
        <div class="divider"></div>
      {/if}

      <div class="create-section">
        <span class="create-label">Create New:</span>
        <div class="create-row">
          <input
            class="create-input"
            type="text"
            placeholder="Custom deck name..."
            maxlength="40"
            bind:value={newDeckName}
            onkeydown={handleKeydown}
            aria-label="New custom deck name"
          />
          <button
            class="create-btn"
            onclick={handleCreate}
            disabled={!newDeckName.trim()}
            aria-label="Create custom deck and add item"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .popup-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
  }

  .popup {
    background: #0f172a;
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: calc(12px * var(--layout-scale, 1));
    box-shadow:
      0 calc(8px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(99, 102, 241, 0.12);
    width: calc(340px * var(--layout-scale, 1));
    max-width: 90vw;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
  }

  .popup-title {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #a5b4fc;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .popup-close {
    background: none;
    border: none;
    color: #475569;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: color 0.12s;
    line-height: 1;
  }

  .popup-close:hover {
    color: #f87171;
  }

  /* ── Body ── */
  .popup-body {
    display: flex;
    flex-direction: column;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    gap: calc(12px * var(--layout-scale, 1));
  }

  /* ── Deck rows ── */
  .decks-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .deck-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.18);
    border-radius: calc(8px * var(--layout-scale, 1));
    transition: background 0.12s, border-color 0.12s;
  }

  .deck-row:hover {
    background: rgba(99, 102, 241, 0.13);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .deck-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .deck-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deck-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .add-btn {
    flex-shrink: 0;
    height: calc(28px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    white-space: nowrap;
  }

  .add-btn:hover {
    background: rgba(99, 102, 241, 0.28);
    border-color: #6366f1;
    color: #c7d2fe;
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.07);
    margin: 0 calc(-4px * var(--layout-scale, 1));
  }

  /* ── Create section ── */
  .create-section {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .create-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .create-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .create-input {
    flex: 1;
    height: calc(34px * var(--layout-scale, 1));
    padding: 0 calc(10px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-size: calc(13px * var(--text-scale, 1));
    outline: none;
    transition: border-color 0.12s;
    min-width: 0;
  }

  .create-input::placeholder {
    color: #334155;
  }

  .create-input:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .create-btn {
    flex-shrink: 0;
    height: calc(34px * var(--layout-scale, 1));
    padding: 0 calc(14px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: none;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: #fff;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.12s;
    white-space: nowrap;
  }

  .create-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .create-btn:not(:disabled):hover {
    opacity: 0.88;
  }
</style>
