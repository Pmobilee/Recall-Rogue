/**
 * Unit tests for all 36 expansion relic effect resolver functions (AR-211).
 * Covers: 5 Common, 12 Uncommon, 14 Rare, 4 Legendary, 1 Cursed Rare.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveChargeCorrectEffects,
  resolveChargeWrongEffects,
  resolveChainCompleteEffects,
  resolveAttackModifiers,
  resolveDamageTakenEffects,
  resolveTurnStartEffects,
  resolveTurnEndEffects,
  resolveEncounterEndEffects,
  resolveEncounterStartEffects,
  resolveShieldModifiers,
  resolveSurgeStartEffects,
  resolveRunStartEffects,
  resolveBleedModifiers,
  resolveBurnModifiers,
  resolveDebuffAppliedModifiers,
  resolvePerfectTurnEffects,
  resolveMultiHitEffects,
  resolveEliteKillEffects,
  resolveBossKillEffects,
  resolveChargeButtonState,
  resolveMindPalaceEffects,
  resolveChronometerModifiers,
  resolveChainMultiplierBonus,
  resolveChainMultiplierIsOverridden,
  resolveHpLossEffects,
  resolveExhaustEffects,
  resolveChainBreakEffects,
  resolveHealModifiers,
} from '../relicEffectResolver';

// ─── Shared test context helpers ─────────────────────────────────────

/** Minimal valid ChargeCorrectContext for tests that don't care about new fields. */
const makeChargeCorrectCtx = (overrides: Record<string, unknown> = {}) => ({
  answerTimeMs: 5000,
  cardTier: 1,
  cardType: 'attack' as const,
  isFirstChargeThisTurn: false,
  chargeCountThisEncounter: 1,
  isFirstChargeCorrectThisEncounter: true,
  correctChargesThisTurn: 0,
  totalChargesThisRun: 1,
  mirrorUsedThisEncounter: false,
  adrenalineShard_usedThisTurn: false,
  ...overrides,
});

/** Minimal valid AttackContext. */
const makeAttackCtx = (overrides: Record<string, unknown> = {}) => ({
  isFirstAttack: false,
  isStrikeTagged: false,
  playerHpPercent: 0.8,
  consecutiveCorrectAttacks: 0,
  cardTier: 'learning',
  correctStreakThisEncounter: 0,
  enemyHpPercent: 0.8,
  attackCountThisEncounter: 0,
  furyStacks: 0,
  enemyHasBurn: false,
  enemyHasPoison: false,
  enemyBurnStacks: 0,
  battleScarsArmed: false,
  ...overrides,
});

/** Minimal valid DamageTakenContext. */
const makeDamageTakenCtx = (overrides: Record<string, unknown> = {}) => ({
  playerHpPercent: 0.8,
  hadBlock: false,
  blockAbsorbedAll: false,
  currentBlock: 0,
  ...overrides,
});

// ─── Batch A: Common Relics ──────────────────────────────────────────

describe('quick_study (common)', () => {
  it('fires when chargesCorrectThisEncounter >= 3', () => {
    const result = resolveEncounterEndEffects(
      new Set(['quick_study']),
      { chargesCorrectThisEncounter: 3 },
    );
    expect(result.showFactHintForSeconds).toBe(3);
  });

  it('does NOT fire at 2 correct Charges', () => {
    const result = resolveEncounterEndEffects(
      new Set(['quick_study']),
      { chargesCorrectThisEncounter: 2 },
    );
    expect(result.showFactHintForSeconds).toBe(0);
  });

  it('does NOT fire when relic not held', () => {
    const result = resolveEncounterEndEffects(
      new Set(),
      { chargesCorrectThisEncounter: 5 },
    );
    expect(result.showFactHintForSeconds).toBe(0);
  });
});

// thick_skin reworked 2026-04-09: was debuff reflect; now +5 block at encounter start
describe('thick_skin (common, reworked)', () => {
  it('grants thickSkinBlock=5 at encounter start', () => {
    const result = resolveEncounterStartEffects(new Set(['thick_skin']));
    expect(result.thickSkinBlock).toBe(5);
  });

  it('thickSkinBlock=0 when relic not held', () => {
    const result = resolveEncounterStartEffects(new Set());
    expect(result.thickSkinBlock).toBe(0);
  });

  it('no longer reflects debuffs to enemy', () => {
    const result = resolveDebuffAppliedModifiers(
      new Set(['thick_skin']),
      { isFirstDebuffThisEncounter: true },
    );
    expect(result.reflectToEnemy).toBe(false);
  });
});

describe('tattered_notebook (common, v3 rework)', () => {
  it('grants +1 tempStrengthGain when card exhausted', () => {
    const result = resolveExhaustEffects(new Set(['tattered_notebook']));
    expect(result.tempStrengthGain).toBe(1);
  });

  it('does NOT grant strength when relic not held', () => {
    const result = resolveExhaustEffects(new Set());
    expect(result.tempStrengthGain).toBe(0);
  });

  it('no longer grants gold on correct Charge (v3 rework)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['tattered_notebook']),
      makeChargeCorrectCtx({ isFirstChargeCorrectThisEncounter: true }),
    );
    expect(result.goldBonus).toBe(0);
  });
});

describe('battle_scars (common)', () => {
  it('triggers when player takes a hit (battleScarsTriggered = true)', () => {
    const result = resolveDamageTakenEffects(
      new Set(['battle_scars']),
      makeDamageTakenCtx(),
    );
    expect(result.battleScarsTriggered).toBe(true);
  });

  it('triggers nextAttackFlatBonus when battleScarsArmed is true', () => {
    const result = resolveAttackModifiers(
      new Set(['battle_scars']),
      makeAttackCtx({ battleScarsArmed: true }),
    );
    expect(result.flatDamageBonus).toBeGreaterThanOrEqual(3);
  });

  it('does NOT grant attack bonus when battleScarsArmed is false', () => {
    const result = resolveAttackModifiers(
      new Set(['battle_scars']),
      makeAttackCtx({ battleScarsArmed: false }),
    );
    // Only battle_scars contributes; base is 0 flatDamageBonus from other relics
    expect(result.flatDamageBonus).toBe(0);
  });

  it('does NOT trigger when relic not held', () => {
    const result = resolveDamageTakenEffects(
      new Set(),
      makeDamageTakenCtx(),
    );
    expect(result.battleScarsTriggered).toBe(false);
  });
});

