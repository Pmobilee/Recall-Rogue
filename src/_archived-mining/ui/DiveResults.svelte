<script lang="ts">
  import { diveResults } from '../stores/gameState'
  import { playerSave } from '../stores/playerData'
  import { BALANCE } from '../../data/balance'
  import PostDiveHooks from './PostDiveHooks.svelte'
  import ShareCardModal from './ShareCardModal.svelte'

  interface Props {
    onContinue: () => void
    onDiveDeeper?: () => void
  }

  let { onContinue, onDiveDeeper }: Props = $props()

  /** Whether the share card modal is open. */
  let showShareCard = $state(false)

  /**
   * True when the current dive's depth is a new personal best.
   * Compares diveResults.maxDepth against deepestLayerReached in the player save.
   * Note: deepestLayerReached is updated AFTER the dive results screen shows, so we
   * compare to the value BEFORE the save was updated (i.e. the previous record).
   */
  const isPersonalBest = $derived((): boolean => {
    const results = $diveResults
    const save = $playerSave
    if (!results || !save) return false
    // deepestLayerReached stores the all-time best; compare the fresh dive depth
    const previous = save.stats?.deepestLayerReached ?? 0
    return results.maxDepth > previous
  })

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

    <div class="loot-card">
      <h3 class="loot-title">Loot Secured</h3>
      {#if $diveResults?.lootLostToForce}
        <p class="loot-warning">Run cut short — 30% of minerals lost</p>
      {:else if !$diveResults?.forced}
        <p class="loot-safe">Safe return — all loot secured</p>
      {/if}
      <div class="loot-grid">
        {#if ($diveResults?.dustCollected ?? 0) > 0}
          <div class="loot-item">+{$diveResults?.dustCollected} Dust</div>
        {/if}
        {#if ($diveResults?.shardsCollected ?? 0) > 0}
          <div class="loot-item shard-value">+{$diveResults?.shardsCollected} Shards</div>
        {/if}
        {#if ($diveResults?.crystalsCollected ?? 0) > 0}
          <div class="loot-item crystal-value">+{$diveResults?.crystalsCollected} Crystals</div>
        {/if}
        {#if ($diveResults?.geodesCollected ?? 0) > 0}
          <div class="loot-item geode-value">+{$diveResults?.geodesCollected} Geodes</div>
        {/if}
        {#if ($diveResults?.essenceCollected ?? 0) > 0}
          <div class="loot-item essence-value">+{$diveResults?.essenceCollected} Essence</div>
        {/if}
        {#if ($diveResults?.artifactNames?.length ?? 0) > 0}
          <div class="loot-item">{$diveResults?.artifactNames?.length} Artifact(s)</div>
        {/if}
        {#if ($diveResults?.relicNames?.length ?? 0) > 0}
          <div class="loot-item">{$diveResults?.relicNames?.length} Relic(s)</div>
        {/if}
      </div>
      <div class="run-stats">
        <span>Blocks mined: {$diveResults?.blocksMined ?? 0}</span>
        <span>Depth: Layer {($diveResults?.layersReached ?? 0) + 1}</span>
      </div>
      {#if ($diveResults?.streakDay ?? 0) > 0}
        <div class="streak-info">
          Streak: {$diveResults?.streakDay} day{($diveResults?.streakDay ?? 0) > 1 ? 's' : ''}
          {#if $diveResults?.streakBonus}
            — +1 tank!
          {/if}
        </div>
      {/if}
    </div>

    {#if gaiaHook()}
      <p class="gaia-hook" aria-live="polite">
        {gaiaHook()}
      </p>
    {/if}

    <PostDiveHooks />

    {#if isPersonalBest() && ($diveResults?.maxDepth ?? 0) > 0}
      <button
        class="share-btn"
        type="button"
        onclick={() => { showShareCard = true }}
        aria-label="Share your personal best dive"
      >
        Share Personal Best
      </button>
    {/if}

    <div class="cta-row">
      {#if $diveResults?.canDiveDeeper && onDiveDeeper}
        <button class="continue-btn secondary" type="button" onclick={onContinue}>
          Return to Dome
        </button>
        <button class="continue-btn primary" type="button" onclick={onDiveDeeper}>
          Dive Deeper
        </button>
      {:else}
        <button class="continue-btn" type="button" onclick={onContinue}>
          Continue
        </button>
      {/if}
    </div>
  </div>
</div>

{#if showShareCard}
  <ShareCardModal
    template="dive_record"
    primaryMetric={$diveResults?.maxDepth ?? 0}
    secondaryLabel="layers deep"
    onClose={() => { showShareCard = false }}
  />
{/if}

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

  .loot-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-surface) 70%);
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface) 40%);
  }

  .loot-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-success);
  }

  .loot-warning {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-accent);
    font-style: italic;
  }

  .loot-safe {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-success);
    font-style: italic;
    opacity: 0.8;
  }

  .loot-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    justify-content: center;
  }

  .loot-item {
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-surface) 70%, var(--color-bg) 30%);
    border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent 90%);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-success);
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

  .run-stats {
    display: flex;
    justify-content: space-around;
    font-size: 0.8rem;
    color: var(--color-text-dim);
    padding-top: 0.3rem;
    border-top: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent 90%);
  }

  .streak-info {
    font-size: 0.85rem;
    color: var(--color-warning);
    font-weight: 600;
  }

  .cta-row {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
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

  .continue-btn.secondary {
    flex: 1;
    background: color-mix(in srgb, var(--color-text-dim) 15%, var(--color-surface) 85%);
    border-color: var(--color-text-dim);
    font-size: 0.95rem;
  }

  .continue-btn.primary {
    flex: 1;
    background: color-mix(in srgb, var(--color-success) 30%, var(--color-surface) 70%);
    border-color: var(--color-success);
    color: var(--color-success);
    font-size: 1.05rem;
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

  .share-btn {
    min-height: 44px;
    border: 2px solid #f59e0b;
    border-radius: 999px;
    padding: 0.6rem 1.2rem;
    background: color-mix(in srgb, #f59e0b 15%, var(--color-surface) 85%);
    color: #f59e0b;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.5px;
    transition: background 120ms ease, transform 120ms ease;
  }

  .share-btn:hover {
    background: color-mix(in srgb, #f59e0b 25%, var(--color-surface) 75%);
  }

  .share-btn:active {
    transform: scale(0.98);
  }
</style>
