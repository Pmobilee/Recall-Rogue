<script lang="ts">
  import { getWeeklyChallenges, msUntilNextMonday, type WeeklyChallenge } from '../../data/weeklyChallenges'
  import { playerSave } from '../stores/playerData'
  import type { ChallengeStatKey } from '../../game/systems/ChallengeTracker'

  const challenges = getWeeklyChallenges()
  const save = $derived($playerSave)

  const stats = $derived.by(() => {
    return (save?.weeklyChallenge?.stats ?? {}) as Record<ChallengeStatKey, number>
  })

  function getProgress(challenge: WeeklyChallenge): number {
    return stats[challenge.trackingKey] ?? 0
  }

  function getPercent(challenge: WeeklyChallenge): number {
    const current = getProgress(challenge)
    return Math.min(100, Math.round((current / challenge.targetValue) * 100))
  }

  function isComplete(challenge: WeeklyChallenge): boolean {
    return getProgress(challenge) >= challenge.targetValue
  }

  const allComplete = $derived(challenges.every(c => isComplete(c)))

  // Days until reset
  const daysUntilReset = $derived(Math.ceil(msUntilNextMonday() / (1000 * 60 * 60 * 24)))

  const pillarIcons: Record<string, string> = {
    mining: '[M]',
    learning: '[L]',
    collecting: '[C]',
  }
</script>

<div class="weekly-challenges" data-testid="weekly-challenge">
  <div class="wc-header">
    <h3 class="wc-title">Weekly Challenges</h3>
    <span class="wc-reset">Resets in {daysUntilReset}d</span>
  </div>

  {#each challenges as challenge}
    {@const progress = getProgress(challenge)}
    {@const percent = getPercent(challenge)}
    {@const done = isComplete(challenge)}
    <div class="challenge-row" class:complete={done}>
      <span class="pillar-icon">{pillarIcons[challenge.pillar] ?? '[?]'}</span>
      <div class="challenge-info">
        <span class="challenge-title">{challenge.title}</span>
        <span class="challenge-desc">{challenge.description}</span>
        <div class="challenge-bar-track">
          <div class="challenge-bar-fill" class:done style:width="{percent}%"></div>
        </div>
        <span class="challenge-progress">{progress}/{challenge.targetValue}</span>
      </div>
    </div>
  {/each}

  {#if allComplete}
    <div class="chest-section">
      <p class="chest-label">All challenges complete!</p>
      <button class="chest-btn">Claim Expedition Chest</button>
    </div>
  {/if}
</div>

<style>
  .weekly-challenges {
    background: var(--color-surface, #1e1e2e);
    border-radius: 12px;
    padding: 14px 16px;
    font-family: 'Courier New', monospace;
  }

  .wc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .wc-title {
    color: var(--color-text, #fff);
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 0;
  }

  .wc-reset {
    font-size: 0.65rem;
    color: var(--color-text-dim, #888);
  }

  .challenge-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .challenge-row:last-of-type {
    border-bottom: none;
  }

  .challenge-row.complete {
    opacity: 0.6;
  }

  .pillar-icon {
    color: var(--color-accent, #4a9eff);
    font-weight: 900;
    font-size: 0.8rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .challenge-info {
    flex: 1;
    min-width: 0;
  }

  .challenge-title {
    display: block;
    color: var(--color-text, #fff);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .challenge-desc {
    display: block;
    color: var(--color-text-dim, #888);
    font-size: 0.7rem;
    margin: 2px 0 6px;
  }

  .challenge-bar-track {
    height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 2px;
  }

  .challenge-bar-fill {
    height: 100%;
    background: var(--color-accent, #4a9eff);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .challenge-bar-fill.done {
    background: #4ec9a0;
  }

  .challenge-progress {
    font-size: 0.6rem;
    color: var(--color-text-dim, #888);
  }

  .chest-section {
    text-align: center;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 215, 0, 0.3);
    margin-top: 8px;
  }

  .chest-label {
    color: #ffd700;
    font-size: 0.8rem;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .chest-btn {
    background: #ffd700;
    color: #000;
    border: 0;
    border-radius: 8px;
    padding: 10px 20px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 900;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .chest-btn:active { transform: scale(0.96); }
</style>
