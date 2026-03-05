<script lang="ts">
  import { playerSave } from '../../stores/playerData'
  import { audioManager } from '../../../services/audioService'
  import { getTodaysDeals, getTimeUntilReset, getCurrentFeaturedDay, type DailyDeal } from '../../../data/dailyDeals'
  import { purchaseDeal } from '../../../services/saveService'
  import { calculateTotalPending } from '../../../data/farm'

  interface Props {
    onCosmetics?: () => void
    onFarm?: () => void
  }

  let { onCosmetics, onFarm }: Props = $props()

  const farmPending = $derived.by(() => {
    const save = $playerSave
    if (!save?.farm) return { dust: 0, shard: 0, crystal: 0 }
    return calculateTotalPending(save.farm.slots)
  })

  const hasFarmResources = $derived(
    farmPending.dust > 0 || farmPending.shard > 0 || farmPending.crystal > 0,
  )

  const todaysDeals = $derived(getTodaysDeals())
  const resetTimer = $derived(getTimeUntilReset())
  const featuredDay = $derived(getCurrentFeaturedDay())

  const SLOT_LABELS: Record<number, string> = {
    1: 'Consumable',
    2: 'Special',
    3: 'Featured',
  }

  const purchasedDealIds = $derived.by(() => {
    const save = $playerSave
    if (!save) return [] as string[]
    const today = new Date().toISOString().split('T')[0]
    if (save.lastDealDate !== today) return [] as string[]
    return save.purchasedDeals ?? []
  })

  function isDealPurchased(deal: DailyDeal): boolean {
    return purchasedDealIds.includes(deal.id)
  }

  function canAffordDeal(deal: DailyDeal): boolean {
    const save = $playerSave
    if (!save) return false
    for (const [tier, required] of Object.entries(deal.cost) as [string, number][]) {
      if ((save.minerals[tier as keyof typeof save.minerals] ?? 0) < required) return false
    }
    return true
  }

  function formatDealCost(deal: DailyDeal): string {
    return Object.entries(deal.cost)
      .map(([tier, amount]) => `${amount} ${tier}`)
      .join(' + ')
  }

  function handleBuyDeal(deal: DailyDeal): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = purchaseDeal(save, deal)
    if (success) {
      playerSave.set(updatedSave)
    }
  }

  function handleCosmetics(): void {
    audioManager.playSound('button_click')
    onCosmetics?.()
  }

  function handleFarm(): void {
    audioManager.playSound('button_click')
    onFarm?.()
  }
</script>

<!-- ========== MARKET ========== -->
<div class="card room-header-card">
  <div class="room-header-info">
    <span class="room-header-icon" aria-hidden="true">🏪</span>
    <div>
      <h2 class="room-header-title">Market</h2>
      <p class="room-header-desc">Cosmetics, daily deals and special offers</p>
    </div>
  </div>
</div>

