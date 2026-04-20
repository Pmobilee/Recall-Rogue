<!-- MultiplayerLobby.svelte
     Full-screen multiplayer lobby for Recall Rogue.
     Handles mode selection, player list, house rules, deck settings, and start.
     Props: lobby state from multiplayerLobbyService. Not yet wired into app flow. -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { LobbyState, MultiplayerMode, DeckSelectionMode, LobbyContentSelection, LobbyVisibility } from '../../data/multiplayerTypes'
  import {
    MODE_DISPLAY_NAMES,
    MODE_DESCRIPTIONS,
    MODE_MAX_PLAYERS,
    MODE_MIN_PLAYERS,
  } from '../../data/multiplayerTypes'
  import {
    setMode,
    setDeckSelectionMode,
    setContentSelection,
    setHouseRules,
    setRanked,
    setReady,
    startGame,
    leaveLobby,
    isBroadcastMode,
    setVisibility,
    setPassword,
    setMaxPlayers,
    onLobbyUpdate,
    onGameStart,
    onRaceProgress,
    onRaceResults,
  } from '../../services/multiplayerLobbyService'
  import { initWorkshopMessageHandlers } from '../../services/multiplayerWorkshopService'
  import { hasSteam } from '../../services/platformService'
  import { ascensionProfile } from '../../services/cardPreferences'
  import { getAscensionRule, MAX_ASCENSION_LEVEL } from '../../services/ascension'
  import LobbyDeckPicker from './LobbyDeckPicker.svelte'
  import { canStartLobby, startButtonLabel } from '../utils/lobbyStartGate'
  import { describeSelection } from '../utils/lobbyDeckSelection'

  interface Props {
    lobby: LobbyState
    localPlayerId: string
    onBack: () => void
  }

  let { lobby, localPlayerId, onBack }: Props = $props()

  // Local reactive state
  let fairnessExpanded = $state(false)
  let showDeckPicker = $state(false)
  let copyFeedback = $state(false)
  /** Timeout handle for resetting copyFeedback; cleared on re-click to avoid stale resets (L1). */
  let copyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null
  /** Local password input state for the host-side password field. */
  let passwordInputValue = $state('')
  /** Whether to reveal password plaintext in the input. */
  let showPasswordText = $state(false)
  /** True while a ready-toggle network call is in flight; prevents double-submit (M7). */
  let readyPending = $state(false)

  const MODES: MultiplayerMode[] = ['race', 'same_cards', 'duel', 'coop', 'trivia_night']

  /** Max-players options for current mode: [min..max] inclusive. */
  let maxPlayersRange = $derived.by(() => {
    const min = MODE_MIN_PLAYERS[lobby.mode]
    const max = MODE_MAX_PLAYERS[lobby.mode]
    const out: number[] = []
    for (let i = min; i <= max; i++) out.push(i)
    return out
  })

  /** Whether the max-players selector is fixed (single pill, no click). */
  let isMaxPlayersFixed = $derived(lobby.mode === 'duel' || lobby.mode === 'coop')

  /** Is the current user the host? */
  let amHost = $derived(lobby.hostId === localPlayerId)

  /** True when ?mp is in the URL — enables two-tab broadcast testing mode */
  let devMode = $derived(isBroadcastMode())

  /** Local player's ready state */
  let myPlayer = $derived(lobby.players.find(p => p.id === localPlayerId))
  let isReady = $derived(myPlayer?.isReady ?? false)
  let canStart = $derived(canStartLobby(lobby, amHost))
  let lobbyAscensionRule = $derived(getAscensionRule(lobby.houseRules.ascensionLevel))

  /** Empty slots to fill player list up to maxPlayers */
  let emptySlots = $derived(
    Array.from({ length: Math.max(0, lobby.maxPlayers - lobby.players.length) })
  )

  // ── Service subscriptions — H11 & H15 ─────────────────────────────────────
  // All returned cleanup functions are collected here and called in onDestroy.

  const cleanups: Array<() => void> = []

  onMount(() => {
    // Keep lobby prop in sync with service-side broadcasts (H11).
    // Note: lobby is a prop passed from the parent; the parent owns the
    // authoritative state. These subscriptions are lightweight no-ops unless
    // the parent wires them, but registering them prevents null-handler crashes
    // and ensures this component is ready if wired later.
    cleanups.push(
      onLobbyUpdate(() => { /* parent controls lobby prop; kept for completeness */ }),
      onGameStart(() => { /* parent navigates on game-start signal */ }),
      onRaceProgress(() => { /* race progress not consumed in lobby screen */ }),
      onRaceResults(() => { /* results not consumed in lobby screen */ }),
      // H15: wire workshop message handlers (vote broadcasts, vote results)
      initWorkshopMessageHandlers(),
    )
  })

  onDestroy(() => {
    for (const fn of cleanups) fn()
    // Clear any pending copy-feedback timeout to avoid state updates after unmount.
    if (copyFeedbackTimeout !== null) clearTimeout(copyFeedbackTimeout)
  })

  // ──────────────────────────────────────────────────────────────────────────

  function handleModeSelect(mode: MultiplayerMode): void {
    if (!amHost) return
    setMode(mode)
  }

  function handleDeckSelectionMode(mode: DeckSelectionMode): void {
    if (!amHost) return
    setDeckSelectionMode(mode)
  }

  function handleContentSelect(selection: LobbyContentSelection): void {
    setContentSelection(selection)
    showDeckPicker = false
  }

  function handleTimerChange(secs: number): void {
    if (!amHost) return
    setHouseRules({ turnTimerSecs: secs })
  }

  function handleDifficultyChange(e: Event): void {
    if (!amHost) return
    const val = (e.target as HTMLSelectElement).value as 'adaptive' | 'easy' | 'hard'
    setHouseRules({ quizDifficulty: val })
  }

  function handleFairnessToggle(key: 'freshFactsOnly' | 'masteryEqualized'): void {
    if (!amHost) return
    setHouseRules({
      fairness: {
        ...lobby.houseRules.fairness,
        [key]: !lobby.houseRules.fairness[key],
      },
    })
  }

  function handleHandicapChange(e: Event): void {
    if (!amHost) return
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    setHouseRules({
      fairness: {
        ...lobby.houseRules.fairness,
        handicapPercent: val,
      },
    })
  }

  function handleRankedToggle(): void {
    if (!amHost) return
    setRanked(!lobby.isRanked)
  }

  /**
   * Debounced ready toggle (M7).
   * Disables the button immediately on click and re-enables after the server
   * echoes back a lobby update OR after an 800 ms safety timeout, whichever
   * comes first.
   */
  function handleReadyToggle(): void {
    if (readyPending) return
    readyPending = true
    setReady(!isReady)
    // Safety re-enable: if the server echo never lands, unlock after 800ms.
    const safetyTimer = setTimeout(() => {
      readyPending = false
    }, 800)
    // Re-enable as soon as the server echoes the lobby update.
    const unsub = onLobbyUpdate(() => {
      clearTimeout(safetyTimer)
      readyPending = false
      unsub()
    })
  }

  function handleStart(): void {
    if (canStart) startGame()
  }

  function handleLeave(): void {
    leaveLobby()
    onBack()
  }

  /** Copy lobby code to clipboard (L1: clears stale timeout before scheduling a new one). */
  async function handleCopyCode(): Promise<void> {
    if (!lobby.lobbyCode) return
    try {
      await navigator.clipboard.writeText(lobby.lobbyCode)
      copyFeedback = true
      // Clear any pending reset before scheduling a fresh one.
      if (copyFeedbackTimeout !== null) clearTimeout(copyFeedbackTimeout)
      copyFeedbackTimeout = setTimeout(() => {
        copyFeedback = false
        copyFeedbackTimeout = null
      }, 1800)
    } catch {
      // Clipboard API may not be available in all environments
    }
  }

  /** Host sets lobby visibility (public / password / friends_only). */
  function handleVisibilityChange(v: LobbyVisibility): void {
    if (!amHost) return
    setVisibility(v)
  }

  /** Host submits a new password (on blur or Enter). Requires at least 4 chars. */
  async function handlePasswordCommit(): Promise<void> {
    if (!amHost) return
    const val = passwordInputValue.trim()
    if (val.length === 0) {
      await setPassword(null)
    } else if (val.length >= 4) {
      await setPassword(val)
    }
    // < 4 chars: don't commit yet; user is still typing
  }

  /** Host changes max player count. */
  function handleMaxPlayersChange(n: number): void {
    if (!amHost) return
    setMaxPlayers(n)
  }

  function handleAscensionShift(delta: number): void {
    if (!amHost) return
    const highest = Math.max(0, Math.max($ascensionProfile.trivia.highestUnlockedLevel ?? 0, $ascensionProfile.study.highestUnlockedLevel ?? 0))
    const current = lobby.houseRules.ascensionLevel ?? 0
    const next = Math.max(0, Math.min(highest, current + delta))
    setHouseRules({ ascensionLevel: next })
  }

  /**
   * Describe a player's individual content pick for display in 'each_picks' mode (M15).
   * Returns null when no pick is recorded.
   */
  function describePlayerPick(player: typeof lobby.players[number]): string | null {
    const cs = player.contentSelection
    if (!cs) return null
    if (cs.type === 'study') return cs.deckName ?? null
    if (cs.type === 'trivia') return `${cs.domains.length} domains`
    if (cs.type === 'custom_deck') return cs.deckName ?? null
    if (cs.type === 'study-multi') return describeSelection(cs)
    return null
  }
