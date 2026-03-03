<script lang="ts">
  import { apiClient } from '../../services/apiClient'

  interface Props {
    factId: string
    onClose: () => void
  }

  const { factId, onClose }: Props = $props()

  let reportText = $state('')
  let submitted = $state(false)
  let error = $state('')
  let submitting = $state(false)

  const MAX_CHARS = 200

  async function submit() {
    if (!reportText.trim()) return
    submitting = true
    error = ''
    try {
      await apiClient.reportFact(factId, reportText.trim())
      submitted = true
    } catch {
      error = 'Could not submit report. Please try again.'
    } finally {
      submitting = false
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onClose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-box" onclick={(e) => e.stopPropagation()}>
    {#if submitted}
      <p class="success">Report submitted. Thank you!</p>
      <button onclick={onClose}>Close</button>
    {:else}
      <h3>Report This Fact</h3>
      <p>What's wrong with this fact? (max 200 chars)</p>
      <textarea
        bind:value={reportText}
        maxlength={MAX_CHARS}
        rows={4}
        placeholder="e.g. The number is incorrect — it should be 4, not 3."
      ></textarea>
      <small>{reportText.length}/{MAX_CHARS}</small>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="buttons">
        <button onclick={onClose} disabled={submitting}>Cancel</button>
        <button onclick={submit} disabled={submitting || !reportText.trim()} class="primary">
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000; }
  .modal-box { background:#1a1a2e;border:2px solid #444;border-radius:8px;padding:1.5rem;max-width:360px;width:90%;color:#e0e0e0; }
  h3 { margin:0 0 0.5rem;color:#fff; }
  p { margin:0.5rem 0;font-size:0.9rem; }
  textarea { width:100%;background:#111;color:#fff;border:1px solid #555;border-radius:4px;padding:0.5rem;resize:vertical;font-family:inherit;box-sizing:border-box; }
  small { color:#888; }
  .buttons { display:flex;gap:0.5rem;margin-top:1rem;justify-content:flex-end; }
  button { padding:0.5rem 1rem;border-radius:4px;cursor:pointer;min-height:44px;min-width:44px;background:#333;color:#e0e0e0;border:1px solid #555; }
  button.primary { background:#4a9eff;color:#fff;border:none; }
  button:disabled { opacity:0.5;cursor:not-allowed; }
  .success { color:#4caf50; }
  .error { color:#f44336; }
</style>
