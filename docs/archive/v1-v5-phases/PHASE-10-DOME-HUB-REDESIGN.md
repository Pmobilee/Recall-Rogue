# Phase 10: Dome Hub Redesign

## Overview

Replace the current single-dome canvas (`DomeCanvas.svelte` + `domeLayout.ts`) with a multi-floor glass hub system. The current dome is a static 192×128 tile grid with one elliptical arch, three interior levels (catwalks, main floor, basement), and no sense of vertical progression. Phase 10 tears this out and replaces it with a scrollable stack of discrete rectangular floors, each with its own theme, tile layout, interactive objects, and upgrade tier. The result must feel alive, explorable, and deeply addictive.

**Design decisions this phase implements:**
- DD-V2-016: Complete dome redesign — multi-floor glass hubs stacked vertically, scroll navigation, wallpapers per hub
- DD-V2-017: Knowledge Tree as a physical clickable object in the starter hub
- DD-V2-018: All upgrades tied to materials + learning milestones
- DD-V2-019: All upgrades visually reflected in the hub
- DD-V2-020: Physical traversal — player walks to objects, clicks to interact
- DD-V2-124: Physical Knowledge Tree with 8 distinct growth stage sprites
- DD-V2-139: Daily consolidated briefing screen shown on first dome visit each day
- DD-V2-176: GAIA's Report screen — player-facing analytics in the Archive room

## Prerequisites

Before starting Phase 10, these must be complete and passing typecheck:
- Phase 9 complete (Dome Expansion — 6 rooms, pet system, farm, zoo, streak system)
- `src/ui/components/DomeCanvas.svelte` and `src/data/domeLayout.ts` exist and render correctly
- `src/game/domeManifest.ts` with `getDomeSpriteUrls()` working
- `src/ui/stores/playerData.ts` with `playerSave` Svelte store containing `PlayerSave`
- `src/data/types.ts` `PlayerSave` has `learnedFacts: string[]`, `reviewStates: ReviewState[]`, `stats: PlayerStats`, `unlockedRooms: string[]`
- `src/ui/stores/gameState.ts` with `currentScreen` writable store and `Screen` union type
- ComfyUI running at `http://localhost:8188` for sprite generation tasks
- `npm run typecheck` passes with zero errors

---

## Sub-Phase 10.1: Multi-Floor Hub Architecture

### What
Define the complete data model for the multi-floor hub system. Replace the single `DomeLayout` with a `HubStack` containing an ordered array of `HubFloor` objects. Each floor is a self-contained rectangular tile scene with its own background theme, foreground structure tiles, objects, and upgrade tier. This is pure data — no rendering yet.

### Where
- **New file**: `src/data/hubLayout.ts` — all hub data types, constants, floor definitions, factory functions
- **New file**: `src/data/hubFloors.ts` — the 9 canonical floor definitions (contents, unlock requirements, themes)
- **Modified**: `src/data/types.ts` — add `hubState` field to `PlayerSave`
- **Modified**: `src/services/saveService.ts` — migration to add `hubState` with defaults

### How

#### Step 1: Create `src/data/hubLayout.ts`

Define every type, enum, and constant. This file replaces `domeLayout.ts` as the structural source of truth.

```typescript
/**
 * hubLayout.ts
 *
 * Data model for the multi-floor glass hub system (Phase 10).
 * Each HubFloor is a 96×48 tile rectangle rendered at FLOOR_TILE_SIZE px/tile.
 * Canvas per floor: 96*8 = 768px wide, 48*8 = 384px tall.
 *
 * Floors are stacked bottom-to-top. Floor 0 is the Starter Hub (ground level).
 * The Observatory is always the topmost unlocked floor.
 */

/** Logical tile size in CSS pixels for one floor panel. */
export const FLOOR_TILE_SIZE = 8

/** Floor grid dimensions in tiles. */
export const FLOOR_COLS = 96   // 96 * 8 = 768px canvas width
export const FLOOR_ROWS = 48   // 48 * 8 = 384px canvas height

/** Canvas pixel dimensions for a single floor. */
export const FLOOR_CANVAS_W = FLOOR_COLS * FLOOR_TILE_SIZE  // 768
export const FLOOR_CANVAS_H = FLOOR_ROWS * FLOOR_TILE_SIZE  // 384

/** Render-scale multiplier for crisp pixel art on high-DPI displays. */
export const FLOOR_RENDER_SCALE = 2

/**
 * Background tile types for a floor.
 * Drawn first; forms the interior wall / sky fill.
 */
export enum FloorBgTile {
  Empty       = 0,  // Transparent / sky visible
  SkyStars    = 1,  // Night sky — used for Observatory and glass walls
  InteriorWall = 2, // Standard sci-fi interior panel
  DirtGround  = 3,  // Earth / soil — used in Farm basement
  StoneWall   = 4,  // Raw rock — used in deeper research floors
  CrystalWall = 5,  // Crystalline background — Archive / Research Lab
}

/**
 * Foreground / structural tile types for a floor.
 * Forms the floor surface, walls, glass panels, and structural elements.
 */
export enum FloorFgTile {
  Empty         = 0,
  GlassWall     = 1,  // Translucent glass panel (exterior walls)
  MetalFrame    = 2,  // Structural beam / border
  StoneFloor    = 3,  // Main walkable surface
  MetalGrate    = 4,  // Secondary walkable surface (sub-platform)
  GlassCeiling  = 5,  // Transparent ceiling (Observatory)
  WoodPlanks    = 6,  // Farm / organic aesthetic
  CrystalFloor  = 7,  // Bioluminescent crystal tiles (Research Lab)
}

/**
 * Visual upgrade tier for a floor.
 * Controls which wallpaper and decoration density is shown.
 * Tier 0 = bare metal scaffolding. Tier 3 = premium lush environment.
 */
export type FloorUpgradeTier = 0 | 1 | 2 | 3

/**
 * A single interactive or decorative object placed on a floor grid.
 * Identical semantics to the old DomeObject but with a floorId reference.
 */
export interface FloorObject {
  /** Unique identifier. */
  id: string
  /** Sprite key matching domeManifest (no extension). */
  spriteKey: string
  /** Human-readable label for tooltips. */
  label: string
  /**
   * Action identifier.
   * 'dive' → triggers a mine dive.
   * 'none' → decorative, no interaction.
   * Any other string → opens a panel / screen with that id.
   */
  action: string
  /** Column of top-left corner (0-indexed). */
  gridX: number
  /** Row of top-left corner (0-indexed). */
  gridY: number
  /** Width in tiles. */
  gridW: number
  /** Height in tiles. */
  gridH: number
  /** Whether the player can tap/click to interact. */
  interactive: boolean
  /**
   * Minimum upgrade tier required for this object to be visible and interactive.
   * 0 = always shown (default).
   */
  minTier?: FloorUpgradeTier
}

/**
 * A purchasable wallpaper applied to a specific floor.
 * Wallpapers override the bg tile rendering with a stretched image.
 */
export interface FloorWallpaper {
  /** Wallpaper ID matching a sprite key, e.g. 'wallpaper_nebula'. */
  id: string
  /** Display name shown in the Market. */
  label: string
  /** Dust cost to purchase. */
  dustCost: number
  /** Premium material cost (optional — null = no premium cost). */
  premiumCost: number | null
}

/**
 * Unlock requirements for a floor.
 * ALL non-null conditions must be satisfied simultaneously.
 */
export interface FloorUnlockRequirement {
  /** Minimum total dives completed. */
  divesCompleted?: number
  /** Minimum total facts learned. */
  factsLearned?: number
  /** Minimum facts at mastered tier (reps >= 6 in SM-2). */
  factsMastered?: number
  /** Minimum deepest layer reached. */
  deepestLayer?: number
  /** Dust cost to unlock (spent on confirm). */
  dustCost?: number
  /** IDs of floors that must already be unlocked (prerequisites). */
  prerequisiteFloorIds?: string[]
}

/**
 * A single floor in the hub stack.
 */
export interface HubFloor {
  /** Unique stable ID used in PlayerSave. E.g. 'starter', 'farm', 'observatory'. */
  id: string
  /** Display name shown in the floor indicator. */
  name: string
  /** Short description shown when the floor is first unlocked. */
  description: string
  /**
   * Visual theme identifier.
   * Controls ambient particle color, glow palette, and default bg fill.
   */
  theme: 'sci-fi' | 'organic' | 'crystal' | 'observatory' | 'archive' | 'market' | 'industrial'
  /** Stack position — 0 is ground level (Starter Hub), increases upward. */
  stackIndex: number
  /** Background tile grid [row][col]. */
  bg: FloorBgTile[][]
  /** Foreground tile grid [row][col]. */
  fg: FloorFgTile[][]
  /** Objects placed on this floor. */
  objects: FloorObject[]
  /** Unlock requirements. Null = always unlocked (Starter Hub only). */
  unlockRequirements: FloorUnlockRequirement | null
  /** Wallpaper IDs available for purchase for this floor. */
  availableWallpapers: string[]
}

/**
 * The complete hub stack — the single source of truth for DomeView rendering.
 */
export interface HubStack {
  floors: HubFloor[]
}

/**
 * Per-save state for the hub, stored in PlayerSave.hubState.
 */
export interface HubSaveState {
  /** IDs of floors the player has unlocked. Always includes 'starter'. */
  unlockedFloorIds: string[]
  /** Active wallpaper per floor. Key = floorId, value = wallpaper spriteKey or null. */
  activeWallpapers: Record<string, string | null>
  /** Upgrade tier per floor. Key = floorId, value = 0-3. */
  floorTiers: Record<string, FloorUpgradeTier>
  /** Whether the daily briefing has been shown today. ISO date string. */
  lastBriefingDate: string | null
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

/**
 * Creates a 2D grid initialized to a fill value.
 * @param cols Number of columns.
 * @param rows Number of rows.
 * @param fill Initial value for every cell.
 */
export function createFloorGrid<T>(cols: number, rows: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array<T>(cols).fill(fill))
}

/**
 * Fills a rectangular region of a grid with a value.
 * Clamps to grid bounds.
 */
export function fillRect<T>(
  grid: T[][],
  colStart: number,
  rowStart: number,
  colEnd: number,   // inclusive
  rowEnd: number,   // inclusive
  value: T,
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  for (let r = Math.max(0, rowStart); r <= Math.min(rows - 1, rowEnd); r++) {
    for (let c = Math.max(0, colStart); c <= Math.min(cols - 1, colEnd); c++) {
      grid[r][c] = value
    }
  }
}

/**
 * Returns default HubSaveState for new players.
 */
export function defaultHubSaveState(): HubSaveState {
  return {
    unlockedFloorIds: ['starter'],
    activeWallpapers: {},
    floorTiers: { starter: 0 },
    lastBriefingDate: null,
  }
}
```

#### Step 2: Create `src/data/hubFloors.ts`

Define all 9 canonical floors using the types from `hubLayout.ts`. Each floor factory function returns a fully-populated `HubFloor`. Import and call all nine in `getDefaultHubStack()`.

Floor stack (bottom to top, stackIndex 0-8):
- 0: `starter` — Starter Hub (dive hatch, GAIA terminal, Knowledge Tree sapling, materializer)
- 1: `farm` — The Farm (hydroponic plots, seed station, harvest table)
- 2: `workshop` — Workshop (advanced materializer, upgrade anvil, blueprint board)
- 3: `zoo` — The Zoo (companion habitat, feeding station, fossil display)
- 4: `museum` — Museum (artifact display cases, fossil gallery, achievement plaques)
- 5: `market` — Market (deal stall, cosmetics vendor, wallpaper shop)
- 6: `research` — Research Lab (knowledge store terminal, experiment bench, data disc reader)
- 7: `archive` — Archive (bookshelf wall, GAIA report terminal, study alcove)
- 8: `observatory` — Observatory (glass ceiling, star telescope, streak shrine)

For each floor, generate `bg` and `fg` grids (96×48) using `createFloorGrid` and `fillRect`. The structural pattern for every floor:
- All exterior columns (0, 95) and rows (0, 47): `FloorFgTile.MetalFrame`
- Columns 1-94, rows 1-2: `FloorFgTile.GlassWall` (top glass pane)
- Columns 1-94, rows 45-46: `FloorFgTile.StoneFloor` (walkable floor surface)
- Row 47: `FloorFgTile.MetalFrame` (bottom border)
- Interior bg (columns 1-94, rows 3-44): floor-specific `FloorBgTile`
- One ladder opening per floor at columns 44-51 in row 45-46 (cleared to `FloorFgTile.Empty`) for vertical traversal

