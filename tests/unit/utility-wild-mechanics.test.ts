/**
 * Unit tests for Phase 1 utility and wild card mechanics.
 * Covers: cleanse, scout, recycle, foresight, sift, scavenge, swap, mirror, adapt, overclock.
 *
 * Pattern mirrors tests/unit/play-mode-mechanics.test.ts — same helpers, same resolve() wrapper.
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> & { mechanicId: string }): Card {
  const mechanic = getMechanicDefinition(overrides.mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'utility') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 1,
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

/** Resolve a mechanic in the given play mode with chargeMultiplier=1.0 (tests mechanic selection, not multiplier). */
function resolve(
  mechanicId: string,
  playMode: 'quick' | 'charge_correct' | 'charge_wrong',
  playerOverrides?: Partial<PlayerCombatState>,
  enemyOverrides?: Partial<EnemyInstance>,
  cardOverrides?: Partial<Card>,
) {
  const card = makeCard({ mechanicId, ...cardOverrides });
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, { playMode });
}

// ── MechanicDefinition presence — utility + wild ─────────────────────────────

describe('MechanicDefinition fields — utility and wild mechanics', () => {
  const mechanics = [
    'cleanse', 'scout', 'recycle', 'foresight', 'sift', 'scavenge', 'swap',
    'mirror', 'adapt', 'overclock',
  ];

  for (const id of mechanics) {
    it(`${id} is defined and has v2 play-mode values`, () => {
      const m = getMechanicDefinition(id);
      expect(m, `mechanic '${id}' not found`).toBeDefined();
      expect(m!.quickPlayValue, `${id}.quickPlayValue`).toBeDefined();
      expect(m!.chargeCorrectValue, `${id}.chargeCorrectValue`).toBeDefined();
      expect(m!.chargeWrongValue, `${id}.chargeWrongValue`).toBeDefined();
    });
  }
});

describe('mechanic types', () => {
  const utilityMechanics = ['cleanse', 'scout', 'recycle', 'foresight', 'sift', 'scavenge', 'swap'];
  const wildMechanics = ['mirror', 'adapt', 'overclock'];

  for (const id of utilityMechanics) {
    it(`${id} has type 'utility'`, () => {
      expect(getMechanicDefinition(id)!.type).toBe('utility');
    });
  }

  for (const id of wildMechanics) {
    it(`${id} has type 'wild'`, () => {
      expect(getMechanicDefinition(id)!.type).toBe('wild');
    });
  }
});

describe('launch phase assignments', () => {
  it('cleanse, scout, recycle, foresight are launchPhase 1', () => {
    expect(getMechanicDefinition('cleanse')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('scout')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('recycle')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('foresight')!.launchPhase).toBe(1);
  });

  it('sift, scavenge, swap are launchPhase 1 (AR-206 expansion)', () => {
    expect(getMechanicDefinition('sift')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('scavenge')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('swap')!.launchPhase).toBe(1);
  });

  it('mirror, adapt are launchPhase 1', () => {
    expect(getMechanicDefinition('mirror')!.launchPhase).toBe(1);
    expect(getMechanicDefinition('adapt')!.launchPhase).toBe(1);
  });

  it('overclock is launchPhase 2', () => {
    expect(getMechanicDefinition('overclock')!.launchPhase).toBe(2);
  });
});

describe('AP cost assignments', () => {
  it('foresight has apCost 0', () => {
    expect(getMechanicDefinition('foresight')!.apCost).toBe(0);
  });

  it('swap has apCost 0', () => {
    expect(getMechanicDefinition('swap')!.apCost).toBe(0);
  });

  it('overclock has apCost 2', () => {
    expect(getMechanicDefinition('overclock')!.apCost).toBe(2);
  });
});

describe('charge bonus effects on definition', () => {
  it('recycle has chargeBonusEffect: recycle_from_discard', () => {
    expect(getMechanicDefinition('recycle')!.chargeBonusEffect).toBe('recycle_from_discard');
  });

  it('foresight has chargeBonusEffect: foresight_intent', () => {
    expect(getMechanicDefinition('foresight')!.chargeBonusEffect).toBe('foresight_intent');
  });
});

