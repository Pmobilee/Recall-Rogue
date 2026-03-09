/**
 * Companion affinities determine the primary buff category. (DD-V2-067)
 */
export type CompanionAffinity = 'mining' | 'scouting' | 'healing' | 'learning' | 'defense'

/**
 * A single evolution stage of a companion.
 */
export interface CompanionEvolutionStage {
  /** Stage index: 0 = base, 1 = evolved, 2 = apex, 3 = legendary. */
  stage: number
  /** Display name for this stage. */
  stageName: string
  /** Shards required to reach this stage (from previous stage). 0 for base. */
  shardsRequired: number
  /** Total mastered facts required to unlock this evolution option. */
  masteredFactsRequired: number
  /** Minimum Dust Cat happiness required to unlock this stage. Undefined = no requirement. */
  dustCatHappinessRequired?: number
  /** Affinity magnitude at this stage. */
  affinityMagnitude: number
  /** Optional secondary effect at evolved/apex stage. */
  secondaryEffect?: { effectId: string; magnitude: number; description: string }
  spriteKey: string
}

/**
 * Full definition of a companion character.
 */
export interface CompanionDefinition {
  id: string
  name: string
  species: string
  description: string
  affinity: CompanionAffinity
  /** Maps affinity to the effectId it modifies. */
  effectId: string
  /** All four evolution stages (index 0-3). Index 3 is the Legendary stage. */
  evolutionPath: [
    CompanionEvolutionStage,
    CompanionEvolutionStage,
    CompanionEvolutionStage,
    CompanionEvolutionStage,
  ]
  /** Flavor lore. */
  lore: string
}

/**
 * Runtime companion state (stored per player, persisted between runs).
 */
export interface CompanionState {
  companionId: string
  /** Current evolution stage (0-2). */
  currentStage: number
  /** Whether this companion is permanently unlocked. */
  unlocked: boolean
}