```typescript
// src/data/hubFloors.ts

import {
  FLOOR_COLS, FLOOR_ROWS,
  FloorBgTile, FloorFgTile,
  createFloorGrid, fillRect,
  type HubFloor, type HubStack,
} from './hubLayout'

// ---------------------------------------------------------------------------
// Shared structural builder
// ---------------------------------------------------------------------------

/**
 * Builds bg and fg grids for a floor with standard glass-box structure.
 * Interior bg fill is provided by caller.
 * @param bgFill - Background tile to fill the interior (rows 3-44, cols 1-94).
 * @param floorTile - Tile type for the walkable floor surface (rows 45-46).
 */
function buildStandardGrids(
  bgFill: FloorBgTile,
  floorTile: FloorFgTile = FloorFgTile.StoneFloor,
): { bg: FloorBgTile[][], fg: FloorFgTile[][] } {
  const bg = createFloorGrid<FloorBgTile>(FLOOR_COLS, FLOOR_ROWS, FloorBgTile.Empty)
  const fg = createFloorGrid<FloorFgTile>(FLOOR_COLS, FLOOR_ROWS, FloorFgTile.Empty)

  // Sky outside the glass box (entire grid defaults Empty = sky visible behind)
  // Interior background fill
  fillRect(bg, 1, 3, 94, 44, bgFill)

  // Outer metal frame border
  fillRect(fg, 0, 0, 95, 0, FloorFgTile.MetalFrame)    // top border
  fillRect(fg, 0, 47, 95, 47, FloorFgTile.MetalFrame)  // bottom border
  fillRect(fg, 0, 0, 0, 47, FloorFgTile.MetalFrame)    // left border
  fillRect(fg, 95, 0, 95, 47, FloorFgTile.MetalFrame)  // right border

  // Glass top pane (rows 1-2, interior width)
  fillRect(fg, 1, 1, 94, 2, FloorFgTile.GlassWall)

  // Walkable floor (rows 45-46)
  fillRect(fg, 1, 45, 94, 46, floorTile)

  // Ladder shaft opening (cols 44-51) — clear floor tiles so player can descend
  fillRect(fg, 44, 45, 51, 46, FloorFgTile.Empty)

  return { bg, fg }
}

// ---------------------------------------------------------------------------
// Floor 0: Starter Hub
// ---------------------------------------------------------------------------

function makeStarterFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)

  return {
    id: 'starter',
    name: 'Starter Hub',
    description: 'Your crash-landing site. G.A.I.A. has set up a basic operations center here.',
    theme: 'sci-fi',
    stackIndex: 0,
    bg, fg,
    objects: [
      {
        id: 'dive_hatch',
        spriteKey: 'obj_dive_hatch',
        label: 'Mine Entrance',
        action: 'dive',
        gridX: 44, gridY: 38, gridW: 14, gridH: 7,
        interactive: true,
      },
      {
        id: 'gaia_terminal',
        spriteKey: 'obj_gaia_terminal',
        label: 'G.A.I.A. Terminal',
        action: 'command',
        gridX: 10, gridY: 30, gridW: 10, gridH: 15,
        interactive: true,
      },
      {
        id: 'knowledge_tree',
        spriteKey: 'obj_knowledge_tree_stage0',
        label: 'Knowledge Tree',
        action: 'knowledgeTree',
        gridX: 22, gridY: 28, gridW: 12, gridH: 17,
        interactive: true,
      },
      {
        id: 'workbench',
        spriteKey: 'obj_workbench',
        label: 'Materializer',
        action: 'workshop',
        gridX: 70, gridY: 32, gridW: 13, gridH: 13,
        interactive: true,
      },
      {
        id: 'streak_board',
        spriteKey: 'obj_streak_board',
        label: 'Streak Board',
        action: 'streakPanel',
        gridX: 84, gridY: 35, gridW: 6, gridH: 10,
        interactive: true,
      },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_nebula', 'wallpaper_aurora', 'wallpaper_deep_space'],
  }
}

// ---------------------------------------------------------------------------
// Floor 1: The Farm
// ---------------------------------------------------------------------------

function makeFarmFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.WoodPlanks)
  // Extra dirt bg rows at bottom to suggest soil
  fillRect(bg, 1, 40, 94, 44, FloorBgTile.DirtGround)

  return {
    id: 'farm',
    name: 'The Farm',
    description: 'Hydroponic growing chambers. Seeds from the surface can be cultivated underground.',
    theme: 'organic',
    stackIndex: 1,
    bg, fg,
    objects: [
      {
        id: 'farm_plot_1',
        spriteKey: 'obj_farm_plot',
        label: 'Hydroponic Bay A',
        action: 'farm',
        gridX: 5, gridY: 34, gridW: 20, gridH: 10,
        interactive: true,
      },
      {
        id: 'farm_plot_2',
        spriteKey: 'obj_farm_plot',
        label: 'Hydroponic Bay B',
        action: 'farm',
        gridX: 28, gridY: 34, gridW: 20, gridH: 10,
        interactive: true,
        minTier: 1,
      },
      {
        id: 'seed_station',
        spriteKey: 'obj_seed_station',
        label: 'Seed Station',
        action: 'farm',
        gridX: 68, gridY: 30, gridW: 12, gridH: 15,
        interactive: true,
      },
    ],
    unlockRequirements: {
      divesCompleted: 3,
      factsLearned: 10,
      dustCost: 500,
    },
    availableWallpapers: ['wallpaper_meadow', 'wallpaper_forest', 'wallpaper_greenhouse'],
  }
}

// ---------------------------------------------------------------------------
// Floor 2: Workshop
// ---------------------------------------------------------------------------

function makeWorkshopFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.StoneWall, FloorFgTile.MetalGrate)

  return {
    id: 'workshop',
    name: 'Workshop',
    description: 'Advanced fabrication suite. Craft powerful consumables and permanent upgrades.',
    theme: 'industrial',
    stackIndex: 2,
    bg, fg,
    objects: [
      {
        id: 'premium_materializer',
        spriteKey: 'obj_premium_workbench',
        label: 'Premium Materializer',
        action: 'premiumMaterializer',
        gridX: 8, gridY: 28, gridW: 16, gridH: 17,
        interactive: true,
      },
      {
        id: 'upgrade_anvil',
        spriteKey: 'obj_upgrade_anvil',
        label: 'Upgrade Anvil',
        action: 'workshop',
        gridX: 38, gridY: 30, gridW: 14, gridH: 15,
        interactive: true,
        minTier: 1,
      },
      {
        id: 'blueprint_board',
        spriteKey: 'obj_blueprint_board',
        label: 'Blueprint Board',
        action: 'workshop',
        gridX: 68, gridY: 20, gridW: 14, gridH: 15,
        interactive: true,
      },
    ],
    unlockRequirements: {
      divesCompleted: 10,
      factsLearned: 30,
      dustCost: 2000,
      prerequisiteFloorIds: ['farm'],
    },
    availableWallpapers: ['wallpaper_industrial', 'wallpaper_blueprint', 'wallpaper_lava_forge'],
  }
}

// ---------------------------------------------------------------------------
// Floor 3: The Zoo
// ---------------------------------------------------------------------------

function makeZooFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.StoneFloor)

  return {
    id: 'zoo',
    name: 'The Zoo',
    description: 'Fossil revival chambers. Revived companions live and roam here between dives.',
    theme: 'organic',
    stackIndex: 3,
    bg, fg,
    objects: [
      {
        id: 'companion_habitat',
        spriteKey: 'obj_fossil_tank',
        label: 'Companion Habitat',
        action: 'zoo',
        gridX: 5, gridY: 22, gridW: 30, gridH: 23,
        interactive: true,
      },
      {
        id: 'fossil_display',
        spriteKey: 'obj_fossil_display',
        label: 'Fossil Gallery',
        action: 'fossilGallery',
        gridX: 60, gridY: 28, gridW: 16, gridH: 17,
        interactive: true,
      },
      {
        id: 'feeding_station',
        spriteKey: 'obj_feeding_station',
        label: 'Feeding Station',
        action: 'zoo',
        gridX: 78, gridY: 32, gridW: 10, gridH: 13,
        interactive: true,
        minTier: 1,
      },
    ],
    unlockRequirements: {
      divesCompleted: 15,
      factsLearned: 50,
      factsMastered: 5,
      dustCost: 3000,
      prerequisiteFloorIds: ['farm'],
    },
    availableWallpapers: ['wallpaper_savanna', 'wallpaper_ocean', 'wallpaper_jungle'],
  }
}

// ---------------------------------------------------------------------------
// Floor 4: Museum
// ---------------------------------------------------------------------------

function makeMuseumFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)

  return {
    id: 'museum',
    name: 'Museum',
    description: 'Artifacts and relics from your dives, displayed with pride.',
    theme: 'archive',
    stackIndex: 4,
    bg, fg,
    objects: [
      {
        id: 'display_case_a',
        spriteKey: 'obj_display_case',
        label: 'Relic Display A',
        action: 'museum',
        gridX: 6, gridY: 26, gridW: 14, gridH: 19,
        interactive: true,
      },
      {
        id: 'display_case_b',
        spriteKey: 'obj_display_case',
        label: 'Relic Display B',
        action: 'museum',
        gridX: 30, gridY: 26, gridW: 14, gridH: 19,
        interactive: true,
        minTier: 1,
      },
      {
        id: 'achievement_wall',
        spriteKey: 'obj_achievement_wall',
        label: 'Achievement Wall',
        action: 'museum',
        gridX: 62, gridY: 16, gridW: 20, gridH: 18,
        interactive: true,
      },
    ],
    unlockRequirements: {
      divesCompleted: 20,
      factsLearned: 75,
      dustCost: 5000,
      prerequisiteFloorIds: ['zoo'],
    },
    availableWallpapers: ['wallpaper_marble', 'wallpaper_antiquity', 'wallpaper_hall_of_fame'],
  }
}

// ---------------------------------------------------------------------------
// Floor 5: Market
// ---------------------------------------------------------------------------

function makeMarketFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)

  return {
    id: 'market',
    name: 'Market',
    description: 'Daily deals, cosmetics, and wallpapers. The merchant changes stock every 24 hours.',
    theme: 'market',
    stackIndex: 5,
    bg, fg,
    objects: [
      {
        id: 'market_stall',
        spriteKey: 'obj_market_stall',
        label: 'Daily Deals',
        action: 'market',
        gridX: 8, gridY: 24, gridW: 16, gridH: 21,
        interactive: true,
      },
      {
        id: 'cosmetics_vendor',
        spriteKey: 'obj_cosmetics_vendor',
        label: 'Cosmetics Shop',
        action: 'cosmeticsShop',
        gridX: 40, gridY: 24, gridW: 16, gridH: 21,
        interactive: true,
      },
      {
        id: 'wallpaper_shop',
        spriteKey: 'obj_wallpaper_kiosk',
        label: 'Wallpaper Shop',
        action: 'wallpaperShop',
        gridX: 70, gridY: 28, gridW: 14, gridH: 17,
        interactive: true,
        minTier: 1,
      },
    ],
    unlockRequirements: {
      divesCompleted: 25,
      factsLearned: 100,
      dustCost: 4000,
      prerequisiteFloorIds: ['museum'],
    },
    availableWallpapers: ['wallpaper_bazaar', 'wallpaper_neon_market', 'wallpaper_crystal_arcade'],
  }
}

// ---------------------------------------------------------------------------
// Floor 6: Research Lab
// ---------------------------------------------------------------------------

function makeResearchFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.CrystalWall, FloorFgTile.CrystalFloor)

  return {
    id: 'research',
    name: 'Research Lab',
    description: 'Convert knowledge into power. Houses the Knowledge Store and Data Disc reader.',
    theme: 'crystal',
    stackIndex: 6,
    bg, fg,
    objects: [
      {
        id: 'knowledge_store_terminal',
        spriteKey: 'obj_knowledge_store',
        label: 'Knowledge Store',
        action: 'knowledgeStore',
        gridX: 6, gridY: 22, gridW: 18, gridH: 23,
        interactive: true,
      },
      {
        id: 'data_disc_reader',
        spriteKey: 'obj_data_disc_reader',
        label: 'Data Disc Reader',
        action: 'dataDisc',
        gridX: 40, gridY: 26, gridW: 14, gridH: 19,
        interactive: true,
      },
      {
        id: 'experiment_bench',
        spriteKey: 'obj_experiment_bench',
        label: 'Experiment Bench',
        action: 'research',
        gridX: 68, gridY: 26, gridW: 16, gridH: 19,
        interactive: true,
        minTier: 2,
      },
    ],
    unlockRequirements: {
      divesCompleted: 35,
      factsLearned: 150,
      factsMastered: 25,
      dustCost: 8000,
      prerequisiteFloorIds: ['market'],
    },
    availableWallpapers: ['wallpaper_crystal_cave', 'wallpaper_bioluminescent', 'wallpaper_void'],
  }
}

// ---------------------------------------------------------------------------
// Floor 7: Archive
// ---------------------------------------------------------------------------

function makeArchiveFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.CrystalWall)

  return {
    id: 'archive',
    name: 'Archive',
    description: 'G.A.I.A.\'s full report lives here. Review your learning analytics and history.',
    theme: 'archive',
    stackIndex: 7,
    bg, fg,
    objects: [
      {
        id: 'bookshelf',
        spriteKey: 'obj_bookshelf',
        label: 'Knowledge Archive',
        action: 'archive',
        gridX: 4, gridY: 14, gridW: 20, gridH: 31,
        interactive: true,
      },
      {
        id: 'gaia_report_terminal',
        spriteKey: 'obj_gaia_report',
        label: 'G.A.I.A. Report',
        action: 'gaiaReport',
        gridX: 38, gridY: 22, gridW: 18, gridH: 23,
        interactive: true,
      },
      {
        id: 'study_alcove',
        spriteKey: 'obj_study_alcove',
        label: 'Study Alcove',
        action: 'studySession',
        gridX: 68, gridY: 26, gridW: 16, gridH: 19,
        interactive: true,
      },
    ],
    unlockRequirements: {
      divesCompleted: 50,
      factsLearned: 250,
      factsMastered: 50,
      dustCost: 12000,
      prerequisiteFloorIds: ['research'],
    },
    availableWallpapers: ['wallpaper_library', 'wallpaper_scriptorium', 'wallpaper_ancient_texts'],
  }
}

// ---------------------------------------------------------------------------
// Floor 8: Observatory (always topmost)
// ---------------------------------------------------------------------------

function makeObservatoryFloor(): HubFloor {
  // Observatory: glass ceiling + sky bg throughout
  const bg = createFloorGrid<FloorBgTile>(FLOOR_COLS, FLOOR_ROWS, FloorBgTile.SkyStars)
  const fg = createFloorGrid<FloorFgTile>(FLOOR_COLS, FLOOR_ROWS, FloorFgTile.Empty)

  // Metal frame border
  fillRect(fg, 0, 0, 95, 0, FloorFgTile.MetalFrame)
  fillRect(fg, 0, 47, 95, 47, FloorFgTile.MetalFrame)
  fillRect(fg, 0, 0, 0, 47, FloorFgTile.MetalFrame)
  fillRect(fg, 95, 0, 95, 47, FloorFgTile.MetalFrame)

  // Glass ceiling (rows 1-6) — see the stars
  fillRect(fg, 1, 1, 94, 6, FloorFgTile.GlassCeiling)

  // Stone floor surface
  fillRect(fg, 1, 45, 94, 46, FloorFgTile.StoneFloor)
  // No ladder shaft on the topmost floor

  return {
    id: 'observatory',
    name: 'Observatory',
    description: 'A glass-domed stargazing chamber at the top of the hub. The pinnacle of your journey.',
    theme: 'observatory',
    stackIndex: 8,
    bg, fg,
    objects: [
      {
        id: 'telescope',
        spriteKey: 'obj_telescope',
        label: 'Star Telescope',
        action: 'observatory',
        gridX: 38, gridY: 20, gridW: 20, gridH: 25,
        interactive: true,
      },
      {
        id: 'streak_shrine',
        spriteKey: 'obj_streak_shrine',
        label: 'Streak Shrine',
        action: 'streakPanel',
        gridX: 10, gridY: 28, gridW: 14, gridH: 17,
        interactive: true,
      },
      {
        id: 'star_map',
        spriteKey: 'obj_star_map',
        label: 'Star Map',
        action: 'observatory',
        gridX: 70, gridY: 22, gridW: 16, gridH: 21,
        interactive: true,
        minTier: 2,
      },
    ],
    unlockRequirements: {
      divesCompleted: 75,
      factsLearned: 400,
      factsMastered: 100,
      deepestLayer: 15,
      dustCost: 20000,
      prerequisiteFloorIds: ['archive'],
    },
    availableWallpapers: ['wallpaper_cosmos', 'wallpaper_aurora_borealis', 'wallpaper_supernova'],
  }
}

// ---------------------------------------------------------------------------
// Hub stack factory
// ---------------------------------------------------------------------------

/**
 * Returns the complete hub stack with all 9 canonical floors.
 * Used by HubView.svelte as the static structural definition.
 * Actual unlock state comes from PlayerSave.hubState.
 */
export function getDefaultHubStack(): HubStack {
  return {
    floors: [
      makeStarterFloor(),
      makeFarmFloor(),
      makeWorkshopFloor(),
      makeZooFloor(),
      makeMuseumFloor(),
      makeMarketFloor(),
      makeResearchFloor(),
      makeArchiveFloor(),
      makeObservatoryFloor(),
    ],
  }
}
```

#### Step 3: Modify `src/data/types.ts`

Add `hubState` to `PlayerSave`:

```typescript
// In PlayerSave interface, after the `// Progression (future: dome, etc.)` comment:
import type { HubSaveState } from './hubLayout'

// Hub
hubState: HubSaveState
```

#### Step 4: Modify `src/services/saveService.ts`

In the `defaultSave()` factory function, add:

```typescript
import { defaultHubSaveState } from '../data/hubLayout'

