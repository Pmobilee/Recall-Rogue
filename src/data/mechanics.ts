import type { CardType } from './card-types';
import { ENABLE_PHASE2_MECHANICS } from './balance';

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
}

export const MECHANIC_DEFINITIONS: MechanicDefinition[] = [
  // Attack (phase 1)
  { id: 'strike', name: 'Strike', type: 'attack', description: 'Deal damage.', baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['strike'], launchPhase: 1 },
  { id: 'multi_hit', name: 'Multi-Hit', type: 'attack', description: 'Hit 3 times.', baseValue: 4, apCost: 2, maxPerPool: 0, secondaryValue: 3, tags: ['multi'], launchPhase: 1 },

  // Attack (phase 2)
  { id: 'heavy_strike', name: 'Heavy Strike', type: 'attack', description: 'High damage. Costs 3 AP.', baseValue: 20, apCost: 3, maxPerPool: 3, tags: ['strike', 'heavy'], launchPhase: 2 },
  { id: 'piercing', name: 'Piercing', type: 'attack', description: 'Ignores enemy block.', baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['pierce'], launchPhase: 2 },
  { id: 'reckless', name: 'Reckless', type: 'attack', description: 'High damage, self-damage.', baseValue: 12, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['risk'], launchPhase: 2 },
  { id: 'execute', name: 'Execute', type: 'attack', description: 'Bonus damage below 30% HP.', baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 8, secondaryThreshold: 0.3, tags: ['finisher'], launchPhase: 2 },

  // Shield (phase 1)
  { id: 'block', name: 'Block', type: 'shield', description: 'Gain block.', baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['block'], launchPhase: 1 },
  { id: 'thorns', name: 'Thorns', type: 'shield', description: 'Gain 6 block and reflect 3 damage when hit.', baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['retaliate'], launchPhase: 1 },

  // Shield (phase 2)
  { id: 'fortify', name: 'Fortify', type: 'shield', description: 'Gain 7 persistent block into next turn.', baseValue: 7, apCost: 2, maxPerPool: 0, tags: ['persistent_block'], launchPhase: 2 },
  { id: 'parry', name: 'Parry', type: 'shield', description: 'Block + draw if enemy attacks.', baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 1, tags: ['parry'], launchPhase: 2 },
  { id: 'brace', name: 'Brace', type: 'shield', description: 'Block equal to enemy telegraph.', baseValue: 0, apCost: 1, maxPerPool: 0, tags: ['brace'], launchPhase: 2 },

  // Cleanse (utility phase 1)
  { id: 'cleanse', name: 'Cleanse', type: 'utility', description: 'Remove all debuffs. Draw 1 card.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['cleanse'], launchPhase: 1 },

  // Overheal (shield phase 2)
  { id: 'overheal', name: 'Overheal', type: 'shield', description: 'Gain 10 block. Double if HP below 50%.', baseValue: 10, apCost: 2, maxPerPool: 0, secondaryValue: 2, tags: ['overheal'], launchPhase: 2 },
  // Lifetap (attack phase 2)
  { id: 'lifetap', name: 'Lifetap', type: 'attack', description: 'Deal damage. Heal 20% of damage dealt.', baseValue: 8, apCost: 2, maxPerPool: 0, tags: ['lifetap'], launchPhase: 2 },

  // Buff (phase 1)
  { id: 'empower', name: 'Empower', type: 'buff', description: 'Next card deals 50% more damage.', baseValue: 50, apCost: 1, maxPerPool: 0, tags: ['buff'], launchPhase: 1 },
  { id: 'quicken', name: 'Quicken', type: 'buff', description: 'Gain +1 AP this turn.', baseValue: 1, apCost: 0, maxPerPool: 2, tags: ['ap_gain'], launchPhase: 1 },

  // Buff (phase 2)
  { id: 'focus', name: 'Focus', type: 'buff', description: 'Next card costs 1 less AP.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['focus'], launchPhase: 2 },
  { id: 'double_strike', name: 'Double Strike', type: 'buff', description: 'Next attack card hits twice at full power.', baseValue: 100, apCost: 2, maxPerPool: 0, secondaryValue: 100, tags: ['double_strike'], launchPhase: 2 },

  // Debuff (phase 1)
  { id: 'weaken', name: 'Weaken', type: 'debuff', description: 'Apply weakness.', baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['weakness'], launchPhase: 1 },
  { id: 'expose', name: 'Expose', type: 'debuff', description: 'Apply vulnerable.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['vulnerable'], launchPhase: 1 },

  // Debuff (phase 2)
  { id: 'slow', name: 'Slow', type: 'debuff', description: 'Skip enemy next defend/buff action.', baseValue: 1, apCost: 2, maxPerPool: 0, tags: ['slow'], launchPhase: 2 },
  { id: 'hex', name: 'Hex', type: 'debuff', description: 'Apply poison 3 for 3 turns.', baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['poison'], launchPhase: 2 },

  // Utility (phase 1)
  { id: 'scout', name: 'Scout', type: 'utility', description: 'Draw 2 cards.', baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['draw'], launchPhase: 1 },
  { id: 'recycle', name: 'Recycle', type: 'utility', description: 'Draw 3 cards.', baseValue: 3, apCost: 1, maxPerPool: 0, tags: ['cycle'], launchPhase: 1 },

  // Utility (phase 2)
  { id: 'foresight', name: 'Foresight', type: 'utility', description: 'Draw 2 cards.', baseValue: 2, apCost: 0, maxPerPool: 0, tags: ['foresight'], launchPhase: 2 },
  { id: 'transmute', name: 'Transmute', type: 'utility', description: 'Transform your weakest hand card into a different type.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['transmute'], launchPhase: 2 },

  // Emergency (shield phase 1)
  { id: 'emergency', name: 'Emergency', type: 'shield', description: 'Gain block. Double if HP below 30%.', baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['emergency'], launchPhase: 1 },

  // Immunity (utility phase 2)
  { id: 'immunity', name: 'Immunity', type: 'utility', description: 'Absorb next damage instance (up to 8).', baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['immunity'], launchPhase: 2 },

  // Wild (phase 1)
  { id: 'mirror', name: 'Mirror', type: 'wild', description: 'Copy previous card effect.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['copy'], launchPhase: 1 },
  { id: 'adapt', name: 'Adapt', type: 'wild', description: 'Adaptive wild effect.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['adapt'], launchPhase: 1 },

  // Wild (phase 2)
  { id: 'overclock', name: 'Overclock', type: 'wild', description: 'Next card 2x effect.', baseValue: 2, apCost: 2, maxPerPool: 0, tags: ['overclock'], launchPhase: 2 },
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

