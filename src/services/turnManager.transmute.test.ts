/**
 * Unit tests for Issue 5 — Card picker routes through draw pile.
 *
 * Tests the service side of the fix: resolveTransmutePick() now removes
 * the source card from its pile and pushes the new transmuted card onto the
 * TOP of the draw pile rather than mutating in-place.
 *
 * "Top" = push() to end of array because drawPile is a stack (pop() draws from end).
 *
 * These tests exercise the logic in isolation by mocking the full module
 * graph that turnManager.ts pulls in (Phaser scenes, Svelte stores, audio, etc.).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock every heavy dependency that turnManager.ts imports
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
  getChainState: vi.fn(() => ({ length: 0, multiplier: 1 })),
  getCurrentChainLength: vi.fn(() => 0),
  initChainSystem: vi.fn(),
  rotateActiveChainColor: vi.fn(),
  getActiveChainColor: vi.fn(() => null),
  getChainMultiplier: vi.fn(() => 1),
  switchActiveChainColor: vi.fn(),
}));

vi.mock('./knowledgeAuraSystem', () => ({
  resetAura: vi.fn(),
  adjustAura: vi.fn(),
  getAuraState: vi.fn(() => ({ active: false })),
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
  getMasteryStats: vi.fn(() => ({ qpValue: 4, apCost: 2, secondaryValue: 0 })),
  getEffectiveApCost: vi.fn(() => 2),
  MASTERY_UPGRADE_DEFS: {},
}));

vi.mock('./surgeSystem', () => ({
  getSurgeChargeSurcharge: vi.fn(() => 0),
  isSurgeTurn: vi.fn(() => false),
}));

vi.mock('./deckManager', () => ({
  discardHand: vi.fn(),
  drawHand: vi.fn(() => []),
  playCard: vi.fn(),
}));

vi.mock('./catchUpMasteryService', () => ({
  // Returns 0 by default so transmuted cards start at L0 — overridden in specific tests
  computeCatchUpMastery: vi.fn(() => 0),
}));

vi.mock('./playerCombatState', () => ({
  createPlayerCombatState: vi.fn(() => ({
    hp: 50,
    maxHp: 50,
    shield: 0,
    statusEffects: [],
  })),
  applyShield: vi.fn(),
  takeDamage: vi.fn(() => ({ remainingDamage: 0, killed: false })),
  healPlayer: vi.fn(),
  tickPlayerStatusEffects: vi.fn(),
  resetTurnState: vi.fn(),
}));

vi.mock('./cardEffectResolver', () => ({
  resolveCardEffect: vi.fn(() => ({})),
  isCardBlocked: vi.fn(() => false),
}));

vi.mock('./cardAudioManager', () => ({
  playCardAudio: vi.fn(),
}));

vi.mock('./enemyManager', () => ({
  applyDamageToEnemy: vi.fn(() => ({ killed: false, damageDealt: 0 })),
  executeEnemyIntent: vi.fn(() => ({ damageDealt: 0, effectsApplied: [], playerDefeated: false, nextEnemyIntent: '' })),
  rollNextIntent: vi.fn(),
  tickEnemyStatusEffects: vi.fn(),
  dispatchEnemyTurnStart: vi.fn(),
}));

vi.mock('../data/statusEffects', () => ({
  applyStatusEffect: vi.fn(),
  triggerBurn: vi.fn(() => 0),
  getBleedBonus: vi.fn(() => 0),
}));

vi.mock('./relicSynergyResolver', () => ({
  hasSynergy: vi.fn(() => false),
  getMasteryAscensionBonus: vi.fn(() => 0),
}));

vi.mock('../data/mechanics', () => ({
  MECHANICS_BY_TYPE: {},
  getMechanicDefinition: vi.fn(() => null),
}));

vi.mock('./cardPreferences', () => ({
  difficultyMode: { subscribe: vi.fn() },
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

vi.mock('./coopSyncService', () => ({
  isCoopHost: vi.fn(() => false),
  syncCombatState: vi.fn(),
  awaitCoopTurnEndWithDelta: vi.fn(),
}));

vi.mock('./multiplayerCoopSync', () => ({
  broadcastTurnEnd: vi.fn(),
  cancelCoopTurnEnd: vi.fn(),
}));

vi.mock('./runSaveService', () => ({
  saveRun: vi.fn(),
  loadRun: vi.fn(() => null),
}));

vi.mock('./floorManager', () => ({
  getFloorConfig: vi.fn(() => ({ actNumber: 1 })),
}));

vi.mock('./dungeonMoodSystem', () => ({
  updateDungeonMood: vi.fn(),
  getDungeonMood: vi.fn(() => ({})),
}));

vi.mock('../game/systems/TickSystem', () => ({
  TickSystem: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Actual import (AFTER all vi.mock calls)
// ---------------------------------------------------------------------------

import { resolveTransmutePick } from './turnManager';
import type { Card, CardRunState } from '../data/card-types';
import type { TurnState } from './turnManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Card stub. */
function makeCard(id: string, mechanicId = 'strike', cardType: Card['cardType'] = 'attack'): Card {
  return {
    id,
    factId: `fact_${id}`,
    cardType,
    domain: 'general_knowledge',
    mechanicId,
    mechanicName: mechanicId,
    chainType: 0,
    apCost: 2,
    baseEffectValue: 4,
    effectMultiplier: 1,
    masteryLevel: 0,
    tier: '1',
    isCursed: false,
  };
}

