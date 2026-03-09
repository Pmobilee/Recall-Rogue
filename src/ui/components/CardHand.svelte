<script lang="ts">
  import type { Card, FactDomain, CardType } from '../../data/card-types'

  interface Props {
    cards: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
    cardAnimations?: Record<string, 'launch' | 'fizzle' | null>
    onselectcard: (index: number) => void
    ondeselectcard: () => void
  }

  let { cards, selectedIndex, disabled, apCurrent, cardAnimations, onselectcard }: Props = $props()

  const DOMAIN_COLORS: Record<FactDomain, string> = {
    science: '#E74C3C',
    history: '#3498DB',
    geography: '#F1C40F',
    language: '#2ECC71',
    math: '#9B59B6',
    arts: '#E67E22',
    medicine: '#1ABC9C',
    technology: '#95A5A6',
  }

  const TYPE_ICONS: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  function getRotation(index: number, total: number): number {
    if (total <= 1) return 0
    const spread = 16
    const step = spread / (total - 1)
    return -spread / 2 + step * index
  }

  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0
    const mid = (total - 1) / 2
    const normalized = (index - mid) / mid
    return Math.abs(normalized) * 8
  }

  function getXOffset(index: number, total: number): number {
    const cardVisibleWidth = 39
    const totalWidth = cardVisibleWidth * (total - 1)
    return -totalWidth / 2 + cardVisibleWidth * index
  }

  function getEffectValue(card: Card): number {
    return Math.round(card.baseEffectValue * card.effectMultiplier)
  }

  function getTierBadge(card: Card): string {
    if (card.tier === '1') return ''
    return card.tier.toUpperCase()
  }

  function hasEnoughAp(card: Card): boolean {
    return Math.max(1, card.apCost ?? 1) <= apCurrent
  }

  function handleCardClick(index: number): void {
    if (disabled) return
    if (selectedIndex !== null) return
    const card = cards[index]
    if (!card) return
    if (!hasEnoughAp(card)) return
    onselectcard(index)
  }
</script>

<div class="card-hand-container" role="group" aria-label="Card hand">
  {#each cards as card, i (card.id)}
    {@const isSelected = selectedIndex === i}
    {@const isOther = selectedIndex !== null && !isSelected}
    {@const rotation = getRotation(i, cards.length)}
    {@const arcOffset = getArcOffset(i, cards.length)}
    {@const xOffset = getXOffset(i, cards.length)}
    {@const domainColor = DOMAIN_COLORS[card.domain]}
    {@const icon = TYPE_ICONS[card.cardType]}
    {@const effectVal = getEffectValue(card)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const tierBadge = getTierBadge(card)}
    {@const apCost = Math.max(1, card.apCost ?? 1)}
    {@const insufficientAp = !hasEnoughAp(card)}

    <button
      class="card-in-hand"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:tier-2a={card.tier === '2a'}
      class:tier-2b={card.tier === '2b'}
      class:tier-3={card.tier === '3'}
      class:echo-card={card.isEcho}
      class:trial-card={card.isMasteryTrial}
      class:insufficient-ap={insufficientAp}
      class:card-launch={cardAnim === 'launch'}
      class:card-fizzle={cardAnim === 'fizzle'}
      style="
        transform: translateX({xOffset}px) translateY({isOther ? 20 : -arcOffset}px) rotate({isSelected ? 0 : rotation}deg);
        border-color: {domainColor};
        animation-delay: {i * 50}ms;
      "
      data-testid="card-hand-{i}"
      disabled={disabled || isOther || insufficientAp}
      onclick={() => handleCardClick(i)}
    >
      <div class="card-domain-stripe" style="background: {domainColor};"></div>
      <div class="card-type-icon">{icon}</div>
      <div class="card-effect-value">{effectVal}</div>
      <div class="ap-cost">{apCost} AP</div>

      {#if tierBadge}
        <div class="card-tier-badge">{tierBadge}</div>
      {/if}
      {#if card.isMasteryTrial}
        <div class="trial-badge">TRIAL</div>
      {/if}
      {#if card.isEcho}
        <div class="echo-badge">ECHO</div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .card-hand-container {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    height: 100px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: none;
  }

  .card-in-hand {
    position: absolute;
    width: 65px;
    height: 100px;
    background: #1e2d3d;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: hidden;
    transition: transform 250ms ease, opacity 250ms ease;
    animation: card-fan-in 300ms ease-out both;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    color: white;
  }

  .card-in-hand:active:not(:disabled) {
    transform: scale(1.05);
  }

  .card-selected {
    z-index: 5;
    transform: translateY(-20px) scale(1.1) !important;
  }

  .card-dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .insufficient-ap {
    opacity: 0.45;
    filter: grayscale(0.5);
  }

  .tier-2a {
    box-shadow: 0 0 6px rgba(192, 192, 192, 0.45);
  }

  .tier-2b {
    box-shadow: 0 0 10px rgba(192, 192, 192, 0.8);
  }

  .tier-3 {
    border-color: #ffd700 !important;
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.8);
  }

  .echo-card {
    opacity: 0.65;
    border-style: dashed;
    filter: brightness(1.2) contrast(0.85);
    animation: card-fan-in 300ms ease-out both, echo-shimmer 2s ease-in-out infinite;
  }

  .trial-card {
    border-color: #f1c40f !important;
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.65);
  }

  .card-domain-stripe {
    width: 100%;
    height: 4px;
    flex-shrink: 0;
  }

  .card-type-icon {
    font-size: 18px;
    margin-top: 5px;
    line-height: 1;
  }

  .card-effect-value {
    font-size: 22px;
    font-weight: 700;
    margin-top: 3px;
    line-height: 1;
  }

  .ap-cost {
    margin-top: 2px;
    font-size: 9px;
    font-weight: 700;
    color: #90caf9;
  }

  .card-tier-badge {
    font-size: 10px;
    font-weight: 700;
    margin-top: auto;
    margin-bottom: 3px;
    color: #c0c0c0;
  }

  .tier-2b .card-tier-badge {
    color: #e4e4e4;
  }

  .tier-3 .card-tier-badge {
    color: #ffd700;
  }

  .trial-badge {
    position: absolute;
    top: 5px;
    right: 3px;
    font-size: 7px;
    font-weight: 800;
    background: rgba(241, 196, 15, 0.9);
    color: #1a1a1a;
    border-radius: 3px;
    padding: 1px 3px;
  }

  .echo-badge {
    position: absolute;
    top: 5px;
    left: 3px;
    font-size: 7px;
    font-weight: 800;
    color: #d1d5db;
    background: rgba(31, 41, 55, 0.8);
    border-radius: 3px;
    padding: 1px 3px;
  }

  @keyframes card-fan-in {
    from {
      opacity: 0;
      transform: translateX(0) translateY(60px) rotate(0deg);
    }
  }

  @keyframes echo-shimmer {
    0% { opacity: 0.55; }
    50% { opacity: 0.75; }
    100% { opacity: 0.55; }
  }

  .card-launch {
    animation: cardLaunch 300ms ease-in forwards;
    pointer-events: none;
  }

  @keyframes cardLaunch {
    0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    60% { opacity: 1; }
    100% { transform: translateY(-600px) rotate(12deg) scale(0.4); opacity: 0; }
  }

  .card-fizzle {
    animation: cardFizzle 400ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes cardFizzle {
    0% { transform: translateY(0) scale(1); opacity: 0.4; filter: grayscale(0.5); }
    100% { transform: translateY(100px) scale(0.8); opacity: 0; filter: grayscale(1); }
  }
</style>
