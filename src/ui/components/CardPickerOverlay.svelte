<script lang="ts">
  import type { Card } from '../../data/card-types'
  import CardVisual from './CardVisual.svelte'

  interface Props {
    title: string
    cards: Card[]
    onselect: (card: Card) => void
    onskip: () => void
    /** How many cards to pick (exact count). Backward-compatible prop. */
    pickCount?: number
    /**
     * Selection mode.
     * - `single` — clicking a card immediately confirms (no confirm button).
     * - `multi` — must select exactly `pickCount` cards, then click Confirm.
     * - `multiUpTo` — select 1..pickCount cards; Confirm enabled when ≥1 selected.
     * Defaults to `single` when pickCount === 1, otherwise `multi`.
     */
    mode?: 'single' | 'multi' | 'multiUpTo'
    /** Label for the confirm button in multi/multiUpTo modes. */
    confirmLabel?: string
  }

  let {
    title,
    cards,
    onselect,
    onskip,
    pickCount = 1,
    mode: modeProp,
    confirmLabel = 'Confirm',
  }: Props = $props()

  /**
   * Effective mode: derive from `mode` prop if supplied, otherwise infer from `pickCount`.
   * This keeps backward compatibility — existing callers only pass `pickCount`.
   */
  let effectiveMode = $derived(
    modeProp ?? (pickCount === 1 ? 'single' : 'multi')
  )

  /** Cards selected so far (for multi/multiUpTo modes). */
  let selectedCards = $state<Card[]>([])
  /** Tracks which card is mid-click animation. */
  let pulsing = $state<string | null>(null)

  let remaining = $derived(pickCount - selectedCards.length)

  /** Confirm button enabled: multi = all picks made, multiUpTo = ≥1 selected. */
  let confirmEnabled = $derived(
    effectiveMode === 'multi'
      ? selectedCards.length === pickCount
      : effectiveMode === 'multiUpTo'
        ? selectedCards.length > 0
        : false
  )

  function isSelected(card: Card): boolean {
    return selectedCards.some(c => c.id === card.id)
  }

  function handleCardClick(card: Card): void {
    if (pulsing) return

    if (effectiveMode === 'single') {
      // Single-pick: pulse then immediately call onselect
      pulsing = card.id
      setTimeout(() => {
        pulsing = null
        onselect(card)
      }, 200)
    } else {
      // Multi / multiUpTo: toggle selection
      if (isSelected(card)) {
        selectedCards = selectedCards.filter(c => c.id !== card.id)
      } else if (remaining > 0) {
        selectedCards = [...selectedCards, card]
      }
    }
  }

  function handleConfirm(): void {
    for (const card of selectedCards) {
      onselect(card)
    }
  }

  /** Bob animation delay strings by card index (wraps for grids beyond 3 cards). */
  const BOB_DELAYS = ['0ms', '300ms', '600ms', '900ms', '200ms', '500ms']
  /** Bob animation durations by card index. */
  const BOB_DURATIONS = ['2.5s', '3s', '3.5s', '2.8s', '3.2s', '2.6s']
  /** Staggered fade-in delays (capped beyond 6 cards). */
  const FADE_DELAYS = ['0ms', '100ms', '200ms', '300ms', '400ms', '500ms']

  /**
   * Card width matching CardHand landscapeCardW formula exactly:
   *   (35vh * 0.88) / 1.42
   * This keeps picker cards the same size as hand cards in landscape mode.
   * Aspect ratio preserved: 1142 / 886 (same as CardHand).
   * No handScaleFactor — picker always shows full-size cards.
   */
  let viewportHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 1080)
  $effect(() => {
    const onResize = () => { viewportHeight = window.innerHeight }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })
  const pickerCardW = $derived((35 * viewportHeight / 100) * 0.88 / 1.42)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card-picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
  <!-- Backdrop: clicking it does nothing (must use skip button) -->
  <div class="backdrop"></div>

  <div class="picker-content">
    <!-- Title -->
    <h2 class="picker-title">{title}</h2>

    <!-- Multi-pick counter (shown for multi/multiUpTo modes) -->
    {#if effectiveMode === 'multi' || effectiveMode === 'multiUpTo'}
      <div class="pick-counter">
        {#if effectiveMode === 'multi'}
          {#if remaining > 0}
            Pick <strong>{remaining}</strong> more
          {:else}
            All picks made — confirm below
          {/if}
        {:else}
          <!-- multiUpTo -->
          {#if selectedCards.length === 0}
            Pick up to <strong>{pickCount}</strong> cards
          {:else}
            <strong>{selectedCards.length}</strong> selected
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Cards row — horizontally centered -->
    <div class="picker-cards">
      {#each cards as card, i (card.id)}
        {@const selected = isSelected(card)}
        <button
          class="card-btn"
          class:card-selected={selected}
          class:card-pulsing={pulsing === card.id}
          style="
            --bob-duration: {BOB_DURATIONS[i % BOB_DURATIONS.length]};
            --bob-delay: {BOB_DELAYS[i % BOB_DELAYS.length]};
            --fade-delay: {FADE_DELAYS[Math.min(i, FADE_DELAYS.length - 1)]};
            animation-delay: var(--bob-delay), var(--fade-delay);
          "
          onclick={() => handleCardClick(card)}
          aria-label={`Select ${card.mechanicName ?? card.cardType} card`}
          aria-pressed={selected}
        >
          <!-- Sized container required by CardVisual (uses position:absolute inset:0 internally).
               Width matches CardHand landscapeCardW: (35vh * 0.88) / 1.42. --card-w CSS var
               is required by CardVisual for internal typography scaling. -->
          <div class="card-visual-wrapper" style="width: {pickerCardW}px; height: {pickerCardW * (1142 / 886)}px; --card-w: {pickerCardW}px;">
            <CardVisual {card} />
          </div>

          <!-- Gold checkmark for selected cards in multi/multiUpTo modes -->
          {#if selected && effectiveMode !== 'single'}
            <div class="card-check" aria-hidden="true">✓</div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Action buttons -->
    <div class="picker-actions">
      {#if effectiveMode !== 'single'}
        <button
          class="btn-confirm"
          class:btn-confirm-enabled={confirmEnabled}
          disabled={!confirmEnabled}
          onclick={handleConfirm}
        >
          {confirmLabel}
        </button>
      {/if}
      {#if effectiveMode === 'multi' && selectedCards.length > 0 && !confirmEnabled}
        <button class="btn-skip-remaining" onclick={onskip}>Skip remaining</button>
      {/if}
      <button class="btn-skip" onclick={onskip}>Skip</button>
    </div>
  </div>
</div>

<style>
  /* ===== Overlay ===== */
  .card-picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
  }

  .picker-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(20px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(960px * var(--layout-scale, 1));
  }

  /* ===== Title ===== */
  .picker-title {
    font-size: calc(26px * var(--text-scale, 1));
    font-weight: 800;
    color: #f4e8c8;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    margin: 0;
    letter-spacing: 0.03em;
  }

  .pick-counter {
    font-size: calc(15px * var(--text-scale, 1));
    color: #a8b8cc;
    text-align: center;
  }

  .pick-counter strong {
    color: #f6d57d;
  }

  /* ===== Cards row — flex centered for 1–3 Transmute candidates ===== */
  .picker-cards {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: calc(24px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
  }

  /* ===== Card button ===== */
  .card-btn {
    position: relative;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;

    /* Staggered fade-in, then persistent bob */
    animation:
      cardFadeIn 400ms ease forwards,
      cardBob var(--bob-duration, 3s) ease-in-out var(--bob-delay, 0ms) infinite;

    /* Delay fade-in separately — see animation-delay in inline style */
    opacity: 0;
    transition: transform 120ms ease, filter 120ms ease;
  }

  /* Hover: scale up + glow */
  .card-btn:hover {
    transform: scale(1.08) translateY(calc(-4px * var(--layout-scale, 1)));
    filter: drop-shadow(0 0 calc(12px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.5));
    z-index: 2;
  }

  /* Selected (multi-pick): gold border glow + slight dim */
  .card-btn.card-selected {
    filter: drop-shadow(0 0 calc(14px * var(--layout-scale, 1)) rgba(246, 213, 125, 0.8));
    opacity: 0.85;
  }

  /* Gold outline on the card wrapper when selected in multi-pick mode */
  .card-btn.card-selected .card-visual-wrapper {
    outline: calc(3px * var(--layout-scale, 1)) solid #f6d57d;
    outline-offset: calc(2px * var(--layout-scale, 1));
  }

  /* Click pulse */
  .card-btn.card-pulsing {
    animation: cardPulse 200ms ease forwards;
  }

  /* ===== Card visual wrapper — sized container for CardVisual (position:absolute inset:0) ===== */
  /* width, height, and --card-w are set via inline style (pickerCardW) to match CardHand
     landscapeCardW formula: (35vh * 0.88) / 1.42. Aspect ratio: 1142/886. */
  .card-visual-wrapper {
    position: relative;
  }

  /* ===== Checkmark overlay (multi-pick) ===== */
  .card-check {
    position: absolute;
    top: calc(6px * var(--layout-scale, 1));
    right: calc(6px * var(--layout-scale, 1));
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #f6d57d;
    color: #1a1204;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    z-index: 10;
    pointer-events: none;
  }

  /* ===== Action buttons ===== */
  .picker-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: calc(12px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .btn-skip {
    padding: calc(10px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #a8b8cc;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .btn-skip:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #e0e8f0;
  }

  /* Confirm button — disabled state (dim) */
  .btn-confirm {
    padding: calc(10px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    background: rgba(246, 213, 125, 0.2);
    border: 1px solid rgba(246, 213, 125, 0.3);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: rgba(246, 213, 125, 0.5);
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 800;
    cursor: not-allowed;
    transition: background 120ms ease, transform 80ms ease, color 120ms ease, border-color 120ms ease;
  }

  /* Confirm button — enabled state (bright gold) */
  .btn-confirm.btn-confirm-enabled {
    background: #f6d57d;
    border-color: transparent;
    color: #1a1204;
    cursor: pointer;
  }

  .btn-confirm.btn-confirm-enabled:hover {
    background: #fde899;
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
  }

  .btn-skip-remaining {
    padding: calc(10px * var(--layout-scale, 1)) calc(22px * var(--layout-scale, 1));
    background: rgba(246, 213, 125, 0.12);
    border: 1px solid rgba(246, 213, 125, 0.35);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #f6d57d;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .btn-skip-remaining:hover {
    background: rgba(246, 213, 125, 0.22);
  }

  /* ===== Animations ===== */

  /** Staggered card entry fade-in */
  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(calc(16px * var(--layout-scale, 1)));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /** Gentle floating bob — each card has different duration so they move independently */
  @keyframes cardBob {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(calc(-8px * var(--layout-scale, 1)));
    }
  }

  /** Click pulse feedback */
  @keyframes cardPulse {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.12);
      filter: brightness(1.3);
    }
    100% {
      transform: scale(1);
    }
  }
</style>
