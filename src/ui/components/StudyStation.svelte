<script lang="ts">
  import type { Fact, PlayerSave, ReviewState } from '../../data/types'
  import { playerSave, activateFact, deactivateFact, unsuspendFact, getActivationCap, getActivationSlotsUsed } from '../stores/playerData'
  import { isMastered, isDue } from '../../services/sm2'
  import { factsDB } from '../../services/factsDB'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // ── Tab state ──
  type Tab = 'active' | 'discovered' | 'mastered' | 'suspended'
  let activeTab = $state<Tab>('active')

  // ── Reactive data from player save ──
  let _save = $state<PlayerSave | null>(null)
  $effect(() => {
    const unsub = playerSave.subscribe(s => { _save = s ?? null })
    return unsub
  })

  // ── Card categorization ──
  const activeCards = $derived.by(() => {
    if (!_save) return []
    return _save.reviewStates.filter(r =>
      r.cardState === 'new' || r.cardState === 'learning' || r.cardState === 'review' || r.cardState === 'relearning'
    ).filter(r => !isMastered(r))
  })

  const masteredCards = $derived.by(() => {
    if (!_save) return []
    return _save.reviewStates.filter(r => isMastered(r))
  })

  const suspendedCards = $derived.by(() => {
    if (!_save) return []
    return _save.reviewStates.filter(r => r.cardState === 'suspended')
  })

  const discoveredFactIds = $derived(_save?.discoveredFacts ?? [])

  // ── Stats ──
  const totalCards = $derived((_save?.learnedFacts.length ?? 0) + discoveredFactIds.length)
  const dueToday = $derived(activeCards.filter(r => isDue(r)).length)
  const activationCap = $derived(_save ? getActivationCap(_save) : 5)
  const activationUsed = $derived(_save ? getActivationSlotsUsed(_save) : 0)

  // ── Helpers ──
  /** Look up a Fact by its review state. */
  function getFactForState(rs: ReviewState): Fact | null {
    return factsDB.getById(rs.factId)
  }

  /** Look up a Fact by its ID (for discovered facts). */
  function getDiscoveredFact(factId: string): Fact | null {
    return factsDB.getById(factId)
  }

  /** Format the next review time as a human-readable string. */
  function formatNextReview(rs: ReviewState): string {
    if (isDue(rs)) return 'Due now'
    const diff = rs.nextReviewAt - Date.now()
    const mins = Math.round(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.round(hours / 24)
    return `${days}d`
  }

  /** Return a badge label and color for a given review state. */
  function getStateBadge(rs: ReviewState): { label: string; color: string } {
    if (rs.cardState === 'new') return { label: 'New', color: '#60a5fa' }
    if (rs.cardState === 'learning') return { label: 'Learning', color: '#fbbf24' }
    if (rs.cardState === 'relearning') return { label: 'Relearning', color: '#f97316' }
    if (isMastered(rs)) return { label: 'Mastered', color: '#ffd369' }
    return { label: 'Review', color: '#4ecca3' }
  }

  /** Activate a discovered fact into the study rotation. */
  function handleActivate(factId: string): void {
    audioManager.playSound('button_click')
    const result = activateFact(factId)
    if (!result.success) {
      console.warn('[StudyStation] Activation failed:', result.reason)
    }
  }

  /** Deactivate a learned fact back to the discovered pool. */
  function handleDeactivate(factId: string): void {
    audioManager.playSound('button_click')
    deactivateFact(factId)
  }

  /** Unsuspend a leeched card back into relearning. */
  function handleUnsuspend(factId: string): void {
    audioManager.playSound('button_click')
    unsuspendFact(factId)
  }

  /** Navigate back to the hub. */
  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'discovered', label: 'Discovered' },
    { key: 'mastered', label: 'Mastered' },
    { key: 'suspended', label: 'Suspended' },
  ]
</script>