// brass_knuckles reworked 2026-04-09: was every-2nd-attack strength; now +1 temp Strength at turn start
describe('brass_knuckles (common, v4 rework — temp Strength at turn start)', () => {
  it('grants tempStrengthGain=1 at turn start when held', () => {
    const result = resolveTurnStartEffects(
      new Set(['brass_knuckles']),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 1, dejaVuUsedThisEncounter: false },
    );
    expect(result.tempStrengthGain).toBe(1);
  });

  it('grants tempStrengthGain=1 on any turn', () => {
    const result = resolveTurnStartEffects(
      new Set(['brass_knuckles']),
      0,
      { turnNumberThisEncounter: 4, characterLevel: 1, dejaVuUsedThisEncounter: false },
    );
    expect(result.tempStrengthGain).toBe(1);
  });

  it('tempStrengthGain=0 when relic not held', () => {
    const result = resolveTurnStartEffects(
      new Set([]),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 1, dejaVuUsedThisEncounter: false },
    );
    expect(result.tempStrengthGain).toBe(0);
  });

  it('no longer grants strengthGain via resolveAttackModifiers', () => {
    const result = resolveAttackModifiers(
      new Set(['brass_knuckles']),
      makeAttackCtx({ attackCountThisEncounter: 2 }),
    );
    expect(result.strengthGain).toBe(0);
  });
});

// ─── Batch B: Uncommon Relics ────────────────────────────────────────

describe('pocket_watch (uncommon)', () => {
  it('grants +1 draw bonus on turn 1', () => {
    const result = resolveTurnStartEffects(
      new Set(['pocket_watch']),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 10, dejaVuUsedThisEncounter: false },
    );
    expect(result.pocketWatchDrawBonus).toBe(1);
  });

  it('grants +1 draw bonus on turn 5', () => {
    const result = resolveTurnStartEffects(
      new Set(['pocket_watch']),
      0,
      { turnNumberThisEncounter: 5, characterLevel: 10, dejaVuUsedThisEncounter: false },
    );
    expect(result.pocketWatchDrawBonus).toBe(1);
  });

  it('does NOT fire on turn 2', () => {
    const result = resolveTurnStartEffects(
      new Set(['pocket_watch']),
      0,
      { turnNumberThisEncounter: 2, characterLevel: 10, dejaVuUsedThisEncounter: false },
    );
    expect(result.pocketWatchDrawBonus).toBe(0);
  });
});

describe('chain_link_charm (uncommon)', () => {
  it('3-link chain = +15 gold', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chain_link_charm']),
      { chainLength: 3, firstCardId: 'card_a' },
    );
    expect(result.goldBonus).toBe(15);
  });

  it('5-link chain = +25 gold', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chain_link_charm']),
      { chainLength: 5, firstCardId: 'card_a' },
    );
    expect(result.goldBonus).toBe(25);
  });
});

// worn_shield reworked 2026-04-09: was thorns + -20% block; now +2 flat block on all shield cards
describe('worn_shield (uncommon, reworked)', () => {
  it('grants +2 flatBlockBonus on shield cards', () => {
    const result = resolveShieldModifiers(
      new Set(['worn_shield']),
      { shieldCardPlayCountThisEncounter: 1 },
    );
    expect(result.flatBlockBonus).toBe(2);
  });

  it('no longer grants thorns', () => {
    const result = resolveShieldModifiers(
      new Set(['worn_shield']),
      { shieldCardPlayCountThisEncounter: 1 },
    );
    expect(result.grantsThorns).toBeUndefined();
  });

  it('no longer has -20% block penalty', () => {
    const result = resolveShieldModifiers(
      new Set(['worn_shield']),
      { shieldCardPlayCountThisEncounter: 1 },
    );
    expect(result.percentBlockBonus).toBe(0);
  });

  it('no block bonus when relic not held', () => {
    const result = resolveShieldModifiers(
      new Set([]),
      { shieldCardPlayCountThisEncounter: 1 },
    );
    expect(result.flatBlockBonus).toBe(0);
  });
});

describe('bleedstone (uncommon)', () => {
  it('returns extraBleedStacks: 2 and slowerDecay: true', () => {
    const result = resolveBleedModifiers(new Set(['bleedstone']));
    expect(result.extraBleedStacks).toBe(2);
    expect(result.slowerDecay).toBe(true);
  });

  it('no bonuses when relic not held', () => {
    const result = resolveBleedModifiers(new Set());
    expect(result.extraBleedStacks).toBe(0);
    expect(result.slowerDecay).toBe(false);
  });
});

describe('gladiator_s_mark (uncommon)', () => {
  it('returns tempStrengthBonus { amount: 1, durationTurns: 3 } at encounter start', () => {
    const result = resolveEncounterStartEffects(new Set(['gladiator_s_mark']));
    expect(result.tempStrengthBonus).toEqual({ amount: 1, durationTurns: 3 });
  });

  it('returns null when relic not held', () => {
    const result = resolveEncounterStartEffects(new Set());
    expect(result.tempStrengthBonus).toBeNull();
  });
});

