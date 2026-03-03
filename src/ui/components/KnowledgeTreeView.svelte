<script lang="ts">
  import KnowledgeTree from './KnowledgeTree.svelte'
  import { playerSave } from '../stores/playerData'
  import { isDue, getMasteryLevel } from '../../services/sm2'
  import { CATEGORIES } from '../../data/types'
  import type { Fact } from '../../data/types'
  import {
    initialLOD,
    zoomToBranch,
    zoomToLeaf,
    zoomOut,
    type TreeLODState,
  } from './tree/TreeLOD'

  interface Props {
    facts: Fact[]
    onBack: () => void
  }

  let { facts, onBack }: Props = $props()

  // ─── LOD navigation state ─────────────────────────────────────────────────
  let lod = $state<TreeLODState>(initialLOD())

  function onMainBranchTap(category: string) {
    lod = zoomToBranch(category)
  }

  function onSubBranchTap(category: string, subcategory: string) {
    lod = zoomToLeaf(category, subcategory)
  }

  function goBack() {
    if (lod.level === 'forest') {
      onBack()
    } else {
      lod = zoomOut(lod)
    }
  }

  function onPinchIn() {
    lod = zoomOut(lod)
  }

  function onPinchOut() {
    // Pinch out at forest level: do nothing (already at top)
    // We could auto-focus the largest branch but skip for simplicity
  }

  // ─── Show mode toggle ─────────────────────────────────────────────────────
  let showMode = $state<'learned' | 'all'>('learned')

  // ─── Fact detail card state ───────────────────────────────────────────────
  let detailFactId = $state<string | null>(null)
  const detailFact = $derived(detailFactId ? facts.find(f => f.id === detailFactId) ?? null : null)

  // Get sibling facts in the same sub-branch for swipe navigation
  const currentSubBranchFacts = $derived.by((): Fact[] => {
    if (!detailFact || !lod.focusedCategory || !lod.focusedSubcategory) return []
    const save = $playerSave
    if (!save) return []
    const learnedSet = new Set(save.learnedFacts)
    return facts.filter(f =>
      f.category[0] === lod.focusedCategory &&
      (f.category[1] ?? 'General') === lod.focusedSubcategory &&
      learnedSet.has(f.id)
    )
  })

  function onLeafTap(factId: string) {
    detailFactId = factId
  }

  function onLeafLongPress(factId: string) {
    // Long press starts a single-fact review — for now, just open the detail card
    // Full StudySession integration will happen in 13.4
    detailFactId = factId
  }

  function closeDetail() {
    detailFactId = null
  }

  function navigateDetail(factId: string) {
    detailFactId = factId
  }

  // ─── Focus Study ──────────────────────────────────────────────────────────
  let showFocusStudy = $state(false)
  let focusStudyFactIds = $state<string[]>([])

  function startFocusStudy() {
    const save = $playerSave
    if (!save || !lod.focusedCategory) return

    let scopeFacts = facts.filter(f => f.category[0] === lod.focusedCategory)
    if (lod.focusedSubcategory) {
      scopeFacts = scopeFacts.filter(f => (f.category[1] ?? 'General') === lod.focusedSubcategory)
    }

    const learnedSet = new Set(save.learnedFacts)
    const due = scopeFacts.filter(f => {
      if (!learnedSet.has(f.id)) return false
      const rs = save.reviewStates.find(s => s.factId === f.id)
      return rs ? isDue(rs) : true
    })
    const newFacts = scopeFacts.filter(f => !learnedSet.has(f.id))
    const notDue = scopeFacts.filter(f => learnedSet.has(f.id) && !due.find(d => d.id === f.id))

    focusStudyFactIds = [...due, ...newFacts, ...notDue].map(f => f.id)
    showFocusStudy = true
  }

  // ─── Subcategory discovery tracking ───────────────────────────────────────
  const SEEN_KEY = 'terra_seen_subcats'
  let seenSubcats = $state<Set<string>>(
    new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
  )

  // ─── Category pill colors ─────────────────────────────────────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    'Language':        '#7b68ee',
    'Life Sciences':   '#4ecca3',
    'History':         '#c8a060',
    'Culture':         '#e06080',
    'Natural Sciences':'#60b8e0',
    'Geography':       '#80cc60',
    'Technology':      '#e0a840',
  }

  const PILL_LABELS: Record<string, string> = {
    'Language':        'Lang',
    'Life Sciences':   'Life Sci',
    'History':         'History',
    'Culture':         'Culture',
    'Natural Sciences':'Nat Sci',
    'Geography':       'Geo',
    'Technology':      'Tech',
  }

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const totalLearned = $derived($playerSave?.learnedFacts.length ?? 0)

  const dueCount = $derived.by(() => {
    const save = $playerSave
    if (!save) return 0
    return save.reviewStates.filter((rs) => isDue(rs)).length
  })

  const categoriesUnlocked = $derived.by(() => {
    const save = $playerSave
    if (!save || save.learnedFacts.length === 0) return 0
    const learnedSet = new Set(save.learnedFacts)
    const unlockedCats = new Set<string>()
    for (const fact of facts) {
      if (learnedSet.has(fact.id) && fact.category[0]) {
        unlockedCats.add(fact.category[0])
      }
    }
    return unlockedCats.size
  })

  const PILL_ORDER = [
    'Language', 'Life Sciences', 'History', 'Culture',
    'Natural Sciences', 'Geography', 'Technology',
  ] as const

  // ─── LOD level labels ─────────────────────────────────────────────────────
  const lodLabel = $derived.by(() => {
    if (lod.level === 'forest') return 'Overview'
    if (lod.level === 'branch') return lod.focusedCategory ?? 'Branch'
    return lod.focusedSubcategory ?? 'Leaf'
  })

  const backLabel = $derived.by(() => {
    if (lod.level === 'forest') return '\u2190 Back'
    if (lod.level === 'branch') return '\u2190 Overview'
    return `\u2190 ${lod.focusedCategory ?? 'Branch'}`
  })
