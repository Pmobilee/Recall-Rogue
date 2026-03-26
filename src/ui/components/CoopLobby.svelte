<script lang="ts">
  export let lobbyId: string = ''
  export let playerId: string = ''
  export let playerName: string = 'Miner'
  export let onStart: (() => void) | undefined = undefined
  export let onClose: (() => void) | undefined = undefined

  interface LobbyPlayer { id: string; name: string; ready: boolean }

  let players: LobbyPlayer[] = []
  let isHost = false
  let loading = true
  let error = ''
  let roomMode = false

  async function loadLobby(): Promise<void> {
    loading = true
    error = ''
    try {
      const res = await fetch(`/api/coop/lobby/${lobbyId}`)
      if (res.ok) {
        const data = await res.json() as {
          lobby?: { players?: LobbyPlayer[]; hostId?: string }
          slots?: Array<{ playerId: string; displayName: string; connected?: boolean } | null>
        }
        if (data.lobby?.players && data.lobby.hostId) {
          roomMode = false
          players = data.lobby.players
          isHost = data.lobby.hostId === playerId
        } else if (Array.isArray(data.slots)) {
          roomMode = true
          players = data.slots
            .filter((slot): slot is { playerId: string; displayName: string; connected?: boolean } => Boolean(slot))
            .map((slot) => ({
              id: slot.playerId,
              name: slot.displayName,
              ready: Boolean(slot.connected),
            }))
          isHost = players.some((player) => player.id === playerId) && players[0]?.id === playerId
        } else {
          error = 'Lobby payload is invalid.'
        }
      } else {
        error = 'Lobby not found.'
      }
    } catch { error = 'Failed to load lobby' }
    finally { loading = false }
  }

  async function toggleReady(): Promise<void> {
    const me = players.find(p => p.id === playerId)
    if (!me) return
    if (roomMode) {
      players = players.map((player) => (
        player.id === playerId ? { ...player, ready: !player.ready } : player
      ))
      return
    }
    await fetch(`/api/coop/lobby/${lobbyId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ready: !me.ready })
    })
    await loadLobby()
  }

  async function leaveLobby(): Promise<void> {
    if (roomMode) {
      if (onClose) onClose()
      return
    }
    await fetch(`/api/coop/lobby/${lobbyId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    })
    if (onClose) onClose()
  }

  function startDive(): void {
    if (onStart) onStart()
  }

  $: allReady = players.length >= 2 && players.every(p => p.ready)

  loadLobby()
</script>

<div class="lobby-overlay" role="dialog" aria-label="Co-op Lobby for {playerName}">
  <div class="lobby-panel">
    <div class="lobby-header">
      <h2>Co-op Dive</h2>
      <button class="close-x" on:click={leaveLobby} aria-label="Leave">&times;</button>
    </div>

    {#if loading}
      <p class="loading">Loading lobby...</p>
    {:else if error}
      <p class="error-text">{error}</p>
    {:else}
      <div class="player-list">
        {#each players as player}
          <div class="player-card" class:ready={player.ready} class:host={player.id === playerId && isHost}>
            <span class="player-icon">{player.ready ? '\u2705' : '\u23F3'}</span>
            <span class="player-name">{player.name}{player.id === playerId ? ' (You)' : ''}</span>
            {#if isHost && player.id !== playerId}
              <span class="host-badge">Host</span>
            {/if}
          </div>
        {/each}
        {#each Array(4 - players.length) as _}
          <div class="player-card empty">
            <span class="player-icon">&#x2B55;</span>
            <span class="player-name">Waiting...</span>
          </div>
        {/each}
      </div>

      <p class="lobby-code">Lobby Code: <strong>{lobbyId.slice(-6).toUpperCase()}</strong></p>

      <div class="lobby-actions">
        <button class="ready-btn" on:click={toggleReady}>
          {players.find(p => p.id === playerId)?.ready ? 'Not Ready' : 'Ready'}
        </button>
        {#if isHost}
          <button class="start-btn" on:click={startDive} disabled={!allReady}>
            {allReady ? 'Start Dive' : 'Waiting for players...'}
          </button>
        {/if}
      </div>
      {#if roomMode}
        <p class="loading">Room mode: ready state is local until full websocket session flow is connected.</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .lobby-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.9);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; pointer-events: auto;
  }
  .lobby-panel {
    background: #16213e; border-radius: 10px; padding: 24px;
    max-width: 380px; width: 100%; border: 1px solid #0f3460;
  }
  .lobby-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .lobby-header h2 { font-family: var(--font-rpg); font-size: 13px; color: #e94560; margin: 0; }
  .close-x { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0; }
  .loading, .error-text { color: #888; text-align: center; font-size: 13px; }
  .player-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .player-card {
    display: flex; align-items: center; gap: 10px;
    background: #0f3460; border-radius: 8px; padding: 12px;
    border: 2px solid transparent; transition: border-color 0.3s;
  }
  .player-card.ready { border-color: #2ecc71; }
  .player-card.empty { opacity: 0.4; }
  .player-icon { font-size: 18px; }
  .player-name { flex: 1; color: #e0e0e0; font-size: 13px; }
  .host-badge { font-size: 9px; color: #e94560; background: #1a1a2e; padding: 2px 6px; border-radius: 8px; }
  .lobby-code { text-align: center; color: #888; font-size: 12px; margin: 12px 0; }
  .lobby-code strong { color: #e94560; font-family: var(--font-rpg); font-size: 14px; letter-spacing: 2px; }
  .lobby-actions { display: flex; flex-direction: column; gap: 8px; }
  .ready-btn, .start-btn {
    width: 100%; padding: 12px; border: none; border-radius: 6px;
    font-family: var(--font-rpg); font-size: 11px; cursor: pointer;
  }
  .ready-btn { background: #2ecc71; color: white; }
  .start-btn { background: #e94560; color: white; }
  .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
