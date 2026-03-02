<script lang="ts">
  import { playerSave, persistPlayer } from '../../stores/playerData'
  import { pendingArtifacts } from '../../stores/gameState'
  import { audioManager } from '../../../services/audioService'
  import { BALANCE } from '../../../data/balance'
  import CompanionBadge from '../CompanionBadge.svelte'

  interface Props {
    onDive: () => void
    onReviewArtifact: () => void
    onStreakPanel?: () => void
    onSettings?: () => void
    gaiaVisible: boolean
    idleSpriteUrl: string
    idleExpressionId: string
    gaiaComment: string
    gaiaNameLabel: string
    gaiaFullName: string
    gaiaTagline: string
  }

  let {
    onDive,
    onReviewArtifact,
    onStreakPanel,
    onSettings,
    gaiaVisible,
    idleSpriteUrl,
    idleExpressionId,
    gaiaComment,
    gaiaNameLabel,
    gaiaFullName,
    gaiaTagline,
  }: Props = $props()

  const stats = $derived(
    $playerSave?.stats ?? {
      totalBlocksMined: 0,
      totalDivesCompleted: 0,
      deepestLayerReached: 0,
      totalFactsLearned: 0,
      totalFactsSold: 0,
      totalQuizCorrect: 0,
      totalQuizWrong: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
  )

  const oxygen = $derived($playerSave?.oxygen ?? 0)
  const dust = $derived($playerSave?.minerals.dust ?? 0)
  const shard = $derived($playerSave?.minerals.shard ?? 0)
  const crystal = $derived($playerSave?.minerals.crystal ?? 0)
  const geode = $derived($playerSave?.minerals.geode ?? 0)
  const essence = $derived($playerSave?.minerals.essence ?? 0)

  const insuredDive = $derived($playerSave?.insuredDive ?? false)
  const insuranceCost = $derived(Math.floor(dust * BALANCE.INSURANCE_COST_PERCENT))
  const canAffordInsurance = $derived(dust >= insuranceCost && insuranceCost > 0)

  const activeTitle = $derived($playerSave?.activeTitle ?? null)

  const lastDiveDate = $derived($playerSave?.lastDiveDate)
  const claimedMilestones = $derived($playerSave?.claimedMilestones ?? [])

  const streakAtRisk = $derived.by(() => {
    const streak = stats.currentStreak
    if (streak <= 3) return false
    const today = new Date().toISOString().split('T')[0]
    if (lastDiveDate === today) return false
    if (!lastDiveDate) return false
    const last = new Date(lastDiveDate)
    const now = new Date(today)
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 1
  })

  const hasNewMilestone = $derived.by(() => {
    const streak = stats.currentStreak
    for (const m of BALANCE.STREAK_MILESTONES) {
      if (streak >= m.days && !claimedMilestones.includes(m.days)) return true
    }
    return false
  })

  const artifactCount = $derived($pendingArtifacts.length)
  const hasArtifacts = $derived(artifactCount > 0)

  const fossilsRecord = $derived($playerSave?.fossils ?? {})
  const revivedFossilCount = $derived(Object.values(fossilsRecord).filter(f => f.revived).length)

  function handleToggleInsurance(): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const newValue = !save.insuredDive
    playerSave.update(s => s ? { ...s, insuredDive: newValue } : s)
    persistPlayer()
  }

  function handleDive(): void {
    audioManager.playSound('button_click')
    onDive()
  }

  function handleReviewArtifact(): void {
    audioManager.playSound('button_click')
    onReviewArtifact()
  }

  function handleStreakPanel(): void {
    audioManager.playSound('button_click')
    onStreakPanel?.()
  }
</script>

