<script lang="ts">
  export let onClose: (() => void) | undefined = undefined
  export let onSubmit: ((data: { factText: string; correctAnswer: string; distractors: string[]; category: string; sourceUrl: string }) => void) | undefined = undefined

  let factText = ''
  let correctAnswer = ''
  let distractors = ['', '', '']
  let category = 'General Knowledge'
  let sourceUrl = ''
  let sourceName = ''
  let licenseConsented = false
  let submitting = false
  let error = ''

  const categories = ['General Knowledge', 'Biology', 'Geography', 'History', 'Physics', 'Chemistry', 'Astronomy', 'Geology']

  function addDistractor(): void {
    if (distractors.length < 5) {
      distractors = [...distractors, '']
    }
  }

  function updateDistractor(index: number, value: string): void {
    distractors[index] = value
    distractors = distractors  // trigger reactivity
  }

  function removeDistractor(index: number): void {
    if (distractors.length > 3) {
      distractors = distractors.filter((_, i) => i !== index)
    }
  }

  async function handleSubmit(): Promise<void> {
    error = ''
    const filledDistractors = distractors.filter(d => d.trim().length > 0)
    if (!factText.trim()) { error = 'Fact text is required'; return }
    if (!correctAnswer.trim()) { error = 'Correct answer is required'; return }
    if (filledDistractors.length < 3) { error = 'At least 3 distractors required'; return }
    if (!sourceUrl.trim()) { error = 'Source URL is required for verification'; return }
    if (!sourceName.trim()) { error = 'Source name is required for verification'; return }
    if (!licenseConsented) { error = 'You must agree to the CC BY 4.0 license to submit'; return }

    submitting = true
    try {
      if (onSubmit) {
        onSubmit({ factText: factText.trim(), correctAnswer: correctAnswer.trim(), distractors: filledDistractors, category, sourceUrl: sourceUrl.trim() })
      }
    } finally {
      submitting = false
    }
  }
</script>

<div class="ugc-overlay" role="dialog" aria-label="Submit a Fact">
  <div class="ugc-form">
    <div class="ugc-header">
      <h2>Submit a Fact</h2>
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    </div>
    <p class="ugc-intro">As an Omniscient, you can contribute facts to the community. All submissions are reviewed before going live.</p>

    <label class="field-label">
      Fact / Question
      <textarea bind:value={factText} placeholder="Write a clear, factual statement or question..." maxlength="500" rows="3"></textarea>
    </label>

    <label class="field-label">
      Correct Answer
      <input type="text" bind:value={correctAnswer} placeholder="The correct answer" maxlength="200" />
    </label>

    <div class="field-label">
      Distractors (wrong answers)
      {#each distractors as d, i}
        <div class="distractor-row">
          <input type="text" value={d} on:input={(e) => updateDistractor(i, e.currentTarget.value)} placeholder="Distractor {i + 1}" maxlength="200" />
          {#if distractors.length > 3}
            <button class="remove-d" on:click={() => removeDistractor(i)} aria-label="Remove">&times;</button>
          {/if}
        </div>
      {/each}
      {#if distractors.length < 5}
        <button class="add-d" on:click={addDistractor}>+ Add distractor</button>
      {/if}
    </div>

    <label class="field-label">
      Category
      <select bind:value={category}>
        {#each categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </label>

    <label class="field-label">
      Source URL
      <input type="url" bind:value={sourceUrl} placeholder="https://..." maxlength="500" />
      <span class="hint">A verifiable source for this fact</span>
    </label>

    <label class="field-label">
      Source Name
      <input type="text" bind:value={sourceName} placeholder="e.g. NASA, Wikipedia, NIST" maxlength="200" />
    </label>

    <label class="consent-row">
      <input
        type="checkbox"
        bind:checked={licenseConsented}
        aria-required="true"
      />
      <span>
        I license this submission under
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">
          CC BY 4.0
        </a>.
        I confirm this fact is factually accurate and the source URL is valid.
      </span>
    </label>

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <button
      class="submit-btn"
      disabled={!licenseConsented || submitting}
      on:click={handleSubmit}
    >
      {submitting ? 'Submitting...' : 'Submit Fact'}
    </button>
  </div>
</div>

<style>
  .ugc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
    overflow-y: auto;
    padding: 20px;
  }
  .ugc-form {
    background: #16213e;
    border-radius: 10px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    border: 1px solid #0f3460;
  }
  .ugc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .ugc-header h2 {
    font-family: var(--font-rpg);
    font-size: 13px;
    color: #e94560;
    margin: 0;
  }
  .close-x {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }
  .ugc-intro {
    color: #a0a0a0;
    font-size: 12px;
    margin: 0 0 16px;
    line-height: 1.5;
  }
  .field-label {
    display: block;
    color: #ccc;
    font-size: 12px;
    margin-bottom: 12px;
    font-weight: bold;
  }
  textarea, input[type="text"], input[type="url"], select {
    display: block;
    width: 100%;
    background: #0f3460;
    border: 1px solid #1a3a6e;
    color: #e0e0e0;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  textarea { resize: vertical; }
  select { cursor: pointer; }
  .distractor-row {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .distractor-row input { flex: 1; }
  .remove-d {
    background: #e94560;
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    align-self: center;
  }
  .add-d {
    background: none;
    border: 1px dashed #1a3a6e;
    color: #e94560;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 6px;
    width: 100%;
  }
  .hint {
    color: #666;
    font-size: 10px;
    font-weight: normal;
    margin-top: 2px;
    display: block;
  }
  .error-msg {
    color: #e94560;
    font-size: 11px;
    margin: 8px 0;
  }
  .consent-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin: 12px 0;
    cursor: pointer;
  }
  .consent-row input[type="checkbox"] {
    width: auto;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .consent-row span {
    color: #a0a0a0;
    font-size: 11px;
    line-height: 1.5;
    font-weight: normal;
  }
  .consent-row a {
    color: #e94560;
  }
  .submit-btn {
    display: block;
    width: 100%;
    background: #e94560;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 11px;
    cursor: pointer;
    margin-top: 16px;
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
