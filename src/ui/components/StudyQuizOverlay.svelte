<script lang="ts">
  import type { QuizQuestion } from '../../services/bossQuizPhase'
  import { currentScreen } from '../stores/gameState'
  import { isLandscape } from '../../stores/layoutStore'
  import GrammarSentenceFurigana from './GrammarSentenceFurigana.svelte'
  import { deckOptions } from '../../services/deckOptionsService'
  import ChessBoard from './ChessBoard.svelte'
  import { getPlayerContext, gradeChessMove, isInCheck } from '../../services/chessGrader'
  import { updateChessElo } from '../../services/chessEloService'
  import { displayAnswer } from '../../services/numericalDistractorService'
  import MapPinDrop from './MapPinDrop.svelte'
  import { updateGeoElo, tierToRating } from '../../services/geoEloService'
  import { get } from 'svelte/store'
  import { tutorialActive, evaluateTutorialStep } from '../../services/tutorialService'
  import { onboardingState } from '../../services/cardPreferences'
  import type { TutorialContext } from '../../data/tutorialSteps'

  interface Props {
    questions: QuizQuestion[]
    oncomplete: (correctFactIds: string[]) => void
    /** Optional back handler. Called when the user dismisses from the empty state.
     *  If not provided, navigates to 'hub'. */
    onback?: () => void
  }

  let { questions, oncomplete, onback }: Props = $props()

  /** Navigate back — used in the empty state and always-visible escape hatch.
   *  Calls the caller-supplied onback if provided, otherwise returns to hub. */
  function handleBack(): void {
    if (onback) {
      onback()
    } else {
      currentScreen.set('hub')
    }
  }

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

  /** True when the current question has pre-baked Japanese furigana segment data. */
  const isJapaneseGrammarFact = $derived.by(() => {
    return !!(currentQuestion?.sentenceFurigana && currentQuestion.sentenceFurigana.length > 0)
  })

  /** Reactively read romaji toggle from deckOptions store. */
  const showRomaji = $derived.by(() => ($deckOptions as any)?.ja?.romaji ?? false)

  // ---------------------------------------------------------------------------
  // Chess puzzle state
  // ---------------------------------------------------------------------------

  type PlayerContext = ReturnType<typeof getPlayerContext>

  let chessContext = $state<PlayerContext | null>(null)
  let chessLastMove = $state<{ from: string; to: string } | undefined>(undefined)
  let chessDisabled = $state(false)
  let chessCheckState = $state(false)

  /** Rebuild chess context whenever the question changes to a chess_move type. */
  $effect(() => {
    const q = currentQuestion
    if (q?.quizResponseMode === 'chess_move' && q.fenPosition && q.solutionMoves && q.solutionMoves.length >= 2) {
      try {
        const ctx = getPlayerContext(q.fenPosition, q.solutionMoves)
        chessContext = ctx
        chessLastMove = ctx.setupMove
        chessDisabled = false
        chessCheckState = isInCheck(ctx.playerFen)
      } catch {
        // Invalid puzzle data — fall back to choice mode
        chessContext = null
      }
    } else {
      chessContext = null
    }
  })

  // Study tutorial evaluation — builds TutorialContext from quiz state
  $effect(() => {
    if (!$tutorialActive) return

    const state = get(onboardingState)
    const ctx: TutorialContext = {
      enemyName: null,
      enemyCategory: null,
      playerHp: 0,
      playerMaxHp: 0,
      playerBlock: 0,
      apCurrent: 0,
      apMax: 0,
      handSize: 0,
      turnNumber: 0,
      encounterTurnNumber: 0,
      phase: null,
      cardsPlayedThisTurn: 0,
      cardsCorrectThisTurn: 0,
      chainLength: 0,
      isSurgeTurn: false,
      selectedCardType: null,
      selectedCardApCost: null,
      cardPlayStage: null,
      quizVisible: false,
      hasPlayedQuickPlay: false,
      hasPlayedCharge: false,
      hasAnsweredWrong: false,
      hasSeenCombatTutorial: state.hasSeenCombatTutorial,
      hasSeenStudyTutorial: state.hasSeenStudyTutorial,
      mode: 'study',
      enemyIntentType: null,
      enemyIntentValue: null,
      studyQuestionsAnswered: currentIndex + (showFeedback ? 1 : 0),
      studySessionComplete: done,
    }

    evaluateTutorialStep(ctx)
  })

  /**
   * Handle a chess move from the ChessBoard component.
   * Grades against the solution UCI, updates Elo, then fires selectAnswer after a brief delay.
   */
  function handleChessMove(uci: string): void {
    if (!chessContext || !currentQuestion) return
    const isCorrect = gradeChessMove(uci, chessContext.solutionUCI)
    chessDisabled = true
    chessLastMove = { from: uci.substring(0, 2), to: uci.substring(2, 4) }

    if (currentQuestion.lichessRating) {
      updateChessElo(currentQuestion.lichessRating, isCorrect)
    }

    setTimeout(() => {
      if (isCorrect) {
        selectAnswer(currentQuestion!.correctAnswer)
      } else {
        // Pick any wrong answer to trigger the wrong-answer flow
        const wrongAnswer = currentQuestion!.answers.find(a => a !== currentQuestion!.correctAnswer)
        if (wrongAnswer) selectAnswer(wrongAnswer)
      }
    }, isCorrect ? 400 : 800)
  }

  // ---------------------------------------------------------------------------
  // Map pin state
  // ---------------------------------------------------------------------------

  let mapDisabled = $state(false)
  let mapEloChange = $state<number | null>(null)

  /**
   * Handle a pin placement from the MapPinDrop component.
   * Updates geo Elo then fires selectAnswer after a brief delay.
   * accuracy >= 0.5 is treated as correct (within acceptable radius for the difficulty tier).
   */
  function handleMapPinConfirm(pinCoordinates: [number, number], distanceKm: number, accuracy: number): void {
    mapDisabled = true

    if (currentQuestion?.mapDifficultyTier) {
      const locationRating = tierToRating(currentQuestion.mapDifficultyTier)
      const result = updateGeoElo(locationRating, accuracy, distanceKm, currentQuestion.mapRegion)
      mapEloChange = result.ratingChange
    }

    setTimeout(() => {
      if (accuracy >= 0.5) {
        selectAnswer(currentQuestion!.correctAnswer)
      } else {
        const wrongAnswer = currentQuestion!.answers.find(a => a !== currentQuestion!.correctAnswer)
        if (wrongAnswer) selectAnswer(wrongAnswer)
      }
    }, accuracy >= 0.5 ? 400 : 800)
  }

  // ---------------------------------------------------------------------------
  // Answer flow
  // ---------------------------------------------------------------------------

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
        chessContext = null
        chessDisabled = false
        mapDisabled = false
        mapEloChange = null
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
    {#if questions.length === 0}
      <!-- Empty state — no study cards available (e.g. called from hub without an active run) -->
      <!-- Softlock prevention: always renders a dismiss control. See docs/gotchas.md 2026-04-10 -->
      <div class="empty-state" data-testid="study-empty-state">
        <span class="empty-icon" aria-hidden="true">📚</span>
        <h2 class="empty-title">No Cards to Review</h2>
        <p class="empty-message">Start a run and visit a rest room to unlock study mode.</p>
        <button
          class="back-btn"
          data-testid="study-back-btn"
          onclick={handleBack}
          aria-label="Return to hub"
        >Return to Hub</button>
      </div>
    {:else if !done}
      <!-- Always-visible escape hatch — softlock prevention rule (ui-layout.md) -->
      <button
        class="overlay-back-btn"
        data-testid="study-back-btn"
        onclick={handleBack}
        aria-label="Return to hub"
      >&#x2190; Back</button>
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

        {#if isJapaneseGrammarFact}
          <p class="question-text grammar-fill-blank">
            <GrammarSentenceFurigana
              segments={currentQuestion.sentenceFurigana ?? []}
              fallbackText={currentQuestion.question.split('\n')[0]}
              excludeWords={[currentQuestion.correctAnswer]}
            />
          </p>
          {#if currentQuestion.sentenceTranslation}
            <p class="grammar-translation">{currentQuestion.sentenceTranslation}</p>
          {/if}
          {#if showRomaji && currentQuestion.sentenceRomaji}
            <p class="grammar-romaji">{currentQuestion.sentenceRomaji}</p>
          {/if}
          {#if showFeedback && currentQuestion.grammarPointLabel}
            <p class="grammar-hint-label grammar-point-label-reveal">{currentQuestion.grammarPointLabel}</p>
          {/if}
        {:else}
          <p class="question-text" data-tutorial-anchor="study-card">{currentQuestion.question}</p>
        {/if}

        {#key currentIndex}
        {#if currentQuestion.quizResponseMode === 'chess_move' && chessContext}
          <div class="chess-puzzle-container">
            <ChessBoard
              fen={chessContext.playerFen}
              orientation={chessContext.orientation}
              onmove={handleChessMove}
              disabled={chessDisabled || selectedAnswer !== null}
              lastMove={chessLastMove}
              isInCheck={chessCheckState}
              showNotationInput={$isLandscape}
            />
          </div>
        {:else if currentQuestion.quizResponseMode === 'map_pin' && currentQuestion.mapCoordinates}
          <div class="map-pin-quiz-container">
            <MapPinDrop
              targetCoordinates={currentQuestion.mapCoordinates}
              targetRegion={currentQuestion.mapRegion}
              masteryLevel={0}
              disabled={mapDisabled || selectedAnswer !== null}
              onconfirm={handleMapPinConfirm}
            />
            {#if mapEloChange !== null}
              <div class="elo-change-badge" class:elo-positive={mapEloChange > 0} class:elo-negative={mapEloChange < 0}>
                {mapEloChange > 0 ? '+' : ''}{mapEloChange}
              </div>
            {/if}
          </div>
        {:else if currentQuestion.quizMode === 'image_answers' && currentQuestion.answerImagePaths?.length}
          <div class="answers-image-grid">
            {#each currentQuestion.answers as answer, i}
              <button
                class="answer-img-btn {getAnswerClass(answer)}"
                onclick={() => selectAnswer(answer)}
                disabled={showFeedback}
                aria-label="Choice {i + 1}: {displayAnswer(answer)}"
              >
                <span class="study-kbd-hint" aria-hidden="true">{i + 1}</span>
                <img src={currentQuestion.answerImagePaths![i]} alt="" class="study-flag-img" />
                {#if showFeedback}
                  <span class="study-image-label">{displayAnswer(answer)}</span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
        <div class="answers-grid" data-tutorial-anchor="study-answers">
          {#each currentQuestion.answers as answer}
            <button
              class="answer-btn {getAnswerClass(answer)}"
              onclick={() => selectAnswer(answer)}
              disabled={showFeedback}
            >
              {displayAnswer(answer)}
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
    font-size: calc(15px * var(--text-scale, 1));
    color: #E6EDF3;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  /* Grammar fill-in-blank: ensure ruby renders above kanji */
  .grammar-fill-blank :global(ruby) {
    ruby-position: over;
  }

  .grammar-fill-blank :global(rt) {
    font-size: 0.6em;
    color: rgba(255, 255, 255, 0.75);
  }

  .grammar-translation {
    margin: calc(4px * var(--layout-scale, 1)) 0 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    font-style: italic;
  }

  .grammar-romaji {
    margin: calc(2px * var(--layout-scale, 1)) 0 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    font-style: italic;
  }

  .grammar-hint-label {
    margin: calc(8px * var(--layout-scale, 1)) 0 0;
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(124, 58, 237, 0.12);
    border-left: calc(3px * var(--layout-scale, 1)) solid rgba(124, 58, 237, 0.6);
    border-radius: calc(4px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: #C4A7FF;
    font-weight: 600;
    text-align: left;
    align-self: stretch;
  }

  /* Fade-in animation for grammar point label revealed post-answer */
  .grammar-point-label-reveal {
    animation: study-label-fade-in 250ms ease-out forwards;
  }

  @keyframes study-label-fade-in {
    from { opacity: 0; transform: translateY(calc(4px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateY(0); }
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

  /* Chess puzzle container */
  .chess-puzzle-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    padding: calc(4px * var(--layout-scale, 1));
  }

  /* Map pin drop container — matches CardExpanded layout */
  .map-pin-quiz-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: calc(300px * var(--layout-scale, 1));
    position: relative;
    align-items: center;
  }

  /* Elo change badge shown after map pin confirmation */
  .elo-change-badge {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    margin-top: calc(6px * var(--layout-scale, 1));
    animation: elo-float 1.5s ease-out forwards;
  }

  .elo-positive {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.15);
  }

  .elo-negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  @keyframes elo-float {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(calc(-20px * var(--layout-scale, 1))); }
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

  /* In landscape, give the map more breathing room */
  .study-overlay.landscape .map-pin-quiz-container {
    min-height: calc(360px * var(--layout-scale, 1));
  }

  /* === Empty state (no questions available) === */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    text-align: center;
  }

  .empty-icon {
    font-size: calc(48px * var(--layout-scale, 1));
  }

  .empty-title {
    font-family: var(--font-pixel, monospace);
    font-size: calc(18px * var(--text-scale, 1));
    color: #7C3AED;
    margin: 0;
  }

  .empty-message {
    font-size: calc(14px * var(--text-scale, 1));
    color: #8B949E;
    margin: 0;
    max-width: calc(280px * var(--layout-scale, 1));
    line-height: 1.5;
  }

  .back-btn {
    margin-top: calc(8px * var(--layout-scale, 1));
    background: #484F58;
    border: 1px solid #7C3AED;
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-family: var(--font-pixel, monospace);
    color: #fff;
    cursor: pointer;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: background 0.15s;
  }

  .back-btn:hover {
    background: #6D28D9;
    border-color: #8B5CF6;
  }

  /* Always-visible escape hatch — softlock prevention (ui-layout.md §Softlock prevention) */
  .overlay-back-btn {
    align-self: flex-start;
    background: transparent;
    border: 1px solid #484F58;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    cursor: pointer;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    transition: color 0.15s, border-color 0.15s;
  }

  .overlay-back-btn:hover {
    color: #E6EDF3;
    border-color: #7C3AED;
  }
</style>
