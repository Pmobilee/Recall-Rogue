<script lang="ts">
  /**
   * Season Leaderboard overlay.
   * Fetches ranked entries from the season leaderboard API endpoint.
   * Falls back gracefully if offline or API unavailable.
   */

  interface Props {
    seasonId?: string
    seasonName?: string
    boostedCategory?: string
    onClose: () => void
  }

  let { seasonId, seasonName: propSeasonName, boostedCategory, onClose }: Props = $props()

  interface LeaderboardEntry {
    rank: number
    displayName: string
    score: number
    isCurrentPlayer: boolean
  }

  let entries = $state<LeaderboardEntry[]>([])
  let loading = $state(true)
  let displaySeasonName = $state(propSeasonName ?? 'Current Season')
  let seasonEndDate = $state('')

  $effect(() => {
    loadLeaderboard()
  })

  /** Fetch leaderboard data from the season API. */
  async function loadLeaderboard(): Promise<void> {
    loading = true
    try {
      const url = seasonId
        ? `/api/v1/season/${encodeURIComponent(seasonId)}/leaderboard`
        : '/api/v1/season/current/leaderboard'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json() as {
          entries?: LeaderboardEntry[]
          seasonName?: string
          endDate?: string
        }
        entries = data.entries ?? []
        displaySeasonName = data.seasonName ?? propSeasonName ?? 'Current Season'
        seasonEndDate = data.endDate ?? ''
      }
    } catch {
      // Offline or server unavailable — show empty state
    }
    loading = false
  }

  /** Backdrop click to close. */
  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Season Leaderboard"
  onclick={handleBackdropClick}
>
  <div class="panel" role="document">
    <!-- Header -->
    <div class="panel-header">
      <h2 class="panel-title">{displaySeasonName} Leaderboard</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close leaderboard">&#x2715;</button>
    </div>

    <!-- Season metadata -->
    {#if boostedCategory || seasonEndDate}
      <div class="season-meta">
        {#if boostedCategory}
          <span class="meta-item">Boosted: {boostedCategory}</span>
        {/if}
        {#if seasonEndDate}
          <span class="meta-item">Season ends: {seasonEndDate}</span>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="panel-content">
      {#if loading}
        <div class="state-msg" role="status" aria-live="polite">Loading leaderboard...</div>
      {:else if entries.length === 0}
        <div class="state-msg">No leaderboard data available yet.</div>
      {:else}
        <div class="leaderboard-list" aria-label="Leaderboard entries">
          {#each entries as entry (entry.rank)}
            <div
              class="leaderboard-row"
              class:current-player={entry.isCurrentPlayer}
              aria-label="Rank {entry.rank}: {entry.displayName} with {entry.score} points"
            >
              <span class="rank-num" class:top-three={entry.rank <= 3}>#{entry.rank}</span>
              <span class="player-name">{entry.displayName}</span>
              <span class="player-score">{entry.score}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 110;
    pointer-events: auto;
    padding: 16px;
  }

  .panel {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover { color: #e2e8f0; }

  .season-meta {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    flex-shrink: 0;
  }

  .meta-item {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 24px 0;
  }

  .leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .leaderboard-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 12px;
    transition: background 0.12s;
  }

  .leaderboard-row.current-player {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .rank-num {
    font-size: 0.78rem;
    font-weight: 700;
    color: #64748b;
    min-width: 30px;
    flex-shrink: 0;
  }

  .rank-num.top-three {
    color: #f59e0b;
  }

  .player-name {
    font-size: 0.82rem;
    color: #cbd5e1;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .current-player .player-name {
    color: #f59e0b;
    font-weight: 700;
  }

  .player-score {
    font-size: 0.78rem;
    font-weight: 700;
    color: #60a5fa;
    flex-shrink: 0;
  }
</style>
