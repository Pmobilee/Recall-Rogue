import { BlockType } from './types'
import type { BiomePalette, FogPalette } from './palette'
import { fogPaletteFromAmbient } from './palette'
// biomeStructures.ts archived — inline empty lookup
const BIOME_STRUCTURAL_FEATURES: Record<string, string[]> = {}

// ─── Tier and ID types ────────────────────────────────────────────────────────

/** Depth tier that determines which layers a biome can appear in. */
export type BiomeTier = 'shallow' | 'mid' | 'deep' | 'extreme' | 'anomaly'

/** All valid biome identifiers. */
export type BiomeId =
  | 'limestone_caves' | 'clay_basin' | 'iron_seam' | 'root_tangle' | 'peat_bog'
  | 'basalt_maze' | 'salt_flats' | 'coal_veins' | 'granite_canyon' | 'sulfur_springs'
  | 'obsidian_rift' | 'magma_shelf' | 'crystal_geode' | 'fossil_layer' | 'quartz_halls'
  | 'primordial_mantle' | 'iron_core_fringe' | 'pressure_dome' | 'deep_biolume' | 'tectonic_scar'
  | 'temporal_rift' | 'alien_intrusion' | 'bioluminescent' | 'void_pocket' | 'echo_chamber'

// ─── Hazard and mineral weight sub-types ─────────────────────────────────────

/** Per-biome hazard density configuration. */
export interface BiomeHazardWeights {
  /** Multiplier applied to BALANCE.LAVA_DENSITY */
  lavaBlockDensity: number
  /** Multiplier applied to BALANCE.GAS_POCKET_DENSITY */
  gasPocketDensity: number
  /** Multiplier applied to BALANCE.UNSTABLE_GROUND_DENSITY */
  unstableGroundChance: number
}

/** Per-biome mineral rarity and quantity modifiers. */
export interface BiomeMineralWeights {
  dustMultiplier: number
  shardMultiplier: number
  crystalMultiplier: number
  geodeMultiplier: number
  essenceMultiplier: number
  /** Bonus probability of spawning a rare mineral node */
  rareNodeBonus: number
}

// ─── Unified Biome interface ──────────────────────────────────────────────────

/**
 * Full biome descriptor. Contains both the new Phase 8.7 fields and backward-compatible
 * aliases used by existing consumers (MineGenerator, MineScene, ParticleSystem).
 */
export interface Biome {
  /** Unique biome identifier */
  id: BiomeId
  /** Display label shown in HUD (primary field) */
  label: string
  /** Alias for label — kept for backward compatibility with all consumers */
  name: string
  /** Depth tier that governs when this biome can appear */
  tier: BiomeTier
  /** Inclusive [min, max] layer range (1-indexed) where this biome can occur */
  layerRange: [number, number]
  /** For anomaly biomes: independent per-layer chance of overriding the tier biome */
  anomalyChance?: number
  /** Short description shown in GAIA toast on biome entry */
  description: string
  /** GAIA commentary on entering this biome (DD-V2-057) */
  gaiaEntryComment: string
  /** Primary ambient background color for empty cells (new primary field) */
  ambientColor: number
  /** Alias for ambientColor — kept for backward compatibility with MineScene */
  bgColor: number
  /** Color overrides per block type — merged with BLOCK_COLORS in MineScene */
  blockColorOverrides: Partial<Record<BlockType, number>>
  /** Multipliers for block distribution weights (used by MineGenerator.getDepthWeights) */
  blockWeights: {
    dirt: number
    softRock: number
    stone: number
    hardRock: number
  }
  /** Hazard density multipliers — maps to the new hazardWeights for backward compat */
  hazardMultipliers: {
    lava: number
    gas: number
    unstable: number
  }
  /** New-style named hazard weights (DD-V2-073) */
  hazardWeights: BiomeHazardWeights
  /** Overall mineral node count multiplier (legacy compat — max of all mineral weights) */
  mineralMultiplier: number
  /** Per-mineral-tier multipliers (DD-V2-074) */
  mineralWeights: BiomeMineralWeights
  /** Fog tint applied to unexplored/hidden cells */
  fogTint: number
  /** Full fog-of-war palette — drives Ring-1 and Ring-2 scanner tints. (Phase 33.4) */
  fogPalette: FogPalette
  /** Tile theme key for Phase 9 per-biome tile sets */
  tileTheme: string
  /** Biome-specific structural features for procedural generation (Phase 9.4) */
  structuralFeatures: string[]
  /** Per-biome palette for visual consistency (Phase 9.9) */
  palette: BiomePalette
  /** Visual production tier: 1=hero, 2=distinct, 3=palette-swap (Phase 9.8) */
  visualTier: 1 | 2 | 3
  /** Sprite prefix for per-biome tile loading (Phase 9.3) */
  spritePrefix: string
  /** Whether this biome is an anomaly that can override any depth tier (Phase 9.7) */
  isAnomaly: boolean
  /** Depth aesthetic metadata for ComfyUI prompt generation (Phase 9.11) */
  depthAesthetic: {
    colorTemperature: 'warm' | 'neutral' | 'cool' | 'cold' | 'void'
    shapeLanguage: 'organic' | 'structured' | 'jagged' | 'alien'
    brightnessRange: [number, number]
    glowLevel: 'none' | 'subtle' | 'moderate' | 'heavy'
  }
}

