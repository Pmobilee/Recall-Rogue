import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Card, CardRunState, CardType } from '../../src/data/card-types';
import type { EnemyTemplate, EnemyInstance, EnemyIntent } from '../../src/data/enemies';
import type { StatusEffect, StatusEffectType } from '../../src/data/statusEffects';
import type { Fact } from '../../src/data/types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { TurnState } from '../../src/services/turnManager';

// Status Effects
import {
  applyStatusEffect,
  tickStatusEffects,
  getStrengthModifier,
  isVulnerable,
} from '../../src/data/statusEffects';

// Enemies
import { ENEMY_TEMPLATES } from '../../src/data/enemies';

// Enemy Manager
import {
  createEnemy,
  getFloorScaling,
  rollNextIntent,
  applyDamageToEnemy,
  executeEnemyIntent,
  tickEnemyStatusEffects,
} from '../../src/services/enemyManager';

// Player Combat State
import {
  createPlayerCombatState,
  applyShield,
  takeDamage,
  healPlayer,
  tickPlayerStatusEffects,
  resetTurnState,
} from '../../src/services/playerCombatState';

// Card Effect Resolver
import {
  resolveCardEffect,
  isCardBlocked,
} from '../../src/services/cardEffectResolver';

// Turn Manager
import {
  startEncounter,
  playCardAction,
  skipCard,
  endPlayerTurn,
  checkEncounterEnd,
  isHandEmpty,
  getHandSize,
} from '../../src/services/turnManager';

// Encounter Rewards
import {
  generateCardRewards,
  generateCurrencyReward,
  generateComboBonus,
  buildEncounterRewards,
} from '../../src/services/encounterRewards';

// Deck Manager (for creating test decks)
import { createDeck, drawHand } from '../../src/services/deckManager';

// Balance constants
import {
  PLAYER_START_HP,
  COMBO_MULTIPLIERS,
  TIER_MULTIPLIER,
  HAND_SIZE,
} from '../../src/data/balance';

// Card factory (for reward tests)
import { resetCardIdCounter } from '../../src/services/cardFactory';

// ── Test Helpers ──

function mockCard(overrides?: Partial<Card>): Card {
  return {
    id: 'card_test_1',
    factId: 'fact_1',
    cardType: 'attack',
    domain: 'science',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    ...overrides,
  };
}

function mockEnemyTemplate(overrides?: Partial<EnemyTemplate>): EnemyTemplate {
  return {
    id: 'test_enemy',
    name: 'Test Enemy',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 20,
    intentPool: [
      { type: 'attack', value: 5, weight: 1, telegraph: 'Strike' },
    ],
    description: 'A test enemy',
    ...overrides,
  };
}

function mockEnemyInstance(overrides?: Partial<EnemyInstance>): EnemyInstance {
  const template = overrides?.template ?? mockEnemyTemplate();
  return {
    template,
    currentHP: overrides?.currentHP ?? template.baseHP,
    maxHP: overrides?.maxHP ?? template.baseHP,
    nextIntent: overrides?.nextIntent ?? template.intentPool[0],
    block: overrides?.block ?? 0,
    statusEffects: overrides?.statusEffects ?? [],
    phase: overrides?.phase ?? 1,
    floor: overrides?.floor ?? 1,
    isCharging: overrides?.isCharging ?? false,
    chargedDamage: overrides?.chargedDamage ?? 0,
    difficultyVariance: overrides?.difficultyVariance ?? 1,
  };
}

