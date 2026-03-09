<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { purchaseKnowledgeItem } from '../stores/playerData'
  import { KNOWLEDGE_ITEMS, type KnowledgeItem } from '../../data/knowledgeStore'
  import { getMasteryLevel } from '../../services/sm2'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  /** Active tab selection */
  type Tab = 'powerup' | 'boost' | 'cosmetic'
  let activeTab = $state<Tab>('powerup')

  /** Items filtered to the active tab */
  const tabItems = $derived(KNOWLEDGE_ITEMS.filter(item => item.category === activeTab))

  /** Current knowledge points balance from the store */
  const kp = $derived($playerSave?.knowledgePoints ?? 0)

  /** Learning Sparks balance */
  const sparks = $derived($playerSave?.learningSparks ?? 0)
  const sparksThisWeek = $derived($playerSave?.sparkEarnedThisWeek ?? 0)

  /** Set of purchased item IDs */
  const purchasedIds = $derived(new Set($playerSave?.purchasedKnowledgeItems ?? []))

  /** Count how many times an item has been purchased */
  function purchaseCount(item: KnowledgeItem): number {
    const ids = $playerSave?.purchasedKnowledgeItems ?? []
    return ids.filter(id => id === item.id).length
  }

  /** Mastered facts count — needed for unlock requirements */
  const masteredCount = $derived.by(() => {
    const save = $playerSave
    if (!save) return 0
    return save.reviewStates.filter(rs => getMasteryLevel(rs) === 'mastered').length
  })

  /** Current daily streak */
  const currentStreak = $derived($playerSave?.stats.currentStreak ?? 0)

  /**
   * Returns whether an item is locked (unlock requirement not met).
   */
  function isLocked(item: KnowledgeItem): boolean {
    if (!item.unlockRequirement) return false
    const req = item.unlockRequirement
    if (req.type === 'mastered_facts') return masteredCount < req.value
    if (req.type === 'streak') return currentStreak < req.value
    return false
  }

  /**
   * Returns a human-readable unlock requirement description.
   */
  function unlockLabel(item: KnowledgeItem): string {
    const req = item.unlockRequirement
    if (!req) return ''
    if (req.type === 'mastered_facts') return `Master ${req.value} fact${req.value !== 1 ? 's' : ''} to unlock`
    if (req.type === 'streak') return `${req.value}-day streak required`
    if (req.type === 'category_complete') return `Complete ${req.categoryId ?? 'a category'} to unlock`
    return 'Requirements not met'
  }

  /**
   * Returns the purchase status label for the button.
   */
  function statusLabel(item: KnowledgeItem): string {
    const count = purchaseCount(item)
    if (count >= item.maxPurchases) return item.maxPurchases === 1 ? 'Owned' : 'MAX'
    return `Buy (${item.cost} KP)`
  }

  /**
   * Returns whether the buy button should be disabled.
   */
  function isBuyDisabled(item: KnowledgeItem): boolean {
    if (isLocked(item)) return true
    const count = purchaseCount(item)
    if (count >= item.maxPurchases) return true
    if (kp < item.cost) return true
    return false
  }

  /**
   * Returns the CSS class modifier for the buy button state.
   */
  function buyButtonClass(item: KnowledgeItem): string {
    if (isLocked(item)) return 'btn-locked'
    const count = purchaseCount(item)
    if (count >= item.maxPurchases) return 'btn-owned'
    if (kp < item.cost) return 'btn-unaffordable'
    return 'btn-available'
  }

  /**
   * Handles a purchase attempt.
   */
  function handleBuy(item: KnowledgeItem): void {
    if (isBuyDisabled(item)) return
    audioManager.playSound('button_click')
    purchaseKnowledgeItem(item.id, item.cost)
  }

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }
</script>

