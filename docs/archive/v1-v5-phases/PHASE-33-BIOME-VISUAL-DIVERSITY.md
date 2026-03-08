# Phase 33: Biome Visual Diversity

**Status**: Not Started
**Dependencies**: Phase 7 (Visual Engine), Phase 8 (Mine Gameplay), Phase 9 (Biome Expansion), Phase 28 (Performance Optimization recommended but not blocking), Phase 30 (Mining Juice recommended but not blocking)
**Estimated Complexity**: Very High — 7 sub-phases, heavy sprite generation, new rendering systems, atlas packing

---

## Overview

### Goal

Phase 33 gives every one of the 25 biomes a visually distinct identity that is immediately readable at a glance. The current mine renderer uses two universal autotile sets (`autotile_soil_00–15` and `autotile_rock_00–15`) and five flat tile sprites (`tile_dirt`, `tile_soft_rock`, `tile_stone`, `tile_hard_rock`, `tile_unbreakable`). Every biome is differentiated today purely by a `setBackgroundColor` call and biome particle emitters.

This phase implements:

1. **Per-biome tile sprite sets** — 25 × 4 tile types × 16 autotile variants = 1,600 individual tile frames organized into per-tier texture atlases.
2. **8-bit hero autotiling** for visualTier-1 biomes — upgrades the current 4-bit (16-variant) bitmask to an 8-bit (47-variant Wang/blob tile set) for the five hero biomes (limestone_caves, basalt_maze, crystal_geode, obsidian_rift, void_pocket), giving fully seamless corner fills.
3. **Per-biome fog of war colors** — replaces the current single `fogTint` derived color with a full `FogPalette` (base, ring1, ring2, scanner) driving distinct colored fog per biome.
4. **Depth visual gradient** — a per-layer darkening and hue-shift filter applied to the camera background and fog fill, making descent feel progressively heavier over 20 layers.
5. **Biome transition tilesets** — edge tiles generated for every adjacent biome pair that appears in practice, blending the two biomes' palettes across a 2-tile transition zone (flagged in `MineCell.isTransitionZone`).
6. **Tile atlas optimization** — per-tier texture atlas packing (`shallow.atlas`, `mid.atlas`, `deep.atlas`, `extreme.atlas`, `anomaly.atlas`) with lazy loading so only the current tier's atlas is resident in GPU memory.

### Dependencies on Prior Systems

| System | File | Role in this Phase |
|--------|------|--------------------|
| `AutotileSystem.ts` | `src/game/systems/AutotileSystem.ts` | Extended to resolve biome-prefixed sprite keys; hero biomes upgraded to 8-bit bitmask |
| `MineScene.ts` | `src/game/scenes/MineScene.ts` | `drawBlockPattern()` extended to select biome-specific sprite keys; fog fill updated for `FogPalette`; depth gradient shader uniform added |
| `MineGenerator.ts` | `src/game/systems/MineGenerator.ts` | Transition zone flagging already stubbed (`MineCell.isTransitionZone`) — this phase wires it up |
| `BiomeGlowSystem.ts` | `src/game/systems/BiomeGlowSystem.ts` | Receives per-biome fog palette for ring coloring |
| `biomes.ts` | `src/data/biomes.ts` | `BiomePalette` extended with fog fields; `Biome.autotileMode` field added |
| `spriteManifest.ts` | `src/game/spriteManifest.ts` | Updated to enumerate per-tier atlas keys |
| ComfyUI pipeline | `sprite-gen/` | Batch generation of 1,600 tile frames + transition tiles |

### What This Phase Does NOT Change

- Quiz, SM-2, or any learning system
- Save/load logic or PlayerSave schema
- Dome scene rendering
- Non-terrain block sprites (minerals, artifacts, lava, gas, etc.)
- Camera system or zoom controls
- Audio systems
- Any Svelte UI components

### Design Decision References

- **DD-V2-230**: Autotile bitmask — 16 variant (4-bit) as the baseline; hero biomes get 8-bit extension
- **DD-V2-235**: Transition zones — flagged as `isTransitionZone` in MineCell; 2–3 tile blended edge
- **DD-V2-240**: Reduced tint overlays — biome color applied as background camera tint, not per-tile rect; tile sprites carry their own color
- **DD-V2-241**: Accent tinting — critical interactive blocks (QuizGate, DescentShaft, ExitLadder) use `palette.accent` tint
- **DD-V2-271**: Fog glow system (BiomeGlowSystem) — receives updated fog palette colors in this phase

### Acceptance Summary

The phase is complete when:

- All 25 biomes show a recognizably different tile palette
- Hero biomes (visualTier 1) show seamless 8-bit autotile corners
- Fog of war uses per-biome colored mist rather than a universal dark overlay
- Descending from layer 1 to layer 20 produces a visible progressive darkening
- Biome boundary cells show blended transition tiles instead of a hard cut
- Only the active tier's atlas is loaded into GPU memory; remaining tiers are not resident

---

## Sub-Phases

---

### 33.1 — Tile Sprite Specification

**Goal**: Define the complete visual specification for every biome's tile set so that ComfyUI batch generation (33.2) can proceed without ambiguity. This sub-phase produces a TypeScript data file only — no sprite files, no rendering changes.

#### File to Create

**`src/data/biomeTileSpec.ts`**

This file exports the complete specification for all 25 biome tile sets, consumed both by the ComfyUI generation scripts and by `AutotileSystem` when resolving sprite keys.

#### Complete Implementation

```typescript
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
  const biomeKey = biomeTileSpriteKey(biomeId, category, variant)
  if (textures.exists(biomeKey)) return biomeKey
  // Fallback to universal autotile
  const padded = String(variant % 16).padStart(2, '0')
  return `autotile_${category}_${padded}`
}
```

#### Acceptance Criteria

