<script lang="ts">
  import type { RoomOption } from '../../services/floorManager'

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

  function handleTap(index: number): void {
    tappedIndex = index
    // Brief scale-up animation, then fire callback
    setTimeout(() => {
      tappedIndex = null
      onselect(index)
    }, 100)
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

<div class="room-selection-overlay">
  <h1 class="title">Choose Your Path</h1>
  <p class="floor-info">Floor {currentFloor} &mdash; Encounter {encounterNumber}</p>

  <div class="hp-bar-container">
    <div class="hp-bar-bg">
      <div
        class="hp-bar-fill"
        style="width: {hpPercent}%"
      ></div>
    </div>
    <span class="hp-text">{playerHp} / {playerMaxHp}</span>
  </div>

  <div class="room-cards">
    {#each options as option, i (i)}
      <button
        class="room-card"
        class:tapped={tappedIndex === i}
        style="border-color: {getBorderColor(option.type)}"
        data-testid="room-choice-{i}"
        onclick={() => handleTap(i)}
      >
        <span class="room-icon">{option.icon}</span>
        <span class="room-label">{option.label}</span>
        <span class="room-detail">{option.detail}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .room-selection-overlay {
    position: fixed;
    inset: 0;
    background: #0D1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
    z-index: 200;
  }

  .title {
    font-size: 20px;
    color: #E6EDF3;
    margin: 16px 0 4px;
    text-align: center;
  }

  .floor-info {
    font-size: 14px;
    color: #8B949E;
    margin: 0 0 16px;
  }

  .hp-bar-container {
    width: 100%;
    max-width: 340px;
    margin-bottom: 24px;
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
    font-size: 10px;
    color: #E6EDF3;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .room-cards {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: nowrap;
  }

  .room-card {
    width: 100px;
    height: 140px;
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.1s;
    padding: 8px;
  }

  .room-card:hover {
    transform: scale(1.03);
  }

  .room-card.tapped {
    transform: scale(1.05);
  }

  .room-icon {
    font-size: 32px;
  }

  .room-label {
    font-size: 12px;
    color: #E6EDF3;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
  }

  .room-detail {
    font-size: 10px;
    color: #8B949E;
    text-align: center;
    line-height: 1.2;
  }
</style>
