// src/data/biomeTileSpec.ts

import type { BiomeId } from './biomes'

/**
 * Autotile mode controls how many variants are generated per biome.
 * - 'bitmask16': Standard 4-bit bitmask, 16 variants (all biomes)
 * - 'blob47': Full 8-bit blob tileset, 47 variants (hero biomes only)
 */
export type AutotileMode = 'bitmask16' | 'blob47'

/**
 * Which tile types require per-biome variants.
 * 'soil' maps to Dirt/SoftRock, 'rock' maps to Stone/HardRock/Unbreakable.
 * 'accent' is an optional decorative overlay tile (crystals, veins, etc.)
 */
export type TileCategory = 'soil' | 'rock' | 'accent'

/**
 * Full visual specification for a single biome's tile set.
 * Used both by ComfyUI prompt generation and by AutotileSystem sprite key resolution.
 */
export interface BiomeTileSpec {
  /** Biome this spec belongs to */
  biomeId: BiomeId
  /** ComfyUI prompt fragment describing the tile surface texture */
  surfacePrompt: string
  /** ComfyUI negative prompt — what to avoid */
  negativePrompt: string
  /** Dominant rock/mineral color in 0xRRGGBB */
  primaryColor: number
  /** Secondary color for detail, veins, or grout lines */
  secondaryColor: number
  /** Whether rock tiles show internal stratification lines */
  hasStrata: boolean
  /** Whether soil tiles show embedded organic material (roots, spores, peat) */
  hasOrganicDetail: boolean
  /** Optional accent overlay tile (e.g. crystal druse, biolume patches) */
  accentPrompt?: string
  /** Autotile mode for terrain tiles in this biome */
  autotileMode: AutotileMode
}

/** Maps biome tier to its texture atlas filename. */
export const TIER_ATLAS_KEYS: Record<string, string> = {
  shallow:  'atlas_shallow',
  mid:      'atlas_mid',
  deep:     'atlas_deep',
  extreme:  'atlas_extreme',
  anomaly:  'atlas_anomaly',
}

/**
 * Constructs the sprite key for a per-biome autotile variant.
 *
 * Format: `{biomeId}_{category}_{variant:02}`
 *   e.g. `limestone_caves_rock_07`
 *
 * For blob47 tiles the variant range is 0-46 (zero-padded to 2 digits).
 */
export function biomeTileSpriteKey(
  biomeId: BiomeId,
  category: TileCategory,
  variant: number,
): string {
  return `${biomeId}_${category}_${String(variant).padStart(2, '0')}`
}

/**
 * Returns the sprite key for a biome transition tile.
 *
 * Format: `transition_{biomeA}_{biomeB}_{category}_{edge}`
 *   where edge is 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
 */
export function transitionTileSpriteKey(
  biomeA: BiomeId,
  biomeB: BiomeId,
  category: TileCategory,
  edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
): string {
  // Always sort biome IDs so A < B — avoids duplicate pairs
  const [a, b] = [biomeA, biomeB].sort()
  return `transition_${a}_${b}_${category}_${edge}`
}

// ─── Per-biome specifications ─────────────────────────────────────────────────

