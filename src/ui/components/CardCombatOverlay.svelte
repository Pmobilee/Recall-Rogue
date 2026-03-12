<script lang="ts">
  import { get } from 'svelte/store'
  import { fade } from 'svelte/transition'
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { getComboMultiplier } from '../../services/turnManager'
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
  import { RELIC_BY_ID } from '../../data/relics/index'
  import { juiceManager } from '../../services/juiceManager'
  import { factsDB } from '../../services/factsDB'
  import { getReviewStateByFactId } from '../stores/playerData'
  import { getCardTier } from '../../services/tierDerivation'
  import type { ActiveBounty } from '../../services/bountyManager'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { hasCardback } from '../utils/cardbackManifest'
  import { REVEAL_DURATION, TIER_UP_DURATION, MECHANIC_DURATION, LAUNCH_DURATION, type CardAnimPhase } from '../utils/mechanicAnimations'
  import { shuffled } from '../../services/randomUtils'
  import { activeRunState } from '../../services/runStateStore'
  import { getMasteryScalingTier, getRewardMultiplier, getDifficultyBoostFloors } from '../../services/masteryScalingService'
  import { synergyFlash } from '../stores/gameState'

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
    onreturnhub?: () => void
  }

  type CardPlayStage = 'hand' | 'selected' | 'committed'

  interface QuizData {
    question: string
    answers: string[]
    correctAnswer: string
    variantIndex: number
    questionImageUrl?: string
  }

  let { turnState, activeBounties = [], onplaycard, onskipcard, onendturn, onusehint, onreturnhub }: Props = $props()

  let cardPlayStage = $state<CardPlayStage>('hand')
  let selectedIndex = $state<number | null>(null)
  let committedCardIndex = $state<number | null>(null)
  let committedQuizData = $state<QuizData | null>(null)
  let committedAtMs = $state(0)

  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean }>>([])
  let cardAnimations = $state<Record<string, CardAnimPhase>>({})
  type TierUpTransition = 'tier1_to_2a' | 'tier2a_to_2b' | 'tier2b_to_3'
  let tierUpTransitions = $state<Record<string, TierUpTransition>>({})
  let animatingCards = $state<Card[]>([])
  let damageIdCounter = $state(0)
  let slowReaderEnabled = $state(false)
  let currentDifficulty = $state<DifficultyMode>('normal')

  // wowFactor overlay state
  let wowFactorText = $state<string | null>(null)
  let wowFactorVisible = $state(false)
  let wowFactorCount = $state(0)
  const WOW_FACTOR_MAX_PER_ENCOUNTER = 3

  // Synergy flash: subtle pulse when a hidden combo activates
  let synergyFlashText = $state<string | null>(null)
  $effect(() => {
    const val = $synergyFlash
    if (val) {
      synergyFlashText = val
      const timer = setTimeout(() => {
        synergyFlashText = null
        synergyFlash.set(null)
      }, 1500)
      return () => clearTimeout(timer)
    }
  })

  let handCards = $derived<Card[]>(turnState?.deck.hand ?? [])
  let comboCount = $derived(turnState?.comboCount ?? 0)
  let comboMultiplier = $derived(getComboMultiplier(comboCount))
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let displayRelics = $derived(
    [...(turnState?.activeRelicIds ?? [])].map((id) => {
      const def = RELIC_BY_ID[id];
      return {
        definitionId: id,
        name: def?.name ?? id,
        description: def?.description ?? '',
        initial: (def?.name ?? id).charAt(0),
      };
    })
  )
  let apCurrent = $derived(turnState?.apCurrent ?? 0)
  let apMax = $derived(turnState?.apMax ?? 0)

  const run = $derived($activeRunState)
  const expertModeActive = $derived(
    (run?.deckMasteryPct ?? 0) >= 0.40
  )
  const expertModeLabel = $derived(
    expertModeActive ? getMasteryScalingTier(run?.deckMasteryPct ?? 0) : null
  )
  const expertModeRewardMult = $derived(
    expertModeActive ? getRewardMultiplier(run?.deckMasteryPct ?? 0) : 1.0
  )

  let enemyIntent = $derived(turnState?.enemy.nextIntent ?? null)
  let enemyName = $derived(turnState?.enemy.template.name ?? '')
  let enemyCategory = $derived(turnState?.enemy.template.category ?? 'common')
  let currentFloor = $derived(turnState?.deck.currentFloor ?? 0)
  let currentEncounter = $derived(turnState?.deck.currentEncounter ?? 0)

  let intentPopupOpen = $state(false)

  const CATEGORY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    elite: '#60a5fa',
    mini_boss: '#a78bfa',
    boss: '#fbbf24',
  }

  /** Rarity colors for common enemies. Uncommon=green, rare=gold. */
  const RARITY_COLORS: Record<string, string> = {
    uncommon: '#4ade80',
    rare: '#fbbf24',
  }

  let enemyRarity = $derived(turnState?.enemy.template.rarity ?? undefined)
  let categoryColor = $derived(
    enemyCategory === 'common' && enemyRarity
      ? (RARITY_COLORS[enemyRarity] ?? CATEGORY_COLORS[enemyCategory] ?? '#9ca3af')
      : (CATEGORY_COLORS[enemyCategory] ?? '#9ca3af')
  )

  const INTENT_ICONS: Record<string, string> = {
    attack: '⚔️',
    multi_attack: '⚔️⚔️',
    defend: '🛡️',
    buff: '💪',
    debuff: '🔮',
    heal: '💚',
  }

  const INTENT_COLORS: Record<string, string> = {
    attack: 'rgba(231, 76, 60, 0.25)',
    multi_attack: 'rgba(192, 57, 43, 0.3)',
    defend: 'rgba(52, 152, 219, 0.25)',
    buff: 'rgba(241, 196, 15, 0.25)',
    debuff: 'rgba(155, 89, 182, 0.25)',
    heal: 'rgba(46, 204, 113, 0.25)',
  }

  const INTENT_BORDER_COLORS: Record<string, string> = {
    attack: 'rgba(231, 76, 60, 0.6)',
    multi_attack: 'rgba(192, 57, 43, 0.7)',
    defend: 'rgba(52, 152, 219, 0.6)',
    buff: 'rgba(241, 196, 15, 0.6)',
    debuff: 'rgba(155, 89, 182, 0.6)',
    heal: 'rgba(46, 204, 113, 0.6)',
  }

  const INTENT_LABELS: Record<string, string> = {
    attack: 'Attack',
    multi_attack: 'Multi-hit',
    defend: 'Defend',
    buff: 'Buff',
    debuff: 'Debuff',
    heal: 'Heal',
  }

  let intentDisplay = $derived.by(() => {
    if (!enemyIntent) return null
    const icon = INTENT_ICONS[enemyIntent.type] ?? '❓'
    const val = enemyIntent.value
    const label = INTENT_LABELS[enemyIntent.type] ?? ''
    const color = INTENT_COLORS[enemyIntent.type] ?? 'rgba(100, 116, 139, 0.2)'
    const borderColor = INTENT_BORDER_COLORS[enemyIntent.type] ?? 'rgba(100, 116, 139, 0.4)'
    const telegraph = enemyIntent.telegraph ?? ''

    if (enemyIntent.type === 'multi_attack') {
      const hits = enemyIntent.hitCount ?? 2
      return { icon, text: `${val}×${hits}`, type: enemyIntent.type, label, color, borderColor, telegraph }
    }
    if (enemyIntent.type === 'attack') {
      return { icon, text: `${val}`, type: enemyIntent.type, label, color, borderColor, telegraph }
    }
    if (enemyIntent.type === 'defend') {
      return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type, label, color, borderColor, telegraph }
    }
    return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type, label, color, borderColor, telegraph }
  })

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let committedCard = $derived<Card | null>(
    committedCardIndex !== null && handCards[committedCardIndex] ? handCards[committedCardIndex] : null,
  )

  function applyAscensionQuestionPresentation(card: Card, base: ReturnType<typeof getQuestionPresentation>) {
    const tier1OptionCount = turnState?.ascensionTier1OptionCount ?? 3
    if (card.tier === '1' && card.isMasteryTrial !== true && tier1OptionCount > base.optionCount) {
      return { ...base, optionCount: tier1OptionCount }
    }
    return base
  }

  let selectedPresentation = $derived(
    selectedCard
      ? applyAscensionQuestionPresentation(
        selectedCard,
        getQuestionPresentation(selectedCard.tier, selectedCard.isMasteryTrial === true),
      )
      : null,
  )

  let committedPresentation = $derived(
    committedCard
      ? applyAscensionQuestionPresentation(
        committedCard,
        getQuestionPresentation(committedCard.tier, committedCard.isMasteryTrial === true),
      )
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

  let timerEnabled = $derived(currentDifficulty !== 'relaxed')
  let canaryQuestionBias = $derived(turnState?.canaryQuestionBias ?? 0)

  let effectiveTimerSeconds = $derived.by(() => {
    if (!turnState || !committedPresentation || !committedQuizData) return 4

    // Apply mastery difficulty boost (treat as higher floor for timer)
    const masteryBoostFloors = run?.deckMasteryPct
      ? getDifficultyBoostFloors(run.deckMasteryPct)
      : 0;
    const effectiveFloor = turnState.deck.currentFloor + masteryBoostFloors;

    const floorBase = committedPresentation.timerOverride
      ?? (FLOOR_TIMER.find((entry) => effectiveFloor <= entry.maxFloor)?.seconds ?? 4)

    const allText = [committedQuizData.question, ...committedQuizData.answers].join(' ')
    const totalWords = allText.trim().split(/\s+/).filter(Boolean).length

    const extraWords = Math.max(0, totalWords - 10)
    const wordBonus = Math.floor(extraWords / 8)
    const slowReaderBonus = slowReaderEnabled && !committedPresentation.disableSlowReader ? 3 : 0

    const ascensionPenalty = (turnState.ascensionBaseTimerPenaltySeconds ?? 0) + (turnState.ascensionEncounterTimerPenaltySeconds ?? 0)
    let timer = floorBase + wordBonus + slowReaderBonus - ascensionPenalty


    return Math.max(2, timer)
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

    // fade in 200ms (CSS), hold 5s, fade out 300ms (CSS), cleanup
    setTimeout(() => {
      wowFactorVisible = false
    }, 5200) // 200ms fade-in + 5000ms hold
    setTimeout(() => {
      wowFactorText = null
    }, 5500) // + 300ms fade-out
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

  /** Redact the correct answer from the question text to prevent self-answering. */
  function redactAnswerFromQuestion(question: string, answer: string): string {
    if (!answer || answer.length < 3) return question

    // Strip common prefixes like "About", "Approximately", etc. to find the core value
    const prefixPattern = /^(about|approximately|around|roughly|nearly|over|under|more than|less than|at least)\s+/i
    const coreAnswer = answer.replace(prefixPattern, '').trim()

    // Skip very short answers or boolean answers to avoid false positives
    if (coreAnswer.length < 3) return question
    if (/^(true|false|yes|no)$/i.test(coreAnswer)) return question

    // Try full answer with word boundaries first
    const escaped = coreAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fullRegex = new RegExp(`\\b${escaped}\\b`, 'gi')
    if (fullRegex.test(question)) {
      return question.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '___')
    }

    // Try part before parentheses: "Isinglass (fish swim bladders)" → try "Isinglass"
    const parenIdx = coreAnswer.indexOf('(')
    if (parenIdx > 2) {
      const beforeParen = coreAnswer.substring(0, parenIdx).trim()
      if (beforeParen.length >= 3) {
        const parenEscaped = beforeParen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const parenRegex = new RegExp(`\\b${parenEscaped}\\b`, 'gi')
        if (parenRegex.test(question)) {
          return question.replace(new RegExp(`\\b${parenEscaped}\\b`, 'gi'), '___')
        }
      }
    }

    return question
  }

  function normalizeForSimilarity(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  }

  function distractorSimilarityScore(correctAnswer: string, distractor: string): number {
    const correctTokens = normalizeForSimilarity(correctAnswer)
    const distractorTokens = normalizeForSimilarity(distractor)
    if (correctTokens.length === 0 || distractorTokens.length === 0) return 0

    const correctSet = new Set(correctTokens)
    const overlap = distractorTokens.reduce((acc, token) => acc + (correctSet.has(token) ? 1 : 0), 0)
    const overlapRatio = overlap / Math.max(correctSet.size, 1)
    const lengthPenalty = Math.abs(correctAnswer.length - distractor.length) / Math.max(correctAnswer.length, 1)

    return overlapRatio * 10 - lengthPenalty
  }

  function pickDistractors(
    distractorSource: string[],
    correctAnswer: string,
    distractorCount: number,
    preferClose: boolean,
  ): string[] {
    const unique = [...new Set(distractorSource.filter((entry) => entry && entry !== correctAnswer))]
    if (unique.length === 0) return []

    if (!preferClose) {
      return shuffled(unique).slice(0, Math.min(distractorCount, unique.length))
    }

    const ranked = shuffled(unique)
      .map((entry) => ({ entry, score: distractorSimilarityScore(correctAnswer, entry) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.entry)

    const hardCount = Math.min(distractorCount, Math.max(1, Math.ceil(distractorCount * 0.7)))
    const primary = ranked.slice(0, hardCount)
    const secondaryPool = ranked.slice(hardCount)
    return [...primary, ...shuffled(secondaryPool).slice(0, distractorCount - primary.length)]
  }

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
    const forceHardFormats = turnState?.ascensionForceHardQuestionFormats === true
    const variantPool = hasVariantsArray
      ? (() => {
        const variants = fact.variants!
        if (!forceHardFormats) return variants
        const preferred = variants.filter((variant) => (
          variant.type === 'fill_blank' || variant.type === 'reverse' || variant.type === 'context'
        ))
        return preferred.length > 0 ? preferred : variants
      })()
      : []
    const variantCount = hasVariantsArray ? variantPool.length : 3
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
      const variant = variantPool[variantIndex % variantPool.length]
      question = variant.question
      correctAnswer = variant.correctAnswer
      distractorSource = variant.distractors ?? fact.distractors
      // Store back the source index in the original array for variety tracking.
      const sourceVariantIndex = fact.variants!.findIndex((entry) => (
        entry.question === variant.question && entry.correctAnswer === variant.correctAnswer
      ))
      if (sourceVariantIndex >= 0) variantIndex = sourceVariantIndex
    } else {
      // Legacy system for vocab cards and facts without variants
      correctAnswer = fact.correctAnswer
      distractorSource = fact.distractors

      if (variantIndex === 2 || forceHardFormats) {
        question = `Fill in the blank: ${fact.statement.replace(fact.correctAnswer, '_____')}`
      } else {
        question = fact.quizQuestion
      }
    }

    const distractorCount = Math.max(2, optionCount - 1)
    const picked = pickDistractors(
      distractorSource,
      correctAnswer,
      Math.min(distractorCount, distractorSource.length),
      turnState?.ascensionPreferCloseDistractors === true,
    )

    // Redact answer if it appears verbatim in the question text
    question = redactAnswerFromQuestion(question, correctAnswer)

    const allAnswers = [...picked]
    const insertIdx = Math.floor(Math.random() * (allAnswers.length + 1))
    allAnswers.splice(insertIdx, 0, correctAnswer)

    return {
      question,
      answers: allAnswers,
      correctAnswer,
      variantIndex,
      questionImageUrl: fact.imageUrl ?? undefined,
    }
  }

  function getTierUpTransition(
    previousTier: ReturnType<typeof getCardTier> | null,
    nextTier: ReturnType<typeof getCardTier> | null,
  ): TierUpTransition | null {
    if (!previousTier || !nextTier || previousTier === nextTier) return null
    if (previousTier === '1' && nextTier === '2a') return 'tier1_to_2a'
    if (previousTier === '2a' && nextTier === '2b') return 'tier2a_to_2b'
    if (previousTier === '2b' && nextTier === '3') return 'tier2b_to_3'
    return null
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

  function handleCastDirect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return
    if (Math.max(1, card.apCost ?? 1) > (turnState?.apCurrent ?? 0)) return

    // Select and immediately cast
    selectedIndex = index
    cardPlayStage = 'selected'

    // Now cast
    handleCast()
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
    const previousReviewState = getReviewStateByFactId(card.factId)
    const previousTier = previousReviewState ? getCardTier(previousReviewState) : null

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
        cardType: card.cardType,
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
        const nextReviewState = getReviewStateByFactId(card.factId)
        const nextTier = nextReviewState ? getCardTier(nextReviewState) : null
        const tierUpTransition = getTierUpTransition(previousTier, nextTier)
        if (tierUpTransition) {
          tierUpTransitions = { ...tierUpTransitions, [cardId]: tierUpTransition }
        }
        const celebrationDelay = tierUpTransition ? TIER_UP_DURATION : 0

        setTimeout(() => {
          if (tierUpTransition) {
            // Phase 2: Tier-up celebration
            cardAnimations = { ...cardAnimations, [cardId]: 'tier-up' }
            return
          }
          // Phase 2: Mechanic animation (400-900ms)
          cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }

          juiceManager.fire({
            type: 'correct',
            damage: effectVal,
            isCritical: speedBonus,
            comboCount: nextCombo,
            effectLabel: effectLabel,
            isPerfectTurn: willBePerfect,
            cardType: card.cardType,
          })
        }, REVEAL_DURATION)

        if (tierUpTransition) {
          setTimeout(() => {
            cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }

            juiceManager.fire({
              type: 'correct',
              damage: effectVal,
              isCritical: speedBonus,
              comboCount: nextCombo,
              effectLabel: effectLabel,
              isPerfectTurn: willBePerfect,
              cardType: card.cardType,
            })
          }, REVEAL_DURATION + TIER_UP_DURATION)
        }

        setTimeout(() => {
          // Phase 3: Launch
          cardAnimations = { ...cardAnimations, [cardId]: 'launch' }
        }, REVEAL_DURATION + celebrationDelay + MECHANIC_DURATION)

        setTimeout(() => {
          // Cleanup
          cardAnimations = { ...cardAnimations, [cardId]: null }
          tierUpTransitions = Object.fromEntries(
            Object.entries(tierUpTransitions).filter(([id]) => id !== cardId),
          ) as Record<string, TierUpTransition>
          animatingCards = animatingCards.filter(c => c.id !== cardId)
        }, REVEAL_DURATION + celebrationDelay + MECHANIC_DURATION + LAUNCH_DURATION)
      } else {
        // No cardback: buffer card, call onplaycard immediately
        animatingCards = [...animatingCards, card]
        onplaycard(cardId, true, speedBonus, responseTimeMs, quizVariantIndex)
        const nextReviewState = getReviewStateByFactId(card.factId)
        const nextTier = nextReviewState ? getCardTier(nextReviewState) : null
        const tierUpTransition = getTierUpTransition(previousTier, nextTier)
        if (tierUpTransition) {
          tierUpTransitions = { ...tierUpTransitions, [cardId]: tierUpTransition }
          cardAnimations = { ...cardAnimations, [cardId]: 'tier-up' }
        } else {
          cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }
        }

        const mechanicStartDelay = tierUpTransition ? TIER_UP_DURATION : 0

        setTimeout(() => {
          cardAnimations = { ...cardAnimations, [cardId]: 'mechanic' }

          juiceManager.fire({
            type: 'correct',
            damage: effectVal,
            isCritical: speedBonus,
            comboCount: nextCombo,
            effectLabel: effectLabel,
            isPerfectTurn: willBePerfect,
            cardType: card.cardType,
          })
        }, mechanicStartDelay)

        setTimeout(() => {
          // Launch
          cardAnimations = { ...cardAnimations, [cardId]: 'launch' }
        }, mechanicStartDelay + MECHANIC_DURATION)

        setTimeout(() => {
          // Cleanup
          cardAnimations = { ...cardAnimations, [cardId]: null }
          tierUpTransitions = Object.fromEntries(
            Object.entries(tierUpTransitions).filter(([id]) => id !== cardId),
          ) as Record<string, TierUpTransition>
          animatingCards = animatingCards.filter(c => c.id !== cardId)
        }, mechanicStartDelay + MECHANIC_DURATION + LAUNCH_DURATION)
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
    <div class="empty-state">
      <p>Waiting for encounter...</p>
      {#if onreturnhub}
        <button type="button" class="return-hub-btn" onclick={onreturnhub}>Return to Hub</button>
      {/if}
    </div>
  {:else}
    <RelicTray relics={displayRelics} triggeredRelicId={turnState.triggeredRelicId} />

    {#if expertModeActive}
      <div class="expert-badge" data-testid="expert-mode-badge">
        <span class="expert-label">
          {expertModeLabel === 'practiced' ? 'Practiced' : expertModeLabel === 'expert' ? 'Expert' : 'Mastered'}
        </span>
        <span class="expert-mult">{expertModeRewardMult}x Rewards</span>
      </div>
    {/if}

    {#if turnState && enemyName}
      <div class="enemy-name-header" style="color: {categoryColor}">
        {enemyName}
      </div>
    {/if}

    <div class="ap-orb" class:ap-active={apCurrent > 0} class:ap-empty={apCurrent === 0} aria-label="Action points: {apCurrent}">
      <span class="ap-number">{apCurrent}</span>
    </div>

    {#if activeBounties.length > 0}
      <div class="bounty-strip" aria-label="Bounty progress">
        {#each activeBounties.slice(0, 2) as bounty (bounty.id)}
          <div class="bounty-line" class:done={bounty.completed}>{bountyLabel(bounty)}</div>
        {/each}
      </div>
    {/if}

    {#if intentDisplay && cardPlayStage !== 'committed'}
      <button
        class="enemy-intent-bubble"
        class:intent-expanded={intentPopupOpen}
        style="background: {intentDisplay.color}; border-color: {intentDisplay.borderColor};"
        onclick={() => { intentPopupOpen = !intentPopupOpen }}
        aria-label="View intent details"
      >
        <div class="intent-bubble-summary">
          <span class="intent-icon">{intentDisplay.icon}</span>
          {#if intentDisplay.text}
            <span class="intent-value" class:intent-value-attack={intentDisplay.type === 'attack' || intentDisplay.type === 'multi_attack'}
              class:intent-value-defend={intentDisplay.type === 'defend'}
              class:intent-value-heal={intentDisplay.type === 'heal'}
              class:intent-value-buff={intentDisplay.type === 'buff'}
              class:intent-value-debuff={intentDisplay.type === 'debuff'}>{intentDisplay.text}</span>
          {/if}
        </div>
        {#if intentPopupOpen && enemyIntent}
          <div class="intent-bubble-detail">
            {#if enemyIntent.type === 'attack'}
              <p>Deals <strong class="popup-val-attack">{enemyIntent.value}</strong> dmg</p>
            {:else if enemyIntent.type === 'multi_attack'}
              <p><strong class="popup-val-attack">{enemyIntent.hitCount ?? 2}</strong>x <strong class="popup-val-attack">{enemyIntent.value}</strong> dmg</p>
            {:else if enemyIntent.type === 'defend'}
              <p>+<strong class="popup-val-defend">{enemyIntent.value}</strong> block</p>
            {:else if enemyIntent.type === 'buff'}
              <p>Buff</p>
            {:else if enemyIntent.type === 'debuff'}
              <p>Debuff</p>
            {:else if enemyIntent.type === 'heal'}
              <p>+<strong class="popup-val-heal">{enemyIntent.value}</strong> HP</p>
            {/if}
          </div>
        {/if}
        <div class="intent-bubble-tail"></div>
      </button>
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
        questionImageUrl={committedQuizData.questionImageUrl}
        timerDuration={effectiveTimerSeconds}
        timerEnabled={timerEnabled}
        comboCount={turnState.comboCount}
        hintsRemaining={turnState.deck.hintsRemaining}
        speedBonusThreshold={speedBonusThreshold}
        showMasteryTrialHeader={committedCard.isMasteryTrial === true}
        timerColorVariant={timerColorVariant}
        highlightHint={turnState.canaryQuestionBias < 0}
        allowCancel={false}
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
      {tierUpTransitions}
      apCurrent={apCurrent}
      {comboMultiplier}
      disabled={turnState.phase !== 'player_action' || cardPlayStage === 'committed'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
      oncastdirect={handleCastDirect}
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

  {#if synergyFlashText}
    <div class="synergy-flash" transition:fade={{ duration: 300 }}>
      <span class="synergy-flash-icon">✦</span>
    </div>
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
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.5) 30%, transparent 100%);
    overflow: visible;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    color: #7f8c8d;
    font-size: 14px;
  }

  .empty-state p {
    margin: 0;
  }

  .return-hub-btn {
    min-height: 44px;
    padding: 0 24px;
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1f2937;
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ap-orb {
    position: absolute;
    left: 16px;
    top: 10px;
    z-index: 8;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.3s, box-shadow 0.3s;
  }

  .ap-orb.ap-active {
    background: radial-gradient(circle at 40% 35%, #ff4444, #991111);
    box-shadow: 0 0 10px 3px rgba(255, 140, 0, 0.5);
    animation: none;
    overflow: visible;
  }

  .ap-orb.ap-active::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      rgba(255, 140, 0, 0.5),
      rgba(255, 179, 71, 0.3),
      transparent 40%,
      rgba(255, 140, 0, 0.4) 60%,
      rgba(255, 100, 0, 0.5) 80%,
      transparent 90%,
      rgba(255, 140, 0, 0.5)
    );
    filter: blur(3px);
    animation: ap-fire-rotate 3s linear infinite;
    z-index: -1;
    pointer-events: none;
  }

  .ap-orb.ap-empty {
    background: radial-gradient(circle at 40% 35%, #666666, #333333);
    box-shadow: none;
    animation: none;
  }

  .ap-orb.ap-empty::before {
    display: none;
  }

  .ap-number {
    font-family: monospace;
    font-size: 18px;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  @keyframes ap-fire-rotate {
    from { transform: rotate(0deg) scale(0.97); }
    25% { transform: rotate(90deg) scale(1.03); }
    50% { transform: rotate(180deg) scale(0.97); }
    75% { transform: rotate(270deg) scale(1.03); }
    to { transform: rotate(360deg) scale(0.97); }
  }

  .bounty-strip {
    position: absolute;
    right: 8px;
    bottom: 68px;
    z-index: 8;
    min-width: 120px;
    max-width: 180px;
    background: rgba(15, 23, 35, 0.55);
    border: 1px solid rgba(71, 85, 105, 0.4);
    border-radius: 8px;
    padding: 4px 6px;
    display: grid;
    gap: 2px;
    color: rgba(220, 231, 246, 0.7);
    font-size: 9px;
  }

  .bounty-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bounty-line.done {
    color: #facc15;
  }

  .enemy-intent-bubble {
    position: fixed;
    top: 16%;
    right: 52%;
    z-index: 12;
    border: 1.5px solid;
    border-radius: 12px;
    padding: 6px 10px;
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font: inherit;
    color: inherit;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), padding 0.2s ease;
    transform-origin: bottom right;
  }

  .enemy-intent-bubble:active {
    transform: scale(0.95);
  }

  .enemy-intent-bubble.intent-expanded {
    transform: scale(1.3);
    padding: 8px 14px;
  }

  .intent-bubble-summary {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .intent-bubble-detail {
    font-size: 11px;
    color: #e2e8f0;
    text-align: center;
    white-space: nowrap;
  }

  .intent-bubble-detail p {
    margin: 2px 0 0;
  }

  .intent-bubble-tail {
    position: absolute;
    bottom: -6px;
    right: 8px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid;
    border-top-color: inherit;
    opacity: 0.7;
  }

  .intent-icon {
    font-size: 16px;
    line-height: 1;
  }

  .intent-value {
    font-size: 16px;
    font-weight: 800;
    color: #e2e8f0;
    min-width: 24px;
    text-align: center;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
  }

  .intent-value-attack {
    color: #ef4444;
  }

  .intent-value-defend {
    color: #3b82f6;
  }

  .intent-value-heal {
    color: #22c55e;
  }

  .intent-value-buff {
    color: #eab308;
  }

  .intent-value-debuff {
    color: #a855f7;
  }

  .popup-val-attack {
    color: #ef4444;
  }

  .popup-val-defend {
    color: #3b82f6;
  }

  .popup-val-heal {
    color: #22c55e;
  }

  .intent-enemy-name {
    font-size: 10px;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .enemy-name-header {
    position: fixed;
    top: 4vh;
    left: 50%;
    transform: translateX(-50%);
    z-index: 11;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-family: 'Georgia', 'Times New Roman', serif;
    text-shadow:
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 8px rgba(0, 0, 0, 0.9);
    white-space: nowrap;
    pointer-events: none;
  }

  @keyframes intent-fade-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
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
    top: 60px;
    left: 16px;
  }

  .end-turn-btn {
    position: absolute;
    left: 12px;
    bottom: 12px;
    width: auto;
    min-width: 110px;
    padding: 0 20px;
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

  .expert-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    z-index: 50;
    pointer-events: none;
  }
  .expert-label {
    font-size: 10px;
    font-weight: 700;
    color: #facc15;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .expert-mult {
    font-size: 9px;
    color: #cbd5e1;
  }

  .synergy-flash {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 9999;
    animation: synergy-pulse 1.5s ease-out forwards;
  }

  .synergy-flash-icon {
    font-size: 4rem;
    color: #ffd700;
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4);
    opacity: 0;
    animation: synergy-icon-fade 1.5s ease-out forwards;
  }

  @keyframes synergy-icon-fade {
    0% { opacity: 0; transform: scale(0.5); }
    15% { opacity: 1; transform: scale(1.2); }
    30% { opacity: 1; transform: scale(1.0); }
    100% { opacity: 0; transform: scale(1.5); }
  }
</style>
