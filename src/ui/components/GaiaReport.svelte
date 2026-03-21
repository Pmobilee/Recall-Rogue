<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import RadarChart from './RadarChart.svelte'
  import SparklineChart from './SparklineChart.svelte'
  import LearningInsightsTab from './LearningInsightsTab.svelte'
  import { getEffectiveArchetype } from '../../services/archetypeDetector'
  import { getMasteryLevel } from '../../services/sm2'
  import { CATEGORIES } from '../../data/types'
  import { factsDB } from '../../services/factsDB'

  interface Props {
    onBack: () => void
  }

  const { onBack }: Props = $props()

  /** Active tab: 'report' (default) or 'learning'. */
  let activeTab = $state<'report' | 'learning'>('report')

  /** Category map populated from factsDB for each learned fact. */
  const factCategoryMap = $derived.by((): Map<string, string> => {
    const map = new Map<string, string>()
    if (!factsDB.isReady()) return map
    const s = $playerSave
    if (!s) return map
    for (const rs of s.reviewStates) {
      const fact = factsDB.getById(rs.factId)
      if (fact) map.set(fact.id, fact.category[0])
    }
    return map
  })

  const save = $derived($playerSave)

  const ARCHETYPE_ICONS: Record<string, string> = {
    explorer: 'E',
    scholar: 'S',
    collector: 'C',
    sprinter: 'R',
  }

  const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
    explorer: 'You love going deep and discovering new biomes.',
    scholar: 'You focus on mastering knowledge above all.',
    collector: 'You aim to collect every fact and fossil.',
    sprinter: 'You play fast and furious, racking up dives.',
  }

  const archetype = $derived(
    save?.archetypeData ? getEffectiveArchetype(save.archetypeData) : 'undetected'
  )

  // Summary stats
  const totalLearned = $derived(save?.learnedFacts.length ?? 0)
  const totalMastered = $derived(
    save?.reviewStates.filter(rs => getMasteryLevel(rs) === 'mastered').length ?? 0
  )
  const accuracyRate = $derived((): number => {
    if (!save) return 0
    const total = save.stats.totalQuizCorrect + save.stats.totalQuizWrong
    return total > 0 ? Math.round(100 * save.stats.totalQuizCorrect / total) : 0
  })
  const totalDives = $derived(save?.stats.totalDivesCompleted ?? 0)
  const deepestLayer = $derived(save?.stats.bestFloor ?? 0)
  const streak = $derived(save?.stats.currentStreak ?? 0)

  const createdDate = $derived((): string => {
    if (!save) return '—'
    return new Date(save.createdAt).toLocaleDateString()
  })

  // Category breakdown for radar chart — uses canonical CATEGORIES from types.ts
  const radarValues = $derived((): number[] => {
    if (!save || !factsDB.isReady()) return CATEGORIES.map(() => 0)
    // Count mastered facts per category
    const masteredPerCat = new Map<string, number>()
    const learnedPerCat = new Map<string, number>()
    for (const cat of CATEGORIES) {
      masteredPerCat.set(cat, 0)
      learnedPerCat.set(cat, 0)
    }
    for (const rs of save.reviewStates) {
      const fact = factsDB.getById(rs.factId)
      if (!fact) continue
      const cat = fact.category[0]
      if (!learnedPerCat.has(cat)) continue
      learnedPerCat.set(cat, (learnedPerCat.get(cat) ?? 0) + 1)
      if (getMasteryLevel(rs) === 'mastered') {
        masteredPerCat.set(cat, (masteredPerCat.get(cat) ?? 0) + 1)
      }
    }
    // Return ratio of mastered / learned per category (0 if no learned facts in category)
    return [...CATEGORIES].map(cat => {
      const learned = learnedPerCat.get(cat) ?? 0
      if (learned === 0) return 0
      return (masteredPerCat.get(cat) ?? 0) / learned
    })
  })

  // 30-day activity sparkline — uses lastReviewAt field from ReviewState
  const last30Days = $derived((): number[] => {
    if (!save) return Array(30).fill(0) as number[]
    const now = new Date()
    const days: number[] = []
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      const dayStr = day.toISOString().split('T')[0]
      // Count review states that were last reviewed on this day
      const count = save.reviewStates.filter(rs => {
        if (!rs.lastReviewAt) return false
        const rDate = new Date(rs.lastReviewAt).toISOString().split('T')[0]
        return rDate === dayStr
      }).length
      days.push(count)
    }
    return days
  })

  /** Count of non-zero days in the 30-day activity data. */
  const activityDataPointCount = $derived(last30Days().filter(v => v > 0).length)

  // Weekly summary
  const weeklySummary = $derived((): string => {
    if (!save) return ''
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const thisWeekLearned = save.reviewStates.filter(rs => {
      return rs.repetitions >= 1 && rs.lastReviewAt > weekAgo
    }).length
    const thisWeekMastered = save.reviewStates.filter(rs => {
      return getMasteryLevel(rs) === 'mastered' && rs.lastReviewAt > weekAgo
    }).length
    const depthMsg = save.stats.bestFloor >= 10
      ? `You've reached the mid-depths — tougher enemies and rarer relics await.`
      : `Keep delving to unlock deeper floors and rarer relics.`
    return `This week you learned ${thisWeekLearned} new fact${thisWeekLearned !== 1 ? 's' : ''} and mastered ${thisWeekMastered}. ${depthMsg}`
  })

  function handleShare(): void {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dark background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, 600, 400)

    // Border
    ctx.strokeStyle = '#4ecca3'
    ctx.lineWidth = 2
    ctx.strokeRect(4, 4, 592, 392)

    // Title
    ctx.fillStyle = '#4ecca3'
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('G.A.I.A. LEARNING REPORT', 300, 40)

    // Stats
    ctx.fillStyle = '#e0c97f'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    const stats = [
      `Facts Learned: ${totalLearned}`,
      `Facts Mastered: ${totalMastered}`,
      `Accuracy: ${accuracyRate()}%`,
      `Total Dives: ${totalDives}`,
      `Deepest Layer: ${deepestLayer}`,
      `Day Streak: ${streak}`,
    ]
    stats.forEach((s, i) => {
      ctx.fillText(s, 40, 80 + i * 28)
    })

    // Footer
    ctx.fillStyle = '#555'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Recall Rogue — Mine. Discover. Learn.', 300, 380)

    // Download
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'recall-rogue-report.png'
    a.click()
  }
