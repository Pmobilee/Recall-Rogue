<script lang="ts">
  import { onMount } from 'svelte'
  import type { FactDomain } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import type { Fact } from '../../data/types'
  import { factsDB } from '../../services/factsDB'
  import {
    buildDomainEntries,
    buildDomainSummaries,
    type LibraryFactEntry,
    type LibrarySortBy,
    type LibraryTierFilter,
  } from '../../services/libraryService'
  import { getDomainSubcategories, type DomainSubcategoryInfo } from '../../services/domainSubcategoryService'
  import {
    getMasteredFactCount,
    getUnlockedLoreFragments,
    syncLoreUnlock,
    type LoreFragment,
  } from '../../services/loreService'
  import { playerSave } from '../stores/playerData'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

  let loading = $state(true)
  let allFacts = $state<Fact[]>([])
  let selectedDomain = $state<FactDomain | null>(null)
  let selectedEntry = $state<LibraryFactEntry | null>(null)
  let selectedSubcategory = $state<string | null>(null)
  let tierFilter = $state<LibraryTierFilter>('all')
  let sortBy = $state<LibrarySortBy>('tier')
  let loreFragments = $state<LoreFragment[]>([])
  let activeLore = $state<LoreFragment | null>(null)
  let latestLoreUnlocks = $state<LoreFragment[]>([])
  let syncAnchor = $state(-1)
  let searchQuery = $state('')

  const reviewStates = $derived($playerSave?.reviewStates ?? [])
  const masteredCount = $derived(getMasteredFactCount(reviewStates))

  const domainSummaries = $derived(
    loading ? [] : buildDomainSummaries(allFacts, reviewStates),
  )

  const domainSubcategories = $derived(
    selectedDomain ? getDomainSubcategories(selectedDomain) : [],
  )

  const domainEntries = $derived(
    loading || !selectedDomain
      ? []
      : buildDomainEntries(selectedDomain, allFacts, reviewStates, tierFilter, sortBy, selectedSubcategory ?? undefined),
  )

  const filteredDomainEntries = $derived(
    searchQuery.trim()
      ? domainEntries.filter(e => {
          const q = searchQuery.toLowerCase().trim()
          return e.fact.statement.toLowerCase().includes(q)
            || e.fact.correctAnswer.toLowerCase().includes(q)
            || (e.fact.quizQuestion && e.fact.quizQuestion.toLowerCase().includes(q))
        })
      : domainEntries
  )

  function labelDomain(domain: FactDomain): string {
    return getDomainMetadata(domain).displayName
  }

  function progressColor(percent: number): string {
    if (percent >= 75) return '#f59e0b'
    if (percent >= 50) return '#22c55e'
    if (percent >= 25) return '#facc15'
    return '#ef4444'
  }

  function accuracyText(entry: LibraryFactEntry): string {
    if (!entry.state) return 'Unseen'
    return `${entry.accuracy}% accuracy`
  }

  function variantPreview(entry: LibraryFactEntry): string[] {
    const fact = entry.fact
    return [
      fact.quizQuestion,
      `Which prompt maps to "${fact.correctAnswer}"?`,
      `Fill in the blank: ${fact.statement.replace(fact.correctAnswer, '_____')}`,
    ]
  }

  function formatDate(value: number | undefined): string {
    if (!value || value <= 0) return 'Not scheduled'
    return new Date(value).toLocaleDateString()
  }

  const DOMAIN_ACCENT_COLORS: Record<string, string> = {
    general: '#94a3b8',
    natural_sciences: '#4a9eff',
    space: '#8b5cf6',
    geography: '#22c55e',
    capitals: '#f59e0b',
    history: '#a16207',
    mythology: '#7c3aed',
    animals: '#ea580c',
    health: '#e11d48',
    cuisine: '#d97706',
    art: '#9333ea',
    language: '#0d9488',
  }

  function domainAccentColor(domain: FactDomain): string {
    return DOMAIN_ACCENT_COLORS[domain] ?? '#94a3b8'
  }

  $effect(() => {
    if (loading) return
    if (syncAnchor === masteredCount) return
    syncAnchor = masteredCount

    const { newlyUnlocked } = syncLoreUnlock(masteredCount)
    latestLoreUnlocks = newlyUnlocked
    loreFragments = getUnlockedLoreFragments()
  })

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (selectedEntry) {
        selectedEntry = null
      } else if (selectedDomain) {
        selectedDomain = null
        selectedSubcategory = null
        searchQuery = ''
      } else {
        onback()
      }
    }
  }

  onMount(() => {
    let active = true

    if (factsDB.isReady()) {
      allFacts = factsDB.getAll()
      loreFragments = getUnlockedLoreFragments()
      loading = false
      return
    }

    const load = async (): Promise<void> => {
      await factsDB.init()
      if (!active) return
      allFacts = factsDB.getAll()
      loreFragments = getUnlockedLoreFragments()
      loading = false
    }

    load().catch(() => {
      if (!active) return
      loading = false
    })

    return () => {
      active = false
    }
  })
