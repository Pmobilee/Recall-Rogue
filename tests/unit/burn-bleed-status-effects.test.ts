// === AR-203: Burn & Bleed Status Effect Unit Tests ===
// Tests for triggerBurn, getBleedBonus, additive stacking, multi-hit interaction,
// Bleed decay, and Self-Burn player mechanics.

import { describe, it, expect } from 'vitest';
import {
  triggerBurn,
  getBleedBonus,
  applyStatusEffect,
} from '../../src/data/statusEffects';
import type { StatusEffect } from '../../src/data/statusEffects';
import { BLEED_BONUS_PER_STACK } from '../../src/data/balance';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makeBurnEffect(stacks: number): StatusEffect {
  return { type: 'burn', value: stacks, turnsRemaining: 99 };
}

function makeBleedEffect(stacks: number): StatusEffect {
  return { type: 'bleed', value: stacks, turnsRemaining: 99 };
}

// ─────────────────────────────────────────────────────────
// triggerBurn — basic halving math
// ─────────────────────────────────────────────────────────

describe('triggerBurn — basic halving math', () => {
  it('returns bonus = stacks and halves: 8 → 4', () => {
    const effects: StatusEffect[] = [makeBurnEffect(8)];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(8);
    expect(result.stacksAfter).toBe(4);
    expect(effects[0].value).toBe(4);
  });

  it('second trigger: 4 → 2', () => {
    const effects: StatusEffect[] = [makeBurnEffect(4)];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(4);
    expect(result.stacksAfter).toBe(2);
  });

  it('rounds down on odd stacks: 7 → 3', () => {
    const effects: StatusEffect[] = [makeBurnEffect(7)];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(7);
    expect(result.stacksAfter).toBe(3);
  });

  it('1 stack: triggers for +1, then expires (stacksAfter = 0)', () => {
    const effects: StatusEffect[] = [makeBurnEffect(1)];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(1);
    expect(result.stacksAfter).toBe(0);
    // Effect should be removed from array
    expect(effects.find(e => e.type === 'burn')).toBeUndefined();
  });

  it('2 stacks: triggers for +2, halves to 1', () => {
    const effects: StatusEffect[] = [makeBurnEffect(2)];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(2);
    expect(result.stacksAfter).toBe(1);
    expect(effects[0].value).toBe(1);
  });

  it('returns 0 bonus when no Burn stacks present', () => {
    const effects: StatusEffect[] = [];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(0);
    expect(result.stacksAfter).toBe(0);
  });

  it('does not trigger if turnsRemaining = 0', () => {
    const effects: StatusEffect[] = [{ type: 'burn', value: 8, turnsRemaining: 0 }];
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(0);
  });

  it('full halving chain: 8 → 4 → 2 → 1 → 0 (expires)', () => {
    const effects: StatusEffect[] = [makeBurnEffect(8)];
    const r1 = triggerBurn(effects);
    expect(r1.bonusDamage).toBe(8); expect(r1.stacksAfter).toBe(4);
    const r2 = triggerBurn(effects);
    expect(r2.bonusDamage).toBe(4); expect(r2.stacksAfter).toBe(2);
    const r3 = triggerBurn(effects);
    expect(r3.bonusDamage).toBe(2); expect(r3.stacksAfter).toBe(1);
    const r4 = triggerBurn(effects);
    expect(r4.bonusDamage).toBe(1); expect(r4.stacksAfter).toBe(0);
    expect(effects.find(e => e.type === 'burn')).toBeUndefined();
    // No more stacks — returns 0
    const r5 = triggerBurn(effects);
    expect(r5.bonusDamage).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// triggerBurn — additive stacking
// ─────────────────────────────────────────────────────────

describe('triggerBurn — additive stacking', () => {
  it('6 Burn + 4 Burn = 10 Burn via applyStatusEffect', () => {
    const effects: StatusEffect[] = [];
    applyStatusEffect(effects, makeBurnEffect(6));
    applyStatusEffect(effects, makeBurnEffect(4));
    expect(effects.length).toBe(1);
    expect(effects[0].value).toBe(10);
  });

  it('stacked 10 Burn triggers for +10, halves to 5', () => {
    const effects: StatusEffect[] = [];
    applyStatusEffect(effects, makeBurnEffect(6));
    applyStatusEffect(effects, makeBurnEffect(4));
    const result = triggerBurn(effects);
    expect(result.bonusDamage).toBe(10);
    expect(result.stacksAfter).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────
// getBleedBonus
// ─────────────────────────────────────────────────────────

describe('getBleedBonus', () => {
  it('returns 0 when no Bleed stacks', () => {
    expect(getBleedBonus([], BLEED_BONUS_PER_STACK)).toBe(0);
  });

  it('5 stacks → 5 bonus (BLEED_BONUS_PER_STACK = 1)', () => {
    const effects: StatusEffect[] = [makeBleedEffect(5)];
    expect(getBleedBonus(effects, BLEED_BONUS_PER_STACK)).toBe(5);
  });

  it('1 stack → 1 bonus', () => {
    const effects: StatusEffect[] = [makeBleedEffect(1)];
    expect(getBleedBonus(effects, BLEED_BONUS_PER_STACK)).toBe(1);
  });

  it('does NOT mutate stacks (stacks remain unchanged after call)', () => {
    const effects: StatusEffect[] = [makeBleedEffect(5)];
    getBleedBonus(effects, BLEED_BONUS_PER_STACK);
    expect(effects[0].value).toBe(5); // unchanged
  });

  it('returns 0 if turnsRemaining = 0', () => {
    const effects: StatusEffect[] = [{ type: 'bleed', value: 5, turnsRemaining: 0 }];
    expect(getBleedBonus(effects, BLEED_BONUS_PER_STACK)).toBe(0);
  });

  it('Bleed does NOT add bonus on non-bleed effects array', () => {
    const effects: StatusEffect[] = [
      { type: 'poison', value: 5, turnsRemaining: 3 },
      { type: 'weakness', value: 1, turnsRemaining: 2 },
    ];
    expect(getBleedBonus(effects, BLEED_BONUS_PER_STACK)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// Bleed stacking
// ─────────────────────────────────────────────────────────

describe('Bleed — additive stacking', () => {
  it('3 Bleed + 2 Bleed = 5 Bleed', () => {
    const effects: StatusEffect[] = [];
    applyStatusEffect(effects, makeBleedEffect(3));
    applyStatusEffect(effects, makeBleedEffect(2));
    expect(effects.length).toBe(1);
    expect(effects[0].value).toBe(5);
  });

  it('5 Bleed + 3 hits = +15 total bonus', () => {
    const effects: StatusEffect[] = [makeBleedEffect(5)];
    let totalBonus = 0;
    for (let i = 0; i < 3; i++) {
      totalBonus += getBleedBonus(effects, BLEED_BONUS_PER_STACK);
    }
    expect(totalBonus).toBe(15);
    // Stacks still 5 — Bleed doesn't mutate on getBleedBonus
    expect(effects[0].value).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────
// Burn + multi-hit interaction
// ─────────────────────────────────────────────────────────

describe('Burn — multi-hit interaction', () => {
  it('8 Burn + 2 hits: hit 1 gets +8 (→4), hit 2 gets +4 (→2). Total bonus = 12', () => {
    const effects: StatusEffect[] = [makeBurnEffect(8)];
    const hit1 = triggerBurn(effects);
    expect(hit1.bonusDamage).toBe(8);
    expect(hit1.stacksAfter).toBe(4);
    const hit2 = triggerBurn(effects);
    expect(hit2.bonusDamage).toBe(4);
    expect(hit2.stacksAfter).toBe(2);
    const totalBurnBonus = hit1.bonusDamage + hit2.bonusDamage;
    expect(totalBurnBonus).toBe(12);
  });

  it('4 Burn + 3 hits: +4, +2, +1, then expires', () => {
    const effects: StatusEffect[] = [makeBurnEffect(4)];
    const r1 = triggerBurn(effects); expect(r1.bonusDamage).toBe(4);
    const r2 = triggerBurn(effects); expect(r2.bonusDamage).toBe(2);
    const r3 = triggerBurn(effects); expect(r3.bonusDamage).toBe(1);
    expect(effects.find(e => e.type === 'burn')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// Bleed decay simulation (isolated from turnManager)
// ─────────────────────────────────────────────────────────

describe('Bleed — decay simulation', () => {
  it('5 stacks: decays by 1 each turn, hits 0 and is removed after 5 turns', () => {
    const effects: StatusEffect[] = [makeBleedEffect(5)];
    const BLEED_DECAY_PER_TURN = 1; // mirroring the constant

    for (let turn = 5; turn > 0; turn--) {
      expect(effects.find(e => e.type === 'bleed')?.value).toBe(turn);
      // Simulate Bleed decay as turnManager does it
      const bleedEffect = effects.find(e => e.type === 'bleed');
      if (bleedEffect) {
        bleedEffect.value = Math.max(0, bleedEffect.value - BLEED_DECAY_PER_TURN);
        if (bleedEffect.value <= 0) {
          const idx = effects.indexOf(bleedEffect);
          if (idx !== -1) effects.splice(idx, 1);
        }
      }
    }

    expect(effects.find(e => e.type === 'bleed')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// Self-Burn (player-side Burn)
// ─────────────────────────────────────────────────────────

describe('Self-Burn — player Burn stacks', () => {
  it('player with 4 Burn stacks: triggerBurn returns +4, stacks halve to 2', () => {
    const playerEffects: StatusEffect[] = [makeBurnEffect(4)];
    const result = triggerBurn(playerEffects);
    expect(result.bonusDamage).toBe(4);
    expect(result.stacksAfter).toBe(2);
  });

  it('player with 8 Burn stacks hit by enemy for 10: total = 18 (before block), Burn → 4', () => {
    const playerEffects: StatusEffect[] = [makeBurnEffect(8)];
    let incomingDamage = 10;
    const selfBurn = triggerBurn(playerEffects);
    incomingDamage += selfBurn.bonusDamage;
    expect(incomingDamage).toBe(18);
    expect(selfBurn.stacksAfter).toBe(4);
    expect(playerEffects[0].value).toBe(4);
  });

  it('Self-Burn can be applied via applyStatusEffect to player effects', () => {
    const playerEffects: StatusEffect[] = [];
    applyStatusEffect(playerEffects, makeBurnEffect(6));
    expect(playerEffects.length).toBe(1);
    expect(playerEffects[0].type).toBe('burn');
    expect(playerEffects[0].value).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────
// tickStatusEffects — Burn and Bleed produce no passive damage
// ─────────────────────────────────────────────────────────

describe('tickStatusEffects — Burn and Bleed produce no passive damage', () => {
  it('tickStatusEffects returns burnBonusDealt=0 and bleedBonusDealt=0', async () => {
    const { tickStatusEffects } = await import('../../src/data/statusEffects');
    const effects: StatusEffect[] = [
      makeBurnEffect(8),
      makeBleedEffect(5),
    ];
    const result = tickStatusEffects(effects);
    expect(result.poisonDamage).toBe(0);
    expect(result.regenHeal).toBe(0);
    expect(result.burnBonusDealt).toBe(0);
    expect(result.bleedBonusDealt).toBe(0);
  });

  it('Burn and Bleed still decrement turnsRemaining on tick (for 99-sentinel)', async () => {
    const { tickStatusEffects } = await import('../../src/data/statusEffects');
    const effects: StatusEffect[] = [
      { type: 'burn', value: 4, turnsRemaining: 2 },
      { type: 'bleed', value: 3, turnsRemaining: 3 },
    ];
    tickStatusEffects(effects);
    const burn = effects.find(e => e.type === 'burn');
    const bleed = effects.find(e => e.type === 'bleed');
    expect(burn?.turnsRemaining).toBe(1);
    expect(bleed?.turnsRemaining).toBe(2);
  });
});
