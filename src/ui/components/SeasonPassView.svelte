<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { getCurrentSeason, computeSeasonPoints, type SeasonReward } from '../../data/seasonPass'
  import { purchaseProduct } from '../../services/iapService'

  interface Props {
    onClose: () => void
  }
  let { onClose }: Props = $props()

  const season = getCurrentSeason()

  const progress = $derived($playerSave?.seasonPassProgress ?? {
    seasonId: season.id,
    points: 0,
    claimedFree: [],
    claimedPremium: [],
    hasPremium: false,
  })

  const currentPoints = $derived(
    $playerSave
      ? computeSeasonPoints(
          $playerSave.stats.totalFactsLearned,
          Object.keys($playerSave.fossils ?? {}).length,
          $playerSave.stats.totalDivesCompleted,
        )
      : 0
  )

  const maxPoints = $derived(season.freeTrack[season.freeTrack.length - 1]?.points ?? 2000)
  const progressPercent = $derived(Math.min(100, (currentPoints / maxPoints) * 100))

  let purchasing = $state(false)

  async function handleUpgrade() {
    purchasing = true
    await purchaseProduct('com.terragacha.seasonpass.current')
    purchasing = false
  }

  function getMilestoneStatus(reward: SeasonReward, index: number, claimed: number[]): 'locked' | 'claimable' | 'claimed' {
    if (claimed.includes(index)) return 'claimed'
    if (currentPoints >= reward.points) return 'claimable'
    return 'locked'
  }
</script>

<div class="season-overlay">
  <div class="season-modal">
    <button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
    <h2 class="season-title">{season.name}</h2>
    <p class="season-theme">Season theme: {season.theme}</p>

    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progressPercent}%"></div>
      </div>
      <p class="points-text">{currentPoints} / {maxPoints} points</p>
    </div>

    <p class="no-fomo">Rewards never expire — complete at your own pace</p>

    <!-- Reward Tracks -->
    <div class="tracks">
      <!-- Free Track -->
      <div class="track free-track">
        <h3 class="track-title">Free Track</h3>
        {#each season.freeTrack as reward, i}
          {@const status = getMilestoneStatus(reward, i, progress.claimedFree)}
          <div class="milestone" class:claimed={status === 'claimed'} class:claimable={status === 'claimable'}>
            <span class="milestone-points">{reward.points}pts</span>
            <span class="milestone-name">{reward.name}</span>
            <span class="milestone-status">
              {#if status === 'claimed'}&#10003;{:else if status === 'claimable'}!{:else}&#128274;{/if}
            </span>
          </div>
        {/each}
      </div>

      <!-- Premium Track -->
      <div class="track premium-track">
        <h3 class="track-title">
          Premium Track
          {#if !progress.hasPremium}
            <button class="upgrade-btn" onclick={handleUpgrade} disabled={purchasing}>
              {purchasing ? '...' : '$4.99'}
            </button>
          {/if}
        </h3>
        {#each season.premiumTrack as reward, i}
          {@const status = progress.hasPremium ? getMilestoneStatus(reward, i, progress.claimedPremium) : 'locked'}
          <div class="milestone premium" class:claimed={status === 'claimed'} class:claimable={status === 'claimable'}>
            <span class="milestone-points">{reward.points}pts</span>
            <span class="milestone-name">{reward.name}</span>
            <span class="milestone-status">
              {#if !progress.hasPremium}&#128274;{:else if status === 'claimed'}&#10003;{:else if status === 'claimable'}!{:else}&#128274;{/if}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .season-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    pointer-events: auto;
    overflow-y: auto;
    padding: 16px;
  }
  .season-modal {
    background: linear-gradient(135deg, #1a1a2e, #0f3460);
    border: 2px solid #4ade80;
    border-radius: 12px;
    padding: 20px;
    max-width: 400px;
    width: 100%;
    font-family: 'Press Start 2P', monospace;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }
  .close-btn {
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
  }
  .season-title {
    color: #4ade80;
    font-size: 12px;
    text-align: center;
    margin: 0 0 4px;
  }
  .season-theme {
    color: #6b7280;
    font-size: 8px;
    text-align: center;
    margin: 0 0 12px;
  }
  .progress-section { margin-bottom: 12px; }
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #374151;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ade80, #22c55e);
    border-radius: 4px;
    transition: width 0.5s;
  }
  .points-text {
    color: #9ca3af;
    font-size: 8px;
    text-align: center;
    margin: 0;
  }
  .no-fomo {
    color: #4ade80;
    font-size: 7px;
    text-align: center;
    margin: 0 0 12px;
    opacity: 0.7;
  }
  .tracks {
    display: flex;
    gap: 8px;
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  .track-title {
    color: #e5e7eb;
    font-size: 9px;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .milestone {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    border-left: 2px solid #374151;
    font-size: 7px;
  }
  .milestone.claimed { border-left-color: #4ade80; opacity: 0.6; }
  .milestone.claimable { border-left-color: #fbbf24; background: rgba(251, 191, 36, 0.05); }
  .milestone.premium { border-left-color: #a78bfa; }
  .milestone-points { color: #6b7280; min-width: 35px; }
  .milestone-name { color: #d1d5db; flex: 1; }
  .milestone-status { color: #9ca3af; min-width: 12px; text-align: center; }
  .upgrade-btn {
    padding: 3px 8px;
    background: #a78bfa;
    color: white;
    border: none;
    border-radius: 4px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    cursor: pointer;
  }
  .upgrade-btn:disabled { opacity: 0.5; }
</style>
