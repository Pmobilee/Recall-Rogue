<script lang="ts">
  import { onMount } from 'svelte';
  import {
    startProceduralSession,
    getNextQuestion,
    gradeProceduralAnswer,
  } from '../../services/math/proceduralQuizSession';
  import type { ProceduralSession, ProceduralQuizQuestion } from '../../services/math/proceduralQuizSession';
  import { getAllDecks } from '../../data/deckRegistry';

  interface Props {
    deckId: string;
    subDeckId?: string;
    onBack: () => void;
  }

  const { deckId, subDeckId, onBack }: Props = $props();

  // ── Session state ─────────────────────────────────────────────────────────

  let session = $state<ProceduralSession | null>(null);
  let currentQuestion = $state<ProceduralQuizQuestion | null>(null);
  let selectedAnswer = $state<string | null>(null);
  let showFeedback = $state(false);
  let isCorrect = $state(false);
  let sessionError = $state(false);

  // ── Stats ─────────────────────────────────────────────────────────────────

  let questionsAnswered = $state(0);
  let correctCount = $state(0);

  const accuracyPct = $derived(
    questionsAnswered === 0 ? 0 : Math.round((correctCount / questionsAnswered) * 100)
  );

  /** Shows ratio (0/1) for first 2 questions, then switches to % — avoids "0%" discouragement. */
  const displayAccuracy = $derived(
    questionsAnswered < 3 ? `${correctCount}/${questionsAnswered}` : `${accuracyPct}%`
  );

  // ── Deck metadata ─────────────────────────────────────────────────────────

  const deckEntry = $derived(getAllDecks().find(d => d.id === deckId) ?? null);
  const deckName = $derived(deckEntry?.name ?? deckId);

  /** Human-readable skill tier label. */
  function tierLabel(tier: string): string {
    switch (tier) {
      case '3': return 'Mastered';
      case '2b': return 'Advanced';
      case '2a': return 'Familiar';
      default: return 'Learning';
    }
  }

  /** CSS class for answer button based on feedback state. */
  function answerClass(answer: string): string {
    if (!showFeedback) return '';
    if (answer === currentQuestion?.correctAnswer) return 'correct';
    if (answer === selectedAnswer) return 'wrong';
    return '';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    const s = startProceduralSession(deckId, subDeckId);
    if (!s) {
      sessionError = true;
      return;
    }
    session = s;
    loadNextQuestion();
  });

  function loadNextQuestion(): void {
    if (!session) return;
    currentQuestion = getNextQuestion(session);
    selectedAnswer = null;
    showFeedback = false;
    isCorrect = false;
  }

  // ── Answer handling ───────────────────────────────────────────────────────

  const startTimeRef = { value: Date.now() };

  function selectAnswer(answer: string): void {
    if (showFeedback || !currentQuestion || !session) return;

    const responseTimeMs = Date.now() - startTimeRef.value;
    const correct = answer === currentQuestion.correctAnswer;

    selectedAnswer = answer;
    showFeedback = true;
    isCorrect = correct;

    gradeProceduralAnswer(session.deckId, currentQuestion.skillId, correct, responseTimeMs, session);
    questionsAnswered++;
    if (correct) correctCount++;

    setTimeout(() => {
      startTimeRef.value = Date.now();
      loadNextQuestion();
    }, 1200);
  }
</script>

