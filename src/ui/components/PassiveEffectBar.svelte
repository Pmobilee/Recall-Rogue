<script lang="ts">
  import type { PassiveEffect } from '../../data/card-types'
  import type { CardType } from '../../data/card-types'

  interface Props {
    passives: PassiveEffect[]
  }

  let { passives }: Props = $props()

  const TYPE_ICONS: Record<CardType, string> = {
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
        <span class="passive-emoji">{TYPE_ICONS[p.cardType] ?? '?'}</span>
        <span class="passive-value">+{p.value}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .passive-bar {
    position: absolute;
    top: 8px;
    left: 16px;
    display: flex;
    gap: 6px;
    z-index: 5;
  }

  .passive-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(30, 45, 61, 0.9);
    border: 1px solid;
    border-radius: 6px;
    padding: 2px 6px;
    min-width: 32px;
  }

  .passive-emoji {
    font-size: 14px;
    line-height: 1;
  }

  .passive-value {
    font-size: 9px;
    font-weight: 700;
    color: #FFD700;
    line-height: 1;
  }
</style>
