<script lang="ts">
  import { onMount } from 'svelte'
  import { shareRunSummaryCard } from '../../services/runShareService'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { analyticsService } from '../../services/analyticsService'
  import { ENEMY_TEMPLATES, type EnemyTemplate, type EnemyCategory } from '../../data/enemies'
  import { getGreyMatterIconPath } from '../utils/iconAssets'

  interface XPResult {
    breakdown: {
      total: number
      correctAnswers: number
      speedBonuses: number
      streakBonuses: number
      floorsCleared: number
      combatsWon: number
      elitesDefeated: number
      miniBossesDefeated: number
      bossesDefeated: number
      newFacts: number
      completionBonus: number
      subtotal: number
      ascensionMultiplier: number
      dailyBonus: number
    }
    levelsGained: number
    newLevel: number
    relicsUnlocked: string[]
    greyMatterAwarded: number
  }

  interface Props {
    result: 'victory' | 'defeat' | 'retreat'
    floorReached: number
    factsAnswered: number
    correctAnswers: number
    accuracy: number
    bestCombo: number
    cardsEarned: number
    newFactsLearned: number
    factsMastered: number
    encountersWon: number
    encountersTotal: number
    completedBounties: string[]
    runDurationMs?: number
    rewardMultiplier: number
    currencyEarned: number
    isPracticeRun?: boolean
    xpResult?: XPResult
    defeatedEnemyIds?: string[]
    factStateSummary?: { seen: number; reviewing: number; mastered: number }
    elitesDefeated?: number
    miniBossesDefeated?: number
    bossesDefeated?: number
    onplayagain: () => void
    onhome: () => void
  }

  let {
    result,
    floorReached,
    factsAnswered,
    correctAnswers,
    accuracy,
    bestCombo,
    cardsEarned,
    newFactsLearned,
    factsMastered,
    encountersWon,
    encountersTotal,
    completedBounties,
    runDurationMs = 0,
    rewardMultiplier,
    currencyEarned,
    isPracticeRun = false,
    xpResult = undefined,
    defeatedEnemyIds = [],
    factStateSummary = { seen: 0, reviewing: 0, mastered: 0 },
    elitesDefeated = 0,
    miniBossesDefeated = 0,
    bossesDefeated = 0,
    onplayagain,
    onhome,
  }: Props = $props()

  // ── Enemy helpers ──────────────────────────────────────────────────────────
  const ENEMY_MAP = new Map<string, EnemyTemplate>(ENEMY_TEMPLATES.map(t => [t.id, t]))

  function getEnemyInfo(id: string): { name: string; category: EnemyCategory } {
    const t = ENEMY_MAP.get(id)
    return t ? { name: t.name, category: t.category } : { name: id, category: 'common' }
  }

  function getCategoryBorderColor(cat: EnemyCategory): string {
    switch (cat) {
      case 'elite': return '#7C4DFF'
      case 'mini_boss': return '#FF9800'
      case 'boss': return '#FFD700'
      default: return '#8B949E'
    }
  }

  function getCategoryXP(cat: EnemyCategory): number {
    switch (cat) {
      case 'elite': return 10
      case 'mini_boss': return 15
      case 'boss': return 25
      default: return 5
    }
  }

  // ── Counter animation utility ──────────────────────────────────────────────
  function animateCounter(
    target: number,
    duration: number,
    onTick: (current: number) => void,
    onComplete?: () => void,
  ): () => void {
    if (target === 0) { onTick(0); onComplete?.(); return () => {} }
    const start = performance.now()
    let cancelled = false
    function frame(now: number): void {
      if (cancelled) return
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      onTick(Math.round(target * eased))
      if (t < 1) requestAnimationFrame(frame)
      else onComplete?.()
    }
    requestAnimationFrame(frame)
    return () => { cancelled = true }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  let isVictory = $derived(result === 'victory' || result === 'retreat')

  function computeGrade(floor: number, runResult: string): { letter: string; color: string; title: string; flavor: string } {
    if (runResult === 'victory') return { letter: 'S', color: '#EF9F27', title: 'DUNGEON VANQUISHED', flavor: 'Triumphant return — the knowledge wrested from darkness shall not be forgotten.' }
    if (runResult === 'retreat') return { letter: '', color: '', title: 'TACTICAL RETREAT', flavor: 'The wise scholar knows when to regroup.' }
    if (floor >= 22) return { letter: 'A+', color: '#EF9F27', title: 'A WORTHY EXPEDITION', flavor: 'Confidence surges as the dark yields its secrets.' }
    if (floor >= 19) return { letter: 'A', color: '#EF9F27', title: 'A WORTHY EXPEDITION', flavor: 'Confidence surges as the dark yields its secrets.' }
    if (floor >= 16) return { letter: 'B+', color: '#B4B2A9', title: 'THE DARK RETREATS', flavor: 'Adequate. The shadows will remember your face.' }
    if (floor >= 13) return { letter: 'B', color: '#B4B2A9', title: 'THE DARK RETREATS', flavor: 'Adequate. The shadows will remember your face.' }
    if (floor >= 10) return { letter: 'C+', color: '#D85A30', title: 'A NARROW ESCAPE', flavor: 'Survival is a tenuous proposition in this sprawling tomb.' }
    if (floor >= 7) return { letter: 'C', color: '#D85A30', title: 'A NARROW ESCAPE', flavor: 'Survival is a tenuous proposition in this sprawling tomb.' }
    if (floor >= 5) return { letter: 'D+', color: '#E24B4A', title: 'LOST IN THE DARK', flavor: 'The dark is patient. It can wait for your return.' }
    if (floor >= 3) return { letter: 'D', color: '#E24B4A', title: 'LOST IN THE DARK', flavor: 'The dark is patient. It can wait for your return.' }
    return { letter: 'F', color: '#791F1F', title: 'DRIVEN BACK', flavor: 'Remind yourself that overconfidence is a slow and insidious killer.' }
  }

  let grade = $derived(computeGrade(floorReached, result))
  let enemyIds = $derived(defeatedEnemyIds ?? [])
  let factSummary = $derived(factStateSummary ?? { seen: 0, reviewing: 0, mastered: 0 })
  let factTotal = $derived(factSummary.seen + factSummary.reviewing + factSummary.mastered)

  let presentCategories = $derived.by(() => {
    const cats = new Set<EnemyCategory>()
    for (const id of enemyIds) {
      const info = getEnemyInfo(id)
      cats.add(info.category)
    }
    // Order: common, elite, mini_boss, boss
    const order: EnemyCategory[] = ['common', 'elite', 'mini_boss', 'boss']
    return order.filter(c => cats.has(c))
  })

  let badgeSize = $derived.by(() => {
    const count = enemyIds.length
    if (count <= 5) return 48
    if (count <= 10) return 40
    if (count <= 16) return 36
    return 28
  })

  let badgeGap = $derived.by(() => {
    const count = enemyIds.length
    if (count <= 5) return 8
    if (count <= 10) return 6
    if (count <= 16) return 5
    return 4
  })

  function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  function getAccuracyContext(acc: number): { text: string; color: string } {
    if (acc >= 90) return { text: 'Exceptional', color: '#44bb44' }
    if (acc >= 75) return { text: 'Strong', color: '#8BC34A' }
    if (acc >= 60) return { text: 'Decent', color: '#FFC107' }
    if (acc >= 40) return { text: 'Struggling', color: '#FF9800' }
    return { text: 'Rough', color: '#FF5722' }
  }
  let accuracyContext = $derived(getAccuracyContext(accuracy))

  let gradeExplanation = $derived.by(() => {
    if (result === 'victory' || result === 'retreat') return ''
    const explorationPct = encountersTotal > 0 ? Math.round((encountersWon / encountersTotal) * 100) : 0
    if (accuracy >= 80 && floorReached < 7) {
      return `You aced what you faced — but only explored ${explorationPct}% of the dungeon.`
    }
    if (accuracy < 50 && encountersWon >= encountersTotal * 0.75) {
      return 'You braved every corridor but stumbled often.'
    }
    return 'Grade = accuracy \u00d7 exploration \u00d7 chain bonus'
  })

  // ── Animation state ────────────────────────────────────────────────────────
  let skipToEnd = $state(false)
  let timers: ReturnType<typeof setTimeout>[] = []

  let showHeader = $state(false)
  let showGrade = $state(false)
  let visibleEnemyCount = $state(0)
  let showBadgeXP = $state<boolean[]>([])
  let showFactHarvest = $state(false)
  let showStats = $state(false)
  let showTally = $state(false)
  let showButtons = $state(false)

  let displayedSeen = $state(0)
  let displayedReviewing = $state(0)
  let displayedMastered = $state(0)
  let displayedGreyMatter = $state(0)
  let displayedXP = $state(0)

  let shareStatus = $state<'idle' | 'sharing' | 'done' | 'error'>('idle')

  function schedulePhase(fn: () => void, delayMs: number): void {
    if (skipToEnd) { fn(); return }
    timers.push(setTimeout(() => { if (!skipToEnd) fn() }, delayMs))
  }

  function handleSkip(): void {
    if (skipToEnd) return
    skipToEnd = true
    timers.forEach(clearTimeout)
    timers = []
    showHeader = true
    showGrade = true
    visibleEnemyCount = enemyIds.length
    showBadgeXP = enemyIds.map(() => true)
    showFactHarvest = true
    showStats = true
    showTally = true
    showButtons = true
    displayedSeen = factSummary.seen
    displayedReviewing = factSummary.reviewing
    displayedMastered = factSummary.mastered
    displayedGreyMatter = currencyEarned
    displayedXP = xpResult?.breakdown.total ?? 0
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onhome()
  }

  async function handleShare(): Promise<void> {
    shareStatus = 'sharing'
    try {
      const method = await shareRunSummaryCard({
        result,
        floorReached,
        factsAnswered,
        correctAnswers,
        accuracy,
        bestCombo,
        cardsEarned,
        newFactsLearned,
        factsMastered,
        encountersWon,
        encountersTotal,
        elitesDefeated: elitesDefeated ?? 0,
        miniBossesDefeated: miniBossesDefeated ?? 0,
        bossesDefeated: bossesDefeated ?? 0,
        completedBounties,
        duration: runDurationMs,
        runDurationMs,
        rewardMultiplier,
        currencyEarned,
        isPracticeRun,
        defeatedEnemyIds: enemyIds,
        factStateSummary: factSummary,
      })
      analyticsService.track({
        name: 'share_card_generated',
        properties: {
          template: 'dive_record',
          platform: method,
          facts_mastered: factsMastered,
          tree_completion_pct: Math.max(0, Math.min(100, Math.round((accuracy + (factsMastered * 2)) / 2))),
        },
      })
      shareStatus = 'done'
    } catch {
      shareStatus = 'error'
    } finally {
      setTimeout(() => { shareStatus = 'idle' }, 1500)
    }
  }

  // ── Check for reduced motion ───────────────────────────────────────────────
  function prefersReducedMotion(): boolean {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-pw-animations') === 'disabled'
    )
  }

  onMount(() => {
    playCardAudio(isVictory ? 'run-victory' : 'run-defeat')
    showBadgeXP = enemyIds.map(() => false)

    if (prefersReducedMotion()) {
      handleSkip()
      return
    }

    let cursor = 0

    // Phase 1: header label fades in
    schedulePhase(() => { showHeader = true }, 300)
    cursor = 300

    // Phase 2: grade badge drops in with bounce
    schedulePhase(() => {
      showGrade = true
      playCardAudio('stat-tick')
    }, cursor + 400)
    cursor += 400

    // Phase 3: enemy parade (80ms stagger per foe, faster than before)
    const enemyParadeStart = cursor + 300
    for (let i = 0; i < enemyIds.length; i++) {
      const idx = i
      schedulePhase(() => {
        visibleEnemyCount = idx + 1
        timers.push(setTimeout(() => {
          showBadgeXP = showBadgeXP.map((v, j) => j === idx ? true : v)
        }, 300))
        if (idx % 3 === 0) playCardAudio('stat-tick')
      }, enemyParadeStart + idx * 80)
    }
    cursor = enemyParadeStart + Math.max(0, enemyIds.length - 1) * 80

    // Phase 4: fact harvest bars animate (600ms each, 150ms stagger)
    const harvestStart = cursor + 200
    schedulePhase(() => { showFactHarvest = true }, harvestStart)
    schedulePhase(() => {
      const seenTarget = factSummary.seen
      animateCounter(seenTarget, 600, v => { displayedSeen = Math.min(v, seenTarget) })
    }, harvestStart + 100)
    schedulePhase(() => {
      const reviewingTarget = factSummary.reviewing
      animateCounter(reviewingTarget, 600, v => { displayedReviewing = Math.min(v, reviewingTarget) })
    }, harvestStart + 250)
    schedulePhase(() => {
      const masteredTarget = factSummary.mastered
      animateCounter(masteredTarget, 600, v => { displayedMastered = Math.min(v, masteredTarget) })
    }, harvestStart + 400)
    cursor = harvestStart + 600

    // Phase 5: run stats fade in
    schedulePhase(() => { showStats = true }, cursor + 300)
    cursor += 300

    // Phase 6: tally count-up with dust sound
    schedulePhase(() => {
      showTally = true
      playCardAudio('xp-award')
      animateCounter(currencyEarned, 800, v => { displayedGreyMatter = v })
      animateCounter(xpResult?.breakdown.total ?? 0, 1000, v => { displayedXP = v })
    }, cursor + 400)
    cursor += 400

    // Phase 7: buttons fade in
    schedulePhase(() => { showButtons = true }, cursor + 200)
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="run-end-overlay"
  class:victory-result={isVictory}
  class:defeat-result={!isVictory}
  onclick={handleSkip}
  onkeydown={handleKeydown}
  role="presentation"
>
  <div class="re-layout">

    <!-- Header -->
    <div class="re-header" class:header-visible={showHeader}>
      <span class="header-label">{grade.title}</span>
      {#if result !== 'retreat'}
        <div class="grade-badge" class:grade-visible={showGrade} style="--grade-color: {grade.color}">
          <span class="grade-letter">{grade.letter}</span>
        </div>
      {/if}
      <p class="grade-flavor" class:grade-visible={showGrade}>{grade.flavor}</p>
      {#if gradeExplanation}
        <p class="grade-explanation" class:grade-visible={showGrade}>{gradeExplanation}</p>
      {/if}
    </div>

    <!-- Foes Vanquished -->
    {#if enemyIds.length > 0}
    <div class="re-foes" class:section-visible={visibleEnemyCount > 0 || skipToEnd}>
      <h2 class="section-heading">Foes Vanquished</h2>
      <div class="enemy-parade" style="--badge-size: calc({badgeSize}px * var(--layout-scale, 1)); gap: calc({badgeGap}px * var(--layout-scale, 1))">
        {#each enemyIds as id, idx}
          {@const info = getEnemyInfo(id)}
          <div
            class="enemy-badge-wrapper"
            class:badge-visible={idx < visibleEnemyCount}
            style="--badge-delay: {idx * 150}ms"
          >
            <div class="enemy-badge" style="--badge-border: {getCategoryBorderColor(info.category)}">
              <img
                src="/assets/sprites/enemies/{id}_idle_1x.webp"
                alt={info.name}
                class="enemy-badge-img"
                onerror={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                  const fb = img.nextElementSibling as HTMLElement | null
                  if (fb && fb.classList.contains('enemy-badge-fallback')) fb.style.display = 'flex'
                }}
              />
              <span class="enemy-badge-fallback" aria-hidden="true" style="display: none;">❓</span>
              {#if info.category !== 'common'}
                <span class="badge-category-pip" style="background: {getCategoryBorderColor(info.category)}">
                  {info.category === 'boss' ? '★' : info.category === 'mini_boss' ? '◆' : '▲'}
                </span>
              {/if}
            </div>
            {#if showBadgeXP[idx]}
              <span class="badge-xp-float">+{getCategoryXP(info.category)}</span>
            {/if}
          </div>
        {/each}
      </div>
      <div class="foe-legend">
        {#each presentCategories as cat}
          <span class="legend-item">
            <span class="legend-dot" style="background: {getCategoryBorderColor(cat)}"></span>
            <span class="legend-label">{cat === 'mini_boss' ? 'Mini Boss' : cat === 'common' ? 'Common' : cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          </span>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Knowledge Harvest -->
    <div class="re-harvest" class:section-visible={showFactHarvest}>
      <h2 class="section-heading">Knowledge Harvest</h2>
      <div class="fact-row fact-row-seen" style="--row-delay: 0ms">
        <span class="fact-dot" style="background: #5DCAA5"></span>
        <span class="fact-label">Seen</span>
        <span class="fact-count">{displayedSeen}<span class="fact-total">/{factTotal}</span></span>
        <div class="fact-bar"><div class="fact-bar-fill fact-bar-seen" style="width: {factTotal > 0 ? (factSummary.seen / factTotal * 100) : 0}%"></div></div>
        <span class="fact-xp">+{displayedSeen * 2}</span>
      </div>
      <div class="fact-row fact-row-reviewing" style="--row-delay: 200ms">
        <span class="fact-dot" style="background: #EF9F27"></span>
        <span class="fact-label">Reviewing</span>
        <span class="fact-count">{displayedReviewing}<span class="fact-total">/{factTotal}</span></span>
        <div class="fact-bar"><div class="fact-bar-fill fact-bar-reviewing" style="width: {factTotal > 0 ? (factSummary.reviewing / factTotal * 100) : 0}%"></div></div>
        <span class="fact-xp">+{displayedReviewing * 3}</span>
      </div>
      <div class="fact-row fact-row-mastered" style="--row-delay: 400ms">
        <span class="fact-dot" style="background: #7F77DD"></span>
        <span class="fact-label">Mastered</span>
        <span class="fact-count">{displayedMastered}<span class="fact-total">/{factTotal}</span></span>
        <div class="fact-bar"><div class="fact-bar-fill fact-bar-mastered" style="width: {factTotal > 0 ? (factSummary.mastered / factTotal * 100) : 0}%"></div></div>
        <span class="fact-xp">+{displayedMastered * 20}</span>
      </div>
      <div class="harvest-total">
        <span class="harvest-total-label">Total XP earned this run</span>
        <span class="harvest-total-value">+{displayedSeen * 2 + displayedReviewing * 3 + displayedMastered * 20}</span>
      </div>
    </div>

    <!-- Run Stats -->
    <div class="re-stats" class:section-visible={showStats}>
      <h2 class="section-heading">Run Stats</h2>
      <div class="stats-grid">
        <div class="stat-pill">
          <span class="pill-label">Floor</span>
          <span class="pill-value">{floorReached}</span>
        </div>
        <div class="stat-pill">
          <span class="pill-label">Accuracy</span>
          <span class="pill-value" style="color: {accuracy >= 80 ? '#639922' : accuracy >= 50 ? '#EF9F27' : '#E24B4A'}">{accuracy}%</span>
          <span class="pill-context" style="color: {accuracyContext.color}">{accuracyContext.text}</span>
        </div>
        <div class="stat-pill">
          <span class="pill-label">Best Chain</span>
          <span class="pill-value">{bestCombo}x</span>
        </div>
        <div class="stat-pill">
          <span class="pill-label">Encounters</span>
          <span class="pill-value">{encountersWon}</span>
        </div>
        <div class="stat-pill">
          <span class="pill-label">Time</span>
          <span class="pill-value">{formatDuration(runDurationMs)}</span>
        </div>
        {#if completedBounties.length > 0}
          <div class="stat-pill bounty-pill">
            <span class="pill-label">Bounties</span>
            <span class="pill-value">{completedBounties.length}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Practice Run Notice -->
    {#if isPracticeRun}
      <div class="practice-run-notice" class:section-visible={showStats}>
        <p class="practice-title">Practice Run</p>
        <p class="practice-desc">No camp rewards — you already know this material.</p>
        <p class="practice-tip">Dive a domain you struggle with to earn rewards.</p>
      </div>
    {/if}

    <!-- Reward Tally -->
    <div class="re-tally" class:section-visible={showTally}>
      <div class="tally-inner">
        <div class="tally-row">
          <img class="tally-icon-img" src={getGreyMatterIconPath()} alt="" aria-hidden="true" />
          <span class="tally-label">GREY MATTER</span>
          <span class="tally-value">{displayedGreyMatter}</span>
        </div>
        {#if xpResult}
          <div class="tally-divider"></div>
          <div class="tally-row">
            <span class="tally-icon">&#x2B50;</span>
            <span class="tally-label">XP</span>
            <span class="tally-value">+{displayedXP}</span>
          </div>
          {#if xpResult.levelsGained > 0}
            <div class="level-up-banner">
              Level Up! &#x2192; Lv.{xpResult.newLevel}
              {#if xpResult.relicsUnlocked.length > 0}
                <span class="unlock-text">&nbsp;&#x2022;&nbsp;{xpResult.relicsUnlocked.length} relic{xpResult.relicsUnlocked.length > 1 ? 's' : ''} unlocked!</span>
              {/if}
              {#if xpResult.greyMatterAwarded > 0}
                <span class="grey-matter-award">&nbsp;&#x2022;&nbsp;+{xpResult.greyMatterAwarded} Grey Matter</span>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Buttons -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="re-buttons"
      class:section-visible={showButtons}
      onclick={(e) => e.stopPropagation()}
      role="group"
    >
      <button class="btn btn-ghost" data-testid="btn-home" onclick={onhome}>
        Home
      </button>
      <button class="btn btn-primary" data-testid="btn-play-again" onclick={onplayagain}>
        Descend Again
      </button>
      <button
        class="btn btn-ghost"
        data-testid="btn-share-run"
        onclick={handleShare}
        disabled={shareStatus === 'sharing'}
      >
        {shareStatus === 'sharing' ? 'Sharing...' : shareStatus === 'done' ? 'Shared' : shareStatus === 'error' ? 'Retry Share' : 'Share'}
      </button>
    </div>

  </div><!-- /re-layout -->
</div>

<style>
  /* ── Base overlay ─────────────────────────────────────────────────────────── */
  .run-end-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    background: #0d1117;
    cursor: pointer;
  }

  /* ── Victory particles ──────────────────────────────────────────────────── */
  .run-end-overlay.victory-result::before,
  .run-end-overlay.victory-result::after {
    content: '';
    position: fixed;
    top: -20px;
    width: calc(6px * var(--layout-scale, 1));
    height: calc(6px * var(--layout-scale, 1));
    background: #ffd700;
    border-radius: 50%;
    z-index: 2;
    animation: goldRain 2s linear infinite;
    pointer-events: none;
  }
  .run-end-overlay.victory-result::before { left: 25%; animation-delay: 0s; }
  .run-end-overlay.victory-result::after { left: 75%; animation-delay: 0.7s; }

  @keyframes goldRain {
    0% { transform: translateY(-20px); opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0; }
  }

  /* ── Defeat pulse removed — grade badge conveys defeat state ──────────────── */

  /* ── Inner layout column ────────────────────────────────────────────────── */
  .re-layout {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: calc(640px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    padding-top: max(calc(24px * var(--layout-scale, 1)), calc(24px * var(--layout-scale, 1) + var(--safe-top, 0px)));
    padding-bottom: max(calc(24px * var(--layout-scale, 1)), calc(24px * var(--layout-scale, 1) + var(--safe-bottom, 0px)));
    gap: calc(16px * var(--layout-scale, 1));
    align-items: center;
    pointer-events: auto;
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .re-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    width: 100%;
    opacity: 0;
    transform: translateY(calc(-10px * var(--layout-scale, 1)));
    transition: opacity 400ms ease, transform 400ms ease;
  }

  .re-header.header-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Header label ────────────────────────────────────────────────────────── */
  .header-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    letter-spacing: calc(4px * var(--layout-scale, 1));
    text-align: center;
    margin: 0;
    text-transform: uppercase;
    color: #8B949E;
  }

  /* ── Grade badge ────────────────────────────────────────────────────────── */
  .grade-badge {
    width: calc(64px * var(--layout-scale, 1));
    height: calc(64px * var(--layout-scale, 1));
    border-radius: 50%;
    border: calc(3px * var(--layout-scale, 1)) solid var(--grade-color);
    background: color-mix(in srgb, var(--grade-color) 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transform: scale(0);
    opacity: 0;
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease;
    box-shadow: 0 0 20px color-mix(in srgb, var(--grade-color) 40%, transparent),
                inset 0 0 12px color-mix(in srgb, var(--grade-color) 20%, transparent);
  }

  .grade-badge.grade-visible {
    transform: scale(1);
    opacity: 1;
    animation: gradeShimmer 3s ease-in-out infinite 0.8s;
  }

  .grade-letter {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: calc(28px * var(--text-scale, 1));
    font-weight: 500;
    color: var(--grade-color);
    text-shadow: 0 0 12px var(--grade-color), 0 2px 4px rgba(0, 0, 0, 0.5);
    line-height: 1;
  }

  .grade-flavor {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: calc(13px * var(--text-scale, 1));
    font-style: italic;
    color: #a0aab4;
    margin: 0;
    opacity: 0;
    transform: translateY(calc(-6px * var(--layout-scale, 1)));
    transition: opacity 400ms ease 0.6s, transform 400ms ease 0.6s;
    max-width: calc(420px * var(--layout-scale, 1));
    text-align: center;
    line-height: 1.4;
  }

  .grade-flavor.grade-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .grade-explanation {
    font-size: calc(11px * var(--text-scale, 1));
    color: #6b7280;
    margin: 0;
    opacity: 0;
    transform: translateY(calc(-4px * var(--layout-scale, 1)));
    transition: opacity 400ms ease 0.8s, transform 400ms ease 0.8s;
    text-align: center;
    max-width: calc(420px * var(--layout-scale, 1));
  }

  .grade-explanation.grade-visible {
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes gradeShimmer {
    0%, 100% {
      box-shadow: 0 0 20px color-mix(in srgb, var(--grade-color) 40%, transparent),
                  inset 0 0 12px color-mix(in srgb, var(--grade-color) 20%, transparent);
    }
    50% {
      box-shadow: 0 0 30px color-mix(in srgb, var(--grade-color) 60%, transparent),
                  inset 0 0 16px color-mix(in srgb, var(--grade-color) 30%, transparent),
                  0 0 40px color-mix(in srgb, var(--grade-color) 20%, transparent);
    }
  }

  /* ── Section visibility (shared transition for all sections) ──────────────── */
  .re-foes,
  .re-harvest,
  .re-stats,
  .re-tally,
  .practice-run-notice {
    opacity: 0;
    transform: translateY(calc(8px * var(--layout-scale, 1)));
    transition: opacity 400ms ease, transform 400ms ease;
    width: 100%;
  }

  .section-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Section heading ────────────────────────────────────────────────────── */
  .section-heading {
    font-size: calc(11px * var(--text-scale, 1));
    letter-spacing: 3px;
    color: #8B949E;
    text-transform: uppercase;
    margin: 0 0 calc(5px * var(--layout-scale, 1)) 0;
    font-weight: 600;
  }

  /* ── Enemy parade ───────────────────────────────────────────────────────── */
  .enemy-parade {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
  }

  .enemy-badge-wrapper {
    position: relative;
    flex-shrink: 0;
    opacity: 0;
    transform: scale(0);
    transition: opacity 250ms ease var(--badge-delay, 0ms),
                transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--badge-delay, 0ms);
  }

  .enemy-badge-wrapper.badge-visible {
    opacity: 1;
    transform: scale(1);
  }

  .enemy-badge {
    position: relative;
    width: var(--badge-size, calc(46px * var(--layout-scale, 1)));
    height: var(--badge-size, calc(46px * var(--layout-scale, 1)));
    border-radius: 50%;
    overflow: hidden;
    border: calc(3px * var(--layout-scale, 1)) solid var(--badge-border, #8B949E);
    background: #1a1f27;
  }

  .enemy-badge-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .enemy-badge-fallback {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1;
  }

  .badge-category-pip {
    position: absolute;
    bottom: calc(-2px * var(--layout-scale, 1));
    right: calc(-2px * var(--layout-scale, 1));
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    border-radius: 50%;
    font-size: calc(8px * var(--text-scale, 1));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #0d1117;
    z-index: 1;
    line-height: 1;
  }

  .badge-xp-float {
    position: absolute;
    top: calc(-18px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    color: #ffd700;
    white-space: nowrap;
    animation: floatXP 600ms ease-out forwards;
    pointer-events: none;
  }

  @keyframes floatXP {
    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(calc(-20px * var(--layout-scale, 1))); }
  }

  .foe-legend {
    display: flex;
    flex-wrap: wrap;
    gap: calc(12px * var(--layout-scale, 1));
    justify-content: center;
    margin-top: calc(6px * var(--layout-scale, 1));
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .legend-dot {
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #8B949E;
    text-transform: capitalize;
  }

  /* ── Knowledge harvest ──────────────────────────────────────────────────── */
  .fact-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(22, 27, 34, 0.7);
    border-radius: calc(6px * var(--layout-scale, 1));
    margin-bottom: calc(4px * var(--layout-scale, 1));
    opacity: 0;
    transform: translateX(calc(-12px * var(--layout-scale, 1)));
    transition: opacity 300ms ease var(--row-delay, 0ms), transform 300ms ease var(--row-delay, 0ms);
  }

  .re-harvest.section-visible .fact-row {
    opacity: 1;
    transform: translateX(0);
  }

  .fact-dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
  }

  .fact-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8B949E;
    flex: 1;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .fact-count {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    color: #E6EDF3;
    min-width: calc(26px * var(--layout-scale, 1));
    text-align: right;
  }

  .fact-total {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8B949E;
    font-weight: 400;
  }

  .fact-bar {
    flex: 1;
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(139, 148, 158, 0.15);
    border-radius: calc(4px * var(--layout-scale, 1));
    overflow: hidden;
    min-width: calc(40px * var(--layout-scale, 1));
  }

  .fact-bar-fill {
    height: 100%;
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: width 600ms ease-out;
  }

  .fact-bar-fill.fact-bar-seen { background: #5DCAA5; }
  .fact-bar-fill.fact-bar-reviewing { background: #EF9F27; }
  .fact-bar-fill.fact-bar-mastered { background: #7F77DD; }

  .harvest-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: calc(8px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
    border-top: 1px solid rgba(139, 148, 158, 0.2);
  }

  .harvest-total-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    font-weight: 500;
  }

  .harvest-total-value {
    font-size: calc(14px * var(--text-scale, 1));
    color: #639922;
    font-weight: 600;
  }

  .fact-xp {
    font-size: calc(11px * var(--text-scale, 1));
    color: #fbbf24;
    font-weight: 600;
    min-width: calc(52px * var(--layout-scale, 1));
    text-align: right;
  }

  /* ── Stats section ──────────────────────────────────────────────────────── */
  .stats-grid {
    display: flex;
    flex-wrap: wrap;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(4px * var(--layout-scale, 1)) calc(9px * var(--layout-scale, 1));
    background: rgba(22, 27, 34, 0.8);
    border: 1px solid rgba(139, 148, 158, 0.25);
    border-radius: calc(20px * var(--layout-scale, 1));
    min-width: calc(60px * var(--layout-scale, 1));
  }

  .pill-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: #8B949E;
    text-transform: uppercase;
    letter-spacing: 1px;
    line-height: 1.2;
  }

  .pill-value {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #E6EDF3;
    line-height: 1.3;
  }

  .pill-context {
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  .bounty-pill {
    border-color: rgba(241, 196, 15, 0.4);
  }

  .bounty-pill .pill-label,
  .bounty-pill .pill-value {
    color: #f4d35e;
  }

  /* ── Reward tally ───────────────────────────────────────────────────────── */
  .tally-inner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: calc(14px * var(--layout-scale, 1));
    width: 100%;
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(239, 159, 39, 0.08);
    border: 1px solid rgba(239, 159, 39, 0.3);
    border-radius: calc(12px * var(--layout-scale, 1));
    box-shadow: 0 0 20px rgba(239, 159, 39, 0.1);
  }

  .tally-row {
    display: flex;
    align-items: center;
    gap: calc(7px * var(--layout-scale, 1));
  }

  .tally-icon {
    font-size: calc(16px * var(--text-scale, 1));
  }

  .tally-icon-img {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    object-fit: contain;
  }

  .tally-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #8B949E;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .tally-value {
    font-size: calc(26px * var(--text-scale, 1));
    font-weight: 800;
    color: #fbbf24;
    text-shadow: 0 0 15px rgba(251, 191, 36, 0.6), 0 0 30px rgba(251, 191, 36, 0.3);
  }

  .tally-divider {
    width: 1px;
    height: calc(30px * var(--layout-scale, 1));
    background: rgba(139, 148, 158, 0.3);
    flex-shrink: 0;
  }

  .level-up-banner {
    padding: calc(3px * var(--layout-scale, 1)) calc(9px * var(--layout-scale, 1));
    background: rgba(251, 191, 36, 0.15);
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #fbbf24;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .unlock-text {
    color: #4ecca3;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .grey-matter-award {
    color: #ffd89d;
    font-size: calc(11px * var(--text-scale, 1));
  }

  /* ── Buttons ────────────────────────────────────────────────────────────── */
  .re-buttons {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
    flex-shrink: 0;
    opacity: 0;
    transform: translateY(calc(14px * var(--layout-scale, 1)));
    transition: opacity 400ms ease, transform 400ms ease;
    cursor: default;
  }

  .re-buttons.section-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .btn {
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    transition: transform 0.1s, background 0.15s;
  }

  .btn:hover {
    transform: scale(1.02);
  }

  .btn-primary {
    padding: calc(14px * var(--layout-scale, 1)) 0;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 500;
    background: #27AE60;
    color: #fff;
  }

  .btn-primary:hover {
    background: #219a52;
  }

  .btn-ghost {
    padding: calc(10px * var(--layout-scale, 1)) 0;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 400;
    background: transparent;
    border: 1px solid rgba(139, 148, 158, 0.3);
    color: #8B949E;
  }

  .btn-ghost:hover {
    background: rgba(139, 148, 158, 0.1);
  }

  .btn-ghost:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Practice run notice ────────────────────────────────────────────────── */
  .practice-run-notice {
    text-align: center;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(100, 116, 139, 0.1);
    border: 1px solid rgba(100, 116, 139, 0.25);
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .practice-title {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #94a3b8;
    margin: 0 0 calc(3px * var(--layout-scale, 1));
  }

  .practice-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
    margin: 0 0 calc(2px * var(--layout-scale, 1));
  }

  .practice-tip {
    font-size: calc(10px * var(--text-scale, 1));
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  /* ── Reduced motion ─────────────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .re-header,
    .grade-badge,
    .grade-flavor,
    .grade-explanation,
    .enemy-badge-wrapper,
    .fact-row,
    .re-foes,
    .re-harvest,
    .re-stats,
    .re-tally,
    .re-buttons,
    .practice-run-notice {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
    }
    .run-end-overlay.victory-result::before,
    .run-end-overlay.victory-result::after {
      animation: none;
      display: none;
    }

  }

  :global([data-pw-animations='disabled']) .run-end-overlay .re-header,
  :global([data-pw-animations='disabled']) .run-end-overlay .grade-badge,
  :global([data-pw-animations='disabled']) .run-end-overlay .grade-flavor,
  :global([data-pw-animations='disabled']) .run-end-overlay .grade-explanation,
  :global([data-pw-animations='disabled']) .run-end-overlay .enemy-badge-wrapper,
  :global([data-pw-animations='disabled']) .run-end-overlay .fact-row,
  :global([data-pw-animations='disabled']) .run-end-overlay .re-foes,
  :global([data-pw-animations='disabled']) .run-end-overlay .re-harvest,
  :global([data-pw-animations='disabled']) .run-end-overlay .re-stats,
  :global([data-pw-animations='disabled']) .run-end-overlay .re-tally,
  :global([data-pw-animations='disabled']) .run-end-overlay .re-buttons,
  :global([data-pw-animations='disabled']) .run-end-overlay .practice-run-notice {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
</style>
