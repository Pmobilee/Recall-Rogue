<script lang="ts">
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardFramePath, getDomainIconPath } from '../utils/domainAssets'
  import { getCardbackUrl, onCardbackReady } from '../utils/cardbackManifest'
  import { getMechanicAnimClass, getTypeFallbackAnimClass, type CardAnimPhase } from '../utils/mechanicAnimations'
  import { getTierDisplayName } from '../../services/tierDerivation'

  interface Props {
    cards: Card[]
    animatingCards?: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
    cardAnimations?: Record<string, CardAnimPhase>
    tierUpTransitions?: Record<string, TierUpTransition>
    onselectcard: (index: number) => void
    ondeselectcard: () => void
    oncastdirect?: (index: number) => void
  }

  type TierUpTransition = 'tier1_to_2a' | 'tier2a_to_2b' | 'tier2b_to_3'

  let {
    cards,
    animatingCards = [],
    selectedIndex,
    disabled,
    apCurrent,
    cardAnimations,
    tierUpTransitions = {},
    onselectcard,
    oncastdirect,
  }: Props = $props()

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

  interface TierUpVisualSignature {
    hue: number
    sparkX: number
    sparkY: number
    spinDeg: number
    intensity: number
  }

  function hashString(input: string): number {
    let hash = 2166136261
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  }

  function getTierUpVisualSignature(factId: string): TierUpVisualSignature {
    const hash = hashString(factId || 'unknown-fact')
    return {
      hue: hash % 360,
      sparkX: 16 + (hash % 62),
      sparkY: 16 + ((hash >>> 6) % 62),
      spinDeg: -9 + ((hash >>> 12) % 19),
      intensity: 0.86 + (((hash >>> 17) % 36) / 100),
    }
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

  let hoveredIndex = $state<number | null>(null)

  let dragState = $state<{
    cardIndex: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    pointerId: number
  } | null>(null)

  let dragDeltaX = $derived(dragState ? dragState.currentX - dragState.startX : 0)
  let dragDeltaY = $derived(dragState ? Math.max(0, dragState.startY - dragState.currentY) : 0)
  let dragRawDeltaY = $derived(dragState ? dragState.startY - dragState.currentY : 0)
  let dragScale = $derived(1 + Math.min(0.3, dragDeltaY / 200))
  let isDragPastThreshold = $derived(dragDeltaY > 60)
  let isDragPreview = $derived(dragDeltaY > 40)

  // Reactive version counter — incremented when new cardbacks arrive via SSE
  let cardbackVersion = $state(0)

  $effect(() => {
    const unsub = onCardbackReady(() => {
      cardbackVersion++
    })
    return unsub
  })

  // Reactive cardback URL map — re-computed when cards change or new cardbacks arrive
  let cardbackUrls = $derived(
    (() => {
      void cardbackVersion
      const map = new Map<string, string | null>()
      for (const card of [...cards, ...animatingCards]) {
        if (!map.has(card.factId)) {
          map.set(card.factId, getCardbackUrl(card.factId))
        }
      }
      return map
    })()
  )

  // Preload cardback images for cards in hand
  $effect(() => {
    for (const [, url] of cardbackUrls) {
      if (url) {
        const img = new Image()
        img.src = url
      }
    }
  })

  function handlePointerEnter(e: PointerEvent, index: number): void {
    if (e.pointerType !== 'mouse') return
    if (selectedIndex !== null || disabled || dragState) return
    hoveredIndex = index
  }

  function handlePointerLeave(): void {
    hoveredIndex = null
  }

  function handlePointerDown(e: PointerEvent, index: number): void {
    if (disabled) return
    const card = cards[index]
    if (!card) return
    if (selectedIndex !== null && selectedIndex !== index) return

    dragState = {
      cardIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      pointerId: e.pointerId,
    }
    hoveredIndex = null
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    dragState = { ...dragState, currentX: e.clientX, currentY: e.clientY }
    const totalMovement = Math.abs(e.clientX - dragState.startX) + Math.abs(dragState.startY - e.clientY)
    if (totalMovement > 10) {
      e.preventDefault()
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    const deltaY = dragState.startY - e.clientY
    const deltaX = Math.abs(e.clientX - dragState.startX)
    const wasDrag = Math.abs(deltaY) > 20 || deltaX > 20
    const index = dragState.cardIndex
    dragState = null

    if (deltaY > 60) {
      // Upward drag past threshold — cast directly
      if (oncastdirect) {
        oncastdirect(index)
      } else {
        onselectcard(index)
      }
    } else if (!wasDrag) {
      // Tap (minimal movement) — normal select behavior
      onselectcard(index)
    }
    // Below threshold with movement: card returns to hand (no action)
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
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const mechAnimClass = getMechanicAnimClass(card.mechanicId) || getTypeFallbackAnimClass(card.cardType)}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isMechanic = cardAnim === 'mechanic'}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const isHovered = hoveredIndex === i && !isSelected && !isOther && selectedIndex === null}
    {@const hoverLift = isHovered ? 18 : 0}
    {@const hoverScale = isHovered ? 1.15 : 1}
    {@const isDraggingThis = dragState?.cardIndex === i}
    {@const cardDragX = isDraggingThis ? dragDeltaX : 0}
    {@const cardDragRawY = isDraggingThis ? dragRawDeltaY : 0}
    {@const cardDragScale = isDraggingThis ? dragScale : 1}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}

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
      class:card-reveal={isRevealing || isTierUp || isMechanic}
      class:card-tier-up={isTierUp}
      class:card-tier-up-1-2a={isTierUp && tierUpTransition === 'tier1_to_2a'}
      class:card-tier-up-2a-2b={isTierUp && tierUpTransition === 'tier2a_to_2b'}
      class:card-tier-up-2b-3={isTierUp && tierUpTransition === 'tier2b_to_3'}
      class:card-mechanic={isMechanic}
      class:drag-ready={isDragPastThreshold && isDraggingThis}
      style="
        {isRevealing || isMechanic ? '' : isDraggingThis ? `transform: translateX(${xOffset + cardDragX}px) translateY(${(isSelected ? -80 : -arcOffset) - cardDragRawY}px) rotate(0deg) scale(${cardDragScale});` : `transform: translateX(${xOffset}px) translateY(${isSelected ? -80 : isOther ? 15 : -(arcOffset + hoverLift)}px) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.2 : hoverScale});`}
        border-color: {domainColor};
        --frame-image: url('{framePath}');
        animation-delay: {i * 50}ms;
        opacity: {isOther ? 0.3 : 1};
        z-index: {isDraggingThis ? 20 : isHovered ? 10 : ''};
      "
      data-testid="card-hand-{i}"
      disabled={disabled || isOther}
      onpointerdown={(e) => handlePointerDown(e, i)}
      onpointermove={(e) => handlePointerMove(e)}
      onpointerup={(e) => handlePointerUp(e)}
      onpointerenter={(e) => handlePointerEnter(e, i)}
      onpointerleave={handlePointerLeave}
    >
      <div class="card-inner" class:flipped={isRevealing || isTierUp || isMechanic}>
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

          {#if isSelected || (isDragPreview && isDraggingThis)}
            <div class="card-info-overlay">
              <div class="info-mechanic">{card.mechanicName ?? card.cardType}</div>
              <div class="info-effect">{getCardEffectText(card)}</div>
              {#if isSelected && !isDraggingThis}
                <div class="info-cast-hint">Tap or Swipe Up ↑</div>
              {/if}
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
      {#if isTierUp}
        <div
          class="tier-up-overlay"
          class:tier-up-1-2a={tierUpTransition === 'tier1_to_2a'}
          class:tier-up-2a-2b={tierUpTransition === 'tier2a_to_2b'}
          class:tier-up-2b-3={tierUpTransition === 'tier2b_to_3'}
          style="
            --tier-hue: {tierVisual.hue};
            --spark-x: {tierVisual.sparkX}%;
            --spark-y: {tierVisual.sparkY}%;
            --spark-spin: {tierVisual.spinDeg}deg;
            --spark-intensity: {tierVisual.intensity};
          "
        ></div>
      {/if}
    </button>
  {/each}

  {#each animatingCards as card (card.id)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const mechAnimClass = getMechanicAnimClass(card.mechanicId) || getTypeFallbackAnimClass(card.cardType)}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isMechanic = cardAnim === 'mechanic'}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const domainColor = getDomainColor(card.domain)}
    {@const framePath = card.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(card.cardType)}
    {@const domainIconPath = getDomainIconPath(card.domain)}
    {@const effectVal = getEffectValue(card)}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}

    <div
      class="card-in-hand card-animating"
      class:card-reveal={isRevealing || isTierUp || isMechanic}
      class:card-tier-up={isTierUp}
      class:card-tier-up-1-2a={isTierUp && tierUpTransition === 'tier1_to_2a'}
      class:card-tier-up-2a-2b={isTierUp && tierUpTransition === 'tier2a_to_2b'}
      class:card-tier-up-2b-3={isTierUp && tierUpTransition === 'tier2b_to_3'}
      class:card-mechanic={isMechanic}
      class:card-launch={cardAnim === 'launch'}
      class:card-fizzle={cardAnim === 'fizzle'}
      style="
        border-color: {domainColor};
        --frame-image: url('{framePath}');
      "
    >
      <div class="card-inner" class:flipped={isRevealing || isTierUp || isMechanic}>
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
      {#if isTierUp}
        <div
          class="tier-up-overlay"
          class:tier-up-1-2a={tierUpTransition === 'tier1_to_2a'}
          class:tier-up-2a-2b={tierUpTransition === 'tier2a_to_2b'}
          class:tier-up-2b-3={tierUpTransition === 'tier2b_to_3'}
          style="
            --tier-hue: {tierVisual.hue};
            --spark-x: {tierVisual.sparkX}%;
            --spark-y: {tierVisual.sparkY}%;
            --spark-spin: {tierVisual.spinDeg}deg;
            --spark-intensity: {tierVisual.intensity};
          "
        ></div>
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
    transition: transform 0.15s ease-out, opacity 0.25s ease;
    animation: card-fan-in 300ms ease-out both;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
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

  .drag-ready {
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.7), 0 0 32px rgba(34, 197, 94, 0.3) !important;
  }

  .card-selected {
    z-index: 20; /* Must be above .card-backdrop (z-index: 15) in CardCombatOverlay */
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

  .card-tier-up .card-inner {
    animation: tierUpInnerRumble 600ms ease-in-out both;
  }

  @keyframes tierUpInnerRumble {
    0% { transform: rotateY(180deg) translateX(0); }
    16% { transform: rotateY(180deg) translateX(-2px); }
    32% { transform: rotateY(180deg) translateX(2px); }
    48% { transform: rotateY(180deg) translateX(-1px); }
    64% { transform: rotateY(180deg) translateX(1px); }
    100% { transform: rotateY(180deg) translateX(0); }
  }

  .tier-up-overlay {
    position: absolute;
    inset: -4px;
    border-radius: 10px;
    pointer-events: none;
    z-index: 12;
    animation-duration: 600ms;
    animation-fill-mode: both;
    animation-timing-function: ease-out;
  }

  .tier-up-overlay::before,
  .tier-up-overlay::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    pointer-events: none;
  }

  .tier-up-overlay::before {
    background:
      radial-gradient(
        circle at var(--spark-x, 25%) var(--spark-y, 22%),
        hsl(var(--tier-hue, 210) 98% 78% / 0.58) 0,
        transparent 36%
      ),
      radial-gradient(
        circle at calc(100% - var(--spark-x, 25%)) calc(100% - var(--spark-y, 22%)),
        hsl(calc(var(--tier-hue, 210) + 36) 96% 74% / 0.48) 0,
        transparent 34%
      );
    mix-blend-mode: screen;
    opacity: 0;
    animation: tierSignatureSpark 600ms ease-out both;
  }

  .tier-up-overlay::after {
    border: 1px solid hsl(calc(var(--tier-hue, 210) + 18) 95% 74% / 0.5);
    transform: rotate(var(--spark-spin, 0deg)) scale(0.9);
    opacity: 0;
    animation: tierSignatureTrace 600ms ease-out both;
  }

  .tier-up-overlay.tier-up-1-2a {
    border: 2px solid rgba(96, 165, 250, 0.95);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.95), 0 0 40px rgba(37, 99, 235, 0.5);
    animation-name: tierUpBluePulse;
  }

  .tier-up-overlay.tier-up-2a-2b {
    border: 2px solid rgba(74, 222, 128, 0.95);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.9), 0 0 42px rgba(21, 128, 61, 0.5);
    background:
      radial-gradient(circle at 15% 20%, rgba(187, 247, 208, 0.85) 0, transparent 35%),
      radial-gradient(circle at 70% 30%, rgba(167, 243, 208, 0.7) 0, transparent 32%),
      radial-gradient(circle at 45% 75%, rgba(220, 252, 231, 0.65) 0, transparent 36%);
    animation-name: tierUpGreenSparkle;
  }

  .tier-up-overlay.tier-up-2b-3 {
    border: 2px solid rgba(250, 204, 21, 0.95);
    box-shadow: 0 0 24px rgba(250, 204, 21, 0.95), 0 0 46px rgba(168, 85, 247, 0.55);
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.45), rgba(250, 204, 21, 0.42));
    animation-name: tierUpMasteryBurst;
  }

  @keyframes tierUpBluePulse {
    0% { opacity: 0; transform: scale(0.88); }
    35% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 0; transform: scale(1.18); }
  }

  @keyframes tierUpGreenSparkle {
    0% { opacity: 0; transform: scale(0.86); }
    45% { opacity: 1; transform: scale(1.03); }
    100% { opacity: 0; transform: scale(1.2); }
  }

  @keyframes tierUpMasteryBurst {
    0% { opacity: 0; transform: scale(0.84) rotate(-2deg); }
    45% { opacity: 1; transform: scale(1.04) rotate(1deg); }
    100% { opacity: 0; transform: scale(1.24) rotate(3deg); }
  }

  @keyframes tierSignatureSpark {
    0% { opacity: 0; transform: scale(0.82); }
    44% { opacity: 1; transform: scale(var(--spark-intensity, 1)); }
    100% { opacity: 0; transform: scale(1.22); }
  }

  @keyframes tierSignatureTrace {
    0% { opacity: 0; transform: rotate(var(--spark-spin, 0deg)) scale(0.82); }
    35% { opacity: 0.72; transform: rotate(var(--spark-spin, 0deg)) scale(1.02); }
    100% { opacity: 0; transform: rotate(var(--spark-spin, 0deg)) scale(1.2); }
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
