/**
 * Unit tests for damagePreviewService — display-only damage/block preview.
 * Updated 2026-04-01: All CC values updated for CHARGE_CORRECT_MULTIPLIER 2.0→1.75.
 * Block card CC values recalculated for CC_MULT=1.75.
 */

import { describe, it, expect } from 'vitest';
import { computeDamagePreview } from './damagePreviewService';
import type { DamagePreviewContext } from './damagePreviewService';
import type { Card } from '../data/card-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal attack card using the 'strike' mechanic (stat table L0 QP=3; mechanic QP=4). */
function makeAttackCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test_card',
    factId: 'fact_1',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    mechanicId: 'strike',
    masteryLevel: 0,
    ...overrides,
  };
}

/** Build a minimal shield card using the 'block' mechanic (QP=3 at stat table L0; mechanic QP=5). */
function makeShieldCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test_shield',
    factId: 'fact_2',
    cardType: 'shield',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 6,
    effectMultiplier: 1.0,
    mechanicId: 'block',
    masteryLevel: 0,
    ...overrides,
  };
}

/** Baseline context with no modifiers active. */
function baseCtx(overrides: Partial<DamagePreviewContext> = {}): DamagePreviewContext {
  return {
    activeRelicIds: new Set(),
    buffNextCard: 0,
    overclockReady: false,
    doubleStrikeReady: false,
    firstAttackUsed: false,
    playerHpPercent: 1.0,
    enemyHpPercent: 1.0,
    enemyPoisonStacks: 0,
    enemyBurnStacks: 0,
    enemyIsVulnerable: false,
    enemyQpDamageMultiplier: undefined,
    enemyChargeResistant: false,
    enemyHardcover: 0,
    enemyHardcoverBroken: false,
    inscriptionFuryBonus: 0,
    cardsPlayedThisTurn: 0,
    encounterTurnNumber: 0,
    scarTissueStacks: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeDamagePreview — base case', () => {
  it('returns mechanic QP and CC values with neutral modifiers when no context active', () => {
    // strike stat table L0: QP=3, CC=round(3*1.75)=round(5.25)=5
    const card = makeAttackCard();
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(3);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('neutral');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — whetstone relic', () => {
  it('adds +3 flat to attack QP and CC after multipliers, both buffed', () => {
    // strike stat table L0 QP=3: round(3*1.0*1.0*1.0)+3=6; CC=5: round(5*1.0*1.0*1.0)+3=8
    const card = makeAttackCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['whetstone']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — glass_cannon relic', () => {
  it('applies +35% percent bonus to both QP and CC, both buffed', () => {
    // QP: round(3*1.35)=round(4.05)=4; CC: round(5*1.35)=round(6.75)=7
    const card = makeAttackCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['glass_cannon']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(4);
    expect(result.ccValue).toBe(7);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — cursed card QP', () => {
  it('reduces QP by 0.7x (nerfed) but leaves CC at 1.0x (neutral)', () => {
    // strike stat table L0 QP=3 → round(3*0.7)=round(2.1)=2; CC=5 → round(5*1.0)=5
    const card = makeAttackCard({ isCursed: true });
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(2);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — cursed + scar_tissue relic', () => {
  it('uses 0.85x cursed QP multiplier instead of 0.7x (no stacks)', () => {
    // QP: round(3*0.85)=round(2.55)=3; CC=5; scar_tissue flat with 0 stacks = 0
    const card = makeAttackCard({ isCursed: true });
    const ctx = baseCtx({ activeRelicIds: new Set(['scar_tissue']), scarTissueStacks: 0 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(3);
    expect(result.ccValue).toBe(5);
  });

  it('adds +2 flat per scar_tissue stack on top of 0.85x cursed QP', () => {
    // QP: round(3*0.85)=3, + 2*2 stacks=4 flat → 7; CC: 5 + 4 flat = 9
    const card = makeAttackCard({ isCursed: true });
    const ctx = baseCtx({ activeRelicIds: new Set(['scar_tissue']), scarTissueStacks: 2 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(7);
    expect(result.ccValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
  });
});

describe('computeDamagePreview — enemyQpDamageMultiplier', () => {
  it('reduces QP by the multiplier (min 1), CC is unaffected', () => {
    // QP=3 * 0.3 = round(0.9) = 1 (max 1); CC=5 unchanged
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyQpDamageMultiplier: 0.3 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(1);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — charge resistant enemy', () => {
  it('halves QP (0.5x), CC is unaffected', () => {
    // QP=3 * 0.5 = round(1.5)=2 (max 1); CC=5 unchanged
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyChargeResistant: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(2);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — hardcover armor', () => {
  it('reduces QP by flat hardcover amount, CC is unaffected', () => {
    // QP=3 - 2 = max(1, 1) = 1; CC=5
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyHardcover: 2 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(1);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });

  it('does not reduce QP when hardcover is already broken', () => {
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyHardcover: 2, enemyHardcoverBroken: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(3);
    expect(result.qpModified).toBe('neutral');
  });
});

describe('computeDamagePreview — vulnerable enemy', () => {
  it('applies 1.5x to both QP and CC, both buffed', () => {
    // QP=round(3*1.5)=round(4.5)=5; CC=round(5*1.5)=round(7.5)=8
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyIsVulnerable: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(5);
    expect(result.ccValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — overclock', () => {
  it('doubles both QP and CC for attack cards, both buffed', () => {
    // QP=3*2=6; CC=5*2=10
    const card = makeAttackCard();
    const ctx = baseCtx({ overclockReady: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(10);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — empower buff', () => {
  it('increases both QP and CC by buff%, both buffed', () => {
    // 50% empower with stat table L0 QP=3: QP round(3*1.5)=round(4.5)=5; CC round(5*1.5)=round(7.5)=8
    const card = makeAttackCard();
    const ctx = baseCtx({ buffNextCard: 50 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(5);
    expect(result.ccValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — shield + stone_wall', () => {
  it('adds +3 flat block to both QP and CC, both buffed', () => {
    // block stat table L0 QP=3, CC=round(3*1.75)=5
    // With stone_wall: QP: round((3+3)*1.0)=6; CC: round((5+3)*1.0)=8
    const card = makeShieldCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['stone_wall']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — shield + bastions_will', () => {
  it('applies +25% to QP only, CC is neutral', () => {
    // block stat table L0 QP=3: round(3*1.25)=round(3.75)=4; CC=5 (no bastions_will bonus on CC)
    const card = makeShieldCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['bastions_will']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(4);
    expect(result.ccValue).toBe(5);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — shield + hollow_armor', () => {
  it('returns 0 block on turn > 0, both nerfed', () => {
    const card = makeShieldCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['hollow_armor']), encounterTurnNumber: 1 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(0);
    expect(result.ccValue).toBe(0);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('nerfed');
  });

  it('does NOT zero block on turn 0', () => {
    const card = makeShieldCard();
    const result = computeDamagePreview(card, baseCtx({ activeRelicIds: new Set(['hollow_armor']), encounterTurnNumber: 0 }));
    expect(result.qpValue).toBeGreaterThan(0);
  });
});

describe('computeDamagePreview — non-attack/shield card', () => {
  it('returns neutral modifiers for a buff card', () => {
    const card: Card = {
      id: 'buff_1',
      factId: 'fact_3',
      cardType: 'buff',
      domain: 'general_knowledge',
      tier: '1',
      baseEffectValue: 25,
      effectMultiplier: 1.0,
      mechanicId: 'empower',
      masteryLevel: 0,
    };
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpModified).toBe('neutral');
    expect(result.ccModified).toBe('neutral');
  });

  it('overclock still doubles utility-type cards', () => {
    const card: Card = {
      id: 'draw_1',
      factId: 'fact_5',
      cardType: 'utility',
      domain: 'general_knowledge',
      tier: '1',
      baseEffectValue: 2,
      effectMultiplier: 1.0,
      mechanicId: 'draw',
      masteryLevel: 0,
    };
    const noOc = computeDamagePreview(card, baseCtx());
    const withOc = computeDamagePreview(card, baseCtx({ overclockReady: true }));
    expect(withOc.qpValue).toBe(noOc.qpValue * 2);
  });
});

describe('computeDamagePreview — double strike', () => {
  it('doubles both QP and CC for attack cards, both buffed', () => {
    // QP=3*2=6; CC=5*2=10
    const card = makeAttackCard();
    const ctx = baseCtx({ doubleStrikeReady: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(10);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — stacking: whetstone + vulnerable + 50% buff', () => {
  it('compounds in the correct order (scale then flat then vulnerable)', () => {
    const card = makeAttackCard();
    // Stat table L0 QP=3, CC=5; effectMultiplier=1.0
    //   QP: qpScaled = round(3 * 1.0 * 1.5buff * 1.0relicPct * 1.0oc) = round(4.5) = 5
    //   + whetstone flat = 3 → 8
    //   vulnerable ×1.5 = round(8*1.5) = round(12) = 12
    //   CC: base=5, ccScaled = round(5 * 1.0 * 1.5 * 1.0 * 1.0) = round(7.5) = 8
    //   + 3 flat = 11
    //   vulnerable: round(11*1.5) = round(16.5) = 17
    const ctx = baseCtx({
      activeRelicIds: new Set(['whetstone']),
      buffNextCard: 50,
      enemyIsVulnerable: true,
    });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(12);
    expect(result.ccValue).toBe(17);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — fallback (no mechanic definition)', () => {
  it('uses baseEffectValue * effectMultiplier for cards with unknown mechanicId', () => {
    const card: Card = {
      id: 'wild_1',
      factId: 'fact_4',
      cardType: 'attack',
      domain: 'general_knowledge',
      tier: '2a',
      baseEffectValue: 10,
      effectMultiplier: 1.3,
      mechanicId: 'unknown_future_mechanic',
      masteryLevel: 0,
    };
    // nakedQpBase = round(10 * 1.3) = 13 (from legacy fallback path)
    // nakedCcBase = round(13 * 1.75) = round(22.75) = 23 (CHARGE_CORRECT_MULTIPLIER=1.75)
    // qpFinal = round(13 * 1.3) = round(16.9) = 17 (effectMultiplier applied again in pipeline)
    // ccFinal = round(23 * 1.3) = round(29.9) = 30
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(17);
    expect(result.ccValue).toBe(30);
  });
});

describe('computeDamagePreview — mastery bonus', () => {
  it('adds mastery flat bonus (stat table L5 for strike QP=8) to QP and CC', () => {
    // strike stat table L5: QP=8; masteryBonus = 8-4 = 4
    // nakedQpBase = Math.round(4 + 4) = 8
    // nakedCcBase = Math.round(8 * 1.75) = Math.round(14) = 14
    // effectMultiplier=1.0, no other modifiers → qpFinal=8, ccFinal=14
    // compared to nakedQpBase=8 and nakedCcBase=14 → both neutral
    const card = makeAttackCard({ masteryLevel: 5 });
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(8);
    expect(result.ccValue).toBe(14);
    expect(result.qpModified).toBe('neutral');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — inscription fury bonus', () => {
  it('adds flat bonus to attack cards only', () => {
    // Stat table L0 QP=3 + fury=5 = 8 effectiveBase; round(8*1.0)=8
    // CC: nakedCcBase=5, ccEffective=5+0(barbed)+5(fury)=10; ccFinal=round(10*1.0)=10
    const card = makeAttackCard();
    const ctx = baseCtx({ inscriptionFuryBonus: 5 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(8);
    expect(result.ccValue).toBe(10);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — barbed_edge synergy (strike-tagged)', () => {
  it('gives strike cards +3 sharpenedEdge + +2 relicFlat = +5 total for barbed_edge', () => {
    // strike stat table L0 QP=3, has 'strike' tag
    // sharpenedEdgeBonus=3 → effectiveBase=6; scaled=round(6*1.0)=6; + relicFlat=2 → 8
    const card = makeAttackCard(); // mechanicId='strike', has 'strike' tag
    const ctx = baseCtx({ activeRelicIds: new Set(['barbed_edge']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
  });

  it('card without strike tag gets no barbed_edge bonus', () => {
    // lifetap stat table L0 QP=3, not strike-tagged
    const card = makeAttackCard({ mechanicId: 'lifetap' });
    const ctx = baseCtx({ activeRelicIds: new Set(['barbed_edge']) });
    const result = computeDamagePreview(card, ctx);
    // lifetap QP=3, no strike tag → no sharpenedEdge, no relic flat bonus from barbed_edge
    expect(result.qpValue).toBe(3);
    expect(result.qpModified).toBe('neutral');
  });
});
