/**
 * Unit tests for 6 reworked relic effects (Phase 4 mechanics overhaul).
 *
 * Relic reworks tested:
 *   brass_knuckles — every 2nd attack grants +1 permanent Strength (was: +6 flat damage)
 *   iron_shield    — 2 + shieldsPlayedLastTurn block per turn (was: static +5 block)
 *   herbal_pouch   — +1 Poison/turn + heal 3 post-combat (was: conditional heal)
 *   thick_skin     — debuffs reflected to enemy (was: debuff duration -1)
 *   scavengers_eye — draw 1 on exhaust (was: +1 card reward)
 *   tattered_notebook — +1 temp Strength on exhaust (was: +5 gold)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAttackModifiers,
  resolveTurnStartEffects,
  resolveEncounterEndEffects,
  resolveDebuffAppliedModifiers,
  resolveExhaustEffects,
} from '../../src/services/relicEffectResolver';
import type { AttackContext } from '../../src/services/relicEffectResolver';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRelics(...ids: string[]): Set<string> {
  return new Set(ids);
}

const DEFAULT_ATTACK_CONTEXT: AttackContext = {
  isFirstAttack: false,
  isStrikeTagged: false,
  playerHpPercent: 1.0,
  consecutiveCorrectAttacks: 0,
  cardTier: 'learning',
  correctStreakThisEncounter: 0,
  enemyHpPercent: 1.0,
};

// ── brass_knuckles ────────────────────────────────────────────────────────────

describe('brass_knuckles (v3) — +1 Strength every 2nd attack', () => {
  it('does NOT grant Strength on 1st attack (count=1)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 1,
    });
    expect(result.strengthGain).toBe(0);
  });

  it('grants +1 Strength on 2nd attack (count=2)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 2,
    });
    expect(result.strengthGain).toBe(1);
  });

  it('does NOT grant Strength on 3rd attack (count=3, odd)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 3,
    });
    expect(result.strengthGain).toBe(0);
  });

  it('grants +1 Strength on 4th attack (count=4, even)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 4,
    });
    expect(result.strengthGain).toBe(1);
  });

  it('grants Strength on 6th attack (every 3rd)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 6,
    });
    expect(result.strengthGain).toBe(1);
  });

  it('grants Strength on 8th attack (every 2nd)', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 8,
    });
    expect(result.strengthGain).toBe(1);
  });

  it('does NOT grant Strength when brass_knuckles is not held', () => {
    const result = resolveAttackModifiers(makeRelics(), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 3,
    });
    expect(result.strengthGain).toBe(0);
  });

  it('strengthGain is 0 when attackCount is 0', () => {
    const result = resolveAttackModifiers(makeRelics('brass_knuckles'), { ...DEFAULT_ATTACK_CONTEXT,
      attackCountThisEncounter: 0,
    });
    expect(result.strengthGain).toBe(0);
  });
});

// ── iron_shield ───────────────────────────────────────────────────────────────

describe('iron_shield (v3) — 2 + shieldsPlayedLastTurn block per turn', () => {
  it('grants 2 block when 0 shields played last turn', () => {
    const result = resolveTurnStartEffects(makeRelics('iron_shield'), 0, {
      shieldsPlayedLastTurn: 0,
    });
    expect(result.bonusBlock).toBe(2);
  });

  it('grants 3 block when 1 shield played last turn', () => {
    const result = resolveTurnStartEffects(makeRelics('iron_shield'), 0, {
      shieldsPlayedLastTurn: 1,
    });
    expect(result.bonusBlock).toBe(3);
  });

  it('grants 4 block when 2 shields played last turn', () => {
    const result = resolveTurnStartEffects(makeRelics('iron_shield'), 0, {
      shieldsPlayedLastTurn: 2,
    });
    expect(result.bonusBlock).toBe(4);
  });

  it('grants 7 block when 5 shields played last turn', () => {
    const result = resolveTurnStartEffects(makeRelics('iron_shield'), 0, {
      shieldsPlayedLastTurn: 5,
    });
    expect(result.bonusBlock).toBe(7);
  });

  it('does NOT grant block when iron_shield is not held', () => {
    const result = resolveTurnStartEffects(makeRelics(), 0, {
      shieldsPlayedLastTurn: 3,
    });
    expect(result.bonusBlock).toBe(0);
  });

  it('does NOT apply legacy iron_buckler formula (5 flat)', () => {
    const result = resolveTurnStartEffects(makeRelics('iron_shield'), 0, {
      shieldsPlayedLastTurn: 0,
    });
    // v3 = 2 + 0 = 2, not 5
    expect(result.bonusBlock).toBe(2);
    expect(result.bonusBlock).not.toBe(5);
  });
});

// ── herbal_pouch ──────────────────────────────────────────────────────────────

describe('herbal_pouch (v3) — +1 Poison per turn + heal 3 post-combat', () => {
  it('applies 1 Poison to all enemies at turn start', () => {
    const result = resolveTurnStartEffects(makeRelics('herbal_pouch'));
    expect(result.poisonToAllEnemies).toBe(1);
  });

  it('does NOT apply Poison when herbal_pouch is not held', () => {
    const result = resolveTurnStartEffects(makeRelics());
    expect(result.poisonToAllEnemies).toBe(0);
  });

  it('heals 3 HP post-combat', () => {
    const result = resolveEncounterEndEffects(makeRelics('herbal_pouch'), {
      chargesCorrectThisEncounter: 0,
    });
    expect(result.healHp).toBe(3);
  });

  it('heals 3 HP post-combat regardless of charge count', () => {
    const result = resolveEncounterEndEffects(makeRelics('herbal_pouch'), {
      chargesCorrectThisEncounter: 10,
    });
    expect(result.healHp).toBe(3);
  });

  it('does NOT heal when herbal_pouch is not held', () => {
    const result = resolveEncounterEndEffects(makeRelics(), {
      chargesCorrectThisEncounter: 5,
    });
    expect(result.healHp).toBe(0);
  });
});

// ── thick_skin ────────────────────────────────────────────────────────────────

describe('thick_skin (v3) — reflect debuffs to enemy instead of applying to player', () => {
  it('sets reflectToEnemy=true when thick_skin is held', () => {
    const result = resolveDebuffAppliedModifiers(makeRelics('thick_skin'), {
      isFirstDebuffThisEncounter: true,
    });
    expect(result.reflectToEnemy).toBe(true);
  });

  it('sets reflectToEnemy=true even on non-first debuff', () => {
    const result = resolveDebuffAppliedModifiers(makeRelics('thick_skin'), {
      isFirstDebuffThisEncounter: false,
    });
    expect(result.reflectToEnemy).toBe(true);
  });

  it('sets reflectToEnemy=false when thick_skin is not held', () => {
    const result = resolveDebuffAppliedModifiers(makeRelics(), {
      isFirstDebuffThisEncounter: true,
    });
    expect(result.reflectToEnemy).toBe(false);
  });
});

// ── scavengers_eye ────────────────────────────────────────────────────────────

describe('scavengers_eye (v3) — draw 1 card on exhaust', () => {
  it('grants +1 bonusCardDraw on exhaust', () => {
    const result = resolveExhaustEffects(makeRelics('scavengers_eye'));
    expect(result.bonusCardDraw).toBe(1);
  });

  it('does NOT grant bonus draw when scavengers_eye is not held', () => {
    const result = resolveExhaustEffects(makeRelics());
    expect(result.bonusCardDraw).toBe(0);
  });

  it('stacks with exhaustion_engine (both held: +3 draw)', () => {
    const result = resolveExhaustEffects(makeRelics('scavengers_eye', 'exhaustion_engine'));
    expect(result.bonusCardDraw).toBe(3); // 2 from exhaustion_engine + 1 from scavengers_eye
  });

  it('does NOT grant tempStrengthGain', () => {
    const result = resolveExhaustEffects(makeRelics('scavengers_eye'));
    expect(result.tempStrengthGain).toBe(0);
  });
});

// ── tattered_notebook ─────────────────────────────────────────────────────────

describe('tattered_notebook (v3) — +1 temporary Strength on exhaust', () => {
  it('grants +1 tempStrengthGain on exhaust', () => {
    const result = resolveExhaustEffects(makeRelics('tattered_notebook'));
    expect(result.tempStrengthGain).toBe(1);
  });

  it('does NOT grant tempStrengthGain when tattered_notebook is not held', () => {
    const result = resolveExhaustEffects(makeRelics());
    expect(result.tempStrengthGain).toBe(0);
  });

  it('stacks with other exhaust relics on bonusCardDraw (not on tempStrengthGain)', () => {
    const result = resolveExhaustEffects(makeRelics('tattered_notebook', 'scavengers_eye'));
    expect(result.bonusCardDraw).toBe(1); // scavengers_eye only
    expect(result.tempStrengthGain).toBe(1); // tattered_notebook only
  });
});