- `src/data/biomeTileSpec.ts` exists and compiles with `npm run typecheck`
- All 25 `BiomeId` keys are present in `BIOME_TILE_SPECS` — `Object.keys(BIOME_TILE_SPECS).length === 25`
- `HERO_BIOME_IDS` contains exactly 5 entries: `limestone_caves`, `basalt_maze`, `crystal_geode`, `obsidian_rift`, `void_pocket`
- `biomeTileSpriteKey('limestone_caves', 'rock', 7)` returns `'limestone_caves_rock_07'`
- `transitionTileSpriteKey('clay_basin', 'limestone_caves', 'rock', 'ne')` returns `'transition_clay_basin_limestone_caves_rock_ne'` (alphabetical sort)
- `resolveTileSpriteKey` falls back to universal key when biome sprite is absent

---

### 33.2 — ComfyUI Batch Pipeline for 25 Biome Tilesets

**Goal**: Generate all per-biome tile sprites via ComfyUI using the specs from 33.1. Output: 25 biomes × 2 tile categories (soil/rock) × 16 variants = 800 frames for bitmask16 biomes, plus 5 hero biomes × 2 categories × 47 variants = 470 frames. Plus accent tiles: up to 20 biomes × 1 accent = 20 frames. Total: approximately 1,290 frames.

#### Generation Script

**`sprite-gen/gen-biome-tiles.mjs`**

```javascript
// sprite-gen/gen-biome-tiles.mjs
// Usage: node sprite-gen/gen-biome-tiles.mjs [--biome <id>] [--tier <tier>] [--resume]

import { BIOME_TILE_SPECS, HERO_BIOME_IDS } from '../src/data/biomeTileSpec.ts'
// Note: run via tsx or after build; import .ts via tsx loader

const COMFYUI_URL = 'http://localhost:8188'
const OUTPUT_ROOT = 'src/assets/sprites/tiles/biomes'
const HIRES_ROOT  = 'src/assets/sprites-hires/tiles/biomes'

const BASE_WORKFLOW = {
  // SDXL pixel-art LoRA workflow — same structure as existing dome sprite generation
  // See docs/SPRITE_PIPELINE.md for the full JSON template
}

/**
 * Generates a single tile sprite with the given prompt at 1024×1024 (SDXL),
 * then downscales to 256×256 (hi-res) and 32×32 (lo-res) via sharp.
 */
async function generateTile(biomeId, category, variant, prompt, negative) {
  const filename = `${biomeId}_${category}_${String(variant).padStart(2, '0')}.png`
  const hiresDest = `${HIRES_ROOT}/${filename}`
  const loresDest = `${OUTPUT_ROOT}/${filename}`

  // Skip if already generated (--resume mode)
  if (process.argv.includes('--resume') && existsSync(hiresDest)) {
    console.log(`  SKIP ${filename} (already exists)`)
    return
  }

  const payload = buildWorkflow(prompt, negative, variant)
  const result  = await submitToComfyUI(payload)
  await saveAndDownscale(result, hiresDest, loresDest)
  console.log(`  OK   ${filename}`)
}

async function main() {
  const biomeFilter = process.argv.includes('--biome')
    ? process.argv[process.argv.indexOf('--biome') + 1]
    : null

  const specs = Object.values(BIOME_TILE_SPECS)
    .filter(s => !biomeFilter || s.biomeId === biomeFilter)

  for (const spec of specs) {
    console.log(`\n[${spec.biomeId}]`)
    const maxVariant = spec.autotileMode === 'blob47' ? 47 : 16

    for (const category of ['soil', 'rock']) {
      for (let v = 0; v < maxVariant; v++) {
        const prompt = buildTilePrompt(spec, category, v)
        await generateTile(spec.biomeId, category, v, prompt, spec.negativePrompt)
      }
    }

    // Accent tile (if defined)
    if (spec.accentPrompt) {
      await generateTile(spec.biomeId, 'accent', 0, spec.accentPrompt, spec.negativePrompt)
    }
  }
}

function buildTilePrompt(spec, category, variant) {
  const variantHints = getVariantConnectivityHint(variant, spec.autotileMode)
  const base = category === 'soil' ? spec.surfacePrompt : spec.surfacePrompt.replace('soil', 'rock')
  return [
    'pixel art tile, seamless edges, 8-bit style, top-down view,',
    base,
    variantHints,
    spec.hasStrata && category === 'rock' ? 'subtle horizontal stratification lines,' : '',
    spec.hasOrganicDetail && category === 'soil' ? 'embedded organic fiber detail,' : '',
    'tileable texture, no drop shadow, flat perspective, clean pixel edges',
  ].filter(Boolean).join(' ')
}
```

#### Output File Convention

All generated sprites land at:
- `src/assets/sprites/tiles/biomes/{biomeId}_{category}_{variant:02}.png` (32×32)
- `src/assets/sprites-hires/tiles/biomes/{biomeId}_{category}_{variant:02}.png` (256×256)

Accent tiles:
- `src/assets/sprites/tiles/biomes/{biomeId}_accent_00.png` (32×32)

The `spriteManifest.ts` glob already covers `../assets/sprites/**/*.png` — no changes needed for manifest discovery as long as files land in the `sprites/` tree.

#### Acceptance Criteria

- Script runs to completion with `node --loader tsx sprite-gen/gen-biome-tiles.mjs` against local ComfyUI
- `--resume` flag skips already-generated files
- `--biome limestone_caves` flag limits generation to one biome for fast testing
- Output PNGs are 32×32 (lo-res) and 256×256 (hi-res), PNG format, transparent background
- All 25 biome directories contain at least `soil_00.png` and `rock_00.png`

---

### 33.3 — 8-Bit Hero Biome Autotiling

**Goal**: Upgrade the five hero biomes from the current 4-bit 16-variant bitmask to a full 8-bit 47-variant blob tileset (Wang tiles), eliminating the diagonal corner artifact visible in hero biomes today.

#### Background

The current `AutotileSystem.ts` uses a 4-bit bitmask (bits 0–3 = Up/Right/Down/Left). This correctly handles cardinal adjacency but produces a visible diagonal stepping artifact where two soil or rock blocks meet at a corner — because no corner tile exists.