/** Alias for Biome — used in phase doc spec references. */
export type BiomeDefinition = Biome

// ─── Helper: derive compatible fields from primary fields ─────────────────────

/**
 * Returns block weights tuned to the given tier.
 * Shallow biomes have more dirt; extreme biomes have more hardRock.
 */
function blockWeightsForTier(tier: BiomeTier): Biome['blockWeights'] {
  switch (tier) {
    case 'shallow':  return { dirt: 1.4, softRock: 1.1, stone: 0.8, hardRock: 0.2 }
    case 'mid':      return { dirt: 0.9, softRock: 1.0, stone: 1.2, hardRock: 0.6 }
    case 'deep':     return { dirt: 0.4, softRock: 0.8, stone: 1.3, hardRock: 1.0 }
    case 'extreme':  return { dirt: 0.1, softRock: 0.4, stone: 1.1, hardRock: 1.8 }
    case 'anomaly':  return { dirt: 0.8, softRock: 0.8, stone: 1.0, hardRock: 1.0 }
  }
}

/**
 * Lightens a hex color by a given factor (0.0 = original, 1.0 = white).
 * Used for deriving accent and highlight from the dominant color.
 */
function lightenColor(color: number, factor: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const lr = Math.min(255, Math.round(r + (255 - r) * factor))
  const lg = Math.min(255, Math.round(g + (255 - g) * factor))
  const lb = Math.min(255, Math.round(b + (255 - b) * factor))
  return (lr << 16) | (lg << 8) | lb
}

/**
 * Derives a BiomePalette from the ambient color.
 * dominant = ambientColor, accent = lighten 30%, highlight = lighten 60%.
 */
function paletteFromColor(ambientColor: number): BiomePalette {
  return {
    dominant: ambientColor,
    accent: lightenColor(ambientColor, 0.3),
    highlight: lightenColor(ambientColor, 0.6),
  }
}

/** Returns the default visual tier for a given biome tier. */
function visualTierForBiomeTier(tier: BiomeTier): 1 | 2 | 3 {
  switch (tier) {
    case 'shallow':  return 1
    case 'mid':      return 2
    case 'deep':     return 2
    case 'extreme':  return 3
    case 'anomaly':  return 3
  }
}

