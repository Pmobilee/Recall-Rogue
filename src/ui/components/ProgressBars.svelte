<script lang="ts">
  import { playerSave, getDueReviews } from '../stores/playerData'
  import { BALANCE } from '../../data/balance'

  const save = $derived($playerSave)
  const dueCount = $derived(getDueReviews().length)

  // Streak progress toward next milestone
  const streakInfo = $derived.by(() => {
    const streak = save?.stats?.currentStreak ?? 0
    const milestones = BALANCE.STREAK_MILESTONES as readonly { days: number; name: string }[]
    const claimed = save?.claimedMilestones ?? []
    const next = milestones.find(m => m.days > streak && !claimed.includes(m.days))
    if (!next) return null
    const prev = [...milestones].reverse().find(m => m.days <= streak)
    const prevDays = prev?.days ?? 0
    const progress = Math.round(((streak - prevDays) / (next.days - prevDays)) * 100)
    return { streak, nextDays: next.days, nextName: next.name, progress: Math.min(100, progress) }
  })
</script>

<div class="progress-bars">
  {#if streakInfo}
    <div class="pbar-row">
      <span class="pbar-label">Streak: {streakInfo.streak}d / {streakInfo.nextDays}d</span>
      <div class="pbar-track">
        <div class="pbar-fill pbar-streak" style:width="{streakInfo.progress}%"></div>
      </div>
    </div>
  {/if}

  {#if dueCount > 0}
    <div class="pbar-row">
      <span class="pbar-label">{dueCount} fact{dueCount !== 1 ? 's' : ''} ready for review</span>
    </div>
  {/if}
</div>

<style>
  .progress-bars {
    padding: 4px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pbar-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pbar-label {
    font-family: 'Courier New', monospace;
    font-size: 0.65rem;
    color: var(--color-text-dim, #888);
    white-space: nowrap;
    min-width: 120px;
  }

  .pbar-track {
    flex: 1;
    height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .pbar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .pbar-streak {
    background: linear-gradient(90deg, #4ec9a0, #ffd700);
  }
</style>