The 8-bit blob tile system adds four diagonal bits (bits 4–7 = NE/SE/SW/NW corners, set only when both cardinal neighbors are also the same type). This enables 47 unique connection states and eliminates the staircase artifact.

The 47 blob tile indices follow the standard Tiled/RPGMaker blob mapping. The mapping from 8-bit mask to 0–46 index is a well-known lookup table.

#### Files Modified

**`src/game/systems/AutotileSystem.ts`** — extended with 8-bit bitmask functions

```typescript
// Addition to src/game/systems/AutotileSystem.ts

import type { BiomeId } from '../../data/biomes'
import { HERO_BIOME_IDS } from '../../data/biomeTileSpec'

/**
 * Standard blob tile: maps an 8-bit neighbor mask to one of 47 tile indices.
 * Bits: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
 * Corner bits (NE/SE/SW/NW) are set only when both adjacent cardinals are set.
 */
const BLOB_MASK_TO_INDEX: Record<number, number> = {
  0: 0, 2: 1, 8: 2, 10: 3, 11: 4, 16: 5, 18: 6, 22: 7, 24: 8, 26: 9,
  27: 10, 30: 11, 31: 12, 64: 13, 66: 14, 72: 15, 74: 16, 75: 17, 80: 18,
  82: 19, 86: 20, 88: 21, 90: 22, 91: 23, 94: 24, 95: 25, 104: 26, 106: 27,
  107: 28, 120: 29, 122: 30, 123: 31, 208: 32, 210: 33, 214: 34, 216: 35,
  218: 36, 219: 37, 222: 38, 223: 39, 248: 40, 250: 41, 251: 42, 254: 43,
  255: 44, 127: 45, 191: 46,
}

/**
 * Computes an 8-bit blob bitmask for a terrain cell.
 * Returns a value suitable for lookup in BLOB_MASK_TO_INDEX.
 */
export function computeBlobBitmask(grid: MineCell[][], x: number, y: number): number {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const myGroup = getAutotileGroup(grid[y][x].type)

  const matches = (nx: number, ny: number): boolean => {
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) return true
    return getAutotileGroup(grid[ny][nx].type) === myGroup
  }

  const N  = matches(x,     y - 1)
  const E  = matches(x + 1, y    )
  const S  = matches(x,     y + 1)
  const W  = matches(x - 1, y    )
  const NE = N && E && matches(x + 1, y - 1)
  const SE = S && E && matches(x + 1, y + 1)
  const SW = S && W && matches(x - 1, y + 1)
  const NW = N && W && matches(x - 1, y - 1)

  return (N ? 1 : 0) | (NE ? 2 : 0) | (E ? 4 : 0) | (SE ? 8 : 0)
       | (S ? 16 : 0) | (SW ? 32 : 0) | (W ? 64 : 0) | (NW ? 128 : 0)
}

/**
 * Converts an 8-bit blob bitmask to a blob tile index (0-46).
 * Falls back to index 0 for unmapped values.
 */
export function blobMaskToIndex(mask: number): number {
  return BLOB_MASK_TO_INDEX[mask] ?? 0
}

/**
 * Returns the sprite key for a blob tile.
 * Format: `{biomeId}_{group}_{index:02}` (up to index 46)
 */
export function blobTileSpriteKey(
  biomeId: BiomeId,
  group: 'soil' | 'rock',
  blobIndex: number,
): string {
  return `${biomeId}_${group}_${String(blobIndex).padStart(2, '0')}`
}

/**
 * Returns whether a biome uses blob47 autotiling.
 */
export function isBlobBiome(biomeId: BiomeId): boolean {
  return (HERO_BIOME_IDS as string[]).includes(biomeId)
}

/**
 * Computes and stores the tile variant for a cell.
 * Uses blob bitmask for hero biomes, standard 4-bit for others.
 * Stores the result in cell.tileVariant (repurposed as blobIndex for blob biomes).
 */
export function computeVariantForCell(
  grid: MineCell[][],
  x: number,
  y: number,
  biomeId: BiomeId,
): void {
  const cell = grid[y][x]
  if (!isAutotiledBlock(cell.type)) return
  if (isBlobBiome(biomeId)) {
    cell.tileVariant = blobMaskToIndex(computeBlobBitmask(grid, x, y))
  } else {
    cell.tileVariant = computeBitmask(grid, x, y)
  }
}
```

**`src/game/scenes/MineScene.ts`** — update `drawBlockPattern` to call biome-specific keys

Inside `drawBlockPattern()`, the cases for `Dirt`, `SoftRock`, `Stone`, `HardRock`, `Unbreakable` are updated:

```typescript
// Replace the existing Dirt/SoftRock case in drawBlockPattern():
case BlockType.Dirt:
case BlockType.SoftRock: {
  const mask = cell.tileVariant ?? 0
  const category: 'soil' | 'rock' = 'soil'
  const spriteKey = resolveTileSpriteKey(this.currentBiome.id, category, mask, this.textures)
  this.getPooledSprite(spriteKey, cx, cy)
  break
}

// Replace the existing Stone/HardRock/Unbreakable case in drawBlockPattern():
case BlockType.Stone:
case BlockType.HardRock:
case BlockType.Unbreakable: {
  const mask = cell.tileVariant ?? 0
  const category: 'soil' | 'rock' = 'rock'
  const spriteKey = resolveTileSpriteKey(this.currentBiome.id, category, mask, this.textures)
  this.getPooledSprite(spriteKey, cx, cy)
  break
}
```

Also update `computeAllVariants` and `invalidateNeighborVariants` call sites to pass `biomeId`:

```typescript
// In MineScene.create() — after generateMine():
computeAllVariants(this.grid, this.currentBiome.id)

// In the block-mining handler — after removing a block:
invalidateNeighborVariants(this.grid, targetX, targetY, this.currentBiome.id)
```

Update both functions in `AutotileSystem.ts` to accept and forward `biomeId`:

```typescript
export function computeAllVariants(grid: MineCell[][], biomeId: BiomeId): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      computeVariantForCell(grid, x, y, biomeId)
    }
  }
}

export function invalidateNeighborVariants(
  grid: MineCell[][],
  cx: number,
  cy: number,
  biomeId: BiomeId,
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        computeVariantForCell(grid, nx, ny, biomeId)
      }
    }
  }
}
```