export const BIOME_TILE_SPECS: Record<BiomeId, BiomeTileSpec> = {

  // ── Shallow tier ──────────────────────────────────────────────────────────

  limestone_caves: {
    biomeId: 'limestone_caves',
    surfacePrompt: 'pale cream limestone rock, fine horizontal sediment bands, ' +
      'small fossil impressions, slightly rough texture, warm ivory tone',
    negativePrompt: 'dark, metallic, glowing, alien, modern',
    primaryColor: 0xd4c8a8,
    secondaryColor: 0xb8aa88,
    hasStrata: true,
    hasOrganicDetail: false,
    autotileMode: 'blob47',  // Hero biome — visualTier 1
  },

  clay_basin: {
    biomeId: 'clay_basin',
    surfacePrompt: 'smooth terracotta clay, wet smeared surface, faint finger-drag ' +
      'texture lines, muted orange-brown, occasional small pebble inclusion',
    negativePrompt: 'sharp edges, crystals, metallic, glowing',
    primaryColor: 0xc4a882,
    secondaryColor: 0x9c7a5c,
    hasStrata: false,
    hasOrganicDetail: false,
    autotileMode: 'bitmask16',
  },

  iron_seam: {
    biomeId: 'iron_seam',
    surfacePrompt: 'banded iron formation, rust-red and silver-grey alternating bands, ' +
      'metallic sheen on rock face, iron oxide streaks',
    negativePrompt: 'organic, roots, glowing, wet, smooth',
    primaryColor: 0x8b5a2b,
    secondaryColor: 0x5a3010,
    hasStrata: true,
    hasOrganicDetail: false,
    accentPrompt: 'iron ore vein, specular rust highlight, bright orange streak',
    autotileMode: 'bitmask16',
  },

  root_tangle: {
    biomeId: 'root_tangle',
    surfacePrompt: 'dark forest soil threaded with pale root fibers, tangled organic ' +
      'network, damp humus, embedded small stones, deep green-brown',
    negativePrompt: 'metallic, crystals, dry, clean',
    primaryColor: 0x4a7c3f,
    secondaryColor: 0x2d4f28,
    hasStrata: false,
    hasOrganicDetail: true,
    accentPrompt: 'glowing fungal bioluminescent spot, tiny cyan spore dot',
    autotileMode: 'bitmask16',
  },

  peat_bog: {
    biomeId: 'peat_bog',
    surfacePrompt: 'compressed dark brown peat, waterlogged fibrous texture, ' +
      'spongy layered organic matter, near-black at edges, amber-brown mid-tone',
    negativePrompt: 'dry, light, metallic, crystalline, sharp',
    primaryColor: 0x3d2b1f,
    secondaryColor: 0x5a3d28,
    hasStrata: true,
    hasOrganicDetail: true,
    autotileMode: 'bitmask16',
  },

  // ── Mid tier ──────────────────────────────────────────────────────────────

  basalt_maze: {
    biomeId: 'basalt_maze',
    surfacePrompt: 'columnar basalt, deep blue-grey hexagonal prism cross-sections, ' +
      'clean geometric fractures, matte volcanic stone, faint hexagonal grout lines',
    negativePrompt: 'organic, brown, warm, glowing, soft',
    primaryColor: 0x333344,
    secondaryColor: 0x222233,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'hexagonal basalt column edge highlight, cool steel-blue rim',
    autotileMode: 'blob47',  // Hero biome — visualTier 1
  },

  salt_flats: {
    biomeId: 'salt_flats',
    surfacePrompt: 'crystalline halite rock, near-white with faint pink tinge, ' +
      'cubic cleavage planes, translucent edges catching light, salt crust texture',
    negativePrompt: 'dark, organic, metallic, glowing, warm',
    primaryColor: 0xe8e8e0,
    secondaryColor: 0xd0d0c4,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'large cubic salt crystal protrusion, specular white highlight',
    autotileMode: 'bitmask16',
  },

  coal_veins: {
    biomeId: 'coal_veins',
    surfacePrompt: 'matte black anthracite coal seam, conchoidal fracture surfaces, ' +
      'sub-metallic gloss on fresh break faces, embedded compressed plant impression',
    negativePrompt: 'light, colorful, metallic shine, organic living matter',
    primaryColor: 0x1a1a1a,
    secondaryColor: 0x2a2a2a,
    hasStrata: true,
    hasOrganicDetail: true,
    autotileMode: 'bitmask16',
  },

  granite_canyon: {
    biomeId: 'granite_canyon',
    surfacePrompt: 'coarse granite, salt-and-pepper feldspar and quartz intergrowth, ' +
      'medium grey, scattered pink feldspar phenocrysts, rough granular texture',
    negativePrompt: 'smooth, banded, metallic, glowing, organic',
    primaryColor: 0x888080,
    secondaryColor: 0x6a6060,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'quartz vein cutting across granite, pale translucent stripe',
    autotileMode: 'bitmask16',
  },

  sulfur_springs: {
    biomeId: 'sulfur_springs',
    surfacePrompt: 'sulfur-encrusted rock, bright yellow crystalline deposits on ' +
      'dark basalt, fumarole mineral staining, hot spring travertine texture',
    negativePrompt: 'cold, blue, organic, smooth, dark',
    primaryColor: 0xaaaa00,
    secondaryColor: 0x887700,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'bright yellow sulfur crystal cluster, translucent lemon-yellow spike',
    autotileMode: 'bitmask16',
  },

  // ── Deep tier ──────────────────────────────────────────────────────────────

  obsidian_rift: {
    biomeId: 'obsidian_rift',
    surfacePrompt: 'volcanic obsidian glass, near-black with deep purple subsurface sheen, ' +
      'conchoidal glass fracture edges, razor-sharp smooth faces, glassy reflection',
    negativePrompt: 'rough, granular, warm, organic, light',
    primaryColor: 0x110022,
    secondaryColor: 0x220044,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'obsidian mirror sheen, purple iridescent reflection streak',
    autotileMode: 'blob47',  // Hero biome — visualTier 1
  },

  magma_shelf: {
    biomeId: 'magma_shelf',
    surfacePrompt: 'solidified basaltic crust over magma chamber, dark clinker surface ' +
      'with glowing orange fissures, pahoehoe ropy texture, heat-cracked segments',
    negativePrompt: 'cold, blue, crystalline, organic, smooth',
    primaryColor: 0xff3300,
    secondaryColor: 0xcc2200,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'glowing lava crack, orange-red emission light bleed on edges',
    autotileMode: 'bitmask16',
  },

  crystal_geode: {
    biomeId: 'crystal_geode',
    surfacePrompt: 'geode cavity wall, massive quartz crystal druse, pale cyan and ' +
      'white crystal points growing inward, translucent with internal light scattering',
    negativePrompt: 'dark, opaque, organic, brown, metallic',
    primaryColor: 0xaaffff,
    secondaryColor: 0x88dddd,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'large crystal point, iridescent cyan specular tip, inner glow',
    autotileMode: 'blob47',  // Hero biome — visualTier 1
  },

  fossil_layer: {
    biomeId: 'fossil_layer',
    surfacePrompt: 'dark mudstone with cross-sectioned fossil specimens, preserved ' +
      'ammonite whorls, belemnite guards, compressed fern fronds, ochre-brown matrix',
    negativePrompt: 'metallic, glowing, modern, smooth, crystalline',
    primaryColor: 0x887766,
    secondaryColor: 0x6a5a4a,
    hasStrata: true,
    hasOrganicDetail: true,
    accentPrompt: 'exposed spiral ammonite fossil cross-section, pale cream contrast',
    autotileMode: 'bitmask16',
  },

  quartz_halls: {
    biomeId: 'quartz_halls',
    surfacePrompt: 'milky white quartz formation, massive crystalline structure, ' +
      'slight translucency at edges, smooth vitreous faces, pearl-white to off-white',
    negativePrompt: 'dark, organic, metallic, rough, warm',
    primaryColor: 0xffffff,
    secondaryColor: 0xe0e8e8,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'pure quartz vein, near-transparent glass-clear stripe',
    autotileMode: 'bitmask16',
  },

  // ── Extreme tier ──────────────────────────────────────────────────────────

  primordial_mantle: {
    biomeId: 'primordial_mantle',
    surfacePrompt: 'upper mantle peridotite, olive-green olivine and pyroxene crystals, ' +
      'xenolith inclusions, pressure-altered mineral assemblage, dark green-grey',
    negativePrompt: 'cold, blue, light, glowing cold',
    primaryColor: 0xff6600,
    secondaryColor: 0xcc4400,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'pressure-altered olivine crystal face, greasy vitreous luster',
    autotileMode: 'bitmask16',
  },

  iron_core_fringe: {
    biomeId: 'iron_core_fringe',
    surfacePrompt: 'iron-nickel metallic rock, dark red-brown with metallic sheen, ' +
      'Widmanstätten pattern on cut faces, dense heavy texture, deep maroon',
    negativePrompt: 'light, organic, crystalline, cold, blue',
    primaryColor: 0x882200,
    secondaryColor: 0x661100,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'metallic iron Widmanstätten pattern, pale silver-grey crosshatch',
    autotileMode: 'bitmask16',
  },

  pressure_dome: {
    biomeId: 'pressure_dome',
    surfacePrompt: 'high-pressure metamorphic rock, deep blue with white mineral streaks, ' +
      'coesite inclusions from impact metamorphism, compressed foliation, dark navy',
    negativePrompt: 'warm, orange, red, organic, loose',
    primaryColor: 0x004488,
    secondaryColor: 0x003366,
    hasStrata: true,
    hasOrganicDetail: false,
    accentPrompt: 'diamond-bearing kimberlite inclusion, tiny octahedral shape',
    autotileMode: 'bitmask16',
  },

  deep_biolume: {
    biomeId: 'deep_biolume',
    surfacePrompt: 'deep rock coated in bioluminescent extremophile colonies, dark navy ' +
      'base with faintly glowing teal-green biofilm patches, wet sheen, organic texture',
    negativePrompt: 'dry, metallic, geometric, bright, unglowing',
    primaryColor: 0x003366,
    secondaryColor: 0x002244,
    hasStrata: false,
    hasOrganicDetail: true,
    accentPrompt: 'bioluminescent organism patch, soft teal inner glow, wet-look surface',
    autotileMode: 'bitmask16',
  },

  tectonic_scar: {
    biomeId: 'tectonic_scar',
    surfacePrompt: 'fault zone mylonite, dark red-grey cataclasite with fine-grained ' +
      'crush breccia, shear-zone foliation, intense red-brown fault gouge',
    negativePrompt: 'cold, crystalline, smooth, organic, blue',
    primaryColor: 0x660000,
    secondaryColor: 0x440000,
    hasStrata: true,
    hasOrganicDetail: false,
    accentPrompt: 'fault slickenside grooves, polished shear-plane striations',
    autotileMode: 'bitmask16',
  },

  // ── Anomaly tier ──────────────────────────────────────────────────────────

  temporal_rift: {
    biomeId: 'temporal_rift',
    surfacePrompt: 'fractured rock with impossible age inconsistencies, purple-violet ' +
      'crystalline veins cutting through any host rock type, temporal distortion shimmer',
    negativePrompt: 'plain, single-color, boring, realistic, grounded',
    primaryColor: 0x8800ff,
    secondaryColor: 0x6600cc,
    hasStrata: true,
    hasOrganicDetail: false,
    accentPrompt: 'purple temporal rift vein, iridescent edge, faint time-shimmer',
    autotileMode: 'bitmask16',
  },

  alien_intrusion: {
    biomeId: 'alien_intrusion',
    surfacePrompt: 'extraterrestrial mineral intrusion, vivid green metallic matrix, ' +
      'non-euclidean crystal geometry, alien mineral not found on Earth, xenomineral',
    negativePrompt: 'familiar, terrestrial, warm colors, brown, grey',
    primaryColor: 0x00ff88,
    secondaryColor: 0x00cc66,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'alien crystal polyhedron, impossible geometry facets, green emission',
    autotileMode: 'bitmask16',
  },

  bioluminescent: {
    biomeId: 'bioluminescent',
    surfacePrompt: 'cave rock densely encrusted with glowing bioluminescent organisms, ' +
      'cyan-teal light emission from living colonies, wet glistening surface',
    negativePrompt: 'dark, dry, metallic, non-glowing, dead',
    primaryColor: 0x00ffcc,
    secondaryColor: 0x00ccaa,
    hasStrata: false,
    hasOrganicDetail: true,
    accentPrompt: 'intense bioluminescent cluster, bright cyan core glow, bloom halo',
    autotileMode: 'bitmask16',
  },

  void_pocket: {
    biomeId: 'void_pocket',
    surfacePrompt: 'absolute void-black stone, no surface detail, light-absorbing ' +
      'ultra-matte texture, featureless dark mass with only edge silhouette visible',
    negativePrompt: 'colorful, glowing, detailed surface, rough visible texture',
    primaryColor: 0x000000,
    secondaryColor: 0x0a0a0a,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'void edge outline, faint dark teal rim light, geometric border',
    autotileMode: 'blob47',  // Hero biome — visualTier 1
  },

  echo_chamber: {
    biomeId: 'echo_chamber',
    surfacePrompt: 'smooth resonant stone cavern, blue-grey slate with faint concentric ' +
      'ring patterns like sound ripples frozen in rock, acoustically reflective surface',
    negativePrompt: 'rough, organic, glowing bright, warm, metallic',
    primaryColor: 0x666699,
    secondaryColor: 0x4a4a7a,
    hasStrata: false,
    hasOrganicDetail: false,
    accentPrompt: 'frozen sound-ripple ring pattern carved in stone, subtle engraving',
    autotileMode: 'bitmask16',
  },
}

