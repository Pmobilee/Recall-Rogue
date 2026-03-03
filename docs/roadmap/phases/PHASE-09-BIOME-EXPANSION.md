# Phase 9: Biome Expansion

**Status**: Not Started
**Priority**: P0 — Biome variety is essential for player retention and visual diversity
**Estimated Effort**: 6-8 sprints across 7 sub-phases
**Dependencies**: Phase 8.7 (Biome Depth Tiers), Phase 7 (Visual Engine)
**Design Decisions**: DD-V2-057, DD-V2-058, DD-V2-055, DD-V2-069
**Last Updated**: 2026-03-03

---

## Overview

Phase 9 expands Terra Gacha's mine system from 3 placeholder biomes to a full catalog of 25 fully-realized biomes. Each biome delivers a distinct visual identity, unique tile sprites, ambient particle systems, structural room variants, biome-specific hazard frequency tuning, and mineral spawn weights calibrated to its depth tier.

The 25 biomes are stratified into four depth tiers — Shallow (L1-5), Mid (L6-10), Deep (L11-15), and Extreme (L16-20) — with 5 anomaly biomes that can override any tier at a 10-15% frequency. This means a Shallow layer might suddenly become a Gravity Well, or an Extreme layer could fracture into the Time-Fractured anomaly. Anomaly biomes are always prefixed with a brief GAIA commentary line on first entry.

The existing `Biome` interface in `src/data/biomes.ts` captures basic color overrides and hazard multipliers but lacks the fields required for sprite sets, particle descriptors, structural feature lists, and depth-tier classification. This phase begins by extending that type, then fills in all 25 biome definitions, generates the required sprite assets via the ComfyUI pipeline, wires ambient particle emitters per biome, and extends `MineGenerator.ts` to produce biome-appropriate structural features (pocket caves, crystal veins, root corridors, etc.).

Gameplay-wise, biomes are invisible infrastructure that makes every dive feel meaningfully different without requiring new rules to learn. The visual language does the work: players recognize they are somewhere hostile when basalt walls close in and ember particles drift upward, and they feel rewarded when crystal formations glitter in a deep cave. Biomes also gate mineral quality by tier — dust spawns only in Shallow biomes, essence only in Extreme — creating a natural pull toward deeper, riskier territory.

---

## Sub-Phase Index

| Sub-Phase | Title | File(s) Changed | Effort |
|-----------|-------|-----------------|--------|
| 9.1 | Biome Data Architecture | `src/data/biomes.ts` | 1 sprint |
| 9.2 | Biome Depth Tier Catalog | `src/data/biomes.ts` | 1 sprint |
| 9.3 | Per-Biome Tile Sprites | `src/assets/sprites/tiles/`, `src/assets/sprites-hires/tiles/`, `src/game/spriteManifest.ts` | 2 sprints |
| 9.4 | Ambient Particle Systems | `src/game/scenes/MineScene.ts`, new `src/game/systems/ParticleSystem.ts` | 1 sprint |
| 9.5 | Structural Feature Generation | `src/game/systems/MineGenerator.ts` | 1 sprint |
| 9.6 | Biome-Tier Mineral Gating | `src/data/biomes.ts`, `src/game/systems/MineGenerator.ts` | 0.5 sprint |
| 9.7 | Anomaly Biome Override Logic | `src/data/biomes.ts`, `src/game/systems/MineGenerator.ts` | 0.5 sprint |
| 9.8 | Biome Visual Tier System | `src/data/biomes.ts`, per-biome sprite directories | 1 sprint |
| 9.9 | 25-Biome Color Matrix | `src/data/biomes.ts`, new `src/data/palette.ts` | 0.5 sprint |
| 9.10 | Formal Palette System | `src/data/palette.ts`, `src/assets/sprites/` (ComfyUI prompts) | 1 sprint |
| 9.11 | Depth Visual Gradient | `src/data/biomes.ts`, `src/game/scenes/MineScene.ts` | 0.5 sprint |
| 9.12 | Remove Tint Overlays | `src/game/scenes/MineScene.ts` | 0.5 sprint |
| 9.13 | Biome Boundary Transition Tileset | `src/assets/sprites/tiles/transitions/`, `src/game/scenes/MineScene.ts` | 1 sprint |
| 9.14 | Special Block Biome Adaptation | `src/assets/sprites/`, `src/game/scenes/MineScene.ts` | 1 sprint |
| 9.15 | Animated Tile Budget Per Biome | `src/data/biomes.ts`, `src/game/scenes/MineScene.ts` | 1 sprint |
| 9.16 | Viewport-Culled Ambient Particles | `src/game/systems/ParticleSystem.ts`, `src/game/scenes/MineScene.ts` | 0.5 sprint |
| 9.17 | Biome Fog Glow System | `src/game/systems/BiomeGlowSystem.ts`, `src/game/systems/FogSystem.ts` | 0.5 sprint |

---

## Phase 9 Prerequisites

Before beginning any work in this phase, verify that the following are complete and passing:

1. **Phase 7 (Visual Engine)**: The hi-res sprite pipeline (`src/game/spriteManifest.ts`, `getSpriteUrls()`) must be operational. Sprites at both 32px and 256px resolutions must load correctly in `MineScene`. Verify with `npm run typecheck` and a dev-server visual check.

2. **Phase 8.7 (Biome Depth Tiers)**: The depth-tier assignment logic and biome shuffle sequence (`generateBiomeSequence()` in `src/data/biomes.ts`) must be confirmed working. The layer-size stepping (20×20 for L1-5, 25×25 for L6-10, 30×30 for L11-15, 40×40 for L16-20) must be implemented in `src/game/systems/MineGenerator.ts` or `src/data/balance.ts`.

3. **Existing biome interface**: `src/data/biomes.ts` currently exports `Biome`, `BIOMES` (3 entries), `DEFAULT_BIOME`, `pickBiome()`, and `generateBiomeSequence()`. These are the starting points for this phase.

4. **ComfyUI operational**: The local ComfyUI server at `http://localhost:8188` must be running with the SDXL pixel art LoRA loaded. Verify with `curl http://localhost:8188/system_stats`. See `docs/SPRITE_PIPELINE.md` for prompt templates and resolution targets.

---

## Sub-Phase 9.1: Biome Data Architecture

### Overview

The current `Biome` interface captures only the minimum for color-tinted placeholders: background color, block color overrides, hazard multipliers, and a mineral multiplier. Implementing 25 distinct biomes requires extending this type to carry all the data that downstream systems (particle emitters, structural generators, sprite loaders, mineral gating) need without coupling those systems to biome IDs via giant switch statements.

This sub-phase extends `BiomeDefinition` (renamed from `Biome` for clarity), adds a `BiomeDepthTier` enum, a `ParticleDescriptor` type for ambient effects, a `StructuralFeature` enum for procedural room variants, and per-mineral spawn weights keyed by `MineralTier`. All existing three-biome entries are updated to satisfy the new shape. The existing `pickBiome()` and `generateBiomeSequence()` functions gain depth-tier awareness.

### Sub-Steps

**Step 1.1** — Rename and extend the `Biome` interface in `src/data/biomes.ts`.

Replace the existing `Biome` interface with `BiomeDefinition`. Add the following fields:

```typescript
// src/data/biomes.ts

import { BlockType, type MineralTier } from './types'

/** Depth tier classification — determines which layers a biome can naturally appear in. */
export type BiomeDepthTier = 'shallow' | 'mid' | 'deep' | 'extreme' | 'anomaly'

/**
 * Describes a single ambient particle emitter to spawn when a biome is active.
 * MineScene reads this array and creates Phaser ParticleEmitters accordingly.
 */
export interface ParticleDescriptor {
  /** Phaser texture key for the particle sprite (must be pre-loaded). */
  textureKey: string
  /** Particles emitted per second. */
  frequency: number
  /** Particle lifetime in milliseconds. */
  lifespan: number
  /** Speed range [min, max] in pixels per second. */
  speed: [number, number]
  /** Gravity applied to particles (positive = downward). */
  gravity: number
  /** Scale range [min, max] for particle size. */
  scale: [number, number]
  /** Tint color applied to the particle (0xRRGGBB). */
  tint: number
  /** Alpha at spawn (fades to 0 over lifespan). */
  alpha: number
  /** Optional: angle range [min, max] in degrees for directional emission. */
  angle?: [number, number]
  /** Optional: blend mode — 'normal' | 'add' | 'multiply'. Default 'normal'. */
  blendMode?: 'normal' | 'add' | 'multiply'
}

/**
 * Structural features the procedural generator can place in a biome layer.
 * MineGenerator reads the `structuralFeatures` array and runs the corresponding generator.
 */
export type StructuralFeature =
  | 'pocket_caves'         // Small oval empty chambers scattered throughout
  | 'crystal_veins'        // Diagonal lines of MineralNode blocks
  | 'root_corridors'       // Winding horizontal tunnels of Empty blocks simulating roots
  | 'lava_streams'         // Vertical or diagonal LavaBlock channels
  | 'ice_columns'          // Vertical HardRock pillars with visual ice overlay
  | 'mushroom_clusters'    // 2×3 organic structures of SoftRock in open areas
  | 'fossil_beds'          // Dense horizontal bands of FossilNode blocks
  | 'obsidian_spires'      // Narrow vertical spires of HardRock rising from the floor
  | 'sand_pockets'         // Clusters of Dirt blocks with low hardness (simulates loose sand)
  | 'amber_inclusions'     // ArtifactNode blocks embedded inside Stone (higher density)
  | 'copper_traces'        // MineralNode streaks in a green color override
  | 'magma_rivers'         // Wide horizontal LavaBlock bands
  | 'void_columns'         // Columns of Empty blocks that create vertical shafts
  | 'ruin_walls'           // 3×N UnstableGround walls with ArtifactNode embedded
  | 'plasma_nodes'         // GasPocket clusters with blue tint override
  | 'temporal_fractures'   // Random empty gaps arranged in diagonal fault lines
  | 'floating_islands'     // Small 3×3 Stone platforms surrounded by Empty space
  | 'mirror_symmetry'      // Left half of grid mirrored to right (applied post-generation)
  | 'living_veins'         // MineralNode paths that pulse (tinted red/pink)
  | 'glitch_tiles'         // Random tile replacements with DataDisc blocks

/**
 * Full biome definition — the single source of truth for everything a biome controls.
 */
export interface BiomeDefinition {
  /** Unique stable identifier used in save data and sprite file naming. */
  id: string
  /** Display name shown on layer transition screen. */
  name: string
  /** One-sentence flavor text shown in GAIA's first-entry comment. */
  flavorText: string
  /** Depth tier — controls which layers this biome can appear on naturally. */
  tier: BiomeDepthTier
  /** Layer range [inclusive min, inclusive max] this biome occupies. Anomaly biomes set [1, 20]. */
  layerRange: [number, number]
  /** Base background color for empty/revealed cells (0xRRGGBB Phaser format). */
  bgColor: number
  /** Per-block-type color overrides merged with BLOCK_COLORS in MineScene. */
  blockColorOverrides: Partial<Record<BlockType, number>>
  /** Multipliers for block type distribution weights during generation. 1.0 = baseline. */
  blockWeights: {
    dirt: number
    softRock: number
    stone: number
    hardRock: number
  }
  /** Multipliers applied to base hazard density constants in MineGenerator. */
  hazardMultipliers: {
    lava: number
    gas: number
    unstable: number
  }
  /**
   * Per-mineral-tier spawn weight for this biome. Values are relative probabilities;
   * only tiers appropriate to the depth tier should have non-zero values.
   * MineGenerator normalizes these internally.
   */
  mineralWeights: Partial<Record<MineralTier, number>>
  /** Fog tint color for ring-1 and ring-2 hidden blocks. */
  fogTint: number
  /** Hex color codes forming the biome's visual palette (informational; used for ComfyUI prompts). */
  palette: string[]
  /** Structural features the generator should attempt to place in this biome's layers. */
  structuralFeatures: StructuralFeature[]
  /** Ambient particle emitters active while the player is in this biome's layer. */
  particles: ParticleDescriptor[]
  /**
   * Base file stem for this biome's tile sprites. Sprite files follow the pattern:
   *   src/assets/sprites/tiles/biome_{id}_dirt.png
   *   src/assets/sprites/tiles/biome_{id}_soft_rock.png
   *   src/assets/sprites/tiles/biome_{id}_stone.png
   *   src/assets/sprites/tiles/biome_{id}_hard_rock.png
   *   src/assets/sprites/tiles/biome_{id}_wall.png  (background wall variant)
   * If a biome-specific file does not exist, the renderer falls back to the generic tile.
   */
  spritePrefix: string
  /**
   * Whether this biome is an anomaly that can override any depth tier's layer.
   * Anomaly biomes are excluded from the standard tier-filtered pool used by generateBiomeSequence().
   */
  isAnomaly: boolean
}
```

**Step 1.2** — Update all exports and aliases in `src/data/biomes.ts`.

After the interface definition, add a backward-compatibility alias so that existing code referencing the old `Biome` type continues to compile while the codebase is migrated:

```typescript
/** @deprecated Use BiomeDefinition instead. Alias for backward compatibility. */
export type Biome = BiomeDefinition
```

Update `BIOMES` type annotation to `BiomeDefinition[]`. Update `DEFAULT_BIOME` type annotation to `BiomeDefinition`. Update `pickBiome` and `generateBiomeSequence` parameter types accordingly.

**Step 1.3** — Extend `pickBiome()` with depth-tier filtering.

Replace the current `pickBiome()` implementation with a version that:
1. Accepts a `layer` parameter (1-based, matching game UI convention).
2. Returns layer 1 always as 'sedimentary' (tutorial safety net).
3. Determines the depth tier from the layer number.
4. Filters `BIOMES` to only entries whose `tier` matches and whose `layerRange` contains the layer.
5. Applies a 10-15% anomaly override check: if `rng() < 0.125`, pick from the anomaly pool instead.
6. Falls back to `DEFAULT_BIOME` if the filtered pool is empty (defensive).

```typescript
/**
 * Determines the depth tier for a given layer number (1-based).
 * @param layer - 1-based layer number
 */
export function getDepthTier(layer: number): BiomeDepthTier {
  if (layer <= 5) return 'shallow'
  if (layer <= 10) return 'mid'
  if (layer <= 15) return 'deep'
  return 'extreme'
}

/**
 * Picks a biome for a given layer using seeded RNG and depth-tier filtering.
 * Layer 1 is always sedimentary (tutorial). Deeper layers draw from their tier pool
 * with a 12.5% chance of anomaly override at any depth.
 *
 * @param rng - Seeded random number generator for deterministic results
 * @param layer - 1-based layer number (matches game UI)
 */
export function pickBiome(rng: () => number, layer: number): BiomeDefinition {
  if (layer === 1) return BIOMES.find(b => b.id === 'sedimentary_flats') ?? DEFAULT_BIOME

  // Anomaly override check
  if (rng() < 0.125) {
    const anomalyPool = BIOMES.filter(b => b.isAnomaly)
    if (anomalyPool.length > 0) {
      return anomalyPool[Math.floor(rng() * anomalyPool.length)]
    }
  }

  const tier = getDepthTier(layer)
  const tierPool = BIOMES.filter(b => b.tier === tier && !b.isAnomaly)
  if (tierPool.length === 0) return DEFAULT_BIOME
  return tierPool[Math.floor(rng() * tierPool.length)]
}
```

**Step 1.4** — Extend `generateBiomeSequence()` to use the updated `pickBiome()`.

Update the implementation to call `pickBiome(rng, index + 1)` (1-based layer) for each entry instead of direct pool sampling. The Fisher-Yates shuffle is no longer needed at the top level because tier filtering and anomaly rolls handle distribution; however, keep the cycling mechanism for runs that exceed 20 layers (future-proofing).

**Step 1.5** — Update the three existing biome stubs to the new shape.

The three existing biomes (`sedimentary`, `volcanic`, `crystalline`) must be updated to fully satisfy `BiomeDefinition`. Set placeholder values for the new fields:
- `flavorText`: short flavor string
- `tier`: 'shallow', 'mid', or appropriate tier
- `layerRange`: appropriate range
- `palette`: 2-4 hex strings matching their existing color overrides
- `structuralFeatures`: at least one feature each
- `particles`: empty array `[]` for now (Phase 9.4 fills these in)
- `spritePrefix`: `'biome_sedimentary'` etc.
- `isAnomaly`: `false`
- `mineralWeights`: appropriate to their tier

These three stubs will be fully replaced by the complete 25-biome definitions in Sub-Phase 9.2, but they must compile correctly before that work begins.

### Acceptance Criteria

- `npm run typecheck` passes with zero errors after Step 1.1 through 1.5.
- The `BiomeDefinition` interface is the sole definition of biome shape; the `Biome` alias compiles without additional changes to any import site.
- `pickBiome(rng, 1)` always returns the sedimentary biome.
- `pickBiome(rng, 6)` always returns a `mid`-tier or anomaly biome (never `shallow`).
- `generateBiomeSequence(rng, 20)` returns an array of length 20 with no undefined entries.
- `getDepthTier(1)` returns `'shallow'`, `getDepthTier(6)` returns `'mid'`, `getDepthTier(11)` returns `'deep'`, `getDepthTier(16)` returns `'extreme'`.
- The game starts and enters the mine without a runtime error (dev server smoke test).

### Playwright Test Script

```js
// /tmp/test-9.1.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Check no console errors related to biomes
  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9.1-mine.png' })

  const biomeErrors = consoleErrors.filter(e => e.toLowerCase().includes('biome'))
  if (biomeErrors.length > 0) {
    console.error('FAIL: Biome errors in console:', biomeErrors)
    process.exit(1)
  }
  console.log('PASS: No biome errors, mine loaded successfully')
  await browser.close()
})()
```

### Verification Gate

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — zero errors
- [ ] Dev server starts and mine loads without console errors
- [ ] Screenshot `/tmp/ss-9.1-mine.png` shows mine rendered (not blank/crashed)
- [ ] All 5 function exports from `biomes.ts` resolve in TypeScript: `BiomeDefinition`, `Biome`, `BIOMES`, `DEFAULT_BIOME`, `pickBiome`, `generateBiomeSequence`, `getDepthTier`

---

## Sub-Phase 9.2: Biome Depth Tier Catalog

### Overview