export const COMPANION_CATALOGUE: CompanionDefinition[] = [
  {
    id: 'comp_borebot',
    name: 'Borebot',
    species: 'Drill Automaton',
    description: 'A compact drilling bot that amplifies your pickaxe strikes.',
    affinity: 'mining',
    effectId: 'blockDamage',
    lore: 'Originally built for asteroid mining. Ended up somewhere much weirder.',
    evolutionPath: [
      { stage: 0, stageName: 'Basic', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 0.10, spriteKey: 'comp_borebot_0' },
      { stage: 1, stageName: 'Upgraded', shardsRequired: 50, masteredFactsRequired: 25, affinityMagnitude: 0.25, secondaryEffect: { effectId: 'critChance', magnitude: 0.05, description: '+5% crit chance' }, spriteKey: 'comp_borebot_1' },
      { stage: 2, stageName: 'Apex Drill', shardsRequired: 150, masteredFactsRequired: 100, affinityMagnitude: 0.45, secondaryEffect: { effectId: 'aoeMinePeriod', magnitude: 20, description: 'AoE mine every 20th block' }, spriteKey: 'comp_borebot_2' },
      { stage: 3, stageName: 'Legendary Drill', shardsRequired: 400, masteredFactsRequired: 300, dustCatHappinessRequired: 70, affinityMagnitude: 0.70, secondaryEffect: { effectId: 'chainMine', magnitude: 3, description: 'Chain mine: breaking one block has 20% chance to break up to 3 adjacent blocks' }, spriteKey: 'comp_borebot_3' },
    ],
  },
  {
    id: 'comp_lumis',
    name: 'Lumis',
    species: 'Bioluminescent Floater',
    description: 'Floats ahead of you, illuminating tunnels before you enter them.',
    affinity: 'scouting',
    effectId: 'revealRadius',
    lore: 'Found clinging to a geode in the deep. Seems happy here.',
    evolutionPath: [
      { stage: 0, stageName: 'Dim', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 1, spriteKey: 'comp_lumis_0' },
      { stage: 1, stageName: 'Bright', shardsRequired: 40, masteredFactsRequired: 20, affinityMagnitude: 2, secondaryEffect: { effectId: 'revealShaftOnEntry', magnitude: 1, description: 'Shaft visible from entry' }, spriteKey: 'comp_lumis_1' },
      { stage: 2, stageName: 'Blazing', shardsRequired: 120, masteredFactsRequired: 80, affinityMagnitude: 4, secondaryEffect: { effectId: 'sonarPulsePassive', magnitude: 1, description: 'Passive sonar pulse every 15 ticks' }, spriteKey: 'comp_lumis_2' },
      { stage: 3, stageName: 'Celestial Blazing', shardsRequired: 350, masteredFactsRequired: 300, dustCatHappinessRequired: 70, affinityMagnitude: 6, secondaryEffect: { effectId: 'revealArtifactNodes', magnitude: 1, description: 'Reveal all artifact nodes on layer entry' }, spriteKey: 'comp_lumis_3' },
    ],
  },
  {
    id: 'comp_medi',
    name: 'Medikit Mk. II',
    species: 'Medical Drone',
    description: 'Hovers at your shoulder, trickling O2 back into your suit.',
    affinity: 'healing',
    effectId: 'o2RegenPerTicks',
    lore: 'The voice module burned out. Now it just beeps affectionately.',
    evolutionPath: [
      { stage: 0, stageName: 'Standard', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 8, spriteKey: 'comp_medi_0' },
      { stage: 1, stageName: 'Enhanced', shardsRequired: 60, masteredFactsRequired: 30, affinityMagnitude: 5, secondaryEffect: { effectId: 'o2CostAll', magnitude: -0.05, description: '-5% all O2 costs' }, spriteKey: 'comp_medi_1' },
      { stage: 2, stageName: 'Apex Care', shardsRequired: 180, masteredFactsRequired: 120, affinityMagnitude: 3, secondaryEffect: { effectId: 'deathRevive', magnitude: 0.5, description: 'On death, revive at 50% O2 (once per run)' }, spriteKey: 'comp_medi_2' },
      { stage: 3, stageName: 'Apex Regeneration', shardsRequired: 450, masteredFactsRequired: 300, dustCatHappinessRequired: 70, affinityMagnitude: 2, secondaryEffect: { effectId: 'deathReviveTwice', magnitude: 2, description: 'Revive twice per run (not once)' }, spriteKey: 'comp_medi_3' },
    ],
  },
  {
    id: 'comp_archivist',
    name: 'The Archivist',
    species: 'Data Specter',
    description: 'A ghostly archive fragment. Rewards knowledge with oxygen.',
    affinity: 'learning',
    effectId: 'quizO2Reward',
    lore: 'Technically a corrupted museum AI. It considers your field scans "primary research."',
    evolutionPath: [
      { stage: 0, stageName: 'Fragment', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 3, spriteKey: 'comp_archivist_0' },
      { stage: 1, stageName: 'Restored', shardsRequired: 45, masteredFactsRequired: 35, affinityMagnitude: 8, secondaryEffect: { effectId: 'quizCooldownReduction', magnitude: -0.15, description: '-15% scan cooldown' }, spriteKey: 'comp_archivist_1' },
      { stage: 2, stageName: 'Omniscient', shardsRequired: 140, masteredFactsRequired: 150, affinityMagnitude: 15, secondaryEffect: { effectId: 'suppressQuizO2Penalty', magnitude: 1, description: 'Missed scans cost no extra O2' }, spriteKey: 'comp_archivist_2' },
      { stage: 3, stageName: 'Omniscient Scholar', shardsRequired: 400, masteredFactsRequired: 300, dustCatHappinessRequired: 70, affinityMagnitude: 22, secondaryEffect: { effectId: 'quizCorrectO2Restore', magnitude: 5, description: 'Quiz correct always restores 5 extra O2' }, spriteKey: 'comp_archivist_3' },
    ],
  },
  {
    id: 'comp_carapace',
    name: 'Carapace',
    species: 'Armored Symbiont',
    description: 'Attaches to your suit, distributing impact forces.',
    affinity: 'defense',
    effectId: 'damageReduction',
    lore: 'Evolved to survive exactly what you keep walking into.',
    evolutionPath: [
      { stage: 0, stageName: 'Juvenile', shardsRequired: 0, masteredFactsRequired: 0, affinityMagnitude: 0.08, spriteKey: 'comp_carapace_0' },
      { stage: 1, stageName: 'Mature', shardsRequired: 55, masteredFactsRequired: 28, affinityMagnitude: 0.20, secondaryEffect: { effectId: 'lethalAbsorb', magnitude: 1, description: 'Absorb one lethal hit per layer' }, spriteKey: 'comp_carapace_1' },
      { stage: 2, stageName: 'Elder Shell', shardsRequired: 165, masteredFactsRequired: 110, affinityMagnitude: 0.35, secondaryEffect: { effectId: 'hazardQuizFullNegation', magnitude: 1, description: 'Correct quiz negates full hazard damage' }, spriteKey: 'comp_carapace_2' },
      { stage: 3, stageName: 'Ancient Elder', shardsRequired: 500, masteredFactsRequired: 300, dustCatHappinessRequired: 70, affinityMagnitude: 0.50, secondaryEffect: { effectId: 'lethalAbsorbTwicePlusHazardNegation', magnitude: 2, description: 'Absorb two lethal hits per layer + hazard quiz negation' }, spriteKey: 'comp_carapace_3' },
    ],
  },
]
