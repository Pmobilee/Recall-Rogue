/**
 * Consumable tool definitions. (DD-V2-064)
 */
export type ConsumableId = 'bomb' | 'flare' | 'shield_charge' | 'drill_charge' | 'sonar_pulse'

export interface ConsumableDefinition {
  id: ConsumableId
  label: string
  description: string
  /** Max copies of this specific consumable per dive */
  maxStack: number
}

export const CONSUMABLE_DEFS: Record<ConsumableId, ConsumableDefinition> = {
  bomb: {
    id: 'bomb',
    label: 'Bomb',
    description: 'Instantly mines a 3×3 area.',
    maxStack: 3,
  },
  flare: {
    id: 'flare',
    label: 'Flare',
    description: 'Reveals the 7×7 area around you.',
    maxStack: 3,
  },
  shield_charge: {
    id: 'shield_charge',
    label: 'Shield',
    description: 'Absorbs the next hazard hit.',
    maxStack: 2,
  },
  drill_charge: {
    id: 'drill_charge',
    label: 'Drill',
    description: 'Mines 5 blocks in a line.',
    maxStack: 3,
  },
  sonar_pulse: {
    id: 'sonar_pulse',
    label: 'Sonar',
    description: 'Reveals minerals within 10 tiles.',
    maxStack: 2,
  },
}

/** Total consumable slots across all types */
export const CONSUMABLE_CARRY_LIMIT = 5

/** All consumable IDs for random drops */
export const ALL_CONSUMABLE_IDS: ConsumableId[] = ['bomb', 'flare', 'shield_charge', 'drill_charge', 'sonar_pulse']
