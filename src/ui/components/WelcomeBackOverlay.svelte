<script lang="ts">
  import type { WelcomeBackData } from '../stores/welcomeBack'

  export let data: WelcomeBackData
  export let onDismiss: (() => void) | undefined = undefined

  let step = 0
  const totalSteps = data.rewards.length + 1  // message + each reward

  function nextStep(): void {
    step++
    if (step >= totalSteps) {
      if (onDismiss) onDismiss()
    }
  }

  const rewardIcons: Record<string, string> = {
    oxygen: '\u{1F4A8}',          // wind
    minerals: '\u{1F48E}',        // gem
    seasonal_chest: '\u{1F381}',  // gift box
  }
</script>

<div class="welcome-back-overlay" role="dialog" aria-label="Welcome Back">
  <div class="welcome-container">
    {#if step === 0}
      <div class="welcome-message">
        <span class="gaia-avatar">G</span>
        <h2 class="welcome-title">Welcome Back</h2>
        <p class="welcome-text">{data.message}</p>
        <p class="tree-growth">Your tree grew {data.treeGrowth} while you were away.</p>
        <p class="streak-text">{data.streakMessage}</p>
        <button class="continue-btn" on:click={nextStep}>See What Awaits</button>
      </div>
    {:else}
      {@const rewardIndex = step - 1}
      {#if rewardIndex < data.rewards.length}
        {@const reward = data.rewards[rewardIndex]}
        <div class="reward-card">
          <span class="reward-icon">{rewardIcons[reward.type] ?? '\u2728'}</span>
          <p class="reward-amount">+{reward.amount}</p>
          <p class="reward-desc">{reward.description}</p>
          <button class="continue-btn" on:click={nextStep}>
            {rewardIndex < data.rewards.length - 1 ? 'Next' : 'Start Exploring'}
          </button>
        </div>
      {/if}
    {/if}
    <div class="step-dots">
      {#each Array(totalSteps) as _, i}
        <span class="dot" class:active={i === step}></span>
      {/each}
    </div>
  </div>
</div>

<style>
  .welcome-back-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
  }
  .welcome-container {
    text-align: center;
    max-width: 340px;
    padding: 20px;
  }
  .gaia-avatar {
    display: inline-block;
    width: 60px;
    height: 60px;
    background: #e94560;
    border-radius: 50%;
    line-height: 60px;
    font-size: 28px;
    color: white;
    font-family: var(--font-rpg);
    margin-bottom: 16px;
  }
  .welcome-title {
    font-family: var(--font-rpg);
    font-size: 16px;
    color: #e94560;
    margin: 0 0 12px;
  }
  .welcome-text {
    color: #e0e0e0;
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 8px;
  }
  .tree-growth {
    color: #8FBC8F;
    font-size: 12px;
    font-style: italic;
    margin: 0 0 8px;
  }
  .streak-text {
    color: #a0a0a0;
    font-size: 11px;
    margin: 0 0 20px;
  }
  .reward-card {
    padding: 20px;
  }
  .reward-icon {
    font-size: 50px;
    display: block;
    margin-bottom: 12px;
  }
  .reward-amount {
    font-family: var(--font-rpg);
    font-size: 20px;
    color: #e94560;
    margin: 0 0 8px;
  }
  .reward-desc {
    color: #ccc;
    font-size: 13px;
    margin: 0 0 20px;
  }
  .continue-btn {
    background: #e94560;
    color: white;
    border: none;
    padding: 12px 28px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 11px;
    cursor: pointer;
    pointer-events: auto;
  }
  .continue-btn:hover {
    background: #c73e54;
  }
  .step-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 20px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #333;
    transition: background 0.3s;
  }
  .dot.active {
    background: #e94560;
  }
</style>
