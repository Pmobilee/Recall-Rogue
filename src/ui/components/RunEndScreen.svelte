<script lang="ts">
  import { shareRunSummaryCard } from '../../services/runShareService'
  import { analyticsService } from '../../services/analyticsService'
  import { difficultyMode, type DifficultyMode } from '../../services/cardPreferences'

  interface Props {
    result: 'victory' | 'defeat' | 'retreat'
    floorReached: number
    factsAnswered: number
    correctAnswers: number
    accuracy: number
    bestCombo: number
    cardsEarned: number
    newFactsLearned: number
    factsMastered: number
    encountersWon: number
    encountersTotal: number
    completedBounties: string[]
    runDurationMs?: number
    rewardMultiplier: number
    currencyEarned: number
    isFirstRunComplete?: boolean
    onplayagain: () => void
    onhome: () => void
  }

  let {
    result,
    floorReached,
    factsAnswered,
    correctAnswers,
    accuracy,
    bestCombo,
    cardsEarned,
    newFactsLearned,
    factsMastered,
    encountersWon,
    encountersTotal,
    completedBounties,
    runDurationMs = 0,
    rewardMultiplier,
    currencyEarned,
    isFirstRunComplete = false,
    onplayagain,
    onhome,
  }: Props = $props()

  let isVictory = $derived(result === 'victory' || result === 'retreat')
  let headerText = $derived(result === 'retreat' ? 'SAFE RETREAT' : isVictory ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED')
  let headerColor = $derived(isVictory ? '#F1C40F' : '#E74C3C')
  let shareStatus = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')
  let showDifficultyUnlock = $state(false)
  let selectedDifficulty = $state<DifficultyMode>('normal')

  $effect(() => {
    if (isFirstRunComplete) {
      const timer = setTimeout(() => { showDifficultyUnlock = true }, 1500)
      return () => clearTimeout(timer)
    }
  })

  function confirmDifficulty(): void {
    difficultyMode.set(selectedDifficulty)
    showDifficultyUnlock = false
  }

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  async function handleShare(): Promise<void> {
    shareStatus = 'sharing'
    try {
      const method = await shareRunSummaryCard({
        result,
        floorReached,
        factsAnswered,
        correctAnswers,
        accuracy,
        bestCombo,
        cardsEarned,
        newFactsLearned,
        factsMastered,
        encountersWon,
        encountersTotal,
        completedBounties,
        duration: runDurationMs,
        runDurationMs,
        rewardMultiplier,
        currencyEarned,
      })
      analyticsService.track({
        name: 'share_card_generated',
        properties: {
          template: 'dive_record',
          platform: method,
          facts_mastered: factsMastered,
          tree_completion_pct: Math.max(0, Math.min(100, Math.round((accuracy + (factsMastered * 2)) / 2))),
        },
      })
      shareStatus = 'done'
    } catch {
      shareStatus = 'error'
    } finally {
      setTimeout(() => {
        shareStatus = 'idle'
      }, 1500)
    }
  }
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
      <span class="stat-label">Correct Answers</span>
      <span class="stat-value">{correctAnswers}</span>
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
    <div class="stat-row">
      <span class="stat-label">New Facts Learned</span>
      <span class="stat-value">{newFactsLearned}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Facts Mastered</span>
      <span class="stat-value">{factsMastered}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Encounters</span>
      <span class="stat-value">{encountersWon}/{encountersTotal}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Run Time</span>
      <span class="stat-value">{formatDuration(runDurationMs)}</span>
    </div>
    {#if completedBounties.length > 0}
      <div class="bounty-list">
        <strong>Bounties Cleared</strong>
        {#each completedBounties as bounty}
          <span class="bounty-item">{bounty}</span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="btn-row">
    <button
      class="btn btn-share"
      data-testid="btn-share-run"
      onclick={handleShare}
      disabled={shareStatus === 'sharing'}
    >
      {shareStatus === 'sharing' ? 'Sharing...' : shareStatus === 'done' ? 'Shared' : shareStatus === 'error' ? 'Retry Share' : 'Share'}
    </button>
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

  {#if showDifficultyUnlock}
    <div class="difficulty-unlock-overlay" role="dialog" aria-modal="true" aria-label="Difficulty modes unlocked">
      <div class="difficulty-unlock-modal">
        <div class="unlock-badge">🎉</div>
        <h3>Difficulty Modes Unlocked!</h3>
        <p class="unlock-desc">Great first run! You can now choose how you want to play. You can change this anytime in Settings.</p>

        <div class="difficulty-options">
          <button
            class="diff-option"
            class:diff-selected={selectedDifficulty === 'relaxed'}
            onclick={() => selectedDifficulty = 'relaxed'}
          >
            <span class="diff-name">Relaxed</span>
            <span class="diff-detail">No timer — learn at your own pace</span>
          </button>
          <button
            class="diff-option"
            class:diff-selected={selectedDifficulty === 'normal'}
            onclick={() => selectedDifficulty = 'normal'}
          >
            <span class="diff-name">Normal</span>
            <span class="diff-detail">Answer before time runs out — the intended experience</span>
            <span class="diff-recommended">Recommended</span>
          </button>
        </div>

        <button class="diff-confirm-btn" onclick={confirmDifficulty}>
          Continue
        </button>
      </div>
    </div>
  {/if}
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
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
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

  .btn-share {
    background: #1d4ed8;
    color: #e2e8f0;
  }

  .bounty-list {
    background: rgba(241, 196, 15, 0.08);
    border: 1px solid rgba(241, 196, 15, 0.4);
    border-radius: 8px;
    padding: 8px 10px;
    display: grid;
    gap: 4px;
  }

  .bounty-list strong {
    color: #f4d35e;
    font-size: 12px;
  }

  .bounty-item {
    font-size: 11px;
    color: #e7f0ff;
  }

  .difficulty-unlock-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .difficulty-unlock-modal {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #f1c40f;
    border-radius: 16px;
    padding: 24px 20px;
    max-width: 340px;
    width: 90%;
    text-align: center;
  }

  .unlock-badge {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .difficulty-unlock-modal h3 {
    color: #f1c40f;
    margin: 0 0 8px;
    font-size: 18px;
  }

  .unlock-desc {
    color: #94a3b8;
    font-size: 13px;
    margin: 0 0 16px;
    line-height: 1.4;
  }

  .difficulty-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .diff-option {
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 10px 12px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
  }

  .diff-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .diff-selected {
    border-color: #f1c40f !important;
    background: rgba(241, 196, 15, 0.1) !important;
  }

  .diff-name {
    font-size: 15px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .diff-detail {
    font-size: 12px;
    color: #94a3b8;
  }

  .diff-recommended {
    position: absolute;
    top: -8px;
    right: 8px;
    background: #f1c40f;
    color: #1a1a2e;
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .diff-confirm-btn {
    background: #f1c40f;
    color: #1a1a2e;
    border: none;
    border-radius: 10px;
    padding: 12px 32px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    width: 100%;
  }

  .diff-confirm-btn:hover {
    background: #f39c12;
  }
</style>
