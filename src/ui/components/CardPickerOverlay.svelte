<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getBorderUrl, getBaseFrameUrl, getBannerUrl, getUpgradeIconUrl } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { getShortCardDescription } from '../../services/cardDescriptionService'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { getChainColor, getChainGlowColor } from '../../services/chainVisuals'
  import { getChainTypeColor, getChainTypeName } from '../../data/chainTypes'

  interface Props {
    title: string
    cards: Card[]
    onselect: (card: Card) => void
    onskip: () => void
    pickCount?: number
  }

  let {
    title,
    cards,
    onselect,
    onskip,
    pickCount = 1,
  }: Props = $props()

  /** Cards selected so far (for multi-pick mode). */
  let selectedCards = $state<Card[]>([])
  /** Tracks which card is mid-click animation. */
  let pulsing = $state<string | null>(null)

  let remaining = $derived(pickCount - selectedCards.length)

  function isSelected(card: Card): boolean {
    return selectedCards.some(c => c.id === card.id)
  }

  function handleCardClick(card: Card): void {
    if (pulsing) return

    if (pickCount === 1) {
      // Single-pick: pulse then immediately call onselect
      pulsing = card.id
      setTimeout(() => {
        pulsing = null
        onselect(card)
      }, 200)
    } else {
      // Multi-pick: toggle selection
      if (isSelected(card)) {
        selectedCards = selectedCards.filter(c => c.id !== card.id)
      } else if (remaining > 0) {
        selectedCards = [...selectedCards, card]
      }
    }
  }

  function handleDone(): void {
    for (const card of selectedCards) {
      onselect(card)
    }
  }

  /** Bob animation delay strings by card index. */
  const BOB_DELAYS = ['0ms', '300ms', '600ms']

  /** Bob animation durations by card index (slightly different rates for each). */
  const BOB_DURATIONS = ['2.5s', '3s', '3.5s']

  /** Staggered fade-in delays. */
  const FADE_DELAYS = ['0ms', '150ms', '300ms']
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card-picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
  <!-- Backdrop: clicking it does nothing (must use skip button) -->
  <div class="backdrop"></div>

  <div class="picker-content">
    <!-- Title -->
    <h2 class="picker-title">{title}</h2>

    <!-- Multi-pick counter -->
    {#if pickCount > 1}
      <div class="pick-counter">
        {#if remaining > 0}
          Pick <strong>{remaining}</strong> more
        {:else}
          All picks made — confirm below
        {/if}
      </div>
    {/if}

    <!-- Cards row -->
    <div class="cards-row">
      {#each cards as card, i (card.id)}
        {@const mechanic = getMechanicDefinition(card.mechanicId)}
        {@const artUrl = card.mechanicId ? getCardArtUrl(card.mechanicId) : null}
        {@const chainColor = getChainColor(card.chainType ?? 0)}
        {@const chainGlow = getChainGlowColor(card.chainType ?? 0)}
        {@const selected = isSelected(card)}
        <button
          class="card-btn"
          class:card-selected={selected}
          class:card-pulsing={pulsing === card.id}
          style="
            --bob-duration: {BOB_DURATIONS[i] ?? '3s'};
            --bob-delay: {BOB_DELAYS[i] ?? '0ms'};
            --fade-delay: {FADE_DELAYS[i] ?? '0ms'};
            --chain-color: {chainColor};
            --chain-glow: {chainGlow};
            animation-delay: var(--bob-delay), var(--fade-delay);
          "
          onclick={() => handleCardClick(card)}
          aria-label={`Select ${card.mechanicName ?? card.cardType} card`}
          aria-pressed={selected}
        >
          <!-- V2 layered card frame -->
          <div class="card-v2-frame">
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" style="z-index:0;" />
            {#if artUrl}
              <img class="frame-card-art" src={artUrl} alt="" style="z-index:1;" />
            {/if}
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" style="z-index:2;" />
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" style="z-index:3;" />
            {#if (card.masteryLevel ?? 0) > 0}
              <img class="frame-layer upgrade-icon" src={getUpgradeIconUrl()} alt="" style="z-index:4;" />
            {/if}
          </div>

          <!-- AP cost gem -->
          <div class="card-ap">{card.apCost ?? mechanic?.apCost ?? 1}</div>

          <!-- Gold checkmark for selected cards in multi-pick mode -->
          {#if selected && pickCount > 1}
            <div class="card-check" aria-hidden="true">✓</div>
          {/if}

          <!-- Card info below frame -->
          <div class="card-info">
            <div class="card-name">{card.mechanicName ?? card.cardType}</div>
            <div class="card-desc">{getShortCardDescription(card)}</div>
          </div>
        </button>
      {/each}
    </div>

    <!-- Action buttons -->
    <div class="picker-actions">
      {#if pickCount > 1 && selectedCards.length === pickCount}
        <button class="btn-done" onclick={handleDone}>Done</button>
      {:else if pickCount > 1 && selectedCards.length > 0}
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
    max-width: calc(780px * var(--layout-scale, 1));
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

  /* ===== Cards row ===== */
  .cards-row {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    gap: calc(24px * var(--layout-scale, 1));
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
    gap: calc(8px * var(--layout-scale, 1));
    width: calc(160px * var(--layout-scale, 1));

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
    filter: drop-shadow(0 0 calc(12px * var(--layout-scale, 1)) var(--chain-glow, rgba(255, 215, 0, 0.5)));
    z-index: 2;
  }

  /* Selected (multi-pick): gold border glow + slight dim */
  .card-btn.card-selected {
    filter: drop-shadow(0 0 calc(14px * var(--layout-scale, 1)) rgba(246, 213, 125, 0.8));
    opacity: 0.85;
  }

  .card-btn.card-selected .card-v2-frame {
    outline: calc(3px * var(--layout-scale, 1)) solid #f6d57d;
    outline-offset: calc(2px * var(--layout-scale, 1));
  }

  /* Click pulse */
  .card-btn.card-pulsing {
    animation: cardPulse 200ms ease forwards;
  }

  /* ===== V2 card frame ===== */
  .card-v2-frame {
    position: relative;
    width: calc(160px * var(--layout-scale, 1));
    /* 886:1142 aspect ratio */
    height: calc(206px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .frame-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
  }

  .frame-card-art {
    position: absolute;
    /* Exact position from PSD: bbox(176,186,719,609) on 886x1142 */
    left: 19.9%;
    top: 16.3%;
    width: 61.4%;
    height: 37.0%;
    object-fit: cover;
    image-rendering: auto;
  }

  .upgrade-icon {
    object-fit: contain;
  }

  /* ===== AP cost gem ===== */
  .card-ap {
    position: absolute;
    top: calc(6px * var(--layout-scale, 1));
    left: calc(6px * var(--layout-scale, 1));
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(10, 16, 28, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.35);
    color: #f6e4a0;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    z-index: 10;
    pointer-events: none;
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

  /* ===== Card info row ===== */
  .card-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    pointer-events: none;
    text-align: center;
    width: 100%;
  }

  .card-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 800;
    color: #f4e8c8;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.01em;
    line-height: 1.2;
  }

  .card-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #a8b8cc;
    line-height: 1.3;
    max-width: calc(150px * var(--layout-scale, 1));
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

  .btn-done {
    padding: calc(10px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    background: #f6d57d;
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #1a1204;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 800;
    cursor: pointer;
    transition: background 120ms ease, transform 80ms ease;
  }

  .btn-done:hover {
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
