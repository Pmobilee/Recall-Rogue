<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { calculateProduction } from '../../data/farm'

  interface Props {
    onDive: () => void
    onDismiss: () => void
  }

  const { onDive, onDismiss }: Props = $props()

  const save = $derived($playerSave)

  const currentStreak = $derived(save?.stats.currentStreak ?? 0)
  const streakProtected = $derived(save?.streakProtected ?? false)

  const overdueCount = $derived.by(() => {
    if (!save) return 0
    const now = Date.now()
    return save.reviewStates.filter(rs => rs.repetitions >= 1 && rs.nextReviewAt <= now).length
  })

  const dealsAvailableCount = $derived.by(() => {
    if (!save) return 0
    const todayStr = new Date().toISOString().split('T')[0]
    if (save.lastDealDate === todayStr) return Math.max(0, 3 - save.purchasedDeals.length)
    return 3 // Fresh day = all deals available
  })

  const farmUnlocked = $derived(save?.hubState.unlockedFloorIds.includes('farm') ?? false)

  const readyHarvestCount = $derived.by(() => {
    if (!save || !farmUnlocked) return 0
    return save.farm.slots.filter(slot => {
      if (!slot) return false
      const result = calculateProduction(slot)
      return result !== null && result.amount > 0
    }).length
  })

  const gaiaComments = [
    "Good morning, Explorer. The underground awaits.",
    "Another day, another layer to uncover.",
    "Your knowledge grows with every dive. Impressive.",
    "The facts won't learn themselves. Shall we begin?",
    "I've been analyzing your progress. You're doing well.",
    "Ready to add to your collection of facts? Let's go.",
  ]
  const gaiaComment = $derived(gaiaComments[currentStreak % gaiaComments.length])

  /**
   * Stamps today's date into hubState.lastBriefingDate and persists the save.
   */
  function markShown(): void {
    const today = new Date().toISOString().split('T')[0]
    playerSave.update(s => {
      if (!s) return s
      return {
        ...s,
        hubState: { ...s.hubState, lastBriefingDate: today },
      }
    })
    persistPlayer()
  }

  function handleBeginDive(): void {
    markShown()
    onDive()
  }

  function handleSkip(): void {
    markShown()
    onDismiss()
  }
</script>

<div class="briefing-overlay">
  <div class="briefing-content">
    <h1 class="briefing-title">DAILY BRIEFING</h1>

    <!-- Streak -->
    <div class="section">
      <span class="section-icon">🔥</span>
      <div class="section-text">
        <strong>Day {currentStreak} Streak</strong>
        {#if streakProtected}
          <span class="sub">Protected today ✓</span>
        {:else if currentStreak > 0}
          <span class="sub">Keep it alive — dive today!</span>
        {:else}
          <span class="sub">Start a new streak today</span>
        {/if}
      </div>
    </div>

    <!-- Reviews -->
    <div class="section">
      <span class="section-icon">📖</span>
      <div class="section-text">
        <strong>{overdueCount} facts overdue</strong>
        {#if overdueCount === 0}
          <span class="sub">All caught up! Great work.</span>
        {:else}
          <span class="sub">Review them to strengthen memory.</span>
        {/if}
      </div>
    </div>

    <!-- Deals -->
    <div class="section">
      <span class="section-icon">🏪</span>
      <div class="section-text">
        <strong>{dealsAvailableCount} daily deals</strong>
        <span class="sub">Check the Market for fresh items!</span>
      </div>
    </div>

    <!-- Farm (conditional) -->
    {#if farmUnlocked}
      <div class="section">
        <span class="section-icon">🌱</span>
        <div class="section-text">
          <strong>{readyHarvestCount} crops ready</strong>
          {#if readyHarvestCount > 0}
            <span class="sub">Collect before they wither!</span>
          {:else}
            <span class="sub">Nothing to harvest yet.</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- GAIA commentary -->
    <div class="gaia-quote">
      <em>"{gaiaComment}"</em>
      <span class="gaia-sig">— G.A.I.A.</span>
    </div>

    <!-- Buttons -->
    <button class="begin-dive-btn" onclick={handleBeginDive}>Begin Dive</button>
    <button class="skip-btn" onclick={handleSkip}>Skip Briefing</button>
  </div>
</div>

<style>
  .briefing-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Press Start 2P', monospace;
    padding: 16px;
  }
  .briefing-content {
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .briefing-title {
    color: #4ecca3;
    font-size: 14px;
    text-align: center;
    margin: 0;
    letter-spacing: 2px;
  }
  .section {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    padding: 12px;
    border-radius: 4px;
    border-left: 3px solid #4ecca3;
  }
  .section-icon { font-size: 18px; flex-shrink: 0; }
  .section-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .section-text strong { color: #e0c97f; font-size: 9px; }
  .section-text .sub { color: #888; font-size: 7px; line-height: 1.4; }
  .gaia-quote {
    text-align: center;
    padding: 16px 12px;
    border-top: 1px solid #333;
    border-bottom: 1px solid #333;
  }
  .gaia-quote em { color: #aaa; font-size: 8px; line-height: 1.5; font-style: italic; }
  .gaia-sig { display: block; color: #4ecca3; font-size: 7px; margin-top: 8px; }
  .begin-dive-btn {
    padding: 14px;
    background: #4ecca3;
    color: #0a0a1a;
    border: 2px solid #3bb88f;
    border-radius: 6px;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    min-height: 48px;
    letter-spacing: 1px;
  }
  .begin-dive-btn:active { transform: scale(0.97); }
  .skip-btn {
    padding: 8px;
    background: none;
    border: none;
    color: #555;
    font-family: inherit;
    font-size: 8px;
    cursor: pointer;
    text-align: center;
    text-decoration: underline;
  }
</style>