#### Acceptance Criteria

- `npm run typecheck` passes after changes to `AutotileSystem.ts` and `MineScene.ts`
- In a hero biome (e.g. `?biome=limestone_caves` URL override), blocks that touch two cardinal neighbors AND share the diagonal tile show the correct corner-filled sprite (blob index 91 = fully surrounded)
- In a non-hero biome, behavior is identical to the pre-phase bitmask16 system
- Block mining in a hero biome correctly invalidates and re-renders blob variants for all 8 neighbors
- `computeBlobBitmask` returns 255 for a fully surrounded cell and 0 for a fully isolated cell

---

### 33.4 — Per-Biome Fog of War Colors

**Goal**: Replace the single flat `fogTint` color (currently `darkenColor(ambientColor)`) with a `FogPalette` that gives each biome a distinct, recognizable fog color for hidden cells. Ring-1 (scanner silhouette) and Ring-2 (scanner dim) each get their own tint.

#### New Types in `src/data/palette.ts`

```typescript
// Addition to src/data/palette.ts

/**
 * Full fog-of-war palette for a biome.
 * Controls the visual appearance of unrevealed and scanner-visible cells.
 */
export interface FogPalette {
  /** Color of fully hidden (unrevealed) cells — the "darkness" fill */
  hidden: number
  /** Color tint for Ring-1 scanner cells (silhouette outline) */
  ring1: number
  /** Color tint for Ring-2 scanner cells (dim, readable) */
  ring2: number
  /** Alpha of the dark overlay applied on top of Ring-1 sprites (0.0–1.0) */
  ring1DimAlpha: number
  /** Alpha of the dark overlay applied on top of Ring-2 sprites (0.0–1.0) */
  ring2DimAlpha: number
}

/**
 * Derives a FogPalette from a biome's ambient color.
 * hidden = heavily darkened ambient, ring1 = 50% darkened, ring2 = 30% darkened.
 */
export function fogPaletteFromAmbient(ambientColor: number): FogPalette {
  const darken = (c: number, f: number): number => {
    const r = Math.floor(((c >> 16) & 0xff) * f)
    const g = Math.floor(((c >> 8) & 0xff) * f)
    const b = Math.floor((c & 0xff) * f)
    return (r << 16) | (g << 8) | b
  }
  return {
    hidden:       darken(ambientColor, 0.15),
    ring1:        darken(ambientColor, 0.50),
    ring2:        darken(ambientColor, 0.70),
    ring1DimAlpha: 0.55,
    ring2DimAlpha: 0.25,
  }
}
```

#### Updates to `src/data/biomes.ts`

Extend the `Biome` interface with `fogPalette`:

```typescript
// Add to Biome interface (after fogTint field):
/** Full fog-of-war palette — drives Ring-1 and Ring-2 scanner tints. (Phase 33.4) */
fogPalette: FogPalette
```

In `makeBiome()`, populate `fogPalette`:

```typescript
// Inside makeBiome(), in the return object:
fogPalette: input.fogPalette ?? fogPaletteFromAmbient(ambientColor),
```

Import `fogPaletteFromAmbient` and `FogPalette` from `./palette` at the top of `biomes.ts`.

#### Updates to `MineScene.ts` — fog rendering

In `drawTiles()`, the fog rendering block currently uses a fixed `this.currentBiome.fogTint`. Update it to use `fogPalette`:

```typescript
// Replace the hidden cell fill in drawTiles():
if (!cell.revealed) {
  const fp = this.currentBiome.fogPalette
  const visLevel = cell.visibilityLevel ?? 0

  if (visLevel === 0) {
    // Fully hidden — draw with biome's hidden fog color
    this.tileGraphics.fillStyle(fp.hidden, 1)
    this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  } else if (visLevel === 1) {
    // Ring-1: render tile sprite dimmed by biome ring1 tint
    this.tileGraphics.fillStyle(fp.ring1, 1)
    this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
    this.drawBlockPattern(cell, x, y, px, py)
    this.overlayGraphics.fillStyle(0x000000, fp.ring1DimAlpha)
    this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  } else {
    // Ring-2: render tile sprite with lighter dim
    this.tileGraphics.fillStyle(fp.ring2, 1)
    this.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
    this.drawBlockPattern(cell, x, y, px, py)
    this.overlayGraphics.fillStyle(0x000000, fp.ring2DimAlpha)
    this.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  }
  continue
}
```

Update `BiomeGlowSystem` to receive the fog palette and use `fogPalette.ring1` as the base color for adjacent-fog glow blending:

```typescript
// In BiomeGlowSystem.update():
public update(grid: MineCell[][], fogPalette?: FogPalette): void {
  // ... existing logic ...
  // When drawing glow, blend toward fogPalette.ring1 at the glow boundary
}
```

#### Acceptance Criteria

- Each biome shows a visually distinct fog color when hidden cells are visible
- `limestone_caves` fog is warm cream-tinged dark (derived from `0xd4c8a8`)
- `magma_shelf` fog is deep red-dark (derived from `0xff3300`)
- `void_pocket` fog is pure black (`hidden: 0x000000`) — already matches `ambientColor`
- `bioluminescent` fog is dark teal-black (derived from `0x00ffcc`)
- Ring-1 and Ring-2 scanner cells use the fog palette tints (not hard-coded black overlays)
- `npm run typecheck` passes

---

### 33.5 — Depth Visual Gradient

**Goal**: As the player descends from layer 1 to layer 20, the overall visual palette progressively darkens and shifts toward the biome's `depthAesthetic.colorTemperature`. By layer 20 the scene is noticeably more oppressive than layer 1 of the same biome.

#### New Service: `src/game/systems/DepthGradientSystem.ts`

