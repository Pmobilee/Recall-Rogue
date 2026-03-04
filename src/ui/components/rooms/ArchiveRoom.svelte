<script lang="ts">
  import { getMasteryLevel } from '../../../services/sm2'
  import { getDueReviews, playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import { DATA_DISCS } from '../../../data/dataDiscs'
  import type { Fact } from '../../../data/types'
  import LeaderboardView from '../LeaderboardView.svelte'
  import DuelView from '../DuelView.svelte'
  import TradeMarketView from '../TradeMarketView.svelte'
  import GuildView from '../GuildView.svelte'
  import HubVisitorView from '../HubVisitorView.svelte'

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

  import { socialService } from '../../../services/socialService'
  import type { PlayerSearchResult } from '../../../services/socialService'

  // Social overlay state
  let showVisitFriend = $state(false)
  let showLeaderboard = $state(false)
  let showDuels = $state(false)
  let showMarketplace = $state(false)
  let showGuilds = $state(false)

  // Friend search state
  let friendSearchQuery = $state('')
  let friendSearchResults = $state<PlayerSearchResult[]>([])
  let friendSearchLoading = $state(false)
  let friendSearchError = $state('')
  let selectedFriendId = $state<string | null>(null)

  function handleSocialButton(setter: () => void): void {
    audioManager.playSound('button_click')
    setter()
  }

  async function handleFriendSearch(): Promise<void> {
    const q = friendSearchQuery.trim()
    if (q.length < 2) return
    friendSearchLoading = true
    friendSearchError = ''
    friendSearchResults = []
    try {
      friendSearchResults = await socialService.searchPlayers(q)
      if (friendSearchResults.length === 0) {
        friendSearchError = 'No players found.'
      }
    } catch {
      friendSearchError = 'Search failed. Please try again.'
    } finally {
      friendSearchLoading = false
    }
  }

  function handleFriendSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleFriendSearch()
  }

  function closeFriendSearch(): void {
    showVisitFriend = false
    friendSearchQuery = ''
    friendSearchResults = []
    friendSearchError = ''
    selectedFriendId = null
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

<!-- ========== SOCIAL SECTION ========== -->
<div class="card social-card" aria-label="Social features">
  <h3 class="social-heading">Social</h3>
  <div class="social-buttons">
    <button
      class="social-btn"
      data-testid="visit-friend-btn"
      type="button"
      onclick={() => handleSocialButton(() => { showVisitFriend = true })}
    >
      <span class="social-btn-icon" aria-hidden="true">👥</span>
      <span class="social-btn-label">Visit a Friend</span>
      <span class="social-btn-arrow" aria-hidden="true">&#8594;</span>
    </button>
    <button
      class="social-btn"
      data-testid="leaderboard-open"
      type="button"
      onclick={() => handleSocialButton(() => { showLeaderboard = true })}
    >
      <span class="social-btn-icon" aria-hidden="true">🏆</span>
      <span class="social-btn-label">Leaderboards</span>
      <span class="social-btn-arrow" aria-hidden="true">&#8594;</span>
    </button>
    <button
      class="social-btn"
      data-testid="duels-open"
      type="button"
      onclick={() => handleSocialButton(() => { showDuels = true })}
    >
      <span class="social-btn-icon" aria-hidden="true">⚔️</span>
      <span class="social-btn-label">Knowledge Duels</span>
      <span class="social-btn-arrow" aria-hidden="true">&#8594;</span>
    </button>
    <button
      class="social-btn"
      data-testid="marketplace-open"
      type="button"
      onclick={() => handleSocialButton(() => { showMarketplace = true })}
    >
      <span class="social-btn-icon" aria-hidden="true">🏪</span>
      <span class="social-btn-label">Fact Trading</span>
      <span class="social-btn-arrow" aria-hidden="true">&#8594;</span>
    </button>
    <button
      class="social-btn"
      data-testid="guilds-open"
      type="button"
      onclick={() => handleSocialButton(() => { showGuilds = true })}
    >
      <span class="social-btn-icon" aria-hidden="true">🛡️</span>
      <span class="social-btn-label">Guilds</span>
      <span class="social-btn-arrow" aria-hidden="true">&#8594;</span>
    </button>
  </div>
</div>

<!-- ========== SOCIAL OVERLAYS ========== -->

{#if showLeaderboard}
  <LeaderboardView onClose={() => { showLeaderboard = false }} />
{/if}

{#if showDuels}
  <DuelView onClose={() => { showDuels = false }} />
{/if}

{#if showMarketplace}
  <TradeMarketView onClose={() => { showMarketplace = false }} />
{/if}

{#if showGuilds}
  <GuildView onClose={() => { showGuilds = false }} />
{/if}

{#if selectedFriendId}
  <HubVisitorView playerId={selectedFriendId} onClose={closeFriendSearch} />
{:else if showVisitFriend}
  <div class="friend-search-overlay" role="dialog" aria-modal="true" aria-label="Visit a Friend">
    <div class="friend-search-panel">
      <div class="friend-search-header">
        <h3 class="friend-search-title">Visit a Friend</h3>
        <button
          class="friend-search-close"
          type="button"
          onclick={closeFriendSearch}
          aria-label="Close"
        >✕</button>
      </div>
      <p class="friend-search-desc">Enter a player's display name to visit their dome.</p>
      <div class="friend-search-row">
        <input
          class="friend-search-input"
          type="text"
          placeholder="Player display name…"
          bind:value={friendSearchQuery}
          onkeydown={handleFriendSearchKey}
          aria-label="Friend display name search"
        />
        <button
          class="friend-search-btn"
          type="button"
          onclick={handleFriendSearch}
          disabled={friendSearchLoading || friendSearchQuery.trim().length < 2}
        >
          {friendSearchLoading ? '…' : 'Search'}
        </button>
      </div>
      {#if friendSearchError}
        <p class="friend-search-error">{friendSearchError}</p>
      {/if}
      {#if friendSearchResults.length > 0}
        <ul class="friend-results-list" aria-label="Search results">
          {#each friendSearchResults as result}
            <li>
              <button
                class="friend-result-btn"
                type="button"
                onclick={() => { selectedFriendId = result.id }}
              >
                <span class="friend-result-name">{result.displayName}</span>
                <span class="friend-result-visit" aria-hidden="true">&#8594;</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

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

  /* ---- Social section ---- */
  .social-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .social-heading {
    color: #f59e0b;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 4px;
  }

  .social-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .social-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, #f59e0b 14%, var(--color-surface) 86%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    padding: 0 14px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .social-btn:hover {
    background: color-mix(in srgb, #f59e0b 24%, var(--color-surface) 76%);
  }

  .social-btn:active {
    transform: translateY(1px);
  }

  .social-btn-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .social-btn-label {
    flex: 1;
  }

  .social-btn-arrow {
    color: rgba(255, 255, 255, 0.4);
    font-size: 1rem;
    flex-shrink: 0;
  }

  /* ---- Friend search overlay ---- */
  .friend-search-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .friend-search-panel {
    background: var(--color-surface);
    border-radius: 16px;
    padding: 20px;
    width: 100%;
    max-width: 420px;
    max-height: 80dvh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .friend-search-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .friend-search-title {
    color: #f59e0b;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .friend-search-close {
    border: 0;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
    transition: color 0.12s, background 0.12s;
  }

  .friend-search-close:hover {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
  }

  .friend-search-close:active {
    transform: scale(0.93);
  }

  .friend-search-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    margin: 0;
    line-height: 1.4;
  }

  .friend-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--color-text-dim) 35%, transparent 65%);
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface) 40%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .friend-search-input:focus {
    border-color: #f59e0b;
  }

  .friend-search-input::placeholder {
    color: var(--color-text-dim);
    opacity: 0.6;
  }

  .friend-search-row {
    display: flex;
    gap: 8px;
  }

  .friend-search-row .friend-search-input {
    flex: 1;
    width: auto;
  }

  .friend-search-btn {
    flex-shrink: 0;
    padding: 10px 16px;
    border: 0;
    border-radius: 10px;
    background: #f59e0b;
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .friend-search-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .friend-search-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .friend-search-error {
    margin: 0;
    color: var(--color-accent, #e05);
    font-size: 0.82rem;
  }

  .friend-results-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .friend-result-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, #f59e0b 12%, var(--color-surface) 88%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .friend-result-btn:hover {
    background: color-mix(in srgb, #f59e0b 22%, var(--color-surface) 78%);
  }

  .friend-result-btn:active {
    transform: translateY(1px);
  }

  .friend-result-name {
    flex: 1;
  }

  .friend-result-visit {
    color: rgba(255, 255, 255, 0.4);
    font-size: 1rem;
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
