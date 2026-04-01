<script lang="ts">
  import type { QuizQuestion } from '../../services/bossQuizPhase'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    questions: QuizQuestion[]
    oncomplete: (correctFactIds: string[]) => void
  }

  let { questions, oncomplete }: Props = $props()

  /** Returns a short label for a question to use in the upgrade preview. */
  function getUpgradeLabel(factId: string): string {
    const q = questions.find(q => q.factId === factId)
    if (!q) return factId
    // Show first 40 chars of the question as a card label
    const text = q.question ?? ''
    return text.length > 40 ? text.slice(0, 37) + '…' : text
  }

  let currentIndex = $state(0)
  let correctFactIds = $state<string[]>([])
  let selectedAnswer = $state<string | null>(null)
  let showFeedback = $state(false)
  let done = $state(false)

  let currentQuestion = $derived(questions[currentIndex] ?? null)

  function selectAnswer(answer: string): void {
    if (showFeedback) return
    selectedAnswer = answer
    showFeedback = true

    if (answer === currentQuestion?.correctAnswer && currentQuestion?.factId) {
      correctFactIds = [...correctFactIds, currentQuestion.factId]
    }

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        selectedAnswer = null
        showFeedback = false
        currentIndex++
      } else {
        done = true
      }
    }, 1200)
  }

  function handleContinue(): void {
    oncomplete(correctFactIds)
  }

  function getAnswerClass(answer: string): string {
    if (!showFeedback) return ''
    if (answer === currentQuestion?.correctAnswer) return 'correct'
    if (answer === selectedAnswer) return 'wrong'
    return ''
  }
</script>