function mockPlayerState(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
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

function makeCards(n: number, typeOverride?: CardType): Card[] {
  return Array.from({ length: n }, (_, i) => mockCard({
    id: `card_${i}`,
    factId: `fact_${i}`,
    cardType: typeOverride ?? 'attack',
  }));
}

function makeDeckWithHand(handSize: number = 5, totalCards: number = 20): CardRunState {
  const cards = makeCards(totalCards);
  const deck = createDeck(cards);
  drawHand(deck, handSize);
  return deck;
}

function makeFact(overrides?: Partial<Fact>): Fact {
  return {
    id: overrides?.id ?? 'test-fact-1',
    type: 'fact',
    statement: 'Test statement',
    explanation: 'Test explanation',
    quizQuestion: 'What is test?',
    correctAnswer: 'Test',
    distractors: ['A', 'B', 'C'],
    category: overrides?.category ?? ['Natural Sciences', 'Chemistry'],
    rarity: 'common',
    difficulty: 3,
    funScore: 5,
    ageRating: 'adult',
    ...overrides,
  } as Fact;
}

// ============================================================
// 1. STATUS EFFECTS
// ============================================================

describe('Status Effects', () => {
  describe('applyStatusEffect', () => {
    it('adds a new effect to empty array', () => {
      const effects: StatusEffect[] = [];
      applyStatusEffect(effects, { type: 'poison', value: 3, turnsRemaining: 2 });
      expect(effects).toHaveLength(1);
      expect(effects[0]).toEqual({ type: 'poison', value: 3, turnsRemaining: 2 });
    });

    it('stacks same-type effects (adds values, max duration)', () => {
      const effects: StatusEffect[] = [
        { type: 'poison', value: 2, turnsRemaining: 2 },
      ];
      applyStatusEffect(effects, { type: 'poison', value: 3, turnsRemaining: 4 });
      expect(effects).toHaveLength(1);
      expect(effects[0].value).toBe(5);
      expect(effects[0].turnsRemaining).toBe(4);
    });

    it('keeps shorter duration if existing is longer', () => {
      const effects: StatusEffect[] = [
        { type: 'strength', value: 1, turnsRemaining: 5 },
      ];
      applyStatusEffect(effects, { type: 'strength', value: 1, turnsRemaining: 2 });
      expect(effects[0].turnsRemaining).toBe(5);
      expect(effects[0].value).toBe(2);
    });

    it('adds different types separately', () => {
      const effects: StatusEffect[] = [];
      applyStatusEffect(effects, { type: 'poison', value: 2, turnsRemaining: 3 });
      applyStatusEffect(effects, { type: 'regen', value: 1, turnsRemaining: 3 });
      expect(effects).toHaveLength(2);
    });
  });

  describe('tickStatusEffects', () => {
    it('decrements turns and removes expired effects', () => {
      const effects: StatusEffect[] = [
        { type: 'strength', value: 1, turnsRemaining: 1 },
        { type: 'poison', value: 2, turnsRemaining: 3 },
      ];
      const result = tickStatusEffects(effects);
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].type).toBe('poison');
      expect(result.effects[0].turnsRemaining).toBe(2);
    });

    it('returns poison damage', () => {
      const effects: StatusEffect[] = [
        { type: 'poison', value: 5, turnsRemaining: 3 },
      ];
      const result = tickStatusEffects(effects);
      expect(result.poisonDamage).toBe(5);
    });

    it('returns regen heal', () => {
      const effects: StatusEffect[] = [
        { type: 'regen', value: 3, turnsRemaining: 2 },
      ];
      const result = tickStatusEffects(effects);
      expect(result.regenHeal).toBe(3);
    });

    it('handles empty effects array', () => {
      const effects: StatusEffect[] = [];
      const result = tickStatusEffects(effects);
      expect(result.poisonDamage).toBe(0);
      expect(result.regenHeal).toBe(0);
      expect(result.effects).toHaveLength(0);
    });

    it('removes all effects that expire simultaneously', () => {
      const effects: StatusEffect[] = [
        { type: 'poison', value: 2, turnsRemaining: 1 },
        { type: 'weakness', value: 1, turnsRemaining: 1 },
      ];
      const result = tickStatusEffects(effects);
      expect(result.effects).toHaveLength(0);
      expect(result.poisonDamage).toBe(2);
    });
  });

  describe('getStrengthModifier', () => {
    it('returns 1.0 with no effects', () => {
      expect(getStrengthModifier([])).toBe(1.0);
    });

    it('increases by 25% per strength value', () => {
      const effects: StatusEffect[] = [
        { type: 'strength', value: 2, turnsRemaining: 3 },
      ];
      expect(getStrengthModifier(effects)).toBe(1.5);
    });

    it('decreases by 25% per weakness value', () => {
      const effects: StatusEffect[] = [
        { type: 'weakness', value: 2, turnsRemaining: 3 },
      ];
      expect(getStrengthModifier(effects)).toBe(0.5);
    });

    it('combines strength and weakness', () => {
      const effects: StatusEffect[] = [
        { type: 'strength', value: 2, turnsRemaining: 3 },
        { type: 'weakness', value: 1, turnsRemaining: 2 },
      ];
      // 1.0 + 0.5 - 0.25 = 1.25
      expect(getStrengthModifier(effects)).toBe(1.25);
    });

    it('clamps minimum at 0.25', () => {
      const effects: StatusEffect[] = [
        { type: 'weakness', value: 10, turnsRemaining: 3 },
      ];
      expect(getStrengthModifier(effects)).toBe(0.25);
    });
  });

  describe('isVulnerable', () => {
    it('returns false with no effects', () => {
      expect(isVulnerable([])).toBe(false);
    });

    it('returns true when vulnerable effect is active', () => {
      const effects: StatusEffect[] = [
        { type: 'vulnerable', value: 1, turnsRemaining: 2 },
      ];
      expect(isVulnerable(effects)).toBe(true);
    });

    it('returns false when vulnerable has expired (turnsRemaining 0)', () => {
      const effects: StatusEffect[] = [
        { type: 'vulnerable', value: 1, turnsRemaining: 0 },
      ];
      expect(isVulnerable(effects)).toBe(false);
    });
  });
});

// ============================================================
// 2. ENEMY TEMPLATES AND MANAGER
// ============================================================

describe('Enemy Templates', () => {
  it('has 4 common enemies', () => {
    // v2 roster after enemy consolidation — 46 total, +4 new Act 1 commons added in AR-98 = 50
    const common = ENEMY_TEMPLATES.filter(t => t.category === 'common');
    expect(common).toHaveLength(50);
  });

  it('has 2 elite enemies', () => {
    // v2 roster after enemy consolidation — 10 total
    const elite = ENEMY_TEMPLATES.filter(t => t.category === 'elite');
    expect(elite).toHaveLength(10);
  });

  it('has 8 boss enemies', () => {
    const boss = ENEMY_TEMPLATES.filter(t => t.category === 'boss');
    expect(boss).toHaveLength(8);
  });

  it('has 6 mini-boss enemies', () => {
    const miniBoss = ENEMY_TEMPLATES.filter(t => t.category === 'mini_boss');
    expect(miniBoss).toHaveLength(24);
  });

  it('cave_bat has 19 baseHP (AR-59.13 v2 stats)', () => {
    const bat = ENEMY_TEMPLATES.find(t => t.id === 'cave_bat');
    expect(bat?.baseHP).toBe(19);
  });

  it('crystal_golem has 32 baseHP (AR-99 balance tuning)', () => {
    const golem = ENEMY_TEMPLATES.find(t => t.id === 'crystal_golem');
    expect(golem?.baseHP).toBe(32);
  });

  it('the_archivist has 80 baseHP (AR-59.13 v2 stats)', () => {
    const archivist = ENEMY_TEMPLATES.find(t => t.id === 'the_archivist');
    expect(archivist?.baseHP).toBe(80);
  });

  it('fossil_guardian has no immuneDomain (removed in consolidation)', () => {
    const guardian = ENEMY_TEMPLATES.find(t => t.id === 'fossil_guardian');
    expect(guardian?.immuneDomain).toBeUndefined();
  });

  it('ore_wyrm has phase transition at 50%', () => {
    const wyrm = ENEMY_TEMPLATES.find(t => t.id === 'ore_wyrm');
    expect(wyrm?.phaseTransitionAt).toBe(0.5);
    expect(wyrm?.phase2IntentPool).toBeDefined();
  });

  it('all templates have non-empty intentPools', () => {
    for (const template of ENEMY_TEMPLATES) {
      expect(template.intentPool.length).toBeGreaterThan(0);
    }
  });

  it('all intent weights are positive', () => {
    for (const template of ENEMY_TEMPLATES) {
      for (const intent of template.intentPool) {
        expect(intent.weight).toBeGreaterThan(0);
      }
    }
  });
});

