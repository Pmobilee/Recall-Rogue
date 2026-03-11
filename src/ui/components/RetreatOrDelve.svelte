<script lang="ts">
  import { getRandomRoomBg } from '../../data/backgroundManifest'

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

  const bgUrl = getRandomRoomBg('crossroads')

  let retainedOnDeath = $derived(Math.floor(currency * deathPenalty))
</script>

<div class="decision">
  <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
  <div class="decision-content">
    <h1>SEGMENT CLEARED</h1>
    <p>You defeated {bossName}.</p>

    <div class="stats">
      <div>Rewards Earned: <strong>{currency}</strong></div>
      <div>HP: <strong>{playerHp}/{playerMaxHp}</strong></div>
      <div>Next Segment: <strong>{nextSegmentName}</strong></div>
    </div>

    <button class="retreat" onclick={onretreat}>
      Retreat
      <span>
        {#if retreatRewardsLocked}
          No rewards before Floor {retreatRewardsMinFloor ?? 12}
        {:else}
          Keep all {currency}
        {/if}
      </span>
    </button>

    <button class="delve" onclick={ondelve}>
      Delve Deeper
      <span>Death keeps {Math.round(deathPenalty * 100)}% ({retainedOnDeath})</span>
    </button>

    <div class="risk">
      Enemies are stronger. Timer is shorter.
      {#if retreatRewardsLocked}
        Retreat rewards are locked for this depth on current Ascension.
      {/if}
    </div>
  </div>
</div>

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
    padding: 24px 16px;
    z-index: 220;
    gap: 12px;
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
    gap: 12px;
  }

  h1 {
    margin: 0;
    color: #F1C40F;
    letter-spacing: 2px;
    font-size: 24px;
  }

  p {
    margin: 0;
    color: #8B949E;
  }

  .stats {
    margin: 6px 0 10px;
    display: grid;
    gap: 4px;
    text-align: center;
  }

  .retreat,
  .delve {
    width: min(420px, 100%);
    border: none;
    border-radius: 12px;
    min-height: 56px;
    padding: 12px 14px;
    color: #fff;
    font-size: 17px;
    font-weight: 800;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .retreat {
    background: linear-gradient(135deg, #1f8f4d, #27AE60);
  }

  .delve {
    background: linear-gradient(135deg, #B74E00, #E67E22);
  }

  .retreat span,
  .delve span {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.95;
  }

  .risk {
    margin-top: 10px;
    font-size: 13px;
    color: #C9D1D9;
  }
</style>
