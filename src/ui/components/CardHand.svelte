<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte'
  import type { Card, FactDomain } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardbackUrl, onCardbackReady } from '../utils/cardbackManifest'
  import { type CardAnimPhase } from '../utils/mechanicAnimations'
  // Frame V2 utilities are imported by CardVisual.svelte
  // getCardArtUrl moved to CardVisual.svelte
  import { getShortCardDescription } from '../../services/cardDescriptionService'
  // getCardDescriptionParts moved to CardVisual.svelte
  import { BASE_WIDTH, GAME_ASPECT_RATIO } from '../../data/layout'
  import { audioManager } from '../../services/audioService'
  import { isFirstChargeFree } from '../../services/discoverySystem'
  import { getMechanicDefinition } from '../../data/mechanics'
  // stretchText moved to CardVisual.svelte
  import { CHARGE_CORRECT_MULTIPLIER } from '../../data/balance'
  import { getMasteryStats, getEffectiveApCost } from '../../services/cardUpgradeService'
  import { activeRunState } from '../../services/runStateStore'
  import { getChainColor, getChainColorGroups } from '../../services/chainVisuals'
  import { getChainTypeName, getChainTypeColor } from '../../data/chainTypes'
  import ChainIcon from './ChainIcon.svelte'
  import CardVisual from './CardVisual.svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'
  import { factsDB } from '../../services/factsDB'
  // AR-74: Importing keyboardInput activates the landscape-mode keyboard listener subscription.
  import '../../services/keyboardInput'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { get } from 'svelte/store'
  import { reduceMotionMode } from '../../services/cardPreferences'

  interface Props {
    cards: Card[]
    animatingCards?: Card[]
    selectedIndex: number | null
    disabled: boolean
    apCurrent: number
    cardAnimations?: Record<string, CardAnimPhase>
    discarding?: boolean
    onselectcard: (index: number) => void
    ondeselectcard: () => void
    oncastdirect?: (index: number) => void
    /** Charge Play — triggers quiz flow for selected card (AR-59.2). */
    onchargeplay?: (index: number) => void
    /** True during Surge turns — CHARGE! button shows "+0 AP" instead of "+1 AP". */
    isSurgeActive?: boolean
    /** AR-122: Chain Momentum chain type — next Charge of this chain type costs +0 AP. null = no momentum. */
    chargeMomentumChainType?: number | null
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
    /** Effective damage previews per card — computed by CardCombatOverlay from current combat state. */
    damagePreviews?: Record<string, import('../../services/damagePreviewService').DamagePreview>
    /** AR-310: Active chain color for this turn — matching cards get a glow highlight. */
    activeChainColor?: number | null
  }

  // Session-level preload guard: avoid creating duplicate Image objects for the same URL.
  const preloadedCardbackUrls = new Set<string>()

  let {
    cards,
    animatingCards = [],
    selectedIndex,
    disabled,
    apCurrent,
    cardAnimations,
    discarding = false,
    onselectcard,
    ondeselectcard,
    oncastdirect,
    onchargeplay,
    isSurgeActive = false,
    chargeMomentumChainType = null,
    quizVisible = false,
    focusDiscount = 0,
    masteryFlashes = {},
    cureFlashes = {},
    showGuaranteed = false,
    damagePreviews = {},
    activeChainColor = null,
  }: Props = $props()

  // ─── Draw animation tracking ─────────────────────────────────────────────
  /** Set of card IDs that were just added to the hand — triggers card-drawn-in animation. */
  let drawnInCardIds = $state<Set<string>>(new Set())
  let prevCardIds = $state<Set<string> | null>(null)

  $effect(() => {
    const currentIds = new Set(cards.map(c => c.id))
    // Use untrack for state reads that shouldn't trigger re-runs
    const prev = untrack(() => prevCardIds)
    // Skip first render — all initial cards should appear without animation
    if (prev === null) {
      untrack(() => { prevCardIds = currentIds })
      return
    }
    const newIds: string[] = []
    for (const id of currentIds) {
      if (!prev.has(id)) newIds.push(id)
    }
    if (newIds.length > 0) {
      untrack(() => {
        drawnInCardIds = new Set(newIds)
        setTimeout(() => {
          drawnInCardIds = new Set()
        }, 450)
      })
    }
    untrack(() => { prevCardIds = currentIds })
  })

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
  const handScaleFactor = $derived(cards.length > 6 ? Math.max(0.75, 1 - (cards.length - 6) * 0.05) : 1)

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

  /** Landscape fan rotation — scales max angle with card count for natural fan spread */
  function getLandscapeRotation(index: number, total: number): number {
    if (total <= 1) return 0
    const t = (index / (total - 1)) * 2 - 1  // -1 to +1
    const maxAngle = Math.min(15, 2 + total * 1.3)  // scales with count: 3 cards≈6°, 10 cards≈15°
    return t * maxAngle
  }

  /** Landscape arc lift — parabolic, scales arc height with card count */
  function getLandscapeArcOffset(index: number, total: number): number {
    if (total <= 1) return 0
    const t = (index / (total - 1)) * 2 - 1  // -1 to +1
    const arcHeight = Math.min(50, 5 + total * 4)  // scales with count: 3 cards≈17px, 10 cards≈45px
    return arcHeight * (1 - t * t)
  }

  /** Landscape X offset — cards overlap, tighter with more cards, based on card-count-derived overlap fraction */
  function getLandscapeXOffset(index: number, total: number, cardW: number): number {
    if (total <= 1) return 0
    // Spacing as fraction of card width — more cards = tighter packing
    const overlapFraction = total <= 4 ? 0.72 : total <= 7 ? 0.56 : 0.44
    const spacing = cardW * overlapFraction
    const totalWidth = spacing * (total - 1)
    return -totalWidth / 2 + spacing * index
  }

  /** Scatter offset — disabled, neighbors stay in place on hover */
  function getHoverScatterX(_index: number, _hoveredIndex: number | null, _total: number): number {
    return 0
  }

  const landscapeCardW = $derived.by(() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
    return (35 * vh / 100) * 0.88 * handScaleFactor / 1.42
  })

  // effectTextSizeClass and groupIntoLines moved to CardVisual.svelte

  /**
   * Returns the display value for a card's primary effect.
   * Uses mechanic.quickPlayValue as the base (Quick Play = no quiz).
   * Charge mode applies the CHARGE_CORRECT_MULTIPLIER.
   * Mastery bonus is included.
   * NOTE: Relic flat damage bonuses (e.g. Whetstone +3) are NOT shown here
   * because CardHand does not receive relic state. The value shown is accurate
   * for the base case (no relics). To show relic-adjusted values, a
   * `relicFlatAttackBonus` prop would need to be threaded from CardCombatOverlay.
   */
  function getEffectValue(card: Card, chargeMode: boolean = false): number {
    const mechanic = getMechanicDefinition(card.mechanicId)
    if (mechanic) {
      // getMasteryStats() synthesises the old perLevelDelta system — identical results.
      const stats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
      const masteredQpValue = stats?.qpValue ?? mechanic.quickPlayValue
      return chargeMode
        ? Math.round(masteredQpValue * CHARGE_CORRECT_MULTIPLIER)
        : masteredQpValue
    }
    // Fallback when mechanic definition is missing — use card's own stored values
    const base = Math.round(card.baseEffectValue * card.effectMultiplier);
    const fallbackStats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0);
    const masteryBonus = fallbackStats ? (fallbackStats.qpValue - base) : 0;
    return chargeMode ? Math.round((base + masteryBonus) * CHARGE_CORRECT_MULTIPLIER) : base + masteryBonus;
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

  function hasEnoughAp(card: Card): boolean {
    return Math.max(0, getEffectiveApCost(card) - focusDiscount) <= apCurrent
  }

  /** Returns the displayed AP cost accounting for Focus discount (Quick Play cost). */
  function getDisplayedApCost(card: Card): number {
    return Math.max(0, getEffectiveApCost(card) - focusDiscount)
  }

  /**
   * Returns the real charge AP cost for a card, factoring in all waivers:
   * surge, chain momentum match, first-free-charge, and active chain color match.
   * Used to show live cost on the card badge when the card is in charge-preview state.
   */
  function getDisplayedChargeApCost(card: Card, isMomentumMatch: boolean, isActiveChainMatch: boolean, isFreeCharge: boolean): number {
    const base = Math.max(0, getEffectiveApCost(card) - focusDiscount)
    const surchargeWaived = isSurgeActive || isMomentumMatch || isFreeCharge || isActiveChainMatch
    return base + (surchargeWaived ? 0 : 1)
  }

  /** Returns color for the AP gem based on cost change. Green if reduced, red if increased, off-white otherwise. */
  function getApGemColor(card: Card): string {
    const base = getEffectiveApCost(card)
    const displayed = getDisplayedApCost(card)
    if (displayed < base) return '#22c55e'
    if (displayed > base) return '#ef4444'
    return '#fbbf24'
  }

  /** Returns AP gem color for charge mode — green if waiver applies, red if surcharge, amber otherwise. */
  function getChargeApGemColor(chargeApCost: number, baseApCost: number): string {
    if (chargeApCost < baseApCost) return '#22c55e'
    if (chargeApCost > baseApCost) return '#ef4444'
    return '#fbbf24'
  }

  function getDomainColor(domain: FactDomain): string {
    return getDomainMetadata(domain)?.colorTint ?? '#6B7280'
  }

  let hoveredIndex = $state<number | null>(null)

  /** AR-220: Rise amount = half the card height, read from CSS var --card-h. Defaults to 100 (half of 200px). */
  let riseAmount = $state(60)
  let resolvedCardH = $state(200)
  let layoutScaleValue = $state(1)

  $effect(() => {
    const update = (): void => {
      // Read actual card height from a rendered card element (CSS custom properties return unresolved calc() strings)
      const cardEl = document.querySelector('.card-landscape') ?? document.querySelector('.card-portrait')
      const cardH = cardEl ? cardEl.getBoundingClientRect().height : 200
      riseAmount = Math.round(cardH * 0.45)
      resolvedCardH = Math.round(cardH)
      layoutScaleValue = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-scale') || '1')
    }
    // Defer to next frame so cards are rendered
    requestAnimationFrame(update)
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  })

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

  /** Actual screen center X of the selected card, used to position the landscape charge button accurately.
   *  Defaults to viewport center (960). Updated by $effect whenever selectedIndex changes or window resizes. */
  let selectedCardCenterX = $state(typeof window !== 'undefined' ? window.innerWidth / 2 : 960)

  $effect(() => {
    // Track selectedIndex reactively so Svelte re-runs on change
    const idx = selectedIndex
    const updateChargeButtonPos = (): void => {
      if (idx === null) return
      const cardEls = document.querySelectorAll<HTMLElement>('.card-landscape')
      const cardEl = cardEls[idx]
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect()
        selectedCardCenterX = rect.left + rect.width / 2
      }
    }
    updateChargeButtonPos()
    window.addEventListener('resize', updateChargeButtonPos, { passive: true })
    return () => window.removeEventListener('resize', updateChargeButtonPos)
  })

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

  /**
   * Handles rr:player-turn-start DOM event. Plays a brief scale pulse (0.97→1.0)
   * on each .card-slot using WAAPI, staggered by 40ms per card index.
   * Skipped when reduceMotionMode is active.
   */
  function handlePlayerTurnStart(): void {
    if (get(reduceMotionMode)) return
    const slots = document.querySelectorAll('.card-slot')
    slots.forEach((slot, i) => {
      setTimeout(() => {
        ;(slot as HTMLElement).animate(
          [
            { transform: 'scale(0.97)', offset: 0 },
            { transform: 'scale(1.0)', offset: 1 },
          ],
          {
            duration: 200,
            easing: 'ease-out',
            fill: 'none',
          }
        )
      }, i * 40)
    })
  }

  onMount(() => {
    const onResize = (): void => {
      viewportWidth = Math.min(window.innerWidth, window.innerHeight * GAME_ASPECT_RATIO)
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('rr:player-turn-start', handlePlayerTurnStart)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('rr:player-turn-start', handlePlayerTurnStart)
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
  let prevCardCount = $state(untrack(() => cards.length))
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
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* pointer already released */ }
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
      const isActiveChainMatchForDrag = activeChainColor !== null && card?.chainType === activeChainColor
      const chargeApCost = getEffectiveApCost(card) + (isSurgeActive || (chargeMomentumChainType !== null && card?.chainType === chargeMomentumChainType) || isActiveChainMatchForDrag ? 0 : 1)
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
      // Tap (minimal movement):
      // If card was already selected, tapping it again = Quick Play (base effect, no quiz, no charge)
      if (selectedIndex === index && oncastdirect) {
        oncastdirect(index)
      } else {
        // Normal select behavior; show charge hint in portrait
        maybeShowChargeHint()
        onselectcard(index)
      }
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
    {@const apCost = getEffectiveApCost(card)}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const isHovered = hoveredIndex === i && !isSelected && !isOther && selectedIndex === null}
    {@const isDraggingThis = dragState?.cardIndex === i}
    {@const cardDragX = isDraggingThis ? dragDeltaX : 0}
    {@const cardDragRawY = isDraggingThis ? dragRawDeltaY : 0}
    {@const cardDragScale = isDraggingThis ? dragScale : 1}
    {@const runState = $activeRunState}
    {@const isMastered = card.tier === '3'}
    {@const isFreeCharge = (runState !== null && card.factId) ? isFirstChargeFree(card.factId, runState.firstChargeFreeFactIds) : false}
    {@const isMomentumMatch = chargeMomentumChainType !== null && card.chainType === chargeMomentumChainType}
    {@const isActiveChainMatch = activeChainColor !== null && card.chainType === activeChainColor}
    {@const chargeApCostForDrag = Math.max(0, getEffectiveApCost(card) - focusDiscount) + (isSurgeActive || isMomentumMatch || isActiveChainMatch ? 0 : 1)}
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
    {@const displayedApCost = isChargePreview ? getDisplayedChargeApCost(card, isMomentumMatch, isActiveChainMatch, isFreeCharge) : getDisplayedApCost(card)}
    {@const apGemColor = isChargePreview ? getChargeApGemColor(displayedApCost, getEffectiveApCost(card)) : getApGemColor(card)}
    {@const preview = damagePreviews[card.id]}
    {@const effectVal = preview ? (isChargePreview ? preview.ccValue : preview.qpValue) : getEffectValue(card, isChargePreview)}
    {@const modState = preview ? (isChargePreview ? preview.ccModified : preview.qpModified) : 'neutral'}
    {@const xOffset = getXOffset(i, cards.length)}
    {@const lsRotation = getLandscapeRotation(i, cards.length)}
    {@const lsArcOffset = getLandscapeArcOffset(i, cards.length)}
    {@const lsXOffset = getLandscapeXOffset(i, cards.length, landscapeCardW)}
    {@const scatterX = getHoverScatterX(i, hoveredIndex, cards.length)}
    {@const hoverLiftLs = isHovered ? 60 : 0}
    {@const hoverScaleLs = isHovered ? 1.15 : 1}
    {@const activeChainHex = isActiveChainMatch ? getChainTypeColor(activeChainColor!) : null}

    <button
      class="card-in-hand card-landscape"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:echo-card={false}
      class:trial-card={card.isMasteryTrial}
      class:insufficient-ap={insufficientAp}
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      class:card-reveal={isAnimating}
      class:card-swoosh={isSwoosh}
      class:card-impact={isImpact}
      class:drag-ready={isDragPastThreshold && isDraggingThis && !isDragInChargeZone}
      class:drag-charge-zone={isDragInChargeZone}
      class:drag-charge-zone-disabled={isDragInChargeZone && !chargeAffordableForDrag}
      class:card--cursed={card.isCursed && !cureFlashes[card.id]}
      class:card--curing={cureFlashes[card.id]}
      class:card--locked={card.isLocked}
      class:card--active-chain={isActiveChainMatch && !isSelected && selectedIndex === null}
      class:card-drawn-in={drawnInCardIds.has(card.id)}
      style="
        {isAnimating ? '' : isDraggingThis
          ? `transform: translate3d(${lsXOffset + cardDragX}px, ${(isSelected ? -riseAmount : -lsArcOffset) - cardDragRawY}px, 0) rotate(0deg) scale(${cardDragScale});`
          : `transform: translate3d(${lsXOffset + scatterX}px, ${isSelected ? -riseAmount : -(lsArcOffset + hoverLiftLs)}px, 0) rotate(${isSelected ? 0 : lsRotation}deg) scale(${isSelected ? 1.1 : hoverScaleLs});`}
        animation-delay: {i * 60}ms;
        opacity: {isOther ? 0.35 : 1};
        z-index: {isDraggingThis ? 2000 : isSelected ? 2000 : isHovered ? 2000 : 1000 + i};
        {isDraggingThis && chargeProgress > 0.05 ? `filter: drop-shadow(0 0 ${8 + chargeProgress * 8}px rgba(250, 204, 21, ${chargeProgress * 0.8})) drop-shadow(0 0 ${16 + chargeProgress * 16}px rgba(250, 204, 21, ${chargeProgress * 0.4}));` : (isActiveChainMatch && !isSelected && !isDraggingThis && selectedIndex === null && activeChainHex ? `filter: drop-shadow(0 0 6px ${activeChainHex}99) drop-shadow(0 0 12px ${activeChainHex}55);` : '')}
      "
      data-testid="card-hand-{i}"
      aria-label="{card.mechanicName}: costs {getEffectiveApCost(card)} AP, {getShortCardDescription(card, getEffectValue(card))}. Card {i + 1} of {cards.length}."
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
          <!-- V2 layered frame — shared CardVisual component -->
          <CardVisual
            {card}
            effectValue={effectVal}
            {isChargePreview}
            {isBtnChargePreview}
            {modState}
            masteryFlash={masteryFlashes[card.id] ?? null}
            {displayedApCost}
            {apGemColor}
            chainPillActive={isActiveChainMatch && !isSelected && selectedIndex === null}
          />
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

      {#if card.isCursed && !cureFlashes[card.id]}
        <span class="cursed-orb cursed-orb-1" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-2" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-3" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-4" aria-hidden="true"></span>
      {/if}

      {#if card.isLocked}
        <div class="card-lock-overlay" aria-label="Card locked — must Charge to unlock">
          <span class="card-lock-icon" aria-hidden="true">🔒</span>
          <span class="card-lock-label">CHARGE ONLY</span>
        </div>
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
            <span class="charge-zone-text" class:momentum-active={isMomentumMatch && !isSurgeActive}>⚡ CHARGE {chargeApCostForDrag} AP{isMomentumMatch && !isSurgeActive ? ' ⚡' : ''}</span>
          {/if}
        </div>
      {/if}
    </button>

    {#if selectedIndex === i && card.tier !== '3' && (card.masteryLevel ?? 0) < 5 && onchargeplay && !disabled}
      {@const chargeApCost = Math.max(0, getEffectiveApCost(card) - focusDiscount) + (isSurgeActive || isMomentumMatch || isFreeCharge || isActiveChainMatch ? 0 : 1)}
      {@const chargeAffordable = chargeApCost <= apCurrent}
      {@const chargeApDisplay = String(chargeApCost)}
      {@const apBadgeColor = chargeAffordable ? '#4ADE80' : '#EF4444'}
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
        style="left: {selectedCardCenterX}px; transform: translateX(-50%); bottom: {riseAmount + Math.round(resolvedCardH * 0.58) + Math.round(12 * layoutScaleValue)}px;"
      >
        {#if showGuaranteed}
          ✦ GUARANTEED
        {:else}
          <span class="charge-ap-badge charge-ap-badge-landscape" class:momentum-active={isMomentumMatch && !isSurgeActive} style={apBadgeColor ? `color: ${apBadgeColor};` : ''}>{chargeApDisplay} AP</span>
          ⚡ CHARGE
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
        <span class="tooltip-cost">{getEffectiveApCost(card)} AP</span>
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

    <div
      class="card-in-hand card-has-frame card-landscape card-animating"
      class:card-reveal={isAnimating}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      use:ghostCardAnim
      class:card-swoosh={isSwoosh}
      class:card-impact={isImpact}
    >
      <div class="card-inner" class:flipped={(isRevealing || isTierUp || isSwoosh || isImpact) && !!cardbackUrl}>
        <div class="card-front">
          <!-- V2 layered frame — shared CardVisual component -->
          <CardVisual {card} />
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

    </div>
  {/each}

  <!-- §9 Landscape: right-click card detail modal -->
  {#if cardDetailVisible && cardDetailCard}
    {@const detailCard = cardDetailCard}
    {@const chainName = detailCard.chainType !== undefined ? getChainTypeName(detailCard.chainType) : null}
    {@const chainTypeVal = detailCard.chainType ?? 0}
    {@const mechanic = getMechanicDefinition(detailCard.mechanicId ?? '')}
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
        <span class="card-detail-ap">{getEffectiveApCost(detailCard)} AP</span>
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
    {@const apCost = getEffectiveApCost(card)}
    {@const insufficientAp = !hasEnoughAp(card)}
    {@const cardbackUrl = cardbackUrls.get(card.factId) ?? null}
    {@const isRevealing = cardAnim === 'reveal'}
    {@const isTierUp = cardAnim === 'tier-up'}
    {@const isSwoosh = cardAnim === 'swoosh'}
    {@const isImpact = cardAnim === 'impact'}
    {@const isAnimating = isRevealing || isTierUp || isSwoosh || isImpact}
    {@const isHovered = hoveredIndex === i && !isSelected && !isOther && selectedIndex === null}
    {@const hoverLift = isHovered ? 18 : 0}
    {@const hoverScale = isHovered ? 1.15 : 1}
    {@const isDraggingThis = dragState?.cardIndex === i}
    {@const cardDragX = isDraggingThis ? dragDeltaX : 0}
    {@const cardDragRawY = isDraggingThis ? dragRawDeltaY : 0}
    {@const cardDragScale = isDraggingThis ? dragScale : 1}
    {@const runState = $activeRunState}
    {@const isFreeCharge = (runState !== null && card.factId) ? isFirstChargeFree(card.factId, runState.firstChargeFreeFactIds) : false}
    {@const isMastered = card.tier === '3'}
    {@const isMomentumMatch = chargeMomentumChainType !== null && card.chainType === chargeMomentumChainType}
    {@const isActiveChainMatch = activeChainColor !== null && card.chainType === activeChainColor}
    {@const chargeApCostForDrag = Math.max(0, getEffectiveApCost(card) - focusDiscount) + (isSurgeActive || isMomentumMatch || isActiveChainMatch ? 0 : 1)}
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
    {@const displayedApCost = isChargePreview ? getDisplayedChargeApCost(card, isMomentumMatch, isActiveChainMatch, isFreeCharge) : getDisplayedApCost(card)}
    {@const apGemColor = isChargePreview ? getChargeApGemColor(displayedApCost, getEffectiveApCost(card)) : getApGemColor(card)}
    {@const preview = damagePreviews[card.id]}
    {@const effectVal = preview ? (isChargePreview ? preview.ccValue : preview.qpValue) : getEffectValue(card, isChargePreview)}
    {@const modState = preview ? (isChargePreview ? preview.ccModified : preview.qpModified) : 'neutral'}
    {@const descPower = effectVal}
    {@const activeChainHex = isActiveChainMatch ? getChainTypeColor(activeChainColor!) : null}

    <button
      class="card-in-hand card-has-frame"
      class:card-selected={isSelected}
      class:card-dimmed={isOther}
      class:echo-card={false}
      class:trial-card={card.isMasteryTrial}
      class:insufficient-ap={insufficientAp}
      class:card-playable={!insufficientAp && !isSelected && !isOther && selectedIndex === null}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      class:card-reveal={isAnimating}
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
      class:card--locked={card.isLocked}
      class:card--active-chain={isActiveChainMatch && !isSelected && selectedIndex === null}
      class:card-drawn-in={drawnInCardIds.has(card.id)}
      style="
        {isAnimating ? '' : isDraggingThis ? `transform: translate3d(${xOffset + cardDragX}px, ${(isSelected ? -riseAmount : -arcOffset) - cardDragRawY}px, 0) rotate(0deg) scale(${cardDragScale});` : `transform: translate3d(${xOffset}px, ${isSelected ? -riseAmount : isOther ? 15 : -(arcOffset + hoverLift)}px, 0) rotate(${isSelected ? 0 : rotation}deg) scale(${isSelected ? 1.2 : hoverScale});`}
        animation-delay: {i * 80}ms;
        opacity: {isOther ? 0.3 : 1};
        z-index: {isDraggingThis ? 20 : isHovered ? 10 : ''};
        {isDraggingThis && chargeProgress > 0.05 ? `filter: drop-shadow(0 0 ${8 + chargeProgress * 8}px rgba(250, 204, 21, ${chargeProgress * 0.8})) drop-shadow(0 0 ${16 + chargeProgress * 16}px rgba(250, 204, 21, ${chargeProgress * 0.4}));` : (isActiveChainMatch && !isSelected && !isDraggingThis && selectedIndex === null && activeChainHex ? `filter: drop-shadow(0 0 6px ${activeChainHex}99) drop-shadow(0 0 12px ${activeChainHex}55);` : '')}
      "
      data-testid="card-hand-{i}"
      aria-label="{card.mechanicName}: costs {getEffectiveApCost(card)} AP, {getShortCardDescription(card, getEffectValue(card))}. Card {i + 1} of {cards.length}."
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
          <!-- V2 layered frame — shared CardVisual component -->
          <CardVisual
            {card}
            effectValue={descPower}
            {isChargePreview}
            {isBtnChargePreview}
            {modState}
            masteryFlash={masteryFlashes[card.id] ?? null}
            {displayedApCost}
            {apGemColor}
          />
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

      {#if card.isCursed && !cureFlashes[card.id]}
        <span class="cursed-orb cursed-orb-1" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-2" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-3" aria-hidden="true"></span>
        <span class="cursed-orb cursed-orb-4" aria-hidden="true"></span>
      {/if}

      {#if card.isLocked}
        <div class="card-lock-overlay" aria-label="Card locked — must Charge to unlock">
          <span class="card-lock-icon" aria-hidden="true">🔒</span>
          <span class="card-lock-label">CHARGE ONLY</span>
        </div>
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
            <span class="charge-zone-text" class:momentum-active={isMomentumMatch && !isSurgeActive}>⚡ CHARGE {chargeApCostForDrag} AP{isMomentumMatch && !isSurgeActive ? ' ⚡' : ''}</span>
          {/if}
        </div>
      {/if}

      <!-- H-9: Drag-to-charge hint — portrait only, first selection, auto-dismisses after 3s -->
      {#if isSelected && showChargeHint && !$isLandscape}
        <div class="charge-drag-hint" aria-hidden="true">Drag up to Charge (1.5x)</div>
      {/if}
    </button>

    {#if selectedIndex === i && card.tier !== '3' && (card.masteryLevel ?? 0) < 5 && onchargeplay && !disabled}
      {@const chargeApCost = Math.max(0, getEffectiveApCost(card) - focusDiscount) + (isSurgeActive || isMomentumMatch || isFreeCharge || isActiveChainMatch ? 0 : 1)}
      {@const chargeAffordable = chargeApCost <= apCurrent}
      {@const chargeApDisplay = String(chargeApCost)}
      {@const apBadgeColor = chargeAffordable ? '#4ADE80' : '#EF4444'}
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
        style="transform: translate3d({xOffset}px, {-(riseAmount + Math.round(resolvedCardH * 0.58) + Math.round(12 * layoutScaleValue))}px, 0); width: calc(var(--card-w) * 1.2);"
      >
        CHARGE
        <span class="charge-ap-badge" class:momentum-active={isMomentumMatch && !isSurgeActive} style={apBadgeColor ? `color: ${apBadgeColor};` : ''}>{chargeApDisplay} AP</span>
      </button>
    {/if}

    <!-- Overflow scroll hint: visible only when hand has 8+ cards -->
    {#if i === cards.length - 1 && cards.length > 7}
      <div class="hand-overflow-hint">›</div>
    {/if}

    <!-- AR-74: Mouse hover tooltip for landscape mode — fixed at bottom-left above End Turn -->
    {#if isHovered && $isLandscape && selectedIndex === null}
      {@const chainName = card.chainType !== undefined ? getChainTypeName(card.chainType) : null}
      {@const chainTypeVal = card.chainType ?? 0}
      {@const mechanic = getMechanicDefinition(card.mechanicId ?? '')}
      <div
        class="card-hover-tooltip card-hover-tooltip-landscape-fixed"
        role="tooltip"
      >
        {#if mechanic?.name}
          <span class="tooltip-mechanic">{mechanic.name}</span>
        {/if}
        <span class="tooltip-cost">{getEffectiveApCost(card)} AP</span>
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

    <div
      class="card-in-hand card-has-frame card-animating"
      class:card-reveal={isAnimating}
      class:card-fizzle={cardAnim === 'fizzle'}
      class:card-discard={cardAnim === 'discard'}
      use:ghostCardAnim
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
          <!-- V2 layered frame — shared CardVisual component -->
          <CardVisual {card} />
        </div>
        {#if cardbackUrl}
          <div class="card-back">
            <img src={cardbackUrl} alt="Card art" class="cardback-img" />
          </div>
        {/if}
      </div>

    </div>
  {/each}
</div>
{/if}

<style>
  /* ── AR-73: Landscape card hand ──────────────────────────── */
  .card-hand-landscape {
    /* Card height = 80% of 27vh strip, scaled down for large hands via --hand-scale (set by JS handScaleFactor).
       Width derived from height via aspect ratio (1.42 tall : 1 wide → invert).
       --hand-scale defaults to 1 (≤6 cards) and shrinks toward 0.75 for 11+ cards. */
    --hand-scale: 1;
    --card-h: calc(35vh * 0.88 * var(--hand-scale));
    --card-w: calc(var(--card-h) / 1.42);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Spec: card hand strip = 35% of viewport height */
    height: 35vh;
    z-index: 20;
    /* Arc fan: absolute positioning, not flex */
    display: block;
    padding: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);
    pointer-events: none;
    overflow: visible;
  }

  .hand-overflow-hint {
    position: sticky;
    right: 0;
    display: flex;
    align-items: center;
    font-size: calc(20px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.4);
    padding: 0 calc(4px * var(--layout-scale, 1));
    pointer-events: none;
  }

  /* AR-94: Selected card rises visually above others in landscape */
  /* AR-220: Remove background container on selected card — card frame provides its own visual bounds */
  .card-hand-landscape .card-landscape.card-selected {
    z-index: 25;
    filter: drop-shadow(0 -4px 12px rgba(255, 255, 255, 0.25));
    background: transparent !important;
    box-shadow: none !important;
  }

  .card-landscape {
    position: absolute;
    bottom: calc(-0.42 * var(--card-h));
    left: 50%;
    margin-left: calc(var(--card-w) / -2);
    width: var(--card-w);
    height: var(--card-h);
    min-width: calc(72px * var(--layout-scale, 1));
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
    /* StS-style smooth transitions — 200ms sine ease-out, z-index instant */
    transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease, z-index 0s;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
    font-family: inherit;
    color: white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
    perspective: 800px;
    will-change: transform, opacity;
    /* Center origin — natural scaling, no positional shift on hover */
    transform-origin: center center;
  }

  /* §7 spec: card selected rise = 150ms ease-out */
  .card-landscape.card-selected {
    transition: transform 150ms ease-out, opacity 200ms ease, z-index 0s;
  }

  /* Hover: card rises to full prominence — transform and z-index handled by inline style for StS-style stacking */

  .charge-play-btn-landscape {
    position: absolute;
    /* bottom is set via inline style using resolved JS values (riseAmount + resolvedCardH + 12*layoutScale)
       to avoid the CSS var(--card-h) mismatch where root --card-h is empty and resolves to 200px
       while the hand container's --card-h is ~332px. */
    /* z-index 30: must sit above selected cards (z-index 25) so the button is always tappable */
    z-index: 30;
    white-space: nowrap;
    /* §7 spec: charge button appear = 100ms fade-in */
    animation: chargeBtnAppear 100ms ease-out both, chargeBtnPulse 1.2s ease-in-out 100ms infinite;
  }

  /* AR-220: chargeBtnAppear no longer controls transform (inline style owns it).
     Uses composite: add so the Y-offset stacks on top of inline transform. */
  @keyframes chargeBtnAppear {
    from { opacity: 0; translate: 0 6px; }
    to   { opacity: 1; translate: 0 0; }
  }

  /* AR-220 sub-step 4: AP badge repositioned above button text in landscape */
  .charge-ap-badge-landscape {
    position: absolute;
    right: 0;
    top: 0;
    transform: translate(0, -100%);
    margin-left: 0;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(2px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.45);
    border-radius: 4px;
    white-space: nowrap;
  }

  .card-hover-tooltip-landscape {
    position: absolute;
    bottom: calc(var(--card-h) + 6px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  /* AR-218: Landscape hover tooltip — fixed at bottom-left, above End Turn button */
  .card-hover-tooltip-landscape-fixed {
    position: fixed;
    left: calc(16px * var(--layout-scale, 1));
    bottom: calc(80px * var(--layout-scale, 1));
    transform: none;
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
    background-color: transparent;
    border: none;
    border-radius: 0;
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
    box-shadow: none;
    perspective: 800px;
    will-change: transform, opacity;
  }

  .card-has-frame {
    background-color: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  /* Draw animation — plays when a card is newly added to the hand (e.g. after Transmute pick) */
  .card-drawn-in {
    animation: cardDrawnIn 450ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
  }

  @keyframes cardDrawnIn {
    0% {
      opacity: 0;
      transform: scale(0.65) translateY(calc(30px * var(--layout-scale, 1)));
      filter: brightness(1.8);
    }
    60% {
      opacity: 1;
      filter: brightness(1.3);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
      filter: brightness(1);
    }
  }

  .card-has-frame.card-selected {
    box-shadow: none;
  }

  /* chain-match glow only — .card-has-frame.card-playable no longer adds unconditional green drop-shadow */
  .card-has-frame.card-playable {
    /* glow is applied via inline style only when isActiveChainMatch */
  }

  /* ── Card Frame V2 — rendered by CardVisual.svelte ──────── */
  /* When card is selected/popped, let clicks pass through the CardVisual component */
  :global(.card-selected .card-v2-frame) {
    pointer-events: none;
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
    /* glow removed — chain-match glow applied via inline style only when isActiveChainMatch */
  }

  .drag-ready {
    /* neutral drag-readiness glow — no green, not chain-specific */
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.4)) !important;
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

  /* AR-122: Chain Momentum — green flash when chargeMomentumChainType waives the surcharge */
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

  /* Landscape selected card: no box-shadow (the landscape rule above uses drop-shadow filter for the glow) */
  .card-hand-landscape .card-selected {
    box-shadow: none !important;
  }

  .card-dimmed {
    opacity: 0.3;
    pointer-events: none;
  }

  .card-in-hand.insufficient-ap:not(.card-selected) {
    filter: saturate(0.35) brightness(0.7);
    opacity: 0.6;
    transition: filter 200ms ease, opacity 200ms ease;
  }

  /* .v2-ap-cost is inside CardVisual (child component) — use :global for the child part */
  .card-in-hand.insufficient-ap :global(.v2-ap-cost) {
    color: #ef4444 !important;
    animation: ap-pulse-red 1.5s ease-in-out infinite;
  }

  @keyframes ap-pulse-red {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .trial-card {
    border-color: #f1c40f !important;
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.65);
  }

  /* AR-220: Cursed card visual — ghostly fade (replaces AR-202 purple tint) */
  .card--cursed {
    filter: brightness(0.8) saturate(0.6);
  }

  .card--cursed::before {
    content: none;
  }

  .card--cursed::after {
    content: none;
  }

  /* AR-220: Ghostly orb particles for cursed cards */
  .cursed-orb {
    position: absolute;
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(200, 220, 255, 0.75);
    pointer-events: none;
    z-index: 12;
    box-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(180, 200, 255, 0.9);
  }

  .cursed-orb-1 {
    left: 20%;
    bottom: calc(10px * var(--layout-scale, 1));
  }

  .cursed-orb-2 {
    left: 45%;
    bottom: calc(6px * var(--layout-scale, 1));
  }

  .cursed-orb-3 {
    left: 68%;
    bottom: calc(12px * var(--layout-scale, 1));
  }

  .cursed-orb-4 {
    left: 33%;
    bottom: calc(4px * var(--layout-scale, 1));
    width: calc(5px * var(--layout-scale, 1));
    height: calc(5px * var(--layout-scale, 1));
    background: rgba(220, 235, 255, 0.6);
  }

  @media (prefers-reduced-motion: no-preference) {
    .cursed-orb-1 {
      animation: cursed-orb-float 2.8s ease-in-out infinite;
    }
    .cursed-orb-2 {
      animation: cursed-orb-float 3.2s ease-in-out infinite;
      animation-delay: 0.7s;
    }
    .cursed-orb-3 {
      animation: cursed-orb-float 2.5s ease-in-out infinite;
      animation-delay: 1.4s;
    }
    .cursed-orb-4 {
      animation: cursed-orb-float 3.6s ease-in-out infinite;
      animation-delay: 0.3s;
    }
  }


  @keyframes cursed-orb-float {
    0%   { transform: translateY(0); opacity: 0; }
    15%  { opacity: 0.85; }
    80%  { opacity: 0.4; }
    100% { transform: translateY(calc(-20px * var(--layout-scale, 1))); opacity: 0; }
  }

  /* AR-268: Trick Question lock — card tint and lock overlay */
  .card--locked {
    filter: brightness(0.75) sepia(0.5) hue-rotate(180deg) saturate(1.5);
  }

  .card-lock-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 15;
    background: rgba(30, 40, 80, 0.45);
    border-radius: inherit;
  }

  .card-lock-icon {
    font-size: calc(20px * var(--layout-scale, 1));
    line-height: 1;
    filter: drop-shadow(0 0 calc(4px * var(--layout-scale, 1)) rgba(100, 140, 255, 0.9));
  }

  .card-lock-label {
    margin-top: calc(4px * var(--layout-scale, 1));
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #aac8ff;
    text-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(80, 120, 255, 0.8);
    text-transform: uppercase;
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


  @keyframes cursed-cure {
    0%   { filter: brightness(0.8) saturate(0.6); box-shadow: 0 0 0px rgba(255, 200, 0, 0); }
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

  /* Reveal phase: brief brightness pulse in place — no centering */
  .card-reveal {
    z-index: 60 !important;
    pointer-events: none;
    animation: cardRevealPulse 200ms ease-out forwards;
  }
  @keyframes cardRevealPulse {
    0% { filter: brightness(1); transform: scale(1); }
    50% { filter: brightness(1.4); transform: scale(1.05); }
    100% { filter: brightness(1); transform: scale(1); opacity: 0.8; }
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


  /* ═══ NEW ANIMATION PHASES ═══ */

  /* Swoosh base: card stays in hand, type-specific pseudo-element overlays */
  .card-swoosh {
    z-index: 60 !important;
    pointer-events: none;
    animation: cardSwooshFade 200ms ease-out forwards;
  }
  @keyframes cardSwooshFade {
    0% { opacity: 0.8; transform: scale(1); }
    100% { opacity: 0.3; transform: scale(0.9); }
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

  /* Impact base: card fades out in place — no centering, base handles fade */
  .card-impact {
    z-index: 60 !important;
    pointer-events: none;
    animation: cardImpactFade 200ms ease-in forwards;
  }
  @keyframes cardImpactFade {
    0% { opacity: 0.3; transform: scale(0.9); }
    100% { opacity: 0; transform: scale(0.7); }
  }

  /* Discard: shrink and fade in place — no centering */
  .card-discard {
    z-index: 60 !important;
    animation: discardShrink 200ms ease-in forwards;
    pointer-events: none;
  }
  @keyframes discardShrink {
    0% { opacity: 0.2; transform: scale(0.7); }
    100% { opacity: 0; transform: scale(0.3); }
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
    .card-fizzle {
      animation: none !important;
    }

    .card-reveal {
      animation: none !important;
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

  /* .charge-preview and .charge-preview-btn CSS moved to CardVisual.svelte */

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

  /* chainPillPulse keyframe moved to CardVisual.svelte */

</style>
