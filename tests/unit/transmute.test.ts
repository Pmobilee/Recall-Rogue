/**
 * Unit tests for the Transmute mechanic — Phase 1 fix.
 *
 * Covers:
 * 1. QP plays Transmute → applyTransmuteAuto set, no pendingCardPick
 * 2. Charge Correct plays Transmute → pendingCardPick set with correct pickCount
 * 3. Charge Wrong plays Transmute → applyTransmuteAuto set (auto-pick), no pendingCardPick
 * 4. resolveTransmutePick: source in discard → in-place swap, isTransmuted=true, originalCard set
 * 5. resolveTransmutePick: source in hand → found and swapped
 * 6. Mastery 3+ Charge Correct picks 2 → second pick added as extra transmuted card in hand
 * 7. revertTransmutedCards: restores originals at encounter end
 * 8. revertTransmutedCards: removes mastery 3+ extra cards (transmute_extra_remove_ sentinel)
 * 9. Source card not found edge case: warning logged, no state mutation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import { resolveTransmutePick, revertTransmutedCards } from '../../src/services/turnManager';
import type { Card, CardType, CardRunState } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import type { TurnState } from '../../src/services/turnManager';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTransmuteCard(masteryLevel = 0): Card {
  return {
    id: 'transmute-source-card',
    factId: 'transmute-fact-001',
    cardType: 'utility',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 0,
    effectMultiplier: 1.0,
    apCost: 1,
    mechanicId: 'transmute',
    mechanicName: 'Transmute',
    masteryLevel,
  };
}

function makeAnyCard(overrides: Partial<Card> = {}): Card {
  return {
    id: `card_${Math.random().toString(36).slice(2, 8)}`,
    factId: 'some-fact',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 4,
    effectMultiplier: 1.0,
    apCost: 1,
    mechanicId: 'strike',
    mechanicName: 'Strike',
    ...overrides,
  };
}

function makePlayer(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  return {
    hp: 80,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
    comboCount: 0,
    hintsRemaining: 1,
    cardsPlayedThisTurn: 0,
    ...overrides,
  };
}

function makeEnemy(overrides?: Partial<EnemyInstance>): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'test-enemy',
    name: 'Test Enemy',
    category: 'common',
    baseHP: 100,
    intentPool: [{ type: 'attack', value: 10, weight: 1, telegraph: 'Strike' }],
    description: 'Test',
  };
  return {
    template,
    currentHP: 100,
    maxHP: 100,
    nextIntent: template.intentPool[0],
    block: 0,
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
    ...overrides,
  };
}

/**
 * Construct a minimal TurnState around the provided deck state.
 * Only the fields used by resolveTransmutePick / revertTransmutedCards matter.
 */
function makeTurnState(deckOverrides: Partial<CardRunState> = {}): TurnState {
  const deck: CardRunState = {
    hand: [],
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    currentFloor: 1,
    currentEncounter: 0,
    playerHP: 80,
    playerMaxHP: 80,
    playerShield: 0,
    hintsRemaining: 1,
    currency: 0,
    factPool: [],
    factCooldown: [],
    consecutiveCursedDraws: 0,
    ...deckOverrides,
  };

  // Build a minimal TurnState — most fields unused by the functions under test
  return {
    phase: 'player_action',
    turnNumber: 1,
    encounterTurnNumber: 1,
    playerState: makePlayer() as any,
    enemy: makeEnemy() as any,
    deck,
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    isPerfectTurn: true,
    buffNextCard: 0,
    lastCardType: undefined,
    activePassives: [],
    activeRelicIds: new Set(),
    apCurrent: 3,
    apMax: 3,
    isSurge: false,
    turnLog: [],
    consecutiveCorrectThisEncounter: 0,
    encounterChargesTotal: 0,
    chargesCorrectThisEncounter: 0,
    totalChargesThisRun: 0,
    doubleStrikeReady: false,
    focusReady: false,
    focusCharges: 0,
    overclockReady: false,
    slowEnemyIntent: false,
    foresightTurnsRemaining: 0,
    thornsActive: false,
    thornsValue: 0,
    staggeredEnemyNextTurn: false,
    ignitePendingBurn: 0,
    igniteRemainingAttacks: 0,
    chainAnchorActive: false,
    battleTranceRestriction: undefined,
    buffNextCardBonus: 0,
    bonusDrawNextTurn: 0,
    activeInscriptions: [],
    tier3CardCount: 0,
    phoenixRageTurnsRemaining: 0,
    knowledgeAuraLevel: 0,
    reinforcePermanentBonus: 0,
    warcryFreeChargeReady: false,
    masteryChangedCardIds: new Set(),
    lastCardEffect: undefined,
    lastPlayedMechanicId: undefined,
    frenzyChargesRemaining: 0,
  } as unknown as TurnState;
}

