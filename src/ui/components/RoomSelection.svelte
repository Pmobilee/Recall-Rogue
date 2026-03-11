<script lang="ts">
  import { onMount } from 'svelte'
  import type { RoomOption } from '../../services/floorManager'
  import { getDoorSpritePath } from '../utils/domainAssets'

  interface Props {
    options: RoomOption[]
    playerHp: number
    playerMaxHp: number
    currentFloor: number
    encounterNumber: number
    onselect: (index: number) => void
  }

  let { options, playerHp, playerMaxHp, currentFloor, encounterNumber, onselect }: Props = $props()

  let hpPercent = $derived(playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 0)

  let tappedIndex = $state<number | null>(null)
  let introVisible = $state(false)

  onMount(() => {
    const timer = window.setTimeout(() => {
      introVisible = true
    }, 30)
    return () => window.clearTimeout(timer)
  })

  function handleTap(index: number): void {
    tappedIndex = index
    // Brief push-in animation on selected doorway before transition.
    setTimeout(() => {
      tappedIndex = null
      onselect(index)
    }, 180)
  }

  function getBorderColor(type: RoomOption['type']): string {
    switch (type) {
      case 'combat': return '#E74C3C'
      case 'mystery': return '#9B59B6'
      case 'rest': return '#2ECC71'
      case 'treasure': return '#F1C40F'
      case 'shop': return '#E67E22'
      default: return '#484F58'
    }
  }

</script>

<div class="room-selection-overlay" class:intro-visible={introVisible}>
  <div class="hallway-backdrop" aria-hidden="true"></div>

  <header class="hud">
    <h1 class="title">Choose Your Path</h1>
    <p class="floor-info">Floor {currentFloor} - Encounter {encounterNumber}</p>

    <div class="hp-bar-container">
      <div class="hp-bar-bg">
        <div class="hp-bar-fill" style="width: {hpPercent}%"></div>
      </div>
      <span class="hp-text">{playerHp} / {playerMaxHp}</span>
    </div>
  </header>

  <div class="hallway-stage">
    <div class="hallway-vanish-point"></div>
    <div class="hallway-floor-grid"></div>

    <div class="door-row">
      {#each options as option, i (i)}
        <button
          class="room-door"
          class:tapped={tappedIndex === i}
          class:dimmed={tappedIndex !== null && tappedIndex !== i}
          style={`--door-border: ${getBorderColor(option.type)};`}
          data-testid="room-choice-{i}"
          onclick={() => handleTap(i)}
        >
          <img
            class="door-sprite"
            src={getDoorSpritePath(option.type)}
            alt={`${option.label} door`}
            loading="lazy"
          />
          <div class="door-info">
            <span class="room-label">{option.label}</span>
            <span class="room-detail">{option.detail}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .room-selection-overlay {
    position: fixed;
    inset: 0;
    background: #080d14;
    display: grid;
    grid-template-rows: auto 1fr;
    align-items: start;
    padding: 16px 14px 18px;
    z-index: 200;
    overflow: hidden;
    opacity: 0;
    transform: scale(1.03);
    transition: opacity 260ms ease, transform 260ms ease;
  }

  .room-selection-overlay.intro-visible {
    opacity: 1;
    transform: scale(1);
  }

  .hallway-backdrop {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 6%, rgba(255, 228, 175, 0.18), transparent 32%),
      linear-gradient(180deg, rgba(10, 14, 20, 0.5), rgba(4, 7, 11, 0.88)),
      url('/assets/backgrounds/rooms/bg_room_selection.png') center / cover no-repeat;
    filter: saturate(0.85) contrast(1.05);
  }

  .hud {
    position: relative;
    z-index: 2;
    width: min(540px, 100%);
    justify-self: center;
    display: grid;
    gap: 8px;
  }

  .title {
    font-size: 22px;
    color: #f5f7fb;
    margin: 6px 0 0;
    text-align: center;
    letter-spacing: 0.4px;
  }

  .floor-info {
    font-size: 14px;
    color: #b2bdca;
    margin: 0;
    text-align: center;
  }

  .hp-bar-container {
    width: min(380px, 100%);
    justify-self: center;
    margin-bottom: 8px;
    position: relative;
  }

  .hp-bar-bg {
    width: 100%;
    height: 16px;
    background: #21262D;
    border-radius: 8px;
    overflow: hidden;
  }

  .hp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #E74C3C, #27AE60);
    border-radius: 8px;
    transition: width 0.3s ease;
  }

  .hp-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    color: #e6edf3;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .hallway-stage {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    padding-bottom: 28px;
  }

  .hallway-vanish-point {
    position: absolute;
    top: 0;
    left: 50%;
    width: min(580px, 98%);
    height: 60%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at 50% 20%, rgba(208, 171, 107, 0.12), transparent 60%);
    opacity: 0.75;
  }

  .hallway-floor-grid {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(760px, 120%);
    height: 54%;
    transform: translateX(-50%);
    background:
      repeating-linear-gradient(90deg, rgba(116, 135, 157, 0.1) 0 2px, transparent 2px 48px),
      repeating-linear-gradient(180deg, rgba(116, 135, 157, 0.09) 0 2px, transparent 2px 38px),
      linear-gradient(180deg, rgba(13, 20, 30, 0.15), rgba(6, 10, 16, 0.85));
    clip-path: polygon(18% 0, 82% 0, 100% 100%, 0 100%);
    opacity: 0.84;
  }

  .door-row {
    position: relative;
    width: min(440px, 92%);
    display: flex;
    flex-direction: column;
    gap: 14px;
    justify-self: center;
    z-index: 2;
  }

  .room-door {
    position: relative;
    width: 100%;
    height: 80px;
    background: linear-gradient(180deg, rgba(29, 42, 58, 0.9), rgba(11, 18, 26, 0.94));
    border: 2px solid var(--door-border);
    border-radius: 12px;
    display: grid;
    grid-template-columns: 68px 1fr;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    padding: 10px 16px;
    transition: transform 180ms ease, filter 180ms ease, opacity 180ms ease;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  .room-door::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.28), transparent 65%);
    opacity: 0.18;
    transform: translateX(-140%);
    animation: hallwayShimmer 3.1s ease-in-out infinite;
    pointer-events: none;
  }

  .room-door:hover {
    transform: scale(1.02);
    filter: brightness(1.08);
  }

  .room-door.tapped {
    transform: scale(1.04);
    filter: brightness(1.12);
  }

  .room-door.dimmed {
    opacity: 0.24;
    filter: grayscale(0.45);
  }

  .door-sprite {
    width: 48px;
    height: 60px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .door-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .room-label {
    font-size: 16px;
    color: #f1f5f9;
    font-weight: 700;
    text-align: left;
    line-height: 1.2;
  }

  .room-detail {
    font-size: 13px;
    color: #a8b5c4;
    text-align: left;
    line-height: 1.2;
  }

  @keyframes hallwayShimmer {
    0%,
    34% {
      transform: translateX(-145%);
      opacity: 0;
    }
    50% {
      opacity: 0.24;
    }
    72%,
    100% {
      transform: translateX(150%);
      opacity: 0;
    }
  }

  @media (max-width: 560px) {
    .room-door {
      height: 72px;
      padding: 8px 12px;
      grid-template-columns: 56px 1fr;
    }

    .door-sprite {
      width: 42px;
      height: 52px;
    }

    .room-label {
      font-size: 14px;
    }

    .room-detail {
      font-size: 11px;
    }
  }
</style>
