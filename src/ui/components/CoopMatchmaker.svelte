<!-- Co-op Matchmaker — three-tab UI for starting a cooperative dive session.
     Supports Host (create lobby), Enter Code (join by 6-char code), and Quickmatch. -->
<script lang="ts">
  import { createLobby, joinLobby, findByCode, quickmatchJoin, quickmatchLeave } from '../../services/coopService'
  import { playerSave } from '../stores/playerData'

  interface Props {
    onRoomReady: (roomId: string, role: 'miner' | 'scholar') => void
    onClose: () => void
  }

  let { onRoomReady, onClose }: Props = $props()

  type Tab = 'host' | 'code' | 'quickmatch'
  let tab = $state<Tab>('host')
  let code = $state('')
  let status = $state('')
  let loading = $state(false)
  let pollingInterval = $state<ReturnType<typeof setInterval> | null>(null)

  let save = $derived($playerSave)
  let playerId = $derived(save?.playerId ?? 'guest')
  let playerName = $derived('Miner')

  async function handleHost(): Promise<void> {
    loading = true
    status = ''
    try {
      const { roomId } = await createLobby(playerId, playerName)
      onRoomReady(roomId, 'miner')
    } catch {
      status = 'Could not create lobby.'
    } finally {
      loading = false
    }
  }

  async function handleCode(): Promise<void> {
    loading = true
    status = ''
    const result = await findByCode(code.trim())
    if (!result) { status = 'Code not found.'; loading = false; return }
    try {
      await joinLobby(result.roomId, playerId, playerName)
      onRoomReady(result.roomId, 'scholar')
    } catch {
      status = 'Could not join room.'
    } finally {
      loading = false
    }
  }

  async function handleQuickmatch(): Promise<void> {
    loading = true
    status = 'Searching for a partner...'
    try {
      const result = await quickmatchJoin(playerId, playerName)
      if (result.matched && result.roomId) {
        onRoomReady(result.roomId, 'scholar')
        loading = false
        return
      }
    } catch {
      status = 'Could not join queue.'
      loading = false
      return
    }
    // Poll every 3 s for up to 60 s.
    let elapsed = 0
    pollingInterval = setInterval(async () => {
      elapsed += 3000
      if (elapsed >= 60_000) { stopPolling(); status = 'No match found. Try again.'; return }
      try {
        const poll = await quickmatchJoin(playerId, playerName)
        if (poll.matched && poll.roomId) { stopPolling(); onRoomReady(poll.roomId, 'scholar') }
      } catch { /* keep polling */ }
    }, 3000)
  }

  function stopPolling(): void {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
    loading = false
  }

  function handleClose(): void {
    stopPolling()
    quickmatchLeave(playerId).catch(() => {})
    onClose()
  }
</script>

<div class="matchmaker-overlay" role="dialog" aria-label="Co-op Matchmaker">
  <div class="matchmaker-panel">
    <div class="mm-header">
      <h2>Co-op Dive</h2>
      <button class="close-x" onclick={handleClose} aria-label="Close">&times;</button>
    </div>

    <div class="tab-row">
      {#each (['host', 'code', 'quickmatch'] as Tab[]) as t}
        <button class="tab-btn" class:active={tab === t} onclick={() => { tab = t; status = '' }}>
          {t === 'host' ? 'Host' : t === 'code' ? 'Enter Code' : 'Quickmatch'}
        </button>
      {/each}
    </div>

    {#if tab === 'host'}
      <p class="mm-desc">Create a lobby and share the code with a friend.</p>
      <button class="action-btn" onclick={handleHost} disabled={loading}>
        {loading ? 'Creating...' : 'Create Lobby'}
      </button>

    {:else if tab === 'code'}
      <p class="mm-desc">Enter the 6-character code your partner shared.</p>
      <input
        class="code-input"
        bind:value={code}
        maxlength={6}
        placeholder="XXXXXX"
        aria-label="Room code"
      />
      <button class="action-btn" onclick={handleCode} disabled={loading || code.length < 6}>
        {loading ? 'Joining...' : 'Join'}
      </button>

    {:else}
      <p class="mm-desc">Find a random partner to mine with.</p>
      <button class="action-btn" onclick={handleQuickmatch} disabled={loading}>
        {loading ? 'Searching...' : 'Find Partner'}
      </button>
      {#if loading}
        <button class="cancel-btn" onclick={stopPolling}>Cancel</button>
      {/if}
    {/if}

    {#if status}
      <p class="status-text">{status}</p>
    {/if}
  </div>
</div>

<style>
  .matchmaker-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.88);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; pointer-events: auto;
  }
  .matchmaker-panel {
    background: #16213e; border: 1px solid #0f3460; border-radius: 10px;
    padding: 24px; width: 340px; display: flex; flex-direction: column; gap: 12px;
  }
  .mm-header { display: flex; justify-content: space-between; align-items: center; }
  .mm-header h2 { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #e94560; margin: 0; }
  .close-x { background: none; border: none; color: #888; font-size: 22px; cursor: pointer; }
  .tab-row { display: flex; gap: 6px; }
  .tab-btn {
    flex: 1; padding: 8px 4px; font-size: 10px; font-family: 'Press Start 2P', monospace;
    background: #0f3460; border: 1px solid #1a4a8a; border-radius: 4px; color: #aaa; cursor: pointer;
  }
  .tab-btn.active { background: #1a4a8a; color: #fff; border-color: #4ecca3; }
  .mm-desc { color: #aaa; font-size: 12px; margin: 0; }
  .action-btn {
    padding: 12px; background: #e94560; color: #fff; border: none; border-radius: 6px;
    font-family: 'Press Start 2P', monospace; font-size: 11px; cursor: pointer;
  }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .cancel-btn {
    padding: 8px; background: #333; color: #aaa; border: none; border-radius: 4px;
    font-size: 11px; cursor: pointer;
  }
  .code-input {
    padding: 10px; background: #0f3460; border: 1px solid #1a4a8a; border-radius: 4px;
    color: #fff; font-family: 'Press Start 2P', monospace; font-size: 16px;
    text-align: center; letter-spacing: 4px; text-transform: uppercase;
  }
  .status-text { color: #e94560; font-size: 11px; text-align: center; }
</style>
