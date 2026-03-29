<script lang="ts">
  import { COSMETIC_PRODUCTS } from '../../data/iapCatalog'
  import { getCurrentFeaturedDay, getTimeUntilReset, getTodaysDeals, type DailyDeal } from '../../data/dailyDeals'
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { purchaseWithLocalFallback } from '../../services/monetizationService'
  import { kidModeIapGuard } from '../../services/iapService'
  import GachaReveal from './GachaReveal.svelte'
  import type { PlayerMinerals, Rarity } from '../../data/types'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  const deals = getTodaysDeals()
  const resetTime = getTimeUntilReset()
  const featuredDay = getCurrentFeaturedDay()
  const isKidMode = $derived($playerSave?.ageRating === 'kid')

  let statusMessage = $state('')
  let purchasingProductId = $state<string | null>(null)
  let showGacha = $state(false)
  let gachaText = $state('Mystery cache opened.')
  let gachaRarity = $state<Rarity>('rare')

  function todayKey(now = new Date()): string {
    return now.toISOString().split('T')[0]
  }

  function normalizePurchasedDeals(): string[] {
    const save = $playerSave
    if (!save) return []
    const currentDate = todayKey()
    if (save.lastDealDate === currentDate) {
      return save.purchasedDeals ?? []
    }
    return []
  }

  function hasEnough(cost: Partial<Record<keyof PlayerMinerals, number>>): boolean {
    const minerals = $playerSave?.minerals
    if (!minerals) return false
    return Object.entries(cost).every(([tier, amount]) => {
      if (!amount || amount <= 0) return true
      return (minerals[tier as keyof PlayerMinerals] ?? 0) >= amount
    })
  }

  function spendAndGrantDeal(deal: DailyDeal): void {
    const save = $playerSave
    if (!save) return

    const currentDate = todayKey()
    const purchasedToday = save.lastDealDate === currentDate ? (save.purchasedDeals ?? []) : []
    if (purchasedToday.includes(deal.id)) {
      statusMessage = 'Deal already purchased today.'
      return
    }
    if (!hasEnough(deal.cost)) {
      statusMessage = 'Not enough minerals for this deal.'
      return
    }

    playerSave.update((state) => {
      if (!state) return state
      const next = {
        ...state,
        minerals: { ...state.minerals },
        purchasedDeals: state.lastDealDate === currentDate ? [...(state.purchasedDeals ?? []), deal.id] : [deal.id],
        lastDealDate: currentDate,
      }

      for (const [tier, amount] of Object.entries(deal.cost)) {
        if (!amount || amount <= 0) continue
        const key = tier as keyof PlayerMinerals
        next.minerals[key] = Math.max(0, (next.minerals[key] ?? 0) - amount)
      }

      if (deal.reward.type === 'minerals') {
        next.minerals.greyMatter = (next.minerals.greyMatter ?? 0) + deal.reward.amount
      } else if (deal.reward.type === 'oxygen_tanks') {
        next.oxygen += deal.reward.amount
      } else if (deal.reward.type === 'recipe_discount') {
        if (!(next.purchasedKnowledgeItems ?? []).includes(`discount:${deal.reward.recipeId}`)) {
          next.purchasedKnowledgeItems = [...(next.purchasedKnowledgeItems ?? []), `discount:${deal.reward.recipeId}`]
        }
      } else if (deal.reward.type === 'random_minerals') {
        const greyMatter = deal.reward.minDust + Math.floor(Math.random() * (deal.reward.maxDust - deal.reward.minDust + 1))
        next.minerals.greyMatter = (next.minerals.greyMatter ?? 0) + greyMatter
        gachaText = `Mystery cache yielded ${greyMatter} grey matter.`
        gachaRarity = featuredDay === 7 ? 'epic' : 'rare'
        showGacha = true
      } else if (deal.reward.type === 'cosmetic_unlock') {
        if (!next.ownedCosmetics.includes(deal.reward.cosmeticId)) {
          next.ownedCosmetics = [...next.ownedCosmetics, deal.reward.cosmeticId]
        }
      }

      return next
    })
    persistPlayer()
    statusMessage = `Purchased: ${deal.name}`
  }

  async function purchaseCosmetic(productId: string): Promise<void> {
    if (purchasingProductId) return
    purchasingProductId = productId
    const result = await purchaseWithLocalFallback(productId)
    if (result.success) {
      statusMessage = result.simulated ? 'Unlocked in local/dev mode.' : 'Cosmetic unlocked.'
    } else {
      statusMessage = 'Purchase failed. Please try again.'
    }
    purchasingProductId = null
  }

  function handleCosmeticPurchase(productId: string): void {
    kidModeIapGuard(() => {
      void purchaseCosmetic(productId)
    })
  }
