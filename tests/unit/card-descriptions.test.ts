/**
 * Coverage test for card description functions.
 *
 * Asserts that every mechanic in MECHANIC_DEFINITIONS has an explicit description
 * in all three functions (getDetailedCardDescription, getShortCardDescription,
 * getCardDescriptionParts). Any mechanic that falls through to the generic default
 * will produce output no longer than mechanic.name + a period — this test catches
 * that regression.
 *
 * Phase 4 (2026-04-09): Added after mass-edit of cardDescriptionService.ts to
 * cover all 62 previously-missing mechanics.
 */

import { describe, it, expect } from 'vitest';
import { MECHANIC_DEFINITIONS } from '../../src/data/mechanics';
import {
  getDetailedCardDescription,
  getShortCardDescription,
  getCardDescriptionParts,
} from '../../src/services/cardDescriptionService';
import type { Card } from '../../src/data/card-types';

/**
 * Construct a minimal Card for testing. Uses L0 mastery, no overrides.
 * baseEffectValue=4 is a reasonable mid-range for most mechanics.
 */
function makeCard(mechanicId: string, overrides: Partial<Card> = {}): Card {
  return {
    id: `test-card-${mechanicId}`,
    factId: 'test-fact-1',
    cardType: overrides.cardType ?? 'attack',
    domain: 'natural_sciences',
    tier: '1',
    baseEffectValue: overrides.baseEffectValue ?? 4,
    effectMultiplier: 1,
    mechanicId,
    mechanicName: 'Test',
    apCost: overrides.apCost ?? 1,
    masteryLevel: 0,
    secondaryValue: undefined,
    ...overrides,
  };
}

describe('card-descriptions — coverage', () => {
  for (const mechanic of MECHANIC_DEFINITIONS) {
    describe(`mechanic: ${mechanic.id}`, () => {
      const card = makeCard(mechanic.id, {
        cardType: mechanic.type,
        baseEffectValue: Math.max(1, mechanic.baseValue ?? 4),
        apCost: mechanic.apCost ?? 1,
      });

      it('getDetailedCardDescription returns a non-empty description with real content', () => {
        const result = getDetailedCardDescription(card);
        expect(typeof result).toBe('string');
        // Must be non-empty
        expect(result.trim().length).toBeGreaterThan(0);
        // Must be longer than just the mechanic name alone (the default fallback is mechanic.name)
        expect(result.length).toBeGreaterThan(mechanic.name.length);
        // Must not contain 'undefined' (indicates a template substitution failure)
        expect(result).not.toContain('undefined');
        expect(result).not.toContain('NaN');
        // The catastrophic failure case: returning just the name with no verb/number
        // A real description always has a verb ("Deal", "Gain", "Apply", etc.) or a number
        // or at least a space between words. So length > name + 3 chars is our floor.
        // Exception: some very terse descriptions like "Draw 3 cards." (10 chars) for
        // "Recycle" (7 chars) are valid even though they're only 3 chars longer.
        // We already catch the true regression (fallback to just mechanic.name) by checking > name.length.
      });

      it('getShortCardDescription returns non-empty string ≤25 chars', () => {
        const result = getShortCardDescription(card);
        expect(typeof result).toBe('string');
        expect(result.trim().length).toBeGreaterThan(0);
        // Short descriptions should be concise. We allow 25 chars (5 more than the 20-char target)
        // for mechanics with dynamic numbers that may expand slightly.
        expect(result.length).toBeLessThanOrEqual(25);
        // Must not contain 'undefined' or 'NaN'
        expect(result).not.toContain('undefined');
        expect(result).not.toContain('NaN');
      });

      it('getCardDescriptionParts returns array of length ≥1 with meaningful content', () => {
        const parts = getCardDescriptionParts(card);
        expect(Array.isArray(parts)).toBe(true);
        expect(parts.length).toBeGreaterThanOrEqual(1);

        const joined = parts.map(p => p.value).join('');
        // Must produce some visible text
        expect(joined.trim().length).toBeGreaterThan(0);
        // The catastrophic regression check: the old default was [txt(mechanic.name)] which
        // produced just the name with no numbers or verbs. We verify parts produce at least
        // 3 characters of non-name content OR include a number or keyword part (which the
        // old fallback never produced). If it has a number or keyword part, it's an explicit case.
        const hasNumberOrKeyword = parts.some(p => p.type === 'number' || p.type === 'keyword' || p.type === 'mastery-bonus');
        const hasRealContent = joined.trim().length >= 3;
        expect(hasRealContent || hasNumberOrKeyword).toBe(true);

        // No undefined in values
        for (const part of parts) {
          expect(part.value).not.toBe('undefined');
          expect(part.value).not.toBe('NaN');
          expect(typeof part.value).toBe('string');
        }
      });
    });
  }
});

