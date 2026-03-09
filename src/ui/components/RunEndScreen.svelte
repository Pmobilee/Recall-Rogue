<script lang="ts">
  interface Props {
    result: 'victory' | 'defeat' | 'retreat'
    floorReached: number
    factsAnswered: number
    accuracy: number
    bestCombo: number
    cardsEarned: number
    rewardMultiplier: number
    currencyEarned: number
    onplayagain: () => void
    onhome: () => void
  }

  let { result, floorReached, factsAnswered, accuracy, bestCombo, cardsEarned, rewardMultiplier, currencyEarned, onplayagain, onhome }: Props = $props()

  let isVictory = $derived(result === 'victory' || result === 'retreat')
  let headerText = $derived(result === 'retreat' ? 'SAFE RETREAT' : isVictory ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED')
  let headerColor = $derived(isVictory ? '#F1C40F' : '#E74C3C')
</script>

<div class="run-end-overlay">
  <h1 class="header" style="color: {headerColor}">{headerText}</h1>

  <div class="stats-list">
    <div class="stat-row">
      <span class="stat-label">Floor Reached</span>
      <span class="stat-value">{floorReached}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Facts Answered</span>
      <span class="stat-value">{factsAnswered}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Accuracy</span>
      <span class="stat-value">{accuracy}%</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Best Combo</span>
      <span class="stat-value">{bestCombo}x</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Cards Earned</span>
      <span class="stat-value">{cardsEarned}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Reward Multiplier</span>
      <span class="stat-value">{Math.round(rewardMultiplier * 100)}%</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Currency Earned</span>
      <span class="stat-value">{currencyEarned}</span>
    </div>
  </div>

  <div class="btn-row">
    <button
      class="btn btn-play-again"
      data-testid="btn-play-again"
      onclick={onplayagain}
    >
      Play Again
    </button>
    <button
      class="btn btn-home"
      data-testid="btn-home"
      onclick={onhome}
    >
      Home
    </button>
  </div>
</div>

<style>
  .run-end-overlay {
    position: fixed;
    inset: 0;
    background: #0D1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    z-index: 200;
  }

  .header {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 32px;
    text-align: center;
    letter-spacing: 2px;
  }

  .stats-list {
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 40px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #161B22;
    border-radius: 8px;
  }

  .stat-label {
    font-size: 14px;
    color: #8B949E;
  }

  .stat-value {
    font-size: 16px;
    color: #E6EDF3;
    font-weight: 700;
  }

  .btn-row {
    display: flex;
    gap: 16px;
  }

  .btn {
    min-width: 120px;
    height: 48px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .btn:hover {
    transform: scale(1.03);
  }

  .btn-play-again {
    background: #27AE60;
    color: #fff;
  }

  .btn-home {
    background: #2D333B;
    color: #8B949E;
  }
</style>