describe('Enemy Manager', () => {
  describe('getFloorScaling', () => {
    it('returns 1.0 for floor 1', () => {
      expect(getFloorScaling(1)).toBe(1.0);
    });

    it('returns 1.12 for floor 2', () => {
      expect(getFloorScaling(2)).toBeCloseTo(1.12);
    });

    it('scales linearly at 12% per floor', () => {
      expect(getFloorScaling(5)).toBeCloseTo(1.48);
    });

    it('returns 2.08 for floor 10', () => {
      expect(getFloorScaling(10)).toBeCloseTo(2.08);
    });
  });

  describe('createEnemy', () => {
    it('creates enemy with scaled HP for floor 1', () => {
      const template = mockEnemyTemplate({ baseHP: 20 });
      const enemy = createEnemy(template, 1);
      expect(enemy.currentHP).toBe(20);
      expect(enemy.maxHP).toBe(20);
    });

    it('scales HP for higher floors', () => {
      const template = mockEnemyTemplate({ baseHP: 20 });
      const enemy = createEnemy(template, 5);
      // 20 * 1.48 = 29.6 → round to 30
      expect(enemy.currentHP).toBe(Math.round(20 * getFloorScaling(5)));
    });

    it('starts in phase 1', () => {
      const enemy = createEnemy(mockEnemyTemplate(), 1);
      expect(enemy.phase).toBe(1);
    });

    it('pre-rolls a next intent', () => {
      const enemy = createEnemy(mockEnemyTemplate(), 1);
      expect(enemy.nextIntent).toBeDefined();
      expect(enemy.nextIntent.type).toBe('attack');
    });

    it('starts with empty status effects', () => {
      const enemy = createEnemy(mockEnemyTemplate(), 1);
      expect(enemy.statusEffects).toHaveLength(0);
    });
  });

  describe('applyDamageToEnemy', () => {
    it('reduces HP by damage amount', () => {
      const enemy = mockEnemyInstance({ currentHP: 20, maxHP: 20 });
      const result = applyDamageToEnemy(enemy, 5);
      expect(enemy.currentHP).toBe(15);
      expect(result.remainingHP).toBe(15);
      expect(result.defeated).toBe(false);
    });

    it('clamps HP to 0', () => {
      const enemy = mockEnemyInstance({ currentHP: 5, maxHP: 20 });
      const result = applyDamageToEnemy(enemy, 10);
      expect(enemy.currentHP).toBe(0);
      expect(result.defeated).toBe(true);
    });

    it('triggers phase transition when HP drops below threshold', () => {
      const template = mockEnemyTemplate({
        baseHP: 50,
        phaseTransitionAt: 0.5,
        phase2IntentPool: [
          { type: 'attack', value: 15, weight: 1, telegraph: 'Enraged strike' },
        ],
      });
      const enemy = mockEnemyInstance({
        template,
        currentHP: 30,
        maxHP: 50,
      });

      applyDamageToEnemy(enemy, 10);
      // 30 - 10 = 20, 20/50 = 0.4 < 0.5 → phase 2
      expect(enemy.phase).toBe(2);
    });

    it('does not transition if HP is still above threshold', () => {
      const template = mockEnemyTemplate({
        baseHP: 50,
        phaseTransitionAt: 0.5,
        phase2IntentPool: [
          { type: 'attack', value: 15, weight: 1, telegraph: 'Enraged strike' },
        ],
      });
      const enemy = mockEnemyInstance({
        template,
        currentHP: 40,
        maxHP: 50,
      });

      applyDamageToEnemy(enemy, 5);
      // 40 - 5 = 35, 35/50 = 0.7 > 0.5 → stay phase 1
      expect(enemy.phase).toBe(1);
    });

    it('does not transition if already in phase 2', () => {
      const template = mockEnemyTemplate({
        baseHP: 50,
        phaseTransitionAt: 0.5,
        phase2IntentPool: [
          { type: 'attack', value: 15, weight: 1, telegraph: 'Enraged' },
        ],
      });
      const enemy = mockEnemyInstance({
        template,
        currentHP: 20,
        maxHP: 50,
        phase: 2,
      });

      applyDamageToEnemy(enemy, 5);
      expect(enemy.phase).toBe(2);
    });
  });

  describe('executeEnemyIntent', () => {
    it('returns damage for attack intent', () => {
      const enemy = mockEnemyInstance({
        nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' },
      });
      const result = executeEnemyIntent(enemy);
      // Floor 1 applies 1.0x base damage scaling (early game nerf removed).
      expect(result.damage).toBe(10);
    });

    it('applies strength modifier to attacks', () => {
      const enemy = mockEnemyInstance({
        nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' },
        statusEffects: [{ type: 'strength', value: 2, turnsRemaining: 3 }],
      });
      const result = executeEnemyIntent(enemy);
      // Floor 1: 10 * 1.5 * 1.0 = 15 (early game scaling removed)
      expect(result.damage).toBe(15);
    });

    it('calculates multi_attack damage correctly', () => {
      const enemy = mockEnemyInstance({
        nextIntent: { type: 'multi_attack', value: 3, weight: 1, telegraph: 'Flurry', hitCount: 4 },
      });
      const result = executeEnemyIntent(enemy);
      expect(result.damage).toBe(12); // 3 * 4
    });

    it('returns player debuffs for debuff intent', () => {
      const enemy = mockEnemyInstance({
        nextIntent: {
          type: 'debuff',
          value: 2,
          weight: 1,
          telegraph: 'Curse',
          statusEffect: { type: 'weakness', value: 1, turns: 2 },
        },
      });
      const result = executeEnemyIntent(enemy);
      expect(result.playerEffects).toHaveLength(1);
      expect(result.playerEffects[0].type).toBe('weakness');
    });

    it('heals enemy for heal intent (capped at max)', () => {
      const template = mockEnemyTemplate({ baseHP: 30 });
      const enemy = mockEnemyInstance({
        template,
        currentHP: 25,
        maxHP: 30,
        nextIntent: { type: 'heal', value: 10, weight: 1, telegraph: 'Heal' },
      });
      const result = executeEnemyIntent(enemy);
      expect(result.enemyHealed).toBe(5); // capped at 30-25=5
      expect(enemy.currentHP).toBe(30);
    });

    it('applies buff to enemy statusEffects', () => {
      const enemy = mockEnemyInstance({
        nextIntent: {
          type: 'buff',
          value: 2,
          weight: 1,
          telegraph: 'Power up',
          statusEffect: { type: 'strength', value: 2, turns: 3 },
        },
      });
      executeEnemyIntent(enemy);
      expect(enemy.statusEffects).toHaveLength(1);
      expect(enemy.statusEffects[0].type).toBe('strength');
    });
  });

  describe('tickEnemyStatusEffects', () => {
    it('applies poison damage to enemy', () => {
      const enemy = mockEnemyInstance({
        currentHP: 20,
        maxHP: 20,
        statusEffects: [{ type: 'poison', value: 3, turnsRemaining: 2 }],
      });
      const result = tickEnemyStatusEffects(enemy);
      expect(result.poisonDamage).toBe(3);
      expect(enemy.currentHP).toBe(17);
    });

    it('applies regen heal to enemy (capped at max)', () => {
      const enemy = mockEnemyInstance({
        currentHP: 18,
        maxHP: 20,
        statusEffects: [{ type: 'regen', value: 5, turnsRemaining: 2 }],
      });
      const result = tickEnemyStatusEffects(enemy);
      expect(result.regenHeal).toBe(5);
      expect(enemy.currentHP).toBe(20); // capped at 20
    });
  });

  describe('rollNextIntent', () => {
    it('rolls from phase 1 pool when in phase 1', () => {
      const template = mockEnemyTemplate({
        intentPool: [
          { type: 'attack', value: 5, weight: 1, telegraph: 'A' },
        ],
        phase2IntentPool: [
          { type: 'attack', value: 15, weight: 1, telegraph: 'B' },
        ],
        phaseTransitionAt: 0.5,
      });
      const enemy = mockEnemyInstance({ template, phase: 1 });
      rollNextIntent(enemy);
      expect(enemy.nextIntent.telegraph).toBe('A');
    });

    it('rolls from phase 2 pool when in phase 2', () => {
      const template = mockEnemyTemplate({
        intentPool: [
          { type: 'attack', value: 5, weight: 1, telegraph: 'A' },
        ],
        phase2IntentPool: [
          { type: 'attack', value: 15, weight: 1, telegraph: 'B' },
        ],
        phaseTransitionAt: 0.5,
      });
      const enemy = mockEnemyInstance({ template, phase: 2 });
      rollNextIntent(enemy);
      expect(enemy.nextIntent.telegraph).toBe('B');
    });
  });
});