function resolve(
  card: Card,
  playMode: 'quick' | 'charge_correct' | 'charge_wrong',
) {
  return resolveCardEffect(card, makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined, { playMode });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Transmute — Quick Play (QP path)', () => {
  it('QP sets applyTransmuteAuto (auto-pick) and does NOT set pendingCardPick', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'quick');
    expect(result.pendingCardPick).toBeUndefined();
    expect(result.applyTransmuteAuto).toBeDefined();
    expect(result.applyTransmuteAuto!.sourceCardId).toBe('transmute-source-card');
    expect(result.applyTransmuteAuto!.selected).toBeDefined();
    expect(result.applyTransmuteAuto!.selected.mechanicId).toBeDefined();
  });

  it('QP auto-selected candidate is one of the 3 generated (attack, shield, or utility/buff/debuff)', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'quick');
    const selected = result.applyTransmuteAuto!.selected;
    expect(['attack', 'shield', 'utility', 'buff', 'debuff']).toContain(selected.cardType);
  });
});

describe('Transmute — Charge Correct (CC path)', () => {
  it('CC sets pendingCardPick and does NOT set applyTransmuteAuto', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'charge_correct');
    expect(result.applyTransmuteAuto).toBeUndefined();
    expect(result.pendingCardPick).toBeDefined();
  });

  it('CC pendingCardPick has type=transmute and correct sourceCardId', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'charge_correct');
    expect(result.pendingCardPick!.type).toBe('transmute');
    expect(result.pendingCardPick!.sourceCardId).toBe('transmute-source-card');
  });

  it('CC pickCount = 1 at mastery 0–2', () => {
    for (const level of [0, 1, 2]) {
      const card = makeTransmuteCard(level);
      const result = resolve(card, 'charge_correct');
      expect(result.pendingCardPick!.pickCount, `mastery ${level}`).toBe(1);
    }
  });

  it('CC pickCount = 2 at mastery 3+', () => {
    for (const level of [3, 4, 5]) {
      const card = makeTransmuteCard(level);
      const result = resolve(card, 'charge_correct');
      expect(result.pendingCardPick!.pickCount, `mastery ${level}`).toBe(2);
    }
  });

  it('CC candidates array has 3 entries', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'charge_correct');
    expect(result.pendingCardPick!.candidates).toHaveLength(3);
  });

  it('CC allowSkip = true', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'charge_correct');
    expect(result.pendingCardPick!.allowSkip).toBe(true);
  });
});

describe('Transmute — Charge Wrong (CW path)', () => {
  it('CW sets applyTransmuteAuto (auto-pick) like QP, does NOT set pendingCardPick', () => {
    const card = makeTransmuteCard(0);
    const result = resolve(card, 'charge_wrong');
    expect(result.pendingCardPick).toBeUndefined();
    expect(result.applyTransmuteAuto).toBeDefined();
    expect(result.applyTransmuteAuto!.sourceCardId).toBe('transmute-source-card');
    expect(result.applyTransmuteAuto!.selected).toBeDefined();
  });
});

