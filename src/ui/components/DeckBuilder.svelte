<script lang="ts">
  import {
    getPresets,
    createPreset,
    updatePreset,
    deletePreset,
    getPresetFactCount,
  } from '../../services/studyPresetService'
  import { getDomainSubcategories } from '../../services/domainSubcategoryService'
  import { getAllDomainMetadata } from '../../data/domainMetadata'
  import type { StudyPreset } from '../../data/studyPreset'
  import type { DomainMetadata } from '../../data/domainMetadata'
  import type { DomainSubcategoryInfo } from '../../services/domainSubcategoryService'
  import type { CanonicalFactDomain } from '../../data/card-types'

  /** Inline constants matching studyPresetService (balance.ts exports are pending). */
  const MAX_PRESETS = 10
  const MAX_PRESET_NAME_LENGTH = 30
  const MIN_FAIR_POOL_SIZE = 40

  /** All non-language, non-comingSoon domains available for selection. */
  const availableDomains: DomainMetadata[] = getAllDomainMetadata().filter(
    (d) => d.id !== 'language' && !d.comingSoon,
  )

  let presets = $state<StudyPreset[]>(getPresets())
  let editing = $state<StudyPreset | null>(null)
  let isCreating = $state(false)

  // Editor state
  let editorName = $state('')
  let editorSelections = $state<Record<string, string[]>>({})
  let expandedDomain = $state<string | null>(null)
  let subcategoryCache = $state<Record<string, DomainSubcategoryInfo[]>>({})

  /** Reactive fact count based on current editor selections. */
  const editorFactCount = $derived(getPresetFactCount(editorSelections))
  const isPoolFair = $derived(editorFactCount >= MIN_FAIR_POOL_SIZE)
  const isEditorOpen = $derived(editing !== null || isCreating)

  /** Refresh presets from the save store. */
  function refreshPresets(): void {
    presets = getPresets()
  }

  /** Load subcategories for a domain (cached). */
  function loadSubcategories(domainId: string): DomainSubcategoryInfo[] {
    if (!subcategoryCache[domainId]) {
      subcategoryCache[domainId] = getDomainSubcategories(domainId as CanonicalFactDomain)
    }
    return subcategoryCache[domainId] ?? []
  }

  /** Open the editor for a new preset. */
  function startCreate(): void {
    editorName = ''
    editorSelections = {}
    expandedDomain = null
    isCreating = true
    editing = null
  }

  /** Open the editor for an existing preset. */
  function startEdit(preset: StudyPreset): void {
    editorName = preset.name
    editorSelections = JSON.parse(JSON.stringify(preset.domainSelections))
    expandedDomain = null
    isCreating = false
    editing = preset
  }

  /** Cancel editing. */
  function cancelEdit(): void {
    editing = null
    isCreating = false
  }

  /** Save the current editor state. */
  function savePreset(): void {
    const trimmed = editorName.trim()
    if (trimmed.length === 0) return

    try {
      if (isCreating) {
        createPreset(trimmed, editorSelections)
      } else if (editing) {
        updatePreset(editing.id, {
          name: trimmed,
          domainSelections: editorSelections,
        })
      }
      refreshPresets()
      cancelEdit()
    } catch (err) {
      console.error('Failed to save preset:', err)
    }
  }

  /** Delete a preset with confirmation. */
  function handleDelete(preset: StudyPreset): void {
    if (!confirm(`Delete preset "${preset.name}"?`)) return
    deletePreset(preset.id)
    refreshPresets()
  }

  /** Toggle a domain on/off in the editor. */
  function toggleDomain(domainId: string): void {
    if (editorSelections[domainId] !== undefined) {
      const next = { ...editorSelections }
      delete next[domainId]
      editorSelections = next
    } else {
      editorSelections = { ...editorSelections, [domainId]: [] }
    }
  }

  /** Check if a domain is selected. */
  function isDomainSelected(domainId: string): boolean {
    return editorSelections[domainId] !== undefined
  }

  /** Toggle expand/collapse for subcategory list. */
  function toggleExpand(domainId: string): void {
    expandedDomain = expandedDomain === domainId ? null : domainId
  }

  /** Toggle a subcategory within a domain. */
  function toggleSubcategory(domainId: string, subName: string): void {
    const subs = loadSubcategories(domainId)
    const current = editorSelections[domainId]
    if (current === undefined) return

    if (current.length === 0) {
      // Currently "all" — switch to all-except-this-one
      const allNames = subs.map((s) => s.name).filter((n) => n !== subName)
      editorSelections = { ...editorSelections, [domainId]: allNames }
    } else {
      const isOn = current.includes(subName)
      if (isOn) {
        const filtered = current.filter((n) => n !== subName)
        if (filtered.length === 0) {
          // No subcategories left — remove domain entirely
          const next = { ...editorSelections }
          delete next[domainId]
          editorSelections = next
        } else {
          editorSelections = { ...editorSelections, [domainId]: filtered }
        }
      } else {
        const updated = [...current, subName]
        // If all subcategories are selected, switch to empty array (all)
        if (updated.length >= subs.length) {
          editorSelections = { ...editorSelections, [domainId]: [] }
        } else {
          editorSelections = { ...editorSelections, [domainId]: updated }
        }
      }
    }
  }

  /** Check if a subcategory is currently enabled. */
  function isSubcategoryOn(domainId: string, subName: string): boolean {
    const current = editorSelections[domainId]
    if (current === undefined) return false
    if (current.length === 0) return true // empty = all
    return current.includes(subName)
  }