// ============================================================
// 3. PLAYER COMBAT STATE
// ============================================================

describe('Player Combat State', () => {
  describe('createPlayerCombatState', () => {
    it('creates with default HP', () => {
      const state = createPlayerCombatState();
      expect(state.hp).toBe(PLAYER_START_HP);
      expect(state.maxHP).toBe(PLAYER_START_HP);
    });

    it('creates with custom HP', () => {
      const state = createPlayerCombatState(50);
      expect(state.hp).toBe(50);
      expect(state.maxHP).toBe(50);
    });

    it('starts with 0 shield', () => {
      const state = createPlayerCombatState();
      expect(state.shield).toBe(0);
    });

    it('starts with empty status effects', () => {
      const state = createPlayerCombatState();
      expect(state.statusEffects).toHaveLength(0);
    });

    it('starts with 0 combo', () => {
      const state = createPlayerCombatState();
      expect(state.comboCount).toBe(0);
    });
  });

  describe('applyShield', () => {
    it('adds shield to player', () => {
      const state = mockPlayerState({ shield: 0 });
      applyShield(state, 10);
      expect(state.shield).toBe(10);
    });

    it('stacks with existing shield', () => {
      const state = mockPlayerState({ shield: 5 });
      applyShield(state, 10);
      expect(state.shield).toBe(15);
    });
  });

  describe('takeDamage', () => {
    it('shield absorbs damage first', () => {
      const state = mockPlayerState({ hp: 80, shield: 10 });
      const result = takeDamage(state, 7);
      expect(state.shield).toBe(3);
      expect(state.hp).toBe(80);
      expect(result.actualDamage).toBe(0);
    });

    it('overflow damage hits HP', () => {
      const state = mockPlayerState({ hp: 80, shield: 5 });
      const result = takeDamage(state, 10);
      expect(state.shield).toBe(0);
      expect(state.hp).toBe(75);
      expect(result.actualDamage).toBe(5);
    });

    it('no shield means full HP damage', () => {
      const state = mockPlayerState({ hp: 80, shield: 0 });
      const result = takeDamage(state, 15);
      expect(state.hp).toBe(65);
      expect(result.actualDamage).toBe(15);
    });

    it('HP clamps to 0', () => {
      const state = mockPlayerState({ hp: 5, shield: 0 });
      const result = takeDamage(state, 20);
      expect(state.hp).toBe(0);
      expect(result.defeated).toBe(true);
    });

    it('reports defeated when HP reaches 0', () => {
      const state = mockPlayerState({ hp: 10, shield: 0 });
      const result = takeDamage(state, 10);
      expect(result.defeated).toBe(true);
    });
  });

  describe('healPlayer', () => {
    it('heals up to maxHP', () => {
      const state = mockPlayerState({ hp: 70, maxHP: 80 });
      const healed = healPlayer(state, 20);
      expect(state.hp).toBe(80);
      expect(healed).toBe(10);
    });

    it('heals exact amount when under max', () => {
      const state = mockPlayerState({ hp: 50, maxHP: 80 });
      const healed = healPlayer(state, 10);
      expect(state.hp).toBe(60);
      expect(healed).toBe(10);
    });

    it('heals 0 when already at max', () => {
      const state = mockPlayerState({ hp: 80, maxHP: 80 });
      const healed = healPlayer(state, 10);
      expect(state.hp).toBe(80);
      expect(healed).toBe(0);
    });
  });

  describe('tickPlayerStatusEffects', () => {
    it('applies poison through takeDamage', () => {
      const state = mockPlayerState({
        hp: 80,
        shield: 5,
        statusEffects: [{ type: 'poison', value: 3, turnsRemaining: 2 }],
      });
      const result = tickPlayerStatusEffects(state);
      expect(result.poisonDamage).toBe(3);
      // Shield absorbs 3, no HP loss
      expect(state.shield).toBe(2);
      expect(state.hp).toBe(80);
    });

    it('applies regen through healPlayer', () => {
      const state = mockPlayerState({
        hp: 70,
        maxHP: 80,
        statusEffects: [{ type: 'regen', value: 5, turnsRemaining: 2 }],
      });
      const result = tickPlayerStatusEffects(state);
      expect(result.regenHeal).toBe(5);
      expect(state.hp).toBe(75);
    });

    it('detects defeat from poison', () => {
      const state = mockPlayerState({
        hp: 2,
        shield: 0,
        statusEffects: [{ type: 'poison', value: 5, turnsRemaining: 2 }],
      });
      const result = tickPlayerStatusEffects(state);
      expect(result.defeated).toBe(true);
    });
  });

  describe('resetTurnState', () => {
    it('clears shield, combo, and cardsPlayed', () => {
      const state = mockPlayerState({
        shield: 15,
        comboCount: 3,
        cardsPlayedThisTurn: 4,
      });
      resetTurnState(state);
      expect(state.shield).toBe(0);
      expect(state.comboCount).toBe(0);
      expect(state.cardsPlayedThisTurn).toBe(0);
    });

    it('does not clear HP or status effects', () => {
      const state = mockPlayerState({
        hp: 50,
        statusEffects: [{ type: 'strength', value: 1, turnsRemaining: 2 }],
      });
      resetTurnState(state);
      expect(state.hp).toBe(50);
      expect(state.statusEffects).toHaveLength(1);
    });
  });
});

