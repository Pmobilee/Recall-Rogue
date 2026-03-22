<script lang="ts">
  import type { MysteryEvent, MysteryEffect } from '../../services/floorManager'
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { getMysteryEventIconPath, getMysteryEventEmoji } from '../utils/iconAssets'
  import { isLandscape } from '../../stores/layoutStore'
  import ParallaxTransition from './ParallaxTransition.svelte'

  interface Props {
    event: MysteryEvent | null
    playerHp: number
    playerMaxHp: number
    onresolve: (effect: MysteryEffect) => void
  }

  let { event, playerHp, playerMaxHp, onresolve }: Props = $props()

  const bgUrl = getRandomRoomBg('mystery')
  const depthUrl = getRoomDepthMap('mystery')
  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let effectIcon = $derived(getEffectIcon(event?.effect))
  let showCardReveal = $state(false)

  function getEffectIcon(effect: MysteryEffect | undefined): string {
    if (!effect) return 'choice' // fallback
    switch (effect.type) {
      case 'heal': return 'heal'
      case 'healPercent': return 'heal'
      case 'damage': return 'damage'
      case 'freeCard': return 'free_card'
      case 'cardReward': return 'free_card'
      case 'upgradeRandomCard': return 'free_card'
      case 'transformCard': return 'free_card'
      case 'nothing': return 'nothing'
      case 'choice': return 'choice'
      case 'currency': return 'heal'
      case 'maxHpChange': return 'heal'
      case 'removeRandomCard': return 'damage'
      case 'combat': return 'damage'
      default: return 'choice'
    }
  }

  function handleContinue(): void {
    if (event) {
      onresolve(event.effect)
    }
  }

  function handleChoiceOption(choiceEffect: MysteryEffect): void {
    if (choiceEffect.type === 'damage') {
      showCardReveal = true
      setTimeout(() => {
        onresolve(choiceEffect)
      }, 1200)
    } else {
      onresolve(choiceEffect)
    }
  }
</script>

{#if event}
  <div class="mystery-overlay">
    <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
    <div class="mystery-card">
      <h2 class="event-name">{event.name}</h2>
      <span class="effect-icon">
        <img class="mystery-icon-img" src={getMysteryEventIconPath(effectIcon)} alt=""
          onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
        <span style="display:none">{getMysteryEventEmoji(effectIcon)}</span>
      </span>
      <p class="event-desc">{event.description}</p>

      <div class="hp-info">
        HP: {playerHp} / {playerMaxHp}
      </div>

      {#if event.effect.type === 'choice'}
        <div class="choice-buttons">
          {#each event.effect.options as option, i (i)}
            <button
              class="choice-btn"
              onclick={() => handleChoiceOption(option.effect)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {:else}
        <button
          class="continue-btn"
          data-testid="mystery-continue"
          onclick={handleContinue}
        >
          Continue
        </button>
      {/if}
    </div>
    {#if showCardReveal}
      <div class="card-reveal-overlay">
        <div class="card-reveal">
          <div class="card-reveal-inner">
            <div class="card-reveal-front">
              <span class="reveal-icon">🃏</span>
              <span class="reveal-text">New Card!</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mystery-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .overlay-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .mystery-card {
    background: #161B22;
    border: 2px solid #9B59B6;
    border-radius: 12px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(340px * var(--layout-scale, 1));
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    position: relative;
    z-index: 1;
  }

  .event-name {
    font-size: calc(18px * var(--layout-scale, 1));
    color: #9B59B6;
    margin: 0;
    text-align: center;
  }

  .effect-icon {
    font-size: calc(48px * var(--layout-scale, 1));
  }

  .event-desc {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #C9D1D9;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .hp-info {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8B949E;
  }

  .choice-buttons {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .choice-btn {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: 8px;
    color: #E6EDF3;
    font-size: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.15s;
  }

  .choice-btn:hover {
    background: #2D333B;
  }

  .continue-btn {
    width: 100%;
    padding: calc(14px * var(--layout-scale, 1));
    background: #9B59B6;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .continue-btn:hover {
    transform: scale(1.03);
  }

  .mystery-icon-img {
    width: calc(4rem * var(--layout-scale, 1));
    height: calc(4rem * var(--layout-scale, 1));
    image-rendering: pixelated;
    display: inline-block;
  }

  .card-reveal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    animation: revealFadeIn 200ms ease-out;
  }

  .card-reveal {
    perspective: 800px;
  }

  .card-reveal-inner {
    width: calc(180px * var(--layout-scale, 1));
    height: calc(260px * var(--layout-scale, 1));
    border-radius: 14px;
    background: linear-gradient(145deg, #2a1f4e, #1a1040);
    border: 3px solid #c084fc;
    box-shadow:
      0 0 30px rgba(192, 132, 252, 0.4),
      0 20px 60px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: cardWaveReveal 1000ms ease-out;
  }

  .card-reveal-front {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .reveal-icon {
    font-size: calc(64px * var(--layout-scale, 1));
    animation: revealPulse 600ms ease-in-out 200ms;
  }

  .reveal-text {
    font-family: var(--font-pixel);
    font-size: calc(14px * var(--layout-scale, 1));
    color: #e9d5ff;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 #000, calc(2px * var(--layout-scale, 1)) 0 #000, 0 calc(-2px * var(--layout-scale, 1)) #000, 0 calc(2px * var(--layout-scale, 1)) #000;
    letter-spacing: calc(1px * var(--layout-scale, 1));
  }

  @keyframes cardWaveReveal {
    0% {
      transform: rotateY(-90deg) rotateZ(5deg) scale(0.6);
      opacity: 0;
    }
    30% {
      transform: rotateY(15deg) rotateZ(-2deg) scale(1.05);
      opacity: 1;
    }
    50% {
      transform: rotateY(-8deg) rotateZ(1deg) scale(1);
    }
    70% {
      transform: rotateY(4deg) rotateZ(0deg) scale(1);
    }
    100% {
      transform: rotateY(0deg) rotateZ(0deg) scale(1);
    }
  }

  @keyframes revealFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes revealPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-reveal-inner {
      animation: none;
    }
    .reveal-icon {
      animation: none;
    }
  }
</style>
