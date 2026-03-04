<script lang="ts">
  interface PlayerSearchResult {
    playerId: string
    displayName: string
    level: number
  }

  interface Props {
    guildId: string
    guildName: string
    onClose: () => void
  }

  let { guildId, guildName, onClose }: Props = $props()

  let searchQuery = $state('')
  let searchResults = $state<PlayerSearchResult[]>([])
  let searchLoading = $state(false)
  let sentInvites = $state<Set<string>>(new Set())
  let errorMessage = $state('')

  async function searchPlayers(): Promise<void> {
    const q = searchQuery.trim()
    if (!q) return
    searchLoading = true
    errorMessage = ''
    try {
      const resp = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`)
      if (!resp.ok) throw new Error('Search failed')
      const data = await resp.json() as { players: PlayerSearchResult[] }
      searchResults = data.players ?? []
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Search failed'
      searchResults = []
    } finally {
      searchLoading = false
    }
  }

  async function sendInvite(player: PlayerSearchResult): Promise<void> {
    try {
      const resp = await fetch('/api/guild/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, inviteeId: player.playerId }),
      })
      if (!resp.ok) throw new Error('Failed to send invite')
      sentInvites = new Set([...sentInvites, player.playerId])
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to send invite'
    }
  }

  function handleSearchInput(e: Event): void {
    searchQuery = (e.target as HTMLInputElement).value
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') searchPlayers()
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Invite to Guild"
  onclick={handleBackdropClick}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Invite to Guild</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
    </div>

    <div class="modal-body">
      <p class="guild-label">Inviting to: <strong>{guildName}</strong></p>

      {#if errorMessage}
        <div class="error-banner" role="alert">{errorMessage}</div>
      {/if}

      <!-- Search row -->
      <div class="search-row">
        <input
          class="search-input"
          type="search"
          placeholder="Search players by name..."
          value={searchQuery}
          oninput={handleSearchInput}
          onkeydown={handleKeydown}
          aria-label="Search players by display name"
        />
        <button
          class="btn-search"
          type="button"
          onclick={searchPlayers}
          disabled={searchLoading || !searchQuery.trim()}
          aria-label="Search players"
        >{searchLoading ? '...' : 'Search'}</button>
      </div>

      <!-- Results -->
      {#if searchResults.length > 0}
        <div class="results-list" aria-label="Player search results" aria-live="polite">
          {#each searchResults as player}
            <div class="player-row" aria-label="{player.displayName}, level {player.level}">
              <div class="player-info">
                <span class="player-name">{player.displayName}</span>
                <span class="player-level">Lv. {player.level}</span>
              </div>
              {#if sentInvites.has(player.playerId)}
                <span class="sent-badge" aria-label="Invite sent">Invited!</span>
              {:else}
                <button
                  class="btn-invite"
                  type="button"
                  onclick={() => sendInvite(player)}
                  aria-label="Invite {player.displayName}"
                >Invite</button>
              {/if}
            </div>
          {/each}
        </div>
      {:else if !searchLoading && searchQuery.trim()}
        <div class="state-msg" aria-live="polite">No players found for "{searchQuery}".</div>
      {:else if !searchQuery.trim()}
        <div class="state-msg">Enter a player name to search.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f59e0b44;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover { color: #e2e8f0; }
  .close-btn:active { transform: translateY(1px); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guild-label {
    font-size: 0.82rem;
    color: #94a3b8;
    margin: 0;
  }

  .guild-label strong { color: #f59e0b; }

  .error-banner {
    background: #7f1d1d;
    border: 1px solid #ef4444;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  .search-row {
    display: flex;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.82rem;
    padding: 9px 12px;
    transition: border-color 0.12s;
  }

  .search-input:focus {
    outline: none;
    border-color: #f59e0b;
  }

  .search-input::placeholder { color: #475569; }

  .btn-search {
    background: #f59e0b;
    border: 0;
    border-radius: 8px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 9px 16px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .btn-search:hover:not(:disabled) { background: #fbbf24; }
  .btn-search:active:not(:disabled) { transform: translateY(1px); }
  .btn-search:disabled { background: #334155; color: #64748b; cursor: not-allowed; }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .player-row {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 9px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .player-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .player-name {
    font-size: 0.85rem;
    color: #e2e8f0;
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .player-level {
    font-size: 0.68rem;
    color: #64748b;
  }

  .btn-invite {
    background: #f59e0b;
    border: 0;
    border-radius: 7px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .btn-invite:hover { background: #fbbf24; }
  .btn-invite:active { transform: translateY(1px); }

  .sent-badge {
    font-size: 0.72rem;
    font-weight: 700;
    color: #4ade80;
    flex-shrink: 0;
    padding: 7px 10px;
    background: #14532d22;
    border: 1px solid #4ade8066;
    border-radius: 7px;
  }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 16px 0;
  }
</style>