describe('ember_core (uncommon)', () => {
  it('+20% damage when enemyBurnStacks >= 5', () => {
    const result = resolveAttackModifiers(
      new Set(['ember_core']),
      makeAttackCtx({ enemyBurnStacks: 5 }),
    );
    expect(result.percentDamageBonus).toBeCloseTo(0.20);
  });

  it('no bonus when enemyBurnStacks = 4', () => {
    const result = resolveAttackModifiers(
      new Set(['ember_core']),
      makeAttackCtx({ enemyBurnStacks: 4 }),
    );
    expect(result.percentDamageBonus).toBe(0);
  });

  it('returns extraBurnStacks: 2 from resolveBurnModifiers', () => {
    const result = resolveBurnModifiers(new Set(['ember_core']));
    expect(result.extraBurnStacks).toBe(2);
  });

  it('returns extraBurnStacks: 0 when relic not held', () => {
    const result = resolveBurnModifiers(new Set());
    expect(result.extraBurnStacks).toBe(0);
  });
});

describe('gambler_s_token (uncommon)', () => {
  it('grants +3 gold on wrong Charge', () => {
    const result = resolveChargeWrongEffects(
      new Set(['gambler_s_token']),
      { factId: 'fact_001' },
    );
    expect(result.goldBonus).toBe(3);
  });

  it('grants 0 gold when relic not held', () => {
    const result = resolveChargeWrongEffects(
      new Set(),
      { factId: 'fact_001' },
    );
    expect(result.goldBonus).toBe(0);
  });
});

describe('thoughtform (uncommon)', () => {
  it('grants +1 permanentStrengthGain on perfect turn', () => {
    const result = resolvePerfectTurnEffects(new Set(['thoughtform']));
    expect(result.permanentStrengthGain).toBe(1);
  });

  it('grants 0 when relic not held', () => {
    const result = resolvePerfectTurnEffects(new Set());
    expect(result.permanentStrengthGain).toBe(0);
  });
});

describe('living_grimoire (uncommon)', () => {
  it('heals 3 when chargesCorrectThisEncounter >= 3', () => {
    const result = resolveEncounterEndEffects(
      new Set(['living_grimoire']),
      { chargesCorrectThisEncounter: 3 },
    );
    expect(result.livingGrimoireHeal).toBe(3);
  });

  it('does NOT heal when chargesCorrectThisEncounter = 2', () => {
    const result = resolveEncounterEndEffects(
      new Set(['living_grimoire']),
      { chargesCorrectThisEncounter: 2 },
    );
    expect(result.livingGrimoireHeal).toBe(0);
  });
});

describe('surge_capacitor (uncommon)', () => {
  it('returns bonusAP: 1, bonusDrawCount: 2 on surge start', () => {
    const result = resolveSurgeStartEffects(new Set(['surge_capacitor']));
    expect(result.bonusAP).toBe(1);
    expect(result.bonusDrawCount).toBe(2);
  });

  it('no bonus when relic not held', () => {
    const result = resolveSurgeStartEffects(new Set());
    expect(result.bonusAP).toBe(0);
    expect(result.bonusDrawCount).toBe(0);
  });
});

describe('obsidian_dice (uncommon)', () => {
  it('60% chance branch: extraMultiplier includes ×1.5 factor', () => {
    // Mock Math.random to always return < 0.60 (the positive branch)
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const result = resolveChargeCorrectEffects(
      new Set(['obsidian_dice']),
      makeChargeCorrectCtx(),
    );
    // Base extraMultiplier = 1.0, then *1.5 = 1.5
    expect(result.extraMultiplier).toBeCloseTo(1.5);
    mockRandom.mockRestore();
  });

  it('40% chance branch: extraMultiplier includes ×0.75 factor', () => {
    // Mock Math.random to always return >= 0.60 (the negative branch)
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const result = resolveChargeCorrectEffects(
      new Set(['obsidian_dice']),
      makeChargeCorrectCtx(),
    );
    // Base extraMultiplier = 1.0, then *0.75 = 0.75
    expect(result.extraMultiplier).toBeCloseTo(0.75);
    mockRandom.mockRestore();
  });
});

// ─── Batch C: Rare Relics ────────────────────────────────────────────

describe('red_fang (rare)', () => {
  it('returns firstAttackDamageBonus: 0.30 at encounter start', () => {
    const result = resolveEncounterStartEffects(new Set(['red_fang']));
    expect(result.firstAttackDamageBonus).toBeCloseTo(0.30);
  });

  it('returns 0 when relic not held', () => {
    const result = resolveEncounterStartEffects(new Set());
    expect(result.firstAttackDamageBonus).toBe(0);
  });
});

describe('chronometer (rare)', () => {
  it('returns extraTimerMs: 3000 and chargeMultiplierPenalty: 0.15', () => {
    const result = resolveChronometerModifiers(new Set(['chronometer']));
    expect(result.extraTimerMs).toBe(3000);
    expect(result.chargeMultiplierPenalty).toBeCloseTo(0.15);
  });

  it('returns 0 for both when relic not held', () => {
    const result = resolveChronometerModifiers(new Set());
    expect(result.extraTimerMs).toBe(0);
    expect(result.chargeMultiplierPenalty).toBe(0);
  });
});

describe('soul_jar (rare)', () => {
  it('gains 1 charge on 5th correct Charge', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['soul_jar']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 5 }),
    );
    expect(result.soulJarChargeGained).toBe(1);
  });

  it('gains 1 charge on 10th correct Charge', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['soul_jar']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 10 }),
    );
    expect(result.soulJarChargeGained).toBe(1);
  });

  it('gains 0 on 1st correct Charge', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['soul_jar']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 1 }),
    );
    expect(result.soulJarChargeGained).toBe(0);
  });

  it('gains 0 on 4th correct Charge', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['soul_jar']),
      makeChargeCorrectCtx({ chargeCountThisEncounter: 4 }),
    );
    expect(result.soulJarChargeGained).toBe(0);
  });

  it('resolveChargeButtonState returns showGuaranteed when charges > 0', () => {
    const result = resolveChargeButtonState(new Set(['soul_jar']), 1);
    expect(result.showGuaranteed).toBe(true);
  });

  it('resolveChargeButtonState returns false when charges = 0', () => {
    const result = resolveChargeButtonState(new Set(['soul_jar']), 0);
    expect(result.showGuaranteed).toBe(false);
  });
});