This is the largest single sub-phase in Phase 9. It defines all 25 biomes in full — each with a complete `BiomeDefinition` object ready to compile and use. The three placeholder biomes are replaced. Twenty-two new biomes are added. The final BIOMES array has exactly 25 entries (20 standard + 5 anomaly).

Particle arrays are set to `[]` placeholders — they will be filled in Sub-Phase 9.4. Structural features list the intended features so the generator can begin wiring them in 9.5. Sprite prefixes follow a consistent naming convention so the ComfyUI generation workflow in 9.3 can produce correctly named files without further configuration.

Each biome entry below is specified in sufficient detail for a coding worker to transcribe it into TypeScript without ambiguity. Color values are provided as hex strings (convert to `0xRRGGBB` Phaser format in code). Hazard multipliers are calibrated so that deeper biomes progressively increase pressure without crossing into unplayable territory.

### Sub-Steps

**Step 2.1** — Replace `src/data/biomes.ts` `BIOMES` array with all 25 complete `BiomeDefinition` entries, following the catalog below. Keep all helper functions (`pickBiome`, `generateBiomeSequence`, `getDepthTier`) intact from Sub-Phase 9.1.

**Step 2.2** — Update `DEFAULT_BIOME` to point to the new `sedimentary_flats` entry (first entry in the array).

**Step 2.3** — Verify `generateBiomeSequence(rng, 20)` with a fixed RNG seed produces a stable, deterministic sequence where layer 1 is always `sedimentary_flats`. Write a one-off Node.js verification script at `/tmp/verify-biomes.mjs` and run it.

---

### The 25 Biome Definitions

The TypeScript data objects below should be entered verbatim into the `BIOMES` array. Field descriptions match the `BiomeDefinition` interface from Sub-Phase 9.1.

---

#### Biome 1: Sedimentary Flats

```typescript
{
  id: 'sedimentary_flats',
  name: 'Sedimentary Flats',
  flavorText: 'Compressed millennia of earthly history, legible as pages in a stone book.',
  tier: 'shallow',
  layerRange: [1, 5],
  bgColor: 0x111118,
  blockColorOverrides: {},
  blockWeights: { dirt: 1.2, softRock: 1.0, stone: 0.9, hardRock: 0.7 },
  hazardMultipliers: { lava: 0.3, gas: 0.5, unstable: 0.8 },
  mineralWeights: { dust: 0.8, shard: 0.2 },
  fogTint: 0x1a1a2e,
  palette: ['#2c2c38', '#4a3c2a', '#6b5d4a', '#8c7d6a'],
  structuralFeatures: ['pocket_caves', 'fossil_beds'],
  particles: [],
  spritePrefix: 'biome_sedimentary_flats',
  isAnomaly: false,
}
```

---

#### Biome 2: Mossy Caverns

```typescript
{
  id: 'mossy_caverns',
  name: 'Mossy Caverns',
  flavorText: 'Dripping water and bioluminescent moss transform stone into something almost alive.',
  tier: 'shallow',
  layerRange: [1, 5],
  bgColor: 0x0d1a0d,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3d5c2a,
    [BlockType.SoftRock]: 0x2d4c1a,
    [BlockType.Stone]: 0x3a4a30,
    [BlockType.HardRock]: 0x2a3820,
  },
  blockWeights: { dirt: 1.1, softRock: 1.2, stone: 0.8, hardRock: 0.6 },
  hazardMultipliers: { lava: 0.1, gas: 1.2, unstable: 0.7 },
  mineralWeights: { dust: 0.9, shard: 0.1 },
  fogTint: 0x0d1a0d,
  palette: ['#0d1a0d', '#1a3a1a', '#2d5c2a', '#4aaa44'],
  structuralFeatures: ['pocket_caves', 'mushroom_clusters'],
  particles: [],
  spritePrefix: 'biome_mossy_caverns',
  isAnomaly: false,
}
```

---

#### Biome 3: Sandy Hollows

```typescript
{
  id: 'sandy_hollows',
  name: 'Sandy Hollows',
  flavorText: 'Loose sand that has filtered downward for centuries, hiding pocket chambers and dry fossil traces.',
  tier: 'shallow',
  layerRange: [1, 5],
  bgColor: 0x1a1508,
  blockColorOverrides: {
    [BlockType.Dirt]: 0xd4a855,
    [BlockType.SoftRock]: 0xb8924a,
    [BlockType.Stone]: 0x8c7040,
    [BlockType.HardRock]: 0x6a5530,
  },
  blockWeights: { dirt: 1.5, softRock: 1.1, stone: 0.7, hardRock: 0.5 },
  hazardMultipliers: { lava: 0.2, gas: 0.3, unstable: 1.4 },
  mineralWeights: { dust: 1.0 },
  fogTint: 0x1a150a,
  palette: ['#1a1508', '#6a5530', '#b8924a', '#d4a855'],
  structuralFeatures: ['pocket_caves', 'sand_pockets'],
  particles: [],
  spritePrefix: 'biome_sandy_hollows',
  isAnomaly: false,
}
```

---

#### Biome 4: Root Networks

```typescript
{
  id: 'root_networks',
  name: 'Root Networks',
  flavorText: 'Titanic root systems from surface megaflora reach down further than any tree has a right to grow.',
  tier: 'shallow',
  layerRange: [1, 5],
  bgColor: 0x110d08,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x5c3a1a,
    [BlockType.SoftRock]: 0x4a2c10,
    [BlockType.Stone]: 0x3a2808,
    [BlockType.HardRock]: 0x2c1e04,
  },
  blockWeights: { dirt: 1.3, softRock: 0.9, stone: 0.8, hardRock: 0.6 },
  hazardMultipliers: { lava: 0.1, gas: 0.8, unstable: 1.1 },
  mineralWeights: { dust: 0.7, shard: 0.3 },
  fogTint: 0x110d08,
  palette: ['#110d08', '#2c1e04', '#5c3a1a', '#8c6030'],
  structuralFeatures: ['root_corridors', 'pocket_caves'],
  particles: [],
  spritePrefix: 'biome_root_networks',
  isAnomaly: false,
}
```

---

#### Biome 5: Clay Deposits

```typescript
{
  id: 'clay_deposits',
  name: 'Clay Deposits',
  flavorText: 'Dense reddish clay that ancient hands once shaped into vessels. Shards still turn up in the matrix.',
  tier: 'shallow',
  layerRange: [1, 5],
  bgColor: 0x180a0a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x9c3c2a,
    [BlockType.SoftRock]: 0x7a2c1a,
    [BlockType.Stone]: 0x5c2010,
    [BlockType.HardRock]: 0x3a1408,
  },
  blockWeights: { dirt: 1.0, softRock: 1.3, stone: 0.9, hardRock: 0.6 },
  hazardMultipliers: { lava: 0.4, gas: 0.6, unstable: 1.0 },
  mineralWeights: { dust: 0.6, shard: 0.4 },
  fogTint: 0x1a0d08,
  palette: ['#180a0a', '#3a1408', '#7a2c1a', '#9c3c2a'],
  structuralFeatures: ['pocket_caves', 'amber_inclusions'],
  particles: [],
  spritePrefix: 'biome_clay_deposits',
  isAnomaly: false,
}
```

---

#### Biome 6: Volcanic Tunnels

```typescript
{
  id: 'volcanic_tunnels',
  name: 'Volcanic Tunnels',
  flavorText: 'Ancient lava bored these passages. The basalt remembers every eruption in its grain.',
  tier: 'mid',
  layerRange: [6, 10],
  bgColor: 0x1a0a0a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x8B4513,
    [BlockType.SoftRock]: 0x6B3410,
    [BlockType.Stone]: 0x4a3030,
    [BlockType.HardRock]: 0x3a2020,
  },
  blockWeights: { dirt: 0.6, softRock: 0.8, stone: 1.2, hardRock: 1.4 },
  hazardMultipliers: { lava: 2.5, gas: 0.5, unstable: 1.5 },
  mineralWeights: { dust: 0.3, shard: 0.7 },
  fogTint: 0x2a1010,
  palette: ['#1a0a0a', '#4a1a0a', '#8B4513', '#cc3300'],
  structuralFeatures: ['lava_streams', 'obsidian_spires'],
  particles: [],
  spritePrefix: 'biome_volcanic_tunnels',
  isAnomaly: false,
}
```

---

#### Biome 7: Crystal Caves

```typescript
{
  id: 'crystal_caves',
  name: 'Crystal Caves',
  flavorText: 'Quartz and amethyst formations refract light that has no source. Geological magic.',
  tier: 'mid',
  layerRange: [6, 10],
  bgColor: 0x0a0a1a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3a4a6a,
    [BlockType.SoftRock]: 0x4a5a7a,
    [BlockType.Stone]: 0x5a6a8a,
    [BlockType.HardRock]: 0x3a3a5a,
  },
  blockWeights: { dirt: 0.8, softRock: 1.0, stone: 1.3, hardRock: 0.9 },
  hazardMultipliers: { lava: 0.3, gas: 1.5, unstable: 0.5 },
  mineralWeights: { shard: 0.5, crystal: 0.5 },
  fogTint: 0x10102a,
  palette: ['#0a0a1a', '#3a3a5a', '#6688cc', '#aaddff'],
  structuralFeatures: ['crystal_veins', 'pocket_caves'],
  particles: [],
  spritePrefix: 'biome_crystal_caves',
  isAnomaly: false,
}
```

---

#### Biome 8: Frozen Depths

```typescript
{
  id: 'frozen_depths',
  name: 'Frozen Depths',
  flavorText: 'Permafrost this deep defies geothermal logic. Whatever froze it has not thawed.',
  tier: 'mid',
  layerRange: [6, 10],
  bgColor: 0x0a1020,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3a5a7a,
    [BlockType.SoftRock]: 0x4a6a8a,
    [BlockType.Stone]: 0x5a7a9a,
    [BlockType.HardRock]: 0x6a8aaa,
  },
  blockWeights: { dirt: 0.7, softRock: 0.9, stone: 1.1, hardRock: 1.4 },
  hazardMultipliers: { lava: 0.1, gas: 0.8, unstable: 1.8 },
  mineralWeights: { shard: 0.6, crystal: 0.4 },
  fogTint: 0x0d1828,
  palette: ['#0a1020', '#1a3050', '#4a6a8a', '#aaccee'],
  structuralFeatures: ['ice_columns', 'pocket_caves'],
  particles: [],
  spritePrefix: 'biome_frozen_depths',
  isAnomaly: false,
}
```

---

#### Biome 9: Fungal Gardens

```typescript
{
  id: 'fungal_gardens',
  name: 'Fungal Gardens',
  flavorText: 'Bioluminescent caps the size of cars. The mycelium network predates the first animal.',
  tier: 'mid',
  layerRange: [6, 10],
  bgColor: 0x0d100a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3a5c2a,
    [BlockType.SoftRock]: 0x4a6c3a,
    [BlockType.Stone]: 0x2a3c1a,
    [BlockType.HardRock]: 0x1a2c0a,
  },
  blockWeights: { dirt: 1.1, softRock: 1.0, stone: 0.8, hardRock: 0.7 },
  hazardMultipliers: { lava: 0.2, gas: 2.0, unstable: 0.9 },
  mineralWeights: { shard: 0.7, crystal: 0.3 },
  fogTint: 0x0d1208,
  palette: ['#0d100a', '#1a3010', '#4a7a30', '#88ff44'],
  structuralFeatures: ['mushroom_clusters', 'pocket_caves'],
  particles: [],
  spritePrefix: 'biome_fungal_gardens',
  isAnomaly: false,
}
```

---

#### Biome 10: Iron Veins

```typescript
{
  id: 'iron_veins',
  name: 'Iron Veins',
  flavorText: 'Rust-red walls threaded with magnetic ore. Compasses spin. Tools feel heavier here.',
  tier: 'mid',
  layerRange: [6, 10],
  bgColor: 0x140808,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x6a2a1a,
    [BlockType.SoftRock]: 0x8a3a2a,
    [BlockType.Stone]: 0x7a3020,
    [BlockType.HardRock]: 0x5a2010,
  },
  blockWeights: { dirt: 0.7, softRock: 1.0, stone: 1.2, hardRock: 1.3 },
  hazardMultipliers: { lava: 1.0, gas: 1.0, unstable: 1.2 },
  mineralWeights: { shard: 0.5, crystal: 0.5 },
  fogTint: 0x180a08,
  palette: ['#140808', '#5a2010', '#8a3a2a', '#cc5533'],
  structuralFeatures: ['crystal_veins', 'obsidian_spires'],
  particles: [],
  spritePrefix: 'biome_iron_veins',
  isAnomaly: false,
}
```

---

#### Biome 11: Magma Channels

```typescript
{
  id: 'magma_channels',
  name: 'Magma Channels',
  flavorText: 'Flowing magma rivers carve new geometry daily. Obsidian banks mark where yesterday\'s lava cooled.',
  tier: 'deep',
  layerRange: [11, 15],
  bgColor: 0x200505,
  blockColorOverrides: {
    [BlockType.Dirt]: 0xaa3310,
    [BlockType.SoftRock]: 0x8a2808,
    [BlockType.Stone]: 0x6a1c04,
    [BlockType.HardRock]: 0x4a1002,
  },
  blockWeights: { dirt: 0.5, softRock: 0.7, stone: 1.3, hardRock: 1.5 },
  hazardMultipliers: { lava: 3.5, gas: 0.4, unstable: 2.0 },
  mineralWeights: { crystal: 0.6, geode: 0.4 },
  fogTint: 0x280808,
  palette: ['#200505', '#6a1c04', '#cc3300', '#ff6600'],
  structuralFeatures: ['magma_rivers', 'lava_streams', 'obsidian_spires'],
  particles: [],
  spritePrefix: 'biome_magma_channels',
  isAnomaly: false,
}
```

---

#### Biome 12: Obsidian Halls

```typescript
{
  id: 'obsidian_halls',
  name: 'Obsidian Halls',
  flavorText: 'Volcanic glass walls so reflective you see yourself digging. Sharp edges discourage lingering.',
  tier: 'deep',
  layerRange: [11, 15],
  bgColor: 0x080808,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x1a1a2a,
    [BlockType.SoftRock]: 0x2a2a3a,
    [BlockType.Stone]: 0x1a1a1a,
    [BlockType.HardRock]: 0x0a0a0a,
  },
  blockWeights: { dirt: 0.4, softRock: 0.6, stone: 1.5, hardRock: 1.8 },
  hazardMultipliers: { lava: 2.0, gas: 0.5, unstable: 1.5 },
  mineralWeights: { crystal: 0.5, geode: 0.5 },
  fogTint: 0x0a0a10,
  palette: ['#080808', '#1a1a2a', '#3a3a4a', '#5a5a6a'],
  structuralFeatures: ['obsidian_spires', 'void_columns'],
  particles: [],
  spritePrefix: 'biome_obsidian_halls',
  isAnomaly: false,
}
```

---

#### Biome 13: Bioluminescent Abyss

```typescript
{
  id: 'bioluminescent_abyss',
  name: 'Bioluminescent Abyss',
  flavorText: 'Deep-sea biology transplanted underground. Alien flora pulsing with cold light. This shouldn\'t exist.',
  tier: 'deep',
  layerRange: [11, 15],
  bgColor: 0x030a14,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x0a3a4a,
    [BlockType.SoftRock]: 0x0a4a5a,
    [BlockType.Stone]: 0x0a2a3a,
    [BlockType.HardRock]: 0x051a28,
  },
  blockWeights: { dirt: 0.8, softRock: 1.1, stone: 1.0, hardRock: 0.9 },
  hazardMultipliers: { lava: 0.2, gas: 1.8, unstable: 0.7 },
  mineralWeights: { crystal: 0.4, geode: 0.6 },
  fogTint: 0x030a14,
  palette: ['#030a14', '#051a28', '#0a4a5a', '#00ffcc'],
  structuralFeatures: ['living_veins', 'pocket_caves'],
  particles: [],
  spritePrefix: 'biome_bioluminescent_abyss',
  isAnomaly: false,
}
```

---

#### Biome 14: Fossil Beds

```typescript
{
  id: 'fossil_beds',
  name: 'Fossil Beds',
  flavorText: 'Densely packed ancient remains. Every block hides something that used to breathe.',
  tier: 'deep',
  layerRange: [11, 15],
  bgColor: 0x14100a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x6a5040,
    [BlockType.SoftRock]: 0x5a4030,
    [BlockType.Stone]: 0x4a3020,
    [BlockType.HardRock]: 0x3a2010,
  },
  blockWeights: { dirt: 0.9, softRock: 1.1, stone: 1.0, hardRock: 0.8 },
  hazardMultipliers: { lava: 0.5, gas: 1.0, unstable: 1.3 },
  mineralWeights: { crystal: 0.3, geode: 0.7 },
  fogTint: 0x180f08,
  palette: ['#14100a', '#3a2010', '#6a5040', '#aa8860'],
  structuralFeatures: ['fossil_beds', 'amber_inclusions'],
  particles: [],
  spritePrefix: 'biome_fossil_beds',
  isAnomaly: false,
}
```

---

#### Biome 15: Copper Labyrinth

```typescript
{
  id: 'copper_labyrinth',
  name: 'Copper Labyrinth',
  flavorText: 'Winding passages lined with green-patinated copper. Electrical currents arc through the walls.',
  tier: 'deep',
  layerRange: [11, 15],
  bgColor: 0x081410,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x2a6a4a,
    [BlockType.SoftRock]: 0x3a7a5a,
    [BlockType.Stone]: 0x1a4a3a,
    [BlockType.HardRock]: 0x0a3020,
  },
  blockWeights: { dirt: 0.8, softRock: 1.0, stone: 1.1, hardRock: 1.0 },
  hazardMultipliers: { lava: 0.4, gas: 1.6, unstable: 1.4 },
  mineralWeights: { crystal: 0.4, geode: 0.4, essence: 0.2 },
  fogTint: 0x081410,
  palette: ['#081410', '#0a3020', '#3a7a5a', '#44cc88'],
  structuralFeatures: ['copper_traces', 'root_corridors'],
  particles: [],
  spritePrefix: 'biome_copper_labyrinth',
  isAnomaly: false,
}
```

---

#### Biome 16: Core Forge

