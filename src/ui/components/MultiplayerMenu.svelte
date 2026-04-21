<!-- MultiplayerMenu.svelte
     Full-screen multiplayer entry screen for Recall Rogue.
     Three paths: Create a Lobby, Join a Lobby (via 6-char code), or LAN Play.
     Shown before the MultiplayerLobby screen. -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { MultiplayerMode, LobbyVisibility } from '../../data/multiplayerTypes'
  import {
    MODE_DISPLAY_NAMES,
    MODE_DESCRIPTIONS,
    MODE_TAGLINES,
    MODE_MAX_PLAYERS,
  } from '../../data/multiplayerTypes'
  import { isBroadcastMode } from '../../services/multiplayerLobbyService'
  import {
    startLanServer,
    stopLanServer,
    getLanServerStatus,
    getLocalIps,
  } from '../../services/lanServerService'
  import type { DiscoveredLanServer } from '../../services/lanDiscoveryService'
  import {
    setLanServerUrl,
    clearLanServerUrl,
    isLanMode,
    getLanServerUrls,
  } from '../../services/lanConfigService'
  import { scanLanForServers, probeLanServer, LAN_DEFAULT_PORT } from '../../services/lanDiscoveryService'
  import { isDesktop, hasSteam } from '../../services/platformService'

  interface Props {
    onBack: () => void
    onCreateLobby: (mode: MultiplayerMode, opts: { visibility: LobbyVisibility; password?: string }) => void
    onJoinLobby: (code: string) => void
    onBrowseLobbies: () => void
  }

  let { onBack, onCreateLobby, onJoinLobby, onBrowseLobbies }: Props = $props()

  const MODES: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']

  let selectedMode = $state<MultiplayerMode>('race')
  let joinCode = $state('')
  let activeTab = $state<'create' | 'join' | 'lan'>('create')
  let joinError = $state('')

  // ── Visibility & password state (Create tab) ──────────────────────────────
  let selectedVisibility = $state<LobbyVisibility>('public')
  let passwordValue = $state('')
  let passwordError = $state('')
  let showPasswordText = $state(false)

  /** True when ?mp is in the URL — enables two-tab broadcast testing mode */
  let devMode = $derived(isBroadcastMode())

  // ── LAN state ─────────────────────────────────────────────────────────────────
  let lanServerRunning = $state(false)
  let lanServerIps = $state<string[]>([])
  let lanServerPort = $state<number | null>(null)
  let lanServerStarting = $state(false)
  let lanServerError = $state('')

  let discoveredServers = $state<DiscoveredLanServer[]>([])
  let isScanning = $state(false)
  let scanRan = $state(false)

  let manualIp = $state('')
  let manualPort = $state(String(LAN_DEFAULT_PORT))
  let connectError = $state('')
  let isConnecting = $state(false)

  let isConnectedToLan = $state(isLanMode())
  let connectedLanUrls = $state(getLanServerUrls())

  // ── Tab switch side-effect: kick off discovery on first LAN tab visit ─────────
  $effect(() => {
    if (activeTab === 'lan' && !scanRan && !isScanning) {
      runScan()
    }
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function handleModeSelect(mode: MultiplayerMode): void {
    selectedMode = mode
  }

  function handleVisibilitySelect(vis: LobbyVisibility): void {
    selectedVisibility = vis
    passwordError = ''
    if (vis !== 'password') passwordValue = ''
  }

  function handleCreateLobby(): void {
    if (selectedVisibility === 'password') {
      if (!passwordValue) {
        passwordError = 'Required'
        return
      }
      if (passwordValue.length < 4) {
        passwordError = 'Min 4 characters'
        return
      }
    }
    onCreateLobby(selectedMode, {
      visibility: selectedVisibility,
      password: selectedVisibility === 'password' ? passwordValue : undefined,
    })
  }

  /** Regex for valid lobby code characters (generator alphabet: excludes ambiguous O/0/I/1). */
  const JOIN_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/i

  function handleJoinCodeInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value.toUpperCase().slice(0, 6)
    joinCode = val
    // Clear error as soon as the code becomes valid; set it once a full 6-char
    // entry is present but contains invalid characters.
    if (val.length === 6 && !JOIN_CODE_RE.test(val)) {
      joinError = '6 characters. No O, 0, I, or 1.'
    } else {
      joinError = ''
    }
  }

  function handleJoinLobby(): void {
    if (!JOIN_CODE_RE.test(joinCode)) {
      joinError = '6 characters. No O, 0, I, or 1.'
      return
    }
    onJoinLobby(joinCode)
  }

  function handleJoinKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleJoinLobby()
  }

  let canJoin = $derived(JOIN_CODE_RE.test(joinCode))

  // ── LAN: Server management ────────────────────────────────────────────────────

  async function handleStartServer(): Promise<void> {
    lanServerError = ''
    lanServerStarting = true
    try {
      const result = await startLanServer()
      if (result) {
        lanServerRunning = true
        lanServerPort = result.port
        lanServerIps = result.localIps
        if (result.localIps.length > 0) {
          setLanServerUrl(result.localIps[0], result.port)
          isConnectedToLan = true
          connectedLanUrls = getLanServerUrls()
        }
      } else {
        // Non-Tauri platform — LAN hosting not available here.
        lanServerError = "LAN hosting requires the desktop app."
      }
    } catch (err) {
      // B1: startLanServer now throws with the real Rust error string (e.g.
      // "Port 19738 is already in use") so the player knows what to fix.
      const detail = err instanceof Error ? err.message : String(err)
      lanServerError = `Server failed to start: ${detail}`
    } finally {
      lanServerStarting = false
    }
  }

  async function handleStopServer(): Promise<void> {
    await stopLanServer()
    lanServerRunning = false
    lanServerIps = []
    lanServerPort = null
    clearLanServerUrl()
    isConnectedToLan = false
    connectedLanUrls = null
  }

  function handleLanCreateLobby(): void {
    onCreateLobby(selectedMode, { visibility: 'public' })
  }

  // ── LAN: Discovery ────────────────────────────────────────────────────────────

  async function runScan(): Promise<void> {
    isScanning = true
    scanRan = true
    connectError = ''
    try {
      discoveredServers = await scanLanForServers()
    } catch {
      discoveredServers = []
    } finally {
      isScanning = false
    }
  }

  function handleConnectToServer(server: DiscoveredLanServer): void {
    setLanServerUrl(server.ip, server.port)
    isConnectedToLan = true
    connectedLanUrls = getLanServerUrls()
    onBrowseLobbies()
  }

  async function handleManualConnect(): Promise<void> {
    connectError = ''
    const ip = manualIp.trim()
    const portNum = parseInt(manualPort, 10)

    if (!ip) {
      connectError = 'Enter an IP address.'
      return
    }
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      connectError = 'Enter a valid port number.'
      return
    }

    isConnecting = true
    try {
      const server = await probeLanServer(ip, portNum)
      if (server) {
        setLanServerUrl(ip, portNum)
        isConnectedToLan = true
        connectedLanUrls = getLanServerUrls()
        onBrowseLobbies()
      } else {
        connectError = 'No server found at that address. Check the IP and port.'
      }
    } catch {
      connectError = 'No server found at that address. Check the IP and port.'
    } finally {
      isConnecting = false
    }
  }

  function handleDisconnect(): void {
    clearLanServerUrl()
    isConnectedToLan = false
    connectedLanUrls = null
  }

  function handleManualPortKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleManualConnect()
  }

  // ── On mount: check if LAN server was already running from a previous session ─

  onMount(async () => {
    if (isDesktop) {
      const status = await getLanServerStatus()
      if (status.running && status.port !== null) {
        lanServerRunning = true
        lanServerPort = status.port
        // Fetch IPs separately — status doesn't include them.
        lanServerIps = await getLocalIps()
      }
    }
    isConnectedToLan = isLanMode()
    connectedLanUrls = getLanServerUrls()
  })
