<script lang="ts">
  import { shareRunSummaryCard } from '../../services/runShareService'
  import type { RunSummary } from '../../services/hubState'

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
        completedBounties: summary.completedBounties,
        duration: summary.runDurationMs,
        runDurationMs: summary.runDurationMs,
        rewardMultiplier: 1,
        currencyEarned: summary.goldEarned,
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
      <div class="meta-line">Run time: {formatDuration(summary.runDurationMs)} • Best combo: x{summary.bestCombo}</div>

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

<style>
  .journal-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 16px 16px 96px;
    background: linear-gradient(180deg, #0a1528, #101d33);
    color: #e2e8f0;
    display: grid;
    gap: 12px;
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
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 12px;
  }

  .summary-card,
  .empty-card {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.82);
    padding: 14px;
    display: grid;
    gap: 10px;
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
    gap: 8px;
  }

  .stats-grid div {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 23, 42, 0.75);
    padding: 10px;
    display: grid;
    gap: 4px;
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
    padding: 10px;
    display: grid;
    gap: 4px;
  }

  .bounties strong {
    color: #fde68a;
  }

  .bounties span {
    color: #fef3c7;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .share-btn {
    min-height: 46px;
    border-radius: 10px;
    border: 1px solid rgba(125, 211, 252, 0.6);
    background: linear-gradient(180deg, #0f4c81, #1d4ed8);
    color: #e0f2fe;
    font-weight: 700;
  }
</style>
