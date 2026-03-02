/**
 * domeLayout.ts
 *
 * Data model and default layout for the Terraria-style tile-based dome hub.
 * The dome is a 2D grid with four layers: sky background, background wall,
 * foreground structure, and interactive objects.
 *
 * Grid: 24 columns × 16 rows, each tile rendered at TILE_SIZE pixels.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base tile size in logical pixels (lo-res mode). Hi-res scales this up. */
export const TILE_SIZE = 32

/** Dome grid dimensions. */
export const DOME_WIDTH = 24
export const DOME_HEIGHT = 16

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Tile types for the background layer.
 * Drawn behind everything else; typically sky or interior wall fill.
 */
export enum BgTile {
  /** Nothing — sky colour / transparent shows through */
  Empty = 0,
  /** Night sky texture, tiled across the upper sky area */
  Sky = 1,
  /** Dark sci-fi wall panels — interior dome background */
  InteriorWall = 2,
  /** Brown earth / foundation below the dome */
  DirtGround = 3,
}

/**
 * Tile types for the foreground / structural layer.
 * These form the visible dome shell, floors, and platforms.
 */
export enum FgTile {
  /** No tile — open space */
  Empty = 0,
  /** Translucent blue-green glass panels */
  DomeGlass = 1,
  /** Dark metal structural beam */
  DomeFrame = 2,
  /** Curved dome top piece (arch apex) */
  DomeGlassCurved = 3,
  /** Polished stone floor */
  StoneFloor = 4,
  /** Metal grate walkway / sub-floor platform */
  MetalPlatform = 5,
}

// ---------------------------------------------------------------------------
// Sprite key maps
// ---------------------------------------------------------------------------

/**
 * Maps each BgTile enum value to its sprite filename key (without extension).
 * `null` means no sprite is drawn for that tile.
 */
export const BG_TILE_SPRITES: Record<BgTile, string | null> = {
  [BgTile.Empty]: null,
  [BgTile.Sky]: 'sky_stars',
  [BgTile.InteriorWall]: 'interior_wall',
  [BgTile.DirtGround]: 'dirt_ground',
}

/**
 * Maps each FgTile enum value to its sprite filename key (without extension).
 * `null` means no sprite is drawn for that tile.
 */
