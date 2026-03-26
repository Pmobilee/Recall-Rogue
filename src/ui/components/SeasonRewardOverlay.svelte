<script lang="ts">
  export let rewardName: string = ''
  export let rewardType: string = 'cosmetic'
  export let rewardDescription: string = ''
  export let onClose: (() => void) | undefined = undefined

  let revealed = false
  let animating = true

  function handleReveal(): void {
    if (!revealed) {
      revealed = true
      setTimeout(() => { animating = false }, 1500)
    }
  }

  function handleClose(): void {
    if (onClose) onClose()
  }

  const typeIcons: Record<string, string> = {
    cosmetic: '\u2728',      // sparkles
    companion_fragment: '\u{1F95A}',  // egg
    mineral_bonus: '\u{1F48E}',       // gem
    title: '\u{1F451}'                // crown
  }
</script>

<div
  class="reward-overlay"
  on:click={handleReveal}
  on:keydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') handleReveal() }}
  role="dialog"
  aria-label="Season Reward"
  tabindex="-1"
>
  <div class="reward-container" class:revealed>
    {#if !revealed}
      <div class="reward-chest">
        <div class="chest-glow"></div>
        <span class="chest-icon">&#x1F381;</span>
        <p class="tap-hint">Tap to reveal</p>
      </div>
    {:else}
      <div class="reward-reveal" class:animating>
        <span class="reward-icon">{typeIcons[rewardType] ?? '\u2728'}</span>
        <h2 class="reward-title">{rewardName}</h2>
        <p class="reward-desc">{rewardDescription}</p>
        <span class="reward-type-badge">{rewardType}</span>
        {#if !animating}
          <button class="close-btn" on:click|stopPropagation={handleClose}>Claim</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .reward-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
    cursor: pointer;
  }
  .reward-container {
    text-align: center;
    transition: transform 0.5s ease;
  }
  .reward-chest {
    position: relative;
  }
  .chest-glow {
    position: absolute;
    inset: -40px;
    background: radial-gradient(circle, rgba(233, 69, 96, 0.3) 0%, transparent 70%);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }
  .chest-icon {
    font-size: 80px;
    display: block;
    position: relative;
    animation: float 3s ease-in-out infinite;
  }
  .tap-hint {
    color: #a0a0a0;
    font-family: var(--font-rpg);
    font-size: 10px;
    margin-top: 20px;
    animation: blink 1.5s ease-in-out infinite;
  }
  .reward-reveal {
    transform: scale(0);
    animation: revealPop 0.5s ease-out 0.3s forwards;
  }
  .reward-reveal.animating {
    pointer-events: none;
  }
  .reward-icon {
    font-size: 60px;
    display: block;
    margin-bottom: 16px;
  }
  .reward-title {
    font-family: var(--font-rpg);
    font-size: 14px;
    color: #e94560;
    margin: 0 0 8px;
  }
  .reward-desc {
    color: #ccc;
    font-size: 13px;
    max-width: 280px;
    margin: 0 auto 12px;
  }
  .reward-type-badge {
    display: inline-block;
    background: #0f3460;
    color: #e94560;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 10px;
    font-family: var(--font-rpg);
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .close-btn {
    display: block;
    margin: 16px auto 0;
    background: #e94560;
    color: white;
    border: none;
    padding: 10px 32px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 12px;
    cursor: pointer;
  }
  .close-btn:hover {
    background: #c73e54;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes revealPop {
    0% { transform: scale(0) rotate(-10deg); }
    60% { transform: scale(1.1) rotate(2deg); }
    100% { transform: scale(1) rotate(0); }
  }
</style>
