<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getChainColor, getChainGlowColor } from '../../services/chainVisuals'
  import { getDomainIconPath } from '../utils/domainAssets'
  import { getBorderUrl, getBannerUrl, getBaseFrameUrl, getUpgradeIconUrl } from '../utils/cardFrameV2'
  import { getTierDisplayName } from '../../services/tierDerivation'
  import { getCardTypeEmoji, getCardTypeIconCandidates } from '../utils/iconAssets'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { getMasteryBaseBonus } from '../../services/cardUpgradeService'
  import {
    CHARGE_CORRECT_MULTIPLIER,
    CORRECT_ANSWER_RESUME_DELAY,
    WRONG_ANSWER_RESUME_BASE,
    WRONG_ANSWER_RESUME_PER_CHAR,
    WRONG_ANSWER_RESUME_MAX,
  } from '../../data/balance'
  import { answerDisplaySpeed, autoResumeAfterAnswer } from '../stores/settings'
  import KeywordPopup from './KeywordPopup.svelte'
  import FuriganaText from '../FuriganaText.svelte'
  import { deckOptions } from '../../services/deckOptionsService'

  interface Props {
    card: Card
    question: string
    answers: string[]
    correctAnswer: string
    timerDuration: number
    timerEnabled?: boolean
    hintsRemaining: number
    speedBonusThreshold?: number
    timerColorVariant?: 'default' | 'gold' | 'slowReader'
    showMasteryTrialHeader?: boolean
    highlightHint?: boolean
    allowCancel?: boolean
    questionImageUrl?: string
    /** AR-220: When true, show the charged effect value (1.5x + mastery bonus) instead of base. */
    isCharging?: boolean
    /** Language code of the quiz fact (e.g. 'ja'). Used for furigana rendering. */
    factLanguage?: string
    /** Pronunciation/reading string from the fact. Used to parse furigana from the question. */
    factPronunciation?: string
    onanswer: (answerIndex: number, isCorrect: boolean, speedBonus: boolean) => void
    onskip: () => void
    oncancel: () => void
    onusehint?: () => void
  }

  let {
    card,
    question,
    answers,
    correctAnswer,
    timerDuration,
    timerEnabled = true,
    hintsRemaining,
    speedBonusThreshold = 0.25,
    timerColorVariant = 'default',
    showMasteryTrialHeader = false,
    highlightHint = false,
    allowCancel = true,
    questionImageUrl,
    isCharging = true,
    factLanguage,
    factPronunciation,
    onanswer,
    onskip,
    oncancel,
    onusehint = () => {},
  }: Props = $props()

  const EFFECT_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal N Damage',
    shield: 'Block N Damage',
    buff: 'Buff +N%',
    debuff: 'Apply Debuff',
    utility: 'Utility',
    wild: 'Adaptive',
  }

  let chargedEffectValue = $derived.by(() => {
    const mechanic = getMechanicDefinition(card.mechanicId)
    const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0)
    if (mechanic) {
      return Math.round(mechanic.quickPlayValue * CHARGE_CORRECT_MULTIPLIER) + masteryBonus
    }
    return Math.round(card.baseEffectValue * card.effectMultiplier) + masteryBonus
  })
  let effectValue = $derived(isCharging ? chargedEffectValue : Math.round(card.baseEffectValue * card.effectMultiplier))
  let effectDescription = $derived(
    EFFECT_DESCRIPTIONS[card.cardType].replace('N', String(effectValue)),
  )
  let domainColor = $derived(getDomainMetadata(card.domain).colorTint)
  let domainName = $derived(getDomainMetadata(card.domain).displayName)
  let typeIconCandidates = $derived(getCardTypeIconCandidates(card.cardType))
  let typeIconFallback = $derived(getCardTypeEmoji(card.cardType))
  let typeIconAttempt = $state(0)
  let typeIconPath = $derived(typeIconCandidates[typeIconAttempt] ?? null)
  let tierLabel = $derived(card.tier === '1' ? '' : getTierDisplayName(card.tier))
  // V2: frame is now rendered as layered images, not a CSS background variable
  let domainIconPath = $derived(getDomainIconPath(card.domain))

  const TIMER_UPDATE_INTERVAL_MS = 33

  let startTime = $state(0)
  let lastTimerUpdateMs = 0
  let elapsed = $state(0)
  let timerTotalMs = $state(1000)
  let timerFraction = $derived(Math.max(0, 1 - elapsed / timerTotalMs))
  let secondsRemaining = $derived(Math.max(0, Math.ceil((timerTotalMs - elapsed) / 1000)))
  let timerColor = $derived.by(() => {
    if (timerColorVariant === 'gold') {
      return timerFraction > 0.5 ? '#D4AF37' : timerFraction > 0.25 ? '#F1C40F' : '#E67E22'
    }
    if (timerColorVariant === 'slowReader') {
      return timerFraction > 0.5 ? '#D88D24' : timerFraction > 0.25 ? '#F0B44D' : '#B86A0F'
    }
    return timerFraction > 0.5 ? '#27AE60' : timerFraction > 0.25 ? '#F1C40F' : '#E74C3C'
  })

  let selectedAnswerIndex = $state<number | null>(null)
  let answerRevealed = $state(false)
  let answersDisabled = $state(false)
  /** Landscape-only: shows CORRECT/WRONG flash overlay for 500ms after answering. */
  let quizResultState = $state<'correct' | 'wrong' | null>(null)
  let showSpeedBonus = $state(false)
  let timerExpired = $state(false)
  let waitingForGotIt = $state(false)
  let showTimerExpiredLabel = $state(false)
  let touchStartY = $state<number | null>(null)
  let showHintMenu = $state(false)
  let hintUsed = $state(false)
  let firstLetterHint = $state<string | null>(null)
  let eliminatedIndices = $state<Set<number>>(new Set())
  let activeKeyword = $state<{ id: string; x: number; y: number } | null>(null)

  /** CSS class for question text auto-scaling based on character count. */
  let questionLengthClass = $derived.by(() => {
    const len = question.length
    if (len < 30) return 'quiz-text-short'
    if (len < 80) return 'quiz-text-medium'
    return 'quiz-text-long'
  })

  /** Whether the current fact is Japanese. */
  const isJapaneseFact = $derived(factLanguage === 'ja')

  /** Whether kana-only mode is active (read from deckOptions store). */
  const kanaOnly = $derived.by(() => {
    if (!isJapaneseFact) return false
    return $deckOptions?.ja?.kanaOnly ?? false
  })

  /**
   * Parse a Japanese question into { before, word, reading, after } parts.
   * Mirrors parseJapaneseQuestion from QuizOverlay.
   * Expects format: "What does '食べる' (たべる) mean..." or "What does '食べる' mean..."
   * Returns null if the question cannot be parsed.
   */
  function parseJapaneseQuestion(q: string, pronunciation?: string): { before: string; word: string; reading: string; after: string } | null {
    const match = q.match(/^(.*?)'([^']+)'(?:\s*\(([^)]+)\))?\s*(.*)$/)
    if (!match) return null
    const [, before, word, inlineReading, after] = match
    const reading = inlineReading ?? pronunciation ?? ''
    if (!reading) return null
    return { before: before ?? '', word, reading, after: after ?? '' }
  }

  /**
   * Parsed Japanese parts for the question, or null for non-Japanese / unparseable questions.
   */
  const japaneseParts = $derived.by(() => {
    if (!isJapaneseFact || !factPronunciation) return null
    return parseJapaneseQuestion(question, factPronunciation)
  })

  /**
   * Check if a text string contains Japanese characters (kanji, hiragana, katakana).
   */
  function hasJapanese(text: string): boolean {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)
  }

  /** Index of the answer button currently highlighted by keyboard input (150ms flash). */
  let keyboardHighlightIndex = $state<number | null>(null)

  function handleKeywordTap(e: MouseEvent, keywordId: string): void {
    activeKeyword = { id: keywordId, x: e.clientX, y: e.clientY }
  }

  function dismissKeyword(): void {
    activeKeyword = null
  }

  let rafId: number | undefined
  let feedbackTimeoutId: ReturnType<typeof setTimeout> | undefined
  let correctRevealTimeoutId: ReturnType<typeof setTimeout> | undefined
  let speedBonusTimeoutId: ReturnType<typeof setTimeout> | undefined
  let quizResultTimeoutId: ReturnType<typeof setTimeout> | undefined
  let timerExpiredLabelTimeoutId: ReturnType<typeof setTimeout> | undefined
  let autoResumeTimeoutId: ReturnType<typeof setTimeout> | undefined

  function timerTick(now: number): void {
    if (!timerEnabled || answersDisabled || timerExpired) return
    const nextElapsed = now - startTime
    if (nextElapsed >= timerTotalMs) {
      elapsed = timerTotalMs
      timerExpired = true
      return
    }
    if ((nextElapsed - lastTimerUpdateMs) >= TIMER_UPDATE_INTERVAL_MS) {
      elapsed = nextElapsed
      lastTimerUpdateMs = nextElapsed
    }
    rafId = requestAnimationFrame(timerTick)
  }

  $effect(() => {
    timerTotalMs = Math.max(1000, timerDuration * 1000)
    startTime = performance.now()
    lastTimerUpdateMs = 0
    elapsed = 0
    timerExpired = false
    waitingForGotIt = false
    showTimerExpiredLabel = false
    showHintMenu = false
    hintUsed = false
    firstLetterHint = null
    eliminatedIndices = new Set()
    if (timerEnabled) {
      rafId = requestAnimationFrame(timerTick)
    }
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
      if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
      if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
      if (quizResultTimeoutId !== undefined) clearTimeout(quizResultTimeoutId)
      if (timerExpiredLabelTimeoutId !== undefined) clearTimeout(timerExpiredLabelTimeoutId)
      if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
    }
  })

  $effect(() => {
    if (timerExpired) {
      showTimerExpiredLabel = true
      timerExpiredLabelTimeoutId = setTimeout(() => {
        showTimerExpiredLabel = false
      }, 2000)
    }
  })

  $effect(() => {
    card.cardType
    typeIconAttempt = 0
  })

  function handleAnswer(index: number): void {
    if (answersDisabled || eliminatedIndices.has(index)) return
    answersDisabled = true
    selectedAnswerIndex = index

    const isCorrect = answers[index] === correctAnswer
    const elapsedNow = timerEnabled
      ? Math.min(timerTotalMs, Math.max(elapsed, performance.now() - startTime))
      : elapsed
    elapsed = elapsedNow
    const speedBonus = timerEnabled
      ? elapsedNow < (timerTotalMs * speedBonusThreshold)
      : false
    if (isCorrect && speedBonus) {
      showSpeedBonus = true
      speedBonusTimeoutId = setTimeout(() => {
        showSpeedBonus = false
      }, 500)
    }

    if (!isCorrect) {
      correctRevealTimeoutId = setTimeout(() => {
        answerRevealed = true
        waitingForGotIt = true
      }, 800)
    } else {
      answerRevealed = true
    }

    // Landscape quiz result overlay — flash for 500ms then clear
    if ($isLandscape) {
      quizResultState = isCorrect ? 'correct' : 'wrong'
      quizResultTimeoutId = setTimeout(() => {
        quizResultState = null
      }, 500)
    }

    if ($autoResumeAfterAnswer) {
      // Auto-resume: calculate delay based on correct/wrong and answer display speed
      const speed = $answerDisplaySpeed
      if (isCorrect) {
        const delay = Math.round(CORRECT_ANSWER_RESUME_DELAY * speed)
        feedbackTimeoutId = setTimeout(() => {
          onanswer(index, isCorrect, speedBonus)
        }, delay)
      } else {
        // Wrong: show answer for long enough to read it based on answer length
        const baseDelay = Math.min(
          WRONG_ANSWER_RESUME_BASE + correctAnswer.length * WRONG_ANSWER_RESUME_PER_CHAR,
          WRONG_ANSWER_RESUME_MAX,
        )
        const delay = Math.round(baseDelay * speed)
        autoResumeTimeoutId = setTimeout(() => {
          if (waitingForGotIt) {
            waitingForGotIt = false
            onanswer(index, false, false)
          }
        }, delay)
      }
    } else {
      // Manual mode: correct auto-dismisses after 1600ms, wrong waits for "Continue"
      if (isCorrect) {
        feedbackTimeoutId = setTimeout(() => {
          onanswer(index, isCorrect, speedBonus)
        }, 1600)
      }
      // Wrong answers wait for "Continue" button tap — no auto-dismiss
    }
  }

  function getAnswerClass(index: number): string {
    if (eliminatedIndices.has(index)) return 'answer-eliminated'
    if (selectedAnswerIndex === null) return ''
    const isCorrect = answers[index] === correctAnswer
    if (index === selectedAnswerIndex) {
      return isCorrect ? 'answer-correct' : 'answer-wrong'
    }
    if (answerRevealed && isCorrect) {
      return 'answer-reveal-correct'
    }
    return ''
  }

  function handleTouchStart(e: TouchEvent): void {
    touchStartY = e.touches[0].clientY
  }

  function handleTouchMove(e: TouchEvent): void {
    if (!allowCancel) return
    if (touchStartY === null) return
    const deltaY = e.touches[0].clientY - touchStartY
    if (deltaY > 40) {
      touchStartY = null
      oncancel()
    }
  }

  function handleTouchEnd(): void {
    touchStartY = null
  }

  function toggleHintMenu(): void {
    if (answersDisabled || hintsRemaining <= 0 || hintUsed) return
    showHintMenu = !showHintMenu
  }

  function applyHint(type: 'eliminate' | 'time_boost' | 'first_letter'): void {
    if (hintUsed || answersDisabled || hintsRemaining <= 0) return

    if (type === 'eliminate') {
      const wrongIndices = answers
        .map((answer, index) => ({ answer, index }))
        .filter((entry) => entry.answer !== correctAnswer && !eliminatedIndices.has(entry.index))
      if (wrongIndices.length > 0) {
        const removeIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)].index
        eliminatedIndices = new Set([...eliminatedIndices, removeIndex])
      }
    } else if (type === 'time_boost') {
      timerTotalMs += 5000
    } else {
      firstLetterHint = correctAnswer[0] ?? null
    }

    hintUsed = true
    showHintMenu = false
    onusehint()
  }

  let kbdHighlightTimeoutId: ReturnType<typeof setTimeout> | undefined

  /**
   * Handle a QUIZ_ANSWER action from the input service (landscape keyboard shortcut).
   * Briefly highlights the button (150 ms) before submitting, so the player can see
   * which answer was selected before it is processed.
   */
  function handleKeyboardAnswer(index: number): void {
    if (answersDisabled || eliminatedIndices.has(index)) return
    if (index < 0 || index >= answers.length) return

    keyboardHighlightIndex = index
    kbdHighlightTimeoutId = setTimeout(() => {
      keyboardHighlightIndex = null
      handleAnswer(index)
    }, 150)
  }

  onMount(() => {
    const unsub = inputService.on('QUIZ_ANSWER', (action) => {
      if (action.type !== 'QUIZ_ANSWER') return
      if (!$isLandscape) return
      handleKeyboardAnswer(action.index)
    })
    return unsub
  })

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
    if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
    if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
    if (kbdHighlightTimeoutId !== undefined) clearTimeout(kbdHighlightTimeoutId)
    if (quizResultTimeoutId !== undefined) clearTimeout(quizResultTimeoutId)
    if (timerExpiredLabelTimeoutId !== undefined) clearTimeout(timerExpiredLabelTimeoutId)
    if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
  })