export const FG_TILE_SPRITES: Record<FgTile, string | null> = {
  [FgTile.Empty]: null,
  [FgTile.DomeGlass]: 'dome_glass',
  [FgTile.DomeFrame]: 'dome_frame',
  [FgTile.DomeGlassCurved]: 'dome_glass_curved',
  [FgTile.StoneFloor]: 'stone_floor',
  [FgTile.MetalPlatform]: 'metal_platform',
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * A single object / furniture piece placed on the dome grid.
 * Multi-tile objects have an anchor (top-left) position plus width/height.
 */
export interface DomeObject {
  /** Unique identifier for this object instance. */
  id: string
  /** Sprite filename key matching the sprite asset (no extension). */
  spriteKey: string
  /** Human-readable display name shown in tooltips / UI. */
  label: string
  /**
   * Which room panel this object opens when clicked.
   * Special values: `'dive'` triggers a mine dive; `'none'` is decorative only.
   */
  room: string
  /** Anchor column (0-indexed, left edge of the object). */
  gridX: number
  /** Anchor row (0-indexed, top edge of the object). */
  gridY: number
  /** Width of this object in tiles. */
  gridW: number
  /** Height of this object in tiles. */
  gridH: number
  /** Whether the player can interact with / click this object. */
  interactive: boolean
}

/**
 * The complete dome layout, comprising all four data layers.
 * This is the single source of truth consumed by DomeCanvas.svelte.
 */
export interface DomeLayout {
  /** Number of grid columns. */
  width: number
  /** Number of grid rows. */
  height: number
  /** Base tile size in pixels (logical resolution). */
  tileSize: number
  /**
   * Background layer — indexed as `bg[row][col]`.
   * Drawn first; sky and wall fill.
   */
  bg: BgTile[][]
  /**
   * Foreground / structure layer — indexed as `fg[row][col]`.
   * Drawn above the background; dome shell, floors, platforms.
   */
  fg: FgTile[][]
  /**
   * Objects, furniture, and decorations placed at specific grid positions.
   * Rendered above both tile layers.
   */
  objects: DomeObject[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a 2D grid of `height` rows × `width` columns, every cell set to
 * `fill`. The returned array is indexed as `grid[row][col]`.
 *
 * @param w     Number of columns.
 * @param h     Number of rows.
 * @param fill  Initial value for every cell.
 * @returns     A freshly allocated 2D array.
 */
export function createEmptyGrid<T>(w: number, h: number, fill: T): T[][] {
  return Array.from({ length: h }, () => Array<T>(w).fill(fill))
}

// ---------------------------------------------------------------------------
// Default layout factory
// ---------------------------------------------------------------------------

/**
 * Returns the canonical starting dome layout.
 *
 * Dome cross-section (24 cols × 16 rows):
 * ```
 * Row  0: Sky sky sky  ....sky....  sky sky sky
 * Row  1: Sky  [glass_curved arch top centre]  Sky
 * Row  2: Sky  [dome_glass curved sides]        Sky
 * Row  3: [frame] dome_glass ... dome_glass [frame]
 * Row  4: [frame] interior_wall interior_wall [frame]
 * Row  5: [frame] interior_wall (ceiling lights) [frame]
 * Row  6: [frame] interior (open) [frame]
 * Row  7: [frame] interior (objects: tree, shelf) [frame]
 * Row  8: [frame] interior (objects: terminal, bench) [frame]
 * Row  9: [frame] interior (objects: farm, display) [frame]
 * Row 10: [frame] stone_floor ... stone_floor [frame]
 * Row 11: [frame] metal_platform ... [frame]
 * Row 12: [frame] metal_platform ... [frame]
 * Row 13: dirt dirt dirt ... dirt dirt dirt
 * Row 14: dirt dirt dirt ... dirt dirt dirt
 * Row 15: dirt dirt dirt ... dirt dirt dirt
 * ```
 *
 * Dome arch spans columns 3–20 (18 tiles wide), centred in the 24-tile grid.
 */
export function getDefaultDomeLayout(): DomeLayout {
  const W = DOME_WIDTH   // 24
  const H = DOME_HEIGHT  // 16

  // --- Background layer ---------------------------------------------------
  const bg = createEmptyGrid<BgTile>(W, H, BgTile.Empty)

  // Rows 0-3: sky
  for (let row = 0; row <= 3; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.Sky
    }
  }

  // Rows 4-12: interior wall behind the dome (columns 3-20)
  for (let row = 4; row <= 12; row++) {
    for (let col = 3; col <= 20; col++) {
      bg[row][col] = BgTile.InteriorWall
    }
    // Sky on the exposed outside edges
    for (let col = 0; col < 3; col++) {
      bg[row][col] = BgTile.Sky
    }
    for (let col = 21; col < W; col++) {
      bg[row][col] = BgTile.Sky
    }
  }

  // Rows 13-15: dirt foundation across full width
  for (let row = 13; row <= 15; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.DirtGround
    }
  }

  // --- Foreground / structure layer ----------------------------------------
  const fg = createEmptyGrid<FgTile>(W, H, FgTile.Empty)

  // Dome arch shape
  // The arch spans columns 3–20 (inner edge). Outer frame columns are 3 and 20.
  //
  // Row 1: curved glass apex — only the inner 8 columns at the very top centre
  //   (cols 8–15, curved tile)
  for (let col = 8; col <= 15; col++) {
    fg[1][col] = FgTile.DomeGlassCurved
  }

  // Row 2: wider curved glass shoulder — cols 5–18
  for (let col = 5; col <= 18; col++) {
    if (col === 5 || col === 18) {
      fg[2][col] = FgTile.DomeFrame
    } else {
      fg[2][col] = FgTile.DomeGlass
    }
  }

  // Row 3: even wider dome glass with frame edges — cols 3–20
  for (let col = 3; col <= 20; col++) {
    if (col === 3 || col === 20) {
      fg[3][col] = FgTile.DomeFrame
    } else {
      fg[3][col] = FgTile.DomeGlass
    }
  }

  // Rows 4-12: left and right vertical frame columns (cols 3 and 20)
  for (let row = 4; row <= 12; row++) {
    fg[row][3] = FgTile.DomeFrame
    fg[row][20] = FgTile.DomeFrame
  }

  // Row 10: stone floor — cols 4-19 (inside the frame)
  for (let col = 4; col <= 19; col++) {
    fg[10][col] = FgTile.StoneFloor
  }

  // Rows 11-12: sub-floor metal platforms — cols 4-19
  for (let row = 11; row <= 12; row++) {
    for (let col = 4; col <= 19; col++) {
      fg[row][col] = FgTile.MetalPlatform
    }
  }

  // Rows 13-15: dome frame legs at cols 3 and 20; dirt fill already in bg
  for (let row = 13; row <= 15; row++) {
    fg[row][3] = FgTile.DomeFrame
    fg[row][20] = FgTile.DomeFrame
  }

  // --- Objects layer -------------------------------------------------------
  const objects: DomeObject[] = [
    // ---- Functional objects ----

    {
      id: 'gaia_terminal',
      spriteKey: 'obj_gaia_terminal',
      label: 'G.A.I.A. Terminal',
      room: 'command',
      gridX: 4,
      gridY: 8,
      gridW: 2,
      gridH: 2,
      interactive: true,
    },
    {
      id: 'knowledge_tree',
      spriteKey: 'obj_knowledge_tree',
      label: 'Knowledge Tree',
      room: 'lab',
      gridX: 7,
      gridY: 7,
      gridW: 2,
      gridH: 3,
      interactive: true,
    },
    {
      id: 'streak_board',
      spriteKey: 'obj_streak_board',
      label: 'Streak Board',
      room: 'command',
      gridX: 9,
      gridY: 9,
      gridW: 1,
      gridH: 2,
      interactive: true,
    },
    {
      id: 'dive_hatch',
      spriteKey: 'obj_dive_hatch',
      label: 'Mine Entrance',
      room: 'dive',
      gridX: 11,
      gridY: 10,
      gridW: 2,
      gridH: 1,
      interactive: true,
    },
    {
      id: 'locked_placeholder',
      spriteKey: 'obj_locked_silhouette',
      label: 'Locked Room',
      room: 'none',
      gridX: 13,
      gridY: 7,
      gridW: 2,
      gridH: 2,
      interactive: false,
    },
    {
      id: 'display_case',
      spriteKey: 'obj_display_case',
      label: 'Display Case',
      room: 'museum',
      gridX: 10,
      gridY: 8,
      gridW: 2,
      gridH: 2,
      interactive: true,
    },
    {
      id: 'workbench',
      spriteKey: 'obj_workbench',
      label: 'Materializer',
      room: 'workshop',
      gridX: 14,
      gridY: 8,
      gridW: 3,
      gridH: 2,
      interactive: true,
    },
    {
      id: 'market_stall',
      spriteKey: 'obj_market_stall',
      label: 'Market Stall',
      room: 'market',
      gridX: 16,
      gridY: 8,
      gridW: 3,
      gridH: 2,
      interactive: true,
    },
    {
      id: 'bookshelf',
      spriteKey: 'obj_bookshelf',
      label: 'Archive Shelf',
      room: 'archive',
      gridX: 18,
      gridY: 7,
      gridW: 2,
      gridH: 3,
      interactive: true,
    },
    {
      id: 'farm_plot',
      spriteKey: 'obj_farm_plot',
      label: 'Hydroponic Farm',
      room: 'market',
      gridX: 2,
      gridY: 9,
      gridW: 3,
      gridH: 1,
      interactive: true,
    },

    // ---- Decorations (non-interactive) ----

    {
      id: 'ceiling_light_1',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 5,
      gridY: 5,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'ceiling_light_2',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 10,
      gridY: 5,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'ceiling_light_3',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 15,
      gridY: 5,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'ceiling_light_4',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 19,
      gridY: 5,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'wall_monitor_1',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 5,
      gridY: 6,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'wall_monitor_2',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 17,
      gridY: 6,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'plant_pot_1',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 6,
      gridY: 10,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'plant_pot_2',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 13,
      gridY: 10,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
    {
      id: 'plant_pot_3',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 19,
      gridY: 10,
      gridW: 1,
      gridH: 1,
      interactive: false,
    },
  ]

  return {
    width: W,
    height: H,
    tileSize: TILE_SIZE,
    bg,
    fg,
    objects,
  }
}