```typescript
{
  id: 'core_forge',
  name: 'Core Forge',
  flavorText: 'Near-core temperatures. The rock flows like taffy. Liquid metal pools in depressions.',
  tier: 'extreme',
  layerRange: [16, 20],
  bgColor: 0x280800,
  blockColorOverrides: {
    [BlockType.Dirt]: 0xcc4400,
    [BlockType.SoftRock]: 0xaa3300,
    [BlockType.Stone]: 0x882200,
    [BlockType.HardRock]: 0x661100,
  },
  blockWeights: { dirt: 0.3, softRock: 0.5, stone: 1.5, hardRock: 2.0 },
  hazardMultipliers: { lava: 4.0, gas: 0.5, unstable: 2.5 },
  mineralWeights: { geode: 0.4, essence: 0.6 },
  fogTint: 0x300a00,
  palette: ['#280800', '#661100', '#cc4400', '#ff8800'],
  structuralFeatures: ['magma_rivers', 'lava_streams', 'obsidian_spires'],
  particles: [],
  spritePrefix: 'biome_core_forge',
  isAnomaly: false,
}
```

---

#### Biome 17: Diamond Lattice

```typescript
{
  id: 'diamond_lattice',
  name: 'Diamond Lattice',
  flavorText: 'Crystalline structure formed under millions of years of extreme pressure. Brilliant. Merciless.',
  tier: 'extreme',
  layerRange: [16, 20],
  bgColor: 0x08081a,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x4a4a6a,
    [BlockType.SoftRock]: 0x6a6a8a,
    [BlockType.Stone]: 0x8a8aaa,
    [BlockType.HardRock]: 0xaaaabb,
  },
  blockWeights: { dirt: 0.4, softRock: 0.6, stone: 1.4, hardRock: 2.2 },
  hazardMultipliers: { lava: 0.8, gas: 1.2, unstable: 2.0 },
  mineralWeights: { geode: 0.3, essence: 0.7 },
  fogTint: 0x0a0a20,
  palette: ['#08081a', '#4a4a6a', '#8a8aaa', '#ddeeff'],
  structuralFeatures: ['crystal_veins', 'ice_columns'],
  particles: [],
  spritePrefix: 'biome_diamond_lattice',
  isAnomaly: false,
}
```

---

#### Biome 18: Void Pockets

```typescript
{
  id: 'void_pockets',
  name: 'Void Pockets',
  flavorText: 'Gravity anomalies. Debris floats. The darkness here absorbs light differently than ordinary darkness.',
  tier: 'extreme',
  layerRange: [16, 20],
  bgColor: 0x020206,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x1a1a2a,
    [BlockType.SoftRock]: 0x14141e,
    [BlockType.Stone]: 0x0e0e16,
    [BlockType.HardRock]: 0x08080e,
  },
  blockWeights: { dirt: 0.5, softRock: 0.6, stone: 1.0, hardRock: 1.5 },
  hazardMultipliers: { lava: 0.5, gas: 2.5, unstable: 3.0 },
  mineralWeights: { geode: 0.5, essence: 0.5 },
  fogTint: 0x020206,
  palette: ['#020206', '#0e0e16', '#1a1a2a', '#4444aa'],
  structuralFeatures: ['void_columns', 'floating_islands'],
  particles: [],
  spritePrefix: 'biome_void_pockets',
  isAnomaly: false,
}
```

---

#### Biome 19: Ancient Ruins

```typescript
{
  id: 'ancient_ruins',
  name: 'Ancient Ruins',
  flavorText: 'Pre-human civilization. The geometry is wrong. The materials are not from Earth.',
  tier: 'extreme',
  layerRange: [16, 20],
  bgColor: 0x0c0c10,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3a3850,
    [BlockType.SoftRock]: 0x4a4860,
    [BlockType.Stone]: 0x5a5870,
    [BlockType.HardRock]: 0x2a2838,
  },
  blockWeights: { dirt: 0.6, softRock: 0.8, stone: 1.2, hardRock: 1.4 },
  hazardMultipliers: { lava: 1.0, gas: 1.5, unstable: 2.5 },
  mineralWeights: { geode: 0.4, essence: 0.6 },
  fogTint: 0x0c0c14,
  palette: ['#0c0c10', '#2a2838', '#5a5870', '#aaaacc'],
  structuralFeatures: ['ruin_walls', 'amber_inclusions', 'void_columns'],
  particles: [],
  spritePrefix: 'biome_ancient_ruins',
  isAnomaly: false,
}
```

---

#### Biome 20: Plasma Conduits

```typescript
{
  id: 'plasma_conduits',
  name: 'Plasma Conduits',
  flavorText: 'Streams of plasma contained by magnetic fields that predate recorded science. Touch one and cease.',
  tier: 'extreme',
  layerRange: [16, 20],
  bgColor: 0x080818,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x2a1a5a,
    [BlockType.SoftRock]: 0x3a2a6a,
    [BlockType.Stone]: 0x1a0a4a,
    [BlockType.HardRock]: 0x100830,
  },
  blockWeights: { dirt: 0.5, softRock: 0.7, stone: 1.3, hardRock: 1.7 },
  hazardMultipliers: { lava: 1.5, gas: 3.0, unstable: 2.0 },
  mineralWeights: { geode: 0.2, essence: 0.8 },
  fogTint: 0x08081a,
  palette: ['#080818', '#1a0a4a', '#6633cc', '#aa66ff'],
  structuralFeatures: ['plasma_nodes', 'lava_streams'],
  particles: [],
  spritePrefix: 'biome_plasma_conduits',
  isAnomaly: false,
}
```

---

#### Biome 21: Time-Fractured (Anomaly)

```typescript
{
  id: 'time_fractured',
  name: 'Time-Fractured',
  flavorText: 'GAIA: "I am detecting temporal displacement in the local substrate. This is not recommended."',
  tier: 'anomaly',
  layerRange: [1, 20],
  bgColor: 0x100818,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x5a3a6a,
    [BlockType.SoftRock]: 0x4a2a5a,
    [BlockType.Stone]: 0x3a1a4a,
    [BlockType.HardRock]: 0x2a0a3a,
  },
  blockWeights: { dirt: 0.9, softRock: 0.9, stone: 1.0, hardRock: 1.0 },
  hazardMultipliers: { lava: 1.0, gas: 1.0, unstable: 2.0 },
  mineralWeights: { dust: 0.2, shard: 0.2, crystal: 0.2, geode: 0.2, essence: 0.2 },
  fogTint: 0x140a20,
  palette: ['#100818', '#2a0a3a', '#6633aa', '#cc99ff'],
  structuralFeatures: ['temporal_fractures', 'glitch_tiles', 'floating_islands'],
  particles: [],
  spritePrefix: 'biome_time_fractured',
  isAnomaly: true,
}
```

---

#### Biome 22: Gravity Well (Anomaly)

```typescript
{
  id: 'gravity_well',
  name: 'Gravity Well',
  flavorText: 'GAIA: "Local gravitational constant is... irregular. I recommend not jumping."',
  tier: 'anomaly',
  layerRange: [1, 20],
  bgColor: 0x060614,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x1a1a4a,
    [BlockType.SoftRock]: 0x2a2a5a,
    [BlockType.Stone]: 0x3a3a6a,
    [BlockType.HardRock]: 0x0a0a2a,
  },
  blockWeights: { dirt: 0.7, softRock: 0.8, stone: 1.0, hardRock: 1.3 },
  hazardMultipliers: { lava: 0.8, gas: 1.5, unstable: 3.5 },
  mineralWeights: { dust: 0.15, shard: 0.2, crystal: 0.25, geode: 0.25, essence: 0.15 },
  fogTint: 0x060614,
  palette: ['#060614', '#0a0a2a', '#3a3a6a', '#8888ff'],
  structuralFeatures: ['floating_islands', 'void_columns'],
  particles: [],
  spritePrefix: 'biome_gravity_well',
  isAnomaly: true,
}
```

---

#### Biome 23: Mirror Realm (Anomaly)

```typescript
{
  id: 'mirror_realm',
  name: 'Mirror Realm',
  flavorText: 'GAIA: "The mine has achieved bilateral symmetry. This is statistically impossible. Yet."',
  tier: 'anomaly',
  layerRange: [1, 20],
  bgColor: 0x0a0a14,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x4a4a6a,
    [BlockType.SoftRock]: 0x5a5a7a,
    [BlockType.Stone]: 0x3a3a5a,
    [BlockType.HardRock]: 0x2a2a4a,
  },
  blockWeights: { dirt: 0.8, softRock: 1.0, stone: 1.0, hardRock: 1.0 },
  hazardMultipliers: { lava: 1.0, gas: 1.0, unstable: 1.0 },
  mineralWeights: { dust: 0.1, shard: 0.2, crystal: 0.3, geode: 0.25, essence: 0.15 },
  fogTint: 0x0a0a18,
  palette: ['#0a0a14', '#2a2a4a', '#5a5a7a', '#aaaacc'],
  structuralFeatures: ['mirror_symmetry', 'crystal_veins'],
  particles: [],
  spritePrefix: 'biome_mirror_realm',
  isAnomaly: true,
}
```

---

#### Biome 24: Living Rock (Anomaly)

```typescript
{
  id: 'living_rock',
  name: 'Living Rock',
  flavorText: 'GAIA: "The rock is... responding to your presence. I have no explanation. I find this exciting."',
  tier: 'anomaly',
  layerRange: [1, 20],
  bgColor: 0x0a1408,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x3a5a2a,
    [BlockType.SoftRock]: 0x4a6a3a,
    [BlockType.Stone]: 0x2a4a1a,
    [BlockType.HardRock]: 0x1a3a0a,
  },
  blockWeights: { dirt: 1.0, softRock: 1.2, stone: 0.9, hardRock: 0.7 },
  hazardMultipliers: { lava: 0.5, gas: 1.5, unstable: 1.5 },
  mineralWeights: { dust: 0.1, shard: 0.2, crystal: 0.3, geode: 0.25, essence: 0.15 },
  fogTint: 0x0a1408,
  palette: ['#0a1408', '#1a3a0a', '#4a6a3a', '#88cc44'],
  structuralFeatures: ['living_veins', 'mushroom_clusters', 'root_corridors'],
  particles: [],
  spritePrefix: 'biome_living_rock',
  isAnomaly: true,
}
```

---

#### Biome 25: Data Corruption (Anomaly)

```typescript
{
  id: 'data_corruption',
  name: 'Data Corruption',
  flavorText: 'GAIA: "I am experiencing rendering anomalies. The mine data has become... corrupted. Or artistic. Unclear."',
  tier: 'anomaly',
  layerRange: [1, 20],
  bgColor: 0x080808,
  blockColorOverrides: {
    [BlockType.Dirt]: 0x1a1a1a,
    [BlockType.SoftRock]: 0xff00ff,
    [BlockType.Stone]: 0x00ffff,
    [BlockType.HardRock]: 0xffff00,
  },
  blockWeights: { dirt: 0.8, softRock: 0.8, stone: 0.8, hardRock: 0.8 },
  hazardMultipliers: { lava: 1.0, gas: 1.0, unstable: 1.0 },
  mineralWeights: { dust: 0.2, shard: 0.2, crystal: 0.2, geode: 0.2, essence: 0.2 },
  fogTint: 0x080808,
  palette: ['#080808', '#1a1a1a', '#ff00ff', '#00ffff'],
  structuralFeatures: ['glitch_tiles', 'temporal_fractures'],
  particles: [],
  spritePrefix: 'biome_data_corruption',
  isAnomaly: true,
}
```

---

### Acceptance Criteria

- `BIOMES.length === 25`.
- `BIOMES.filter(b => b.tier === 'shallow').length === 5` — exactly biomes 1-5.
- `BIOMES.filter(b => b.tier === 'mid').length === 5` — exactly biomes 6-10.
- `BIOMES.filter(b => b.tier === 'deep').length === 5` — exactly biomes 11-15.
- `BIOMES.filter(b => b.tier === 'extreme').length === 5` — exactly biomes 16-20.
- `BIOMES.filter(b => b.isAnomaly).length === 5` — exactly biomes 21-25.
- All IDs are unique strings (no duplicates).
- `npm run typecheck` passes with zero errors.
- `npm run build` completes successfully.
- `DEFAULT_BIOME.id === 'sedimentary_flats'`.
- Running the verification script at `/tmp/verify-biomes.mjs` prints a deterministic sequence with no undefined entries and confirms layer 1 is always `sedimentary_flats`.

### Playwright Test Script

```js
// /tmp/test-9.2.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })

  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9.2-mine.png' })

  const biomeErrors = errors.filter(e =>
    e.toLowerCase().includes('biome') ||
    e.toLowerCase().includes('undefined') ||
    e.toLowerCase().includes('cannot read')
  )
  if (biomeErrors.length > 0) {
    console.error('FAIL: Errors detected:', biomeErrors)
    process.exit(1)
  }
  console.log('PASS: 25 biomes loaded, mine renders without errors')
  await browser.close()
})()
```

### Verification Gate

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — zero errors
- [ ] `BIOMES.length === 25` confirmed via verification script
- [ ] All five tier counts (5 each) confirmed via verification script
- [ ] `isAnomaly` count is exactly 5
- [ ] Screenshot `/tmp/ss-9.2-mine.png` shows mine rendered normally

---

## Sub-Phase 9.3: Per-Biome Tile Sprites

### Overview

Each biome needs four mining block sprites (dirt, soft rock, stone, hard rock) and one background wall texture in both 32px and 256px resolutions. That is 25 biomes × 5 sprite variants × 2 resolutions = 250 sprite files. Generating all 250 manually is infeasible; this sub-phase uses the ComfyUI SDXL pixel art pipeline to batch-generate them.

The sprites follow a strict naming convention tied to the `spritePrefix` field set in Sub-Phase 9.2:

```
src/assets/sprites/tiles/{spritePrefix}_dirt.png        (32×32 px)
src/assets/sprites/tiles/{spritePrefix}_soft_rock.png   (32×32 px)
src/assets/sprites/tiles/{spritePrefix}_stone.png       (32×32 px)
src/assets/sprites/tiles/{spritePrefix}_hard_rock.png   (32×32 px)
src/assets/sprites/tiles/{spritePrefix}_wall.png        (32×32 px)

src/assets/sprites-hires/tiles/{spritePrefix}_dirt.png        (256×256 px)
...etc
```

`MineScene.ts` is updated to attempt loading the biome-specific tile sprite for each block type before falling back to the generic tile color. `spriteManifest.ts` requires no changes because it uses glob patterns that automatically pick up new files.

### ComfyUI Prompt Templates

The following prompt templates are used for each block type. The `{BIOME_DESCRIPTION}` placeholder is replaced per-biome as detailed in the sub-steps. All outputs start at 1024×1024 and are processed through rembg for transparency, then downscaled to 256px and 32px.

**Dirt variant:**
```
pixel art, {BIOME_DESCRIPTION} dirt ground tile, top-down 2D game sprite, seamless texture,
earthy tones, visible grain, rough texture, underground mining game,
transparent background, 32x32 pixel art, clean edges, dark ambiance
Negative: 3D, realistic, photorealistic, watermark, signature, text, ui elements
```

**Soft Rock variant:**
```
pixel art, {BIOME_DESCRIPTION} cracked rock tile, 2D game sprite, porous stone surface,
medium hardness underground rock, seamless, game tile,
transparent background, dark underground, 32x32 pixel art
Negative: 3D, photorealistic, watermark
```

**Stone variant:**
```
pixel art, {BIOME_DESCRIPTION} solid stone tile, dense hard rock, 2D mining game sprite,
seamless underground texture, compressed mineral,
transparent background, 32x32 pixel art, dark mine aesthetic
Negative: 3D, photorealistic, watermark
```

**Hard Rock variant:**
```
pixel art, {BIOME_DESCRIPTION} impenetrable bedrock, very dark heavy stone tile,
2D mining game, dense uniform texture, underground,
transparent background, 32x32 pixel art, almost black stone
Negative: 3D, photorealistic, watermark
```

**Wall (background) variant:**
```
pixel art, {BIOME_DESCRIPTION} underground wall background texture, 2D platformer game,
empty space tile showing rough carved rock face, ambient, subtle, dark,
transparent background, 32x32 pixel art, mine background
Negative: 3D, photorealistic, watermark, bright colors
```

### Per-Biome ComfyUI Description Strings

Use the following `{BIOME_DESCRIPTION}` values when generating sprites for each biome:

| Biome ID | `{BIOME_DESCRIPTION}` |
|----------|----------------------|
| `sedimentary_flats` | `layered sedimentary earth with compressed strata bands,` |
| `mossy_caverns` | `green bioluminescent moss-covered wet cave,` |
| `sandy_hollows` | `dry sandy desert underground, warm ochre tones,` |
| `root_networks` | `thick ancient tree roots embedded in dark soil,` |
| `clay_deposits` | `dense reddish clay pottery-shard ancient earth,` |
| `volcanic_tunnels` | `dark basalt volcanic cooled lava tube, ember glow,` |
| `crystal_caves` | `purple amethyst quartz crystal geode formation, glowing,` |
| `frozen_depths` | `icy blue permafrost frozen underground, frost crystals,` |
| `fungal_gardens` | `bioluminescent mushroom mycelium cave, cyan-green glow,` |
| `iron_veins` | `rust-red iron ore vein metallic underground wall,` |
| `magma_channels` | `orange-red flowing magma channel obsidian banks, extreme heat,` |
| `obsidian_halls` | `black glass obsidian volcanic smooth dark reflective,` |
| `bioluminescent_abyss` | `deep sea alien flora glowing teal-cyan underwater cave,` |
| `fossil_beds` | `ancient bone fossil amber inclusion compressed brown stone,` |
| `copper_labyrinth` | `green patina copper ore vein electrical underground,` |
| `core_forge` | `near-core liquid metal extreme heat industrial orange-red,` |
| `diamond_lattice` | `brilliant diamond crystal lattice extreme pressure deep,` |
| `void_pockets` | `dark void gravity anomaly floating debris near-black,` |
| `ancient_ruins` | `alien pre-human civilization ruin stone wrong geometry,` |
| `plasma_conduits` | `purple energy plasma conduit magnetic field underground,` |
| `time_fractured` | `temporal fracture visual glitch mixed-era time anomaly,` |
| `gravity_well` | `deep space gravity anomaly dark blue floating rock,` |
| `mirror_realm` | `perfectly symmetrical reflective silver cave mirror surface,` |
| `living_rock` | `organic pulsing rock with red veins of life, breathing stone,` |
| `data_corruption` | `digital glitch artifact corrupted pixel magenta cyan broken,` |

