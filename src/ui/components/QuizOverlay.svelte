<script lang="ts">
  import { onMount } from 'svelte'
  import type { Fact } from '../../data/types'
  import {
    BALANCE,
    CORRECT_ANSWER_RESUME_DELAY,
    WRONG_ANSWER_RESUME_BASE,
    WRONG_ANSWER_RESUME_PER_CHAR,
    WRONG_ANSWER_RESUME_MAX,
  } from '../../data/balance'
  import { answerDisplaySpeed, autoResumeAfterAnswer } from '../stores/settings'
  import { audioManager } from '../../services/audioService'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { playerSave } from '../stores/playerData'
  import { gaiaMood, highContrastQuiz } from '../stores/settings'
  import { KEEPER_EXPRESSIONS, KEEPER_NAME, getKeeperExpression } from '../../data/gaiaAvatar'
  import ReportModal from './ReportModal.svelte'
  import FactArtwork from './FactArtwork.svelte'
  import { notifySuccess, notifyError, tapLight } from '../../services/hapticService'
  import KidWowStars from './KidWowStars.svelte'
  import { getWowScore } from '../../services/wowScore'
  import FuriganaText from '../FuriganaText.svelte'
  import { deckOptions } from '../../services/deckOptionsService'
  import { isLandscape } from '../../stores/layoutStore'
  import DeckOptionsPanel from '../DeckOptionsPanel.svelte'
  import { getLanguageConfig } from '../../types/vocabulary'
  import { inputService } from '../../services/inputService'
  import { turboDelay } from '../../utils/turboMode'
  import { displayAnswer } from '../../services/numericalDistractorService'

  // GAIA sprite imports for reaction bubble
  const gaiaNeutralImg = '/assets/sprites/dome/gaia_neutral.png'
  const gaiaHappyImg = '/assets/sprites/dome/gaia_happy.png'
  const gaiaThinkingImg = '/assets/sprites/dome/gaia_thinking.png'
  const gaiaSnarkyImg = '/assets/sprites/dome/gaia_snarky.png'
  const gaiaSurprisedImg = '/assets/sprites/dome/gaia_surprised.png'
  const gaiaCalmImg = '/assets/sprites/dome/gaia_calm.png'

  /** Map expression IDs to sprite image URLs */
  const GAIA_SPRITE_MAP: Record<string, string> = {
    neutral:   gaiaNeutralImg,
    happy:     gaiaHappyImg,
    excited:   gaiaHappyImg,
    thinking:  gaiaThinkingImg,
    worried:   gaiaThinkingImg,
    proud:     gaiaHappyImg,
    snarky:    gaiaSnarkyImg,
    surprised: gaiaSurprisedImg,
    calm:      gaiaCalmImg,
  }

  interface Props {
    fact: Fact
    choices: string[]
    mode: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer' | 'review' | 'discovery' | 'combat' | 'artifact_boost'
    gateProgress?: { remaining: number; total: number }
    /** Whether the wrong answer triggered a consistency penalty (knew this before). */
    isConsistencyPenalty?: boolean
    /** When 'three_button', shows Easy/Got it/Didn't get it instead of answer choices */
    responseMode?: 'standard' | 'three_button'
    /** Whether GAIA should show a mnemonic hint for a struggle fact. */
    showMnemonic?: boolean
    /** Mnemonic text from the fact data. */
    mnemonic?: string
    /** Layer challenge progress (e.g., question 2 of 3). */
    layerChallengeProgress?: { current: number; total: number }
    /** Quiz presentation mode: 'text' (default), 'image_question' (image above question),
     *  'image_answers' (2x2 image grid instead of text buttons). */
    quizMode?: 'text' | 'image_question' | 'image_answers'
    /** Path to the question image (used when quizMode === 'image_question'). */
    imageAssetPath?: string
    /** Parallel image paths for each choice (used when quizMode === 'image_answers'). */
    answerImagePaths?: string[]
    onAnswer: (correct: boolean) => void
    /** Callback for 3-button study responses: quality 1=didn't get it, 4=got it, 5=easy */
    onStudyResponse?: (quality: number) => void
    onClose: () => void
  }

  const totalAttempts = BALANCE.QUIZ_GATE_MAX_FAILURES + 1

  const isDev = import.meta.env.DEV

  /** Parse a Japanese quiz question to extract the target word for furigana display.
   *  Expects format: "What does '食べる' (たべる) mean..." or "What does '食べる' mean..."
   *  Returns { before, word, reading, after } or null if not a parseable Japanese question.
   */
  function parseJapaneseQuestion(question: string, factPronunciation?: string): { before: string; word: string; reading: string; after: string } | null {
    // Match text between single quotes, optionally followed by reading in parentheses
    const match = question.match(/^(.*?)'([^']+)'(?:\s*\(([^)]+)\))?\s*(.*)$/)
    if (!match) return null
    return {
      before: match[1],
      word: match[2],
      reading: match[3] || factPronunciation || '',
      after: match[4]
    }
  }

  let { fact, choices, mode, gateProgress, isConsistencyPenalty = false, responseMode = 'standard', showMnemonic = false, mnemonic = '', layerChallengeProgress, quizMode = 'text', imageAssetPath, answerImagePaths, onAnswer, onStudyResponse, onClose }: Props = $props()

  let selectedAnswer = $state<string | null>(null)
  let isCorrect = $state<boolean | null>(null)
  let attemptsRemaining = $state<number>(totalAttempts)
  let showResult = $state<boolean>(false)
  let showReportModal = $state(false)
  /** Whether the live language options popup is open. */
  let showLiveOptions = $state(false)

  /** The language code of the current fact (null if not a language fact). */
  const factLanguage = $derived(fact.language ?? null)
  /** Whether the current fact's language has configurable options. */
  const hasLanguageOptions = $derived(
    factLanguage ? (getLanguageConfig(factLanguage)?.options?.length ?? 0) > 0 : false
  )
  /** True when a wrong answer result is being displayed, waiting for the player to tap "Continue". */
  let waitingForTap = $state<boolean>(false)
  /** Index of answer highlighted briefly by keyboard shortcut (landscape, 150ms). */
  let kbdHighlightIndex = $state<number | null>(null)
  /** Timeout ID for auto-resume after wrong answer. */
  let autoResumeTimeoutId: ReturnType<typeof setTimeout> | undefined

  /** CSS class for question text auto-scaling based on character count. */
  const questionLengthClass = $derived.by(() => {
    const len = fact.quizQuestion.length
    if (len < 30) return 'quiz-text-short'
    if (len < 80) return 'quiz-text-medium'
    return 'quiz-text-long'
  })

  const CORRECT_PHRASES = ["That's it!", "Nailed it!", "Locked in!"] as const
  const WRONG_PHRASES = ["Not quite!", "Hmm, let me remind you..."] as const

  const resultText = $derived.by(() => {
    if (!showResult || isCorrect === null) return ''
    if (isCorrect) return CORRECT_PHRASES[Math.floor(Math.random() * CORRECT_PHRASES.length)]
    if (mode === 'layer') return `Not quite!`
    return WRONG_PHRASES[Math.floor(Math.random() * WRONG_PHRASES.length)]
  })

  const japaneseParts = $derived.by(() => {
    if (fact.language !== 'ja' || !fact.pronunciation) return null
    return parseJapaneseQuestion(fact.quizQuestion, fact.pronunciation)
  })

  /** Whether kana-only mode is active for Japanese questions. */
  const kanaOnly = $derived.by(() => {
    const opts = $deckOptions
    return opts?.ja?.kanaOnly ?? false
  })

  /** Parsed CJK question parts for Chinese pinyin display. */
  const chineseParts = $derived.by(() => {
    if (fact.language !== 'zh' || !fact.pronunciation) return null
    const opts = $deckOptions
    if (!(opts?.zh?.pinyin ?? true)) return null  // pinyin disabled
    return parseJapaneseQuestion(fact.quizQuestion, fact.pronunciation)
  })

  /** Whether pinyin-only mode is active for Chinese questions. */
  const pinyinOnly = $derived.by(() => {
    const opts = $deckOptions
    return opts?.zh?.pinyinOnly ?? false
  })

  /** Parsed CJK question parts for Korean romanization display. */
  const koreanParts = $derived.by(() => {
    if (fact.language !== 'ko' || !fact.pronunciation) return null
    const opts = $deckOptions
    if (!(opts?.ko?.romanization ?? false)) return null  // romanization disabled
    return parseJapaneseQuestion(fact.quizQuestion, fact.pronunciation)
  })

  const resultClass = $derived.by(() => {
    if (!showResult || isCorrect === null) return ''
    return isCorrect ? 'result-correct' : 'result-wrong'
  })

  /** CSS class applied to the quiz card for outcome animation */
  const cardOutcomeClass = $derived.by(() => {
    if (!showResult || isCorrect === null) return ''
    return isCorrect ? 'correct-animation' : 'wrong-animation'
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
    // Only reset attempts when the mode changes, not on gate retries (new fact, same gate)
    if (mode !== 'gate') {
      attemptsRemaining = totalAttempts
    }
    waitingForTap = false
  })

  /** Expression id for the GAIA reaction bubble after answering */
  const gaiaReactionExpressionId = $derived.by(() => {
    if (!showResult || isCorrect === null) return 'neutral'
    const trigger = isCorrect ? 'quiz_correct' : 'quiz_wrong'
    return getKeeperExpression(trigger, $gaiaMood).id
  })

  /** Sprite URL for the GAIA reaction bubble */
  const gaiaReactionSpriteUrl = $derived(
    GAIA_SPRITE_MAP[gaiaReactionExpressionId] ?? gaiaNeutralImg
  )

  async function handleAnswer(answer: string): Promise<void> {
    if (showResult) return

    // Haptic feedback on answer selection (Phase 38)
    await tapLight()
    playCardAudio('quiz-answer-select')

    selectedAnswer = answer
    isCorrect = answer === fact.correctAnswer
    showResult = true

    if (isCorrect) {
      audioManager.playSound('quiz_correct')
      // Haptic success notification on correct answer (Phase 38)
      await notifySuccess()
    } else {
      audioManager.playSound('quiz_wrong')
      // Haptic error notification on wrong answer (Phase 38)
      await notifyError()
    }

    if (!isCorrect && mode === 'gate') {
      attemptsRemaining = Math.max(0, attemptsRemaining - 1)
    }

    if (isCorrect) {
      if ($autoResumeAfterAnswer) {
        // Correct answer: auto-dismiss after delay scaled by answerDisplaySpeed
        const delay = Math.round(CORRECT_ANSWER_RESUME_DELAY * $answerDisplaySpeed)
        await new Promise<void>((resolve) => {
          setTimeout(resolve, turboDelay(delay))
        })
      } else {
        // Manual mode: fixed 1s delay
        await new Promise<void>((resolve) => {
          setTimeout(resolve, turboDelay(1000))
        })
      }
      onAnswer(true)
      return
    }

    // Wrong answer: show "Continue" button; auto-resume if setting is ON
    waitingForTap = true
    if ($autoResumeAfterAnswer) {
      const baseDelay = Math.min(
        WRONG_ANSWER_RESUME_BASE + fact.correctAnswer.length * WRONG_ANSWER_RESUME_PER_CHAR,
        WRONG_ANSWER_RESUME_MAX,
      )
      const delay = Math.round(baseDelay * $answerDisplaySpeed)
      autoResumeTimeoutId = setTimeout(() => {
        if (waitingForTap) {
          handleWrongAnswerTap()
        }
      }, delay)
    }
    // The "Continue" button in the template will call handleWrongAnswerTap() to dismiss early
  }

  /** Called when the player taps "Continue" after a wrong answer (or auto-resume fires). */
  function handleWrongAnswerTap(): void {
    if (!waitingForTap) return
    if (autoResumeTimeoutId !== undefined) {
      clearTimeout(autoResumeTimeoutId)
      autoResumeTimeoutId = undefined
    }
    waitingForTap = false
    playCardAudio('quiz-dismiss')

    if (mode === 'gate' && attemptsRemaining === 0) {
      onAnswer(false)
      return
    }

    if (mode === 'artifact' || mode === 'random' || mode === 'layer' || mode === 'artifact_boost') {
      onAnswer(false)
      return
    }

    // Gate mode with attempts remaining: dismiss and let QuizManager re-present with a new fact
    onAnswer(false)
  }

  function getChoiceClass(choice: string): string {
    if (!showResult || selectedAnswer !== choice || isCorrect === null) {
      return ''
    }

    return isCorrect ? 'choice-correct' : 'choice-wrong'
  }

  /** Delay (ms) for each choice button stagger animation */
  const STAGGER_DELAYS = [200, 250, 300, 350]

  /** CSS class for result animation on the selected choice button */
  function getResultAnimClass(choice: string): string {
    if (!showResult || selectedAnswer !== choice || isCorrect === null) return ''
    return isCorrect ? 'anim-correct-pulse' : 'anim-wrong-shake'
  }

  /** Select answer by index, with optional 150ms highlight flash before submitting. */
  function selectAnswerByIndex(index: number, flash = false): void {
    if (showResult) return
    if (index < 0 || index >= choices.length) return
    if (flash) {
      kbdHighlightIndex = index
      setTimeout(() => {
        kbdHighlightIndex = null
        void handleAnswer(choices[index])
      }, 150)
    } else {
      void handleAnswer(choices[index])
    }
  }

  onMount(() => {
    playCardAudio('quiz-appear')

    function handleKeyDown(e: KeyboardEvent): void {
      if (showResult) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= choices.length) {
        // In landscape use flash highlight via inputService path; portrait uses direct call
        if ($isLandscape) {
          selectAnswerByIndex(num - 1, true)
        } else {
          void handleAnswer(choices[num - 1])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // AR-76: Also wire inputService QUIZ_ANSWER for landscape keyboard shortcut
    const unsubInputService = inputService.on('QUIZ_ANSWER', (action) => {
      if (action.type !== 'QUIZ_ANSWER') return
      if (!$isLandscape) return
      selectAnswerByIndex(action.index, true)
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      unsubInputService()
    }
  })
</script>

{#if $isLandscape}
  <!-- AR-76: Landscape quiz — center stage area (left 70% of viewport, above card hand) -->
  <div class="quiz-landscape-stage" role="dialog" aria-modal="true" aria-label="Quiz Question">
    <div class={`quiz-landscape-panel quiz-card-enter ${cardOutcomeClass}`} class:high-contrast-quiz={$highContrastQuiz}>
      <button class="close-button" type="button" onclick={onClose} aria-label="Close field scan">x</button>

      {#if hasLanguageOptions && factLanguage}
        <button
          class="quiz-options-cogwheel"
          class:quiz-options-cogwheel-active={showLiveOptions}
          type="button"
          onclick={() => { showLiveOptions = !showLiveOptions }}
          aria-label="Display options"
        >⚙</button>
        {#if showLiveOptions}
          <div class="quiz-options-popup">
            <DeckOptionsPanel languageCode={factLanguage} />
          </div>
        {/if}
      {/if}

      {#if mode === 'random'}
        <p class="pop-quiz-header">Scanner ping!</p>
        <p class="pop-quiz-sub">Residual data detected...</p>
        <p class="pop-quiz-reward">Answer to earn bonus resources!</p>
      {/if}

      {#if mode === 'gate' && gateProgress}
        <p class="gate-progress">Knowledge Gate: {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
      {/if}

      {#if mode === 'artifact' && gateProgress}
        <p class="artifact-appraisal-header">Artifact Analysis {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
        <p class="artifact-appraisal-hint">Artifact uplink — your knowledge calibrates the analysis.</p>
      {/if}

      {#if mode === 'artifact_boost'}
        <p class="artifact-boost-header">Analyze This Discovery!</p>
        <p class="artifact-boost-hint">Correct answers boost the artifact's rarity before you claim it</p>
      {/if}

      {#if mode === 'layer'}
        <p class="layer-entrance-header">Depth Calibration</p>
        {#if layerChallengeProgress}
          <div class="layer-progress">
            <span class="layer-progress-text">Question {layerChallengeProgress.current} of {layerChallengeProgress.total}</span>
            <div class="layer-progress-bar">
              {#each Array(layerChallengeProgress.total) as _, i}
                <div class="layer-progress-pip" class:filled={i < layerChallengeProgress.current}></div>
              {/each}
            </div>
          </div>
        {/if}
        <p class="layer-entrance-hint">Depth calibration sequence — what do you recall?</p>
      {/if}

      {#if fact?.hasPixelArt}
        <div class="fact-art-wrapper">
          <FactArtwork factId={fact.id} size={80} />
        </div>
      {/if}

      {#if quizMode === 'image_question' && imageAssetPath}
        <div class="quiz-image-container">
          <img src={imageAssetPath} alt="Identify this" class="quiz-image" />
        </div>
      {/if}

      {#if japaneseParts}
        <p class="question {questionLengthClass}" data-testid="quiz-question">
          {japaneseParts.before}<FuriganaText text={kanaOnly && japaneseParts.reading ? japaneseParts.reading : japaneseParts.word} reading={japaneseParts.reading} size="md" />{japaneseParts.after}
        </p>
      {:else if chineseParts}
        <p class="question {questionLengthClass}" data-testid="quiz-question">
          {chineseParts.before}<FuriganaText text={pinyinOnly && chineseParts.reading ? chineseParts.reading : chineseParts.word} reading={chineseParts.reading} size="md" />{chineseParts.after}
        </p>
      {:else if koreanParts}
        <p class="question {questionLengthClass}" data-testid="quiz-question">
          {koreanParts.before}<FuriganaText text={koreanParts.word} reading={koreanParts.reading} size="md" />{koreanParts.after}
        </p>
      {:else}
        <p class="question {questionLengthClass}" data-testid="quiz-question">{displayAnswer(fact.quizQuestion)}</p>
      {/if}

      {#if mode === 'gate'}
        <p class="attempts">Attempts: {attemptsRemaining}/{totalAttempts}</p>
      {/if}

      {#if quizMode === 'image_answers' && answerImagePaths?.length}
        <div class="choices-image-grid">
          {#each choices as choice, i}
            <button
              class="image-choice-btn {getChoiceClass(choice)} {getResultAnimClass(choice)} choice-stagger"
              class:choice-kbd-highlight={kbdHighlightIndex === i}
              style="animation-delay: {STAGGER_DELAYS[i] ?? 350}ms"
              type="button"
              disabled={showResult}
              aria-label="Choice {i + 1}: {choice}"
              onclick={() => void handleAnswer(choice)}
              data-testid="quiz-answer-{i}"
            >
              <span class="key-badge" aria-hidden="true">{i + 1}</span>
              <img src={answerImagePaths[i]} alt="" class="choice-flag-img" />
              {#if showResult}
                <span class="image-choice-label">{displayAnswer(choice)}</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="choices choices-landscape" class:choices-landscape-5={choices.length === 5}>
          {#each choices as choice, i}
            <button
              class={`choice-button ${getChoiceClass(choice)} ${getResultAnimClass(choice)} choice-stagger`}
              class:choice-kbd-highlight={kbdHighlightIndex === i}
              style="animation-delay: {STAGGER_DELAYS[i] ?? 350}ms"
              type="button"
              disabled={showResult}
              aria-label="Choice {i + 1}: {choice}"
              onclick={() => void handleAnswer(choice)}
              data-testid="quiz-answer-{i}"
            >
              <span class="key-badge" aria-hidden="true">{i + 1}</span>
              <span class="choice-text">{displayAnswer(choice)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if isDev && !showResult}
        <button class="dev-skip-btn" type="button" onclick={() => onAnswer(true)}>⏭ Skip (✓)</button>
      {/if}

      {#if showResult}
        <p class={`result-text ${resultClass}`} data-testid="quiz-result-text">{resultText}</p>
      {/if}

      {#if showResult && isCorrect !== null}
        <div class="gaia-reaction" class:gaia-reaction-correct={isCorrect} class:gaia-reaction-wrong={!isCorrect} role="note" aria-label="GAIA reaction">
          <img class="gaia-reaction-sprite" src={gaiaReactionSpriteUrl} alt={`G.A.I.A. ${gaiaReactionExpressionId}`} width="28" height="28" />
          <span class="gaia-reaction-name">{KEEPER_NAME}</span>
          <span class="gaia-reaction-text" data-testid="gaia-reaction-text">
            {#if isCorrect}
              {["Great work!", "Nailed it!", "Excellent!", "Well done!"][Math.floor(Math.random() * 4)]}
            {:else}
              {["Keep at it.", "Almost!", "Not quite.", "Hmm, let me remind you..."][Math.floor(Math.random() * 4)]}
            {/if}
          </span>
        </div>
      {/if}

      {#if showMemoryTip}
        <div class="memory-tip" role="note" aria-label="Memory Tip">
          <span class="memory-tip-label">💡 Memory Tip:</span>
          <span class="memory-tip-text" data-testid="quiz-memory-tip">{memoryTipText}</span>
        </div>
      {/if}

      {#if waitingForTap}
        <button class="got-it-btn" type="button" onclick={handleWrongAnswerTap}>Continue</button>
      {/if}

      {#if showResult && isCorrect === false}
        <button class="report-fact-btn" type="button" onclick={() => (showReportModal = true)}>Report this fact</button>
      {/if}
    </div>
  </div>
{:else}
<!-- PORTRAIT: pixel-identical to pre-AR-76 implementation -->
<div class="quiz-overlay quiz-overlay-enter" class:high-contrast-quiz={$highContrastQuiz} role="dialog" aria-modal="true" aria-label="Quiz Question">
  <div class={`quiz-card quiz-card-enter ${cardOutcomeClass}`}>
    <button class="close-button" type="button" onclick={onClose} aria-label="Close field scan">
      x
    </button>

    {#if hasLanguageOptions && factLanguage}
      <button
        class="quiz-options-cogwheel"
        class:quiz-options-cogwheel-active={showLiveOptions}
        type="button"
        onclick={() => { showLiveOptions = !showLiveOptions }}
        aria-label="Display options"
      >⚙</button>
      {#if showLiveOptions}
        <div class="quiz-options-popup">
          <DeckOptionsPanel languageCode={factLanguage} />
        </div>
      {/if}
    {/if}

    {#if mode === 'random'}
      <p class="pop-quiz-header">Scanner ping!</p>
      <p class="pop-quiz-sub">Residual data detected...</p>
      <p class="pop-quiz-reward">Answer to earn bonus resources!</p>
    {/if}

    {#if mode === 'gate' && gateProgress}
      <p class="gate-progress">Knowledge Gate: {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
    {/if}

    {#if mode === 'artifact' && gateProgress}
      <p class="artifact-appraisal-header">Artifact Analysis {gateProgress.total - gateProgress.remaining + 1} / {gateProgress.total}</p>
      <p class="artifact-appraisal-hint">Artifact uplink — your knowledge calibrates the analysis.</p>
    {/if}

    {#if mode === 'artifact_boost'}
      <p class="artifact-boost-header">Analyze This Discovery!</p>
      <p class="artifact-boost-hint">Correct answers boost the artifact's rarity before you claim it</p>
    {/if}

    {#if mode === 'layer'}
      <p class="layer-entrance-header">Depth Calibration</p>
      {#if layerChallengeProgress}
        <div class="layer-progress">
          <span class="layer-progress-text">Question {layerChallengeProgress.current} of {layerChallengeProgress.total}</span>
          <div class="layer-progress-bar">
            {#each Array(layerChallengeProgress.total) as _, i}
              <div class="layer-progress-pip" class:filled={i < layerChallengeProgress.current}></div>
            {/each}
          </div>
        </div>
      {/if}
      <p class="layer-entrance-hint">Depth calibration sequence — what do you recall?</p>
    {/if}

    {#if fact?.hasPixelArt}
      <div class="fact-art-wrapper">
        <FactArtwork factId={fact.id} size={96} />
      </div>
    {/if}

    {#if quizMode === 'image_question' && imageAssetPath}
      <div class="quiz-image-container">
        <img src={imageAssetPath} alt="Identify this" class="quiz-image" />
      </div>
    {/if}

    {#if showMnemonic && !showResult}
      <div class="gaia-mnemonic-bubble">
        <img src="/assets/sprites/dome/gaia_thinking.png" alt="GAIA" class="mnemonic-avatar" width="32" height="32" />
        <div class="mnemonic-text">
          {#if mnemonic}
            <strong>GAIA:</strong> "Having trouble? Try this: <em>{mnemonic}</em>"
          {:else}
            <strong>GAIA:</strong> "You've struggled with this one. Take a moment — you've got this."
          {/if}
        </div>
      </div>
    {/if}

    {#if japaneseParts}
      <p class="question {questionLengthClass}" data-testid="quiz-question">
        {japaneseParts.before}<FuriganaText text={kanaOnly && japaneseParts.reading ? japaneseParts.reading : japaneseParts.word} reading={japaneseParts.reading} size="md" />{japaneseParts.after}
      </p>
    {:else if chineseParts}
      <p class="question {questionLengthClass}" data-testid="quiz-question">
        {chineseParts.before}<FuriganaText text={pinyinOnly && chineseParts.reading ? chineseParts.reading : chineseParts.word} reading={chineseParts.reading} size="md" />{chineseParts.after}
      </p>
    {:else if koreanParts}
      <p class="question {questionLengthClass}" data-testid="quiz-question">
        {koreanParts.before}<FuriganaText text={koreanParts.word} reading={koreanParts.reading} size="md" />{koreanParts.after}
      </p>
    {:else}
      <p class="question {questionLengthClass}" data-testid="quiz-question">{displayAnswer(fact.quizQuestion)}</p>
    {/if}

    {#if mode === 'gate'}
      <p class="attempts">Attempts: {attemptsRemaining}/{totalAttempts}</p>
    {/if}

    {#if quizMode === 'image_answers' && answerImagePaths?.length}
      <div class="choices-image-grid">
        {#each choices as choice, i}
          <button
            class="image-choice-btn {getChoiceClass(choice)} {getResultAnimClass(choice)} choice-stagger"
            style="animation-delay: {STAGGER_DELAYS[i] ?? 350}ms"
            type="button"
            disabled={showResult}
            aria-label="Choice {i + 1}: {choice}"
            onclick={() => void handleAnswer(choice)}
            data-testid="quiz-answer-{i}"
          >
            <span class="key-badge" aria-hidden="true">{i + 1}</span>
            <img src={answerImagePaths[i]} alt="" class="choice-flag-img" />
            {#if showResult}
              <span class="image-choice-label">{displayAnswer(choice)}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="choices">
        {#each choices as choice, i}
          <button
            class={`choice-button ${getChoiceClass(choice)} ${getResultAnimClass(choice)} choice-stagger`}
            style="animation-delay: {STAGGER_DELAYS[i] ?? 350}ms"
            type="button"
            disabled={showResult}
            aria-label="Choice {i + 1}: {choice}"
            onclick={() => void handleAnswer(choice)}
            data-testid="quiz-answer-{i}"
          >
            <span class="key-badge" aria-hidden="true">{i + 1}</span>
            <span class="choice-text">{displayAnswer(choice)}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if isDev && !showResult}
      <button class="dev-skip-btn" type="button" onclick={() => onAnswer(true)}>
        ⏭ Skip (✓)
      </button>
    {/if}

    {#if showResult}
      <p class={`result-text ${resultClass}`} data-testid="quiz-result-text">{resultText}</p>
    {/if}

    {#if showResult && isCorrect !== null}
      <div class="gaia-reaction" class:gaia-reaction-correct={isCorrect} class:gaia-reaction-wrong={!isCorrect} role="note" aria-label="GAIA reaction">
        <img class="gaia-reaction-sprite" src={gaiaReactionSpriteUrl} alt={`G.A.I.A. ${gaiaReactionExpressionId}`} width="28" height="28" />
        <span class="gaia-reaction-name">{KEEPER_NAME}</span>
        <span class="gaia-reaction-text" data-testid="gaia-reaction-text">
          {#if isCorrect}
            {["Great work!", "Nailed it!", "Excellent!", "Well done!"][Math.floor(Math.random() * 4)]}
          {:else}
            {["Keep at it.", "Almost!", "Not quite.", "Hmm, let me remind you..."][Math.floor(Math.random() * 4)]}
          {/if}
        </span>
      </div>
    {/if}

    {#if showResult && isCorrect === false && isConsistencyPenalty}
      <p class="consistency-penalty-warning" data-testid="quiz-consistency-warning">Consistency check — you knew this one!</p>
    {/if}

    {#if showMemoryTip}
      <div class="memory-tip" role="note" aria-label="Memory Tip">
        <span class="memory-tip-label">💡 Memory Tip:</span>
        <span class="memory-tip-text" data-testid="quiz-memory-tip">{memoryTipText}</span>
      </div>
    {/if}

    {#if responseMode === 'three_button' && showResult}
      <div class="study-response-buttons">
        <button class="btn-study btn-easy" type="button" onclick={() => onStudyResponse?.(5)}>
          Easy
        </button>
        <button class="btn-study btn-got-it" type="button" onclick={() => onStudyResponse?.(4)}>
          Got it
        </button>
        <button class="btn-study btn-didnt" type="button" onclick={() => onStudyResponse?.(1)}>
          Didn't get it
        </button>
      </div>
    {/if}

    {#if waitingForTap}
      <button class="got-it-btn" type="button" onclick={handleWrongAnswerTap}>
        Continue
      </button>
    {/if}

    {#if showResult && isCorrect === true}
      {#if $playerSave?.ageRating === 'kid'}
        {@const reviewState = $playerSave.reviewStates.find(r => r.factId === fact.id)}
        <div class="wow-stars-result">
          <KidWowStars score={getWowScore(reviewState)} />
        </div>
      {/if}
    {/if}

    {#if showResult && isCorrect === false}
      <button class="report-fact-btn" type="button" onclick={() => (showReportModal = true)}>
        Report this fact
      </button>
    {/if}
  </div>
</div>
{/if}<!-- end landscape/portrait branch -->

{#if showReportModal}
  <ReportModal factId={fact.id} onClose={() => (showReportModal = false)} />
{/if}

<style>
  /* ── Outcome animations (dust-burst for correct, border-ripple for wrong) ── */
  @keyframes dust-burst {
    0%   { transform: scale(1); opacity: 1; }
    50%  { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes border-ripple {
    0%   { box-shadow: inset 0 0 0 0 rgba(160, 144, 96, 0.5); }
    50%  { box-shadow: inset 0 0 8px 2px rgba(160, 144, 96, 0.3); }
    100% { box-shadow: inset 0 0 0 0 rgba(160, 144, 96, 0); }
  }

  .correct-animation {
    animation: dust-burst 800ms ease-out;
  }

  /* Kid Mode Wow Stars result display */
  .wow-stars-result {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .wrong-animation {
    animation: border-ripple 1200ms ease-out;
  }

  /* ── Entry animations ─────────────────────────────────────────────────── */
  @keyframes overlay-fade-in {
    from { background: rgba(0, 0, 0, 0); }
    to   { background: rgba(0, 0, 0, 0.85); }
  }

  @keyframes card-slide-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes choice-appear {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Result animations ────────────────────────────────────────────────── */
  @keyframes correct-pulse {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.02); }
    100% { transform: scale(1); }
  }

  @keyframes wrong-shake {
    0%   { transform: translateX(0); }
    20%  { transform: translateX(-4px); }
    40%  { transform: translateX(4px); }
    70%  { transform: translateX(-2px); }
    100% { transform: translateX(0); }
  }

  .quiz-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 210;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.85);
    font-family: 'Courier New', monospace;
  }

  .quiz-overlay-enter {
    animation: overlay-fade-in 300ms ease-out both;
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

  .quiz-card-enter {
    animation: card-slide-up 400ms cubic-bezier(0.22, 0.61, 0.36, 1) 100ms both;
  }

  .close-button {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
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
    font-size: calc(0.9rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    text-transform: uppercase;
    margin-top: calc(0.25rem * var(--layout-scale, 1));
    opacity: 0.85;
  }

  .pop-quiz-sub {
    text-align: center;
    color: var(--color-text-dim);
    font-size: calc(0.8rem * var(--layout-scale, 1));
    font-style: italic;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    margin-top: calc(-0.5rem * var(--layout-scale, 1));
    opacity: 0.8;
  }

  .pop-quiz-reward {
    text-align: center;
    color: var(--color-text-dim);
    font-size: calc(0.85rem * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    margin-top: calc(-0.4rem * var(--layout-scale, 1));
  }

  .gate-progress {
    text-align: center;
    color: var(--color-warning);
    font-size: calc(0.9rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    margin-top: calc(0.25rem * var(--layout-scale, 1));
  }

  .artifact-appraisal-header {
    text-align: center;
    color: #e94560;
    font-size: calc(0.85rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    margin-top: calc(0.25rem * var(--layout-scale, 1));
  }

  .artifact-appraisal-hint {
    text-align: center;
    color: var(--color-text-dim);
    font-size: calc(0.85rem * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    margin-top: calc(-0.4rem * var(--layout-scale, 1));
    font-style: italic;
  }

  .layer-entrance-header {
    text-align: center;
    color: #9966ff;
    font-size: calc(0.85rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    margin-top: calc(0.25rem * var(--layout-scale, 1));
  }

  .layer-entrance-hint {
    text-align: center;
    color: var(--color-text-dim);
    font-size: calc(0.85rem * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    margin-top: calc(-0.4rem * var(--layout-scale, 1));
    font-style: italic;
  }

  /* ── Image quiz modes ─────────────────────────────────────────────────── */

  .quiz-image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: calc(12px * var(--layout-scale, 1));
  }

  .quiz-image {
    width: calc(200px * var(--layout-scale, 1));
    height: auto;
    max-height: calc(140px * var(--layout-scale, 1));
    object-fit: contain;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: calc(4px * var(--layout-scale, 1));
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  .choices-image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(12px * var(--layout-scale, 1));
    max-width: calc(500px * var(--layout-scale, 1));
    margin: 0 auto;
  }

  .image-choice-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(8px * var(--layout-scale, 1));
    border: calc(2px * var(--layout-scale, 1)) solid rgba(255, 255, 255, 0.2);
    border-radius: calc(8px * var(--layout-scale, 1));
    background: var(--card-bg, rgba(0, 0, 0, 0.3));
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s;
  }

  .image-choice-btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.5);
    transform: scale(1.02);
  }

  .image-choice-btn .key-badge {
    position: absolute;
    top: calc(4px * var(--layout-scale, 1));
    left: calc(4px * var(--layout-scale, 1));
    z-index: 1;
  }

  .choice-flag-img {
    width: 100%;
    height: auto;
    max-height: calc(100px * var(--layout-scale, 1));
    object-fit: contain;
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .image-choice-label {
    margin-top: calc(4px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
  }

  .image-choice-btn.choice-correct {
    border-color: #4ecca3;
    background: rgba(78, 204, 163, 0.15);
  }

  .image-choice-btn.choice-wrong {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.15);
  }

  .image-choice-btn.anim-correct-pulse {
    animation: correct-pulse 600ms ease-out;
  }

  .image-choice-btn.anim-wrong-shake {
    animation: wrong-shake 400ms ease-out;
  }

  .question {
    margin-top: calc(0.5rem * var(--layout-scale, 1));
    color: var(--color-warning);
    font-size: calc(1.1rem * var(--layout-scale, 1));
    line-height: 1.4;
    text-align: center;
  }

  /* AR-221: Auto-scaling font sizes based on question character count */
  .question.quiz-text-short {
    font-size: calc(22px * var(--text-scale, 1));
  }

  .question.quiz-text-medium {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .question.quiz-text-long {
    font-size: calc(14px * var(--text-scale, 1));
  }

  .attempts {
    color: var(--color-text-dim);
    font-size: calc(0.95rem * var(--layout-scale, 1));
    text-align: center;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: calc(0.7rem * var(--layout-scale, 1));
  }

  .choice-button {
    min-height: calc(58px * var(--layout-scale, 1));
    width: 100%;
    border: 2px solid var(--color-primary);
    border-radius: 999px;
    padding: calc(0.85rem * var(--layout-scale, 1)) calc(1.25rem * var(--layout-scale, 1));
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: calc(1.05rem * var(--layout-scale, 1));
    text-align: center;
    cursor: pointer;
    transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
    /* Always flex so key-badge is visible */
    display: flex;
    align-items: center;
    gap: calc(0.5rem * var(--layout-scale, 1));
  }

  .choice-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .choice-button:disabled {
    opacity: 0.95;
    cursor: default;
  }

  .choice-stagger {
    opacity: 0;
    animation: choice-appear 280ms ease-out both;
  }

  .anim-correct-pulse {
    animation: correct-pulse 400ms ease-out both !important;
  }

  .anim-wrong-shake {
    animation: wrong-shake 380ms ease-out both !important;
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

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    font-size: calc(0.7rem * var(--layout-scale, 1));
    margin-right: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .choice-text {
    flex: 1;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .result-text {
    min-height: calc(1.4rem * var(--layout-scale, 1));
    font-size: calc(1rem * var(--layout-scale, 1));
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
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    margin-top: calc(12px * var(--layout-scale, 1));
    font-size: calc(0.85rem * var(--layout-scale, 1));
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .memory-tip-label {
    color: #4ecdc4;
    font-weight: 700;
    font-size: calc(0.8rem * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
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
    font-size: calc(0.82rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    border: 1px solid #ff6b35;
    border-radius: 6px;
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: rgba(255, 107, 53, 0.08);
    margin-top: calc(-4px * var(--layout-scale, 1));
  }

  /* 3-button study response row */
  .study-response-buttons {
    display: flex;
    gap: calc(0.5rem * var(--layout-scale, 1));
    justify-content: center;
    margin-top: calc(1rem * var(--layout-scale, 1));
  }

  .btn-study {
    padding: calc(0.5rem * var(--layout-scale, 1)) calc(1rem * var(--layout-scale, 1));
    border: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: calc(0.85rem * var(--layout-scale, 1));
    cursor: pointer;
    font-weight: bold;
  }

  .btn-easy { background: #27ae60; color: white; }
  .btn-got-it { background: #2980b9; color: white; }
  .btn-didnt { background: #c0392b; color: white; }

  /* GAIA reaction bubble shown after answering */
  .gaia-reaction {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: 8px;
    border-left: 3px solid var(--color-primary);
    background: rgba(78, 100, 205, 0.1);
    font-size: calc(0.82rem * var(--layout-scale, 1));
    margin-top: calc(-4px * var(--layout-scale, 1));
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

  .gaia-reaction-sprite {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
    border-radius: 4px;
  }

  .gaia-reaction-name {
    color: #22d9d9;
    font-size: calc(0.68rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .gaia-reaction-text {
    color: var(--color-text-dim);
    font-style: italic;
  }

  .report-fact-btn {
    align-self: center;
    background: transparent;
    border: none;
    color: var(--color-text-dim);
    font: inherit;
    font-size: calc(0.75rem * var(--layout-scale, 1));
    cursor: pointer;
    padding: calc(0.25rem * var(--layout-scale, 1)) calc(0.5rem * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    text-decoration: underline;
    opacity: 0.7;
  }

  .report-fact-btn:hover {
    opacity: 1;
    color: var(--color-text);
  }

  .fact-art-wrapper {
    display: flex;
    justify-content: center;
    margin: calc(8px * var(--layout-scale, 1)) 0 calc(12px * var(--layout-scale, 1));
  }

  /** Tap-to-continue button shown after a wrong answer */
  .got-it-btn {
    align-self: center;
    margin-top: calc(0.5rem * var(--layout-scale, 1));
    padding: calc(0.75rem * var(--layout-scale, 1)) calc(2rem * var(--layout-scale, 1));
    background: linear-gradient(135deg, #c85c5c, #a04040);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-family: monospace;
    font-size: calc(0.95rem * var(--layout-scale, 1));
    font-weight: bold;
    cursor: pointer;
    min-height: calc(48px * var(--layout-scale, 1));
    min-width: calc(160px * var(--layout-scale, 1));
    letter-spacing: 0.02em;
    transition: transform 0.1s, filter 0.1s;
    animation: fadeIn 0.3s ease-out;
  }

  .got-it-btn:hover {
    filter: brightness(1.15);
  }

  .got-it-btn:active {
    transform: scale(0.97);
  }

  .dev-skip-btn {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    background: rgba(255, 50, 50, 0.8);
    color: white;
    border: 1px solid #ff6666;
    padding: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-family: var(--font-rpg);
    font-size: calc(0.55rem * var(--layout-scale, 1));
    cursor: pointer;
    border-radius: 4px;
    z-index: 100;
  }

  /* Phase 52: GAIA mnemonic bubble */
  .gaia-mnemonic-bubble {
    display: flex;
    align-items: flex-start;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(100, 200, 255, 0.1);
    border: 1px solid rgba(100, 200, 255, 0.25);
    border-radius: 10px;
    margin-bottom: calc(0.25rem * var(--layout-scale, 1));
    animation: mnemonic-fade-in 400ms ease-out;
  }

  .mnemonic-avatar {
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid rgba(100, 200, 255, 0.3);
  }

  .mnemonic-text {
    font-size: calc(0.82rem * var(--layout-scale, 1));
    color: #b0d4f1;
    line-height: 1.4;
  }

  .mnemonic-text em {
    color: #88ddff;
  }

  @keyframes mnemonic-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Phase 52: Layer challenge progress */
  .layer-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-top: calc(-0.25rem * var(--layout-scale, 1));
  }

  .layer-progress-text {
    font-size: calc(0.78rem * var(--layout-scale, 1));
    color: #bb99ff;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
  }

  .layer-progress-bar {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .layer-progress-pip {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(6px * var(--layout-scale, 1));
    border-radius: 3px;
    background: rgba(153, 102, 255, 0.2);
    border: 1px solid rgba(153, 102, 255, 0.3);
    transition: background 300ms ease;
  }

  .layer-progress-pip.filled {
    background: #9966ff;
    border-color: #bb99ff;
    box-shadow: 0 0 6px rgba(153, 102, 255, 0.5);
  }

  /* Phase 52: Artifact boost mode */
  .artifact-boost-header {
    text-align: center;
    color: #ffd369;
    font-size: calc(0.9rem * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    text-transform: uppercase;
    margin-top: calc(0.25rem * var(--layout-scale, 1));
  }

  .artifact-boost-hint {
    text-align: center;
    color: var(--color-text-dim);
    font-size: calc(0.82rem * var(--layout-scale, 1));
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    margin-top: calc(-0.4rem * var(--layout-scale, 1));
    font-style: italic;
  }

  /* ── AR-76: Landscape quiz layout ─────────────────────────────────────── */

  /**
   * Transparent backdrop covering center stage (left 70%, above 26vh card hand).
   * Does NOT cover the right-30% enemy panel.
   */
  .quiz-landscape-stage {
    position: fixed;
    left: 0;
    right: 30%;
    top: 0;
    bottom: 26vh;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    /* subtle backdrop only in center stage */
    background: rgba(0, 0, 0, 0.45);
    font-family: 'Courier New', monospace;
    animation: landscape-stage-fade-in 200ms ease-out both;
  }

  @keyframes landscape-stage-fade-in {
    from { background: rgba(0, 0, 0, 0); }
    to   { background: rgba(0, 0, 0, 0.45); }
  }

  /** The quiz card panel inside the center stage */
  .quiz-landscape-panel {
    position: relative;
    width: min(50vw, calc(640px * var(--layout-scale, 1)));
    max-width: min(50vw, calc(640px * var(--layout-scale, 1)));
    max-height: calc(74vh - 26vh);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 2px solid var(--color-primary);
    border-radius: 16px;
    padding: 1.1rem 1.25rem;
    background: var(--color-surface);
    color: var(--color-text);
    pointer-events: auto;
  }

  .quiz-landscape-panel::-webkit-scrollbar {
    display: none;
  }

  /** Landscape answer grid: 2 columns for 3-4 options, 3+2 for 5 */
  .choices-landscape {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    flex-direction: unset;
  }

  /** 5-option landscape: first 3 in top row via spanning trick */
  .choices-landscape-5 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  /** Keyboard shortcut flash highlight (landscape) */
  .choice-kbd-highlight {
    border-color: #60a5fa !important;
    background: rgba(96, 165, 250, 0.15) !important;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35);
  }

  /* ── Language options cogwheel (in-quiz) ──────────────────────────────── */
  .quiz-options-cogwheel {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(12px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.35);
    font-size: calc(22px * var(--text-scale, 1));
    transition: color 0.15s, background 0.15s;
    z-index: 10;
    padding: 0;
  }

  .quiz-options-cogwheel:hover {
    color: rgba(255, 255, 255, 0.75);
    background: rgba(255, 255, 255, 0.08);
  }

  .quiz-options-cogwheel.quiz-options-cogwheel-active {
    color: #4a9eff;
    background: rgba(74, 158, 255, 0.12);
  }

  .quiz-options-popup {
    position: absolute;
    top: calc(48px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    width: calc(280px * var(--layout-scale, 1));
    z-index: 20;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border-radius: calc(10px * var(--layout-scale, 1));
  }
</style>