<div class="study-station">
  <!-- Header -->
  <div class="station-header">
    <button class="back-btn" type="button" onclick={handleBack}>
      &#8592; Back
    </button>
    <h1 class="station-title">Study Station</h1>
  </div>

  <!-- Stats bar -->
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">{totalCards}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat">
      <span class="stat-value">{dueToday}</span>
      <span class="stat-label">Due</span>
    </div>
    <div class="stat">
      <span class="stat-value">{activationUsed}/{activationCap}</span>
      <span class="stat-label">Slots</span>
    </div>
    <div class="stat">
      <span class="stat-value">{masteredCards.length}</span>
      <span class="stat-label">Mastered</span>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tab-bar">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:tab-active={activeTab === tab.key}
        type="button"
        onclick={() => { activeTab = tab.key }}
      >
        {tab.label}
        <span class="tab-count">
          {#if tab.key === 'active'}{activeCards.length}
          {:else if tab.key === 'discovered'}{discoveredFactIds.length}
          {:else if tab.key === 'mastered'}{masteredCards.length}
          {:else}{suspendedCards.length}
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="card-list">
    {#if activeTab === 'active'}
      {#if activeCards.length === 0}
        <p class="empty-msg">No active cards. Discover facts by mining artifacts!</p>
      {:else}
        {#each activeCards as rs}
          {@const fact = getFactForState(rs)}
          {#if fact}
            <div class="card-item">
              <div class="card-item-top">
                <span class="card-badge" style="background: {getStateBadge(rs).color};">{getStateBadge(rs).label}</span>
                <span class="card-next-review">{formatNextReview(rs)}</span>
              </div>
              <p class="card-question">{fact.quizQuestion}</p>
              <div class="card-item-bottom">
                <span class="card-category">{fact.category[0] ?? ''}</span>
                <button class="action-btn action-btn--deactivate" type="button" onclick={() => handleDeactivate(rs.factId)}>
                  Deactivate
                </button>
              </div>
            </div>
          {/if}
        {/each}
      {/if}

    {:else if activeTab === 'discovered'}
      {#if discoveredFactIds.length === 0}
        <p class="empty-msg">No discoveries yet. Mine artifacts to find new facts!</p>
      {:else}
        <p class="cap-info">Activation slots: {activationUsed} / {activationCap}</p>
        {#each discoveredFactIds as factId}
          {@const fact = getDiscoveredFact(factId)}
          {#if fact}
            <div class="card-item card-item--discovered">
              <p class="card-question">{fact.quizQuestion}</p>
              <div class="card-item-bottom">
                <span class="card-category">{fact.category[0] ?? ''}</span>
                <button
                  class="action-btn action-btn--activate"
                  type="button"
                  disabled={activationUsed >= activationCap}
                  onclick={() => handleActivate(factId)}
                >
                  {activationUsed >= activationCap ? 'Cap reached' : 'Activate'}
                </button>
              </div>
            </div>
          {/if}
        {/each}
      {/if}

    {:else if activeTab === 'mastered'}
      {#if masteredCards.length === 0}
        <p class="empty-msg">No mastered cards yet. Keep studying to reach mastery!</p>
      {:else}
        {#each masteredCards as rs}
          {@const fact = getFactForState(rs)}
          {#if fact}
            <div class="card-item card-item--mastered">
              <div class="card-item-top">
                <span class="card-badge" style="background: #ffd369;">Mastered</span>
                <span class="card-interval">{rs.interval}d interval</span>
              </div>
              <p class="card-question">{fact.quizQuestion}</p>
              <span class="card-category">{fact.category[0] ?? ''}</span>
            </div>
          {/if}
        {/each}
      {/if}

    {:else if activeTab === 'suspended'}
      {#if suspendedCards.length === 0}
        <p class="empty-msg">No suspended cards. Cards auto-suspend after too many lapses.</p>
      {:else}
        {#each suspendedCards as rs}
          {@const fact = getFactForState(rs)}
          {#if fact}
            <div class="card-item card-item--suspended">
              <div class="card-item-top">
                <span class="card-badge" style="background: #ef4444;">Suspended</span>
                <span class="card-lapses">{rs.lapseCount} lapses</span>
              </div>
              <p class="card-question">{fact.quizQuestion}</p>
              <div class="card-item-bottom">
                <span class="card-category">{fact.category[0] ?? ''}</span>
                <button class="action-btn action-btn--unsuspend" type="button" onclick={() => handleUnsuspend(rs.factId)}>
                  Reactivate
                </button>
              </div>
            </div>
          {/if}
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .study-station {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 50% 110%, #1a2a4a 0%, #0a1525 70%);
    font-family: 'Courier New', monospace;
    color: var(--color-text, #e0e0e0);
    overflow: hidden;
  }

  .station-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .back-btn {
    background: transparent;
    border: 1px solid rgba(150,150,180,0.3);
    border-radius: 8px;
    color: var(--color-text-dim, #999);
    font-family: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }

  .station-title {
    font-family: Georgia, serif;
    font-size: clamp(1.2rem, 4vw, 1.6rem);
    color: var(--color-warning, #ffd369);
    margin: 0;
    letter-spacing: 1px;
  }

  .stats-bar {
    display: flex;
    justify-content: space-around;
    padding: 0.6rem 0.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-success, #4ecca3);
  }

  .stat-label {
    display: block;
    font-size: 0.65rem;
    color: var(--color-text-dim, #999);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 0.5rem 0.5rem 0;
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    background: rgba(30,30,60,0.4);
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    color: var(--color-text-dim, #999);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.5rem 0.25rem;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, color 150ms;
  }

  .tab-active {
    background: rgba(50,50,100,0.6);
    border-bottom-color: var(--color-success, #4ecca3);
    color: var(--color-text, #e0e0e0);
  }

  .tab-count {
    display: inline-block;
    margin-left: 4px;
    font-size: 0.65rem;
    opacity: 0.6;
  }

  .card-list {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-msg {
    text-align: center;
    color: var(--color-text-dim, #999);
    font-size: 0.85rem;
    font-style: italic;
    padding: 2rem 1rem;
  }

  .cap-info {
    text-align: center;
    font-size: 0.8rem;
    color: var(--color-text-dim, #999);
    margin: 0 0 0.5rem;
  }

  .card-item {
    background: rgba(30,30,60,0.5);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .card-item--discovered {
    border-color: rgba(96,165,250,0.2);
  }

  .card-item--mastered {
    border-color: rgba(255,211,105,0.15);
  }

  .card-item--suspended {
    border-color: rgba(239,68,68,0.15);
    opacity: 0.85;
  }

  .card-item-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-badge {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    color: #0a0a1a;
  }

  .card-next-review, .card-interval, .card-lapses {
    font-size: 0.7rem;
    color: var(--color-text-dim, #999);
  }

  .card-question {
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
    color: var(--color-text, #e0e0e0);
  }

  .card-item-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-category {
    font-size: 0.65rem;
    color: var(--color-text-dim, #999);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: filter 120ms, transform 100ms;
  }

  .action-btn:active { transform: scale(0.96); }

  .action-btn--activate {
    background: var(--color-success, #4ecca3);
    color: #0a1a14;
  }
  .action-btn--activate:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .action-btn--deactivate {
    background: rgba(150,150,180,0.2);
    color: var(--color-text-dim, #999);
    border: 1px solid rgba(150,150,180,0.2);
  }

  .action-btn--unsuspend {
    background: color-mix(in srgb, #60a5fa 55%, #0d0d1a 45%);
    color: #fff;
  }
</style>
