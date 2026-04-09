<!-- MultiplayerHUD.svelte
     Race Mode opponent progress HUD — compact overlay panel, top-right corner.
     Expands on click to show full stats. Not wired into app flow yet. -->
<script lang="ts">
  import type { RaceProgress, MultiplayerMode } from '../../data/multiplayerTypes'

  interface Props {
    /** Race progress data for the opponent being displayed */
    progress: RaceProgress
    /** Opponent's display name */
    displayName: string
    /** Multiplayer game mode — controls which stats are visible */
    mode: MultiplayerMode
  }

  let { progress, displayName, mode }: Props = $props()

  /** Toggle expanded view */
  let expanded = $state(false)

  /** Computed HP percentage clamped 0–100 */
  let hpPercent = $derived(
    progress.playerMaxHp > 0
      ? Math.max(0, Math.min(100, (progress.playerHp / progress.playerMaxHp) * 100))
      : 0
  )

  /** HP bar colour: green above 50%, amber 25-50%, red below 25% */
  let hpColor = $derived(
    hpPercent > 50 ? '#e74c3c' : hpPercent > 25 ? '#e67e22' : '#c0392b'
  )

  /** Human-readable accuracy */
  let accuracyPct = $derived(Math.round(progress.accuracy * 100))

  /** Status string */
  let statusText = $derived((): string => {
    if (!progress.isFinished) {
      return 'In Combat'
    }
    if (progress.result === 'victory') return 'Finished — Victory'
    if (progress.result === 'defeat') return 'Finished — Defeat'
    if (progress.result === 'retreat') return 'Finished — Retreated'
    return 'Finished'
  })

  let isFinished = $derived(progress.isFinished)
</script>

<div
  class="mp-hud"
  class:expanded
  class:finished={isFinished}
  role="complementary"
  aria-label="Opponent progress: {displayName}"
