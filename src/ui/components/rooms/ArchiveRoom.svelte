<script lang="ts">
  import { getMasteryLevel } from '../../../services/sm2'
  import { getDueReviews, playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import { DATA_DISCS } from '../../../data/dataDiscs'
  import type { Fact } from '../../../data/types'

  interface Props {
    onViewTree?: () => void
    facts?: Fact[]
  }

  let { onViewTree, facts }: Props = $props()

  const unlockedDiscIds = $derived($playerSave?.unlockedDiscs ?? [])
  const unlockedDiscObjects = $derived(
    DATA_DISCS.filter(d => unlockedDiscIds.includes(d.id))
  )
  const discCount = $derived(unlockedDiscIds.length)
  const totalDiscs = DATA_DISCS.length

  const learnedFactsWithMastery = $derived.by(() => {
    const save = $playerSave
    if (!save) {
      return [] as Array<{ factId: string; statement: string; mastery: string }>
    }
    return save.learnedFacts.map((factId: string) => {
      const reviewState = save.reviewStates.find((state: { factId: string }) => state.factId === factId)
      const factObj = facts?.find(f => f.id === factId)
      return {
        factId,
        statement: factObj?.statement ?? factId,
        mastery: reviewState ? getMasteryLevel(reviewState) : 'new',
      }
    })
  })

  const masteryBreakdown = $derived.by(() => {
    const save = $playerSave
    if (!save) return { new: 0, learning: 0, familiar: 0, known: 0, mastered: 0 }
    const counts: Record<string, number> = { new: 0, learning: 0, familiar: 0, known: 0, mastered: 0 }
    for (const rs of save.reviewStates) {
      const level = getMasteryLevel(rs)
      counts[level] = (counts[level] ?? 0) + 1
    }
    return counts
  })

  function formatMasteryLabel(level: string): string {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  function handleViewTree(): void {
    audioManager.playSound('button_click')
    onViewTree?.()
  }
</script>

<!-- ========== ARCHIVE ========== -->
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">📚</span>
    <div>
      <h2 class="room-header-title">Archive</h2>
      <p class="room-header-desc">Knowledge tree, data discs and mastery records</p>
    </div>
  </div>
</div>

<div class="card actions-card" aria-label="Archive actions">
  <button class="action-button tree-button" type="button" onclick={handleViewTree}>
    <span>Knowledge Tree</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>
</div>

<div class="card knowledge-card" aria-label="Knowledge overview">
  <div class="knowledge-header">
    <h2>Knowledge</h2>
    <span class="disc-counter" aria-label="Data Discs collected">
      Data Discs: {discCount}/{totalDiscs}
    </span>
  </div>
  {#if discCount > 0}
    <div class="disc-badges" aria-label="Unlocked data discs">
      {#each unlockedDiscObjects as disc}
        <span class="disc-badge" title="{disc.name}: {disc.description}">
          {disc.icon}
        </span>
      {/each}
    </div>
  {/if}

  <div class="mastery-summary" aria-label="Mastery breakdown">
    <div class="mastery-row">
      <span class="mastery-badge mastery-new">New</span>
      <span class="mastery-summary-count">{masteryBreakdown.new}</span>
    </div>
    <div class="mastery-row">
      <span class="mastery-badge mastery-learning">Learning</span>
      <span class="mastery-summary-count">{masteryBreakdown.learning}</span>
    </div>
    <div class="mastery-row">
      <span class="mastery-badge mastery-familiar">Familiar</span>
      <span class="mastery-summary-count">{masteryBreakdown.familiar}</span>
    </div>
    <div class="mastery-row">
      <span class="mastery-badge mastery-known">Known</span>
      <span class="mastery-summary-count">{masteryBreakdown.known}</span>
    </div>
    <div class="mastery-row">
      <span class="mastery-badge mastery-mastered">Mastered</span>
      <span class="mastery-summary-count">{masteryBreakdown.mastered}</span>
    </div>
  </div>
</div>

<div class="card knowledge-card" aria-label="Learned facts">
  <h2>Learned Facts ({learnedFactsWithMastery.length})</h2>
  {#if learnedFactsWithMastery.length === 0}
    <p class="empty-note">No learned facts yet. Start a dive to discover artifacts.</p>
  {:else}
    <div class="facts-list">
      {#each learnedFactsWithMastery as entry}
        <div class="fact-row">
          <span class="fact-id">{entry.statement}</span>
          <span class={`mastery-badge mastery-${entry.mastery}`}>{formatMasteryLabel(entry.mastery)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin: 0 0 10px;
  }

  .room-header-card {
    margin: 8px 8px 4px;
    padding: 12px 16px;
  }

  .room-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .room-header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .room-header-title {
    color: var(--color-warning);
    font-size: 1.1rem;
    margin: 0 0 2px;
  }

  .room-header-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.3;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .tree-button {
    background: color-mix(in srgb, var(--color-warning) 28%, var(--color-surface) 72%);
  }

  .action-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .knowledge-card {
    display: flex;
    flex-direction: column;
    min-height: 160px;
    max-height: 38dvh;
  }

  .knowledge-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .knowledge-header h2 {
    margin-bottom: 0;
  }

  .disc-counter {
    color: #22aacc;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .disc-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .disc-badge {
    font-size: 1.2rem;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, #22aacc 18%, var(--color-surface) 82%);
    border: 1px solid #22aacc44;
    border-radius: 8px;
    cursor: default;
  }

  .mastery-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .mastery-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px 4px 4px;
    background: color-mix(in srgb, var(--color-bg) 45%, var(--color-surface) 55%);
    border-radius: 8px;
  }

  .mastery-summary-count {
    color: var(--color-text);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .mastery-badge {
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .mastery-new {
    background: color-mix(in srgb, var(--color-text-dim) 32%, var(--color-surface) 68%);
    color: var(--color-text);
  }

  .mastery-learning {
    background: color-mix(in srgb, var(--color-warning) 35%, var(--color-surface) 65%);
    color: #342500;
  }

  .mastery-familiar {
    background: color-mix(in srgb, var(--color-primary) 62%, var(--color-surface) 38%);
    color: var(--color-text);
  }

  .mastery-known {
    background: color-mix(in srgb, var(--color-success) 40%, var(--color-surface) 60%);
    color: #0b231a;
  }

  .mastery-mastered {
    background: color-mix(in srgb, var(--color-accent) 40%, var(--color-surface) 60%);
    color: #fff;
  }

  .facts-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }

  .fact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: color-mix(in srgb, var(--color-bg) 45%, var(--color-surface) 55%);
    border-radius: 9px;
    padding: 8px 10px;
  }

  .fact-id {
    color: var(--color-text);
    font-size: 0.85rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  /* Archive knowledge card max-height override */
  :global(.knowledge-card) {
    max-height: 42dvh;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>
