<script lang="ts">
  import { getRandomRoomBg } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'

  interface Props {
    playerHp: number
    playerMaxHp: number
    onheal: () => void
    onupgrade: () => void
    upgradeDisabled?: boolean
    upgradeDisabledReason?: string
  }

  let { playerHp, playerMaxHp, onheal, onupgrade, upgradeDisabled = false, upgradeDisabledReason = 'No cards to upgrade' }: Props = $props()
  const bgUrl = getRandomRoomBg('rest')
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let healAmount = $derived(Math.round(playerMaxHp * 0.3))
  let projectedHp = $derived(Math.min(playerMaxHp, playerHp + healAmount))
</script>

<div class="rest-overlay">
  <img class="screen-bg" src={bgUrl} alt="" aria-hidden="true" loading="eager" decoding="async" />
  <div class="rest-card" style="position: relative; z-index: 1;">
    <h2 class="rest-title">Rest Site</h2>
    <p class="rest-choice-caption">Choose one: Rest or Upgrade</p>

    <div class="hp-info">
      HP: {playerHp} / {playerMaxHp}
    </div>

    <div class="option-cards">
      <button
        class="option-card heal-card"
        data-testid="rest-heal"
        onclick={onheal}
      >
        <span class="option-icon">{'\u2764\uFE0F'}</span>
        <span class="option-label">Rest</span>
        <span class="option-detail">Heal 30% HP</span>
        <span class="option-preview">+{healAmount} HP &rarr; {projectedHp}</span>
      </button>

      <button
        class="option-card upgrade-card"
        class:disabled={upgradeDisabled}
        data-testid="rest-upgrade"
        onclick={() => { if (!upgradeDisabled) onupgrade() }}
        disabled={upgradeDisabled}
      >
        <span class="option-icon">{'\u2B06\uFE0F'}</span>
        <span class="option-label">Upgrade</span>
        <span class="option-detail">Boost one card</span>
        <span class="option-preview">{upgradeDisabled ? upgradeDisabledReason : 'Enhance one card'}</span>
      </button>
    </div>
  </div>
</div>

<style>
  .rest-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.65);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 200;
    padding: 0 calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  .screen-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .rest-card {
    background: #161B22;
    border: 2px solid #2ECC71;
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: calc(24px * var(--layout-scale, 1));
    padding-top: calc(60px * var(--layout-scale, 1) + var(--safe-top, 0px));
    max-width: calc(340px * var(--layout-scale, 1));
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
  }

  .rest-title {
    font-size: calc(20px * var(--layout-scale, 1));
    color: #2ECC71;
    margin: 0;
  }

  .rest-choice-caption {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #9adab4;
    margin: calc(-6px * var(--layout-scale, 1)) 0 0;
    text-align: center;
    font-weight: 700;
  }

  .hp-info {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #8B949E;
  }

  .option-cards {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
  }

  .option-card {
    flex: 1;
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(16px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
  }

  .option-card:hover {
    transform: scale(1.03);
  }

  .option-card:disabled {
    cursor: not-allowed;
  }

  .heal-card:hover {
    border-color: #2ECC71;
  }

  .upgrade-card:hover {
    border-color: #3498DB;
  }

  .upgrade-card.disabled {
    border-color: #5b6471;
    background: #17212b;
    filter: grayscale(0.35);
    opacity: 0.72;
    transform: none;
  }

  .upgrade-card.disabled:hover {
    border-color: #5b6471;
    transform: none;
  }

  .option-icon {
    font-size: calc(28px * var(--layout-scale, 1));
  }

  .option-label {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-weight: 700;
  }

  .option-detail {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #8B949E;
    text-align: center;
  }

  .option-preview {
    font-size: calc(10px * var(--layout-scale, 1));
    color: #6E7681;
    text-align: center;
    margin-top: calc(4px * var(--layout-scale, 1));
  }
</style>
