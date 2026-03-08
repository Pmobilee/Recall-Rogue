<script lang="ts">
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { FLOOR_TIMER } from '../../data/balance'
  import CardHand from './CardHand.svelte'
  import CardExpanded from './CardExpanded.svelte'
  import DamageNumber from './DamageNumber.svelte'
  import ComboCounter from './ComboCounter.svelte'
  import { juiceManager } from '../../services/juiceManager'

  interface Props {
    turnState: TurnState | null
    onplaycard: (cardId: string, correct: boolean, speedBonus: boolean) => void
    onskipcard: (cardId: string) => void
    onendturn: () => void
  }

  let { turnState, onplaycard, onskipcard, onendturn }: Props = $props()

  let selectedIndex = $state<number | null>(null)
  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{id: number, value: string, isCritical: boolean}>>([])
  let cardAnimations = $state<Record<string, 'launch' | 'fizzle' | null>>({})
  let comboCount = $derived(turnState?.comboCount ?? 0)
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let damageIdCounter = $state(0)

  /** Remove a damage number by id after its animation completes. */
  function removeDamageNumber(id: number): void {
    damageNumbers = damageNumbers.filter(dn => dn.id !== id)
  }

  /** Spawn a floating damage number. */
  function spawnDamageNumber(value: string, isCritical: boolean): void {
    const id = damageIdCounter++
    damageNumbers = [...damageNumbers, { id, value, isCritical }]
  }

  // Wire juiceManager callbacks on mount
  $effect(() => {
    juiceManager.setCallbacks({
      onDamageNumber: (value, isCritical) => spawnDamageNumber(value, isCritical),
    })
    return () => juiceManager.clearCallbacks()
  })

  /** Cards currently in hand from turn state. */
  let handCards = $derived<Card[]>(turnState?.deck.hand ?? [])

  /** Whether the end turn button should be shown. */
  let showEndTurn = $derived(
    turnState !== null &&
    turnState.phase === 'player_action' &&
    (turnState.deck.hand.length === 0 || answeredThisTurn > 0)
  )

  /** The currently selected card (if any). */
  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null
  )

  /** Timer duration in seconds for the current floor. */
  let timerSeconds = $derived(
    turnState
      ? (FLOOR_TIMER.find(t => turnState!.deck.currentFloor <= t.maxFloor)?.seconds ?? 4)
      : 4
  )

  /**
   * Generate placeholder question and answers for a card.
   * This will be replaced with real quiz data when wired to the quiz system.
   */
  function getPlaceholderQuiz(card: Card): { question: string; answers: string[]; correctAnswer: string } {
    const correct = `Answer for ${card.factId}`
    const distractors = [
      `Wrong A for ${card.factId}`,
      `Wrong B for ${card.factId}`,
    ]
    // For tier 2, add more distractors (5 total answers)
    if (card.tier >= 2) {
      distractors.push(`Wrong C for ${card.factId}`)
      distractors.push(`Wrong D for ${card.factId}`)
    }

    // Shuffle answers with correct in random position
    const allAnswers = [...distractors, correct]
    for (let i = allAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]]
    }

    return {
      question: `What is the answer to fact ${card.factId}?`,
      answers: allAnswers,
      correctAnswer: correct,
    }
  }

  /** Placeholder quiz data for the selected card. */
  let quizData = $derived(selectedCard ? getPlaceholderQuiz(selectedCard) : null)

  // Reset state when turn changes
  $effect(() => {
    if (turnState) {
      // Track turn number to detect new turns
      const _tn = turnState.turnNumber
      selectedIndex = null
      answeredThisTurn = 0
    }
  })

  // Auto end turn when hand is empty and at least one card was played
  let autoEndTimeout: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (turnState && handCards.length === 0 && answeredThisTurn > 0) {
      autoEndTimeout = setTimeout(() => {
        onendturn()
      }, 500)
      return () => {
        if (autoEndTimeout !== undefined) clearTimeout(autoEndTimeout)
      }
    }
  })

  function handleSelect(index: number): void {
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

    // Set card animation
    cardAnimations = { ...cardAnimations, [cardId]: isCorrect ? 'launch' : 'fizzle' }
    // Clear animation after it finishes
    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [cardId]: null }
    }, isCorrect ? 300 : 400)

    // Fire juice effects
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
    const cardId = selectedCard.id
    onskipcard(cardId)
    selectedIndex = null
  }

  function handleEndTurn(): void {
    onendturn()
  }
</script>

<div class="card-combat-overlay">
  {#if turnState === null}
    <!-- Empty state when no combat is active -->
    <div class="empty-state">Waiting for encounter...</div>
  {:else}
    <!-- Backdrop for cancel when card is expanded -->
    {#if selectedIndex !== null && selectedCard && quizData}
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
        onanswer={handleAnswer}
        onskip={handleSkip}
        oncancel={handleDeselect}
      />
    {/if}

    <!-- Damage Numbers -->
    {#each damageNumbers as dn (dn.id)}
      <DamageNumber value={dn.value} isCritical={dn.isCritical} onComplete={() => removeDamageNumber(dn.id)} />
    {/each}

    <!-- Screen edge pulse at combo 4+ -->
    {#if comboCount >= 4}
      <div class="screen-edge-pulse" style="pointer-events: none;"></div>
    {/if}

    <!-- Combo Counter -->
    <ComboCounter count={comboCount} {isPerfectTurn} />

    <CardHand
      cards={handCards}
      {selectedIndex}
      {cardAnimations}
      disabled={turnState.phase !== 'player_action'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
    />

    {#if showEndTurn}
      <button
        class="end-turn-btn"
        data-testid="btn-end-turn"
        onclick={handleEndTurn}
      >
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
    color: #7F8C8D;
    font-size: 14px;
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
    background: #E74C3C;
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
    background: #C0392B;
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
