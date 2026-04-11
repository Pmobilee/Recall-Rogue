<script lang="ts">
  /**
   * RunDeckOverlay.svelte
   *
   * Full-run deck viewer accessible from the top-bar deck icon on every run-active screen.
   * Shows all cards currently in the run across all four piles (hand / draw / discard / forget)
   * with their mastery level and pile tag. Read-only — no card selection.
   *
   * Opened via `openRunDeckOverlay()` from runDeckOverlayStore.ts.
   * Rendered centrally in CardApp.svelte when IN_RUN_SCREENS is active.
   */
  import { closeRunDeckOverlay } from '../stores/runDeckOverlayStore'
  import { activeTurnState } from '../../services/encounterBridge'
  import type { Card } from '../../data/card-types'
  import { getEffectiveApCost } from '../../services/cardUpgradeService'

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
  // Keyboard handler — close on Escape
  // ============================================================
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeRunDeckOverlay()
    }
  }

  // ============================================================
  // Backdrop click (dismiss on outside click)
  // ============================================================
  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      closeRunDeckOverlay()
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
        <span class="rdo-title">Run Deck</span>
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

    <!-- Card list -->
    <div class="rdo-list" role="list">
      {#if allCards().length === 0}
        <div class="rdo-empty" data-testid="run-deck-overlay-empty">
          <p>No cards in deck yet. Start combat to load your run deck.</p>
          <button class="rdo-close-btn-center" onclick={closeRunDeckOverlay} type="button">
            Close
          </button>
        </div>
      {:else}
        {#each allCards() as { card, pile }, i (card.id ?? i)}
          <div class="rdo-row" role="listitem" data-testid="rdo-card-{i}">
            <!-- Pile tag -->
            <span
              class="rdo-pile-tag"
              style="color: {PILE_COLORS[pile]}; border-color: {PILE_COLORS[pile]};"
              aria-label="In {PILE_LABELS[pile]} pile"
            >
              {PILE_LABELS[pile]}
            </span>

            <!-- Type dot -->
            <span
              class="rdo-type-dot"
              style="background: {TYPE_COLORS[card.cardType] ?? '#888'};"
              aria-hidden="true"
            ></span>

            <!-- Card name + type -->
            <div class="rdo-card-info">
              <span class="rdo-card-name">
                {card.mechanicName ?? card.factId ?? 'Unknown'}
                {#if card.isRemovedFromGame}
                  <span class="rdo-inscribed-badge">INSCRIBED</span>
                {/if}
              </span>
              <span class="rdo-card-meta">
                {card.cardType} · AP {getEffectiveApCost(card)}
              </span>
            </div>

            <!-- Mastery badge -->
            <span
              class="rdo-mastery"
              style="color: {masteryColor(card.masteryLevel)};"
              aria-label="Mastery {masteryLabel(card.masteryLevel)}"
            >
              {masteryLabel(card.masteryLevel)}
            </span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

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
    width: calc(480px * var(--layout-scale, 1));
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
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #f4d35e;
    letter-spacing: 0.04em;
  }

  .rdo-total {
    font-size: calc(10px * var(--text-scale, 1));
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
    font-size: calc(9px * var(--text-scale, 1));
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
    font-size: calc(13px * var(--text-scale, 1));
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
     Card list — scrollable
     ============================================================ */
  .rdo-list {
    overflow-y: auto;
    flex: 1;
    padding: calc(6px * var(--layout-scale, 1)) 0;
  }

  .rdo-list::-webkit-scrollbar {
    width: calc(4px * var(--layout-scale, 1));
  }

  .rdo-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .rdo-list::-webkit-scrollbar-thumb {
    background: rgba(201, 162, 39, 0.3);
    border-radius: 2px;
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
    font-size: calc(11px * var(--text-scale, 1));
  }

  .rdo-close-btn-center {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    font-size: calc(11px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 150ms ease;
  }

  .rdo-close-btn-center:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  /* ============================================================
     Card row
     ============================================================ */
  .rdo-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    min-height: calc(36px * var(--layout-scale, 1));
  }

  .rdo-row:last-child {
    border-bottom: none;
  }

  .rdo-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  /* ============================================================
     Pile tag — small chip left of the row
     ============================================================ */
  .rdo-pile-tag {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1px solid;
    border-radius: 999px;
    padding: calc(1px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    flex-shrink: 0;
    min-width: calc(52px * var(--layout-scale, 1));
    text-align: center;
    line-height: 1.5;
  }

  /* ============================================================
     Type dot
     ============================================================ */
  .rdo-type-dot {
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ============================================================
     Card info block
     ============================================================ */
  .rdo-card-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: calc(1px * var(--layout-scale, 1));
  }

  .rdo-card-name {
    font-size: calc(11px * var(--text-scale, 1));
    color: #e2e8f0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .rdo-card-meta {
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.2;
  }

  .rdo-inscribed-badge {
    font-size: calc(7px * var(--text-scale, 1));
    font-weight: 700;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.15);
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: calc(2px * var(--layout-scale, 1));
    padding: 0 calc(3px * var(--layout-scale, 1));
    margin-left: calc(4px * var(--layout-scale, 1));
    vertical-align: middle;
    letter-spacing: 0.05em;
  }

  /* ============================================================
     Mastery badge
     ============================================================ */
  .rdo-mastery {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    flex-shrink: 0;
    min-width: calc(22px * var(--layout-scale, 1));
    text-align: right;
    letter-spacing: 0.03em;
  }
</style>
