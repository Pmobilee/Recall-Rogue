<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardFramePath, getDomainIconPath } from '../utils/domainAssets'
  import { getTierDisplayName } from '../../services/tierDerivation'
  import { getCardTypeEmoji, getCardTypeIconCandidates } from '../utils/iconAssets'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import KeywordPopup from './KeywordPopup.svelte'

  interface Props {
    card: Card
    question: string
    answers: string[]
    correctAnswer: string
    timerDuration: number
    timerEnabled?: boolean
    comboCount: number
    hintsRemaining: number
    speedBonusThreshold?: number
    timerColorVariant?: 'default' | 'gold' | 'slowReader'
    showMasteryTrialHeader?: boolean
    highlightHint?: boolean
    allowCancel?: boolean
    questionImageUrl?: string
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
    comboCount,
    hintsRemaining,
    speedBonusThreshold = 0.25,
    timerColorVariant = 'default',
    showMasteryTrialHeader = false,
    highlightHint = false,
    allowCancel = true,
    questionImageUrl,
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

  let effectValue = $derived(Math.round(card.baseEffectValue * card.effectMultiplier))
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
  let framePath = $derived(card.isEcho ? '/assets/sprites/cards/frame_echo.webp' : getCardFramePath(card.cardType))
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
  let showSpeedBonus = $state(false)
  let timerExpired = $state(false)
  let touchStartY = $state<number | null>(null)
  let showHintMenu = $state(false)
  let hintUsed = $state(false)
  let firstLetterHint = $state<string | null>(null)
  let eliminatedIndices = $state<Set<number>>(new Set())
  let activeKeyword = $state<{ id: string; x: number; y: number } | null>(null)

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

  function timerTick(now: number): void {
    if (!timerEnabled || answersDisabled || timerExpired) return
    const nextElapsed = now - startTime
    if (nextElapsed >= timerTotalMs) {
      elapsed = timerTotalMs
      timerExpired = true
      answersDisabled = true
      onskip()
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
      }, 800)
    } else {
      answerRevealed = true
    }

    feedbackTimeoutId = setTimeout(() => {
      onanswer(index, isCorrect, speedBonus)
    }, 1600)
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

  onDestroy(() => {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    if (feedbackTimeoutId !== undefined) clearTimeout(feedbackTimeoutId)
    if (correctRevealTimeoutId !== undefined) clearTimeout(correctRevealTimeoutId)
    if (speedBonusTimeoutId !== undefined) clearTimeout(speedBonusTimeoutId)
  })
</script>

<div
  class="card-expanded"
  style={`--card-frame-image: url('${framePath}')`}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="dialog"
  aria-label="Card question"
  tabindex="-1"
>
  {#if showMasteryTrialHeader}
    <div class="mastery-trial-header">MASTERY TRIAL</div>
  {/if}

  <div class="card-header" style="background: {domainColor};">
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

  <div class="card-effect-desc">{effectDescription}</div>
  <div class="expanded-desc-parts">
    {#each getCardDescriptionParts(card) as part}
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
  <div class="card-question">{question}</div>
  {#if firstLetterHint}
    <div class="first-letter-hint">Starts with: {firstLetterHint}</div>
  {/if}

  <div class="card-answers">
    {#each answers as answer, i}
      <button
        class="answer-btn {getAnswerClass(i)}"
        data-testid="quiz-answer-{i}"
        disabled={answersDisabled || eliminatedIndices.has(i)}
        onclick={() => handleAnswer(i)}
      >
        {answer}
      </button>
    {/each}
  </div>

  {#if showSpeedBonus}
    <div class="speed-bonus-badge">SPEED BONUS</div>
  {/if}

  {#if timerEnabled}
    <div class="timer-bar-container">
      <div
        class="timer-bar-fill"
        style="--fraction: {timerFraction}; background: {timerColor};"
      ></div>
      <span class="timer-seconds">{secondsRemaining}s</span>
    </div>
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

  {#if comboCount > 0}
    <div class="combo-indicator">Combo x{comboCount}</div>
  {/if}

  {#if activeKeyword}
    <KeywordPopup
      keywordId={activeKeyword.id}
      x={activeKeyword.x}
      y={activeKeyword.y}
      ondismiss={dismissKeyword}
    />
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
      var(--card-frame-image) center / cover no-repeat,
      #1a2332;
    border-radius: 12px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    z-index: 30;
    animation: slide-up 200ms ease-out;
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

  .mastery-trial-header {
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 1px;
    background: linear-gradient(90deg, #5b4510, #9f7e1e);
    color: #f4e7b0;
    text-align: center;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-height: calc(32px * var(--layout-scale, 1));
    box-sizing: border-box;
  }

  .header-domain {
    font-size: calc(14px * var(--layout-scale, 1));
    font-weight: 600;
    color: white;
    display: inline-flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .header-domain-icon {
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
  }

  .header-icon {
    font-size: calc(16px * var(--layout-scale, 1));
    display: inline-flex;
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    align-items: center;
    justify-content: center;
  }

  .header-type-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .tier-stars {
    font-size: calc(11px * var(--layout-scale, 1));
    margin-left: calc(6px * var(--layout-scale, 1));
    color: #f8f8f8;
  }

  .card-effect-desc {
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) 0;
  }

  .card-question {
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
    line-height: 1.35;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  .first-letter-hint {
    margin: 0 calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #facc15;
  }

  .card-answers {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .answer-btn {
    min-height: calc(52px * var(--layout-scale, 1));
    border: 1px solid #334155;
    border-radius: 10px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    text-align: left;
  }

  .answer-btn.answer-correct {
    border-color: #16a34a;
    background: #052e16;
  }

  .answer-btn.answer-wrong {
    border-color: #dc2626;
    background: #3f1217;
  }

  .answer-btn.answer-reveal-correct {
    border-color: #eab308;
    box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.8);
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
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    border-radius: 8px;
    padding: calc(4px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
  }

  .timer-bar-container {
    position: relative;
    width: 100%;
    height: calc(8px * var(--layout-scale, 1));
    background: #374151;
    border-radius: 4px;
    overflow: hidden;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .timer-bar-fill {
    height: 100%;
    transform-origin: left;
    transform: scaleX(var(--fraction));
    border-radius: 4px;
    will-change: transform;
    transition: transform 100ms linear, background 500ms ease;
  }

  .timer-seconds {
    position: absolute;
    right: calc(8px * var(--layout-scale, 1));
    top: calc(-18px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    color: #e2e8f0;
  }

  .action-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .action-btn {
    min-height: 48px;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: calc(14px * var(--text-scale, 1));
  }

  .hint-btn {
    background: #1d4ed8;
    color: #fff;
  }

  .hint-btn.hint-highlight {
    box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.8), 0 0 14px rgba(250, 204, 21, 0.35);
  }

  .hint-btn:disabled {
    opacity: 0.45;
  }

  .combo-indicator {
    text-align: center;
    color: #facc15;
    font-size: calc(12px * var(--layout-scale, 1));
    padding: 0 0 calc(10px * var(--layout-scale, 1));
  }

  .hint-menu {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: calc(6px * var(--layout-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  .hint-item {
    min-height: calc(40px * var(--layout-scale, 1));
    border: 1px solid #4b5563;
    border-radius: 8px;
    background: #111827;
    color: #f8fafc;
    font-size: calc(11px * var(--layout-scale, 1));
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
</style>
