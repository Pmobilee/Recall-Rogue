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
  import { getDomainSubcategories } from '../../services/domainSubcategoryService'
  import {
    getMasteredFactCount,
    getUnlockedLoreFragments,
    syncLoreUnlock,
    type LoreFragment,
  } from '../../services/loreService'
  import { playerSave } from '../stores/playerData'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

  let loading = $state(true)
  let allFacts = $state<Fact[]>([])
  let activeTab = $state<FactDomain | null>(null)
  let selectedEntry = $state<LibraryFactEntry | null>(null)
  let selectedSubcategory = $state<string | null>(null)
  let tierFilter = $state<LibraryTierFilter>('all')
  let sortBy = $state<LibrarySortBy>('tier')
  let loreFragments = $state<LoreFragment[]>([])
  let activeLore = $state<LoreFragment | null>(null)
  let latestLoreUnlocks = $state<LoreFragment[]>([])
  let syncAnchor = $state(-1)
  let searchQuery = $state('')
  let sidebarCollapsed = $state(false)

  const reviewStates = $derived($playerSave?.reviewStates ?? [])
  const masteredCount = $derived(getMasteredFactCount(reviewStates))

  const domainSummaries = $derived(
    loading ? [] : buildDomainSummaries(allFacts, reviewStates),
  )

  const domainSubcategories = $derived(
    activeTab ? getDomainSubcategories(activeTab) : [],
  )

  /** Category list for the sidebar */
  const categoryList = $derived.by(() => {
    const summaries = domainSummaries.filter(s => s.totalFacts > 0)
    const result: Array<{ id: FactDomain | null; label: string; count: number }> = [
      { id: null, label: 'All', count: allFacts.length },
    ]
    for (const s of summaries) {
      result.push({
        id: s.domain,
        label: getDomainMetadata(s.domain).shortName,
        count: s.totalFacts,
      })
    }
    return result
  })

  /** All domain entries, combining domains for the "All" tab */
  const allDomainEntries = $derived.by((): LibraryFactEntry[] => {
    if (loading) return []
    if (activeTab) {
      return buildDomainEntries(activeTab, allFacts, reviewStates, tierFilter, sortBy, selectedSubcategory ?? undefined)
    }
    // "All" tab: combine entries across every domain that has facts
    const domains = domainSummaries.filter(s => s.totalFacts > 0).map(s => s.domain)
    const combined: LibraryFactEntry[] = []
    for (const d of domains) {
      combined.push(...buildDomainEntries(d, allFacts, reviewStates, tierFilter, sortBy))
    }
    return combined
  })

  const filteredDomainEntries = $derived(
    searchQuery.trim()
      ? allDomainEntries.filter(e => {
          const q = searchQuery.toLowerCase().trim()
          return e.fact.statement.toLowerCase().includes(q)
            || e.fact.correctAnswer.toLowerCase().includes(q)
            || (e.fact.quizQuestion && e.fact.quizQuestion.toLowerCase().includes(q))
        })
      : allDomainEntries
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

  $effect(() => {
    if (loading) return
    if (syncAnchor === masteredCount) return
    syncAnchor = masteredCount

    const { newlyUnlocked } = syncLoreUnlock(masteredCount)
    latestLoreUnlocks = newlyUnlocked
    loreFragments = getUnlockedLoreFragments()
  })

  function handleSidebarTab(id: FactDomain | null): void {
    activeTab = id
    selectedSubcategory = null
    selectedEntry = null
    searchQuery = ''
  }

  function handleBack(): void {
    if (selectedEntry) {
      selectedEntry = null
    } else {
      onback()
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (selectedEntry) {
        selectedEntry = null
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

<div class="library-screen" onkeydown={handleKeydown} role="presentation">
  <!-- Header bar -->
  <header class="header">
    <button class="back-btn" onclick={handleBack}>&larr;</button>
    <h1 class="title">LIBRARY</h1>
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
    <span class="mastery-badge">{masteredCount} mastered</span>
  </header>

  <!-- Body: sidebar + content -->
  <div class="body-layout">
    <aside class="sidebar" class:collapsed={sidebarCollapsed}>
      <button
        class="sidebar-toggle"
        class:breathing={sidebarCollapsed}
        onclick={() => { sidebarCollapsed = !sidebarCollapsed }}
        type="button"
      >
        <span class="toggle-arrow" class:collapsed-arrow={sidebarCollapsed}>
          {sidebarCollapsed ? '▶' : '◀'}
        </span>
      </button>
      {#if !sidebarCollapsed}
        <nav class="sidebar-categories">
          {#each categoryList as cat (cat.id ?? '__all__')}
            <button
              class="sidebar-item"
              class:active={activeTab === cat.id}
              onclick={() => handleSidebarTab(cat.id)}
              type="button"
            >
              <span class="sidebar-label">{cat.label}</span>
              <span class="sidebar-count">{cat.count}</span>
            </button>
          {/each}
        </nav>
      {/if}
    </aside>

    <div class="main-content">
      {#if selectedEntry}
        <!-- Detail view -->
        <section class="detail-card">
          <div class="detail-back-row">
            <button class="detail-back-btn" onclick={() => { selectedEntry = null }} type="button">
              &larr; Back
            </button>
          </div>
          <h3 class="detail-title">{selectedEntry.fact.statement}</h3>
          <p class="detail-domain">{labelDomain(activeTab ?? 'natural_sciences')}</p>

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
      {:else}
        <!-- Subcategory chips when a domain is selected and has subcategories -->
        {#if activeTab && domainSubcategories.length > 1}
          <div class="subcategory-bar">
            <button
              class="sub-chip"
              class:active={selectedSubcategory === null}
              onclick={() => { selectedSubcategory = null }}
              type="button"
            >All</button>
            {#each domainSubcategories as sub (sub.id)}
              <button
                class="sub-chip"
                class:active={selectedSubcategory === sub.id}
                onclick={() => { selectedSubcategory = sub.id }}
                type="button"
              >{sub.name} <span class="sub-count">({sub.count})</span></button>
            {/each}
          </div>
        {/if}

        <!-- Lore section visible in "All" tab -->
        {#if activeTab === null && !loading}
          {#if latestLoreUnlocks.length > 0}
            <div class="lore-unlock-banner">
              New Lore Unlocked: {latestLoreUnlocks.map((l) => l.title).join(', ')}
            </div>
          {/if}
          {#if loreFragments.length > 0}
            <div class="lore-grid">
              {#each loreFragments as lore}
                <button class="lore-card" onclick={() => (activeLore = lore)} type="button">
                  <strong>{lore.title}</strong>
                  <span>Unlocked at {lore.unlockThreshold} mastered</span>
                </button>
              {/each}
            </div>
          {/if}
        {/if}

        <!-- Fact count summary -->
        <div class="fact-summary">
          {#if loading}
            Loading facts...
          {:else}
            {filteredDomainEntries.length} fact{filteredDomainEntries.length !== 1 ? 's' : ''}
            {#if searchQuery}
              <span class="summary-filter-note">(filtered)</span>
            {/if}
          {/if}
        </div>

        <!-- Scrollable fact grid -->
        <div class="fact-scroll">
          <div class="fact-grid">
            {#each filteredDomainEntries as entry (entry.fact.id)}
              <button class="fact-row" onclick={() => (selectedEntry = entry)} type="button">
                <div class="fact-title">{entry.fact.statement}</div>
                <div class="fact-meta">{accuracyText(entry)}</div>
              </button>
            {/each}
            {#if !loading && filteredDomainEntries.length === 0}
              <div class="empty-state">
                <p class="empty-title">{searchQuery ? 'No matching facts' : 'No facts yet'}</p>
                <p class="empty-sub">{searchQuery ? 'Try a different search term' : 'Play runs to encounter facts in this domain.'}</p>
              </div>
            {/if}
          </div>
        </div>
        <div class="scroll-fade" aria-hidden="true"></div>
      {/if}
    </div>
  </div>

  <!-- Lore modal -->
  {#if activeLore}
    <div class="lore-modal" role="dialog" aria-modal="true">
      <article>
        <h3>{activeLore.title}</h3>
        <p>{activeLore.body}</p>
        <button class="close-btn" onclick={() => (activeLore = null)} type="button">Close</button>
      </article>
    </div>
  {/if}
</div>

<style>
  /* ── Root container ── */

  .library-screen {
    position: fixed;
    inset: 0;
    z-index: 260;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, #0a0e1a 0%, #1a1035 50%, #0a0e1a 100%);
    color: #e0e0e0;
  }

  /* ── Header ── */

  .header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(10, 14, 26, 0.98) 0%, rgba(26, 16, 53, 0.92) 100%);
    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    flex-shrink: 0;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #8b949e;
    font-size: calc(16px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    white-space: nowrap;
    flex-shrink: 0;
    min-width: calc(28px * var(--layout-scale, 1));
    min-height: calc(28px * var(--layout-scale, 1));
  }

  .back-btn:hover {
    color: #c9d1d9;
  }

  .title {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #818cf8;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;
    margin-right: calc(4px * var(--layout-scale, 1));
  }

  /* Search bar in header */

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    max-width: calc(400px * var(--layout-scale, 1));
  }

  .search-input {
    width: 100%;
    min-height: calc(34px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    padding: 0 calc(32px * var(--layout-scale, 1)) 0 calc(10px * var(--layout-scale, 1));
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
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1));
    line-height: 1;
  }

  .search-clear:hover {
    color: #e2e8f0;
  }

  /* Filter dropdowns */

  .filter-label {
    display: grid;
    gap: calc(2px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    flex-shrink: 0;
  }

  .filter-label select {
    min-height: calc(32px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid #334155;
    background: #0f172a;
    color: #e2e8f0;
    padding: 0 calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-family: inherit;
  }

  .mastery-badge {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* ── Body: sidebar + main content ── */

  .body-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Sidebar ── */

  .sidebar {
    display: flex;
    flex-direction: column;
    width: calc(200px * var(--layout-scale, 1));
    flex-shrink: 0;
    background: rgba(10, 14, 26, 0.6);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: calc(36px * var(--layout-scale, 1));
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: calc(32px * var(--layout-scale, 1));
    background: none;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: #64748b;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s;
    padding-left: calc(12px * var(--layout-scale, 1));
  }

  .sidebar-toggle:hover {
    color: #e2e8f0;
  }

  .toggle-arrow {
    transition: color 0.15s;
  }

  .collapsed-arrow {
    animation: breathe-gold 2s ease-in-out infinite;
  }

  @keyframes breathe-gold {
    0%, 100% { color: rgba(255, 215, 0, 0.35); }
    50% { color: rgba(255, 215, 0, 1); }
  }

  .sidebar-toggle.breathing:hover .toggle-arrow {
    animation: none;
    color: #ffd700;
  }

  .sidebar-categories {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
    padding: calc(4px * var(--layout-scale, 1)) 0;
    scrollbar-width: none;
  }

  .sidebar-categories::-webkit-scrollbar {
    display: none;
  }

  .sidebar-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    border-left: calc(3px * var(--layout-scale, 1)) solid transparent;
    color: rgba(255, 255, 255, 0.22);
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    font-family: 'Cinzel', Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    text-align: left;
    white-space: nowrap;
  }

  .sidebar-item:hover:not(.active) {
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.02);
  }

  .sidebar-item.active {
    color: rgba(255, 255, 255, 0.65);
    background: rgba(99, 102, 241, 0.08);
    border-left-color: #818cf8;
  }

  .sidebar-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-count {
    font-size: calc(11px * var(--text-scale, 1));
    font-family: inherit;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.4;
    flex-shrink: 0;
    margin-left: calc(8px * var(--layout-scale, 1));
  }

  .sidebar-item.active .sidebar-count {
    opacity: 0.6;
  }

  /* ── Main content area ── */

  .main-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    position: relative;
  }

  /* ── Subcategory chips ── */

  .subcategory-bar {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sub-chip {
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid #475569;
    background: #1e293b;
    color: #e2e8f0;
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    min-height: calc(32px * var(--layout-scale, 1));
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

  /* ── Lore section (All tab only) ── */

  .lore-unlock-banner {
    margin: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) 0;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #fbbf24;
    flex-shrink: 0;
  }

  .lore-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(200px * var(--layout-scale, 1)), 1fr));
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) 0;
    flex-shrink: 0;
  }

  .lore-card {
    border: 1px solid #334155;
    border-radius: calc(10px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    text-align: left;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    font-family: inherit;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: border-color 0.12s, background 0.12s;
  }

  .lore-card:hover {
    border-color: #fbbf24;
    background: rgba(15, 23, 42, 0.95);
  }

  .lore-card strong {
    display: block;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .lore-card span {
    display: block;
    margin-top: calc(4px * var(--layout-scale, 1));
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
  }

  /* ── Fact summary count ── */

  .fact-summary {
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #4b5563;
    flex-shrink: 0;
  }

  .summary-filter-note {
    color: #6366f1;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  /* ── Scrollable fact area ── */

  .fact-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    position: relative;
  }

  .scroll-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(80px * var(--layout-scale, 1));
    background: linear-gradient(transparent, rgba(10, 14, 26, 0.95));
    pointer-events: none;
    z-index: 2;
  }

  .fact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(300px * var(--layout-scale, 1)), 1fr));
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    padding-bottom: calc(96px * var(--layout-scale, 1));
    align-content: start;
  }

  @media (max-width: 400px) {
    .fact-grid {
      grid-template-columns: 1fr;
    }
  }

  .fact-row {
    border: 1px solid #334155;
    border-radius: calc(10px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    text-align: left;
    min-height: calc(56px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s ease, transform 0.12s ease, background 0.12s ease;
  }

  .fact-row:hover {
    border-color: #4b5563;
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
    background: rgba(15, 23, 42, 0.95);
  }

  .fact-title {
    font-size: calc(13px * var(--text-scale, 1));
    line-height: 1.35;
  }

  .fact-meta {
    margin-top: calc(6px * var(--layout-scale, 1));
    color: #64748b;
    font-size: calc(11px * var(--text-scale, 1));
  }

  /* ── Empty state ── */

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(60px * var(--layout-scale, 1));
  }

  .empty-title {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .empty-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: #4b5563;
    margin: 0;
    text-align: center;
  }

  /* ── Detail view (fact clicked) ── */

  .detail-card {
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1));
    overflow-y: auto;
    flex: 1;
  }

  .detail-back-row {
    display: flex;
    align-items: center;
  }

  .detail-back-btn {
    background: none;
    border: 1px solid #334155;
    color: #94a3b8;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s, color 0.12s;
    min-height: calc(36px * var(--layout-scale, 1));
  }

  .detail-back-btn:hover {
    border-color: #64748b;
    color: #e2e8f0;
  }

  .detail-title {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    color: #f1f5f9;
    line-height: 1.3;
  }

  .detail-domain {
    margin: 0;
    color: #818cf8;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    background: rgba(15, 23, 42, 0.5);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .detail-card h4 {
    margin: 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .variant-list {
    margin: 0;
    padding-left: calc(18px * var(--layout-scale, 1));
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
    color: #dbeafe;
    font-size: calc(12px * var(--text-scale, 1));
  }

  /* ── Lore modal ── */

  .lore-modal {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 14, 0.78);
    display: grid;
    place-items: center;
    padding: calc(16px * var(--layout-scale, 1));
    z-index: 270;
  }

  .lore-modal article {
    width: min(calc(520px * var(--layout-scale, 1)), 100%);
    border-radius: calc(14px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: #0f172a;
    padding: calc(20px * var(--layout-scale, 1));
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
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

  .close-btn {
    border: 1px solid #475569;
    background: #1e293b;
    color: #e2e8f0;
    min-height: calc(40px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: 0 calc(16px * var(--layout-scale, 1));
    cursor: pointer;
    font-family: inherit;
    font-size: calc(13px * var(--text-scale, 1));
    justify-self: start;
    transition: border-color 0.12s, background 0.12s;
  }

  .close-btn:hover {
    border-color: #64748b;
    background: #334155;
  }
</style>
