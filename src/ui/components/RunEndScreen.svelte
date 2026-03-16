<script lang="ts">
  import { onMount } from 'svelte'
  import { shareRunSummaryCard } from '../../services/runShareService'
  import { analyticsService } from '../../services/analyticsService'
  import { getRandomScreenBg } from '../../data/backgroundManifest'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'

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
    isPracticeRun?: boolean
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
    isPracticeRun = false,
    onplayagain,
    onhome,
  }: Props = $props()

  const bgUrl = getRandomScreenBg(result === 'victory' || result === 'retreat' ? 'victory' : 'defeat')
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let isVictory = $derived(result === 'victory' || result === 'retreat')
  let headerText = $derived(result === 'retreat' ? 'SAFE RETREAT' : isVictory ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED')
  let headerColor = $derived(isVictory ? '#F1C40F' : '#E74C3C')
  let shareStatus = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')
  let showStats = $state(false)
  let showButtons = $state(false)

  onMount(() => {
    // Stagger stat reveal
    setTimeout(() => { showStats = true }, 200)
    // Delay buttons by 300ms after stats are fully visible
    setTimeout(() => { showButtons = true }, 1200)
  })

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
        isPracticeRun,
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

<div class="run-end-overlay" class:victory-result={isVictory} class:defeat-result={!isVictory}>
  <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
  <h1 class="header" style="color: {headerColor}">{headerText}</h1>

  <div class="stats-list" class:stats-revealed={showStats}>
    <div class="stat-row" style="--stagger: 0">
      <span class="stat-label">Floor Reached</span>
      <span class="stat-value">{floorReached}</span>
    </div>
    <div class="stat-row" style="--stagger: 1">
      <span class="stat-label">Facts Answered</span>
      <span class="stat-value">{factsAnswered}</span>
    </div>
    <div class="stat-row" style="--stagger: 2">
      <span class="stat-label">Accuracy</span>
      <span class="stat-value">{accuracy}%</span>
    </div>
    <div class="stat-row" style="--stagger: 3">
      <span class="stat-label">Correct Answers</span>
      <span class="stat-value">{correctAnswers}</span>
    </div>
    <div class="stat-row" style="--stagger: 4">
      <span class="stat-label">Best Combo</span>
      <span class="stat-value">{bestCombo}x</span>
    </div>
    <div class="stat-row" style="--stagger: 5">
      <span class="stat-label">Cards Earned</span>
      <span class="stat-value">{cardsEarned}</span>
    </div>
    {#if !isPracticeRun}
    <div class="stat-row" style="--stagger: 6">
      <span class="stat-label">Reward Multiplier</span>
      <span class="stat-value">{Math.round(rewardMultiplier * 100)}%</span>
    </div>
    <div class="stat-row" style="--stagger: 7">
      <span class="stat-label">Currency Earned</span>
      <span class="stat-value">{currencyEarned}</span>
    </div>
    {/if}
    <div class="stat-row" style="--stagger: 8">
      <span class="stat-label">New Facts Learned</span>
      <span class="stat-value">{newFactsLearned}</span>
    </div>
    <div class="stat-row" style="--stagger: 9">
      <span class="stat-label">Facts Mastered</span>
      <span class="stat-value">{factsMastered}</span>
    </div>
    <div class="stat-row" style="--stagger: 10">
      <span class="stat-label">Encounters</span>
      <span class="stat-value">{encountersWon}/{encountersTotal}</span>
    </div>
    <div class="stat-row" style="--stagger: 11">
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

  {#if isPracticeRun}
    <div class="practice-run-notice">
      <p class="practice-title">Practice Run</p>
      <p class="practice-desc">You already know this material well — camp rewards disabled.</p>
      <p class="practice-tip">Try a less familiar domain to earn rewards!</p>
    </div>
  {/if}

  <div class="btn-row" class:btns-visible={showButtons}>
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
</div>

<style>
  .run-end-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(24px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    z-index: 200;
    position: relative;
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

  .run-end-overlay > :not(.overlay-bg) {
    position: relative;
    z-index: 1;
  }

  .header {
    font-size: calc(24px * var(--layout-scale, 1));
    font-weight: 800;
    margin-bottom: calc(32px * var(--layout-scale, 1));
    text-align: center;
    letter-spacing: 2px;
  }

  .stats-list {
    width: 100%;
    max-width: calc(300px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    margin-bottom: calc(40px * var(--layout-scale, 1));
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: #161B22;
    border-radius: 8px;
  }

  .stat-label {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #8B949E;
  }

  .stat-value {
    font-size: calc(16px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-weight: 700;
  }

  .btn-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    min-width: calc(120px * var(--layout-scale, 1));
    height: 48px;
    border: none;
    border-radius: 10px;
    font-size: calc(16px * var(--layout-scale, 1));
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

  .practice-run-notice {
    text-align: center;
    padding: calc(16px * var(--layout-scale, 1));
    background: rgba(100, 116, 139, 0.15);
    border: 1px solid rgba(100, 116, 139, 0.3);
    border-radius: 10px;
    margin-bottom: calc(16px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(300px * var(--layout-scale, 1));
  }

  .practice-title {
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 700;
    color: #94a3b8;
    margin: 0 0 calc(8px * var(--layout-scale, 1));
  }

  .practice-desc {
    font-size: calc(13px * var(--layout-scale, 1));
    color: #cbd5e1;
    margin: 0 0 calc(4px * var(--layout-scale, 1));
  }

  .practice-tip {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  .bounty-list {
    background: rgba(241, 196, 15, 0.08);
    border: 1px solid rgba(241, 196, 15, 0.4);
    border-radius: 8px;
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    display: grid;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .bounty-list strong {
    color: #f4d35e;
    font-size: calc(12px * var(--layout-scale, 1));
  }

  .bounty-item {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #e7f0ff;
  }

  /* Stat row stagger animation */
  .stat-row {
    opacity: 0;
    transform: translateX(-20px);
    transition: opacity 400ms ease, transform 400ms ease;
    transition-delay: calc(var(--stagger, 0) * 80ms);
  }

  .stats-revealed .stat-row {
    opacity: 1;
    transform: translateX(0);
  }

  /* Stat value count-up effect via CSS */
  .stats-revealed .stat-value {
    animation: statPop 300ms ease-out;
    animation-delay: calc(var(--stagger, 0) * 80ms + 200ms);
    animation-fill-mode: both;
  }

  @keyframes statPop {
    0% { transform: scale(0.7); opacity: 0; }
    70% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Button entrance */
  .btn-row {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 400ms ease, transform 400ms ease;
  }

  .btn-row.btns-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Victory: gold particle pseudo-elements */
  .run-end-overlay.victory-result::before,
  .run-end-overlay.victory-result::after {
    content: '';
    position: absolute;
    top: -20px;
    width: 6px;
    height: 6px;
    background: #ffd700;
    border-radius: 50%;
    z-index: 2;
    animation: goldRain 2s linear infinite;
    pointer-events: none;
  }

  .run-end-overlay.victory-result::before {
    left: 25%;
    animation-delay: 0s;
  }

  .run-end-overlay.victory-result::after {
    left: 75%;
    animation-delay: 0.7s;
  }

  @keyframes goldRain {
    0% { transform: translateY(-20px); opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0; }
  }

  /* Defeat: desaturation + red vignette */
  .run-end-overlay.defeat-result {
    animation: defeatFade 500ms ease-out forwards;
  }

  @keyframes defeatFade {
    0% { filter: none; }
    100% { filter: grayscale(0.5) brightness(0.85); }
  }

  .run-end-overlay.defeat-result .header {
    animation: defeatPulse 2s ease-in-out infinite;
  }

  @keyframes defeatPulse {
    0%, 100% { text-shadow: 0 0 10px rgba(231, 76, 60, 0.3); }
    50% { text-shadow: 0 0 20px rgba(231, 76, 60, 0.6); }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .stat-row {
      opacity: 1;
      transform: none;
      transition: none;
    }
    .stats-revealed .stat-value {
      animation: none;
      opacity: 1;
    }
    .btn-row {
      opacity: 1;
      transform: none;
      transition: none;
    }
    .run-end-overlay.victory-result::before,
    .run-end-overlay.victory-result::after {
      animation: none;
      display: none;
    }
    .run-end-overlay.defeat-result {
      animation: none;
    }
    .run-end-overlay.defeat-result .header {
      animation: none;
    }
  }
</style>
