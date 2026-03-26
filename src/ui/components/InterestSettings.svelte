<script lang="ts">
  import { interestConfig, saveInterestConfig } from '../stores/settings'
  import { CATEGORIES } from '../../data/types'
  import {
    createDefaultInterestConfig,
    countActiveInterests,
    MAX_INTEREST_CATEGORIES,
    type InterestConfig,
  } from '../../data/interestConfig'
  import { getInferenceTransparencySummary } from '../../services/behavioralLearner'
  import { playerSave } from '../stores/playerData'

  let { onBack }: { onBack: () => void } = $props()

  let config: InterestConfig = $state(structuredClone($interestConfig))

  let activeCount = $derived(countActiveInterests(config))

  let preview = $derived(
    CATEGORIES.map(cat => {
      const entry = config.categories.find(c => c.category === cat)
      const w = entry ? entry.weight / 100 : 0
      const mult = 1.0 + w
      return { cat, mult }
    })
  )

  let totalMult = $derived(preview.reduce((s, m) => s + m.mult, 0))

  let previewPcts = $derived(
    preview.map(m => ({ cat: m.cat, pct: Math.round((m.mult / totalMult) * 100) }))
  )

  let inferenceSummary = $derived(getInferenceTransparencySummary(config))

  let hasFocusCrystal = $derived(
    ($playerSave?.purchasedKnowledgeItems ?? []).includes('category_lock')
  )

  function toggleCategory(cat: string) {
    const idx = config.categories.findIndex(c => c.category === cat)
    if (idx === -1) return
    const current = config.categories[idx].weight
    if (current === 0) {
      if (activeCount >= MAX_INTEREST_CATEGORIES) return
      config.categories[idx] = { ...config.categories[idx], weight: 50 }
    } else {
      config.categories[idx] = { ...config.categories[idx], weight: 0, subcategoryWeights: {} }
    }
    config = { ...config }
  }

  function setWeight(cat: string, value: number) {
    const idx = config.categories.findIndex(c => c.category === cat)
    if (idx === -1) return
    config.categories[idx] = { ...config.categories[idx], weight: Math.max(1, Math.min(100, value)) }
    config = { ...config }
  }

  function resetToDefaults() {
    config = createDefaultInterestConfig()
  }

  function applyAndClose() {
    saveInterestConfig(config)
    onBack()
  }

  const CATEGORY_ICONS: Record<string, string> = {
    'Language': 'Aa',
    'Natural Sciences': 'NS',
    'Life Sciences': 'LS',
    'History': 'Hi',
    'Geography': 'Ge',
    'Technology': 'Te',
    'Culture': 'Cu',
  }
</script>

