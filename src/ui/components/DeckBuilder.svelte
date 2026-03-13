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
  import { SUPPORTED_LANGUAGES, LANGUAGE_FLAGS, type LanguageConfig } from '../../types/vocabulary'
  import DeckOptionsPanel from '../DeckOptionsPanel.svelte'
  import OverflowLabel from './OverflowLabel.svelte'
  import {
    JAPANESE_DECK_GROUPS,
    JAPANESE_KANA_SELECTION_KEY,
    getJapaneseSelectionKeys,
  } from '../../services/presetSelectionService'
  import { playerSave, persistPlayer } from '../stores/playerData'

  const MAX_PRESETS = 50
  const MAX_PRESET_NAME_LENGTH = 30
  const MIN_FAIR_POOL_SIZE = 40

  const domainMetadata: DomainMetadata[] = getAllDomainMetadata()
  const domainMetaById = new Map(domainMetadata.map((domain) => [domain.id, domain]))

  /** All non-language domains available for selection. */
  const availableDomains: DomainMetadata[] = domainMetadata.filter((d) => d.id !== 'language')

  /** Language configs for individual language cards. */
  const languageItems: { id: string; icon: string; name: string; config: LanguageConfig }[] =
    SUPPORTED_LANGUAGES.map((lang) => ({
      id: `language:${lang.code}`,
      icon: LANGUAGE_FLAGS[lang.code] ?? '🌐',
      name: lang.name,
      config: lang,
    }))

  const languageByCode = new Map(SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang]))
  const japaneseSelectionKeys = getJapaneseSelectionKeys()

  let presets = $state<StudyPreset[]>(getPresets())
  let editing = $state<StudyPreset | null>(null)
  let isCreating = $state(false)

  // Editor state
  let editorName = $state('')
  let editorSelections = $state<Record<string, string[]>>({})
  let expandedDomain = $state<string | null>(null)
  let optionsPopupLang = $state<string | null>(null)
  let subcategoryCache: Record<string, DomainSubcategoryInfo[]> = {}

  // Save enable popup state
  let showEnablePrompt = $state(false)
  let savedPresetToEnable = $state<StudyPreset | null>(null)

  const editorFactCount = $derived(getPresetFactCount(editorSelections))
  const isPoolFair = $derived(editorFactCount >= MIN_FAIR_POOL_SIZE)
  const isEditorOpen = $derived(editing !== null || isCreating)
  const activePresetId = $derived.by(() => {
    const mode = $playerSave?.activeDeckMode
    if (mode?.type === 'preset') return mode.presetId
    return null
  })

  function normalizeToken(value: string): string {
    return String(value ?? '').trim().toLowerCase()
  }

  function orderedUnique(values: string[]): string[] {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const value of values) {
      if (!value) continue
      if (seen.has(value)) continue
      seen.add(value)
      ordered.push(value)
    }
    return ordered
  }

  function normalizeJapaneseSelections(tokens: string[]): string[] {
    const set = new Set<string>()

    for (const rawToken of tokens) {
      const token = normalizeToken(rawToken)
      if (!token) continue

      if (token === JAPANESE_KANA_SELECTION_KEY) {
        set.add(JAPANESE_KANA_SELECTION_KEY)
        continue
      }

      if (token === 'vocabulary' || token === 'kanji' || token === 'grammar') {
        for (const group of JAPANESE_DECK_GROUPS) {
          set.add(`${group.level.toLowerCase()}:${token}`)
        }
        continue
      }

      const levelOnly = token.match(/^(?:jlpt[\s_-]*)?(n[1-5])$/)
      if (levelOnly?.[1]) {
        const level = normalizeToken(levelOnly[1])
        set.add(`${level}:vocabulary`)
        set.add(`${level}:kanji`)
        set.add(`${level}:grammar`)
        continue
      }

      const full = token.match(/^(?:jlpt[\s_-]*)?(n[1-5])\s*[:_-]\s*(vocabulary|kanji|grammar)$/)
      if (full?.[1] && full?.[2]) {
        set.add(`${normalizeToken(full[1])}:${normalizeToken(full[2])}`)
        continue
      }

      if (japaneseSelectionKeys.includes(token)) {
        set.add(token)
      }
    }

    if (set.size === 0) return []
    const isAllSelected = japaneseSelectionKeys.every((key) => set.has(key))
    if (isAllSelected) return []
    return japaneseSelectionKeys.filter((key) => set.has(key))
  }

  function sanitizeSelections(selections: Record<string, string[]>): Record<string, string[]> {
    const normalized: Record<string, string[]> = {}

    for (const [domainKey, values] of Object.entries(selections)) {
      const trimmedDomainKey = String(domainKey).trim()
      if (!trimmedDomainKey) continue

      if (!Array.isArray(values) || values.length === 0) {
        normalized[trimmedDomainKey] = []
        continue
      }

      const cleaned = orderedUnique(
        values
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0),
      )

      if (trimmedDomainKey === 'language:ja') {
        normalized[trimmedDomainKey] = normalizeJapaneseSelections(cleaned)
      } else {
        normalized[trimmedDomainKey] = cleaned
      }
    }

    return normalized
  }

  function getLanguageCode(domainId: string): string | null {
    if (!domainId.startsWith('language:')) return null
    const languageCode = normalizeToken(domainId.slice('language:'.length))
    return languageCode || null
  }

  function getLanguageSubcategoryTokens(domainId: string): string[] {
    const languageCode = getLanguageCode(domainId)
    if (!languageCode) return []

    if (languageCode === 'ja') {
      return japaneseSelectionKeys
    }

    const language = languageByCode.get(languageCode)
    if (!language?.subdecks || language.subdecks.length === 0) {
      return []
    }

    return orderedUnique(language.subdecks.map((token) => normalizeToken(token)).filter(Boolean))
  }

  function getDomainSelectableSubcategories(domainId: string): string[] {
    if (domainId.startsWith('language:')) {
      return getLanguageSubcategoryTokens(domainId)
    }
    return loadSubcategories(domainId).map((sub) => sub.id)
  }

  function hasSubcategoryChoices(domainId: string): boolean {
    return getDomainSelectableSubcategories(domainId).length > 0
  }

  function refreshPresets(): void {
    presets = getPresets()
  }

  function loadSubcategories(domainId: string): DomainSubcategoryInfo[] {
    if (domainId.startsWith('language:')) return []
    if (!subcategoryCache[domainId]) {
      subcategoryCache[domainId] = getDomainSubcategories(domainId as CanonicalFactDomain)
    }
    return subcategoryCache[domainId] ?? []
  }

  function startCreate(): void {
    editorName = ''
    editorSelections = {}
    expandedDomain = null
    isCreating = true
    editing = null
  }

  function startEdit(preset: StudyPreset): void {
    editorName = preset.name
    editorSelections = sanitizeSelections(JSON.parse(JSON.stringify(preset.domainSelections)))
    expandedDomain = null
    isCreating = false
    editing = preset
  }

  function cancelEdit(): void {
    editing = null
    isCreating = false
    expandedDomain = null
  }

  function savePreset(): void {
    const trimmed = editorName.trim()
    if (trimmed.length === 0) return

    try {
      const selections = sanitizeSelections(editorSelections)
      let savedPreset: StudyPreset | null = null

      if (isCreating) {
        savedPreset = createPreset(trimmed, selections)
      } else if (editing) {
        savedPreset = updatePreset(editing.id, {
          name: trimmed,
          domainSelections: selections,
        })
      }

      refreshPresets()
      cancelEdit()

      if (savedPreset) {
        savedPresetToEnable = savedPreset
        showEnablePrompt = true
      }
    } catch (err) {
      console.error('Failed to save preset:', err)
    }
  }

  function handleDelete(preset: StudyPreset): void {
    if (!confirm(`Delete preset "${preset.name}"?`)) return
    deletePreset(preset.id)
    refreshPresets()
  }

  function toggleDomain(domainId: string): void {
    if (editorSelections[domainId] !== undefined) {
      const next = { ...editorSelections }
      delete next[domainId]
      editorSelections = next
      if (expandedDomain === domainId) expandedDomain = null
    } else {
      editorSelections = { ...editorSelections, [domainId]: [] }
    }
  }

  function isDomainSelected(domainId: string): boolean {
    return editorSelections[domainId] !== undefined
  }

  function toggleExpand(domainId: string): void {
    expandedDomain = expandedDomain === domainId ? null : domainId
  }

  function toggleSubcategory(domainId: string, subId: string): void {
    const current = editorSelections[domainId]
    if (current === undefined) return

    const allTokens = getDomainSelectableSubcategories(domainId)
    if (allTokens.length === 0) return

    const normalizedAllTokens = new Set(allTokens.map((token) => normalizeToken(token)))
    const normalizedSubId = normalizeToken(subId)
    if (!normalizedAllTokens.has(normalizedSubId)) return

    const selected =
      current.length === 0
        ? new Set(normalizedAllTokens)
        : new Set(current.map((token) => normalizeToken(token)).filter(Boolean))

    if (selected.has(normalizedSubId)) {
      selected.delete(normalizedSubId)
    } else {
      selected.add(normalizedSubId)
    }

    if (selected.size === 0) {
      const next = { ...editorSelections }
      delete next[domainId]
      editorSelections = next
      if (expandedDomain === domainId) expandedDomain = null
      return
    }

    const allSelected = allTokens.every((token) => selected.has(normalizeToken(token)))
    let nextValues = allSelected
      ? []
      : allTokens.filter((token) => selected.has(normalizeToken(token)))

    if (domainId === 'language:ja') {
      nextValues = normalizeJapaneseSelections(nextValues)
    }

    editorSelections = { ...editorSelections, [domainId]: nextValues }
  }

  function isSubcategoryOn(domainId: string, subId: string): boolean {
    const current = editorSelections[domainId]
    if (current === undefined) return false
    if (current.length === 0) return true

    if (domainId === 'language:ja') {
      const normalized = new Set(normalizeJapaneseSelections(current).map((token) => normalizeToken(token)))
      return normalized.has(normalizeToken(subId))
    }

    const selected = new Set(current.map((token) => normalizeToken(token)))
    return selected.has(normalizeToken(subId))
  }

  function formatSubdeckLabel(token: string): string {
    const normalized = normalizeToken(token)
    if (normalized === 'kana') return 'Kana'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  function getDomainBadge(domainId: string): { icon: string; label: string } {
    if (domainId.startsWith('language:')) {
      const languageCode = getLanguageCode(domainId) ?? ''
      return {
        icon: LANGUAGE_FLAGS[languageCode] ?? '🌐',
        label: `Language (${languageCode.toUpperCase()})`,
      }
    }

    const meta = domainMetaById.get(domainId as CanonicalFactDomain)
    if (meta) {
      return { icon: meta.icon, label: meta.displayName }
    }

    return { icon: '📚', label: domainId }
  }

  function closeOptionsPopup(): void {
    optionsPopupLang = null
  }

  function handleOptionsBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeOptionsPopup()
    }
  }

  function handleOptionsBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      closeOptionsPopup()
    }
  }

  function enableSavedPresetNow(): void {
    const presetToEnable = savedPresetToEnable
    if (!presetToEnable) {
      showEnablePrompt = false
      return
    }

    playerSave.update((save) => {
      if (!save) return save
      return {
        ...save,
        activeDeckMode: { type: 'preset', presetId: presetToEnable.id },
      }
    })
    persistPlayer()

    showEnablePrompt = false
    savedPresetToEnable = null
  }

  function dismissEnablePrompt(): void {
    showEnablePrompt = false
    savedPresetToEnable = null
  }
