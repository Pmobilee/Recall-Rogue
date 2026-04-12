/**
 * Tutorial step definitions for the reactive tutorial overlay system.
 *
 * Steps are pure data — no imports beyond types. The tutorialService evaluates
 * these predicates against live TutorialContext objects to determine what to show
 * and when to advance. The UI layer renders the active step's message anchored
 * to the element identified by anchor.target (matched via data-tutorial-anchor="xxx").
 */

export type TutorialMode = 'combat' | 'study'

/** Describes where the tutorial tooltip should appear relative to a DOM anchor. */
export interface TutorialAnchor {
  /** Maps to data-tutorial-anchor="xxx" on the target DOM element. */
  target: string
  position: 'above' | 'below' | 'left' | 'right' | 'center'
}

/**
 * Snapshot of game state passed into tutorial predicates each evaluation cycle.
 * The UI layer is responsible for building this from its live reactive state.
 */
export interface TutorialContext {
  // Enemy
  enemyName: string | null
  /** Enemy category: 'common' | 'elite' | 'mini_boss' | 'boss' */
  enemyCategory: string | null
  // Player state
  playerHp: number
  playerMaxHp: number
  playerBlock: number
  apCurrent: number
  apMax: number
  // Hand
  handSize: number
  // Turn
  turnNumber: number
  encounterTurnNumber: number
  /** Current phase: 'player_action' | 'enemy_turn' | etc. */
  phase: string | null
  cardsPlayedThisTurn: number
  cardsCorrectThisTurn: number
  // Chain
  chainLength: number
  isSurgeTurn: boolean
  // Selected card
  /** Card type of the currently selected card: 'attack' | 'shield' | etc. */
  selectedCardType: string | null
  selectedCardApCost: number | null
  /** Card play stage: 'hand' | 'selected' | 'committed' */
  cardPlayStage: string | null
  quizVisible: boolean
  // Tracking what has happened this session
  hasPlayedQuickPlay: boolean
  hasPlayedCharge: boolean
  hasAnsweredWrong: boolean
  // Onboarding flags (read from OnboardingState)
  hasSeenCombatTutorial: boolean
  hasSeenStudyTutorial: boolean
  // Mode
  mode: TutorialMode
  // Enemy intent
  /** Intent type: 'attack' | 'defend' | 'buff' | etc. */
  enemyIntentType: string | null
  enemyIntentValue: number | null
  // Study-specific
  studyQuestionsAnswered: number
  studySessionComplete: boolean
}

/** A single tutorial step definition. */
export interface TutorialStep {
  id: string
  mode: TutorialMode
  anchor: TutorialAnchor
  /** Returns display text, or null to skip this step entirely. */
  getMessage: (ctx: TutorialContext) => string | null
  /** Returns true when this step should activate. */
  showWhen: (ctx: TutorialContext) => boolean
  /** Returns true when the player has demonstrated understanding — step auto-completes. */
  doneWhen: (ctx: TutorialContext) => boolean
  /** Auto-hide when doneWhen fires (vs requiring manual "Got it" click). */
  autoDismiss: boolean
  /** Minimum ms to display before advancing (prevents flicker). */
  minDisplayMs: number
  /** Auto-dismiss after this many ms even if doneWhen never fires. */
  maxDisplayMs?: number
  /** Whether to dim the background around the anchor target. */
  spotlight: boolean
}

/**
 * Combat tutorial steps, shown in priority order.
 * Steps are evaluated sequentially — the first whose showWhen fires (and hasn't been
 * completed) is shown. Steps are designed to be non-blocking: the game plays normally
 * while they display.
 */
