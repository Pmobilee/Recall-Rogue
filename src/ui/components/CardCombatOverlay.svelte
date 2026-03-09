<script lang="ts">
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { FLOOR_TIMER } from '../../data/balance'
  import { getQuestionPresentation } from '../../services/questionFormatter'
  import CardHand from './CardHand.svelte'
  import CardExpanded from './CardExpanded.svelte'
  import DamageNumber from './DamageNumber.svelte'
  import ComboCounter from './ComboCounter.svelte'
  import RelicTray from './RelicTray.svelte'
  import { juiceManager } from '../../services/juiceManager'
  import { factsDB } from '../../services/factsDB'

  interface Props {
    turnState: TurnState | null
    onplaycard: (cardId: string, correct: boolean, speedBonus: boolean) => void
    onskipcard: (cardId: string) => void
    onendturn: () => void
  }

  let { turnState, onplaycard, onskipcard, onendturn }: Props = $props()

  let selectedIndex = $state<number | null>(null)
  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean }>>([])
  let cardAnimations = $state<Record<string, 'launch' | 'fizzle' | null>>({})
  let damageIdCounter = $state(0)

  let handCards = $derived<Card[]>(turnState?.deck.hand ?? [])
  let comboCount = $derived(turnState?.comboCount ?? 0)
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let activeRelics = $derived(turnState?.activeRelics ?? [])
  let apCurrent = $derived(turnState?.apCurrent ?? 0)
  let apMax = $derived(turnState?.apMax ?? 0)

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let selectedPresentation = $derived(
    selectedCard
      ? getQuestionPresentation(selectedCard.tier, selectedCard.isMasteryTrial === true)
      : null,
  )

  function removeDamageNumber(id: number): void {
    damageNumbers = damageNumbers.filter((entry) => entry.id !== id)
  }

  function spawnDamageNumber(value: string, isCritical: boolean): void {
    const id = damageIdCounter++
    damageNumbers = [...damageNumbers, { id, value, isCritical }]
  }

  $effect(() => {
    juiceManager.setCallbacks({
      onDamageNumber: (value, isCritical) => spawnDamageNumber(value, isCritical),
    })
    return () => juiceManager.clearCallbacks()
  })

  function getQuizForCard(card: Card, optionCount: number): { question: string; answers: string[]; correctAnswer: string } {
    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null
    if (!fact) {
      return {
        question: `Question for ${card.factId}`,
        answers: ['Answer', 'Wrong A', 'Wrong B'],
        correctAnswer: 'Answer',
      }
    }

    const distractorCount = Math.max(2, optionCount - 1)
    const shuffledDistractors = [...fact.distractors].sort(() => Math.random() - 0.5)
    const picked = shuffledDistractors.slice(0, Math.min(distractorCount, shuffledDistractors.length))

    const allAnswers = [...picked]
    const insertIdx = Math.floor(Math.random() * (allAnswers.length + 1))
    allAnswers.splice(insertIdx, 0, fact.correctAnswer)

    return {
      question: fact.quizQuestion,
      answers: allAnswers,
      correctAnswer: fact.correctAnswer,
    }
  }

  let quizData = $derived(
    selectedCard && selectedPresentation
      ? getQuizForCard(selectedCard, selectedPresentation.optionCount)
      : null,
  )

  let timerSeconds = $derived(
    !turnState
      ? 4
      : (selectedPresentation?.timerOverride
        ?? (FLOOR_TIMER.find((entry) => turnState.deck.currentFloor <= entry.maxFloor)?.seconds ?? 4)),
  )

  let speedBonusThreshold = $derived(
    turnState?.activeRelicIds.has('scholars_focus') ? 0.30 : 0.25,
  )

  let showEndTurn = $derived(
    turnState !== null &&
      turnState.phase === 'player_action' &&
      (turnState.deck.hand.length === 0 || answeredThisTurn > 0 || turnState.apCurrent <= 0),
  )

  let _lastTurnNumber = 0
  $effect(() => {
    const nextTurn = turnState?.turnNumber ?? 0
    if (nextTurn !== _lastTurnNumber) {
      _lastTurnNumber = nextTurn
      selectedIndex = null
      answeredThisTurn = 0
    }
  })

  let autoEndTimeout: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (turnState && handCards.length === 0 && answeredThisTurn > 0) {
      autoEndTimeout = setTimeout(() => onendturn(), 500)
      return () => {
        if (autoEndTimeout !== undefined) clearTimeout(autoEndTimeout)
      }
    }
  })

  function handleSelect(index: number): void {
    if (!turnState) return
    const card = handCards[index]
    if (!card) return
    const cost = Math.max(1, card.apCost ?? 1)
    if (cost > turnState.apCurrent) return
    selectedIndex = index
  }

  function handleDeselect(): void {
    selectedIndex = null
  }

  function handleAnswer(answerIndex: number, isCorrect: boolean, speedBonus: boolean): void {
    if (!selectedCard) return
    const cardId = selectedCard.id
    const effectVal = Math.round(selectedCard.baseEffectValue * selectedCard.effectMultiplier)
    const effectLabel = `${selectedCard.cardType.toUpperCase()} ${effectVal}`

    cardAnimations = { ...cardAnimations, [cardId]: isCorrect ? 'launch' : 'fizzle' }
    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [cardId]: null }
    }, isCorrect ? 300 : 400)

    const nextCombo = isCorrect ? (turnState?.comboCount ?? 0) + 1 : 0
    const willBePerfect = isCorrect && (turnState?.cardsCorrectThisTurn === turnState?.cardsPlayedThisTurn)
    juiceManager.fire({
      type: isCorrect ? 'correct' : 'wrong',
      damage: isCorrect ? effectVal : 0,
      isCritical: speedBonus,
      comboCount: nextCombo,
      effectLabel: isCorrect ? effectLabel : undefined,
      isPerfectTurn: willBePerfect,
    })

    onplaycard(cardId, isCorrect, speedBonus)
    answeredThisTurn += 1
    selectedIndex = null
  }

  function handleSkip(): void {
    if (!selectedCard) return
    onskipcard(selectedCard.id)
    selectedIndex = null
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

    {#if selectedIndex !== null && selectedCard && quizData && selectedPresentation}
      <button
        class="card-backdrop"
        onclick={handleDeselect}
        aria-label="Cancel card selection"
      ></button>

      <CardExpanded
        card={selectedCard}
        question={quizData.question}
        answers={quizData.answers}
        correctAnswer={quizData.correctAnswer}
        timerDuration={timerSeconds}
        comboCount={turnState.comboCount}
        hintsRemaining={turnState.deck.hintsRemaining}
        speedBonusThreshold={speedBonusThreshold}
        showMasteryTrialHeader={selectedCard.isMasteryTrial === true}
        timerColorVariant={selectedCard.isMasteryTrial ? 'gold' : 'default'}
        onanswer={handleAnswer}
        onskip={handleSkip}
        oncancel={handleDeselect}
      />
    {/if}

    {#each damageNumbers as dn (dn.id)}
      <DamageNumber value={dn.value} isCritical={dn.isCritical} onComplete={() => removeDamageNumber(dn.id)} />
    {/each}

    {#if comboCount >= 4}
      <div class="screen-edge-pulse" style="pointer-events: none;"></div>
    {/if}

    <ComboCounter count={comboCount} {isPerfectTurn} />

    <CardHand
      cards={handCards}
      {selectedIndex}
      {cardAnimations}
      apCurrent={apCurrent}
      disabled={turnState.phase !== 'player_action'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
    />

    {#if showEndTurn}
      <button class="end-turn-btn" data-testid="btn-end-turn" onclick={onendturn}>
        END TURN
      </button>
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
    background: rgba(0, 0, 0, 0.85);
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

  .end-turn-btn {
    position: absolute;
    bottom: 130px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    height: 56px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    z-index: 5;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    letter-spacing: 1px;
  }

  .end-turn-btn:active {
    background: #c0392b;
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
