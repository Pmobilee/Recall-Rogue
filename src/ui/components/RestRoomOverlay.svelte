<script lang="ts">
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { isLandscape } from '../../stores/layoutStore'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    playerHp: number
    playerMaxHp: number
    onheal: () => void
    onstudy: () => void
    onmeditate: () => void
    studyDisabled?: boolean
    studyDisabledReason?: string
    meditateDisabled?: boolean
    meditateDisabledReason?: string
  }

  let {
    playerHp,
    playerMaxHp,
    onheal,
    onstudy,
    onmeditate,
    studyDisabled = false,
    studyDisabledReason = 'No cards to upgrade',
    meditateDisabled = false,
    meditateDisabledReason = 'Deck too small',
  }: Props = $props()
  const bgUrl = getRandomRoomBg('rest')
  const depthUrl = getRoomDepthMap('rest')
  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let healAmount = $derived(Math.round(playerMaxHp * 0.3))
  let projectedHp = $derived(Math.min(playerMaxHp, playerHp + healAmount))

  $effect(() => {
    playCardAudio('rest-open')
  })
</script>

<div class="rest-overlay" class:landscape={$isLandscape}>
  <img class="screen-bg" src={bgUrl} alt="" aria-hidden="true" loading="eager" decoding="async" />
  <div class="rest-card" style="position: relative; z-index: 1;">
    <h2 class="rest-title">Rest Site</h2>
    <p class="rest-choice-caption">Choose one: Rest, Study, or Meditate</p>

    <div class="hp-info">
      HP: {playerHp} / {playerMaxHp}
    </div>

    <div class="option-cards" role="radiogroup" aria-label="Rest site options">
      <button
        class="option-card heal-card"
        data-testid="rest-heal"
        onclick={() => { playCardAudio('rest-heal'); onheal() }}
      >
        <span class="option-icon">❤️</span>
        <span class="option-label">Rest</span>
        <span class="option-detail">Heal 30% HP</span>
        <span class="option-preview">+{healAmount} HP &rarr; {projectedHp}</span>
      </button>

      <button
        class="option-card study-card"
        class:disabled={studyDisabled}
        data-testid="rest-study"
        onclick={() => { if (!studyDisabled) { playCardAudio('rest-study'); onstudy() } }}
        disabled={studyDisabled}
      >
        <span class="option-icon">📖</span>
        <span class="option-label">Study</span>
        <span class="option-detail">Quiz 3 questions — each correct upgrades a card</span>
        <span class="option-preview">{studyDisabled ? studyDisabledReason : 'Answer questions to upgrade cards'}</span>
      </button>

      <button
        class="option-card meditate-card"
        class:disabled={meditateDisabled}
        data-testid="rest-meditate"
        onclick={() => { if (!meditateDisabled) { playCardAudio('rest-meditate'); onmeditate() } }}
        disabled={meditateDisabled}
      >
        <span class="option-icon">🧘</span>
        <span class="option-label">Meditate</span>
        <span class="option-detail">Remove 1 card from your deck</span>
        <span class="option-preview">{meditateDisabled ? meditateDisabledReason : 'Remove 1 card from deck'}</span>
      </button>
    </div>
  </div>
</div>

{#if showRoomTransition}
  <ParallaxTransition
    imageUrl={bgUrl}
    depthUrl={depthUrl}
    type="enter"
    onComplete={() => { showRoomTransition = false }}
      persist
  />
{/if}

<style>
  .rest-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.65);
    display: flex;
    align-items: center;
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
    border-radius: 12px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(480px * var(--layout-scale, 1));
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
    font-size: calc(16px * var(--layout-scale, 1));
    color: #e7f0ff;
    font-weight: 700;
  }

  .option-cards {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .option-card {
    flex: 1;
    min-width: 0;
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(14px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
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

  .study-card:hover:not(.disabled) {
    border-color: #7C3AED;
  }

  .meditate-card:hover:not(.disabled) {
    border-color: #14B8A6;
  }

  .study-card.disabled,
  .meditate-card.disabled {
    border-color: #5b6471;
    background: #17212b;
    filter: grayscale(0.35);
    opacity: 0.72;
    transform: none;
    box-shadow: none;
  }

  .study-card.disabled .option-preview,
  .meditate-card.disabled .option-preview {
    opacity: 0.5;
    color: #9BA3AB;
  }

  .study-card.disabled:hover,
  .meditate-card.disabled:hover {
    border-color: #5b6471;
    box-shadow: none;
    transform: none;
  }

  .option-icon {
    font-size: calc(26px * var(--layout-scale, 1));
  }

  .option-label {
    font-size: calc(13px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-weight: 700;
  }

  .option-detail {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #8B949E;
    text-align: center;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .option-preview {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #6E7681;
    text-align: center;
    margin-top: calc(4px * var(--layout-scale, 1));
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .option-card:not(:disabled):not(.option-disabled) {
    border-color: #2ECC71;
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.3);
  }

  /* === Landscape layout === */
  .rest-overlay.landscape {
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    padding: 0;
  }

  .rest-overlay.landscape .rest-card {
    border: 2px solid #2ECC71;
    border-radius: 12px;
    border-top: 2px solid #2ECC71;
    max-width: min(80vw, 900px);
    padding: calc(32px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    padding-top: calc(32px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-cards {
    gap: calc(16px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-card {
    padding: calc(24px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-icon {
    font-size: calc(36px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-label {
    font-size: calc(16px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-detail {
    font-size: calc(12px * var(--layout-scale, 1));
  }

  .rest-overlay.landscape .option-preview {
    font-size: calc(11px * var(--layout-scale, 1));
  }
</style>
