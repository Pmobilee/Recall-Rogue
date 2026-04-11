<!-- LobbyDeckPicker.svelte
     Full-screen modal overlay for selecting multiplayer lobby content.
     Redesign Issue 2 (2026-04-11): domain-grouped tabs, multi-select study decks +
     subdecks, domain picker for Trivia Mix, My Decks tab.
     Selection persists across tab switches via Map/Set state. -->
<script lang="ts">
  import type { LobbyContentSelection } from '../../data/multiplayerTypes'
  import { getAllDecks, getDecksForDomain, type DeckRegistryEntry } from '../../data/deckRegistry'
  import { getAllDomainMetadata } from '../../data/domainMetadata'
  import { load } from '../../services/saveService'
  import type { CustomDeck } from '../../data/studyPreset'
  import {
    toggleWholeDeck,
    toggleSubDeck,
    deckCheckState,
    isSubDeckSelected,
    buildStudyMultiSelection,
    pickerSummary,
    type DeckSelectionMap,
  } from '../utils/lobbyDeckSelection'

  interface Props {
    onSelect: (selection: LobbyContentSelection) => void
    onClose: () => void
  }

  let { onSelect, onClose }: Props = $props()

  // ── Derived data ───────────────────────────────────────────────────────────

  /**
   * All available decks, filtered to 'available' status only.
   * This is called once — deckRegistry is stable after load.
   */
  let allDecks = $derived(getAllDecks().filter(d => d.status === 'available'))

  /**
   * Study tabs: unique domains derived from available decks, sorted alphabetically.
   * Static suffix tabs 'trivia' and 'my_decks' are appended in the template.
   */
  let studyDomains = $derived(
    [...new Set(allDecks.map(d => d.domain))].sort() as Array<DeckRegistryEntry['domain']>
  )

  /** Trivia domain metadata, excluding coming-soon entries. */
  let triviaMetadata = $derived(getAllDomainMetadata().filter(d => !d.comingSoon))

  /** Custom decks from player save. */
  let customDecks = $derived<CustomDeck[]>(load()?.lastDungeonSelection?.customDecks ?? [])

  // ── Tab state ──────────────────────────────────────────────────────────────

  /**
   * Active tab: one of the study domain strings, or 'trivia', or 'my_decks'.
   * Initialized to the first study domain (or 'trivia' if no study decks loaded).
   * NOTE: this is a string, not a union enum, because domains are runtime values.
   */
  let activeTab = $state<string>('_init')
  let activeTabResolved = $derived(
    activeTab === '_init' ? (studyDomains[0] ?? 'trivia') : activeTab
  )

  // ── Selection state — persists across tab switches ─────────────────────────

  /**
   * Multi-deck selection: Map<deckId, Set<subDeckId> | 'all'>
   * CRITICAL: All mutations MUST reassign (new Map) to trigger Svelte 5 reactivity.
   */
  let selectedDecks = $state<DeckSelectionMap>(new Map())

  /**
   * Selected trivia domains — Set<domainId>.
   * CRITICAL: All mutations MUST reassign (new Set) for reactivity.
   */
  let selectedDomains = $state<Set<string>>(new Set())

  /**
   * Selected custom deck IDs — Set<customDeckId>.
   */
  let selectedCustomDeckIds = $state<Set<string>>(new Set())

  // ── Derived can-confirm ────────────────────────────────────────────────────

  let canConfirm = $derived(
    selectedDecks.size > 0 ||
    selectedDomains.size > 0 ||
    selectedCustomDeckIds.size > 0
  )

  /** Footer summary line. */
  let summary = $derived(pickerSummary(selectedDecks, selectedDomains, selectedCustomDeckIds))

  // ── Expanded decks (which deck's subdeck list is open) ─────────────────────

  let expandedDeckId = $state<string | null>(null)

  // ── Domain label map ───────────────────────────────────────────────────────

  /** Human-readable label for each study domain tab. */
  const DOMAIN_LABELS: Record<string, string> = {
    vocabulary: 'Vocabulary',
    geography: 'Geography',
    geography_drill: 'Caps & Flags',
    history: 'History',
    natural_sciences: 'Science',
    space_astronomy: 'Space',
    mathematics: 'Math',
    mythology_folklore: 'Mythology',
    animals_wildlife: 'Animals',
    human_body_health: 'Health',
    food_cuisine: 'Food',
    art_architecture: 'Arts',
    social_sciences: 'Social',
    sports_entertainment: 'Sports',
    language: 'Language',
    general_knowledge: 'General',
  }

  function domainLabel(domain: string): string {
    return DOMAIN_LABELS[domain] ?? domain
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose()
  }

  /** Toggle whole-deck selection (selects all subdecks or deselects). */
  function handleWholeDeckToggle(deckId: string): void {
    selectedDecks = toggleWholeDeck(selectedDecks, deckId)
  }

  /** Toggle a single subdeck within a deck. */
  function handleSubDeckToggle(deckId: string, subDeckId: string, deck: DeckRegistryEntry): void {
    const allSubIds = (deck.subDecks ?? []).map(s => s.id)
    selectedDecks = toggleSubDeck(selectedDecks, deckId, subDeckId, allSubIds)
  }

  /** Toggle trivia domain selection. */
  function handleDomainToggle(domainId: string): void {
    const next = new Set(selectedDomains)
    if (next.has(domainId)) {
      next.delete(domainId)
    } else {
      next.add(domainId)
    }
    selectedDomains = next
  }

  /** Toggle a custom deck selection. */
  function handleCustomDeckToggle(deckId: string): void {
    const next = new Set(selectedCustomDeckIds)
    if (next.has(deckId)) {
      next.delete(deckId)
    } else {
      next.add(deckId)
    }
    selectedCustomDeckIds = next
  }

  /** Expand or collapse a deck's subdecks. */
  function toggleExpand(deckId: string): void {
    expandedDeckId = expandedDeckId === deckId ? null : deckId
  }

  function handleConfirm(): void {
    if (!canConfirm) return

    // If only custom decks are selected (and no study/trivia), emit a legacy custom_deck
    // for backward compat. Otherwise always emit study-multi.
    if (selectedCustomDeckIds.size === 1 && selectedDecks.size === 0 && selectedDomains.size === 0) {
      const id = Array.from(selectedCustomDeckIds)[0]
      const deck = customDecks.find(d => d.id === id)
      if (deck) {
        onSelect({ type: 'custom_deck', customDeckId: id, deckName: deck.name })
        return
      }
    }

    // study-multi covers everything else (decks + domains + mixed)
    const selection = buildStudyMultiSelection(selectedDecks, selectedDomains, allDecks)
    onSelect(selection)
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="ldp-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Choose Content"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
>
  <!-- Modal -->
  <div class="ldp-modal" role="document">

    <!-- Header -->
    <header class="ldp-header">
      <h2 class="ldp-title">Choose Content</h2>
      <span class="ldp-subtitle">Multi-select — combine decks and trivia domains</span>
      <button
        class="ldp-close-btn"
        onclick={onClose}
        aria-label="Close content picker"
      >&#x2715;</button>
    </header>

    <!-- Tab bar -->
    <div class="ldp-tabs" role="tablist" aria-label="Content type">
      {#each studyDomains as domain (domain)}
        <button
          class="ldp-tab"
          class:active={activeTabResolved === domain}
          role="tab"
          aria-selected={activeTabResolved === domain}
          onclick={() => { activeTab = domain }}
        >
          {domainLabel(domain)}
          {#if [...selectedDecks.keys()].some(id => allDecks.find(d => d.id === id)?.domain === domain)}
            <span class="ldp-tab-dot" aria-hidden="true"></span>
          {/if}
        </button>
      {/each}
      <button
        class="ldp-tab"
        class:active={activeTabResolved === 'trivia'}
        role="tab"
        aria-selected={activeTabResolved === 'trivia'}
        onclick={() => { activeTab = 'trivia' }}
      >
        Trivia Mix
        {#if selectedDomains.size > 0}
          <span class="ldp-tab-dot" aria-hidden="true"></span>
        {/if}
      </button>
      <button
        class="ldp-tab"
        class:active={activeTabResolved === 'my_decks'}
        role="tab"
        aria-selected={activeTabResolved === 'my_decks'}
        onclick={() => { activeTab = 'my_decks' }}
      >
        My Decks
        {#if selectedCustomDeckIds.size > 0}
          <span class="ldp-tab-dot" aria-hidden="true"></span>
        {/if}
      </button>
    </div>

    <!-- Content area -->
    <div class="ldp-content" aria-live="polite">

      <!-- ── Study domain tab ── -->
      {#if studyDomains.includes(activeTabResolved as DeckRegistryEntry['domain'])}
        {@const domainDecks = allDecks.filter(d => d.domain === activeTabResolved)}
        <div class="ldp-study">
          {#if domainDecks.length === 0}
            <p class="ldp-empty">No decks available in this category.</p>
          {:else}
            <div class="ldp-deck-list" role="listbox" aria-label="Study decks" aria-multiselectable="true">
              {#each domainDecks as deck (deck.id)}
                {@const checkState = deckCheckState(selectedDecks, deck.id)}
                {@const isExpanded = expandedDeckId === deck.id}
                {@const hasSubDecks = deck.subDecks && deck.subDecks.length > 0}
                <div
                  class="ldp-deck-item"
                  class:selected={checkState !== 'none'}
                  role="option"
                  aria-selected={checkState !== 'none'}
                >
                  <!-- Deck row -->
                  <div class="ldp-deck-row">
                    <!-- Checkbox area — selects whole deck -->
                    <button
                      class="ldp-deck-check-btn"
                      class:checked={checkState === 'all'}
                      class:indeterminate={checkState === 'partial'}
                      onclick={() => handleWholeDeckToggle(deck.id)}
                      aria-label="{deck.name} — select whole deck"
                      aria-pressed={checkState !== 'none'}
                      title={checkState === 'all' ? 'Deselect deck' : 'Select whole deck'}
                    >
                      <span class="ldp-check-box" aria-hidden="true">
                        {#if checkState === 'all'}
                          &#x2713;
                        {:else if checkState === 'partial'}
                          &minus;
                        {/if}
                      </span>
                    </button>

                    <!-- Deck name + info -->
                    <div class="ldp-deck-info">
                      <div
                        class="ldp-deck-color-bar"
                        style="background: linear-gradient(90deg, {deck.artPlaceholder.gradientFrom}, {deck.artPlaceholder.gradientTo})"
                      ></div>
                      <span class="ldp-deck-name">{deck.name}</span>
                      <span class="ldp-deck-count">{deck.factCount} facts</span>
                    </div>

                    <!-- Expand button (only if subdecks exist) -->
                    {#if hasSubDecks}
                      <button
                        class="ldp-expand-btn"
                        class:expanded={isExpanded}
                        onclick={() => toggleExpand(deck.id)}
                        aria-label="{isExpanded ? 'Collapse' : 'Expand'} sub-decks for {deck.name}"
                        aria-expanded={isExpanded}
                      >
                        <span aria-hidden="true">{isExpanded ? '&#x25B2;' : '&#x25BC;'}</span>
                      </button>
                    {/if}
                  </div>

                  <!-- Sub-deck list (expanded) -->
                  {#if hasSubDecks && isExpanded}
                    <div class="ldp-subdeck-list" role="group" aria-label="Sub-decks for {deck.name}">
                      {#each deck.subDecks! as sub (sub.id)}
                        {@const subSelected = isSubDeckSelected(selectedDecks, deck.id, sub.id)}
                        <button
                          class="ldp-subdeck-item"
                          class:selected={subSelected}
                          onclick={() => handleSubDeckToggle(deck.id, sub.id, deck)}
                          aria-label="{sub.name}, {sub.factCount} facts{subSelected ? ', selected' : ''}"
                          aria-pressed={subSelected}
                        >
                          <span class="ldp-subdeck-check" aria-hidden="true">
                            {#if subSelected}&#x2713;{/if}
                          </span>
                          <span class="ldp-subdeck-name">{sub.name}</span>
                          <span class="ldp-subdeck-count">{sub.factCount} facts</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ── Trivia Mix tab ── -->
      {:else if activeTabResolved === 'trivia'}
        <div class="ldp-trivia">
          <p class="ldp-trivia-hint">
            Pick knowledge domains for the Trivia Mix. You can combine these with study decks.
          </p>
          <div class="ldp-domain-grid" role="listbox" aria-label="Trivia domains" aria-multiselectable="true">
            {#each triviaMetadata as domain (domain.id)}
              {@const isSelected = selectedDomains.has(domain.id)}
              <button
                class="ldp-domain-card"
                class:selected={isSelected}
                role="option"
                aria-selected={isSelected}
                onclick={() => handleDomainToggle(domain.id)}
                aria-label="{domain.displayName}{isSelected ? ', selected' : ''}"
                style="--domain-tint: {domain.colorTint}"
              >
                <span class="ldp-domain-icon" aria-hidden="true">{domain.icon}</span>
                <span class="ldp-domain-name">{domain.shortName}</span>
                {#if isSelected}
                  <span class="ldp-domain-check" aria-hidden="true">&#x2713;</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

      <!-- ── My Decks tab ── -->
      {:else if activeTabResolved === 'my_decks'}
        <div class="ldp-mydecks">
          <p class="ldp-mydecks-hint">
            Custom and Anki-imported decks. Create them in <strong>Study Temple</strong>.
          </p>
          {#if customDecks.length === 0}
            <div class="ldp-empty-state" data-testid="ldp-empty-custom">
              <p class="ldp-empty">
                No custom decks yet.<br />
                Create one in <strong>Study Temple</strong> from the hub.
              </p>
              <button class="ldp-back-btn" onclick={onClose}>Back to Hub</button>
            </div>
          {:else}
            <ul class="ldp-custom-list" role="listbox" aria-label="Custom decks" aria-multiselectable="true">
              {#each customDecks as deck (deck.id)}
                {@const isSelected = selectedCustomDeckIds.has(deck.id)}
                <li>
                  <button
                    class="ldp-custom-item"
                    class:selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onclick={() => handleCustomDeckToggle(deck.id)}
                    aria-label="{deck.name}, {deck.items.length} items{isSelected ? ', selected' : ''}"
                  >
                    <span class="ldp-custom-check" aria-hidden="true">
                      {#if isSelected}&#x2713;{/if}
                    </span>
                    <div class="ldp-custom-info">
                      <span class="ldp-custom-name">{deck.name}</span>
                      <span class="ldp-custom-meta">
                        {deck.items.length} item{deck.items.length === 1 ? '' : 's'}
                        &middot;
                        {new Date(deck.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}

    </div>

    <!-- Footer -->
    <footer class="ldp-footer">
      <span class="ldp-summary" aria-live="polite">{summary}</span>
      <div class="ldp-footer-actions">
        <button class="ldp-cancel-btn" onclick={onClose}>Cancel</button>
        <button
          class="ldp-confirm-btn"
          disabled={!canConfirm}
          onclick={handleConfirm}
          aria-label="Confirm content selection"
          data-testid="ldp-confirm-btn"
        >
          Confirm
        </button>
      </div>
    </footer>

  </div>
</div>

<style>
  /* ── Backdrop ── */
  .ldp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Modal ── */
  .ldp-modal {
    background: #12151E;
    border: 1px solid #2A2E38;
    border-radius: calc(16px * var(--layout-scale, 1));
    width: min(calc(1080px * var(--layout-scale, 1)), 96vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 calc(24px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
  }

  /* ── Header ── */
  .ldp-header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .ldp-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(20px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .ldp-subtitle {
    font-size: calc(12px * var(--text-scale, 1));
    color: #606070;
    flex: 1;
    min-width: 0;
  }

  .ldp-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #c0c0c0;
    font-size: calc(16px * var(--text-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }

  .ldp-close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  /* ── Tabs ── */
  .ldp-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  .ldp-tab {
    position: relative;
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(18px * var(--layout-scale, 1));
    color: #909090;
    font-size: calc(12px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    min-height: calc(36px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  .ldp-tab:hover {
    background: rgba(255, 215, 0, 0.08);
    color: #d0d0d0;
    border-color: #3A3E48;
  }

  .ldp-tab.active {
    background: rgba(255, 215, 0, 0.15);
    border-color: #FFD700;
    color: #FFD700;
    font-weight: 600;
  }

  /* Selection indicator dot on tab */
  .ldp-tab-dot {
    position: absolute;
    top: calc(4px * var(--layout-scale, 1));
    right: calc(4px * var(--layout-scale, 1));
    width: calc(6px * var(--layout-scale, 1));
    height: calc(6px * var(--layout-scale, 1));
    background: #FFD700;
    border-radius: 50%;
    display: block;
  }

  /* ── Content area ── */
  .ldp-content {
    flex: 1;
    overflow-y: auto;
    padding: calc(16px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    min-height: 0;
  }

  .ldp-content::-webkit-scrollbar {
    width: calc(6px * var(--layout-scale, 1));
  }

  .ldp-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
  }

  .ldp-content::-webkit-scrollbar-thumb {
    background: #3A3E48;
    border-radius: calc(3px * var(--layout-scale, 1));
  }

  /* ── Empty state ── */
  .ldp-empty {
    color: #707080;
    text-align: center;
    padding: calc(32px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    line-height: 1.6;
  }

  .ldp-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .ldp-back-btn {
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid #3A3E48;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #a0a0b0;
    font-size: calc(13px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s, color 0.15s;
  }

  .ldp-back-btn:hover {
    background: rgba(255, 255, 255, 0.13);
    color: #e0e0e0;
  }

  /* ── Study tab: deck list ── */
  .ldp-study {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .ldp-deck-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .ldp-deck-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .ldp-deck-item.selected {
    border-color: rgba(255, 215, 0, 0.4);
    background: rgba(255, 215, 0, 0.04);
  }

  /* Deck row: checkbox + info + expand */
  .ldp-deck-row {
    display: flex;
    align-items: stretch;
    min-height: calc(54px * var(--layout-scale, 1));
  }

  /* Whole-deck checkbox button */
  .ldp-deck-check-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(52px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: none;
    border-right: 1px solid #2A2E38;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .ldp-deck-check-btn:hover {
    background: rgba(255, 215, 0, 0.08);
  }

  .ldp-deck-check-btn.checked,
  .ldp-deck-check-btn.indeterminate {
    background: rgba(255, 215, 0, 0.12);
  }

  .ldp-check-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border: 1px solid #3A3E58;
    border-radius: calc(4px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: #FFD700;
    background: rgba(0, 0, 0, 0.3);
    transition: border-color 0.12s, background 0.12s;
  }

  .ldp-deck-check-btn.checked .ldp-check-box,
  .ldp-deck-check-btn.indeterminate .ldp-check-box {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.15);
  }

  /* Deck info (color bar + name + count) */
  .ldp-deck-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(2px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-width: 0;
  }

  .ldp-deck-color-bar {
    height: calc(3px * var(--layout-scale, 1));
    width: calc(32px * var(--layout-scale, 1));
    border-radius: calc(2px * var(--layout-scale, 1));
    flex-shrink: 0;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .ldp-deck-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ldp-deck-item.selected .ldp-deck-name {
    color: #FFD700;
  }

  .ldp-deck-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #505060;
  }

  /* Expand/collapse button */
  .ldp-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(44px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    border-left: 1px solid #2A2E38;
    color: #606070;
    font-size: calc(10px * var(--text-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.12s, background 0.12s;
  }

  .ldp-expand-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #a0a0b0;
  }

  .ldp-expand-btn.expanded {
    color: #FFD700;
  }

  /* ── Sub-deck list ── */
  .ldp-subdeck-list {
    display: flex;
    flex-direction: column;
    border-top: 1px solid #2A2E38;
    background: rgba(0, 0, 0, 0.15);
    padding: calc(4px * var(--layout-scale, 1)) 0;
  }

  .ldp-subdeck-item {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) calc(52px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.12s;
  }

  .ldp-subdeck-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .ldp-subdeck-item.selected {
    background: rgba(255, 215, 0, 0.06);
  }

  .ldp-subdeck-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    border: 1px solid #3A3E58;
    border-radius: calc(3px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #FFD700;
    flex-shrink: 0;
    transition: border-color 0.12s, background 0.12s;
  }

  .ldp-subdeck-item.selected .ldp-subdeck-check {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.15);
  }

  .ldp-subdeck-name {
    font-size: calc(13px * var(--text-scale, 1));
    color: #c0c0c0;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ldp-subdeck-item.selected .ldp-subdeck-name {
    color: #FFD700;
  }

  .ldp-subdeck-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #505060;
    flex-shrink: 0;
  }

  /* ── Trivia tab ── */
  .ldp-trivia-hint {
    font-size: calc(13px * var(--text-scale, 1));
    color: #707080;
    margin: 0 0 calc(14px * var(--layout-scale, 1)) 0;
    line-height: 1.5;
  }

  .ldp-domain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(110px * var(--layout-scale, 1)), 1fr));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .ldp-domain-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    min-height: calc(80px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }

  .ldp-domain-card:hover {
    border-color: color-mix(in srgb, var(--domain-tint) 60%, transparent);
    background: rgba(255, 255, 255, 0.07);
  }

  .ldp-domain-card.selected {
    border-color: var(--domain-tint);
    background: color-mix(in srgb, var(--domain-tint) 18%, transparent);
    box-shadow: 0 0 0 calc(1px * var(--layout-scale, 1)) color-mix(in srgb, var(--domain-tint) 40%, transparent);
  }

  .ldp-domain-icon {
    font-size: calc(22px * var(--text-scale, 1));
    line-height: 1;
  }

  .ldp-domain-name {
    font-size: calc(11px * var(--text-scale, 1));
    color: #c0c0c0;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
  }

  .ldp-domain-card.selected .ldp-domain-name {
    color: #fff;
  }

  .ldp-domain-check {
    position: absolute;
    top: calc(4px * var(--layout-scale, 1));
    right: calc(6px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #FFD700;
    font-weight: 700;
  }

  /* ── My Decks tab ── */
  .ldp-mydecks-hint {
    font-size: calc(13px * var(--text-scale, 1));
    color: #707080;
    margin: 0 0 calc(14px * var(--layout-scale, 1)) 0;
    line-height: 1.5;
  }

  .ldp-mydecks-hint strong {
    color: #a0a0b0;
  }

  .ldp-custom-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .ldp-custom-item {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-height: calc(60px * var(--layout-scale, 1));
    transition: border-color 0.15s, background 0.15s;
  }

  .ldp-custom-item:hover {
    border-color: #3A3E48;
    background: rgba(255, 255, 255, 0.07);
  }

  .ldp-custom-item.selected {
    border-color: rgba(255, 215, 0, 0.5);
    background: rgba(255, 215, 0, 0.06);
  }

  .ldp-custom-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border: 1px solid #3A3E58;
    border-radius: calc(4px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #FFD700;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.3);
    transition: border-color 0.12s, background 0.12s;
  }

  .ldp-custom-item.selected .ldp-custom-check {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.15);
  }

  .ldp-custom-info {
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
  }

  .ldp-custom-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ldp-custom-item.selected .ldp-custom-name {
    color: #FFD700;
  }

  .ldp-custom-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #606070;
  }

  /* ── Footer ── */
  .ldp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-top: 1px solid #2A2E38;
    flex-shrink: 0;
    gap: calc(12px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.15);
  }

  .ldp-summary {
    font-size: calc(13px * var(--text-scale, 1));
    color: #8080a0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ldp-footer-actions {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .ldp-cancel-btn {
    padding: calc(10px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #a0a0a0;
    font-size: calc(14px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s, color 0.15s;
  }

  .ldp-cancel-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #e0e0e0;
  }

  .ldp-confirm-btn {
    padding: calc(10px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    background: #FFD700;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #12151E;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    font-family: var(--font-rpg, 'Cinzel', serif);
    cursor: pointer;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s, opacity 0.15s;
  }

  .ldp-confirm-btn:hover:not(:disabled) {
    background: #ffe34d;
  }

  .ldp-confirm-btn:disabled {
    background: rgba(255, 215, 0, 0.25);
    color: rgba(18, 21, 30, 0.5);
    cursor: not-allowed;
  }
</style>
