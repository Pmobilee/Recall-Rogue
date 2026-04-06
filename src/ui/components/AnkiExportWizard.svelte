<script lang="ts">
  /**
   * AnkiExportWizard — Single-screen modal for exporting a deck to Anki .apkg format.
   *
   * Supports exporting curated decks or personal decks. Optionally includes
   * FSRS scheduling state so the user can continue their review progress in Anki.
   *
   * Services are dynamically imported to avoid coupling the UI layer to game-logic.
   */
  import { get } from 'svelte/store';
  import type { DeckFact } from '../../data/curatedDeckTypes';

  interface Props {
    deckId: string
    deckName: string
    onclose: () => void
  }

  const { deckId, deckName, onclose }: Props = $props()

  let includeProgress = $state(true)
  let onlyDue = $state(false)
  let exporting = $state(false)
  let done = $state(false)
  let error = $state<string | null>(null)
  let exportedCount = $state(0)

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }

  function handleModalClick(e: MouseEvent) {
    e.stopPropagation()
  }

  function handleModalKeydown(e: KeyboardEvent) {
    e.stopPropagation()
  }

  async function handleExport() {
    exporting = true
    done = false
    error = null

    try {
      const { createApkg } = await import('../../services/ankiService')
      const { playerSave } = await import('../stores/playerData')

      // --- Gather facts ---
      let facts: DeckFact[] = []

      // Try curated deck store first
      try {
        const { getCuratedDeckFacts } = await import('../../data/curatedDeckStore')
        const curatedFacts = getCuratedDeckFacts(deckId)
        if (curatedFacts.length > 0) {
          facts = curatedFacts
        }
      } catch {
        // curatedDeckStore may not have this deck loaded yet
      }

      // Fall back to personal deck store
      if (facts.length === 0) {
        try {
          const { getPersonalDeckData } = await import('../../services/personalDeckStore')
          const personalDeck = getPersonalDeckData(deckId)
          if (personalDeck?.facts) {
            facts = personalDeck.facts
          }
        } catch {
          // personalDeckStore may not be available
        }
      }

      // --- Filter to only due cards if requested ---
      let filteredFacts = facts
      if (onlyDue && facts.length > 0) {
        const save = get(playerSave)
        const now = Date.now()
        const dueFactIds = new Set(
          (save?.reviewStates ?? [])
            .filter(rs => {
              if (!rs.due) return false
              return new Date(rs.due).getTime() <= now
            })
            .map(rs => rs.factId),
        )
        filteredFacts = facts.filter(f => dueFactIds.has(f.id))
      }

      // --- Build review states map if including progress ---
      let reviewStatesMap: Map<string, import('../../data/types').ReviewState> | undefined
      if (includeProgress) {
        const save = get(playerSave)
        const factIdSet = new Set(filteredFacts.map(f => f.id))
        const matching = (save?.reviewStates ?? []).filter(rs => factIdSet.has(rs.factId))
        if (matching.length > 0) {
          reviewStatesMap = new Map(matching.map(rs => [rs.factId, rs]))
        }
      }

      const apkgBytes = await createApkg({ deckName, facts: filteredFacts, reviewStates: reviewStatesMap })
      exportedCount = filteredFacts.length

      // Trigger browser download
      const blob = new Blob([apkgBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deckName.replace(/[^a-zA-Z0-9_-]/g, '_')}.apkg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      done = true
    } catch (err) {
      error = err instanceof Error ? err.message : 'Export failed. Please try again.'
    } finally {
      exporting = false
    }
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Export deck to Anki"
  onclick={onclose}
  onkeydown={handleBackdropKeydown}
  tabindex="-1"
>
  <!-- Modal -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal"
    onclick={handleModalClick}
    onkeydown={handleModalKeydown}
    role="document"
  >
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-title">Export to Anki</div>
      <button class="close-btn" onclick={onclose} type="button" aria-label="Close">✕</button>
    </div>

    <!-- Body -->
    <div class="modal-body">

      <!-- Deck info -->
      <div class="deck-info">
        <div class="anki-logo" aria-hidden="true">&#9670;</div>
        <div class="deck-info-text">
          <div class="deck-info-name">{deckName}</div>
          <div class="deck-info-sub">Will be exported as a .apkg file</div>
        </div>
      </div>

      <!-- Error -->
      {#if error}
        <div class="error-banner" role="alert">{error}</div>
      {/if}

      <!-- Success -->
      {#if done}
        <div class="success-banner" role="status">
          <span class="success-check" aria-hidden="true">&#10003;</span>
          Download started — {exportedCount.toLocaleString()} card{exportedCount !== 1 ? 's' : ''} exported
        </div>
      {/if}

      <!-- Options -->
      <div class="options-section">
        <div class="options-label">Export Options</div>

        <label class="checkbox-row">
          <input
            type="checkbox"
            bind:checked={includeProgress}
            disabled={exporting}
          />
          <div class="checkbox-content">
            <span class="checkbox-label">Include review progress (FSRS stats)</span>
            <span class="checkbox-sub">Export your review history so Anki can continue your scheduling</span>
          </div>
        </label>

        <label class="checkbox-row" style="margin-top: calc(10px * var(--layout-scale, 1));">
          <input
            type="checkbox"
            bind:checked={onlyDue}
            disabled={exporting}
          />
          <div class="checkbox-content">
            <span class="checkbox-label">Include only due / overdue cards</span>
            <span class="checkbox-sub">Skip cards that are not yet scheduled for review</span>
          </div>
        </label>
      </div>

      <!-- Action area -->
      <div class="action-area">
        {#if done}
          <button class="btn-secondary" onclick={onclose} type="button">
            Close
          </button>
          <button
            class="btn-primary"
            onclick={handleExport}
            disabled={exporting}
            type="button"
          >
            Export Again
          </button>
        {:else}
          <button class="btn-secondary" onclick={onclose} type="button" disabled={exporting}>
            Cancel
          </button>
          <button
            class="btn-primary"
            onclick={handleExport}
            disabled={exporting}
            type="button"
          >
            {#if exporting}
              <span class="spinner" aria-hidden="true"></span>
              Generating...
            {:else}
              Export .apkg
            {/if}
          </button>
        {/if}
      </div>

    </div>
  </div>
</div>

<style>
  /* ---- Backdrop ---- */
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.18s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ---- Modal card ---- */
  .modal {
    position: relative;
    width: calc(480px * var(--layout-scale, 1));
    background: rgba(15, 20, 35, 0.97);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(16px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
      0 calc(24px * var(--layout-scale, 1)) calc(64px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(139, 92, 246, 0.1);
  }

  /* ---- Header ---- */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(18px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.3px;
  }

  .close-btn {
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    color: #eab308;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: #fde047;
    transform: scale(1.15);
  }

  /* ---- Body ---- */
  .modal-body {
    padding: calc(22px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(18px * var(--layout-scale, 1));
  }

  /* ---- Deck info ---- */
  .deck-info {
    display: flex;
    align-items: center;
    gap: calc(14px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1));
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: calc(10px * var(--layout-scale, 1));
  }

  .anki-logo {
    font-size: calc(28px * var(--text-scale, 1));
    color: #8b5cf6;
    line-height: 1;
    flex-shrink: 0;
  }

  .deck-info-text {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    min-width: 0;
  }

  .deck-info-name {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deck-info-sub {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  /* ---- Error / Success banners ---- */
  .error-banner {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #f87171;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  .success-banner {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.25);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #86efac;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  .success-check {
    font-size: calc(16px * var(--text-scale, 1));
    color: #22c55e;
    flex-shrink: 0;
  }

  /* ---- Options ---- */
  .options-section {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(10px * var(--layout-scale, 1));
  }

  .options-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: calc(6px * var(--layout-scale, 1));
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
  }

  .checkbox-row input[type="checkbox"] {
    margin-top: calc(2px * var(--layout-scale, 1));
    accent-color: #f59e0b;
    flex-shrink: 0;
    cursor: inherit;
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
  }

  .checkbox-row input[type="checkbox"]:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .checkbox-content {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .checkbox-label {
    font-size: calc(13px * var(--text-scale, 1));
    color: #e2e8f0;
    line-height: 1.3;
  }

  .checkbox-sub {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    line-height: 1.4;
  }

  /* ---- Action area ---- */
  .action-area {
    display: flex;
    justify-content: flex-end;
    gap: calc(10px * var(--layout-scale, 1));
    padding-top: calc(4px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ---- Buttons ---- */
  .btn-primary {
    background: #f59e0b;
    color: #1a1000;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(10px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    min-width: calc(120px * var(--layout-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    transition: background 0.15s ease, transform 0.1s ease;
    letter-spacing: 0.2px;
  }

  .btn-primary:hover:not(:disabled) {
    background: #fbbf24;
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .btn-secondary {
    background: transparent;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 500;
    padding: calc(10px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.25);
    color: #e2e8f0;
  }

  .btn-secondary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ---- Spinner ---- */
  .spinner {
    display: inline-block;
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    border: 2px solid rgba(26, 16, 0, 0.3);
    border-top-color: #1a1000;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
