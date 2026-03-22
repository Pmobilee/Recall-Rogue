<script lang="ts">
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { isLandscape } from '../../stores/layoutStore'
  import ParallaxTransition from './ParallaxTransition.svelte'

  interface Props {
    bossName: string
    segment: 1 | 2 | 3 | 4
    currency: number
    playerHp: number
    playerMaxHp: number
    nextSegmentName: string
    deathPenalty: number
    retreatRewardsLocked?: boolean
    retreatRewardsMinFloor?: number | null
    onretreat: () => void
    ondelve: () => void
  }

  let {
    bossName,
    segment,
    currency,
    playerHp,
    playerMaxHp,
    nextSegmentName,
    deathPenalty,
    retreatRewardsLocked = false,
    retreatRewardsMinFloor = null,
    onretreat,
    ondelve,
  }: Props = $props()

  const bgUrl = getRandomRoomBg('descent')
  const depthUrl = getRoomDepthMap('descent')
  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let retainedOnDeath = $derived(Math.floor(currency * deathPenalty))
</script>

<div class="decision" class:landscape={$isLandscape}>
  <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
  <div class="decision-content">
    <h1>SEGMENT CLEARED</h1>
    <p>You defeated {bossName}.</p>

    <div class="stats">
      <div>Rewards Earned: <strong>{currency}</strong></div>
      <div>HP: <strong>{playerHp}/{playerMaxHp}</strong></div>
      <div>Next Segment: <strong>{nextSegmentName}</strong></div>
    </div>

    <div class="btn-row">
      <button class="retreat" onclick={onretreat} data-testid="btn-retreat">
        Retreat
        <span>
          {#if retreatRewardsLocked}
            No rewards before Floor {retreatRewardsMinFloor ?? 12}
          {:else}
            Keep all {currency}
          {/if}
        </span>
      </button>

      <button class="delve" onclick={ondelve} data-testid="btn-delve">
        Delve Deeper
        <span>Death keeps {Math.round(deathPenalty * 100)}% ({retainedOnDeath})</span>
      </button>
    </div>

    <div class="risk">
      Enemies are stronger. Timer is shorter.
      {#if retreatRewardsLocked}
        Retreat rewards are locked for this depth on current Ascension.
      {/if}
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
  .decision {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.65);
    color: #E6EDF3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(24px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    z-index: 220;
    gap: calc(12px * var(--layout-scale, 1));
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

  .decision-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  h1 {
    margin: 0;
    color: #F1C40F;
    letter-spacing: 2px;
    font-size: calc(24px * var(--text-scale, 1));
  }

  p {
    margin: 0;
    color: #8B949E;
    font-size: calc(15px * var(--text-scale, 1));
  }

  .stats {
    margin: calc(6px * var(--layout-scale, 1)) 0 calc(10px * var(--layout-scale, 1));
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
    text-align: center;
    font-size: calc(17px * var(--text-scale, 1));
    color: #e6edf3;
  }

  .stats strong {
    color: #f1c40f;
  }

  .btn-row {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    width: min(calc(420px * var(--layout-scale, 1)), 100%);
  }

  .retreat,
  .delve {
    width: 100%;
    border: none;
    border-radius: calc(12px * var(--layout-scale, 1));
    min-height: calc(56px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(17px * var(--text-scale, 1));
    font-weight: 800;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .retreat {
    background: linear-gradient(135deg, #1f8f4d, #27AE60);
  }

  .delve {
    background: linear-gradient(135deg, #B74E00, #E67E22);
  }

  .retreat span,
  .delve span {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    opacity: 0.95;
  }

  .risk {
    margin-top: calc(10px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    color: #C9D1D9;
    text-align: center;
  }

  /* === Landscape layout === */
  .decision.landscape {
    background: rgba(0, 0, 0, 0.6);
  }

  .decision.landscape .decision-content {
    background: #161b22;
    border: 1px solid #3b434f;
    border-radius: calc(16px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    width: min(65vw, 860px);
    max-height: 85vh;
    overflow-y: auto;
  }

  /* Wrap the two buttons in a row when landscape */
  .decision.landscape .btn-row {
    flex-direction: row;
    gap: calc(16px * var(--layout-scale, 1));
    width: 100%;
  }

  .decision.landscape .btn-row .retreat,
  .decision.landscape .btn-row .delve {
    flex: 1;
    min-height: calc(72px * var(--layout-scale, 1));
    font-size: calc(19px * var(--text-scale, 1));
  }
</style>
