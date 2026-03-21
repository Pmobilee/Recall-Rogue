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
  /** Character level required to unlock this mechanic. 0 = available from the start. */
  unlockLevel: number;
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
    baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 6,
  },
  {
    id: 'multi_hit', name: 'Multi-Hit', type: 'attack',
    description: 'Hit 3 times.',
    baseValue: 4, apCost: 2, maxPerPool: 0, secondaryValue: 3, tags: ['multi'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // Attack (phase 1 promoted)
  {
    id: 'heavy_strike', name: 'Heavy Strike', type: 'attack',
    description: 'High damage. Costs 3 AP.',
    baseValue: 20, apCost: 3, maxPerPool: 3, tags: ['strike', 'heavy'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 20, chargeCorrectValue: 60, chargeWrongValue: 14,
  },
  {
    id: 'piercing', name: 'Piercing', type: 'attack',
    description: 'Ignores enemy block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['pierce'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'reckless', name: 'Reckless', type: 'attack',
    description: 'High damage, self-damage.',
    baseValue: 12, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['risk'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 12, chargeCorrectValue: 36, chargeWrongValue: 8,
  },
  {
    id: 'execute', name: 'Execute', type: 'attack',
    description: 'Bonus damage below 30% HP.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 8, secondaryThreshold: 0.3, tags: ['finisher'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'lifetap', name: 'Lifetap', type: 'attack',
    description: 'Deal damage. Heal 20% of damage dealt.',
    baseValue: 8, apCost: 2, maxPerPool: 0, tags: ['lifetap'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 6,
  },

  // Attack (phase 2)
  // (no remaining phase 2 attack mechanics)

  // Shield (phase 1)
  {
    id: 'block', name: 'Block', type: 'shield',
    description: 'Gain block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'thorns', name: 'Thorns', type: 'shield',
    description: 'Gain 6 block and reflect 3 damage when hit.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['retaliate'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'emergency', name: 'Emergency', type: 'shield',
    description: 'Gain block. Double if HP below 30%.',
    baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['emergency'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // Shield (phase 1 promoted)
  {
    id: 'fortify', name: 'Fortify', type: 'shield',
    description: 'Gain 7 persistent block into next turn.',
    baseValue: 7, apCost: 2, maxPerPool: 0, tags: ['persistent_block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 7, chargeCorrectValue: 21, chargeWrongValue: 5,
  },
  {
    id: 'brace', name: 'Brace', type: 'shield',
    description: 'Block equal to enemy telegraph.',
    baseValue: 0, apCost: 1, maxPerPool: 0, tags: ['brace'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 0, chargeCorrectValue: 0, chargeWrongValue: 0,
  },
  {
    id: 'overheal', name: 'Overheal', type: 'shield',
    description: 'Gain 10 block. Double if HP below 50%.',
    baseValue: 10, apCost: 2, maxPerPool: 0, secondaryValue: 2, tags: ['overheal'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 10, chargeCorrectValue: 30, chargeWrongValue: 7,
  },

  // Shield (phase 2)
  {
    id: 'parry', name: 'Parry', type: 'shield',
    description: 'Block + draw if enemy attacks.',
    baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 1, tags: ['parry'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 9, chargeWrongValue: 2,
  },

  // Buff (phase 1)
  {
    id: 'empower', name: 'Empower', type: 'buff',
    description: 'Next card deals 50% more damage.',
    baseValue: 50, apCost: 1, maxPerPool: 0, tags: ['buff'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 50, chargeCorrectValue: 75, chargeWrongValue: 35,
  },
  {
    id: 'quicken', name: 'Quicken', type: 'buff',
    description: 'Gain +1 AP this turn.',
    baseValue: 1, apCost: 0, maxPerPool: 2, tags: ['ap_gain'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'quicken_draw',
  },

  // Buff (phase 1 promoted)
  {
    id: 'focus', name: 'Focus', type: 'buff',
    description: 'Next card costs 1 less AP.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['focus'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'focus_double',
  },
  {
    id: 'double_strike', name: 'Double Strike', type: 'buff',
    description: 'Next attack card hits twice at full power.',
    baseValue: 100, apCost: 2, maxPerPool: 0, secondaryValue: 100, tags: ['double_strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 100, chargeCorrectValue: 100, chargeWrongValue: 100,
    chargeBonusEffect: 'double_strike_pierce',
  },

  // Debuff (phase 1)
  {
    id: 'weaken', name: 'Weaken', type: 'debuff',
    description: 'Apply weakness.',
    baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['weakness'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 6, chargeWrongValue: 1,
  },
  {
    id: 'expose', name: 'Expose', type: 'debuff',
    description: 'Apply vulnerable.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['vulnerable'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Debuff (phase 1 promoted)
  {
    id: 'hex', name: 'Hex', type: 'debuff',
    description: 'Apply poison 3 for 3 turns.',
    baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['poison'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 8, chargeWrongValue: 2,
  },
  {
    id: 'slow', name: 'Slow', type: 'debuff',
    description: "Skip enemy's next defend or buff.",
    baseValue: 1, apCost: 2, maxPerPool: 0, tags: ['slow'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
    chargeBonusEffect: 'slow_weaken',
  },

  // Cleanse (utility phase 1)
  {
    id: 'cleanse', name: 'Cleanse', type: 'utility',
    description: 'Remove all debuffs. Draw 1 card.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['cleanse'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Utility (phase 1)
  {
    id: 'scout', name: 'Scout', type: 'utility',
    description: 'Draw 2 cards.',
    baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['draw'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 3, chargeWrongValue: 1,
  },
  {
    id: 'recycle', name: 'Recycle', type: 'utility',
    description: 'Draw 3 cards.',
    baseValue: 3, apCost: 1, maxPerPool: 0, tags: ['cycle'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 4, chargeWrongValue: 2,
    chargeBonusEffect: 'recycle_from_discard',
  },

  // Utility (phase 1 promoted)
  {
    id: 'foresight', name: 'Foresight', type: 'utility',
    description: 'Draw 2 cards.',
    baseValue: 2, apCost: 0, maxPerPool: 0, tags: ['foresight'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 3, chargeWrongValue: 1,
    chargeBonusEffect: 'foresight_intent',
  },

  // Utility (phase 2)
  {
    id: 'transmute', name: 'Transmute', type: 'utility',
    description: 'Transform your weakest hand card into a different type.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['transmute'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Immunity (utility phase 2)
  {
    id: 'immunity', name: 'Immunity', type: 'utility',
    description: 'Absorb next damage instance (up to 8).',
    baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['immunity'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 8, chargeCorrectValue: 8, chargeWrongValue: 8,
  },

  // Wild (phase 1)
  {
    id: 'mirror', name: 'Mirror', type: 'wild',
    description: 'Copy previous card effect.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['copy'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },
  {
    id: 'adapt', name: 'Adapt', type: 'wild',
    description: 'Smart: Block vs ATK, Cleanse vs debuff, else Attack.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['adapt'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Wild (phase 2)
  {
    id: 'overclock', name: 'Overclock', type: 'wild',
    description: 'Next card 2x effect.',
    baseValue: 2, apCost: 2, maxPerPool: 0, tags: ['overclock'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 2, chargeWrongValue: 2,
  },

  // ── AR-206: Phase 1 Expansion Cards ─────────────────────────────────────────

  // Filler cards (8)
  {
    id: 'power_strike', name: 'Power Strike', type: 'attack',
    description: 'A heavier strike that deals more damage.',
    baseValue: 10, apCost: 1, maxPerPool: 3, tags: ['strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 10, chargeCorrectValue: 30, chargeWrongValue: 7,
  },
  {
    id: 'twin_strike', name: 'Twin Strike', type: 'attack',
    description: 'Hit twice. Each hit triggers Burn and Bleed separately.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 2, tags: ['strike', 'multi'], launchPhase: 1, unlockLevel: 2,
    quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3,
  },
  {
    id: 'iron_wave', name: 'Iron Wave', type: 'attack',
    description: 'Deal damage and gain block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 5, tags: ['strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3,
  },
  {
    id: 'reinforce', name: 'Reinforce', type: 'shield',
    description: 'Gain more block than a basic shield.',
    baseValue: 8, apCost: 1, maxPerPool: 3, tags: ['block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 6,
  },
  {
    id: 'shrug_it_off', name: 'Shrug It Off', type: 'shield',
    description: 'Gain block and draw a card on Quick Play or Charge.',
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['block', 'draw'], launchPhase: 1, unlockLevel: 2,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'bash', name: 'Bash', type: 'attack',
    description: 'Deal damage and apply Vulnerable.',
    baseValue: 10, apCost: 2, maxPerPool: 2, tags: ['strike'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 10, chargeCorrectValue: 30, chargeWrongValue: 7,
  },
  {
    id: 'guard', name: 'Guard', type: 'shield',
    description: 'Gain a large amount of block.',
    baseValue: 14, apCost: 2, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 14, chargeCorrectValue: 42, chargeWrongValue: 10,
  },
  {
    id: 'sap', name: 'Sap', type: 'debuff',
    description: 'Deal damage and apply Weakness.',
    baseValue: 3, apCost: 1, maxPerPool: 2, tags: ['weakness'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 3, chargeCorrectValue: 9, chargeWrongValue: 2,
  },

  // Bleed cards (2)
  {
    id: 'rupture', name: 'Rupture', type: 'attack',
    description: 'Deal damage and apply Bleed.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 3, tags: ['strike', 'bleed'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3,
  },
  {
    id: 'lacerate', name: 'Lacerate', type: 'debuff',
    description: 'Deal damage and apply Bleed.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['bleed'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // Burn cards (2)
  {
    id: 'kindle', name: 'Kindle', type: 'attack',
    description: 'Deal damage, apply Burn, and immediately trigger it.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['strike', 'burn'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 4, chargeCorrectValue: 8, chargeWrongValue: 3,
  },
  {
    id: 'ignite', name: 'Ignite', type: 'buff',
    description: 'Your next attack applies Burn.',
    baseValue: 4, apCost: 1, maxPerPool: 2, tags: ['burn', 'buff'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 4, chargeCorrectValue: 8, chargeWrongValue: 2,
  },

  // Basic new cards (14)
  {
    id: 'overcharge', name: 'Overcharge', type: 'attack',
    description: 'Deal damage. On Charge: scales with Charges played this encounter.',
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['strike'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 6, chargeCorrectValue: 6, chargeWrongValue: 4,
  },
  {
    id: 'riposte', name: 'Riposte', type: 'attack',
    description: 'Deal damage and gain block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['strike'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3,
  },
  {
    id: 'absorb', name: 'Absorb', type: 'shield',
    description: 'Gain block. On Charge Correct: also draw a card.',
    baseValue: 5, apCost: 1, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 5, chargeCorrectValue: 5, chargeWrongValue: 3,
  },
  {
    id: 'reactive_shield', name: 'Reactive Shield', type: 'shield',
    description: 'Gain block and apply Thorns for 1 turn.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 2, tags: ['block', 'retaliate'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },
  {
    id: 'sift', name: 'Sift', type: 'utility',
    description: 'Look at top cards of your draw pile and discard some.',
    baseValue: 3, apCost: 1, maxPerPool: 2, tags: ['scry'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 3, chargeCorrectValue: 5, chargeWrongValue: 2,
  },
  {
    id: 'scavenge', name: 'Scavenge', type: 'utility',
    description: 'Put a card from your discard pile on top of your draw pile.',
    baseValue: 1, apCost: 1, maxPerPool: 2, tags: ['recover'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },
  {
    id: 'precision_strike', name: 'Precision Strike', type: 'attack',
    description: 'Deal damage. Charge timer is 50% longer.',
    baseValue: 8, apCost: 1, maxPerPool: 2, tags: ['strike'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 5,
  },
  {
    id: 'stagger', name: 'Stagger', type: 'debuff',
    description: "Skip the enemy's next action. Turn counter still advances.",
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['stagger'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },
  {
    id: 'corrode', name: 'Corrode', type: 'debuff',
    description: "Remove enemy block and apply Weakness.",
    baseValue: 5, apCost: 1, maxPerPool: 1, tags: ['weakness'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 5, chargeCorrectValue: 0, chargeWrongValue: 3,
  },
  {
    id: 'swap', name: 'Swap', type: 'utility',
    description: 'Discard a card and draw a replacement.',
    baseValue: 1, apCost: 0, maxPerPool: 2, tags: ['cycle'], launchPhase: 1, unlockLevel: 2,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },
  {
    id: 'siphon_strike', name: 'Siphon Strike', type: 'attack',
    description: 'Deal damage and heal based on overkill damage (min 2, max 10).',
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['strike', 'lifetap'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 6, chargeCorrectValue: 18, chargeWrongValue: 4,
  },
  {
    id: 'aegis_pulse', name: 'Aegis Pulse', type: 'shield',
    description: 'Gain block. On Charge Correct: same-chain cards in hand gain +2 block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 6,
    quickPlayValue: 5, chargeCorrectValue: 5, chargeWrongValue: 3,
  },
  {
    id: 'inscription_fury', name: 'Inscription of Fury', type: 'buff',
    description: 'All attacks deal bonus damage for the rest of combat.',
    baseValue: 2, apCost: 2, maxPerPool: 1, tags: ['inscription'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 4, chargeWrongValue: 1,
  },
  {
    id: 'inscription_iron', name: 'Inscription of Iron', type: 'buff',
    description: 'Gain block at the start of each turn for the rest of combat.',
    baseValue: 3, apCost: 2, maxPerPool: 1, tags: ['inscription'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 6, chargeWrongValue: 1,
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