// Inside defaultSave():
hubState: defaultHubSaveState(),
```

In the save migration function (wherever version upgrades happen), add a guard:

```typescript
if (!save.hubState) {
  save.hubState = defaultHubSaveState()
}
```

### Acceptance Criteria
- `npm run typecheck` passes with zero errors after all file changes
- `HubFloor`, `HubStack`, `HubSaveState` types are importable from `src/data/hubLayout.ts`
- `getDefaultHubStack()` returns 9 floors with stackIndex 0-8
- `PlayerSave.hubState` is present in the type and populated by `defaultSave()`
- Existing `DomeCanvas.svelte` and `domeLayout.ts` still compile without modification (they are replaced later in 10.9, not now)

### Playwright Test

```js
// Write to /tmp/ss-10.1.js and run: node /tmp/ss-10.1.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  // Verify app loads without console errors (hubState migration)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.waitForTimeout(1000)
  if (errors.length > 0) {
    console.error('FAIL: console errors:', errors)
    process.exit(1)
  }
  console.log('PASS: App loaded with no console errors')
  await page.screenshot({ path: '/tmp/ss-10.1-base.png' })
  await browser.close()
})()
```

---

## Sub-Phase 10.2: Hub Navigation System

### What
Build the scrollable, multi-floor navigation UI. The player sees the current floor rendered full-screen and can swipe up/down (mobile) or scroll wheel (desktop) to move between floors. A floor indicator on the right edge shows position in the stack. Tapping a floor label in the indicator teleports to that floor. Floor transitions play a smooth slide animation (CSS transform).

### Where
- **New file**: `src/ui/components/HubView.svelte` — top-level dome view, replaces `DomeView.svelte` in `App.svelte`
- **New file**: `src/ui/components/FloorCanvas.svelte` — renders a single `HubFloor` (analogous to `DomeCanvas.svelte`)
- **New file**: `src/ui/components/FloorIndicator.svelte` — right-edge floor position indicator
- **Modified**: `src/ui/stores/gameState.ts` — add `currentFloorIndex` writable store, add `'hubView'` to `Screen` type (or reuse `'base'`)

### How

#### Step 1: Add `currentFloorIndex` to `src/ui/stores/gameState.ts`

```typescript
/** Index of the currently displayed hub floor (0 = Starter Hub). */
export const currentFloorIndex = writable<number>(0)
```

#### Step 2: Create `src/ui/components/FloorIndicator.svelte`

This component renders the vertical stack indicator on the right edge. It receives the full floor list, the list of unlocked floor IDs, and the current floor index. It renders one pip per unlocked floor, labels the current floor, and emits `onFloorSelect(index)` when a pip is tapped.

```typescript
interface Props {
  /** All floors in stack order (0 = bottom). */
  floors: HubFloor[]
  /** Floor IDs the player has unlocked. */
  unlockedIds: string[]
  /** Currently visible floor index. */
  currentIndex: number
  /** Called when player taps a floor pip. */
  onFloorSelect: (index: number) => void
}
```

Render as a `position: fixed; right: 0; top: 50%; transform: translateY(-50%)` vertical column. Each pip is a 12×12 circle: teal (#4ecca3) if current floor, dim (#444) if locked, white if unlocked. Label the current floor name in 10px monospace above the pip column. Minimum tap target 44×44px — wrap each pip in a button element.

#### Step 3: Create `src/ui/components/FloorCanvas.svelte`

Single-floor renderer. Identical architecture to `DomeCanvas.svelte` but simpler:
- Accepts a `HubFloor` prop and a `spriteUrls` map prop
- Renders `bg` grid, then `fg` grid, then `objects` on a `<canvas>` element
- Canvas internal size: `FLOOR_CANVAS_W * FLOOR_RENDER_SCALE` × `FLOOR_CANVAS_H * FLOOR_RENDER_SCALE`
- CSS size: `width: 100%; max-width: 768px; height: auto; image-rendering: pixelated`
- Uses offscreen canvas caching for bg and fg tile layers (same pattern as `DomeCanvas`)
- Emits `onObjectTap(objectId: string, action: string)` when player taps an interactive object
- Sprite rendering: draw sprites scaled to `gridW * FLOOR_TILE_SIZE` × `gridH * FLOOR_TILE_SIZE` at `gridX * FLOOR_TILE_SIZE, gridY * FLOOR_TILE_SIZE`
- Hit detection: convert `clientX/Y` to grid coordinates using `getBoundingClientRect()`, find object whose bounds contain the point, emit `onObjectTap`

```typescript
interface Props {
  floor: HubFloor
  spriteUrls: Record<string, string>
  onObjectTap: (objectId: string, action: string) => void
  upgradeTier: FloorUpgradeTier
}
```

Tile sprite lookup for `FloorFgTile`:
```typescript
const FG_SPRITES: Record<FloorFgTile, string | null> = {
  [FloorFgTile.Empty]:        null,
  [FloorFgTile.GlassWall]:    'dome_glass',
  [FloorFgTile.MetalFrame]:   'dome_frame',
  [FloorFgTile.StoneFloor]:   'stone_floor',
  [FloorFgTile.MetalGrate]:   'metal_platform',
  [FloorFgTile.GlassCeiling]: 'dome_glass_curved',
  [FloorFgTile.WoodPlanks]:   'wood_planks',
  [FloorFgTile.CrystalFloor]: 'crystal_floor',
}
```

Tile sprite lookup for `FloorBgTile`:
```typescript
const BG_SPRITES: Record<FloorBgTile, string | null> = {
  [FloorBgTile.Empty]:        null,
  [FloorBgTile.SkyStars]:     'sky_stars',
  [FloorBgTile.InteriorWall]: 'interior_wall',
  [FloorBgTile.DirtGround]:   'dirt_ground',
  [FloorBgTile.StoneWall]:    'stone_wall',
  [FloorBgTile.CrystalWall]:  'crystal_wall',
}
```

Filter visible objects by `upgradeTier >= (obj.minTier ?? 0)`.

#### Step 4: Create `src/ui/components/HubView.svelte`

This is the new top-level dome component. Structure:

```
<div class="hub-view">
  <ResourceBar />                     <!-- reuse existing resource bar markup -->
  <div class="floor-viewport">
    <div class="floor-slide-container" style="transform: translateY(...)">
      <!-- One FloorCanvas per UNLOCKED floor, stacked -->
      {#each unlockedFloors as floor, i}
        <div class="floor-slot" style="...">
          <FloorCanvas floor={floor} ... />
        </div>
      {/each}
    </div>
  </div>
  <FloorIndicator ... />
  <RoomPanel ... />                   <!-- slide-up panel same as DomeView -->
</div>
```

Navigation logic:
- `currentFloorIndex` (local `$state`, also synced to the store) tracks which floor is visible
- `floor-slide-container` `translateY` = `-currentFloorIndex * FLOOR_CANVAS_H * cssScaleFactor`
- Transition: CSS `transition: transform 400ms cubic-bezier(0.4, 0.0, 0.2, 1)`
- Touch events: track `touchstart` and `touchend` Y delta. If `|deltaY| > 40px`, change floor by ±1
- Wheel events: `event.deltaY > 0` → go up (higher index), `event.deltaY < 0` → go down (lower index)
- Clamp index to `[0, unlockedFloors.length - 1]`
- `FloorIndicator` taps call `currentFloorIndex = selectedIndex`

Object tap routing:
```typescript
function handleObjectTap(objectId: string, action: string): void {
  if (action === 'dive') { onDive(); return }
  if (action === 'none') return
  // Navigate to the appropriate screen or open panel
  switch (action) {
    case 'knowledgeTree':      onViewTree?.(); break
    case 'workshop':           onMaterializer?.(); break
    case 'premiumMaterializer':onPremiumMaterializer?.(); break
    case 'cosmeticsShop':      onCosmetics?.(); break
    case 'knowledgeStore':     onKnowledgeStore?.(); break
    case 'fossilGallery':      onFossils?.(); break
    case 'zoo':                onZoo?.(); break
    case 'streakPanel':        onStreakPanel?.(); break
    case 'farm':               onFarm?.(); break
    case 'gaiaReport':         activePanel = 'gaiaReport'; break
    default:                   activePanel = action; break
  }
}
```

Props interface mirrors `DomeView.svelte` exactly (same callbacks) plus:
```typescript
interface Props {
  // ... all existing DomeView props ...
  onGaiaReport?: () => void
  onWallpaperShop?: () => void
}
```

#### Step 5: Modify `src/App.svelte`

Replace `<DomeView .../>` with `<HubView .../>`. Map all existing callbacks identically. Add `onGaiaReport` callback that sets `currentScreen` to `'gaiaReport'` (a new Screen value to be added to gameState.ts in 10.8).

Keep `DomeView.svelte` intact — do not delete it yet (deleted in 10.9 cleanup).

### Acceptance Criteria
- Swiping up/down between floors works on mobile (touch events)
- Scroll wheel changes floors on desktop
- Floor indicator shows current floor with teal pip; tapping a pip navigates immediately
- CSS transition animates the floor slide at 400ms
- `onDive()` is called correctly from the dive hatch object tap
- All existing room callbacks still work (workshop, farm, zoo, etc.)
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.2.js and run: node /tmp/ss-10.2.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss-10.2-starter.png' })

  // Scroll up to trigger floor change (if Farm is unlocked in dev save)
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-10.2-scrolled.png' })

  // Check floor indicator exists
  const indicator = await page.$('[aria-label*="floor"]')
  console.log(indicator ? 'PASS: Floor indicator found' : 'WARN: Floor indicator not found')
  await browser.close()
})()
```

---

## Sub-Phase 10.3: Hub Upgradeability System

### What
Implement the material + learning milestone upgrade system for each floor. Players spend dust (and optionally premium materials) to advance a floor from tier 0 (bare) to tier 3 (premium). Each tier transition triggers a visual change in `FloorCanvas` (additional decoration objects appear, lighting color shifts) and persists in `PlayerSave.hubState.floorTiers`. Also implements wallpaper purchase and application from the Market floor.

### Where
- **New file**: `src/data/hubUpgrades.ts` — tier definitions, costs, visual changes per floor
- **New file**: `src/ui/components/FloorUpgradePanel.svelte` — upgrade purchase UI (embedded in room panel)
- **New file**: `src/ui/components/WallpaperShop.svelte` — browse and apply wallpapers
- **Modified**: `src/game/GameManager.ts` — add `upgradeFloor(floorId, targetTier)` and `applyWallpaper(floorId, wallpaperId)` methods
- **Modified**: `src/services/saveService.ts` — add `upgradeFloor()` and `applyWallpaper()` save mutations

### How

#### Step 1: Create `src/data/hubUpgrades.ts`

```typescript
export interface FloorTierDefinition {
  tier: FloorUpgradeTier
  label: string
  description: string
  /** Dust cost to advance FROM previous tier TO this tier. */
  dustCost: number
  /** Premium material costs. Empty array = no premium cost. */
  premiumCosts: Array<{ materialId: string; count: number }>
  /** Minimum facts mastered required (SM-2 reps >= 6). */
  minFactsMastered: number
  /** Object IDs from the HubFloor that become visible at this tier. */
  unlocksObjectIds: string[]
  /** CSS filter applied to the floor canvas bg at this tier.
   *  e.g. 'brightness(1.15) saturate(1.3)' for lush/premium feel. */
  bgFilter: string
}

export type FloorUpgradeMap = Record<string, FloorTierDefinition[]>

/**
 * Upgrade tier definitions per floor ID.
 * Each array has 3 entries: tiers 1, 2, 3 (tier 0 is the default/free state).
 */
export const FLOOR_UPGRADES: FloorUpgradeMap = {
  starter: [
    {
      tier: 1, label: 'Improved', description: 'Better lighting and reinforced walls.',
      dustCost: 1000, premiumCosts: [], minFactsMastered: 5,
      unlocksObjectIds: [], bgFilter: 'brightness(1.1)',
    },
    {
      tier: 2, label: 'Advanced', description: 'Holographic displays and crystal lighting.',
      dustCost: 3000, premiumCosts: [{ materialId: 'crystal_shard', count: 5 }],
      minFactsMastered: 20, unlocksObjectIds: [], bgFilter: 'brightness(1.2) saturate(1.2)',
    },
    {
      tier: 3, label: 'Premium', description: 'Luxury biome-glass panels and ambient GAIA lighting.',
      dustCost: 8000, premiumCosts: [{ materialId: 'essence_core', count: 3 }],
      minFactsMastered: 50, unlocksObjectIds: [], bgFilter: 'brightness(1.3) saturate(1.4) hue-rotate(5deg)',
    },
  ],
  farm: [
    {
      tier: 1, label: 'Expanded', description: 'Second hydroponic bay comes online.',
      dustCost: 1500, premiumCosts: [], minFactsMastered: 10,
      unlocksObjectIds: ['farm_plot_2'], bgFilter: 'brightness(1.1) saturate(1.1)',
    },
    {
      tier: 2, label: 'Automated', description: 'Auto-harvest system installed.',
      dustCost: 4000, premiumCosts: [{ materialId: 'crystal_shard', count: 8 }],
      minFactsMastered: 30, unlocksObjectIds: [], bgFilter: 'brightness(1.2) saturate(1.3)',
    },
    {
      tier: 3, label: 'Lush', description: 'Bioluminescent plant varieties and nutrient maximizers.',
      dustCost: 10000, premiumCosts: [{ materialId: 'essence_core', count: 5 }],
      minFactsMastered: 75, unlocksObjectIds: [], bgFilter: 'brightness(1.25) saturate(1.5)',
    },
  ],
  // ... Add equivalent 3-entry arrays for: workshop, zoo, museum, market, research, archive, observatory
  // Pattern: tier 1 unlocks one minTier:1 object, tier 2 unlocks minTier:2 objects, tier 3 is cosmetic peak
}

/**
 * Returns the upgrade definition for advancing a floor to the given tier.
 * Returns null if the tier is 0 (always free) or the floor has no upgrade data.
 */
export function getUpgradeDef(
  floorId: string,
  targetTier: FloorUpgradeTier,
): FloorTierDefinition | null {
  if (targetTier === 0) return null
  return FLOOR_UPGRADES[floorId]?.[targetTier - 1] ?? null
}

/**
 * Checks whether a player meets the requirements for a specific tier upgrade.
 */
export function canUpgrade(
  floorId: string,
  targetTier: FloorUpgradeTier,
  save: PlayerSave,
): { allowed: boolean; reason?: string } {
  const def = getUpgradeDef(floorId, targetTier)
  if (!def) return { allowed: false, reason: 'No upgrade defined' }

  const currentTier = save.hubState.floorTiers[floorId] ?? 0
  if (currentTier >= targetTier) return { allowed: false, reason: 'Already at this tier' }
  if (currentTier !== targetTier - 1) return { allowed: false, reason: 'Must upgrade in order' }

  const masteredCount = save.reviewStates.filter(rs => rs.repetitions >= 6).length
  if (masteredCount < def.minFactsMastered) {
    return { allowed: false, reason: `Need ${def.minFactsMastered} mastered facts (have ${masteredCount})` }
  }
  if (save.minerals.dust < def.dustCost) {
    return { allowed: false, reason: `Need ${def.dustCost} dust` }
  }
  for (const { materialId, count } of def.premiumCosts) {
    if ((save.premiumMaterials[materialId] ?? 0) < count) {
      return { allowed: false, reason: `Need ${count}x ${materialId}` }
    }
  }
  return { allowed: true }
}
```

#### Step 2: Add to `src/game/GameManager.ts`

```typescript
/**
 * Upgrades a hub floor to the next tier, spending resources.
 * Emits 'floor-upgraded' event on success.
 */
upgradeFloor(floorId: string, targetTier: FloorUpgradeTier): boolean {
  const save = get(playerSave)
  if (!save) return false
  const check = canUpgrade(floorId, targetTier, save)
  if (!check.allowed) { console.warn('upgradeFloor blocked:', check.reason); return false }
  const def = getUpgradeDef(floorId, targetTier)!
  saveService.spendDust(def.dustCost)
  for (const { materialId, count } of def.premiumCosts) {
    saveService.spendPremiumMaterial(materialId, count)
  }
  saveService.setFloorTier(floorId, targetTier)
  this.randomGaia(`You've upgraded the ${floorId} to tier ${targetTier}! It looks magnificent.`)
  return true
}

/**
 * Applies a wallpaper to a floor (must be owned or free).
 */
applyWallpaper(floorId: string, wallpaperId: string): void {
  saveService.setFloorWallpaper(floorId, wallpaperId)
}
```

#### Step 3: Add mutations to `src/services/saveService.ts`

```typescript
/** Sets the upgrade tier for a hub floor. */
setFloorTier(floorId: string, tier: FloorUpgradeTier): void {
  playerSave.update(s => {
    if (!s) return s
    s.hubState.floorTiers[floorId] = tier
    return s
  })
  this.persist()
}

/** Sets the active wallpaper for a hub floor. */
setFloorWallpaper(floorId: string, wallpaperId: string | null): void {
  playerSave.update(s => {
    if (!s) return s
    s.hubState.activeWallpapers[floorId] = wallpaperId
    return s
  })
  this.persist()
}
```

#### Step 4: Create `src/ui/components/FloorUpgradePanel.svelte`

A self-contained panel that shows the current tier, next tier requirements, and a "Upgrade" button. Displayed inside the room panel when the player taps the floor indicator (long-press) or a dedicated "Upgrade Floor" button in the HubView footer.

- Show tier 0-3 progress bar (4 segments)
- Show current tier label
- Show next tier: cost, mastered facts requirement, objects it unlocks
- "Upgrade" button calls `gameManager.upgradeFloor(floorId, currentTier + 1)`
- Disable button with tooltip if `canUpgrade` returns `allowed: false`

### Acceptance Criteria
- Spending dust via `upgradeFloor()` correctly decrements `playerSave.minerals.dust`
- `hubState.floorTiers['starter']` advances from 0 to 1 after upgrade
- Objects with `minTier: 1` become visible in `FloorCanvas` after tier 1 upgrade
- `canUpgrade` correctly blocks if mastered facts or dust is insufficient
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.3.js and run: node /tmp/ss-10.3.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  // Give player dust via dev panel to test upgrade
  await page.evaluate(() => {
    const event = new CustomEvent('dev:give-dust', { detail: { amount: 50000 } })
    window.dispatchEvent(event)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-10.3-before.png' })
  // Open upgrade panel (implementation-specific — tap upgrade button if present)
  const upgradeBtn = await page.$('button:has-text("Upgrade Floor")')
  if (upgradeBtn) {
    await upgradeBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-10.3-upgrade-panel.png' })
  }
  await browser.close()
})()
```