</script>

<div class="deck-builder">
  {#if isEditorOpen}
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
              <div class="domain-name-wrap">
                <OverflowLabel text={domain.shortName} className="domain-name" />
              </div>
            </button>
            {#if isDomainSelected(domain.id) && hasSubcategoryChoices(domain.id)}
              <button
                class="expand-btn"
                onclick={() => toggleExpand(domain.id)}
                aria-label="Toggle subcategories for {domain.displayName}"
              >
                {expandedDomain === domain.id ? 'Hide' : 'Select Subcategories'}
              </button>
            {/if}
          </div>

          {#if expandedDomain === domain.id && isDomainSelected(domain.id)}
            <div class="subcategory-list" style="grid-column: 1 / -1;">
              {#each loadSubcategories(domain.id) as sub (sub.id)}
                <label class="sub-check">
                  <input
                    type="checkbox"
                    checked={isSubcategoryOn(domain.id, sub.id)}
                    onchange={() => toggleSubcategory(domain.id, sub.id)}
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

        <div class="section-divider" style="grid-column: 1 / -1;">
          <span class="divider-label">Language Packs</span>
        </div>

        {#each languageItems as lang (lang.id)}
          {@const canExpandLanguage = hasSubcategoryChoices(lang.id)}
          <div class="domain-toggle-card language-card" class:selected={isDomainSelected(lang.id)}>
            <div class="lang-card-top-row">
              <button
                class="domain-toggle-btn language-toggle-btn"
                onclick={() => toggleDomain(lang.id)}
                aria-pressed={isDomainSelected(lang.id)}
              >
                <span class="domain-icon">{lang.icon}</span>
                <div class="domain-name-wrap">
                  <OverflowLabel text={lang.name} className="domain-name" />
                </div>
              </button>

              {#if lang.config.options && lang.config.options.length > 0}
                <button
                  class="cogwheel-btn"
                  onclick={(event) => {
                    event.stopPropagation()
                    optionsPopupLang = lang.config.code
                  }}
                  aria-label="Display options for {lang.name}"
                >⚙️</button>
              {/if}
            </div>

            {#if isDomainSelected(lang.id) && canExpandLanguage}
              <button
                class="lang-subcategory-btn"
                onclick={() => toggleExpand(lang.id)}
                aria-label="Toggle subcategories for {lang.name}"
              >
                {expandedDomain === lang.id ? 'Hide Subcategories' : 'Subcategories'}
              </button>
            {/if}
          </div>

          {#if expandedDomain === lang.id && isDomainSelected(lang.id)}
            <div class="subcategory-list" class:japanese-subcategory-list={lang.config.code === 'ja'} style="grid-column: 1 / -1;">
              {#if lang.config.code === 'ja'}
                <label class="sub-check kana-check">
                  <input
                    type="checkbox"
                    checked={isSubcategoryOn(lang.id, JAPANESE_KANA_SELECTION_KEY)}
                    onchange={() => toggleSubcategory(lang.id, JAPANESE_KANA_SELECTION_KEY)}
                  />
                  <span>Kana</span>
                </label>

                {#each JAPANESE_DECK_GROUPS as group (group.level)}
                  <div class="jp-level-group">
                    <h5 class="jp-level-title">{group.label}</h5>
                    <div class="jp-level-subdeck-grid">
                      {#each group.keys as token (token)}
                        <label class="sub-check">
                          <input
                            type="checkbox"
                            checked={isSubcategoryOn(lang.id, token)}
                            onchange={() => toggleSubcategory(lang.id, token)}
                          />
                          <span>{formatSubdeckLabel(token.split(':')[1] ?? token)}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/each}
              {:else}
                {#each getLanguageSubcategoryTokens(lang.id) as subdeckToken (subdeckToken)}
                  <label class="sub-check">
                    <input
                      type="checkbox"
                      checked={isSubcategoryOn(lang.id, subdeckToken)}
                      onchange={() => toggleSubcategory(lang.id, subdeckToken)}
                    />
                    <span>{formatSubdeckLabel(subdeckToken)}</span>
                  </label>
                {/each}
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
          <div class="preset-card" class:active={activePresetId === preset.id}>
            <div class="preset-header">
              <strong class="preset-name">{preset.name}</strong>
              <span class="preset-facts">{preset.cachedFactCount} facts</span>
            </div>
            <div class="preset-domains">
              {#each Object.keys(preset.domainSelections) as domainId}
                {@const badge = getDomainBadge(domainId)}
                <span class="domain-badge" title={badge.label}>{badge.icon}</span>
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

  {#if optionsPopupLang}
    <div
      class="options-popup-backdrop"
      role="button"
      tabindex="0"
      onclick={handleOptionsBackdropClick}
      onkeydown={handleOptionsBackdropKeydown}
    >
      <div class="options-popup">
        <div class="options-popup-header">
          <h4>Display Options</h4>
          <button class="options-close-btn" onclick={closeOptionsPopup}>✕</button>
        </div>
        <DeckOptionsPanel languageCode={optionsPopupLang} />
      </div>
    </div>
  {/if}

  {#if showEnablePrompt && savedPresetToEnable}
    <div class="enable-popup-backdrop" role="dialog" aria-modal="true" aria-label="Enable deck prompt">
      <div class="enable-popup">
        <h4>Enable this deck now?</h4>
        <p>
          <strong>{savedPresetToEnable.name}</strong> will become your active deck for the next run.
        </p>
        <div class="enable-popup-actions">
          <button class="action-btn cancel-btn" onclick={dismissEnablePrompt}>Not Now</button>
          <button class="action-btn save-btn" onclick={enableSavedPresetNow}>Enable Deck</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .deck-builder {
    display: grid;
    gap: 12px;
    padding: 4px 0;
  }

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

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #8b949e;
    font-size: 14px;
    line-height: 1.5;
  }

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

  .preset-card.active {
    border-color: #16a34a;
    box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.25) inset;
  }

  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .preset-name {
    font-size: 15px;
    color: #e6edf3;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preset-facts {
    font-size: 12px;
    color: #8b949e;
    flex-shrink: 0;
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

  .action-btn {
    min-height: 42px;
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
    min-width: 0;
  }

  .domain-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .domain-name-wrap {
    min-width: 0;
    flex: 1;
  }

  :global(.domain-name) {
    color: inherit;
    font-size: 13px;
    font-weight: 600;
  }

  .language-card {
    flex-direction: column;
    padding: 0;
  }

  .language-toggle-btn {
    width: auto;
    flex: 1;
  }

  .lang-card-top-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding-right: 8px;
  }

  .lang-subcategory-btn {
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
    font-size: 11px;
    cursor: pointer;
    min-height: 32px;
    text-align: left;
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

  .cogwheel-btn {
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 8px;
    font-size: 15px;
    min-height: 28px;
    padding: 0 8px;
    cursor: pointer;
    line-height: 1;
    -webkit-tap-highlight-color: transparent;
  }

  .subcategory-list {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    padding: 10px 12px;
    display: grid;
    gap: 6px;
  }

  .japanese-subcategory-list {
    gap: 10px;
  }

  .kana-check {
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .jp-level-group {
    display: grid;
    gap: 6px;
  }

  .jp-level-title {
    margin: 0;
    font-size: 12px;
    color: #f8fafc;
    letter-spacing: 0.2px;
  }

  .jp-level-subdeck-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 8px;
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

  .editor-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .section-divider {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 4px;
  }

  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(148, 163, 184, 0.2);
  }

  .divider-label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .options-popup-backdrop,
  .enable-popup-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .options-popup,
  .enable-popup {
    background: #0f1729;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 14px;
    padding: 16px;
    width: 100%;
    max-width: 360px;
  }

  .options-popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .options-popup-header h4,
  .enable-popup h4 {
    margin: 0;
    font-size: 14px;
    color: #e2e8f0;
  }

  .enable-popup p {
    margin: 10px 0 0;
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.4;
  }

  .enable-popup-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .options-close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
  }

  @media (max-width: 520px) {
    .domain-grid {
      grid-template-columns: 1fr;
    }

    .jp-level-subdeck-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