// ── cleanse ───────────────────────────────────────────────────────────────────

describe('cleanse mechanic', () => {
  it('quick: applyCleanse=true, draws 1 card', () => {
    const result = resolve('cleanse', 'quick');
    expect(result.applyCleanse).toBe(true);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_correct: applyCleanse=true, draws 1 card', () => {
    const result = resolve('cleanse', 'charge_correct');
    expect(result.applyCleanse).toBe(true);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_wrong: applyCleanse=true, draws 1 card', () => {
    const result = resolve('cleanse', 'charge_wrong');
    expect(result.applyCleanse).toBe(true);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('deals no damage in any mode (utility — no attack effect)', () => {
    expect(resolve('cleanse', 'quick').damageDealt).toBe(0);
    expect(resolve('cleanse', 'charge_correct').damageDealt).toBe(0);
    expect(resolve('cleanse', 'charge_wrong').damageDealt).toBe(0);
  });

  it('applies no shield in any mode', () => {
    expect(resolve('cleanse', 'quick').shieldApplied).toBe(0);
    expect(resolve('cleanse', 'charge_correct').shieldApplied).toBe(0);
    expect(resolve('cleanse', 'charge_wrong').shieldApplied).toBe(0);
  });
});

// ── scout ─────────────────────────────────────────────────────────────────────

describe('scout mechanic', () => {
  it('quick: draws 2 cards (quickPlayValue=2)', () => {
    const result = resolve('scout', 'quick');
    expect(result.extraCardsDrawn).toBe(2);
  });

  it('charge_correct: draws 3 cards (chargeCorrectValue=3)', () => {
    const result = resolve('scout', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(3);
  });

  it('charge_wrong: draws 1 card (chargeWrongValue=1)', () => {
    const result = resolve('scout', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('deals no damage and applies no shield in any mode', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const r = resolve('scout', mode);
      expect(r.damageDealt, `scout ${mode} damage`).toBe(0);
      expect(r.shieldApplied, `scout ${mode} shield`).toBe(0);
    }
  });
});

// ── recycle ───────────────────────────────────────────────────────────────────

describe('recycle mechanic', () => {
  it('quick: draws 3 cards, no discard draw', () => {
    const result = resolve('recycle', 'quick');
    expect(result.extraCardsDrawn).toBe(3);
    expect(result.drawFromDiscard).toBeUndefined();
  });

  it('charge_correct: draws 4 cards AND drawFromDiscard=1', () => {
    const result = resolve('recycle', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(4);
    expect(result.drawFromDiscard).toBe(1);
  });

  it('charge_wrong: draws 2 cards, no discard draw', () => {
    const result = resolve('recycle', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(2);
    expect(result.drawFromDiscard).toBeUndefined();
  });

  it('QP draw count > CW draw count (scaling progression)', () => {
    const qp = resolve('recycle', 'quick').extraCardsDrawn;
    const cw = resolve('recycle', 'charge_wrong').extraCardsDrawn;
    const cc = resolve('recycle', 'charge_correct').extraCardsDrawn;
    expect(cc).toBeGreaterThan(qp);
    expect(qp).toBeGreaterThan(cw);
  });
});

// ── foresight ─────────────────────────────────────────────────────────────────

describe('foresight mechanic', () => {
  it('quick: draws 2 cards (foresight quickPlayValue=1 → resolver maps to 2)', () => {
    // Per the resolver, QP draws finalValue+1=2 (baseEffectValue=2 from mechanic)
    const result = resolve('foresight', 'quick');
    expect(result.extraCardsDrawn).toBe(2);
  });

  it('charge_correct: draws 3 cards', () => {
    const result = resolve('foresight', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(3);
  });

  it('charge_wrong: draws 1 card', () => {
    const result = resolve('foresight', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('quick: revealNextIntent is falsy (only triggered by foresight_intent tag)', () => {
    const result = resolve('foresight', 'quick');
    expect(result.revealNextIntent).toBeFalsy();
  });

  it('deals no damage in any mode', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('foresight', mode).damageDealt).toBe(0);
    }
  });
});

// ── sift ──────────────────────────────────────────────────────────────────────

describe('sift mechanic', () => {
  it('quick: siftParams set with lookAt=3, discardCount=1', () => {
    const result = resolve('sift', 'quick');
    expect(result.siftParams).toBeDefined();
    expect(result.siftParams!.lookAt).toBe(3); // baseEffectValue=3
    expect(result.siftParams!.discardCount).toBe(1);
  });

  it('charge_correct: lookAt=5, discardCount=2 (bigger scry window on CC)', () => {
    const result = resolve('sift', 'charge_correct');
    expect(result.siftParams).toBeDefined();
    expect(result.siftParams!.lookAt).toBe(5);
    expect(result.siftParams!.discardCount).toBe(2);
  });

  it('charge_wrong: lookAt=2, discardCount=1 (reduced scry on CW)', () => {
    const result = resolve('sift', 'charge_wrong');
    expect(result.siftParams).toBeDefined();
    expect(result.siftParams!.lookAt).toBe(2);
    expect(result.siftParams!.discardCount).toBe(1);
  });

  it('CC lookAt > QP lookAt > CW lookAt (scry scales with mode)', () => {
    const ccLook = resolve('sift', 'charge_correct').siftParams!.lookAt;
    const qpLook = resolve('sift', 'quick').siftParams!.lookAt;
    const cwLook = resolve('sift', 'charge_wrong').siftParams!.lookAt;
    expect(ccLook).toBeGreaterThan(qpLook);
    expect(qpLook).toBeGreaterThan(cwLook);
  });

  it('deals no damage in any mode', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('sift', mode).damageDealt).toBe(0);
    }
  });
});

// ── scavenge ──────────────────────────────────────────────────────────────────

describe('scavenge mechanic', () => {
  it('quick: sets pendingCardPick with type scavenge', () => {
    const result = resolve('scavenge', 'quick');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('scavenge');
  });

  it('charge_correct: sets pendingCardPick with type scavenge', () => {
    const result = resolve('scavenge', 'charge_correct');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('scavenge');
  });

  it('charge_wrong: sets pendingCardPick with type scavenge', () => {
    const result = resolve('scavenge', 'charge_wrong');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('scavenge');
  });

  it('pendingCardPick allows skip (optional action)', () => {
    const result = resolve('scavenge', 'quick');
    expect(result.pendingCardPick!.allowSkip).toBe(true);
  });

  it('pendingCardPick pickCount is 1', () => {
    const result = resolve('scavenge', 'quick');
    expect(result.pendingCardPick!.pickCount).toBe(1);
  });

  it('deals no damage and applies no shield', () => {
    const result = resolve('scavenge', 'quick');
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });
});

// ── swap ──────────────────────────────────────────────────────────────────────

describe('swap mechanic', () => {
  it('quick: discard 1, draw 1 replacement', () => {
    const result = resolve('swap', 'quick');
    expect(result.swapDiscardDraw).toBeDefined();
    expect(result.swapDiscardDraw!.discardCount).toBe(1);
    expect(result.swapDiscardDraw!.drawCount).toBe(1);
  });

  it('charge_correct: discard 1, draw 2 (bonus draw on CC)', () => {
    const result = resolve('swap', 'charge_correct');
    expect(result.swapDiscardDraw).toBeDefined();
    expect(result.swapDiscardDraw!.discardCount).toBe(1);
    expect(result.swapDiscardDraw!.drawCount).toBe(2);
  });

  it('charge_wrong: discard 1, draw 1', () => {
    const result = resolve('swap', 'charge_wrong');
    expect(result.swapDiscardDraw).toBeDefined();
    expect(result.swapDiscardDraw!.discardCount).toBe(1);
    expect(result.swapDiscardDraw!.drawCount).toBe(1);
  });

  it('CC always draws more than QP/CW (net card advantage on CC)', () => {
    const ccDraw = resolve('swap', 'charge_correct').swapDiscardDraw!.drawCount;
    const qpDraw = resolve('swap', 'quick').swapDiscardDraw!.drawCount;
    expect(ccDraw).toBeGreaterThan(qpDraw);
  });

  it('deals no damage and applies no shield', () => {
    const result = resolve('swap', 'quick');
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });
});

// ── mirror ────────────────────────────────────────────────────────────────────

describe('mirror mechanic', () => {
  it('quick: mirrorCopy=true', () => {
    const result = resolve('mirror', 'quick');
    expect(result.mirrorCopy).toBe(true);
  });

  it('charge_correct: mirrorCopy=true', () => {
    const result = resolve('mirror', 'charge_correct');
    expect(result.mirrorCopy).toBe(true);
  });

  it('charge_wrong: mirrorCopy=true', () => {
    const result = resolve('mirror', 'charge_wrong');
    expect(result.mirrorCopy).toBe(true);
  });

  it('does not directly deal damage (actual effect comes from turnManager copy resolution)', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const r = resolve('mirror', mode);
      expect(r.damageDealt, `mirror ${mode} damage`).toBe(0);
    }
  });

  it('does not apply shield directly', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('mirror', mode).shieldApplied).toBe(0);
    }
  });
});

