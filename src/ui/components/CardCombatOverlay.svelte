<script lang="ts">
  import { get } from 'svelte/store'
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { FLOOR_TIMER } from '../../data/balance'
  import { getQuestionPresentation } from '../../services/questionFormatter'
  import {
    difficultyMode,
    isSlowReader,
    onboardingState,
    markOnboardingTooltipSeen,
    type DifficultyMode,
  } from '../../services/cardPreferences'
  import CardHand from './CardHand.svelte'
  import CardExpanded from './CardExpanded.svelte'
  import DamageNumber from './DamageNumber.svelte'
  import ComboCounter from './ComboCounter.svelte'
  import RelicTray from './RelicTray.svelte'
  import { juiceManager } from '../../services/juiceManager'
  import { factsDB } from '../../services/factsDB'
  import { getReviewStateByFactId } from '../stores/playerData'
  import type { ActiveBounty } from '../../services/bountyManager'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { hasCardback } from '../utils/cardbackManifest'
  import { REVEAL_DURATION, MECHANIC_DURATION, LAUNCH_DURATION, type CardAnimPhase } from '../utils/mechanicAnimations'

  interface Props {
    turnState: TurnState | null
    activeBounties?: ActiveBounty[]
    onplaycard: (
      cardId: string,
      correct: boolean,
      speedBonus: boolean,
      responseTimeMs?: number,
      variantIndex?: number,
    ) => void
    onskipcard: (cardId: string) => void
    onendturn: () => void
    onusehint: () => void
  }

  type CardPlayStage = 'hand' | 'selected' | 'committed'

  interface QuizData {
    question: string
    answers: string[]
    correctAnswer: string
    variantIndex: number
  }

  let { turnState, activeBounties = [], onplaycard, onskipcard, onendturn, onusehint }: Props = $props()

  let cardPlayStage = $state<CardPlayStage>('hand')
  let selectedIndex = $state<number | null>(null)
  let committedCardIndex = $state<number | null>(null)
  let committedQuizData = $state<QuizData | null>(null)
  let committedAtMs = $state(0)

  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean }>>([])
  let cardAnimations = $state<Record<string, CardAnimPhase>>({})
  let animatingCards = $state<Card[]>([])
  let damageIdCounter = $state(0)
  let slowReaderEnabled = $state(false)
  let currentDifficulty = $state<DifficultyMode>('standard')

  // wowFactor overlay state
  let wowFactorText = $state<string | null>(null)
  let wowFactorVisible = $state(false)
  let wowFactorCount = $state(0)
  const WOW_FACTOR_MAX_PER_ENCOUNTER = 3

  let handCards = $derived<Card[]>(turnState?.deck.hand ?? [])
  let comboCount = $derived(turnState?.comboCount ?? 0)
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let activeRelics = $derived(turnState?.activeRelics ?? [])
  let apCurrent = $derived(turnState?.apCurrent ?? 0)
  let apMax = $derived(turnState?.apMax ?? 0)

  let enemyIntent = $derived(turnState?.enemy.nextIntent ?? null)
  let enemyName = $derived(turnState?.enemy.template.name ?? '')

  const INTENT_ICONS: Record<string, string> = {
    attack: '⚔️',
    multi_attack: '⚔️×',
    defend: '🛡️',
    buff: '💪',
    debuff: '☠️',
    heal: '💚',
  }

  let intentDisplay = $derived.by(() => {
    if (!enemyIntent) return null
    const icon = INTENT_ICONS[enemyIntent.type] ?? '❓'
    const val = enemyIntent.value
    if (enemyIntent.type === 'multi_attack') {
      const hits = enemyIntent.hitCount ?? 2
      return { icon: '⚔️', text: `${val}×${hits}`, type: enemyIntent.type }
    }
    if (enemyIntent.type === 'attack') {
      return { icon, text: `${val}`, type: enemyIntent.type }
    }
    if (enemyIntent.type === 'defend') {
      return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type }
    }
    return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type }
  })

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let committedCard = $derived<Card | null>(
    committedCardIndex !== null && handCards[committedCardIndex] ? handCards[committedCardIndex] : null,
  )

  let selectedPresentation = $derived(
    selectedCard
      ? getQuestionPresentation(selectedCard.tier, selectedCard.isMasteryTrial === true)
      : null,
  )

  let committedPresentation = $derived(
    committedCard
      ? getQuestionPresentation(committedCard.tier, committedCard.isMasteryTrial === true)
      : null,
  )

  let speedBonusThreshold = $derived(
    turnState?.activeRelicIds.has('scholars_focus') ? 0.30 : 0.25,
  )

  let showEndTurn = $derived(
    turnState !== null && turnState.phase === 'player_action',
  )

  let endTurnDisabled = $derived(
    !turnState ||
      turnState.phase !== 'player_action' ||
      cardPlayStage === 'committed',
  )

  let timerEnabled = $derived(currentDifficulty !== 'explorer')
  let canaryQuestionBias = $derived(turnState?.canaryQuestionBias ?? 0)

  let effectiveTimerSeconds = $derived.by(() => {
    if (!turnState || !committedPresentation || !committedQuizData) return 4

    const floorBase = committedPresentation.timerOverride
      ?? (FLOOR_TIMER.find((entry) => turnState.deck.currentFloor <= entry.maxFloor)?.seconds ?? 4)

    const allText = [committedQuizData.question, ...committedQuizData.answers].join(' ')
    const totalWords = allText.trim().split(/\s+/).filter(Boolean).length

    const extraWords = Math.max(0, totalWords - 10)
    const wordBonus = Math.floor(extraWords / 8)
    const slowReaderBonus = slowReaderEnabled && !committedPresentation.disableSlowReader ? 3 : 0

    let timer = floorBase + wordBonus + slowReaderBonus

    if (currentDifficulty === 'scholar' && committedCard) {
      const tierRank = committedCard.tier === '1' ? 0 : committedCard.tier === '2a' ? 1 : committedCard.tier === '2b' ? 2 : 3
      timer = Math.max(2, timer - tierRank * 2)
    }

    return timer
  })

  let timerColorVariant = $derived<'default' | 'gold' | 'slowReader'>(
    committedCard?.isMasteryTrial
      ? 'gold'
      : slowReaderEnabled
        ? 'slowReader'
        : 'default',
  )

  let castDisabled = $derived(
    !selectedCard || !turnState || Math.max(1, selectedCard.apCost ?? 1) > turnState.apCurrent,
  )

  let onboardingTip = $derived.by(() => {
    const state = get(onboardingState)
    if (state.hasCompletedOnboarding) return null

    if (cardPlayStage === 'hand' && !state.hasSeenCardTapTooltip) {
      return 'Tap a card to examine it'
    }

    if (cardPlayStage === 'selected' && !state.hasSeenCastTooltip) {
      return 'Tap the card again to cast it'
    }

    if (cardPlayStage === 'committed') {
      // Don't show tooltip during quiz — it overlaps answer buttons
      return null
    }

    if (answeredThisTurn > 0 && !state.hasSeenEndTurnTooltip) {
      return 'Tap End Turn when done'
    }

    if ((turnState?.turnNumber ?? 0) >= 2 && !state.hasSeenAPTooltip) {
      return 'You have AP — each cast uses AP'
    }

    return null
  })

  let onboardingTipClass = $derived.by(() => {
    if (!onboardingTip) return ''
    if (cardPlayStage === 'selected') return 'tip-cast'
    if (cardPlayStage === 'committed') return 'tip-answer'
    if (answeredThisTurn > 0) return 'tip-endturn'
    if ((turnState?.turnNumber ?? 0) >= 2) return 'tip-ap'
    return 'tip-hand'
  })

  function showWowFactor(card: Card): void {
    if (wowFactorCount >= WOW_FACTOR_MAX_PER_ENCOUNTER) return
    if (card.tier !== '1') return
    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null
    if (!fact?.wowFactor) return

    wowFactorCount++
    wowFactorText = fact.wowFactor
    wowFactorVisible = true

    // fade in 200ms (CSS), hold 1.5s, fade out 300ms (CSS), cleanup
    setTimeout(() => {
      wowFactorVisible = false
    }, 1700) // 200ms fade-in + 1500ms hold
    setTimeout(() => {
      wowFactorText = null
    }, 2000) // + 300ms fade-out
  }

  function removeDamageNumber(id: number): void {
    damageNumbers = damageNumbers.filter((entry) => entry.id !== id)
  }

  function spawnDamageNumber(value: string, isCritical: boolean): void {
    const id = damageIdCounter++
    damageNumbers = [...damageNumbers, { id, value, isCritical }]
  }

  $effect(() => {
    const unsubDifficulty = difficultyMode.subscribe((value) => {
      currentDifficulty = value
    })
    const unsubSlowReader = isSlowReader.subscribe((value) => {
      slowReaderEnabled = value
    })

    return () => {
      unsubDifficulty()
      unsubSlowReader()
    }
  })

  $effect(() => {
    juiceManager.setCallbacks({
      onDamageNumber: (value, isCritical) => spawnDamageNumber(value, isCritical),
    })
    return () => juiceManager.clearCallbacks()
  })

  function getQuizForCard(card: Card, optionCount: number): QuizData {
    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null
    if (!fact) {
      return {
        question: `Question for ${card.factId}`,
        answers: ['Answer', 'Wrong A', 'Wrong B'],
        correctAnswer: 'Answer',
        variantIndex: 0,
      }
    }

    // Vocab cards use the legacy 3-variant system (forward/reverse/fill-blank)
    // Knowledge facts with a variants array use the new N-variant system
    const hasVariantsArray = fact.type !== 'vocabulary' && fact.variants && fact.variants.length > 0
    const variantCount = hasVariantsArray ? fact.variants!.length : 3
    const lastVariant = getReviewStateByFactId(card.factId)?.lastVariantIndex ?? -1

    let variantIndex = 0
    if (variantCount > 1) {
      if (canaryQuestionBias < 0) {
        variantIndex = 0
      } else if (canaryQuestionBias > 0) {
        const indices = Array.from({ length: variantCount }, (_, i) => i).filter(i => i !== 0 && i !== lastVariant)
        variantIndex = indices.length > 0
          ? indices[Math.floor(Math.random() * indices.length)]
          : Math.min(1, variantCount - 1)
      } else {
        variantIndex = Math.floor(Math.random() * variantCount)
        let attempts = 0
        while (variantCount > 1 && variantIndex === lastVariant && attempts < 10) {
          variantIndex = Math.floor(Math.random() * variantCount)
          attempts++
        }
      }
    }

    let question: string
    let correctAnswer: string
    let distractorSource: string[]

    if (hasVariantsArray) {
      // Use the fact's variants array
      const variant = fact.variants![variantIndex % fact.variants!.length]
      question = variant.question
      correctAnswer = variant.correctAnswer
      distractorSource = variant.distractors ?? fact.distractors
    } else {
      // Legacy system for vocab cards and facts without variants
      correctAnswer = fact.correctAnswer
      distractorSource = fact.distractors

      if (variantIndex === 2) {
        question = `Fill in the blank: ${fact.statement.replace(fact.correctAnswer, '_____')}`
      } else {
        question = fact.quizQuestion
      }
    }

    const distractorCount = Math.max(2, optionCount - 1)
    const shuffledDistractors = [...distractorSource].sort(() => Math.random() - 0.5)
    const picked = shuffledDistractors.slice(0, Math.min(distractorCount, shuffledDistractors.length))

    const allAnswers = [...picked]
    const insertIdx = Math.floor(Math.random() * (allAnswers.length + 1))
    allAnswers.splice(insertIdx, 0, correctAnswer)

    return {
      question,
      answers: allAnswers,
      correctAnswer,
      variantIndex,
    }
  }

  function resetCardFlow(): void {
    cardPlayStage = 'hand'
    selectedIndex = null
    committedCardIndex = null
    committedQuizData = null
    committedAtMs = 0
  }

  let _lastTurnNumber = 0
  $effect(() => {
    const nextTurn = turnState?.turnNumber ?? 0
    if (nextTurn !== _lastTurnNumber) {
      _lastTurnNumber = nextTurn
      resetCardFlow()
      answeredThisTurn = 0
      // Reset wowFactor counter at the start of each encounter (turn 1)
      if (nextTurn === 1) {
        wowFactorCount = 0
      }

      if (nextTurn >= 2) {
        const state = get(onboardingState)
        if (!state.hasCompletedOnboarding && !state.hasSeenAPTooltip) {
          markOnboardingTooltipSeen('hasSeenAPTooltip')
        }
      }
    }
  })

  $effect(() => {
    if (cardPlayStage === 'committed' && (!committedCard || !committedQuizData)) {
      resetCardFlow()
    }
  })

  let showEndTurnConfirm = $state(false)

  let hasPlayableCards = $derived.by(() => {
    if (!turnState || turnState.phase !== 'player_action') return false
    return handCards.some((c) => Math.max(1, c.apCost ?? 1) <= turnState!.apCurrent)
  })

  function handleSelect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    if (selectedIndex === index && cardPlayStage === 'selected') {
      handleCast()
      return
    }

    selectedIndex = index
    cardPlayStage = 'selected'

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCardTapTooltip) {
      markOnboardingTooltipSeen('hasSeenCardTapTooltip')
    }
  }

  function handleDeselect(): void {
    if (cardPlayStage !== 'selected') return
    resetCardFlow()
  }

  function handleCast(): void {
    if (!selectedCard || !selectedPresentation || castDisabled) return

    playCardAudio('card-cast')
    cardPlayStage = 'committed'
    committedCardIndex = selectedIndex
    committedQuizData = getQuizForCard(selectedCard, selectedPresentation.optionCount)
    committedAtMs = Date.now()
    selectedIndex = null

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCastTooltip) {
      markOnboardingTooltipSeen('hasSeenCastTooltip')
    }
    if (!state.hasCompletedOnboarding && !state.hasSeenAnswerTooltip) {
      markOnboardingTooltipSeen('hasSeenAnswerTooltip')
    }
  }

  function handleAnswer(answerIndex: number, isCorrect: boolean, speedBonus: boolean): void {
    if (!committedCard) return
    // Capture card data before animation (onplaycard will remove card from hand)
    const card = committedCard
    const cardId = card.id
    const responseTimeMs = committedAtMs > 0 ? Math.max(50, Date.now() - committedAtMs) : undefined
    const effectVal = Math.round(card.baseEffectValue * card.effectMultiplier)
    const effectLabel = `${card.cardType.toUpperCase()} ${effectVal}`
    const nextCombo = isCorrect ? (turnState?.comboCount ?? 0) + 1 : 0
    const willBePerfect = isCorrect && (turnState?.cardsCorrectThisTurn === turnState?.cardsPlayedThisTurn)

    // Capture before resetCardFlow nulls it
    const quizVariantIndex = committedQuizData?.variantIndex

    // Reset card flow immediately (hides quiz panel)
    resetCardFlow()

    if (!isCorrect) {
      // Wrong answer: buffer card for animation, then remove from hand immediately
      animatingCards = [...animatingCards, card]
      cardAnimations = { ...cardAnimations, [cardId]: 'fizzle' }
      onplaycard(cardId, false, false, responseTimeMs, quizVariantIndex)

      juiceManager.fire({
        type: 'wrong',
        damage: 0,
        isCritical: false,
        comboCount: 0,
        effectLabel: undefined,
        isPerfectTurn: false,
      })

      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: null }
        animatingCards = animatingCards.filter(c => c.id !== cardId)
      }, 400)
    } else {
      // Show wowFactor overlay for Learning-tier cards with a wowFactor
      showWowFactor(card)

      // Correct answer: reveal → mechanic → launch sequence
      const hasBack = hasCardback(card.factId)

      if (hasBack) {
        // Buffer card for animation, call onplaycard immediately
        animatingCards = [...animatingCards, card]
        cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }
        onplaycard(cardId, true, speedBonus, responseTimeMs, quizVariantIndex)

        setTimeout(() => {
          // Phase 2: Mechanic animation (400-900ms)
          cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }

          juiceManager.fire({
            type: 'correct',
            damage: effectVal,
            isCritical: speedBonus,
            comboCount: nextCombo,
            effectLabel: effectLabel,
            isPerfectTurn: willBePerfect,
          })
        }, REVEAL_DURATION)

        setTimeout(() => {
          // Phase 3: Launch (900-1200ms)
          cardAnimations = { ...cardAnimations, [cardId]: 'launch' }
        }, REVEAL_DURATION + MECHANIC_DURATION)

        setTimeout(() => {
          // Cleanup
          cardAnimations = { ...cardAnimations, [cardId]: null }
          animatingCards = animatingCards.filter(c => c.id !== cardId)
        }, REVEAL_DURATION + MECHANIC_DURATION + LAUNCH_DURATION)
      } else {
        // No cardback: buffer card, call onplaycard immediately
        animatingCards = [...animatingCards, card]
        cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }
        onplaycard(cardId, true, speedBonus, responseTimeMs, quizVariantIndex)

        juiceManager.fire({
          type: 'correct',
          damage: effectVal,
          isCritical: speedBonus,
          comboCount: nextCombo,
          effectLabel: effectLabel,
          isPerfectTurn: willBePerfect,
        })

        setTimeout(() => {
          // Launch
          cardAnimations = { ...cardAnimations, [cardId]: 'launch' }
        }, MECHANIC_DURATION)

        setTimeout(() => {
          // Cleanup
          cardAnimations = { ...cardAnimations, [cardId]: null }
          animatingCards = animatingCards.filter(c => c.id !== cardId)
        }, MECHANIC_DURATION + LAUNCH_DURATION)
      }
    }

    answeredThisTurn += 1

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenAnswerTooltip) {
      markOnboardingTooltipSeen('hasSeenAnswerTooltip')
    }
  }

  function handleSkip(): void {
    if (cardPlayStage === 'selected' && selectedCard) {
      onskipcard(selectedCard.id)
      resetCardFlow()
      return
    }

    if (cardPlayStage === 'committed' && committedCard) {
      handleAnswer(-1, false, false)
    }
  }

  function handleEndTurn(): void {
    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenEndTurnTooltip) {
      markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
    }

    if (apCurrent > 0 && hasPlayableCards && !showEndTurnConfirm) {
      showEndTurnConfirm = true
      return
    }

    showEndTurnConfirm = false
    onendturn()
  }

  function cancelEndTurn(): void {
    showEndTurnConfirm = false
  }

  function bountyLabel(bounty: ActiveBounty): string {
    const progress = Math.min(bounty.progress, bounty.target)
    return `${bounty.name}: ${progress}/${bounty.target}`
  }
