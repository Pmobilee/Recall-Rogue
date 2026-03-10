<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { analyticsService } from '../../services/analyticsService'
  import { feedbackService } from '../../services/feedbackService'

  let open = $state(false)
  let text = $state('')
  let sending = $state(false)
  let notice = $state<string | null>(null)

  async function submitFeedback(): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    sending = true
    notice = null
    try {
      await feedbackService.submit({
        userId: $playerSave?.deviceId ?? $playerSave?.playerId ?? 'anonymous',
        feedback: trimmed,
        accountId: $playerSave?.accountId ?? null,
        timestamp: Date.now(),
      })
      analyticsService.track({
        name: 'feedback_submitted',
        properties: {
          length: trimmed.length,
        },
      })
      text = ''
      open = false
      notice = 'Feedback sent. Thank you.'
    } catch (err) {
      notice = err instanceof Error ? err.message : 'Feedback failed.'
    } finally {
      sending = false
    }
  }
</script>

<section class="feedback">
  <h3>Feedback</h3>
  <button type="button" class="toggle" onclick={() => (open = !open)}>
    {open ? 'Close Feedback Form' : 'Send Feedback'}
  </button>

  {#if open}
    <div class="panel">
      <textarea
        bind:value={text}
        rows="5"
        maxlength="1200"
        placeholder="Share bugs, balance issues, or ideas..."
      ></textarea>
      <button type="button" class="submit" onclick={submitFeedback} disabled={sending || text.trim().length === 0}>
        {sending ? 'Sending...' : 'Submit Feedback'}
      </button>
    </div>
  {/if}

  {#if notice}
    <p class="notice">{notice}</p>
  {/if}
</section>

<style>
  .feedback {
    background: rgba(15, 23, 42, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  h3 {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .toggle,
  .submit {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    padding: 0 12px;
  }

  .submit {
    background: #1d4ed8;
    border-color: #3b82f6;
    color: #dbeafe;
  }

  .submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .panel {
    display: grid;
    gap: 8px;
  }

  textarea {
    width: 100%;
    resize: vertical;
    min-height: 90px;
    border-radius: 8px;
    border: 1px solid #475569;
    background: #0b1626;
    color: #e2e8f0;
    padding: 10px;
    font-family: inherit;
  }

  .notice {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }
</style>