describe('null_shard (rare)', () => {
  it('chain multiplier is overridden (locked at 1.0×)', () => {
    expect(resolveChainMultiplierIsOverridden(new Set(['null_shard']))).toBe(true);
    expect(resolveChainMultiplierBonus(new Set(['null_shard']))).toBe(0);
  });

  it('all attacks +25% percent bonus', () => {
    const result = resolveAttackModifiers(new Set(['null_shard']), makeAttackCtx());
    expect(result.percentDamageBonus).toBeCloseTo(0.25);
  });

  it('chain multiplier NOT overridden when relic not held', () => {
    expect(resolveChainMultiplierIsOverridden(new Set())).toBe(false);
  });
});

describe('hemorrhage_lens (rare)', () => {
  it('returns bleedPerSubsequentHit: 1 when held', () => {
    const result = resolveMultiHitEffects(new Set(['hemorrhage_lens']));
    expect(result.bleedPerSubsequentHit).toBe(1);
  });

  it('returns 0 when relic not held', () => {
    const result = resolveMultiHitEffects(new Set());
    expect(result.bleedPerSubsequentHit).toBe(0);
  });
});

describe('archive_codex (rare)', () => {
  it('0 total mastery = 0 bonus', () => {
    const result = resolveEncounterEndEffects(
      new Set(['archive_codex']),
      { chargesCorrectThisEncounter: 0, totalDeckMasteryLevels: 0 },
    );
    expect(result.archiveCodexDamageBonus).toBe(0);
  });

  it('10 total mastery = +1 damage bonus', () => {
    const result = resolveEncounterEndEffects(
      new Set(['archive_codex']),
      { chargesCorrectThisEncounter: 0, totalDeckMasteryLevels: 10 },
    );
    expect(result.archiveCodexDamageBonus).toBe(1);
  });

  it('25 total mastery = +2 damage bonus', () => {
    const result = resolveEncounterEndEffects(
      new Set(['archive_codex']),
      { chargesCorrectThisEncounter: 0, totalDeckMasteryLevels: 25 },
    );
    expect(result.archiveCodexDamageBonus).toBe(2);
  });
});

describe('berserker_s_oath (rare)', () => {
  it('returns maxHpPenalty: 30 on run start', () => {
    const result = resolveRunStartEffects(new Set(['berserker_s_oath']));
    expect(result.maxHpPenalty).toBe(30);
  });

  it('all attacks +40% damage via resolveAttackModifiers', () => {
    const result = resolveAttackModifiers(new Set(['berserker_s_oath']), makeAttackCtx());
    expect(result.percentDamageBonus).toBeCloseTo(0.40);
  });

  it('no penalty when relic not held', () => {
    const result = resolveRunStartEffects(new Set());
    expect(result.maxHpPenalty).toBe(0);
  });
});

describe('chain_forge (rare)', () => {
  it('chainForgeAvailable: true when not yet used this encounter', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chain_forge']),
      { chainLength: 3, firstCardId: 'card_a', chainForgeUsedThisEncounter: false },
    );
    expect(result.chainForgeAvailable).toBe(true);
  });

  it('chainForgeAvailable: false when already used this encounter', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chain_forge']),
      { chainLength: 3, firstCardId: 'card_a', chainForgeUsedThisEncounter: true },
    );
    expect(result.chainForgeAvailable).toBe(false);
  });

  it('chainForgeAvailable: false when relic not held', () => {
    const result = resolveChainCompleteEffects(
      new Set(),
      { chainLength: 3, firstCardId: 'card_a', chainForgeUsedThisEncounter: false },
    );
    expect(result.chainForgeAvailable).toBe(false);
  });
});

describe('deja_vu (rare)', () => {
  it('returns dejaVuCardSpawn { count: 1 } at level 14 on turn 1', () => {
    const result = resolveTurnStartEffects(
      new Set(['deja_vu']),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 14, dejaVuUsedThisEncounter: false },
    );
    expect(result.dejaVuCardSpawn).toEqual({ count: 1, apCostReduction: 1 });
  });

  it('returns dejaVuCardSpawn { count: 2 } at level 15 on turn 1', () => {
    const result = resolveTurnStartEffects(
      new Set(['deja_vu']),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 15, dejaVuUsedThisEncounter: false },
    );
    expect(result.dejaVuCardSpawn).toEqual({ count: 2, apCostReduction: 1 });
  });

  it('does NOT spawn on turn 2', () => {
    const result = resolveTurnStartEffects(
      new Set(['deja_vu']),
      0,
      { turnNumberThisEncounter: 2, characterLevel: 10, dejaVuUsedThisEncounter: false },
    );
    expect(result.dejaVuCardSpawn).toBeNull();
  });

  it('does NOT spawn if dejaVuUsedThisEncounter = true', () => {
    const result = resolveTurnStartEffects(
      new Set(['deja_vu']),
      0,
      { turnNumberThisEncounter: 1, characterLevel: 10, dejaVuUsedThisEncounter: true },
    );
    expect(result.dejaVuCardSpawn).toBeNull();
  });
});

describe('inferno_crown (rare)', () => {
  it('+30% when enemy has both Burn AND Poison', () => {
    const result = resolveAttackModifiers(
      new Set(['inferno_crown']),
      makeAttackCtx({ enemyHasBurn: true, enemyHasPoison: true }),
    );
    expect(result.percentDamageBonus).toBeCloseTo(0.30);
  });

  it('no bonus when only Burn (no Poison)', () => {
    const result = resolveAttackModifiers(
      new Set(['inferno_crown']),
      makeAttackCtx({ enemyHasBurn: true, enemyHasPoison: false }),
    );
    expect(result.percentDamageBonus).toBe(0);
  });

  it('no bonus when only Poison (no Burn)', () => {
    const result = resolveAttackModifiers(
      new Set(['inferno_crown']),
      makeAttackCtx({ enemyHasBurn: false, enemyHasPoison: true }),
    );
    expect(result.percentDamageBonus).toBe(0);
  });
});

