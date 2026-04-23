<!-- LobbyBrowserScreen.svelte
     Full-screen lobby browser for Recall Rogue multiplayer.
     Lists public lobbies with auto-refresh, mode/fullness filters, and password modal.
     Uses listPublicLobbies + joinLobbyById from multiplayerLobbyService.
     Escape hatch: the Back button is always rendered (softlock prevention). -->
<script lang="ts">
  import type { LobbyBrowserEntry, MultiplayerMode, LobbyState } from '../../data/multiplayerTypes'
  import { MODE_DISPLAY_NAMES } from '../../data/multiplayerTypes'
  import {
    listPublicLobbies,
    joinLobbyById,
    isBroadcastMode,
  } from '../../services/multiplayerLobbyService'
  import { maskProfanity } from '../../services/profanityService'
  import { hasSteam } from '../../services/platformService'

  interface Props {
    localPlayerId: string
    localDisplayName: string
    onBack: () => void
    onJoined: (lobby: LobbyState) => void
  }

  let { localPlayerId, localDisplayName, onBack, onJoined }: Props = $props()

  // ── State ─────────────────────────────────────────────────────────────────

  let lobbies = $state<LobbyBrowserEntry[]>([])
  let modeFilter = $state<'all' | MultiplayerMode>('all')
  let fullnessFilter = $state<'any' | 'open'>('open')
  let passwordModalEntry = $state<LobbyBrowserEntry | null>(null)
  let passwordInput = $state('')
  let joinError = $state<string | null>(null)
  let loading = $state(true)
  let refreshInFlight = false

  // ── Transport source badge ────────────────────────────────────────────────

  let transportLabel = $derived(
    hasSteam ? 'Steam' : isBroadcastMode() ? 'Dev' : 'Web'
  )

  // ── Mode pills ─────────────────────────────────────────────────────────────

  const ALL_MODES: MultiplayerMode[] = ['race', 'duel', 'coop', 'trivia_night', 'same_cards']
  const MODE_ICONS: Record<string, string> = {
    race: '&#127939;',       // runner
    duel: '&#9876;',         // crossed swords
    coop: '&#129309;',       // handshake
    trivia_night: '&#127942;', // trophy
    same_cards: '&#9858;',   // card game
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function refresh(): Promise<void> {
    if (refreshInFlight) return
    refreshInFlight = true
    loading = true
    joinError = null
    try {
      lobbies = await listPublicLobbies({
        mode: modeFilter === 'all' ? undefined : modeFilter,
        fullness: fullnessFilter,
      })
    } catch (e) {
      console.error('[LobbyBrowser] refresh failed:', e)
      lobbies = []
    } finally {
      loading = false
      refreshInFlight = false
    }
  }

  // Auto-refresh every 5 s while mounted. Svelte 5 $effect with cleanup.
  $effect(() => {
    // Run an initial fetch immediately
    void refresh()
    const id = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(id)
  })

  // Re-fetch when filters change, but skip the first (mount-time) invocation.
  // The auto-refresh effect above handles the initial fetch; firing here too
  // results in a redundant parallel call on mount (short-circuited by the
  // in-flight guard but still a noisy extra round-trip).
  let filtersMounted = false
  $effect(() => {
    void modeFilter
    void fullnessFilter
    if (!filtersMounted) {
      filtersMounted = true
      return
    }
    void refresh()
  })

  // ── Join logic ─────────────────────────────────────────────────────────────

  async function handleJoin(entry: LobbyBrowserEntry): Promise<void> {
    joinError = null
    if (entry.visibility === 'password') {
      passwordModalEntry = entry
      passwordInput = ''
      return
    }
    await doJoin(entry, undefined)
  }

  async function doJoin(entry: LobbyBrowserEntry, password: string | undefined): Promise<void> {
    try {
      const lobby = await joinLobbyById(entry.lobbyId, localPlayerId, localDisplayName, password)
      onJoined(lobby)
    } catch (e) {
      joinError = e instanceof Error ? e.message : String(e)
    }
  }

  async function handlePasswordJoin(): Promise<void> {
    if (!passwordModalEntry) return
    await doJoin(passwordModalEntry, passwordInput)
    if (!joinError) {
      passwordModalEntry = null
      passwordInput = ''
    }
  }

  function handlePasswordKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') void handlePasswordJoin()
    if (e.key === 'Escape') {
      passwordModalEntry = null
      passwordInput = ''
      joinError = null
    }
  }

  function closePasswordModal(): void {
    passwordModalEntry = null
    passwordInput = ''
    joinError = null
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isNew(entry: LobbyBrowserEntry): boolean {
    return Date.now() - entry.createdAt < 15000
  }

  function isFull(entry: LobbyBrowserEntry): boolean {
    return entry.currentPlayers >= entry.maxPlayers
  }

  /**
   * C1: Primary label for the lobby card.
   * When a title is set, shows the masked title; falls back to masked hostName.
   */
  function getLobbyPrimaryLabel(entry: LobbyBrowserEntry): string {
    return (entry.title && entry.title.trim())
      ? maskProfanity(entry.title)
      : maskProfanity(entry.hostName)
  }

  /**
   * C1: Whether to show "by {hostName}" below the primary label.
   * Only rendered when a title is set — hostName is the primary label otherwise.
   */
  function showHostByLine(entry: LobbyBrowserEntry): boolean {
    return !!(entry.title && entry.title.trim())
  }
</script>

<div class="lobby-browser" role="main" aria-label="Browse Lobbies">

  <!-- Header — always rendered (escape hatch per softlock prevention) -->
  <header class="lb-header">
    <button class="back-btn" data-testid="btn-back" onclick={onBack} aria-label="Back to multiplayer menu">
      <span aria-hidden="true">&#8592;</span> Back
    </button>
    <h1 class="lb-title">Browse Lobbies</h1>
    <div class="header-actions">
      <button class="refresh-btn" data-testid="btn-refresh" onclick={() => void refresh()} aria-label="Refresh lobby list">
        &#8635; Refresh
      </button>
      <span class="transport-badge" title="Multiplayer backend">{transportLabel}</span>
    </div>
  </header>

  <!-- Filter bar -->
  <div class="filter-bar" role="group" aria-label="Filters">
    <div class="filter-group" data-testid="filter-mode" role="radiogroup" aria-label="Mode filter">
      <label class="pill-label" class:active={modeFilter === 'all'}>
        <input type="radio" name="mode-filter" value="all" checked={modeFilter === 'all'}
          onchange={() => { modeFilter = 'all' }} />
        All Modes
      </label>
      {#each ALL_MODES as mode}
        <label class="pill-label" class:active={modeFilter === mode}>
          <input type="radio" name="mode-filter" value={mode} checked={modeFilter === mode}
            onchange={() => { modeFilter = mode }} />
          <span aria-hidden="true">{@html MODE_ICONS[mode]}</span>
          {MODE_DISPLAY_NAMES[mode]}
        </label>
      {/each}
    </div>

    <div class="filter-sep" aria-hidden="true"></div>

    <div class="filter-group" role="radiogroup" aria-label="Fullness filter">
      <label class="pill-label" class:active={fullnessFilter === 'open'}>
        <input type="radio" name="fullness-filter" value="open" checked={fullnessFilter === 'open'}
          onchange={() => { fullnessFilter = 'open' }} />
        Open
      </label>
      <label class="pill-label" class:active={fullnessFilter === 'any'}>
        <input type="radio" name="fullness-filter" value="any" checked={fullnessFilter === 'any'}
          onchange={() => { fullnessFilter = 'any' }} />
        All
      </label>
    </div>
  </div>

  <!-- Main content -->
  <div class="lb-content">
    {#if loading && lobbies.length === 0}
      <!-- Spinner -->
      <div class="empty-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="empty-text">Scanning for lobbies&hellip;</p>
      </div>
    {:else if lobbies.length === 0}
      <!-- Empty state — always shows Back path -->
      <div class="empty-state" data-testid="lobby-browser-empty">
        <p class="empty-icon" aria-hidden="true">&#127760;</p>
        <p class="empty-text">No lobbies available — be the first!</p>
        <button class="create-btn" onclick={onBack}>Create a Lobby</button>
      </div>
    {:else}
      <!-- Lobby grid -->
      <ul class="lobby-grid" aria-label="Available lobbies">
        {#each lobbies as entry, index (entry.lobbyId)}
          {@const full = isFull(entry)}
          {@const fresh = isNew(entry)}
          <li class="lobby-card" data-testid="lobby-row-{index}" class:full={full} class:fresh={fresh}>
            <div class="card-top">
              <!-- C1: Primary label is title (when set) or hostName (fallback).
                   When a title is set, show "by {hostName}" as a secondary line. -->
              <div class="card-title-block" title={entry.hostName}>
                <span class="lobby-primary-label">{getLobbyPrimaryLabel(entry)}</span>
                {#if showHostByLine(entry)}
                  <span class="host-by-line">by {maskProfanity(entry.hostName)}</span>
                {/if}
              </div>
              <div class="card-badges">
                {#if fresh}
                  <span class="badge badge--new" aria-label="New lobby">&#10024; NEW</span>
                {/if}
                {#if entry.visibility === 'password'}
                  <span class="badge badge--lock" title="Password required" aria-label="Password required">&#128274;</span>
                {:else if entry.visibility === 'friends_only'}
                  <span class="badge badge--friends" title="Friends only" aria-label="Friends only">&#128101;</span>
                {/if}
              </div>
            </div>

            <div class="card-mode">
              <span class="mode-icon" aria-hidden="true">{@html MODE_ICONS[entry.mode] ?? ''}</span>
              <span class="mode-name">{MODE_DISPLAY_NAMES[entry.mode]}</span>
            </div>

            <div class="card-footer">
              <span class="player-count" class:full={full} aria-label="{entry.currentPlayers} of {entry.maxPlayers} players">
                {entry.currentPlayers}/{entry.maxPlayers}
                {#if full}<span class="full-label">FULL</span>{/if}
              </span>
              {#if entry.fairnessRating != null}
                <span class="fairness" title="Fairness rating {entry.fairnessRating}/100">
                  ★ {entry.fairnessRating}
                </span>
              {/if}
              <button
                class="join-btn"
                data-testid="btn-join-{index}"
                disabled={full}
                onclick={() => void handleJoin(entry)}
                aria-label="Join lobby hosted by {entry.hostName}"
                aria-disabled={full}
              >
                {entry.visibility === 'password' ? '🔒 Join' : 'Join'}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if joinError && !passwordModalEntry}
      <div class="join-error-toast" role="alert" aria-live="assertive">
        {joinError}
        <button class="toast-dismiss" onclick={() => { joinError = null }} aria-label="Dismiss error">✕</button>
      </div>
    {/if}
  </div>

  <!-- Password modal — when set, show over the grid -->
  {#if passwordModalEntry}
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Enter lobby password">
      <div class="modal-card">
        <h2 class="modal-title">🔒 Password Required</h2>
        <p class="modal-host">Lobby hosted by <strong>{passwordModalEntry.hostName}</strong></p>

        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="modal-input"
          data-testid="password-modal-input"
          type="password"
          placeholder="Enter password"
          bind:value={passwordInput}
          onkeydown={handlePasswordKeydown}
          aria-label="Lobby password"
          aria-describedby={joinError ? 'modal-error' : undefined}
          autofocus
        />
        {#if joinError}
          <p id="modal-error" class="modal-error" role="alert">{joinError}</p>
        {/if}

        <div class="modal-actions">
          <button class="modal-join-btn" data-testid="btn-password-submit" onclick={() => void handlePasswordJoin()}>
            Join
          </button>
          <button class="modal-cancel-btn" onclick={closePasswordModal}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}

</div>

<style>
  /* ── Root ── */
  .lobby-browser {
    position: fixed;
    inset: 0;
    background: var(--panel-bg, #12151E);
    display: flex;
    flex-direction: column;
    z-index: 150;
    font-family: var(--font-body, 'Lora', serif);
    color: #e0e0e0;
    overflow: hidden;
  }

  /* ── Header ── */
  .lb-header {
    display: flex;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #c0c0c0;
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s, color 0.15s;
    font-family: var(--font-body, 'Lora', serif);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .lb-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(22px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    flex: 1;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .refresh-btn {
    background: rgba(255, 215, 0, 0.10);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #FFD700;
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(7px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    transition: background 0.15s;
    font-family: var(--font-body, 'Lora', serif);
  }

  .refresh-btn:hover {
    background: rgba(255, 215, 0, 0.2);
  }

  .transport-badge {
    background: rgba(100, 200, 255, 0.12);
    border: 1px solid rgba(100, 200, 255, 0.3);
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #64c8ff;
    font-size: calc(10px * var(--text-scale, 1));
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    font-weight: 700;
  }

  /* ── Filter Bar ── */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-bottom: 1px solid #1e2130;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .filter-sep {
    width: 1px;
    height: calc(24px * var(--layout-scale, 1));
    background: #2A2E38;
    flex-shrink: 0;
  }

  .pill-label {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #888;
    cursor: pointer;
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid #2e3244;
    background: rgba(255, 255, 255, 0.03);
    transition: all 0.12s;
    min-height: calc(30px * var(--layout-scale, 1));
    user-select: none;
  }

  .pill-label:hover {
    border-color: rgba(255, 215, 0, 0.2);
    color: #ccc;
  }

  .pill-label.active {
    background: rgba(255, 215, 0, 0.12);
    color: #FFD700;
    border-color: rgba(255, 215, 0, 0.4);
  }

  .pill-label input[type="radio"] {
    display: none;
  }

  /* ── Main Content ── */
  .lb-content {
    flex: 1;
    overflow-y: auto;
    padding: calc(20px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    position: relative;
  }

  /* Empty / spinner state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(60px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    text-align: center;
  }

  .empty-icon {
    font-size: calc(48px * var(--text-scale, 1));
    margin: 0;
    line-height: 1;
  }

  .empty-text {
    font-size: calc(15px * var(--text-scale, 1));
    color: #666;
    margin: 0;
  }

  .create-btn {
    background: #FFD700;
    color: #12151E;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    padding: calc(12px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .create-btn:hover {
    background: #ffe84d;
  }

  /* Spinner */
  .spinner {
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    border: calc(3px * var(--layout-scale, 1)) solid #2A2E38;
    border-top-color: #FFD700;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Lobby Grid ── */
  .lobby-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: calc(16px * var(--layout-scale, 1));
  }

  @media (max-width: 1100px) {
    .lobby-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* ── Lobby Card ── */
  .lobby-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s;
  }

  .lobby-card:hover:not(.full) {
    border-color: rgba(255, 215, 0, 0.3);
    background: rgba(255, 215, 0, 0.04);
  }

  .lobby-card.full {
    opacity: 0.6;
  }

  .lobby-card.fresh {
    border-color: rgba(46, 204, 113, 0.4);
    animation: pulse-border 2s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { border-color: rgba(46, 204, 113, 0.4); }
    50% { border-color: rgba(46, 204, 113, 0.7); }
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(8px * var(--layout-scale, 1));
  }

  /* C1: Title block — stacks primary label over secondary "by {host}" line */
  .card-title-block {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
  }

  .lobby-primary-label {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #e8e8e8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Secondary "by hostName" line shown when a title overrides the primary label */
  .host-by-line {
    font-size: calc(10px * var(--text-scale, 1));
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-badges {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .badge {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
  }

  .badge--new {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
    border: 1px solid rgba(46, 204, 113, 0.4);
  }

  .badge--lock {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .badge--friends {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .card-mode {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .mode-icon {
    font-size: calc(16px * var(--text-scale, 1));
    line-height: 1;
  }

  .mode-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #aaa;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-top: auto;
  }

  .player-count {
    font-size: calc(13px * var(--text-scale, 1));
    color: #ccc;
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .player-count.full {
    color: #888;
  }

  .full-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: #666;
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    font-weight: 700;
  }

  .fairness {
    font-size: calc(11px * var(--text-scale, 1));
    color: #FFD700;
    flex: 1;
    text-align: right;
  }

  .join-btn {
    background: #FFD700;
    color: #12151E;
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    padding: calc(7px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    min-height: calc(34px * var(--layout-scale, 1));
    min-width: calc(60px * var(--layout-scale, 1));
    transition: background 0.15s, opacity 0.15s;
    flex-shrink: 0;
    margin-left: auto;
  }

  .join-btn:hover:not(:disabled) {
    background: #ffe84d;
  }

  .join-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: #888;
    color: #444;
  }

  /* ── Error toast ── */
  .join-error-toast {
    position: sticky;
    bottom: calc(16px * var(--layout-scale, 1));
    left: 0;
    right: 0;
    margin: calc(12px * var(--layout-scale, 1)) auto 0;
    max-width: calc(480px * var(--layout-scale, 1));
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid rgba(231, 76, 60, 0.4);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e74c3c;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: #e74c3c;
    cursor: pointer;
    font-size: calc(14px * var(--text-scale, 1));
    padding: 0;
    flex-shrink: 0;
  }

  /* ── Password modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal-card {
    background: #1a1e2a;
    border: 1px solid #3a3f52;
    border-radius: calc(16px * var(--layout-scale, 1));
    padding: calc(28px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    width: min(calc(400px * var(--layout-scale, 1)), 90vw);
    display: flex;
    flex-direction: column;
    gap: calc(14px * var(--layout-scale, 1));
    box-shadow: 0 calc(24px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
  }

  .modal-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(18px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0;
  }

  .modal-host {
    font-size: calc(13px * var(--text-scale, 1));
    color: #aaa;
    margin: 0;
  }

  .modal-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a3f52;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    outline: none;
    font-family: var(--font-body, 'Lora', serif);
  }

  .modal-input:focus {
    border-color: rgba(255, 215, 0, 0.5);
  }

  .modal-error {
    color: #e74c3c;
    font-size: calc(12px * var(--text-scale, 1));
    margin: 0;
  }

  .modal-actions {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .modal-join-btn {
    flex: 1;
    background: #FFD700;
    color: #12151E;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    padding: calc(12px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .modal-join-btn:hover {
    background: #ffe84d;
  }

  .modal-cancel-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #aaa;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(12px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
    font-family: var(--font-body, 'Lora', serif);
  }

  .modal-cancel-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
</style>