export const COMBAT_TUTORIAL_STEPS: TutorialStep[] = [
  // 1. Enemy intro — orient player to who they're fighting
  {
    id: 'enemy_intro',
    mode: 'combat',
    anchor: { target: 'enemy-sprite', position: 'below' },
    getMessage: (ctx) =>
      ctx.enemyName ? `${ctx.enemyName} blocks your path. Defeat them to advance deeper.` : null,
    showWhen: (ctx) =>
      ctx.encounterTurnNumber === 1 &&
      ctx.phase === 'player_action' &&
      ctx.cardsPlayedThisTurn === 0,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.encounterTurnNumber > 1,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 10000,
    spotlight: false,
  },
  // 2. Hand intro — explain card hand and AP resource
  {
    id: 'hand_intro',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: (ctx) =>
      `Your cards. Each costs AP to play — you have ${ctx.apMax} AP this turn.`,
    showWhen: (ctx) =>
      ctx.encounterTurnNumber === 1 &&
      ctx.phase === 'player_action' &&
      ctx.cardPlayStage === 'hand' &&
      ctx.cardsPlayedThisTurn === 0,
    doneWhen: (ctx) => ctx.cardPlayStage === 'selected' || ctx.cardsPlayedThisTurn > 0,
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 12000,
    spotlight: true,
  },
  // 3. Tap a card — guide player to interact with their hand
  {
    id: 'tap_card',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: () => 'Tap a card to select it.',
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.cardPlayStage === 'hand' &&
      ctx.cardsPlayedThisTurn === 0 &&
      ctx.encounterTurnNumber <= 2,
    doneWhen: (ctx) => ctx.cardPlayStage === 'selected' || ctx.cardsPlayedThisTurn > 0,
    autoDismiss: true,
    minDisplayMs: 1000,
    maxDisplayMs: 15000,
    spotlight: false,
  },
  // 4. Card selected — explain Quick Play vs Charge before they commit
  {
    id: 'card_selected',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: (ctx) => {
      const type = ctx.selectedCardType ?? 'card'
      const cost = ctx.selectedCardApCost ?? 1
      return `This ${type} costs ${cost} AP. Tap again to Quick Play, or hold/swipe up to Charge.`
    },
    showWhen: (ctx) =>
      ctx.cardPlayStage === 'selected' && !ctx.hasPlayedQuickPlay && !ctx.hasPlayedCharge,
    doneWhen: (ctx) =>
      ctx.cardPlayStage !== 'selected' || ctx.hasPlayedQuickPlay || ctx.hasPlayedCharge,
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 15000,
    spotlight: false,
  },
  // 5. Charge explain — quiz panel has appeared, explain the mechanic
  {
    id: 'charge_explain',
    mode: 'combat',
    anchor: { target: 'quiz-panel', position: 'left' },
    getMessage: () => 'Charge powers up the card — answer correctly for 1.5x damage!',
    showWhen: (ctx) => ctx.quizVisible && !ctx.hasPlayedCharge,
    doneWhen: (ctx) => !ctx.quizVisible || ctx.hasPlayedCharge,
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 20000,
    spotlight: false,
  },
  // 6. Wrong answer reassurance — player fumbled their first charge
  {
    id: 'quiz_wrong_ok',
    mode: 'combat',
    anchor: { target: 'screen-center', position: 'center' },
    getMessage: () =>
      "Wrong answers still play the card at reduced power. You're never stuck.",
    showWhen: (ctx) => ctx.hasAnsweredWrong && ctx.phase === 'player_action',
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 1 || ctx.encounterTurnNumber > 1,
    autoDismiss: true,
    minDisplayMs: 2500,
    maxDisplayMs: 8000,
    spotlight: false,
  },
  // 7. Quick play explain — player went for speed over power
  {
    id: 'quick_play_explain',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: () => 'Quick Play skips the quiz for base damage. Handy when AP is tight.',
    showWhen: (ctx) =>
      ctx.hasPlayedQuickPlay && !ctx.hasPlayedCharge && ctx.phase === 'player_action',
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 1 || ctx.encounterTurnNumber > 1,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 8000,
    spotlight: false,
  },
  // 8. AP running low — nudge toward end turn or tight budgeting
  {
    id: 'ap_running_low',
    mode: 'combat',
    anchor: { target: 'ap-indicator', position: 'left' },
    getMessage: (ctx) => `${ctx.apCurrent} AP left. Budget wisely — or end your turn.`,
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.apCurrent > 0 &&
      ctx.apCurrent < ctx.apMax &&
      ctx.cardsPlayedThisTurn > 0,
    doneWhen: (ctx) => ctx.apCurrent === 0 || ctx.phase !== 'player_action',
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 8000,
    spotlight: false,
  },
  // 9. End turn prompt — hand or AP exhausted, player should end turn
  {
    id: 'end_turn_prompt',
    mode: 'combat',
    anchor: { target: 'end-turn-btn', position: 'above' },
    getMessage: () => 'Done playing cards? Hit End Turn. The enemy moves next.',
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      (ctx.apCurrent === 0 || ctx.handSize === 0) &&
      ctx.cardsPlayedThisTurn > 0,
    doneWhen: (ctx) => ctx.phase !== 'player_action',
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 10000,
    spotlight: true,
  },
  // 10. Enemy turn explanation — first time the enemy attacks
  {
    id: 'enemy_turn_explain',
    mode: 'combat',
    anchor: { target: 'enemy-sprite', position: 'below' },
    getMessage: (ctx) =>
      ctx.enemyName
        ? `${ctx.enemyName} attacks! Shield cards absorb damage before it hits your HP.`
        : 'The enemy attacks! Shield cards absorb damage before it hits your HP.',
    showWhen: (ctx) => ctx.phase === 'enemy_turn' && ctx.encounterTurnNumber <= 2,
    doneWhen: (ctx) => ctx.phase === 'player_action' && ctx.encounterTurnNumber > 1,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 6000,
    spotlight: false,
  },
  // 11. Enemy intent reading — second turn, player can now plan around it
  {
    id: 'enemy_intent_read',
    mode: 'combat',
    anchor: { target: 'enemy-intent', position: 'below' },
    getMessage: () =>
      "Watch the enemy's intent — it shows what they'll do next. Plan around it.",
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.encounterTurnNumber === 2 &&
      ctx.cardsPlayedThisTurn === 0 &&
      ctx.enemyIntentType != null,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.encounterTurnNumber > 2,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 10000,
    spotlight: false,
  },
  // 12. Chain intro — player has built a chain, explain the bonus
  {
    id: 'chain_intro',
    mode: 'combat',
    anchor: { target: 'chain-counter', position: 'left' },
    getMessage: (ctx) =>
      `Chain x${ctx.chainLength}! Consecutive correct charges multiply your damage.`,
    showWhen: (ctx) => ctx.chainLength >= 2 && ctx.phase === 'player_action',
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.chainLength === 0,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 8000,
    spotlight: false,
  },
  // 13. Surge intro — surge turn grants bonus AP
  {
    id: 'surge_intro',
    mode: 'combat',
    anchor: { target: 'surge-border', position: 'center' },
    getMessage: () => 'Surge turn! You get +1 bonus AP.',
    showWhen: (ctx) =>
      ctx.isSurgeTurn && ctx.phase === 'player_action' && ctx.cardsPlayedThisTurn === 0,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || !ctx.isSurgeTurn,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 6000,
    spotlight: false,
  },
]

