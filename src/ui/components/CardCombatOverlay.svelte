<script lang="ts">
  import { get } from 'svelte/store'
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { Card } from '../../data/card-types'
  import type { TurnState } from '../../services/turnManager'
  import { getComboMultiplier } from '../../services/turnManager'
  import { FLOOR_TIMER } from '../../data/balance'
  import { isSurgeTurn } from '../../services/surgeSystem'
  import { getQuestionPresentation } from '../../services/questionFormatter'
  import {
    difficultyMode,
    isSlowReader,
    onboardingState,
    markOnboardingTooltipSeen,
    type DifficultyMode,
  } from '../../services/cardPreferences'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'
  import { setQuizVisible } from '../../services/keyboardInput'
  import KeyboardShortcutHelp from './KeyboardShortcutHelp.svelte'
  import CardHand from './CardHand.svelte'
  import CardExpanded from './CardExpanded.svelte'
  import DamageNumber from './DamageNumber.svelte'
  import ComboCounter from './ComboCounter.svelte'
  import RelicTray from './RelicTray.svelte'
  import { RELIC_BY_ID } from '../../data/relics/index'
  import { getMaxRelicSlots } from '../../services/relicEffectResolver'
  import { juiceManager } from '../../services/juiceManager'
  import { getCombatScene } from '../../services/encounterBridge'
  import { factsDB } from '../../services/factsDB'
  import { getReviewStateByFactId } from '../stores/playerData'
  import type { CombatScene } from '../../game/scenes/CombatScene'
  import { getCardTier } from '../../services/tierDerivation'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { reshuffleEvent } from '../../services/deckManager'
  import { audioManager } from '../../services/audioService'
  import { REVEAL_DURATION, SWOOSH_DURATION, IMPACT_DURATION, DISCARD_DURATION, TIER_UP_DURATION, type CardAnimPhase } from '../utils/mechanicAnimations'
  import { shuffled } from '../../services/randomUtils'
  import { getRunRng, isRunRngActive, seededShuffled } from '../../services/seededRng'
  import { isPlaceholderDistractor } from '../../services/distractorFilter'
  import { getVocabDistractors } from '../../services/vocabDistractorService'
  import { activeRunState } from '../../services/runStateStore'
  import { sellEquippedRelic } from '../../services/gameFlowController'
  import { getIntentIconPath } from '../utils/iconAssets'
  import { getMasteryScalingTier, getRewardMultiplier, getDifficultyBoostFloors } from '../../services/masteryScalingService'
  import { synergyFlash } from '../stores/gameState'
  import { getNonCuratedQuestion, getQuestionVariantCount } from '../utils/combatQuestionPolicy'
  import StatusEffectBar from './StatusEffectBar.svelte'
  import { getShortCardDescription } from '../../services/cardDescriptionService'

  interface Props {
    turnState: TurnState | null
    onplaycard: (
      cardId: string,
      correct: boolean,
      speedBonus: boolean,
      responseTimeMs?: number,
      variantIndex?: number,
      playMode?: 'charge' | 'quick',
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

  let { turnState, onplaycard, onskipcard, onendturn, onusehint, onreturnhub }: Props = $props()

  let cardPlayStage = $state<CardPlayStage>('hand')
  let selectedIndex = $state<number | null>(null)
  let committedCardIndex = $state<number | null>(null)
  let committedQuizData = $state<QuizData | null>(null)
  let committedAtMs = $state(0)

  // V2 Echo: "Must Charge!" tooltip state — shown when Quick Play is attempted on an Echo card
  let showMustChargeTooltip = $state(false)
  let mustChargeTimer = $state<ReturnType<typeof setTimeout> | null>(null)

  /** Refs to the draw/discard pile indicator elements — used to set CSS vars for card animations. */
  let drawPileEl = $state<HTMLDivElement | undefined>(undefined)
  let discardPileEl = $state<HTMLDivElement | undefined>(undefined)

  /** Set CSS custom properties for pile positions so card animations can target them. */
  $effect(() => {
    if (!drawPileEl || !discardPileEl) return
    const drawRect = drawPileEl.getBoundingClientRect()
    const discardRect = discardPileEl.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--draw-pile-x', `${drawRect.left + drawRect.width / 2}px`)
    root.style.setProperty('--draw-pile-y', `${drawRect.top + drawRect.height / 2}px`)
    root.style.setProperty('--discard-pile-x', `${discardRect.left + discardRect.width / 2}px`)
    root.style.setProperty('--discard-pile-y', `${discardRect.top + discardRect.height / 2}px`)
  })

  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean }>>([])
  let cardAnimations = $state<Record<string, CardAnimPhase>>({})
  type TierUpTransition = 'tier1_to_2a' | 'tier2a_to_2b' | 'tier2b_to_3'
  let tierUpTransitions = $state<Record<string, TierUpTransition>>({})
  let animatingCards = $state<Card[]>([])
  let damageIdCounter = $state(0)
  let slowReaderEnabled = $state(false)
  let currentDifficulty = $state<DifficultyMode>('normal')

  // Near-death tension indicator
  let isNearDeath = $derived(
    turnState != null && turnState.playerState.hp > 0 && turnState.playerState.hp < turnState.playerState.maxHP * 0.25
  )

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

  // Deck reshuffle animation state
  let showReshuffle = $state(false)
  let reshuffleCardCount = $state(0)
  /** Hold hand cards until reshuffle animation finishes, so draw swoosh plays AFTER shuffle. */
  let reshuffleHoldingHand = $state(false)

  $effect(() => {
    const event = $reshuffleEvent
    if (event && event.cardCount > 0) {
      reshuffleCardCount = Math.min(event.cardCount, 12)
      showReshuffle = true
      reshuffleHoldingHand = true
      const totalDuration = reshuffleCardCount * 40 + 300
      for (let i = 0; i < reshuffleCardCount; i++) {
        setTimeout(() => audioManager.playSound('card_shuffle'), i * 40)
      }
      setTimeout(() => {
        showReshuffle = false
        reshuffleHoldingHand = false  // release hand — cards will mount and swoosh from draw pile
      }, totalDuration)
    }
  })

  let handCards = $derived<Card[]>(reshuffleHoldingHand ? [] : (turnState?.deck.hand ?? []))

  let comboCount = $derived(turnState?.comboCount ?? 0)
  let comboMultiplier = $derived(getComboMultiplier(comboCount))
  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let chainLength = $derived(turnState?.chainLength ?? 0)
  let chainType = $derived(turnState?.chainType ?? null)
  let chainMultiplier = $derived(turnState?.chainMultiplier ?? 1.0)
  let displayRelics = $derived(
    [...(turnState?.activeRelicIds ?? [])].map((id) => {
      const def = RELIC_BY_ID[id];
      return {
        definitionId: id,
        name: def?.name ?? id,
        description: def?.description ?? '',
        icon: def?.icon ?? '?',
        rarity: def?.rarity ?? 'common',
      };
    })
  )
  let apCurrent = $derived(turnState?.apCurrent ?? 0)
  let apMax = $derived(turnState?.apMax ?? 0)
  let drawPileCount = $derived(turnState?.deck.drawPile.length ?? 0)
  let discardPileCount = $derived(turnState?.deck.discardPile.length ?? 0)
  /** Number of visual card stacks to show (1-5 based on pile size). */
  let drawStackCount = $derived(Math.max(1, Math.min(5, Math.ceil(drawPileCount / 3))))
  let discardStackCount = $derived(Math.max(0, Math.min(5, Math.ceil(discardPileCount / 3))))

  const run = $derived($activeRunState)
  const maxRelicSlots = $derived(run ? getMaxRelicSlots(run.runRelics) : 5)
  const expertModeActive = $derived(
    (run?.deckMasteryPct ?? 0) >= 0.40
  )
  const expertModeLabel = $derived(
    expertModeActive ? getMasteryScalingTier(run?.deckMasteryPct ?? 0) : null
  )
  const expertModeRewardMult = $derived(
    expertModeActive ? getRewardMultiplier(run?.deckMasteryPct ?? 0) : 1.0
  )
  const isPracticeRun = $derived(run?.practiceRunDetected === true)

  let enemyIntent = $derived(turnState?.enemy.nextIntent ?? null)
  let enemyName = $derived(turnState?.enemy.template.name ?? '')
  let enemyCategory = $derived(turnState?.enemy.template.category ?? 'common')
  let currentFloor = $derived(turnState?.deck.currentFloor ?? 0)
  let currentEncounter = $derived(turnState?.deck.currentEncounter ?? 0)

  // Unified effect type for the icon bar
  interface DisplayEffect {
    type: string
    value: number
    turnsRemaining: number
  }

  let enemyEffects = $derived<DisplayEffect[]>(
    (() => {
      if (!turnState) return []
      const effects: DisplayEffect[] = [...(turnState.enemy?.statusEffects ?? [])]
      return effects.filter(e => e.turnsRemaining > 0)
    })()
  )

  let playerEffects = $derived<DisplayEffect[]>(
    (() => {
      if (!turnState) return []
      const effects: DisplayEffect[] = [...(turnState.playerState?.statusEffects ?? [])]

      // Add TurnState flags as virtual effects
      if (turnState.thornsActive && turnState.thornsValue > 0) {
        effects.push({ type: 'thorns', value: turnState.thornsValue, turnsRemaining: 1 })
      }
      if (turnState.buffNextCard > 0) {
        effects.push({ type: 'empower', value: turnState.buffNextCard, turnsRemaining: 1 })
      }
      if (turnState.doubleStrikeReady) {
        effects.push({ type: 'double_strike', value: 60, turnsRemaining: 1 })
      }
      if (turnState.foresightTurnsRemaining > 0) {
        effects.push({ type: 'foresight', value: 2, turnsRemaining: turnState.foresightTurnsRemaining })
      }
      if (turnState.focusReady && turnState.focusCharges > 0) {
        effects.push({ type: 'focus', value: turnState.focusCharges, turnsRemaining: 1 })
      }
      if (turnState.overclockReady) {
        effects.push({ type: 'overclock', value: 1, turnsRemaining: 1 })
      }
      if (turnState.persistentShield > 0) {
        effects.push({ type: 'fortify', value: turnState.persistentShield, turnsRemaining: 1 })
      }
      if (turnState.phoenixRageTurnsRemaining > 0) {
        effects.push({ type: 'strength', value: 1, turnsRemaining: turnState.phoenixRageTurnsRemaining })
      }

      return effects.filter(e => e.turnsRemaining > 0)
    })()
  )

  let intentPopupOpen = $state(false)

  function pileTooltip(label: string, cards: Card[], fromTop = true): string {
    if (cards.length === 0) return `${label}: empty`
    const ordered = fromTop ? [...cards].reverse() : cards
    const preview = ordered
      .slice(0, 3)
      .map((card) => card.mechanicName ?? card.cardType)
      .join(', ')
    return `${label}: ${cards.length} cards\n${fromTop ? 'Top' : 'Newest'}: ${preview}`
  }

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

  /** Emoji fallbacks for enemy intents */
  const INTENT_EMOJI: Record<string, string> = {
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
    const icon = INTENT_EMOJI[enemyIntent.type] ?? '❓'
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
    if (enemyIntent.type === 'buff') {
      const stacks = enemyIntent.statusEffect?.value ?? enemyIntent.value
      const turns = enemyIntent.statusEffect?.turns
      const compactText = turns ? `${stacks}×${turns}` : `${stacks}`
      return { icon, text: compactText, type: enemyIntent.type, label, color, borderColor, telegraph }
    }
    if (enemyIntent.type === 'debuff') {
      const stacks = enemyIntent.statusEffect?.value ?? enemyIntent.value
      const turns = enemyIntent.statusEffect?.turns
      const compactText = turns ? `${stacks}×${turns}` : `${stacks}`
      return { icon, text: compactText, type: enemyIntent.type, label, color, borderColor, telegraph }
    }
    return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type, label, color, borderColor, telegraph }
  })

  let intentDetailText = $derived.by(() => {
    if (!enemyIntent) return 'Preparing...'
    const val = enemyIntent.value
    switch (enemyIntent.type) {
      case 'attack':
        return `Attacks for ${val} damage`
      case 'multi_attack': {
        const hits = enemyIntent.hitCount ?? 2
        return `Attacks ${hits} times for ${val} each`
      }
      case 'defend':
        return `Gains ${val} Block`
      case 'heal':
        return `Heals ${val} HP`
      case 'buff': {
        const se = enemyIntent.statusEffect
        if (se) return `Buffs self: ${se.value} ${se.type} for ${se.turns} turns`
        return `Buffs self for ${val} turns`
      }
      case 'debuff': {
        const se = enemyIntent.statusEffect
        if (!se) return `Applies ${val} weakness`
        if (se.type === 'weakness') return `Applies Weakness for ${se.turns} turns`
        if (se.type === 'vulnerable') return `Applies Vulnerable for ${se.turns} turns`
        if (se.type === 'poison') return `Applies ${se.value} Poison`
        return `Applies ${se.value} ${se.type} for ${se.turns} turns`
      }
      default:
        return 'Preparing...'
    }
  })

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let committedCardSnapshot = $state<Card | null>(null)
  let committedCard = $derived<Card | null>(committedCardSnapshot)

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
    !selectedCard || !turnState || (selectedCard.apCost ?? 1) > turnState.apCurrent,
  )

  /** True on Surge turns — Charge Play costs +0 AP instead of +1. */
  let isSurgeActive = $derived(isSurgeTurn(turnState?.turnNumber ?? 1))

  /** Focus AP discount: 1 when Focus is active with charges, 0 otherwise. */
  let focusDiscount = $derived(
    (turnState?.focusReady && (turnState?.focusCharges ?? 0) > 0) ? 1 : 0
  )

  let playerHpCurrent = $derived(turnState?.playerState.hp ?? 0)
  let playerHpMax = $derived(turnState?.playerState.maxHP ?? 1)
  let playerShield = $derived(turnState?.playerState.shield ?? 0)
  let playerHpRatio = $derived(playerHpMax > 0 ? Math.max(0, Math.min(1, playerHpCurrent / playerHpMax)) : 0)
  let playerHpColor = $derived(
    playerHpRatio > 0.5 ? '#2ecc71' : playerHpRatio > 0.25 ? '#f59e0b' : '#ef4444'
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
      onScreenFlash: (intensity) => {
        const scene = getCombatScene()
        scene?.playScreenFlash(intensity)
      },
      onParticleBurst: (count, tint) => {
        const scene = getCombatScene()
        if (scene) {
          scene.burstParticles(count, scene.scale.width / 2, scene.scale.height * 0.4, tint)
        }
      },
      onComboScreenEdge: () => {
        const scene = getCombatScene()
        scene?.playGoldFlash()
      },
      onSpeedBonusPop: () => {
        const scene = getCombatScene()
        scene?.playSpeedBonusPop()
      },
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
    const unique = [...new Set(distractorSource.filter((entry) => entry && entry !== correctAnswer && !isPlaceholderDistractor(entry)))]
    if (unique.length === 0) return []

    if (unique.length < distractorCount && import.meta.env.DEV) {
      console.warn(`[pickDistractors] Only ${unique.length}/${distractorCount} valid distractors after filtering placeholders`)
    }

    if (!preferClose) {
      return (isRunRngActive() ? seededShuffled(getRunRng('quiz'), unique) : shuffled(unique)).slice(0, Math.min(distractorCount, unique.length))
    }

    const ranked = (isRunRngActive() ? seededShuffled(getRunRng('quiz'), unique) : shuffled(unique))
      .map((entry) => ({ entry, score: distractorSimilarityScore(correctAnswer, entry) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.entry)

    const hardCount = Math.min(distractorCount, Math.max(1, Math.ceil(distractorCount * 0.7)))
    const primary = ranked.slice(0, hardCount)
    const secondaryPool = ranked.slice(hardCount)
    return [...primary, ...(isRunRngActive() ? seededShuffled(getRunRng('quiz'), secondaryPool) : shuffled(secondaryPool)).slice(0, distractorCount - primary.length)]
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
    const hasVariantsArray = fact.type !== 'vocabulary' && Array.isArray(fact.variants) && fact.variants.length > 0
      && fact.variants.some((v: any) => typeof v === 'string' ? v.trim().length > 0 : (v.question || v.quizQuestion || '').trim().length > 0)
    const forceHardFormats = turnState?.ascensionForceHardQuestionFormats === true
    const variantPool = hasVariantsArray
      ? (() => {
        const variants = fact.variants!
        if (!forceHardFormats) return variants
        // String variants have no type field — skip hard format filtering for them
        const preferred = variants.filter((variant) => (
          typeof variant !== 'string' && (variant.type === 'fill_blank' || variant.type === 'reverse' || variant.type === 'context')
        ))
        return preferred.length > 0 ? preferred : variants
      })()
      : []
    const variantCount = getQuestionVariantCount(hasVariantsArray, variantPool.length)
    const lastVariant = getReviewStateByFactId(card.factId)?.lastVariantIndex ?? -1

    let variantIndex = 0
    if (variantCount > 1) {
      if (canaryQuestionBias < 0) {
        variantIndex = 0
      } else if (canaryQuestionBias > 0) {
        const indices = Array.from({ length: variantCount }, (_, i) => i).filter(i => i !== 0 && i !== lastVariant)
        variantIndex = indices.length > 0
          ? indices[Math.floor((isRunRngActive() ? getRunRng('quiz').next() : Math.random()) * indices.length)]
          : Math.min(1, variantCount - 1)
      } else {
        variantIndex = Math.floor((isRunRngActive() ? getRunRng('quiz').next() : Math.random()) * variantCount)
        let attempts = 0
        while (variantCount > 1 && variantIndex === lastVariant && attempts < 10) {
          variantIndex = Math.floor((isRunRngActive() ? getRunRng('quiz').next() : Math.random()) * variantCount)
          attempts++
        }
      }
    }

    let question: string
    let correctAnswer: string
    let distractorSource: string[]

    if (hasVariantsArray) {
      // Use the fact's variants array — handle both string[] and object[] formats
      const variant = variantPool[variantIndex % variantPool.length]
      if (typeof variant === 'string') {
        // Plain string variant = just an alternate question text
        question = variant
        correctAnswer = fact.correctAnswer
        distractorSource = fact.distractors
      } else {
        question = variant.question || (variant as any).quizQuestion || ''
        correctAnswer = variant.answer ?? variant.correctAnswer ?? fact.correctAnswer
        distractorSource = variant.distractors ?? fact.distractors
      }
      // Store back the source index in the original array for variety tracking.
      const variantQuestion = typeof variant === 'string' ? variant : (variant.question || (variant as any).quizQuestion || '')
      const sourceVariantIndex = fact.variants!.findIndex((entry) => {
        const entryQ = typeof entry === 'string' ? entry : (entry.question || (entry as any).quizQuestion || '')
        return entryQ === variantQuestion
      })
      if (sourceVariantIndex >= 0) variantIndex = sourceVariantIndex
    } else {
      // Legacy system for vocab cards and facts without variants
      correctAnswer = fact.correctAnswer
      distractorSource = fact.distractors

      // Runtime vocab distractor generation (spec 1.8 Option E)
      // Vocab facts ship with distractors=[] — pick from same-language pool at runtime
      if (distractorSource.length === 0 && fact.type === 'vocabulary') {
        distractorSource = getVocabDistractors(fact, Math.max(2, optionCount - 1))
      }

      question = getNonCuratedQuestion(fact.quizQuestion)
    }

    const distractorCount = Math.max(2, optionCount - 1)
    let picked = pickDistractors(
      distractorSource,
      correctAnswer,
      Math.min(distractorCount, distractorSource.length),
      turnState?.ascensionPreferCloseDistractors === true,
    )

    // Runtime distractor type validation — last line of defense
    // If correct answer is numeric but most distractors are text (or vice versa),
    // filter to only type-matching distractors
    if (picked.length >= 2) {
      const answerIsShort = correctAnswer.trim().length <= 5
      const answerIsNumeric = /^\d/.test(correctAnswer.trim()) || /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(correctAnswer.trim())

      if (answerIsNumeric) {
        const numericPicked = picked.filter(d => /^\d/.test(d.trim()) || /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(d.trim()))
        if (numericPicked.length >= 2) {
          picked = numericPicked.slice(0, distractorCount)
        }
      }

      // Length sanity: if answer is very short (<=5 chars), filter out distractors >5x longer
      if (answerIsShort) {
        const reasonable = picked.filter(d => d.trim().length <= correctAnswer.trim().length * 5)
        if (reasonable.length >= 2) {
          picked = reasonable.slice(0, distractorCount)
        }
      }
    }

    // Redact answer if it appears verbatim in the question text (knowledge facts only).
    // Vocab questions intentionally show the target word — never redact them.
    if (fact?.type !== 'vocabulary') {
      question = redactAnswerFromQuestion(question, correctAnswer)
    }

    const allAnswers = [...picked]
    const insertIdx = Math.floor((isRunRngActive() ? getRunRng('quiz').next() : Math.random()) * (allAnswers.length + 1))
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
    committedCardSnapshot = null
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
    return handCards.some((c) => Math.max(0, (c.apCost ?? 1) - focusDiscount) <= turnState!.apCurrent)
  })

  /** V2 Echo: Show "Must Charge!" tooltip for ~1500ms, then auto-dismiss. */
  function triggerMustChargeTooltip(): void {
    showMustChargeTooltip = true
    if (mustChargeTimer !== null) clearTimeout(mustChargeTimer)
    mustChargeTimer = setTimeout(() => {
      showMustChargeTooltip = false
      mustChargeTimer = null
    }, 1500)
  }

  /** Fling-to-Charge: card was dragged 80px+ upward. Select it and immediately open quiz (Charge flow). */
  function handleChargeDirect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    // Check AP: Charge costs +1 (or +0 on Surge)
    const chargeCost = (card.apCost ?? 1) + (isSurgeActive ? 0 : 1)
    if (chargeCost > (turnState?.apCurrent ?? 0)) return

    selectedIndex = index
    cardPlayStage = 'selected'

    // Immediately commit to quiz (Charge flow)
    handleCast()
  }

  function handleSelect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    if (selectedIndex === index && cardPlayStage === 'selected') {
      // V2 Echo: block Quick Play on Echo cards — show "Must Charge!" tooltip
      if (card.isEcho) {
        triggerMustChargeTooltip()
        return
      }
      // Second tap on selected card = Quick Play (no quiz). Delegate to handleCastDirect.
      handleCastDirect(index)
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
    if ((card.apCost ?? 1) > (turnState?.apCurrent ?? 0)) return

    // V2 Echo: block Quick Play on Echo cards — select but show "Must Charge!" tooltip
    if (card.isEcho) {
      selectedIndex = index
      cardPlayStage = 'selected'
      triggerMustChargeTooltip()
      return
    }

    // Quick Play: bypass quiz entirely — play card immediately as correct (no quiz shown)
    const cardId = card.id
    playCardAudio('card-cast')
    cardPlayStage = 'committed'

    // Animate as reveal → swoosh → impact → discard
    animatingCards = [...animatingCards, card]
    cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }

    // Fire the play immediately with playMode: 'quick'
    onplaycard(cardId, true, false, undefined, undefined, 'quick')

    juiceManager.fire({
      type: 'correct',
      damage: Math.round(card.baseEffectValue * card.effectMultiplier),
      isCritical: false,
      comboCount: (turnState?.comboCount ?? 0) + 1,
      effectLabel: (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
        ? getShortCardDescription(card)
        : `${card.cardType.toUpperCase()} ${Math.round(card.baseEffectValue * card.effectMultiplier)}`,
      isPerfectTurn: false,
      cardType: card.cardType,
    })

    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [cardId]: 'swoosh' }
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: 'impact' }
        setTimeout(() => {
          cardAnimations = { ...cardAnimations, [cardId]: 'discard' }
          setTimeout(() => {
            cardAnimations = { ...cardAnimations, [cardId]: null }
            animatingCards = animatingCards.filter(c => c.id !== cardId)
            cardPlayStage = 'hand'
            selectedIndex = null
          }, DISCARD_DURATION)
        }, IMPACT_DURATION)
      }, SWOOSH_DURATION)
    }, REVEAL_DURATION)
  }

  function handleCast(): void {
    if (!selectedCard || !selectedPresentation || castDisabled) return

    playCardAudio('card-cast')
    cardPlayStage = 'committed'
    committedCardIndex = selectedIndex
    committedCardSnapshot = { ...selectedCard }
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
    const card = committedCard
    const cardId = card.id
    const responseTimeMs = committedAtMs > 0 ? Math.max(50, Date.now() - committedAtMs) : undefined
    const effectVal = Math.round(card.baseEffectValue * card.effectMultiplier)
    const effectLabel = (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
      ? getShortCardDescription(card)
      : `${card.cardType.toUpperCase()} ${effectVal}`
    const nextCombo = isCorrect ? (turnState?.comboCount ?? 0) + 1 : 0
    const willBePerfect = isCorrect && (turnState?.cardsCorrectThisTurn === turnState?.cardsPlayedThisTurn)
    const hitCount = card.mechanicId === 'multi_hit' ? 3 : undefined
    const quizVariantIndex = committedQuizData?.variantIndex
    const previousReviewState = getReviewStateByFactId(card.factId)
    const previousTier = previousReviewState ? getCardTier(previousReviewState) : null

    resetCardFlow()

    if (!isCorrect) {
      // Wrong answer: fizzle (unchanged)
      animatingCards = [...animatingCards, card]
      cardAnimations = { ...cardAnimations, [cardId]: 'fizzle' }
      onplaycard(cardId, false, false, responseTimeMs, quizVariantIndex, 'charge')

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
      showWowFactor(card)

      // Correct answer: new 5-phase animation sequence
      animatingCards = [...animatingCards, card]
      onplaycard(cardId, true, speedBonus, responseTimeMs, quizVariantIndex, 'charge')

      // Determine tier-up
      const nextReviewState = getReviewStateByFactId(card.factId)
      const nextTier = nextReviewState ? getCardTier(nextReviewState) : null
      const tierUpTransition = getTierUpTransition(previousTier, nextTier)
      if (tierUpTransition) {
        tierUpTransitions = { ...tierUpTransitions, [cardId]: tierUpTransition }
      }
      const tierDelay = tierUpTransition ? TIER_UP_DURATION : 0

      // Phase 1: Reveal (flip to cardback)
      cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }

      // Phase 1.5 (optional): Tier-up celebration
      if (tierUpTransition) {
        setTimeout(() => {
          cardAnimations = { ...cardAnimations, [cardId]: 'tier-up' }
        }, REVEAL_DURATION)
      }

      // Phase 2: Swoosh (type-specific effect + juice + sound)
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: 'swoosh' }

        // Play type-specific swoosh sound
        const swooshCues: Record<string, Parameters<typeof playCardAudio>[0]> = {
          attack: 'card-swoosh-attack',
          shield: 'card-swoosh-shield',
          buff: 'card-swoosh-buff',
          debuff: 'card-swoosh-debuff',
          wild: 'card-swoosh-wild',
          utility: 'card-swoosh-wild',
        }
        const swooshCue = swooshCues[card.cardType]
        if (swooshCue) playCardAudio(swooshCue)

        juiceManager.fire({
          type: 'correct',
          damage: effectVal,
          isCritical: speedBonus,
          comboCount: nextCombo,
          effectLabel: effectLabel,
          isPerfectTurn: willBePerfect,
          cardType: card.cardType,
          hitCount,
        })
      }, REVEAL_DURATION + tierDelay)

      // Phase 3: Impact (3D lunge / rise / tendrils + scene camera shake)
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: 'impact' }
        // Sync with Phaser scene for extra impact feel
        const scene = getCombatScene()
        if (scene && card.cardType === 'attack') {
          scene.cameras?.main?.shake(150, 0.006)
        }
      }, REVEAL_DURATION + tierDelay + SWOOSH_DURATION)

      // Phase 4: Discard (minimize to pile)
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: 'discard' }
        playCardAudio('card-discard')
      }, REVEAL_DURATION + tierDelay + SWOOSH_DURATION + IMPACT_DURATION)

      // Cleanup
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: null }
        tierUpTransitions = Object.fromEntries(
          Object.entries(tierUpTransitions).filter(([id]) => id !== cardId),
        ) as Record<string, TierUpTransition>
        animatingCards = animatingCards.filter(c => c.id !== cardId)
      }, REVEAL_DURATION + tierDelay + SWOOSH_DURATION + IMPACT_DURATION + DISCARD_DURATION)
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

    // Animate remaining hand cards to the discard pile before ending the turn
    const handCardEls = document.querySelectorAll('.card-in-hand:not(.card-animating)')
    if (handCardEls.length > 0) {
      const root = getComputedStyle(document.documentElement)
      const discardX = parseFloat(root.getPropertyValue('--discard-pile-x')) || 0
      const discardY = parseFloat(root.getPropertyValue('--discard-pile-y')) || 0

      handCardEls.forEach((el, i) => {
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const currentTransform = getComputedStyle(el).transform || 'none'

        const offX = discardX - cx
        const offY = discardY - cy
        el.animate([
          { transform: currentTransform, opacity: 1 },
          { transform: `translate(${offX * 0.7}px, ${offY * 0.7}px) scale(0.15)`, opacity: 0.5, offset: 0.65 },
          { transform: `translate(${offX}px, ${offY}px) scale(0.05)`, opacity: 0 },
        ], {
          duration: 250,
          delay: i * 40,
          easing: 'ease-in',
          fill: 'forwards',
        })
      })

      // Wait for animations to finish, then end the turn
      setTimeout(() => onendturn(), 250 + handCardEls.length * 40)
    } else {
      onendturn()
    }
  }

  function cancelEndTurn(): void {
    showEndTurnConfirm = false
  }

  // ---------------------------------------------------------------------------
  // AR-74: Keyboard input wiring (landscape only)
  // ---------------------------------------------------------------------------

  /** Notify keyboardInput module whenever quiz visibility changes. */
  $effect(() => {
    const quizVisible = cardPlayStage === 'committed'
    setQuizVisible(quizVisible)
  })

  let kbdUnsubscribers: Array<() => void> = []

  onMount(() => {
    // END_TURN: keyboard Enter → end turn
    kbdUnsubscribers.push(
      inputService.on('END_TURN', () => {
        if (!$isLandscape) return
        if (!endTurnDisabled && showEndTurn) {
          handleEndTurn()
        }
      })
    )

    // CANCEL: keyboard Escape → deselect card or cancel end-turn confirm
    kbdUnsubscribers.push(
      inputService.on('CANCEL', () => {
        if (!$isLandscape) return
        if (showEndTurnConfirm) {
          cancelEndTurn()
        } else if (cardPlayStage === 'selected') {
          handleDeselect()
        }
      })
    )

    // QUICK_PLAY: keyboard Q → quick-play selected card
    kbdUnsubscribers.push(
      inputService.on('QUICK_PLAY', () => {
        if (!$isLandscape) return
        if (cardPlayStage === 'selected' && selectedIndex !== null) {
          handleCastDirect(selectedIndex)
        }
      })
    )

    // CHARGE: keyboard E → charge-play selected card
    kbdUnsubscribers.push(
      inputService.on('CHARGE', () => {
        if (!$isLandscape) return
        if (cardPlayStage === 'selected' && selectedIndex !== null) {
          handleCast()
        }
      })
    )

    // SELECT_CARD: keyboard 1-5 → select card from hand
    kbdUnsubscribers.push(
      inputService.on('SELECT_CARD', (action) => {
        if (!$isLandscape) return
        if (action.type !== 'SELECT_CARD') return
        if (cardPlayStage === 'committed') return
        handleSelect(action.index)
      })
    )
  })

  onDestroy(() => {
    for (const unsub of kbdUnsubscribers) unsub()
    kbdUnsubscribers = []
    // Clear quiz visibility flag
    setQuizVisible(false)
  })