<div class="card actions-card" aria-label="Market actions">
  <button class="action-button cosmetics-button" type="button" onclick={handleCosmetics}>
    <span>Cosmetics Shop</span>
    <span class="action-arrow" aria-hidden="true">&#8594;</span>
  </button>

  <button class="action-button farm-button" type="button" onclick={handleFarm} aria-label="Visit The Farm">
    <span>The Farm</span>
    {#if hasFarmResources}
      <span class="farm-badge">Resources ready!</span>
    {:else}
      <span class="empty-note">Passive production</span>
    {/if}
  </button>
</div>

<!-- Daily Deals -->
<div class="card deals-card" aria-label="Daily Deals">
  <div class="deals-header">
    <h2 class="deals-title">Daily Deals</h2>
    <span class="deals-timer" aria-label="Time until reset">
      Resets in {resetTimer.hours}h {resetTimer.minutes}m
    </span>
  </div>
  <div class="deals-grid">
    {#each todaysDeals as deal (deal.id)}
      {@const purchased = isDealPurchased(deal)}
      {@const affordable = canAffordDeal(deal)}
      <div
        class="deal-card"
        class:deal-purchased={purchased}
        class:deal-unaffordable={!affordable && !purchased}
        class:deal-featured={deal.slot === 3}
        aria-label="{deal.name} deal"
      >
        <div class="deal-slot-label">{SLOT_LABELS[deal.slot] ?? ''}</div>
        {#if deal.discountPercent > 0}
          <div class="deal-discount-badge">{deal.discountPercent}% OFF</div>
        {/if}
        {#if deal.slot === 3 && deal.featuredDay === 7}
          <div class="deal-pity-badge">PITY</div>
        {/if}
        <div class="deal-icon" aria-hidden="true">{deal.icon}</div>
        <div class="deal-name">{deal.name}</div>
        <div class="deal-desc">{deal.description}</div>
        <div class="deal-cost" aria-label="Cost: {formatDealCost(deal)}">
          {formatDealCost(deal)}
        </div>
        {#if deal.slot === 3}
          <div class="featured-strip" aria-label="Day {featuredDay} of 7">
            {#each [1, 2, 3, 4, 5, 6, 7] as d}
              <span
                class="featured-dot"
                class:featured-dot-active={d === featuredDay}
                class:featured-dot-pity={d === 7}
                aria-hidden="true"
              ></span>
            {/each}
          </div>
        {/if}
        <button
          class="deal-buy-btn"
          class:deal-btn-sold={purchased}
          type="button"
          disabled={purchased || !affordable}
          onclick={() => handleBuyDeal(deal)}
          aria-label={purchased ? 'Already purchased' : 'Buy ' + deal.name}
        >
          {purchased ? 'Sold Out' : 'Buy'}
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin: 0 0 10px;
  }

  .room-header-card {
    margin: 8px 8px 4px;
    padding: 12px 16px;
  }

  .room-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .room-header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .room-header-title {
    color: var(--color-warning);
    font-size: 1.1rem;
    margin: 0 0 2px;
  }

  .room-header-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.3;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .cosmetics-button {
    background: color-mix(in srgb, #f97316 28%, var(--color-surface) 72%);
  }

  .farm-button {
    background: color-mix(in srgb, #4caf50 28%, var(--color-surface) 72%);
    border: 1px solid rgba(76, 175, 80, 0.4);
  }

  .farm-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4caf50;
    background: rgba(76, 175, 80, 0.2);
    border: 1px solid rgba(76, 175, 80, 0.4);
    border-radius: 999px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .action-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  /* ---- Daily Deals ---- */
  .deals-card {
    border: 1px solid rgba(255, 186, 0, 0.3);
    background: color-mix(in srgb, #3a2800 60%, var(--color-surface) 40%);
    margin-bottom: 20px;
  }

  .deals-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .deals-title {
    color: #ffba00;
    margin-bottom: 0;
  }

  .deals-timer {
    color: #c89000;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .deals-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .deal-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: color-mix(in srgb, #ffba00 8%, var(--color-bg) 92%);
    border: 1px solid rgba(255, 186, 0, 0.25);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    transition: border-color 0.15s, opacity 0.15s;
  }

  .deal-purchased {
    opacity: 0.45;
    border-color: rgba(255, 186, 0, 0.1);
  }

  .deal-unaffordable {
    opacity: 0.65;
  }

  .deal-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .deal-name {
    color: #ffba00;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .deal-desc {
    color: var(--color-text-dim);
    font-size: 0.68rem;
    line-height: 1.3;
    min-height: 2.6em;
  }

  .deal-cost {
    color: #c89000;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1.3;
    min-height: 1.3em;
  }

  .deal-buy-btn {
    margin-top: 4px;
    width: 100%;
    border: 0;
    border-radius: 7px;
    background: #ffba00;
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 800;
    padding: 6px 4px;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: opacity 0.15s, transform 0.1s;
  }

  .deal-buy-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .deal-buy-btn:not(:disabled):active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .deal-btn-sold {
    background: color-mix(in srgb, var(--color-text-dim) 40%, var(--color-surface) 60%);
    color: var(--color-text-dim);
  }

  .deal-slot-label {
    font-size: 0.58rem;
    font-weight: 700;
    color: #c89000;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }

  .deal-discount-badge {
    font-size: 0.6rem;
    font-weight: 800;
    color: #0f172a;
    background: #4ade80;
    border-radius: 4px;
    padding: 1px 6px;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .deal-pity-badge {
    font-size: 0.6rem;
    font-weight: 800;
    color: #0f172a;
    background: #fbbf24;
    border-radius: 4px;
    padding: 1px 6px;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .deal-featured {
    border-color: rgba(255, 186, 0, 0.5);
    background: color-mix(in srgb, #ffba00 14%, var(--color-bg) 86%);
  }

  .featured-strip {
    display: flex;
    gap: 3px;
    justify-content: center;
    margin: 4px 0 2px;
  }

  .featured-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #334155;
  }

  .featured-dot-active {
    background: #ffba00;
    box-shadow: 0 0 4px rgba(255, 186, 0, 0.6);
  }

  .featured-dot-pity {
    background: #fbbf24;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .deals-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .deal-icon {
      font-size: 1.3rem;
    }

    .deal-name {
      font-size: 0.7rem;
    }

    .deal-desc,
    .deal-cost {
      font-size: 0.62rem;
    }

    .deal-buy-btn {
      font-size: 0.72rem;
      padding: 5px 2px;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>
