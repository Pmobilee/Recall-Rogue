<script lang="ts">
  /**
   * EventQuiz — standalone quiz component for mystery events.
   * Shows MCQ questions one at a time, calls onComplete(correct, total) when done.
   * Uses facts from the active run's curated deck (or trivia DB as fallback).
   */
  import { get } from 'svelte/store'
  import { activeRunState } from '../../services/runStateStore'
  import { selectNonCombatStudyQuestion } from '../../services/nonCombatQuizSelector'
  import { getConfusionMatrix } from '../../services/confusionMatrixStore'
  import { factsDB } from '../../services/factsDB'

  interface QuizQuestion {
    question: string
    correctAnswer: string
    choices: string[]
    factId?: string
  }

  interface Props {
    questionCount: number
    onComplete: (correct: number, total: number, factIds: string[]) => void
  }

  let { questionCount, onComplete }: Props = $props()

  // ——— State ———
  let questions: QuizQuestion[] = $state([])
  let currentIndex: number = $state(0)
  let selectedAnswer: string | null = $state(null)
  let showResult: boolean = $state(false)
  let correctCount: number = $state(0)
  let phase: 'loading' | 'quiz' | 'done' = $state('loading')

  // ——— Build question list on mount ———
  $effect(() => {
    buildQuestions()
  })

  function buildQuestions(): void {
    const built: QuizQuestion[] = []
    const run = get(activeRunState)

    for (let i = 0; i < questionCount; i++) {
      // Try curated deck first
      if (run?.deckMode?.type === 'study') {
        const q = selectNonCombatStudyQuestion(
          'mystery',
          run.deckMode.deckId,
          run.deckMode.subDeckId,
          getConfusionMatrix(),
          run.inRunFactTracker ?? null,
          1,
          (run.runSeed ?? 0) + i * 1000,
          run.deckMode.examTags,
        )
        if (q) {
          built.push({
            question: q.question,
            correctAnswer: q.correctAnswer,
            choices: q.choices,
            factId: q.factId,
          })
          continue
        }
      }

      // Fallback: trivia DB
      const allFacts = factsDB.getTriviaFacts()
      if (allFacts.length >= 4) {
        // Pick a random fact not already used
        const usedAnswers = new Set(built.map(b => b.correctAnswer))
        const candidates = allFacts.filter(f => !usedAnswers.has(f.correctAnswer))
        const pool = candidates.length >= 4 ? candidates : allFacts
        const fact = pool[Math.floor(Math.random() * pool.length)]

        // Distractors: pick 2 from pre-generated list or other facts
        let distractors: string[]
        if (fact.distractors && fact.distractors.length >= 2) {
          distractors = shuffleArray(fact.distractors).slice(0, 2)
        } else {
          // Pull from other facts' correct answers as a last resort
          const others = allFacts
            .filter(f => f.id !== fact.id && f.correctAnswer !== fact.correctAnswer)
            .map(f => f.correctAnswer)
          distractors = shuffleArray(others).slice(0, 2)
        }

        const choices = shuffleArray([fact.correctAnswer, ...distractors])
        built.push({
          question: fact.quizQuestion,
          correctAnswer: fact.correctAnswer,
          choices,
        })
        continue
      }

      // Last resort: placeholder if no facts at all
      built.push({
        question: 'What is the capital of France?',
        correctAnswer: 'Paris',
        choices: shuffleArray(['Paris', 'London', 'Berlin']),
      })
    }

    questions = built
    phase = 'quiz'
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function handleAnswer(choice: string): void {
    if (selectedAnswer !== null) return // already answered
    selectedAnswer = choice
    showResult = true
    if (choice === questions[currentIndex]?.correctAnswer) {
      correctCount++
    }
  }

  function handleNext(): void {
    const nextIndex = currentIndex + 1
    if (nextIndex >= questions.length) {
      phase = 'done'
      const factIds = questions.map(q => q.factId ?? '').filter(Boolean)
      onComplete(correctCount, questions.length, factIds)
    } else {
      currentIndex = nextIndex
      selectedAnswer = null
      showResult = false
    }
  }

  let currentQuestion = $derived(questions[currentIndex] ?? null)
  let isCorrect = $derived(selectedAnswer === currentQuestion?.correctAnswer)
</script>

{#if phase === 'loading'}
  <div class="quiz-loading">
    <span class="loading-text">Preparing questions…</span>
  </div>
{:else if phase === 'quiz' && currentQuestion}
  <div class="event-quiz">
    <div class="quiz-progress">
      Question {currentIndex + 1} / {questions.length}
    </div>

    <p class="quiz-question">{currentQuestion.question}</p>

    <div class="quiz-choices">
      {#each currentQuestion.choices as choice, i (choice)}
        <button
          class="choice-btn"
          data-testid="quiz-answer-{i}"
          class:correct={showResult && choice === currentQuestion.correctAnswer}
          class:wrong={showResult && selectedAnswer === choice && !isCorrect}
          class:dim={showResult && choice !== currentQuestion.correctAnswer && choice !== selectedAnswer}
          disabled={showResult}
          onclick={() => handleAnswer(choice)}
        >
          {choice}
        </button>
      {/each}
    </div>

    {#if showResult}
      <div class="result-banner" class:result-correct={isCorrect} class:result-wrong={!isCorrect}>
        {#if isCorrect}
          ✓ Correct!
        {:else}
          ✗ Wrong — answer: {currentQuestion.correctAnswer}
        {/if}
      </div>

      <button class="next-btn" onclick={handleNext}>
        {currentIndex + 1 < questions.length ? 'Next Question →' : 'See Results'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .quiz-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(24px * var(--layout-scale, 1));
  }

  .loading-text {
    font-size: calc(14px * var(--text-scale, 1));
    color: #8B949E;
  }

  .event-quiz {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    width: 100%;
  }

  .quiz-progress {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8B949E;
    text-align: center;
  }

  .quiz-question {
    font-size: calc(15px * var(--text-scale, 1));
    color: #E6EDF3;
    text-align: center;
    line-height: 1.5;
    margin: 0;
    padding: calc(8px * var(--layout-scale, 1)) 0;
  }

  .quiz-choices {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .choice-btn {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    background: #1E2D3D;
    border: 1px solid #484F58;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #E6EDF3;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    text-align: left;
  }

  .choice-btn:hover:not(:disabled) {
    background: #2D333B;
    border-color: #9B59B6;
  }

  .choice-btn:disabled {
    cursor: default;
  }

  .choice-btn.correct {
    background: #1a3a2a;
    border-color: #3fb950;
    color: #3fb950;
  }

  .choice-btn.wrong {
    background: #3a1a1a;
    border-color: #f85149;
    color: #f85149;
  }

  .choice-btn.dim {
    opacity: 0.45;
  }

  .result-banner {
    padding: calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    text-align: center;
  }

  .result-correct {
    background: #1a3a2a;
    border: 1px solid #3fb950;
    color: #3fb950;
  }

  .result-wrong {
    background: #3a1a1a;
    border: 1px solid #f85149;
    color: #f85149;
  }

  .next-btn {
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1));
    background: #9B59B6;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .next-btn:hover {
    transform: scale(1.02);
  }
</style>
