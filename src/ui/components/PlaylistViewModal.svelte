<script lang="ts">
  import type { CustomPlaylist } from '../../data/studyPreset';
  import { getCuratedDeck, getCuratedDeckFacts } from '../../data/curatedDeckStore';
  import { getAllDecks } from '../../data/deckRegistry';

  interface Props {
    /** The playlist to display and edit. */
    playlist: CustomPlaylist;
    /** Called to close the modal. */
    onClose: () => void;
    /** Called when the user removes an item by index. */
    onRemoveItem: (itemIndex: number) => void;
    /** Called when the user deletes the entire playlist. */
    onDeletePlaylist: () => void;
    /** Called when the user renames the playlist. */
    onRenamePlaylist: (newName: string) => void;
  }

  let {
    playlist,
    onClose,
    onRemoveItem,
    onDeletePlaylist,
    onRenamePlaylist,
  }: Props = $props();

  let isEditing = $state(false);
  let editName = $state(playlist.name);
  let showDeleteConfirm = $state(false);

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
    playlist.items.filter((it): it is Extract<typeof it, { type: 'study' }> => it.type === 'study')
  );

  const totalFacts = $derived(
    studyItems.reduce((sum, it) => sum + getItemFactCount(it.deckId, it.subDeckId), 0)
  );

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function startEditing(): void {
    editName = playlist.name;
    isEditing = true;
  }

  function commitRename(): void {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== playlist.name) {
      onRenamePlaylist(trimmed);
    }
    isEditing = false;
  }

  function handleNameKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { isEditing = false; editName = playlist.name; }
  }

  function handleDelete(): void {
    onDeletePlaylist();
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div class="modal" role="dialog" aria-label="Playlist Details" aria-modal="true">
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
            aria-label="Rename playlist"
            autofocus
          />
        {:else}
          <button class="playlist-name-btn" onclick={startEditing} aria-label="Click to rename playlist">
            <span class="playlist-name">{playlist.name}</span>
            <span class="edit-hint">Edit</span>
          </button>
        {/if}
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close">&#x2715;</button>
    </div>

    <!-- Item list -->
    <div class="modal-body">
      {#if studyItems.length === 0}
        <p class="empty-note">No decks in this playlist.</p>
      {:else}
        <ul class="item-list">
          {#each playlist.items as item, i (i)}
            {#if item.type === 'study'}
              {@const deckName = getDeckDisplayName(item.deckId, item.subDeckId)}
              {@const factCount = getItemFactCount(item.deckId, item.subDeckId)}
              <li class="item-row">
                <div class="item-info">
                  <span class="item-name">{deckName}</span>
                  <span class="item-facts">{factCount} facts</span>
                </div>
                <button
                  class="remove-btn"
                  onclick={() => onRemoveItem(i)}
                  aria-label="Remove {deckName} from playlist"
                >
                  &#x2715;
                </button>
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Footer -->
    <div class="modal-footer">
      <span class="total-facts">{totalFacts} total facts</span>
      <div class="footer-actions">
        {#if showDeleteConfirm}
          <span class="confirm-text">Delete this playlist?</span>
          <button class="confirm-delete-btn" onclick={handleDelete}>Yes, delete</button>
          <button class="cancel-btn" onclick={() => { showDeleteConfirm = false; }}>Cancel</button>
        {:else}
          <button class="delete-btn" onclick={() => { showDeleteConfirm = true; }}>Delete Playlist</button>
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
    width: calc(460px * var(--layout-scale, 1));
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

  .playlist-name-btn {
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

  .playlist-name-btn:hover {
    background: rgba(99, 102, 241, 0.1);
  }

  .playlist-name {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #a5b4fc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(280px * var(--layout-scale, 1));
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

  .item-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.18);
    border-radius: calc(8px * var(--layout-scale, 1));
    transition: background 0.12s, border-color 0.12s;
  }

  .item-row:hover {
    background: rgba(99, 102, 241, 0.12);
    border-color: rgba(99, 102, 241, 0.28);
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
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