/**
 * Study Temple tutorial steps, shown in priority order.
 * Covers the FSRS study loop from first question through session completion.
 */
export const STUDY_TUTORIAL_STEPS: TutorialStep[] = [
  // 1. Study intro — orient the player to the temple
  {
    id: 'study_intro',
    mode: 'study',
    anchor: { target: 'screen-center', position: 'center' },
    getMessage: () =>
      'Study Temple strengthens your knowledge. Cards you master here power up in combat.',
    showWhen: (ctx) => ctx.studyQuestionsAnswered === 0,
    doneWhen: (ctx) => ctx.studyQuestionsAnswered > 0,
    autoDismiss: true,
    minDisplayMs: 2500,
    maxDisplayMs: 12000,
    spotlight: false,
  },
  // 2. Study card — direct player to the question card
  {
    id: 'study_card',
    mode: 'study',
    anchor: { target: 'study-card', position: 'above' },
    getMessage: () => 'Read the question and pick your answer.',
    showWhen: (ctx) => ctx.studyQuestionsAnswered === 0,
    doneWhen: (ctx) => ctx.studyQuestionsAnswered > 0,
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 20000,
    spotlight: false,
  },
  // 3. Study answer explanation — after the first correct or wrong answer
  {
    id: 'study_answer',
    mode: 'study',
    anchor: { target: 'study-answers', position: 'below' },
    getMessage: () =>
      'Correct answers build mastery. Wrong answers help the system learn what to review.',
    showWhen: (ctx) => ctx.studyQuestionsAnswered === 1,
    doneWhen: (ctx) => ctx.studyQuestionsAnswered > 1,
    autoDismiss: true,
    minDisplayMs: 2500,
    maxDisplayMs: 10000,
    spotlight: false,
  },
  // 4. FSRS explanation — spaced repetition adapts to the player
  {
    id: 'study_fsrs',
    mode: 'study',
    anchor: { target: 'screen-center', position: 'center' },
    getMessage: () =>
      'Cards you struggle with appear more often. The system adapts to how you learn.',
    showWhen: (ctx) => ctx.studyQuestionsAnswered >= 3 && !ctx.studySessionComplete,
    doneWhen: (ctx) => ctx.studyQuestionsAnswered > 3,
    autoDismiss: true,
    minDisplayMs: 2500,
    maxDisplayMs: 10000,
    spotlight: false,
  },
  // 5. Session complete — wrap-up message
  {
    id: 'study_done',
    mode: 'study',
    anchor: { target: 'screen-center', position: 'center' },
    getMessage: () => 'Good session. Your mastery carries into combat runs.',
    showWhen: (ctx) => ctx.studySessionComplete,
    doneWhen: () => true,
    autoDismiss: true,
    minDisplayMs: 3000,
    maxDisplayMs: 8000,
    spotlight: false,
  },
]
