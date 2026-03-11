<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getTierDisplayName } from '../../services/tierDerivation'

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
  }

  interface Props {
    cards: Card[]
    currency: number
    shopInventory: ShopInventory | null
    onsell: (cardId: string) => void
    onbuyRelic: (relicId: string) => void
    onbuyCard: (cardIndex: number) => void
    ondone: () => void
  }

  let { cards, currency, shopInventory, onsell, onbuyRelic, onbuyCard, ondone }: Props = $props()

  const TYPE_ICONS: Record<string, string> = {
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

  function sellPrice(card: Card): number {
    if (card.tier === '3') return 3
    if (card.tier === '2a' || card.tier === '2b') return 2
    return 1
  }

  function tierLabel(card: Card): string {
    return getTierDisplayName(card.tier)
  }
</script>

<section class="shop-overlay" aria-label="Shop room">
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
              onclick={() => onbuyRelic(item.relic.id)}
            >
              Buy {item.price}g
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
              <span class="icon">{TYPE_ICONS[item.card.cardType] ?? '🃏'}</span>
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
              onclick={() => onbuyCard(idx)}
            >
              Buy {item.price}g
            </button>
          </article>
        {/each}
      </div>
    {/if}
  {/if}

  {#if cards.length > 0}
    <div class="section-header">Sell</div>
    <div class="card-list">
      {#each cards as card (card.id)}
        <article class="card-item">
          <div class="meta">
            <span class="icon">{TYPE_ICONS[card.cardType] ?? '🃏'}</span>
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

<style>
  .shop-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: linear-gradient(180deg, #101214 0%, #1f2329 100%);
    color: #e6edf3;
    padding: 20px 16px 28px;
    display: grid;
    align-content: start;
    gap: 8px;
    overflow-y: auto;
  }

  h1 {
    margin: 4px 0 0;
    font-size: 24px;
    color: #f1c40f;
    letter-spacing: 0.8px;
  }

  .gold {
    font-size: 18px;
    font-weight: 800;
    color: #f9d56e;
    margin-top: 2px;
  }

  .section-header {
    margin-top: 8px;
    font-size: 16px;
    font-weight: 700;
    color: #e6edf3;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #3b434f;
    padding-bottom: 4px;
  }

  .subsection-label {
    font-size: 12px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }

  .card-list {
    display: grid;
    gap: 8px;
  }

  .card-item {
    border: 1px solid #3b434f;
    border-radius: 12px;
    background: rgba(13, 17, 23, 0.82);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .relic-item {
    border-width: 2px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .icon {
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
  }

  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-weight: 700;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: #9ba4ad;
    font-size: 12px;
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
    padding: 0 10px;
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
    padding: 0 10px;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .done {
    margin-top: 8px;
    min-height: 50px;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    font-weight: 700;
  }

  .empty {
    margin-top: 10px;
    border-radius: 12px;
    border: 1px solid #3b434f;
    background: rgba(13, 17, 23, 0.82);
    padding: 14px 12px;
    color: #9ba4ad;
  }
</style>