</script>

<div class="library-overlay" class:landscape={$isLandscape} onkeydown={handleKeydown} role="presentation">
  <div class="library-topbar">
    {#if selectedEntry}
      <button class="back-btn" onclick={() => (selectedEntry = null)}>Back</button>
    {:else if selectedDomain}
      <button class="back-btn" onclick={() => { selectedDomain = null; selectedSubcategory = null; searchQuery = ''; }}>Back</button>
    {:else}
      <button class="back-btn" onclick={onback}>Back</button>
    {/if}
    <h2>Library</h2>
    {#if !selectedDomain && !selectedEntry && !loading}
      <span class="mastery-inline">{masteredCount} mastered</span>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Loading facts...</div>
  {:else if selectedEntry}
    <section class="detail-card">
      <h3>{selectedEntry.fact.statement}</h3>
      <p class="detail-domain">{labelDomain(selectedDomain ?? 'natural_sciences')}</p>

      <div class="detail-grid">
        <div><strong>Attempts:</strong> {selectedEntry.state?.totalAttempts ?? 0}</div>
        <div><strong>Correct:</strong> {selectedEntry.state?.totalCorrect ?? 0}</div>
        <div><strong>Avg RT:</strong> {Math.round((selectedEntry.state?.averageResponseTimeMs ?? 0) / 100) / 10}s</div>
        <div><strong>Stability:</strong> {Math.round((selectedEntry.state?.stability ?? 0) * 10) / 10}d</div>
        <div><strong>Difficulty:</strong> {Math.round((selectedEntry.state?.difficulty ?? 0) * 10) / 10}/10</div>
        <div><strong>Next Review:</strong> {formatDate(selectedEntry.state?.due)}</div>
      </div>

      <h4>Question Variants</h4>
      <ul class="variant-list">
        {#each variantPreview(selectedEntry) as variant}
          <li>{variant}</li>
        {/each}
      </ul>

      {#if selectedEntry.state?.tierHistory && selectedEntry.state.tierHistory.length > 0}
        <h4>Tier History</h4>
        <ul class="variant-list">
          {#each selectedEntry.state.tierHistory as item}
            <li>{item.from} -> {item.to} ({formatDate(item.date)})</li>
          {/each}
        </ul>
      {/if}
    </section>
  {:else if selectedDomain}
    <section class="domain-section">
      <div class="domain-header">
        <h3 class="domain-header-title">{getDomainMetadata(selectedDomain).displayName}</h3>
        {#if domainSubcategories.length > 1}
          <div class="subcategory-bar">
            <button
              class="sub-chip"
              class:active={selectedSubcategory === null}
              onclick={() => { selectedSubcategory = null }}
            >All</button>
            {#each domainSubcategories as sub (sub.id)}
              <button
                class="sub-chip"
                class:active={selectedSubcategory === sub.id}
                onclick={() => { selectedSubcategory = sub.id }}
              >{sub.name} <span class="sub-count">({sub.count})</span></button>
            {/each}
          </div>
        {/if}
        <span class="domain-header-count">{filteredDomainEntries.length}{searchQuery.trim() ? ` of ${domainEntries.length}` : ''}</span>
      </div>

      <div class="domain-controls">
        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            placeholder="Search facts..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button class="search-clear" onclick={() => { searchQuery = '' }}>✕</button>
          {/if}
        </div>

        <label class="filter-label">
          Tier
          <select bind:value={tierFilter}>
            <option value="all">All</option>
            <option value="1">Learning</option>
            <option value="2a">Proven</option>
            <option value="2b">Proven+</option>
            <option value="3">Mastered</option>
            <option value="unseen">Unseen</option>
          </select>
        </label>

        <label class="filter-label">
          Sort
          <select bind:value={sortBy}>
            <option value="tier">Tier</option>
            <option value="name">Name</option>
            <option value="accuracy">Accuracy</option>
            <option value="lastReview">Last Review</option>
          </select>
        </label>
      </div>

      <div class="fact-list">
        {#each filteredDomainEntries as entry (entry.fact.id)}
          <button class="fact-row" onclick={() => (selectedEntry = entry)}>
            <div class="fact-title">{entry.fact.statement}</div>
            <div class="fact-meta">{accuracyText(entry)}</div>
          </button>
        {/each}
      </div>
    </section>
  {:else}
    <section class="summary-section">
      <div class="mastery-strip">
        <strong>Mastered Facts:</strong> {masteredCount}
      </div>

      {#if latestLoreUnlocks.length > 0}
        <div class="lore-unlock">
          New Lore Unlocked: {latestLoreUnlocks.map((entry) => entry.title).join(', ')}
        </div>
      {/if}

      {#if loreFragments.length > 0}
        <div class="lore-grid">
          {#each loreFragments as lore}
            <button class="lore-card" onclick={() => (activeLore = lore)}>
              <strong>{lore.title}</strong>
              <span>Unlocked at {lore.unlockThreshold} mastered</span>
            </button>
          {/each}
        </div>
      {/if}

      <h3 class="domain-heading">Knowledge Domains</h3>

      <div class="domain-grid">
        {#each domainSummaries.filter(s => s.totalFacts > 0) as summary}
          <button class="domain-card" data-domain={summary.domain} style="--domain-accent: {domainAccentColor(summary.domain)}" onclick={() => { selectedDomain = summary.domain; selectedSubcategory = null; }}>
            <div class="domain-row">
              <div class="domain-row-left">
                <span class="domain-icon">{getDomainMetadata(summary.domain).icon}</span>
                <strong>{getDomainMetadata(summary.domain).shortName}</strong>
              </div>
              <span>{summary.tier3Count}/{summary.totalFacts}</span>
            </div>
            <div class="progress-bg">
              <div
                class="progress-fill"
                style="width: {summary.completionPercent}%; background: {progressColor(summary.completionPercent)}"
              ></div>
            </div>
            <div class="domain-meta">
              Completion {summary.completionPercent}% • Mastery {summary.masteryPercent}%
            </div>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if activeLore}
    <div class="lore-modal" role="dialog" aria-modal="true">
      <article>
        <h3>{activeLore.title}</h3>
        <p>{activeLore.body}</p>
        <button class="close-btn" onclick={() => (activeLore = null)}>Close</button>
      </article>
    </div>
  {/if}
</div>

<style>
  .library-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(180deg, #081225 0%, #121f33 100%);
    color: #e2e8f0;
    z-index: 260;
    padding: calc(14px * var(--layout-scale, 1));
    overflow: auto;
  }

  .library-topbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) 0;
    background: #081225;
    z-index: 2;
  }

  h2 {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
  }

  .back-btn,
  .close-btn {
    border: 1px solid #475569;
    background: #1e293b;
    color: #e2e8f0;
    min-height: calc(48px * var(--layout-scale, 1));
    border-radius: 10px;
    padding: 0 calc(14px * var(--layout-scale, 1));
  }

  .loading {
    margin-top: calc(20px * var(--layout-scale, 1));
    color: #cbd5e1;
  }

  .summary-section,
  .domain-section,
  .detail-card {
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
    margin-top: calc(12px * var(--layout-scale, 1));
  }

  .mastery-strip,
  .lore-unlock {
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 12px;
    padding: calc(12px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .lore-grid,
  .fact-list {
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(240px * var(--layout-scale, 1)), 1fr));
    gap: calc(10px * var(--layout-scale, 1));
  }

  .domain-heading {
    margin: 0;
    font-size: calc(15px * var(--text-scale, 1));
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .lore-card,
  .fact-row {
    border: 1px solid #334155;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    text-align: left;
    min-height: calc(48px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
  }

  .domain-card {
    border: 1px solid #334155;
    border-left: calc(3px * var(--layout-scale, 1)) solid var(--domain-accent, #94a3b8);
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    text-align: left;
    min-height: calc(48px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .domain-card:hover {
    border-color: var(--domain-accent, #94a3b8);
    transform: translateY(calc(-2px * var(--layout-scale, 1)));
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  .lore-card span {
    display: block;
    margin-top: calc(6px * var(--layout-scale, 1));
    color: #bfdbfe;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .domain-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: calc(13px * var(--text-scale, 1));
  }

  .domain-row-left {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .domain-icon {
    font-size: calc(20px * var(--text-scale, 1));
  }

  .progress-bg {
    height: calc(12px * var(--layout-scale, 1));
    margin-top: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 6px;
    min-width: calc(2px * var(--layout-scale, 1));
  }

  .domain-meta,
  .fact-meta {
    margin-top: calc(8px * var(--layout-scale, 1));
    color: #bfdbfe;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .fact-title {
    font-size: calc(13px * var(--text-scale, 1));
    line-height: 1.35;
  }

  .domain-controls {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    align-items: flex-end;
  }

  .domain-controls .search-bar {
    flex: 1;
  }

  .filter-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .filter-label {
    display: grid;
    gap: calc(4px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  label {
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  select {
    min-height: calc(40px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid #334155;
    background: #0f172a;
    color: #e2e8f0;
    padding: 0 calc(8px * var(--layout-scale, 1));
  }

  .detail-card {
    background: rgba(15, 23, 42, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 14px;
    padding: calc(12px * var(--layout-scale, 1));
  }

  .detail-card h3 {
    margin: 0;
    font-size: calc(16px * var(--text-scale, 1));
  }

  .detail-domain {
    margin: 0;
    color: #bfdbfe;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .variant-list {
    margin: 0;
    padding-left: calc(18px * var(--layout-scale, 1));
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
    color: #dbeafe;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .lore-modal {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 14, 0.78);
    display: grid;
    place-items: center;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .lore-modal article {
    width: min(calc(520px * var(--layout-scale, 1)), 100%);
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: #0f172a;
    padding: calc(14px * var(--layout-scale, 1));
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .lore-modal h3 {
    margin: 0;
    color: #fbbf24;
    font-size: calc(18px * var(--text-scale, 1));
  }

  .lore-modal p {
    margin: 0;
    color: #e2e8f0;
    line-height: 1.5;
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* ── Domain Header ── */

  .domain-header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding-bottom: calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .domain-header-title {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    color: #f1f5f9;
    flex: 1;
  }

  .domain-header-count {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
  }

  /* ── Subcategory Chips ── */

  .subcategory-bar {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) 0;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .sub-chip {
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid #475569;
    background: #1e293b;
    color: #e2e8f0;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    min-height: calc(36px * var(--layout-scale, 1));
    display: inline-flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .sub-chip:hover:not(.active) {
    border-color: #64748b;
    color: #f1f5f9;
    background: #334155;
  }

  .sub-chip.active {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
  }

  .sub-count {
    opacity: 0.7;
    font-size: calc(11px * var(--text-scale, 1));
  }

  /* ── Search Bar ── */

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    min-height: calc(40px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    padding: 0 calc(36px * var(--layout-scale, 1)) 0 calc(12px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-input:focus {
    border-color: #3b82f6;
  }

  .search-input::placeholder {
    color: #475569;
  }

  .search-clear {
    position: absolute;
    right: calc(8px * var(--layout-scale, 1));
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1));
    line-height: 1;
  }

  .search-clear:hover {
    color: #e2e8f0;
  }

  /* Hidden in portrait, shown in landscape via :global override */
  .mastery-inline {
    display: none;
  }

  /* ── Landscape Styles ── */

  .library-overlay.landscape {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow-x: hidden;
    overflow-y: auto;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
  }

  .library-overlay.landscape .library-topbar {
    position: static;
  }

  /* Wider domain grid in landscape: 4 columns */
  .library-overlay.landscape .domain-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  /* Fact list as 2-column grid in landscape */
  .library-overlay.landscape .fact-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* Lore grid with more columns in landscape */
  .library-overlay.landscape .lore-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* Content area scrollable in landscape */
  .library-overlay.landscape .summary-section,
  .library-overlay.landscape .domain-section,
  .library-overlay.landscape .detail-card {
    overflow-y: auto;
    max-height: calc(100vh - calc(140px * var(--layout-scale, 1)));
  }

  /* Wider subcategory bar in landscape */
  .library-overlay.landscape .subcategory-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: calc(4px * var(--layout-scale, 1));
  }

  /* Detail card two-column in landscape */
  .library-overlay.landscape .detail-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .library-overlay.landscape .detail-card h3 {
    grid-column: 1 / -1;
  }

  .library-overlay.landscape .detail-card .detail-domain {
    grid-column: 1 / -1;
  }

  .library-overlay.landscape .detail-card h4 {
    grid-column: 1 / -1;
  }

  .library-overlay.landscape .detail-card .detail-grid {
    grid-column: 1 / -1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  :global([data-layout="landscape"]) .library-overlay {
    max-width: calc(1400px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
  }

  /* Fix header: heading left-aligned, not pushed to far right */
  :global([data-layout="landscape"]) .library-overlay .library-topbar {
    justify-content: flex-start;
    gap: calc(16px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .library-overlay .library-topbar h2 {
    font-size: calc(22px * var(--text-scale, 1));
    font-family: 'Cinzel', serif;
    letter-spacing: 0.04em;
  }

  /* Mastery count inline next to heading in the topbar */
  :global([data-layout="landscape"]) .library-overlay .library-topbar .mastery-inline {
    display: inline;
    font-size: calc(14px * var(--text-scale, 1));
    color: #94a3b8;
    align-self: center;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  /* Content section starts immediately after topbar with only ~24px gap */
  :global([data-layout="landscape"]) .library-overlay .summary-section,
  :global([data-layout="landscape"]) .library-overlay .domain-section,
  :global([data-layout="landscape"]) .library-overlay .detail-card {
    margin-top: calc(24px * var(--layout-scale, 1));
  }

  /* Domain card: left accent border via CSS variable */
  :global([data-layout="landscape"]) .library-overlay .domain-card {
    border-left: calc(4px * var(--layout-scale, 1)) solid var(--domain-accent, #94a3b8);
    border-top: 1px solid #334155;
    border-right: 1px solid #334155;
    border-bottom: 1px solid #334155;
    transition: border-color 0.15s ease, filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }

  :global([data-layout="landscape"]) .library-overlay .domain-card:hover {
    border-left-color: #f59e0b;
    filter: brightness(1.1);
    transform: translateY(calc(-2px * var(--layout-scale, 1)));
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  /* Domain name: 16px */
  :global([data-layout="landscape"]) .library-overlay .domain-row strong {
    font-size: calc(16px * var(--text-scale, 1));
  }

  /* Fact count next to domain name: 14px */
  :global([data-layout="landscape"]) .library-overlay .domain-row span {
    font-size: calc(14px * var(--text-scale, 1));
  }

  /* Completion/mastery meta text: 13px */
  :global([data-layout="landscape"]) .library-overlay .domain-meta,
  :global([data-layout="landscape"]) .library-overlay .fact-meta {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* "Mastered Facts" strip text: 15px */
  :global([data-layout="landscape"]) .library-overlay .mastery-strip {
    font-size: calc(15px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .library-overlay .lore-unlock {
    font-size: calc(15px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .library-overlay .fact-title {
    font-size: calc(16px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .library-overlay label {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Domain header landscape: slightly larger title */
  :global([data-layout="landscape"]) .library-overlay .domain-header-title {
    font-size: calc(20px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .library-overlay .domain-header-count {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Search bar landscape: slightly larger */
  :global([data-layout="landscape"]) .library-overlay .search-input {
    font-size: calc(14px * var(--text-scale, 1));
  }

</style>