/** Returns depth aesthetic metadata derived from the biome tier. */
function depthAestheticForTier(tier: BiomeTier): Biome['depthAesthetic'] {
  switch (tier) {
    case 'shallow':
      return { colorTemperature: 'neutral', shapeLanguage: 'organic', brightnessRange: [0.5, 0.8], glowLevel: 'none' }
    case 'mid':
      return { colorTemperature: 'cool', shapeLanguage: 'structured', brightnessRange: [0.3, 0.6], glowLevel: 'subtle' }
    case 'deep':
      return { colorTemperature: 'cold', shapeLanguage: 'jagged', brightnessRange: [0.2, 0.5], glowLevel: 'moderate' }
    case 'extreme':
      return { colorTemperature: 'warm', shapeLanguage: 'jagged', brightnessRange: [0.1, 0.4], glowLevel: 'heavy' }
    case 'anomaly':
      return { colorTemperature: 'void', shapeLanguage: 'alien', brightnessRange: [0.1, 0.7], glowLevel: 'heavy' }
  }
}

/** Darkens a hex color by ~30% to produce a fog tint. */
function darkenColor(color: number): number {
  const r = ((color >> 16) & 0xff)
  const g = ((color >> 8)  & 0xff)
  const b = ((color)       & 0xff)
  return ((Math.floor(r * 0.55) << 16) | (Math.floor(g * 0.55) << 8) | Math.floor(b * 0.55))
}

interface BiomeInput {
  id: BiomeId
  label: string
  tier: BiomeTier
  layerRange: [number, number]
  anomalyChance?: number
  gaiaEntryComment: string
  ambientColor: number
  hazardWeights: BiomeHazardWeights
  mineralWeights: BiomeMineralWeights
  tileTheme: string
  /** Override blockColorOverrides — defaults to {} */
  blockColorOverrides?: Partial<Record<BlockType, number>>
  /** Override blockWeights — defaults to tier-derived weights */
  blockWeights?: Biome['blockWeights']
  structuralFeatures?: string[]
  palette?: BiomePalette
  visualTier?: 1 | 2 | 3
  spritePrefix?: string
}

/**
 * Constructs a full Biome object from a compact spec, filling in all
 * derived backward-compatibility fields automatically.
 */
function makeBiome(input: BiomeInput): Biome {
  const { hazardWeights, mineralWeights, ambientColor } = input
  const bw = input.blockWeights ?? blockWeightsForTier(input.tier)
  const maxMineral = Math.max(
    mineralWeights.dustMultiplier,
    mineralWeights.shardMultiplier,
    mineralWeights.crystalMultiplier,
    mineralWeights.geodeMultiplier,
    mineralWeights.essenceMultiplier,
    mineralWeights.rareNodeBonus,
    0.1,  // floor so mineralMultiplier is never 0
  )
  return {
    id: input.id,
    label: input.label,
    name: input.label,   // backward compat alias
    tier: input.tier,
    layerRange: input.layerRange,
    ...(input.anomalyChance !== undefined ? { anomalyChance: input.anomalyChance } : {}),
    description: input.gaiaEntryComment.split('.')[0] + '.',
    gaiaEntryComment: input.gaiaEntryComment,
    ambientColor,
    bgColor: ambientColor,  // backward compat alias
    blockColorOverrides: input.blockColorOverrides ?? {},
    blockWeights: bw,
    hazardMultipliers: {
      lava:     hazardWeights.lavaBlockDensity,
      gas:      hazardWeights.gasPocketDensity,
      unstable: hazardWeights.unstableGroundChance,
    },
    hazardWeights,
    mineralMultiplier: maxMineral,
    mineralWeights,
    fogTint: darkenColor(ambientColor) || 0x0a0a14,
    fogPalette: fogPaletteFromAmbient(ambientColor),
    tileTheme: input.tileTheme,
    structuralFeatures: input.structuralFeatures ?? BIOME_STRUCTURAL_FEATURES[input.id] ?? [],
    palette: input.palette ?? paletteFromColor(ambientColor),
    visualTier: input.visualTier ?? visualTierForBiomeTier(input.tier),
    spritePrefix: input.spritePrefix ?? ('biome_' + input.id),
    isAnomaly: input.tier === 'anomaly',
    depthAesthetic: depthAestheticForTier(input.tier),
  }
}

// ─── 25 Biome definitions ─────────────────────────────────────────────────────

