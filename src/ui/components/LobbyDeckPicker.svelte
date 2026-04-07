<!-- LobbyDeckPicker.svelte
     Full-screen modal overlay for selecting multiplayer lobby content.
     Three tabs: Study Decks (curated), Trivia Mix (domain toggles), My Decks (custom).
     Props: onSelect callback + onClose callback. -->
<script lang="ts">
  import type { LobbyContentSelection } from '../../data/multiplayerTypes'
  import { getAllDecks, type DeckRegistryEntry } from '../../data/deckRegistry'
  import { getAllDomainMetadata, type DomainMetadata } from '../../data/domainMetadata'
  import { load } from '../../services/saveService'
  import type { CustomDeck } from '../../data/studyPreset'

  interface Props {
    onSelect: (selection: LobbyContentSelection) => void
    onClose: () => void
  }

  let { onSelect, onClose }: Props = $props()

  // ── State ──────────────────────────────────────────────────────────────────
  let activeTab = $state<'study' | 'trivia' | 'my_decks'>('study')
  let searchQuery = $state('')

  // Study tab
  let selectedDeckId = $state<string | null>(null)
  let selectedSubDeckId = $state<string | null>(null)

  // Trivia tab
  let selectedDomains = $state<string[]>([])

  // My Decks tab
  let selectedCustomDeckId = $state<string | null>(null)

  // ── Derived data ───────────────────────────────────────────────────────────
  let allDecks = $derived(getAllDecks().filter(d => d.status === 'available'))

  let filteredDecks = $derived(
    searchQuery
      ? allDecks.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : allDecks
  )

  let domains = $derived(getAllDomainMetadata().filter(d => !d.comingSoon))

  let customDecks = $derived<CustomDeck[]>(load()?.lastDungeonSelection?.customDecks ?? [])

  let selectedDeck = $derived(
    selectedDeckId ? allDecks.find(d => d.id === selectedDeckId) ?? null : null
  )

  let canConfirm = $derived(
    (activeTab === 'study' && selectedDeckId !== null) ||
    (activeTab === 'trivia' && selectedDomains.length > 0) ||
    (activeTab === 'my_decks' && selectedCustomDeckId !== null)
  )

  let selectionSummary = $derived.by<string>(() => {
    if (activeTab === 'study') {
      return selectedDeck ? `Selected: ${selectedDeck.name}` : 'No deck selected'
    } else if (activeTab === 'trivia') {
      return selectedDomains.length > 0
        ? `${selectedDomains.length} domain${selectedDomains.length === 1 ? '' : 's'} selected`
        : 'No domains selected'
    } else {
      const deck = customDecks.find(d => d.id === selectedCustomDeckId)
      return deck ? `Selected: ${deck.name}` : 'No deck selected'
    }
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose()
  }

  function selectStudyDeck(deckId: string): void {
    if (selectedDeckId === deckId) {
      selectedDeckId = null
      selectedSubDeckId = null
    } else {
      selectedDeckId = deckId
      selectedSubDeckId = null
    }
  }

  function toggleDomain(domainId: string): void {
    if (selectedDomains.includes(domainId)) {
      selectedDomains = selectedDomains.filter(d => d !== domainId)
    } else {
      selectedDomains = [...selectedDomains, domainId]
    }
  }

  function handleConfirm(): void {
    if (!canConfirm) return

    if (activeTab === 'study' && selectedDeckId && selectedDeck) {
      onSelect({
        type: 'study',
        deckId: selectedDeckId,
        subDeckId: selectedSubDeckId ?? undefined,
        deckName: selectedDeck.name,
      })
    } else if (activeTab === 'trivia' && selectedDomains.length > 0) {
      onSelect({ type: 'trivia', domains: selectedDomains })
    } else if (activeTab === 'my_decks' && selectedCustomDeckId) {
      const deck = customDecks.find(d => d.id === selectedCustomDeckId)
      if (deck) {
        onSelect({
          type: 'custom_deck',
          customDeckId: selectedCustomDeckId,
          deckName: deck.name,
        })
      }
    }
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
      <button
        class="ldp-close-btn"
        onclick={onClose}
        aria-label="Close content picker"
      >&#x2715;</button>
    </header>

    <!-- Tab bar -->
    <div class="ldp-tabs" role="tablist" aria-label="Content type">
      {#each (['study', 'trivia', 'my_decks'] as const) as tab}
        {@const labels = { study: 'Study Decks', trivia: 'Trivia Mix', my_decks: 'My Decks' }}
        <button
          class="ldp-tab"
          class:active={activeTab === tab}
          role="tab"
          aria-selected={activeTab === tab}
          onclick={() => { activeTab = tab }}
        >
          {labels[tab]}
        </button>
      {/each}
    </div>

    <!-- Content area -->
    <div class="ldp-content" aria-live="polite">

      <!-- Study Decks tab -->
      {#if activeTab === 'study'}
        <div class="ldp-study">
          <!-- Search -->
          <div class="ldp-search-wrap">
            <input
              class="ldp-search"
              type="search"
              placeholder="Search decks..."
              bind:value={searchQuery}
              aria-label="Search study decks"
            />
          </div>

          <!-- Deck grid -->
          {#if filteredDecks.length === 0}
            <p class="ldp-empty">No decks match your search.</p>
          {:else}
            <div class="ldp-deck-grid" role="listbox" aria-label="Study decks">
              {#each filteredDecks as deck (deck.id)}
                {@const isSelected = selectedDeckId === deck.id}
                <button
                  class="ldp-deck-card"
                  class:selected={isSelected}
                  role="option"
                  aria-selected={isSelected}
                  onclick={() => selectStudyDeck(deck.id)}
                  aria-label="{deck.name}, {deck.factCount} facts"
                >
                  <div
                    class="ldp-deck-color-bar"
                    style="background: linear-gradient(90deg, {deck.artPlaceholder.gradientFrom}, {deck.artPlaceholder.gradientTo})"
                  ></div>
                  <div class="ldp-deck-body">
                    <span class="ldp-deck-name">{deck.name}</span>
                    <span class="ldp-deck-count">{deck.factCount} facts</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}

          <!-- Sub-deck selector -->
          {#if selectedDeck && selectedDeck.subDecks && selectedDeck.subDecks.length > 0}
            <div class="ldp-subdecks" aria-label="Sub-deck selection">
              <h3 class="ldp-subdecks-label">Sub-deck (optional)</h3>
              <div class="ldp-subdeck-list" role="listbox" aria-label="Sub-decks">
                <button
                  class="ldp-subdeck-item"
                  class:selected={selectedSubDeckId === null}
                  role="option"
                  aria-selected={selectedSubDeckId === null}
                  onclick={() => { selectedSubDeckId = null }}
                >
                  All ({selectedDeck.factCount} facts)
                </button>
                {#each selectedDeck.subDecks as sub (sub.id)}
                  <button
                    class="ldp-subdeck-item"
                    class:selected={selectedSubDeckId === sub.id}
                    role="option"
                    aria-selected={selectedSubDeckId === sub.id}
                    onclick={() => { selectedSubDeckId = sub.id }}
                  >
                    {sub.name} ({sub.factCount} facts)
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

      <!-- Trivia Mix tab -->
      {:else if activeTab === 'trivia'}
        <div class="ldp-trivia">
          <p class="ldp-trivia-hint">Select one or more knowledge domains for the Trivia Mix.</p>
          <div class="ldp-domain-grid" role="listbox" aria-label="Trivia domains" aria-multiselectable="true">
            {#each domains as domain (domain.id)}
              {@const isSelected = selectedDomains.includes(domain.id)}
              <button
                class="ldp-domain-card"
                class:selected={isSelected}
                role="option"
                aria-selected={isSelected}
                onclick={() => toggleDomain(domain.id)}
                aria-label="{domain.displayName}{isSelected ? ', selected' : ''}"
                style="--domain-tint: {domain.colorTint}"
              >
                <span class="ldp-domain-icon" aria-hidden="true">{domain.icon}</span>
                <span class="ldp-domain-name">{domain.shortName}</span>
              </button>
            {/each}
          </div>
          {#if selectedDomains.length > 0}
            <p class="ldp-domain-count" aria-live="polite">
              {selectedDomains.length} domain{selectedDomains.length === 1 ? '' : 's'} selected
            </p>
          {/if}
        </div>

      <!-- My Decks tab -->
      {:else}
        <div class="ldp-mydecks">
          {#if customDecks.length === 0}
            <p class="ldp-empty ldp-mydecks-empty">
              No custom decks yet.<br />
              Create one in <strong>Study Temple</strong>.
            </p>
          {:else}
            <ul class="ldp-custom-list" role="listbox" aria-label="Custom decks">
              {#each customDecks as deck (deck.id)}
                {@const isSelected = selectedCustomDeckId === deck.id}
                <li>
                  <button
                    class="ldp-custom-item"
                    class:selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                    onclick={() => {
                      selectedCustomDeckId = isSelected ? null : deck.id
                    }}
                    aria-label="{deck.name}, {deck.items.length} items"
                  >
                    <div class="ldp-custom-info">
                      <span class="ldp-custom-name">{deck.name}</span>
                      <span class="ldp-custom-meta">
                        {deck.items.length} item{deck.items.length === 1 ? '' : 's'}
                        &middot;
                        {new Date(deck.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {#if isSelected}
                      <span class="ldp-custom-check" aria-hidden="true">&#x2713;</span>
                    {/if}
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
      <span class="ldp-summary" aria-live="polite">{selectionSummary}</span>
      <div class="ldp-footer-actions">
        <button class="ldp-cancel-btn" onclick={onClose}>Cancel</button>
        <button
          class="ldp-confirm-btn"
          disabled={!canConfirm}
          onclick={handleConfirm}
          aria-label="Confirm content selection"
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
    width: min(calc(1000px * var(--layout-scale, 1)), 94vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 calc(24px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
  }

  /* ── Header ── */
  .ldp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(18px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .ldp-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(22px * var(--text-scale, 1));
    color: #FFD700;
    margin: 0;
    letter-spacing: calc(1.5px * var(--layout-scale, 1));
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
    transition: background 0.15s, color 0.15s;
  }

  .ldp-close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  /* ── Tabs ── */
  .ldp-tabs {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .ldp-tab {
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(20px * var(--layout-scale, 1));
    color: #a0a0a0;
    font-size: calc(13px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .ldp-tab:hover {
    background: rgba(255, 215, 0, 0.08);
    color: #e0e0e0;
    border-color: #4A4E58;
  }

  .ldp-tab.active {
    background: rgba(255, 215, 0, 0.15);
    border-color: #FFD700;
    color: #FFD700;
    font-weight: 600;
  }

  /* ── Content area ── */
  .ldp-content {
    flex: 1;
    overflow-y: auto;
    padding: calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    min-height: 0;
  }

  .ldp-content::-webkit-scrollbar {
    width: calc(6px * var(--layout-scale, 1));
  }

  .ldp-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
  }

  .ldp-content::-webkit-scrollbar-thumb {
    background: #3A3E48;
    border-radius: calc(3px * var(--layout-scale, 1));
  }

  /* ── Empty state ── */
  .ldp-empty {
    color: #707080;
    text-align: center;
    padding: calc(40px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    line-height: 1.6;
  }

  .ldp-mydecks-empty strong {
    color: #a0a0b0;
  }

  /* ── Study tab ── */
  .ldp-search-wrap {
    margin-bottom: calc(14px * var(--layout-scale, 1));
  }

  .ldp-search {
    width: 100%;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #2A2E38;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(14px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  .ldp-search:focus {
    outline: none;
    border-color: #FFD700;
  }

  .ldp-search::placeholder {
    color: #505060;
  }

  /* ── Deck grid ── */
  .ldp-deck-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: calc(10px * var(--layout-scale, 1));
  }

  .ldp-deck-card {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .ldp-deck-card:hover {
    border-color: #4A4E58;
    background: rgba(255, 255, 255, 0.07);
  }

  .ldp-deck-card.selected {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.07);
    box-shadow: 0 0 0 calc(1px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.25);
  }

  .ldp-deck-color-bar {
    height: calc(4px * var(--layout-scale, 1));
    width: 100%;
    flex-shrink: 0;
  }

  .ldp-deck-body {
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .ldp-deck-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
    line-height: 1.3;
  }

  .ldp-deck-card.selected .ldp-deck-name {
    color: #FFD700;
  }

  .ldp-deck-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #606070;
  }

  /* ── Sub-deck selector ── */
  .ldp-subdecks {
    margin-top: calc(16px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
  }

  .ldp-subdecks-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8080a0;
    margin: 0 0 calc(10px * var(--layout-scale, 1)) 0;
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    font-weight: 600;
  }

  .ldp-subdeck-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .ldp-subdeck-item {
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #2A2E38;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #a0a0b0;
    font-size: calc(12px * var(--text-scale, 1));
    font-family: var(--font-body, 'Lora', serif);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .ldp-subdeck-item:hover {
    border-color: #4A4E58;
    color: #e0e0e0;
  }

  .ldp-subdeck-item.selected {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.1);
    color: #FFD700;
  }

  /* ── Trivia tab ── */
  .ldp-trivia-hint {
    font-size: calc(13px * var(--text-scale, 1));
    color: #707080;
    margin: 0 0 calc(14px * var(--layout-scale, 1)) 0;
  }

  .ldp-domain-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: calc(10px * var(--layout-scale, 1));
  }

  .ldp-domain-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    min-height: calc(80px * var(--layout-scale, 1));
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
    font-size: calc(12px * var(--text-scale, 1));
    color: #c0c0c0;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
  }

  .ldp-domain-card.selected .ldp-domain-name {
    color: #fff;
  }

  .ldp-domain-count {
    margin-top: calc(14px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: #FFD700;
    text-align: right;
  }

  /* ── My Decks tab ── */
  .ldp-custom-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .ldp-custom-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    min-height: calc(60px * var(--layout-scale, 1));
  }

  .ldp-custom-item:hover {
    border-color: #4A4E58;
    background: rgba(255, 255, 255, 0.07);
  }

  .ldp-custom-item.selected {
    border-color: #FFD700;
    background: rgba(255, 215, 0, 0.07);
    box-shadow: 0 0 0 calc(1px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.25);
  }

  .ldp-custom-info {
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .ldp-custom-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
  }

  .ldp-custom-item.selected .ldp-custom-name {
    color: #FFD700;
  }

  .ldp-custom-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #606070;
  }

  .ldp-custom-check {
    font-size: calc(18px * var(--text-scale, 1));
    color: #FFD700;
    flex-shrink: 0;
  }

  /* ── Footer ── */
  .ldp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    border-top: 1px solid #2A2E38;
    flex-shrink: 0;
    gap: calc(12px * var(--layout-scale, 1));
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
    transition: background 0.15s, color 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
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
    transition: background 0.15s, opacity 0.15s;
    min-height: calc(44px * var(--layout-scale, 1));
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
