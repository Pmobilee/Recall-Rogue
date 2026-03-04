<script lang="ts">
  import { diveResults } from '../stores/gameState'
  import { playerSave } from '../stores/playerData'
  import { BALANCE } from '../../data/balance'
  import PostDiveHooks from './PostDiveHooks.svelte'

  interface Props {
    onContinue: () => void
  }

  let { onContinue }: Props = $props()

  /**
   * Derive an informational GAIA hook line to show at the bottom of the results
   * screen (DD-V2-137). Uses warm, progress-oriented language — no urgency.
   */
  const gaiaHook = $derived((): string => {
    const save = $playerSave
    if (!save) return ''

    const learned = save.learnedFacts.length
    const dives = save.stats.totalDivesCompleted

    // Find the next dome room the player hasn't unlocked yet
    const unlockedRooms = save.unlockedRooms ?? ['command']
    const nextRoom = BALANCE.DOME_ROOMS.find(
      r => r.unlockDives > 0 && !unlockedRooms.includes(r.id),
    )

    if (nextRoom) {
      const divesLeft = nextRoom.unlockDives - dives
      if (divesLeft <= 0) {
        return `The ${nextRoom.name} just unlocked — check it out!`
      }
      return `${divesLeft} more dive${divesLeft === 1 ? '' : 's'} until the ${nextRoom.name} opens up.`
    }

    // All rooms unlocked — show a warm fact-count message
    if (learned === 0) {
      return 'Every block you mine is a story waiting to be told.'
    }
    return `You carry ${learned} piece${learned === 1 ? '' : 's'} of rediscovered knowledge. Keep digging.`
  })
</script>

<div class="results-overlay">
  <div class="results-card">
    <h2 class="results-title">
      {$diveResults?.forced ? 'Oxygen Depleted!' : 'Dive Complete!'}
    </h2>

    {#if $diveResults?.forced}
      <p class="warning-text">30% of loot was lost in the scramble to surface.</p>
    {/if}

    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">Max Depth</span>
        <span class="stat-value">{$diveResults?.maxDepth ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Blocks Mined</span>
        <span class="stat-value">{$diveResults?.blocksMined ?? 0}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Dust Collected</span>
        <span class="stat-value">{$diveResults?.dustCollected ?? 0}</span>
      </div>
      {#if ($diveResults?.shardsCollected ?? 0) > 0}
        <div class="stat-row">
          <span class="stat-label">Shards Collected</span>
          <span class="stat-value shard-value">{$diveResults?.shardsCollected ?? 0}</span>
        </div>
      {/if}
      {#if ($diveResults?.crystalsCollected ?? 0) > 0}
        <div class="stat-row">
          <span class="stat-label">Crystals Collected</span>
          <span class="stat-value crystal-value">{$diveResults?.crystalsCollected ?? 0}</span>
        </div>
      {/if}
      {#if ($diveResults?.geodesCollected ?? 0) > 0}
        <div class="stat-row">
          <span class="stat-label">Geodes Collected</span>
          <span class="stat-value geode-value">{$diveResults?.geodesCollected ?? 0}</span>
        </div>
      {/if}
      {#if ($diveResults?.essenceCollected ?? 0) > 0}
        <div class="stat-row">
          <span class="stat-label">Essence Collected</span>
          <span class="stat-value essence-value">{$diveResults?.essenceCollected ?? 0}</span>
        </div>
      {/if}
      <div class="stat-row">
        <span class="stat-label">Artifacts Found</span>
        <span class="stat-value">{$diveResults?.artifactsFound ?? 0}</span>
      </div>
      {#if ($diveResults?.streakDay ?? 0) > 0}
        <div class="stat-row streak-row">
          <span class="stat-label">Streak</span>
          <span class="stat-value streak-value">
            {$diveResults?.streakDay} day{($diveResults?.streakDay ?? 0) > 1 ? 's' : ''}
            {#if $diveResults?.streakBonus}
              +1 tank!
            {/if}
          </span>
        </div>
      {/if}
    </div>

    {#if gaiaHook()}
      <p class="gaia-hook" aria-live="polite">
        {gaiaHook()}
      </p>
    {/if}

    <PostDiveHooks />

    <button class="continue-btn" type="button" onclick={onContinue}>
      Continue
    </button>
  </div>
</div>

<style>
  .results-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.85);
    font-family: 'Courier New', monospace;
  }

  .results-card {
    width: min(100%, 28rem);
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    border: 2px solid var(--color-primary);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: center;
  }

  .results-title {
    margin: 0;
    font-size: 1.4rem;
    color: var(--color-warning);
  }

  .warning-text {
    color: var(--color-accent);
    font-size: 0.9rem;
    margin: 0;
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color-text) 15%, var(--color-surface) 85%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
  }

  .stat-label {
    color: var(--color-text-dim);
    font-size: 0.95rem;
  }

  .stat-value {
    color: var(--color-success);
    font-weight: 700;
    font-size: 1rem;
  }

  .shard-value {
    color: var(--color-warning);
  }

  .crystal-value {
    color: var(--color-accent);
  }

  .geode-value {
    color: #9b59b6;
  }

  .essence-value {
    color: #ffd700;
    text-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
  }

  .streak-row {
    border-color: color-mix(in srgb, var(--color-warning) 30%, var(--color-surface) 70%);
  }

  .streak-value {
    color: var(--color-warning) !important;
  }

  .continue-btn {
    min-height: 48px;
    border: 2px solid var(--color-primary);
    border-radius: 999px;
    padding: 0.75rem 1.5rem;
    background: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface) 75%);
    color: var(--color-text);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 120ms ease;
  }

  .continue-btn:active {
    transform: scale(0.98);
  }

  .gaia-hook {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface) 88%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent 70%);
    font-size: 0.88rem;
    color: var(--color-text-dim);
    line-height: 1.45;
    font-style: italic;
    text-align: center;
  }
</style>