### Sub-Steps

**Step 3.1** — Create the ComfyUI batch generation script at `sprite-gen/generate-biome-tiles.mjs`.

The script must:
1. Import the biome descriptions table (hardcoded or from a JSON sidecar).
2. For each biome (25 total), for each variant (dirt, soft_rock, stone, hard_rock, wall):
   a. Construct the full ComfyUI API payload using the SDXL workflow template from `docs/SPRITE_PIPELINE.md`.
   b. POST to `http://localhost:8188/prompt`.
   c. Poll `/history/{prompt_id}` until completion.
   d. Download the output image.
   e. Run rembg for transparency removal: `python3 -c "from rembg import remove; ..."` (see pipeline docs).
   f. Downscale to 256×256 and save to `src/assets/sprites-hires/tiles/{spritePrefix}_{variant}.png`.
   g. Downscale to 32×32 and save to `src/assets/sprites/tiles/{spritePrefix}_{variant}.png`.
3. Log progress per biome. Skip biomes where both resolution files already exist (for resumability).
4. After all sprites are generated, print a summary: total generated, total skipped, any failures.

For the initial implementation, generate only the three most-used biomes first (sedimentary_flats, volcanic_tunnels, crystal_caves) to validate the pipeline, then run for all 25.

**Step 3.2** — Update `src/game/scenes/MineScene.ts` to attempt biome-specific sprite loading.

In the block rendering path (`drawTile()` or equivalent method), before drawing a colored rectangle fallback, check whether a biome-specific sprite key exists in the loaded sprite map:

```typescript
/**
 * Returns the sprite key for a given block type in the active biome,
 * falling back to null if no biome-specific sprite is available.
 *
 * @param blockType - The block type to look up
 * @param biome - The active biome definition
 * @param spriteUrls - The loaded sprite URL map from getSpriteUrls()
 */
function getBiomeTileSpriteKey(
  blockType: BlockType,
  biome: BiomeDefinition,
  spriteUrls: Record<string, string>
): string | null {
  const variantMap: Partial<Record<BlockType, string>> = {
    [BlockType.Dirt]: 'dirt',
    [BlockType.SoftRock]: 'soft_rock',
    [BlockType.Stone]: 'stone',
    [BlockType.HardRock]: 'hard_rock',
    [BlockType.Empty]: 'wall',
  }
  const variant = variantMap[blockType]
  if (!variant) return null
  const key = `${biome.spritePrefix}_${variant}`
  return spriteUrls[key] ? key : null
}
```

If a sprite key is found, render the tile as a `Phaser.GameObjects.Image` using that sprite. If not, fall back to the existing colored-rectangle rendering. This ensures zero visual regression on layers where sprites haven't been generated yet.

**Step 3.3** — Update `src/game/spriteManifest.ts` to document the new naming convention.

Add a JSDoc comment above `getSpriteUrls()` noting that biome tile sprites follow the `biome_{id}_{variant}` naming pattern and are auto-discovered by the existing glob patterns. No code changes required, only documentation.

**Step 3.4** — Add a developer toggle in `src/game/scenes/MineScene.ts` to force a specific biome for testing.

In the scene's `init()` or `create()` method, check for a `?biome=<id>` query parameter in the URL. If present and valid, override the seeded biome selection for that layer. This enables QA testing of any biome without needing to reach its natural depth tier.

```typescript
// In MineScene.create() or init():
const urlParams = new URLSearchParams(window.location.search)
const biomeOverride = urlParams.get('biome')
if (biomeOverride) {
  const found = BIOMES.find(b => b.id === biomeOverride)
  if (found) {
    this.activeBiome = found
    console.info(`[MineScene] Biome override active: ${found.name}`)
  }
}
```

### Acceptance Criteria

- Sprite generation script runs without error for at least the three pilot biomes (sedimentary_flats, volcanic_tunnels, crystal_caves).
- Output files exist at both 32px and 256px resolutions for each generated biome variant.
- All generated PNGs have transparent backgrounds (validated by checking alpha channel with `pngjs` or `sharp`).
- `MineScene` loads and renders without error when biome-specific sprites are present.
- `MineScene` renders correctly with colored-rectangle fallback when biome sprites are absent (no regression).
- The `?biome=<id>` developer override routes to the correct biome definition.
- `npm run typecheck` passes with zero errors.

### Playwright Test Script

```js
// /tmp/test-9.3.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
    if (msg.type() === 'info' && msg.text().includes('Biome override')) {
      console.log('Biome override confirmed:', msg.text())
    }
  })

  // Test biome override: force volcanic_tunnels
  await page.goto('http://localhost:5173?biome=volcanic_tunnels')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9.3-volcanic.png' })

  // Test crystal_caves override
  await page.goto('http://localhost:5173?biome=crystal_caves')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9.3-crystal.png' })

  if (errors.length > 0) {
    console.error('FAIL: Console errors during biome override tests:', errors)
    process.exit(1)
  }
  console.log('PASS: Biome overrides functional, screenshots captured')
  await browser.close()
})()
```

### Verification Gate

- [ ] `sprite-gen/generate-biome-tiles.mjs` exists and runs for pilot biomes without error
- [ ] Sprite files present for at least 3 biomes at both 32px and 256px
- [ ] All sprite PNGs have transparent backgrounds
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — zero errors
- [ ] `?biome=volcanic_tunnels` override confirmed in browser console log
- [ ] Screenshots `/tmp/ss-9.3-volcanic.png` and `/tmp/ss-9.3-crystal.png` show visually distinct palettes
- [ ] No console errors during biome override tests

---

## Files Affected (Sub-Phases 9.1-9.3)

| File | Change Type | Sub-Phase |
|------|-------------|-----------|
| `src/data/biomes.ts` | Extend interface, add 22 new biome entries | 9.1, 9.2 |
| `src/game/scenes/MineScene.ts` | Biome sprite lookup, developer override | 9.3 |
| `src/game/spriteManifest.ts` | JSDoc update only | 9.3 |
| `sprite-gen/generate-biome-tiles.mjs` | New file — ComfyUI batch generator | 9.3 |
| `src/assets/sprites/tiles/biome_*.png` | New files (250 total at completion) | 9.3 |
| `src/assets/sprites-hires/tiles/biome_*.png` | New files (250 total at completion) | 9.3 |

---
# Phase 9 Biome Expansion — Sub-phases 9.4 through 9.7 + Final Verification Gate

---

## Sub-phase 9.4: Structural Generation

### Overview

Sub-phase 9.4 adds biome-specific structural features to mine generation. Each biome defines 2–4 unique structural features such as rooms, corridors, and formations that are procedurally placed after the base grid is generated. Structural features make each biome visually and spatially distinct, contain gameplay rewards (bonus minerals, hidden passages, hazard concentrations), and reinforce the thematic identity of the 25 biomes. All generation logic lives in `MineGenerator.ts` with supporting types in `src/data/biomeStructures.ts`.

### Sub-steps

**Step 9.4.1 — Define StructuralFeature type**

File: `src/data/biomeStructures.ts` (new file)

```typescript
/**
 * A single placeable structural feature unique to a biome.
 */
export interface StructuralFeature {
  id: string;
  biomeId: string;
  /** Pure function: given a top-left origin and grid, mutates the grid in place */
  generationFn: (grid: TileGrid, originX: number, originY: number, rng: RNG) => void;
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  /** 0.0–1.0: probability of attempting placement per valid zone */
  frequency: number;
  spriteKeys: string[];
  /** Optional bonus contents placed inside the feature */
  bonusContents?: StructuralBonus[];
}

export interface StructuralBonus {
  type: 'mineral' | 'passage' | 'hazard';
  value: string;
  chance: number;
}

export type TileGrid = number[][];
export type RNG = () => number;
```

**Step 9.4.2 — Define structural features for all 25 biomes**

File: `src/data/biomeStructures.ts` (continued)

Define and export `BIOME_STRUCTURAL_FEATURES: Record<string, StructuralFeature[]>` with 2–4 entries per biome. The full 25-biome list:

- `sedimentary_shelf`: layered overhangs, horizontal sediment bands
- `mossy_cavern`: drip pools, hanging moss curtains, wet alcoves
- `sandy_hollow`: sand trap pits, dune ridges, buried chest alcoves
- `root_network`: vine bridges (traversable horizontally), root-walled corridors, tangled knots
- `clay_deposits`: clay mound formations, mudslide chutes, imprint fossils
- `volcanic_vents`: lava pools (hazard zones), vent columns emitting gas, obsidian spike fields
- `crystal_caves`: crystal cluster formations, refraction chambers, gemstone veins
- `frozen_depths`: ice pillar arrays, cryo-pocket sealed rooms, frost bridges
- `fungal_gardens`: mushroom grove circles, spore vent shafts, mycelium mat floors
- `iron_seams`: iron scaffold remnants, ore-vein corridors, magnetite lodestones
- `magma_channels`: magma river cuts (impassable hazard lines), cooled lava shelves, thermal chimneys
- `obsidian_fields`: obsidian blade forests, glass-smooth corridors, shatter zones
- `bioluminescent_grotto`: glow-pool basins, luminous pillar forests, bio-light alcoves
- `fossil_beds`: fossil exposure walls, excavation trenches, amber inclusions
- `copper_lodes`: verdigris-stained chambers, copper pipe ruins, oxidation pools
- `core_forge`: molten metal rivers, forge-ruin structures, cooling-metal platforms
- `diamond_lattice`: diamond scaffolding matrices, prismatic light shafts, pressure vaults
- `void_pockets`: floating island clusters, gravity-null corridors, void tear rifts
- `ancient_ruins`: ruined chamber sets, collapsed columns, sealed vault doors
- `plasma_conduits`: plasma tube networks, arc-conductor pylons, energy node clusters
- `time_fractured`: temporal echo chambers (duplicate-tile rooms), timeline fracture cracks, chrono-locked vaults
- `gravity_well`: inverted ceiling formations, orbital debris rings, graviton cores
- `mirror_realm`: mirror-wall corridors (reflective tile), symmetry chambers, false-passage illusions
- `living_rock`: pulsing organ chambers, vein-wall corridors, bio-mass nodes
- `data_corruption`: glitch-tile patches, corrupted data vaults, artifact terminal ruins

Each `generationFn` signature:

```typescript
(grid: TileGrid, originX: number, originY: number, rng: RNG) => void
```

**Step 9.4.3 — Add placement scanner to MineGenerator**

File: `src/game/MineGenerator.ts`

Add method `placeStructuralFeatures(grid: TileGrid, biomeId: string, rng: RNG): void`:

```typescript
/**
 * Scans the grid for valid placement zones and places biome-specific
 * structural features with collision checks after base grid generation.
 */
private placeStructuralFeatures(
  grid: TileGrid,
  biomeId: string,
  rng: RNG
): void {
  const features = BIOME_STRUCTURAL_FEATURES[biomeId] ?? [];
  for (const feature of features) {
    const zones = this.findValidZones(grid, feature.minSize);
    for (const zone of zones) {
      if (rng() < feature.frequency) {
        const w = feature.minSize.width +
          Math.floor(rng() * (feature.maxSize.width - feature.minSize.width + 1));
        const h = feature.minSize.height +
          Math.floor(rng() * (feature.maxSize.height - feature.minSize.height + 1));
        if (this.checkCollision(grid, zone.x, zone.y, w, h)) continue;
        feature.generationFn(grid, zone.x, zone.y, rng);
        this.placeBonusContents(grid, zone.x, zone.y, w, h, feature.bonusContents ?? [], rng);
      }
    }
  }
}
```

**Step 9.4.4 — Add collision checker**

File: `src/game/MineGenerator.ts`

```typescript
/**
 * Returns true if the bounding box overlaps any already-placed feature marker.
 */
private checkCollision(
  grid: TileGrid,
  x: number, y: number,
  w: number, h: number
): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tile = grid[y + dy]?.[x + dx];
      if (tile === TILE_FEATURE_MARKER) return true;
    }
  }
  return false;
}
```

Constant `TILE_FEATURE_MARKER = 255` reserved in tile enum.

**Step 9.4.5 — Add valid zone finder**

File: `src/game/MineGenerator.ts`

```typescript
/**
 * Finds all grid positions where a feature of minSize could fit
 * (open floor tiles, within grid bounds, away from spawn/exit).
 */
private findValidZones(
  grid: TileGrid,
  minSize: { width: number; height: number }
): Array<{ x: number; y: number }> {
  const zones: Array<{ x: number; y: number }> = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let y = 1; y < rows - minSize.height - 1; y++) {
    for (let x = 1; x < cols - minSize.width - 1; x++) {
      if (this.isOpenArea(grid, x, y, minSize.width, minSize.height)) {
        zones.push({ x, y });
      }
    }
  }
  return zones;
}
```

**Step 9.4.6 — Add bonus content placer**

File: `src/game/MineGenerator.ts`

```typescript
/**
 * Places bonus minerals, hidden passages, or hazard tiles
 * inside a placed structural feature's bounding box.
 */
private placeBonusContents(
  grid: TileGrid,
  x: number, y: number,
  w: number, h: number,
  bonuses: StructuralBonus[],
  rng: RNG
): void {
  for (const bonus of bonuses) {
    if (rng() < bonus.chance) {
      const bx = x + Math.floor(rng() * w);
      const by = y + Math.floor(rng() * h);
      grid[by][bx] = this.resolveBonusTile(bonus);
    }
  }
}
```

**Step 9.4.7 — Wire placeStructuralFeatures into generation pipeline**

File: `src/game/MineGenerator.ts`

In the main `generate()` method, after `generateBaseGrid()` and before `placeEntities()`:

```typescript
this.placeStructuralFeatures(grid, biomeId, rng);
```

**Step 9.4.8 — Add structural feature sprite keys to biome atlas**

File: `src/game/BiomeAtlas.ts`

Extend `BiomeAtlasEntry` to include `structuralSpriteKeys: string[]`. Ensure structural sprites are loaded during atlas initialization so generation functions can reference valid keys.

### Acceptance Criteria

- All 25 biomes have 2–4 registered `StructuralFeature` entries in `BIOME_STRUCTURAL_FEATURES`
- `placeStructuralFeatures` is called in the generation pipeline after base grid creation
- No two structural features overlap (collision check prevents double-placement)
- Bonus contents (minerals, passages, hazard concentrations) appear inside features at correct rates
- TypeScript strict mode: no `any`, all types explicit
- `npm run typecheck` passes with no new errors

### Playwright Test Script

```javascript
// /tmp/test-9-4-structural.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Enable dev mode to expose biome debug info
  await page.evaluate(() => { localStorage.setItem('devMode', 'true') })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  // Screenshot showing structural features in default biome
  await page.screenshot({ path: '/tmp/ss-9-4-structures.png', fullPage: false })

  // Check console for structural generation errors
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Cycle through several biomes via dev panel
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    // Set biome to volcanic_vents
    const biomeSelect = await page.$('[data-testid="dev-biome-select"]')
    if (biomeSelect) {
      await biomeSelect.selectOption('volcanic_vents')
      await page.waitForTimeout(500)
      await page.screenshot({ path: '/tmp/ss-9-4-volcanic.png' })
      await biomeSelect.selectOption('crystal_caves')
      await page.waitForTimeout(500)
      await page.screenshot({ path: '/tmp/ss-9-4-crystal.png' })
      await biomeSelect.selectOption('void_pockets')
      await page.waitForTimeout(500)
      await page.screenshot({ path: '/tmp/ss-9-4-void.png' })
    }
  }

  console.log('Console errors during test:', errors.length)
  if (errors.length > 0) {
    console.error('ERRORS FOUND:', errors)
    process.exit(1)
  }
  console.log('9.4 structural generation screenshots saved.')
  await browser.close()
})()
```

### Verification Gate

- [ ] `src/data/biomeStructures.ts` exists with `StructuralFeature`, `StructuralBonus`, `TileGrid`, `RNG` types
- [ ] All 25 biomes have 2–4 `StructuralFeature` entries
- [ ] `placeStructuralFeatures` integrated in `MineGenerator.generate()` pipeline
- [ ] Collision check prevents overlapping features
- [ ] Bonus contents (minerals/passages/hazards) appear inside features
- [ ] Screenshots show visually distinct structures in volcanic, crystal, and void biomes
- [ ] No TypeScript errors: `npm run typecheck` clean
- [ ] No runtime errors in browser console during structural generation

---

## Sub-phase 9.5: Ambient Particle Systems

### Overview

Sub-phase 9.5 adds per-biome ambient particle emitters using Phaser 3's built-in particle system. Each of the 25 biomes defines 1–3 particle types that play continuously in the background of the mine scene, reinforcing atmosphere without impeding gameplay. Performance is a hard constraint: the total particle count on screen must never exceed 50, and the system automatically reduces particle density on low-capability devices. All particle configuration lives in `src/data/biomeParticles.ts` and the emitter management logic lives in `src/game/BiomeParticleManager.ts`.

### Sub-steps

**Step 9.5.1 — Define ParticleConfig type**

File: `src/data/biomeParticles.ts` (new file)

```typescript
import Phaser from 'phaser'

/**
 * Configuration for a single ambient particle emitter in a biome.
 */
export interface ParticleConfig {
  /** Key of a preloaded texture in the Phaser texture cache */
  texture: string;
  tint: number;
  /** Alpha range [min, max] */
  alpha: { min: number; max: number };
  /** Scale range [min, max] */
  scale: { min: number; max: number };
  /** Speed range in px/s [min, max] */
  speed: { min: number; max: number };
  /** Lifespan in ms [min, max] */
  lifespan: { min: number; max: number };
  /** Particles emitted per second */
  frequency: number;
  blendMode: Phaser.BlendModes | number;
  /** Direction of travel in degrees [min, max] */
  angle?: { min: number; max: number };
  /** Gravity modifier (negative = rise) */
  gravityY?: number;
}
```

**Step 9.5.2 — Define particle configs for all 25 biomes**

File: `src/data/biomeParticles.ts` (continued)

Export `BIOME_PARTICLE_CONFIGS: Record<string, ParticleConfig[]>` with 1–3 entries per biome:

