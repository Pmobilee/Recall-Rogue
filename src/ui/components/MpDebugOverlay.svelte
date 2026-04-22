<!-- MpDebugOverlay.svelte
     Developer-only live overlay for multiplayer diagnostics.
     Gated on $devMode — only visible with ?dev=true or VITE_DEV_TOOLS=1.
     Never rendered in production / normal gameplay.
     Mount point: CardApp.svelte (top-level, survives scene changes).
-->
<script lang="ts">
  import { devMode } from '../stores/devMode'
  import { getMpDebugState, type MpDebugState } from '../../services/mpDebugState'

  // ── Lazy service imports — guarded at runtime so the overlay still renders ──
  // when the game-logic agent's helpers haven't landed yet.

  /** Attempt to import getP2PConnectionState — returns null string if unavailable. */
  async function tryGetP2PConnectionState(steamId: string): Promise<string> {
    try {
      const mod = await import('../../services/steamNetworkingService')
      // game-logic agent adds steam_get_p2p_connection_state to SteamCommandArgs;
      // invokeSteam is always present. Guard against the command being absent from
      // SteamCommandArgs with a runtime typeof check.
      const fn = (mod as Record<string, unknown>)['getP2PConnectionState'] as
        | ((id: string) => Promise<string | null>)
        | undefined
      if (typeof fn === 'function') {
        return (await fn(steamId)) ?? '(null)'
      }
      // Fallback: call invokeSteam directly with the raw command name
      const result = await mod.invokeSteam(
        'steam_get_p2p_connection_state' as Parameters<typeof mod.invokeSteam>[0],
        { steamId } as Parameters<typeof mod.invokeSteam>[1],
      )
      return result != null ? String(result) : '(unavailable)'
    } catch {
      return '(cmd unavailable)'
    }
  }

  /** Attempt to call lanTcpProbe — returns result string. */
  async function tryLanTcpProbe(host: string, port: number, timeoutMs: number): Promise<string> {
    try {
      const mod = await import('../../services/steamNetworkingService')
      const fn = (mod as Record<string, unknown>)['lanTcpProbe'] as
        | ((host: string, port: number, timeoutMs: number) => Promise<string | null>)
        | undefined
      if (typeof fn === 'function') {
        return (await fn(host, port, timeoutMs)) ?? '(null response)'
      }
      return '(cmd unavailable)'
    } catch {
      return '(cmd unavailable)'
    }
  }

  // ── Component state ──────────────────────────────────────────────────────────

  let mpState = $state<MpDebugState>(getMpDebugState())
  // BUG9: Local state tracking whether we're in an active MP lobby.
  // window.__rrMpState is not a $state proxy — polled in the refresh $effect below.
  let mpLobbyActive = $state(false)
  let probeHost = $state('192.168.1.')
  let probePort = $state(19738)
  let probeResult = $state<string | null>(null)
  let probeRunning = $state(false)
  let p2pStateStr = $state<string | null>(null)
  let copyFeedback = $state(false)
  let minimized = $state(false)

  // ── Refresh loop ─────────────────────────────────────────────────────────────

  $effect(() => {
    // BUG9: Run the interval when in dev mode OR when in a multiplayer lobby.
    // We use a single unified loop so lobby-check and P2P state both update together.
    const interval = setInterval(async () => {
      mpState = getMpDebugState()
      // BUG9: Update mpLobbyActive on each tick; window.__rrMpState is not a $state
      // proxy so we poll it here rather than deriving reactively.
      mpLobbyActive = !!mpState.lobby

      if (!$devMode && !mpLobbyActive) return

      // Refresh P2P connection state if we have a steam ID to probe
      const peerId = mpState.transport?.peerId
      if (peerId && peerId.length > 0) {
        p2pStateStr = await tryGetP2PConnectionState(peerId)
      } else {
        p2pStateStr = null
      }
    }, 1000)

    return () => clearInterval(interval)
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function fmt(v: unknown): string {
    if (v === null || v === undefined) return '–'
    return String(v)
  }

  async function handleProbe(): Promise<void> {
    if (probeRunning) return
    probeRunning = true
    probeResult = 'probing...'
    try {
      probeResult = await tryLanTcpProbe(probeHost, probePort, 3000)
    } catch (e) {
      probeResult = `error: ${String(e)}`
    } finally {
      probeRunning = false
    }
  }

  function handleCopyState(): void {
    const text = JSON.stringify({ ...mpState, p2pState: p2pStateStr }, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      copyFeedback = true
      setTimeout(() => { copyFeedback = false }, 1500)
    }).catch(() => {
      copyFeedback = true
      setTimeout(() => { copyFeedback = false }, 800)
    })
  }
</script>

{#if $devMode || mpLobbyActive}
  <div
    class="mp-debug-overlay"
    data-dev-only="true"
    role="complementary"
    aria-label="MP debug overlay"
  >
    <!-- Header bar -->
    <div class="mp-debug-header">
      <span class="mp-debug-title">MP Debug</span>
      <button
        class="mp-debug-btn mp-debug-minimize"
        onclick={() => { minimized = !minimized }}
        aria-label={minimized ? 'Expand' : 'Minimize'}
      >{minimized ? '▲' : '▼'}</button>
      <button
        class="mp-debug-btn mp-debug-copy"
        onclick={handleCopyState}
        aria-label="Copy state to clipboard"
      >{copyFeedback ? 'Copied' : 'Copy'}</button>
    </div>

    {#if !minimized}
      <div class="mp-debug-body">
        <!-- Lobby section -->
        <div class="mp-debug-section">
          <div class="mp-debug-section-label">Lobby</div>
          {#if mpState.lobby}
            <div class="mp-debug-row"><span class="mp-debug-key">id</span><span class="mp-debug-val">{fmt(mpState.lobby.id)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">code</span><span class="mp-debug-val">{fmt(mpState.lobby.code)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">mode</span><span class="mp-debug-val">{fmt(mpState.lobby.mode)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">deckSel</span><span class="mp-debug-val">{fmt(mpState.lobby.deckSelectionMode)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">players</span><span class="mp-debug-val">{fmt(mpState.lobby.playerCount)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">content.type</span><span class="mp-debug-val">{fmt(mpState.lobby.contentSelectionType)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">content.decks</span><span class="mp-debug-val">{fmt(mpState.lobby.contentDecksLength)}</span></div>
          {:else}
            <div class="mp-debug-empty">no lobby</div>
          {/if}
        </div>

        <!-- Transport section -->
        <div class="mp-debug-section">
          <div class="mp-debug-section-label">Transport</div>
          {#if mpState.transport}
            <div class="mp-debug-row"><span class="mp-debug-key">state</span><span class="mp-debug-val mp-debug-val--{mpState.transport.state}">{fmt(mpState.transport.state)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">peerId</span><span class="mp-debug-val mp-debug-val--mono">{fmt(mpState.transport.peerId) || '–'}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">preConnBuf</span><span class="mp-debug-val">{fmt(mpState.transport.preConnectBufferSize)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">lastSend</span><span class="mp-debug-val">{fmt(mpState.transport.lastSendResult)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">lastErr</span><span class="mp-debug-val mp-debug-val--err">{fmt(mpState.transport.lastError)}</span></div>
          {:else}
            <div class="mp-debug-empty">no transport</div>
          {/if}
        </div>

        <!-- Steam P2P section -->
        <div class="mp-debug-section">
          <div class="mp-debug-section-label">Steam / P2P</div>
          {#if mpState.steam}
            <div class="mp-debug-row"><span class="mp-debug-key">localSteamId</span><span class="mp-debug-val mp-debug-val--mono">{fmt(mpState.steam.localSteamId)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">localPlayerId</span><span class="mp-debug-val mp-debug-val--mono">{fmt(mpState.steam.localPlayerId)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">p2pState</span><span class="mp-debug-val">{p2pStateStr ?? fmt(mpState.steam.p2pConnectionState)}</span></div>
          {:else}
            <div class="mp-debug-empty">no steam state</div>
          {/if}
        </div>

        <!-- LAN section -->
        <div class="mp-debug-section">
          <div class="mp-debug-section-label">LAN</div>
          {#if mpState.lan}
            <div class="mp-debug-row"><span class="mp-debug-key">boundUrl</span><span class="mp-debug-val mp-debug-val--mono">{fmt(mpState.lan.boundUrl)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">probeResult</span><span class="mp-debug-val">{fmt(mpState.lan.lastProbeResult)}</span></div>
            <div class="mp-debug-row"><span class="mp-debug-key">lastErr</span><span class="mp-debug-val mp-debug-val--err">{fmt(mpState.lan.lastError)}</span></div>
          {:else}
            <div class="mp-debug-empty">no lan state</div>
          {/if}
        </div>

        <!-- LAN probe tool -->
        <div class="mp-debug-section mp-debug-probe">
          <div class="mp-debug-section-label">Probe LAN host</div>
          <div class="mp-debug-probe-row">
            <input
              class="mp-debug-input"
              type="text"
              bind:value={probeHost}
              placeholder="host"
              aria-label="LAN probe host"
            />
            <span class="mp-debug-sep">:</span>
            <input
              class="mp-debug-input mp-debug-input--port"
              type="number"
              bind:value={probePort}
              placeholder="port"
              aria-label="LAN probe port"
            />
            <button
              class="mp-debug-btn mp-debug-probe-btn"
              onclick={handleProbe}
              disabled={probeRunning}
            >{probeRunning ? '...' : 'Probe'}</button>
          </div>
          {#if probeResult !== null}
            <div class="mp-debug-probe-result">{probeResult}</div>
          {/if}
        </div>

        <div class="mp-debug-footer">upd: {mpState.updatedAt.slice(11, 19)}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mp-debug-overlay {
    position: fixed;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    z-index: 9999;
    background: rgba(10, 10, 20, 0.88);
    border: 1px solid rgba(100, 200, 255, 0.35);
    border-radius: calc(6px * var(--layout-scale, 1));
    min-width: calc(240px * var(--layout-scale, 1));
    max-width: calc(340px * var(--layout-scale, 1));
    font-family: 'Courier New', Courier, monospace;
    font-size: calc(10px * var(--text-scale, 1));
    color: #c8d8e8;
    pointer-events: auto;
    user-select: text;
    backdrop-filter: blur(4px);
    box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
  }

  .mp-debug-header {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(100, 200, 255, 0.2);
    background: rgba(30, 60, 100, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1)) 0 0;
  }

  .mp-debug-title {
    flex: 1;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    color: #7ec8ff;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .mp-debug-btn {
    background: rgba(60, 90, 130, 0.6);
    border: 1px solid rgba(100, 180, 255, 0.3);
    border-radius: calc(3px * var(--layout-scale, 1));
    color: #a8c8e8;
    font-family: inherit;
    font-size: calc(9px * var(--text-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(20px * var(--layout-scale, 1));
    line-height: 1;
  }

  .mp-debug-btn:hover {
    background: rgba(80, 120, 170, 0.7);
    color: #d0e8ff;
  }

  .mp-debug-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mp-debug-body {
    padding: calc(6px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  .mp-debug-section {
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .mp-debug-section-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: #7ec8ff;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: calc(3px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(100, 200, 255, 0.15);
    padding-bottom: calc(2px * var(--layout-scale, 1));
  }

  .mp-debug-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: calc(4px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) 0;
    line-height: 1.4;
  }

  .mp-debug-key {
    color: #88a0b8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .mp-debug-val {
    color: #e0f0ff;
    text-align: right;
    word-break: break-all;
    max-width: 60%;
  }

  .mp-debug-val--mono {
    font-size: calc(9px * var(--text-scale, 1));
    opacity: 0.85;
  }

  .mp-debug-val--connected { color: #60dd90; }
  .mp-debug-val--connecting { color: #ffd060; }
  .mp-debug-val--disconnected { color: #a0b0c0; }
  .mp-debug-val--error { color: #ff6060; }

  .mp-debug-val--err {
    color: #ff8070;
    max-width: 65%;
  }

  .mp-debug-empty {
    color: #506070;
    font-style: italic;
    font-size: calc(9px * var(--text-scale, 1));
  }

  /* Probe tool */
  .mp-debug-probe-row {
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .mp-debug-input {
    background: rgba(20, 30, 50, 0.8);
    border: 1px solid rgba(100, 180, 255, 0.25);
    border-radius: calc(3px * var(--layout-scale, 1));
    color: #c8e0f8;
    font-family: inherit;
    font-size: calc(9px * var(--text-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
    min-height: calc(20px * var(--layout-scale, 1));
  }

  .mp-debug-input--port {
    flex: 0 0 calc(52px * var(--layout-scale, 1));
  }

  .mp-debug-sep {
    color: #607080;
    flex-shrink: 0;
  }

  .mp-debug-probe-btn {
    flex-shrink: 0;
  }

  .mp-debug-probe-result {
    font-size: calc(9px * var(--text-scale, 1));
    color: #90d0a0;
    word-break: break-all;
    padding: calc(2px * var(--layout-scale, 1)) 0;
  }

  .mp-debug-footer {
    font-size: calc(8px * var(--text-scale, 1));
    color: #405060;
    text-align: right;
    padding-top: calc(4px * var(--layout-scale, 1));
    border-top: 1px solid rgba(100, 200, 255, 0.1);
  }
</style>
