<script lang="ts">
  import { onMount } from 'svelte'
  import type { FactDomain } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import type { Fact } from '../../data/types'
  import { factsDB } from '../../services/factsDB'
  import { getTierDisplayName } from '../../services/tierDerivation'
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
  import DeckBuilder from './DeckBuilder.svelte'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    onback: () => void
    initialTab?: 'knowledge' | 'deckbuilder'
  }

  let { onback, initialTab }: Props = $props()

  let activeTab = $state<'knowledge' | 'deckbuilder'>(initialTab ?? 'knowledge')

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

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (selectedEntry) {
        selectedEntry = null
      } else if (selectedDomain) {
        selectedDomain = null
        selectedSubcategory = null
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
    {#if activeTab === 'knowledge' && selectedEntry}
      <button class="back-btn" onclick={() => (selectedEntry = null)}>Back</button>
    {:else if activeTab === 'knowledge' && selectedDomain}
      <button class="back-btn" onclick={() => { selectedDomain = null; selectedSubcategory = null; }}>Back</button>
    {:else}
      <button class="back-btn" onclick={onback}>Back</button>
    {/if}
    <h2>Library</h2>
  </div>

  <div class="library-tabs">
    <button
      class="tab-btn"
      class:active={activeTab === 'knowledge'}
      onclick={() => { activeTab = 'knowledge'; selectedDomain = null; selectedEntry = null; }}
    >Knowledge</button>
    <button
      class="tab-btn"
      class:active={activeTab === 'deckbuilder'}
      onclick={() => { activeTab = 'deckbuilder'; selectedDomain = null; selectedEntry = null; }}
    >Deck Builder</button>
  </div>

  {#if activeTab === 'deckbuilder'}
    <DeckBuilder />
  {:else if loading}
    <div class="loading">Loading facts...</div>
  {:else if selectedEntry}
    <section class="detail-card">
      <h3>{selectedEntry.fact.statement}</h3>
      <p class="detail-domain">{labelDomain(selectedDomain ?? 'natural_sciences')}</p>

      <div class="detail-grid">
        <div><strong>Tier:</strong> {getTierDisplayName(selectedEntry.tier)}</div>
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

      <div class="filters">
        <label>
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

        <label>
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
        {#each domainEntries as entry (entry.fact.id)}
          <button class="fact-row" onclick={() => (selectedEntry = entry)}>
            <div class="fact-title">{entry.fact.statement}</div>
            <div class="fact-meta">{getTierDisplayName(entry.tier)} • {accuracyText(entry)}</div>
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

      <div class="domain-grid">
        {#each domainSummaries as summary}
          <button class="domain-card" onclick={() => { selectedDomain = summary.domain; selectedSubcategory = null; }}>
            <div class="domain-row">
              <strong>{getDomainMetadata(summary.domain).shortName}</strong>
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
    background: linear-gradient(180deg, #081225, rgba(8, 18, 37, 0.9));
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
    min-height: 48px;
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
  .domain-grid,
  .fact-list {
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .lore-card,
  .domain-card,
  .fact-row {
    border: 1px solid #334155;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    text-align: left;
    min-height: 48px;
    padding: calc(12px * var(--layout-scale, 1));
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
    min-width: 2px;
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

  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
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

  .library-tabs {
    display: flex;
    gap: 0;
    width: 100%;
    max-width: calc(520px * var(--layout-scale, 1));
    margin: 0 auto calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
  }

  .tab-btn {
    flex: 1;
    padding: calc(10px * var(--layout-scale, 1));
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #8b949e;
    font-size: calc(14px * var(--layout-scale, 1));
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    white-space: nowrap;
  }

  .tab-btn.active {
    color: #e6edf3;
    border-bottom-color: #16a34a;
  }

  .subcategory-bar {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) 0;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .sub-chip {
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(30, 41, 59, 0.6);
    color: #94a3b8;
    font-size: calc(11px * var(--layout-scale, 1));
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
  }

  .sub-chip.active {
    background: rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
    color: #e2e8f0;
  }

  .sub-count {
    opacity: 0.6;
    font-size: calc(10px * var(--layout-scale, 1));
  }

  /* ── Landscape Styles ── */

  .library-overlay.landscape {
    display: grid;
    grid-template-rows: auto auto 1fr;
    overflow: hidden;
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
    max-height: calc(100vh - 140px);
  }

  /* Filters inline in landscape */
  .library-overlay.landscape .filters {
    grid-template-columns: repeat(4, auto);
    justify-content: start;
    align-items: center;
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

  /* Tabs max-width removed in landscape */
  .library-overlay.landscape .library-tabs {
    max-width: none;
  }
</style>
