<script lang="ts">
  /**
   * RunDeckOverlay.svelte
   *
   * Full-run deck viewer accessible from the top-bar deck icon on every run-active screen.
   * Shows all cards currently in the run across all four piles (hand / draw / discard / forget)
   * with their mastery level and pile tag. Read-only — no card selection.
   *
   * Clicking a card opens a mastery popup that shows per-level descriptions for L0–L5.
   *
   * Opened via `openRunDeckOverlay()` from runDeckOverlayStore.ts.
   * Rendered centrally in CardApp.svelte when IN_RUN_SCREENS is active.
   */
  import { closeRunDeckOverlay, runDeckOverlayInitialFilter } from '../stores/runDeckOverlayStore'
  import CardVisual from './CardVisual.svelte'
  import { activeTurnState } from '../../services/encounterBridge'
  import type { Card } from '../../data/card-types'
  import { getEffectiveApCost } from '../../services/cardUpgradeService'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import { getMasteryStats } from '../../services/cardUpgradeService'
  import { getMasteryIconFilter } from '../utils/cardFrameV2'

  // ============================================================
  // Card type color coding (matches CardBrowser palette)
  // ============================================================
  const TYPE_COLORS: Record<string, string> = {
    attack: '#e94560',
    shield: '#2e86de',
    buff: '#2ecc71',
    debuff: '#9b59b6',
    utility: '#f39c12',
    wild: '#e67e22',
  }

  const TYPE_ORDER: Record<string, number> = {
    attack: 0,
    shield: 1,
    buff: 2,
    debuff: 3,
    utility: 4,
    wild: 5,
  }

  // ============================================================
  // Pile label & color per pile
  // ============================================================
  type PileId = 'hand' | 'draw' | 'discard' | 'exhaust'

  const PILE_LABELS: Record<PileId, string> = {
    hand: 'Hand',
    draw: 'Draw',
    discard: 'Discard',
    exhaust: 'Forget',
  }

  const PILE_COLORS: Record<PileId, string> = {
    hand: '#fbbf24',
    draw: '#38bdf8',
    discard: '#94a3b8',
    exhaust: '#6b7280',
  }

  // ============================================================
  // Build sorted card list from activeTurnState deck
  // ============================================================
  interface PiledCard {
    card: Card
    pile: PileId
  }

  /** Merge all four piles into a labelled, sorted list. */
  const allCards = $derived((): PiledCard[] => {
    const ts = $activeTurnState
    if (!ts) return []

    const entries: PiledCard[] = [
      ...ts.deck.hand.map((c: Card) => ({ card: c, pile: 'hand' as PileId })),
      ...ts.deck.drawPile.map((c: Card) => ({ card: c, pile: 'draw' as PileId })),
      ...ts.deck.discardPile.map((c: Card) => ({ card: c, pile: 'discard' as PileId })),
      ...ts.deck.forgetPile.map((c: Card) => ({ card: c, pile: 'exhaust' as PileId })),
    ]

    // Sort by pile order, then card type, then name
    const PILE_ORDER: Record<PileId, number> = { hand: 0, draw: 1, discard: 2, exhaust: 3 }
    return entries.sort((a, b) => {
      const pileDiff = PILE_ORDER[a.pile] - PILE_ORDER[b.pile]
      if (pileDiff !== 0) return pileDiff
      const typeDiff = (TYPE_ORDER[a.card.cardType] ?? 99) - (TYPE_ORDER[b.card.cardType] ?? 99)
      if (typeDiff !== 0) return typeDiff
      return (a.card.mechanicName ?? a.card.factId ?? '').localeCompare(
        b.card.mechanicName ?? b.card.factId ?? '',
      )
    })
  })

  const totalCount = $derived(allCards().length)

  // Per-pile counts for the header row
  const pileCounts = $derived((): Record<PileId, number> => {
    const ts = $activeTurnState
    if (!ts) return { hand: 0, draw: 0, discard: 0, exhaust: 0 }
    return {
      hand: ts.deck.hand.length,
      draw: ts.deck.drawPile.length,
      discard: ts.deck.discardPile.length,
      exhaust: ts.deck.forgetPile.length,
    }
  })

  // ============================================================
  // Sort / filter state
  // ============================================================
  type SortKey = 'pile' | 'type' | 'name' | 'mastery'
  let sortKey = $state<SortKey>('pile')
  let filterPile = $state<PileId | 'all'>('all')

  // Apply initial filter when the overlay is opened pre-filtered (e.g. from forget pile indicator).
  $effect(() => {
    const initial = $runDeckOverlayInitialFilter
    if (initial === 'hand' || initial === 'draw' || initial === 'discard' || initial === 'exhaust') {
      filterPile = initial as PileId
    }
  })

  const sortedFilteredCards = $derived((): PiledCard[] => {
    let cards = allCards()
    if (filterPile !== 'all') {
      cards = cards.filter(pc => pc.pile === filterPile)
    }
    if (sortKey === 'pile') {
      // pile sort is already the default in allCards()
      return cards
    }
    if (sortKey === 'type') {
      return [...cards].sort((a, b) => {
        const typeDiff = (TYPE_ORDER[a.card.cardType] ?? 99) - (TYPE_ORDER[b.card.cardType] ?? 99)
        if (typeDiff !== 0) return typeDiff
        return (a.card.mechanicName ?? '').localeCompare(b.card.mechanicName ?? '')
      })
    }
    if (sortKey === 'name') {
      return [...cards].sort((a, b) =>
        (a.card.mechanicName ?? a.card.factId ?? '').localeCompare(
          b.card.mechanicName ?? b.card.factId ?? '',
        ),
      )
    }
    if (sortKey === 'mastery') {
      return [...cards].sort((a, b) => (b.card.masteryLevel ?? 0) - (a.card.masteryLevel ?? 0))
    }
    return cards
  })

  // ============================================================
  // Card visual sizing — ~220px base width, aspect 886:1142
  // ============================================================
  /** CSS card width used as grid column basis (unitless px for --card-w var). */
  const CARD_W_PX = 220

  // ============================================================
  // Mastery label (L0-L5)
  // ============================================================
  function masteryLabel(level: number | undefined): string {
    if (level == null || level < 0) return 'L0'
    return `L${Math.min(5, level)}`
  }

  /** Mastery color: grey L0-L2, amber L3-L4, gold L5 */
  function masteryColor(level: number | undefined): string {
    if (!level || level < 3) return '#94a3b8'
    if (level < 5) return '#fbbf24'
    return '#ffd700'
  }

  // ============================================================
  // Mastery popup state
  // ============================================================
  interface SelectedCardState {
    card: Card
    pile: PileId
  }

  let selectedCard = $state<SelectedCardState | null>(null)

  /**
   * Open the mastery popup centered in the viewport.
   */
  function openMasteryPopup(e: MouseEvent, card: Card, pile: PileId): void {
    selectedCard = { card, pile }
  }

  function closeMasteryPopup(): void {
    selectedCard = null
  }

  /**
   * Build a shallow clone of a card with masteryLevel overridden.
   * Used to generate per-level description previews.
   */
  function cardAtLevel(card: Card, level: number): Card {
    return { ...card, masteryLevel: level }
  }

  /**
   * Get the description parts for a card at a specific mastery level.
   * Builds a clone with the overridden mastery level so getCardDescriptionParts
   * reads the correct stat-table values.
   */
  function getDescPartsAtLevel(card: Card, level: number): CardDescPart[] {
    return getCardDescriptionParts(cardAtLevel(card, level))
  }

  // ============================================================
  // Keyboard handler — close on Escape
  // ============================================================
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (selectedCard) {
        closeMasteryPopup()
      } else {
        closeRunDeckOverlay()
      }
    }
  }

  // ============================================================
  // Backdrop click (dismiss on outside click)
  // ============================================================
  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeMasteryPopup()
      closeRunDeckOverlay()
    }
  }

  // ============================================================
  // Grid scroll — close popup when user scrolls (fixed coords drift)
  // ============================================================
  function handleGridScroll(): void {
    if (selectedCard) {
      closeMasteryPopup()
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="rdo-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-label="Run deck viewer"
  data-testid="run-deck-overlay"
  tabindex="-1"
>
  <div class="rdo-panel">
    <!-- Header -->
    <div class="rdo-header">
      <div class="rdo-title-row">
        <span class="rdo-title">{$runDeckOverlayInitialFilter === 'exhaust' ? 'Forgotten Cards' : 'Run Deck'}</span>
        <span class="rdo-total">({totalCount} cards)</span>
      </div>

      <!-- Pile summary chips -->
      <div class="rdo-pile-chips" role="list" aria-label="Cards per pile">
        {#each Object.entries(PILE_LABELS) as [pileId, label]}
          {@const count = pileCounts()[pileId as PileId]}
          <span
            class="rdo-chip"
            style="border-color: {PILE_COLORS[pileId as PileId]}; color: {PILE_COLORS[pileId as PileId]};"
            role="listitem"
            aria-label="{count} cards in {label}"
          >
            {label} {count}
          </span>
        {/each}
      </div>

      <button
        class="rdo-close-btn"
        onclick={closeRunDeckOverlay}
        aria-label="Close deck viewer"
        type="button"
      >
        ✕
      </button>
    </div>

    <!-- Sort / filter controls -->
    <div class="rdo-controls" role="toolbar" aria-label="Sort and filter deck">
      <div class="rdo-control-group">
        <span class="rdo-control-label">Filter:</span>
        <button class="rdo-filter-btn" class:rdo-filter-active={filterPile === 'all'} onclick={() => { filterPile = 'all' }} type="button">All</button>
        {#each Object.entries(PILE_LABELS) as [pileId, label]}
          <button
            class="rdo-filter-btn"
            class:rdo-filter-active={filterPile === pileId}
            style="--filter-color: {PILE_COLORS[pileId as PileId]};"
            onclick={() => { filterPile = pileId as PileId }}
            type="button"
          >{label}</button>
        {/each}
      </div>
      <div class="rdo-control-group">
        <span class="rdo-control-label">Sort:</span>
        <button class="rdo-sort-btn" class:rdo-sort-active={sortKey === 'pile'} onclick={() => { sortKey = 'pile' }} type="button">Pile</button>
        <button class="rdo-sort-btn" class:rdo-sort-active={sortKey === 'type'} onclick={() => { sortKey = 'type' }} type="button">Type</button>
        <button class="rdo-sort-btn" class:rdo-sort-active={sortKey === 'name'} onclick={() => { sortKey = 'name' }} type="button">A-Z</button>
        <button class="rdo-sort-btn" class:rdo-sort-active={sortKey === 'mastery'} onclick={() => { sortKey = 'mastery' }} type="button">Mastery</button>
      </div>
    </div>

    <!-- Card grid -->
    <div class="rdo-grid-scroll" onscroll={handleGridScroll}>
      {#if sortedFilteredCards().length === 0}
        <div class="rdo-empty" data-testid="run-deck-overlay-empty">
          <p>
            {#if allCards().length === 0}
              No cards in deck yet. Start combat to load your run deck.
            {:else}
              No cards in {PILE_LABELS[filterPile as PileId] ?? 'this'} pile.
            {/if}
          </p>
          <button class="rdo-close-btn-center" onclick={closeRunDeckOverlay} type="button">
            Close
          </button>
        </div>
      {:else}
        <div class="rdo-card-grid" role="list" aria-label="Cards in deck">
          {#each sortedFilteredCards() as { card, pile }, i (card.id ?? i)}
            <button
              type="button"
              class="rdo-card-cell rdo-card-cell-btn"
              data-testid="rdo-card-{i}"
              aria-label="{card.mechanicName ?? card.factId ?? 'Card'}, {PILE_LABELS[pile]} pile, click to see mastery levels"
              onclick={(e) => {
                // If clicking same card, toggle closed
                if (selectedCard?.card.id === card.id) {
                  closeMasteryPopup()
                } else {
                  openMasteryPopup(e, card, pile)
                }
              }}
            >
              <!-- CardVisual wrapper — requires position:relative + explicit w/h + --card-w -->
              <div
                class="rdo-card-visual-wrapper"
                style="width: calc({CARD_W_PX}px * var(--layout-scale, 1)); height: calc({Math.round(CARD_W_PX * (1142 / 886))}px * var(--layout-scale, 1)); --card-w: calc({CARD_W_PX}px * var(--layout-scale, 1));"
              >
                <CardVisual {card} />
              </div>
              <!-- Pile badge — floats above card top, horizontally centered -->
              <span
                class="rdo-card-pile-badge"
                style="background: {PILE_COLORS[pile]}22; border-color: {PILE_COLORS[pile]}; color: {PILE_COLORS[pile]};"
                aria-hidden="true"
              >{PILE_LABELS[pile]}</span>
              <!-- Mastery badge -->
              {#if (card.masteryLevel ?? 0) > 0}
                <span
                  class="rdo-card-mastery-badge"
                  style="color: {masteryColor(card.masteryLevel)};"
                  aria-hidden="true"
                >{masteryLabel(card.masteryLevel)}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Mastery popup — centered in viewport, backdrop catches outside clicks -->
{#if selectedCard !== null}
  {@const sc = selectedCard}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="rdo-mastery-backdrop" onclick={closeMasteryPopup}>
    <div
      class="rdo-mastery-popup"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="false"
      aria-label="Mastery levels for {sc.card.mechanicName ?? 'card'}"
      data-testid="rdo-mastery-popup"
    >
      <!-- Popup header -->
      <div class="rdo-popup-header">
        <span class="rdo-popup-mechanic-name">{sc.card.mechanicName ?? sc.card.factId ?? 'Card'}</span>
      </div>

      <!-- Per-level rows L0 → L5 -->
      <div class="rdo-popup-levels" role="list" aria-label="Mastery levels">
        {#each [0, 1, 2, 3, 4, 5] as level}
          {@const isCurrent = (sc.card.masteryLevel ?? 0) === level}
          {@const descParts = getDescPartsAtLevel(sc.card, level)}
          {@const stats = getMasteryStats(sc.card.mechanicId ?? '', level)}
          <div
            class="rdo-popup-level-row"
            class:rdo-popup-level-current={isCurrent}
            role="listitem"
            aria-label="Level {level}{isCurrent ? ' (current)' : ''}"
          >
            <!-- Icon column — background-crop renders the 73×73 plus region from the
                 full 886×1142 canvas at 52px display size. Avoids object-fit: contain
                 collapsing the plus to ~2px when the whole canvas is crammed into 28px. -->
            <div class="rdo-popup-icon-col">
              <div
                class="rdo-popup-icon"
                class:rdo-popup-icon-bob={isCurrent}
                style="--rdo-icon-filter: {level === 0 ? 'grayscale(1) brightness(0.55) opacity(0.6)' : getMasteryIconFilter(level)};"
                aria-hidden="true"
              ></div>
            </div>
            <!-- Text column -->
            <div class="rdo-popup-text-col">
              <span class="rdo-popup-level-label" style="color: {masteryColor(level)};">L{level}</span>
              <span class="rdo-popup-desc">
                {#each descParts as part}
                  {#if part.type === 'number'}
                    <span class="rdo-popup-desc-number">{part.value}</span>
                  {:else if part.type === 'keyword'}
                    <span class="rdo-popup-desc-keyword">{part.value}</span>
                  {:else if part.type === 'conditional-number'}
                    <span class="rdo-popup-desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                  {:else if part.type === 'mastery-bonus'}
                    <span class="rdo-popup-desc-mastery">{part.value}</span>
                  {:else}
                    {part.value}
                  {/if}
                {/each}
                {#if stats?.apCost != null}
                  <span class="rdo-popup-desc-ap"> ({stats.apCost} AP)</span>
                {/if}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ============================================================
     Backdrop — semi-transparent, covers full viewport
     ============================================================ */
  .rdo-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  /* ============================================================
     Panel — centered modal, scrollable list
     ============================================================ */
  .rdo-panel {
    background: rgba(12, 20, 38, 0.98);
    border: 1px solid rgba(201, 162, 39, 0.5);
    border-radius: calc(8px * var(--layout-scale, 1));
    box-shadow:
      0 calc(8px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    width: calc(1200px * var(--layout-scale, 1));
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }

  /* ============================================================
     Header
     ============================================================ */
  .rdo-header {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(201, 162, 39, 0.25);
    flex-shrink: 0;
    position: relative;
  }

  .rdo-title-row {
    display: flex;
    align-items: baseline;
    gap: calc(8px * var(--layout-scale, 1));
    padding-right: calc(36px * var(--layout-scale, 1));
  }

  .rdo-title {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    color: #f4d35e;
    letter-spacing: 0.04em;
  }

  .rdo-total {
    font-size: calc(15px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.45);
  }

  /* ============================================================
     Pile summary chips
     ============================================================ */
  .rdo-pile-chips {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .rdo-chip {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    border: 1px solid;
    border-radius: 999px;
    line-height: 1.4;
  }

  /* ============================================================
     Close button (top-right)
     ============================================================ */
  .rdo-close-btn {
    position: absolute;
    top: calc(12px * var(--layout-scale, 1));
    right: calc(12px * var(--layout-scale, 1));
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.55);
    font-size: calc(18px * var(--text-scale, 1));
    min-width: calc(28px * var(--layout-scale, 1));
    min-height: calc(28px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: color 150ms ease, border-color 150ms ease;
  }

  .rdo-close-btn:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.4);
  }

  .rdo-close-btn:focus-visible {
    outline: 2px solid rgba(244, 211, 94, 0.8);
    outline-offset: 2px;
  }

  /* ============================================================
     Sort / filter controls
     ============================================================ */
  .rdo-controls {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(201, 162, 39, 0.15);
    flex-shrink: 0;
    align-items: center;
  }

  .rdo-control-group {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .rdo-control-label {
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.05em;
    font-family: var(--font-pixel, var(--font-rpg));
    margin-right: calc(2px * var(--layout-scale, 1));
  }

  .rdo-filter-btn,
  .rdo-sort-btn {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    line-height: 1.5;
    min-height: calc(22px * var(--layout-scale, 1));
  }

  .rdo-filter-btn:hover,
  .rdo-sort-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }

  .rdo-filter-active,
  .rdo-sort-active {
    background: rgba(244, 211, 94, 0.15) !important;
    border-color: rgba(244, 211, 94, 0.6) !important;
    color: #f4d35e !important;
  }

  .rdo-filter-btn.rdo-filter-active {
    border-color: var(--filter-color, rgba(244, 211, 94, 0.6)) !important;
    color: var(--filter-color, #f4d35e) !important;
    background: color-mix(in srgb, var(--filter-color, rgba(244, 211, 94, 1)) 15%, transparent) !important;
  }

  /* ============================================================
     Grid scroll container
     ============================================================ */
  .rdo-grid-scroll {
    overflow-y: auto;
    flex: 1;
    padding: calc(12px * var(--layout-scale, 1));
  }

  .rdo-grid-scroll::-webkit-scrollbar {
    width: calc(4px * var(--layout-scale, 1));
  }

  .rdo-grid-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .rdo-grid-scroll::-webkit-scrollbar-thumb {
    background: rgba(201, 162, 39, 0.3);
    border-radius: 2px;
  }

  /* ============================================================
     Card grid
     ============================================================ */
  .rdo-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(220px * var(--layout-scale, 1)), 1fr));
    gap: calc(30px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    justify-items: center;
    /* Extra top padding so pile badges (which float above cards) are not clipped */
    padding-top: calc(22px * var(--layout-scale, 1));
  }

  /* ============================================================
     Card cell — button reset + badge container
     ============================================================ */
  .rdo-card-cell-btn {
    /* Reset button defaults */
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: inherit;
    /* Layout */
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    /* Subtle hover indicator */
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: filter 150ms ease;
  }

  .rdo-card-cell-btn:hover {
    filter: brightness(1.08);
  }

  .rdo-card-cell-btn:focus-visible {
    outline: 2px solid rgba(244, 211, 94, 0.7);
    outline-offset: calc(3px * var(--layout-scale, 1));
  }

  /* Sized wrapper required by CardVisual (position:absolute inset:0 internally) */
  .rdo-card-visual-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* Pile badge — floats ABOVE the card top, centered horizontally */
  .rdo-card-pile-badge {
    position: absolute;
    top: calc(-18px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1px solid;
    border-radius: 999px;
    padding: calc(1px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    line-height: 1.4;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }

  /* Mastery badge — bottom-right corner */
  .rdo-card-mastery-badge {
    position: absolute;
    bottom: calc(4px * var(--layout-scale, 1));
    right: calc(0px * var(--layout-scale, 1));
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.03em;
    pointer-events: none;
    z-index: 10;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  }

  /* ============================================================
     Empty state
     ============================================================ */
  .rdo-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(14px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1));
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: calc(16px * var(--text-scale, 1));
  }

  .rdo-close-btn-center {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    font-size: calc(16px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 150ms ease;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .rdo-close-btn-center:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  /* ============================================================
     Mastery popup backdrop — transparent, catches outside clicks
     ============================================================ */
  .rdo-mastery-backdrop {
    position: fixed;
    inset: 0;
    z-index: 455;
    /* transparent — just catches clicks */
  }

  /* ============================================================
     Mastery popup — centered in viewport
     ============================================================ */
  .rdo-mastery-popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(480px * var(--layout-scale, 1));
    background: rgba(10, 16, 30, 0.95);
    border: 1px solid rgba(201, 162, 39, 0.45);
    border-radius: calc(8px * var(--layout-scale, 1));
    box-shadow:
      0 calc(8px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.75),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 460;
    pointer-events: auto;
    overflow: hidden;
  }

  /* Popup header bar */
  .rdo-popup-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(201, 162, 39, 0.2);
  }

  .rdo-popup-mechanic-name {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #f4d35e;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }

  /* Level rows container */
  .rdo-popup-levels {
    padding: calc(6px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  /* Individual level row */
  .rdo-popup-level-row {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    border: 1px solid transparent;
    transition: background 150ms ease;
  }

  /* Current mastery level — gold tint + subtle border */
  .rdo-popup-level-current {
    background: rgba(201, 162, 39, 0.12);
    border-color: rgba(201, 162, 39, 0.3);
  }

  /* Mastery icon — 56px column gives padding around the 52px icon */
  .rdo-popup-icon-col {
    flex-shrink: 0;
    width: calc(56px * var(--layout-scale, 1));
    height: calc(56px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* background-crop approach: shows the 73×73 green plus region
     from the 886×1142 card-upgrade-icon.webp canvas at 52px display size.
     Scale factor: 52/73 ≈ 0.712 → scaled canvas ~631×813px; plus starts at ~99,382px. */
  .rdo-popup-icon {
    width: calc(52px * var(--layout-scale, 1));
    height: calc(52px * var(--layout-scale, 1));
    background-image: url('/assets/cardframes/v2/card-upgrade-icon.webp');
    background-repeat: no-repeat;
    background-size: calc(631px * var(--layout-scale, 1)) calc(813px * var(--layout-scale, 1));
    background-position: calc(-99px * var(--layout-scale, 1)) calc(-382px * var(--layout-scale, 1));
    image-rendering: pixelated;
    flex-shrink: 0;
    filter: var(--rdo-icon-filter, none);
  }

  /* Bob animation for the current level's icon — 4px amplitude for visibility at 52px icon */
  @keyframes rdoIconBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(calc(-4px * var(--layout-scale, 1))); }
  }

  .rdo-popup-icon-bob {
    animation: rdoIconBob 1.6s ease-in-out infinite;
  }

  /* Text column */
  .rdo-popup-text-col {
    display: flex;
    align-items: baseline;
    gap: calc(6px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }

  .rdo-popup-level-label {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    min-width: calc(22px * var(--layout-scale, 1));
  }

  .rdo-popup-desc {
    font-family: 'Kreon', 'Georgia', serif;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.4;
    flex: 1;
  }

  .rdo-popup-desc-number {
    font-weight: 700;
    color: #ffffff;
  }

  .rdo-popup-desc-keyword {
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .rdo-popup-desc-conditional {
    color: #9ca3af;
    font-weight: 700;
  }

  .rdo-popup-desc-conditional.active {
    color: #22c55e;
  }

  .rdo-popup-desc-mastery {
    color: #4ade80;
    font-weight: 700;
  }

  .rdo-popup-desc-ap {
    color: rgba(255, 255, 255, 0.45);
    font-size: calc(13px * var(--text-scale, 1));
  }
</style>