---

## Sub-Phase 10.4: Animated Pet in Dome

### What
The player's active companion (selected fossil pet from `PlayerSave.activeCompanion`) renders as an animated sprite that walks left and right on the current floor of the Starter Hub. The pet uses a CSS sprite-sheet animation (3-frame walk cycle). When idle (no movement for 3 seconds), it plays an idle animation. Tapping the pet opens the Zoo panel.

### Where
- **New file**: `src/ui/components/PetSprite.svelte` — standalone animated pet canvas overlay
- **Modified**: `src/ui/components/FloorCanvas.svelte` — render `PetSprite` as an overlay on the Starter Hub floor
- **Modified**: `src/game/domeManifest.ts` — add pet sprite keys (`pet_trilobite_walk`, `pet_trilobite_idle`, etc.)
- **New file**: `src/data/petAnimations.ts` — frame definitions for each companion species

### How

#### Step 1: Create `src/data/petAnimations.ts`

```typescript
export interface PetAnimationDef {
  /** Sprite sheet key in domeManifest. One PNG with all frames side-by-side. */
  walkSpriteKey: string
  idleSpriteKey: string
  /** Number of frames in the walk animation. */
  walkFrames: number
  /** Number of frames in the idle animation. */
  idleFrames: number
  /** Frame display duration in milliseconds. */
  frameDurationMs: number
  /** Width of one frame in the sprite sheet (pixels). */
  frameWidth: number
  /** Height of one frame. */
  frameHeight: number
  /** Rendered width in logical floor pixels. */
  renderWidth: number
  /** Rendered height in logical floor pixels. */
  renderHeight: number
}

export const PET_ANIMATIONS: Record<string, PetAnimationDef> = {
  trilobite: {
    walkSpriteKey: 'pet_trilobite_walk',
    idleSpriteKey: 'pet_trilobite_idle',
    walkFrames: 4,
    idleFrames: 2,
    frameDurationMs: 150,
    frameWidth: 64,
    frameHeight: 64,
    renderWidth: 48,
    renderHeight: 48,
  },
  mammoth: {
    walkSpriteKey: 'pet_mammoth_walk',
    idleSpriteKey: 'pet_mammoth_idle',
    walkFrames: 4,
    idleFrames: 2,
    frameDurationMs: 200,
    frameWidth: 96,
    frameHeight: 96,
    renderWidth: 72,
    renderHeight: 72,
  },
  // ... add for each revivable species in src/data/fossils.ts
}
```

#### Step 2: Create `src/ui/components/PetSprite.svelte`

This component uses `requestAnimationFrame` to advance a position X between `minX` and `maxX` at `WALK_SPEED_PX_PER_SEC = 40`. When X reaches a boundary, the pet reverses direction (flip sprite horizontally with `ctx.scale(-1, 1)`). Every 3 seconds of not reversing, there is a 30% chance the pet pauses for 1.5 seconds and plays the idle animation.

State:
- `petX: number` — current X position in logical floor pixels (starts at 200)
- `petDir: 1 | -1` — movement direction (+1 = right, -1 = left)
- `isIdle: boolean` — currently playing idle animation
- `frameIndex: number` — current animation frame
- `lastFrameTime: number` — timestamp of last frame advance

Drawing: use `ctx.drawImage(spriteSheet, frameIndex * frameWidth, 0, frameWidth, frameHeight, petX, petY, renderWidth, renderHeight)` where `petY = floorBaseRow * FLOOR_TILE_SIZE - renderHeight`.

Props:
```typescript
interface Props {
  speciesId: string  // key into PET_ANIMATIONS
  spriteUrls: Record<string, string>
  /** Left boundary in logical floor pixels. */
  minX: number
  /** Right boundary in logical floor pixels. */
  maxX: number
  /** Y coordinate of the floor surface in logical floor pixels. */
  floorY: number
  /** Called when player taps the pet. */
  onTap: () => void
  canvasCtx: CanvasRenderingContext2D
}
```

The component does NOT have its own canvas. It receives `canvasCtx` from `FloorCanvas` and draws into the shared canvas during the render loop. `FloorCanvas` calls `petSprite.draw(ctx, dt)` each frame after drawing objects.

Tap detection: `FloorCanvas` passes the tap event to pet hit detection first. If tap is within pet bounding box (petX, petY, renderWidth, renderHeight), call `onTap()` and stop propagation.

#### Step 3: Modify `FloorCanvas.svelte`

In the render loop, after drawing all objects:
```typescript
if (activeCompanionId && currentFloor.id === 'starter') {
  drawPet(ctx, dt, activeCompanionId)
}
```

Add `activeCompanion` as a prop, sourced from `$playerSave?.activeCompanion`.

#### Step 4: Add pet sprite keys to `src/game/domeManifest.ts`

```typescript
export const DOME_SPRITE_KEYS = [
  // ... existing keys ...
  'pet_trilobite_walk', 'pet_trilobite_idle',
  'pet_mammoth_walk', 'pet_mammoth_idle',
  // Add one walk + one idle key per fossil species
] as const
```

Generate the actual sprites using ComfyUI in Sub-Phase 10.9 (sprite generation).

### Acceptance Criteria
- Pet walks back and forth on the Starter Hub floor canvas
- Pet reverses direction when it hits the walk boundaries (cols 5 to 90 in grid coordinates)
- Idle animation plays after 3 seconds of no reversal (30% chance)
- Tapping the pet opens the Zoo panel via `onZoo()` callback
- Pet does not render on floors other than `starter`
- If `activeCompanion` is null, no pet is rendered (no error)
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.4.js and run: node /tmp/ss-10.4.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  // Wait 3 seconds to observe pet walking
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-10.4-pet-walking.png' })
  // Wait another 3 seconds to see if pet has moved
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-10.4-pet-moved.png' })
  console.log('Check screenshots: pet should be in different positions')
  await browser.close()
})()
```

---

## Sub-Phase 10.5: Progressive Hub Unlocking

### What
Implement the unlock flow for each floor beyond the Starter Hub. New floors appear as a locked silhouette above the current top floor. When requirements are met, a "UNLOCK" banner appears on the silhouette. Tapping it opens an unlock confirmation panel. On confirm, dust is spent, the floor is added to `hubState.unlockedFloorIds`, and GAIA delivers an unlock celebration dialogue.

### Where
- **New file**: `src/ui/components/LockedFloorPreview.svelte` — greyed-out preview shown above the current top floor
- **Modified**: `src/ui/components/HubView.svelte` — show `LockedFloorPreview` for the next locked floor
- **Modified**: `src/game/GameManager.ts` — add `unlockFloor(floorId)` method
- **Modified**: `src/services/saveService.ts` — add `unlockFloor()` mutation

### How

#### Step 1: Add `unlockFloor()` to `src/game/GameManager.ts`

```typescript
/**
 * Unlocks a hub floor by spending resources if requirements are met.
 * Returns true on success.
 */
unlockFloor(floorId: string): boolean {
  const save = get(playerSave)
  if (!save) return false
  const floor = getDefaultHubStack().floors.find(f => f.id === floorId)
  if (!floor || !floor.unlockRequirements) return false
  const req = floor.unlockRequirements

  if (save.hubState.unlockedFloorIds.includes(floorId)) return false

  // Check prerequisites
  if (req.prerequisiteFloorIds) {
    for (const prereqId of req.prerequisiteFloorIds) {
      if (!save.hubState.unlockedFloorIds.includes(prereqId)) {
        console.warn(`unlockFloor: prerequisite ${prereqId} not unlocked`)
        return false
      }
    }
  }
  if (req.divesCompleted && save.stats.totalDivesCompleted < req.divesCompleted) return false
  if (req.factsLearned && save.learnedFacts.length < req.factsLearned) return false
  if (req.factsMastered) {
    const mastered = save.reviewStates.filter(rs => rs.repetitions >= 6).length
    if (mastered < req.factsMastered) return false
  }
  if (req.deepestLayer && save.stats.deepestLayerReached < req.deepestLayer) return false
  if (req.dustCost && save.minerals.dust < req.dustCost) return false

  // Spend dust
  if (req.dustCost) saveService.spendDust(req.dustCost)

  // Unlock
  saveService.unlockFloor(floorId)

  // GAIA celebration
  this.randomGaia(`The ${floor.name} is now online! A new chapter of your journey begins here.`)
  return true
}
```

#### Step 2: Add to `src/services/saveService.ts`

```typescript
/** Adds a floor to the player's unlocked floors list. */
unlockFloor(floorId: string): void {
  playerSave.update(s => {
    if (!s) return s
    if (!s.hubState.unlockedFloorIds.includes(floorId)) {
      s.hubState.unlockedFloorIds = [...s.hubState.unlockedFloorIds, floorId]
      s.hubState.floorTiers[floorId] = 0
    }
    return s
  })
  this.persist()
}
```

#### Step 3: Create `src/ui/components/LockedFloorPreview.svelte`

Renders a semi-transparent silhouette of the next locked floor above the current top floor. Content:

- Dark overlay (rgba(0,0,0,0.7)) on a grey placeholder canvas
- Lock icon centered (pixel art padlock sprite `obj_locked_silhouette`)
- Floor name in dim text: `"??? [Floor Name]"`
- If requirements are met (check `canUnlockFloor()`): glowing teal border + "UNLOCK AVAILABLE" banner
- If requirements not met: list unmet requirements in small text

The component fires `onUnlockRequest(floorId)` when tapped, which opens an unlock confirmation dialog in `HubView`.

#### Step 4: Unlock confirmation dialog in `HubView.svelte`

A modal overlay (not a slide-up panel) with:
- Floor name and description
- Cost breakdown (dust, premium materials, learning requirements)
- "Confirm Unlock" button (calls `gameManager.unlockFloor(floorId)`)
- "Cancel" button

After successful unlock, `HubView` re-derives `unlockedFloors` from `$playerSave.hubState.unlockedFloorIds`, which reactively adds the new floor to the scroll stack.

#### Step 5: Tutorial hook in `main.ts`

After the first materializer use (GameManager emits `'materializer-used'`), check if farm unlock requirements are now met. If yes, show a GAIA toast: *"New area unlocked above! Tap the floor above you to expand your hub."*

### Acceptance Criteria
- Starter Hub is always visible (never locked)
- Locked floors show silhouette with requirements list
- Tapping a ready-to-unlock floor opens confirmation with correct dust cost
- After confirm, new floor appears in scroll stack within 1 animation frame
- `hubState.unlockedFloorIds` is persisted to localStorage
- GAIA delivers unlock dialogue on each new floor
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.5.js and run: node /tmp/ss-10.5.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  // Scroll to see locked floor preview
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/ss-10.5-locked-preview.png' })
  console.log('Check screenshot: should see locked floor silhouette above starter hub')
  await browser.close()
})()
```

---

## Sub-Phase 10.6: Knowledge Tree as Physical Dome Object

### What
The Knowledge Tree object on the Starter Hub displays one of 8 distinct pixel art sprites based on `masteredFactsCount`. Clicking it navigates to the existing `KnowledgeTreeView` screen. The sprite changes automatically as the player masters more facts without requiring any game restart. Generate 8 sprites via ComfyUI.

### Where
- **Modified**: `src/game/domeManifest.ts` — add 8 knowledge tree stage sprite keys
- **Modified**: `src/ui/components/FloorCanvas.svelte` — dynamically pick tree sprite key from mastered count
- **New file**: `src/data/knowledgeTreeStages.ts` — stage definitions (mastery thresholds + sprite keys)
- **Modified**: `src/data/hubFloors.ts` — `makeStarterFloor()` uses stage-aware sprite lookup at render time

### How

#### Step 1: Create `src/data/knowledgeTreeStages.ts`

```typescript
export interface TreeStage {
  /** Stage index 0-7. */
  stage: number
  /** Display name for this stage. */
  label: string
  /** Minimum mastered facts to reach this stage. */
  minMastered: number
  /** Sprite key for the Knowledge Tree object at this stage. */
  spriteKey: string
  /** ComfyUI prompt used to generate this sprite (for regeneration reference). */
  generationPrompt: string
}

/**
 * 8 growth stages for the Knowledge Tree physical dome object.
 * Stage determined by facts with SM-2 repetitions >= 6 (mastered).
 * DD-V2-124.
 */
export const TREE_STAGES: TreeStage[] = [
  {
    stage: 0, label: 'Sapling',
    minMastered: 0,
    spriteKey: 'obj_knowledge_tree_stage0',
    generationPrompt: 'pixel art tiny sapling seedling in small clay pot, two small leaves, bright green, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 1, label: 'Seedling',
    minMastered: 11,
    spriteKey: 'obj_knowledge_tree_stage1',
    generationPrompt: 'pixel art small seedling tree 20cm tall, 4-6 leaves, glowing faintly, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 2, label: 'Young Tree',
    minMastered: 51,
    spriteKey: 'obj_knowledge_tree_stage2',
    generationPrompt: 'pixel art young tree 1 meter tall with many small bright leaves, magical glow, trunk visible, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 3, label: 'Growing Tree',
    minMastered: 151,
    spriteKey: 'obj_knowledge_tree_stage3',
    generationPrompt: 'pixel art medium tree 2 meters tall with dense canopy, golden leaves mixed with green, magical bioluminescent glow, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 4, label: 'Mature Tree',
    minMastered: 401,
    spriteKey: 'obj_knowledge_tree_stage4',
    generationPrompt: 'pixel art mature tall tree 4 meters, thick trunk, dense magical canopy with glowing runes on bark, golden and emerald leaves, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 5, label: 'Great Tree',
    minMastered: 1000,
    spriteKey: 'obj_knowledge_tree_stage5',
    generationPrompt: 'pixel art great ancient tree filling frame, massive trunk with glowing carvings, floating leaves of all colors, mystical aura, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 6, label: 'Ancient Tree',
    minMastered: 2500,
    spriteKey: 'obj_knowledge_tree_stage6',
    generationPrompt: 'pixel art enormous ancient sacred tree, roots spread wide, galaxy of glowing knowledge orbs in canopy, cosmic energy, isometric game asset, single object centered, white background, 256x256',
  },
  {
    stage: 7, label: 'World Tree',
    minMastered: 5000,
    spriteKey: 'obj_knowledge_tree_stage7',
    generationPrompt: 'pixel art world tree Yggdrasil, infinite canopy reaching top of frame, branches hold entire worlds as glowing spheres, cosmic deep background, isometric game asset, single object centered, white background, 256x256',
  },
]

/**
 * Returns the current tree stage definition for a given mastered fact count.
 */
export function getTreeStage(masteredCount: number): TreeStage {
  // Find highest stage whose threshold is met
  let best = TREE_STAGES[0]
  for (const stage of TREE_STAGES) {
    if (masteredCount >= stage.minMastered) best = stage
  }
  return best
}
```

#### Step 2: Modify `src/game/domeManifest.ts`

Add all 8 stage sprite keys:

```typescript
export const DOME_SPRITE_KEYS = [
  // ... existing keys ...
  'obj_knowledge_tree_stage0',
  'obj_knowledge_tree_stage1',
  'obj_knowledge_tree_stage2',
  'obj_knowledge_tree_stage3',
  'obj_knowledge_tree_stage4',
  'obj_knowledge_tree_stage5',
  'obj_knowledge_tree_stage6',
  'obj_knowledge_tree_stage7',
] as const
```

Also add new floor object sprite keys needed for all floors defined in 10.1:
```typescript
  'obj_seed_station', 'obj_premium_workbench', 'obj_upgrade_anvil', 'obj_blueprint_board',
  'obj_feeding_station', 'obj_achievement_wall', 'obj_cosmetics_vendor', 'obj_wallpaper_kiosk',
  'obj_knowledge_store', 'obj_data_disc_reader', 'obj_experiment_bench', 'obj_gaia_report',
  'obj_study_alcove', 'obj_telescope', 'obj_streak_shrine', 'obj_star_map',
  'obj_fossil_display', 'obj_fossil_tank', 'obj_seed_station',
  'wood_planks', 'crystal_floor', 'stone_wall', 'crystal_wall',
```

