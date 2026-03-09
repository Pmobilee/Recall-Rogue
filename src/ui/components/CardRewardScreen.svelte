<script lang="ts">
  import type { Card, CardType, FactDomain } from '../../data/card-types'

  interface Props {
    options: Card[]
    onselect: (card: Card) => void
    onskip: () => void
  }

  let { options, onselect, onskip }: Props = $props()
  let selected = $state<Card | null>(null)

  const TYPE_ICONS: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  const DOMAIN_COLORS: Record<FactDomain, string> = {
    science: '#E74C3C',
    history: '#3498DB',
    geography: '#F1C40F',
    language: '#2ECC71',
    math: '#9B59B6',
    arts: '#E67E22',
    medicine: '#1ABC9C',
    technology: '#95A5A6',
  }

  function selectCard(card: Card): void {
    selected = selected?.id === card.id ? null : card
  }

  function confirmSelection(): void {
    if (!selected) return
    onselect(selected)
  }

  function tierLabel(tier: Card['tier']): string {
    if (tier === '1') return ''
    return tier.toUpperCase()
  }
</script>

<div class="reward-screen">
  <h1>VICTORY</h1>
  <p>Choose a card to add to your deck</p>

  <div class="cards">
    {#each options as card (card.id)}
      <button
        class="reward-card"
        class:selected={selected?.id === card.id}
        style="--domain-color: {DOMAIN_COLORS[card.domain]};"
        onclick={() => selectCard(card)}
      >
        <div class="top">
          <span class="icon">{TYPE_ICONS[card.cardType]}</span>
          <span class="type">{card.cardType}</span>
        </div>
        <div class="name">{card.mechanicName ?? card.cardType}</div>
        <div class="value">{Math.round(card.baseEffectValue * card.effectMultiplier)}</div>
        <div class="domain">{card.domain}</div>
        {#if tierLabel(card.tier)}
          <div class="tier">{tierLabel(card.tier)}</div>
        {/if}
      </button>
    {/each}
  </div>

  {#if selected}
    <button class="confirm" onclick={confirmSelection}>Add To Deck</button>
  {/if}
  <button class="skip" onclick={onskip}>Skip</button>
</div>

<style>
  .reward-screen {
    position: fixed;
    inset: 0;
    background: #0D1117;
    color: #E6EDF3;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 16px;
    gap: 10px;
    z-index: 220;
  }

  h1 {
    margin: 8px 0 0;
    font-size: 24px;
    letter-spacing: 2px;
    color: #F1C40F;
  }

  p {
    margin: 0 0 12px;
    color: #8B949E;
  }

  .cards {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .reward-card {
    border: 2px solid var(--domain-color);
    border-radius: 12px;
    background: #1a2332;
    color: inherit;
    padding: 10px;
    min-height: 170px;
    text-align: left;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .reward-card.selected {
    transform: scale(1.03);
    box-shadow: 0 0 0 2px #F1C40F;
  }

  .top {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  .icon {
    font-size: 20px;
  }

  .name {
    margin-top: 10px;
    font-weight: 700;
    font-size: 14px;
    min-height: 34px;
  }

  .value {
    margin-top: 10px;
    font-size: 22px;
    font-weight: 800;
  }

  .domain {
    margin-top: 8px;
    font-size: 12px;
    color: var(--domain-color);
    text-transform: capitalize;
  }

  .tier {
    margin-top: 6px;
    font-size: 11px;
    color: #C0C0C0;
    font-weight: 700;
  }

  .confirm,
  .skip {
    width: 240px;
    height: 52px;
    border-radius: 10px;
    border: none;
    font-size: 16px;
    font-weight: 700;
  }

  .confirm {
    background: #27AE60;
    color: #fff;
    margin-top: 8px;
  }

  .skip {
    background: #2D333B;
    color: #9BA4AD;
  }

  @media (max-width: 680px) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
</style>