```typescript
// src/game/systems/DepthGradientSystem.ts

import type { Biome } from '../../data/biomes'

/**
 * Returns per-layer visual modifiers for the depth gradient.
 *
 * @param layer - 0-based layer index (0 = shallowest, 19 = deepest)
 * @param biome - Active biome
 * @returns Modifier object consumed by MineScene and BiomeGlowSystem
 */
export interface DepthModifiers {
  /** Multiply applied to background camera fill brightness (0.0–1.0) */
  backgroundBrightnessMul: number
  /** Additional alpha darkening overlay on top of the entire viewport (0.0–0.5) */
  viewportDarkAlpha: number
  /** Fog-hidden cell additional darkening beyond fogPalette.hidden */
  fogDarkenBonus: number
  /** Glow intensity multiplier — deeper = brighter glowing blocks for contrast */
  glowIntensityMul: number
}

const MAX_LAYER = 19

/**
 * Computes depth gradient modifiers for a given layer.
 * Shallow (0): minimal darkening. Extreme (16-19): heavy darkening + glow boost.
 */
export function computeDepthModifiers(layer: number, biome: Biome): DepthModifiers {
  const t = Math.min(layer, MAX_LAYER) / MAX_LAYER  // 0.0 = layer 0, 1.0 = layer 19

  // Baseline brightness: 1.0 → 0.55 over depth
  const backgroundBrightnessMul = 1.0 - t * 0.45

  // Viewport dark overlay: none at surface → 0.30 alpha at layer 19
  const viewportDarkAlpha = t * 0.30

  // Fog darkening bonus: 0 → 0.12
  const fogDarkenBonus = t * 0.12

  // Glow intensity: scale up for warm/extreme biomes at depth for readability
  const isHotBiome = biome.depthAesthetic.colorTemperature === 'warm'
  const glowIntensityMul = 1.0 + t * (isHotBiome ? 0.6 : 0.3)

  return { backgroundBrightnessMul, viewportDarkAlpha, fogDarkenBonus, glowIntensityMul }
}

/**
 * Applies depth-modified background color to a Phaser camera.
 * Darkens the ambient color by the brightness multiplier.
 *
 * @param camera - Phaser main camera
 * @param biome - Active biome
 * @param layer - 0-based layer index
 */
export function applyDepthBackground(
  camera: Phaser.Cameras.Scene2D.Camera,
  biome: Biome,
  layer: number,
): void {
  const { backgroundBrightnessMul } = computeDepthModifiers(layer, biome)
  const base = biome.ambientColor
  const r = Math.floor(((base >> 16) & 0xff) * backgroundBrightnessMul)
  const g = Math.floor(((base >> 8) & 0xff) * backgroundBrightnessMul)
  const b = Math.floor((base & 0xff) * backgroundBrightnessMul)
  camera.setBackgroundColor((r << 16) | (g << 8) | b)
}
```

#### Updates to `MineScene.ts`

Add a new `depthOverlayGraphics` layer and apply the viewport dark alpha:

```typescript
// In MineScene class — new field:
private depthOverlayGraphics!: Phaser.GameObjects.Graphics

// In create():
this.depthOverlayGraphics = this.add.graphics()
this.depthOverlayGraphics.setDepth(4)  // Above tiles (3), below sprites (5)
this.depthOverlayGraphics.setScrollFactor(0)  // Fixed to camera

// Call depth background application in create() after biome is resolved:
applyDepthBackground(this.cameras.main, this.currentBiome, this.currentLayer)

// In drawTiles() — before the tile loop, draw the viewport darkening overlay:
private drawDepthOverlay(): void {
  const { viewportDarkAlpha } = computeDepthModifiers(this.currentLayer, this.currentBiome)
  this.depthOverlayGraphics.clear()
  if (viewportDarkAlpha > 0) {
    const cam = this.cameras.main
    this.depthOverlayGraphics.fillStyle(0x000000, viewportDarkAlpha)
    this.depthOverlayGraphics.fillRect(cam.scrollX, cam.scrollY, cam.width, cam.height)
  }
}
```

Call `drawDepthOverlay()` at the top of `redrawAll()`.

#### Acceptance Criteria

- Layer 1 and layer 20 in the same biome are visibly different in brightness
- The viewport dark overlay is absent at layer 0 and reaches ~0.30 alpha at layer 19
- `applyDepthBackground` correctly darkens the Phaser background color (not pure black)
- Warm/extreme biomes (magma_shelf, primordial_mantle) show increased glow intensity at depth
- `npm run typecheck` passes with the new `DepthGradientSystem.ts`

---

### 33.6 — Biome Transition Tilesets

**Goal**: When two biome sections are adjacent in the mine (already flagged as `MineCell.isTransitionZone = true`), render blended transition tiles at the boundary instead of a hard visual cut.

#### Background

`MineGenerator.ts` already has a stub note: `// TODO DD-V2-235: flag transition zone cells`. This sub-phase wires it up in both the generator and the renderer.

#### Step 1 — Wire up transition zone flagging in `MineGenerator.ts`

Transition zones are only meaningful within a single 20×N layer grid (each layer has one biome), so the transition concept here applies to the horizontal boundaries where a sub-biome region ends, not to vertical layer transitions (which are handled by layer change events). For this game, with one biome per layer, transition zones are most useful at the top and bottom row of a layer's grid — the conceptual "entry" and "exit" zones. Flag the top 3 rows and bottom 3 rows of each mine grid as transition zones:

```typescript
// In generateMine(), after the main grid fill loop:
for (let x = 0; x < width; x++) {
  for (let borderY = 0; borderY < 3; borderY++) {
    grid[borderY][x].isTransitionZone = true
    grid[height - 1 - borderY][x].isTransitionZone = true
  }
}
```

#### Step 2 — Transition tile generation spec

**`src/data/biomeTransitionSpec.ts`** — defines which biome pairs get bespoke transition tiles