<div class="procedural-study-screen">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1 class="deck-title">{deckName}</h1>
      {#if currentQuestion}
        <span class="tier-badge tier-{currentQuestion.tier}">
          {tierLabel(currentQuestion.tier)}
        </span>
        <span class="skill-label">{currentQuestion.skillId.replace(/_/g, ' ')}</span>
      {/if}
    </div>
    <div class="header-stats">
      <span class="stat-item">
        <span class="stat-value">{questionsAnswered}</span>
        <span class="stat-label">answered</span>
      </span>
      <span class="stat-item">
        <span class="stat-value">{displayAccuracy}</span>
        <span class="stat-label">{questionsAnswered < 3 ? 'correct' : 'accuracy'}</span>
      </span>
      <button class="stop-btn" type="button" onclick={onBack} aria-label="Stop practice session">
        Stop
      </button>
    </div>
  </div>

  <!-- Main content -->
  <div class="content">
    {#if sessionError}
      <div class="error-state">
        <p class="error-title">Could not start practice session</p>
        <p class="error-sub">Deck "{deckId}" is not registered as a procedural deck.</p>
        <button class="btn-back-error" type="button" onclick={onBack}>Go Back</button>
      </div>
    {:else if currentQuestion}
      <div class="question-card">
        <p class="question-text">{currentQuestion.question}</p>

        <div class="answers-list">
          {#each currentQuestion.answers as answer (answer)}
            <button
              class="answer-btn {answerClass(answer)}"
              type="button"
              onclick={() => selectAnswer(answer)}
              disabled={showFeedback}
            >
              {answer}
            </button>
          {/each}
        </div>

        {#if showFeedback && currentQuestion}
          <div class="feedback-row" class:feedback-correct={isCorrect} class:feedback-wrong={!isCorrect}>
            <span class="feedback-icon">{isCorrect ? '✓' : '✗'}</span>
            <span class="feedback-text">
              {isCorrect ? 'Correct!' : 'Wrong'}
              {#if !isCorrect}
                — answer: {currentQuestion.correctAnswer}
              {/if}
            </span>
            <span class="srs-badge" class:srs-plus={isCorrect} class:srs-minus={!isCorrect}>
              SRS {isCorrect ? '+' : '−'}
            </span>
          </div>
          {#if currentQuestion.explanation}
            <p class="explanation-text">{currentQuestion.explanation}</p>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="loading-state">
        <p>Loading next question…</p>
      </div>
    {/if}
  </div>

  <!-- Progress bar (correct answers) -->
  {#if questionsAnswered > 0}
    <div class="bottom-bar">
      <div class="progress-track" role="progressbar" aria-valuenow={accuracyPct} aria-valuemin={0} aria-valuemax={100}>
        <div class="progress-fill" style="width: {accuracyPct}%;"></div>
      </div>
      <span class="progress-label">{correctCount} / {questionsAnswered} correct</span>
    </div>
  {/if}
</div>

<style>
  .procedural-study-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, #050810 0%, #0f1624 50%, #050810 100%);
    color: #e0e0e0;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(14px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    background: rgba(8, 10, 20, 0.9);
    border-bottom: 1px solid rgba(99, 102, 241, 0.18);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    min-width: 0;
  }

  .deck-title {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #818cf8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tier-badge {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .tier-1  { background: rgba(100, 116, 139, 0.35); color: #94a3b8; }
  .tier-2a { background: rgba(148, 163, 184, 0.25); color: #cbd5e1; }
  .tier-2b { background: rgba(192, 192, 192, 0.2);  color: #e2e8f0; }
  .tier-3  { background: rgba(234, 179, 8, 0.25);   color: #fbbf24; }

  .skill-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #4b5563;
    text-transform: capitalize;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-stats {
    display: flex;
    align-items: center;
    gap: calc(20px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(1px * var(--layout-scale, 1));
  }

  .stat-value {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    line-height: 1;
  }

  .stat-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stop-btn {
    padding: calc(8px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    min-width: calc(64px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
  }

  .stop-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.7);
  }

  /* ── Content ── */
  .content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(24px * var(--layout-scale, 1));
    overflow-y: auto;
    min-height: 0;
  }

  .question-card {
    width: 100%;
    max-width: calc(680px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(20px * var(--layout-scale, 1));
  }

  .question-text {
    font-size: calc(32px * var(--text-scale, 1));
    font-weight: 700;
    color: #f1f5f9;
    text-align: center;
    line-height: 1.3;
    margin: 0;
    padding: calc(24px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(12px * var(--layout-scale, 1));
  }

  /* ── Answers ── */
  .answers-list {
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .answer-btn {
    width: 100%;
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #cbd5e1;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    min-height: calc(52px * var(--layout-scale, 1));
  }

  .answer-btn:not(:disabled):hover {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: #e2e8f0;
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-btn.correct {
    background: rgba(74, 222, 128, 0.18);
    border-color: rgba(74, 222, 128, 0.6);
    color: #4ade80;
    font-weight: 700;
  }

  .answer-btn.wrong {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  /* ── Feedback row ── */
  .feedback-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    font-weight: 600;
    font-size: calc(15px * var(--text-scale, 1));
    animation: feedback-appear 0.15s ease;
  }

  .feedback-correct {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }

  .feedback-wrong {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .feedback-icon {
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1;
  }

  .feedback-text {
    flex: 1;
    font-size: calc(14px * var(--text-scale, 1));
  }

  .srs-badge {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(2px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .srs-plus  { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
  .srs-minus { background: rgba(239, 68, 68, 0.2);  color: #ef4444; }

  .explanation-text {
    font-size: calc(13px * var(--text-scale, 1));
    color: #64748b;
    line-height: 1.5;
    margin: 0;
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border-radius: calc(6px * var(--layout-scale, 1));
    border-left: calc(3px * var(--layout-scale, 1)) solid rgba(99, 102, 241, 0.3);
  }

  /* ── Error / loading states ── */
  .error-state,
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    color: #4b5563;
    text-align: center;
  }

  .error-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .error-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: #4b5563;
    margin: 0;
  }

  .btn-back-error {
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #818cf8;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  /* ── Bottom progress bar ── */
  .bottom-bar {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    background: rgba(8, 10, 20, 0.8);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .progress-track {
    flex: 1;
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border-radius: calc(3px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(3px * var(--layout-scale, 1));
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #4b5563;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @keyframes feedback-appear {
    from { opacity: 0; transform: translateY(calc(4px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback-row {
      animation: none;
    }
    .progress-fill,
    .answer-btn {
      transition: none;
    }
  }
</style>
