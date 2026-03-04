<script lang="ts">
  import { socialService } from '../../services/socialService'
  import { ApiError } from '../../services/apiClient'

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    /** Target player's ID. */
    playerId: string
    /** Display name of the hub owner (for UI copy). */
    ownerName: string
    /** Called when the modal should close. */
    onClose: () => void
  }

  let { playerId, ownerName, onClose }: Props = $props()

  // ============================================================
  // CONSTANTS
  // ============================================================

  const MAX_CHARS = 200

  // ============================================================
  // STATE
  // ============================================================

  let message = $state('')
  let submitting = $state(false)
  let submitted = $state(false)
  let errorText = $state<string | null>(null)

  // ============================================================
  // DERIVED
  // ============================================================

  const charCount = $derived(message.length)
  const isOverLimit = $derived(charCount > MAX_CHARS)
  const isEmpty = $derived(message.trim().length === 0)
  const canSubmit = $derived(!isEmpty && !isOverLimit && !submitting && !submitted)

  const charCountColor = $derived(
    isOverLimit
      ? '#ff4444'
      : charCount > MAX_CHARS * 0.85
        ? '#ffb400'
        : '#666'
  )

  /** Safe version of the owner name for display. */
  const safeOwnerName = $derived(
    ownerName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  )

  // ============================================================
  // HANDLERS
  // ============================================================

  function handleInput(e: Event): void {
    message = (e.target as HTMLTextAreaElement).value
    errorText = null
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return
    submitting = true
    errorText = null

    try {
      await socialService.postGuestbookEntry(playerId, message.trim())
      submitted = true
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        errorText = "You've already left 3 messages on this hub today. Try again tomorrow."
      } else {
        errorText = err instanceof Error ? err.message : 'Failed to post message.'
      }
    } finally {
      submitting = false
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose()
    }
    // Cmd/Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      void handleSubmit()
    }
  }

  /** Trap focus within the modal backdrop on click-outside. */
  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose()
    }
  }
</script>

<!-- ============================================================
     BACKDROP
     ============================================================ -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-backdrop"
  onclick={handleBackdropClick}
  aria-hidden="false"
>
  <!-- ============================================================
       MODAL PANEL
       ============================================================ -->
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Leave a message for {safeOwnerName}"
    tabindex="-1"
    onkeydown={handleKeydown}
  >
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">
        Leave a Message
      </h2>
      <button
        class="close-btn"
        type="button"
        onclick={onClose}
        aria-label="Close"
      >
        &#x2715;
      </button>
    </div>

    <p class="modal-subtitle">
      Writing in <strong>{safeOwnerName}</strong>'s guestbook
    </p>

    {#if submitted}
      <!-- SUCCESS STATE -->
      <div class="success-block" role="status" aria-live="polite">
        <span class="success-icon" aria-hidden="true">&#x2713;</span>
        <p class="success-text">Your message has been posted!</p>
        <button class="submit-btn" type="button" onclick={onClose}>
          Close
        </button>
      </div>

    {:else}
      <!-- INPUT STATE -->
      <div class="input-block">
        <label class="textarea-label" for="guestbook-message">
          Your message
        </label>
        <textarea
          id="guestbook-message"
          class="message-textarea"
          class:over-limit={isOverLimit}
          placeholder="Say hello, share a memory, or leave a tip..."
          maxlength={MAX_CHARS + 50}
          rows={4}
          disabled={submitting}
          aria-describedby="char-counter"
          oninput={handleInput}
        >{message}</textarea>

        <div class="textarea-footer">
          <span
            id="char-counter"
            class="char-counter"
            style="color: {charCountColor}"
            aria-live="polite"
            aria-label="{charCount} of {MAX_CHARS} characters"
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {#if errorText}
        <p class="error-text" role="alert" aria-live="assertive">
          {errorText}
        </p>
      {/if}

      <p class="hint-text">
        Tip: Ctrl+Enter to send
      </p>

      <div class="modal-actions">
        <button
          class="cancel-btn"
          type="button"
          onclick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          class="submit-btn"
          type="button"
          onclick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={submitting}
        >
          {submitting ? 'Posting...' : 'Post Message'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ============================================================
     BACKDROP
     ============================================================ */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: auto;
  }

  @media (min-height: 520px) {
    .modal-backdrop {
      align-items: center;
    }
  }

  /* ============================================================
     PANEL
     ============================================================ */
  .modal-panel {
    background: #1a1d27;
    border: 1px solid rgba(255, 180, 0, 0.2);
    border-radius: 16px 16px 0 0;
    padding: 20px 20px max(20px, env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  @media (min-height: 520px) {
    .modal-panel {
      border-radius: 16px;
      padding: 20px;
    }
  }

  /* ============================================================
     HEADER
     ============================================================ */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    color: #ffb400;
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    color: #aaa;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .modal-subtitle {
    color: #888;
    font-size: 0.82rem;
    margin: 0;
  }

  .modal-subtitle strong {
    color: #ccc;
  }

  /* ============================================================
     INPUT AREA
     ============================================================ */
  .input-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .textarea-label {
    color: #aaa;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .message-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #e8e8e8;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.5;
    padding: 10px 12px;
    resize: vertical;
    min-height: 90px;
    transition: border-color 0.15s;
  }

  .message-textarea:focus {
    outline: none;
    border-color: rgba(255, 180, 0, 0.4);
  }

  .message-textarea.over-limit {
    border-color: rgba(255, 68, 68, 0.5);
  }

  .message-textarea:disabled {
    opacity: 0.5;
  }

  .textarea-footer {
    display: flex;
    justify-content: flex-end;
  }

  .char-counter {
    font-size: 0.72rem;
    font-weight: 600;
    transition: color 0.2s;
  }

  /* ============================================================
     ERROR / HINT
     ============================================================ */
  .error-text {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 8px;
    color: #ff8080;
    font-size: 0.82rem;
    margin: 0;
    padding: 8px 12px;
  }

  .hint-text {
    color: #555;
    font-size: 0.72rem;
    margin: 0;
    text-align: right;
  }

  /* ============================================================
     SUCCESS STATE
     ============================================================ */
  .success-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0 8px;
  }

  .success-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(100, 220, 130, 0.15);
    border: 2px solid rgba(100, 220, 130, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    color: #64dc82;
  }

  .success-text {
    color: #ccc;
    font-size: 0.9rem;
    margin: 0;
    text-align: center;
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  .modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .cancel-btn {
    flex: 1;
    min-height: 44px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    color: #aaa;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    flex: 2;
    min-height: 44px;
    background: rgba(255, 180, 0, 0.2);
    border: 1px solid rgba(255, 180, 0, 0.45);
    border-radius: 10px;
    color: #ffb400;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    background: rgba(255, 180, 0, 0.32);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
