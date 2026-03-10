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
  { id: 'multi_hit', name: 'Multi-Hit', type: 'attack', description: 'Hit 3 times.', baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['multi'], launchPhase: 1 },

  // Attack (phase 2)
  { id: 'heavy_strike', name: 'Heavy Strike', type: 'attack', description: 'High damage. Costs 2 AP.', baseValue: 14, apCost: 2, maxPerPool: 3, tags: ['strike', 'heavy'], launchPhase: 2 },
  { id: 'piercing', name: 'Piercing', type: 'attack', description: 'Ignores enemy block.', baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['pierce'], launchPhase: 2 },
  { id: 'reckless', name: 'Reckless', type: 'attack', description: 'High damage, self-damage.', baseValue: 12, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['risk'], launchPhase: 2 },
  { id: 'execute', name: 'Execute', type: 'attack', description: 'Bonus damage below 30% HP.', baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 8, secondaryThreshold: 0.3, tags: ['finisher'], launchPhase: 2 },

  // Shield (phase 1)
  { id: 'block', name: 'Block', type: 'shield', description: 'Gain block.', baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['block'], launchPhase: 1 },
  { id: 'thorns', name: 'Thorns', type: 'shield', description: 'Gain block and retaliate.', baseValue: 4, apCost: 1, maxPerPool: 0, secondaryValue: 2, tags: ['retaliate'], launchPhase: 1 },

  // Shield (phase 2)
  { id: 'fortify', name: 'Fortify', type: 'shield', description: 'Block persists into next turn.', baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['persistent_block'], launchPhase: 2 },
  { id: 'parry', name: 'Parry', type: 'shield', description: 'Block + draw if enemy attacks.', baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 1, tags: ['parry'], launchPhase: 2 },
  { id: 'brace', name: 'Brace', type: 'shield', description: 'Block equal to enemy telegraph.', baseValue: 0, apCost: 1, maxPerPool: 0, tags: ['brace'], launchPhase: 2 },

  // Heal (phase 1)
  { id: 'restore', name: 'Restore', type: 'heal', description: 'Heal HP.', baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['heal'], launchPhase: 1 },
  { id: 'cleanse', name: 'Cleanse', type: 'heal', description: 'Heal and cleanse debuffs.', baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['heal', 'cleanse'], launchPhase: 1 },

  // Heal (phase 2)
  { id: 'overheal', name: 'Overheal', type: 'heal', description: 'Excess healing becomes block.', baseValue: 7, apCost: 1, maxPerPool: 0, tags: ['heal', 'overheal'], launchPhase: 2 },
  { id: 'lifetap', name: 'Lifetap', type: 'heal', description: 'Heal from this turn damage dealt.', baseValue: 30, apCost: 1, maxPerPool: 0, tags: ['lifetap'], launchPhase: 2 },

  // Buff (phase 1)
  { id: 'empower', name: 'Empower', type: 'buff', description: 'Buff next card.', baseValue: 30, apCost: 1, maxPerPool: 0, tags: ['buff'], launchPhase: 1 },
  { id: 'quicken', name: 'Quicken', type: 'buff', description: 'Gain +1 AP this turn.', baseValue: 1, apCost: 1, maxPerPool: 2, tags: ['ap_gain'], launchPhase: 1 },

  // Buff (phase 2)
  { id: 'double_strike', name: 'Double Strike', type: 'buff', description: 'Next attack hits twice at 60%.', baseValue: 60, apCost: 1, maxPerPool: 0, tags: ['double_strike'], launchPhase: 2 },
  { id: 'focus', name: 'Focus', type: 'buff', description: 'Next card gets min 1.3x difficulty multiplier.', baseValue: 130, apCost: 1, maxPerPool: 0, tags: ['focus'], launchPhase: 2 },

  // Debuff (phase 1)
  { id: 'weaken', name: 'Weaken', type: 'debuff', description: 'Apply weakness.', baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['weakness'], launchPhase: 1 },
  { id: 'expose', name: 'Expose', type: 'debuff', description: 'Apply vulnerable.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['vulnerable'], launchPhase: 1 },

  // Debuff (phase 2)
  { id: 'slow', name: 'Slow', type: 'debuff', description: 'Skip enemy next defend/buff action.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['slow'], launchPhase: 2 },
  { id: 'hex', name: 'Hex', type: 'debuff', description: 'Apply poison 3 for 3 turns.', baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['poison'], launchPhase: 2 },

  // Utility (phase 1)
  { id: 'scout', name: 'Scout', type: 'utility', description: 'Draw cards.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['draw'], launchPhase: 1 },
  { id: 'recycle', name: 'Recycle', type: 'utility', description: 'Cycle card.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['cycle'], launchPhase: 1 },

  // Utility (phase 2)
  { id: 'foresight', name: 'Foresight', type: 'utility', description: 'Reveal next two enemy intents.', baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['foresight'], launchPhase: 2 },
  { id: 'transmute', name: 'Transmute', type: 'utility', description: 'Transform a random hand card type.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['transmute'], launchPhase: 2 },

  // Regen (phase 1)
  { id: 'sustained', name: 'Sustained', type: 'regen', description: 'Apply regen.', baseValue: 3, apCost: 1, maxPerPool: 0, tags: ['regen'], launchPhase: 1 },
  { id: 'emergency', name: 'Emergency', type: 'regen', description: 'Burst sustain under pressure.', baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['regen', 'burst'], launchPhase: 1 },

  // Regen (phase 2)
  { id: 'immunity', name: 'Immunity', type: 'regen', description: 'Absorb next status-damage instance.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['immunity'], launchPhase: 2 },

  // Wild (phase 1)
  { id: 'mirror', name: 'Mirror', type: 'wild', description: 'Copy previous card effect.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['copy'], launchPhase: 1 },
  { id: 'adapt', name: 'Adapt', type: 'wild', description: 'Adaptive wild effect.', baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['adapt'], launchPhase: 1 },

  // Wild (phase 2)
  { id: 'overclock', name: 'Overclock', type: 'wild', description: 'Next card 2x, next draw -1.', baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['overclock'], launchPhase: 2 },
];

/** Returns mechanics filtered by launch phase gate. */
function getActiveMechanics(): MechanicDefinition[] {
  if (ENABLE_PHASE2_MECHANICS) return MECHANIC_DEFINITIONS;
  return MECHANIC_DEFINITIONS.filter(m => m.launchPhase === 1);
}

export const MECHANICS_BY_TYPE: Record<CardType, MechanicDefinition[]> = {
  attack: getActiveMechanics().filter(m => m.type === 'attack'),
  shield: getActiveMechanics().filter(m => m.type === 'shield'),
  heal: getActiveMechanics().filter(m => m.type === 'heal'),
  utility: getActiveMechanics().filter(m => m.type === 'utility'),
  buff: getActiveMechanics().filter(m => m.type === 'buff'),
  debuff: getActiveMechanics().filter(m => m.type === 'debuff'),
  regen: getActiveMechanics().filter(m => m.type === 'regen'),
  wild: getActiveMechanics().filter(m => m.type === 'wild'),
};

export const MECHANIC_BY_ID: Record<string, MechanicDefinition> = Object.fromEntries(
  MECHANIC_DEFINITIONS.map(m => [m.id, m]),
);

export function getMechanicDefinition(id: string | undefined): MechanicDefinition | undefined {
  if (!id) return undefined;
  return MECHANIC_BY_ID[id];
}