```typescript
// src/data/biomeTransitionSpec.ts

import type { BiomeId } from './biomes'

/** A pair of biomes that commonly appear adjacent in the layer sequence. */
export interface TransitionPair {
  biomeA: BiomeId
  biomeB: BiomeId
  /** Blending mode — 'blend' mixes colors, 'erode' biomeA erodes into biomeB */
  mode: 'blend' | 'erode'
}

/**
 * All valid adjacent tier transitions in the 20-layer sequence.
 * Shallow↔Mid, Mid↔Deep, Deep↔Extreme.
 * Anomaly biomes can appear anywhere so are paired with their host tier.
 */
export const TRANSITION_PAIRS: TransitionPair[] = [
  // Shallow → Mid boundaries (layer 5→6)
  { biomeA: 'limestone_caves', biomeB: 'basalt_maze',    mode: 'erode' },
  { biomeA: 'limestone_caves', biomeB: 'coal_veins',     mode: 'blend' },
  { biomeA: 'clay_basin',      biomeB: 'basalt_maze',    mode: 'blend' },
  { biomeA: 'iron_seam',       biomeB: 'granite_canyon', mode: 'erode' },
  { biomeA: 'peat_bog',        biomeB: 'coal_veins',     mode: 'blend' },
  // Mid → Deep boundaries (layer 10→11)
  { biomeA: 'basalt_maze',     biomeB: 'obsidian_rift',  mode: 'erode' },
  { biomeA: 'coal_veins',      biomeB: 'fossil_layer',   mode: 'blend' },
  { biomeA: 'granite_canyon',  biomeB: 'crystal_geode',  mode: 'blend' },
  { biomeA: 'sulfur_springs',  biomeB: 'magma_shelf',    mode: 'erode' },
  // Deep → Extreme boundaries (layer 15→16)
  { biomeA: 'magma_shelf',     biomeB: 'primordial_mantle', mode: 'erode' },
  { biomeA: 'crystal_geode',   biomeB: 'pressure_dome',  mode: 'blend' },
  { biomeA: 'obsidian_rift',   biomeB: 'tectonic_scar',  mode: 'erode' },
]
```

#### Step 3 — Renderer update for transition zones in `MineScene.ts`

In `drawBlockPattern()`, when `cell.isTransitionZone` is true and the previous or next layer's biome ID is known, select a transition tile if available:

```typescript
// In drawBlockPattern(), for Dirt/SoftRock and Stone/HardRock:
// (Add after normal sprite key resolution)
if (cell.isTransitionZone && this.transitionBiomeId) {
  const edgeDir = this.getTransitionEdge(tileX, tileY)
  const transKey = transitionTileSpriteKey(
    this.currentBiome.id,
    this.transitionBiomeId,
    category,
    edgeDir,
  )
  if (this.textures.exists(transKey)) {
    this.getPooledSprite(transKey, cx, cy)
    break
  }
}
```

Add `transitionBiomeId: BiomeId | null` as a field on `MineScene`, set by `GameManager` when passing layer data.

#### Acceptance Criteria

- `MineCell.isTransitionZone` is `true` for all cells in the top 3 and bottom 3 rows of every mine grid
- When a transition tile exists for the active biome pair, it is rendered for transition zone cells
- When no transition tile is available, normal biome tile sprites are used (graceful fallback)
- `npm run typecheck` passes

---

### 33.7 — Tile Atlas Optimization

**Goal**: Pack all per-tier tile sprites into Phaser texture atlases so that only one tier's atlas is in GPU memory at a time. Atlas loading is deferred until the player first enters that tier.

#### Atlas Packing Script

**`sprite-gen/pack-biome-atlases.mjs`**

```javascript
// sprite-gen/pack-biome-atlases.mjs
// Usage: node sprite-gen/pack-biome-atlases.mjs
// Requires: npm install -g texturepacker (or use free-tex-packer npm package)

import { execSync } from 'child_process'
import { readdirSync } from 'fs'

const TIERS = {
  shallow:  ['limestone_caves', 'clay_basin', 'iron_seam', 'root_tangle', 'peat_bog'],
  mid:      ['basalt_maze', 'salt_flats', 'coal_veins', 'granite_canyon', 'sulfur_springs'],
  deep:     ['obsidian_rift', 'magma_shelf', 'crystal_geode', 'fossil_layer', 'quartz_halls'],
  extreme:  ['primordial_mantle', 'iron_core_fringe', 'pressure_dome', 'deep_biolume', 'tectonic_scar'],
  anomaly:  ['temporal_rift', 'alien_intrusion', 'bioluminescent', 'void_pocket', 'echo_chamber'],
}

for (const [tier, biomes] of Object.entries(TIERS)) {
  // Collect all PNG files for this tier's biomes
  const inputGlob = biomes.map(b => `src/assets/sprites/tiles/biomes/${b}_*.png`).join(' ')
  const atlasName = `atlas_${tier}`

  // Use free-tex-packer (npm package) or TexturePacker CLI
  // Output: src/assets/sprites/atlases/{atlasName}.png + .json (Phaser atlas format)
  execSync(`npx free-tex-packer --input ${inputGlob} --output src/assets/sprites/atlases/ --name ${atlasName}`)
  console.log(`Packed ${tier}: ${atlasName}.png + ${atlasName}.json`)
}
```

#### Atlas Loading in `MineScene.ts`

Replace the current flat sprite glob loading with atlas-aware loading:

```typescript
// In MineScene.preload(), add atlas loading alongside existing sprite loading:

/** Returns the atlas key for the current layer's depth tier. */
private getAtlasKeyForLayer(layer: number): string {
  if (layer <= 4)  return 'atlas_shallow'
  if (layer <= 9)  return 'atlas_mid'
  if (layer <= 14) return 'atlas_deep'
  if (layer <= 19) return 'atlas_extreme'
  return 'atlas_anomaly'
}

// In preload():
const atlasKey = this.getAtlasKeyForLayer(this.currentLayer)
if (!this.textures.exists(atlasKey)) {
  this.load.atlas(
    atlasKey,
    `assets/sprites/atlases/${atlasKey}.png`,
    `assets/sprites/atlases/${atlasKey}.json`,
  )
}

// Always load anomaly atlas (anomaly biomes can appear at any layer)
if (!this.textures.exists('atlas_anomaly')) {
  this.load.atlas(
    'atlas_anomaly',
    'assets/sprites/atlases/atlas_anomaly.png',
    'assets/sprites/atlases/atlas_anomaly.json',
  )
}
```

