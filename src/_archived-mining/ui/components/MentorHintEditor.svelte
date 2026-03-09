<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { submitHint } from '../../services/mentorService'

  interface Props {
    factId: string
    onClose: () => void
  }

  const { factId, onClose }: Props = $props()

  let hintText = $state('')
  let submitting = $state(false)
  let submitted = $state(false)
  let errorMsg = $state('')

  const charCount = $derived(hintText.length)
  const MAX_CHARS = 200

  async function handleSubmit(): Promise<void> {
    if (hintText.trim().length === 0) {
      errorMsg = 'Please write a hint first.'
      return
    }
    submitting = true
    errorMsg = ''
    const result = await submitHint(factId, hintText)
    submitting = false

    if (result.success) {
      // Record that the player has authored a hint for this fact
      const save = $playerSave
      if (save && result.hintId) {
        const already = save.authoredHints?.includes(factId)
        if (!already) {
          playerSave.set({
            ...save,
            authoredHints: [...(save.authoredHints ?? []), factId],
          })
          persistPlayer()
        }
      }
      submitted = true
    } else {
      errorMsg = 'Failed to submit. Please try again.'
    }
  }
</script>

<div class="mentor-editor" role="dialog" aria-modal="true" aria-label="Write a hint">
  <div class="editor-panel">
    <h3 class="editor-title">Write a Hint</h3>
    <p class="editor-desc">
      Share a mnemonic or memory trick for this fact. It will help other players after 3 wrong answers.
    </p>

    {#if submitted}
      <div class="success-msg">
        Hint submitted for review. Thank you.
      </div>
      <button type="button" class="btn-close" onclick={onClose}>Close</button>
    {:else}
      <textarea
        class="hint-input"
        placeholder="E.g. 'Think of it as...' or 'The trick is...'"
        bind:value={hintText}
        maxlength={MAX_CHARS}
        rows="4"
        disabled={submitting}
      ></textarea>
      <div class="char-counter" class:near-limit={charCount > 170}>
        {charCount}/{MAX_CHARS}
      </div>

      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}

      <div class="btn-row">
        <button type="button" class="btn-cancel" onclick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="button"
          class="btn-submit"
          onclick={handleSubmit}
          disabled={submitting || hintText.trim().length === 0}
        >
          {submitting ? 'Submitting...' : 'Submit Hint'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .mentor-editor {
    position: fixed;
    inset: 0;
    z-index: 9100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.75);
    pointer-events: all;
  }

  .editor-panel {
    background: #0e0e2a;
    border: 1px solid #4ecca3;
    border-radius: 8px;
    padding: 20px;
    max-width: 360px;
    width: 90%;
    font-family: 'Press Start 2P', monospace;
    color: #e0e0e0;
  }

  .editor-title {
    font-size: 11px;
    color: #4ecca3;
    margin-bottom: 10px;
  }

  .editor-desc {
    font-size: 8px;
    color: #aaa;
    line-height: 1.7;
    margin-bottom: 12px;
    font-family: sans-serif;
  }

  .hint-input {
    width: 100%;
    box-sizing: border-box;
    background: #1a1a3a;
    border: 1px solid #4ecca3;
    border-radius: 4px;
    color: #fff;
    font-family: sans-serif;
    font-size: 13px;
    padding: 8px;
    resize: vertical;
    margin-bottom: 4px;
  }

  .char-counter {
    text-align: right;
    font-size: 7px;
    color: #666;
    margin-bottom: 10px;
  }

  .char-counter.near-limit { color: #ffbb33; }

  .error-msg {
    color: #ff6666;
    font-size: 8px;
    margin-bottom: 8px;
    text-align: center;
  }

  .success-msg {
    color: #4ecca3;
    font-size: 9px;
    text-align: center;
    margin: 12px 0;
    line-height: 1.7;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .btn-cancel, .btn-submit, .btn-close {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 8px 14px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    min-height: 32px;
  }

  .btn-cancel {
    background: #333;
    color: #aaa;
    border: 1px solid #555;
  }

  .btn-submit {
    background: #4ecca3;
    color: #0a0a1a;
  }

  .btn-submit:disabled {
    background: #2a6a5a;
    color: #666;
    cursor: default;
  }

  .btn-close {
    background: #333;
    color: #aaa;
    border: 1px solid #555;
    display: block;
    margin: 0 auto;
    margin-top: 8px;
  }
</style>
