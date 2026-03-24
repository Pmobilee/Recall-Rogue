<script lang="ts">
  import { onMount } from 'svelte';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getKnowledgeDomains } from '../../data/domainMetadata';
  import { getAllDecks } from '../../data/deckRegistry';
  import ModeToggle from './ModeToggle.svelte';
  import DomainSidebar from './DomainSidebar.svelte';
  import TriviaContentArea from './TriviaContentArea.svelte';
  import StudyContentArea from './StudyContentArea.svelte';

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

  // ── Custom playlist item type ──────────────────────────────────────────────

  type CustomItem =
    | { type: 'trivia'; domain: string; subdomain?: string; label: string }
    | { type: 'study'; deckId: string; subDeckId?: string; label: string };

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

  // Custom playlist (cross-mode persistent)
  /** Items the user has added to the custom playlist. */
  let customItems = $state<CustomItem[]>([]);

  /** Whether the custom playlist flyout is open. */
  let customFlyoutOpen = $state(false);

  // ── Derived: custom playlist fact count estimate ───────────────────────────

  const customEstimatedFacts = $derived.by<number>(() => {
    let total = 0;
    const decks = getAllDecks();
    for (const item of customItems) {
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
      // trivia fact counts are harder to estimate without subcategory data; skip for now
    }
    return total;
  });

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
          customItems: customItems.length > 0 ? customItems : undefined,
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
    if (last.customItems) {
      customItems = last.customItems;
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

  // ── Derived ────────────────────────────────────────────────────────────────

  /** Whether the header "Start Run" button should be enabled. */
  const canStartTrivia = $derived(mode === 'trivia' && triviaSelectedDomains.length > 0);

  /** Whether the header start button is visible (trivia mode only). */
  const showHeaderStart = $derived(mode === 'trivia');

  /** Whether the header start button is enabled. */
  const headerStartEnabled = $derived(canStartTrivia);

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

  /** Add a study deck/sub-deck to the custom playlist. */
  function handleAddStudyToCustom(deckId: string, subDeckId?: string): void {
    // Don't add duplicates
    const exists = customItems.some(
      (it) => it.type === 'study' && it.deckId === deckId && it.subDeckId === subDeckId,
    );
    if (exists) return;
    const decks = getAllDecks();
    const deck = decks.find((d) => d.id === deckId);
    let label = deck?.name ?? deckId;
    if (subDeckId) {
      const sub = deck?.subDecks?.find((s) => s.id === subDeckId);
      label = sub?.name ?? subDeckId;
    }
    customItems = [...customItems, { type: 'study', deckId, subDeckId, label }];
    persistSelection();
    playCardAudio('toggle-on');
  }

  /** Remove an item from the custom playlist by index. */
  function handleRemoveCustomItem(index: number): void {
    customItems = customItems.filter((_, i) => i !== index);
    persistSelection();
  }

  /** Clear all custom playlist items with audio. */
  function handleClearCustom(): void {
    playCardAudio('notification-ping');
    customItems = [];
    customFlyoutOpen = false;
    persistSelection();
  }

  /** Remove a custom playlist item with audio. */
  function handleRemoveCustomItemWithAudio(index: number): void {
    playCardAudio('notification-ping');
    handleRemoveCustomItem(index);
  }

  /** Toggle custom playlist flyout with audio. */
  function handleToggleCustomFlyout(): void {
    playCardAudio('tab-switch');
    customFlyoutOpen = !customFlyoutOpen;
  }

  /** Start a run from the custom playlist. */
  function handleStartCustomRun(): void {
    if (customItems.length === 0) return;
    // For now, use the first study deck item as the run's deck.
    // Future: support mixed trivia+study custom runs.
    const firstStudy = customItems.find((it): it is Extract<CustomItem, { type: 'study' }> => it.type === 'study');
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

  <!-- ── Custom playlist bar (shown when items exist) ── -->
  {#if customItems.length > 0}
    <div class="custom-bar">
      <span class="custom-bar-label">
        Custom Deck: <strong>{customItems.length}</strong> item{customItems.length !== 1 ? 's' : ''}
        {#if customEstimatedFacts > 0}
          <span class="custom-bar-facts">({customEstimatedFacts.toLocaleString()} facts)</span>
        {/if}
      </span>
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
          aria-label="Start custom run"
        >
          ▶ Start
        </button>
      </div>
    </div>

    <!-- Custom playlist flyout -->
    {#if customFlyoutOpen}
      <div class="custom-flyout" role="dialog" aria-label="Custom playlist">
        <div class="flyout-header">
          <span class="flyout-title">Custom Playlist</span>
          <button class="flyout-clear" onclick={handleClearCustom}>Clear All</button>
        </div>
        <div class="flyout-items">
          {#each customItems as item, i (i)}
            <div class="flyout-item">
              <span class="flyout-item-icon">{item.type === 'trivia' ? '⚔️' : '📚'}</span>
              <span class="flyout-item-label">{item.label}</span>
              <button
                class="flyout-item-remove"
                onclick={() => handleRemoveCustomItemWithAudio(i)}
                aria-label="Remove {item.label}"
              >✕</button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

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

  .custom-bar-label {
    font-size: calc(13px * var(--text-scale, 1));
    color: #a5b4fc;
    font-weight: 500;
  }

  .custom-bar-facts {
    font-size: calc(12px * var(--text-scale, 1));
    color: #6366f1;
    font-weight: 400;
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

  .custom-bar-btn.start-btn:hover {
    background: linear-gradient(135deg, #4338ca, #6d28d9);
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
  }

  .flyout-title {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #a5b4fc;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .flyout-clear {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #64748b;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: color 0.12s, background 0.12s;
  }

  .flyout-clear:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border-color: rgba(248, 113, 113, 0.3);
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