- `sedimentary_shelf`: dust motes (slow rising, brown tint, ADD blend)
- `mossy_cavern`: water drops (fall downward, blue-green, NORMAL blend), mist wisps (slow drift, white, ADD)
- `sandy_hollow`: sand grains (low horizontal drift, tan, NORMAL), heat shimmer dots (small, fast, yellow-white, ADD)
- `root_network`: floating spores (gentle rise, green-white, ADD), leaf fragments (tumble, dark green, NORMAL)
- `clay_deposits`: clay dust (low, slow, orange-brown, NORMAL)
- `volcanic_vents`: embers (rise fast, red-orange, ADD), ash flakes (fall slow, dark gray, NORMAL), sparks (burst radial, yellow, ADD)
- `crystal_caves`: crystal sparkles (twinkle, cyan-white, ADD), refraction glints (fast flash, rainbow, ADD)
- `frozen_depths`: snowflakes (fall slow, white, NORMAL), ice mist (drift low, pale blue, ADD)
- `fungal_gardens`: spore clouds (rise slow, purple-white, ADD), bioluminescent motes (gentle drift, green, ADD)
- `iron_seams`: metallic sparks (arc downward, silver-orange, ADD), iron dust (fall, dark gray, NORMAL)
- `magma_channels`: molten droplets (arc up then fall, orange-red, ADD), heat shimmer (fast rising, yellow-white, ADD)
- `obsidian_fields`: glass shards (slow fall, black-silver, NORMAL), obsidian dust (low drift, dark, NORMAL)
- `bioluminescent_grotto`: glow orbs (drift freely, teal-green, ADD), pulse rings (expand outward, blue-white, ADD)
- `fossil_beds`: amber flecks (slow tumble, amber-gold, ADD), dust motes (fine, brown, NORMAL)
- `copper_lodes`: copper sparks (burst, orange-green, ADD), verdigris dust (drift, teal-green, NORMAL)
- `core_forge`: plasma arcs (fast zigzag, white-blue, ADD), molten droplets (arc, orange, ADD), forge sparks (burst, yellow-white, ADD)
- `diamond_lattice`: diamond refractions (prismatic flash, rainbow, ADD), light shafts (slow vertical, white, ADD)
- `void_pockets`: void wisps (drift freely, dark purple, ADD), null particles (blink, black-white, NORMAL)
- `ancient_ruins`: holographic fragments (drift, cyan, ADD), dust motes (fall slow, gray, NORMAL)
- `plasma_conduits`: plasma arcs (fast, electric blue, ADD), energy sparks (radial burst, white, ADD)
- `time_fractured`: time echoes (ghost trail, translucent white, ADD), chrono flickers (blink, gold, ADD)
- `gravity_well`: gravity particles (spiral inward, dark blue-purple, NORMAL), debris motes (orbit, gray, NORMAL)
- `mirror_realm`: mirror reflections (mirror-image drift, silver-white, ADD), glass glints (flash, white, ADD)
- `living_rock`: organic pulses (slow radial expand, red-purple, ADD), bio-motes (drift, green, NORMAL)
- `data_corruption`: glitch pixels (random teleport, neon green, ADD), scan lines (horizontal sweep, white, NORMAL)

**Step 9.5.3 — Create BiomeParticleManager**

File: `src/game/BiomeParticleManager.ts` (new file)

```typescript
import Phaser from 'phaser'
import { BIOME_PARTICLE_CONFIGS, ParticleConfig } from '../data/biomeParticles'

/** Hard cap on simultaneous on-screen particles across all emitters */
const MAX_PARTICLES = 50

/**
 * Manages per-biome ambient particle emitters.
 * Enforces a global particle budget and supports LOD reduction
 * for low-capability devices.
 */
export class BiomeParticleManager {
  private scene: Phaser.Scene
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private currentBiomeId: string | null = null
  private lodMultiplier: number = 1.0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.lodMultiplier = this.detectLOD()
  }

  /**
   * Activates particle emitters for the given biome.
   * Destroys previous biome's emitters first.
   */
  public activateBiome(biomeId: string): void {
    this.destroyAll()
    this.currentBiomeId = biomeId
    const configs = BIOME_PARTICLE_CONFIGS[biomeId] ?? []
    const perEmitterBudget = Math.floor(MAX_PARTICLES / Math.max(configs.length, 1))
    for (const config of configs) {
      const emitter = this.createEmitter(config, perEmitterBudget)
      this.emitters.push(emitter)
    }
  }

  /**
   * Destroys all active emitters and resets state.
   */
  public destroyAll(): void {
    for (const emitter of this.emitters) {
      emitter.destroy()
    }
    this.emitters = []
    this.currentBiomeId = null
  }

  /**
   * Returns the current active biome ID, or null if none.
   */
  public getActiveBiome(): string | null {
    return this.currentBiomeId
  }

  private createEmitter(
    config: ParticleConfig,
    maxParticles: number
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const adjustedFrequency = config.frequency * this.lodMultiplier
    return this.scene.add.particles(0, 0, config.texture, {
      tint: config.tint,
      alpha: config.alpha,
      scale: config.scale,
      speed: config.speed,
      lifespan: config.lifespan,
      frequency: 1000 / adjustedFrequency,
      blendMode: config.blendMode,
      angle: config.angle,
      gravityY: config.gravityY ?? 0,
      maxParticles,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(
          0, 0,
          this.scene.scale.width,
          this.scene.scale.height
        )
      }
    })
  }

  /**
   * Detects device capability and returns an LOD frequency multiplier.
   * Low-end devices get 0.3× particle frequency.
   */
  private detectLOD(): number {
    if (typeof navigator === 'undefined') return 1.0
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    if (mem !== undefined && mem <= 2) return 0.3
    return 1.0
  }
}
```

**Step 9.5.4 — Integrate BiomeParticleManager into MineScene**

File: `src/game/scenes/MineScene.ts`

1. Import `BiomeParticleManager`
2. Add private field `private particleManager: BiomeParticleManager`
3. In `create()`, after biome is resolved: `this.particleManager = new BiomeParticleManager(this); this.particleManager.activateBiome(biomeId)`
4. In `shutdown()` / `destroy()`: `this.particleManager.destroyAll()`

**Step 9.5.5 — Preload particle textures**

File: `src/game/scenes/PreloadScene.ts` (or equivalent preload scene)

Add a dedicated `preloadParticleTextures()` method that loads all unique texture keys referenced in `BIOME_PARTICLE_CONFIGS`. Use 4×4 or 8×8 pixel PNG sprites for each particle type. Store textures under `src/assets/particles/`.

**Step 9.5.6 — Add particle count telemetry to DevPanel**

File: `src/ui/DevPanel.svelte`

Add a read-only display field showing live particle count: `Particles: {count} / 50`. Read from `BiomeParticleManager` via a reactive store updated every 500ms.

### Acceptance Criteria

- All 25 biomes have 1–3 `ParticleConfig` entries in `BIOME_PARTICLE_CONFIGS`
- `BiomeParticleManager.activateBiome()` destroys previous emitters and spawns new ones
- Total on-screen particles never exceed 50 (enforced by `maxParticles` budget split)
- LOD detection reduces frequency to 0.3× on devices with ≤2 GB RAM
- `destroyAll()` is called on scene shutdown (no memory leak)
- DevPanel shows live particle count
- No TypeScript errors on `npm run typecheck`

### Playwright Test Script

```javascript
// /tmp/test-9-5-particles.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  await page.evaluate(() => { localStorage.setItem('devMode', 'true') })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(4000)

  // Screenshot: default biome particles visible
  await page.screenshot({ path: '/tmp/ss-9-5-particles-default.png' })

  // Check particle count via DevPanel
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)

    // Check particle count display
    const particleCount = await page.$eval(
      '[data-testid="dev-particle-count"]',
      el => el.textContent
    ).catch(() => 'NOT FOUND')
    console.log('Particle count display:', particleCount)

    // Test volcanic biome particles
    const biomeSelect = await page.$('[data-testid="dev-biome-select"]')
    if (biomeSelect) {
      await biomeSelect.selectOption('volcanic_vents')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-9-5-particles-volcanic.png' })

      await biomeSelect.selectOption('bioluminescent_grotto')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-9-5-particles-biolum.png' })

      await biomeSelect.selectOption('data_corruption')
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/ss-9-5-particles-glitch.png' })
    }
  }

  // Verify no errors
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  await page.waitForTimeout(1000)
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors)
    process.exit(1)
  }

  console.log('9.5 particle system screenshots saved successfully.')
  await browser.close()
})()
```

### Verification Gate

- [ ] `src/data/biomeParticles.ts` exists with `ParticleConfig` type and `BIOME_PARTICLE_CONFIGS` map
- [ ] `src/game/BiomeParticleManager.ts` exists with `activateBiome()`, `destroyAll()`, LOD detection
- [ ] All 25 biomes have 1–3 particle configs
- [ ] `MineScene` integrates `BiomeParticleManager` (create + shutdown)
- [ ] Max particle count ≤ 50 enforced at runtime
- [ ] DevPanel shows live particle count
- [ ] Screenshots confirm visible ambient particles in volcanic, bioluminescent, and data_corruption biomes
- [ ] `npm run typecheck` and `npm run build` pass with no new errors

---

## Sub-phase 9.6: Biome-Adapted Landmark Layers

### Overview

Sub-phase 9.6 makes the four landmark layers (L5 Gauntlet, L10 Treasure Vault, L15 Ancient Archive, L20 Completion Event) visually adapt to whichever biome is active when the player reaches them. Each landmark has a base template defining its layout and gameplay; biome-specific `LandmarkVariant` records overlay color tints, tile replacements, and special ambient effects on top of that base. With 25 biomes and 4 landmarks this yields up to 100 variants, though many variants share base templates and differ only in tint or a handful of tile swaps. All variant data lives in `src/data/landmarkVariants.ts` and the application logic lives in `src/game/LandmarkRenderer.ts`.

### Sub-steps

**Step 9.6.1 — Define LandmarkVariant type**

File: `src/data/landmarkVariants.ts` (new file)

```typescript
/**
 * Biome-specific visual override for a landmark layer.
 */
export interface LandmarkVariant {
  /** e.g. 'gauntlet', 'treasure_vault', 'ancient_archive', 'completion_event' */
  landmarkId: string;
  biomeId: string;
  /**
   * Map of base tile IDs to replacement tile IDs.
   * Only tiles listed here are swapped; all others use the base template.
   */
  tileOverrides: Record<number, number>;
  /**
   * 0xRRGGBB color tint applied to all landmark tiles as a post-process overlay.
   * 0xFFFFFF = no tint (identity).
   */
  colorTint: number;
  /** Particle config keys from BIOME_PARTICLE_CONFIGS to activate inside the landmark */
  specialEffects: string[];
}
```

**Step 9.6.2 — Define all 100 landmark variants (25 biomes × 4 landmarks)**

File: `src/data/landmarkVariants.ts` (continued)

Export `LANDMARK_VARIANTS: LandmarkVariant[]`. Each landmark gets a themed tint and up to 3 tile overrides per biome. Representative examples:

- **Gauntlet (L5)**:
  - `sedimentary_shelf`: tint 0xC8B89A, floor → layered sediment tile
  - `volcanic_vents`: tint 0xFF6600, wall → obsidian tile, floor → lava-cracked tile
  - `frozen_depths`: tint 0xAADDFF, wall → ice-wall tile, floor → frost tile
  - `void_pockets`: tint 0x330055, wall → void-stone tile, floor → null-space tile
  - (all 25 biomes defined)

- **Treasure Vault (L10)**:
  - `crystal_caves`: tint 0xCCFFFF, wall → crystal-inlay tile, pedestal → crystal-pedestal tile
  - `ancient_ruins`: tint 0xDDCC99, wall → carved-stone tile, floor → mosaic tile
  - `data_corruption`: tint 0x00FF44, terminal tiles visible, floor → corrupted-data tile
  - (all 25 biomes defined)

- **Ancient Archive (L15)**:
  - `fossil_beds`: tint 0xFFCC66, wall → fossil-embed tile, floor → stone-slab tile
  - `bioluminescent_grotto`: tint 0x44FFCC, wall → glowing-wall tile
  - `living_rock`: tint 0x993366, wall → pulsing-wall tile
  - (all 25 biomes defined)

- **Completion Event (L20)**:
  - `core_forge`: tint 0xFF8800, floor → molten-metal tile, ceiling → forge-ceiling tile
  - `diamond_lattice`: tint 0xEEFFFF, all walls → diamond-lattice tile
  - `time_fractured`: tint 0xFFEEAA, floor → fracture tile, echoes activated
  - (all 25 biomes defined)

Helper function:
```typescript
/**
 * Looks up the variant for a given landmark and biome.
 * Falls back to a default no-op variant if not found.
 */
export function getLandmarkVariant(
  landmarkId: string,
  biomeId: string
): LandmarkVariant {
  return (
    LANDMARK_VARIANTS.find(
      v => v.landmarkId === landmarkId && v.biomeId === biomeId
    ) ?? {
      landmarkId,
      biomeId,
      tileOverrides: {},
      colorTint: 0xFFFFFF,
      specialEffects: []
    }
  )
}
```

**Step 9.6.3 — Create LandmarkRenderer**

File: `src/game/LandmarkRenderer.ts` (new file)

```typescript
import Phaser from 'phaser'
import { getLandmarkVariant } from '../data/landmarkVariants'
import { BiomeParticleManager } from './BiomeParticleManager'

/**
 * Applies biome-specific visual overrides when rendering a landmark layer.
 */
export class LandmarkRenderer {
  private scene: Phaser.Scene
  private particleManager: BiomeParticleManager

  constructor(scene: Phaser.Scene, particleManager: BiomeParticleManager) {
    this.scene = scene
    this.particleManager = particleManager
  }

  /**
   * Applies tileOverrides, colorTint, and specialEffects for the given
   * landmark + biome combination to the provided tilemap layer.
   */
  public applyVariant(
    layer: Phaser.Tilemaps.TilemapLayer,
    landmarkId: string,
    biomeId: string
  ): void {
    const variant = getLandmarkVariant(landmarkId, biomeId)
    this.applyTileOverrides(layer, variant.tileOverrides)
    this.applyColorTint(layer, variant.colorTint)
    this.applySpecialEffects(variant.specialEffects, biomeId)
  }

  private applyTileOverrides(
    layer: Phaser.Tilemaps.TilemapLayer,
    overrides: Record<number, number>
  ): void {
    layer.forEachTile(tile => {
      if (overrides[tile.index] !== undefined) {
        tile.index = overrides[tile.index]
      }
    })
  }

  private applyColorTint(
    layer: Phaser.Tilemaps.TilemapLayer,
    colorTint: number
  ): void {
    if (colorTint === 0xFFFFFF) return
    layer.setTint(colorTint)
  }

  private applySpecialEffects(
    effectKeys: string[],
    biomeId: string
  ): void {
    if (effectKeys.length === 0) return
    // Activate only the specified effect keys from the biome's particle configs
    this.particleManager.activateBiome(biomeId)
  }
}
```

**Step 9.6.4 — Wire LandmarkRenderer into MineScene landmark loading**

File: `src/game/scenes/MineScene.ts`

1. Import `LandmarkRenderer`
2. Add private field `private landmarkRenderer: LandmarkRenderer`
3. In `create()`: `this.landmarkRenderer = new LandmarkRenderer(this, this.particleManager)`
4. When a landmark layer loads (L5, L10, L15, L20 detected): call `this.landmarkRenderer.applyVariant(tilemapLayer, landmarkId, currentBiomeId)`

**Step 9.6.5 — Add landmark biome variant preview to DevPanel**

File: `src/ui/DevPanel.svelte`

Add a dropdown `dev-landmark-select` (gauntlet / treasure_vault / ancient_archive / completion_event) that, when combined with the existing biome selector, triggers `landmarkRenderer.applyVariant()` on the current layer for preview purposes during development.

### Acceptance Criteria

- `src/data/landmarkVariants.ts` defines all 100 variants (25 biomes × 4 landmarks)
- `getLandmarkVariant()` returns a fallback no-op variant when no entry exists (never throws)
- `LandmarkRenderer.applyVariant()` correctly swaps tiles, applies tint, and activates effects
- All four landmark layers (L5/L10/L15/L20) call `applyVariant()` when generated
- No tile mismatches cause rendering artifacts (invalid tile indices handled gracefully)
- DevPanel allows previewing any landmark × biome combination
- `npm run typecheck` passes with no new errors

### Playwright Test Script

```javascript
// /tmp/test-9-6-landmarks.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  await page.evaluate(() => { localStorage.setItem('devMode', 'true') })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)

  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)

    const biomeSelect = await page.$('[data-testid="dev-biome-select"]')
    const landmarkSelect = await page.$('[data-testid="dev-landmark-select"]')

    if (biomeSelect && landmarkSelect) {
      // Test: volcanic gauntlet
      await biomeSelect.selectOption('volcanic_vents')
      await landmarkSelect.selectOption('gauntlet')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-9-6-volcanic-gauntlet.png' })

      // Test: crystal treasure vault
      await biomeSelect.selectOption('crystal_caves')
      await landmarkSelect.selectOption('treasure_vault')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-9-6-crystal-vault.png' })

      // Test: ancient ruins archive
      await biomeSelect.selectOption('ancient_ruins')
      await landmarkSelect.selectOption('ancient_archive')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-9-6-ruins-archive.png' })

      // Test: void pockets completion event
      await biomeSelect.selectOption('void_pockets')
      await landmarkSelect.selectOption('completion_event')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: '/tmp/ss-9-6-void-completion.png' })
    }
  }

  console.log('9.6 landmark variant screenshots saved.')
  await browser.close()
})()
```

### Verification Gate

- [ ] `src/data/landmarkVariants.ts` exists with `LandmarkVariant` type and 100-entry `LANDMARK_VARIANTS` array
- [ ] `getLandmarkVariant()` returns a no-op fallback for missing combinations
- [ ] `src/game/LandmarkRenderer.ts` exists with `applyVariant()` method
- [ ] All 4 landmark layer loading paths in `MineScene` call `applyVariant()`
- [ ] Screenshots confirm tint difference between biomes on the same landmark
- [ ] No tile index out-of-range errors in browser console
- [ ] DevPanel landmark preview dropdown functional
- [ ] `npm run typecheck` and `npm run build` pass

---

## Sub-phase 9.7: Biome Music and Sound