<!-- ========== COMMAND CENTER ========== -->
<div class="card title-card">
  <div class="title-header-row">
    <h1>Terra Base</h1>
    {#if onSettings}
      <button
        class="gear-btn"
        type="button"
        onclick={onSettings}
        aria-label="Open settings"
        title="Settings"
      >&#9881;</button>
    {/if}
  </div>
  <p class="subtitle">
    Pilot {$playerSave?.playerId ?? 'Unknown'} | Dives: {stats.totalDivesCompleted} | Facts:
    {$playerSave?.learnedFacts.length ?? 0}
  </p>
  {#if activeTitle}
    <p class="active-title-display" aria-label="Active title: {activeTitle}">{activeTitle}</p>
  {/if}
  {#if stats.currentStreak > 0}
    <button
      class="streak-display streak-clickable"
      type="button"
      onclick={handleStreakPanel}
      aria-label="View streak details — {stats.currentStreak} day streak"
    >
      <span class="streak-flame">FIRE</span>
      <span class="streak-count">{stats.currentStreak} day streak</span>
      {#if stats.currentStreak >= stats.bestStreak && stats.currentStreak > 1}
        <span class="streak-best">BEST!</span>
      {/if}
      {#if hasNewMilestone}
        <span class="milestone-badge" aria-label="New milestone available">Milestone!</span>
      {/if}
    </button>
  {/if}
  {#if streakAtRisk}
    <p class="streak-at-risk" aria-live="polite">Streak at risk! Dive today to keep it!</p>
  {/if}
</div>

<div class="gaia-card" class:gaia-visible={gaiaVisible} aria-label="GAIA comment" aria-live="polite">
  <div class="gaia-avatar-col">
    <img class="gaia-avatar-img" src={idleSpriteUrl} alt={`G.A.I.A. ${idleExpressionId}`} width="40" height="40" />
    <span class="gaia-name">{gaiaNameLabel}</span>
  </div>
  <div class="gaia-body">
    <span class="gaia-text">{gaiaComment}</span>
    <details class="gaia-about">
      <summary class="gaia-about-toggle">About</summary>
      <div class="gaia-about-content">
        <strong>{gaiaFullName}</strong>
        <span class="gaia-tagline">{gaiaTagline}</span>
      </div>
    </details>
  </div>
</div>

{#if revivedFossilCount > 0}
  <div class="card companion-card">
    <CompanionBadge />
  </div>
{/if}

<div class="card resources-card" aria-label="Resources">
  <div class="resource-item">
    <span class="resource-dot oxygen-dot" aria-hidden="true"></span>
    <span class="resource-label">Oxygen Tanks</span>
    <span class="resource-value">{oxygen}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot dust-dot" aria-hidden="true"></span>
    <span class="resource-label">Dust</span>
    <span class="resource-value">{dust}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot shard-dot" aria-hidden="true"></span>
    <span class="resource-label">Shard</span>
    <span class="resource-value">{shard}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot crystal-dot" aria-hidden="true"></span>
    <span class="resource-label">Crystal</span>
    <span class="resource-value">{crystal}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot geode-dot" aria-hidden="true"></span>
    <span class="resource-label">Geode</span>
    <span class="resource-value">{geode}</span>
  </div>
  <div class="resource-item">
    <span class="resource-dot essence-dot" aria-hidden="true"></span>
    <span class="resource-label">Essence</span>
    <span class="resource-value">{essence}</span>
  </div>
</div>

<div class="card dive-card" aria-label="Dive actions">
  <button class="action-button dive-button" type="button" onclick={handleDive}>
    <span>Dive</span>
    <span class="dive-arrow" aria-hidden="true">&#8595;</span>
  </button>

  <!-- Dive insurance toggle -->
  <div class="insurance-row" aria-label="Dive insurance options">
    <button
      class="insurance-toggle"
      class:insurance-active={insuredDive}
      class:insurance-disabled={!canAffordInsurance && !insuredDive}
      type="button"
      onclick={handleToggleInsurance}
      disabled={!canAffordInsurance && !insuredDive}
      aria-pressed={insuredDive}
      title={insuredDive
        ? 'Click to cancel dive insurance'
        : canAffordInsurance
          ? 'Click to insure this dive — costs ' + insuranceCost + ' dust, prevents item loss if O2 runs out'
          : 'Not enough dust to insure (need ' + insuranceCost + ')'}
    >
      <span class="insurance-icon">{insuredDive ? '[INSURED]' : '[Insure Dive]'}</span>
      <span class="insurance-cost">
        {#if insuranceCost > 0}
          {insuranceCost} dust
        {:else}
          No dust
        {/if}
      </span>
    </button>
    {#if insuredDive}
      <span class="insurance-note">Insured: no item loss if O2 depletes</span>
    {:else}
      <span class="insurance-note dim">Uninsured: lose 30% of items on O2 depletion</span>
    {/if}
  </div>

  {#if hasArtifacts}
    <button class="action-button artifact-button" type="button" onclick={handleReviewArtifact}>
      <span>Artifacts to Review</span>
      <span class="count-badge">{artifactCount}</span>
    </button>
  {/if}
</div>

<div class="card stats-card" aria-label="Player statistics">
  <h2>Stats</h2>
  <div class="stats-grid">
    <span>Total dives: {stats.totalDivesCompleted}</span>
    <span>Blocks mined: {stats.totalBlocksMined}</span>
    <span>Facts learned: {stats.totalFactsLearned}</span>
    <span>Deepest layer: {stats.deepestLayerReached}</span>
    <span>Current streak: {stats.currentStreak}</span>
    <span>Best streak: {stats.bestStreak}</span>
  </div>
</div>

<style>
  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  .companion-card {
    padding: 0;
    overflow: hidden;
  }

  h1,
  h2 {
    margin: 0;
  }

  h1 {
    color: var(--color-warning);
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    line-height: 1.1;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin-bottom: 10px;
  }

  .title-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .gear-btn {
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.25rem;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
    margin-top: 4px;
  }

  .gear-btn:hover,
  .gear-btn:focus-visible {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
  }

  .gear-btn:active {
    transform: scale(0.93);
  }

  .subtitle {
    margin-top: 8px;
    color: var(--color-text-dim);
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .active-title-display {
    margin: 4px 0 0;
    color: #a78bfa;
    font-size: 0.82rem;
    font-weight: 700;
    font-style: italic;
    letter-spacing: 0.5px;
  }

  .streak-display {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .streak-clickable {
    background: none;
    border: 0;
    padding: 4px 6px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    flex-wrap: wrap;
  }

  .streak-clickable:hover {
    background: color-mix(in srgb, var(--color-warning) 10%, transparent 90%);
  }

  .streak-clickable:active {
    transform: scale(0.97);
  }

  .streak-flame {
    color: var(--color-warning);
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .streak-count {
    color: var(--color-warning);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .streak-best {
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .milestone-badge {
    background: var(--color-warning);
    color: #1a0e00;
    font-size: 0.68rem;
    font-weight: 900;
    border-radius: 999px;
    padding: 2px 8px;
    letter-spacing: 0.5px;
    animation: milestone-pulse 1.5s ease-in-out infinite;
  }

  @keyframes milestone-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .streak-at-risk {
    margin: 4px 0 0;
    color: #f97316;
    font-size: 0.78rem;
    font-weight: 700;
    font-style: italic;
  }

  .resources-card {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .resource-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .oxygen-dot { background: #45b3ff; }
  .dust-dot { background: #4ecca3; }
  .shard-dot { background: #ffd369; }
  .crystal-dot { background: #e94560; }
  .geode-dot { background: #9b59b6; }
  .essence-dot {
    background: linear-gradient(135deg, #ffd700 0%, #fffde7 50%, #ffd700 100%);
    box-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
  }

  .resource-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .resource-value {
    margin-left: auto;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .dive-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .dive-button {
    min-height: 64px;
    font-size: 1.25rem;
    background: var(--color-success);
    color: #0b231a;
  }

  .artifact-button {
    background: color-mix(in srgb, var(--color-accent) 32%, var(--color-surface) 68%);
  }

  .dive-arrow {
    font-size: 1.5rem;
    font-weight: 900;
    color: rgba(11, 35, 26, 0.7);
  }

  .count-badge {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 92%, var(--color-bg) 8%);
    color: var(--color-bg);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .insurance-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    border-radius: 10px;
    border: 1px solid transparent;
    transition: border-color 200ms ease;
  }

  .insurance-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    width: 100%;
  }

  .insurance-toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .insurance-icon {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-dim);
    letter-spacing: 0.02em;
  }

  .insurance-active .insurance-icon {
    color: var(--color-success);
  }

  .insurance-cost {
    font-size: 0.8rem;
    font-weight: 600;
    color: #4ecca3;
  }

  .insurance-note {
    font-size: 0.72rem;
    color: var(--color-success);
    font-style: italic;
  }

  .insurance-note.dim {
    color: var(--color-text-dim);
  }

  .insurance-active {
    border-color: var(--color-success);
  }

  .insurance-disabled {
    opacity: 0.5;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
    font-size: 0.82rem;
    color: var(--color-text-dim);
    line-height: 1.25;
  }

  .gaia-card {
    margin: 8px;
    padding: 10px 14px;
    background: rgba(20, 20, 40, 0.6);
    border-left: 3px solid #ffd369;
    border-radius: 6px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .gaia-visible {
    opacity: 1;
  }

  .gaia-avatar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .gaia-avatar-img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    image-rendering: pixelated;
    border-radius: 6px;
  }

  .gaia-name {
    color: #22d9d9;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .gaia-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gaia-text {
    color: #b0b0c8;
    font-style: italic;
    line-height: 1.4;
  }

  .gaia-about {
    font-size: 0.7rem;
  }

  .gaia-about-toggle {
    color: #ffd369;
    cursor: pointer;
    list-style: none;
    font-size: 0.68rem;
    opacity: 0.75;
    padding: 0;
    user-select: none;
  }

  .gaia-about-toggle::-webkit-details-marker {
    display: none;
  }

  .gaia-about-toggle::before {
    content: '+ ';
  }

  details[open] .gaia-about-toggle::before {
    content: '- ';
  }

  .gaia-about-content {
    margin-top: 4px;
    padding: 6px 8px;
    background: rgba(255, 211, 105, 0.07);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .gaia-about-content strong {
    color: #e0e0f0;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .gaia-tagline {
    color: #80809a;
    font-style: italic;
    font-size: 0.68rem;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .resources-card,
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .action-button {
      font-size: 1rem;
    }
  }
</style>