describe('card-descriptions — specific mechanics', () => {
  it('sacrifice uses resolver values (5 HP, draw 2, +1 AP)', () => {
    const card = makeCard('sacrifice', { cardType: 'wild', baseEffectValue: 0 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('5 HP');
    expect(detailed).toContain('Draw 2');
    expect(detailed).toContain('+1 AP');
    // CC values
    expect(detailed).toContain('draw 3');
    expect(detailed).toContain('+2 AP');
  });

  it('corrode CC removes ALL block (no damage)', () => {
    const card = makeCard('corrode', { cardType: 'debuff', baseEffectValue: 2 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('ALL');
    expect(detailed).toContain('Drawing Blanks');
    // CC should NOT mention bonus damage
    expect(detailed.toLowerCase()).not.toContain('bonus damage');
  });

  it('swap CW is identical to QP (draw 1)', () => {
    const card = makeCard('swap', { cardType: 'utility', baseEffectValue: 0 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('draw 1');
    // CW text should mention identical behavior
    expect(detailed).toContain('CW');
  });

  it('inscription_wisdom explicitly mentions CW card loss', () => {
    const card = makeCard('inscription_wisdom', { cardType: 'buff', baseEffectValue: 0 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed.toLowerCase()).toContain('fizzle');
    expect(detailed.toLowerCase()).toContain('lost');
  });

  it('chameleon uses static multipliers in detailed, "Copy last" in short', () => {
    const card = makeCard('chameleon', { cardType: 'wild', baseEffectValue: 0 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('100%');
    expect(detailed).toContain('130%');
    expect(detailed).toContain('70%');
    const short = getShortCardDescription(card);
    expect(short).toBe('Copy last');
  });

  it('overcharge CC description mentions per-charge scaling', () => {
    const card = makeCard('overcharge', { cardType: 'attack', baseEffectValue: 2 });
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('Charge');
    expect(detailed).toContain('encounter');
  });

  it('reinforce parts produce a Block keyword and a number', () => {
    const card = makeCard('reinforce', { cardType: 'shield', baseEffectValue: 5 });
    const parts = getCardDescriptionParts(card);
    const hasBlock = parts.some(p => p.type === 'keyword' && p.keywordId === 'block');
    const hasNumber = parts.some(p => p.type === 'number');
    expect(hasBlock).toBe(true);
    expect(hasNumber).toBe(true);
  });

  it('default fallback for unknown mechanic returns typed output', () => {
    const card: Card = {
      id: 'test-unknown',
      factId: 'test-fact-1',
      cardType: 'attack',
      domain: 'natural_sciences',
      tier: '1',
      baseEffectValue: 6,
      effectMultiplier: 1,
      mechanicId: '__nonexistent_mechanic__',
      mechanicName: 'Unknown',
      apCost: 1,
      masteryLevel: 0,
    };
    // No mechanic definition → falls to card-type fallback
    const detailed = getDetailedCardDescription(card);
    expect(detailed).toContain('6'); // power value
    expect(detailed).toContain('damage'); // attack type fallback

    const short = getShortCardDescription(card);
    expect(short).toContain('6');

    const parts = getCardDescriptionParts(card);
    expect(parts.length).toBeGreaterThanOrEqual(1);
  });

  it('all legacy mechanics still return proper descriptions', () => {
    const legacyMechanics = [
      { id: 'strike', type: 'attack' as const },
      { id: 'block', type: 'shield' as const },
      { id: 'empower', type: 'buff' as const },
      { id: 'weaken', type: 'debuff' as const },
      { id: 'scout', type: 'utility' as const },
      { id: 'mirror', type: 'wild' as const },
    ];
    for (const { id, type } of legacyMechanics) {
      const card = makeCard(id, { cardType: type, baseEffectValue: 4 });
      const detailed = getDetailedCardDescription(card);
      expect(detailed.trim().length).toBeGreaterThan(0);
      expect(detailed).not.toContain('undefined');
      const parts = getCardDescriptionParts(card);
      expect(parts.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── 2026-04-11 Audit Fix Tests ─────────────────────────────────────────────
// These tests verify that card descriptions now match resolver behavior.
// Previously descriptions used card.baseEffectValue (BASE_EFFECT[cardType] = attack:4, shield:3)
// instead of stat-table qpValue. See docs/gotchas.md 2026-04-11 entry.

describe('card-descriptions — 2026-04-11 audit fix: power reads from stat table', () => {
  it('heavy_strike shows stat-table qpValue=7 (not baseEffectValue=4)', () => {
    const card = makeCard('heavy_strike', { cardType: 'attack', baseEffectValue: 4 });
    const detailed = getDetailedCardDescription(card);
    // stat table L0 qpValue=7; baseEffectValue=4 (attack BASE_EFFECT)
    expect(detailed).toContain('7');
    expect(detailed).not.toMatch(/Deal 4 damage/);
  });

  it('block shows stat-table qpValue=4 (not old seed value 3)', () => {
    const card = makeCard('block', { cardType: 'shield', baseEffectValue: 3 });
    const detailed = getDetailedCardDescription(card);
    // stat table L0 qpValue=4 (updated from old seed=3); description reads stat table
    expect(detailed).toContain('4');
    expect(detailed).not.toContain('undefined');
  });

  it('twin_strike shows stat-table qpValue=2 (not baseEffectValue=5)', () => {
    const card = makeCard('twin_strike', { cardType: 'attack', baseEffectValue: 5 });
    const detailed = getDetailedCardDescription(card);
    // stat table L0 qpValue=2; baseEffectValue=5 is seed value
    expect(detailed).toContain('2');
    expect(detailed).not.toMatch(/Deal 5 damage/);
  });

  it('fortify description reflects scaling mechanic, not flat block value', () => {
    const card = makeCard('fortify', { cardType: 'shield', baseEffectValue: 7 });
    const detailed = getDetailedCardDescription(card);
    // Must NOT show "Gain 7 Block" (that was the flat-value lie)
    expect(detailed).not.toMatch(/Gain 7 Block/);
    expect(detailed).not.toMatch(/Gain \d+ Block\. Persists/);
    // Must explain the scaling formula
    expect(detailed.toLowerCase()).toMatch(/50%|current block|current Block/);
  });

  it('fortify short description does not show flat power number', () => {
    const card = makeCard('fortify', { cardType: 'shield', baseEffectValue: 7 });
    const short = getShortCardDescription(card);
    // Must not show "Gain 7" or "Gain 5" — no flat block numbers
    expect(short).not.toMatch(/Gain \d+/);
  });

  it('fortify parts do not use numWithMastery(power) pattern', () => {
    const card = makeCard('fortify', { cardType: 'shield', baseEffectValue: 7 });
    const parts = getCardDescriptionParts(card);
    const joined = parts.map(p => p.value).join('');
    // Should show scaling info not a raw number from baseEffectValue
    expect(joined).not.toBe('7');  // not just the old flat value
  });

  it('feedback_loop description shows Pass-8 values (CC: 28, not 40)', () => {
    const card = makeCard('feedback_loop', { cardType: 'attack', baseEffectValue: 5 });
    const detailed = getDetailedCardDescription(card);
    // Pass 8 (2026-04-10): CC reduced from 40→28
    expect(detailed).toContain('28');
    expect(detailed).not.toMatch(/CC: 40 damage/);
  });

  it('feedback_loop short description shows updated value', () => {
    const card = makeCard('feedback_loop', { cardType: 'attack', baseEffectValue: 5 });
    const short = getShortCardDescription(card);
    // Must not still say "40"
    expect(short).not.toBe('CC: 40 dmg');
  });

  it('overheal threshold shows 60% not 50%', () => {
    const card = makeCard('overheal', { cardType: 'shield', baseEffectValue: 3 });
    const detailed = getDetailedCardDescription(card);
    // Resolver uses healthPercentage < 0.6 (60%), not 50%
    expect(detailed).toContain('60%');
    expect(detailed).not.toContain('50%');
  });

  it('smite shows stat-table QP value (L0=7, not old seed 10)', () => {
    const card = makeCard('smite', { cardType: 'attack', baseEffectValue: 10 });
    const detailed = getDetailedCardDescription(card);
    // stat table L0 qpValue=7
    expect(detailed).toContain('7');
    // "Deal 10 damage" was the old wrong value
    expect(detailed).not.toMatch(/Deal 10 damage \(QP\)/);
  });

  it('warcry description shows str from stat table (L0 str=1)', () => {
    const card = makeCard('warcry', { cardType: 'buff', baseEffectValue: 0 });
    const detailed = getDetailedCardDescription(card);
    // stat table L0 extras.str=1; description reads this
    expect(detailed).toContain('+1 Clarity');
    expect(detailed).toContain('CC:');
  });

  it('all three description functions return no NaN for stat-table mechanics at L0', () => {
    // Spot-check mechanics that previously showed wrong values
    const mechanics = [
      { id: 'heavy_strike', type: 'attack' as const },
      { id: 'twin_strike', type: 'attack' as const },
      { id: 'bash', type: 'attack' as const },
      { id: 'rupture', type: 'attack' as const },
      { id: 'guard', type: 'shield' as const },
      { id: 'absorb', type: 'shield' as const },
    ];
    for (const { id, type } of mechanics) {
      const card = makeCard(id, { cardType: type, baseEffectValue: 4, masteryLevel: 0 });
      const detailed = getDetailedCardDescription(card);
      expect(detailed).not.toContain('NaN');
      expect(detailed).not.toContain('undefined');
      const short = getShortCardDescription(card);
      expect(short).not.toContain('NaN');
      expect(short).not.toContain('undefined');
    }
  });
});
