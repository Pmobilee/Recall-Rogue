import type { CardType } from './card-types';
import { ENABLE_PHASE2_MECHANICS } from './balance';

/**
 * How a card was played during combat.
 * - `'charge'`: Alias for `'charge_correct'` (legacy). Player answered correctly.
 * - `'charge_correct'`: Player answered a quiz question correctly. Full charge power.
 * - `'charge_wrong'`: Player answered a quiz question incorrectly. Reduced power.
 * - `'quick'`: Card was played without a quiz (Quick Play tap). Echo cards block this path.
 * - `'quick_play'`: Alias for `'quick'` — used in some AR-59.x discovery logic. Both mean Quick Play.
 */
export type PlayMode = 'charge' | 'charge_correct' | 'charge_wrong' | 'quick' | 'quick_play';

export interface MechanicDefinition {
  id: string;
  name: string;
  type: CardType;
  description: string;
  baseValue: number;
  apCost: number;
  maxPerPool: number;
  secondaryValue?: number;
  secondaryThreshold?: number;
  tags: string[];
  /** Launch phase: 1 = available at launch, 2 = post-launch expansion. */
  launchPhase: 1 | 2;
  /** Quick Play base value (no quiz). */
  quickPlayValue: number;
  /** Charged Correct base value (answered correctly). */
  chargeCorrectValue: number;
  /** Charged Wrong base value (answered incorrectly). */
  chargeWrongValue: number;
  /**
   * Optional bonus effect identifier applied only on Charged Correct plays.
   * The resolver checks this field and applies the corresponding bonus.
   */
  chargeBonusEffect?: string;
}