#### Step 3: Modify `src/ui/components/FloorCanvas.svelte`

Add a `masteredCount` prop. In the object rendering loop, when drawing the `knowledge_tree` object, replace `obj.spriteKey` with the dynamic stage sprite:

```typescript
function getEffectiveSpriteKey(obj: FloorObject): string {
  if (obj.id === 'knowledge_tree') {
    return getTreeStage(masteredCount).spriteKey
  }
  return obj.spriteKey
}
```

In `HubView.svelte`, compute `masteredCount` as a derived value:
```typescript
const masteredCount = $derived(
  ($playerSave?.reviewStates ?? []).filter(rs => rs.repetitions >= 6).length
)
```

Pass it down to `FloorCanvas` as a prop.

#### Step 4: Sprite generation

Generate 8 sprites for stages 0-7 using ComfyUI. Each sprite:
- Input: prompt from `TREE_STAGES[i].generationPrompt`
- Output: 1024×1024 PNG
- Downscale to 256×256 (hi-res) and 32×32 (lo-res)
- Remove background with rembg
- Save to `src/assets/sprites-hires/dome/obj_knowledge_tree_stage{i}.png` and `src/assets/sprites/dome/obj_knowledge_tree_stage{i}.png`
- Visually inspect each sprite with the Read tool before saving

### Acceptance Criteria
- `getTreeStage(0)` returns stage 0 (Sapling)
- `getTreeStage(11)` returns stage 1 (Seedling)
- `getTreeStage(5000)` returns stage 7 (World Tree)
- Starter Hub Knowledge Tree renders the correct stage sprite for the player's current mastered count
- Sprite changes without page reload when mastered count crosses a threshold (Svelte reactivity)
- All 8 sprite files exist in `src/assets/sprites/dome/` and `src/assets/sprites-hires/dome/`
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.6.js and run: node /tmp/ss-10.6.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss-10.6-tree-stage0.png' })
  // Visually inspect: Knowledge Tree should show sapling (small, 2 leaves)
  console.log('Check /tmp/ss-10.6-tree-stage0.png: Knowledge Tree should be a sapling')
  await browser.close()
})()
```

---

## Sub-Phase 10.7: Daily Briefing Screen

### What
Implement a consolidated morning-briefing screen that GAIA presents on the first dome visit each day (DD-V2-139). The screen shows: streak status, overdue review count, daily deals preview (item count), farm harvest summary (ready crops), and a prominent "Begin Dive" button. A "Skip Briefing" link bypasses it immediately. The briefing is skippable and never shown more than once per calendar day.

### Where
- **New file**: `src/ui/components/DailyBriefing.svelte` — the briefing screen component
- **Modified**: `src/ui/components/HubView.svelte` — check `shouldShowBriefing()` on mount, conditionally render `DailyBriefing` before the floor stack
- **Modified**: `src/services/saveService.ts` — add `markBriefingShown()` mutation
- **Modified**: `src/ui/stores/gameState.ts` — add `'dailyBriefing'` to `Screen` type (or handle it as a local overlay)

### How

#### Step 1: `shouldShowBriefing()` utility in `src/services/saveService.ts`

```typescript
/** Returns true if the daily briefing has not yet been shown today. */
shouldShowBriefing(save: PlayerSave): boolean {
  const today = new Date().toISOString().split('T')[0]
  return save.hubState.lastBriefingDate !== today
}

/** Marks the briefing as shown for today. */
markBriefingShown(): void {
  const today = new Date().toISOString().split('T')[0]
  playerSave.update(s => {
    if (!s) return s
    s.hubState.lastBriefingDate = today
    return s
  })
  this.persist()
}
```

#### Step 2: Create `src/ui/components/DailyBriefing.svelte`

Full-screen overlay (z-index above `HubView`) with a dark semi-transparent background. GAIA avatar (happy expression) in the top-right corner. Content sections:

**Streak Section**:
```
[flame icon]  Day {currentStreak} Streak
{#if streakProtected}  "Protected today ✓"
{#else if currentStreak > 0}  "Keep it alive — dive today!"
{#else}  "Start a new streak today"
```

**Reviews Due Section**:
```
[book icon]  {overdueCount} facts overdue for review
[if overdueCount === 0] "All caught up! Great work."
[if overdueCount > 0]   "Review them to strengthen memory."
```

Compute `overdueCount`: count `reviewStates` where `nextReviewAt <= Date.now()` and `repetitions >= 1`.

**Daily Deals Section**:
```
[market icon]  {dealsAvailableCount} daily deals available
[if purchasedDeals.length === 0]  "Fresh deals today — check the Market!"
```

**Farm Section** (only if farm floor is unlocked):
```
[plant icon]  {readyHarvestCount} crops ready to harvest
[if readyHarvestCount > 0]  "Collect before they wither!"
```

**GAIA Commentary** (one of 6 hardcoded strings chosen by `streak % 6`):
```
0: "Good morning, Explorer. The underground awaits."
1: "Another day, another layer to uncover."
2: "Your knowledge grows with every dive. Impressive."
3: "The facts won't learn themselves. Shall we begin?"
4: "I've been analyzing your progress. You're doing well."
5: "Ready to add to your collection of facts? Let's go."
```

**Buttons**:
- `<button class="begin-dive-btn" onclick={handleBeginDive}>Begin Dive</button>` — styled teal, min 48×48px, calls `onDive()` and dismisses
- `<button class="skip-btn" onclick={handleSkip}>Skip Briefing</button>` — small text link style, dismisses without diving

```typescript
interface Props {
  onDive: () => void
  onDismiss: () => void
}
```

Both `handleBeginDive` and `handleSkip` call `saveService.markBriefingShown()` first, then the appropriate action.

#### Step 3: Integrate into `HubView.svelte`

```svelte
{#if showBriefing}
  <DailyBriefing
    onDive={() => { showBriefing = false; onDive() }}
    onDismiss={() => { showBriefing = false }}
  />
{/if}
```

`showBriefing` is computed on mount:
```typescript
let showBriefing = $state(false)

$effect(() => {
  const save = $playerSave
  if (save && saveService.shouldShowBriefing(save)) {
    showBriefing = true
  }
})
```

Use `untrack()` if reading and writing derived state to avoid effect_update_depth_exceeded (MEMORY.md pattern).

### Acceptance Criteria
- On first page load of the day, `DailyBriefing` overlay appears before the hub floor
- Correct streak count, overdue review count, and deals count are displayed
- "Begin Dive" button calls `onDive()` and persists `lastBriefingDate`
- "Skip Briefing" dismisses the overlay without diving
- Second load on the same day: briefing does NOT appear (date check passes)
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.7.js and run: node /tmp/ss-10.7.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })

  // Clear lastBriefingDate so briefing shows
  await page.evaluateOnNewDocument(() => {
    const key = 'terra-gacha-save'
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const save = JSON.parse(raw)
        if (save.hubState) save.hubState.lastBriefingDate = null
        localStorage.setItem(key, JSON.stringify(save))
      }
    } catch {}
  })

  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Begin Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-10.7-briefing.png' })
  console.log('PASS: Daily briefing visible with Begin Dive button')

  await page.click('button:has-text("Skip Briefing")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-10.7-skipped.png' })
  console.log('Check: briefing dismissed, hub floor visible')

  await browser.close()
})()
```

---

## Sub-Phase 10.8: GAIA's Report Screen

### What
Build the player-facing analytics panel in the Archive floor (DD-V2-176). Tapping the "G.A.I.A. Report" terminal opens a full-screen analytics view with: total facts learned, mastery breakdown by category (with radar/spider chart), review accuracy rate, average session, dive depth progression, and a 30-day activity sparkline. A "Share Progress" button generates a summary card image. GAIA provides a weekly written summary paragraph.

### Where
- **New file**: `src/ui/components/GaiaReport.svelte` — the full-screen analytics view
- **New file**: `src/ui/components/RadarChart.svelte` — pure Canvas spider/radar chart component
- **New file**: `src/ui/components/SparklineChart.svelte` — 30-day activity sparkline
- **Modified**: `src/ui/stores/gameState.ts` — add `'gaiaReport'` to `Screen` type
- **Modified**: `src/App.svelte` — route `'gaiaReport'` screen to `<GaiaReport />`

### How

#### Step 1: Add `'gaiaReport'` to `Screen` type in `src/ui/stores/gameState.ts`

```typescript
export type Screen =
  | 'mainMenu'
  | 'base'
  // ... existing screens ...
  | 'gaiaReport'
```

#### Step 2: Create `src/ui/components/RadarChart.svelte`

Pure canvas spider chart. Props:
```typescript
interface Props {
  /** Category labels (max 8 recommended). */
  labels: string[]
  /** Values 0.0-1.0 per label (normalized to max mastered in that category). */
  values: number[]
  /** Canvas width in CSS px. */
  size: number
}
```

Drawing algorithm (in a `<canvas>` element, drawn with 2D context):
1. Center point: `(size/2, size/2)`. Radius: `size * 0.4`.
2. Draw 5 concentric polygons (spiderweb) at 20%/40%/60%/80%/100% radius in dim grey (`rgba(255,255,255,0.15)`).
3. Draw axis lines from center to each vertex (one per label).
4. Draw label text at vertex positions (offset away from center by label margin).
5. Compute data polygon vertices: `r = values[i] * maxRadius` at each axis angle.
6. Fill data polygon with `rgba(78, 204, 163, 0.3)` (teal transparent).
7. Stroke data polygon with `#4ecca3` at 2px.
8. Draw small dots at each data vertex.

#### Step 3: Create `src/ui/components/SparklineChart.svelte`

Props:
```typescript
interface Props {
  /** Daily activity count for last 30 days. Index 0 = 30 days ago, index 29 = today. */
  dailyActivity: number[]
  /** Width in CSS px. */
  width: number
  /** Height in CSS px. */
  height: number
}
```

Draw a filled area chart: normalize values to 0-1, draw polyline + fill to baseline, color `#4ecca3`. Mark today (rightmost bar) brighter. Draw thin horizontal baseline.

#### Step 4: Create `src/ui/components/GaiaReport.svelte`

Full-screen view (same layout as Settings.svelte — back button top-left, content scrollable).

**Data computation** (all derived from `$playerSave`):

```typescript
// Category breakdown (requires facts DB)
const categoryBreakdown = $derived(() => {
  const categories = ['Biology', 'History', 'Geology', 'Language', 'Physics', 'Culture']
  return categories.map(cat => {
    const catFacts = factsDB.getByCategory(cat)
    const learnedInCat = catFacts.filter(f => save.learnedFacts.includes(f.id)).length
    const masteredInCat = catFacts.filter(f => {
      const rs = save.reviewStates.find(r => r.factId === f.id)
      return rs && rs.repetitions >= 6
    }).length
    return { label: cat, learned: learnedInCat, mastered: masteredInCat, total: catFacts.length }
  })
})

const totalLearned = $derived(save.learnedFacts.length)
const totalMastered = $derived(save.reviewStates.filter(rs => rs.repetitions >= 6).length)
const accuracyRate = $derived(
  save.stats.totalQuizCorrect + save.stats.totalQuizWrong > 0
    ? Math.round(100 * save.stats.totalQuizCorrect / (save.stats.totalQuizCorrect + save.stats.totalQuizWrong))
    : 0
)
const deepestLayer = $derived(save.stats.deepestLayerReached)
const totalDives = $derived(save.stats.totalDivesCompleted)
```

**Layout** (single scrollable column, `font-family: 'Courier New', monospace`):

Section 1 — Header:
```
G.A.I.A. LEARNING REPORT
Explorer since: [formattedDate from save.createdAt]
```

Section 2 — Summary stats (2×3 grid of stat boxes):
```
[totalLearned] Facts Learned   [totalMastered] Facts Mastered   [accuracyRate]% Accuracy
[totalDives] Total Dives        [deepestLayer] Max Layer          [streak] Day Streak
```

Section 3 — Radar Chart:
- `<RadarChart labels={categoryBreakdown.map(c => c.label)} values={normalized} size={280} />`
- Below chart: "Relative mastery by category"

Section 4 — 30-Day Activity:
- `<SparklineChart dailyActivity={last30Days} width={340} height={60} />`
- `last30Days`: array of facts-learned-per-day for past 30 days; derive from `reviewStates` `lastReviewed` dates grouped by day.

Section 5 — GAIA Weekly Summary:
A hardcoded template filled with live values:
```typescript
function generateWeeklySummary(save: PlayerSave): string {
  const thisWeekLearned = /* count facts with reviewState.reps >= 1 and lastReviewed within 7 days */ 0
  const thisWeekMastered = /* count facts that crossed reps=6 within 7 days */ 0
  return `This week you learned ${thisWeekLearned} new fact${thisWeekLearned !== 1 ? 's' : ''} ` +
    `and mastered ${thisWeekMastered}. ` +
    (save.stats.deepestLayerReached >= 10
      ? `You've reached the mid-depths — the rarest minerals await below.`
      : `Keep diving to unlock deeper biomes and rarer relics.`)
}
```

Section 6 — Share Button:
```svelte
<button class="share-btn" onclick={handleShare}>Share My Progress</button>
```

`handleShare()` implementation:
1. Create an offscreen `<canvas>` 600×400
2. Draw a simple card: dark background, GAIA logo text, the 6 summary stats, accuracy bar, category dots
3. Call `canvas.toDataURL('image/png')` to get a data URL
4. Create a temporary `<a href={dataUrl} download="terra-gacha-report.png">` and programmatically click it
5. On mobile where download is not supported, show a `<img src={dataUrl}>` in a modal for screenshot

#### Step 5: Route in `src/App.svelte`

```svelte
{:else if $currentScreen === 'gaiaReport'}
  <GaiaReport
    onBack={() => currentScreen.set('base')}
    facts={$cachedFacts}
  />
```

### Acceptance Criteria
- Tapping "G.A.I.A. Report" terminal on Archive floor navigates to `gaiaReport` screen
- Radar chart renders with 6 category axes and correct relative values
- Sparkline shows 30 bars (days), with today at the rightmost position
- `totalLearned`, `totalMastered`, `accuracyRate`, `totalDives`, `deepestLayer`, streak all display correct values from `$playerSave`
- "Share My Progress" generates and downloads/shows a PNG card
- Back button returns to `'base'` screen
- `npm run typecheck` passes

### Playwright Test

```js
// Write to /tmp/ss-10.8.js and run: node /tmp/ss-10.8.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)

  // Navigate to gaiaReport screen directly via store (workaround for navigation)
  await page.evaluate(() => {
    // Attempt to dispatch custom event to change screen
    window.dispatchEvent(new CustomEvent('dev:set-screen', { detail: { screen: 'gaiaReport' } }))
  })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-10.8-gaia-report.png' })
  console.log('Check /tmp/ss-10.8-gaia-report.png: should show GAIA Report analytics screen')

  // Check for radar chart canvas
  const canvases = await page.$$('canvas')
  console.log(`Found ${canvases.length} canvas elements`)

  await browser.close()
})()
```

---

## Sub-Phase 10.9: Hub Rendering Overhaul + Sprite Generation

### What
Generate all missing sprites for Phase 10 via ComfyUI. Replace `DomeCanvas.svelte` and `domeLayout.ts` with the new `FloorCanvas.svelte` and `hubLayout.ts` system. Ensure every floor has distinct visual ambiance (lighting glow color, ambient particles). Delete the legacy dome files after verifying the new system passes all tests.

### Where
- **Deleted**: `src/ui/components/DomeCanvas.svelte` (after verifying `FloorCanvas` covers all functionality)
- **Deleted**: `src/data/domeLayout.ts` (after verifying all imports updated)
- **Modified**: All files that imported from `domeLayout.ts` — update to import from `hubLayout.ts`
- **Modified**: `src/game/domeManifest.ts` — add all new sprite keys, expand glob patterns if needed
- **New sprites**: All objects and tiles defined in 10.1-10.6 that do not yet have sprite files

### Sprite Generation Checklist

All sprites generated at 1024×1024 via ComfyUI, downscaled, rembg-processed, visually inspected.

**Floor tile sprites (seamless textures)** — save to `src/assets/sprites/dome/` and `-hires/dome/`:
- `wood_planks.png`: "seamless tileable wooden plank texture, warm brown, pixel art, top-down view"
- `crystal_floor.png`: "seamless tileable bioluminescent crystal tile floor, teal glow, pixel art"
- `stone_wall.png`: "seamless tileable dark stone wall texture, sci-fi underground, pixel art"
- `crystal_wall.png`: "seamless tileable crystalline wall texture, blue-purple glow, pixel art"

**New object sprites** (single centered object, white background, remove bg with rembg):
- `obj_seed_station.png`: "pixel art seed dispenser station, small sci-fi machine, green accent lights, isometric"
- `obj_premium_workbench.png`: "pixel art advanced fabrication bench, glowing blue holograms, heavy machine, isometric"
- `obj_upgrade_anvil.png`: "pixel art magical upgrade anvil, runes glowing orange, solid metal, isometric"
- `obj_blueprint_board.png`: "pixel art blueprint board with glowing schematics, wall-mounted, sci-fi, isometric"
- `obj_feeding_station.png`: "pixel art animal feeding station with bowls, organic wood and metal, isometric"
- `obj_achievement_wall.png`: "pixel art trophy wall with plaques and medals mounted, isometric game asset"
- `obj_cosmetics_vendor.png`: "pixel art cosmetics shop counter with colorful display, isometric game asset"
- `obj_wallpaper_kiosk.png`: "pixel art wallpaper sample kiosk with miniature panels on display, isometric"
- `obj_data_disc_reader.png`: "pixel art data disc reading machine, slot on front, blinking lights, isometric"
- `obj_experiment_bench.png`: "pixel art science experiment bench with beakers and crystal instruments, isometric"
- `obj_gaia_report.png`: "pixel art holographic analytics terminal, rotating data graphs, sci-fi, isometric"
- `obj_study_alcove.png`: "pixel art cozy study alcove with small desk and glowing screen, isometric"
- `obj_telescope.png`: "pixel art large astronomical telescope pointing at glass ceiling, sci-fi observatory, isometric"
- `obj_streak_shrine.png`: "pixel art flame shrine altar with fire burning, streak symbol engraved, isometric"
- `obj_star_map.png`: "pixel art star map wall display showing constellation chart, glowing lines, isometric"
- `obj_fossil_display.png`: "pixel art museum fossil display stand with specimen under glass dome, isometric"
- `obj_fossil_tank.png`: "pixel art large glass vivarium habitat tank for creatures, sci-fi, isometric"
- `obj_knowledge_tree_stage0` through `obj_knowledge_tree_stage7`: see prompts in Sub-Phase 10.6

**Pet walk/idle sprite sheets** (4-frame walk cycle, 2-frame idle, frames side-by-side on one PNG):
- `pet_trilobite_walk.png`: "pixel art trilobite fossil creature 4-frame walk cycle sprite sheet, horizontal strip, transparent background, cartoon cute"
- `pet_trilobite_idle.png`: "pixel art trilobite 2-frame idle animation sprite sheet, horizontal strip, transparent background, cute"
- `pet_mammoth_walk.png`, `pet_mammoth_idle.png`: same pattern for mammoth

### Ambient Animation per Floor Theme

Add ambient particle system to `FloorCanvas.svelte`. Each `HubFloor.theme` maps to a particle config:

```typescript
interface AmbientConfig {
  particleColor: string  // CSS rgba
  particleCount: number
  glowColor: string       // applied as canvas shadowColor during object draw
  glowBlur: number        // ctx.shadowBlur value
}

