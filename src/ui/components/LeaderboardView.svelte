<script lang="ts">
  import { apiClient } from '../../services/apiClient'
  import type { LeaderboardEntry } from '../../services/apiClient'
  import { playerSave } from '../stores/playerData'
  import { authStore } from '../stores/authStore'

  // ============================================================
  // TYPES
  // ============================================================

  type LeaderboardCategory = {
    key: string
    label: string
    icon: string
    unit?: string
    formatScore?: (score: number) => string
  }

  type Scope = 'global' | 'friends'

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  // ============================================================
  // CATEGORY CONFIG
  // ============================================================

  const CATEGORIES: LeaderboardCategory[] = [
    { key: 'deepest_dive', label: 'Deepest Dive', icon: '⛏️', formatScore: (s) => `Layer ${s}` },
    { key: 'facts_mastered', label: 'Facts Mastered', icon: '🧠', formatScore: (s) => String(s) },
    { key: 'longest_streak', label: 'Longest Streak', icon: '🔥', formatScore: (s) => `${s} days` },
    { key: 'knowledge_tree', label: 'Knowledge Tree', icon: '🌳', formatScore: (s) => `${s}%` },
    { key: 'quiz_accuracy', label: 'Quiz Accuracy', icon: '🎯', formatScore: (s) => `${s}%` },
    { key: 'total_dives', label: 'Total Dives', icon: '🏊', formatScore: (s) => String(s) },
  ]

  // ============================================================
  // STATE
  // ============================================================

  let activeCategory = $state<string>('deepest_dive')
  let scope = $state<Scope>('global')
  let entries = $state<LeaderboardEntry[]>([])
  let myEntry = $state<LeaderboardEntry | null>(null)
  let loading = $state(false)
  let error = $state<string | null>(null)

  // ============================================================
  // DERIVED
  // ============================================================

  const currentCategory = $derived(
    CATEGORIES.find(c => c.key === activeCategory) ?? CATEGORIES[0]!
  )

  const myUserId = $derived($authStore.userId ?? '')

  const myRank = $derived(
    entries.findIndex(e => e.userId === myUserId) + 1
  )

  const myEntryInList = $derived(
    entries.find(e => e.userId === myUserId) ?? null
  )

  const showPinnedRow = $derived(
    myUserId !== '' && myEntryInList === null && myEntry !== null
  )

  // ============================================================
  // DATA FETCHING
  // ============================================================

  async function fetchLeaderboard(): Promise<void> {
    loading = true
    error = null
    entries = []
    myEntry = null

    try {
      // Fetch top 100
      const params = new URLSearchParams({ category: activeCategory, scope, limit: '100' })
      const baseUrl = (apiClient as unknown as { baseUrl: string }).baseUrl
        ?? 'http://localhost:3001/api'

      const token = localStorage.getItem('terra_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/leaderboards/${activeCategory}?scope=${scope}&limit=100`,
        { headers }
      )

      if (!res.ok) {
        error = `Failed to load rankings (${res.status})`
        return
      }

      const data = (await res.json()) as { entries?: LeaderboardEntry[]; myEntry?: LeaderboardEntry }
      entries = Array.isArray(data.entries) ? data.entries : []
      myEntry = data.myEntry ?? null

      // If not in top 100, also try to get user's own entry
      if (myUserId && !myEntryInList && !myEntry) {
        try {
          const myRankings = await apiClient.getMyRankings()
          const found = myRankings.find(e => e.category === activeCategory) ?? null
          myEntry = found
        } catch {
          // Non-critical — suppress
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Network error. Check your connection.'
    } finally {
      loading = false
    }
  }

  // Fetch on category/scope change
  $effect(() => {
    void fetchLeaderboard()
  })

  // ============================================================
  // HELPERS
  // ============================================================

  function formatScore(score: number): string {
    return currentCategory.formatScore ? currentCategory.formatScore(score) : String(score)
  }

  function rankMedal(rank: number): string {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  function selectCategory(key: string): void {
    if (activeCategory !== key) activeCategory = key
  }

  function setScope(s: Scope): void {
    if (scope !== s) scope = s
  }
</script>

<!-- ========== LEADERBOARD VIEW ========== -->
<div class="lb-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard">
  <div class="lb-panel">

    <!-- Header -->
    <div class="lb-header">
      <span class="lb-title">🏆 Rankings</span>
      <button class="lb-close-btn" type="button" onclick={onClose} aria-label="Close leaderboard">
        ✕
      </button>
    </div>

    <!-- Category tabs -->
    <div class="lb-tabs" role="tablist" aria-label="Leaderboard categories">
      {#each CATEGORIES as cat}
        <button
          class="lb-tab"
          class:lb-tab-active={activeCategory === cat.key}
          type="button"
          role="tab"
          aria-selected={activeCategory === cat.key}
          onclick={() => selectCategory(cat.key)}
        >
          <span class="lb-tab-icon" aria-hidden="true">{cat.icon}</span>
          <span class="lb-tab-label">{cat.label}</span>
        </button>
      {/each}
    </div>

    <!-- Scope toggle -->
    <div class="lb-scope-row" aria-label="Scope filter">
      <button
        class="lb-scope-btn"
        class:lb-scope-active={scope === 'global'}
        type="button"
        onclick={() => setScope('global')}
        aria-pressed={scope === 'global'}
      >
        Global
      </button>
      <button
        class="lb-scope-btn"
        class:lb-scope-active={scope === 'friends'}
        type="button"
        onclick={() => setScope('friends')}
        aria-pressed={scope === 'friends'}
      >
        Friends
      </button>
    </div>

    <!-- Content area -->
    <div class="lb-content">
      {#if loading}
        <div class="lb-state-center" aria-live="polite" aria-busy="true">
          <span class="lb-spinner" aria-hidden="true">⏳</span>
          <p class="lb-state-text">Loading rankings…</p>
        </div>
      {:else if error !== null}
        <div class="lb-state-center" aria-live="assertive">
          <span class="lb-state-icon" aria-hidden="true">⚠️</span>
          <p class="lb-state-text lb-state-error">{error}</p>
          <button class="lb-retry-btn" type="button" onclick={() => void fetchLeaderboard()}>
            Retry
          </button>
        </div>
      {:else if entries.length === 0}
        <div class="lb-state-center" aria-live="polite">
          <span class="lb-state-icon" aria-hidden="true">📭</span>
          <p class="lb-state-text">No rankings yet for this category.</p>
        </div>
      {:else}
        <ul class="lb-list" aria-label="{currentCategory.label} leaderboard">
          {#each entries as entry (entry.userId)}
            <li
              class="lb-row"
              class:lb-row-mine={entry.userId === myUserId}
              aria-label="{entry.displayName}, rank {entry.rank}, score {formatScore(entry.score)}"
            >
              <span class="lb-rank" aria-hidden="true">{rankMedal(entry.rank)}</span>
              <span class="lb-name">
                {entry.displayName}
                <!-- patron / pioneer badges are optional fields not on LeaderboardEntry yet
                     — render via type cast when server adds them -->
              </span>
              <span class="lb-score">{formatScore(entry.score)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Pinned "my row" when outside top 100 -->
    {#if showPinnedRow && myEntry !== null}
      <div class="lb-pinned" aria-label="Your ranking">
        <span class="lb-pinned-label">You</span>
        <li
          class="lb-row lb-row-mine lb-pinned-row"
          aria-label="{myEntry.displayName}, rank {myEntry.rank}, score {formatScore(myEntry.score)}"
        >
          <span class="lb-rank" aria-hidden="true">#{myEntry.rank}</span>
          <span class="lb-name">{myEntry.displayName}</span>
          <span class="lb-score">{formatScore(myEntry.score)}</span>
        </li>
      </div>
    {/if}

    <!-- Footer -->
    <p class="lb-footer" aria-label="Update frequency">Rankings updated daily</p>

  </div>
</div>

<style>
  /* ---- Overlay ---- */
  .lb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 60;
    pointer-events: auto;
  }

  /* ---- Panel ---- */
  .lb-panel {
    width: 100%;
    max-width: 520px;
    max-height: 92dvh;
    background: #1a1a2e;
    border: 2px solid #f59e0b44;
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
    overflow: hidden;
  }

  /* ---- Header ---- */
  .lb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #f59e0b33;
    flex-shrink: 0;
  }

  .lb-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .lb-close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    font-family: inherit;
    transition: color 0.12s, background 0.12s;
  }

  .lb-close-btn:hover,
  .lb-close-btn:focus-visible {
    color: #f59e0b;
    background: #f59e0b22;
  }

  .lb-close-btn:active {
    transform: translateY(1px);
  }

  /* ---- Category tabs ---- */
  .lb-tabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    gap: 4px;
    padding: 8px 12px 6px;
    flex-shrink: 0;
    border-bottom: 1px solid #f59e0b22;
  }

  .lb-tabs::-webkit-scrollbar {
    display: none;
  }

  .lb-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #16213e;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.65rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .lb-tab:active {
    transform: translateY(1px);
  }

  .lb-tab-active {
    background: color-mix(in srgb, #f59e0b 18%, #16213e 82%);
    border-color: #f59e0b66;
    color: #f59e0b;
  }

  .lb-tab-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .lb-tab-label {
    line-height: 1;
  }

  /* ---- Scope toggle ---- */
  .lb-scope-row {
    display: flex;
    gap: 6px;
    padding: 8px 12px 6px;
    flex-shrink: 0;
  }

  .lb-scope-btn {
    flex: 1;
    padding: 7px 0;
    border: 1px solid #334155;
    border-radius: 8px;
    background: #16213e;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .lb-scope-btn:active {
    transform: translateY(1px);
  }

  .lb-scope-active {
    background: color-mix(in srgb, #f59e0b 15%, #16213e 85%);
    border-color: #f59e0b88;
    color: #f59e0b;
  }

  /* ---- Content area ---- */
  .lb-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 0;
  }

  /* ---- State messages ---- */
  .lb-state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 16px;
  }

  .lb-spinner {
    font-size: 1.8rem;
    animation: lb-pulse 1.2s ease-in-out infinite;
  }

  @keyframes lb-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .lb-state-icon {
    font-size: 1.8rem;
  }

  .lb-state-text {
    margin: 0;
    font-size: 0.82rem;
    color: #94a3b8;
    text-align: center;
    line-height: 1.4;
  }

  .lb-state-error {
    color: #f87171;
  }

  .lb-retry-btn {
    padding: 8px 20px;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    background: #f59e0b22;
    color: #f59e0b;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  .lb-retry-btn:active {
    transform: translateY(1px);
  }

  /* ---- Ranked list ---- */
  .lb-list {
    list-style: none;
    margin: 0;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .lb-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    background: #16213e;
    border: 1px solid transparent;
  }

  .lb-row-mine {
    background: color-mix(in srgb, #f59e0b 12%, #16213e 88%);
    border-color: #f59e0b55;
  }

  .lb-rank {
    font-size: 0.8rem;
    font-weight: 700;
    min-width: 36px;
    text-align: center;
    flex-shrink: 0;
    color: #cbd5e1;
  }

  .lb-name {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .lb-row-mine .lb-name {
    color: #fbbf24;
  }

  .lb-score {
    font-size: 0.82rem;
    font-weight: 700;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .lb-row-mine .lb-score {
    color: #f59e0b;
  }

  /* ---- Pinned my-row ---- */
  .lb-pinned {
    flex-shrink: 0;
    padding: 0 8px 2px;
    border-top: 1px solid #f59e0b33;
    background: #1a1a2e;
  }

  .lb-pinned-label {
    display: block;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #f59e0b88;
    padding: 4px 12px 0;
  }

  .lb-pinned-row {
    margin: 4px 0;
  }

  /* ---- Footer ---- */
  .lb-footer {
    text-align: center;
    font-size: 0.68rem;
    color: #475569;
    padding: 8px;
    margin: 0;
    flex-shrink: 0;
    border-top: 1px solid #f59e0b1a;
  }

  /* ---- Responsive ---- */
  @media (max-width: 520px) {
    .lb-tab {
      padding: 5px 8px;
      font-size: 0.6rem;
    }

    .lb-tab-icon {
      font-size: 0.9rem;
    }
  }
</style>