/** All 25 biomes, organised by tier. */
export const ALL_BIOMES: Biome[] = [

  // ── Shallow (L1-5) ────────────────────────────────────────────────────────

  makeBiome({
    id: 'limestone_caves',
    label: 'Limestone Caves',
    tier: 'shallow',
    layerRange: [1, 5],
    gaiaEntryComment: 'Carbonate rock, formed from ancient marine sediments. You are walking on ocean floor.',
    ambientColor: 0xd4c8a8,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 1.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    tileTheme: 'limestone',
  }),

  makeBiome({
    id: 'clay_basin',
    label: 'Clay Basin',
    tier: 'shallow',
    layerRange: [1, 5],
    gaiaEntryComment: 'Clay deposits indicate prolonged waterlogging. This region was once a shallow lake bed.',
    ambientColor: 0xc4a882,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 2.0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    tileTheme: 'clay',
  }),

  makeBiome({
    id: 'iron_seam',
    label: 'Iron Seam',
    tier: 'shallow',
    layerRange: [1, 5],
    gaiaEntryComment: 'Banded iron formations. Some of these ore veins are 2.4 billion years old.',
    ambientColor: 0x8b5a2b,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0.8, shardMultiplier: 1.8, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 1 },
    tileTheme: 'iron',
  }),

  makeBiome({
    id: 'root_tangle',
    label: 'Root Tangle',
    tier: 'shallow',
    layerRange: [1, 5],
    gaiaEntryComment: 'Root systems can penetrate up to 60 meters in extreme cases. These belong to trees that fell centuries ago.',
    ambientColor: 0x4a7c3f,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.2, unstableGroundChance: 0.15 },
    mineralWeights: { dustMultiplier: 1.0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0.5, rareNodeBonus: 0 },
    tileTheme: 'roots',
  }),

  makeBiome({
    id: 'peat_bog',
    label: 'Peat Bog',
    tier: 'shallow',
    layerRange: [1, 5],
    gaiaEntryComment: 'Peat bogs preserve organic matter for millennia. Bog bodies have been found here — intact, eerily so.',
    ambientColor: 0x3d2b1f,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.3, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 1.2, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 0.8, rareNodeBonus: 0 },
    tileTheme: 'peat',
  }),

  // ── Mid (L6-10) ───────────────────────────────────────────────────────────

  makeBiome({
    id: 'basalt_maze',
    label: 'Basalt Maze',
    tier: 'mid',
    layerRange: [6, 10],
    gaiaEntryComment: 'Columnar basalt — lava that cooled and fractured into hexagonal prisms. Mathematics encoded in stone.',
    ambientColor: 0x333344,
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 1.5, crystalMultiplier: 0.5, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 0 },
    tileTheme: 'basalt',
  }),

  makeBiome({
    id: 'salt_flats',
    label: 'Salt Flats',
    tier: 'mid',
    layerRange: [6, 10],
    gaiaEntryComment: 'Halite. Evaporite deposits from ancient inland seas. These crystals have been here since the Permian.',
    ambientColor: 0xe8e8e0,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 2.0, crystalMultiplier: 0.3, geodeMultiplier: 0, essenceMultiplier: 0, rareNodeBonus: 2 },
    tileTheme: 'salt',
  }),

  makeBiome({
    id: 'coal_veins',
    label: 'Coal Veins',
    tier: 'mid',
    layerRange: [6, 10],
    gaiaEntryComment: 'Compressed Carboniferous forest. Every lump of coal is a tree that lived 300 million years ago.',
    ambientColor: 0x1a1a1a,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.5, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 1.5, rareNodeBonus: 0 },
    tileTheme: 'coal',
  }),

  makeBiome({
    id: 'granite_canyon',
    label: 'Granite Canyon',
    tier: 'mid',
    layerRange: [6, 10],
    gaiaEntryComment: 'Granite forms from slowly cooling magma deep in the crust. What you see took millions of years to reach this surface.',
    ambientColor: 0x888080,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0.3, shardMultiplier: 1.0, crystalMultiplier: 1.0, geodeMultiplier: 0.5, essenceMultiplier: 0, rareNodeBonus: 1 },
    tileTheme: 'granite',
  }),

  makeBiome({
    id: 'sulfur_springs',
    label: 'Sulfur Springs',
    tier: 'mid',
    layerRange: [6, 10],
    gaiaEntryComment: 'Hydrothermal vents. The chemosynthetic organisms here do not require sunlight. Life finds a way.',
    ambientColor: 0xaaaa00,
    hazardWeights: { lavaBlockDensity: 0.2, gasPocketDensity: 0.6, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0.5, shardMultiplier: 0.5, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 2.0, rareNodeBonus: 0 },
    tileTheme: 'sulfur',
  }),

  // ── Deep (L11-15) ─────────────────────────────────────────────────────────

  makeBiome({
    id: 'obsidian_rift',
    label: 'Obsidian Rift',
    tier: 'deep',
    layerRange: [11, 15],
    gaiaEntryComment: 'Volcanic glass. Obsidian fractures with conchoidal edges sharp enough to outperform surgical steel.',
    ambientColor: 0x110022,
    hazardWeights: { lavaBlockDensity: 0.5, gasPocketDensity: 0.2, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0.5, crystalMultiplier: 1.5, geodeMultiplier: 1.0, essenceMultiplier: 0, rareNodeBonus: 2 },
    tileTheme: 'obsidian',
  }),

  makeBiome({
    id: 'magma_shelf',
    label: 'Magma Shelf',
    tier: 'deep',
    layerRange: [11, 15],
    gaiaEntryComment: 'You are near the boundary between crust and upper mantle. The Mohorovičić discontinuity is close.',
    ambientColor: 0xff3300,
    hazardWeights: { lavaBlockDensity: 0.8, gasPocketDensity: 0.3, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 1.0, geodeMultiplier: 2.0, essenceMultiplier: 0.5, rareNodeBonus: 3 },
    tileTheme: 'magma',
  }),

  makeBiome({
    id: 'crystal_geode',
    label: 'Crystal Geode',
    tier: 'deep',
    layerRange: [11, 15],
    gaiaEntryComment: 'A geode cavity of this scale forms over millions of years through hydrothermal fluid deposition.',
    ambientColor: 0xaaffff,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 3.0, geodeMultiplier: 3.0, essenceMultiplier: 0, rareNodeBonus: 5 },
    tileTheme: 'geode',
  }),

  makeBiome({
    id: 'fossil_layer',
    label: 'Fossil Layer',
    tier: 'deep',
    layerRange: [11, 15],
    gaiaEntryComment: 'The density of preserved organisms here suggests a mass extinction boundary. Likely the K-Pg event.',
    ambientColor: 0x887766,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.1, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0.5, geodeMultiplier: 0, essenceMultiplier: 2.0, rareNodeBonus: 2 },
    tileTheme: 'fossil',
  }),

  makeBiome({
    id: 'quartz_halls',
    label: 'Quartz Halls',
    tier: 'deep',
    layerRange: [11, 15],
    gaiaEntryComment: 'Pure quartz formations. Piezoelectric properties. Pressure applied here generates measurable current.',
    ambientColor: 0xffffff,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.05 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 1.0, crystalMultiplier: 2.5, geodeMultiplier: 1.5, essenceMultiplier: 0, rareNodeBonus: 3 },
    tileTheme: 'quartz',
  }),

  // ── Extreme (L16-20) ──────────────────────────────────────────────────────

  makeBiome({
    id: 'primordial_mantle',
    label: 'Primordial Mantle',
    tier: 'extreme',
    layerRange: [16, 20],
    gaiaEntryComment: 'You are in the upper mantle. Peridotite. Olivine. Rocks that have never seen a surface.',
    ambientColor: 0xff6600,
    hazardWeights: { lavaBlockDensity: 1.0, gasPocketDensity: 0.5, unstableGroundChance: 0.3 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 1.0, geodeMultiplier: 2.0, essenceMultiplier: 3.0, rareNodeBonus: 5 },
    tileTheme: 'mantle',
  }),

  makeBiome({
    id: 'iron_core_fringe',
    label: 'Iron Core Fringe',
    tier: 'extreme',
    layerRange: [16, 20],
    gaiaEntryComment: 'The iron-nickel core begins approximately 2,890 km below the surface. You are metaphorically close.',
    ambientColor: 0x882200,
    hazardWeights: { lavaBlockDensity: 0.8, gasPocketDensity: 0, unstableGroundChance: 0.4 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 3.0, essenceMultiplier: 5.0, rareNodeBonus: 8 },
    tileTheme: 'iron_core',
  }),

  makeBiome({
    id: 'pressure_dome',
    label: 'Pressure Dome',
    tier: 'extreme',
    layerRange: [16, 20],
    gaiaEntryComment: 'Pressure here exceeds anything achievable in a surface laboratory. Diamond formation conditions.',
    ambientColor: 0x004488,
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.8, unstableGroundChance: 0.5 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 2.0, geodeMultiplier: 2.0, essenceMultiplier: 4.0, rareNodeBonus: 6 },
    tileTheme: 'pressure',
  }),

  makeBiome({
    id: 'deep_biolume',
    label: 'Deep Biolume',
    tier: 'extreme',
    layerRange: [16, 20],
    gaiaEntryComment: 'Bioluminescent extremophile colonies. These organisms have been evolving in complete darkness for geological timescales.',
    ambientColor: 0x003366,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.4, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 1.0, essenceMultiplier: 6.0, rareNodeBonus: 4 },
    tileTheme: 'biolume',
  }),

  makeBiome({
    id: 'tectonic_scar',
    label: 'Tectonic Scar',
    tier: 'extreme',
    layerRange: [16, 20],
    gaiaEntryComment: 'A fault boundary. Two tectonic plates once ground together here. The energy released was... considerable.',
    ambientColor: 0x660000,
    hazardWeights: { lavaBlockDensity: 0.6, gasPocketDensity: 0.6, unstableGroundChance: 0.6 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0.5, geodeMultiplier: 1.5, essenceMultiplier: 5.0, rareNodeBonus: 7 },
    tileTheme: 'tectonic',
  }),

  // ── Anomaly (L1-20) ───────────────────────────────────────────────────────

  makeBiome({
    id: 'temporal_rift',
    label: 'Temporal Rift',
    tier: 'anomaly',
    layerRange: [1, 20],
    anomalyChance: 0.12,
    gaiaEntryComment: 'My sensors are reading inconsistent isotope signatures. The apparent age of this stratum changes with depth.',
    ambientColor: 0x8800ff,
    hazardWeights: { lavaBlockDensity: 0.3, gasPocketDensity: 0.3, unstableGroundChance: 0.3 },
    mineralWeights: { dustMultiplier: 1.5, shardMultiplier: 1.5, crystalMultiplier: 1.5, geodeMultiplier: 1.5, essenceMultiplier: 1.5, rareNodeBonus: 3 },
    tileTheme: 'rift',
  }),

  makeBiome({
    id: 'alien_intrusion',
    label: 'Alien Intrusion',
    tier: 'anomaly',
    layerRange: [1, 20],
    anomalyChance: 0.10,
    gaiaEntryComment: 'Non-terrestrial mineral composition detected. This rock did not form on Earth.',
    ambientColor: 0x00ff88,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.5, unstableGroundChance: 0.2 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 2.0, crystalMultiplier: 2.0, geodeMultiplier: 3.0, essenceMultiplier: 3.0, rareNodeBonus: 10 },
    tileTheme: 'alien',
  }),

  makeBiome({
    id: 'bioluminescent',
    label: 'Bioluminescent',
    tier: 'anomaly',
    layerRange: [1, 20],
    anomalyChance: 0.10,
    gaiaEntryComment: 'These organisms emit light via luciferin oxidation. In the darkness below, they create their own day.',
    ambientColor: 0x00ffcc,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 0, essenceMultiplier: 10.0, rareNodeBonus: 5 },
    tileTheme: 'biolume_anomaly',
  }),

  makeBiome({
    id: 'void_pocket',
    label: 'Void Pocket',
    tier: 'anomaly',
    layerRange: [1, 20],
    anomalyChance: 0.08,
    gaiaEntryComment: 'Acoustic monitoring returns no echoes. This cavity has been sealed for an estimated 400 million years.',
    ambientColor: 0x000000,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0, unstableGroundChance: 0.8 },
    mineralWeights: { dustMultiplier: 0, shardMultiplier: 0, crystalMultiplier: 0, geodeMultiplier: 5.0, essenceMultiplier: 5.0, rareNodeBonus: 12 },
    tileTheme: 'void',
  }),

  makeBiome({
    id: 'echo_chamber',
    label: 'Echo Chamber',
    tier: 'anomaly',
    layerRange: [1, 20],
    anomalyChance: 0.10,
    gaiaEntryComment: 'The resonance frequency of this chamber matches human vocal range. Ancient cultures considered such spaces sacred.',
    ambientColor: 0x666699,
    hazardWeights: { lavaBlockDensity: 0, gasPocketDensity: 0.2, unstableGroundChance: 0.1 },
    mineralWeights: { dustMultiplier: 1.0, shardMultiplier: 1.0, crystalMultiplier: 1.0, geodeMultiplier: 1.0, essenceMultiplier: 1.0, rareNodeBonus: 2 },
    tileTheme: 'echo',
  }),
]