const THEME_AMBIENT: Record<HubFloor['theme'], AmbientConfig> = {
  'sci-fi':       { particleColor: 'rgba(78,204,163,0.15)', particleCount: 12, glowColor: '#4ecca3', glowBlur: 8 },
  'organic':      { particleColor: 'rgba(144,238,144,0.15)', particleCount: 18, glowColor: '#90ee90', glowBlur: 6 },
  'crystal':      { particleColor: 'rgba(100,149,237,0.2)', particleCount: 20, glowColor: '#6495ed', glowBlur: 12 },
  'observatory':  { particleColor: 'rgba(255,255,200,0.25)', particleCount: 35, glowColor: '#ffffc8', glowBlur: 4 },
  'archive':      { particleColor: 'rgba(200,180,120,0.15)', particleCount: 8, glowColor: '#c8b478', glowBlur: 6 },
  'market':       { particleColor: 'rgba(255,160,80,0.15)', particleCount: 14, glowColor: '#ffa050', glowBlur: 8 },
  'industrial':   { particleColor: 'rgba(255,100,50,0.1)', particleCount: 10, glowColor: '#ff6432', glowBlur: 10 },
}
```

Particles float upward (same mote algorithm as `DomeCanvas` but smaller, using `AmbientConfig` values). Glow applied to interactive objects: `ctx.shadowColor = glowColor; ctx.shadowBlur = glowBlur` before drawing each interactive object sprite.

### Legacy File Cleanup

After all tests pass:

1. Search for all imports of `domeLayout.ts`: `grep -r "from.*domeLayout" src/`
2. Update each to import from `hubLayout.ts` equivalents
3. Search for all uses of `DomeCanvas`: `grep -r "DomeCanvas" src/`
4. Confirm all usages replaced with `FloorCanvas` or `HubView`
5. Delete `src/ui/components/DomeCanvas.svelte`
6. Delete `src/data/domeLayout.ts`
7. Run `npm run typecheck` — must pass with zero errors
8. Run `npm run build` — must succeed

### Acceptance Criteria
- All sprite files listed in the checklist exist and pass visual inspection (correct subject, transparent background, pixel art style)
- `FloorCanvas` ambient particles render per-theme with correct color
- Interactive objects have glow effect matching their floor theme
- `npm run typecheck` passes with zero errors after deleting legacy files
- `npm run build` succeeds
- Screenshots show all 9 floors rendering correctly (see Playwright test below)

### Playwright Test

```js
// Write to /tmp/ss-10.9.js and run: node /tmp/ss-10.9.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)

  // Screenshot each floor by scrolling up through unlocked floors
  await page.screenshot({ path: '/tmp/ss-10.9-floor0-starter.png' })

  for (let i = 1; i <= 4; i++) {
    await page.evaluate(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
    })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `/tmp/ss-10.9-floor${i}.png` })
  }

  // Check console for errors
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.waitForTimeout(1000)

  if (errors.length > 0) {
    console.error('FAIL: Runtime errors:', errors)
    process.exit(1)
  }
  console.log('PASS: All floors rendered without console errors')
  console.log('Check screenshots /tmp/ss-10.9-floor0 through floor4')
  await browser.close()
})()
```

---

## Verification Gate

Run these checks in order before marking Phase 10 complete:

- [ ] `npm run typecheck` — zero errors across all modified and new files
- [ ] `npm run build` — production build succeeds without warnings
- [ ] Multi-floor navigation: scroll wheel and touch swipe change floors; floor indicator updates; CSS transition plays at 400ms
- [ ] Starter Hub renders with: dive hatch, GAIA terminal, Knowledge Tree (correct stage sprite), materializer, streak board
- [ ] Pet animation: companion walks left-right on Starter Hub, tapping it opens Zoo panel
- [ ] Knowledge Tree stages: `getTreeStage(0)` = stage 0, `getTreeStage(11)` = stage 1, sprite changes reactively as mastered count changes
- [ ] Hub upgrade: spending dust via `upgradeFloor()` correctly decrements dust, advances tier, makes tier-gated objects visible
- [ ] Floor unlock: locking/unlocking confirms via dialog, persists to `hubState.unlockedFloorIds`, GAIA speaks on unlock
- [ ] Daily briefing: appears on first visit each day, shows correct streak/review/deals counts, "Begin Dive" and "Skip" work
- [ ] GAIA's Report: radar chart renders, sparkline has 30 bars, stats match `$playerSave`, "Share Progress" generates PNG
- [ ] Ambient particles: each floor theme has distinct particle color and object glow
- [ ] All Phase 10 sprites exist (visual inspection passed, no sprite sheets, no opaque backgrounds)
- [ ] Legacy `DomeCanvas.svelte` and `domeLayout.ts` deleted; no import errors

---

## Files Affected

### New Files
- `src/data/hubLayout.ts` — all hub types, enums, constants, `HubSaveState`, `defaultHubSaveState()`
- `src/data/hubFloors.ts` — 9 floor factory functions, `getDefaultHubStack()`
- `src/data/hubUpgrades.ts` — tier definitions per floor, `getUpgradeDef()`, `canUpgrade()`
- `src/data/knowledgeTreeStages.ts` — 8 `TreeStage` definitions, `getTreeStage()`
- `src/data/petAnimations.ts` — `PetAnimationDef` per species, `PET_ANIMATIONS` map
- `src/ui/components/HubView.svelte` — top-level multi-floor hub view (replaces `DomeView.svelte`)
- `src/ui/components/FloorCanvas.svelte` — single-floor tile/object renderer with animation
- `src/ui/components/FloorIndicator.svelte` — right-edge vertical floor position indicator
- `src/ui/components/LockedFloorPreview.svelte` — locked floor silhouette above current top
- `src/ui/components/FloorUpgradePanel.svelte` — tier upgrade purchase UI
- `src/ui/components/WallpaperShop.svelte` — wallpaper browse and apply UI
- `src/ui/components/PetSprite.svelte` — animated companion draw logic
- `src/ui/components/DailyBriefing.svelte` — consolidated first-login briefing screen
- `src/ui/components/GaiaReport.svelte` — full-screen learning analytics
- `src/ui/components/RadarChart.svelte` — pure canvas spider/radar chart
- `src/ui/components/SparklineChart.svelte` — 30-day activity sparkline canvas chart

### Modified Files
- `src/data/types.ts` — add `hubState: HubSaveState` to `PlayerSave`
- `src/services/saveService.ts` — `defaultSave()` adds `hubState`, migration guard, new mutations: `setFloorTier`, `setFloorWallpaper`, `unlockFloor`, `shouldShowBriefing`, `markBriefingShown`
- `src/game/GameManager.ts` — add `upgradeFloor()`, `unlockFloor()`, `applyWallpaper()` methods
- `src/game/domeManifest.ts` — add all new sprite keys (8 tree stages, pet sprites, new objects, new tiles)
- `src/ui/stores/gameState.ts` — add `currentFloorIndex` writable store, add `'gaiaReport'` to `Screen` type
- `src/App.svelte` — replace `<DomeView>` with `<HubView>`, add `gaiaReport` screen route
- `src/assets/sprites/dome/` — all new PNG sprites (lo-res 32px)
- `src/assets/sprites-hires/dome/` — all new PNG sprites (hi-res 256px)

### Deleted Files (Sub-Phase 10.9 only, after tests pass)
- `src/ui/components/DomeCanvas.svelte`

---

## Sub-Phase 10.10: DomeScene Migration (DD-V2-188)

### What

Replace `DomeCanvas.svelte` (a Svelte-managed offscreen canvas component) with a dedicated Phaser scene (`DomeScene`) that runs inside the same `Phaser.Game` instance already used by `MineScene`. Svelte retains responsibility for all DOM overlays — resource bars, slide-up panels, modal popups — layered on top of the Phaser canvas via CSS `position: absolute`. The Phaser scene manager switches between `DomeScene` and `MineScene` without destroying the Game instance, preserving texture cache and audio context across scene transitions.

**Why Phaser for the dome?**
- Sprite batching via Phaser's WebGL renderer eliminates the per-frame `drawImage` loop over 9,216 tiles (192×48 per floor)
- Built-in animation state machines replace manual `requestAnimationFrame` frame counters for the pet, GAIA, and object sprites
- Phaser tweens handle floor-transition slide animations with easing curves rather than raw CSS transitions
- Physics can be used for pet pathfinding (Arcade Physics simple AABB is sufficient; no Box2D needed)
- Texture cache shared with `MineScene` avoids double-loading block sprites that appear in both scenes

### Where

- **New file**: `src/game/scenes/DomeScene.ts` — Phaser scene extending `Phaser.Scene`, key `'DomeScene'`
- **New file**: `src/game/DomeTileRenderer.ts` — utility class that builds a `Phaser.GameObjects.RenderTexture` per floor from hub tile data; called once on floor creation, cached until floor tier changes
- **New file**: `src/game/DomePetController.ts` — manages pet sprite animation state machine (idle/walk/sleep/react) and Arcade Physics body for simple left-right pathing
- **Modified**: `src/game/PhaserGame.ts` (or equivalent game bootstrap) — add `DomeScene` to the `scene` array alongside `BootScene` and `MineScene`
- **Modified**: `src/ui/stores/gameState.ts` — add `'dome'` as a valid value for `currentPhaserScene` store (if this store exists); alternatively handle via Svelte reactive statement watching `currentScreen`
- **Modified**: `src/App.svelte` — when `currentScreen === 'dome'`, launch `DomeScene` via scene manager instead of rendering `<HubView>`; Svelte overlay components remain mounted as DOM siblings
- **Modified**: `src/ui/components/HubView.svelte` — remove `<DomeCanvas>` reference; retain resource bar, panel, and popup sub-components as pure DOM overlays; wire tap events from Phaser scene via a shared event emitter
- **Deleted** (after tests pass): `src/ui/components/DomeCanvas.svelte` (if not already removed in 10.9)

### How

#### Step 1 — Create `src/game/scenes/DomeScene.ts`

```typescript
/**
 * DomeScene.ts
 *
 * Phaser scene for the multi-floor glass hub (Phase 10.10).
 * Replaces DomeCanvas.svelte as the tile/object renderer.
 * Svelte DOM overlays (resource bars, panels) remain layered above the canvas via CSS.
 *
 * Scene key: 'DomeScene'
 * Shares the same Phaser.Game instance as MineScene and BootScene.
 */
import Phaser from 'phaser'
import type { HubFloor } from '../../data/hubLayout'
import { DomeTileRenderer } from '../DomeTileRenderer'
import { DomePetController } from '../DomePetController'
import { hubEvents } from '../hubEvents'  // tiny EventEmitter for Phaser→Svelte comms

export class DomeScene extends Phaser.Scene {
  private tileRenderer!: DomeTileRenderer
  private petController!: DomePetController
  private floorIndex = 0
  private floorTextures: Map<number, Phaser.GameObjects.RenderTexture> = new Map()

  constructor() {
    super({ key: 'DomeScene' })
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height)
    this.tileRenderer = new DomeTileRenderer(this)
    this.petController = new DomePetController(this)
    this.renderCurrentFloor()
    this.setupInputHandlers()
  }

  /** Called by Svelte when the player swipes to a new floor. */
  transitionToFloor(index: number): void {
    const dir = index > this.floorIndex ? 1 : -1
    this.floorIndex = index
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: index * this.scale.height,
      duration: 400,
      ease: 'Cubic.Out',
      onComplete: () => this.renderCurrentFloor()
    })
  }

  private renderCurrentFloor(): void {
    // Render floor tiles to RenderTexture (cached; only rebuilt on tier change)
    const floor = this.getFloor(this.floorIndex)
    if (!this.floorTextures.has(this.floorIndex)) {
      const rt = this.tileRenderer.buildFloorTexture(floor)
      this.floorTextures.set(this.floorIndex, rt)
    }
    // Draw objects (interactive sprites, animated)
    // Pet controller repositions to starting patrol point for this floor
    this.petController.setFloor(floor)
  }

  private setupInputHandlers(): void {
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const obj = this.getObjectAt(ptr.worldX, ptr.worldY)
      if (obj) hubEvents.emit('objectTap', obj.id, obj.room)
    })
  }

  private getFloor(_index: number): HubFloor {
    // Reads from playerSave.hubState — access via a shared reactive store snapshot
    // populated before scene launch; re-read via hubEvents when save mutates
    throw new Error('Implement: return hubState.floors[index]')
  }

  private getObjectAt(_x: number, _y: number): { id: string; room: string } | null {
    // Hit-test against object bounding boxes for the current floor
    return null
  }
}
```

#### Step 2 — Create `src/game/DomeTileRenderer.ts`

```typescript
/**
 * DomeTileRenderer.ts
 *
 * Builds a Phaser RenderTexture for a single HubFloor's tile grid.
 * Called once per floor; result is cached until the floor's tier changes.
 * Tile sprites are assumed pre-loaded in BootScene from domeManifest.ts.
 */
import Phaser from 'phaser'
import { FLOOR_COLS, FLOOR_ROWS, FLOOR_TILE_SIZE } from '../../data/hubLayout'
import type { HubFloor } from '../../data/hubLayout'