</script>

<div class="store-overlay" role="dialog" aria-modal="true" aria-label="Cosmetic Store">
  <div class="store-modal">
    <button class="close-btn" type="button" onclick={onClose} aria-label="Close">&times;</button>
    <header class="header">
      <h2>Cosmetic Store</h2>
      <p>Daily deals reset in {resetTime.hours}h {resetTime.minutes}m</p>
    </header>

    <section class="section">
      <h3>Daily Deals (Day {featuredDay}/7)</h3>
      <div class="deal-grid">
        {#each deals as deal (deal.id)}
          <article class="deal-card">
            <div class="deal-head">
              <span class="deal-icon">{deal.icon}</span>
              <div>
                <div class="deal-name">{deal.name}</div>
                <div class="deal-desc">{deal.description}</div>
              </div>
            </div>
            <div class="deal-cost">
              {#each Object.entries(deal.cost) as [tier, amount]}
                {#if amount && amount > 0}
                  <span>{amount} {tier}</span>
                {/if}
              {/each}
            </div>
            <button
              type="button"
              class="buy-btn"
              onclick={() => spendAndGrantDeal(deal)}
              disabled={!hasEnough(deal.cost) || normalizePurchasedDeals().includes(deal.id)}
            >
              {#if normalizePurchasedDeals().includes(deal.id)}
                Claimed
              {:else}
                Buy Deal
              {/if}
            </button>
          </article>
        {/each}
      </div>
    </section>

    <section class="section">
      <h3>Premium Cosmetics</h3>
      <div class="product-grid">
        {#each COSMETIC_PRODUCTS as product (product.id)}
          {@const owned = ($playerSave?.purchasedProducts ?? []).includes(product.id)}
          <article class="product-card">
            <div class="product-name">{product.name}</div>
            <div class="product-desc">{product.description}</div>
            <div class="product-price">${product.priceUSD.toFixed(2)}</div>
            <button
              type="button"
              class="buy-btn"
              class:ask-parent-btn={isKidMode}
              onclick={() => handleCosmeticPurchase(product.id)}
              disabled={owned || purchasingProductId === product.id}
            >
              {#if owned}
                Owned
              {:else if purchasingProductId === product.id}
                Processing...
              {:else}
                {isKidMode ? 'Ask a Parent' : 'Buy'}
              {/if}
            </button>
          </article>
        {/each}
      </div>
    </section>

    {#if statusMessage}
      <p class="status">{statusMessage}</p>
    {/if}
  </div>
</div>

{#if showGacha}
  <GachaReveal
    rarity={gachaRarity}
    factStatement={gachaText}
    onComplete={() => { showGacha = false }}
  />
{/if}

<style>
  .store-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 6, 23, 0.86);
    padding: 16px;
  }

  .store-modal {
    width: min(760px, 100%);
    max-height: 92vh;
    overflow-y: auto;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    padding: 16px;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 10px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 20px;
    cursor: pointer;
  }

  .header h2 {
    margin: 0;
    font-size: 20px;
    color: #f8fafc;
  }

  .header p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #93c5fd;
  }

  .section {
    margin-top: 14px;
  }

  .section h3 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #cbd5e1;
  }

  .deal-grid,
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .deal-card,
  .product-card {
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.75);
    padding: 10px;
    display: grid;
    gap: 8px;
  }

  .deal-head {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .deal-icon {
    font-size: 20px;
    line-height: 1;
  }

  .deal-name,
  .product-name {
    font-size: 13px;
    color: #f8fafc;
    font-weight: 700;
  }

  .deal-desc,
  .product-desc {
    font-size: 11px;
    color: #cbd5e1;
  }

  .deal-cost,
  .product-price {
    font-size: 12px;
    color: #fbbf24;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .buy-btn {
    min-height: 38px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(180deg, #3b82f6, #2563eb);
    color: #f8fafc;
    font-weight: 700;
    cursor: pointer;
  }

  .buy-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ask-parent-btn {
    background: linear-gradient(180deg, #f59e0b, #d97706);
    color: #111827;
  }

  .status {
    margin: 12px 0 0;
    font-size: 12px;
    color: #86efac;
  }
</style>

