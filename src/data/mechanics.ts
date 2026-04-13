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
  /**
   * @deprecated INFORMATIONAL ONLY — the runtime does NOT read this field.
   * Charge Correct damage is computed as `quickPlayValue × CHARGE_CORRECT_MULTIPLIER (1.5)`.
   * This field exists for documentation/reference purposes only.
   */
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
    quickPlayValue: 4, chargeCorrectValue: 24, chargeWrongValue: 3,
  },
  {
    id: 'multi_hit', name: 'Multi-Hit', type: 'attack',
    description: 'Hit 3 times.',
    baseValue: 4, apCost: 2, maxPerPool: 0, secondaryValue: 3, tags: ['multi'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 12, chargeWrongValue: 2,
  },

  // Attack (phase 1 promoted)
  {
    id: 'heavy_strike', name: 'Heavy Strike', type: 'attack',
    description: 'High damage. Costs 2 AP.',
    baseValue: 20, apCost: 2, maxPerPool: 3, tags: ['strike', 'heavy'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 10, chargeCorrectValue: 60, chargeWrongValue: 7,
  },
  {
    id: 'piercing', name: 'Piercing', type: 'attack',
    description: 'Ignores enemy block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['pierce'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2,
  },
  {
    id: 'reckless', name: 'Reckless', type: 'attack',
    description: 'Ignores block. Self-damage.',
    baseValue: 12, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['risk'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 36, chargeWrongValue: 4,
  },
  {
    id: 'execute', name: 'Execute', type: 'attack',
    description: 'Bonus damage below 30% HP.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 8, secondaryThreshold: 0.3, tags: ['finisher'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2,
  },
  {
    id: 'lifetap', name: 'Lifetap', type: 'attack',
    description: 'Deal damage. Heal 20% of damage dealt.',
    baseValue: 8, apCost: 2, maxPerPool: 0, tags: ['lifetap'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 4, chargeCorrectValue: 24, chargeWrongValue: 3,
  },

  // Attack (phase 2)
  // (no remaining phase 2 attack mechanics)

  // Shield (phase 1)
  {
    id: 'block', name: 'Block', type: 'shield',
    description: 'Gain block.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 5, chargeCorrectValue: 18, chargeWrongValue: 3,
  },
  {
    id: 'thorns', name: 'Thorns', type: 'shield',
    description: 'Gain 6 block and reflect 3 damage when hit.',
    baseValue: 6, apCost: 1, maxPerPool: 0, secondaryValue: 3, tags: ['retaliate'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2,
  },
  {
    id: 'emergency', name: 'Emergency', type: 'shield',
    description: 'Gain block. Double if HP below 30%.',
    baseValue: 4, apCost: 1, maxPerPool: 0, tags: ['emergency'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 12, chargeWrongValue: 2,
  },

  // Shield (phase 1 promoted)
  {
    id: 'fortify', name: 'Entrench', type: 'shield',
    description: 'Gain 50% of your current block.',
    baseValue: 7, apCost: 2, maxPerPool: 0, tags: ['persistent_block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 6, chargeCorrectValue: 21, chargeWrongValue: 4,
  },
  {
    id: 'brace', name: 'Brace', type: 'shield',
    description: 'Block equal to enemy telegraph.',
    baseValue: 6, apCost: 1, maxPerPool: 0, tags: ['brace'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 9, chargeWrongValue: 2,
  },
  {
    id: 'overheal', name: 'Overheal', type: 'shield',
    description: 'Gain 10 block. Double if HP below 50%.',
    baseValue: 10, apCost: 2, maxPerPool: 0, secondaryValue: 2, tags: ['overheal'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4,
  },

  // Shield (phase 2)
  {
    id: 'parry', name: 'Parry', type: 'shield',
    description: 'Block + draw if enemy attacks.',
    baseValue: 3, apCost: 1, maxPerPool: 0, secondaryValue: 1, tags: ['parry'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 9, chargeWrongValue: 1,
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
    quickPlayValue: 75, chargeCorrectValue: 100, chargeWrongValue: 75,
    chargeBonusEffect: 'double_strike_pierce',
  },

  // Debuff (phase 1)
  {
    id: 'weaken', name: 'Weaken', type: 'debuff',
    description: 'Apply weakness.',
    baseValue: 2, apCost: 1, maxPerPool: 0, tags: ['weakness'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 6, chargeWrongValue: 1,
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
    quickPlayValue: 2, chargeCorrectValue: 8, chargeWrongValue: 1,
  },
  {
    id: 'slow', name: 'Slow', type: 'debuff',
    description: "Skip enemy's next defend or buff. Won't stop attacks or heals.",
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
    quickPlayValue: 2, chargeCorrectValue: 4, chargeWrongValue: 2,
    chargeBonusEffect: 'recycle_from_discard',
  },

  // Utility (phase 1 promoted)
  {
    id: 'foresight', name: 'Foresight', type: 'utility',
    description: 'Draw 2 cards. Forget: removed from combat after use.',
    baseValue: 2, apCost: 0, maxPerPool: 0, tags: ['foresight', 'forget'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
    chargeBonusEffect: 'foresight_intent',
  },

  // Utility (phase 2)
  {
    id: 'conjure', name: 'Conjure', type: 'utility',
    description: 'Summon one of three cards to your hand this encounter.',
    baseValue: 0, apCost: 1, maxPerPool: 2, tags: ['conjure'], launchPhase: 2, unlockLevel: 5,
    quickPlayValue: 0, chargeCorrectValue: 0, chargeWrongValue: 0,
  },
  {
    id: 'forge', name: 'Forge', type: 'buff',
    description: 'Upgrade a card in your hand for this encounter.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['forge'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 0,
  },
  {
    id: 'transmute', name: 'Transmute', type: 'utility',
    description: 'Transform this card into a different card for this encounter. Charge to choose from 3 options.',
    baseValue: 1, apCost: 1, maxPerPool: 0, tags: ['transmute'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Immunity (utility phase 2)
  {
    id: 'immunity', name: 'Immunity', type: 'utility',
    description: 'Absorb next damage instance (up to 8).',
    baseValue: 8, apCost: 1, maxPerPool: 0, tags: ['immunity'], launchPhase: 2, unlockLevel: 0,
    quickPlayValue: 4, chargeCorrectValue: 8, chargeWrongValue: 4,
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
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 2,
  },

  // ── AR-206: Phase 1 Expansion Cards ─────────────────────────────────────────

  // Filler cards (8)
  {
    id: 'power_strike', name: 'Power Strike', type: 'attack',
    description: 'A heavier strike that deals more damage.',
    baseValue: 10, apCost: 1, maxPerPool: 3, tags: ['strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4,
  },
  {
    id: 'twin_strike', name: 'Twin Strike', type: 'attack',
    description: 'Hit twice. Each hit triggers Burn and Bleed separately.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 2, tags: ['strike', 'multi'], launchPhase: 1, unlockLevel: 2,
    quickPlayValue: 3, chargeCorrectValue: 15, chargeWrongValue: 2,
  },
  {
    id: 'iron_wave', name: 'Iron Wave', type: 'attack',
    description: 'Deal damage and gain block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 5, tags: ['strike'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 3, chargeCorrectValue: 15, chargeWrongValue: 2,
  },
  {
    id: 'reinforce', name: 'Reinforce', type: 'shield',
    description: 'Gain more block than a basic shield.',
    baseValue: 8, apCost: 1, maxPerPool: 3, tags: ['block'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 7, chargeCorrectValue: 24, chargeWrongValue: 4,
  },
  {
    id: 'shrug_it_off', name: 'Shrug It Off', type: 'shield',
    description: 'Gain block and draw a card on Quick Play or Charge.',
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['block', 'draw'], launchPhase: 1, unlockLevel: 2,
    quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2,
  },
  {
    id: 'bash', name: 'Bash', type: 'attack',
    description: 'Deal damage and apply Vulnerable.',
    baseValue: 10, apCost: 2, maxPerPool: 2, tags: ['strike'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4,
  },
  {
    id: 'guard', name: 'Guard', type: 'shield',
    description: 'Gain a large amount of block.',
    baseValue: 14, apCost: 2, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 12, chargeCorrectValue: 42, chargeWrongValue: 7,
  },
  {
    id: 'sap', name: 'Sap', type: 'debuff',
    description: 'Deal damage and apply Weakness.',
    baseValue: 3, apCost: 1, maxPerPool: 2, tags: ['weakness'], launchPhase: 1, unlockLevel: 1,
    quickPlayValue: 2, chargeCorrectValue: 9, chargeWrongValue: 1,
  },

  // Bleed cards (2)
  {
    id: 'rupture', name: 'Rupture', type: 'attack',
    description: 'Deal damage and apply Bleed.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 3, tags: ['strike', 'bleed'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 3, chargeCorrectValue: 15, chargeWrongValue: 2,
  },
  {
    id: 'lacerate', name: 'Lacerate', type: 'debuff',
    description: 'Deal damage and apply Bleed.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['bleed'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 2, chargeCorrectValue: 12, chargeWrongValue: 2,
  },

  // Burn cards (2)
  {
    id: 'kindle', name: 'Kindle', type: 'attack',
    description: 'Deal damage, apply Burn, and immediately trigger it.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['strike', 'burn'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 2, chargeCorrectValue: 8, chargeWrongValue: 2,
  },
  {
    id: 'ignite', name: 'Ignite', type: 'buff',
    description: 'Your next attack applies Burn.',
    baseValue: 4, apCost: 1, maxPerPool: 2, tags: ['burn', 'buff'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 2, chargeCorrectValue: 8, chargeWrongValue: 1,
  },

  // Basic new cards (14)
  {
    id: 'overcharge', name: 'Overcharge', type: 'attack',
    description: 'Deal damage. On Charge: scales with Charges played this encounter.',
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['strike'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 3, chargeCorrectValue: 6, chargeWrongValue: 2,
  },
  {
    id: 'riposte', name: 'Riposte', type: 'attack',
    description: 'Deal damage and gain block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, secondaryValue: 4, tags: ['strike'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 3, chargeCorrectValue: 15, chargeWrongValue: 2,
  },
  {
    id: 'absorb', name: 'Absorb', type: 'shield',
    description: 'Gain block. On Charge Correct: also draw a card.',
    baseValue: 5, apCost: 1, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 3, chargeCorrectValue: 5, chargeWrongValue: 2,
  },
  {
    id: 'reactive_shield', name: 'Reactive Shield', type: 'shield',
    description: 'Gain block and apply Thorns for 1 turn.',
    baseValue: 4, apCost: 1, maxPerPool: 2, secondaryValue: 2, tags: ['block', 'retaliate'], launchPhase: 1, unlockLevel: 5,
    quickPlayValue: 2, chargeCorrectValue: 12, chargeWrongValue: 2,
  },
  {
    id: 'sift', name: 'Sift', type: 'utility',
    description: 'Look at top cards of your draw pile and discard some.',
    baseValue: 3, apCost: 1, maxPerPool: 2, tags: ['scry'], launchPhase: 1, unlockLevel: 3,
    quickPlayValue: 2, chargeCorrectValue: 5, chargeWrongValue: 2,
  },
  {
    id: 'scavenge', name: 'Scavenge', type: 'utility',
    description: 'Put a card from your discard pile on top of your draw pile.',
    baseValue: 1, apCost: 1, maxPerPool: 2, tags: ['recover'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },
  {
    id: 'precision_strike', name: 'Precision Strike', type: 'attack',
    description: 'CC scales with question difficulty.',
    baseValue: 8, apCost: 1, maxPerPool: 2, tags: ['strike', 'knowledge'], launchPhase: 1, unlockLevel: 4,
    quickPlayValue: 8, chargeCorrectValue: 24, chargeWrongValue: 4,
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
    quickPlayValue: 3, chargeCorrectValue: 0, chargeWrongValue: 2,
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
    baseValue: 6, apCost: 1, maxPerPool: 2, tags: ['strike', 'lifetap'], launchPhase: 1, unlockLevel: 11,
    quickPlayValue: 3, chargeCorrectValue: 18, chargeWrongValue: 2,
  },
  {
    id: 'aegis_pulse', name: 'Aegis Pulse', type: 'shield',
    description: 'Gain block. On Charge Correct: same-chain cards in hand gain +2 block.',
    baseValue: 5, apCost: 1, maxPerPool: 2, tags: ['block'], launchPhase: 1, unlockLevel: 6,
    quickPlayValue: 3, chargeCorrectValue: 5, chargeWrongValue: 2,
  },
  {
    id: 'inscription_fury', name: 'Inscription of Fury', type: 'buff',
    description: 'All attacks deal bonus damage for the rest of combat.',
    baseValue: 2, apCost: 2, maxPerPool: 1, tags: ['inscription'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 1, chargeCorrectValue: 4, chargeWrongValue: 1,
  },
  {
    id: 'inscription_iron', name: 'Inscription of Iron', type: 'buff',
    description: 'Gain block at the start of each turn for the rest of combat.',
    baseValue: 3, apCost: 2, maxPerPool: 1, tags: ['inscription'], launchPhase: 1, unlockLevel: 0,
    quickPlayValue: 2, chargeCorrectValue: 6, chargeWrongValue: 1,
  },

  // ── AR-207: Phase 2 Identity / Flagship Cards ─────────────────────────────

  // Attack — flagship quiz-reward
  {
    id: 'gambit', name: 'Gambit', type: 'attack',
    description: 'HP swing. QP: deal damage, lose HP. CC: deal damage, heal HP. CW: deal damage, lose more HP.',
    baseValue: 10, apCost: 1, maxPerPool: 1, tags: ['strike', 'risk'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4,
  },

  // Attack — chain scaling
  {
    id: 'chain_lightning', name: 'Chain Lightning', type: 'attack',
    description: 'CC: deal 8 × chain length (counts itself). Requires answering correctly.',
    baseValue: 8, apCost: 2, maxPerPool: 1, tags: ['strike'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 4, chargeCorrectValue: 8, chargeWrongValue: 3,
  },

  // Attack — forget-on-charge burst
  {
    id: 'volatile_slash', name: 'Volatile Slash', type: 'attack',
    description: 'CC: 30 dmg then FORGET this card. QP/CW: standard damage.',
    baseValue: 10, apCost: 1, maxPerPool: 2, tags: ['strike'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 5, chargeCorrectValue: 30, chargeWrongValue: 4,
  },

  // Shield — forget-on-charge burst (mirror of Volatile Slash)
  {
    id: 'burnout_shield', name: 'Burnout Shield', type: 'shield',
    description: 'CC: 24 block then FORGET this card. QP/CW: standard block.',
    baseValue: 8, apCost: 1, maxPerPool: 2, tags: ['block'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 4, chargeCorrectValue: 24, chargeWrongValue: 3,
  },

  // Shield — correct-charges scaling
  {
    id: 'knowledge_ward', name: 'Knowledge Ward', type: 'shield',
    description: 'Block scales with correct Charges.',
    baseValue: 6, apCost: 1, maxPerPool: 1, tags: ['block', 'knowledge'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 6, chargeCorrectValue: 10, chargeWrongValue: 4,
  },

  // Buff — Strength + free Charge
  {
    id: 'warcry', name: 'Warcry', type: 'buff',
    description: 'QP: +2 Str (this turn). CC: +2 Str (permanent) + next Charge free. CW: +1 Str (this turn).',
    baseValue: 2, apCost: 1, maxPerPool: 1, tags: ['buff', 'strength'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },

  // Buff — draw + lockout
  {
    id: 'battle_trance', name: 'Battle Trance', type: 'buff',
    description: 'Draw 3. CC: no restriction. QP/CW: cannot play or Charge more cards this turn.',
    baseValue: 3, apCost: 1, maxPerPool: 1, tags: ['draw', 'buff'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 2, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Debuff — charge damage percent amplifier
  {
    id: 'curse_of_doubt', name: 'Curse of Doubt', type: 'debuff',
    description: 'Enemy takes +30% damage from Charged attacks (2t). CC: +50% (3t). CW: +20% (1t).',
    baseValue: 30, apCost: 1, maxPerPool: 1, tags: ['debuff'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 20, chargeCorrectValue: 50, chargeWrongValue: 15,
  },

  // Debuff — charge damage flat amplifier
  {
    id: 'mark_of_ignorance', name: 'Mark of Ignorance', type: 'debuff',
    description: 'Enemy takes +3 flat damage from Charged attacks (2t). CC: +5 (3t). CW: +2 (1t).',
    baseValue: 3, apCost: 1, maxPerPool: 1, tags: ['debuff'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 2, chargeCorrectValue: 5, chargeWrongValue: 1,
  },

  // Debuff — 0-AP weakness
  {
    id: 'corroding_touch', name: 'Corroding Touch', type: 'debuff',
    description: '0 AP. Apply Weakness. CC: more stacks + Vulnerable. Charge costs standard +1 AP surcharge.',
    baseValue: 2, apCost: 0, maxPerPool: 2, tags: ['weakness'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Wild — choice: damage or block
  {
    id: 'phase_shift', name: 'Phase Shift', type: 'wild',
    description: 'QP/CW: CHOOSE 8 dmg OR 8 block. CC: 12 dmg AND 12 block.',
    baseValue: 8, apCost: 1, maxPerPool: 1, tags: ['choice'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 2,
  },

  // Wild — copy last card
  {
    id: 'chameleon', name: 'Chameleon', type: 'wild',
    description: 'Copy last card at 1.0×. CC: 1.3× + inherit chain type. CW: 0.7×.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['copy'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Wild — cursed fact damage
  {
    id: 'dark_knowledge', name: 'Dark Knowledge', type: 'wild',
    description: 'Deal 3 dmg per cursed fact. CC: 5/curse. CW: 1/curse.',
    baseValue: 3, apCost: 1, maxPerPool: 1, tags: ['strike'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 2, chargeCorrectValue: 5, chargeWrongValue: 1,
  },

  // Wild — chain anchor (sets next chain start to 2)
  {
    id: 'chain_anchor', name: 'Chain Anchor', type: 'wild',
    description: 'Draw 1. CC: set chain to 2 for the next chain card + draw 1. Not a chain link itself.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['chain'], launchPhase: 2, unlockLevel: 9,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Wild — flagship random/choice
  {
    id: 'unstable_flux', name: 'Unstable Flux', type: 'wild',
    description: 'QP/CW: random effect (dmg/block/draw/debuff) at 1.0×/0.7×. CC: CHOOSE at 1.5×.',
    baseValue: 10, apCost: 1, maxPerPool: 1, tags: ['random', 'choice'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 5, chargeCorrectValue: 10, chargeWrongValue: 5,
  },

  // ── AR-208: Phase 3 Advanced / Chase Cards ────────────────────────────────

  // ── Attacks (5) ──────────────────────────────────────────────────────────

  // Smite — Knowledge Aura scaling
  {
    id: 'smite', name: 'Smite', type: 'attack',
    description: 'CC scales with Knowledge Aura.',
    baseValue: 10, apCost: 2, maxPerPool: 1, tags: ['strike', 'knowledge', 'heavy'], launchPhase: 2, unlockLevel: 9,
    quickPlayValue: 10, chargeCorrectValue: 40, chargeWrongValue: 6,
  },

  // Feedback Loop — Flow State bonus / Aura crash on wrong
  {
    id: 'feedback_loop', name: 'Feedback Loop', type: 'attack',
    description: 'Flow State bonus. CW: 0 dmg + Aura crash.',
    baseValue: 5, apCost: 1, maxPerPool: 1, tags: ['strike', 'knowledge', 'risky'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 5, chargeCorrectValue: 40, chargeWrongValue: 0,
  },

  // Recall — Review Queue redemption card
  {
    id: 'recall', name: 'Recall', type: 'attack',
    description: 'CC on Review Queue fact: bonus dmg + heal.',
    baseValue: 10, apCost: 1, maxPerPool: 1, tags: ['strike', 'knowledge'], launchPhase: 2, unlockLevel: 11,
    quickPlayValue: 10, chargeCorrectValue: 30, chargeWrongValue: 6,
    chargeBonusEffect: 'review_queue_recall',
  },

  // Hemorrhage — Bleed finisher
  {
    id: 'hemorrhage', name: 'Hemorrhage', type: 'attack',
    description: 'QP: 4+(4×Bleed) dmg, consume all Bleed. CC: 4+(6×Bleed). CW: 4+(2×Bleed).',
    baseValue: 4, apCost: 2, maxPerPool: 1, tags: ['strike', 'bleed'], launchPhase: 2, unlockLevel: 7,
    quickPlayValue: 2, chargeCorrectValue: 4, chargeWrongValue: 2,
  },

  // Eruption — X-cost attack (consumes all remaining AP)
  {
    id: 'eruption', name: 'Eruption', type: 'attack',
    description: 'X-cost: consumes all remaining AP. QP: 8 dmg/AP. CC: 12 dmg/AP (surcharge first). CW: 5 dmg/AP.',
    baseValue: 8, apCost: 0, maxPerPool: 1, tags: ['strike', 'x_cost'], launchPhase: 2, unlockLevel: 12,
    quickPlayValue: 4, chargeCorrectValue: 12, chargeWrongValue: 3,
  },

  // ── Shields (3) ──────────────────────────────────────────────────────────

  // Bulwark — mega block, forgets on CC (L0: 2 AP / 9 block; L3+ no forget; L5: 1 AP)
  {
    id: 'bulwark', name: 'Bulwark', type: 'shield',
    description: 'QP: 9 block. CC: 16 block then FORGET. CW: 5 block.',
    baseValue: 9, apCost: 2, maxPerPool: 1, tags: ['block'], launchPhase: 2, unlockLevel: 9,
    quickPlayValue: 9, chargeCorrectValue: 16, chargeWrongValue: 5,
  },

  // Conversion — convert block to damage (1:1)
  {
    id: 'conversion', name: 'Shield Bash', type: 'shield',
    description: 'Deal damage equal to your block.',
    baseValue: 10, apCost: 1, maxPerPool: 1, tags: ['block'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 5, chargeCorrectValue: 15, chargeWrongValue: 3,
  },

  // Ironhide — block + Strength (temp QP, permanent CC)
  {
    id: 'ironhide', name: 'Ironhide', type: 'shield',
    description: 'QP: 6 block + 1 Str (this turn). CC: 6 block + 1 Str (permanent). CW: 4 block.',
    baseValue: 6, apCost: 2, maxPerPool: 1, tags: ['block', 'strength'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 3, chargeCorrectValue: 6, chargeWrongValue: 2,
  },

  // ── Buffs (3) ────────────────────────────────────────────────────────────

  // Frenzy — next N cards cost 0 AP
  {
    id: 'frenzy', name: 'Frenzy', type: 'buff',
    description: 'QP: next 2 cards cost 0 AP. CC: next 3. CW: next 1. Eruption X drain still fires.',
    baseValue: 2, apCost: 2, maxPerPool: 1, tags: ['buff', 'ap_free'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Mastery Surge — instant mastery level bump to 1 or 2 random hand cards
  {
    id: 'mastery_surge', name: 'Mastery Surge', type: 'buff',
    description: 'QP: +1 mastery to 1 random hand card. CC: 2 cards. CW: fizzle.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['buff', 'mastery'], launchPhase: 2, unlockLevel: 11,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 0,
  },

  // War Drum — universal hand buff
  {
    id: 'war_drum', name: 'War Drum', type: 'buff',
    description: 'QP: all hand cards gain +2 base effect this turn. CC: +4. CW: +1.',
    baseValue: 2, apCost: 1, maxPerPool: 1, tags: ['buff'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 1, chargeCorrectValue: 4, chargeWrongValue: 1,
  },

  // ── Debuffs (1) ──────────────────────────────────────────────────────────

  // Entropy — dual DoT applicator
  {
    id: 'entropy', name: 'Entropy', type: 'debuff',
    description: 'QP: 3 Burn + 2 Poison(2t). CC: 6 Burn + 4 Poison(3t). CW: 2 Burn + 1 Poison(1t).',
    baseValue: 3, apCost: 2, maxPerPool: 1, tags: ['burn', 'poison'], launchPhase: 2, unlockLevel: 9,
    quickPlayValue: 2, chargeCorrectValue: 6, chargeWrongValue: 1,
  },

  // ── Utility (6) ──────────────────────────────────────────────────────────

  // Archive — retain cards in hand past turn end
  {
    id: 'archive', name: 'Archive', type: 'utility',
    description: 'QP/CW: retain 1 card in hand at turn end. CC: retain 2 cards.',
    baseValue: 1, apCost: 1, maxPerPool: 2, tags: ['retain'], launchPhase: 2, unlockLevel: 5,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },

  // Reflex — draw card; PASSIVE: discard-from-hand gains 3 block
  {
    id: 'reflex', name: 'Reflex', type: 'utility',
    description: 'QP: draw 2. CC: draw 3. CW: draw 1. PASSIVE: when discarded from hand, gain 3 block.',
    baseValue: 2, apCost: 1, maxPerPool: 2, tags: ['draw', 'passive'], launchPhase: 2, unlockLevel: 6,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Recollect — return forgotten card(s) to discard
  {
    id: 'recollect', name: 'Recollect', type: 'utility',
    description: 'Return 1 forgotten card to discard pile. CC: return 2. Cannot target Inscriptions.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['recover'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },

  // Synapse — draw + wildcard chain link on CC
  {
    id: 'synapse', name: 'Synapse', type: 'utility',
    description: 'QP/CW: draw 2/1. CC: draw 2 + wildcard chain link (extends active chain by 1).',
    baseValue: 2, apCost: 1, maxPerPool: 1, tags: ['draw', 'chain'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 1, chargeCorrectValue: 2, chargeWrongValue: 1,
  },

  // Siphon Knowledge — draw + brief answer preview overlay (FLAGSHIP)
  {
    id: 'siphon_knowledge', name: 'Siphon Knowledge', type: 'utility',
    description: 'QP: draw 2, see answers 3s. CC: draw 3, 5s. CW: draw 1, 2s.',
    baseValue: 2, apCost: 2, maxPerPool: 1, tags: ['draw'], launchPhase: 2, unlockLevel: 13,
    quickPlayValue: 1, chargeCorrectValue: 3, chargeWrongValue: 1,
  },

  // Tutor — search draw pile for any card and add to hand
  {
    id: 'tutor', name: 'Tutor', type: 'utility',
    description: 'Search draw pile; choose a card, add to hand. CC: that card costs 0 AP this turn.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['search'], launchPhase: 2, unlockLevel: 11,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // ── Wild (4+1) ────────────────────────────────────────────────────────────

  // Sacrifice — lose HP for resources
  {
    id: 'sacrifice', name: 'Sacrifice', type: 'wild',
    description: 'Lose 5 HP. QP: draw 2 + gain 1 AP. CC: draw 3 + gain 2 AP. CW: draw 1 + gain 1 AP.',
    baseValue: 5, apCost: 0, maxPerPool: 1, tags: ['risk', 'ap_gain'], launchPhase: 2, unlockLevel: 8,
    quickPlayValue: 3, chargeCorrectValue: 5, chargeWrongValue: 3,
  },

  // Catalyst — double Poison (and on CC also Burn)
  {
    id: 'catalyst', name: 'Catalyst', type: 'wild',
    description: 'QP/CW: double enemy Poison. CC: double Poison AND Burn. L3 QP: also double Bleed.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['poison', 'burn'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Mimic — replay card from discard pile
  {
    id: 'mimic', name: 'Mimic', type: 'wild',
    description: 'QP: random discard at 0.8×. CC: choose discard at 1.0×. CW: random at 0.5×. Copies BASE values.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['copy'], launchPhase: 2, unlockLevel: 11,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Aftershock — repeat last played card at reduced power (current turn only)
  {
    id: 'aftershock', name: 'Aftershock', type: 'wild',
    description: 'QP: repeat last QP card at 0.5×. CC: repeat last CC card at 0.7× (no quiz). CW: last any at 0.3×.',
    baseValue: 1, apCost: 1, maxPerPool: 1, tags: ['copy'], launchPhase: 2, unlockLevel: 10,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 1,
  },

  // Knowledge Bomb — scales with correct Charges this encounter
  {
    id: 'knowledge_bomb', name: 'Knowledge Bomb', type: 'wild',
    description: 'QP/CW: 4 dmg flat. CC: 4 × correctChargesThisEncounter dmg (own CC counts).',
    baseValue: 4, apCost: 2, maxPerPool: 1, tags: ['strike'], launchPhase: 2, unlockLevel: 13,
    quickPlayValue: 2, chargeCorrectValue: 4, chargeWrongValue: 2,
  },

  // ── Inscription (1) ───────────────────────────────────────────────────────

  // Inscription of Wisdom — persistent draw/heal bonus per CC (CW = complete fizzle)
  {
    id: 'inscription_wisdom', name: 'Inscription of Wisdom', type: 'buff',
    description: 'Forgets on play. QP: each future CC draws 1 extra. CC: draw 1 extra + heal 1 HP. CW: FIZZLE.',
    baseValue: 1, apCost: 2, maxPerPool: 1, tags: ['inscription'], launchPhase: 2, unlockLevel: 1,
    quickPlayValue: 1, chargeCorrectValue: 1, chargeWrongValue: 0,
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
