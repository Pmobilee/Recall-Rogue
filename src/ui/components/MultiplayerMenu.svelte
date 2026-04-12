<!-- MultiplayerMenu.svelte
     Full-screen multiplayer entry screen for Recall Rogue.
     Two paths: Create a Lobby (with mode selection) or Join a Lobby (via 6-char code).
     Shown before the MultiplayerLobby screen. -->
<script lang="ts">
  import type { MultiplayerMode } from '../../data/multiplayerTypes'
  import {
    MODE_DISPLAY_NAMES,
    MODE_DESCRIPTIONS,
    MODE_TAGLINES,
    MODE_MAX_PLAYERS,
  } from '../../data/multiplayerTypes'
  import { isBroadcastMode } from '../../services/multiplayerLobbyService'

  interface Props {
    onBack: () => void
    onCreateLobby: (mode: MultiplayerMode) => void
    onJoinLobby: (code: string) => void
    onBrowseLobbies: () => void
  }

  let { onBack, onCreateLobby, onJoinLobby, onBrowseLobbies }: Props = $props()

  const MODES: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']

  let selectedMode = $state<MultiplayerMode>('race')
  let joinCode = $state('')
  let activeTab = $state<'create' | 'join'>('create')
  let joinError = $state('')

  /** True when ?mp is in the URL — enables two-tab broadcast testing mode */
  let devMode = $derived(isBroadcastMode())

  function handleModeSelect(mode: MultiplayerMode): void {
    selectedMode = mode
  }

  function handleCreateLobby(): void {
    onCreateLobby(selectedMode)
  }

  function handleJoinCodeInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value.toUpperCase().slice(0, 6)
    joinCode = val
    if (joinError) joinError = ''
  }

  function handleJoinLobby(): void {
    if (joinCode.length !== 6) {
      joinError = 'Code must be 6 characters'
      return
    }
    onJoinLobby(joinCode)
  }

  function handleJoinKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleJoinLobby()
  }

  let canJoin = $derived(joinCode.length === 6)
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
</style>