>
  <!-- Compact header — always visible -->
  <button
    class="hud-toggle"
    onclick={() => { expanded = !expanded }}
    aria-expanded={expanded}
    aria-label="{expanded ? 'Collapse' : 'Expand'} opponent HUD"
  >
    <span class="opp-name" title={displayName}>{displayName}</span>
    <span class="floor-badge" aria-label="Floor {progress.floor}">
      F{progress.floor}
    </span>
    <div
      class="mini-hp-bar"
      role="progressbar"
      aria-label="HP {progress.playerHp} of {progress.playerMaxHp}"
      aria-valuenow={progress.playerHp}
      aria-valuemin={0}
      aria-valuemax={progress.playerMaxHp}
    >
      <div
        class="mini-hp-fill"
        style="width: {hpPercent}%; background: {hpColor};"
      ></div>
    </div>
    <span class="expand-icon" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
  </button>

  <!-- Expanded detail — shown when open -->
  {#if expanded}
    <div class="hud-detail" role="region" aria-label="Full opponent stats">

      <!-- HP bar with label -->
      <div class="stat-row hp-row">
        <span class="stat-label">HP</span>
        <div
          class="hp-bar"
          role="progressbar"
          aria-valuenow={progress.playerHp}
          aria-valuemin={0}
          aria-valuemax={progress.playerMaxHp}
        >
          <div
            class="hp-fill"
            style="width: {hpPercent}%; background: linear-gradient(to right, {hpColor}cc, {hpColor});"
          ></div>
        </div>
        <span class="hp-numbers" aria-live="polite">
          {progress.playerHp}<span class="hp-slash">/</span>{progress.playerMaxHp}
        </span>
      </div>

      <!-- Score -->
      <div class="stat-row">
        <span class="stat-label">Score</span>
        <span class="stat-value score-value" aria-live="polite">{progress.score.toLocaleString()}</span>
      </div>

      <!-- Accuracy -->
      <div class="stat-row">
        <span class="stat-label">Accuracy</span>
        <span class="stat-value" aria-live="polite">{accuracyPct}%</span>
      </div>

      <!-- Encounters Won: only shown in race mode (coop doesn't track encounters won) -->
      {#if mode === 'race'}
      <div class="stat-row">
        <span class="stat-label">Encounters</span>
        <span class="stat-value">{progress.encountersWon}</span>
      </div>
      {/if}

      <!-- Status -->
      <div class="status-row" aria-live="polite">
        <span
          class="status-pill"
          class:in-combat={!isFinished}
          class:victory={isFinished && progress.result === 'victory'}
          class:defeat={isFinished && (progress.result === 'defeat' || progress.result === 'retreat')}
        >
          {statusText()}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ── Root ── */
  .mp-hud {
    position: fixed;
    /* Sit just below the fog meter (which sits below the topbar). topbar = 4.5vh, fog ≈ 28px. */
    top: calc(var(--topbar-height, 4.5vh) + 36px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
    right: auto;
    width: calc(260px * var(--layout-scale, 1));
    background: rgba(10, 12, 20, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(10px * var(--layout-scale, 1));
    backdrop-filter: blur(8px);
    /* Above topbar (200) and fog meter (199) so it's not occluded. */
    z-index: 205;
    font-family: var(--font-body, 'Lora', serif);
    color: #e0e0e0;
    overflow: hidden;
    transition: width 0.2s ease;
  }

  .mp-hud.finished {
    border-color: rgba(255, 215, 0, 0.3);
  }

  /* ── Toggle button (compact header) ── */
  .hud-toggle {
    display: flex;
    align-items: center;
    gap: calc(7px * var(--layout-scale, 1));
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: calc(9px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    color: #e0e0e0;
    min-height: calc(44px * var(--layout-scale, 1));
    text-align: left;
  }

  .hud-toggle:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .opp-name {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    color: #e8e8e8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(90px * var(--layout-scale, 1));
    flex-shrink: 1;
  }

  .floor-badge {
    font-size: calc(10px * var(--text-scale, 1));
    background: rgba(255, 215, 0, 0.16);
    color: #FFD700;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    font-weight: 700;
    flex-shrink: 0;
  }

  .mini-hp-bar {
    flex: 1;
    height: calc(5px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(3px * var(--layout-scale, 1));
    overflow: hidden;
    min-width: calc(40px * var(--layout-scale, 1));
  }

  .mini-hp-fill {
    height: 100%;
    border-radius: calc(3px * var(--layout-scale, 1));
    transition: width 0.4s ease;
  }

  .expand-icon {
    font-size: calc(8px * var(--text-scale, 1));
    color: #666;
    flex-shrink: 0;
  }

  /* ── Expanded Detail ── */
  .hud-detail {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  /* Stat rows */
  .stat-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    min-height: calc(22px * var(--layout-scale, 1));
  }

  .stat-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #666;
    text-transform: uppercase;
    letter-spacing: calc(0.8px * var(--layout-scale, 1));
    width: calc(68px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .stat-value {
    font-size: calc(13px * var(--text-scale, 1));
    color: #e0e0e0;
    font-weight: 600;
    flex: 1;
    text-align: right;
  }

  .score-value {
    color: #FFD700;
  }

  /* HP full bar */
  .hp-row {
    gap: calc(6px * var(--layout-scale, 1));
  }

  .hp-bar {
    flex: 1;
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(4px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .hp-fill {
    height: 100%;
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: width 0.4s ease;
  }

  .hp-numbers {
    font-size: calc(11px * var(--text-scale, 1));
    color: #aaa;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .hp-slash {
    color: #555;
    margin: 0 calc(2px * var(--layout-scale, 1));
  }

  /* Status pill */
  .status-row {
    display: flex;
    justify-content: flex-end;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .status-pill {
    font-size: calc(10px * var(--text-scale, 1));
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid transparent;
    font-weight: 600;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
  }

  .status-pill.in-combat {
    background: rgba(231, 76, 60, 0.15);
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.3);
  }

  .status-pill.victory {
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border-color: rgba(46, 204, 113, 0.3);
  }

  .status-pill.defeat {
    background: rgba(100, 100, 100, 0.15);
    color: #888;
    border-color: rgba(100, 100, 100, 0.3);
  }
</style>
