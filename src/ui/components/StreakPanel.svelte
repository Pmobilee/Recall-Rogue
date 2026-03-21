<script lang="ts">

  import { playerSave, useStreakFreeze, purchaseStreakFreeze, setActiveTitle, claimUnclaimedMilestones } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const save = $derived($playerSave)
  const stats = $derived(save?.stats ?? {
    currentStreak: 0,
    bestStreak: 0,
    totalDivesCompleted: 0,
    bestFloor: 0,
    totalFactsLearned: 0,
    totalFactsSold: 0,
    totalQuizCorrect: 0,
    totalQuizWrong: 0,
  })

  const currentStreak = $derived(stats.currentStreak)
  const bestStreak = $derived(stats.bestStreak)
  const streakFreezes = $derived(save?.streakFreezes ?? 0)
  const streakProtected = $derived(save?.streakProtected ?? false)
  const claimedMilestones = $derived(save?.claimedMilestones ?? [])
  const titles = $derived(save?.titles ?? [])
  const activeTitle = $derived(save?.activeTitle ?? null)
  const dust = $derived(save?.minerals.dust ?? 0)

  const freezeCost = 200 // legacy mining cost
  const maxFreezes = 3 // STREAK_FREEZE_MAX was 3;

  /** Returns the fire emoji size class based on streak length. */
  function getFlameClass(streak: number): string {
    if (streak >= 30) return 'flame-blazing'
    if (streak >= 14) return 'flame-large'
    if (streak >= 7) return 'flame-medium'
    if (streak >= 3) return 'flame-small'
    return 'flame-tiny'
  }

  /** Returns flame text/size for the streak display. */
  function getFlameEmoji(streak: number): string {
    if (streak >= 30) return 'FIRE'
    if (streak >= 14) return 'FIRE'
    if (streak >= 7) return 'FIRE'
    if (streak >= 3) return 'FIRE'
    return 'FIRE'
  }

  /** Finds the next upcoming milestone. */
  const nextMilestone = $derived.by(() => {
    for (const m of ([] as readonly {days: number; reward: string; value: number; name: string; description: string; title?: string | undefined}[])) {
      if (!claimedMilestones.includes(m.days)) return m
    }
    return null
  })

  /** Progress toward the next milestone (0–100%). */
  const nextMilestoneProgress = $derived.by(() => {
    if (!nextMilestone) return 100
    const prev = (() => {
      const idx = ([] as readonly {days: number; reward: string; value: number; name: string; description: string; title?: string | undefined}[]).findIndex(m => m.days === nextMilestone.days)
      return 0 // milestones removed
    })()
    const range = nextMilestone.days - prev
    const progress = currentStreak - prev
    return Math.min(100, Math.max(0, Math.round((progress / range) * 100)))
  })

  function handleBack(): void {
    audioManager.playSound('button_click')
    onBack()
  }

  function handleUseFreeze(): void {
    audioManager.playSound('button_click')
    useStreakFreeze()
  }

  function handleBuyFreeze(): void {
    audioManager.playSound('button_click')
    purchaseStreakFreeze()
  }

  function handleTitleSelect(e: Event): void {
    const sel = (e.target as HTMLSelectElement).value
    setActiveTitle(sel === '' ? null : sel)
  }

  $effect(() => {
    claimUnclaimedMilestones()
  })
</script>