/** The five hero biomes that receive blob47 autotiling. */
export const HERO_BIOME_IDS: BiomeId[] = Object.values(BIOME_TILE_SPECS)
  .filter(s => s.autotileMode === 'blob47')
  .map(s => s.biomeId)

/**
 * Returns the sprite key for a biome terrain tile.
 * Falls back to the universal autotile key if the biome-specific sprite is absent.
 *
 * @param biomeId - Active biome
 * @param category - 'soil' or 'rock'
 * @param variant - Bitmask index (0-15 for bitmask16, 0-46 for blob47)
 * @param textures - Phaser TextureManager for existence check
 */
export function resolveTileSpriteKey(
  biomeId: BiomeId,
  category: 'soil' | 'rock',
  variant: number,
  textures: Phaser.Textures.TextureManager,
): string {
  // Use variant 00 as the uniform base texture for the biome.
  // Individual autotile variants (01-15) are visually inconsistent since each was
  // generated independently. A single seamless texture per biome/category looks
  // much better than a patchwork of different styles.
  const baseKey = biomeTileSpriteKey(biomeId, category, 0)

  // Check per-tier atlas first
  const atlasKey = TIER_ATLAS_KEYS[getBiomeTier(biomeId)] ?? 'atlas_shallow'
  if (textures.exists(atlasKey) && textures.get(atlasKey).has(baseKey)) {
    return baseKey
  }

  // Check standalone texture
  if (textures.exists(baseKey)) return baseKey

  // Fallback to universal autotile (also use variant 00 for consistency)
  return `autotile_${category}_00`
}

/**
 * Returns the depth tier name for a biome.
 * Used for atlas key lookup.
 */
export function getBiomeTier(biomeId: BiomeId): string {
  // Import at runtime to avoid circular dependency
  // Shallow tier
  if (['limestone_caves', 'clay_basin', 'iron_seam', 'root_tangle', 'peat_bog'].includes(biomeId)) return 'shallow'
  // Mid tier
  if (['basalt_maze', 'salt_flats', 'coal_veins', 'granite_canyon', 'sulfur_springs'].includes(biomeId)) return 'mid'
  // Deep tier
  if (['obsidian_rift', 'magma_shelf', 'crystal_geode', 'fossil_layer', 'quartz_halls'].includes(biomeId)) return 'deep'
  // Extreme tier
  if (['primordial_mantle', 'iron_core_fringe', 'pressure_dome', 'deep_biolume', 'tectonic_scar'].includes(biomeId)) return 'extreme'
  // Anomaly tier
  return 'anomaly'
}