describe('resolveTransmutePick — in-place encounter-only swap', () => {
  it('source card in discard: transforms in-place, isTransmuted=true, originalCard set', () => {
    const sourceCard = makeAnyCard({ id: 'source-id', factId: 'orig-fact', mechanicId: 'strike' });
    const candidate = makeAnyCard({ id: 'cand-1', mechanicId: 'shield_bash', cardType: 'shield' });

    const turnState = makeTurnState({
      discardPile: [sourceCard],
      hand: [],
    });

    resolveTransmutePick(turnState, 'source-id', [candidate]);

    // Source card still in discard pile (in-place swap)
    const swapped = turnState.deck.discardPile.find(c => c.id === 'source-id');
    expect(swapped).toBeDefined();
    expect(swapped!.isTransmuted).toBe(true);
    expect(swapped!.originalCard).toBeDefined();
    expect(swapped!.originalCard!.id).toBe('source-id');
    expect(swapped!.originalCard!.mechanicId).toBe('strike');
    // Mechanic fields updated to candidate
    expect(swapped!.mechanicId).toBe('shield_bash');
    expect(swapped!.cardType).toBe('shield');
    // factId preserved
    expect(swapped!.factId).toBe('orig-fact');
  });

  it('source card in hand: also found and swapped correctly', () => {
    const sourceCard = makeAnyCard({ id: 'hand-src', factId: 'hand-fact', mechanicId: 'block' });
    const candidate = makeAnyCard({ id: 'cand-hand', mechanicId: 'strike', cardType: 'attack' });

    const turnState = makeTurnState({ hand: [sourceCard], discardPile: [] });

    resolveTransmutePick(turnState, 'hand-src', [candidate]);

    const swapped = turnState.deck.hand.find(c => c.id === 'hand-src');
    expect(swapped).toBeDefined();
    expect(swapped!.isTransmuted).toBe(true);
    expect(swapped!.originalCard!.mechanicId).toBe('block');
    expect(swapped!.mechanicId).toBe('strike');
    expect(swapped!.factId).toBe('hand-fact');
  });

  it('source card in drawPile: found and swapped', () => {
    const sourceCard = makeAnyCard({ id: 'draw-src', mechanicId: 'strike' });
    const candidate = makeAnyCard({ id: 'cand-draw', mechanicId: 'block', cardType: 'shield' });

    const turnState = makeTurnState({ drawPile: [sourceCard] });

    resolveTransmutePick(turnState, 'draw-src', [candidate]);

    const swapped = turnState.deck.drawPile.find(c => c.id === 'draw-src');
    expect(swapped!.isTransmuted).toBe(true);
    expect(swapped!.mechanicId).toBe('block');
  });

  it('mastery 3+ with 2 picks: first replaces source, second added to hand', () => {
    const sourceCard = makeAnyCard({ id: 'src-m3', factId: 'orig-fact-m3', mechanicId: 'strike' });
    const cand1 = makeAnyCard({ id: 'cand-m3-1', mechanicId: 'block', cardType: 'shield' });
    const cand2 = makeAnyCard({ id: 'cand-m3-2', mechanicId: 'scout', cardType: 'utility' });

    const turnState = makeTurnState({
      discardPile: [sourceCard],
      hand: [],
    });

    resolveTransmutePick(turnState, 'src-m3', [cand1, cand2]);

    // Primary: source in discard transformed
    const swapped = turnState.deck.discardPile.find(c => c.id === 'src-m3');
    expect(swapped!.isTransmuted).toBe(true);
    expect(swapped!.mechanicId).toBe('block');

    // Extra: new card added to hand
    expect(turnState.deck.hand).toHaveLength(1);
    const extra = turnState.deck.hand[0];
    expect(extra.isTransmuted).toBe(true);
    expect(extra.mechanicId).toBe('scout');
    expect(extra.factId).toBe('orig-fact-m3');
    // Extra's originalCard id starts with sentinel prefix (signals removal at revert)
    expect(extra.originalCard!.id.startsWith('transmute_extra_remove_')).toBe(true);
  });
});