<section class="streak-panel" aria-label="Streak Panel">
  <!-- Header -->
  <div class="panel-header">
    <button class="back-btn" type="button" onclick={handleBack} aria-label="Back">
      &larr; Back
    </button>
    <h1 class="panel-title">Streak</h1>
  </div>

  <!-- Streak hero block -->
  <div class="card streak-hero">
    <div class="flame-wrapper">
      <span class={`flame-icon ${getFlameClass(currentStreak)}`} aria-hidden="true">
        {getFlameEmoji(currentStreak)}
      </span>
    </div>
    <div class="streak-number" aria-label="{currentStreak} day streak">
      {currentStreak}
    </div>
    <div class="streak-label">
      {currentStreak === 1 ? 'day' : 'days'}
    </div>
    {#if bestStreak > 0}
      <div class="best-streak-row">
        <span class="best-label">Best:</span>
        <span class="best-value">{bestStreak} days</span>
        {#if currentStreak >= bestStreak && currentStreak > 1}
          <span class="best-tag">RECORD!</span>
        {/if}
      </div>
    {/if}
    {#if streakProtected}
      <div class="protected-badge" aria-label="Streak protected">
        STREAK PROTECTED
      </div>
    {/if}
  </div>

  <!-- Progress to next milestone -->
  {#if nextMilestone}
    <div class="card progress-card">
      <div class="progress-header">
        <span class="progress-label">Next: {nextMilestone.name} ({nextMilestone.days} days)</span>
        <span class="progress-pct">{nextMilestoneProgress}%</span>
      </div>
      <div class="progress-bar-bg" role="progressbar" aria-valuenow={nextMilestoneProgress} aria-valuemin={0} aria-valuemax={100}>
        <div class="progress-bar-fill" style:width="{nextMilestoneProgress}%"></div>
      </div>
      <p class="progress-desc">{nextMilestone.description}</p>
      <p class="progress-days">
        {currentStreak} / {nextMilestone.days} days
        ({Math.max(0, nextMilestone.days - currentStreak)} to go)
      </p>
    </div>
  {:else}
    <div class="card progress-card">
      <p class="all-done">All milestones unlocked! You are a legend.</p>
    </div>
  {/if}

  <!-- Milestone list -->
  <div class="card milestones-card">
    <h2 class="section-title">Milestones</h2>
    <ul class="milestone-list" aria-label="Streak milestones">
      {#each ([] as readonly {days: number; reward: string; value: number; name: string; description: string; title?: string | undefined}[]) as milestone}
        {@const claimed = claimedMilestones.includes(milestone.days)}
        {@const isNext = !claimed && nextMilestone?.days === milestone.days}
        <li
          class="milestone-row"
          class:milestone-claimed={claimed}
          class:milestone-next={isNext}
          class:milestone-locked={!claimed && !isNext}
          aria-label="{milestone.name}: {claimed ? 'achieved' : isNext ? 'next' : 'locked'}"
        >
          <span class="milestone-icon" aria-hidden="true">
            {#if claimed}
              &#10003;
            {:else if isNext}
              &rarr;
            {:else}
              &#128274;
            {/if}
          </span>
          <div class="milestone-info">
            <span class="milestone-name">{milestone.name}</span>
            <span class="milestone-desc">{milestone.description}</span>
          </div>
          <span class="milestone-days">{milestone.days}d</span>
        </li>
      {/each}
    </ul>
  </div>

  <!-- Streak Freeze section -->
  <div class="card freeze-card">
    <h2 class="section-title">Streak Freezes</h2>
    <p class="freeze-desc">
      Freezes protect your streak if you miss a day. Use one before a day off to keep your streak alive.
    </p>

    <div class="freeze-status" aria-label="Freeze count: {streakFreezes} of {maxFreezes}">
      {#each { length: maxFreezes } as _, i}
        <span
          class="freeze-pip"
          class:freeze-pip-active={i < streakFreezes}
          aria-hidden="true"
        ></span>
      {/each}
      <span class="freeze-count-label">Freezes: {streakFreezes}/{maxFreezes}</span>
    </div>

    <div class="freeze-buttons">
      <button
        class="freeze-btn use-freeze-btn"
        type="button"
        disabled={streakFreezes <= 0 || streakProtected}
        onclick={handleUseFreeze}
        aria-label={streakProtected ? 'Streak already protected' : streakFreezes <= 0 ? 'No freezes available' : 'Use a streak freeze'}
      >
        {streakProtected ? 'Protected' : 'Use Freeze'}
      </button>
      <button
        class="freeze-btn buy-freeze-btn"
        type="button"
        disabled={streakFreezes >= maxFreezes || dust < freezeCost}
        onclick={handleBuyFreeze}
        aria-label="Buy freeze for {freezeCost} dust"
      >
        Buy Freeze ({freezeCost} dust)
      </button>
    </div>

    {#if streakProtected}
      <p class="freeze-note protected-note">
        Your streak is protected for the next missed day.
      </p>
    {:else if streakFreezes > 0}
      <p class="freeze-note">
        You have {streakFreezes} freeze{streakFreezes > 1 ? 's' : ''} ready to use.
      </p>
    {:else}
      <p class="freeze-note dim">No freezes available. Buy one for {freezeCost} dust.</p>
    {/if}
  </div>

  <!-- Title selector -->
  {#if titles.length > 0}
    <div class="card titles-card">
      <h2 class="section-title">Titles</h2>
      <p class="titles-desc">Titles are displayed below your pilot name.</p>
      <div class="title-select-row">
        <label class="title-select-label" for="title-select">Active Title</label>
        <select
          id="title-select"
          class="title-select"
          value={activeTitle ?? ''}
          onchange={handleTitleSelect}
          aria-label="Choose active title"
        >
          <option value="">— None —</option>
          {#each titles as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
</section>

<style>
  .streak-panel {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    overflow-y: auto;
    background: var(--color-bg);
    padding: 8px;
    font-family: 'Courier New', monospace;
    -webkit-overflow-scrolling: touch;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px;
    margin-bottom: 0;
  }

  .back-btn {
    border: 0;
    border-radius: 10px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 8px 14px;
    cursor: pointer;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .back-btn:active {
    opacity: 0.75;
    transform: translateY(1px);
  }

  .panel-title {
    color: var(--color-warning);
    font-size: clamp(1.5rem, 5vw, 2rem);
    margin: 0;
  }

  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  h2 {
    margin: 0;
  }

  .section-title {
    color: var(--color-text);
    font-size: 1rem;
    margin-bottom: 12px;
  }

  /* --- Streak Hero --- */
  .streak-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 24px 16px;
    border: 2px solid rgba(255, 165, 0, 0.35);
    background: color-mix(in srgb, #2a1800 65%, var(--color-surface) 35%);
  }

  .flame-wrapper {
    line-height: 1;
    margin-bottom: 4px;
  }

  .flame-icon {
    display: inline-block;
    font-family: inherit;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .flame-tiny  { font-size: 0.7rem; color: #ff8800; }
  .flame-small { font-size: 1rem;   color: #ff7700; }
  .flame-medium{ font-size: 1.3rem; color: #ff5500; text-shadow: 0 0 8px #ff5500; }
  .flame-large { font-size: 1.6rem; color: #ff3300; text-shadow: 0 0 12px #ff4400; }
  .flame-blazing { font-size: 2rem; color: #ff2200; text-shadow: 0 0 18px #ff0000, 0 0 30px #ff880088; }

  .streak-number {
    font-size: clamp(3rem, 12vw, 5rem);
    font-weight: 900;
    color: var(--color-warning);
    line-height: 1;
    text-shadow: 0 0 20px rgba(255, 165, 0, 0.5);
  }

  .streak-label {
    color: var(--color-text-dim);
    font-size: 0.9rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 2px;
  }

  .best-streak-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 0.85rem;
  }

  .best-label {
    color: var(--color-text-dim);
  }

  .best-value {
    color: var(--color-text);
    font-weight: 700;
  }

  .best-tag {
    background: var(--color-accent);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 1px;
    border-radius: 999px;
    padding: 2px 8px;
  }

  .protected-badge {
    margin-top: 10px;
    background: color-mix(in srgb, var(--color-success) 30%, var(--color-surface) 70%);
    border: 1px solid var(--color-success);
    border-radius: 999px;
    color: var(--color-success);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 4px 14px;
  }

  /* --- Progress card --- */
  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .progress-label {
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .progress-pct {
    color: var(--color-warning);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .progress-bar-bg {
    width: 100%;
    height: 10px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface) 40%);
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--color-warning), #ff8800);
    transition: width 0.4s ease;
  }

  .progress-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    margin: 0 0 4px;
  }

  .progress-days {
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: 600;
    margin: 0;
  }

  .all-done {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 700;
    margin: 0;
    text-align: center;
  }

  /* --- Milestone list --- */
  .milestone-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .milestone-row {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 10px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    transition: opacity 0.15s;
  }

  .milestone-claimed {
    background: color-mix(in srgb, var(--color-success) 15%, var(--color-surface) 85%);
    border: 1px solid rgba(78, 204, 163, 0.35);
  }

  .milestone-next {
    background: color-mix(in srgb, var(--color-warning) 15%, var(--color-surface) 85%);
    border: 1px solid rgba(255, 211, 105, 0.4);
  }

  .milestone-locked {
    opacity: 0.5;
  }

  .milestone-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .milestone-claimed .milestone-icon { color: var(--color-success); }
  .milestone-next .milestone-icon    { color: var(--color-warning); }
  .milestone-locked .milestone-icon  { color: var(--color-text-dim); }

  .milestone-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .milestone-name {
    color: var(--color-text);
    font-size: 0.88rem;
    font-weight: 700;
  }

  .milestone-claimed .milestone-name { color: var(--color-success); }
  .milestone-next .milestone-name    { color: var(--color-warning); }

  .milestone-desc {
    color: var(--color-text-dim);
    font-size: 0.76rem;
    line-height: 1.3;
  }

  .milestone-days {
    flex-shrink: 0;
    color: var(--color-text-dim);
    font-size: 0.8rem;
    font-weight: 700;
  }

  /* --- Freeze card --- */
  .freeze-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    margin: 0 0 12px;
    line-height: 1.4;
  }

  .freeze-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .freeze-pip {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-bg) 60%, var(--color-surface) 40%);
    border: 2px solid var(--color-text-dim);
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
  }

  .freeze-pip-active {
    background: #45b3ff;
    border-color: #45b3ff;
    box-shadow: 0 0 6px #45b3ff88;
  }

  .freeze-count-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
    font-weight: 600;
    margin-left: 4px;
  }

  .freeze-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .freeze-btn {
    flex: 1;
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    padding: 0 12px;
  }

  .freeze-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .freeze-btn:not(:disabled):active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .use-freeze-btn {
    background: #45b3ff;
    color: #001a30;
  }

  .buy-freeze-btn {
    background: color-mix(in srgb, var(--color-warning) 28%, var(--color-surface) 72%);
    color: var(--color-warning);
    border: 1px solid rgba(255, 211, 105, 0.4);
  }

  .freeze-note {
    margin: 10px 0 0;
    font-size: 0.78rem;
    color: var(--color-text-dim);
    font-style: italic;
  }

  .freeze-note.dim {
    opacity: 0.7;
  }

  .protected-note {
    color: var(--color-success);
    font-style: normal;
    font-weight: 700;
  }

  /* --- Titles --- */
  .titles-desc {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    margin: 0 0 12px;
  }

  .title-select-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .title-select-label {
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .title-select {
    flex: 1;
    min-width: 160px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid var(--color-text-dim);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.88rem;
    padding: 0 10px;
    cursor: pointer;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .freeze-buttons {
      flex-direction: column;
    }
  }
</style>
