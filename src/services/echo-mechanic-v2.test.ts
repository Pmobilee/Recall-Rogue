/**
 * AR-59.20 — Echo Mechanic V2 unit tests.
 *
 * Tests the updated Echo card behavior:
 * - createEchoCardFrom: stores full base power (not pre-reduced at 0.70×)
 * - resolveCardEffect / resolveEchoBase: correct Charge = 1.0×, wrong Charge = 0.5×
 * - echo_lens relic override: full power even on wrong Charge
 * - ECHO balance constants correctness
 */

import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from './cardEffectResolver';
import { ECHO } from '../data/balance';
import type { Card } from '../data/card-types';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../data/enemies';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card-1',
    factId: 'fact-001',
    domain: 'natural_sciences',
    cardType: 'attack',
    mechanicId: 'strike',
    mechanicName: 'Strike',
    baseEffectValue: 10,
    effectMultiplier: 1,
    apCost: 1,
    tier: '1',
    isEcho: false,
    isMasteryTrial: false,
    isUpgraded: false,
    ...overrides,
  };
}

function makeEchoCard(baseEffectValue: number, relicOverrides: Partial<Card> = {}): Card {
  return makeCard({
    id: `echo_test`,
    isEcho: true,
    baseEffectValue,
    originalBaseEffectValue: baseEffectValue,
    ...relicOverrides,
  });
}

function makePlayerState(): PlayerCombatState {
  return {
    hp: 60,
    maxHP: 60,
    shield: 0,
    statusEffects: [],
    comboCount: 0,
    hintsRemaining: 3,
    cardsPlayedThisTurn: 0,
  };
}

const ENEMY_TEMPLATE: EnemyTemplate = {
  id: 'test-enemy',
  name: 'Test Enemy',
  category: 'common',
  baseHP: 50,
  baseAttack: 5,
  intents: [{ type: 'attack', value: 5, weight: 1 }],
  spriteKey: 'creature_test',
  description: '',
  flavorText: '',
  immuneDomain: undefined,
  statusEffectPatterns: [],
  rarity: 'common',
} as unknown as EnemyTemplate;

function makeEnemy(): EnemyInstance {
  return {
    template: ENEMY_TEMPLATE,
    currentHP: 50,
    maxHP: 50,
    block: 0,
    nextIntent: { type: 'attack', value: 5 },
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1.0,
    enrageBonusDamage: 0,
    chargePlayMadeThisTurn: false,
  } as unknown as EnemyInstance;
}

// ─── ECHO constant tests ──────────────────────────────────────────────────────

describe('ECHO balance constants (V2)', () => {
  it('POWER_MULTIPLIER is 1.0 (full power at spawn)', () => {
    expect(ECHO.POWER_MULTIPLIER).toBe(1.0);
  });

  it('POWER_MULTIPLIER_WRONG is 0.5 (wrong Charge penalty)', () => {
    expect(ECHO.POWER_MULTIPLIER_WRONG).toBe(0.5);
  });

  it('FSRS_STABILITY_BONUS_CORRECT_V2 is 6.0 (double credit on correct Echo)', () => {
    expect(ECHO.FSRS_STABILITY_BONUS_CORRECT_V2).toBe(6.0);
  });

  it('FSRS_STABILITY_BONUS is 3.0 (kept for wrong-echo path)', () => {
    expect(ECHO.FSRS_STABILITY_BONUS).toBe(3.0);
  });
});

// ─── resolveEchoBase via resolveCardEffect ────────────────────────────────────

describe('resolveCardEffect — Echo V2 power resolution', () => {
  const player = makePlayerState();
  const enemy = makeEnemy();

  it('non-Echo card: resolves at per-mechanic chargeCorrectValue regardless of correct flag', () => {
    // Non-Echo cards use per-mechanic values; the `correct` flag does not affect them
    // (wrong answers for non-echo are handled in turnManager before resolveCardEffect is called).
    // strike.chargeCorrectValue = 24, effectMultiplier = 1.0 → rawValue = 24
    const card = makeCard({ baseEffectValue: 8, mechanicId: 'strike' });
    const resultCorrect = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: true,
      playMode: 'charge',
    });
    const resultWrong = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: false,
      playMode: 'charge',
    });
    // Both use chargeCorrectValue since non-echo ignores the `correct` parameter
    expect(resultCorrect.rawValue).toBe(24);
    expect(resultWrong.rawValue).toBe(24);
  });

  it('Echo + correct Charge: resolves at full base power (1.0×)', () => {
    const card = makeEchoCard(10);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: true,
      playMode: 'charge',
    });
    // rawValue = 10 × 1.0 tier × 1.0 combo = 10
    expect(result.rawValue).toBe(10);
  });

  it('Echo + wrong Charge: resolves at 0.5× base power', () => {
    const card = makeEchoCard(10);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: false,
      playMode: 'charge',
    });
    // baseEffectValue after penalty = Math.max(1, Math.round(10 * 0.5)) = 5
    // rawValue = 5 × 1.0 tier × 1.0 combo = 5
    expect(result.rawValue).toBe(5);
  });

  it('Echo + wrong Charge + echo_lens: resolves at full base power (relic override)', () => {
    const card = makeEchoCard(10);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: false,
      playMode: 'charge',
      activeRelicIds: new Set(['echo_lens']),
    });
    // echo_lens overrides penalty: full 10 base value
    expect(result.rawValue).toBe(10);
  });

  it('Echo + correct Charge + echo_lens: still resolves at full base power', () => {
    const card = makeEchoCard(10);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: true,
      playMode: 'charge',
      activeRelicIds: new Set(['echo_lens']),
    });
    expect(result.rawValue).toBe(10);
  });

  it('Echo + wrong Quick Play fallback: no penalty (Quick Play is blocked upstream)', () => {
    const card = makeEchoCard(10);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: false,
      playMode: 'quick',
    });
    // playMode 'quick' on echo: no penalty applied — returns full value as safe fallback
    expect(result.rawValue).toBe(10);
  });

  it('Echo baseEffectValue 1 (min): wrong Charge returns 1 (not 0)', () => {
    const card = makeEchoCard(1);
    const result = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: false,
      playMode: 'charge',
    });
    // Math.max(1, Math.round(1 * 0.5)) = Math.max(1, 1) = 1
    expect(result.rawValue).toBe(1);
  });

  it('defaults playMode to charge when not provided', () => {
    // When advanced.playMode is omitted, defaults to 'charge' — correct=true means full power
    const card = makeEchoCard(10);
    const resultDefault = resolveCardEffect(card, player, enemy, 0, 1.0, 0, undefined, undefined, {
      correct: true,
      // playMode omitted
    });
    expect(resultDefault.rawValue).toBe(10);
  });
});