<div class="study-overlay" class:landscape={$isLandscape}>
  <div class="study-card">
    {#if !done}
      <div class="question-header">
        <span class="question-number">Question {currentIndex + 1} / {questions.length}</span>
        <div class="progress-dots">
          {#each questions as _, i}
            <span class="dot" class:active={i === currentIndex} class:completed={i < currentIndex}></span>
          {/each}
        </div>
      </div>

      {#if currentQuestion}
        {#if currentQuestion.quizMode === 'image_question' && currentQuestion.imageAssetPath}
          <div class="study-quiz-image-container">
            <img src={currentQuestion.imageAssetPath} alt="Identify this" class="study-quiz-image" />
          </div>
        {/if}
        <p class="question-text">{currentQuestion.question}</p>

        {#key currentIndex}
        {#if currentQuestion.quizMode === 'image_answers' && currentQuestion.answerImagePaths?.length}
          <div class="answers-image-grid">
            {#each currentQuestion.answers as answer, i}
              <button
                class="answer-img-btn {getAnswerClass(answer)}"
                onclick={() => selectAnswer(answer)}
                disabled={showFeedback}
                aria-label="Choice {i + 1}: {answer}"
              >
                <span class="study-kbd-hint" aria-hidden="true">{i + 1}</span>
                <img src={currentQuestion.answerImagePaths![i]} alt="" class="study-flag-img" />
                {#if showFeedback}
                  <span class="study-image-label">{answer}</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
        <div class="answers-grid">
          {#each currentQuestion.answers as answer}
            <button
              class="answer-btn {getAnswerClass(answer)}"
              onclick={() => selectAnswer(answer)}
              disabled={showFeedback}
            >
              {answer}
            </button>
          {/each}
        </div>
        {/if}
        {/key}

        {#if showFeedback}
          <p class="feedback-text" class:feedback-correct={selectedAnswer === currentQuestion.correctAnswer} class:feedback-wrong={selectedAnswer !== currentQuestion.correctAnswer}>
            {selectedAnswer === currentQuestion.correctAnswer ? '✓ Correct!' : '✗ Wrong'}
            <span
              class="srs-indicator"
              class:srs-plus={selectedAnswer === currentQuestion.correctAnswer}
              class:srs-minus={selectedAnswer !== currentQuestion.correctAnswer}
            >SRS {selectedAnswer === currentQuestion.correctAnswer ? '+' : '-'}</span>
          </p>
        {/if}
      {/if}
    {:else}
      <div class="summary">
        <span class="summary-icon">{correctFactIds.length === questions.length ? '🎓' : correctFactIds.length > 0 ? '📖' : '😔'}</span>
        <h2 class="summary-title">Study Complete!</h2>
        <p class="summary-result">
          <span class="highlight">{correctFactIds.length}</span> of {questions.length} cards mastered up!
        </p>
        {#if correctFactIds.length === 0}
          <p class="summary-tip">Keep practicing — no cards upgraded this time.</p>
        {:else if correctFactIds.length === questions.length}
          <p class="summary-tip">Perfect score!</p>
        {:else}
          <p class="summary-tip">{correctFactIds.length} card{correctFactIds.length !== 1 ? 's' : ''} mastered up.</p>
        {/if}

        {#if correctFactIds.length > 0}
          <div class="upgraded-cards">
            <p class="upgraded-label">Cards upgraded:</p>
            {#each correctFactIds as factId}
              <div class="upgraded-card-row">
                <span class="upgrade-icon">⬆</span>
                <span class="upgraded-card-name">{getUpgradeLabel(factId)}</span>
              </div>
            {/each}
          </div>
        {/if}

        <button class="continue-btn" onclick={handleContinue}>Continue</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .study-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .study-card {
    background: #161B22;
    border: 2px solid #7C3AED;
    border-radius: 12px;
    padding: calc(28px * var(--layout-scale, 1));
    max-width: calc(400px * var(--layout-scale, 1));
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(18px * var(--layout-scale, 1));
  }

  .question-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .question-number {
    font-family: var(--font-pixel, monospace);
    font-size: calc(11px * var(--layout-scale, 1));
    color: #7C3AED;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .progress-dots {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #484F58;
    transition: background 0.2s;
  }

  .dot.active {
    background: #7C3AED;
  }

  .dot.completed {
    background: #2ECC71;
  }

  .question-text {
    font-size: calc(15px * var(--layout-scale, 1));
    color: #E6EDF3;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .study-quiz-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .study-quiz-image {
    width: calc(200px * var(--layout-scale, 1));
    height: auto;
    max-height: calc(140px * var(--layout-scale, 1));
    object-fit: contain;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: calc(4px * var(--layout-scale, 1));
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  .answers-image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .answer-img-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(8px * var(--layout-scale, 1));
    border: calc(2px * var(--layout-scale, 1)) solid #484F58;
    border-radius: calc(8px * var(--layout-scale, 1));
    background: #1E2D3D;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .answer-img-btn:not(:disabled):hover {
    border-color: #7C3AED;
    background: #1E2540;
  }

  .answer-img-btn:disabled {
    cursor: default;
  }

  .answer-img-btn.correct {
    border-color: #2ECC71;
    background: #0f2a1a;
  }

  .answer-img-btn.wrong {
    border-color: #E74C3C;
    background: #2a0f0f;
  }

  .study-kbd-hint {
    position: absolute;
    top: calc(4px * var(--layout-scale, 1));
    left: calc(4px * var(--layout-scale, 1));
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.5);
  }

  .study-flag-img {
    width: 100%;
    height: auto;
    max-height: calc(90px * var(--layout-scale, 1));
    object-fit: contain;
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .study-image-label {
    margin-top: calc(4px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
  }

  .answers-grid {
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .answer-btn {
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    color: #E6EDF3;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }

  .answer-btn:not(:disabled):hover {
    border-color: #7C3AED;
    background: #1E2540;
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-btn.correct {
    border-color: #2ECC71;
    background: #0f2a1a;
    color: #2ECC71;
  }

  .answer-btn.wrong {
    border-color: #E74C3C;
    background: #2a0f0f;
    color: #E74C3C;
  }

  .feedback-text {
    font-family: var(--font-pixel, monospace);
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    margin: 0;
  }

  .feedback-correct {
    color: #2ECC71;
  }

  .feedback-wrong {
    color: #E74C3C;
  }

  .srs-indicator {
    display: inline-block;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 600;
    opacity: 0.65;
    margin-left: calc(8px * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
  }

  .srs-plus { color: #4ADE80; }
  .srs-minus { color: #EF4444; }

  /* Summary screen */
  .summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
  }

  .summary-icon {
    font-size: calc(48px * var(--layout-scale, 1));
  }

  .summary-title {
    font-family: var(--font-pixel, monospace);
    font-size: calc(18px * var(--layout-scale, 1));
    color: #7C3AED;
    margin: 0;
  }

  .summary-result {
    font-size: calc(16px * var(--layout-scale, 1));
    color: #E6EDF3;
    margin: 0;
  }

  .highlight {
    color: #2ECC71;
    font-weight: 700;
  }

  .summary-tip {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #8B949E;
    margin: 0;
    text-align: center;
  }

  .upgraded-cards {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    background: rgba(46, 204, 113, 0.07);
    border: 1px solid rgba(46, 204, 113, 0.25);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .upgraded-label {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #8B949E;
    margin: 0 0 calc(2px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .upgraded-card-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .upgrade-icon {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #2ECC71;
    flex-shrink: 0;
  }

  .upgraded-card-name {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #A9D9C0;
    line-height: 1.3;
  }

  .continue-btn {
    margin-top: calc(8px * var(--layout-scale, 1));
    background: #7C3AED;
    border: none;
    border-radius: 8px;
    padding: calc(12px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    font-size: calc(14px * var(--layout-scale, 1));
    font-family: var(--font-pixel, monospace);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
  }

  .continue-btn:hover {
    background: #6D28D9;
  }

  /* === Landscape layout === */
  .study-overlay.landscape .study-card {
    max-width: min(55vw, 620px);
    padding: calc(28px * var(--layout-scale, 1)) calc(36px * var(--layout-scale, 1));
  }

  .study-overlay.landscape .answers-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .study-overlay.landscape .answer-btn {
    text-align: center;
  }
</style>