</script>

<div class="card-combat-overlay">
  {#if turnState === null}
    <div class="empty-state">Waiting for encounter...</div>
  {:else}
    <RelicTray relics={activeRelics} triggeredRelicId={turnState.triggeredRelicId} />

    <div class="ap-strip" aria-label="Action points">
      <span>AP</span>
      <strong>{apCurrent}/{apMax}</strong>
    </div>

    {#if activeBounties.length > 0}
      <div class="bounty-strip" aria-label="Bounty progress">
        {#each activeBounties.slice(0, 2) as bounty (bounty.id)}
          <div class="bounty-line" class:done={bounty.completed}>{bountyLabel(bounty)}</div>
        {/each}
      </div>
    {/if}

    {#if intentDisplay && cardPlayStage !== 'committed'}
      <div class="enemy-intent" class:intent-attack={intentDisplay.type === 'attack' || intentDisplay.type === 'multi_attack'}>
        <span class="intent-icon">{intentDisplay.icon}</span>
        {#if intentDisplay.text}
          <span class="intent-value">{intentDisplay.text}</span>
        {/if}
      </div>
    {/if}

    {#if cardPlayStage === 'selected' && selectedCard}
      <button
        class="card-backdrop"
        onclick={handleDeselect}
        aria-label="Cancel card selection"
      ></button>
    {/if}

    {#if cardPlayStage === 'committed' && committedCard && committedQuizData && committedPresentation}
      <CardExpanded
        card={committedCard}
        question={committedQuizData.question}
        answers={committedQuizData.answers}
        correctAnswer={committedQuizData.correctAnswer}
        timerDuration={effectiveTimerSeconds}
        timerEnabled={timerEnabled}
        comboCount={turnState.comboCount}
        hintsRemaining={turnState.deck.hintsRemaining}
        speedBonusThreshold={speedBonusThreshold}
        showMasteryTrialHeader={committedCard.isMasteryTrial === true}
        timerColorVariant={timerColorVariant}
        highlightHint={turnState.canaryQuestionBias < 0}
        allowCancel={false}
        skipLabel="Forfeit"
        onanswer={handleAnswer}
        onskip={handleSkip}
        oncancel={() => {}}
        onusehint={onusehint}
      />
    {/if}

    {#if onboardingTip}
      <div class={`onboarding-tip ${onboardingTipClass}`}>{onboardingTip}</div>
    {/if}

    {#each damageNumbers as dn (dn.id)}
      <DamageNumber value={dn.value} isCritical={dn.isCritical} onComplete={() => removeDamageNumber(dn.id)} />
    {/each}

    {#if wowFactorText}
      <div class="wow-factor-overlay" class:wow-visible={wowFactorVisible}>{wowFactorText}</div>
    {/if}

    {#if comboCount >= 4}
      <div class="screen-edge-pulse" style="pointer-events: none;"></div>
    {/if}

    <ComboCounter count={comboCount} {isPerfectTurn} />

    <CardHand
      cards={handCards}
      {animatingCards}
      {selectedIndex}
      {cardAnimations}
      apCurrent={apCurrent}
      disabled={turnState.phase !== 'player_action' || cardPlayStage === 'committed'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
    />

    {#if showEndTurn}
      <button
        class="end-turn-btn"
        class:disabled={endTurnDisabled}
        class:end-turn-pulse={!endTurnDisabled && (apCurrent === 0 || !hasPlayableCards)}
        data-testid="btn-end-turn"
        onclick={handleEndTurn}
        disabled={endTurnDisabled}
      >
        END TURN
      </button>
    {/if}

    {#if showEndTurnConfirm}
      <div class="end-turn-confirm-overlay">
        <div class="end-turn-confirm-box">
          <p>You still have AP to spend. End turn anyway?</p>
          <div class="confirm-buttons">
            <button class="confirm-btn confirm-end" onclick={handleEndTurn}>End Turn</button>
            <button class="confirm-btn confirm-cancel" onclick={cancelEndTurn}>Cancel</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .card-combat-overlay {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 45vh;
    z-index: 10;
    background: rgba(0, 0, 0, 0.6);
    overflow: visible;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #7f8c8d;
    font-size: 14px;
  }

  .ap-strip {
    position: absolute;
    left: 12px;
    top: 10px;
    z-index: 8;
    background: rgba(15, 23, 35, 0.92);
    border: 1px solid #3a4b63;
    border-radius: 10px;
    color: #dce7f6;
    padding: 6px 10px;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    letter-spacing: 0.4px;
  }

  .bounty-strip {
    position: absolute;
    right: 12px;
    top: 10px;
    z-index: 8;
    min-width: 146px;
    max-width: 220px;
    background: rgba(15, 23, 35, 0.92);
    border: 1px solid #475569;
    border-radius: 10px;
    padding: 6px 8px;
    display: grid;
    gap: 4px;
    color: #dce7f6;
    font-size: 11px;
  }

  .bounty-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bounty-line.done {
    color: #facc15;
  }

  .enemy-intent {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(15, 23, 35, 0.92);
    border: 1px solid #475569;
    border-radius: 10px;
    padding: 5px 12px;
    color: #e2e8f0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.3px;
    animation: intent-fade-in 300ms ease-out;
  }

  .enemy-intent.intent-attack {
    border-color: #dc2626;
    color: #fca5a5;
  }

  .intent-icon {
    font-size: 16px;
  }

  .intent-value {
    font-size: 16px;
    font-weight: 800;
  }

  @keyframes intent-fade-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .ap-strip strong {
    font-size: 15px;
    color: #7dd3fc;
  }

  .card-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 15;
    border: none;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }


  .onboarding-tip {
    position: absolute;
    z-index: 25;
    max-width: 220px;
    background: rgba(6, 8, 16, 0.92);
    color: #f4f7fb;
    border: 1px solid rgba(241, 196, 15, 0.5);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.3;
  }

  .tip-hand {
    bottom: 178px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-cast {
    bottom: 320px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-answer {
    bottom: 360px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-endturn {
    bottom: 180px;
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-ap {
    top: 44px;
    left: 12px;
  }

  .end-turn-btn {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    height: 48px;
    background: #1f2937;
    color: #f8fafc;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    z-index: 5;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    letter-spacing: 0.8px;
  }

  .end-turn-btn.disabled,
  .end-turn-btn:disabled {
    background: #334155;
    color: #94a3b8;
  }

  .end-turn-pulse {
    animation: pulse-glow 1.5s ease-in-out infinite;
    color: #fbbf24;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(234, 179, 8, 0.5); background: #854d0e; }
    50% { box-shadow: 0 0 16px rgba(234, 179, 8, 0.8); background: #a16207; }
  }

  .end-turn-confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .end-turn-confirm-box {
    background: #1f2937;
    border: 1px solid #475569;
    border-radius: 12px;
    padding: 16px 20px;
    max-width: 260px;
    text-align: center;
  }

  .end-turn-confirm-box p {
    color: #f8fafc;
    font-size: 14px;
    margin: 0 0 14px;
    line-height: 1.4;
  }

  .confirm-buttons {
    display: flex;
    gap: 10px;
  }

  .confirm-btn {
    flex: 1;
    height: 42px;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }

  .confirm-end {
    background: #dc2626;
    color: #fff;
  }

  .confirm-cancel {
    background: #374151;
    color: #f8fafc;
  }

  .wow-factor-overlay {
    position: absolute;
    top: 48px;
    left: 12px;
    right: 12px;
    z-index: 12;
    text-align: center;
    font-size: 12px;
    font-style: italic;
    color: #fef3c7;
    background: rgba(15, 23, 35, 0.82);
    border: 1px solid rgba(251, 191, 36, 0.35);
    border-radius: 8px;
    padding: 8px 12px;
    line-height: 1.35;
    pointer-events: none;
    opacity: 0;
    transition: opacity 300ms ease;
  }

  .wow-factor-overlay.wow-visible {
    opacity: 1;
    transition: opacity 200ms ease;
  }

  .screen-edge-pulse {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    box-shadow: inset 0 0 60px 20px rgba(255, 215, 0, 0.15);
    animation: edgePulse 400ms ease-in-out;
    z-index: 5;
  }

  @keyframes edgePulse {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }
</style>
