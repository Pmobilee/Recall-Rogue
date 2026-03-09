<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { authStore } from '../stores/authStore'
  import { currentScreen, currentLayer, tickCount } from '../stores/gameState'
  import { derived } from 'svelte/store'
  import { getMasteryLevel } from '../../services/sm2'

  /** Whether the player is currently mining. */
  const isMining = $derived($currentScreen === 'mining')

  /** Number of facts due for review right now. */
  const dueCount = derived(playerSave, (save) => {
    if (!save) return 0
    const now = Date.now()
    return (save.reviewStates ?? []).filter(
      (rs) => rs && rs.nextReviewAt !== undefined && rs.nextReviewAt <= now
    ).length
  })

  const dueUrgency = derived(dueCount, (n) =>
    n > 20 ? 'high' : n > 5 ? 'medium' : 'low'
  )

  const displayName = derived(authStore, (auth) => auth.displayName ?? 'Miner')

  const currentStreak = derived(playerSave, (save) => save?.stats?.currentStreak ?? 0)

  const totalMastered = derived(playerSave, (save) => {
    if (!save) return 0
    return (save.reviewStates ?? []).filter(
      (rs) => rs && getMasteryLevel(rs) === 'mastered'
    ).length
  })
</script>

<aside class="desktop-side-panel" aria-label="Session overview">
  {#if isMining}
    <div class="panel-player">
      <span class="panel-avatar">⛏</span>
      <div class="panel-info">
        <span class="panel-name">Mining</span>
        <span class="panel-streak">Layer {($currentLayer ?? 0) + 1}</span>
      </div>
    </div>

    <div class="panel-stats">
      <div class="stat-row">
        <span class="stat-label">Blocks Mined</span>
        <span class="stat-value">{$tickCount ?? 0}</span>
      </div>
    </div>
  {:else}
    <div class="panel-player">
      <span class="panel-avatar">⛏</span>
      <div class="panel-info">
        <span class="panel-name">{$displayName}</span>
        <span class="panel-streak">
          {$currentStreak} day streak
        </span>
      </div>
    </div>

    <div class="panel-stats">
      <div class="stat-row">
        <span class="stat-label">Facts Mastered</span>
        <span class="stat-value">{$totalMastered}</span>
      </div>
      <div class="stat-row due-row" data-urgency={$dueUrgency}>
        <span class="stat-label">Due for Review</span>
        <span class="stat-value due-count">{$dueCount}</span>
      </div>
    </div>

    <div class="panel-shortcuts">
      <details>
        <summary class="shortcuts-summary">Keyboard Shortcuts</summary>
        <dl class="shortcuts-list">
          <div><dt>D</dt><dd>Dive / Enter Mine</dd></div>
          <div><dt>S</dt><dd>Study Queue</dd></div>
          <div><dt>Esc</dt><dd>Back / Close</dd></div>
          <div><dt>1–4</dt><dd>Quiz answers</dd></div>
          <div><dt>M</dt><dd>Toggle mini-map</dd></div>
          <div><dt>?</dt><dd>Shortcut help overlay</dd></div>
        </dl>
      </details>
    </div>
  {/if}
</aside>

<style>
  .desktop-side-panel {
    display: none;
  }

  @media (min-width: 1200px) and (pointer: fine) {
    .desktop-side-panel {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      background: #111827;
      border-left: 1px solid #1f2937;
      height: 100vh;
      overflow-y: auto;
      position: fixed;
      right: 0;
      top: 0;
      width: calc(100vw - 520px);
      max-width: 420px;
    }
  }

  .panel-player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .panel-avatar {
    font-size: 2rem;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .panel-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .panel-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    font-family: var(--font-body);
  }

  .panel-streak {
    font-size: 0.8rem;
    color: var(--color-warning);
  }

  .panel-stats {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    border: 1px solid #1f2937;
    border-radius: 10px;
    padding: 0.875rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    font-family: var(--font-body);
  }

  .stat-label { color: var(--color-text-dim); }
  .stat-value { font-weight: 700; color: var(--color-text); }

  .due-row[data-urgency="high"] .due-count { color: #f87171; }
  .due-row[data-urgency="medium"] .due-count { color: var(--color-warning); }
  .due-row[data-urgency="low"] .due-count { color: var(--color-success); }

  .shortcuts-summary {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    cursor: pointer;
    font-family: var(--font-body);
    padding: 0.25rem 0;
  }

  .shortcuts-list {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .shortcuts-list > div {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8rem;
    font-family: var(--font-body);
  }

  .shortcuts-list dt {
    min-width: 2.5rem;
    font-weight: 700;
    color: var(--color-accent);
    background: rgba(233, 69, 96, 0.1);
    border: 1px solid rgba(233, 69, 96, 0.3);
    border-radius: 4px;
    text-align: center;
    padding: 0.1rem 0.3rem;
    font-size: 0.75rem;
  }

  .shortcuts-list dd { color: var(--color-text-dim); }
</style>
