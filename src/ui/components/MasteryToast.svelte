<script lang="ts">
  import type { CelebrationEvent } from '../../game/managers/CelebrationManager'

  interface Props {
    event: CelebrationEvent
    onComplete: () => void
  }

  let { event, onComplete }: Props = $props()

  let dismissed = $state(false)

  // Auto-dismiss for small tiers
  $effect(() => {
    if (event.tier === 'glow' || event.tier === 'mini') {
      const durationMs = event.tier === 'glow' ? 1200 : 2000
      const t = setTimeout(() => {
        dismissed = true
        onComplete()
      }, durationMs)
      return () => clearTimeout(t)
    }
    if (event.tier === 'banner') {
      const t = setTimeout(() => {
        dismissed = true
        onComplete()
      }, 3000)
      return () => clearTimeout(t)
    }
    return undefined
  })

  function handleDismiss(): void {
    dismissed = true
    onComplete()
  }
</script>

{#if !dismissed}
  {#if event.tier === 'glow'}
    <!-- Small green flash at bottom -->
    <div class="mastery-glow" role="status" aria-live="polite">
      <span class="glow-text">+{event.dustBonus} dust</span>
    </div>

  {:else if event.tier === 'mini'}
    <!-- Full-width banner at top -->
    <div class="mastery-mini" role="status" aria-live="polite">
      <span class="mini-label">Fact Mastered</span>
      <span class="mini-dust">+{event.dustBonus} dust</span>
    </div>

  {:else if event.tier === 'banner'}
    <!-- Animated banner from top -->
    <div class="mastery-banner" role="status" aria-live="polite">
      <div class="banner-title">Milestone Reached</div>
      <div class="banner-count">{event.masteryCount} facts mastered</div>
      <div class="banner-dust">+{event.dustBonus} dust</div>
    </div>

  {:else if event.tier === 'medium'}
    <!-- Modal card -->
    <div class="mastery-modal-overlay">
      <div class="mastery-card mastery-medium" role="dialog" aria-modal="true">
        <h2 class="card-title">Mastery Milestone</h2>
        <p class="card-count">{event.masteryCount} facts mastered</p>
        <p class="card-dust">+{event.dustBonus} dust</p>
        {#if event.title}
          <p class="card-unlock">Title unlocked: "{event.title}"</p>
        {/if}
        <button class="dismiss-btn" onclick={handleDismiss}>Continue</button>
      </div>
    </div>

  {:else if event.tier === 'major'}
    <!-- Major modal with glow -->
    <div class="mastery-modal-overlay">
      <div class="mastery-card mastery-major" role="dialog" aria-modal="true">
        <h2 class="card-title">Major Milestone</h2>
        <p class="card-count">{event.masteryCount} facts mastered</p>
        <p class="card-dust">+{event.dustBonus} dust</p>
        {#if event.title}
          <p class="card-unlock">Title unlocked: "{event.title}"</p>
        {/if}
        <button class="dismiss-btn" onclick={handleDismiss}>Amazing</button>
      </div>
    </div>

  {:else if event.tier === 'fullscreen'}
    <!-- Full-screen takeover -->
    <div class="mastery-fullscreen" role="dialog" aria-modal="true">
      <div class="fullscreen-content">
        {#if event.masteryCount === 1}
          <h1 class="fs-title">First Mastery</h1>
          <p class="fs-fact">"{event.factStatement}"</p>
          <p class="fs-subtitle">This knowledge is permanently yours.</p>
        {:else if event.masteryCount === -1}
          <h1 class="fs-title">Category Complete</h1>
          <p class="fs-category">{event.category}</p>
          <p class="fs-subtitle">Every fact mastered. A complete branch of knowledge.</p>
        {:else}
          <h1 class="fs-title">{event.masteryCount} Facts Mastered</h1>
          {#if event.title}
            <p class="fs-unlock">Title unlocked: "{event.title}"</p>
          {/if}
        {/if}
        <p class="fs-dust">+{event.dustBonus} dust</p>
        <button class="dismiss-btn fs-dismiss" onclick={handleDismiss}>Continue</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* === GLOW (tier 1) === */
  .mastery-glow {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(78, 201, 160, 0.15);
    border: 1px solid rgba(78, 201, 160, 0.4);
    color: #4ec9a0;
    padding: 6px 16px;
    border-radius: 999px;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    font-weight: 700;
    z-index: 180;
    animation: glowPop 0.3s ease-out, glowFade 0.3s 0.9s ease-in forwards;
    pointer-events: none;
  }
  .glow-text { white-space: nowrap; }

  @keyframes glowPop {
    from { transform: translateX(-50%) scale(0.8); opacity: 0; }
    to   { transform: translateX(-50%) scale(1);   opacity: 1; }
  }
  @keyframes glowFade {
    to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  /* === MINI (tier 2) === */
  .mastery-mini {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, rgba(78, 201, 160, 0.2), rgba(74, 158, 255, 0.2));
    border-bottom: 1px solid rgba(78, 201, 160, 0.3);
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Courier New', monospace;
    z-index: 180;
    animation: slideDown 0.3s ease-out;
  }
  .mini-label { color: #4ec9a0; font-weight: 700; font-size: 0.85rem; }
  .mini-dust  { color: #ffd700; font-weight: 700; font-size: 0.85rem; }

  @keyframes slideDown {
    from { transform: translateY(-100%); }
    to   { transform: translateY(0); }
  }

  /* === BANNER (tier 3) === */
  .mastery-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #1a2e1a, #1a1a3e);
    border-bottom: 2px solid #4ec9a0;
    padding: 16px;
    text-align: center;
    font-family: 'Courier New', monospace;
    z-index: 180;
    animation: slideDown 0.4s ease-out;
  }
  .banner-title { color: #4ec9a0; font-weight: 900; font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase; }
  .banner-count { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 4px 0; }
  .banner-dust  { color: #ffd700; font-size: 0.85rem; font-weight: 700; }

  /* === MODAL OVERLAY === */
  .mastery-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 190;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* === MODAL CARD === */
  .mastery-card {
    background: var(--color-surface, #1e1e2e);
    border-radius: 16px;
    padding: 32px 24px;
    text-align: center;
    font-family: 'Courier New', monospace;
    max-width: 320px;
    width: 90vw;
    animation: cardPop 0.4s ease-out;
  }
  .mastery-medium { border: 1px solid rgba(78, 201, 160, 0.4); }
  .mastery-major  { border: 2px solid #ffd700; box-shadow: 0 0 40px rgba(255, 215, 0, 0.2); }

  @keyframes cardPop {
    from { transform: scale(0.9); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  .card-title  { color: #4ec9a0; font-size: 1.1rem; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 12px; }
  .card-count  { color: #fff; font-size: 1.3rem; font-weight: 700; margin: 0 0 8px; }
  .card-dust   { color: #ffd700; font-size: 1rem; font-weight: 700; margin: 0 0 8px; }
  .card-unlock { color: #cc44ff; font-size: 0.9rem; font-weight: 700; margin: 0 0 16px; }

  .dismiss-btn {
    min-width: 140px;
    min-height: 44px;
    border: 0;
    border-radius: 12px;
    background: var(--color-accent, #4a9eff);
    color: #fff;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 8px;
  }
  .dismiss-btn:active { transform: scale(0.96); }

  /* === FULLSCREEN === */
  .mastery-fullscreen {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at center, #1a2e1a 0%, #0a0a1e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 0.5s ease-out;
  }
  .fullscreen-content {
    text-align: center;
    padding: 32px;
    max-width: 360px;
  }
  .fs-title    { color: #ffd700; font-size: clamp(1.5rem, 6vw, 2.5rem); font-weight: 900; letter-spacing: 3px; margin: 0 0 16px; text-shadow: 0 0 20px rgba(255, 215, 0, 0.4); }
  .fs-fact     { color: #fff; font-size: 1.1rem; font-style: italic; line-height: 1.5; margin: 0 0 12px; }
  .fs-category { color: #4ec9a0; font-size: 1.3rem; font-weight: 700; margin: 0 0 12px; }
  .fs-subtitle { color: rgba(255,255,255,0.7); font-size: 0.95rem; margin: 0 0 16px; }
  .fs-unlock   { color: #cc44ff; font-size: 1rem; font-weight: 700; margin: 0 0 12px; }
  .fs-dust     { color: #ffd700; font-size: 1.1rem; font-weight: 700; margin: 0 0 24px; }
  .fs-dismiss  { background: #ffd700; color: #000; font-size: 1.1rem; }
</style>