### Overview

Sub-phase 9.7 adds per-biome ambient audio, biome transition stings, and hazard-specific sound effects. Each biome defines a `BiomeAudio` record that references an ambient loop, up to three hazard sound effects, and a short transition sting played when entering the biome. An `AudioManager` handles crossfading between biome tracks on layer transitions and enforces mobile-friendly constraints (mono audio, compressed OGG/MP3, lazy loading). All audio configuration lives in `src/data/biomeAudio.ts` and the manager lives in `src/game/AudioManager.ts`.

### Sub-steps

**Step 9.7.1 — Define BiomeAudio type**

File: `src/data/biomeAudio.ts` (new file)

```typescript
/**
 * Audio configuration for a single biome.
 */
export interface BiomeAudio {
  biomeId: string;
  /** Phaser audio key for the looping ambient track */
  ambientLoop: string;
  /** Array of Phaser audio keys for hazard-specific SFX in this biome */
  hazardSfx: string[];
  /** Short sting played once when the player enters this biome */
  transitionSting: string;
  volumeProfile: VolumeProfile;
}

export interface VolumeProfile {
  /** Master volume for the ambient loop (0.0–1.0) */
  ambientVolume: number;
  /** Master volume for hazard SFX (0.0–1.0) */
  hazardVolume: number;
  /** Duration in ms for crossfade between biome tracks */
  crossfadeDuration: number;
}
```

**Step 9.7.2 — Define BiomeAudio entries for all 25 biomes**

File: `src/data/biomeAudio.ts` (continued)

Export `BIOME_AUDIO: Record<string, BiomeAudio>` with one entry per biome. Audio key naming convention: `bgm_<biomeId>_loop`, `sfx_<biomeId>_<hazard>`, `sting_<biomeId>`. Representative entries:

- `sedimentary_shelf`: ambientLoop `bgm_sedimentary_loop`, hazardSfx [`sfx_sedimentary_rockfall`, `sfx_sedimentary_crumble`], transitionSting `sting_sedimentary`, volumeProfile {ambientVolume: 0.4, hazardVolume: 0.7, crossfadeDuration: 1500}
- `volcanic_vents`: ambientLoop `bgm_volcanic_loop`, hazardSfx [`sfx_volcanic_lava_burst`, `sfx_volcanic_vent_hiss`, `sfx_volcanic_explosion`], transitionSting `sting_volcanic`, volumeProfile {ambientVolume: 0.5, hazardVolume: 0.8, crossfadeDuration: 800}
- `frozen_depths`: ambientLoop `bgm_frozen_loop`, hazardSfx [`sfx_frozen_ice_crack`, `sfx_frozen_wind`], transitionSting `sting_frozen`, volumeProfile {ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 2000}
- `void_pockets`: ambientLoop `bgm_void_loop`, hazardSfx [`sfx_void_tear`, `sfx_void_collapse`], transitionSting `sting_void`, volumeProfile {ambientVolume: 0.3, hazardVolume: 0.75, crossfadeDuration: 1200}
- `data_corruption`: ambientLoop `bgm_data_corruption_loop`, hazardSfx [`sfx_glitch_spike`, `sfx_data_error`], transitionSting `sting_data_corruption`, volumeProfile {ambientVolume: 0.45, hazardVolume: 0.7, crossfadeDuration: 500}
- (all 25 biomes defined with appropriate keys)

**Step 9.7.3 — Create AudioManager**

File: `src/game/AudioManager.ts` (new file)

```typescript
import Phaser from 'phaser'
import { BIOME_AUDIO, BiomeAudio, VolumeProfile } from '../data/biomeAudio'

/**
 * Manages biome ambient audio, crossfading, and hazard sound effects.
 * Optimized for mobile: mono audio, lazy loading, compressed formats.
 */
export class AudioManager {
  private scene: Phaser.Scene
  private currentLoop: Phaser.Sound.BaseSound | null = null
  private currentBiomeId: string | null = null
  private isCrossfading: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Transitions to the ambient loop for the given biome.
   * Crossfades from the current loop using the biome's volumeProfile.crossfadeDuration.
   * Plays the transition sting once before the loop begins.
   */
  public transitionToBiome(biomeId: string): void {
    if (this.currentBiomeId === biomeId) return
    const audio = BIOME_AUDIO[biomeId]
    if (!audio) return

    this.playTransitionSting(audio)
    this.crossfadeToLoop(audio)
    this.currentBiomeId = biomeId
  }

  /**
   * Plays a hazard-specific sound effect for the current biome.
   * @param hazardKey - one of the keys in BiomeAudio.hazardSfx
   */
  public playHazardSfx(hazardKey: string): void {
    if (!this.currentBiomeId) return
    const audio = BIOME_AUDIO[this.currentBiomeId]
    if (!audio) return
    if (!audio.hazardSfx.includes(hazardKey)) return
    this.scene.sound.play(hazardKey, { volume: audio.volumeProfile.hazardVolume })
  }

  /**
   * Stops all audio and releases resources.
   */
  public stopAll(): void {
    this.currentLoop?.stop()
    this.currentLoop = null
    this.currentBiomeId = null
  }

  private playTransitionSting(audio: BiomeAudio): void {
    if (this.scene.cache.audio.has(audio.transitionSting)) {
      this.scene.sound.play(audio.transitionSting, {
        volume: audio.volumeProfile.ambientVolume
      })
    }
  }

  private crossfadeToLoop(audio: BiomeAudio): void {
    if (this.isCrossfading) return
    this.isCrossfading = true
    const { crossfadeDuration, ambientVolume } = audio.volumeProfile
    const outgoing = this.currentLoop

    // Fade out outgoing
    if (outgoing) {
      this.scene.tweens.add({
        targets: outgoing,
        volume: 0,
        duration: crossfadeDuration,
        onComplete: () => { outgoing.stop() }
      })
    }

    // Lazy-load and fade in incoming
    if (this.scene.cache.audio.has(audio.ambientLoop)) {
      const incoming = this.scene.sound.add(audio.ambientLoop, {
        loop: true,
        volume: 0
      })
      incoming.play()
      this.scene.tweens.add({
        targets: incoming,
        volume: ambientVolume,
        duration: crossfadeDuration,
        onComplete: () => { this.isCrossfading = false }
      })
      this.currentLoop = incoming
    } else {
      this.isCrossfading = false
    }
  }
}
```

**Step 9.7.4 — Lazy-load audio assets per biome**

File: `src/game/scenes/MineScene.ts`

Rather than loading all 25 biomes' audio at startup, load only the current biome's audio keys in a `loadBiomeAudio(biomeId: string)` method using `this.load.audio()` followed by `this.load.once('complete', callback)`. This keeps initial load time short.

```typescript
/**
 * Lazily loads audio assets for the given biome if not already cached.
 */
private loadBiomeAudio(biomeId: string): void {
  const audio = BIOME_AUDIO[biomeId]
  if (!audio) return
  const keys = [audio.ambientLoop, audio.transitionSting, ...audio.hazardSfx]
  const uncached = keys.filter(k => !this.cache.audio.has(k))
  if (uncached.length === 0) {
    this.audioManager.transitionToBiome(biomeId)
    return
  }
  for (const key of uncached) {
    // Use OGG with MP3 fallback for broad mobile compatibility
    this.load.audio(key, [
      `assets/audio/biomes/${key}.ogg`,
      `assets/audio/biomes/${key}.mp3`
    ])
  }
  this.load.once('complete', () => {
    this.audioManager.transitionToBiome(biomeId)
  })
  this.load.start()
}
```

**Step 9.7.5 — Integrate AudioManager into MineScene**

File: `src/game/scenes/MineScene.ts`

1. Import `AudioManager`
2. Add private field `private audioManager: AudioManager`
3. In `create()`: `this.audioManager = new AudioManager(this)`; then `this.loadBiomeAudio(biomeId)`
4. In `shutdown()`: `this.audioManager.stopAll()`
5. When hazard triggers (lava/gas events): call `this.audioManager.playHazardSfx(hazardKey)`
6. On layer transition (descent shaft used): call `this.loadBiomeAudio(newBiomeId)`

**Step 9.7.6 — Add audio file stubs under src/assets/audio/biomes/**

File: `src/assets/audio/biomes/` (directory)

For each of the 25 biomes, provide stub audio files (silent 1-second OGG files) as placeholders, with a `README` noting that real audio should be replaced before shipping. The naming follows the convention `bgm_<biomeId>_loop.ogg`, `sting_<biomeId>.ogg`, `sfx_<biomeId>_<hazard>.ogg`.

**Step 9.7.7 — Add audio volume controls to Settings**

File: `src/ui/Settings.svelte`

Add sliders for:
- Music Volume (controls ambient loop volume multiplier, 0–100%)
- SFX Volume (controls hazard SFX volume multiplier, 0–100%)

Persist to `localStorage` as `settingsMusicVolume` and `settingsSfxVolume`. `AudioManager` reads these on each `transitionToBiome()` and `playHazardSfx()` call.

### Acceptance Criteria

- All 25 biomes have a `BiomeAudio` entry with `ambientLoop`, `hazardSfx[]`, `transitionSting`, and `volumeProfile`
- `AudioManager.transitionToBiome()` crossfades between tracks using `crossfadeDuration`
- Transition sting plays once when entering a new biome
- `playHazardSfx()` plays the correct SFX at the correct volume for the current biome
- Audio is lazy-loaded per biome (not all upfront)
- OGG + MP3 fallback format used for mobile compatibility
- `stopAll()` called on scene shutdown (no audio leak)
- Music and SFX volume sliders in Settings persist to `localStorage`
- `npm run typecheck` passes with no new errors

### Playwright Test Script

```javascript
// /tmp/test-9-7-audio.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Verify Settings page has audio controls
  const settingsBtn = await page.$('[data-testid="settings-btn"]')
  if (settingsBtn) {
    await settingsBtn.click()
    await page.waitForTimeout(500)
    const musicSlider = await page.$('[data-testid="music-volume-slider"]')
    const sfxSlider = await page.$('[data-testid="sfx-volume-slider"]')
    console.log('Music slider found:', !!musicSlider)
    console.log('SFX slider found:', !!sfxSlider)
    await page.screenshot({ path: '/tmp/ss-9-7-settings-audio.png' })
    await page.goBack().catch(() => page.goto('http://localhost:5173'))
    await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  }

  // Enter mine and verify audio loads without error
  await page.evaluate(() => { localStorage.setItem('devMode', 'true') })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  const audioErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().toLowerCase().includes('audio')) {
      audioErrors.push(msg.text())
    }
  })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/ss-9-7-mine-audio.png' })

  // Test biome audio transition via dev panel
  const devBtn = await page.$('[data-testid="dev-panel-toggle"]')
  if (devBtn) {
    await devBtn.click()
    await page.waitForTimeout(500)
    const biomeSelect = await page.$('[data-testid="dev-biome-select"]')
    if (biomeSelect) {
      await biomeSelect.selectOption('volcanic_vents')
      await page.waitForTimeout(2500) // wait for crossfade
      await page.screenshot({ path: '/tmp/ss-9-7-volcanic-audio.png' })
      await biomeSelect.selectOption('frozen_depths')
      await page.waitForTimeout(2500)
      await page.screenshot({ path: '/tmp/ss-9-7-frozen-audio.png' })
    }
  }

  if (audioErrors.length > 0) {
    console.warn('Audio-related console errors:', audioErrors)
    // Don't fail: stub files may be missing in dev; warn only
  }

  console.log('9.7 audio system test complete.')
  await browser.close()
})()
```

### Verification Gate

- [ ] `src/data/biomeAudio.ts` exists with `BiomeAudio`, `VolumeProfile` types and `BIOME_AUDIO` map for all 25 biomes
- [ ] `src/game/AudioManager.ts` exists with `transitionToBiome()`, `playHazardSfx()`, `stopAll()`
- [ ] Crossfade uses `crossfadeDuration` from `VolumeProfile`
- [ ] Transition sting plays once on biome entry (not looped)
- [ ] Audio is lazy-loaded per biome (not preloaded in bulk)
- [ ] OGG + MP3 dual-format loading used in `loadBiomeAudio()`
- [ ] `stopAll()` called in `MineScene.shutdown()`
- [ ] Music and SFX volume sliders present in Settings, values persisted
- [ ] No unhandled audio errors in browser console during biome transitions
- [ ] `npm run typecheck` and `npm run build` pass with no new errors

---

## Sub-Phase 9.8: Biome Visual Tier System (DD-V2-236)

### What
Classify all 25 biomes into three visual tiers that determine how much unique sprite art they receive. This stratification makes art production feasible while concentrating visual investment where it has the most impact — the hero biomes players see most frequently.

**Tier definitions**:
- **Tier 1 — Hero biomes** (5–6 biomes): Fully unique block silhouettes AND textures. No shared shapes with any other biome. These are the most-played biomes (Shallow-1 and a selection of player-favorite deep biomes). Every tile variant (all 16 autotile masks) is custom-drawn.
- **Tier 2 — Distinct biomes** (10–12 biomes): Unique textures and color palettes, but block silhouettes may share structural shapes with other Tier-2 biomes. Autotile masks share the same edge geometry but differ in fill texture and color.
- **Tier 3 — Palette biomes** (7–8 biomes): Shared structural sprites with heavy palette variation plus 2–3 accent tiles unique to the biome (e.g., a distinctive wall crystal, a unique floor crack pattern). These are the lowest-traffic biomes (Extreme tier anomalies) and receive palette-swap rendering rather than full sprite sets.

**Player-data upgrade path**: After launch, identify the top 5 most-explored biomes via analytics. Upgrade those to Tier 1 if not already, and from Tier 3 to Tier 2 if any Tier-3 biomes break into top-10.

### Where
- **Modify**: `src/data/biomes.ts` — add `visualTier: 1 | 2 | 3` field to `BiomeDefinition`
- **Create**: `src/assets/sprites/tiles/biomes/` — per-biome sprite subdirectories (`/crystalline_cavern/`, `/volcanic_vents/`, etc.)
- **Create**: `src/assets/sprites-hires/tiles/biomes/` — hi-res counterparts
- **Modify**: `src/game/BiomeAtlas.ts` — load the correct sprite set based on `visualTier`

### How

**Step 1** — Add `visualTier` to `BiomeDefinition` in `src/data/biomes.ts`:
```typescript
export interface BiomeDefinition {
  // ... existing fields ...
  /**
   * Visual production tier.
   * 1 = fully unique silhouettes + textures (hero biomes)
   * 2 = unique textures, shared silhouette geometry
   * 3 = shared sprites + palette swap + 2-3 accent tiles
   */
  visualTier: 1 | 2 | 3
}
```

**Step 2** — Assign `visualTier` to all 25 biome definitions:
- Tier 1: `verdant_depths`, `crystalline_cavern`, `volcanic_vents`, `frozen_abyss`, `luminous_grotto` (5 biomes)
- Tier 2: all 10–12 Mid and Deep biomes
- Tier 3: all 7–8 Extreme anomaly biomes

**Step 3** — In `BiomeAtlas.ts`, in `loadAtlas(biome: BiomeDefinition)`:
- Tier 1: load from `src/assets/sprites/tiles/biomes/{biome.id}/` (full 80-tile set)
- Tier 2: load from `src/assets/sprites/tiles/biomes/{biome.id}/` (textures only, shapes from shared geometry atlas)
- Tier 3: load the shared Tier-3 structural atlas + the biome's 2–3 accent tile sprites + apply palette swap via Phaser's `setTint()` per tile layer

**Step 4** — Create placeholder sprite directories for all 25 biomes. Use colored rectangles to unblock development; replace with ComfyUI-generated art before art review.

### Acceptance Criteria
- `visualTier` field present and populated for all 25 biomes in `biomes.ts`
- `BiomeAtlas.loadAtlas()` selects the correct sprite loading path per tier
- Tier-3 biomes render with palette swap applied (visible color difference from the shared base)
- Sprite directories created for all 25 biomes (even if with placeholders)
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-8-visual-tier.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9-8-tier1-biome.png' })
  // Use DevPanel to switch to a Tier-3 biome
  await page.screenshot({ path: '/tmp/ss-9-8-tier3-biome.png' })
  await browser.close()
  console.log('Visual tier screenshots: /tmp/ss-9-8-tier*.png')
})()
```

**Verification**: Tier-1 screenshot shows fully unique block shapes and textures. Tier-3 screenshot shows clearly different palette applied over shared base shapes.

---

## Sub-Phase 9.9: 25-Biome Color Matrix (DD-V2-237)

### What
Before any sprite generation begins, construct a hue wheel matrix assigning dominant hues to all 25 biomes. This planning step prevents the most common mistake in biome art pipelines: two adjacent-layer biomes accidentally sharing a dominant color, making it impossible for players to tell which biome they are in.

**Matrix rules**:
1. No two biomes that can appear on adjacent layer depths share a dominant hue (within 30° on the hue wheel)
2. Sibling biomes (same depth tier, different biome) differ in silhouette shape, NOT in color — their colors may be adjacent because they never appear simultaneously on adjacent layers
3. Anomaly biomes use desaturated, high-contrast palettes that are visually distinct from all standard-tier biomes at the same depth

**Palette structure** (added to `BiomeDefinition`):
```typescript
export interface BiomePalette {
  dominant: number    // 0xRRGGBB — primary fill color (40-50% of visual surface)
  accent:   number    // secondary highlight or detail color
  highlight: number   // brightest point (specular, glow edge)
}
```

### Where
- **Modify**: `src/data/biomes.ts` — add `palette: BiomePalette` to `BiomeDefinition` and populate all 25 entries
- **Create**: `src/data/palette.ts` — export `BiomePalette` type and helper functions

### How

**Step 1** — Create `src/data/palette.ts`:
```typescript
export interface BiomePalette {
  dominant:  number   // 0xRRGGBB
  accent:    number
  highlight: number
}

/** Returns a CSS hex string from a 0xRRGGBB color number. */
export function toHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0').toUpperCase()
}

/** Returns the approximate hue (0–360) of a 0xRRGGBB color. */
export function hue(color: number): number {
  const r = ((color >> 16) & 0xFF) / 255
  const g = ((color >>  8) & 0xFF) / 255
  const b = (color & 0xFF) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return Math.round(h)
}

/** Returns true if two hues are within threshold degrees of each other. */
export function huesClash(h1: number, h2: number, threshold = 30): boolean {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff) < threshold
}
```

