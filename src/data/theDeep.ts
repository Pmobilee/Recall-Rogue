import type { Biome } from './biomes'
import { BlockType } from './types'

/**
 * "The Deep" secret biome — accessible only after defeating all 4 landmark bosses
 * in a single dive. A terminal zone with no further descent shaft. (DD-V2-025)
 */
export const THE_DEEP_BIOME: Biome = {
  id: 'void_pocket',  // Reuses closest visual tier; biome label identifies it in UI
  label: 'The Deep',
  name: 'The Deep',
  tier: 'anomaly',
  layerRange: [21, 25],
  anomalyChance: 1.0,
  description: 'A realm beyond the known strata. The laws of geology no longer apply.',
  gaiaEntryComment: 'GAIA: "Pilot... these readings are impossible. We should not be this deep. Proceed with extreme caution."',
  ambientColor: 0x0a0015,
  bgColor: 0x0a0015,
  fogTint: 0x050008,
  fogPalette: {
    hidden:        0x000000,
    ring1:         0x220033,
    ring2:         0x110022,
    ring1DimAlpha: 0.75,
    ring2DimAlpha: 0.40,
  },
  blockColorOverrides: {
    [BlockType.HardRock]: 0x1a0035,
    [BlockType.Stone]: 0x150028,
    [BlockType.Empty]: 0x0a0015,
  },
  blockWeights: {
    dirt: 0.1,
    softRock: 0.2,
    stone: 0.8,
    hardRock: 2.0,
  },
  hazardMultipliers: { lava: 2.5, gas: 2.5, unstable: 2.0 },
  hazardWeights: {
    lavaBlockDensity: 2.5,
    gasPocketDensity: 2.5,
    unstableGroundChance: 2.0,
  },
  mineralMultiplier: 3.0,
  mineralWeights: {
    dustMultiplier: 0.5,
    shardMultiplier: 0.5,
    crystalMultiplier: 1.5,
    geodeMultiplier: 3.0,
    essenceMultiplier: 5.0,
    rareNodeBonus: 0.4,
  },
  tileTheme: 'deep',
  structuralFeatures: ['void_spires', 'reality_tears'],
  palette: {
    dominant: 0x110022,
    accent: 0xaa00ff,
    highlight: 0xff00ff,
  },
  visualTier: 3,
  spritePrefix: 'deep',
  isAnomaly: true,
  depthAesthetic: {
    colorTemperature: 'void',
    shapeLanguage: 'alien',
    brightnessRange: [0.05, 0.35],
    glowLevel: 'heavy',
  },
}

/** Rewards exclusive to "The Deep". */
export const THE_DEEP_REWARDS = {
  essenceDropMin: 5,
  essenceDropMax: 15,
  uniqueRelicId: 'relic_deep_core',
  uniqueCosmeticId: 'cosmetic_void_pickaxe',
  companionXpMultiplier: 3.0,
  titleUnlockId: 'title_abyss_walker',
} as const