describe('mind_palace (rare)', () => {
  it('streak 9 = 0 bonus', () => {
    expect(resolveMindPalaceEffects(new Set(['mind_palace']), 9).bonusToAllEffects).toBe(0);
  });

  it('streak 10 = +3 bonus', () => {
    expect(resolveMindPalaceEffects(new Set(['mind_palace']), 10).bonusToAllEffects).toBe(3);
  });

  it('streak 20 = +6 bonus', () => {
    expect(resolveMindPalaceEffects(new Set(['mind_palace']), 20).bonusToAllEffects).toBe(6);
  });

  it('streak 30 = +10 bonus', () => {
    expect(resolveMindPalaceEffects(new Set(['mind_palace']), 30).bonusToAllEffects).toBe(10);
  });

  it('no bonus when relic not held', () => {
    expect(resolveMindPalaceEffects(new Set(), 30).bonusToAllEffects).toBe(0);
  });
});

describe('entropy_engine (rare)', () => {
  it('procs at 3 distinct card types', () => {
    const result = resolveTurnEndEffects(
      new Set(['entropy_engine']),
      {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 3,
        isPerfectTurn: false,
        distinctCardTypesPlayedThisTurn: 3,
      },
    );
    expect(result.entropyEngineProc).toEqual({ damage: 5, block: 5 });
  });

  it('does NOT proc at 2 distinct card types', () => {
    const result = resolveTurnEndEffects(
      new Set(['entropy_engine']),
      {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 2,
        isPerfectTurn: false,
        distinctCardTypesPlayedThisTurn: 2,
      },
    );
    expect(result.entropyEngineProc).toBeNull();
  });
});

describe('bloodstone_pendant (rare)', () => {
  it('furyStacksGained: 1 on damage taken', () => {
    const result = resolveDamageTakenEffects(
      new Set(['bloodstone_pendant']),
      makeDamageTakenCtx(),
    );
    expect(result.furyStacksGained).toBe(1);
  });

  it('flatDamageBonus += furyStacks on attack', () => {
    const result = resolveAttackModifiers(
      new Set(['bloodstone_pendant']),
      makeAttackCtx({ furyStacks: 3 }),
    );
    expect(result.flatDamageBonus).toBe(3);
  });

  it('0 furyStacksGained when relic not held', () => {
    const result = resolveDamageTakenEffects(new Set(), makeDamageTakenCtx());
    expect(result.furyStacksGained).toBe(0);
  });
});

describe('chromatic_chain (rare)', () => {
  it('primes on 3+ chain (once/encounter)', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chromatic_chain']),
      { chainLength: 3, firstCardId: 'card_a', chromaticChainUsedThisEncounter: false },
    );
    expect(result.chromaticChainPrimed).toBe(true);
  });

  it('does NOT prime on 2-chain', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chromatic_chain']),
      { chainLength: 2, firstCardId: 'card_a', chromaticChainUsedThisEncounter: false },
    );
    expect(result.chromaticChainPrimed).toBe(false);
  });

  it('does NOT prime if already used this encounter', () => {
    const result = resolveChainCompleteEffects(
      new Set(['chromatic_chain']),
      { chainLength: 5, firstCardId: 'card_a', chromaticChainUsedThisEncounter: true },
    );
    expect(result.chromaticChainPrimed).toBe(false);
  });
});

describe('dragon_s_heart (rare)', () => {
  it('passive +2 flat damage always active', () => {
    const result = resolveAttackModifiers(new Set(['dragon_s_heart']), makeAttackCtx());
    expect(result.flatDamageBonus).toBe(2);
  });

  it('elite kill: +5 max HP + 30% heal', () => {
    const result = resolveEliteKillEffects(new Set(['dragon_s_heart']));
    expect(result.maxHpGain).toBe(5);
    expect(result.healPercent).toBeCloseTo(0.30);
  });

  it('boss kill: +15 max HP + full heal + legendary relic grant', () => {
    const result = resolveBossKillEffects(new Set(['dragon_s_heart']));
    expect(result.maxHpGain).toBe(15);
    expect(result.fullHeal).toBe(true);
    expect(result.grantRandomLegendaryRelic).toBe(true);
  });

  it('no effects when relic not held', () => {
    expect(resolveEliteKillEffects(new Set()).maxHpGain).toBe(0);
    expect(resolveBossKillEffects(new Set()).fullHeal).toBe(false);
  });
});

// ─── Batch D: Legendary + Cursed Rare ───────────────────────────────

describe('omniscience (legendary)', () => {
  it('no auto-succeed at 2 correct Charges this turn', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['omniscience']),
      makeChargeCorrectCtx({ correctChargesThisTurn: 2 }),
    );
    expect(result.autoSucceedNextCharge).toBe(false);
  });

  it('autoSucceedNextCharge: true at 3 correct Charges this turn', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['omniscience']),
      makeChargeCorrectCtx({ correctChargesThisTurn: 3 }),
    );
    expect(result.autoSucceedNextCharge).toBe(true);
  });

  it('also triggers at 4+ correct Charges this turn', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['omniscience']),
      makeChargeCorrectCtx({ correctChargesThisTurn: 4 }),
    );
    expect(result.autoSucceedNextCharge).toBe(true);
  });
});

