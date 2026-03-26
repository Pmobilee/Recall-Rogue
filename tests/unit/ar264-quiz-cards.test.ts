/**
 * AR-264: Quiz-Integrated Card Tests
 * Tests resolver logic for Recall, Precision Strike, Knowledge Ward, Smite, and Feedback Loop.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';
import {
  resetAura,
  adjustAura,
  getAuraLevel,
} from '../../src/services/knowledgeAuraSystem';
import { resetReviewQueue } from '../../src/services/reviewQueueSystem';

// ── Helpers ──

function makeCard(overrides: Partial<Card> & { mechanicId: string }): Card {
  const mechanic = getMechanicDefinition(overrides.mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'attack') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 8,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId: overrides.mechanicId,
    mechanicName: mechanic?.name,
    secondaryValue: mechanic?.secondaryValue,
    ...overrides,
  };
}

function makePlayer(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  return {
    hp: 80,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
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
    description: 'Test enemy',
  };
  return {
    template,
    currentHP: 100,
    maxHP: 100,
    nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' },
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

const player = makePlayer();
const enemy = makeEnemy();

// ─────────────────────────────────────────────────────────
// Recall
// ─────────────────────────────────────────────────────────

describe('Recall (AR-264)', () => {
  beforeEach(() => {
    resetAura();
    resetReviewQueue();
  });

  it('QP: deals 10 damage', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(10);
  });

  it('CC (normal fact): deals 20 damage, no heal', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      wasReviewQueueFact: false,
    });
    expect(result.damageDealt).toBe(20);
    expect(result.healApplied).toBe(0);
  });

  it('CC (Review Queue fact): deals 30 damage + heals 6', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      wasReviewQueueFact: true,
    });
    expect(result.damageDealt).toBe(30);
    expect(result.healApplied).toBe(6);
  });

  it('CC defaults to normal (no wasReviewQueueFact) when field is absent', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(20);
    expect(result.healApplied).toBe(0);
  });

  it('CW: deals 6 damage', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────
// Precision Strike
// ─────────────────────────────────────────────────────────

describe('Precision Strike (AR-264)', () => {
  beforeEach(() => {
    resetAura();
    resetReviewQueue();
  });

  it('QP: deals 8 damage', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(8);
  });

  it('CC at 2 distractors (mastery 0): deals 24 damage (8 × 3)', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 2,
    });
    expect(result.damageDealt).toBe(24);
  });

  it('CC at 3 distractors: deals 32 damage (8 × 4)', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 3,
    });
    expect(result.damageDealt).toBe(32);
  });

  it('CC at 4 distractors (mastery 3+): deals 40 damage (8 × 5)', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 4,
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC defaults to 2 distractors when distractorCount absent', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(24);
  });

  it('CW: deals 4 damage', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────
// Knowledge Ward
// ─────────────────────────────────────────────────────────

describe('Knowledge Ward (AR-264)', () => {
  beforeEach(() => {
    resetAura();
    resetReviewQueue();
  });

  it('QP at 0 correct charges (treated as 1): 6 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      correctChargesThisEncounter: 0,
    });
    expect(result.shieldApplied).toBe(6);
  });

  it('QP at 1 correct charge: 6 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      correctChargesThisEncounter: 1,
    });
    expect(result.shieldApplied).toBe(6);
  });

  it('QP at 3 correct charges: 18 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      correctChargesThisEncounter: 3,
    });
    expect(result.shieldApplied).toBe(18);
  });

  it('QP at 5 correct charges (cap): 30 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      correctChargesThisEncounter: 5,
    });
    expect(result.shieldApplied).toBe(30);
  });

  it('QP at 6 correct charges (capped to 5): 30 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      correctChargesThisEncounter: 6,
    });
    expect(result.shieldApplied).toBe(30);
  });

  it('CC at 0 correct charges (treated as 1): 10 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      correctChargesThisEncounter: 0,
    });
    expect(result.shieldApplied).toBe(10);
  });

  it('CC at 3 correct charges: 30 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      correctChargesThisEncounter: 3,
    });
    expect(result.shieldApplied).toBe(30);
  });

  it('CC at 5 correct charges (cap): 50 block', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      correctChargesThisEncounter: 5,
    });
    expect(result.shieldApplied).toBe(50);
  });

  it('CW: always 4 block flat (no charge scaling)', () => {
    const card = makeCard({ mechanicId: 'knowledge_ward' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
      correctChargesThisEncounter: 5,
    });
    expect(result.shieldApplied).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────
// Smite
// ─────────────────────────────────────────────────────────

describe('Smite (AR-264)', () => {
  beforeEach(() => {
    resetAura(); // starts at 5
    resetReviewQueue();
  });

  it('QP: deals 10 damage (flat, independent of Aura)', () => {
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(10);
  });

  it('CC at Aura 5 (neutral, start): deals 40 damage (10 + 6×5)', () => {
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC at Aura 0: deals 10 damage (10 + 6×0)', () => {
    adjustAura(-5); // bring to 0
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(10);
  });

  it('CC at Aura 3 (Brain Fog): deals 28 damage (10 + 6×3)', () => {
    adjustAura(-2); // 5 → 3
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(28);
  });

  it('CC at Aura 8 (Flow State): deals 58 damage (10 + 6×8)', () => {
    adjustAura(3); // 5 → 8
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(58);
  });

  it('CC at Aura 10 (max Flow State): deals 70 damage (10 + 6×10)', () => {
    adjustAura(5); // 5 → 10
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(70);
  });

  it('CW: deals 6 damage and reduces Aura by 1', () => {
    // Aura starts at 5
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(6);
    // Aura should be 5 - 1 = 4 (the extra -1 from Smite CW)
    expect(getAuraLevel()).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────
// Feedback Loop
// ─────────────────────────────────────────────────────────

describe('Feedback Loop (AR-264)', () => {
  beforeEach(() => {
    resetAura(); // starts at 5
    resetReviewQueue();
  });

  it('QP: deals 5 damage', () => {
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(5);
  });

  it('CC in neutral state (Aura 5): deals 40 damage', () => {
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC in brain_fog state (Aura ≤ 3): deals 40 damage (no bonus)', () => {
    adjustAura(-2); // 5 → 3 (brain_fog threshold)
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC in flow_state (Aura ≥ 7): deals 56 damage (40 + 16)', () => {
    adjustAura(2); // 5 → 7 (flow_state threshold)
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(56);
  });

  it('CC at Aura 10 (max flow_state): deals 56 damage', () => {
    adjustAura(5); // 5 → 10
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(56);
  });

  it('CW: deals 0 damage', () => {
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(0);
    expect(result.finalValue).toBe(0);
  });

  it('CW: reduces Aura by 3 (extra crash penalty)', () => {
    // Aura starts at 5; CW adjustAura(-3) brings it to 2
    const card = makeCard({ mechanicId: 'feedback_loop' });
    resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(getAuraLevel()).toBe(2);
  });

  it('CW at Aura 2: crashes to 0 (clamped at min)', () => {
    adjustAura(-3); // 5 → 2
    const card = makeCard({ mechanicId: 'feedback_loop' });
    resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(getAuraLevel()).toBe(0); // 2 - 3 clamped to 0
  });

  it('L3 mastery QP: applies 1 Weakness to enemy', () => {
    const card = makeCard({ mechanicId: 'feedback_loop', masteryLevel: 3 });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.statusesApplied.some(s => s.type === 'weakness')).toBe(true);
  });

  it('L2 mastery QP: does NOT apply Weakness', () => {
    const card = makeCard({ mechanicId: 'feedback_loop', masteryLevel: 2 });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.statusesApplied.some(s => s.type === 'weakness')).toBe(false);
  });
});
