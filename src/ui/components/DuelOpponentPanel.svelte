<!-- DuelOpponentPanel.svelte
     Real-Time Duel opponent state panel — left-side overlay shown during a Duel encounter.
     Displays opponent HP, damage contribution bar, chain state, last-turn summary,
     turn timer (circular SVG countdown), and enemy target indicator.

     All layout via calc() + --layout-scale / --text-scale. ZERO hardcoded px.
-->
<script lang="ts">
  interface LastTurnSummary {
    cardsPlayed: number
    damageDealt: number
    quizResult: 'correct' | 'wrong' | 'quick_play'
  }

  interface Props {
    /** Opponent's display name */
    opponentName: string
    /** Opponent's current HP */
    opponentHp: number
    /** Opponent's max HP */
    opponentMaxHp: number
    /** Total damage dealt by the local player across all turns */
    localDamageTotal: number
    /** Total damage dealt by the opponent across all turns */
    opponentDamageTotal: number
    /** Opponent's current chain length */
    opponentChainLength: number
    /** Opponent's active chain color name (e.g. "Crimson") */
    opponentChainColor?: string
    /** Summary of the opponent's last completed turn */
    lastTurnSummary?: LastTurnSummary
    /** Seconds remaining on the current turn timer */
    turnTimerSecs: number
    /** Maximum seconds for the turn timer (from house rules) */
    turnTimerMax: number
    /** True when the enemy's next attack targets the local player */
    enemyTargetIsLocal: boolean
  }

  let {
    opponentName,
    opponentHp,
    opponentMaxHp,
    localDamageTotal,
    opponentDamageTotal,
    opponentChainLength,
    opponentChainColor = 'Obsidian',
    lastTurnSummary,
    turnTimerSecs,
    turnTimerMax,
    enemyTargetIsLocal,
  }: Props = $props()

  // ── Derived values ──────────────────────────────────────────────────────────

  /** Opponent HP as 0-100 percentage */
  let hpPercent = $derived(
    opponentMaxHp > 0
      ? Math.max(0, Math.min(100, (opponentHp / opponentMaxHp) * 100))
      : 0
  )

  /** HP bar gradient color based on remaining percentage */
  let hpColor = $derived(
    hpPercent > 50 ? '#27ae60' : hpPercent > 25 ? '#e67e22' : '#e74c3c'
  )

  /** Combined damage total for contribution bar */
  let combinedDamage = $derived(localDamageTotal + opponentDamageTotal)

  /** Local player's damage contribution as 0-100 percentage */
  let localContribPct = $derived(
    combinedDamage > 0
      ? Math.round((localDamageTotal / combinedDamage) * 100)
      : 50
  )

  /** Opponent's damage contribution as 0-100 percentage */
  let opponentContribPct = $derived(100 - localContribPct)

  /** Chain color dot hex */
  let chainDotColor = $derived(chainColorToHex(opponentChainColor ?? 'Obsidian'))

  /** Turn timer as 0-100 percentage (100 = full time remaining) */
  let timerPercent = $derived(
    turnTimerMax > 0
      ? Math.max(0, Math.min(100, (turnTimerSecs / turnTimerMax) * 100))
      : 0
  )

  /** SVG circle circumference for stroke-dashoffset animation */
  const TIMER_RADIUS = 18
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

  /** Stroke offset: 0 = full ring, circumference = empty ring */
  let timerDashOffset = $derived(
    TIMER_CIRCUMFERENCE * (1 - timerPercent / 100)
  )

  /** Timer color: green → amber → red as time runs low */
  let timerColor = $derived(
    timerPercent > 50 ? '#2ecc71' : timerPercent > 20 ? '#e67e22' : '#e74c3c'
  )

  /** Quiz result label and color */
  let quizResultLabel = $derived((): string => {
    if (!lastTurnSummary) return ''
    switch (lastTurnSummary.quizResult) {
      case 'correct': return 'Correct'
      case 'wrong': return 'Wrong'
      case 'quick_play': return 'Quick Play'
      default: return ''
    }
  })

  let quizResultClass = $derived((): string => {
    if (!lastTurnSummary) return ''
    return lastTurnSummary.quizResult
  })

  /**
   * Map chain color name to a display hex.
   * Mirrors the chain color system used throughout the game.
   */
  function chainColorToHex(colorName: string): string {
    const MAP: Record<string, string> = {
      Crimson: '#e74c3c',
      Obsidian: '#8e44ad',
      Azure: '#2980b9',
      Emerald: '#27ae60',
      Amber: '#e67e22',
      Silver: '#95a5a6',
      Gold: '#f1c40f',
      Violet: '#9b59b6',
      Sapphire: '#1abc9c',
      Scarlet: '#c0392b',
    }
    return MAP[colorName] ?? '#8e44ad'
  }
