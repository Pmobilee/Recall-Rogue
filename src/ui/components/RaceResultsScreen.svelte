<!-- RaceResultsScreen.svelte
     Full-screen results comparison shown when both players finish a Race or Duel.
     Displays winner/loser banner, side-by-side stat table with per-row winner
     highlighting, collapsible score breakdown, and action buttons.

     All layout via calc() + --layout-scale / --text-scale. ZERO hardcoded px.
-->
<script lang="ts">
  import type { RaceResults } from '../../data/multiplayerTypes'

  type GameMode = 'race' | 'same_cards' | 'duel'

  interface Props {
    /** Full race/duel results from multiplayerGameService */
    results: RaceResults
    /** The local player's ID — determines VICTORY vs DEFEAT banner */
    localPlayerId: string
    /** Game mode label shown in the header */
    mode: GameMode
    /** Called when the player clicks Play Again */
    onPlayAgain: () => void
    /** Called when the player clicks Return to Lobby */
    onReturnToLobby: () => void
    /** Called when the player clicks Return to Hub */
    onReturnToHub: () => void
  }

  let { results, localPlayerId, mode, onPlayAgain, onReturnToLobby, onReturnToHub }: Props = $props()

  // ── Derived values ──────────────────────────────────────────────────────────

  /** Local player's result entry */
  let localResult = $derived(results.players.find(p => p.playerId === localPlayerId))

  /** Opponent's result entry */
  let opponentResult = $derived(results.players.find(p => p.playerId !== localPlayerId))

  /** Whether the local player won */
  let isVictory = $derived(results.winnerId === localPlayerId)

  /** Column order: local player is always left (P1), opponent is right (P2) */
  let p1 = $derived(localResult)
  let p2 = $derived(opponentResult)

  /** Mode header text */
  let modeLabel = $derived((): string => {
    switch (mode) {
      case 'race': return 'Race Results'
      case 'same_cards': return 'Same Cards Results'
      case 'duel': return 'Duel Results'
      default: return 'Results'
    }
  })

  /** Score breakdown expanded state */
  let breakdownOpen = $state(false)

  // ── Stat table helpers ──────────────────────────────────────────────────────

  /** Format a duration in milliseconds as M:SS */
  function formatDuration(ms: number): string {
    const totalSecs = Math.floor(ms / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  /** Format accuracy as a percentage string */
  function formatAccuracy(acc: number): string {
    return `${Math.round(acc * 100)}%`
  }

  type StatRow = {
    label: string
    p1Val: string | number
    p2Val: string | number
    /** Numeric comparison: positive means p1 wins this row */
    numericP1: number
    numericP2: number
    /** Whether higher is better for this stat */
    higherIsBetter: boolean
  }

  /** Build the stat comparison rows */
  let statRows = $derived((): StatRow[] => {
    if (!p1 || !p2) return []
    return [
      {
        label: 'Score',
        p1Val: p1.score.toLocaleString(),
        p2Val: p2.score.toLocaleString(),
        numericP1: p1.score,
        numericP2: p2.score,
        higherIsBetter: true,
      },
      {
        label: 'Floor Reached',
        p1Val: p1.floorReached,
        p2Val: p2.floorReached,
        numericP1: p1.floorReached,
        numericP2: p2.floorReached,
        higherIsBetter: true,
      },
      {
        label: 'Accuracy',
        p1Val: formatAccuracy(p1.accuracy),
        p2Val: formatAccuracy(p2.accuracy),
        numericP1: p1.accuracy,
        numericP2: p2.accuracy,
        higherIsBetter: true,
      },
      {
        label: 'Facts Answered',
        p1Val: p1.factsAnswered,
        p2Val: p2.factsAnswered,
        numericP1: p1.factsAnswered,
        numericP2: p2.factsAnswered,
        higherIsBetter: true,
      },
      {
        label: 'Correct',
        p1Val: p1.correctAnswers,
        p2Val: p2.correctAnswers,
        numericP1: p1.correctAnswers,
        numericP2: p2.correctAnswers,
        higherIsBetter: true,
      },
      {
        label: 'Duration',
        p1Val: formatDuration(p1.duration),
        p2Val: formatDuration(p2.duration),
        // Lower duration = faster = better
        numericP1: p2.duration,
        numericP2: p1.duration,
        higherIsBetter: false,
      },
    ]
  })

  /**
   * Return indicator class for a cell.
   * 'winner' = this column has the better value for this row.
   * 'loser'  = this column has the worse value.
   * ''       = tied.
   */
  function cellClass(row: StatRow, isP1: boolean): string {
    const mine = isP1 ? row.numericP1 : row.numericP2
    const theirs = isP1 ? row.numericP2 : row.numericP1
    if (mine > theirs) return 'cell-winner'
    if (mine < theirs) return 'cell-loser'
    return 'cell-tied'
  }

  /** Whether p1 wins this stat row (for the arrow indicator) */
  function p1WinsRow(row: StatRow): boolean {
    return row.numericP1 > row.numericP2
  }
</script>

<!-- Full-screen overlay -->
<div class="rr-overlay" role="dialog" aria-modal="true" aria-label="{modeLabel()}">
  <div class="rr-card">

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="rr-header">
      <div class="mode-label">{modeLabel()}</div>
    </div>

    <!-- ── Winner Banner ───────────────────────────────────────────────── -->
    <div
      class="winner-banner"
      class:victory={isVictory}
      class:defeat={!isVictory}
      aria-live="assertive"
    >
      <span class="winner-text">
        {isVictory ? 'VICTORY' : 'DEFEAT'}
      </span>
      {#if isVictory}
        <span class="winner-sub">You were the decisive blade.</span>
      {:else}
        <span class="winner-sub">The dungeon claimed you today.</span>
      {/if}
    </div>

    <!-- ── Comparison Table ─────────────────────────────────────────────── -->
    {#if p1 && p2}
      <div class="comparison-table-wrap">
        <table class="comparison-table" aria-label="Stat comparison">
          <thead>
            <tr>
              <th class="col-stat" scope="col">Stat</th>
              <th
                class="col-player"
                class:winner-col={isVictory}
                scope="col"
                aria-label="{p1.displayName} (You)"
              >
                <div class="col-name">{p1.displayName}</div>
                <div class="col-you-label">You</div>
              </th>
              <th
                class="col-player"
                class:winner-col={!isVictory}
                scope="col"
                aria-label={p2.displayName}
              >
                <div class="col-name">{p2.displayName}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each statRows() as row}
              <tr class="stat-row">
                <td class="stat-label-cell">{row.label}</td>
                <td class="stat-val-cell {cellClass(row, true)}">
                  {#if p1WinsRow(row)}
                    <span class="row-indicator better" aria-hidden="true">▲</span>
                  {:else if row.numericP1 < row.numericP2}
                    <span class="row-indicator worse" aria-hidden="true">▼</span>
                  {/if}
                  {row.p1Val}
                </td>
                <td class="stat-val-cell {cellClass(row, false)}">
                  {#if !p1WinsRow(row) && row.numericP2 > row.numericP1}
                    <span class="row-indicator better" aria-hidden="true">▲</span>
                  {:else if row.numericP2 < row.numericP1}
                    <span class="row-indicator worse" aria-hidden="true">▼</span>
                  {/if}
                  {row.p2Val}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- ── Score Breakdown (collapsible) ──────────────────────────────── -->
      <div class="breakdown-wrap">
        <button
          class="breakdown-toggle"
          onclick={() => { breakdownOpen = !breakdownOpen }}
          aria-expanded={breakdownOpen}
          aria-controls="score-breakdown"
        >
          <span>Score Breakdown</span>
          <span class="breakdown-chevron" aria-hidden="true">{breakdownOpen ? '▲' : '▼'}</span>
        </button>

        {#if breakdownOpen}
          <div id="score-breakdown" class="breakdown-body" role="region" aria-label="Score breakdown">
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th class="bk-col-label">Component</th>
                  <th class="bk-col-formula">Formula</th>
                  <th class="bk-col-you">You</th>
                  <th class="bk-col-them">Them</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Floors</td>
                  <td class="formula">× 100</td>
                  <td>{(p1.floorReached * 100).toLocaleString()}</td>
                  <td>{(p2.floorReached * 100).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Correct</td>
                  <td class="formula">× 10</td>
                  <td>{(p1.correctAnswers * 10).toLocaleString()}</td>
                  <td>{(p2.correctAnswers * 10).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Wrong</td>
                  <td class="formula">× −5</td>
                  <td class="penalty">
                    -{((p1.factsAnswered - p1.correctAnswers) * 5).toLocaleString()}
                  </td>
                  <td class="penalty">
                    -{((p2.factsAnswered - p2.correctAnswers) * 5).toLocaleString()}
                  </td>
                </tr>
                <tr class="bk-total-row">
                  <td colspan={2} class="bk-total-label">Total Score</td>
                  <td class="bk-total-val">{p1.score.toLocaleString()}</td>
                  <td class="bk-total-val">{p2.score.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p class="breakdown-note">
              Additional score from chain multipliers, damage dealt, and perfect encounter bonuses.
            </p>
          </div>
        {/if}
      </div>

    {:else if p1}
      <!-- ── Single-player fallback (opponent disconnected / walkover) ── -->
      <div class="single-player-wrap" data-testid="race-results-single-player">
        <p class="single-player-note">
          Your opponent left before the race ended. Here's how you did on your own.
        </p>
        <div class="solo-stat-list" aria-label="Your solo stats">
          <div class="solo-stat-row">
            <span class="solo-stat-label">Score</span>
            <span class="solo-stat-val">{p1.score.toLocaleString()}</span>
          </div>
          <div class="solo-stat-row">
            <span class="solo-stat-label">Floor Reached</span>
            <span class="solo-stat-val">{p1.floorReached}</span>
          </div>
          <div class="solo-stat-row">
            <span class="solo-stat-label">Accuracy</span>
            <span class="solo-stat-val">{formatAccuracy(p1.accuracy)}</span>
          </div>
          <div class="solo-stat-row">
            <span class="solo-stat-label">Facts Answered</span>
            <span class="solo-stat-val">{p1.factsAnswered}</span>
          </div>
          <div class="solo-stat-row">
            <span class="solo-stat-label">Correct</span>
            <span class="solo-stat-val">{p1.correctAnswers}</span>
          </div>
          <div class="solo-stat-row">
            <span class="solo-stat-label">Duration</span>
            <span class="solo-stat-val">{formatDuration(p1.duration)}</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Action Buttons ──────────────────────────────────────────────── -->
    <div class="rr-actions">
      <button class="action-btn btn-play-again" onclick={onPlayAgain}>
        Play Again
      </button>
      <button class="action-btn btn-lobby" onclick={onReturnToLobby}>
        Return to Lobby
      </button>
      <button class="action-btn btn-hub" onclick={onReturnToHub}>
        Return to Hub
      </button>
    </div>

  </div>
</div>

<style>
  /* ── Full-screen overlay ── */
  .rr-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 6, 14, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    backdrop-filter: blur(6px);
    font-family: var(--font-body, 'Lora', serif);
    color: #e0e0e0;
  }

  /* ── Centered card ── */
  .rr-card {
    width: calc(820px * var(--layout-scale, 1));
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    background: rgba(10, 14, 28, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(16px * var(--layout-scale, 1));
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 calc(8px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0,0,0,0.8);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .rr-header {
    padding: calc(20px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) 0;
  }

  .mode-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    font-weight: 600;
    text-align: center;
  }

  /* ── Winner Banner ── */
  .winner-banner {
    padding: calc(20px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .winner-text {
    font-size: calc(40px * var(--text-scale, 1));
    font-weight: 900;
    letter-spacing: calc(4px * var(--layout-scale, 1));
    text-transform: uppercase;
    line-height: 1;
    display: block;
  }

  .winner-banner.victory .winner-text {
    color: #2ecc71;
    text-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) rgba(46, 204, 113, 0.6),
      0 0 calc(60px * var(--layout-scale, 1)) rgba(46, 204, 113, 0.2);
  }

  .winner-banner.defeat .winner-text {
    color: #e74c3c;
    text-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) rgba(231, 76, 60, 0.5),
      0 0 calc(60px * var(--layout-scale, 1)) rgba(231, 76, 60, 0.2);
  }

  .winner-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255,255,255,0.35);
    font-style: italic;
  }

  /* ── Comparison Table ── */
  .comparison-table-wrap {
    padding: calc(20px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) 0;
    overflow-x: auto;
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .comparison-table thead tr {
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .col-stat {
    width: 38%;
    text-align: left;
    padding: 0 0 calc(10px * var(--layout-scale, 1)) 0;
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255,255,255,0.3);
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    font-weight: 600;
  }

  .col-player {
    width: 31%;
    text-align: center;
    padding: 0 calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    transition: background 0.3s ease;
    border-radius: calc(8px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) 0 0;
  }

  .col-player.winner-col {
    /* Subtle gold border/glow for the winning column header */
    background: rgba(241, 196, 15, 0.06);
    border: 1px solid rgba(241, 196, 15, 0.2);
    border-bottom: none;
  }

  .col-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #f0f0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(180px * var(--layout-scale, 1));
    margin: 0 auto;
  }

  .col-you-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: calc(0.8px * var(--layout-scale, 1));
  }

  /* Stat rows */
  .stat-row {
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .stat-row:last-child {
    border-bottom: none;
  }

  .stat-label-cell {
    padding: calc(10px * var(--layout-scale, 1)) 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255,255,255,0.55);
    font-weight: 500;
    text-align: left;
  }

  .stat-val-cell {
    padding: calc(10px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
    position: relative;
    transition: color 0.3s ease;
  }

  .stat-val-cell.cell-winner {
    color: #f0f0f0;
  }

  .stat-val-cell.cell-loser {
    color: rgba(255,255,255,0.35);
  }

  .stat-val-cell.cell-tied {
    color: rgba(255,255,255,0.6);
  }

  /* Winning column gets gold background in body cells too */
  .winner-col ~ .stat-val-cell.cell-winner,
  .col-player.winner-col + .stat-val-cell {
    background: rgba(241, 196, 15, 0.04);
  }

  .row-indicator {
    font-size: calc(9px * var(--text-scale, 1));
    margin-right: calc(3px * var(--layout-scale, 1));
    vertical-align: middle;
  }

  .row-indicator.better {
    color: #2ecc71;
  }

  .row-indicator.worse {
    color: rgba(231, 76, 60, 0.6);
  }

  /* ── Score Breakdown ── */
  .breakdown-wrap {
    margin: calc(16px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) 0;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: calc(8px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .breakdown-toggle {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: none;
    cursor: pointer;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    color: rgba(255,255,255,0.5);
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: calc(0.8px * var(--layout-scale, 1));
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.2s ease;
  }

  .breakdown-toggle:hover {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.7);
  }

  .breakdown-chevron {
    font-size: calc(9px * var(--text-scale, 1));
  }

  .breakdown-body {
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .breakdown-table {
    width: 100%;
    border-collapse: collapse;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .breakdown-table th {
    text-align: left;
    color: rgba(255,255,255,0.3);
    font-size: calc(10px * var(--text-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.6px * var(--layout-scale, 1));
    padding-bottom: calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  .breakdown-table td {
    padding: calc(7px * var(--layout-scale, 1)) 0;
    color: rgba(255,255,255,0.65);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-variant-numeric: tabular-nums;
  }

  .breakdown-table .formula {
    color: rgba(255,255,255,0.3);
    font-size: calc(10px * var(--text-scale, 1));
    padding-left: calc(8px * var(--layout-scale, 1));
  }

  .breakdown-table .penalty {
    color: #e74c3c;
  }

  .bk-col-label { width: 36%; }
  .bk-col-formula { width: 18%; }
  .bk-col-you,
  .bk-col-them { width: 23%; text-align: right; }

  .breakdown-table td:nth-child(3),
  .breakdown-table td:nth-child(4) {
    text-align: right;
  }

  .bk-total-row td {
    border-bottom: none;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: calc(10px * var(--layout-scale, 1));
  }

  .bk-total-label {
    font-weight: 700;
    color: #f0f0f0;
    font-size: calc(13px * var(--text-scale, 1));
  }

  .bk-total-val {
    font-weight: 700;
    color: #FFD700;
    font-size: calc(14px * var(--text-scale, 1));
  }

  .breakdown-note {
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255,255,255,0.25);
    margin-top: calc(8px * var(--layout-scale, 1));
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Action Buttons ── */
  .rr-actions {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    justify-content: center;
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-wrap: wrap;
  }

  .action-btn {
    padding: calc(12px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    border: 1px solid transparent;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: filter 0.2s ease, transform 0.1s ease;
    letter-spacing: calc(0.3px * var(--layout-scale, 1));
  }

  .action-btn:hover {
    filter: brightness(1.12);
  }

  .action-btn:active {
    transform: scale(0.97);
  }

  .btn-play-again {
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    color: #fff;
    box-shadow: 0 0 calc(16px * var(--layout-scale, 1)) rgba(46, 204, 113, 0.3);
  }

  .btn-lobby {
    background: rgba(52, 73, 94, 0.7);
    color: #d0d0d0;
    border-color: rgba(255,255,255,0.12);
  }

  .btn-hub {
    background: rgba(30, 35, 55, 0.7);
    color: rgba(255,255,255,0.5);
    border-color: rgba(255,255,255,0.08);
  }

  /* ── Single-player fallback ── */
  .single-player-wrap {
    margin: calc(20px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) 0;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(16px * var(--layout-scale, 1));
  }

  .single-player-note {
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.45);
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  .solo-stat-list {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .solo-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .solo-stat-row:last-child {
    border-bottom: none;
  }

  .solo-stat-label {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 500;
  }

  .solo-stat-val {
    color: #f0f0f0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-size: calc(16px * var(--text-scale, 1));
  }
</style>
