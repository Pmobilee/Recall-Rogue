/**
 * Unit tests for AR-265 relic overhaul.
 * Covers the 6 reworked relics:
 *   - scar_tissue (v3): wrong Charge stacks → flat damage bonus
 *   - memory_nexus (v3): repeating draw bonus every 3rd correct Charge
 *   - lucky_coin (v3): +50% damage after 3 wrong Charges in encounter
 *   - scholars_crown (v3): +40% Review Queue, +10% all others
 *   - domain_mastery_sigil (v3): Aura-based AP modifier on turn start
 *   - akashic_record (v3): flat +50% damage on correct Charges
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAttackModifiers,
  resolveChargeCorrectEffects,
  resolveChargeWrongEffects,
  resolveTurnStartEffects,
  type ChargeCorrectContext,
  type ChargeWrongContext,
  type AttackContext,
  type TurnStartContext,
} from '../relicEffectResolver';

// ─── Shared helpers ──────────────────────────────────────────────────

const makeChargeCorrectCtx = (overrides: Partial<ChargeCorrectContext> = {}): ChargeCorrectContext => ({
  answerTimeMs: 5000,
  cardTier: 1,
  cardType: 'attack',
  isFirstChargeThisTurn: false,
  chargeCountThisEncounter: 1,
  isFirstChargeCorrectThisEncounter: true,
  correctChargesThisTurn: 0,
  totalChargesThisRun: 1,
  mirrorUsedThisEncounter: false,
  adrenalineShard_usedThisTurn: false,
  ...overrides,
});

const makeChargeWrongCtx = (overrides: Partial<ChargeWrongContext> = {}): ChargeWrongContext => ({
  factId: 'test_fact_1',
  ...overrides,
});

const makeAttackCtx = (overrides: Partial<AttackContext> = {}): AttackContext => ({
  isFirstAttack: false,
  isStrikeTagged: false,
  playerHpPercent: 0.8,
  consecutiveCorrectAttacks: 0,
  cardTier: 'learning',
  correctStreakThisEncounter: 0,
  enemyHpPercent: 0.8,
  ...overrides,
});

const makeTurnStartCtx = (overrides: Partial<TurnStartContext> = {}): TurnStartContext => ({
  turnNumberThisEncounter: 1,
  characterLevel: 1,
  dejaVuUsedThisEncounter: false,
  ...overrides,
});

// ─── scar_tissue (v3) ───────────────────────────────────────────────

describe('scar_tissue (v3)', () => {
  describe('resolveChargeWrongEffects', () => {
    it('sets scarTissueStackIncrement = true when scar_tissue held', () => {
      const result = resolveChargeWrongEffects(
        new Set(['scar_tissue']),
        makeChargeWrongCtx(),
      );
      expect(result.scarTissueStackIncrement).toBe(true);
    });

    it('sets scarTissueStackIncrement = false when scar_tissue not held', () => {
      const result = resolveChargeWrongEffects(
        new Set([]),
        makeChargeWrongCtx(),
      );
      expect(result.scarTissueStackIncrement).toBe(false);
    });
  });

  describe('resolveAttackModifiers', () => {
    it('adds +2 flat damage per scar stack (3 stacks = +6)', () => {
      const result = resolveAttackModifiers(
        new Set(['scar_tissue']),
        makeAttackCtx({ scarTissueStacks: 3 }),
      );
      expect(result.flatDamageBonus).toBe(6);
    });

    it('adds +10 flat damage at 5 stacks', () => {
      const result = resolveAttackModifiers(
        new Set(['scar_tissue']),
        makeAttackCtx({ scarTissueStacks: 5 }),
      );
      expect(result.flatDamageBonus).toBe(10);
    });

    it('adds +0 flat damage when stacks is 0', () => {
      const result = resolveAttackModifiers(
        new Set(['scar_tissue']),
        makeAttackCtx({ scarTissueStacks: 0 }),
      );
      expect(result.flatDamageBonus).toBe(0);
    });

    it('adds +0 flat damage when scar_tissue not held', () => {
      const result = resolveAttackModifiers(
        new Set([]),
        makeAttackCtx({ scarTissueStacks: 5 }),
      );
      expect(result.flatDamageBonus).toBe(0);
    });

    it('stacks additively with whetstone (+3 base + scar bonus)', () => {
      const result = resolveAttackModifiers(
        new Set(['scar_tissue', 'whetstone']),
        makeAttackCtx({ scarTissueStacks: 2 }),
      );
      // whetstone: +3, scar_tissue: 2×2 = +4 → total 7
      expect(result.flatDamageBonus).toBe(7);
    });
  });
});

// ─── memory_nexus (v3) ──────────────────────────────────────────────

describe('memory_nexus (v3)', () => {
  it('triggers draw bonus on 3rd correct Charge', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['memory_nexus']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 3 }),
    );
    expect(result.drawBonus).toBe(2);
  });

  it('triggers draw bonus on 6th correct Charge (repeatable)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['memory_nexus']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 6 }),
    );
    expect(result.drawBonus).toBe(2);
  });

  it('triggers draw bonus on 9th correct Charge (repeatable again)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['memory_nexus']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 9 }),
    );
    expect(result.drawBonus).toBe(2);
  });

  it('does NOT trigger on 1st or 2nd Charge', () => {
    for (const count of [1, 2]) {
      const result = resolveChargeCorrectEffects(
        new Set(['memory_nexus']),
        makeChargeCorrectCtx({ chargeCountThisEncounter: count }),
      );
      expect(result.drawBonus).toBe(0);
    }
  });

  it('does NOT trigger on 4th or 5th Charge (between thresholds)', () => {
    for (const count of [4, 5]) {
      const result = resolveChargeCorrectEffects(
        new Set(['memory_nexus']),
        makeChargeCorrectCtx({ chargeCountThisEncounter: count }),
      );
      expect(result.drawBonus).toBe(0);
    }
  });

  it('does NOT trigger when memory_nexus not held', () => {
    const result = resolveChargeCorrectEffects(
      new Set([]),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 3 }),
    );
    expect(result.drawBonus).toBe(0);
  });
});

// ─── lucky_coin (v3) ────────────────────────────────────────────────

describe('lucky_coin (v3)', () => {
  describe('resolveChargeWrongEffects', () => {
    it('increments wrong-charge counter from 0 to 1', () => {
      const result = resolveChargeWrongEffects(
        new Set(['lucky_coin']),
        makeChargeWrongCtx({ wrongChargesThisEncounter: 0 }),
      );
      expect(result.luckyCoinWrongCount).toBe(1);
    });

    it('increments counter from 2 to 3 (triggers arm threshold)', () => {
      const result = resolveChargeWrongEffects(
        new Set(['lucky_coin']),
        makeChargeWrongCtx({ wrongChargesThisEncounter: 2 }),
      );
      expect(result.luckyCoinWrongCount).toBe(3);
    });

    it('returns -1 sentinel when lucky_coin not held', () => {
      const result = resolveChargeWrongEffects(
        new Set([]),
        makeChargeWrongCtx({ wrongChargesThisEncounter: 2 }),
      );
      expect(result.luckyCoinWrongCount).toBe(-1);
    });
  });

  describe('resolveChargeCorrectEffects — armed bonus', () => {
    it('applies +50% multiplier when luckyCoinArmed = true', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['lucky_coin']),
        makeChargeCorrectCtx({ luckyCoinArmed: true }),
      );
      // Base extraMultiplier 1.0 × 1.5 = 1.5
      expect(result.extraMultiplier).toBe(1.5);
      expect(result.luckyCoinArmed).toBe(true);
    });

    it('does NOT apply bonus when luckyCoinArmed = false', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['lucky_coin']),
        makeChargeCorrectCtx({ luckyCoinArmed: false }),
      );
      expect(result.extraMultiplier).toBe(1.0);
      expect(result.luckyCoinArmed).toBe(false);
    });

    it('does NOT apply bonus when lucky_coin not held, even if luckyCoinArmed = true', () => {
      const result = resolveChargeCorrectEffects(
        new Set([]),
        makeChargeCorrectCtx({ luckyCoinArmed: true }),
      );
      expect(result.extraMultiplier).toBe(1.0);
      expect(result.luckyCoinArmed).toBe(false);
    });
  });
});

// ─── scholars_crown (v3) ─────────────────────────────────────────────

describe("scholars_crown (v3)", () => {
  it('grants +40% bonus on Review Queue facts', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['scholars_crown']),
      makeChargeCorrectCtx({ wasReviewQueueFact: true }),
    );
    expect(result.scholarsCrownBonus).toBe(40);
  });

  it('grants +10% bonus on non-Review Queue correct Charges', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['scholars_crown']),
      makeChargeCorrectCtx({ wasReviewQueueFact: false }),
    );
    expect(result.scholarsCrownBonus).toBe(10);
  });

  it('grants +10% bonus when wasReviewQueueFact is undefined (default)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['scholars_crown']),
      makeChargeCorrectCtx(),
    );
    expect(result.scholarsCrownBonus).toBe(10);
  });

  it('grants 0 bonus when not held', () => {
    const result = resolveChargeCorrectEffects(
      new Set([]),
      makeChargeCorrectCtx({ wasReviewQueueFact: true }),
    );
    expect(result.scholarsCrownBonus).toBe(0);
  });
});

// ─── domain_mastery_sigil (v3) ───────────────────────────────────────

describe('domain_mastery_sigil (v3)', () => {
  describe('resolveTurnStartEffects', () => {
    it('grants +1 auraApModifier in flow_state', () => {
      const result = resolveTurnStartEffects(
        new Set(['domain_mastery_sigil']),
        0,
        makeTurnStartCtx({ auraState: 'flow_state' }),
      );
      expect(result.auraApModifier).toBe(1);
    });

    it('grants -1 auraApModifier in brain_fog', () => {
      const result = resolveTurnStartEffects(
        new Set(['domain_mastery_sigil']),
        0,
        makeTurnStartCtx({ auraState: 'brain_fog' }),
      );
      expect(result.auraApModifier).toBe(-1);
    });

    it('grants 0 auraApModifier in neutral', () => {
      const result = resolveTurnStartEffects(
        new Set(['domain_mastery_sigil']),
        0,
        makeTurnStartCtx({ auraState: 'neutral' }),
      );
      expect(result.auraApModifier).toBe(0);
    });

    it('returns undefined auraApModifier when not held', () => {
      const result = resolveTurnStartEffects(
        new Set([]),
        0,
        makeTurnStartCtx({ auraState: 'flow_state' }),
      );
      expect(result.auraApModifier).toBeUndefined();
    });

    it('returns undefined auraApModifier when no context auraState provided', () => {
      const result = resolveTurnStartEffects(
        new Set(['domain_mastery_sigil']),
        0,
        makeTurnStartCtx(),
      );
      expect(result.auraApModifier).toBeUndefined();
    });
  });

  describe('resolveAttackModifiers — old domain_concentration_bonus removed', () => {
    it('does NOT grant +30% bonus for 4+ same-domain cards (old behaviour removed)', () => {
      const result = resolveAttackModifiers(
        new Set(['domain_mastery_sigil']),
        makeAttackCtx({
          cardDomain: 'history',
          deckDomainCounts: { history: 5 },
        }),
      );
      expect(result.percentDamageBonus).toBe(0);
    });
  });
});

// ─── akashic_record (v3 — AR-269 spacing mechanic) ───────────────────

describe('akashic_record (v3 — AR-269 spacing mechanic)', () => {
  describe('spacing condition: factEncounterGap = 0 (never seen)', () => {
    it('grants +50% bonus (×1.5 multiplier) when fact never seen before', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 0 }),
      );
      expect(result.extraMultiplier).toBe(1.5);
      expect(result.akashicChargeBonus).toBe(50);
    });

    it('grants akashicBonusDraw = 1 when fact never seen before', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 0 }),
      );
      expect(result.akashicBonusDraw).toBe(1);
    });
  });

  describe('spacing condition: factEncounterGap >= 3 (well-spaced)', () => {
    it('grants +50% bonus when gap is exactly 3', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 3 }),
      );
      expect(result.extraMultiplier).toBe(1.5);
      expect(result.akashicChargeBonus).toBe(50);
      expect(result.akashicBonusDraw).toBe(1);
    });

    it('grants +50% bonus when gap is 5 (deeper into the run)', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 5 }),
      );
      expect(result.extraMultiplier).toBe(1.5);
      expect(result.akashicChargeBonus).toBe(50);
      expect(result.akashicBonusDraw).toBe(1);
    });
  });

  describe('spacing condition NOT met: recently seen facts', () => {
    it('grants NO bonus when gap is 1 (seen last encounter)', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 1 }),
      );
      expect(result.extraMultiplier).toBe(1.0);
      expect(result.akashicChargeBonus).toBe(0);
      expect(result.akashicBonusDraw).toBe(0);
    });

    it('grants NO bonus when gap is 2 (seen two encounters ago)', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 2 }),
      );
      expect(result.extraMultiplier).toBe(1.0);
      expect(result.akashicChargeBonus).toBe(0);
      expect(result.akashicBonusDraw).toBe(0);
    });

    it('grants NO bonus when gap is 0 inside same encounter (factEncounterGap = 0 means never seen; same-encounter means gap = 0 from map lookup — this verifies no regression)', () => {
      // gap = 0 is "never seen" so it DOES get the bonus (confirmed above)
      // gap = 1 means charged last encounter — no bonus (confirmed above)
      // This test just double-checks the boundary
      const resultGap0 = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 0 }),
      );
      const resultGap1 = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ factEncounterGap: 1 }),
      );
      expect(resultGap0.akashicChargeBonus).toBe(50); // never seen = bonus
      expect(resultGap1.akashicChargeBonus).toBe(0);  // seen last enc = no bonus
    });
  });

  describe('relic not held', () => {
    it('grants NO bonus when akashic_record not held (gap = 0)', () => {
      const result = resolveChargeCorrectEffects(
        new Set([]),
        makeChargeCorrectCtx({ factEncounterGap: 0 }),
      );
      expect(result.akashicChargeBonus).toBe(0);
      expect(result.akashicBonusDraw).toBe(0);
      expect(result.extraMultiplier).toBe(1.0);
    });

    it('grants NO bonus when akashic_record not held (gap = 5)', () => {
      const result = resolveChargeCorrectEffects(
        new Set([]),
        makeChargeCorrectCtx({ factEncounterGap: 5 }),
      );
      expect(result.akashicChargeBonus).toBe(0);
      expect(result.akashicBonusDraw).toBe(0);
      expect(result.extraMultiplier).toBe(1.0);
    });
  });

  describe('factEncounterGap undefined (default)', () => {
    it('grants +50% bonus when factEncounterGap is undefined (safe default = bonus)', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx(), // no factEncounterGap → undefined
      );
      expect(result.extraMultiplier).toBe(1.5);
      expect(result.akashicChargeBonus).toBe(50);
      expect(result.akashicBonusDraw).toBe(1);
    });
  });

  describe('legacy fields', () => {
    it('akashicTier3MultiplierOverride is always 0', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record']),
        makeChargeCorrectCtx({ cardTier: 3, factEncounterGap: 0 }),
      );
      expect(result.akashicTier3MultiplierOverride).toBe(0);
    });
  });

  describe('stacking with other relics', () => {
    it('stacks multiplicatively with quicksilver_quill when spacing met', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record', 'quicksilver_quill']),
        makeChargeCorrectCtx({ answerTimeMs: 1000, factEncounterGap: 0 }),
      );
      // quicksilver: ×1.5, then akashic: ×1.5 → 1.5 × 1.5 = 2.25
      expect(result.extraMultiplier).toBeCloseTo(2.25);
    });

    it('does NOT stack akashic bonus with quicksilver_quill when spacing NOT met', () => {
      const result = resolveChargeCorrectEffects(
        new Set(['akashic_record', 'quicksilver_quill']),
        makeChargeCorrectCtx({ answerTimeMs: 1000, factEncounterGap: 2 }),
      );
      // spacing not met → only quicksilver: ×1.5
      expect(result.extraMultiplier).toBeCloseTo(1.5);
    });
  });
});
