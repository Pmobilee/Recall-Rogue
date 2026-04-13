<script lang="ts">
  import { shareRunSummaryCard } from '../../services/runShareService'
  import type { RunSummary } from '../../data/types'
  import { isLandscape } from '../../stores/layoutStore'
  import { playerSave } from '../stores/playerData'
  import { lastRunSummary } from '../../services/hubState'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import type { FactDomain } from '../../data/card-types'

  interface Props {
    summary: RunSummary | null
    onBack: () => void
  }

  let { summary, onBack }: Props = $props()

  // Prefer runHistory from playerSave, fall back to lastRunSummary prop
  const runHistory = $derived($playerSave?.runHistory ?? [])

  // Selected run index — 0 = most recent
  let selectedIndex = $state(0)

  // Filter: 'all' | 'victory' | 'defeat' | 'retreat' | 'abandon'
  let filterResult = $state<'all' | 'victory' | 'defeat' | 'retreat' | 'abandon'>('all')

  // Filtered list derived from history + filter
  const filteredHistory = $derived(
    runHistory.filter((r) => filterResult === 'all' || r.result === filterResult),
  )

  // The run being displayed in the detail column
  const displayedRun = $derived.by<RunSummary | null>(() => {
    // If there is history, use the selected index from filteredHistory
    if (filteredHistory.length > 0) {
      return filteredHistory[selectedIndex] ?? filteredHistory[0] ?? null
    }
    // Fallback: legacy lastRunSummary prop
    return summary
  })

  let shareState = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')

  // When filter changes, reset selection to top
  $effect(() => {
    filterResult // reactive dependency
    selectedIndex = 0
  })

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Unknown'
    }
  }

  function formatRelativeDate(iso: string): string {
    try {
      const ms = Date.now() - new Date(iso).getTime()
      const secs = Math.floor(ms / 1000)
      if (secs < 60) return 'just now'
      const mins = Math.floor(secs / 60)
      if (mins < 60) return `${mins}m ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      if (days === 1) return 'yesterday'
      if (days < 7) return `${days}d ago`
      return formatDate(iso)
    } catch {
      return 'Unknown'
    }
  }

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  function resultIcon(result: 'victory' | 'defeat' | 'retreat' | 'abandon'): string {
    if (result === 'victory') return '🏆'
    if (result === 'defeat') return '💀'
    if (result === 'abandon') return '🏳️'
    return '🚪'
  }

  function resultLabel(result: 'victory' | 'defeat' | 'retreat' | 'abandon'): string {
    if (result === 'victory') return 'Victory'
    if (result === 'defeat') return 'Defeat'
    if (result === 'abandon') return 'Abandoned'
    return 'Retreat'
  }

  function deckDisplayLabel(run: RunSummary): string {
    if (run.deckLabel) return run.deckLabel
    if (run.deckId) return run.deckId
    return labelDomain(run.primaryDomain)
  }

  function labelDomain(id: string): string {
    try {
      return getDomainMetadata(id as FactDomain).displayName
    } catch {
      return id ? id.charAt(0).toUpperCase() + id.slice(1).replaceAll('_', ' ') : 'Unknown'
    }
  }

  function pct(correct: number, answered: number): number {
    if (answered <= 0) return 0
    return Math.round((correct / answered) * 100)
  }

  function handleSelectRun(idx: number): void {
    selectedIndex = idx
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onBack()
  }

  async function handleShare(): Promise<void> {
    const run = displayedRun
    if (!run) return
    shareState = 'sharing'
    try {
      await shareRunSummaryCard({
        result: run.result,
        floorReached: run.floorReached,
        factsAnswered: run.factsLearned,
        correctAnswers: run.factsLearned,
        accuracy: run.accuracy,
        bestCombo: run.bestCombo,
        cardsEarned: run.cardsCollected,
        newFactsLearned: run.newFactsSeen,
        factsMastered: run.factsMasteredThisRun,
        encountersWon: run.enemiesDefeated,
        encountersTotal: run.encountersTotal,
        elitesDefeated: run.elitesDefeated,
        miniBossesDefeated: run.miniBossesDefeated,
        bossesDefeated: run.bossesDefeated,
        completedBounties: run.completedBounties,
        duration: run.runDurationMs,
        runDurationMs: run.runDurationMs,
        rewardMultiplier: 1,
        currencyEarned: run.goldEarned,
        isPracticeRun: false,
        defeatedEnemyIds: run.enemiesDefeatedList,
        factStateSummary: run.factStateSummary,
      })
      shareState = 'done'
    } catch {
      shareState = 'error'
    } finally {
      setTimeout(() => {
        shareState = 'idle'
      }, 1500)
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="journal-screen"
  class:journal-landscape={$isLandscape}
  aria-label="Expedition Log"
  onkeydown={handleKeydown}
>
  <!-- Header -->
  <header class="journal-header">
    <div class="header-title">
      <h2>Expedition Log</h2>
      {#if displayedRun}
        <span class="header-subtitle">{filteredHistory.length} expedition{filteredHistory.length !== 1 ? 's' : ''} recorded</span>
      {/if}
    </div>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  <div class="journal-body">
    <!-- LEFT COLUMN: Detail view of selected expedition -->
    <div class="detail-column">
      {#if displayedRun}
        {@const run = displayedRun}
        <!-- Run header -->
        <div class="run-header-card">
          <div class="run-header-left">
            <span class="result-icon" class:victory={run.result === 'victory'} class:defeat={run.result === 'defeat'} class:retreat={run.result === 'retreat'} class:abandon={run.result === 'abandon'}>
              {resultIcon(run.result)}
            </span>
            <div>
              <h3 class="run-title">{resultLabel(run.result)} — {deckDisplayLabel(run)}</h3>
              <p class="run-meta">{formatDate(run.runDate)} &bull; {formatDuration(run.runDurationMs)}</p>
            </div>
          </div>
          <button
            type="button"
            class="share-btn"
            data-testid="btn-share-run-journal"
            onclick={handleShare}
            disabled={shareState === 'sharing'}
          >
            {shareState === 'sharing' ? 'Sharing...' : shareState === 'done' ? 'Shared' : shareState === 'error' ? 'Retry' : 'Share'}
          </button>
        </div>

        <!-- Combat card -->
        <div class="info-card">
          <h4 class="card-title">Combat</h4>
          <div class="stat-tiles">
            <div class="tile"><span>Floor</span><strong>{run.floorReached}</strong></div>
            <div class="tile"><span>Encounters</span><strong>{run.enemiesDefeated}/{run.encountersTotal}</strong></div>
            <div class="tile"><span>Elites</span><strong>{run.elitesDefeated}</strong></div>
            <div class="tile"><span>Bosses</span><strong>{run.bossesDefeated}</strong></div>
            <div class="tile"><span>Best Chain</span><strong>x{run.bestCombo}</strong></div>
            <div class="tile"><span>Accuracy</span><strong>{run.accuracy}%</strong></div>
            <div class="tile"><span>Gold</span><strong>{run.goldEarned}</strong></div>
            <div class="tile"><span>Cards</span><strong>{run.cardsCollected}</strong></div>
          </div>
        </div>

        <!-- Knowledge gained card -->
        <div class="info-card">
          <h4 class="card-title">Knowledge Gained</h4>
          <div class="knowledge-rows">
            <div class="k-row"><span>New facts seen</span><strong class="k-val">{run.newFactsSeen}</strong></div>
            <div class="k-row"><span>Reviewed</span><strong class="k-val">{run.factsReviewed}</strong></div>
            <div class="k-row"><span>Mastered this run</span><strong class="k-val mastered">{run.factsMasteredThisRun}</strong></div>
            <div class="k-row"><span>Tier advances</span><strong class="k-val tier-adv">{run.factsTierAdvanced}</strong></div>
          </div>
          {#if run.factStateSummary && (run.factStateSummary.seen + run.factStateSummary.reviewing + run.factStateSummary.mastered) > 0}
            {@const total = run.factStateSummary.seen + run.factStateSummary.reviewing + run.factStateSummary.mastered}
            <div class="fsrs-bar-section">
              <div class="fsrs-bar">
                {#if run.factStateSummary.seen > 0}
                  <div class="fsrs-seg fsrs-seen" style="width: {(run.factStateSummary.seen / total * 100).toFixed(1)}%"></div>
                {/if}
                {#if run.factStateSummary.reviewing > 0}
                  <div class="fsrs-seg fsrs-reviewing" style="width: {(run.factStateSummary.reviewing / total * 100).toFixed(1)}%"></div>
                {/if}
                {#if run.factStateSummary.mastered > 0}
                  <div class="fsrs-seg fsrs-mastered" style="width: {(run.factStateSummary.mastered / total * 100).toFixed(1)}%"></div>
                {/if}
              </div>
              <div class="fsrs-legend">
                <span class="fsrs-label seen">Seen: {run.factStateSummary.seen}</span>
                <span class="fsrs-label reviewing">Reviewing: {run.factStateSummary.reviewing}</span>
                <span class="fsrs-label mastered">Mastered: {run.factStateSummary.mastered}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Enemies felled card -->
        {#if run.enemiesDefeated > 0 || run.elitesDefeated > 0 || run.miniBossesDefeated > 0 || run.bossesDefeated > 0}
          <div class="info-card">
            <h4 class="card-title">Enemies Felled</h4>
            <div class="enemy-summary-row">
              <div class="enemy-type-tile"><span>Normal</span><strong>{run.enemiesDefeated}</strong></div>
              <div class="enemy-type-tile"><span>Elites</span><strong>{run.elitesDefeated}</strong></div>
              <div class="enemy-type-tile"><span>Mini-Bosses</span><strong>{run.miniBossesDefeated}</strong></div>
              <div class="enemy-type-tile"><span>Bosses</span><strong>{run.bossesDefeated}</strong></div>
            </div>
            {#if run.enemiesDefeatedList && run.enemiesDefeatedList.length > 0}
              <div class="enemy-list">
                {#each [...new Set(run.enemiesDefeatedList)].slice(0, 12) as enemyId (enemyId)}
                  {@const count = run.enemiesDefeatedList.filter((e) => e === enemyId).length}
                  <span class="enemy-chip">{enemyId.replaceAll('_', ' ')} {count > 1 ? `×${count}` : ''}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Domain accuracy card -->
        {#if run.domainAccuracy && Object.keys(run.domainAccuracy).length > 0}
          <div class="info-card">
            <h4 class="card-title">Domain Accuracy</h4>
            <div class="domain-acc-list">
              {#each Object.entries(run.domainAccuracy) as [domain, acc] (domain)}
                {@const domPct = pct(acc.correct, acc.answered)}
                <div class="domain-acc-row">
                  <span class="domain-acc-name">{labelDomain(domain)}</span>
                  <div class="domain-acc-bar-wrap">
                    <div class="domain-acc-bar" style="width: {domPct}%"></div>
                  </div>
                  <span class="domain-acc-pct">{domPct}%</span>
                  <span class="domain-acc-sub">{acc.correct}/{acc.answered}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Completed bounties -->
        {#if run.completedBounties.length > 0}
          <div class="info-card info-card-bounties">
            <h4 class="card-title">Bounties Cleared</h4>
            <div class="bounty-list">
              {#each run.completedBounties as bounty (bounty)}
                <span class="bounty-chip">{bounty}</span>
              {/each}
            </div>
          </div>
        {/if}

      {:else}
        <!-- Empty state -->
        <div class="empty-detail">
          <p class="empty-icon">📖</p>
          <h3>No expeditions logged yet</h3>
          <p>Dive into a run to begin your log.</p>
        </div>
      {/if}
    </div>

    <!-- RIGHT COLUMN: Run history list -->
    <div class="history-column">
      <div class="history-header">
        <h4>Run History</h4>
        <!-- Filter pills -->
        <div class="filter-pills" role="group" aria-label="Filter by result">
          <button
            type="button"
            class="pill"
            class:pill-active={filterResult === 'all'}
            onclick={() => { filterResult = 'all' }}
          >All</button>
          <button
            type="button"
            class="pill"
            class:pill-active={filterResult === 'victory'}
            onclick={() => { filterResult = 'victory' }}
          >🏆</button>
          <button
            type="button"
            class="pill"
            class:pill-active={filterResult === 'defeat'}
            onclick={() => { filterResult = 'defeat' }}
          >💀</button>
          <button
            type="button"
            class="pill"
            class:pill-active={filterResult === 'retreat'}
            onclick={() => { filterResult = 'retreat' }}
          >🚪</button>
          <button
            type="button"
            class="pill"
            class:pill-active={filterResult === 'abandon'}
            onclick={() => { filterResult = 'abandon' }}
          >🏳️</button>
        </div>
      </div>

      <div class="history-list" role="list">
        {#if filteredHistory.length === 0}
          <div class="history-empty">
            {runHistory.length === 0
              ? 'No expeditions logged yet. Dive into a run to begin your log.'
              : 'No runs match this filter.'}
          </div>
        {:else}
          {#each filteredHistory as run, idx (run.runDate + idx)}
            <button
              type="button"
              class="history-row"
              class:history-row-selected={idx === selectedIndex}
              onclick={() => handleSelectRun(idx)}
              aria-label="{resultLabel(run.result)} on {formatDate(run.runDate)}, floor {run.floorReached}"
            >
              <span class="h-icon" class:h-victory={run.result === 'victory'} class:h-defeat={run.result === 'defeat'} class:h-retreat={run.result === 'retreat'} class:h-abandon={run.result === 'abandon'}>
                {resultIcon(run.result)}
              </span>
              <div class="h-info">
                <span class="h-deck">{deckDisplayLabel(run)}</span>
                <span class="h-sub">Floor {run.floorReached} &bull; {formatDuration(run.runDurationMs)}</span>
              </div>
              <span class="h-date">{formatRelativeDate(run.runDate)}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>

<style>
  /* ── Base layout ──────────────────────────────────────────── */

  .journal-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0a1528 0%, #0d1a35 100%);
    color: #e2e8f0;
    overflow: hidden;
  }

  /* ── Header ───────────────────────────────────────────────── */

  .journal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .journal-header h2 {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .header-subtitle {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .back-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    min-width: calc(64px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 calc(14px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
  }

  .back-btn:hover {
    background: #263348;
    border-color: #64748b;
  }

  /* ── Body: two-column layout ──────────────────────────────── */

  .journal-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  /* Portrait: stack columns vertically with scroll */
  .detail-column {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .history-column {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    min-height: 0;
  }

  /* ── Run header card ──────────────────────────────────────── */

  .run-header-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(12px * var(--layout-scale, 1));
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.82);
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  .run-header-left {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .result-icon {
    font-size: calc(28px * var(--text-scale, 1));
    filter: grayscale(20%);
  }

  .result-icon.victory { filter: drop-shadow(0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.6)); }
  .result-icon.defeat  { filter: drop-shadow(0 0 calc(8px * var(--layout-scale, 1)) rgba(239, 68, 68, 0.5)); }
  .result-icon.retreat { filter: drop-shadow(0 0 calc(6px * var(--layout-scale, 1)) rgba(148, 163, 184, 0.4)); }
  .result-icon.abandon { opacity: 0.7; }

  .run-title {
    margin: 0;
    font-size: calc(15px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .run-meta {
    margin: calc(2px * var(--layout-scale, 1)) 0 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .share-btn {
    min-height: calc(36px * var(--layout-scale, 1));
    min-width: calc(70px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(125, 211, 252, 0.5);
    background: linear-gradient(180deg, #0f4c81, #1d4ed8);
    color: #e0f2fe;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0 calc(10px * var(--layout-scale, 1));
  }

  .share-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Info cards ───────────────────────────────────────────── */

  .info-card {
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.78);
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .card-title {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
    text-transform: uppercase;
    letter-spacing: calc(0.6px * var(--layout-scale, 1));
    font-weight: 700;
  }

  /* Combat stat tiles */
  .stat-tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: calc(6px * var(--layout-scale, 1));
  }

  .tile {
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(7px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
    align-items: center;
    text-align: center;
  }

  .tile span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .tile strong {
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
  }

  /* Knowledge rows */
  .knowledge-rows {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .k-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .k-val {
    font-size: calc(14px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 700;
  }

  .k-val.mastered { color: #86efac; }
  .k-val.tier-adv { color: #93c5fd; }

  /* FSRS bar */
  .fsrs-bar-section {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .fsrs-bar {
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 99px;
    background: rgba(2, 6, 23, 0.5);
    display: flex;
    overflow: hidden;
  }

  .fsrs-seg {
    height: 100%;
    transition: width 0.3s ease;
  }

  .fsrs-seen { background: #475569; }
  .fsrs-reviewing { background: #3b82f6; }
  .fsrs-mastered { background: #22c55e; }

  .fsrs-legend {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .fsrs-label {
    font-size: calc(10px * var(--text-scale, 1));
    opacity: 0.8;
  }

  .fsrs-label.seen { color: #94a3b8; }
  .fsrs-label.reviewing { color: #60a5fa; }
  .fsrs-label.mastered { color: #4ade80; }

  /* Enemies felled */
  .enemy-summary-row {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .enemy-type-tile {
    flex: 1;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(6px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .enemy-type-tile span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
  }

  .enemy-type-tile strong {
    font-size: calc(15px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 700;
  }

  .enemy-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(4px * var(--layout-scale, 1));
    max-height: calc(80px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .enemy-chip {
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
    background: rgba(2, 6, 23, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 6px;
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    white-space: nowrap;
    text-transform: capitalize;
  }

  /* Domain accuracy */
  .domain-acc-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .domain-acc-row {
    display: grid;
    grid-template-columns: calc(100px * var(--layout-scale, 1)) 1fr calc(36px * var(--layout-scale, 1)) calc(44px * var(--layout-scale, 1));
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .domain-acc-name {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .domain-acc-bar-wrap {
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(2, 6, 23, 0.5);
    border-radius: 99px;
    overflow: hidden;
  }

  .domain-acc-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #22c55e);
    border-radius: 99px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .domain-acc-pct {
    font-size: calc(12px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 700;
    text-align: right;
  }

  .domain-acc-sub {
    font-size: calc(9px * var(--text-scale, 1));
    color: #475569;
    text-align: right;
  }

  /* Bounties */
  .info-card-bounties {
    border-color: rgba(250, 204, 21, 0.25);
    background: rgba(113, 63, 18, 0.22);
  }

  .bounty-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .bounty-chip {
    font-size: calc(11px * var(--text-scale, 1));
    color: #fef3c7;
    background: rgba(113, 63, 18, 0.4);
    border: 1px solid rgba(250, 204, 21, 0.3);
    border-radius: 8px;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  /* Empty detail state */
  .empty-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(40px * var(--layout-scale, 1));
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
  }

  .empty-icon { font-size: calc(40px * var(--text-scale, 1)); margin: 0; }

  .empty-detail h3 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    color: rgba(255,255,255,0.6);
  }

  .empty-detail p {
    margin: 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255,255,255,0.35);
  }

  /* ── History column ───────────────────────────────────────── */

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .history-header h4 {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #93c5fd;
    text-transform: uppercase;
    letter-spacing: calc(0.6px * var(--layout-scale, 1));
  }

  .filter-pills {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .pill {
    min-height: calc(28px * var(--layout-scale, 1));
    min-width: calc(40px * var(--layout-scale, 1));
    border-radius: 99px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.5);
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    padding: 0 calc(8px * var(--layout-scale, 1));
    transition: all 150ms ease;
  }

  .pill:hover { border-color: rgba(148, 163, 184, 0.4); color: #cbd5e1; }

  .pill-active {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(96, 165, 250, 0.5);
    color: #93c5fd;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    min-height: 0;
  }

  .history-empty {
    text-align: center;
    color: rgba(255,255,255,0.35);
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(24px * var(--layout-scale, 1));
    font-style: italic;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(15, 23, 42, 0.6);
    cursor: pointer;
    text-align: left;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: all 120ms ease;
    width: 100%;
  }

  .history-row:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(148, 163, 184, 0.3);
  }

  .history-row-selected {
    background: rgba(30, 58, 138, 0.4);
    border-color: rgba(96, 165, 250, 0.4);
  }

  .h-icon {
    font-size: calc(16px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .h-victory { filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.5)); }
  .h-defeat  { filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.5)); }
  .h-retreat { opacity: 0.8; }
  .h-abandon { opacity: 0.65; }

  .h-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    min-width: 0;
  }

  .h-deck {
    font-size: calc(12px * var(--text-scale, 1));
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .h-sub {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
  }

  .h-date {
    font-size: calc(10px * var(--text-scale, 1));
    color: #475569;
    flex-shrink: 0;
    text-align: right;
  }

  /* ═══ LANDSCAPE OVERRIDES ════════════════════════════════════ */

  .journal-landscape .journal-header {
    padding: calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .journal-landscape .journal-header h2 {
    font-size: calc(26px * var(--text-scale, 1));
  }

  .journal-landscape .journal-body {
    grid-template-columns: 3fr 2fr;
    padding: calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    gap: calc(20px * var(--layout-scale, 1));
  }

  .journal-landscape .stat-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .journal-landscape .tile strong {
    font-size: calc(20px * var(--text-scale, 1));
  }

  .journal-landscape .tile span {
    font-size: calc(10px * var(--text-scale, 1));
  }

  .journal-landscape .run-title {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .journal-landscape .run-meta {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .journal-landscape .k-row {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .journal-landscape .k-val {
    font-size: calc(16px * var(--text-scale, 1));
  }

  .journal-landscape .domain-acc-row {
    grid-template-columns: calc(120px * var(--layout-scale, 1)) 1fr calc(40px * var(--layout-scale, 1)) calc(50px * var(--layout-scale, 1));
  }

  .journal-landscape .domain-acc-name {
    font-size: calc(12px * var(--text-scale, 1));
  }

  .journal-landscape .domain-acc-pct {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .journal-landscape .h-deck {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .journal-landscape .h-sub {
    font-size: calc(11px * var(--text-scale, 1));
  }

  .journal-landscape .h-date {
    font-size: calc(11px * var(--text-scale, 1));
  }

  .journal-landscape .result-icon {
    font-size: calc(36px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .journal-screen {
    max-width: none;
  }
</style>