</script>

<div class="card-combat-overlay" class:near-death-tension={isNearDeath} class:layout-landscape={$isLandscape}>
  {#if turnState === null}
    <div class="empty-state">
      <p>Waiting for encounter...</p>
      {#if onreturnhub}
        <button type="button" class="return-hub-btn" onclick={onreturnhub}>Return to Hub</button>
      {/if}
    </div>
  {:else}
    <RelicTray relics={displayRelics} triggeredRelicId={turnState.triggeredRelicId} maxSlots={maxRelicSlots} onsell={sellEquippedRelic} />

    {#if expertModeActive}
      <div class="expert-badge" data-testid="expert-mode-badge">
        <span class="expert-label">
          {expertModeLabel === 'practiced' ? 'Practiced' : expertModeLabel === 'expert' ? 'Expert' : 'Mastered'}
        </span>
        <span class="expert-mult">{expertModeRewardMult}x Rewards</span>
      </div>
    {/if}

    {#if isPracticeRun && turnState}
      <div class="practice-run-banner">
        Practice Run — Camp rewards disabled
      </div>
    {/if}

    {#if turnState && enemyName}
      <div class="enemy-name-header" style="color: {categoryColor}">
        {enemyName}
      </div>
    {/if}

    <StatusEffectBar effects={enemyEffects} position="enemy" />

    <div class="ap-orb" class:ap-active={apCurrent > 0} class:ap-empty={apCurrent === 0} aria-label="Action points: {apCurrent}">
      <span class="ap-number">{apCurrent}</span>
    </div>

    <div class="pile-indicator draw-pile-indicator" bind:this={drawPileEl} aria-label="Draw pile: {drawPileCount}">
      <div class="pile-icon" style="--stack-count: {drawStackCount}">
        {#each Array(drawStackCount) as _, idx}
          <div class="pile-card-stack" style="top: calc({idx * 2}px * var(--layout-scale, 1)); left: calc({idx * 2}px * var(--layout-scale, 1));"></div>
        {/each}
      </div>
      <span class="pile-count-label">{drawPileCount}</span>
    </div>

    <div class="pile-indicator discard-pile-indicator" bind:this={discardPileEl} aria-label="Discard pile: {discardPileCount}">
      <div class="pile-icon" style="--stack-count: {discardStackCount}">
        {#each Array(Math.max(1, discardStackCount)) as _, idx}
          <div class="pile-card-stack" style="top: calc({idx * 2}px * var(--layout-scale, 1)); left: calc({idx * 2}px * var(--layout-scale, 1)); {discardStackCount === 0 ? 'opacity: 0.3;' : ''}"></div>
        {/each}
      </div>
      <span class="pile-count-label">{discardPileCount}</span>
    </div>

    {#if intentDisplay && cardPlayStage !== 'committed'}
      <button
        class="enemy-intent-bubble"
        class:intent-expanded={intentPopupOpen}
        style="background: {intentDisplay.color}; border-color: {intentDisplay.borderColor};"
        onclick={() => { intentPopupOpen = !intentPopupOpen }}
        aria-label="View intent details"
      >
        <div class="intent-bubble-summary">
          <img class="intent-icon-img" src={enemyIntent ? getIntentIconPath(enemyIntent.type) : ''} alt=""
            onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'inline'); }} />
          <span class="intent-icon-fallback" style="display:none">{enemyIntent ? INTENT_EMOJI[enemyIntent.type] ?? '❓' : '❓'}</span>
          {#if intentDisplay.text}
            <span class="intent-value" class:intent-value-attack={intentDisplay.type === 'attack' || intentDisplay.type === 'multi_attack'}
              class:intent-value-defend={intentDisplay.type === 'defend'}
              class:intent-value-heal={intentDisplay.type === 'heal'}
              class:intent-value-buff={intentDisplay.type === 'buff'}
              class:intent-value-debuff={intentDisplay.type === 'debuff'}>{intentDisplay.text}</span>
          {/if}
        </div>
        {#if intentPopupOpen}
          <div class="intent-bubble-detail">
            <p>{intentDetailText}</p>
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

    {#if showMustChargeTooltip}
      <div class="must-charge-tooltip" transition:fade={{ duration: 150 }}>
        ⚡ Must Charge!
      </div>
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

    <StatusEffectBar effects={playerEffects} position="player" />

    <div class="player-status-strip" aria-label="Player health and block">
      {#if playerShield > 0}
        <div class="player-block-badge">
          <span class="player-block-icon">🛡️</span>
          <span class="player-block-value">{playerShield}</span>
        </div>
      {/if}
      <div class="player-hp-track">
        <div
          class="player-hp-fill"
          style="width: {Math.round(playerHpRatio * 100)}%; background: {playerHpColor};"
        ></div>
        <span class="player-hp-text">{playerHpCurrent}/{playerHpMax}</span>
      </div>
    </div>

    <ComboCounter count={comboCount} multiplier={comboMultiplier} {isPerfectTurn} {chainLength} {chainType} {chainMultiplier} />

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
      onchargeplay={handleChargeDirect}
      {isSurgeActive}
      {focusDiscount}
      quizVisible={cardPlayStage === 'committed'}
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

  {#if showReshuffle}
    <div class="reshuffle-fly-zone">
      {#each Array(reshuffleCardCount) as _, i}
        <div class="reshuffle-fly-card" style="animation-delay: {i * 40}ms"></div>
      {/each}
    </div>
  {/if}

  <!-- AR-74: Keyboard help button (landscape only) -->
  {#if $isLandscape}
    <button
      class="kbd-help-trigger"
      type="button"
      onclick={() => inputService.dispatch({ type: 'TOGGLE_KEYBOARD_HELP' })}
      aria-label="Show keyboard shortcuts (?)"
      title="Keyboard shortcuts"
    >?</button>
  {/if}
</div>

<!-- AR-74: Keyboard shortcut help overlay -->
<KeyboardShortcutHelp />

<style>
  /* AR-74: Keyboard help trigger button (landscape only) */
  .kbd-help-trigger {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    z-index: 20;
    display: grid;
    place-items: center;
    transition: background 120ms, color 120ms, border-color 120ms;
  }

  .kbd-help-trigger:hover {
    background: rgba(78, 205, 196, 0.15);
    border-color: rgba(78, 205, 196, 0.4);
    color: rgba(78, 205, 196, 0.9);
  }

  .card-combat-overlay {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100vh;
    z-index: 10;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.5) 15%, transparent 50%);
    overflow: visible;
  }

  .card-combat-overlay.near-death-tension {
    filter: saturate(0.7);
    transition: filter 500ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-combat-overlay.near-death-tension {
      filter: none;
    }
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
    left: calc(16px * var(--layout-scale, 1));
    bottom: 45vh;
    z-index: 8;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
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
    position: relative;
    z-index: 2;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: calc(22px * var(--layout-scale, 1));
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 1), 0 1px 3px rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes ap-fire-rotate {
    from { transform: rotate(0deg) scale(0.97); }
    25% { transform: rotate(90deg) scale(1.03); }
    50% { transform: rotate(180deg) scale(0.97); }
    75% { transform: rotate(270deg) scale(1.03); }
    to { transform: rotate(360deg) scale(0.97); }
  }


  .enemy-intent-bubble {
    --intent-expanded-width: calc(200px * var(--layout-scale, 1));
    position: fixed;
    top: calc(calc(12px * var(--layout-scale, 1)) + var(--safe-top));
    left: calc(8px * var(--layout-scale, 1));
    z-index: 12;
    border: 2px solid;
    border-radius: 14px;
    width: calc(72px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(4px * var(--layout-scale, 1));
    font: inherit;
    color: inherit;
    outline: none;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1), padding 160ms ease;
  }

  .enemy-intent-bubble:active {
    filter: brightness(0.92);
  }

  .enemy-intent-bubble.intent-expanded {
    width: var(--intent-expanded-width);
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .intent-bubble-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
  }

  .intent-bubble-detail {
    font-size: calc(14px * var(--layout-scale, 1));
    color: #f1f5f9;
    text-align: left;
    white-space: normal;
    width: 100%;
    line-height: 1.4;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .intent-bubble-detail p {
    margin: 2px 0 0;
  }

  .intent-bubble-tail {
    position: absolute;
    top: calc(-6px * var(--layout-scale, 1));
    left: calc(8px * var(--layout-scale, 1));
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid;
    border-bottom-color: inherit;
    opacity: 0.7;
  }

  .intent-icon-img {
    width: 2em;
    height: 2em;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    vertical-align: middle;
  }

  .intent-icon-fallback {
    vertical-align: middle;
  }

  .intent-value {
    font-size: 22px;
    font-weight: 900;
    font-family: 'Georgia', serif;
    color: #e2e8f0;
    text-shadow:
      -1px -1px 0 rgba(0,0,0,0.5),
      1px -1px 0 rgba(0,0,0,0.5),
      -1px 1px 0 rgba(0,0,0,0.5),
      1px 1px 0 rgba(0,0,0,0.5);
    text-align: center;
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

  .popup-val-buff {
    color: #eab308;
  }

  .popup-val-debuff {
    color: #a855f7;
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
    top: calc(4vh + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 11;
    font-size: calc(16px * var(--layout-scale, 1));
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
    max-width: calc(220px * var(--layout-scale, 1));
    background: rgba(6, 8, 16, 0.92);
    color: #f4f7fb;
    border: 1px solid rgba(241, 196, 15, 0.5);
    border-radius: 8px;
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    line-height: 1.3;
  }

  .tip-hand {
    bottom: calc(178px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-cast {
    bottom: calc(320px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-answer {
    bottom: calc(360px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-endturn {
    bottom: calc(180px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
  }

  .tip-ap {
    top: calc(60px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
  }

  .end-turn-btn {
    position: absolute;
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(12px * var(--layout-scale, 1));
    width: auto;
    min-width: calc(110px * var(--layout-scale, 1));
    padding: 0 calc(20px * var(--layout-scale, 1));
    height: 48px;
    background: #1f2937;
    color: #f8fafc;
    border: none;
    border-radius: 10px;
    font-size: calc(14px * var(--layout-scale, 1));
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

  .player-status-strip {
    position: absolute;
    left: calc(140px * var(--layout-scale, 1));
    right: calc(10px * var(--layout-scale, 1));
    bottom: calc(calc(14px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
    z-index: 8;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .player-block-badge {
    display: inline-flex;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
    min-height: calc(26px * var(--layout-scale, 1));
    padding: 0 calc(8px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(125, 211, 252, 0.7);
    background: rgba(8, 26, 48, 0.9);
    color: #7dd3fc;
    font-weight: 800;
    font-size: calc(12px * var(--layout-scale, 1));
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  }

  .player-block-icon {
    font-size: calc(12px * var(--layout-scale, 1));
    line-height: 1;
  }

  .player-block-value {
    line-height: 1;
  }

  .player-hp-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Press Start 2P', monospace;
    font-size: calc(9px * var(--layout-scale, 1));
    color: #fff;
    letter-spacing: 0.5px;
    text-shadow:
      -1px 0 #000,
      1px 0 #000,
      0 -1px #000,
      0 1px #000;
    z-index: 1;
    pointer-events: none;
  }

  .player-hp-track {
    flex: 1;
    height: 22px;
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.7);
    background: rgba(15, 23, 42, 0.82);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    position: relative;
  }

  .player-hp-fill {
    height: 100%;
    min-width: 2px;
    border-radius: 999px;
    transition: width 160ms ease, background 160ms ease;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }

  .wow-factor-overlay {
    position: absolute;
    bottom: calc(45vh + calc(8px * var(--layout-scale, 1)));
    left: calc(12px * var(--layout-scale, 1));
    right: calc(12px * var(--layout-scale, 1));
    z-index: 12;
    text-align: center;
    font-size: calc(15px * var(--layout-scale, 1));
    font-weight: 600;
    color: #f0c860;
    background: rgba(10, 8, 20, 0.75);
    border: 1px solid rgba(240, 200, 96, 0.25);
    border-radius: 10px;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    line-height: 1.4;
    pointer-events: none;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 300ms ease, transform 300ms ease;
  }

  .wow-factor-overlay.wow-visible {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 200ms ease, transform 200ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .wow-factor-overlay {
      transform: none;
      transition: opacity 200ms ease;
    }
    .wow-factor-overlay.wow-visible {
      transform: none;
    }
  }

  .screen-edge-pulse {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(ellipse at center, transparent 75%, rgba(255, 215, 0, 0.12) 100%);
    animation: edgePulse 600ms ease-in-out;
    z-index: 5;
  }

  @keyframes edgePulse {
    0% { opacity: 0; }
    40% { opacity: 1; }
    100% { opacity: 0; }
  }

  .expert-badge {
    position: absolute;
    top: calc(calc(6px * var(--layout-scale, 1)) + var(--safe-top));
    right: calc(6px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    z-index: 50;
    pointer-events: none;
  }
  .expert-label {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 700;
    color: #facc15;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .expert-mult {
    font-size: calc(9px * var(--layout-scale, 1));
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

  .pile-indicator {
    position: absolute;
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    cursor: default;
  }

  .draw-pile-indicator {
    right: calc(12px * var(--layout-scale, 1));
    bottom: calc(68px * var(--layout-scale, 1));
  }

  .discard-pile-indicator {
    left: calc(12px * var(--layout-scale, 1));
    bottom: calc(68px * var(--layout-scale, 1));
  }

  .pile-icon {
    width: calc(36px * var(--layout-scale, 1));
    height: calc(46px * var(--layout-scale, 1));
    position: relative;
  }

  .pile-card-stack {
    position: absolute;
    width: calc(26px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    border-radius: 3px;
    background: rgba(10, 18, 30, 0.7);
  }

  .pile-card-stack:last-child {
    /* Last card in stack is the "top" — slightly more visible */
    opacity: 1;
  }

  /* Draw pile = green */
  .draw-pile-indicator .pile-card-stack {
    border: 2px solid rgba(39, 174, 96, 0.7);
  }

  /* Discard pile = orange */
  .discard-pile-indicator .pile-card-stack {
    border: 2px solid rgba(230, 126, 34, 0.7);
  }

  .pile-count-label {
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 800;
    color: #f8fafc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .reshuffle-fly-zone {
    position: absolute;
    bottom: calc(68px * var(--layout-scale, 1));
    left: 0;
    right: 0;
    height: calc(50px * var(--layout-scale, 1));
    z-index: 9;
    pointer-events: none;
    overflow: hidden;
  }

  .reshuffle-fly-card {
    position: absolute;
    left: calc(20px * var(--layout-scale, 1));
    bottom: calc(10px * var(--layout-scale, 1));
    width: calc(16px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    border-radius: 2px;
    background: rgba(230, 126, 34, 0.6);
    border: 1px solid rgba(230, 126, 34, 0.8);
    opacity: 0;
    animation: reshuffleFly 250ms ease-in-out forwards;
  }

  @keyframes reshuffleFly {
    0% {
      opacity: 0.8;
      transform: translateX(0) scale(1);
      background: rgba(230, 126, 34, 0.6);
      border-color: rgba(230, 126, 34, 0.8);
    }
    50% {
      opacity: 0.6;
      transform: translateX(calc(50vw - 40px)) translateY(calc(-10px * var(--layout-scale, 1))) scale(0.8);
    }
    100% {
      opacity: 0;
      transform: translateX(calc(100vw - 60px)) scale(0.5);
      background: rgba(39, 174, 96, 0.6);
      border-color: rgba(39, 174, 96, 0.8);
    }
  }

  .practice-run-banner {
    position: absolute;
    top: calc(calc(32px * var(--layout-scale, 1)) + var(--safe-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(100, 116, 139, 0.8);
    color: #e2e8f0;
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 600;
    border-radius: 6px;
    letter-spacing: 0.5px;
    pointer-events: none;
    white-space: nowrap;
  }

  /* V2 Echo: "Must Charge!" tooltip — shown when Quick Play is attempted on an Echo card */
  .must-charge-tooltip {
    position: fixed;
    bottom: calc(220px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(147, 51, 234, 0.92);
    color: #f5f3ff;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(196, 181, 253, 0.5);
    box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(147, 51, 234, 0.5);
    letter-spacing: 0.05em;
    pointer-events: none;
    z-index: 200;
    white-space: nowrap;
  }

  /* ══════════════════════════════════════════════════════════
     AR-73: Landscape (Option D) overlay repositioning
     Enemy panel = right 30%  |  Center stage = left 70%
     Card hand = bottom 26vh strip (rendered by CardHand)
     ══════════════════════════════════════════════════════════ */

  /* In landscape, reduce the bottom-gradient so center stage is visible */
  .layout-landscape {
    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 12%, transparent 35%);
  }

  /* Relics: top-left of center stage area — compact vertical column */
  :global(.layout-landscape .relic-tray) {
    position: fixed;
    top: 4%;
    left: 2%;
    bottom: auto;
    transform: none;
    width: auto;
    max-width: 60px;
    flex-direction: column;
    gap: 4px;
  }

  /* AP orb: left edge of hand strip, above hand area */
  .layout-landscape :global(.ap-orb),
  .layout-landscape .ap-orb {
    position: fixed;
    bottom: 28vh;
    left: 1.5%;
    right: auto;
    transform: none;
  }

  /* Enemy name: top of enemy panel (right 30%) */
  .layout-landscape .enemy-name-header {
    position: fixed;
    top: 2%;
    left: 70%;
    right: 0;
    text-align: center;
    bottom: auto;
    transform: none;
  }

  /* Intent bubble: below enemy name in right panel */
  .layout-landscape .enemy-intent-bubble {
    position: fixed;
    top: 8%;
    left: 72%;
    right: 2%;
    bottom: auto;
    transform: none;
  }

  /* Player status strip (HP bar): bottom-left above card hand */
  /* AR-91: constrain max-width so HP bar doesn't span the full viewport */
  .layout-landscape .player-status-strip {
    position: fixed;
    bottom: 27vh;
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 40%;
    max-width: 480px;
  }

  /* Pile indicators: left edge area for draw/discard */
  .layout-landscape .draw-pile-indicator {
    position: fixed;
    bottom: 27vh;
    left: 2%;
    right: auto;
    transform: none;
  }

  .layout-landscape .discard-pile-indicator {
    position: fixed;
    bottom: 27vh;
    left: 8%;
    right: auto;
    transform: none;
  }

  /* End turn button: right side above card hand, left of enemy panel */
  .layout-landscape .end-turn-btn {
    position: fixed;
    bottom: 27vh;
    right: 31%;
    left: auto;
    transform: none;
  }

  /* Combo counter: top of center stage */
  :global(.layout-landscape .combo-counter) {
    position: fixed;
    top: 3%;
    left: 50%;
    transform: translateX(-50%);
    bottom: auto;
  }

  /* Status effect bars — enemy: top of center stage */
  :global(.layout-landscape .status-effect-bar-enemy) {
    position: fixed;
    top: 2%;
    left: 70%;
    right: 1%;
    bottom: auto;
  }

  /* Status effect bars — player: directly above HP bar strip */
  :global(.layout-landscape .status-effect-bar-player) {
    position: fixed;
    bottom: calc(27vh + calc(32px * var(--layout-scale, 1)));
    left: 35%;
    right: 32%;
    top: auto;
  }

  /* Must-charge tooltip: above center of hand strip */
  .layout-landscape .must-charge-tooltip {
    bottom: 28vh;
  }
</style>
