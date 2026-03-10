/** Relic rarity tiers — determines unlock cost and acquisition weights. */
export type RelicRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Relic functional categories. */
export type RelicCategory =
  | 'offensive'
  | 'defensive'
  | 'sustain'
  | 'tactical'
  | 'knowledge'
  | 'economy'
  | 'cursed';

/** When a relic's effect fires. */
export type RelicTrigger =
  | 'permanent'
  | 'on_encounter_start'
  | 'on_turn_start'
  | 'on_turn_end'
  | 'on_attack'
  | 'on_block'
  | 'on_kill'
  | 'on_damage_taken'
  | 'on_lethal'
  | 'on_correct_answer'
  | 'on_wrong_answer'
  | 'on_speed_bonus'
  | 'on_perfect_turn'
  | 'on_card_play'
  | 'on_echo_play'
  | 'on_card_skip'
  | 'on_multi_hit'
  | 'on_run_start'
  | 'on_floor_advance'
  | 'on_boss_kill'
  | 'on_parry'
  | 'on_overheal'
  | 'on_encounter_end';

/** A single mechanical effect within a relic. */
export interface RelicEffect {
  /** Machine-readable key used by the effect resolver. */
  effectId: string;
  /** Human-readable description of this effect. */
  description: string;
  /** Primary numeric magnitude (interpretation depends on effectId). */
  value: number;
  /** Optional secondary value (threshold, duration, etc.). */
  secondaryValue?: number;
}

/** Static definition of a relic — never mutated at runtime. */
export interface RelicDefinition {
  /** Unique identifier (snake_case). */
  id: string;
  /** Display name. */
  name: string;
  /** Concise mechanical description shown in UI. */
  description: string;
  /** Lore/flavor text shown in detail view. */
  flavorText: string;
  /** Rarity tier. */
  rarity: RelicRarity;
  /** Functional category for filtering. */
  category: RelicCategory;
  /** When this relic's effect fires. */
  trigger: RelicTrigger;
  /** One or more effects this relic provides. */
  effects: RelicEffect[];
  /** Emoji icon (sprite key in future). */
  icon: string;
  /** RPG pixel-art visual description for sprite generation. */
  visualDescription: string;
  /** Mastery Coins required to unlock (0 = free starter). */
  unlockCost: number;
  /** True for the 25 relics available to all players from the start. */
  isStarter: boolean;
  /** For cursed relics: describes the downside. */
  curseDescription?: string;
}

/** Runtime state of a relic collected during a run. */
export interface RunRelic {
  /** ID of the RelicDefinition. */
  definitionId: string;
  /** Floor number when this relic was acquired. */
  acquiredAtFloor: number;
  /** Encounter number when acquired. */
  acquiredAtEncounter: number;
  /** How many times this relic has triggered during the run. */
  triggerCount: number;
}