</script>

<div class="mp-menu" role="main" aria-label="Multiplayer Menu">

  <!-- Header -->
  <header class="mp-header">
    <button class="back-btn" onclick={onBack} aria-label="Back">
      <span class="back-icon">&#8592;</span>
    </button>
    <h1 class="mp-title">Multiplayer</h1>
    {#if devMode}
      <span class="dev-badge">DEV MODE — Two-Tab Testing (30-150ms simulated latency)</span>
    {/if}
    <div class="header-spacer"></div>
  </header>

  <!-- Centered content area -->
  <div class="mp-body">
    <div class="mp-content-card">

      <!-- Tab bar -->
      <div class="tab-bar" role="tablist" aria-label="Multiplayer options">
        <button
          class="tab-btn"
          class:active={activeTab === 'create'}
          data-testid="tab-create"
          role="tab"
          aria-selected={activeTab === 'create'}
          onclick={() => { activeTab = 'create' }}
        >
          Create Lobby
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'join'}
          data-testid="tab-join"
          role="tab"
          aria-selected={activeTab === 'join'}
          onclick={() => { activeTab = 'join' }}
        >
          Join Lobby
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'lan'}
          data-testid="tab-lan"
          role="tab"
          aria-selected={activeTab === 'lan'}
          onclick={() => { activeTab = 'lan' }}
        >
          LAN Play
        </button>
      </div>

      <!-- Create tab -->
      {#if activeTab === 'create'}
        <div class="tab-panel" role="tabpanel" aria-label="Create a lobby">

          <ul class="mode-list" role="listbox" aria-label="Game modes">
            {#each MODES as mode}
              {@const isSelected = selectedMode === mode}
              <li
                class="mode-card"
                class:selected={isSelected}
                data-testid="mode-{mode}"
                role="option"
                aria-selected={isSelected}
                tabindex="0"
                onclick={() => handleModeSelect(mode)}
                onkeydown={(e) => e.key === 'Enter' && handleModeSelect(mode)}
              >
                <div class="mode-card-header">
                  <span class="mode-name">{MODE_DISPLAY_NAMES[mode]}</span>
                  <span class="mode-badge">{MODE_MAX_PLAYERS[mode]}P</span>
                </div>
                <div class="mode-tagline">{MODE_TAGLINES[mode]}</div>
                <div class="mode-desc">{MODE_DESCRIPTIONS[mode]}</div>
              </li>
            {/each}
          </ul>

          <!-- Visibility picker -->
          <div class="visibility-section" data-testid="create-visibility">
            <span class="visibility-label">Who can join</span>
            <div class="radio-pills" role="radiogroup" aria-label="Lobby visibility">
              {#each (['public', 'password', 'friends_only'] as LobbyVisibility[]) as vis}
                {@const visLabels: Record<LobbyVisibility, string> = { public: 'Public', password: 'Password', friends_only: 'Friends Only' }}
                {@const isFriendsDisabled = vis === 'friends_only' && !hasSteam}
                <label
                  class="pill-label"
                  class:active={selectedVisibility === vis}
                  class:pill-disabled={isFriendsDisabled}
                  title={isFriendsDisabled ? 'Steam only — invite friends via code instead.' : undefined}
                >
                  <input
                    type="radio"
                    name="create-visibility"
                    value={vis}
                    checked={selectedVisibility === vis}
                    disabled={isFriendsDisabled}
                    onchange={() => handleVisibilitySelect(vis)}
                  />
                  {visLabels[vis]}
                </label>
              {/each}
            </div>
            {#if selectedVisibility === 'password'}
              <div class="password-row">
                <div class="password-input-wrap">
                  <input
                    class="password-input"
                    class:password-input--error={!!passwordError}
                    data-testid="create-password-input"
                    type={showPasswordText ? 'text' : 'password'}
                    placeholder="Lobby password"
                    minlength={4}
                    maxlength={32}
                    bind:value={passwordValue}
                    oninput={() => { if (passwordError) passwordError = '' }}
                    aria-label="Lobby password"
                    aria-describedby={passwordError ? 'create-password-error' : undefined}
                  />
                  <button
                    class="eye-btn"
                    type="button"
                    onclick={() => { showPasswordText = !showPasswordText }}
                    aria-label={showPasswordText ? 'Hide password' : 'Show password'}
                    title={showPasswordText ? 'Hide' : 'Show'}
                  >{showPasswordText ? '&#128064;' : '&#128065;'}</button>
                </div>
                {#if passwordError}
                  <p id="create-password-error" class="password-error" role="alert">{passwordError}</p>
                {/if}
              </div>
            {/if}
          </div>

          <div class="create-footer">
            <button class="primary-btn" data-testid="btn-create-lobby" onclick={handleCreateLobby}>
              Create Lobby
            </button>
            <button class="browse-btn" data-testid="btn-browse-lobbies" onclick={onBrowseLobbies}>
              &#127760; Browse Lobbies
            </button>
          </div>
        </div>
      {/if}

      <!-- Join tab -->
      {#if activeTab === 'join'}
        <div class="tab-panel join-panel" role="tabpanel" aria-label="Join a lobby">
          <div class="join-card">
            <label class="join-label" for="join-code-input">Enter Lobby Code</label>
            <input
              id="join-code-input"
              data-testid="join-code-input"
              class="join-input"
              class:join-input--error={!!joinError}
              type="text"
              maxlength="6"
              placeholder="XXXXXX"
              value={joinCode}
              oninput={handleJoinCodeInput}
              onkeydown={handleJoinKeydown}
              autocomplete="off"
              spellcheck={false}
              aria-label="6-character lobby code"
              aria-describedby={joinError ? 'join-error' : undefined}
            />
            {#if joinError}
              <p id="join-error" class="join-error" role="alert">{joinError}</p>
            {/if}
            <button
              class="primary-btn"
              data-testid="btn-join-lobby"
              disabled={!canJoin}
              onclick={handleJoinLobby}
            >
              Join Lobby
            </button>
          </div>
        </div>
      {/if}

      <!-- LAN Play tab -->
      {#if activeTab === 'lan'}
        <div class="tab-panel lan-panel" role="tabpanel" aria-label="LAN Play">

          <!-- Connected banner -->
          {#if isConnectedToLan && connectedLanUrls}
            <div class="lan-connected-banner" role="status" aria-live="polite">
              <span class="status-dot status-dot--green" aria-hidden="true"></span>
              <span class="lan-connected-text">
                Connected to LAN server at {connectedLanUrls.apiUrl.replace('http://', '')}
              </span>
              <button class="ghost-btn" onclick={handleDisconnect} data-testid="btn-lan-disconnect">
                Disconnect
              </button>
            </div>
          {/if}

          <!-- ── Section 1: Host ──────────────────────────────────────────── -->
          <section class="lan-section" aria-labelledby="lan-host-heading">
            <h2 class="lan-section-title" id="lan-host-heading">Host a LAN Game</h2>

            {#if !isDesktop}
              <p class="lan-note">
                Hosting only works in the desktop app. You can still join a game below.
              </p>
            {:else}
              <!-- Server status row -->
              {#if lanServerRunning}
                <div class="server-status" role="status" aria-live="polite">
                  <span class="status-dot status-dot--green" aria-hidden="true"></span>
                  <span class="server-status-text">
                    Server running at
                    {#if lanServerIps.length > 0}
                      <strong>{lanServerIps[0]}:{lanServerPort}</strong>
                    {:else}
                      <strong>port {lanServerPort}</strong>
                    {/if}
                  </span>
                </div>
                {#if lanServerIps.length > 1}
                  <p class="server-also-reachable">
                    Also reachable at: {lanServerIps.slice(1).join(', ')}
                  </p>
                {/if}
              {/if}

              {#if lanServerError}
                <p class="lan-error" role="alert">{lanServerError}</p>
              {/if}

              <div class="host-actions">
                {#if !lanServerRunning}
                  <button
                    class="primary-btn"
                    data-testid="btn-start-lan-server"
                    disabled={lanServerStarting}
                    onclick={handleStartServer}
                  >
                    {lanServerStarting ? 'Starting…' : 'Start LAN Server'}
                  </button>
                {:else}
                  <button
                    class="danger-btn"
                    data-testid="btn-stop-lan-server"
                    onclick={handleStopServer}
                  >
                    Stop Server
                  </button>
                  <!-- Mode selector for creating a lobby on this LAN server -->
                  <div class="host-mode-row">
                    <label class="lan-label" for="lan-mode-select">Mode</label>
                    <select
                      id="lan-mode-select"
                      class="lan-mode-select"
                      value={selectedMode}
                      onchange={(e) => handleModeSelect((e.target as HTMLSelectElement).value as MultiplayerMode)}
                    >
                      {#each MODES as mode}
                        <option value={mode}>{MODE_DISPLAY_NAMES[mode]}</option>
                      {/each}
                    </select>
                    <button
                      class="primary-btn"
                      data-testid="btn-lan-create-lobby"
                      onclick={handleLanCreateLobby}
                    >
                      Create Lobby
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </section>

          <div class="lan-divider" role="separator" aria-hidden="true"></div>

          <!-- ── Section 2: Join ──────────────────────────────────────────── -->
          <section class="lan-section" aria-labelledby="lan-join-heading">
            <h2 class="lan-section-title" id="lan-join-heading">Join a LAN Game</h2>

            <!-- Scan results -->
            <div class="scan-header">
              <span class="scan-status-text" aria-live="polite" role="status">
                {#if isScanning}
                  Scanning your network…
                {:else if scanRan && discoveredServers.length === 0}
                  Nothing found. Ask the host to start their server first.
                {:else if !scanRan}
                  &nbsp;
                {/if}
              </span>
              <button
                class="ghost-btn"
                data-testid="btn-rescan"
                disabled={isScanning}
                onclick={runScan}
              >
                {isScanning ? 'Scanning…' : 'Rescan Network'}
              </button>
            </div>

            {#if discoveredServers.length > 0}
              <ul class="server-list" aria-label="Discovered LAN servers">
                {#each discoveredServers as server, i}
                  <li class="server-row" data-testid="lan-server-{i}">
                    <div class="server-info">
                      <span class="server-hostname">
                        {server.hostName ?? server.ip}
                      </span>
                      <span class="server-address">{server.ip}:{server.port}</span>
                    </div>
                    <button
                      class="primary-btn server-connect-btn"
                      data-testid="btn-connect-lan-{i}"
                      onclick={() => handleConnectToServer(server)}
                    >
                      Connect
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}

            <!-- Manual entry -->
            <div class="manual-entry" aria-label="Manual server connection">
              <label class="lan-label" for="lan-ip-input">IP Address</label>
              <div class="manual-row">
                <input
                  id="lan-ip-input"
                  data-testid="lan-ip-input"
                  class="lan-input lan-input--ip"
                  type="text"
                  placeholder="192.168.1.x"
                  value={manualIp}
                  oninput={(e) => { manualIp = (e.target as HTMLInputElement).value; connectError = '' }}
                  autocomplete="off"
                  aria-label="Server IP address"
                />
                <input
                  id="lan-port-input"
                  data-testid="lan-port-input"
                  class="lan-input lan-input--port"
                  type="text"
                  placeholder={String(LAN_DEFAULT_PORT)}
                  value={manualPort}
                  oninput={(e) => { manualPort = (e.target as HTMLInputElement).value; connectError = '' }}
                  onkeydown={handleManualPortKeydown}
                  autocomplete="off"
                  aria-label="Server port"
                />
                <button
                  class="primary-btn"
                  data-testid="btn-manual-connect"
                  disabled={isConnecting || !manualIp.trim()}
                  onclick={handleManualConnect}
                >
                  {isConnecting ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              {#if connectError}
                <p class="lan-error" role="alert">{connectError}</p>
              {/if}
            </div>
          </section>

        </div>
      {/if}

    </div>
  </div>
</div>

<style>
  /* ===== Layout ===== */
  .mp-menu {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel-bg, #12151E);
    color: #e0e0e0;
    font-family: var(--font-body, 'Lora', serif);
    overflow: hidden;
    z-index: 200;
  }

  /* ===== Header ===== */
  .mp-header {
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
    justify-content: center;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-size: calc(18px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: rgba(255, 215, 0, 0.12);
    color: #FFD700;
    border-color: #FFD700;
  }

  .back-icon {
    line-height: 1;
  }

  .mp-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 600;
    color: #FFD700;
    letter-spacing: 0.04em;
    margin: 0;
  }

  /* ===== Dev mode badge ===== */
  .dev-badge {
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid rgba(231, 76, 60, 0.4);
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #e74c3c;
    font-size: calc(10px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    text-transform: uppercase;
    font-weight: 700;
  }

  .header-spacer {
    flex: 1;
  }

  /* ===== Body ===== */
  .mp-body {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow-y: auto;
    padding: calc(32px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
  }

  .mp-content-card {
    width: 100%;
    max-width: calc(680px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    overflow: hidden;
  }

  /* ===== Tab bar ===== */
  .tab-bar {
    display: flex;
    border-bottom: 1px solid #2A2E38;
  }

  .tab-btn {
    flex: 1;
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    color: #888;
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 500;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
    border-bottom: calc(2px * var(--layout-scale, 1)) solid transparent;
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: #e0e0e0;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn.active {
    color: #FFD700;
    border-bottom-color: #FFD700;
    background: rgba(255, 215, 0, 0.06);
  }

  /* ===== Tab panels ===== */
  .tab-panel {
    padding: calc(20px * var(--layout-scale, 1));
  }

  /* ===== Mode list (Create tab) ===== */
  .mode-list {
    list-style: none;
    margin: 0 0 calc(16px * var(--layout-scale, 1)) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .mode-card {
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .mode-card:hover {
    background: rgba(255, 215, 0, 0.06);
    border-color: rgba(255, 215, 0, 0.35);
  }

  .mode-card.selected {
    background: rgba(255, 215, 0, 0.1);
    border-color: #FFD700;
  }

  .mode-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .mode-name {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #FFD700;
    letter-spacing: 0.03em;
  }

  .mode-card.selected .mode-name {
    color: #FFD700;
  }

  .mode-badge {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #888;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid #2A2E38;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    letter-spacing: 0.04em;
  }

  .mode-card.selected .mode-badge {
    color: #FFD700;
    border-color: rgba(255, 215, 0, 0.4);
  }

  .mode-tagline {
    font-size: calc(12px * var(--text-scale, 1));
    color: #aaa;
    font-style: italic;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .mode-desc {
    font-size: calc(12px * var(--text-scale, 1));
    color: #666;
    line-height: 1.45;
  }

  /* ===== Visibility picker (Create tab) ===== */
  .visibility-section {
    margin-bottom: calc(16px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .visibility-label {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(12px * var(--text-scale, 1));
    color: #888;
    letter-spacing: 0.04em;
  }

  /* ===== Radio pills (shared pattern from MultiplayerLobby) ===== */
  .radio-pills {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .pill-label {
    display: inline-flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(7px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border: 1px solid #2A2E38;
    border-radius: calc(20px * var(--layout-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(13px * var(--text-scale, 1));
    color: #aaa;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    min-height: calc(36px * var(--layout-scale, 1));
    user-select: none;
  }

  .pill-label input[type='radio'] {
    display: none;
  }

  .pill-label:hover:not(.pill-disabled) {
    border-color: rgba(255, 215, 0, 0.4);
    color: #e0e0e0;
    background: rgba(255, 215, 0, 0.05);
  }

  .pill-label.active {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.12);
    color: #FFD700;
    font-weight: 600;
  }

  .pill-label.pill-disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  /* ===== Password row (Create tab) ===== */
  .password-row {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .password-input-wrap {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .password-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(5px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(9px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-height: calc(40px * var(--layout-scale, 1));
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .password-input::placeholder {
    color: #444;
  }

  .password-input:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.5);
    background: rgba(255, 215, 0, 0.03);
  }

  .password-input--error {
    border-color: rgba(224, 92, 92, 0.6);
  }

  .password-error {
    color: #e05c5c;
    font-size: calc(12px * var(--text-scale, 1));
    margin: 0;
    font-family: var(--font-body, 'Lora', serif);
  }

  .eye-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #888;
    cursor: pointer;
    font-size: calc(16px * var(--text-scale, 1));
    flex-shrink: 0;
    transition: border-color 0.15s, color 0.15s;
  }

  .eye-btn:hover {
    border-color: #aaa;
    color: #e0e0e0;
  }

  /* ===== Create footer ===== */
  .create-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
    padding-top: calc(4px * var(--layout-scale, 1));
  }

  /* ===== Join tab ===== */
  .join-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(280px * var(--layout-scale, 1));
  }

  .join-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(360px * var(--layout-scale, 1));
    padding: calc(28px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .join-label {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(14px * var(--text-scale, 1));
    color: #aaa;
    letter-spacing: 0.05em;
  }

  .join-input {
    font-family: 'Courier New', Courier, monospace;
    font-size: calc(28px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.3em;
    text-align: center;
    color: #FFD700;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    width: 100%;
    text-transform: uppercase;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .join-input::placeholder {
    color: #333;
    letter-spacing: 0.2em;
  }

  .join-input:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.5);
    background: rgba(255, 215, 0, 0.04);
  }

  .join-input--error {
    border-color: rgba(224, 92, 92, 0.6);
  }

  .join-error {
    color: #e05c5c;
    font-size: calc(13px * var(--text-scale, 1));
    margin: 0;
    text-align: center;
  }

  /* ===== Primary button ===== */
  .primary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: calc(44px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    background: #FFD700;
    color: #12151E;
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s, transform 0.1s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #ffe033;
    transform: translateY(-1px);
  }

  .primary-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .primary-btn:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  .browse-btn {
    background: rgba(255, 215, 0, 0.10);
    border: 1px solid rgba(255, 215, 0, 0.35);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #FFD700;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s, border-color 0.15s;
  }

  .browse-btn:hover {
    background: rgba(255, 215, 0, 0.20);
    border-color: rgba(255, 215, 0, 0.6);
  }

  /* ===== LAN Play tab ===== */
  .lan-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .lan-connected-banner {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(80, 200, 120, 0.08);
    border: 1px solid rgba(80, 200, 120, 0.3);
    border-radius: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(16px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    flex-wrap: wrap;
  }

  .lan-connected-text {
    flex: 1;
    color: #7de0a0;
    font-family: var(--font-body, 'Lora', serif);
  }

  .lan-section {
    padding: calc(4px * var(--layout-scale, 1)) 0 calc(16px * var(--layout-scale, 1)) 0;
  }

  .lan-section-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #FFD700;
    letter-spacing: 0.05em;
    margin: 0 0 calc(12px * var(--layout-scale, 1)) 0;
  }

  .lan-divider {
    height: 1px;
    background: #2A2E38;
    margin: calc(4px * var(--layout-scale, 1)) 0 calc(20px * var(--layout-scale, 1)) 0;
  }

  .lan-note {
    font-size: calc(13px * var(--text-scale, 1));
    color: #888;
    margin: 0 0 calc(8px * var(--layout-scale, 1)) 0;
    font-style: italic;
  }

  /* ===== Status dot ===== */
  .status-dot {
    display: inline-block;
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot--green {
    background: #50C878;
    box-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(80, 200, 120, 0.6);
  }

  /* ===== Server status ===== */
  .server-status {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(80, 200, 120, 0.08);
    border: 1px solid rgba(80, 200, 120, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(6px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    color: #7de0a0;
  }

  .server-status-text {
    flex: 1;
  }

  .server-status-text strong {
    font-family: 'Courier New', Courier, monospace;
    color: #a0eebc;
  }

  .server-also-reachable {
    font-size: calc(12px * var(--text-scale, 1));
    color: #666;
    margin: 0 0 calc(10px * var(--layout-scale, 1)) 0;
    padding-left: calc(4px * var(--layout-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
  }

  .lan-error {
    color: #e05c5c;
    font-size: calc(13px * var(--text-scale, 1));
    margin: calc(6px * var(--layout-scale, 1)) 0 calc(8px * var(--layout-scale, 1)) 0;
    font-family: var(--font-body, 'Lora', serif);
  }

  /* ===== Host actions ===== */
  .host-actions {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .host-mode-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .lan-label {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(12px * var(--text-scale, 1));
    color: #888;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .lan-mode-select {
    flex: 1;
    min-width: calc(140px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    min-height: calc(36px * var(--layout-scale, 1));
    transition: border-color 0.15s;
  }

  .lan-mode-select:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.5);
  }

  /* ===== Danger button ===== */
  .danger-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: calc(44px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    background: rgba(224, 92, 92, 0.15);
    border: 1px solid rgba(224, 92, 92, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e05c5c;
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    align-self: flex-start;
  }

  .danger-btn:hover {
    background: rgba(224, 92, 92, 0.28);
    border-color: rgba(224, 92, 92, 0.65);
  }

  /* ===== Ghost button ===== */
  .ghost-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: calc(32px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: transparent;
    border: 1px solid #2A2E38;
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #888;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .ghost-btn:hover:not(:disabled) {
    border-color: #aaa;
    color: #e0e0e0;
  }

  .ghost-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ===== Scan header ===== */
  .scan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: calc(10px * var(--layout-scale, 1));
    min-height: calc(32px * var(--layout-scale, 1));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .scan-status-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #666;
    font-family: var(--font-body, 'Lora', serif);
    font-style: italic;
  }

  /* ===== Server list ===== */
  .server-list {
    list-style: none;
    margin: 0 0 calc(14px * var(--layout-scale, 1)) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .server-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(6px * var(--layout-scale, 1));
    gap: calc(10px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s;
  }

  .server-row:hover {
    background: rgba(255, 215, 0, 0.04);
    border-color: rgba(255, 215, 0, 0.2);
  }

  .server-info {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
  }

  .server-hostname {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    color: #e0e0e0;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .server-address {
    font-family: 'Courier New', Courier, monospace;
    font-size: calc(11px * var(--text-scale, 1));
    color: #666;
  }

  .server-connect-btn {
    padding: calc(8px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    flex-shrink: 0;
    font-size: calc(12px * var(--text-scale, 1));
  }

  /* ===== Manual entry ===== */
  .manual-entry {
    padding: calc(12px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .manual-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    align-items: stretch;
    flex-wrap: wrap;
  }

  .lan-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(4px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-family: 'Courier New', Courier, monospace;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(9px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    min-height: calc(40px * var(--layout-scale, 1));
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .lan-input::placeholder {
    color: #444;
  }

  .lan-input:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.45);
    background: rgba(255, 215, 0, 0.03);
  }

  .lan-input--ip {
    flex: 2;
    min-width: calc(130px * var(--layout-scale, 1));
  }

  .lan-input--port {
    flex: 1;
    min-width: calc(72px * var(--layout-scale, 1));
    max-width: calc(90px * var(--layout-scale, 1));
  }
</style>
