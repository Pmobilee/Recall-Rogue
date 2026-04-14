<script lang="ts">
  import type { Card } from '../../data/card-types'
  import type { Fact } from '../../data/types'
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getCardTypeIconPath, getCardTypeEmoji, getRelicIconPath } from '../utils/iconAssets'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import CardVisual from './CardVisual.svelte'
  import { factsDB } from '../../services/factsDB'
  import { updateReviewStateByButton } from '../stores/playerData'
  import { shuffled } from '../../services/randomUtils'
  import { recordHaggleAttempt, pendingTransformOptions, onShopTransformChoice } from '../../services/gameFlowController'
  import { SHOP_HAGGLE_DISCOUNT } from '../../data/balance'
  import { get } from 'svelte/store'
  import { activeRunState } from '../../services/runStateStore'
  import { isRelicSlotsFull } from '../../services/relicEffectResolver'
  import { selectNonCombatStudyQuestion } from '../../services/nonCombatQuizSelector'
  import { getConfusionMatrix } from '../../services/confusionMatrixStore'
  import { getChainTypeName, getChainTypeColor } from '../../data/chainTypes'
  import { getChainColor, getChainGlowColor } from '../../services/chainVisuals'
  import ChainIcon from './ChainIcon.svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { getActiveDeckCards } from '../../services/encounterBridge'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { ambientAudio } from '../../services/ambientAudioService'
  import { getMasteryStats } from '../../services/cardUpgradeService'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { getShopkeeperBark, type ShopBarkTrigger } from '../../data/shopkeeperBarks'
  import { fade } from 'svelte/transition'
  import { staggerPopIn } from '../utils/roomPopIn'
  import { tick, untrack } from 'svelte'
  import { displayAnswer } from '../../services/numericalDistractorService'

  function getEffectLabel(card: Card): string {
    const base = Math.round(card.baseEffectValue * card.effectMultiplier)
    const _stats = card.mechanicId ? getMasteryStats(card.mechanicId, card.masteryLevel ?? 0) : null
    const _mechDef = card.mechanicId ? getMechanicDefinition(card.mechanicId) : null
    const masteryBonus = _stats && _mechDef ? _stats.qpValue - _mechDef.quickPlayValue : 0
    const total = base + masteryBonus

    switch (card.cardType) {
      case 'attack': return `${total} dmg`
      case 'shield': return `${total} shield`
      case 'buff': return `${total}% buff`
      case 'debuff': return `${total} turns`
      case 'utility': return total > 0 ? `Draw ${total}` : 'Utility'
      case 'wild': return 'Wildcard'
      default: return `${total}`
    }
  }

  function getMasteryIconFilter(level: number): string {
    switch (level) {
      case 1: return 'none'
      case 2: return 'hue-rotate(100deg)'
      case 3: return 'hue-rotate(200deg)'
      case 4: return 'hue-rotate(-40deg)'
      case 5: return 'hue-rotate(60deg) saturate(2)'
      default: return 'none'
    }
  }

  function getMasteryBonusValue(card: Card): number {
    if (!card.mechanicId) return 0
    const _s = getMasteryStats(card.mechanicId, card.masteryLevel ?? 0)
    const _m = getMechanicDefinition(card.mechanicId)
    return _s && _m ? _s.qpValue - _m.quickPlayValue : 0
  }

  // Local interface mirrors shopService.ts ShopInventory — kept in sync
  interface ShopRelicItem {
    relic: { id: string; name: string; description: string; rarity: string; icon: string }
    price: number
  }

  interface ShopCardItem {
    card: Card
    price: number
  }

  interface ShopInventory {
    relics: ShopRelicItem[]
    cards: ShopCardItem[]
    removalCost?: number
    saleCardIndex?: number
    transformCost?: number
  }

  type PendingPurchase =
    | { type: 'relic'; relicId: string; price: number; name: string }
    | { type: 'card'; cardIndex: number; price: number; name: string }
    | { type: 'removal'; cardId: string; price: number; name: string }
    | { type: 'transform'; price: number; name: string }

  type HaggleState = 'idle' | 'quiz' | 'result'

  interface Props {
    cards: Card[]
    currency: number
    shopInventory: ShopInventory | null
    onsell: (cardId: string) => void
    onbuyRelic: (relicId: string, haggled: boolean) => void
    onbuyCard: (cardIndex: number, haggled: boolean) => void
    onbuyRemoval: (cardId: string, haggled: boolean) => void
    /** Trigger card transform: picks source card and starts replacement flow */
    ontransform?: (cardId: string, haggled: boolean) => void
    /** Direct transform choice passthrough — consumed by onShopTransformChoice directly */
    ontransformchoice?: (card: Card) => void
    ondone: () => void
  }

  let { cards, currency, shopInventory, onsell, onbuyRelic, onbuyCard, onbuyRemoval, ontransform, ontransformchoice, ondone }: Props = $props()
  const bgUrl = getRandomRoomBg('shop')
  const depthUrl = getRoomDepthMap('shop')
  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  /** Emoji fallbacks */
  const TYPE_EMOJI: Record<string, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  const RARITY_COLORS: Record<string, string> = {
    common: '#b0bec5',
    uncommon: '#2ecc71',
    rare: '#3498db',
    legendary: '#f1c40f',
  }

  // Shop card visual sizing: 155px wide at scale 1, ratio 886:1142
  const SHOP_CARD_W = 155
  const SHOP_CARD_H = Math.round(SHOP_CARD_W * (1142 / 886))
  // Transform options modal uses larger cards for easier selection
  const MODAL_CARD_W = 170
  const MODAL_CARD_H = Math.round(MODAL_CARD_W * (1142 / 886))

  // === Purchase modal state ===
  let pendingPurchase = $state<PendingPurchase | null>(null)
  let hagglingState = $state<HaggleState>('idle')
  let haggledThisItem = $state(false)
  let haggledPrice = $state(0)
  let quizQuestion = $state<Fact | null>(null)
  let quizAnswers = $state<string[]>([])
  let quizResult = $state<'correct' | 'wrong' | null>(null)
  let quizSelectedAnswer = $state<string | null>(null)

  // === Purchase animation state ===
  let purchasedItemId = $state<string | null>(null)

  let overlayEl = $state<HTMLElement>(null!)

  // === Sell animation (P3-C) ===
  let sellingCardId = $state<string | null>(null)

  function handleSell(cardId: string) {
    sellingCardId = cardId
    playCardAudio('shop-sell')
    showBark('sell')
    setTimeout(() => {
      onsell(cardId)
      sellingCardId = null
    }, 600)
  }

  // === Gold counter animation (P3-E) ===
  let goldFlash = $state<'gain' | 'loss' | null>(null)
  let previousCurrency = $state(untrack(() => currency))

  $effect(() => {
    if (currency !== previousCurrency) {
      goldFlash = currency > previousCurrency ? 'gain' : 'loss'
      previousCurrency = currency
      setTimeout(() => { goldFlash = null }, 400)
    }
  })

  // === Removal burn animation (P2-D) ===
  let burningCardId = $state<string | null>(null)

  // === Shopkeeper bark state ===
  let currentBark = $state<string | null>(null)
  let barkTimer: ReturnType<typeof setTimeout> | null = null

  function showBark(trigger: ShopBarkTrigger) {
    if (barkTimer) clearTimeout(barkTimer)
    currentBark = getShopkeeperBark(trigger)
    barkTimer = setTimeout(() => { currentBark = null }, 3000)
  }

  // === Affordability shake + tooltip state ===
  let shakeItemId = $state<string | null>(null)
  let needMoreGold = $state<{ amount: number; x: number; y: number } | null>(null)

  function handleUnaffordableTap(price: number, itemId: string, event: MouseEvent) {
    const need = price - currency
    shakeItemId = itemId
    needMoreGold = { amount: need, x: event.clientX, y: event.clientY + 30 }
    setTimeout(() => { shakeItemId = null; needMoreGold = null }, 2000)
  }

  // === Relic tooltip state ===
  let relicTooltip = $state<{ relic: ShopRelicItem['relic']; x: number; y: number } | null>(null)
  let relicTooltipTimer: ReturnType<typeof setTimeout> | null = null

  function showRelicTooltip(relic: ShopRelicItem['relic'], event: MouseEvent) {
    if (relicTooltipTimer) clearTimeout(relicTooltipTimer)
    relicTooltip = { relic, x: event.clientX, y: event.clientY }
    relicTooltipTimer = setTimeout(() => { relicTooltip = null }, 3000)
  }

  function dismissRelicTooltip() {
    if (relicTooltipTimer) clearTimeout(relicTooltipTimer)
    relicTooltip = null
  }

  // Dismiss relic tooltip when the player clicks anywhere outside the tooltip panel.
  // pointer-events: none on .tooltip-backdrop means we can't rely on the backdrop click
  // handler any more — so we use a document-level pointerdown listener instead.
  $effect(() => {
    if (!relicTooltip) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null
      if (!target) return
      if (target.closest('.relic-tooltip')) return
      dismissRelicTooltip()
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  })

  // === Removal picker state ===
  let showRemovalPicker = $state(false)
  let pendingRemovalHaggled = $state(false)
  /** Inline leave-shop confirmation: replaces window.confirm() which blocks in headless Chrome. */
  let showLeaveConfirm = $state(false)

  // === Transform picker state ===
  let showTransformPicker = $state(false)
  let pendingTransformHaggled = $state(false)
  let showTransformOptions = $state(false)
  let transformOptions = $state<Card[]>([])

  /** Subscribe to pendingTransformOptions store for replacement card choices */
  $effect(() => {
    const unsub = pendingTransformOptions.subscribe(opts => {
      transformOptions = opts ?? []
      if (opts && opts.length > 0) {
        showTransformPicker = false
        showTransformOptions = true
      }
    })
    return unsub
  })

  /** Cards that can be removed (full active deck, not just the sell slice) */
  let removableCards = $derived(getActiveDeckCards())
  /** Whether deck is large enough to remove a card (must keep > 5) */
  let canRemoveCard = $derived(removableCards.length > 5)
  /** Whether deck is large enough to transform a card (must keep > 5) */
  let canTransformCard = $derived(removableCards.length > 5)

  let deckCount = $derived(getActiveDeckCards().length)

  // Whether relic slots are at capacity — disables relic buy buttons with feedback.
  // Uses $state + $effect to reactively track activeRunState changes (e.g. after buying a relic).
  let relicSlotsFull = $state((() => {
    const run = get(activeRunState)
    return run ? isRelicSlotsFull(run.runRelics) : false
  })())

  $effect(() => {
    const unsub = activeRunState.subscribe(run => {
      relicSlotsFull = run ? isRelicSlotsFull(run.runRelics) : false
    })
    return unsub
  })

  // Get floor from run state
  let floor = $derived.by(() => {
    const run = get(activeRunState)
    return run?.floor?.currentFloor ?? 1
  })

  function handleLeaveShop() {
    // If player has gold and at least one item is affordable, show inline confirm dialog.
    // Previously used window.confirm() which blocks silently in headless Chrome (returns false),
    // causing the leave button to never work during Docker playtests. See docs/gotchas.md 2026-04-12.
    const hasAffordableItem = shopInventory && (
      shopInventory.relics.some(r => currency >= r.price) ||
      shopInventory.cards.some(c => currency >= c.price) ||
      (shopInventory.removalCost != null && currency >= shopInventory.removalCost)
    )
    if (hasAffordableItem && currency > 0) {
      showLeaveConfirm = true
    } else {
      showBark(currency <= 0 ? 'leave_broke' : 'leave_bought')
      playCardAudio('shop-close')
      ondone()
    }
  }

  function confirmLeave() {
    showLeaveConfirm = false
    showBark('leave_with_gold')
    playCardAudio('shop-close')
    ondone()
  }

  function cancelLeave() {
    showLeaveConfirm = false
  }

  /** Chain composition summary for the removal picker */
  let chainComposition = $derived.by(() => {
    const counts = new Map<number, number>()
    for (const card of removableCards) {
      if (card.chainType !== undefined) {
        counts.set(card.chainType, (counts.get(card.chainType) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, name: getChainTypeName(type), color: getChainTypeColor(type), count }))
  })

  function sellPrice(card: Card): number {
    if (card.tier === '3') return 28
    if (card.tier === '2a' || card.tier === '2b') return 16
    return 10
  }

  function openPurchaseModal(purchase: PendingPurchase) {
    pendingPurchase = purchase
    hagglingState = 'idle'
    haggledThisItem = false
    haggledPrice = 0
    quizQuestion = null
    quizAnswers = []
    quizResult = null
    quizSelectedAnswer = null
  }

  function closePurchaseModal() {
    pendingPurchase = null
    hagglingState = 'idle'
  }

  function confirmBuy() {
    if (!pendingPurchase) return
    const haggled = hagglingState === 'result' && quizResult === 'correct'
    const effectivePrice = haggled ? haggledPrice : pendingPurchase.price
    if (currency < effectivePrice) {
      playCardAudio('shop-insufficient')
      return
    }
    // Set purchase animation target
    if (pendingPurchase.type === 'relic') {
      purchasedItemId = pendingPurchase.relicId
    } else if (pendingPurchase.type === 'card') {
      purchasedItemId = `card-${pendingPurchase.cardIndex}`
    }
    setTimeout(() => { purchasedItemId = null }, 1200)
    playCardAudio('shop-purchase')
    if (pendingPurchase.type === 'relic') {
      onbuyRelic(pendingPurchase.relicId, haggled)
    } else if (pendingPurchase.type === 'card') {
      onbuyCard(pendingPurchase.cardIndex, haggled)
    } else if (pendingPurchase.type === 'removal') {
      onbuyRemoval(pendingPurchase.cardId, haggled)
    }
    showBark('purchase')
    closePurchaseModal()
  }

  async function startHaggle() {
    if (!pendingPurchase || haggledThisItem) return
    recordHaggleAttempt()
    haggledThisItem = true
    haggledPrice = Math.floor(pendingPurchase.price * (1 - SHOP_HAGGLE_DISCOUNT))

    // Fetch a quiz question — study mode uses curated deck selector, trivia uses random factsDB fact
    try {
      const run = get(activeRunState)
      if (run?.deckMode?.type === 'study') {
        // Study mode: use curated deck question
        const q = selectNonCombatStudyQuestion(
          'shop',
          run.deckMode.deckId,
          run.deckMode.subDeckId,
          getConfusionMatrix(),
          run.inRunFactTracker ?? null,
          1,
          run.runSeed,
          run.deckMode.examTags,
        )
        if (q) {
          // NonCombatQuizQuestion maps to the Fact-shaped state used by the haggle display
          quizQuestion = {
            id: q.factId,
            correctAnswer: q.correctAnswer,
            quizQuestion: q.question,
            distractors: q.choices.filter(c => c !== q.correctAnswer),
          } as unknown as Fact
          quizAnswers = q.choices
          hagglingState = 'quiz'
          playCardAudio('quiz-appear')
          return
        }
        // Fall through to trivia path if study question unavailable
      }

      const allFacts = factsDB.getTriviaFacts()
      if (allFacts.length === 0) {
        // No facts available — skip quiz, just apply discount
        hagglingState = 'result'
        quizResult = 'correct'
        return
      }
      const fact = allFacts[Math.floor(Math.random() * allFacts.length)]
      const correct = fact.correctAnswer
      const distractors = fact.distractors ?? []
      const options = shuffled([correct, ...distractors.slice(0, 2)])
      quizQuestion = fact
      quizAnswers = options
      hagglingState = 'quiz'
      playCardAudio('quiz-appear')
    } catch {
      // On error, skip quiz
      hagglingState = 'result'
      quizResult = 'correct'
    }
  }

  function submitHaggleAnswer(answer: string) {
    if (!quizQuestion || hagglingState !== 'quiz') return
    quizSelectedAnswer = answer
    const correctAnswer = quizQuestion.correctAnswer
    const isCorrect = answer === correctAnswer

    // Update FSRS for the answered fact
    try {
      const factId = quizQuestion.id
      updateReviewStateByButton(factId, isCorrect ? 'okay' : 'again')
    } catch {
      // FSRS update is best-effort
    }

    quizResult = isCorrect ? 'correct' : 'wrong'
    hagglingState = 'result'

    if (isCorrect) {
      // Auto-complete purchase after brief celebration
      setTimeout(() => {
        confirmBuy()
      }, 800)
    } else {
      // Return to idle after showing wrong answer
      setTimeout(() => {
        hagglingState = 'idle'
        quizResult = null
        quizSelectedAnswer = null
      }, 1800)
    }
  }

  function openRemovalPicker(haggled: boolean) {
    pendingRemovalHaggled = haggled
    showRemovalPicker = true
    closePurchaseModal()
  }

  function pickCardForRemoval(cardId: string) {
    burningCardId = cardId
    playCardAudio('shop-removal-burn')
    showBark('confirm_removal')
    setTimeout(() => {
      onbuyRemoval(cardId, pendingRemovalHaggled)
      showRemovalPicker = false
      burningCardId = null
    }, 800)
  }

  function openTransformPicker(haggled: boolean) {
    pendingTransformHaggled = haggled
    showTransformPicker = true
    closePurchaseModal()
  }

  function pickCardForTransform(cardId: string) {
    burningCardId = cardId
    playCardAudio('shop-removal-burn')
    showBark('confirm_removal')
    // Transform flow: call ontransform → gameFlowController.onShopTransform() runs
    // → pendingTransformOptions store gets populated → our $effect triggers showTransformOptions
    setTimeout(() => {
      ontransform?.(cardId, pendingTransformHaggled)
      showTransformPicker = false
      burningCardId = null
    }, 800)
  }

  function pickTransformReplacement(card: Card) {
    onShopTransformChoice(card)
    showTransformOptions = false
    showBark('purchase')
    playCardAudio('shop-purchase')
  }

  let modalAffordable = $derived(
    pendingPurchase != null &&
    (hagglingState === 'result' && quizResult === 'correct'
      ? currency >= haggledPrice
      : currency >= (pendingPurchase?.price ?? 0))
  )

  $effect(() => {
    playCardAudio('shop-open')
    void ambientAudio.setContext('shop')
    showBark('enter_shop')
  })
</script>

<section class="shop-overlay" bind:this={overlayEl} class:landscape={$isLandscape} aria-label="Shop room">
  <img class="shop-screen-bg" src={bgUrl} alt="" aria-hidden="true" loading="eager" decoding="async" />

  <!-- Small back button top-left -->
  <button type="button" class="leave-shop-btn" data-testid="btn-leave-shop" onclick={handleLeaveShop} aria-label="Leave shop">←</button>

  {#if currentBark}
    <div class="shopkeeper-bark" transition:fade={{ duration: 200 }}>
      <span class="bark-icon">🧙</span>
      <span class="bark-text">{currentBark}</span>
    </div>
  {/if}

  {#if shopInventory && (shopInventory.relics.length > 0 || shopInventory.cards.length > 0)}
    <!-- ─── MAIN AREA: relics left | cards right ───────────────── -->
    <div class="shop-main">

      <!-- Left: Relics -->
      {#if shopInventory.relics.length > 0}
        <div class="relics-column">
          {#if relicSlotsFull}<span class="slots-full-badge">Relic slots full</span>{/if}
          {#each shopInventory.relics as item (item.relic.id)}
            {@const canAfford = currency >= item.price}
            {@const canBuyRelic = canAfford && !relicSlotsFull}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
            <article
              class="relic-float-card"
              class:unaffordable={!canAfford}
              class:slots-full={relicSlotsFull}
              class:shake={shakeItemId === item.relic.id}
              class:purchased={purchasedItemId === item.relic.id}
              onmouseenter={(e) => showRelicTooltip(item.relic, e)}
              onmouseleave={dismissRelicTooltip}
              onclick={(e) => !canAfford && !relicSlotsFull && handleUnaffordableTap(item.price, item.relic.id, e)}
            >
              <div
                class="relic-icon-circle"
                style="border-color: {RARITY_COLORS[item.relic.rarity] ?? '#3b434f'}; box-shadow: 0 0 calc(10px * var(--layout-scale, 1)) {RARITY_COLORS[item.relic.rarity] ?? '#3b434f'}55;"
              >
                <img class="relic-icon-img" src={getRelicIconPath(item.relic.id)} alt={item.relic.name}
                  onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; const fb = img.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = 'block'; }} />
                <span class="relic-icon-emoji-fallback" aria-hidden="true" style="display:none">{item.relic.icon}</span>
              </div>
              <div class="relic-info">
                <div class="relic-float-name" style="color: {RARITY_COLORS[item.relic.rarity] ?? '#e6edf3'}">{item.relic.name}</div>
                <div class="relic-float-desc">{item.relic.description}</div>
              </div>
              <button type="button" class="buy relic-buy-btn" class:disabled={!canBuyRelic} disabled={!canBuyRelic}
                title={relicSlotsFull ? 'Relic slots full' : undefined}
                data-testid="shop-buy-relic-{item.relic.id}"
                onclick={() => canBuyRelic && openPurchaseModal({ type: 'relic', relicId: item.relic.id, price: item.price, name: item.relic.name })}
              >{relicSlotsFull ? 'Full' : `${item.price}g`}</button>
            </article>
          {/each}
        </div>
      {/if}

      <!-- Right: Cards -->
      {#if shopInventory.cards.length > 0}
        <div class="cards-grid">
          {#each shopInventory.cards as item, idx (item.card.id)}
            {@const canAfford = currency >= item.price}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
            <article class="card-visual-item" class:unaffordable={!canAfford}
              class:shake={shakeItemId === `card-${idx}`} class:purchased={purchasedItemId === 'card-' + idx}
              onclick={(e) => !canAfford && handleUnaffordableTap(item.price, `card-${idx}`, e)}
            >
              {#if shopInventory.saleCardIndex === idx}<div class="sale-ribbon">SALE</div>{/if}
              <div class="shop-card-visual-wrapper"
                style="width: calc({SHOP_CARD_W}px * var(--layout-scale, 1)); height: calc({SHOP_CARD_H}px * var(--layout-scale, 1)); --card-w: calc({SHOP_CARD_W}px * var(--layout-scale, 1));"
              ><CardVisual card={item.card} /></div>
              <button type="button" class="card-price-buy" class:disabled={!canAfford} disabled={!canAfford}
                data-testid="shop-buy-card-{idx}"
                onclick={() => canAfford && openPurchaseModal({ type: 'card', cardIndex: idx, price: item.price, name: `${item.card.mechanicName ?? item.card.cardType.toUpperCase()}` })}
              >{#if shopInventory?.saleCardIndex === idx}<span class="original-price">{item.price * 2}g</span> {item.price}g{:else}{item.price}g{/if}</button>
            </article>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ─── SERVICES: compact bottom strip ─────────────────────── -->
    {#if shopInventory.removalCost != null}
      <div class="services-row">
        <article class="service-card service-removal" class:service-unaffordable={!canRemoveCard || currency < shopInventory.removalCost}>
          <span class="service-icon">🔥</span>
          <span class="service-title">Card Removal</span>
          <span class="service-price" class:unaffordable-price={!canRemoveCard || currency < shopInventory.removalCost}>{shopInventory.removalCost}g</span>
          <button type="button" class="service-action" disabled={!canRemoveCard || currency < shopInventory.removalCost}
            data-testid="shop-buy-removal"
            onclick={() => openPurchaseModal({ type: 'removal', cardId: '', price: shopInventory!.removalCost!, name: 'Card Removal' })}
          >Choose a card →</button>
          {#if !canRemoveCard}<span class="service-note">Need 5+ cards</span>{/if}
        </article>

        <article class="service-card service-transform" class:service-unaffordable={!canTransformCard || (shopInventory.transformCost != null && currency < shopInventory.transformCost)}>
          <span class="service-icon">✨</span>
          <span class="service-title">Card Transform</span>
          <span class="service-price" class:unaffordable-price={!canTransformCard || (shopInventory.transformCost != null && currency < shopInventory.transformCost)}>
            {shopInventory.transformCost != null ? `${shopInventory.transformCost}g` : '—'}
          </span>
          <button type="button" class="service-action"
            disabled={!canTransformCard || shopInventory.transformCost == null || currency < shopInventory.transformCost}
            data-testid="shop-buy-transform"
            onclick={() => shopInventory?.transformCost != null && openPurchaseModal({ type: 'transform', price: shopInventory.transformCost, name: 'Card Transform' })}
          >Choose a card →</button>
          {#if !canTransformCard}<span class="service-note">Need 5+ cards</span>{/if}
        </article>
      </div>
    {/if}

  {/if}

  <!-- ─── YOUR DECK (compact sell list — hidden for now, sell via removal) ─── -->
  {#if cards.length > 0 && false}
    <div class="card-list">
      {#each cards as card (card.id)}
        <article
          class="card-item"
          class:selling={sellingCardId === card.id}
          style="border-color: {getChainColor(card.chainType ?? 0)}; box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {getChainGlowColor(card.chainType ?? 0)};"
        >
          <div class="meta">
            <span class="icon">
              <img class="type-icon-img" src={getCardTypeIconPath(card.cardType)} alt={card.cardType}
                onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
              <span style="display:none">{TYPE_EMOJI[card.cardType] ?? '🃏'}</span>
            </span>
            <div class="text">
              <div class="name">{card.mechanicName ?? card.cardType.toUpperCase()}</div>
              <div class="sub">{getEffectLabel(card)}</div>
            </div>
          </div>
          <button type="button" class="sell" onclick={() => handleSell(card.id)}>
            Sell · {sellPrice(card)}g
          </button>
        </article>
      {/each}
    </div>
  {:else if !shopInventory || (shopInventory.relics.length === 0 && shopInventory.cards.length === 0)}
    <!-- Softlock prevention: always provide escape when nothing is available -->
    <div class="empty">
      <p>Nothing here.</p>
      <button type="button" class="empty-back-btn" data-testid="shop-empty-back" onclick={ondone}>Leave</button>
    </div>
  {/if}

</section>

<!-- Purchase Modal -->
{#if pendingPurchase}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Purchase: {pendingPurchase?.name}" data-testid="shop-purchase-modal">
    <div class="modal">
      <div class="modal-title">{pendingPurchase.name}</div>

      {#if hagglingState === 'idle'}
        <div class="modal-price">
          {haggledThisItem ? `Price: ${pendingPurchase.price}g (haggle used)` : `Price: ${pendingPurchase.price}g`}
        </div>

        {#if pendingPurchase.type === 'removal'}
          <!-- Removal: pick card first -->
          {#if canRemoveCard}
            <button
              type="button"
              class="modal-btn modal-btn-primary"
              disabled={!modalAffordable}
              data-testid="shop-btn-buy"
              onclick={() => openRemovalPicker(false)}
            >
              Remove Card ({pendingPurchase.price}g)
            </button>
            {#if !haggledThisItem}
              <button
                type="button"
                class="modal-btn modal-btn-haggle"
                data-testid="shop-btn-haggle"
                onclick={startHaggle}
              >
                Haggle — correct: 30% off
              </button>
            {/if}
          {:else}
            <div class="modal-note">Need more than 5 cards to remove one.</div>
          {/if}
        {:else if pendingPurchase.type === 'transform'}
          <!-- Transform: pick card first -->
          {#if canTransformCard}
            <button
              type="button"
              class="modal-btn modal-btn-primary"
              disabled={!modalAffordable}
              data-testid="shop-btn-transform"
              onclick={() => openTransformPicker(false)}
            >
              Transform Card ({pendingPurchase.price}g)
            </button>
            {#if !haggledThisItem}
              <button
                type="button"
                class="modal-btn modal-btn-haggle"
                data-testid="shop-btn-haggle"
                onclick={startHaggle}
              >
                Haggle — correct: 30% off
              </button>
            {/if}
          {:else}
            <div class="modal-note">Need more than 5 cards to transform one.</div>
          {/if}
        {:else}
          <button
            type="button"
            class="modal-btn modal-btn-primary"
            disabled={!modalAffordable}
            data-testid="shop-btn-buy"
            onclick={confirmBuy}
          >
            Buy ({pendingPurchase.price}g)
          </button>
          {#if !haggledThisItem}
            <button
              type="button"
              class="modal-btn modal-btn-haggle"
              data-testid="shop-btn-haggle"
              onclick={startHaggle}
            >
              Haggle — correct: 30% off
            </button>
          {/if}
        {/if}

        <button type="button" class="modal-btn modal-btn-cancel" data-testid="shop-btn-cancel" onclick={closePurchaseModal}>
          Cancel
        </button>

      {:else if hagglingState === 'quiz' && quizQuestion}
        <div class="quiz-question">{quizQuestion.quizQuestion}</div>
        <div class="quiz-answers">
          {#each quizAnswers as answer}
            <button
              type="button"
              class="quiz-answer-btn"
              onclick={() => submitHaggleAnswer(answer)}
            >
              {displayAnswer(answer)}
            </button>
          {/each}
        </div>
        <div class="modal-note">Correct = 30% off ({haggledPrice}g). Wrong = original price kept, haggle disabled.</div>

      {:else if hagglingState === 'result'}
        {#if quizResult === 'correct'}
          <div class="haggle-success">Haggled! Price: {haggledPrice}g</div>
          <div class="modal-note">Completing purchase…</div>
        {:else}
          <div class="haggle-fail">Wrong. Original price kept: {pendingPurchase?.price}g</div>
          {#if quizQuestion}
            <div class="modal-note">Answer: {displayAnswer(quizQuestion.correctAnswer)}</div>
          {/if}
          <div class="modal-note">Returning to shop…</div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<!-- Card Removal Picker -->
{#if showRemovalPicker}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose card to remove">
    <div class="modal modal-removal">
      <div class="modal-title">Remove Which Card?</div>
      {#if chainComposition.length > 0}
        <div class="chain-composition">
          {#each chainComposition as entry}
            <span class="chain-comp-item" style="color: {entry.color};">
              <ChainIcon chainType={entry.type} size={12} />
              {entry.name} ×{entry.count}
            </span>
          {/each}
        </div>
      {/if}
      <div class="removal-list">
        {#each removableCards as card (card.id)}
          <button
            type="button"
            class="removal-card-btn"
            class:burning={burningCardId === card.id}
            onclick={() => pickCardForRemoval(card.id)}
          >
            <span class="removal-card-info">
              <span class="removal-card-name">{card.mechanicName ?? card.cardType.toUpperCase()}</span>
              {#if card.chainType !== undefined}
                <span class="removal-chain-badge" style="color: {getChainTypeColor(card.chainType)};">
                  <ChainIcon chainType={card.chainType} size={10} />
                  {getChainTypeName(card.chainType)}
                </span>
              {/if}
            </span>
            <span class="removal-card-power">{getEffectLabel(card)}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="modal-btn modal-btn-cancel" onclick={() => { showRemovalPicker = false }}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<!-- Card Transform Picker: choose which card to transform -->
{#if showTransformPicker}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose card to transform">
    <div class="modal modal-removal">
      <div class="modal-title">Transform Which Card?</div>
      <div class="modal-note">Pick a card — it will be destroyed and you'll pick from 3 replacements.</div>
      {#if chainComposition.length > 0}
        <div class="chain-composition">
          {#each chainComposition as entry}
            <span class="chain-comp-item" style="color: {entry.color};">
              <ChainIcon chainType={entry.type} size={12} />
              {entry.name} ×{entry.count}
            </span>
          {/each}
        </div>
      {/if}
      <div class="removal-list">
        {#each removableCards as card (card.id)}
          <button
            type="button"
            class="removal-card-btn"
            class:burning={burningCardId === card.id}
            onclick={() => pickCardForTransform(card.id)}
          >
            <span class="removal-card-info">
              <span class="removal-card-name">{card.mechanicName ?? card.cardType.toUpperCase()}</span>
              {#if card.chainType !== undefined}
                <span class="removal-chain-badge" style="color: {getChainTypeColor(card.chainType)};">
                  <ChainIcon chainType={card.chainType} size={10} />
                  {getChainTypeName(card.chainType)}
                </span>
              {/if}
            </span>
            <span class="removal-card-power">{getEffectLabel(card)}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="modal-btn modal-btn-cancel" onclick={() => { showTransformPicker = false }}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<!-- Transform Options: pick replacement card from generated options -->
{#if showTransformOptions && transformOptions.length > 0}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose replacement card">
    <div class="modal modal-transform-options">
      <div class="modal-title">Pick Your Replacement</div>
      <div class="modal-note">One of these joins your deck.</div>
      <div class="transform-options-grid">
        {#each transformOptions as card (card.id)}
          <button
            type="button"
            class="transform-card-btn"
            aria-label="Pick {card.mechanicName ?? card.cardType}"
            onclick={() => pickTransformReplacement(card)}
          >
            <div
              class="shop-card-visual-wrapper"
              style="width: calc({MODAL_CARD_W}px * var(--layout-scale, 1)); height: calc({MODAL_CARD_H}px * var(--layout-scale, 1)); --card-w: calc({MODAL_CARD_W}px * var(--layout-scale, 1));"
            >
              <CardVisual {card} />
            </div>
          </button>
        {/each}
      </div>
      <button type="button" class="modal-btn modal-btn-cancel" onclick={() => { showTransformOptions = false }}>
        Cancel
      </button>
    </div>
  </div>
{/if}

{#if needMoreGold}
  <div class="need-more-tooltip" style="left: {Math.min(needMoreGold.x, globalThis.innerWidth - 160)}px; top: {needMoreGold.y}px;">
    Need {needMoreGold.amount} more gold
  </div>
{/if}

{#if relicTooltip}
  <!-- tooltip-backdrop: pointer-events: none makes it click-through; dismiss is handled by document pointerdown $effect -->
  <div class="tooltip-backdrop" aria-hidden="true"></div>
  <div
    class="relic-tooltip"
    role="tooltip"
    style="left: {Math.min(relicTooltip.x, globalThis.innerWidth - 230)}px; top: {Math.max(relicTooltip.y - 120, 8)}px;"
  >
    <div class="relic-tooltip-name" style="color: {RARITY_COLORS[relicTooltip.relic.rarity] ?? '#fbbf24'}">
      {relicTooltip.relic.icon} {relicTooltip.relic.name}
    </div>
    <div class="relic-tooltip-desc">{relicTooltip.relic.description}</div>
    <div class="relic-tooltip-trigger">Trigger: Permanent</div>
  </div>
{/if}

{#if showLeaveConfirm}
  <!-- Inline leave confirmation — replaces window.confirm() which headless Chrome blocks silently -->
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Leave shop confirmation">
    <div class="modal leave-confirm-modal">
      <div class="modal-title">Leave the shop?</div>
      <div class="modal-desc">You still have gold and can afford items here.</div>
      <div class="leave-confirm-btns">
        <button type="button" class="modal-btn modal-btn-confirm" data-testid="btn-leave-confirm" onclick={confirmLeave}>Leave anyway</button>
        <button type="button" class="modal-btn modal-btn-cancel" data-testid="btn-leave-cancel" onclick={cancelLeave}>Stay</button>
      </div>
    </div>
  </div>
{/if}

{#if showRoomTransition}
  <ParallaxTransition
    imageUrl={bgUrl}
    depthUrl={depthUrl}
    type="enter"
    onComplete={() => { showRoomTransition = false }}
    onSettle={() => {
      tick().then(() => {
        if (!overlayEl) return
        staggerPopIn({
          container: overlayEl,
          elements: [
            '.leave-shop-btn',
            '.shop-main',
            '.services-row',
          ],
          totalDuration: 2800,
        })
      })
    }}
    persist
  />
{/if}

<style>
  .shop-screen-bg {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: -1;
    pointer-events: none;
  }

  .shop-overlay {
    position: fixed;
    top: var(--run-viewport-top, 0px);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 150;
    background: none;
    color: #e6edf3;
    padding: calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    overflow: hidden;
  }

  /* ── Leave shop button — compact arrow pill ──────────────── */
  .leave-shop-btn {
    z-index: 5;
    background: rgba(10, 15, 25, 0.8);
    border: 1px solid rgba(194, 157, 72, 0.4);
    color: #e6edf3;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    width: fit-content;
    flex-shrink: 0;
  }
  .leave-shop-btn:hover {
    background: rgba(30, 40, 55, 0.95);
    border-color: rgba(194, 157, 72, 0.8);
  }

  /* ── Main area: relics left | cards right ──────────────────── */
  .shop-main {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  /* ── Left column: relics ───────────────────────────────────── */
  .relics-column {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: calc(280px * var(--layout-scale, 1));
    flex-shrink: 0;
    background: rgba(13, 17, 23, 0.65);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  /* ── Section labels ─────────────────────────────────────────── */
  .section-label {
    margin-top: calc(10px * var(--layout-scale, 1));
    margin-bottom: calc(4px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(194, 157, 72, 0.35) 0%, transparent 100%);
  }

  .relic-label {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .slots-full-badge {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  .relic-float-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    min-width: calc(140px * var(--layout-scale, 1));
    background: rgba(13, 17, 23, 0.85);
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(100, 116, 139, 0.2);
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    position: relative;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .relic-float-card:hover:not(.unaffordable) {
    border-color: rgba(194, 157, 72, 0.4);
    box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(194, 157, 72, 0.15);
  }

  /* Floating bob animation */
  @keyframes relic-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(calc(-6px * var(--layout-scale, 1))); }
  }

  .relic-info {
    flex: 1;
    min-width: 0;
  }

  .relic-icon-circle {
    width: calc(48px * var(--layout-scale, 1));
    height: calc(48px * var(--layout-scale, 1));
    border-radius: 50%;
    border: calc(2px * var(--layout-scale, 1)) solid;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.9);
    flex-shrink: 0;
    animation: relic-float 3s ease-in-out infinite;
    overflow: hidden;
  }

  .relic-icon-img {
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .relic-icon-emoji-fallback {
    font-size: calc(28px * var(--layout-scale, 1));
    line-height: 1;
  }

  .relic-float-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    text-align: left;
    line-height: 1.2;
  }

  .rarity-pill {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px calc(5px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  .relic-float-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    text-align: left;
    line-height: 1.3;
  }

  .relic-buy-btn {
    width: 100%;
  }

  .slots-full {
    filter: grayscale(0.5);
    opacity: 0.75;
  }

  /* ── Cards grid: CardVisual frames ─────────────────────────── */
  .cards-grid {
    display: flex;
    flex-wrap: wrap;
    gap: calc(8px * var(--layout-scale, 1));
    align-items: center;
    align-content: center;
    justify-content: center;
    background: rgba(13, 17, 23, 0.55);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
  }

  .card-visual-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  /* Wrapper required by CardVisual — must be position:relative + explicit w/h + --card-w */
  .shop-card-visual-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* Combined price + buy pill — the gold badge IS the buy button */
  .card-price-buy {
    background: rgba(107, 79, 0, 0.9);
    border: 1px solid #f1c40f;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #f9d56e;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-height: calc(32px * var(--layout-scale, 1));
    white-space: nowrap;
    text-align: center;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .card-price-buy:hover:not(:disabled) {
    background: rgba(139, 105, 20, 0.9);
  }

  .card-price-buy.disabled,
  .card-price-buy:disabled {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    cursor: not-allowed;
  }

  .original-price {
    text-decoration: line-through;
    color: #6b7280;
    font-weight: 400;
    margin-right: calc(4px * var(--layout-scale, 1));
  }

  /* ── Services row ───────────────────────────────────────────── */
  .services-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .service-card {
    flex: 1;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    background: rgba(13, 17, 23, 0.88);
  }

  .service-removal {
    border: 1px solid #7F77DD;
    background: rgba(127, 119, 221, 0.12);
  }

  .service-transform {
    border: 1px solid #D85A30;
    background: rgba(216, 90, 48, 0.12);
  }

  /* Unaffordable: red-tinted border, keep fully visible */
  .service-unaffordable {
    opacity: 1;
    border-color: rgba(239, 68, 68, 0.4);
  }
  .service-unaffordable .service-action {
    color: #4b5563;
  }
  .service-unaffordable .service-price {
    color: #ef4444;
  }

  .service-icon {
    font-size: calc(24px * var(--layout-scale, 1));
  }

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .service-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 600;
    color: #e6edf3;
  }

  .service-price {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #f59e0b;
  }

  .unaffordable-price {
    color: #ef4444;
  }

  .service-desc {
    font-size: calc(14px * var(--text-scale, 1));
    color: #9ba4ad;
    line-height: 1.4;
  }

  .service-action {
    margin-top: auto;
    background: none;
    border: none;
    color: #93c5fd;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    padding: calc(6px * var(--layout-scale, 1)) 0;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .service-action:disabled {
    color: #4b5563;
    cursor: not-allowed;
  }

  .service-action:hover:not(:disabled) {
    color: #bfdbfe;
    text-decoration: underline;
  }

  .service-note {
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
  }

  .service-card .service-desc {
    display: none;
  }

  .shop-overlay:not(.landscape) .services-row {
    grid-template-columns: 1fr;
  }

  /* ── Your Deck compact list ─────────────────────────────────── */
  .card-list {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .card-item {
    position: relative;
    border: 1px solid #3b434f;
    border-radius: calc(12px * var(--layout-scale, 1));
    background: rgba(13, 17, 23, 0.82);
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .meta {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    min-width: 0;
    flex: 1;
  }

  .icon {
    font-size: calc(20px * var(--layout-scale, 1));
    line-height: 1;
    flex-shrink: 0;
  }

  .type-icon-img {
    width: 1.2em;
    height: 1.2em;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    vertical-align: middle;
  }

  .text {
    display: grid;
    gap: calc(2px * var(--layout-scale, 1));
    min-width: 0;
  }

  .name {
    font-weight: 700;
    font-size: calc(14px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: #9ba4ad;
    font-size: calc(12px * var(--layout-scale, 1));
    overflow: visible;
    display: block;
    white-space: normal;
    line-height: 1.4;
  }

  /* ── Buy / Sell buttons ──────────────────────────────────────── */
  .buy {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid #f1c40f;
    background: #6b4f00;
    color: #f9d56e;
    padding: 0 calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  }

  .buy:hover:not(:disabled) {
    background: #8b6914;
  }

  .buy.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: #4b5563;
    background: #1f2937;
    color: #6b7280;
  }

  .sell {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid #f59e0b;
    background: #92400e;
    color: #fef3c7;
    padding: 0 calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
    cursor: pointer;
  }

  /* ── Affordability states ───────────────────────────────────── */
  .unaffordable {
    filter: grayscale(0.3);
    border-color: rgba(239, 68, 68, 0.3) !important;
    transition: filter 300ms ease;
  }

  .unaffordable .buy {
    border-color: #ef4444 !important;
    color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }

  .shake {
    animation: shake-horizontal 150ms ease;
  }

  @keyframes shake-horizontal {
    0% { transform: translateX(0); }
    25% { transform: translateX(calc(-4px * var(--layout-scale, 1))); }
    50% { transform: translateX(calc(4px * var(--layout-scale, 1))); }
    75% { transform: translateX(calc(-4px * var(--layout-scale, 1))); }
    100% { transform: translateX(0); }
  }

  /* ── Sale ribbon ────────────────────────────────────────────── */
  .sale-ribbon {
    position: absolute;
    top: calc(6px * var(--layout-scale, 1));
    right: calc(-4px * var(--layout-scale, 1));
    background: #dc2626;
    color: white;
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 800;
    text-transform: uppercase;
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(3px * var(--layout-scale, 1));
    z-index: 2;
    letter-spacing: 1px;
  }

  /* ── Empty state ────────────────────────────────────────────── */
  .empty {
    margin-top: calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid #3b434f;
    background: rgba(13, 17, 23, 0.82);
    padding: calc(14px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    color: #9ba4ad;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .empty-back-btn {
    background: #1f2937;
    border: 1px solid #4b5563;
    color: #e6edf3;
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    cursor: pointer;
    font-size: calc(13px * var(--text-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
  }

  /* ── Need-more-gold tooltip ─────────────────────────────────── */
  .need-more-tooltip {
    position: fixed;
    z-index: 200;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    pointer-events: none;
    white-space: nowrap;
  }

  /* ── Relic tooltip ──────────────────────────────────────────── */
  .tooltip-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 199;
    border: none;
    padding: 0;
    cursor: default;
    /* pointer-events: none — see C-004 regression note in original overlay */
    pointer-events: none;
  }

  .relic-tooltip {
    position: fixed;
    z-index: 200;
    max-width: calc(220px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5);
  }

  .relic-tooltip-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 800;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .relic-tooltip-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #e2e8f0;
    line-height: 1.4;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .relic-tooltip-trigger {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
  }

  /* ── Modals ─────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .modal {
    background: #161b22;
    border: 1px solid #3b434f;
    border-radius: calc(16px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(380px * var(--layout-scale, 1));
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .modal-removal {
    max-height: 70vh;
    overflow-y: auto;
  }

  .modal-transform-options {
    max-width: calc(700px * var(--layout-scale, 1));
  }

  .modal-title {
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 800;
    color: #f1c40f;
    text-align: center;
  }

  .modal-price {
    text-align: center;
    font-size: calc(14px * var(--layout-scale, 1));
    color: #f9d56e;
    font-weight: 700;
  }

  .modal-note {
    text-align: center;
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8b949e;
  }

  .modal-btn {
    min-height: calc(48px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    font-size: calc(13px * var(--layout-scale, 1));
    cursor: pointer;
    border: 1px solid transparent;
  }

  .modal-btn-primary {
    background: #6b4f00;
    border-color: #f1c40f;
    color: #f9d56e;
  }

  .modal-btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .modal-btn-primary:hover:not(:disabled) {
    background: #8b6914;
  }

  .modal-btn-haggle {
    background: #1a2a4a;
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .modal-btn-haggle:hover {
    background: #1e3a5f;
  }

  .modal-btn-cancel {
    background: #1f2937;
    border-color: #4b5563;
    color: #9ba4ad;
  }

  .modal-btn-cancel:hover {
    background: #374151;
  }

  /* ── Leave confirm modal ────────────────────────────────────── */
  .leave-confirm-modal {
    max-width: calc(320px * var(--layout-scale, 1));
  }

  .modal-desc {
    font-size: calc(13px * var(--layout-scale, 1));
    color: #9ba4ad;
    text-align: center;
    margin-bottom: calc(12px * var(--layout-scale, 1));
  }

  .leave-confirm-btns {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    justify-content: center;
  }

  .modal-btn-confirm {
    background: #b91c1c;
    border: 1px solid #ef4444;
    color: #fef2f2;
    padding: calc(8px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 600;
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 120ms;
  }

  .modal-btn-confirm:hover {
    background: #dc2626;
  }

  /* ── Transform options grid ─────────────────────────────────── */
  .transform-options-grid {
    display: flex;
    gap: calc(16px * var(--layout-scale, 1));
    justify-content: center;
    flex-wrap: wrap;
    padding: calc(8px * var(--layout-scale, 1)) 0;
  }

  .transform-card-btn {
    background: none;
    border: calc(2px * var(--layout-scale, 1)) solid rgba(148, 163, 184, 0.3);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .transform-card-btn:hover {
    border-color: #f1c40f;
    box-shadow: 0 0 calc(16px * var(--layout-scale, 1)) rgba(241, 196, 15, 0.3);
  }

  /* ── Haggle quiz ────────────────────────────────────────────── */
  .quiz-question {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #e6edf3;
    text-align: center;
    line-height: 1.5;
    padding: 0 calc(4px * var(--layout-scale, 1));
  }

  .quiz-answers {
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .quiz-answer-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    background: #1a2a4a;
    border: 1px solid #3b82f6;
    color: #e6edf3;
    font-size: calc(13px * var(--layout-scale, 1));
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    text-align: left;
  }

  .quiz-answer-btn:hover {
    background: #1e3a5f;
  }

  .haggle-success {
    text-align: center;
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 800;
    color: #2ecc71;
  }

  .haggle-fail {
    text-align: center;
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 800;
    color: #e74c3c;
  }

  /* ── Removal / Transform picker ─────────────────────────────── */
  .removal-list {
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
    max-height: 50vh;
    overflow-y: auto;
  }

  .removal-card-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    background: #1a2a1a;
    border: 1px solid #2f914f;
    color: #e6edf3;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .removal-card-btn:hover {
    background: #1f3d1f;
  }

  .removal-card-name {
    font-weight: 700;
    font-size: calc(13px * var(--layout-scale, 1));
  }

  .removal-card-power {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #9ba4ad;
    white-space: nowrap;
  }

  .chain-composition {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--layout-scale, 1));
    opacity: 0.8;
  }

  .chain-comp-item {
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .removal-card-info {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .removal-chain-badge {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
  }

  /* ── Landscape layout ───────────────────────────────────────── */
  .shop-overlay.landscape {
    background: rgba(5, 8, 12, 0.7);
    align-content: start;
    justify-items: center;
    padding: 0;
  }

  .shop-overlay.landscape > * {
    width: min(90vw, calc(1200px * var(--layout-scale, 1)));
    box-sizing: border-box;
  }

  /* Landscape: relics row fits more icons before wrapping */
  .shop-overlay.landscape .relics-row {
    flex-wrap: wrap;
  }

  /* ── Shopkeeper bark ────────────────────────────────────────── */
  .shopkeeper-bark {
    position: sticky;
    top: calc(44px * var(--layout-scale, 1));
    z-index: 9;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: calc(8px * var(--layout-scale, 1));
    margin: calc(4px * var(--layout-scale, 1)) 0;
  }

  .bark-icon {
    font-size: calc(20px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .bark-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Sell tear animation ────────────────────────────────────── */
  .selling {
    animation: sell-tear 600ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes sell-tear {
    0% { transform: scale(1); opacity: 1; }
    30% { transform: scale(1.02); clip-path: polygon(0 0, 48% 0, 48% 100%, 0 100%); }
    60% { transform: scale(1.02); clip-path: polygon(0 0, 45% 0, 52% 100%, 0 100%); opacity: 0.7; }
    100% { transform: scale(0.9) translateY(calc(-10px * var(--layout-scale, 1))); opacity: 0; clip-path: polygon(0 0, 40% 0, 55% 100%, 0 100%); }
  }

  /* ── Gold counter animation ─────────────────────────────────── */
  .gold-gain {
    animation: gold-flash-green 400ms ease;
  }

  .gold-loss {
    animation: gold-flash-red 400ms ease;
  }

  @keyframes gold-flash-green {
    0% { color: #f59e0b; }
    30% { color: #22c55e; transform: scale(1.1); }
    100% { color: #f59e0b; transform: scale(1); }
  }

  @keyframes gold-flash-red {
    0% { color: #f59e0b; }
    30% { color: #ef4444; transform: scale(1.1); }
    100% { color: #f59e0b; transform: scale(1); }
  }

  /* ── Purchase exit animation ────────────────────────────────── */
  .purchased {
    animation: purchase-exit 800ms ease-out forwards;
  }

  @keyframes purchase-exit {
    0% { transform: scale(1); opacity: 1; }
    30% { transform: scale(1.02); opacity: 1; filter: brightness(1.3); }
    100% { transform: scale(0.8) translateY(calc(20px * var(--layout-scale, 1))); opacity: 0; }
  }

  /* ── Card burn animation ────────────────────────────────────── */
  .burning {
    animation: card-burn 800ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes card-burn {
    0% { transform: scale(1); opacity: 1; filter: brightness(1); }
    20% { transform: scale(1.05); filter: brightness(1.5) saturate(2); }
    50% { filter: brightness(2) saturate(3) hue-rotate(-15deg); opacity: 0.8; }
    80% { transform: scale(0.95); filter: brightness(1.5) saturate(1.5) hue-rotate(-30deg); opacity: 0.4; }
    100% { transform: scale(0.8) translateY(calc(-10px * var(--layout-scale, 1))); opacity: 0; filter: brightness(0.5); }
  }
</style>
