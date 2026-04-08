<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { activeProfile } from '../stores/profileStore'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { isLandscape } from '../../stores/layoutStore'
  import { getCardTier } from '../../services/tierDerivation'
  import { getAllDeckProgress } from '../../services/deckProgressService'
  import type { FactDomain } from '../../data/card-types'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // ── Derived data ──────────────────────────────────────────
  const save = $derived($playerSave)
  const profileName = $derived($activeProfile?.name ?? 'Explorer')
  const stats = $derived(save?.stats)

  // Expedition record
  const totalRuns = $derived(stats?.totalDivesCompleted ?? 0)
  const totalVictories = $derived(stats?.totalVictories ?? 0)
  const totalDefeats = $derived(stats?.totalDefeats ?? 0)
  const totalRetreats = $derived(stats?.totalRetreats ?? 0)
  const winRatePct = $derived(totalRuns > 0 ? Math.round((totalVictories / totalRuns) * 100) : 0)
  const bestFloor = $derived(stats?.bestFloor ?? 0)
  const bestCombo = $derived(stats?.bestStreak ?? 0)
  const cumulativePlaytimeMs = $derived(stats?.cumulativePlaytimeMs ?? 0)

  // Knowledge mastery
  const totalFactsLearned = $derived(stats?.totalFactsLearned ?? 0)
  const reviewStates = $derived(save?.reviewStates ?? [])
  const masteredFacts = $derived(
    reviewStates.filter((s) => getCardTier(s) === '3').length
  )
  const inReviewFacts = $derived(
    reviewStates.filter((s) => {
      const tier = getCardTier(s)
      return s.cardState === 'review' && tier !== '3'
    }).length
  )
  const lifetimeFactsMastered = $derived(stats?.lifetimeFactsMastered ?? 0)
  const masteryProgressPct = $derived(
    totalFactsLearned > 0 ? Math.round((masteredFacts / totalFactsLearned) * 100) : 0
  )

  // Streak & rhythm
  const currentStreak = $derived(stats?.currentStreak ?? 0)
  const bestStreak = $derived(stats?.bestStreak ?? 0)
  const milestonesCount = $derived((save?.claimedMilestones ?? []).length)
  const totalSessions = $derived(stats?.totalSessions ?? 0)
  const dailyAvgMs = $derived(totalSessions > 0 ? Math.round(cumulativePlaytimeMs / totalSessions) : 0)

  // Domain breakdown
  const domainRuns = $derived(
    Object.entries(save?.domainRunCounts ?? {}).sort((a, b) => b[1] - a[1])
  )

  // Per-domain accuracy (average across run history)
  const domainAccuracyMap = $derived.by<Map<string, { correct: number; answered: number }>>(() => {
    const acc = new Map<string, { correct: number; answered: number }>()
    const history = save?.runHistory ?? []
    for (const run of history) {
      for (const [domain, data] of Object.entries(run.domainAccuracy ?? {})) {
        const prev = acc.get(domain) ?? { correct: 0, answered: 0 }
        acc.set(domain, {
          correct: prev.correct + data.correct,
          answered: prev.answered + data.answered,
        })
      }
    }
    return acc
  })

  // Deck progress — only decks with at least 1 fact encountered
  const deckProgressList = $derived(
    [...getAllDeckProgress().entries()]
      .filter(([, p]) => p.factsEncountered > 0)
      .map(([, p]) => p)
      .sort((a, b) => b.factsEncountered - a.factsEncountered)
  )

  // Bestiary
  const killCounts = $derived(save?.lifetimeEnemyKillCounts ?? {})
  const uniqueEnemiesDefeated = $derived(Object.keys(killCounts).length)
  const totalKills = $derived(Object.values(killCounts).reduce((a, b) => a + b, 0))
  const topEnemies = $derived(
    Object.entries(killCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  )

  // Achievements
  const claimedMilestones = $derived(save?.claimedMilestones ?? [])
  const completedBiomes = $derived((save as any)?.completedBiomes ?? [])
  const earnedBadges = $derived((save as any)?.earnedBadges ?? [])

  // Prestige
  const prestige = $derived((save as any)?.prestige ?? 0)
  const characterLevel = $derived(save?.characterLevel ?? 1)
  const totalXP = $derived(save?.totalXP ?? 0)
  const createdAt = $derived(save?.createdAt ?? Date.now())

  // ── Helpers ───────────────────────────────────────────────

  function labelDomain(id: string): string {
    try {
      return getDomainMetadata(id as FactDomain).displayName
    } catch {
      return id ? id.charAt(0).toUpperCase() + id.slice(1).replaceAll('_', ' ') : 'Unknown'
    }
  }

  function formatPlaytime(ms: number): string {
    const totalMins = Math.floor(ms / 60_000)
    const hours = Math.floor(totalMins / 60)
    const mins = totalMins % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  function formatDate(ts: number): string {
    try {
      return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return 'Unknown'
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onBack()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="profile-screen"
  class:profile-landscape={$isLandscape}
  aria-label="Scholar's Profile"
  onkeydown={handleKeydown}
>
  <!-- Header -->
  <header class="profile-header">
    <h2>Scholar's Profile</h2>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  <!-- Scrollable body -->
  <div class="profile-body">

    <!-- 1. Hero banner -->
    <article class="hero-card">
      <div class="avatar" aria-hidden="true">👤</div>
      <div class="hero-info">
        <div class="hero-name-row">
          <h3>{profileName}</h3>
          {#if prestige > 0}
            <span class="prestige-badge">★ Prestige {prestige}</span>
          {/if}
        </div>
        <p class="hero-sub">Scholar since {formatDate(createdAt)}</p>
        <div class="xp-row">
          <span class="level-badge">Lvl {characterLevel}</span>
          <div class="xp-bar-wrap">
            <div class="xp-bar" style="width: {Math.min(100, (totalXP % 1000) / 10)}%"></div>
          </div>
          <span class="xp-label">{totalXP.toLocaleString()} XP</span>
        </div>
      </div>
    </article>

    <!-- 2. Expedition record -->
    <article class="section-card">
      <h4 class="section-title">Expedition Record</h4>
      <div class="record-tiles">
        <div class="record-tile"><span>Total Runs</span><strong>{totalRuns}</strong></div>
        <div class="record-tile victory-tile"><span>Victories</span><strong>{totalVictories}</strong></div>
        <div class="record-tile defeat-tile"><span>Defeats</span><strong>{totalDefeats}</strong></div>
        <div class="record-tile retreat-tile"><span>Retreats</span><strong>{totalRetreats}</strong></div>
      </div>
      <div class="record-meta-row">
        <div class="meta-stat">
          <span>Win Rate</span>
          <strong class:good={winRatePct >= 50}>{winRatePct}%</strong>
        </div>
        <div class="meta-stat">
          <span>Best Floor</span>
          <strong>{bestFloor}</strong>
        </div>
        <div class="meta-stat">
          <span>Best Chain</span>
          <strong>x{bestCombo}</strong>
        </div>
        <div class="meta-stat">
          <span>Total Playtime</span>
          <strong>{formatPlaytime(cumulativePlaytimeMs)}</strong>
        </div>
      </div>
    </article>

    <!-- 3. Knowledge mastery -->
    <article class="section-card">
      <h4 class="section-title">Knowledge Mastery</h4>
      <div class="mastery-tiles">
        <div class="mastery-tile"><span>Facts Learned</span><strong>{totalFactsLearned}</strong></div>
        <div class="mastery-tile review-tile"><span>In Review</span><strong>{inReviewFacts}</strong></div>
        <div class="mastery-tile mastered-tile"><span>Mastered</span><strong>{masteredFacts}</strong></div>
        <div class="mastery-tile lifetime-tile"><span>Lifetime Mastered</span><strong>{lifetimeFactsMastered}</strong></div>
      </div>
      {#if totalFactsLearned > 0}
        <div class="mastery-progress-wrap">
          <div class="mastery-progress-bar" style="width: {masteryProgressPct}%"></div>
        </div>
        <span class="mastery-progress-label">{masteryProgressPct}% mastery ({masteredFacts}/{totalFactsLearned})</span>
      {/if}
    </article>

    <!-- 4. Streak & rhythm -->
    <article class="section-card">
      <h4 class="section-title">Streak & Rhythm</h4>
      <div class="streak-tiles">
        <div class="streak-tile current-streak"><span>Current Streak</span><strong>{currentStreak} day{currentStreak !== 1 ? 's' : ''}</strong></div>
        <div class="streak-tile"><span>Best Streak</span><strong>{bestStreak} day{bestStreak !== 1 ? 's' : ''}</strong></div>
        <div class="streak-tile"><span>Milestones</span><strong>{milestonesCount}</strong></div>
        <div class="streak-tile"><span>Sessions</span><strong>{totalSessions}</strong></div>
      </div>
      {#if totalSessions > 0}
        <div class="streak-avg">Daily avg playtime: <strong>{formatPlaytime(dailyAvgMs)}</strong></div>
      {/if}
    </article>

    <!-- 5. Domain breakdown -->
    {#if domainRuns.length > 0}
      <article class="section-card">
        <h4 class="section-title">Domain Breakdown</h4>
        <div class="domain-list">
          {#each domainRuns as [domain, count] (domain)}
            {@const accData = domainAccuracyMap.get(domain)}
            {@const accPct = accData && accData.answered > 0 ? Math.round((accData.correct / accData.answered) * 100) : null}
            <div class="domain-row">
              <span class="domain-name">{labelDomain(domain)}</span>
              <span class="domain-count">{count} run{count !== 1 ? 's' : ''}</span>
              {#if accPct !== null}
                <div class="domain-bar-wrap">
                  <div class="domain-bar" style="width: {accPct}%"></div>
                </div>
                <span class="domain-acc-pct">{accPct}%</span>
              {:else}
                <div class="domain-bar-wrap"></div>
                <span class="domain-acc-pct" style="opacity: 0.3">—</span>
              {/if}
            </div>
          {/each}
        </div>
      </article>
    {/if}

    <!-- 6. Deck progress -->
    {#if deckProgressList.length > 0}
      <article class="section-card">
        <h4 class="section-title">Deck Progress</h4>
        <div class="deck-grid">
          {#each deckProgressList as deck (deck.deckId)}
            <div class="deck-tile" aria-label="Deck {deck.deckId}">
              <span class="deck-name">{deck.deckId.replaceAll('_', ' ')}</span>
              <div class="deck-prog-bar-wrap">
                <div class="deck-prog-bar" style="width: {deck.progressPercent}%"></div>
              </div>
              <div class="deck-stats-row">
                <span>{deck.factsEncountered}/{deck.totalFacts} seen</span>
                <span class="deck-mastered">{deck.factsMastered} mastered</span>
              </div>
            </div>
          {/each}
        </div>
      </article>
    {/if}

    <!-- 7. Bestiary preview -->
    {#if uniqueEnemiesDefeated > 0}
      <article class="section-card">
        <h4 class="section-title">Bestiary Preview</h4>
        <div class="bestiary-summary">
          <div class="bestiary-stat"><span>Unique Enemies</span><strong>{uniqueEnemiesDefeated}</strong></div>
          <div class="bestiary-stat"><span>Total Kills</span><strong>{totalKills.toLocaleString()}</strong></div>
        </div>
        {#if topEnemies.length > 0}
          <div class="bestiary-top">
            <p class="bestiary-sub">Top Defeated</p>
            {#each topEnemies as [enemyId, kills] (enemyId)}
              <div class="bestiary-row">
                <span class="bestiary-enemy-name">{enemyId.replaceAll('_', ' ')}</span>
                <span class="bestiary-kills">×{kills}</span>
              </div>
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    <!-- 8. Achievements -->
    {#if claimedMilestones.length > 0 || completedBiomes.length > 0 || earnedBadges.length > 0}
      <article class="section-card">
        <h4 class="section-title">Achievements</h4>
        {#if claimedMilestones.length > 0}
          <div class="achievement-group">
            <span class="ach-group-label">Streak Milestones</span>
            <div class="chip-row">
              {#each claimedMilestones as ms (ms)}
                <span class="chip chip-gold">{ms} day{ms !== 1 ? 's' : ''}</span>
              {/each}
            </div>
          </div>
        {/if}
        {#if completedBiomes.length > 0}
          <div class="achievement-group">
            <span class="ach-group-label">Completed Biomes</span>
            <div class="chip-row">
              {#each completedBiomes as biome (biome)}
                <span class="chip chip-blue">{biome}</span>
              {/each}
            </div>
          </div>
        {/if}
        {#if earnedBadges.length > 0}
          <div class="achievement-group">
            <span class="ach-group-label">Badges</span>
            <div class="chip-row">
              {#each earnedBadges as badge (badge?.id ?? badge)}
                <span class="chip chip-purple">{badge?.id ?? badge}</span>
              {/each}
            </div>
          </div>
        {/if}
      </article>
    {/if}

    <!-- Empty state when no runs recorded -->
    {#if totalRuns === 0}
      <div class="empty-state">
        <p class="empty-icon">🗺️</p>
        <p>No expeditions yet — dive in to start building your profile.</p>
      </div>
    {/if}

  </div>
</section>

<style>
  /* ── Base ─────────────────────────────────────────────────── */

  .profile-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0a1220 0%, #0e1929 100%);
    color: #e2e8f0;
    overflow: hidden;
  }

  /* ── Header ───────────────────────────────────────────────── */

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    flex-shrink: 0;
  }

  .profile-header h2 {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .back-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    min-width: calc(64px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 calc(14px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
  }

  .back-btn:hover {
    background: #263348;
    border-color: #64748b;
  }

  /* ── Scrollable body ──────────────────────────────────────── */

  .profile-body {
    flex: 1;
    overflow-y: auto;
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  /* ── Section cards (shared base) ─────────────────────────── */

  .hero-card,
  .section-card {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.78);
    padding: calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .section-title {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
    text-transform: uppercase;
    letter-spacing: calc(0.6px * var(--layout-scale, 1));
    font-weight: 700;
  }

  /* ── 1. Hero banner ───────────────────────────────────────── */

  .hero-card {
    flex-direction: row;
    align-items: center;
    gap: calc(14px * var(--layout-scale, 1));
    border-color: rgba(212, 160, 23, 0.3);
    background: rgba(15, 23, 42, 0.82);
    box-shadow: 0 0 calc(16px * var(--layout-scale, 1)) rgba(212, 160, 23, 0.07);
  }

  .avatar {
    width: calc(60px * var(--layout-scale, 1));
    height: calc(60px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(30, 64, 175, 0.3);
    display: grid;
    place-items: center;
    font-size: calc(28px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .hero-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    min-width: 0;
  }

  .hero-name-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .hero-name-row h3 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .prestige-badge {
    font-size: calc(10px * var(--text-scale, 1));
    background: rgba(212, 160, 23, 0.2);
    border: 1px solid rgba(212, 160, 23, 0.4);
    color: #fde68a;
    border-radius: 99px;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
  }

  .hero-sub {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .xp-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .level-badge {
    font-size: calc(11px * var(--text-scale, 1));
    background: rgba(30, 64, 175, 0.4);
    border: 1px solid rgba(96, 165, 250, 0.3);
    color: #93c5fd;
    border-radius: 99px;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  .xp-bar-wrap {
    flex: 1;
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(2, 6, 23, 0.5);
    border-radius: 99px;
    overflow: hidden;
  }

  .xp-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 99px;
    transition: width 0.4s ease;
    min-width: 2px;
  }

  .xp-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
    white-space: nowrap;
  }

  /* ── 2. Expedition record ─────────────────────────────────── */

  .record-tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: calc(6px * var(--layout-scale, 1));
  }

  .record-tile {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    text-align: center;
  }

  .record-tile span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
  }

  .record-tile strong {
    font-size: calc(20px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .victory-tile { border-color: rgba(34, 197, 94, 0.2); }
  .victory-tile strong { color: #86efac; }
  .defeat-tile { border-color: rgba(239, 68, 68, 0.2); }
  .defeat-tile strong { color: #fca5a5; }
  .retreat-tile { border-color: rgba(148, 163, 184, 0.15); }
  .retreat-tile strong { color: #94a3b8; }

  .record-meta-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: calc(6px * var(--layout-scale, 1));
  }

  .meta-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
    text-align: center;
  }

  .meta-stat span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #475569;
    text-transform: uppercase;
  }

  .meta-stat strong {
    font-size: calc(14px * var(--text-scale, 1));
    color: #e2e8f0;
  }

  .meta-stat strong.good { color: #86efac; }

  /* ── 3. Knowledge mastery ─────────────────────────────────── */

  .mastery-tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(6px * var(--layout-scale, 1));
  }

  .mastery-tile {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .mastery-tile span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
  }

  .mastery-tile strong {
    font-size: calc(20px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .review-tile { border-color: rgba(59, 130, 246, 0.2); }
  .review-tile strong { color: #93c5fd; }
  .mastered-tile { border-color: rgba(34, 197, 94, 0.2); }
  .mastered-tile strong { color: #86efac; }
  .lifetime-tile { border-color: rgba(168, 85, 247, 0.2); }
  .lifetime-tile strong { color: #c4b5fd; }

  .mastery-progress-wrap {
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(2, 6, 23, 0.5);
    border-radius: 99px;
    overflow: hidden;
  }

  .mastery-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #22c55e);
    border-radius: 99px;
    transition: width 0.4s ease;
    min-width: 2px;
  }

  .mastery-progress-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
    text-align: right;
  }

  /* ── 4. Streak & rhythm ───────────────────────────────────── */

  .streak-tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(6px * var(--layout-scale, 1));
  }

  .streak-tile {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .streak-tile span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
  }

  .streak-tile strong {
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .current-streak { border-color: rgba(251, 146, 60, 0.3); }
  .current-streak strong { color: #fdba74; }

  .streak-avg {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
  }

  .streak-avg strong { color: #e2e8f0; }

  /* ── 5. Domain breakdown ──────────────────────────────────── */

  .domain-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    max-height: calc(200px * var(--layout-scale, 1));
    overflow-y: auto;
  }

  .domain-row {
    display: grid;
    grid-template-columns: 1fr calc(60px * var(--layout-scale, 1)) calc(80px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .domain-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .domain-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-align: right;
    white-space: nowrap;
  }

  .domain-bar-wrap {
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(2, 6, 23, 0.5);
    border-radius: 99px;
    overflow: hidden;
  }

  .domain-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #22c55e);
    border-radius: 99px;
    transition: width 0.3s ease;
    min-width: 1px;
  }

  .domain-acc-pct {
    font-size: calc(11px * var(--text-scale, 1));
    color: #e2e8f0;
    font-weight: 700;
    text-align: right;
  }

  /* ── 6. Deck progress ─────────────────────────────────────── */

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .deck-tile {
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .deck-name {
    font-size: calc(11px * var(--text-scale, 1));
    color: #e2e8f0;
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .deck-prog-bar-wrap {
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(2, 6, 23, 0.5);
    border-radius: 99px;
    overflow: hidden;
  }

  .deck-prog-bar {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #22c55e);
    border-radius: 99px;
    transition: width 0.4s ease;
    min-width: 1px;
  }

  .deck-stats-row {
    display: flex;
    justify-content: space-between;
    font-size: calc(9px * var(--text-scale, 1));
    color: #475569;
  }

  .deck-mastered { color: #4ade80; }

  /* ── 7. Bestiary ──────────────────────────────────────────── */

  .bestiary-summary {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .bestiary-stat {
    flex: 1;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
    align-items: center;
    text-align: center;
  }

  .bestiary-stat span {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
  }

  .bestiary-stat strong {
    font-size: calc(20px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .bestiary-sub {
    margin: 0;
    font-size: calc(10px * var(--text-scale, 1));
    color: #475569;
    text-transform: uppercase;
  }

  .bestiary-top {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .bestiary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: calc(4px * var(--layout-scale, 1)) 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }

  .bestiary-enemy-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    text-transform: capitalize;
  }

  .bestiary-kills {
    font-size: calc(12px * var(--text-scale, 1));
    color: #fca5a5;
    font-weight: 700;
  }

  /* ── 8. Achievements ──────────────────────────────────────── */

  .achievement-group {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .ach-group-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .chip {
    font-size: calc(11px * var(--text-scale, 1));
    border-radius: 99px;
    padding: calc(2px * var(--layout-scale, 1)) calc(9px * var(--layout-scale, 1));
    border: 1px solid transparent;
  }

  .chip-gold {
    background: rgba(113, 63, 18, 0.35);
    border-color: rgba(250, 204, 21, 0.3);
    color: #fde68a;
  }

  .chip-blue {
    background: rgba(30, 58, 138, 0.35);
    border-color: rgba(96, 165, 250, 0.3);
    color: #93c5fd;
  }

  .chip-purple {
    background: rgba(76, 29, 149, 0.35);
    border-color: rgba(196, 181, 253, 0.3);
    color: #c4b5fd;
  }

  /* ── Empty state ──────────────────────────────────────────── */

  .empty-state {
    text-align: center;
    padding: calc(24px * var(--layout-scale, 1));
    color: rgba(255, 255, 255, 0.4);
    font-size: calc(13px * var(--text-scale, 1));
    font-style: italic;
  }

  .empty-icon {
    font-size: calc(32px * var(--text-scale, 1));
    margin: 0 0 calc(8px * var(--layout-scale, 1));
  }

  /* ═══ LANDSCAPE OVERRIDES ════════════════════════════════════ */

  .profile-landscape .profile-header {
    padding: calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .profile-landscape .profile-header h2 {
    font-size: calc(26px * var(--text-scale, 1));
  }

  .profile-landscape .profile-body {
    padding: calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: min-content;
    gap: calc(14px * var(--layout-scale, 1));
    align-content: start;
    overflow-y: auto;
    flex: unset;
    height: 0;
    /* Give it actual height in landscape */
    min-height: 0;
  }

  /* Hero card spans full width in landscape */
  .profile-landscape .hero-card {
    grid-column: 1 / -1;
  }

  .profile-landscape .hero-name-row h3 {
    font-size: calc(24px * var(--text-scale, 1));
  }

  .profile-landscape .avatar {
    width: calc(80px * var(--layout-scale, 1));
    height: calc(80px * var(--layout-scale, 1));
    font-size: calc(40px * var(--text-scale, 1));
  }

  .profile-landscape .record-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .profile-landscape .record-tile strong {
    font-size: calc(26px * var(--text-scale, 1));
  }

  .profile-landscape .mastery-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .profile-landscape .mastery-tile strong {
    font-size: calc(22px * var(--text-scale, 1));
  }

  .profile-landscape .streak-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .profile-landscape .domain-list {
    max-height: calc(300px * var(--layout-scale, 1));
  }

  .profile-landscape .domain-row {
    grid-template-columns: 1fr calc(70px * var(--layout-scale, 1)) calc(100px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
  }

  .profile-landscape .deck-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :global([data-layout="landscape"]) .profile-screen {
    max-width: none;
  }

  /* In landscape, the profile-body needs a real height derived from flex parent */
  :global([data-layout="landscape"]) .profile-landscape .profile-body {
    flex: 1;
    height: 0;
    min-height: 0;
  }
</style>