</script>

<div
  class="card-expanded"
  class:card-expanded-landscape={$isLandscape}
  style={`border: 1px solid ${getChainColor(card.chainType ?? 0)}; box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), 0 0 12px ${getChainGlowColor(card.chainType ?? 0)};`}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-label="Card question"
  tabindex="-1"
>
  <!-- V2 frame removed from expanded quiz view — quiz has its own UI -->

  {#if showMasteryTrialHeader}
    <div class="mastery-trial-header">MASTERY TRIAL</div>
  {/if}

  <div class="card-header">
    <span class="header-domain">
      <img class="header-domain-icon" src={domainIconPath} alt={`${domainName} icon`} />
      {domainName}
      {#if tierLabel}
        <span class="tier-stars">{tierLabel}</span>
      {/if}
    </span>
    <span class="header-icon">
      {#if typeIconPath}
        <img
          class="header-type-icon"
          src={typeIconPath}
          alt=""
          onerror={() => { typeIconAttempt += 1 }}
        />
      {:else}
        <span>{typeIconFallback}</span>
      {/if}
    </span>
  </div>

  <div class="card-effect-desc">
    <span class="effect-value">{effectValue}</span>
    <span class="effect-label">{EFFECT_DESCRIPTIONS[card.cardType].replace('N', '').trim()}</span>
  </div>
  <div class="expanded-desc-parts">
    {#each getCardDescriptionParts(card, undefined, isCharging ? chargedEffectValue : undefined) as part}
      {#if part.type === 'number'}
        <span class="exp-desc-number">{part.value}</span>
      {:else if part.type === 'keyword'}
        <button class="exp-desc-keyword" onclick={(e) => handleKeywordTap(e, part.keywordId)}>{part.value}</button>
      {:else if part.type === 'conditional-number'}
        <span class="exp-desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
      {:else}
        {part.value}
      {/if}
    {/each}
  </div>
  {#if questionImageUrl}
    <div class="question-image-container">
      <img
        class="question-image"
        src={questionImageUrl}
        alt="Question illustration"
        onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  {/if}
  <div class="card-question {questionLengthClass}">
    {#if japaneseParts}
      {japaneseParts.before}<FuriganaText
        text={kanaOnly && japaneseParts.reading ? japaneseParts.reading : japaneseParts.word}
        reading={japaneseParts.reading}
        size="md"
      />{japaneseParts.after}
    {:else}
      {question}
    {/if}
  </div>
  {#if firstLetterHint}
    <div class="first-letter-hint">Starts with: {firstLetterHint}</div>
  {/if}

  {#if timerEnabled}
    <div class="timer-bar-container">
      <div
        class="timer-bar-fill"
        style="--fraction: {timerFraction}; background: {timerExpired ? '#64748b' : timerColor};"
      ></div>
      <div
        class="speed-bonus-marker"
        style="left: {(1 - speedBonusThreshold) * 100}%"
      ></div>
      <span class="timer-seconds">{secondsRemaining}s</span>
    </div>
    {#if showTimerExpiredLabel}
      <div class="timer-expired-label" aria-live="polite" role="status">Speed Bonus lost!</div>
    {/if}
  {/if}

  <div
    class="card-answers"
    class:card-answers-landscape={$isLandscape}
    class:card-answers-landscape-2={$isLandscape && answers.length === 2}
    class:card-answers-landscape-3={$isLandscape && answers.length === 3}
    class:card-answers-landscape-4={$isLandscape && answers.length >= 4}
  >
    {#each answers as answer, i}
      <button
        class="answer-btn {getAnswerClass(i)}"
        class:answer-kbd-highlight={keyboardHighlightIndex === i}
        data-testid="quiz-answer-{i}"
        disabled={answersDisabled || eliminatedIndices.has(i)}
        aria-label={eliminatedIndices.has(i) ? `${answer} — eliminated by hint` : answer}
        onclick={() => handleAnswer(i)}
      >
        {#if $isLandscape}
          <span class="kbd-hint" aria-hidden="true">{i + 1}</span>
        {/if}
        {#if isJapaneseFact && hasJapanese(answer)}
          <FuriganaText text={answer} size="sm" />
        {:else}
          {answer}
        {/if}
      </button>
    {/each}
  </div>

  {#if waitingForGotIt}
    <button
      class="got-it-btn"
      onclick={() => {
        if (autoResumeTimeoutId !== undefined) clearTimeout(autoResumeTimeoutId)
        waitingForGotIt = false
        onanswer(selectedAnswerIndex!, false, false)
      }}
    >
      Continue
    </button>
  {/if}

  {#if showSpeedBonus}
    <div class="speed-bonus-badge" aria-live="polite" role="status">SPEED BONUS</div>
  {/if}

  <div class="action-row">
    <button
      class="action-btn hint-btn"
      class:hint-highlight={highlightHint && !answersDisabled && hintsRemaining > 0 && !hintUsed}
      onclick={toggleHintMenu}
      disabled={answersDisabled || hintsRemaining <= 0 || hintUsed}
    >
      Hint ({hintsRemaining})
    </button>
  </div>

  {#if showHintMenu}
    <div class="hint-menu">
      <button class="hint-item" onclick={() => applyHint('eliminate')}>Remove Wrong</button>
      <button class="hint-item" onclick={() => applyHint('time_boost')}>+5 Seconds</button>
      <button class="hint-item" onclick={() => applyHint('first_letter')}>First Letter</button>
    </div>
  {/if}

  {#if activeKeyword}
    <KeywordPopup
      keywordId={activeKeyword.id}
      x={activeKeyword.x}
      y={activeKeyword.y}
      ondismiss={dismissKeyword}
    />
  {/if}

  {#if $isLandscape && quizResultState}
    <div
      class="quiz-result-overlay"
      class:quiz-result-correct={quizResultState === 'correct'}
      class:quiz-result-wrong={quizResultState === 'wrong'}
      role="status"
      aria-live="assertive"
    >
      <span class="quiz-result-text">
        {quizResultState === 'correct' ? 'CORRECT' : 'WRONG'}
      </span>
      {#if quizResultState === 'wrong' && answerRevealed}
        <span class="quiz-result-correct-answer">{correctAnswer}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-expanded {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(320px * var(--layout-scale, 1));
    max-width: min(560px, calc(100vw - 24px));
    max-height: 80vh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    background:
      linear-gradient(rgba(14, 20, 30, 0.95), rgba(14, 20, 30, 0.97)),
      #1a2332;
    border-radius: 12px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    z-index: 30;
    animation: slide-up 200ms ease-out;
  }

  /* Landscape quiz panel — slides in from left edge (spec §1 + §5) */
  .card-expanded-landscape {
    position: fixed;
    /* LEFT-aligned: takes ~58% of viewport width */
    left: 0;
    right: auto;
    width: 58vw;
    max-width: 58vw;
    /* Vertically: fill arena above stats bar + card hand */
    top: 0;
    bottom: calc(27vh + 36px);
    /* Center content vertically within the panel */
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    /* Layout overrides */
    overflow-y: auto;
    overflow-x: hidden;
    /* Override portrait transform/centering */
    transform: none;
    margin: 0;
    max-height: none;
    /* Animation: slide from left */
    animation: slide-from-left 200ms ease-out;
    /* Enhanced dark background for landscape quiz panel */
    background:
      linear-gradient(180deg, rgba(12, 16, 28, 0.98) 0%, rgba(8, 11, 20, 0.99) 100%),
      #0a0e1a;
    border-right: 1px solid rgba(100, 110, 130, 0.2);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.02);
  }

  @keyframes slide-from-left {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }

  /* Landscape answer layout — flexible columns based on answer count (spec §5) */
  .card-answers-landscape {
    display: flex;
    flex-wrap: wrap;
    gap: calc(8px * var(--layout-scale, 1));
  }

  /* 2 answers: two wide buttons side by side */
  .card-answers-landscape-2 .answer-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  /* 3 answers: three equal columns */
  .card-answers-landscape-3 .answer-btn {
    flex: 1 1 calc(33% - 6px);
    min-width: 0;
  }

  /* 4+ answers: 2×2 grid (flex wrap, two per row) */
  .card-answers-landscape-4 .answer-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  /* AR-76: Keyboard shortcut badge on answer buttons — gold-toned game style */
  .kbd-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    min-width: calc(20px * var(--layout-scale, 1));
    border-radius: 4px;
    background: rgba(200, 180, 120, 0.2);
    border: 1px solid rgba(200, 180, 120, 0.4);
    font-size: calc(10px * var(--layout-scale, 1));
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #c8b478;
    margin-right: calc(10px * var(--layout-scale, 1));
    flex-shrink: 0;
    line-height: 1;
  }

  /* AR-76: Brief keyboard-triggered highlight on answer button */
  .answer-kbd-highlight {
    border-color: #60a5fa !important;
    background: rgba(96, 165, 250, 0.15) !important;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
  }

  .card-expanded::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 40px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  /* ── Card Frame V2 decorative accent in expanded view ── */
  .expanded-v2-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    border-radius: 12px;
    /* Render at very low opacity — purely decorative accent */
    opacity: 0.12;
  }

  .expanded-banner,
  .expanded-border-accent,
  .expanded-base {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }

  .expanded-upgrade-icon {
    position: absolute;
    bottom: 8%;
    left: 4%;
    width: 10%;
    height: auto;
    object-fit: contain;
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .mastery-trial-header {
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 1px;
    background: linear-gradient(90deg, #5b4510, #9f7e1e);
    color: #f4e7b0;
    text-align: center;
  }

  /* ── Domain header: subtle gold text, no colored background bar ── */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    min-height: calc(24px * var(--layout-scale, 1));
    box-sizing: border-box;
  }

  .header-domain {
    font-size: calc(9px * var(--layout-scale, 1));
    font-family: 'Press Start 2P', 'Courier New', monospace;
    color: #c8b478;
    display: inline-flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .header-domain-icon {
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
  }

  .header-icon {
    font-size: calc(14px * var(--layout-scale, 1));
    display: inline-flex;
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .header-type-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .tier-stars {
    font-size: calc(9px * var(--layout-scale, 1));
    margin-left: calc(4px * var(--layout-scale, 1));
    color: #d4af37;
  }

  /* ── Card effect: number in amber, label lighter ── */
  .card-effect-desc {
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(9px * var(--text-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    display: flex;
    align-items: baseline;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .effect-value {
    color: #f59e0b;
    font-weight: 900;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .effect-label {
    color: #7c8fa8;
    font-size: calc(8px * var(--text-scale, 1));
  }

  /* ── Question text: pixel font, auto-scales by length ── */
  .card-question {
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(11px * var(--text-scale, 1));
    color: #e8edf5;
    line-height: 1.6;
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  /* AR-221: Auto-scaling font sizes based on question character count */
  .card-question.quiz-text-short {
    font-size: calc(22px * var(--text-scale, 1));
  }

  .card-question.quiz-text-medium {
    font-size: calc(18px * var(--text-scale, 1));
  }

  .card-question.quiz-text-long {
    font-size: calc(14px * var(--text-scale, 1));
  }

  .first-letter-hint {
    margin: 0 calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(10px * var(--text-scale, 1));
    color: #facc15;
  }

  .card-answers {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  /* ── Answer buttons: dark gradient with gold hover ── */
  .answer-btn {
    min-height: calc(56px * var(--layout-scale, 1));
    width: 100%;
    background: linear-gradient(180deg, rgba(30, 40, 60, 0.95) 0%, rgba(20, 28, 45, 0.98) 100%);
    border: 1.5px solid rgba(150, 160, 180, 0.3);
    border-radius: 6px;
    color: #e2e8f0;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(11px * var(--text-scale, 1));
    line-height: 1.5;
    padding: calc(14px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    text-align: left;
    transition: all 150ms ease;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .answer-btn:hover:not(:disabled) {
    background: linear-gradient(180deg, rgba(40, 55, 80, 0.95) 0%, rgba(30, 42, 65, 0.98) 100%);
    border-color: rgba(200, 180, 120, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .answer-btn.answer-correct {
    border-color: rgba(34, 197, 94, 0.7);
    background: linear-gradient(180deg, rgba(5, 46, 22, 0.97) 0%, rgba(3, 32, 14, 0.99) 100%);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
  }

  .answer-btn.answer-wrong {
    border-color: rgba(220, 38, 38, 0.7);
    background: linear-gradient(180deg, rgba(63, 18, 23, 0.97) 0%, rgba(45, 12, 16, 0.99) 100%);
  }

  .answer-btn.answer-reveal-correct {
    border-color: rgba(234, 179, 8, 0.8);
    box-shadow: 0 0 10px rgba(234, 179, 8, 0.2), inset 0 0 0 1px rgba(234, 179, 8, 0.4);
  }

  .answer-btn.answer-eliminated {
    opacity: 0.35;
    text-decoration: line-through;
  }

  .speed-bonus-badge {
    position: absolute;
    right: calc(12px * var(--layout-scale, 1));
    top: calc(40px * var(--layout-scale, 1));
    background: #2563eb;
    color: #fff;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    border-radius: 8px;
    padding: calc(4px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
  }

  /* ── Timer bar: blue gradient ── */
  .timer-bar-container {
    position: relative;
    width: 100%;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(30, 40, 60, 0.6);
    border-radius: 2px;
    /* overflow: hidden removed so speed-bonus-marker is not clipped */
    overflow: visible;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .timer-bar-fill {
    height: 100%;
    transform-origin: left;
    transform: scaleX(var(--fraction));
    border-radius: 2px;
    will-change: transform;
    transition: transform 100ms linear, background 500ms ease;
  }

  .timer-seconds {
    position: absolute;
    right: calc(8px * var(--layout-scale, 1));
    top: calc(-18px * var(--layout-scale, 1));
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
  }

  .action-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .action-btn {
    min-height: calc(40px * var(--layout-scale, 1));
    border-radius: 6px;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(9px * var(--text-scale, 1));
    cursor: pointer;
    transition: all 150ms ease;
  }

  /* ── Hint button: dark blue-toned game style ── */
  .hint-btn {
    background: linear-gradient(180deg, rgba(40, 50, 70, 0.9), rgba(30, 38, 55, 0.95));
    border: 1px solid rgba(100, 130, 200, 0.3);
    color: #8ba4d0;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
  }

  .hint-btn:hover:not(:disabled) {
    border-color: rgba(100, 130, 200, 0.6);
    background: linear-gradient(180deg, rgba(50, 60, 85, 0.9), rgba(38, 48, 68, 0.95));
  }

  .hint-btn.hint-highlight {
    box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.8), 0 0 14px rgba(250, 204, 21, 0.35);
  }

  .hint-btn:disabled {
    opacity: 0.45;
  }

  .hint-menu {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: calc(6px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  .hint-item {
    min-height: calc(40px * var(--layout-scale, 1));
    border: 1px solid rgba(100, 130, 200, 0.25);
    border-radius: 6px;
    background: linear-gradient(180deg, rgba(30, 38, 55, 0.9), rgba(20, 28, 45, 0.95));
    color: #8ba4d0;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    transition: all 150ms ease;
  }

  .hint-item:hover {
    border-color: rgba(100, 130, 200, 0.5);
    background: linear-gradient(180deg, rgba(40, 50, 72, 0.9), rgba(28, 38, 60, 0.95));
  }

  .question-image-container {
    display: flex;
    justify-content: center;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) 0;
  }

  .question-image {
    max-height: calc(80px * var(--layout-scale, 1));
    max-width: calc(120px * var(--layout-scale, 1));
    object-fit: contain;
    border: 2px solid #334155;
    border-radius: 6px;
    background: #fff;
    padding: calc(4px * var(--layout-scale, 1));
  }

  .expanded-desc-parts {
    text-align: center;
    font-size: calc(15px * var(--layout-scale, 1));
    line-height: 1.5;
    color: #e2e8f0;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-family: 'Cinzel', 'Georgia', serif;
  }

  .exp-desc-number {
    font-weight: 900;
    color: #fbbf24;
  }

  .exp-desc-keyword {
    font-weight: 800;
    color: #93c5fd;
    background: none;
    border: none;
    border-bottom: 1px dashed rgba(147, 197, 253, 0.5);
    cursor: pointer;
    padding: 0;
    font: inherit;
    font-weight: 800;
    -webkit-tap-highlight-color: transparent;
  }

  .exp-desc-keyword:active {
    color: #60a5fa;
  }

  .exp-desc-conditional {
    color: #9ca3af;
    font-weight: 700;
  }

  .exp-desc-conditional.active {
    color: #22c55e;
    font-weight: 900;
  }

  /* §1 Quiz Result overlay — landscape only, flashes over the quiz panel */
  .quiz-result-overlay {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
    z-index: 10;
    animation: quiz-result-flash 300ms ease-out forwards;
  }

  .quiz-result-correct {
    background: rgba(34, 197, 94, 0.14);
    border: 2px solid rgba(34, 197, 94, 0.4);
  }

  .quiz-result-wrong {
    background: rgba(239, 68, 68, 0.13);
    border: 2px solid rgba(239, 68, 68, 0.4);
  }

  .quiz-result-text {
    font-size: 2.8rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
  }

  .quiz-result-correct .quiz-result-text {
    color: #4ade80;
  }

  .quiz-result-wrong .quiz-result-text {
    color: #f87171;
  }

  .quiz-result-correct-answer {
    font-size: 1rem;
    font-weight: 600;
    color: #e2e8f0;
    background: rgba(0, 0, 0, 0.45);
    padding: 4px 12px;
    border-radius: 6px;
    text-align: center;
    max-width: 80%;
  }

  @keyframes quiz-result-flash {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Sub-step 1: "Got it" confirmation button after wrong answer */
  .got-it-btn {
    display: block;
    width: calc(100% - 24px * var(--layout-scale, 1));
    min-height: calc(48px * var(--layout-scale, 1));
    margin: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(30, 50, 80, 0.95) 0%, rgba(20, 35, 60, 0.98) 100%);
    border: 1.5px solid rgba(100, 140, 220, 0.5);
    border-radius: 8px;
    color: #93c5fd;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.15);
  }

  .got-it-btn:hover {
    background: linear-gradient(180deg, rgba(40, 65, 100, 0.95) 0%, rgba(28, 48, 80, 0.98) 100%);
    border-color: rgba(100, 140, 220, 0.8);
    box-shadow: 0 0 14px rgba(96, 165, 250, 0.3);
  }

  .got-it-btn:active {
    transform: scale(0.98);
  }

  /* Sub-step 7: "Speed Bonus lost!" label shown when timer expires */
  .timer-expired-label {
    text-align: center;
    color: #94a3b8;
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: calc(8px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    animation: fade-in-out 2s ease forwards;
  }

  @keyframes fade-in-out {
    0%   { opacity: 0; }
    15%  { opacity: 1; }
    75%  { opacity: 1; }
    100% { opacity: 0; }
  }

  /* Sub-step 8: gold speed bonus threshold marker on timer bar */
  .speed-bonus-marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: #D4AF37;
    border-radius: 1px;
    pointer-events: none;
    z-index: 1;
  }
</style>
