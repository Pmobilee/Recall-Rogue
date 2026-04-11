/**
 * Unit tests for Phase 1 attack mechanics through cardEffectResolver.
 * Covers all 16 Phase 1 attack mechanics: QP, CC, and CW modes at mastery level 0.
 *
 * Values are sourced from MASTERY_STAT_TABLES in cardUpgradeService.ts (L0 row)
 * and cross-referenced against the resolver logic in cardEffectResolver.ts.
 *
 * Key formula at L0 (masteryBonus = stats.qpValue - mechanic.quickPlayValue):
 *   QP  = stats.qpValue
 *   CC  = Math.round(stats.qpValue * CHARGE_CORRECT_MULTIPLIER [1.50])
 *   CW  = Math.max(0, mechanic.chargeWrongValue + masteryBonus)
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(mechanicId: string, overrides?: Partial<Card>): Card {
  const mechanic = getMechanicDefinition(mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'attack') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 8,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId,
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

/**
 * Convenience wrapper: resolve a mechanic in a given play mode at mastery 0.
 * speedBonus = 1.0 — we test mechanic value selection, not speed/chain bonuses.
 */
function resolve(
  mechanicId: string,
  playMode: 'quick' | 'charge_correct' | 'charge_wrong',
  playerOverrides?: Partial<PlayerCombatState>,
  enemyOverrides?: Partial<EnemyInstance>,
  cardOverrides?: Partial<Card>,
) {
  const card = makeCard(mechanicId, cardOverrides);
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, { playMode });
}

// ── 1. strike ────────────────────────────────────────────────────────────────
// Stat table L0: qpValue=4
// QP=4, CC=round(4*1.50)=6, CW=3 (mechanic.chargeWrongValue=3 + masteryBonus=0)

