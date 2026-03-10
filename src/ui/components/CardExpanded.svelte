<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Card, FactDomain, CardType } from '../../data/card-types'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getCardFramePath, getDomainIconPath } from '../utils/domainAssets'
  import { getTierDisplayName } from '../../services/tierDerivation'

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
    onanswer,
    onskip,
    oncancel,
    onusehint = () => {},
  }: Props = $props()

  const TYPE_ICONS: Record<CardType, string> = {
    attack: '⚔',
    shield: '🛡',
    heal: '💚',
    utility: '⭐',
    buff: '⬆',
    debuff: '⬇',
    regen: '➕',
    wild: '💎',
  }

  const EFFECT_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal N Damage',
    shield: 'Block N Damage',
    heal: 'Heal N HP',
    buff: 'Buff +N%',
    debuff: 'Apply Debuff',
    regen: 'Regen N/turn',
    utility: 'Utility',
    wild: 'Adaptive',
  }

  let effectValue = $derived(Math.round(card.baseEffectValue * card.effectMultiplier))
  let effectDescription = $derived(
    EFFECT_DESCRIPTIONS[card.cardType].replace('N', String(effectValue)),
  )
  let domainColor = $derived(getDomainMetadata(card.domain).colorTint)
  let domainName = $derived(getDomainMetadata(card.domain).displayName)
  let typeIcon = $derived(TYPE_ICONS[card.cardType])
  let tierLabel = $derived(card.tier === '1' ? '' : getTierDisplayName(card.tier))
  let framePath = $derived(card.isEcho ? '/assets/sprites/cards/frame_echo.webp' : getCardFramePath(card.cardType))
  let domainIconPath = $derived(getDomainIconPath(card.domain))

  let startTime = $state(Date.now())
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

  let rafId: number | undefined
  let feedbackTimeoutId: ReturnType<typeof setTimeout> | undefined
  let correctRevealTimeoutId: ReturnType<typeof setTimeout> | undefined
  let speedBonusTimeoutId: ReturnType<typeof setTimeout> | undefined

  function timerTick(): void {
    if (!timerEnabled || answersDisabled || timerExpired) return
    elapsed = Date.now() - startTime
    if (elapsed >= timerTotalMs) {
      timerExpired = true
      answersDisabled = true
      onskip()
      return
    }
    rafId = requestAnimationFrame(timerTick)
  }

  $effect(() => {
    timerTotalMs = Math.max(1000, timerDuration * 1000)
    startTime = Date.now()
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

  function handleAnswer(index: number): void {
    if (answersDisabled || eliminatedIndices.has(index)) return
    answersDisabled = true
    selectedAnswerIndex = index

    const isCorrect = answers[index] === correctAnswer
    const speedBonus = timerEnabled
      ? elapsed < (timerTotalMs * speedBonusThreshold)
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
    <span class="header-icon">{typeIcon}</span>
  </div>

  <div class="card-effect-desc">{effectDescription}</div>
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
</div>

<style>
  .card-expanded {
    position: fixed;
    bottom: calc(45vh - 20px);
    left: 50%;
    transform: translateX(-50%);
    width: 320px;
    max-width: calc(100vw - 24px);
    max-height: 55vh;
    overflow-y: auto;
    background:
      linear-gradient(rgba(14, 20, 30, 0.86), rgba(14, 20, 30, 0.9)),
      var(--card-frame-image) center / cover no-repeat,
      #1a2332;
    border-radius: 12px;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
    z-index: 20;
    animation: slide-up 200ms ease-out;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .mastery-trial-header {
    padding: 6px 12px;
    font-size: 11px;
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
    padding: 6px 12px;
    min-height: 32px;
    box-sizing: border-box;
  }

  .header-domain {
    font-size: 14px;
    font-weight: 600;
    color: white;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .header-domain-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .header-icon {
    font-size: 16px;
  }

  .tier-stars {
    font-size: 11px;
    margin-left: 6px;
    color: #f8f8f8;
  }

  .card-effect-desc {
    font-size: 12px;
    color: #94a3b8;
    padding: 8px 12px 0;
  }

  .card-question {
    font-size: 16px;
    color: #f8fafc;
    line-height: 1.35;
    padding: 8px 12px 10px;
  }

  .first-letter-hint {
    margin: 0 12px 8px;
    font-size: 12px;
    color: #facc15;
  }

  .card-answers {
    display: grid;
    gap: 8px;
    padding: 0 12px 12px;
  }

  .answer-btn {
    min-height: 52px;
    border: 1px solid #334155;
    border-radius: 10px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 14px;
    padding: 10px;
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
    right: 12px;
    top: 40px;
    background: #2563eb;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 8px;
    padding: 4px 7px;
  }

  .timer-bar-container {
    position: relative;
    width: 100%;
    height: 8px;
    background: #374151;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 8px;
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
    right: 8px;
    top: -18px;
    font-size: 11px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .action-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 10px 12px 12px;
  }

  .action-btn {
    min-height: 48px;
    border: none;
    border-radius: 10px;
    font-weight: 700;
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
    font-size: 12px;
    padding: 0 0 10px;
  }

  .hint-menu {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 0 12px 10px;
  }

  .hint-item {
    min-height: 40px;
    border: 1px solid #4b5563;
    border-radius: 8px;
    background: #111827;
    color: #f8fafc;
    font-size: 11px;
  }
</style>
