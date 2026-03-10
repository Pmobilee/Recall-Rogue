<script lang="ts">
  import type { DuelStats, DuelRecord } from '../../data/types'
  import { playerSave } from '../stores/playerData'
  import { authStore } from '../stores/authStore'

  // ============================================================
  // TYPES
  // ============================================================

  type DuelTab = 'challenge' | 'pending' | 'history' | 'stats'
  type UiDuelRecord = DuelRecord & { incoming: boolean }

  interface Friend {
    id: string
    displayName: string
  }

  interface ApiDuelResult {
    score: number
    correctCount: number
  }

  interface ApiDuelRecord {
    id: string
    challengerId: string
    opponentId: string
    status: 'pending' | 'active' | 'awaiting_results' | 'completed' | 'declined'
    wagerDust: number
    createdAt: number
    resolvedAt?: number | null
    challengerResult?: ApiDuelResult | null
    opponentResult?: ApiDuelResult | null
  }

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  // ============================================================
  // STATE
  // ============================================================

  let activeTab = $state<DuelTab>('challenge')

  // Challenge tab
  let friends = $state<Friend[]>([])
  let friendsLoading = $state(false)
  let friendsError = $state<string | null>(null)
  let selectedFriendId = $state<string | null>(null)
  let wager = $state(0)
  let challenging = $state(false)
  let challengeResult = $state<string | null>(null)

  // Pending tab
  let pendingDuels = $state<UiDuelRecord[]>([])
  let pendingLoading = $state(false)
  let pendingError = $state<string | null>(null)
  let actioningDuelId = $state<string | null>(null)

  // History tab
  let historyDuels = $state<UiDuelRecord[]>([])
  let historyLoading = $state(false)
  let historyError = $state<string | null>(null)

  // Stats tab (from playerSave)
  const duelStats = $derived<DuelStats | null>($playerSave?.duelStats ?? null)

  // ============================================================
  // DERIVED
  // ============================================================

  const selectedFriend = $derived(
    friends.find(f => f.id === selectedFriendId) ?? null
  )

  const canChallenge = $derived(
    selectedFriendId !== null && !challenging
  )

  const winRate = $derived.by(() => {
    if (!duelStats || duelStats.totalDuels === 0) return 0
    return Math.round((duelStats.wins / duelStats.totalDuels) * 100)
  })

  const netDust = $derived.by(() => {
    if (!duelStats) return 0
    return duelStats.totalDustWon - duelStats.totalDustLost
  })

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const baseUrl = (): string => {
    const stored = localStorage.getItem('terra_api_base')
    return stored ?? 'http://localhost:3001/api'
  }

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem('terra_auth_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  async function fetchFriends(): Promise<void> {
    friendsLoading = true
    friendsError = null
    try {
      const res = await fetch(`${baseUrl()}/players/me/friends`, { headers: authHeaders() })
      if (!res.ok) {
        friendsError = `Could not load friends (${res.status})`
        return
      }
      const data = (await res.json()) as Friend[] | { friends?: Friend[] }
      friends = Array.isArray(data) ? data : (Array.isArray(data.friends) ? data.friends : [])
    } catch {
      friendsError = 'Network error loading friends.'
    } finally {
      friendsLoading = false
    }
  }

  async function fetchPendingDuels(): Promise<void> {
    pendingLoading = true
    pendingError = null
    try {
      const res = await fetch(`${baseUrl()}/duels/pending`, { headers: authHeaders() })
      if (!res.ok) {
        pendingError = `Could not load duels (${res.status})`
        return
      }
      const data = (await res.json()) as ApiDuelRecord[] | { duels?: ApiDuelRecord[] }
      const rows = Array.isArray(data) ? data : (Array.isArray(data.duels) ? data.duels : [])
      pendingDuels = rows.map((duel) => mapApiDuelToUi(duel, $authStore.userId ?? ''))
    } catch {
      pendingError = 'Network error loading duels.'
    } finally {
      pendingLoading = false
    }
  }

  async function fetchHistoryDuels(): Promise<void> {
    historyLoading = true
    historyError = null
    try {
      const res = await fetch(`${baseUrl()}/duels/history`, { headers: authHeaders() })
      if (!res.ok) {
        historyError = `Could not load history (${res.status})`
        return
      }
      const data = (await res.json()) as ApiDuelRecord[] | { duels?: ApiDuelRecord[] }
      const rows = Array.isArray(data) ? data : (Array.isArray(data.duels) ? data.duels : [])
      historyDuels = rows.map((duel) => mapApiDuelToUi(duel, $authStore.userId ?? ''))
    } catch {
      historyError = 'Network error loading history.'
    } finally {
      historyLoading = false
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  async function sendChallenge(): Promise<void> {
    if (!selectedFriendId) return
    challenging = true
    challengeResult = null
    try {
      const res = await fetch(`${baseUrl()}/duels/challenge`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ opponentId: selectedFriendId, wagerDust: wager }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        challengeResult = `Failed: ${body.message ?? res.status}`
      } else {
        challengeResult = `Challenge sent to ${selectedFriend?.displayName ?? 'opponent'}!`
        selectedFriendId = null
        wager = 0
      }
    } catch {
      challengeResult = 'Network error sending challenge.'
    } finally {
      challenging = false
    }
  }

  async function acceptDuel(duelId: string): Promise<void> {
    actioningDuelId = duelId
    try {
      const res = await fetch(`${baseUrl()}/duels/${duelId}/accept`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        pendingDuels = pendingDuels.filter(d => d.id !== duelId)
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      actioningDuelId = null
    }
  }

  async function declineDuel(duelId: string): Promise<void> {
    actioningDuelId = duelId
    try {
      const res = await fetch(`${baseUrl()}/duels/${duelId}/decline`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        pendingDuels = pendingDuels.filter(d => d.id !== duelId)
      }
    } catch {
      // Silently fail
    } finally {
      actioningDuelId = null
    }
  }

  // ============================================================
  // TAB SWITCHING (load data lazily)
  // ============================================================

  function selectTab(tab: DuelTab): void {
    if (activeTab === tab) return
    activeTab = tab
    if (tab === 'challenge' && friends.length === 0 && !friendsLoading) {
      void fetchFriends()
    } else if (tab === 'pending') {
      void fetchPendingDuels()
    } else if (tab === 'history') {
      void fetchHistoryDuels()
    }
  }

  // Load challenge tab on mount
  $effect(() => {
    void fetchFriends()
  })

  // ============================================================
  // HELPERS
  // ============================================================

  function mapApiDuelToUi(duel: ApiDuelRecord, myId: string): UiDuelRecord {
    const amChallenger = duel.challengerId === myId
    const challengerSubmitted = duel.challengerResult !== null && duel.challengerResult !== undefined
    const opponentSubmitted = duel.opponentResult !== null && duel.opponentResult !== undefined

    let status: DuelRecord['status'] = 'pending'
    if (duel.status === 'declined') {
      status = 'declined'
    } else if (duel.status === 'completed') {
      status = 'completed'
    } else if (duel.status === 'active' || duel.status === 'awaiting_results') {
      if (challengerSubmitted && !opponentSubmitted) {
        status = amChallenger ? 'challenger_done' : 'opponent_done'
      } else if (opponentSubmitted && !challengerSubmitted) {
        status = amChallenger ? 'opponent_done' : 'challenger_done'
      } else {
        status = amChallenger ? 'opponent_done' : 'challenger_done'
      }
    }

    const myScore = amChallenger ? duel.challengerResult?.score : duel.opponentResult?.score
    const opponentScore = amChallenger ? duel.opponentResult?.score : duel.challengerResult?.score
    const opponentId = amChallenger ? duel.opponentId : duel.challengerId

    return {
      id: duel.id,
      opponentId,
      opponentName: `Rogue-${opponentId.slice(0, 6)}`,
      status,
      wagerDust: duel.wagerDust,
      myScore,
      opponentScore,
      createdAt: duel.createdAt,
      expiresAt: duel.createdAt + (48 * 60 * 60 * 1000),
      incoming: !amChallenger,
    }
  }

  function duelResult(duel: DuelRecord): 'win' | 'loss' | 'tie' | 'pending' {
    if (duel.status !== 'completed') return 'pending'
    if (duel.myScore === undefined || duel.opponentScore === undefined) return 'pending'
    if (duel.myScore > duel.opponentScore) return 'win'
    if (duel.myScore < duel.opponentScore) return 'loss'
    return 'tie'
  }

  function dustDelta(duel: DuelRecord): number {
    const result = duelResult(duel)
    if (result === 'win') return duel.wagerDust
    if (result === 'loss') return -duel.wagerDust
    return 0
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function isIncoming(duel: UiDuelRecord): boolean {
    return duel.incoming && duel.status === 'pending'
  }

  function statusLabel(duel: UiDuelRecord): string {
    switch (duel.status) {
      case 'pending': return isIncoming(duel) ? 'Incoming' : 'Awaiting answer'
      case 'challenger_done': return 'Waiting for opponent'
      case 'opponent_done': return 'Your turn'
      case 'completed': return 'Completed'
      case 'timed_out': return 'Timed out'
      case 'declined': return 'Declined'
      default: return duel.status
    }
  }
</script>

<!-- ========== DUEL VIEW ========== -->
<div class="duel-overlay" role="dialog" aria-modal="true" aria-label="Knowledge Duels">
  <div class="duel-panel">

    <!-- Header -->
    <div class="duel-header">
      <span class="duel-title">⚔️ Knowledge Duels</span>
      <button class="duel-close-btn" type="button" onclick={onClose} aria-label="Close duels">
        ✕
      </button>
    </div>

    <!-- Tab bar -->
    <div class="duel-tabs" role="tablist" aria-label="Duel sections">
      {#each (['challenge', 'pending', 'history', 'stats'] as DuelTab[]) as tab}
        <button
          class="duel-tab"
          class:duel-tab-active={activeTab === tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          onclick={() => selectTab(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      {/each}
    </div>

    <!-- Tab content -->
    <div class="duel-content">

      <!-- ===== CHALLENGE TAB ===== -->
      {#if activeTab === 'challenge'}
        <div class="duel-section" aria-label="Challenge a friend">

          {#if friendsLoading}
            <div class="duel-state-center" aria-busy="true">
              <span class="duel-spinner" aria-hidden="true">⏳</span>
              <p class="duel-state-text">Loading friends…</p>
            </div>
          {:else if friendsError !== null}
            <div class="duel-state-center">
              <p class="duel-state-text duel-error">{friendsError}</p>
              <button class="duel-retry-btn" type="button" onclick={() => void fetchFriends()}>Retry</button>
            </div>
          {:else if friends.length === 0}
            <div class="duel-state-center">
              <span class="duel-state-icon" aria-hidden="true">👥</span>
              <p class="duel-state-text">No friends to challenge yet.<br/>Add friends from the Social menu.</p>
            </div>
          {:else}
            <!-- Friend picker -->
            <div class="field-group" aria-label="Select opponent">
              <label class="field-label" for="friend-select">Select opponent</label>
              <div class="friend-list" role="listbox" aria-label="Friends list" id="friend-select">
                {#each friends as friend}
                  <button
                    class="friend-row"
                    class:friend-selected={selectedFriendId === friend.id}
                    type="button"
                    role="option"
                    aria-selected={selectedFriendId === friend.id}
                    onclick={() => { selectedFriendId = friend.id }}
                  >
                    <span class="friend-avatar" aria-hidden="true">👤</span>
                    <span class="friend-name">{friend.displayName}</span>
                    {#if selectedFriendId === friend.id}
                      <span class="friend-check" aria-hidden="true">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Wager slider -->
            <div class="field-group" aria-label="Dust wager">
              <label class="field-label" for="wager-slider">
                Wager: <span class="wager-value">{wager} dust</span>
              </label>
              <input
                id="wager-slider"
                class="wager-slider"
                type="range"
                min="0"
                max="50"
                step="5"
                bind:value={wager}
                aria-label="Wager amount in dust, 0 to 50"
              />
              <div class="wager-labels" aria-hidden="true">
                <span>0</span>
                <span>25</span>
                <span>50</span>
              </div>
            </div>

            <!-- Challenge button -->
            <button
              class="challenge-btn"
              type="button"
              onclick={() => void sendChallenge()}
              disabled={!canChallenge}
              aria-disabled={!canChallenge}
            >
              {challenging ? 'Sending…' : 'Challenge!'}
            </button>

            {#if challengeResult !== null}
              <p
                class="challenge-result"
                class:challenge-result-error={challengeResult.startsWith('Failed') || challengeResult.startsWith('Network')}
                aria-live="polite"
              >
                {challengeResult}
              </p>
            {/if}
          {/if}
        </div>

      <!-- ===== PENDING TAB ===== -->
      {:else if activeTab === 'pending'}
        <div class="duel-section" aria-label="Pending duels">
          {#if pendingLoading}
            <div class="duel-state-center" aria-busy="true">
              <span class="duel-spinner" aria-hidden="true">⏳</span>
              <p class="duel-state-text">Loading duels…</p>
            </div>
          {:else if pendingError !== null}
            <div class="duel-state-center">
              <p class="duel-state-text duel-error">{pendingError}</p>
              <button class="duel-retry-btn" type="button" onclick={() => void fetchPendingDuels()}>Retry</button>
            </div>
          {:else if pendingDuels.length === 0}
            <div class="duel-state-center">
              <span class="duel-state-icon" aria-hidden="true">📭</span>
              <p class="duel-state-text">No pending duels.</p>
            </div>
          {:else}
            <ul class="duel-list" aria-label="Pending duels list">
              {#each pendingDuels as duel (duel.id)}
                <li class="duel-card" aria-label="Duel with {duel.opponentName}">
                  <div class="duel-card-top">
                    <span class="duel-opponent">⚔️ {duel.opponentName}</span>
                    <span class="duel-status-badge">{statusLabel(duel)}</span>
                  </div>
                  {#if duel.wagerDust > 0}
                    <p class="duel-wager">💎 Wager: {duel.wagerDust} dust</p>
                  {/if}
                  <p class="duel-expires">Expires {formatDate(duel.expiresAt)}</p>
                  <div class="duel-card-actions">
                    {#if isIncoming(duel)}
                      <button
                        class="duel-accept-btn"
                        type="button"
                        onclick={() => void acceptDuel(duel.id)}
                        disabled={actioningDuelId === duel.id}
                        aria-disabled={actioningDuelId === duel.id}
                      >
                        {actioningDuelId === duel.id ? '…' : 'Accept'}
                      </button>
                      <button
                        class="duel-decline-btn"
                        type="button"
                        onclick={() => void declineDuel(duel.id)}
                        disabled={actioningDuelId === duel.id}
                        aria-disabled={actioningDuelId === duel.id}
                      >
                        Decline
                      </button>
                    {:else if duel.status === 'opponent_done'}
                      <button class="duel-answer-btn" type="button" aria-label="Answer duel questions against {duel.opponentName}">
                        Answer Questions
                      </button>
                    {:else}
                      <span class="duel-waiting-label">Waiting for {duel.opponentName}…</span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

      <!-- ===== HISTORY TAB ===== -->
      {:else if activeTab === 'history'}
        <div class="duel-section" aria-label="Duel history">
          {#if historyLoading}
            <div class="duel-state-center" aria-busy="true">
              <span class="duel-spinner" aria-hidden="true">⏳</span>
              <p class="duel-state-text">Loading history…</p>
            </div>
          {:else if historyError !== null}
            <div class="duel-state-center">
              <p class="duel-state-text duel-error">{historyError}</p>
              <button class="duel-retry-btn" type="button" onclick={() => void fetchHistoryDuels()}>Retry</button>
            </div>
          {:else if historyDuels.length === 0}
            <div class="duel-state-center">
              <span class="duel-state-icon" aria-hidden="true">📜</span>
              <p class="duel-state-text">No completed duels yet.</p>
            </div>
          {:else}
            <ul class="duel-list" aria-label="Duel history list">
              {#each historyDuels as duel (duel.id)}
                {@const result = duelResult(duel)}
                {@const delta = dustDelta(duel)}
                <li
                  class="duel-history-row"
                  class:duel-history-win={result === 'win'}
                  class:duel-history-loss={result === 'loss'}
                  class:duel-history-tie={result === 'tie'}
                  aria-label="{duel.opponentName}: {result}, {duel.myScore ?? '?'} vs {duel.opponentScore ?? '?'}"
                >
                  <span class="duel-history-result-badge duel-result-{result}">
                    {result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'tie' ? 'T' : '?'}
                  </span>
                  <div class="duel-history-info">
                    <span class="duel-history-name">{duel.opponentName}</span>
                    <span class="duel-history-scores">
                      {duel.myScore ?? '?'} – {duel.opponentScore ?? '?'}
                    </span>
                  </div>
                  <div class="duel-history-right">
                    <span class="duel-history-date">{formatDate(duel.createdAt)}</span>
                    {#if duel.wagerDust > 0}
                      <span
                        class="duel-history-dust"
                        class:dust-positive={delta > 0}
                        class:dust-negative={delta < 0}
                      >
                        {delta >= 0 ? '+' : ''}{delta} 💎
                      </span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

      <!-- ===== STATS TAB ===== -->
      {:else if activeTab === 'stats'}
        <div class="duel-section" aria-label="Duel statistics">
          {#if duelStats === null}
            <div class="duel-state-center">
              <span class="duel-state-icon" aria-hidden="true">📊</span>
              <p class="duel-state-text">No duel stats yet.<br/>Challenge a friend to start!</p>
            </div>
          {:else}
            <div class="stats-grid" aria-label="Win/loss record">
              <div class="stat-card stat-card-win">
                <span class="stat-value">{duelStats.wins}</span>
                <span class="stat-label">Wins</span>
              </div>
              <div class="stat-card stat-card-loss">
                <span class="stat-value">{duelStats.losses}</span>
                <span class="stat-label">Losses</span>
              </div>
              <div class="stat-card stat-card-tie">
                <span class="stat-value">{duelStats.ties}</span>
                <span class="stat-label">Ties</span>
              </div>
            </div>

            <div class="stats-list">
              <div class="stat-row">
                <span class="stat-row-label">Total Duels</span>
                <span class="stat-row-value">{duelStats.totalDuels}</span>
              </div>
              <div class="stat-row">
                <span class="stat-row-label">Win Rate</span>
                <span class="stat-row-value">{winRate}%</span>
              </div>
              <div class="stat-row">
                <span class="stat-row-label">Current Streak</span>
                <span class="stat-row-value">{duelStats.currentWinStreak}🔥</span>
              </div>
              <div class="stat-row">
                <span class="stat-row-label">Longest Streak</span>
                <span class="stat-row-value">{duelStats.longestWinStreak}🔥</span>
              </div>
              <div class="stat-row">
                <span class="stat-row-label">Total Dust Won</span>
                <span class="stat-row-value dust-positive">+{duelStats.totalDustWon} 💎</span>
              </div>
              <div class="stat-row">
                <span class="stat-row-label">Total Dust Lost</span>
                <span class="stat-row-value dust-negative">-{duelStats.totalDustLost} 💎</span>
              </div>
              <div class="stat-row stat-row-net">
                <span class="stat-row-label">Net Dust</span>
                <span
                  class="stat-row-value"
                  class:dust-positive={netDust >= 0}
                  class:dust-negative={netDust < 0}
                >
                  {netDust >= 0 ? '+' : ''}{netDust} 💎
                </span>
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>
</div>

<style>
  /* ---- Overlay ---- */
  .duel-overlay {
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
  .duel-panel {
    width: 100%;
    max-width: 520px;
    max-height: 92dvh;
    background: #1a1a2e;
    border: 2px solid #a78bfa44;
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
    overflow: hidden;
  }

  /* ---- Header ---- */
  .duel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #a78bfa33;
    flex-shrink: 0;
  }

  .duel-title {
    font-size: 1rem;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .duel-close-btn {
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

  .duel-close-btn:hover,
  .duel-close-btn:focus-visible {
    color: #a78bfa;
    background: #a78bfa22;
  }

  .duel-close-btn:active {
    transform: translateY(1px);
  }

  /* ---- Tabs ---- */
  .duel-tabs {
    display: flex;
    border-bottom: 1px solid #a78bfa22;
    flex-shrink: 0;
  }

  .duel-tab {
    flex: 1;
    padding: 10px 4px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: color 0.12s, border-color 0.12s;
  }

  .duel-tab:active {
    background: #a78bfa11;
  }

  .duel-tab-active {
    color: #a78bfa;
    border-bottom-color: #a78bfa;
  }

  /* ---- Content ---- */
  .duel-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .duel-section {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
  }

  /* ---- State messages ---- */
  .duel-state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 16px;
  }

  .duel-spinner {
    font-size: 1.6rem;
    animation: duel-pulse 1.2s ease-in-out infinite;
  }

  @keyframes duel-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .duel-state-icon {
    font-size: 1.8rem;
  }

  .duel-state-text {
    margin: 0;
    font-size: 0.82rem;
    color: #94a3b8;
    text-align: center;
    line-height: 1.5;
  }

  .duel-error {
    color: #f87171;
  }

  .duel-retry-btn {
    padding: 7px 18px;
    border: 1px solid #a78bfa;
    border-radius: 8px;
    background: #a78bfa22;
    color: #a78bfa;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  .duel-retry-btn:active {
    transform: translateY(1px);
  }

  /* ---- Field groups ---- */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
  }

  /* ---- Friend list ---- */
  .friend-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 160px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #a78bfa33 transparent;
  }

  .friend-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: #16213e;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
  }

  .friend-row:active {
    transform: translateY(1px);
  }

  .friend-selected {
    border-color: #a78bfa66;
    background: color-mix(in srgb, #a78bfa 12%, #16213e 88%);
  }

  .friend-avatar {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .friend-name {
    flex: 1;
    text-align: left;
  }

  .friend-check {
    color: #a78bfa;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* ---- Wager slider ---- */
  .wager-value {
    color: #f59e0b;
    font-weight: 700;
  }

  .wager-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: pointer;
    accent-color: #a78bfa;
    padding: 0;
    border: none;
    background: transparent;
  }

  .wager-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #475569;
  }

  /* ---- Challenge button ---- */
  .challenge-btn {
    padding: 12px;
    border: 0;
    border-radius: 10px;
    background: #a78bfa;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
    letter-spacing: 0.5px;
  }

  .challenge-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .challenge-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .challenge-result {
    margin: 0;
    font-size: 0.8rem;
    color: #4ade80;
    text-align: center;
    padding: 4px 0;
  }

  .challenge-result-error {
    color: #f87171;
  }

  /* ---- Duel list (shared) ---- */
  .duel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ---- Pending duel card ---- */
  .duel-card {
    background: #16213e;
    border: 1px solid #a78bfa33;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .duel-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .duel-opponent {
    font-size: 0.9rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .duel-status-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    background: #a78bfa22;
    color: #a78bfa;
    white-space: nowrap;
  }

  .duel-wager {
    margin: 0;
    font-size: 0.78rem;
    color: #f59e0b;
  }

  .duel-expires {
    margin: 0;
    font-size: 0.72rem;
    color: #475569;
  }

  .duel-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .duel-accept-btn,
  .duel-answer-btn {
    flex: 1;
    padding: 9px;
    border: 0;
    border-radius: 8px;
    background: #a78bfa;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.12s;
  }

  .duel-accept-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .duel-accept-btn:not(:disabled):active,
  .duel-answer-btn:active {
    transform: translateY(1px);
  }

  .duel-decline-btn {
    flex: 1;
    padding: 9px;
    border: 1px solid #475569;
    border-radius: 8px;
    background: transparent;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
  }

  .duel-decline-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .duel-decline-btn:not(:disabled):active {
    background: #47556922;
    transform: translateY(1px);
  }

  .duel-waiting-label {
    font-size: 0.75rem;
    color: #475569;
    font-style: italic;
    padding: 4px 0;
  }

  /* ---- History rows ---- */
  .duel-history-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #16213e;
    border: 1px solid transparent;
    border-radius: 8px;
  }

  .duel-history-win { border-color: #22c55e33; }
  .duel-history-loss { border-color: #ef444433; }
  .duel-history-tie { border-color: #94a3b833; }

  .duel-history-result-badge {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    font-weight: 900;
    flex-shrink: 0;
  }

  .duel-result-win {
    background: #22c55e33;
    color: #4ade80;
  }

  .duel-result-loss {
    background: #ef444433;
    color: #f87171;
  }

  .duel-result-tie {
    background: #94a3b822;
    color: #94a3b8;
  }

  .duel-result-pending {
    background: #f59e0b22;
    color: #f59e0b;
  }

  .duel-history-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .duel-history-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .duel-history-scores {
    font-size: 0.72rem;
    color: #94a3b8;
    font-family: monospace;
  }

  .duel-history-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  .duel-history-date {
    font-size: 0.68rem;
    color: #475569;
  }

  .duel-history-dust {
    font-size: 0.72rem;
    font-weight: 700;
  }

  /* ---- Stats ---- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 4px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    border-radius: 10px;
    background: #16213e;
    border: 1px solid transparent;
  }

  .stat-card-win { border-color: #22c55e33; }
  .stat-card-loss { border-color: #ef444433; }
  .stat-card-tie { border-color: #94a3b833; }

  .stat-value {
    font-size: 1.6rem;
    font-weight: 900;
    color: #e2e8f0;
    line-height: 1;
  }

  .stat-card-win .stat-value { color: #4ade80; }
  .stat-card-loss .stat-value { color: #f87171; }

  .stat-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: #16213e;
    border-radius: 10px;
    padding: 4px 0;
    overflow: hidden;
  }

  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    gap: 12px;
  }

  .stat-row + .stat-row {
    border-top: 1px solid #ffffff0a;
  }

  .stat-row-net {
    border-top: 1px solid #f59e0b22 !important;
    background: color-mix(in srgb, #f59e0b 5%, #16213e 95%);
  }

  .stat-row-label {
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .stat-row-value {
    font-size: 0.85rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  /* ---- Dust colors ---- */
  .dust-positive { color: #4ade80; }
  .dust-negative { color: #f87171; }

  /* ---- Responsive ---- */
  @media (max-width: 520px) {
    .duel-tab {
      font-size: 0.68rem;
      padding: 9px 2px;
    }

    .stats-grid {
      gap: 6px;
    }

    .stat-value {
      font-size: 1.3rem;
    }
  }
</style>