describe('paradox_engine (legendary)', () => {
  it('turn start: unconditional +1 AP', () => {
    const result = resolveTurnStartEffects(
      new Set(['paradox_engine']),
      0,
      { turnNumberThisEncounter: 3, characterLevel: 10, dejaVuUsedThisEncounter: false },
    );
    expect(result.bonusAP).toBeGreaterThanOrEqual(1);
  });

  it('wrong Charge: multiplierOverride 0.30 + piercingDamage 5', () => {
    const result = resolveChargeWrongEffects(
      new Set(['paradox_engine']),
      { factId: 'fact_001' },
    );
    expect(result.multiplierOverride).toBeCloseTo(0.30);
    expect(result.piercingDamage).toBe(5);
  });

  it('wrong Charge: no self-damage from paradox_engine itself', () => {
    const result = resolveChargeWrongEffects(
      new Set(['paradox_engine']),
      { factId: 'fact_001' },
    );
    expect(result.selfDamage).toBe(0);
  });

  it('both effects independently testable — no multiplierOverride when not held', () => {
    const result = resolveChargeWrongEffects(new Set(), { factId: 'fact_001' });
    expect(result.multiplierOverride).toBe(0);
    expect(result.piercingDamage).toBe(0);
  });
});

// akashic_record was reworked in AR-265 (v3): no longer uses tier3AutoChargeMultiplierOverride.
// The field is deprecated and always returns 0. v3 behavior tested in relicEffectResolver.ar265.test.ts.
describe('akashic_record (legendary) [v3 — tier override deprecated]', () => {
  it('tier3AutoChargeMultiplierOverride is always 0 (deprecated in v3)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['akashic_record']),
      makeChargeCorrectCtx({ cardTier: 3 }),
    );
    expect(result.akashicTier3MultiplierOverride).toBe(0);
  });

  it('Tier 2 correct Charge: tier3AutoChargeMultiplierOverride is 0 (unchanged)', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['akashic_record']),
      makeChargeCorrectCtx({ cardTier: 2 }),
    );
    expect(result.akashicTier3MultiplierOverride).toBe(0);
  });

  it('returns 0 when relic not held even at Tier 3', () => {
    const result = resolveChargeCorrectEffects(
      new Set(),
      makeChargeCorrectCtx({ cardTier: 3 }),
    );
    expect(result.akashicTier3MultiplierOverride).toBe(0);
  });
});

describe('singularity (legendary)', () => {
  it('5-chain with 100 total damage: singularityBonusDamage = 100', () => {
    const result = resolveChainCompleteEffects(
      new Set(['singularity']),
      { chainLength: 5, firstCardId: 'card_a', totalChainDamage: 100 },
    );
    expect(result.singularityBonusDamage).toBe(100);
  });

  it('4-chain: NO singularity bonus', () => {
    const result = resolveChainCompleteEffects(
      new Set(['singularity']),
      { chainLength: 4, firstCardId: 'card_a', totalChainDamage: 80 },
    );
    expect(result.singularityBonusDamage).toBe(0);
  });

  it('relic not held: 0 bonus even on 5-chain', () => {
    const result = resolveChainCompleteEffects(
      new Set(),
      { chainLength: 5, firstCardId: 'card_a', totalChainDamage: 100 },
    );
    expect(result.singularityBonusDamage).toBe(0);
  });
});

describe('volatile_manuscript (cursed rare)', () => {
  it('Charge multiplier includes +0.5× (extraMultiplier starts at 1.5 before obsidian_dice)', () => {
    // Mock random to avoid obsidian_dice interference (manuscript held alone)
    const result = resolveChargeCorrectEffects(
      new Set(['volatile_manuscript']),
      makeChargeCorrectCtx({ totalChargesThisRun: 1 }), // not 3rd charge
    );
    // extraMultiplier = 1.0 base * 1.5 (volatile_manuscript +0.5×) = 1.5
    expect(result.extraMultiplier).toBeCloseTo(1.5);
  });

  it('3rd total Charge this run: selfBurnApply = 4', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['volatile_manuscript']),
      makeChargeCorrectCtx({ totalChargesThisRun: 3 }),
    );
    expect(result.selfBurnApply).toBe(4);
  });

  it('6th total Charge this run: selfBurnApply = 4', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['volatile_manuscript']),
      makeChargeCorrectCtx({ totalChargesThisRun: 6 }),
    );
    expect(result.selfBurnApply).toBe(4);
  });

  it('4th total Charge this run: selfBurnApply = 0', () => {
    const result = resolveChargeCorrectEffects(
      new Set(['volatile_manuscript']),
      makeChargeCorrectCtx({ totalChargesThisRun: 4 }),
    );
    expect(result.selfBurnApply).toBe(0);
  });

  it('no self-Burn when relic not held', () => {
    const result = resolveChargeCorrectEffects(
      new Set(),
      makeChargeCorrectCtx({ totalChargesThisRun: 3 }),
    );
    expect(result.selfBurnApply).toBe(0);
  });
});

// ─── Batch E: Reworked Relics ─────────────────────────────────────────

describe('whetstone (reworked)', () => {
  it('grants +3 flat attack damage', () => {
    const result = resolveAttackModifiers(new Set(['whetstone']), makeAttackCtx());
    expect(result.flatDamageBonus).toBeGreaterThanOrEqual(3);
  });

  it('applies -1 block penalty on shields', () => {
    const result = resolveShieldModifiers(new Set(['whetstone']), { shieldCardPlayCountThisEncounter: 0 });
    expect(result.flatBlockBonus).toBeLessThan(0);
  });
});

describe('iron_shield (reworked, v3)', () => {
  it('grants 2 block when 0 shields played last turn', () => {
    const result = resolveTurnStartEffects(new Set(['iron_shield']), 0, {
      turnNumberThisEncounter: 1, characterLevel: 1, dejaVuUsedThisEncounter: false,
      shieldsPlayedLastTurn: 0,
    });
    expect(result.bonusBlock).toBe(2);
  });

  it('grants 5 block when 3 shields played last turn', () => {
    const result = resolveTurnStartEffects(new Set(['iron_shield']), 0, {
      turnNumberThisEncounter: 2, characterLevel: 1, dejaVuUsedThisEncounter: false,
      shieldsPlayedLastTurn: 3,
    });
    expect(result.bonusBlock).toBe(5);
  });

  it('grants 2 block by default (no context)', () => {
    const result = resolveTurnStartEffects(new Set(['iron_shield']));
    expect(result.bonusBlock).toBe(2);
  });
});

