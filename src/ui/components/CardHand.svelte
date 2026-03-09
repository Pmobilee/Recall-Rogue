<script lang="ts">
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { getCardFramePath, getDomainIconPath } from '../utils/domainAssets'

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
    const spread = 30
    const step = spread / (total - 1)
    return -spread / 2 + step * index
  }

  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0
    const mid = (total - 1) / 2
    const normalized = (index - mid) / mid
    return (1 - Math.abs(normalized)) * 20
  }

  function getCardSpacing(total: number): number {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 390
    const maxHandWidth = screenWidth * 0.88
    if (total <= 1) return 0
    // 60% of card width overlap
    const cardW = Math.min(screenWidth * 0.18, 85)
    const overlapSpacing = cardW * 0.6
    return Math.min(overlapSpacing, Math.floor((maxHandWidth - cardW) / (total - 1)))
  }

  function getXOffset(index: number, total: number): number {
    const cardVisibleWidth = getCardSpacing(total)
    const totalWidth = cardVisibleWidth * (total - 1)
    return -totalWidth / 2 + cardVisibleWidth * index
  }

  function getCardEffectText(card: Card): string {
    const amount = Math.round(card.baseEffectValue * card.effectMultiplier)
    switch (card.cardType) {
      case 'attack': return `Deal ${amount} damage`
      case 'shield': return `Gain ${amount} shield`
      case 'heal': return `Recover ${amount} HP`
      case 'buff': return `Boost next (${amount})`
      case 'debuff': return `Debuff (${amount})`
      case 'regen': return `Regen ${amount}`
      case 'utility': return `Utility (${amount})`
      case 'wild': return `Adaptive (${amount})`
      default: return `Effect ${amount}`
    }
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

  let touchStartY: number | null = null
  let dragOffsetY = $state(0)
  let isDragging = $state(false)
  let dragCardIndex = $state<number | null>(null)

  function handleTouchStart(e: TouchEvent, index: number): void {
    touchStartY = e.touches[0].clientY
    dragCardIndex = index
    isDragging = true
    dragOffsetY = 0
  }

  function handleTouchMove(e: TouchEvent): void {
    if (touchStartY === null || !isDragging) return
    const deltaY = touchStartY - e.touches[0].clientY
    // Only allow dragging upward (positive deltaY = upward)
    dragOffsetY = Math.max(0, deltaY)
    if (dragOffsetY > 10) {
      e.preventDefault()
    }
  }

  function handleTouchEnd(e: TouchEvent, index: number): void {
    if (touchStartY === null) {
      isDragging = false
      dragCardIndex = null
      dragOffsetY = 0
      return
    }
    const deltaY = touchStartY - e.changedTouches[0].clientY
    touchStartY = null
    isDragging = false
    dragCardIndex = null
    dragOffsetY = 0
    if (deltaY > 60) {
      // Swipe up past threshold — cast the card
      if (!disabled) onselectcard(index)
    }
  }

  function handleCardClick(index: number): void {
    if (disabled) return
    const card = cards[index]
    if (!card) return
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
    {@const framePath = card.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(card.cardType)}
    {@const domainIconPath = getDomainIconPath(card.domain)}
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
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-launch={cardAnim === 'launch'}
      class:card-fizzle={cardAnim === 'fizzle'}
      style="
        transform: translateX({xOffset}px) translateY({isSelected ? -80 - (isDragging && dragCardIndex === i ? dragOffsetY : 0) : isOther ? 15 : -arcOffset}px) rotate({isSelected ? 0 : rotation}deg) scale({isSelected ? 1.2 : 1});
        border-color: {domainColor};
        --frame-image: url('{framePath}');
        animation-delay: {i * 50}ms;
        opacity: {isSelected && isDragging && dragCardIndex === i ? Math.max(0.3, 1 - dragOffsetY / 200) : isOther ? 0.3 : 1};
      "
      data-testid="card-hand-{i}"
      disabled={disabled || isOther}
      onclick={() => handleCardClick(i)}
      ontouchstart={(e) => isSelected ? handleTouchStart(e, i) : null}
      ontouchmove={(e) => isSelected ? handleTouchMove(e) : null}
      ontouchend={(e) => isSelected ? handleTouchEnd(e, i) : null}
    >
      <div class="ap-badge">{apCost}</div>
      <div class="card-domain-stripe" style="background: {domainColor};"></div>
      <img class="card-domain-icon" src={domainIconPath} alt={`${card.domain} icon`} />
      <div class="card-type-icon">{icon}</div>
      <div class="card-effect-value">{effectVal}</div>

      {#if tierBadge}
        <div class="card-tier-badge">{tierBadge}</div>
      {/if}
      {#if card.isMasteryTrial}
        <div class="trial-badge">TRIAL</div>
      {/if}
      {#if card.isEcho}
        <div class="echo-badge">ECHO</div>
      {/if}

      {#if isSelected}
        <div class="card-info-overlay">
          <div class="info-mechanic">{card.mechanicName ?? card.cardType}</div>
          <div class="info-effect">{getCardEffectText(card)}</div>
          <div class="info-cast-hint">Tap or Swipe Up ↑</div>
        </div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .card-hand-container {
    --card-w: min(18vw, 85px);
    --card-h: calc(var(--card-w) * 1.5);
    position: absolute;
    bottom: 68px;
    left: 50%;
    z-index: 20;
    transform: translateX(-50%);
    height: 160px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: none;
  }

  .card-in-hand {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    background-color: #1e2d3d;
    background-image: var(--frame-image);
    background-size: cover;
    background-position: center;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: visible;
    transition: transform 250ms ease, opacity 250ms ease;
    animation: card-fan-in 300ms ease-out both;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  }

  .card-in-hand:active:not(:disabled) {
    transform: scale(1.05);
  }

  .card-playable {
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4);
  }

  .card-selected {
    z-index: 5;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
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

  .card-domain-icon {
    width: 1.4em;
    height: 1.4em;
    object-fit: contain;
    image-rendering: pixelated;
    margin-top: 0.25em;
    font-size: calc(var(--card-w) * 0.18);
  }

  .card-type-icon {
    font-size: calc(var(--card-w) * 0.25);
    margin-top: 0.3em;
    line-height: 1;
  }

  .card-effect-value {
    font-size: calc(var(--card-w) * 0.32);
    font-weight: 700;
    margin-top: 0.15em;
    line-height: 1;
  }

  .ap-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #1e40af;
    color: white;
    font-size: 11px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #3b82f6;
    z-index: 2;
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

  .card-info-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(10, 16, 28, 0.88);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    border-radius: 6px;
    pointer-events: none;
    animation: info-fade-in 200ms ease-out;
  }

  .info-mechanic {
    font-size: calc(var(--card-w) * 0.14);
    font-weight: 700;
    color: #f4d35e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
  }

  .info-effect {
    font-size: calc(var(--card-w) * 0.12);
    color: #c7d5e8;
    text-align: center;
    line-height: 1.3;
  }

  .info-cast-hint {
    font-size: calc(var(--card-w) * 0.11);
    color: #7dd3fc;
    margin-top: auto;
    font-weight: 600;
    animation: hint-pulse 1.5s ease-in-out infinite;
  }

  @keyframes info-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes hint-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
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