<section class="knowledge-store" aria-label="Knowledge Store">
  <!-- Header -->
  <div class="store-header">
    <button class="back-btn" type="button" onclick={handleBack} aria-label="Back to base">
      &larr;
    </button>
    <div class="header-title">
      <span class="header-icon" aria-hidden="true">🧠</span>
      <h1>Knowledge Store</h1>
    </div>
    <div class="kp-display" aria-label="Knowledge Points balance">
      <span class="kp-icon" aria-hidden="true">✨</span>
      <span class="kp-value">{kp}</span>
      <span class="kp-label">KP</span>
    </div>
    <div class="spark-display" aria-label="Learning Sparks balance">
      <span class="spark-icon" aria-hidden="true">⚡</span>
      <span class="spark-value">{sparks}</span>
      <span class="spark-label">Sparks</span>
    </div>
  </div>

  <!-- KP explanation -->
  <p class="kp-hint">
    Earn KP by learning facts & quizzes. Earn ⚡Sparks through mastery milestones (+{sparksThisWeek} this week)
  </p>

  <!-- Tabs -->
  <div class="tabs" role="tablist" aria-label="Store categories">
    <button
      class="tab"
      class:tab-active={activeTab === 'powerup'}
      type="button"
      role="tab"
      aria-selected={activeTab === 'powerup'}
      onclick={() => { activeTab = 'powerup' }}
    >
      Powerups
    </button>
    <button
      class="tab"
      class:tab-active={activeTab === 'boost'}
      type="button"
      role="tab"
      aria-selected={activeTab === 'boost'}
      onclick={() => { activeTab = 'boost' }}
    >
      Category Boosts
    </button>
    <button
      class="tab"
      class:tab-active={activeTab === 'cosmetic'}
      type="button"
      role="tab"
      aria-selected={activeTab === 'cosmetic'}
      onclick={() => { activeTab = 'cosmetic' }}
    >
      Cosmetics
    </button>
  </div>

  <!-- Item grid -->
  <div class="items-grid" role="tabpanel">
    {#each tabItems as item (item.id)}
      {@const locked = isLocked(item)}
      {@const count = purchaseCount(item)}
      {@const atMax = count >= item.maxPurchases}
      <div
        class="item-card"
        class:item-locked={locked}
        class:item-owned={atMax && !locked}
        aria-label="{item.name} — {item.description}"
      >
        <div class="item-icon" aria-hidden="true">{item.icon}</div>
        <div class="item-body">
          <div class="item-name">{item.name}</div>
          <div class="item-desc">{item.description}</div>
          {#if locked}
            <div class="item-lock-hint" aria-label="Unlock requirement">
              {unlockLabel(item)}
            </div>
          {/if}
          {#if item.maxPurchases > 1 && !locked}
            <div class="item-stack-hint" aria-label="Purchase count">
              {count}/{item.maxPurchases} purchased
            </div>
          {/if}
        </div>
        <div class="item-action">
          <button
            class="buy-btn {buyButtonClass(item)}"
            type="button"
            disabled={isBuyDisabled(item)}
            onclick={() => handleBuy(item)}
            aria-label={atMax ? (item.maxPurchases === 1 ? 'Already owned' : 'Maximum purchased') : `Buy ${item.name} for ${item.cost} KP`}
          >
            {statusLabel(item)}
          </button>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .knowledge-store {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    overflow-y: auto;
    background: linear-gradient(160deg, #0f0a1e 0%, #10131f 60%, #0a0f1e 100%);
    padding: 0;
    font-family: 'Courier New', monospace;
    -webkit-overflow-scrolling: touch;
  }

  /* ---- Header ---- */
  .store-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(15, 10, 30, 0.96);
    border-bottom: 1px solid rgba(160, 100, 255, 0.25);
    backdrop-filter: blur(8px);
  }

  .back-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(160, 100, 255, 0.4);
    border-radius: 10px;
    background: rgba(160, 100, 255, 0.12);
    color: #c4a0ff;
    font-family: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s;
  }

  .back-btn:active {
    background: rgba(160, 100, 255, 0.25);
    transform: translateY(1px);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .header-icon {
    font-size: 1.4rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.2rem, 4vw, 1.6rem);
    color: #c4a0ff;
    line-height: 1.1;
  }

  .kp-display {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(160, 100, 255, 0.15);
    border: 1px solid rgba(160, 100, 255, 0.35);
    border-radius: 10px;
    padding: 6px 12px;
    flex-shrink: 0;
  }

  .kp-icon {
    font-size: 1rem;
  }

  .kp-value {
    font-size: 1.1rem;
    font-weight: 800;
    color: #e0c8ff;
  }

  .kp-label {
    font-size: 0.78rem;
    color: #a07bd0;
    font-weight: 600;
  }

  /* ---- KP Hint ---- */
  .kp-hint {
    margin: 0;
    padding: 8px 16px;
    color: #7a6a9a;
    font-size: 0.75rem;
    font-style: italic;
    text-align: center;
    border-bottom: 1px solid rgba(160, 100, 255, 0.1);
  }

  /* ---- Tabs ---- */
  .tabs {
    display: flex;
    gap: 0;
    padding: 12px 16px 0;
    border-bottom: 1px solid rgba(160, 100, 255, 0.2);
  }

  .tab {
    flex: 1;
    padding: 10px 8px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: #7a6a9a;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover {
    color: #c4a0ff;
  }

  .tab-active {
    color: #c4a0ff;
    border-bottom-color: #a060ef;
  }

  /* ---- Items Grid ---- */
  .items-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 12px 24px;
  }

  .item-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(40, 20, 70, 0.55);
    border: 1px solid rgba(160, 100, 255, 0.2);
    border-radius: 14px;
    padding: 14px;
    transition: border-color 0.15s, background 0.15s;
  }

  .item-card:not(.item-locked):not(.item-owned) {
    border-color: rgba(160, 100, 255, 0.35);
  }

  .item-locked {
    opacity: 0.6;
    border-color: rgba(120, 80, 180, 0.15);
  }

  .item-owned {
    border-color: rgba(100, 220, 140, 0.3);
    background: rgba(20, 60, 35, 0.35);
  }

  .item-icon {
    font-size: 1.8rem;
    line-height: 1;
    flex-shrink: 0;
    width: 36px;
    text-align: center;
    padding-top: 2px;
  }

  .item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ddd0ff;
    line-height: 1.2;
  }

  .item-desc {
    font-size: 0.82rem;
    color: #8a7aaa;
    line-height: 1.4;
  }

  .item-lock-hint {
    font-size: 0.75rem;
    color: #f0a050;
    font-style: italic;
    margin-top: 2px;
  }

  .item-stack-hint {
    font-size: 0.72rem;
    color: #7a6a9a;
    margin-top: 2px;
  }

  .item-action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  /* ---- Buy Button ---- */
  .buy-btn {
    border: 0;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 9px 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.1s;
    min-width: 72px;
    text-align: center;
  }

  .buy-btn:active:not(:disabled) {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .btn-available {
    background: rgba(160, 100, 255, 0.25);
    color: #e0c8ff;
    border: 1px solid rgba(160, 100, 255, 0.5);
  }

  .btn-available:hover {
    background: rgba(160, 100, 255, 0.38);
  }

  .btn-owned {
    background: rgba(100, 220, 140, 0.18);
    color: #80e8a0;
    border: 1px solid rgba(100, 220, 140, 0.35);
    cursor: default;
  }

  .btn-locked {
    background: rgba(100, 80, 140, 0.15);
    color: #6a5a8a;
    border: 1px solid rgba(100, 80, 140, 0.2);
    cursor: not-allowed;
  }

  .btn-unaffordable {
    background: rgba(80, 60, 100, 0.15);
    color: #5a4a7a;
    border: 1px solid rgba(80, 60, 100, 0.2);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .buy-btn:disabled {
    cursor: not-allowed;
  }

  /* Phase 53: Learning Sparks display */
  .spark-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(255, 200, 50, 0.12);
    border: 1px solid rgba(255, 200, 50, 0.3);
    border-radius: 8px;
  }

  .spark-icon {
    font-size: 14px;
  }

  .spark-value {
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    color: #ffc832;
    font-weight: bold;
  }

  .spark-label {
    font-size: 9px;
    color: #cca020;
    text-transform: uppercase;
  }

  /* ---- Responsive ---- */
  @media (max-width: 420px) {
    .store-header {
      padding: 10px 12px;
    }

    h1 {
      font-size: 1.1rem;
    }

    .items-grid {
      padding: 12px 10px 24px;
    }

    .item-card {
      padding: 12px 10px;
    }
  }
</style>
