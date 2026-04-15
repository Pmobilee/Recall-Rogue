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
  // Tutorial-expanded fields (optional for backward compat with legacy TutorialContext builders)
  enemyPassives?: string[]
  relicCount?: number
  fogLevel?: number | null
  fogState?: 'brain_fog' | 'neutral' | 'flow_state' | null
  drawPileCount?: number
  discardPileCount?: number
  musicCategory?: string | null
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
  /** When true, fires immediately when cursor reaches it, regardless of showWhen. */
  proactive?: boolean
  /** When true, the spotlight overlay blocks game input until "Got it" is clicked. */
  blockInput?: boolean
}

/**
 * Combat tutorial steps, evaluated sequentially by a step cursor.
 * Proactive steps fire immediately when the cursor reaches them; reactive steps
 * wait for showWhen to become true. Steps that return null from getMessage are
 * skipped entirely (e.g. no enemy passives present).
 */
export const COMBAT_TUTORIAL_STEPS: TutorialStep[] = [
  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — Combat Start (proactive, fires immediately)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'enemy_intro',
    mode: 'combat',
    anchor: { target: 'enemy-sprite', position: 'below' },
    proactive: true,
    getMessage: (ctx) =>
      ctx.enemyName
        ? `You are facing ${ctx.enemyName}. Defeat them to advance deeper into the dungeon.`
        : null,
    showWhen: (ctx) => ctx.encounterTurnNumber === 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    // enemy-sprite is a Phaser canvas element — no DOM node to spotlight
    spotlight: false,
  },

  {
    id: 'enemy_passive_intro',
    mode: 'combat',
    anchor: { target: 'enemy-power-badges', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) => {
      if (!ctx.enemyPassives || ctx.enemyPassives.length === 0) return null
      const passive = ctx.enemyPassives[0]
      return `${ctx.enemyName ?? 'This enemy'} has a special ability: ${passive}. Keep this in mind as you play your cards.`
    },
    showWhen: (ctx) => ctx.encounterTurnNumber === 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'enemy_intent_intro',
    mode: 'combat',
    anchor: { target: 'enemy-intent', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) => {
      const intentMap: Record<string, string> = {
        attack: `deal ${ctx.enemyIntentValue ?? '?'} damage to you. Play Shield cards to block it`,
        defend: `gain ${ctx.enemyIntentValue ?? '?'} block. Use Attack cards to deal damage while they turtle`,
        buff: 'gain a stat boost. Hit hard with Attack cards before they power up',
        debuff: 'weaken you with a status effect. Play Shield cards and strike back',
        heal: 'recover HP. Push damage with Attack cards now',
        charge: 'charge up a powerful attack. Play Shield cards to survive it',
        multi_attack: `hit you multiple times for ${ctx.enemyIntentValue ?? '?'} each. Shield cards are critical here`,
      }
      const intentDesc = ctx.enemyIntentType
        ? (intentMap[ctx.enemyIntentType] ?? 'take an action')
        : 'take an action'
      return `That icon shows the enemy's next move. They intend to ${intentDesc}.`
    },
    showWhen: (ctx) =>
      ctx.encounterTurnNumber === 1 &&
      ctx.phase === 'player_action' &&
      ctx.enemyIntentType != null,
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'hand_intro',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'These are your cards. There are two ways to play them: Quick Play (tap again for base damage, no quiz) or Charge (drag upward to answer a question for 1.5x power).',
    showWhen: (ctx) => ctx.encounterTurnNumber === 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'ap_intro',
    mode: 'combat',
    anchor: { target: 'ap-indicator', position: 'left' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) =>
      `This is your AP. You have ${ctx.apCurrent} Action Points to spend this turn. Each card costs AP to play. When you run out, end your turn.`,
    showWhen: (ctx) => ctx.encounterTurnNumber === 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — First Card Play: Quick Play only
  // ═══════════════════════════════════════════════════════════

  {
    id: 'tap_card_prompt',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: () => 'Go ahead — tap any card to select it.',
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.cardPlayStage === 'hand' &&
      ctx.cardsPlayedThisTurn === 0 &&
      ctx.encounterTurnNumber <= 2,
    doneWhen: (ctx) => ctx.cardPlayStage === 'selected' || ctx.cardsPlayedThisTurn > 0,
    autoDismiss: true,
    minDisplayMs: 500,
    maxDisplayMs: 60000,
    // card-hand is a DOM element — spotlight guides the player to the right area
    spotlight: true,
  },

  {
    id: 'card_selected_qp',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: (ctx) => {
      const type = ctx.selectedCardType ?? 'card'
      const cost = ctx.selectedCardApCost ?? 1
      return `You selected a ${type} card (${cost} AP). Tap it AGAIN to Quick Play — instant base damage, no quiz. Try it now.`
    },
    showWhen: (ctx) =>
      ctx.cardPlayStage === 'selected' &&
      !ctx.hasPlayedQuickPlay &&
      !ctx.hasPlayedCharge,
    doneWhen: (ctx) =>
      ctx.hasPlayedQuickPlay || ctx.hasPlayedCharge || ctx.cardsPlayedThisTurn > 0,
    autoDismiss: true,
    minDisplayMs: 1000,
    maxDisplayMs: 60000,
    spotlight: true,
  },

  {
    id: 'post_quick_play',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) => {
      if (ctx.hasPlayedCharge) {
        // Player charged instead of QP — that's fine, adapt
        return ctx.hasAnsweredWrong
          ? 'You Charged and answered wrong — the card still played at reduced power. You are never stuck. Now try Quick Play on your next card — tap a card twice.'
          : 'You Charged and answered correctly — 1.5x damage! Now try Quick Play on your next card — just tap a selected card again for instant base damage.'
      }
      return 'Quick Play dealt base damage instantly. Fast and reliable — no quiz needed. Now try something more powerful: select another card and drag it UPWARD to Charge.'
    },
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 2b — Second Card Play: Charge
  // ═══════════════════════════════════════════════════════════

  {
    id: 'select_for_charge',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: (ctx) => {
      if (ctx.hasPlayedCharge) {
        // Already charged on first card — skip this, suggest QP instead
        return 'Select another card and tap it again to try Quick Play this time.'
      }
      return 'Select a card, then drag it UPWARD toward the top of the screen to Charge it.'
    },
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.cardPlayStage === 'hand' &&
      ctx.cardsPlayedThisTurn >= 1 &&
      ctx.encounterTurnNumber === 1,
    doneWhen: (ctx) => ctx.cardPlayStage === 'selected' || ctx.cardsPlayedThisTurn >= 2,
    autoDismiss: true,
    minDisplayMs: 500,
    maxDisplayMs: 60000,
    spotlight: true,
  },

  {
    id: 'charge_prompt',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    getMessage: (ctx) => {
      if (ctx.hasPlayedCharge) {
        return 'Tap the card again for Quick Play.'
      }
      return 'Now drag this card UPWARD to the top half of the screen to initiate a Charge. It costs +1 extra AP but gives 1.5x power if you answer correctly.'
    },
    showWhen: (ctx) =>
      ctx.cardPlayStage === 'selected' &&
      ctx.cardsPlayedThisTurn >= 1 &&
      ctx.encounterTurnNumber === 1,
    doneWhen: (ctx) =>
      ctx.cardPlayStage !== 'selected' || ctx.cardsPlayedThisTurn >= 2,
    autoDismiss: true,
    minDisplayMs: 1000,
    maxDisplayMs: 60000,
    spotlight: true,
  },

  {
    id: 'charge_explain',
    mode: 'combat',
    anchor: { target: 'quiz-panel', position: 'left' },
    getMessage: () =>
      'You initiated a Charge! Answer the question. Correct = 1.5x damage. Wrong = reduced power, but the card still plays. You are never stuck.',
    showWhen: (ctx) => ctx.quizVisible,
    doneWhen: (ctx) => !ctx.quizVisible,
    autoDismiss: true,
    minDisplayMs: 1500,
    maxDisplayMs: 20000,
    spotlight: true,
  },

  {
    id: 'post_charge',
    mode: 'combat',
    anchor: { target: 'card-hand', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) => {
      if (ctx.hasAnsweredWrong) {
        return 'Wrong answer — but the card still played at reduced power. You are never stuck. Now you know both Quick Play and Charge. Use whichever fits the situation.'
      }
      return 'Correct answer — 1.5x damage! Now you know both ways to play cards. Quick Play for speed, Charge for power. Choose based on the situation.'
    },
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 4 — UI Tour (proactive, after first card)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'draw_pile_intro',
    mode: 'combat',
    anchor: { target: 'draw-pile', position: 'right' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'Draw Pile — cards you have not drawn yet. You draw a fresh hand each turn. When it empties, your discard pile shuffles back in.',
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'discard_pile_intro',
    mode: 'combat',
    anchor: { target: 'discard-pile', position: 'left' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'Discard Pile — played cards land here. When your draw pile empties, the discard pile reshuffles automatically. Your deck cycles indefinitely.',
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'fog_meter_intro',
    mode: 'combat',
    anchor: { target: 'fog-wing-wrapper', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) => {
      if (ctx.fogLevel === null) return null
      return 'The Focus Meter. Answer questions correctly to stay in Flow State and draw extra cards. Too many wrong answers trigger Brain Fog — enemies hit harder. Stay sharp.'
    },
    showWhen: (ctx) =>
      ctx.cardsPlayedThisTurn >= 1 &&
      ctx.phase === 'player_action' &&
      ctx.fogLevel !== null,
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 5 — Turn Management (proactive)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'ap_status_reminder',
    mode: 'combat',
    anchor: { target: 'ap-indicator', position: 'left' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) =>
      `You have ${ctx.apCurrent} AP left. Play more cards or end your turn whenever you like — you do not have to spend every AP.`,
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 1 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 20000,
    spotlight: true,
  },

  {
    id: 'end_turn_prompt',
    mode: 'combat',
    anchor: { target: 'end-turn-btn', position: 'above' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'When you are done playing cards, tap End Turn. The enemy takes their action, then you draw a fresh hand.',
    showWhen: (ctx) => ctx.cardsPlayedThisTurn >= 1 && ctx.phase === 'player_action',
    doneWhen: (ctx) => ctx.phase !== 'player_action',
    autoDismiss: false,
    minDisplayMs: 1500,
    maxDisplayMs: 60000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 6 — Enemy Turn (reactive)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'enemy_attacks',
    mode: 'combat',
    anchor: { target: 'enemy-sprite', position: 'below' },
    getMessage: (ctx) =>
      `${ctx.enemyName ?? 'The enemy'} takes their turn! Shield cards you played absorb damage before it reaches your HP.`,
    showWhen: (ctx) => ctx.phase === 'enemy_turn' && ctx.encounterTurnNumber <= 2,
    doneWhen: (ctx) => ctx.phase === 'player_action' && ctx.encounterTurnNumber > 1,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 6000,
    // enemy-sprite is a Phaser canvas element — no DOM node to spotlight
    spotlight: false,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 7 — Turn 2+ contextual (reactive)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'intent_planning',
    mode: 'combat',
    anchor: { target: 'enemy-intent', position: 'above' },
    getMessage: (ctx) => {
      if (!ctx.enemyIntentType) return null
      const intentDescMap: Record<string, string> = {
        attack: `attacking for ${ctx.enemyIntentValue ?? '?'} — play Shield cards to absorb it`,
        defend: 'defending — push damage now while they are not attacking',
        buff: 'buffing — press hard before they grow stronger',
        debuff: 'planning to weaken you — plan your strongest Charges',
        heal: 'healing — hit hard now to counter it',
        charge: 'charging a big attack — shield up',
        multi_attack: `hitting you multiple times — shields are critical`,
      }
      const desc = intentDescMap[ctx.enemyIntentType] ?? 'preparing something'
      return `The enemy is ${desc}. Plan your cards around the intent icon every turn.`
    },
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.encounterTurnNumber === 2 &&
      ctx.cardsPlayedThisTurn === 0 &&
      ctx.enemyIntentType != null,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.encounterTurnNumber > 2,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 12000,
    spotlight: true,
  },

  {
    id: 'enemy_passive_reminder',
    mode: 'combat',
    anchor: { target: 'enemy-power-badges', position: 'above' },
    getMessage: (ctx) => {
      if (!ctx.enemyPassives || ctx.enemyPassives.length === 0) return null
      return `Remember: ${ctx.enemyName ?? 'This enemy'} has a passive — ${ctx.enemyPassives[0]}. Factor this into your Quick Play vs Charge decisions.`
    },
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.encounterTurnNumber === 2 &&
      ctx.cardsPlayedThisTurn === 0 &&
      (ctx.enemyPassives?.length ?? 0) > 0,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.encounterTurnNumber > 2,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 10000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE 8 — HUD Tour (proactive, turn 2+)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'deck_viewer_intro',
    mode: 'combat',
    anchor: { target: 'deck-btn', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'Tap the deck icon to view all cards in your current deck. Know what is coming and plan around your strongest cards.',
    showWhen: (ctx) => ctx.encounterTurnNumber >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'gold_intro',
    mode: 'combat',
    anchor: { target: 'gold-counter', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'Your gold. Earn it by defeating enemies. Spend it at shops between fights to buy new cards and relics.',
    showWhen: (ctx) => ctx.encounterTurnNumber >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'relics_intro',
    mode: 'combat',
    anchor: { target: 'relics-row', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: (ctx) =>
      (ctx.relicCount ?? 0) > 0
        ? `Your Relics — powerful permanent bonuses for the entire run. You have ${ctx.relicCount}. Collect more from shops and events.`
        : 'Relic slots — currently empty. Relics grant permanent bonuses for the entire run. Find them at shops, events, and boss rewards.',
    showWhen: (ctx) => ctx.encounterTurnNumber >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'music_intro',
    mode: 'combat',
    anchor: { target: 'music-widget', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'Music controls. Tap to expand — switch between Epic battle music and Lo-Fi study vibes, or toggle ambient sounds.',
    showWhen: (ctx) => ctx.encounterTurnNumber >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  {
    id: 'settings_intro',
    mode: 'combat',
    anchor: { target: 'pause-btn', position: 'below' },
    proactive: true,
    blockInput: true,
    getMessage: () =>
      'The gear icon pauses the game and opens settings. Adjust volume, text size, and more. You can also abandon the run from here.',
    showWhen: (ctx) => ctx.encounterTurnNumber >= 2 && ctx.phase === 'player_action',
    doneWhen: () => true,
    autoDismiss: false,
    minDisplayMs: 0,
    maxDisplayMs: 30000,
    spotlight: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Ongoing contextual (reactive, any turn)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'quiz_wrong_ok',
    mode: 'combat',
    anchor: { target: 'screen-center', position: 'center' },
    getMessage: () =>
      'Wrong answer — but the card still played at reduced power. You are never stuck. Wrong answers are a tempo cost, not a dead end.',
    showWhen: (ctx) =>
      ctx.hasAnsweredWrong && ctx.phase === 'player_action' && ctx.encounterTurnNumber <= 3,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 1 || ctx.encounterTurnNumber > 2,
    autoDismiss: true,
    minDisplayMs: 2500,
    maxDisplayMs: 8000,
    // screen-center is a full-screen pseudo-anchor — no specific DOM element to spotlight
    spotlight: false,
  },

  {
    id: 'ap_running_low',
    mode: 'combat',
    anchor: { target: 'ap-indicator', position: 'left' },
    getMessage: (ctx) =>
      `${ctx.apCurrent} AP remaining. Play what you can afford or end your turn.`,
    showWhen: (ctx) =>
      ctx.phase === 'player_action' &&
      ctx.apCurrent > 0 &&
      ctx.apCurrent < ctx.apMax &&
      ctx.cardsPlayedThisTurn > 1 &&
      ctx.encounterTurnNumber <= 3,
    doneWhen: (ctx) => ctx.apCurrent === 0 || ctx.phase !== 'player_action',
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 8000,
    spotlight: true,
  },

  {
    id: 'chain_intro',
    mode: 'combat',
    anchor: { target: 'chain-counter', position: 'left' },
    getMessage: (ctx) =>
      `Knowledge Chain x${ctx.chainLength}! Consecutive correct Charges in the same topic multiply your damage. Keep answering correctly to grow it.`,
    showWhen: (ctx) => ctx.chainLength >= 2 && ctx.phase === 'player_action',
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || ctx.chainLength === 0,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 8000,
    spotlight: true,
  },

  {
    id: 'surge_intro',
    mode: 'combat',
    anchor: { target: 'surge-border', position: 'center' },
    getMessage: () =>
      'Surge Turn! You gained +1 bonus AP. Surge turns occur every few turns — great for Charging expensive cards.',
    showWhen: (ctx) =>
      ctx.isSurgeTurn && ctx.phase === 'player_action' && ctx.cardsPlayedThisTurn === 0,
    doneWhen: (ctx) => ctx.cardsPlayedThisTurn > 0 || !ctx.isSurgeTurn,
    autoDismiss: true,
    minDisplayMs: 2000,
    maxDisplayMs: 6000,
    // surge-border is a full-screen CSS effect, not a specific DOM element to highlight
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