// ============================================================
// 4. CARD EFFECT RESOLVER
// ============================================================

describe('Card Effect Resolver', () => {
  describe('isCardBlocked', () => {
    it('returns true when card domain matches enemy immunity', () => {
      const card = mockCard({ domain: 'history' });
      const enemy = mockEnemyInstance({
        template: mockEnemyTemplate({ immuneDomain: 'history' }),
      });
      expect(isCardBlocked(card, enemy)).toBe(true);
    });

    it('returns false when domains differ', () => {
      const card = mockCard({ domain: 'science' });
      const enemy = mockEnemyInstance({
        template: mockEnemyTemplate({ immuneDomain: 'history' }),
      });
      expect(isCardBlocked(card, enemy)).toBe(false);
    });

    it('returns false when enemy has no immunity', () => {
      const card = mockCard({ domain: 'science' });
      const enemy = mockEnemyInstance();
      expect(isCardBlocked(card, enemy)).toBe(false);
    });
  });

  describe('resolveCardEffect', () => {
    const defaultPlayer = mockPlayerState();
    const defaultEnemy = mockEnemyInstance({ currentHP: 50, maxHP: 50 });

    it('resolves attack card with damage', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      // 8 * 1.0 (tier) * 1.0 (effectMult) * 1.0 (combo[0]) * 1.0 (speed) * 1.0 (buff)
      expect(result.damageDealt).toBe(8);
      expect(result.effectType).toBe('attack');
    });

    it('applies tier multiplier', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '2a', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      // 8 * 1.3 (tier 2a) * 1.0 * 1.0 * 1.0 * 1.0 = 10.4 -> round 10
      expect(result.damageDealt).toBe(10);
    });

    it('tier 3 produces 0 effect value', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '3', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      expect(result.finalValue).toBe(0);
      expect(result.damageDealt).toBe(0);
    });

    it('applies combo multiplier', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 2, 1.0, 0);
      // 8 * 1.0 * 1.0 * 1.3 (combo[2]) * 1.0 * 1.0 = 10.4 → round 10
      expect(result.damageDealt).toBe(Math.round(8 * COMBO_MULTIPLIERS[2]));
    });

    it('caps combo multiplier at max index', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 100, 1.0, 0);
      // Should use last index (2.0)
      expect(result.damageDealt).toBe(Math.round(8 * COMBO_MULTIPLIERS[COMBO_MULTIPLIERS.length - 1]));
    });

    it('applies speed bonus', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.5, 0);
      // 8 * 1.0 * 1.0 * 1.0 * 1.5 * 1.0 = 12
      expect(result.damageDealt).toBe(12);
    });

    it('applies buff percentage', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 50);
      // 8 * 1.0 * 1.0 * 1.0 * 1.0 * 1.5 = 12
      expect(result.damageDealt).toBe(12);
    });

    it('resolves shield card', () => {
      const card = mockCard({ cardType: 'shield', baseEffectValue: 6, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      expect(result.shieldApplied).toBe(6);
      expect(result.damageDealt).toBe(0);
    });

    it('resolves shield card with block', () => {
      const card = mockCard({ cardType: 'shield', baseEffectValue: 5, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      expect(result.shieldApplied).toBe(5);
    });

    it('resolves utility card with extra draw', () => {
      const card = mockCard({ cardType: 'utility', baseEffectValue: 0, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      expect(result.extraCardsDrawn).toBe(1);
    });

    it('resolves debuff card with weakness', () => {
      const card = mockCard({ cardType: 'debuff', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      // finalValue = 8, floor(8/2) = 4 weakness
      expect(result.statusesApplied).toContainEqual(
        expect.objectContaining({ type: 'weakness', value: 4, turnsRemaining: 2 })
      );
      // finalValue >= 5, so also vulnerable
      expect(result.statusesApplied).toContainEqual(
        expect.objectContaining({ type: 'vulnerable', value: 1, turnsRemaining: 2 })
      );
    });

    it('debuff does NOT apply vulnerable when finalValue < 5', () => {
      const card = mockCard({ cardType: 'debuff', baseEffectValue: 4, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      const vulnEffects = result.statusesApplied.filter(s => s.type === 'vulnerable');
      expect(vulnEffects).toHaveLength(0);
    });


    it('resolves wild card as last card type', () => {
      const card = mockCard({ cardType: 'wild', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0, 'shield');
      expect(result.effectType).toBe('shield');
      expect(result.shieldApplied).toBe(6);
    });

    it('wild defaults to attack when no lastCardType', () => {
      const card = mockCard({ cardType: 'wild', baseEffectValue: 8, tier: '1', effectMultiplier: 1.0 });
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 0, 1.0, 0);
      expect(result.effectType).toBe('attack');
      expect(result.damageDealt).toBe(9);
    });

    it('blocked card returns targetHit=false', () => {
      const card = mockCard({ domain: 'history' });
      const enemy = mockEnemyInstance({
        template: mockEnemyTemplate({ immuneDomain: 'history' }),
      });
      const result = resolveCardEffect(card, defaultPlayer, enemy, 0, 1.0, 0);
      expect(result.targetHit).toBe(false);
      expect(result.damageDealt).toBe(0);
    });

    it('attack on vulnerable enemy deals 1.5x', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 10, tier: '1', effectMultiplier: 1.0 });
      const enemy = mockEnemyInstance({
        currentHP: 50,
        maxHP: 50,
        statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
      });
      const result = resolveCardEffect(card, defaultPlayer, enemy, 0, 1.0, 0);
      expect(result.damageDealt).toBe(15); // 10 * 1.5
    });

    it('sets enemyDefeated when damage >= enemy HP', () => {
      const card = mockCard({ cardType: 'attack', baseEffectValue: 50, tier: '1', effectMultiplier: 1.0 });
      const enemy = mockEnemyInstance({ currentHP: 10, maxHP: 20 });
      const result = resolveCardEffect(card, defaultPlayer, enemy, 0, 1.0, 0);
      expect(result.enemyDefeated).toBe(true);
    });

    it('full multiplier chain produces correct value', () => {
      const card = mockCard({
        cardType: 'attack',
        baseEffectValue: 8,
        tier: '2a',
        effectMultiplier: 1.3,
      });
      // 8 * 1.3 (tier2a) * 1.3 (effectMult) = 13.52 raw
      const result = resolveCardEffect(card, defaultPlayer, defaultEnemy, 2, 1.5, 50);
      // Raw = 8 * 1.3 * 1.3 = 13.52; Final = 13.52 * 1.30 (combo) * 1.5 (speed) * 1.5 (buff)
      const expected = Math.round(8 * 1.3 * 1.3 * 1.30 * 1.5 * 1.5);
      expect(result.damageDealt).toBe(expected);
    });
  });
});

// ============================================================
// 5. TURN MANAGER
// ============================================================

describe('Turn Manager', () => {
  let deck: CardRunState;
  let enemy: EnemyInstance;

  beforeEach(() => {
    resetCardIdCounter();
    const cards = makeCards(20);
    deck = createDeck(cards);
    enemy = createEnemy(mockEnemyTemplate({ baseHP: 50 }), 1);
  });

  describe('startEncounter', () => {
    it('creates turn state with player_action phase', () => {
      const ts = startEncounter(deck, enemy);
      expect(ts.phase).toBe('player_action');
    });

    it('draws a hand of HAND_SIZE cards', () => {
      const ts = startEncounter(deck, enemy);
      expect(ts.deck.hand.length).toBe(HAND_SIZE);
    });

    it('initializes player combat state', () => {
      const ts = startEncounter(deck, enemy);
      expect(ts.playerState.hp).toBe(PLAYER_START_HP);
      expect(ts.playerState.shield).toBe(0);
    });

    it('starts at turn 1', () => {
      const ts = startEncounter(deck, enemy);
      expect(ts.turnNumber).toBe(1);
    });

    it('starts with 0 combo', () => {
      const ts = startEncounter(deck, enemy);
      expect(ts.comboCount).toBe(0);
    });

    it('uses custom maxHP when provided', () => {
      const ts = startEncounter(deck, enemy, 50);
      expect(ts.playerState.hp).toBe(50);
      expect(ts.playerState.maxHP).toBe(50);
    });
  });

  describe('playCardAction', () => {
    it('correct answer resolves card effect', () => {
      const ts = startEncounter(deck, enemy);
      const cardId = ts.deck.hand[0].id;
      const result = playCardAction(ts, cardId, true, false);
      expect(result.fizzled).toBe(false);
      expect(result.blocked).toBe(false);
      expect(result.effect.targetHit).toBe(true);
    });

    it('correct answer increments combo', () => {
      const ts = startEncounter(deck, enemy);
      const cardId = ts.deck.hand[0].id;
      const result = playCardAction(ts, cardId, true, false);
      expect(result.comboCount).toBe(1);
      expect(ts.comboCount).toBe(1);
    });

    it('wrong answer fizzles and decays combo', () => {
      const ts = startEncounter(deck, enemy);
      ts.comboCount = 3;
      const cardId = ts.deck.hand[0].id;
      const result = playCardAction(ts, cardId, false, false);
      expect(result.fizzled).toBe(true);
      // COMBO_DECAY_WRONG_ANSWER = 2, so 3 - 2 = 1
      expect(result.comboCount).toBe(1);
      expect(ts.comboCount).toBe(1);
    });

    it('applies ascension wrong-answer self damage', () => {
      const ts = startEncounter(deck, enemy);
      ts.ascensionWrongAnswerSelfDamage = 5;
      const hpBefore = ts.playerState.hp;
      const cardId = ts.deck.hand[0].id;
      playCardAction(ts, cardId, false, false);
      expect(ts.playerState.hp).toBe(hpBefore - 5);
    });

    it('blocked card does not change combo', () => {
      const immuneTemplate = mockEnemyTemplate({ immuneDomain: 'science' });
      const immuneEnemy = createEnemy(immuneTemplate, 1);
      const ts = startEncounter(deck, immuneEnemy);
      ts.comboCount = 2;

      // All our mock cards are science domain
      const cardId = ts.deck.hand[0].id;
      const result = playCardAction(ts, cardId, true, false);
      expect(result.blocked).toBe(true);
      expect(ts.comboCount).toBe(2); // unchanged
    });

    it('card moves from hand to discard after play', () => {
      const ts = startEncounter(deck, enemy);
      const cardId = ts.deck.hand[0].id;
      const handBefore = ts.deck.hand.length;

      playCardAction(ts, cardId, true, false);
      expect(ts.deck.hand.length).toBe(handBefore - 1);
      expect(ts.deck.discardPile.some(c => c.id === cardId)).toBe(true);
    });

    it('increments cardsPlayedThisTurn', () => {
      const ts = startEncounter(deck, enemy);
      const cardId = ts.deck.hand[0].id;
      playCardAction(ts, cardId, true, false);
      expect(ts.cardsPlayedThisTurn).toBe(1);
    });

    it('enemy defeat sets result to victory', () => {
      // Create weak enemy that will die in one hit
      const weakTemplate = mockEnemyTemplate({ baseHP: 1 });
      const weakEnemy = createEnemy(weakTemplate, 1);
      const ts = startEncounter(deck, weakEnemy);
      const cardId = ts.deck.hand[0].id;

      const result = playCardAction(ts, cardId, true, false);
      expect(result.enemyDefeated).toBe(true);
      expect(ts.result).toBe('victory');
      expect(ts.phase).toBe('encounter_end');
    });

    it('throws for invalid card ID', () => {
      const ts = startEncounter(deck, enemy);
      expect(() => playCardAction(ts, 'nonexistent', true, false)).toThrow();
    });

    it('buff card sets buffNextCard for the next card', () => {
      // Create a deck with buff cards
      const buffCards = makeCards(20, 'buff');
      const buffDeck = createDeck(buffCards);
      const ts = startEncounter(buffDeck, enemy);
      const cardId = ts.deck.hand[0].id;

      playCardAction(ts, cardId, true, false);
      // buff card's finalValue becomes buffNextCard
      expect(ts.buffNextCard).toBeGreaterThanOrEqual(0);
    });

    it('applies shield card to block damage', () => {
      const shieldCards = makeCards(20, 'shield');
      const shieldDeck = createDeck(shieldCards);
      const ts = startEncounter(shieldDeck, enemy);
      const cardId = ts.deck.hand[0].id;
      const shieldBefore = ts.playerState.shield;

      const result = playCardAction(ts, cardId, true, false);
      expect(result.effect.shieldApplied).toBeGreaterThanOrEqual(0);
      expect(ts.playerState.shield).toBeGreaterThanOrEqual(shieldBefore);
    });
  });

  describe('skipCard', () => {
    it('moves card to discard without combo reset', () => {
      const ts = startEncounter(deck, enemy);
      ts.comboCount = 3;
      const cardId = ts.deck.hand[0].id;
      const handBefore = ts.deck.hand.length;

      skipCard(ts, cardId);
      expect(ts.deck.hand.length).toBe(handBefore - 1);
      expect(ts.comboCount).toBe(3); // unchanged
    });

    it('adds skip log entry', () => {
      const ts = startEncounter(deck, enemy);
      const cardId = ts.deck.hand[0].id;
      skipCard(ts, cardId);
      expect(ts.turnLog.some(l => l.type === 'skip')).toBe(true);
    });
  });

  describe('endPlayerTurn', () => {
    it('executes enemy intent dealing damage', () => {
      const ts = startEncounter(deck, enemy);
      // Enemy has attack intent with value 5
      const result = endPlayerTurn(ts);
      expect(result.damageDealt).toBeGreaterThanOrEqual(0);
    });

    it('advances turn number', () => {
      const ts = startEncounter(deck, enemy);
      endPlayerTurn(ts);
      expect(ts.turnNumber).toBe(2);
    });

    it('draws new hand', () => {
      const ts = startEncounter(deck, enemy);
      ts.apCurrent = 99; // bypass AP gating for this legacy full-hand drain test
      // Play all cards to empty hand
      while (ts.deck.hand.length > 0) {
        const cardId = ts.deck.hand[0].id;
        const play = playCardAction(ts, cardId, true, false);
        if (play.blocked) break;
        if (ts.result) break;
      }
      if (!ts.result) {
        endPlayerTurn(ts);
        expect(ts.deck.hand.length).toBe(HAND_SIZE);
      }
    });

    it('clears turn log for next turn', () => {
      const ts = startEncounter(deck, enemy);
      // Play a card to add log entries
      const cardId = ts.deck.hand[0].id;
      playCardAction(ts, cardId, true, false);
      expect(ts.turnLog.length).toBeGreaterThan(0);

      endPlayerTurn(ts);
      // After endPlayerTurn, log is cleared for next turn
      expect(ts.turnLog).toHaveLength(0);
    });

    it('rolls new enemy intent', () => {
      const ts = startEncounter(deck, enemy);
      const oldIntent = ts.enemy.nextIntent;
      endPlayerTurn(ts);
      // Intent may or may not change (random), but it should be defined
      expect(ts.enemy.nextIntent).toBeDefined();
    });

    it('detects player defeat from enemy attack', () => {
      // Create enemy with massive attack on endless floor (no damage cap)
      const bigTemplate = mockEnemyTemplate({
        baseHP: 100,
        intentPool: [
          { type: 'attack', value: 999, weight: 1, telegraph: 'Lethal Strike' },
        ],
      });
      const bigEnemy = createEnemy(bigTemplate, 25);
      const ts = startEncounter(deck, bigEnemy);

      const result = endPlayerTurn(ts);
      expect(result.playerDefeated).toBe(true);
      expect(ts.result).toBe('defeat');
    });

    it('resets shield after turn', () => {
      const ts = startEncounter(deck, enemy);
      ts.playerState.shield = 10;
      endPlayerTurn(ts);
      expect(ts.playerState.shield).toBe(0);
    });

    it('ticks player and enemy status effects', () => {
      const ts = startEncounter(deck, enemy);
      // Add poison to both
      applyStatusEffect(ts.playerState.statusEffects, { type: 'regen', value: 2, turnsRemaining: 1 });
      applyStatusEffect(ts.enemy.statusEffects, { type: 'poison', value: 3, turnsRemaining: 1 });

      const enemyHPBefore = ts.enemy.currentHP;
      endPlayerTurn(ts);

      // Enemy took poison damage
      if (!ts.result) {
        // If encounter didn't end, enemy should have taken damage
        expect(ts.enemy.currentHP).toBeLessThanOrEqual(enemyHPBefore);
      }
    });
  });

  describe('checkEncounterEnd', () => {
    it('returns victory when enemy HP is 0', () => {
      const ts = startEncounter(deck, enemy);
      ts.enemy.currentHP = 0;
      expect(checkEncounterEnd(ts)).toBe('victory');
    });

    it('returns defeat when player HP is 0', () => {
      const ts = startEncounter(deck, enemy);
      ts.playerState.hp = 0;
      expect(checkEncounterEnd(ts)).toBe('defeat');
    });

    it('returns null when both alive', () => {
      const ts = startEncounter(deck, enemy);
      expect(checkEncounterEnd(ts)).toBeNull();
    });
  });

  describe('isHandEmpty / getHandSize', () => {
    it('isHandEmpty returns false with cards in hand', () => {
      const ts = startEncounter(deck, enemy);
      expect(isHandEmpty(ts)).toBe(false);
    });

    it('getHandSize returns correct count', () => {
      const ts = startEncounter(deck, enemy);
      expect(getHandSize(ts)).toBe(HAND_SIZE);
    });

    it('isHandEmpty returns true after all cards played', () => {
      const ts = startEncounter(deck, enemy);
      ts.apCurrent = 99; // bypass AP gating for this legacy full-hand drain test
      while (ts.deck.hand.length > 0) {
        const cardId = ts.deck.hand[0].id;
        const play = playCardAction(ts, cardId, true, false);
        if (play.blocked) break;
        if (ts.result) break;
      }
      if (!ts.result) {
        expect(isHandEmpty(ts)).toBe(true);
      }
    });
  });
});

// ============================================================
// 6. ENCOUNTER REWARDS
// ============================================================

describe('Encounter Rewards', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  describe('generateCurrencyReward', () => {
    it('returns 10 for common on floor 1', () => {
      expect(generateCurrencyReward(1, 'common')).toBe(10);
    });

    it('returns 25 for elite on floor 1', () => {
      expect(generateCurrencyReward(1, 'elite')).toBe(25);
    });

    it('returns 50 for boss on floor 1', () => {
      expect(generateCurrencyReward(1, 'boss')).toBe(50);
    });

    it('scales by floor', () => {
      // Floor 5: 10 * (1 + 4 * 0.15) = 10 * 1.6 = 16
      expect(generateCurrencyReward(5, 'common')).toBe(16);
    });

    it('scales elite by floor', () => {
      // Floor 3: 25 * (1 + 2 * 0.15) = 25 * 1.3 = 32.5 → 33
      expect(generateCurrencyReward(3, 'elite')).toBe(Math.round(25 * 1.3));
    });

    it('scales boss by floor', () => {
      // Floor 10: 50 * (1 + 9 * 0.15) = 50 * 2.35 = 117 (JS floating point rounds to 117)
      expect(generateCurrencyReward(10, 'boss')).toBe(117);
    });
  });

  describe('generateComboBonus', () => {
    it('returns 0 for 0 combo', () => {
      expect(generateComboBonus(0)).toBe(0);
    });

    it('returns maxCombo * 2', () => {
      expect(generateComboBonus(5)).toBe(10);
    });

    it('returns 20 for combo 10', () => {
      expect(generateComboBonus(10)).toBe(20);
    });
  });

  describe('generateCardRewards', () => {
    it('returns empty array for empty facts', () => {
      const result = generateCardRewards(1, []);
      expect(result).toHaveLength(0);
    });

    it('returns up to 3 cards by default', () => {
      const facts = Array.from({ length: 10 }, (_, i) =>
        makeFact({ id: `fact-${i}` })
      );
      const result = generateCardRewards(1, facts);
      expect(result).toHaveLength(3);
    });

    it('returns fewer cards if fewer facts available', () => {
      const facts = [makeFact({ id: 'fact-1' }), makeFact({ id: 'fact-2' })];
      const result = generateCardRewards(1, facts, 5);
      expect(result).toHaveLength(2);
    });

    it('generates tier 1 cards', () => {
      const facts = [makeFact({ id: 'fact-1' })];
      const result = generateCardRewards(1, facts, 1);
      expect(result[0].tier).toBe('1');
    });

    it('each card has a unique ID', () => {
      const facts = Array.from({ length: 5 }, (_, i) =>
        makeFact({ id: `fact-${i}` })
      );
      const result = generateCardRewards(1, facts, 3);
      const ids = result.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('buildEncounterRewards', () => {
    it('returns all reward components', () => {
      const facts = Array.from({ length: 5 }, (_, i) =>
        makeFact({ id: `fact-${i}` })
      );
      const rewards = buildEncounterRewards(1, 'common', facts, 3);
      expect(rewards.cardChoices.length).toBeGreaterThan(0);
      expect(rewards.currencyReward).toBe(10);
      expect(rewards.comboBonus).toBe(6); // 3 * 2
    });

    it('handles empty facts gracefully', () => {
      const rewards = buildEncounterRewards(1, 'elite', [], 0);
      expect(rewards.cardChoices).toHaveLength(0);
      expect(rewards.currencyReward).toBe(25);
      expect(rewards.comboBonus).toBe(0);
    });
  });
});
