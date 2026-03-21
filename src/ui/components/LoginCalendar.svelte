<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { getLoginCalendarDay, isTodayClaimed, claimLoginReward, LOGIN_CALENDAR_REWARDS } from '../../data/loginRewards'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  const currentSave = $derived($playerSave)
  const calendarDay = $derived(currentSave ? getLoginCalendarDay(currentSave) : 1)
  const todayClaimed = $derived(currentSave ? isTodayClaimed(currentSave) : false)

  const rewards = LOGIN_CALENDAR_REWARDS as readonly { day: number; type: string; amount: number; icon: string; label: string; description: string }[]

  function handleClaim(): void {
    if (!currentSave || todayClaimed) return
    const reward = claimLoginReward(currentSave)
    // Apply reward based on type
    if (reward.type === 'streak_freeze') {
      currentSave.streakFreezes = Math.min(
        (currentSave.streakFreezes ?? 0) + reward.amount,
        BALANCE.STREAK_FREEZE_MAX
      )
    }
    // card/relic rewards: applied at run start via run manager
    // Save and update store
    playerSave.set({ ...currentSave })
    persistPlayer()
  }
</script>

<div class="calendar-overlay" role="dialog" aria-modal="true" aria-label="Login Calendar">
  <div
    class="calendar-backdrop"
    role="button"
    aria-label="Close login calendar"
    tabindex="0"
    onclick={onClose}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose() }}
  ></div>
  <div class="calendar-card">
    <h2 class="calendar-title">Daily Login</h2>
    <div class="days-grid">
      {#each rewards as reward}
        {@const isPast = reward.day < calendarDay || (reward.day === calendarDay && todayClaimed)}
        {@const isCurrent = reward.day === calendarDay && !todayClaimed}
        <div
          class="day-cell"
          class:past={isPast}
          class:current={isCurrent}
          class:future={reward.day > calendarDay}
        >
          <span class="day-num">Day {reward.day}</span>
          <span class="day-reward">{reward.label}</span>
          {#if isPast}
            <span class="day-check">[x]</span>
          {:else if isCurrent}
            <button class="claim-btn" onclick={handleClaim}>Claim</button>
          {/if}
        </div>
      {/each}
    </div>
    <button class="close-btn" onclick={onClose}>Close</button>
  </div>
</div>

<style>
  .calendar-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 160;
  }

  .calendar-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
  }

  .calendar-card {
    position: relative;
    background: var(--color-surface, #1e1e2e);
    border-radius: 16px;
    padding: 24px 20px;
    max-width: 340px;
    width: 92vw;
    font-family: 'Courier New', monospace;
    z-index: 1;
  }

  .calendar-title {
    text-align: center;
    color: var(--color-text, #fff);
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0 0 16px;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    text-align: center;
  }

  .day-cell.past {
    opacity: 0.5;
    background: rgba(78, 201, 160, 0.1);
  }

  .day-cell.current {
    border-color: #ffd700;
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
  }

  .day-cell.future {
    opacity: 0.6;
  }

  .day-num {
    font-size: 0.65rem;
    color: var(--color-text-dim, #888);
    font-weight: 700;
    text-transform: uppercase;
  }

  .day-reward {
    font-size: 0.7rem;
    color: var(--color-text, #fff);
    font-weight: 700;
  }

  .day-check {
    color: #4ec9a0;
    font-weight: 900;
    font-size: 0.8rem;
  }

  .claim-btn {
    background: #ffd700;
    color: #000;
    border: 0;
    border-radius: 6px;
    padding: 4px 12px;
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 900;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .claim-btn:active { transform: scale(0.95); }

  .close-btn {
    display: block;
    width: 100%;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    color: var(--color-text-dim, #888);
    border-radius: 8px;
    padding: 10px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
