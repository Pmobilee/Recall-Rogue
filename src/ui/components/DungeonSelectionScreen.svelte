<script lang="ts">
  import { onMount } from 'svelte';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getKnowledgeDomains } from '../../data/domainMetadata';
  import { getAllDecks } from '../../data/deckRegistry';
  import type { CustomPlaylist, CustomPlaylistItem } from '../../data/studyPreset';
  import ModeToggle from './ModeToggle.svelte';
  import DomainSidebar from './DomainSidebar.svelte';
  import TriviaContentArea from './TriviaContentArea.svelte';
  import StudyContentArea from './StudyContentArea.svelte';
  import PlaylistPickerPopup from './PlaylistPickerPopup.svelte';

  /** Shape of a completed run configuration passed back to the parent. */
  type RunConfig =
    | { mode: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
    | { mode: 'study'; deckId: string; subDeckId?: string };

  interface Props {
    /** Called when the user navigates back. */
    onback: () => void;
    /** Called when the user starts a run with the given config. */
    onStartRun: (config: RunConfig) => void;
  }

  let { onback, onStartRun }: Props = $props();

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Generate a short unique ID without external dependencies. */
  function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /** Active mode tab. */
  let mode = $state<'trivia' | 'study'>('trivia');

  // Trivia state
  /** Selected domain IDs in trivia mode. */
  let triviaSelectedDomains = $state<string[]>(getKnowledgeDomains());
  /** Per-domain subdomain selections. Empty array = all subdomains. */
  let triviaSubdomains = $state<Record<string, string[]>>({});

  // Study state
  /** Active domain filter in study mode (null = All). */
  let studyActiveDomain = $state<string | null>(null);
  /** Deck picked for study run (set when DeckDetail fires onStartRun). */
  let pendingStudyDeckId = $state<string | null>(null);
  let pendingStudySubDeck = $state<string | null>(null);

  // Custom playlists (cross-mode, persistent)
  /** All named custom playlists. */
  let customPlaylists = $state<CustomPlaylist[]>([]);
  /** ID of the currently active playlist. */
  let activePlaylistId = $state<string | null>(null);

  // Playlist picker popup state
  /** Whether the PlaylistPickerPopup is visible. */
  let showPlaylistPicker = $state(false);
  /** The item waiting to be placed into a playlist. */
  let pendingCustomItem = $state<CustomPlaylistItem | null>(null);

  /** Whether the custom playlist flyout is open. */
  let customFlyoutOpen = $state(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  /** The currently active playlist object, or null. */
  const activePlaylist = $derived(
    activePlaylistId ? (customPlaylists.find((p) => p.id === activePlaylistId) ?? null) : null,
  );

  /** Items in the active playlist (empty array if none selected). */
  const activeItems = $derived(activePlaylist?.items ?? []);

  /** Estimated fact count for the active playlist. */
  const customEstimatedFacts = $derived.by<number>(() => {
    let total = 0;
    const decks = getAllDecks();
    for (const item of activeItems) {
      if (item.type === 'study') {
        const deck = decks.find((d) => d.id === item.deckId);
        if (!deck) continue;
        if (item.subDeckId) {
          const sub = deck.subDecks?.find((s) => s.id === item.subDeckId);
          total += sub?.factCount ?? 0;
        } else {
          total += deck.factCount;
        }
      }
      // trivia fact counts are harder to estimate; skip for now
    }
    return total;
  });

  /** Whether the header "Start Run" button should be enabled. */
  const canStartTrivia = $derived(mode === 'trivia' && triviaSelectedDomains.length > 0);

  /** Whether the header start button is visible (trivia mode only). */
  const showHeaderStart = $derived(mode === 'trivia');

  /** Whether the header start button is enabled. */
  const headerStartEnabled = $derived(canStartTrivia);

  /** Whether we should show the custom bar at the bottom. */
  const showCustomBar = $derived(
    customPlaylists.length > 0 && customPlaylists.some((p) => p.items.length > 0),
  );

  // ── Persistence helpers ────────────────────────────────────────────────────

  /** Save current selection to playerSave. */
  function persistSelection(): void {
    playerSave.update((save) => {
      if (!save) return save;
      return {
        ...save,
        lastDungeonSelection: {
          mode,
          triviaConfig:
            mode === 'trivia'
              ? { domains: triviaSelectedDomains, subdomains: triviaSubdomains }
              : undefined,
          studyConfig:
            mode === 'study' && pendingStudyDeckId
              ? { deckId: pendingStudyDeckId, subDeckId: pendingStudySubDeck ?? undefined }
              : undefined,
          customPlaylists: customPlaylists.length > 0 ? customPlaylists : undefined,
          activePlaylistId: activePlaylistId ?? undefined,
        },
      };
    });
    persistPlayer();
  }

  /** Restore last selection from playerSave on mount. */
  function restoreSelection(): void {
    const save = $playerSave;
    if (!save?.lastDungeonSelection) return;
    const last = save.lastDungeonSelection;
    mode = last.mode;
    if (last.triviaConfig) {
      triviaSelectedDomains = last.triviaConfig.domains;
      triviaSubdomains = last.triviaConfig.subdomains ?? {};
    }
    if (last.studyConfig) {
      pendingStudyDeckId = last.studyConfig.deckId;
      pendingStudySubDeck = last.studyConfig.subDeckId ?? null;
    }
    if (last.customPlaylists) {
      customPlaylists = last.customPlaylists;
    }
    if (last.activePlaylistId) {
      // Verify the restored ID still exists in our playlists
      const exists = customPlaylists.some((p) => p.id === last.activePlaylistId);
      activePlaylistId = exists ? last.activePlaylistId! : (customPlaylists[0]?.id ?? null);
    } else if (customPlaylists.length > 0) {
      activePlaylistId = customPlaylists[0].id;
    }
  }

  // ── Reactive persistence ───────────────────────────────────────────────────

  $effect(() => {
    // Persist whenever key state changes.
    void mode;
    void triviaSelectedDomains;
    void triviaSubdomains;
    persistSelection();
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onMount(() => {
    playCardAudio('modal-open');
    restoreSelection();
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Handle back button click with audio. */
  function handleBack(): void {
    playCardAudio('tab-switch');
    onback();
  }

  /** Handle mode toggle. */
  function handleModeChange(next: 'trivia' | 'study'): void {
    mode = next;
  }

  /** Handle domain selection change in trivia mode. */
  function handleDomainsChange(domains: string[]): void {
    triviaSelectedDomains = domains;
  }

  /** Handle subdomain change from TriviaContentArea. */
  function handleSubdomainsChange(domain: string, subdomains: string[]): void {
    triviaSubdomains = { ...triviaSubdomains, [domain]: subdomains };
  }

  /** Handle domain selection in study mode. */
  function handleStudyDomainSelect(domain: string | null): void {
    studyActiveDomain = domain;
  }

  /** Handle "Start Run" from header button (trivia mode). */
  function handleHeaderStart(): void {
    if (mode === 'trivia') {
      if (triviaSelectedDomains.length === 0) return;
      playCardAudio('run-start');
      onStartRun({
        mode: 'trivia',
        domains: triviaSelectedDomains,
        subdomains: Object.keys(triviaSubdomains).length > 0 ? triviaSubdomains : undefined,
      });
    }
  }

  /** Handle study run start from StudyContentArea (propagated from DeckDetail). */
  function handleStudyRunStart(deckId: string, subDeckId?: string): void {
    pendingStudyDeckId = deckId;
    pendingStudySubDeck = subDeckId ?? null;
    persistSelection();
    playCardAudio('run-start');
    onStartRun({
      mode: 'study',
      deckId,
      subDeckId,
    });
  }

  // ── Custom playlist handlers ───────────────────────────────────────────────

  /**
   * Build a CustomPlaylistItem from a study deck reference.
   * Returns null if the deck can't be resolved.
   */
  function buildStudyItem(deckId: string, subDeckId?: string): CustomPlaylistItem | null {
    const decks = getAllDecks();
    const deck = decks.find((d) => d.id === deckId);
    let label = deck?.name ?? deckId;
    if (subDeckId) {
      const sub = deck?.subDecks?.find((s) => s.id === subDeckId);
      label = sub?.name ?? subDeckId;
    }
    return { type: 'study', deckId, subDeckId, label };
  }

  /** Open the playlist picker for adding a study deck. */
  function handleAddStudyToCustom(deckId: string, subDeckId?: string): void {
    const item = buildStudyItem(deckId, subDeckId);
    if (!item) return;
    pendingCustomItem = item;
    showPlaylistPicker = true;
  }

  /** Add the pending item to an existing playlist. */
  function handleAddToPlaylist(playlistId: string): void {
    if (!pendingCustomItem) return;
    const item = pendingCustomItem;
    customPlaylists = customPlaylists.map((p) => {
      if (p.id !== playlistId) return p;
      // Avoid duplicates
      const alreadyIn = p.items.some(
        (it) =>
          it.type === item.type &&
          (item.type === 'study'
            ? it.type === 'study' && it.deckId === item.deckId && it.subDeckId === item.subDeckId
            : it.type === 'trivia' &&
              it.domain === (item as Extract<CustomPlaylistItem, { type: 'trivia' }>).domain),
      );
      if (alreadyIn) return p;
      return { ...p, items: [...p.items, item] };
    });
    activePlaylistId = playlistId;
    pendingCustomItem = null;
    persistSelection();
    playCardAudio('toggle-on');
  }

  /** Create a new playlist, add the pending item to it, and make it active. */
  function handleCreateAndAdd(name: string): void {
    if (!pendingCustomItem) return;
    const item = pendingCustomItem;
    const newPlaylist: CustomPlaylist = {
      id: makeId(),
      name: name.trim(),
      createdAt: Date.now(),
      items: [item],
    };
    customPlaylists = [...customPlaylists, newPlaylist];
    activePlaylistId = newPlaylist.id;
    pendingCustomItem = null;
    persistSelection();
    playCardAudio('toggle-on');
  }

  /** Close the playlist picker without adding. */
  function handleClosePlaylistPicker(): void {
    showPlaylistPicker = false;
    pendingCustomItem = null;
  }

  /** Remove an item from the active playlist by index. */
  function handleRemoveCustomItem(index: number): void {
    if (!activePlaylistId) return;
    playCardAudio('notification-ping');
    customPlaylists = customPlaylists.map((p) => {
      if (p.id !== activePlaylistId) return p;
      return { ...p, items: p.items.filter((_, i) => i !== index) };
    });
    persistSelection();
  }

  /** Clear all items from the active playlist. */
  function handleClearCustom(): void {
    if (!activePlaylistId) return;
    playCardAudio('notification-ping');
    customPlaylists = customPlaylists.map((p) => {
      if (p.id !== activePlaylistId) return p;
      return { ...p, items: [] };
    });
    customFlyoutOpen = false;
    persistSelection();
  }

  /** Delete the active playlist entirely. */
  function handleDeletePlaylist(): void {
    if (!activePlaylistId) return;
    playCardAudio('notification-ping');
    customPlaylists = customPlaylists.filter((p) => p.id !== activePlaylistId);
    activePlaylistId = customPlaylists[0]?.id ?? null;
    customFlyoutOpen = false;
    persistSelection();
  }

  /** Toggle custom playlist flyout with audio. */
  function handleToggleCustomFlyout(): void {
    playCardAudio('tab-switch');
    customFlyoutOpen = !customFlyoutOpen;
  }

  /** Switch the active playlist. */
  function handleSwitchPlaylist(e: Event): void {
    const select = e.currentTarget as HTMLSelectElement;
    activePlaylistId = select.value;
    customFlyoutOpen = false;
    persistSelection();
  }

  /** Start a run from the active playlist. */
  function handleStartCustomRun(): void {
    if (activeItems.length === 0) return;
    const firstStudy = activeItems.find(
      (it): it is Extract<CustomPlaylistItem, { type: 'study' }> => it.type === 'study',
    );
    if (firstStudy) {
      playCardAudio('run-start');
      persistSelection();
      onStartRun({
        mode: 'study',
        deckId: firstStudy.deckId,
        subDeckId: firstStudy.subDeckId,
      });
    }
  }
</script>

<div class="dungeon-selection-screen">
  <!-- ── Header ── -->
  <header class="screen-header">
    <button class="back-btn" onclick={handleBack} aria-label="Back">
      &#8592; Back
    </button>

    <h1 class="screen-title">Dungeon Selection</h1>

    <!-- Header Start Run (trivia mode only) -->
    <button
      class="header-start-btn"
      class:disabled={!headerStartEnabled}
      disabled={!headerStartEnabled}
      onclick={handleHeaderStart}
      style={showHeaderStart ? '' : 'visibility: hidden'}
      aria-label="Start Run"
    >
      Start Run &#9658;
    </button>
  </header>

  <!-- ── Mode toggle ── -->
  <div class="mode-row">
    <ModeToggle {mode} onModeChange={handleModeChange} />
  </div>

  <!-- ── Main layout: sidebar + content ── -->
  <div class="main-layout">
    <DomainSidebar
      {mode}
      selectedDomains={triviaSelectedDomains}
      onDomainsChange={handleDomainsChange}
      activeDomain={studyActiveDomain}
      onDomainSelect={handleStudyDomainSelect}
    />

    <div class="content-wrapper">
      {#if mode === 'trivia'}
        <TriviaContentArea
          selectedDomains={triviaSelectedDomains}
          subdomainSelections={triviaSubdomains}
          onSubdomainsChange={handleSubdomainsChange}
        />
      {:else}
        <StudyContentArea
          activeDomain={studyActiveDomain}
          onStartStudyRun={handleStudyRunStart}
          onAddToCustom={handleAddStudyToCustom}
          onDomainSwitch={(domain) => { studyActiveDomain = domain; }}
        />
      {/if}
    </div>
  </div>

  <!-- ── Custom playlist bar (shown when at least one playlist has items) ── -->
  {#if showCustomBar}
    <div class="custom-bar">
      <!-- Left: playlist switcher + info -->
      <div class="custom-bar-left">
        <span class="custom-bar-icon" aria-hidden="true">&#128203;</span>
        {#if customPlaylists.length > 1}
          <select
            class="playlist-select"
            value={activePlaylistId ?? ''}
            onchange={handleSwitchPlaylist}
            aria-label="Switch playlist"
          >
            {#each customPlaylists as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {:else if activePlaylist}
          <span class="playlist-name-static">{activePlaylist.name}</span>
        {/if}
        <span class="custom-bar-meta">
          {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
          {#if customEstimatedFacts > 0}
            &nbsp;({customEstimatedFacts.toLocaleString()} facts)
          {/if}
        </span>
      </div>

      <!-- Right: actions -->
      <div class="custom-bar-actions">
        <button
          class="custom-bar-btn view-btn"
          onclick={handleToggleCustomFlyout}
          aria-expanded={customFlyoutOpen}
        >
          {customFlyoutOpen ? 'Close' : 'View'}
        </button>
        <button
          class="custom-bar-btn start-btn"
          onclick={handleStartCustomRun}
          disabled={activeItems.length === 0}
          aria-label="Start custom run"
        >
          &#9654; Start
        </button>
      </div>
    </div>

    <!-- Custom playlist flyout -->
    {#if customFlyoutOpen && activePlaylist}
      <div class="custom-flyout" role="dialog" aria-label="Custom playlist">
        <div class="flyout-header">
          <span class="flyout-title">{activePlaylist.name}</span>
          <div class="flyout-header-actions">
            <button class="flyout-clear" onclick={handleClearCustom}>Clear</button>
            <button class="flyout-delete" onclick={handleDeletePlaylist}>Delete Playlist</button>
          </div>
        </div>
        <div class="flyout-items">
          {#each activePlaylist.items as item, i (i)}
            <div class="flyout-item">
              <span class="flyout-item-icon">{item.type === 'trivia' ? '&#9876;' : '&#128218;'}</span>
              <span class="flyout-item-label">{item.label}</span>
              <button
                class="flyout-item-remove"
                onclick={() => handleRemoveCustomItem(i)}
                aria-label="Remove {item.label}"
              >&#10005;</button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Playlist picker popup (rendered outside the main div to avoid z-index issues) -->
{#if showPlaylistPicker}
  <PlaylistPickerPopup
    playlists={customPlaylists}
    onAddToPlaylist={handleAddToPlaylist}
    onCreateAndAdd={handleCreateAndAdd}
    onClose={handleClosePlaylistPicker}
  />
{/if}

<style>
  .dungeon-selection-screen {
    position: fixed;
    inset: 0;
    background: linear-gradient(160deg, #0a0e1a 0%, #0d1117 50%, #0a1020 100%);
    display: flex;
    flex-direction: column;
    z-index: 200;
    overflow: hidden;
    color: #e0e0e0;
  }

  /* ── Header ── */
  .screen-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(10, 14, 30, 0.98) 0%, rgba(10, 14, 26, 0.92) 100%);
    flex-shrink: 0;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .back-btn {
    background: none;
    border: none;
    color: #8b949e;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: color 0.15s, background 0.15s;
    justify-self: start;
    white-space: nowrap;
  }

  .back-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.06);
  }

  .screen-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #e6edf3;
    margin: 0;
    text-align: center;
    letter-spacing: 0.3px;
  }

  .header-start-btn {
    justify-self: end;
    height: calc(38px * var(--layout-scale, 1));
    padding: 0 calc(20px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: none;
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: #fff;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  }

  .header-start-btn:hover:not(.disabled):not(:disabled) {
    transform: scale(1.03);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(22, 163, 74, 0.4);
  }

  .header-start-btn.disabled,
  .header-start-btn:disabled {
    background: #1f2937;
    color: #374151;
    cursor: not-allowed;
  }

  /* ── Mode toggle row ── */
  .mode-row {
    display: flex;
    justify-content: center;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    background: rgba(10, 14, 26, 0.6);
  }

  /* ── Main layout ── */
  .main-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  /* ── Custom playlist bar ── */
  .custom-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: linear-gradient(90deg, rgba(79, 70, 229, 0.15), rgba(99, 102, 241, 0.12));
    border-top: 1px solid rgba(99, 102, 241, 0.3);
  }

  .custom-bar-left {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    min-width: 0;
    flex: 1;
  }

  .custom-bar-icon {
    font-size: calc(14px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  /* Playlist dropdown */
  .playlist-select {
    max-width: calc(200px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    padding: 0 calc(8px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #a5b4fc;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    outline: none;
    flex-shrink: 0;
  }

  .playlist-select:focus {
    border-color: #6366f1;
  }

  .playlist-name-static {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #a5b4fc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }

  .custom-bar-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #6366f1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .custom-bar-actions {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .custom-bar-btn {
    height: calc(32px * var(--layout-scale, 1));
    padding: 0 calc(14px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .custom-bar-btn.view-btn {
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #a5b4fc;
  }

  .custom-bar-btn.view-btn:hover {
    background: rgba(99, 102, 241, 0.22);
    border-color: #6366f1;
  }

  .custom-bar-btn.start-btn {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border: none;
    color: #fff;
  }

  .custom-bar-btn.start-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #4338ca, #6d28d9);
  }

  .custom-bar-btn.start-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Custom playlist flyout ── */
  .custom-flyout {
    position: absolute;
    bottom: calc(56px * var(--layout-scale, 1));
    right: calc(20px * var(--layout-scale, 1));
    width: calc(320px * var(--layout-scale, 1));
    background: #0f172a;
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: calc(12px * var(--layout-scale, 1));
    box-shadow: 0 calc(8px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
    z-index: 210;
    overflow: hidden;
    max-height: calc(300px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
  }

  .flyout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .flyout-title {
    flex: 1;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #a5b4fc;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flyout-header-actions {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .flyout-clear,
  .flyout-delete {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #64748b;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: color 0.12s, background 0.12s;
    white-space: nowrap;
  }

  .flyout-clear:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border-color: rgba(248, 113, 113, 0.3);
  }

  .flyout-delete:hover {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
  }

  .flyout-items {
    overflow-y: auto;
    flex: 1;
  }

  .flyout-item {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .flyout-item:last-child {
    border-bottom: none;
  }

  .flyout-item-icon {
    font-size: calc(14px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .flyout-item-label {
    flex: 1;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flyout-item-remove {
    background: none;
    border: none;
    color: #475569;
    cursor: pointer;
    font-size: calc(11px * var(--text-scale, 1));
    padding: 0;
    flex-shrink: 0;
    transition: color 0.12s;
  }

  .flyout-item-remove:hover {
    color: #f87171;
  }
</style>
