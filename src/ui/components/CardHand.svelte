<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Card, FactDomain } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardbackUrl, onCardbackReady } from '../utils/cardbackManifest'
  import { type CardAnimPhase } from '../utils/mechanicAnimations'
  import { getTierDisplayName } from '../../services/tierDerivation'
  import { getBorderUrl, getBaseFrameUrl, getBannerUrl, getUpgradeIconUrl, getMasteryIconFilter, hasMasteryGlow, GUIDE_STYLES } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { getShortCardDescription } from '../../services/cardDescriptionService'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import { BASE_WIDTH, GAME_ASPECT_RATIO } from '../../data/layout'
  import { audioManager } from '../../services/audioService'
  import { isFirstChargeFree } from '../../services/discoverySystem'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { CHARGE_CORRECT_MULTIPLIER } from '../../data/balance'
  import { getMasteryBaseBonus } from '../../services/cardUpgradeService'
  import { activeRunState } from '../../services/runStateStore'
  import { getChainColor, getChainColorGroups } from '../../services/chainVisuals'
  import { getChainTypeName } from '../../data/chainTypes'
  import ChainIcon from './ChainIcon.svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'
  import { factsDB } from '../../services/factsDB'
  // AR-74: Importing keyboardInput activates the landscape-mode keyboard listener subscription.
  import '../../services/keyboardInput'

  interface Props {
    cards: Card[]
    animatingCards?: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
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
    /** AR-122: True when Chain Momentum is active — next Charge costs +0 AP (surcharge waived). */
    nextChargeFree?: boolean
    /** AR-76: True when quiz is active in landscape — dims the card hand slightly. */
    quizVisible?: boolean
    /** Focus AP discount: 1 when Focus is active with charges, 0 otherwise. Reduces displayed and effective AP cost. */
    focusDiscount?: number
    /** AR-113: mastery flash state — cardId -> 'up' | 'down'. Applied to stat numbers and AP cost. */
    masteryFlashes?: Record<string, 'up' | 'down'>
    /** AR-202: Cure flash state — cardId -> true when a cursed fact was just cured. Triggers gold glow animation. */
    cureFlashes?: Record<string, boolean>
    /** Soul Jar: when true, show "GUARANTEED" label on the Charge button area. */
    showGuaranteed?: boolean
  }

  // Session-level preload guard: avoid creating duplicate Image objects for the same URL.
  const preloadedCardbackUrls = new Set<string>()

  type TierUpTransition = 'tier1_to_2a' | 'tier2a_to_2b' | 'tier2b_to_3'

  let {
    cards,
    animatingCards = [],
    selectedIndex,
    disabled,
    apCurrent,
    cardAnimations,
    tierUpTransitions = {},
    discarding = false,
    onselectcard,
    ondeselectcard,
    oncastdirect,
    onchargeplay,
    isSurgeActive = false,
    nextChargeFree = false,
    quizVisible = false,
    focusDiscount = 0,
    masteryFlashes = {},
    cureFlashes = {},
    showGuaranteed = false,
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
    const spread = total > 6 ? 18 : 24
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

  /** Scale cards down for large hands so each card remains readable. Kicks in above 6 cards. */
  const handScaleFactor = $derived(cards.length > 6 ? Math.max(0.65, 1 - (cards.length - 6) * 0.07) : 1)

  const cardSpacing = $derived.by(() => {
    const total = cards.length
    if (total <= 1) return 0
    const cardW = viewportWidth * 0.30 * handScaleFactor
    const cardH = cardW * 1.42
    // Outer cards are rotated ±(spread/2)° which widens their bounding box
    const spread = total > 6 ? 18 : 24
    const maxRotationRad = (spread / 2) * (Math.PI / 180)
    const rotatedW = cardW * Math.cos(maxRotationRad) + cardH * Math.sin(maxRotationRad)
    const rotationOverhang = rotatedW - cardW
    const maxHandWidth = viewportWidth * 0.92 - rotationOverhang
    // 60% of card width overlap — minimum 44px tap target
    const overlapSpacing = cardW * 0.58
    const minSpacing = 44
    return Math.max(minSpacing, Math.min(overlapSpacing, Math.floor((maxHandWidth - cardW) / (total - 1))))
  })

  function getXOffset(index: number, total: number): number {
    const totalWidth = cardSpacing * (total - 1)
    return -totalWidth / 2 + cardSpacing * index
  }

  function getEffectValue(card: Card, chargeMode: boolean = false): number {
    const mechanic = getMechanicDefinition(card.mechanicId)
    if (mechanic) {
      const baseVal = chargeMode ? Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER) : mechanic.quickPlayValue
      const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0)
      return baseVal + masteryBonus
    }
    return Math.round(card.baseEffectValue * card.effectMultiplier)
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

  function getTierBadge(card: Card): string {
    if (card.tier === '1') return ''
    return getTierDisplayName(card.tier)
  }

  function hasEnoughAp(card: Card): boolean {
    return Math.max(0, (card.apCost ?? 1) - focusDiscount) <= apCurrent
  }

  /** Returns the displayed AP cost accounting for Focus discount. */
  function getDisplayedApCost(card: Card): number {
    return Math.max(0, (card.apCost ?? 1) - focusDiscount)
  }

  /** Returns color for the AP gem based on cost change. Green if reduced, red if increased, off-white otherwise. */
  function getApGemColor(card: Card): string {
    const base = card.apCost ?? 1
    const displayed = getDisplayedApCost(card)
    if (displayed < base) return '#22c55e'
    if (displayed > base) return '#ef4444'
    return '#fbbf24'
  }

  function getDomainColor(domain: FactDomain): string {
    return getDomainMetadata(domain).colorTint
  }

  let hoveredIndex = $state<number | null>(null)

  /** §9 Landscape-only: right-click card detail popup state. */
  let cardDetailCard = $state<Card | null>(null)
  let cardDetailVisible = $state(false)

  function showCardDetail(card: Card): void {
    cardDetailCard = card
    cardDetailVisible = true
  }

  function hideCardDetail(): void {
    cardDetailVisible = false
    cardDetailCard = null
  }

  /** Auto-close card detail when hand is disabled (quiz starts) */
  $effect(() => {
    if (disabled && cardDetailVisible) {
      hideCardDetail()
    }
  })

  /** H-9: Dismiss charge hint when card is deselected. */
  $effect(() => {
    if (selectedIndex === null && showChargeHint) {
      dismissChargeHint()
    }
  })

  /** True while the player hovers or presses the CHARGE button — triggers a green charge preview on the selected card. */
  let chargePreviewActive = $state(false)

  /** H-9: Show drag-to-charge hint in portrait on first card selection. */
  let showChargeHint = $state(false)
  let chargeHintTimer: ReturnType<typeof setTimeout> | null = null

  function maybeShowChargeHint(): void {
    if ($isLandscape) return
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hint:chargeDragSeen')) return
    showChargeHint = true
    if (chargeHintTimer !== null) clearTimeout(chargeHintTimer)
    chargeHintTimer = setTimeout(() => {
      showChargeHint = false
      chargeHintTimer = null
    }, 3000)
  }

  function dismissChargeHint(): void {
    showChargeHint = false
    if (chargeHintTimer !== null) {
      clearTimeout(chargeHintTimer)
      chargeHintTimer = null
    }
  }

  /** Called after a successful charge play — marks hint as seen. */
  function markChargeDragSeen(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hint:chargeDragSeen', '1')
    }
    dismissChargeHint()
  }

  let dragState = $state<{
    cardIndex: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    pointerId: number
  } | null>(null)

  /** Screen-position ratio from top of viewport that divides Quick Play zone (below) from Charge zone (above).
   * AR-101: Lowered from 0.40 → 0.55 so players don't need to drag as far up to trigger Charge. */
  const CHARGE_ZONE_Y_RATIO = 0.55

  let dragDeltaX = $derived(dragState ? dragState.currentX - dragState.startX : 0)
  let dragDeltaY = $derived(dragState ? Math.max(0, dragState.startY - dragState.currentY) : 0)
  let dragRawDeltaY = $derived(dragState ? dragState.startY - dragState.currentY : 0)
  let dragScale = $derived(1 + Math.min(0.15, dragDeltaY / 500))
  let isDragPastThreshold = $derived(dragDeltaY > 60)
  let isDragPreview = $derived(dragDeltaY > 40)
  /**
   * True when the dragged card's current Y position is ABOVE the screen-position threshold.
   * Uses 45% on small screens (viewport < 600px height), 55% otherwise.
   * AR-101: Raised from 35%/40% → 45%/55% so charge triggers lower on screen (easier to reach).
   * Replaces the old 80px drag-distance check for Charge vs Quick Play decision.
   */
  let isInChargeZone = $derived.by(() => {
    if (!dragState) return false
    const ratio = window.innerHeight < 600 ? 0.45 : CHARGE_ZONE_Y_RATIO
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

  onMount(() => {
    const onResize = (): void => {
      viewportWidth = Math.min(window.innerWidth, window.innerHeight * GAME_ASPECT_RATIO)
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
    }
  })

  // AR-74: Register inputService handlers for keyboard shortcuts (landscape only).
  // These map keyboard GameActions to the same functions that pointer handlers call.
  let kbdUnsubscribers: Array<() => void> = []

  $effect(() => {
    // Clean up previous subscriptions on re-mount or effect re-run
    for (const unsub of kbdUnsubscribers) unsub()
    kbdUnsubscribers = []

    kbdUnsubscribers.push(
      inputService.on('SELECT_CARD', (action) => {
        if (action.type !== 'SELECT_CARD') return
        if (!$isLandscape) return
        if (disabled) return
        if (action.index >= 0 && action.index < cards.length) {
          onselectcard(action.index)
        }
      })
    )

    kbdUnsubscribers.push(
      inputService.on('DESELECT', () => {
        if (!$isLandscape) return
        // Dismiss card detail modal if open, otherwise deselect card
        if (cardDetailVisible) {
          hideCardDetail()
        } else {
          ondeselectcard()
        }
      })
    )
  })

  onDestroy(() => {
    for (const unsub of kbdUnsubscribers) unsub()
    kbdUnsubscribers = []
    if (dragFrameId !== null) {
      cancelAnimationFrame(dragFrameId)
      dragFrameId = null
    }
    pendingDragPoint = null
    if (chargeHintTimer !== null) {
      clearTimeout(chargeHintTimer)
      chargeHintTimer = null
    }
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

  // Chain pulse groups: cards sharing a chainType (2+ cards = pulse together)
  let chainPulseCardIds = $derived.by(() => {
    const groups = getChainColorGroups(cards)
    const pulsingIds = new Set<string>()
    for (const ids of groups.values()) {
      for (const id of ids) pulsingIds.add(id)
    }
    return pulsingIds
  })

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
      // Check affordability: if charge can't be paid, return card to hand (no silent Quick Play)
      const card = cards[index]
      const chargeApCost = (card?.apCost ?? 1) + (isSurgeActive || nextChargeFree ? 0 : 1)
      const canAffordCharge = card && card.tier !== '3' && chargeApCost <= apCurrent
      if (canAffordCharge && onchargeplay) {
        markChargeDragSeen()
        onchargeplay(index)
      } else if (onchargeplay && !canAffordCharge) {
        // Can't afford charge — return card to hand (no silent Quick Play)
        onselectcard(index)
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
      // Tap (minimal movement) — normal select behavior; show charge hint in portrait
      maybeShowChargeHint()
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

  // DEBUG: log chain types
  $effect(() => {
    if (cards.length > 0) {
      console.log('[CardHand DEBUG] Chain types:', cards.map((c, i) => `${i}:${c.mechanicName}=chain${c.chainType}`).join(', '))
    }
  })

</script>

{#if $isLandscape}
<!-- AR-73: Landscape card hand — full viewport width bottom strip -->
<div class="card-hand-landscape" class:card-hand-discard={discarding} class:card-hand-quiz-dimmed={quizVisible && $isLandscape} role="group" aria-label="Card hand" style="--hand-scale: {handScaleFactor}">
  {#each cards as card, i (card.id)}
    <!-- debug removed -->
    {@const isSelected = selectedIndex === i}
    {@const isOther = selectedIndex !== null && !isSelected}
    {@const domainColor = getDomainColor(card.domain)}
    {@const showFrontValue = shouldShowFrontValue(card)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const tierBadge = getTierBadge(card)}
    {@const apCost = card.apCost ?? 1}
    {@const displayedApCost = getDisplayedApCost(card)}
    {@const apGemColor = getApGemColor(card)}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const isHovered = hoveredIndex === i && !isSelected && !isOther && selectedIndex === null}
    {@const isDraggingThis = dragState?.cardIndex === i}
    {@const cardDragX = isDraggingThis ? dragDeltaX : 0}
    {@const cardDragRawY = isDraggingThis ? dragRawDeltaY : 0}
    {@const cardDragScale = isDraggingThis ? dragScale : 1}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}
    {@const runState = $activeRunState}
    {@const isMastered = card.tier === '3'}
    {@const chargeApCostForDrag = Math.max(0, (card.apCost ?? 1) - focusDiscount) + (isSurgeActive || nextChargeFree ? 0 : 1)}
    {@const chargeAffordableForDrag = chargeApCostForDrag <= apCurrent}
    {@const showChargeZoneIndicator = isDraggingThis && isInChargeZone && !isMastered && !!onchargeplay}
    {@const isDragInChargeZone = isDraggingThis && isInChargeZone && !isMastered}
    {@const chargeProgress = isDraggingThis && dragState ? (() => {
      const startY = dragState.startY
      const ratio = window.innerHeight < 600 ? 0.45 : CHARGE_ZONE_Y_RATIO
      const chargeZoneY = window.innerHeight * ratio
      const totalDistance = startY - chargeZoneY
      if (totalDistance <= 0) return 0
      const currentDistance = startY - dragState.currentY
      return Math.max(0, Math.min(1, currentDistance / totalDistance))
    })() : 0}
    {@const isChargePreview = (chargeProgress >= 1.0 || (chargePreviewActive && isSelected)) && !isMastered}
    {@const isBtnChargePreview = chargePreviewActive && isSelected && !isMastered && chargeProgress <= 0.3}
    {@const effectVal = getEffectValue(card, isChargePreview)}

    <button
      class="card-in-hand card-landscape"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:tier-2a={card.tier === '2a'}
      class:tier-2b={card.tier === '2b'}
      class:tier-3={card.tier === '3'}
      class:echo-card={false}
      class:trial-card={card.isMasteryTrial}
      class:insufficient-ap={insufficientAp}
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      class:card-reveal={isAnimating}
      class:card-tier-up={isTierUp}
      class:card-swoosh={isSwoosh}
      class:card-impact={isImpact}
      class:drag-ready={isDragPastThreshold && isDraggingThis && !isDragInChargeZone}
      class:drag-charge-zone={isDragInChargeZone}
      class:drag-charge-zone-disabled={isDragInChargeZone && !chargeAffordableForDrag}
      class:card--cursed={card.isCursed && !cureFlashes[card.id]}
      class:card--curing={cureFlashes[card.id]}
      style="
        {isAnimating ? '' : isDraggingThis
          ? `transform: translate3d(${cardDragX}px, ${isSelected ? 'calc(-27vh - 36px + 20px)' : `-${cardDragRawY}px`}, 0) scale(${cardDragScale});`
          : `transform: translate3d(0, ${isSelected ? 'calc(-27vh - 36px + 20px)' : '0px'}, 0) scale(${isSelected ? 1.1 : isHovered ? 1.05 : 1});`}
        animation-delay: {i * 60}ms;
        opacity: {isOther ? 0.35 : 1};
        z-index: {isDraggingThis ? 20 : isHovered ? 10 : ''};
        {isDraggingThis && chargeProgress > 0.05 ? `filter: drop-shadow(0 0 ${8 + chargeProgress * 8}px rgba(250, 204, 21, ${chargeProgress * 0.8})) drop-shadow(0 0 ${16 + chargeProgress * 16}px rgba(250, 204, 21, ${chargeProgress * 0.4}));` : ''}
      "
      data-testid="card-hand-{i}"
      aria-label="{card.mechanicName}: costs {card.apCost ?? 1} AP, {getShortCardDescription(card)}. Card {i + 1} of {cards.length}."
      disabled={disabled || isOther}
      use:initCardAnimOffsets
      onpointerdown={(e) => handlePointerDown(e, i)}
      onpointermove={(e) => handlePointerMove(e)}
      onpointerup={(e) => handlePointerUp(e)}
      onpointercancel={(e) => handlePointerCancel(e)}
      onpointerenter={(e) => handlePointerEnter(e, i)}
      onpointerleave={handlePointerLeave}
      oncontextmenu={(e) => { e.preventDefault(); showCardDetail(card); }}
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          <!-- V2 layered frame system -->
          <div class="card-v2-frame">
            <!-- Layer 1: Border (by card type) -->
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" />
            <!-- Layer 1.5: Card art in pentagon window (behind base frame mask) -->
            {#if card.mechanicId}
              {@const artUrl = getCardArtUrl(card.mechanicId)}
              {#if artUrl}
                <img class="frame-card-art" src={artUrl} alt="" />
              {/if}
            {/if}
            <!-- Layer 2: Base frame (constant) -->
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" />
            <!-- Layer 3: Banner (by chain type) -->
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" />
            <!-- Layer 4: Upgrade icon (conditional, float animation) -->
            {#if (card.masteryLevel ?? 0) > 0}
              <img
                class="frame-layer upgrade-icon mastery-bob"
                class:mastery-glow={hasMasteryGlow(card.masteryLevel ?? 0)}
                src={getUpgradeIconUrl()}
                alt=""
                style="filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
              />
            {/if}
            <!-- AP cost overlay -->
            <div class="frame-text v2-ap-cost" class:mastery-flash-up={masteryFlashes[card.id] === 'up'} class:mastery-flash-down={masteryFlashes[card.id] === 'down'} style={GUIDE_STYLES.apCost} style:color={apGemColor}>{displayedApCost}</div>
            <!-- Mechanic name overlay -->
            <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName}>{card.mechanicName ?? ''}</div>
            <!-- Card type label overlay -->
            <div class="frame-text v2-card-type" style={GUIDE_STYLES.cardType}><span class="card-type-icon">{card.cardType === 'attack' ? '⚔' : card.cardType === 'shield' ? '🛡' : '✦'}</span> {card.cardType?.toUpperCase() ?? ''}</div>
            <!-- Effect description text -->
            <div class="frame-text v2-effect-text" style={GUIDE_STYLES.effectText}>
              <span class="parchment-inner">
                {#each getCardDescriptionParts(card, undefined, isChargePreview ? getEffectValue(card, true) : undefined) as part}
                  {#if part.type === 'number'}
                    <span class="desc-number" class:charge-preview={isChargePreview && !isBtnChargePreview} class:charge-preview-btn={isBtnChargePreview} class:mastery-flash-up={masteryFlashes[card.id] === 'up'} class:mastery-flash-down={masteryFlashes[card.id] === 'down'}>{part.value}</span>
                  {:else if part.type === 'keyword'}
                    <span class="desc-keyword">{part.value}</span>
                  {:else if part.type === 'conditional-number'}
                    <span class="desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                  {:else if part.type === 'mastery-bonus'}
                    <span class="desc-mastery-bonus">{part.value}</span>
                  {:else}
                    {part.value}
                  {/if}
                {/each}
              </span>
            </div>
          </div>
          {#if card.isMasteryTrial}
            <div class="trial-badge">TRIAL</div>
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
          style="
            --tier-hue: {tierVisual.hue};
            --spark-x: {tierVisual.sparkX}%;
            --spark-y: {tierVisual.sparkY}%;
            --spark-spin: {tierVisual.spinDeg}deg;
            --spark-intensity: {tierVisual.intensity};
          "
        ></div>
      {/if}

      {#if isSelected && $isLandscape}
        <div class="card-quickplay-hint" aria-hidden="true">Tap again = quick play</div>
      {/if}

      {#if showChargeZoneIndicator}
        <div
          class="charge-zone-indicator"
          class:charge-zone-indicator-disabled={!chargeAffordableForDrag}
        >
          {#if !chargeAffordableForDrag}
            <span class="charge-zone-text charge-zone-text-disabled">NOT ENOUGH AP</span>
          {:else if showGuaranteed}
            <span class="charge-zone-text guaranteed-active">✦ GUARANTEED ✦</span>
          {:else}
            <span class="charge-zone-text" class:momentum-active={nextChargeFree && !isSurgeActive}>⚡ CHARGE {isSurgeActive || nextChargeFree ? '+0' : '+1'} AP{nextChargeFree && !isSurgeActive ? ' ⚡' : ''}</span>
          {/if}
        </div>
      {/if}
    </button>

    {#if selectedIndex === i && card.tier !== '3' && (card.masteryLevel ?? 0) < 5 && onchargeplay && !disabled}
      {@const chargeApCost = Math.max(0, (card.apCost ?? 1) - focusDiscount) + (isSurgeActive || nextChargeFree ? 0 : 1)}
      {@const chargeAffordable = chargeApCost <= apCurrent}
      <button
        class="charge-play-btn charge-play-btn-landscape"
        class:charge-btn-disabled={!chargeAffordable}
        disabled={!chargeAffordable}
        title={!chargeAffordable ? 'Not enough AP' : 'Charge — answer a quiz for bonus power'}
        onclick={() => onchargeplay!(i)}
        onmouseenter={() => { if (chargeAffordable) chargePreviewActive = true }}
        onmouseleave={() => { chargePreviewActive = false }}
        ontouchstart={() => { if (chargeAffordable) chargePreviewActive = true }}
        ontouchend={() => { chargePreviewActive = false }}
        ontouchcancel={() => { chargePreviewActive = false }}
      >
        {#if showGuaranteed}
          ✦ GUARANTEED
        {:else}
          ⚡ CHARGE
          <span class="charge-ap-badge" class:momentum-active={nextChargeFree && !isSurgeActive}>{isSurgeActive || nextChargeFree ? '+0' : '+1'} AP</span>
        {/if}
      </button>
    {/if}

    <!-- Landscape hover tooltip -->
    {#if isHovered && selectedIndex === null}
      {@const chainName = card.chainType !== undefined ? getChainTypeName(card.chainType) : null}
      {@const chainTypeVal = card.chainType ?? 0}
      <div
        class="card-hover-tooltip card-hover-tooltip-landscape"
        role="tooltip"
      >
        {#if (card.mechanicName ?? card.mechanicId)}
          <span class="tooltip-mechanic">{card.mechanicName ?? card.cardType}</span>
        {/if}
        <span class="tooltip-cost">{card.apCost ?? 1} AP</span>
        {#if chainName}
          <span class="tooltip-chain" style="color: {getChainColor(card.chainType)}">
            <ChainIcon chainType={chainTypeVal} size={12} />
            {chainName}
          </span>
        {/if}
      </div>
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
    {@const tierVisual = getTierUpVisualSignature(card.factId)}

    <div
      class="card-in-hand card-has-frame card-landscape card-animating"
      class:card-reveal={isAnimating}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      use:ghostCardAnim
      class:card-tier-up={isTierUp}
      class:card-swoosh={isSwoosh}
      class:card-impact={isImpact}
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          <!-- V2 layered frame system -->
          <div class="card-v2-frame">
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" />
            {#if card.mechanicId}
              {@const artUrl = getCardArtUrl(card.mechanicId)}
              {#if artUrl}
                <img class="frame-card-art" src={artUrl} alt="" />
              {/if}
            {/if}
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" />
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" />
            {#if (card.masteryLevel ?? 0) > 0}
              <img
                class="frame-layer upgrade-icon mastery-bob"
                class:mastery-glow={hasMasteryGlow(card.masteryLevel ?? 0)}
                src={getUpgradeIconUrl()}
                alt=""
                style="filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
              />
            {/if}
            <div class="frame-text v2-ap-cost" style={GUIDE_STYLES.apCost}>{card.apCost ?? 1}</div>
            <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName}>{card.mechanicName ?? ''}</div>
            <div class="frame-text v2-card-type" style={GUIDE_STYLES.cardType}><span class="card-type-icon">{card.cardType === 'attack' ? '⚔' : card.cardType === 'shield' ? '🛡' : '✦'}</span> {card.cardType?.toUpperCase() ?? ''}</div>
          </div>
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

  <!-- §9 Landscape: right-click card detail modal -->
  {#if cardDetailVisible && cardDetailCard}
    {@const detailCard = cardDetailCard}
    {@const chainName = detailCard.chainType !== undefined ? getChainTypeName(detailCard.chainType) : null}
    {@const chainTypeVal = detailCard.chainType ?? 0}
    {@const mechanic = getMechanicDefinition(detailCard.mechanicId ?? '')}
    {@const tierLabel = detailCard.tier === '1' ? 'Learning' : detailCard.tier === '2a' || detailCard.tier === '2b' ? 'Proven' : 'Mastered'}
    {@const fact = factsDB.isReady() ? factsDB.getById(detailCard.factId) : null}
    <button
      class="card-detail-backdrop"
      onclick={hideCardDetail}
      onkeydown={(e) => { if (e.key === 'Escape') hideCardDetail() }}
      aria-label="Close card details"
    ></button>
    <div class="card-detail-modal" role="dialog" aria-label="Card details" aria-modal="true">
      <div class="card-detail-header" style="border-color: {getChainColor(chainTypeVal)}">
        <span class="card-detail-name">{detailCard.mechanicName ?? detailCard.cardType}</span>
        {#if chainName}
          <span class="card-detail-chain" style="color: {getChainColor(chainTypeVal)}">
            <ChainIcon chainType={chainTypeVal} size={14} />
            {chainName}
          </span>
        {/if}
      </div>
      <div class="card-detail-tier">
        <span class="card-detail-tier-label">{tierLabel}</span>
        <span class="card-detail-ap">{detailCard.apCost ?? 1} AP</span>
      </div>
      {#if mechanic?.description}
        <div class="card-detail-mechanic">{mechanic.description}</div>
      {/if}
      {#if fact?.quizQuestion}
        <div class="card-detail-question-label">Question</div>
        <div class="card-detail-question">{fact.quizQuestion}</div>
      {:else if fact?.statement}
        <div class="card-detail-question-label">Fact</div>
        <div class="card-detail-question">{fact.statement}</div>
      {/if}
      <button class="card-detail-close" onclick={hideCardDetail} aria-label="Close">✕</button>
    </div>
  {/if}
</div>
{:else}
<!-- Portrait card hand — UNCHANGED from pre-AR-73 -->
<div class="card-hand-container" class:card-hand-discard={discarding} role="group" aria-label="Card hand" style="--card-w: calc(var(--gw, 390px) * {0.30 * handScaleFactor})">
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
    {@const displayedApCost = getDisplayedApCost(card)}
    {@const apGemColor = getApGemColor(card)}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
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
    {@const chargeApCostForDrag = Math.max(0, (card.apCost ?? 1) - focusDiscount) + (isSurgeActive || nextChargeFree ? 0 : 1)}
    {@const chargeAffordableForDrag = chargeApCostForDrag <= apCurrent}
    {@const showChargeZoneIndicator = isDraggingThis && isInChargeZone && !isMastered && !!onchargeplay}
    {@const isDragInChargeZone = isDraggingThis && isInChargeZone && !isMastered}
    {@const chargeProgress = isDraggingThis && dragState ? (() => {
      const startY = dragState.startY
      const ratio = window.innerHeight < 600 ? 0.45 : CHARGE_ZONE_Y_RATIO
      const chargeZoneY = window.innerHeight * ratio
      const totalDistance = startY - chargeZoneY
      if (totalDistance <= 0) return 0
      const currentDistance = startY - dragState.currentY
      return Math.max(0, Math.min(1, currentDistance / totalDistance))
    })() : 0}
    {@const isChargePreview = (chargeProgress >= 1.0 || (chargePreviewActive && isSelected)) && !isMastered}
    {@const isBtnChargePreview = chargePreviewActive && isSelected && !isMastered && chargeProgress <= 0.3}
    {@const effectVal = getEffectValue(card, isChargePreview)}
    {@const descPower = isChargePreview ? getEffectValue(card, true) : undefined}

    <button
      class="card-in-hand card-has-frame"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:tier-2a={card.tier === '2a'}
      class:tier-2b={card.tier === '2b'}
      class:tier-3={card.tier === '3'}
      class:echo-card={false}
      class:trial-card={card.isMasteryTrial}
      class:insufficient-ap={insufficientAp}
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
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
      class:card--cursed={card.isCursed && !cureFlashes[card.id]}
      class:card--curing={cureFlashes[card.id]}
      style="
        {isAnimating ? '' : isDraggingThis ? `transform: translate3d(${xOffset + cardDragX}px, ${(isSelected ? -80 : -arcOffset) - cardDragRawY}px, 0) rotate(0deg) scale(${cardDragScale});` : `transform: translate3d(${xOffset}px, ${isSelected ? -80 : isOther ? 15 : -(arcOffset + hoverLift)}px, 0) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.2 : hoverScale});`}
        animation-delay: {i * 80}ms;
        opacity: {isOther ? 0.3 : 1};
        z-index: {isDraggingThis ? 20 : isHovered ? 10 : ''};
        {isDraggingThis && chargeProgress > 0.05 ? `filter: drop-shadow(0 0 ${8 + chargeProgress * 8}px rgba(250, 204, 21, ${chargeProgress * 0.8})) drop-shadow(0 0 ${16 + chargeProgress * 16}px rgba(250, 204, 21, ${chargeProgress * 0.4}));` : ''}
      "
      data-testid="card-hand-{i}"
      aria-label="{card.mechanicName}: costs {card.apCost ?? 1} AP, {getShortCardDescription(card)}. Card {i + 1} of {cards.length}."
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
          <!-- V2 layered frame system -->
          <div class="card-v2-frame">
            <!-- Layer 1: Border (by card type) -->
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" />
            <!-- Layer 1.5: Card art in pentagon window (behind base frame mask) -->
            {#if card.mechanicId}
              {@const artUrl = getCardArtUrl(card.mechanicId)}
              {#if artUrl}
                <img class="frame-card-art" src={artUrl} alt="" />
              {/if}
            {/if}
            <!-- Layer 2: Base frame (constant) -->
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" />
            <!-- Layer 3: Banner (by chain type) -->
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" />
            <!-- Layer 4: Upgrade icon (conditional, float animation) -->
            {#if (card.masteryLevel ?? 0) > 0}
              <img
                class="frame-layer upgrade-icon mastery-bob"
                class:mastery-glow={hasMasteryGlow(card.masteryLevel ?? 0)}
                src={getUpgradeIconUrl()}
                alt=""
                style="filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
              />
            {/if}
            <!-- AP cost overlay -->
            <div class="frame-text v2-ap-cost" class:mastery-flash-up={masteryFlashes[card.id] === 'up'} class:mastery-flash-down={masteryFlashes[card.id] === 'down'} style={GUIDE_STYLES.apCost} style:color={apGemColor}>{displayedApCost}</div>
            <!-- Mechanic name overlay -->
            <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName}>{card.mechanicName ?? ''}</div>
            <!-- Card type label overlay -->
            <div class="frame-text v2-card-type" style={GUIDE_STYLES.cardType}><span class="card-type-icon">{card.cardType === 'attack' ? '⚔' : card.cardType === 'shield' ? '🛡' : '✦'}</span> {card.cardType?.toUpperCase() ?? ''}</div>
            <!-- Effect description text -->
            <div class="frame-text v2-effect-text" style={GUIDE_STYLES.effectText}>
              <span class="parchment-inner">
                {#each getCardDescriptionParts(card, undefined, descPower) as part}
                  {#if part.type === 'number'}
                    <span class="desc-number" class:charge-preview={isChargePreview && !isBtnChargePreview} class:charge-preview-btn={isBtnChargePreview} class:mastery-flash-up={masteryFlashes[card.id] === 'up'} class:mastery-flash-down={masteryFlashes[card.id] === 'down'}>{part.value}</span>
                  {:else if part.type === 'keyword'}
                    <span class="desc-keyword">{part.value}</span>
                  {:else if part.type === 'conditional-number'}
                    <span class="desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                  {:else if part.type === 'mastery-bonus'}
                    <span class="desc-mastery-bonus">{part.value}</span>
                  {:else}
                    {part.value}
                  {/if}
                {/each}
              </span>
            </div>
          </div>
          {#if card.isMasteryTrial}
            <div class="trial-badge">TRIAL</div>
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
          {:else if showGuaranteed}
            <span class="charge-zone-text guaranteed-active">✦ GUARANTEED ✦</span>
          {:else}
            <span class="charge-zone-text" class:momentum-active={nextChargeFree && !isSurgeActive}>⚡ CHARGE {isSurgeActive || nextChargeFree ? '+0' : '+1'} AP{nextChargeFree && !isSurgeActive ? ' ⚡' : ''}</span>
          {/if}
        </div>
      {/if}

      <!-- H-9: Drag-to-charge hint — portrait only, first selection, auto-dismisses after 3s -->
      {#if isSelected && showChargeHint && !$isLandscape}
        <div class="charge-drag-hint" aria-hidden="true">Drag up to Charge (1.5x)</div>
      {/if}
    </button>

    {#if selectedIndex === i && card.tier !== '3' && (card.masteryLevel ?? 0) < 5 && onchargeplay && !disabled}
      {@const chargeApCost = Math.max(0, (card.apCost ?? 1) - focusDiscount) + (isSurgeActive || nextChargeFree ? 0 : 1)}
      {@const chargeAffordable = chargeApCost <= apCurrent}
      <button
        class="charge-play-btn"
        class:charge-btn-disabled={!chargeAffordable}
        disabled={!chargeAffordable}
        title={!chargeAffordable ? 'Not enough AP' : 'Charge — answer a quiz for bonus power'}
        onclick={() => onchargeplay!(i)}
        onmouseenter={() => { if (chargeAffordable) chargePreviewActive = true }}
        onmouseleave={() => { chargePreviewActive = false }}
        ontouchstart={() => { if (chargeAffordable) chargePreviewActive = true }}
        ontouchend={() => { chargePreviewActive = false }}
        ontouchcancel={() => { chargePreviewActive = false }}
        style="transform: translate3d({xOffset}px, calc(-80px - var(--card-h) - 8px), 0); width: calc(var(--card-w) * 1.2);"
      >
        CHARGE
        <span class="charge-ap-badge" class:momentum-active={nextChargeFree && !isSurgeActive}>{isSurgeActive || nextChargeFree ? '+0' : '+1'} AP</span>
      </button>
    {/if}

    <!-- AR-74: Mouse hover tooltip for landscape mode -->
    {#if isHovered && $isLandscape && selectedIndex === null}
      {@const chainName = card.chainType !== undefined ? getChainTypeName(card.chainType) : null}
      {@const chainTypeVal = card.chainType ?? 0}
      {@const mechanic = getMechanicDefinition(card.mechanicId ?? '')}
      <div
        class="card-hover-tooltip"
        style="transform: translate3d({xOffset}px, calc(-80px - var(--card-h) - 8px), 0) translateX(-50%);"
        role="tooltip"
      >
        {#if mechanic?.name}
          <span class="tooltip-mechanic">{mechanic.name}</span>
        {/if}
        <span class="tooltip-cost">{card.apCost ?? 1} AP</span>
        {#if chainName}
          <span class="tooltip-chain" style="color: {getChainColor(card.chainType)}">
            <ChainIcon chainType={chainTypeVal} size={12} />
            {chainName}
          </span>
        {/if}
      </div>
    {/if}
  {/each}

  <!-- H-10: Charge zone threshold line — visible during active drag in portrait -->
  {#if dragState && isDragPreview}
    <div class="charge-threshold-line" style="top: {typeof window !== 'undefined' && window.innerHeight < 600 ? 45 : 55}%;">
      <span class="threshold-label">CHARGE</span>
    </div>
  {/if}

  {#each animatingCards as card (card.id)}
    {@const cardAnim = cardAnimations?.[card.id] ?? null}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const tierUpTransition = tierUpTransitions[card.id] ?? null}
    {@const tierVisual = getTierUpVisualSignature(card.factId)}

    <div
      class="card-in-hand card-has-frame card-animating"
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
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          <!-- V2 layered frame system -->
          <div class="card-v2-frame">
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" />
            {#if card.mechanicId}
              {@const artUrl = getCardArtUrl(card.mechanicId)}
              {#if artUrl}
                <img class="frame-card-art" src={artUrl} alt="" />
              {/if}
            {/if}
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" />
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" />
            {#if (card.masteryLevel ?? 0) > 0}
              <img
                class="frame-layer upgrade-icon mastery-bob"
                class:mastery-glow={hasMasteryGlow(card.masteryLevel ?? 0)}
                src={getUpgradeIconUrl()}
                alt=""
                style="filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
              />
            {/if}
            <div class="frame-text v2-ap-cost" style={GUIDE_STYLES.apCost}>{card.apCost ?? 1}</div>
            <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName}>{card.mechanicName ?? ''}</div>
            <div class="frame-text v2-card-type" style={GUIDE_STYLES.cardType}><span class="card-type-icon">{card.cardType === 'attack' ? '⚔' : card.cardType === 'shield' ? '🛡' : '✦'}</span> {card.cardType?.toUpperCase() ?? ''}</div>
          </div>
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
{/if}

<style>
  /* ── AR-73: Landscape card hand ──────────────────────────── */
  .card-hand-landscape {
    /* Card height = 80% of 27vh strip, scaled down for large hands via --hand-scale (set by JS handScaleFactor).
       Width derived from height via aspect ratio (1.42 tall : 1 wide → invert).
       --hand-scale defaults to 1 (≤6 cards) and shrinks toward 0.65 for 10+ cards. */
    --hand-scale: 1;
    --card-h: calc(27vh * 0.80 * var(--hand-scale));
    --card-w: calc(var(--card-h) / 1.42);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Spec: card hand strip = 27% of viewport height */
    height: 27vh;
    z-index: 20;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    gap: calc(8px * var(--hand-scale));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);
    pointer-events: none;
  }

  /* AR-91: Override .card-in-hand's position:absolute so flex layout
     distributes landscape cards correctly in the flex row */
  .card-hand-landscape .card-landscape {
    position: relative !important;
  }

  /* AR-94: Selected card rises visually above others in landscape */
  .card-hand-landscape .card-landscape.card-selected {
    z-index: 25;
    filter: drop-shadow(0 -4px 12px rgba(255, 255, 255, 0.25));
  }

  /* Landscape: subtle hint text on risen selected card */
  .card-quickplay-hint {
    position: absolute;
    bottom: calc(-18px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    pointer-events: none;
    letter-spacing: 0.03em;
  }

  .card-landscape {
    position: relative;
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
    /* §7 spec: deselected return = 120ms ease-in; hover = 100ms ease */
    transition: transform 120ms ease-in, opacity 200ms ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
    font-family: inherit;
    color: white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
    perspective: 800px;
    will-change: transform, opacity;
    flex-shrink: 0;
  }

  /* §7 spec: card selected rise = 150ms ease-out */
  .card-landscape.card-selected {
    transition: transform 150ms ease-out, opacity 200ms ease;
  }

  /* §9 spec: hover enlarge — 1.05x scale, 100ms ease; only when no card is selected */
  .card-hand-landscape:not(:has(.card-selected)) .card-landscape:hover:not(.card-dimmed) {
    z-index: 10;
  }

  .charge-play-btn-landscape {
    position: absolute;
    /* Position above the risen card: card rises calc(-27vh - 36px + 20px) from hand strip.
       Place button bottom at calc(27vh + var(--card-h) + 34px) from the container bottom,
       which puts it ~8px above the risen card's top edge. */
    bottom: calc(27vh + var(--card-h) + 34px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    /* §7 spec: charge button appear = 100ms fade-in */
    animation: chargeBtnAppear 100ms ease-out both, chargeBtnPulse 1.2s ease-in-out 100ms infinite;
  }

  @keyframes chargeBtnAppear {
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .card-hover-tooltip-landscape {
    position: absolute;
    bottom: calc(var(--card-h) + 6px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .card-hand-container {
    --card-w: calc(var(--gw, 390px) * 0.30);
    --card-h: calc(var(--card-w) * 1.42);
    position: absolute;
    bottom: calc(calc(56px * var(--layout-scale, 1)) + 2vh);
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
    box-shadow: none;
    border-radius: 0;
  }

  .card-has-frame.card-selected {
    box-shadow: none;
  }

  .card-has-frame.card-playable {
    filter: drop-shadow(0 0 2px rgba(22, 163, 74, 0.9));
  }

  /* ── Card Frame V2 — layered system ──────────────────────── */
  .card-v2-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    isolation: isolate; /* create clean stacking context */
  }

  .frame-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill; /* stretch to fill — frame images are pre-sized to card aspect */
    pointer-events: none;
    image-rendering: pixelated;
    z-index: 3;
  }

  .frame-card-art {
    position: absolute;
    left: 12%;
    top: 10%;
    width: 76%;
    height: 50%;
    object-fit: cover;
    image-rendering: auto;
    pointer-events: none;
    z-index: 1; /* behind ALL frame layers (z:3) */
  }

  .upgrade-icon {
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* Mastery float bob — gentle hover animation for upgraded cards */
  .mastery-bob {
    animation: masteryBob 2.2s ease-in-out infinite !important;
  }

  @keyframes masteryBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* Gold glow for fully mastered (level 5) cards */
  .mastery-glow {
    filter: hue-rotate(60deg) saturate(2) brightness(1.3) drop-shadow(0 0 6px rgba(234, 179, 8, 0.8)) drop-shadow(0 0 12px rgba(234, 179, 8, 0.4)) !important;
  }

  /* Mastery upgrade flash — green pulse on numbers that went up */
  .desc-number.mastery-flash-up {
    animation: masteryFlashUp 800ms ease-out;
  }

  @keyframes masteryFlashUp {
    0% { color: #22c55e; text-shadow: 0 0 12px rgba(34, 197, 94, 0.9), 0 0 24px rgba(34, 197, 94, 0.5); transform: scale(1.3); }
    50% { color: #4ade80; text-shadow: 0 0 8px rgba(74, 222, 128, 0.6); transform: scale(1.1); }
    100% { color: inherit; text-shadow: inherit; transform: scale(1); }
  }

  /* Mastery downgrade flash — red pulse on numbers that went down */
  .desc-number.mastery-flash-down {
    animation: masteryFlashDown 800ms ease-out;
  }

  @keyframes masteryFlashDown {
    0% { color: #ef4444; text-shadow: 0 0 12px rgba(239, 68, 68, 0.9), 0 0 24px rgba(239, 68, 68, 0.5); transform: scale(1.3); }
    50% { color: #f87171; text-shadow: 0 0 8px rgba(248, 113, 113, 0.6); transform: scale(1.1); }
    100% { color: inherit; text-shadow: inherit; transform: scale(1); }
  }

  /* AP cost flash */
  .v2-ap-cost.mastery-flash-up {
    animation: masteryFlashUp 800ms ease-out;
  }
  .v2-ap-cost.mastery-flash-down {
    animation: masteryFlashDown 800ms ease-out;
  }

  .frame-text {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 5;
    overflow: hidden;
  }

  .v2-ap-cost {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    font-size: calc(var(--card-w) * 0.18);
    color: #fbbf24;
    -webkit-text-stroke: 2px #000;
    text-shadow:
      2px 2px 0 #000, -2px -2px 0 #000,
      2px -2px 0 #000, -2px 2px 0 #000,
      0 3px 6px rgba(0,0,0,0.8),
      0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5);
    line-height: 1;
  }

  .v2-mechanic-name {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 700;
    font-size: calc(var(--card-w) * 0.09);
    color: #ffffff;
    text-transform: capitalize;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .v2-card-type {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 700;
    font-size: calc(var(--card-w) * 0.085);
    color: #e0e0e0;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    align-items: center;
    justify-content: center;
  }

  .card-type-icon {
    font-size: 1.1em;
    margin-right: 2px;
  }

  .v2-effect-text {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: calc(var(--card-w) * 0.095);
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
  }

  .desc-number {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  .desc-keyword {
    font-weight: 700;
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

  .desc-mastery-bonus {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    color: #4ade80;
    text-shadow: 0 0 4px rgba(74, 222, 128, 0.4), 0 1px 2px rgba(0,0,0,0.6);
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
    filter: drop-shadow(0 0 2px rgba(22, 163, 74, 0.9));
  }

  .drag-ready {
    filter: drop-shadow(0 0 3px rgba(34, 197, 94, 0.9)) !important;
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

  /* Soul Jar GUARANTEED — gold shimmer on charge zone text */
  .charge-zone-text.guaranteed-active {
    color: #fbbf24;
    text-shadow:
      0 0 10px rgba(251, 191, 36, 1),
      0 0 20px rgba(251, 191, 36, 0.7);
    border-color: rgba(251, 191, 36, 0.6);
    animation: guaranteed-pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes guaranteed-pulse {
    from { opacity: 0.85; }
    to   { opacity: 1; text-shadow: 0 0 16px rgba(251, 191, 36, 1), 0 0 28px rgba(251, 191, 36, 0.8); }
  }

  /* AR-122: Chain Momentum — green flash when nextChargeFree waives the surcharge */
  .charge-zone-text.momentum-active {
    color: #4ade80;
    text-shadow:
      0 0 8px rgba(74, 222, 128, 0.9),
      0 0 16px rgba(74, 222, 128, 0.5),
      0 1px 2px rgba(0, 0, 0, 0.9);
    border-color: rgba(74, 222, 128, 0.5);
  }

  .charge-ap-badge.momentum-active {
    color: #4ade80;
    background: rgba(74, 222, 128, 0.2);
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

  .trial-card {
    border-color: #f1c40f !important;
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.65);
  }

  /* AR-202: Cursed card visual treatment */
  .card--cursed {
    filter: sepia(0.3) hue-rotate(240deg) saturate(1.4) brightness(0.85);
    /* Purple tint */
  }

  .card--cursed::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid rgba(160, 60, 220, 0.85);
    border-radius: inherit;
    pointer-events: none;
    z-index: 10;
  }

  .card--cursed::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 40%, rgba(140, 0, 220, 0.08) 50%, transparent 60%);
    pointer-events: none;
    z-index: 11;
    border-radius: inherit;
  }

  @media (prefers-reduced-motion: no-preference) {
    .card--cursed::after {
      animation: cursed-shimmer 2.5s ease-in-out infinite;
    }
  }

  [data-pw-animations="disabled"] .card--cursed::after {
    animation: none;
  }

  @keyframes cursed-shimmer {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  /* AR-202: Cure animation — cursed card cured by correct Charge */
  .card--curing {
    animation: cursed-cure 0.8s ease-out forwards;
  }

  @media (prefers-reduced-motion: no-preference) {
    .card--curing {
      animation: cursed-cure 0.8s ease-out forwards;
    }
  }

  [data-pw-animations="disabled"] .card--curing {
    animation: none;
  }

  @keyframes cursed-cure {
    0%   { filter: sepia(0.3) hue-rotate(240deg) saturate(1.4) brightness(0.85); box-shadow: 0 0 0px rgba(255, 200, 0, 0); }
    30%  { filter: brightness(1.6) saturate(1.8); box-shadow: 0 0 20px rgba(255, 200, 0, 0.9); }
    100% { filter: none; box-shadow: none; }
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

  /* H-9: Drag-to-charge hint — portrait, first selection */
  .charge-drag-hint {
    position: absolute;
    bottom: calc(-22px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    color: #facc15;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(250, 204, 21, 0.4);
    border-radius: 4px;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    white-space: nowrap;
    pointer-events: none;
    z-index: 30;
    animation: chargeHintFadeIn 200ms ease-out both;
    letter-spacing: 0.03em;
  }

  @keyframes chargeHintFadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* H-10: Charge zone threshold line — fixed, full-width dashed line during drag */
  .charge-threshold-line {
    position: fixed;
    left: 0;
    right: 0;
    height: 2px;
    border-top: 2px dashed rgba(250, 204, 21, 0.55);
    pointer-events: none;
    z-index: 25;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .threshold-label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #facc15;
    background: rgba(0, 0, 0, 0.7);
    padding: 1px calc(8px * var(--layout-scale, 1));
    border-radius: 3px;
    border: 1px solid rgba(250, 204, 21, 0.4);
    pointer-events: none;
    white-space: nowrap;
  }

  /* V2 Echo: golden flash on correct Charge resolve */
  @keyframes echo-correct-flash {
    0%   { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
    40%  { box-shadow: 0 0 calc(18px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.9); }
    100% { box-shadow: 0 0 0px rgba(255, 215, 0, 0); }
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

  /* §7 spec: cards un-dim after quiz = 200ms opacity (base transition for when class is removed) */
  .card-hand-landscape {
    transition: opacity 200ms ease;
  }

  /* AR-76: Dim card hand when quiz is visible in landscape */
  /* §7 spec: cards dim on quiz = 150ms opacity (transition used when class is added) */
  .card-hand-quiz-dimmed {
    opacity: 0.7;
    transition: opacity 150ms ease;
  }

  /* AR-94: Ensure landscape quiz-dimmed applies with sufficient specificity */
  .card-hand-landscape.card-hand-quiz-dimmed {
    opacity: 0.7;
    transition: opacity 150ms ease;
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
    width: var(--card-w);
    box-sizing: border-box;
    text-align: center;
    cursor: pointer;
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
    margin-left: calc(5px * var(--layout-scale, 1));
    padding: 1px calc(5px * var(--layout-scale, 1));
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

  /* === CHARGE PREVIEW (button hover) — green number tint when hovering the CHARGE button === */
  .charge-preview-btn {
    color: #4ade80 !important;
    text-shadow: 0 0 6px rgba(74, 222, 128, 0.6), -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000;
    transition: color 150ms ease;
  }

  /* === AR-74: Mouse hover tooltip (landscape only) === */
  .card-hover-tooltip {
    position: absolute;
    bottom: 0;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
    background: rgba(15, 15, 30, 0.92);
    border: 1px solid rgba(78, 205, 196, 0.4);
    border-radius: 6px;
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    pointer-events: none;
    z-index: 30;
    white-space: nowrap;
    font-family: 'Courier New', monospace;
    font-size: 0.68rem;
    animation: tooltip-fade-in 120ms ease-out;
  }

  @keyframes tooltip-fade-in {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .tooltip-mechanic {
    color: #e0e0e0;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .tooltip-cost {
    color: rgba(255, 211, 105, 0.85);
    font-size: calc(0.62rem * var(--text-scale, 1));
  }

  .tooltip-chain {
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    font-size: calc(0.6rem * var(--text-scale, 1));
    opacity: 0.85;
    font-weight: 600;
  }

  /* ── §9 Landscape: Right-click card detail modal ─────────── */

  .card-detail-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    cursor: default;
  }

  .card-detail-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999;
    background: rgba(8, 12, 26, 0.97);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: calc(18px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    min-width: calc(260px * var(--layout-scale, 1));
    max-width: calc(380px * var(--layout-scale, 1));
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    animation: cardDetailAppear 150ms ease-out both;
  }

  @keyframes cardDetailAppear {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .card-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: calc(8px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-detail-name {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: 0.02em;
  }

  .card-detail-chain {
    display: inline-flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
  }

  .card-detail-tier {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-detail-tier-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    font-weight: 600;
  }

  .card-detail-ap {
    font-size: calc(12px * var(--text-scale, 1));
    color: #fbbf24;
    font-weight: 700;
  }

  .card-detail-mechanic {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    line-height: 1.4;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: calc(8px * var(--layout-scale, 1));
  }

  .card-detail-question-label {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .card-detail-question {
    font-size: calc(13px * var(--text-scale, 1));
    color: #e2e8f0;
    line-height: 1.45;
  }

  .card-detail-close {
    position: absolute;
    top: calc(10px * var(--layout-scale, 1));
    right: calc(12px * var(--layout-scale, 1));
    width: calc(24px * var(--layout-scale, 1));
    height: calc(24px * var(--layout-scale, 1));
    border: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.6);
    font-size: calc(12px * var(--text-scale, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .card-detail-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  }
</style>