Update `resolveTileSpriteKey` to check both atlas frames and standalone textures:

```typescript
export function resolveTileSpriteKey(
  biomeId: BiomeId,
  category: 'soil' | 'rock',
  variant: number,
  textures: Phaser.Textures.TextureManager,
): string {
  const biomeKey = biomeTileSpriteKey(biomeId, category, variant)

  // Check per-tier atlas first (atlas frame key format: 'atlas_shallow|limestone_caves_rock_07')
  const atlasKey = TIER_ATLAS_KEYS[getBiomeTier(biomeId)] ?? 'atlas_shallow'
  if (textures.exists(atlasKey) && textures.get(atlasKey).has(biomeKey)) {
    return biomeKey  // Phaser resolves atlas frames by frame name
  }

  // Check standalone texture
  if (textures.exists(biomeKey)) return biomeKey

  // Fallback to universal autotile
  const padded = String(variant % 16).padStart(2, '0')
  return `autotile_${category}_${padded}`
}
```

Add a helper to look up a biome's tier:

```typescript
// In biomeTileSpec.ts:
import { ALL_BIOMES } from './biomes'

export function getBiomeTier(biomeId: BiomeId): string {
  return ALL_BIOMES.find(b => b.id === biomeId)?.tier ?? 'shallow'
}
```

#### Acceptance Criteria

- `npm run build` succeeds with atlases in `src/assets/sprites/atlases/`
- DevTools Network panel shows only one tier atlas request per dive layer range
- `atlas_anomaly` is always loaded at mine entry (anomaly biomes can appear on any layer)
- Switching from a shallow to a mid layer triggers `atlas_mid` load without unloading `atlas_shallow` (keep in GPU memory for layer-up escape route)
- Atlas sprite keys resolve correctly — `this.textures.get('atlas_shallow').has('limestone_caves_rock_07')` returns `true`
- `npm run typecheck` passes

---

## Playwright Test Scripts

### Test Script 1 — Hero Biome Blob Autotiling

```javascript
// /tmp/test-33-blob-autotile.js
// Tests that limestone_caves renders distinct blob tile variants at interior cells
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173?biome=limestone_caves')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/test-33-blob-limestone.png', fullPage: false })

  // Navigate to biome=void_pocket for another hero biome
  await page.goto('http://localhost:5173?biome=void_pocket')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/test-33-blob-void.png', fullPage: false })

  await browser.close()
  console.log('Screenshots saved: /tmp/test-33-blob-limestone.png and /tmp/test-33-blob-void.png')
})()
```

Run: `node /tmp/test-33-blob-autotile.js`
Then read both screenshots with the Read tool and verify:
- limestone_caves: warm cream/ivory tiles with no visible staircase diagonal artifacts at corners
- void_pocket: pure black tiles with subtle edge outlines; blob corners fully filled

### Test Script 2 — Fog Color Diversity

```javascript
// /tmp/test-33-fog-colors.js
// Screenshots three biomes with distinct fog palettes and compares visually
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

const BIOMES_TO_TEST = ['limestone_caves', 'magma_shelf', 'bioluminescent']

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  for (const biome of BIOMES_TO_TEST) {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto(`http://localhost:5173?biome=${biome}`)
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
    await page.click('button:has-text("Dive")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Enter Mine")')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `/tmp/test-33-fog-${biome}.png` })
    await page.close()
    console.log(`Saved /tmp/test-33-fog-${biome}.png`)
  }

  await browser.close()
})()
```

Expected visual results:
- `limestone_caves`: unrevealed areas show warm dark beige (not pure black)
- `magma_shelf`: unrevealed areas show deep red-dark (not pure black)
- `bioluminescent`: unrevealed areas show dark teal-black (not pure black)

### Test Script 3 — Depth Gradient Comparison

```javascript
// /tmp/test-33-depth-gradient.js
// Captures a layer-1 mine and a layer-16 mine in the same biome for brightness comparison
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  // Layer 1 (shallow)
  let page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173?biome=limestone_caves&layer=0')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/test-33-depth-layer1.png' })
  await page.close()

  // Layer 17 (extreme) — use layer override if DevPanel exposes it
  page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173?biome=primordial_mantle&layer=16')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/test-33-depth-layer17.png' })
  await page.close()

  await browser.close()
  console.log('Depth comparison screenshots saved.')
})()
```

Expected: layer-17 screenshot is substantially darker overall than layer-1 screenshot. The camera background and all unrevealed fog areas should be markedly dimmer.

### Test Script 4 — Tile Diversity Across All Biomes

```javascript
// /tmp/test-33-all-biomes.js
// Rapid screenshot of all 25 biomes for visual audit
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