</script>

<div class="deck-builder">
  {#if isEditorOpen}
    <!-- Preset Editor -->
    <div class="editor-section">
      <h3 class="editor-title">{isCreating ? 'Create Preset' : 'Edit Preset'}</h3>

      <label class="name-label">
        Name
        <input
          type="text"
          class="name-input"
          maxlength={MAX_PRESET_NAME_LENGTH}
          placeholder="e.g. Science + History"
          bind:value={editorName}
        />
        <span class="char-count">{editorName.length}/{MAX_PRESET_NAME_LENGTH}</span>
      </label>

      <div class="fact-count-bar" class:unfair={!isPoolFair}>
        <span class="fact-count-number">{editorFactCount}</span> facts available
      </div>
      {#if !isPoolFair && editorFactCount > 0}
        <p class="warning-text">Too few facts — no loot or leaderboard score for runs with this preset</p>
      {/if}

      <h4 class="section-heading">Domains</h4>
      <div class="domain-grid">
        {#each availableDomains as domain (domain.id)}
          <div class="domain-toggle-card" class:selected={isDomainSelected(domain.id)}>
            <button
              class="domain-toggle-btn"
              onclick={() => toggleDomain(domain.id)}
              aria-pressed={isDomainSelected(domain.id)}
            >
              <span class="domain-icon">{domain.icon}</span>
              <span class="domain-name">{domain.shortName}</span>
            </button>
            {#if isDomainSelected(domain.id)}
              <button
                class="expand-btn"
                onclick={() => toggleExpand(domain.id)}
                aria-label="Toggle subcategories for {domain.displayName}"
              >
                {expandedDomain === domain.id ? 'Hide' : 'Subs'}
              </button>
            {/if}
          </div>

          {#if expandedDomain === domain.id && isDomainSelected(domain.id)}
            <div class="subcategory-list" style="grid-column: 1 / -1;">
              {#each loadSubcategories(domain.id) as sub (sub.name)}
                <label class="sub-check">
                  <input
                    type="checkbox"
                    checked={isSubcategoryOn(domain.id, sub.name)}
                    onchange={() => toggleSubcategory(domain.id, sub.name)}
                  />
                  <span>{sub.name} ({sub.count})</span>
                </label>
              {/each}
              {#if loadSubcategories(domain.id).length === 0}
                <p class="empty-subs">No subcategories found</p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>

      <div class="editor-actions">
        <button class="action-btn cancel-btn" onclick={cancelEdit}>Cancel</button>
        <button
          class="action-btn save-btn"
          onclick={savePreset}
          disabled={editorName.trim().length === 0}
        >Save</button>
      </div>
    </div>
  {:else}
    <!-- Preset List -->
    {#if presets.length < MAX_PRESETS}
      <button class="create-btn" onclick={startCreate}>+ Create New Preset</button>
    {/if}

    {#if presets.length === 0}
      <div class="empty-state">
        <p>No presets yet. Create one to customize your study sessions.</p>
      </div>
    {:else}
      <div class="preset-list">
        {#each presets as preset (preset.id)}
          <div class="preset-card">
            <div class="preset-header">
              <strong class="preset-name">{preset.name}</strong>
              <span class="preset-facts">{preset.cachedFactCount} facts</span>
            </div>
            <div class="preset-domains">
              {#each Object.keys(preset.domainSelections) as domId}
                {@const meta = getAllDomainMetadata().find((d) => d.id === domId)}
                {#if meta}
                  <span class="domain-badge" title={meta.displayName}>{meta.icon}</span>
                {/if}
              {/each}
            </div>
            <div class="preset-actions">
              <button class="action-btn edit-btn" onclick={() => startEdit(preset)}>Edit</button>
              <button class="action-btn delete-btn" onclick={() => handleDelete(preset)}>Delete</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .deck-builder {
    display: grid;
    gap: 12px;
    padding: 4px 0;
  }

  /* Create button */
  .create-btn {
    width: 100%;
    min-height: 48px;
    border: 1px dashed rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    background: rgba(30, 45, 61, 0.5);
    color: #16a34a;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #8b949e;
    font-size: 14px;
    line-height: 1.5;
  }

  /* Preset list */
  .preset-list {
    display: grid;
    gap: 10px;
  }

  .preset-card {
    background: #1e2d3d;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    padding: 12px;
    display: grid;
    gap: 8px;
  }

  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preset-name {
    font-size: 15px;
    color: #e6edf3;
  }

  .preset-facts {
    font-size: 12px;
    color: #8b949e;
  }

  .preset-domains {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .domain-badge {
    font-size: 18px;
  }

  .preset-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Action buttons */
  .action-btn {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    padding: 0 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .edit-btn {
    background: #1e2d3d;
    color: #e6edf3;
  }

  .delete-btn {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .save-btn {
    background: #16a34a;
    color: #fff;
    border-color: #16a34a;
    flex: 1;
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: #1e2d3d;
    color: #e6edf3;
    flex: 1;
  }

  /* Editor */
  .editor-section {
    display: grid;
    gap: 12px;
  }

  .editor-title {
    margin: 0;
    font-size: 18px;
    color: #e6edf3;
  }

  .name-label {
    display: grid;
    gap: 6px;
    font-size: 12px;
    color: #8b949e;
  }

  .name-input {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: #0d1117;
    color: #e6edf3;
    padding: 0 12px;
    font-size: 15px;
  }

  .char-count {
    text-align: right;
    font-size: 11px;
    color: #8b949e;
  }

  .fact-count-bar {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(22, 163, 74, 0.15);
    color: #16a34a;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
  }

  .fact-count-bar.unfair {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .fact-count-number {
    font-size: 20px;
  }

  .warning-text {
    margin: 0;
    font-size: 12px;
    color: #ef4444;
    text-align: center;
    line-height: 1.4;
  }

  .section-heading {
    margin: 8px 0 0;
    font-size: 14px;
    color: #8b949e;
  }

  /* Domain grid */
  .domain-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .domain-toggle-card {
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    background: #1e2d3d;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .domain-toggle-card.selected {
    border-color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
  }

  .domain-toggle-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: #e6edf3;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .domain-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .domain-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .expand-btn {
    padding: 4px 12px 8px;
    background: none;
    border: none;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    color: #8b949e;
    font-size: 11px;
    cursor: pointer;
    min-height: 28px;
  }

  /* Subcategory list */
  .subcategory-list {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    padding: 10px 12px;
    display: grid;
    gap: 6px;
  }

  .sub-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #e6edf3;
    min-height: 36px;
    cursor: pointer;
  }

  .sub-check input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #16a34a;
    flex-shrink: 0;
  }

  .empty-subs {
    margin: 0;
    color: #8b949e;
    font-size: 12px;
  }

  /* Editor actions */
  .editor-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
</style>
