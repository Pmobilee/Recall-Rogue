<script lang="ts">
  import { get } from 'svelte/store'
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { Card } from '../../data/card-types'
  import type { EnemyInstance, EnemyIntent } from '../../data/enemies'
  import type { TurnState } from '../../services/turnManager'
  import { isAnyCardPlayable, resolveTransmutePick } from '../../services/turnManager'
  import { BALANCE, FLOOR_TIMER, MASTERY_MAX_LEVEL, MASTERY_BASE_DISTRACTORS, MASTERY_UPGRADED_DISTRACTORS } from '../../data/balance'
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
  import { getLanguageConfig } from '../../types/vocabulary'
  import { preloadTokenizer } from '../../services/japaneseTokenizer'
  import DamageNumber from './DamageNumber.svelte'
  import ChainCounter from './ChainCounter.svelte'
  import RelicTray from './RelicTray.svelte'
  import { RELIC_BY_ID } from '../../data/relics/index'
  import { getMaxRelicSlots, resolveChargeButtonState } from '../../services/relicEffectResolver'
  import { juiceManager } from '../../services/juiceManager'
  import { getCombatScene, consumeSoulJarCharge, handlePendingChoice, enemyDamageEvent, coopWaitingForPartner, cancelEndTurnRequested, activeTurnState, endTurnInProgress } from '../../services/encounterBridge'
  import { factsDB } from '../../services/factsDB'
  import { getReviewStateByFactId, playerSave } from '../stores/playerData'
  import type { CombatScene } from '../../game/scenes/CombatScene'
  import { getCardTier } from '../../services/tierDerivation'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { ambientAudio } from '../../services/ambientAudioService'
  import { reshuffleEvent, drawHand } from '../../services/deckManager'
  import { audioManager } from '../../services/audioService'
  import { REVEAL_DURATION, SWOOSH_DURATION, IMPACT_DURATION, DISCARD_DURATION, FIZZLE_DURATION, type CardAnimPhase } from '../utils/mechanicAnimations'
  import { turboDelay } from '../../utils/turboMode'
  import { interleaveFacts } from '../../utils/interleaveFacts'
  import { shuffled } from '../../services/randomUtils'
  import { getRunRng, isRunRngActive, seededShuffled } from '../../services/seededRng'
  import { isPlaceholderDistractor } from '../../services/distractorFilter'
  import { getVocabDistractors } from '../../services/vocabDistractorService'
  import { selectVariant, buildVariantQuestion } from '../../services/vocabVariantService'
  import { activeRunState } from '../../services/runStateStore'
  import { sellEquippedRelic } from '../../services/gameFlowController'
  import { getIntentIconPath } from '../utils/iconAssets'
  import { getMasteryScalingTier, getRewardMultiplier, getDifficultyBoostFloors } from '../../services/masteryScalingService'
  import { synergyFlash } from '../stores/gameState'
  import { getNonCuratedQuestion, getQuestionVariantCount } from '../utils/combatQuestionPolicy'
  import StatusEffectBar from './StatusEffectBar.svelte'
  import EnemyPowerBadges from './EnemyPowerBadges.svelte'
  import { getEnemyPowers } from '../../data/enemyPowers'
  import { getShortCardDescription } from '../../services/cardDescriptionService'
  import SurgeBorderOverlay from './SurgeBorderOverlay.svelte'
  import { ENEMY_DIALOGUE } from '../../data/enemyDialogue'
  import { getMasteryStats, getEffectiveApCost } from '../../services/cardUpgradeService'
  import { getMechanicDefinition } from '../../data/mechanics'
  import { openRunDeckOverlay } from '../stores/runDeckOverlayStore'
  import MultiChoicePopup from './MultiChoicePopup.svelte'
  import CardPickerOverlay from './CardPickerOverlay.svelte'
  import { getCuratedDeck, getCuratedDeckFact, getCuratedDeckFacts } from '../../data/curatedDeckStore'
  import { getDeckById } from '../../data/deckRegistry'
  import { selectFactForCharge } from '../../services/curatedFactSelector'
  import { selectQuestionTemplate } from '../../services/questionTemplateSelector'
  import { selectDistractors, getDistractorCount } from '../../services/curatedDistractorSelector'
  import { getConfusionMatrix, saveConfusionMatrix } from '../../services/confusionMatrixStore'
  import { isNumericalAnswer, getNumericalDistractors, displayAnswer as displayNumericalAnswer } from '../../services/numericalDistractorService'
  import type { Fact } from '../../data/types'
  import { REGION_NAMES, rollFlagQuestionType } from '../../services/nonCombatQuizSelector'
  import { staggerPopIn } from '../utils/roomPopIn'
  import { tick } from 'svelte'
  import { computeDamagePreview, type DamagePreviewContext, type DamagePreview } from '../../services/damagePreviewService'
  import { isVulnerable, getStrengthModifier } from '../../data/statusEffects'
  import { computeIntentHpImpact, type IntentHpImpact } from '../../services/intentDisplay'
  import { quizPanelVisible } from '../stores/combatUiStore'
  import { reducedMotion } from '../stores/settings'
  import { resolveWowFactorText } from '../../services/wowFactorService'
  import {
    tutorialActive,
    tutorialEvalTrigger,
    evaluateTutorialStep,
  } from '../../services/tutorialService'
  import type { TutorialContext } from '../../data/tutorialSteps'


  interface Props {
    turnState: TurnState | null
    onplaycard: (
      cardId: string,
      correct: boolean,
      speedBonus: boolean,
      responseTimeMs?: number,
      variantIndex?: number,
      playMode?: 'charge' | 'quick',
      distractorCount?: number,
      wasQuizzed?: boolean,
      previewValue?: { qpValue: number; ccValue: number },
    ) => {
      curedCursedFact: boolean
      damageDealt?: number
      shieldApplied?: number
      healApplied?: number
      pendingChoice?: {
        cardId: string
        mechanicId: 'phase_shift' | 'unstable_flux'
        options: Array<{
          id: string
          label: string
          damageDealt?: number
          shieldApplied?: number
          extraCardsDrawn?: number
          statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>
        }>
      }
      pendingCardPick?: {
        type: string
        sourceCardId: string
        candidates: Card[]
        pickCount: number
        allowSkip: boolean
        title: string
      }
    } | void
    onskipcard: (cardId: string) => void
    onendturn: () => void
    onusehint: () => void
    onreturnhub?: () => void
    fogLevel?: number
    fogState?: 'brain_fog' | 'neutral' | 'flow_state'
    /** Show a clickable "N others" pill on the HP bar to open the roster panel (many-player modes). */
    showRosterTrigger?: boolean
    /** Number of other players in the game (shown in the pill). */
    otherPlayerCount?: number
    /** Called when the player clicks the roster trigger pill. */
    onopenroster?: () => void
  }

  type CardPlayStage = 'hand' | 'selected' | 'committed'

  interface QuizData {
    question: string
    answers: string[]
    correctAnswer: string
    variantIndex: number
    /** The ID of the fact that was displayed to the player. Used for wow-factor lookup. */
    factId?: string
    questionImageUrl?: string
    /** For synonym variant: additional correct answers accepted from the player. */
    acceptableAnswers?: string[]
    /** Language code of the source fact (e.g. 'ja'). Used for furigana rendering. */
    language?: string
    /** Pronunciation/reading string of the source fact. Used for furigana parsing. */
    pronunciation?: string
    /** Quiz presentation mode: 'text' (default), 'image_question', 'image_answers'. */
    quizMode?: 'text' | 'image_question' | 'image_answers' | 'chess_tactic'
    /** Path to the question image asset (image_question mode). */
    imageAssetPath?: string
    /** Parallel image paths for each answer choice (image_answers mode). */
    answerImagePaths?: string[]
    /** Quiz variant/template type identifier (e.g. 'reading', 'forward', 'reverse'). Used to suppress furigana on reading questions. */
    variantType?: string
    /** Rich grammar explanation shown on wrong answers for language/grammar facts. */
    grammarNote?: string
    /** Bold header extracted from the explanation (e.g. "さえ (even; only; just)"). */
    grammarPointHeader?: string
    /** Quiz response mode: 'choice' (default), 'typing' (text input), 'chess_move' (interactive board), or 'map_pin' (interactive world map). */
    quizResponseMode?: 'choice' | 'typing' | 'chess_move' | 'map_pin'
    /** Pre-baked furigana segments for Japanese grammar sentences. */
    sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>
    /** Pre-baked whole-sentence romaji for Japanese grammar sentences. */
    sentenceRomaji?: string
    /** First-class English translation for Japanese grammar sentences. */
    sentenceTranslation?: string
    /** Short grammar-point label shown as hint above typing input. */
    grammarPointLabel?: string
    /** FEN string for chess puzzle positions. */
    fenPosition?: string
    /** Solution move sequence in UCI notation. */
    solutionMoves?: string[]
    /** Lichess puzzle rating (for Elo update after chess quiz). */
    lichessRating?: number
    /** [latitude, longitude] of the target location for map_pin quiz mode. */
    mapCoordinates?: [number, number]
    /** Geographic region key for map centering. */
    mapRegion?: string
    /** Location difficulty tier 1-5 for Geo Elo calculation. */
    mapDifficultyTier?: number
  }

  let { turnState, onplaycard, onskipcard, onendturn, onusehint, onreturnhub, fogLevel, fogState, showRosterTrigger = false, otherPlayerCount = 0, onopenroster }: Props = $props()

  let cardPlayStage = $state<CardPlayStage>('hand')
  let selectedIndex = $state<number | null>(null)
  let committedCardIndex = $state<number | null>(null)
  let committedQuizData = $state<QuizData | null>(null)
  let committedAtMs = $state(0)
  // showCombatSettings removed — cogwheel moved into CardExpanded
  /** Chess hint level: 0 = no hint, 1 = from-square highlighted, 2 = from+to highlighted. */
  let chessHintLevel = $state(0)

  // V2 Echo: "Must Charge!" tooltip state — shown when Quick Play is attempted on an Echo card
  let showMustChargeTooltip = $state(false)
  let mustChargeTimer = $state<ReturnType<typeof setTimeout> | null>(null)

  // M-19: "Not enough AP" tooltip — shown briefly when player taps an unaffordable card
  let showNotEnoughAp = $state(false)
  let notEnoughApTimer = $state<ReturnType<typeof setTimeout> | null>(null)

  // AR-124: Tutorial tooltip state
  let showChargeTutorial = $state(false)
  let showComparisonBanner = $state(false)
  let activeTutorial = $derived(
    cardPlayStage === 'committed' ? null :
    showChargeTutorial ? 'charge' : showComparisonBanner ? 'comparison' : null
  )
  /** Whether the player has done a Quick Play this run (for comparison banner). */
  let hasQuickPlayed = $state(false)
  /** Whether the player has done a Charge this run (for comparison banner). */
  let hasCharged = $state(false)
  /** Tutorial tracking: has the player quick-played this session (for tutorial eval). */
  let tutorialHasPlayedQuickPlay = $state(false)
  /** Tutorial tracking: has the player charged this session (for tutorial eval). */
  let tutorialHasPlayedCharge = $state(false)
  /** Tutorial tracking: has the player answered wrong this session (for tutorial eval). */
  let tutorialHasAnsweredWrong = $state(false)
  let chargeTutorialTimer = $state<ReturnType<typeof setTimeout> | null>(null)
  let comparisonBannerTimer = $state<ReturnType<typeof setTimeout> | null>(null)

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

  let keyboardDetected = $state(false)

  $effect(() => {
    const handler = () => { keyboardDetected = true }
    window.addEventListener('keydown', handler, { once: true })
    return () => window.removeEventListener('keydown', handler)
  })

  let answeredThisTurn = $state(0)
  let damageNumbers = $state<Array<{ id: number; value: string; isCritical: boolean; type?: 'damage' | 'block' | 'heal' | 'poison' | 'burn' | 'bleed' | 'gold' | 'critical' | 'status' | 'buff'; position?: 'enemy' | 'player' }>>([])
  /** AR-222: timer handle for pending auto-end-turn (cleared if player acts first) */
  let autoEndTurnTimer: ReturnType<typeof setTimeout> | null = null
  let cardAnimations = $state<Record<string, CardAnimPhase>>({})
  let animatingCards = $state<Card[]>([])
  /** AR-113: Active mastery change popups: cardId -> 'upgrade' | 'downgrade' */
  let masteryPopups = $state<Record<string, 'upgrade' | 'downgrade'>>({})
  /** AR-113: Active mastery flash on card stat numbers: cardId -> 'up' | 'down' */
  let masteryFlashes = $state<Record<string, 'up' | 'down'>>({})
  /** AR-202: Cure flash state — cardId -> true when a cursed fact was just cured. Triggers gold glow animation. */
  let cureFlashes = $state<Record<string, boolean>>({})

  // ─── Phase Shift / Unstable Flux MultiChoicePopup state ───────────────────
  interface PendingChoicePopup {
    cardId: string
    mechanicId: 'phase_shift' | 'unstable_flux'
    /** For phase_shift QP/CW: damage and block values. For unstable_flux CC: multiplied values. */
    damageValue: number
    blockValue: number
    drawValue: number
    weaknessTurns: number
    isChargeCorrect: boolean
  }
  let pendingChoicePopup = $state<PendingChoicePopup | null>(null)

  // ─── CardPickerOverlay state ───────────────────────────────────────────────
  let pendingCardPickState = $state<{
    type: string;
    sourceCardId: string;
    candidates: Card[];
    pickCount: number;
    allowSkip: boolean;
    title: string;
    selectedCards: Card[];
  } | null>(null)

  /** Resolved options from the resolver's pendingChoice — used by handlePendingChoice after popup dismissal. */
  type PendingChoiceOption = {
    id: string
    label: string
    damageDealt?: number
    shieldApplied?: number
    extraCardsDrawn?: number
    statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>
  }
  let pendingChoiceOptions = $state<PendingChoiceOption[] | null>(null)

  interface DeferredPlayCard {
    cardId: string
    speedBonus: boolean
    responseTimeMs: number | undefined
    quizVariantIndex: number | undefined
  }
  let pendingPhaseShiftDeferred = $state<DeferredPlayCard | null>(null)
  let pendingUnstableFluxDeferred = $state<DeferredPlayCard | null>(null)
  let damageIdCounter = $state(0)
  let slowReaderEnabled = $state(false)
  let currentDifficulty = $state<DifficultyMode>('normal')

  // Near-death tension indicator
  let isNearDeath = $derived(
    turnState != null && turnState.playerState.hp > 0 && turnState.playerState.hp < turnState.playerState.maxHP * 0.25
  )

  // C-5: Sync near-death state with Phaser CombatScene for visual coordination
  $effect(() => {
    const scene = getCombatScene()
    scene?.setNearDeath?.(isNearDeath)
  })

  /** Whether the combat overlay is currently doing a damage-shake (CSS class). */
  let isDamageShaking = $state(false)
  let _damageShakeTimer: ReturnType<typeof setTimeout> | null = null

  /** Trigger a brief 50ms CSS shake when player takes damage below 40% HP.
   *  Called from the enemy damage event handler when isLowHp is true.
   */
  function triggerDamageShake(): void {
    if ($reducedMotion) return
    if (isDamageShaking) return
    isDamageShaking = true
    if (_damageShakeTimer) clearTimeout(_damageShakeTimer)
    _damageShakeTimer = setTimeout(() => {
      isDamageShaking = false
      _damageShakeTimer = null
    }, 150)
  }

  // wowFactor overlay state
  let wowFactorText = $state<string | null>(null)
  let wowFactorVisible = $state(false)
  let wowFactorCount = $state(0)
  const WOW_FACTOR_MAX_PER_ENCOUNTER = 3

  // Turn transition banner state
  let turnBannerText = $state<string | null>(null)
  let turnBannerVisible = $state(false)
  let _turnBannerTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const phase = turnState?.phase
    const turnNum = turnState?.turnNumber ?? 0
    if (phase === 'player_action') {
      // Skip the very first player action — it's obvious it's your turn
      if (turnNum <= 1) return
      if (_turnBannerTimer) clearTimeout(_turnBannerTimer)
      turnBannerText = 'YOUR TURN'
      turnBannerVisible = true
      _turnBannerTimer = setTimeout(() => {
        turnBannerVisible = false
        _turnBannerTimer = setTimeout(() => { turnBannerText = null }, 200)
      }, 800)
    } else if (phase === 'enemy_turn') {
      if (_turnBannerTimer) clearTimeout(_turnBannerTimer)
      turnBannerText = 'ENEMY TURN'
      turnBannerVisible = true
      _turnBannerTimer = setTimeout(() => {
        turnBannerVisible = false
        _turnBannerTimer = setTimeout(() => { turnBannerText = null }, 200)
      }, 800)
    }
  })

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
      const totalDuration = reshuffleCardCount * turboDelay(40) + turboDelay(300)
      for (let i = 0; i < reshuffleCardCount; i++) {
        setTimeout(() => audioManager.playSound('card_shuffle'), i * turboDelay(40))
      }
      setTimeout(() => {
        showReshuffle = false
        reshuffleHoldingHand = false  // release hand — cards will mount and swoosh from draw pile
      }, totalDuration)
    }
  })

  // === Combat entry pop-in animation ===
  let combatOverlayEl = $state<HTMLElement>(null!)
  let combatEntryDelayCards = $state(false)
  let lastPopInEncounterId = $state<string | null>(null)

  // Listen for encounter entry signal from CombatScene
  $effect(() => {
    function onCombatEntry() {
      // Only pop-in once per encounter (debounce by encounter ID)
      const encId = turnState?.enemy?.template?.id ?? null
      const turnNum = turnState?.turnNumber ?? 0
      if (encId && turnNum <= 1 && encId !== lastPopInEncounterId) {
        lastPopInEncounterId = encId
        combatEntryDelayCards = true  // hold cards hidden
        tick().then(() => {
          if (!combatOverlayEl) return
          staggerPopIn({
            container: combatOverlayEl,
            elements: [
              '.enemy-name-header',
              '.ap-orb',
              '.draw-pile-indicator',
              '.discard-pile-indicator',
              '.player-status-strip',
              '.enemy-intent-bubble',
            ],
            totalDuration: 1500,
            onComplete: () => {
              // After HUD pops in, release card hand — triggers swoosh from draw pile
              combatEntryDelayCards = false
            },
          })
        })
      }
    }
    window.addEventListener('rr:combat-entry', onCombatEntry)
    return () => window.removeEventListener('rr:combat-entry', onCombatEntry)
  })

  let handCards = $derived<Card[]>(reshuffleHoldingHand || combatEntryDelayCards ? [] : (turnState?.deck.hand ?? []))
  /** True when the player still has at least one card in hand — used to gate co-op cancel. */
  let handHasCards = $derived(handCards.length > 0)

  let isPerfectTurn = $derived(turnState?.isPerfectTurn ?? false)
  let chainLength = $derived(turnState?.chainLength ?? 0)
  let chainType = $derived(turnState?.chainType ?? null)
  let chainMultiplier = $derived(turnState?.chainMultiplier ?? 1.0)
  let activeChainColor = $derived(turnState?.activeChainColor ?? null)
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
  let forgetPileCount = $derived(turnState?.deck.forgetPile.length ?? 0)