describe('strike mechanic', () => {
  it('QP: deals 4 damage', () => {
    expect(resolve('strike', 'quick').damageDealt).toBe(4);
  });

  it('CC: deals 6 damage (round(4*1.50))', () => {
    expect(resolve('strike', 'charge_correct').damageDealt).toBe(6);
  });

  it('CW: deals 3 damage', () => {
    expect(resolve('strike', 'charge_wrong').damageDealt).toBe(3);
  });

  it('CW: always deals > 0 damage', () => {
    expect(resolve('strike', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });
});

// ── 2. multi_hit ─────────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, hitCount=2 (not 3 yet — L1 adds 3rd hit) — L0 bumped 1→2 (L0 balance overhaul 2026-04-10)
// mechanic.quickPlayValue=2, masteryBonus = 2-2 = 0 → CW = max(0, 2+0) = 2
// damageDealt is per-hit base value; turnManager accumulates total

describe('multi_hit mechanic', () => {
  it('QP: per-hit damage = 2 (stat table L0 qpValue=2), hitCount = 3 (mechanic.secondaryValue=3)', () => {
    const result = resolve('multi_hit', 'quick');
    expect(result.damageDealt).toBe(2);
    expect(result.hitCount).toBe(3);
  });

  it('CC: per-hit damage = 3 (round(2*1.50)=3), hitCount = 3', () => {
    const result = resolve('multi_hit', 'charge_correct');
    // Math.round(2 * 1.50) = 3
    expect(result.damageDealt).toBe(3);
    expect(result.hitCount).toBe(3);
  });

  it('CW: per-hit damage = 2 (chargeWrongValue=2 + masteryBonus=0 = 2), hitCount = 3', () => {
    const result = resolve('multi_hit', 'charge_wrong');
    expect(result.damageDealt).toBe(2);
    expect(result.hitCount).toBe(3);
  });

  it('hitCount is 3 (mechanic.secondaryValue=3; stat table hitCount not applied to card.secondaryValue by default)', () => {
    expect(resolve('multi_hit', 'quick').hitCount).toBe(3);
    expect(resolve('multi_hit', 'charge_correct').hitCount).toBe(3);
    expect(resolve('multi_hit', 'charge_wrong').hitCount).toBe(3);
  });
});

// ── 3. heavy_strike ──────────────────────────────────────────────────────────
// Stat table L0: qpValue=7 (mechanic quickPlayValue=10, masteryBonus=7-10=-3)
// QP=7, CC=round(7*1.50)=round(10.5)=11, CW=max(0, 7+(-3))=4 (chargeWrongValue=7)
// apCost=2 at L0 (from stat table)
// Updated 2026-04-10: qpValue bumped from 6→7 in MASTERY_STAT_TABLES balance pass

describe('heavy_strike mechanic', () => {
  it('QP: deals 7 damage (stat table L0 qpValue=7)', () => {
    expect(resolve('heavy_strike', 'quick').damageDealt).toBe(7);
  });

  it('CC: deals 11 damage (round(7*1.50)=round(10.5)=11)', () => {
    expect(resolve('heavy_strike', 'charge_correct').damageDealt).toBe(11);
  });

  it('CW: deals 4 damage (chargeWrongValue=7 + masteryBonus=-3 = 4)', () => {
    expect(resolve('heavy_strike', 'charge_wrong').damageDealt).toBe(4);
  });

  it('apCost is 2 at L0 (expensive heavy attack)', () => {
    const mechanic = getMechanicDefinition('heavy_strike');
    expect(mechanic?.apCost).toBe(2);
  });

  it('CW: always deals > 0 damage', () => {
    expect(resolve('heavy_strike', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });
});

// ── 4. piercing ──────────────────────────────────────────────────────────────
// Stat table L0: qpValue=3 (mechanic quickPlayValue=3, masteryBonus=3-3=0)
// QP=3, CC=round(3*1.50)=round(4.5)=5, CW=max(0, 2+0)=2 (chargeWrongValue=2)
// Key effect: damageDealtBypassesBlock = true in all modes

describe('piercing mechanic', () => {
  it('QP: deals 3 damage (stat table L0 qpValue=3), bypasses block', () => {
    const result = resolve('piercing', 'quick');
    expect(result.damageDealt).toBe(3);
    expect(result.damageDealtBypassesBlock).toBe(true);
  });

  it('CC: deals 5 damage (round(3*1.50)=round(4.5)=5), bypasses block', () => {
    const result = resolve('piercing', 'charge_correct');
    expect(result.damageDealt).toBe(5);
    expect(result.damageDealtBypassesBlock).toBe(true);
  });

  it('CW: deals 2 damage (chargeWrongValue=2 + masteryBonus=0 = 2), bypasses block', () => {
    const result = resolve('piercing', 'charge_wrong');
    expect(result.damageDealt).toBe(2);
    expect(result.damageDealtBypassesBlock).toBe(true);
  });

  it('bypass flag is set even with enemy block > 0 (turnManager handles the bypass)', () => {
    const result = resolve('piercing', 'quick', undefined, { block: 50 });
    expect(result.damageDealtBypassesBlock).toBe(true);
  });
});

// ── 5. reckless ──────────────────────────────────────────────────────────────
// Stat table L0: qpValue=4, extras.selfDmg=4 (but resolver reads mechanic.secondaryValue=3)
// QP=4, CC=round(4*1.50)=6, CW=max(0, 4+(-2))=2 (chargeWrongValue=4, masteryBonus=4-6=-2)
// selfDamage = mechanic.secondaryValue = 3 (extras.selfDmg not wired to resolver at L0)
// Note: stat table qpValue=4, mechanic.quickPlayValue=6, masteryBonus = 4-6 = -2

describe('reckless mechanic', () => {
  it('QP: 4 damage (stat table L0 qpValue=4), 3 self-damage (mechanic.secondaryValue)', () => {
    const result = resolve('reckless', 'quick');
    expect(result.damageDealt).toBe(4);
    expect(result.selfDamage).toBe(3);
  });

  it('CC: 6 damage (round(4*1.50)=6), 3 self-damage (flat — does NOT scale)', () => {
    const result = resolve('reckless', 'charge_correct');
    expect(result.damageDealt).toBe(6);
    expect(result.selfDamage).toBe(3);
  });

  it('CW: 2 damage (chargeWrongValue=4 + masteryBonus=-2 = 2), 3 self-damage', () => {
    const result = resolve('reckless', 'charge_wrong');
    expect(result.damageDealt).toBe(2);
    expect(result.selfDamage).toBe(3);
  });

  it('self-damage does NOT scale with play mode (always 3 at L0)', () => {
    expect(resolve('reckless', 'quick').selfDamage).toBe(3);
    expect(resolve('reckless', 'charge_correct').selfDamage).toBe(3);
    expect(resolve('reckless', 'charge_wrong').selfDamage).toBe(3);
  });

  it('CW: always deals > 0 damage', () => {
    expect(resolve('reckless', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });
});

// ── 6. execute ───────────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, extras.execBonus=4 (resolver hardcodes bonus: QP=8, CC=24, CW=4)
// QP=2, CC=round(2*1.50)=3, CW=max(0, 2+(-1))=1 (chargeWrongValue=2, masteryBonus=2-3=-1)
// Bonus below 30% HP threshold: QP+8, CC+24, CW+4 (resolver hardcodes these)

describe('execute mechanic', () => {
  it('QP: 2 damage at full HP (no bonus)', () => {
    const result = resolve('execute', 'quick', undefined, { currentHP: 100, maxHP: 100 });
    expect(result.damageDealt).toBe(2);
  });

  it('QP: 2+8=10 damage below 30% HP (QP bonus = 8)', () => {
    const result = resolve('execute', 'quick', undefined, { currentHP: 20, maxHP: 100 });
    expect(result.damageDealt).toBe(10);
  });

  it('CC: 3 damage at full HP (no bonus)', () => {
    const result = resolve('execute', 'charge_correct', undefined, { currentHP: 100, maxHP: 100 });
    expect(result.damageDealt).toBe(3);
  });

  it('CC: 3+24=27 damage below 30% HP (CC bonus = 24)', () => {
    const result = resolve('execute', 'charge_correct', undefined, { currentHP: 10, maxHP: 100 });
    expect(result.damageDealt).toBe(27);
  });

  it('CW: 1 damage at full HP (chargeWrongValue=2 + masteryBonus=-1 = 1)', () => {
    const result = resolve('execute', 'charge_wrong', undefined, { currentHP: 100, maxHP: 100 });
    expect(result.damageDealt).toBe(1);
  });

  it('CW: 1+4=5 damage below 30% HP (CW bonus = 4)', () => {
    const result = resolve('execute', 'charge_wrong', undefined, { currentHP: 10, maxHP: 100 });
    expect(result.damageDealt).toBe(5);
  });

  it('threshold check is strictly < 0.30: at exactly 30% HP, no bonus applies', () => {
    // 30/100 = 0.30, threshold is < 0.3, so no bonus at exactly 30%
    const result = resolve('execute', 'quick', undefined, { currentHP: 30, maxHP: 100 });
    expect(result.damageDealt).toBe(2);
  });

  it('threshold: at 29% HP bonus applies', () => {
    const result = resolve('execute', 'quick', undefined, { currentHP: 29, maxHP: 100 });
    expect(result.damageDealt).toBe(10);
  });
});

// ── 7. lifetap ───────────────────────────────────────────────────────────────
// Stat table L0: qpValue=5 (mechanic quickPlayValue=4, masteryBonus=5-4=+1) — bumped 3→5 (L0 balance overhaul 2026-04-10)
// QP=5, CC=round(5*1.50)=round(7.5)=8, CW=max(0, 3+1)=4 (chargeWrongValue=3)
// heal = Math.max(1, Math.floor(damage * 0.20))

describe('lifetap mechanic', () => {
  it('QP: 5 damage (stat table L0 qpValue=5), heals 1 (max(1,floor(5*0.20))=max(1,1)=1)', () => {
    const result = resolve('lifetap', 'quick');
    expect(result.damageDealt).toBe(5);
    expect(result.healApplied).toBe(1);
  });

  it('CC: 8 damage (round(5*1.50)=round(7.5)=8), heals 1 (floor(8*0.20)=1)', () => {
    const result = resolve('lifetap', 'charge_correct');
    expect(result.damageDealt).toBe(8);
    expect(result.healApplied).toBe(1);
  });

  it('CW: 4 damage (chargeWrongValue=3 + masteryBonus=+1 = 4), heals 1', () => {
    const result = resolve('lifetap', 'charge_wrong');
    expect(result.damageDealt).toBe(4);
    expect(result.healApplied).toBe(1);
  });

  it('heal is always at least 1 (even when 20% rounds to 0)', () => {
    expect(resolve('lifetap', 'quick').healApplied).toBeGreaterThanOrEqual(1);
    expect(resolve('lifetap', 'charge_correct').healApplied).toBeGreaterThanOrEqual(1);
    expect(resolve('lifetap', 'charge_wrong').healApplied).toBeGreaterThanOrEqual(1);
  });
});

// ── 8. power_strike ──────────────────────────────────────────────────────────
// Stat table L0: qpValue=4 (mechanic quickPlayValue=5, masteryBonus=4-5=-1)
// QP=4, CC=round(4*1.50)=6, CW=max(0, 4+(-1))=3 (chargeWrongValue=4)

describe('power_strike mechanic', () => {
  it('QP: deals 4 damage (stat table L0 qpValue=4)', () => {
    expect(resolve('power_strike', 'quick').damageDealt).toBe(4);
  });

  it('CC: deals 6 damage (round(4*1.50)=6)', () => {
    expect(resolve('power_strike', 'charge_correct').damageDealt).toBe(6);
  });

  it('CW: deals 3 damage (chargeWrongValue=4 + masteryBonus=-1 = 3)', () => {
    expect(resolve('power_strike', 'charge_wrong').damageDealt).toBe(3);
  });

  it('CW: always deals > 0 damage', () => {
    expect(resolve('power_strike', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });
});

// ── 9. twin_strike ───────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, hitCount=2 (mechanic quickPlayValue=3, masteryBonus=2-3=-1)
// QP=2, CC=round(2*1.50)=3, CW=max(0, 2+(-1))=1 (chargeWrongValue=2)
// hitCount=2 — triggers burn/bleed per hit (L3 adds third strike)

describe('twin_strike mechanic', () => {
  it('QP: per-hit damage = 2 (stat table L0 qpValue=2), hitCount = 2', () => {
    const result = resolve('twin_strike', 'quick');
    expect(result.damageDealt).toBe(2);
    expect(result.hitCount).toBe(2);
  });

  it('CC: per-hit damage = 3 (round(2*1.50)=3), hitCount = 2', () => {
    const result = resolve('twin_strike', 'charge_correct');
    expect(result.damageDealt).toBe(3);
    expect(result.hitCount).toBe(2);
  });

  it('CW: per-hit damage = 1 (chargeWrongValue=2 + masteryBonus=-1 = 1), hitCount = 2', () => {
    const result = resolve('twin_strike', 'charge_wrong');
    expect(result.damageDealt).toBe(1);
    expect(result.hitCount).toBe(2);
  });

  it('hitCount is 2 at L0 (3rd hit unlocks at L3)', () => {
    expect(resolve('twin_strike', 'quick').hitCount).toBe(2);
    expect(resolve('twin_strike', 'charge_correct').hitCount).toBe(2);
    expect(resolve('twin_strike', 'charge_wrong').hitCount).toBe(2);
  });

  it('hitCount enables per-hit Burn/Bleed triggering in turnManager', () => {
    // Confirm hitCount is set so turnManager knows to process each hit separately
    expect(resolve('twin_strike', 'quick').hitCount).toBeGreaterThan(1);
  });
});

// ── 10. iron_wave ────────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, secondaryValue=3 (2026-04-11 fix: normalized from deprecated getMastarySecondaryBonus)
// QP: damage=2, block=stat-table secondaryValue=3
// CC: damage=round(2*1.50)=3, block=round(3*1.50)=5 (same as deprecated path at L0 — coincidence)
// CW: damage=1, block=max(1, round(3*0.7))=max(1,2)=2

describe('iron_wave mechanic', () => {
  it('QP: 2 damage AND 3 block (stat-table secondaryValue L0=3 — 2026-04-11 normalized from deprecated getMastarySecondaryBonus)', () => {
    const result = resolve('iron_wave', 'quick');
    expect(result.damageDealt).toBe(2);
    expect(result.shieldApplied).toBe(3);
  });

  it('CC: 3 damage AND 5 block (round(secondaryValue=3 × 1.5)=5 — same value as deprecated path coincidentally)', () => {
    // CC block = round(stat-table secondaryValue × 1.5) = round(3 × 1.5) = round(4.5) = 5
    // Old deprecated path: round(mechanic.quickPlayValue × 1.5 + getMastarySecondaryBonus(0)) = round(3 × 1.5 + 0) = 5
    // Values match at L0 — both produce 5.
    const result = resolve('iron_wave', 'charge_correct');
    expect(result.damageDealt).toBe(3);
    expect(result.shieldApplied).toBe(5);
  });

  it('CW: 1 damage AND 2 block (max(1, round(stat-table secondaryValue=3 × 0.7))=max(1,2)=2)', () => {
    const result = resolve('iron_wave', 'charge_wrong');
    expect(result.damageDealt).toBe(1);
    expect(result.shieldApplied).toBe(2);
  });

  it('grants both damage AND block in all play modes', () => {
    expect(resolve('iron_wave', 'quick').damageDealt).toBeGreaterThan(0);
    expect(resolve('iron_wave', 'quick').shieldApplied).toBeGreaterThan(0);
    expect(resolve('iron_wave', 'charge_correct').damageDealt).toBeGreaterThan(0);
    expect(resolve('iron_wave', 'charge_correct').shieldApplied).toBeGreaterThan(0);
    expect(resolve('iron_wave', 'charge_wrong').damageDealt).toBeGreaterThan(0);
    expect(resolve('iron_wave', 'charge_wrong').shieldApplied).toBeGreaterThan(0);
  });
});

// ── 11. bash ─────────────────────────────────────────────────────────────────
// Stat table L0: qpValue=4, apCost=2 (mechanic quickPlayValue=5, masteryBonus=4-5=-1) — bumped 3→4 (L0 balance overhaul 2026-04-10)
// QP=4, CC=round(4*1.50)=6, CW=max(0, 4+(-1))=3 (chargeWrongValue=4)
// Always applies Vulnerable; CC applies 2 turns, QP/CW 1 turn

describe('bash mechanic', () => {
  it('QP: 4 damage (stat table L0 qpValue=4), applies Vulnerable 1 turn', () => {
    const result = resolve('bash', 'quick');
    expect(result.damageDealt).toBe(4);
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(1);
  });

  it('CC: 6 damage (round(4*1.50)=6), applies Vulnerable 2 turns', () => {
    const result = resolve('bash', 'charge_correct');
    expect(result.damageDealt).toBe(6);
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(2);
  });

  it('CW: 3 damage (chargeWrongValue=4 + masteryBonus=-1 = 3), applies Vulnerable 1 turn', () => {
    const result = resolve('bash', 'charge_wrong');
    expect(result.damageDealt).toBe(3);
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(1);
  });

  it('always applies Vulnerable in all play modes', () => {
    expect(resolve('bash', 'quick').statusesApplied.some(s => s.type === 'vulnerable')).toBe(true);
    expect(resolve('bash', 'charge_correct').statusesApplied.some(s => s.type === 'vulnerable')).toBe(true);
    expect(resolve('bash', 'charge_wrong').statusesApplied.some(s => s.type === 'vulnerable')).toBe(true);
  });
});

// ── 12. rupture ──────────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, secondaryValue=2 (mechanic: quickPlayValue=3, secondaryValue=3)
// masteryBonus = 2-3 = -1
// QP=2, CC=round(2*1.50)=3, CW=max(0, 2+(-1))=1 (chargeWrongValue=2)
// Bleed QP=card.secondaryValue=3 (mechanic value; masterySecBonus=-1 < 0, no adjustment)
//       CC=8 (hardcoded in resolver), CW=2 (hardcoded in resolver)

describe('rupture mechanic', () => {
  it('QP: 2 damage (stat table L0 qpValue=2), applies 3 bleed stacks (mechanic.secondaryValue)', () => {
    const result = resolve('rupture', 'quick');
    expect(result.damageDealt).toBe(2);
    expect(result.applyBleedStacks).toBe(3);
  });

  it('CC: 3 damage (round(2*1.50)=3), applies 8 bleed stacks (hardcoded CC)', () => {
    const result = resolve('rupture', 'charge_correct');
    expect(result.damageDealt).toBe(3);
    expect(result.applyBleedStacks).toBe(8);
  });

  it('CW: 1 damage (chargeWrongValue=2 + masteryBonus=-1 = 1), applies 2 bleed stacks (hardcoded CW)', () => {
    const result = resolve('rupture', 'charge_wrong');
    expect(result.damageDealt).toBe(1);
    expect(result.applyBleedStacks).toBe(2);
  });

  it('always applies bleed stacks in all play modes', () => {
    expect(resolve('rupture', 'quick').applyBleedStacks).toBeGreaterThan(0);
    expect(resolve('rupture', 'charge_correct').applyBleedStacks).toBeGreaterThan(0);
    expect(resolve('rupture', 'charge_wrong').applyBleedStacks).toBeGreaterThan(0);
  });
});

// ── 13. kindle ───────────────────────────────────────────────────────────────
// Stat table L0: qpValue=1, secondaryValue=2 (mechanic: quickPlayValue=2, secondaryValue=4)
// masteryBonus = 1-2 = -1
// QP=1, CC=round(1*1.50)=round(1.5)=2, CW=max(0, 2+(-1))=1 (chargeWrongValue=2)
// Burn: QP=card.secondaryValue=4 (mechanic value), CC=8, CW=2 (hardcoded in resolver)
// hitCount=1 — turnManager triggers Burn immediately once

describe('kindle mechanic', () => {
  it('QP: 1 damage (stat table L0 qpValue=1), applies 4 burn stacks (mechanic.secondaryValue), hitCount=1', () => {
    const result = resolve('kindle', 'quick');
    expect(result.damageDealt).toBe(1);
    expect(result.applyBurnStacks).toBe(4);
    expect(result.hitCount).toBe(1);
  });

  it('CC: 2 damage (round(1*1.50)=round(1.5)=2), applies 8 burn stacks (hardcoded CC), hitCount=1', () => {
    const result = resolve('kindle', 'charge_correct');
    expect(result.damageDealt).toBe(2);
    expect(result.applyBurnStacks).toBe(8);
    expect(result.hitCount).toBe(1);
  });

  it('CW: 1 damage (chargeWrongValue=2 + masteryBonus=-1 = 1), applies 2 burn stacks (hardcoded CW), hitCount=1', () => {
    const result = resolve('kindle', 'charge_wrong');
    expect(result.damageDealt).toBe(1);
    expect(result.applyBurnStacks).toBe(2);
    expect(result.hitCount).toBe(1);
  });

  it('hitCount=1 ensures turnManager triggers burn once immediately', () => {
    expect(resolve('kindle', 'quick').hitCount).toBe(1);
    expect(resolve('kindle', 'charge_correct').hitCount).toBe(1);
    expect(resolve('kindle', 'charge_wrong').hitCount).toBe(1);
  });
});

// ── 14. overcharge ───────────────────────────────────────────────────────────
// Stat table L0: qpValue=2 (mechanic quickPlayValue=3, masteryBonus=2-3=-1)
// QP=2, CC=round(2*1.50)=3, CW=max(0, 2+(-1))=1 (chargeWrongValue=2)
// CC scaling with encounter charge count is handled by turnManager (resolver is pure)

describe('overcharge mechanic', () => {
  it('QP: deals 2 damage (stat table L0 qpValue=2)', () => {
    expect(resolve('overcharge', 'quick').damageDealt).toBe(2);
  });

  it('CC: deals 3 damage (round(2*1.50)=3; turnManager scales further with charge count)', () => {
    expect(resolve('overcharge', 'charge_correct').damageDealt).toBe(3);
  });

  it('CW: deals 1 damage (chargeWrongValue=2 + masteryBonus=-1 = 1)', () => {
    expect(resolve('overcharge', 'charge_wrong').damageDealt).toBe(1);
  });

  it('CW: always deals > 0 damage', () => {
    expect(resolve('overcharge', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });

  it('resolver is pure: CC base is same regardless of correctChargesThisEncounter (turnManager adds bonus)', () => {
    // turnManager handles charge-count scaling; resolver returns the same base either way
    const r1 = resolveCardEffect(
      makeCard('overcharge'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', correctChargesThisEncounter: 5 }
    );
    const r2 = resolveCardEffect(
      makeCard('overcharge'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', correctChargesThisEncounter: 0 }
    );
    expect(r1.damageDealt).toBe(r2.damageDealt);
  });
});

// ── 15. riposte ──────────────────────────────────────────────────────────────
// Stat table L0: qpValue=2, secondaryValue=3 (mechanic: quickPlayValue=3, secondaryValue=4)
// masteryBonus = 2-3 = -1
// QP=2, CC=round(2*1.50)=3, CW=max(0, 2+(-1))=1 (chargeWrongValue=2)
// Block: QP=card.secondaryValue=4 (mechanic.secondaryValue, no negative masterySecBonus adjustment)
//        CC=12 (hardcoded in resolver)
//        CW=round(card.secondaryValue*0.75)=round(4*0.75)=round(3)=3

describe('riposte mechanic', () => {
  it('QP: 2 damage AND 4 block (mechanic.secondaryValue for QP block)', () => {
    const result = resolve('riposte', 'quick');
    expect(result.damageDealt).toBe(2);
    expect(result.shieldApplied).toBe(4);
  });

  it('CC: 3 damage (round(2*1.50)=3) AND 12 block (hardcoded CC value in resolver)', () => {
    const result = resolve('riposte', 'charge_correct');
    expect(result.damageDealt).toBe(3);
    expect(result.shieldApplied).toBe(12);
  });

  it('CW: 1 damage (chargeWrongValue=2 + masteryBonus=-1 = 1) AND 3 block (round(4*0.75)=3)', () => {
    const result = resolve('riposte', 'charge_wrong');
    expect(result.damageDealt).toBe(1);
    expect(result.shieldApplied).toBe(3);
  });

  it('grants both damage AND block in all play modes', () => {
    expect(resolve('riposte', 'quick').damageDealt).toBeGreaterThan(0);
    expect(resolve('riposte', 'quick').shieldApplied).toBeGreaterThan(0);
    expect(resolve('riposte', 'charge_correct').damageDealt).toBeGreaterThan(0);
    expect(resolve('riposte', 'charge_correct').shieldApplied).toBeGreaterThan(0);
    expect(resolve('riposte', 'charge_wrong').damageDealt).toBeGreaterThan(0);
    expect(resolve('riposte', 'charge_wrong').shieldApplied).toBeGreaterThan(0);
  });
});

// ── 16. precision_strike ─────────────────────────────────────────────────────
// Stat table L0: qpValue=5 (mechanic quickPlayValue=8, masteryBonus=5-8=-3)
// QP=5, CW=max(0, 4+(-3))=1 (chargeWrongValue=4, masteryBonus=-3)
// CC: resolver hardcodes damage = 8 * (distractorCount + 1) regardless of mastery
//   default distractorCount=2 → CC = 8*(2+1) = 24
//   distractorCount=4 → CC = 8*(4+1) = 40

describe('precision_strike mechanic', () => {
  it('QP: deals 5 damage (stat table L0 qpValue=5)', () => {
    expect(resolve('precision_strike', 'quick').damageDealt).toBe(5);
  });

  it('CW: deals 1 damage (chargeWrongValue=4 + masteryBonus=-3 = 1)', () => {
    expect(resolve('precision_strike', 'charge_wrong').damageDealt).toBe(1);
  });

  it('CC with default distractorCount=2: 18 damage (6 * (2+1)) [Pass 8 balance]', () => {
    const result = resolveCardEffect(
      makeCard('precision_strike'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', distractorCount: 2 },
    );
    expect(result.damageDealt).toBe(18);
  });

  it('CC with distractorCount=3: 24 damage (6 * (3+1)) [Pass 8 balance]', () => {
    const result = resolveCardEffect(
      makeCard('precision_strike'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', distractorCount: 3 },
    );
    expect(result.damageDealt).toBe(24);
  });

  it('CC with distractorCount=4: 30 damage (6 * (4+1)) [Pass 8 balance]', () => {
    const result = resolveCardEffect(
      makeCard('precision_strike'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', distractorCount: 4 },
    );
    expect(result.damageDealt).toBe(30);
  });

  it('CC damage scales with difficulty: more distractors = more damage', () => {
    const r2 = resolveCardEffect(
      makeCard('precision_strike'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', distractorCount: 2 },
    );
    const r4 = resolveCardEffect(
      makeCard('precision_strike'), makePlayer(), makeEnemy(), 1.0, 0, undefined, undefined,
      { playMode: 'charge_correct', distractorCount: 4 },
    );
    expect(r4.damageDealt).toBeGreaterThan(r2.damageDealt);
  });
});

// ── Cross-mechanic correctness checks ────────────────────────────────────────

describe('all Phase 1 attack mechanics deal > 0 on CW', () => {
  const attackMechanics = [
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless',
    'execute', 'lifetap', 'power_strike', 'twin_strike', 'iron_wave',
    'bash', 'rupture', 'kindle', 'overcharge', 'riposte', 'precision_strike',
  ];

  for (const id of attackMechanics) {
    it(`${id} CW: combined damageDealt + shieldApplied > 0`, () => {
      const result = resolve(id, 'charge_wrong');
      const totalEffect = result.damageDealt + (result.shieldApplied ?? 0);
      expect(totalEffect).toBeGreaterThan(0);
    });
  }
});

describe('all Phase 1 attack mechanics: CC deals more than QP', () => {
  // Excludes precision_strike (CC uses distractor-count formula, not 1.75x)
  const scalingAttacks = [
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless',
    'execute', 'lifetap', 'power_strike', 'twin_strike',
    'bash', 'rupture', 'kindle', 'overcharge',
    // iron_wave and riposte also excluded: CC block path differs but damage still scales
  ];

  for (const id of scalingAttacks) {
    it(`${id}: CC damage > QP damage`, () => {
      const qp = resolve(id, 'quick').damageDealt;
      const cc = resolve(id, 'charge_correct').damageDealt;
      expect(cc).toBeGreaterThan(qp);
    });
  }
});

describe('Phase 1 attack mechanics: effectType is attack', () => {
  const attackMechanics = [
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless',
    'execute', 'lifetap', 'power_strike', 'twin_strike', 'iron_wave',
    'bash', 'rupture', 'kindle', 'overcharge', 'riposte', 'precision_strike',
  ];

  for (const id of attackMechanics) {
    it(`${id}: effectType = 'attack'`, () => {
      expect(resolve(id, 'quick').effectType).toBe('attack');
    });
  }
});
