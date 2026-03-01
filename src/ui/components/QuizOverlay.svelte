<script lang="ts">
  import { onMount } from 'svelte'
  import type { Fact } from '../../data/types'
  import { BALANCE } from '../../data/balance'
  import { audioManager } from '../../services/audioService'
  import { playerSave } from '../stores/playerData'
  import { gaiaMood } from '../stores/settings'
  import { GAIA_EXPRESSIONS, GAIA_NAME, getGaiaExpression } from '../../data/gaiaAvatar'

  interface Props {
    fact: Fact
    choices: string[]
    mode: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer'
    gateProgress?: { remaining: number; total: number }
    /** Whether the wrong answer triggered a consistency penalty (knew this before). */
    isConsistencyPenalty?: boolean
    onAnswer: (correct: boolean) => void
    onClose: () => void
  }

  const totalAttempts = BALANCE.QUIZ_GATE_MAX_FAILURES + 1

  let { fact, choices, mode, gateProgress, isConsistencyPenalty = false, onAnswer, onClose }: Props = $props()

  let selectedAnswer = $state<string | null>(null)
  let isCorrect = $state<boolean | null>(null)
  let attemptsRemaining = $state<number>(totalAttempts)
  let showResult = $state<boolean>(false)

  const resultText = $derived(() => {
    if (!showResult || isCorrect === null) return ''
    if (isCorrect) return 'Correct!'
    if (mode === 'layer') return `Wrong! -${BALANCE.LAYER_ENTRANCE_WRONG_O2_COST} O2`
    return 'Wrong!'
  })

  const resultClass = $derived(() => {
    if (!showResult || isCorrect === null) return ''
    return isCorrect ? 'result-correct' : 'result-wrong'
  })

  /**
   * Whether the memory tip should be shown.
   *
   * Shown after a wrong answer when:
   *  - The player is a struggling learner: repetitions === 0 AND the fact is
   *    already in learnedFacts (i.e. they have seen it before but keep failing), OR
   *  - The fact is brand-new (not yet in learnedFacts) — always show the
   *    explanation as a first-time learning aid.
   */
  const showMemoryTip = $derived.by(() => {
    if (!showResult || isCorrect !== false) return false
    const explanation = fact.explanation
    if (!explanation || explanation.trim().length === 0) return false

    const save = $playerSave
    if (!save) return true // no save data → always show tip for new players

    const isLearned = save.learnedFacts.includes(fact.id)

    if (!isLearned) {
      // Brand-new fact — always show explanation as a first-time learning aid
      return true
    }

    // Struggling learner: has seen the fact but review state shows repeated failure
    const reviewState = save.reviewStates.find((s) => s.factId === fact.id)
    if (!reviewState) return false

    // repetitions === 0 means SM-2 keeps resetting the card due to failed reviews
    return reviewState.repetitions === 0
  })

  const memoryTipText = $derived.by(() => fact.explanation ?? '')

  $effect(() => {
    fact.id
    mode
    selectedAnswer = null
    isCorrect = null
    showResult = false
    attemptsRemaining = totalAttempts
  })

  /** Emoji and name shown in the GAIA reaction bubble after answering */
  const gaiaReactionEmoji = $derived.by(() => {
    if (!showResult || isCorrect === null) return GAIA_EXPRESSIONS.neutral.emoji
    const trigger = isCorrect ? 'quiz_correct' : 'quiz_wrong'
    return getGaiaExpression(trigger, $gaiaMood).emoji
  })

  async function handleAnswer(answer: string): Promise<void> {
    if (showResult) return

    selectedAnswer = answer
    isCorrect = answer === fact.correctAnswer
    showResult = true

    if (isCorrect) {
      audioManager.playSound('quiz_correct')
    } else {
      audioManager.playSound('quiz_wrong')
    }

    if (!isCorrect && mode === 'gate') {
      attemptsRemaining = Math.max(0, attemptsRemaining - 1)
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000)
    })

    if (isCorrect) {
      onAnswer(true)
      return
    }

    if (mode === 'gate' && attemptsRemaining === 0) {
      onAnswer(false)
      return
    }

    if (mode === 'artifact' || mode === 'random' || mode === 'layer') {
      onAnswer(false)
      return
    }

    selectedAnswer = null
    isCorrect = null
    showResult = false
  }

  function getChoiceClass(choice: string): string {
    if (!showResult || selectedAnswer !== choice || isCorrect === null) {
      return ''
    }

    return isCorrect ? 'choice-correct' : 'choice-wrong'
  }

  onMount(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (showResult) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= choices.length) {
        void handleAnswer(choices[num - 1])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })
</script>

<div class="quiz-overlay" role="dialog" aria-modal="true" aria-label="Quiz">
  <div class="quiz-card">
    <button class="close-button" type="button" onclick={onClose} aria-label="Close quiz">
      x
    </button>

    {#if mode === 'random'}
      <p class="pop-quiz-header">Pop Quiz!</p>
      <p class="pop-quiz-reward">Correct: +{BALANCE.RANDOM_QUIZ_REWARD_DUST} dust &nbsp;|&nbsp; Wrong: -{BALANCE.RANDOM_QUIZ_WRONG_O2_COST} O2</p>
    {/if}

    {#if mode === 'gate' && gateProgress}
      <p class="gate-progress">Gate: {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
    {/if}

    {#if mode === 'artifact' && gateProgress}
      <p class="artifact-appraisal-header">Artifact Appraisal — Question {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
      <p class="artifact-appraisal-hint">Each correct answer may boost the artifact's rarity!</p>
    {/if}

    {#if mode === 'layer'}
      <p class="layer-entrance-header">Layer Descent — Knowledge Check</p>
      <p class="layer-entrance-hint">Answer correctly to descend without penalty!</p>
    {/if}

    <p class="question">{fact.quizQuestion}</p>

    {#if mode === 'gate'}
      <p class="attempts">Attempts: {attemptsRemaining}/{totalAttempts}</p>
    {/if}

    <div class="choices">
      {#each choices as choice, i}
        <button
          class={`choice-button ${getChoiceClass(choice)}`}
          type="button"
          disabled={showResult}
          onclick={() => void handleAnswer(choice)}
        >
          <span class="choice-number">{i + 1}</span>
          <span class="choice-text">{choice}</span>
        </button>
      {/each}
    </div>

    {#if showResult}
      <p class={`result-text ${resultClass}`}>{resultText}</p>
    {/if}

    {#if showResult && isCorrect !== null}
      <div class="gaia-reaction" class:gaia-reaction-correct={isCorrect} class:gaia-reaction-wrong={!isCorrect} role="note" aria-label="GAIA reaction">
        <span class="gaia-reaction-emoji" aria-hidden="true">{gaiaReactionEmoji}</span>
        <span class="gaia-reaction-name">{GAIA_NAME}</span>
        <span class="gaia-reaction-text">
          {#if isCorrect}
            {['Great work!', 'Correct!', 'Excellent!', 'Well done!'][Math.floor(Math.random() * 4)]}
          {:else}
            {['Keep trying.', 'Almost!', 'Study up.', 'Not quite.'][Math.floor(Math.random() * 4)]}
          {/if}
        </span>
      </div>
    {/if}

    {#if showResult && isCorrect === false && isConsistencyPenalty}
      <p class="consistency-penalty-warning">Consistency penalty! You knew this one. -{BALANCE.CONSISTENCY_PENALTY_O2} O2</p>
    {/if}

    {#if showMemoryTip}
      <div class="memory-tip" role="note" aria-label="Memory Tip">
        <span class="memory-tip-label">💡 Memory Tip:</span>
        <span class="memory-tip-text">{memoryTipText}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .quiz-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.85);
    font-family: 'Courier New', monospace;
  }

  .quiz-card {
    position: relative;
    width: min(100%, 36rem);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    border: 2px solid var(--color-primary);
    border-radius: 16px;
    padding: 1.25rem;
    background: var(--color-surface);
    color: var(--color-text);
  }

  .close-button {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    min-width: 44px;
    min-height: 44px;
    width: 44px;
    height: 44px;
    border: 1px solid var(--color-text-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-dim);
    font: inherit;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .pop-quiz-header {
    text-align: center;
    color: #4ecca3;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 0.25rem;
    opacity: 0.85;
  }

  .pop-quiz-reward {
    text-align: center;
    color: var(--color-text-dim);
    font-size: 0.78rem;
    letter-spacing: 0.5px;
    margin-top: -0.4rem;
  }

  .gate-progress {
    text-align: center;
    color: var(--color-warning);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 0.25rem;
  }

  .artifact-appraisal-header {
    text-align: center;
    color: #e94560;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 0.25rem;
  }

  .artifact-appraisal-hint {
    text-align: center;
    color: var(--color-text-dim);
    font-size: 0.78rem;
    letter-spacing: 0.5px;
    margin-top: -0.4rem;
    font-style: italic;
  }

  .layer-entrance-header {
    text-align: center;
    color: #9966ff;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 1px;
    margin-top: 0.25rem;
  }

  .layer-entrance-hint {
    text-align: center;
    color: var(--color-text-dim);
    font-size: 0.78rem;
    letter-spacing: 0.5px;
    margin-top: -0.4rem;
    font-style: italic;
  }

  .question {
    margin-top: 0.5rem;
    color: var(--color-warning);
    font-size: 1.1rem;
    line-height: 1.4;
    text-align: center;
  }

  .attempts {
    color: var(--color-text-dim);
    font-size: 0.95rem;
    text-align: center;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .choice-button {
    min-height: 48px;
    border: 2px solid var(--color-primary);
    border-radius: 999px;
    padding: 0.75rem 1rem;
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: 1rem;
    text-align: center;
    cursor: pointer;
    transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  .choice-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .choice-button:disabled {
    opacity: 0.95;
    cursor: default;
  }

  .choice-correct {
    border-color: var(--color-success);
    background: #4ecca3;
    color: #10221b;
  }

  .choice-wrong {
    border-color: var(--color-accent);
    background: #e94560;
    color: #fff;
  }

  .choice-number {
    display: none;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface) 75%);
    color: var(--color-text-dim);
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
    place-items: center;
  }

  .choice-text {
    flex: 1;
  }

  /* Show number labels only on desktop (devices with fine pointer / mouse) */
  @media (pointer: fine) {
    .choice-number {
      display: grid;
    }

    .choice-button {
      /* override text-align: center to use flexbox layout */
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  }

  .result-text {
    min-height: 1.4rem;
    font-size: 1rem;
    text-align: center;
    font-weight: 700;
  }

  .result-correct {
    color: var(--color-success);
  }

  .result-wrong {
    color: var(--color-accent);
  }

  .memory-tip {
    background: rgba(78, 205, 196, 0.08);
    border-left: 3px solid #4ecdc4;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 0.85rem;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .memory-tip-label {
    color: #4ecdc4;
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .memory-tip-text {
    color: var(--color-text);
    font-style: italic;
    opacity: 0.9;
  }

  .consistency-penalty-warning {
    text-align: center;
    color: #ff6b35;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: 1px solid #ff6b35;
    border-radius: 6px;
    padding: 6px 10px;
    background: rgba(255, 107, 53, 0.08);
    margin-top: -4px;
  }

  /* GAIA reaction bubble shown after answering */
  .gaia-reaction {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border-left: 3px solid var(--color-primary);
    background: rgba(78, 100, 205, 0.1);
    font-size: 0.82rem;
    margin-top: -4px;
    font-family: 'Courier New', monospace;
  }

  .gaia-reaction-correct {
    border-left-color: var(--color-success);
    background: rgba(78, 205, 163, 0.1);
  }

  .gaia-reaction-wrong {
    border-left-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.08);
  }

  .gaia-reaction-emoji {
    font-size: 1.3rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .gaia-reaction-name {
    color: #22d9d9;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .gaia-reaction-text {
    color: var(--color-text-dim);
    font-style: italic;
  }
</style>
