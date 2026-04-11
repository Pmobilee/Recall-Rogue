/**
 * Unit tests for damagePreviewService — display-only damage/block preview.
 * Updated 2026-04-09 (Pass 4): All CC values updated for CHARGE_CORRECT_MULTIPLIER 1.75→1.50.
 * Block card CC values recalculated for CC_MULT=1.50.
 * Updated 2026-04-11 (PRE-EXISTING-1 fix): lifetap L0 QP expectation updated 3→5 after
 * cardUpgradeService.ts stat table bump (3→5 for 2AP viability). No barbed_edge gate change
 * needed — the gate was always correct (isStrikeTagged check at line 196/215); test expectation
 * was simply stale from the stat table update.
 */

import { describe, it, expect } from 'vitest';
import { computeDamagePreview } from './damagePreviewService';
import type { DamagePreviewContext } from './damagePreviewService';
import type { Card } from '../data/card-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal attack card using the 'strike' mechanic (stat table L0 QP=4; mechanic QP=4). */
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

/** Build a minimal shield card using the 'block' mechanic (QP=4 at stat table L0; mechanic QP=5). */
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
    // strike stat table L0: QP=4, CC=round(4*1.50)=round(6)=6
    const card = makeAttackCard();
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(4);
    expect(result.ccValue).toBe(6);
    expect(result.qpModified).toBe('neutral');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — whetstone relic', () => {
  it('adds +3 flat to attack QP and CC after multipliers, both buffed', () => {
    // strike stat table L0 QP=4: round(4*1.0*1.0*1.0)+3=7; CC=6: round(6*1.0*1.0*1.0)+3=9
    const card = makeAttackCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['whetstone']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(7);
    expect(result.ccValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — glass_cannon relic', () => {
  it('applies +35% percent bonus to both QP and CC, both buffed', () => {
    // QP: round(4*1.35)=round(5.4)=5; CC: round(6*1.35)=round(8.1)=8
    const card = makeAttackCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['glass_cannon']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(5);
    expect(result.ccValue).toBe(8);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — cursed card QP', () => {
  it('reduces QP by 0.7x (nerfed) but leaves CC at 1.0x (neutral)', () => {
    // strike stat table L0 QP=4 → round(4*0.7)=round(2.8)=3; CC=6 → round(6*1.0)=6
    const card = makeAttackCard({ isCursed: true });
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(3);
    expect(result.ccValue).toBe(6);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — cursed + scar_tissue relic', () => {
  it('uses 0.85x cursed QP multiplier instead of 0.7x (no stacks)', () => {
    // QP: round(4*0.85)=round(3.4)=3; CC=6; scar_tissue flat with 0 stacks = 0
    const card = makeAttackCard({ isCursed: true });
    const ctx = baseCtx({ activeRelicIds: new Set(['scar_tissue']), scarTissueStacks: 0 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(3);
    expect(result.ccValue).toBe(6);
  });

  it('adds +2 flat per scar_tissue stack on top of 0.85x cursed QP', () => {
    // QP: round(4*0.85)=3, + 2*2 stacks=4 flat → 7; CC: 6 + 4 flat = 10
    const card = makeAttackCard({ isCursed: true });
    const ctx = baseCtx({ activeRelicIds: new Set(['scar_tissue']), scarTissueStacks: 2 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(7);
    expect(result.ccValue).toBe(10);
    expect(result.qpModified).toBe('buffed');
  });
});

describe('computeDamagePreview — enemyQpDamageMultiplier', () => {
  it('reduces QP by the multiplier (min 1), CC is unaffected', () => {
    // QP=4 * 0.3 = round(1.2) = 1 (min 1); CC=6 unchanged
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyQpDamageMultiplier: 0.3 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(1);
    expect(result.ccValue).toBe(6);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — charge resistant enemy', () => {
  it('halves QP (0.5x), CC is unaffected', () => {
    // QP=4 * 0.5 = round(2.0)=2; CC=6 unchanged
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyChargeResistant: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(2);
    expect(result.ccValue).toBe(6);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — hardcover armor', () => {
  it('reduces QP by flat hardcover amount, CC is unaffected', () => {
    // QP=4 - 2 = max(1, 2) = 2; CC=6
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyHardcover: 2 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(2);
    expect(result.ccValue).toBe(6);
    expect(result.qpModified).toBe('nerfed');
    expect(result.ccModified).toBe('neutral');
  });

  it('does not reduce QP when hardcover is already broken', () => {
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyHardcover: 2, enemyHardcoverBroken: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(4);
    expect(result.qpModified).toBe('neutral');
  });
});

describe('computeDamagePreview — vulnerable enemy', () => {
  it('applies 1.5x to both QP and CC, both buffed', () => {
    // QP=round(4*1.5)=round(6)=6; CC=round(6*1.5)=round(9)=9
    const card = makeAttackCard();
    const ctx = baseCtx({ enemyIsVulnerable: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — overclock', () => {
  it('doubles both QP and CC for attack cards, both buffed', () => {
    // QP=4*2=8; CC=6*2=12
    const card = makeAttackCard();
    const ctx = baseCtx({ overclockReady: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(8);
    expect(result.ccValue).toBe(12);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — empower buff', () => {
  it('increases both QP and CC by buff%, both buffed', () => {
    // 50% empower with stat table L0 QP=4: QP round(4*1.5)=round(6)=6; CC round(6*1.5)=round(9)=9
    const card = makeAttackCard();
    const ctx = baseCtx({ buffNextCard: 50 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(6);
    expect(result.ccValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — shield + stone_wall', () => {
  it('adds +3 flat block to both QP and CC, both buffed', () => {
    // block stat table L0 QP=4, CC=round(4*1.50)=6
    // With stone_wall: QP: round((4+3)*1.0)=7; CC: round((6+3)*1.0)=9
    const card = makeShieldCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['stone_wall']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(7);
    expect(result.ccValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — shield + bastions_will', () => {
  it('applies +25% to QP only, CC is neutral', () => {
    // block stat table L0 QP=4: round(4*1.25)=round(5)=5; CC=6 (no bastions_will bonus on CC)
    const card = makeShieldCard();
    const ctx = baseCtx({ activeRelicIds: new Set(['bastions_will']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(5);
    expect(result.ccValue).toBe(6);
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
    // QP=4*2=8; CC=6*2=12
    const card = makeAttackCard();
    const ctx = baseCtx({ doubleStrikeReady: true });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(8);
    expect(result.ccValue).toBe(12);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — stacking: whetstone + vulnerable + 50% buff', () => {
  it('compounds in the correct order (scale then flat then vulnerable)', () => {
    const card = makeAttackCard();
    // Stat table L0 QP=4, CC=7; effectMultiplier=1.0
    //   QP: qpScaled = round(4 * 1.0 * 1.5buff * 1.0relicPct * 1.0oc) = round(6) = 6
    //   + whetstone flat = 3 → 9
    //   vulnerable ×1.5 = round(9*1.5) = round(13.5) = 14
    //   CC: base=6, ccScaled = round(6 * 1.0 * 1.5 * 1.0 * 1.0) = round(9) = 9
    //   + 3 flat = 12
    //   vulnerable: round(12*1.5) = round(18) = 18
    const ctx = baseCtx({
      activeRelicIds: new Set(['whetstone']),
      buffNextCard: 50,
      enemyIsVulnerable: true,
    });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(14);
    expect(result.ccValue).toBe(18);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — fallback (no mechanic definition)', () => {
  it('uses baseEffectValue directly for cards with unknown mechanicId (effectMultiplier ignored)', () => {
    const card: Card = {
      id: 'wild_1',
      factId: 'fact_4',
      cardType: 'attack',
      domain: 'general_knowledge',
      tier: '2a',
      baseEffectValue: 10,
      effectMultiplier: 1.3, // deprecated — not applied by resolver or preview
      mechanicId: 'unknown_future_mechanic',
      masteryLevel: 0,
    };
    // Tier-based effectMultiplier removed. Legacy fallback = baseEffectValue directly.
    // nakedQpBase = 10
    // nakedCcBase = round(10 * 1.50) = round(15) = 15 (CHARGE_CORRECT_MULTIPLIER=1.50)
    // No other modifiers in baseCtx
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(10);
    expect(result.ccValue).toBe(15);
  });
});

describe('computeDamagePreview — mastery bonus', () => {
  it('adds mastery flat bonus (stat table L5 for strike QP=8) to QP and CC', () => {
    // strike stat table L5: QP=8; masteryBonus = 8-4 = 4
    // nakedQpBase = Math.round(4 + 4) = 8
    // nakedCcBase = Math.round(8 * 1.50) = Math.round(12) = 12
    // effectMultiplier=1.0, no other modifiers → qpFinal=8, ccFinal=12
    // compared to nakedQpBase=8 and nakedCcBase=12 → both neutral
    const card = makeAttackCard({ masteryLevel: 5 });
    const result = computeDamagePreview(card, baseCtx());
    expect(result.qpValue).toBe(8);
    expect(result.ccValue).toBe(12);
    expect(result.qpModified).toBe('neutral');
    expect(result.ccModified).toBe('neutral');
  });
});

describe('computeDamagePreview — inscription fury bonus', () => {
  it('adds flat bonus to attack cards only', () => {
    // Stat table L0 QP=4 + fury=5 = 9 effectiveBase; round(9*1.0)=9
    // CC: nakedCcBase=6, ccEffective=6+0(barbed)+5(fury)=11; ccFinal=round(11*1.0)=11
    const card = makeAttackCard();
    const ctx = baseCtx({ inscriptionFuryBonus: 5 });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(9);
    expect(result.ccValue).toBe(11);
    expect(result.qpModified).toBe('buffed');
    expect(result.ccModified).toBe('buffed');
  });
});

describe('computeDamagePreview — barbed_edge synergy (strike-tagged)', () => {
  it('gives strike cards +3 sharpenedEdge + +2 relicFlat = +5 total for barbed_edge', () => {
    // strike stat table L0 QP=4, has 'strike' tag
    // sharpenedEdgeBonus=3 → effectiveBase=7; scaled=round(7*1.0)=7; + relicFlat=2 → 9
    const card = makeAttackCard(); // mechanicId='strike', has 'strike' tag
    const ctx = baseCtx({ activeRelicIds: new Set(['barbed_edge']) });
    const result = computeDamagePreview(card, ctx);
    expect(result.qpValue).toBe(9);
    expect(result.qpModified).toBe('buffed');
  });

  it('card without strike tag gets no barbed_edge bonus', () => {
    // lifetap stat table L0 QP=5 (bumped 3→5 in cardUpgradeService.ts for 2AP viability),
    // mechanic.quickPlayValue=4; masteryBonus=5-4=1; nakedQpBase=5; not strike-tagged.
    // barbed_edge isStrikeTagged=false → sharpenedEdgeBonus=0, relicFlat=0; qpValue=5
    const card = makeAttackCard({ mechanicId: 'lifetap' });
    const ctx = baseCtx({ activeRelicIds: new Set(['barbed_edge']) });
    const result = computeDamagePreview(card, ctx);
    // lifetap QP=5, no strike tag → no sharpenedEdge, no relic flat bonus from barbed_edge
    expect(result.qpValue).toBe(5);
    expect(result.qpModified).toBe('neutral');
  });
});