</script>

<div class="mp-lobby" role="main" aria-label="Multiplayer Lobby">

  <!-- Header -->
  <header class="mp-header">
    <button class="back-btn" onclick={onBack} aria-label="Back">
      <span class="back-icon">&#8592;</span>
    </button>
    <h1 class="mp-title">Multiplayer</h1>
    {#if devMode}
      <span class="dev-badge">DEV MODE</span>
    {/if}
    <div class="header-spacer"></div>
  </header>

  <!-- Three-column layout -->
  <div class="mp-body">

    <!-- LEFT: Mode Selection -->
    <aside class="mp-panel mode-panel" aria-label="Mode selection">
      <h2 class="panel-title">Mode</h2>
      <ul class="mode-list" role="listbox" aria-label="Game modes">
        {#each MODES as mode}
          {@const isSelected = lobby.mode === mode}
          <li
            class="mode-item"
            class:selected={isSelected}
            role="option"
            aria-selected={isSelected}
            aria-disabled={!amHost}
            onclick={() => handleModeSelect(mode)}
            onkeydown={(e) => e.key === 'Enter' && handleModeSelect(mode)}
            tabindex={amHost ? 0 : -1}
          >
            <div class="mode-name">
              {MODE_DISPLAY_NAMES[mode]}
              <span class="mode-max-badge">{MODE_MAX_PLAYERS[mode]}P</span>
            </div>
            <div class="mode-desc">{MODE_DESCRIPTIONS[mode]}</div>
          </li>
        {/each}
      </ul>
    </aside>

    <!-- CENTER: Lobby -->
    <main class="mp-panel lobby-panel" aria-label="Lobby">

      <!-- Lobby code -->
      {#if lobby.lobbyCode}
        <div class="lobby-code-section">
          <span class="lobby-code-label">Lobby Code</span>
          <button
            class="lobby-code-value"
            data-testid="lobby-code"
            class:copied={copyFeedback}
            onclick={handleCopyCode}
            aria-label="Copy lobby code {lobby.lobbyCode}"
            title="Click to copy"
          >
            {lobby.lobbyCode}
            <span class="copy-hint">{copyFeedback ? 'Copied!' : 'Copy'}</span>
          </button>
          {#if lobby.visibility === 'password'}
            <span class="vis-badge vis-badge--lock" title="Password required" aria-label="Password protected">&#128274;</span>
          {:else if lobby.visibility === 'friends_only'}
            <span class="vis-badge vis-badge--friends" title="Friends only" aria-label="Friends only">&#128101;</span>
          {/if}
        </div>
      {/if}

      <!-- Player list -->
      <div class="player-list" aria-label="Players">
        {#each lobby.players as player, index}
          {@const playerPick = lobby.deckSelectionMode === 'each_picks' ? describePlayerPick(player) : null}
          <div
            class="player-slot"
            data-testid="player-slot-{index}"
            class:ready={player.isReady}
            class:is-local={player.id === localPlayerId}
            aria-label="{player.displayName} {player.isReady ? 'ready' : 'not ready'}"
          >
            <div class="player-avatar" aria-hidden="true">
              {player.displayName.charAt(0).toUpperCase()}
            </div>
            <div class="player-info">
              <span class="player-name">
                {player.displayName}
                {#if player.id === localPlayerId}<span class="you-label">(You)</span>{/if}
              </span>
              {#if playerPick}
                <span class="player-deck-pick" title={playerPick}>{playerPick}</span>
              {/if}
            </div>
            {#if player.isHost}
              <span class="host-crown" title="Host" aria-label="Host">&#9819;</span>
            {/if}
            <span
              class="ready-dot"
              class:ready={player.isReady}
              aria-label={player.isReady ? 'Ready' : 'Not ready'}
              title={player.isReady ? 'Ready' : 'Not ready'}
            ></span>
          </div>
        {/each}

        {#each emptySlots as _}
          <div class="player-slot empty" aria-label="Empty slot">
            <div class="player-avatar empty-avatar" aria-hidden="true">?</div>
            <span class="player-name waiting-text">Waiting for player...</span>
          </div>
        {/each}
      </div>

      <!-- Actions -->
      <div class="lobby-actions">
        <button
          class="ready-btn"
          data-testid="btn-ready"
          class:is-ready={isReady}
          disabled={readyPending}
          onclick={handleReadyToggle}
          aria-pressed={isReady}
          aria-busy={readyPending}
        >
          {readyPending ? 'Updating...' : isReady ? 'Not Ready' : 'Ready'}
        </button>

        {#if amHost}
          <button
            class="start-btn"
            data-testid="btn-start-game"
            disabled={!canStart}
            onclick={handleStart}
            aria-label={startButtonLabel(lobby, amHost)}
          >
            {startButtonLabel(lobby, amHost)}
          </button>
        {/if}
      </div>
    </main>

    <!-- RIGHT: Settings -->
    <aside class="mp-panel settings-panel" aria-label="Lobby settings">
      <div class="panel-title-row">
        <h2 class="panel-title">Settings</h2>
        {#if lobby.houseRules.ascensionLevel > 0}
          <span class="asc-badge" data-testid="ascension-badge" aria-label="Ascension {lobby.houseRules.ascensionLevel} active">
            Ascension {lobby.houseRules.ascensionLevel}
          </span>
        {/if}
      </div>

      <!-- Content Selection -->
      <section class="settings-section">
        <h3 class="section-label">Content</h3>

        <!-- Current selection display -->
        <div class="content-selection-display">
          {#if lobby.contentSelection}
            {#if lobby.contentSelection.type === 'study-multi'}
              <span class="content-badge content-badge--multi">Multi-Select</span>
              <span class="content-name">{describeSelection(lobby.contentSelection)}</span>
            {:else if lobby.contentSelection.type === 'study'}
              <span class="content-badge content-badge--study">Study Deck</span>
              <span class="content-name">{lobby.contentSelection.deckName}</span>
            {:else if lobby.contentSelection.type === 'trivia'}
              <span class="content-badge content-badge--trivia">Trivia Mix</span>
              <span class="content-name">{lobby.contentSelection.domains.length} domains</span>
            {:else if lobby.contentSelection.type === 'custom_deck'}
              <span class="content-badge content-badge--custom">Custom Deck</span>
              <span class="content-name">{lobby.contentSelection.deckName}</span>
            {/if}
          {:else}
            <span class="content-none">No content selected</span>
          {/if}
        </div>

        {#if amHost}
          <button
            class="choose-content-btn"
            data-testid="btn-deck-picker"
            onclick={() => { showDeckPicker = true }}
            aria-label={lobby.contentSelection ? 'Change content selection' : 'Choose content'}
          >
            {lobby.contentSelection ? 'Change Content' : 'Choose Content'}
          </button>
        {/if}

        <!-- Deck selection mode radios -->
        <div class="setting-row radio-row" role="radiogroup" aria-label="Deck selection mode">
          {#each (['host_picks', 'each_picks', 'random'] as DeckSelectionMode[]) as dsMode}
            {@const labels: Record<string, string> = {
              host_picks: 'Host Picks',
              each_picks: 'Each Picks',
              random: 'Random',
            }}
            <label class="radio-label" class:active={lobby.deckSelectionMode === dsMode}>
              <input
                type="radio"
                name="deck-selection"
                value={dsMode}
                checked={lobby.deckSelectionMode === dsMode}
                disabled={!amHost}
                onchange={() => handleDeckSelectionMode(dsMode)}
              />
              {labels[dsMode]}
            </label>
          {/each}
        </div>
      </section>

      <!-- House Rules -->
      <section class="settings-section">
        <h3 class="section-label">House Rules</h3>

        <!-- Turn Timer -->
        <div class="setting-row" role="radiogroup" aria-label="Turn timer">
          <span class="setting-name">Turn Timer</span>
          <div class="radio-pills">
            {#each ([20, 45, 90] as const) as secs}
              {@const timerLabels: Record<number, string> = { 20: 'Speed', 45: 'Standard', 90: 'Relaxed' }}
              <label class="pill-label" class:active={lobby.houseRules.turnTimerSecs === secs}>
                <input
                  type="radio"
                  name="turn-timer"
                  value={secs}
                  checked={lobby.houseRules.turnTimerSecs === secs}
                  disabled={!amHost}
                  onchange={() => handleTimerChange(secs)}
                />
                {timerLabels[secs]}
              </label>
            {/each}
          </div>
        </div>

        <!-- Quiz Difficulty -->
        <div class="setting-row">
          <label for="quiz-difficulty" class="setting-name">Quiz Difficulty</label>
          <select
            id="quiz-difficulty"
            class="setting-select"
            value={lobby.houseRules.quizDifficulty}
            onchange={handleDifficultyChange}
            disabled={!amHost}
            aria-label="Quiz difficulty"
          >
            <option value="adaptive">Adaptive</option>
            <option value="easy">Easy</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <!-- Ascension Level -->
        <div class="setting-row">
          <span class="setting-name">Ascension</span>
          <div class="ascension-inline">
            <button
              type="button"
              class="asc-btn"
              onclick={() => handleAscensionShift(-1)}
              disabled={!amHost || lobby.houseRules.ascensionLevel <= 0}
              aria-label="Decrease ascension"
            >−</button>
            <span class="asc-value">
              {#if lobby.houseRules.ascensionLevel > 0}
                Lv {lobby.houseRules.ascensionLevel}
                {#if lobbyAscensionRule}
                  <small class="asc-rule-name">({lobbyAscensionRule.name})</small>
                {/if}
              {:else}
                Off
              {/if}
            </span>
            <button
              type="button"
              class="asc-btn"
              onclick={() => handleAscensionShift(1)}
              disabled={!amHost || lobby.houseRules.ascensionLevel >= Math.max($ascensionProfile.trivia.highestUnlockedLevel ?? 0, $ascensionProfile.study.highestUnlockedLevel ?? 0)}
              aria-label="Increase ascension"
>+</button>
          </div>
        </div>
      </section>

      <!-- Fairness Options (collapsible) -->
      <section class="settings-section">
        <button
          class="collapsible-header"
          onclick={() => { fairnessExpanded = !fairnessExpanded }}
          aria-expanded={fairnessExpanded}
          aria-controls="fairness-options"
        >
          <h3 class="section-label">Fairness Options</h3>
          <span class="collapse-icon" aria-hidden="true">{fairnessExpanded ? '▲' : '▼'}</span>
        </button>

        {#if fairnessExpanded}
          <div id="fairness-options" class="fairness-options">
            <label class="toggle-row" class:disabled={!amHost}>
              <span class="toggle-name">Fresh Facts Only</span>
              <input
                type="checkbox"
                class="toggle-input"
                checked={lobby.houseRules.fairness.freshFactsOnly}
                disabled={!amHost}
                onchange={() => handleFairnessToggle('freshFactsOnly')}
                aria-label="Fresh facts only"
              />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>

            <label class="toggle-row" class:disabled={!amHost}>
              <span class="toggle-name">Mastery Equalized</span>
              <input
                type="checkbox"
                class="toggle-input"
                checked={lobby.houseRules.fairness.masteryEqualized}
                disabled={!amHost}
                onchange={() => handleFairnessToggle('masteryEqualized')}
                aria-label="Mastery equalized"
              />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>

            <div class="setting-row slider-row">
              <label for="handicap-slider" class="setting-name">
                Handicap
                <span class="slider-value">{lobby.houseRules.fairness.handicapPercent}%</span>
              </label>
              <input
                id="handicap-slider"
                type="range"
                class="handicap-slider"
                min="0"
                max="50"
                step="5"
                value={lobby.houseRules.fairness.handicapPercent}
                disabled={!amHost}
                oninput={handleHandicapChange}
                aria-label="Handicap percentage"
                aria-valuemin={0}
                aria-valuemax={50}
                aria-valuenow={lobby.houseRules.fairness.handicapPercent}
              />
            </div>
          </div>
        {/if}
      </section>

      <!-- Lobby Visibility (host-only) -->
      <section class="settings-section">
        <h3 class="section-label">Visibility</h3>
        {#if amHost}
          <div class="radio-pills" data-testid="visibility-toggle" role="radiogroup" aria-label="Lobby visibility">
            {#each (['public', 'password', 'friends_only'] as LobbyVisibility[]) as vis}
              {@const labels: Record<LobbyVisibility, string> = { public: 'Public', password: 'Password', friends_only: 'Friends Only' }}
              {@const isFriendsDisabled = vis === 'friends_only' && !hasSteam}
              <label
                class="pill-label"
                class:active={lobby.visibility === vis}
                class:pill-disabled={isFriendsDisabled}
                title={isFriendsDisabled ? 'Steam only' : undefined}
              >
                <input
                  type="radio"
                  name="lobby-visibility"
                  value={vis}
                  checked={lobby.visibility === vis}
                  disabled={isFriendsDisabled}
                  onchange={() => handleVisibilityChange(vis)}
                />
                {labels[vis]}
              </label>
            {/each}
          </div>
          {#if lobby.visibility === 'password'}
            <div class="password-row">
              <input
                class="password-input"
                data-testid="password-input"
                type={showPasswordText ? 'text' : 'password'}
                placeholder="Min 4 characters"
                minlength={4}
                bind:value={passwordInputValue}
                onblur={handlePasswordCommit}
                onkeydown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
                aria-label="Lobby password"
              />
              <button
                class="eye-btn"
                type="button"
                onclick={() => { showPasswordText = !showPasswordText }}
                aria-label={showPasswordText ? 'Hide password' : 'Show password'}
                title={showPasswordText ? 'Hide' : 'Show'}
              >{showPasswordText ? '&#128064;' : '&#128065;'}</button>
            </div>
          {/if}
        {:else}
          <!-- Non-host read-only badge -->
          {#if lobby.visibility === 'password'}
            <span class="vis-badge-inline">&#128274; Password required</span>
          {:else if lobby.visibility === 'friends_only'}
            <span class="vis-badge-inline">&#128101; Friends only</span>
          {:else}
            <span class="vis-badge-inline vis-badge-inline--public">Public</span>
          {/if}
        {/if}
      </section>

      <!-- Max Players (host-only) -->
      <section class="settings-section">
        <h3 class="section-label">Max Players</h3>
        {#if amHost}
          <div class="radio-pills" data-testid="max-players" role="radiogroup" aria-label="Max players">
            {#each maxPlayersRange as n}
              <label
                class="pill-label"
                class:active={lobby.maxPlayers === n}
                class:pill-disabled={isMaxPlayersFixed}
              >
                <input
                  type="radio"
                  name="max-players"
                  value={n}
                  checked={lobby.maxPlayers === n}
                  disabled={isMaxPlayersFixed}
                  onchange={() => handleMaxPlayersChange(n)}
                />
                {n}
              </label>
            {/each}
            {#if isMaxPlayersFixed}
              <span class="fixed-label">Fixed for this mode</span>
            {/if}
          </div>
        {:else}
          <span class="vis-badge-inline">{lobby.maxPlayers} players</span>
        {/if}
      </section>

      <!-- Ranked Mode -->
      <section class="settings-section">
        <label class="toggle-row ranked-toggle" class:disabled={!amHost}>
          <span class="toggle-name">Ranked Mode</span>
          <input
            type="checkbox"
            class="toggle-input"
            checked={lobby.isRanked}
            disabled={!amHost}
            onchange={handleRankedToggle}
            aria-label="Ranked mode"
          />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </section>

      {#if !amHost}
        <p class="readonly-notice" aria-live="polite">Only the host can change settings.</p>
      {/if}
    </aside>
  </div>

  <!-- Bottom bar -->
  <footer class="mp-footer">
    <button class="leave-btn" data-testid="btn-leave-lobby" onclick={handleLeave} aria-label="Leave lobby">
      Cancel / Leave
    </button>
  </footer>

  <!-- Deck picker modal -->
  {#if showDeckPicker}
    <LobbyDeckPicker
      onSelect={handleContentSelect}
      onClose={() => { showDeckPicker = false }}
    />
  {/if}
</div>

<style>
  /* ── Root ── */
  .mp-lobby {
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
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #c0c0c0;
    cursor: pointer;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .back-icon {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .mp-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(24px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0;
    letter-spacing: calc(2px * var(--layout-scale, 1));
  }

  /* ── Dev mode badge ── */
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

  /* ── Body (3-column) ── */
  .mp-body {
    display: grid;
    grid-template-columns: calc(260px * var(--layout-scale, 1)) 1fr calc(280px * var(--layout-scale, 1));
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Shared Panel ── */
  .mp-panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #2A2E38;
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .panel-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0 0 calc(4px * var(--layout-scale, 1)) 0;
    letter-spacing: calc(1.5px * var(--layout-scale, 1));
    text-transform: uppercase;
    flex-shrink: 0;
  }

  /* ── Mode List ── */
  .mode-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    flex: 1;
  }

  .mode-item {
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .mode-item:hover {
    background: rgba(255, 215, 0, 0.07);
    border-color: rgba(255, 215, 0, 0.2);
  }

  .mode-item.selected {
    background: rgba(255, 215, 0, 0.12);
    border-color: rgba(255, 215, 0, 0.5);
  }

  .mode-item[aria-disabled="true"] {
    cursor: default;
  }

  .mode-name {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #e8e8e8;
    margin-bottom: calc(3px * var(--layout-scale, 1));
  }

  .mode-max-badge {
    font-size: calc(10px * var(--text-scale, 1));
    background: rgba(255, 215, 0, 0.18);
    color: #FFD700;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    font-weight: 700;
  }

  .mode-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #888;
    line-height: 1.4;
  }

  /* ── Lobby Panel ── */
  .lobby-panel {
    align-items: stretch;
  }

  /* Lobby code */
  .lobby-code-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .lobby-code-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #666;
    text-transform: uppercase;
    letter-spacing: calc(1.5px * var(--layout-scale, 1));
  }

  .lobby-code-value {
    background: none;
    border: 1px solid #4A5068;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #FFD700;
    font-family: var(--font-rpg, 'Cinzel', monospace);
    font-size: calc(28px * var(--text-scale, 1));
    letter-spacing: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .lobby-code-value:hover {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.05);
  }

  .lobby-code-value.copied {
    border-color: #2ecc71;
    color: #2ecc71;
  }

  .copy-hint {
    font-size: calc(10px * var(--text-scale, 1));
    color: #666;
    letter-spacing: 0;
    font-family: var(--font-body, 'Lora', serif);
  }

  /* Player list */
  .player-list {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    flex: 1;
  }

  .player-slot {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(24px * var(--layout-scale, 1));
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    transition: border-color 0.2s, box-shadow 0.2s;
    min-height: calc(48px * var(--layout-scale, 1));
  }

  .player-slot.ready {
    border-color: rgba(46, 204, 113, 0.5);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(46, 204, 113, 0.15);
  }

  .player-slot.is-local {
    background: rgba(255, 215, 0, 0.05);
  }

  .player-slot.empty {
    opacity: 0.35;
    border-style: dashed;
    border-color: #333;
  }

  .player-avatar {
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(255, 215, 0, 0.18);
    color: #FFD700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    flex-shrink: 0;
  }

  .empty-avatar {
    background: rgba(255, 255, 255, 0.06);
    color: #444;
  }

  /* Player info block (name + optional deck pick) */
  .player-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    min-width: 0;
  }

  .player-name {
    font-size: calc(13px * var(--text-scale, 1));
    color: #ddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Per-player deck pick shown in 'each_picks' mode (M15) */
  .player-deck-pick {
    font-size: calc(10px * var(--text-scale, 1));
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }

  .waiting-text {
    color: #555;
    font-style: italic;
  }

  .you-label {
    color: #888;
    font-size: calc(11px * var(--text-scale, 1));
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  .host-crown {
    font-size: calc(16px * var(--text-scale, 1));
    color: #FFD700;
  }

  .ready-dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #444;
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .ready-dot.ready {
    background: #2ecc71;
    box-shadow: 0 0 calc(5px * var(--layout-scale, 1)) rgba(46, 204, 113, 0.6);
  }

  /* Action buttons */
  .lobby-actions {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .ready-btn,
  .start-btn {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1px * var(--layout-scale, 1));
  }

  .ready-btn {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
    border: 1px solid rgba(46, 204, 113, 0.4);
  }

  .ready-btn:hover:not(:disabled) {
    background: rgba(46, 204, 113, 0.32);
  }

  .ready-btn.is-ready {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.4);
  }

  .ready-btn.is-ready:hover:not(:disabled) {
    background: rgba(231, 76, 60, 0.32);
  }

  .ready-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .start-btn {
    background: #FFD700;
    color: #12151E;
  }

  .start-btn:hover:not(:disabled) {
    background: #ffe84d;
  }

  .start-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ── Settings Panel ── */
  .settings-section {
    border-bottom: 1px solid #1e2130;
    padding-bottom: calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .settings-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .section-label {
    font-size: calc(11px * var(--text-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    color: #888;
    margin: 0;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
  }

  .setting-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #ccc;
    flex: 1;
    white-space: nowrap;
  }

  /* Content selection display */
  .content-selection-display {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    min-height: calc(32px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .content-badge {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .content-badge--study {
    background: rgba(59, 130, 246, 0.25);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .content-badge--trivia {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.35);
  }

  .content-badge--custom {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.35);
  }

  .content-badge--multi {
    background: rgba(255, 215, 0, 0.18);
    color: #FFD700;
    border: 1px solid rgba(255, 215, 0, 0.4);
  }

  .content-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #d0d0e0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .content-none {
    font-size: calc(12px * var(--text-scale, 1));
    color: #505060;
    font-style: italic;
  }

  .choose-content-btn {
    padding: calc(7px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 215, 0, 0.12);
    border: 1px solid rgba(255, 215, 0, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #FFD700;
    font-size: calc(12px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
    width: 100%;
    font-weight: 600;
  }

  .choose-content-btn:hover {
    background: rgba(255, 215, 0, 0.22);
    border-color: #FFD700;
  }

  /* Radio rows */
  .radio-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #999;
    cursor: pointer;
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    border: 1px solid transparent;
    transition: border-color 0.12s, color 0.12s;
    min-height: calc(28px * var(--layout-scale, 1));
  }

  .radio-label.active {
    color: #FFD700;
    border-color: rgba(255, 215, 0, 0.4);
  }

  .radio-label input[type="radio"] {
    accent-color: #FFD700;
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
  }

  /* Pill radio buttons */
  .radio-pills {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .pill-label {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #888;
    cursor: pointer;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid #2e3244;
    background: rgba(255, 255, 255, 0.03);
    transition: all 0.12s;
    min-height: calc(28px * var(--layout-scale, 1));
  }

  .pill-label.active {
    background: rgba(255, 215, 0, 0.14);
    color: #FFD700;
    border-color: rgba(255, 215, 0, 0.4);
  }

  .pill-label input[type="radio"] {
    display: none;
  }

  /* Select */
  .setting-select {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a3f52;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    min-height: calc(32px * var(--layout-scale, 1));
    cursor: pointer;
    flex: 1;
  }

  .setting-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Collapsible header */
  .collapsible-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    width: 100%;
    padding: 0;
    min-height: calc(36px * var(--layout-scale, 1));
  }

  .collapse-icon {
    font-size: calc(10px * var(--text-scale, 1));
    color: #666;
  }

  .fairness-options {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    padding-top: calc(4px * var(--layout-scale, 1));
  }

  /* Toggle rows */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    min-height: calc(36px * var(--layout-scale, 1));
    position: relative;
  }

  .toggle-row.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .toggle-name {
    flex: 1;
    font-size: calc(12px * var(--text-scale, 1));
    color: #ccc;
  }

  /* Visually hide native checkbox, show track instead */
  .toggle-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .toggle-track {
    width: calc(36px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    background: #333;
    border: 1px solid #444;
    flex-shrink: 0;
    transition: background 0.2s;
    position: relative;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    top: calc(2px * var(--layout-scale, 1));
    left: calc(2px * var(--layout-scale, 1));
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #666;
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-input:checked ~ .toggle-track {
    background: rgba(46, 204, 113, 0.4);
    border-color: #2ecc71;
  }

  .toggle-input:checked ~ .toggle-track::after {
    transform: translateX(calc(16px * var(--layout-scale, 1)));
    background: #2ecc71;
  }

  /* Slider */
  .slider-row {
    flex-direction: column;
    align-items: stretch;
  }

  .slider-value {
    color: #FFD700;
    font-size: calc(11px * var(--text-scale, 1));
    margin-left: calc(6px * var(--layout-scale, 1));
  }

  .handicap-slider {
    width: 100%;
    accent-color: #FFD700;
    cursor: pointer;
  }

  .handicap-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Ranked toggle */
  .ranked-toggle {
    background: rgba(255, 255, 255, 0.03);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border: 1px solid #2A2E38;
  }

  .readonly-notice {
    font-size: calc(11px * var(--text-scale, 1));
    color: #555;
    text-align: center;
    font-style: italic;
    margin: 0;
    margin-top: auto;
  }

  /* ── Footer ── */
  .mp-footer {
    display: flex;
    justify-content: flex-start;
    padding: calc(12px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-top: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .leave-btn {
    background: rgba(231, 76, 60, 0.12);
    border: 1px solid rgba(231, 76, 60, 0.35);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e74c3c;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .leave-btn:hover {
    background: rgba(231, 76, 60, 0.22);
  }

  /* ── Visibility badges in lobby code header ── */
  .vis-badge {
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1;
  }

  /* ── Visibility / password settings ── */
  .pill-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .password-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-top: calc(6px * var(--layout-scale, 1));
  }

  .password-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a3f52;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    outline: none;
    font-family: var(--font-body, 'Lora', serif);
  }

  .password-input:focus {
    border-color: rgba(255, 215, 0, 0.5);
  }

  .eye-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a3f52;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #aaa;
    cursor: pointer;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    min-width: calc(36px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s;
    flex-shrink: 0;
  }

  .eye-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  /* Read-only visibility badge for non-hosts */
  .vis-badge-inline {
    font-size: calc(11px * var(--text-scale, 1));
    color: #aaa;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #2e3244;
  }

  .vis-badge-inline--public {
    color: #2ecc71;
    border-color: rgba(46, 204, 113, 0.3);
    background: rgba(46, 204, 113, 0.07);
  }

  /* Fixed mode label in max-players selector */
  .fixed-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #555;
    font-style: italic;
    align-self: center;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  /* Ascension Level control */
  .ascension-inline {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .asc-btn {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(30, 41, 59, 0.7);
    color: #e2e8f0;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .asc-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .asc-value {
    color: #facc15;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    min-width: calc(60px * var(--layout-scale, 1));
    text-align: center;
  }

  .asc-rule-name {
    color: #94a3b8;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 400;
  }

  /* Settings panel header row (title + optional ascension badge) */
  .panel-title-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  /* Remove the bottom margin from panel-title when inside the row — row provides it */
  .panel-title-row .panel-title {
    margin-bottom: 0;
  }

  /* Ascension active badge in settings panel header */
  .asc-badge {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    color: #facc15;
    background: rgba(250, 204, 21, 0.14);
    border: 1px solid rgba(250, 204, 21, 0.4);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
