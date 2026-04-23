<!-- TriviaRoundScreen.svelte
     Full-screen overlay for Trivia Night rounds.
     Handles question display, answer selection, reveal animation, and final standings.
     Props: gameState, localPlayerId, currentQuestion, lastRoundResult, callbacks. -->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import type {
    TriviaGameState,
    TriviaQuestion,
    TriviaRoundResult,
    TriviaStanding,
  } from '../../services/triviaNightService'

  interface Props {
    gameState: TriviaGameState
    localPlayerId: string
    currentQuestion: TriviaQuestion | null
    lastRoundResult: TriviaRoundResult | null
    onAnswer: (selectedIndex: number, timingMs: number) => void
    onPlayAgain: () => void
    onReturnToLobby: () => void
    onReturnToHub: () => void
  }

  let {
    gameState,
    localPlayerId,
    currentQuestion,
    lastRoundResult,
    onAnswer,
    onPlayAgain,
    onReturnToLobby,
    onReturnToHub,
  }: Props = $props()

  // ── Local state ────────────────────────────────────────────────────────────

  /** Index the local player chose this round (-1 = none yet) */
  let localSelectedIndex = $state(-1)

  /** Timestamp when the current question was displayed (for timing calc) */
  let questionStartMs = $state(0)

  /** Seconds remaining on the current question timer */
  let timerSecondsLeft = $state(0)

  /** Interval handle for countdown tick */
  let timerInterval: ReturnType<typeof setInterval> | null = null

  /** Points earned pop-up value (null = hidden) */
  let pointsPopup = $state<number | null>(null)

  /** Whether to show the pop-up animation */
  let showPointsAnimation = $state(false)

  // ── Derived ────────────────────────────────────────────────────────────────

  /** Is the local player's answer locked in? */
  let hasAnswered = $derived(localSelectedIndex >= 0)

  /** Local player's result for the last round */
  let localAnswer = $derived(
    lastRoundResult?.playerAnswers.find(a => a.playerId === localPlayerId) ?? null,
  )

  /** Top 3 standings for mini-bar */
  let topThree = $derived(gameState.standings.slice(0, 3))

  /** Local player's rank */
  let localStanding = $derived(
    gameState.standings.find(s => s.playerId === localPlayerId) ?? null,
  )

  /** Timer pulse red when under 5 s */
  let timerCritical = $derived(timerSecondsLeft <= 5 && timerSecondsLeft > 0)

  /** SVG circle circumference (r=42) */
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 42

  /** Stroke-dashoffset drives the countdown ring (0=full, circumference=empty) */
  let timerDashoffset = $derived(
    currentQuestion
      ? CIRCLE_CIRCUMFERENCE * (1 - timerSecondsLeft / currentQuestion.timeLimit)
      : 0,
  )

  // ── Answer colors ──────────────────────────────────────────────────────────

  const OPTION_COLORS = ['#1a73e8', '#0f9d58', '#e37400', '#7b1fa2'] as const
  const OPTION_HOVER_COLORS = ['#2a83f8', '#1fad68', '#f38410', '#8b2fb2'] as const
  const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const

  // ── Effects ────────────────────────────────────────────────────────────────

  $effect(() => {
    // Reset local answer state when a new question arrives
    if (gameState.phase === 'question' && currentQuestion) {
      localSelectedIndex = -1
      questionStartMs = Date.now()
      startTimer(currentQuestion.timeLimit)
    }

    // Stop timer and show result when entering revealing phase
    if (gameState.phase === 'revealing') {
      stopTimer()
      if (localAnswer && localAnswer.pointsEarned > 0) {
        pointsPopup = localAnswer.pointsEarned
        showPointsAnimation = true
        setTimeout(() => { showPointsAnimation = false }, 2000)
      }
    }
  })

  // ── Timer helpers ──────────────────────────────────────────────────────────

  function startTimer(limitSecs: number): void {
    stopTimer()
    timerSecondsLeft = limitSecs
    timerInterval = setInterval(() => {
      timerSecondsLeft = Math.max(0, timerSecondsLeft - 1)
      if (timerSecondsLeft <= 0) {
        stopTimer()
        // Auto-submit timeout if not yet answered
        if (localSelectedIndex < 0) {
          handleAnswer(-1)
        }
      }
    }, 1000)
  }

  function stopTimer(): void {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  // Clean up interval on unmount to prevent timer leak.
  onDestroy(() => { stopTimer() })

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleAnswer(index: number): void {
    if (hasAnswered && index >= 0) return // already locked in, ignore double-click
    if (gameState.phase !== 'question') return
    localSelectedIndex = index
    const timingMs = Date.now() - questionStartMs
    onAnswer(index, timingMs)
  }

  // ── Reveal helpers ─────────────────────────────────────────────────────────

  function getOptionRevealClass(index: number): string {
    if (gameState.phase !== 'revealing' || !lastRoundResult) return ''
    if (index === lastRoundResult.correctIndex) return 'correct'
    if (index === localSelectedIndex) return 'wrong'
    return 'dimmed'
  }

  function formatMs(ms: number): string {
    return (ms / 1000).toFixed(1) + 's'
  }

  function formatAccuracy(s: TriviaStanding): string {
    if (s.totalAnswered === 0) return '—'
    return Math.round((s.correctCount / s.totalAnswered) * 100) + '%'
  }
</script>

<div class="trivia-screen" role="main" aria-label="Trivia Night">

  <!-- ── Top bar ─────────────────────────────────────────────────────────── -->
  <header class="top-bar" aria-label="Round progress and standings">
    <div class="round-counter" aria-live="polite">
      Round <strong>{gameState.currentRound}</strong> of {gameState.totalRounds}
    </div>

    <!-- Mini standings: top 3 -->
    <div class="mini-standings" role="list" aria-label="Top 3 standings">
      {#each topThree as standing (standing.playerId)}
        <div
          class="mini-player"
          class:is-local={standing.playerId === localPlayerId}
          role="listitem"
          aria-label="{standing.displayName}: {standing.totalPoints} points"
        >
          <span class="mini-rank">#{standing.rank}</span>
          <span class="mini-name">{standing.displayName}</span>
          <span class="mini-pts">{standing.totalPoints.toLocaleString()}</span>
        </div>
      {/each}
    </div>

    <!-- Local rank badge when outside top 3 -->
    {#if localStanding && localStanding.rank > 3}
      <div class="local-rank-badge" aria-label="Your rank: {localStanding.rank}">
        You #{localStanding.rank}
      </div>
    {/if}
  </header>

  <!-- ── Question phase ─────────────────────────────────────────────────── -->
  {#if gameState.phase === 'question' && currentQuestion}
    <div class="question-phase">

      <!-- Timer (circular, top-right) -->
      <div
        class="timer-ring"
        class:critical={timerCritical}
        aria-label="Time remaining: {timerSecondsLeft} seconds"
        role="timer"
      >
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle class="timer-track" cx="48" cy="48" r="42" />
          <circle
            class="timer-fill"
            cx="48"
            cy="48"
            r="42"
            stroke-dasharray={CIRCLE_CIRCUMFERENCE}
            stroke-dashoffset={timerDashoffset}
          />
        </svg>
        <span class="timer-label">{timerSecondsLeft}</span>
      </div>

      <!-- Question text -->
      <div class="question-text" role="heading" aria-level={2}>
        {currentQuestion.question}
      </div>

      <!-- 4 answer buttons in 2×2 grid -->
      <div class="options-grid" role="group" aria-label="Answer options">
        {#each currentQuestion.options as option, i}
          <button
            class="option-btn"
            class:selected={localSelectedIndex === i}
            class:answered={hasAnswered && localSelectedIndex !== i}
            style="--option-color: {OPTION_COLORS[i]}; --option-hover: {OPTION_HOVER_COLORS[i]}"
            onclick={() => handleAnswer(i)}
            disabled={hasAnswered}
            aria-pressed={localSelectedIndex === i}
            aria-label="Option {OPTION_LABELS[i]}: {option}"
          >
            <span class="option-label" aria-hidden="true">{OPTION_LABELS[i]}</span>
            <span class="option-text">{option}</span>
          </button>
        {/each}
      </div>

      {#if hasAnswered}
        <p class="waiting-text" aria-live="polite">Waiting for other players...</p>
      {/if}
    </div>

  <!-- ── Reveal phase ───────────────────────────────────────────────────── -->
  {:else if gameState.phase === 'revealing' && lastRoundResult && currentQuestion}
    <div class="reveal-phase">

      <!-- Question with highlighted answer -->
      <div class="question-text reveal" role="heading" aria-level={2}>
        {lastRoundResult.question}
      </div>

      <!-- Options with color coding -->
      <div class="options-grid" role="group" aria-label="Answer results">
        {#each currentQuestion.options as option, i}
          {@const revealClass = getOptionRevealClass(i)}
          <div
            class="option-btn reveal-option {revealClass}"
            style="--option-color: {OPTION_COLORS[i]}"
            role="img"
            aria-label="{OPTION_LABELS[i]}: {option}{i === lastRoundResult.correctIndex ? ' — Correct answer' : ''}"
          >
            <span class="option-label" aria-hidden="true">
              {#if i === lastRoundResult.correctIndex}
                ✓
              {:else if i === localSelectedIndex}
                ✗
              {:else}
                {OPTION_LABELS[i]}
              {/if}
            </span>
            <span class="option-text">{option}</span>
          </div>
        {/each}
      </div>

      <!-- Points earned pop-up -->
      {#if showPointsAnimation && pointsPopup !== null}
        <div class="points-popup" aria-live="assertive" aria-atomic="true">
          +{pointsPopup.toLocaleString()}
        </div>
      {/if}

      <!-- Per-player results mini-table -->
      <div class="round-results-table" aria-label="Round results">
        {#each lastRoundResult.playerAnswers as pa (pa.playerId)}
          <div
            class="result-row"
            class:correct={pa.correct}
            class:wrong={!pa.correct}
            class:is-local={pa.playerId === localPlayerId}
          >
            <span class="result-name">{pa.displayName}</span>
            <span class="result-verdict" aria-hidden="true">{pa.correct ? '✓' : '✗'}</span>
            <span class="result-timing">{pa.selectedIndex < 0 ? 'Timeout' : formatMs(pa.timingMs)}</span>
            <span class="result-pts">+{pa.pointsEarned.toLocaleString()}</span>
          </div>
        {/each}
      </div>
    </div>

  <!-- ── Final standings ────────────────────────────────────────────────── -->
  {:else if gameState.phase === 'finished'}
    <div class="final-phase">

      <!-- Winner spotlight -->
      {#if gameState.standings.length > 0}
        {@const winner = gameState.standings[0]}
        <div
          class="winner-spotlight"
          class:is-local-winner={winner.playerId === localPlayerId}
          aria-label="Winner: {winner.displayName} with {winner.totalPoints.toLocaleString()} points"
        >
          <div class="winner-crown" aria-hidden="true">&#9812;</div>
          <div class="winner-name">{winner.displayName}</div>
          <div class="winner-pts">{winner.totalPoints.toLocaleString()} pts</div>
          {#if winner.playerId === localPlayerId}
            <div class="confetti" aria-hidden="true">
              {#each Array(12) as _, i}
                <span class="confetti-piece" style="--i: {i}"></span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Full leaderboard table -->
      <div class="leaderboard" role="table" aria-label="Final leaderboard">
        <div class="lb-row lb-header" role="row">
          <span role="columnheader" class="lb-rank">Rank</span>
          <span role="columnheader" class="lb-name">Player</span>
          <span role="columnheader" class="lb-pts">Points</span>
          <span role="columnheader" class="lb-acc">Accuracy</span>
          <span role="columnheader" class="lb-avg">Avg Time</span>
        </div>
        {#each gameState.standings as standing (standing.playerId)}
          <div
            class="lb-row"
            class:lb-local={standing.playerId === localPlayerId}
            class:lb-gold={standing.rank === 1}
            class:lb-silver={standing.rank === 2}
            class:lb-bronze={standing.rank === 3}
            role="row"
            aria-label="Rank {standing.rank}: {standing.displayName}, {standing.totalPoints.toLocaleString()} points"
          >
            <span role="cell" class="lb-rank">{standing.rank}</span>
            <span role="cell" class="lb-name">{standing.displayName}</span>
            <span role="cell" class="lb-pts">{standing.totalPoints.toLocaleString()}</span>
            <span role="cell" class="lb-acc">{formatAccuracy(standing)}</span>
            <span role="cell" class="lb-avg">
              {standing.averageTimingMs > 0 ? formatMs(standing.averageTimingMs) : '—'}
            </span>
          </div>
        {/each}
      </div>

      <!-- Action buttons -->
      <div class="final-actions">
        <button class="action-btn primary" onclick={onPlayAgain}>Play Again</button>
        <button class="action-btn secondary" onclick={onReturnToLobby}>Return to Lobby</button>
        <button class="action-btn ghost" onclick={onReturnToHub}>Return to Hub</button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ── Root ────────────────────────────────────────────────────────────────── */
  .trivia-screen {
    position: fixed;
    inset: 0;
    background: #0d1117;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(20px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    z-index: 200;
    font-family: var(--font-body, 'Lora', serif);
    color: #e8eaf6;
    overflow-y: auto;
  }

  /* ── Top bar ─────────────────────────────────────────────────────────────── */
  .top-bar {
    width: 100%;
    max-width: calc(960px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .round-counter {
    font-size: calc(14px * var(--text-scale, 1));
    color: #9fa8da;
    white-space: nowrap;
    min-width: calc(100px * var(--layout-scale, 1));
  }

  .round-counter strong {
    font-size: calc(18px * var(--text-scale, 1));
    color: #e8eaf6;
  }

  .mini-standings {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    flex: 1;
    justify-content: center;
  }

  .mini-player {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    transition: border-color 0.2s;
  }

  .mini-player.is-local {
    border-color: #7c4dff;
    background: rgba(124, 77, 255, 0.12);
  }

  .mini-rank {
    color: #9fa8da;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .mini-name {
    color: #c5cae9;
    max-width: calc(80px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-pts {
    color: #ffd700;
    font-weight: 600;
    font-size: calc(13px * var(--text-scale, 1));
  }

  .local-rank-badge {
    font-size: calc(13px * var(--text-scale, 1));
    color: #7c4dff;
    background: rgba(124, 77, 255, 0.15);
    border: 1px solid rgba(124, 77, 255, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    white-space: nowrap;
  }

  /* ── Question phase ──────────────────────────────────────────────────────── */
  .question-phase {
    position: relative;
    width: 100%;
    max-width: calc(900px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(24px * var(--layout-scale, 1));
    flex: 1;
  }

  /* ── Timer ring ──────────────────────────────────────────────────────────── */
  .timer-ring {
    position: absolute;
    top: 0;
    right: 0;
    width: calc(80px * var(--layout-scale, 1));
    height: calc(80px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: filter 0.3s;
  }

  .timer-ring.critical {
    animation: pulse-ring 0.7s ease-in-out infinite;
  }

  @keyframes pulse-ring {
    0%, 100% { filter: drop-shadow(0 0 4px #e53935); }
    50% { filter: drop-shadow(0 0 12px #e53935); }
  }

  .timer-ring svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .timer-track {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 5;
  }

  .timer-fill {
    fill: none;
    stroke: #7c4dff;
    stroke-width: 5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.9s linear, stroke 0.3s;
  }

  .timer-ring.critical .timer-fill {
    stroke: #e53935;
  }

  .timer-label {
    position: relative;
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    color: #e8eaf6;
    transition: color 0.3s;
  }

  .timer-ring.critical .timer-label {
    color: #e53935;
  }

  /* ── Question text ───────────────────────────────────────────────────────── */
  .question-text {
    font-size: calc(22px * var(--text-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    color: #e8eaf6;
    text-align: center;
    line-height: 1.45;
    padding: calc(24px * var(--layout-scale, 1)) calc(80px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.08);
    width: 100%;
  }

  /* ── Options grid ────────────────────────────────────────────────────────── */
  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    background: var(--option-color, #1a73e8);
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(18px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.15s, opacity 0.2s, transform 0.1s;
    text-align: left;
    min-height: calc(64px * var(--layout-scale, 1));
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
  }

  .option-btn:hover:not(:disabled):not(.answered) {
    background: var(--option-hover, #2a83f8);
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
  }

  .option-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .option-btn.selected {
    outline: calc(3px * var(--layout-scale, 1)) solid #fff;
    outline-offset: calc(2px * var(--layout-scale, 1));
  }

  .option-btn.answered {
    opacity: 0.45;
    cursor: default;
  }

  .option-label {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .option-text {
    font-size: calc(15px * var(--text-scale, 1));
    color: #fff;
    line-height: 1.35;
  }

  .waiting-text {
    font-size: calc(14px * var(--text-scale, 1));
    color: #9fa8da;
    font-style: italic;
    margin: 0;
  }

  /* ── Reveal phase ────────────────────────────────────────────────────────── */
  .reveal-phase {
    position: relative;
    width: 100%;
    max-width: calc(900px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(20px * var(--layout-scale, 1));
    flex: 1;
  }

  .question-text.reveal {
    border-color: rgba(255, 255, 255, 0.14);
  }

  /* Reveal state classes applied to .option-btn div in reveal phase */
  .reveal-option {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(18px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    min-height: calc(64px * var(--layout-scale, 1));
    background: var(--option-color, #1a73e8);
    transition: opacity 0.4s, box-shadow 0.4s;
  }

  .reveal-option.correct {
    box-shadow: 0 0 calc(16px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) rgba(15, 157, 88, 0.7);
    background: #0f9d58;
  }

  .reveal-option.wrong {
    background: #c62828;
    opacity: 0.9;
  }

  .reveal-option.dimmed {
    opacity: 0.3;
  }

  /* Points pop-up */
  .points-popup {
    position: fixed;
    top: 30%;
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(48px * var(--text-scale, 1));
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-weight: 700;
    color: #ffd700;
    text-shadow: 0 0 calc(20px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.8);
    pointer-events: none;
    z-index: 300;
    animation: pop-up 2s ease-out forwards;
  }

  @keyframes pop-up {
    0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.7); }
    15% { opacity: 1; transform: translateX(-50%) translateY(calc(-10px * var(--layout-scale, 1))) scale(1.1); }
    30% { transform: translateX(-50%) translateY(calc(-6px * var(--layout-scale, 1))) scale(1); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(calc(-40px * var(--layout-scale, 1))) scale(0.9); }
  }

  /* Per-player round results */
  .round-results-table {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.25);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .result-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
  }

  .result-row.correct {
    background: rgba(15, 157, 88, 0.12);
  }

  .result-row.wrong {
    background: rgba(198, 40, 40, 0.12);
  }

  .result-row.is-local {
    border: 1px solid rgba(124, 77, 255, 0.4);
  }

  .result-name {
    color: #c5cae9;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-verdict {
    font-size: calc(16px * var(--text-scale, 1));
  }

  .result-row.correct .result-verdict { color: #4caf50; }
  .result-row.wrong .result-verdict { color: #ef5350; }

  .result-timing {
    color: #9fa8da;
    font-size: calc(13px * var(--text-scale, 1));
    min-width: calc(48px * var(--layout-scale, 1));
    text-align: right;
  }

  .result-pts {
    color: #ffd700;
    font-weight: 600;
    min-width: calc(60px * var(--layout-scale, 1));
    text-align: right;
  }

  /* ── Final phase ─────────────────────────────────────────────────────────── */
  .final-phase {
    width: 100%;
    max-width: calc(820px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(24px * var(--layout-scale, 1));
    padding-bottom: calc(32px * var(--layout-scale, 1));
  }

  /* Winner spotlight */
  .winner-spotlight {
    position: relative;
    text-align: center;
    padding: calc(28px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    background: rgba(255, 215, 0, 0.06);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: calc(16px * var(--layout-scale, 1));
    box-shadow: 0 0 calc(32px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.12);
    overflow: hidden;
    width: 100%;
  }

  .winner-spotlight.is-local-winner {
    background: rgba(255, 215, 0, 0.1);
    box-shadow: 0 0 calc(48px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.25);
  }

  .winner-crown {
    font-size: calc(48px * var(--text-scale, 1));
    line-height: 1;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .winner-name {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(28px * var(--text-scale, 1));
    color: #ffd700;
    letter-spacing: calc(2px * var(--layout-scale, 1));
  }

  .winner-pts {
    font-size: calc(18px * var(--text-scale, 1));
    color: #ffe57f;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  /* CSS confetti (local winner only) */
  .confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .confetti-piece {
    position: absolute;
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    top: -10%;
    left: calc(var(--i, 0) * 8.5%);
    background: hsl(calc(var(--i, 0) * 30deg), 80%, 60%);
    animation: confetti-fall calc((1.2 + var(--i, 0) * 0.1) * 1s) ease-in calc(var(--i, 0) * 0.07s) infinite;
  }

  @keyframes confetti-fall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(120%) rotate(360deg); opacity: 0; }
  }

  /* Leaderboard table */
  .leaderboard {
    width: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: calc(12px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .lb-row {
    display: grid;
    grid-template-columns:
      calc(52px * var(--layout-scale, 1))
      1fr
      calc(90px * var(--layout-scale, 1))
      calc(80px * var(--layout-scale, 1))
      calc(80px * var(--layout-scale, 1));
    align-items: center;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.15s;
  }

  .lb-row:last-child {
    border-bottom: none;
  }

  .lb-header {
    background: rgba(255, 255, 255, 0.05);
    font-size: calc(12px * var(--text-scale, 1));
    color: #9fa8da;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: calc(1px * var(--layout-scale, 1));
  }

  .lb-local {
    background: rgba(124, 77, 255, 0.12);
    border-left: calc(3px * var(--layout-scale, 1)) solid #7c4dff;
  }

  .lb-gold { background: rgba(255, 215, 0, 0.08); }
  .lb-silver { background: rgba(192, 192, 192, 0.06); }
  .lb-bronze { background: rgba(205, 127, 50, 0.06); }

  .lb-rank {
    color: #9fa8da;
    font-weight: 700;
    text-align: center;
  }

  .lb-gold .lb-rank { color: #ffd700; }
  .lb-silver .lb-rank { color: #c0c0c0; }
  .lb-bronze .lb-rank { color: #cd7f32; }

  .lb-name {
    color: #c5cae9;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lb-pts {
    color: #ffd700;
    font-weight: 700;
    text-align: right;
  }

  .lb-acc, .lb-avg {
    color: #9fa8da;
    text-align: right;
  }

  /* Final action buttons */
  .final-actions {
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-btn {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(15px * var(--text-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    border: none;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .action-btn:hover {
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .action-btn.primary {
    background: #7c4dff;
    color: #fff;
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(124, 77, 255, 0.4);
  }

  .action-btn.primary:hover {
    background: #9c6fff;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(124, 77, 255, 0.5);
  }

  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #c5cae9;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .action-btn.ghost {
    background: transparent;
    color: #7986cb;
    border: 1px solid rgba(121, 134, 203, 0.35);
  }

  .action-btn.ghost:hover {
    background: rgba(121, 134, 203, 0.1);
    color: #9fa8da;
  }
</style>
