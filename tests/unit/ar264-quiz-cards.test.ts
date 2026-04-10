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

  it('QP: deals 5 damage (stat table L0 QP=5)', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(5);
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

  it('CW: deals 1 damage (chargeWrongValue=6 + masteryBonus=-5 = 1, stat table L0 QP=5 vs mechanic QP=10)', () => {
    const card = makeCard({ mechanicId: 'recall' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(1);
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

  it('QP: deals 5 damage (stat table L0 QP=5)', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(5);
  });

  it('CC at 2 distractors (mastery 0): deals 18 damage (6 × 3) [Pass 8 balance]', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 2,
    });
    expect(result.damageDealt).toBe(18);
  });

  it('CC at 3 distractors: deals 24 damage (6 × 4) [Pass 8 balance]', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 3,
    });
    expect(result.damageDealt).toBe(24);
  });

  it('CC at 4 distractors (mastery 3+): deals 30 damage (6 × 5) [Pass 8 balance]', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      distractorCount: 4,
    });
    expect(result.damageDealt).toBe(30);
  });

  it('CC defaults to 2 distractors when distractorCount absent', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(18);
  });

  it('CW: deals 1 damage (chargeWrongValue=4 + masteryBonus=-3 = 1, stat table L0 QP=5 vs mechanic QP=8)', () => {
    const card = makeCard({ mechanicId: 'precision_strike' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(1);
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
    resetAura(); // starts at 0 (fog=0, flow_state)
    resetReviewQueue();
  });

  it('QP: deals 6 damage (stat table L0 QP=6; flat, independent of fog)', () => {
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(6);
  });

  it('CC at fog 0 (flow_state, start): deals 70 damage (10 + 6×(10-0))', () => {
    // fog starts at 0 after resetAura(); formula: 10 + 6*(10-fog) = 10 + 60 = 70
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(70);
  });

  it('CC at fog 10 (max brain_fog): deals 10 damage (10 + 6×(10-10))', () => {
    adjustAura(10); // 0 → 10
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(10);
  });

  it('CC at fog 7 (brain_fog): deals 28 damage (10 + 6×(10-7))', () => {
    adjustAura(7); // 0 → 7
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(28);
  });

  it('CC at fog 2 (flow_state): deals 58 damage (10 + 6×(10-2))', () => {
    adjustAura(2); // 0 → 2
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(58);
  });

  it('CC at fog 0 (max flow_state): deals 70 damage (10 + 6×(10-0))', () => {
    // Already at 0 after resetAura(); same as start state
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(70);
  });

  it('CW: deals 6 damage and increases fog by 1', () => {
    // fog starts at 0; CW adjustAura(+1) → fog = 1
    const card = makeCard({ mechanicId: 'smite' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(6);
    // fog should be 0 + 1 = 1 (the extra +1 fog from Smite CW)
    expect(getAuraLevel()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// Feedback Loop
// ─────────────────────────────────────────────────────────

describe('Feedback Loop (AR-264)', () => {
  beforeEach(() => {
    resetAura(); // starts at 0 (fog=0, flow_state)
    resetReviewQueue();
  });

  it('QP: deals 3 damage (stat table L0 QP=3)', () => {
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    expect(result.damageDealt).toBe(3);
  });

  it('CC at fog 0 (flow_state, start): deals 40 damage (28 + 12 bonus) [Pass 8 balance]', () => {
    // fog=0 → flow_state; CC grants +12 bonus
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC in brain_fog state (fog ≥ 7): deals 28 damage (no bonus) [Pass 8 balance]', () => {
    adjustAura(7); // 0 → 7 (brain_fog threshold)
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(28);
  });

  it('CC in flow_state (fog ≤ 2): deals 40 damage (28 + 12) [Pass 8 balance]', () => {
    // fog=0 is already flow_state; no adjustment needed
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(40);
  });

  it('CC at fog 10 (max brain_fog): deals 28 damage (no bonus) [Pass 8 balance]', () => {
    adjustAura(10); // 0 → 10
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.damageDealt).toBe(28);
  });

  it('CW: deals 0 damage', () => {
    const card = makeCard({ mechanicId: 'feedback_loop' });
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.damageDealt).toBe(0);
    expect(result.finalValue).toBe(0);
  });

  it('CW: increases fog by 3 (extra fog penalty)', () => {
    // fog starts at 0; CW adjustAura(+3) brings it to 3
    const card = makeCard({ mechanicId: 'feedback_loop' });
    resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(getAuraLevel()).toBe(3);
  });

  it('CW at fog 8: crashes to 10 (clamped at max)', () => {
    adjustAura(8); // 0 → 8
    const card = makeCard({ mechanicId: 'feedback_loop' });
    resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(getAuraLevel()).toBe(10); // 8 + 3 clamped to 10
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
