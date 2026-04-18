/**
 * Tests for reactive-damage victory path in endPlayerTurn.
 *
 * Root cause (2026-04-18): When the enemy was killed during the enemy phase by
 * reflect (pain_conduit), thornReflect (thorned_vest), thorns (card mechanic), or
 * counterDamage (parry_counter3), endPlayerTurn set result='victory' and
 * phase='encounter_end' but did NOT return early. The function fell through and:
 *   1. Reset AP
 *   2. Drew a new hand
 *   3. Set phase back to 'player_action'
 *   4. Left result='victory' stuck on a live player turn
 *
 * On the NEXT endPlayerTurn call, the guard at line 3107 fired (result !== null),
 * returning an empty stub with no AP reset and no card draw — permanently freezing
 * the game. See docs/gotchas.md 2026-04-18.
 *
 * These tests exercise the bug fix: endPlayerTurn must return immediately with
 * result='victory' and phase='encounter_end' whenever reactive damage kills the enemy.
 *
 * Also covers the thornReflect bug fix: damageTakenFx.thornReflect path previously
 * never checked for enemy death, so the thorned_vest relic could silently kill the
 * enemy without setting result='victory'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock every heavy dependency (same pattern as turnManager.transmute.test.ts)
// ---------------------------------------------------------------------------

vi.mock('svelte/store', () => ({
  get: vi.fn(() => ({})),
  readable: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(),
}));

vi.mock('./runStateStore', () => ({
  activeRunState: { subscribe: vi.fn(), set: vi.fn(), update: vi.fn() },
}));

vi.mock('./chainSystem', () => ({
  resetChain: vi.fn(),
  decayChain: vi.fn(),
  extendOrResetChain: vi.fn(() => ({ didExtend: false })),
  getChainState: vi.fn(() => ({ length: 0, multiplier: 1, chainType: null })),
  getCurrentChainLength: vi.fn(() => 0),
  initChainSystem: vi.fn(),
  rotateActiveChainColor: vi.fn(() => 0),
  getActiveChainColor: vi.fn(() => null),
  getChainMultiplier: vi.fn(() => 1),
  switchActiveChainColor: vi.fn(),
}));

vi.mock('./knowledgeAuraSystem', () => ({
  resetAura: vi.fn(),
  adjustAura: vi.fn(),
  getAuraState: vi.fn(() => 'neutral'),
}));

vi.mock('./reviewQueueSystem', () => ({
  resetReviewQueue: vi.fn(),
  addToReviewQueue: vi.fn(),
  clearReviewQueueFact: vi.fn(),
  isReviewQueueFact: vi.fn(() => false),
}));

vi.mock('./cardUpgradeService', () => ({
  canMasteryUpgrade: vi.fn(() => false),
  canMasteryDowngrade: vi.fn(() => false),
  masteryUpgrade: vi.fn(),
  masteryDowngrade: vi.fn(),
  resetEncounterMasteryFlags: vi.fn(),
  getMasteryBaseBonus: vi.fn(() => 0),
  getMasteryStats: vi.fn(() => ({ qpValue: 4, apCost: 2, secondaryValue: 0, tags: [] })),
  getEffectiveApCost: vi.fn(() => 2),
  MASTERY_UPGRADE_DEFS: {},
}));

vi.mock('./surgeSystem', () => ({
  getSurgeChargeSurcharge: vi.fn(() => 0),
  isSurgeTurn: vi.fn(() => false),
}));

vi.mock('./deckManager', () => ({
  discardHand: vi.fn(() => []),
  drawHand: vi.fn(),
  playCard: vi.fn(),
}));

vi.mock('./catchUpMasteryService', () => ({
  computeCatchUpMastery: vi.fn(() => 0),
}));

vi.mock('./playerCombatState', () => ({
  createPlayerCombatState: vi.fn(() => ({
    hp: 50,
    maxHP: 50,
    shield: 0,
    statusEffects: [],
  })),
  applyShield: vi.fn(),
  takeDamage: vi.fn(() => ({ actualDamage: 10, defeated: false, remainingAfterShield: 10 })),
  healPlayer: vi.fn(),
  tickPlayerStatusEffects: vi.fn(() => ({ defeated: false, poisonDamage: 0, regenHeal: 0 })),
  resetTurnState: vi.fn(),
}));

vi.mock('./cardEffectResolver', () => ({
  resolveCardEffect: vi.fn(() => ({})),
  isCardBlocked: vi.fn(() => false),
}));

vi.mock('./cardAudioManager', () => ({
  playCardAudio: vi.fn(),
}));

// ── enemyManager: core mock with configurable behavior ──────────────────────
// applyDamageToEnemy is the key mock — tests override it per-scenario.
// Use a simple object with a spy so we can reassign the implementation across tests.
// The 'as any' cast is needed because vi.fn() without type args infers a zero-arg signature,
// but the actual function receives (enemy, damage) args.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _ade = { impl: (_e: any, _d: any) => ({ defeated: false, newHP: 10 }) };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _tse = { impl: (_e: any, _r: any) => ({ poisonDamage: 0, burnDamage: 0, bleedDamage: 0 }) };

// Module-level handle to the mock so beforeEach can override the implementation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockApplyDamageToEnemyImpl: (enemy: any, dmg: any) => { defeated: boolean; newHP: number } =
  () => ({ defeated: false, newHP: 10 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockTickEnemyStatusEffectsImpl: (enemy: any, relics: any) => { poisonDamage: number; burnDamage: number; bleedDamage: number } =
  () => ({ poisonDamage: 0, burnDamage: 0, bleedDamage: 0 });

// Proxy objects that delegate to the mutable impl variables.
// This lets us call mockApplyDamageToEnemy.mockReturnValue() etc. in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApplyDamageToEnemy = {
  mockReturnValue(val: { defeated: boolean; newHP: number }) {
    mockApplyDamageToEnemyImpl = () => val;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockImplementation(fn: (enemy: any) => { defeated: boolean; newHP: number }) {
    mockApplyDamageToEnemyImpl = fn;
  },
  reset() { mockApplyDamageToEnemyImpl = () => ({ defeated: false, newHP: 10 }); },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTickEnemyStatusEffects = {
  mockReturnValue(val: { poisonDamage: number; burnDamage: number; bleedDamage: number }) {
    mockTickEnemyStatusEffectsImpl = () => val;
  },
  reset() { mockTickEnemyStatusEffectsImpl = () => ({ poisonDamage: 0, burnDamage: 0, bleedDamage: 0 }); },
};

void _ade; void _tse; // suppress unused vars

vi.mock('./enemyManager', () => ({
  // Delegate to the mutable impl so tests can override per-scenario.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyDamageToEnemy: vi.fn((enemy: any, dmg: any) => mockApplyDamageToEnemyImpl(enemy, dmg)),
  executeEnemyIntent: vi.fn(() => ({ damage: 8, playerEffects: [], enemyHealed: 0, stunned: false, blockStripped: 0 })),
  rollNextIntent: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tickEnemyStatusEffects: vi.fn((enemy: any, relics: any) => mockTickEnemyStatusEffectsImpl(enemy, relics)),
  dispatchEnemyTurnStart: vi.fn(),
  getEnrageBonus: vi.fn(() => 0),
}));

vi.mock('../data/statusEffects', () => ({
  applyStatusEffect: vi.fn(),
  triggerBurn: vi.fn(() => ({ bonusDamage: 0 })),
  getBleedBonus: vi.fn(() => 0),
  PERMANENT_DURATION_SENTINEL: 99999,
}));

vi.mock('./relicSynergyResolver', () => ({
  hasSynergy: vi.fn(() => false),
  getMasteryAscensionBonus: vi.fn(() => 0),
}));

vi.mock('../data/mechanics', () => ({
  MECHANICS_BY_TYPE: {},
  getMechanicDefinition: vi.fn(() => null),
  MECHANIC_BY_ID: {},
}));

vi.mock('./cardPreferences', () => ({
  difficultyMode: { subscribe: vi.fn(), get: vi.fn(() => 'normal') },
}));

vi.mock('./discoverySystem', () => ({
  isFirstChargeFree: vi.fn(() => false),
  markFirstChargeUsed: vi.fn(),
  getFirstChargeWrongMultiplier: vi.fn(() => 1),
}));

vi.mock('./inRunFactTracker', () => ({
  trackFactAnswered: vi.fn(),
  getInRunFactStats: vi.fn(() => ({})),
  resetInRunFactTracker: vi.fn(),
}));

vi.mock('./enemyDamageScaling', () => ({
  applyPostIntentDamageScaling: vi.fn((dmg: number) => dmg),
}));

vi.mock('./relicEffectResolver', () => ({
  resolveDamageTakenEffects: vi.fn(() => ({
    percentIncrease: 0,
    thornReflect: 0,
    flatReduction: 0,
    blockDoubled: false,
    dodgeChance: 0,
    reflectOnBlock: null,
    lowHpAttackBonus: 0,
    thornCrownReflect: 0,
    battleScarsTriggered: false,
    furyStacksGained: 0,
  })),
  resolveLethalEffects: vi.fn(() => ({
    lastBreathSave: false,
    phoenixSave: false,
    phoenixHpPct: 0,
    lastBreathBlock: 0,
    lastBreathDamageBonus: 0,
    phoenixRageActive: false,
  })),
  resolvePerfectTurnBonus: vi.fn(() => 0),
  resolveTurnEndEffects: vi.fn(() => ({
    bonusApFromAfterimage: 0,
    forceDiscard: 0,
    grantThorns: 0,
    bonusApNextTurn: 0,
    blockCarries: false,
  })),
  resolveTurnStartEffects: vi.fn(() => ({
    bonusBlock: 0,
    bonusAP: 0,
    dejaVuCardSpawn: null,
    auraApModifier: 0,
  })),
  resolveChargeCorrectEffects: vi.fn(() => ({})),
  resolveChainMultiplierBonus: vi.fn(() => 0),
  resolvePrismaticShardApBonus: vi.fn(() => 0),
  resolveDoubleDownBonus: vi.fn(() => ({ multiplier: 1, consumed: false })),
  resolveDrawBias: vi.fn(() => ({ biasChainType: null, biasChance: 0 })),
  resolveEncounterStartEffects: vi.fn(() => ({})),
  resolveShieldModifiers: vi.fn(() => ({ finalShield: 0 })),
  resolveChargeWrongEffects: vi.fn(() => ({})),
  resolveChainCompleteEffects: vi.fn(() => ({})),
  resolveHealModifiers: vi.fn(() => ({ multiplier: 1 })),
  resolveHpLossEffects: vi.fn(() => ({ reflectDamage: 0, nextAttackBonus: 0 })),
  resolveForgetEffects: vi.fn(() => ({})),
  resolveChainBreakEffects: vi.fn(() => ({})),
}));

vi.mock('./intentDisplay', () => ({
  computeIntentDisplayDamageSnapshot: vi.fn(() => 0),
}));

vi.mock('../data/balance', () => ({
  CHAIN_MOMENTUM_ENABLED: true,
  CHARGE_AP_SURCHARGE: 1,
  RELIC_AEGIS_STONE_MAX_CARRY: 15,
  START_AP_PER_TURN: 3,
  MAX_AP_PER_TURN: 5,
  AP_PER_ACT: { 1: 3, 2: 4, 3: 4 },
  ENRAGE_SEGMENTS: [],
  ENRAGE_PHASE1_BONUS: 2,
  ENRAGE_PHASE2_BONUS: 4,
  ENRAGE_PHASE1_DURATION: 3,
  ENRAGE_LOW_HP_THRESHOLD: 0.3,
  ENRAGE_LOW_HP_BONUS: 3,
  FIZZLE_EFFECT_RATIO: 0.5,
  getBalanceValue: vi.fn((_key: string, def: unknown) => def),
  BLEED_BONUS_PER_STACK: 1,
  BLEED_DECAY_PER_TURN: 1,
  SURGE_DRAW_BONUS: 1,
  SURGE_BONUS_AP: 1,
  ENEMY_TURN_DAMAGE_CAP: { 1: 16, 2: 22, 3: 32, 4: 56 },
}));

// ---------------------------------------------------------------------------
// Actual import AFTER all vi.mock calls
// ---------------------------------------------------------------------------

import { endPlayerTurn } from './turnManager';
import type { TurnState } from './turnManager';
import {
  resolveDamageTakenEffects,
  resolveHpLossEffects,
} from './relicEffectResolver';
import { takeDamage } from './playerCombatState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalEnemy(overrides: Partial<Record<string, unknown>> = {}): TurnState['enemy'] {
  return {
    currentHP: 15,
    maxHP: 100,
    block: 0,
    floor: 1,
    statusEffects: [],
    playerChargedThisTurn: false,
    template: {
      id: 'test_enemy',
      category: 'common',
      intentPool: [{ type: 'attack', value: 8, telegraph: 'Strikes for 8' }],
      phase2IntentPool: null,
      onPlayerNoCharge: null,
    },
    nextIntent: { type: 'attack', value: 8, telegraph: 'Strikes for 8', bypassDamageCap: false },
    lockedDisplayDamage: undefined,
    phase: 1,
    ...overrides,
  } as unknown as TurnState['enemy'];
}

function makeMinimalPlayerState(): TurnState['playerState'] {
  return {
    hp: 40,
    maxHP: 60,
    shield: 0,
    statusEffects: [],
    hintsRemaining: 1,
  } as unknown as TurnState['playerState'];
}

function makeMinimalTurnState(overrides: Partial<TurnState> = {}): TurnState {
  return {
    phase: 'player_action',
    result: null,
    enemy: makeMinimalEnemy(),
    playerState: makeMinimalPlayerState(),
    deck: {
      hand: [],
      drawPile: [{ id: 'card1', factId: 'f1' }],
      discardPile: [],
      forgetPile: [],
      factCooldown: [],
      factPool: [],
      currentFloor: 1,
      hintsRemaining: 1,
    } as unknown as TurnState['deck'],
    activeRelicIds: new Set<string>(),
    turnLog: [],
    turnNumber: 1,
    encounterTurnNumber: 1,
    apCurrent: 3,
    apMax: 5,
    startingApPerTurn: 3,
    baseDrawCount: 5,
    bonusDrawNextTurn: 0,
    bonusApNextTurn: 0,
    chainLength: 0,
    chainType: null,
    chainMultiplier: 1,
    activeChainColor: 0,
    thornsActive: false,
    thornsValue: 0,
    thornsPersistent: false,
    counterDamagePerHit: 0,
    persistentShield: 0,
    bloodletterArmed: false,
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    chargeCorrectsThisTurn: 0,
    isPerfectTurn: false,
    staggeredEnemyNextTurn: false,
    slowEnemyIntent: false,
    isSurge: false,
    ascensionEnemyDamageMultiplier: 1,
    canaryEnemyDamageMultiplier: 1,
    canaryQuestionBias: 0,
    damageDealtThisTurn: 0,
    consecutiveCorrectThisEncounter: 0,
    encounterChargesTotal: 0,
    chargesCorrectThisEncounter: 0,
    secondWindUsed: false,
    phoenixAutoChargeTurns: 0,
    phoenixRageTurnsRemaining: 0,
    glassPenaltyRemovedTurnsRemaining: 0,
    foresightTurnsRemaining: 0,
    freePlayCharges: 0,
    empowerRemainingCount: 0,
    archiveBlockBonus: 0,
    timerExtensionPct: 0,
    eliminateDistractors: 0,
    lockedCardType: null,
    shieldsPlayedThisTurn: 0,
    shieldsPlayedLastTurn: 0,
    lastTurnPlayedShield: false,
    reinforcePermanentBonus: 0,
    empowerWeakPending: 0,
    warcryFreeChargeActive: false,
    battleTranceRestriction: false,
    firstAttackUsed: false,
    buffNextCard: 0,
    lastCardType: undefined,
    lastCardEffect: null,
    igniteRemainingAttacks: 0,
    forcedAttackTurnsRemaining: 0,
    pendingScryCount: 0,
    selfDamageTakenThisEncounter: 0,
    activePassives: [],
    vulnMultiplierOverride: null,
    weakShieldBonusPercent: 0,
    nextChargeFreeForChainType: null,
    currentChainAnswerFactIds: [],
    completedChainSequences: [],
    encounterQuizzedFacts: new Set<string>(),
    encounterAnsweredFacts: [],
    dejaVuUsedThisEncounter: false,
    characterLevel: 1,
    isElite: false,
    pendingDrawCountOverride: null,
    encounterNumber: 1,
    lastPlayedMechanicId: null,
    lastPlayedChainType: null,
    activeInscriptions: [],
    ...overrides,
  } as unknown as TurnState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('endPlayerTurn — reactive-damage victory (pain_conduit reflect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: enemy survives reactive damage
    mockApplyDamageToEnemy.mockReturnValue({ defeated: false, newHP: 5 });

    // Default: takeDamage does real damage (10 HP) but doesn't kill player
    vi.mocked(takeDamage).mockReturnValue({ actualDamage: 10, defeated: false });
  });

  it('returns victory result immediately when pain_conduit reflect kills the enemy', () => {
    // pain_conduit: reflects HP loss as damage to enemy
    vi.mocked(resolveHpLossEffects).mockReturnValue({ reflectDamage: 15, nextAttackBonus: 0 });
    // The reflect damage kills the enemy
    mockApplyDamageToEnemy.mockReturnValue({ defeated: true, newHP: 0 });

    // Make sure enemy HP goes to 0 after reflect
    const ts = makeMinimalTurnState();
    ts.enemy.currentHP = 5; // low HP, will die from reflect
    ts.activeRelicIds = new Set(['pain_conduit']);

    const result = endPlayerTurn(ts);

    expect(result.playerDefeated).toBe(false);
    expect(result.turnState.result).toBe('victory');
    expect(result.turnState.phase).toBe('encounter_end');
  });

  it('does NOT fall through to AP reset when reactive victory fires', () => {
    vi.mocked(resolveHpLossEffects).mockReturnValue({ reflectDamage: 15, nextAttackBonus: 0 });
    mockApplyDamageToEnemy.mockReturnValue({ defeated: true, newHP: 0 });

    const ts = makeMinimalTurnState();
    ts.activeRelicIds = new Set(['pain_conduit']);
    const originalAp = ts.apCurrent;

    endPlayerTurn(ts);

    // AP must NOT have been reset — the function returned early
    // (resetTurnState is mocked; if it were called with the real implementation
    // apCurrent would change. We verify the function returned early by checking
    // that phase stayed at 'encounter_end', not flipped back to 'player_action'.)
    expect(ts.phase).toBe('encounter_end');
    expect(ts.result).toBe('victory');
    // Confirm phase was NOT overwritten back to 'player_action' (the bug)
    expect(ts.phase).not.toBe('player_action');

    void originalAp; // suppress unused-variable warning
  });
});

describe('endPlayerTurn — reactive-damage victory (thorns card mechanic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeDamage).mockReturnValue({ actualDamage: 10, defeated: false });
  });

  it('returns victory result when thorns card mechanic kills the enemy', () => {
    // The thorns path calls applyDamageToEnemy (mocked, does not mutate HP),
    // then checks enemy.currentHP <= 0. We pre-set HP to 0 to simulate the enemy
    // being at 0 HP after the thorns hit.
    const ts = makeMinimalTurnState({
      thornsActive: true,
      thornsValue: 20,
    });
    ts.enemy.currentHP = 0; // simulates: thorns hit drained the last HP

    const result = endPlayerTurn(ts);

    expect(result.playerDefeated).toBe(false);
    expect(result.turnState.result).toBe('victory');
    expect(result.turnState.phase).toBe('encounter_end');
  });

  it('phase stays encounter_end after thorns kill (not overwritten back to player_action)', () => {
    const ts = makeMinimalTurnState({
      thornsActive: true,
      thornsValue: 20,
    });
    ts.enemy.currentHP = 0; // simulates: thorns hit drained the last HP

    endPlayerTurn(ts);

    // The pre-fix bug was: phase was overwritten to 'player_action' at line ~3693.
    // After the fix, the function returns early so phase stays as 'encounter_end'.
    expect(ts.phase).toBe('encounter_end');
    expect(ts.result).toBe('victory');
  });
});

describe('endPlayerTurn — reactive-damage victory (counterDamage / parry_counter3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeDamage).mockReturnValue({ actualDamage: 8, defeated: false });
  });

  it('returns victory result when counterDamage kills the enemy', () => {
    mockApplyDamageToEnemy.mockReturnValue({ defeated: true, newHP: 0 });

    const ts = makeMinimalTurnState({
      counterDamagePerHit: 12,
    });
    ts.enemy.currentHP = 5;

    const result = endPlayerTurn(ts);

    expect(result.playerDefeated).toBe(false);
    expect(result.turnState.result).toBe('victory');
    expect(result.turnState.phase).toBe('encounter_end');
  });
});

describe('endPlayerTurn — reactive-damage victory (thornReflect / thorned_vest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeDamage).mockReturnValue({ actualDamage: 8, defeated: false });
  });

  it('returns victory result when thorned_vest thornReflect kills the enemy', () => {
    // thornReflect: the thorned_vest relic damage — previously never checked for death
    vi.mocked(resolveDamageTakenEffects).mockReturnValue({
      percentIncrease: 0,
      thornReflect: 10, // thorned_vest reflects 10 damage
      flatReduction: 0,
      blockDoubled: false,
      dodgeChance: 0,
      reflectOnBlock: null,
      lowHpAttackBonus: 0,
      thornCrownReflect: 0,
      battleScarsTriggered: false,
      furyStacksGained: 0,
    });
    mockApplyDamageToEnemy.mockReturnValue({ defeated: true, newHP: 0 });

    const ts = makeMinimalTurnState();
    ts.enemy.currentHP = 5;
    ts.activeRelicIds = new Set(['thorned_vest']);

    const result = endPlayerTurn(ts);

    expect(result.playerDefeated).toBe(false);
    expect(result.turnState.result).toBe('victory');
    expect(result.turnState.phase).toBe('encounter_end');
  });

  it('thornReflect kill sets result=victory (was previously missing — the silent kill bug)', () => {
    // This is the specific thornReflect bug: the code applied damage but never checked
    // if the enemy died, so result was never set to 'victory'.
    vi.mocked(resolveDamageTakenEffects).mockReturnValue({
      percentIncrease: 0,
      thornReflect: 50, // massive reflect, definitely kills
      flatReduction: 0,
      blockDoubled: false,
      dodgeChance: 0,
      reflectOnBlock: null,
      lowHpAttackBonus: 0,
      thornCrownReflect: 0,
      battleScarsTriggered: false,
      furyStacksGained: 0,
    });

    // First call kills enemy via reflect, subsequent calls show still dead
    mockApplyDamageToEnemy.mockReturnValue({ defeated: true, newHP: 0 });

    const ts = makeMinimalTurnState();
    ts.activeRelicIds = new Set(['thorned_vest']);

    const result = endPlayerTurn(ts);

    // Before the fix: result would be null (never set) and phase would be 'player_action'
    // After the fix: result='victory' and phase='encounter_end'
    expect(result.turnState.result).toBe('victory');
    expect(result.turnState.phase).toBe('encounter_end');
  });
});

describe('endPlayerTurn — no reactive victory when enemy survives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeDamage).mockReturnValue({ actualDamage: 8, defeated: false });
    mockApplyDamageToEnemy.mockReturnValue({ defeated: false, newHP: 30 });
    mockTickEnemyStatusEffects.mockReturnValue({ poisonDamage: 0, burnDamage: 0, bleedDamage: 0 });
  });

  it('normal flow continues when thorns do not kill the enemy', () => {
    const ts = makeMinimalTurnState({
      thornsActive: true,
      thornsValue: 2,
    });
    ts.enemy.currentHP = 80;

    const result = endPlayerTurn(ts);

    // Enemy survived — result should be null (no victory), phase should be 'player_action'
    expect(result.turnState.result).toBeNull();
    expect(result.turnState.phase).toBe('player_action');
    expect(result.playerDefeated).toBe(false);
  });

  it('normal flow continues when pain_conduit reflect does not kill', () => {
    vi.mocked(resolveHpLossEffects).mockReturnValue({ reflectDamage: 5, nextAttackBonus: 0 });
    // Enemy survives the reflect
    mockApplyDamageToEnemy.mockReturnValue({ defeated: false, newHP: 30 });

    const ts = makeMinimalTurnState();
    ts.activeRelicIds = new Set(['pain_conduit']);
    ts.enemy.currentHP = 80;

    const result = endPlayerTurn(ts);

    expect(result.turnState.result).toBeNull();
    expect(result.turnState.phase).toBe('player_action');
  });
});

describe('endPlayerTurn — guard: early exit when result is already set', () => {
  it('returns stub when called with result=victory already set (the freeze case)', () => {
    // This is the exact freeze scenario: result='victory' already set from a previous
    // reactive-damage kill that was NOT handled. The guard fires and returns early.
    const ts = makeMinimalTurnState({
      result: 'victory' as TurnState['result'],
      phase: 'encounter_end' as TurnState['phase'],
    });

    const result = endPlayerTurn(ts);

    // Guard should catch this and return immediately
    expect(result.damageDealt).toBe(0);
    expect(result.effectsApplied).toHaveLength(0);
    // playerDefeated uses playerState.hp which is > 0 in our stub
    expect(result.playerDefeated).toBe(false);
  });
});