describe('thick_skin (reworked to block — 2026-04-09)', () => {
  it('no longer increases damage taken', () => {
    const result = resolveDamageTakenEffects(new Set(['thick_skin']), makeDamageTakenCtx());
    expect(result.flatDamageIncrease).toBeUndefined();
  });

  it('grants 5 block at encounter start', () => {
    const result = resolveEncounterStartEffects(new Set(['thick_skin']));
    expect(result.thickSkinBlock).toBe(5);
  });
});

// ─── Batch F: New Relics ──────────────────────────────────────────────

describe('pain_conduit (tradeoff)', () => {
  it('reflects HP loss as damage to enemy', () => {
    const result = resolveHpLossEffects(new Set(['pain_conduit']), { hpLost: 8, source: 'enemy' });
    expect(result.reflectDamage).toBe(8);
  });

  it('reflects self-damage too', () => {
    const result = resolveHpLossEffects(new Set(['pain_conduit']), { hpLost: 3, source: 'self' });
    expect(result.reflectDamage).toBe(3);
  });

  it('no reflect when relic not held', () => {
    const result = resolveHpLossEffects(new Set([]), { hpLost: 8, source: 'enemy' });
    expect(result.reflectDamage).toBe(0);
  });

  it('no reflect when 0 HP lost', () => {
    const result = resolveHpLossEffects(new Set(['pain_conduit']), { hpLost: 0, source: 'enemy' });
    expect(result.reflectDamage).toBe(0);
  });
});

describe('pain_conduit healing penalty', () => {
  it('halves healing', () => {
    const result = resolveHealModifiers(new Set(['pain_conduit']));
    expect(result.healingReductionPercent).toBe(50);
  });

  it('no penalty without relic', () => {
    const result = resolveHealModifiers(new Set([]));
    expect(result.healingReductionPercent ?? 0).toBe(0);
  });
});

describe('bloodletter (conditional)', () => {
  it('grants +3 next attack on self-damage', () => {
    const result = resolveHpLossEffects(new Set(['bloodletter']), { hpLost: 5, source: 'self' });
    expect(result.nextAttackBonus).toBe(3);
  });

  it('does NOT trigger on enemy damage', () => {
    const result = resolveHpLossEffects(new Set(['bloodletter']), { hpLost: 5, source: 'enemy' });
    expect(result.nextAttackBonus).toBe(0);
  });

  it('armed bonus applies to attack modifiers', () => {
    const result = resolveAttackModifiers(new Set(['bloodletter']), makeAttackCtx({ bloodletterArmed: true }));
    expect(result.flatDamageBonus).toBeGreaterThanOrEqual(3);
  });

  it('no attack bonus when not armed', () => {
    const result = resolveAttackModifiers(new Set(['bloodletter']), makeAttackCtx({ bloodletterArmed: false }));
    const resultWithout = resolveAttackModifiers(new Set([]), makeAttackCtx({ bloodletterArmed: false }));
    expect(result.flatDamageBonus).toBe(resultWithout.flatDamageBonus);
  });
});

describe('exhaustion_engine (conditional)', () => {
  it('draws 2 cards on exhaust', () => {
    const result = resolveExhaustEffects(new Set(['exhaustion_engine']));
    expect(result.bonusCardDraw).toBe(2);
  });

  it('no draw without relic', () => {
    const result = resolveExhaustEffects(new Set([]));
    expect(result.bonusCardDraw).toBe(0);
  });
});

describe('chain break hook', () => {
  it('returns triggered: false with no chain-break relics', () => {
    const result = resolveChainBreakEffects(new Set([]), { previousChainLength: 3 });
    expect(result.triggered).toBe(false);
  });
});

describe('ritual_blade (tradeoff, nerfed 2026-04-09)', () => {
  it('grants +50% to first card (nerfed from +100%)', () => {
    const result = resolveAttackModifiers(new Set(['ritual_blade']), makeAttackCtx({ isFirstCardThisTurn: true }));
    expect(result.percentDamageBonus).toBeGreaterThanOrEqual(50);
    expect(result.percentDamageBonus).toBeLessThan(100);
  });

  it('reduces subsequent card damage by 25%', () => {
    const result = resolveAttackModifiers(new Set(['ritual_blade']), makeAttackCtx({ isFirstCardThisTurn: false }));
    expect(result.percentDamageBonus).toBeLessThanOrEqual(-25);
  });
});

describe('momentum_wheel (conditional)', () => {
  it('grants +100% on 4th card', () => {
    const result = resolveAttackModifiers(new Set(['momentum_wheel']), makeAttackCtx({ cardPlayIndex: 4 }));
    expect(result.percentDamageBonus).toBeGreaterThanOrEqual(100);
  });

  it('no bonus on 3rd card', () => {
    const base = resolveAttackModifiers(new Set([]), makeAttackCtx({ cardPlayIndex: 3 }));
    const withRelic = resolveAttackModifiers(new Set(['momentum_wheel']), makeAttackCtx({ cardPlayIndex: 3 }));
    expect(withRelic.percentDamageBonus).toBe(base.percentDamageBonus);
  });
});

describe('hollow_armor (tradeoff)', () => {
  it('disables block gain after turn 0', () => {
    const result = resolveShieldModifiers(new Set(['hollow_armor']), { shieldCardPlayCountThisEncounter: 0, encounterTurnNumber: 1 });
    expect(result.blockGainDisabled).toBe(true);
  });

  it('allows block on turn 0 (starting block applies separately)', () => {
    const result = resolveShieldModifiers(new Set(['hollow_armor']), { shieldCardPlayCountThisEncounter: 0, encounterTurnNumber: 0 });
    expect(result.blockGainDisabled).toBeFalsy();
  });

  it('grants starting block at encounter start', () => {
    const result = resolveEncounterStartEffects(new Set(['hollow_armor']));
    expect(result.startingBlock).toBe(20);
  });
});

