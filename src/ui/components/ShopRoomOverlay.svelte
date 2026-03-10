<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getTierDisplayName } from '../../services/tierDerivation'

  interface Props {
    cards: Card[]
    currency: number
    onsell: (cardId: string) => void
    ondone: () => void
  }

  let { cards, currency, onsell, ondone }: Props = $props()

  const TYPE_ICONS = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  } as const

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
  <p>Sell cards to trim your deck and gain gold.</p>

  <div class="gold">Gold: {currency}</div>

  {#if cards.length === 0}
    <div class="empty">No cards available to sell.</div>
  {:else}
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
            Sell +{sellPrice(card)}
          </button>
        </article>
      {/each}
    </div>
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
    gap: 10px;
    overflow-y: auto;
  }

  h1 {
    margin: 4px 0 0;
    font-size: 24px;
    color: #f1c40f;
    letter-spacing: 0.8px;
  }

  p {
    margin: 0;
    color: #9ba4ad;
  }

  .gold {
    font-size: 18px;
    font-weight: 800;
    color: #f9d56e;
    margin-top: 2px;
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

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .icon {
    font-size: 20px;
    line-height: 1;
  }

  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-weight: 700;
    font-size: 13px;
  }

  .sub {
    color: #9ba4ad;
    font-size: 12px;
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
