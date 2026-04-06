<script lang="ts">
  /**
   * AnkiImportWizard — Multi-step wizard modal for importing Anki .apkg files.
   *
   * Step 1: File upload (drag-and-drop or click)
   * Step 2: Preview parsed deck data
   * Step 3: Configure field mapping and import options
   * Step 4: Import progress and completion
   *
   * Uses static type imports from services (UI reads service APIs) and
   * dynamic value imports so the wizard works regardless of agent creation order.
   */

  import type { AnkiImportData } from '../../services/ankiService';

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

  interface Props {
    onclose: () => void
    onimport: (result: { deckId: string; deckName: string }) => void
  }

  const { onclose, onimport }: Props = $props()

  // Wizard state
  let step = $state(1)
  let file = $state<File | null>(null)
  let parseResult = $state<AnkiImportData | null>(null)
  let parsing = $state(false)
  let deckName = $state('')
  let frontFieldIndex = $state(0)
  let backFieldIndex = $state(1)
  let importScheduling = $state(false)
  let useMultipleChoice = $state(false)
  let importing = $state(false)
  let importProgress = $state(0)
  let error = $state<string | null>(null)
  let dragOver = $state(false)

  // Derived
  const primaryModel = $derived(parseResult?.models[0] ?? null)
  const fieldNames = $derived(primaryModel?.fields ?? [])
  const previewCards = $derived(parseResult?.notes.slice(0, 5) ?? [])

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleFileSelect(selected: File | null) {
    error = null
    if (!selected) return
    if (!selected.name.endsWith('.apkg')) {
      error = 'Only .apkg files are supported.'
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      error = `File is too large (${formatBytes(selected.size)}). Maximum size is 50 MB.`
      return
    }
    file = selected
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    handleFileSelect(input.files?.[0] ?? null)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave() {
    dragOver = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    handleFileSelect(e.dataTransfer?.files[0] ?? null)
  }

  function triggerFilePicker() {
    const input = document.getElementById('apkg-file-input') as HTMLInputElement
    input?.click()
  }

  async function goToStep2() {
    if (!file) return
    parsing = true
    error = null
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { parseApkg } = await import('../../services/ankiService')
      parseResult = await parseApkg(bytes)
      deckName = parseResult.deckName
      importScheduling = parseResult.hasSchedulingData
      // Default front to index 0, back to index 1 if available
      frontFieldIndex = 0
      backFieldIndex = parseResult.models[0]?.fields.length > 1 ? 1 : 0
      step = 2
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to parse .apkg file.'
    } finally {
      parsing = false
    }
  }

  async function handleImport() {
    if (!parseResult) return
    importing = true
    importProgress = 0
    error = null
    step = 4

    try {
      const { ankiToPersonalDeck } = await import('../../services/ankiService')
      const { savePersonalDeck, registerPersonalDecks, mergeReviewStates } = await import('../../services/personalDeckStore')

      importProgress = 20
      const result = ankiToPersonalDeck(parseResult, {
        deckId: `anki_${Date.now()}`,
        deckName,
        importScheduling,
        frontFieldIndex,
        backFieldIndex,
      })

      importProgress = 60
      savePersonalDeck(result.deck)

      if (importScheduling && result.reviewStates.length > 0) {
        mergeReviewStates(result.reviewStates)
      }

      importProgress = 80
      registerPersonalDecks()

      importProgress = 100
      importing = false

      // Brief pause so user sees 100%
      await new Promise(resolve => setTimeout(resolve, 400))
      onimport({ deckId: result.deck.id, deckName: result.deck.name })
    } catch (err) {
      error = err instanceof Error ? err.message : 'Import failed.'
      importing = false
      step = 3
    }
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }

  function handleModalClick(e: MouseEvent) {
    e.stopPropagation()
  }

  function handleModalKeydown(e: KeyboardEvent) {
    e.stopPropagation()
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Import Anki deck"
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
      <div class="header-left">
        <div class="modal-title">Import Anki Deck</div>
        <!-- Step indicator -->
        <div class="step-indicator" aria-label="Step {step} of 4">
          {#each [1, 2, 3, 4] as s (s)}
            <div
              class="step-dot"
              class:active={s === step}
              class:done={s < step}
              aria-hidden="true"
            ></div>
            {#if s < 4}
              <div class="step-connector" class:done={s < step} aria-hidden="true"></div>
            {/if}
          {/each}
        </div>
      </div>
      <button class="close-btn" onclick={onclose} type="button" aria-label="Close wizard">
        ✕
      </button>
    </div>

    <!-- Error banner -->
    {#if error}
      <div class="error-banner" role="alert">{error}</div>
    {/if}

    <!-- Step content -->
    <div class="modal-body">

      <!-- STEP 1: Upload -->
      {#if step === 1}
        <div class="step-content">
          <div class="step-heading">Select your .apkg file</div>

          <!-- Drop zone -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="drop-zone"
            class:drag-active={dragOver}
            class:has-file={file !== null}
            onclick={triggerFilePicker}
            onkeydown={(e) => e.key === 'Enter' && triggerFilePicker()}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            role="button"
            tabindex="0"
            aria-label="Drop .apkg file here or press Enter to browse"
          >
            {#if file}
              <div class="file-selected-info">
                <div class="file-icon">&#128196;</div>
                <div class="file-name">{file.name}</div>
                <div class="file-size">{formatBytes(file.size)}</div>
                <div class="file-change-hint">Click to change file</div>
              </div>
            {:else}
              <div class="drop-zone-hint">
                <div class="drop-icon">&#8679;</div>
                <div class="drop-primary">Drop your .apkg file here</div>
                <div class="drop-secondary">or click to browse</div>
              </div>
            {/if}
          </div>

          <input
            id="apkg-file-input"
            type="file"
            accept=".apkg"
            class="hidden-input"
            onchange={handleInputChange}
          />

          <div class="step-footer">
            <div class="footer-spacer"></div>
            <button
              class="btn-primary"
              onclick={goToStep2}
              disabled={!file || parsing}
              type="button"
            >
              {#if parsing}
                <span class="spinner" aria-hidden="true"></span> Parsing...
              {:else}
                Next &rsaquo;
              {/if}
            </button>
          </div>
        </div>

      <!-- STEP 2: Preview -->
      {:else if step === 2 && parseResult}
        <div class="step-content">
          <div class="step-heading">Deck Preview</div>

          <div class="preview-stats">
            <div class="stat-card">
              <div class="stat-value">{parseResult.totalCards.toLocaleString()}</div>
              <div class="stat-label">Cards</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{parseResult.notes.length.toLocaleString()}</div>
              <div class="stat-label">Notes</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{parseResult.models.length}</div>
              <div class="stat-label">Note Types</div>
            </div>
          </div>

          <!-- Scheduling badge -->
          <div class="badge-row">
            {#if parseResult.hasSchedulingData}
              <div class="badge badge-scheduling">Has scheduling data</div>
            {:else}
              <div class="badge badge-new">New cards only</div>
            {/if}
          </div>

          <!-- Note types -->
          {#each parseResult.models as model (model.id)}
            <div class="model-section">
              <div class="model-name">{model.name}{model.isCloze ? ' (Cloze)' : ''}</div>
              <div class="field-list">
                {#each model.fields as fieldName, i (i)}
                  <span class="field-chip">{fieldName}</span>
                {/each}
              </div>
            </div>
          {/each}

          <!-- Preview cards -->
          {#if previewCards.length > 0}
            <div class="preview-cards-heading">First {previewCards.length} notes</div>
            <div class="preview-cards">
              {#each previewCards as note, i (note.id)}
                <div class="preview-card">
                  <div class="preview-card-num">#{i + 1}</div>
                  {#each note.fields.slice(0, 3) as fieldVal, fi (fi)}
                    <div class="preview-field">
                      <span class="preview-field-label">{parseResult.models.find(m => m.id === note.modelId)?.fields[fi] ?? `Field ${fi + 1}`}:</span>
                      <span class="preview-field-val">{fieldVal.replace(/<[^>]*>/g, '').slice(0, 80)}{fieldVal.length > 80 ? '…' : ''}</span>
                    </div>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}

          <div class="step-footer">
            <button class="btn-secondary" onclick={() => step = 1} type="button">
              &lsaquo; Back
            </button>
            <button class="btn-primary" onclick={() => step = 3} type="button">
              Next &rsaquo;
            </button>
          </div>
        </div>

      <!-- STEP 3: Configure -->
      {:else if step === 3}
        <div class="step-content">
          <div class="step-heading">Configure Import</div>

          <!-- Deck name -->
          <div class="config-section">
            <label class="config-label" for="deck-name-input">Deck Name</label>
            <input
              id="deck-name-input"
              type="text"
              class="config-input"
              bind:value={deckName}
              placeholder="Enter deck name"
            />
          </div>

          <!-- Field mapping -->
          {#if fieldNames.length > 0}
            <div class="config-section">
              <div class="config-label">Field Mapping</div>
              <div class="field-map-row">
                <label class="field-map-label" for="front-field-select">Question field</label>
                <select
                  id="front-field-select"
                  class="config-select"
                  bind:value={frontFieldIndex}
                >
                  {#each fieldNames as name, i (i)}
                    <option value={i}>{name}</option>
                  {/each}
                </select>
              </div>
              <div class="field-map-row">
                <label class="field-map-label" for="back-field-select">Answer field</label>
                <select
                  id="back-field-select"
                  class="config-select"
                  bind:value={backFieldIndex}
                >
                  {#each fieldNames as name, i (i)}
                    <option value={i}>{name}</option>
                  {/each}
                </select>
              </div>
            </div>
          {/if}

          <!-- Options -->
          <div class="config-section">
            <div class="config-label">Options</div>

            <label class="checkbox-row" class:dimmed={!parseResult?.hasSchedulingData}>
              <input
                type="checkbox"
                bind:checked={importScheduling}
                disabled={!parseResult?.hasSchedulingData}
              />
              <span class="checkbox-label">
                Import scheduling data (FSRS stats)
                {#if !parseResult?.hasSchedulingData}
                  <span class="unavailable-tag">not available</span>
                {/if}
              </span>
            </label>
            <div class="checkbox-sub">Preserves your Anki review progress so you can continue where you left off.</div>

            <label class="checkbox-row" style="margin-top: calc(12px * var(--layout-scale, 1));">
              <input type="checkbox" bind:checked={useMultipleChoice} />
              <span class="checkbox-label">Use multiple choice mode</span>
            </label>
            <div class="checkbox-sub">By default, imported cards use typing mode (like Anki). Enable this for multiple choice.</div>
          </div>

          <div class="step-footer">
            <button class="btn-secondary" onclick={() => step = 2} type="button">
              &lsaquo; Back
            </button>
            <button
              class="btn-primary"
              onclick={handleImport}
              disabled={!deckName.trim()}
              type="button"
            >
              Import
            </button>
          </div>
        </div>

      <!-- STEP 4: Progress / Complete -->
      {:else if step === 4}
        <div class="step-content step-centered">
          {#if importing || importProgress < 100}
            <div class="progress-heading">Importing deck...</div>
            <div class="progress-sub">Importing {parseResult?.totalCards.toLocaleString() ?? '...'} cards</div>
            <div class="progress-track">
              <div class="progress-fill" style="width: {importProgress}%"></div>
            </div>
            <div class="progress-pct">{importProgress}%</div>
          {:else}
            <div class="success-icon" aria-hidden="true">&#10003;</div>
            <div class="success-heading">Import complete!</div>
            <div class="success-sub">
              {parseResult?.totalCards.toLocaleString() ?? 0} cards imported as "{deckName}"
            </div>
            <button class="btn-primary" onclick={onclose} type="button">
              Done
            </button>
          {/if}
        </div>
      {/if}

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
    width: calc(640px * var(--layout-scale, 1));
    max-height: 85vh;
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
    padding: calc(18px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .modal-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.3px;
  }

  /* ---- Step indicator ---- */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .step-dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }

  .step-dot.done {
    background: #8b5cf6;
  }

  .step-dot.active {
    background: #f59e0b;
    box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.6);
  }

  .step-connector {
    width: calc(24px * var(--layout-scale, 1));
    height: 1px;
    background: rgba(255, 255, 255, 0.12);
    transition: background 0.2s ease;
  }

  .step-connector.done {
    background: #8b5cf6;
  }

  /* ---- Close button ---- */
  .close-btn {
    position: absolute;
    top: calc(14px * var(--layout-scale, 1));
    right: calc(16px * var(--layout-scale, 1));
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
  }

  .close-btn:hover {
    color: #fde047;
    transform: scale(1.15);
  }

  /* ---- Error banner ---- */
  .error-banner {
    background: rgba(239, 68, 68, 0.15);
    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  /* ---- Body ---- */
  .modal-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  /* ---- Step content wrapper ---- */
  .step-content {
    padding: calc(22px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(16px * var(--layout-scale, 1));
  }

  .step-centered {
    align-items: center;
    justify-content: center;
    min-height: calc(280px * var(--layout-scale, 1));
    text-align: center;
  }

  .step-heading {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  /* ---- Drop zone ---- */
  .drop-zone {
    border: 2px dashed rgba(139, 92, 246, 0.4);
    border-radius: calc(12px * var(--layout-scale, 1));
    min-height: calc(160px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.18s ease, background 0.18s ease;
    padding: calc(24px * var(--layout-scale, 1));
  }

  .drop-zone:hover,
  .drop-zone:focus-visible {
    border-color: rgba(245, 158, 11, 0.6);
    background: rgba(245, 158, 11, 0.04);
    outline: none;
  }

  .drop-zone.drag-active {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
  }

  .drop-zone.has-file {
    border-color: rgba(139, 92, 246, 0.6);
    background: rgba(139, 92, 246, 0.06);
  }

  .drop-icon {
    font-size: calc(36px * var(--text-scale, 1));
    color: rgba(139, 92, 246, 0.5);
    line-height: 1;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .drop-zone-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .drop-primary {
    font-size: calc(15px * var(--text-scale, 1));
    color: #e2e8f0;
    font-weight: 500;
  }

  .drop-secondary {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
  }

  .file-selected-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .file-icon {
    font-size: calc(28px * var(--text-scale, 1));
    line-height: 1;
  }

  .file-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #c4b5fd;
    word-break: break-all;
    text-align: center;
  }

  .file-size {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .file-change-hint {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(245, 158, 11, 0.7);
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .hidden-input {
    display: none;
  }

  /* ---- Preview (Step 2) ---- */
  .preview-stats {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .stat-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    text-align: center;
  }

  .stat-value {
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    color: #f59e0b;
    line-height: 1.1;
  }

  .stat-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .badge-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .badge {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .badge-scheduling {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .badge-new {
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .model-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .model-name {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    color: #c4b5fd;
    margin-bottom: calc(6px * var(--layout-scale, 1));
  }

  .field-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .field-chip {
    font-size: calc(11px * var(--text-scale, 1));
    background: rgba(139, 92, 246, 0.12);
    color: #a78bfa;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
  }

  .preview-cards-heading {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .preview-cards {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .preview-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .preview-card-num {
    font-size: calc(10px * var(--text-scale, 1));
    color: #475569;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .preview-field {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    line-height: 1.4;
    margin-bottom: calc(2px * var(--layout-scale, 1));
  }

  .preview-field:last-child {
    margin-bottom: 0;
  }

  .preview-field-label {
    color: #64748b;
    flex-shrink: 0;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .preview-field-val {
    color: #cbd5e1;
    word-break: break-word;
  }

  /* ---- Configure (Step 3) ---- */
  .config-section {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(10px * var(--layout-scale, 1));
  }

  .config-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .config-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    outline: none;
    width: 100%;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  .config-input:focus {
    border-color: rgba(245, 158, 11, 0.5);
  }

  .config-select {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    outline: none;
    cursor: pointer;
    flex: 1;
  }

  .config-select:focus {
    border-color: rgba(245, 158, 11, 0.5);
  }

  .field-map-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .field-map-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    min-width: calc(110px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
  }

  .checkbox-row.dimmed {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .checkbox-row input[type="checkbox"] {
    margin-top: calc(2px * var(--layout-scale, 1));
    accent-color: #f59e0b;
    flex-shrink: 0;
    cursor: inherit;
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
  }

  .checkbox-label {
    font-size: calc(13px * var(--text-scale, 1));
    color: #e2e8f0;
    line-height: 1.3;
  }

  .unavailable-tag {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
    margin-left: calc(6px * var(--layout-scale, 1));
    font-style: italic;
  }

  .checkbox-sub {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    line-height: 1.4;
    padding-left: calc(26px * var(--layout-scale, 1));
    margin-top: calc(-2px * var(--layout-scale, 1));
  }

  /* ---- Progress (Step 4) ---- */
  .progress-heading {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 600;
    color: #e2e8f0;
  }

  .progress-sub {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
  }

  .progress-track {
    width: 100%;
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(4px * var(--layout-scale, 1));
    overflow: hidden;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #f59e0b);
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: width 0.4s ease;
  }

  .progress-pct {
    font-size: calc(14px * var(--text-scale, 1));
    color: #f59e0b;
    font-weight: 600;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .success-icon {
    font-size: calc(48px * var(--text-scale, 1));
    color: #22c55e;
    line-height: 1;
  }

  .success-heading {
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
  }

  .success-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: #64748b;
    max-width: calc(340px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  /* ---- Footer (navigation) ---- */
  .step-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: calc(8px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .footer-spacer {
    flex: 1;
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
    min-width: calc(100px * var(--layout-scale, 1));
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

  .btn-secondary:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #e2e8f0;
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
