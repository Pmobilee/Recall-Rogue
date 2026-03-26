<!-- Co-op Loot Summary — end-of-dive overlay shown to both players simultaneously.
     Displays individual loot contributions, cooperation bonuses, and totals. -->
<script lang="ts">
  interface LootSplitEntry {
    playerId: string
    displayName: string
    role: 'miner' | 'scholar'
    base: Record<string, number>
    cooperationBonus: Record<string, number>
    total: Record<string, number>
  }

  interface Props {
    splits: LootSplitEntry[]
    bothActive: boolean
    onDone: () => void
  }

  let { splits = [], bothActive = false, onDone }: Props = $props()

  function mineralKeys(obj: Record<string, number>): string[] {
    return Object.keys(obj).filter(k => (obj[k] ?? 0) > 0)
  }
</script>

<div class="summary-overlay" role="dialog" aria-label="Co-op Loot Summary">
  <div class="summary-panel">
    <h2 class="title">Dive Complete!</h2>
    {#if bothActive}
      <p class="coop-badge">Cooperation Bonus Earned!</p>
    {/if}

    <div class="split-columns">
      {#each splits as split}
        <div class="player-col">
          <p class="player-name">{split.displayName} <span class="role-tag">({split.role})</span></p>
          {#each mineralKeys(split.total) as m}
            <div class="loot-row">
              <span class="mineral-name">{m}</span>
              <span class="mineral-base">{split.base[m] ?? 0}</span>
              {#if (split.cooperationBonus[m] ?? 0) > 0}
                <span class="mineral-bonus">+{split.cooperationBonus[m]}</span>
              {/if}
              <span class="mineral-total">{split.total[m]}</span>
            </div>
          {/each}
          {#if mineralKeys(split.total).length === 0}
            <p class="no-loot">No loot</p>
          {/if}
        </div>
      {/each}
    </div>

    <button class="done-btn" onclick={onDone}>Return to Dome</button>
  </div>
</div>

<style>
  .summary-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.92);
    display: flex; align-items: center; justify-content: center;
    z-index: 300; pointer-events: auto;
  }
  .summary-panel {
    background: #16213e; border: 1px solid #4ecca3; border-radius: 10px;
    padding: 28px; min-width: 320px; max-width: 480px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .title { font-family: var(--font-rpg); font-size: 13px; color: #4ecca3; margin: 0; }
  .coop-badge { background: #4ecca3; color: #16213e; padding: 4px 12px; border-radius: 4px; font-size: 11px; }
  .split-columns { display: flex; gap: 24px; width: 100%; justify-content: center; }
  .player-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .player-name { font-size: 11px; color: #e0e0e0; margin: 0 0 8px; }
  .role-tag { color: #888; font-size: 10px; }
  .loot-row { display: flex; gap: 6px; font-size: 11px; align-items: center; }
  .mineral-name { flex: 1; color: #aaa; }
  .mineral-base { color: #ccc; }
  .mineral-bonus { color: #4ecca3; }
  .mineral-total { font-weight: bold; color: #fff; }
  .no-loot { color: #555; font-size: 11px; }
  .done-btn {
    padding: 12px 32px; background: #e94560; color: #fff; border: none;
    border-radius: 6px; font-family: var(--font-rpg); font-size: 11px; cursor: pointer;
  }
</style>