const ALL_BIOME_IDS = [
  'limestone_caves', 'clay_basin', 'iron_seam', 'root_tangle', 'peat_bog',
  'basalt_maze', 'salt_flats', 'coal_veins', 'granite_canyon', 'sulfur_springs',
  'obsidian_rift', 'magma_shelf', 'crystal_geode', 'fossil_layer', 'quartz_halls',
  'primordial_mantle', 'iron_core_fringe', 'pressure_dome', 'deep_biolume', 'tectonic_scar',
  'temporal_rift', 'alien_intrusion', 'bioluminescent', 'void_pocket', 'echo_chamber',
]

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  for (const biome of ALL_BIOME_IDS) {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 400, height: 300 })
    await page.goto(`http://localhost:5173?biome=${biome}`)
    try {
      await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
      await page.click('button:has-text("Dive")')
      await page.waitForTimeout(800)
      await page.click('button:has-text("Enter Mine")')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `/tmp/test-33-biome-${biome}.png` })
    } catch (e) {
      console.error(`Failed for ${biome}: ${e.message}`)
    }
    await page.close()
  }

  await browser.close()
  console.log('All 25 biome screenshots saved to /tmp/test-33-biome-*.png')
})()
```

---

## Verification Gate

All of the following must be true before Phase 33 is marked complete.

### Typecheck

```bash
npm run typecheck
```

Must pass with 0 errors. No `@ts-ignore` suppressions added.

### Build

```bash
npm run build
```

Must succeed. Atlas files must be present in `dist/assets/sprites/atlases/`. Bundle size increase from atlases must be noted (acceptable if per-tier lazy loading is working).

### Sprite Generation Checklist

- [ ] `src/assets/sprites/tiles/biomes/` contains at least 800 PNG files
- [ ] All 25 biome IDs have corresponding `{id}_soil_00.png` and `{id}_rock_00.png`
- [ ] Five hero biomes have variants 00–46 (`{id}_soil_46.png` exists)
- [ ] All non-hero biomes have variants 00–15 only
- [ ] Hi-res counterparts exist in `src/assets/sprites-hires/tiles/biomes/`
- [ ] All sprite files are 32×32 (lo-res) or 256×256 (hi-res), PNG, transparent background

### Visual Acceptance Checklist

- [ ] `limestone_caves` tiles are warm ivory/cream and show no staircase diagonal artifacts (blob47 working)
- [ ] `basalt_maze` tiles show dark blue-grey hexagonal columnar texture
- [ ] `crystal_geode` tiles show pale cyan crystal druse with internal glow
- [ ] `obsidian_rift` tiles show near-black glass with purple sheen
- [ ] `void_pocket` tiles are ultra-matte black with edge silhouette only
- [ ] `magma_shelf` tiles show glowing lava crack fissures on dark clinker
- [ ] `alien_intrusion` tiles show vivid green metallic xenomineral
- [ ] `bioluminescent` tiles show teal-glowing organism coatings
- [ ] Each biome's fog-hidden cells show a distinct color (not uniform pure black across all biomes)
- [ ] Descending from layer 1 to layer 18 produces a visible darkening of the scene
- [ ] Mine entry at layer 16+ shows a noticeably darker ambient background than layer 1

### Functional Checklist

- [ ] Mining a block in a hero biome correctly re-computes blob variants for all 8 neighbors
- [ ] Mining a block in a non-hero biome correctly re-computes 4-bit variants for 4 neighbors (no regression)
- [ ] `resolveTileSpriteKey` falls back to universal autotile if a biome sprite is absent (no crash)
- [ ] Transition zone cells (top 3 / bottom 3 rows) render transition tiles when available
- [ ] Anomaly biomes (temporal_rift, void_pocket, etc.) are visually identifiable even when appearing on shallow layers
- [ ] Atlas loading does not throw errors for missing atlas files (graceful fallback to standalone sprites)

### Performance Checklist

- [ ] Frame rate does not drop below 30 FPS in a fully revealed 40×40 grid on a mid-range device (test with Chrome DevTools Throttling: 4× CPU slowdown)
- [ ] Only the active tier's atlas + anomaly atlas are loaded into GPU memory at any time
- [ ] Particle count stays under 50 cap (no regression from Phase 9)

---

## Files Affected

### New Files

| Path | Purpose |
|------|---------|
| `src/data/biomeTileSpec.ts` | Complete per-biome tile specifications, sprite key helpers, hero biome list |
| `src/data/biomeTransitionSpec.ts` | Transition biome pairs and blend modes |
| `src/game/systems/DepthGradientSystem.ts` | Per-layer brightness/darkening modifiers |
| `sprite-gen/gen-biome-tiles.mjs` | ComfyUI batch generation script for 25 biome tilesets |
| `sprite-gen/pack-biome-atlases.mjs` | Atlas packing script (5 per-tier atlases) |
| `src/assets/sprites/tiles/biomes/` | ~800+ per-biome tile PNGs (32×32) — generated |
| `src/assets/sprites-hires/tiles/biomes/` | ~800+ per-biome tile PNGs (256×256) — generated |
| `src/assets/sprites/atlases/atlas_shallow.png` | Packed shallow tier atlas |
| `src/assets/sprites/atlases/atlas_shallow.json` | Atlas frame map |
| `src/assets/sprites/atlases/atlas_mid.png` | Packed mid tier atlas |
| `src/assets/sprites/atlases/atlas_mid.json` | Atlas frame map |
| `src/assets/sprites/atlases/atlas_deep.png` | Packed deep tier atlas |
| `src/assets/sprites/atlases/atlas_deep.json` | Atlas frame map |
| `src/assets/sprites/atlases/atlas_extreme.png` | Packed extreme tier atlas |
| `src/assets/sprites/atlases/atlas_extreme.json` | Atlas frame map |
| `src/assets/sprites/atlases/atlas_anomaly.png` | Packed anomaly tier atlas |
| `src/assets/sprites/atlases/atlas_anomaly.json` | Atlas frame map |

### Modified Files

| Path | Changes |
|------|---------|
| `src/data/palette.ts` | Add `FogPalette` interface and `fogPaletteFromAmbient()` helper |
| `src/data/biomes.ts` | Add `fogPalette: FogPalette` to `Biome` interface; populate in `makeBiome()` |
| `src/game/systems/AutotileSystem.ts` | Add `computeBlobBitmask()`, `blobMaskToIndex()`, `blobTileSpriteKey()`, `isBlobBiome()`, `computeVariantForCell()`; update `computeAllVariants()` and `invalidateNeighborVariants()` to accept `biomeId` |
| `src/game/systems/MineGenerator.ts` | Wire up `MineCell.isTransitionZone` flagging for top/bottom 3 rows |
| `src/game/scenes/MineScene.ts` | Update `drawBlockPattern()` for biome-specific sprite keys; add `depthOverlayGraphics` and `drawDepthOverlay()`; update fog rendering for `FogPalette`; add atlas preload logic; add `transitionBiomeId` field |
| `src/game/systems/BiomeGlowSystem.ts` | Accept optional `FogPalette` in `update()` for ring-boundary glow blending |
| `src/game/spriteManifest.ts` | Add atlas glob patterns alongside existing flat sprite glob |