// ── adapt ─────────────────────────────────────────────────────────────────────

describe('adapt mechanic', () => {
  it('quick: produces a pendingCardPick with type adapt', () => {
    const result = resolve('adapt', 'quick');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('adapt');
  });

  it('charge_correct: produces a pendingCardPick with type adapt', () => {
    const result = resolve('adapt', 'charge_correct');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('adapt');
  });

  it('charge_wrong: produces a pendingCardPick with type adapt', () => {
    const result = resolve('adapt', 'charge_wrong');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('adapt');
  });

  it('pendingCardPick provides 3 candidates (attack, shield, cleanse)', () => {
    const result = resolve('adapt', 'quick');
    expect(result.pendingCardPick!.candidates).toHaveLength(3);
    const mechanicIds = result.pendingCardPick!.candidates.map(c => c.mechanicId);
    expect(mechanicIds).toContain('strike');
    expect(mechanicIds).toContain('block');
    expect(mechanicIds).toContain('cleanse');
  });

  it('pendingCardPick allows skip and picks 1', () => {
    const result = resolve('adapt', 'quick');
    expect(result.pendingCardPick!.allowSkip).toBe(true);
    expect(result.pendingCardPick!.pickCount).toBe(1);
  });

  it('does not deal direct damage before choice is resolved', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('adapt', mode).damageDealt).toBe(0);
    }
  });
});

