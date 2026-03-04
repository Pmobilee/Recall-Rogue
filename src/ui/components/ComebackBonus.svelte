<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { daysSinceLastLogin } from '../../data/loginRewards'
  import { BALANCE } from '../../data/balance'

  interface Props {
    onDismiss: () => void
  }

  let { onDismiss }: Props = $props()

  const save = $derived($playerSave)
  const daysAway = $derived(save ? daysSinceLastLogin(save) : 0)
  const qualifies = $derived(daysAway >= BALANCE.COMEBACK_BONUS_THRESHOLD_DAYS)

  const gaiaMessage = $derived.by(() => {
    if (daysAway >= 30) return "You returned. That's what matters. Everything is here, waiting. Let's go."
    if (daysAway >= 14) return "It's been a while, miner. No judgment. The mine waits. Your tree still grows."
    if (daysAway >= 7)  return "A whole week! Your Knowledge Tree missed you. Here - extra oxygen to get back in the groove."
    return "You're back! I decoded some artifacts while you were away. Ready to dive?"
  })
</script>

{#if qualifies}
  <div class="comeback-overlay" data-testid="comeback-bonus" role="dialog" aria-modal="true">
    <div class="comeback-card">
      <h2 class="comeback-title">Welcome Back, Miner</h2>
      <p class="comeback-gaia">{gaiaMessage}</p>
      <div class="comeback-rewards">
        <div class="reward-item">
          <span class="reward-icon">[O2]</span>
          <span class="reward-text">+{BALANCE.COMEBACK_OXYGEN_BONUS} bonus oxygen tank</span>
        </div>
        <div class="reward-item">
          <span class="reward-icon">[*]</span>
          <span class="reward-text">Next artifact guaranteed uncommon+</span>
        </div>
      </div>
      <button class="comeback-btn" onclick={onDismiss}>Let's Go</button>
    </div>
  </div>
{/if}

<style>
  .comeback-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 170;
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .comeback-card {
    background: var(--color-surface, #1e1e2e);
    border: 2px solid #4a9eff;
    border-radius: 16px;
    padding: 28px 24px;
    max-width: 320px;
    width: 90vw;
    text-align: center;
    font-family: 'Courier New', monospace;
    animation: cardPop 0.4s ease-out;
  }

  @keyframes cardPop {
    from { transform: scale(0.9); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  .comeback-title {
    color: #4a9eff;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0 0 14px;
  }

  .comeback-gaia {
    color: rgba(255,255,255,0.85);
    font-size: 0.9rem;
    line-height: 1.5;
    font-style: italic;
    margin: 0 0 18px;
  }

  .comeback-rewards {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .reward-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(74, 158, 255, 0.1);
    border-radius: 8px;
  }

  .reward-icon {
    color: #4a9eff;
    font-weight: 900;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .reward-text {
    color: var(--color-text, #fff);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .comeback-btn {
    min-width: 140px;
    min-height: 44px;
    border: 0;
    border-radius: 12px;
    background: #4a9eff;
    color: #fff;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 900;
    cursor: pointer;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .comeback-btn:active { transform: scale(0.96); }
</style>