export const MECHANIC_DEFINITIONS: MechanicDefinition[] = [
  // Attack (phase 1)
  {
    id: 'strike', name: 'Strike', type: 'attack',
    description: 'Deal damage.',
    baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['strike'], launchPhase: 1,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 6,
  },
  {
    id: 'multi_hit', name: 'Multi-Hit', type: 'attack',
    description: 'Hit 3 times.',
    baseValue: 4, apCost: 2, maxPerPool: 0, secondaryValue: 3, tags: ['multi'], launchPhase: 1,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // Attack (phase 1 promoted)
  {
    id: 'heavy_strike', name: 'Heavy Strike', type: 'attack',
    description: 'High damage. Costs 3 AP.',
    baseValue: 20, apCost: 3, maxPerPool: 3, tags: ['strike', 'heavy'], launchPhase: 1,
    quickPlayValue: 20, chargeCorrectValue: 60, chargeWrongValue: 14,
  },
  {
    id: 'piercing', name: 'Piercing', type: 'attack',
    description: 'Ignores enemy block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['pierce'], launchPhase: 1,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'reckless', name: 'Reckless', type: 'attack',
    description: 'High damage, self-damage.',
    baseValue: 12, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['risk'], launchPhase: 1,
    quickPlayValue: 12, chargeCorrectValue: 36, chargeWrongValue: 8,
  },
  {
    id: 'execute', name: 'Execute', type: 'attack',
    description: 'Bonus damage below 30% HP.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 8, secondaryThreshold: 0.3, tags: ['finisher'], launchPhase: 1,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'lifetap', name: 'Lifetap', type: 'attack',
    description: 'Deal damage. Heal 20% of damage dealt.',
    baseValue: 8, apCost: 2, maxPerPool: 0, tags: ['lifetap'], launchPhase: 1,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 6,
  },

  // Attack (phase 2)
  // (no remaining phase 2 attack mechanics)

  // Shield (phase 1)
  {
    id: 'block', name: 'Block', type: 'shield',
    description: 'Gain block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['block'], launchPhase: 1,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'thorns', name: 'Thorns', type: 'shield',
    description: 'Gain 6 block and reflect 3 damage when hit.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['retaliate'], launchPhase: 1,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'emergency', name: 'Emergency', type: 'shield',
    description: 'Gain block. Double if HP below 30%.',
    baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['emergency'], launchPhase: 1,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // Shield (phase 1 promoted)
  {
    id: 'fortify', name: 'Fortify', type: 'shield',
    description: 'Gain 7 persistent block into next turn.',
    baseValue: 7, apCost: 2, maxPerPool: 0, tags: ['persistent_block'], launchPhase: 1,
    quickPlayValue: 7, chargeCorrectValue: 21, chargeWrongValue: 5,
  },
  {
    id: 'brace', name: 'Brace', type: 'shield',
    description: 'Block equal to enemy telegraph.',
    baseValue: 0, apCost: 1, maxPerPool: 0, tags: ['brace'], launchPhase: 1,
    quickPlayValue: 0, chargeCorrectValue: 0, chargeWrongValue: 0,
  },
  {
    id: 'overheal', name: 'Overheal', type: 'shield',
    description: 'Gain 10 block. Double if HP below 50%.',
    baseValue: 10, apCost: 2, maxPerPool: 0, secondaryValue: 2, tags: ['overheal'], launchPhase: 1,
    quickPlayValue: 10, chargeCorrectValue: 30, chargeWrongValue: 7,
  },

  // Shield (phase 2)
  {
    id: 'parry', name: 'Parry', type: 'shield',
    description: 'Block + draw if enemy attacks.',
    baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 1, tags: ['parry'], launchPhase: 2,
    quickPlayValue: 3, chargeCorrectValue: 9, chargeWrongValue: 2,
  },

  // Buff (phase 1)
  {
    id: 'empower', name: 'Empower', type: 'buff',
    description: 'Next card deals 50% more damage.',
    baseValue: 50, apCost: 1, maxPerPool: 0, tags: ['buff'], launchPhase: 1,
    quickPlayValue: 50, chargeCorrectValue: 75, chargeWrongValue: 35,
  },
  {
    id: 'quicken', name: 'Quicken', type: 'buff',
    description: 'Gain +1 AP this turn.',
    baseValue: 1, apCost: 0, maxPerPool: 2, tags: ['ap_gain'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'quicken_draw',
  },

  // Buff (phase 1 promoted)
  {
    id: 'focus', name: 'Focus', type: 'buff',
    description: 'Next card costs 1 less AP.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['focus'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'focus_double',
  },
  {
    id: 'double_strike', name: 'Double Strike', type: 'buff',
    description: 'Next attack card hits twice at full power.',
    baseValue: 100, apCost: 2, maxPerPool: 0, secondaryValue: 100, tags: ['double_strike'], launchPhase: 1,
    quickPlayValue: 100, chargeCorrectValue: 100, chargeWrongValue: 100,
    chargeBonusEffect: 'double_strike_pierce',
  },

  // Debuff (phase 1)
  {
    id: 'weaken', name: 'Weaken', type: 'debuff',
    description: 'Apply weakness.',
    baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['weakness'], launchPhase: 1,
    quickPlayValue: 2, chargeCorrectValue: 6, chargeWrongValue: 1,
  },
  {
    id: 'expose', name: 'Expose', type: 'debuff',
    description: 'Apply vulnerable.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['vulnerable'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Debuff (phase 1 promoted)
  {
    id: 'hex', name: 'Hex', type: 'debuff',
    description: 'Apply poison 3 for 3 turns.',
    baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['poison'], launchPhase: 1,
    quickPlayValue: 3, chargeCorrectValue: 8, chargeWrongValue: 2,
  },
  {
    id: 'slow', name: 'Slow', type: 'debuff',
    description: "Skip enemy's next defend or buff.",
    baseValue: 1, apCost: 2, maxPerPool: 0, tags: ['slow'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'slow_weaken',
  },

  // Cleanse (utility phase 1)
  {
    id: 'cleanse', name: 'Cleanse', type: 'utility',
    description: 'Remove all debuffs. Draw 1 card.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['cleanse'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Utility (phase 1)
  {
    id: 'scout', name: 'Scout', type: 'utility',
    description: 'Draw 2 cards.',
    baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['draw'], launchPhase: 1,
    quickPlayValue: 2, chargeCorrectValue: 3, chargeWrongValue: 1,
  },
  {
    id: 'recycle', name: 'Recycle', type: 'utility',
    description: 'Draw 3 cards.',
    baseValue: 3, apCost: 1, maxPerPool: 0, tags: ['cycle'], launchPhase: 1,
    quickPlayValue: 3, chargeCorrectValue: 4, chargeWrongValue: 2,
    chargeBonusEffect: 'recycle_from_discard',
  },

  // Utility (phase 1 promoted)
  {
    id: 'foresight', name: 'Foresight', type: 'utility',
    description: 'Draw 2 cards.',
    baseValue: 2, apCost: 0, maxPerPool: 0, tags: ['foresight'], launchPhase: 1,
    quickPlayValue: 2, chargeCorrectValue: 3, chargeWrongValue: 1,
    chargeBonusEffect: 'foresight_intent',
  },

  // Utility (phase 2)
  {
    id: 'transmute', name: 'Transmute', type: 'utility',
    description: 'Transform your weakest hand card into a different type.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['transmute'], launchPhase: 2,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Immunity (utility phase 2)
  {
    id: 'immunity', name: 'Immunity', type: 'utility',
    description: 'Absorb next damage instance (up to 8).',
    baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['immunity'], launchPhase: 2,
    quickPlayValue: 8, chargeCorrectValue: 8, chargeWrongValue: 8,
  },

  // Wild (phase 1)
  {
    id: 'mirror', name: 'Mirror', type: 'wild',
    description: 'Copy previous card effect.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['copy'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },
  {
    id: 'adapt', name: 'Adapt', type: 'wild',
    description: 'Smart: Block vs ATK, Cleanse vs debuff, else Attack.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['adapt'], launchPhase: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Wild (phase 2)
  {
    id: 'overclock', name: 'Overclock', type: 'wild',
    description: 'Next card 2x effect.',
    baseValue: 2, apCost: 2, maxPerPool: 0, tags: ['overclock'], launchPhase: 2,
    quickPlayValue: 2, chargeCorrectValue: 2, chargeWrongValue: 2,
  },
];

/** Returns mechanics filtered by launch phase gate. */
function getActiveMechanics(): MechanicDefinition[] {
  if (ENABLE_PHASE2_MECHANICS) return MECHANIC_DEFINITIONS;
  return MECHANIC_DEFINITIONS.filter(m => m.launchPhase === 1);
}

export const MECHANICS_BY_TYPE: Record<CardType, MechanicDefinition[]> = {
  attack: getActiveMechanics().filter(m => m.type === 'attack'),
  shield: getActiveMechanics().filter(m => m.type === 'shield'),
  utility: getActiveMechanics().filter(m => m.type === 'utility'),
  buff: getActiveMechanics().filter(m => m.type === 'buff'),
  debuff: getActiveMechanics().filter(m => m.type === 'debuff'),
  wild: getActiveMechanics().filter(m => m.type === 'wild'),
};

export const MECHANIC_BY_ID: Record<string, MechanicDefinition> = Object.fromEntries(
  MECHANIC_DEFINITIONS.map(m => [m.id, m]),
);

export function getMechanicDefinition(id: string | undefined): MechanicDefinition | undefined {
  if (!id) return undefined;
  return MECHANIC_BY_ID[id];
}
