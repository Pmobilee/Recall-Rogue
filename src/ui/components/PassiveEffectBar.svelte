<script lang="ts">
  import type { PassiveEffect } from '../../data/card-types'
  import type { CardType } from '../../data/card-types'
  import { getCardTypeIconPath, getCardTypeEmoji } from '../utils/iconAssets'

  interface Props {
    passives: PassiveEffect[]
  }

  let { passives }: Props = $props()

  /** Emoji fallbacks */
  const TYPE_EMOJI: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    wild: '💎',
  }

  const DOMAIN_COLORS: Record<string, string> = {
    science: '#E74C3C',
    history: '#3498DB',
    geography: '#F1C40F',
    language: '#2ECC71',
    math: '#9B59B6',
    arts: '#E67E22',
    medicine: '#1ABC9C',
    technology: '#95A5A6',
  }
</script>

{#if passives.length > 0}
  <div class="passive-bar" data-testid="passive-effects">
    {#each passives as p (p.sourceFactId)}
      <div
        class="passive-icon"
        style="border-color: {DOMAIN_COLORS[p.domain] ?? '#888'};"
        title="{p.cardType} +{p.value}"
      >
        <img class="passive-icon-img" src={getCardTypeIconPath(p.cardType)} alt=""
          onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
        <span class="passive-emoji" style="display:none">{TYPE_EMOJI[p.cardType] ?? '?'}</span>
        <span class="passive-value">+{p.value}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .passive-bar {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    z-index: 5;
  }

  .passive-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(30, 45, 61, 0.9);
    border: 1px solid;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    min-width: calc(32px * var(--layout-scale, 1));
  }

  .passive-icon-img {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    object-fit: contain;
  }

  .passive-emoji {
    font-size: calc(14px * var(--text-scale, 1));
    line-height: 1;
  }

  .passive-value {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    color: #FFD700;
    line-height: 1;
  }
</style>