**Step 2** — Design the 25-biome hue matrix. Distribute dominant hues evenly across the wheel while respecting adjacency constraints. Suggested starting assignments:
- Shallow tier (L1-5): warm earth tones — orange-brown (30°), olive (70°), tan (45°), rust (15°), sage (100°)
- Mid tier (L6-10): cool mid tones — teal (175°), slate-blue (210°), forest (140°), steel (200°), lavender (270°)
- Deep tier (L11-15): cold/dark — indigo (250°), violet (290°), cold cyan (195°), purple-grey (270°, low sat), magenta (310°)
- Extreme tier (L16-20): near-void — near-black with strong accent: black+red (0°), black+cyan (185°), black+gold (50°), void blue (230°), alien green (135°)
- Anomaly biomes: desaturated versions — grey-teal, grey-orange, grey-violet, grey-green, stark white

**Step 3** — Add `palette: BiomePalette` to all 25 entries in `BIOMES`. Run a validation function at build time that asserts no adjacency clash.

### Acceptance Criteria
- `palette` field populated for all 25 biomes
- Automated validation confirms no adjacent-layer biomes clash in dominant hue (within 30°)
- `BiomePalette` and helper functions exported from `src/data/palette.ts`
- All sibling biomes (same tier) differ in silhouette assignment, not in dominant hue clash
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-9-color-matrix.js
// This is a Node.js logic test, not a visual test
const { BIOMES } = require('./dist/data/biomes.js').default || require('./src/data/biomes.ts')
const { hue, huesClash } = require('./src/data/palette.ts')

let clashes = 0
for (let i = 0; i < BIOMES.length; i++) {
  for (let j = i + 1; j < BIOMES.length; j++) {
    const b1 = BIOMES[i], b2 = BIOMES[j]
    // Only check adjacent depth-tier biomes (could appear on consecutive layers)
    const tiersAdjacent = Math.abs(
      ['shallow','mid','deep','extreme'].indexOf(b1.depthTier) -
      ['shallow','mid','deep','extreme'].indexOf(b2.depthTier)
    ) === 1
    if (tiersAdjacent && b1.palette && b2.palette) {
      if (huesClash(hue(b1.palette.dominant), hue(b2.palette.dominant))) {
        console.error(`HUE CLASH: ${b1.id} (${hue(b1.palette.dominant)}°) vs ${b2.id} (${hue(b2.palette.dominant)}°)`)
        clashes++
      }
    }
  }
}
console.log(`Hue matrix check: ${clashes} clashes (target: 0)`)
process.exit(clashes > 0 ? 1 : 0)
```

**Verification**: Validation script exits with code 0. All 25 biomes have populated palette fields. Adjacent-tier biomes pass the 30° hue-distance check.

---

## Sub-Phase 9.10: Formal Palette System (DD-V2-272)

### What
Extend the `BiomePalette` introduced in 9.9 into a full 8–12 color palette per biome that governs every pixel of color in that biome's visual presentation. This palette is enforced mechanically — either by embedding the hex values directly in ComfyUI prompts or by running palette quantization as a post-processing step on generated sprites.

**Full palette structure** (8 required + 4 optional):
1. `background` — the void/empty space color behind all tiles
2. `fill1` — primary block fill (most-used color)
3. `fill2` — secondary block fill (texture variation)
4. `fill3` — tertiary fill (deep shadow within blocks)
5. `accent` — highlight/edge color on block surfaces
6. `highlight` — specular point / brightest pixel color
7. `shadow` — drop shadow color cast by blocks
8. `fog` — the fog overlay tint (may differ from `background`)
9. *(optional)* `particle1` — primary ambient particle color
10. *(optional)* `particle2` — secondary particle color
11. *(optional)* `special1` — color for special block highlights (crystal veins, ore)
12. *(optional)* `special2` — second special block color

**Enforcement approach**: During ComfyUI sprite generation, the palette's hex values are embedded in the negative prompt as "no [color]" constraints and in the positive prompt as "using only [color1], [color2], [color3] colors". Post-processing: run each generated sprite through a palette quantization script (`scripts/quantize-palette.mjs`) that remaps every pixel to the nearest palette color using Euclidean distance in LAB color space.

### Where
- **Modify**: `src/data/palette.ts` — extend `BiomePalette` to the full 8–12 color structure
- **Modify**: `src/data/biomes.ts` — update all 25 biome palette entries to full structure
- **Create**: `scripts/quantize-palette.mjs` — post-processing CLI tool for palette enforcement
- **Create**: `sprite-gen/palette-prompt-builder.mjs` — generates ComfyUI prompt fragments from palette

### How

**Step 1** — Extend `BiomePalette` in `src/data/palette.ts`:
```typescript
export interface BiomePalette {
  background: number
  fill1:      number
  fill2:      number
  fill3:      number
  accent:     number
  highlight:  number
  shadow:     number
  fog:        number
  // Optional extended palette
  particle1?:  number
  particle2?:  number
  special1?:   number
  special2?:   number
}
```

**Step 2** — Create `scripts/quantize-palette.mjs`. This Node.js script accepts `--input <path>` (PNG), `--palette <biomeId>`, and `--output <path>`. It reads the PNG with `sharp` or `jimp`, converts each pixel to LAB, maps to the nearest palette color, and writes the quantized PNG.

**Step 3** — Create `sprite-gen/palette-prompt-builder.mjs`. Accepts a `BiomePalette` object and returns:
```js
{
  positiveFragment: "using only hex colors #3A5C2E #7AB853 #C5E08A, strict color palette, no other colors",
  negativeFragment: "red, orange, pink, bright colors, saturated, neon"
}
```

**Step 4** — Update all 25 biome palette entries in `biomes.ts` to supply the full 8-color required set.

### Acceptance Criteria
- `BiomePalette` extended to 8 required + 4 optional fields
- All 25 biomes have all 8 required palette fields populated
- `scripts/quantize-palette.mjs` runs without error on a test PNG and produces output with provably fewer unique colors
- `sprite-gen/palette-prompt-builder.mjs` produces valid positive/negative ComfyUI prompt fragments
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-10-palette.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9-10-palette-biome.png' })
  await browser.close()
  console.log('Palette biome screenshot: /tmp/ss-9-10-palette-biome.png — check color consistency')
})()
```

**Verification**: Screenshot shows visually cohesive biome where all tile colors come from the defined palette. No stray colors visible.

---

## Sub-Phase 9.11: Depth Visual Gradient (DD-V2-238)

### What
Ensure that the mine's visual atmosphere changes consistently and intentionally as players descend deeper. This is implemented by ensuring each depth tier's biome palettes and sprite styles follow defined aesthetic guidelines — not by overlaying a tint, but by commissioning/generating art that naturally obeys the gradient.

**Depth tier aesthetics**:

| Tier | Layers | Color Temperature | Shape Language | Brightness | Glow Level |
|---|---|---|---|---|---|
| Shallow | L1–5 | Warm earth tones (orange, brown, olive) | Organic, rounded, smooth edges | High (40–60% brightness) | None |
| Mid | L6–10 | Cool teal, grey, slate | More angular, structured, some crystalline | Moderate (25–40%) | Subtle |
| Deep | L11–15 | Cold indigo, purple, dark cyan | Sharp, jagged, geometric | Low (10–25%) | Moderate glow on special blocks |
| Extreme | L16–20 | Near-void black + 1–2 strong accent hues | Alien, fractured, asymmetric | Very low (5–15%) | Heavy glow, particles |

**Implementation**: These guidelines are enforced via:
1. Palette assignments in 9.9 (hue wheel placement by tier)
2. ComfyUI prompt style words per tier embedded in `sprite-gen/`
3. A DevPanel "depth preview" mode that sequences through one biome per tier for quick visual QA

### Where
- **Modify**: `src/data/biomes.ts` — add `depthAesthetic: DepthAesthetic` metadata field
- **Create**: `sprite-gen/depth-tier-prompts.mjs` — exports ComfyUI style prompt fragments per tier
- **Modify**: `src/ui/DevPanel.svelte` — add "depth sequence" preview button

### How

**Step 1** — Add `DepthAesthetic` type:
```typescript
export type DepthAesthetic = {
  tier: BiomeDepthTier
  colorTemperature: 'warm' | 'neutral' | 'cool' | 'cold' | 'void'
  shapeLanguage: 'organic' | 'structured' | 'jagged' | 'alien'
  brightnessRange: [number, number]   // percentage [min, max]
  glowLevel: 'none' | 'subtle' | 'moderate' | 'heavy'
}
```

**Step 2** — Create `sprite-gen/depth-tier-prompts.mjs` that exports a `TIER_PROMPTS` object:
```js
export const TIER_PROMPTS = {
  shallow: {
    style: 'warm earth tones, organic rounded shapes, bright, natural cave, dirt and stone',
    negative: 'glowing, neon, cold colors, futuristic, dark'
  },
  mid: {
    style: 'cool teal and grey, angular crystalline formations, moderate brightness, structured geology',
    negative: 'warm colors, bright, organic, neon'
  },
  deep: {
    style: 'cold indigo purple, sharp jagged geometry, dark cave, low brightness, crystal glow',
    negative: 'warm colors, round shapes, bright'
  },
  extreme: {
    style: 'near-black void, alien architecture, one strong accent color, heavy glow, sci-fi, dark',
    negative: 'natural, organic, warm, bright, multiple colors'
  }
}
```

**Step 3** — In `DevPanel.svelte`, add a "Depth Preview" button. On click, iterate through one representative biome per tier (shallow → mid → deep → extreme), loading each atlas and taking a screenshot of the rendered mine for visual QA.

### Acceptance Criteria
- `depthAesthetic` populated for all 25 biomes
- Visual inspection confirms each tier looks meaningfully different (Playwright screenshots at L1, L5, L10, L15, L20)
- DevPanel depth preview button works without errors
- ComfyUI tier prompts file exported correctly
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-11-depth-gradient.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Screenshot at layer 1 (shallow)
  await page.screenshot({ path: '/tmp/ss-9-11-layer1-shallow.png' })
  // DevPanel: jump to layer 10 (deep)
  // await DevPanel layer jump to L10
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss-9-11-layer10-mid.png' })
  await browser.close()
  console.log('Depth gradient screenshots: /tmp/ss-9-11-layer*.png')
})()
```

**Verification**: Shallow screenshot is warm and bright. Mid screenshot is cooler and more structured. Visually distinct even without labels.

---

## Sub-Phase 9.12: Remove Tint Overlays (DD-V2-240)

### What
Remove the 0.15 alpha biome color tint currently applied uniformly to all tiles in `drawTiles()` (or equivalent rendering path). This tint was a placeholder that made placeholder-sprite biomes look different from each other by painting them different colors. Now that each biome has its own proper palette (9.9–9.10), the uniform tint produces a muddy "double-tint" where the sprite's own colors are washed over with a second color.

**What to keep**: A very subtle (0.05–0.08 alpha) global "color grade" overlay that unifies the look of a layer — similar to the color grade applied to film footage — is acceptable. This is not a tint, it is atmospheric cohesion. The distinction: it does not change the biome's dominant hue, it just slightly warms or cools everything together.

### Where
- **Modify**: `src/game/scenes/MineScene.ts` — find and remove or reduce the biome tint overlay in `drawTiles()` or `redrawDirty()`
- **Modify**: `src/game/systems/BiomeAtlas.ts` (if tint is applied there) — same removal

### How

**Step 1** — Search `MineScene.ts` for any `setTint()`, `fillStyle()` with alpha, or `setAlpha()` calls that apply a uniform color across all tiles based on the current biome. Remove or reduce these to 0.05–0.08 alpha maximum.

**Step 2** — Add a code comment explaining why the tint was removed:
```typescript
// NOTE: Per-biome color tint removed (DD-V2-240).
// Each biome now uses its own palette-accurate sprites — a uniform tint
// creates "double-tint" muddiness. A 0.05 alpha atmospheric wash is retained
// for layer-depth cohesion only.
```

**Step 3** — After the removal, take before/after screenshots in at least 3 biomes. The "after" should show richer, more saturated block colors.

### Acceptance Criteria
- No uniform biome tint overlay > 0.08 alpha remains in `MineScene.ts` or `BiomeAtlas.ts`
- Before/after screenshot comparison shows improved color saturation
- No visual regression: blocks still distinguishable from each other
- Code comment explaining DD-V2-240 added at removal point
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-12-no-tint.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-9-12-no-tint.png' })
  await browser.close()
  console.log('No-tint screenshot: /tmp/ss-9-12-no-tint.png — compare vs previous tint version')
})()
```

**Verification**: Screenshot shows richer, more saturated block colors compared to the tinted version. No muddy double-tint visible.

---

## Sub-Phase 9.13: Biome Boundary Transition Tileset (DD-V2-235)

### What
When two different biomes appear on the same layer (which happens during partial anomaly overrides or biome blending at layer edges), there must be a neutral transition zone between them that avoids the jarring hard cut of biome A immediately abutting biome B. Without this, the artistic styles may clash in ways that look like rendering errors.

**Solution**: A shared "neutral geology" tileset consisting of 12–16 desaturated earth-tone tiles that can appear in a 2–3 tile-wide transition band between any two biomes. These tiles borrow shapes from both adjacent biomes but apply a desaturated, brownish-grey color palette that reads as "generic cave rock."

**Why not biome-pair-specific transitions**: 25 biomes × 24 potential neighbors = 600 biome pairs. Maintaining 600 transition tilesets is not feasible. The neutral tileset is O(1) and scales to any future biome additions.

### Where
- **Create**: `src/assets/sprites/tiles/transitions/` — 12–16 neutral transition PNG tiles (32px)
- **Create**: `src/assets/sprites-hires/tiles/transitions/` — hi-res counterparts
- **Modify**: `src/game/systems/MineGenerator.ts` — identify transition zones and flag cells for neutral rendering
- **Modify**: `src/game/scenes/MineScene.ts` — render transition-zone cells using the neutral tileset

### How

**Step 1** — In `MineGenerator.ts`, after biome regions are assigned to cells: for each cell that is within 2–3 tiles of a biome boundary (adjacent cell belongs to different biome), mark it with `isTransitionZone: true` in the `MineCell` data.

**Step 2** — Create a `TRANSITION_TILE_ATLAS` sprite key in `spriteManifest.ts` that points to the neutral tileset directory.

**Step 3** — In `MineScene.ts`/`BiomeAtlas.ts`, when rendering a transition-zone cell: use the neutral tileset instead of the biome-specific atlas. The neutral tileset still supports 4-bit autotiling (16 variants) using the shared neutral sprites.

**Step 4** — Generate 16 neutral autotile variants using ComfyUI with the prompt: "cave rock, neutral grey-brown, desaturated, no distinctive color, geological texture, pixel art 32px". Apply palette quantization to a 5-color desaturated palette.

### Acceptance Criteria
- Transition-zone cells render with the neutral tileset
- No hard color cuts between biomes — a 2–3 tile neutral band always separates them
- Transition tileset supports all 16 autotile variants
- Performance: transition zone flagging runs during generation, not per-frame
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-13-transition.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Use DevPanel to force a biome boundary mid-layer for inspection
  await page.screenshot({ path: '/tmp/ss-9-13-transition-zone.png' })
  await browser.close()
  console.log('Biome transition screenshot: /tmp/ss-9-13-transition-zone.png')
})()
```

**Verification**: Screenshot shows a visible neutral band between two biome regions. No abrupt color change from Biome A tiles directly to Biome B tiles.

---

## Sub-Phase 9.14: Special Block Biome Adaptation (DD-V2-241, DD-V2-279)

### What
Game-critical special blocks must remain instantly recognizable regardless of which biome they appear in, but they should still feel visually integrated. Non-critical special blocks can be fully redesigned per biome for visual richness.

**Classification**:

| Block Type | Criticality | Adaptation Approach |
|---|---|---|
| Quiz Gate | Critical | Universal silhouette (glowing doorframe shape), biome-tinted glow color |
| Descent Shaft | Critical | Universal silhouette (downward spiral/hole icon), biome-adapted surround tiles |
| Exit Ladder | Critical | Universal silhouette (ladder shape), biome-adapted color |
| Relic Shrine | Non-critical | Full per-biome redesign (8–10 variants) |
| Quote Stone | Non-critical | Full per-biome redesign (material-adapted) |
| Offering Altar | Non-critical | Full per-biome redesign |
| Fossil Site | Non-critical | Biome-adapted fossil type (different fossil species per biome) |

**Glow tinting for critical blocks**: Critical blocks load a single universal grayscale sprite and apply `setTint(biome.palette.accent)` dynamically. This means only ONE sprite per critical block type is needed across all 25 biomes.

### Where
- **Create**: `src/assets/sprites/tiles/special/` — universal grayscale sprites for Quiz Gate, Descent Shaft, Exit Ladder
- **Create**: `src/assets/sprites/tiles/special/biome-variants/` — per-biome sprites for Relic Shrine, Quote Stone, Offering Altar, Fossil Site
- **Modify**: `src/game/scenes/MineScene.ts` — apply `setTint(biome.palette.accent)` to critical special blocks
- **Modify**: `src/game/BiomeAtlas.ts` — load non-critical biome-variant sprites per biome

### How

**Step 1** — Generate universal grayscale sprites for Quiz Gate, Descent Shaft, and Exit Ladder. These are designed as high-contrast grayscale pixel art so that any tint color reads cleanly (no pre-baked hue to fight with the tint).

**Step 2** — In `MineScene.ts`, when rendering a critical special block, load the universal grayscale sprite and call:
```typescript
specialBlockSprite.setTint(currentBiome.palette.accent)
```
The tint remaps the grayscale whites to the biome accent color and preserves shadow detail in the dark greys.

**Step 3** — For non-critical blocks: define a `BiomeSpecialBlockVariant` record in `biomes.ts` that maps `BlockType → spriteKey` for the current biome. If a biome doesn't define a variant for a block type, fall back to a default shared sprite.

**Step 4** — Generate 8–10 Relic Shrine variants via ComfyUI (one per major biome aesthetic). Generate Quote Stone variants as material-appropriate slabs (dirt/stone/crystal/lava/ice etc.).

### Acceptance Criteria
- Quiz Gate, Descent Shaft, and Exit Ladder are immediately recognizable as the same game element across 5 different biome screenshots
- Critical blocks show correct biome accent tint
- At least 5 distinct Relic Shrine variants exist and render correctly in their respective biomes
- Fallback to default sprite for any missing non-critical variant (no crash)
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-14-special-blocks.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Screenshot showing Quiz Gate in current biome
  await page.screenshot({ path: '/tmp/ss-9-14-special-biome1.png' })
  // Use DevPanel to switch biome, find Quiz Gate in new biome
  await page.screenshot({ path: '/tmp/ss-9-14-special-biome2.png' })
  await browser.close()
  console.log('Special block biome adaptation: /tmp/ss-9-14-special-*.png')
})()
```