export class DomeTileRenderer {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Renders all background and foreground tiles for the given floor
   * into a single RenderTexture. The texture is 768×384 (FLOOR_COLS * FLOOR_TILE_SIZE).
   */
  buildFloorTexture(floor: HubFloor): Phaser.GameObjects.RenderTexture {
    const rt = this.scene.add.renderTexture(
      0, 0,
      FLOOR_COLS * FLOOR_TILE_SIZE,
      FLOOR_ROWS * FLOOR_TILE_SIZE
    )
    for (let row = 0; row < FLOOR_ROWS; row++) {
      for (let col = 0; col < FLOOR_COLS; col++) {
        const bgTile = floor.bgGrid[row * FLOOR_COLS + col]
        const fgTile = floor.fgGrid[row * FLOOR_COLS + col]
        if (bgTile !== 0) {
          rt.drawFrame('dome_tiles', `bg_${bgTile}`, col * FLOOR_TILE_SIZE, row * FLOOR_TILE_SIZE)
        }
        if (fgTile !== 0) {
          rt.drawFrame('dome_tiles', `fg_${fgTile}`, col * FLOOR_TILE_SIZE, row * FLOOR_TILE_SIZE)
        }
      }
    }
    rt.setDepth(0)
    return rt
  }
}
```

#### Step 3 — Create `src/game/DomePetController.ts`

```typescript
/**
 * DomePetController.ts
 *
 * Manages the pet companion sprite in DomeScene.
 * Uses Phaser Arcade Physics for left-right patrol with wall bounce.
 * Animation state machine: idle → walk → sleep (after 30s idle) → react (on tap).
 */
import Phaser from 'phaser'
import type { HubFloor } from '../../data/hubLayout'

type PetState = 'idle' | 'walk' | 'sleep' | 'react'

export class DomePetController {
  private scene: Phaser.Scene
  private sprite!: Phaser.Physics.Arcade.Sprite
  private state: PetState = 'idle'
  private idleTimer = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  setFloor(floor: HubFloor): void {
    const spawnX = floor.petSpawnX ?? 200
    const spawnY = floor.petSpawnY ?? 300
    if (!this.sprite) {
      this.sprite = this.scene.physics.add.sprite(spawnX, spawnY, 'pet_default')
      this.sprite.setCollideWorldBounds(true)
      this.sprite.setBounceX(1)
      this.sprite.body!.setAllowGravity(false)
    } else {
      this.sprite.setPosition(spawnX, spawnY)
    }
    this.transitionTo('walk')
    this.sprite.setVelocityX(40)
  }

  update(delta: number): void {
    if (this.state === 'walk') {
      this.idleTimer = 0
      // Flip sprite to face movement direction
      this.sprite.setFlipX(this.sprite.body!.velocity.x < 0)
    } else if (this.state === 'idle') {
      this.idleTimer += delta
      if (this.idleTimer > 30_000) this.transitionTo('sleep')
    }
  }

  onTap(): void {
    this.transitionTo('react')
    this.scene.time.delayedCall(1200, () => this.transitionTo('idle'))
  }

  private transitionTo(next: PetState): void {
    this.state = next
    this.idleTimer = 0
    this.sprite.play(`pet_${next}`, true)
    if (next === 'walk') {
      if (this.sprite.body!.velocity.x === 0) this.sprite.setVelocityX(40)
    } else {
      this.sprite.setVelocityX(0)
    }
  }
}
```

#### Step 4 — Register `DomeScene` in the Phaser game config

In `src/game/PhaserGame.ts` (or wherever `new Phaser.Game(config)` is called), add `DomeScene` to the `scene` array:

```typescript
import { DomeScene } from './scenes/DomeScene'
// ...
const config: Phaser.Types.Core.GameConfig = {
  // ...existing config...
  scene: [BootScene, DomeScene, MineScene],
}
```

#### Step 5 — Create `src/game/hubEvents.ts` (Phaser→Svelte event bridge)

```typescript
/**
 * hubEvents.ts
 *
 * Tiny EventEmitter that bridges DomeScene (Phaser) to HubView (Svelte).
 * Phaser emits; Svelte listens via onMount / onDestroy subscriptions.
 * Uses the browser EventTarget API (no extra dependencies).
 */
const target = new EventTarget()

export const hubEvents = {
  emit(type: string, ...args: unknown[]): void {
    target.dispatchEvent(Object.assign(new Event(type), { detail: args }))
  },
  on(type: string, handler: (e: Event & { detail: unknown[] }) => void): () => void {
    target.addEventListener(type, handler as EventListener)
    return () => target.removeEventListener(type, handler as EventListener)
  }
}
```

#### Step 6 — Wire `HubView.svelte` to listen for `hubEvents`

In `src/ui/components/HubView.svelte`, replace the direct `<DomeCanvas>` tap handler with event subscriptions:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { hubEvents } from '../../game/hubEvents'
  import { currentScene } from '../../game/PhaserGame'  // writable store

  let unsub: () => void

  onMount(() => {
    // Tell Phaser to activate DomeScene
    currentScene.set('DomeScene')

    unsub = hubEvents.on('objectTap', (e) => {
      const [id, room] = (e as CustomEvent).detail as [string, string]
      handleObjectTap(id, room)
    })
  })

  onDestroy(() => {
    unsub?.()
    currentScene.set('MineScene')
  })

  function handleObjectTap(id: string, room: string) {
    if (room === 'none' || room === 'dive') return
    selectedRoom = room
    panelOpen = true
  }
</script>

<!-- Resource bar + panel overlays remain as pure Svelte DOM components -->
```

### Verification

**Before starting**: take a screenshot of the current `DomeCanvas.svelte` render to establish a visual baseline.

```js
// /tmp/ss-dome-before.js — run with: node /tmp/ss-dome-before.js
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
  await page.screenshot({ path: '/tmp/ss-dome-before.png' })
  await browser.close()
})()
```

**After migration**: run the same script saving to `/tmp/ss-dome-after.png`, then visually compare with the Read tool.

**Manual checklist**:
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — succeeds with no warnings about missing scene imports
- [ ] DomeScene renders: tile grid visible, objects in correct positions, pet sprite animated
- [ ] Floor transitions: swipe/scroll triggers Phaser camera tween at ~400ms, floor indicator updates
- [ ] Pet pathfinding: pet walks left-right, flips sprite at boundary, transitions to sleep after 30s idle
- [ ] Tapping an object emits `objectTap` event; Svelte panel slides up for interactive rooms
- [ ] Tapping `dive_hatch` object triggers dive flow (not a panel open)
- [ ] Resource bar (Svelte DOM) remains visible and updates correctly while DomeScene is active
- [ ] FPS on mobile (Chrome DevTools throttled): ≥ 30fps with all objects animated
- [ ] MineScene and DomeScene can be switched back and forth without texture leaks (check GPU memory in DevTools)
- [ ] `DomeCanvas.svelte` deleted; no remaining imports of it anywhere

---

## Sub-Phase 10.11: Multi-Floor Cutaway Layout (DD-V2-260)

### What

Replace the single-floor viewport with a Fallout Shelter-style side-view cutaway where all unlocked floors are visible simultaneously, stacked vertically. The player scrolls the camera vertically to navigate between floors rather than switching screens. The elliptical dome top transitions into a cylindrical glass tower body, with each floor visible as a rectangular glass-paneled level.

### Where

- **Modified**: `src/game/scenes/DomeScene.ts` — extend camera world bounds to `192 × (128 × floorCount)` height; add vertical scroll gesture handler
- **Modified**: `src/data/hubLayout.ts` — add `FLOOR_STACK_HEIGHT` constant; add `getDomeWorldHeight(floorCount: number): number` utility
- **Modified**: `src/ui/components/FloorIndicator.svelte` — update to reflect full scrollable range rather than discrete floor tabs
- **New**: `src/game/DomeCutawayRenderer.ts` — renders structural connectors between floors (glass shaft walls, catwalk silhouettes, elevator cables)

### How

#### Step 1 — Extend world height in `DomeScene.ts`

```typescript
// In DomeScene.create()
const worldHeight = FLOOR_CANVAS_H * this.floorCount
this.cameras.main.setBounds(0, 0, FLOOR_CANVAS_W, worldHeight)
this.physics.world.setBounds(0, 0, FLOOR_CANVAS_W, worldHeight)
```

#### Step 2 — Stack floor RenderTextures vertically

Each floor's `RenderTexture` is placed at `y = floorIndex * FLOOR_CANVAS_H`. The camera scrolls smoothly to bring any floor into view.

```typescript
// In DomeTileRenderer.placeFloor()
const rt = this.buildFloorTexture(floor)
rt.setPosition(0, floorIndex * FLOOR_CANVAS_H)
```

#### Step 3 — Vertical scroll input

```typescript
// Mouse wheel
this.input.on('wheel', (_ptr: unknown, _objs: unknown, _dx: number, dy: number) => {
  this.cameras.main.scrollY = Phaser.Math.Clamp(
    this.cameras.main.scrollY + dy * 0.8,
    0,
    worldHeight - this.scale.height
  )
})

// Touch: track touch start Y, compute delta on move
```

#### Step 4 — Glass shaft structural connectors

`DomeCutawayRenderer` draws between-floor visual connectors using Phaser Graphics:
- Thin vertical lines (1px, teal at 40% alpha) for elevator cables
- Horizontal 3-tile-high connector bands with glass-panel pattern between each pair of floors
- Catwalk platform silhouette (8px tall dark bar) at the top and bottom edges of each floor

#### Step 5 — Dome-top transition

The elliptical dome arch (existing sprite `dome_arch.png`) is placed at `y = 0`, above Floor 0. Below Floor 0, cylindrical glass wall side panels tile downward for all subsequent floors.

### Acceptance Criteria

- [ ] `npm run typecheck` — zero errors
- [ ] All floors render simultaneously in world space, stacked vertically
- [ ] Vertical scroll (wheel + touch swipe) moves the camera smoothly; no floor boundary snap artifacts
- [ ] Glass shaft connectors visible between each pair of floors
- [ ] Elliptical dome arch at top, cylindrical panels below

### Playwright Test

```js
// Write to /tmp/ss-10.11.js and run: node /tmp/ss-10.11.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/ss-10.11-top.png' })
  // Scroll down to reveal lower floors
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 400 })))
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/ss-10.11-scrolled.png' })
  await browser.close()
  console.log('Check /tmp/ss-10.11-top.png and /tmp/ss-10.11-scrolled.png')
})()
```

---

## Sub-Phase 10.12: Empty vs Upgraded Floor Visual Language (DD-V2-261)

### What

Give players an immediate visual read of a floor's state. Empty/locked floors must feel unfinished and dim. Furnished/upgraded floors must feel warm and alive. A ghosted silhouette overlay on empty floors shows what objects could be placed there, creating anticipation without confusion.

### Where

- **Modified**: `src/game/DomeTileRenderer.ts` — apply desaturation filter and dimming when rendering empty-tier floors
- **Modified**: `src/game/scenes/DomeScene.ts` — add ghosted silhouette rendering pass using `obj_locked_silhouette.png`
- **Modified**: `src/ui/components/FloorCanvas.svelte` (if still in use) — CSS class `floor--empty` for desaturated palette
- **New sprite**: `src/assets/sprites/dome/obj_locked_silhouette.png` — generic 32×32 faded object silhouette (generate via ComfyUI: "pixel art ghost silhouette of sci-fi furniture object, translucent, pale blue-grey, transparent background")
- **New sprite**: `src/assets/sprites-hires/dome/obj_locked_silhouette.png` — 256×256 hi-res version

### How

#### Step 1 — Empty floor rendering pass

When `floor.tier === 0` (empty/locked), apply post-draw desaturation to the floor's `RenderTexture`:

```typescript
// DomeTileRenderer.buildFloorTexture()
if (floor.tier === 0) {
  // Draw floor contents at 30% alpha, tinted grey
  rt.setAlpha(0.35)
  rt.setTint(0x888888)
  // Add flickering dim light overlay (a semi-transparent dark rect with slow alpha tween)
}
```

#### Step 2 — Ghosted silhouette overlay

For every interactive object defined for the floor but not yet placed (because tier is 0), render the `obj_locked_silhouette` sprite at that object's canonical position, at 15% opacity:

```typescript
const ghostPositions = floor.objects
  .filter(obj => !obj.placed)
  .map(obj => ({ x: obj.canonicalX, y: obj.canonicalY }))

for (const pos of ghostPositions) {
  const ghost = this.scene.add.image(pos.x, pos.y + floorOffset, 'obj_locked_silhouette')
  ghost.setAlpha(0.15)
  ghost.setTint(0xaaddff)
}
```

#### Step 3 — Furnished floor warm lighting

When `floor.tier >= 1`, add a soft warm radial gradient overlay at the floor's light fixture positions (defined in `hubFloors.ts` as `lightPositions: {x,y}[]`):

```typescript
const gfx = this.scene.add.graphics()
for (const lp of floor.lightPositions) {
  gfx.fillStyle(0xffe8a0, 0.08)
  gfx.fillCircle(lp.x, lp.y + floorOffset, 80)
}
```

#### Step 4 — Ambient dust motes (furnished only)

Particle emitter active only when `floor.tier >= 2`. Slow-rising golden dust motes, 3px diameter, 6-second lifetime, 2 particles/second, random horizontal spread across floor width.

### Acceptance Criteria

- [ ] Empty floor (tier 0): visibly desaturated, dim, flickering light, ghosted silhouettes at 15% opacity visible
- [ ] Furnished floor (tier 1+): warm lighting overlay, full saturation sprites
- [ ] Tier 2+ floor: ambient dust mote particle emitter active
- [ ] `obj_locked_silhouette.png` sprites exist in both 32px and 256px directories
- [ ] Screenshot side-by-side of empty vs furnished floor shows unmistakable visual difference

### Playwright Test

```js
// Write to /tmp/ss-10.12.js and run: node /tmp/ss-10.12.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(2000)
  // Screenshot starter (furnished) floor
  await page.screenshot({ path: '/tmp/ss-10.12-furnished.png' })
  // Scroll to a locked/empty floor
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 500 })))
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/ss-10.12-empty.png' })
  await browser.close()
  console.log('Compare /tmp/ss-10.12-furnished.png vs /tmp/ss-10.12-empty.png')
})()
```

---

## Sub-Phase 10.13: Knowledge Tree 6-Stage Growth (DD-V2-266)

### What

Expand the Knowledge Tree physical object in the dome from the existing 8-stage system to a clearly legible 6-stage growth arc with emotionally distinct visual milestones. Growth must feel dramatic and rewarding. Each stage is a distinct sprite generated via ComfyUI.

### Stages

| Stage | Fact Range | Label | Visual Description |
|-------|-----------|-------|--------------------|
| 0 | 0–10 | Tiny Sapling | Single thin stem, 2 small leaves, bare soil pot |
| 1 | 11–50 | Small Bush | Rounded bushy shape, 6–8 leaves, visible roots |
| 2 | 51–150 | Young Tree | Defined trunk, branching structure, leafy canopy |
| 3 | 151–500 | Mature Tree | Full canopy, thick trunk, visible bark texture, small flowers |
| 4 | 501–1000 | Grand Tree | Wide spreading canopy, aerial roots, golden leaf highlights |
| 5 | 1001+ | Ancient Tree | Towering multi-trunk, cascading golden leaves, faint aura glow |

### Where

- **Modified**: `src/data/knowledgeTreeStages.ts` — update `TreeStage` array to 6 entries (indices 0–5); update `getTreeStage(masteredCount)` threshold table
- **New sprites** (generate all 6 in one ComfyUI batch):
  - `src/assets/sprites/dome/obj_knowledge_tree_stage0.png` through `obj_knowledge_tree_stage5.png`
  - `src/assets/sprites-hires/dome/obj_knowledge_tree_stage0.png` through `obj_knowledge_tree_stage5.png`
- **Modified**: `src/game/domeManifest.ts` — update key list from `stage0..stage7` to `stage0..stage5`

### How

#### Step 1 — Update `knowledgeTreeStages.ts`

