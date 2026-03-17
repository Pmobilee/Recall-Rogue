<script lang="ts">
  import type { Card } from '../../data/card-types'
  import type { Fact } from '../../data/types'
  import { getTierDisplayName } from '../../services/tierDerivation'
  import { getRandomRoomBg } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getCardTypeIconPath, getCardTypeEmoji } from '../utils/iconAssets'
  import { factsDB } from '../../services/factsDB'
  import { updateReviewStateByButton } from '../stores/playerData'
  import { shuffled } from '../../services/randomUtils'
  import { recordHaggleAttempt } from '../../services/gameFlowController'
  import { SHOP_HAGGLE_DISCOUNT } from '../../data/balance'
  import { getChainTypeName, getChainTypeColor } from '../../data/chainTypes'
  import { isLandscape } from '../../stores/layoutStore'

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
    common: '#95a5a6',
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

  // === Removal picker state ===
  let showRemovalPicker = $state(false)
  let pendingRemovalHaggled = $state(false)

  /** Cards that can be removed (non-echo) */
  let nonEchoCards = $derived(cards.filter(c => !c.isEcho))
  /** Whether deck is large enough to remove a card (must keep > 5) */
  let canRemoveCard = $derived(nonEchoCards.length > 5)

  /** Chain composition summary for the removal picker */
  let chainComposition = $derived.by(() => {
    const counts = new Map<number, number>()
    for (const card of nonEchoCards) {
      if (card.chainType !== undefined) {
        counts.set(card.chainType, (counts.get(card.chainType) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, name: getChainTypeName(type), color: getChainTypeColor(type), count }))
  })

  function sellPrice(card: Card): number {
    if (card.tier === '3') return 3
    if (card.tier === '2a' || card.tier === '2b') return 2
    return 1
  }

  function tierLabel(card: Card): string {
    return getTierDisplayName(card.tier)
  }

  function openPurchaseModal(purchase: PendingPurchase) {
    pendingPurchase = purchase
    hagglingState = 'idle'
    haggledThisItem = false
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
    if (pendingPurchase.type === 'relic') {
      onbuyRelic(pendingPurchase.relicId, haggled)
    } else if (pendingPurchase.type === 'card') {
      onbuyCard(pendingPurchase.cardIndex, haggled)
    } else if (pendingPurchase.type === 'removal') {
      onbuyRemoval(pendingPurchase.cardId, haggled)
    }
    closePurchaseModal()
  }

  async function startHaggle() {
    if (!pendingPurchase || haggledThisItem) return
    recordHaggleAttempt()
    haggledThisItem = true
    haggledPrice = Math.floor(pendingPurchase.price * (1 - SHOP_HAGGLE_DISCOUNT))

    // Fetch a random quiz question
    try {
      const allFacts = await factsDB.getAll()
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
      }, 1400)
    }
  }

  function openRemovalPicker(haggled: boolean) {
    pendingRemovalHaggled = haggled
    showRemovalPicker = true
    closePurchaseModal()
  }

  function pickCardForRemoval(cardId: string) {
    onbuyRemoval(cardId, pendingRemovalHaggled)
    showRemovalPicker = false
  }

  let modalAffordable = $derived(
    pendingPurchase != null &&
    (hagglingState === 'result' && quizResult === 'correct'
      ? currency >= haggledPrice
      : currency >= (pendingPurchase?.price ?? 0))
  )
</script>

