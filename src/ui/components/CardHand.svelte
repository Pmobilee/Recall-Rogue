<script lang="ts">
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardFramePath, getDomainIconPath } from '../utils/domainAssets'
  import { getCardbackUrl, hasCardback } from '../utils/cardbackManifest'
  import { getMechanicAnimClass, getTypeFallbackAnimClass, type CardAnimPhase } from '../utils/mechanicAnimations'
  import { getTierDisplayName } from '../../services/tierDerivation'

  interface Props {
    cards: Card[]
    animatingCards?: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
    cardAnimations?: Record<string, CardAnimPhase>
    onselectcard: (index: number) => void
    ondeselectcard: () => void
  }

  let { cards, animatingCards = [], selectedIndex, disabled, apCurrent, cardAnimations, onselectcard }: Props = $props()

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
    return getTierDisplayName(card.tier)
  }

  function hasEnoughAp(card: Card): boolean {
    return Math.max(1, card.apCost ?? 1) <= apCurrent
  }

  function getDomainColor(domain: FactDomain): string {
    return getDomainMetadata(domain).colorTint
  }

  let touchStartY: number | null = null
  let dragOffsetY = $state(0)
  let isDragging = $state(false)
  let dragCardIndex = $state<number | null>(null)

  // Preload cardback images for cards in hand
  $effect(() => {
    for (const card of cards) {
      const url = getCardbackUrl(card.factId)
      if (url) {
        const img = new Image()
        img.src = url
      }
    }
  })

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
    {@const domainColor = getDomainColor(card.domain)}
    {@const icon = TYPE_ICONS[card.cardType]}
    {@const framePath = card.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(card.cardType)}
    {@const domainIconPath = getDomainIconPath(card.domain)}
    {@const effectVal = getEffectValue(card)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const tierBadge = getTierBadge(card)}
    {@const apCost = Math.max(1, card.apCost ?? 1)}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = getCardbackUrl(card.factId)}
    {@const mechAnimClass = getMechanicAnimClass(card.mechanicId) || getTypeFallbackAnimClass(card.cardType)}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isMechanic = cardAnim === 'mechanic'}

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
      class:card-reveal={isRevealing || isMechanic}
      class:card-mechanic={isMechanic}
      style="
        {isRevealing || isMechanic ? '' : `transform: translateX(${xOffset}px) translateY(${isSelected ? -80 - (isDragging && dragCardIndex === i ? dragOffsetY : 0) : isOther ? 15 : -arcOffset}px) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.2 : 1});`}
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
      <div class="card-inner" class:flipped={isRevealing || isMechanic}>
        <div class="card-front">
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
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

      {#if isMechanic}
        <div class="mechanic-overlay {mechAnimClass}"></div>
      {/if}
    </button>
  {/each}

  {#each animatingCards as card (card.id)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const cardbackUrl = getCardbackUrl(card.factId)}
    {@const mechAnimClass = getMechanicAnimClass(card.mechanicId) || getTypeFallbackAnimClass(card.cardType)}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isMechanic = cardAnim === 'mechanic'}
    {@const domainColor = getDomainColor(card.domain)}
    {@const framePath = card.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(card.cardType)}
    {@const domainIconPath = getDomainIconPath(card.domain)}
    {@const effectVal = getEffectValue(card)}

    <div
      class="card-in-hand card-animating"
      class:card-reveal={isRevealing || isMechanic}
      class:card-mechanic={isMechanic}
      class:card-launch={cardAnim === 'launch'}
      class:card-fizzle={cardAnim === 'fizzle'}
      style="
        border-color: {domainColor};
        --frame-image: url('{framePath}');
      "
    >
      <div class="card-inner" class:flipped={isRevealing || isMechanic}>
        <div class="card-front">
          <div class="card-domain-stripe" style="background: {domainColor};"></div>
          <img class="card-domain-icon" src={domainIconPath} alt={`${card.domain} icon`} />
          <div class="card-type-icon">{TYPE_ICONS[card.cardType]}</div>
          <div class="card-effect-value">{effectVal}</div>
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

      {#if isMechanic}
        <div class="mechanic-overlay {mechAnimClass}"></div>
      {/if}
    </div>
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
    perspective: 800px;
  }

  .card-animating {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    pointer-events: none;
    z-index: 50;
    /* Start at bottom center of hand area */
    left: 50%;
    bottom: 40px;
    transform: translateX(-50%);
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

  /* Card 3D flip infrastructure */
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 400ms ease-in-out;
  }

  .card-inner.flipped {
    transform: rotateY(180deg);
  }

  .card-front, .card-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .card-front {
    z-index: 1;
    padding: 0;
    overflow: visible;
  }

  .card-back {
    transform: rotateY(180deg);
    z-index: 2;
    overflow: hidden;
    border-radius: 6px;
  }

  .cardback-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
  }

  /* Reveal phase: card centers and enlarges */
  .card-reveal {
    position: fixed !important;
    left: 50% !important;
    top: 45% !important;
    transform: translate(-50%, -50%) scale(1.8) !important;
    z-index: 100 !important;
    transition: all 400ms ease-in-out;
    pointer-events: none;
  }

  /* Mechanic overlay base */
  .mechanic-overlay {
    position: absolute;
    inset: 0;
    border-radius: 6px;
    pointer-events: none;
    z-index: 10;
    animation-duration: 500ms;
    animation-fill-mode: forwards;
    animation-timing-function: ease-out;
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

  /* ═══ ATTACK ANIMATIONS (red/orange) ═══ */

  .mech-strike {
    background: linear-gradient(135deg, transparent 40%, rgba(231, 76, 60, 0.8) 50%, transparent 60%);
    background-size: 300% 300%;
    animation-name: mechSlash;
  }
  @keyframes mechSlash {
    0% { background-position: 0% 0%; opacity: 0; }
    30% { opacity: 1; }
    100% { background-position: 100% 100%; opacity: 0; }
  }

  .mech-multi-hit {
    animation-name: mechMultiHit;
    box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0);
  }
  @keyframes mechMultiHit {
    0%, 100% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); }
    15% { box-shadow: inset 0 -20px 0 0 rgba(231, 76, 60, 0.6); }
    25% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); }
    40% { box-shadow: inset 0 0 20px 0 rgba(231, 76, 60, 0.6); }
    50% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); }
    65% { box-shadow: inset 0 20px 0 0 rgba(231, 76, 60, 0.6); }
    75% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); }
  }

  .mech-heavy-strike {
    animation-name: mechHeavy;
  }
  @keyframes mechHeavy {
    0% { transform: scaleY(1); box-shadow: none; }
    30% { transform: scaleY(0.85); box-shadow: 0 0 20px rgba(231, 76, 60, 0.8); }
    50% { transform: scaleY(1.05); }
    70% { transform: scaleY(0.95); }
    100% { transform: scaleY(1); box-shadow: none; }
  }

  .mech-piercing {
    animation-name: mechPierce;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.9) 0%, rgba(231, 76, 60, 0.4) 30%, transparent 50%);
    background-size: 0% 0%;
    background-repeat: no-repeat;
    background-position: center;
  }
  @keyframes mechPierce {
    0% { background-size: 0% 0%; opacity: 1; }
    50% { background-size: 120% 120%; opacity: 1; }
    100% { background-size: 200% 200%; opacity: 0; }
  }

  .mech-reckless {
    animation-name: mechReckless;
    border: 2px solid transparent;
  }
  @keyframes mechReckless {
    0%, 100% { transform: translateX(0); box-shadow: 0 0 0 rgba(231, 76, 60, 0); }
    10% { transform: translateX(-3px); box-shadow: 0 0 15px rgba(231, 76, 60, 0.7); }
    20% { transform: translateX(3px); }
    30% { transform: translateX(-2px); box-shadow: 0 0 20px rgba(231, 76, 60, 0.9); }
    40% { transform: translateX(2px); }
    50% { transform: translateX(-1px); box-shadow: 0 0 25px rgba(231, 76, 60, 1); }
    60% { transform: translateX(1px); }
    80% { box-shadow: 0 0 10px rgba(231, 76, 60, 0.4); }
  }

  .mech-execute {
    animation-name: mechExecute;
  }
  @keyframes mechExecute {
    0% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); background: transparent; }
    40% { box-shadow: inset 0 0 30px 5px rgba(231, 76, 60, 0.6); }
    60% { box-shadow: inset 0 0 40px 10px rgba(200, 30, 30, 0.8); background: rgba(231, 76, 60, 0.15); }
    100% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); background: transparent; }
  }

  /* ═══ SHIELD ANIMATIONS (blue/cyan) ═══ */

  .mech-block {
    animation-name: mechBlock;
  }
  @keyframes mechBlock {
    0% { box-shadow: inset 0 0 0 0 rgba(52, 152, 219, 0); }
    40% { box-shadow: inset 0 0 0 8px rgba(52, 152, 219, 0.7); }
    100% { box-shadow: inset 0 0 0 3px rgba(52, 152, 219, 0.3); }
  }

  .mech-thorns {
    animation-name: mechThorns;
  }
  @keyframes mechThorns {
    0% { box-shadow: inset 0 0 0 4px rgba(52, 152, 219, 0); }
    30% { box-shadow: inset 0 0 0 6px rgba(52, 152, 219, 0.7); }
    50% { box-shadow: inset 0 0 0 4px rgba(52, 152, 219, 0.5), 0 0 12px rgba(231, 76, 60, 0.6); }
    100% { box-shadow: inset 0 0 0 0 rgba(52, 152, 219, 0), 0 0 0 rgba(231, 76, 60, 0); }
  }

  .mech-fortify {
    animation-name: mechFortify;
  }
  @keyframes mechFortify {
    0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.6); }
    33% { box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.5); }
    66% { box-shadow: 0 0 0 8px rgba(52, 152, 219, 0.3); }
    100% { box-shadow: 0 0 0 12px rgba(52, 152, 219, 0); }
  }

  .mech-parry {
    background: linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.8) 50%, transparent 60%);
    background-size: 300% 300%;
    animation-name: mechParry;
  }
  @keyframes mechParry {
    0% { background-position: 100% 100%; opacity: 0; }
    20% { opacity: 1; }
    50% { background-position: 0% 0%; opacity: 1; }
    70% { background-position: 100% 100%; opacity: 0.5; }
    100% { opacity: 0; }
  }

  .mech-brace {
    animation-name: mechBrace;
  }
  @keyframes mechBrace {
    0% { border: 0 solid rgba(52, 152, 219, 0); }
    30% { border: 4px solid rgba(52, 152, 219, 0.8); }
    60% { border: 6px solid rgba(100, 180, 230, 0.9); }
    100% { border: 3px solid rgba(52, 152, 219, 0.4); }
  }

  /* ═══ HEAL ANIMATIONS (green) ═══ */

  .mech-restore {
    animation-name: mechRestore;
  }
  @keyframes mechRestore {
    0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); background: transparent; }
    50% { box-shadow: 0 0 20px 5px rgba(46, 204, 113, 0.5); background: rgba(46, 204, 113, 0.15); }
    100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); background: transparent; }
  }

  .mech-cleanse {
    animation-name: mechCleanse;
    background: linear-gradient(to top, rgba(46, 204, 113, 0.4), transparent);
    background-size: 100% 200%;
  }
  @keyframes mechCleanse {
    0% { background-position: 0 100%; opacity: 0; }
    30% { opacity: 1; }
    100% { background-position: 0 -100%; opacity: 0; }
  }

  .mech-overheal {
    animation-name: mechOverheal;
  }
  @keyframes mechOverheal {
    0% { background: radial-gradient(circle, rgba(46, 204, 113, 0.5), transparent 50%); }
    50% { background: radial-gradient(circle, rgba(46, 204, 113, 0.6) 30%, rgba(52, 152, 219, 0.4) 60%, transparent 80%); }
    100% { background: radial-gradient(circle, transparent, transparent); }
  }

  .mech-lifetap {
    background: linear-gradient(to right, rgba(231, 76, 60, 0.5), rgba(46, 204, 113, 0.5));
    background-size: 200% 100%;
    animation-name: mechLifetap;
  }
  @keyframes mechLifetap {
    0% { background-position: 0% 0%; opacity: 0; }
    30% { opacity: 0.8; }
    100% { background-position: 100% 0%; opacity: 0; }
  }

  /* ═══ BUFF ANIMATIONS (gold) ═══ */

  .mech-empower {
    animation-name: mechEmpower;
  }
  @keyframes mechEmpower {
    0% { box-shadow: 0 0 0 rgba(241, 196, 15, 0); background: linear-gradient(to top, rgba(241, 196, 15, 0.4), transparent 50%); background-position: 0 100%; }
    50% { box-shadow: 0 0 15px rgba(241, 196, 15, 0.6); }
    100% { box-shadow: 0 0 0 rgba(241, 196, 15, 0); background-position: 0 -50%; }
  }

  .mech-quicken {
    animation-name: mechQuicken;
  }
  @keyframes mechQuicken {
    0%, 100% { background: transparent; box-shadow: none; }
    15% { background: rgba(255, 255, 255, 0.7); box-shadow: 0 0 20px rgba(241, 196, 15, 0.8); }
    30% { background: transparent; }
    45% { background: rgba(241, 196, 15, 0.3); box-shadow: 0 0 15px rgba(241, 196, 15, 0.5); }
    60% { background: transparent; box-shadow: none; }
  }

  .mech-double-strike {
    animation-name: mechDoubleStrike;
  }
  @keyframes mechDoubleStrike {
    0% { box-shadow: -5px 0 10px rgba(241, 196, 15, 0), 5px 0 10px rgba(241, 196, 15, 0); }
    40% { box-shadow: -8px 0 15px rgba(241, 196, 15, 0.6), 8px 0 15px rgba(241, 196, 15, 0.6); }
    100% { box-shadow: -3px 0 5px rgba(241, 196, 15, 0), 3px 0 5px rgba(241, 196, 15, 0); }
  }

  .mech-focus {
    animation-name: mechFocus;
  }
  @keyframes mechFocus {
    0% { box-shadow: 0 0 0 15px rgba(241, 196, 15, 0.4); }
    50% { box-shadow: 0 0 0 5px rgba(241, 196, 15, 0.7); }
    100% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); }
  }

  /* ═══ DEBUFF ANIMATIONS (purple) ═══ */

  .mech-weaken {
    animation-name: mechWeaken;
  }
  @keyframes mechWeaken {
    0% { background: radial-gradient(circle, rgba(155, 89, 182, 0.6), transparent 0%); }
    50% { background: radial-gradient(circle, rgba(155, 89, 182, 0.4) 30%, transparent 70%); }
    100% { background: radial-gradient(circle, transparent, transparent); }
  }

  .mech-expose {
    animation-name: mechExpose;
  }
  @keyframes mechExpose {
    0% { box-shadow: inset 0 0 0 0 rgba(155, 89, 182, 0); }
    20% { box-shadow: inset 5px 0 0 0 rgba(155, 89, 182, 0.6); }
    40% { box-shadow: inset 5px 0 0 0 rgba(155, 89, 182, 0.6), inset -5px 5px 0 0 rgba(155, 89, 182, 0.5); }
    60% { box-shadow: inset 5px 0 0 0 rgba(155, 89, 182, 0.6), inset -5px 5px 0 0 rgba(155, 89, 182, 0.5), inset 0 -5px 0 0 rgba(155, 89, 182, 0.4); }
    100% { box-shadow: inset 0 0 0 0 rgba(155, 89, 182, 0); }
  }

  .mech-slow {
    background: conic-gradient(rgba(155, 89, 182, 0.5) 0deg, transparent 0deg);
    animation-name: mechSlow;
  }
  @keyframes mechSlow {
    0% { background: conic-gradient(rgba(155, 89, 182, 0.5) 0deg, transparent 0deg); }
    80% { background: conic-gradient(rgba(155, 89, 182, 0.5) 360deg, transparent 360deg); }
    100% { opacity: 0; }
  }

  .mech-hex {
    animation-name: mechHex;
  }
  @keyframes mechHex {
    0% { background: linear-gradient(to bottom, rgba(46, 204, 113, 0.6), transparent 0%); }
    60% { background: linear-gradient(to bottom, rgba(46, 204, 113, 0.5) 0%, rgba(46, 204, 113, 0.3) 60%, transparent 80%); }
    100% { background: linear-gradient(to bottom, transparent, transparent); opacity: 0; }
  }

  /* ═══ UTILITY ANIMATIONS (teal) ═══ */

  .mech-scout {
    animation-name: mechScout;
  }
  @keyframes mechScout {
    0%, 100% { box-shadow: 0 0 0 rgba(26, 188, 156, 0); background: transparent; }
    30% { box-shadow: 0 0 15px rgba(26, 188, 156, 0.5); background: rgba(26, 188, 156, 0.1); }
    50% { box-shadow: 0 0 5px rgba(26, 188, 156, 0.2); background: transparent; }
    70% { box-shadow: 0 0 15px rgba(26, 188, 156, 0.5); background: rgba(26, 188, 156, 0.1); }
  }

  .mech-recycle {
    animation-name: mechRecycle;
  }
  @keyframes mechRecycle {
    0% { transform: rotate(0deg); box-shadow: 0 0 10px rgba(26, 188, 156, 0.4); }
    100% { transform: rotate(360deg); box-shadow: 0 0 0 rgba(26, 188, 156, 0); }
  }

  .mech-foresight {
    animation-name: mechForesight;
  }
  @keyframes mechForesight {
    0% { box-shadow: 0 0 0 rgba(26, 188, 156, 0); background: transparent; }
    30% { box-shadow: 0 0 20px rgba(26, 188, 156, 0.6); background: rgba(26, 188, 156, 0.2); }
    70% { box-shadow: 0 0 25px rgba(26, 188, 156, 0.4); }
    100% { box-shadow: 0 0 0 rgba(26, 188, 156, 0); background: transparent; }
  }

  .mech-transmute {
    animation-name: mechTransmute;
  }
  @keyframes mechTransmute {
    0% { filter: hue-rotate(0deg); box-shadow: 0 0 10px rgba(26, 188, 156, 0.5); }
    100% { filter: hue-rotate(360deg); box-shadow: 0 0 0 rgba(26, 188, 156, 0); }
  }

  /* ═══ REGEN ANIMATIONS (nature green) ═══ */

  .mech-sustained {
    animation-name: mechSustained;
  }
  @keyframes mechSustained {
    0%, 100% { transform: scale(1); box-shadow: 0 0 5px rgba(39, 174, 96, 0.3); }
    50% { transform: scale(1.05); box-shadow: 0 0 15px rgba(39, 174, 96, 0.6); }
  }

  .mech-emergency {
    animation-name: mechEmergency;
  }
  @keyframes mechEmergency {
    0% { background: rgba(231, 76, 60, 0.5); }
    40% { background: rgba(231, 76, 60, 0.3); }
    60% { background: rgba(46, 204, 113, 0.4); }
    100% { background: transparent; }
  }

  .mech-immunity {
    animation-name: mechImmunity;
  }
  @keyframes mechImmunity {
    0% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.6); border-radius: 50%; transform: scale(0.5); opacity: 0; }
    40% { box-shadow: 0 0 15px 5px rgba(241, 196, 15, 0.4); border-radius: 50%; transform: scale(1); opacity: 1; }
    100% { box-shadow: 0 0 10px 2px rgba(241, 196, 15, 0.2); border-radius: 8px; transform: scale(1); opacity: 0.5; }
  }

  /* ═══ WILD ANIMATIONS (rainbow/chaos) ═══ */

  .mech-mirror {
    background: linear-gradient(135deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 80%);
    background-size: 200% 200%;
    animation-name: mechMirror;
  }
  @keyframes mechMirror {
    0% { background-position: -100% -100%; }
    100% { background-position: 200% 200%; }
  }

  .mech-adapt {
    animation-name: mechAdapt;
  }
  @keyframes mechAdapt {
    0% { border-radius: 8px; box-shadow: 0 0 10px rgba(149, 165, 166, 0.5); }
    33% { border-radius: 50%; box-shadow: 0 0 15px rgba(52, 152, 219, 0.5); }
    66% { border-radius: 8px 20px; box-shadow: 0 0 15px rgba(241, 196, 15, 0.5); }
    100% { border-radius: 8px; box-shadow: 0 0 0 transparent; }
  }

  .mech-overclock {
    animation-name: mechOverclock;
  }
  @keyframes mechOverclock {
    0%, 100% { background: transparent; box-shadow: none; }
    15% { background: rgba(255, 255, 255, 0.6); box-shadow: 0 0 20px rgba(255, 255, 255, 0.8); }
    25% { background: transparent; }
    40% { background: rgba(255, 255, 255, 0.5); box-shadow: 0 0 15px rgba(255, 255, 255, 0.6); }
    50% { background: transparent; }
    70% { background: rgba(231, 76, 60, 0.4); box-shadow: 0 0 15px rgba(231, 76, 60, 0.5); }
    85% { background: transparent; box-shadow: none; }
  }

  /* ═══ REDUCED MOTION ═══ */

  @media (prefers-reduced-motion: reduce) {
    .card-inner {
      transition: none;
    }
    .card-reveal {
      transition: none;
    }
    .mechanic-overlay {
      animation: none !important;
      opacity: 0.5;
    }
  }
</style>