<div class="interest-settings">
  <header class="header">
    <button class="back-btn" onclick={onBack} aria-label="Back">&larr;</button>
    <h1>Interest Settings</h1>
    <div class="spacer"></div>
  </header>

  <div class="scroll-content">
    <h2 class="section-title">What do you want to learn?</h2>
    <p class="hint">Select up to {MAX_INTEREST_CATEGORIES} categories to focus on.</p>

    <div class="category-chips">
      {#each CATEGORIES as cat}
        {@const entry = config.categories.find(c => c.category === cat)}
        {@const isActive = (entry?.weight ?? 0) > 0}
        {@const isDisabled = !isActive && activeCount >= MAX_INTEREST_CATEGORIES}
        <button
          class="chip"
          class:active={isActive}
          class:dimmed={isDisabled}
          disabled={isDisabled}
          onclick={() => toggleCategory(cat)}
        >
          <span class="chip-icon">{CATEGORY_ICONS[cat] ?? '?'}</span>
          <span class="chip-label">{cat}</span>
        </button>
      {/each}
    </div>

    {#each config.categories.filter(c => c.weight > 0) as entry}
      <div class="slider-group">
        <div class="slider-label" id="slider-label-{entry.category}">
          {entry.category}
          <span class="weight-value">{entry.weight}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          value={entry.weight}
          oninput={(e) => setWeight(entry.category, parseInt(e.currentTarget.value))}
          aria-labelledby="slider-label-{entry.category}"
          class="weight-slider"
        />
        <div class="slider-labels">
          <span>Mild Interest</span>
          <span>Strong Focus</span>
        </div>
      </div>
    {/each}

    <section class="preview-section">
      <h3>Distribution Preview</h3>
      <div class="preview-bars">
        {#each previewPcts as item}
          <div class="bar-row">
            <span class="bar-label">{item.cat}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {item.pct}%"></div>
            </div>
            <span class="bar-pct">{item.pct}%</span>
          </div>
        {/each}
      </div>
    </section>

    <section class="behavioral-section">
      <label class="toggle-row">
        <input
          type="checkbox"
          bind:checked={config.behavioralLearningEnabled}
          onchange={() => { config = { ...config } }}
        />
        <span>Let GAIA learn my preferences</span>
      </label>
      <p class="hint">GAIA observes your study habits and gently adjusts what appears. You control the final say.</p>
    </section>

    {#if config.behavioralLearningEnabled && inferenceSummary.length > 0}
      <section class="gaia-inference">
        <h3>GAIA thinks you like...</h3>
        <p class="hint">Based on your study habits and artifact choices.</p>
        {#each inferenceSummary as item}
          <div class="inference-row">
            <span class="inf-label">{item.category}</span>
            <div class="inf-bar">
              <div class="inf-fill" style="width: {item.boostPercent}%"></div>
            </div>
            <span class="inf-pct">{item.boostPercent}%</span>
          </div>
        {/each}
        <p class="hint">Added to your manual settings, capped at 30% extra.</p>
      </section>
    {/if}

    {#if hasFocusCrystal}
      <section class="lock-section">
        <h3>Focus Crystal</h3>
        {#if config.categoryLock}
          <p>Locked to: <strong>{config.categoryLock.join(' > ')}</strong></p>
          <label class="toggle-row">
            <input type="checkbox" bind:checked={config.categoryLockActive} onchange={() => { config = { ...config } }} />
            <span>Category Lock Active</span>
          </label>
        {:else}
          <p class="hint">No focus selected. Configure in the Knowledge Store.</p>
        {/if}
      </section>
    {/if}

    <div class="actions">
      <button class="btn-reset" onclick={resetToDefaults}>Reset to Defaults</button>
      <button class="btn-save" onclick={applyAndClose}>Save &amp; Close</button>
    </div>
  </div>
</div>

<style>
  .interest-settings {
    position: fixed;
    inset: 0;
    background: #0a0a1a;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    font-family: var(--font-rpg);
    z-index: 200;
    overflow: hidden;
    pointer-events: auto;
  }
  .header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: #12122a;
    border-bottom: 1px solid #2a2a4a;
    gap: 8px;
  }
  .header h1 {
    font-size: 0.85rem;
    margin: 0;
    flex: 1;
    text-align: center;
  }
  .back-btn {
    background: none;
    border: none;
    color: #4ecca3;
    font-size: 1.2rem;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
  }
  .spacer {
    width: 44px;
  }
  .scroll-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .section-title {
    font-size: 0.8rem;
    color: #4ecca3;
    margin: 0;
  }
  .hint {
    font-size: 0.6rem;
    color: #888;
    margin: 0;
    line-height: 1.4;
  }
  .category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid #3a3a5a;
    background: #1a1a2e;
    color: #ccc;
    cursor: pointer;
    min-height: 44px;
    font-family: inherit;
    font-size: 0.6rem;
    transition: all 0.15s;
  }
  .chip:hover:not(:disabled) {
    border-color: #4ecca3;
  }
  .chip.active {
    background: #1a3a2e;
    border-color: #4ecca3;
    color: #4ecca3;
  }
  .chip.dimmed {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .chip-icon {
    font-size: 0.7rem;
    font-weight: bold;
  }
  .slider-group {
    background: #12122a;
    border-radius: 8px;
    padding: 12px;
  }
  .slider-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    margin-bottom: 6px;
  }
  .weight-value {
    color: #4ecca3;
  }
  .weight-slider {
    width: 100%;
    accent-color: #4ecca3;
  }
  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.5rem;
    color: #666;
    margin-top: 2px;
  }
  .preview-section {
    background: #12122a;
    border-radius: 8px;
    padding: 12px;
  }
  .preview-section h3 {
    font-size: 0.65rem;
    color: #4ecca3;
    margin: 0 0 8px 0;
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .bar-label {
    font-size: 0.5rem;
    width: 90px;
    text-align: right;
    color: #999;
  }
  .bar-track {
    flex: 1;
    height: 8px;
    background: #1a1a2e;
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: #4ecca3;
    border-radius: 4px;
    transition: width 0.2s;
  }
  .bar-pct {
    font-size: 0.5rem;
    width: 30px;
    text-align: right;
    color: #888;
  }
  .behavioral-section,
  .gaia-inference,
  .lock-section {
    background: #12122a;
    border-radius: 8px;
    padding: 12px;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.6rem;
    min-height: 44px;
    cursor: pointer;
  }
  .toggle-row input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #4ecca3;
  }
  .gaia-inference h3,
  .lock-section h3 {
    font-size: 0.65rem;
    color: #4ecca3;
    margin: 0 0 8px 0;
  }
  .inference-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .inf-label {
    font-size: 0.5rem;
    width: 90px;
    text-align: right;
    color: #999;
  }
  .inf-bar {
    flex: 1;
    height: 6px;
    background: #1a1a2e;
    border-radius: 3px;
    overflow: hidden;
  }
  .inf-fill {
    height: 100%;
    background: #e8a838;
    border-radius: 3px;
  }
  .inf-pct {
    font-size: 0.5rem;
    width: 30px;
    text-align: right;
    color: #888;
  }
  .actions {
    display: flex;
    gap: 12px;
    padding: 8px 0 24px 0;
  }
  .btn-reset,
  .btn-save {
    flex: 1;
    min-height: 44px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.6rem;
    cursor: pointer;
  }
  .btn-reset {
    background: #2a2a3a;
    color: #ccc;
  }
  .btn-save {
    background: #4ecca3;
    color: #0a0a1a;
    font-weight: bold;
  }
</style>