/** Minimal CardRunState stub. */
function makeDeck(overrides: Partial<CardRunState> = {}): CardRunState {
  // Minimal stub — CardRunState has many required fields not needed by these tests.
  // Cast via unknown so TypeScript accepts the partial stub.
  return {
    hand: [],
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    factCooldown: [],
    ...overrides,
  } as unknown as CardRunState;
}

/** Minimal TurnState stub. */
function makeTurnState(deck: CardRunState): TurnState {
  return {
    deck,
    apCurrent: 3,
    apMax: 5,
    startingApPerTurn: 3,
    turn: 1,
    globalTurnCounter: 1,
    floor: 1,
    bonusDrawNextTurn: 0,
    bonusApNextTurn: 0,
    enemy: null as unknown as TurnState['enemy'],
    playerState: {
      hp: 50,
      maxHP: 50,
      shield: 0,
      statusEffects: [],
      hintsRemaining: 1,
      cardsPlayedThisTurn: 0,
    } as unknown as TurnState['playerState'],
    activeRelics: [],
    inscriptions: [],
    focusReady: false,
    focusCharges: 0,
    overclockReady: false,
    slowEnemyIntent: false,
    foresightTurnsRemaining: 0,
    baseDrawCount: 5,
    coopWaitingForPartner: false,
    isCoopSession: false,
  } as unknown as TurnState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveTransmutePick — Issue 5: draw pile routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('primary transmute: source card is removed from hand, new card is at drawPile top', () => {
    const sourceCard = makeCard('source_1');
    const chosenMechanic = makeCard('chosen_1', 'shield_bash', 'shield');

    const deck = makeDeck({ hand: [sourceCard] });
    const turnState = makeTurnState(deck);

    const result = resolveTransmutePick(turnState, 'source_1', [chosenMechanic]);

    // Source card must be gone from hand
    expect(deck.hand.find(c => c.id === 'source_1')).toBeUndefined();

    // New card must be at top of draw pile (last element — stack pops from end)
    expect(deck.drawPile.length).toBe(1);
    const top = deck.drawPile[deck.drawPile.length - 1];
    expect(top.mechanicId).toBe('shield_bash');
    expect(top.cardType).toBe('shield');
    expect(top.isTransmuted).toBe(true);
    // originalCard must capture the source card's id for revert
    expect(top.originalCard?.id).toBe('source_1');

    // Return value must contain the pushed card
    expect(result).toHaveLength(1);
    expect(result[0].mechanicId).toBe('shield_bash');
  });

  it('primary transmute from discard pile: source removed, new card on drawPile top', () => {
    const sourceCard = makeCard('source_disc');
    const chosenMechanic = makeCard('chosen_disc', 'fireball', 'attack');

    const deck = makeDeck({ discardPile: [sourceCard] });
    const turnState = makeTurnState(deck);

    const result = resolveTransmutePick(turnState, 'source_disc', [chosenMechanic]);

    // Source removed from discard
    expect(deck.discardPile.find(c => c.id === 'source_disc')).toBeUndefined();

    // New card on draw pile top
    expect(deck.drawPile.length).toBe(1);
    expect(deck.drawPile[0].mechanicId).toBe('fireball');
    expect(result).toHaveLength(1);
  });

  it('multi-pick (2 extras): both cards pushed to drawPile top in order', () => {
    const sourceCard = makeCard('source_multi');
    const pick1 = makeCard('pick_1', 'strike', 'attack');
    const pick2 = makeCard('pick_2', 'fortify', 'shield');

    const deck = makeDeck({ hand: [sourceCard] });
    const turnState = makeTurnState(deck);

    const result = resolveTransmutePick(turnState, 'source_multi', [pick1, pick2]);

    // Source removed from hand
    expect(deck.hand.find(c => c.id === 'source_multi')).toBeUndefined();

    // Both cards in draw pile — primary first (lower index), extra second (top)
    expect(deck.drawPile.length).toBe(2);
    expect(deck.drawPile[0].mechanicId).toBe('strike');  // primary (pushed first)
    expect(deck.drawPile[1].mechanicId).toBe('fortify'); // extra (pushed second = topmost)

    // Extra card uses stub originalCard for revert-removal sentinel
    expect(deck.drawPile[1].originalCard?.id).toMatch(/^transmute_extra_remove_/);

    // Return value contains both
    expect(result).toHaveLength(2);
    expect(result[0].mechanicId).toBe('strike');
    expect(result[1].mechanicId).toBe('fortify');
  });

  it('draw pile was not empty: new cards on top, existing content preserved below', () => {
    const existing1 = makeCard('existing_1');
    const existing2 = makeCard('existing_2');
    const sourceCard = makeCard('source_3');
    const chosenMechanic = makeCard('chosen_3', 'slam', 'attack');

    const deck = makeDeck({
      hand: [sourceCard],
      drawPile: [existing1, existing2], // existing1 is bottom, existing2 is top (next to pop)
    });
    const turnState = makeTurnState(deck);

    resolveTransmutePick(turnState, 'source_3', [chosenMechanic]);

    // Draw pile should now have 3 cards: [existing1, existing2, transmuted]
    expect(deck.drawPile.length).toBe(3);
    // Bottom two preserved in original order
    expect(deck.drawPile[0].id).toBe('existing_1');
    expect(deck.drawPile[1].id).toBe('existing_2');
    // Transmuted card on top (last — what pop() will draw next)
    expect(deck.drawPile[2].mechanicId).toBe('slam');
    expect(deck.drawPile[2].isTransmuted).toBe(true);
  });

  it('source not found: returns empty array, no state mutation', () => {
    const deck = makeDeck({ hand: [makeCard('real_card')] });
    const turnState = makeTurnState(deck);
    const chosen = makeCard('chosen', 'strike', 'attack');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveTransmutePick(turnState, 'nonexistent_id', [chosen]);
    consoleSpy.mockRestore();

    expect(result).toHaveLength(0);
    expect(deck.hand).toHaveLength(1); // unchanged
    expect(deck.drawPile).toHaveLength(0); // unchanged
  });

  it('empty selectedCards: returns empty array immediately', () => {
    const sourceCard = makeCard('source_empty');
    const deck = makeDeck({ hand: [sourceCard] });
    const turnState = makeTurnState(deck);

    const result = resolveTransmutePick(turnState, 'source_empty', []);

    expect(result).toHaveLength(0);
    // Source card must still be in hand — nothing touched
    expect(deck.hand.find(c => c.id === 'source_empty')).toBeDefined();
    expect(deck.drawPile).toHaveLength(0);
  });

  it('isTransmuted=true and originalCard set on the pushed card for encounter revert', () => {
    const sourceCard = makeCard('src_revert');
    sourceCard.masteryLevel = 2;
    const chosen = makeCard('chosen_revert', 'drain', 'debuff');

    const deck = makeDeck({ hand: [sourceCard] });
    const turnState = makeTurnState(deck);

    resolveTransmutePick(turnState, 'src_revert', [chosen]);

    const pushed = deck.drawPile[0];
    expect(pushed.isTransmuted).toBe(true);
    expect(pushed.originalCard).toBeDefined();
    // originalCard preserves the old id so revertTransmutedCards can deduplicate
    expect(pushed.originalCard?.id).toBe('src_revert');
    // factId is preserved from the source card (facts stay bound to their original card)
    expect(pushed.factId).toBe('fact_src_revert');
  });
});