describe('revertTransmutedCards — encounter-end cleanup', () => {
  it('restores primary transmuted card to original mechanic/stats', () => {
    const originalCard = makeAnyCard({
      id: 'revert-src',
      mechanicId: 'strike',
      cardType: 'attack',
      baseEffectValue: 4,
    });
    const transmuteCard: Card = {
      ...originalCard,
      mechanicId: 'block',
      cardType: 'shield',
      baseEffectValue: 3,
      isTransmuted: true,
      originalCard: originalCard,
    };

    const deck: CardRunState = {
      hand: [transmuteCard],
      drawPile: [],
      discardPile: [],
      exhaustPile: [],
      currentFloor: 1,
      currentEncounter: 0,
      playerHP: 80,
      playerMaxHP: 80,
      playerShield: 0,
      hintsRemaining: 1,
      currency: 0,
      factPool: [],
      factCooldown: [],
      consecutiveCursedDraws: 0,
    };

    revertTransmutedCards(deck);

    expect(deck.hand).toHaveLength(1);
    const restored = deck.hand[0];
    expect(restored.id).toBe('revert-src');
    expect(restored.mechanicId).toBe('strike');
    expect(restored.cardType).toBe('attack');
    expect(restored.baseEffectValue).toBe(4);
    expect(restored.isTransmuted).toBeUndefined();
  });

  it('removes mastery 3+ extra cards (transmute_extra_remove_ sentinel)', () => {
    const extraCard: Card = makeAnyCard({
      id: 'extra-transmuted',
      mechanicId: 'scout',
      isTransmuted: true,
      originalCard: {
        id: 'transmute_extra_remove_abc123',
      } as Card,
    });
    const normalCard = makeAnyCard({ id: 'normal-card', mechanicId: 'strike' });

    const deck: CardRunState = {
      hand: [extraCard, normalCard],
      drawPile: [],
      discardPile: [],
      exhaustPile: [],
      currentFloor: 1,
      currentEncounter: 0,
      playerHP: 80,
      playerMaxHP: 80,
      playerShield: 0,
      hintsRemaining: 1,
      currency: 0,
      factPool: [],
      factCooldown: [],
      consecutiveCursedDraws: 0,
    };

    revertTransmutedCards(deck);

    // Extra card removed; normal card kept
    expect(deck.hand).toHaveLength(1);
    expect(deck.hand[0].id).toBe('normal-card');
  });

  it('non-transmuted cards are unchanged by revert', () => {
    const normalCard = makeAnyCard({ id: 'unchanged', mechanicId: 'strike' });

    const deck: CardRunState = {
      hand: [normalCard],
      drawPile: [],
      discardPile: [],
      exhaustPile: [],
      currentFloor: 1,
      currentEncounter: 0,
      playerHP: 80,
      playerMaxHP: 80,
      playerShield: 0,
      hintsRemaining: 1,
      currency: 0,
      factPool: [],
      factCooldown: [],
      consecutiveCursedDraws: 0,
    };

    revertTransmutedCards(deck);

    expect(deck.hand).toHaveLength(1);
    expect(deck.hand[0].id).toBe('unchanged');
    expect(deck.hand[0].mechanicId).toBe('strike');
  });

  it('full round-trip via resolveTransmutePick then revertTransmutedCards restores original', () => {
    const original = makeAnyCard({
      id: 'round-trip-src',
      factId: 'rt-fact',
      mechanicId: 'strike',
      cardType: 'attack',
      baseEffectValue: 4,
    });
    const candidate = makeAnyCard({
      id: 'cand-rt',
      mechanicId: 'block',
      cardType: 'shield',
      baseEffectValue: 3,
    });

    const turnState = makeTurnState({
      discardPile: [original],
    });

    // Apply transmute
    resolveTransmutePick(turnState, 'round-trip-src', [candidate]);

    // Confirm it's transmuted
    const transmuted = turnState.deck.discardPile.find(c => c.id === 'round-trip-src')!;
    expect(transmuted.mechanicId).toBe('block');
    expect(transmuted.isTransmuted).toBe(true);

    // Revert at encounter end
    revertTransmutedCards(turnState.deck);

    // Back to original
    const reverted = turnState.deck.discardPile.find(c => c.id === 'round-trip-src');
    expect(reverted).toBeDefined();
    expect(reverted!.mechanicId).toBe('strike');
    expect(reverted!.cardType).toBe('attack');
    expect(reverted!.baseEffectValue).toBe(4);
    expect(reverted!.isTransmuted).toBeUndefined();
    expect(reverted!.factId).toBe('rt-fact');
  });
});

describe('applyTransmuteSwap — source card not found edge case', () => {
  it('logs a warning and does not mutate state when sourceCardId is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const unrelatedCard = makeAnyCard({ id: 'unrelated', mechanicId: 'strike' });
    const candidate = makeAnyCard({ id: 'cand', mechanicId: 'block' });

    const turnState = makeTurnState({
      hand: [unrelatedCard],
      discardPile: [],
      drawPile: [],
      exhaustPile: [],
    });

    const handBefore = [...turnState.deck.hand];
    resolveTransmutePick(turnState, 'nonexistent-card-id', [candidate]);

    // Warning logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found in any pile'),
    );

    // State unchanged
    expect(turnState.deck.hand).toEqual(handBefore);
    expect(turnState.deck.discardPile).toHaveLength(0);

    warnSpy.mockRestore();
  });
});