<section class="shop-overlay" class:landscape={$isLandscape} aria-label="Shop room">
  <h1>Shop Room</h1>
  <div class="gold">Gold: {currency}</div>

  {#if shopInventory && (shopInventory.relics.length > 0 || shopInventory.cards.length > 0)}
    <div class="section-header">Buy</div>

    {#if shopInventory.relics.length > 0}
      <div class="subsection-label">Relics</div>
      <div class="card-list">
        {#each shopInventory.relics as item (item.relic.id)}
          {@const canAfford = currency >= item.price}
          <article class="card-item relic-item" style="border-color: {RARITY_COLORS[item.relic.rarity] ?? '#3b434f'}40">
            <div class="meta">
              <span class="icon">{item.relic.icon}</span>
              <div class="text">
                <div class="name" style="color: {RARITY_COLORS[item.relic.rarity] ?? '#e6edf3'}">{item.relic.name}</div>
                <div class="sub">{item.relic.description}</div>
              </div>
            </div>
            <button
              type="button"
              class="buy"
              class:disabled={!canAfford}
              disabled={!canAfford}
              data-testid="shop-buy-relic-{item.relic.id}"
              onclick={() => openPurchaseModal({ type: 'relic', relicId: item.relic.id, price: item.price, name: item.relic.name })}
            >
              {item.price}g
            </button>
          </article>
        {/each}
      </div>
    {/if}

    {#if shopInventory.cards.length > 0}
      <div class="subsection-label">Cards</div>
      <div class="card-list">
        {#each shopInventory.cards as item, idx (item.card.id)}
          {@const canAfford = currency >= item.price}
          <article class="card-item">
            <div class="meta">
              <span class="icon">
                <img class="type-icon-img" src={getCardTypeIconPath(item.card.cardType)} alt=""
                  onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
                <span style="display:none">{TYPE_EMOJI[item.card.cardType] ?? '🃏'}</span>
              </span>
              <div class="text">
                <div class="name">{item.card.cardType.toUpperCase()} • {tierLabel(item.card)}</div>
                <div class="sub">Power {Math.round(item.card.baseEffectValue * item.card.effectMultiplier)}</div>
              </div>
            </div>
            <button
              type="button"
              class="buy"
              class:disabled={!canAfford}
              disabled={!canAfford}
              data-testid="shop-buy-card-{idx}"
              onclick={() => openPurchaseModal({ type: 'card', cardIndex: idx, price: item.price, name: `${item.card.cardType.toUpperCase()} (${tierLabel(item.card)})` })}
            >
              {item.price}g
            </button>
          </article>
        {/each}
      </div>
    {/if}

    {#if shopInventory.removalCost != null}
      <div class="subsection-label">Services</div>
      <div class="card-list">
        <article class="card-item service-item">
          <div class="meta">
            <span class="icon">🗑</span>
            <div class="text">
              <div class="name">Card Removal</div>
              <div class="sub">Permanently remove a card from your deck</div>
            </div>
          </div>
          <button
            type="button"
            class="buy"
            class:disabled={!canRemoveCard || currency < shopInventory.removalCost}
            disabled={!canRemoveCard || currency < shopInventory.removalCost}
            data-testid="shop-buy-removal"
            onclick={() => openPurchaseModal({ type: 'removal', cardId: '', price: shopInventory!.removalCost!, name: 'Card Removal' })}
          >
            {shopInventory.removalCost}g
          </button>
        </article>
      </div>
    {/if}
  {/if}

  {#if cards.length > 0}
    <div class="section-header">Sell</div>
    <div class="card-list">
      {#each cards as card (card.id)}
        <article class="card-item">
          <div class="meta">
            <span class="icon">
              <img class="type-icon-img" src={getCardTypeIconPath(card.cardType)} alt=""
                onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
              <span style="display:none">{TYPE_EMOJI[card.cardType] ?? '🃏'}</span>
            </span>
            <div class="text">
              <div class="name">{card.cardType.toUpperCase()} • {tierLabel(card)}</div>
              <div class="sub">Power {Math.round(card.baseEffectValue * card.effectMultiplier)}</div>
            </div>
          </div>
          <button type="button" class="sell" onclick={() => onsell(card.id)}>
            Sell +{sellPrice(card)}g
          </button>
        </article>
      {/each}
    </div>
  {:else if !shopInventory || (shopInventory.relics.length === 0 && shopInventory.cards.length === 0)}
    <div class="empty">Nothing available.</div>
  {/if}

  <button type="button" class="done" onclick={ondone}>Leave Shop</button>
</section>

<!-- Purchase Modal -->
{#if pendingPurchase}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Purchase options" data-testid="shop-purchase-modal">
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
                Haggle — answer a question for 30% off
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
              Haggle — answer a question for 30% off
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
              {answer}
            </button>
          {/each}
        </div>
        <div class="modal-note">Correct = 30% off ({haggledPrice}g). Wrong = full price.</div>

      {:else if hagglingState === 'result'}
        {#if quizResult === 'correct'}
          <div class="haggle-success">Haggled! Price: {haggledPrice}g</div>
          <div class="modal-note">Completing purchase…</div>
        {:else}
          <div class="haggle-fail">Wrong! Full price applies.</div>
          {#if quizQuestion}
            <div class="modal-note">Answer: {quizQuestion.correctAnswer}</div>
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
            <span class="chain-comp-item" style="color: {entry.color};">{entry.name} ×{entry.count}</span>
          {/each}
        </div>
      {/if}
      <div class="removal-list">
        {#each nonEchoCards as card (card.id)}
          <button
            type="button"
            class="removal-card-btn"
            onclick={() => pickCardForRemoval(card.id)}
          >
            <span class="removal-card-info">
              <span class="removal-card-name">{card.cardType.toUpperCase()} • {tierLabel(card)}</span>
              {#if card.chainType !== undefined}
                <span class="removal-chain-badge" style="color: {getChainTypeColor(card.chainType)};">
                  {getChainTypeName(card.chainType)}
                </span>
              {/if}
            </span>
            <span class="removal-card-power">Power {Math.round(card.baseEffectValue * card.effectMultiplier)}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="modal-btn modal-btn-cancel" onclick={() => { showRemovalPicker = false }}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<style>
  .shop-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: linear-gradient(180deg, #101214 0%, #1f2329 100%);
    color: #e6edf3;
    padding: calc((20px * var(--layout-scale, 1)) + var(--safe-top)) calc(16px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    display: grid;
    align-content: start;
    gap: calc(8px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  h1 {
    margin: calc(4px * var(--layout-scale, 1)) 0 0;
    font-size: calc(24px * var(--layout-scale, 1));
    color: #f1c40f;
    letter-spacing: 0.8px;
  }

  .gold {
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 800;
    color: #f9d56e;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .section-header {
    margin-top: calc(8px * var(--layout-scale, 1));
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 700;
    color: #e6edf3;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #3b434f;
    padding-bottom: calc(4px * var(--layout-scale, 1));
  }

  .subsection-label {
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .card-list {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .card-item {
    border: 1px solid #3b434f;
    border-radius: 12px;
    background: rgba(13, 17, 23, 0.82);
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .relic-item {
    border-width: 2px;
  }

  .service-item {
    border-color: #6b4f00;
    background: rgba(20, 14, 0, 0.82);
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
    font-size: calc(13px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: #9ba4ad;
    font-size: calc(12px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .buy {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #f1c40f;
    background: #6b4f00;
    color: #f9d56e;
    padding: 0 calc(10px * var(--layout-scale, 1));
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
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #2f914f;
    background: #1f6d39;
    color: #f0fff4;
    padding: 0 calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .done {
    margin-top: calc(8px * var(--layout-scale, 1));
    min-height: 50px;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    font-weight: 700;
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
    max-width: 380px;
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
    min-height: 48px;
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
    min-height: 44px;
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
    gap: 6px 10px;
    padding: 4px 8px 8px;
    font-size: calc(11px * var(--layout-scale, 1));
    opacity: 0.8;
  }

  .chain-comp-item {
    font-weight: 600;
  }

  .removal-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .removal-chain-badge {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    width: min(70vw, 960px);
    box-sizing: border-box;
  }

  .shop-overlay.landscape h1 {
    padding-top: calc(20px * var(--layout-scale, 1));
    margin: 0;
  }

  .shop-overlay.landscape .card-list {
    /* In landscape: items in a horizontal row */
    display: flex;
    flex-wrap: wrap;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .shop-overlay.landscape .card-item {
    flex: 1 1 calc(30% - 10px);
    min-width: 220px;
  }

  .shop-overlay.landscape .done {
    width: min(70vw, 960px);
    margin-bottom: calc(20px * var(--layout-scale, 1));
  }
</style>