</script>

<div class="report-view">
  <div class="report-header">
    <button class="back-btn" onclick={onBack}>← Back</button>
    <h1 class="report-title">G.A.I.A. LEARNING REPORT</h1>
  </div>

  <!-- Tab bar -->
  <div class="tab-bar" role="tablist">
    <button
      class="tab-btn"
      class:active={activeTab === 'report'}
      onclick={() => activeTab = 'report'}
      aria-selected={activeTab === 'report'}
      role="tab"
    >
      Overview
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'learning'}
      onclick={() => activeTab = 'learning'}
      aria-selected={activeTab === 'learning'}
      role="tab"
    >
      My Learning
    </button>
  </div>

  {#if activeTab === 'learning'}
    <LearningInsightsTab factCategories={factCategoryMap} />
  {:else}
  <div class="report-scroll">
    <p class="since">Explorer since: {createdDate()}</p>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-box">
        <span class="stat-value">{totalLearned}</span>
        <span class="stat-label">Facts Learned</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{totalMastered}</span>
        <span class="stat-label">Mastered</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{accuracyRate()}%</span>
        <span class="stat-label">Accuracy</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{totalDives}</span>
        <span class="stat-label">Total Dives</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{deepestLayer}</span>
        <span class="stat-label">Max Layer</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{streak}</span>
        <span class="stat-label">Day Streak</span>
      </div>
    </div>

    <!-- Archetype display -->
    {#if archetype !== 'undetected'}
      <section class="archetype-section">
        <h3>Your Archetype</h3>
        <div class="archetype-badge">
          <span class="archetype-icon">{ARCHETYPE_ICONS[archetype]}</span>
          <div class="archetype-info">
            <span class="archetype-name">{archetype.charAt(0).toUpperCase() + archetype.slice(1)}</span>
            <span class="archetype-desc">{ARCHETYPE_DESCRIPTIONS[archetype]}</span>
          </div>
        </div>
      </section>
    {/if}

    <!-- Radar chart -->
    <div class="chart-section">
      <h2 class="section-title">Category Mastery</h2>
      <div class="chart-center">
        <RadarChart labels={[...CATEGORIES]} values={radarValues()} size={260} />
      </div>
      <p class="chart-caption">Relative mastery by category</p>
    </div>

    <!-- Sparkline -->
    <div class="chart-section">
      <h2 class="section-title">30-Day Activity</h2>
      {#if activityDataPointCount < 3}
        <p class="chart-empty-state">
          No activity data yet. Keep diving and studying to see your trends here!
        </p>
      {:else}
        <div class="chart-center">
          <SparklineChart dailyActivity={last30Days()} width={320} height={60} />
        </div>
      {/if}
    </div>

    <!-- Weekly summary -->
    <div class="summary-section">
      <h2 class="section-title">Weekly Summary</h2>
      <p class="summary-text">"{weeklySummary()}"</p>
      <span class="summary-sig">— G.A.I.A.</span>
    </div>

    <!-- Share button -->
    <button class="share-btn" onclick={handleShare}>Share My Progress</button>
  </div>
  {/if}
</div>

<style>
  .report-view {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: #0a0a1a;
    display: flex;
    flex-direction: column;
    font-family: 'Press Start 2P', monospace;
    color: #ccc;
  }
  .report-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #222;
    gap: 12px;
  }
  .tab-bar {
    display: flex;
    border-bottom: 1px solid #222;
    background: #0a0a1a;
    flex-shrink: 0;
  }
  .tab-btn {
    flex: 1;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #666;
    font-family: inherit;
    font-size: 8px;
    cursor: pointer;
    padding: 8px 4px;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-btn.active {
    color: #4ecca3;
    border-bottom-color: #4ecca3;
  }
  .tab-btn:hover:not(.active) {
    color: #aaa;
  }
  .back-btn {
    background: none;
    border: none;
    color: #4ecca3;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .report-title {
    color: #4ecca3;
    font-size: 10px;
    margin: 0;
    flex: 1;
    text-align: center;
  }
  .report-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .since { color: #666; font-size: 7px; text-align: center; margin: 0; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat-box {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #222;
    border-radius: 4px;
    padding: 12px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-value { color: #e0c97f; font-size: 14px; }
  .stat-label { color: #666; font-size: 6px; }
  .chart-section { text-align: center; }
  .section-title { color: #4ecca3; font-size: 9px; margin: 0 0 12px; }
  .chart-center { display: flex; justify-content: center; }
  .chart-caption { color: #555; font-size: 7px; margin: 8px 0 0; }
  .chart-empty-state {
    color: rgba(255, 255, 255, 0.4);
    font-size: 8px;
    text-align: center;
    line-height: 1.6;
    padding: 16px 12px;
    margin: 0;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .summary-section { text-align: center; }
  .summary-text {
    color: #aaa;
    font-size: 8px;
    line-height: 1.6;
    font-style: italic;
    margin: 0;
  }
  .summary-sig { color: #4ecca3; font-size: 7px; }
  .archetype-section {
    background: #12122a;
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
  }
  .archetype-section h3 {
    font-size: 0.65rem;
    color: #4ecca3;
    margin: 0 0 8px 0;
  }
  .archetype-badge {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .archetype-icon {
    font-size: 1.2rem;
    font-weight: bold;
    color: #4ecca3;
    background: #1a3a2e;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  .archetype-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .archetype-name {
    font-size: 0.7rem;
    font-weight: bold;
    color: #e0e0e0;
  }
  .archetype-desc {
    font-size: 0.5rem;
    color: #888;
    line-height: 1.3;
  }
  .share-btn {
    padding: 12px;
    background: rgba(78, 204, 163, 0.15);
    border: 1px solid #4ecca3;
    color: #4ecca3;
    border-radius: 4px;
    font-family: inherit;
    font-size: 9px;
    cursor: pointer;
    min-height: 44px;
    align-self: center;
    width: 80%;
  }
</style>
