/**
 * Tests for the handleEndTurn reentrancy guard in encounterBridge.
 *
 * Root cause (2026-04-18): handleEndTurn is async (two 1-second awaits for enemy
 * phase animations). During the awaits, the End Turn button remained enabled
 * because activeTurnState was set to a preAnimTurnState with phase='player_action'
 * and an empty hand — the button's phase check passed. Double-clicking or pressing
 * Enter during the enemy phase called handleEndTurn a second time while the first
 * call was suspended at an await, corrupting deck state (double-draw) and freezing
 * the game.
 *
 * Fix: module-level _endTurnInProgress boolean + endTurnInProgress writable store.
 * The boolean is the fast-path guard at the top of handleEndTurn. The store is the
 * reactive guard consumed by CardCombatOverlay's endTurnDisabled derived.
 *
 * These tests verify:
 * 1. endTurnInProgress is exported from encounterBridge.
 * 2. It is a Svelte writable store with a subscribe method.
 * 3. Its initial value is false.
 * 4. handleEndTurn is exported as an async function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all heavy dependencies so the module can be imported in Vitest ──────

vi.mock('svelte/store', () => {
  const store = <T>(init: T) => {
    let val = init;
    const subs: Array<(v: T) => void> = [];
    return {
      subscribe: vi.fn((fn: (v: T) => void) => { subs.push(fn); fn(val); return () => {}; }),
      set: vi.fn((v: T) => { val = v; subs.forEach(s => s(v)); }),
      update: vi.fn((fn: (v: T) => T) => { val = fn(val); subs.forEach(s => s(val)); }),
      _get: () => val,
    };
  };
  return {
    writable: vi.fn((init: unknown) => store(init)),
    readable: vi.fn((init: unknown) => store(init)),
    get: vi.fn((s: { _get: () => unknown }) => s._get?.() ?? null),
    derived: vi.fn((deps: unknown, fn: (v: unknown) => unknown) => store(fn(null))),
  };
});

vi.mock('./runStateStore', () => ({
  activeRunState: { subscribe: vi.fn(), set: vi.fn(), update: vi.fn(), _get: () => null },
}));
vi.mock('./turnManager', () => ({
  startEncounter: vi.fn(),
  playCardAction: vi.fn(),
  skipCard: vi.fn(),
  endPlayerTurn: vi.fn(() => ({ damageDealt: 0, playerDefeated: false, effectsApplied: [], executedIntentType: null, blockAbsorbedAll: false, turnState: { result: null, phase: 'player_action', enemy: { nextIntent: { telegraph: '', value: 0 }, currentHP: 10, block: 0, template: { id: 'test' } }, playerState: { hp: 10, maxHP: 10, shield: 0 }, deck: { hand: [], drawPile: [], discardPile: [], forgetPile: [] }, turnNumber: 2, chainLength: 0, chainType: null, playerDefeated: false, isSurge: false, encounterChargesTotal: 0, chargesCorrectThisEncounter: 0 } })),
  resolveInscription: vi.fn(),
  getActiveInscription: vi.fn(() => null),
  applyPendingChoice: vi.fn(),
  revertTransmutedCards: vi.fn(),
  resetFactLastSeenEncounter: vi.fn(),
}));
vi.mock('./chainSystem', () => ({
  initChainSystem: vi.fn(),
  resetChain: vi.fn(),
  decayChain: vi.fn(),
  extendOrResetChain: vi.fn(() => ({ didExtend: false })),
  getChainState: vi.fn(() => ({ length: 0, multiplier: 1, chainType: null })),
  getCurrentChainLength: vi.fn(() => 0),
  getActiveChainColor: vi.fn(() => null),
  getChainMultiplier: vi.fn(() => 1),
  rotateActiveChainColor: vi.fn(() => 0),
  switchActiveChainColor: vi.fn(),
  selectRunChainTypes: vi.fn(() => []),
}));
vi.mock('../data/chainTypes', () => ({ selectRunChainTypes: vi.fn(() => []) }));
vi.mock('./runPoolBuilder', () => ({
  buildRunPool: vi.fn(),
  recordRunFacts: vi.fn(),
}));
vi.mock('./deckManager', () => ({
  addCardToDeck: vi.fn(),
  createDeck: vi.fn(() => ({ hand: [], drawPile: [], discardPile: [], forgetPile: [], factCooldown: [], factPool: [], currentFloor: 1, hintsRemaining: 3 })),
  drawHand: vi.fn(),
  insertCardWithDelay: vi.fn(),
  addFactsToCooldown: vi.fn(),
  tickFactCooldowns: vi.fn(),
  getEncounterSeenFacts: vi.fn(() => []),
  resetEncounterSeenFacts: vi.fn(),
  forgetCard: vi.fn(),
  discardHand: vi.fn(() => []),
  playCard: vi.fn(),
}));
vi.mock('./enemyManager', () => ({
  createEnemy: vi.fn(() => ({ currentHP: 100, maxHP: 100, block: 0, statusEffects: [], template: { id: 'test', category: 'common', intentPool: [], phaseTransitionAt: null, onPlayerNoCharge: null }, nextIntent: { type: 'attack', value: 8, telegraph: '', bypassDamageCap: false }, phase: 1, floor: 1 })),
  snapshotEnemy: vi.fn(() => ({})),
  hydrateEnemyFromSnapshot: vi.fn(),
  applyEnemyDeltaToState: vi.fn(),
  rollNextIntent: vi.fn(() => ({ type: 'attack', value: 8, telegraph: '', bypassDamageCap: false })),
  executeEnemyIntent: vi.fn(() => ({ damage: 0, playerEffects: [], enemyHealed: 0, stunned: false, blockStripped: 0 })),
  applyDamageToEnemy: vi.fn(() => ({ defeated: false, newHP: 10 })),
  dispatchEnemyTurnStart: vi.fn(),
  getEnrageBonus: vi.fn(() => 0),
}));
vi.mock('../data/enemies', () => ({ ENEMY_TEMPLATES: {} }));
vi.mock('./floorManager', () => ({
  getBossForFloor: vi.fn(),
  pickCombatEnemy: vi.fn(),
  isBossFloor: vi.fn(() => false),
  isMiniBossEncounter: vi.fn(() => false),
  getMiniBossForFloor: vi.fn(),
  getRegionForFloor: vi.fn(() => 'dungeon'),
  getEnemiesForFloorNode: vi.fn(() => []),
  getActForFloor: vi.fn(() => 1),
}));
vi.mock('../ui/stores/playerData', () => ({
  applyMasteryTrialOutcome: vi.fn(),
  awardMasteryCoin: vi.fn(),
  getReviewStateByFactId: vi.fn(() => null),
  playerSave: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  updateReviewStateByButton: vi.fn(),
}));
vi.mock('../data/balance', () => ({
  HINTS_PER_ENCOUNTER: 3,
  POST_ENCOUNTER_HEAL_PCT: 0,
  RELAXED_POST_ENCOUNTER_HEAL_BONUS: 0,
  POST_BOSS_ENCOUNTER_HEAL_BONUS: 0,
  POST_ENCOUNTER_HEAL_CAP: { 1: 1, 2: 1, 3: 1, 4: 1 },
  getBalanceValue: vi.fn((_k: string, d: unknown) => d),
  STARTER_DECK_COMPOSITION: [],
  START_AP_PER_TURN: 3,
}));
vi.mock('./encounterRewards', () => ({ generateCurrencyReward: vi.fn(() => 0) }));
vi.mock('../data/relics/index', () => ({ RELIC_BY_ID: {} }));
vi.mock('./cardPreferences', () => ({
  onboardingState: { subscribe: vi.fn(), set: vi.fn(), _get: () => ({ hasCompletedOnboarding: true, hasSeenEndTurnTooltip: true }) },
  difficultyMode: { subscribe: vi.fn(), set: vi.fn(), _get: () => 'normal' },
}));
vi.mock('./bountyManager', () => ({ updateBounties: vi.fn() }));
vi.mock('./juiceManager', () => ({ juiceManager: { fireKillConfirmation: vi.fn(), resetEncounterStats: vi.fn() } }));
vi.mock('./cardAudioManager', () => ({ playCardAudio: vi.fn() }));
vi.mock('../data/mechanics', () => ({ MECHANIC_BY_ID: {}, MECHANICS_BY_TYPE: {} }));
vi.mock('./analyticsService', () => ({ analyticsService: { track: vi.fn() } }));
vi.mock('./ascension', () => ({
  applyAscensionEnemyTemplateAdjustments: vi.fn(),
  getAscensionModifiers: vi.fn(() => ({ enemyHpMultiplier: 1, bossHpMultiplier: 1, enemyDamageMultiplier: 1, startingCurses: 0, extraElites: 0 })),
}));
vi.mock('../ui/stores/gameState', () => ({
  activeRewardBundle: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  dismissScreenTransition: vi.fn(),
  combatExitEnemyId: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
}));
vi.mock('./relicEffectResolver', () => ({
  resolveEncounterStartEffects: vi.fn(() => ({})),
  resolveBaseDrawCount: vi.fn(() => 5),
  resolveTurnStartEffects: vi.fn(() => ({ bonusBlock: 0, bonusAP: 0, dejaVuCardSpawn: null, auraApModifier: 0 })),
  resolveTurnEndEffects: vi.fn(() => ({ bonusApFromAfterimage: 0, forceDiscard: 0, grantThorns: 0, bonusApNextTurn: 0, blockCarries: false })),
  resolveDrawBias: vi.fn(() => ({ biasChainType: null, biasChance: 0 })),
}));
vi.mock('../data/statusEffects', () => ({ applyStatusEffect: vi.fn() }));
vi.mock('./presetPoolBuilder', () => ({
  buildPresetRunPool: vi.fn(() => []),
  buildGeneralRunPool: vi.fn(() => []),
  buildLanguageRunPool: vi.fn(() => []),
  buildCuratedDeckRunPool: vi.fn(() => []),
}));
vi.mock('../data/curatedDeckStore', () => ({
  getCuratedDeck: vi.fn(() => null),
  getCuratedDeckFact: vi.fn(() => null),
  getCuratedDeckFacts: vi.fn(() => []),
}));
vi.mock('./factsDB', () => ({ factsDB: { isReady: vi.fn(() => false), init: vi.fn() } }));
vi.mock('./catchUpMasteryService', () => ({ computeCatchUpMastery: vi.fn(() => 0) }));
vi.mock('./cardUpgradeService', () => ({
  getMasteryStats: vi.fn(() => ({ qpValue: 4, apCost: 2, secondaryValue: 0, tags: [] })),
  getEffectiveApCost: vi.fn(() => 2),
}));
vi.mock('./knowledgeAuraSystem', () => ({
  resetAura: vi.fn(),
  adjustAura: vi.fn(),
  getAuraState: vi.fn(() => 'neutral'),
}));
vi.mock('./surgeSystem', () => ({ isSurgeTurn: vi.fn(() => false), getSurgeChargeSurcharge: vi.fn(() => 0) }));
vi.mock('./canaryService', () => ({
  initCanary: vi.fn(),
  getCanaryMultiplier: vi.fn(() => ({ enemyDamageMultiplier: 1, enemyHpMultiplier: 1 })),
}));
vi.mock('./reviewQueueSystem', () => ({
  resetReviewQueue: vi.fn(),
  addToReviewQueue: vi.fn(),
  clearReviewQueueFact: vi.fn(),
}));
vi.mock('./narrativeResonance', () => ({ resolveNarrativeResonance: vi.fn(() => ({})) }));
vi.mock('./encounterNarrativeEngine', () => ({ getEncounterNarrativeContext: vi.fn(() => ({})) }));
vi.mock('./inRunFactTracker', () => ({
  trackFactAnswered: vi.fn(),
  getInRunFactStats: vi.fn(() => ({})),
  resetInRunFactTracker: vi.fn(),
}));
vi.mock('../game/scenes/CombatScene', () => ({}));
vi.mock('./damagePreviewService', () => ({}));
vi.mock('./multiplayerCoopSync', () => ({
  awaitCoopTurnEndWithDelta: vi.fn(),
  awaitCoopEnemyReconcile: vi.fn(),
  broadcastSharedEnemyState: vi.fn(),
  broadcastPartnerState: vi.fn(),
  getCollectedDeltas: vi.fn(() => []),
  mpIsHost: vi.fn(() => false),
  cancelCoopTurnEnd: vi.fn(),
  computeRaceScore: vi.fn(() => 0),
  snapshotEnemy: vi.fn(() => ({})),
}));
vi.mock('./gameFlowController', () => ({
  // Stub out all exports used by encounterBridge at module level
  registerEncounterCompleteHandler: vi.fn(),
  notifyEncounterComplete: vi.fn(),
  currentScreen: { subscribe: vi.fn(), set: vi.fn(), _get: () => 'hub' },
  activeRunState: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeRunEndData: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeCardRewardOptions: { subscribe: vi.fn(), set: vi.fn(), _get: () => [] },
  activeShopCards: { subscribe: vi.fn(), set: vi.fn(), _get: () => [] },
  activeShopInventory: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  pendingTransformOptions: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeMysteryEvent: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeSpecialEvent: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeMasteryChallenge: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
  activeRelicRewardOptions: { subscribe: vi.fn(), set: vi.fn(), _get: () => [] },
  activeRelicPickup: { subscribe: vi.fn(), set: vi.fn(), _get: () => null },
}));
vi.mock('./runManager', () => ({
  recordCardPlay: vi.fn(),
}));
vi.mock('./tierDerivation', () => ({ getCardTier: vi.fn(() => 1) }));

// ── Actual import AFTER all vi.mock calls ────────────────────────────────────
import { endTurnInProgress, handleEndTurn } from './encounterBridge';
import { get } from 'svelte/store';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('encounterBridge — endTurnInProgress store (reentrancy guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports endTurnInProgress as a Svelte writable store', () => {
    expect(endTurnInProgress).toBeDefined();
    expect(typeof endTurnInProgress.subscribe).toBe('function');
    expect(typeof endTurnInProgress.set).toBe('function');
  });

  it('endTurnInProgress initialises to false', () => {
    const val = get(endTurnInProgress);
    expect(val).toBe(false);
  });

  it('exports handleEndTurn as an async function', () => {
    expect(typeof handleEndTurn).toBe('function');
    // async functions return a Promise when called
    const result = handleEndTurn();
    expect(result).toBeInstanceOf(Promise);
    // resolve it so we don't leave a floating promise
    return result;
  });
});