**Verification**: Both screenshots show the Quiz Gate with the same universal doorframe silhouette but different tint colors matching each biome's accent. Shape recognizable across biomes.

---

## Sub-Phase 9.15: Animated Tile Budget Per Biome (DD-V2-239)

### What
Every biome has 3–4 animated tile types — tiles that loop through 4–6 frames continuously. These could be flowing lava, dripping water, shimmering crystal faces, swaying bioluminescent plants, drifting ash, etc. The animations use a global frame timer with staggered per-tile phase offsets so that not every animated tile advances simultaneously (which would create a distracting "flash" effect).

**Budget constraints**:
- Max 3–4 animated tile TYPES per biome (not 3–4 tiles; each type can appear many times)
- 4–6 frames per tile type
- Total animated tile sprite frames per biome: 3 × 4 = 12 minimum, 4 × 6 = 24 maximum
- Frame cadence: 150–250ms per frame (4–6.7 FPS for tile animations — intentionally slow for a "living world" feel, not a busy one)
- Phase offset: seeded by `(cell.x * 7 + cell.y * 13) % frameCount` — deterministic, no randomness at runtime

**Pre-calculation rule**: During the `revealAround()` call (when fog is lifted), pre-calculate which animated frame is "current" for each newly revealed animated tile and store it in `cell.animFrame`. Do NOT compute animation state per-frame for non-visible tiles.

### Where
- **Modify**: `src/data/biomes.ts` — add `animatedTiles: AnimatedTileDefinition[]` to `BiomeDefinition`
- **Create**: `src/game/systems/AnimatedTileSystem.ts` — manages the global frame clock and per-tile phase
- **Modify**: `src/game/scenes/MineScene.ts` — integrate `AnimatedTileSystem`, update animated tiles each frame
- **Create**: `src/assets/sprites/tiles/animated/` — per-biome animated tile sprite sheets

### How

**Step 1** — Define `AnimatedTileDefinition`:
```typescript
export interface AnimatedTileDefinition {
  blockType: BlockType                   // which block type gets this animation
  spriteKeyPrefix: string               // e.g. 'lava_flow' → keys 'lava_flow_0' through 'lava_flow_5'
  frameCount: number                    // 4–6
  frameDuration: number                 // milliseconds per frame (150–250)
}
```

**Step 2** — Create `AnimatedTileSystem.ts`. In `update(delta)`: advance a global `accumulatedMs` counter. When `accumulatedMs >= shortest_frameDuration`: emit a `tile-animate` event with the new frame indices. In `getTileFrame(cell, def): number`: return `(Math.floor(accumulatedMs / def.frameDuration) + phaseOffset(cell)) % def.frameCount` where `phaseOffset(cell) = (cell.x * 7 + cell.y * 13) % def.frameCount`.

**Step 3** — In `MineScene.ts`'s `update()`: call `animatedTileSystem.update(delta)`, then iterate only the visible animated tiles (not all tiles in the grid) and update their tilemap tile index using `getTileFrame()`.

**Step 4** — Generate animated tile sprite sheets for 5 representative biomes via ComfyUI. Each sheet is a horizontal strip: 4–6 frames side-by-side, each frame 32px wide. Load as a Phaser spritesheet with `frameWidth: 32`.

### Acceptance Criteria
- 3–4 animated tile types defined per biome for at least 5 biomes
- Animations cycle at 4–6.7 FPS (150–250ms per frame)
- Adjacent tiles of the same animated type have visibly staggered phases (not synced)
- Total on-screen animated tile count at 60 FPS consumes <5% CPU on mid-tier Android (measured via DevPanel)
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-15-animated-tiles.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(4000)
  // Capture two frames 300ms apart to confirm animation advancing
  await page.screenshot({ path: '/tmp/ss-9-15-animated-t0.png' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: '/tmp/ss-9-15-animated-t300.png' })
  await browser.close()
  console.log('Animated tile screenshots: /tmp/ss-9-15-animated-*.png — compare for frame differences')
})()
```

**Verification**: Two screenshots 300ms apart show at least one animated tile type in a different frame. Staggered phases visible (not all tiles in sync).

---

## Sub-Phase 9.16: Viewport-Culled Ambient Particles (DD-V2-253)

### What
Ensure that ambient biome particle systems (drifting spores, floating embers, falling water droplets, etc.) never spawn particles outside the camera viewport, and enforce a hard cap on visible ambient particles to prevent performance degradation during long exploration sessions.

**Rules**:
- Spawn zone: camera rect + 2-tile margin (particles that start just off-screen and drift on-screen look more natural)
- Hard cap: 15–20 ambient particles visible at any time
- Multi-type biomes: split the budget proportionally (e.g., a biome with 3 particle types gets 5–6 each to total ≤18)
- "Particle creep": without culling, long sessions accumulate particles that were spawned during camera movement and never despawned. Fix: despawn any particle that exits the camera rect + 4-tile margin, regardless of remaining lifespan
- LOD scaling: on low-memory devices (detected via `navigator.deviceMemory < 4`), halve the cap to 7–10

### Where
- **Modify**: `src/game/systems/ParticleSystem.ts` — add viewport culling and hard cap enforcement
- **Modify**: `src/game/BiomeParticleManager.ts` — enforce budget split for multi-type biomes
- **Modify**: `src/ui/DevPanel.svelte` — add "ambient particle count" live counter

### How

**Step 1** — In `ParticleSystem.ts`, in the emitter's `onEmit` callback: check if the spawn position is within `cameraRect + 2 tiles`. If not, skip emission this cycle.

**Step 2** — In the emitter's `onUpdate` callback (or a separate `update()` loop): count total active particles across all ambient emitters. If count >= cap, set emitter `frequency` to -1 (pause). Resume when count drops below cap × 0.8 (hysteresis prevents rapid on/off toggling).

**Step 3** — Add a deactivation check: any ambient particle whose world position falls outside `cameraRect + 4 tiles` is immediately killed (`particle.lifeCurrent = 0`).

**Step 4** — In `DevPanel.svelte`: display `ParticleSystem.ambientParticleCount` live. Alert styling (red text) when count approaches or hits the cap.

### Acceptance Criteria
- Particle count in DevPanel never exceeds 20 during normal exploration
- After 5+ minutes of continuous exploration, particle count remains stable (no creep)
- No particles visible outside the camera viewport (visually confirmed via DevPanel particle overlay)
- LOD mode halves cap on low-memory devices
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-16-particle-cull.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Explore for 2 minutes to test particle creep
  for (let i = 0; i < 120; i++) {
    const dir = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'][i % 4]
    await page.keyboard.press(dir)
    await page.waitForTimeout(80)
  }
  await page.screenshot({ path: '/tmp/ss-9-16-particle-count.png' })
  // Read DevPanel particle count from the page
  const count = await page.evaluate(() => {
    const el = document.querySelector('[data-particle-count]')
    return el ? parseInt(el.textContent || '0') : -1
  })
  console.log('Ambient particle count after 2min exploration:', count)
  if (count > 20) process.exit(1)
  await browser.close()
})()
```

**Verification**: Script exits with code 0 (particle count ≤ 20). Screenshot shows DevPanel counter within budget.

---

## Sub-Phase 9.17: Biome Fog Glow System (DD-V2-271)

### What
Block types that are naturally luminous (Lava, Crystal, Essence) emit a colored radial glow into the adjacent unexplored fog zone. This serves two purposes simultaneously: it makes the mine feel alive and atmospheric, and it provides a subtle gameplay hint about what block types lie just beyond the fog boundary.

**Glow properties**:

| Block Type | Glow Color | Radius (tiles) | Alpha at source | Blend Mode |
|---|---|---|---|---|
| Lava | #FF6600 (orange) | 2 | 0.45 | Additive |
| Crystal | #44AAFF (blue) | 3 | 0.35 | Additive |
| Essence | #9944CC (purple) | 2 | 0.40 | Additive |

**Rendering architecture**:
- Glow is drawn on a separate `Phaser.GameObjects.Graphics` layer positioned above the fog dark layer but below fully-revealed tiles
- `blendMode: Phaser.BlendModes.ADD` — glow adds light, never darkens
- Falloff: linear from source alpha at the block edge to 0 at `radius` tiles
- Fog tiles remain neutral dark — only the additive glow overlay changes their apparent brightness
- Cap additive alpha at 0.5 to prevent OLED blowout

**Implementation note**: This system is closely related to `BiomeGlowSystem.ts` introduced in Phase 7.30 (fog visibility sub-phase). If 7.30 has been implemented, extend that system rather than creating a duplicate. If 7.30 has not been implemented, create `BiomeGlowSystem.ts` here.

### Where
- **Create or Modify**: `src/game/systems/BiomeGlowSystem.ts` — radial glow into fog overlay (create if not from 7.30)
- **Modify**: `src/game/systems/FogSystem.ts` — integrate glow layer rendering above fog dark layer
- **Modify**: `src/game/scenes/MineScene.ts` — instantiate `BiomeGlowSystem` and call `update()` when fog changes

### How

**Step 1** — If `BiomeGlowSystem.ts` does not exist: create it following the specification in Phase 7.30 sub-phase. If it exists: extend it with the Lava, Crystal, and Essence glow definitions.

**Step 2** — In `BiomeGlowSystem.update(grid, revealedCells)`: for each newly revealed border cell (cell adjacent to fog): check if any fog-adjacent cells contain a glow-emitting block type. For each such block, draw a radial gradient circle onto the glow Graphics layer.

**Step 3** — The glow layer is a `Phaser.GameObjects.Graphics` object with `blendMode: Phaser.BlendModes.ADD`. It is cleared and redrawn on fog state changes (not every frame). Use `DirtyRectTracker` (from 7.19) to only redraw glow around cells that changed.

**Step 4** — Cap the additive alpha: when building the radial gradient, clamp the maximum alpha of any drawn pixel to 0.5 via the Graphics `fillStyle()` alpha parameter.

**Step 5** — DevPanel toggle: "Show Glow Layer" checkbox. When checked, the glow Graphics layer is set to `setVisible(true)` and a debug overlay draws glow circles in outline for QA. When unchecked, normal gameplay rendering.

### Acceptance Criteria
- Lava blocks glow orange through up to 2 tiles of adjacent fog
- Crystal blocks glow blue through up to 3 tiles of adjacent fog
- Revealed tiles adjacent to glow sources are NOT tinted — only the fog layer receives the glow
- Glow does not appear through revealed (non-fog) tiles (i.e., the glow is masked by reveal state)
- Maximum glow alpha capped at 0.5 (OLED safety)
- DevPanel toggle works correctly
- `npm run typecheck` passes

### Playwright Test
```js
// Save as /tmp/test-9-17-fog-glow.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  // Use DevPanel to force a Lava biome or place Lava blocks adjacent to fog boundary
  await page.screenshot({ path: '/tmp/ss-9-17-fog-glow-lava.png' })
  // Switch to Crystal biome and screenshot
  await page.screenshot({ path: '/tmp/ss-9-17-fog-glow-crystal.png' })
  await browser.close()
  console.log('Fog glow screenshots: /tmp/ss-9-17-fog-glow-*.png')
})()
```

**Verification**: Lava screenshot shows orange warm glow bleeding into adjacent fog tiles. Crystal screenshot shows blue glow with wider radius. Revealed tile colors unchanged — glow only affects fog zone.

---

## Final Verification Gate — Phase 9: Biome Expansion

This gate must be fully satisfied before Phase 9 is marked complete in `docs/roadmap/PROGRESS.md` and the phase document is moved to `docs/roadmap/completed/`.

### Functional Completeness

- [ ] All 25 biomes are defined in `src/data/biomes.ts` with correct tier assignments (5 Shallow / 5 Mid / 5 Deep / 5 Extreme / 5 Anomaly)
- [ ] Biome selection logic (9.1) correctly picks biomes by depth tier and anomaly override probability (~10–15%)
- [ ] All 25 biome tile atlases load and unload correctly via `BiomeAtlas.ts` without memory leaks
- [ ] Tile atlas hot-swap (9.2) works without visual artifacts or texture cache corruption during layer transitions
- [ ] All 25 biome color palettes (9.3) render correctly; palette-swap shader applies on load and removes on cleanup
- [ ] All 25 biomes have 2–4 structural features defined; features generate without tile overlap
- [ ] `placeStructuralFeatures()` runs in the generation pipeline for all 25 biomes (9.4)
- [ ] Bonus contents (minerals/passages/hazards) appear inside placed structural features at correct rates
- [ ] All 25 biomes have 1–3 particle configs; `BiomeParticleManager` activates correct emitters per biome (9.5)
- [ ] Total on-screen particle count never exceeds 50 (enforced in `BiomeParticleManager`)
- [ ] LOD detection reduces particle frequency to 0.3× on low-memory devices
- [ ] All 100 landmark variants (25 × 4) are defined; `LandmarkRenderer.applyVariant()` applies them correctly (9.6)
- [ ] `getLandmarkVariant()` returns a no-op fallback for any missing combination (never throws)
- [ ] All 25 biomes have `BiomeAudio` entries; `AudioManager.transitionToBiome()` crossfades correctly (9.7)
- [ ] Transition sting plays once on biome entry; ambient loop plays continuously
- [ ] Hazard SFX plays via `playHazardSfx()` at correct volume for current biome
- [ ] Music and SFX volume settings persist to `localStorage` and are respected at runtime

### Performance

- [ ] Mine generation (including structural feature placement) completes in under 200ms for all grid sizes (20×20 through 40×40)
- [ ] Tile atlas swap completes in under 100ms with no dropped frames
- [ ] Particle system maintains 60 FPS on a mid-tier Android device (or simulator equivalent) with all effects active
- [ ] Audio crossfade has no audible pops or clicks
- [ ] Audio assets are lazy-loaded per biome (no bulk upfront load of all 25 biomes)
- [ ] `BiomeParticleManager.destroyAll()` and `AudioManager.stopAll()` leave no lingering Phaser objects after scene shutdown

### Visual Quality

- [ ] Each of the 25 biomes is visually distinguishable from all others based on tiles, color palette, structural features, and particles
- [ ] The 5 anomaly biomes look clearly distinct from the 20 standard biomes
- [ ] Landmark layers (L5/L10/L15/L20) show a visible tint/tile difference between at least 10 biomes each (screenshotted)
- [ ] Particle effects are thematically consistent with their biome (e.g., no water drops in volcanic_vents)
- [ ] Structural features do not clip through the mine boundary or the spawn/exit tiles

### Code Quality

- [ ] `npm run typecheck` passes with zero new TypeScript errors
- [ ] `npm run build` completes successfully (no bundle errors)
- [ ] No use of `any` type in any Phase 9 file
- [ ] All public functions and classes have JSDoc comments
- [ ] File naming follows conventions: kebab-case utilities, PascalCase classes/components
- [ ] No `eval()`, `innerHTML` with dynamic content, or security violations introduced

### Playwright Regression

Run all Phase 9 test scripts in sequence and confirm all pass:

```
node /tmp/test-9-1-biome-selection.js    # (from sub-phase 9.1)
node /tmp/test-9-2-atlas-swap.js          # (from sub-phase 9.2)
node /tmp/test-9-3-palettes.js            # (from sub-phase 9.3)
node /tmp/test-9-4-structural.js
node /tmp/test-9-5-particles.js
node /tmp/test-9-6-landmarks.js
node /tmp/test-9-7-audio.js
```

- [ ] All 7 test scripts exit with code 0 (no `process.exit(1)`)
- [ ] All screenshot files generated: `/tmp/ss-9-*.png`
- [ ] Visual inspection of screenshots confirms biome diversity and rendering correctness

### Files Created or Modified in Phase 9

New files:
- `src/data/biomes.ts` — biome definitions, tier assignments
- `src/data/biomeStructures.ts` — StructuralFeature type, BIOME_STRUCTURAL_FEATURES
- `src/data/biomeParticles.ts` — ParticleConfig type, BIOME_PARTICLE_CONFIGS
- `src/data/landmarkVariants.ts` — LandmarkVariant type, LANDMARK_VARIANTS, getLandmarkVariant()
- `src/data/biomeAudio.ts` — BiomeAudio type, VolumeProfile, BIOME_AUDIO
- `src/game/BiomeAtlas.ts` — atlas loading/unloading per biome
- `src/game/BiomeParticleManager.ts` — per-biome particle emitter management
- `src/game/LandmarkRenderer.ts` — biome-variant application for landmark layers
- `src/game/AudioManager.ts` — crossfading biome audio manager
- `src/assets/particles/` — 8×8 PNG textures for all particle types
- `src/assets/audio/biomes/` — stub OGG/MP3 files for all 25 biomes

Modified files:
- `src/game/MineGenerator.ts` — structural feature placement pipeline
- `src/game/scenes/MineScene.ts` — integrates BiomeAtlas, BiomeParticleManager, LandmarkRenderer, AudioManager
- `src/game/scenes/PreloadScene.ts` — particle texture preloading
- `src/ui/DevPanel.svelte` — biome selector, landmark selector, particle count display
- `src/ui/Settings.svelte` — music and SFX volume sliders

### Sign-off Checklist

- [ ] All 25 biomes verified in-game via Playwright screenshots
- [ ] Structural features visually confirmed in at least 5 biomes
- [ ] Particle effects visually confirmed in at least 5 biomes
- [ ] Landmark variants visually confirmed in at least 4 biome × landmark combinations
- [ ] Audio crossfade confirmed to play without errors (console clean)
- [ ] Full typecheck and build pass
- [ ] Phase 9 checked off in `docs/roadmap/PROGRESS.md`
- [ ] Phase document moved to `docs/roadmap/completed/PHASE-09-BIOME-EXPANSION.md`
- [ ] Changes committed and pushed to remote on `main`

