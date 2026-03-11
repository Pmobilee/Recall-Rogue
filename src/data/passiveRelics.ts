import type { CardType } from './card-types';

export type RelicCategory = 'offensive' | 'defensive' | 'sustain' | 'tactical';

export type RelicTrigger =
  | 'on_attack'
  | 'on_multi_hit'
  | 'on_kill'
  | 'on_encounter_start'
  | 'on_block'
  | 'on_turn_end'
  | 'on_damage_taken'
  | 'on_parry'
  | 'on_lethal'
  | 'on_overheal'
  | 'permanent'
  | 'on_perfect_turn'
  | 'on_echo_play'
  | 'on_card_skip';

export interface PassiveRelicDefinition {
  id: string;
  name: string;
  description: string;
  category: RelicCategory;
  graduationType: CardType[];
  trigger: RelicTrigger;
  value: number;
  valueUnit: string;
  maxPerRun: number;
}

export interface ActiveRelic {
  definition: PassiveRelicDefinition;
  sourceFactId: string;
  isDormant: boolean;
  activatedThisEncounter: boolean;
  masteredAt: number;
}

export const PASSIVE_RELIC_DEFINITIONS: PassiveRelicDefinition[] = [
  // Offensive
  { id: 'first_blood', name: 'First Blood', description: 'First attack each encounter deals +50% damage', category: 'offensive', graduationType: ['attack'], trigger: 'on_attack', value: 50, valueUnit: '%', maxPerRun: 1 },
  { id: 'chain_lightning', name: 'Chain Lightning', description: 'Multi-hit attacks get +1 extra hit', category: 'offensive', graduationType: ['attack'], trigger: 'on_multi_hit', value: 1, valueUnit: 'hits', maxPerRun: 1 },
  { id: 'glass_cannon', name: 'Glass Cannon', description: 'All attacks +25% damage, take +10% more damage', category: 'offensive', graduationType: ['attack'], trigger: 'on_attack', value: 25, valueUnit: '%', maxPerRun: 1 },
  { id: 'bloodlust', name: 'Bloodlust', description: 'Killing an enemy heals 5 HP', category: 'offensive', graduationType: ['attack'], trigger: 'on_kill', value: 5, valueUnit: 'HP', maxPerRun: 1 },
  { id: 'sharpened_edge', name: 'Sharpened Edge', description: 'All Strike mechanics +3 base damage', category: 'offensive', graduationType: ['attack'], trigger: 'on_attack', value: 3, valueUnit: 'dmg', maxPerRun: 1 },

  // Defensive
  { id: 'iron_skin', name: 'Iron Skin', description: 'Start each encounter with 4 block', category: 'defensive', graduationType: ['shield'], trigger: 'on_encounter_start', value: 4, valueUnit: 'block', maxPerRun: 1 },
  { id: 'retaliation', name: 'Retaliation', description: 'Blocking an attack deals 2 damage back', category: 'defensive', graduationType: ['shield'], trigger: 'on_block', value: 2, valueUnit: 'dmg', maxPerRun: 1 },
  { id: 'fortress', name: 'Fortress', description: 'Block carries between turns (no reset)', category: 'defensive', graduationType: ['shield'], trigger: 'on_turn_end', value: 1, valueUnit: 'flag', maxPerRun: 1 },
  { id: 'last_stand', name: 'Last Stand', description: 'Below 20% HP, all block doubled', category: 'defensive', graduationType: ['shield'], trigger: 'on_damage_taken', value: 20, valueUnit: '% threshold', maxPerRun: 1 },
  { id: 'aegis', name: 'Aegis', description: 'Parry always triggers draw bonus regardless of enemy action', category: 'defensive', graduationType: ['shield'], trigger: 'on_parry', value: 1, valueUnit: 'flag', maxPerRun: 1 },

  // Sustain
  { id: 'second_wind', name: 'Second Wind', description: 'Once/encounter: survive killing blow at 1 HP', category: 'sustain', graduationType: ['shield', 'utility'], trigger: 'on_lethal', value: 1, valueUnit: 'HP', maxPerRun: 1 },
  { id: 'natural_recovery', name: 'Natural Recovery', description: 'Gain 2 block at encounter start', category: 'sustain', graduationType: ['shield', 'utility'], trigger: 'on_encounter_start', value: 2, valueUnit: 'block', maxPerRun: 1 },
  { id: 'overgrowth', name: 'Overgrowth', description: 'Excess block carries to next turn', category: 'sustain', graduationType: ['shield', 'utility'], trigger: 'on_overheal', value: 1, valueUnit: 'flag', maxPerRun: 1 },
  { id: 'vitality', name: 'Vitality', description: 'Max HP permanently +5', category: 'sustain', graduationType: ['shield', 'utility'], trigger: 'permanent', value: 5, valueUnit: 'HP', maxPerRun: 3 },

  // Tactical
  { id: 'combo_master', name: 'Combo Master', description: 'Combo starts at 1.15x instead of 1.0x', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent', value: 1, valueUnit: 'flag', maxPerRun: 1 },
  { id: 'quick_draw', name: 'Quick Draw', description: 'Draw 6 cards instead of 5', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent', value: 6, valueUnit: 'cards', maxPerRun: 1 },
  { id: 'momentum', name: 'Momentum', description: 'Perfect turn (3/3 correct) grants +1 AP next turn', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_perfect_turn', value: 1, valueUnit: 'AP', maxPerRun: 1 },
  { id: 'scholars_focus', name: "Scholar's Focus", description: 'Speed bonus threshold 30% instead of 25%', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent', value: 30, valueUnit: '% threshold', maxPerRun: 1 },
  { id: 'echo_chamber', name: 'Echo Chamber', description: 'Echo cards deal full power (not 0.7x)', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_echo_play', value: 1, valueUnit: 'flag', maxPerRun: 1 },
  { id: 'scavenger', name: 'Scavenger', description: '+1 currency per encounter for each skipped card', category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_card_skip', value: 1, valueUnit: 'currency', maxPerRun: 1 },
];

export const PASSIVE_RELIC_BY_ID: Record<string, PassiveRelicDefinition> = Object.fromEntries(
  PASSIVE_RELIC_DEFINITIONS.map((relic) => [relic.id, relic]),
);