// ── overclock ─────────────────────────────────────────────────────────────────

describe('overclock mechanic', () => {
  it('quick: applyOverclock=true', () => {
    const result = resolve('overclock', 'quick');
    expect(result.applyOverclock).toBe(true);
  });

  it('charge_correct: applyOverclock=true', () => {
    const result = resolve('overclock', 'charge_correct');
    expect(result.applyOverclock).toBe(true);
  });

  it('charge_wrong: applyOverclock=true', () => {
    const result = resolve('overclock', 'charge_wrong');
    expect(result.applyOverclock).toBe(true);
  });

  it('does not deal damage (buff only — next card gets 2x effect)', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('overclock', mode).damageDealt).toBe(0);
    }
  });

  it('does not apply shield (not a shield card)', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('overclock', mode).shieldApplied).toBe(0);
    }
  });
});

// ── Cross-cutting: no utility/wild breaks on wrong answers ───────────────────

describe('utility and wild mechanics never crash or NaN on charge_wrong', () => {
  const allMechanics = ['cleanse', 'scout', 'recycle', 'foresight', 'sift', 'scavenge', 'swap', 'mirror', 'adapt', 'overclock'];

  for (const id of allMechanics) {
    it(`${id} resolves without errors on charge_wrong`, () => {
      expect(() => resolve(id, 'charge_wrong')).not.toThrow();
      const result = resolve(id, 'charge_wrong');
      // No NaN in numeric fields
      expect(Number.isNaN(result.damageDealt)).toBe(false);
      expect(Number.isNaN(result.shieldApplied)).toBe(false);
      expect(Number.isNaN(result.extraCardsDrawn)).toBe(false);
    });
  }
});
