<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getTierDisplayName, getDisplayTier } from '../../services/tierDerivation'

  interface UpgradePreview {
    upgradedName: string
    currentBaseValue: number
    newBaseValue: number
    secondaryDelta?: number
    addTag?: string
  }

  interface Props {
    candidates: Array<{ card: Card; preview: UpgradePreview }>
    onselect: (cardId: string) => void
    onskip: () => void
  }

  let { candidates, onselect, onskip }: Props = $props()

  const TYPE_ICONS: Record<string, string> = {
    attack: '\u2694',
    shield: '\uD83D\uDEE1',
    heal: '\uD83D\uDC9A',
    utility: '\u2B50',
    buff: '\u2B06',
    debuff: '\u2B07',
    regen: '\u2795',
    wild: '\uD83D\uDC8E',
  }
</script>

<div class="upgrade-overlay">
  <div class="upgrade-panel">
    <h2 class="title">Upgrade a Card</h2>
    <p class="subtitle">Choose one card to enhance</p>

    <div class="candidates">
      {#each candidates as { card, preview } (card.id)}
        {@const tierClass = getDisplayTier(card.tier)}
        <button
          class="candidate-card {tierClass}"
          data-testid="upgrade-candidate-{card.id}"
          onclick={() => onselect(card.id)}
        >
          <div class="card-header">
            <span class="type-icon">{TYPE_ICONS[card.cardType] ?? '\uD83C\uDCCF'}</span>
            <span class="tier-badge {tierClass}">{getTierDisplayName(card.tier)}</span>
          </div>
          <div class="mechanic-name">{card.mechanicName ?? card.cardType}</div>
          <div class="upgrade-arrow">
            <span class="old-value">{preview.currentBaseValue}</span>
            <span class="arrow">\u2192</span>
            <span class="new-value">{preview.newBaseValue}</span>
          </div>
          {#if preview.secondaryDelta}
            <div class="secondary-info">+{preview.secondaryDelta} hit{preview.secondaryDelta > 1 ? 's' : ''}</div>
          {/if}
          {#if preview.addTag}
            <div class="secondary-info">+{preview.addTag}</div>
          {/if}
          <div class="upgraded-name">{preview.upgradedName}</div>
        </button>
      {/each}
    </div>

    <button class="skip-btn" data-testid="upgrade-skip" onclick={onskip}>
      Skip
    </button>
  </div>
</div>

<style>
  .upgrade-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    padding: 16px;
  }

  .upgrade-panel {
    background: #161b22;
    border: 2px solid #3498db;
    border-radius: 12px;
    padding: 20px;
    max-width: 380px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .title {
    font-size: 20px;
    color: #3498db;
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: #8b949e;
    margin: 0;
  }

  .candidates {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .candidate-card {
    background: rgba(13, 17, 23, 0.82);
    border: 2px solid #3b434f;
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    color: #e6edf3;
    width: 100%;
  }

  .candidate-card:hover {
    transform: scale(1.02);
    border-color: #3498db;
  }

  .candidate-card.gold {
    border-color: #f1c40f44;
  }

  .candidate-card.silver {
    border-color: #95a5a644;
  }

  .candidate-card.bronze {
    border-color: #cd7f3244;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .type-icon {
    font-size: 18px;
  }

  .tier-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .tier-badge.gold {
    background: #f1c40f33;
    color: #f1c40f;
  }

  .tier-badge.silver {
    background: #95a5a633;
    color: #95a5a6;
  }

  .tier-badge.bronze {
    background: #cd7f3233;
    color: #cd7f32;
  }

  .mechanic-name {
    font-weight: 700;
    font-size: 14px;
  }

  .upgrade-arrow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 600;
  }

  .old-value {
    color: #8b949e;
  }

  .arrow {
    color: #3498db;
  }

  .new-value {
    color: #2ecc71;
  }

  .secondary-info {
    font-size: 11px;
    color: #3498db;
    font-weight: 600;
  }

  .upgraded-name {
    font-size: 12px;
    color: #2ecc71;
    font-weight: 700;
  }

  .skip-btn {
    margin-top: 4px;
    min-height: 44px;
    width: 100%;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #9ba4ad;
    font-weight: 700;
    cursor: pointer;
  }

  .skip-btn:hover {
    border-color: #6b7280;
    color: #e5e7eb;
  }
</style>
