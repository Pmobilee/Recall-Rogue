<script lang="ts">
  import type { DuelRecord } from '../../data/types'

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    /** The incoming duel challenge record. */
    duel: DuelRecord
    /** Called when the player accepts the challenge. */
    onAccept: () => void
    /** Called when the player declines the challenge. */
    onDecline: () => void
    /** Called to close/dismiss the modal without a decision (e.g. backdrop tap). */
    onClose: () => void
  }

  let { duel, onAccept, onDecline, onClose }: Props = $props()

  // ============================================================
  // STATE
  // ============================================================

  let accepting = $state(false)
  let declining = $state(false)

  // ============================================================
  // ACTIONS
  // ============================================================

  function handleAccept(): void {
    if (accepting || declining) return
    accepting = true
    onAccept()
  }

  function handleDecline(): void {
    if (accepting || declining) return
    declining = true
    onDecline()
  }

  function handleBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('dim-backdrop')) {
      onClose()
    }
  }

  // ============================================================
  // DERIVED
  // ============================================================

  const buttonsDisabled = $derived(accepting || declining)

  const wagerLabel = $derived(
    duel.wagerGreyMatter > 0
      ? `${duel.wagerGreyMatter} grey matter wager`
      : 'No wager'
  )

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
</script>

<!-- ========== DUEL INVITE MODAL ========== -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="dim-backdrop"
  onclick={handleBackdrop}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-label="Incoming duel challenge"
>
  <div class="dim-modal" aria-labelledby="dim-heading" aria-describedby="dim-body">

    <!-- Sword icon + title -->
    <div class="dim-icon-row" aria-hidden="true">
      <span class="dim-sword">⚔️</span>
    </div>

    <h2 class="dim-heading" id="dim-heading">Challenge Received!</h2>

    <div class="dim-body" id="dim-body">
      <!-- Challenger name -->
      <p class="dim-challenger">
        <span class="dim-dim">From:</span>
        <strong class="dim-name">{duel.opponentName}</strong>
      </p>

      <!-- Wager -->
      <div
        class="dim-wager-pill"
        class:dim-wager-none={duel.wagerGreyMatter === 0}
        aria-label="{wagerLabel}"
      >
        <span aria-hidden="true">{duel.wagerGreyMatter > 0 ? '💎' : '🤝'}</span>
        <span>{wagerLabel}</span>
      </div>

      <!-- Questions note -->
      <p class="dim-questions-note">
        Answer <strong>5 knowledge questions</strong> to settle the duel.
      </p>

      <!-- Expiry -->
      <p class="dim-expiry">
        Expires {formatDate(duel.expiresAt)}
      </p>
    </div>

    <!-- Action buttons -->
    <div class="dim-actions" aria-label="Challenge decision">
      <button
        class="dim-btn dim-accept-btn"
        type="button"
        onclick={handleAccept}
        disabled={buttonsDisabled}
        aria-disabled={buttonsDisabled}
        aria-label="Accept the challenge from {duel.opponentName}"
      >
        {#if accepting}
          <span class="dim-btn-spinner" aria-hidden="true">⏳</span>
          Accepting…
        {:else}
          ✓ Accept
        {/if}
      </button>

      <button
        class="dim-btn dim-decline-btn"
        type="button"
        onclick={handleDecline}
        disabled={buttonsDisabled}
        aria-disabled={buttonsDisabled}
        aria-label="Decline the challenge from {duel.opponentName}"
      >
        {#if declining}
          Declining…
        {:else}
          ✕ Decline
        {/if}
      </button>
    </div>

    <!-- Close (dismiss without deciding) -->
    <button
      class="dim-later-btn"
      type="button"
      onclick={onClose}
      disabled={buttonsDisabled}
      aria-label="Decide later"
    >
      Decide later
    </button>

  </div>
</div>

<style>
  /* ---- Backdrop ---- */
  .dim-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
    pointer-events: auto;
    padding: 16px;
  }

  /* ---- Modal ---- */
  .dim-modal {
    width: 100%;
    max-width: 360px;
    background: #1a1a2e;
    border: 2px solid #a78bfa66;
    border-radius: 20px;
    padding: 24px 20px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;

    /* Pixel art drop-shadow */
    box-shadow:
      0 0 0 1px #a78bfa22,
      0 8px 32px rgba(0, 0, 0, 0.6);

    /* Subtle entrance animation */
    animation: dim-enter 0.18s ease-out both;
  }

  @keyframes dim-enter {
    from {
      transform: scale(0.92) translateY(12px);
      opacity: 0;
    }
    to {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }

  /* ---- Icon row ---- */
  .dim-icon-row {
    line-height: 1;
  }

  .dim-sword {
    font-size: 2.4rem;
    filter: drop-shadow(0 0 8px #a78bfa88);
  }

  /* ---- Heading ---- */
  .dim-heading {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 2px;
    text-align: center;
  }

  /* ---- Body ---- */
  .dim-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    background: #16213e;
    border-radius: 12px;
    padding: 14px 16px;
  }

  .dim-challenger {
    margin: 0;
    font-size: 0.82rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dim-dim {
    color: #94a3b8;
    font-weight: 400;
  }

  .dim-name {
    color: #f59e0b;
    font-size: 1rem;
    font-weight: 700;
  }

  /* ---- Wager pill ---- */
  .dim-wager-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: color-mix(in srgb, #f59e0b 15%, #16213e 85%);
    border: 1px solid #f59e0b55;
    font-size: 0.82rem;
    font-weight: 700;
    color: #f59e0b;
  }

  .dim-wager-none {
    background: #16213e;
    border-color: #334155;
    color: #94a3b8;
  }

  /* ---- Questions note ---- */
  .dim-questions-note {
    margin: 0;
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: center;
    line-height: 1.4;
  }

  .dim-questions-note strong {
    color: #e2e8f0;
  }

  /* ---- Expiry ---- */
  .dim-expiry {
    margin: 0;
    font-size: 0.68rem;
    color: #475569;
    text-align: center;
  }

  /* ---- Actions ---- */
  .dim-actions {
    width: 100%;
    display: flex;
    gap: 10px;
  }

  .dim-btn {
    flex: 1;
    padding: 12px 8px;
    border: 0;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    letter-spacing: 0.5px;
    transition: opacity 0.12s, transform 0.1s;
  }

  .dim-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .dim-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .dim-accept-btn {
    background: #a78bfa;
    color: #1a1a2e;
  }

  .dim-accept-btn:not(:disabled):hover {
    background: #b99ffb;
  }

  .dim-decline-btn {
    background: transparent;
    border: 1px solid #ef444488;
    color: #f87171;
  }

  .dim-decline-btn:not(:disabled):hover {
    background: #ef444411;
  }

  /* ---- Spinner inside button ---- */
  .dim-btn-spinner {
    font-size: 0.85rem;
    animation: dim-pulse 1s ease-in-out infinite;
  }

  @keyframes dim-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ---- Later link ---- */
  .dim-later-btn {
    background: transparent;
    border: 0;
    color: #475569;
    font-family: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.12s;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .dim-later-btn:hover,
  .dim-later-btn:focus-visible {
    color: #94a3b8;
  }

  .dim-later-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .dim-later-btn:active {
    transform: translateY(1px);
  }

  /* ---- Responsive ---- */
  @media (max-width: 400px) {
    .dim-modal {
      padding: 20px 14px 16px;
    }

    .dim-sword {
      font-size: 2rem;
    }

    .dim-heading {
      font-size: 0.9rem;
    }
  }
</style>