```typescript
export interface TreeStage {
  index: number
  label: string
  minFacts: number
  spriteKey: string
  gaiaComment: string
}

export const TREE_STAGES: TreeStage[] = [
  { index: 0, label: 'Tiny Sapling',  minFacts: 0,    spriteKey: 'obj_knowledge_tree_stage0', gaiaComment: "A single sapling. Every forest started here." },
  { index: 1, label: 'Small Bush',    minFacts: 11,   spriteKey: 'obj_knowledge_tree_stage1', gaiaComment: "It's filling out. Knowledge takes root." },
  { index: 2, label: 'Young Tree',    minFacts: 51,   spriteKey: 'obj_knowledge_tree_stage2', gaiaComment: "A real tree now. Look at those branches." },
  { index: 3, label: 'Mature Tree',   minFacts: 151,  spriteKey: 'obj_knowledge_tree_stage3', gaiaComment: "Mature. Strong. Not bad for a crash survivor." },
  { index: 4, label: 'Grand Tree',    minFacts: 501,  spriteKey: 'obj_knowledge_tree_stage4', gaiaComment: "Grand. The golden leaves are a nice touch." },
  { index: 5, label: 'Ancient Tree',  minFacts: 1001, spriteKey: 'obj_knowledge_tree_stage5', gaiaComment: "Ancient. This tree has outlasted civilizations. So have you." },
]

export function getTreeStage(masteredCount: number): TreeStage {
  for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
    if (masteredCount >= TREE_STAGES[i].minFacts) return TREE_STAGES[i]
  }
  return TREE_STAGES[0]
}
```

#### Step 2 — ComfyUI sprite generation

Generate all 6 sprites in one batch. Base prompt template:
```
"pixel art knowledge tree [STAGE_DESCRIPTOR], centered on white background, isometric game asset, warm natural colors, detailed foliage, 256x256"
```

Stage-specific descriptors:
- Stage 0: `"tiny sapling in small pot, single stem, two leaves, delicate"`
- Stage 1: `"small bush with rounded canopy, 8 leaves, visible roots"`
- Stage 2: `"young tree with defined trunk, branching canopy, leafy"`
- Stage 3: `"mature tree, full wide canopy, thick trunk, small white flowers"`
- Stage 4: `"grand tree with spreading canopy, aerial roots, golden leaf highlights"`
- Stage 5: `"ancient world tree, towering multi-trunk, cascading golden leaves, faint golden aura glow, mythic scale"`

Ancient tree (stage 5) must feel categorically different from stage 4 — bigger, more luminous, unmistakably special.

#### Step 3 — Wire stage transitions in DomeScene

When `playerSave.learnedFacts.length` crosses a stage threshold, play a brief 0.5s scale-pulse tween on the tree sprite and fire GAIA toast with `stage.gaiaComment`.

```typescript
// Called from playerData store subscription in DomeScene
private onTreeStageChanged(newStage: TreeStage): void {
  const treeObj = this.objectSprites.get('knowledge_tree')
  if (!treeObj) return
  treeObj.setTexture(newStage.spriteKey)
  this.tweens.add({ targets: treeObj, scaleX: 1.15, scaleY: 1.15, duration: 250, yoyo: true })
  gaiaManager.triggerGaia('knowledge_tree_growth', { stage: newStage.label })
}
```

### Acceptance Criteria

- [ ] All 6 sprite files exist in both 32px and 256px directories
- [ ] `getTreeStage(0)` returns stage 0; `getTreeStage(11)` returns stage 1; `getTreeStage(1001)` returns stage 5
- [ ] Stage 5 sprite visually distinct from stage 4 (aura, scale, luminosity)
- [ ] Tree sprite updates reactively in DomeScene when mastered count crosses a threshold
- [ ] Scale-pulse tween plays on stage transition
- [ ] `npm run typecheck` — zero errors

---

## Sub-Phase 10.14: Procedural Structural Detail Pass (DD-V2-267)

### What

Enhance the procedurally-rendered structural elements of the dome with fine detail: panel line patterns on glass walls, rivet dots on metal platforms, noise texture on floors, and condensation drip animations on glass. All detail is procedural (drawn via Phaser Graphics or canvas ctx) — zero texture memory cost.

### Where

- **Modified**: `src/game/DomeTileRenderer.ts` — add detail-pass methods called after base tile rendering
- **Modified**: `src/game/scenes/DomeScene.ts` — add condensation drip particle emitter on glass wall columns

### How

#### Step 1 — Panel lines on glass walls

After rendering each glass wall tile, draw horizontal panel seam lines every 16px and vertical strut lines every 32px using 1px-wide semi-transparent lines:

```typescript
private drawGlassDetail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(180,220,255,0.12)'
  ctx.lineWidth = 1
  // Horizontal panel seams every 16px
  for (let py = y; py < y + h; py += 16) {
    ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke()
  }
  // Vertical struts every 32px
  for (let px = x; px < x + w; px += 32) {
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke()
  }
}
```

#### Step 2 — Rivet dots on metal platforms

After rendering each platform tile, draw 3×3 clusters of 2px-radius circles at the four corners of each tile, in a dark gunmetal color at 60% opacity:

```typescript
private drawRivetDetail(ctx: CanvasRenderingContext2D, tileX: number, tileY: number): void {
  const offsets = [[3,3],[3,FLOOR_TILE_SIZE-3],[FLOOR_TILE_SIZE-3,3],[FLOOR_TILE_SIZE-3,FLOOR_TILE_SIZE-3]]
  ctx.fillStyle = 'rgba(60,60,70,0.6)'
  for (const [dx, dy] of offsets) {
    ctx.beginPath()
    ctx.arc(tileX + dx, tileY + dy, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}
```

#### Step 3 — Floor noise texture

After rendering floor tiles, apply a subtle Perlin-like noise overlay by drawing 1px dots at random positions at 5% opacity. Seeded per-floor so the pattern is stable across frames:

```typescript
private drawFloorNoise(ctx: CanvasRenderingContext2D, floorSeed: number): void {
  const rng = seededRandom(floorSeed)
  ctx.fillStyle = 'rgba(0,0,0,0.05)'
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(rng() * FLOOR_CANVAS_W)
    const y = Math.floor(rng() * FLOOR_CANVAS_H)
    ctx.fillRect(x, y, 1, 1)
  }
}
```

#### Step 4 — Condensation drip particles

On glass wall columns, add a Phaser particle emitter with these config values:
- Spawn position: top of each glass wall column segment (x = column X, y = column top Y)
- Velocity: `{ x: 0, y: { min: 8, max: 20 } }` px/s
- Alpha: fade from 0.4 to 0 over 3s lifetime
- Frequency: one drip per 2000ms per column
- Particle appearance: 1×4 px vertical rectangle, rgba(180,220,255,0.5)

### Acceptance Criteria

- [ ] Panel lines visible on all glass wall tiles (subtle but present in screenshot)
- [ ] Rivet dots visible on metal platform tiles at corners
- [ ] Floor noise present (adds texture variation without obscuring sprites)
- [ ] Condensation drip particles active on glass wall columns
- [ ] No performance regression: dome renders at ≥30fps on throttled mobile (Chrome DevTools)
- [ ] Before/after screenshots show clear improvement in structural visual richness

---

## Sub-Phase 10.15: Dome-to-Mine Transition Animation (DD-V2-275)

### What

Replace the instant screen switch between dome and mine with a cinematic "portal" zoom transition. Diving: camera zooms into the dive hatch object over 0.5s, cross-fades to a dark tunnel frame over 0.3s, then the mine's first frame appears. Surfacing: reverse sequence. The transition communicates intentional scale change and adds emotional weight to each dive decision.

### Where

- **Modified**: `src/game/scenes/DomeScene.ts` — add `playDiveTransition(): Promise<void>` and `playSurfaceTransition(): Promise<void>` methods
- **Modified**: `src/game/scenes/MineScene.ts` — add `playEntryTransition(): Promise<void>` method (dark-to-lit crossfade)
- **Modified**: `src/ui/components/HubView.svelte` — await `DomeScene.playDiveTransition()` before switching to mine screen
- **Modified**: `src/ui/components/DiveResults.svelte` — await `MineScene.playSurfaceTransition()` equivalent before switching back to dome

### How

#### Step 1 — Dive transition (DomeScene → MineScene)

```typescript
async playDiveTransition(): Promise<void> {
  const hatch = this.objectSprites.get('dive_hatch')
  if (!hatch) return

  // Phase 1: zoom camera into hatch center over 500ms
  await new Promise<void>(resolve => {
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 4,
      scrollX: hatch.x - this.scale.width / 8,
      scrollY: hatch.y + this.getFloorOffset() - this.scale.height / 8,
      duration: 500,
      ease: 'Cubic.In',
      onComplete: () => resolve()
    })
  })

  // Phase 2: black cross-fade overlay 300ms
  const overlay = this.add.rectangle(
    this.cameras.main.scrollX + this.scale.width / 2,
    this.cameras.main.scrollY + this.scale.height / 2,
    this.scale.width, this.scale.height, 0x000000
  ).setDepth(999).setAlpha(0)

  await new Promise<void>(resolve => {
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
      ease: 'Linear',
      onComplete: () => resolve()
    })
  })
}
```

#### Step 2 — Mine entry transition (MineScene)

```typescript
async playEntryTransition(): Promise<void> {
  // Start fully black, fade in over 400ms
  const overlay = this.add.rectangle(
    this.cameras.main.centerX, this.cameras.main.centerY,
    this.scale.width, this.scale.height, 0x000000
  ).setDepth(999).setAlpha(1)

  await new Promise<void>(resolve => {
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.Out',
      onComplete: () => { overlay.destroy(); resolve() }
    })
  })
}
```

#### Step 3 — Surface transition (reverse)

```typescript
async playSurfaceTransition(): Promise<void> {
  // Fade to black 300ms
  const overlay = this.add.rectangle(...)  // same as above
  await tweenAlphaTo(overlay, 1, 300)
  // Caller then switches to DomeScene
}

// DomeScene.playReturnTransition()
async playReturnTransition(): Promise<void> {
  // Reset camera zoom to 1 instantly (hidden by overlay)
  this.cameras.main.setZoom(1)
  this.cameras.main.centerOn(FLOOR_CANVAS_W / 2, FLOOR_CANVAS_H / 2)
  // Fade in from black 400ms
  const overlay = this.add.rectangle(...).setAlpha(1)
  await tweenAlphaTo(overlay, 0, 400)
  overlay.destroy()
}
```

#### Step 4 — Wire in HubView.svelte

```svelte
async function handleDive() {
  await domeScene.playDiveTransition()
  currentScreen.set('mine')
  // MineScene.playEntryTransition() called from MineScene.create()
}
```

### Acceptance Criteria

- [ ] Dive: camera zooms into hatch, screen fades to black, mine appears (no jarring cut)
- [ ] Surface: screen fades to black, dome appears with camera at normal zoom
- [ ] Total transition duration: dive ≤800ms, surface ≤700ms (does not feel slow)
- [ ] No visual artifacts (z-fighting, white flash, camera position error) during or after transition
- [ ] `npm run typecheck` — zero errors

### Playwright Test

```js
// Write to /tmp/ss-10.15.js and run: node /tmp/ss-10.15.js
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
  await page.screenshot({ path: '/tmp/ss-10.15-dome.png' })
  await page.click('button:has-text("Dive")')
  // Capture mid-transition at ~400ms
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/ss-10.15-mid-transition.png' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/ss-10.15-mine.png' })
  await browser.close()
  console.log('Check /tmp/ss-10.15-dome.png, mid-transition.png, mine.png')
})()
```

---

## Sub-Phase 10.16: GAIA Pixel Art Thought Bubbles (DD-V2-263)

### What

Render GAIA's idle dome comments as in-world pixel art speech bubbles drawn directly on the DomeScene canvas, anchored near the GAIA terminal object. Short comments (≤60 chars, 2 lines) appear fully in-world. Clicking the bubble opens the existing HTML `GaiaToast` overlay for longer messages. This makes GAIA feel physically present in the dome rather than just a HUD overlay.

### Where

- **Modified**: `src/game/scenes/DomeScene.ts` — add `showThoughtBubble(text: string)` and `hideThoughtBubble()` methods; manage `bubbleGraphics` and `bubbleText` game objects
- **Modified**: `src/game/managers/GaiaManager.ts` — call `domeScene.showThoughtBubble(text)` when `emitThoughtBubble()` fires while dome is active
- **New sprite**: not needed — bubble drawn procedurally via Phaser Graphics

### How

#### Step 1 — Bubble geometry

Bubble is drawn with Phaser Graphics at a fixed position relative to the GAIA terminal object (above and slightly right):

```typescript
private drawBubble(text: string): void {
  const gaia = this.objectSprites.get('gaia_terminal')
  if (!gaia) return

  const bx = gaia.x + 40   // offset right of terminal
  const by = gaia.y + this.getFloorOffset() - 60  // above terminal

  const PAD = 8
  const LINE_H = 12
  const lines = this.wrapText(text, 60, 2)  // max 2 lines, 60 chars total
  const bw = Math.max(...lines.map(l => l.length)) * 6 + PAD * 2
  const bh = lines.length * LINE_H + PAD * 2 + 8  // +8 for tail

  // Background: dark translucent fill
  this.bubbleGfx.fillStyle(0x0a1a1f, 0.82)
  this.bubbleGfx.fillRoundedRect(bx, by, bw, bh, 4)

  // Border: 2px GAIA teal
  this.bubbleGfx.lineStyle(2, 0x4ecca3, 1.0)
  this.bubbleGfx.strokeRoundedRect(bx, by, bw, bh, 4)

  // Triangular tail pointing down toward terminal
  this.bubbleGfx.fillStyle(0x0a1a1f, 0.82)
  this.bubbleGfx.fillTriangle(
    bx + 12, by + bh,
    bx + 24, by + bh,
    bx + 18, by + bh + 8
  )
  this.bubbleGfx.lineStyle(2, 0x4ecca3, 1.0)
  this.bubbleGfx.strokeTriangle(
    bx + 12, by + bh,
    bx + 24, by + bh,
    bx + 18, by + bh + 8
  )

  // Text: pixel-style BitmapText
  this.bubbleText?.destroy()
  this.bubbleText = this.add.text(bx + PAD, by + PAD, lines, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#c8f0e8',
    lineSpacing: 2
  }).setDepth(200)

  // Click zone to open full HTML overlay
  this.bubbleHitZone?.destroy()
  this.bubbleHitZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh)
    .setInteractive()
    .on('pointerdown', () => {
      hubEvents.emit('gaia-bubble-tap', text)
      this.hideThoughtBubble()
    })
}
```

#### Step 2 — Auto-dismiss

Bubble auto-hides after 8 seconds if not tapped:

```typescript
showThoughtBubble(text: string): void {
  this.hideThoughtBubble()
  this.drawBubble(text)
  this.bubbleTimer = this.time.delayedCall(8000, () => this.hideThoughtBubble())
}

hideThoughtBubble(): void {
  this.bubbleTimer?.remove()
  this.bubbleGfx?.clear()
  this.bubbleText?.destroy()
  this.bubbleHitZone?.destroy()
}
```

#### Step 3 — Wire tap to GaiaToast

In `HubView.svelte`, listen for `gaia-bubble-tap`:

```svelte
onMount(() => {
  const unsub = hubEvents.on('gaia-bubble-tap', (e) => {
    const [text] = (e as CustomEvent).detail as [string]
    gaiaToastText.set(text)  // opens existing GaiaToast overlay
  })
  return unsub
})
```

### Acceptance Criteria

- [ ] Thought bubble appears near GAIA terminal with correct teal border and dark fill
- [ ] Text wraps to ≤2 lines, max 60 characters
- [ ] Triangular tail points from bubble toward terminal
- [ ] Bubble auto-dismisses after 8 seconds
- [ ] Tapping bubble fires `gaia-bubble-tap` event; GaiaToast HTML overlay opens
- [ ] `npm run typecheck` — zero errors

### Playwright Test

```js
// Write to /tmp/ss-10.16.js and run: node /tmp/ss-10.16.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('canvas', { timeout: 15000 })
  // Trigger a GAIA thought bubble via DevPanel or direct store manipulation
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('debug:gaia-bubble', { detail: 'Test thought bubble message' }))
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-10.16-bubble.png' })
  await browser.close()
  console.log('Check /tmp/ss-10.16-bubble.png — bubble should appear near GAIA terminal')
})()
```