/** Number of visual card stacks to show (1-5 based on pile size). */
  let drawStackCount = $derived(Math.max(1, Math.min(5, Math.ceil(drawPileCount / 3))))
  let discardStackCount = $derived(Math.max(0, Math.min(5, Math.ceil(discardPileCount / 3))))


  const run = $derived($activeRunState)
  const maxRelicSlots = $derived(run ? getMaxRelicSlots(run.runRelics) : 5)
  /** Soul Jar GUARANTEED button: show when soul_jar relic held and charges > 0. */
  const showGuaranteed = $derived(
    run && turnState
      ? resolveChargeButtonState(turnState.activeRelicIds, run.soulJarCharges ?? 0).showGuaranteed
      : false
  )
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

  let damagePreviews = $derived.by(() => {
    if (!turnState) return {} as Record<string, DamagePreview>;

    const enemy = turnState.enemy;
    const ps = turnState.playerState;

    const poisonStacks = (enemy.statusEffects ?? [])
      .filter(s => s.type === 'poison')
      .reduce((sum, s) => sum + (s.value ?? 0), 0);
    const burnStacks = (enemy.statusEffects ?? [])
      .filter(s => s.type === 'burn')
      .reduce((sum, s) => sum + (s.value ?? 0), 0);
    const furyBonus = (turnState.activeInscriptions ?? [])
      .filter(i => i.mechanicId === 'inscription_fury')
      .reduce((sum, i) => sum + i.effectValue, 0);

    const ctx: DamagePreviewContext = {
      activeRelicIds: turnState.activeRelicIds,
      buffNextCard: turnState.buffNextCard,
      overclockReady: turnState.overclockReady,
      doubleStrikeReady: turnState.doubleStrikeReady,
      firstAttackUsed: turnState.firstAttackUsed,
      playerHpPercent: ps.maxHP > 0 ? ps.hp / ps.maxHP : 1,
      enemyHpPercent: enemy.maxHP > 0 ? enemy.currentHP / enemy.maxHP : 1,
      enemyPoisonStacks: poisonStacks,
      enemyBurnStacks: burnStacks,
      enemyIsVulnerable: isVulnerable(enemy.statusEffects ?? []),
      enemyQpDamageMultiplier: enemy._quickPlayDamageMultiplierOverride ?? enemy.template.quickPlayDamageMultiplier,
      enemyQuickPlayImmune: !!enemy.template.quickPlayImmune,
      enemyChargeResistant: !!enemy.template.chargeResistant,
      enemyHardcover: enemy._hardcover ?? 0,
      enemyHardcoverBroken: !!enemy._hardcoverBroken,
      inscriptionFuryBonus: furyBonus,
      cardsPlayedThisTurn: turnState.cardsPlayedThisTurn,
      encounterTurnNumber: turnState.encounterTurnNumber,
      scarTissueStacks: turnState.scarTissueStacks ?? 0,
      playerStrengthModifier: getStrengthModifier(ps.statusEffects),
      chainMultiplier: turnState.chainMultiplier ?? 1.0,
      enemyChainVulnerable: !!enemy.template.chainVulnerable,
    };

    const result: Record<string, DamagePreview> = {};
    for (const card of handCards) {
      result[card.id] = computeDamagePreview(card, ctx);
    }
    return result;
  });

  let enemyIntent = $derived(turnState?.enemy.nextIntent ?? null)
  /**
   * When the enemy has a buffFollowUpIntent set (by game-logic), this derived
   * captures it so the intent bubble can show a combined buff+attack display.
   */
  let followUpIntent = $derived(turnState?.enemy?.buffFollowUpIntent ?? null)
  let enemyName = $derived(turnState?.enemy.template.name ?? '')
  let enemyCategory = $derived(turnState?.enemy.template.category ?? 'common')
  let currentFloor = $derived(turnState?.deck.currentFloor ?? 0)
  /** Act number derived from floor: floors 1-6 = Act 1, 7-12 = Act 2, 13+ = Act 3. */
  let currentAct = $derived(currentFloor <= 6 ? 1 : currentFloor <= 12 ? 2 : 3)
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
      // AR-263: Virtual effects from enemy instance flags
      if (turnState.enemy?._stunNextTurn) {
        effects.push({ type: 'stunned', value: 1, turnsRemaining: 1 })
      }
      if ((turnState.enemy?._hardcover ?? 0) > 0 && !turnState.enemy?._hardcoverBroken) {
        effects.push({ type: 'hardcover', value: turnState.enemy._hardcover!, turnsRemaining: 999 })
      }
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
      // AR-268: Locked card indicator
      const lockedCards = turnState.deck?.hand?.filter((c: any) => c.isLocked) ?? []
      if (lockedCards.length > 0) {
        effects.push({ type: 'locked', value: lockedCards.length, turnsRemaining: 999 })
      }

      return effects.filter(e => e.turnsRemaining > 0)
    })()
  )

  // Intent bubble is static — no click-cycle state needed (removed 2026-04-08 HUD fix)

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
    heal: 'rgba(56, 189, 248, 0.25)',
  }

  const INTENT_BORDER_COLORS: Record<string, string> = {
    attack: 'rgba(231, 76, 60, 0.6)',
    multi_attack: 'rgba(192, 57, 43, 0.7)',
    defend: 'rgba(52, 152, 219, 0.6)',
    buff: 'rgba(241, 196, 15, 0.6)',
    debuff: 'rgba(155, 89, 182, 0.6)',
    heal: 'rgba(56, 189, 248, 0.6)',
  }

  const INTENT_LABELS: Record<string, string> = {
    attack: 'Attack',
    multi_attack: 'Multi-hit',
    defend: 'Defend',
    buff: 'Buff',
    debuff: 'Debuff',
    heal: 'Heal',
  }

  /**
   * Compute the HP impact of an enemy attack intent against the player's current block.
   *
   * Bug 2 fix: block does NOT decay before the enemy attacks. In endPlayerTurn(), the order is:
   *   4. executeEnemyIntent() — enemy attacks
   *   5. takeDamage(playerState) — uses the player's FULL current block
   *   ...
   *  10. resetTurnState(playerState, act) — block decays HERE, after the attack
   *
   * The previous implementation incorrectly applied act-aware block decay before comparing
   * block to raw damage. This caused the preview to show more HP damage than would actually
   * be taken (e.g. player with 5 block facing 11 damage would see "7 HP" instead of "6 HP").
   *
   * Bug 3 fix: when enemy.lockedDisplayDamage is set, use it as the raw value instead of
   * re-deriving via computeIntentDisplayDamage(). lockedDisplayDamage is pinned at intent-roll
   * time (start of player turn) by turnManager.ts, so it does NOT drift as the player stacks
   * block mid-turn. For multi_attack, lockedDisplayDamage holds the TOTAL (Bug 1 fix).
   * Falls back to computeIntentHpImpact() for pre-fix saves (lockedDisplayDamage === undefined).
   */
  function displayImpact(intent: EnemyIntent, enemy: EnemyInstance | null): IntentHpImpact {
    const playerBlock = turnState?.playerState?.shield ?? 0
    if (!enemy) {
      // Fallback: no enemy context — show raw intent value as hpDamage
      return { raw: intent.value, postDecayBlock: playerBlock, hpDamage: intent.value }
    }
    // Bug 3 fix: read the pinned raw value locked by turnManager at intent-roll time.
    // This prevents the displayed damage from drifting as the player builds block mid-turn.
    // For multi_attack this value is TOTAL damage (Bug 1 fix in computeIntentDisplayDamage).
    if (enemy.lockedDisplayDamage !== undefined) {
      const raw = enemy.lockedDisplayDamage
      // Bug 2 fix: use the full current block — block does not decay before the enemy attacks.
      const hpDamage = Math.max(0, raw - playerBlock)
      return { raw, postDecayBlock: playerBlock, hpDamage }
    }
    // Backward compat: pre-fix saves where lockedDisplayDamage was never set.
    return computeIntentHpImpact(intent, enemy, playerBlock, currentAct, turnState ?? undefined)
  }

  let intentDisplay = $derived.by(() => {
    if (!enemyIntent) return null
    const icon = INTENT_EMOJI[enemyIntent.type] ?? '❓'
    const val = enemyIntent.value
    const label = INTENT_LABELS[enemyIntent.type] ?? ''

    // When a buffFollowUpIntent is present, the enemy will buff then attack.
    // Override colors/label/telegraph to reflect the attack (primary threat).
    const enemy = turnState?.enemy ?? null
    const hasFollowUp = followUpIntent !== null
    const displayType = hasFollowUp ? (followUpIntent.type as string) : enemyIntent.type
    const color = INTENT_COLORS[displayType] ?? INTENT_COLORS[enemyIntent.type] ?? 'rgba(100, 116, 139, 0.2)'
    const borderColor = INTENT_BORDER_COLORS[displayType] ?? INTENT_BORDER_COLORS[enemyIntent.type] ?? 'rgba(100, 116, 139, 0.4)'
    const telegraph = hasFollowUp
      ? (followUpIntent.telegraph ?? followUpIntent.type ?? '')
      : (enemyIntent.telegraph ?? '')

    if (hasFollowUp) {
      // Combined buff+attack: show the follow-up attack as primary, buff as prefix line.
      // Damage uses lockedFollowUpDisplayDamage (pinned at intent-roll time) when available.
      const rawFollowUp = enemy?.lockedFollowUpDisplayDamage ?? followUpIntent.value ?? 0
      const followUpLabel = INTENT_LABELS[followUpIntent.type] ?? followUpIntent.type ?? 'Attack'
      const followUpHits = followUpIntent.hitCount ?? 1
      let displayText: string
      if (followUpIntent.type === 'multi_attack' && followUpHits > 1) {
        const followUpPerHit = enemy?.lockedFollowUpDisplayDamagePerHit ?? Math.round(rawFollowUp / followUpHits)
        displayText = `${followUpHits}×${followUpPerHit}`
      } else {
        displayText = `${rawFollowUp}`
      }
      return { icon, text: displayText, type: displayType, label: followUpLabel, color, borderColor, telegraph, fullyBlocked: false }
    }

    if (enemyIntent.type === 'multi_attack') {
      const impact = displayImpact(enemyIntent, enemy)
      const hits = enemyIntent.hitCount ?? 2
      const perHit = enemy?.lockedDisplayDamagePerHit ?? Math.round(impact.raw / hits)
      const fullyBlocked = impact.raw > 0 && impact.hpDamage === 0
      // Show hits×perHit format (pre-block raw damage) so the player can see how many hits land.
      return { icon, text: `${hits}×${perHit}`, type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked }
    }
    if (enemyIntent.type === 'attack') {
      const impact = displayImpact(enemyIntent, enemy)
      const fullyBlocked = impact.raw > 0 && impact.hpDamage === 0
      return { icon, text: `${impact.hpDamage}`, type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked }
    }
    if (enemyIntent.type === 'defend') {
      return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked: false }
    }
    if (enemyIntent.type === 'buff') {
      const stacks = enemyIntent.statusEffect?.value ?? enemyIntent.value
      const turns = enemyIntent.statusEffect?.turns
      const compactText = turns ? `${stacks}×${turns}` : `${stacks}`
      return { icon, text: compactText, type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked: false }
    }
    if (enemyIntent.type === 'debuff') {
      const stacks = enemyIntent.statusEffect?.value ?? enemyIntent.value
      const turns = enemyIntent.statusEffect?.turns
      const compactText = turns ? `${stacks}×${turns}` : `${stacks}`
      return { icon, text: compactText, type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked: false }
    }
    return { icon, text: val > 0 ? `${val}` : '', type: enemyIntent.type, label, color, borderColor, telegraph, fullyBlocked: false }
  })

  /** Second line of the static intent bubble (bottom line). */
  let intentDetailText = $derived.by(() => {
    if (!enemyIntent) return 'Preparing...'
    const val = enemyIntent.value

    // Combined buff+attack: show a single summary describing both actions.
    if (followUpIntent !== null) {
      const buffSe = enemyIntent.statusEffect
      const buffDesc = buffSe ? `${buffSe.type}` : 'self'
      const rawFollowUp = turnState?.enemy?.lockedFollowUpDisplayDamage ?? followUpIntent.value ?? 0
      const followUpHits = followUpIntent.hitCount ?? 1
      if (followUpHits > 1) {
        const followUpPerHit = turnState?.enemy?.lockedFollowUpDisplayDamagePerHit ?? Math.round(rawFollowUp / followUpHits)
        return `Buffs ${buffDesc}, then ${followUpHits}×${followUpPerHit} = ${rawFollowUp} damage`
      }
      return `Buffs ${buffDesc}, then attacks for ${rawFollowUp} damage`
    }

    switch (enemyIntent.type) {
      case 'attack': {
        const impact = displayImpact(enemyIntent, turnState?.enemy ?? null)
        if (impact.hpDamage === 0 && impact.raw > 0) {
          return `Fully blocked (${impact.raw} absorbed)`
        }
        if (impact.postDecayBlock > 0 && impact.raw !== impact.hpDamage) {
          return `${impact.hpDamage} HP damage (${impact.raw} − ${impact.postDecayBlock} block)`
        }
        return `Attacking for ${impact.hpDamage} HP damage`
      }
      case 'multi_attack': {
        const hits = enemyIntent.hitCount ?? 2
        const impact = displayImpact(enemyIntent, turnState?.enemy ?? null)
        const perHit = turnState?.enemy?.lockedDisplayDamagePerHit ?? Math.round(impact.raw / hits)
        if (impact.hpDamage === 0 && impact.raw > 0) {
          return `Fully blocked (${hits}×${perHit} = ${impact.raw} absorbed)`
        }
        if (impact.postDecayBlock > 0 && impact.raw !== impact.hpDamage) {
          return `${hits}×${perHit} = ${impact.raw} − ${impact.postDecayBlock} block = ${impact.hpDamage} HP`
        }
        return `${hits}×${perHit} = ${impact.raw} HP damage`
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
        if (se.type === 'weakness') return `Applies Drawing Blanks for ${se.turns} turns`
        if (se.type === 'vulnerable') return `Applies Exposed for ${se.turns} turns`
        if (se.type === 'poison') return `Applies ${se.value} Doubt`
        if (se.type === 'strip_block') return `Strips ${se.value} Block`
        return `Applies ${se.value} ${se.type} for ${se.turns} turns`
      }
      default:
        return 'Preparing...'
    }
  })


  /** Cancel co-op turn-end wait — routes through encounterBridge guard. */
  function handleCoopCancel(): void {
    const result = cancelEndTurnRequested()
    // 'cancelled' → store clears automatically via encounterBridge finally block
    // 'empty_hand' → should not fire (button hidden when hand empty), but guard log
    if (result === 'empty_hand') console.warn('[end-turn] cancel attempted with empty hand')
  }

  let selectedCard = $derived<Card | null>(
    selectedIndex !== null && handCards[selectedIndex] ? handCards[selectedIndex] : null,
  )

  let committedCardSnapshot = $state<Card | null>(null)
  let committedCard = $derived<Card | null>(committedCardSnapshot)

  /** Language code from the committed quiz, or null if none. */
  const committedQuizLanguage = $derived(committedQuizData?.language ?? null)
  /** Whether the committed quiz language has configurable display options (furigana etc). */
  const committedQuizHasLanguageOptions = $derived(
    committedQuizLanguage
      ? (getLanguageConfig(committedQuizLanguage)?.options?.length ?? 0) > 0
      : false
  )

  // Preload the Japanese tokenizer as soon as we know a Japanese quiz is being played.
  // This fires in the background so the dictionary is ready before the first hover.
  $effect(() => {
    if (committedQuizLanguage === 'ja') {
      preloadTokenizer()
    }
  })

  /**
   * Deck display name for the card header (e.g. "Japanese → N3 Vocabulary").
   * Only set in study mode; falls back to domain name for other modes.
   */
  const deckDisplayName = $derived.by(() => {
    const runState = $activeRunState
    if (!runState?.deckMode) return undefined
    if (runState.deckMode.type === 'study') {
      const deckId = runState.deckMode.deckId
      const deck = getDeckById(deckId)
      if (deck) return deck.name
      // Fallback: humanize the ID
      return deckId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    }
    return undefined
  })

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

  /** AR-95: True only when the quiz panel is actually showing (Charge play with quiz data).
   *  Distinct from cardPlayStage === 'committed' which is also briefly true during Quick Play
   *  animations (no quiz shown). Used to dim the card hand correctly. */
  let isQuizPanelVisible = $derived(
    cardPlayStage === 'committed' && committedQuizData !== null && committedCard !== null,
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
      cardPlayStage === 'committed' ||
      $endTurnInProgress,
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


    // Chess puzzles need extra time for board reading + tactical analysis
    if (committedQuizData.quizResponseMode === 'chess_move') {
      timer = Math.round(timer * BALANCE.CHESS_TIMER_MULTIPLIER)
    }

    return Math.max(2, timer)
  })

  let timerColorVariant = $derived<'default' | 'gold' | 'slowReader'>(
    committedCard?.isMasteryTrial
      ? 'gold'
      : slowReaderEnabled
        ? 'slowReader'
        : 'default',
  )

  /** Focus AP discount: 1 when Focus is active with charges, 0 otherwise. */
  let focusDiscount = $derived(
    (turnState?.focusReady && (turnState?.focusCharges ?? 0) > 0) ? 1 : 0
  )

  let castDisabled = $derived(
    !selectedCard || !turnState || Math.max(0, getEffectiveApCost(selectedCard) - focusDiscount) > turnState.apCurrent,
  )

  /** True on Surge turns — Charge Play costs +0 AP instead of +1. */
  let isSurgeActive = $derived(isSurgeTurn(turnState?.turnNumber ?? 1))

  /** AR-122: Chain Momentum — next Charge of matching chain type costs +0 AP (color-specific). */
  let chargeMomentumChainType = $derived(turnState?.nextChargeFreeForChainType ?? null)

  let playerHpCurrent = $derived(turnState?.playerState.hp ?? 0)
  let playerHpMax = $derived(turnState?.playerState.maxHP ?? 1)
  let playerShield = $derived(turnState?.playerState.shield ?? 0)
  let playerHpRatio = $derived(playerHpMax > 0 ? Math.max(0, Math.min(1, playerHpCurrent / playerHpMax)) : 0)

  // MEDIUM-12 (2026-04-10): Low-HP visual signals — must be after playerHpRatio
  // ≤40% HP = vignette visible; ≤25% HP = critical pulse
  let isLowHp = $derived(turnState != null && playerHpRatio > 0 && playerHpRatio <= 0.40)
  let isCriticalHp = $derived(turnState != null && playerHpRatio > 0 && playerHpRatio <= 0.25)
  let playerHpColor = $derived(
    playerShield > 0 ? '#3498db' :
    playerHpRatio >= 0.6 ? '#22c55e' :
    playerHpRatio >= 0.3 ? '#f59e0b' :
    '#ef4444'
  )
  let isHpCritical = $derived(playerHpRatio <= 0.15 && playerHpRatio > 0)

  let onboardingTip = $derived.by(() => {
    if ($tutorialActive) return null
    const state = get(onboardingState)
    if (state.hasCompletedOnboarding) return null

    if (cardPlayStage === 'hand' && !state.hasSeenCardTapTooltip) {
      return 'Click a card to examine it'
    }

    if (cardPlayStage === 'selected' && !state.hasSeenCastTooltip) {
      return 'Click the card again to cast it'
    }

    if (cardPlayStage === 'committed') {
      // Don't show tooltip during quiz — it overlaps answer buttons
      return null
    }

    if (answeredThisTurn > 0 && !state.hasSeenEndTurnTooltip) {
      return 'Tap End Turn when done'
    }


    return null
  })

  let onboardingTipClass = $derived.by(() => {
    if (!onboardingTip) return ''
    if (cardPlayStage === 'selected') return 'tip-cast'
    if (cardPlayStage === 'committed') return 'tip-answer'
    if (answeredThisTurn > 0) return 'tip-endturn'
    return 'tip-hand'
  })

  /**
   * Display the wow-factor text for the fact that was actually answered in the quiz.
   * @param answeredFactId - The ID of the fact shown in the quiz (may differ from card.factId in study mode).
   * @param card - The card being played (used for tier check and deck-mode resolution).
   */
  function showWowFactor(answeredFactId: string, card: Card): void {
    if (wowFactorCount >= WOW_FACTOR_MAX_PER_ENCOUNTER) return
    // Chess puzzles have no wowFactor text — skip to avoid empty popups.
    if (committedQuizData?.quizResponseMode === 'chess_move') return

    // Delegate lookup to wowFactorService (pure, testable).
    // resolveWowFactorText also checks card.tier — no need to duplicate here.
    const runState = $activeRunState
    const wowText = resolveWowFactorText(answeredFactId, card.tier, runState ?? null)

    if (!wowText) return

    wowFactorCount++
    wowFactorText = wowText
    wowFactorVisible = true

    // fade in 200ms (CSS), hold 10s, fade out 300ms (CSS), cleanup
    setTimeout(() => {
      wowFactorVisible = false
    }, turboDelay(10200)) // 200ms fade-in + 10000ms hold
    setTimeout(() => {
      wowFactorText = null
    }, turboDelay(10500)) // + 300ms fade-out
  }

  function removeDamageNumber(id: number): void {
    damageNumbers = damageNumbers.filter((entry) => entry.id !== id)
  }

  function spawnDamageNumber(
    value: string,
    isCritical: boolean,
    type: 'damage' | 'block' | 'heal' | 'poison' | 'burn' | 'bleed' | 'gold' | 'critical' | 'status' | 'buff' = 'damage',
    position: 'enemy' | 'player' = 'enemy',
  ): void {
    const id = damageIdCounter++
    damageNumbers = [...damageNumbers, { id, value, isCritical, type, position }]
  }

  /** Human-readable labels for status effect types shown in floating text. */
  const STATUS_LABELS: Record<string, string> = {
    poison:                  'Doubt',
    burn:                    'Brain Burn',
    bleed:                   'L.Doubt',
    weakness:                'Blanks',
    vulnerable:              'Exposed',
    strength:                'Clarity',
    regen:                   'Recall',
    immunity:                'Shielded',
    charge_damage_amp_flat:  'Insight+',
    charge_damage_amp_percent: 'Epiphany%',
  }

  /**
   * Snapshot current status effects for a target as a value map (type -> stacks).
   * Used to diff before/after a card play to detect newly applied effects.
   */
  function snapshotEffects(effects: Array<{ type: string; value: number; turnsRemaining: number }>): Map<string, number> {
    const map = new Map<string, number>()
    for (const e of effects) {
      if (e.turnsRemaining > 0) map.set(e.type, e.value)
    }
    return map
  }

  /**
   * After a card is played, diff enemy and player status effects against pre-play snapshots
   * and spawn floating text for any newly applied or increased status effects.
   *
   * @param preEnemy  - Snapshot of enemy status effects before the card play.
   * @param prePlayer - Snapshot of player status effects before the card play.
   */
  function spawnStatusFloaters(
    preEnemy: Map<string, number>,
    prePlayer: Map<string, number>,
  ): void {
    if (!turnState) return

    // Check enemy effects (debuffs applied to enemy → show on enemy side, green)
    const postEnemy = snapshotEffects(turnState.enemy?.statusEffects ?? [])
    for (const [type, newVal] of postEnemy) {
      const oldVal = preEnemy.get(type) ?? 0
      const delta = newVal - oldVal
      if (delta > 0) {
        const label = STATUS_LABELS[type] ?? type
        spawnDamageNumber(`+${delta} ${label}`, false, 'status', 'enemy')
      }
    }

    // Check player effects (buffs applied to player → show on player side, blue)
    const postPlayer = snapshotEffects(turnState.playerState?.statusEffects ?? [])
    for (const [type, newVal] of postPlayer) {
      const oldVal = prePlayer.get(type) ?? 0
      const delta = newVal - oldVal
      if (delta > 0) {
        const label = STATUS_LABELS[type] ?? type
        spawnDamageNumber(`+${delta} ${label}`, false, 'buff', 'player')
      }
    }
  }

  /**
   * AR-222: Auto-end turn if no card can be played and no quiz is active.
   * Waits 300ms to allow the player to react (e.g. see the state before it changes).
   */
  function checkAutoEndTurn(): void {
    if (cardPlayStage === 'committed') return
    if (!turnState || !isAnyCardPlayable(turnState)) {
      if (autoEndTurnTimer !== null) clearTimeout(autoEndTurnTimer)
      autoEndTurnTimer = setTimeout(() => {
        autoEndTurnTimer = null
        // Re-check conditions synchronously at fire time — state may have changed
        if (cardPlayStage !== 'committed' && turnState && !isAnyCardPlayable(turnState)) {
          onendturn()
        }
      }, turboDelay(300))
    }
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
      onDamageNumber: (value, isCritical) => {
        // cardType was always undefined at runtime — juiceManager.ts never passes it.
        // Dead branches for 'shield'/'heal' removed in typecheck fix 2026-04-20.
        spawnDamageNumber(value, isCritical, 'damage', 'enemy')
      },
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
      onSpeedBonusPop: () => {
        const scene = getCombatScene()
        scene?.playSpeedBonusPop()
      },
    })
    return () => juiceManager.clearCallbacks()
  })

  // Subscribe to enemy turn damage/block events and spawn UI numbers
  $effect(() => {
    const unsub = enemyDamageEvent.subscribe((evt) => {
      if (!evt) return
      if (evt.damageDealt > 0) {
        spawnDamageNumber(String(evt.damageDealt), false, 'damage', 'player')
      }
      if (evt.blockGained > 0) {
        spawnDamageNumber(String(evt.blockGained), false, 'block', 'enemy')
      }
    })
    return unsub
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

  /**
   * Study mode quiz: loads a fact from the curated deck then builds the matching question + distractor set.
   *
   * @param useReverse - When true and the fact supports it, flip image_question → image_answers
   *                     (show country name, pick flag image) instead of the default direction.
   */
  function getStudyModeQuiz(card: Card, runState: NonNullable<typeof $activeRunState>, useReverse = false): QuizData {
    const deckMode = runState.deckMode
    if (!deckMode || (deckMode.type !== 'study' && deckMode.type !== 'custom_deck')) {
      return { question: 'Error: not in study mode', answers: ['OK'], correctAnswer: 'OK', variantIndex: 0 }
    }

    const tracker = runState.inRunFactTracker!

    // Resolve fact pool and per-fact deck resolver based on mode
    let factPool: ReturnType<typeof getCuratedDeckFacts>
    let resolveDeckForFact: (factId: string) => ReturnType<typeof getCuratedDeck>

    if (deckMode.type === 'custom_deck') {
      // Multi-deck: merge facts from all items; use factSourceDeckMap for per-fact deck resolution
      factPool = interleaveFacts(
        deckMode.items.map(item => getCuratedDeckFacts(item.deckId, item.subDeckId, item.examTags))
      )
      resolveDeckForFact = (factId: string) => {
        const sourceDeckId = runState.factSourceDeckMap?.[factId]
        return sourceDeckId ? getCuratedDeck(sourceDeckId) : undefined
      }
    } else {
      // Single study deck (existing behavior)
      const deck = getCuratedDeck(deckMode.deckId)
      if (!deck) {
        return { question: 'Error: deck not loaded', answers: ['OK'], correctAnswer: 'OK', variantIndex: 0 }
      }
      factPool = getCuratedDeckFacts(deckMode.deckId, deckMode.subDeckId, deckMode.examTags)
      resolveDeckForFact = () => deck
    }

    if (factPool.length === 0) {
      return { question: 'Error: empty deck', answers: ['OK'], correctAnswer: 'OK', variantIndex: 0 }
    }

    // 1. Select a fact dynamically
    const cardMastery = card.masteryLevel ?? 0
    const { fact } = selectFactForCharge(factPool, tracker, cardMastery, runState.runSeed, turnState?.turnNumber)

    // 2. Select a question template
    const recentTemplates = tracker.getRecentTemplateIds()
    const resolvedDeck = resolveDeckForFact(fact.id)
    const templateResult = selectQuestionTemplate(fact, resolvedDeck!, cardMastery, recentTemplates, runState.runSeed)
    tracker.recordTemplateUsed(templateResult.template.id)

    // 3. Select distractors from the answer type pool
    // AR-273: Meditation Chamber reduces distractor count by 1 for the meditated theme.
    const distractorCount = getDistractorCount(cardMastery, runState.meditatedThemeId, fact.chainThemeId)
    const pool = resolvedDeck?.answerTypePools.find(p => p.id === templateResult.answerPoolId)

    let distractorAnswers: string[]
    let distractorMap: Record<string, string> = {}

    // Bracket-answer facts (e.g. "{8}" or "About {8} minutes") use runtime
    // numerical distractor generation instead of the pool-based selector.
    if (isNumericalAnswer(fact.correctAnswer)) {
      const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as Fact
      distractorAnswers = getNumericalDistractors(factAdapter, distractorCount)
      // distractorMap stays empty — numerical distractors have no deck fact IDs
    } else if (pool && resolvedDeck) {
      const confusionMatrix = getConfusionMatrix()
      const { distractors } = selectDistractors(
        fact, pool, resolvedDeck.facts, resolvedDeck.synonymGroups,
        confusionMatrix, tracker, distractorCount, cardMastery,
        templateResult.distractorAnswerField,
      )
      distractorAnswers = distractors.map(d => d.correctAnswer)
      // Build a reverse map: answer text (lowercased) → distractor fact ID
      // Used in handleAnswer to identify which fact the player confused the target with
      for (const d of distractors) {
        distractorMap[d.correctAnswer.toLowerCase()] = d.id
      }
    } else {
      // Fallback to pre-generated distractors (no fact IDs available)
      distractorAnswers = fact.distractors.slice(0, distractorCount)
    }

    // Strip brace markers from correct answer for display
    // Declared as let so continent/not_elimination modes can override it.
    let correctAnswerDisplay = displayNumericalAnswer(templateResult.correctAnswer)

    // Reading template: distractors must be hiragana readings, not English translations.
    // Pool-based selectDistractors returns correctAnswer (English) values — replace them here.
    if (templateResult.template.id === 'reading') {
      const otherReadings = factPool
        .filter(f => f.reading && f.id !== fact.id && f.reading !== correctAnswerDisplay)
        .map(f => f.reading!)
      // Deterministic shuffle seeded on fact id so results are consistent per fact
      const seed = fact.id.charCodeAt(0) + (fact.id.charCodeAt(Math.min(3, fact.id.length - 1)) || 0)
      for (let i = otherReadings.length - 1; i > 0; i--) {
        const j = Math.abs((seed * 31 + i) % (i + 1))
        ;[otherReadings[i], otherReadings[j]] = [otherReadings[j], otherReadings[i]]
      }
      if (otherReadings.length >= distractorCount) {
        distractorAnswers = otherReadings.slice(0, distractorCount)
      }
    }

    // 4. Shuffle answers — deduplicate distractors that match the correct answer first
    const cleanDistractors = distractorAnswers.filter(
      d => d.toLowerCase() !== correctAnswerDisplay.toLowerCase()
    )

    // Tilde display for fragment answers — show full canonical form with ~ prefix.
    // correctAnswer stays as the fragment (e.g. "くれ") for scoring; display uses fullFormDisplay.
    if (fact.displayAsFullForm && fact.fullFormDisplay) {
      correctAnswerDisplay = `~${fact.fullFormDisplay}`
      for (let i = 0; i < cleanDistractors.length; i++) {
        if (!cleanDistractors[i].startsWith('~')) {
          cleanDistractors[i] = `~${cleanDistractors[i]}`
        }
      }
    }

    const allAnswers = [...cleanDistractors]
    const insertIdx = Math.floor((isRunRngActive() ? getRunRng('quiz').next() : Math.random()) * (allAnswers.length + 1))
    allAnswers.splice(insertIdx, 0, correctAnswerDisplay)

    // 5. Store the dynamically selected fact ID on the card for FSRS tracking
    // This is a side effect but necessary — the card needs to know which fact was asked
    ;(card as any).__studyFactId = fact.id
    ;(card as any).__studyFactCorrectAnswer = correctAnswerDisplay
    ;(card as any).__studyDistractorMap = distractorMap

    // 6. Build image quiz fields if this fact uses an image-based quiz mode.
    //    For flag facts (image_question + imageAssetPath), roll among 5 question types
    //    for variety. The `useReverse` param from tier logic is superseded by the roller
    //    for these facts — tier 1 is no longer excluded from reverse mode.
    //    Non-flag image facts fall through to the original behavior.
    let quizMode: 'text' | 'image_question' | 'image_answers' | 'chess_tactic' | undefined
    let imageAssetPath: string | undefined
    let answerImagePaths: string[] | undefined
    // Start with the template's rendered question; may be overridden per question type.
    let displayQuestion = templateResult.renderedQuestion

    if (fact.quizMode === 'image_question' && fact.imageAssetPath) {
      const questionType = rollFlagQuestionType()

      switch (questionType) {
        case 'identify':
          // Standard: show flag image, pick country name (text answers).
          quizMode = 'image_question'
          imageAssetPath = fact.imageAssetPath
          // displayQuestion stays as template default.
          break

        case 'reverse': {
          // Show country name as question, pick correct flag from image grid.
          quizMode = 'image_answers'
          const imageByAnswerRev = new Map<string, string>()
          for (const df of factPool) {
            if (df.imageAssetPath) {
              imageByAnswerRev.set(df.correctAnswer.toLowerCase(), df.imageAssetPath)
              const display = displayNumericalAnswer(df.correctAnswer)
              imageByAnswerRev.set(display.toLowerCase(), df.imageAssetPath)
            }
          }
          answerImagePaths = allAnswers.map(a => imageByAnswerRev.get(a.toLowerCase()) ?? '')
          displayQuestion = `Select the flag of ${correctAnswerDisplay}`
          break
        }

        case 'continent': {
          // Show flag image, pick which continent the country belongs to (5 text choices).
          quizMode = 'image_question'
          imageAssetPath = fact.imageAssetPath
          displayQuestion = 'This flag belongs to a country on which continent?'
          const correctContinent = REGION_NAMES[fact.chainThemeId] ?? 'Europe'
          // Replace allAnswers with all 5 continent names, shuffled.
          const continentChoices = [...REGION_NAMES].sort(() => Math.random() - 0.5)
          allAnswers.length = 0
          allAnswers.push(...continentChoices)
          correctAnswerDisplay = correctContinent
          break
        }

        case 'not_elimination': {
          // Show 4 flags (3 from one continent + 1 odd-one-out). Pick the one NOT from
          // the majority continent. The current fact is the odd-one-out (correct answer).
          const factContinent = fact.chainThemeId
          const otherContinentIdx = ((factContinent + 1 + Math.floor(Math.random() * 4)) % 5)
          const otherContinentName = REGION_NAMES[otherContinentIdx]
          const sameRegionFacts = factPool.filter(
            df => df.chainThemeId === otherContinentIdx && !!df.imageAssetPath && df.id !== fact.id
          )

          if (sameRegionFacts.length >= 3) {
            quizMode = 'image_answers'
            const shuffledSame = [...sameRegionFacts].sort(() => Math.random() - 0.5).slice(0, 3)
            const notChoices = [...shuffledSame.map(f => f.correctAnswer), fact.correctAnswer]
            // Fisher-Yates shuffle.
            for (let i = notChoices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [notChoices[i], notChoices[j]] = [notChoices[j], notChoices[i]]
            }
            const imageByAnswerNot = new Map<string, string>()
            for (const df of factPool) {
              if (df.imageAssetPath) {
                imageByAnswerNot.set(df.correctAnswer.toLowerCase(), df.imageAssetPath)
              }
            }
            answerImagePaths = notChoices.map(a => imageByAnswerNot.get(a.toLowerCase()) ?? '')
            allAnswers.length = 0
            allAnswers.push(...notChoices)
            displayQuestion = `Which of these flags is NOT from ${otherContinentName}?`
            correctAnswerDisplay = displayNumericalAnswer(fact.correctAnswer)
          } else {
            // Fallback: not enough facts in target continent — use standard identify.
            quizMode = 'image_question'
            imageAssetPath = fact.imageAssetPath
          }
          break
        }
      }
    } else if (fact.quizMode && fact.quizMode !== 'text') {
      // Non-flag image facts (future use): preserve original behavior.
      quizMode = fact.quizMode
      if (fact.quizMode === 'image_question') {
        imageAssetPath = fact.imageAssetPath
      }
    }

    return {
      question: displayQuestion,
      answers: allAnswers,
      correctAnswer: correctAnswerDisplay,
      variantIndex: 0,
      factId: fact.id,
      acceptableAnswers: (fact.acceptableAlternatives ?? []).length > 0 ? fact.acceptableAlternatives : undefined,
      language: fact.language ?? undefined,
      // DeckFact may not have pronunciation — fall back to reading field, or look up from trivia DB
      pronunciation: fact.pronunciation ?? fact.reading ?? (factsDB.isReady() ? factsDB.getById(fact.id)?.pronunciation : undefined) ?? undefined,
      quizMode,
      imageAssetPath,
      answerImagePaths,
      variantType: templateResult.template.id,
      grammarNote: fact.grammarNote,
      grammarPointHeader: fact.explanation?.includes(' — ') ? fact.explanation.split(' — ')[0] : undefined,
      quizResponseMode: fact.quizResponseMode ?? 'choice',
      sentenceFurigana: fact.sentenceFurigana,
      sentenceRomaji: fact.sentenceRomaji,
      sentenceTranslation: fact.sentenceTranslation,
      grammarPointLabel: fact.grammarPointLabel,
      fenPosition: fact.fenPosition,
      solutionMoves: fact.solutionMoves,
      lichessRating: fact.lichessRating,
      mapCoordinates: fact.mapCoordinates,
      mapRegion: fact.mapRegion,
      mapDifficultyTier: fact.mapDifficultyTier,
    }
  }

  function getQuizForCard(card: Card, optionCount: number, useReverse = false): QuizData {
    // Study mode: dynamic fact assignment from curated deck
    const runState = $activeRunState
    if ((runState?.deckMode?.type === 'study' || runState?.deckMode?.type === 'custom_deck') && runState.inRunFactTracker) {
      return getStudyModeQuiz(card, runState, useReverse)
    }

    // === Existing trivia mode code below (unchanged) ===
    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null
    if (!fact) {
      return {
        question: `Question for ${card.factId}`,
        answers: ['Answer', 'Wrong A', 'Wrong B'],
        correctAnswer: 'Answer',
        variantIndex: 0,
      }
    }
    const factLanguageCode = fact.language ?? undefined
    const factPronunciation = fact.pronunciation ?? undefined
    if (import.meta.env.DEV && factLanguageCode) {
      console.log('[Quiz] Fact language detected:', factLanguageCode, 'id:', fact.id)
    }

    // Vocab cards use the legacy 3-variant system (forward/reverse/fill-blank)
    // Knowledge facts with a variants array use the new N-variant system
    const hasVariantsArray = fact.type !== 'vocabulary' && Array.isArray(fact.variants) && fact.variants.length > 0
      && fact.variants.some((v: any) => typeof v === 'string' ? v.trim().length > 0 : (v.question || v.quizQuestion || '').trim().length > 0)
    const forceHardFormats = turnState?.ascensionForceHardQuestionFormats === true
    const variantPool = hasVariantsArray
      ? (() => {
        // Filter out true_false variants — they produce broken quiz options:
        // 1. Only 2 options (True/False) instead of 4
        // 2. 83% bias toward "True" answer
        // 3. Variants without own distractors fall back to content-based distractors
        let variants = fact.variants!.filter((v: any) => typeof v === 'string' || v.type !== 'true_false')
        if (forceHardFormats) {
          const preferred = variants.filter((variant) => (
            typeof variant !== 'string' && (variant.type === 'fill_blank' || variant.type === 'reverse' || variant.type === 'context')
          ))
          if (preferred.length > 0) variants = preferred
        }
        return variants.length > 0 ? variants : []
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
    let acceptableAnswers: string[] | undefined
    let legacyVariantType: string | undefined

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
        correctAnswer = variant.answer ?? variant.correctAnswer ?? (variant as any).correct_answer ?? fact.correctAnswer
        distractorSource = variant.distractors ?? (variant as any).distractors ?? fact.distractors
      }
      // Store back the source index in the original array for variety tracking.
      const variantQuestion = typeof variant === 'string' ? variant : (variant.question || (variant as any).quizQuestion || '')
      const sourceVariantIndex = fact.variants!.findIndex((entry) => {
        const entryQ = typeof entry === 'string' ? entry : (entry.question || (entry as any).quizQuestion || '')
        return entryQ === variantQuestion
      })
      if (sourceVariantIndex >= 0) variantIndex = sourceVariantIndex

      // Safety net: if variant changed the answer but has no own distractors,
      // fall back to base question to prevent answer/distractor type mismatch.
      // Example: fill_blank variant answers "1994" but base distractors are ["Books", "Electronics"]
      if (correctAnswer !== fact.correctAnswer) {
        const variantHasOwnDistractors = typeof variant !== 'string' &&
          Array.isArray(variant.distractors) && variant.distractors.length >= 2
        if (!variantHasOwnDistractors) {
          question = fact.quizQuestion
          correctAnswer = fact.correctAnswer
          distractorSource = fact.distractors
        }
      }
    } else {
      // Legacy system for vocab cards and facts without variants
      correctAnswer = fact.correctAnswer
      distractorSource = fact.distractors

      if (fact.type === 'vocabulary') {
        // Vocab variant system: select question format based on card tier, then build question
        // AR-241: Use per-fact variant level (deterministic progression) when available.
        const cardTier = getCardTier(getReviewStateByFactId(card.factId))
        const factVariantLevel = card.factId ? ($activeRunState?.factVariantLevel?.[card.factId] ?? undefined) : undefined
        const variant = selectVariant(cardTier, fact, factVariantLevel)
        const variantQ = buildVariantQuestion(fact, variant)
        legacyVariantType = variant

        question = variantQ.questionText
        correctAnswer = variantQ.correctAnswer

        // Runtime vocab distractor generation (spec 1.8 Option E)
        // Vocab facts ship with distractors=[] — pick from same-language pool at runtime.
        // Pass seenFactIds (FSRS-aware) so the service prioritises familiar distractors.
        if (distractorSource.length === 0) {
          const save = get(playerSave)
          const seenFactIds = save ? new Set(save.learnedFacts) : undefined
          distractorSource = getVocabDistractors(
            fact,
            Math.max(2, optionCount - 1),
            { seenFactIds, answerPool: variantQ.answerPool },
          )
        }

        // Store acceptable answers for synonym variant so grading can accept any of them
        if (variantQ.acceptableAnswers && variantQ.acceptableAnswers.length > 0) {
          acceptableAnswers = variantQ.acceptableAnswers
        }
      } else {
        question = getNonCuratedQuestion(fact.quizQuestion)
      }
    }

    const distractorCount = Math.max(2, optionCount - 1)

    // Runtime numerical distractor generation for brace-marked answers in trivia mode
    // Mirrors the logic in quizService.ts getQuizChoices()
    if (distractorSource.length === 0 && isNumericalAnswer(correctAnswer)) {
      const factAdapter = { id: fact.id, correctAnswer } as Fact
      distractorSource = getNumericalDistractors(factAdapter, distractorCount)
    }

    // Strip brace markers from correct answer for display (e.g. "{19}th" → "19th")
    correctAnswer = displayNumericalAnswer(correctAnswer)
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
      factId: fact.id,
      questionImageUrl: fact.imageUrl ?? undefined,
      acceptableAnswers,
      language: factLanguageCode,
      pronunciation: factPronunciation,
      variantType: legacyVariantType ?? 'forward',
    }
  }

  function resetCardFlow(): void {
    cardPlayStage = 'hand'
    selectedIndex = null
    committedCardIndex = null
    committedCardSnapshot = null
    committedQuizData = null
    committedAtMs = 0
    chessHintLevel = 0
    // Slide enemy back to center if quiz was active in landscape
    if ($isLandscape) {
      getCombatScene()?.slideEnemyForQuiz(false)
    }
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

    }
  })

  // NOTE: The guard $effect for 'committed' state with missing committedCard/committedQuizData
  // was removed. resetCardFlow() is already called explicitly in all correct places:
  // handleAnswer(), turn change effects, and card deselect. The $effect caused spurious resets
  // due to Svelte 5 reactive timing — derived values briefly go null during state transitions,
  // which triggered resetCardFlow() mid-quiz and slid the enemy back prematurely.

  let showEndTurnConfirm = $state(false)

  let hasPlayableCards = $derived.by(() => {
    if (!turnState || turnState.phase !== 'player_action') return false
    return handCards.some((c) => Math.max(0, getEffectiveApCost(c) - focusDiscount) <= turnState!.apCurrent)
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

  // AR-124: Tutorial tooltip triggers


  /** Show the Charge cost tutorial tooltip on first non-free Charge play. */
  function maybeShowChargeTutorial(isFreeCharge: boolean): void {
    if (isFreeCharge) return
    if (localStorage.getItem('tutorial:chargeShown')) return
    localStorage.setItem('tutorial:chargeShown', 'true')
    showChargeTutorial = true
    if (chargeTutorialTimer !== null) clearTimeout(chargeTutorialTimer)
    chargeTutorialTimer = setTimeout(() => {
      showChargeTutorial = false
      chargeTutorialTimer = null
    }, 5000)
  }

  /** Track Quick Play / Charge plays and show comparison banner once both have occurred. */
  function maybeShowComparisonBanner(mode: 'quick' | 'charge'): void {
    if (localStorage.getItem('tutorial:comparisonShown')) return
    if (mode === 'quick') hasQuickPlayed = true
    if (mode === 'charge') hasCharged = true
    if (hasQuickPlayed && hasCharged) {
      localStorage.setItem('tutorial:comparisonShown', 'true')
      showComparisonBanner = true
      if (comparisonBannerTimer !== null) clearTimeout(comparisonBannerTimer)
      comparisonBannerTimer = setTimeout(() => {
        showComparisonBanner = false
        comparisonBannerTimer = null
      }, 5000)
    }
  }

  /** Fling-to-Charge: card was dragged 80px+ upward. Select it and immediately open quiz (Charge flow). */
  function handleChargeDirect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    // Check AP: Charge costs +1 surcharge (waived by chain momentum match OR active chain color match).
    // Surge does NOT waive the surcharge (Balance Pass 3) — it grants +1 AP at turn-start instead.
    const isOnColourMatch = activeChainColor !== null && card.chainType === activeChainColor
    const chargeCost = Math.max(0, getEffectiveApCost(card) - focusDiscount) + ((chargeMomentumChainType !== null && card.chainType === chargeMomentumChainType) || isOnColourMatch ? 0 : 1)
    if (chargeCost > (turnState?.apCurrent ?? 0)) return

    selectedIndex = index
    cardPlayStage = 'selected'
    playCardAudio('charge-initiate')

    // Immediately commit — if GUARANTEED is active, handleCast will intercept before quiz
    handleCast()
  }

  function handleSelect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return

    // M-19: Show "Not enough AP" tooltip when tapping an unaffordable card
    if (Math.max(0, getEffectiveApCost(card) - focusDiscount) > (turnState?.apCurrent ?? 0)) {
      showNotEnoughAp = true
      if (notEnoughApTimer !== null) clearTimeout(notEnoughApTimer)
      notEnoughApTimer = setTimeout(() => {
        showNotEnoughAp = false
        notEnoughApTimer = null
      }, 1500)
      playCardAudio('error-deny')
      return
    }

    if (selectedIndex === index && cardPlayStage === 'selected') {
      // Second tap on selected card = Quick Play (no quiz). Delegate to handleCastDirect.
      handleCastDirect(index)
      return
    }

    playCardAudio('card-select')
    selectedIndex = index
    cardPlayStage = 'selected'

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCardTapTooltip) {
      markOnboardingTooltipSeen('hasSeenCardTapTooltip')
    }
  }

  function handleDeselect(): void {
    if (cardPlayStage !== 'selected') return
    playCardAudio('card-deselect')
    resetCardFlow()
  }

  function handleCastDirect(index: number): void {
    if (!turnState || turnState.phase !== 'player_action') return
    if (cardPlayStage === 'committed') return

    const card = handCards[index]
    if (!card) return
    if (Math.max(0, getEffectiveApCost(card) - focusDiscount) > (turnState?.apCurrent ?? 0)) return

    // Quick Play: bypass quiz entirely — play card immediately as correct (no quiz shown)
    const cardId = card.id
    playCardAudio('card-cast')
    cardPlayStage = 'committed'

    // AR-124: Tutorial — comparison banner tracking
    maybeShowComparisonBanner('quick')
    // Tutorial tracking
    tutorialHasPlayedQuickPlay = true

    // Animate as reveal → swoosh → impact → discard
    animatingCards = [...animatingCards, card]
    cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }

    // Fire the play immediately with playMode: 'quick'
    const _qpPreEnemy = snapshotEffects(turnState?.enemy?.statusEffects ?? [])
    const _qpPrePlayer = snapshotEffects(turnState?.playerState?.statusEffects ?? [])
    const quickResult = onplaycard(cardId, true, false, undefined, undefined, 'quick', undefined, false, damagePreviews[cardId])
    spawnStatusFloaters(_qpPreEnemy, _qpPrePlayer)

    const actualDmg = quickResult?.damageDealt ?? 0
    const actualShield = quickResult?.shieldApplied ?? 0
    const quickEffectVal = card.cardType === 'attack' ? actualDmg : card.cardType === 'shield' ? actualShield : (actualDmg || actualShield || Math.round(card.baseEffectValue * card.effectMultiplier))
    juiceManager.fire({
      type: 'correct',
      damage: quickEffectVal,
      isCritical: false,
      effectLabel: (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
        ? getShortCardDescription(card)
        : `${card.cardType.toUpperCase()} ${quickEffectVal}`,
      isPerfectTurn: false,
      cardType: card.cardType,
    })

    // Quick Play uses compressed animation timings for snappier feel
    const QP_REVEAL = 100
    const QP_SWOOSH = 150
    const QP_IMPACT = 150
    const QP_DISCARD = 100

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
            // AR-222: auto-end turn when no cards remain playable after Quick Play
            checkAutoEndTurn()
          }, turboDelay(QP_DISCARD))
        }, turboDelay(QP_IMPACT))
      }, turboDelay(QP_SWOOSH))
    }, turboDelay(QP_REVEAL))
  }

  function handleCast(): void {
    if (!selectedCard || !selectedPresentation || castDisabled) return

    // Soul Jar GUARANTEED: consume 1 charge and auto-succeed — skip quiz entirely
    if (showGuaranteed) {
      consumeSoulJarCharge()
      // Play as Charge-correct at full CC multiplier, no quiz shown
      const card = selectedCard
      const cardId = card.id
      const idx = selectedIndex!
      selectedIndex = null
      cardPlayStage = 'committed'
      playCardAudio('card-cast')
      maybeShowComparisonBanner('charge')
      animatingCards = [...animatingCards, card]
      cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }
      const _soulPreEnemy = snapshotEffects(turnState?.enemy?.statusEffects ?? [])
      const _soulPrePlayer = snapshotEffects(turnState?.playerState?.statusEffects ?? [])
      const chargeResult = onplaycard(cardId, true, false, undefined, undefined, 'charge', undefined, false, damagePreviews[cardId])
      spawnStatusFloaters(_soulPreEnemy, _soulPrePlayer)
      if (chargeResult?.curedCursedFact) {
        cureFlashes = { ...cureFlashes, [cardId]: true }
        setTimeout(() => {
          cureFlashes = { ...cureFlashes, [cardId]: false }
        }, 1200)
      }
      const _masteryStats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
      const _mechDef = getMechanicDefinition(card.mechanicId)
      const masteryBonus = _masteryStats && _mechDef ? _masteryStats.qpValue - _mechDef.quickPlayValue : 0
      const chargeEffectVal = Math.round(card.baseEffectValue * card.effectMultiplier) + masteryBonus
      juiceManager.fire({
        type: 'correct',
        damage: chargeEffectVal,
        isCritical: false,
        effectLabel: (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
          ? getShortCardDescription(card)
          : `${card.cardType.toUpperCase()} ${chargeEffectVal}`,
        isPerfectTurn: false,
        cardType: card.cardType,
      })
      setTimeout(() => { cardAnimations = { ...cardAnimations, [cardId]: 'swoosh' } }, turboDelay(REVEAL_DURATION))
      setTimeout(() => { cardAnimations = { ...cardAnimations, [cardId]: 'impact' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION))
      setTimeout(() => { cardAnimations = { ...cardAnimations, [cardId]: 'discard' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION))
      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: null }
        animatingCards = animatingCards.filter(c => c.id !== cardId)
        cardPlayStage = 'hand'
        // AR-222: auto-end turn when no cards remain playable after Soul Jar play
        checkAutoEndTurn()
      }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION + DISCARD_DURATION))
      void idx // suppress unused variable warning
      return
    }

    // Mastery level 5 (mastered) cards auto quick-play — no quiz needed
    // Exception: final boss encounters still require quiz
    const isFinalBoss = turnState?.enemy?.template?.category === 'boss'
    if ((selectedCard.masteryLevel ?? 0) >= MASTERY_MAX_LEVEL && !isFinalBoss) {
      handleCastDirect(selectedIndex!)
      return
    }

    playCardAudio('card-cast')
    cardPlayStage = 'committed'
    committedCardIndex = selectedIndex
    committedCardSnapshot = { ...selectedCard }
    // Mastery-based distractor count (AR-113): level 0 cards get fewer options (easier first quiz)
    const masteryLevel = selectedCard.masteryLevel ?? 0;
    let effectiveOptionCount = selectedPresentation.optionCount;
    if (masteryLevel === 0) {
      effectiveOptionCount = Math.min(effectiveOptionCount, MASTERY_BASE_DISTRACTORS + 1); // 3 options max
    } else {
      effectiveOptionCount = Math.max(effectiveOptionCount, MASTERY_UPGRADED_DISTRACTORS + 1); // 4 options min
    }
    committedQuizData = getQuizForCard(selectedCard, effectiveOptionCount, selectedPresentation.useReverse)
    committedAtMs = Date.now()
    selectedIndex = null
    // Slide enemy right in landscape when quiz activates
    if ($isLandscape) {
      getCombatScene()?.slideEnemyForQuiz(true)
    }

    // AR-124: Tutorial — charge cost tooltip (only if not free) and comparison banner tracking
    const chargingCard = handCards[selectedIndex ?? -1]
    // Surge no longer makes charge free (Balance Pass 3); check momentum + on-colour waivers only
    const isChargeFreeViaMomentum = chargeMomentumChainType !== null && chargingCard?.chainType === chargeMomentumChainType
    const isChargeFreeViaOnColour = activeChainColor !== null && chargingCard?.chainType === activeChainColor
    const isFreeCharge = isChargeFreeViaMomentum || isChargeFreeViaOnColour
    maybeShowChargeTutorial(isFreeCharge)
    maybeShowComparisonBanner('charge')
    // Tutorial tracking
    tutorialHasPlayedCharge = true

    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenCastTooltip) {
      markOnboardingTooltipSeen('hasSeenCastTooltip')
    }
    if (!state.hasCompletedOnboarding && !state.hasSeenAnswerTooltip) {
      markOnboardingTooltipSeen('hasSeenAnswerTooltip')
    }
  }

  /** AR-113: Trigger mastery visual feedback (popup + stat flash) for a card. */
  function triggerMasteryFeedback(cardId: string, change: 'upgrade' | 'downgrade'): void {
    // Show popup
    masteryPopups = { ...masteryPopups, [cardId]: change }
    // Show stat flash
    masteryFlashes = { ...masteryFlashes, [cardId]: change === 'upgrade' ? 'up' : 'down' }

    // Clear popup after 1.2s
    setTimeout(() => {
      masteryPopups = Object.fromEntries(
        Object.entries(masteryPopups).filter(([id]) => id !== cardId)
      ) as Record<string, 'upgrade' | 'downgrade'>
    }, 1200)

    // Clear flash after 800ms
    setTimeout(() => {
      masteryFlashes = Object.fromEntries(
        Object.entries(masteryFlashes).filter(([id]) => id !== cardId)
      ) as Record<string, 'up' | 'down'>
    }, 800)
  }

  /**
   * Applies the player's Phase Shift QP/CW choice (damage or block) after the popup resolves.
   * onplaycard was already called before the popup showed — this applies the deferred effect.
   */
  function firePhaseShiftChoice(choiceIndex: number): void {
    const deferred = pendingPhaseShiftDeferred
    const popup = pendingChoicePopup
    const options = pendingChoiceOptions
    if (!deferred || !popup) return
    pendingChoicePopup = null
    pendingPhaseShiftDeferred = null
    pendingChoiceOptions = null

    const card = turnState?.deck.discardPile.find(c => c.id === deferred.cardId)
      ?? turnState?.deck.hand.find(c => c.id === deferred.cardId)
    if (!card) return

    // Apply the chosen effect via the resolver (card was already played, just applying the effect now)
    const chosenOption = options?.[choiceIndex]
    if (options && chosenOption) {
      const applied = handlePendingChoice(chosenOption.id, options)
      const choiceLabel = choiceIndex === 0 ? `ATTACK ${applied.damageDealt}` : `SHIELD ${applied.shieldApplied}`
      juiceManager.fire({ type: 'correct', damage: choiceIndex === 0 ? applied.damageDealt : applied.shieldApplied, isCritical: false, effectLabel: choiceLabel, isPerfectTurn: false, cardType: card.cardType })
    } else {
      // Fallback: use popup values for juice if options unavailable
      const choiceLabel = choiceIndex === 0 ? `ATTACK ${popup.damageValue}` : `SHIELD ${popup.blockValue}`
      juiceManager.fire({ type: 'correct', damage: choiceIndex === 0 ? popup.damageValue : popup.blockValue, isCritical: false, effectLabel: choiceLabel, isPerfectTurn: false, cardType: card.cardType })
    }

    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'swoosh' } }, turboDelay(REVEAL_DURATION))
    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'impact' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION))
    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'discard' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION))
    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [deferred.cardId]: null }
      animatingCards = animatingCards.filter(c => c.id !== deferred.cardId)
    }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION + DISCARD_DURATION))
  }

  function fireUnstableFluxChoice(choiceIndex: number): void {
    const deferred = pendingUnstableFluxDeferred
    const popup = pendingChoicePopup
    const options = pendingChoiceOptions
    if (!deferred || !popup) return
    pendingChoicePopup = null
    pendingUnstableFluxDeferred = null
    pendingChoiceOptions = null

    const card = turnState?.deck.discardPile.find(c => c.id === deferred.cardId)
      ?? turnState?.deck.hand.find(c => c.id === deferred.cardId)
    if (!card) return

    // Apply the chosen effect via the resolver
    const chosenOption = options?.[choiceIndex]
    if (options && chosenOption) {
      const applied = handlePendingChoice(chosenOption.id, options)
      const choiceLabels = [
        `ATTACK ${applied.damageDealt}`,
        `SHIELD ${applied.shieldApplied}`,
        `DRAW ${chosenOption.extraCardsDrawn ?? popup.drawValue}`,
        `WEAKNESS ${popup.weaknessTurns}t`,
      ]
      const chosenVal = choiceIndex === 0 ? applied.damageDealt : choiceIndex === 1 ? applied.shieldApplied : (chosenOption.extraCardsDrawn ?? popup.drawValue)
      juiceManager.fire({ type: 'correct', damage: chosenVal, isCritical: false, effectLabel: choiceLabels[choiceIndex] ?? choiceLabels[0], isPerfectTurn: false, cardType: card.cardType })
    } else {
      // Fallback: use popup values
      const choiceLabels = [`ATTACK ${popup.damageValue}`, `SHIELD ${popup.blockValue}`, `DRAW ${popup.drawValue}`, `WEAKNESS ${popup.weaknessTurns}t`]
      const chosenVal = [popup.damageValue, popup.blockValue, popup.drawValue, popup.weaknessTurns][choiceIndex] ?? popup.damageValue
      juiceManager.fire({ type: 'correct', damage: chosenVal, isCritical: false, effectLabel: choiceLabels[choiceIndex] ?? choiceLabels[0], isPerfectTurn: false, cardType: card.cardType })
    }

    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'swoosh' } }, turboDelay(REVEAL_DURATION))
    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'impact' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION))
    setTimeout(() => { cardAnimations = { ...cardAnimations, [deferred.cardId]: 'discard' } }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION))
    setTimeout(() => {
      cardAnimations = { ...cardAnimations, [deferred.cardId]: null }
      animatingCards = animatingCards.filter(c => c.id !== deferred.cardId)
    }, turboDelay(REVEAL_DURATION + SWOOSH_DURATION + IMPACT_DURATION + DISCARD_DURATION))
  }

  // ─── CardPickerOverlay handlers ────────────────────────────────────────────

  function handleCardPickSelect(card: Card): void {
    if (!pendingCardPickState) return

    const state = pendingCardPickState
    const newSelected = [...state.selectedCards, card]

    if (newSelected.length >= state.pickCount) {
      // All picks made — resolve based on type
      pendingCardPickState = null

      if (state.type === 'transmute' && turnState) {
        const pickResolvedCards = resolveTransmutePick(turnState, state.sourceCardId, newSelected)
        // Issue 5: draw the resolved cards into hand with the normal draw animation.
        // drawHand with explicit count bypasses the HAND_SIZE cap.
        if (pickResolvedCards.length > 0) {
          drawHand(turnState.deck, pickResolvedCards.length)
        }
      }

      if (state.type === 'adapt' && turnState) {
        const chosen = newSelected[0]
        if (chosen.id === 'adapt_attack') {
          if (turnState.enemy) {
            const dmg = Math.max(0, chosen.baseEffectValue - turnState.enemy.block)
            turnState.enemy.block = Math.max(0, turnState.enemy.block - chosen.baseEffectValue)
            turnState.enemy.currentHP = Math.max(0, turnState.enemy.currentHP - dmg)
          }
        } else if (chosen.id === 'adapt_shield') {
          turnState.playerState.shield = (turnState.playerState.shield ?? 0) + chosen.baseEffectValue
        } else if (chosen.id === 'adapt_utility') {
          const debuffTypes = new Set(['poison', 'weakness', 'vulnerable', 'burn', 'bleed', 'freeze'])
          turnState.playerState.statusEffects = turnState.playerState.statusEffects.filter(s => !debuffTypes.has(s.type))
          if (turnState.deck.drawPile.length > 0) {
            turnState.deck.hand.push(turnState.deck.drawPile.pop()!)
          }
        }
      }

      if (state.type === 'conjure' && turnState) {
        const chosen = newSelected[0]
        const conjured: Card = {
          ...chosen,
          id: 'conjured_' + Math.random().toString(36).slice(2, 6),
          isTransmuted: true,
          originalCard: undefined,
        }
        turnState.deck.hand.push(conjured)
      }

      if (state.type === 'scavenge' && turnState) {
        const chosen = newSelected[0]
        const idx = turnState.deck.discardPile.findIndex(c => c.id === chosen.id)
        if (idx >= 0) {
          turnState.deck.discardPile.splice(idx, 1)
          turnState.deck.hand.push(chosen)
        }
      }

      if (state.type === 'forge' && turnState) {
        for (const chosen of newSelected) {
          const handCard = turnState.deck.hand.find(c => c.id === chosen.id)
          if (handCard) {
            const upgradeAmount = state.pickCount >= 2 ? 2 : 1
            handCard.masteryLevel = (handCard.masteryLevel ?? 0) + upgradeAmount
          }
        }
      }

      if (state.type === 'mimic' && turnState) {
        const chosen = newSelected[0]
        const mimicDiscardIdx = turnState.deck.discardPile.findIndex(c => c.id === state.sourceCardId)
        if (mimicDiscardIdx >= 0) {
          const mimicCard = turnState.deck.discardPile[mimicDiscardIdx]
          const copy: Card = {
            ...chosen,
            id: mimicCard.id + '_mimic',
            factId: mimicCard.factId,
            isTransmuted: true,
            originalCard: { ...mimicCard },
          }
          turnState.deck.discardPile.splice(mimicDiscardIdx, 1)
          turnState.deck.hand.push(copy)
        }
      }

      // Force store re-emit so handCards $derived re-computes immediately.
      // All the type-specific blocks above mutate turnState.deck.hand via .push() /
      // .splice() — in-place mutations that do NOT notify Svelte store subscribers.
      // Re-emitting the store gives CardApp's $activeTurnState a new reference,
      // which propagates a fresh turnState prop into this component and causes
      // handCards to re-derive without waiting for the next card play.
      if (turnState) {
        activeTurnState.update(s => s ? {
          ...s,
          deck: { ...s.deck, hand: [...s.deck.hand] },
        } : s)
      }
    } else {
      // More picks needed — remove selected card from candidates to prevent double-pick
      pendingCardPickState = {
        ...state,
        selectedCards: newSelected,
        candidates: state.candidates.filter(c => c.id !== card.id),
      }
    }
  }

  function handleCardPickSkip(): void {
    pendingCardPickState = null
    // AP already spent, no effect applied
    console.log('[CardPicker] Skipped')
  }

  function handleAnswer(answerIndex: number, isCorrect: boolean, speedBonus: boolean): void {
    if (!committedCard) return
    const card = committedCard
    const cardId = card.id
    const responseTimeMs = committedAtMs > 0 ? Math.max(50, Date.now() - committedAtMs) : undefined
    const stats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
    const mechanic = getMechanicDefinition(card.mechanicId)
    const masteryBonus = stats && mechanic ? stats.qpValue - mechanic.quickPlayValue : 0
    const baseForCharge = mechanic ? Math.round(mechanic.quickPlayValue * 1.5) : Math.round(card.baseEffectValue * card.effectMultiplier)
    const effectVal = baseForCharge + masteryBonus
    const effectLabel = (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
      ? getShortCardDescription(card)
      : `${card.cardType.toUpperCase()} ${effectVal}`
    const willBePerfect = isCorrect && (turnState?.cardsCorrectThisTurn === turnState?.cardsPlayedThisTurn)
    const hitCount = card.mechanicId === 'multi_hit' ? 3 : undefined
    const quizVariantIndex = committedQuizData?.variantIndex
    // Capture quiz data snapshot before resetCardFlow() nulls it — needed for confusion tracking
    const quizDataSnapshot = committedQuizData
    const previousReviewState = getReviewStateByFactId(card.factId)

    resetCardFlow()

    // Study mode: record result in in-run tracker and confusion matrix
    const studyRunState = $activeRunState
    if (studyRunState?.deckMode?.type === 'study' && studyRunState.inRunFactTracker) {
      const studyFactId = (card as any).__studyFactId as string | undefined
      if (studyFactId) {
        const selectedAnswerText = answerIndex >= 0 && quizDataSnapshot
          ? quizDataSnapshot.answers[answerIndex]
          : undefined
        const distractorMap = (card as any).__studyDistractorMap as Record<string, string> | undefined
        const confusedFactId = (!isCorrect && selectedAnswerText && distractorMap)
          ? distractorMap[selectedAnswerText.toLowerCase()]
          : undefined

        studyRunState.inRunFactTracker.recordResult(
          studyFactId,
          isCorrect,
          responseTimeMs ?? 0,
          studyRunState.inRunFactTracker.getCurrentEncounter(),
          confusedFactId,
        )
        studyRunState.inRunFactTracker.recordCharge(studyFactId, isCorrect, turnState?.turnNumber)

        if (!isCorrect && confusedFactId) {
          const matrix = getConfusionMatrix()
          matrix.recordConfusion(studyFactId, confusedFactId)
          saveConfusionMatrix()
        }
      }
    }

    if (!isCorrect) {
      // Wrong answer: fizzle (unchanged)
      tutorialHasAnsweredWrong = true
      animatingCards = [...animatingCards, card]
      cardAnimations = { ...cardAnimations, [cardId]: 'fizzle' }
      onplaycard(cardId, false, false, responseTimeMs, quizVariantIndex, 'charge', undefined, true, damagePreviews[cardId])

      // AR-113: Check for mastery downgrade after wrong answer
      // Use get(activeTurnState) not the `turnState` prop — the prop update is scheduled
      // asynchronously by Svelte; the store reflects the post-play state immediately.
      const freshTsWrong = get(activeTurnState)
      const discardedWrong = freshTsWrong?.deck.discardPile.find(c => c.id === cardId)
      if (discardedWrong && discardedWrong.masteryChangedThisEncounter) {
        triggerMasteryFeedback(cardId, 'downgrade')
      }

      juiceManager.fire({
        type: 'wrong',
        damage: 0,
        isCritical: false,
        effectLabel: undefined,
        isPerfectTurn: false,
        cardType: card.cardType,
      })

      setTimeout(() => {
        cardAnimations = { ...cardAnimations, [cardId]: null }
        animatingCards = animatingCards.filter(c => c.id !== cardId)
        // AR-222: auto-end turn when no cards remain playable
        checkAutoEndTurn()
      }, turboDelay(FIZZLE_DURATION))
    } else {
      // Derive the fact ID that was actually quizzed from the committed quiz data.
      // quizDataSnapshot.factId is authoritative — set at commit time, never stale.
      // Previously used card.__studyFactId which could be overwritten by a concurrent
      // card play before this handler fired (Issue 8).
      const answeredFactId = quizDataSnapshot?.factId ?? card.factId
      showWowFactor(answeredFactId, card)

      // Correct answer: new 5-phase animation sequence
      // Call onplaycard first — for Phase Shift QP/CW and Unstable Flux CC the resolver
      // returns pendingChoice (no effect applied yet). We then show the popup and apply
      // the chosen effect via handlePendingChoice after dismissal.
      animatingCards = [...animatingCards, card]
      const _chargePreEnemy = snapshotEffects(turnState?.enemy?.statusEffects ?? [])
      const _chargePrePlayer = snapshotEffects(turnState?.playerState?.statusEffects ?? [])
      // Pass distractorCount so card mechanics (precision_strike, etc.) know the quiz difficulty.
      const quizDistractorCount = committedQuizData ? committedQuizData.answers.length - 1 : undefined
      const chargeResult = onplaycard(cardId, true, speedBonus, responseTimeMs, quizVariantIndex, 'charge', quizDistractorCount, true, damagePreviews[cardId])
      // Only spawn status floaters when no pendingChoice/pendingCardPick — deferred choices apply effects later
      if (!chargeResult?.pendingChoice && !chargeResult?.pendingCardPick) {
        spawnStatusFloaters(_chargePreEnemy, _chargePrePlayer)
      }

      // CardPickerOverlay: resolver returned pendingCardPick — show card picker and defer effect
      if (chargeResult?.pendingCardPick) {
        pendingCardPickState = {
          ...chargeResult.pendingCardPick,
          selectedCards: [],
        }
        // Fix: card was added to animatingCards before we knew about pendingCardPick.
        // Remove it now so it doesn't hang in mid-air while the picker is shown.
        // For Transmute, the source card stays in hand (mutated in-place) — no animation needed.
        animatingCards = animatingCards.filter(c => c.id !== cardId)
        cardAnimations = { ...cardAnimations, [cardId]: null }
        resetCardFlow()
        return // Don't continue turn until pick is resolved
      }

      // Phase Shift QP/CW or Unstable Flux CC: resolver returned pendingChoice — defer effect to popup
      if (chargeResult?.pendingChoice) {
        const pc = chargeResult.pendingChoice
        type PCOption = typeof pc.options[number]
        // Start reveal animation now; swoosh/impact/discard happen after popup dismissal
        cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }
        pendingChoiceOptions = pc.options
        const deferred = { cardId, speedBonus, responseTimeMs, quizVariantIndex }

        if (pc.mechanicId === 'phase_shift') {
          const dmgOpt = pc.options.find((o: PCOption) => o.id === 'damage')
          const blkOpt = pc.options.find((o: PCOption) => o.id === 'block')
          pendingChoicePopup = {
            cardId,
            mechanicId: 'phase_shift',
            damageValue: dmgOpt?.damageDealt ?? effectVal,
            blockValue: blkOpt?.shieldApplied ?? effectVal,
            drawValue: 0,
            weaknessTurns: 0,
            isChargeCorrect: false,
          }
          pendingPhaseShiftDeferred = deferred
        } else if (pc.mechanicId === 'unstable_flux') {
          const dmgOpt = pc.options.find((o: PCOption) => o.id === 'damage')
          const blkOpt = pc.options.find((o: PCOption) => o.id === 'block')
          const drwOpt = pc.options.find((o: PCOption) => o.id === 'draw')
          const dbfOpt = pc.options.find((o: PCOption) => o.id === 'debuff')
          pendingChoicePopup = {
            cardId,
            mechanicId: 'unstable_flux',
            damageValue: dmgOpt?.damageDealt ?? 15,
            blockValue: blkOpt?.shieldApplied ?? 15,
            drawValue: drwOpt?.extraCardsDrawn ?? 3,
            weaknessTurns: (dbfOpt?.statusesApplied?.[0]?.turnsRemaining) ?? 3,
            isChargeCorrect: true,
          }
          pendingUnstableFluxDeferred = deferred
        }
        return // popup handler resumes animation
      }

      // AR-202: Cure flash animation — trigger gold glow on the card if a cursed fact was cured
      if (chargeResult && chargeResult.curedCursedFact) {
        cureFlashes = { ...cureFlashes, [cardId]: true }
        setTimeout(() => {
          const next = { ...cureFlashes }
          delete next[cardId]
          cureFlashes = next
        }, 800)
      }

      // AR-113: Check for mastery upgrade after correct answer
      // Use get(activeTurnState) not the `turnState` prop — the prop update is scheduled
      // asynchronously by Svelte; the store reflects the post-play state immediately.
      const freshTsCorrect = get(activeTurnState)
      const discardedCorrect = freshTsCorrect?.deck.discardPile.find(c => c.id === cardId)
      if (discardedCorrect && discardedCorrect.masteryChangedThisEncounter && (discardedCorrect.masteryLevel ?? 0) > 0) {
        triggerMasteryFeedback(cardId, 'upgrade')
      }

      const tierDelay = 0

      // Phase 1: Reveal (flip to cardback)
      cardAnimations = { ...cardAnimations, [cardId]: 'reveal' }

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

        const actualChargeDmg = chargeResult?.damageDealt ?? 0
        const actualChargeShield = chargeResult?.shieldApplied ?? 0
        const actualEffectVal = card.cardType === 'attack' ? (actualChargeDmg || effectVal) : card.cardType === 'shield' ? (actualChargeShield || effectVal) : effectVal
        const actualEffectLabel = (card.cardType === 'wild' || card.cardType === 'utility' || card.cardType === 'buff' || card.cardType === 'debuff')
          ? effectLabel
          : `${card.cardType.toUpperCase()} ${actualEffectVal}`
        juiceManager.fire({
          type: 'correct',
          damage: actualEffectVal,
          isCritical: speedBonus,
          effectLabel: actualEffectLabel,
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
        animatingCards = animatingCards.filter(c => c.id !== cardId)
        // AR-222: auto-end turn when no cards remain playable
        checkAutoEndTurn()
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

  /**
   * Intercepts the hint action.
   * In chess_move mode: increments chessHintLevel (capped at 2) to highlight puzzle squares.
   * In other modes: delegates to the parent onusehint (normal MC answer elimination).
   */
  function handleUseHintIntercepted(): void {
    if (committedQuizData?.quizResponseMode === 'chess_move') {
      if (chessHintLevel < 2) {
        chessHintLevel = chessHintLevel + 1
      }
      onusehint() // still decrement hintsRemaining in game state
    } else {
      onusehint()
    }
  }

  function handleEndTurn(): void {
    const state = get(onboardingState)
    if (!state.hasCompletedOnboarding && !state.hasSeenEndTurnTooltip) {
      markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
    }

    if (apCurrent >= 2 && hasPlayableCards && !showEndTurnConfirm) {
      showEndTurnConfirm = true
      return
    }

    showEndTurnConfirm = false
    playCardAudio('end-turn')

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
          duration: turboDelay(250),
          delay: i * turboDelay(40),
          easing: 'ease-in',
          fill: 'forwards',
        })
      })

      // Wait for animations to finish, then end the turn
      setTimeout(() => onendturn(), turboDelay(250) + handCardEls.length * turboDelay(40))
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

  /** Duck ambient audio while the charge quiz overlay is visible. */
  $effect(() => {
    if (isQuizPanelVisible) {
      ambientAudio.duck()
    } else {
      ambientAudio.unduck()
    }
  })

  /** Mirror isQuizPanelVisible to combatUiStore so sibling components (MultiplayerHUD) can react. */
  $effect(() => {
    quizPanelVisible.set(isQuizPanelVisible)
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

  // --- Enemy Dialogue ---
  let dialogueLine = $state<string | null>(null)
  let dialogueVisible = $state(false)
  let dialogueTimer: ReturnType<typeof setTimeout> | null = null

  let enemyDialogue = $derived(
    turnState?.enemy.template.id ? ENEMY_DIALOGUE[turnState.enemy.template.id] ?? null : null
  )

  function showDialogue(line: string) {
    dialogueLine = line
    dialogueVisible = true
    if (dialogueTimer) clearTimeout(dialogueTimer)
    dialogueTimer = setTimeout(() => {
      dialogueVisible = false
      dialogueTimer = setTimeout(() => { dialogueLine = null }, 400)
    }, 2500)
  }

  let hasShownOpening = $state(false)

  $effect(() => {
    if (turnState && enemyDialogue && !hasShownOpening) {
      hasShownOpening = true
      const lines = enemyDialogue.opening
      const line = lines[Math.floor(Math.random() * lines.length)]
      setTimeout(() => showDialogue(line), 600)
    }
    if (!turnState) {
      hasShownOpening = false
    }
  })

  let hasShownEnding = $state(false)

  $effect(() => {
    if (turnState && turnState.enemy.currentHP <= 0 && enemyDialogue && !hasShownEnding) {
      hasShownEnding = true
      const lines = enemyDialogue.ending
      const line = lines[Math.floor(Math.random() * lines.length)]
      showDialogue(line)
    }
    if (!turnState) {
      hasShownEnding = false
    }
  })
  // --- End Enemy Dialogue ---

  // ── Tutorial evaluation $effect ─────────────────────────────────────────
  // Builds TutorialContext from live state and calls evaluateTutorialStep each time
  // relevant state changes. The service handles debouncing / step sequencing.
  $effect(() => {
    if (!$tutorialActive) return
    // Track the eval trigger so the effect re-runs after "Got it" advances steps
    void $tutorialEvalTrigger

    const state = get(onboardingState)
    const ctx: TutorialContext = {
      enemyName: turnState?.enemy?.template?.name ?? null,
      enemyCategory: turnState?.enemy?.template?.category ?? null,
      playerHp: turnState?.playerState?.hp ?? 0,
      playerMaxHp: turnState?.playerState?.maxHP ?? 0,
      playerBlock: turnState?.playerState?.shield ?? 0,
      apCurrent: apCurrent,
      apMax: turnState?.apMax ?? 0,
      handSize: handCards.length,
      turnNumber: turnState?.turnNumber ?? 0,
      encounterTurnNumber: turnState?.encounterTurnNumber ?? 0,
      phase: turnState?.phase ?? null,
      cardsPlayedThisTurn: turnState?.cardsPlayedThisTurn ?? 0,
      cardsCorrectThisTurn: turnState?.cardsCorrectThisTurn ?? 0,
      chainLength: turnState?.chainLength ?? 0,
      isSurgeTurn: isSurgeActive,
      selectedCardType: selectedCard?.cardType ?? null,
      selectedCardApCost: selectedCard ? getEffectiveApCost(selectedCard) : null,
      cardPlayStage,
      quizVisible: committedQuizData != null,
      hasPlayedQuickPlay: tutorialHasPlayedQuickPlay,
      hasPlayedCharge: tutorialHasPlayedCharge,
      hasAnsweredWrong: tutorialHasAnsweredWrong,
      hasSeenCombatTutorial: state.hasSeenCombatTutorial,
      hasSeenStudyTutorial: state.hasSeenStudyTutorial,
      mode: 'combat',
      enemyIntentType: turnState?.enemy?.nextIntent?.type ?? null,
      enemyIntentValue: turnState?.enemy?.nextIntent?.value ?? null,
      studyQuestionsAnswered: 0,
      studySessionComplete: false,
      enemyPassives: turnState?.enemy
        ? getEnemyPowers(turnState.enemy).map((p: { resolvedTooltip: string }) => p.resolvedTooltip)
        : [],
      relicCount: displayRelics?.length ?? 0,
      fogLevel: fogLevel ?? null,
      fogState: fogState ?? null,
      drawPileCount: drawPileCount ?? 0,
      discardPileCount: discardPileCount ?? 0,
      musicCategory: null,
    }

    evaluateTutorialStep(ctx)
  })

  onDestroy(() => {
    for (const unsub of kbdUnsubscribers) unsub()
    kbdUnsubscribers = []
    // Clear quiz visibility flag
    setQuizVisible(false)
    if (dialogueTimer) clearTimeout(dialogueTimer)
  })

</script>

<div class="card-combat-overlay" bind:this={combatOverlayEl} class:near-death-tension={isNearDeath} class:layout-landscape={$isLandscape} class:quiz-active={isQuizPanelVisible} class:damage-shaking={isDamageShaking}>
  <!-- MEDIUM-12: Low-HP vignette (<=40% HP) and pulse (<=25% HP) -->
  {#if isLowHp}
    <div class="low-hp-vignette" class:critical-hp={isCriticalHp} aria-hidden="true"></div>
  {/if}
  {#if turnState === null}
    <div class="empty-state">
      <p>Waiting for encounter...</p>
      {#if onreturnhub}
        <button type="button" class="return-hub-btn" onclick={onreturnhub}>Return to Hub</button>
      {/if}
    </div>
  {:else}
    <RelicTray relics={displayRelics} triggeredRelicId={turnState.triggeredRelicId} maxSlots={maxRelicSlots} />

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
      <div class="enemy-name-row">
        <div class="enemy-name-header" role="heading" aria-level="2" aria-label="{enemyName}">
          {enemyName}
        </div>
        <div data-tutorial-anchor="enemy-power-badges" style="display: inline-flex; align-items: center;">
          <EnemyPowerBadges enemy={turnState?.enemy} />
        </div>
      </div>
    {/if}

    {#if dialogueLine}
      <div class="enemy-dialogue" class:dialogue-visible={dialogueVisible}>
        <span class="dialogue-text">{dialogueLine}</span>
      </div>
    {/if}

    <StatusEffectBar effects={enemyEffects} position="enemy" />

    {#if turnState}
      <div class="sr-only" aria-live="polite" role="status">
        {enemyName}: {turnState.enemy.currentHP} of {turnState.enemy.maxHP} HP
      </div>
    {/if}

    <div class="ap-orb" class:ap-active={apCurrent > 0} class:ap-empty={apCurrent === 0} aria-label="Action points: {apCurrent}">
      <span class="ap-number">{apCurrent}</span>
      <span class="ap-label" aria-hidden="true">AP</span>
    </div>

    <div class="pile-indicator draw-pile-indicator" bind:this={drawPileEl} aria-label="Draw pile: {drawPileCount}" title={pileTooltip('Draw', turnState.deck.drawPile)} data-tutorial-anchor="draw-pile">
      <div class="pile-icon" style="--stack-count: {drawStackCount}">
        {#each Array(drawStackCount) as _, idx}
          <div class="pile-card-stack" style="transform: translate(calc({idx * 2}px * var(--layout-scale, 1)), calc({-idx * 2}px * var(--layout-scale, 1)));"></div>
        {/each}
      </div>
      <span class="pile-count-label">{drawPileCount}</span>
    </div>

    <div class="pile-indicator discard-pile-indicator" bind:this={discardPileEl} aria-label="Discard pile: {discardPileCount}" title={pileTooltip('Discard', turnState.deck.discardPile, false)} data-tutorial-anchor="discard-pile">
      <div class="pile-icon" style="--stack-count: {discardStackCount}">
        {#each Array(Math.max(1, discardStackCount)) as _, idx}
          <div class="pile-card-stack" class:pile-empty={discardStackCount === 0} style="transform: translate(calc({idx * 2}px * var(--layout-scale, 1)), calc({-idx * 2}px * var(--layout-scale, 1))); {discardStackCount === 0 ? 'opacity: 0.3;' : ''}"></div>
        {/each}
      </div>
      <span class="pile-count-label">{discardPileCount}</span>
    </div>

    <!-- AR-204: Forget pile indicator — tap to open RunDeckOverlay filtered to exhaust pile -->
    {#if forgetPileCount > 0}
      <button
        class="forget-pile-indicator"
        onclick={() => { openRunDeckOverlay('exhaust') }}
        aria-label="Forget pile: {forgetPileCount} cards"
        title="Forgotten cards"
        data-testid="forget-pile-indicator"
      >
        <span class="forget-icon">✕</span>
        <span class="forget-count">{forgetPileCount}</span>
      </button>
    {/if}

    <!-- Quiz backdrop scrim — covers canvas when quiz is active -->
    {#if cardPlayStage === 'committed'}
      <div class="quiz-backdrop"></div>
    {/if}

    <!-- AR-113: Mastery upgrade/downgrade popups -->
    {#each Object.entries(masteryPopups) as [popupCardId, popupType]}
      <div
        class="mastery-popup"
        class:mastery-popup-upgrade={popupType === 'upgrade'}
        class:mastery-popup-downgrade={popupType === 'downgrade'}
      >
        {popupType === 'upgrade' ? 'Upgraded!' : 'Downgraded!'}
      </div>
    {/each}

    {#if intentDisplay && cardPlayStage !== 'committed'}
      {#key intentDetailText}
        <div
          class="enemy-intent-bubble"
          class:intent-bubble-blocked={intentDisplay.fullyBlocked}
          style="background: {intentDisplay.color}; border-color: {intentDisplay.borderColor};"
          aria-label={intentDetailText}
          data-intent-blocked={intentDisplay.fullyBlocked ? 'true' : undefined}
          data-tutorial-anchor="enemy-intent"
        >
          {#if followUpIntent}
            <!-- Buff prefix line: subdued first-row showing the buff that precedes the attack -->
            <div class="intent-buff-prefix">
              <img
                class="intent-prefix-icon"
                src={getIntentIconPath('buff', {})}
                alt=""
                onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span class="intent-prefix-text">{enemyIntent?.telegraph ?? 'Buff'}</span>
            </div>
          {/if}
          <div class="intent-bubble-name">
            <img class="intent-icon-img" src={enemyIntent ? getIntentIconPath(followUpIntent ? (followUpIntent.type as string) : enemyIntent.type, { statusEffect: enemyIntent.statusEffect?.type, value: enemyIntent.value, hitCount: enemyIntent.hitCount }) : ''} alt=""
              onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'inline'); }} />
            <span class="intent-icon-fallback" style="display:none">{enemyIntent ? INTENT_EMOJI[enemyIntent.type] ?? '❓' : '❓'}</span>
            <strong class="intent-attack-name">{intentDisplay.telegraph || intentDisplay.label}</strong>
          </div>
          <div class="intent-detail-line">{intentDetailText}</div>
        </div>
      {/key}
    {/if}


    {#if cardPlayStage === 'selected' && selectedCard}
      <button
        class="card-backdrop"
        onclick={handleDeselect}
        aria-label="Cancel card selection"
      >
        <span class="backdrop-cancel-hint">Tap to cancel</span>
      </button>
    {/if}

    {#if showMustChargeTooltip}
      <div class="must-charge-tooltip" transition:fade={{ duration: 150 }}>
        ⚡ Must Charge!
      </div>
    {/if}

    {#if showNotEnoughAp}
      <div class="not-enough-ap-tooltip" transition:fade={{ duration: 150 }}>Not enough AP</div>
    {/if}

    <!-- AR-124: Tutorial tooltips (mutually exclusive — only the highest-priority one shows) -->
    {#if activeTutorial === 'charge'}
      <div class="tutorial-tooltip tutorial-charge-tooltip" transition:fade={{ duration: 200 }}>
        Charging costs +1 extra AP for the quiz power boost.
      </div>
    {/if}

    {#if activeTutorial === 'comparison'}
      <div class="tutorial-comparison-banner" transition:fade={{ duration: 200 }}>
        Quick Play = safe at 1.0x. Charge = quiz for up to 1.5x power + Speed Bonus!
      </div>
    {/if}

    {#if cardPlayStage === 'committed' && committedCard && committedQuizData && committedPresentation}
      <!-- §7 spec: quiz panel fade out = 200ms when dismissed -->
      <div
        class="quiz-wrapper"
        data-tutorial-anchor="quiz-panel"
        out:fade={{ duration: 200 }}
      >
        <CardExpanded
          card={committedCard}
          question={committedQuizData.question}
          answers={committedQuizData.answers}
          correctAnswer={committedQuizData.correctAnswer}
          questionImageUrl={committedQuizData.questionImageUrl}
          timerDuration={effectiveTimerSeconds}
          timerEnabled={timerEnabled}
          speedBonusThreshold={speedBonusThreshold}
          showMasteryTrialHeader={committedCard.isMasteryTrial === true}
          timerColorVariant={timerColorVariant}
          allowCancel={false}
          factLanguage={committedQuizData.language}
          factPronunciation={committedQuizData.pronunciation}
          quizVariantType={committedQuizData.variantType}
          quizMode={committedQuizData.quizMode}
          imageAssetPath={committedQuizData.imageAssetPath}
          answerImagePaths={committedQuizData.answerImagePaths}
          deckDisplayName={deckDisplayName}
          quizLanguageCode={committedQuizHasLanguageOptions ? (committedQuizLanguage ?? undefined) : undefined}
          grammarNote={committedQuizData.grammarNote}
          grammarPointHeader={committedQuizData.grammarPointHeader}
          quizResponseMode={committedQuizData.quizResponseMode}
          sentenceFurigana={committedQuizData.sentenceFurigana}
          sentenceRomaji={committedQuizData.sentenceRomaji}
          sentenceTranslation={committedQuizData.sentenceTranslation}
          grammarPointLabel={committedQuizData.grammarPointLabel}
          fenPosition={committedQuizData.fenPosition}
          solutionMoves={committedQuizData.solutionMoves}
          lichessRating={committedQuizData.lichessRating}
          mapCoordinates={committedQuizData.mapCoordinates}
          mapRegion={committedQuizData.mapRegion}
          mapDifficultyTier={committedQuizData.mapDifficultyTier}
          chessHintLevel={chessHintLevel}
          onanswer={handleAnswer}
          onskip={handleSkip}
          oncancel={() => {}}
        />
      </div>
    {/if}

    {#if onboardingTip}
      <div class={`onboarding-tip ${onboardingTipClass}`}>{onboardingTip}</div>
    {/if}

    {#each damageNumbers as dn (dn.id)}
      <DamageNumber value={dn.value} isCritical={dn.isCritical} type={dn.type} position={dn.position} onComplete={() => removeDamageNumber(dn.id)} />
    {/each}

    {#if wowFactorText}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="wow-factor-overlay" class:wow-visible={wowFactorVisible}
        onclick={() => { wowFactorVisible = false; setTimeout(() => { wowFactorText = null }, 200) }}
      >{wowFactorText}</div>
    {/if}

    {#if turnBannerText}
      <div class="turn-banner" class:turn-banner-visible={turnBannerVisible} class:enemy-turn={turnBannerText === 'ENEMY TURN'}>{turnBannerText}</div>
    {/if}


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
          class:hp-critical={isHpCritical}
          style="width: {Math.round(playerHpRatio * 100)}%; background: {playerHpColor};"
        ></div>
        <span class="player-hp-text" class:hp-critical-text={isHpCritical}>{playerHpCurrent}/{playerHpMax}</span>
      </div>
      {#if showRosterTrigger}
        <button
          class="roster-trigger-pill"
          data-testid="btn-open-roster"
          title="See other players"
          aria-label="See {otherPlayerCount > 0 ? otherPlayerCount : 'other'} other player{otherPlayerCount !== 1 ? 's' : ''}"
          onclick={onopenroster}
        >
          <span class="roster-pill-icon" aria-hidden="true">&#128101;</span>
          {#if otherPlayerCount > 0}<span class="roster-pill-count">{otherPlayerCount}</span>{/if}
        </button>
      {/if}
    </div>

    <!-- AP indicator: positioned right of End Turn button (portrait) -->
    <div class="player-ap-right" class:ap-active={apCurrent > 0} aria-label="Action Points" data-tutorial-anchor="ap-indicator">
      <span class="ap-num">{apCurrent}</span>
    </div>

    <div data-tutorial-anchor="chain-counter" style="display: contents;">
    <ChainCounter {isPerfectTurn} {chainLength} {chainType} {chainMultiplier} {activeChainColor} />
    </div>

    <div data-tutorial-anchor="card-hand" style="display: contents;">
    <CardHand
      cards={handCards}
      {animatingCards}
      {selectedIndex}
      {cardAnimations}
      apCurrent={apCurrent}
      disabled={turnState.phase !== 'player_action' || cardPlayStage === 'committed'}
      onselectcard={handleSelect}
      ondeselectcard={handleDeselect}
      oncastdirect={handleCastDirect}
      onchargeplay={handleChargeDirect}
      {isSurgeActive}
      {chargeMomentumChainType}
      {focusDiscount}
      quizVisible={isQuizPanelVisible}
      {masteryFlashes}
      {cureFlashes}
      {showGuaranteed}
      {damagePreviews}
      {activeChainColor}
      chainMultiplier={chainMultiplier}
    />
    </div>

    {#if showEndTurn}
      {#if $coopWaitingForPartner}
        <!-- Co-op waiting: disabled WAITING… button. Cancel lives in the
             coop-waiting-banner below — no button-swap on the end-turn
             slot (2026-04-23: removed the CANCEL END TURN transform; the
             banner already carries the cancel affordance and doubling it
             up made the turn-end interaction ambiguous). -->
        <button
          class="end-turn-btn"
          class:disabled={true}
          data-testid="btn-end-turn"
          aria-label="Waiting for partner to end their turn"
          title="Waiting for your partner — use the Cancel button below to return to your turn."
          disabled
        >
          WAITING…
        </button>
      {:else}
        <!-- Default: END TURN -->
        <button
          class="end-turn-btn"
          class:disabled={endTurnDisabled}
          class:end-turn-pulse={!endTurnDisabled && cardPlayStage !== 'committed' && (apCurrent === 0 || !hasPlayableCards)}
          class:has-ap-remaining={apCurrent > 0 && hasPlayableCards && !endTurnDisabled}
          data-testid="btn-end-turn"
          data-tutorial-anchor="end-turn-btn"
          aria-label="End turn"
          onclick={handleEndTurn}
          disabled={endTurnDisabled}
        >
          END TURN
        </button>
      {/if}
    {/if}

    {#if $coopWaitingForPartner}
      <div class="coop-waiting-banner" role="status" aria-live="polite">
        Waiting for partner to end turn…
        <button
          type="button"
          class="coop-cancel-btn"
          onclick={handleCoopCancel}
          data-testid="coop-cancel-btn"
        >Cancel</button>
      </div>
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

  {#if synergyFlashText && cardPlayStage !== 'committed'}
    <div class="synergy-flash" transition:fade={{ duration: 300 }}>
      <span class="synergy-flash-icon">✦</span>
    </div>
  {/if}

  {#if showReshuffle}
    <div class="reshuffle-fly-zone">
      <div class="reshuffle-label">Reshuffling...</div>
      {#each Array(reshuffleCardCount) as _, i}
        <div class="reshuffle-fly-card" style="animation-delay: {i * 40}ms"></div>
      {/each}
    </div>
  {/if}

  <!-- AR-74: Help button — always visible during battle -->
  {#if $isLandscape}
    <button
      class="kbd-help-trigger"
      type="button"
      onclick={() => inputService.dispatch({ type: 'TOGGLE_KEYBOARD_HELP' })}
      aria-label="Show keyboard shortcuts (?)"
      title="Keyboard shortcuts"
    >?</button>
  {/if}

  <!-- Landscape three-strip layout: Stats bar sits between arena (top 65%) and card hand (bottom 27%) -->
  {#if $isLandscape && turnState}
    <div class="landscape-stats-bar" aria-label="Player status">
    </div>

  {/if}
</div>

<!-- AR-74: Keyboard shortcut help overlay -->
<KeyboardShortcutHelp />

<!-- §6 Surge golden border overlay — both portrait and landscape, pointer-events: none -->
<div data-tutorial-anchor="surge-border" style="display: contents;">
<SurgeBorderOverlay active={isSurgeActive} />
</div>


<!-- CardPickerOverlay: Transmute, Adapt, Conjure, Scavenge, Forge, Mimic -->
{#if pendingCardPickState}
  <CardPickerOverlay
    title={pendingCardPickState.title}
    cards={pendingCardPickState.candidates}
    onselect={handleCardPickSelect}
    onskip={handleCardPickSkip}
    pickCount={pendingCardPickState.pickCount}
  />
{/if}

<!-- Phase: choose Damage or Block (QP/CW) -->
{#if pendingChoicePopup?.mechanicId === 'phase_shift'}
  <MultiChoicePopup
    prompt="Phase — choose an effect:"
    choices={[
      { label: `Deal ${pendingChoicePopup.damageValue} Damage`, description: 'Attack the enemy' },
      { label: `Gain ${pendingChoicePopup.blockValue} Block`, description: 'Shield yourself' },
    ]}
    forcePick={true}
    onChoose={(i) => firePhaseShiftChoice(i)}
  />
{/if}

<!-- Flux CC: choose 1 of 4 effects at 1.5× -->
{#if pendingChoicePopup?.mechanicId === 'unstable_flux'}
  <MultiChoicePopup
    prompt="Flux — choose an effect (1.5×):"
    choices={[
      { label: `Deal ${pendingChoicePopup.damageValue} Damage` },
      { label: `Gain ${pendingChoicePopup.blockValue} Block` },
      { label: `Draw ${pendingChoicePopup.drawValue} Cards` },
      { label: `Apply Weakness (${pendingChoicePopup.weaknessTurns} turns)` },
    ]}
    forcePick={true}
    onChoose={(i) => fireUnstableFluxChoice(i)}
  />
{/if}

<style>
  /* AR-74: Keyboard help trigger button (landscape only) */
  .kbd-help-trigger {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    font-family: 'Courier New', monospace;
    font-size: calc(14px * var(--layout-scale, 1));
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

  /* MEDIUM-12: Low-HP vignette, HP-bar pulse, damage shake */
  .low-hp-vignette {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9;
    background:
      radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(180, 30, 30, 0.0) 75%, rgba(200, 20, 20, 0.35) 100%);
    animation: lowHpPulse 3s ease-in-out infinite;
    transition: opacity 0.5s ease;
  }

  .low-hp-vignette.critical-hp {
    /* Stronger, faster pulse at <=25% HP */
    background:
      radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(200, 20, 20, 0.08) 65%, rgba(220, 10, 10, 0.55) 100%);
    animation: criticalHpPulse 1.5s ease-in-out infinite;
  }

  @keyframes lowHpPulse {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1.0; }
  }

  @keyframes criticalHpPulse {
    0%, 100% { opacity: 0.7; }
    50%       { opacity: 1.0; }
  }

  /* HP-bar pulse animation at <=25% HP */
  .player-hp-fill.hp-critical {
    animation: hpBarBreathing 1.5s ease-in-out infinite;
  }

  @keyframes hpBarBreathing {
    0%, 100% { filter: brightness(1.0); }
    50%       { filter: brightness(1.5) drop-shadow(0 0 calc(4px * var(--layout-scale, 1)) rgba(239, 68, 68, 0.8)); }
  }

  /* Damage shake (CSS transform animation, 50ms per cycle) */
  .card-combat-overlay.damage-shaking {
    animation: damageShake 150ms ease-out;
  }

  @keyframes damageShake {
    0%  { transform: translate(0, 0); }
    20% { transform: translate(calc(-4px * var(--layout-scale, 1)), calc(2px * var(--layout-scale, 1))); }
    40% { transform: translate(calc(4px * var(--layout-scale, 1)), calc(-2px * var(--layout-scale, 1))); }
    60% { transform: translate(calc(-3px * var(--layout-scale, 1)), calc(1px * var(--layout-scale, 1))); }
    80% { transform: translate(calc(2px * var(--layout-scale, 1)), calc(-1px * var(--layout-scale, 1))); }
    100% { transform: translate(0, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .low-hp-vignette,
    .low-hp-vignette.critical-hp,
    .player-hp-fill.hp-critical,
    .card-combat-overlay.damage-shaking {
      animation: none;
    }
    .card-combat-overlay.damage-shaking {
      transform: none;
    }
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
    gap: calc(16px * var(--layout-scale, 1));
    height: 100%;
    color: #7f8c8d;
    font-size: calc(14px * var(--layout-scale, 1));
  }

  .empty-state p {
    margin: 0;
  }

  .return-hub-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    padding: 0 calc(24px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1f2937;
    color: #f8fafc;
    font-size: calc(14px * var(--layout-scale, 1));
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .ap-orb {
    display: none; /* Hidden in portrait — AP shown inline in player-status-strip */
    position: absolute;
    left: calc(16px * var(--layout-scale, 1));
    bottom: 35vh;
    z-index: 8;
    width: calc(56px * var(--layout-scale, 1));
    height: calc(56px * var(--layout-scale, 1));
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
    font-family: var(--font-rpg);
    font-size: calc(28px * var(--layout-scale, 1));
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 1), 0 1px 3px rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    width: calc(42px * var(--layout-scale, 1));
    height: calc(42px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ap-label {
    position: absolute;
    bottom: calc(-14px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(9px * var(--layout-scale, 1));
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.05em;
    pointer-events: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes ap-fire-rotate {
    from { transform: rotate(0deg) scale(0.97); }
    25% { transform: rotate(90deg) scale(1.03); }
    50% { transform: rotate(180deg) scale(0.97); }
    75% { transform: rotate(270deg) scale(1.03); }
    to { transform: rotate(360deg) scale(0.97); }
  }


  .enemy-intent-bubble {
    position: fixed;
    top: calc(16% + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    border: 2px solid;
    border-radius: 14px;
    width: auto;
    min-width: calc(80px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    backdrop-filter: blur(8px);
    font: inherit;
    outline: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: calc(4px * var(--layout-scale, 1));
    color: inherit;
    pointer-events: none;
  }

  .intent-bubble-name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .intent-attack-name {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 800;
    color: #f1f5f9;
    white-space: nowrap;
    max-width: calc(240px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .intent-detail-line {
    font-size: calc(15px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
    line-height: 1.3;
    max-width: calc(280px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* When the player's block fully absorbs incoming damage, mute the attack intent bubble
     so it reads as "no HP loss" rather than a threat. The detail text still shows context. */
  .intent-bubble-blocked .intent-attack-name {
    color: rgba(148, 163, 184, 0.7);
    text-shadow: none;
  }

  .intent-bubble-blocked .intent-detail-line {
    color: rgba(148, 163, 184, 0.6);
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
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    vertical-align: middle;
  }

  .intent-icon-fallback {
    vertical-align: middle;
  }

  /* Combined buff+attack: subdued first row showing the buff that precedes the main attack. */
  .intent-buff-prefix {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    opacity: 0.75;
    margin-bottom: calc(2px * var(--layout-scale, 1));
  }

  .intent-prefix-icon {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .intent-prefix-text {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
  }

  .intent-value {
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    font-family: 'Georgia', serif;
    color: #e2e8f0;
    text-shadow:
      -1px -1px 0 rgba(0,0,0,0.5),
      1px -1px 0 rgba(0,0,0,0.5),
      -1px 1px 0 rgba(0,0,0,0.5),
      1px 1px 0 rgba(0,0,0,0.5);
    text-align: center;
    min-width: calc(24px * var(--layout-scale, 1));
  }

  .intent-value-attack {
    color: #ff4444;
    text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(255, 68, 68, 0.5);
  }

  .intent-value-defend {
    color: #4499ff;
    text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(68, 153, 255, 0.5);
  }

  .intent-value-heal {
    color: #44ff88;
    text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(68, 255, 136, 0.5);
  }

  .intent-value-buff {
    color: #f0c860;
    text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(240, 200, 96, 0.5);
  }

  .intent-value-debuff {
    color: #c084fc;
    text-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(192, 132, 252, 0.5);
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
    font-size: calc(10px * var(--layout-scale, 1));
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .enemy-name-row {
    position: fixed;
    top: calc(6vh + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: 11;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .enemy-name-header {
    color: #ffffff;
    font-size: calc(24px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-family: var(--font-rpg);
    text-shadow:
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 8px rgba(0, 0, 0, 0.9);
    -webkit-text-stroke: calc(1px * var(--layout-scale, 1)) black;
    white-space: nowrap;
    pointer-events: none;
  }

  .enemy-dialogue {
    position: absolute;
    top: calc(68px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(280px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: calc(8px * var(--layout-scale, 1));
    z-index: 15;
    opacity: 0;
    transition: opacity 300ms ease;
    pointer-events: none;
  }

  .enemy-dialogue.dialogue-visible {
    opacity: 1;
  }

  .dialogue-text {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #C9D1D9;
    font-style: italic;
    line-height: 1.3;
    text-align: center;
    display: block;
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


  .end-turn-btn {
    position: absolute;
    /* Shifted left to make room for the AP indicator on the far right. */
    right: calc(90px * var(--layout-scale, 1));
    left: auto;
    bottom: calc(calc(12px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
    width: auto;
    min-width: calc(110px * var(--layout-scale, 1));
    padding: 0 calc(20px * var(--layout-scale, 1));
    height: calc(48px * var(--layout-scale, 1));
    background: #b8860b;
    color: #fbbf24;
    border: calc(2px * var(--layout-scale, 1)) solid rgba(251, 191, 36, 0.4);
    border-radius: 10px;
    font-size: calc(14px * var(--layout-scale, 1));
    font-weight: 700;
    cursor: pointer;
    z-index: 26;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  /* Co-op "waiting for partner" banner: small status pill above the End Turn button. */
  .coop-waiting-banner {
    position: absolute;
    right: calc(90px * var(--layout-scale, 1));
    bottom: calc(calc(70px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
    z-index: 9;
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(20, 30, 50, 0.92);
    border: 1px solid rgba(125, 211, 252, 0.6);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #bae6fd;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    box-shadow: 0 0 12px rgba(125, 211, 252, 0.3);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    animation: coopWaitPulse 1.6s ease-in-out infinite;
  }

  @keyframes coopWaitPulse {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 1; box-shadow: 0 0 18px rgba(125, 211, 252, 0.5); }
  }

  .coop-cancel-btn {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(125, 211, 252, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #bae6fd;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    min-height: calc(28px * var(--layout-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
    font-family: inherit;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .coop-cancel-btn:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  /* AP indicator — portrait: right of status strip; landscape: right of End Turn button */
  .player-ap-right {
    position: absolute;
    right: calc(12px * var(--layout-scale, 1));
    left: auto;
    bottom: calc(calc(18px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(1px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    min-width: calc(48px * var(--layout-scale, 1));
    height: calc(38px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(255, 160, 60, 0.7);
    background: rgba(180, 100, 40, 0.85);
    color: #f8fafc;
    font-weight: 700;
    z-index: 26;
    pointer-events: none;
  }

  /* Landscape: reposition to right of End Turn button (fixed position) */
  .layout-landscape .player-ap-right {
    position: fixed;
    left: calc(208px * var(--layout-scale, 1));
    right: auto;
    bottom: calc(22px * var(--layout-scale, 1)); /* Issue 3: raised 6px per design note */
    z-index: 26;
    background: rgba(150, 50, 20, 0.88);
    box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) rgba(255, 100, 0, 0.55);
    border-color: rgba(255, 100, 0, 0.85);
  }

  .player-ap-right.ap-active {
    border-color: rgba(255, 180, 80, 0.9);
    background: rgba(220, 140, 60, 0.92);
    box-shadow: 0 0 8px 2px rgba(255, 180, 80, 0.55);
  }

  .player-ap-right .ap-num {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 800;
    line-height: 1;
    color: #fff7e6;
  }



  .end-turn-btn.disabled,
  .end-turn-btn:disabled {
    background: #334155;
    color: #cbd5e1;
  }


  .end-turn-pulse {
    animation: pulse-glow 1.5s ease-in-out infinite;
    color: #fbbf24;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(234, 179, 8, 0.5); background: #b8860b; }
    50% { box-shadow: 0 0 16px rgba(234, 179, 8, 0.8); background: #c4960d; }
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
    padding: calc(16px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    max-width: calc(260px * var(--layout-scale, 1));
    text-align: center;
  }

  .end-turn-confirm-box p {
    color: #f8fafc;
    font-size: calc(14px * var(--layout-scale, 1));
    margin: 0 0 calc(14px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  .confirm-buttons {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .confirm-btn {
    flex: 1;
    height: calc(42px * var(--layout-scale, 1));
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: calc(13px * var(--layout-scale, 1));
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
    left: calc(12px * var(--layout-scale, 1));
    /* End Turn now sits at right: 70px with min-width 110px, AP at right: 12px width ~48px.
       Reserve room for both: 70 + 110 + 6 gap = ~186 + a bit. */
    right: calc(200px * var(--layout-scale, 1));
    bottom: calc(calc(14px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
    z-index: 8;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .player-ap-inline {
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(255, 160, 60, 0.7);
    background: rgba(180, 100, 40, 0.85);
    min-height: calc(26px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    color: #f8fafc;
    flex-shrink: 0;
  }

  .player-ap-inline.ap-active {
    border-color: rgba(255, 100, 0, 0.8);
    background: rgba(100, 30, 10, 0.75);
    box-shadow: 0 0 6px 1px rgba(255, 120, 0, 0.3);
  }

  .ap-num {
    font-size: calc(15px * var(--layout-scale, 1));
    font-weight: 800;
    line-height: 1;
  }

  .ap-label {
    font-size: calc(10px * var(--layout-scale, 1));
    opacity: 0.8;
    letter-spacing: 0.5px;
    line-height: 1;
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

  .player-block-badge.dimmed {
    opacity: 0.3;
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
    font-family: var(--font-rpg);
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
    height: calc(22px * var(--layout-scale, 1));
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.7);
    background: rgba(15, 23, 42, 0.82);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    position: relative;
  }

  .player-hp-fill {
    height: 100%;
    min-width: 4px;
    border-radius: 999px;
    transition: width 160ms ease, background 160ms ease;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }

  .hp-critical {
    animation: hpCriticalPulse 1s ease-in-out infinite;
  }

  @keyframes hpCriticalPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(239, 68, 68, 0.5); }
    50% { opacity: 0.7; box-shadow: 0 0 12px rgba(239, 68, 68, 0.9); }
  }

  /* ===== Roster trigger pill ===== */
  .roster-trigger-pill {
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    padding: calc(3px * var(--layout-scale, 1)) calc(7px * var(--layout-scale, 1));
    min-width: calc(32px * var(--layout-scale, 1));
    min-height: calc(22px * var(--layout-scale, 1));
    background: rgba(255, 215, 0, 0.10);
    border: 1px solid rgba(255, 215, 0, 0.30);
    border-radius: 999px;
    color: #FFD700;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }

  .roster-trigger-pill:hover {
    background: rgba(255, 215, 0, 0.22);
    border-color: rgba(255, 215, 0, 0.6);
  }

  .roster-pill-icon {
    font-size: calc(12px * var(--text-scale, 1));
    line-height: 1;
  }

  .roster-pill-count {
    line-height: 1;
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
    pointer-events: auto;
    cursor: pointer;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 200ms ease, transform 200ms ease;
  }

  .wow-factor-overlay.wow-visible {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 150ms ease, transform 150ms ease;
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

  .turn-banner {
    position: absolute;
    top: calc(35% - calc(20px * var(--layout-scale, 1)));
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    z-index: 15;
    font-size: calc(22px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: calc(3px * var(--layout-scale, 1));
    text-transform: uppercase;
    color: #f0e6c0;
    text-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(240, 200, 96, 0.6), 0 calc(2px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8);
    background: linear-gradient(90deg, transparent, rgba(10, 8, 20, 0.75) 20%, rgba(10, 8, 20, 0.75) 80%, transparent);
    padding: calc(8px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms ease;
  }

  .turn-banner-visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .turn-banner.enemy-turn {
    color: #ff6b6b;
    text-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(255, 107, 107, 0.6), 0 calc(2px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8);
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
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .draw-pile-indicator {
    left: calc(12px * var(--layout-scale, 1));
    right: auto;
    bottom: calc(calc(200px * var(--layout-scale, 1)) + 2vh);
  }

  .discard-pile-indicator {
    right: calc(12px * var(--layout-scale, 1));
    left: auto;
    bottom: calc(calc(200px * var(--layout-scale, 1)) + 2vh);
  }

  /* AR-204: Forget pile indicator — sits above the discard pile indicator */
  .forget-pile-indicator {
    position: absolute;
    right: calc(12px * var(--layout-scale, 1));
    bottom: calc(calc(260px * var(--layout-scale, 1)) + 7vh);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    background: rgba(10, 18, 30, 0.7);
    border: 2px solid rgba(150, 80, 200, 0.7);
    border-radius: 6px;
    padding: calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    z-index: 40;
    transition: border-color 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .forget-pile-indicator:hover {
    border-color: rgba(150, 80, 200, 1);
  }

  .forget-icon {
    font-size: calc(12px * var(--layout-scale, 1));
    color: rgba(150, 80, 200, 0.9);
    line-height: 1;
  }

  .forget-count {
    font-family: var(--font-rpg);
    font-size: calc(8px * var(--layout-scale, 1));
    color: #aaa;
    line-height: 1;
  }

  .pile-icon {
    width: calc(72px * var(--layout-scale, 1));
    height: calc(92px * var(--layout-scale, 1));
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pile-card-stack {
    position: absolute;
    top: 50%;
    left: 50%;
    margin-top: calc(-36px * var(--layout-scale, 1));
    margin-left: calc(-26px * var(--layout-scale, 1));
    width: calc(52px * var(--layout-scale, 1));
    height: calc(72px * var(--layout-scale, 1));
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

  /* Empty discard pile placeholder — thicker dashed border */
  .pile-card-stack.pile-empty {
    border-width: 3px !important;
    border-style: dashed !important;
  }

  .pile-count-label {
    font-size: calc(26px * var(--layout-scale, 1));
    font-weight: 800;
    color: #f8fafc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.8);
    text-align: center;
    width: 100%;
    align-self: stretch;
    display: block;
  }

  .reshuffle-fly-zone {
    position: absolute;
    bottom: calc(calc(200px * var(--layout-scale, 1)) + 2vh);
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
     Landscape three-strip layout:
       Arena (top ~65%)   — Phaser canvas + enemy (CENTERED) + overlay UI
       Stats bar (36px)   — AP | Block | HP bar
       Card hand (~27vh)  — 5 cards flat row (rendered by CardHand)
     Portrait mode UNCHANGED.
     ══════════════════════════════════════════════════════════ */

  /* In landscape, reduce the bottom gradient so arena is more visible */
  .layout-landscape {
    background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 10%, transparent 30%);
  }

  /* Hide portrait-mode AP orb, block badge, and HP strip in landscape
     (replaced by the .landscape-stats-bar below) */
  .layout-landscape .ap-orb,
  .layout-landscape .player-status-strip {
    display: none;
  }

  /* AR-243: Hide combat-overlay relic tray in landscape — relics now in top bar */
  :global(.layout-landscape .relic-tray) {
    display: none !important;
  }

  /* Enemy name row: top-center of arena, offset below the persistent top bar */
  .layout-landscape .enemy-name-row {
    position: fixed;
    top: 6.5vh;
    left: 0;
    right: 0;
    transform: none;
    justify-content: center;
  }

  .layout-landscape .enemy-name-header {
    text-align: center;
  }

  .layout-landscape .enemy-dialogue {
    top: 11.2vh;
    max-width: calc(240px * var(--layout-scale, 1));
  }

  /* Intent bubble: upper-left of enemy sprite (sprite centered at 50% X, 45% Y) */
  .layout-landscape .enemy-intent-bubble {
    position: fixed;
    top: 28%;
    right: auto;
    left: 25%;
    bottom: auto;
    transform: translateX(-100%);
    transition: left 350ms cubic-bezier(0.33, 1, 0.68, 1), top 350ms cubic-bezier(0.33, 1, 0.68, 1);
    min-width: calc(90px * var(--layout-scale, 1));
  }

  /* Quiz-active landscape: enemy slides to right ~72% — reposition overlay elements to match */
  .layout-landscape.quiz-active .enemy-name-row {
    left: 58%;
    right: 0;
    transform: none;
    justify-content: center;
  }

  .layout-landscape.quiz-active .enemy-name-header {
    text-align: center;
  }

  .layout-landscape.quiz-active .enemy-intent-bubble {
    left: 47%;
    right: auto;
    top: 28%;
    transform: translateX(-100%);
  }

  :global(.layout-landscape.quiz-active .status-effect-bar-enemy) {
    left: 58%;
    right: 0;
    transform: scale(0.8);
    transform-origin: center top;
    top: 16vh;
    justify-content: center;
  }

  /* Pile indicators: bottom-left/right, just above card hand strip in landscape */
  .layout-landscape .draw-pile-indicator {
    position: fixed;
    bottom: 27.2vh;
    left: calc(16px * var(--layout-scale, 1));
    right: auto;
    transform: scale(0.85);
    transform-origin: bottom left;
  }

  .layout-landscape .discard-pile-indicator {
    position: fixed;
    bottom: 27.2vh;
    right: calc(16px * var(--layout-scale, 1));
    left: auto;
    transform: scale(0.85);
    transform-origin: bottom right;
  }

  /* End turn button: bottom-LEFT, just above card hover tooltip */
  .layout-landscape .end-turn-btn {
    position: fixed;
    bottom: calc(16px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
    right: auto;
    transform: none;
    height: calc(46px * var(--layout-scale, 1));
    font-size: calc(15px * var(--layout-scale, 1));
    min-width: calc(120px * var(--layout-scale, 1));
    z-index: 26; /* above .quiz-backdrop (25) so End Turn stays visible during quiz */
  }

  /* Combo counter: stacked above End Turn on the right side of arena */
  :global(.layout-landscape .combo-counter) {
    position: fixed;
    bottom: 45.3vh;
    right: calc(16px * var(--layout-scale, 1));
    left: auto;
    top: auto;
    transform: none;
  }

  /* Status effect bars — enemy: below HP bar */
  :global(.layout-landscape .status-effect-bar-enemy) {
    position: fixed;
    top: 18vh;
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    bottom: auto;
  }

  /* Status effect bars — player: just above the card hand strip (which is at 27vh from bottom) */
  :global(.layout-landscape .status-effect-bar-player) {
    position: fixed;
    bottom: 32.6vh;
    left: 15%;
    right: auto;
    top: auto;
    transform: none;
  }

  /* Tighten status effect icon containers in landscape */
  :global(.layout-landscape .status-effect-bar-player .status-icon-wrapper) {
    padding: calc(2px * var(--layout-scale, 1));
  }

  /* Enemy power badges are now inline in .enemy-name-row — no fixed position override needed.
     Landscape: badges follow the name row naturally via flex layout. */

  /* Must-charge tooltip: above center of hand strip */
  .layout-landscape .must-charge-tooltip {
    bottom: 39.2vh;
  }

  /* AR-124: Tutorial tooltips */
  .tutorial-tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.85);
    color: #f0e6d2;
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    max-width: calc(260px * var(--layout-scale, 1));
    z-index: 9999;
    pointer-events: none;
    text-align: center;
    line-height: 1.4;
    border: 1px solid rgba(240, 230, 210, 0.2);
  }


  /* Charge tutorial: above the card hand */
  .tutorial-charge-tooltip {
    bottom: calc(230px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
  }

  /* Comparison banner: top of combat area */
  .tutorial-comparison-banner {
    position: fixed;
    top: calc(60px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.88);
    color: #f0e6d2;
    padding: calc(10px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    max-width: calc(320px * var(--layout-scale, 1));
    width: max-content;
    z-index: 9999;
    pointer-events: none;
    text-align: center;
    line-height: 1.4;
    border: 1px solid rgba(240, 230, 210, 0.25);
  }

  /* Landscape adjustments for tutorial tooltips */

  .layout-landscape .tutorial-charge-tooltip {
    bottom: 39.2vh;
  }

  .layout-landscape .tutorial-comparison-banner {
    top: calc(8px * var(--layout-scale, 1));
  }

  /* ── Landscape stats bar ────────────────────────────────── */
  .landscape-stats-bar {
    display: none; /* hidden in portrait */
  }

  .layout-landscape .landscape-stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: 32vh;
    left: 0;
    right: 0;
    height: calc(36px * var(--layout-scale, 1));
    padding: 0;
    background: transparent;
    z-index: 15;
  }

  /* Quiz backdrop scrim — dims the Phaser canvas behind the quiz panel */
  .quiz-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 25;
    pointer-events: none;
    animation: scrim-fade-in 200ms ease-out;
  }

  @keyframes scrim-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* §7: Quiz wrapper — transparent passthrough; Svelte out:fade applies opacity on exit */
  .quiz-wrapper {
    display: contents;
  }

  /* Combat quiz settings moved into CardExpanded.svelte */

  /* M-3: Backdrop cancel hint — visible cue that tapping the backdrop cancels selection */
  .backdrop-cancel-hint {
    position: fixed;
    top: 30%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    color: rgba(255, 255, 255, 0.85);
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 600;
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: 20px;
    pointer-events: none;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  /* M-19: Not enough AP tooltip */
  .not-enough-ap-tooltip {
    position: fixed;
    bottom: calc(220px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 15, 5, 0.92);
    color: #fca5a5;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 calc(10px * var(--layout-scale, 1)) rgba(239, 68, 68, 0.3);
    pointer-events: none;
    z-index: 200;
    white-space: nowrap;
  }

  /* M-20: HP critical text pulse */
  .hp-critical-text {
    color: #ef4444;
    animation: hpCriticalPulse 1.2s infinite ease-in-out;
  }

  /* L-13: End Turn dim when AP remains */
  .end-turn-btn.has-ap-remaining {
    opacity: 0.6;
  }

  /* L-1: Intent pulse on content change (triggered by {#key} remount) */
  @keyframes intentPulse {
    0% { opacity: 0; transform: scale(0.92); }
    100% { opacity: 1; transform: scale(1); }
  }

  .enemy-intent-bubble {
    animation: intentPulse 300ms ease-out;
  }

  /* Reshuffle label */
  .reshuffle-label {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: calc(11px * var(--layout-scale, 1));
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
    pointer-events: none;
  }

  /* AR-113: Mastery upgrade/downgrade popups */
  .mastery-popup {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(22px * var(--layout-scale, 1));
    font-weight: 900;
    letter-spacing: 0.05em;
    pointer-events: none;
    animation: masteryPopupAnim 1.2s ease-out forwards;
  }

  .mastery-popup-upgrade {
    color: #4ade80;
    text-shadow: 0 0 12px rgba(74, 222, 128, 0.8), 0 0 24px rgba(34, 197, 94, 0.4), 0 2px 4px rgba(0,0,0,0.8);
  }

  .mastery-popup-downgrade {
    color: #f87171;
    text-shadow: 0 0 12px rgba(248, 113, 113, 0.8), 0 0 24px rgba(239, 68, 68, 0.4), 0 2px 4px rgba(0,0,0,0.8);
  }

  @keyframes masteryPopupAnim {
    0% { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.8); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.15); }
    30% { transform: translateX(-50%) translateY(0) scale(1); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.95); }
  }

</style>