</script>

<div class="tree-view" aria-label="Knowledge Tree">
  <!-- Header -->
  <header class="tree-header">
    <button class="back-button" type="button" onclick={goBack} aria-label="Back one level">
      {backLabel}
    </button>
    <h1 class="tree-title">{lodLabel}</h1>
    <div class="header-actions">
      <button
        type="button"
        class="toggle-btn"
        onclick={() => showMode = showMode === 'learned' ? 'all' : 'learned'}
        aria-label="Toggle show all facts or learned only"
      >
        {showMode === 'learned' ? 'Show All' : 'Learned'}
      </button>
    </div>
  </header>

  <!-- Category filter pills (only shown at forest level) -->
  {#if lod.level === 'forest'}
    <div class="pill-row" role="toolbar" aria-label="Filter by category">
      {#each PILL_ORDER as cat (cat)}
        {@const color = CATEGORY_COLORS[cat] ?? '#888888'}
        <button
          class="cat-pill"
          type="button"
          style="--pill-color: {color}"
          onclick={() => onMainBranchTap(cat)}
          aria-label="Zoom into {cat} branch"
        >
          {PILL_LABELS[cat] ?? cat}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Focus Study bar (branch/leaf level) -->
  {#if lod.level !== 'forest' && lod.focusedCategory}
    <div class="focus-study-bar">
      <button
        type="button"
        class="focus-study-btn"
        onclick={startFocusStudy}
        aria-label="Start focused study session for {lod.focusedSubcategory ?? lod.focusedCategory}"
      >
        Focus Study: {lod.focusedSubcategory ?? lod.focusedCategory}
      </button>
    </div>
  {/if}

  <!-- Tree visualization -->
  <div class="tree-area">
    <KnowledgeTree
      {facts}
      {lod}
      {showMode}
      {onMainBranchTap}
      {onSubBranchTap}
      {onLeafTap}
      onLeafLongPress={onLeafLongPress}
      onPinchIn={onPinchIn}
      onPinchOut={onPinchOut}
    />
  </div>

  <!-- Bottom stats bar -->
  <footer class="stats-bar">
    <div class="stat-item">
      <span class="stat-value">{totalLearned}</span>
      <span class="stat-label">Total Facts</span>
    </div>
    <div class="stat-divider" aria-hidden="true"></div>
    <div class="stat-item" class:stat-due={dueCount > 0}>
      <span class="stat-value">{dueCount}</span>
      <span class="stat-label">Ready to Strengthen</span>
    </div>
    <div class="stat-divider" aria-hidden="true"></div>
    <div class="stat-item">
      <span class="stat-value">{categoriesUnlocked}<span class="stat-denom">/{CATEGORIES.length}</span></span>
      <span class="stat-label">Categories</span>
    </div>
  </footer>

  <!-- Fact detail card overlay -->
  {#if detailFact}
    {@const save = $playerSave}
    {@const reviewState = save?.reviewStates.find(s => s.factId === detailFact.id) ?? null}
    {@const mastery = reviewState ? getMasteryLevel(reviewState) : 'new'}
    {@const currentIndex = currentSubBranchFacts.findIndex(f => f.id === detailFact.id)}
    <div class="fact-card-overlay"
         role="dialog" aria-modal="true" aria-label="Fact detail"
         onclick={(e) => { if (e.target === e.currentTarget) closeDetail() }}>
      <div class="fact-card">
        <header class="card-header">
          <span class="mastery-badge" style="color: {
            mastery === 'mastered' ? '#4ecca3' :
            mastery === 'known' ? '#5a9060' :
            mastery === 'familiar' ? '#c87830' :
            mastery === 'learning' ? '#9a5a28' : '#555566'
          }">
            {mastery.toUpperCase()}
          </span>
          {#if currentIndex >= 0}
            <div class="nav-hint">{currentIndex + 1} / {currentSubBranchFacts.length}</div>
          {/if}
          <button class="close-btn" type="button" onclick={closeDetail} aria-label="Close fact card">
            &times;
          </button>
        </header>

        <div class="card-body">
          {#if detailFact.imageUrl}
            <img src={detailFact.imageUrl} alt="Illustration for {detailFact.statement}"
                 class="fact-image" loading="lazy" />
          {/if}

          <div class="fact-category">{detailFact.category.join(' \u203A ')}</div>
          <h2 class="fact-question">{detailFact.quizQuestion}</h2>
          <p class="fact-answer">{detailFact.correctAnswer}</p>

          {#if detailFact.wowFactor}
            <div class="wow-factor">
              <span class="wow-label">WOW:</span> {detailFact.wowFactor}
            </div>
          {/if}

          <p class="fact-explanation">{detailFact.explanation}</p>

          {#if detailFact.gaiaComment}
            <div class="gaia-comment">
              <span class="gaia-label">G.A.I.A.:</span> {detailFact.gaiaComment}
            </div>
          {/if}
        </div>

        <footer class="card-footer">
          {#if currentIndex > 0}
            <button type="button" class="nav-btn"
                    onclick={() => navigateDetail(currentSubBranchFacts[currentIndex - 1].id)}
                    aria-label="Previous fact">&larr;</button>
          {/if}
          <div class="card-footer-spacer"></div>
          {#if currentIndex >= 0 && currentIndex < currentSubBranchFacts.length - 1}
            <button type="button" class="nav-btn"
                    onclick={() => navigateDetail(currentSubBranchFacts[currentIndex + 1].id)}
                    aria-label="Next fact">&rarr;</button>
          {/if}
        </footer>
      </div>
    </div>
  {/if}
</div>

<style>
  .tree-view {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  /* ─── Header ────────────────────────────────────────────────────────────── */
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--color-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 60%, transparent 40%);
    flex-shrink: 0;
  }

  .back-button {
    min-height: 40px;
    min-width: 80px;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 40%, var(--color-surface) 60%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0 14px;
    transition: transform 100ms ease, background-color 100ms ease;
  }

  .back-button:active {
    transform: scale(0.96);
    background: color-mix(in srgb, var(--color-primary) 65%, var(--color-surface) 35%);
  }

  .tree-title {
    color: var(--color-warning);
    font-size: clamp(1rem, 4vw, 1.4rem);
    font-weight: 700;
    text-align: center;
    letter-spacing: 1px;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .toggle-btn {
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    background: color-mix(in srgb, var(--color-text-dim) 10%, var(--color-surface) 90%);
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 150ms ease;
  }

  .toggle-btn:active {
    background: color-mix(in srgb, var(--color-text-dim) 25%, var(--color-surface) 75%);
  }

  /* ─── Category pill row ─────────────────────────────────────────────────── */
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 6px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--color-surface) 85%, transparent 15%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
    flex-shrink: 0;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .pill-row::-webkit-scrollbar { display: none; }

  .cat-pill {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    border: 1.5px solid color-mix(in srgb, var(--pill-color) 40%, transparent 60%);
    background: color-mix(in srgb, var(--pill-color) 14%, var(--color-surface) 86%);
    color: color-mix(in srgb, var(--pill-color) 80%, var(--color-text) 20%);
    font-family: 'Courier New', monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, transform 100ms ease;
    flex-shrink: 0;
  }

  .cat-pill:hover {
    background: color-mix(in srgb, var(--pill-color) 25%, var(--color-surface) 75%);
    border-color: color-mix(in srgb, var(--pill-color) 70%, transparent 30%);
  }

  .cat-pill:active { transform: scale(0.94); }

  /* ─── Focus Study bar ───────────────────────────────────────────────────── */
  .focus-study-bar {
    padding: 6px 14px;
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface) 92%);
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent 75%);
    flex-shrink: 0;
  }

  .focus-study-btn {
    width: 100%;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface) 80%);
    color: var(--color-primary);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .focus-study-btn:active {
    background: color-mix(in srgb, var(--color-primary) 35%, var(--color-surface) 65%);
  }

  /* ─── Tree area ─────────────────────────────────────────────────────────── */
  .tree-area {
    flex: 1 1 0;
    min-height: 0;
    padding: 8px 4px 4px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
  }

  /* ─── Stats bar ─────────────────────────────────────────────────────────── */
  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 10px 16px;
    background: var(--color-surface);
    border-top: 1px solid color-mix(in srgb, var(--color-primary) 60%, transparent 40%);
    flex-shrink: 0;
    gap: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 1;
  }

  .stat-value {
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    font-weight: 800;
    color: var(--color-success);
    line-height: 1.1;
  }

  .stat-due .stat-value { color: var(--color-warning); }

  .stat-denom {
    font-size: 0.7em;
    font-weight: 600;
    color: var(--color-text-dim);
  }

  .stat-label {
    font-size: clamp(0.65rem, 2.5vw, 0.78rem);
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
  }

  .stat-divider {
    width: 1px;
    height: 36px;
    background: color-mix(in srgb, var(--color-text-dim) 25%, transparent 75%);
    flex-shrink: 0;
    margin: 0 4px;
  }

  /* ─── Fact card overlay ─────────────────────────────────────────────────── */
  .fact-card-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .fact-card {
    background: var(--color-surface);
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 20%, transparent 80%);
    flex-shrink: 0;
  }

  .mastery-badge {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .nav-hint {
    font-size: 0.72rem;
    color: var(--color-text-dim);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.4rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .close-btn:hover { background: color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%); }

  .card-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 16px;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fact-image {
    width: 100%;
    max-height: 140px;
    object-fit: contain;
    image-rendering: pixelated;
    border-radius: 8px;
  }

  .fact-category {
    font-size: 0.7rem;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .fact-question {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1.4;
  }

  .fact-answer {
    font-size: 0.95rem;
    color: var(--color-success);
    font-weight: 600;
    margin: 0;
  }

  .wow-factor {
    font-size: 0.85rem;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface) 92%);
    border-left: 3px solid var(--color-warning);
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
  }

  .wow-label { font-weight: 700; }

  .fact-explanation {
    font-size: 0.85rem;
    color: var(--color-text-dim);
    margin: 0;
    line-height: 1.5;
  }

  .gaia-comment {
    font-size: 0.82rem;
    color: var(--color-primary);
    font-style: italic;
    border-top: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
    padding-top: 8px;
  }

  .gaia-label { font-style: normal; font-weight: 700; }

  .card-footer {
    padding: 12px 16px;
    border-top: 1px solid color-mix(in srgb, var(--color-text-dim) 20%, transparent 80%);
    flex-shrink: 0;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .card-footer-spacer { flex: 1; }

  .nav-btn {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    background: color-mix(in srgb, var(--color-text-dim) 10%, var(--color-surface) 90%);
    color: var(--color-text);
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-btn:active {
    background: color-mix(in srgb, var(--color-text-dim) 25%, var(--color-surface) 75%);
  }

  /* ─── Small screen tweaks ───────────────────────────────────────────────── */
  @media (max-width: 400px) {
    .tree-header { padding: 8px 10px; }
    .back-button { min-width: 64px; font-size: 0.82rem; }
    .pill-row { padding: 5px 8px; gap: 4px 5px; flex-wrap: nowrap; }
    .cat-pill { height: 24px; font-size: 0.68rem; padding: 0 8px; }
  }
</style>
