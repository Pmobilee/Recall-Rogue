<script lang="ts">
  import { shareRunSummaryCard } from '../../services/runShareService'
  import type { RunSummary } from '../../services/hubState'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    summary: RunSummary | null
    onBack: () => void
  }

  let { summary, onBack }: Props = $props()
  let shareState = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')

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

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  let searchQuery = $state('')

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !searchQuery) onBack()
    else if (event.key === 'Escape' && searchQuery) searchQuery = ''
  }

  async function handleShare(): Promise<void> {
    if (!summary) return
    shareState = 'sharing'
    try {
      await shareRunSummaryCard({
        result: summary.result,
        floorReached: summary.floorReached,
        factsAnswered: summary.factsLearned,
        correctAnswers: summary.factsLearned,
        accuracy: summary.accuracy,
        bestCombo: summary.bestCombo,
        cardsEarned: summary.cardsCollected,
        newFactsLearned: summary.factsLearned,
        factsMastered: 0,
        encountersWon: summary.enemiesDefeated,
        encountersTotal: summary.encountersTotal,
        elitesDefeated: 0,
        miniBossesDefeated: 0,
        bossesDefeated: 0,
        completedBounties: summary.completedBounties,
        duration: summary.runDurationMs,
        runDurationMs: summary.runDurationMs,
        rewardMultiplier: 1,
        currencyEarned: summary.goldEarned,
        isPracticeRun: false,
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

{#if $isLandscape}
<!-- LANDSCAPE: wider layout with search bar in top bar -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="journal-screen journal-screen-landscape" aria-label="Adventurer's Journal" onkeydown={handleKeydown}>
  <header class="header header-landscape">
    <h2>Adventurer&apos;s Journal</h2>
    <div class="header-search">
      <input
        type="search"
        class="search-input"
        placeholder="Search domain or bounty..."
        bind:value={searchQuery}
        aria-label="Search journal"
      />
    </div>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  {#if summary}
    <article class="summary-card summary-card-landscape">
      <div class="summary-left">
        <h3>Last Expedition</h3>
        <p class="meta">{formatDate(summary.runDate)}</p>

        <div class="stats-grid stats-grid-landscape">
          <div><span>Floor</span><strong>{summary.floorReached}</strong></div>
          <div><span>Foes</span><strong>{summary.enemiesDefeated}/{summary.encountersTotal}</strong></div>
          <div><span>Facts</span><strong>{summary.factsLearned}</strong></div>
          <div><span>Gold</span><strong>{summary.goldEarned}</strong></div>
          <div><span>Cards</span><strong>{summary.cardsCollected}</strong></div>
          <div><span>Accuracy</span><strong>{summary.accuracy}%</strong></div>
        </div>
      </div>

      <div class="summary-right">
        <div class="meta-line">
          Domains: <strong>{summary.primaryDomain}</strong> + <strong>{summary.secondaryDomain}</strong>
        </div>
        <div class="meta-line">Run time: {formatDuration(summary.runDurationMs)} • Best chain: x{summary.bestCombo}</div>

        {#if summary.completedBounties.length > 0}
          <div class="bounties">
            <strong>Bounties Cleared</strong>
            {#each summary.completedBounties as bounty}
              <span>{bounty}</span>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          class="share-btn"
          data-testid="btn-share-run-journal"
          onclick={handleShare}
          disabled={shareState === 'sharing'}
        >
          {shareState === 'sharing' ? 'Sharing...' : shareState === 'done' ? 'Shared' : shareState === 'error' ? 'Retry Share' : 'Share Summary'}
        </button>
      </div>
    </article>
  {:else}
    <article class="empty-card">
      <h3>No expeditions yet</h3>
      <p>Complete a run to populate your journal summary.</p>
    </article>
  {/if}
</section>

{:else}
<!-- PORTRAIT: original layout, pixel-identical -->
<section class="journal-screen" aria-label="Adventurer's Journal">
  <header class="header">
    <h2>Adventurer&apos;s Journal</h2>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  {#if summary}
    <article class="summary-card">
      <h3>Last Expedition</h3>
      <p class="meta">{formatDate(summary.runDate)}</p>

      <div class="stats-grid">
        <div><span>Floor</span><strong>{summary.floorReached}</strong></div>
        <div><span>Foes</span><strong>{summary.enemiesDefeated}/{summary.encountersTotal}</strong></div>
        <div><span>Facts</span><strong>{summary.factsLearned}</strong></div>
        <div><span>Gold</span><strong>{summary.goldEarned}</strong></div>
        <div><span>Cards</span><strong>{summary.cardsCollected}</strong></div>
        <div><span>Accuracy</span><strong>{summary.accuracy}%</strong></div>
      </div>

      <div class="meta-line">
        Domains: <strong>{summary.primaryDomain}</strong> + <strong>{summary.secondaryDomain}</strong>
      </div>
      <div class="meta-line">Run time: {formatDuration(summary.runDurationMs)} • Best chain: x{summary.bestCombo}</div>

      {#if summary.completedBounties.length > 0}
        <div class="bounties">
          <strong>Bounties Cleared</strong>
          {#each summary.completedBounties as bounty}
            <span>{bounty}</span>
          {/each}
        </div>
      {/if}

      <button
        type="button"
        class="share-btn"
        data-testid="btn-share-run-journal"
        onclick={handleShare}
        disabled={shareState === 'sharing'}
      >
        {shareState === 'sharing' ? 'Sharing...' : shareState === 'done' ? 'Shared' : shareState === 'error' ? 'Retry Share' : 'Share Summary'}
      </button>
    </article>
  {:else}
    <article class="empty-card">
      <h3>No expeditions yet</h3>
      <p>Complete a run to populate your journal summary.</p>
    </article>
  {/if}
</section>
{/if}

<style>
  .journal-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(96px * var(--layout-scale, 1));
    background: linear-gradient(180deg, #0a1528, #101d33);
    color: #e2e8f0;
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h2 {
    margin: 0;
    font-size: calc(22px * var(--text-scale, 1));
  }

  .back-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 calc(12px * var(--layout-scale, 1));
  }

  .summary-card,
  .empty-card {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.82);
    padding: calc(14px * var(--layout-scale, 1));
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  h3 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
  }

  .meta {
    margin: 0;
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .stats-grid div {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.75);
    padding: calc(10px * var(--layout-scale, 1));
    display: grid;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .stats-grid span {
    color: #93c5fd;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .stats-grid strong {
    color: #f8fafc;
    font-size: calc(18px * var(--text-scale, 1));
  }

  .meta-line {
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .bounties {
    border-radius: 10px;
    border: 1px solid rgba(250, 204, 21, 0.32);
    background: rgba(113, 63, 18, 0.28);
    padding: calc(10px * var(--layout-scale, 1));
    display: grid;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .bounties strong {
    color: #fde68a;
  }

  .bounties span {
    color: #fef3c7;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .share-btn {
    min-height: calc(46px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid rgba(125, 211, 252, 0.6);
    background: linear-gradient(180deg, #0f4c81, #1d4ed8);
    color: #e0f2fe;
    font-weight: 700;
  }

  /* ── Landscape Styles ── */

  .journal-screen-landscape {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    padding: calc(32px * var(--layout-scale, 1)) calc(64px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
  }

  .header-landscape {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: calc(24px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .header-landscape h2 {
    flex-shrink: 0;
  }

  .header-search {
    flex: 1;
  }

  .search-input {
    width: 100%;
    max-width: none;
    height: calc(44px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid #334155;
    background: #0f172a;
    color: #e2e8f0;
    padding: 0 calc(16px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
  }

  .search-input::placeholder {
    color: #475569;
  }

  .summary-card-landscape {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(20px * var(--layout-scale, 1));
    overflow-y: auto;
    align-self: start;
  }

  .summary-left,
  .summary-right {
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
    align-content: start;
  }

  .stats-grid-landscape {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  :global([data-layout="landscape"]) .journal-screen {
    max-width: none;
    padding: calc(32px * var(--layout-scale, 1)) calc(64px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
  }

  /* Stat values */
  :global([data-layout="landscape"]) .header h2 {
    font-size: calc(28px * var(--text-scale, 1));
    white-space: nowrap;
  }

  :global([data-layout="landscape"]) .stats-grid strong {
    font-size: calc(28px * var(--text-scale, 1));
  }

  /* Small labels */
  :global([data-layout="landscape"]) .stats-grid span {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Body text */
  :global([data-layout="landscape"]) .meta-line {
    font-size: calc(15px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .bounties span {
    font-size: calc(13px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .meta {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Empty state: centered with larger, styled text */
  :global([data-layout="landscape"]) .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(240px * var(--layout-scale, 1));
    margin-top: calc(40px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .empty-card h3 {
    font-size: calc(24px * var(--text-scale, 1));
    font-family: 'Cinzel', serif;
    margin: 0 0 calc(8px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .empty-card p {
    font-size: calc(16px * var(--text-scale, 1));
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Dim search input when no entries exist */
  :global([data-layout="landscape"]) .journal-screen-landscape:has(.empty-card) .search-input {
    opacity: 0.3;
    pointer-events: none;
  }

  /* Entry stat rows: min 64px tall, 15px text */
  :global([data-layout="landscape"]) .stats-grid-landscape div {
    min-height: calc(64px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .stats-grid-landscape span {
    font-size: calc(15px * var(--text-scale, 1));
  }
</style>