</script>

<aside
  class="duel-opponent-panel"
  aria-label="Opponent: {opponentName}"
  
>
  <!-- ── Opponent Header ──────────────────────────────────────────────── -->
  <div class="section opponent-header">
    <div class="opponent-name" title={opponentName}>{opponentName}</div>
    <div
      class="hp-bar-wrap"
      role="progressbar"
      aria-label="Opponent HP {opponentHp} of {opponentMaxHp}"
      aria-valuenow={opponentHp}
      aria-valuemin={0}
      aria-valuemax={opponentMaxHp}
    >
      <div
        class="hp-fill"
        style="width: {hpPercent}%; background: linear-gradient(to right, {hpColor}aa, {hpColor});"
      ></div>
    </div>
    <div class="hp-numbers" aria-live="polite">
      <span class="hp-current">{opponentHp}</span>
      <span class="hp-slash">/</span>
      <span class="hp-max">{opponentMaxHp}</span>
    </div>
  </div>

  <!-- ── Damage Contribution Bar ─────────────────────────────────────── -->
  <div class="section contribution-section">
    <div class="section-label">Damage Contribution</div>
    <div
      class="contribution-bar"
      role="img"
      aria-label="You {localContribPct}%, them {opponentContribPct}%"
    >
      <!-- Local player segment (left, blue-ish) -->
      <div
        class="contrib-fill contrib-local"
        style="width: {localContribPct}%;"
      ></div>
      <!-- Opponent segment (right, red-ish) -->
      <div
        class="contrib-fill contrib-opponent"
        style="width: {opponentContribPct}%;"
      ></div>
    </div>
    <div class="contrib-labels" aria-hidden="true">
      <span class="contrib-label contrib-label-local">You: {localContribPct}%</span>
      <span class="contrib-label contrib-label-opponent">Them: {opponentContribPct}%</span>
    </div>
  </div>

  <!-- ── Chain State ──────────────────────────────────────────────────── -->
  <div class="section chain-section">
    <div class="section-label">Chain</div>
    <div class="chain-display" aria-label="Chain length {opponentChainLength}, color {opponentChainColor}">
      <span
        class="chain-dot"
        style="background: {chainDotColor}; box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) {chainDotColor}80;"
        aria-hidden="true"
      ></span>
      <span class="chain-length">{opponentChainLength}</span>
      <span class="chain-color-name">{opponentChainColor}</span>
    </div>
  </div>

  <!-- ── Last Turn Summary ────────────────────────────────────────────── -->
  <div class="section last-turn-section" aria-label="Last turn summary">
    <div class="section-label">Last Turn</div>
    {#if lastTurnSummary}
      <div class="last-turn-grid">
        <div class="turn-stat">
          <span class="turn-stat-val">{lastTurnSummary.cardsPlayed}</span>
          <span class="turn-stat-label">Cards</span>
        </div>
        <div class="turn-stat">
          <span class="turn-stat-val">{lastTurnSummary.damageDealt}</span>
          <span class="turn-stat-label">Damage</span>
        </div>
        <div class="turn-stat quiz-result-stat">
          <span
            class="quiz-result-pill {quizResultClass()}"
            aria-label="Quiz result: {quizResultLabel()}"
          >
            {quizResultLabel()}
          </span>
        </div>
      </div>
    {:else}
      <div class="no-turns-yet">No turns yet</div>
    {/if}
  </div>

  <!-- ── Turn Timer ───────────────────────────────────────────────────── -->
  <div class="section timer-section" aria-label="Turn timer">
    <div class="section-label">Turn Timer</div>
    <div class="timer-wrap">
      <svg
        class="timer-ring"
        viewBox="0 0 44 44"
        aria-hidden="true"
        width="calc(44px * var(--layout-scale, 1))"
        height="calc(44px * var(--layout-scale, 1))"
      >
        <!-- Track ring -->
        <circle
          class="timer-track"
          cx="22"
          cy="22"
          r={TIMER_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          stroke-width="4"
        />
        <!-- Progress ring -->
        <circle
          class="timer-progress"
          cx="22"
          cy="22"
          r={TIMER_RADIUS}
          fill="none"
          stroke={timerColor}
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray={TIMER_CIRCUMFERENCE}
          stroke-dashoffset={timerDashOffset}
          transform="rotate(-90 22 22)"
          style="transition: stroke-dashoffset 1s linear, stroke 0.5s ease;"
        />
      </svg>
      <div class="timer-text" aria-live="polite" style="color: {timerColor};">
        {turnTimerSecs}
      </div>
    </div>
  </div>

  <!-- ── Enemy Target Indicator ───────────────────────────────────────── -->
  <div
    class="section target-section"
    class:targeting-local={enemyTargetIsLocal}
    class:targeting-opponent={!enemyTargetIsLocal}
    aria-live="polite"
    aria-label="Enemy attacking: {enemyTargetIsLocal ? 'You' : 'Opponent'}"
  >
    <div class="section-label">Enemy Targeting</div>
    <div class="target-display">
      <span class="target-arrow" aria-hidden="true">
        {enemyTargetIsLocal ? '⚔' : '→'}
      </span>
      <span class="target-text">
        {enemyTargetIsLocal ? 'Attacking: YOU' : 'Attacking: OPPONENT'}
      </span>
    </div>
  </div>
</aside>

<style>
  /* ── Root panel ── */
  .duel-opponent-panel {
    position: fixed;
    top: 50%;
    left: calc(16px * var(--layout-scale, 1));
    transform: translateY(-50%);
    width: calc(280px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    background: rgba(8, 11, 22, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(12px * var(--layout-scale, 1));
    backdrop-filter: blur(12px);
    z-index: 120;
    font-family: var(--font-body, 'Lora', serif);
    color: #e0e0e0;
    overflow: hidden;
    /* Glass highlight on top edge */
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 calc(4px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0,0,0,0.6);
  }

  /* ── Shared section chrome ── */
  .section {
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section:last-child {
    border-bottom: none;
  }

  .section-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    margin-bottom: calc(6px * var(--layout-scale, 1));
    font-weight: 600;
  }

  /* ── Opponent Header ── */
  .opponent-header {
    padding-top: calc(14px * var(--layout-scale, 1));
  }

  .opponent-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    color: #f0f0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: calc(8px * var(--layout-scale, 1));
    letter-spacing: calc(0.3px * var(--layout-scale, 1));
  }

  .hp-bar-wrap {
    height: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(4px * var(--layout-scale, 1));
    overflow: hidden;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .hp-fill {
    height: 100%;
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: width 0.5s ease;
  }

  .hp-numbers {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.45);
    text-align: right;
  }

  .hp-current {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .hp-slash {
    margin: 0 calc(2px * var(--layout-scale, 1));
    color: rgba(255, 255, 255, 0.2);
  }

  .hp-max {
    color: rgba(255, 255, 255, 0.35);
  }

  /* ── Contribution Bar ── */
  .contribution-bar {
    display: flex;
    height: calc(18px * var(--layout-scale, 1));
    border-radius: calc(9px * var(--layout-scale, 1));
    overflow: hidden;
    background: rgba(255,255,255,0.05);
    margin-bottom: calc(6px * var(--layout-scale, 1));
    gap: calc(1px * var(--layout-scale, 1));
  }

  .contrib-fill {
    height: 100%;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .contrib-local {
    /* "You" color: electric blue gradient */
    background: linear-gradient(to right, #1a6fb5, #2980b9);
    border-radius: calc(9px * var(--layout-scale, 1)) 0 0 calc(9px * var(--layout-scale, 1));
  }

  .contrib-opponent {
    /* "Them" color: warm red gradient */
    background: linear-gradient(to right, #c0392b, #e74c3c);
    border-radius: 0 calc(9px * var(--layout-scale, 1)) calc(9px * var(--layout-scale, 1)) 0;
  }

  .contrib-labels {
    display: flex;
    justify-content: space-between;
  }

  .contrib-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
  }

  .contrib-label-local {
    color: #3498db;
  }

  .contrib-label-opponent {
    color: #e74c3c;
  }

  /* ── Chain State ── */
  .chain-display {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .chain-dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
  }

  .chain-length {
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    color: #fff;
    line-height: 1;
  }

  .chain-color-name {
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  /* ── Last Turn Summary ── */
  .last-turn-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: calc(6px * var(--layout-scale, 1));
    align-items: center;
  }

  .turn-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .turn-stat-val {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #f0f0f0;
    line-height: 1;
  }

  .turn-stat-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
  }

  .quiz-result-stat {
    align-items: flex-start;
  }

  .quiz-result-pill {
    display: inline-block;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 600;
    padding: calc(3px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .quiz-result-pill.correct {
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border-color: rgba(46, 204, 113, 0.3);
  }

  .quiz-result-pill.wrong {
    background: rgba(231, 76, 60, 0.15);
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.3);
  }

  .quiz-result-pill.quick_play {
    background: rgba(150, 150, 150, 0.12);
    color: #aaa;
    border-color: rgba(150, 150, 150, 0.2);
  }

  .no-turns-yet {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
  }

  /* ── Turn Timer ── */
  .timer-section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .timer-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(52px * var(--layout-scale, 1));
    height: calc(52px * var(--layout-scale, 1));
  }

  .timer-ring {
    width: calc(52px * var(--layout-scale, 1));
    height: calc(52px * var(--layout-scale, 1));
    position: absolute;
    top: 0;
    left: 0;
  }

  .timer-text {
    position: absolute;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    transition: color 0.5s ease;
    z-index: 1;
  }

  /* ── Enemy Target Indicator ── */
  .target-section {
    border-bottom: none;
  }

  .target-display {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: background 0.3s ease;
  }

  .targeting-local .target-display {
    background: rgba(231, 76, 60, 0.14);
    border: 1px solid rgba(231, 76, 60, 0.3);
  }

  .targeting-opponent .target-display {
    background: rgba(52, 152, 219, 0.1);
    border: 1px solid rgba(52, 152, 219, 0.2);
  }

  .target-arrow {
    font-size: calc(16px * var(--text-scale, 1));
  }

  .targeting-local .target-arrow {
    color: #e74c3c;
    animation: pulse-warning 1.2s ease-in-out infinite;
  }

  .targeting-opponent .target-arrow {
    color: #3498db;
  }

  .target-text {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: calc(0.4px * var(--layout-scale, 1));
  }

  .targeting-local .target-text {
    color: #e74c3c;
  }

  .targeting-opponent .target-text {
    color: #7fb3d3;
  }

  @keyframes pulse-warning {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
</style>
