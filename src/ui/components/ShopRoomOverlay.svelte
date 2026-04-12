<script lang="ts">
  import type { Card } from '../../data/card-types'
  import type { Fact } from '../../data/types'
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getCardTypeIconPath, getCardTypeEmoji } from '../utils/iconAssets'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import { factsDB } from '../../services/factsDB'
  import { updateReviewStateByButton } from '../stores/playerData'
  import { shuffled } from '../../services/randomUtils'
  import { recordHaggleAttempt } from '../../services/gameFlowController'
  import { SHOP_HAGGLE_DISCOUNT } from '../../data/balance'
  import { get } from 'svelte/store'
  import { activeRunState } from '../../services/runStateStore'
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
      case 1: return 'none' // green (default)
      case 2: return 'hue-rotate(100deg)' // blue
      case 3: return 'hue-rotate(200deg)' // purple
      case 4: return 'hue-rotate(-40deg)' // orange
      case 5: return 'hue-rotate(60deg) saturate(2)' // gold
      default: return 'none'
    }
  }

  function getMasteryBonusValue(card: Card): number {
    if (!card.mechanicId) return 0
    const _s = getMasteryStats(card.mechanicId, card.masteryLevel ?? 0)
    const _m = getMechanicDefinition(card.mechanicId)
    return _s && _m ? _s.qpValue - _m.quickPlayValue : 0
  }

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
  }

  type PendingPurchase =
    | { type: 'relic'; relicId: string; price: number; name: string }
    | { type: 'card'; cardIndex: number; price: number; name: string }
    | { type: 'removal'; cardId: string; price: number; name: string }

  type HaggleState = 'idle' | 'quiz' | 'result'

  interface Props {
    cards: Card[]
    currency: number
    shopInventory: ShopInventory | null
    onsell: (cardId: string) => void
    onbuyRelic: (relicId: string, haggled: boolean) => void
    onbuyCard: (cardIndex: number, haggled: boolean) => void
    onbuyRemoval: (cardId: string, haggled: boolean) => void
    ondone: () => void
  }

  let { cards, currency, shopInventory, onsell, onbuyRelic, onbuyCard, onbuyRemoval, ondone }: Props = $props()
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

  // === Removal picker state ===
  let showRemovalPicker = $state(false)
  let pendingRemovalHaggled = $state(false)

  /** Cards that can be removed (full active deck, not just the sell slice) */
  let removableCards = $derived(getActiveDeckCards())
  /** Whether deck is large enough to remove a card (must keep > 5) */
  let canRemoveCard = $derived(removableCards.length > 5)

  let deckCount = $derived(getActiveDeckCards().length)

  // Get floor from run state
  let floor = $derived.by(() => {
    const run = get(activeRunState)
    return run?.floor?.currentFloor ?? 1
  })

  function handleLeaveShop() {
    // If player has gold and at least one item is affordable, confirm
    const hasAffordableItem = shopInventory && (
      shopInventory.relics.some(r => currency >= r.price) ||
      shopInventory.cards.some(c => currency >= c.price) ||
      (shopInventory.removalCost != null && currency >= shopInventory.removalCost)
    )
    if (hasAffordableItem && currency > 0) {
      if (confirm('Leave without buying?')) {
        showBark('leave_with_gold')
        playCardAudio('shop-close')
        ondone()
      }
    } else {
      showBark(currency <= 0 ? 'leave_broke' : 'leave_bought')
      playCardAudio('shop-close')
      ondone()
    }
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
  <div class="shop-hud">
    <button type="button" class="hud-back" data-testid="btn-leave-shop" onclick={handleLeaveShop} aria-label="Leave shop">←</button>
    <div class="hud-gold">
      <span class="gold-icon">🪙</span>
      <span class="gold-amount" class:gold-gain={goldFlash === 'gain'} class:gold-loss={goldFlash === 'loss'}>{currency}g</span>
    </div>
    <span class="hud-info">Shop · Floor {floor}</span>
    <span class="hud-deck">Deck: {deckCount} cards</span>
  </div>

  {#if currentBark}
    <div class="shopkeeper-bark" transition:fade={{ duration: 200 }}>
      <span class="bark-icon">🧙</span>
      <span class="bark-text">{currentBark}</span>
    </div>
  {/if}

  {#if shopInventory && (shopInventory.relics.length > 0 || shopInventory.cards.length > 0)}
    {#if shopInventory.relics.length > 0}
      <div class="section-label">RELICS</div>
      <div class="card-list">
        {#each shopInventory.relics as item (item.relic.id)}
          {@const canAfford = currency >= item.price}
          <article
            class="card-item relic-item"
            class:unaffordable={!canAfford}
            class:shake={shakeItemId === item.relic.id}
            class:purchased={purchasedItemId === item.relic.id}
            style="border-color: {RARITY_COLORS[item.relic.rarity] ?? '#3b434f'}40"
            onmouseenter={(e) => showRelicTooltip(item.relic, e)}
            onmouseleave={dismissRelicTooltip}
            onclick={(e) => !canAfford && handleUnaffordableTap(item.price, item.relic.id, e)}
          >
            <div class="meta">
              <span class="icon">{item.relic.icon}</span>
              <div class="text">
                <div class="name" style="color: {RARITY_COLORS[item.relic.rarity] ?? '#e6edf3'}">{item.relic.name}</div>
                <span class="rarity-pill" style="background: {RARITY_COLORS[item.relic.rarity]}20; color: {RARITY_COLORS[item.relic.rarity]}; border: 1px solid {RARITY_COLORS[item.relic.rarity]}40;">
                  {item.relic.rarity}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="buy"
              class:disabled={!canAfford}
              disabled={!canAfford}
              data-testid="shop-buy-relic-{item.relic.id}"
              aria-label="Buy {item.relic.name} for {item.price}g"
              onclick={() => canAfford && openPurchaseModal({ type: 'relic', relicId: item.relic.id, price: item.price, name: item.relic.name })}
            >
              {item.price}g
            </button>
          </article>
        {/each}
      </div>
    {/if}

    {#if shopInventory.cards.length > 0}
      <div class="section-label">LEARNING CARDS</div>
      <div class="card-list">
        {#each shopInventory.cards as item, idx (item.card.id)}
          {@const canAfford = currency >= item.price}
          <article
            class="card-item"
            class:unaffordable={!canAfford}
            class:shake={shakeItemId === `card-${idx}`}
            class:purchased={purchasedItemId === 'card-' + idx}
            style="border-top: 6px solid {getChainColor(item.card.chainType ?? 0)}; border-color: {getChainColor(item.card.chainType ?? 0)}; box-shadow: 0 0 6px {getChainGlowColor(item.card.chainType ?? 0)};"
            onclick={(e) => !canAfford && handleUnaffordableTap(item.price, `card-${idx}`, e)}
          >
            {#if shopInventory.saleCardIndex === idx}
              <div class="sale-ribbon">SALE</div>
            {/if}
            <div class="meta">
              <span class="icon">
                <img class="type-icon-img" src={getCardTypeIconPath(item.card.cardType)} alt={item.card.cardType}
                  onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
                <span style="display:none">{TYPE_EMOJI[item.card.cardType] ?? '🃏'}</span>
              </span>
              <div class="text">
                <div class="name">
                  {item.card.mechanicName ?? item.card.cardType.toUpperCase()}
                  {#if (item.card.masteryLevel ?? 0) > 0}
                    <span class="mastery-indicator">
                      <span class="mastery-icon" style="filter: {getMasteryIconFilter(item.card.masteryLevel ?? 0)}">✦</span>
                      <span class="mastery-bonus">+{getMasteryBonusValue(item.card)}</span>
                    </span>
                  {/if}
                </div>
                <div class="card-sub-row">
                  <span class="sub">{getEffectLabel(item.card)}</span>
                  <span class="chain-dot" style="background: {getChainColor(item.card.chainType ?? 0)}; box-shadow: 0 0 4px {getChainGlowColor(item.card.chainType ?? 0)};" title="{getChainTypeName(item.card.chainType ?? 0)}"></span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="buy"
              class:disabled={!canAfford}
              disabled={!canAfford}
              data-testid="shop-buy-card-{idx}"
              aria-label="Buy {item.card.mechanicName ?? item.card.cardType} for {item.price}g"
              onclick={() => canAfford && openPurchaseModal({ type: 'card', cardIndex: idx, price: item.price, name: `${item.card.mechanicName ?? item.card.cardType.toUpperCase()}` })}
            >
              {#if shopInventory?.saleCardIndex === idx}
                <span class="original-price">{item.price * 2}g</span> {item.price}g
              {:else}
                {item.price}g
              {/if}
            </button>
          </article>
        {/each}
      </div>
    {/if}

    {#if shopInventory.removalCost != null}
      <div class="section-label">SERVICES</div>
      <div class="services-row">
        <!-- Card Removal -->
        <article class="service-card service-removal">
          <div class="service-icon">🔥</div>
          <div class="service-header">
            <span class="service-title">Card Removal</span>
            <span class="service-price" class:unaffordable-price={!canRemoveCard || currency < shopInventory.removalCost}>{shopInventory.removalCost}g</span>
          </div>
          <div class="service-desc">Destroy a card from your deck permanently. A leaner deck draws stronger hands.</div>
          <button
            type="button"
            class="service-action"
            disabled={!canRemoveCard || currency < shopInventory.removalCost}
            data-testid="shop-buy-removal"
            onclick={() => openPurchaseModal({ type: 'removal', cardId: '', price: shopInventory!.removalCost!, name: 'Card Removal' })}
          >
            Choose a card →
          </button>
          {#if !canRemoveCard}
            <span class="service-note">Need more than 5 cards</span>
          {/if}
        </article>

        <!-- Card Transformation (placeholder — logic not wired yet) -->
        <article class="service-card service-transform">
          <div class="service-icon">✨</div>
          <div class="service-header">
            <span class="service-title">Card Transform</span>
            <span class="service-price service-price-disabled">Coming soon</span>
          </div>
          <div class="service-desc">Destroy a card, replaced by one of 3 random options. A gamble — will fate favor you?</div>
          <button
            type="button"
            class="service-action"
            disabled
          >
            Choose a card →
          </button>
        </article>
      </div>
    {/if}
  {/if}

  {#if cards.length > 0}
    <div class="section-label">YOUR DECK</div>
    <div class="card-list">
      {#each cards as card (card.id)}
        <article
          class="card-item"
          class:selling={sellingCardId === card.id}
          style="border-color: {getChainColor(card.chainType ?? 0)}; box-shadow: 0 0 6px {getChainGlowColor(card.chainType ?? 0)};"
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
    <div class="empty">Nothing available.</div>
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
          <div class="haggle-fail">Wrong! Original price kept: {pendingPurchase?.price}g</div>
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

{#if needMoreGold}
  <div class="need-more-tooltip" style="left: {Math.min(needMoreGold.x, globalThis.innerWidth - 160)}px; top: {needMoreGold.y}px;">
    Need {needMoreGold.amount} more gold
  </div>
{/if}

{#if relicTooltip}
  <button class="tooltip-backdrop" onclick={dismissRelicTooltip} aria-label="Dismiss tooltip"></button>
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
            '.shop-hud',
            '.section-label',
            '.card-list',
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
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 0;
    pointer-events: none;
  }

  .shop-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: linear-gradient(180deg, rgba(16, 18, 20, 0.75) 0%, rgba(31, 35, 41, 0.75) 100%);
    color: #e6edf3;
    padding: 0 calc(16px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    display: grid;
    align-content: start;
    gap: calc(8px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .shop-hud {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    height: calc(48px * var(--layout-scale, 1));
    background: rgba(10, 15, 25, 0.95);
    padding: 0 calc(12px * var(--layout-scale, 1));
    border-bottom: calc(2px * var(--layout-scale, 1)) solid rgba(194, 157, 72, 0.5);
    margin: 0 calc(-16px * var(--layout-scale, 1));
  }

  .hud-back {
    background: none;
    border: none;
    color: #e6edf3;
    font-size: calc(20px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(8px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .hud-back:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .hud-gold {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .gold-icon {
    font-size: calc(16px * var(--layout-scale, 1));
  }

  .gold-amount {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #f59e0b;
  }

  .hud-info {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    margin-left: auto;
  }

  .hud-deck {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .section-label {
    margin-top: calc(20px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
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
    background: rgba(100, 116, 139, 0.2);
  }

  .card-list {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .card-item {
    position: relative;
    border: 1px solid #3b434f;
    border-radius: 12px;
    background: rgba(13, 17, 23, 0.82);
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .relic-item {
    border-width: 2px;
  }

  .services-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .service-card {
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .service-removal {
    border: 1px solid #7F77DD;
    background: rgba(127, 119, 221, 0.05);
  }

  .service-transform {
    border: 1px solid #D85A30;
    background: rgba(216, 90, 48, 0.05);
    opacity: 0.5;
    pointer-events: none;
    cursor: default;
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
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 500;
    color: #e6edf3;
  }

  .service-price {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #f59e0b;
  }

  .service-price-disabled {
    color: #6b7280;
    font-weight: 400;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .unaffordable-price {
    color: #ef4444;
  }

  .service-desc {
    font-size: calc(13px * var(--text-scale, 1));
    color: #9ba4ad;
    line-height: 1.4;
  }

  .service-action {
    margin-top: auto;
    background: none;
    border: none;
    color: #93c5fd;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    padding: calc(6px * var(--layout-scale, 1)) 0;
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

  .shop-overlay:not(.landscape) .services-row {
    grid-template-columns: 1fr;
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

  /* === Card chain dot pill === */
  .card-sub-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .chain-dot {
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  .buy {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: 10px;
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
    border-radius: 10px;
    border: 1px solid #f59e0b;
    background: #92400e;
    color: #fef3c7;
    padding: 0 calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* === Affordability states === */
  .unaffordable {
    filter: grayscale(0.3);
    border-color: rgba(239, 68, 68, 0.3);
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

  /* === Relic tooltip === */
  .tooltip-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 199;
    border: none;
    padding: 0;
    cursor: default;
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

  .rarity-pill {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px calc(5px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  /* === Sale ribbon === */
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

  .original-price {
    text-decoration: line-through;
    color: #6b7280;
    font-weight: 400;
    margin-right: calc(4px * var(--layout-scale, 1));
  }

  .empty {
    margin-top: calc(10px * var(--layout-scale, 1));
    border-radius: 12px;
    border: 1px solid #3b434f;
    background: rgba(13, 17, 23, 0.82);
    padding: calc(14px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    color: #9ba4ad;
  }

  /* === Modal === */
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
    border-radius: 16px;
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
    border-radius: 10px;
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

  /* === Haggle quiz === */
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
    border-radius: 10px;
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

  /* === Removal picker === */
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
    min-height: 44px;
    border-radius: 10px;
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

  /* === Landscape layout === */
  .shop-overlay.landscape {
    /* Centered panel on dimmed backdrop */
    background: rgba(5, 8, 12, 0.7);
    align-content: center;
    justify-items: center;
    padding: 0;
  }

  .shop-overlay.landscape > * {
    /* All direct children constrained to panel width */
    width: min(90vw, calc(1200px * var(--layout-scale, 1)));
    box-sizing: border-box;
  }

  .shop-overlay.landscape .card-list {
    /* In landscape: items in a horizontal row */
    display: flex;
    flex-wrap: wrap;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .shop-overlay.landscape .card-item {
    flex: 1 1 calc(30% - 10px);
    min-width: calc(240px * var(--layout-scale, 1));
  }

  /* === Mastery indicator === */
  .mastery-indicator {
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    margin-left: calc(6px * var(--layout-scale, 1));
  }

  .mastery-icon {
    font-size: calc(12px * var(--text-scale, 1));
    color: #4ade80;
  }

  .mastery-bonus {
    font-size: calc(10px * var(--text-scale, 1));
    color: #22c55e;
    font-weight: 700;
  }

  /* === Purchase exit animation === */
  .purchased {
    animation: purchase-exit 800ms ease-out forwards;
  }

  @keyframes purchase-exit {
    0% { transform: scale(1); opacity: 1; }
    30% { transform: scale(1.02); opacity: 1; filter: brightness(1.3); }
    100% { transform: scale(0.8) translateY(calc(20px * var(--layout-scale, 1))); opacity: 0; }
  }

  @keyframes afford-pulse {
    0% { opacity: 0.4; }
    50% { opacity: 1; border-color: #22c55e; box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(34, 197, 94, 0.3); }
    100% { opacity: 1; }
  }

  /* === Shopkeeper bark === */
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

  /* === Sell tear animation (P3-C) === */
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

  /* === Gold counter animation (P3-E) === */
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

  /* === Card burn animation (P2-D) === */
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
