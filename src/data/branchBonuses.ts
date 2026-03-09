/** Branch gameplay bonuses — awarded when a knowledge branch reaches completion thresholds. */
export interface BranchBonus {
  id: string
  category: string
  threshold: number
  bonusType: 'oxygen_efficiency' | 'artifact_rarity' | 'scanner_range' | 'loot_magnet' | 'quiz_streak' | 'dust_drop'
  bonusValue: number
  displayName: string
  description: string
}

/** First-tier bonuses (25% branch completion). One per top-level category. */
export const BRANCH_BONUSES_25: BranchBonus[] = [
  {
    id: 'natural_sciences_25',
    category: 'Natural Sciences',
    threshold: 25,
    bonusType: 'oxygen_efficiency',
    bonusValue: 0.05,
    displayName: "Naturalist's Breath",
    description: "Dungeon gear uses 5% less energy — you understand how to work with the planet's rhythms.",
  },
  {
    id: 'history_25',
    category: 'History',
    threshold: 25,
    bonusType: 'artifact_rarity',
    bonusValue: 0.02,
    displayName: "Archaeologist's Eye",
    description: 'Artifact reveal rarity rolls gain +2% — you know what to look for.',
  },
  {
    id: 'technology_25',
    category: 'Technology',
    threshold: 25,
    bonusType: 'scanner_range',
    bonusValue: 1,
    displayName: 'Tech Sense',
    description: 'Scanner range extended by 1 tile — you understand the machines.',
  },
  {
    id: 'life_sciences_25',
    category: 'Life Sciences',
    threshold: 25,
    bonusType: 'loot_magnet',
    bonusValue: 1,
    displayName: 'Living World Bond',
    description: "Loot within 1 extra tile is auto-collected — you feel the earth's pulse.",
  },
  {
    id: 'geography_25',
    category: 'Geography',
    threshold: 25,
    bonusType: 'scanner_range',
    bonusValue: 1,
    displayName: "Cartographer's Instinct",
    description: 'Fog of war reveals 1 extra tile radius — you read terrain naturally.',
  },
  {
    id: 'language_25',
    category: 'Language',
    threshold: 25,
    bonusType: 'quiz_streak',
    bonusValue: 0.10,
    displayName: 'Wordsmith',
    description: 'Quiz streak multiplier cap increased by 10% — precise thought yields precise answers.',
  },
  {
    id: 'culture_25',
    category: 'Culture',
    threshold: 25,
    bonusType: 'dust_drop',
    bonusValue: 0.05,
    displayName: 'Cultural Lens',
    description: 'Loot drop rate increased by 5% — cultural knowledge reveals hidden value.',
  },
]

/** All branch bonuses combined (currently only 25% tier). */
export const ALL_BRANCH_BONUSES: BranchBonus[] = [...BRANCH_BONUSES_25]