// ─── Legacy export — kept for consumers that import BIOMES ────────────────────
/** @deprecated Use ALL_BIOMES instead */
export const BIOMES: Biome[] = ALL_BIOMES

/** Biome look-up map keyed by BiomeId. */
export const BIOME_REGISTRY: Record<BiomeId, Biome> = Object.fromEntries(
  ALL_BIOMES.map(b => [b.id, b])
) as Record<BiomeId, Biome>

/** Default biome used when no explicit biome is specified (limestone_caves). */
export const DEFAULT_BIOME: Biome = ALL_BIOMES.find(b => b.id === 'limestone_caves')!

// ─── Anomaly override probability for selectBiome ────────────────────────────
const ANOMALY_OVERRIDE_CHANCE = 0.12

/**
 * Selects a biome for the given 1-based layer index using seeded RNG.
 *
 * With probability ANOMALY_OVERRIDE_CHANCE the layer receives a random anomaly biome
 * regardless of depth tier. Otherwise a biome matching the tier for the layer is chosen.
 *
 * @param layer - 1-based layer number (1 = shallowest)
 * @param rng - Seeded random number generator
 */
export function selectBiome(layer: number, rng: () => number): Biome {
  if (rng() < ANOMALY_OVERRIDE_CHANCE) {
    const anomalyBiomes = ALL_BIOMES.filter(b => b.tier === 'anomaly')
    return anomalyBiomes[Math.floor(rng() * anomalyBiomes.length)]
  }
  const tier: BiomeTier =
    layer <= 5  ? 'shallow' :
    layer <= 10 ? 'mid'     :
    layer <= 15 ? 'deep'    : 'extreme'
  const tierBiomes = ALL_BIOMES.filter(b => b.tier === tier)
  return tierBiomes[Math.floor(rng() * tierBiomes.length)]
}

/**
 * Picks a biome for a given layer using seeded RNG.
 * Converts the 0-based layer index to 1-based before delegating to selectBiome.
 *
 * @param rng - Seeded random number generator for deterministic results
 * @param layer - Zero-based layer index
 */
export function pickBiome(rng: () => number, layer: number): Biome {
  return selectBiome(layer + 1, rng)
}

/**
 * Generates a biome sequence for an entire dive run, one entry per layer.
 *
 * @param rng - Seeded RNG for fully deterministic results per dive
 * @param maxLayers - Total number of layers in the run (typically BALANCE.MAX_LAYERS)
 * @returns Array of Biome objects, one per layer index (0-based)
 */
export function generateBiomeSequence(rng: () => number, maxLayers: number): Biome[] {
  return Array.from({ length: maxLayers }, (_, i) => selectBiome(i + 1, rng))
}
