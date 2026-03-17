<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Card, FactDomain } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardbackUrl, onCardbackReady } from '../utils/cardbackManifest'
  import { type CardAnimPhase } from '../utils/mechanicAnimations'
  import { getTierDisplayName } from '../../services/tierDerivation'
  import { getCardFrameUrl, onCardFrameReady } from '../utils/cardFrameManifest'
  import { getShortCardDescription } from '../../services/cardDescriptionService'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import { BASE_WIDTH, GAME_ASPECT_RATIO } from '../../data/layout'
  import { audioManager } from '../../services/audioService'
  import { isFirstChargeFree } from '../../services/discoverySystem'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { activeRunState } from '../../services/runStateStore'

  interface Props {
    cards: Card[]
    animatingCards?: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
    comboMultiplier?: number
    cardAnimations?: Record<string, CardAnimPhase>
    tierUpTransitions?: Record<string, TierUpTransition>
    discarding?: boolean
    onselectcard: (index: number) => void
    ondeselectcard: () => void
    oncastdirect?: (index: number) => void
    /** Charge Play — triggers quiz flow for selected card (AR-59.2). */
    onchargeplay?: (index: number) => void
    /** True during Surge turns — CHARGE! button shows "+0 AP" instead of "+1 AP". */
    isSurgeActive?: boolean
  }

  // Session-level preload guard: avoid creating duplicate Image objects for the same URL.
  const preloadedCardbackUrls = new Set<string>()
  const preloadedFrameUrls = new Set<string>()

  type TierUpTransition = 'tier1_to_2a' | 'tier2a_to_2b' | 'tier2b_to_3'

  let {
    cards,
    animatingCards = [],
    selectedIndex,
    disabled,
    apCurrent,
    comboMultiplier = 1,
    cardAnimations,
    tierUpTransitions = {},
    discarding = false,
    onselectcard,
    oncastdirect,
    onchargeplay,
    isSurgeActive = false,
  }: Props = $props()

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
    const spread = 39
    const step = spread / (total - 1)
    return -spread / 2 + step * index
  }

  function getArcOffset(index: number, total: number): number {
    if (total <= 1) return 0
    const mid = (total - 1) / 2
    const normalized = (index - mid) / mid
    return (1 - normalized * normalized) * 45
  }

  let viewportWidth = $state(typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight * GAME_ASPECT_RATIO) : BASE_WIDTH)

  const cardSpacing = $derived.by(() => {
    const total = cards.length
    if (total <= 1) return 0
    const maxHandWidth = viewportWidth * 0.92
    // 60% of card width overlap
    const cardW = viewportWidth * 0.30
    const overlapSpacing = cardW * 0.58
    return Math.min(overlapSpacing, Math.floor((maxHandWidth - cardW) / (total - 1)))
  })

  function getXOffset(index: number, total: number): number {
    const totalWidth = cardSpacing * (total - 1)
    return -totalWidth / 2 + cardSpacing * index
  }

  function getEffectValue(card: Card, chargeMode: boolean = false): number {
    const mechanic = getMechanicDefinition(card.mechanicId)
    if (mechanic) {
      const baseVal = chargeMode ? mechanic.chargeCorrectValue : mechanic.quickPlayValue
      return Math.round(baseVal * card.effectMultiplier * comboMultiplier)
    }
    return Math.round(card.baseEffectValue * card.effectMultiplier * comboMultiplier)
  }

  function shouldShowFrontValue(card: Card): boolean {
    if (card.cardType === 'attack' || card.cardType === 'shield') return true
    const mechanicId = (card.mechanicId ?? '').toLowerCase()
    const mechanicName = (card.mechanicName ?? '').toLowerCase()
    return mechanicId.includes('heal')
      || mechanicId.includes('regen')
      || mechanicName.includes('heal')
      || mechanicName.includes('regen')
  }

  function isBoosted(): boolean {
    return comboMultiplier > 1
  }

  function getTierBadge(card: Card): string {
    if (card.tier === '1') return ''
    return getTierDisplayName(card.tier)
  }

  function hasEnoughAp(card: Card): boolean {
    return (card.apCost ?? 1) <= apCurrent
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

  /** Screen-position ratio from top of viewport that divides Quick Play zone (below) from Charge zone (above). */
  const CHARGE_ZONE_Y_RATIO = 0.4

  let dragDeltaX = $derived(dragState ? dragState.currentX - dragState.startX : 0)
  let dragDeltaY = $derived(dragState ? Math.max(0, dragState.startY - dragState.currentY) : 0)
  let dragRawDeltaY = $derived(dragState ? dragState.startY - dragState.currentY : 0)
  let dragScale = $derived(1 + Math.min(0.15, dragDeltaY / 500))
  let isDragPastThreshold = $derived(dragDeltaY > 60)
  let isDragPreview = $derived(dragDeltaY > 40)
  /**
   * True when the dragged card's current Y position is ABOVE the screen-position threshold.
   * Uses 35% on small screens (viewport < 600px height), 40% otherwise.
   * Replaces the old 80px drag-distance check for Charge vs Quick Play decision.
   */
  let isInChargeZone = $derived.by(() => {
    if (!dragState) return false
    const ratio = window.innerHeight < 600 ? 0.35 : CHARGE_ZONE_Y_RATIO
    const chargeZoneY = window.innerHeight * ratio
    return dragState.currentY < chargeZoneY
  })
  let pendingDragPoint: { x: number; y: number } | null = null
  let dragFrameId: number | null = null

  // Reactive version counter — incremented when new cardbacks arrive via SSE
  let cardbackVersion = $state(0)

  $effect(() => {
    const unsub = onCardbackReady(() => {
      cardbackVersion++
    })
    return unsub
  })

  // Reactive version counter — incremented when card frame manifest finishes loading
  let cardFrameVersion = $state(0)

  $effect(() => {
    const unsub = onCardFrameReady(() => {
      cardFrameVersion++
    })
    return unsub
  })

  onMount(() => {
    const onResize = (): void => {
      viewportWidth = Math.min(window.innerWidth, window.innerHeight * GAME_ASPECT_RATIO)
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
    }
  })

  onDestroy(() => {
    if (dragFrameId !== null) {
      cancelAnimationFrame(dragFrameId)
      dragFrameId = null
    }
    pendingDragPoint = null
  })

  function flushDragFrame(): void {
    dragFrameId = null
    if (!dragState || !pendingDragPoint) return
    dragState = {
      ...dragState,
      currentX: pendingDragPoint.x,
      currentY: pendingDragPoint.y,
    }
    pendingDragPoint = null
  }

  function clearDragFrame(): void {
    pendingDragPoint = null
    if (dragFrameId !== null) {
      cancelAnimationFrame(dragFrameId)
      dragFrameId = null
    }
  }

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
      if (!url || preloadedCardbackUrls.has(url)) continue
      preloadedCardbackUrls.add(url)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  })

  // Reactive card frame URL map — re-computed when cards change or frame manifest loads
  let cardFrameUrls = $derived(
    (() => {
      void cardFrameVersion
      const map = new Map<string, string | null>()
      for (const card of [...cards, ...animatingCards]) {
        if (card.mechanicId && !map.has(card.mechanicId)) {
          map.set(card.mechanicId, getCardFrameUrl(card.mechanicId))
        }
      }
      return map
    })()
  )

  // Preload card frame images
  $effect(() => {
    for (const [, url] of cardFrameUrls) {
      if (!url || preloadedFrameUrls.has(url)) continue
      preloadedFrameUrls.add(url)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  })

  // Track card count to detect newly dealt cards and play staggered deal sounds
  let prevCardCount = $state(cards.length)
  $effect(() => {
    const newCount = cards.length
    const added = newCount - prevCardCount
    if (added > 0) {
      for (let i = 0; i < added; i++) {
        setTimeout(() => audioManager.playSound('card_deal'), i * 80)
      }
    }
    prevCardCount = newCount
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
    pendingDragPoint = { x: e.clientX, y: e.clientY }
    if (dragFrameId === null) {
      dragFrameId = requestAnimationFrame(flushDragFrame)
    }
    const totalMovement = Math.abs(e.clientX - dragState.startX) + Math.abs(dragState.startY - e.clientY)
    if (totalMovement > 10) {
      e.preventDefault()
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    clearDragFrame()
    const deltaY = dragState.startY - e.clientY
    const deltaX = Math.abs(e.clientX - dragState.startX)
    const wasDrag = Math.abs(deltaY) > 20 || deltaX > 20
    const index = dragState.cardIndex
    // Capture zone state before clearing dragState (isInChargeZone is derived from dragState)
    const wasInChargeZone = isInChargeZone
    const wasPastThreshold = isDragPastThreshold
    dragState = null

    if (wasInChargeZone) {
      // Released in Charge zone (above screen-position threshold) — trigger Charge Play (quiz)
      // Check affordability: if charge can't be paid, fall back to Quick Play
      const card = cards[index]
      const chargeApCost = (card?.apCost ?? 1) + (isSurgeActive ? 0 : 1)
      const canAffordCharge = card && card.tier !== '3' && chargeApCost <= apCurrent
      if (canAffordCharge && onchargeplay) {
        onchargeplay(index)
      } else if (oncastdirect) {
        // Charge not affordable or not available — fall back to Quick Play
        oncastdirect(index)
      } else if (onchargeplay && !canAffordCharge) {
        // Can't afford but onchargeplay is the only handler — still try (let caller decide)
        onchargeplay(index)
      } else {
        onselectcard(index)
      }
    } else if (wasPastThreshold && wasDrag) {
      // Released below Charge zone but past minimum drag threshold (~60px) — Quick Play (no quiz)
      if (oncastdirect) {
        oncastdirect(index)
      } else {
        onselectcard(index)
      }
    } else if (!wasDrag) {
      // Tap (minimal movement) — normal select behavior
      onselectcard(index)
    }
    // Otherwise: drag released below threshold, card returns to hand (no action)
  }

  function handlePointerCancel(e: PointerEvent): void {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    clearDragFrame()
    dragState = null
  }

  /**
   * Svelte action: uses the Web Animations API to animate cards from the
   * draw pile to their fan position, and sets discard offset CSS vars.
   *
   * Web Animations API with composite: 'add' stacks on TOP of the inline
   * transform (fan position) without conflicting.
   */
  /**
   * Svelte action for ghost cards: watches for card-discard or card-fizzle class
   * and triggers a WAAPI animation to fly the card to the discard pile.
   */
  function ghostCardAnim(el: HTMLElement): { destroy: () => void } {
    const observer = new MutationObserver(() => {
      if (el.classList.contains('card-discard') || el.classList.contains('card-fizzle')) {
        const root = getComputedStyle(document.documentElement)
        const discardX = parseFloat(root.getPropertyValue('--discard-pile-x')) || 0
        const discardY = parseFloat(root.getPropertyValue('--discard-pile-y')) || 0
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const offX = discardX - cx
        const offY = discardY - cy

        const isFizzle = el.classList.contains('card-fizzle')
        const currentTransform = getComputedStyle(el).transform || 'none'

        el.animate([
          {
            transform: currentTransform,
            opacity: isFizzle ? 0.4 : 0.7,
            filter: isFizzle ? 'grayscale(0.5)' : 'none',
          },
          {
            transform: `translate(${offX * 0.7}px, ${offY * 0.7}px) scale(0.15)`,
            opacity: isFizzle ? 0.2 : 0.4,
            filter: isFizzle ? 'grayscale(0.8)' : 'none',
            offset: 0.7,
          },
          {
            transform: `translate(${offX}px, ${offY}px) scale(0.05)`,
            opacity: 0,
            filter: isFizzle ? 'grayscale(1)' : 'none',
          },
        ], {
          duration: isFizzle ? 400 : 250,
          easing: 'ease-in',
          fill: 'forwards',
        })

        observer.disconnect()
      }
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return { destroy: () => observer.disconnect() }
  }

  function initCardAnimOffsets(el: HTMLElement): void {
    // Get stagger index from the animation-delay inline style
    const delayMatch = el.style.animationDelay?.match(/(\d+)/)
    const staggerMs = delayMatch ? parseInt(delayMatch[1], 10) : 0

    // Double rAF to ensure CardCombatOverlay's $effect has set --draw-pile-x/y
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      const root = getComputedStyle(document.documentElement)
      const drawX = parseFloat(root.getPropertyValue('--draw-pile-x')) || 0
      const drawY = parseFloat(root.getPropertyValue('--draw-pile-y')) || 0
      const discardX = parseFloat(root.getPropertyValue('--discard-pile-x')) || 0
      const discardY = parseFloat(root.getPropertyValue('--discard-pile-y')) || 0

      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      // Store discard offsets as CSS vars for fizzle/discard keyframe animations
      el.style.setProperty('--discard-offset-x', `${discardX - cx}px`)
      el.style.setProperty('--discard-offset-y', `${discardY - cy}px`)

      // Read the current inline transform (fan position) so we can use it as the end state
      const fanTransform = el.style.transform || 'none'

      // Only animate from draw pile if we have valid pile coordinates
      // (they're 0 on first render before CardCombatOverlay sets them)
      if (drawX > 0 && drawY > 0) {
        const drawOffX = drawX - cx
        const drawOffY = drawY - cy

        el.animate([
          {
            transform: `translate3d(${drawOffX}px, ${drawOffY}px, 0) scale(0.05)`,
            opacity: 0,
          },
          {
            transform: `translate3d(${drawOffX * 0.6}px, ${drawOffY * 0.6}px, 0) scale(0.4)`,
            opacity: 1,
            offset: 0.25,
          },
          {
            transform: fanTransform,
            opacity: 1,
          },
        ], {
          duration: 450,
          delay: staggerMs,
          easing: 'cubic-bezier(0.22, 1.2, 0.36, 1)',
          fill: 'backwards',
        })
      } else {
        // Fallback: simple fade-in when pile positions aren't available yet
        el.animate([
          { opacity: 0, transform: `${fanTransform} scale(0.8)` },
          { opacity: 1, transform: fanTransform },
        ], {
          duration: 300,
          delay: staggerMs,
          easing: 'ease-out',
          fill: 'backwards',
        })
      }
    }) })
  }

</script>

<div class="card-hand-container" class:card-hand-discard={discarding} role="group" aria-label="Card hand">
  {#each cards as card, i (card.id)}
    {@const isSelected = selectedIndex === i}
    {@const isOther = selectedIndex !== null && !isSelected}
    {@const rotation = getRotation(i, cards.length)}
    {@const arcOffset = getArcOffset(i, cards.length)}
    {@const xOffset = getXOffset(i, cards.length)}
    {@const domainColor = getDomainColor(card.domain)}
    {@const showFrontValue = shouldShowFrontValue(card)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const tierBadge = getTierBadge(card)}
    {@const apCost = card.apCost ?? 1}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const cardFrameUrl = cardFrameUrls.get(card.mechanicId ?? '') ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const isHovered = hoveredIndex === i && !isSelected && !isOther && selectedIndex === null}
    {@const hoverLift = isHovered ? 18 : 0}
    {@const hoverScale = isHovered ? 1.15 : 1}
    {@const isDraggingThis = dragState?.cardIndex === i}
    {@const cardDragX = isDraggingThis ? dragDeltaX : 0}
    {@const cardDragRawY = isDraggingThis ? dragRawDeltaY : 0}
    {@const cardDragScale = isDraggingThis ? dragScale : 1}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}
    {@const runState = $activeRunState}
    {@const isFreeCharge = card.factId ? isFirstChargeFree(card.factId, runState?.firstChargeFreeFactIds ?? new Set()) : false}
    {@const isMastered = card.tier === '3'}
    {@const chargeApCostForDrag = (card.apCost ?? 1) + (isSurgeActive ? 0 : 1)}
    {@const chargeAffordableForDrag = chargeApCostForDrag <= apCurrent}
    {@const showChargeZoneIndicator = isDraggingThis && isInChargeZone && !isMastered && !!onchargeplay}
    {@const isDragInChargeZone = isDraggingThis && isInChargeZone && !isMastered}
    {@const chargeProgress = isDraggingThis && dragState ? (() => {
      const startY = dragState.startY
      const ratio = window.innerHeight < 600 ? 0.35 : 0.4
      const chargeZoneY = window.innerHeight * ratio
      const totalDistance = startY - chargeZoneY
      if (totalDistance <= 0) return 0
      const currentDistance = startY - dragState.currentY
      return Math.max(0, Math.min(1, currentDistance / totalDistance))
    })() : 0}
    {@const isChargePreview = chargeProgress > 0.3 && !isMastered}
    {@const effectVal = getEffectValue(card, isChargePreview)}
    {@const descPower = isChargePreview ? getEffectValue(card, true) : undefined}

    <button
      class="card-in-hand"
      class:card-has-frame={!!cardFrameUrl}
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:tier-2a={card.tier === '2a'}
      class:tier-2b={card.tier === '2b'}
      class:tier-3={card.tier === '3'}
      class:echo-card={card.isEcho}
      class:trial-card={card.isMasteryTrial}
      class:card-upgraded={card.isUpgraded}
      class:insufficient-ap={insufficientAp}
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-combo={comboMultiplier > 1 && !insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      class:card-reveal={isAnimating}
      class:card-tier-up={isTierUp}
      class:card-tier-up-1-2a={isTierUp && tierUpTransition === 'tier1_to_2a'}
      class:card-tier-up-2a-2b={isTierUp && tierUpTransition === 'tier2a_to_2b'}
      class:card-tier-up-2b-3={isTierUp && tierUpTransition === 'tier2b_to_3'}
      class:card-swoosh={isSwoosh}
      class:card-swoosh-attack={isSwoosh && card.cardType === 'attack'}
      class:card-swoosh-shield={isSwoosh && card.cardType === 'shield'}
      class:card-swoosh-buff={isSwoosh && card.cardType === 'buff'}
      class:card-swoosh-debuff={isSwoosh && card.cardType === 'debuff'}
      class:card-swoosh-wild={isSwoosh && (card.cardType === 'wild' || card.cardType === 'utility')}
      class:card-impact={isImpact}
      class:card-impact-attack={isImpact && card.cardType === 'attack'}
      class:card-impact-shield={isImpact && (card.cardType === 'shield' || card.cardType === 'utility')}
      class:card-impact-buff={isImpact && card.cardType === 'buff'}
      class:card-impact-debuff={isImpact && card.cardType === 'debuff'}
      class:card-impact-wild={isImpact && card.cardType === 'wild'}
      class:drag-ready={isDragPastThreshold && isDraggingThis && !isDragInChargeZone}
      class:drag-charge-zone={isDragInChargeZone}
      class:drag-charge-zone-disabled={isDragInChargeZone && !chargeAffordableForDrag}
      style="
        {isAnimating ? '' : isDraggingThis ? `transform: translate3d(${xOffset + cardDragX}px, ${(isSelected ? -80 : -arcOffset) - cardDragRawY}px, 0) rotate(0deg) scale(${cardDragScale});` : `transform: translate3d(${xOffset}px, ${isSelected ? -80 : isOther ? 15 : -(arcOffset + hoverLift)}px, 0) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.2 : hoverScale});`}
        {cardFrameUrl ? '' : `border-color: ${domainColor};`}
        animation-delay: {i * 80}ms;
        opacity: {isOther ? 0.3 : 1};
        z-index: {isDraggingThis ? 20 : isHovered ? 10 : ''};
        {isDraggingThis && chargeProgress > 0.05 ? `filter: drop-shadow(0 0 ${8 + chargeProgress * 8}px rgba(250, 204, 21, ${chargeProgress * 0.8})) drop-shadow(0 0 ${16 + chargeProgress * 16}px rgba(250, 204, 21, ${chargeProgress * 0.4}));` : ''}
      "
      data-testid="card-hand-{i}"
      disabled={disabled || isOther}
      use:initCardAnimOffsets
      onpointerdown={(e) => handlePointerDown(e, i)}
      onpointermove={(e) => handlePointerMove(e)}
      onpointerup={(e) => handlePointerUp(e)}
      onpointercancel={(e) => handlePointerCancel(e)}
      onpointerenter={(e) => handlePointerEnter(e, i)}
      onpointerleave={handlePointerLeave}
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          {#if cardFrameUrl}
            <img class="card-frame-img" src={cardFrameUrl} alt={card.mechanicName ?? card.cardType} />
            <div class="ap-gem">{apCost}</div>
            <div class="card-parchment-text">
              <span class="parchment-inner">
                {#each getCardDescriptionParts(card, undefined, descPower) as part}
                  {#if part.type === 'number'}
                    <span class="desc-number" class:charge-preview={isChargePreview}>{part.value}</span>
                  {:else if part.type === 'keyword'}
                    <span class="desc-keyword">{part.value}</span>
                  {:else if part.type === 'conditional-number'}
                    <span class="desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                  {:else}
                    {part.value}
                  {/if}
                {/each}
              </span>
            </div>
          {:else}
            {#if cardbackUrl}
              <img class="card-front-bg" src={cardbackUrl} alt="" />
            {/if}
            <div class="ap-badge" class:ap-free={apCost === 0} class:ap-heavy={apCost === 2} class:ap-full-turn={apCost >= 3}>{apCost}</div>
            <div class="card-domain-stripe" style="background: {domainColor};"></div>
            <div class="card-front-name">{card.mechanicName ?? card.cardType}</div>
            {#if showFrontValue}
              <div class="card-effect-value" class:boosted={isBoosted() && effectVal > 0} class:charge-preview={isChargePreview}>{effectVal}</div>
            {/if}
          {/if}
          {#if card.isMasteryTrial}
            <div class="trial-badge">TRIAL</div>
          {/if}
          {#if card.isEcho}
            <div class="echo-badge">
              <span>ECHO</span>
              <span class="echo-charge-label">⚡ CHARGE</span>
            </div>
          {/if}
          {#if tierBadge}
            <div class="card-tier-badge">{tierBadge}</div>
          {/if}
          {#if isMastered}
            <div class="card-tier-label card-tier-label--mastered">MASTERED</div>
          {/if}
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

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

      {#if showChargeZoneIndicator}
        <div
          class="charge-zone-indicator"
          class:charge-zone-indicator-disabled={!chargeAffordableForDrag}
        >
          {#if !chargeAffordableForDrag}
            <span class="charge-zone-text charge-zone-text-disabled">NOT ENOUGH AP</span>
          {:else}
            <span class="charge-zone-text">⚡ CHARGE {isSurgeActive ? '+0' : '+1'} AP</span>
          {/if}
        </div>
      {/if}
    </button>

    {#if selectedIndex === i && card.tier !== '3' && onchargeplay && !disabled}
      {@const chargeApCost = (card.apCost ?? 1) + (isSurgeActive ? 0 : 1)}
      {@const chargeAffordable = chargeApCost <= apCurrent}
      <button
        class="charge-play-btn"
        class:charge-btn-disabled={!chargeAffordable}
        disabled={!chargeAffordable}
        title={!chargeAffordable ? 'Not enough AP' : 'Charge — answer a quiz for bonus power'}
        onclick={() => onchargeplay!(i)}
        style="transform: translate3d(calc({xOffset}px + var(--card-w) / 2), calc(-80px - var(--card-h) - 16px), 0) translateX(-50%);"
      >
        ⚡ CHARGE
        <span class="charge-ap-badge">{isSurgeActive ? '+0' : '+1'} AP</span>
      </button>
    {/if}
  {/each}

  {#each animatingCards as card (card.id)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const domainColor = getDomainColor(card.domain)}
    {@const effectVal = getEffectValue(card)}
    {@const showFrontValue = shouldShowFrontValue(card)}
    {@const cardFrameUrl = cardFrameUrls.get(card.mechanicId ?? '') ?? null}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}

    <div
      class="card-in-hand card-animating"
      class:card-reveal={isAnimating}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      use:ghostCardAnim
      class:card-tier-up={isTierUp}
      class:card-tier-up-1-2a={isTierUp && tierUpTransition === 'tier1_to_2a'}
      class:card-tier-up-2a-2b={isTierUp && tierUpTransition === 'tier2a_to_2b'}
      class:card-tier-up-2b-3={isTierUp && tierUpTransition === 'tier2b_to_3'}
      class:card-swoosh={isSwoosh}
      class:card-swoosh-attack={isSwoosh && card.cardType === 'attack'}
      class:card-swoosh-shield={isSwoosh && card.cardType === 'shield'}
      class:card-swoosh-buff={isSwoosh && card.cardType === 'buff'}
      class:card-swoosh-debuff={isSwoosh && card.cardType === 'debuff'}
      class:card-swoosh-wild={isSwoosh && (card.cardType === 'wild' || card.cardType === 'utility')}
      class:card-impact={isImpact}
      class:card-impact-attack={isImpact && card.cardType === 'attack'}
      class:card-impact-shield={isImpact && (card.cardType === 'shield' || card.cardType === 'utility')}
      class:card-impact-buff={isImpact && card.cardType === 'buff'}
      class:card-impact-debuff={isImpact && card.cardType === 'debuff'}
      class:card-impact-wild={isImpact && card.cardType === 'wild'}
      style="
        border-color: {domainColor};
      "
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          {#if cardFrameUrl}
            <img class="card-frame-img" src={cardFrameUrl} alt={card.mechanicName ?? card.cardType} />
            <div class="ap-gem">{card.apCost ?? 1}</div>
            <div class="card-parchment-text">
              {#if showFrontValue}
                <span class="effect-value">{effectVal}</span>
              {/if}
            </div>
          {:else}
            {#if cardbackUrl}
              <img class="card-front-bg" src={cardbackUrl} alt="" />
            {/if}
            <div class="card-domain-stripe" style="background: {domainColor};"></div>
            <div class="card-front-name">{card.mechanicName ?? card.cardType}</div>
            {#if showFrontValue}
              <div class="card-effect-value">{effectVal}</div>
            {/if}
          {/if}
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

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
    --card-w: calc(var(--gw, 390px) * 0.30);
    --card-h: calc(var(--card-w) * 1.42);
    position: absolute;
    bottom: calc(calc(56px * var(--layout-scale, 1)) + 10vh);
    left: 50%;
    z-index: 20;
    transform: translateX(-50%);
    height: calc(280px * var(--layout-scale, 1));
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
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: visible;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
    font-family: inherit;
    color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    perspective: 800px;
    will-change: transform, opacity;
  }

  .card-has-frame {
    background-color: transparent;
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .card-has-frame.card-playable {
    filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.9)) drop-shadow(0 0 10px rgba(34, 197, 94, 0.4));
  }

  .card-combo {
    filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.9)) drop-shadow(0 0 10px rgba(251, 191, 36, 0.4));
  }

  .card-frame-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
    z-index: 0;
    pointer-events: none;
  }

  .ap-gem {
    position: absolute;
    top: 1%;
    left: 2.5%;
    width: calc(var(--card-w) * 0.18);
    height: calc(var(--card-w) * 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(var(--card-w) * 0.13);
    font-weight: 900;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.6);
    z-index: 2;
    pointer-events: none;
  }

  .card-parchment-text {
    position: absolute;
    top: 66%;
    bottom: 7%;
    left: 8%;
    right: 8%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: 'Georgia', serif;
    font-size: calc(var(--card-w) * 0.095);
    font-weight: 700;
    line-height: 1.3;
    color: #2a1f14;
    -webkit-text-stroke: 0.3px rgba(0,0,0,0.4);
    text-shadow: 0 1px 1px rgba(0,0,0,0.15);
    z-index: 2;
    pointer-events: none;
    overflow: hidden;
  }

  .desc-number {
    font-weight: 900;
    color: #1a1208;
  }

  .desc-keyword {
    font-weight: 900;
  }

  .parchment-inner {
    display: inline;
  }

  .desc-conditional {
    color: #9ca3af;
    font-weight: 700;
  }

  .desc-conditional.active {
    color: #22c55e;
    font-weight: 900;
  }

  .effect-value {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(var(--card-w) * 0.22);
    font-weight: 900;
    color: #3d3428;
    text-shadow: 0 1px 0 rgba(255,255,255,0.3);
    line-height: 1;
  }

  .effect-value.boosted {
    color: #16a34a;
    text-shadow: 0 0 4px rgba(22, 163, 74, 0.4);
  }

  .effect-desc {
    font-size: calc(var(--card-w) * 0.085);
    color: #5c4f3c;
    text-align: center;
    line-height: 1.25;
    max-height: 3em;
    overflow: hidden;
    font-family: 'Cinzel', 'Georgia', serif;
  }

  .card-animating {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    pointer-events: none;
    z-index: 50;
    /* Start at bottom center of hand area */
    left: 50%;
    bottom: calc(40px * var(--layout-scale, 1));
    transform: translateX(-50%);
    will-change: transform, opacity;
  }

  .card-in-hand:active:not(:disabled) {
    transform: scale(1.05);
  }

  .card-playable {
    filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.9)) drop-shadow(0 0 10px rgba(34, 197, 94, 0.4));
  }

  .drag-ready {
    filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.7)) drop-shadow(0 0 24px rgba(34, 197, 94, 0.3)) !important;
  }

  /* AR-62: Card in the Charge zone (above screen-position threshold) */
  .drag-charge-zone {
    filter: drop-shadow(0 0 16px rgba(250, 204, 21, 0.8)) drop-shadow(0 0 32px rgba(250, 204, 21, 0.4)) !important;
    transform-origin: center center;
    scale: 1.05;
  }

  .drag-charge-zone-disabled {
    filter: drop-shadow(0 0 8px rgba(220, 38, 38, 0.6)) drop-shadow(0 0 16px rgba(220, 38, 38, 0.3)) !important;
    scale: 1.0;
  }

  /* AR-62: Charge zone text indicator shown above card when in charge zone */
  .charge-zone-indicator {
    position: absolute;
    top: calc(-36px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 30;
    animation: chargeZoneEnter 120ms ease-out both;
    white-space: nowrap;
  }

  @keyframes chargeZoneEnter {
    from { opacity: 0; transform: translateX(-50%) scale(0.7); }
    to   { opacity: 1; transform: translateX(-50%) scale(1); }
  }

  .charge-zone-text {
    display: block;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #facc15;
    text-shadow:
      0 0 8px rgba(250, 204, 21, 0.9),
      0 0 16px rgba(250, 204, 21, 0.5),
      0 1px 2px rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.55);
    border-radius: 4px;
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(250, 204, 21, 0.4);
  }

  .charge-zone-text-disabled {
    color: #f87171;
    text-shadow:
      0 0 8px rgba(248, 113, 113, 0.7),
      0 1px 2px rgba(0, 0, 0, 0.9);
    border-color: rgba(248, 113, 113, 0.4);
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
    filter: drop-shadow(0 0 6px rgba(192, 192, 192, 0.45));
  }

  .tier-2b {
    filter: drop-shadow(0 0 10px rgba(192, 192, 192, 0.8));
  }

  .tier-3 {
    border-color: #ffd700 !important;
    filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.8));
  }

  .echo-card {
    opacity: 0.65;
    border-style: dashed;
    filter: brightness(1.2) contrast(0.85);
    animation: echo-shimmer 2s ease-in-out infinite;
  }

  .trial-card {
    border-color: #f1c40f !important;
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.65);
  }

  /* AR-59.23: Mastered tier label */
  .card-tier-label--mastered {
    position: absolute;
    bottom: calc(4px * var(--layout-scale, 1));
    left: calc(2px * var(--layout-scale, 1));
    right: calc(2px * var(--layout-scale, 1));
    font-size: calc(9px * var(--layout-scale, 1));
    color: rgba(255, 215, 0, 1);
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-align: center;
    padding: 0 calc(4px * var(--layout-scale, 1));
    pointer-events: none;
    z-index: 2;
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
    overflow: hidden;
    justify-content: flex-start;
  }

  .card-front-bg {
    position: absolute;
    inset: 4px;
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    object-fit: contain;
    object-position: center center;
    border-radius: 6px;
    opacity: 0.42;
    z-index: 0;
    pointer-events: none;
    filter: brightness(0.82) saturate(0.95);
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
    object-fit: contain;
    object-position: center center;
    border-radius: 6px;
    background: #0b1220;
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

  .card-domain-stripe {
    width: 100%;
    height: 4px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }


  .card-front-name {
    position: absolute;
    left: 6px;
    right: 6px;
    top: 28%;
    z-index: 1;
    text-align: center;
    font-size: calc(var(--card-w) * 0.11);
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #f8fafc;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.85);
    line-height: 1.2;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-effect-value {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    font-size: calc(var(--card-w) * 0.30);
    font-weight: 700;
    line-height: 1;
    z-index: 1;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8);
  }

  .card-effect-value.boosted {
    color: #4ade80;
    text-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
  }

  .ap-badge {
    position: absolute;
    top: calc(-4px * var(--layout-scale, 1));
    right: calc(-4px * var(--layout-scale, 1));
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #1e40af;
    color: white;
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #3b82f6;
    z-index: 2;
  }

  .ap-badge.ap-free {
    background: #059669;
    border-color: #10b981;
  }

  .ap-badge.ap-heavy {
    background: #d97706;
    border-color: #f59e0b;
  }

  .ap-badge.ap-full-turn {
    background: #dc2626;
    border-color: #ef4444;
  }

  .card-tier-badge {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    margin-top: auto;
    margin-bottom: calc(3px * var(--layout-scale, 1));
    color: #c0c0c0;
    position: relative;
    z-index: 1;
  }

  .tier-2b .card-tier-badge {
    color: #e4e4e4;
  }

  .tier-3 .card-tier-badge {
    color: #ffd700;
  }

  .trial-badge {
    position: absolute;
    top: calc(5px * var(--layout-scale, 1));
    right: calc(3px * var(--layout-scale, 1));
    font-size: calc(7px * var(--layout-scale, 1));
    font-weight: 800;
    background: rgba(241, 196, 15, 0.9);
    color: #1a1a1a;
    border-radius: 3px;
    padding: calc(1px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1));
  }

  .echo-badge {
    position: absolute;
    top: calc(5px * var(--layout-scale, 1));
    left: calc(3px * var(--layout-scale, 1));
    font-size: calc(7px * var(--layout-scale, 1));
    font-weight: 800;
    color: #d1d5db;
    background: rgba(31, 41, 55, 0.8);
    border-radius: 3px;
    padding: calc(1px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .echo-charge-label {
    display: block;
    font-size: calc(7px * var(--layout-scale, 1));
    color: #c39bd3;
    letter-spacing: 0.03em;
    margin-top: calc(1px * var(--layout-scale, 1));
  }

  /* V2 Echo: golden flash on correct Charge resolve */
  @keyframes echo-correct-flash {
    0%   { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
    40%  { box-shadow: 0 0 calc(18px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.9); }
    100% { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
  }

  @keyframes echo-shimmer {
    0% { opacity: 0.55; }
    50% { opacity: 0.75; }
    100% { opacity: 0.55; }
  }

  .card-fizzle {
    position: fixed !important;
    z-index: 100 !important;
    animation: cardFizzle 400ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes cardFizzle {
    0% {
      opacity: 0.4;
      filter: grayscale(0.5);
    }
    100% {
      transform: translate(
        calc(var(--discard-pile-x, 30px) - 50vw),
        calc(var(--discard-pile-y, 90vh) - 100vh + 40px * var(--layout-scale, 1))
      ) rotate(-8deg) scale(0.05);
      opacity: 0;
      filter: grayscale(1);
    }
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

  /* ═══ NEW ANIMATION PHASES ═══ */

  /* Swoosh base: card stays centered, type-specific pseudo-element overlays */
  .card-swoosh {
    position: fixed !important;
    left: 50% !important;
    top: 45% !important;
    transform: translate(-50%, -50%) scale(1.8) !important;
    z-index: 100 !important;
    pointer-events: none;
  }

  /* Attack swoosh: golden slash from lower-right to upper-left */
  .card-swoosh-attack::after {
    content: '';
    position: absolute;
    inset: -20%;
    background: linear-gradient(
      315deg,
      transparent 30%,
      rgba(255, 215, 0, 0.9) 48%,
      rgba(255, 180, 0, 0.7) 52%,
      transparent 70%
    );
    background-size: 300% 300%;
    animation: swooshSlashAttack 250ms ease-out forwards;
    border-radius: 8px;
    pointer-events: none;
    z-index: 5;
  }
  @keyframes swooshSlashAttack {
    0% { background-position: 100% 100%; opacity: 0; }
    30% { opacity: 1; }
    100% { background-position: 0% 0%; opacity: 0; }
  }

  /* Shield swoosh: blue protective pulse radiating outward */
  .card-swoosh-shield::after {
    content: '';
    position: absolute;
    inset: -10%;
    border: 3px solid rgba(100, 180, 255, 0.8);
    border-radius: 12px;
    animation: swooshPulseShield 250ms ease-out forwards;
    pointer-events: none;
    z-index: 5;
  }
  @keyframes swooshPulseShield {
    0% { transform: scale(0.9); opacity: 0; border-color: rgba(100, 180, 255, 0.9); }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; border-color: rgba(100, 180, 255, 0); }
  }

  /* Buff swoosh: golden energy radiate outward */
  .card-swoosh-buff::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, transparent 70%);
    animation: swooshRadiateBuff 250ms ease-out forwards;
    pointer-events: none;
    border-radius: 8px;
    z-index: 5;
  }
  @keyframes swooshRadiateBuff {
    0% { transform: scale(0.5); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  /* Debuff swoosh: dark tendrils creeping outward */
  .card-swoosh-debuff::after {
    content: '';
    position: absolute;
    inset: -15%;
    background: radial-gradient(ellipse at center,
      rgba(100, 40, 120, 0.7) 0%,
      rgba(60, 20, 80, 0.4) 40%,
      transparent 70%
    );
    animation: swooshCreepDebuff 250ms ease-out forwards;
    mix-blend-mode: multiply;
    pointer-events: none;
    border-radius: 8px;
    z-index: 5;
  }
  @keyframes swooshCreepDebuff {
    0% { transform: scale(0.6); opacity: 0; filter: blur(4px); }
    60% { opacity: 1; }
    100% { transform: scale(1.4); opacity: 0; filter: blur(2px); }
  }

  /* Wild/utility swoosh: prismatic shimmer */
  .card-swoosh-wild::after {
    content: '';
    position: absolute;
    inset: -5%;
    background: linear-gradient(
      45deg,
      rgba(255,0,0,0.5),
      rgba(255,165,0,0.5),
      rgba(255,255,0,0.5),
      rgba(0,255,0,0.5),
      rgba(0,0,255,0.5),
      rgba(128,0,128,0.5)
    );
    background-size: 600% 600%;
    animation: swooshShimmerWild 250ms ease-out forwards;
    mix-blend-mode: screen;
    pointer-events: none;
    border-radius: 8px;
    z-index: 5;
  }
  @keyframes swooshShimmerWild {
    0% { background-position: 0% 50%; opacity: 0; }
    50% { opacity: 0.8; }
    100% { background-position: 100% 50%; opacity: 0; }
  }

  /* Impact base: card moves directionally */
  .card-impact {
    position: fixed !important;
    left: 50% !important;
    top: 45% !important;
    z-index: 100 !important;
    pointer-events: none;
  }

  /* Attack impact: 3D lunge toward enemy (upward) */
  .card-impact-attack {
    animation: impactLungeAttack 300ms ease-in-out forwards;
  }
  @keyframes impactLungeAttack {
    0% { transform: translate(-50%, -50%) scale(1.8) perspective(600px) rotateX(0deg); }
    40% { transform: translate(-50%, -55%) scale(1.9) perspective(600px) rotateX(-8deg); }
    70% { transform: translate(-50%, -62%) scale(1.5) perspective(600px) rotateX(-14deg); opacity: 0.85; }
    100% { transform: translate(-50%, -70%) scale(1.2) perspective(600px) rotateX(-18deg); opacity: 0.5; }
  }

  /* Shield impact: gentle protective rise */
  .card-impact-shield {
    animation: impactRiseShield 300ms ease-out forwards;
  }
  @keyframes impactRiseShield {
    0% { transform: translate(-50%, -50%) scale(1.8); }
    50% { transform: translate(-50%, -54%) scale(1.85); }
    100% { transform: translate(-50%, -58%) scale(1.7); opacity: 0.6; }
  }

  /* Buff impact: power-up expand and glow */
  .card-impact-buff {
    animation: impactExpandBuff 300ms ease-out forwards;
  }
  @keyframes impactExpandBuff {
    0% { transform: translate(-50%, -50%) scale(1.8); box-shadow: 0 0 0 rgba(255, 215, 0, 0); }
    50% { transform: translate(-50%, -52%) scale(1.95); box-shadow: 0 0 40px rgba(255, 215, 0, 0.6); }
    100% { transform: translate(-50%, -48%) scale(1.6); box-shadow: 0 0 0 rgba(255, 215, 0, 0); opacity: 0.5; }
  }

  /* Debuff impact: dissolve into mist toward enemy */
  .card-impact-debuff {
    animation: impactDissolveDebuff 300ms ease-in forwards;
  }
  @keyframes impactDissolveDebuff {
    0% { transform: translate(-50%, -50%) scale(1.8); filter: blur(0); }
    60% { transform: translate(-50%, -56%) scale(1.5); filter: blur(3px); opacity: 0.7; }
    100% { transform: translate(-50%, -62%) scale(1.2); filter: blur(8px); opacity: 0.2; }
  }

  /* Wild impact: prismatic flash morph */
  .card-impact-wild {
    animation: impactMorphWild 300ms ease-in-out forwards;
  }
  @keyframes impactMorphWild {
    0% { transform: translate(-50%, -50%) scale(1.8); filter: hue-rotate(0deg); }
    50% { transform: translate(-50%, -52%) scale(1.9); filter: hue-rotate(180deg); }
    100% { transform: translate(-50%, -55%) scale(1.5); filter: hue-rotate(360deg); opacity: 0.4; }
  }

  /* Discard: minimize and fly to bottom-right */
  .card-discard {
    position: fixed !important;
    z-index: 100 !important;
    animation: discardMinimize 200ms ease-in forwards;
    pointer-events: none;
  }
  @keyframes discardMinimize {
    0% {
      opacity: 0.7;
      transform: scale(1);
    }
    100% {
      transform: translate(
        calc(var(--discard-pile-x, 30px) - 50vw),
        calc(var(--discard-pile-y, 90vh) - 100vh + 40px * var(--layout-scale, 1))
      ) rotate(-10deg) scale(0.05) !important;
      opacity: 0;
    }
  }

  /* ═══ END-OF-TURN HAND DISCARD ANIMATION ═══ */

  .card-hand-discard .card-in-hand {
    animation: cardHandDiscard 300ms ease-in forwards;
    pointer-events: none;
  }

  @keyframes cardHandDiscard {
    0% {
      opacity: 1;
    }
    100% {
      translate: var(--discard-offset-x, -40vw) var(--discard-offset-y, 30vh);
      scale: 0.05;
      rotate: -10deg;
      opacity: 0;
    }
  }

  /* ═══ UPGRADED CARD GLOW ═══ */

  .card-upgraded {
    box-shadow: 0 0 8px 2px rgba(52, 152, 219, 0.5), inset 0 0 4px rgba(52, 152, 219, 0.2);
    border-color: #3498db !important;
  }

  /* ═══ REDUCED MOTION ═══ */

  @media (prefers-reduced-motion: reduce) {
    .card-in-hand {
      animation: none;
      transition: transform 0.1s ease, opacity 0.1s ease;
    }

    .card-swoosh,
    .card-swoosh::after,
    .card-impact,
    .card-discard,
    .card-fizzle,
    .card-tier-up .card-inner,
    .tier-up-overlay,
    .tier-up-overlay::before,
    .tier-up-overlay::after {
      animation: none !important;
    }

    .card-reveal {
      transition: none;
    }

    .card-swoosh-attack::after,
    .card-swoosh-shield::after,
    .card-swoosh-buff::after,
    .card-swoosh-debuff::after,
    .card-swoosh-wild::after {
      display: none;
    }
  }

  /* === CHARGE! button (AR-59.2) === */
  .charge-play-btn {
    position: absolute;
    z-index: 40;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    min-height: calc(40px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    white-space: nowrap;
    animation: chargeBtnPulse 1.2s ease-in-out infinite;
    pointer-events: all;
  }

  .charge-play-btn.charge-btn-disabled {
    background: #4b5563;
    box-shadow: none;
    animation: none;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .charge-ap-badge {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 5px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 5px;
    font-size: 0.75em;
    font-weight: 600;
    vertical-align: middle;
  }

  @keyframes chargeBtnPulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(245, 158, 11, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4); }
    50%       { box-shadow: 0 4px 28px rgba(245, 158, 11, 0.9), 0 2px 8px rgba(0, 0, 0, 0.5); }
  }

  /* === CHARGE PREVIEW — golden number tint when dragging toward charge zone === */
  .charge-preview {
    color: #facc15 !important;
    text-shadow: 0 0 6px rgba(250, 204, 21, 0.6), -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000;
    transition: color 150ms ease;
  }
</style>