describe('overclocked_mind (tradeoff)', () => {
  it('grants +2 card draw at turn start', () => {
    const result = resolveTurnStartEffects(new Set(['overclocked_mind']));
    expect(result.bonusCardDraw).toBe(2);
  });
});

describe('berserkers_focus (tradeoff)', () => {
  it('reduces max AP by 1', () => {
    const result = resolveTurnStartEffects(new Set(['berserkers_focus']));
    expect(result.maxApReduction).toBe(1);
  });

  it('no AP reduction without relic', () => {
    const result = resolveTurnStartEffects(new Set([]));
    expect(result.maxApReduction ?? 0).toBe(0);
  });
});

describe('overclocked_mind turn end', () => {
  it('forces discard of 2 cards', () => {
    const result = resolveTurnEndEffects(new Set(['overclocked_mind']), {
      damageDealtThisTurn: 0, cardsPlayedThisTurn: 3, isPerfectTurn: false,
    });
    expect(result.forceDiscard).toBe(2);
  });
});

describe('thorn_mantle (conditional)', () => {
  it('grants thorns when block >= 10', () => {
    const result = resolveTurnEndEffects(new Set(['thorn_mantle']), {
      damageDealtThisTurn: 0, cardsPlayedThisTurn: 2, isPerfectTurn: false, currentBlock: 12,
    });
    expect(result.grantThorns).toBe(4);
  });

  it('no thorns when block < 10', () => {
    const result = resolveTurnEndEffects(new Set(['thorn_mantle']), {
      damageDealtThisTurn: 0, cardsPlayedThisTurn: 2, isPerfectTurn: false, currentBlock: 8,
    });
    expect(result.grantThorns ?? 0).toBe(0);
  });
});

describe('quiz_master (conditional)', () => {
  it('grants +2 AP next turn after 3+ charge corrects', () => {
    const result = resolveTurnEndEffects(new Set(['quiz_master']), {
      damageDealtThisTurn: 0, cardsPlayedThisTurn: 3, isPerfectTurn: false, chargeCorrectsThisTurn: 3,
    });
    expect(result.bonusApNextTurn).toBeGreaterThanOrEqual(2);
  });

  it('no AP bonus with only 2 charge corrects', () => {
    const result = resolveTurnEndEffects(new Set(['quiz_master']), {
      damageDealtThisTurn: 0, cardsPlayedThisTurn: 2, isPerfectTurn: false, chargeCorrectsThisTurn: 2,
    });
    expect(result.bonusApNextTurn ?? 0).toBe(0);
  });
});

describe('glass_lens (tradeoff) — charge correct', () => {
  it('grants +50% charge correct bonus', () => {
    const result = resolveChargeCorrectEffects(new Set(['glass_lens']), makeChargeCorrectCtx());
    expect(result.chargeCorrectBonusPercent).toBe(50);
  });
});

describe('knowledge_tax (tradeoff) — charge correct', () => {
  it('grants gold and penalizes CC', () => {
    const result = resolveChargeCorrectEffects(new Set(['knowledge_tax']), makeChargeCorrectCtx());
    expect(result.goldBonus).toBeGreaterThanOrEqual(10);
    expect(result.chargeCorrectPenaltyPercent).toBe(10);
  });

  it('no effect without relic', () => {
    const result = resolveChargeCorrectEffects(new Set([]), makeChargeCorrectCtx());
    expect(result.chargeCorrectPenaltyPercent ?? 0).toBe(0);
  });
});

describe('glass_lens (tradeoff) — charge wrong', () => {
  it('deals 3 self-damage on wrong', () => {
    const result = resolveChargeWrongEffects(new Set(['glass_lens']), { factId: 'test' });
    expect(result.selfDamage).toBeGreaterThanOrEqual(3);
  });
});

describe('mnemonic_scar (tradeoff)', () => {
  it('resolves at CC power when fact previously correct', () => {
    const result = resolveChargeWrongEffects(new Set(['mnemonic_scar']), { factId: 'test', factPreviouslyCorrect: true });
    expect(result.resolveAtCcPower).toBe(true);
  });

  it('deals 5 self-damage on new fact wrong', () => {
    const result = resolveChargeWrongEffects(new Set(['mnemonic_scar']), { factId: 'test', factPreviouslyCorrect: false });
    expect(result.selfDamage).toBeGreaterThanOrEqual(5);
  });

  it('no effect without relic', () => {
    const result = resolveChargeWrongEffects(new Set([]), { factId: 'test', factPreviouslyCorrect: false });
    expect(result.resolveAtCcPower).toBeFalsy();
  });
});

describe('chain_addict (conditional)', () => {
  it('heals 5 HP on 3+ chain', () => {
    const result = resolveChainCompleteEffects(new Set(['chain_addict']), { chainLength: 3, firstCardId: 'x' });
    expect(result.healAmount).toBe(5);
  });

  it('heals on 5-chain too', () => {
    const result = resolveChainCompleteEffects(new Set(['chain_addict']), { chainLength: 5, firstCardId: 'x' });
    expect(result.healAmount).toBe(5);
  });

  it('no heal on 2-chain', () => {
    const result = resolveChainCompleteEffects(new Set(['chain_addict']), { chainLength: 2, firstCardId: 'x' });
    expect(result.healAmount ?? 0).toBe(0);
  });

  it('no heal without relic', () => {
    const result = resolveChainCompleteEffects(new Set([]), { chainLength: 3, firstCardId: 'x' });
    expect(result.healAmount ?? 0).toBe(0);
  });
});
