/**
 * Playwright Game Bot — Types
 *
 * Bot profiles and game state types for the live browser-based game bot.
 * This replaces the headless combat simulator for balance testing by driving
 * the real game through the browser DOM.
 */

/** Strategy level for the bot's decision making. */
export type StrategyLevel = 'basic' | 'intermediate' | 'optimal';

/** Bot player profile — same concept as mass-simulate profiles. */
export interface BotProfile {
  id: string;
  name: string;
  /** Quiz accuracy: probability of picking the correct answer (0-1). */
  quizAccuracy: number;
  /** Strategy level for card selection and room choice. */
  strategy: StrategyLevel;
  /** Probability of choosing to Charge a card vs Quick Play (0-1). */
  chargeRate: number;
  /** Probability of charging on Surge turns (0-1). */
  surgeChargeRate: number;
}

/** Game state read from the browser via window.__terraDebug() and window.__terraPlay. */
export interface GameState {
  currentScreen: string;
  playerHP: number;
  playerMaxHP: number;
  playerGold: number;
  enemyHP: number;
  enemyMaxHP: number;
  enemyName: string;
  handSize: number;
  apCurrent: number;
  apMax: number;
  turnNumber: number;
  comboCount: number;
  relicCount: number;
  floor: number;
  isGameOver: boolean;
  runResult: 'victory' | 'defeat' | null;
  chainLength: number;
  chainMultiplier: number;
}

/** Quiz state read from window.__terraPlay.getQuiz(). */
export interface QuizState {
  question: string;
  choices: string[];
  correctIndex: number;
  mode: string;
}

/** Stats collected from a single bot run. */
export interface BotRunStats {
  // Run identification
  profile: string;
  seed: number;
  result: 'victory' | 'defeat' | 'error' | 'timeout';

  // Core metrics
  finalFloor: number;
  finalHP: number;
  finalMaxHP: number;
  totalTurns: number;
  totalCardsPlayed: number;
  totalCharges: number;
  totalQuickPlays: number;
  quizCorrect: number;
  quizWrong: number;
  durationMs: number;
  errors: string[];

  // Economy
  goldEarned: number;
  goldSpent: number;
  finalGold: number;

  // Relics
  relicsEarned: string[];   // IDs of relics picked up during run (backwards compat)
  finalRelicCount: number;

  // Rooms visited
  roomsVisited: { type: string; count: number }[];
  totalRoomsVisited: number;
  segmentsCompleted: number;

  // Combat details
  encountersWon: number;
  encountersLost: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  avgTurnsPerEncounter: number;

  // Deck
  finalDeckSize: number;
  cardsAdded: number;
  cardsRemoved: number;

  // Chain/combo performance
  maxChainLength: number;
  maxCombo: number;

  // Death info (if defeat)
  deathFloor: number;
  deathEnemy: string;
  deathHP: number;

  // Screen transition log (last 50)
  screenLog: Array<{ time: number; screen: string }>;

  // Per-encounter log (enriched — encountersWon/Lost kept for backwards compat)
  encounters: Array<{
    enemyName: string;
    floor: number;
    result: 'won' | 'lost';
    turns: number;
    damageDealt: number;
    damageTaken: number;
    cardsPlayed: number;
    chargesUsed: number;
    quickPlays: number;
    maxChain: number;
    playerHpStart: number;
    playerHpEnd: number;
  }>;

  // Per-card-type stats
  cardTypeStats: Record<string, { played: number; charged: number; quickPlayed: number }>;

  // Chain performance (enriched)
  totalChains: number;        // number of chains started (length >= 2)
  avgChainLength: number;

  // Domain accuracy (from RunState.domainAccuracy)
  domainAccuracy: Record<string, { answered: number; correct: number }>;

  // Shop/upgrade tracking
  cardsUpgraded: number;
  cardsRemovedAtShop: number;
  haggleAttempts: number;
  haggleSuccesses: number;

  // Relic details (enriched - replaces the broken relicsEarned string[])
  relicDetails: Array<{
    definitionId: string;
    acquiredAtFloor: number;
    triggerCount: number;
  }>;

  // Question tier breakdown
  questionsAnswered: number;
  questionsCorrect: number;
  novelQuestionsAnswered: number;
  novelQuestionsCorrect: number;

  // Bounties
  bountiesCompleted: string[];
}

/**
 * Predefined bot profiles.
 *
 * Charge rates are calibrated to each profile's quiz accuracy.
 * Charging costs +1 AP and breaks even at ~56% accuracy.
 * Smart players charge MORE when accuracy is high, LESS when low.
 * Surge turns (every 3rd) remove the +1 AP surcharge, so surgeChargeRate is always higher.
 */
export const BOT_PROFILES: Record<string, BotProfile> = {
  first_timer: {
    id: 'first_timer',
    name: 'First Timer',
    quizAccuracy: 0.45,
    strategy: 'basic',
    chargeRate: 0.10,       // Below breakeven — barely charges (wastes AP)
    surgeChargeRate: 0.50,  // Surge = free charge, so worth trying
  },
  casual_learner: {
    id: 'casual_learner',
    name: 'Casual Learner',
    quizAccuracy: 0.65,
    strategy: 'basic',
    chargeRate: 0.35,       // Above breakeven — moderate charging is +EV
    surgeChargeRate: 0.75,
  },
  regular: {
    id: 'regular',
    name: 'Regular',
    quizAccuracy: 0.62,
    strategy: 'intermediate',
    chargeRate: 0.30,       // Just above breakeven — cautious charging
    surgeChargeRate: 0.80,
  },
  gamer: {
    id: 'gamer',
    name: 'Gamer',
    quizAccuracy: 0.55,
    strategy: 'optimal',
    chargeRate: 0.20,       // Near breakeven — smart gamer barely charges outside surge
    surgeChargeRate: 0.90,  // But always charges on free surge turns
  },
  dedicated: {
    id: 'dedicated',
    name: 'Dedicated',
    quizAccuracy: 0.70,
    strategy: 'optimal',
    chargeRate: 0.55,       // Solidly above breakeven — charging is profitable
    surgeChargeRate: 0.95,
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    quizAccuracy: 0.82,
    strategy: 'optimal',
    chargeRate: 0.75,       // Well above breakeven — charge most of the time
    surgeChargeRate: 1.0,
  },
};
