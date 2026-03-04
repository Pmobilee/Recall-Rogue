<script lang="ts">
  import { playerSave } from '../stores/playerData'

  const save = $derived($playerSave)

  // Hook 1: Facts close to mastery (items with high repetitions but not yet "mastered" at 60d interval)
  const nearMasteryCount = $derived.by(() => {
    const rs = save?.reviewStates ?? []
    return rs.filter(r => r.repetitions >= 4 && r.repetitions <= 6).length
  })

  // Hook 2: Next room unlock progress
  const roomProgress = $derived.by(() => {
    if (!save) return null
    const totalDives = save.stats?.totalDivesCompleted ?? 0
    const unlockedCount = save.unlockedRooms?.length ?? 1
    // Rough thresholds for room unlocks
    const thresholds = [0, 3, 8, 15, 25, 40, 60]
    const nextThreshold = thresholds[unlockedCount] ?? null
    if (!nextThreshold) return null
    const prevThreshold = thresholds[unlockedCount - 1] ?? 0
    const progress = Math.min(100, Math.round(((totalDives - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    return { current: totalDives, target: nextThreshold, progress }
  })

  // Hook 3: Deepest layer reached
  const deepestLayer = $derived(save?.stats?.deepestLayerReached ?? 0)

  const hasHooks = $derived(nearMasteryCount > 0 || roomProgress !== null)
</script>

{#if hasHooks}
  <div class="post-dive-hooks" aria-label="Progress nudges">
    <h3 class="hooks-title">Almost there...</h3>

    {#if nearMasteryCount > 0}
      <div class="hook-item">
        <span class="hook-icon">[~]</span>
        <span class="hook-text">
          {nearMasteryCount} fact{nearMasteryCount !== 1 ? 's' : ''} close to mastery — a few more reviews and they're permanent
        </span>
      </div>
    {/if}

    {#if roomProgress}
      <div class="hook-item">
        <span class="hook-icon">[+]</span>
        <span class="hook-text">
          {roomProgress.progress}% to next room unlock ({roomProgress.current}/{roomProgress.target} dives)
        </span>
      </div>
    {/if}

    {#if deepestLayer > 0 && deepestLayer < 20}
      <div class="hook-item">
        <span class="hook-icon">[v]</span>
        <span class="hook-text">
          Deepest reach: Layer {deepestLayer} — deeper layers hold rarer artifacts
        </span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .post-dive-hooks {
    background: var(--color-surface, #1e1e2e);
    border-radius: 12px;
    padding: 14px 16px;
    margin: 8px 0;
  }

  .hooks-title {
    color: var(--color-text-dim, #888);
    font-size: 0.78rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0 0 10px;
    font-family: 'Courier New', monospace;
  }

  .hook-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .hook-item:last-child {
    border-bottom: none;
  }

  .hook-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
    color: var(--color-accent, #4a9eff);
    font-family: 'Courier New', monospace;
    font-weight: 700;
  }

  .hook-text {
    color: var(--color-text, #fff);
    font-size: 0.85rem;
    line-height: 1.3;
    font-family: 'Courier New', monospace;
  }
</style>
